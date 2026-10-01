// server.js — CactusMart Complete Backend
// Install deps first:
//   npm install express cors pg formidable dotenv bcryptjs jsonwebtoken cookie-parser

import express         from 'express';
import cors            from 'cors';
import cookieParser    from 'cookie-parser';
import { Pool }        from 'pg';
import formidable      from 'formidable';
import path            from 'path';
import { fileURLToPath } from 'url';
import bcrypt          from 'bcryptjs';
import jwt             from 'jsonwebtoken';
import dotenv          from 'dotenv';
import crypto          from 'crypto';
import { sendPasswordResetEmail } from './_email.js';
import { uploadImageFiles, deleteBlobs, removeTempFiles } from './_blob.js';

dotenv.config();

const __filename    = fileURLToPath(import.meta.url);
const __dirname     = path.dirname(__filename);
const app           = express();
const PORT          = process.env.PORT || 3000;
const JWT_SECRET    = process.env.JWT_SECRET || 'cactusmart_dev_secret_change_in_prod';
const PUBLIC_DIR    = path.join(__dirname, 'public');
// Base URL of the React app — used to build password-reset links.
// Never derived from request headers (Host/Origin can be spoofed).
const FRONTEND_URL  = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
const RESET_TOKEN_TTL_MIN  = 30;   // reset link lifetime
const RESET_COOLDOWN_SEC   = 60;   // min gap between reset emails per account

// ════════════════════════════════════════════════════════════
//  MIDDLEWARE
// ════════════════════════════════════════════════════════════
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    process.env.FRONTEND_URL,
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());
// LEGACY: serves images uploaded before the move to Vercel Blob (media.url = "/images/...").
// New uploads go to Blob. Remove this line once `npm run migrate:images -- --apply` has run.
app.use(express.static(PUBLIC_DIR));

// ════════════════════════════════════════════════════════════
//  DATABASE
// ════════════════════════════════════════════════════════════
console.log("POSTGRES_URL exists:", !!process.env.POSTGRES_URL);
console.log("POSTGRES_URL length:", process.env.POSTGRES_URL?.length);

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  // ssl: process.env.POSTGRES_URL?.includes('localhost')
  //   ? false
  //   : { rejectUnauthorized: false },
  ssl: false,
});

pool.on('connect', () => console.log('🐘 PostgreSQL connected'));
pool.on('error',  (err) => console.error('🐘 PG error:', err.message));

// ════════════════════════════════════════════════════════════
//  AUTH HELPERS
// ════════════════════════════════════════════════════════════
function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });
}

function sendAuthCookie(res, token) {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });
}

// ── authenticate middleware ───────────────────────────────────
// Besides verifying the JWT, rejects tokens issued before the user's last
// password change — so a password reset signs out every existing session.
async function authenticate(req, res, next) {
  try {
    const token =
      req.cookies?.auth_token ??
      req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      console.warn(`🔒 Unauthenticated request: ${req.method} ${req.path}`);
      return res.status(401).json({ error: 'Not authenticated — please log in' });
    }

    const payload = jwt.verify(token, JWT_SECRET);

    const { rows } = await pool.query(
      'SELECT FLOOR(EXTRACT(EPOCH FROM password_changed_at))::bigint AS changed FROM users WHERE id=$1',
      [payload.sub]);
    if (!rows.length)
      return res.status(401).json({ error: 'Account no longer exists — please log in again' });
    // iat is in whole seconds; a token from the same second as the change is still accepted,
    // which keeps the fresh login right after a reset valid.
    const changed = rows[0].changed === null ? null : Number(rows[0].changed);
    if (changed !== null && payload.iat < changed) {
      console.warn(`🔒 Token predates password change: user ${payload.sub}`);
      return res.status(401).json({ error: 'Your password was changed — please log in again' });
    }

    req.userId    = payload.sub;
    next();
  } catch (err) {
    console.warn(`🔒 Invalid token: ${err.message}`);
    return res.status(401).json({ error: 'Invalid or expired session — please log in again' });
  }
}

// ── requireAdmin middleware (use after authenticate) ──────────
// Role is read from the DB on each request, so demoting a user takes effect immediately.
async function requireAdmin(req, res, next) {
  try {
    const { rows } = await pool.query('SELECT role FROM users WHERE id=$1', [req.userId]);
    if (!rows.length || rows[0].role !== 'admin') {
      console.warn(`⛔ Non-admin blocked: ${req.method} ${req.path} (user ${req.userId})`);
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// ════════════════════════════════════════════════════════════
//  DEBUG
// ════════════════════════════════════════════════════════════
// Test that server is reachable
app.get('/api/ping', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ════════════════════════════════════════════════════════════
//  AUTH — REGISTER
// ════════════════════════════════════════════════════════════
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body ?? {};
  console.log(`📝 Register attempt: ${email}`);

  if (!username?.trim() || !email?.trim() || !password)
    return res.status(400).json({ error: 'username, email and password are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({ error: 'Invalid email address' });

  try {
    const existing = await pool.query(
      'SELECT id FROM users WHERE email=$1 OR username=$2',
      [email.toLowerCase(), username.trim()],
    );
    if (existing.rows.length)
      return res.status(409).json({ error: 'Email or username already taken' });

    const hashed = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (id, username, email, password, role, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'user', NOW())
       RETURNING id, username, email, role, avatar`,
      [username.trim(), email.toLowerCase(), hashed],
    );
    const user  = rows[0];
    const token = signToken(user.id);
    sendAuthCookie(res, token);
    console.log(`✅ Registered: ${user.username} (${user.id})`);
    res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role, avatar: user.avatar ?? null }, token });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  AUTH — LOGIN
// ════════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  console.log(`🔑 Login attempt: ${email}`);

  if (!email?.trim() || !password)
    return res.status(400).json({ error: 'email and password are required' });

  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, password, role, avatar FROM users WHERE email=$1',
      [email.toLowerCase().trim()],
    );
    if (!rows.length)
      return res.status(401).json({ error: 'Invalid email or password' });

    const user    = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user.id);
    sendAuthCookie(res, token);
    console.log(`✅ Login: ${user.username} (${user.id})`);
    res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role, avatar: user.avatar ?? null }, token });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  AUTH — FORGOT PASSWORD  (POST /api/auth/forgot-password)
//  Always responds with the same message so the endpoint can't be
//  used to discover which emails are registered.
// ════════════════════════════════════════════════════════════
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = req.body?.email?.toLowerCase().trim();
  if (!email) return res.status(400).json({ error: 'email is required' });

  const genericResponse = { message: 'If an account exists for that email, a reset link has been sent.' };

  try {
    const { rows } = await pool.query('SELECT id, username, email FROM users WHERE email=$1', [email]);
    if (!rows.length) {
      console.log(`🔑 Reset requested for unknown email: ${email}`);
      return res.json(genericResponse);
    }
    const user = rows[0];

    // Throttle: skip if a link was issued very recently
    const recent = await pool.query(
      `SELECT 1 FROM password_reset_tokens
       WHERE user_id=$1 AND created_at > NOW() - make_interval(secs => $2)`,
      [user.id, RESET_COOLDOWN_SEC]);
    if (recent.rows.length) {
      console.log(`🔑 Reset throttled for ${email}`);
      return res.json(genericResponse);
    }

    // Only the SHA-256 of the token is stored — a DB leak can't be used to reset passwords
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id=$1', [user.id]);   // one live link per user
    await pool.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + make_interval(mins => $3))`,
      [user.id, sha256(token), RESET_TOKEN_TTL_MIN]);

    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
    const result   = await sendPasswordResetEmail({
      to: user.email, username: user.username, resetUrl, expiresMinutes: RESET_TOKEN_TTL_MIN,
    });
    // Dev convenience: with no SMTP configured, print the link so the flow can still be tested
    if (result?.skipped && process.env.NODE_ENV !== 'production')
      console.log(`🔗 [dev] Reset link for ${user.email}: ${resetUrl}`);

    res.json(genericResponse);
  } catch (err) {
    console.error('Forgot-password error:', err.message);
    res.status(500).json({ error: 'Could not process request, please try again later' });
  }
});

// ════════════════════════════════════════════════════════════
//  AUTH — RESET PASSWORD  (POST /api/auth/reset-password)
// ════════════════════════════════════════════════════════════
app.post('/api/auth/reset-password', async (req, res) => {
  const { token, password } = req.body ?? {};
  if (!token || typeof token !== 'string' || !password)
    return res.status(400).json({ error: 'token and password are required' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock the row so the same link can't be redeemed twice concurrently
    const { rows } = await client.query(
      `SELECT id, user_id FROM password_reset_tokens
       WHERE token_hash=$1 AND expires_at > NOW()
       FOR UPDATE`,
      [sha256(token)]);
    if (!rows.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'This reset link is invalid or has expired. Please request a new one.' });
    }

    const hashed = await bcrypt.hash(password, 10);
    // password_changed_at invalidates every JWT issued before now (see authenticate)
    await client.query('UPDATE users SET password=$1, password_changed_at=NOW() WHERE id=$2', [hashed, rows[0].user_id]);
    await client.query('DELETE FROM password_reset_tokens WHERE user_id=$1', [rows[0].user_id]);
    await client.query('COMMIT');

    console.log(`✅ Password reset for user ${rows[0].user_id} — existing sessions revoked`);
    res.clearCookie('auth_token');   // this browser's session (if any) is now invalid too
    res.json({ message: 'Password updated — you can now log in.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reset-password error:', err.message);
    res.status(500).json({ error: 'Could not reset password, please try again' });
  } finally { client.release(); }
});

// ════════════════════════════════════════════════════════════
//  AUTH — LOGOUT
// ════════════════════════════════════════════════════════════
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.json({ message: 'Logged out' });
});

// ════════════════════════════════════════════════════════════
//  AUTH — ME (restore session)
// ════════════════════════════════════════════════════════════
app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, username, email, role, avatar FROM users WHERE id=$1',
      [req.userId],
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  AUTH — MY BIDS  (protected)
// ════════════════════════════════════════════════════════════
app.get('/api/auth/my-bids', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         b.id,
         b.amount::float            AS "myAmount",
         b.placed_at                AS "placedAt",
         a.id                       AS "auctionId",
         a.current_price::float     AS "currentPrice",
         a.ends_at                  AS "endsAt",
         a.is_active                AS "isActive",
         c.id                       AS "cactusId",
         c.name                     AS "cactusName",
         (SELECT url FROM media WHERE cactus_id=c.id AND type='Image' ORDER BY sort_order ASC LIMIT 1) AS "thumbnailUrl",
         CASE
           WHEN NOT a.is_active OR a.ends_at<=NOW() THEN
             CASE WHEN b.amount>=a.current_price THEN 'won' ELSE 'lost' END
           ELSE
             CASE WHEN b.amount>=a.current_price THEN 'winning' ELSE 'outbid' END
         END AS status
       FROM bid b
       JOIN auction a ON a.id=b.auction_id
       JOIN cactus  c ON c.id=a.cactus_id
       WHERE b.user_id=$1
       ORDER BY b.placed_at DESC`,
      [req.userId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  AUTH — MY ORDERS  (protected)
// ════════════════════════════════════════════════════════════
app.get('/api/auth/my-orders', authenticate, async (req, res) => {
  try {
    const ordersResult = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.order_status   AS "orderStatus",
         o.payment_status AS "paymentStatus",
         o.total::float,
         o.payment_method AS "paymentMethod",
         o.transaction_id AS "transactionId",
         o.rejection_note AS "rejectionNote",
         o.verified_at    AS "verifiedAt",
         o.created_at     AS "createdAt"
       FROM orders o
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [req.userId],
    );

    if (!ordersResult.rows.length) return res.json([]);

    const orderIds    = ordersResult.rows.map(o => o.id);
    const itemsResult = await pool.query(
      `SELECT
         oi.order_id   AS "orderId",
         oi.quantity,
         oi.unit_price::float AS "unitPrice",
         c.name,
         c.id          AS "cactusId",
         (SELECT url FROM media WHERE cactus_id=c.id AND type='Image'
          ORDER BY sort_order ASC NULLS LAST LIMIT 1) AS "thumbnailUrl"
       FROM order_items oi
       JOIN cactus c ON c.id = oi.cactus_id
       WHERE oi.order_id = ANY($1)`,
      [orderIds],
    );

    const map = {};
    for (const item of itemsResult.rows) {
      if (!map[item.orderId]) map[item.orderId] = [];
      map[item.orderId].push(item);
    }

    res.json(ordersResult.rows.map(o => ({
      ...o,
      items:       map[o.id] ?? [],
      orderNumber: `CM-${String(o.id).padStart(6, '0')}`,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ════════════════════════════════════════════════════════════
//  CATEGORIES
// ════════════════════════════════════════════════════════════
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, description FROM categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  CACTUS — LIST
// ════════════════════════════════════════════════════════════
app.get('/api/cactus', async (req, res) => {
  try {
    const page       = Math.max(1, parseInt(req.query.page)  || 1);
    const limit      = Math.min(parseInt(req.query.limit)    || 12, 100);
    const offset     = (page - 1) * limit;
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId) : null;
    const search     = (req.query.search ?? '').trim();

    const whereParts = [];
    const params     = [];
    if (categoryId) { params.push(categoryId); whereParts.push(`c.category_id=$${params.length}`); }
    if (search)     { params.push(`%${search}%`); whereParts.push(`(c.name ILIKE $${params.length} OR c.description ILIKE $${params.length} OR cat.name ILIKE $${params.length})`); }

    const where       = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const countParams = [...params];
    params.push(limit, offset);

    const dataSql = `
      SELECT c.id, c.name, c.description,
             c.base_price::float AS "basePrice",
             cat.name AS "categoryName", cat.id AS "categoryId",
             COALESCE(c.rating,0)::float AS "rating",
             COALESCE(c.rating_count,0)::int AS "ratingCount",
             (SELECT url FROM media WHERE cactus_id=c.id AND type='Image' ORDER BY sort_order ASC NULLS LAST LIMIT 1) AS "thumbnailUrl",
             CASE WHEN EXISTS (SELECT 1 FROM auction a WHERE a.cactus_id=c.id AND a.is_active=true AND a.ends_at>NOW())
               THEN true ELSE false END AS "hasAuction"
      FROM cactus c LEFT JOIN categories cat ON cat.id=c.category_id
      ${where} ORDER BY c.id DESC
      LIMIT $${params.length-1} OFFSET $${params.length}`;

    const [data, count] = await Promise.all([
      pool.query(dataSql, params),
      pool.query(`SELECT COUNT(*)::int AS count FROM cactus c LEFT JOIN categories cat ON cat.id=c.category_id ${where}`, countParams),
    ]);

    res.json({ items: data.rows, totalCount: count.rows[0].count,
      totalPages: Math.ceil(count.rows[0].count / limit), page, pageSize: limit });
  } catch (err) {
    console.error('GET /api/cactus:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  CACTUS — DETAIL
// ════════════════════════════════════════════════════════════
app.get('/api/cactus/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID' });
  try {
    const cactusRes = await pool.query(
      `SELECT c.id, c.name, c.description, c.base_price::float AS "basePrice",
              c.category_id AS "categoryId", c.created_at AS "createdAt",
              COALESCE(c.rating,0)::float AS "rating",
              COALESCE(c.rating_count,0)::int AS "ratingCount",
              cat.name AS "categoryName"
       FROM cactus c LEFT JOIN categories cat ON cat.id=c.category_id WHERE c.id=$1`, [id]);
    if (!cactusRes.rows.length) return res.status(404).json({ error: `Cactus ${id} not found` });

    const mediaRes   = await pool.query(`SELECT id, type, url, COALESCE(sort_order,0) AS "sortOrder" FROM media WHERE cactus_id=$1 ORDER BY sort_order ASC NULLS LAST, id ASC`, [id]);
    const auctionRes = await pool.query(
      `SELECT a.id, a.cactus_id AS "cactusId", a.start_price::float AS "startPrice",
              a.current_price::float AS "currentPrice", a.bid_increment::float AS "bidIncrement",
              a.ends_at AS "endsAt", a.is_active AS "isActive",
              (SELECT COUNT(*)::int FROM bid WHERE auction_id=a.id) AS "totalBids"
       FROM auction a WHERE a.cactus_id=$1 AND a.is_active=true AND a.ends_at>NOW() ORDER BY a.id DESC LIMIT 1`, [id]);

    res.json({ ...cactusRes.rows[0], media: mediaRes.rows, auction: auctionRes.rows[0] ?? null });
  } catch (err) {
    console.error(`GET /api/cactus/${id}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  CACTUS — CREATE
// ════════════════════════════════════════════════════════════
app.post('/api/cactus', authenticate, requireAdmin, async (req, res) => {
  // Files are parsed to the OS temp dir, then uploaded to Vercel Blob
  const form = formidable({ multiples: true, keepExtensions: true, maxFileSize: 10*1024*1024, maxFiles: 5 });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: err.message });
    const str = f => (Array.isArray(f) ? f[0] : f) ?? '';
    const name = str(fields.name)?.trim(), description = str(fields.description)?.trim();
    const categoryId = parseInt(str(fields.categoryId)), basePrice = parseFloat(str(fields.basePrice));
    const forAuction = str(fields.forAuction) === 'true';
    const startPrice = parseFloat(str(fields.startPrice) || '0');
    const bidIncrement = parseFloat(str(fields.bidIncrement) || '2.5');
    const auctionHours = parseFloat(str(fields.auctionHours) || '48');
    const videoUrl = str(fields.videoUrl)?.trim();
    const imageFiles = (Array.isArray(files.images) ? files.images : [files.images]).filter(f => f?.size > 0);

    if (!name || isNaN(categoryId) || isNaN(basePrice)) {
      await removeTempFiles(imageFiles);
      return res.status(400).json({ error: 'name, categoryId and basePrice are required' });
    }

    console.log(`📸 Creating cactus "${name}" with ${imageFiles.length} image(s)`);

    let imageUrls;
    try {
      imageUrls = await uploadImageFiles(imageFiles);
    } catch (uploadErr) {
      console.error('POST /api/cactus image upload:', uploadErr.message);
      return res.status(500).json({ error: `Image upload failed: ${uploadErr.message}` });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        `INSERT INTO cactus (name, description, category_id, base_price) VALUES ($1,$2,$3,$4) RETURNING id`,
        [name, description || null, categoryId, basePrice]);
      const cactusId = rows[0].id;

      for (let i = 0; i < imageUrls.length; i++) {
        await client.query(`INSERT INTO media (cactus_id, type, url, sort_order) VALUES ($1,'Image',$2,$3)`, [cactusId, imageUrls[i], i]);
      }
      if (videoUrl) await client.query(`INSERT INTO media (cactus_id, type, url, sort_order) VALUES ($1,'Video',$2,0)`, [cactusId, videoUrl]);

      if (forAuction) {
        const endsAt = new Date(Date.now() + auctionHours * 3_600_000);
        await client.query(
          `INSERT INTO auction (cactus_id, start_price, current_price, bid_increment, ends_at, is_active) VALUES ($1,$2,$3,$4,$5,true)`,
          [cactusId, startPrice || basePrice, startPrice || basePrice, bidIncrement, endsAt]);
      }
      await client.query('COMMIT');
      console.log(`✅ Cactus #${cactusId} "${name}" created`);
      res.status(201).json({ id: cactusId, success: true });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      await deleteBlobs(imageUrls);   // don't leave orphaned uploads behind
      console.error('POST /api/cactus:', dbErr.message);
      res.status(500).json({ error: dbErr.message });
    } finally { client.release(); }
  });
});

// ════════════════════════════════════════════════════════════
//  CACTUS — UPDATE
// ════════════════════════════════════════════════════════════
app.put('/api/cactus/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  // Files are parsed to the OS temp dir, then uploaded to Vercel Blob
  const form = formidable({ multiples: true, keepExtensions: true, maxFileSize: 10*1024*1024 });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(400).json({ error: err.message });
    const str = f => (Array.isArray(f) ? f[0] : f) ?? '';
    const name = str(fields.name)?.trim(), description = str(fields.description)?.trim();
    const categoryId = parseInt(str(fields.categoryId)), basePrice = parseFloat(str(fields.basePrice));
    const imageFiles = (Array.isArray(files.images) ? files.images : [files.images]).filter(f => f?.size > 0);
    if (!name || isNaN(categoryId) || isNaN(basePrice)) {
      await removeTempFiles(imageFiles);
      return res.status(400).json({ error: 'name, categoryId and basePrice are required' });
    }

    let imageUrls;
    try {
      imageUrls = await uploadImageFiles(imageFiles);
    } catch (uploadErr) {
      console.error(`PUT /api/cactus/${id} image upload:`, uploadErr.message);
      return res.status(500).json({ error: `Image upload failed: ${uploadErr.message}` });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE cactus SET name=$1, description=$2, category_id=$3, base_price=$4, updated_at=NOW() WHERE id=$5`,
        [name, description || null, categoryId, basePrice, id]);
      if (!result.rowCount) throw new Error(`Cactus ${id} not found`);
      for (let i = 0; i < imageUrls.length; i++) {
        const { rows } = await client.query(`SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM media WHERE cactus_id=$1`, [id]);
        await client.query(`INSERT INTO media (cactus_id, type, url, sort_order) VALUES ($1,'Image',$2,$3)`,
          [id, imageUrls[i], rows[0].next + i]);
      }
      await client.query('COMMIT');
      res.json({ message: 'Updated successfully' });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      await deleteBlobs(imageUrls);   // don't leave orphaned uploads behind
      res.status(500).json({ error: dbErr.message });
    } finally { client.release(); }
  });
});

// ════════════════════════════════════════════════════════════
//  CACTUS — DELETE
// ════════════════════════════════════════════════════════════
app.delete('/api/cactus/:id', authenticate, requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM bid WHERE auction_id IN (SELECT id FROM auction WHERE cactus_id=$1)`, [id]);
    await client.query(`DELETE FROM auction WHERE cactus_id=$1`, [id]);
    const { rows: mediaRows } = await client.query(`DELETE FROM media WHERE cactus_id=$1 AND type='Image' RETURNING url`, [id]);
    await client.query(`DELETE FROM media   WHERE cactus_id=$1`, [id]);
    const r = await client.query(`DELETE FROM cactus WHERE id=$1`, [id]);
    if (!r.rowCount) throw new Error('Not found');
    await client.query('COMMIT');
    await deleteBlobs(mediaRows.map(m => m.url));   // only after the DB delete succeeded
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally { client.release(); }
});

// ════════════════════════════════════════════════════════════
//  ADMIN STATS
// ════════════════════════════════════════════════════════════
app.get('/api/admin/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const [species, auctions, bids, bidders, revenue, weekly] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM cactus`),
      pool.query(`SELECT COUNT(*)::int AS count FROM auction WHERE is_active=true AND ends_at>NOW()`),
      pool.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(amount),0)::float AS total FROM bid WHERE placed_at>=NOW()-INTERVAL '24 hours'`),
      pool.query(`SELECT COUNT(DISTINCT user_id)::int AS count FROM bid`),
      pool.query(`SELECT COALESCE(SUM(current_price),0)::float AS total FROM auction WHERE is_active=false`),
      pool.query(`SELECT TO_CHAR(DATE_TRUNC('day',placed_at),'Dy') AS day, COALESCE(SUM(amount),0)::float AS revenue, COUNT(*)::int AS bid_count FROM bid WHERE placed_at>=NOW()-INTERVAL '7 days' GROUP BY DATE_TRUNC('day',placed_at) ORDER BY DATE_TRUNC('day',placed_at) ASC`),
    ]);
    const weekMap = {};
    for (const row of weekly.rows) weekMap[row.day] = row;
    const weeklyChart = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => ({
      day: d, revenue: parseFloat(weekMap[d]?.revenue ?? 0), bidCount: parseInt(weekMap[d]?.bid_count ?? 0),
    }));
    res.json({ totalSpecies: species.rows[0].count, liveAuctions: auctions.rows[0].count,
      bidsToday: bids.rows[0].count, bidsTodayValue: bids.rows[0].total,
      uniqueBidders: bidders.rows[0].count, totalRevenue: revenue.rows[0].total, weeklyChart });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ════════════════════════════════════════════════════════════
//  AUCTIONS — GET ALL ACTIVE  (GET /api/auctions/active)
//  Single efficient query — returns everything the Auctions
//  page needs: cactus info + auction info + thumbnail in one go.
// ════════════════════════════════════════════════════════════
app.get('/api/auctions/active', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        c.id                                                AS "cactusId",
        c.name                                             AS "cactusName",
        c.description                                      AS "description",
        cat.name                                           AS "categoryName",
        c.base_price::float                               AS "basePrice",
        (
          SELECT url FROM media
          WHERE cactus_id = c.id AND type = 'Image'
          ORDER BY sort_order ASC NULLS LAST LIMIT 1
        )                                                  AS "thumbnailUrl",
        a.id                                               AS "auctionId",
        a.start_price::float                              AS "startPrice",
        a.current_price::float                            AS "currentPrice",
        a.bid_increment::float                            AS "bidIncrement",
        a.ends_at                                         AS "endsAt",
        a.is_active                                       AS "isActive",
        (SELECT COUNT(*)::int FROM bid WHERE auction_id = a.id) AS "totalBids"
      FROM auction a
      JOIN cactus c     ON c.id  = a.cactus_id
      LEFT JOIN categories cat ON cat.id = c.category_id
      WHERE a.is_active = true
        AND a.ends_at > NOW()
      ORDER BY a.ends_at ASC
    `);
    console.log(`GET /api/auctions/active → ${rows.length} active auctions`);
    res.json(rows);
  } catch (err) {
    console.error('GET /api/auctions/active:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  AUCTION — GET
// ════════════════════════════════════════════════════════════
app.get('/api/auction/:cactusId', async (req, res) => {
  const cactusId = parseInt(req.params.cactusId);
  try {
    const result = await pool.query(
      `SELECT a.id, a.cactus_id AS "cactusId", a.start_price::float AS "startPrice",
              a.current_price::float AS "currentPrice", a.bid_increment::float AS "bidIncrement",
              a.ends_at AS "endsAt", a.is_active AS "isActive",
              (SELECT COUNT(*)::int FROM bid WHERE auction_id=a.id) AS "totalBids"
       FROM auction a WHERE a.cactus_id=$1 AND a.is_active=true AND a.ends_at>NOW() ORDER BY a.id DESC LIMIT 1`,
      [cactusId]);
    if (!result.rows.length) return res.status(404).json({ error: 'No active auction' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
//  AUCTION — BID  (protected)
// ════════════════════════════════════════════════════════════
app.post('/api/auction/bid', authenticate, async (req, res) => {
  const { cactusId, userId, amount } = req.body ?? {};
  const bidAmount = parseFloat(amount);
  if (!cactusId || isNaN(bidAmount) || bidAmount <= 0)
    return res.status(400).json({ error: 'cactusId and amount are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const aucResult = await client.query(
      `SELECT id, current_price AS "currentPrice", ends_at AS "endsAt" FROM auction WHERE cactus_id=$1 AND is_active=true FOR UPDATE`, [cactusId]);
    if (!aucResult.rows.length) throw new Error('No active auction');
    const auc = aucResult.rows[0];
    if (new Date(auc.endsAt) <= new Date()) throw new Error('Auction has ended');
    if (bidAmount <= parseFloat(auc.currentPrice)) throw new Error(`Bid must exceed ₹${parseFloat(auc.currentPrice).toFixed(2)}`);

    const bidResult = await client.query(
      `INSERT INTO bid (auction_id, user_id, amount, placed_at) VALUES ($1,$2,$3,NOW()) RETURNING id, amount::float, placed_at AS "placedAt"`,
      [auc.id, req.userId, bidAmount]);
    await client.query(`UPDATE auction SET current_price=$1, updated_at=NOW() WHERE id=$2`, [bidAmount, auc.id]);
    await client.query('COMMIT');
    console.log(`✅ Bid ₹${bidAmount} placed by ${req.userId} on cactus #${cactusId}`);

    // Get username for response
    const userRes = await pool.query('SELECT username FROM users WHERE id=$1', [req.userId]);
    res.status(201).json({ ...bidResult.rows[0], username: userRes.rows[0]?.username ?? req.userId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/auction/bid:', err.message);
    res.status(400).json({ error: err.message });
  } finally { client.release(); }
});

// ════════════════════════════════════════════════════════════
//  BID HISTORY
// ════════════════════════════════════════════════════════════
app.get('/api/auction/history/:cactusId', async (req, res) => {
  const cactusId = parseInt(req.params.cactusId);
  try {
    const result = await pool.query(
      `SELECT b.id, COALESCE(u.username, b.user_id::text) AS username,
              b.amount::float AS amount, b.placed_at AS "placedAt"
       FROM bid b JOIN auction a ON a.id=b.auction_id LEFT JOIN users u ON u.id=b.user_id
       WHERE a.cactus_id=$1 ORDER BY b.placed_at DESC LIMIT 50`, [cactusId]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
//  CART — GET  (protected)
// ════════════════════════════════════════════════════════════
app.get('/api/cart', authenticate, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ci.id, ci.quantity, c.id AS "cactusId", c.name, c.description,
              c.base_price::float AS "price", cat.name AS "categoryName",
              (SELECT url FROM media WHERE cactus_id=c.id AND type='Image' ORDER BY sort_order ASC NULLS LAST LIMIT 1) AS "thumbnailUrl"
       FROM cart_items ci JOIN cactus c ON c.id=ci.cactus_id JOIN categories cat ON cat.id=c.category_id
       WHERE ci.user_id=$1 ORDER BY ci.added_at DESC`, [req.userId]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
//  CART — ADD  (protected)
// ════════════════════════════════════════════════════════════
app.post('/api/cart', authenticate, async (req, res) => {
  const { cactusId, quantity = 1 } = req.body ?? {};
  if (!cactusId) return res.status(400).json({ error: 'cactusId is required' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO cart_items (user_id, cactus_id, quantity) VALUES ($1,$2,$3)
       ON CONFLICT (user_id, cactus_id) DO UPDATE SET quantity=cart_items.quantity+EXCLUDED.quantity, added_at=NOW()
       RETURNING id, quantity`, [req.userId, cactusId, quantity]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
//  CART — UPDATE QTY  (protected)
// ════════════════════════════════════════════════════════════
app.put('/api/cart/:cactusId', authenticate, async (req, res) => {
  const cactusId = parseInt(req.params.cactusId);
  const { quantity } = req.body ?? {};
  if (!quantity || quantity < 1) return res.status(400).json({ error: 'quantity >= 1 required' });
  try {
    await pool.query(`UPDATE cart_items SET quantity=$1 WHERE user_id=$2 AND cactus_id=$3`, [quantity, req.userId, cactusId]);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
//  CART — REMOVE ITEM  (protected)
// ════════════════════════════════════════════════════════════
app.delete('/api/cart/:cactusId', authenticate, async (req, res) => {
  const cactusId = parseInt(req.params.cactusId);
  try {
    await pool.query(`DELETE FROM cart_items WHERE user_id=$1 AND cactus_id=$2`, [req.userId, cactusId]);
    res.json({ message: 'Removed' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
//  CART — CLEAR  (protected)
// ════════════════════════════════════════════════════════════
app.delete('/api/cart', authenticate, async (req, res) => {
  try {
    await pool.query(`DELETE FROM cart_items WHERE user_id=$1`, [req.userId]);
    res.json({ message: 'Cart cleared' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
//  ORDERS — CREATE  (protected)
// ════════════════════════════════════════════════════════════
app.post('/api/orders', authenticate, async (req, res) => {
  const {
    userId, items, address, paymentMethod,
    subtotal, shipping, tax, total,
    transactionId,   // ← new: UTR/ref from Google Pay
    upiId,           // ← new: UPI ID used (for record)
  } = req.body ?? {};

  console.log(`📦 POST /api/orders — user:${req.userId} method:${paymentMethod} txn:${transactionId ?? 'N/A'}`);

  if (!userId || !items?.length || !address || !paymentMethod)
    return res.status(400).json({ error: 'userId, items, address and paymentMethod are required' });

  if (req.userId !== userId)
    return res.status(403).json({ error: 'User ID mismatch' });

  // Validate Google Pay orders must have a transaction ID
  if (paymentMethod === 'googlepay') {
    if (!transactionId?.trim())
      return res.status(400).json({ error: 'Transaction ID (UTR) is required for Google Pay orders' });
    if (transactionId.trim().length < 6)
      return res.status(400).json({ error: 'Transaction ID must be at least 6 characters' });
  }

  // Determine initial statuses
  const isGPay         = paymentMethod === 'googlepay';
  const paymentStatus  = isGPay ? 'pending_verification' : 'paid';
  const orderStatus    = isGPay ? 'pending'              : 'confirmed';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO orders (
         user_id, status, order_status, payment_status,
         subtotal, shipping, tax, total,
         payment_method, transaction_id, upi_id,
         first_name, last_name, email, phone,
         address_line1, address_line2, city, state, zip, country,
         created_at, updated_at
       ) VALUES (
         $1::uuid, $2, $3, $4,
         $5::numeric, $6::numeric, $7::numeric, $8::numeric,
         $9, $10, $11,
         $12, $13, $14, $15,
         $16, $17, $18, $19, $20, $21,
         NOW(), NOW()
       ) RETURNING id`,
      [
        userId, orderStatus, orderStatus, paymentStatus,
        subtotal ?? 0, shipping ?? 0, tax ?? 0, total ?? 0,
        paymentMethod, transactionId?.trim() ?? null, upiId?.trim() ?? null,
        address.firstName, address.lastName, address.email, address.phone ?? null,
        address.line1, address.line2 ?? null, address.city,
        address.state, address.zip, address.country ?? 'US',
      ],
    );

    const orderId = rows[0].id;

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, cactus_id, quantity, unit_price)
         VALUES ($1, $2::int, $3::int, $4::numeric)`,
        [orderId, item.cactusId, item.quantity, item.unitPrice],
      );
    }

    await client.query('COMMIT');
    const orderNumber = `CM-${String(orderId).padStart(6, '0')}`;
    console.log(`✅ Order ${orderNumber} — payment_status:${paymentStatus} order_status:${orderStatus}`);

    res.status(201).json({
      id: orderId, orderNumber, status: orderStatus,
      paymentStatus, orderStatus,
      requiresVerification: isGPay,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ POST /api/orders:', err.message);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// ════════════════════════════════════════════════════════════
//  GET /api/admin/pending-payments   (admin only)
//  Lists all Google Pay orders awaiting manual verification
// ════════════════════════════════════════════════════════════
app.get('/api/admin/pending-payments', authenticate, async (req, res) => {
  try {
    // Verify requester is admin
    const userRes = await pool.query('SELECT role FROM users WHERE id=$1', [req.userId]);
    if (!userRes.rows.length || userRes.rows[0].role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });

    const { rows } = await pool.query(
      `SELECT
         o.id,
         o.user_id          AS "userId",
         u.username,
         u.email,
         o.total::float,
         o.payment_method   AS "paymentMethod",
         o.transaction_id   AS "transactionId",
         o.payment_status   AS "paymentStatus",
         o.order_status     AS "orderStatus",
         o.created_at       AS "createdAt",
         o.first_name       AS "firstName",
         o.last_name        AS "lastName",
         o.phone,
         o.city,
         o.country,
         (
           SELECT json_agg(json_build_object(
             'name',      c.name,
             'quantity',  oi.quantity,
             'unitPrice', oi.unit_price::float
           ) ORDER BY oi.id)
           FROM order_items oi
           JOIN cactus c ON c.id = oi.cactus_id
           WHERE oi.order_id = o.id
         ) AS items
       FROM orders o
       JOIN users u ON u.id = o.user_id::uuid
       WHERE o.payment_method = 'googlepay'
         AND o.payment_status = 'pending_verification'
       ORDER BY o.created_at ASC`,
    );

    res.json(rows);
  } catch (err) {
    console.error('GET /api/admin/pending-payments:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  POST /api/admin/verify-payment   (admin only)
//  Approve or reject a Google Pay order
// ════════════════════════════════════════════════════════════
app.post('/api/admin/verify-payment', authenticate, async (req, res) => {
  const { orderId, action, note } = req.body ?? {};

  if (!orderId || !action)
    return res.status(400).json({ error: 'orderId and action are required' });
  if (!['approved', 'rejected'].includes(action))
    return res.status(400).json({ error: 'action must be "approved" or "rejected"' });

  console.log(`🔍 Payment verification: order #${orderId} action:${action} by admin:${req.userId}`);

  try {
    // Verify requester is admin
    const userRes = await pool.query('SELECT role FROM users WHERE id=$1', [req.userId]);
    if (!userRes.rows.length || userRes.rows[0].role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });

    // Verify order exists and is pending
    const orderRes = await pool.query(
      `SELECT id, payment_status, order_status FROM orders WHERE id=$1`, [orderId],
    );
    if (!orderRes.rows.length)
      return res.status(404).json({ error: 'Order not found' });
    if (orderRes.rows[0].payment_status !== 'pending_verification')
      return res.status(400).json({ error: `Order is already ${orderRes.rows[0].payment_status}` });

    const paymentStatus = action === 'approved' ? 'paid'     : 'rejected';
    const orderStatus   = action === 'approved' ? 'confirmed': 'payment_failed';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update order statuses
      await client.query(
        `UPDATE orders
         SET payment_status = $1,
             order_status   = $2,
             status         = $2,
             verified_at    = NOW(),
             verified_by    = $3,
             rejection_note = $4,
             updated_at     = NOW()
         WHERE id = $5`,
        [paymentStatus, orderStatus, req.userId, note ?? null, orderId],
      );

      // Write audit log
      await client.query(
        `INSERT INTO payment_audit_log (order_id, admin_id, action, note)
         VALUES ($1, $2, $3, $4)`,
        [orderId, req.userId, action, note ?? null],
      );

      await client.query('COMMIT');
      console.log(`✅ Order #${orderId} → payment:${paymentStatus} order:${orderStatus}`);

      res.json({
        message:       `Payment ${action} successfully`,
        orderId,
        paymentStatus,
        orderStatus,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('POST /api/admin/verify-payment:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  GET /api/admin/payment-audit/:orderId   (admin only)
//  Returns audit log for a specific order
// ════════════════════════════════════════════════════════════
app.get('/api/admin/payment-audit/:orderId', authenticate, async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  try {
    const userRes = await pool.query('SELECT role FROM users WHERE id=$1', [req.userId]);
    if (!userRes.rows.length || userRes.rows[0].role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });

    const { rows } = await pool.query(
      `SELECT
         l.id,
         l.action,
         l.note,
         l.created_at AS "createdAt",
         u.username   AS "adminUsername"
       FROM payment_audit_log l
       JOIN users u ON u.id = l.admin_id
       WHERE l.order_id = $1
       ORDER BY l.created_at DESC`,
      [orderId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ════════════════════════════════════════════════════════════
//  ORDERS — GET USER ORDERS  (protected)
// ════════════════════════════════════════════════════════════
app.get('/api/orders', authenticate, async (req, res) => {
  try {
    const ordersResult = await pool.query(
      `SELECT o.id, o.status, o.total::float, o.payment_method AS "paymentMethod", o.created_at AS "createdAt"
       FROM orders o WHERE o.user_id=$1 ORDER BY o.created_at DESC`, [req.userId]);
    if (!ordersResult.rows.length) return res.json([]);
    const orderIds = ordersResult.rows.map(o => o.id);
    const itemsResult = await pool.query(
      `SELECT oi.order_id AS "orderId", oi.quantity, oi.unit_price::float AS "unitPrice",
              c.name, c.id AS "cactusId",
              (SELECT url FROM media WHERE cactus_id=c.id AND type='Image' ORDER BY sort_order ASC NULLS LAST LIMIT 1) AS "thumbnailUrl"
       FROM order_items oi JOIN cactus c ON c.id=oi.cactus_id WHERE oi.order_id=ANY($1)`, [orderIds]);
    const map = {};
    for (const item of itemsResult.rows) { if (!map[item.orderId]) map[item.orderId]=[]; map[item.orderId].push(item); }
    res.json(ordersResult.rows.map(o => ({ ...o, items: map[o.id]??[], orderNumber:`CM-${String(o.id).padStart(6,'0')}` })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════════
//  START
// ════════════════════════════════════════════════════════════
// Create tables added after the initial schema (idempotent)
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          SERIAL PRIMARY KEY,
      user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash  TEXT        NOT NULL UNIQUE,
      expires_at  TIMESTAMPTZ NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  // NULL = never changed → all existing tokens stay valid
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ`);
}
ensureSchema().catch(err => console.error('⚠️  ensureSchema failed:', err.message));

// On Vercel the app runs as a serverless function (see vercel.json) — no listening port.
// Locally (`node server.js` / `node api/server.js`) it starts a normal HTTP server.
export default app;

if (!process.env.VERCEL) app.listen(PORT, () => {
  console.log(`🌵 CactusMart API  →  http://localhost:${PORT}`);
  console.log(`📁 Static files    →  ${PUBLIC_DIR}`);
  console.log(`🔑 JWT secret set  →  ${JWT_SECRET !== 'cactusmart_dev_secret_change_in_prod' ? 'YES ✅' : 'default (change in prod!)'}`);
  console.log(`🔍 Ping test       →  http://localhost:${PORT}/api/ping`);
});
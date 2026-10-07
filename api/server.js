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
const DB_URL = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!DB_URL) {
  // Without this, pg silently falls back to 127.0.0.1:5432 → ECONNREFUSED on Vercel.
  console.error('❌ POSTGRES_URL is not set. Add it in Vercel → Settings → Environment Variables and redeploy.');
}
const IS_LOCAL_DB = /localhost|127\.0\.0\.1/.test(DB_URL || '');

const pool = new Pool({
  connectionString: DB_URL,
  // Hosted Postgres (Neon/Supabase/Vercel) requires SSL; local Postgres usually doesn't.
  ssl: IS_LOCAL_DB ? false : { rejectUnauthorized: false },
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

// ── Inventory helpers ─────────────────────────────────────────
// Admin stock input → whole number ≥ 0, or null if invalid
function parseStock(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// Error message when `wanted` units exceed `stock`, else null.
// `inCart` explains a refused add-to-cart when some of the stock is already in the cart.
function checkStock(stock, wanted, inCart = 0) {
  if (stock <= 0) return 'This cactus is sold out';
  if (wanted <= stock) return null;
  return inCart > 0
    ? `Only ${stock} available — you already have ${inCart} in your cart`
    : `Only ${stock} available`;
}

// ── Order pricing ─────────────────────────────────────────────
// Totals are calculated here from current prices, never trusted from the client.
// Keep in sync with SHIPPING_THRESHOLD / SHIPPING_COST in src/config/store.ts and TAX_RATE in CheckoutPage.tsx.
const SHIPPING_THRESHOLD = 75;
const SHIPPING_COST      = 9.99;
const TAX_RATE           = 0;
const roundMoney = (n) => Math.round(n * 100) / 100;

// ── Shipment & tracking ───────────────────────────────────────
// Customer-facing order status: the shipment status once fulfilment has started,
// otherwise derived from the payment status. Needs `orders o LEFT JOIN order_shipments s`.
const TRACKING_STATUS_SQL = `COALESCE(s.status, CASE o.payment_status
  WHEN 'paid'     THEN 'payment_verified'
  WHEN 'rejected' THEN 'payment_failed'
  ELSE 'payment_pending' END)`;

const SHIPMENT_STATUSES = ['processing', 'dispatched', 'in_transit', 'delivered', 'cancelled'];
// Statuses that mean the parcel has left — courier, tracking number and dispatch date are required
const SHIPPED_STATUSES  = ['dispatched', 'in_transit', 'delivered'];
const COURIERS = { dtdc: 'DTDC', india_post: 'India Post', bluedart: 'Blue Dart', delhivery: 'Delhivery', other: 'Other' };

const SHIPMENT_SELECT = `
  s.status          AS "shipmentStatus",
  s.courier,
  s.courier_name    AS "courierName",
  s.tracking_number AS "trackingNumber",
  s.tracking_url    AS "trackingUrl",
  to_char(s.dispatch_date, 'YYYY-MM-DD')           AS "dispatchDate",
  to_char(s.estimated_delivery_date, 'YYYY-MM-DD') AS "estimatedDeliveryDate",
  s.updated_at      AS "shipmentUpdatedAt"`;

// Move the flat SHIPMENT_SELECT columns into a `shipment` object (null before fulfilment starts)
function withShipment(row) {
  const { shipmentStatus, courier, courierName, trackingNumber, trackingUrl,
          dispatchDate, estimatedDeliveryDate, shipmentUpdatedAt, ...rest } = row;
  return {
    ...rest,
    shipment: shipmentStatus ? {
      status: shipmentStatus, courier, courierName, trackingNumber, trackingUrl,
      dispatchDate, estimatedDeliveryDate, updatedAt: shipmentUpdatedAt,
    } : null,
  };
}

async function getStatusHistory(orderId) {
  const { rows } = await pool.query(
    `SELECT h.id, h.status, h.note, h.created_at AS "createdAt"
     FROM order_status_history h
     WHERE h.order_id = $1
     ORDER BY h.created_at ASC, h.id ASC`,
    [orderId],
  );
  return rows;
}

// Best-effort history entry for the existing order/payment flows — runs after their
// transaction commits, so a history failure can never fail the order itself.
function recordStatusHistory(orderId, status, note, changedBy = null) {
  pool.query(
    `INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES ($1, $2, $3, $4)`,
    [orderId, status, note ?? null, changedBy],
  ).catch(err => console.error(`⚠️  status history for order #${orderId}:`, err.message));
}

// Real calendar date in YYYY-MM-DD form (rejects 2026-02-30 etc.)
const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v)
  && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))
  && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

// Validates and normalises the shipment form. Returns { error } or { value }.
function parseShipmentInput(body) {
  const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : null);
  const status         = str(body?.status);
  const courier        = str(body?.courier);
  const courierName    = str(body?.courierName);
  const trackingNumber = str(body?.trackingNumber);
  const trackingUrl    = str(body?.trackingUrl);
  const dispatchDate   = str(body?.dispatchDate);
  const etaDate        = str(body?.estimatedDeliveryDate);
  const note           = str(body?.note);

  if ([status, courier, courierName, trackingNumber, trackingUrl, dispatchDate, etaDate, note].includes(null))
    return { error: 'All shipment fields must be text' };
  if (!SHIPMENT_STATUSES.includes(status))
    return { error: `status must be one of: ${SHIPMENT_STATUSES.join(', ')}` };
  if (courier && !Object.hasOwn(COURIERS, courier))
    return { error: `courier must be one of: ${Object.keys(COURIERS).join(', ')}` };
  if (courier === 'other' && courierName.length < 2)
    return { error: 'Enter the courier name for "Other"' };
  if (courierName.length > 100) return { error: 'Courier name is too long (max 100 characters)' };
  if (trackingNumber && !/^[A-Za-z0-9-]{4,40}$/.test(trackingNumber))
    return { error: 'Tracking number must be 4–40 letters, digits or dashes' };
  if (trackingUrl) {
    let url;
    try { url = new URL(trackingUrl); } catch { /* invalid */ }
    if (!url || !['http:', 'https:'].includes(url.protocol) || trackingUrl.length > 500)
      return { error: 'Tracking URL must be a valid http(s) link' };
  }
  if (dispatchDate && !isIsoDate(dispatchDate)) return { error: 'Dispatch date must be a valid date (YYYY-MM-DD)' };
  if (etaDate && !isIsoDate(etaDate))           return { error: 'Estimated delivery date must be a valid date (YYYY-MM-DD)' };
  if (dispatchDate && etaDate && etaDate < dispatchDate)
    return { error: 'Estimated delivery date cannot be before the dispatch date' };
  if (note.length > 500) return { error: 'Note is too long (max 500 characters)' };

  if (SHIPPED_STATUSES.includes(status)) {
    if (!courier)        return { error: 'Select a courier before marking the order as dispatched' };
    if (!trackingNumber) return { error: 'Enter the tracking / AWB number before marking the order as dispatched' };
    if (!dispatchDate)   return { error: 'Enter the dispatch date before marking the order as dispatched' };
  }

  return { value: {
    status,
    courier:               courier || null,
    courierName:           courier ? (courier === 'other' ? courierName : COURIERS[courier]) : null,
    trackingNumber:        trackingNumber ? trackingNumber.toUpperCase() : null,
    trackingUrl:           trackingUrl || null,
    dispatchDate:          dispatchDate || null,
    estimatedDeliveryDate: etaDate || null,
    note:                  note || null,
  } };
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
         o.created_at     AS "createdAt",
         ${TRACKING_STATUS_SQL} AS "trackingStatus"
       FROM orders o
       LEFT JOIN order_shipments s ON s.order_id = o.id
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

// One order with full details — only the owner can see it
app.get('/api/auth/my-orders/:id', authenticate, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1)
    return res.status(400).json({ error: 'Invalid order id' });

  try {
    const { rows } = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.order_status   AS "orderStatus",
         o.payment_status AS "paymentStatus",
         o.subtotal::float,
         o.shipping::float,
         o.tax::float,
         o.total::float,
         o.payment_method AS "paymentMethod",
         o.transaction_id AS "transactionId",
         o.rejection_note AS "rejectionNote",
         o.verified_at    AS "verifiedAt",
         o.created_at     AS "createdAt",
         o.first_name     AS "firstName",
         o.last_name      AS "lastName",
         o.email,
         o.phone,
         o.address_line1  AS "addressLine1",
         o.address_line2  AS "addressLine2",
         o.city, o.state, o.zip, o.country,
         ${TRACKING_STATUS_SQL} AS "trackingStatus",
         ${SHIPMENT_SELECT}
       FROM orders o
       LEFT JOIN order_shipments s ON s.order_id = o.id
       WHERE o.id = $1 AND o.user_id = $2`,
      [orderId, req.userId],
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });

    const itemsResult = await pool.query(
      `SELECT
         oi.quantity,
         oi.unit_price::float AS "unitPrice",
         c.name,
         c.id          AS "cactusId",
         (SELECT url FROM media WHERE cactus_id=c.id AND type='Image'
          ORDER BY sort_order ASC NULLS LAST LIMIT 1) AS "thumbnailUrl",
         CASE WHEN r.id IS NULL THEN NULL ELSE json_build_object(
           'rating',    r.rating,
           'comment',   r.comment,
           'orderId',   r.order_id,
           'createdAt', r.created_at,
           'updatedAt', r.updated_at
         ) END AS "myReview"
       FROM order_items oi
       JOIN cactus c ON c.id = oi.cactus_id
       LEFT JOIN product_reviews r ON r.cactus_id = c.id AND r.user_id = $2
       WHERE oi.order_id = $1`,
      [orderId, req.userId],
    );

    res.json({
      ...withShipment(rows[0]),
      items:       itemsResult.rows,
      history:     await getStatusHistory(orderId),
      orderNumber: `CM-${String(orderId).padStart(6, '0')}`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ════════════════════════════════════════════════════════════
//  PRODUCT REVIEWS  (protected)
// ════════════════════════════════════════════════════════════
// Rate a cactus from one of your delivered orders. One review per customer per
// cactus — submitting again updates it. cactus.rating / rating_count are kept in
// sync in the same transaction, so product listings show the new average at once.
app.put('/api/auth/my-orders/:orderId/reviews/:cactusId', authenticate, async (req, res) => {
  const orderId  = Number(req.params.orderId);
  const cactusId = Number(req.params.cactusId);
  if (!Number.isInteger(orderId) || orderId < 1 || !Number.isInteger(cactusId) || cactusId < 1)
    return res.status(400).json({ error: 'Invalid order or cactus id' });

  const { rating, comment } = req.body ?? {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5' });
  if (comment != null && typeof comment !== 'string')
    return res.status(400).json({ error: 'Review must be text' });
  const text = comment?.trim() || null;
  if (text && text.length > 1000)
    return res.status(400).json({ error: 'Review is too long (max 1000 characters)' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const fail = (status, message) => Object.assign(new Error(message), { status });

    // Must be the caller's own order, containing this cactus, and delivered
    const { rows } = await client.query(
      `SELECT s.status AS "shipmentStatus",
              EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.cactus_id = $3) AS "hasItem"
       FROM orders o
       LEFT JOIN order_shipments s ON s.order_id = o.id
       WHERE o.id = $1 AND o.user_id = $2`,
      [orderId, req.userId, cactusId],
    );
    if (!rows.length)        throw fail(404, 'Order not found');
    if (!rows[0].hasItem)    throw fail(400, 'You can only rate cacti you purchased in this order');
    if (rows[0].shipmentStatus !== 'delivered')
      throw fail(409, 'You can rate this cactus once your order has been delivered');

    // Lock the cactus so concurrent reviews recalculate its average one at a time
    const locked = await client.query('SELECT id FROM cactus WHERE id = $1 FOR UPDATE', [cactusId]);
    if (!locked.rowCount) throw fail(404, 'This cactus is no longer available');

    const { rows: saved } = await client.query(
      `INSERT INTO product_reviews (cactus_id, order_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, cactus_id) DO UPDATE SET
         order_id   = EXCLUDED.order_id,
         rating     = EXCLUDED.rating,
         comment    = EXCLUDED.comment,
         updated_at = NOW()
       RETURNING rating, comment, order_id AS "orderId", created_at AS "createdAt", updated_at AS "updatedAt",
                 (xmax = 0) AS "created"`,
      [cactusId, orderId, req.userId, rating, text],
    );

    const { rows: stats } = await client.query(
      `UPDATE cactus SET
         rating       = (SELECT ROUND(AVG(rating), 1) FROM product_reviews WHERE cactus_id = $1),
         rating_count = (SELECT COUNT(*)              FROM product_reviews WHERE cactus_id = $1)
       WHERE id = $1
       RETURNING rating::float AS "rating", rating_count AS "ratingCount"`,
      [cactusId],
    );

    await client.query('COMMIT');
    const { created, ...review } = saved[0];
    console.log(`⭐ Review ${created ? 'added' : 'updated'}: cactus #${cactusId} ${rating}★ by ${req.userId}`);
    res.status(created ? 201 : 200).json({ review, product: stats[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    if (!err.status) console.error('PUT /api/auth/my-orders/:orderId/reviews/:cactusId:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  } finally {
    client.release();
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
             c.quantity,
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
              c.quantity,
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
    const quantity = str(fields.quantity) === '' ? 1 : parseStock(str(fields.quantity));
    const imageFiles = (Array.isArray(files.images) ? files.images : [files.images]).filter(f => f?.size > 0);

    if (!name || isNaN(categoryId) || isNaN(basePrice)) {
      await removeTempFiles(imageFiles);
      return res.status(400).json({ error: 'name, categoryId and basePrice are required' });
    }
    if (quantity === null) {
      await removeTempFiles(imageFiles);
      return res.status(400).json({ error: 'quantity must be a whole number ≥ 0' });
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
        `INSERT INTO cactus (name, description, category_id, base_price, quantity) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [name, description || null, categoryId, basePrice, quantity]);
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
    const forAuction = str(fields.forAuction) === 'true';
    const startPrice = parseFloat(str(fields.startPrice) || '0');
    const bidIncrement = parseFloat(str(fields.bidIncrement) || '2.5');
    const auctionHours = str(fields.auctionHours) ? parseFloat(str(fields.auctionHours)) : null;   // omitted = keep end time
    const videoUrl = str(fields.videoUrl)?.trim();
    const quantity = str(fields.quantity) === '' ? undefined : parseStock(str(fields.quantity));    // omitted = keep stock
    const imageFiles = (Array.isArray(files.images) ? files.images : [files.images]).filter(f => f?.size > 0);
    if (!name || isNaN(categoryId) || isNaN(basePrice)) {
      await removeTempFiles(imageFiles);
      return res.status(400).json({ error: 'name, categoryId and basePrice are required' });
    }
    if (quantity === null) {
      await removeTempFiles(imageFiles);
      return res.status(400).json({ error: 'quantity must be a whole number ≥ 0' });
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
        `UPDATE cactus SET name=$1, description=$2, category_id=$3, base_price=$4, quantity=COALESCE($6, quantity), updated_at=NOW() WHERE id=$5`,
        [name, description || null, categoryId, basePrice, id, quantity ?? null]);
      if (!result.rowCount) throw new Error(`Cactus ${id} not found`);
      for (let i = 0; i < imageUrls.length; i++) {
        const { rows } = await client.query(`SELECT COALESCE(MAX(sort_order),-1)+1 AS next FROM media WHERE cactus_id=$1`, [id]);
        await client.query(`INSERT INTO media (cactus_id, type, url, sort_order) VALUES ($1,'Image',$2,$3)`,
          [id, imageUrls[i], rows[0].next + i]);
      }

      // Video: replace whatever is stored with the submitted URL (empty = remove)
      await client.query(`DELETE FROM media WHERE cactus_id=$1 AND type='Video'`, [id]);
      if (videoUrl) await client.query(`INSERT INTO media (cactus_id, type, url, sort_order) VALUES ($1,'Video',$2,0)`, [id, videoUrl]);

      // Auction: same "live" definition as the list/detail endpoints
      const { rows: live } = await client.query(
        `SELECT a.id, (SELECT COUNT(*)::int FROM bid WHERE auction_id=a.id) AS bids
         FROM auction a WHERE a.cactus_id=$1 AND a.is_active=true AND a.ends_at>NOW() ORDER BY a.id DESC LIMIT 1`, [id]);
      const auc = live[0];
      if (forAuction && !auc) {
        const endsAt = new Date(Date.now() + (auctionHours ?? 48) * 3_600_000);
        await client.query(
          `INSERT INTO auction (cactus_id, start_price, current_price, bid_increment, ends_at, is_active) VALUES ($1,$2,$3,$4,$5,true)`,
          [id, startPrice || basePrice, startPrice || basePrice, bidIncrement, endsAt]);
      } else if (forAuction && auc) {
        await client.query(`UPDATE auction SET bid_increment=$1, updated_at=NOW() WHERE id=$2`, [bidIncrement, auc.id]);
        // Starting price can only change before anyone has bid
        if (!auc.bids) await client.query(`UPDATE auction SET start_price=$1, current_price=$1 WHERE id=$2`, [startPrice || basePrice, auc.id]);
        if (auctionHours) await client.query(`UPDATE auction SET ends_at=$1 WHERE id=$2`, [new Date(Date.now() + auctionHours * 3_600_000), auc.id]);
      } else if (!forAuction && auc) {
        await client.query(`UPDATE auction SET is_active=false, updated_at=NOW() WHERE id=$1`, [auc.id]);
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
    const [species, auctions, bids, bidders, revenue, weekly, weeklySales] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM cactus`),
      pool.query(`SELECT COUNT(*)::int AS count FROM auction WHERE is_active=true AND ends_at>NOW()`),
      pool.query(`SELECT COUNT(*)::int AS count, COALESCE(SUM(amount),0)::float AS total FROM bid WHERE placed_at>=NOW()-INTERVAL '24 hours'`),
      pool.query(`SELECT COUNT(DISTINCT user_id)::int AS count FROM bid`),
      pool.query(`SELECT COALESCE(SUM(current_price),0)::float AS total FROM auction WHERE is_active=false`),
      pool.query(`SELECT TO_CHAR(DATE_TRUNC('day',placed_at),'Dy') AS day, COALESCE(SUM(amount),0)::float AS revenue, COUNT(*)::int AS bid_count FROM bid WHERE placed_at>=NOW()-INTERVAL '7 days' GROUP BY DATE_TRUNC('day',placed_at) ORDER BY DATE_TRUNC('day',placed_at) ASC`),
      // Normal (cart) product sales: item value of payment-verified, non-cancelled orders.
      // Auction wins don't go through orders, so this excludes auction revenue.
      pool.query(`SELECT TO_CHAR(DATE_TRUNC('day',o.created_at),'Dy') AS day,
                         COALESCE(SUM(oi.quantity * oi.unit_price),0)::float AS revenue,
                         COUNT(DISTINCT o.id)::int AS order_count
                  FROM orders o JOIN order_items oi ON oi.order_id = o.id
                  WHERE o.payment_status = 'paid' AND o.order_status <> 'cancelled'
                    AND o.created_at >= DATE_TRUNC('day', NOW()) - INTERVAL '6 days'
                  GROUP BY DATE_TRUNC('day',o.created_at)`),
    ]);
    const weekMap = {};
    for (const row of weekly.rows) weekMap[row.day] = row;
    const weeklyChart = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => ({
      day: d, revenue: parseFloat(weekMap[d]?.revenue ?? 0), bidCount: parseInt(weekMap[d]?.bid_count ?? 0),
    }));
    const salesMap = {};
    for (const row of weeklySales.rows) salesMap[row.day] = row;
    const weeklySalesChart = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => ({
      day: d, revenue: parseFloat(salesMap[d]?.revenue ?? 0), orderCount: parseInt(salesMap[d]?.order_count ?? 0),
    }));
    res.json({ totalSpecies: species.rows[0].count, liveAuctions: auctions.rows[0].count,
      bidsToday: bids.rows[0].count, bidsTodayValue: bids.rows[0].total,
      uniqueBidders: bidders.rows[0].count, totalRevenue: revenue.rows[0].total, weeklyChart, weeklySalesChart });
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
      `SELECT id, current_price AS "currentPrice", bid_increment AS "bidIncrement", ends_at AS "endsAt"
       FROM auction WHERE cactus_id=$1 AND is_active=true FOR UPDATE`, [cactusId]);
    if (!aucResult.rows.length) throw new Error('No active auction');
    const auc = aucResult.rows[0];
    if (new Date(auc.endsAt) <= new Date()) throw new Error('Auction has ended');
    const current   = parseFloat(auc.currentPrice);
    const increment = parseFloat(auc.bidIncrement) || 0;
    // Same minimum the bid picker offers: current price + one increment
    const minBid    = Math.round((current + increment) * 100) / 100;
    if (increment > 0 ? bidAmount < minBid - 0.001 : bidAmount <= current)
      throw new Error(increment > 0 ? `Bid must be at least ₹${minBid.toFixed(2)}` : `Bid must exceed ₹${current.toFixed(2)}`);

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
//  BID HISTORY  (protected — bidder names are only shown to logged-in users)
// ════════════════════════════════════════════════════════════
app.get('/api/auction/history/:cactusId', authenticate, async (req, res) => {
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
              c.base_price::float AS "price", cat.name AS "categoryName", c.quantity AS "stock",
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
  if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: 'quantity must be a whole number ≥ 1' });
  try {
    const { rows: stockRows } = await pool.query(
      `SELECT c.quantity AS stock, COALESCE(ci.quantity,0) AS "inCart"
       FROM cactus c LEFT JOIN cart_items ci ON ci.cactus_id=c.id AND ci.user_id=$2 WHERE c.id=$1`, [cactusId, req.userId]);
    if (!stockRows.length) return res.status(404).json({ error: 'Cactus not found' });
    const stockError = checkStock(stockRows[0].stock, stockRows[0].inCart + quantity, stockRows[0].inCart);
    if (stockError) return res.status(409).json({ error: stockError });

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
  if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: 'quantity must be a whole number ≥ 1' });
  try {
    const { rows: stockRows } = await pool.query(`SELECT quantity AS stock FROM cactus WHERE id=$1`, [cactusId]);
    if (!stockRows.length) return res.status(404).json({ error: 'Cactus not found' });
    const stockError = checkStock(stockRows[0].stock, quantity);
    if (stockError) return res.status(409).json({ error: stockError });

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
    total: clientTotal,   // what the customer saw (and, for Google Pay, paid) — checked below
    transactionId,   // ← new: UTR/ref from Google Pay
    upiId,           // ← new: UPI ID used (for record)
  } = req.body ?? {};

  console.log(`📦 POST /api/orders — user:${req.userId} method:${paymentMethod} txn:${transactionId ?? 'N/A'}`);

  if (!userId || !items?.length || !address || !paymentMethod)
    return res.status(400).json({ error: 'userId, items, address and paymentMethod are required' });

  if (req.userId !== userId)
    return res.status(403).json({ error: 'User ID mismatch' });

  if (!items.every(i => Number.isInteger(i?.quantity) && i.quantity >= 1))
    return res.status(400).json({ error: 'Each item quantity must be a whole number ≥ 1' });

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
        0, 0, 0, 0,   // filled in below once item prices are known
        paymentMethod, transactionId?.trim() ?? null, upiId?.trim() ?? null,
        address.firstName, address.lastName, address.email, address.phone ?? null,
        address.line1, address.line2 ?? null, address.city,
        address.state, address.zip, address.country ?? 'US',
      ],
    );

    const orderId = rows[0].id;
    let subtotal = 0;

    for (const item of items) {
      // Take the stock atomically — the row lock queues concurrent orders,
      // and the WHERE clause refuses to take stock below zero.
      const reserved = await client.query(
        `UPDATE cactus SET quantity = quantity - $1, updated_at = NOW()
         WHERE id = $2::int AND quantity >= $1 RETURNING quantity, base_price::float AS price`,
        [item.quantity, item.cactusId],
      );
      if (!reserved.rowCount) {
        const { rows: cur } = await client.query(`SELECT name, quantity FROM cactus WHERE id=$1::int`, [item.cactusId]);
        const err = new Error(cur.length
          ? `${cur[0].name}: ${checkStock(cur[0].quantity, item.quantity)}`
          : `Cactus ${item.cactusId} no longer exists`);
        err.status = cur.length ? 409 : 400;
        throw err;
      }

      const unitPrice = Number(reserved.rows[0].price);
      subtotal += unitPrice * item.quantity;
      await client.query(
        `INSERT INTO order_items (order_id, cactus_id, quantity, unit_price)
         VALUES ($1, $2::int, $3::int, $4::numeric)`,
        [orderId, item.cactusId, item.quantity, unitPrice],
      );
    }

    subtotal       = roundMoney(subtotal);
    const shipping = subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const tax      = roundMoney(subtotal * TAX_RATE);
    const total    = roundMoney(subtotal + shipping + tax);

    // A price changed since the cart was loaded — don't charge (or verify a UPI payment for) a different amount
    if (clientTotal != null && Math.abs(Number(clientTotal) - total) > 0.01) {
      const err = new Error(`Prices have changed — the order total is now ₹${total.toFixed(2)}. Please review your cart.`);
      err.status = 409;
      throw err;
    }

    await client.query(
      `UPDATE orders SET subtotal=$1::numeric, shipping=$2::numeric, tax=$3::numeric, total=$4::numeric WHERE id=$5`,
      [subtotal, shipping, tax, total, orderId],
    );

    await client.query('COMMIT');
    const orderNumber = `CM-${String(orderId).padStart(6, '0')}`;
    console.log(`✅ Order ${orderNumber} — payment_status:${paymentStatus} order_status:${orderStatus}`);
    recordStatusHistory(orderId, isGPay ? 'payment_pending' : 'payment_verified',
      isGPay ? 'Order placed — awaiting payment verification' : 'Order placed and paid');

    res.status(201).json({
      id: orderId, orderNumber, status: orderStatus,
      paymentStatus, orderStatus, total,
      requiresVerification: isGPay,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ POST /api/orders:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  } finally {
    client.release();
  }
});
// ════════════════════════════════════════════════════════════
//  GET /api/admin/pending-payments   (admin only)
//  Lists all Google Pay orders awaiting manual verification
// ════════════════════════════════════════════════════════════
app.get('/api/admin/pending-payments', authenticate, requireAdmin, async (req, res) => {
  try {
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
app.post('/api/admin/verify-payment', authenticate, requireAdmin, async (req, res) => {
  const { orderId, action, note } = req.body ?? {};

  if (!orderId || !action)
    return res.status(400).json({ error: 'orderId and action are required' });
  if (!['approved', 'rejected'].includes(action))
    return res.status(400).json({ error: 'action must be "approved" or "rejected"' });

  console.log(`🔍 Payment verification: order #${orderId} action:${action} by admin:${req.userId}`);

  try {
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

      // Update order statuses — re-checked here so the same order can't be processed twice
      const updated = await client.query(
        `UPDATE orders
         SET payment_status = $1,
             order_status   = $2,
             status         = $2,
             verified_at    = NOW(),
             verified_by    = $3,
             rejection_note = $4,
             updated_at     = NOW()
         WHERE id = $5 AND payment_status = 'pending_verification'`,
        [paymentStatus, orderStatus, req.userId, note ?? null, orderId],
      );
      if (!updated.rowCount) {
        const err = new Error('Order was already processed');
        err.status = 409;
        throw err;
      }

      // Rejected payment → put the stock taken by this order back on sale
      if (action === 'rejected') {
        await client.query(
          `UPDATE cactus c SET quantity = c.quantity + oi.qty, updated_at = NOW()
           FROM (SELECT cactus_id, SUM(quantity)::int AS qty FROM order_items WHERE order_id=$1 GROUP BY cactus_id) oi
           WHERE c.id = oi.cactus_id`,
          [orderId],
        );
      }

      // Write audit log
      await client.query(
        `INSERT INTO payment_audit_log (order_id, admin_id, action, note)
         VALUES ($1, $2, $3, $4)`,
        [orderId, req.userId, action, note ?? null],
      );

      await client.query('COMMIT');
      console.log(`✅ Order #${orderId} → payment:${paymentStatus} order:${orderStatus}`);
      recordStatusHistory(orderId, action === 'approved' ? 'payment_verified' : 'payment_failed',
        action === 'approved' ? 'Payment verified' : `Payment rejected${note ? ` — ${note}` : ''}`, req.userId);

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
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════
//  GET /api/admin/payment-audit/:orderId   (admin only)
//  Returns audit log for a specific order
// ════════════════════════════════════════════════════════════
app.get('/api/admin/payment-audit/:orderId', authenticate, requireAdmin, async (req, res) => {
  const orderId = parseInt(req.params.orderId);
  try {
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
//  SHIPMENTS & TRACKING   (admin only)
// ════════════════════════════════════════════════════════════
// All orders with their payment, tracking and shipment details (newest first)
app.get('/api/admin/orders', authenticate, requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         o.id,
         o.total::float,
         o.payment_method AS "paymentMethod",
         o.payment_status AS "paymentStatus",
         o.created_at     AS "createdAt",
         o.first_name     AS "firstName",
         o.last_name      AS "lastName",
         o.email,
         o.phone,
         o.address_line1  AS "addressLine1",
         o.address_line2  AS "addressLine2",
         o.city, o.state, o.zip, o.country,
         ${TRACKING_STATUS_SQL} AS "trackingStatus",
         ${SHIPMENT_SELECT},
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
       LEFT JOIN order_shipments s ON s.order_id = o.id
       ORDER BY o.created_at DESC
       LIMIT 500`,
    );
    res.json(rows.map(withShipment));
  } catch (err) {
    console.error('GET /api/admin/orders:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Full status history for one order, with the admin who made each change
app.get('/api/admin/orders/:id/history', authenticate, requireAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1)
    return res.status(400).json({ error: 'Invalid order id' });
  try {
    const { rows } = await pool.query(
      `SELECT h.id, h.status, h.note, h.created_at AS "createdAt", u.username AS "changedBy"
       FROM order_status_history h
       LEFT JOIN users u ON u.id = h.changed_by
       WHERE h.order_id = $1
       ORDER BY h.created_at ASC, h.id ASC`,
      [orderId],
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add or update courier details and shipment status — only for payment-verified orders
app.put('/api/admin/orders/:id/shipment', authenticate, requireAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId < 1)
    return res.status(400).json({ error: 'Invalid order id' });

  const { error, value: v } = parseShipmentInput(req.body);
  if (error) return res.status(400).json({ error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the order so concurrent updates (e.g. a cancel and an edit) apply one at a time
    const { rows } = await client.query(
      `SELECT o.payment_status AS "paymentStatus",
              to_char(o.created_at, 'YYYY-MM-DD') AS "orderDate",
              s.status, s.courier, s.courier_name AS "courierName",
              s.tracking_number AS "trackingNumber", s.tracking_url AS "trackingUrl",
              to_char(s.dispatch_date, 'YYYY-MM-DD')           AS "dispatchDate",
              to_char(s.estimated_delivery_date, 'YYYY-MM-DD') AS "estimatedDeliveryDate"
       FROM orders o
       LEFT JOIN order_shipments s ON s.order_id = o.id
       WHERE o.id = $1
       FOR UPDATE OF o`,
      [orderId],
    );
    const fail = (status, message) => Object.assign(new Error(message), { status });
    if (!rows.length) throw fail(404, 'Order not found');
    const cur = rows[0];

    if (cur.paymentStatus !== 'paid')
      throw fail(409, 'Shipment details can only be added after the payment is verified');
    if (cur.status === 'cancelled')
      throw fail(409, 'This order is cancelled and can no longer be updated');
    if (cur.status === 'delivered' && v.status === 'cancelled')
      throw fail(409, 'A delivered order cannot be cancelled');
    if (v.dispatchDate && v.dispatchDate < cur.orderDate)
      throw fail(400, 'Dispatch date cannot be before the order date');

    const FIELDS = ['status', 'courier', 'courierName', 'trackingNumber', 'trackingUrl', 'dispatchDate', 'estimatedDeliveryDate'];
    const statusChanged  = cur.status !== v.status;
    const detailsChanged = FIELDS.some(f => (cur[f] ?? null) !== v[f]);
    if (!detailsChanged && !v.note) {
      await client.query('ROLLBACK');
      return res.json({ message: 'No changes', orderId, status: v.status });
    }

    await client.query(
      `INSERT INTO order_shipments (
         order_id, status, courier, courier_name, tracking_number, tracking_url,
         dispatch_date, estimated_delivery_date, updated_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::date, $8::date, $9)
       ON CONFLICT (order_id) DO UPDATE SET
         status                  = EXCLUDED.status,
         courier                 = EXCLUDED.courier,
         courier_name            = EXCLUDED.courier_name,
         tracking_number         = EXCLUDED.tracking_number,
         tracking_url            = EXCLUDED.tracking_url,
         dispatch_date           = EXCLUDED.dispatch_date,
         estimated_delivery_date = EXCLUDED.estimated_delivery_date,
         updated_by              = EXCLUDED.updated_by,
         updated_at              = NOW()`,
      [orderId, v.status, v.courier, v.courierName, v.trackingNumber, v.trackingUrl,
       v.dispatchDate, v.estimatedDeliveryDate, req.userId],
    );

    // Cancelling a paid order → mirror it on the order and put its stock back on sale
    if (statusChanged && v.status === 'cancelled') {
      await client.query(
        `UPDATE orders SET order_status = 'cancelled', status = 'cancelled', updated_at = NOW() WHERE id = $1`,
        [orderId],
      );
      await client.query(
        `UPDATE cactus c SET quantity = c.quantity + oi.qty, updated_at = NOW()
         FROM (SELECT cactus_id, SUM(quantity)::int AS qty FROM order_items WHERE order_id=$1 GROUP BY cactus_id) oi
         WHERE c.id = oi.cactus_id`,
        [orderId],
      );
    }

    await client.query(
      `INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES ($1, $2, $3, $4)`,
      [orderId, v.status, v.note ?? (statusChanged ? null : 'Shipment details updated'), req.userId],
    );

    await client.query('COMMIT');
    console.log(`🚚 Order #${orderId} shipment → ${v.status}${v.trackingNumber ? ` (${v.courierName} ${v.trackingNumber})` : ''}`);
    res.json({ message: 'Shipment updated', orderId, status: v.status });
  } catch (err) {
    await client.query('ROLLBACK');
    if (!err.status) console.error('PUT /api/admin/orders/:id/shipment:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  } finally {
    client.release();
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
  // Available stock per cactus — existing listings start with 1 plant each
  await pool.query(`ALTER TABLE cactus ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 0)`);

  // Shipment & tracking — one shipment per order, plus a timestamped status history
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_shipments (
      order_id                INTEGER     PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
      status                  VARCHAR(20) NOT NULL DEFAULT 'processing'
                              CHECK (status IN ('processing','dispatched','in_transit','delivered','cancelled')),
      courier                 VARCHAR(20),
      courier_name            VARCHAR(100),
      tracking_number         VARCHAR(40),
      tracking_url            TEXT,
      dispatch_date           DATE,
      estimated_delivery_date DATE,
      updated_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS order_status_history (
      id          SERIAL      PRIMARY KEY,
      order_id    INTEGER     NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      status      VARCHAR(30) NOT NULL,
      note        TEXT,
      changed_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS order_status_history_order_idx ON order_status_history (order_id, created_at)`);

  // Product reviews — one per customer per cactus (re-submitting updates it)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_reviews (
      id          SERIAL      PRIMARY KEY,
      cactus_id   INTEGER     NOT NULL REFERENCES cactus(id) ON DELETE CASCADE,
      order_id    INTEGER     NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      user_id     UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
      rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
      comment     TEXT        CHECK (char_length(comment) <= 1000),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, cactus_id)
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS product_reviews_cactus_idx ON product_reviews (cactus_id)`);
  // Backfill history for orders placed before this table existed (no-op once every order has history)
  await pool.query(`
    INSERT INTO order_status_history (order_id, status, note, changed_by, created_at)
    SELECT o.id, h.status, h.note, h.changed_by, h.at
    FROM orders o
    CROSS JOIN LATERAL (VALUES
      (CASE WHEN o.payment_method = 'googlepay' THEN 'payment_pending' ELSE 'payment_verified' END,
       CASE WHEN o.payment_method = 'googlepay' THEN 'Order placed — awaiting payment verification' ELSE 'Order placed and paid' END,
       NULL::uuid, o.created_at),
      (CASE WHEN o.payment_method = 'googlepay' AND o.payment_status = 'paid' THEN 'payment_verified'
            WHEN o.payment_status = 'rejected' THEN 'payment_failed' END,
       CASE WHEN o.payment_status = 'rejected'
            THEN 'Payment rejected' || COALESCE(' — ' || o.rejection_note, '')
            ELSE 'Payment verified' END,
       o.verified_by, COALESCE(o.verified_at, o.created_at))
    ) AS h(status, note, changed_by, at)
    WHERE h.status IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM order_status_history x WHERE x.order_id = o.id)`);
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
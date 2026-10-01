// api/cactus.js  →  GET /api/cactus  |  POST /api/cactus
import express from 'express';
import { Pool } from 'pg';
import cors from 'cors';
import formidable                         from 'formidable';
import path                               from 'path';
import { getPool }                        from './_db.js';
import { handleCors, ok, fail, intParam } from './_helpers.js';
import { uploadImageFiles, deleteBlobs, removeTempFiles } from '../api/_blob.js';
import dotenv from 'dotenv';

// Load environment variables from .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
// Middleware
app.use(cors()); // Allows your React app (port 5173) to talk to this server
app.use(express.json());

app.all('/api/cactus', (req, res) => {
  return handler(req, res);
});
// LEGACY: serves images uploaded before the move to Vercel Blob. Remove after running the migration.
app.use('/images', express.static(path.join(process.cwd(), 'public/images')));

// Database Connection
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL + (process.env.POSTGRES_URL?.includes('localhost') ? "" : "?sslmode=require"),
});


export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method === 'GET')  return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return fail(res, 'Method not allowed', 405);
}

// ── GET /api/cactus ──────────────────────────────────────────
async function handleGet(req, res) {
  try {
    const pool       = getPool();
    const page       = intParam(req.query, 'page',  1);
    const limit      = Math.min(intParam(req.query, 'limit', 12), 50);
    const offset     = (page - 1) * limit;
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId, 10) : null;
    const search     = (req.query.search ?? '').trim();

    const whereParts = [];
    const params     = [];

    if (categoryId) {
      params.push(categoryId);
      whereParts.push(`c.category_id = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      whereParts.push(`(c.name ILIKE $${params.length} OR c.description ILIKE $${params.length})`);
    }

    const where       = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const countParams = [...params];

    params.push(limit);
    params.push(offset);

    const dataSql = `
      SELECT
        c.id,
        c.name,
        c.description,
        c.base_price::float                                   AS "basePrice",
        cat.name                                              AS "categoryName",
        cat.id                                                AS "categoryId",
        COALESCE(c.rating, 0)::float                         AS "rating",
        COALESCE(c.rating_count, 0)::int                     AS "ratingCount",
        (
          SELECT url FROM media
          WHERE cactus_id = c.id AND type = 'Image'
          ORDER BY sort_order ASC NULLS LAST
          LIMIT 1
        )                                                     AS "thumbnailUrl",
        -- ⚠️  Cast to boolean explicitly so JS gets true/false not "t"/"f"
        CASE
          WHEN EXISTS (
            SELECT 1 FROM auction a
            WHERE a.cactus_id = c.id
              AND a.is_active = true
              AND a.ends_at > NOW()
          ) THEN true
          ELSE false
        END                                                   AS "hasAuction"
      FROM cactus c
      LEFT JOIN categories cat ON cat.id = c.category_id
      ${where}
      ORDER BY c.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const countSql = `SELECT COUNT(*)::int AS count FROM cactus c ${where}`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataSql,   params),
      pool.query(countSql,  countParams),
    ]);

    const totalCount = countResult.rows[0].count;

    return ok(res, {
      items:      dataResult.rows,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      page,
      pageSize:   limit,
    });
  } catch (err) {
    console.error('GET /api/cactus error:', err.message);
    return fail(res, 'Failed to load cacti', 500, err.message);
  }
}

// ── POST /api/cactus ─────────────────────────────────────────
async function handlePost(req, res) {
  // Files are parsed to the OS temp dir, then uploaded to Vercel Blob
  const form = formidable({
    multiples:      true,
    keepExtensions: true,
    maxFileSize:    10 * 1024 * 1024,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) return fail(res, 'File upload error', 400, err.message);

    const str         = (f) => (Array.isArray(f) ? f[0] : f) ?? '';
    const name        = str(fields.name);
    const description = str(fields.description);
    const categoryId  = parseInt(str(fields.categoryId), 10);
    const basePrice   = parseFloat(str(fields.basePrice));
    const videoUrl    = str(fields.videoUrl);
    const imageFiles  = (Array.isArray(files.images) ? files.images : [files.images])
      .filter((f) => f && f.size > 0);

    if (!name || !categoryId || isNaN(basePrice)) {
      await removeTempFiles(imageFiles);
      return fail(res, 'name, categoryId, and basePrice are required', 400);
    }

    let imageUrls;
    try {
      imageUrls = await uploadImageFiles(imageFiles);
    } catch (uploadErr) {
      console.error('POST /api/cactus image upload error:', uploadErr.message);
      return fail(res, 'Image upload failed', 500, uploadErr.message);
    }

    const pool   = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO cactus (name, description, category_id, base_price)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [name, description || null, categoryId, basePrice],
      );
      const cactusId = rows[0].id;

      for (let i = 0; i < imageUrls.length; i++) {
        await client.query(
          `INSERT INTO media (cactus_id, type, url, sort_order) VALUES ($1, 'Image', $2, $3)`,
          [cactusId, imageUrls[i], i],
        );
      }

      if (videoUrl) {
        await client.query(
          `INSERT INTO media (cactus_id, type, url, sort_order) VALUES ($1, 'Video', $2, 0)`,
          [cactusId, videoUrl],
        );
      }

      await client.query('COMMIT');
      console.log(`✅ Created cactus ID ${cactusId} — "${name}"`);
      return ok(res, { id: cactusId, success: true }, 201);
    } catch (dbErr) {
      await client.query('ROLLBACK');
      await deleteBlobs(imageUrls);
      console.error('POST /api/cactus DB error:', dbErr.message);
      return fail(res, 'Database error', 500, dbErr.message);
    } finally {
      client.release();
    }
    
  });
  
}
// --- The part you wanted to add ---
app.listen(PORT, () => {
  console.log(`🌵 Cactus Backend is blooming at http://localhost:${PORT}`);
  console.log('📂 Images are stored in Vercel Blob');
});

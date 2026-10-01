// api/cactus/[id].js
// GET    /api/cactus/:id  → full detail with media + auction
// PUT    /api/cactus/:id  → update (multipart)
// DELETE /api/cactus/:id  → delete

import formidable               from 'formidable';
import { uploadImageFiles, deleteBlobs, removeTempFiles } from '../../api/_blob.js';
import { getPool }              from '../_db.js';
import { handleCors, ok, fail } from '../_helpers.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  const { id } = req.query;
  const numId  = parseInt(id, 10);
  if (isNaN(numId)) return fail(res, 'Invalid cactus ID', 400);

  if (req.method === 'GET')    return handleGet(numId, res);
  if (req.method === 'PUT')    return handlePut(numId, req, res);
  if (req.method === 'DELETE') return handleDelete(numId, res);
  return fail(res, 'Method not allowed', 405);
}

// ── GET /api/cactus/:id ──────────────────────────────────────
async function handleGet(id, res) {
  try {
    const pool = getPool();

    // ── 1. Cactus row ─────────────────────────────────────
    const cactusResult = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.description,
         c.base_price::float                  AS "basePrice",
         c.category_id                        AS "categoryId",
         c.created_at                         AS "createdAt",
         COALESCE(c.rating, 0)::float         AS "rating",
         COALESCE(c.rating_count, 0)::int     AS "ratingCount",
         cat.name                             AS "categoryName"
       FROM cactus c
       LEFT JOIN categories cat ON cat.id = c.category_id
       WHERE c.id = $1`,
      [id],
    );

    if (cactusResult.rows.length === 0) {
      return fail(res, `Cactus ${id} not found`, 404);
    }

    // ── 2. Media ──────────────────────────────────────────
    const mediaResult = await pool.query(
      `SELECT
         id,
         type,
         url,
         COALESCE(sort_order, 0) AS "sortOrder"
       FROM media
       WHERE cactus_id = $1
       ORDER BY sort_order ASC NULLS LAST, id ASC`,
      [id],
    );

    // ── 3. Active auction ─────────────────────────────────
    // FIX: also check ends_at > NOW() so expired auctions return null
    const auctionResult = await pool.query(
      `SELECT
         a.id,
         a.cactus_id                              AS "cactusId",
         a.start_price::float                     AS "startPrice",
         a.current_price::float                   AS "currentPrice",
         a.bid_increment::float                   AS "bidIncrement",
         a.ends_at                                AS "endsAt",
         a.is_active                              AS "isActive",
         (SELECT COUNT(*)::int FROM bid WHERE auction_id = a.id) AS "totalBids"
       FROM auction a
       WHERE a.cactus_id = $1
         AND a.is_active = true
         AND a.ends_at > NOW()
       ORDER BY a.id DESC
       LIMIT 1`,
      [id],
    );

    return ok(res, {
      ...cactusResult.rows[0],
      media:   mediaResult.rows,
      auction: auctionResult.rows[0] ?? null,
    });
  } catch (err) {
    console.error(`GET /api/cactus/${id} error:`, err.message);
    return fail(res, 'Failed to load cactus', 500, err.message);
  }
}

// ── PUT /api/cactus/:id ──────────────────────────────────────
async function handlePut(id, req, res) {
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
      console.error(`PUT /api/cactus/${id} image upload error:`, uploadErr.message);
      return fail(res, 'Image upload failed', 500, uploadErr.message);
    }

    const pool   = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updateResult = await client.query(
        `UPDATE cactus
         SET name = $1, description = $2, category_id = $3,
             base_price = $4, updated_at = NOW()
         WHERE id = $5`,
        [name, description || null, categoryId, basePrice, id],
      );

      if (updateResult.rowCount === 0) {
        await client.query('ROLLBACK');
        await deleteBlobs(imageUrls);
        return fail(res, `Cactus ${id} not found`, 404);
      }

      for (let i = 0; i < imageUrls.length; i++) {
        const { rows }  = await client.query(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
           FROM media WHERE cactus_id = $1`,
          [id],
        );
        await client.query(
          `INSERT INTO media (cactus_id, type, url, sort_order)
           VALUES ($1, 'Image', $2, $3)`,
          [id, imageUrls[i], rows[0].next + i],
        );
      }

      await client.query('COMMIT');
      return ok(res, { message: 'Updated successfully' });
    } catch (dbErr) {
      await client.query('ROLLBACK');
      await deleteBlobs(imageUrls);
      console.error(`PUT /api/cactus/${id} error:`, dbErr.message);
      return fail(res, 'Database error', 500, dbErr.message);
    } finally {
      client.release();
    }
  });
}

// ── DELETE /api/cactus/:id ───────────────────────────────────
async function handleDelete(id, res) {
  const pool   = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `DELETE FROM bid WHERE auction_id IN
       (SELECT id FROM auction WHERE cactus_id = $1)`,
      [id],
    );
    await client.query('DELETE FROM auction WHERE cactus_id = $1', [id]);
    const { rows: mediaRows } = await client.query(
      `DELETE FROM media WHERE cactus_id = $1 AND type = 'Image' RETURNING url`,
      [id],
    );
    await client.query('DELETE FROM media   WHERE cactus_id = $1', [id]);
    const result = await client.query('DELETE FROM cactus WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return fail(res, `Cactus ${id} not found`, 404);
    }
    await client.query('COMMIT');
    await deleteBlobs(mediaRows.map((m) => m.url));   // only after the DB delete succeeded
    return ok(res, { message: 'Deleted successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`DELETE /api/cactus/${id} error:`, err.message);
    return fail(res, 'Delete failed', 500, err.message);
  } finally {
    client.release();
  }
}

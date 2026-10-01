// api/auction/history/[cactusId].js
// GET /api/auction/history/:cactusId → bid history, newest first

import { getPool }              from '../../_db.js';
import { handleCors, ok, fail } from '../../_helpers.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  const cactusId = parseInt(req.query.cactusId, 10);
  if (isNaN(cactusId)) return fail(res, 'Invalid cactus ID', 400);

  try {
    const pool   = getPool();
    const result = await pool.query(
      `SELECT
         b.id,
         COALESCE(u.username, b.user_id::text) AS username,
         b.amount::float                         AS amount,
         b.placed_at                             AS "placedAt"
       FROM bid b
       JOIN auction a ON a.id = b.auction_id
       LEFT JOIN users u ON u.id = b.user_id
       WHERE a.cactus_id = $1
       ORDER BY b.placed_at DESC
       LIMIT 50`,
      [cactusId],
    );

    return ok(res, result.rows);
  } catch (err) {
    console.error(`GET /api/auction/history/${cactusId} error:`, err.message);
    return fail(res, 'Failed to load bid history', 500, err.message);
  }
}

// api/auction/[cactusId].js
// GET /api/auction/:cactusId → active auction for that cactus

import { getPool }              from '../_db.js';
import { handleCors, ok, fail } from '../_helpers.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  const cactusId = parseInt(req.query.cactusId, 10);
  if (isNaN(cactusId)) return fail(res, 'Invalid cactus ID', 400);

  try {
    const pool   = getPool();
    const result = await pool.query(
      `SELECT
         a.id,
         a.cactus_id     AS "cactusId",
         a.start_price   AS "startPrice",
         a.current_price AS "currentPrice",
         a.bid_increment AS "bidIncrement",
         a.ends_at       AS "endsAt",
         a.is_active     AS "isActive",
         (SELECT COUNT(*) FROM bid WHERE auction_id = a.id)::int AS "totalBids"
       FROM auction a
       WHERE a.is_active = true
       LIMIT 1`,
      [cactusId],
    );

    if (result.rows.length === 0) {
      return fail(res, `No active auction for cactus ${cactusId}`, 404);
    }

    return ok(res, result.rows[0]);
  } catch (err) {
    console.error(`GET /api/auction/${cactusId} error:`, err.message);
    return fail(res, 'Failed to load auction', 500, err.message);
  }
}

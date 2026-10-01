// api/admin/stats.js
// GET /api/admin/stats
// Returns all numbers needed for the Admin dashboard widgets.

import { getPool }              from '../_db.js';
import { handleCors, ok, fail } from '../_helpers.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  try {
    const pool = getPool();

    const [
      speciesResult,
      auctionResult,
      bidsResult,
      biddersResult,
      revenueResult,
      weeklyResult,
    ] = await Promise.all([

      // 1. Total species
      pool.query(`SELECT COUNT(*)::int AS count FROM cactus`),

      // 2. Live auctions (active + not expired)
      pool.query(`
        SELECT COUNT(*)::int AS count FROM auction
        WHERE is_active = true AND ends_at > NOW()
      `),

      // 3. Bids placed today
      pool.query(`
        SELECT
          COUNT(*)::int              AS count,
          COALESCE(SUM(b.amount), 0)::float AS total
        FROM bid b
        WHERE b.placed_at >= NOW() - INTERVAL '24 hours'
      `),

      // 4. Unique bidders (all time)
      pool.query(`SELECT COUNT(DISTINCT user_id)::int AS count FROM bid`),

      // 5. Total auction revenue (sum of winning bids = current_price of ended auctions)
      pool.query(`
        SELECT COALESCE(SUM(current_price), 0)::float AS total
        FROM auction
        WHERE is_active = false
      `),

      // 6. Weekly revenue — last 7 days, grouped by day
      pool.query(`
        SELECT
          TO_CHAR(DATE_TRUNC('day', b.placed_at), 'Dy') AS day,
          DATE_TRUNC('day', b.placed_at)                AS day_date,
          COALESCE(SUM(b.amount), 0)::float             AS revenue,
          COUNT(*)::int                                  AS bid_count
        FROM bid b
        WHERE b.placed_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE_TRUNC('day', b.placed_at)
        ORDER BY day_date ASC
      `),
    ]);

    // Build 7-day chart filling in missing days with 0
    const weekMap: Record<string, { revenue: number; bidCount: number }> = {};
    for (const row of weeklyResult.rows) {
      weekMap[row.day] = { revenue: row.revenue, bidCount: row.bid_count };
    }

    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weeklyChart = DAYS.map((d) => ({
      day:      d,
      revenue:  weekMap[d]?.revenue  ?? 0,
      bidCount: weekMap[d]?.bidCount ?? 0,
    }));

    return ok(res, {
      totalSpecies:      speciesResult.rows[0].count,
      liveAuctions:      auctionResult.rows[0].count,
      bidsToday:         bidsResult.rows[0].count,
      bidsTodayValue:    bidsResult.rows[0].total,
      uniqueBidders:     biddersResult.rows[0].count,
      totalRevenue:      revenueResult.rows[0].total,
      weeklyChart,
    });
  } catch (err) {
    console.error('GET /api/admin/stats error:', err.message);
    return fail(res, 'Failed to load stats', 500, err.message);
  }
}
// api/auction/bid.js
// POST /api/auction/bid  →  place a bid on an active auction

import { getPool }              from '../_db.js';
import { handleCors, ok, fail } from '../_helpers.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') return fail(res, 'Method not allowed', 405);

  const { cactusId, userId, amount } = req.body ?? {};

  // ── Basic input validation ────────────────────────────────
  if (!cactusId || !userId || amount === undefined) {
    return fail(res, 'cactusId, userId, and amount are required', 400);
  }
  const bidAmount = parseFloat(amount);
  if (isNaN(bidAmount) || bidAmount <= 0) {
    return fail(res, 'amount must be a positive number', 400);
  }

  const pool   = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Lock the auction row for update so concurrent bids don't race
    const auctionResult = await client.query(
      `SELECT id, current_price AS "currentPrice", is_active AS "isActive", ends_at AS "endsAt"
       FROM auction
       WHERE cactus_id = $1
       FOR UPDATE`,
      [cactusId],
    );

    if (auctionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(res, 'No auction found for this cactus', 404);
    }

    const auction = auctionResult.rows[0];

    if (!auction.isActive || new Date(auction.endsAt) <= new Date()) {
      await client.query('ROLLBACK');
      return fail(res, 'This auction has ended', 400);
    }

    if (bidAmount <= auction.currentPrice) {
      await client.query('ROLLBACK');
      return fail(
        res,
        `Bid must exceed current price of ₹${parseFloat(auction.currentPrice).toFixed(2)}`,
        400,
      );
    }

    // Insert the bid
    const bidResult = await client.query(
      `INSERT INTO bid (auction_id, user_id, amount, placed_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id, amount, placed_at AS "placedAt"`,
      [auction.id, userId, bidAmount],
    );

    // Update current_price on the auction
    await client.query(
      'UPDATE auction SET current_price = $1, updated_at = NOW() WHERE id = $2',
      [bidAmount, auction.id],
    );

    await client.query('COMMIT');

    return ok(res, {
      id:       bidResult.rows[0].id,
      username: userId,  // replace with real username lookup if you have auth
      amount:   parseFloat(bidResult.rows[0].amount),
      placedAt: bidResult.rows[0].placedAt,
    }, 201);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/auction/bid error:', err.message);
    return fail(res, 'Failed to place bid', 500, err.message);
  } finally {
    client.release();
  }
}

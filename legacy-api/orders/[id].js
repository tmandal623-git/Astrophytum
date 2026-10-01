// api/orders/[id].js
// GET /api/orders/:id → single order with all items

import { getPool }              from '../_db.js';
import { handleCors, ok, fail } from '../_helpers.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') return fail(res, 'Method not allowed', 405);

  const orderId = parseInt(req.query.id, 10);
  if (isNaN(orderId)) return fail(res, 'Invalid order ID', 400);

  try {
    const pool = getPool();

    const orderResult = await pool.query(
      `SELECT
         o.id,
         o.user_id        AS "userId",
         o.status,
         o.subtotal::float,
         o.shipping::float,
         o.tax::float,
         o.total::float,
         o.payment_method AS "paymentMethod",
         o.promo_code     AS "promoCode",
         o.discount_amount::float AS "discountAmount",
         o.created_at     AS "createdAt",
         o.first_name     AS "firstName",
         o.last_name      AS "lastName",
         o.email,
         o.phone,
         o.address_line1  AS "addressLine1",
         o.address_line2  AS "addressLine2",
         o.city,
         o.state,
         o.zip,
         o.country
       FROM orders o
       WHERE o.id = $1`,
      [orderId],
    );

    if (orderResult.rows.length === 0) {
      return fail(res, `Order ${orderId} not found`, 404);
    }

    const order = orderResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT
         oi.cactus_id  AS "cactusId",
         oi.quantity,
         oi.unit_price::float AS "unitPrice",
         c.name,
         c.description,
         (SELECT url FROM media WHERE cactus_id = c.id AND type = 'Image' ORDER BY sort_order ASC LIMIT 1)
                       AS "thumbnailUrl"
       FROM order_items oi
       JOIN cactus c ON c.id = oi.cactus_id
       WHERE oi.order_id = $1
       ORDER BY oi.id ASC`,
      [orderId],
    );

    return ok(res, { ...order, items: itemsResult.rows });
  } catch (err) {
    console.error(`GET /api/orders/${orderId} error:`, err.message);
    return fail(res, 'Failed to load order', 500, err.message);
  }
}

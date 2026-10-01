// api/orders.js
// POST /api/orders  → create an order from cart items
// GET  /api/orders?userId=xxx → list orders for a user

import { getPool }              from './_db.js';
import { handleCors, ok, fail } from './_helpers.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method === 'GET')  return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return fail(res, 'Method not allowed', 405);
}

// ── GET /api/orders?userId=xxx ───────────────────────────────
async function handleGet(req, res) {
  const { userId } = req.query;
  if (!userId) return fail(res, 'userId query param is required', 400);

  try {
    const pool = getPool();

    const ordersResult = await pool.query(
      `SELECT
         o.id,
         o.user_id        AS "userId",
         o.status,
         o.subtotal::float,
         o.shipping::float,
         o.tax::float,
         o.total::float,
         o.payment_method AS "paymentMethod",
         o.created_at     AS "createdAt",
         o.address_line1  AS "addressLine1",
         o.address_line2  AS "addressLine2",
         o.city,
         o.state,
         o.zip,
         o.country,
         o.email
       FROM orders o
       WHERE o.user_id = $1
       ORDER BY o.created_at DESC`,
      [userId],
    );

    // Fetch items for all orders in one query
    if (ordersResult.rows.length === 0) return ok(res, []);

    const orderIds = ordersResult.rows.map((o) => o.id);
    const itemsResult = await pool.query(
      `SELECT
         oi.order_id   AS "orderId",
         oi.cactus_id  AS "cactusId",
         oi.quantity,
         oi.unit_price AS "unitPrice",
         c.name,
         (SELECT url FROM media WHERE cactus_id = c.id AND type = 'Image' ORDER BY sort_order ASC LIMIT 1) AS "thumbnailUrl"
       FROM order_items oi
       JOIN cactus c ON c.id = oi.cactus_id
       WHERE oi.order_id = ANY($1)`,
      [orderIds],
    );

    // Group items by orderId
    const itemsByOrder = {};
    for (const item of itemsResult.rows) {
      if (!itemsByOrder[item.orderId]) itemsByOrder[item.orderId] = [];
      itemsByOrder[item.orderId].push(item);
    }

    const orders = ordersResult.rows.map((o) => ({
      ...o,
      items: itemsByOrder[o.id] ?? [],
    }));

    return ok(res, orders);
  } catch (err) {
    console.error('GET /api/orders error:', err.message);
    return fail(res, 'Failed to load orders', 500, err.message);
  }
}

// ── POST /api/orders ─────────────────────────────────────────
async function handlePost(req, res) {
  const {
    userId,
    items,          // [{ cactusId, quantity, unitPrice }]
    address,        // { firstName, lastName, email, line1, line2, city, state, zip, country }
    paymentMethod,  // 'card' | 'paypal' | 'applepay' | 'googlepay'
    subtotal,
    shipping,
    tax,
    total,
    promoCode,
    discountAmount,
  } = req.body ?? {};

  // ── Validation ────────────────────────────────────────────
  if (!userId)          return fail(res, 'userId is required', 400);
  if (!items?.length)   return fail(res, 'items array is required', 400);
  if (!address)         return fail(res, 'address is required', 400);
  if (!paymentMethod)   return fail(res, 'paymentMethod is required', 400);
  if (total === undefined) return fail(res, 'total is required', 400);

  for (const item of items) {
    if (!item.cactusId || !item.quantity || item.unitPrice === undefined) {
      return fail(res, 'Each item needs cactusId, quantity, and unitPrice', 400);
    }
  }

  const pool   = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert order header
    const orderResult = await client.query(
      `INSERT INTO orders (
         user_id, status, subtotal, shipping, tax, total,
         payment_method, promo_code, discount_amount,
         address_line1, address_line2, city, state, zip, country,
         first_name, last_name, email, phone,
         created_at, updated_at
       ) VALUES (
         $1, 'confirmed', $2, $3, $4, $5,
         $6, $7, $8,
         $9, $10, $11, $12, $13, $14,
         $15, $16, $17, $18,
         NOW(), NOW()
       ) RETURNING id`,
      [
        userId,
        subtotal,
        shipping,
        tax,
        total,
        paymentMethod,
        promoCode    ?? null,
        discountAmount ?? 0,
        address.line1,
        address.line2  ?? null,
        address.city,
        address.state,
        address.zip,
        address.country,
        address.firstName,
        address.lastName,
        address.email,
        address.phone  ?? null,
      ],
    );

    const orderId = orderResult.rows[0].id;

    // Insert order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, cactus_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [orderId, item.cactusId, item.quantity, item.unitPrice],
      );
    }

    await client.query('COMMIT');

    // Generate a human-readable order number
    const orderNumber = `CM-${String(orderId).padStart(6, '0')}`;
    console.log(`✅ Order ${orderNumber} created for user ${userId}`);

    return ok(res, { id: orderId, orderNumber, status: 'confirmed' }, 201);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/orders error:', err.message);
    return fail(res, 'Failed to create order', 500, err.message);
  } finally {
    client.release();
  }
}

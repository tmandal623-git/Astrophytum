// Product reviews: only purchased cacti from your own delivered orders; one review per
// customer per cactus (re-submitting updates it); cactus average kept in sync.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';
const USER_ID    = '11111111-1111-1111-1111-111111111111';

// order id → { owner, shipment status, cactus ids in the order }
let orders;
let existingReview;   // whether the user already reviewed the cactus

const query = vi.fn(async (sql, params = []) => {
  if (sql.includes('password_changed_at') && sql.includes('FROM users')) return { rows: [{ changed: null }] };
  if (sql.includes('AS "hasItem"')) {
    const [orderId, userId, cactusId] = params;
    const o = orders[orderId];
    if (!o || o.owner !== userId) return { rows: [] };
    return { rows: [{ shipmentStatus: o.status, hasItem: o.items.includes(cactusId) }] };
  }
  if (sql.includes('SELECT id FROM cactus WHERE id = $1 FOR UPDATE'))
    return params[0] === 404 ? { rows: [], rowCount: 0 } : { rows: [{ id: params[0] }], rowCount: 1 };
  if (sql.includes('INSERT INTO product_reviews')) {
    const [, orderId, , rating, comment] = params;
    return { rows: [{ rating, comment, orderId, createdAt: 'now', updatedAt: 'now', created: !existingReview }] };
  }
  if (sql.includes('UPDATE cactus SET') && sql.includes('rating_count'))
    return { rows: [{ rating: 4.5, ratingCount: 2 }] };
  return { rows: [], rowCount: 0 };
});

vi.mock('pg', () => ({
  Pool: class { query = query; on() {} connect() { return { query, release() {} }; } },
}));
vi.mock('../api/_email.js', () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock('../api/_blob.js',  () => ({ uploadImageFiles: vi.fn(), deleteBlobs: vi.fn(), removeTempFiles: vi.fn() }));

let app;
let auth;
const sqlCalls = (needle) => query.mock.calls.filter(([sql]) => sql.includes(needle));
const review   = (orderId, cactusId, body, withAuth = true) => {
  const req = request(app).put(`/api/auth/my-orders/${orderId}/reviews/${cactusId}`);
  return (withAuth ? req.set('Authorization', auth) : req).send(body);
};

beforeAll(async () => {
  process.env.VERCEL       = '1';
  process.env.JWT_SECRET   = JWT_SECRET;
  process.env.POSTGRES_URL = 'postgres://localhost/test';
  ({ default: app } = await import('../api/server.js'));
  auth = `Bearer ${jwt.sign({ sub: USER_ID }, JWT_SECRET)}`;
});

beforeEach(() => {
  existingReview = false;
  orders = {
    1: { owner: USER_ID, status: 'delivered',  items: [7] },
    2: { owner: USER_ID, status: 'in_transit', items: [7] },
    3: { owner: USER_ID, status: null,         items: [7] },                 // paid, not shipped
    4: { owner: '99999999-9999-9999-9999-999999999999', status: 'delivered', items: [7] },
    5: { owner: USER_ID, status: 'delivered',  items: [404] },               // cactus since deleted
  };
});
afterEach(() => query.mockClear());

describe('PUT /api/auth/my-orders/:orderId/reviews/:cactusId', () => {
  it('creates a review and recalculates the cactus average', async () => {
    const res = await review(1, 7, { rating: 5, comment: '  Arrived healthy!  ' });
    expect(res.status).toBe(201);
    expect(sqlCalls('INSERT INTO product_reviews')[0][1]).toEqual([7, 1, USER_ID, 5, 'Arrived healthy!']);
    expect(sqlCalls('UPDATE cactus SET')).toHaveLength(1);
    expect(res.body.product).toEqual({ rating: 4.5, ratingCount: 2 });
    expect(res.body.review).not.toHaveProperty('created');
    expect(sqlCalls('COMMIT')).toHaveLength(1);
  });

  it('updates an existing review instead of adding a duplicate', async () => {
    existingReview = true;
    const res = await review(1, 7, { rating: 3 });
    expect(res.status).toBe(200);
    expect(sqlCalls('ON CONFLICT (user_id, cactus_id) DO UPDATE')).toHaveLength(1);
  });

  it('stores an empty comment as null', async () => {
    await review(1, 7, { rating: 4, comment: '   ' });
    expect(sqlCalls('INSERT INTO product_reviews')[0][1][4]).toBeNull();
  });

  it.each([['in transit', 2], ['not yet shipped', 3]])('refuses an order that is %s', async (_, orderId) => {
    const res = await review(orderId, 7, { rating: 5 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/once your order has been delivered/);
    expect(sqlCalls('INSERT INTO product_reviews')).toHaveLength(0);
    expect(sqlCalls('ROLLBACK')).toHaveLength(1);
  });

  it("refuses someone else's order", async () => {
    expect((await review(4, 7, { rating: 5 })).status).toBe(404);
    expect(sqlCalls('INSERT INTO product_reviews')).toHaveLength(0);
  });

  it('refuses a cactus that was not in the order', async () => {
    const res = await review(1, 8, { rating: 5 });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/only rate cacti you purchased/);
  });

  it('handles a cactus that no longer exists', async () => {
    expect((await review(5, 404, { rating: 5 })).status).toBe(404);
  });

  it.each([0, 6, 4.5, '5', null, undefined])('rejects rating %s before touching the database', async (rating) => {
    const res = await review(1, 7, { rating });
    expect(res.status).toBe(400);
    expect(sqlCalls('BEGIN')).toHaveLength(0);
  });

  it('rejects an overly long review', async () => {
    const res = await review(1, 7, { rating: 5, comment: 'x'.repeat(1001) });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/too long/);
  });

  it('rejects a non-text review', async () => {
    expect((await review(1, 7, { rating: 5, comment: { a: 1 } })).status).toBe(400);
  });

  it('rejects invalid ids', async () => {
    expect((await review('abc', 7, { rating: 5 })).status).toBe(400);
  });

  it('requires login', async () => {
    expect((await review(1, 7, { rating: 5 }, false)).status).toBe(401);
  });
});

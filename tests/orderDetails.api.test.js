// Order details: a user can load one of their own orders in full, and nobody else's.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';
const OWNER_ID   = '11111111-1111-1111-1111-111111111111';
const OTHER_ID   = '22222222-2222-2222-2222-222222222222';

const ORDER = {
  id: 42, status: 'confirmed', orderStatus: 'confirmed', paymentStatus: 'paid',
  subtotal: 900, shipping: 0, tax: 0, total: 900, paymentMethod: 'card',
  transactionId: null, rejectionNote: null, verifiedAt: null, createdAt: '2026-10-01T10:00:00.000Z',
  firstName: 'A', lastName: 'B', email: 'a@b.co', phone: null,
  addressLine1: '1 St', addressLine2: null, city: 'X', state: 'Y', zip: '1', country: 'India',
};
const ITEMS = [{ quantity: 2, unitPrice: 450, name: 'Star Cactus', cactusId: 7, thumbnailUrl: null }];

const query = vi.fn(async (sql, params = []) => {
  if (sql.includes('password_changed_at') && sql.includes('FROM users')) return { rows: [{ changed: null }] };
  if (sql.includes('WHERE o.id = $1 AND o.user_id = $2')) {
    const [id, userId] = params;
    return id === ORDER.id && userId === OWNER_ID ? { rows: [ORDER] } : { rows: [] };
  }
  if (sql.includes('WHERE oi.order_id = $1')) return { rows: ITEMS };
  return { rows: [], rowCount: 0 };
});

vi.mock('pg', () => ({
  Pool: class { query = query; on() {} connect() { return { query, release() {} }; } },
}));
vi.mock('../api/_email.js', () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock('../api/_blob.js',  () => ({ uploadImageFiles: vi.fn(), deleteBlobs: vi.fn(), removeTempFiles: vi.fn() }));

let app;
const bearer = (sub) => `Bearer ${jwt.sign({ sub }, JWT_SECRET)}`;

beforeAll(async () => {
  process.env.VERCEL       = '1';   // don't start a listening server
  process.env.JWT_SECRET   = JWT_SECRET;
  process.env.POSTGRES_URL = 'postgres://localhost/test';
  ({ default: app } = await import('../api/server.js'));
});

afterEach(() => query.mockClear());

describe('GET /api/auth/my-orders/:id', () => {
  it('returns the full order with items and order number to its owner', async () => {
    const res = await request(app).get('/api/auth/my-orders/42').set('Authorization', bearer(OWNER_ID));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ...ORDER, orderNumber: 'CM-000042', items: ITEMS });
  });

  it("returns 404 for another user's order", async () => {
    const res = await request(app).get('/api/auth/my-orders/42').set('Authorization', bearer(OTHER_ID));
    expect(res.status).toBe(404);
  });

  it('rejects a non-numeric id without querying', async () => {
    const res = await request(app).get('/api/auth/my-orders/abc').set('Authorization', bearer(OWNER_ID));
    expect(res.status).toBe(400);
    expect(query.mock.calls.some(([sql]) => sql.includes('FROM orders'))).toBe(false);
  });

  it('requires login', async () => {
    const res = await request(app).get('/api/auth/my-orders/42');
    expect(res.status).toBe(401);
  });
});

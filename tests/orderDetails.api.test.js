// Order details: a user can open their own order, never someone else's.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';
const USER_ID    = '11111111-1111-1111-1111-111111111111';

// Order 42 belongs to USER_ID; anything else is "not found" for this user
const query = vi.fn(async (sql, params = []) => {
  if (sql.includes('password_changed_at') && sql.includes('FROM users')) return { rows: [{ changed: null }] };
  if (sql.includes('FROM orders o') && sql.includes('o.id = $1 AND o.user_id = $2')) {
    const [id, userId] = params;
    return id === 42 && userId === USER_ID
      ? { rows: [{ id: 42, status: 'confirmed', orderStatus: 'confirmed', paymentStatus: 'paid', total: 250, subtotal: 200, shipping: 50, tax: 0,
          trackingStatus: 'dispatched', shipmentStatus: 'dispatched', courier: 'dtdc', courierName: 'DTDC', trackingNumber: 'D1234567',
          trackingUrl: null, dispatchDate: '2026-10-05', estimatedDeliveryDate: null, shipmentUpdatedAt: '2026-10-05T10:00:00Z' }] }
      : { rows: [] };
  }
  if (sql.includes('FROM order_status_history h')) {
    return { rows: [{ id: 1, status: 'payment_verified', note: 'Payment verified', createdAt: '2026-10-02T10:00:00Z' }] };
  }
  if (sql.includes('FROM order_items oi') && sql.includes('oi.order_id = $1')) {
    return { rows: [{ cactusId: 7, name: 'Star Cactus', quantity: 2, unitPrice: 100, thumbnailUrl: null }] };
  }
  return { rows: [], rowCount: 0 };
});

vi.mock('pg', () => ({
  Pool: class { query = query; on() {} connect() { return { query, release() {} }; } },
}));
vi.mock('../api/_email.js', () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock('../api/_blob.js',  () => ({ uploadImageFiles: vi.fn(), deleteBlobs: vi.fn(), removeTempFiles: vi.fn() }));

let app;
let auth;

beforeAll(async () => {
  process.env.VERCEL       = '1';
  process.env.JWT_SECRET   = JWT_SECRET;
  process.env.POSTGRES_URL = 'postgres://localhost/test';
  ({ default: app } = await import('../api/server.js'));
  auth = `Bearer ${jwt.sign({ sub: USER_ID }, JWT_SECRET)}`;
});

afterEach(() => query.mockClear());

describe('GET /api/auth/my-orders/:id', () => {
  it('returns the order with its items and order number', async () => {
    const res = await request(app).get('/api/auth/my-orders/42').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.orderNumber).toBe('CM-000042');
    expect(res.body.paymentStatus).toBe('paid');
    expect(res.body.items).toEqual([expect.objectContaining({ cactusId: 7, quantity: 2, unitPrice: 100 })]);
  });

  it('includes shipment details and status history', async () => {
    const res = await request(app).get('/api/auth/my-orders/42').set('Authorization', auth);
    expect(res.body.trackingStatus).toBe('dispatched');
    expect(res.body.shipment).toEqual(expect.objectContaining({ status: 'dispatched', courierName: 'DTDC', trackingNumber: 'D1234567', dispatchDate: '2026-10-05' }));
    expect(res.body).not.toHaveProperty('shipmentStatus');
    expect(res.body.history).toEqual([expect.objectContaining({ status: 'payment_verified' })]);
  });

  it("returns 404 for an order that isn't the user's", async () => {
    const res = await request(app).get('/api/auth/my-orders/43').set('Authorization', auth);
    expect(res.status).toBe(404);
  });

  it('rejects a non-numeric id without querying', async () => {
    const res = await request(app).get('/api/auth/my-orders/abc').set('Authorization', auth);
    expect(res.status).toBe(400);
    expect(query.mock.calls.some(([sql]) => sql.includes('FROM orders o'))).toBe(false);
  });

  it('requires login', async () => {
    const res = await request(app).get('/api/auth/my-orders/42');
    expect(res.status).toBe(401);
  });
});

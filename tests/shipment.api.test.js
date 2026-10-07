// Shipment & tracking: admin-only updates, only after payment verification, with status history.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';
const ADMIN_ID   = '22222222-2222-2222-2222-222222222222';
const USER_ID    = '11111111-1111-1111-1111-111111111111';

// order id → { paymentStatus, orderDate, shipment row (or null) }
let orders;

const query = vi.fn(async (sql, params = []) => {
  if (sql.includes('password_changed_at') && sql.includes('FROM users')) return { rows: [{ changed: null }] };
  if (sql.includes('SELECT role FROM users')) return { rows: [{ role: params[0] === ADMIN_ID ? 'admin' : 'customer' }] };

  // Shipment update: locked order + current shipment
  if (sql.includes('FOR UPDATE OF o')) {
    const o = orders[params[0]];
    if (!o) return { rows: [] };
    return { rows: [{
      paymentStatus: o.paymentStatus, orderDate: o.orderDate,
      status: null, courier: null, courierName: null, trackingNumber: null, trackingUrl: null,
      dispatchDate: null, estimatedDeliveryDate: null,
      ...o.shipment,
    }] };
  }
  if (sql.includes('INSERT INTO orders')) return { rows: [{ id: 42 }] };
  if (sql.includes('UPDATE cactus SET quantity = quantity -')) return { rows: [{ quantity: 1, price: 50 }], rowCount: 1 };
  return { rows: [], rowCount: 1 };
});

vi.mock('pg', () => ({
  Pool: class { query = query; on() {} connect() { return { query, release() {} }; } },
}));
vi.mock('../api/_email.js', () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock('../api/_blob.js',  () => ({ uploadImageFiles: vi.fn(), deleteBlobs: vi.fn(), removeTempFiles: vi.fn() }));

let app;
const adminAuth = () => `Bearer ${jwt.sign({ sub: ADMIN_ID }, JWT_SECRET)}`;
const userAuth  = () => `Bearer ${jwt.sign({ sub: USER_ID }, JWT_SECRET)}`;
const sqlCalls  = (needle) => query.mock.calls.filter(([sql]) => sql.includes(needle));

const DISPATCH = {
  status: 'dispatched', courier: 'dtdc', trackingNumber: 'd1234567',
  dispatchDate: '2026-10-05', estimatedDeliveryDate: '2026-10-09',
  trackingUrl: 'https://www.example.com/track?awb=D1234567',
};

beforeAll(async () => {
  process.env.VERCEL       = '1';
  process.env.JWT_SECRET   = JWT_SECRET;
  process.env.POSTGRES_URL = 'postgres://localhost/test';
  ({ default: app } = await import('../api/server.js'));
});

beforeEach(() => {
  orders = {
    1: { paymentStatus: 'paid',                 orderDate: '2026-10-01', shipment: null },
    2: { paymentStatus: 'pending_verification', orderDate: '2026-10-01', shipment: null },
    3: { paymentStatus: 'paid',                 orderDate: '2026-10-01', shipment: { status: 'cancelled' } },
    4: { paymentStatus: 'paid',                 orderDate: '2026-10-01', shipment: { status: 'delivered', courier: 'dtdc', courierName: 'DTDC', trackingNumber: 'D1234567', dispatchDate: '2026-10-05' } },
  };
});
afterEach(() => query.mockClear());

const put = (id, body, auth = adminAuth()) =>
  request(app).put(`/api/admin/orders/${id}/shipment`).set('Authorization', auth).send(body);

describe('PUT /api/admin/orders/:id/shipment', () => {
  it('dispatches a paid order and records history', async () => {
    const res = await put(1, DISPATCH);
    expect(res.status).toBe(200);
    const [upsert] = sqlCalls('INSERT INTO order_shipments');
    expect(upsert[1]).toEqual([1, 'dispatched', 'dtdc', 'DTDC', 'D1234567', DISPATCH.trackingUrl, '2026-10-05', '2026-10-09', ADMIN_ID]);
    expect(sqlCalls('INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES')[0][1]).toEqual([1, 'dispatched', null, ADMIN_ID]);
    expect(sqlCalls('COMMIT')).toHaveLength(1);
  });

  it('requires payment verification first', async () => {
    const res = await put(2, { status: 'processing' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/after the payment is verified/);
    expect(sqlCalls('INSERT INTO order_shipments')).toHaveLength(0);
    expect(sqlCalls('ROLLBACK')).toHaveLength(1);
  });

  it('is admin only', async () => {
    const res = await put(1, DISPATCH, userAuth());
    expect(res.status).toBe(403);
    expect(sqlCalls('BEGIN')).toHaveLength(0);
  });

  it('returns 404 for an unknown order', async () => {
    expect((await put(99, { status: 'processing' })).status).toBe(404);
  });

  it.each([
    [{ ...DISPATCH, trackingNumber: '' },              /tracking \/ AWB number/],
    [{ ...DISPATCH, courier: '' },                     /Select a courier/],
    [{ ...DISPATCH, dispatchDate: '' },                /dispatch date/],
    [{ ...DISPATCH, courier: 'fedex' },                /courier must be one of/],
    [{ ...DISPATCH, courier: 'other' },                /courier name/],
    [{ ...DISPATCH, trackingNumber: 'ab' },            /4–40/],
    [{ ...DISPATCH, trackingUrl: 'javascript:alert(1)' }, /valid http\(s\) link/],
    [{ ...DISPATCH, dispatchDate: '2026-02-30' },      /valid date/],
    [{ ...DISPATCH, estimatedDeliveryDate: '2026-10-01' }, /before the dispatch date/],
    [{ status: 'shipped' },                            /status must be one of/],
  ])('rejects invalid input %#', async (body, message) => {
    const res = await put(1, body);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(sqlCalls('BEGIN')).toHaveLength(0);
  });

  it('rejects a dispatch date before the order date', async () => {
    const res = await put(1, { ...DISPATCH, dispatchDate: '2026-09-30', estimatedDeliveryDate: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/before the order date/);
  });

  it('allows processing without courier details', async () => {
    const res = await put(1, { status: 'processing' });
    expect(res.status).toBe(200);
    expect(sqlCalls('INSERT INTO order_shipments')).toHaveLength(1);
  });

  it('stores the custom courier name for "other"', async () => {
    const res = await put(1, { ...DISPATCH, courier: 'other', courierName: 'Professional Couriers' });
    expect(res.status).toBe(200);
    expect(sqlCalls('INSERT INTO order_shipments')[0][1][3]).toBe('Professional Couriers');
  });

  it('refuses to update a cancelled order', async () => {
    const res = await put(3, { status: 'processing' });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/cancelled/);
  });

  it('refuses to cancel a delivered order', async () => {
    const res = await put(4, { status: 'cancelled' });
    expect(res.status).toBe(409);
  });

  it('cancelling restores stock and marks the order cancelled', async () => {
    const res = await put(1, { status: 'cancelled', note: 'Customer request' });
    expect(res.status).toBe(200);
    expect(sqlCalls("SET order_status = 'cancelled'")).toHaveLength(1);
    expect(sqlCalls('UPDATE cactus c SET quantity = c.quantity + oi.qty')).toHaveLength(1);
    expect(sqlCalls('INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES')[0][1]).toEqual([1, 'cancelled', 'Customer request', ADMIN_ID]);
  });

  it('does nothing when nothing changed', async () => {
    const res = await put(4, { status: 'delivered', courier: 'dtdc', trackingNumber: 'D1234567', dispatchDate: '2026-10-05' });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('No changes');
    expect(sqlCalls('INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES')).toHaveLength(0);
  });

  it('records a details-only change in history', async () => {
    const res = await put(4, { status: 'delivered', courier: 'dtdc', trackingNumber: 'D7654321', dispatchDate: '2026-10-05' });
    expect(res.status).toBe(200);
    expect(sqlCalls('INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES')[0][1]).toEqual([4, 'delivered', 'Shipment details updated', ADMIN_ID]);
  });
});

describe('admin order listing', () => {
  it('GET /api/admin/orders is admin only', async () => {
    expect((await request(app).get('/api/admin/orders').set('Authorization', userAuth())).status).toBe(403);
    expect((await request(app).get('/api/admin/orders').set('Authorization', adminAuth())).status).toBe(200);
  });

  it('GET /api/admin/orders/:id/history validates the id', async () => {
    expect((await request(app).get('/api/admin/orders/x/history').set('Authorization', adminAuth())).status).toBe(400);
  });
});

describe('existing flows record history', () => {
  it('a Google Pay order starts as payment_pending', async () => {
    const res = await request(app).post('/api/orders').set('Authorization', userAuth()).send({
      userId: USER_ID, paymentMethod: 'googlepay', transactionId: 'UTR123456',
      items: [{ cactusId: 7, quantity: 1, unitPrice: 100 }],
      address: { firstName: 'A', lastName: 'B', email: 'a@b.co', line1: '1 St', city: 'X', state: 'Y', zip: '1' },
    });
    expect(res.status).toBe(201);
    await vi.waitFor(() => expect(sqlCalls('INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES')).toHaveLength(1));
    expect(sqlCalls('INSERT INTO order_status_history (order_id, status, note, changed_by) VALUES')[0][1].slice(0, 2)).toEqual([42, 'payment_pending']);
  });
});

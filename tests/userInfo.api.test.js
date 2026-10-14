// User Info: admin-only user search and details, never exposing password hashes.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';
const ADMIN_ID   = '22222222-2222-2222-2222-222222222222';
const USER_ID    = '11111111-1111-1111-1111-111111111111';
const MISSING_ID = '33333333-3333-3333-3333-333333333333';

const USER_ROW = {
  id: USER_ID, username: 'priya', email: 'priya@example.com', role: 'user', avatar: null,
  createdAt: '2026-09-01T10:00:00.000Z', orderCount: 1,
};
const ORDER_ROW = {
  id: 7, total: 549, paymentMethod: 'googlepay', paymentStatus: 'paid', createdAt: '2026-10-02T10:00:00.000Z',
  firstName: 'Priya', lastName: 'Shah', email: 'priya@example.com', phone: '9876543210',
  addressLine1: '12 MG Road', addressLine2: null, city: 'Pune', state: 'MH', zip: '411001', country: 'India',
  trackingStatus: 'payment_verified',
};

let userCount = 1;   // total matching users the COUNT query reports

const query = vi.fn(async (sql, params = []) => {
  if (sql.includes('password_changed_at') && sql.includes('FROM users')) return { rows: [{ changed: null }] };
  if (sql.includes('SELECT role FROM users')) return { rows: [{ role: params[0] === ADMIN_ID ? 'admin' : 'user' }] };
  if (sql.includes('SELECT COUNT(*)::int AS count FROM users u')) return { rows: [{ count: userCount }] };
  if (sql.includes('u.username ILIKE')) return { rows: [USER_ROW] };
  if (sql.includes('AS "reviewCount"')) {
    return { rows: params[0] === USER_ID
      ? [{ ...USER_ROW, totalSpent: 549, lastOrderAt: ORDER_ROW.createdAt, bidCount: 2, reviewCount: 1 }]
      : [] };
  }
  if (sql.includes('LIMIT 5')) return { rows: [ORDER_ROW] };
  return { rows: [], rowCount: 0 };
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

beforeAll(async () => {
  process.env.VERCEL       = '1';
  process.env.JWT_SECRET   = JWT_SECRET;
  process.env.POSTGRES_URL = 'postgres://localhost/test';
  ({ default: app } = await import('../api/server.js'));
});
afterEach(() => { query.mockClear(); userCount = 1; });
const listCall = () => sqlCalls('LIMIT $3 OFFSET $4')[0];

describe('GET /api/admin/users', () => {
  it('searches by username or email', async () => {
    const res = await request(app).get('/api/admin/users?search=priya').set('Authorization', adminAuth());
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [USER_ROW], totalCount: 1, totalPages: 1, page: 1, pageSize: 8 });
    expect(listCall()[1]).toEqual(['priya', '%priya%', 8, 0]);
  });

  it('pages 8 users at a time, newest first', async () => {
    userCount = 19;
    const res = await request(app).get('/api/admin/users?page=3').set('Authorization', adminAuth());
    expect(res.body).toMatchObject({ totalCount: 19, totalPages: 3, page: 3, pageSize: 8 });
    expect(listCall()[1]).toEqual(['', '%%', 8, 16]);                   // page 3 → skip 16
    expect(listCall()[0]).toMatch(/ORDER BY u\.created_at DESC, u\.id/); // stable order across pages
  });

  it('counts with the same filter as the list', async () => {
    await request(app).get('/api/admin/users?search=priya').set('Authorization', adminAuth());
    expect(sqlCalls('SELECT COUNT(*)::int AS count FROM users u')[0][1]).toEqual(['priya', '%priya%']);
  });

  it.each([
    ['page=0',          1, 0],
    ['page=abc',        1, 0],
    ['pageSize=500',    1, 0, 50],
    ['pageSize=-3',     1, 0, 8],
  ])('clamps bad paging input (%s)', async (qs, page, offset, size = 8) => {
    const res = await request(app).get(`/api/admin/users?${qs}`).set('Authorization', adminAuth());
    expect(res.body.page).toBe(page);
    expect(listCall()[1].slice(2)).toEqual([size, offset]);
  });

  it('matches LIKE wildcards literally', async () => {
    await request(app).get('/api/admin/users?search=a%25_b').set('Authorization', adminAuth());
    expect(listCall()[1].slice(0, 2)).toEqual(['a%_b', '%a\\%\\_b%']);
  });

  it('never selects the password', async () => {
    await request(app).get('/api/admin/users').set('Authorization', adminAuth());
    expect(listCall()[0]).not.toMatch(/password/);
  });

  it('is admin only', async () => {
    expect((await request(app).get('/api/admin/users')).status).toBe(401);
    expect((await request(app).get('/api/admin/users').set('Authorization', userAuth())).status).toBe(403);
    expect(sqlCalls('u.username ILIKE')).toHaveLength(0);
  });
});

describe('GET /api/admin/users/:id', () => {
  it('returns profile, contact from the latest order, totals and recent orders', async () => {
    const res = await request(app).get(`/api/admin/users/${USER_ID}`).set('Authorization', adminAuth());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id: USER_ID, username: 'priya', role: 'user', orderCount: 1, totalSpent: 549, bidCount: 2, reviewCount: 1,
      contact: { firstName: 'Priya', phone: '9876543210', city: 'Pune' },
      recentOrders: [{ id: 7, total: 549, paymentStatus: 'paid', trackingStatus: 'payment_verified' }],
    });
    expect(res.body).not.toHaveProperty('password');
    expect(res.body.recentOrders[0]).not.toHaveProperty('phone');
    expect(sqlCalls('AS "reviewCount"')[0][0]).not.toMatch(/password/);
  });

  it('returns 404 for an unknown user and 400 for a malformed id', async () => {
    expect((await request(app).get(`/api/admin/users/${MISSING_ID}`).set('Authorization', adminAuth())).status).toBe(404);
    expect((await request(app).get('/api/admin/users/not-a-uuid').set('Authorization', adminAuth())).status).toBe(400);
  });

  it('is admin only', async () => {
    const res = await request(app).get(`/api/admin/users/${USER_ID}`).set('Authorization', userAuth());
    expect(res.status).toBe(403);
    expect(sqlCalls('AS "reviewCount"')).toHaveLength(0);
  });
});

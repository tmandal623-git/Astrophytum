// Stock rules: cart and orders can't exceed available quantity, and orders take stock atomically.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';
const USER_ID    = '11111111-1111-1111-1111-111111111111';

// In-memory stock and cart, so the fake Postgres can answer the inventory queries
let stock;
let cart;

const query = vi.fn(async (sql, params = []) => {
  if (sql.includes('password_changed_at') && sql.includes('FROM users')) return { rows: [{ changed: null }] };

  // Cart add: stock + what's already in this user's cart
  if (sql.includes('FROM cactus c LEFT JOIN cart_items ci')) {
    const id = Number(params[0]);
    return id in stock ? { rows: [{ stock: stock[id], inCart: cart[id] ?? 0 }] } : { rows: [] };
  }
  if (sql.includes('SELECT quantity AS stock FROM cactus')) {
    const id = Number(params[0]);
    return id in stock ? { rows: [{ stock: stock[id] }] } : { rows: [] };
  }
  if (sql.includes('INSERT INTO cart_items')) {
    cart[params[1]] = (cart[params[1]] ?? 0) + params[2];
    return { rows: [{ id: 1, quantity: cart[params[1]] }] };
  }
  if (sql.includes('UPDATE cart_items')) { cart[params[2]] = params[0]; return { rows: [], rowCount: 1 }; }

  // Order: atomic decrement
  if (sql.includes('UPDATE cactus SET quantity = quantity -')) {
    const [qty, id] = params;
    if (!(id in stock) || stock[id] < qty) return { rows: [], rowCount: 0 };
    stock[id] -= qty;
    return { rows: [{ quantity: stock[id] }], rowCount: 1 };
  }
  if (sql.includes('SELECT name, quantity FROM cactus')) {
    const id = Number(params[0]);
    return id in stock ? { rows: [{ name: 'Star Cactus', quantity: stock[id] }] } : { rows: [] };
  }
  if (sql.includes('INSERT INTO orders')) return { rows: [{ id: 42 }] };
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

beforeAll(async () => {
  process.env.VERCEL       = '1';   // don't start a listening server
  process.env.JWT_SECRET   = JWT_SECRET;
  process.env.POSTGRES_URL = 'postgres://localhost/test';
  ({ default: app } = await import('../api/server.js'));
  auth = `Bearer ${jwt.sign({ sub: USER_ID }, JWT_SECRET)}`;
});

beforeEach(() => { stock = { 7: 3, 8: 0 }; cart = {}; });
afterEach(() => query.mockClear());

const order = (items) => ({
  userId: USER_ID, paymentMethod: 'card', items,
  address: { firstName: 'A', lastName: 'B', email: 'a@b.co', line1: '1 St', city: 'X', state: 'Y', zip: '1' },
});

describe('POST /api/cart', () => {
  it('adds up to the available stock', async () => {
    const res = await request(app).post('/api/cart').set('Authorization', auth).send({ cactusId: 7, quantity: 3 });
    expect(res.status).toBe(201);
    expect(cart[7]).toBe(3);
  });

  it('refuses more than the available stock, counting what is already in the cart', async () => {
    cart[7] = 2;
    const res = await request(app).post('/api/cart').set('Authorization', auth).send({ cactusId: 7, quantity: 2 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/only 3 available/i);
    expect(sqlCalls('INSERT INTO cart_items')).toHaveLength(0);
  });

  it('refuses a sold-out cactus', async () => {
    const res = await request(app).post('/api/cart').set('Authorization', auth).send({ cactusId: 8, quantity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/sold out/i);
  });

  it.each([0, -1, 1.5, '2'])('rejects invalid quantity %s', async (quantity) => {
    const res = await request(app).post('/api/cart').set('Authorization', auth).send({ cactusId: 7, quantity });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/cart/:cactusId', () => {
  it('refuses a quantity above stock', async () => {
    const res = await request(app).put('/api/cart/7').set('Authorization', auth).send({ quantity: 4 });
    expect(res.status).toBe(409);
    expect(sqlCalls('UPDATE cart_items')).toHaveLength(0);
  });
});

describe('POST /api/orders', () => {
  it('decreases stock by the purchased quantity', async () => {
    const res = await request(app).post('/api/orders').set('Authorization', auth)
      .send(order([{ cactusId: 7, quantity: 2, unitPrice: 100 }]));
    expect(res.status).toBe(201);
    expect(stock[7]).toBe(1);
    expect(sqlCalls('COMMIT')).toHaveLength(1);
  });

  it('rolls back and returns 409 when stock is insufficient', async () => {
    const res = await request(app).post('/api/orders').set('Authorization', auth)
      .send(order([{ cactusId: 7, quantity: 4, unitPrice: 100 }]));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Star Cactus: Only 3 available/);
    expect(sqlCalls('ROLLBACK')).toHaveLength(1);
    expect(sqlCalls('INSERT INTO order_items')).toHaveLength(0);
  });

  it('rejects non-integer quantities before touching the database', async () => {
    const res = await request(app).post('/api/orders').set('Authorization', auth)
      .send(order([{ cactusId: 7, quantity: 0, unitPrice: 100 }]));
    expect(res.status).toBe(400);
    expect(sqlCalls('BEGIN')).toHaveLength(0);
  });
});

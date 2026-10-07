// A bid must be at least the current price plus one bid increment.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';
const USER_ID    = '11111111-1111-1111-1111-111111111111';
const ENDS_AT    = new Date(Date.now() + 3_600_000).toISOString();

let auction = { id: 5, currentPrice: '100.00', bidIncrement: '2.50', endsAt: ENDS_AT };

const query = vi.fn(async (sql, params = []) => {
  if (sql.includes('password_changed_at') && sql.includes('FROM users')) return { rows: [{ changed: null }] };
  if (sql.includes('FROM auction WHERE cactus_id=$1 AND is_active=true FOR UPDATE')) return { rows: [auction] };
  if (sql.includes('INSERT INTO bid')) return { rows: [{ id: 1, amount: params[2], placedAt: new Date().toISOString() }] };
  if (sql.includes('SELECT username FROM users')) return { rows: [{ username: 'alice' }] };
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
const bid = (amount) => request(app).post('/api/auction/bid').set('Authorization', auth).send({ cactusId: 7, amount });

beforeAll(async () => {
  process.env.VERCEL       = '1';   // don't start a listening server
  process.env.JWT_SECRET   = JWT_SECRET;
  process.env.POSTGRES_URL = 'postgres://localhost/test';
  ({ default: app } = await import('../api/server.js'));
  auth = `Bearer ${jwt.sign({ sub: USER_ID }, JWT_SECRET)}`;
});

afterEach(() => {
  query.mockClear();
  auction = { id: 5, currentPrice: '100.00', bidIncrement: '2.50', endsAt: ENDS_AT };
});

describe('POST /api/auction/bid', () => {
  it('refuses a bid below current price + increment', async () => {
    const res = await bid(101);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at least ₹102\.50/);
    expect(sqlCalls('INSERT INTO bid')).toHaveLength(0);
  });

  it('accepts a bid of exactly current price + increment', async () => {
    const res = await bid(102.5);
    expect(res.status).toBe(201);
    expect(sqlCalls('UPDATE auction SET current_price')[0][1]).toEqual([102.5, 5]);
  });

  it('with no increment, any bid above the current price is accepted', async () => {
    auction.bidIncrement = '0';
    expect((await bid(100)).status).toBe(400);
    expect((await bid(100.01)).status).toBe(201);
  });

  it('refuses bids on an ended auction', async () => {
    auction.endsAt = new Date(Date.now() - 1000).toISOString();
    const res = await bid(200);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/ended/);
  });
});

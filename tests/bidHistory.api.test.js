// Bid history endpoint must reject unauthenticated requests.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';
const USER_ID    = '11111111-1111-1111-1111-111111111111';
const BIDS       = [
  { id: 2, username: 'alice', amount: 120, placedAt: '2026-10-01T10:00:00.000Z' },
  { id: 1, username: 'bob',   amount: 100, placedAt: '2026-10-01T09:00:00.000Z' },
];

// Fake Postgres: answers the auth lookup and the bid-history query, nothing else
const query = vi.fn(async (sql) => {
  if (sql.includes('password_changed_at') && sql.includes('FROM users')) return { rows: [{ changed: null }] };
  if (sql.includes('FROM bid b JOIN auction a')) return { rows: BIDS };
  return { rows: [] };
});

vi.mock('pg', () => ({
  Pool: class { query = query; on() {} connect() { return { query, release() {} }; } },
}));
vi.mock('../api/_email.js', () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock('../api/_blob.js',  () => ({ uploadImageFiles: vi.fn(), deleteBlobs: vi.fn(), removeTempFiles: vi.fn() }));

let app;
const historyQueries = () => query.mock.calls.filter(([sql]) => sql.includes('FROM bid b JOIN auction a'));

beforeAll(async () => {
  process.env.VERCEL       = '1';   // don't start a listening server
  process.env.JWT_SECRET   = JWT_SECRET;
  process.env.POSTGRES_URL = 'postgres://localhost/test';
  ({ default: app } = await import('../api/server.js'));
});

afterEach(() => query.mockClear());

describe('GET /api/auction/history/:cactusId', () => {
  it('returns 401 without a token and never queries bids', async () => {
    const res = await request(app).get('/api/auction/history/7');
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/not authenticated/i);
    expect(historyQueries()).toHaveLength(0);
  });

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .get('/api/auction/history/7')
      .set('Cookie', 'auth_token=not-a-real-token');
    expect(res.status).toBe(401);
    expect(historyQueries()).toHaveLength(0);
  });

  it('returns 401 for a token signed with the wrong secret', async () => {
    const token = jwt.sign({ sub: USER_ID }, 'some-other-secret');
    const res = await request(app).get('/api/auction/history/7').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(historyQueries()).toHaveLength(0);
  });

  it('returns the history for a logged-in user (cookie)', async () => {
    const token = jwt.sign({ sub: USER_ID }, JWT_SECRET);
    const res = await request(app).get('/api/auction/history/7').set('Cookie', `auth_token=${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(BIDS);
    expect(historyQueries()[0][1]).toEqual([7]);
  });

  it('returns the history for a logged-in user (Bearer header)', async () => {
    const token = jwt.sign({ sub: USER_ID }, JWT_SECRET);
    const res = await request(app).get('/api/auction/history/7').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(BIDS);
  });
});

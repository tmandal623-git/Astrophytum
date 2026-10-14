// Scheduled auctions: admins set a start time; bidding is refused before it and after the end,
// the duration runs from the start, and existing (already started) auctions keep working.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';
const ADMIN_ID   = '22222222-2222-2222-2222-222222222222';
const USER_ID    = '11111111-1111-1111-1111-111111111111';
const HOUR       = 3_600_000;
const inHours    = (h) => new Date(Date.now() + h * HOUR);

// Auction row the bid lookup returns, and the "current" auction the update route sees
let bidAuction;
let currentAuction;

const query = vi.fn(async (sql, params = []) => {
  if (sql.includes('password_changed_at') && sql.includes('FROM users')) return { rows: [{ changed: null }] };
  if (sql.includes('SELECT role FROM users')) return { rows: [{ role: params[0] === ADMIN_ID ? 'admin' : 'user' }] };
  if (sql.includes('INSERT INTO cactus')) return { rows: [{ id: 50 }] };
  if (sql.includes('UPDATE cactus SET name')) return { rows: [], rowCount: 1 };
  if (sql.includes('ORDER BY id DESC LIMIT 1 FOR UPDATE')) return { rows: bidAuction ? [bidAuction] : [] };
  if (sql.includes('a.starts_at AS "startsAt", a.ends_at AS "endsAt",') && sql.includes('AS bids'))
    return { rows: currentAuction ? [currentAuction] : [] };
  if (sql.includes('INSERT INTO bid')) return { rows: [{ id: 1, amount: params[2], placedAt: new Date().toISOString() }] };
  if (sql.includes('SELECT username FROM users')) return { rows: [{ username: 'alice' }] };
  return { rows: [], rowCount: 0 };
});

vi.mock('pg', () => ({
  Pool: class { query = query; on() {} connect() { return { query, release() {} }; } },
}));
vi.mock('../api/_email.js', () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock('../api/_blob.js',  () => ({ uploadImageFiles: vi.fn(async () => []), deleteBlobs: vi.fn(), removeTempFiles: vi.fn() }));

let app;
const adminAuth = () => `Bearer ${jwt.sign({ sub: ADMIN_ID }, JWT_SECRET)}`;
const userAuth  = () => `Bearer ${jwt.sign({ sub: USER_ID }, JWT_SECRET)}`;
const sqlCalls  = (needle) => query.mock.calls.filter(([sql]) => sql.includes(needle));

const cactusForm = (req, extra = {}) => {
  const fields = { name: 'Star', categoryId: '1', basePrice: '100', quantity: '1', forAuction: 'true',
                   startPrice: '100', bidIncrement: '10', auctionHours: '48', ...extra };
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) req.field(k, v);
  return req;
};
const create = (extra) => cactusForm(request(app).post('/api/cactus').set('Authorization', adminAuth()), extra);
const update = (extra) => cactusForm(request(app).put('/api/cactus/50').set('Authorization', adminAuth()), extra);
const bid    = (amount) => request(app).post('/api/auction/bid').set('Authorization', userAuth()).send({ cactusId: 50, amount });

beforeAll(async () => {
  process.env.VERCEL       = '1';
  process.env.JWT_SECRET   = JWT_SECRET;
  process.env.POSTGRES_URL = 'postgres://localhost/test';
  ({ default: app } = await import('../api/server.js'));
});
afterEach(() => { query.mockClear(); bidAuction = null; currentAuction = null; });

const insertedAuction = () => {
  const [call] = sqlCalls('INSERT INTO auction');
  const [, , , , startsAt, endsAt] = call[1];
  return { startsAt: new Date(startsAt), endsAt: new Date(endsAt) };
};

describe('creating an auction', () => {
  it('schedules it for the given start, with the duration counted from the start', async () => {
    const start = inHours(72);
    const res = await create({ auctionStartsAt: start.toISOString() });
    expect(res.status).toBe(201);
    const { startsAt, endsAt } = insertedAuction();
    expect(startsAt.getTime()).toBe(start.getTime());
    expect(endsAt.getTime() - startsAt.getTime()).toBe(48 * HOUR);
  });

  it('starts immediately when no start time is given (unchanged behaviour)', async () => {
    const res = await create();
    expect(res.status).toBe(201);
    const { startsAt, endsAt } = insertedAuction();
    expect(Math.abs(startsAt.getTime() - Date.now())).toBeLessThan(5_000);
    expect(endsAt.getTime() - startsAt.getTime()).toBe(48 * HOUR);
  });

  it.each([
    ['a past time',        () => inHours(-2).toISOString(), /must be in the future/],
    ['an invalid date',    () => 'not-a-date',               /not a valid date/],
    ['more than a year out', () => inHours(24 * 400).toISOString(), /within 365 days/],
  ])('rejects %s without creating anything', async (_label, value, message) => {
    const res = await create({ auctionStartsAt: value() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(message);
    expect(sqlCalls('INSERT INTO cactus')).toHaveLength(0);
    expect(sqlCalls('INSERT INTO auction')).toHaveLength(0);
  });

  it('ignores the start time for a non-auction listing', async () => {
    const res = await create({ forAuction: 'false', auctionStartsAt: 'not-a-date' });
    expect(res.status).toBe(201);
    expect(sqlCalls('INSERT INTO auction')).toHaveLength(0);
  });
});

describe('bidding', () => {
  const auctionRow = (startsAt, endsAt) => ({ id: 9, currentPrice: '100.00', bidIncrement: '10.00', startsAt, endsAt });

  it('is refused before the start time', async () => {
    bidAuction = auctionRow(inHours(5).toISOString(), inHours(53).toISOString());
    const res = await bid(110);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/hasn't started yet — it opens on .* IST/);
    expect(sqlCalls('INSERT INTO bid')).toHaveLength(0);
  });

  it('opens automatically once the start time has passed', async () => {
    bidAuction = auctionRow(inHours(-0.01).toISOString(), inHours(48).toISOString());
    const res = await bid(110);
    expect(res.status).toBe(201);
    expect(sqlCalls('INSERT INTO bid')).toHaveLength(1);
  });

  it('is refused after the auction has ended', async () => {
    bidAuction = auctionRow(inHours(-50).toISOString(), inHours(-2).toISOString());
    const res = await bid(110);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Auction has ended');
  });

  it('uses the newest auction for the cactus', async () => {
    bidAuction = auctionRow(inHours(-1).toISOString(), inHours(5).toISOString());
    await bid(110);
    expect(sqlCalls('FOR UPDATE')[0][0]).toMatch(/ORDER BY id DESC LIMIT 1 FOR UPDATE/);
  });
});

describe('editing an auction', () => {
  it('moves a scheduled start and keeps its duration', async () => {
    currentAuction = { id: 9, startsAt: inHours(24).toISOString(), endsAt: inHours(24 + 36).toISOString(), bids: 0 };
    const newStart = inHours(48);
    const res = await update({ auctionHours: undefined, auctionStartsAt: newStart.toISOString() });
    expect(res.status).toBe(200);
    const [call] = sqlCalls('UPDATE auction SET starts_at=$1, ends_at=$2');
    expect(new Date(call[1][0]).getTime()).toBe(newStart.getTime());
    expect(new Date(call[1][1]).getTime() - newStart.getTime()).toBe(36 * HOUR);
  });

  it('changes a scheduled duration from the start, not from now', async () => {
    const start = inHours(24);
    currentAuction = { id: 9, startsAt: start.toISOString(), endsAt: inHours(72).toISOString(), bids: 0 };
    await update({ auctionHours: '10' });
    const [call] = sqlCalls('UPDATE auction SET starts_at=$1, ends_at=$2');
    expect(new Date(call[1][1]).getTime() - start.getTime()).toBe(10 * HOUR);
  });

  it('refuses to move the start of an auction that has already started', async () => {
    currentAuction = { id: 9, startsAt: inHours(-1).toISOString(), endsAt: inHours(20).toISOString(), bids: 2 };
    const res = await update({ auctionHours: undefined, auctionStartsAt: inHours(5).toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already started/);
    expect(sqlCalls('COMMIT')).toHaveLength(0);
  });

  it('leaves a live auction alone when no start time is sent (unchanged behaviour)', async () => {
    currentAuction = { id: 9, startsAt: inHours(-1).toISOString(), endsAt: inHours(20).toISOString(), bids: 2 };
    const res = await update({ auctionHours: undefined });
    expect(res.status).toBe(200);
    expect(sqlCalls('UPDATE auction SET starts_at')).toHaveLength(0);
    expect(sqlCalls('UPDATE auction SET ends_at')).toHaveLength(0);
  });

  it('"start now" opens a scheduled auction immediately', async () => {
    currentAuction = { id: 9, startsAt: inHours(24).toISOString(), endsAt: inHours(48).toISOString(), bids: 0 };
    await update({ auctionHours: undefined, auctionStartsAt: '' });
    const [call] = sqlCalls('UPDATE auction SET starts_at=$1, ends_at=$2');
    expect(Math.abs(new Date(call[1][0]).getTime() - Date.now())).toBeLessThan(5_000);
  });
});

describe('listing queries', () => {
  it('treat only started auctions as live', async () => {
    await request(app).get('/api/auctions/active');
    expect(sqlCalls('FROM auction a\n      JOIN cactus c')[0][0]).toMatch(/a\.starts_at <= NOW\(\)/);
    await request(app).get('/api/cactus');
    expect(sqlCalls('AS "auctionStartsAt"')).toHaveLength(1);
  });
});

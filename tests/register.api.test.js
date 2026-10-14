// Registration: requires a valid Indian mobile number and stores it as +91XXXXXXXXXX.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { normalizeIndianMobile } from '../src/utils/phone';

const query = vi.fn(async (sql, params = []) => {
  if (sql.includes('SELECT id FROM users WHERE email=$1 OR username=$2')) return { rows: [] };
  if (sql.includes('INSERT INTO users')) {
    return { rows: [{ id: '11111111-1111-1111-1111-111111111111', username: params[0], email: params[1], role: 'user', avatar: null }] };
  }
  return { rows: [], rowCount: 0 };
});

vi.mock('pg', () => ({
  Pool: class { query = query; on() {} connect() { return { query, release() {} }; } },
}));
vi.mock('../api/_email.js', () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock('../api/_blob.js',  () => ({ uploadImageFiles: vi.fn(), deleteBlobs: vi.fn(), removeTempFiles: vi.fn() }));

let app;
const sqlCalls = (needle) => query.mock.calls.filter(([sql]) => sql.includes(needle));
const register = (phone) => request(app).post('/api/auth/register')
  .send({ username: 'priya', email: 'priya@example.com', password: 'secret1', phone });

beforeAll(async () => {
  process.env.VERCEL       = '1';
  process.env.JWT_SECRET   = 'test-secret';
  process.env.POSTGRES_URL = 'postgres://localhost/test';
  ({ default: app } = await import('../api/server.js'));
});
afterEach(() => query.mockClear());

const VALID = [
  ['9876543210',        '+919876543210'],
  ['98765 43210',       '+919876543210'],
  ['+91 98765-43210',   '+919876543210'],
  ['919876543210',      '+919876543210'],
  ['09876543210',       '+919876543210'],
  ['6000000000',        '+916000000000'],
];
const INVALID = ['', '5876543210', '987654321', '98765432100', '+1 9876543210', '98765abcde', '+92 9876543210'];

describe('normalizeIndianMobile (client)', () => {
  it.each(VALID)('accepts %s', (input, expected) => expect(normalizeIndianMobile(input)).toBe(expected));
  it.each(INVALID)('rejects "%s"', input => expect(normalizeIndianMobile(input)).toBeNull());
});

describe('POST /api/auth/register', () => {
  it.each(VALID)('stores %s as %s', async (input, expected) => {
    const res = await register(input);
    expect(res.status).toBe(200);
    expect(sqlCalls('INSERT INTO users')[0][1][3]).toBe(expected);
  });

  it.each([...INVALID, undefined])('rejects phone "%s" without creating the user', async input => {
    const res = await register(input);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mobile number/i);
    expect(sqlCalls('INSERT INTO users')).toHaveLength(0);
  });
});

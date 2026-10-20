// Saved addresses: a user's own address book, with exactly one default while any exist.
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test-secret';
const USER_ID    = '11111111-1111-1111-1111-111111111111';
const OTHER_ID   = '22222222-2222-2222-2222-222222222222';

const VALID = {
  label: 'Home', firstName: 'Priya', lastName: 'Shah', email: 'priya@example.com', phone: '9876543210',
  line1: '12 MG Road', line2: '', city: 'Pune', state: 'Maharashtra', zip: '411001', country: 'IN',
};

// Minimal in-memory user_addresses table that understands the queries the routes send
let rows = [];
let nextId = 1;
let tick = 0;
const toApi = (r) => ({
  id: r.id, label: r.label, firstName: r.first_name, lastName: r.last_name, email: r.email, phone: r.phone,
  line1: r.line1, line2: r.line2, city: r.city, state: r.state, zip: r.zip, country: r.country,
  isDefault: r.is_default, createdAt: r.t, updatedAt: r.t,
});
const mine = (userId) => rows.filter(r => r.user_id === userId);

const query = vi.fn(async (sql, p = []) => {
  if (sql.includes('password_changed_at') && sql.includes('FROM users')) return { rows: [{ changed: null }] };
  if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(sql) || sql.includes('FOR UPDATE')) return { rows: [] };
  if (sql.includes('COUNT(*)::int AS count FROM user_addresses')) return { rows: [{ count: mine(p[0]).length }] };
  if (sql.includes('FROM user_addresses') && sql.includes('ORDER BY is_default DESC'))
    return { rows: mine(p[0]).sort((a, b) => b.is_default - a.is_default || b.t - a.t || b.id - a.id).map(toApi) };
  if (sql.includes('INSERT INTO user_addresses')) {
    const [user_id, label, first_name, last_name, email, phone, line1, line2, city, state, zip, country, is_default] = p;
    const r = { id: nextId++, user_id, label, first_name, last_name, email, phone, line1, line2, city, state, zip, country, is_default, t: ++tick };
    rows.push(r);
    return { rows: [toApi(r)] };
  }
  if (sql.includes('SET is_default = FALSE')) {
    mine(p[0]).filter(r => r.is_default && r.id !== p[1]).forEach(r => { r.is_default = false; });
    return { rows: [] };
  }
  if (sql.includes('SET is_default = TRUE WHERE id = $1')) {
    const r = mine(p[1]).find(x => x.id === p[0]);
    if (r) r.is_default = true;
    return { rows: [], rowCount: r ? 1 : 0 };
  }
  if (sql.includes('SET is_default = TRUE') && sql.includes('LIMIT 1')) {
    const [r] = mine(p[0]).sort((a, b) => b.t - a.t || b.id - a.id);
    if (r) r.is_default = true;
    return { rows: [] };
  }
  if (sql.includes('UPDATE user_addresses SET') && sql.includes('label = $3')) {
    const r = mine(p[1]).find(x => x.id === p[0]);
    if (!r) return { rows: [] };
    Object.assign(r, { label: p[2], first_name: p[3], last_name: p[4], email: p[5], phone: p[6],
      line1: p[7], line2: p[8], city: p[9], state: p[10], zip: p[11], country: p[12],
      is_default: r.is_default || p[13], t: ++tick });
    return { rows: [toApi(r)] };
  }
  if (sql.includes('DELETE FROM user_addresses')) {
    const r = mine(p[1]).find(x => x.id === p[0]);
    if (!r) return { rows: [] };
    rows = rows.filter(x => x !== r);
    return { rows: [{ is_default: r.is_default }] };
  }
  return { rows: [], rowCount: 0 };
});

vi.mock('pg', () => ({
  Pool: class { query = query; on() {} connect() { return { query, release() {} }; } },
}));
vi.mock('../api/_email.js', () => ({ sendPasswordResetEmail: vi.fn() }));
vi.mock('../api/_blob.js',  () => ({ uploadImageFiles: vi.fn(), deleteBlobs: vi.fn(), removeTempFiles: vi.fn() }));

let app;
const auth = (id = USER_ID) => `Bearer ${jwt.sign({ sub: id }, JWT_SECRET)}`;
const create = (body = VALID, id = USER_ID) =>
  request(app).post('/api/auth/addresses').set('Authorization', auth(id)).send(body);
const list = (id = USER_ID) => request(app).get('/api/auth/addresses').set('Authorization', auth(id));

beforeAll(async () => {
  process.env.VERCEL       = '1';
  process.env.JWT_SECRET   = JWT_SECRET;
  process.env.POSTGRES_URL = 'postgres://localhost/test';
  ({ default: app } = await import('../api/server.js'));
});
afterEach(() => { query.mockClear(); rows = []; nextId = 1; tick = 0; });

describe('saved addresses', () => {
  it('requires login', async () => {
    expect((await request(app).get('/api/auth/addresses')).status).toBe(401);
    expect((await request(app).post('/api/auth/addresses').send(VALID)).status).toBe(401);
  });

  it('makes the first address the default and trims fields', async () => {
    const res = await create({ ...VALID, firstName: '  Priya ', line2: '   ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ firstName: 'Priya', line2: null, isDefault: true });
    const second = await create({ ...VALID, label: 'Work' });
    expect(second.body.isDefault).toBe(false);
  });

  it('lists only my addresses, default first', async () => {
    await create();
    await create({ ...VALID, label: 'Work' });
    await create({ ...VALID, label: 'Mum' }, OTHER_ID);
    const res = await list();
    expect(res.body.map(a => a.label)).toEqual(['Home', 'Work']);
  });

  it.each([
    ['firstName', { firstName: ' ' }, 'firstName is required'],
    ['email',     { email: 'nope' },  'email must be a valid email address'],
    ['zip',       { zip: '' },        'zip is required'],
    ['line1',     { line1: 'x'.repeat(201) }, 'line1 must be at most 200 characters'],
  ])('rejects a bad %s', async (_field, patch, error) => {
    const res = await create({ ...VALID, ...patch });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(error);
  });

  it('caps the address book at 10', async () => {
    for (let i = 0; i < 10; i++) await create();
    const res = await create();
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/up to 10/);
  });

  it('moves the default when a new default is saved', async () => {
    await create();
    await create({ ...VALID, label: 'Work' });
    const res = await request(app).post('/api/auth/addresses').set('Authorization', auth()).send({ ...VALID, label: 'Gran', isDefault: true });
    expect(res.body.isDefault).toBe(true);
    expect((await list()).body.filter(a => a.isDefault).map(a => a.label)).toEqual(['Gran']);
  });

  it('edits an address without dropping its default', async () => {
    const { body: home } = await create();
    const res = await request(app).put(`/api/auth/addresses/${home.id}`).set('Authorization', auth())
      .send({ ...VALID, city: 'Mumbai' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ city: 'Mumbai', isDefault: true });
  });

  it('sets another address as the default', async () => {
    await create();
    const { body: work } = await create({ ...VALID, label: 'Work' });
    const res = await request(app).put(`/api/auth/addresses/${work.id}/default`).set('Authorization', auth());
    expect(res.status).toBe(200);
    expect((await list()).body.filter(a => a.isDefault).map(a => a.id)).toEqual([work.id]);
  });

  it("can't touch someone else's address", async () => {
    const { body: theirs } = await create(VALID, OTHER_ID);
    const put = await request(app).put(`/api/auth/addresses/${theirs.id}`).set('Authorization', auth()).send(VALID);
    const def = await request(app).put(`/api/auth/addresses/${theirs.id}/default`).set('Authorization', auth());
    const del = await request(app).delete(`/api/auth/addresses/${theirs.id}`).set('Authorization', auth());
    expect([put.status, def.status, del.status]).toEqual([404, 404, 404]);
    expect((await list(OTHER_ID)).body).toHaveLength(1);
  });

  it('promotes another address when the default is deleted', async () => {
    const { body: home } = await create();
    const { body: work } = await create({ ...VALID, label: 'Work' });
    const res = await request(app).delete(`/api/auth/addresses/${home.id}`).set('Authorization', auth());
    expect(res.status).toBe(204);
    expect((await list()).body).toMatchObject([{ id: work.id, isDefault: true }]);
  });

  it('rejects a non-numeric id', async () => {
    const res = await request(app).delete('/api/auth/addresses/abc').set('Authorization', auth());
    expect(res.status).toBe(400);
  });
});

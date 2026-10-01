// api/categories.js  →  GET /api/categories
import { getPool }             from './_db.js';
import { handleCors, ok, fail } from './_helpers.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;

  if (req.method !== 'GET') {
    return fail(res, 'Method not allowed', 405);
  }

  try {
    const pool   = getPool();
    const result = await pool.query(
      'SELECT id, name, description FROM categories ORDER BY name ASC'
    );
    return ok(res, result.rows);
  } catch (err) {
    console.error('GET /api/categories error:', err.message);
    return fail(res, 'Failed to load categories', 500, err.message);
  }
}

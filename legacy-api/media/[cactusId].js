// api/media/[cactusId].js
// DELETE /api/media/:mediaId  → remove a single media item

import { getPool }              from '../_db.js';
import { handleCors, ok, fail } from '../_helpers.js';
import { deleteBlobs }          from '../../api/_blob.js';

export default async function handler(req, res) {
  if (handleCors(req, res)) return;
  if (req.method !== 'DELETE') return fail(res, 'Method not allowed', 405);

  const mediaId = parseInt(req.query.cactusId, 10); // reused dynamic segment name
  if (isNaN(mediaId)) return fail(res, 'Invalid media ID', 400);

  try {
    const pool   = getPool();
    const result = await pool.query('DELETE FROM media WHERE id = $1 RETURNING type, url', [mediaId]);
    if (result.rowCount === 0) return fail(res, 'Media not found', 404);
    if (result.rows[0].type === 'Image') await deleteBlobs([result.rows[0].url]);
    return ok(res, { message: 'Media deleted' });
  } catch (err) {
    console.error(`DELETE /api/media/${mediaId} error:`, err.message);
    return fail(res, 'Delete failed', 500, err.message);
  }
}

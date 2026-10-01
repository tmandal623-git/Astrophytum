// api/_blob.js
// Vercel Blob helpers for cactus images — shared by server.js and the serverless handlers.
// The leading underscore tells Vercel NOT to treat this as an API route.
// The SDK reads BLOB_READ_WRITE_TOKEN from the environment automatically.

import { put, del } from '@vercel/blob';
import fs           from 'fs/promises';
import path         from 'path';

const BLOB_FOLDER = 'cactus';

/** True for URLs that live in Vercel Blob (legacy "/images/..." paths return false). */
export function isBlobUrl(url) {
  try { return new URL(url).hostname.endsWith('.blob.vercel-storage.com'); }
  catch { return false; }
}

/** Remove formidable's temporary upload files (they live in the OS temp dir). */
export async function removeTempFiles(files) {
  await Promise.all(files.filter(Boolean).map(f => fs.unlink(f.filepath).catch(() => {})));
}

/** Upload one formidable file to Blob and return its public URL. */
async function uploadImageFile(file) {
  const original = file.originalFilename || file.newFilename || 'image';
  const ext      = path.extname(original).toLowerCase();
  const base     = path.basename(original, ext).replace(/[^a-z0-9_-]+/gi, '-').slice(0, 60) || 'image';
  const body     = await fs.readFile(file.filepath);
  const blob     = await put(`${BLOB_FOLDER}/${base}${ext}`, body, {
    access:          'public',
    contentType:     file.mimetype || undefined,
    addRandomSuffix: true,   // unique URL per upload — never overwrites another image
  });
  return blob.url;
}

/**
 * Upload formidable files to Blob, preserving order, and always clean up the temp files.
 * If any upload fails, the ones that succeeded are deleted again and the error is rethrown.
 */
export async function uploadImageFiles(files) {
  try {
    const results = await Promise.allSettled(files.map(uploadImageFile));
    const failed  = results.find(r => r.status === 'rejected');
    if (failed) {
      await deleteBlobs(results.filter(r => r.status === 'fulfilled').map(r => r.value));
      throw failed.reason;
    }
    return results.map(r => r.value);
  } finally {
    await removeTempFiles(files);
  }
}

/** Best-effort delete of Blob images. Skips non-Blob URLs and never throws. */
export async function deleteBlobs(urls) {
  const blobUrls = urls.filter(isBlobUrl);
  if (!blobUrls.length) return;
  try {
    await del(blobUrls);
  } catch (err) {
    console.error(`⚠️  Blob delete failed (${blobUrls.length} file(s)):`, err.message);
  }
}

// scripts/migrate-images-to-blob.js
// One-time migration: uploads locally stored cactus images (api/public/images) to Vercel Blob
// and rewrites media.url from "/images/<file>" to the Blob URL.
//
//   npm run migrate:images            → dry run (shows what would change, touches nothing)
//   npm run migrate:images -- --apply → upload + update the database
//
// Safe to re-run: only rows still pointing at "/images/..." are processed.
// Local files are never deleted — remove api/public/images yourself after verifying.

import fs        from 'fs/promises';
import path      from 'path';
import dotenv    from 'dotenv';
import pg        from 'pg';
import { put }   from '@vercel/blob';

dotenv.config({ quiet: true });

const APPLY      = process.argv.includes('--apply');
const IMAGE_DIR  = path.join(process.cwd(), 'api', 'public', 'images');
const CONTENT_TYPES = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif', '.svg': 'image/svg+xml',
};

function requireEnv(name) {
  if (!process.env[name]) {
    console.error(`❌ ${name} is not set. Add it to .env (see .env.example).`);
    process.exit(1);
  }
}

requireEnv('POSTGRES_URL');
if (APPLY) requireEnv('BLOB_READ_WRITE_TOKEN');

const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.POSTGRES_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function main() {
  console.log(APPLY ? '🚚 Migrating images to Vercel Blob…' : '🔍 Dry run — no uploads or DB changes (add --apply to migrate)');

  const { rows } = await pool.query(
    `SELECT id, url FROM media WHERE type = 'Image' AND url LIKE '/images/%' ORDER BY id`,
  );
  console.log(`Found ${rows.length} media row(s) pointing at local /images/ files.`);

  const uploaded = new Map();   // filename → Blob URL (a file referenced twice is uploaded once)
  let migrated = 0;
  const missing = [];
  const failed  = [];

  for (const row of rows) {
    const filename = path.basename(row.url);
    const filePath = path.join(IMAGE_DIR, filename);

    try {
      await fs.access(filePath);
    } catch {
      missing.push(`media #${row.id}: ${row.url}`);
      continue;
    }

    if (!APPLY) {
      console.log(`  would upload ${filename}  (media #${row.id})`);
      continue;
    }

    try {
      let blobUrl = uploaded.get(filename);
      if (!blobUrl) {
        const body = await fs.readFile(filePath);
        const blob = await put(`cactus/${filename}`, body, {
          access:          'public',
          contentType:     CONTENT_TYPES[path.extname(filename).toLowerCase()],
          addRandomSuffix: true,
        });
        blobUrl = blob.url;
        uploaded.set(filename, blobUrl);
      }
      // Guard on the old URL so a concurrent change is never overwritten
      await pool.query('UPDATE media SET url = $1 WHERE id = $2 AND url = $3', [blobUrl, row.id, row.url]);
      migrated++;
      console.log(`  ✅ media #${row.id}  ${filename} → ${blobUrl}`);
    } catch (err) {
      failed.push(`media #${row.id} (${filename}): ${err.message}`);
      console.error(`  ❌ media #${row.id}  ${filename}: ${err.message}`);
    }
  }

  // Files on disk that no media row references (e.g. left behind by deleted cacti)
  const referenced = new Set(rows.map(r => path.basename(r.url)));
  const onDisk     = await fs.readdir(IMAGE_DIR).catch(() => []);
  const orphans    = onDisk.filter(f => !referenced.has(f));

  console.log('\n── Summary ─────────────────────────────');
  console.log(`  ${APPLY ? 'Migrated' : 'To migrate'}: ${APPLY ? migrated : rows.length - missing.length} row(s)`);
  if (APPLY) console.log(`  Uploaded:  ${uploaded.size} file(s)`);
  if (missing.length) {
    console.log(`  ⚠️  Missing on disk (${missing.length}) — these rows were left unchanged:`);
    missing.forEach(m => console.log(`     ${m}`));
  }
  if (failed.length) {
    console.log(`  ❌ Failed (${failed.length}) — re-run to retry:`);
    failed.forEach(f => console.log(`     ${f}`));
  }
  if (orphans.length && !APPLY) {
    console.log(`  ℹ️  ${orphans.length} file(s) in api/public/images are not referenced by any media row (not migrated).`);
  }
  if (APPLY && !failed.length && !missing.length) {
    console.log('  🎉 All local images are now in Vercel Blob. After checking the site, api/public/images can be deleted.');
  }

  process.exitCode = failed.length ? 1 : 0;
}

main()
  .catch(err => { console.error('❌ Migration failed:', err.message); process.exitCode = 1; })
  .finally(() => pool.end());

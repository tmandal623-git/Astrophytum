// api/_db.js
// Shared PostgreSQL pool — imported by every Vercel serverless function.
// The leading underscore tells Vercel NOT to treat this as an API route.

import { Pool } from 'pg';

// Re-use the pool across hot-reloads in dev (avoid exhausting connections)
let pool;

export function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: process.env.POSTGRES_URL?.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
      // ssl: false,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected PG pool error:', err.message);
    });
  }
  return pool;
}

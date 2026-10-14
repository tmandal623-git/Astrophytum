-- ════════════════════════════════════════════════════════════
--  Scheduled auction start — database migration (PostgreSQL)
-- ════════════════════════════════════════════════════════════
--  Same statements the API runs on startup (ensureSchema() in api/server.js).
--  Idempotent: safe to run more than once, and safe to run on a database
--  the API has already migrated.
--
--  What it does:
--    • adds auction.starts_at (TIMESTAMPTZ — stored as UTC, shown in the
--      viewer's local time zone)
--    • existing auctions get starts_at = created_at, so every auction that
--      is live today stays live, with the same end time and bids
--    • new rows default to NOW() (start immediately) unless a time is given
--  No rows are deleted and no other columns change.
--
--  Run:  psql "$POSTGRES_URL" -f scripts/auction-schedule.sql
--  (or paste into the Neon / pgAdmin SQL editor)
-- ════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE auction ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;

-- Existing auctions: treat them as having started when they were created
UPDATE auction SET starts_at = COALESCE(created_at, NOW()) WHERE starts_at IS NULL;

ALTER TABLE auction
  ALTER COLUMN starts_at SET DEFAULT NOW(),
  ALTER COLUMN starts_at SET NOT NULL;

COMMIT;

-- ── Checks (read-only) ───────────────────────────────────────
-- Column exists and is NOT NULL with a default:
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'auction' AND column_name = 'starts_at';

-- Each current auction and its state:
SELECT id, cactus_id, starts_at, ends_at,
       CASE WHEN NOT is_active OR ends_at <= NOW() THEN 'ended'
            WHEN starts_at > NOW()                  THEN 'scheduled'
            ELSE 'live' END AS state
FROM auction
ORDER BY id;

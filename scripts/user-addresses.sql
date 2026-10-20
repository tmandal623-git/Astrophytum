-- ════════════════════════════════════════════════════════════
--  Saved delivery addresses — database migration
-- ════════════════════════════════════════════════════════════
--  Same statements the API runs on startup (ensureSchema() in api/server.js).
--  Idempotent: safe to run more than once, and safe to run on a database
--  the API has already migrated. Only adds a new table — existing users
--  and orders are not modified (orders keep their own copy of the address).
--
--  Run:  psql "$POSTGRES_URL" -f scripts/user-addresses.sql
--  (or paste into the Neon / pgAdmin SQL editor)
-- ════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS user_addresses (
  id          SERIAL       PRIMARY KEY,
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       VARCHAR(30)  NOT NULL DEFAULT 'Home',
  first_name  VARCHAR(100) NOT NULL,
  last_name   VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NOT NULL,
  phone       VARCHAR(20),
  line1       VARCHAR(200) NOT NULL,
  line2       VARCHAR(200),
  city        VARCHAR(100) NOT NULL,
  state       VARCHAR(100) NOT NULL,
  zip         VARCHAR(20)  NOT NULL,
  country     VARCHAR(60)  NOT NULL,
  is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_addresses_user_idx ON user_addresses (user_id);

-- At most one default address per user
CREATE UNIQUE INDEX IF NOT EXISTS user_addresses_one_default ON user_addresses (user_id) WHERE is_default;

COMMIT;

-- ── Checks (read-only) ───────────────────────────────────────
-- Users with saved addresses, and how many of each are default (should be 1):
SELECT user_id, COUNT(*) AS addresses, COUNT(*) FILTER (WHERE is_default) AS defaults
FROM user_addresses GROUP BY user_id;

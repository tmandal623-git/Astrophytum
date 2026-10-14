-- ════════════════════════════════════════════════════════════
--  User mobile number — database migration
-- ════════════════════════════════════════════════════════════
--  Same statement the API runs on startup (ensureSchema() in api/server.js).
--  Idempotent: safe to run more than once, and safe to run on a database
--  the API has already migrated. Only adds a nullable column — existing
--  users and data are not modified (their phone stays NULL).
--
--  Run:  psql "$POSTGRES_URL" -f scripts/user-phone.sql
--  (or paste into the Neon / pgAdmin SQL editor)
-- ════════════════════════════════════════════════════════════

BEGIN;

-- Mobile number given at registration, stored as +91XXXXXXXXXX
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(15);

COMMIT;

-- ── Checks (read-only) ───────────────────────────────────────
-- Column exists:
SELECT column_name, data_type, character_maximum_length, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'phone';

-- How many users have a mobile number on file:
SELECT COUNT(*) FILTER (WHERE phone IS NOT NULL) AS with_phone,
       COUNT(*)                                  AS total_users
FROM users;

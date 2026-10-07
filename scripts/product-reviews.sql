-- ════════════════════════════════════════════════════════════
--  Product Rating & Review — database migration
-- ════════════════════════════════════════════════════════════
--  Same statements the API runs on startup (ensureSchema() in api/server.js).
--  Idempotent and additive: creates one new table; existing tables and data
--  are not modified. The existing cactus.rating / cactus.rating_count columns
--  hold the average and count, and the API recalculates them whenever a
--  review is saved.
--
--  Run:  psql "$POSTGRES_URL" -f scripts/product-reviews.sql
--  (or paste into the Neon / pgAdmin SQL editor)
-- ════════════════════════════════════════════════════════════

BEGIN;

-- One review per customer per cactus (submitting again updates it).
-- order_id records the delivered order the review was made from.
CREATE TABLE IF NOT EXISTS product_reviews (
  id          SERIAL      PRIMARY KEY,
  cactus_id   INTEGER     NOT NULL REFERENCES cactus(id) ON DELETE CASCADE,
  order_id    INTEGER     NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  rating      SMALLINT    NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT        CHECK (char_length(comment) <= 1000),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, cactus_id)
);

CREATE INDEX IF NOT EXISTS product_reviews_cactus_idx ON product_reviews (cactus_id);

COMMIT;

-- ── Verify (optional) ────────────────────────────────────────
-- SELECT to_regclass('product_reviews');
-- SELECT c.id, c.name, c.rating, c.rating_count FROM cactus c ORDER BY c.id;

-- ── Re-sync averages from reviews (optional, e.g. after editing reviews by hand) ──
-- UPDATE cactus c SET
--   rating       = (SELECT ROUND(AVG(r.rating), 1) FROM product_reviews r WHERE r.cactus_id = c.id),
--   rating_count = (SELECT COUNT(*)                FROM product_reviews r WHERE r.cactus_id = c.id)
-- WHERE EXISTS (SELECT 1 FROM product_reviews r WHERE r.cactus_id = c.id);

-- ── Rollback (optional — deletes all reviews) ────────────────
-- DROP TABLE IF EXISTS product_reviews;

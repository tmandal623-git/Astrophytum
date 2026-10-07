-- ════════════════════════════════════════════════════════════
--  Order Shipment & Tracking — database migration
-- ════════════════════════════════════════════════════════════
--  Same statements the API runs on startup (ensureSchema() in api/server.js).
--  Idempotent: safe to run more than once, and safe to run on a database
--  the API has already migrated. Only adds new tables — existing tables
--  and data are not modified.
--
--  Run:  psql "$POSTGRES_URL" -f scripts/order-shipment-tracking.sql
--  (or paste into the Neon / pgAdmin SQL editor)
-- ════════════════════════════════════════════════════════════

BEGIN;

-- ── One shipment per order ───────────────────────────────────
CREATE TABLE IF NOT EXISTS order_shipments (
  order_id                INTEGER     PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  status                  VARCHAR(20) NOT NULL DEFAULT 'processing'
                          CHECK (status IN ('processing','dispatched','in_transit','delivered','cancelled')),
  courier                 VARCHAR(20),              -- dtdc | india_post | bluedart | delhivery | other
  courier_name            VARCHAR(100),             -- display name (custom name when courier = 'other')
  tracking_number         VARCHAR(40),              -- AWB / tracking number
  tracking_url            TEXT,
  dispatch_date           DATE,
  estimated_delivery_date DATE,
  updated_by              UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Timestamped order / shipment status history ──────────────
-- status: payment_pending | payment_verified | payment_failed |
--         processing | dispatched | in_transit | delivered | cancelled
CREATE TABLE IF NOT EXISTS order_status_history (
  id          SERIAL      PRIMARY KEY,
  order_id    INTEGER     NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status      VARCHAR(30) NOT NULL,
  note        TEXT,
  changed_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS order_status_history_order_idx
  ON order_status_history (order_id, created_at);

-- ── Backfill history for existing orders ─────────────────────
-- Adds "order placed" and "payment verified / rejected" entries for orders
-- that have no history yet. Orders that already have history are skipped.
INSERT INTO order_status_history (order_id, status, note, changed_by, created_at)
SELECT o.id, h.status, h.note, h.changed_by, h.at
FROM orders o
CROSS JOIN LATERAL (VALUES
  (CASE WHEN o.payment_method = 'googlepay' THEN 'payment_pending' ELSE 'payment_verified' END,
   CASE WHEN o.payment_method = 'googlepay' THEN 'Order placed — awaiting payment verification' ELSE 'Order placed and paid' END,
   NULL::uuid, o.created_at),
  (CASE WHEN o.payment_method = 'googlepay' AND o.payment_status = 'paid' THEN 'payment_verified'
        WHEN o.payment_status = 'rejected' THEN 'payment_failed' END,
   CASE WHEN o.payment_status = 'rejected'
        THEN 'Payment rejected' || COALESCE(' — ' || o.rejection_note, '')
        ELSE 'Payment verified' END,
   o.verified_by, COALESCE(o.verified_at, o.created_at))
) AS h(status, note, changed_by, at)
WHERE h.status IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM order_status_history x WHERE x.order_id = o.id);

COMMIT;

-- ── Verify (optional) ────────────────────────────────────────
-- SELECT to_regclass('order_shipments') AS shipments, to_regclass('order_status_history') AS history;
-- SELECT order_id, status, note, created_at FROM order_status_history ORDER BY order_id, created_at;

-- ── Rollback (optional — deletes all shipment & tracking data) ──
-- BEGIN;
-- DROP TABLE IF EXISTS order_status_history;
-- DROP TABLE IF EXISTS order_shipments;
-- COMMIT;

-- Add GA4 health fields and explicit reporting proxy semantics.

ALTER TABLE IF EXISTS "analytics_connections"
  ADD COLUMN IF NOT EXISTS "last_attempted_sync_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_successful_sync_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_sync_error_message" TEXT,
  ADD COLUMN IF NOT EXISTS "last_sync_error_at" TIMESTAMP(3);

ALTER TABLE IF EXISTS "analytics_reporting_daily"
  ADD COLUMN IF NOT EXISTS "ga4_purchase_proxy" INTEGER NOT NULL DEFAULT 0;

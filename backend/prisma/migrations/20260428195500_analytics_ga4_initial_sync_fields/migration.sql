-- Add GA4 sync fields to existing analytics tables.

ALTER TABLE IF EXISTS "analytics_ga4_daily_metrics"
  ADD COLUMN IF NOT EXISTS "event_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "key_events" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE IF EXISTS "analytics_reporting_daily"
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "medium" TEXT,
  ADD COLUMN IF NOT EXISTS "landing_page" TEXT,
  ADD COLUMN IF NOT EXISTS "device" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "users" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "event_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "key_events" INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS "analytics_reporting_daily_natural_key";
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_reporting_daily_natural_key"
  ON "analytics_reporting_daily" ("date", "channel", "source", "medium", "campaign", "product_id", "landing_page", "device", "country");


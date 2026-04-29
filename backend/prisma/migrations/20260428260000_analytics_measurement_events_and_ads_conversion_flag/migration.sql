ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "event_category" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "measurement_status" TEXT;

CREATE INDEX IF NOT EXISTS "events_event_category_idx" ON "events" ("event_category");
CREATE INDEX IF NOT EXISTS "events_source_idx" ON "events" ("source");
CREATE INDEX IF NOT EXISTS "events_measurement_status_idx" ON "events" ("measurement_status");

ALTER TABLE "event_facts"
  ADD COLUMN IF NOT EXISTS "event_category" TEXT,
  ADD COLUMN IF NOT EXISTS "source" TEXT,
  ADD COLUMN IF NOT EXISTS "measurement_status" TEXT;

CREATE INDEX IF NOT EXISTS "event_facts_event_category_idx" ON "event_facts" ("event_category");
CREATE INDEX IF NOT EXISTS "event_facts_source_idx" ON "event_facts" ("source");
CREATE INDEX IF NOT EXISTS "event_facts_measurement_status_idx" ON "event_facts" ("measurement_status");

ALTER TABLE "analytics_ads_daily_metrics"
  ADD COLUMN IF NOT EXISTS "has_conversion_data" BOOLEAN NOT NULL DEFAULT FALSE;

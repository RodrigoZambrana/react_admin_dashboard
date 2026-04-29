ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "fbp" TEXT,
  ADD COLUMN IF NOT EXISTS "fbc" TEXT,
  ADD COLUMN IF NOT EXISTS "external_targets" JSONB,
  ADD COLUMN IF NOT EXISTS "meta_sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "meta_event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "meta_status" TEXT;

CREATE INDEX IF NOT EXISTS "events_event_id_idx" ON "events" ("event_id");
CREATE INDEX IF NOT EXISTS "events_meta_status_idx" ON "events" ("meta_status");

ALTER TABLE "event_facts"
  ADD COLUMN IF NOT EXISTS "event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "fbp" TEXT,
  ADD COLUMN IF NOT EXISTS "fbc" TEXT,
  ADD COLUMN IF NOT EXISTS "external_targets" JSONB,
  ADD COLUMN IF NOT EXISTS "meta_sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "meta_event_id" TEXT,
  ADD COLUMN IF NOT EXISTS "meta_status" TEXT;

CREATE INDEX IF NOT EXISTS "event_facts_event_id_idx" ON "event_facts" ("event_id");

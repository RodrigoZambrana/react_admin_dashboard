ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "conversion_flag" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "event_facts"
  ADD COLUMN IF NOT EXISTS "conversion_flag" BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE "events"
  SET "conversion_flag" = TRUE
  WHERE "event_category" = 'conversion';

UPDATE "event_facts"
  SET "conversion_flag" = TRUE
  WHERE "event_category" = 'conversion';

CREATE INDEX IF NOT EXISTS "events_conversion_flag_idx" ON "events" ("conversion_flag");
CREATE INDEX IF NOT EXISTS "event_facts_conversion_flag_idx" ON "event_facts" ("conversion_flag");

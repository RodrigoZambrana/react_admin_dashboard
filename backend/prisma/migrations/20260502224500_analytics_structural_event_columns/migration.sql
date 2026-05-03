-- Structural analytics columns for analytics events and facts.

ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS "schema_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "page_type" TEXT,
  ADD COLUMN IF NOT EXISTS "component_type" TEXT,
  ADD COLUMN IF NOT EXISTS "component_id" TEXT,
  ADD COLUMN IF NOT EXISTS "cta_id" TEXT,
  ADD COLUMN IF NOT EXISTS "cta_name" TEXT,
  ADD COLUMN IF NOT EXISTS "cta_type" TEXT,
  ADD COLUMN IF NOT EXISTS "cta_context" TEXT,
  ADD COLUMN IF NOT EXISTS "cta_location" TEXT,
  ADD COLUMN IF NOT EXISTS "position" DECIMAL(18,6);

ALTER TABLE "event_facts"
  ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS "schema_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "page_type" TEXT,
  ADD COLUMN IF NOT EXISTS "component_type" TEXT,
  ADD COLUMN IF NOT EXISTS "component_id" TEXT,
  ADD COLUMN IF NOT EXISTS "cta_id" TEXT,
  ADD COLUMN IF NOT EXISTS "cta_name" TEXT,
  ADD COLUMN IF NOT EXISTS "cta_type" TEXT,
  ADD COLUMN IF NOT EXISTS "cta_context" TEXT,
  ADD COLUMN IF NOT EXISTS "cta_location" TEXT,
  ADD COLUMN IF NOT EXISTS "position" DECIMAL(18,6);

CREATE INDEX IF NOT EXISTS "events_tenant_id_event_name_timestamp_idx"
  ON "events" ("tenant_id", "event_name", "timestamp");
CREATE INDEX IF NOT EXISTS "events_tenant_id_timestamp_idx"
  ON "events" ("tenant_id", "timestamp");
CREATE INDEX IF NOT EXISTS "events_tenant_id_cta_id_idx"
  ON "events" ("tenant_id", "cta_id");
CREATE INDEX IF NOT EXISTS "events_tenant_id_component_id_idx"
  ON "events" ("tenant_id", "component_id");

CREATE INDEX IF NOT EXISTS "event_facts_tenant_id_event_date_idx"
  ON "event_facts" ("tenant_id", "event_date");
CREATE INDEX IF NOT EXISTS "event_facts_tenant_id_event_name_event_date_idx"
  ON "event_facts" ("tenant_id", "event_name", "event_date");
CREATE INDEX IF NOT EXISTS "event_facts_tenant_id_cta_id_idx"
  ON "event_facts" ("tenant_id", "cta_id");
CREATE INDEX IF NOT EXISTS "event_facts_tenant_id_component_id_idx"
  ON "event_facts" ("tenant_id", "component_id");

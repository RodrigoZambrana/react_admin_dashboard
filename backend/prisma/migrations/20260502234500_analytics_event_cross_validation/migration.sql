-- Cross-validation metadata and event comparison table.

ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "ingestion_source" TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS "ingestion_path" TEXT;

ALTER TABLE "event_facts"
  ADD COLUMN IF NOT EXISTS "ingestion_source" TEXT NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS "ingestion_path" TEXT;

CREATE TABLE IF NOT EXISTS "analytics_event_comparisons" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "event_name" TEXT NOT NULL,
  "direct_event_timestamp" TIMESTAMP(3),
  "ga_event_timestamp" TIMESTAMP(3),
  "exists_in_direct" BOOLEAN NOT NULL DEFAULT false,
  "exists_in_ga" BOOLEAN NOT NULL DEFAULT false,
  "payload_match" BOOLEAN NOT NULL DEFAULT false,
  "time_diff_ms" INTEGER,
  "status" TEXT NOT NULL,
  "direct_source" TEXT,
  "ga_source" TEXT,
  "comparison_date" DATE,
  "direct_payload" JSONB,
  "ga_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "analytics_event_comparisons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_event_comparisons_tenant_id_event_id_key"
  ON "analytics_event_comparisons"("tenant_id", "event_id");
CREATE INDEX IF NOT EXISTS "analytics_event_comparisons_tenant_id_status_idx"
  ON "analytics_event_comparisons"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "analytics_event_comparisons_tenant_id_event_name_idx"
  ON "analytics_event_comparisons"("tenant_id", "event_name");
CREATE INDEX IF NOT EXISTS "analytics_event_comparisons_comparison_date_idx"
  ON "analytics_event_comparisons"("comparison_date");

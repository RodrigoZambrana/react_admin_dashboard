CREATE TABLE IF NOT EXISTS "analytics_report_catalog" (
  "key" TEXT PRIMARY KEY,
  "source" TEXT NOT NULL DEFAULT 'ga4',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "baseline_header" TEXT NOT NULL,
  "baseline_title" TEXT,
  "equivalence_status" TEXT NOT NULL DEFAULT 'exact',
  "row_key_strategy" TEXT NOT NULL DEFAULT 'row_index',
  "dimension_labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metric_labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "api_definition" JSONB,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "analytics_report_runs" (
  "id" TEXT PRIMARY KEY,
  "report_key" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "from_date" TIMESTAMP(3),
  "to_date" TIMESTAMP(3),
  "row_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "metadata" JSONB,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_report_runs_report_key_fkey"
    FOREIGN KEY ("report_key") REFERENCES "analytics_report_catalog" ("key")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "analytics_report_rows" (
  "id" BIGSERIAL PRIMARY KEY,
  "report_run_id" TEXT NOT NULL,
  "report_key" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "row_type" TEXT NOT NULL,
  "row_index" INTEGER NOT NULL,
  "row_key" TEXT NOT NULL,
  "dimensions" JSONB,
  "metrics" JSONB,
  "raw" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_report_rows_report_run_id_fkey"
    FOREIGN KEY ("report_run_id") REFERENCES "analytics_report_runs" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_report_rows_unique"
  ON "analytics_report_rows" ("report_run_id", "row_key", "source");

CREATE INDEX IF NOT EXISTS "analytics_report_rows_report_key_source_idx"
  ON "analytics_report_rows" ("report_key", "source");

CREATE INDEX IF NOT EXISTS "analytics_report_rows_report_run_id_idx"
  ON "analytics_report_rows" ("report_run_id");

CREATE TABLE IF NOT EXISTS "analytics_report_reconciliations" (
  "id" TEXT PRIMARY KEY,
  "report_key" TEXT NOT NULL,
  "baseline_run_id" TEXT,
  "sync_run_id" TEXT,
  "status" TEXT NOT NULL,
  "baseline_row_count" INTEGER NOT NULL DEFAULT 0,
  "sync_row_count" INTEGER NOT NULL DEFAULT 0,
  "matched_row_count" INTEGER NOT NULL DEFAULT 0,
  "baseline_only_row_count" INTEGER NOT NULL DEFAULT 0,
  "sync_only_row_count" INTEGER NOT NULL DEFAULT 0,
  "delta_percent" DECIMAL(10,4) NOT NULL DEFAULT 0,
  "summary" TEXT NOT NULL,
  "evidence" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_report_reconciliations_report_key_fkey"
    FOREIGN KEY ("report_key") REFERENCES "analytics_report_catalog" ("key")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "analytics_report_reconciliations_baseline_run_id_fkey"
    FOREIGN KEY ("baseline_run_id") REFERENCES "analytics_report_runs" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "analytics_report_reconciliations_sync_run_id_fkey"
    FOREIGN KEY ("sync_run_id") REFERENCES "analytics_report_runs" ("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "analytics_report_reconciliations_report_key_status_idx"
  ON "analytics_report_reconciliations" ("report_key", "status");

CREATE INDEX IF NOT EXISTS "analytics_report_reconciliations_created_at_idx"
  ON "analytics_report_reconciliations" ("created_at");


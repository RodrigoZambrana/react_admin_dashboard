CREATE TABLE IF NOT EXISTS "analytics_baseline_snapshots" (
  "id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'ga4',
  "report_key" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "metric_name" TEXT NOT NULL,
  "dimension_hash" TEXT NOT NULL,
  "dimension_values" JSONB,
  "value" DECIMAL(18,6) NOT NULL,
  "query_hash" TEXT NOT NULL,
  "raw" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_baseline_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_baseline_snapshots_natural_key"
  ON "analytics_baseline_snapshots" (
    "connection_id",
    "source",
    "report_key",
    "date",
    "metric_name",
    "dimension_hash",
    "query_hash"
  );

CREATE INDEX IF NOT EXISTS "analytics_baseline_snapshots_report_key_date_idx"
  ON "analytics_baseline_snapshots" ("report_key", "date");

CREATE INDEX IF NOT EXISTS "analytics_baseline_snapshots_query_hash_idx"
  ON "analytics_baseline_snapshots" ("query_hash");

ALTER TABLE "analytics_baseline_snapshots"
  ADD CONSTRAINT "analytics_baseline_snapshots_connection_id_fkey"
  FOREIGN KEY ("connection_id")
  REFERENCES "analytics_connections" ("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "analytics_data_quality_checks" (
  "id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "report_key" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "metric_name" TEXT NOT NULL,
  "dimension_hash" TEXT NOT NULL,
  "baseline_value" DECIMAL(18,6) NOT NULL,
  "synced_value" DECIMAL(18,6) NOT NULL,
  "diff" DECIMAL(18,6) NOT NULL,
  "diff_percent" DECIMAL(10,4) NOT NULL,
  "status" TEXT NOT NULL,
  "baseline_snapshot_id" TEXT,
  "sync_run_id" TEXT,
  "query_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_data_quality_checks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_data_quality_checks_natural_key"
  ON "analytics_data_quality_checks" (
    "connection_id",
    "report_key",
    "date",
    "metric_name",
    "dimension_hash",
    "query_hash"
  );

CREATE INDEX IF NOT EXISTS "analytics_data_quality_checks_connection_report_date_status_idx"
  ON "analytics_data_quality_checks" ("connection_id", "report_key", "date", "status");

CREATE INDEX IF NOT EXISTS "analytics_data_quality_checks_sync_run_id_idx"
  ON "analytics_data_quality_checks" ("sync_run_id");

CREATE INDEX IF NOT EXISTS "analytics_data_quality_checks_query_hash_idx"
  ON "analytics_data_quality_checks" ("query_hash");

ALTER TABLE "analytics_data_quality_checks"
  ADD CONSTRAINT "analytics_data_quality_checks_connection_id_fkey"
  FOREIGN KEY ("connection_id")
  REFERENCES "analytics_connections" ("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "analytics_data_quality_checks"
  ADD CONSTRAINT "analytics_data_quality_checks_baseline_snapshot_id_fkey"
  FOREIGN KEY ("baseline_snapshot_id")
  REFERENCES "analytics_baseline_snapshots" ("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "analytics_data_quality_checks"
  ADD CONSTRAINT "analytics_data_quality_checks_sync_run_id_fkey"
  FOREIGN KEY ("sync_run_id")
  REFERENCES "analytics_sync_runs" ("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

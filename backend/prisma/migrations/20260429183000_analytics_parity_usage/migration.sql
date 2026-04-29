ALTER TABLE "analytics_baseline_snapshots"
  DROP CONSTRAINT IF EXISTS "analytics_baseline_snapshots_connection_id_fkey";

ALTER TABLE "analytics_baseline_snapshots"
  ALTER COLUMN "connection_id" DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS "origin" TEXT NOT NULL DEFAULT 'api',
  ADD COLUMN IF NOT EXISTS "snapshot_group" TEXT NOT NULL DEFAULT '';

ALTER TABLE "analytics_baseline_snapshots"
  ADD CONSTRAINT "analytics_baseline_snapshots_connection_id_fkey"
  FOREIGN KEY ("connection_id")
  REFERENCES "analytics_connections" ("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "analytics_baseline_snapshots_source_metric_name_origin_snapshot_group_date_idx"
  ON "analytics_baseline_snapshots" ("source", "metric_name", "origin", "snapshot_group", "date");

CREATE TABLE IF NOT EXISTS "analytics_data_parity_checks" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "date_from" DATE NOT NULL,
  "date_to" DATE NOT NULL,
  "api_value" DECIMAL(18,6) NOT NULL,
  "baseline_value" DECIMAL(18,6) NOT NULL,
  "delta_abs" DECIMAL(18,6) NOT NULL,
  "delta_percent" DECIMAL(10,4) NOT NULL,
  "status" TEXT NOT NULL,
  "snapshot_group" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_data_parity_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_data_parity_checks_source_status_idx"
  ON "analytics_data_parity_checks" ("source", "status");

CREATE INDEX IF NOT EXISTS "analytics_data_parity_checks_snapshot_group_created_at_idx"
  ON "analytics_data_parity_checks" ("snapshot_group", "created_at");

CREATE TABLE IF NOT EXISTS "analytics_usage_events" (
  "id" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "user_id" INTEGER,
  "time_range" TEXT NOT NULL,
  "filters" JSONB,
  "response_time_ms" INTEGER NOT NULL,
  "response_size" INTEGER NOT NULL,
  "trust_level" TEXT NOT NULL,
  "has_data" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_usage_events_endpoint_created_at_idx"
  ON "analytics_usage_events" ("endpoint", "created_at");

CREATE INDEX IF NOT EXISTS "analytics_usage_events_user_id_created_at_idx"
  ON "analytics_usage_events" ("user_id", "created_at");

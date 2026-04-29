CREATE TABLE IF NOT EXISTS "analytics_endpoint_usage" (
  "id" TEXT NOT NULL,
  "endpoint" TEXT NOT NULL,
  "user_id" TEXT,
  "status_code" INTEGER NOT NULL,
  "duration_ms" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_endpoint_usage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_endpoint_usage_endpoint_created_at_idx"
  ON "analytics_endpoint_usage" ("endpoint", "created_at");

CREATE INDEX IF NOT EXISTS "analytics_endpoint_usage_status_code_created_at_idx"
  ON "analytics_endpoint_usage" ("status_code", "created_at");

CREATE INDEX IF NOT EXISTS "analytics_endpoint_usage_user_id_created_at_idx"
  ON "analytics_endpoint_usage" ("user_id", "created_at");

CREATE TABLE IF NOT EXISTS "analytics_baseline_checks" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "source" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "comparison_kind" TEXT NOT NULL,
  "expected_value" DECIMAL(18,6) NOT NULL,
  "actual_value" DECIMAL(18,6) NOT NULL,
  "diff_pct" DECIMAL(10,4) NOT NULL,
  "status" TEXT NOT NULL,
  "snapshot_group" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_baseline_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_baseline_checks_source_metric_date_idx"
  ON "analytics_baseline_checks" ("source", "metric", "date");

CREATE INDEX IF NOT EXISTS "analytics_baseline_checks_comparison_kind_created_at_idx"
  ON "analytics_baseline_checks" ("comparison_kind", "created_at");

CREATE INDEX IF NOT EXISTS "analytics_baseline_checks_snapshot_group_created_at_idx"
  ON "analytics_baseline_checks" ("snapshot_group", "created_at");

CREATE TABLE IF NOT EXISTS "analytics_data_anomalies" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "metric" TEXT,
  "description" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_data_anomalies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_data_anomalies_source_detected_at_idx"
  ON "analytics_data_anomalies" ("source", "detected_at");

CREATE INDEX IF NOT EXISTS "analytics_data_anomalies_type_severity_idx"
  ON "analytics_data_anomalies" ("type", "severity");

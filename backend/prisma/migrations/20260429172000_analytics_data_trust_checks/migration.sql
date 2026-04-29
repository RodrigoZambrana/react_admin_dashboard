CREATE TABLE IF NOT EXISTS "analytics_data_trust_checks" (
  "id" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "check_name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "metric_value" DECIMAL(18,6),
  "expected_range" TEXT NOT NULL,
  "details_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_data_trust_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_data_trust_checks_environment_created_at_idx"
  ON "analytics_data_trust_checks" ("environment", "created_at");

CREATE INDEX IF NOT EXISTS "analytics_data_trust_checks_check_name_created_at_idx"
  ON "analytics_data_trust_checks" ("check_name", "created_at");

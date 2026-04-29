CREATE TABLE IF NOT EXISTS "analytics_health_checks" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "details_json" JSONB NOT NULL,
  "duration_ms" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_health_checks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_health_checks_environment_created_at_idx"
  ON "analytics_health_checks" ("environment", "created_at");

CREATE INDEX IF NOT EXISTS "analytics_health_checks_status_created_at_idx"
  ON "analytics_health_checks" ("status", "created_at");

CREATE TABLE IF NOT EXISTS "analytics_health_alert_state" (
  "id" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "last_status" TEXT NOT NULL,
  "last_signature" TEXT,
  "last_alerted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_health_alert_state_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_health_alert_state_environment_key"
  ON "analytics_health_alert_state" ("environment");

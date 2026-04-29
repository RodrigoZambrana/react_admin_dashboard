CREATE TABLE IF NOT EXISTS "analytics_export_runs" (
    "id" TEXT NOT NULL,
    "export_type" TEXT NOT NULL,
    "source" TEXT,
    "date_from" DATE NOT NULL,
    "date_to" DATE NOT NULL,
    "filters" JSONB,
    "row_count" INTEGER,
    "file_format" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_export_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_export_runs_export_type_created_at_idx"
    ON "analytics_export_runs" ("export_type", "created_at");

CREATE INDEX IF NOT EXISTS "analytics_export_runs_source_created_at_idx"
    ON "analytics_export_runs" ("source", "created_at");

CREATE INDEX IF NOT EXISTS "analytics_export_runs_status_created_at_idx"
    ON "analytics_export_runs" ("status", "created_at");

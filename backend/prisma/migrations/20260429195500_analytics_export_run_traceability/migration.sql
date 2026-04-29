ALTER TABLE "analytics_export_runs"
ADD COLUMN IF NOT EXISTS "duration_ms" INTEGER,
ADD COLUMN IF NOT EXISTS "file_size" INTEGER;

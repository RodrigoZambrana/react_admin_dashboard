-- Add canonical attribution fields to event_facts
ALTER TABLE "event_facts"
ADD COLUMN IF NOT EXISTS "utm_term" TEXT,
ADD COLUMN IF NOT EXISTS "utm_content" TEXT,
ADD COLUMN IF NOT EXISTS "landing_page" TEXT;

-- Harden sync runs with durable job metadata
ALTER TABLE "analytics_sync_runs"
ADD COLUMN IF NOT EXISTS "queued_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "retry_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "partial_failure_flag" BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "duration_ms" INTEGER;

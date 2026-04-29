ALTER TABLE "analytics_health_alert_state"
  ADD COLUMN IF NOT EXISTS "last_summary_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_digest_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_digest_signature" TEXT;

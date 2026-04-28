-- Rename raw analytics table to align with the new contract.
ALTER TABLE "AnalyticsEvent" RENAME TO "events";

-- Raw event lifecycle.
ALTER TABLE "events"
  ADD COLUMN IF NOT EXISTS "processed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "events_processed_timestamp_idx" ON "events"("processed", "timestamp");

-- Normalized facts.
CREATE TABLE IF NOT EXISTS "event_facts" (
    "id" BIGSERIAL NOT NULL,
    "event_name" TEXT NOT NULL,
    "event_timestamp" TIMESTAMP(3) NOT NULL,
    "event_date" DATE NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT,
    "page" TEXT,
    "path" TEXT,
    "product_id" TEXT,
    "category" TEXT,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "referrer" TEXT,
    "device" TEXT,
    "country" TEXT,
    "value" NUMERIC(18,4),
    "source_event_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_facts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_facts_source_event_id_key" ON "event_facts"("source_event_id");
CREATE INDEX IF NOT EXISTS "event_facts_event_name_event_date_idx" ON "event_facts"("event_name", "event_date");
CREATE INDEX IF NOT EXISTS "event_facts_session_id_event_date_idx" ON "event_facts"("session_id", "event_date");
CREATE INDEX IF NOT EXISTS "event_facts_utm_source_utm_campaign_idx" ON "event_facts"("utm_source", "utm_campaign");

-- Sessions.
CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL,
    "first_seen" TIMESTAMP(3),
    "last_seen" TIMESTAMP(3),
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "referrer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- Order attribution.
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "session_id" TEXT,
  ADD COLUMN IF NOT EXISTS "user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "utm_source" TEXT,
  ADD COLUMN IF NOT EXISTS "utm_medium" TEXT,
  ADD COLUMN IF NOT EXISTS "utm_campaign" TEXT,
  ADD COLUMN IF NOT EXISTS "referrer" TEXT;

CREATE INDEX IF NOT EXISTS "Order_session_id_idx" ON "Order"("session_id");
CREATE INDEX IF NOT EXISTS "Order_utm_source_utm_campaign_idx" ON "Order"("utm_source", "utm_campaign");

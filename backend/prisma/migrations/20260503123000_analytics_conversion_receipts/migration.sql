-- CreateTable
CREATE TABLE "analytics_conversion_receipts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL DEFAULT 'global',
    "internal_event_name" TEXT NOT NULL,
    "canonical_conversion_name" TEXT NOT NULL,
    "ads_conversion_action" TEXT,
    "ads_conversion_resource" TEXT,
    "transaction_id" TEXT,
    "event_id" TEXT,
    "gclid" TEXT,
    "wbraid" TEXT,
    "gbraid" TEXT,
    "user_identifiers" JSONB,
    "value" DECIMAL(18,4),
    "currency" TEXT,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "dedupe_key" TEXT NOT NULL,
    "request_payload" JSONB NOT NULL,
    "response_payload" JSONB,
    "error_message" TEXT,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_attempt_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_conversion_receipts_dedupe_key_key" ON "analytics_conversion_receipts"("dedupe_key");

-- CreateIndex
CREATE INDEX "analytics_conversion_receipts_tenant_id_status_idx" ON "analytics_conversion_receipts"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "analytics_conversion_receipts_tenant_id_canonical_conversion_name_idx" ON "analytics_conversion_receipts"("tenant_id", "canonical_conversion_name");

-- CreateIndex
CREATE INDEX "analytics_conversion_receipts_created_at_idx" ON "analytics_conversion_receipts"("created_at");


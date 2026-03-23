-- Add support for sales document metadata (budgets) and item attributes

-- Create document type enum if it does not exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentType') THEN
        CREATE TYPE "DocumentType" AS ENUM ('ORDER', 'BUDGET');
    END IF;
END
$$;

-- Extend orders table with budget-specific metadata
ALTER TABLE "public"."Order"
    ADD COLUMN IF NOT EXISTS "documentType" "DocumentType" NOT NULL DEFAULT 'ORDER',
    ADD COLUMN IF NOT EXISTS "currencySnapshot" TEXT,
    ADD COLUMN IF NOT EXISTS "taxRateSnapshot" DECIMAL(18,4),
    ADD COLUMN IF NOT EXISTS "priceListIdSnapshot" INTEGER,
    ADD COLUMN IF NOT EXISTS "exchangeRateSnapshot" JSONB,
    ADD COLUMN IF NOT EXISTS "validUntil" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "originId" INTEGER,
    ADD COLUMN IF NOT EXISTS "convertedOrderId" INTEGER,
    ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "convertedBy" INTEGER,
    ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

-- Extend order items with custom attributes and snapshots
ALTER TABLE "public"."OrderItem"
    ADD COLUMN IF NOT EXISTS "customAttributes" JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS "pricingMethodSnapshot" "SalesUnit",
    ADD COLUMN IF NOT EXISTS "unitPriceSnapshot" DECIMAL(18,4),
    ADD COLUMN IF NOT EXISTS "skuSnapshot" TEXT,
    ADD COLUMN IF NOT EXISTS "nameSnapshot" TEXT,
    ADD COLUMN IF NOT EXISTS "specSummary" TEXT,
    ADD COLUMN IF NOT EXISTS "specJson" JSONB DEFAULT '{}'::jsonb;

-- Ensure JSON fields are initialised
UPDATE "public"."OrderItem"
SET "customAttributes" = '{}'::jsonb
WHERE "customAttributes" IS NULL;

UPDATE "public"."OrderItem"
SET "specJson" = '{}'::jsonb
WHERE "specJson" IS NULL;

-- Add indexes to optimise document queries
CREATE INDEX IF NOT EXISTS "Order_documentType_statusId_customerId_createdAt_idx"
    ON "public"."Order"("documentType", "statusId", "customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_documentType_createdAt_idx"
    ON "public"."Order"("documentType", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_validUntil_idx"
    ON "public"."Order"("validUntil");

-- Add uniqueness guarantees for budget conversions
ALTER TABLE "public"."Order"
    ADD CONSTRAINT "Order_originId_key" UNIQUE ("originId")
    DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "public"."Order"
    ADD CONSTRAINT "Order_convertedOrderId_key" UNIQUE ("convertedOrderId")
    DEFERRABLE INITIALLY IMMEDIATE;

-- Add foreign keys for conversion references
ALTER TABLE "public"."Order"
    ADD CONSTRAINT "Order_originId_fkey"
        FOREIGN KEY ("originId") REFERENCES "public"."Order"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."Order"
    ADD CONSTRAINT "Order_convertedOrderId_fkey"
        FOREIGN KEY ("convertedOrderId") REFERENCES "public"."Order"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."Order"
    ADD CONSTRAINT "Order_convertedBy_fkey"
        FOREIGN KEY ("convertedBy") REFERENCES "public"."User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;

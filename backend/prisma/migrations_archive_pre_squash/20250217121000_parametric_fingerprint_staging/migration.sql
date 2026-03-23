DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'dimension_price_matrix'
    ) THEN
        CREATE TABLE "dimension_price_matrix" (
            "id" SERIAL PRIMARY KEY,
            "productId" INTEGER NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
            "fingerprint" TEXT,
            "option_state" TEXT NOT NULL DEFAULT 'BASE',
            "familyId" TEXT NOT NULL,
            "serie" TEXT NOT NULL,
            "material" TEXT NOT NULL,
            "color" TEXT NOT NULL,
            "vidrio" TEXT NOT NULL,
            "widthMm" INTEGER NOT NULL,
            "heightMm" INTEGER NOT NULL,
            "hasMosquitero" BOOLEAN NOT NULL DEFAULT FALSE,
            "hasShutterMonoblock" BOOLEAN NOT NULL DEFAULT FALSE,
            "shutterSystem" TEXT NOT NULL DEFAULT '',
            "price" DECIMAL(14,4) NOT NULL DEFAULT 0,
            "priceBase" DECIMAL(14,4),
            "priceMosquitero" DECIMAL(14,4),
            "priceMonoblock" DECIMAL(14,4),
            "priceMonoblockMosquitero" DECIMAL(14,4),
            "hasMosquiteroOption" BOOLEAN NOT NULL DEFAULT FALSE,
            "hasMonoblockOption" BOOLEAN NOT NULL DEFAULT FALSE,
            "currency" TEXT NOT NULL DEFAULT 'USD',
            "detailSnapshot" TEXT,
            "price_lineage" JSONB,
            "conflict_flags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
            "source" TEXT,
            "reference_date" TIMESTAMP,
            "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
            "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE INDEX "dimension_price_matrix_product_idx"
            ON "dimension_price_matrix" ("productId");
    END IF;
END $$;

-- Add new columns for fingerprint-based identity and metadata
ALTER TABLE "dimension_price_matrix"
ADD COLUMN IF NOT EXISTS "fingerprint" TEXT,
ADD COLUMN IF NOT EXISTS "option_state" TEXT NOT NULL DEFAULT 'BASE',
ADD COLUMN IF NOT EXISTS "price_lineage" JSONB,
ADD COLUMN IF NOT EXISTS "conflict_flags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill fingerprint and option state for existing rows
UPDATE "dimension_price_matrix"
SET "fingerprint" = md5(
  lower(coalesce("familyId", '')) || '|' ||
  lower(coalesce("serie", '')) || '|' ||
  lower(coalesce("color", '')) || '|' ||
  lower(coalesce("vidrio", '')) || '|' ||
  coalesce("widthMm"::text, '0') || '|' ||
  coalesce("heightMm"::text, '0')
);

UPDATE "dimension_price_matrix"
SET "option_state" = CASE
  WHEN "hasShutterMonoblock" THEN
    'SHUTTER_' || upper(coalesce(nullif(btrim("shutterSystem"), ''), 'GENERIC'))
  ELSE
    'BASE'
END;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'dimension_price_matrix'
          AND column_name = 'fingerprint'
          AND is_nullable = 'YES'
    ) THEN
        ALTER TABLE "dimension_price_matrix"
        ALTER COLUMN "fingerprint" SET NOT NULL;
    END IF;
END $$;

-- Replace the previous composite unique key with the fingerprint-based key
ALTER TABLE "dimension_price_matrix"
DROP CONSTRAINT IF EXISTS "dimension_price_matrix_productId_serie_material_color_vidrio_widthMm_heightMm_hasMosquitero_hasShutterMonoblock_shutterSystem_key";

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'dimension_price_matrix_product_fingerprint_option_state_key'
    ) THEN
        ALTER TABLE "dimension_price_matrix"
        ADD CONSTRAINT "dimension_price_matrix_product_fingerprint_option_state_key"
        UNIQUE ("productId", "fingerprint", "option_state");
    END IF;
END $$;

-- Create staging table for multi-source ingestion
CREATE TABLE "parametric_matrix_staging" (
  "id" SERIAL PRIMARY KEY,
  "productId" INTEGER NOT NULL REFERENCES "Product"("id") ON DELETE CASCADE,
  "fingerprint" TEXT NOT NULL,
  "option_state" TEXT NOT NULL DEFAULT 'BASE',
  "familyId" TEXT NOT NULL,
  "serie" TEXT NOT NULL,
  "material" TEXT NOT NULL,
  "color" TEXT NOT NULL,
  "vidrio" TEXT NOT NULL,
  "widthMm" INTEGER NOT NULL,
  "heightMm" INTEGER NOT NULL,
  "hasMosquitero" BOOLEAN NOT NULL DEFAULT FALSE,
  "hasShutterMonoblock" BOOLEAN NOT NULL DEFAULT FALSE,
  "shutterSystem" TEXT NOT NULL DEFAULT '',
  "hasMosquiteroOption" BOOLEAN NOT NULL DEFAULT FALSE,
  "hasMonoblockOption" BOOLEAN NOT NULL DEFAULT FALSE,
  "priceBase" DECIMAL(14,4),
  "priceMosquitero" DECIMAL(14,4),
  "priceMonoblock" DECIMAL(14,4),
  "priceMonoblockMosquitero" DECIMAL(14,4),
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "specifications" TEXT,
  "sourceSystem" TEXT NOT NULL,
  "sourceRecordId" TEXT,
  "source" TEXT,
  "reference_date" TIMESTAMP,
  "ingestedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "processedAt" TIMESTAMP,
  "payload" JSONB
);

CREATE INDEX "parametric_matrix_staging_product_processed_idx"
  ON "parametric_matrix_staging" ("productId", "processedAt");

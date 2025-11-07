-- Ensure fingerprint / option_state columns exist on dimension_price_matrix
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dimension_price_matrix'
      AND column_name = 'fingerprint'
  ) THEN
    ALTER TABLE "dimension_price_matrix"
      ADD COLUMN "fingerprint" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dimension_price_matrix'
      AND column_name = 'option_state'
  ) THEN
    ALTER TABLE "dimension_price_matrix"
      ADD COLUMN "option_state" TEXT NOT NULL DEFAULT 'BASE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dimension_price_matrix'
      AND column_name = 'price_lineage'
  ) THEN
    ALTER TABLE "dimension_price_matrix"
      ADD COLUMN "price_lineage" JSONB;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'dimension_price_matrix'
      AND column_name = 'conflict_flags'
  ) THEN
    ALTER TABLE "dimension_price_matrix"
      ADD COLUMN "conflict_flags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
  END IF;
END $$;

-- Backfill fingerprint / option_state when missing
UPDATE "dimension_price_matrix"
SET "fingerprint" = md5(
      lower(coalesce("familyId", '')) || '|' ||
      lower(coalesce("serie", '')) || '|' ||
      lower(coalesce("color", '')) || '|' ||
      lower(coalesce("vidrio", '')) || '|' ||
      coalesce("widthMm"::text, '0') || '|' ||
      coalesce("heightMm"::text, '0')
    )
WHERE "fingerprint" IS NULL;

UPDATE "dimension_price_matrix"
SET "option_state" = CASE
  WHEN "hasShutterMonoblock" THEN
    'SHUTTER_' || upper(coalesce(nullif(btrim("shutterSystem"), ''), 'GENERIC'))
  ELSE
    'BASE'
END
WHERE "option_state" IS NULL OR "option_state" = '';

ALTER TABLE "dimension_price_matrix"
  ALTER COLUMN "fingerprint" SET NOT NULL;

-- Replace legacy unique constraint with the fingerprint-based one
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dimension_price_matrix_productId_serie_material_color_vidrio_widthMm_heightMm_hasMosquitero_hasShutterMonoblock_shutterSystem_key'
  ) THEN
    ALTER TABLE "dimension_price_matrix"
      DROP CONSTRAINT "dimension_price_matrix_productId_serie_material_color_vidrio_widthMm_heightMm_hasMosquitero_hasShutterMonoblock_shutterSystem_key";
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'dimension_price_matrix_product_fingerprint_option_state_key'
  ) THEN
    ALTER TABLE "dimension_price_matrix"
      ADD CONSTRAINT "dimension_price_matrix_product_fingerprint_option_state_key"
      UNIQUE ("productId", "fingerprint", "option_state");
  END IF;
END $$;

-- Create staging table for multi-source ingestion if it does not exist
CREATE TABLE IF NOT EXISTS "parametric_matrix_staging" (
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

CREATE INDEX IF NOT EXISTS "parametric_matrix_staging_product_processed_idx"
  ON "parametric_matrix_staging" ("productId", "processedAt");

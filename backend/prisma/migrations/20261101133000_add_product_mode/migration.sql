-- Ensure ProductMode enum exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'ProductMode'
  ) THEN
    CREATE TYPE "ProductMode" AS ENUM ('SIMPLE', 'VARIABLE', 'PARAMETRIC');
  END IF;
END
$$;

-- Ensure Product.mode column exists and is populated
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Product'
      AND column_name = 'mode'
  ) THEN
    ALTER TABLE "Product"
      ADD COLUMN "mode" "ProductMode" NOT NULL DEFAULT 'SIMPLE';
  END IF;
END
$$;

UPDATE "Product"
SET "mode" = 'SIMPLE'
WHERE "mode" IS NULL;

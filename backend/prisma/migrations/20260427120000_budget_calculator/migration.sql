-- Add budget calculator flags to products
ALTER TABLE "Product"
ADD COLUMN "calculationStrategy" TEXT NOT NULL DEFAULT 'M2';

ALTER TABLE "Product"
ADD COLUMN "isBudgetCalculable" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing public square-meter products for the urucortinas tenant
UPDATE "Product"
SET "isBudgetCalculable" = true
WHERE "unitOfMeasure" = 'SQUARE_METER'
  AND "published" = true
  AND "productType" = 'PHYSICAL';

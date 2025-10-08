-- Add cost and sale price columns with required precision
ALTER TABLE "Product" RENAME COLUMN "price" TO "precio_venta";

ALTER TABLE "Product"
  ALTER COLUMN "precio_venta" TYPE DECIMAL(12, 2)
  USING ROUND(("precio_venta")::numeric, 2),
  ALTER COLUMN "precio_venta" SET DEFAULT 0,
  ALTER COLUMN "precio_venta" SET NOT NULL;

ALTER TABLE "Product"
  ADD COLUMN "precio_costo" DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- Recalculate sale price (+30%) and backfill cost price with legacy value
UPDATE "Product"
SET
  "precio_costo" = ROUND(("precio_venta")::numeric, 2),
  "precio_venta" = ROUND((("precio_venta")::numeric * 1.30), 2);

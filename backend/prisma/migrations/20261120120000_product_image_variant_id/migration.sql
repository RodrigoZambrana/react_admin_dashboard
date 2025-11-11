-- Ensure product images can be linked to specific product variants
ALTER TABLE "ProductImage"
    ADD COLUMN IF NOT EXISTS "variantId" INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = 'ProductImage_variantId_fkey'
          AND table_name = 'ProductImage'
    ) THEN
        ALTER TABLE "ProductImage"
            ADD CONSTRAINT "ProductImage_variantId_fkey"
                FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
                ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ProductImage_productId_variantId_idx"
    ON "ProductImage" ("productId", "variantId");

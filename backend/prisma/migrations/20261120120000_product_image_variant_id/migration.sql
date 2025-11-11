-- Ensure product images can be linked to specific product variants
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'ProductVariant'
    ) THEN
        ALTER TABLE "ProductImage"
            ADD COLUMN IF NOT EXISTS "variantId" INTEGER;

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

        CREATE INDEX IF NOT EXISTS "ProductImage_productId_variantId_idx"
            ON "ProductImage" ("productId", "variantId");
    ELSE
        RAISE NOTICE 'Skipping ProductImage variant linkage migration because ProductVariant table does not exist';
    END IF;
END $$;

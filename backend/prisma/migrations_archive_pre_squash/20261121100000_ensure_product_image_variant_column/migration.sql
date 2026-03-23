DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'ProductImage'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'ProductImage'
          AND column_name = 'variantId'
    ) THEN
        ALTER TABLE "ProductImage"
            ADD COLUMN "variantId" INTEGER;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_name = 'ProductVariant'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'ProductImage'
          AND constraint_name = 'ProductImage_variantId_fkey'
    ) THEN
        ALTER TABLE "ProductImage"
            ADD CONSTRAINT "ProductImage_variantId_fkey"
                FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
                ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = current_schema()
          AND indexname = 'ProductImage_productId_variantId_idx'
    ) THEN
        IF EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_name = 'ProductImage'
        ) THEN
            CREATE INDEX "ProductImage_productId_variantId_idx"
                ON "ProductImage" ("productId", "variantId");
        END IF;
    END IF;
END $$;

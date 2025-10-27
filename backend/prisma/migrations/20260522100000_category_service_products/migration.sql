CREATE TYPE "ProductType" AS ENUM ('PHYSICAL', 'SERVICE');

ALTER TABLE "public"."Product"
  ADD COLUMN "productType" "ProductType" NOT NULL DEFAULT 'PHYSICAL';

ALTER TABLE "public"."ProductCategory"
  ADD COLUMN "installServiceProductId" INTEGER;

ALTER TABLE "public"."ProductCategory"
  ADD CONSTRAINT "ProductCategory_installServiceProductId_fkey"
  FOREIGN KEY ("installServiceProductId")
  REFERENCES "public"."Product"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ProductCategory_installServiceProductId_key"
  ON "public"."ProductCategory"("installServiceProductId");

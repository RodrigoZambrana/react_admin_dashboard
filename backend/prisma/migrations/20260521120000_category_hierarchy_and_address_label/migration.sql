ALTER TABLE "public"."ProductCategory" ADD COLUMN "description" TEXT;
ALTER TABLE "public"."ProductCategory" ADD COLUMN "image" TEXT;
ALTER TABLE "public"."ProductCategory" ADD COLUMN "parentId" INTEGER;

ALTER TABLE "public"."ProductCategory"
  ADD CONSTRAINT "ProductCategory_parentId_fkey"
  FOREIGN KEY ("parentId")
  REFERENCES "public"."ProductCategory"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "ProductCategory_parentId_idx" ON "public"."ProductCategory"("parentId");

ALTER TABLE "public"."CustomerAddress" ADD COLUMN "label" TEXT;

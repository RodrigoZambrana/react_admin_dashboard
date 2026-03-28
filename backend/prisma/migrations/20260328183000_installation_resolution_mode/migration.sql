CREATE TYPE "InstallationResolutionMode" AS ENUM (
  'INCLUDED',
  'OPTIONAL_ADD_ON',
  'SEPARATE_SERVICE',
  'NOT_OFFERED',
  'UNKNOWN'
);

CREATE TYPE "InstallationChargeScope" AS ENUM (
  'PER_QUOTE',
  'MATCH_PRODUCT_QUANTITY',
  'MATCH_PRODUCT_MEASUREMENTS'
);

ALTER TABLE "Product"
ADD COLUMN "installationResolutionMode" "InstallationResolutionMode",
ADD COLUMN "installationChargeScope" "InstallationChargeScope",
ADD COLUMN "installServiceProductId" INTEGER;

ALTER TABLE "ProductCategory"
ADD COLUMN "installationResolutionMode" "InstallationResolutionMode",
ADD COLUMN "installationChargeScope" "InstallationChargeScope";

CREATE INDEX "Product_installServiceProductId_idx"
ON "Product"("installServiceProductId");

ALTER TABLE "Product"
ADD CONSTRAINT "Product_installServiceProductId_fkey"
FOREIGN KEY ("installServiceProductId") REFERENCES "Product"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "ProductCategory"
SET "installationResolutionMode" = 'OPTIONAL_ADD_ON'
WHERE "installServiceProductId" IS NOT NULL
  AND "installationResolutionMode" IS NULL;

UPDATE "ProductCategory"
SET "installationChargeScope" = 'PER_QUOTE'
WHERE "installServiceProductId" IS NOT NULL
  AND "installationChargeScope" IS NULL;

-- CreateEnum
CREATE TYPE "CatalogExposureMode" AS ENUM ('AUTO', 'M2_DERIVED', 'UNITARY', 'EMPTY_IF_NO_PUBLIC_CALCULABLE');

-- AlterTable
ALTER TABLE "ProductCategory"
ADD COLUMN "catalogExposureMode" "CatalogExposureMode";

-- Backfill canonical exposure modes for the urucortinas catalog
UPDATE "ProductCategory"
SET "catalogExposureMode" = 'M2_DERIVED'
WHERE lower("name") IN ('cortinas', 'cortinas de enrollar', 'paneles tradicionales');

UPDATE "ProductCategory"
SET "catalogExposureMode" = 'EMPTY_IF_NO_PUBLIC_CALCULABLE'
WHERE lower("name") = 'cortinas metalicas';

UPDATE "ProductCategory"
SET "catalogExposureMode" = 'UNITARY'
WHERE lower("name") = 'motores cortinas y persianas';

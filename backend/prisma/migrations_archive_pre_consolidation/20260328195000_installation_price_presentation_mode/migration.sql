CREATE TYPE "InstallationPricePresentationMode" AS ENUM (
  'EXACT',
  'FROM_BASE',
  'HIDDEN'
);

ALTER TABLE "Product"
ADD COLUMN "installationPricePresentationMode" "InstallationPricePresentationMode";

ALTER TABLE "ProductCategory"
ADD COLUMN "installationPricePresentationMode" "InstallationPricePresentationMode";

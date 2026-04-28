ALTER TABLE "ProductCategory"
ADD COLUMN "seoTitle" TEXT,
ADD COLUMN "seoDescription" TEXT,
ADD COLUMN "seoImageUrl" TEXT;

ALTER TABLE "CmsPage"
ADD COLUMN "seoImageUrl" TEXT;

CREATE TYPE "CmsEntryStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "CmsEntryAssetType" AS ENUM ('IMAGE', 'VIDEO', 'EMBED');

CREATE TABLE "CmsSection" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CmsEntry" (
    "id" SERIAL NOT NULL,
    "sectionId" INTEGER NOT NULL,
    "slug" TEXT,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "payload" JSONB,
    "locale" TEXT NOT NULL DEFAULT 'es',
    "status" "CmsEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "thumbnailUrl" TEXT,
    "ctaLabel" TEXT,
    "ctaUrl" TEXT,
    "productId" INTEGER,
    "categoryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CmsEntryAsset" (
    "id" SERIAL NOT NULL,
    "entryId" INTEGER NOT NULL,
    "title" TEXT,
    "caption" TEXT,
    "mediaType" "CmsEntryAssetType" NOT NULL DEFAULT 'IMAGE',
    "mediaUrl" TEXT NOT NULL,
    "posterUrl" TEXT,
    "externalUrl" TEXT,
    "durationSec" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CmsEntryAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CmsSection_key_key" ON "CmsSection"("key");
CREATE INDEX "CmsSection_isActive_sortOrder_idx" ON "CmsSection"("isActive", "sortOrder");
CREATE UNIQUE INDEX "CmsEntry_sectionId_locale_slug_key" ON "CmsEntry"("sectionId", "locale", "slug");
CREATE INDEX "CmsEntry_sectionId_status_isActive_priority_idx" ON "CmsEntry"("sectionId", "status", "isActive", "priority");
CREATE INDEX "CmsEntry_productId_idx" ON "CmsEntry"("productId");
CREATE INDEX "CmsEntry_categoryId_idx" ON "CmsEntry"("categoryId");
CREATE INDEX "CmsEntry_publishedAt_idx" ON "CmsEntry"("publishedAt");
CREATE INDEX "CmsEntryAsset_entryId_isActive_sortOrder_idx" ON "CmsEntryAsset"("entryId", "isActive", "sortOrder");

ALTER TABLE "CmsEntry"
ADD CONSTRAINT "CmsEntry_sectionId_fkey"
FOREIGN KEY ("sectionId") REFERENCES "CmsSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CmsEntry"
ADD CONSTRAINT "CmsEntry_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CmsEntry"
ADD CONSTRAINT "CmsEntry_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CmsEntryAsset"
ADD CONSTRAINT "CmsEntryAsset_entryId_fkey"
FOREIGN KEY ("entryId") REFERENCES "CmsEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "Product_storyEnabled_storyPriority_idx";

ALTER TABLE "Product"
DROP COLUMN IF EXISTS "storyEnabled",
DROP COLUMN IF EXISTS "storyPriority";

DROP TABLE IF EXISTS "ProductStoryAsset";

DROP TYPE IF EXISTS "ProductStoryAssetType";

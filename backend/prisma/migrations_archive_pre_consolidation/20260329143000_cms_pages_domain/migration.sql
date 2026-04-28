CREATE TYPE "CmsPageSectionType" AS ENUM (
  'HERO',
  'FEATURE_GRID',
  'MEDIA_GRID',
  'FAQ',
  'RICH_TEXT',
  'CTA_BANNER'
);

CREATE TYPE "CmsPageBlockType" AS ENUM (
  'TEXT',
  'IMAGE',
  'BUTTON',
  'LIST_ITEM',
  'RICH_TEXT',
  'FAQ_ITEM',
  'CARD'
);

CREATE TYPE "CmsMediaType" AS ENUM (
  'IMAGE',
  'VIDEO',
  'DOCUMENT',
  'EMBED',
  'AUDIO'
);

CREATE TABLE "CmsPage" (
  "id" SERIAL NOT NULL,
  "path" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'es',
  "status" "CmsEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "layoutKey" TEXT,
  "legacySource" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CmsPage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CmsPageSection" (
  "id" SERIAL NOT NULL,
  "pageId" INTEGER NOT NULL,
  "type" "CmsPageSectionType" NOT NULL,
  "key" TEXT,
  "name" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "settings" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CmsPageSection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CmsMedia" (
  "id" SERIAL NOT NULL,
  "url" TEXT NOT NULL,
  "type" "CmsMediaType" NOT NULL DEFAULT 'IMAGE',
  "alt" TEXT,
  "title" TEXT,
  "mimeType" TEXT,
  "fileName" TEXT,
  "sizeBytes" INTEGER,
  "width" INTEGER,
  "height" INTEGER,
  "source" TEXT,
  "metadata" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CmsMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CmsPageBlock" (
  "id" SERIAL NOT NULL,
  "sectionId" INTEGER NOT NULL,
  "type" "CmsPageBlockType" NOT NULL,
  "key" TEXT,
  "name" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "visible" BOOLEAN NOT NULL DEFAULT true,
  "content" JSONB,
  "mediaId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CmsPageBlock_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CmsPage_path_key" ON "CmsPage"("path");
CREATE INDEX "CmsPage_status_locale_visible_idx" ON "CmsPage"("status", "locale", "visible");
CREATE INDEX "CmsPageSection_pageId_sortOrder_visible_idx" ON "CmsPageSection"("pageId", "sortOrder", "visible");
CREATE INDEX "CmsMedia_type_isActive_createdAt_idx" ON "CmsMedia"("type", "isActive", "createdAt");
CREATE INDEX "CmsPageBlock_sectionId_sortOrder_visible_idx" ON "CmsPageBlock"("sectionId", "sortOrder", "visible");
CREATE INDEX "CmsPageBlock_mediaId_idx" ON "CmsPageBlock"("mediaId");

ALTER TABLE "CmsPageSection"
ADD CONSTRAINT "CmsPageSection_pageId_fkey"
FOREIGN KEY ("pageId") REFERENCES "CmsPage"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CmsPageBlock"
ADD CONSTRAINT "CmsPageBlock_sectionId_fkey"
FOREIGN KEY ("sectionId") REFERENCES "CmsPageSection"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CmsPageBlock"
ADD CONSTRAINT "CmsPageBlock_mediaId_fkey"
FOREIGN KEY ("mediaId") REFERENCES "CmsMedia"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TYPE "CmsPageSectionType" ADD VALUE IF NOT EXISTS 'CONTENT_SPLIT';

CREATE TABLE "CmsPageAlias" (
  "id" SERIAL NOT NULL,
  "pageId" INTEGER NOT NULL,
  "path" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CmsPageAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CmsPageAlias_path_key" ON "CmsPageAlias"("path");
CREATE INDEX "CmsPageAlias_pageId_idx" ON "CmsPageAlias"("pageId");

ALTER TABLE "CmsPageAlias"
ADD CONSTRAINT "CmsPageAlias_pageId_fkey"
FOREIGN KEY ("pageId") REFERENCES "CmsPage"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

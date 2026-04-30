-- Multi-tenant CMS support for pages, sections, blocks, and aliases.

ALTER TABLE "CmsPage" ADD COLUMN IF NOT EXISTS "tenantKey" TEXT;
ALTER TABLE "CmsPageAlias" ADD COLUMN IF NOT EXISTS "tenantKey" TEXT;
ALTER TABLE "CmsPageSection" ADD COLUMN IF NOT EXISTS "tenantKey" TEXT;
ALTER TABLE "CmsPageBlock" ADD COLUMN IF NOT EXISTS "tenantKey" TEXT;

DROP INDEX IF EXISTS "CmsPage_path_key";
DROP INDEX IF EXISTS "CmsPageAlias_path_key";

CREATE INDEX IF NOT EXISTS "CmsPage_tenantKey_scope_status_locale_visible_idx"
  ON "CmsPage"("tenantKey", "scope", "status", "locale", "visible");

CREATE INDEX IF NOT EXISTS "CmsPage_tenantKey_path_idx"
  ON "CmsPage"("tenantKey", "path");

CREATE INDEX IF NOT EXISTS "CmsPage_path_idx"
  ON "CmsPage"("path");

CREATE INDEX IF NOT EXISTS "CmsPageAlias_tenantKey_path_idx"
  ON "CmsPageAlias"("tenantKey", "path");

CREATE INDEX IF NOT EXISTS "CmsPageSection_tenantKey_pageId_sortOrder_visible_idx"
  ON "CmsPageSection"("tenantKey", "pageId", "sortOrder", "visible");

CREATE INDEX IF NOT EXISTS "CmsPageBlock_tenantKey_sectionId_sortOrder_visible_idx"
  ON "CmsPageBlock"("tenantKey", "sectionId", "sortOrder", "visible");

CREATE UNIQUE INDEX IF NOT EXISTS "CmsPage_global_path_unique"
  ON "CmsPage"("path")
  WHERE "tenantKey" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CmsPage_tenantKey_path_unique"
  ON "CmsPage"("tenantKey", "path")
  WHERE "tenantKey" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CmsPageAlias_global_path_unique"
  ON "CmsPageAlias"("path")
  WHERE "tenantKey" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CmsPageAlias_tenantKey_path_unique"
  ON "CmsPageAlias"("tenantKey", "path")
  WHERE "tenantKey" IS NOT NULL;

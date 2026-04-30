-- Remove tenant-scoped CMS fields. This project is instance-scoped, not shared multi-tenant.

DROP INDEX IF EXISTS "CmsPage_tenantKey_scope_status_locale_visible_idx";
DROP INDEX IF EXISTS "CmsPage_tenantKey_path_idx";
DROP INDEX IF EXISTS "CmsPageAlias_tenantKey_path_idx";
DROP INDEX IF EXISTS "CmsPageSection_tenantKey_pageId_sortOrder_visible_idx";
DROP INDEX IF EXISTS "CmsPageBlock_tenantKey_sectionId_sortOrder_visible_idx";
DROP INDEX IF EXISTS "CmsPage_global_path_unique";
DROP INDEX IF EXISTS "CmsPage_tenantKey_path_unique";
DROP INDEX IF EXISTS "CmsPageAlias_global_path_unique";
DROP INDEX IF EXISTS "CmsPageAlias_tenantKey_path_unique";

ALTER TABLE "CmsPage" DROP COLUMN IF EXISTS "tenantKey";
ALTER TABLE "CmsPageAlias" DROP COLUMN IF EXISTS "tenantKey";
ALTER TABLE "CmsPageSection" DROP COLUMN IF EXISTS "tenantKey";
ALTER TABLE "CmsPageBlock" DROP COLUMN IF EXISTS "tenantKey";

CREATE UNIQUE INDEX IF NOT EXISTS "CmsPage_path_key" ON "CmsPage"("path");
CREATE UNIQUE INDEX IF NOT EXISTS "CmsPageAlias_path_key" ON "CmsPageAlias"("path");

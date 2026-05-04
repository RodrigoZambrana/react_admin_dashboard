-- CreateEnum
CREATE TYPE "SeoEntityType" AS ENUM ('PRODUCT', 'CANONICAL', 'CATEGORY');

-- CreateTable
CREATE TABLE "SeoMetadata" (
    "id" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'global',
    "entityType" "SeoEntityType" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ogTitle" TEXT,
    "ogDescription" TEXT,
    "ogImage" TEXT,
    "canonicalUrl" TEXT,
    "robots" TEXT,
    "schemaType" TEXT,
    "schemaPayload" JSONB,
    "searchTerms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "language" TEXT NOT NULL DEFAULT 'es',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeoMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seo_metadata_tenant_entity_language_unique" ON "SeoMetadata"("tenantId", "entityType", "entityId", "language");

-- CreateIndex
CREATE UNIQUE INDEX "seo_metadata_tenant_slug_language_unique" ON "SeoMetadata"("tenantId", "slug", "language");

-- CreateIndex
CREATE INDEX "seo_metadata_entity_lookup_idx" ON "SeoMetadata"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "seo_metadata_tenant_entity_slug_idx" ON "SeoMetadata"("tenantId", "entityType", "slug");

-- CreateEnum
CREATE TYPE "CatalogSourceKind" AS ENUM ('UPLOADED_STRUCTURED', 'REST');

-- CreateEnum
CREATE TYPE "CatalogSyncStatus" AS ENUM ('PENDING', 'SYNCING', 'READY', 'FAILED');

-- AlterEnum
ALTER TYPE "DocumentOriginKind" ADD VALUE 'URL';

-- CreateTable
CREATE TABLE "CatalogSourceRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "CatalogSourceKind" NOT NULL,
    "status" "ManagedResourceStatus" NOT NULL DEFAULT 'DRAFT',
    "syncStatus" "CatalogSyncStatus" NOT NULL DEFAULT 'PENDING',
    "sourceName" TEXT,
    "mimeType" TEXT,
    "endpointUrl" TEXT,
    "sourceConfig" JSONB,
    "metadata" JSONB,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogSourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItemRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT,
    "availability" TEXT,
    "attributes" JSONB,
    "searchText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItemRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CatalogSourceRecord_tenantId_status_createdAt_idx" ON "CatalogSourceRecord"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CatalogSourceRecord_tenantId_kind_status_createdAt_idx" ON "CatalogSourceRecord"("tenantId", "kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CatalogItemRecord_tenantId_sourceId_createdAt_idx" ON "CatalogItemRecord"("tenantId", "sourceId", "createdAt");

-- CreateIndex
CREATE INDEX "CatalogItemRecord_tenantId_sku_idx" ON "CatalogItemRecord"("tenantId", "sku");

-- CreateIndex
CREATE INDEX "CatalogItemRecord_tenantId_name_idx" ON "CatalogItemRecord"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "CatalogItemRecord" ADD CONSTRAINT "CatalogItemRecord_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CatalogSourceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

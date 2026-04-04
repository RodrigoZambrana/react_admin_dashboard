-- CreateTable
CREATE TABLE "ResponseFallbackVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ManagedResourceStatus" NOT NULL DEFAULT 'DRAFT',
    "resource" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "ResponseFallbackVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResponseFallbackVersion_tenantId_locale_status_idx" ON "ResponseFallbackVersion"("tenantId", "locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseFallbackVersion_tenantId_locale_version_key" ON "ResponseFallbackVersion"("tenantId", "locale", "version");

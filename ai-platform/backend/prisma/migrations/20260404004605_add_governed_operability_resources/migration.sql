-- CreateTable
CREATE TABLE "CriticalConfigVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ManagedResourceStatus" NOT NULL DEFAULT 'DRAFT',
    "value" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "CriticalConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeMetadataVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ManagedResourceStatus" NOT NULL DEFAULT 'DRAFT',
    "resource" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "KnowledgeMetadataVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CriticalConfigVersion_tenantId_key_status_idx" ON "CriticalConfigVersion"("tenantId", "key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CriticalConfigVersion_tenantId_key_version_key" ON "CriticalConfigVersion"("tenantId", "key", "version");

-- CreateIndex
CREATE INDEX "KnowledgeMetadataVersion_tenantId_key_status_idx" ON "KnowledgeMetadataVersion"("tenantId", "key", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeMetadataVersion_tenantId_key_version_key" ON "KnowledgeMetadataVersion"("tenantId", "key", "version");

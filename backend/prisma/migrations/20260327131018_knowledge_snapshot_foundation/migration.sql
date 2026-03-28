-- CreateEnum
CREATE TYPE "KnowledgeSnapshotStatus" AS ENUM ('BUILDING', 'READY', 'FAILED', 'STALE');

-- CreateEnum
CREATE TYPE "KnowledgeSnapshotEntryType" AS ENUM ('TOPIC_SUMMARY', 'APPROVED_RULE', 'APPROVED_RESPONSE_PATTERN', 'GUARDRAIL_NEGATIVE', 'KNOWN_GAP', 'OPERATIONAL_NOTE');

-- CreateEnum
CREATE TYPE "KnowledgeSnapshotSourceKind" AS ENUM ('KNOWLEDGE_DOCUMENT', 'KNOWLEDGE_CANDIDATE', 'KNOWLEDGE_RAW_EVENT', 'KNOWLEDGE_CONVERSATION_BUNDLE', 'KNOWLEDGE_NEGATIVE_EXAMPLE', 'KNOWLEDGE_FEEDBACK');

-- CreateEnum
CREATE TYPE "KnowledgeSnapshotSourceRole" AS ENUM ('PRIMARY_SUPPORT', 'SECONDARY_SUPPORT', 'GUARDRAIL', 'COUNTEREXAMPLE', 'PENDING_SIGNAL');

-- CreateTable
CREATE TABLE "KnowledgeSnapshot" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "status" "KnowledgeSnapshotStatus" NOT NULL DEFAULT 'BUILDING',
    "version" INTEGER NOT NULL,
    "generationReason" TEXT NOT NULL,
    "summaryText" TEXT,
    "metrics" JSONB,
    "coverageScore" DOUBLE PRECISION,
    "metadata" JSONB,
    "generatedByUserId" INTEGER,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSnapshotEntry" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "entryType" "KnowledgeSnapshotEntryType" NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "plainText" TEXT NOT NULL,
    "normalizedIntent" TEXT,
    "topicKey" TEXT,
    "confidence" DOUBLE PRECISION,
    "priority" TEXT,
    "appliesToChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSnapshotEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeSnapshotSource" (
    "id" TEXT NOT NULL,
    "snapshotEntryId" TEXT NOT NULL,
    "sourceKind" "KnowledgeSnapshotSourceKind" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersion" INTEGER,
    "sourceStatus" TEXT,
    "role" "KnowledgeSnapshotSourceRole" NOT NULL,
    "excerpt" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSnapshotSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeSnapshot_tenantKey_scope_status_generatedAt_idx" ON "KnowledgeSnapshot"("tenantKey", "scope", "status", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeSnapshot_tenantKey_scope_version_key" ON "KnowledgeSnapshot"("tenantKey", "scope", "version");

-- CreateIndex
CREATE INDEX "KnowledgeSnapshotEntry_snapshotId_entryType_idx" ON "KnowledgeSnapshotEntry"("snapshotId", "entryType");

-- CreateIndex
CREATE INDEX "KnowledgeSnapshotEntry_tenantKey_scope_entryType_idx" ON "KnowledgeSnapshotEntry"("tenantKey", "scope", "entryType");

-- CreateIndex
CREATE INDEX "KnowledgeSnapshotEntry_snapshotId_key_idx" ON "KnowledgeSnapshotEntry"("snapshotId", "key");

-- CreateIndex
CREATE INDEX "KnowledgeSnapshotSource_snapshotEntryId_idx" ON "KnowledgeSnapshotSource"("snapshotEntryId");

-- CreateIndex
CREATE INDEX "KnowledgeSnapshotSource_sourceKind_sourceId_idx" ON "KnowledgeSnapshotSource"("sourceKind", "sourceId");

-- AddForeignKey
ALTER TABLE "KnowledgeSnapshot" ADD CONSTRAINT "KnowledgeSnapshot_generatedByUserId_fkey" FOREIGN KEY ("generatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSnapshotEntry" ADD CONSTRAINT "KnowledgeSnapshotEntry_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "KnowledgeSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSnapshotSource" ADD CONSTRAINT "KnowledgeSnapshotSource_snapshotEntryId_fkey" FOREIGN KEY ("snapshotEntryId") REFERENCES "KnowledgeSnapshotEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "KnowledgeDerivedArtifactType" AS ENUM (
  'TOPIC_TAXONOMY',
  'QUOTE_PROFILE_HINTS',
  'MEASUREMENT_CARRIER_TERMS',
  'KEYWORD_LEXICON'
);

-- CreateEnum
CREATE TYPE "KnowledgeDerivedArtifactStatus" AS ENUM (
  'ACTIVE',
  'DISABLED',
  'STALE'
);

-- CreateTable
CREATE TABLE "KnowledgeDerivedArtifact" (
  "id" TEXT NOT NULL,
  "tenantKey" TEXT NOT NULL,
  "scope" "KnowledgeDocumentScope" NOT NULL,
  "type" "KnowledgeDerivedArtifactType" NOT NULL,
  "status" "KnowledgeDerivedArtifactStatus" NOT NULL DEFAULT 'ACTIVE',
  "sourceDocumentId" TEXT NOT NULL,
  "content" JSONB NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeDerivedArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeDerivedArtifact_tenantKey_scope_type_status_idx"
ON "KnowledgeDerivedArtifact"("tenantKey", "scope", "type", "status");

-- CreateIndex
CREATE INDEX "KnowledgeDerivedArtifact_sourceDocumentId_idx"
ON "KnowledgeDerivedArtifact"("sourceDocumentId");

-- AddForeignKey
ALTER TABLE "KnowledgeDerivedArtifact"
ADD CONSTRAINT "KnowledgeDerivedArtifact_sourceDocumentId_fkey"
FOREIGN KEY ("sourceDocumentId") REFERENCES "KnowledgeDocument"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

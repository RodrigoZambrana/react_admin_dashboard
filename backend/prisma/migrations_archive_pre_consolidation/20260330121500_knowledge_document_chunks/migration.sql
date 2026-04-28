CREATE TABLE "KnowledgeDocumentChunk" (
    "id" TEXT NOT NULL,
    "chunkKey" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "charStart" INTEGER NOT NULL,
    "charEnd" INTEGER NOT NULL,
    "charLength" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "vector" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocumentChunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeDocumentChunk_chunkKey_key" ON "KnowledgeDocumentChunk"("chunkKey");
CREATE UNIQUE INDEX "KnowledgeDocumentChunk_documentId_chunkIndex_key" ON "KnowledgeDocumentChunk"("documentId", "chunkIndex");
CREATE INDEX "KnowledgeDocumentChunk_tenantKey_scope_sourceType_idx" ON "KnowledgeDocumentChunk"("tenantKey", "scope", "sourceType");
CREATE INDEX "KnowledgeDocumentChunk_documentId_idx" ON "KnowledgeDocumentChunk"("documentId");
CREATE INDEX "KnowledgeDocumentChunk_provider_model_idx" ON "KnowledgeDocumentChunk"("provider", "model");

ALTER TABLE "KnowledgeDocumentChunk"
ADD CONSTRAINT "KnowledgeDocumentChunk_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

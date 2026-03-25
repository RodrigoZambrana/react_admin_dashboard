CREATE TABLE "KnowledgeDocumentEmbedding" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "vector" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocumentEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeDocumentEmbedding_documentId_key" ON "KnowledgeDocumentEmbedding"("documentId");
CREATE INDEX "KnowledgeDocumentEmbedding_provider_model_idx" ON "KnowledgeDocumentEmbedding"("provider", "model");

ALTER TABLE "KnowledgeDocumentEmbedding"
ADD CONSTRAINT "KnowledgeDocumentEmbedding_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

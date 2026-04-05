-- CreateEnum
CREATE TYPE "DocumentKnowledgeItemKind" AS ENUM ('ENTITY', 'CLAIM');

-- CreateEnum
CREATE TYPE "DocumentKnowledgeSupportClass" AS ENUM ('EXPLICIT_FACT', 'PARTIAL_FACT', 'BOUNDED_INFERENCE');

-- AlterTable
ALTER TABLE "DocumentChunk" ADD COLUMN "retrievalProjection" TEXT;

-- CreateTable
CREATE TABLE "DocumentKnowledgeItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "kind" "DocumentKnowledgeItemKind" NOT NULL,
    "label" TEXT NOT NULL,
    "valueText" TEXT NOT NULL,
    "normalizedValue" TEXT,
    "supportClass" "DocumentKnowledgeSupportClass" NOT NULL,
    "evidenceTextSpan" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentKnowledgeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentKnowledgeItem_tenantId_documentId_chunkId_sequence_idx" ON "DocumentKnowledgeItem"("tenantId", "documentId", "chunkId", "sequence");

-- CreateIndex
CREATE INDEX "DocumentKnowledgeItem_tenantId_kind_label_idx" ON "DocumentKnowledgeItem"("tenantId", "kind", "label");

-- AddForeignKey
ALTER TABLE "DocumentKnowledgeItem" ADD CONSTRAINT "DocumentKnowledgeItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentKnowledgeItem" ADD CONSTRAINT "DocumentKnowledgeItem_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "DocumentChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

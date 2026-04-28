-- CreateEnum
CREATE TYPE "KnowledgeChunkIndexStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "KnowledgeDocument"
ADD COLUMN "chunkCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "chunkIndexAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "chunkIndexError" TEXT,
ADD COLUMN "chunkIndexRequestedAt" TIMESTAMP(3),
ADD COLUMN "chunkIndexStartedAt" TIMESTAMP(3),
ADD COLUMN "chunkIndexStatus" "KnowledgeChunkIndexStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "chunkIndexVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "chunkIndexedAt" TIMESTAMP(3);

-- Backfill completed documents that already have persisted chunks
WITH chunk_stats AS (
  SELECT
    "documentId",
    COUNT(*)::INTEGER AS chunk_count,
    MAX("updatedAt") AS indexed_at
  FROM "KnowledgeDocumentChunk"
  GROUP BY "documentId"
)
UPDATE "KnowledgeDocument" AS d
SET
  "chunkCount" = chunk_stats.chunk_count,
  "chunkIndexedAt" = chunk_stats.indexed_at,
  "chunkIndexStatus" = 'COMPLETED'
FROM chunk_stats
WHERE d."id" = chunk_stats."documentId";

-- CreateIndex
CREATE INDEX "KnowledgeDocument_tenantKey_chunkIndexStatus_updatedAt_idx"
ON "KnowledgeDocument"("tenantKey", "chunkIndexStatus", "updatedAt");

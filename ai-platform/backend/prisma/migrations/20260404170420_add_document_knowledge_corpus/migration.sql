-- CreateEnum
CREATE TYPE "DocumentOriginKind" AS ENUM ('TEXT', 'UPLOAD');

-- CreateEnum
CREATE TYPE "DocumentIngestionStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "DocumentRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "ManagedResourceStatus" NOT NULL DEFAULT 'DRAFT',
    "ingestionStatus" "DocumentIngestionStatus" NOT NULL DEFAULT 'PENDING',
    "originKind" "DocumentOriginKind" NOT NULL,
    "sourceName" TEXT,
    "mimeType" TEXT,
    "language" TEXT,
    "sourceText" TEXT NOT NULL,
    "summary" TEXT,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "lastIngestedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChunk" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "searchText" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentRecord_tenantId_status_createdAt_idx" ON "DocumentRecord"("tenantId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentRecord_tenantId_ingestionStatus_createdAt_idx" ON "DocumentRecord"("tenantId", "ingestionStatus", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentChunk_tenantId_documentId_sequence_idx" ON "DocumentChunk"("tenantId", "documentId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentChunk_documentId_sequence_key" ON "DocumentChunk"("documentId", "sequence");

-- AddForeignKey
ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "AsyncConversationTurn_tenantId_conversationId_status_acceptedAt" RENAME TO "AsyncConversationTurn_tenantId_conversationId_status_accept_idx";

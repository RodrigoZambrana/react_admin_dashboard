-- CreateEnum
CREATE TYPE "KnowledgeConversationBundleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KnowledgeNegativeExampleStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "KnowledgeNegativeExampleSourceKind" AS ENUM ('REJECTED_CANDIDATE', 'DISCARDED_FEEDBACK', 'MANUAL');

-- CreateTable
CREATE TABLE "KnowledgeConversationBundle" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "status" "KnowledgeConversationBundleStatus" NOT NULL DEFAULT 'PENDING',
    "conversationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "detectedIntents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "eventCount" INTEGER NOT NULL DEFAULT 0,
    "candidateCount" INTEGER NOT NULL DEFAULT 0,
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "pendingCount" INTEGER NOT NULL DEFAULT 0,
    "previewQuestion" TEXT,
    "previewResponse" TEXT,
    "metadata" JSONB,
    "createdByUserId" INTEGER,
    "reviewedByUserId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeConversationBundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeNegativeExample" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "status" "KnowledgeNegativeExampleStatus" NOT NULL DEFAULT 'PENDING',
    "sourceKind" "KnowledgeNegativeExampleSourceKind" NOT NULL,
    "conversationId" TEXT,
    "candidateId" TEXT,
    "feedbackId" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "detectedIntent" TEXT,
    "channel" "ConversationChannel",
    "disallowedText" TEXT NOT NULL,
    "correctedText" TEXT,
    "metadata" JSONB,
    "createdByUserId" INTEGER,
    "reviewedByUserId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeNegativeExample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeConversationBundle_conversationId_key" ON "KnowledgeConversationBundle"("conversationId");

-- CreateIndex
CREATE INDEX "KnowledgeConversationBundle_tenantKey_scope_status_updatedA_idx" ON "KnowledgeConversationBundle"("tenantKey", "scope", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeConversationBundle_tenantKey_conversationId_idx" ON "KnowledgeConversationBundle"("tenantKey", "conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeNegativeExample_feedbackId_key" ON "KnowledgeNegativeExample"("feedbackId");

-- CreateIndex
CREATE INDEX "KnowledgeNegativeExample_tenantKey_scope_status_sourceKind__idx" ON "KnowledgeNegativeExample"("tenantKey", "scope", "status", "sourceKind", "updatedAt");

-- CreateIndex
CREATE INDEX "KnowledgeNegativeExample_tenantKey_conversationId_updatedAt_idx" ON "KnowledgeNegativeExample"("tenantKey", "conversationId", "updatedAt");

-- AddForeignKey
ALTER TABLE "KnowledgeConversationBundle" ADD CONSTRAINT "KnowledgeConversationBundle_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeConversationBundle" ADD CONSTRAINT "KnowledgeConversationBundle_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeConversationBundle" ADD CONSTRAINT "KnowledgeConversationBundle_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeNegativeExample" ADD CONSTRAINT "KnowledgeNegativeExample_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeNegativeExample" ADD CONSTRAINT "KnowledgeNegativeExample_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "KnowledgeCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeNegativeExample" ADD CONSTRAINT "KnowledgeNegativeExample_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "KnowledgeSuggestionFeedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeNegativeExample" ADD CONSTRAINT "KnowledgeNegativeExample_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeNegativeExample" ADD CONSTRAINT "KnowledgeNegativeExample_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

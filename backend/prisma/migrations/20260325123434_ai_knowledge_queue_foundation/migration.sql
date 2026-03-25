-- CreateEnum
CREATE TYPE "InboxQueueAssignmentMode" AS ENUM ('MANUAL', 'LEAST_LOADED');

-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('DOCS', 'BACKEND_DATASET', 'ADMIN_CURATED', 'CONVERSATION_DERIVED');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "KnowledgeDocumentScope" AS ENUM ('CUSTOMER_PUBLIC', 'ADMIN_INTERNAL');

-- CreateEnum
CREATE TYPE "KnowledgeCandidateStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "InboxQueue" ADD COLUMN     "assignmentMode" "InboxQueueAssignmentMode" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "maxAssignedConversations" INTEGER,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "slaTargetMinutes" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "InboxQueueUserAssignment" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "maxOpenConversations" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboxQueueUserAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeDocument" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL,
    "status" "KnowledgeDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "piiRiskLevel" TEXT DEFAULT 'low',
    "metadata" JSONB,
    "authoredByUserId" INTEGER,
    "approvedByUserId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KnowledgeCandidate" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "KnowledgeDocumentScope" NOT NULL,
    "sourceType" "KnowledgeSourceType" NOT NULL DEFAULT 'CONVERSATION_DERIVED',
    "status" "KnowledgeCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "redactedExcerpt" TEXT,
    "summary" TEXT,
    "piiDetected" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "conversationId" TEXT,
    "messageId" TEXT,
    "createdByUserId" INTEGER,
    "reviewedByUserId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InboxQueueUserAssignment_queueId_isActive_idx" ON "InboxQueueUserAssignment"("queueId", "isActive");

-- CreateIndex
CREATE INDEX "InboxQueueUserAssignment_userId_isActive_idx" ON "InboxQueueUserAssignment"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "InboxQueueUserAssignment_queueId_userId_key" ON "InboxQueueUserAssignment"("queueId", "userId");

-- CreateIndex
CREATE INDEX "KnowledgeDocument_tenantKey_scope_status_sourceType_idx" ON "KnowledgeDocument"("tenantKey", "scope", "status", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "KnowledgeDocument_tenantKey_scope_sourceType_sourceKey_key" ON "KnowledgeDocument"("tenantKey", "scope", "sourceType", "sourceKey");

-- CreateIndex
CREATE INDEX "KnowledgeCandidate_tenantKey_scope_status_sourceType_create_idx" ON "KnowledgeCandidate"("tenantKey", "scope", "status", "sourceType", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeCandidate_conversationId_createdAt_idx" ON "KnowledgeCandidate"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeCandidate_messageId_idx" ON "KnowledgeCandidate"("messageId");

-- AddForeignKey
ALTER TABLE "InboxQueueUserAssignment" ADD CONSTRAINT "InboxQueueUserAssignment_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboxQueueUserAssignment" ADD CONSTRAINT "InboxQueueUserAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_authoredByUserId_fkey" FOREIGN KEY ("authoredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeDocument" ADD CONSTRAINT "KnowledgeDocument_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCandidate" ADD CONSTRAINT "KnowledgeCandidate_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCandidate" ADD CONSTRAINT "KnowledgeCandidate_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ConversationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCandidate" ADD CONSTRAINT "KnowledgeCandidate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeCandidate" ADD CONSTRAINT "KnowledgeCandidate_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "payment_order_reference_unique" RENAME TO "Payment_orderId_reference_key";

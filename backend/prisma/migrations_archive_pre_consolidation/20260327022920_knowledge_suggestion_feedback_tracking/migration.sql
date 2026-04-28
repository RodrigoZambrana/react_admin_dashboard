-- CreateEnum
CREATE TYPE "KnowledgeSuggestionFeedbackOutcome" AS ENUM ('USED', 'EDITED', 'DISCARDED');

-- AlterTable
ALTER TABLE "ConversationReadState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "KnowledgeSuggestionFeedback" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "targetMessageId" TEXT,
    "operatorMessageId" TEXT,
    "actorUserId" INTEGER,
    "outcome" "KnowledgeSuggestionFeedbackOutcome" NOT NULL,
    "suggestedText" TEXT,
    "finalText" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KnowledgeSuggestionFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KnowledgeSuggestionFeedback_tenantKey_candidateId_outcome_c_idx" ON "KnowledgeSuggestionFeedback"("tenantKey", "candidateId", "outcome", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeSuggestionFeedback_conversationId_createdAt_idx" ON "KnowledgeSuggestionFeedback"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "KnowledgeSuggestionFeedback_targetMessageId_idx" ON "KnowledgeSuggestionFeedback"("targetMessageId");

-- CreateIndex
CREATE INDEX "KnowledgeSuggestionFeedback_operatorMessageId_idx" ON "KnowledgeSuggestionFeedback"("operatorMessageId");

-- CreateIndex
CREATE INDEX "KnowledgeSuggestionFeedback_actorUserId_createdAt_idx" ON "KnowledgeSuggestionFeedback"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "KnowledgeSuggestionFeedback" ADD CONSTRAINT "KnowledgeSuggestionFeedback_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSuggestionFeedback" ADD CONSTRAINT "KnowledgeSuggestionFeedback_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "KnowledgeCandidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSuggestionFeedback" ADD CONSTRAINT "KnowledgeSuggestionFeedback_targetMessageId_fkey" FOREIGN KEY ("targetMessageId") REFERENCES "ConversationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSuggestionFeedback" ADD CONSTRAINT "KnowledgeSuggestionFeedback_operatorMessageId_fkey" FOREIGN KEY ("operatorMessageId") REFERENCES "ConversationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KnowledgeSuggestionFeedback" ADD CONSTRAINT "KnowledgeSuggestionFeedback_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

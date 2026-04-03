-- CreateTable
CREATE TABLE "ConversationState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "lane" TEXT NOT NULL,
    "lastIntent" TEXT,
    "lastApprovedAction" TEXT,
    "lastApprovedToolName" TEXT,
    "approvedFacts" JSONB,
    "pendingFacts" JSONB,
    "missingFields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nextUsefulField" TEXT,
    "lastApprovedResult" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationState_conversationId_key" ON "ConversationState"("conversationId");

-- CreateIndex
CREATE INDEX "ConversationState_tenantId_lane_updatedAt_idx" ON "ConversationState"("tenantId", "lane", "updatedAt");

-- AddForeignKey
ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

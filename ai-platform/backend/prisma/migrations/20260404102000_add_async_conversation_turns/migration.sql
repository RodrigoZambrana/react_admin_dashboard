-- CreateEnum
CREATE TYPE "AsyncConversationTurnStatus" AS ENUM (
    'STABILIZING',
    'PROCESSING',
    'AWAITING_REPLY',
    'COMPLETED',
    'SUPERSEDED',
    'FAILED'
);

-- CreateTable
CREATE TABLE "AsyncConversationTurn" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" "AsyncConversationTurnStatus" NOT NULL,
    "traceId" TEXT NOT NULL,
    "locale" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstInputAt" TIMESTAMP(3) NOT NULL,
    "lastInputAt" TIMESTAMP(3) NOT NULL,
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "flushAt" TIMESTAMP(3) NOT NULL,
    "replyDueAt" TIMESTAMP(3),
    "projectedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "stabilizationDelayMs" INTEGER NOT NULL,
    "replyDelayMs" INTEGER NOT NULL DEFAULT 0,
    "inputCount" INTEGER NOT NULL DEFAULT 1,
    "semanticInput" TEXT NOT NULL,
    "replyText" TEXT,
    "replyMessageMetadata" JSONB,
    "resultSummary" JSONB,
    "assistantMessageId" TEXT,
    "supersededByTurnId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AsyncConversationTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsyncConversationTurnInput" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "locale" TEXT,
    "metadata" JSONB,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AsyncConversationTurnInput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AsyncConversationTurn_tenantId_conversationId_acceptedAt_idx" ON "AsyncConversationTurn"("tenantId", "conversationId", "acceptedAt");

-- CreateIndex
CREATE INDEX "AsyncConversationTurn_tenantId_conversationId_status_acceptedAt_idx" ON "AsyncConversationTurn"("tenantId", "conversationId", "status", "acceptedAt");

-- CreateIndex
CREATE INDEX "AsyncConversationTurn_tenantId_traceId_idx" ON "AsyncConversationTurn"("tenantId", "traceId");

-- CreateIndex
CREATE INDEX "AsyncConversationTurnInput_tenantId_turnId_receivedAt_idx" ON "AsyncConversationTurnInput"("tenantId", "turnId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AsyncConversationTurnInput_turnId_sequence_key" ON "AsyncConversationTurnInput"("turnId", "sequence");

-- AddForeignKey
ALTER TABLE "AsyncConversationTurn" ADD CONSTRAINT "AsyncConversationTurn_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsyncConversationTurn" ADD CONSTRAINT "AsyncConversationTurn_supersededByTurnId_fkey" FOREIGN KEY ("supersededByTurnId") REFERENCES "AsyncConversationTurn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsyncConversationTurnInput" ADD CONSTRAINT "AsyncConversationTurnInput_turnId_fkey" FOREIGN KEY ("turnId") REFERENCES "AsyncConversationTurn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

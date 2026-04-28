-- CreateEnum
CREATE TYPE "ConversationScope" AS ENUM ('CUSTOMER_PUBLIC', 'ADMIN_INTERNAL');

-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('WEBCHAT', 'EMAIL', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'ADMIN_CHAT');

-- CreateEnum
CREATE TYPE "ConversationControlMode" AS ENUM ('AI', 'HUMAN', 'HYBRID');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'CLOSED', 'WAITING_CUSTOMER', 'WAITING_INTERNAL');

-- CreateEnum
CREATE TYPE "ConversationParticipantRole" AS ENUM ('CUSTOMER', 'OPERATOR', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConversationMessageAuthorType" AS ENUM ('CUSTOMER', 'OPERATOR', 'AGENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ConversationMessageKind" AS ENUM ('TEXT', 'EMAIL', 'IMAGE', 'FILE', 'SYSTEM_EVENT', 'TOOL_RESULT');

-- CreateEnum
CREATE TYPE "ConversationToolCallStatus" AS ENUM ('REQUESTED', 'VALIDATED', 'REJECTED', 'CONFIRMED', 'EXECUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "ConversationHandoffEventType" AS ENUM ('HUMAN_TAKEOVER', 'HUMAN_RELEASE', 'AI_SUGGEST_ONLY', 'AI_RESUME', 'ASSIGNED', 'UNASSIGNED');

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "tenantKey" TEXT NOT NULL,
    "scope" "ConversationScope" NOT NULL,
    "channel" "ConversationChannel" NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "controlMode" "ConversationControlMode" NOT NULL DEFAULT 'AI',
    "subject" TEXT,
    "customerId" INTEGER,
    "assignedToUserId" INTEGER,
    "inboxAccountId" TEXT,
    "externalUserId" TEXT,
    "externalThreadId" TEXT,
    "externalChannelRef" TEXT,
    "metadata" JSONB,
    "lastMessageAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "ConversationParticipantRole" NOT NULL,
    "userId" INTEGER,
    "customerId" INTEGER,
    "externalUserId" TEXT,
    "displayName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "authorType" "ConversationMessageAuthorType" NOT NULL,
    "kind" "ConversationMessageKind" NOT NULL DEFAULT 'TEXT',
    "authorUserId" INTEGER,
    "authorCustomerId" INTEGER,
    "externalMessageId" TEXT,
    "inboxMessageId" TEXT,
    "body" TEXT,
    "normalizedText" TEXT,
    "payload" JSONB,
    "metadata" JSONB,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationHandoffEvent" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "type" "ConversationHandoffEventType" NOT NULL,
    "actorUserId" INTEGER,
    "previousMode" "ConversationControlMode",
    "nextMode" "ConversationControlMode",
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationHandoffEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationToolCall" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "toolName" TEXT NOT NULL,
    "status" "ConversationToolCallStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedBy" "ConversationMessageAuthorType" NOT NULL,
    "requestedByUserId" INTEGER,
    "validatedPayload" JSONB,
    "resultPayload" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationToolCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Conversation_tenantKey_scope_channel_status_idx" ON "Conversation"("tenantKey", "scope", "channel", "status");

-- CreateIndex
CREATE INDEX "Conversation_assignedToUserId_status_lastMessageAt_idx" ON "Conversation"("assignedToUserId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_customerId_lastMessageAt_idx" ON "Conversation"("customerId", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_inboxAccountId_channel_lastMessageAt_idx" ON "Conversation"("inboxAccountId", "channel", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_tenantKey_channel_externalThreadId_key" ON "Conversation"("tenantKey", "channel", "externalThreadId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_role_idx" ON "ConversationParticipant"("conversationId", "role");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_customerId_idx" ON "ConversationParticipant"("customerId");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_externalMessageId_idx" ON "ConversationMessage"("externalMessageId");

-- CreateIndex
CREATE INDEX "ConversationMessage_inboxMessageId_idx" ON "ConversationMessage"("inboxMessageId");

-- CreateIndex
CREATE INDEX "ConversationHandoffEvent_conversationId_createdAt_idx" ON "ConversationHandoffEvent"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationToolCall_conversationId_status_createdAt_idx" ON "ConversationToolCall"("conversationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ConversationToolCall_messageId_idx" ON "ConversationToolCall"("messageId");

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_inboxAccountId_fkey" FOREIGN KEY ("inboxAccountId") REFERENCES "InboxAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_authorCustomerId_fkey" FOREIGN KEY ("authorCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMessage" ADD CONSTRAINT "ConversationMessage_inboxMessageId_fkey" FOREIGN KEY ("inboxMessageId") REFERENCES "InboxMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationHandoffEvent" ADD CONSTRAINT "ConversationHandoffEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationHandoffEvent" ADD CONSTRAINT "ConversationHandoffEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationToolCall" ADD CONSTRAINT "ConversationToolCall_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationToolCall" ADD CONSTRAINT "ConversationToolCall_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ConversationMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationToolCall" ADD CONSTRAINT "ConversationToolCall_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

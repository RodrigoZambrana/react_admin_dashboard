-- CreateTable
CREATE TABLE "ChannelConversationBinding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inboxAccountId" TEXT,
    "inboxAddress" TEXT,
    "displayName" TEXT,
    "email" TEXT,
    "queueSlug" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelConversationBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelMessageRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "externalMessageId" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "remoteId" TEXT,
    "direction" TEXT NOT NULL,
    "status" TEXT,
    "occurredAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChannelMessageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConversationBinding_tenantId_channel_threadId_key" ON "ChannelConversationBinding"("tenantId", "channel", "threadId");

-- CreateIndex
CREATE INDEX "ChannelConversationBinding_tenantId_channel_userId_updatedAt_idx" ON "ChannelConversationBinding"("tenantId", "channel", "userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelMessageRecord_tenantId_channel_externalMessageId_key" ON "ChannelMessageRecord"("tenantId", "channel", "externalMessageId");

-- CreateIndex
CREATE INDEX "ChannelMessageRecord_tenantId_conversationId_createdAt_idx" ON "ChannelMessageRecord"("tenantId", "conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChannelConversationBinding" ADD CONSTRAINT "ChannelConversationBinding_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChannelMessageRecord" ADD CONSTRAINT "ChannelMessageRecord_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

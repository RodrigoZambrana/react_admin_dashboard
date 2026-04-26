CREATE TABLE "ConversationOperatorState" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "actorKey" TEXT NOT NULL DEFAULT 'global',
    "lastReadAt" TIMESTAMP(3),
    "manualUnread" BOOLEAN NOT NULL DEFAULT false,
    "pinnedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),
    "mutePreset" TEXT,
    "deletedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationOperatorState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConversationOperatorState_tenantId_conversationId_actorKey_key" ON "ConversationOperatorState"("tenantId", "conversationId", "actorKey");
CREATE INDEX "ConversationOperatorState_tenantId_actorKey_pinnedAt_idx" ON "ConversationOperatorState"("tenantId", "actorKey", "pinnedAt");
CREATE INDEX "ConversationOperatorState_tenantId_actorKey_archivedAt_idx" ON "ConversationOperatorState"("tenantId", "actorKey", "archivedAt");
CREATE INDEX "ConversationOperatorState_tenantId_actorKey_deletedAt_idx" ON "ConversationOperatorState"("tenantId", "actorKey", "deletedAt");
CREATE INDEX "ConversationOperatorState_tenantId_conversationId_idx" ON "ConversationOperatorState"("tenantId", "conversationId");

ALTER TABLE "ConversationOperatorState"
ADD CONSTRAINT "ConversationOperatorState_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

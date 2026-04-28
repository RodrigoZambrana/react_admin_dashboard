CREATE TABLE "ConversationReadState" (
  "conversationId" TEXT NOT NULL,
  "userId" INTEGER NOT NULL,
  "lastReadAt" TIMESTAMP(3),
  "manualUnread" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConversationReadState_pkey" PRIMARY KEY ("conversationId", "userId"),
  CONSTRAINT "ConversationReadState_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ConversationReadState_userId_updatedAt_idx" ON "ConversationReadState"("userId", "updatedAt");

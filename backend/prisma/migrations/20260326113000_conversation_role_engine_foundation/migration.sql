CREATE TYPE "ConversationRole" AS ENUM (
  'CUSTOMER_PUBLIC',
  'CUSTOMER_AUTHENTICATED',
  'ADMIN_SUPPORT',
  'ADMIN_SALES',
  'ADMIN_OPERATIONS',
  'ADMIN_SUPERVISOR',
  'SUPERADMIN'
);

ALTER TABLE "Conversation"
ADD COLUMN "conversationRole" "ConversationRole";

UPDATE "Conversation"
SET "conversationRole" = CASE
  WHEN "scope" = 'CUSTOMER_PUBLIC' THEN 'CUSTOMER_PUBLIC'::"ConversationRole"
  WHEN "scope" = 'CUSTOMER_AUTHENTICATED' THEN 'CUSTOMER_AUTHENTICATED'::"ConversationRole"
  ELSE 'ADMIN_SUPPORT'::"ConversationRole"
END;

ALTER TABLE "Conversation"
ALTER COLUMN "conversationRole" SET NOT NULL,
ALTER COLUMN "conversationRole" SET DEFAULT 'CUSTOMER_PUBLIC';

CREATE INDEX "Conversation_conversationRole_lastMessageAt_idx"
ON "Conversation"("conversationRole", "lastMessageAt");

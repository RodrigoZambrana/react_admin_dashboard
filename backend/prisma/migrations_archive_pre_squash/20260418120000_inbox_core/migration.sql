-- Create enums for inbox module
CREATE TYPE "InboxChannelType" AS ENUM ('EMAIL', 'WHATSAPP', 'MESSENGER', 'INSTAGRAM', 'SMS', 'OTHER');
CREATE TYPE "InboxMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "InboxMessageEventType" AS ENUM ('CREATED', 'FETCHED', 'FLAG_UPDATED', 'MOVED', 'SENT', 'SYNCED', 'ERROR');

-- Inbox accounts table
CREATE TABLE "InboxAccount" (
    "id" TEXT NOT NULL,
    "displayName" TEXT,
    "address" TEXT,
    "channel" "InboxChannelType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT TRUE,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboxAccount_channel_address_key"
ON "InboxAccount"("channel", "address");

-- Inbox message metadata table
CREATE TABLE "InboxMessage" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "channel" "InboxChannelType" NOT NULL,
    "remoteId" TEXT NOT NULL,
    "threadRemoteId" TEXT,
    "subject" TEXT,
    "snippet" TEXT,
    "previewText" TEXT,
    "fromAddress" TEXT,
    "fromName" TEXT,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "bccAddresses" TEXT[],
    "replyToAddresses" TEXT[],
    "direction" "InboxMessageDirection" NOT NULL,
    "folder" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
    "isStarred" BOOLEAN NOT NULL DEFAULT FALSE,
    "isSpam" BOOLEAN NOT NULL DEFAULT FALSE,
    "hasAttachments" BOOLEAN NOT NULL DEFAULT FALSE,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxMessage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboxMessage_accountId_channel_remoteId_key"
ON "InboxMessage"("accountId", "channel", "remoteId");

CREATE INDEX "InboxMessage_accountId_folder_idx"
ON "InboxMessage"("accountId", "folder");

CREATE INDEX "InboxMessage_accountId_isRead_idx"
ON "InboxMessage"("accountId", "isRead");

CREATE INDEX "InboxMessage_accountId_sentAt_idx"
ON "InboxMessage"("accountId", "sentAt");

-- Inbox attachments metadata
CREATE TABLE "InboxAttachment" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "remoteId" TEXT,
    "fileName" TEXT,
    "contentType" TEXT,
    "size" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxAttachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InboxAttachment_messageId_idx"
ON "InboxAttachment"("messageId");

-- Inbox sync cursors per folder/channel
CREATE TABLE "InboxSyncState" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "channel" "InboxChannelType" NOT NULL,
    "folder" TEXT NOT NULL,
    "lastRemoteId" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxSyncState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboxSyncState_accountId_channel_folder_key"
ON "InboxSyncState"("accountId", "channel", "folder");

-- Inbox message events / audit log
CREATE TABLE "InboxMessageEvent" (
    "id" SERIAL,
    "messageId" TEXT NOT NULL,
    "type" "InboxMessageEventType" NOT NULL,
    "payload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxMessageEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InboxMessageEvent_messageId_occurredAt_idx"
ON "InboxMessageEvent"("messageId", "occurredAt");

-- Foreign keys
ALTER TABLE "InboxMessage"
ADD CONSTRAINT "InboxMessage_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "InboxAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InboxAttachment"
ADD CONSTRAINT "InboxAttachment_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "InboxMessage"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InboxSyncState"
ADD CONSTRAINT "InboxSyncState_accountId_fkey"
FOREIGN KEY ("accountId") REFERENCES "InboxAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InboxMessageEvent"
ADD CONSTRAINT "InboxMessageEvent_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "InboxMessage"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

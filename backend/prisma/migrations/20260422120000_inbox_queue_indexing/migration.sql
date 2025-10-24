-- Create table for inbox queues
CREATE TABLE "InboxQueue" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InboxQueue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InboxQueue_slug_key"
ON "InboxQueue"("slug");

-- Add columns for idempotency and queue assignment
ALTER TABLE "InboxMessage"
    ADD COLUMN "provider" TEXT,
    ADD COLUMN "messageUid" TEXT,
    ADD COLUMN "queueId" TEXT,
    ADD COLUMN "bodyHash" TEXT;

-- Backfill provider and messageUid for existing data
UPDATE "InboxMessage"
SET "provider" = LOWER("channel"::TEXT)
WHERE "provider" IS NULL OR "provider" = '';

UPDATE "InboxMessage"
SET "messageUid" =
    LOWER(COALESCE(NULLIF("provider", ''), 'generic')) || ':' ||
    COALESCE(NULLIF(UPPER(COALESCE("folder", '')), ''), 'INBOX') || ':remote:' ||
    "remoteId"
WHERE "messageUid" IS NULL OR "messageUid" = '';

-- Enforce constraints after backfill
ALTER TABLE "InboxMessage"
    ALTER COLUMN "provider" SET NOT NULL,
    ALTER COLUMN "provider" SET DEFAULT 'generic',
    ALTER COLUMN "messageUid" SET NOT NULL;

-- Add indexes and foreign key
CREATE UNIQUE INDEX "InboxMessage_messageUid_provider_folder_key"
ON "InboxMessage"("messageUid", "provider", "folder");

CREATE INDEX "InboxMessage_queueId_receivedAt_idx"
ON "InboxMessage"("queueId", "receivedAt");

ALTER TABLE "InboxMessage"
ADD CONSTRAINT "InboxMessage_queueId_fkey"
FOREIGN KEY ("queueId") REFERENCES "InboxQueue"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

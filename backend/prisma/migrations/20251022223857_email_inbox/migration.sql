-- DropIndex (guarded for shadow databases that lack the index)
DROP INDEX IF EXISTS "public"."InboxAttachment_messageId_idx";

-- AlterTable (guarded for shadow databases that may lack the table)
ALTER TABLE IF EXISTS "public"."CompanyProfile" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE IF EXISTS "public"."InboxAccount" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE IF EXISTS "public"."InboxMessage" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE IF EXISTS "public"."InboxQueue" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE IF EXISTS "public"."InboxSyncState" ALTER COLUMN "updatedAt" DROP DEFAULT;

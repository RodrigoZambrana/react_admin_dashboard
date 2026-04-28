CREATE TYPE "KnowledgeRawEventStatus" AS ENUM ('NEW', 'PROCESSED', 'DISCARDED');

CREATE TYPE "KnowledgeIngestionRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

ALTER TABLE "KnowledgeCandidate"
ADD COLUMN "observationId" TEXT,
ADD COLUMN "detectedIntent" TEXT,
ADD COLUMN "problem" TEXT,
ADD COLUMN "contextSummary" TEXT,
ADD COLUMN "suggestedResponse" TEXT,
ADD COLUMN "approvedResponse" TEXT,
ADD COLUMN "confidence" DOUBLE PRECISION,
ADD COLUMN "dedupeHash" TEXT,
ADD COLUMN "clusterKey" TEXT,
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "KnowledgeRawEvent" (
  "id" TEXT NOT NULL,
  "tenantKey" TEXT NOT NULL,
  "scope" "KnowledgeDocumentScope" NOT NULL,
  "channel" "ConversationChannel" NOT NULL,
  "sourceAuthorType" "ConversationMessageAuthorType" NOT NULL,
  "status" "KnowledgeRawEventStatus" NOT NULL DEFAULT 'NEW',
  "conversationId" TEXT,
  "messageId" TEXT,
  "userMessage" TEXT NOT NULL,
  "normalizedMessage" TEXT NOT NULL,
  "redactedMessage" TEXT,
  "operatorReply" TEXT,
  "aiReply" TEXT,
  "detectedIntent" TEXT,
  "problem" TEXT,
  "contextSummary" TEXT,
  "suggestedResponse" TEXT,
  "confidence" DOUBLE PRECISION,
  "relevanceScore" DOUBLE PRECISION,
  "dedupeHash" TEXT,
  "clusterKey" TEXT,
  "messageElements" JSONB,
  "messageContextOrigin" JSONB,
  "attachments" JSONB,
  "metadata" JSONB,
  "ingestionRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeRawEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeIngestionRun" (
  "id" TEXT NOT NULL,
  "tenantKey" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "triggerType" TEXT NOT NULL,
  "status" "KnowledgeIngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "createdCandidates" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "metadata" JSONB,
  "createdByUserId" INTEGER,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "KnowledgeIngestionRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeCandidate_observationId_key" ON "KnowledgeCandidate"("observationId");
CREATE INDEX "KnowledgeCandidate_tenantKey_dedupeHash_status_idx" ON "KnowledgeCandidate"("tenantKey", "dedupeHash", "status");
CREATE INDEX "KnowledgeCandidate_tenantKey_detectedIntent_status_idx" ON "KnowledgeCandidate"("tenantKey", "detectedIntent", "status");

CREATE UNIQUE INDEX "KnowledgeRawEvent_messageId_key" ON "KnowledgeRawEvent"("messageId");
CREATE INDEX "KnowledgeRawEvent_tenantKey_scope_status_createdAt_idx" ON "KnowledgeRawEvent"("tenantKey", "scope", "status", "createdAt");
CREATE INDEX "KnowledgeRawEvent_conversationId_createdAt_idx" ON "KnowledgeRawEvent"("conversationId", "createdAt");
CREATE INDEX "KnowledgeRawEvent_ingestionRunId_idx" ON "KnowledgeRawEvent"("ingestionRunId");
CREATE INDEX "KnowledgeRawEvent_tenantKey_dedupeHash_idx" ON "KnowledgeRawEvent"("tenantKey", "dedupeHash");

CREATE INDEX "KnowledgeIngestionRun_tenantKey_status_startedAt_idx" ON "KnowledgeIngestionRun"("tenantKey", "status", "startedAt");
CREATE INDEX "KnowledgeIngestionRun_createdByUserId_startedAt_idx" ON "KnowledgeIngestionRun"("createdByUserId", "startedAt");

ALTER TABLE "KnowledgeCandidate"
ADD CONSTRAINT "KnowledgeCandidate_observationId_fkey"
FOREIGN KEY ("observationId") REFERENCES "KnowledgeRawEvent"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeRawEvent"
ADD CONSTRAINT "KnowledgeRawEvent_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeRawEvent"
ADD CONSTRAINT "KnowledgeRawEvent_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "ConversationMessage"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeRawEvent"
ADD CONSTRAINT "KnowledgeRawEvent_ingestionRunId_fkey"
FOREIGN KEY ("ingestionRunId") REFERENCES "KnowledgeIngestionRun"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "KnowledgeIngestionRun"
ADD CONSTRAINT "KnowledgeIngestionRun_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

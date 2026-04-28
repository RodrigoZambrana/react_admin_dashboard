-- Align the existing raw events table with the Prisma contract used by the analytics backend.
-- The table already exists with legacy camelCase column names.

ALTER TABLE "events" RENAME COLUMN "eventName" TO "event_name";
ALTER TABLE "events" RENAME COLUMN "sessionId" TO "session_id";
ALTER TABLE "events" RENAME COLUMN "correlationId" TO "correlation_id";
ALTER TABLE "events" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "events" RENAME COLUMN "userAgent" TO "user_agent";

ALTER INDEX IF EXISTS "AnalyticsEvent_eventName_timestamp_idx" RENAME TO "events_event_name_timestamp_idx";
ALTER INDEX IF EXISTS "AnalyticsEvent_sessionId_timestamp_idx" RENAME TO "events_session_id_timestamp_idx";
ALTER INDEX IF EXISTS "AnalyticsEvent_correlationId_idx" RENAME TO "events_correlation_id_idx";
ALTER INDEX IF EXISTS "AnalyticsEvent_createdAt_idx" RENAME TO "events_created_at_idx";

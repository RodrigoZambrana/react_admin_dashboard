-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "correlationId" TEXT,
    "userId" TEXT,
    "url" TEXT NOT NULL,
    "referrer" TEXT,
    "userAgent" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_eventName_timestamp_idx" ON "AnalyticsEvent"("eventName", "timestamp");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_timestamp_idx" ON "AnalyticsEvent"("sessionId", "timestamp");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_correlationId_idx" ON "AnalyticsEvent"("correlationId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");

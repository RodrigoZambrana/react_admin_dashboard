-- CreateTable
CREATE TABLE "analytics_insights_history" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "insight_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "evidence" JSONB NOT NULL,
    "source_report" TEXT,
    "period_range" JSONB NOT NULL,
    "score" DECIMAL(10,4) NOT NULL,
    "summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_insights_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_insights_history_date_insight_type_idx" ON "analytics_insights_history"("date", "insight_type");

-- CreateIndex
CREATE INDEX "analytics_insights_history_source_report_created_at_idx" ON "analytics_insights_history"("source_report", "created_at");

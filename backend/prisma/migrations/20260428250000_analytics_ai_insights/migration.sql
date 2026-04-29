CREATE TABLE "analytics_ai_insights" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "summary" TEXT NOT NULL,
  "insights_json" JSONB NOT NULL,
  "actions_json" JSONB NOT NULL,
  "confidence" DECIMAL(5,4) NOT NULL,
  "bundle_json" JSONB NOT NULL,
  "response_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "analytics_ai_insights_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "analytics_ai_insights_date_created_at_idx" ON "analytics_ai_insights"("date", "created_at");

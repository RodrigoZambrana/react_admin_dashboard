-- Analytics connectors, sync runs, reporting tables and insights.
-- The migration is idempotent so it can be applied safely on already provisioned dev databases.

CREATE TABLE IF NOT EXISTS "analytics_connections" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'needs_auth',
  "external_account_id" TEXT,
  "external_property_id" TEXT,
  "display_name" TEXT NOT NULL,
  "sync_interval_minutes" INTEGER NOT NULL DEFAULT 60,
  "last_synced_at" TIMESTAMP(3),
  "next_sync_at" TIMESTAMP(3),
  "needs_reauth" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_connections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "analytics_connection_credentials" (
  "connection_id" TEXT NOT NULL,
  "refresh_token_encrypted" TEXT,
  "access_token_encrypted" TEXT,
  "expires_at" TIMESTAMP(3),
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_connection_credentials_pkey" PRIMARY KEY ("connection_id"),
  CONSTRAINT "analytics_connection_credentials_connection_id_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "analytics_connections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "analytics_sync_runs" (
  "id" TEXT NOT NULL,
  "connection_id" TEXT NOT NULL,
  "job_type" TEXT NOT NULL,
  "from_date" TIMESTAMP(3),
  "to_date" TIMESTAMP(3),
  "status" TEXT NOT NULL,
  "records_fetched" INTEGER NOT NULL DEFAULT 0,
  "records_upserted" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finished_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_sync_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "analytics_sync_runs_connection_id_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "analytics_connections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "analytics_ga4_daily_metrics" (
  "id" BIGSERIAL NOT NULL,
  "date" DATE NOT NULL,
  "source" TEXT NOT NULL,
  "medium" TEXT,
  "campaign" TEXT,
  "sessions" INTEGER NOT NULL DEFAULT 0,
  "users" INTEGER NOT NULL DEFAULT 0,
  "event_count" INTEGER NOT NULL DEFAULT 0,
  "key_events" INTEGER NOT NULL DEFAULT 0,
  "purchases" INTEGER NOT NULL DEFAULT 0,
  "revenue" NUMERIC(18,4) NOT NULL DEFAULT 0,
  "connection_id" TEXT,
  "sync_run_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_ga4_daily_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_ga4_daily_metrics_natural_key"
  ON "analytics_ga4_daily_metrics" ("date", "source", "medium", "campaign");
CREATE INDEX IF NOT EXISTS "analytics_ga4_daily_metrics_source_campaign_idx"
  ON "analytics_ga4_daily_metrics" ("source", "campaign");
CREATE INDEX IF NOT EXISTS "analytics_ga4_daily_metrics_date_idx"
  ON "analytics_ga4_daily_metrics" ("date");

CREATE TABLE IF NOT EXISTS "analytics_ads_daily_metrics" (
  "id" BIGSERIAL NOT NULL,
  "date" DATE NOT NULL,
  "campaign" TEXT NOT NULL,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "cost" NUMERIC(18,4) NOT NULL DEFAULT 0,
  "conversions" INTEGER NOT NULL DEFAULT 0,
  "revenue" NUMERIC(18,4) NOT NULL DEFAULT 0,
  "connection_id" TEXT,
  "sync_run_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_ads_daily_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_ads_daily_metrics_natural_key"
  ON "analytics_ads_daily_metrics" ("date", "campaign");
CREATE INDEX IF NOT EXISTS "analytics_ads_daily_metrics_campaign_idx"
  ON "analytics_ads_daily_metrics" ("campaign");
CREATE INDEX IF NOT EXISTS "analytics_ads_daily_metrics_date_idx"
  ON "analytics_ads_daily_metrics" ("date");

CREATE TABLE IF NOT EXISTS "analytics_search_console_daily_metrics" (
  "id" BIGSERIAL NOT NULL,
  "date" DATE NOT NULL,
  "query" TEXT NOT NULL,
  "page" TEXT,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "ctr" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "position" NUMERIC(18,6) NOT NULL DEFAULT 0,
  "connection_id" TEXT,
  "sync_run_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_search_console_daily_metrics_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_search_console_daily_metrics_natural_key"
  ON "analytics_search_console_daily_metrics" ("date", "query", "page");
CREATE INDEX IF NOT EXISTS "analytics_search_console_daily_metrics_query_idx"
  ON "analytics_search_console_daily_metrics" ("query");
CREATE INDEX IF NOT EXISTS "analytics_search_console_daily_metrics_date_idx"
  ON "analytics_search_console_daily_metrics" ("date");

CREATE TABLE IF NOT EXISTS "analytics_reporting_daily" (
  "id" BIGSERIAL NOT NULL,
  "date" DATE NOT NULL,
  "channel" TEXT NOT NULL,
  "source" TEXT,
  "medium" TEXT,
  "campaign" TEXT,
  "product_id" TEXT,
  "landing_page" TEXT,
  "device" TEXT,
  "country" TEXT,
  "sessions" INTEGER NOT NULL DEFAULT 0,
  "users" INTEGER NOT NULL DEFAULT 0,
  "revenue" NUMERIC(18,4) NOT NULL DEFAULT 0,
  "orders" INTEGER NOT NULL DEFAULT 0,
  "cost" NUMERIC(18,4) NOT NULL DEFAULT 0,
  "impressions" INTEGER NOT NULL DEFAULT 0,
  "clicks" INTEGER NOT NULL DEFAULT 0,
  "views" INTEGER NOT NULL DEFAULT 0,
  "add_to_cart" INTEGER NOT NULL DEFAULT 0,
  "event_count" INTEGER NOT NULL DEFAULT 0,
  "key_events" INTEGER NOT NULL DEFAULT 0,
  "purchase" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "analytics_reporting_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "analytics_reporting_daily_natural_key"
  ON "analytics_reporting_daily" ("date", "channel", "source", "medium", "campaign", "product_id", "landing_page", "device", "country");
CREATE INDEX IF NOT EXISTS "analytics_reporting_daily_channel_campaign_idx"
  ON "analytics_reporting_daily" ("channel", "campaign");
CREATE INDEX IF NOT EXISTS "analytics_reporting_daily_date_idx"
  ON "analytics_reporting_daily" ("date");

CREATE TABLE IF NOT EXISTS "analytics_insights" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "dimension" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "impact" TEXT NOT NULL,
  "confidence" NUMERIC(5,4) NOT NULL,
  "evidence" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'open',
  CONSTRAINT "analytics_insights_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "analytics_insights_source_metric_status_idx"
  ON "analytics_insights" ("source", "metric", "status");
CREATE INDEX IF NOT EXISTS "analytics_insights_impact_confidence_idx"
  ON "analytics_insights" ("impact", "confidence");

-- Rename Ads revenue proxy to conversion value for semantic clarity.

ALTER TABLE IF EXISTS "analytics_ads_daily_metrics"
  RENAME COLUMN "revenue" TO "conversion_value";

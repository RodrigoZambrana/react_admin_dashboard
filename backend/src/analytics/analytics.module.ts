import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { GrowthModule } from '../growth/growth.module'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsRepository } from './analytics.repository'
import { AnalyticsService } from './analytics.service'
import { MetaCapiService } from './meta-capi.service'
import { AnalyticsAiInsightsService } from './ai-insights.service'
import { AnalyticsInsightAiService } from './analytics-insight-ai.service'
import { AnalyticsInsightsService } from './insights.service'
import { AdsConnectorService } from './ads-connector.service'
import { Ga4ConnectorService } from './ga4-connector.service'
import { SearchConsoleConnectorService } from './search-console-connector.service'
import { AnalyticsReportingService } from './reporting/analytics-reporting.service'
import { AnalyticsHealthService } from './analytics-health.service'
import { AnalyticsDataTrustService } from './data-trust/analytics-data-trust.service'
import { AnalyticsDataParityService } from './data-parity/analytics-data-parity.service'
import { AnalyticsExportService } from './analytics-export.service'
import { AnalyticsEndpointUsageInterceptor } from './analytics-endpoint-usage.interceptor'
import { BackfillEventsJob } from './pipelines/backfill-events.job'
import { BackfillJob } from './pipelines/backfill.job'
import { BaselineSyncJob } from './pipelines/baseline-sync.job'
import { DataQualityJob } from './pipelines/data-quality.job'
import { NormalizeEventsJob } from './pipelines/normalize-events.job'
import { Ga4InitialSyncJob } from './pipelines/ga4-initial-sync.job'
import { AnalyticsBaselineService } from './baseline.service'
import { AnalyticsGoogleOAuthConfigService } from '../common/integrations/analytics-google-oauth-config.service'
import { OpenAiClientModule } from '../common/openai/openai-client.module'
import { SecureConfigModule } from '../common/security/secure-config.module'
import { AnalyticsQueueService } from './analytics-queue.service'
import { AnalyticsUsageService } from './analytics-usage.service'

@Module({
  imports: [PrismaModule, SecureConfigModule, OpenAiClientModule, GrowthModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsRepository,
    AnalyticsService,
    MetaCapiService,
    AnalyticsAiInsightsService,
    AnalyticsInsightAiService,
    AnalyticsInsightsService,
    AnalyticsBaselineService,
    AdsConnectorService,
    Ga4ConnectorService,
    SearchConsoleConnectorService,
    AnalyticsGoogleOAuthConfigService,
    AnalyticsReportingService,
    AnalyticsHealthService,
    AnalyticsDataTrustService,
    AnalyticsDataParityService,
    AnalyticsExportService,
    AnalyticsUsageService,
    AnalyticsEndpointUsageInterceptor,
    AnalyticsQueueService,
    NormalizeEventsJob,
    BackfillEventsJob,
    BaselineSyncJob,
    DataQualityJob,
    BackfillJob,
    Ga4InitialSyncJob,
  ],
  exports: [
    AnalyticsService,
    AnalyticsInsightsService,
    AnalyticsAiInsightsService,
    AnalyticsInsightAiService,
    AnalyticsDataTrustService,
    AnalyticsDataParityService,
    AnalyticsRepository,
    AdsConnectorService,
  ],
})
export class AnalyticsModule {}

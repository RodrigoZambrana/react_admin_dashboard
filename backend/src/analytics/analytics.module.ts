import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsRepository } from './analytics.repository'
import { AnalyticsService } from './analytics.service'
import { AnalyticsInsightsService } from './insights.service'
import { AdsConnectorService } from './ads-connector.service'
import { Ga4ConnectorService } from './ga4-connector.service'
import { SearchConsoleConnectorService } from './search-console-connector.service'
import { AnalyticsReportingService } from './reporting/analytics-reporting.service'
import { BackfillEventsJob } from './pipelines/backfill-events.job'
import { BackfillJob } from './pipelines/backfill.job'
import { AnalyticsSyncScheduler } from './pipelines/analytics-sync.scheduler'
import { BaselineSyncJob } from './pipelines/baseline-sync.job'
import { DataQualityJob } from './pipelines/data-quality.job'
import { NormalizeEventsJob } from './pipelines/normalize-events.job'
import { Ga4InitialSyncJob } from './pipelines/ga4-initial-sync.job'
import { AnalyticsBaselineService } from './baseline.service'
import { AnalyticsGoogleOAuthConfigService } from '../common/integrations/analytics-google-oauth-config.service'
import { SecureConfigModule } from '../common/security/secure-config.module'

@Module({
  imports: [PrismaModule, SecureConfigModule],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsRepository,
    AnalyticsService,
    AnalyticsInsightsService,
    AnalyticsBaselineService,
    AdsConnectorService,
    Ga4ConnectorService,
    SearchConsoleConnectorService,
    AnalyticsGoogleOAuthConfigService,
    AnalyticsReportingService,
    NormalizeEventsJob,
    BackfillEventsJob,
    BaselineSyncJob,
    DataQualityJob,
    BackfillJob,
    AnalyticsSyncScheduler,
    Ga4InitialSyncJob,
  ],
  exports: [AnalyticsService, AnalyticsInsightsService],
})
export class AnalyticsModule {}

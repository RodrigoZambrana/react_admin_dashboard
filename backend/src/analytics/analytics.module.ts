import { Module } from '@nestjs/common'

import { PrismaModule } from '../prisma/prisma.module'
import { AnalyticsController } from './analytics.controller'
import { AnalyticsRepository } from './analytics.repository'
import { AnalyticsService } from './analytics.service'
import { BackfillEventsJob } from './pipelines/backfill-events.job'
import { NormalizeEventsJob } from './pipelines/normalize-events.job'

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsRepository, AnalyticsService, NormalizeEventsJob, BackfillEventsJob],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}

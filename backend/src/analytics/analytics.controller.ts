import { Body, Controller, Get, Post, Query } from '@nestjs/common'

import type { AnalyticsEventInput } from './analytics.types'
import { AnalyticsService } from './analytics.service'
import { BackfillEventsJob } from './pipelines/backfill-events.job'
import { NormalizeEventsJob } from './pipelines/normalize-events.job'

type FunnelQuery = {
  from?: string
  to?: string
  compare_from?: string
  compare_to?: string
  steps?: string
}

@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly normalizeEventsJob: NormalizeEventsJob,
    private readonly backfillEventsJob: BackfillEventsJob,
  ) {}

  @Post('events')
  ingestEvent(@Body() body: AnalyticsEventInput) {
    return this.analyticsService.processEvent(body)
  }

  @Get('metrics/funnel')
  getFunnelMetrics(@Query() query: FunnelQuery) {
    const steps =
      typeof query.steps === 'string'
        ? query.steps
            .split(',')
            .map((step) => step.trim())
            .filter(Boolean)
        : undefined

    return this.analyticsService.getFunnelMetrics({
      from: query.from,
      to: query.to,
      compareFrom: query.compare_from,
      compareTo: query.compare_to,
      steps,
    })
  }

  @Get('dashboard')
  getDashboardMetrics(@Query() query: { from?: string; to?: string }) {
    return this.analyticsService.getDashboardMetrics({
      from: query.from,
      to: query.to,
    })
  }

  @Get('overview')
  getOverviewMetrics(
    @Query() query: { from?: string; to?: string; compare_from?: string; compare_to?: string },
  ) {
    return this.analyticsService.getDashboardMetrics({
      from: query.from,
      to: query.to,
      compareFrom: query.compare_from,
      compareTo: query.compare_to,
    })
  }

  @Get('funnel')
  getFunnel(@Query() query: FunnelQuery) {
    return this.getFunnelMetrics(query)
  }

  @Post('pipelines/normalize-events/run')
  runNormalizationBatch(@Body() body?: { limit?: number }) {
    return this.normalizeEventsJob.run(body?.limit)
  }

  @Post('pipelines/backfill-events/run')
  runBackfill(@Body() body?: { from?: string; to?: string; batchSize?: number }) {
    return this.backfillEventsJob.run(body?.from, body?.to, body?.batchSize)
  }
}

import { Injectable } from '@nestjs/common'

import { AnalyticsService } from '../analytics.service'

@Injectable()
export class BackfillEventsJob {
  constructor(private readonly analyticsService: AnalyticsService) {}

  run(from?: string, to?: string, batchSize = 1000) {
    return this.analyticsService.runBackfill(from, to, batchSize)
  }
}

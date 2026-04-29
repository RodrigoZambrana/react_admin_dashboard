import { Injectable } from '@nestjs/common'

import { AnalyticsService } from '../analytics.service'

@Injectable()
export class NormalizeEventsJob {
  constructor(private readonly analyticsService: AnalyticsService) {}

  run(limit = 1000) {
    return this.analyticsService.runNormalizationBatch(limit)
  }
}

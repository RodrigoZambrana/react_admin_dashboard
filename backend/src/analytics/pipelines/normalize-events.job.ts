import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common'

import { AnalyticsService } from '../analytics.service'

const FIVE_MINUTES_MS = 5 * 60 * 1000

@Injectable()
export class NormalizeEventsJob implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null

  constructor(private readonly analyticsService: AnalyticsService) {}

  onModuleInit() {
    void this.run()
    this.timer = setInterval(() => {
      void this.run()
    }, FIVE_MINUTES_MS)
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  run(limit = 1000) {
    return this.analyticsService.runNormalizationBatch(limit)
  }
}

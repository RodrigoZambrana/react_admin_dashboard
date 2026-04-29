import { Injectable } from '@nestjs/common'

import { AnalyticsBaselineService } from '../baseline.service'

@Injectable()
export class BaselineSyncJob {
  constructor(private readonly baselineService: AnalyticsBaselineService) {}

  run(connectionId: string, input?: { from?: string; to?: string; reportKey?: string }) {
    return this.baselineService.runBaselineSync(connectionId, input)
  }
}

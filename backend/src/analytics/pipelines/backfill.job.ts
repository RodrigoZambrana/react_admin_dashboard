import { Injectable } from '@nestjs/common'

import { AnalyticsBaselineService } from '../baseline.service'
import { AnalyticsReportingService } from '../reporting/analytics-reporting.service'

@Injectable()
export class BackfillJob {
  constructor(
    private readonly baselineService: AnalyticsBaselineService,
    private readonly reportingService: AnalyticsReportingService,
  ) {}

  async run(input: { connectionId: string; from: string; to: string; reportKey?: string }) {
    const baseline = await this.baselineService.runBaselineSync(input.connectionId, input)
    const quality = await this.reportingService.runDataQualityCheck(input)

    return {
      baseline,
      quality,
    }
  }
}

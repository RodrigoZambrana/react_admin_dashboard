import { Injectable } from '@nestjs/common'

import { AnalyticsReportingService } from '../reporting/analytics-reporting.service'

@Injectable()
export class DataQualityJob {
  constructor(private readonly reportingService: AnalyticsReportingService) {}

  run(input: { connectionId: string; reportKey?: string; from?: string; to?: string }) {
    return this.reportingService.runDataQualityCheck(input)
  }
}

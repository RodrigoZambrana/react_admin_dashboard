import { Injectable } from '@nestjs/common'

import { PrismaService } from '../../prisma/prisma.service'
import {
  listAnalyticsDataTrustHistory,
  runAnalyticsDataTrustChecks,
  type AnalyticsDataTrustHistoryItem,
  type AnalyticsDataTrustResult,
} from './analytics-data-trust.core'

@Injectable()
export class AnalyticsDataTrustService {
  constructor(private readonly prisma: PrismaService) {}

  run(options?: Parameters<typeof runAnalyticsDataTrustChecks>[1]) {
    return runAnalyticsDataTrustChecks(this.prisma, options)
  }

  async getOverview(limit = 10) {
    const latest = await this.getLatest()
    const history = await listAnalyticsDataTrustHistory(this.prisma, limit)
    if (!latest) {
      return {
        status: 'warning' as const,
        environment: 'unknown',
        summary: 'No data trust checks recorded yet.',
        updatedAt: null,
        metrics: {},
        trend: {
          direction: 'flat' as const,
          currentValue: 0,
          previousValue: 0,
          deltaPct: null,
        },
        checks: [],
        history,
      }
    }
    return {
      ...latest,
      history,
    }
  }

  getLatest(): Promise<AnalyticsDataTrustResult | null> {
    const trustTable = this.prisma.analyticsDataTrustCheck as
      | {
          findMany: (args: Record<string, unknown>) => Promise<
            Array<{
              detailsJson: unknown
              environment: string
            }>
          >
        }
      | undefined

    if (!trustTable) {
      return Promise.resolve(null)
    }

    return trustTable
      .findMany({
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      })
      .then((rows) => {
        if (!rows.length) {
          return null
        }
        const row = rows[0] as {
          detailsJson: unknown
          environment: string
          createdAt: Date
        }
        const details = row.detailsJson && typeof row.detailsJson === 'object' ? (row.detailsJson as AnalyticsDataTrustResult) : null
        if (!details) {
          return null
        }
        return {
          ...details,
          environment: row.environment,
        }
      })
  }

  getHistory(limit = 10): Promise<AnalyticsDataTrustHistoryItem[]> {
    return listAnalyticsDataTrustHistory(this.prisma, limit)
  }
}

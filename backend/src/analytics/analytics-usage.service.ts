import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { AnalyticsRepository } from './analytics.repository'
import type { AnalyticsUsageResponse } from './analytics.types'

const KNOWN_ANALYTICS_ENDPOINTS = [
  '/analytics/insights',
  '/analytics/summary',
  '/analytics/opportunities',
  '/analytics/export/canonical',
  '/analytics/export/report',
  '/analytics/export/runs',
  '/analytics/data-parity',
  '/analytics/usage',
] as const

@Injectable()
export class AnalyticsUsageService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async recordUsage(input: {
    endpoint: string
    userId?: number | null
    timeRange: string
    filters?: Record<string, unknown> | null
    responseTimeMs: number
    responseSize: number
    trustLevel: string
    hasData: boolean
  }) {
    return this.repository.createUsageEvent({
      endpoint: input.endpoint,
      userId: input.userId ?? null,
      timeRange: input.timeRange,
      filters: input.filters ? (input.filters as Prisma.InputJsonValue) : null,
      responseTimeMs: input.responseTimeMs,
      responseSize: input.responseSize,
      trustLevel: input.trustLevel,
      hasData: input.hasData,
    })
  }

  async recordEndpointUsage(input: {
    endpoint: string
    userId?: string | null
    statusCode: number
    durationMs: number
  }) {
    return this.repository.createEndpointUsage({
      endpoint: input.endpoint,
      userId: input.userId ?? null,
      statusCode: input.statusCode,
      durationMs: input.durationMs,
    })
  }

  async getUsageOverview(limit = 100): Promise<AnalyticsUsageResponse> {
    const endpoints = await this.repository.listEndpointUsageByEndpoint(limit)
    const daily = await this.repository.listEndpointUsageDaily(30)
    const history = await this.repository.listEndpointUsage(limit)
    const usedEndpoints = new Set(endpoints.map((entry) => entry.endpoint))
    return {
      endpoints,
      requestsByDay: daily,
      unusedEndpoints: KNOWN_ANALYTICS_ENDPOINTS.filter((endpoint) => !usedEndpoints.has(endpoint)),
      history,
    }
  }
}

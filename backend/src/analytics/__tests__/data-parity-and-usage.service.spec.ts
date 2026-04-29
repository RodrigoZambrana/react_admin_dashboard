import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AnalyticsDataParityService } from '../data-parity/analytics-data-parity.service'
import { AnalyticsUsageService } from '../analytics-usage.service'

describe('AnalyticsDataParityService', () => {
  const repository = {
    listDataParityChecks: vi.fn(),
    listBaselineChecks: vi.fn(),
    listDataAnomalies: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('summarizes parity checks by status and source without changing the public shape', async () => {
    repository.listDataParityChecks.mockResolvedValueOnce([
      {
        id: '1',
        source: 'ga4',
        metric: 'revenue',
        dateFrom: '2026-04-01',
        dateTo: '2026-04-07',
        apiValue: 1000,
        baselineValue: 980,
        deltaAbs: 20,
        deltaPercent: 2.04,
        status: 'aligned',
        snapshotGroup: 'group-a',
        createdAt: '2026-04-07T12:00:00.000Z',
      },
      {
        id: '2',
        source: 'ads',
        metric: 'clicks',
        dateFrom: '2026-04-01',
        dateTo: '2026-04-07',
        apiValue: 500,
        baselineValue: 480,
        deltaAbs: 20,
        deltaPercent: 4.17,
        status: 'warning',
        snapshotGroup: 'group-a',
        createdAt: '2026-04-07T13:00:00.000Z',
      },
      {
        id: '3',
        source: 'search_console',
        metric: 'impressions',
        dateFrom: '2026-04-01',
        dateTo: '2026-04-07',
        apiValue: 100,
        baselineValue: 130,
        deltaAbs: 30,
        deltaPercent: -23.08,
        status: 'mismatch',
        snapshotGroup: 'group-a',
        createdAt: '2026-04-07T14:00:00.000Z',
      },
    ])
    repository.listBaselineChecks.mockResolvedValueOnce([])
    repository.listDataAnomalies.mockResolvedValueOnce([])

    const service = new AnalyticsDataParityService(repository as never)
    const result = await service.getParityOverview(50)

    expect(result.summary).toEqual({
      aligned: 1,
      warning: 1,
      mismatch: 1,
      missing: 0,
      total: 3,
    })
    expect(result.overallStatus).toBe('fail')
    expect(result.lastRunAt).toBe('2026-04-07T12:00:00.000Z')
    expect(result.bySource.ga4).toHaveLength(1)
    expect(result.bySource.ads).toHaveLength(1)
    expect(result.bySource.search_console).toHaveLength(1)
    expect(result.history).toHaveLength(3)
    expect(result.history[0]).toMatchObject({
      source: 'ga4',
      metric: 'revenue',
      status: 'aligned',
    })
  })

  it('marks parity as degraded when the latest checks only contain warnings', async () => {
    repository.listDataParityChecks.mockResolvedValueOnce([
      {
        id: '1',
        source: 'ga4',
        metric: 'sessions',
        dateFrom: '2026-04-01',
        dateTo: '2026-04-07',
        apiValue: 1000,
        baselineValue: 970,
        deltaAbs: 30,
        deltaPercent: 3.09,
        status: 'warning',
        snapshotGroup: 'group-b',
        createdAt: '2026-04-07T15:00:00.000Z',
      },
    ])
    repository.listBaselineChecks.mockResolvedValueOnce([])
    repository.listDataAnomalies.mockResolvedValueOnce([])

    const service = new AnalyticsDataParityService(repository as never)
    const result = await service.getParityOverview()

    expect(result.overallStatus).toBe('degraded')
    expect(result.summary).toEqual({
      aligned: 0,
      warning: 1,
      mismatch: 0,
      missing: 0,
      total: 1,
    })
  })
})

describe('AnalyticsUsageService', () => {
  const repository = {
    createUsageEvent: vi.fn(),
    listEndpointUsageByEndpoint: vi.fn(),
    listEndpointUsageDaily: vi.fn(),
    listEndpointUsage: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('persists usage events with the expected structured payload', async () => {
    repository.createUsageEvent.mockResolvedValueOnce({
      id: 'usage-1',
    })

    const service = new AnalyticsUsageService(repository as never)
    const result = await service.recordUsage({
      endpoint: '/analytics/insights',
      userId: 42,
      timeRange: '2026-04-01:2026-04-07',
      filters: {
        from: '2026-04-01',
        to: '2026-04-07',
        reportKey: 'analytics_reporting_daily',
      },
      responseTimeMs: 123,
      responseSize: 4567,
      trustLevel: 'ok',
      hasData: true,
    })

    expect(result).toEqual({ id: 'usage-1' })
    expect(repository.createUsageEvent).toHaveBeenCalledWith({
      endpoint: '/analytics/insights',
      userId: 42,
      timeRange: '2026-04-01:2026-04-07',
      filters: {
        from: '2026-04-01',
        to: '2026-04-07',
        reportKey: 'analytics_reporting_daily',
      },
      responseTimeMs: 123,
      responseSize: 4567,
      trustLevel: 'ok',
      hasData: true,
    })
  })

  it('returns usage overview with endpoint aggregates and history intact', async () => {
    repository.listEndpointUsageByEndpoint.mockResolvedValueOnce([
      {
        endpoint: '/analytics/insights',
        calls: 12,
        avgLatency: 180,
        errorRate: 0.25,
        lastCalledAt: '2026-04-07T12:00:00.000Z',
      },
    ])
    repository.listEndpointUsageDaily.mockResolvedValueOnce([
      { date: '2026-04-07', calls: 12, errorRate: 0.25 },
    ])
    repository.listEndpointUsage.mockResolvedValueOnce([
      {
        id: 'usage-1',
        endpoint: '/analytics/insights',
        userId: '42',
        statusCode: 200,
        durationMs: 123,
        createdAt: '2026-04-07T12:00:00.000Z',
      },
    ])

    const service = new AnalyticsUsageService(repository as never)
    const result = await service.getUsageOverview(25)

    expect(result.endpoints).toEqual([
      {
        endpoint: '/analytics/insights',
        calls: 12,
        avgLatency: 180,
        errorRate: 0.25,
        lastCalledAt: '2026-04-07T12:00:00.000Z',
      },
    ])
    expect(result.requestsByDay).toEqual([{ date: '2026-04-07', calls: 12, errorRate: 0.25 }])
    expect(result.unusedEndpoints).toContain('/analytics/summary')
    expect(result.history).toHaveLength(1)
    expect(result.history[0]).toMatchObject({
      endpoint: '/analytics/insights',
      statusCode: 200,
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AnalyticsExportService } from '../analytics-export.service'
import { buildAnalyticsDimensionHash } from '../dimensions/analytics-dimension-hash'

const collectStream = async (stream: AsyncIterable<unknown>) => {
  let output = ''
  for await (const chunk of stream) {
    output += String(chunk)
  }
  return output
}

describe('AnalyticsExportService', () => {
  const repository = {
    createExportRun: vi.fn(),
    updateExportRun: vi.fn(),
    listExportRuns: vi.fn(),
    getExportRunById: vi.fn(),
    listReportingDailyBatch: vi.fn(),
    listAdsDailyMetricsBatch: vi.fn(),
    listSearchConsoleDailyMetricsBatch: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    repository.createExportRun.mockResolvedValue({
      id: 'export-run-1',
    })
    repository.updateExportRun.mockResolvedValue({
      id: 'export-run-1',
    })
  })

  it('exports canonical CSV rows with shared dimension_hash and records the export run', async () => {
    repository.listReportingDailyBatch.mockResolvedValueOnce([
      {
        id: '1',
        date: '2026-04-01T00:00:00.000Z',
        channel: 'google',
        source: 'google',
        medium: 'cpc',
        campaign: 'brand',
        productId: null,
        landingPage: '/home',
        device: 'mobile',
        country: 'uy',
        sessions: 12,
        users: 10,
        revenue: 100,
        orders: 2,
        cost: 9.5,
        impressions: 40,
        clicks: 8,
        views: 0,
        addToCart: 0,
        eventCount: 0,
        keyEvents: 0,
        ga4PurchaseProxy: 0,
        purchase: 2,
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ])
    repository.listReportingDailyBatch.mockResolvedValueOnce([])
    repository.listAdsDailyMetricsBatch.mockResolvedValue([])
    repository.listSearchConsoleDailyMetricsBatch.mockResolvedValue([])

    const service = new AnalyticsExportService(repository as never)
    const result = await service.exportCanonical({
      from: '2026-04-01',
      to: '2026-04-01',
      source: 'ga4',
      granularity: 'daily',
    })

    const csv = await collectStream(result.stream)
    const expectedHash = buildAnalyticsDimensionHash({
      date: '2026-04-01',
      source: 'ga4',
      channel: 'google',
      campaign: 'brand',
      device: 'mobile',
      country: 'uy',
      landing_page: '/home',
    })

    expect(csv).toContain('date,source,metric,metric_value,channel,campaign,device,country,landing_page,dimension_hash,data_origin')
    expect(csv).toContain(`2026-04-01,ga4,sessions,12,google,brand,mobile,uy,/home,${expectedHash},api`)
    expect(repository.createExportRun).toHaveBeenCalledWith(
      expect.objectContaining({
        exportType: 'canonical',
        source: 'ga4',
        fileFormat: 'csv',
        status: 'running',
      }),
    )
    expect(repository.updateExportRun).toHaveBeenCalledWith(
      'export-run-1',
      expect.objectContaining({
        status: 'success',
        rowCount: 13,
      }),
    )
    expect(result.metadata).toMatchObject({
      export_type: 'canonical',
      source: 'ga4',
      granularity: 'daily',
      data_origin: 'api',
    })
  })

  it('exports report-aligned CSV rows with the expected human-readable shape', async () => {
    repository.listReportingDailyBatch.mockResolvedValueOnce([
      {
        id: '1',
        date: '2026-04-01T00:00:00.000Z',
        channel: 'google',
        source: 'google',
        medium: 'cpc',
        campaign: 'brand',
        productId: null,
        landingPage: '/home',
        device: 'mobile',
        country: 'uy',
        sessions: 12,
        users: 10,
        revenue: 100,
        orders: 2,
        cost: 9.5,
        impressions: 40,
        clicks: 8,
        views: 0,
        addToCart: 0,
        eventCount: 0,
        keyEvents: 0,
        ga4PurchaseProxy: 0,
        purchase: 2,
        createdAt: '2026-04-01T00:00:00.000Z',
      },
    ])
    repository.listReportingDailyBatch.mockResolvedValueOnce([])

    const service = new AnalyticsExportService(repository as never)
    const result = await service.exportReport({
      report: 'ga4_overview',
      from: '2026-04-01',
      to: '2026-04-01',
    })

    const csv = await collectStream(result.stream)

    expect(csv).toContain('date,source,medium,sessions,users,revenue')
    expect(csv).toContain('2026-04-01,ga4,cpc,12,10,100')
    expect(result.metadata).toMatchObject({
      report_type: 'ga4_overview',
      data_origin: 'api',
    })
  })

  it('lists export runs with filters and returns a stable summary shape', async () => {
    repository.listExportRuns.mockResolvedValue({
      total: 1,
      items: [
        {
          id: 'export-run-1',
          exportType: 'canonical',
          source: 'ga4',
          dateFrom: new Date('2026-04-01T00:00:00.000Z'),
          dateTo: new Date('2026-04-30T00:00:00.000Z'),
          filters: { from: '2026-04-01', to: '2026-04-30' },
          rowCount: 12,
          fileFormat: 'csv',
          status: 'success',
          errorMessage: null,
          durationMs: 1200,
          fileSize: 4096,
          createdAt: new Date('2026-04-30T12:00:00.000Z'),
        },
      ],
    })

    const service = new AnalyticsExportService(repository as never)
    const result = await service.listRuns({
      limit: 20,
      offset: 0,
      exportType: 'canonical',
      source: 'ga4',
      status: 'success',
    })

    expect(repository.listExportRuns).toHaveBeenCalledWith({
      limit: 20,
      offset: 0,
      exportType: 'canonical',
      source: 'ga4',
      status: 'success',
    })
    expect(result).toEqual({
      total: 1,
      items: [
        expect.objectContaining({
          id: 'export-run-1',
          exportType: 'canonical',
          source: 'ga4',
          rowCount: 12,
          durationMs: 1200,
          fileSize: 4096,
        }),
      ],
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AnalyticsService } from '../analytics.service'

const buildSearchEvent = (overrides: Record<string, unknown>) => ({
  id: `raw-${Math.random().toString(16).slice(2)}`,
  tenantId: 'urucortinas',
  schemaVersion: 1,
  eventName: 'search',
  timestamp: new Date('2026-05-02T12:00:00.000Z'),
  sessionId: 'session-1',
  userId: null,
  page: '/shop',
  path: '/shop',
  payload: {},
  processed: false,
  ...overrides,
})

describe('AnalyticsService search intelligence', () => {
  const repository = {
    listEvents: vi.fn(),
  }

  const metaCapiService = {
    sendEvent: vi.fn().mockResolvedValue({ status: 'skipped' }),
  }

  const config = {
    get: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('summarizes intent and exact-result search signals by tenant and query', async () => {
    repository.listEvents.mockResolvedValueOnce([
      buildSearchEvent({
        tenantId: 'tenant-a',
        eventId: 'search-1',
        timestamp: new Date('2026-05-02T12:00:00.000Z'),
        payload: {
          event: 'search',
          event_name: 'search',
          tenant_id: 'tenant-a',
          schema_version: 1,
          timestamp: '2026-05-02T12:00:00.000Z',
          data: {
            query: 'Puertas corredizas',
            query_normalized: 'puertas corredizas',
            search_stage: 'intent',
            search_source: 'search_input',
          },
        },
      }),
      buildSearchEvent({
        tenantId: 'tenant-a',
        eventId: 'search-2',
        timestamp: new Date('2026-05-02T12:00:01.000Z'),
        payload: {
          event: 'search',
          event_name: 'search',
          tenant_id: 'tenant-a',
          schema_version: 1,
          timestamp: '2026-05-02T12:00:01.000Z',
          data: {
            query: 'Puertas corredizas',
            query_normalized: 'puertas corredizas',
            search_stage: 'results',
            search_source: 'shop_results',
            result_count: 12,
            exact_match_count: 2,
            has_results: true,
            has_exact_results: true,
            category_slug: 'aberturas',
            category_label: 'Aberturas',
          },
        },
      }),
      buildSearchEvent({
        tenantId: 'tenant-b',
        eventId: 'search-3',
        timestamp: new Date('2026-05-02T12:00:02.000Z'),
        payload: {
          event: 'search',
          event_name: 'search',
          tenant_id: 'tenant-b',
          schema_version: 1,
          timestamp: '2026-05-02T12:00:02.000Z',
          data: {
            query: 'Ventana doble',
            query_normalized: 'ventana doble',
            search_stage: 'results',
            search_source: 'shop_results',
            result_count: 0,
            exact_match_count: 0,
            has_results: false,
            has_exact_results: false,
            category_slug: null,
            category_label: null,
          },
        },
      }),
    ])

    const service = new AnalyticsService(repository as never, metaCapiService as never, config as never)
    const result = await service.getSearchIntelligence({
      from: '2026-05-02T00:00:00.000Z',
      to: '2026-05-02T23:59:59.000Z',
      tenantId: 'tenant-a',
    })

    expect(repository.listEvents).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Date),
      ['search'],
      'tenant-a',
    )
    expect(result.searchIntelligence.totals.searchEvents).toBe(3)
    expect(result.searchIntelligence.totals.intentEvents).toBe(1)
    expect(result.searchIntelligence.totals.resultEvents).toBe(2)
    expect(result.searchIntelligence.totals.exactResultEvents).toBe(1)
    expect(result.searchIntelligence.totals.zeroResultEvents).toBe(1)
    expect(result.searchIntelligence.totals.uniqueQueries).toBe(2)
    expect(result.searchIntelligence.totals.trackingHealthScore).toBeCloseTo(2 / 3, 4)
    expect(result.searchIntelligence.byTenant).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: 'tenant-a',
          searchEvents: 2,
          intentEvents: 1,
          resultEvents: 1,
          uniqueQueries: 1,
          exactResultEvents: 1,
          zeroResultEvents: 0,
        }),
        expect.objectContaining({
          tenantId: 'tenant-b',
          searchEvents: 1,
          intentEvents: 0,
          resultEvents: 1,
          uniqueQueries: 1,
          exactResultEvents: 0,
          zeroResultEvents: 1,
        }),
      ]),
    )
    expect(result.searchIntelligence.topQueries[0]).toEqual(
      expect.objectContaining({
        queryNormalized: 'puertas corredizas',
        resultEvents: 1,
        exactResultEvents: 1,
      }),
    )
    expect(result.searchIntelligence.zeroResultQueries[0]).toEqual(
      expect.objectContaining({
        queryNormalized: 'ventana doble',
        zeroResultEvents: 1,
      }),
    )
    expect(result.searchIntelligence.samples).toHaveLength(3)
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AnalyticsReportingService } from '../reporting/analytics-reporting.service'

const makeDirectEvent = (input: {
  tenantId: string
  eventId: string
  eventName: string
  timestamp: string
  productId?: string
  value?: number
  currency?: string
}) => ({
  id: `raw-${input.eventId}-${Math.random().toString(16).slice(2)}`,
  tenantId: input.tenantId,
  eventName: input.eventName,
  eventId: input.eventId,
  timestamp: new Date(input.timestamp),
  payload: {
    event_name: input.eventName,
    tenant_id: input.tenantId,
    event_id: input.eventId,
    timestamp: input.timestamp,
    product_id: input.productId ?? null,
    value: input.value ?? null,
    currency: input.currency ?? null,
    data: {
      product_id: input.productId ?? null,
      value: input.value ?? null,
      currency: input.currency ?? null,
    },
  },
  value: input.value ?? null,
})

const makeGaRow = (input: {
  eventName: string
  tenantId: string
  eventId: string
  timestamp: string
  productId?: string | null
  value?: number | null
  currency?: string | null
}) => ({
  dimension_0: input.timestamp.slice(0, 10).replace(/-/g, ''),
  dimension_1: input.eventName,
  dimension_2: input.tenantId,
  dimension_3: input.eventId,
  dimension_4: input.timestamp,
  dimension_5: input.productId ?? null,
  dimension_6: input.value ?? null,
  dimension_7: input.currency ?? null,
})

describe('AnalyticsReportingService structural event comparison', () => {
  const repository = {
    listEvents: vi.fn(),
    listEventComparisonSummary: vi.fn(),
    upsertEventComparison: vi.fn(),
    createDataAnomaly: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reconciles direct and GA rows into match, missing and mismatch states with anomalies for purchase mismatches', async () => {
    const directEvents = [
      makeDirectEvent({
        tenantId: 'urucortinas',
        eventId: 'evt-1',
        eventName: 'add_to_cart',
        timestamp: '2026-05-02T12:00:00.000Z',
        productId: 'prod-1',
        value: 120,
        currency: 'USD',
      }),
      makeDirectEvent({
        tenantId: 'urucortinas',
        eventId: 'evt-1',
        eventName: 'add_to_cart',
        timestamp: '2026-05-02T12:00:00.500Z',
        productId: 'prod-1',
        value: 120,
        currency: 'USD',
      }),
      makeDirectEvent({
        tenantId: 'urucortinas',
        eventId: 'evt-2',
        eventName: 'remove_from_cart',
        timestamp: '2026-05-02T12:01:00.000Z',
        productId: 'prod-2',
        value: 80,
        currency: 'USD',
      }),
      makeDirectEvent({
        tenantId: 'urucortinas',
        eventId: 'evt-3',
        eventName: 'purchase',
        timestamp: '2026-05-02T12:02:00.000Z',
        productId: 'prod-3',
        value: 300,
        currency: 'USD',
      }),
    ]

    repository.listEvents.mockResolvedValueOnce(directEvents)
    repository.listEventComparisonSummary.mockResolvedValueOnce({
      tenantId: 'all',
      totalEvents: 4,
      matchCount: 1,
      missingInGaCount: 1,
      missingInDirectCount: 1,
      mismatchCount: 1,
      matchRate: 25,
      trackingHealthScore: 0.25,
      averageTimeDiffMs: 200,
      purchaseMismatchCount: 1,
      fromDate: '2026-05-02T12:00:00.000Z',
      toDate: '2026-05-02T12:02:00.000Z',
    })

    const service = new AnalyticsReportingService(repository as never)
    const result = await service.refreshStructuralEventComparison({
      connectionId: 'conn-1',
      propertyId: 'prop-1',
      reportKey: 'structural_events_by_event_id',
      fromDate: new Date('2026-05-02T00:00:00.000Z'),
      toDate: new Date('2026-05-03T00:00:00.000Z'),
      rows: [
        makeGaRow({
          eventName: 'add_to_cart',
          tenantId: 'urucortinas',
          eventId: 'evt-1',
          timestamp: '2026-05-02T12:00:00.300Z',
          productId: 'prod-1',
          value: 120,
          currency: 'USD',
        }),
        makeGaRow({
          eventName: 'purchase',
          tenantId: 'urucortinas',
          eventId: 'evt-3',
          timestamp: '2026-05-02T12:02:02.000Z',
          productId: 'prod-3',
          value: 301,
          currency: 'USD',
        }),
        makeGaRow({
          eventName: 'select_item',
          tenantId: 'urucortinas',
          eventId: 'evt-4',
          timestamp: '2026-05-02T12:03:00.000Z',
          productId: 'prod-4',
          value: 10,
          currency: 'USD',
        }),
      ],
    })

    expect(result.totalEvents).toBe(4)
    expect(result.comparedEvents).toBe(2)
    expect(result.matchedEvents).toBe(1)
    expect(result.missingInGa).toBe(1)
    expect(result.missingInDirect).toBe(1)
    expect(result.mismatchCount).toBe(1)
    expect(result.duplicateCount).toBe(1)
    expect(result.trackingHealthScore).toBeCloseTo(0.25, 4)
    expect(result.summaries).toHaveLength(1)
    expect(result.summaries[0]).toMatchObject({
      tenantId: 'all',
      purchaseMismatchCount: 1,
    })

    expect(repository.upsertEventComparison).toHaveBeenCalledTimes(4)
    expect(repository.upsertEventComparison).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'urucortinas',
        eventId: 'evt-1',
        eventName: 'add_to_cart',
        existsInDirect: true,
        existsInGa: true,
        status: 'match',
      }),
    )
    expect(repository.upsertEventComparison).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'urucortinas',
        eventId: 'evt-2',
        eventName: 'remove_from_cart',
        existsInDirect: true,
        existsInGa: false,
        status: 'missing_in_ga',
      }),
    )
    expect(repository.upsertEventComparison).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'urucortinas',
        eventId: 'evt-3',
        eventName: 'purchase',
        existsInDirect: true,
        existsInGa: true,
        status: 'mismatch',
        payloadMatch: false,
      }),
    )
    expect(repository.upsertEventComparison).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'urucortinas',
        eventId: 'evt-4',
        eventName: 'select_item',
        existsInDirect: false,
        existsInGa: true,
        status: 'missing_in_direct',
      }),
    )

    expect(repository.createDataAnomaly).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'structural_event_mismatch',
        severity: 'critical',
        metric: 'structural_events_by_event_id',
      }),
    )
    expect(repository.createDataAnomaly).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'duplicate_structural_event',
        metric: 'structural_events_by_event_id',
      }),
    )
  })
})

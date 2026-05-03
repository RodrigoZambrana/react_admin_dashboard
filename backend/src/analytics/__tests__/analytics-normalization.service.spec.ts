import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AnalyticsService } from '../analytics.service'

const buildRawEvent = (overrides: Record<string, unknown>) => ({
  id: `raw-${Math.random().toString(16).slice(2)}`,
  tenantId: 'urucortinas',
  schemaVersion: 1,
  eventName: 'page_view',
  timestamp: new Date('2026-05-02T12:00:00.000Z'),
  sessionId: 'session-1',
  userId: null,
  page: '/shop',
  path: '/shop',
  payload: {},
  processed: false,
  ...overrides,
})

describe('AnalyticsService normalization pipeline', () => {
  const repository = {
    listUnprocessedEvents: vi.fn(),
    upsertSession: vi.fn(),
    upsertManyFacts: vi.fn().mockResolvedValue({ count: 3 }),
    markEventsProcessed: vi.fn(),
    createDataAnomaly: vi.fn(),
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

  it('materializes page_view and component_view without requiring CTA ids, and quarantines CTA-bearing events that miss CTA data', async () => {
    repository.listUnprocessedEvents.mockResolvedValueOnce([
      buildRawEvent({
        eventName: 'page_view',
        payload: {
          event: 'page_view',
          event_name: 'page_view',
          tenant_id: 'urucortinas',
          schema_version: 1,
          timestamp: '2026-05-02T12:00:00.000Z',
          page_type: 'home',
          page: '/shop',
          path: '/shop',
        },
      }),
      buildRawEvent({
        eventName: 'component_view',
        payload: {
          event: 'component_view',
          event_name: 'component_view',
          tenant_id: 'urucortinas',
          schema_version: 1,
          timestamp: '2026-05-02T12:00:01.000Z',
          page_type: 'home',
          component_type: 'header',
          component_id: 'storefront_header',
          page: '/shop',
          path: '/shop',
        },
        componentId: 'storefront_header',
        componentType: 'header',
        pageType: 'home',
      }),
      buildRawEvent({
        eventName: 'add_to_cart',
        payload: {
          event: 'add_to_cart',
          event_name: 'add_to_cart',
          tenant_id: 'urucortinas',
          schema_version: 1,
          timestamp: '2026-05-02T12:00:02.000Z',
          page_type: 'product',
          component_type: 'product_intro',
          component_id: 'product_intro_primary_cta',
          page: '/product/demo',
          path: '/product/demo',
        },
        componentId: 'product_intro_primary_cta',
        componentType: 'product_intro',
        pageType: 'product',
      }),
      buildRawEvent({
        eventName: 'purchase',
        payload: {
          event: 'purchase',
          event_name: 'purchase',
          tenant_id: 'urucortinas',
          schema_version: 1,
          timestamp: '2026-05-02T12:00:03.000Z',
          page_type: 'checkout',
          component_type: 'checkout',
          component_id: 'checkout_purchase',
          cta_id: 'checkout.purchase.confirm',
          cta_name: 'purchase',
          cta_type: 'primary',
          page: '/payment/success',
          path: '/payment/success',
        },
        componentId: 'checkout_purchase',
        componentType: 'checkout',
        ctaId: 'checkout.purchase.confirm',
        ctaName: 'purchase',
        ctaType: 'primary',
        pageType: 'checkout',
      }),
    ])

    const service = new AnalyticsService(repository as never, metaCapiService as never, config as never)
    const result = await service.runNormalizationBatch(20)

    expect(result.processed).toBe(4)
    expect(result.factsInserted).toBe(3)
    expect(result.quarantined).toBe(1)
    expect(repository.upsertManyFacts).toHaveBeenCalledTimes(1)
    const inserted = repository.upsertManyFacts.mock.calls[0][0] as Array<Record<string, unknown>>
    expect(inserted.map((row) => row.eventName)).toEqual(['page_view', 'component_view', 'purchase'])
    expect(inserted.find((row) => row.eventName === 'component_view')?.ctaId).toBeUndefined()
    expect(inserted.find((row) => row.eventName === 'page_view')?.ctaId).toBeUndefined()
    expect(repository.createDataAnomaly).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'invalid_structural_event',
        metric: 'add_to_cart',
      }),
    )
    expect(repository.markEventsProcessed).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.any(String),
      ]),
    )
  })
})

import { describe, expect, it, vi } from 'vitest'

import { AnalyticsRepository } from '../analytics.repository'

describe('AnalyticsRepository fact materialization', () => {
  it('upserts event facts by source_event_id so stale rows get refreshed', async () => {
    const upsert = vi.fn().mockImplementation(async (args: { where: { sourceEventId: string } }) => ({
      id: args.where.sourceEventId,
    }))
    const transaction = vi.fn(async (operations: Array<Promise<unknown>>) => Promise.all(operations))

    const prisma = {
      eventFact: {
        upsert,
      },
      $transaction: transaction,
    } as never

    const repository = new AnalyticsRepository(prisma)
    const result = await repository.upsertManyFacts([
      {
        sourceEventId: 'raw-1',
        tenantId: 'urucortinas',
        schemaVersion: 1,
        ingestionSource: 'direct',
        ingestionPath: 'frontend_api',
        eventName: 'add_to_cart',
        eventTimestamp: new Date('2026-05-02T12:00:00.000Z'),
        eventDate: new Date('2026-05-02T00:00:00.000Z'),
        sessionId: 'session-1',
        userId: null,
        page: '/product/demo',
        path: '/product/demo',
        landingPage: '/product/demo',
        productId: 'product-1',
        category: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        utmTerm: null,
        utmContent: null,
        referrer: null,
        device: null,
        country: null,
        value: null,
        eventId: 'event-1',
        fbp: null,
        fbc: null,
        externalTargets: null,
        metaSentAt: null,
        metaEventId: null,
        metaStatus: null,
        source: 'web',
        measurementStatus: 'trusted',
        conversionFlag: false,
        componentType: 'product_intro',
        componentId: 'product_intro_primary_cta',
        ctaId: 'product.detail.add_to_cart.primary',
        ctaName: 'add_to_cart',
        ctaType: 'primary',
        ctaContext: 'ecommerce',
        ctaLocation: 'product_detail',
        position: null,
      },
    ] as never)

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledTimes(1)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceEventId: 'raw-1' },
        create: expect.objectContaining({
          sourceEventId: 'raw-1',
          ctaId: 'product.detail.add_to_cart.primary',
          componentId: 'product_intro_primary_cta',
        }),
        update: expect.objectContaining({
          sourceEventId: 'raw-1',
          ctaId: 'product.detail.add_to_cart.primary',
          componentId: 'product_intro_primary_cta',
        }),
      }),
    )
    expect(result.count).toBe(1)
  })

  it('persists canonical event names without rewriting them', async () => {
    const create = vi.fn().mockImplementation(async (args: { data: { eventName: string } }) => ({
      eventName: args.data.eventName,
    }))

    const prisma = {
      analyticsEvent: {
        create,
      },
    } as never

    const repository = new AnalyticsRepository(prisma)

    await repository.saveEvent({
      event: 'purchase',
      tenant_id: 'urucortinas',
      page_type: 'checkout',
      event_name: 'purchase',
      event_category: 'conversion',
      data: {},
    } as never)

    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          eventName: 'purchase',
          payload: expect.objectContaining({
            event: 'purchase',
            event_name: 'purchase',
          }),
        }),
      }),
    )
  })
})

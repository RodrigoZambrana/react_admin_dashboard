import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { AnalyticsRepository } from './analytics.repository'
import {
  normalizeAnalyticsEventCategory,
  normalizeAnalyticsEventSource,
  normalizeAnalyticsMeasurementStatus,
} from './event-taxonomy'
import type {
  AnalyticsConnection,
  AnalyticsInsight,
  AnalyticsEventInput,
  DashboardMetrics,
  ComparisonMetric,
  ComparisonSeries,
  AnalyticsSyncRun,
  FunnelMetrics,
  FunnelComparison,
} from './analytics.types'

const DEFAULT_FUNNEL_STEPS = ['view_item', 'add_to_cart', 'begin_checkout', 'purchase']

const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const endOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999))

const decimalToNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) {
    return 0
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  const parsed = Number(value.toString())
  return Number.isFinite(parsed) ? parsed : 0
}

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const normalizeTimestamp = (value: string) => {
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? new Date() : timestamp
}

const normalizeEventDate = (value: Date) => startOfDayUtc(value)

const extractItemValue = (event: AnalyticsEventInput) => {
  if (typeof event.value === 'number' && Number.isFinite(event.value)) {
    return event.value
  }

  const data = event.data ?? {}
  const ecommerce = (data.ecommerce as Record<string, unknown> | undefined) ?? undefined
  const ecommerceValue = asNumber(ecommerce?.value)
  if (ecommerceValue !== null) {
    return ecommerceValue
  }

  return asNumber(data.value) ?? null
}

const extractProductId = (event: AnalyticsEventInput) => {
  const data = event.data ?? {}
  const ecommerce = (data.ecommerce as Record<string, unknown> | undefined) ?? undefined
  const items = Array.isArray(ecommerce?.items) ? ecommerce.items : []
  const firstItem = items[0] as Record<string, unknown> | undefined
  const firstItemId = asString(firstItem?.item_id)
  if (firstItemId) {
    return firstItemId
  }
  return asString(data.product_id) ?? asString(data.productId)
}

const extractCategory = (event: AnalyticsEventInput) => {
  const data = event.data ?? {}
  return asString(event.category) ?? asString(event.eventCategory) ?? asString(data.category) ?? asString(data.product_category)
}

const extractSource = (event: AnalyticsEventInput) => {
  const data = event.data ?? {}
  return asString(event.source) ?? asString(data.source)
}

const extractMeasurementStatus = (event: AnalyticsEventInput) => {
  const data = event.data ?? {}
  return (
    asString(event.measurement_status) ??
    asString(event.measurementStatus) ??
    asString(data.measurement_status) ??
    asString(data.measurementStatus)
  )
}

const toDayKey = (value: Date) => value.toISOString().slice(0, 10)

const createComparisonMetric = (current: number, previous: number): ComparisonMetric => {
  const delta = current - previous
  const deltaPercent = previous === 0 ? null : Number(((delta / previous) * 100).toFixed(2))
  return {
    current,
    previous,
    delta,
    deltaPercent,
  }
}

const createComparisonSeries = (current: {
  revenue: number
  orders: number
  avgTicket: number
  conversionRate: number
}, previous: {
  revenue: number
  orders: number
  avgTicket: number
  conversionRate: number
}): ComparisonSeries => ({
  revenue: createComparisonMetric(current.revenue, previous.revenue),
  orders: createComparisonMetric(current.orders, previous.orders),
  avgTicket: createComparisonMetric(current.avgTicket, previous.avgTicket),
  conversionRate: createComparisonMetric(current.conversionRate, previous.conversionRate),
})

const createFunnelComparison = (
  current: { steps: Record<string, number>; rates: FunnelMetrics['rates'] },
  previous: { steps: Record<string, number>; rates: FunnelMetrics['rates'] },
): FunnelComparison => ({
  steps: Object.fromEntries(
    Object.keys(current.steps).map((step) => [
      step,
      createComparisonMetric(current.steps[step] ?? 0, previous.steps[step] ?? 0),
    ]),
  ),
  rates: {
    viewToCart: createComparisonMetric(current.rates.viewToCart ?? 0, previous.rates.viewToCart ?? 0),
    cartToCheckout: createComparisonMetric(
      current.rates.cartToCheckout ?? 0,
      previous.rates.cartToCheckout ?? 0,
    ),
    checkoutToPurchase: createComparisonMetric(
      current.rates.checkoutToPurchase ?? 0,
      previous.rates.checkoutToPurchase ?? 0,
    ),
  },
})

const normalizeFactRecord = (
  rawEvent: Awaited<ReturnType<AnalyticsRepository['listUnprocessedEvents']>>[number],
) => {
  const payload = rawEvent.payload as Record<string, unknown> | null | undefined
  const event = asString(payload?.event) ?? rawEvent.eventName
  const timestamp = normalizeTimestamp(
    asString(payload?.timestamp) ?? rawEvent.timestamp.toISOString(),
  )
  const data =
    (payload?.data as Record<string, unknown> | undefined) ??
    (payload?.metadata as Record<string, unknown> | undefined) ??
    {}
  const eventCategory = normalizeAnalyticsEventCategory(
    asString(payload?.category) ??
      asString(payload?.eventCategory) ??
      extractCategory({
        ...((payload ?? {}) as Record<string, unknown>),
        data,
      } as AnalyticsEventInput),
    event,
  )
  const source = normalizeAnalyticsEventSource(
    asString(payload?.source) ??
      asString(payload?.eventSource) ??
      extractSource({
        ...((payload ?? {}) as Record<string, unknown>),
        data,
      } as AnalyticsEventInput),
  )
  const measurementStatus = normalizeAnalyticsMeasurementStatus(
    asString(payload?.measurement_status) ??
      asString(payload?.measurementStatus) ??
      extractMeasurementStatus({
        ...((payload ?? {}) as Record<string, unknown>),
        data,
      } as AnalyticsEventInput),
    eventCategory,
  )
  const page = asString(payload?.page) ?? asString(data.page)
  const path = asString(payload?.path) ?? asString(data.path)
  const productId =
    asString(payload?.product_id) ??
    asString(payload?.productId) ??
    asString(data.product_id) ??
    asString(data.productId) ??
    extractProductId({
      ...((payload ?? {}) as Record<string, unknown>),
      data,
    } as AnalyticsEventInput)
  const productCategory =
    asString(data.category) ??
    extractCategory({
      ...((payload ?? {}) as Record<string, unknown>),
      data,
    } as AnalyticsEventInput)
  const utmSource =
    asString(payload?.utm_source) ??
    asString(data.utm_source) ??
    asString(rawEvent.payload ? (rawEvent.payload as Record<string, unknown>).utm_source : null)
  const utmMedium = asString(payload?.utm_medium) ?? asString(data.utm_medium)
  const utmCampaign = asString(payload?.utm_campaign) ?? asString(data.utm_campaign)
  const referrer = asString(payload?.referrer) ?? rawEvent.referrer ?? null
  const device = asString(payload?.device) ?? asString(data.device)
  const country = asString(payload?.country) ?? asString(data.country)
  const value = extractItemValue(payload as AnalyticsEventInput) ?? null
  const userId = asString(payload?.user_id) ?? rawEvent.userId ?? null

  return {
    eventName: event,
    eventCategory,
    source,
    measurementStatus,
    eventTimestamp: timestamp,
    eventDate: normalizeEventDate(timestamp),
    sessionId: asString(payload?.session_id) ?? rawEvent.sessionId,
    userId,
    page,
    path,
    productId,
    category: productCategory,
    utmSource,
    utmMedium,
    utmCampaign,
    referrer,
    device,
    country,
    value,
    sourceEventId: rawEvent.id,
  }
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async processEvent(event: AnalyticsEventInput) {
    return this.repository.saveEvent(event)
  }

  async getConnections(): Promise<{ connections: AnalyticsConnection[] }> {
    return {
      connections: await this.repository.listConnections(),
    }
  }

  async getSyncRuns(limit = 50): Promise<{ runs: AnalyticsSyncRun[] }> {
    return {
      runs: await this.repository.listSyncRuns(limit),
    }
  }

  async getInsights(limit = 50): Promise<{ insights: AnalyticsInsight[] }> {
    return {
      insights: await this.repository.listInsights(limit),
    }
  }

  private async buildOverviewMetrics(from: Date, to: Date) {
    const fromDay = startOfDayUtc(from)
    const toDay = endOfDayUtc(to)
    const [orders, sessions, productFacts, funnelFacts] = await Promise.all([
      this.repository.getOrdersInRange(fromDay, toDay),
      this.repository.getSessionCountsByChannel(fromDay, toDay),
      this.repository.getProductFacts(fromDay, toDay),
      this.repository.getEventFactFunnel(fromDay, toDay, DEFAULT_FUNNEL_STEPS),
    ])

    const revenue = orders.reduce((sum, order) => sum + decimalToNumber(order.grandTotal), 0)
    const ordersCount = orders.length
    const avgTicket = ordersCount > 0 ? Number((revenue / ordersCount).toFixed(2)) : 0
    const funnel = Object.fromEntries(
      DEFAULT_FUNNEL_STEPS.map((step) => [step, funnelFacts.get(step)?.sessions.size ?? 0]),
    )
    const viewSessions = funnel['view_item'] ?? 0
    const purchaseSessions = funnel['purchase'] ?? 0
    const conversionRate = viewSessions > 0 ? Number((purchaseSessions / viewSessions).toFixed(4)) : 0

    const channelMap = new Map<
      string | null,
      { utmSource: string | null; revenue: number; orders: number; sessions: number }
    >()
    for (const session of sessions) {
      const key = session.utmSource ?? null
      const current = channelMap.get(key) ?? {
        utmSource: key,
        revenue: 0,
        orders: 0,
        sessions: 0,
      }
      current.sessions += 1
      channelMap.set(key, current)
    }
    for (const order of orders) {
      const key = order.utmSource ?? null
      const current = channelMap.get(key) ?? {
        utmSource: key,
        revenue: 0,
        orders: 0,
        sessions: 0,
      }
      current.revenue += decimalToNumber(order.grandTotal)
      current.orders += 1
      channelMap.set(key, current)
    }

    const productMap = new Map<
      string,
      { productId: string; name: string | null; revenue: number; views: number; purchases: number }
    >()
    for (const order of orders) {
      for (const item of order.items) {
        const productId = item.productId ? String(item.productId) : item.name
        const current = productMap.get(productId) ?? {
          productId,
          name: item.name ?? null,
          revenue: 0,
          views: 0,
          purchases: 0,
        }
        current.name = current.name ?? item.name ?? null
        current.revenue += decimalToNumber(item.price) * item.qty
        current.purchases += item.qty
        productMap.set(productId, current)
      }
    }
    for (const fact of productFacts) {
      if (!fact.productId) {
        continue
      }
      const productId = fact.productId
      const current = productMap.get(productId) ?? {
        productId,
        name: null,
        revenue: 0,
        views: 0,
        purchases: 0,
      }
      if (fact.eventName === 'view_item') {
        current.views += 1
      }
      if (fact.eventName === 'purchase') {
        current.purchases += 1
      }
      productMap.set(productId, current)
    }

    const topProducts = Array.from(productMap.values()).sort((left, right) => right.revenue - left.revenue)
    const channels = Array.from(channelMap.values()).sort((left, right) => right.revenue - left.revenue)

    const revenueByDay = new Map<string, { date: string; revenue: number; orders: number }>()
    for (const order of orders) {
      const date = toDayKey(order.createdAt)
      const current = revenueByDay.get(date) ?? { date, revenue: 0, orders: 0 }
      current.revenue += decimalToNumber(order.grandTotal)
      current.orders += 1
      revenueByDay.set(date, current)
    }

    const timeseries = Array.from(revenueByDay.values()).sort((left, right) => left.date.localeCompare(right.date))

    return {
      from: fromDay,
      to: toDay,
      orders,
      sessions,
      productFacts,
      funnelFacts,
      revenue,
      ordersCount,
      avgTicket,
      funnel,
      conversionRate,
      channels,
      topProducts,
      timeseries,
    }
  }

  private async buildFunnelMetrics(from: Date, to: Date, steps: string[]) {
    const fromDay = startOfDayUtc(from)
    const toDay = endOfDayUtc(to)
    const totals = await this.repository.getEventFactFunnel(fromDay, toDay, steps)

    const stepsMetrics: FunnelMetrics['steps'] = steps.map((step, index) => {
      const bucket = totals.get(step)
      const sessions = bucket?.sessions.size ?? 0
      return {
        eventName: step,
        sessions,
        events: bucket?.events ?? 0,
        conversionFromPrevious: index === 0 ? null : 0,
        conversionFromStart: index === 0 ? 1 : 0,
      }
    })

    let previous = stepsMetrics[0]?.sessions ?? 0
    for (let index = 1; index < stepsMetrics.length; index += 1) {
      const current = stepsMetrics[index]
      current.conversionFromPrevious = previous > 0 ? Number((current.sessions / previous).toFixed(4)) : null
      current.conversionFromStart =
        (stepsMetrics[0]?.sessions ?? 0) > 0
          ? Number((current.sessions / (stepsMetrics[0]?.sessions ?? 1)).toFixed(4))
          : null
      previous = current.sessions
    }

    const metricsByStep = Object.fromEntries(stepsMetrics.map((step) => [step.eventName, step.sessions]))
    const viewToCart = metricsByStep.view_item > 0 ? Number((metricsByStep.add_to_cart / metricsByStep.view_item).toFixed(4)) : null
    const cartToCheckout =
      metricsByStep.add_to_cart > 0
        ? Number((metricsByStep.begin_checkout / metricsByStep.add_to_cart).toFixed(4))
        : null
    const checkoutToPurchase =
      metricsByStep.begin_checkout > 0
        ? Number((metricsByStep.purchase / metricsByStep.begin_checkout).toFixed(4))
        : null

    return {
      from: fromDay,
      to: toDay,
      totals: {
        sessions: stepsMetrics[0]?.sessions ?? 0,
        events: stepsMetrics.reduce((sum, step) => sum + step.events, 0),
        purchases: metricsByStep.purchase ?? 0,
        revenue: 0,
        currency: null,
      },
      stepsMetrics,
      rates: {
        viewToCart,
        cartToCheckout,
        checkoutToPurchase,
      },
    }
  }

  async runNormalizationBatch(limit = 1000) {
    const rawEvents = await this.repository.listUnprocessedEvents(limit)
    if (!rawEvents.length) {
      return { processed: 0, sessionsUpdated: 0, factsInserted: 0 }
    }

    const factRows = rawEvents.map((rawEvent) => normalizeFactRecord(rawEvent))
    const sessionSeed = new Map<
      string,
      {
        firstSeen: Date
        lastSeen: Date
        utmSource: string | null
        utmMedium: string | null
        utmCampaign: string | null
        referrer: string | null
      }
    >()

    for (const fact of factRows) {
      const current = sessionSeed.get(fact.sessionId)
      if (!current) {
        sessionSeed.set(fact.sessionId, {
          firstSeen: fact.eventTimestamp,
          lastSeen: fact.eventTimestamp,
          utmSource: fact.utmSource ?? null,
          utmMedium: fact.utmMedium ?? null,
          utmCampaign: fact.utmCampaign ?? null,
          referrer: fact.referrer ?? null,
        })
        continue
      }

      current.firstSeen = current.firstSeen < fact.eventTimestamp ? current.firstSeen : fact.eventTimestamp
      current.lastSeen = current.lastSeen > fact.eventTimestamp ? current.lastSeen : fact.eventTimestamp
      current.utmSource = current.utmSource ?? fact.utmSource ?? null
      current.utmMedium = current.utmMedium ?? fact.utmMedium ?? null
      current.utmCampaign = current.utmCampaign ?? fact.utmCampaign ?? null
      current.referrer = current.referrer ?? fact.referrer ?? null
    }

    await Promise.all(
      Array.from(sessionSeed.entries()).map(([id, value]) =>
        this.repository.upsertSession({
          id,
          firstSeen: value.firstSeen,
          lastSeen: value.lastSeen,
          utmSource: value.utmSource,
          utmMedium: value.utmMedium,
          utmCampaign: value.utmCampaign,
          referrer: value.referrer,
        }),
      ),
    )

    const inserted = await this.repository.upsertManyFacts(
      factRows.map((fact) => ({
        eventName: fact.eventName,
        eventTimestamp: fact.eventTimestamp,
        eventDate: fact.eventDate,
        sessionId: fact.sessionId,
        userId: fact.userId,
        page: fact.page,
        path: fact.path,
        productId: fact.productId,
        category: fact.category,
        utmSource: fact.utmSource,
        utmMedium: fact.utmMedium,
        utmCampaign: fact.utmCampaign,
        referrer: fact.referrer,
        device: fact.device,
        country: fact.country,
        value: fact.value !== null && fact.value !== undefined ? new Prisma.Decimal(fact.value) : null,
        sourceEventId: fact.sourceEventId,
        eventCategory: fact.eventCategory ?? null,
        source: fact.source ?? null,
        measurementStatus: fact.measurementStatus ?? null,
      })),
    )

    await this.repository.markEventsProcessed(rawEvents.map((event) => event.id))

    return {
      processed: rawEvents.length,
      sessionsUpdated: sessionSeed.size,
      factsInserted: inserted.count,
    }
  }

  async runBackfill(from?: string, to?: string, batchSize = 1000) {
    const start = from ? normalizeTimestamp(from) : new Date('1970-01-01T00:00:00.000Z')
    const end = to ? normalizeTimestamp(to) : new Date()
    let totalProcessed = 0
    let totalFactsInserted = 0
    let totalSessionsUpdated = 0

    let cursorId: string | undefined
    while (true) {
      const batch = await this.repository.listEventsInRange(start, end, batchSize, cursorId)
      if (!batch.length) {
        break
      }

      const factRows = batch.map((rawEvent) => normalizeFactRecord(rawEvent))
      const sessionSeed = new Map<
        string,
        {
          firstSeen: Date
          lastSeen: Date
          utmSource: string | null
          utmMedium: string | null
          utmCampaign: string | null
          referrer: string | null
        }
      >()

      for (const fact of factRows) {
        const current = sessionSeed.get(fact.sessionId)
        if (!current) {
          sessionSeed.set(fact.sessionId, {
            firstSeen: fact.eventTimestamp,
            lastSeen: fact.eventTimestamp,
            utmSource: fact.utmSource ?? null,
            utmMedium: fact.utmMedium ?? null,
            utmCampaign: fact.utmCampaign ?? null,
            referrer: fact.referrer ?? null,
          })
          continue
        }

        current.firstSeen = current.firstSeen < fact.eventTimestamp ? current.firstSeen : fact.eventTimestamp
        current.lastSeen = current.lastSeen > fact.eventTimestamp ? current.lastSeen : fact.eventTimestamp
        current.utmSource = current.utmSource ?? fact.utmSource ?? null
        current.utmMedium = current.utmMedium ?? fact.utmMedium ?? null
        current.utmCampaign = current.utmCampaign ?? fact.utmCampaign ?? null
        current.referrer = current.referrer ?? fact.referrer ?? null
      }

      await Promise.all(
        Array.from(sessionSeed.entries()).map(([id, value]) =>
          this.repository.upsertSession({
            id,
            firstSeen: value.firstSeen,
            lastSeen: value.lastSeen,
            utmSource: value.utmSource,
            utmMedium: value.utmMedium,
            utmCampaign: value.utmCampaign,
            referrer: value.referrer,
          }),
        ),
      )

      const inserted = await this.repository.upsertManyFacts(
        factRows.map((fact) => ({
          eventName: fact.eventName,
          eventTimestamp: fact.eventTimestamp,
          eventDate: fact.eventDate,
          sessionId: fact.sessionId,
          userId: fact.userId,
          page: fact.page,
          path: fact.path,
          productId: fact.productId,
          category: fact.category,
          utmSource: fact.utmSource,
          utmMedium: fact.utmMedium,
          utmCampaign: fact.utmCampaign,
          referrer: fact.referrer,
          device: fact.device,
          country: fact.country,
          value: fact.value !== null && fact.value !== undefined ? new Prisma.Decimal(fact.value) : null,
          sourceEventId: fact.sourceEventId,
          eventCategory: fact.eventCategory ?? null,
          source: fact.source ?? null,
          measurementStatus: fact.measurementStatus ?? null,
        })),
      )

      await this.repository.markEventsProcessed(batch.map((event) => event.id))

      totalProcessed += batch.length
      totalFactsInserted += inserted.count
      totalSessionsUpdated += sessionSeed.size

      cursorId = batch[batch.length - 1].id
    }

    return {
      processed: totalProcessed,
      sessionsUpdated: totalSessionsUpdated,
      factsInserted: totalFactsInserted,
    }
  }

  async getFunnelMetrics(input?: {
    from?: string
    to?: string
    compareFrom?: string
    compareTo?: string
    steps?: string[]
  }): Promise<FunnelMetrics> {
    const to = input?.to ? normalizeTimestamp(input.to) : new Date()
    const from = input?.from ? normalizeTimestamp(input.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const steps = input?.steps?.length ? input.steps : [...DEFAULT_FUNNEL_STEPS]

    const current = await this.buildFunnelMetrics(from, to, steps)
    let comparison: FunnelMetrics['comparison'] | null = null
    if (input?.compareFrom && input?.compareTo) {
      const previous = await this.buildFunnelMetrics(
        normalizeTimestamp(input.compareFrom),
        normalizeTimestamp(input.compareTo),
        steps,
      )
      comparison = createFunnelComparison(
        {
          steps: Object.fromEntries(
            current.stepsMetrics.map((step) => [step.eventName, step.sessions]),
          ),
          rates: current.rates,
        },
        {
          steps: Object.fromEntries(
            previous.stepsMetrics.map((step) => [step.eventName, step.sessions]),
          ),
          rates: previous.rates,
        },
      )
    }

    return {
      range: {
        from: startOfDayUtc(current.from).toISOString(),
        to: endOfDayUtc(current.to).toISOString(),
      },
      totals: current.totals,
      steps: current.stepsMetrics,
      rates: current.rates,
      comparison,
    }
  }

  async getDashboardMetrics(input?: {
    from?: string
    to?: string
    compareFrom?: string
    compareTo?: string
  }): Promise<DashboardMetrics> {
    const to = input?.to ? normalizeTimestamp(input.to) : new Date()
    const from = input?.from ? normalizeTimestamp(input.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

    const current = await this.buildOverviewMetrics(from, to)
    let comparison: ComparisonSeries | null = null
    if (input?.compareFrom && input?.compareTo) {
      const previous = await this.buildOverviewMetrics(
        normalizeTimestamp(input.compareFrom),
        normalizeTimestamp(input.compareTo),
      )
      comparison = createComparisonSeries(
        {
          revenue: current.revenue,
          orders: current.ordersCount,
          avgTicket: current.avgTicket,
          conversionRate: current.conversionRate,
        },
        {
          revenue: previous.revenue,
          orders: previous.ordersCount,
          avgTicket: previous.avgTicket,
          conversionRate: previous.conversionRate,
        },
      )
    }

    const topProducts = current.topProducts
    const channels = current.channels
    const topChannel = channels[0]?.utmSource ?? null
    const topProduct = topProducts[0]?.name ?? topProducts[0]?.productId ?? null

    const insights: DashboardMetrics['insights'] = []
    if (current.conversionRate > 0 && current.conversionRate < 0.02) {
      insights.push({
        severity: 'warning' as const,
        code: 'LOW_CONVERSION',
        message: 'Conversion rate is below 2%. Review checkout friction and product pages.',
      })
    }
    if (current.funnel['view_item'] > 100 && current.funnel['purchase'] < 5) {
      insights.push({
        severity: 'warning' as const,
        code: 'HIGH_VIEWS_LOW_PURCHASES',
        message: 'High product interest with few purchases. Review pricing, shipping, or product trust signals.',
      })
    }
    for (const channel of channels) {
      if (channel.sessions > 20 && channel.revenue === 0) {
        insights.push({
          severity: 'info' as const,
          code: 'CHANNEL_ZERO_REVENUE',
          message: `Channel ${channel.utmSource ?? 'unknown'} has sessions but no revenue in the selected range.`,
        })
      }
    }

    return {
      range: {
        from: current.from.toISOString(),
        to: current.to.toISOString(),
      },
      revenue: current.revenue,
      orders: current.ordersCount,
      avgTicket: current.avgTicket,
      conversionRate: current.conversionRate,
      funnel: current.funnel,
      timeseries: current.timeseries,
      channels,
      topProducts,
      topChannel,
      topProduct,
      comparison,
      insights,
    }
  }
}

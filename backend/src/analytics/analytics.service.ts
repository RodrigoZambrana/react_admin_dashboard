import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'

import { AnalyticsRepository } from './analytics.repository'
import { MetaCapiService } from './meta-capi.service'
import {
  normalizeAnalyticsEventCategory,
  normalizeAnalyticsEventSource,
  normalizeAnalyticsEventName,
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
  AnalyticsSearchIntelligence,
  AnalyticsSearchIntelligenceSample,
} from './analytics.types'

const DEFAULT_FUNNEL_STEPS = ['view_item', 'add_to_cart', 'begin_checkout', 'purchase']
const CTA_REQUIRED_EVENTS = new Set([
  'select_item',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'add_shipping_info',
  'add_payment_info',
  'purchase',
  'cta_click',
  'filter_applied',
  'sort_applied',
])

const COMPONENT_REQUIRED_EVENTS = new Set([
  'select_item',
  'add_to_cart',
  'remove_from_cart',
  'begin_checkout',
  'add_shipping_info',
  'add_payment_info',
  'purchase',
  'cta_click',
  'component_view',
  'search',
  'filter_applied',
  'sort_applied',
  'error_event',
])

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

const normalizeSearchQuery = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .trim()
    .toLowerCase()

const getPayloadObject = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

const extractSearchSignal = (event: Awaited<ReturnType<AnalyticsRepository['listEvents']>>[number]) => {
  const payload = (event.payload as Record<string, unknown> | undefined) ?? {}
  const data = getPayloadObject(payload.data)
  const metadata = getPayloadObject(payload.metadata)
  const query =
    asString(payload.query) ??
    asString(data.query) ??
    asString(metadata.query) ??
    null
  const normalizedQuery =
    asString(data.query_normalized) ??
    asString(metadata.query_normalized) ??
    (query ? normalizeSearchQuery(query) : '')
  const searchStage =
    asString(data.search_stage) ??
    asString(metadata.search_stage) ??
    asString(payload.search_stage) ??
    (asNumber(data.result_count) !== null || asNumber(metadata.result_count) !== null ? 'results' : 'intent')
  const searchSource =
    asString(data.search_source) ??
    asString(metadata.search_source) ??
    asString(payload.search_source) ??
    null
  const resultCount =
    asNumber(data.result_count) ??
    asNumber(data.results_count) ??
    asNumber(metadata.result_count) ??
    asNumber(metadata.results_count) ??
    asNumber(payload.result_count) ??
    asNumber(payload.results_count)
  const exactMatchCount =
    asNumber(data.exact_match_count) ??
    asNumber(metadata.exact_match_count) ??
    asNumber(payload.exact_match_count)
  const hasResults =
    typeof data.has_results === 'boolean'
      ? data.has_results
      : typeof metadata.has_results === 'boolean'
        ? metadata.has_results
        : resultCount !== null
          ? resultCount > 0
          : false
  const hasExactResults =
    typeof data.has_exact_results === 'boolean'
      ? data.has_exact_results
      : typeof metadata.has_exact_results === 'boolean'
        ? metadata.has_exact_results
        : exactMatchCount !== null
          ? exactMatchCount > 0
          : false
  const categorySlug =
    asString(data.category_slug) ??
    asString(metadata.category_slug) ??
    asString(payload.category_slug) ??
    null
  const categoryLabel =
    asString(data.category_label) ??
    asString(metadata.category_label) ??
    asString(payload.category_label) ??
    null

  return {
    eventId: asString(event.eventId),
    eventName: event.eventName,
    tenantId: event.tenantId,
    timestamp: event.timestamp,
    query,
    normalizedQuery,
    searchStage,
    searchSource,
    resultCount,
    exactMatchCount,
    hasResults,
    hasExactResults,
    categorySlug,
    categoryLabel,
  }
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
  const event = normalizeAnalyticsEventName(asString(payload?.event) ?? rawEvent.eventName) ?? rawEvent.eventName
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
  const conversionFlag = eventCategory === 'conversion'
  const tenantId =
    asString((rawEvent as { tenantId?: string | null }).tenantId) ??
    asString(payload?.tenant_id) ??
    asString((payload?.data as Record<string, unknown> | undefined)?.tenant_id) ??
    null
  const schemaVersion =
    (rawEvent as { schemaVersion?: number | null }).schemaVersion ??
    asNumber(payload?.schema_version) ??
    asNumber((payload?.data as Record<string, unknown> | undefined)?.schema_version) ??
    1
  const page = asString(payload?.page) ?? asString(data.page)
  const path = asString(payload?.path) ?? asString(data.path)
  const pageType =
    asString((rawEvent as { pageType?: string | null }).pageType) ??
    asString(payload?.page_type) ??
    asString(data.page_type) ??
    asString(data.pageType) ??
    null
  const componentType =
    asString((rawEvent as { componentType?: string | null }).componentType) ??
    asString(payload?.component_type) ??
    asString(data.component_type) ??
    asString(data.componentType) ??
    null
  const componentId =
    asString((rawEvent as { componentId?: string | null }).componentId) ??
    asString(payload?.component_id) ??
    asString(data.component_id) ??
    asString(data.componentId) ??
    null
  const ctaId =
    asString((rawEvent as { ctaId?: string | null }).ctaId) ??
    asString(payload?.cta_id) ??
    asString(data.cta_id) ??
    asString(data.ctaId) ??
    null
  const ctaName =
    asString((rawEvent as { ctaName?: string | null }).ctaName) ??
    asString(payload?.cta_name) ??
    asString(data.cta_name) ??
    asString(data.ctaName) ??
    null
  const ctaType =
    asString((rawEvent as { ctaType?: string | null }).ctaType) ??
    asString(payload?.cta_type) ??
    asString(data.cta_type) ??
    asString(data.ctaType) ??
    null
  const ctaContext =
    asString((rawEvent as { ctaContext?: string | null }).ctaContext) ??
    asString(payload?.cta_context) ??
    asString(data.cta_context) ??
    asString(data.ctaContext) ??
    null
  const ctaLocation =
    asString((rawEvent as { ctaLocation?: string | null }).ctaLocation) ??
    asString(payload?.cta_location) ??
    asString(data.cta_location) ??
    asString(data.ctaLocation) ??
    null
  const position =
    (rawEvent as { position?: Prisma.Decimal | number | null }).position ??
    asNumber(payload?.position) ??
    asNumber(data.position) ??
    null
  const landingPage =
    asString(payload?.landing_page) ??
    asString(payload?.landingPage) ??
    asString(data.landing_page) ??
    asString(data.landingPage) ??
    page ??
    path ??
    (() => {
      try {
        return new URL(rawEvent.url).pathname || rawEvent.url
      } catch {
        return rawEvent.url
      }
    })()
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
  const utmTerm = asString(payload?.utm_term) ?? asString(data.utm_term)
  const utmContent = asString(payload?.utm_content) ?? asString(data.utm_content)
  const referrer = asString(payload?.referrer) ?? rawEvent.referrer ?? null
  const device = asString(payload?.device) ?? asString(data.device)
  const country = asString(payload?.country) ?? asString(data.country)
  const value = extractItemValue(payload as AnalyticsEventInput) ?? null
  const userId = asString(payload?.user_id) ?? rawEvent.userId ?? null
  const eventId =
    asString(payload?.event_id) ??
    asString(payload?.eventId) ??
    rawEvent.eventId ??
    null
  const fbp = asString(payload?.fbp) ?? rawEvent.fbp ?? null
  const fbc = asString(payload?.fbc) ?? rawEvent.fbc ?? null
  const externalTargets =
    Array.isArray(payload?.external_targets) && payload?.external_targets.length
      ? (payload.external_targets as string[])
      : Array.isArray(rawEvent.externalTargets)
        ? (rawEvent.externalTargets as string[])
        : null

  return {
    tenantId,
    schemaVersion,
    eventName: event,
    eventCategory,
    source,
    measurementStatus,
    conversionFlag,
    eventTimestamp: timestamp,
    eventDate: normalizeEventDate(timestamp),
    sessionId: asString(payload?.session_id) ?? rawEvent.sessionId,
    userId,
    page,
    path,
    pageType,
    componentType,
    componentId,
    ctaId,
    ctaName,
    ctaType,
    ctaContext,
    ctaLocation,
    position,
    landingPage,
    productId,
    category: productCategory,
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
    referrer,
    device,
    country,
    value,
    eventId,
    fbp,
    fbc,
    externalTargets,
    metaStatus: asString(rawEvent.metaStatus) ?? null,
    metaEventId: asString(rawEvent.metaEventId) ?? null,
    metaSentAt: rawEvent.metaSentAt ? new Date(rawEvent.metaSentAt) : null,
    sourceEventId: rawEvent.id,
  }
}

const validateStructuralFact = (fact: ReturnType<typeof normalizeFactRecord>) => {
  const issues: string[] = []
  if (!fact.tenantId) {
    issues.push('missing_tenant_id')
  }
  if (!fact.schemaVersion || !Number.isFinite(fact.schemaVersion) || fact.schemaVersion <= 0) {
    issues.push('missing_schema_version')
  }
  if (COMPONENT_REQUIRED_EVENTS.has(fact.eventName) && !fact.componentId) {
    issues.push('missing_component_id')
  }
  if (CTA_REQUIRED_EVENTS.has(fact.eventName) && !fact.ctaId) {
    issues.push('missing_cta_id')
  }
  return issues
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name)

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly metaCapiService: MetaCapiService,
    private readonly config: ConfigService,
  ) {}

  async processEvent(event: AnalyticsEventInput) {
    const tenantId =
      asString(event.tenant_id) ??
      asString((event.data as Record<string, unknown> | undefined)?.tenant_id) ??
      asString(this.config.get<string>('CLIENT_SLUG')) ??
      asString(this.config.get<string>('CLIENT'))

    if (!tenantId) {
      throw new BadRequestException('Missing tenant_id for analytics event ingestion')
    }

    if (!asString(event.tenant_id)) {
      this.logger.warn(
        `Missing tenant_id for analytics event "${event.event}". Falling back to "${tenantId}".`,
      )
    }

    const schemaVersion = Number(
      event.schema_version ?? (event.data as Record<string, unknown> | undefined)?.schema_version ?? 1,
    )
    const normalizedEvent: AnalyticsEventInput = {
      ...event,
      tenant_id: tenantId,
      schema_version: Number.isFinite(schemaVersion) && schemaVersion > 0 ? schemaVersion : 1,
    }

    const structuralPayload = (normalizedEvent.data as Record<string, unknown> | undefined) ?? {}
    const componentId = asString(normalizedEvent.component_id) ?? asString(structuralPayload.component_id)
    const ctaId = asString(normalizedEvent.cta_id) ?? asString(structuralPayload.cta_id)
    if (CTA_REQUIRED_EVENTS.has(normalizedEvent.event) && (!componentId || !ctaId)) {
      this.logger.warn(
        `Structural analytics orphan for "${normalizedEvent.event}" tenant="${tenantId}" component_id="${componentId ?? 'missing'}" cta_id="${ctaId ?? 'missing'}"`,
      )
    }

    const savedEvent = await this.repository.saveEvent(normalizedEvent)
    void this.metaCapiService
      .sendEvent(savedEvent, normalizedEvent)
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        return { status: 'failed', message }
      })
    return savedEvent
  }

  async getStructuralQuality(input?: { from?: string; to?: string }) {
    const to = input?.to ? normalizeTimestamp(input.to) : new Date()
    const from = input?.from ? normalizeTimestamp(input.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const fromDay = startOfDayUtc(from)
    const toDay = endOfDayUtc(to)
    const events = await this.repository.listEvents(fromDay, toDay)

    const summary = {
      totalEvents: events.length,
      invalidEvents: 0,
      orphanEvents: 0,
      missingTenantId: 0,
      missingSchemaVersion: 0,
      missingComponentId: 0,
      missingCtaId: 0,
      byEventName: new Map<string, number>(),
    }

    const samples: Array<{
      event_name: string
      timestamp: string
      tenant_id: string | null
      component_id: string | null
      cta_id: string | null
      issue: string[]
    }> = []

    for (const event of events) {
      const payload = (event.payload as Record<string, unknown>) ?? {}
      const eventName = normalizeAnalyticsEventName(asString(payload.event) ?? event.eventName) ?? event.eventName
      const structuralData = (payload.data as Record<string, unknown> | undefined) ?? {}
      const tenantId =
        asString((event as { tenantId?: string | null }).tenantId) ??
        asString(payload.tenant_id) ??
        asString(structuralData.tenant_id) ??
        null
      const schemaVersion =
        (event as { schemaVersion?: number | null }).schemaVersion ??
        asNumber(payload.schema_version) ??
        asNumber(structuralData.schema_version)
      const componentId =
        asString((event as { componentId?: string | null }).componentId) ??
        asString(payload.component_id) ??
        asString(structuralData.component_id) ??
        null
      const ctaId =
        asString((event as { ctaId?: string | null }).ctaId) ??
        asString(payload.cta_id) ??
        asString(structuralData.cta_id) ??
        null

      summary.byEventName.set(eventName, (summary.byEventName.get(eventName) ?? 0) + 1)

      const issues: string[] = []
      if (!tenantId) {
        summary.missingTenantId += 1
        issues.push('missing_tenant_id')
      }
      if (schemaVersion === null || !Number.isFinite(schemaVersion) || schemaVersion <= 0) {
        summary.missingSchemaVersion += 1
        issues.push('missing_schema_version')
      }
      if (COMPONENT_REQUIRED_EVENTS.has(eventName) && !componentId) {
        summary.missingComponentId += 1
        issues.push('missing_component_id')
      }
      if (CTA_REQUIRED_EVENTS.has(eventName) && !ctaId) {
        summary.missingCtaId += 1
        issues.push('missing_cta_id')
      }

      if (issues.length > 0) {
        summary.invalidEvents += 1
        if (CTA_REQUIRED_EVENTS.has(eventName) && (!componentId || !ctaId)) {
          summary.orphanEvents += 1
        }
        if (samples.length < 25) {
          samples.push({
            event_name: eventName,
            timestamp: event.timestamp.toISOString(),
            tenant_id: tenantId,
            component_id: componentId,
            cta_id: ctaId,
            issue: issues,
          })
        }
      }
    }

    return {
      range: {
        from: fromDay.toISOString(),
        to: toDay.toISOString(),
      },
      totals: {
        totalEvents: summary.totalEvents,
        invalidEvents: summary.invalidEvents,
        orphanEvents: summary.orphanEvents,
        missingTenantId: summary.missingTenantId,
        missingSchemaVersion: summary.missingSchemaVersion,
        missingComponentId: summary.missingComponentId,
        missingCtaId: summary.missingCtaId,
      },
      byEventName: Array.from(summary.byEventName.entries())
        .map(([eventName, count]) => ({ event_name: eventName, count }))
        .sort((a, b) => b.count - a.count),
      samples,
    }
  }

  async getSearchIntelligence(input?: { from?: string; to?: string; tenantId?: string }): Promise<{ searchIntelligence: AnalyticsSearchIntelligence }> {
    const to = input?.to ? normalizeTimestamp(input.to) : new Date()
    const from = input?.from ? normalizeTimestamp(input.from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const fromDay = startOfDayUtc(from)
    const toDay = endOfDayUtc(to)
    const searchEvents = await this.repository.listEvents(fromDay, toDay, ['search'], input?.tenantId?.trim() || undefined)
    const signals = searchEvents.map((event) => extractSearchSignal(event))

    const totalSearchEvents = signals.length
    const resultSignals = signals.filter((signal) => signal.searchStage === 'results')
    const intentSignals = signals.filter((signal) => signal.searchStage !== 'results')
    const exactResultSignals = resultSignals.filter((signal) => signal.hasResults)
    const zeroResultSignals = resultSignals.filter((signal) => !signal.hasResults)
    const searchResultAverage =
      resultSignals.length > 0
        ? Number(
            (
              resultSignals.reduce((sum, signal) => sum + (signal.resultCount ?? 0), 0) /
              resultSignals.length
            ).toFixed(2),
          )
        : null

    const byTenantMap = new Map<
      string,
      {
        searchEvents: number
        intentEvents: number
        resultEvents: number
        uniqueQueries: Set<string>
        exactResultEvents: number
        zeroResultEvents: number
        resultCountSum: number
      }
    >()

    const queryMap = new Map<
      string,
      {
        query: string
        queryNormalized: string
        searchEvents: number
        intentEvents: number
        resultEvents: number
        exactResultEvents: number
        zeroResultEvents: number
        resultCountSum: number
        tenantIds: Set<string>
      }
    >()

    const samples: AnalyticsSearchIntelligenceSample[] = []

    for (const signal of signals) {
      const tenantId = signal.tenantId
      const queryKey = signal.normalizedQuery || signal.query?.trim().toLowerCase() || ''
      const tenantKey = tenantId ?? 'unknown'
      const tenantEntry = byTenantMap.get(tenantKey) ?? {
        searchEvents: 0,
        intentEvents: 0,
        resultEvents: 0,
        uniqueQueries: new Set<string>(),
        exactResultEvents: 0,
        zeroResultEvents: 0,
        resultCountSum: 0,
      }

      tenantEntry.searchEvents += 1
      tenantEntry.uniqueQueries.add(queryKey)
      if (signal.searchStage === 'results') {
        tenantEntry.resultEvents += 1
        tenantEntry.resultCountSum += signal.resultCount ?? 0
        if (signal.hasResults) {
          tenantEntry.exactResultEvents += 1
        } else {
          tenantEntry.zeroResultEvents += 1
        }
      } else {
        tenantEntry.intentEvents += 1
      }
      byTenantMap.set(tenantKey, tenantEntry)

      if (!queryKey) {
        continue
      }

      const queryEntry = queryMap.get(queryKey) ?? {
        query: signal.query ?? queryKey,
        queryNormalized: queryKey,
        searchEvents: 0,
        intentEvents: 0,
        resultEvents: 0,
        exactResultEvents: 0,
        zeroResultEvents: 0,
        resultCountSum: 0,
        tenantIds: new Set<string>(),
      }

      queryEntry.searchEvents += 1
      queryEntry.tenantIds.add(tenantKey)
      if (signal.searchStage === 'results') {
        queryEntry.resultEvents += 1
        queryEntry.resultCountSum += signal.resultCount ?? 0
        if (signal.hasResults) {
          queryEntry.exactResultEvents += 1
        } else {
          queryEntry.zeroResultEvents += 1
        }
      } else {
        queryEntry.intentEvents += 1
      }
      queryMap.set(queryKey, queryEntry)

      if (samples.length < 50) {
        samples.push({
          eventId: signal.eventId,
          tenantId,
          timestamp: signal.timestamp.toISOString(),
          query: signal.query,
          queryNormalized: signal.normalizedQuery,
          searchStage: signal.searchStage,
          searchSource: signal.searchSource,
          resultCount: signal.resultCount,
          exactMatchCount: signal.exactMatchCount,
          hasResults: signal.hasResults,
          hasExactResults: signal.hasExactResults,
          categorySlug: signal.categorySlug,
          categoryLabel: signal.categoryLabel,
        })
      }
    }

    const byTenant = Array.from(byTenantMap.entries())
      .map(([tenantId, summary]) => ({
        tenantId,
        searchEvents: summary.searchEvents,
        intentEvents: summary.intentEvents,
        resultEvents: summary.resultEvents,
        uniqueQueries: summary.uniqueQueries.size,
        exactResultEvents: summary.exactResultEvents,
        zeroResultEvents: summary.zeroResultEvents,
        averageResultCount:
          summary.resultEvents > 0
            ? Number((summary.resultCountSum / summary.resultEvents).toFixed(2))
            : null,
        exactResultRate: summary.resultEvents > 0 ? Number((summary.exactResultEvents / summary.resultEvents).toFixed(4)) : 0,
        zeroResultRate: summary.resultEvents > 0 ? Number((summary.zeroResultEvents / summary.resultEvents).toFixed(4)) : 0,
      }))
      .sort((a, b) => b.searchEvents - a.searchEvents)

    const topQueries = Array.from(queryMap.values())
      .map((entry) => ({
        query: entry.query,
        queryNormalized: entry.queryNormalized,
        searchEvents: entry.searchEvents,
        intentEvents: entry.intentEvents,
        resultEvents: entry.resultEvents,
        exactResultEvents: entry.exactResultEvents,
        zeroResultEvents: entry.zeroResultEvents,
        averageResultCount:
          entry.resultEvents > 0
            ? Number((entry.resultCountSum / entry.resultEvents).toFixed(2))
            : null,
        exactResultRate: entry.resultEvents > 0 ? Number((entry.exactResultEvents / entry.resultEvents).toFixed(4)) : 0,
        zeroResultRate: entry.resultEvents > 0 ? Number((entry.zeroResultEvents / entry.resultEvents).toFixed(4)) : 0,
        tenantIds: Array.from(entry.tenantIds).sort(),
      }))
      .sort((a, b) => b.searchEvents - a.searchEvents)
      .slice(0, 25)

    const zeroResultQueries = topQueries
      .filter((entry) => entry.zeroResultEvents > 0)
      .slice(0, 25)

    const trackingHealthScore = totalSearchEvents > 0 ? Number((resultSignals.length / totalSearchEvents).toFixed(4)) : 0

    return {
      searchIntelligence: {
        range: {
          from: fromDay.toISOString(),
          to: toDay.toISOString(),
        },
        filters: {
          tenantId: input?.tenantId?.trim() || null,
        },
        totals: {
          searchEvents: totalSearchEvents,
          intentEvents: intentSignals.length,
          resultEvents: resultSignals.length,
          uniqueQueries: queryMap.size,
          exactResultEvents: exactResultSignals.length,
          zeroResultEvents: zeroResultSignals.length,
          averageResultCount: searchResultAverage,
          exactResultRate: resultSignals.length > 0 ? Number((exactResultSignals.length / resultSignals.length).toFixed(4)) : 0,
          zeroResultRate: resultSignals.length > 0 ? Number((zeroResultSignals.length / resultSignals.length).toFixed(4)) : 0,
          trackingHealthScore,
        },
        byTenant,
        topQueries,
        zeroResultQueries,
        samples,
      },
    }
  }

  async listStructuralAnomalies(limit = 100) {
    const anomalies = await this.repository.listDataAnomalies(limit)
    return {
      total: anomalies.length,
      anomalies,
    }
  }

  async getConnections(): Promise<{ connections: AnalyticsConnection[] }> {
    await this.metaCapiService.ensureConnection()
    return {
      connections: await this.repository.listConnections(),
    }
  }

  async getMetaMarketingMetrics(input?: { from?: string; to?: string }) {
    const to = input?.to ? normalizeTimestamp(input.to) : new Date()
    const from = input?.from ? normalizeTimestamp(input.from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const fromDay = startOfDayUtc(from)
    const toDay = endOfDayUtc(to)
    await this.metaCapiService.ensureConnection()
    const [connections, rawEvents, reportingRows] = await Promise.all([
      this.repository.listConnections(),
      this.repository.listEvents(fromDay, toDay),
      this.repository.listReportingDaily(fromDay, toDay),
    ])

    const metaSources = new Set(['meta', 'facebook', 'instagram', 'fb', 'ig'])
    const metaEvents = rawEvents.filter((event) => {
      const payload = (event.payload as Record<string, unknown>) ?? {}
      const source = asString(payload.source) ?? event.source ?? null
      const utmSource = asString(payload.utm_source) ?? asString(payload.utmSource) ?? null
      return source === 'meta' || (utmSource ? metaSources.has(utmSource.toLowerCase()) : false)
    })

    const rawEventTotals = new Map<string, number>()
    for (const event of metaEvents) {
      const canonicalEventName = normalizeAnalyticsEventName(event.eventName) ?? event.eventName
      rawEventTotals.set(canonicalEventName, (rawEventTotals.get(canonicalEventName) ?? 0) + 1)
    }

    const reportingMetaRows = reportingRows.filter((row) => {
      const source = row.source?.toLowerCase() ?? row.channel.toLowerCase()
      const channel = row.channel.toLowerCase()
      return metaSources.has(source) || channel.includes('meta') || channel.includes('facebook') || channel.includes('instagram')
    })

    const spend = reportingMetaRows.reduce((sum, row) => sum + row.cost, 0)
    const clicks = reportingMetaRows.reduce((sum, row) => sum + row.clicks, 0)
    const impressions = reportingMetaRows.reduce((sum, row) => sum + row.impressions, 0)
    const viewContent = rawEventTotals.get('view_item') ?? 0
    const lead = (rawEventTotals.get('form_submit') ?? 0) + (rawEventTotals.get('lead_created') ?? 0)
    const purchase = rawEventTotals.get('purchase') ?? 0
    const eventVolume = metaEvents.length
    const matchedEvents = metaEvents.filter((event) => {
      const payload = (event.payload as Record<string, unknown>) ?? {}
      return Boolean(
        event.fbp ||
          event.fbc ||
          event.eventId ||
          payload.fbp ||
          payload.fbc ||
          payload.user_id ||
          payload.userId,
      )
    }).length
    const matchQuality = eventVolume > 0 ? matchedEvents / eventVolume : 0
    const measurementStatus =
      matchQuality >= 0.7
        ? 'ready'
        : matchQuality >= 0.35
          ? 'partial'
          : 'not_ready'
    const connection = connections.find((entry) => entry.source === 'meta') ?? null

    return {
      range: {
        from: fromDay.toISOString(),
        to: toDay.toISOString(),
      },
      connection,
      measurementStatus,
      matchQuality,
      traffic: {
        events: eventVolume,
        sessions: new Set(metaEvents.map((event) => event.sessionId)).size,
      },
      meta_ads: {
        spend,
        clicks,
        impressions,
        events: {
          view_content: viewContent,
          lead,
          purchase,
        },
      },
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
    const validFacts: Array<ReturnType<typeof normalizeFactRecord>> = []
    const invalidFacts: Array<{ fact: ReturnType<typeof normalizeFactRecord>; issues: string[] }> = []
    for (const fact of factRows) {
      const issues = validateStructuralFact(fact)
      if (issues.length > 0) {
        invalidFacts.push({ fact, issues })
        continue
      }
      validFacts.push(fact)
    }

    if (invalidFacts.length > 0) {
      await Promise.all(
        invalidFacts.map(({ fact, issues }) =>
          this.repository.createDataAnomaly({
            type: 'invalid_structural_event',
            source: 'analytics',
            metric: fact.eventName,
            severity: 'high',
            description: [
              `event="${fact.eventName}"`,
              `tenant_id="${fact.tenantId ?? 'missing'}"`,
              `component_id="${fact.componentId ?? 'missing'}"`,
              `cta_id="${fact.ctaId ?? 'missing'}"`,
              `issues=${issues.join(',')}`,
            ].join(' '),
          }),
        ),
      )
    }

    if (!validFacts.length) {
      await this.repository.markEventsProcessed(rawEvents.map((event) => event.id))
      return { processed: rawEvents.length, sessionsUpdated: 0, factsInserted: 0, quarantined: invalidFacts.length }
    }

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

    for (const fact of validFacts) {
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
      validFacts.map((fact) => ({
        tenantId: fact.tenantId as string,
        schemaVersion: fact.schemaVersion ?? 1,
        ingestionSource: 'direct',
        ingestionPath: 'frontend_api',
        eventName: fact.eventName,
        eventTimestamp: fact.eventTimestamp,
        eventDate: fact.eventDate,
        sessionId: fact.sessionId,
        userId: fact.userId,
        page: fact.page,
        path: fact.path,
        landingPage: fact.landingPage,
        productId: fact.productId,
        category: fact.category,
        utmSource: fact.utmSource,
        utmMedium: fact.utmMedium,
        utmCampaign: fact.utmCampaign,
        utmTerm: fact.utmTerm,
        utmContent: fact.utmContent,
        referrer: fact.referrer,
        device: fact.device,
        country: fact.country,
        value: fact.value !== null && fact.value !== undefined ? new Prisma.Decimal(fact.value) : null,
        eventId: fact.eventId ?? null,
        fbp: fact.fbp ?? null,
        fbc: fact.fbc ?? null,
        externalTargets: fact.externalTargets ?? undefined,
        metaSentAt: fact.metaSentAt ?? undefined,
        metaEventId: fact.metaEventId ?? undefined,
        metaStatus: fact.metaStatus ?? undefined,
        sourceEventId: fact.sourceEventId,
        eventCategory: fact.eventCategory ?? null,
        source: fact.source ?? null,
        measurementStatus: fact.measurementStatus ?? null,
        conversionFlag: fact.conversionFlag,
      })),
    )

    await this.repository.markEventsProcessed(rawEvents.map((event) => event.id))

    return {
      processed: rawEvents.length,
      sessionsUpdated: sessionSeed.size,
      factsInserted: inserted.count,
      quarantined: invalidFacts.length,
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
      const validFacts: Array<ReturnType<typeof normalizeFactRecord>> = []
      const invalidFacts: Array<{ fact: ReturnType<typeof normalizeFactRecord>; issues: string[] }> = []
      for (const fact of factRows) {
        const issues = validateStructuralFact(fact)
        if (issues.length > 0) {
          invalidFacts.push({ fact, issues })
          continue
        }
        validFacts.push(fact)
      }

      if (invalidFacts.length > 0) {
        await Promise.all(
          invalidFacts.map(({ fact, issues }) =>
            this.repository.createDataAnomaly({
              type: 'invalid_structural_event',
              source: 'analytics',
              metric: fact.eventName,
              severity: 'high',
              description: [
                `event="${fact.eventName}"`,
                `tenant_id="${fact.tenantId ?? 'missing'}"`,
                `component_id="${fact.componentId ?? 'missing'}"`,
                `cta_id="${fact.ctaId ?? 'missing'}"`,
                `issues=${issues.join(',')}`,
              ].join(' '),
            }),
          ),
        )
      }

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

      for (const fact of validFacts) {
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
        validFacts.map((fact) => ({
          tenantId: fact.tenantId as string,
          schemaVersion: fact.schemaVersion ?? 1,
          ingestionSource: 'direct',
          ingestionPath: 'frontend_api',
          eventName: fact.eventName,
          eventTimestamp: fact.eventTimestamp,
          eventDate: fact.eventDate,
          sessionId: fact.sessionId,
          userId: fact.userId,
          page: fact.page,
          path: fact.path,
          pageType: fact.pageType,
          componentType: fact.componentType,
          componentId: fact.componentId,
          ctaId: fact.ctaId,
          ctaName: fact.ctaName,
          ctaType: fact.ctaType,
          ctaContext: fact.ctaContext,
          ctaLocation: fact.ctaLocation,
          position:
            fact.position !== null && fact.position !== undefined ? new Prisma.Decimal(fact.position) : null,
          landingPage: fact.landingPage,
          productId: fact.productId,
          category: fact.category,
          utmSource: fact.utmSource,
          utmMedium: fact.utmMedium,
          utmCampaign: fact.utmCampaign,
          utmTerm: fact.utmTerm,
          utmContent: fact.utmContent,
          referrer: fact.referrer,
          device: fact.device,
          country: fact.country,
          value: fact.value !== null && fact.value !== undefined ? new Prisma.Decimal(fact.value) : null,
          eventId: fact.eventId ?? null,
          fbp: fact.fbp ?? null,
          fbc: fact.fbc ?? null,
          externalTargets: fact.externalTargets ?? undefined,
          metaSentAt: fact.metaSentAt ?? undefined,
          metaEventId: fact.metaEventId ?? undefined,
          metaStatus: fact.metaStatus ?? undefined,
          sourceEventId: fact.sourceEventId,
          eventCategory: fact.eventCategory ?? null,
          source: fact.source ?? null,
          measurementStatus: fact.measurementStatus ?? null,
          conversionFlag: fact.conversionFlag,
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

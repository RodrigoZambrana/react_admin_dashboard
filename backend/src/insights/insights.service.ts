import { BadRequestException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Prisma } from '@prisma/client'
import { createHash, randomBytes } from 'crypto'

import { AnalyticsService } from '../analytics/analytics.service'
import { PrismaService } from '../prisma/prisma.service'
import { SecureConfigService } from '../common/security/secure-config.service'
import { StorefrontService } from '../storefront/storefront.service'
import { StorefrontProductQueryDto } from '../storefront/dto/product-query.dto'
import { PublicResponseCacheService } from '../common/cache/public-response-cache.service'
import { buildProductSlug } from '../storefront/utils'
import type {
  InsightsApiVersion,
  InsightsCacheState,
  InsightsDateRange,
  InsightsMetricPoint,
  InsightsMeta,
  InsightsResponse,
  InsightsScope,
  InsightsSource,
  InsightsSourceQuality,
  InsightsApiAuthConfig,
  InsightsApiKeyCreateInput,
  InsightsApiKeyCreateResponse,
  InsightsApiKeyCredential,
  InsightsApiKeyListResponse,
  InsightsApiKeySummary,
} from './insights.types'

type DateRangeInput = {
  from?: string
  to?: string
}

type ProductPerformanceRow = {
  productId: string
  name: string
  slug: string
  views: number
  addToCart: number
  purchase: number
  sessions: number
  orders: number
  revenue: number
  cost: number
  conversionRate: number
  addToCartRate: number
}

type SearchQueryRow = {
  query: string
  page: string | null
  impressions: number
  clicks: number
  ctr: number
  position: number
  pages: number
  state: 'quick_win' | 'brand_opportunity' | 'content_gap' | 'weak_signal'
}

type SearchPageRow = {
  page: string
  impressions: number
  clicks: number
  ctr: number
  position: number
  sessions: number
  revenue: number
  orders: number
  state: 'quick_win' | 'content_gap' | 'strong_page' | 'weak_signal'
}

type FunnelStepRow = {
  eventName: string
  sessions: number
  events: number
  rateFromPrevious: number
}

type CtaRow = {
  ctaId: string
  ctaName: string | null
  ctaType: string | null
  ctaContext: string | null
  ctaLocation: string | null
  componentId: string | null
  views: number
  clicks: number
  purchases: number
  ctr: number
  conversionRate: number
}

type SessionRow = {
  sessionId: string
  source: string | null
  medium: string | null
  campaign: string | null
  durationSeconds: number
  firstSeen: string | null
  lastSeen: string | null
}

type TrafficRow = {
  source: string | null
  medium: string | null
  campaign: string | null
  sessions: number
  users: number
  keyEvents: number
  purchases: number
  revenue: number
  conversionRate: number
  sourceStatus: 'ready' | 'partial' | 'not_ready'
}

type AdsCampaignRow = {
  campaign: string | null
  impressions: number
  clicks: number
  cost: number
  conversions: number
  conversionValue: number
  hasConversionData: boolean
  roas: number
  ctr: number
  cpa: number | null
  measurementReady: boolean
  measurementState: 'ready' | 'partial' | 'not_ready'
}

const API_VERSION: InsightsApiVersion = 'v1'
const DEFAULT_TTL_MS = 5 * 60 * 1000
const DEFAULT_PAGE_SIZE = 12
const MAX_LIMIT = 100
const DEFAULT_RANGE_DAYS = 30
const SCOPES: InsightsScope[] = [
  'read:products',
  'read:search',
  'read:analytics',
  'read:ads',
  'read:funnels',
]

const API_AUTH_CONFIG_KEY = 'INSIGHTS_API_AUTH'
const DEFAULT_SERVICE_KEY_NAME = 'analytics-data-access'

const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const endOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999))

const asNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  if (value instanceof Prisma.Decimal) {
    return Number(value.toString())
  }
  return 0
}

const ratio = (numerator: number, denominator: number) =>
  denominator > 0 ? Number((numerator / denominator).toFixed(4)) : 0

const clampInt = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length
        ? Number(value)
        : fallback
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(max, Math.max(min, Math.trunc(parsed)))
}

const buildRange = (input?: DateRangeInput) => {
  const to = input?.to ? new Date(input.to) : new Date()
  if (Number.isNaN(to.getTime())) {
    throw new BadRequestException('invalid_to_date')
  }
  const from = input?.from
    ? new Date(input.from)
    : new Date(Date.now() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000)
  if (Number.isNaN(from.getTime())) {
    throw new BadRequestException('invalid_from_date')
  }
  const fromDay = startOfDayUtc(from)
  const toDay = endOfDayUtc(to)
  if (fromDay > toDay) {
    throw new BadRequestException('from_date_must_be_before_to_date')
  }
  return {
    from: fromDay,
    to: toDay,
    dateRange: {
      from: fromDay.toISOString(),
      to: toDay.toISOString(),
    },
  }
}

const defaultSummary = () => ({})

@Injectable()
export class InsightsService {
  private readonly apiVersion: InsightsApiVersion = API_VERSION

  constructor(
    private readonly prisma: PrismaService,
    private readonly analyticsService: AnalyticsService,
    private readonly storefrontService: StorefrontService,
    private readonly cache: PublicResponseCacheService,
    private readonly config: ConfigService,
    private readonly secureConfig: SecureConfigService,
  ) {}

  async getProductsSearch(query: StorefrontProductQueryDto) {
    const page = clampInt(query.page, 1, 1, 1000)
    const pageSize = clampInt(query.pageSize, DEFAULT_PAGE_SIZE, 1, 48)
    const cacheKey = this.buildCacheKey('products-search', { ...query, page, pageSize })
    return this.cached(cacheKey, async () => {
      const result = await this.storefrontService.listProducts({
        ...query,
        page,
        pageSize,
      })
      const range = this.rollingRange()
      const items = result.data.map((product) => ({
        tenant_id: this.resolveTenantId(),
        date_range: range.dateRange,
        source: 'internal' as const,
        metric_name: 'product_search_hit',
        metric_value: 1,
        dimension: {
          type: 'product',
          value: String(product.slug),
          label: product.name,
        },
        product_id: product.id,
        slug: product.slug,
        name: product.name,
        availability: product.inventoryStatus,
        currency: product.price.currency,
        price: product.price.amount,
        sale_price: product.salePrice?.amount ?? null,
        categories: product.categories ?? [],
        tags: product.tags ?? [],
        rating: product.rating ?? null,
        rating_count: product.ratingCount ?? null,
      }))
      const normalized: InsightsMetricPoint[] = items.map((item) => ({
        tenant_id: item.tenant_id,
        date_range: item.date_range,
        source: 'internal',
        metric_name: 'product_search_hit',
        metric_value: 1,
        dimension: {
          type: 'product',
          value: item.slug,
          label: item.name,
        },
        context: {
          availability: item.availability,
          category_count: item.categories.length,
          rating: item.rating,
        },
      }))

      return {
        data: this.buildEnvelope(result, normalized, {
          items,
          normalized,
          summary: {
            total: result.total,
            page: result.page,
            pageSize: result.pageSize,
            totalPages: result.totalPages,
            query: query.search?.trim() ?? null,
          },
        }),
        meta: this.buildMeta('internal', range.dateRange, 'miss', {
          pagination: {
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
            totalPages: result.totalPages,
          },
        }),
      } satisfies InsightsResponse<(typeof items)[number]>
    })
  }

  async getProductsPerformance(input?: DateRangeInput & { limit?: number }) {
    const range = buildRange(input)
    const limit = clampInt(input?.limit ?? MAX_LIMIT, 20, 1, MAX_LIMIT)
    const cacheKey = this.buildCacheKey('products-performance', { ...input, limit, from: range.dateRange.from, to: range.dateRange.to })
    return this.cached(cacheKey, async () => {
      const rows = await this.prisma.analyticsReportingDaily.groupBy({
        by: ['productId'],
        where: {
          date: { gte: range.from, lte: range.to },
          productId: { not: null },
        },
        _sum: {
          sessions: true,
          users: true,
          revenue: true,
          orders: true,
          cost: true,
          impressions: true,
          clicks: true,
          views: true,
          addToCart: true,
          purchase: true,
        },
      })

      const ranked = rows
        .map((row) => ({
          productId: row.productId ?? null,
          sessions: asNumber(row._sum.sessions),
          users: asNumber(row._sum.users),
          revenue: asNumber(row._sum.revenue),
          orders: asNumber(row._sum.orders),
          cost: asNumber(row._sum.cost),
          impressions: asNumber(row._sum.impressions),
          clicks: asNumber(row._sum.clicks),
          views: asNumber(row._sum.views),
          addToCart: asNumber(row._sum.addToCart),
          purchase: asNumber(row._sum.purchase),
        }))
        .filter((row): row is typeof row & { productId: string } => Boolean(row.productId))
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, limit)

      const productIds = ranked
        .map((row) => Number(row.productId))
        .filter((value) => Number.isInteger(value) && value > 0)
      const products = productIds.length
        ? await this.prisma.product.findMany({
            where: { id: { in: productIds } },
            select: {
              id: true,
              name: true,
              productCode: true,
              salePrice: true,
              costPrice: true,
              currency: true,
              stock: true,
              status: true,
              published: true,
              category: { select: { id: true, name: true } },
            },
          })
        : []
      const productMap = new Map(products.map((product) => [product.id, product] as const))

      const items: ProductPerformanceRow[] = ranked.map((row) => {
        const productId = Number(row.productId)
        const product = productMap.get(productId)
        const name = product?.name ?? `Producto ${row.productId}`
        const slug = buildProductSlug(productId, product?.name ?? row.productId, product?.productCode ?? null)
        const conversionRate = ratio(row.orders, row.sessions)
        const addToCartRate = ratio(row.addToCart, row.views || row.sessions || 1)
        return {
          productId: row.productId,
          name,
          slug,
          views: row.views,
          addToCart: row.addToCart,
          purchase: row.purchase,
          sessions: row.sessions,
          orders: row.orders,
          revenue: row.revenue,
          cost: row.cost,
          conversionRate,
          addToCartRate,
        }
      })
      const normalized: InsightsMetricPoint[] = items.map((item) => ({
        tenant_id: this.resolveTenantId(),
        date_range: range.dateRange,
        source: 'mixed',
        metric_name: 'product_revenue',
        metric_value: item.revenue,
        dimension: {
          type: 'product',
          value: item.slug,
          label: item.name,
        },
        context: {
          sessions: item.sessions,
          views: item.views,
          add_to_cart: item.addToCart,
          orders: item.orders,
          conversion_rate: item.conversionRate,
        },
      }))

      const summary = {
        total_products: items.length,
        total_sessions: items.reduce((sum, item) => sum + item.sessions, 0),
        total_revenue: items.reduce((sum, item) => sum + item.revenue, 0),
        total_orders: items.reduce((sum, item) => sum + item.orders, 0),
        total_add_to_cart: items.reduce((sum, item) => sum + item.addToCart, 0),
      }

      return {
        data: this.buildEnvelope(items, normalized, { items, normalized, summary }),
        meta: this.buildMeta('mixed', range.dateRange, 'miss'),
      } satisfies InsightsResponse<ProductPerformanceRow>
    })
  }

  async getSearchQueries(input?: DateRangeInput & { limit?: number }) {
    const range = buildRange(input)
    const limit = clampInt(input?.limit ?? MAX_LIMIT, 50, 1, MAX_LIMIT)
    const cacheKey = this.buildCacheKey('search-queries', { ...input, limit, from: range.dateRange.from, to: range.dateRange.to })
    return this.cached(cacheKey, async () => {
      const rows = await this.prisma.analyticsSearchConsoleDailyMetric.findMany({
        where: { date: { gte: range.from, lte: range.to } },
        select: { query: true, page: true, clicks: true, impressions: true, ctr: true, position: true, createdAt: true },
      })

      const map = new Map<string, SearchQueryRow & { pageSet: Set<string> }>()
      for (const row of rows) {
        const query = row.query.trim()
        const key = query.toLowerCase()
        const entry = map.get(key) ?? {
          query,
          page: row.page ?? null,
          impressions: 0,
          clicks: 0,
          ctr: 0,
          position: 0,
          pages: 0,
          state: 'weak_signal' as const,
          pageSet: new Set<string>(),
        }
        entry.impressions += row.impressions
        entry.clicks += row.clicks
        entry.position += asNumber(row.position)
        entry.ctr += asNumber(row.ctr)
        if (row.page) {
          entry.pageSet.add(row.page)
          if (!entry.page) {
            entry.page = row.page
          }
        }
        map.set(key, entry)
      }

      const items = Array.from(map.values())
        .map((entry) => {
          const pages = entry.pageSet.size
          const ctr = ratio(entry.clicks, Math.max(1, entry.impressions))
          const position = pages > 0 ? Number((entry.position / pages).toFixed(2)) : 0
          const brandMatch = /urucortinas|urucortina|marca|empresa/iu.test(entry.query)
          const quickWin = entry.impressions >= 10 && ctr < 0.03 && position > 0 && position <= 20
          let state: SearchQueryRow['state'] = 'weak_signal'
          if (brandMatch && ctr >= 0.1) {
            state = 'brand_opportunity'
          } else if (quickWin) {
            state = 'quick_win'
          } else if (entry.impressions >= 10 && ctr < 0.02) {
            state = 'content_gap'
          }
          return {
            query: entry.query,
            page: entry.page,
            impressions: entry.impressions,
            clicks: entry.clicks,
            ctr,
            position,
            pages,
            state,
          }
        })
        .sort((left, right) => right.impressions - left.impressions)
        .slice(0, limit)

      const normalized: InsightsMetricPoint[] = items.map((item) => ({
        tenant_id: this.resolveTenantId(),
        date_range: range.dateRange,
        source: 'search_console',
        metric_name: 'search_query_impressions',
        metric_value: item.impressions,
        dimension: {
          type: 'query',
          value: item.query,
          label: item.page ?? item.query,
        },
        context: {
          clicks: item.clicks,
          ctr: item.ctr,
          position: item.position,
          state: item.state,
        },
      }))

      const summary = {
        total_queries: items.length,
        total_impressions: items.reduce((sum, item) => sum + item.impressions, 0),
        total_clicks: items.reduce((sum, item) => sum + item.clicks, 0),
        brand_opportunities: items.filter((item) => item.state === 'brand_opportunity').length,
        quick_wins: items.filter((item) => item.state === 'quick_win').length,
      }

      return {
        data: this.buildEnvelope(items, normalized, { items, normalized, summary }),
        meta: this.buildMeta('search_console', range.dateRange, 'miss'),
      } satisfies InsightsResponse<SearchQueryRow>
    })
  }

  async getSearchPerformance(input?: DateRangeInput & { limit?: number }) {
    const range = buildRange(input)
    const limit = clampInt(input?.limit ?? MAX_LIMIT, 50, 1, MAX_LIMIT)
    const cacheKey = this.buildCacheKey('search-performance', { ...input, limit, from: range.dateRange.from, to: range.dateRange.to })
    return this.cached(cacheKey, async () => {
      const reportingRows = await this.prisma.analyticsReportingDaily.findMany({
        where: {
          date: { gte: range.from, lte: range.to },
          channel: { contains: 'Organic Search', mode: 'insensitive' },
        },
        select: {
          landingPage: true,
          sessions: true,
          users: true,
          revenue: true,
          orders: true,
          addToCart: true,
          views: true,
          purchase: true,
        },
      })
      const searchRows = await this.prisma.analyticsSearchConsoleDailyMetric.findMany({
        where: { date: { gte: range.from, lte: range.to } },
        select: { page: true, impressions: true, clicks: true, ctr: true, position: true, query: true },
      })

      const reportingMap = new Map<string, {
        page: string
        sessions: number
        users: number
        revenue: number
        orders: number
        addToCart: number
        views: number
        purchase: number
      }>()
      for (const row of reportingRows) {
        const page = row.landingPage?.trim() || 'unknown'
        const entry = reportingMap.get(page) ?? {
          page,
          sessions: 0,
          users: 0,
          revenue: 0,
          orders: 0,
          addToCart: 0,
          views: 0,
          purchase: 0,
        }
        entry.sessions += row.sessions
        entry.users += row.users
        entry.revenue += asNumber(row.revenue)
        entry.orders += row.orders
        entry.addToCart += row.addToCart
        entry.views += row.views
        entry.purchase += row.purchase
        reportingMap.set(page, entry)
      }

      const searchMap = new Map<
        string,
        { impressions: number; clicks: number; ctr: number; position: number; rows: number }
      >()
      for (const row of searchRows) {
        const page = row.page?.trim() || 'unknown'
        const entry = searchMap.get(page) ?? { impressions: 0, clicks: 0, ctr: 0, position: 0, rows: 0 }
        entry.impressions += row.impressions
        entry.clicks += row.clicks
        entry.ctr += asNumber(row.ctr)
        entry.position += asNumber(row.position)
        entry.rows += 1
        searchMap.set(page, entry)
      }

      const pages = Array.from(reportingMap.values())
        .map((row) => {
          const search = searchMap.get(row.page) ?? { impressions: 0, clicks: 0, ctr: 0, position: 0, rows: 0 }
          const ctr = search.impressions > 0 ? ratio(search.clicks, search.impressions) : 0
          const position = search.rows > 0 ? Number((search.position / search.rows).toFixed(2)) : 0
          let state: SearchPageRow['state'] = 'weak_signal'
          if (search.impressions >= 10 && ctr < 0.03 && position > 0 && position <= 20) {
            state = 'quick_win'
          } else if (row.sessions >= 20 && row.orders === 0) {
            state = 'content_gap'
          } else if (row.orders > 0 || row.revenue > 0) {
            state = 'strong_page'
          }
          return {
            page: row.page,
            impressions: search.impressions,
            clicks: search.clicks,
            ctr,
            position,
            sessions: row.sessions,
            revenue: row.revenue,
            orders: row.orders,
            state,
          }
        })
        .sort((left, right) => right.sessions - left.sessions)
        .slice(0, limit)

      const normalized: InsightsMetricPoint[] = pages.map((item) => ({
        tenant_id: this.resolveTenantId(),
        date_range: range.dateRange,
        source: 'mixed',
        metric_name: 'organic_page_sessions',
        metric_value: item.sessions,
        dimension: {
          type: 'landing_page',
          value: item.page,
          label: item.page,
        },
        context: {
          impressions: item.impressions,
          clicks: item.clicks,
          ctr: item.ctr,
          position: item.position,
          revenue: item.revenue,
          orders: item.orders,
          state: item.state,
        },
      }))

      const summary = {
        total_pages: pages.length,
        total_sessions: pages.reduce((sum, item) => sum + item.sessions, 0),
        total_orders: pages.reduce((sum, item) => sum + item.orders, 0),
        total_revenue: pages.reduce((sum, item) => sum + item.revenue, 0),
        quick_wins: pages.filter((item) => item.state === 'quick_win').length,
        content_gaps: pages.filter((item) => item.state === 'content_gap').length,
      }

      return {
        data: this.buildEnvelope(pages, normalized, { items: pages, normalized, summary }),
        meta: this.buildMeta('mixed', range.dateRange, 'miss'),
      } satisfies InsightsResponse<SearchPageRow>
    })
  }

  async getFunnels(input?: DateRangeInput & { compareFrom?: string; compareTo?: string; steps?: string[] }) {
    const range = buildRange(input)
    const compareFrom = input?.compareFrom
    const compareTo = input?.compareTo
    const compareRange =
      compareFrom && compareTo
        ? buildRange({ from: compareFrom, to: compareTo }).dateRange
        : null
    const result = await this.analyticsService.getFunnelMetrics({
      from: range.dateRange.from,
      to: range.dateRange.to,
      compareFrom,
      compareTo,
      steps: input?.steps,
    })

    const items: FunnelStepRow[] = result.steps.map((step) => ({
      eventName: step.eventName,
      sessions: step.sessions,
      events: step.events,
      rateFromPrevious: step.conversionFromPrevious ?? 0,
    }))
    const normalized: InsightsMetricPoint[] = items.map((item, index) => ({
      tenant_id: this.resolveTenantId(),
      date_range: range.dateRange,
      source: 'internal',
      metric_name: `funnel_step_${index + 1}`,
      metric_value: item.sessions,
      dimension: {
        type: 'funnel_step',
        value: item.eventName,
        label: item.eventName,
      },
      context: {
        events: item.events,
        rate_from_previous: item.rateFromPrevious,
      },
    }))

    const summary = {
      totals: result.totals,
      rates: result.rates,
      comparison: result.comparison,
      compare_range: compareRange,
    }
    const quality = await this.getSourceQuality()

    return {
      data: this.buildEnvelope(items, normalized, { items, normalized, summary }),
      meta: {
        ...this.buildMeta('internal', range.dateRange, 'miss'),
        quality: { sources: quality },
      },
    } satisfies InsightsResponse<FunnelStepRow>
  }

  async getCtas(input?: DateRangeInput & { limit?: number }) {
    const range = buildRange(input)
    const limit = clampInt(input?.limit ?? MAX_LIMIT, 30, 1, MAX_LIMIT)
    const cacheKey = this.buildCacheKey('ctas', { ...input, limit, from: range.dateRange.from, to: range.dateRange.to })
    return this.cached(cacheKey, async () => {
      const events = await this.prisma.analyticsEvent.findMany({
        where: {
          timestamp: { gte: range.from, lte: range.to },
          OR: [
            { eventName: 'component_view' },
            { eventName: 'cta_click' },
            { conversionFlag: true },
          ],
        },
        select: {
          ctaId: true,
          ctaName: true,
          ctaType: true,
          ctaContext: true,
          ctaLocation: true,
          componentId: true,
          eventName: true,
          conversionFlag: true,
          sessionId: true,
        },
      })

      const map = new Map<string, CtaRow>()
      for (const event of events) {
        const ctaId = event.ctaId?.trim() || event.componentId?.trim() || 'unknown'
        const entry = map.get(ctaId) ?? {
          ctaId,
          ctaName: event.ctaName ?? null,
          ctaType: event.ctaType ?? null,
          ctaContext: event.ctaContext ?? null,
          ctaLocation: event.ctaLocation ?? null,
          componentId: event.componentId ?? null,
          views: 0,
          clicks: 0,
          purchases: 0,
          ctr: 0,
          conversionRate: 0,
        }
        if (event.eventName === 'component_view') {
          entry.views += 1
        }
        if (event.eventName === 'cta_click') {
          entry.clicks += 1
        }
        if (event.conversionFlag) {
          entry.purchases += 1
        }
        map.set(ctaId, entry)
      }

      const items = Array.from(map.values())
        .map((item) => ({
          ...item,
          ctr: ratio(item.clicks, Math.max(1, item.views)),
          conversionRate: ratio(item.purchases, Math.max(1, item.clicks || item.views)),
        }))
        .sort((left, right) => right.clicks - left.clicks)
        .slice(0, limit)

      const normalized: InsightsMetricPoint[] = items.map((item) => ({
        tenant_id: this.resolveTenantId(),
        date_range: range.dateRange,
        source: 'internal',
        metric_name: 'cta_clicks',
        metric_value: item.clicks,
        dimension: {
          type: 'cta',
          value: item.ctaId,
          label: item.ctaName ?? item.ctaId,
        },
        context: {
          views: item.views,
          purchases: item.purchases,
          ctr: item.ctr,
          conversion_rate: item.conversionRate,
          component_id: item.componentId,
          cta_type: item.ctaType,
          cta_location: item.ctaLocation,
        },
      }))

      const summary = {
        total_ctas: items.length,
        total_views: items.reduce((sum, item) => sum + item.views, 0),
        total_clicks: items.reduce((sum, item) => sum + item.clicks, 0),
        total_purchases: items.reduce((sum, item) => sum + item.purchases, 0),
      }

      return {
        data: this.buildEnvelope(items, normalized, { items, normalized, summary }),
        meta: this.buildMeta('internal', range.dateRange, 'miss'),
      } satisfies InsightsResponse<CtaRow>
    })
  }

  async getSessions(input?: DateRangeInput & { limit?: number }) {
    const range = buildRange(input)
    const limit = clampInt(input?.limit ?? MAX_LIMIT, 50, 1, MAX_LIMIT)
    const cacheKey = this.buildCacheKey('sessions', { ...input, limit, from: range.dateRange.from, to: range.dateRange.to })
    return this.cached(cacheKey, async () => {
      const sessions = await this.prisma.analyticsSession.findMany({
        where: {
          OR: [
            {
              lastSeen: {
                gte: range.from,
                lte: range.to,
              },
            },
            {
              firstSeen: {
                gte: range.from,
                lte: range.to,
              },
            },
          ],
        },
        select: {
          id: true,
          firstSeen: true,
          lastSeen: true,
          utmSource: true,
          utmMedium: true,
          utmCampaign: true,
          referrer: true,
        },
      })

      const items: SessionRow[] = sessions
        .map((session) => {
          const durationSeconds =
            session.firstSeen && session.lastSeen
              ? Math.max(0, Math.round((session.lastSeen.getTime() - session.firstSeen.getTime()) / 1000))
              : 0
          return {
            sessionId: session.id,
            source: session.utmSource ?? null,
            medium: session.utmMedium ?? null,
            campaign: session.utmCampaign ?? null,
            durationSeconds,
            firstSeen: session.firstSeen?.toISOString() ?? null,
            lastSeen: session.lastSeen?.toISOString() ?? null,
          }
        })
        .sort((left, right) => right.durationSeconds - left.durationSeconds)
        .slice(0, limit)

      const dailyRows = await this.prisma.analyticsReportingDaily.findMany({
        where: {
          date: { gte: range.from, lte: range.to },
        },
        select: {
          landingPage: true,
          sessions: true,
          users: true,
          revenue: true,
          orders: true,
          channel: true,
        },
      })
      const pages = Array.from(
        dailyRows.reduce((acc, row) => {
          const page = row.landingPage?.trim() || 'unknown'
          const current =
            acc.get(page) ??
            {
              page,
              sessions: 0,
              users: 0,
              revenue: 0,
              orders: 0,
              channel: row.channel,
            }
          current.sessions += row.sessions
          current.users += row.users
          current.revenue += asNumber(row.revenue)
          current.orders += row.orders
          acc.set(page, current)
          return acc
        }, new Map<string, { page: string; sessions: number; users: number; revenue: number; orders: number; channel: string }>()),
      )
        .map(([, value]) => value)
        .sort((left, right) => right.sessions - left.sessions)
        .slice(0, limit)

      const summary = {
        sessions_count: items.length,
        average_duration_seconds:
          items.length > 0 ? Math.round(items.reduce((sum, item) => sum + item.durationSeconds, 0) / items.length) : 0,
        top_pages: pages.slice(0, 10),
      }

      const normalized: InsightsMetricPoint[] = pages.map((item) => ({
        tenant_id: this.resolveTenantId(),
        date_range: range.dateRange,
        source: 'internal',
        metric_name: 'session_duration',
        metric_value: item.sessions,
        dimension: {
          type: 'landing_page',
          value: item.page,
          label: item.page,
        },
        context: {
          users: item.users,
          revenue: item.revenue,
          orders: item.orders,
          channel: item.channel,
        },
      }))

      return {
        data: this.buildEnvelope(items, normalized, { items, normalized, summary }),
        meta: this.buildMeta('internal', range.dateRange, 'miss'),
      } satisfies InsightsResponse<SessionRow>
    })
  }

  async getExternalGaTraffic(input?: DateRangeInput & { limit?: number }) {
    const range = buildRange(input)
    const limit = clampInt(input?.limit ?? MAX_LIMIT, 20, 1, MAX_LIMIT)
    const cacheKey = this.buildCacheKey('ga-traffic', { ...input, limit, from: range.dateRange.from, to: range.dateRange.to })
    return this.cached(cacheKey, async () => {
      const rows = await this.prisma.analyticsGa4DailyMetric.findMany({
        where: { date: { gte: range.from, lte: range.to } },
        select: {
          source: true,
          medium: true,
          campaign: true,
          sessions: true,
          users: true,
          keyEvents: true,
          purchases: true,
          revenue: true,
        },
      })

      const map = new Map<string, TrafficRow>()
      for (const row of rows) {
        const key = [row.source ?? '(not set)', row.medium ?? '(not set)', row.campaign ?? '(not set)'].join('|')
        const entry = map.get(key) ?? {
          source: row.source ?? null,
          medium: row.medium ?? null,
          campaign: row.campaign ?? null,
          sessions: 0,
          users: 0,
          keyEvents: 0,
          purchases: 0,
          revenue: 0,
          conversionRate: 0,
          sourceStatus: 'ready' as const,
        }
        entry.sessions += row.sessions
        entry.users += row.users
        entry.keyEvents += row.keyEvents
        entry.purchases += row.purchases
        entry.revenue += asNumber(row.revenue)
        map.set(key, entry)
      }

      const sourceQuality = await this.getSourceQuality()
      const items = Array.from(map.values())
        .map((item) => ({
          ...item,
          conversionRate: ratio(item.purchases, item.sessions),
          sourceStatus:
            (sourceQuality.find((source) => source.source === 'ga4')?.status === 'ready'
              ? 'ready'
              : 'partial') as TrafficRow['sourceStatus'],
        }))
        .sort((left, right) => right.sessions - left.sessions)
        .slice(0, limit)

      const normalized: InsightsMetricPoint[] = items.map((item) => ({
        tenant_id: this.resolveTenantId(),
        date_range: range.dateRange,
        source: 'ga',
        metric_name: 'ga_sessions',
        metric_value: item.sessions,
        dimension: {
          type: 'traffic_source',
          value: [item.source, item.medium, item.campaign].filter(Boolean).join(' / ') || 'unknown',
          label: item.campaign ?? item.source ?? 'unknown',
        },
        context: {
          users: item.users,
          key_events: item.keyEvents,
          purchases: item.purchases,
          revenue: item.revenue,
          conversion_rate: item.conversionRate,
          source_status: item.sourceStatus,
        },
      }))

      const summary = {
        total_sessions: items.reduce((sum, item) => sum + item.sessions, 0),
        total_users: items.reduce((sum, item) => sum + item.users, 0),
        total_revenue: items.reduce((sum, item) => sum + item.revenue, 0),
      }

      return {
        data: this.buildEnvelope(items, normalized, { items, normalized, summary }),
        meta: this.buildMeta('ga', range.dateRange, 'miss'),
      } satisfies InsightsResponse<TrafficRow>
    })
  }

  async getExternalAdsCampaigns(input?: DateRangeInput & { limit?: number }) {
    const range = buildRange(input)
    const limit = clampInt(input?.limit ?? MAX_LIMIT, 20, 1, MAX_LIMIT)
    const cacheKey = this.buildCacheKey('ads-campaigns', { ...input, limit, from: range.dateRange.from, to: range.dateRange.to })
    return this.cached(cacheKey, async () => {
      const rows = await this.prisma.analyticsAdsDailyMetric.findMany({
        where: { date: { gte: range.from, lte: range.to } },
        select: {
          campaign: true,
          impressions: true,
          clicks: true,
          cost: true,
          conversions: true,
          conversionValue: true,
          hasConversionData: true,
        },
      })

      const map = new Map<string, AdsCampaignRow>()
      for (const row of rows) {
        const key = row.campaign ?? '(not set)'
        const entry = map.get(key) ?? {
          campaign: row.campaign ?? null,
          impressions: 0,
          clicks: 0,
          cost: 0,
          conversions: 0,
          conversionValue: 0,
          hasConversionData: false,
          roas: 0,
          ctr: 0,
          cpa: null,
          measurementReady: false,
          measurementState: 'not_ready' as const,
        }
        entry.impressions += row.impressions
        entry.clicks += row.clicks
        entry.cost += asNumber(row.cost)
        entry.conversions += row.conversions
        entry.conversionValue += asNumber(row.conversionValue)
        entry.hasConversionData = entry.hasConversionData || row.hasConversionData
        map.set(key, entry)
      }

      const items = Array.from(map.values())
        .map((item) => {
          const measurementReady = item.hasConversionData
          const measurementState: AdsCampaignRow['measurementState'] = measurementReady
            ? 'ready'
            : item.cost > 0 || item.clicks > 0
              ? 'partial'
              : 'not_ready'
          const ctr = ratio(item.clicks, Math.max(1, item.impressions))
          const roas = item.cost > 0 ? Number((item.conversionValue / item.cost).toFixed(2)) : 0
          const cpa = item.conversions > 0 ? Number((item.cost / item.conversions).toFixed(2)) : null
          return {
            ...item,
            measurementReady,
            measurementState,
            ctr,
            roas,
            cpa,
          }
        })
        .sort((left, right) => right.impressions - left.impressions)
        .slice(0, limit)

      const normalized: InsightsMetricPoint[] = items.map((item) => ({
        tenant_id: this.resolveTenantId(),
        date_range: range.dateRange,
        source: 'ads',
        metric_name: 'ads_impressions',
        metric_value: item.impressions,
        dimension: {
          type: 'campaign',
          value: item.campaign ?? '(not set)',
          label: item.campaign ?? '(not set)',
        },
        context: {
          clicks: item.clicks,
          cost: item.cost,
          conversions: item.conversions,
          conversion_value: item.conversionValue,
          has_conversion_data: item.hasConversionData,
          measurement_ready: item.measurementReady,
          roas: item.roas,
          ctr: item.ctr,
        },
      }))

      const measurementReady = items.some((item) => item.measurementReady)
      const summary = {
        total_impressions: items.reduce((sum, item) => sum + item.impressions, 0),
        total_clicks: items.reduce((sum, item) => sum + item.clicks, 0),
        total_cost: items.reduce((sum, item) => sum + item.cost, 0),
        total_conversions: items.reduce((sum, item) => sum + item.conversions, 0),
        total_conversion_value: items.reduce((sum, item) => sum + item.conversionValue, 0),
        conversion_measurement_ready: measurementReady,
      }

      return {
        data: this.buildEnvelope(items, normalized, { items, normalized, summary }),
        meta: this.buildMeta('ads', range.dateRange, 'miss', {
          measurement: {
            conversion_measurement_ready: measurementReady,
            status: items.every((item) => item.measurementReady)
              ? 'ready'
              : items.some((item) => item.measurementReady)
                ? 'partial'
                : 'not_ready',
            confidence: items.length > 0 ? Number((items.filter((item) => item.measurementReady).length / items.length).toFixed(2)) : 0,
          },
        }),
      } satisfies InsightsResponse<AdsCampaignRow>
    })
  }

  async getSourceQuality() {
    const connections = await this.prisma.analyticsConnection.findMany({
      orderBy: [{ source: 'asc' }, { displayName: 'asc' }],
    })
    return connections.map<InsightsSourceQuality>((connection) => ({
      source: connection.source,
      status: connection.status,
      display_name: connection.displayName,
      last_successful_sync_at: connection.lastSuccessfulSyncAt?.toISOString() ?? null,
      last_attempted_sync_at: connection.lastAttemptedSyncAt?.toISOString() ?? null,
      last_sync_error_at: connection.lastSyncErrorAt?.toISOString() ?? null,
      last_sync_error_message: connection.lastSyncErrorMessage ?? null,
      needs_reauth: connection.needsReauth,
      next_sync_at: connection.nextSyncAt?.toISOString() ?? null,
    }))
  }

  async getSourceQualityEnvelope() {
    const quality = await this.getSourceQuality()
    const range = this.rollingRange()
    return {
      data: this.buildEnvelope(quality, [], {
        items: quality,
        normalized: [],
        summary: {
          total_connections: quality.length,
          ready: quality.filter((entry) => entry.status === 'ready').length,
          needs_reauth: quality.filter((entry) => entry.needs_reauth).length,
        },
      }),
      meta: {
        ...this.buildMeta('mixed', range.dateRange, 'miss'),
        quality: { sources: quality },
      },
    }
  }

  async listServiceKeys(): Promise<InsightsApiKeyListResponse> {
    const stored = await this.getStoredApiAuthConfig()
    if (stored) {
      return {
        source: 'database',
        updatedAt: stored.updatedAt.toISOString(),
        credentials: stored.value.credentials.map((credential) =>
          this.toCredentialSummary(credential, 'database'),
        ),
      }
    }

    const credentials = this.buildEnvCredentials().map((credential) =>
      this.toCredentialSummary(credential, 'environment'),
    )

    return {
      source: 'environment',
      updatedAt: null,
      credentials,
    }
  }

  async createServiceKey(input: InsightsApiKeyCreateInput): Promise<InsightsApiKeyCreateResponse> {
    const current = (await this.getStoredApiAuthConfig())?.value ?? {
      version: 1,
      credentials: [],
    }

    const scopes = this.normalizeScopes(input.scopes)
    const name = this.normalizeCredentialName(input.name)
    const token = this.generateServiceToken()
    const tokenHash = this.hashToken(token)
    const createdAt = new Date().toISOString()
    const expiresAt = this.normalizeDateString(input.expiresAt)
    const credential: InsightsApiKeyCredential = {
      name,
      tokenHash,
      tokenPrefix: token.slice(0, 10),
      scopes,
      enabled: input.enabled ?? true,
      expiresAt,
      createdAt,
      lastUsedAt: null,
    }

    const nextCredentials = [
      ...current.credentials.filter((entry) => entry.name !== name),
      credential,
    ]

    const nextConfig: InsightsApiAuthConfig = {
      version: current.version ?? 1,
      credentials: nextCredentials,
    }

    await this.secureConfig.setJson(API_AUTH_CONFIG_KEY, nextConfig)

    return {
      source: 'database',
      updatedAt: createdAt,
      token,
      credential: this.toCredentialSummary(credential, 'database'),
    }
  }

  private rollingRange() {
    const to = new Date()
    const from = new Date(Date.now() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000)
    return {
      from: startOfDayUtc(from),
      to: endOfDayUtc(to),
      dateRange: {
        from: startOfDayUtc(from).toISOString(),
        to: endOfDayUtc(to).toISOString(),
      },
    }
  }

  private resolveTenantId() {
    return (
      this.config.get<string>('CLIENT_SLUG')?.trim() ||
      this.config.get<string>('CLIENT')?.trim() ||
      'global'
    )
  }

  private buildMeta(
    source: InsightsSource,
    dateRange: InsightsDateRange,
    cache: InsightsCacheState,
    extra: Partial<
      Omit<
        InsightsMeta,
        'version' | 'source' | 'generated_at' | 'cache' | 'date_range' | 'tenant_id' | 'requested_scopes' | 'quality'
      >
    > = {},
  ) {
    return {
      version: this.apiVersion,
      source,
      generated_at: new Date().toISOString(),
      cache,
      date_range: dateRange,
      tenant_id: this.resolveTenantId(),
      requested_scopes: SCOPES,
      quality: {
        sources: [],
      },
      ...extra,
    } as InsightsMeta
  }

  private buildEnvelope<TItem, TNormalized>(
    items: TItem[] | Record<string, unknown>,
    normalized: TNormalized,
    payload: {
      items: TItem[]
      normalized: TNormalized
      summary: Record<string, unknown>
    },
  ) {
    return {
      items: Array.isArray(items) ? items : [items as TItem],
      normalized,
      summary: payload.summary ?? defaultSummary(),
    }
  }

  private buildCacheKey(domain: string, payload: unknown) {
    return `insights:${domain}:${JSON.stringify(payload)}`
  }

  private async getStoredApiAuthConfig() {
    try {
      return await this.secureConfig.getJson<InsightsApiAuthConfig>(API_AUTH_CONFIG_KEY)
    } catch {
      return null
    }
  }

  private buildEnvCredentials(): InsightsApiKeyCredential[] {
    const token =
      this.config.get<string>('INSIGHTS_API_KEY')?.trim() ||
      this.config.get<string>('ANALYTICS_INSIGHTS_API_KEY')?.trim() ||
      ''
    if (!token) {
      return []
    }

    const scopes = this.normalizeScopes(
      (this.config.get<string>('INSIGHTS_API_SCOPES')?.trim() || '')
        .split(/[,\s]+/u)
        .map((scope) => scope.trim() as InsightsScope)
        .filter(Boolean),
    )
    const name = this.config.get<string>('INSIGHTS_API_KEY_NAME')?.trim() || 'default'
    const expiresAt = this.config.get<string>('INSIGHTS_API_KEY_EXPIRES_AT')?.trim() || null

    return [
      {
        name,
        token,
        scopes,
        enabled: true,
        expiresAt,
      },
    ]
  }

  private normalizeCredentialName(input?: string | null) {
    const name = input?.trim() || DEFAULT_SERVICE_KEY_NAME
    return name.replace(/\s+/g, '-').toLowerCase()
  }

  private normalizeScopes(input?: InsightsScope[]) {
    if (!input?.length) {
      return [...SCOPES]
    }
    const normalized = input
      .map((scope) => String(scope).trim() as InsightsScope)
      .filter((scope) => SCOPES.includes(scope))
    return normalized.length ? normalized : [...SCOPES]
  }

  private normalizeDateString(value?: string | null) {
    if (!value) {
      return null
    }

    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('invalid_expires_at')
    }

    return parsed.toISOString()
  }

  private generateServiceToken() {
    return `ins_${randomBytes(32).toString('hex')}`
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token, 'utf8').digest('hex')
  }

  private maskPrefix(prefix?: string | null) {
    if (!prefix) {
      return null
    }
    return prefix
  }

  private toCredentialSummary(
    credential: InsightsApiKeyCredential,
    source: 'database' | 'environment',
  ): InsightsApiKeySummary {
    return {
      name: credential.name,
      tokenPrefix: this.maskPrefix(credential.tokenPrefix ?? (credential.token ? credential.token.slice(0, 10) : null)),
      scopes: credential.scopes,
      enabled: credential.enabled !== false,
      expiresAt: credential.expiresAt ?? null,
      createdAt: credential.createdAt ?? null,
      lastUsedAt: credential.lastUsedAt ?? null,
      source,
    }
  }

  private async cached<T>(key: string, loader: () => Promise<InsightsResponse<T>>) {
    const hit = await this.cache.get<InsightsResponse<T>>(key)
    if (hit) {
      return this.attachQuality(hit, 'hit')
    }
    const loaded = await loader()
    await this.cache.set(
      key,
      loaded,
      Number(this.config.get<string>('INSIGHTS_CACHE_TTL_MS') ?? DEFAULT_TTL_MS),
    )
    return this.attachQuality(loaded, 'miss')
  }

  private async attachQuality<T>(response: InsightsResponse<T>, cache: InsightsCacheState) {
    const quality = await this.getSourceQuality()
    return {
      ...response,
      meta: {
        ...response.meta,
        cache,
        quality: {
          sources: quality,
        },
      },
    }
  }
}

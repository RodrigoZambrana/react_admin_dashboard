import BaseService from './BaseService'

export type InsightsDateRange = {
    from: string
    to: string
}

export type InsightsMetricPoint = {
    tenant_id: string
    date_range: InsightsDateRange
    source: 'internal' | 'ga' | 'ads' | 'search_console' | 'mixed'
    metric_name: string
    metric_value: number
    dimension: {
        type: string
        value: string | null
        label?: string | null
    }
    context?: Record<string, unknown>
}

export type InsightsMeta = {
    version: 'v1'
    source: 'internal' | 'ga' | 'ads' | 'search_console' | 'mixed'
    generated_at: string
    cache: 'hit' | 'miss'
    date_range: InsightsDateRange
    tenant_id: string | null
    requested_scopes: string[]
    quality: {
        sources: Array<{
            source: string
            status: string
            display_name: string
            last_successful_sync_at: string | null
            last_attempted_sync_at: string | null
            last_sync_error_at: string | null
            last_sync_error_message: string | null
            needs_reauth: boolean
            next_sync_at: string | null
        }>
    }
    pagination?: {
        page: number
        pageSize: number
        total: number
        totalPages: number
    }
    measurement?: {
        conversion_measurement_ready: boolean
        status: 'ready' | 'partial' | 'not_ready'
        confidence: number
    }
}

export type InsightsPayload<TItem> = {
    items: TItem[]
    normalized: InsightsMetricPoint[]
    summary: Record<string, unknown>
}

export type InsightsResponse<TItem> = {
    data: InsightsPayload<TItem>
    meta: InsightsMeta
}

export type InsightProductSearchItem = {
    tenant_id: string
    date_range: InsightsDateRange
    source: 'internal'
    metric_name: 'product_search_hit'
    metric_value: number
    dimension: {
        type: 'product'
        value: string
        label: string
    }
    product_id: number
    slug: string
    name: string
    availability: string
    currency: string
    price: number
    sale_price: number | null
    categories: Array<{ id: number; slug: string; name: string }>
    tags: string[]
    rating: number | null
    rating_count: number | null
}

export type InsightProductPerformanceItem = {
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

export type InsightSearchQueryItem = {
    query: string
    page: string | null
    impressions: number
    clicks: number
    ctr: number
    position: number
    pages: number
    state: 'quick_win' | 'brand_opportunity' | 'content_gap' | 'weak_signal'
}

export type InsightSearchPageItem = {
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

export type InsightFunnelStepItem = {
    eventName: string
    sessions: number
    events: number
    rateFromPrevious: number
}

export type InsightCtaItem = {
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

export type InsightSessionItem = {
    sessionId: string
    source: string | null
    medium: string | null
    campaign: string | null
    durationSeconds: number
    firstSeen: string | null
    lastSeen: string | null
}

export type InsightTrafficItem = {
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

export type InsightAdsCampaignItem = {
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

export type InsightServiceKeyCredential = {
    name: string
    tokenPrefix: string | null
    scopes: string[]
    enabled: boolean
    expiresAt: string | null
    createdAt: string | null
    lastUsedAt: string | null
    source: 'database' | 'environment'
}

export type InsightServiceKeyListResponse = {
    source: 'database' | 'environment'
    updatedAt: string | null
    credentials: InsightServiceKeyCredential[]
}

export type InsightServiceKeyCreatePayload = {
    name?: string | null
    scopes?: string[]
    expiresAt?: string | null
    enabled?: boolean
}

export type InsightServiceKeyCreateResponse = {
    source: 'database'
    updatedAt: string | null
    token: string
    credential: InsightServiceKeyCredential
}

const buildParams = (input?: Record<string, string | number | boolean | null | undefined>) =>
    Object.fromEntries(
        Object.entries(input ?? {}).filter(([, value]) => value !== null && value !== undefined),
    )

const get = async <T>(path: string, params?: Record<string, string | number | boolean | null | undefined>) => {
    const response = await BaseService.get<InsightsResponse<T>>(path, { params: buildParams(params) })
    return response.data
}

const InsightsService = {
    searchProducts: (params: {
        page?: number
        pageSize?: number
        category?: string
        search?: string
        sort?: string
        tag?: string
    }) => get<InsightProductSearchItem>('/insights/products/search', params),
    getProductsPerformance: (params?: { from?: string; to?: string; limit?: number }) =>
        get<InsightProductPerformanceItem>('/insights/products/performance', params),
    getSearchQueries: (params?: { from?: string; to?: string; limit?: number }) =>
        get<InsightSearchQueryItem>('/insights/search/queries', params),
    getSearchPerformance: (params?: { from?: string; to?: string; limit?: number }) =>
        get<InsightSearchPageItem>('/insights/search/performance', params),
    getFunnels: (params?: { from?: string; to?: string; compareFrom?: string; compareTo?: string; steps?: string }) =>
        get<InsightFunnelStepItem>('/insights/analytics/funnels', params),
    getCtas: (params?: { from?: string; to?: string; limit?: number }) =>
        get<InsightCtaItem>('/insights/analytics/ctas', params),
    getSessions: (params?: { from?: string; to?: string; limit?: number }) =>
        get<InsightSessionItem>('/insights/analytics/sessions', params),
    getGaTraffic: (params?: { from?: string; to?: string; limit?: number }) =>
        get<InsightTrafficItem>('/insights/external/ga/traffic', params),
    getAdsCampaigns: (params?: { from?: string; to?: string; limit?: number }) =>
        get<InsightAdsCampaignItem>('/insights/external/ads/campaigns', params),
    getSourcesQuality: () => get<{ source: string; status: string }>('/insights/sources/quality'),
    getServiceKeys: () =>
        BaseService.get<InsightServiceKeyListResponse>('/insights/service-keys').then(
            (response) => response.data,
        ),
    createServiceKey: (payload: InsightServiceKeyCreatePayload) =>
        BaseService.post<InsightServiceKeyCreateResponse>('/insights/service-keys', payload).then(
            (response) => response.data,
        ),
}

export default InsightsService

import ApiService from './ApiService'

export type AnalyticsComparisonMetric = {
    current: number
    previous: number
    delta: number
    deltaPercent: number | null
}

export type AnalyticsComparisonSeries = {
    revenue: AnalyticsComparisonMetric
    orders: AnalyticsComparisonMetric
    avgTicket: AnalyticsComparisonMetric
    conversionRate: AnalyticsComparisonMetric
}

export type AnalyticsOverviewResponse = {
    range: {
        from: string
        to: string
    }
    revenue: number
    orders: number
    avgTicket: number
    conversionRate: number
    funnel: Record<string, number>
    timeseries: Array<{
        date: string
        revenue: number
        orders: number
    }>
    channels: Array<{
        utmSource: string | null
        revenue: number
        orders: number
        sessions: number
    }>
    topProducts: Array<{
        productId: string
        name: string | null
        revenue: number
        views: number
        purchases: number
    }>
    topChannel: string | null
    topProduct: string | null
    comparison?: AnalyticsComparisonSeries | null
    insights: Array<{
        severity: 'info' | 'warning'
        code: string
        message: string
    }>
}

export type AnalyticsFunnelStep = {
    eventName: string
    sessions: number
    events: number
    conversionFromPrevious: number | null
    conversionFromStart: number | null
}

export type AnalyticsFunnelComparison = {
    steps: Record<string, AnalyticsComparisonMetric>
    rates: {
        viewToCart: AnalyticsComparisonMetric
        cartToCheckout: AnalyticsComparisonMetric
        checkoutToPurchase: AnalyticsComparisonMetric
    }
}

export type AnalyticsFunnelResponse = {
    range: {
        from: string
        to: string
    }
    totals: {
        sessions: number
        events: number
        purchases: number
        revenue: number
        currency: string | null
    }
    steps: AnalyticsFunnelStep[]
    rates: {
        viewToCart: number | null
        cartToCheckout: number | null
        checkoutToPurchase: number | null
    }
    comparison?: AnalyticsFunnelComparison | null
}

const buildQueryString = (params?: Record<string, string | undefined>) => {
    const searchParams = new URLSearchParams()
    Object.entries(params ?? {}).forEach(([key, value]) => {
        if (typeof value === 'string' && value.trim().length > 0) {
            searchParams.set(key, value)
        }
    })
    const query = searchParams.toString()
    return query.length ? `?${query}` : ''
}

export async function apiGetAnalyticsOverviewData<T, U extends Record<string, string | undefined>>(
    params?: U,
) {
    return ApiService.fetchData<T>({
        url: `/analytics/overview${buildQueryString(params)}`,
        method: 'get',
    })
}

export async function apiGetAnalyticsFunnelData<T, U extends Record<string, string | undefined>>(
    params?: U,
) {
    return ApiService.fetchData<T>({
        url: `/analytics/funnel${buildQueryString(params)}`,
        method: 'get',
    })
}


export type AnalyticsEventInput = {
  event: string
  timestamp: string
  session_id: string
  url: string
  user_agent: string
  page?: string | null
  path?: string | null
  referrer?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  device?: string | null
  country?: string | null
  value?: number | null
  user_id?: string | null
  data?: Record<string, unknown>
  correlation_id?: string | null
}

export type FunnelStepMetric = {
  eventName: string
  sessions: number
  events: number
  conversionFromPrevious: number | null
  conversionFromStart: number | null
}

export type ComparisonMetric = {
  current: number
  previous: number
  delta: number
  deltaPercent: number | null
}

export type ComparisonSeries = {
  revenue: ComparisonMetric
  orders: ComparisonMetric
  avgTicket: ComparisonMetric
  conversionRate: ComparisonMetric
}

export type FunnelComparison = {
  steps: Record<string, ComparisonMetric>
  rates: {
    viewToCart: ComparisonMetric
    cartToCheckout: ComparisonMetric
    checkoutToPurchase: ComparisonMetric
  }
}

export type FunnelMetrics = {
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
  steps: FunnelStepMetric[]
  rates: {
    viewToCart: number | null
    cartToCheckout: number | null
    checkoutToPurchase: number | null
  }
  comparison?: FunnelComparison | null
}

export type DashboardMetrics = {
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
  comparison?: ComparisonSeries | null
  insights: Array<{
    severity: 'info' | 'warning'
    code: string
    message: string
  }>
}

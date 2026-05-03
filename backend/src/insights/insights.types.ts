export type InsightsApiVersion = 'v1'

export type InsightsSource = 'internal' | 'ga' | 'ads' | 'search_console' | 'mixed'

export type InsightsScope =
  | 'read:products'
  | 'read:search'
  | 'read:analytics'
  | 'read:ads'
  | 'read:funnels'

export type InsightsCacheState = 'hit' | 'miss'

export type InsightsDateRange = {
  from: string
  to: string
}

export type InsightsDimension = {
  type: string
  value: string | null
  label?: string | null
}

export type InsightsMetricPoint = {
  tenant_id: string
  date_range: InsightsDateRange
  source: InsightsSource
  metric_name: string
  metric_value: number
  dimension: InsightsDimension
  context?: Record<string, unknown>
}

export type InsightsSourceQuality = {
  source: string
  status: string
  display_name: string
  last_successful_sync_at: string | null
  last_attempted_sync_at: string | null
  last_sync_error_at: string | null
  last_sync_error_message: string | null
  needs_reauth: boolean
  next_sync_at: string | null
}

export type InsightsMeta = {
  version: InsightsApiVersion
  source: InsightsSource
  generated_at: string
  cache: InsightsCacheState
  date_range: InsightsDateRange
  tenant_id: string | null
  requested_scopes: InsightsScope[]
  quality: {
    sources: InsightsSourceQuality[]
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

export type InsightsPayload<TItem, TNormalized = InsightsMetricPoint[]> = {
  items: TItem[]
  normalized: TNormalized
  summary: Record<string, unknown>
}

export type InsightsResponse<TItem, TNormalized = InsightsMetricPoint[]> = {
  data: InsightsPayload<TItem, TNormalized>
  meta: InsightsMeta
}

export type InsightsPrincipal = {
  type: 'jwt' | 'api_key'
  subject: string
  scopes: InsightsScope[] | string[]
  tokenName?: string | null
  userId?: string | null
}

export type InsightsApiKeyCredential = {
  name: string
  token?: string
  tokenHash?: string
  tokenPrefix?: string | null
  scopes: InsightsScope[]
  enabled?: boolean
  expiresAt?: string | null
  createdAt?: string | null
  lastUsedAt?: string | null
}

export type InsightsApiAuthConfig = {
  version: number
  credentials: InsightsApiKeyCredential[]
}

export type InsightsApiKeySummary = {
  name: string
  tokenPrefix: string | null
  scopes: InsightsScope[]
  enabled: boolean
  expiresAt: string | null
  createdAt: string | null
  lastUsedAt: string | null
  source: 'database' | 'environment'
}

export type InsightsApiKeyListResponse = {
  source: 'database' | 'environment'
  updatedAt: string | null
  credentials: InsightsApiKeySummary[]
}

export type InsightsApiKeyCreateInput = {
  name?: string | null
  scopes?: InsightsScope[]
  expiresAt?: string | null
  enabled?: boolean
}

export type InsightsApiKeyCreateResponse = {
  source: 'database'
  updatedAt: string | null
  token: string
  credential: InsightsApiKeySummary
}

export type InsightsRequest = {
  insightsPrincipal?: InsightsPrincipal | null
}

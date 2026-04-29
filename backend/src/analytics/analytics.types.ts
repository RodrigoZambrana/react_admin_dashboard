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

export type AnalyticsConnectionSource = 'ga4' | 'ads' | 'search_console'

export type AnalyticsConnectionStatus =
  | 'needs_auth'
  | 'ready'
  | 'syncing'
  | 'error'
  | 'disabled'

export type AnalyticsSyncJobType = 'initial_sync' | 'incremental_sync' | 'backfill' | 'repair'

export type AnalyticsSyncRunStatus = 'pending' | 'running' | 'success' | 'failed'

export type AnalyticsInsightImpact = 'low' | 'medium' | 'high' | 'critical'

export type AnalyticsConnection = {
  id: string
  source: AnalyticsConnectionSource
  status: AnalyticsConnectionStatus
  target: {
    id: string | null
    name: string
  }
  lastSyncAt: string | null
  nextSyncAt: string | null
  needsReauth: boolean
  health: AnalyticsConnectionHealth
}

export type AnalyticsConnectionHealth = {
  lagMinutes: number | null
  lastAttemptedSyncAt: string | null
  lastSuccessfulSyncAt: string | null
  lastErrorMessage: string | null
  lastErrorAt: string | null
}

export type AnalyticsSyncRun = {
  id: string
  connectionId: string
  jobType: AnalyticsSyncJobType
  fromDate: string | null
  toDate: string | null
  status: AnalyticsSyncRunStatus
  recordsFetched: number
  recordsUpserted: number
  errorMessage: string | null
  startedAt: string
  finishedAt: string | null
  createdAt: string
}

export type AnalyticsInsight = {
  id: string
  source: string
  metric: string
  dimension: string | null
  title: string
  description: string
  recommendation: string
  impact: AnalyticsInsightImpact
  confidence: number
  evidence: Record<string, unknown>
  createdAt: string
  resolvedAt: string | null
  status: 'open' | 'resolved' | 'dismissed'
}

export type AnalyticsDataQualityStatus = 'ok' | 'warning' | 'error' | 'missing_baseline'

export type AnalyticsBaselineSnapshot = {
  id: string
  connectionId: string
  source: 'ga4'
  reportKey: string
  date: string
  metricName: string
  dimensionHash: string
  dimensionValues: Record<string, unknown> | null
  value: number
  queryHash: string
  raw: Record<string, unknown> | null
  createdAt: string
}

export type AnalyticsDataQualityCheck = {
  id: string
  connectionId: string
  reportKey: string
  date: string
  metricName: string
  dimensionHash: string
  baselineValue: number
  syncedValue: number
  diff: number
  diffPercent: number
  status: AnalyticsDataQualityStatus
  baselineSnapshotId: string | null
  syncRunId: string | null
  queryHash: string
  createdAt: string
}

export type AnalyticsDataQualitySummary = {
  reportKey: string
  totalChecks: number
  okCount: number
  warningCount: number
  errorCount: number
  missingBaselineCount: number
  averageDiffPercent: number
  coveragePercent: number
  lastCheckedAt: string | null
}

export type AnalyticsReportEquivalenceStatus = 'exact' | 'partial' | 'gap'
export type AnalyticsReportRowKeyStrategy = 'row_index' | 'dimensions'
export type AnalyticsReportDataSource = 'baseline_csv' | 'ga4_api'
export type AnalyticsReportRunSource = 'baseline_import' | 'ga4_sync'
export type AnalyticsReportRunStatus = 'pending' | 'running' | 'success' | 'failed'
export type AnalyticsReportReconciliationStatus = 'aligned' | 'partial' | 'gap' | 'missing'

export type AnalyticsReportCatalogEntry = {
  key: string
  source: string
  title: string
  description: string | null
  baselineHeader: string
  baselineTitle: string | null
  equivalenceStatus: AnalyticsReportEquivalenceStatus
  rowKeyStrategy: AnalyticsReportRowKeyStrategy
  dimensionLabels: string[]
  metricLabels: string[]
  apiDefinition: Record<string, unknown> | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type AnalyticsReportRow = {
  id: string
  reportRunId: string
  reportKey: string
  source: AnalyticsReportDataSource
  rowType: string
  rowIndex: number
  rowKey: string
  dimensions: Record<string, unknown>
  metrics: Record<string, unknown>
  raw: Record<string, unknown>
  createdAt: string
}

export type AnalyticsReportRun = {
  id: string
  reportKey: string
  source: AnalyticsReportRunSource
  status: AnalyticsReportRunStatus
  fromDate: string | null
  toDate: string | null
  rowCount: number
  errorMessage: string | null
  metadata: Record<string, unknown> | null
  startedAt: string
  finishedAt: string | null
  createdAt: string
}

export type AnalyticsReportReconciliation = {
  id: string
  reportKey: string
  baselineRunId: string | null
  syncRunId: string | null
  status: AnalyticsReportReconciliationStatus
  baselineRowCount: number
  syncRowCount: number
  matchedRowCount: number
  baselineOnlyRowCount: number
  syncOnlyRowCount: number
  deltaPercent: number
  summary: string
  evidence: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export type AnalyticsGa4Property = {
  accountId: string
  accountName: string
  propertyId: string
  propertyName: string
}

export type AnalyticsGa4OAuthStartResult = {
  connectionId: string
  state: string
  expiresAt: string
  url: string
}

export type AnalyticsGa4SyncResult = {
  connectionId: string
  syncRun: AnalyticsSyncRun
  ga4RowsUpserted: number
  reportingRowsUpserted: number
}

export type AnalyticsAdsOAuthStartResult = {
  connectionId: string
  state: string
  expiresAt: string
  url: string
}

export type AnalyticsAdsSyncResult = {
  connectionId: string
  syncRun: AnalyticsSyncRun
  adsRowsUpserted: number
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

import type {
  AnalyticsEventCategory,
  AnalyticsEventSource,
  AnalyticsMeasurementStatus,
} from './event-taxonomy'

export type AnalyticsEventInput = {
  event: string
  timestamp: string
  session_id: string
  url: string
  user_agent: string
  tenant_id?: string | null
  schema_version?: number | null
  client_ip_address?: string | null
  event_id?: string | null
  category?: AnalyticsEventCategory | null
  eventCategory?: AnalyticsEventCategory | null
  source?: AnalyticsEventSource | null
  measurement_status?: AnalyticsMeasurementStatus | null
  measurementStatus?: AnalyticsMeasurementStatus | null
  page?: string | null
  path?: string | null
  page_type?: string | null
  component_type?: string | null
  component_id?: string | null
  cta_id?: string | null
  cta_name?: string | null
  cta_type?: string | null
  cta_context?: string | null
  cta_location?: string | null
  position?: number | null
  referrer?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  device?: string | null
  country?: string | null
  value?: number | null
  user_id?: string | null
  fbp?: string | null
  fbc?: string | null
  external_targets?: string[] | null
  metadata?: Record<string, unknown>
  data?: Record<string, unknown>
  correlation_id?: string | null
}

export type AnalyticsConnectionSource = 'ga4' | 'ads' | 'search_console' | 'meta'

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
  queuedAt: string | null
  retryCount: number
  partialFailureFlag: boolean
  durationMs: number | null
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

export type AnalyticsInsightPriority = 'low' | 'medium' | 'high'
export type AnalyticsInsightCategory =
  | 'business_issue'
  | 'measurement_issue'
  | 'low_confidence_signal'
export type AnalyticsInsightSource = 'ga4' | 'ads' | 'search_console' | 'meta' | 'mixed'
export type AnalyticsInsightType =
  | 'summary'
  | 'acquisition'
  | 'behavior'
  | 'conversion'
  | 'revenue'
  | 'data_quality'

export type AnalyticsInsightPeriod = {
  current: {
    from: string
    to: string
  }
  previous: {
    from: string
    to: string
  }
}

export type AnalyticsMeasurementGate = {
  conversionMeasurementReady: boolean
  adsConversionMeasurementReady: boolean
  metaConversionMeasurementReady: boolean
  qualityStatus: 'ok' | 'warning' | 'error'
  reasons: string[]
}

export type AnalyticsMetaAdsMetrics = {
  spend: number
  clicks: number
  impressions: number
  events: {
    view_content: number
    lead: number
    purchase: number
  }
}

export type AnalyticsAiInsight = {
  id: string
  insightType: AnalyticsInsightType
  title: string
  description: string
  recommendation: string
  page: string | null
  pageReason: string | null
  contentToInclude: string | null
  expectedResult: string | null
  category: AnalyticsInsightCategory
  source: AnalyticsInsightSource
  impact: AnalyticsInsightPriority
  confidence: number
  evidence: Record<string, unknown>
  metric: string
  segment: string | null
  sourceReport: string | null
  periodRange: AnalyticsInsightPeriod
  score: number
  status: 'open'
  createdAt: string
  isBaselineVerified?: boolean
}

export type AnalyticsInsightBundleDetectedPattern = {
  type: string
  severity: 'low' | 'medium' | 'high'
  category: AnalyticsInsightCategory
  source: AnalyticsInsightSource
  evidence: Record<string, unknown>
}

export type AnalyticsInsightBundleTrust = {
  status: 'ok' | 'warning' | 'fail'
  degraded: boolean
  summary: string
  updatedAt: string | null
  checks: Array<{
    check: string
    status: 'ok' | 'warning' | 'fail'
    value: number | null
    expected: string
    impact: string
  }>
}

export type AnalyticsInsightBundleFreshness = {
  generatedAt: string
  currentWindow: AnalyticsInsightPeriod['current']
  previousWindow: AnalyticsInsightPeriod['previous']
  latestSyncAt: string | null
  latestReportAt: string | null
  syncLagMinutes: number | null
  reportLagMinutes: number | null
}

export type AnalyticsInsightBundleBusinessContext = {
  clientSlug: string | null
  reportKey: string | null
  primaryCurrency: string | null
  timezone: string | null
}

export type AnalyticsInsightBundle = {
  timeRange: AnalyticsInsightPeriod
  kpis: {
    revenue: ComparisonMetric
    orders: ComparisonMetric
    conversionRate: ComparisonMetric
    cac: ComparisonMetric | null
    roas: ComparisonMetric
  }
  funnel: {
    view_item: number
    add_to_cart: number
    begin_checkout: number
    purchase: number
    rates: {
      viewToCart: number | null
      cartToCheckout: number | null
      checkoutToPurchase: number | null
    }
  }
  acquisition: Array<{
    channel: string
    sessions: number
    cost: number
    revenue: number
    roas: number
    conversionRate: number
    source: AnalyticsInsightSource
  }>
  seo: Array<{
    query: string
    impressions: number
    clicks: number
    ctr: number
    position: number
    source: AnalyticsInsightSource
  }>
  products: Array<{
    productId: string
    views: number
    addToCart: number
    purchases: number
    conversionRate: number
    source: AnalyticsInsightSource
  }>
  meta_ads: AnalyticsMetaAdsMetrics
  detectedPatterns: AnalyticsInsightBundleDetectedPattern[]
  dataQuality: {
    status: 'ok' | 'warning' | 'error'
    confidence: number
    reasons: string[]
  }
  measurement: AnalyticsMeasurementGate
  trust?: AnalyticsInsightBundleTrust | null
  freshness?: AnalyticsInsightBundleFreshness | null
  businessContext?: AnalyticsInsightBundleBusinessContext | null
}

export type AnalyticsAiDecisionInsight = {
  title: string
  what_happened: string
  why_it_matters: string
  category: AnalyticsInsightCategory
  source: AnalyticsInsightSource
  insight_type?: AnalyticsInsightType
  metric?: string | null
  segment?: string | null
  source_report?: string | null
  page?: string | null
  page_reason?: string | null
  content_to_include?: string | null
  expected_result?: string | null
  evidence: Record<string, unknown>
  impact: AnalyticsInsightPriority
  confidence: number
  recommendation: string
}

export type AnalyticsSourceQuality = {
  source: Exclude<AnalyticsInsightSource, 'mixed'>
  status: 'ok' | 'warning' | 'error'
  confidence: number
  issues: string[]
  summary: string
}

export type AnalyticsAiDecisionOutput = {
  summary: string
  insights: AnalyticsAiDecisionInsight[]
  prioritized_actions: Array<{
    action: string
    reason: string
    expected_impact: AnalyticsInsightPriority
    priority: number
    confidence: number
  }>
  quality_by_source: AnalyticsSourceQuality[]
  confidence?: number
  generatedBy?: 'ai' | 'fallback'
  generationReason?: string | null
}

export type AnalyticsInsightHistory = {
  id: string
  date: string
  insightType: AnalyticsInsightType
  title: string
  description: string
  impact: AnalyticsInsightPriority
  recommendation: string
  confidence: number
  evidence: Record<string, unknown>
  sourceReport: string | null
  periodRange: AnalyticsInsightPeriod
  score: number
  summary: string | null
  createdAt: string
}

export type AnalyticsAiInsightRun = {
  id: string
  date: string
  summary: string
  insightsJson: AnalyticsAiDecisionOutput['insights']
  actionsJson: AnalyticsAiDecisionOutput['prioritized_actions']
  confidence: number
  bundleJson: AnalyticsInsightBundle
  responseJson: AnalyticsAiDecisionOutput
  createdAt: string
}

export type AnalyticsPrioritizedAction = {
  action: string
  why: string
  expectedImpact: AnalyticsInsightPriority
  confidence: number
}

export type AnalyticsInsightsQualitySummary = {
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

export type AnalyticsInsightsDataset = {
  periodRange: AnalyticsInsightPeriod
  generatedAt: string
  totals: {
    current: Record<string, number>
    previous: Record<string, number>
  }
  comparisons: Record<string, ComparisonMetric>
  quality: {
    connections: AnalyticsConnection[]
    syncRuns: AnalyticsSyncRun[]
    reportRuns: AnalyticsReportRun[]
    reconciliations: AnalyticsReportReconciliation[]
    baselineSnapshots: AnalyticsBaselineSnapshot[]
    dataQualityChecks: AnalyticsDataQualityCheck[]
    summaries: AnalyticsInsightsQualitySummary[]
  }
}

export type AnalyticsInsightsResponse = {
  summary: string
  generatedBy?: 'ai' | 'fallback'
  generationReason?: string | null
  confidence?: number
  periodRange: AnalyticsInsightPeriod
  generatedAt: string
  measurement: AnalyticsMeasurementGate
  trust?: AnalyticsInsightBundleTrust | null
  freshness?: AnalyticsInsightBundleFreshness | null
  quality: AnalyticsInsightsDataset['quality']
  qualityBySource: AnalyticsSourceQuality[]
  insights: AnalyticsAiInsight[]
  alerts: AnalyticsAiInsight[]
  opportunities: AnalyticsAiInsight[]
  prioritizedActions: AnalyticsPrioritizedAction[]
}

export type AnalyticsSummaryResponse = {
  summary: string
  generatedBy?: 'ai' | 'fallback'
  generationReason?: string | null
  confidence?: number
  periodRange: AnalyticsInsightPeriod
  generatedAt: string
  measurement: AnalyticsMeasurementGate
  trust?: AnalyticsInsightBundleTrust | null
  freshness?: AnalyticsInsightBundleFreshness | null
  quality: AnalyticsInsightsDataset['quality']
  qualityBySource: AnalyticsSourceQuality[]
  topInsight: AnalyticsAiInsight | null
  totalInsights: number
  alerts: AnalyticsAiInsight[]
  prioritizedActions: AnalyticsPrioritizedAction[]
}

export type AnalyticsOpportunitiesResponse = {
  summary: string
  generatedBy?: 'ai' | 'fallback'
  generationReason?: string | null
  confidence?: number
  periodRange: AnalyticsInsightPeriod
  generatedAt: string
  measurement: AnalyticsMeasurementGate
  trust?: AnalyticsInsightBundleTrust | null
  freshness?: AnalyticsInsightBundleFreshness | null
  qualityBySource: AnalyticsSourceQuality[]
  opportunities: AnalyticsAiInsight[]
  prioritizedActions: AnalyticsPrioritizedAction[]
}

export type AnalyticsDataQualityStatus = 'ok' | 'warning' | 'error' | 'missing_baseline'

export type AnalyticsBaselineSnapshot = {
  id: string
  connectionId: string | null
  source: 'ga4' | 'ads' | 'search_console'
  reportKey: string
  date: string
  metricName: string
  dimensionHash: string
  dimensionValues: Record<string, unknown> | null
  value: number
  queryHash: string
  origin?: 'api' | 'csv'
  snapshotGroup?: string
  raw: Record<string, unknown> | null
  createdAt: string
}

export type AnalyticsDataParityStatus = 'aligned' | 'warning' | 'mismatch' | 'missing'

export type AnalyticsDataParityCheck = {
  id: string
  source: 'ga4' | 'ads' | 'search_console'
  metric: string
  dateFrom: string
  dateTo: string
  apiValue: number
  baselineValue: number
  deltaAbs: number
  deltaPercent: number
  status: AnalyticsDataParityStatus
  snapshotGroup: string
  createdAt: string
}

export type AnalyticsDataParityResponse = {
    summary: {
        aligned: number
        warning: number
        mismatch: number
        missing: number
        total: number
    }
    baselineChecks: Array<{
        date: string
        source: 'ga4' | 'ads' | 'search_console'
        metric: string
        apiValue: number | null
        importValue: number | null
        exportValue: number | null
        diffPercent: number
        status: AnalyticsDataParityStatus
        snapshotGroup: string
        createdAt: string
    }>
    bySource: {
        ga4: AnalyticsDataParityCheck[]
        ads: AnalyticsDataParityCheck[]
        search_console: AnalyticsDataParityCheck[]
    }
    lastRunAt: string | null
    overallStatus: 'ok' | 'degraded' | 'fail'
    history: AnalyticsDataParityCheck[]
    anomalies: AnalyticsDataAnomaly[]
}

export type AnalyticsUsageEvent = {
    id: string
    endpoint: string
    userId: number | null
  timeRange: string
  filters: Record<string, unknown> | null
  responseTimeMs: number
  responseSize: number
  trustLevel: string
    hasData: boolean
    createdAt: string
}

export type AnalyticsEndpointUsage = {
    id: string
    endpoint: string
    userId: string | null
    statusCode: number
    durationMs: number
    createdAt: string
}

export type AnalyticsUsageResponse = {
    endpoints: Array<{
        endpoint: string
        calls: number
        avgLatency: number
        errorRate: number
        lastCalledAt: string | null
    }>
    requestsByDay: Array<{
        date: string
        calls: number
        errorRate: number
    }>
    unusedEndpoints: string[]
    history: AnalyticsEndpointUsage[]
}

export type AnalyticsExportRun = {
  id: string
  exportType: string
  source: string | null
  dateFrom: string
  dateTo: string
  filters: Record<string, unknown> | null
  rowCount: number | null
  fileFormat: string
  status: string
  errorMessage: string | null
  durationMs: number | null
  fileSize: number | null
  createdAt: string
}

export type AnalyticsExportRunsResponse = {
    total: number
    items: AnalyticsExportRun[]
}

export type AnalyticsBaselineCheck = {
    id: string
    date: string
    source: 'ga4' | 'ads' | 'search_console'
    metric: string
    comparisonKind: 'api_vs_import' | 'export_vs_import'
    expectedValue: number
    actualValue: number
    diffPct: number
    status: 'ok' | 'warning' | 'mismatch'
    snapshotGroup: string
    createdAt: string
}

export type AnalyticsDataAnomaly = {
    id: string
    type: string
    source: string
    metric: string | null
    description: string
    severity: string
    detectedAt: string
}

export type AnalyticsEventComparisonStatus = 'match' | 'missing_in_ga' | 'missing_in_direct' | 'mismatch'

export type AnalyticsEventComparison = {
  id: string
  tenantId: string
  eventId: string
  eventName: string
  directEventTimestamp: string | null
  gaEventTimestamp: string | null
  existsInDirect: boolean
  existsInGa: boolean
  payloadMatch: boolean
  timeDiffMs: number | null
  status: AnalyticsEventComparisonStatus
  directSource: string | null
  gaSource: string | null
  comparisonDate: string | null
  directPayload: Record<string, unknown> | null
  gaPayload: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export type AnalyticsEventComparisonSummary = {
  tenantId: string
  totalEvents: number
  matchCount: number
  missingInGaCount: number
  missingInDirectCount: number
  mismatchCount: number
  matchRate: number
  trackingHealthScore: number
  averageTimeDiffMs: number | null
  purchaseMismatchCount: number
  fromDate: string | null
  toDate: string | null
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

export type AnalyticsReportingDailyMetric = {
  id: string
  date: string
  channel: string
  source: string | null
  medium: string | null
  campaign: string | null
  productId: string | null
  landingPage: string | null
  device: string | null
  country: string | null
  sessions: number
  users: number
  revenue: number
  orders: number
  cost: number
  impressions: number
  clicks: number
  views: number
  addToCart: number
  eventCount: number
  keyEvents: number
  ga4PurchaseProxy: number
  purchase: number
  createdAt: string
}

export type AnalyticsAdsDailyMetric = {
  id: string
  date: string
  campaign: string
  clicks: number
  impressions: number
  cost: number
  conversions: number
  conversionValue: number
  hasConversionData: boolean
  connectionId: string | null
  syncRunId: string | null
  createdAt: string
}

export type AnalyticsSearchConsoleDailyMetric = {
  id: string
  date: string
  query: string
  page: string | null
  clicks: number
  impressions: number
  ctr: number
  position: number
  connectionId: string | null
  syncRunId: string | null
  createdAt: string
}

export type AnalyticsSearchIntelligenceQuerySummary = {
  query: string
  queryNormalized: string
  searchEvents: number
  intentEvents: number
  resultEvents: number
  exactResultEvents: number
  zeroResultEvents: number
  averageResultCount: number | null
  exactResultRate: number
  zeroResultRate: number
  tenantIds: string[]
}

export type AnalyticsSearchIntelligenceTenantSummary = {
  tenantId: string
  searchEvents: number
  intentEvents: number
  resultEvents: number
  uniqueQueries: number
  exactResultEvents: number
  zeroResultEvents: number
  averageResultCount: number | null
  exactResultRate: number
  zeroResultRate: number
}

export type AnalyticsSearchIntelligenceSample = {
  eventId: string | null
  tenantId: string | null
  timestamp: string
  query: string | null
  queryNormalized: string
  searchStage: string | null
  searchSource: string | null
  resultCount: number | null
  exactMatchCount: number | null
  hasResults: boolean
  hasExactResults: boolean
  categorySlug: string | null
  categoryLabel: string | null
}

export type AnalyticsSearchIntelligence = {
  range: {
    from: string
    to: string
  }
  filters: {
    tenantId: string | null
  }
  totals: {
    searchEvents: number
    intentEvents: number
    resultEvents: number
    uniqueQueries: number
    exactResultEvents: number
    zeroResultEvents: number
    averageResultCount: number | null
    exactResultRate: number
    zeroResultRate: number
    trackingHealthScore: number
  }
  byTenant: AnalyticsSearchIntelligenceTenantSummary[]
  topQueries: AnalyticsSearchIntelligenceQuerySummary[]
  zeroResultQueries: AnalyticsSearchIntelligenceQuerySummary[]
  samples: AnalyticsSearchIntelligenceSample[]
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
  failedReports?: Array<{
    reportKey: string
    error: string
  }>
}

export type AnalyticsSearchConsoleProperty = {
  siteUrl: string
  permissionLevel: string | null
  siteType: string
}

export type AnalyticsSearchConsoleOAuthStartResult = {
  connectionId: string
  state: string
  expiresAt: string
  url: string
}

export type AnalyticsSearchConsoleSyncResult = {
  connectionId: string
  syncRun: AnalyticsSyncRun
  searchConsoleRowsUpserted: number
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

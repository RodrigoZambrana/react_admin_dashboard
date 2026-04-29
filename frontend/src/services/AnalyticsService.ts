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

export type AnalyticsConnection = {
    id: string
    source: 'ga4' | 'ads' | 'search_console' | 'meta'
    status: 'needs_auth' | 'ready' | 'syncing' | 'error' | 'disabled'
    target: {
        id: string | null
        name: string
    }
    lastSyncAt: string | null
    nextSyncAt: string | null
    needsReauth: boolean
    health: {
        lagMinutes: number | null
        lastAttemptedSyncAt: string | null
        lastSuccessfulSyncAt: string | null
        lastErrorMessage: string | null
        lastErrorAt: string | null
    }
}

export type AnalyticsSyncRun = {
    id: string
    connectionId: string
    jobType: 'initial_sync' | 'incremental_sync' | 'backfill' | 'repair'
    fromDate: string | null
    toDate: string | null
    status: 'pending' | 'running' | 'success' | 'failed'
    recordsFetched: number
    recordsUpserted: number
    errorMessage: string | null
    startedAt: string
    finishedAt: string | null
    createdAt: string
}

export type AnalyticsInsight = {
    id: string
    source?: 'ga4' | 'ads' | 'search_console' | 'mixed'
    metric: string
    dimension: string | null
    title: string
    description: string
    recommendation: string
    page?: string | null
    pageReason?: string | null
    contentToInclude?: string | null
    expectedResult?: string | null
    category?: 'business_issue' | 'measurement_issue' | 'low_confidence_signal'
    impact: 'low' | 'medium' | 'high' | 'critical'
    confidence: number
    evidence: Record<string, unknown>
    createdAt?: string
    resolvedAt?: string | null
    status?: 'open' | 'resolved' | 'dismissed'
    insightType?: 'summary' | 'acquisition' | 'behavior' | 'conversion' | 'revenue' | 'data_quality'
    sourceReport?: string | null
    periodRange?: {
        current: {
            from: string
            to: string
        }
        previous: {
            from: string
            to: string
        }
    }
    score?: number
    segment?: string | null
}

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

export type AnalyticsBaselineParityRow = {
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
}

export type AnalyticsDataParityResponse = {
    summary: {
        aligned: number
        warning: number
        mismatch: number
        missing: number
        total: number
    }
    baselineChecks: AnalyticsBaselineParityRow[]
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

export type AnalyticsDataAnomaly = {
    id: string
    type: string
    source: string
    metric: string | null
    description: string
    severity: string
    detectedAt: string
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

export type AnalyticsCanonicalExportSource = 'ga4' | 'ads' | 'search_console' | 'all'
export type AnalyticsReportExportName = 'ga4_overview' | 'ads_campaigns' | 'seo_pages'

export type AnalyticsCanonicalExportParams = {
    from: string
    to: string
    source?: AnalyticsCanonicalExportSource
    granularity?: 'daily'
}

export type AnalyticsReportExportParams = {
    report: AnalyticsReportExportName
    from: string
    to: string
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

export type AnalyticsDataQualityStatus = 'ok' | 'warning' | 'error' | 'missing_baseline'

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

export type AnalyticsDataQualityResponse = {
    checks: AnalyticsDataQualityCheck[]
    summaries: AnalyticsDataQualitySummary[]
}

export type AnalyticsReportCatalogEntry = {
    key: string
    source: string
    title: string
    description: string | null
    baselineHeader: string
    baselineTitle: string | null
    equivalenceStatus: 'exact' | 'partial' | 'gap'
    rowKeyStrategy: 'row_index' | 'dimensions'
    dimensionLabels: string[]
    metricLabels: string[]
    apiDefinition: Record<string, unknown> | null
    notes: string | null
    createdAt: string
    updatedAt: string
}

export type AnalyticsReportRun = {
    id: string
    reportKey: string
    source: 'baseline_import' | 'ga4_sync'
    status: 'pending' | 'running' | 'success' | 'failed'
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
    status: 'aligned' | 'partial' | 'gap' | 'missing'
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

export type AnalyticsInsightsResponse = {
    summary: string
    generatedBy?: 'ai' | 'fallback'
    generationReason?: string | null
    periodRange: {
        current: {
            from: string
            to: string
        }
        previous: {
            from: string
            to: string
        }
    }
    generatedAt: string
    measurement: {
        conversionMeasurementReady: boolean
        adsConversionMeasurementReady: boolean
        metaConversionMeasurementReady: boolean
        qualityStatus: 'ok' | 'warning' | 'error'
        reasons: string[]
    }
    quality: {
        connections: AnalyticsConnection[]
        syncRuns: AnalyticsSyncRun[]
        reportRuns: AnalyticsReportRun[]
        reconciliations: AnalyticsReportReconciliation[]
        baselineSnapshots: AnalyticsBaselineSnapshot[]
        dataQualityChecks: AnalyticsDataQualityCheck[]
        summaries: AnalyticsDataQualitySummary[]
    }
    qualityBySource: Array<{
        source: 'ga4' | 'ads' | 'search_console' | 'meta'
        status: 'ok' | 'warning' | 'error'
        confidence: number
        issues: string[]
        summary: string
    }>
    insights: AnalyticsInsight[]
    alerts: AnalyticsInsight[]
    opportunities: AnalyticsInsight[]
    prioritizedActions: Array<{
        action: string
        why: string
        expectedImpact: 'low' | 'medium' | 'high'
        confidence: number
    }>
}

export type AnalyticsSummaryResponse = {
    summary: string
    generatedBy?: 'ai' | 'fallback'
    generationReason?: string | null
    periodRange: {
        current: {
            from: string
            to: string
        }
        previous: {
            from: string
            to: string
        }
    }
    generatedAt: string
    measurement: AnalyticsInsightsResponse['measurement']
    quality: AnalyticsInsightsResponse['quality']
    qualityBySource: AnalyticsInsightsResponse['qualityBySource']
    topInsight: AnalyticsInsight | null
    totalInsights: number
    alerts: AnalyticsInsight[]
    prioritizedActions: AnalyticsInsightsResponse['prioritizedActions']
}

export type AnalyticsOpportunitiesResponse = {
    summary: string
    generatedBy?: 'ai' | 'fallback'
    generationReason?: string | null
    periodRange: AnalyticsInsightsResponse['periodRange']
    generatedAt: string
    measurement: AnalyticsInsightsResponse['measurement']
    qualityBySource: AnalyticsInsightsResponse['qualityBySource']
    opportunities: AnalyticsInsight[]
    prioritizedActions: AnalyticsInsightsResponse['prioritizedActions']
}

export type AnalyticsInsightHistory = {
    id: string
    date: string
    insightType: 'summary' | 'acquisition' | 'behavior' | 'conversion' | 'revenue' | 'data_quality'
    title: string
    description: string
    impact: 'low' | 'medium' | 'high'
    recommendation: string
    confidence: number
    evidence: Record<string, unknown>
    sourceReport: string | null
    periodRange: AnalyticsInsightsResponse['periodRange']
    score: number
    summary: string | null
    createdAt: string
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

export type AnalyticsMetaMarketingResponse = {
    range: {
        from: string
        to: string
    }
    connection: AnalyticsConnection | null
    measurementStatus: 'not_ready' | 'partial' | 'ready'
    matchQuality: number
    traffic: {
        events: number
        sessions: number
    }
    meta_ads: {
        spend: number
        clicks: number
        impressions: number
        events: {
            view_content: number
            lead: number
            purchase: number
        }
    }
}

export type AnalyticsHealthCheckRecord = {
    name: string
    status: 'ok' | 'warning' | 'fail'
    severity: 'info' | 'warning' | 'critical'
    details: Record<string, unknown>
}

export type AnalyticsHealthComponentStatus = 'ok' | 'warning' | 'fail' | null

export type AnalyticsHealthHistoryItem = {
    id: string
    status: 'ok' | 'warning' | 'fail'
    environment: string
    summary: string
    durationMs: number
    createdAt: string
    details: Record<string, unknown>
    checks: AnalyticsHealthCheckRecord[]
}

export type AnalyticsHealthOverviewResponse = {
    status: 'ok' | 'warning' | 'fail'
    environment: string
    updatedAt: string | null
    summary: string
    degraded: boolean
    latest: AnalyticsHealthHistoryItem | null
    history: AnalyticsHealthHistoryItem[]
    lastChecks: AnalyticsHealthCheckRecord[]
    components: {
        ingestion: AnalyticsHealthComponentStatus
        sync: AnalyticsHealthComponentStatus
        queue: AnalyticsHealthComponentStatus
        attribution: AnalyticsHealthComponentStatus
        meta: AnalyticsHealthComponentStatus
        data_trust: AnalyticsHealthComponentStatus
        data_parity: AnalyticsHealthComponentStatus
        exports: AnalyticsHealthComponentStatus
    }
}

export type AnalyticsHealthStatusResponse = {
    status: 'ok' | 'warning' | 'fail'
    updatedAt: string | null
    environment: string
}

export type AnalyticsDataTrustCheck = {
    check: string
    status: 'ok' | 'warning' | 'fail'
    value: number | null
    expected: string
    impact: string
    details: Record<string, unknown>
}

export type AnalyticsDataTrustResponse = {
    status: 'ok' | 'warning' | 'fail'
    environment: string
    summary: string
    updatedAt: string
    metrics: Record<string, number | null>
    trend: {
        direction: 'up' | 'down' | 'flat'
        currentValue: number
        previousValue: number
        deltaPct: number | null
    }
    checks: AnalyticsDataTrustCheck[]
    history: Array<{
        status: 'ok' | 'warning' | 'fail'
        summary: string
        createdAt: string
        environment: string
    }>
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

export async function apiGetAnalyticsMetaMarketingData<T, U extends Record<string, string | undefined>>(
    params?: U,
) {
    return ApiService.fetchData<T>({
        url: `/analytics/marketing/meta${buildQueryString(params)}`,
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

export async function apiGetAnalyticsConnections<T>() {
    return ApiService.fetchData<T>({
        url: '/analytics/connections',
        method: 'get',
    })
}

export async function apiGetAnalyticsSyncRuns<T>(limit?: number) {
    const query = typeof limit === 'number' && Number.isFinite(limit) ? `?limit=${limit}` : ''
    return ApiService.fetchData<T>({
        url: `/analytics/sync-runs${query}`,
        method: 'get',
    })
}

export async function apiGetAnalyticsInsights<T>(_limit?: number) {
    return ApiService.fetchData<T>({
        url: '/analytics/insights',
        method: 'get',
    })
}

export async function apiGetAnalyticsInsightsBundle<T, U extends Record<string, string | undefined>>(
    params?: U,
) {
    return ApiService.fetchData<T>({
        url: `/analytics/insights/bundle${buildQueryString(params)}`,
        method: 'get',
    })
}

export async function apiGetAnalyticsSummary<T, U extends Record<string, string | undefined>>(
    params?: U,
) {
    return ApiService.fetchData<T>({
        url: `/analytics/summary${buildQueryString(params)}`,
        method: 'get',
    })
}

export async function apiGetAnalyticsOpportunities<T, U extends Record<string, string | undefined>>(
    params?: U,
) {
    return ApiService.fetchData<T>({
        url: `/analytics/opportunities${buildQueryString(params)}`,
        method: 'get',
    })
}

export async function apiGetAnalyticsHealth<T, U extends Record<string, string | undefined>>(
    params?: U,
) {
    return ApiService.fetchData<T>({
        url: `/analytics/health${buildQueryString(params)}`,
        method: 'get',
    })
}

export async function apiGetAnalyticsHealthStatus<T>() {
    return ApiService.fetchData<T>({
        url: '/analytics/health/status',
        method: 'get',
    })
}

export async function apiGetAnalyticsHealthHistory<T>(limit?: number) {
    const query = typeof limit === 'number' && Number.isFinite(limit) ? `?limit=${limit}` : ''
    return ApiService.fetchData<T>({
        url: `/analytics/health/history${query}`,
        method: 'get',
    })
}

export async function apiGetAnalyticsDataTrust<T>(limit?: number) {
    const query = typeof limit === 'number' && Number.isFinite(limit) ? `?limit=${limit}` : ''
    return ApiService.fetchData<T>({
        url: `/analytics/data-trust${query}`,
        method: 'get',
    })
}

export async function apiGetAnalyticsInsightsHistory<T>(limit?: number) {
    const query = typeof limit === 'number' && Number.isFinite(limit) ? `?limit=${limit}` : ''
    return ApiService.fetchData<T>({
        url: `/analytics/insights/history${query}`,
        method: 'get',
    })
}

export async function apiRecomputeAnalyticsInsights<T, U extends Record<string, string | undefined>>(
    params?: U,
) {
    return ApiService.fetchData<T>({
        url: `/analytics/insights/recompute${buildQueryString(params)}`,
        method: 'post',
    })
}

export async function apiStartGa4OAuth<T>(returnPath?: string) {
    return ApiService.fetchData<T>({
        url: '/analytics/connections/ga4/start',
        method: 'post',
        data: returnPath ? { returnPath } : {},
    })
}

export async function apiStartAdsOAuth<T>(returnPath?: string) {
    return ApiService.fetchData<T>({
        url: '/analytics/connections/ads/start',
        method: 'post',
        data: returnPath ? { returnPath } : {},
    })
}

export async function apiStartSearchConsoleOAuth<T>(returnPath?: string) {
    return ApiService.fetchData<T>({
        url: '/analytics/connections/search-console/start',
        method: 'post',
        data: returnPath ? { returnPath } : {},
    })
}

export async function apiGetGa4Properties<T>(connectionId: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ga4/properties`,
        method: 'get',
    })
}

export async function apiSelectGa4Property<T>(connectionId: string, propertyId: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ga4/property`,
        method: 'put',
        data: { propertyId },
    })
}

export async function apiGetSearchConsoleProperties<T>(connectionId: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/search-console/properties`,
        method: 'get',
    })
}

export async function apiSelectSearchConsoleProperty<T>(connectionId: string, propertyId: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/search-console/property`,
        method: 'put',
        data: { propertyId },
    })
}

export async function apiRunGa4ReportSync<T>(connectionId: string, from?: string, to?: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ga4/report-sync`,
        method: 'post',
        data: {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
        },
    })
}

export async function apiGetAnalyticsReportCatalog<T>() {
    return ApiService.fetchData<T>({
        url: '/analytics/reports/catalog',
        method: 'get',
    })
}

export async function apiGetAnalyticsReportRuns<T>(limit?: number, reportKey?: string) {
    const params = new URLSearchParams()
    if (typeof limit === 'number' && Number.isFinite(limit)) {
        params.set('limit', String(limit))
    }
    if (reportKey) {
        params.set('reportKey', reportKey)
    }
    const query = params.toString()
    return ApiService.fetchData<T>({
        url: `/analytics/reports/runs${query ? `?${query}` : ''}`,
        method: 'get',
    })
}

export async function apiGetAnalyticsReportReconciliations<T>(limit?: number, reportKey?: string) {
    const params = new URLSearchParams()
    if (typeof limit === 'number' && Number.isFinite(limit)) {
        params.set('limit', String(limit))
    }
    if (reportKey) {
        params.set('reportKey', reportKey)
    }
    const query = params.toString()
    return ApiService.fetchData<T>({
        url: `/analytics/reports/reconciliations${query ? `?${query}` : ''}`,
        method: 'get',
    })
}

export async function apiImportAnalyticsReportBaseline<T>(filePath: string) {
    return ApiService.fetchData<T>({
        url: '/analytics/reports/import-baseline',
        method: 'post',
        data: { filePath },
    })
}

export async function apiReconcileAnalyticsReports<T>(reportKey?: string) {
    return ApiService.fetchData<T>({
        url: '/analytics/reports/reconcile',
        method: 'post',
        data: reportKey ? { reportKey } : {},
    })
}

export async function apiGetAnalyticsBaselineSnapshots<T>(limit?: number, reportKey?: string) {
    const params = new URLSearchParams()
    if (typeof limit === 'number' && Number.isFinite(limit)) {
        params.set('limit', String(limit))
    }
    if (reportKey) {
        params.set('reportKey', reportKey)
    }
    const query = params.toString()
    return ApiService.fetchData<T>({
        url: `/analytics/baseline-snapshots${query ? `?${query}` : ''}`,
        method: 'get',
    })
}

export async function apiGetAnalyticsDataParity<T>(limit?: number) {
    const params = new URLSearchParams()
    if (typeof limit === 'number' && Number.isFinite(limit)) {
        params.set('limit', String(limit))
    }
    const query = params.toString()
    return ApiService.fetchData<T>({
        url: `/analytics/data-parity${query ? `?${query}` : ''}`,
        method: 'get',
    })
}

export async function apiGetAnalyticsUsage<T>(limit?: number) {
    const params = new URLSearchParams()
    if (typeof limit === 'number' && Number.isFinite(limit)) {
        params.set('limit', String(limit))
    }
    const query = params.toString()
    return ApiService.fetchData<T>({
        url: `/analytics/usage${query ? `?${query}` : ''}`,
        method: 'get',
    })
}

export async function apiExportAnalyticsCanonical(params: AnalyticsCanonicalExportParams) {
    const query = new URLSearchParams()
    query.set('from', params.from)
    query.set('to', params.to)
    query.set('source', params.source ?? 'all')
    query.set('granularity', params.granularity ?? 'daily')
    return ApiService.fetchData<Blob>({
        url: `/analytics/export/canonical?${query.toString()}`,
        method: 'get',
        responseType: 'blob',
    })
}

export async function apiExportAnalyticsReport(params: AnalyticsReportExportParams) {
    const query = new URLSearchParams()
    query.set('report', params.report)
    query.set('from', params.from)
    query.set('to', params.to)
    return ApiService.fetchData<Blob>({
        url: `/analytics/export/report?${query.toString()}`,
        method: 'get',
        responseType: 'blob',
    })
}

export async function apiGetAnalyticsExportRuns<T, U extends Record<string, string | undefined>>(
    params?: U,
) {
    return ApiService.fetchData<T>({
        url: `/analytics/export/runs${buildQueryString(params)}`,
        method: 'get',
    })
}

export async function apiGetAnalyticsExportRun<T>(id: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/export/runs/${id}`,
        method: 'get',
    })
}

export async function apiRunGa4BaselineSync<T>(
    connectionId: string,
    from?: string,
    to?: string,
    reportKey?: string,
) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ga4/baseline-sync`,
        method: 'post',
        data: {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(reportKey ? { reportKey } : {}),
        },
    })
}

export async function apiRunGa4DataQuality<T>(
    connectionId: string,
    from?: string,
    to?: string,
    reportKey?: string,
) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ga4/data-quality`,
        method: 'post',
        data: {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(reportKey ? { reportKey } : {}),
        },
    })
}

export async function apiRunGa4BackfillQuality<T>(
    connectionId: string,
    from: string,
    to: string,
    reportKey?: string,
) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ga4/backfill-quality`,
        method: 'post',
        data: {
            from,
            to,
            ...(reportKey ? { reportKey } : {}),
        },
    })
}

export async function apiGetAnalyticsDataQuality<T>(limit?: number, reportKey?: string) {
    const params = new URLSearchParams()
    if (typeof limit === 'number' && Number.isFinite(limit)) {
        params.set('limit', String(limit))
    }
    if (reportKey) {
        params.set('reportKey', reportKey)
    }
    const query = params.toString()
    return ApiService.fetchData<T>({
        url: `/analytics/data-quality${query ? `?${query}` : ''}`,
        method: 'get',
    })
}

export async function apiGetAnalyticsInsightsInput<T>(
    connectionId: string,
    from?: string,
    to?: string,
    reportKey?: string,
) {
    const params = new URLSearchParams()
    params.set('connectionId', connectionId)
    if (from) {
        params.set('from', from)
    }
    if (to) {
        params.set('to', to)
    }
    if (reportKey) {
        params.set('reportKey', reportKey)
    }
    return ApiService.fetchData<T>({
        url: `/analytics/insights/input?${params.toString()}`,
        method: 'get',
    })
}

export async function apiRunGa4InitialSync<T>(connectionId: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ga4/initial-sync`,
        method: 'post',
    })
}

export async function apiRunGa4IncrementalSync<T>(connectionId: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ga4/incremental-sync`,
        method: 'post',
    })
}

export async function apiRunGa4Backfill<T>(connectionId: string, from: string, to: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ga4/backfill`,
        method: 'post',
        data: { from, to },
    })
}

export async function apiRunGa4Repair<T>(connectionId: string, from?: string, to?: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ga4/repair`,
        method: 'post',
        data: {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
        },
    })
}

export async function apiRunSearchConsoleInitialSync<T>(connectionId: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/search-console/initial-sync`,
        method: 'post',
    })
}

export async function apiRunSearchConsoleIncrementalSync<T>(connectionId: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/search-console/incremental-sync`,
        method: 'post',
    })
}

export async function apiRunSearchConsoleBackfill<T>(connectionId: string, from: string, to: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/search-console/backfill`,
        method: 'post',
        data: { from, to },
    })
}

export async function apiRunSearchConsoleRepair<T>(connectionId: string, from?: string, to?: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/search-console/repair`,
        method: 'post',
        data: {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
        },
    })
}

export async function apiRunAdsInitialSync<T>(connectionId: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ads/initial-sync`,
        method: 'post',
    })
}

export async function apiRunAdsIncrementalSync<T>(connectionId: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ads/incremental-sync`,
        method: 'post',
    })
}

export async function apiRunAdsBackfill<T>(connectionId: string, from?: string, to?: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ads/backfill`,
        method: 'post',
        data: {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
        },
    })
}

export async function apiRunAdsRepair<T>(connectionId: string, from?: string, to?: string) {
    return ApiService.fetchData<T>({
        url: `/analytics/connections/${connectionId}/ads/repair`,
        method: 'post',
        data: {
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
        },
    })
}

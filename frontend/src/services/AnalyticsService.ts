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
    source: 'ga4' | 'ads' | 'search_console'
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
        source: 'ga4' | 'ads' | 'search_console'
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

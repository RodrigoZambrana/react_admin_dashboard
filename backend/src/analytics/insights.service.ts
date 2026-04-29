import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

import { AnalyticsRepository } from './analytics.repository'
import type {
  AnalyticsAiInsight,
  AnalyticsInsightHistory,
  AnalyticsInsightPeriod,
  AnalyticsInsightPriority,
  AnalyticsInsightType,
  AnalyticsInsightsDataset,
  AnalyticsInsightsQualitySummary,
  AnalyticsInsightsResponse,
  AnalyticsOpportunitiesResponse,
  AnalyticsSummaryResponse,
  AnalyticsReportingDailyMetric,
  AnalyticsAdsDailyMetric,
  AnalyticsSearchConsoleDailyMetric,
  AnalyticsReportReconciliation,
  AnalyticsDataQualityCheck,
  AnalyticsConnection,
  AnalyticsSyncRun,
  AnalyticsReportRun,
  ComparisonMetric,
} from './analytics.types'

type DateRange = {
  from: Date
  to: Date
}

type MetricTotals = {
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
  conversions: number
  conversionValue: number
}

type SegmentKind =
  | 'campaign'
  | 'channel'
  | 'landing_page'
  | 'product'
  | 'device'
  | 'country'
  | 'query'

type SegmentAggregate = {
  kind: SegmentKind
  key: string
  label: string
  current: MetricTotals
  previous: MetricTotals
}

type InsightCandidate = Omit<AnalyticsAiInsight, 'id' | 'createdAt' | 'status'> & {
  score: number
  status: 'open'
}

type LoadedSemanticData = {
  currentRange: DateRange
  previousRange: DateRange
  reportingCurrent: AnalyticsReportingDailyMetric[]
  reportingPrevious: AnalyticsReportingDailyMetric[]
  adsCurrent: AnalyticsAdsDailyMetric[]
  adsPrevious: AnalyticsAdsDailyMetric[]
  searchCurrent: AnalyticsSearchConsoleDailyMetric[]
  searchPrevious: AnalyticsSearchConsoleDailyMetric[]
  connections: AnalyticsConnection[]
  syncRuns: AnalyticsSyncRun[]
  reportRuns: AnalyticsReportRun[]
  reconciliations: AnalyticsReportReconciliation[]
  dataQualityChecks: AnalyticsDataQualityCheck[]
  qualitySummaries: AnalyticsInsightsQualitySummary[]
}

const DAY_MS = 86_400_000

const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const endOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 23, 59, 59, 999))

const addDaysUtc = (value: Date, days: number) => {
  const clone = new Date(value)
  clone.setUTCDate(clone.getUTCDate() + days)
  return clone
}

const normalizeDate = (value?: string | null) => {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const normalizeRange = (from?: string, to?: string) => {
  const end = normalizeDate(to) ?? new Date()
  const start = normalizeDate(from) ?? addDaysUtc(end, -13)
  const normalizedStart = startOfDayUtc(start)
  const normalizedEnd = endOfDayUtc(end)
  return {
    current: {
      from: normalizedStart,
      to: normalizedEnd,
    },
    previous: (() => {
      const spanDays = Math.max(1, Math.round((normalizedEnd.getTime() - normalizedStart.getTime()) / DAY_MS) + 1)
      const previousTo = endOfDayUtc(addDaysUtc(normalizedStart, -1))
      const previousFrom = startOfDayUtc(addDaysUtc(previousTo, -(spanDays - 1)))
      return {
        from: previousFrom,
        to: previousTo,
      }
    })(),
  }
}

const createTotals = (): MetricTotals => ({
  sessions: 0,
  users: 0,
  revenue: 0,
  orders: 0,
  cost: 0,
  impressions: 0,
  clicks: 0,
  views: 0,
  addToCart: 0,
  eventCount: 0,
  keyEvents: 0,
  ga4PurchaseProxy: 0,
  purchase: 0,
  conversions: 0,
  conversionValue: 0,
})

const sumTotals = (target: MetricTotals, source: Partial<MetricTotals>) => {
  for (const key of Object.keys(target) as Array<keyof MetricTotals>) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      target[key] += value
    }
  }
}

const decimal = (value: number) => Number(value.toFixed(4))

const toComparisonMetric = (current: number, previous: number): ComparisonMetric => {
  const delta = current - previous
  const deltaPercent = previous === 0 ? null : decimal((delta / previous) * 100)
  return {
    current: decimal(current),
    previous: decimal(previous),
    delta: decimal(delta),
    deltaPercent,
  }
}

const ratio = (numerator: number, denominator: number) =>
  denominator > 0 ? numerator / denominator : 0

const formatDate = (value: Date) => value.toISOString().slice(0, 10)

const metricBucket = (current: MetricTotals, previous: MetricTotals) => ({
  current,
  previous,
})

const valueOrZero = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  return 0
}

const buildTotalsFromReportingRow = (row: AnalyticsReportingDailyMetric): Partial<MetricTotals> => ({
  sessions: row.sessions,
  users: row.users,
  revenue: row.revenue,
  orders: row.orders,
  cost: row.cost,
  impressions: row.impressions,
  clicks: row.clicks,
  views: row.views,
  addToCart: row.addToCart,
  eventCount: row.eventCount,
  keyEvents: row.keyEvents,
  ga4PurchaseProxy: row.ga4PurchaseProxy,
  purchase: row.purchase,
  conversions: row.purchase > row.orders ? row.purchase : row.orders,
  conversionValue: row.revenue,
})

const buildTotalsFromAdsRow = (row: AnalyticsAdsDailyMetric): Partial<MetricTotals> => ({
  cost: row.cost,
  impressions: row.impressions,
  clicks: row.clicks,
  conversions: row.conversions,
  conversionValue: row.conversionValue,
})

const buildTotalsFromSearchRow = (row: AnalyticsSearchConsoleDailyMetric): Partial<MetricTotals> => ({
  impressions: row.impressions,
  clicks: row.clicks,
})

const enrichTotals = (totals: MetricTotals) => {
  const conversionRate = ratio(totals.orders, totals.sessions)
  const purchaseRate = ratio(totals.purchase, Math.max(1, totals.addToCart || totals.views || totals.sessions))
  const addToCartRate = ratio(totals.addToCart, Math.max(1, totals.views || totals.sessions))
  const roas = ratio(totals.revenue, totals.cost)
  const ctr = ratio(totals.clicks, totals.impressions)
  const costPerSession = ratio(totals.cost, Math.max(1, totals.sessions))
  return {
    ...totals,
    conversionRate,
    purchaseRate,
    addToCartRate,
    roas,
    ctr,
    costPerSession,
  }
}

const impactFromScore = (score: number): AnalyticsInsightPriority => {
  if (score >= 72) {
    return 'high'
  }
  if (score >= 42) {
    return 'medium'
  }
  return 'low'
}

const safeString = (value: unknown) => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const segmentLabel = (kind: SegmentKind, value: string | null) => {
  if (!value) {
    switch (kind) {
      case 'campaign':
        return 'campaña desconocida'
      case 'channel':
        return 'canal desconocido'
      case 'landing_page':
        return 'landing desconocida'
      case 'product':
        return 'producto desconocido'
      case 'device':
        return 'dispositivo desconocido'
      case 'country':
        return 'país desconocido'
      case 'query':
        return 'query desconocida'
    }
  }

  return value
}

const scoreInsight = (params: {
  volume: number
  value: number
  variation: number
  quality: number
  ease: number
  kind: AnalyticsInsightType
}) => {
  const volumeScore = Math.min(1, Math.log10(params.volume + 1) / 4)
  const valueScore = Math.min(1, Math.log10(params.value + 1) / 4)
  const variationScore = Math.min(1, Math.abs(params.variation) / 100)
  const qualityScore = Math.min(1, Math.max(0, params.quality))
  const easeScore = Math.min(1, Math.max(0, params.ease))
  const kindBoost =
    params.kind === 'data_quality' ? 1.15 : params.kind === 'conversion' ? 1.08 : params.kind === 'revenue' ? 1.05 : 1

  return decimal(
    100 *
      kindBoost *
      (volumeScore * 0.25 +
        valueScore * 0.25 +
        variationScore * 0.25 +
        qualityScore * 0.1 +
        easeScore * 0.15),
  )
}

const confidenceFromEvidence = (params: { volume: number; variation: number; quality: number }) => {
  const volumeScore = Math.min(1, Math.log10(params.volume + 1) / 4)
  const variationScore = Math.min(1, Math.abs(params.variation) / 100)
  const qualityScore = Math.min(1, Math.max(0, params.quality))
  return decimal(Math.min(0.98, 0.45 + volumeScore * 0.25 + variationScore * 0.2 + qualityScore * 0.1))
}

const periodRangeToJson = (current: DateRange, previous: DateRange): AnalyticsInsightPeriod => ({
  current: {
    from: current.from.toISOString(),
    to: current.to.toISOString(),
  },
  previous: {
    from: previous.from.toISOString(),
    to: previous.to.toISOString(),
  },
})

const toJson = (value: Record<string, unknown>) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

@Injectable()
export class AnalyticsInsightsService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async getInsights(params?: { from?: string; to?: string; reportKey?: string }) {
    const bundle = await this.buildInsightsBundle(params)
    return this.buildInsightsResponse(bundle)
  }

  async getSummary(params?: { from?: string; to?: string; reportKey?: string }) {
    const bundle = await this.buildInsightsBundle(params)
    return this.buildSummaryResponse(bundle)
  }

  async getOpportunities(params?: { from?: string; to?: string; reportKey?: string }) {
    const bundle = await this.buildInsightsBundle(params)
    return this.buildOpportunitiesResponse(bundle)
  }

  async getHistory(limit = 100) {
    const history = await this.repository.listInsightHistory(limit)
    return {
      history,
    }
  }

  async recompute(params?: { from?: string; to?: string; reportKey?: string }) {
    const bundle = await this.buildInsightsBundle(params)
    await this.persistBundle(bundle)
    return this.buildInsightsResponse(bundle)
  }

  private async buildInsightsBundle(params?: { from?: string; to?: string; reportKey?: string }) {
    const ranges = normalizeRange(params?.from, params?.to)
    const [reportingCurrent, reportingPrevious, adsCurrent, adsPrevious, searchCurrent, searchPrevious, connections, syncRuns, reportRuns, reconciliations, dataQualityChecks] =
      await Promise.all([
        this.repository.listReportingDaily(ranges.current.from, ranges.current.to),
        this.repository.listReportingDaily(ranges.previous.from, ranges.previous.to),
        this.repository.listAdsDailyMetrics(ranges.current.from, ranges.current.to),
        this.repository.listAdsDailyMetrics(ranges.previous.from, ranges.previous.to),
        this.repository.listSearchConsoleDailyMetrics(ranges.current.from, ranges.current.to),
        this.repository.listSearchConsoleDailyMetrics(ranges.previous.from, ranges.previous.to),
        this.repository.listConnections(),
        this.repository.listSyncRuns(50),
        this.repository.listReportRuns(50),
        this.repository.listReportReconciliations(50, params?.reportKey),
        this.repository.listDataQualityChecks(200, params?.reportKey),
      ])

    const qualitySummaries = this.buildQualitySummaries(dataQualityChecks)
    const dataset: LoadedSemanticData = {
      currentRange: ranges.current,
      previousRange: ranges.previous,
      reportingCurrent,
      reportingPrevious,
      adsCurrent,
      adsPrevious,
      searchCurrent,
      searchPrevious,
      connections,
      syncRuns,
      reportRuns,
      reconciliations,
      dataQualityChecks,
      qualitySummaries,
    }

    const insights = this.detectPatterns(dataset)
    const sortedInsights = this.sortInsights(insights)
    const alerts = sortedInsights.filter((insight) => insight.insightType === 'data_quality' || insight.impact === 'high').slice(0, 5)
    const opportunities = sortedInsights.filter((insight) =>
      ['acquisition', 'behavior', 'conversion', 'revenue'].includes(insight.insightType),
    )
    const summary = this.composeSummary(dataset, sortedInsights)

    return {
      dataset,
      insights: sortedInsights,
      alerts,
      opportunities,
      summary,
    }
  }

  private async persistBundle(bundle: Awaited<ReturnType<AnalyticsInsightsService['buildInsightsBundle']>>) {
    const periodRange = periodRangeToJson(bundle.dataset.currentRange, bundle.dataset.previousRange)
    const summaryRecord = {
      date: bundle.dataset.currentRange.to,
      insightType: 'summary',
      title: 'Resumen ejecutivo',
      description: bundle.summary,
      impact: 'medium',
      recommendation: bundle.opportunities[0]?.recommendation ?? 'Revisar el insight principal y ejecutar la acción priorizada.',
      confidence: bundle.insights[0] ? bundle.insights[0].confidence : 0.5,
      evidence: toJson({
        summary: bundle.summary,
        totalInsights: bundle.insights.length,
        alerts: bundle.alerts.map((insight) => insight.title),
      }),
      sourceReport: 'analytics_reporting_daily',
      periodRange: toJson(periodRange),
      score: bundle.insights[0]?.score ?? 0,
      summary: bundle.summary,
    }

    await this.repository.createInsightHistoryMany([
      summaryRecord,
      ...bundle.insights.map((insight) => ({
        date: bundle.dataset.currentRange.to,
        insightType: insight.insightType,
        title: insight.title,
        description: insight.description,
        impact: insight.impact,
        recommendation: insight.recommendation,
        confidence: insight.confidence,
        evidence: toJson(insight.evidence),
        sourceReport: insight.sourceReport,
        periodRange: toJson(insight.periodRange),
        score: insight.score,
        summary: null,
      })),
    ])
  }

  private buildInsightsResponse(bundle: Awaited<ReturnType<AnalyticsInsightsService['buildInsightsBundle']>>): AnalyticsInsightsResponse {
    return {
      summary: bundle.summary,
      periodRange: periodRangeToJson(bundle.dataset.currentRange, bundle.dataset.previousRange),
      generatedAt: new Date().toISOString(),
      quality: this.buildQualityContext(bundle.dataset),
      insights: bundle.insights.map((insight) => this.toResponseInsight(insight, bundle.dataset)),
      alerts: bundle.alerts.map((insight) => this.toResponseInsight(insight, bundle.dataset)),
      opportunities: bundle.opportunities.map((insight) => this.toResponseInsight(insight, bundle.dataset)),
    }
  }

  private buildSummaryResponse(
    bundle: Awaited<ReturnType<AnalyticsInsightsService['buildInsightsBundle']>>,
  ): AnalyticsSummaryResponse {
    const insights = bundle.insights.map((insight) => this.toResponseInsight(insight, bundle.dataset))
    return {
      summary: bundle.summary,
      periodRange: periodRangeToJson(bundle.dataset.currentRange, bundle.dataset.previousRange),
      generatedAt: new Date().toISOString(),
      quality: this.buildQualityContext(bundle.dataset),
      topInsight: insights[0] ?? null,
      totalInsights: insights.length,
      alerts: insights.filter((insight) => insight.impact === 'high').slice(0, 5),
    }
  }

  private buildOpportunitiesResponse(
    bundle: Awaited<ReturnType<AnalyticsInsightsService['buildInsightsBundle']>>,
  ): AnalyticsOpportunitiesResponse {
    return {
      summary: bundle.summary,
      periodRange: periodRangeToJson(bundle.dataset.currentRange, bundle.dataset.previousRange),
      generatedAt: new Date().toISOString(),
      opportunities: bundle.opportunities.map((insight) => this.toResponseInsight(insight, bundle.dataset)),
    }
  }

  private buildQualityContext(dataset: LoadedSemanticData) {
    return {
      connections: dataset.connections,
      syncRuns: dataset.syncRuns,
      reportRuns: dataset.reportRuns,
      reconciliations: dataset.reconciliations,
      dataQualityChecks: dataset.dataQualityChecks,
      summaries: dataset.qualitySummaries,
    }
  }

  private buildQualitySummaries(
    dataQualityChecks: AnalyticsDataQualityCheck[],
  ): AnalyticsInsightsQualitySummary[] {
    const byReport = new Map<
      string,
      AnalyticsInsightsQualitySummary & { weightedDiff: number; coverageWeight: number }
    >()

    for (const check of dataQualityChecks) {
      const current =
        byReport.get(check.reportKey) ??
        ({
          reportKey: check.reportKey,
          totalChecks: 0,
          okCount: 0,
          warningCount: 0,
          errorCount: 0,
          missingBaselineCount: 0,
          averageDiffPercent: 0,
          coveragePercent: 0,
          lastCheckedAt: null,
          weightedDiff: 0,
          coverageWeight: 0,
        } satisfies AnalyticsInsightsQualitySummary & { weightedDiff: number; coverageWeight: number })

      current.totalChecks += 1
      current.weightedDiff += Math.abs(check.diffPercent)
      current.coverageWeight += check.status === 'missing_baseline' ? 0 : 1
      if (check.status === 'ok') {
        current.okCount += 1
      }
      if (check.status === 'warning') {
        current.warningCount += 1
      }
      if (check.status === 'error') {
      current.errorCount += 1
      }
      if (check.status === 'missing_baseline') {
        current.missingBaselineCount += 1
      }
      current.lastCheckedAt =
        !current.lastCheckedAt || current.lastCheckedAt < check.createdAt
          ? check.createdAt
          : current.lastCheckedAt
      byReport.set(check.reportKey, current)
    }

    return Array.from(byReport.values()).map((entry) => ({
      reportKey: entry.reportKey,
      totalChecks: entry.totalChecks,
      okCount: entry.okCount,
      warningCount: entry.warningCount,
      errorCount: entry.errorCount,
      missingBaselineCount: entry.missingBaselineCount,
      averageDiffPercent: entry.totalChecks > 0 ? decimal(entry.weightedDiff / entry.totalChecks) : 0,
      coveragePercent:
        entry.totalChecks > 0 ? decimal((entry.coverageWeight / entry.totalChecks) * 100) : 0,
      lastCheckedAt: entry.lastCheckedAt,
    }))
  }

  private collectSegments(dataset: LoadedSemanticData) {
    const buildMap = (
      rows: AnalyticsReportingDailyMetric[],
      kind: SegmentKind,
      selector: (row: AnalyticsReportingDailyMetric) => string | null,
      labelSelector: (row: AnalyticsReportingDailyMetric) => string | null = selector,
    ) => {
      const map = new Map<string, SegmentAggregate>()
      for (const row of rows) {
        const key = selector(row)
        const normalizedKey = key?.trim() || `unknown-${kind}`
        const label = segmentLabel(kind, labelSelector(row))
        const bucket =
          map.get(normalizedKey) ??
          ({
            kind,
            key: normalizedKey,
            label,
            current: createTotals(),
            previous: createTotals(),
          } satisfies SegmentAggregate)
        sumTotals(bucket.current, buildTotalsFromReportingRow(row))
        map.set(normalizedKey, bucket)
      }
      return map
    }

    const previousMaps = {
      campaign: buildMap(dataset.reportingPrevious, 'campaign', (row) => row.campaign ?? row.source ?? row.channel),
      channel: buildMap(dataset.reportingPrevious, 'channel', (row) => row.channel),
      landingPage: buildMap(dataset.reportingPrevious, 'landing_page', (row) => row.landingPage),
      product: buildMap(dataset.reportingPrevious, 'product', (row) => row.productId),
      device: buildMap(dataset.reportingPrevious, 'device', (row) => row.device),
      country: buildMap(dataset.reportingPrevious, 'country', (row) => row.country),
    }

    const currentMaps = {
      campaign: buildMap(dataset.reportingCurrent, 'campaign', (row) => row.campaign ?? row.source ?? row.channel),
      channel: buildMap(dataset.reportingCurrent, 'channel', (row) => row.channel),
      landingPage: buildMap(dataset.reportingCurrent, 'landing_page', (row) => row.landingPage),
      product: buildMap(dataset.reportingCurrent, 'product', (row) => row.productId),
      device: buildMap(dataset.reportingCurrent, 'device', (row) => row.device),
      country: buildMap(dataset.reportingCurrent, 'country', (row) => row.country),
    }

    for (const [kind, map] of Object.entries(currentMaps) as Array<[keyof typeof currentMaps, Map<string, SegmentAggregate>]>) {
      const previousMap = previousMaps[kind]
      for (const [segmentKey, segment] of map.entries()) {
        const previous = previousMap.get(segmentKey)
        if (previous) {
          segment.previous = previous.current
        }
      }
      for (const [segmentKey, segment] of previousMap.entries()) {
        if (!map.has(segmentKey)) {
          map.set(segmentKey, {
            ...segment,
            current: createTotals(),
            previous: segment.current,
          })
        }
      }
    }

    return {
      campaign: Array.from(currentMaps.campaign.values()),
      channel: Array.from(currentMaps.channel.values()),
      landingPage: Array.from(currentMaps.landingPage.values()),
      product: Array.from(currentMaps.product.values()),
      device: Array.from(currentMaps.device.values()),
      country: Array.from(currentMaps.country.values()),
    }
  }

  private collectAdsSegments(dataset: LoadedSemanticData) {
    const buildMap = (rows: AnalyticsAdsDailyMetric[]) => {
      const map = new Map<string, SegmentAggregate>()
      for (const row of rows) {
        const key = row.campaign?.trim() || 'unknown-campaign'
        const bucket =
          map.get(key) ??
          ({
            kind: 'campaign' as const,
            key,
            label: segmentLabel('campaign', row.campaign),
            current: createTotals(),
            previous: createTotals(),
          } satisfies SegmentAggregate)
        sumTotals(bucket.current, buildTotalsFromAdsRow(row))
        map.set(key, bucket)
      }
      return map
    }

    const current = buildMap(dataset.adsCurrent)
    const previous = buildMap(dataset.adsPrevious)

    for (const [key, bucket] of current.entries()) {
      const prev = previous.get(key)
      if (prev) {
        bucket.previous = prev.current
      }
    }
    for (const [key, bucket] of previous.entries()) {
      if (!current.has(key)) {
        current.set(key, {
          ...bucket,
          current: createTotals(),
          previous: bucket.current,
        })
      }
    }

    return Array.from(current.values())
  }

  private collectSearchSegments(dataset: LoadedSemanticData) {
    const buildMap = (rows: AnalyticsSearchConsoleDailyMetric[]) => {
      const map = new Map<string, SegmentAggregate>()
      for (const row of rows) {
        const key = row.query?.trim() || 'unknown-query'
        const bucket =
          map.get(key) ??
          ({
            kind: 'query' as const,
            key,
            label: segmentLabel('query', row.query),
            current: createTotals(),
            previous: createTotals(),
          } satisfies SegmentAggregate)
        sumTotals(bucket.current, buildTotalsFromSearchRow(row))
        map.set(key, bucket)
      }
      return map
    }

    const current = buildMap(dataset.searchCurrent)
    const previous = buildMap(dataset.searchPrevious)

    for (const [key, bucket] of current.entries()) {
      const prev = previous.get(key)
      if (prev) {
        bucket.previous = prev.current
      }
    }
    for (const [key, bucket] of previous.entries()) {
      if (!current.has(key)) {
        current.set(key, {
          ...bucket,
          current: createTotals(),
          previous: bucket.current,
        })
      }
    }

    return Array.from(current.values())
  }

  private detectPatterns(dataset: LoadedSemanticData): InsightCandidate[] {
    const insights: InsightCandidate[] = []
    const segmentGroups = this.collectSegments(dataset)
    const adSegments = this.collectAdsSegments(dataset)
    const searchSegments = this.collectSearchSegments(dataset)
    const qualityPressure = this.qualityPressure(dataset)

    const currentTotals = enrichTotals(this.aggregateTotals(dataset.reportingCurrent))
    const previousTotals = enrichTotals(this.aggregateTotals(dataset.reportingPrevious))
    const comparison = {
      sessions: toComparisonMetric(currentTotals.sessions, previousTotals.sessions),
      revenue: toComparisonMetric(currentTotals.revenue, previousTotals.revenue),
      orders: toComparisonMetric(currentTotals.orders, previousTotals.orders),
      conversionRate: toComparisonMetric(currentTotals.conversionRate, previousTotals.conversionRate),
      cost: toComparisonMetric(currentTotals.cost, previousTotals.cost),
      impressions: toComparisonMetric(currentTotals.impressions, previousTotals.impressions),
      clicks: toComparisonMetric(currentTotals.clicks, previousTotals.clicks),
      addToCart: toComparisonMetric(currentTotals.addToCart, previousTotals.addToCart),
      purchase: toComparisonMetric(currentTotals.purchase, previousTotals.purchase),
      roas: toComparisonMetric(currentTotals.roas, previousTotals.roas),
      ctr: toComparisonMetric(currentTotals.ctr, previousTotals.ctr),
    }

    const currentRange = periodRangeToJson(dataset.currentRange, dataset.previousRange)

    const takeTopSegments = (segments: SegmentAggregate[], kind: SegmentKind) =>
      segments
        .map((segment) => ({
          segment,
          current: enrichTotals(segment.current),
          previous: enrichTotals(segment.previous),
        }))
        .sort((left, right) => {
          const leftVolume =
            left.current.sessions + left.current.impressions + left.current.addToCart + left.current.cost
          const rightVolume =
            right.current.sessions + right.current.impressions + right.current.addToCart + right.current.cost
          return rightVolume - leftVolume
        })
        .slice(0, 8)

    const campaignSegments = takeTopSegments(segmentGroups.campaign, 'campaign')
    const channelSegments = takeTopSegments(segmentGroups.channel, 'channel')
    const landingSegments = takeTopSegments(segmentGroups.landingPage, 'landing_page')
    const productSegments = takeTopSegments(segmentGroups.product, 'product')
    const searchQuerySegments = searchSegments
      .map((segment) => ({
        segment,
        current: enrichTotals(segment.current),
        previous: enrichTotals(segment.previous),
      }))
      .sort((left, right) => right.current.impressions - left.current.impressions)
      .slice(0, 8)
    const adCampaignSegments = adSegments
      .map((segment) => ({
        segment,
        current: enrichTotals(segment.current),
        previous: enrichTotals(segment.previous),
      }))
      .sort((left, right) => right.current.cost - left.current.cost)
      .slice(0, 8)

    const pushInsight = (input: Omit<InsightCandidate, 'score' | 'status'> & { score?: number }) => {
      insights.push({
        ...input,
        score: input.score ?? scoreInsight({
          volume: valueOrZero(input.evidence.volume),
          value: valueOrZero(input.evidence.value),
          variation: valueOrZero(input.evidence.deltaPercent),
          quality: qualityPressure,
          ease: valueOrZero(input.evidence.ease ?? 0.7),
          kind: input.insightType,
        }),
        status: 'open',
      })
    }

    const summarizeSegment = (segment: SegmentAggregate, current: ReturnType<typeof enrichTotals>, previous: ReturnType<typeof enrichTotals>) => ({
      current,
      previous,
      delta: {
        sessions: current.sessions - previous.sessions,
        revenue: current.revenue - previous.revenue,
        orders: current.orders - previous.orders,
        cost: current.cost - previous.cost,
        impressions: current.impressions - previous.impressions,
        clicks: current.clicks - previous.clicks,
        addToCart: current.addToCart - previous.addToCart,
        purchase: current.purchase - previous.purchase,
      },
      deltaPercent: {
        sessions: toComparisonMetric(current.sessions, previous.sessions).deltaPercent,
        revenue: toComparisonMetric(current.revenue, previous.revenue).deltaPercent,
        orders: toComparisonMetric(current.orders, previous.orders).deltaPercent,
        cost: toComparisonMetric(current.cost, previous.cost).deltaPercent,
        impressions: toComparisonMetric(current.impressions, previous.impressions).deltaPercent,
        clicks: toComparisonMetric(current.clicks, previous.clicks).deltaPercent,
        addToCart: toComparisonMetric(current.addToCart, previous.addToCart).deltaPercent,
        purchase: toComparisonMetric(current.purchase, previous.purchase).deltaPercent,
        conversionRate: toComparisonMetric(current.conversionRate, previous.conversionRate).deltaPercent,
        roas: toComparisonMetric(current.roas, previous.roas).deltaPercent,
        ctr: toComparisonMetric(current.ctr, previous.ctr).deltaPercent,
      },
    })

    for (const entry of campaignSegments) {
      const { segment, current, previous } = entry
      const conversionRate = current.conversionRate
      const previousConversionRate = previous.conversionRate
      const highTraffic = current.sessions >= Math.max(25, currentTotals.sessions * 0.08)
      const lowConversion =
        conversionRate <= 0.02 || (previousConversionRate > 0 && conversionRate < previousConversionRate * 0.8)

      if (highTraffic && lowConversion) {
        const summary = summarizeSegment(segment, current, previous)
        pushInsight({
          insightType: 'conversion',
          title: `Tráfico alto con conversión baja en ${segment.label}`,
          description: `El segmento ${segment.label} concentró ${current.sessions} sesiones y apenas ${(conversionRate * 100).toFixed(2)}% de conversión, frente a ${(previousConversionRate * 100).toFixed(2)}% en el período anterior.`,
          recommendation: 'Revisar landing, oferta y fricción del checkout para este segmento primero.',
          confidence: confidenceFromEvidence({
            volume: current.sessions,
            variation: summary.deltaPercent.conversionRate ?? 0,
            quality: 1 - qualityPressure * 0.35,
          }),
          evidence: {
            ...summary,
            segment: segment.label,
            metric: 'conversionRate',
            source: 'analytics_reporting_daily',
            volume: current.sessions,
            value: current.revenue,
            ease: 0.85,
          },
          metric: 'conversionRate',
          segment: segment.label,
          sourceReport: 'analytics_reporting_daily',
          periodRange: currentRange,
          impact: impactFromScore(
            scoreInsight({
              volume: current.sessions,
              value: current.revenue,
              variation: summary.deltaPercent.conversionRate ?? 0,
              quality: 1 - qualityPressure * 0.25,
              ease: 0.85,
              kind: 'conversion',
            }),
          ),
        })
      }

      const purchaseRate = current.purchaseRate
      const previousPurchaseRate = previous.purchaseRate
      const addToCartHeavy = current.addToCart >= Math.max(10, currentTotals.addToCart * 0.1)
      const purchaseLeak = current.addToCart > 0 && (purchaseRate < 0.12 || (previousPurchaseRate > 0 && purchaseRate < previousPurchaseRate * 0.75))

      if (addToCartHeavy && purchaseLeak) {
        const summary = summarizeSegment(segment, current, previous)
        pushInsight({
          insightType: 'conversion',
          title: `Mucho add_to_cart y poca compra en ${segment.label}`,
          description: `${segment.label} suma ${current.addToCart} add_to_cart pero convierte solo ${(purchaseRate * 100).toFixed(2)}% a compra.`,
          recommendation: 'Ajustar confianza, shipping, precio o errores del checkout donde el carrito se cae.',
          confidence: confidenceFromEvidence({
            volume: current.addToCart,
            variation: summary.deltaPercent.purchase ?? 0,
            quality: 1 - qualityPressure * 0.25,
          }),
          evidence: {
            ...summary,
            segment: segment.label,
            metric: 'purchaseRate',
            source: 'analytics_reporting_daily',
            volume: current.addToCart,
            value: current.purchase,
            ease: 0.8,
          },
          metric: 'purchaseRate',
          segment: segment.label,
          sourceReport: 'analytics_reporting_daily',
          periodRange: currentRange,
          impact: impactFromScore(
            scoreInsight({
              volume: current.addToCart,
              value: current.revenue,
              variation: summary.deltaPercent.purchase ?? 0,
              quality: 1 - qualityPressure * 0.25,
              ease: 0.8,
              kind: 'conversion',
            }),
          ),
        })
      }

      const abruptDropThreshold =
        current.sessions >= 20 || current.revenue >= 50 || current.orders >= 5 || current.cost >= 50
      const sessionsDrop = comparison.sessions.deltaPercent !== null && comparison.sessions.deltaPercent <= -25
      if (abruptDropThreshold && sessionsDrop && previous.sessions > current.sessions) {
        const summary = summarizeSegment(segment, current, previous)
        pushInsight({
          insightType: 'behavior',
          title: `Caída abrupta de tráfico en ${segment.label}`,
          description: `${segment.label} cayó ${summary.deltaPercent.sessions?.toFixed(2)}% en sesiones respecto del período anterior.`,
          recommendation: 'Verificar cambios de campaña, tracking o disponibilidad que expliquen el descenso.',
          confidence: confidenceFromEvidence({
            volume: Math.max(current.sessions, previous.sessions),
            variation: summary.deltaPercent.sessions ?? 0,
            quality: 1 - qualityPressure * 0.2,
          }),
          evidence: {
            ...summary,
            segment: segment.label,
            metric: 'sessions',
            source: 'analytics_reporting_daily',
            volume: current.sessions,
            value: current.revenue,
            ease: 0.9,
          },
          metric: 'sessions',
          segment: segment.label,
          sourceReport: 'analytics_reporting_daily',
          periodRange: currentRange,
          impact: impactFromScore(
            scoreInsight({
              volume: Math.max(current.sessions, previous.sessions),
              value: current.revenue,
              variation: summary.deltaPercent.sessions ?? 0,
              quality: 1 - qualityPressure * 0.2,
              ease: 0.9,
              kind: 'behavior',
            }),
          ),
        })
      }
    }

    for (const entry of channelSegments) {
      const { segment, current, previous } = entry
      if (current.sessions <= 0) {
        continue
      }
      const hasTraffic = current.sessions >= Math.max(20, currentTotals.sessions * 0.06)
      const lowConversion = current.conversionRate < 0.02
      if (hasTraffic && lowConversion) {
        const summary = summarizeSegment(segment, current, previous)
        pushInsight({
          insightType: 'acquisition',
          title: `Canal ineficiente: ${segment.label}`,
          description: `${segment.label} trae ${current.sessions} sesiones con conversión de ${(current.conversionRate * 100).toFixed(2)}% y revenue de ${current.revenue.toFixed(2)}.`,
          recommendation: 'Revisar calidad del canal, mensaje y landing asociada antes de escalar presupuesto.',
          confidence: confidenceFromEvidence({
            volume: current.sessions,
            variation: summary.deltaPercent.conversionRate ?? 0,
            quality: 1 - qualityPressure * 0.25,
          }),
          evidence: {
            ...summary,
            segment: segment.label,
            metric: 'conversionRate',
            source: 'analytics_reporting_daily',
            volume: current.sessions,
            value: current.revenue,
            ease: 0.9,
          },
          metric: 'conversionRate',
          segment: segment.label,
          sourceReport: 'analytics_reporting_daily',
          periodRange: currentRange,
          impact: impactFromScore(
            scoreInsight({
              volume: current.sessions,
              value: current.revenue,
              variation: summary.deltaPercent.conversionRate ?? 0,
              quality: 1 - qualityPressure * 0.25,
              ease: 0.9,
              kind: 'acquisition',
            }),
          ),
        })
      }

      const highCost = current.cost >= Math.max(50, currentTotals.cost * 0.08)
      const lowRoas = current.cost > 0 && (current.roas < 1 || (previous.roas > 0 && current.roas < previous.roas * 0.75))
      if (highCost && lowRoas) {
        const summary = summarizeSegment(segment, current, previous)
        pushInsight({
          insightType: 'revenue',
          title: `Costo alto y ROAS bajo en ${segment.label}`,
          description: `${segment.label} concentra ${current.cost.toFixed(2)} de costo con ROAS ${current.roas.toFixed(2)} en el período actual.`,
          recommendation: 'Reducir inversión o corregir segmentación hasta recuperar retorno positivo.',
          confidence: confidenceFromEvidence({
            volume: current.cost,
            variation: summary.deltaPercent.roas ?? 0,
            quality: 1 - qualityPressure * 0.2,
          }),
          evidence: {
            ...summary,
            segment: segment.label,
            metric: 'roas',
            source: 'analytics_reporting_daily',
            volume: current.cost,
            value: current.revenue,
            ease: 0.75,
          },
          metric: 'roas',
          segment: segment.label,
          sourceReport: 'analytics_reporting_daily',
          periodRange: currentRange,
          impact: impactFromScore(
            scoreInsight({
              volume: current.cost,
              value: current.revenue,
              variation: summary.deltaPercent.roas ?? 0,
              quality: 1 - qualityPressure * 0.2,
              ease: 0.75,
              kind: 'revenue',
            }),
          ),
        })
      }

      const highImpressions = current.impressions >= Math.max(500, currentTotals.impressions * 0.1)
      const lowCtr = current.impressions > 0 && (current.ctr < 0.01 || (previous.ctr > 0 && current.ctr < previous.ctr * 0.8))
      if (highImpressions && lowCtr) {
        const summary = summarizeSegment(segment, current, previous)
        pushInsight({
          insightType: 'acquisition',
          title: `Impresiones altas y CTR bajo en ${segment.label}`,
          description: `${segment.label} acumula ${current.impressions} impresiones con CTR ${(current.ctr * 100).toFixed(2)}%.`,
          recommendation: 'Ajustar copy, creatividades o snippet para recuperar clics sobre esa audiencia.',
          confidence: confidenceFromEvidence({
            volume: current.impressions,
            variation: summary.deltaPercent.ctr ?? 0,
            quality: 1 - qualityPressure * 0.25,
          }),
          evidence: {
            ...summary,
            segment: segment.label,
            metric: 'ctr',
            source: 'analytics_ads_daily_metrics',
            volume: current.impressions,
            value: current.clicks,
            ease: 0.88,
          },
          metric: 'ctr',
          segment: segment.label,
          sourceReport: 'analytics_ads_daily_metrics',
          periodRange: currentRange,
          impact: impactFromScore(
            scoreInsight({
              volume: current.impressions,
              value: current.clicks,
              variation: summary.deltaPercent.ctr ?? 0,
              quality: 1 - qualityPressure * 0.25,
              ease: 0.88,
              kind: 'acquisition',
            }),
          ),
        })
      }
    }

    for (const entry of adCampaignSegments) {
      const { segment, current, previous } = entry
      if (current.cost <= 0) {
        continue
      }
      const lowRoas = current.cost > 0 && (current.roas < 1 || (previous.roas > 0 && current.roas < previous.roas * 0.8))
      if (lowRoas) {
        const summary = summarizeSegment(segment, current, previous)
        pushInsight({
          insightType: 'revenue',
          title: `Google Ads con ROAS bajo en ${segment.label}`,
          description: `${segment.label} gasta ${current.cost.toFixed(2)} y devuelve ROAS ${current.roas.toFixed(2)}.`,
          recommendation: 'Reasignar presupuesto o corregir segmentación/landings que no convierten.',
          confidence: confidenceFromEvidence({
            volume: current.cost,
            variation: summary.deltaPercent.roas ?? 0,
            quality: 1 - qualityPressure * 0.2,
          }),
          evidence: {
            ...summary,
            segment: segment.label,
            metric: 'roas',
            source: 'analytics_ads_daily_metrics',
            volume: current.cost,
            value: current.conversionValue,
            ease: 0.75,
          },
          metric: 'roas',
          segment: segment.label,
          sourceReport: 'analytics_ads_daily_metrics',
          periodRange: currentRange,
          impact: impactFromScore(
            scoreInsight({
              volume: current.cost,
              value: current.conversionValue,
              variation: summary.deltaPercent.roas ?? 0,
              quality: 1 - qualityPressure * 0.2,
              ease: 0.75,
              kind: 'revenue',
            }),
          ),
        })
      }

      const highImpressions = current.impressions >= Math.max(500, adCampaignSegments.reduce((sum, item) => sum + item.current.impressions, 0) * 0.1)
      const lowCtr = current.impressions > 0 && (current.ctr < 0.01 || (previous.ctr > 0 && current.ctr < previous.ctr * 0.8))
      if (highImpressions && lowCtr) {
        const summary = summarizeSegment(segment, current, previous)
        pushInsight({
          insightType: 'acquisition',
          title: `CTR bajo en Google Ads para ${segment.label}`,
          description: `${segment.label} genera ${current.impressions} impresiones con CTR ${(current.ctr * 100).toFixed(2)}%.`,
          recommendation: 'Probar nuevos anuncios o refinar la intención de la audiencia.',
          confidence: confidenceFromEvidence({
            volume: current.impressions,
            variation: summary.deltaPercent.ctr ?? 0,
            quality: 1 - qualityPressure * 0.2,
          }),
          evidence: {
            ...summary,
            segment: segment.label,
            metric: 'ctr',
            source: 'analytics_ads_daily_metrics',
            volume: current.impressions,
            value: current.clicks,
            ease: 0.88,
          },
          metric: 'ctr',
          segment: segment.label,
          sourceReport: 'analytics_ads_daily_metrics',
          periodRange: currentRange,
          impact: impactFromScore(
            scoreInsight({
              volume: current.impressions,
              value: current.clicks,
              variation: summary.deltaPercent.ctr ?? 0,
              quality: 1 - qualityPressure * 0.2,
              ease: 0.88,
              kind: 'acquisition',
            }),
          ),
        })
      }
    }

    for (const entry of searchQuerySegments) {
      const { segment, current, previous } = entry
      const highImpressions = current.impressions >= Math.max(300, searchQuerySegments.reduce((sum, item) => sum + item.current.impressions, 0) * 0.12)
      const lowCtr = current.impressions > 0 && (current.ctr < 0.015 || (previous.ctr > 0 && current.ctr < previous.ctr * 0.8))
      if (highImpressions && lowCtr) {
        const summary = summarizeSegment(segment, current, previous)
        pushInsight({
          insightType: 'acquisition',
          title: `Oportunidad SEO en ${segment.label}`,
          description: `${segment.label} recibe ${current.impressions} impresiones con CTR ${(current.ctr * 100).toFixed(2)}%.`,
          recommendation: 'Mejorar title, meta description o intención de la landing asociada.',
          confidence: confidenceFromEvidence({
            volume: current.impressions,
            variation: summary.deltaPercent.ctr ?? 0,
            quality: 1 - qualityPressure * 0.15,
          }),
          evidence: {
            ...summary,
            segment: segment.label,
            metric: 'ctr',
            source: 'analytics_search_console_daily_metrics',
            volume: current.impressions,
            value: current.clicks,
            ease: 0.9,
          },
          metric: 'ctr',
          segment: segment.label,
          sourceReport: 'analytics_search_console_daily_metrics',
          periodRange: currentRange,
          impact: impactFromScore(
            scoreInsight({
              volume: current.impressions,
              value: current.clicks,
              variation: summary.deltaPercent.ctr ?? 0,
              quality: 1 - qualityPressure * 0.15,
              ease: 0.9,
              kind: 'acquisition',
            }),
          ),
        })
      }
    }

    const dataQualityReconciliation = this.detectDataQuality(dataset, qualityPressure, currentRange)
    insights.push(...dataQualityReconciliation)

    const abruptDrops = [
      { metric: 'revenue', current: currentTotals.revenue, previous: previousTotals.revenue, kind: 'revenue' as const },
      { metric: 'orders', current: currentTotals.orders, previous: previousTotals.orders, kind: 'conversion' as const },
      { metric: 'sessions', current: currentTotals.sessions, previous: previousTotals.sessions, kind: 'behavior' as const },
      { metric: 'cost', current: currentTotals.cost, previous: previousTotals.cost, kind: 'revenue' as const },
    ]

    for (const item of abruptDrops) {
      const comparison = toComparisonMetric(item.current, item.previous)
      const enoughVolume = item.previous >= 30 || item.current >= 30
      if (enoughVolume && comparison.deltaPercent !== null && comparison.deltaPercent <= -25) {
        pushInsight({
          insightType: item.kind,
          title: `Caída abrupta en ${item.metric}`,
          description: `${item.metric} cayó ${comparison.deltaPercent.toFixed(2)}% frente al período anterior.`,
          recommendation: 'Buscar cambios de campaña, contenido, disponibilidad o medición que expliquen el quiebre.',
          confidence: confidenceFromEvidence({
            volume: Math.max(item.current, item.previous),
            variation: comparison.deltaPercent ?? 0,
            quality: 1 - qualityPressure * 0.2,
          }),
          evidence: {
            metric: item.metric,
            source: 'analytics_reporting_daily',
            current: comparison.current,
            previous: comparison.previous,
            delta: comparison.delta,
            deltaPercent: comparison.deltaPercent,
            volume: Math.max(item.current, item.previous),
            ease: 0.9,
          },
          metric: item.metric,
          segment: null,
          sourceReport: 'analytics_reporting_daily',
          periodRange: currentRange,
          impact: impactFromScore(
            scoreInsight({
              volume: Math.max(item.current, item.previous),
              value: Math.max(item.current, item.previous),
              variation: comparison.deltaPercent ?? 0,
              quality: 1 - qualityPressure * 0.2,
              ease: 0.9,
              kind: item.kind,
            }),
          ),
        })
      }
    }

    return insights
  }

  private detectDataQuality(
    dataset: LoadedSemanticData,
    qualityPressure: number,
    currentRange: AnalyticsInsightPeriod,
  ): InsightCandidate[] {
    const insights: InsightCandidate[] = []
    const errorSummary = dataset.qualitySummaries
      .sort((left, right) => right.errorCount - left.errorCount || right.missingBaselineCount - left.missingBaselineCount)
      .find((entry) => entry.errorCount > 0 || entry.missingBaselineCount > 0 || entry.coveragePercent < 90)

    if (!errorSummary && !dataset.reconciliations.length) {
      return insights
    }

    const reconciliation = dataset.reconciliations[0] ?? null
    const worstReconciliation = reconciliation && ['gap', 'partial', 'missing'].includes(reconciliation.status)
      ? reconciliation
      : dataset.reconciliations.find((entry) => entry.status === 'gap' || entry.status === 'partial' || entry.status === 'missing') ?? null

    if (errorSummary || worstReconciliation) {
      const coverage = errorSummary?.coveragePercent ?? 100
      const deltaPercent = worstReconciliation ? worstReconciliation.deltaPercent : 0
      const issueLabel = errorSummary
        ? `${errorSummary.reportKey} cobertura ${coverage.toFixed(2)}%`
        : worstReconciliation
          ? `${worstReconciliation.reportKey} reconciliación ${worstReconciliation.status}`
          : 'calidad de datos'
      const summaryText = errorSummary
        ? `La cobertura de ${errorSummary.reportKey} quedó en ${coverage.toFixed(2)}% con ${errorSummary.errorCount} checks con error y ${errorSummary.missingBaselineCount} sin baseline.`
        : `La reconciliación ${worstReconciliation?.reportKey ?? 'canónica'} quedó en estado ${worstReconciliation?.status ?? 'unknown'} con delta ${deltaPercent.toFixed(2)}%.`

      insights.push({
        insightType: 'data_quality',
        title: `Riesgo de calidad de datos en ${issueLabel}`,
        description: summaryText,
        recommendation: 'Revisar baseline, query hash y últimas sync runs antes de usar estos datos para decisiones.',
        confidence: confidenceFromEvidence({
          volume: Math.max(errorSummary?.totalChecks ?? 0, worstReconciliation?.baselineRowCount ?? 0),
          variation: Math.abs(deltaPercent),
          quality: Math.max(0.3, 1 - qualityPressure * 0.1),
        }),
        evidence: {
          qualitySummary: errorSummary ?? null,
          reconciliation: worstReconciliation ?? null,
          connectionHealth: dataset.connections.map((connection) => ({
            id: connection.id,
            source: connection.source,
            status: connection.status,
            lagMinutes: connection.health.lagMinutes,
            lastErrorMessage: connection.health.lastErrorMessage,
          })),
          source: 'analytics_data_quality_checks',
          volume: errorSummary?.totalChecks ?? worstReconciliation?.baselineRowCount ?? 0,
          value: Math.abs(deltaPercent),
          ease: 1,
        },
        metric: 'data_quality',
        segment: worstReconciliation?.reportKey ?? errorSummary?.reportKey ?? null,
        sourceReport: worstReconciliation?.reportKey ?? errorSummary?.reportKey ?? 'analytics_data_quality_checks',
        periodRange: currentRange,
        impact: 'high',
        score: scoreInsight({
          volume: Math.max(errorSummary?.totalChecks ?? 0, worstReconciliation?.baselineRowCount ?? 0),
          value: Math.abs(deltaPercent),
          variation: Math.abs(deltaPercent),
          quality: 1,
          ease: 1,
          kind: 'data_quality',
        }),
        status: 'open',
      })
    }

    const badConnections = dataset.connections.filter(
      (connection) =>
        connection.status === 'error' ||
        connection.needsReauth ||
        (connection.health.lagMinutes !== null && connection.health.lagMinutes > 120),
    )
    if (badConnections.length) {
      insights.push({
        insightType: 'data_quality',
        title: 'La confianza del análisis baja por conectores con health débil',
        description: `${badConnections.length} conexión(es) muestran error, reauth pendiente o lag operativo.`,
        recommendation: 'Corregir conectividad y reejecutar el recompute para validar si la señal cambia.',
        confidence: 0.78,
        evidence: {
          badConnections: badConnections.map((connection) => ({
            id: connection.id,
            source: connection.source,
            status: connection.status,
            needsReauth: connection.needsReauth,
            lagMinutes: connection.health.lagMinutes,
            lastErrorMessage: connection.health.lastErrorMessage,
          })),
          source: 'analytics_connections',
          volume: badConnections.length,
          value: 1,
          ease: 1,
        },
        metric: 'connection_health',
        segment: null,
        sourceReport: 'analytics_connections',
        periodRange: currentRange,
        impact: 'medium',
        score: scoreInsight({
          volume: badConnections.length,
          value: badConnections.length,
          variation: 100,
          quality: 1,
          ease: 1,
          kind: 'data_quality',
        }),
        status: 'open',
      })
    }

    return insights
  }

  private qualityPressure(dataset: LoadedSemanticData) {
    const summaries = dataset.qualitySummaries
    if (!summaries.length) {
      return dataset.reconciliations.length ? 0.35 : 0.15
    }

    const coveragePenalty = summaries.reduce((sum, entry) => sum + Math.max(0, 100 - entry.coveragePercent), 0) / summaries.length / 100
    const errorPenalty = summaries.reduce((sum, entry) => sum + entry.errorCount + entry.missingBaselineCount, 0) / Math.max(1, summaries.reduce((sum, entry) => sum + entry.totalChecks, 0))
    return Math.min(1, coveragePenalty * 0.6 + errorPenalty * 0.4)
  }

  private aggregateTotals(rows: AnalyticsReportingDailyMetric[]) {
    const totals = createTotals()
    for (const row of rows) {
      sumTotals(totals, buildTotalsFromReportingRow(row))
    }
    return totals
  }

  private sortInsights(insights: InsightCandidate[]) {
    return [...insights]
      .sort((left, right) => right.score - left.score || right.confidence - left.confidence)
      .map((insight) => ({
        ...insight,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
      }))
  }

  private toResponseInsight(
    insight: ReturnType<AnalyticsInsightsService['sortInsights']>[number],
    dataset: LoadedSemanticData,
  ): AnalyticsAiInsight {
    return {
      ...insight,
      periodRange: periodRangeToJson(dataset.currentRange, dataset.previousRange),
    }
  }

  private composeSummary(dataset: LoadedSemanticData, insights: ReturnType<AnalyticsInsightsService['sortInsights']>) {
    const currentTotals = enrichTotals(this.aggregateTotals(dataset.reportingCurrent))
    const previousTotals = enrichTotals(this.aggregateTotals(dataset.reportingPrevious))
    const topInsight = insights[0] ?? null
    const qualitySummary = dataset.qualitySummaries[0] ?? null
    const conversionDelta = toComparisonMetric(currentTotals.conversionRate, previousTotals.conversionRate).deltaPercent
    const revenueDelta = toComparisonMetric(currentTotals.revenue, previousTotals.revenue).deltaPercent
    const orderDelta = toComparisonMetric(currentTotals.orders, previousTotals.orders).deltaPercent

    const summaryParts = [
      `El período actual registra ${currentTotals.sessions.toFixed(0)} sesiones, ${currentTotals.orders.toFixed(0)} órdenes y ${currentTotals.revenue.toFixed(2)} de revenue.`,
      `Vs. el período anterior, el revenue cambió ${revenueDelta === null ? 'n/a' : `${revenueDelta.toFixed(2)}%`}, las órdenes ${orderDelta === null ? 'n/a' : `${orderDelta.toFixed(2)}%`} y la conversión ${conversionDelta === null ? 'n/a' : `${conversionDelta.toFixed(2)}%`}.`,
    ]

    if (topInsight) {
      summaryParts.push(`La prioridad inmediata es ${topInsight.title.toLowerCase()}.`)
    }

    if (qualitySummary) {
      summaryParts.push(
        `La calidad de datos principal es ${qualitySummary.reportKey} con cobertura ${qualitySummary.coveragePercent.toFixed(2)}% y ${qualitySummary.errorCount} errores.`,
      )
    } else if (dataset.reconciliations.length) {
      summaryParts.push(`La reconciliación más reciente quedó en estado ${dataset.reconciliations[0].status}.`)
    }

    return summaryParts.join(' ')
  }
}

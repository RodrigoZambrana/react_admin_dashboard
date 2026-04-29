import { Injectable, Logger } from '@nestjs/common'
import { parse } from 'csv-parse/sync'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join, resolve } from 'node:path'
import { promisify } from 'node:util'

import { AnalyticsRepository } from '../analytics.repository'
import {
  buildSnapshotGroup,
  compareAggregates,
  summarizeParityChecks,
  type AnalyticsBaselineMetricSnapshot,
  type AnalyticsBaselineOrigin,
  type AnalyticsBaselineSource,
  type AnalyticsParityCheckResult,
} from './analytics-baseline-parity.core'
import { buildAnalyticsCanonicalDimensionPayload, buildAnalyticsDimensionHash } from '../dimensions/analytics-dimension-hash'
import type {
  AnalyticsBaselineCheck,
  AnalyticsDataAnomaly,
  AnalyticsDataParityResponse,
  AnalyticsDataParityStatus,
  AnalyticsUsageResponse,
} from '../analytics.types'
import { splitGa4BaselineBlocks } from '../reports/ga4-report-parser'

const execFileAsync = promisify(execFile)

const DEFAULT_BASELINE_DIR = '/Users/rodrigo/Personal/Proyectos/urucortinas/analitycs'
const DEFAULT_BASELINE_CHECK_LOOKBACK_DAYS = 3
const KNOWN_ANALYTICS_ENDPOINTS = [
  '/analytics/insights',
  '/analytics/summary',
  '/analytics/opportunities',
  '/analytics/export/canonical',
  '/analytics/export/report',
  '/analytics/export/runs',
  '/analytics/data-parity',
  '/analytics/usage',
] as const

const GA4_METRIC_LABEL_MAP: Record<string, string | null> = {
  'usuarios activos': 'users',
  'usuarios nuevos': 'new_users',
  'tiempo de interacción medio por usuario activo': 'avg_engagement_time',
  'total de ingresos': 'revenue',
  'sesiones': 'sessions',
  'eventos clave': 'key_events',
}

const ADS_METRIC_LABEL_MAP: Record<string, string> = {
  clicks: 'clicks',
  clics: 'clicks',
  impressions: 'impressions',
  impresiones: 'impressions',
  cost: 'cost',
  coste: 'cost',
  ctr: 'ctr',
  conversions: 'conversions',
  conversiones: 'conversions',
  conversionvalue: 'conversion_value',
  'conversion value': 'conversion_value',
  'valor de conv': 'conversion_value',
  'valor de conversión': 'conversion_value',
  'cpc medio': 'avg_cpc',
}

const SEARCH_METRIC_LABEL_MAP: Record<string, string> = {
  clicks: 'clicks',
  clics: 'clicks',
  impressions: 'impressions',
  impresiones: 'impressions',
  ctr: 'ctr',
  position: 'position',
  posición: 'position',
}

const canonicalMetricLabel = (source: AnalyticsBaselineSource, label: string) => {
  const normalized = normalizeHeader(label)
  if (source === 'ga4') {
    return GA4_METRIC_LABEL_MAP[normalized] ?? null
  }
  if (source === 'ads') {
    return ADS_METRIC_LABEL_MAP[normalized] ?? null
  }
  return SEARCH_METRIC_LABEL_MAP[normalized] ?? null
}

const normalizeHeader = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim()
    .toLowerCase()

const parseNumeric = (value: unknown, asPercent = false) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return asPercent ? value / 100 : value
  }
  const cleaned = String(value ?? '')
    .replace(/\s/gu, '')
    .replace(/\u00a0/gu, '')
    .replace('%', '')
    .replace('$', '')
    .replace('US', '')
    .trim()
  const normalized =
    cleaned.includes(',') && cleaned.includes('.')
      ? cleaned.replace(/\./gu, '').replace(',', '.')
      : cleaned.includes(',')
        ? cleaned.replace(',', '.')
        : cleaned
  if (!normalized) {
    return 0
  }
  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return asPercent ? parsed / 100 : parsed
}

const parseDateFromRangeLabel = (value: string | null | undefined) => {
  if (!value) {
    return null
  }
  const trimmed = value.trim()
  const direct = new Date(trimmed)
  if (!Number.isNaN(direct.getTime())) {
    return direct
  }
  const compact = trimmed.match(/(\d{4})[./-](\d{2})[./-](\d{2})/u)
  if (compact) {
    return new Date(Date.UTC(Number(compact[1]), Number(compact[2]) - 1, Number(compact[3])))
  }
  return null
}

const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const addDaysUtc = (value: Date, days: number) => {
  const clone = new Date(value)
  clone.setUTCDate(clone.getUTCDate() + days)
  return clone
}

const stableSerialize = (value: unknown): string => {
  if (value === null) {
    return 'null'
  }
  if (value === undefined) {
    return 'undefined'
  }
  if (typeof value !== 'object') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`
  }
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
    .join(',')}}`
}

const hashPayload = (value: unknown) => {
  return createHash('sha256').update(stableSerialize(value)).digest('hex')
}

const buildSnapshotDimensions = (dimensions: Record<string, unknown>) =>
  buildAnalyticsCanonicalDimensionPayload(
    Object.fromEntries(
      Object.entries(dimensions)
        .map(([key, value]) => [normalizeHeader(key), value ?? null] as const)
        .filter(([, value]) => value !== null && value !== ''),
    ),
  )

type ParsedBaselineFile = {
  filePath: string
  source: AnalyticsBaselineSource
  snapshotGroup: string
  rows: Array<Record<string, string>>
  rangeFrom: Date | null
  rangeTo: Date | null
}

const inferSourceFromPath = (filePath: string): AnalyticsBaselineSource | null => {
  const value = filePath.toLowerCase()
  if (value.includes('google ads') || value.includes('ads')) {
    return 'ads'
  }
  if (value.includes('search') || value.includes('console') || value.includes('performance-on-search')) {
    return 'search_console'
  }
  if (value.includes('informe') || value.includes('panor') || value.includes('ga4')) {
    return 'ga4'
  }
  return null
}

const inferRangeFromPath = (filePath: string) => {
  const file = basename(filePath)
  const match = file.match(/(\d{4}[./-]\d{2}[./-]\d{2})-(\d{4}[./-]\d{2}[./-]\d{2})/u)
  if (!match) {
    const single = file.match(/(\d{4}[./-]\d{2}[./-]\d{2})/u)
    return {
      from: single ? parseDateFromRangeLabel(single[1]) : null,
      to: single ? parseDateFromRangeLabel(single[1]) : null,
    }
  }
  return {
    from: parseDateFromRangeLabel(match[1]),
    to: parseDateFromRangeLabel(match[2]),
  }
}

const toJson = (value: Record<string, unknown>) => JSON.parse(JSON.stringify(value))

const readGa4DateRange = (content: string) => {
  const fromMatch = content.match(/Fecha de inicio:\s*([0-9]{8})/u)
  const toMatch = content.match(/Fecha de finalizaci[oó]n:\s*([0-9]{8})/u)
  const parseCompact = (value: string | null) => {
    if (!value) {
      return null
    }
    const year = Number(value.slice(0, 4))
    const month = Number(value.slice(4, 6)) - 1
    const day = Number(value.slice(6, 8))
    return new Date(Date.UTC(year, month, day))
  }
  return {
    from: parseCompact(fromMatch?.[1] ?? null),
    to: parseCompact(toMatch?.[1] ?? null),
  }
}

const parseSearchConsoleArchive = async (filePath: string) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'analytics-search-console-'))
  try {
    await execFileAsync('unzip', ['-o', filePath, '-d', tempDir])
    return await walkBaselineFiles(tempDir)
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  }
}

const walkBaselineFiles = async (rootDir: string): Promise<string[]> => {
  const entries = await readdir(rootDir, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    const fullPath = join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walkBaselineFiles(fullPath)))
      continue
    }
    if (entry.isFile() && ['.csv', '.zip'].includes(extname(entry.name).toLowerCase())) {
      files.push(fullPath)
    }
  }
  return files
}

const parseCsvRows = (content: string) =>
  parse(content, {
    columns: true,
    trim: true,
    skip_empty_lines: true,
    relax_column_count: true,
  }) as Array<Record<string, string>>

type BaselineSnapshotLike = {
  source: AnalyticsBaselineSource
  date: Date | string
  metric?: string
  metricName?: string
  value: number
  origin?: AnalyticsBaselineOrigin | string
  snapshotGroup?: string
}

type BaselineAggregateRow = {
  source: AnalyticsBaselineSource
  metric: string
  date: string
  apiValue: number | null
  importValue: number | null
  exportValue: number | null
  apiDiffPct: number
  exportDiffPct: number
  apiStatus: AnalyticsDataParityStatus
  exportStatus: AnalyticsDataParityStatus
  snapshotGroup: string
}

@Injectable()
export class AnalyticsDataParityService {
  private readonly logger = new Logger(AnalyticsDataParityService.name)

  constructor(private readonly repository: AnalyticsRepository) {}

  async importCsvBaselines(rootDir = DEFAULT_BASELINE_DIR, snapshotGroup?: string) {
    const normalizedRoot = resolve(rootDir)
    const group = snapshotGroup ?? buildSnapshotGroup('csv', 'ga4', basename(normalizedRoot))
    const files = await walkBaselineFiles(normalizedRoot)
    const snapshots: AnalyticsBaselineMetricSnapshot[] = []

    for (const filePath of files) {
      if (extname(filePath).toLowerCase() === '.zip') {
        const archiveRange = inferRangeFromPath(filePath)
        const extractedFiles = await parseSearchConsoleArchive(filePath)
        for (const extractedFile of extractedFiles) {
          snapshots.push(
            ...(await this.parseFileToSnapshots(extractedFile, group, 'search_console', archiveRange.to)),
          )
        }
        continue
      }
      snapshots.push(...(await this.parseFileToSnapshots(filePath, group)))
    }

    let imported = 0
    for (const snapshot of snapshots) {
      await this.repository.upsertBaselineSnapshot({
        connectionId: snapshot.connectionId,
        source: snapshot.source,
        reportKey: snapshot.reportKey,
        date: snapshot.date,
        metricName: snapshot.metric,
        dimensionHash: snapshot.dimensionHash ?? buildAnalyticsDimensionHash(snapshot.dimensions),
        dimensionValues: toJson(buildSnapshotDimensions(snapshot.dimensions)),
        value: snapshot.value,
        queryHash: snapshot.queryHash,
        origin: snapshot.origin,
        snapshotGroup: snapshot.snapshotGroup,
        raw: snapshot.raw ? toJson(snapshot.raw) : null,
      })
      imported += 1
    }

    return {
      snapshotGroup: group,
      importedSnapshots: imported,
      filesProcessed: files.length,
      sources: this.summarizeSources(snapshots),
    }
  }

  async generateApiSnapshots(input?: {
    from?: string | null
    to?: string | null
    snapshotGroup?: string | null
  }) {
    const range = this.resolveRange(input?.from, input?.to)
    const group = input?.snapshotGroup ?? buildSnapshotGroup('api', 'ga4', range.to.toISOString())
    const snapshots = await this.buildApiSnapshots(range.from, range.to, group)
    let imported = 0
    for (const snapshot of snapshots) {
      await this.repository.upsertBaselineSnapshot({
        connectionId: snapshot.connectionId,
        source: snapshot.source,
        reportKey: snapshot.reportKey,
        date: snapshot.date,
        metricName: snapshot.metric,
        dimensionHash: snapshot.dimensionHash ?? buildAnalyticsDimensionHash(snapshot.dimensions),
        dimensionValues: toJson(buildSnapshotDimensions(snapshot.dimensions)),
        value: snapshot.value,
        queryHash: snapshot.queryHash,
        origin: snapshot.origin,
        snapshotGroup: snapshot.snapshotGroup,
        raw: snapshot.raw ? toJson(snapshot.raw) : null,
      })
      imported += 1
    }

    return {
      snapshotGroup: group,
      importedSnapshots: imported,
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      sources: this.summarizeSources(snapshots),
    }
  }

  async runBaselineCheck(input?: {
    rootDir?: string
    snapshotGroup?: string
    from?: string | null
    to?: string | null
  }) {
    const snapshotGroup = input?.snapshotGroup ?? buildSnapshotGroup('csv', 'ga4', new Date().toISOString())
    const csvImport = await this.importCsvBaselines(input?.rootDir ?? DEFAULT_BASELINE_DIR, snapshotGroup)
    const apiImport = await this.generateApiSnapshots({
      from: input?.from,
      to: input?.to,
      snapshotGroup,
    })

    const checks = await this.compareSnapshotGroup(snapshotGroup, input?.from, input?.to)
    const summary = summarizeParityChecks(checks)
    const history = await this.repository.listDataParityChecks(100)
    return {
      snapshotGroup,
      csvImport,
      apiImport,
      summary: summary.summary,
      overallStatus: summary.overallStatus,
      checks,
      history,
    }
  }

  async runProductionBaselineCheck(input?: {
    from?: string | null
    to?: string | null
    snapshotGroup?: string | null
  }) {
    const range = this.resolveProductionRange(input?.from, input?.to)
    const latestCsvSnapshotGroup = input?.snapshotGroup ?? (await this.findLatestCsvSnapshotGroup())
    const snapshotGroup =
      latestCsvSnapshotGroup ?? buildSnapshotGroup('csv', 'ga4', range.to.toISOString().slice(0, 10))

    const [baselineSnapshots, apiSnapshots, exportSnapshots] = await Promise.all([
      this.repository.listBaselineSnapshots(50000, undefined, {
        origin: 'csv',
        snapshotGroup,
      }),
      this.buildApiSnapshots(range.from, range.to, snapshotGroup),
      this.buildExportSnapshots(range.from, range.to, snapshotGroup),
    ])

    const rows = this.aggregateParityRows({
      baselineSnapshots,
      apiSnapshots,
      exportSnapshots,
      snapshotGroup,
    })
    const checks = rows.flatMap((row) => [
      {
        source: row.source,
        metric: row.metric,
        date: row.date,
        comparisonKind: 'api_vs_import' as const,
        expectedValue: row.importValue ?? 0,
        actualValue: row.apiValue ?? 0,
        diffPct: row.apiDiffPct,
        status: this.toPersistedBaselineStatus(row.apiStatus),
        snapshotGroup: row.snapshotGroup,
      },
      {
        source: row.source,
        metric: row.metric,
        date: row.date,
        comparisonKind: 'export_vs_import' as const,
        expectedValue: row.importValue ?? 0,
        actualValue: row.exportValue ?? 0,
        diffPct: row.exportDiffPct,
        status: this.toPersistedBaselineStatus(row.exportStatus),
        snapshotGroup: row.snapshotGroup,
      },
    ])

    await Promise.all([
      ...checks.map((check) =>
        this.repository.createBaselineCheck({
          date: new Date(check.date),
          source: check.source,
          metric: check.metric,
          comparisonKind: check.comparisonKind,
          expectedValue: check.expectedValue,
          actualValue: check.actualValue,
          diffPct: check.diffPct,
          status: check.status,
          snapshotGroup: check.snapshotGroup,
        }),
      ),
      ...this.detectAndPersistAnomalies(rows, snapshotGroup),
    ])

    const summary = this.summarizeBaselineRows(rows)
    return {
      snapshotGroup,
      range: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
      summary,
      checks: rows,
      anomalies: await this.repository.listDataAnomalies(100),
    }
  }

  async getParityOverview(limit = 100): Promise<AnalyticsDataParityResponse> {
    const checks = await this.repository.listDataParityChecks(limit)
    const baselineChecks = await this.buildBaselineParityOverview(limit)
    const anomalies = await this.repository.listDataAnomalies(limit)
    const summary = {
      aligned: checks.filter((check) => check.status === 'aligned').length,
      warning: checks.filter((check) => check.status === 'warning').length,
      mismatch: checks.filter((check) => check.status === 'mismatch').length,
      missing: checks.filter((check) => check.status === 'missing').length,
      total: checks.length,
    }
    return {
      summary,
      baselineChecks,
      bySource: {
        ga4: checks.filter((check) => check.source === 'ga4'),
        ads: checks.filter((check) => check.source === 'ads'),
        search_console: checks.filter((check) => check.source === 'search_console'),
      },
      lastRunAt: checks[0]?.createdAt ?? null,
      overallStatus: summary.mismatch > 0 ? 'fail' : summary.warning > 0 || summary.missing > 0 ? 'degraded' : 'ok',
      history: checks,
      anomalies,
    }
  }

  async getUsageOverview(limit = 100): Promise<AnalyticsUsageResponse> {
    const endpoints = await this.repository.listEndpointUsageByEndpoint(limit)
    const daily = await this.repository.listEndpointUsageDaily(30)
    const history = await this.repository.listEndpointUsage(limit)
    const usedEndpoints = new Set(endpoints.map((entry) => entry.endpoint))
    return {
      endpoints,
      requestsByDay: daily,
      unusedEndpoints: KNOWN_ANALYTICS_ENDPOINTS.filter((endpoint) => !usedEndpoints.has(endpoint)),
      history,
    }
  }

  private async findLatestCsvSnapshotGroup() {
    const snapshots = await this.repository.listBaselineSnapshots(1, undefined, {
      origin: 'csv',
    })
    return snapshots[0]?.snapshotGroup ?? null
  }

  private resolveProductionRange(from?: string | null, to?: string | null) {
    if (from || to) {
      return this.resolveRange(from, to)
    }
    const resolvedTo = startOfDayUtc(new Date(Date.now() - 24 * 60 * 60 * 1000))
    const resolvedFrom = startOfDayUtc(
      new Date(resolvedTo.getTime() - DEFAULT_BASELINE_CHECK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000),
    )
    return {
      from: resolvedFrom,
      to: resolvedTo,
    }
  }

  private async buildExportSnapshots(from: Date, to: Date, snapshotGroup: string) {
    const [reportingRows, adsRows, searchRows] = await Promise.all([
      this.repository.listReportingDaily(from, to),
      this.repository.listAdsDailyMetrics(from, to),
      this.repository.listSearchConsoleDailyMetrics(from, to),
    ])

    const snapshots: AnalyticsBaselineMetricSnapshot[] = []

    for (const row of reportingRows) {
      const date = startOfDayUtc(new Date(row.date))
      const dimensions = {
        channel: row.channel,
        source: 'ga4',
        medium: row.medium,
        campaign: row.campaign,
        landingPage: row.landingPage,
        productId: row.productId,
        device: row.device,
        country: row.country,
      }
      const metricValues: Array<[string, number]> = [
        ['sessions', row.sessions],
        ['users', row.users],
        ['revenue', Number(row.revenue)],
        ['orders', row.orders],
        ['cost', Number(row.cost)],
        ['impressions', row.impressions],
        ['clicks', row.clicks],
        ['views', row.views],
        ['add_to_cart', row.addToCart],
        ['event_count', row.eventCount],
        ['key_events', row.keyEvents],
        ['ga4_purchase_proxy', row.ga4PurchaseProxy],
        ['purchase', row.purchase],
      ]
      for (const [metric, value] of metricValues) {
        snapshots.push({
          source: 'ga4',
          metric,
          date,
          value,
          dimensions,
          origin: 'export',
          snapshotGroup,
          reportKey: 'analytics_reporting_daily',
          connectionId: null,
          queryHash: hashPayload({ source: 'ga4', metric, date: date.toISOString(), dimensions, snapshotGroup }),
          raw: row as Record<string, unknown>,
        })
      }
    }

    for (const row of adsRows) {
      const date = startOfDayUtc(new Date(row.date))
      const dimensions = {
        campaign: row.campaign,
      }
      const metricValues: Array<[string, number]> = [
        ['clicks', row.clicks],
        ['impressions', row.impressions],
        ['cost', row.cost],
        ['conversions', row.conversions],
        ['conversion_value', row.conversionValue],
      ]
      for (const [metric, value] of metricValues) {
        snapshots.push({
          source: 'ads',
          metric,
          date,
          value,
          dimensions,
          origin: 'export',
          snapshotGroup,
          reportKey: 'analytics_ads_daily_metrics',
          connectionId: row.connectionId ?? null,
          queryHash: hashPayload({ source: 'ads', metric, date: date.toISOString(), dimensions, snapshotGroup }),
          raw: row as Record<string, unknown>,
        })
      }
    }

    for (const row of searchRows) {
      const date = startOfDayUtc(new Date(row.date))
      const dimensions = {
        query: row.query,
        page: row.page,
      }
      const metricValues: Array<[string, number]> = [
        ['clicks', row.clicks],
        ['impressions', row.impressions],
        ['ctr', row.ctr],
        ['position', row.position],
      ]
      for (const [metric, value] of metricValues) {
        snapshots.push({
          source: 'search_console',
          metric,
          date,
          value,
          dimensions,
          origin: 'export',
          snapshotGroup,
          reportKey: 'analytics_search_console_daily_metrics',
          connectionId: row.connectionId ?? null,
          queryHash: hashPayload({ source: 'search_console', metric, date: date.toISOString(), dimensions, snapshotGroup }),
          raw: row as Record<string, unknown>,
        })
      }
    }

    return snapshots
  }

  private aggregateParityRows(input: {
    baselineSnapshots: BaselineSnapshotLike[]
    apiSnapshots: BaselineSnapshotLike[]
    exportSnapshots: BaselineSnapshotLike[]
    snapshotGroup: string
  }) {
    const aggregate = new Map<string, BaselineAggregateRow>()

    const upsert = (
      origin: 'api' | 'csv' | 'export',
      snapshot: BaselineSnapshotLike,
    ) => {
      const normalizedDate =
        snapshot.date instanceof Date ? snapshot.date : new Date(snapshot.date)
      const date = normalizedDate.toISOString().slice(0, 10)
      const metric = snapshot.metric ?? snapshot.metricName ?? 'unknown'
      const snapshotGroup = snapshot.snapshotGroup ?? input.snapshotGroup
      const key = [snapshot.source, metric, date, snapshotGroup].join('|')
      const current =
        aggregate.get(key) ??
        ({
          source: snapshot.source,
          metric,
          date,
          apiValue: null,
          importValue: null,
          exportValue: null,
          apiDiffPct: 0,
          exportDiffPct: 0,
          apiStatus: 'missing',
          exportStatus: 'missing',
          snapshotGroup,
        } satisfies BaselineAggregateRow)
      if (origin === 'api') {
        current.apiValue = (current.apiValue ?? 0) + snapshot.value
      } else if (origin === 'csv') {
        current.importValue = (current.importValue ?? 0) + snapshot.value
      } else {
        current.exportValue = (current.exportValue ?? 0) + snapshot.value
      }
      aggregate.set(key, current)
    }

    for (const snapshot of input.baselineSnapshots) {
      upsert('csv', snapshot)
    }
    for (const snapshot of input.apiSnapshots) {
      upsert('api', snapshot)
    }
    for (const snapshot of input.exportSnapshots) {
      upsert('export', snapshot)
    }

    const rows = [...aggregate.values()].map((row) => {
      const apiComparison = this.compareValues(row.apiValue, row.importValue)
      const exportComparison = this.compareValues(row.exportValue, row.importValue)
      row.apiDiffPct = apiComparison.diffPct
      row.exportDiffPct = exportComparison.diffPct
      row.apiStatus = apiComparison.status
      row.exportStatus = exportComparison.status
      return row
    })

    return rows.sort((left, right) => {
      const sourceOrder = { ga4: 0, ads: 1, search_console: 2 } as const
      return (
        sourceOrder[left.source] - sourceOrder[right.source] ||
        left.metric.localeCompare(right.metric) ||
        right.date.localeCompare(left.date)
      )
    })
  }

  private compareValues(actual: number | null, expected: number | null) {
    if (expected === null && actual === null) {
      return { diffPct: 0, status: 'missing' as AnalyticsDataParityStatus }
    }
    if (expected === null) {
      return { diffPct: 100, status: 'missing' as AnalyticsDataParityStatus }
    }
    if (expected === 0) {
      if (actual === 0) {
        return { diffPct: 0, status: 'aligned' as AnalyticsDataParityStatus }
      }
      return { diffPct: 100, status: 'mismatch' as AnalyticsDataParityStatus }
    }
    const diffPct = ((actual ?? 0) - expected) / expected * 100
    const abs = Math.abs(diffPct)
    if (abs < 5) {
      return { diffPct, status: 'aligned' as AnalyticsDataParityStatus }
    }
    if (abs <= 20) {
      return { diffPct, status: 'warning' as AnalyticsDataParityStatus }
    }
    return { diffPct, status: 'mismatch' as AnalyticsDataParityStatus }
  }

  private detectAndPersistAnomalies(rows: BaselineAggregateRow[], snapshotGroup: string) {
    const anomalyPromises: Array<Promise<unknown>> = []
    for (const row of rows) {
      if (row.apiValue === null && row.exportValue === null && row.importValue === null) {
        continue
      }
      const values = [row.apiValue, row.importValue, row.exportValue].filter((value) => value !== null)
      const nonZeroValues = values.filter((value) => (value ?? 0) > 0)
      if (row.importValue === null && nonZeroValues.length > 0) {
        anomalyPromises.push(
          this.repository.createDataAnomaly({
            type: 'import_gap',
            source: row.source,
            metric: row.metric,
            severity: 'warning',
            description: `Missing import baseline for ${row.source}.${row.metric} on ${row.date}`,
          }),
        )
      }
      if (row.apiValue === null && (row.importValue ?? 0) > 0) {
        anomalyPromises.push(
          this.repository.createDataAnomaly({
            type: 'api_gap',
            source: row.source,
            metric: row.metric,
            severity: 'warning',
            description: `API snapshot missing for ${row.source}.${row.metric} on ${row.date}`,
          }),
        )
      }
      if (row.exportValue === null && (row.importValue ?? 0) > 0) {
        anomalyPromises.push(
          this.repository.createDataAnomaly({
            type: 'export_gap',
            source: row.source,
            metric: row.metric,
            severity: 'warning',
            description: `Export snapshot missing for ${row.source}.${row.metric} on ${row.date}`,
          }),
        )
      }
      if (row.apiStatus === 'mismatch' || row.exportStatus === 'mismatch') {
        anomalyPromises.push(
          this.repository.createDataAnomaly({
            type: 'mismatch',
            source: row.source,
            metric: row.metric,
            severity: 'critical',
            description: `Mismatch detected for ${row.source}.${row.metric} on ${row.date} (group ${snapshotGroup})`,
          }),
        )
      }
      if ((row.importValue ?? 0) > 0 && row.apiValue === 0) {
        anomalyPromises.push(
          this.repository.createDataAnomaly({
            type: 'zero_with_traffic',
            source: row.source,
            metric: row.metric,
            severity: 'warning',
            description: `Zero API value with baseline traffic for ${row.source}.${row.metric} on ${row.date}`,
          }),
        )
      }
    }
    return anomalyPromises
  }

  private toPersistedBaselineStatus(status: AnalyticsDataParityStatus): 'ok' | 'warning' | 'mismatch' {
    if (status === 'aligned') {
      return 'ok'
    }
    if (status === 'warning') {
      return 'warning'
    }
    return 'mismatch'
  }

  private summarizeBaselineRows(rows: BaselineAggregateRow[]) {
    const summary = rows.reduce(
      (acc, row) => {
        const status = row.apiStatus === 'mismatch' || row.exportStatus === 'mismatch'
          ? 'mismatch'
          : row.apiStatus === 'warning' || row.exportStatus === 'warning'
            ? 'warning'
            : row.apiStatus === 'missing' || row.exportStatus === 'missing'
              ? 'missing'
              : 'aligned'
        acc[status] += 1
        return acc
      },
      {
        aligned: 0,
        warning: 0,
        mismatch: 0,
        missing: 0,
      },
    )
    return {
      ...summary,
      total: rows.length,
    }
  }

  private async buildBaselineParityOverview(limit = 100) {
    const checks = await this.repository.listBaselineChecks(limit)
    const grouped = new Map<
      string,
      {
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
    >()

    for (const check of checks) {
      const key = [check.source, check.metric, check.date.slice(0, 10), check.snapshotGroup].join('|')
      const current =
        grouped.get(key) ??
        {
          date: check.date,
          source: check.source,
          metric: check.metric,
          apiValue: null,
          importValue: null,
          exportValue: null,
          diffPercent: 0,
          status: 'missing' as AnalyticsDataParityStatus,
          snapshotGroup: check.snapshotGroup,
          createdAt: check.createdAt,
        }
      if (check.comparisonKind === 'api_vs_import') {
        current.apiValue = check.actualValue
        current.importValue = check.expectedValue
      } else {
        current.exportValue = check.actualValue
        current.importValue = current.importValue ?? check.expectedValue
      }
      current.diffPercent = Math.max(current.diffPercent, Math.abs(check.diffPct))
      current.status =
        current.status === 'mismatch' || check.status === 'mismatch'
          ? 'mismatch'
          : current.status === 'warning' || check.status === 'warning'
            ? 'warning'
            : 'aligned'
      grouped.set(key, current)
    }

    return [...grouped.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  }

  private async compareSnapshotGroup(snapshotGroup: string, from?: string | null, to?: string | null) {
    const snapshots = await this.repository.listBaselineSnapshots(50000, undefined, {
      snapshotGroup,
    })

    const range = this.resolveRange(from, to)
    const sourceBuckets = new Map<
      AnalyticsBaselineSource,
      { api: Map<string, number>; baseline: Map<string, number> }
    >()

    for (const source of ['ga4', 'ads', 'search_console'] as const) {
      sourceBuckets.set(source, { api: new Map(), baseline: new Map() })
    }

    for (const snapshot of snapshots) {
      const snapshotDate = snapshot.date.slice(0, 10)
      const rangeFrom = range.from.toISOString().slice(0, 10)
      const rangeTo = range.to.toISOString().slice(0, 10)
      if (snapshotDate < rangeFrom || snapshotDate > rangeTo) {
        continue
      }
      const bucket = sourceBuckets.get(snapshot.source)
      if (!bucket) {
        continue
      }
      const key = snapshot.metricName
      const current = snapshot.origin === 'api' ? bucket.api : bucket.baseline
      current.set(key, (current.get(key) ?? 0) + snapshot.value)
    }

    const checks: AnalyticsParityCheckResult[] = []
    for (const [source, bucket] of sourceBuckets.entries()) {
      const metrics = new Set([...bucket.api.keys(), ...bucket.baseline.keys()])
      for (const metric of metrics) {
        const apiValue = bucket.api.get(metric) ?? 0
        const baselineValue = bucket.baseline.get(metric) ?? 0
        checks.push(
          compareAggregates({
            source,
            metric,
            apiSnapshotGroup: snapshotGroup,
            baselineSnapshotGroup: snapshotGroup,
            apiValue,
            baselineValue,
            dateFrom: range.from,
            dateTo: range.to,
          }),
        )
      }
    }

    await Promise.all(
      checks.map((check) =>
        this.repository.createDataParityCheck({
          source: check.source,
          metric: check.metric,
          dateFrom: check.dateFrom,
          dateTo: check.dateTo,
          apiValue: check.apiValue,
          baselineValue: check.baselineValue,
          deltaAbs: check.deltaAbs,
          deltaPercent: check.deltaPercent,
          status: check.status as AnalyticsDataParityStatus,
          snapshotGroup: check.snapshotGroup,
        }),
      ),
    )

    this.logger.log(
      `baseline parity ${snapshotGroup}: ${checks
        .slice(0, 12)
        .map((check) => `${check.source}.${check.metric}=${check.status}(${Math.abs(check.deltaPercent).toFixed(2)}%)`)
        .join(', ')}`,
    )

    return checks
  }

  private async buildApiSnapshots(from: Date, to: Date, snapshotGroup: string) {
    const [reportingRows, adsRows, searchRows] = await Promise.all([
      this.repository.listReportingDaily(from, to),
      this.repository.listAdsDailyMetrics(from, to),
      this.repository.listSearchConsoleDailyMetrics(from, to),
    ])

    const snapshots: AnalyticsBaselineMetricSnapshot[] = []

    for (const row of reportingRows) {
      const date = startOfDayUtc(new Date(row.date))
      const dimensions = {
        channel: row.channel,
        source: row.source,
        medium: row.medium,
        campaign: row.campaign,
        landingPage: row.landingPage,
        productId: row.productId,
        device: row.device,
        country: row.country,
      }
      const metricValues: Array<[string, number]> = [
        ['sessions', row.sessions],
        ['users', row.users],
        ['revenue', Number(row.revenue)],
        ['orders', row.orders],
        ['cost', Number(row.cost)],
        ['impressions', row.impressions],
        ['clicks', row.clicks],
        ['views', row.views],
        ['add_to_cart', row.addToCart],
        ['event_count', row.eventCount],
        ['key_events', row.keyEvents],
        ['ga4_purchase_proxy', row.ga4PurchaseProxy],
        ['purchase', row.purchase],
      ]
      for (const [metric, value] of metricValues) {
        snapshots.push({
          source: 'ga4',
          metric,
          date,
          value,
          dimensions,
          origin: 'api',
          snapshotGroup,
          reportKey: 'analytics_reporting_daily',
          connectionId: null,
          queryHash: hashPayload({ source: 'ga4', metric, date: date.toISOString(), dimensions, snapshotGroup }),
          raw: row as Record<string, unknown>,
        })
      }
    }

    for (const row of adsRows) {
      const date = startOfDayUtc(new Date(row.date))
      const dimensions = {
        campaign: row.campaign,
      }
      const metricValues: Array<[string, number]> = [
        ['clicks', row.clicks],
        ['impressions', row.impressions],
        ['cost', row.cost],
        ['conversions', row.conversions],
        ['conversion_value', row.conversionValue],
      ]
      for (const [metric, value] of metricValues) {
        snapshots.push({
          source: 'ads',
          metric,
          date,
          value,
          dimensions,
          origin: 'api',
          snapshotGroup,
          reportKey: 'analytics_ads_daily_metrics',
          connectionId: row.connectionId ?? null,
          queryHash: hashPayload({ source: 'ads', metric, date: date.toISOString(), dimensions, snapshotGroup }),
          raw: row as Record<string, unknown>,
        })
      }
    }

    for (const row of searchRows) {
      const date = startOfDayUtc(new Date(row.date))
      const dimensions = {
        query: row.query,
        page: row.page,
      }
      const metricValues: Array<[string, number]> = [
        ['clicks', row.clicks],
        ['impressions', row.impressions],
        ['ctr', row.ctr],
        ['position', row.position],
      ]
      for (const [metric, value] of metricValues) {
        snapshots.push({
          source: 'search_console',
          metric,
          date,
          value,
          dimensions,
          origin: 'api',
          snapshotGroup,
          reportKey: 'analytics_search_console_daily_metrics',
          connectionId: row.connectionId ?? null,
          queryHash: hashPayload({ source: 'search_console', metric, date: date.toISOString(), dimensions, snapshotGroup }),
          raw: row as Record<string, unknown>,
        })
      }
    }

    return snapshots
  }

  private async parseFileToSnapshots(
    filePath: string,
    snapshotGroup: string,
    forcedSource?: AnalyticsBaselineSource,
    forcedDate?: Date | null,
  ): Promise<AnalyticsBaselineMetricSnapshot[]> {
    const source = forcedSource ?? inferSourceFromPath(filePath)
    if (!source) {
      return []
    }

    const content = await readFile(filePath, 'utf8')
    const rows = parseCsvRows(content)
    const headers = Object.keys(rows[0] ?? {}).map((header) => normalizeHeader(header))

    if (headers.includes('metric') && headers.includes('metric_value') && headers.includes('dimension_hash')) {
      return this.parseCanonicalExportCsvRows(filePath, rows, snapshotGroup)
    }

    if (source === 'ga4') {
      return this.parseGa4Csv(filePath, content, snapshotGroup)
    }

    const range = inferRangeFromPath(filePath)
    return this.parseGenericCsvRows(filePath, rows, source, snapshotGroup, forcedDate ?? range.to)
  }

  private parseGa4Csv(filePath: string, content: string, snapshotGroup: string) {
    const { from, to } = readGa4DateRange(content)
    const blocks = splitGa4BaselineBlocks(content)
    const snapshots: AnalyticsBaselineMetricSnapshot[] = []
    for (const block of blocks) {
      const blockDate = to ?? from ?? new Date()
      const rowHeaders = block.definition.dimensionLabels
      const metricHeaders = block.definition.metricLabels

      for (const row of block.rows) {
        const dimensions = Object.fromEntries(
          rowHeaders.map((label, index) => [label, row[index] ?? null]),
        )

        const firstColumn = String(row[0] ?? '').trim()
        const rowDate = /^\d+$/u.test(firstColumn) && from ? addDaysUtc(from, Number(firstColumn)) : blockDate

        for (let index = 0; index < metricHeaders.length; index += 1) {
          const label = metricHeaders[index] ?? ''
          const metric = canonicalMetricLabel('ga4', label)
          if (!metric) {
            continue
          }
          const rawValue = row[rowHeaders.length + index] ?? null
          snapshots.push({
            source: 'ga4',
            metric,
            date: startOfDayUtc(rowDate),
            value: parseNumeric(rawValue, metric === 'ctr'),
            dimensions,
            origin: 'csv',
            snapshotGroup,
            reportKey: basename(filePath, extname(filePath)),
            connectionId: null,
            queryHash: hashPayload({
              source: 'ga4',
              metric,
              date: startOfDayUtc(rowDate).toISOString(),
              dimensions,
              origin: 'csv',
              snapshotGroup,
              reportKey: basename(filePath, extname(filePath)),
            }),
            raw: { block: block.title, header: block.header, row },
          })
        }
      }
    }
    return snapshots
  }

  private parseGenericCsvRows(
    filePath: string,
    rows: Array<Record<string, string>>,
    source: Exclude<AnalyticsBaselineSource, 'ga4'>,
    snapshotGroup: string,
    rangeTo: Date | null,
  ) {
    const snapshots: AnalyticsBaselineMetricSnapshot[] = []
    const effectiveDate = startOfDayUtc(rangeTo ?? new Date())
    for (const row of rows) {
      const dimensions: Record<string, unknown> = {}
      const metrics: Array<[string, number]> = []
      for (const [header, value] of Object.entries(row)) {
        const metric = canonicalMetricLabel(source, header)
        if (metric) {
          metrics.push([metric, parseNumeric(value, metric === 'ctr')])
          continue
        }
        if (normalizeHeader(header) === 'date') {
          continue
        }
        dimensions[header] = value || null
      }

      for (const [metric, value] of metrics) {
        snapshots.push({
          source,
          metric,
          date: effectiveDate,
          value,
          dimensions,
          origin: 'csv',
          snapshotGroup,
          reportKey: basename(filePath, extname(filePath)),
          connectionId: null,
          queryHash: hashPayload({
            source,
            metric,
            date: effectiveDate.toISOString(),
            dimensions,
            origin: 'csv',
            snapshotGroup,
            reportKey: basename(filePath, extname(filePath)),
          }),
          raw: row,
        })
      }
    }
    return snapshots
  }

  private parseCanonicalExportCsvRows(
    filePath: string,
    rows: Array<Record<string, string>>,
    snapshotGroup: string,
  ) {
    const snapshots: AnalyticsBaselineMetricSnapshot[] = []

    for (const row of rows) {
      const source = normalizeHeader(row.source) as AnalyticsBaselineSource
      if (!['ga4', 'ads', 'search_console'].includes(source)) {
        continue
      }
      const metric = normalizeHeader(row.metric)
      const rawDate = row.date ?? row.DATE ?? ''
      const parsedDate = rawDate ? new Date(rawDate) : null
      const date = parsedDate && !Number.isNaN(parsedDate.getTime()) ? startOfDayUtc(parsedDate) : startOfDayUtc(new Date())
      const dimensions = {
        date: date.toISOString().slice(0, 10),
        source,
        channel: row.channel ?? null,
        campaign: row.campaign ?? null,
        device: row.device ?? null,
        country: row.country ?? null,
        landing_page: row.landing_page ?? row.landingPage ?? null,
      }
      const metricValue = parseNumeric(row.metric_value, metric === 'ctr')
      const dimensionHash = row.dimension_hash?.trim().length
        ? row.dimension_hash.trim()
        : buildAnalyticsDimensionHash(dimensions)

      snapshots.push({
        source,
        metric,
        date,
        value: metricValue,
        dimensions,
        dimensionHash,
        origin: 'csv',
        snapshotGroup,
        reportKey: basename(filePath, extname(filePath)),
        connectionId: null,
        queryHash: hashPayload({
          source,
          metric,
          date: date.toISOString(),
          dimensions,
          origin: 'csv',
          snapshotGroup,
          reportKey: basename(filePath, extname(filePath)),
          dimensionHash,
        }),
        raw: row,
      })
    }

    return snapshots
  }

  private summarizeSources(snapshots: AnalyticsBaselineMetricSnapshot[]) {
    const summary = new Map<AnalyticsBaselineSource, number>()
    for (const snapshot of snapshots) {
      summary.set(snapshot.source, (summary.get(snapshot.source) ?? 0) + 1)
    }
    return Object.fromEntries(summary.entries())
  }

  private resolveRange(from?: string | null, to?: string | null) {
    const resolvedTo = parseDateFromRangeLabel(to) ?? new Date()
    const resolvedFrom =
      parseDateFromRangeLabel(from) ??
      new Date(Date.UTC(resolvedTo.getUTCFullYear(), resolvedTo.getUTCMonth(), resolvedTo.getUTCDate() - 30))
    return {
      from: startOfDayUtc(resolvedFrom),
      to: startOfDayUtc(resolvedTo),
    }
  }
}

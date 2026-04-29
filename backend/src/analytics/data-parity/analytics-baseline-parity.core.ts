import { createHash } from 'node:crypto'
import { basename } from 'node:path'

import { parse } from 'csv-parse/sync'

export type AnalyticsBaselineSource = 'ga4' | 'ads' | 'search_console'
export type AnalyticsBaselineOrigin = 'api' | 'csv' | 'export'
export type AnalyticsParityStatus = 'aligned' | 'warning' | 'mismatch' | 'missing'

export type AnalyticsBaselineMetricSnapshot = {
  source: AnalyticsBaselineSource
  metric: string
  date: Date
  value: number
  dimensions: Record<string, unknown>
  dimensionHash?: string
  origin: AnalyticsBaselineOrigin
  snapshotGroup: string
  reportKey: string
  connectionId: string | null
  queryHash: string
  raw: Record<string, unknown> | null
}

export type AnalyticsParityCheckResult = {
  source: AnalyticsBaselineSource
  metric: string
  dateFrom: Date
  dateTo: Date
  apiValue: number
  baselineValue: number
  deltaAbs: number
  deltaPercent: number
  status: AnalyticsParityStatus
  snapshotGroup: string
}

export type CsvBaselineFile = {
  filePath: string
  snapshotGroup: string
  source: AnalyticsBaselineSource
  rows: Array<Record<string, string>>
}

const SOURCE_METRICS: Record<AnalyticsBaselineSource, Record<string, string>> = {
  ga4: {
    sessions: 'sessions',
    totalRevenue: 'revenue',
    revenue: 'revenue',
    users: 'users',
    eventCount: 'event_count',
    keyEvents: 'key_events',
    purchases: 'purchases',
  },
  ads: {
    clicks: 'clicks',
    impressions: 'impressions',
    cost: 'cost',
    conversions: 'conversions',
    conversionValue: 'conversion_value',
  },
  search_console: {
    clicks: 'clicks',
    impressions: 'impressions',
    ctr: 'ctr',
    position: 'position',
  },
}

const GA4_METRICS = new Set(Object.keys(SOURCE_METRICS.ga4))
const ADS_METRICS = new Set(Object.keys(SOURCE_METRICS.ads))
const SEARCH_METRICS = new Set(Object.keys(SOURCE_METRICS.search_console))

const normalizeText = (value: unknown) => String(value ?? '').trim()

const parseNumeric = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const normalized = normalizeText(value)
  if (!normalized) {
    return 0
  }
  const parsed = Number(normalized.replace(/\s/gu, '').replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

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
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(',')}}`
}

const hashPayload = (value: unknown) =>
  createHash('sha256').update(stableSerialize(value)).digest('hex')

const inferSourceFromFileName = (filePath: string): AnalyticsBaselineSource | null => {
  const file = basename(filePath).toLowerCase()
  if (file.includes('ga4')) {
    return 'ga4'
  }
  if (file.includes('ads')) {
    return 'ads'
  }
  if (file.includes('search') || file.includes('sc') || file.includes('console')) {
    return 'search_console'
  }
  return null
}

const inferSourceFromHeaders = (headers: string[]): AnalyticsBaselineSource | null => {
  const lower = headers.map((header) => header.toLowerCase())
  if (lower.some((header) => header.includes('totalrevenue') || header.includes('sessions') || header.includes('keyevents'))) {
    return 'ga4'
  }
  if (lower.some((header) => header.includes('conversionvalue') || header.includes('cost'))) {
    return 'ads'
  }
  if (lower.some((header) => header.includes('position') || header.includes('ctr'))) {
    return 'search_console'
  }
  return null
}

const normalizeMetricName = (source: AnalyticsBaselineSource, metric: string) =>
  SOURCE_METRICS[source][metric] ?? metric

const metricColumnsForSource = (source: AnalyticsBaselineSource, headers: string[]) => {
  const headerSet = new Set(headers)
  return headers.filter((header) => header !== 'date' && headerSet.has(header) && Object.hasOwn(SOURCE_METRICS[source], header))
}

export const parseCsvBaselineFile = (filePath: string, content: string): CsvBaselineFile | null => {
  const rows = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Array<Record<string, string>>

  if (!rows.length) {
    return null
  }

  const headers = Object.keys(rows[0] ?? {})
  const source = inferSourceFromFileName(filePath) ?? inferSourceFromHeaders(headers)
  if (!source) {
    return null
  }

  return {
    filePath,
    snapshotGroup: basename(filePath).replace(/\.[^.]+$/u, ''),
    source,
    rows,
  }
}

export const csvRowsToSnapshots = (file: CsvBaselineFile): AnalyticsBaselineMetricSnapshot[] => {
  const snapshots: AnalyticsBaselineMetricSnapshot[] = []
  const metricColumns = metricColumnsForSource(file.source, Object.keys(file.rows[0] ?? {}))

  for (const row of file.rows) {
    const rawDate = normalizeText(row.date)
    if (!rawDate) {
      continue
    }
    const parsedDate = new Date(rawDate)
    if (Number.isNaN(parsedDate.getTime())) {
      continue
    }

    const dimensions = Object.fromEntries(
      Object.entries(row).filter(([key]) => key !== 'date' && !metricColumns.includes(key)),
    )
    const normalizedDimensions = Object.fromEntries(
      Object.entries(dimensions).map(([key, value]) => [key, value === '' ? null : value]),
    )

    for (const metricColumn of metricColumns) {
      const metricValue = parseNumeric(row[metricColumn])
      snapshots.push({
        source: file.source,
        metric: normalizeMetricName(file.source, metricColumn),
        date: startOfDayUtc(parsedDate),
        value: metricValue,
        dimensions: normalizedDimensions,
        origin: 'csv',
        snapshotGroup: file.snapshotGroup,
        reportKey: file.source,
        connectionId: null,
        queryHash: hashPayload({
          source: file.source,
          metric: normalizeMetricName(file.source, metricColumn),
          date: rawDate,
          dimensions: normalizedDimensions,
          origin: 'csv',
          snapshotGroup: file.snapshotGroup,
        }),
        raw: row,
      })
    }
  }

  return snapshots
}

export const aggregateSnapshots = (snapshots: AnalyticsBaselineMetricSnapshot[]) => {
  const aggregates = new Map<
    string,
    {
      source: AnalyticsBaselineSource
      metric: string
      snapshotGroup: string
      origin: AnalyticsBaselineOrigin
      dateFrom: Date
      dateTo: Date
      value: number
      count: number
    }
  >()

  for (const snapshot of snapshots) {
    const key = [snapshot.source, snapshot.metric, snapshot.origin, snapshot.snapshotGroup].join('|')
    const current =
      aggregates.get(key) ??
      ({
        source: snapshot.source,
        metric: snapshot.metric,
        snapshotGroup: snapshot.snapshotGroup,
        origin: snapshot.origin,
        dateFrom: snapshot.date,
        dateTo: snapshot.date,
        value: 0,
        count: 0,
      } satisfies {
        source: AnalyticsBaselineSource
        metric: string
        snapshotGroup: string
        origin: AnalyticsBaselineOrigin
        dateFrom: Date
        dateTo: Date
        value: number
        count: number
      })

    current.value += snapshot.value
    current.count += 1
    current.dateFrom = current.dateFrom < snapshot.date ? current.dateFrom : snapshot.date
    current.dateTo = current.dateTo > snapshot.date ? current.dateTo : snapshot.date
    aggregates.set(key, current)
  }

  return [...aggregates.values()]
}

export const compareAggregates = (input: {
  source: AnalyticsBaselineSource
  metric: string
  apiSnapshotGroup: string
  baselineSnapshotGroup: string
  apiValue: number
  baselineValue: number
  dateFrom: Date
  dateTo: Date
}) => {
  const deltaAbs = Number((input.apiValue - input.baselineValue).toFixed(6))
  const deltaPercent =
    input.baselineValue === 0
      ? input.apiValue === 0
        ? 0
        : 100
      : Number((((input.apiValue - input.baselineValue) / input.baselineValue) * 100).toFixed(4))
  return {
    source: input.source,
    metric: input.metric,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    apiValue: input.apiValue,
    baselineValue: input.baselineValue,
    deltaAbs,
    deltaPercent,
    status: determineParityStatus(input.source, deltaPercent, input.apiValue, input.baselineValue),
    snapshotGroup: `${input.apiSnapshotGroup}::${input.baselineSnapshotGroup}`,
  } satisfies AnalyticsParityCheckResult
}

export const determineParityStatus = (
  source: AnalyticsBaselineSource,
  deltaPercent: number,
  apiValue: number,
  baselineValue: number,
): AnalyticsParityStatus => {
  if (apiValue === 0 && baselineValue === 0) {
    return 'aligned'
  }
  if (baselineValue === 0 || apiValue === 0) {
    return 'missing'
  }

  const absDelta = Math.abs(deltaPercent)
  const thresholds = {
    ga4: { aligned: 5, warning: 10 },
    ads: { aligned: 2, warning: 5 },
    search_console: { aligned: 5, warning: 10 },
  }[source]

  if (absDelta <= thresholds.aligned) {
    return 'aligned'
  }
  if (absDelta <= thresholds.warning) {
    return 'warning'
  }
  return 'mismatch'
}

export const summarizeParityChecks = (checks: AnalyticsParityCheckResult[]) => {
  const summary = {
    aligned: 0,
    warning: 0,
    mismatch: 0,
    missing: 0,
    total: checks.length,
  }

  for (const check of checks) {
    summary[check.status] += 1
  }

  const overallStatus =
    summary.mismatch > 0
      ? 'fail'
      : summary.warning > 0 || summary.missing > 0
        ? 'degraded'
        : 'ok'

  return { summary, overallStatus }
}

export const detectSnapshotSource = (filePath: string, rows: Array<Record<string, string>>) => {
  const headers = Object.keys(rows[0] ?? {})
  return inferSourceFromFileName(filePath) ?? inferSourceFromHeaders(headers)
}

export const buildSnapshotGroup = (origin: AnalyticsBaselineOrigin, source: AnalyticsBaselineSource, label: string) =>
  `${origin}:${source}:${label}:${Date.now()}`

export const normalizeCsvBaselineRows = (filePath: string, content: string) => {
  const parsed = parseCsvBaselineFile(filePath, content)
  return parsed ? csvRowsToSnapshots(parsed) : []
}

export const normalizeSnapshotDate = (value: Date) => startOfDayUtc(value)

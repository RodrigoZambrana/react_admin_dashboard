import { createHash } from 'crypto'

import type { AnalyticsReportCatalogEntry } from './ga4-report-catalog'

const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const toGaDate = (value: Date) => value.toISOString().slice(0, 10).replace(/-/gu, '')

const parseNumeric = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length) {
    const normalized = value.replace(/\s/gu, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
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

  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
    left.localeCompare(right),
  )
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
    .join(',')}}`
}

export type Ga4ComparableMetricRow = {
  date: Date
  metricName: string
  dimensionHash: string
  dimensionValues: Record<string, unknown>
  value: number
  raw: Record<string, unknown>
}

export const buildGa4QueryHash = (input: {
  connectionId: string
  propertyId: string
  reportKey: string
  fromDate: Date
  toDate: Date
  dimensions: string[]
  metrics: string[]
  dateRanges: Array<{ startDate: string; endDate: string; label?: string }>
  limit?: number | null
}) => {
  const payload = {
    connectionId: input.connectionId,
    propertyId: input.propertyId,
    reportKey: input.reportKey,
    fromDate: startOfDayUtc(input.fromDate).toISOString(),
    toDate: startOfDayUtc(input.toDate).toISOString(),
    dimensions: [...input.dimensions],
    metrics: [...input.metrics],
    dateRanges: input.dateRanges.map((range) => ({
      label: range.label ?? null,
      startDate: range.startDate,
      endDate: range.endDate,
    })),
    limit: input.limit ?? null,
  }

  return createHash('sha256').update(stableSerialize(payload)).digest('hex')
}

export const buildGa4DimensionHash = (dimensionValues: Record<string, unknown>) =>
  createHash('sha256').update(stableSerialize(dimensionValues)).digest('hex')

export const normalizeGa4MetricValue = (value: unknown) => {
  const parsed = parseNumeric(value)
  return parsed === null ? 0 : parsed
}

export const resolveGa4ComparableDate = (
  dimensionValues: Record<string, unknown>,
  fallbackDate: Date,
) => {
  for (const value of Object.values(dimensionValues)) {
    const raw = typeof value === 'string' ? value.trim() : ''
    if (/^\d{8}$/u.test(raw)) {
      const year = Number(raw.slice(0, 4))
      const month = Number(raw.slice(4, 6)) - 1
      const day = Number(raw.slice(6, 8))
      return new Date(Date.UTC(year, month, day))
    }
  }

  return startOfDayUtc(fallbackDate)
}

export const normalizeGa4ComparableRows = (
  entry: AnalyticsReportCatalogEntry,
  rows: Array<Record<string, unknown>>,
  fallbackDate: Date,
) => {
  const comparableRows: Ga4ComparableMetricRow[] = []

  for (const row of rows) {
    const dimensions = Object.fromEntries(
      entry.dimensionLabels.map((label, index) => [label, row[`dimension_${index}`] ?? null]),
    )
    const dimensionHash = buildGa4DimensionHash(dimensions)
    const date = resolveGa4ComparableDate(dimensions, fallbackDate)

    for (const [metricIndex, metricName] of entry.metricLabels.entries()) {
      comparableRows.push({
        date,
        metricName,
        dimensionHash,
        dimensionValues: dimensions,
        value: normalizeGa4MetricValue(row[`metric_${metricIndex}`]),
        raw: row,
      })
    }
  }

  return comparableRows
}

export const normalizeStoredGa4ComparableRows = (
  entry: AnalyticsReportCatalogEntry,
  rows: Array<{
    dimensions: Record<string, unknown>
    metrics: Record<string, unknown>
  }>,
  fallbackDate: Date,
) => {
  const comparableRows: Ga4ComparableMetricRow[] = []

  for (const row of rows) {
    const dimensionValues = Object.fromEntries(
      entry.dimensionLabels.map((label) => [label, row.dimensions[label] ?? null]),
    )
    const dimensionHash = buildGa4DimensionHash(dimensionValues)
    const date = resolveGa4ComparableDate(dimensionValues, fallbackDate)

    for (const metricName of entry.metricLabels) {
      comparableRows.push({
        date,
        metricName,
        dimensionHash,
        dimensionValues,
        value: normalizeGa4MetricValue(row.metrics[metricName]),
        raw: {
          dimensions: row.dimensions,
          metrics: row.metrics,
        },
      })
    }
  }

  return comparableRows
}

export const formatGa4DateKey = (value: Date) => toGaDate(startOfDayUtc(value))

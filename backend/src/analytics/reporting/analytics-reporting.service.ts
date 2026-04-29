import { Injectable, Logger } from '@nestjs/common'
import { readFile } from 'fs/promises'
import { Prisma } from '@prisma/client'

import { AnalyticsRepository } from '../analytics.repository'
import {
  GA4_REPORT_CATALOG,
  type AnalyticsReportCatalogEntry,
} from '../reports/ga4-report-catalog'
import {
  buildGa4QueryHash,
  normalizeStoredGa4ComparableRows,
  type Ga4ComparableMetricRow,
} from '../reports/ga4-report-quality'
import type {
  AnalyticsDataQualityCheck,
  AnalyticsDataQualitySummary,
} from '../analytics.types'
import {
  normalizeReportRowKey,
  splitGa4BaselineBlocks,
} from '../reports/ga4-report-parser'

type ReportRowRecord = {
  rowType: string
  rowIndex: number
  rowKey: string
  dimensions: Prisma.InputJsonValue
  metrics: Prisma.InputJsonValue
  raw: Prisma.InputJsonValue
}

type ReportRowMap = Map<string, {
  rowKey: string
  dimensions: Record<string, unknown>
  metrics: Record<string, unknown>
}>

const parseNumeric = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/\s/gu, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const compareNumeric = (left: unknown, right: unknown) => {
  const leftNumeric = parseNumeric(left)
  const rightNumeric = parseNumeric(right)
  if (leftNumeric !== null || rightNumeric !== null) {
    return Math.abs((leftNumeric ?? 0) - (rightNumeric ?? 0)) < 0.0001
  }
  return String(left ?? '').trim() === String(right ?? '').trim()
}

const asJsonObject = (value: Record<string, unknown>) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const toGaDate = (value: Date) => startOfDayUtc(value).toISOString().slice(0, 10)

const DEFAULT_GA4_PAGE_SIZE = 5000

const addDaysUtc = (value: Date, days: number) => {
  const clone = new Date(value)
  clone.setUTCDate(clone.getUTCDate() + days)
  return clone
}

const normalizeInputDate = (value?: string | null) => {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : startOfDayUtc(parsed)
}

const toComparableKey = (row: Ga4ComparableMetricRow) =>
  [
    startOfDayUtc(row.date).toISOString().slice(0, 10),
    row.metricName,
    row.dimensionHash,
  ].join('|')

const getQualityStatus = (diffPercent: number, missingBaseline: boolean) => {
  if (missingBaseline) {
    return 'missing_baseline' as const
  }

  const absDiff = Math.abs(diffPercent)
  if (absDiff < 2) {
    return 'ok' as const
  }
  if (absDiff <= 5) {
    return 'warning' as const
  }
  return 'error' as const
}

@Injectable()
export class AnalyticsReportingService {
  private readonly logger = new Logger(AnalyticsReportingService.name)

  constructor(private readonly repository: AnalyticsRepository) {}

  async seedCatalog() {
    for (const entry of GA4_REPORT_CATALOG) {
      await this.repository.upsertReportCatalog({
        key: entry.key,
        source: 'ga4',
        title: entry.title,
        description: entry.description,
        baselineHeader: entry.baselineHeader,
        baselineTitle: entry.baselineTitle ?? null,
        equivalenceStatus: entry.equivalenceStatus,
        rowKeyStrategy: entry.rowKeyStrategy,
        dimensionLabels: entry.dimensionLabels,
        metricLabels: entry.metricLabels,
        apiDefinition: entry.apiDefinition ? asJsonObject(entry.apiDefinition as Record<string, unknown>) : null,
        notes: entry.notes ?? null,
      })
    }

    return this.repository.listReportCatalog()
  }

  async listCatalog() {
    const existing = await this.repository.listReportCatalog()
    if (existing.length) {
      return existing
    }
    return this.seedCatalog()
  }

  async importBaselineFromPath(filePath: string) {
    const catalog = await this.seedCatalog()
    const content = await readFile(filePath, 'utf8')
    const blocks = splitGa4BaselineBlocks(content)
    const createdRuns: Array<{ reportKey: string; runId: string; rowCount: number }> = []

    for (const block of blocks) {
      const run = await this.repository.createReportRun({
        reportKey: block.definition.key,
        source: 'baseline_import',
        status: 'running',
        metadata: asJsonObject({
          sourcePath: filePath,
          baselineHeader: block.header,
          baselineTitle: block.title,
        }),
      })

      const rows = this.normalizeBaselineRows(block.definition, block.rows)
      await this.repository.createReportRows({
        reportRunId: run.id,
        reportKey: block.definition.key,
        source: 'baseline_csv',
        rows,
      })
      await this.repository.updateReportRun(run.id, {
        status: 'success',
        rowCount: rows.length,
        finishedAt: new Date(),
      })
      createdRuns.push({ reportKey: block.definition.key, runId: run.id, rowCount: rows.length })
    }

    return {
      catalog,
      importedReports: createdRuns,
    }
  }

  async reconcileAllReports() {
    const connection = await this.getLatestGa4Connection()
    if (!connection) {
      return { reconciliations: [] }
    }

    await this.runDataQualityCheck({ connectionId: connection.id })
    return {
      reconciliations: await this.repository.listReportReconciliations(500),
    }
  }

  async reconcileReport(reportKey: string) {
    const connection = await this.getLatestGa4Connection()
    if (!connection) {
      throw new Error('GA4 connection not found.')
    }

    const latestSyncRun = await this.repository.listLatestReportRunBySource(reportKey, 'ga4_sync')
    await this.runDataQualityCheck({
      connectionId: connection.id,
      reportKey,
      from: latestSyncRun?.fromDate ?? undefined,
      to: latestSyncRun?.toDate ?? undefined,
    })

    const reconciliations = await this.repository.listReportReconciliations(1, reportKey)
    return reconciliations[0] ?? null
  }

  async listRuns(limit = 50, reportKey?: string) {
    return this.repository.listReportRuns(limit, reportKey)
  }

  async listReconciliations(limit = 50, reportKey?: string) {
    return this.repository.listReportReconciliations(limit, reportKey)
  }

  private async getLatestGa4Connection() {
    const connections = await this.repository.listConnections()
    return connections.find((connection) => connection.source === 'ga4') ?? null
  }

  async getDataQualityChecks(
    limit = 100,
    reportKey?: string,
  ): Promise<{
    checks: AnalyticsDataQualityCheck[]
    summaries: AnalyticsDataQualitySummary[]
  }> {
    const checks = await this.repository.listDataQualityChecks(limit, reportKey)
    const summaryByReport = new Map<
      string,
      AnalyticsDataQualitySummary & {
        weightedDiff: number
        okCountRaw: number
      }
    >()

    for (const check of checks) {
      const current =
        summaryByReport.get(check.reportKey) ??
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
          okCountRaw: 0,
        } satisfies AnalyticsDataQualitySummary & {
          weightedDiff: number
          okCountRaw: number
        })

      current.totalChecks += 1
      current.weightedDiff += Math.abs(check.diffPercent)
      current.lastCheckedAt =
        current.lastCheckedAt && current.lastCheckedAt > check.createdAt
          ? current.lastCheckedAt
          : check.createdAt

      switch (check.status) {
        case 'ok':
          current.okCount += 1
          current.okCountRaw += 1
          break
        case 'warning':
          current.warningCount += 1
          break
        case 'missing_baseline':
          current.missingBaselineCount += 1
          break
        default:
          current.errorCount += 1
          break
      }

      summaryByReport.set(check.reportKey, current)
    }

    const summaries = Array.from(summaryByReport.values()).map((summary) => ({
      reportKey: summary.reportKey,
      totalChecks: summary.totalChecks,
      okCount: summary.okCount,
      warningCount: summary.warningCount,
      errorCount: summary.errorCount,
      missingBaselineCount: summary.missingBaselineCount,
      averageDiffPercent:
        summary.totalChecks > 0
          ? Number((summary.weightedDiff / summary.totalChecks).toFixed(4))
          : 0,
      coveragePercent:
        summary.totalChecks > 0
          ? Number(((summary.okCountRaw / summary.totalChecks) * 100).toFixed(2))
          : 0,
      lastCheckedAt: summary.lastCheckedAt,
    }))

    return { checks, summaries }
  }

  async runDataQualityCheck(params: {
    connectionId: string
    reportKey?: string
    from?: string
    to?: string
  }) {
    const connection = await this.repository.findConnectionById(params.connectionId)
    if (!connection || connection.source !== 'ga4') {
      throw new Error('GA4 connection not found.')
    }
    if (!connection.externalPropertyId) {
      throw new Error('GA4 property must be selected before running data quality.')
    }

    const reportEntries = params.reportKey
      ? GA4_REPORT_CATALOG.filter((entry) => entry.key === params.reportKey)
      : GA4_REPORT_CATALOG
    if (!reportEntries.length) {
      throw new Error(`Unknown GA4 report key: ${params.reportKey ?? ''}`)
    }

    const results: Array<{
      reportKey: string
      queryHash: string
      totalChecks: number
      okCount: number
      warningCount: number
      errorCount: number
      missingBaselineCount: number
      coveragePercent: number
      averageDiffPercent: number
      lastCheckedAt: string | null
    }> = []

    for (const report of reportEntries) {
      if (!report.apiDefinition || report.apiDefinition.kind !== 'runReport') {
        continue
      }

      const reportRuns = await this.listRuns(100, report.key)
      const latestSyncRun = reportRuns.find((run) => run.source === 'ga4_sync') ?? null
      const fromDate =
        normalizeInputDate(params.from) ??
        (latestSyncRun?.fromDate ? startOfDayUtc(new Date(latestSyncRun.fromDate)) : addDaysUtc(new Date(), -3))
      const toDate =
        normalizeInputDate(params.to) ??
        (latestSyncRun?.toDate ? startOfDayUtc(new Date(latestSyncRun.toDate)) : addDaysUtc(new Date(), -1))

      const dateRanges = report.apiDefinition.dateRanges?.length
        ? report.apiDefinition.dateRanges.map((range) => ({
            label: range.label,
            startDate: range.startDate === 'today' ? toGaDate(toDate) : range.startDate,
            endDate: range.endDate === 'today' ? toGaDate(toDate) : range.endDate,
          }))
        : [{ label: 'primary', startDate: toGaDate(fromDate), endDate: toGaDate(toDate) }]

      const queryHash = buildGa4QueryHash({
        connectionId: params.connectionId,
        propertyId: connection.externalPropertyId,
        reportKey: report.key,
        fromDate,
        toDate,
        dimensions: report.apiDefinition.dimensions,
        metrics: report.apiDefinition.metrics,
        dateRanges,
        limit: report.apiDefinition.limit ?? DEFAULT_GA4_PAGE_SIZE,
      })

      const baselineSnapshots = await this.repository.findLatestBaselineQuery(report.key, queryHash)
      const syncRun =
        reportRuns.find(
          (run) =>
            run.source === 'ga4_sync' &&
            run.fromDate &&
            run.toDate &&
            startOfDayUtc(new Date(run.fromDate)).getTime() === fromDate.getTime() &&
            startOfDayUtc(new Date(run.toDate)).getTime() === toDate.getTime(),
        ) ?? latestSyncRun
      const syncRows = syncRun ? await this.repository.listReportRows(syncRun.id) : []

      const baselineComparableRows = baselineSnapshots.map((snapshot) => ({
        id: snapshot.id,
        date: new Date(snapshot.date),
        metricName: snapshot.metricName,
        dimensionHash: snapshot.dimensionHash,
        dimensionValues: snapshot.dimensionValues ?? {},
        value: snapshot.value,
        raw: snapshot.raw ?? {},
      }))
      const syncComparableRows = normalizeStoredGa4ComparableRows(
        report,
        syncRows.map((row) => ({
          dimensions: row.dimensions,
          metrics: row.metrics,
        })),
        fromDate,
      )

      const baselineMap = new Map(
        baselineComparableRows.map((row) => [toComparableKey(row), row] as const),
      )
      const syncMap = new Map(syncComparableRows.map((row) => [toComparableKey(row), row] as const))
      const unionKeys = new Set([...baselineMap.keys(), ...syncMap.keys()])

      let okCount = 0
      let warningCount = 0
      let errorCount = 0
      let missingBaselineCount = 0
      let diffAccumulator = 0

      for (const key of unionKeys) {
        const baselineRow = baselineMap.get(key)
        const syncRow = syncMap.get(key)

        if (!baselineRow && !syncRow) {
          continue
        }

        const representative = baselineRow ?? syncRow!
        const baselineValue = baselineRow?.value ?? 0
        const syncedValue = syncRow?.value ?? 0
        const diff = syncedValue - baselineValue
        const diffPercent =
          baselineValue === 0
            ? syncedValue === 0
              ? 0
              : 100
            : Number((((syncedValue - baselineValue) / baselineValue) * 100).toFixed(4))
        const status = getQualityStatus(diffPercent, !baselineRow)

        switch (status) {
          case 'ok':
            okCount += 1
            break
          case 'warning':
            warningCount += 1
            break
          case 'missing_baseline':
            missingBaselineCount += 1
            break
          default:
            errorCount += 1
            break
        }

        if (baselineRow) {
          diffAccumulator += Math.abs(diffPercent)
        }

        await this.repository.upsertDataQualityCheck({
          connectionId: params.connectionId,
          reportKey: report.key,
          date: startOfDayUtc(representative.date),
          metricName: representative.metricName,
          dimensionHash: representative.dimensionHash,
          baselineValue,
          syncedValue,
          diff,
          diffPercent,
          status,
          baselineSnapshotId: baselineRow?.id ?? null,
          syncRunId: syncRun?.id ?? null,
          queryHash,
        })
      }

      const totalChecks = unionKeys.size
      const coveragePercent =
        baselineComparableRows.length > 0
          ? Number((((okCount + warningCount + errorCount) / baselineComparableRows.length) * 100).toFixed(2))
          : 0
      const averageDiffPercent =
        baselineComparableRows.length > 0
          ? Number((diffAccumulator / baselineComparableRows.length).toFixed(4))
          : 0
      const lastCheckedAt = new Date().toISOString()

      results.push({
        reportKey: report.key,
        queryHash,
        totalChecks,
        okCount,
        warningCount,
        errorCount,
        missingBaselineCount,
        coveragePercent,
        averageDiffPercent,
        lastCheckedAt,
      })

      const reconciliationStatus =
        baselineComparableRows.length === 0
          ? 'missing'
          : errorCount > 0 || missingBaselineCount > 0
            ? 'gap'
            : warningCount > 0
              ? 'partial'
              : 'aligned'

      await this.repository.createOrUpdateReportReconciliation({
        reportKey: report.key,
        baselineRunId: null,
        syncRunId: syncRun?.id ?? null,
        status: reconciliationStatus,
        baselineRowCount: baselineComparableRows.length,
        syncRowCount: syncComparableRows.length,
        matchedRowCount: okCount,
        baselineOnlyRowCount: missingBaselineCount,
        syncOnlyRowCount: errorCount,
        deltaPercent:
          baselineComparableRows.length > 0
            ? Number(
                Math.min(
                  100,
                  ((missingBaselineCount + errorCount) / baselineComparableRows.length) * 100,
                ).toFixed(4),
              )
            : 0,
        summary: `quality=${reconciliationStatus} ok=${okCount} warning=${warningCount} error=${errorCount} missing=${missingBaselineCount}`,
        evidence: asJsonObject({
          reportKey: report.key,
          queryHash,
          connectionId: params.connectionId,
          coveragePercent,
          averageDiffPercent,
          okCount,
          warningCount,
          errorCount,
          missingBaselineCount,
          totalChecks,
        }),
      })
    }

    return {
      connectionId: params.connectionId,
      reports: results,
    }
  }

  async getInsightsInput(params: {
    connectionId: string
    reportKey?: string
    from?: string
    to?: string
  }) {
    const reportData = await this.runDataQualityCheck(params)
    return {
      connectionId: params.connectionId,
      reportData,
      quality: await this.getDataQualityChecks(100, params.reportKey),
      reconciliations: await this.repository.listReportReconciliations(100, params.reportKey),
    }
  }

  async ingestCanonicalReportRows(params: {
    reportKey: string
    source: 'ga4_api'
    rows: Array<Record<string, unknown>>
    fromDate?: Date | null
    toDate?: Date | null
    metadata?: Record<string, unknown> | null
  }) {
    const entry = GA4_REPORT_CATALOG.find((report) => report.key === params.reportKey)
    if (!entry) {
      throw new Error(`Unknown report key: ${params.reportKey}`)
    }

    const run = await this.repository.createReportRun({
      reportKey: entry.key,
      source: 'ga4_sync',
      status: 'running',
      fromDate: params.fromDate ?? null,
      toDate: params.toDate ?? null,
      metadata: asJsonObject({
        ...(params.metadata ?? {}),
        source: params.source,
      }),
    })

    const normalizedRows = params.rows.map((row, index) =>
      this.normalizeApiRow(entry, row, index, params.fromDate ?? null),
    )

    await this.repository.createReportRows({
      reportRunId: run.id,
      reportKey: entry.key,
      source: 'ga4_api',
      rows: normalizedRows,
    })

    await this.repository.updateReportRun(run.id, {
      status: 'success',
      rowCount: normalizedRows.length,
      finishedAt: new Date(),
    })

    return run.id
  }

  private normalizeBaselineRows(
    entry: AnalyticsReportCatalogEntry,
    rows: string[][],
  ): ReportRowRecord[] {
    return rows.map((row, rowIndex) => {
      const dimensionCount = entry.dimensionLabels.length
      const metricsStartIndex = dimensionCount
      const dimensions = Object.fromEntries(
        entry.dimensionLabels.map((label, index) => [label, row[index] ?? null]),
      )
      const metrics = Object.fromEntries(
        entry.metricLabels.map((label, index) => [label, row[metricsStartIndex + index] ?? null]),
      )
      return {
        rowType: 'baseline',
        rowIndex,
        rowKey: normalizeReportRowKey(
          entry,
          Object.fromEntries(
            entry.dimensionLabels.map((label, index) => [label, row[index] ?? '']),
          ),
          rowIndex,
        ),
        dimensions: asJsonObject(dimensions),
        metrics: asJsonObject(metrics),
        raw: asJsonObject({ columns: row }),
      }
    })
  }

  private normalizeApiRow(
    entry: AnalyticsReportCatalogEntry,
    row: Record<string, unknown>,
    rowIndex: number,
    fromDate: Date | null,
  ): ReportRowRecord {
    const dimensions = Object.fromEntries(
      entry.dimensionLabels.map((label, index) => [label, row[`dimension_${index}`] ?? null]),
    )
    const metrics = Object.fromEntries(
      entry.metricLabels.map((label, index) => [label, row[`metric_${index}`] ?? null]),
    )
    const rowKey =
      entry.apiDefinition?.dimensions?.[0] === 'date' && fromDate
        ? this.toDateOffsetRowKey(String(row.dimension_0 ?? ''), fromDate, rowIndex)
        : normalizeReportRowKey(
            entry,
            Object.fromEntries(
              Object.entries(dimensions).map(([key, value]) => [key, String(value ?? '')]),
            ),
            rowIndex,
          )
    return {
      rowType: 'ga4_api',
      rowIndex,
      rowKey,
      dimensions: asJsonObject(dimensions),
      metrics: asJsonObject(metrics),
      raw: asJsonObject(row),
    }
  }

  private toDateOffsetRowKey(value: string, fromDate: Date, fallbackIndex: number) {
    const normalizedDate = value.trim()
    if (!/^\d{8}$/.test(normalizedDate)) {
      return String(fallbackIndex).padStart(6, '0')
    }

    const year = Number(normalizedDate.slice(0, 4))
    const month = Number(normalizedDate.slice(4, 6)) - 1
    const day = Number(normalizedDate.slice(6, 8))
    const current = Date.UTC(year, month, day)
    const start = Date.UTC(
      fromDate.getUTCFullYear(),
      fromDate.getUTCMonth(),
      fromDate.getUTCDate(),
    )
    const offsetDays = Math.max(0, Math.floor((current - start) / 86_400_000))
    return String(offsetDays).padStart(6, '0')
  }

  private toRowMap(rows: Awaited<ReturnType<AnalyticsRepository['listReportRows']>>) {
    const map: ReportRowMap = new Map()
    for (const row of rows) {
      map.set(row.rowKey, {
        rowKey: row.rowKey,
        dimensions: row.dimensions,
        metrics: row.metrics,
      })
    }
    return map
  }

  private compareDimensions(left: Record<string, unknown>, right: Record<string, unknown>) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    for (const key of keys) {
      if (!compareNumeric(left[key], right[key])) {
        return false
      }
    }
    return true
  }

  private compareMetrics(left: Record<string, unknown>, right: Record<string, unknown>) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)])
    for (const key of keys) {
      if (!compareNumeric(left[key], right[key])) {
        return false
      }
    }
    return true
  }

  private rowDeltaPercent(left: Record<string, unknown>, right: Record<string, unknown>) {
    const keys = Object.keys(left)
    if (!keys.length) {
      return 0
    }
    const deltas = keys.map((key) => {
      const leftValue = parseNumeric(left[key]) ?? 0
      const rightValue = parseNumeric(right[key]) ?? 0
      return leftValue === 0 ? 0 : Math.abs((leftValue - rightValue) / leftValue) * 100
    })
    return deltas.reduce((sum, value) => sum + value, 0) / deltas.length
  }
}

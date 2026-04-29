import { Injectable, BadRequestException } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { AnalyticsRepository } from './analytics.repository'
import { Ga4ConnectorService } from './ga4-connector.service'
import { GA4_REPORT_CATALOG } from './reports/ga4-report-catalog'
import {
  buildGa4QueryHash,
  normalizeGa4ComparableRows,
} from './reports/ga4-report-quality'

const BASELINE_OVERLAP_DAYS = 3

const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

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
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const asJsonObject = (value: Record<string, unknown>) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

@Injectable()
export class AnalyticsBaselineService {
  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly ga4Connector: Ga4ConnectorService,
  ) {}

  async runBaselineSync(connectionId: string, input?: { from?: string; to?: string; reportKey?: string }) {
    const fromDate =
      startOfDayUtc(normalizeInputDate(input?.from) ?? addDaysUtc(new Date(), -BASELINE_OVERLAP_DAYS))
    const toDate = startOfDayUtc(normalizeInputDate(input?.to) ?? addDaysUtc(new Date(), -1))
    const reportEntries = input?.reportKey
      ? GA4_REPORT_CATALOG.filter((entry) => entry.key === input.reportKey)
      : GA4_REPORT_CATALOG

    if (!reportEntries.length) {
      throw new BadRequestException(`Unknown GA4 report key: ${input?.reportKey ?? ''}`)
    }

    const persisted: Array<{
      reportKey: string
      queryHash: string
      rows: number
    }> = []

    for (const report of reportEntries) {
      if (!report.apiDefinition || report.apiDefinition.kind !== 'runReport') {
        continue
      }

      const baseline = await this.ga4Connector.getReportBaseline({
        connectionId,
        reportKey: report.key,
        fromDate,
        toDate,
      })
      const rows = normalizeGa4ComparableRows(report, baseline.rows, fromDate)

      for (const row of rows) {
        await this.repository.upsertBaselineSnapshot({
          connectionId,
          source: 'ga4',
          reportKey: report.key,
          date: startOfDayUtc(row.date),
          metricName: row.metricName,
          dimensionHash: row.dimensionHash,
          dimensionValues: asJsonObject(row.dimensionValues),
          value: row.value,
          queryHash: baseline.queryHash,
          raw: asJsonObject(row.raw),
        })
      }

      persisted.push({
        reportKey: report.key,
        queryHash: baseline.queryHash,
        rows: rows.length,
      })
    }

    return {
      connectionId,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      reports: persisted,
    }
  }

  async listSnapshots(limit = 50, reportKey?: string) {
    return {
      snapshots: await this.repository.listBaselineSnapshots(limit, reportKey),
    }
  }
}

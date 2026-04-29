import { BadRequestException, Injectable } from '@nestjs/common'
import { Readable } from 'node:stream'

import { AnalyticsRepository } from './analytics.repository'
import { buildAnalyticsCanonicalDimensionPayload, buildAnalyticsDimensionHash } from './dimensions/analytics-dimension-hash'
import type {
  AnalyticsAdsDailyMetric,
  AnalyticsExportRun,
  AnalyticsExportRunsResponse,
  AnalyticsReportingDailyMetric,
  AnalyticsSearchConsoleDailyMetric,
} from './analytics.types'

type CanonicalExportSource = 'ga4' | 'ads' | 'search_console' | 'all'
type CanonicalGranularity = 'daily'
type ReportExportName = 'ga4_overview' | 'ads_campaigns' | 'seo_pages'

type ExportDescriptor = {
  stream: Readable
  filename: string
  metadata: Record<string, unknown>
}

const DEFAULT_BATCH_SIZE = 1000
const MAX_EXPORT_ERROR_MESSAGE_LENGTH = 2000

const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const formatDate = (value: Date) => value.toISOString().slice(0, 10)

const parseDate = (value: string | undefined | null) => {
  if (!value) {
    return null
  }
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : startOfDayUtc(parsed)
}

const csvEscape = (value: unknown) => {
  if (value === null || value === undefined) {
    return ''
  }
  const text = value instanceof Date ? value.toISOString() : String(value)
  if (/[",\n\r]/u.test(text)) {
    return `"${text.replace(/"/gu, '""')}"`
  }
  return text
}

const csvLine = (columns: Array<unknown>) => columns.map((column) => csvEscape(column)).join(',')

const truncateExportErrorMessage = (value: string) => {
  if (value.length <= MAX_EXPORT_ERROR_MESSAGE_LENGTH) {
    return value
  }
  return `${value.slice(0, MAX_EXPORT_ERROR_MESSAGE_LENGTH - 1)}…`
}

const buildCanonicalDimensions = (input: {
  date: Date
  source: CanonicalExportSource
  channel?: string | null
  campaign?: string | null
  device?: string | null
  country?: string | null
  landing_page?: string | null
}) =>
  buildAnalyticsCanonicalDimensionPayload({
    date: formatDate(input.date),
    source: input.source,
    channel: input.channel ?? null,
    campaign: input.campaign ?? null,
    device: input.device ?? null,
    country: input.country ?? null,
    landing_page: input.landing_page ?? null,
  })

@Injectable()
export class AnalyticsExportService {
  constructor(private readonly repository: AnalyticsRepository) {}

  async exportCanonical(params: {
    from: string
    to: string
    source?: CanonicalExportSource
    granularity?: CanonicalGranularity
  }): Promise<ExportDescriptor> {
    const source = params.source ?? 'all'
    if (!['ga4', 'ads', 'search_console', 'all'].includes(source)) {
      throw new BadRequestException('source must be ga4, ads, search_console or all')
    }
    if ((params.granularity ?? 'daily') !== 'daily') {
      throw new BadRequestException('granularity must be daily')
    }

    const from = parseDate(params.from)
    const to = parseDate(params.to)
    if (!from || !to) {
      throw new BadRequestException('from and to are required')
    }

    const exportRun = await this.repository.createExportRun({
      exportType: 'canonical',
      source: source === 'all' ? 'unified' : source,
      dateFrom: from,
      dateTo: to,
      filters: {
        from: formatDate(from),
        to: formatDate(to),
        source,
        granularity: 'daily',
      },
      fileFormat: 'csv',
      status: 'running',
    })

    const startedAt = Date.now()
    let rowCount = 0
    let fileSize = 0
    let finalized = false
    const finalize = async (status: 'success' | 'error', errorMessage?: string | null) => {
      if (finalized) {
        return
      }
      finalized = true
      await this.repository.updateExportRun(exportRun.id, {
        status,
        rowCount,
        durationMs: Date.now() - startedAt,
        fileSize,
        errorMessage: errorMessage ? truncateExportErrorMessage(errorMessage) : null,
      })
    }

    const stream = Readable.from(
      this.buildCanonicalExportStream({
        from,
        to,
        source,
        finalize,
        onRow: () => {
          rowCount += 1
        },
        onChunk: (chunk) => {
          fileSize += Buffer.byteLength(chunk, 'utf8')
        },
      }),
    )

    return {
      stream,
      filename: `analytics-canonical-${formatDate(from)}-${formatDate(to)}.csv`,
      metadata: {
        export_type: 'canonical',
        generated_at: new Date().toISOString(),
        time_range: {
          from: formatDate(from),
          to: formatDate(to),
        },
        source,
        granularity: 'daily',
        data_origin: source === 'all' ? 'mixed' : 'api',
        export_run_id: exportRun.id,
      },
    }
  }

  async exportReport(params: {
    report: ReportExportName
    from: string
    to: string
  }): Promise<ExportDescriptor> {
    const from = parseDate(params.from)
    const to = parseDate(params.to)
    if (!from || !to) {
      throw new BadRequestException('from and to are required')
    }

    const exportRun = await this.repository.createExportRun({
      exportType: 'report',
      source: 'unified',
      dateFrom: from,
      dateTo: to,
      filters: {
        report: params.report,
        from: formatDate(from),
        to: formatDate(to),
      },
      fileFormat: 'csv',
      status: 'running',
    })

    const startedAt = Date.now()
    let rowCount = 0
    let fileSize = 0
    let finalized = false
    const finalize = async (status: 'success' | 'error', errorMessage?: string | null) => {
      if (finalized) {
        return
      }
      finalized = true
      await this.repository.updateExportRun(exportRun.id, {
        status,
        rowCount,
        durationMs: Date.now() - startedAt,
        fileSize,
        errorMessage: errorMessage ? truncateExportErrorMessage(errorMessage) : null,
      })
    }

    const stream = Readable.from(
      this.buildReportExportStream({
        report: params.report,
        from,
        to,
        finalize,
        onRow: () => {
          rowCount += 1
        },
        onChunk: (chunk) => {
          fileSize += Buffer.byteLength(chunk, 'utf8')
        },
      }),
    )

    return {
      stream,
      filename: `analytics-report-${params.report}-${formatDate(from)}-${formatDate(to)}.csv`,
      metadata: {
        report_type: params.report,
        generated_at: new Date().toISOString(),
        time_range: {
          from: formatDate(from),
          to: formatDate(to),
        },
        data_origin: 'api',
        notes: 'Derived from internal normalized tables',
        export_run_id: exportRun.id,
      },
    }
  }

  async listRuns(input: {
    limit: number
    offset: number
    exportType?: 'canonical' | 'report' | null
    source?: 'ga4' | 'ads' | 'search_console' | 'unified' | null
    status?: 'running' | 'success' | 'error' | null
  }): Promise<AnalyticsExportRunsResponse> {
    return this.repository.listExportRuns({
      limit: Number.isFinite(input.limit) && input.limit > 0 ? Math.min(input.limit, 100) : 20,
      offset: Number.isFinite(input.offset) && input.offset >= 0 ? input.offset : 0,
      exportType: input.exportType ?? null,
      source: input.source ?? null,
      status: input.status ?? null,
    })
  }

  async getRun(id: string): Promise<AnalyticsExportRun | null> {
    return this.repository.getExportRunById(id)
  }

  private async *buildCanonicalExportStream(input: {
    from: Date
    to: Date
    source: CanonicalExportSource
    finalize: (status: 'success' | 'error', errorMessage?: string | null) => Promise<void>
    onRow: () => void
    onChunk: (chunk: string) => void
  }) {
    try {
      const header = `${csvLine([
        'date',
        'source',
        'metric',
        'metric_value',
        'channel',
        'campaign',
        'device',
        'country',
        'landing_page',
        'dimension_hash',
        'data_origin',
      ])}\n`
      input.onChunk(header)
      yield header

      if (input.source === 'ga4' || input.source === 'all') {
        for await (const line of this.streamCanonicalRowsFromReportingDaily(
          input.from,
          input.to,
          input.source === 'all' ? 'mixed' : 'api',
        )) {
          input.onRow()
          input.onChunk(line)
          yield line
        }
      }

      if (input.source === 'ads' || input.source === 'all') {
        for await (const line of this.streamCanonicalRowsFromAdsDailyMetrics(
          input.from,
          input.to,
          input.source === 'all' ? 'mixed' : 'api',
        )) {
          input.onRow()
          input.onChunk(line)
          yield line
        }
      }

      if (input.source === 'search_console' || input.source === 'all') {
        for await (const line of this.streamCanonicalRowsFromSearchConsoleDailyMetrics(
          input.from,
          input.to,
          input.source === 'all' ? 'mixed' : 'api',
        )) {
          input.onRow()
          input.onChunk(line)
          yield line
        }
      }

      await input.finalize('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await input.finalize('error', message)
      throw error
    } finally {
      await input.finalize('error', 'export stream closed before completion').catch(() => undefined)
    }
  }

  private async *buildReportExportStream(input: {
    report: ReportExportName
    from: Date
    to: Date
    finalize: (status: 'success' | 'error', errorMessage?: string | null) => Promise<void>
    onRow: () => void
    onChunk: (chunk: string) => void
  }) {
    try {
      const headerByReport: Record<ReportExportName, string[]> = {
        ga4_overview: ['date', 'source', 'medium', 'sessions', 'users', 'revenue'],
        ads_campaigns: [
          'date',
          'source',
          'campaign',
          'clicks',
          'impressions',
          'cost',
          'conversions',
          'conversion_value',
        ],
        seo_pages: ['date', 'source', 'landing_page', 'query', 'clicks', 'impressions', 'ctr', 'position'],
      }

      const header = `${csvLine(headerByReport[input.report])}\n`
      input.onChunk(header)
      yield header

      if (input.report === 'ga4_overview') {
        for await (const line of this.streamReportRowsFromReportingDaily(input.from, input.to)) {
          input.onRow()
          input.onChunk(line)
          yield line
        }
      } else if (input.report === 'ads_campaigns') {
        for await (const line of this.streamReportRowsFromAdsDailyMetrics(input.from, input.to)) {
          input.onRow()
          input.onChunk(line)
          yield line
        }
      } else {
        for await (const line of this.streamReportRowsFromSearchConsoleDailyMetrics(input.from, input.to)) {
          input.onRow()
          input.onChunk(line)
          yield line
        }
      }

      await input.finalize('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await input.finalize('error', message)
      throw error
    } finally {
      await input.finalize('error', 'export stream closed before completion').catch(() => undefined)
    }
  }

  private async *streamCanonicalRowsFromReportingDaily(from: Date, to: Date, dataOrigin: 'api' | 'mixed') {
    let cursorId: bigint | null = null
    while (true) {
      const batch = await this.repository.listReportingDailyBatch(from, to, DEFAULT_BATCH_SIZE, cursorId)
      if (!batch.length) {
        break
      }
      cursorId = BigInt(batch[batch.length - 1].id)
      for (const row of batch) {
        const date = startOfDayUtc(new Date(row.date))
        const dimensions = buildCanonicalDimensions({
          date,
          source: 'ga4',
          channel: row.channel,
          campaign: row.campaign,
          device: row.device,
          country: row.country,
          landing_page: row.landingPage,
        })
        const dimensionHash = buildAnalyticsDimensionHash(dimensions)
        const metrics: Array<[string, number]> = [
          ['sessions', row.sessions],
          ['users', row.users],
          ['revenue', row.revenue],
          ['orders', row.orders],
          ['cost', row.cost],
          ['impressions', row.impressions],
          ['clicks', row.clicks],
          ['views', row.views],
          ['add_to_cart', row.addToCart],
          ['event_count', row.eventCount],
          ['key_events', row.keyEvents],
          ['ga4_purchase_proxy', row.ga4PurchaseProxy],
          ['purchase', row.purchase],
        ]
        for (const [metric, metricValue] of metrics) {
          yield `${csvLine([
            formatDate(date),
            'ga4',
            metric,
            metricValue,
            dimensions.channel,
            dimensions.campaign,
            dimensions.device,
            dimensions.country,
            dimensions.landing_page,
            dimensionHash,
            dataOrigin,
          ])}\n`
        }
      }
    }
  }

  private async *streamCanonicalRowsFromAdsDailyMetrics(from: Date, to: Date, dataOrigin: 'api' | 'mixed') {
    let cursorId: bigint | null = null
    while (true) {
      const batch = await this.repository.listAdsDailyMetricsBatch(from, to, DEFAULT_BATCH_SIZE, cursorId)
      if (!batch.length) {
        break
      }
      cursorId = BigInt(batch[batch.length - 1].id)
      for (const row of batch) {
        const date = startOfDayUtc(new Date(row.date))
        const dimensions = buildCanonicalDimensions({
          date,
          source: 'ads',
          campaign: row.campaign,
        })
        const dimensionHash = buildAnalyticsDimensionHash(dimensions)
        const metrics: Array<[string, number]> = [
          ['clicks', row.clicks],
          ['impressions', row.impressions],
          ['cost', row.cost],
          ['conversions', row.conversions],
          ['conversion_value', row.conversionValue],
        ]
        for (const [metric, metricValue] of metrics) {
          yield `${csvLine([
            formatDate(date),
            'ads',
            metric,
            metricValue,
            dimensions.channel,
            dimensions.campaign,
            dimensions.device,
            dimensions.country,
            dimensions.landing_page,
            dimensionHash,
            dataOrigin,
          ])}\n`
        }
      }
    }
  }

  private async *streamCanonicalRowsFromSearchConsoleDailyMetrics(
    from: Date,
    to: Date,
    dataOrigin: 'api' | 'mixed',
  ) {
    let cursorId: bigint | null = null
    while (true) {
      const batch = await this.repository.listSearchConsoleDailyMetricsBatch(
        from,
        to,
        DEFAULT_BATCH_SIZE,
        cursorId,
      )
      if (!batch.length) {
        break
      }
      cursorId = BigInt(batch[batch.length - 1].id)
      for (const row of batch) {
        const date = startOfDayUtc(new Date(row.date))
        const dimensions = buildCanonicalDimensions({
          date,
          source: 'search_console',
          landing_page: row.page,
        })
        const dimensionHash = buildAnalyticsDimensionHash(dimensions)
        const metrics: Array<[string, number]> = [
          ['clicks', row.clicks],
          ['impressions', row.impressions],
          ['ctr', row.ctr],
          ['position', row.position],
        ]
        for (const [metric, metricValue] of metrics) {
          yield `${csvLine([
            formatDate(date),
            'search_console',
            metric,
            metricValue,
            dimensions.channel,
            dimensions.campaign,
            dimensions.device,
            dimensions.country,
            dimensions.landing_page,
            dimensionHash,
            dataOrigin,
          ])}\n`
        }
      }
    }
  }

  private async *streamReportRowsFromReportingDaily(from: Date, to: Date) {
    let cursorId: bigint | null = null
    while (true) {
      const batch = await this.repository.listReportingDailyBatch(from, to, DEFAULT_BATCH_SIZE, cursorId)
      if (!batch.length) {
        break
      }
      cursorId = BigInt(batch[batch.length - 1].id)
      for (const row of batch) {
        yield `${csvLine([
          formatDate(startOfDayUtc(new Date(row.date))),
          'ga4',
          row.medium ?? '',
          row.sessions,
          row.users,
          row.revenue,
        ])}\n`
      }
    }
  }

  private async *streamReportRowsFromAdsDailyMetrics(from: Date, to: Date) {
    let cursorId: bigint | null = null
    while (true) {
      const batch = await this.repository.listAdsDailyMetricsBatch(from, to, DEFAULT_BATCH_SIZE, cursorId)
      if (!batch.length) {
        break
      }
      cursorId = BigInt(batch[batch.length - 1].id)
      for (const row of batch) {
        yield `${csvLine([
          formatDate(startOfDayUtc(new Date(row.date))),
          'ads',
          row.campaign,
          row.clicks,
          row.impressions,
          row.cost,
          row.conversions,
          row.conversionValue,
        ])}\n`
      }
    }
  }

  private async *streamReportRowsFromSearchConsoleDailyMetrics(from: Date, to: Date) {
    let cursorId: bigint | null = null
    while (true) {
      const batch = await this.repository.listSearchConsoleDailyMetricsBatch(
        from,
        to,
        DEFAULT_BATCH_SIZE,
        cursorId,
      )
      if (!batch.length) {
        break
      }
      cursorId = BigInt(batch[batch.length - 1].id)
      for (const row of batch) {
        yield `${csvLine([
          formatDate(startOfDayUtc(new Date(row.date))),
          'search_console',
          row.page ?? '',
          row.query,
          row.clicks,
          row.impressions,
          row.ctr,
          row.position,
        ])}\n`
      }
    }
  }
}

import { Prisma } from '@prisma/client'

type TrustStatus = 'ok' | 'warning' | 'fail'

type TrustCheck = {
  check: string
  status: TrustStatus
  value: number | null
  expected: string
  impact: string
  details: Record<string, unknown>
}

type TrustRun = {
  status: TrustStatus
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
  checks: TrustCheck[]
}

type TrustHistoryItem = {
  status: TrustStatus
  summary: string
  createdAt: string
  environment: string
}

type TrustPersistenceRow = {
  id: string
  checkName: string
  status: string
  metricValue: Prisma.Decimal | number | null
  expectedRange: string
  detailsJson: unknown
  createdAt: Date
  environment: string
}

export type AnalyticsDataTrustResult = TrustRun

export type AnalyticsDataTrustHistoryItem = TrustHistoryItem

export type AnalyticsDataTrustOptions = {
  environment?: string
  lookbackDays?: number
  silenceWindowHours?: number
  minConversionCount?: number
  zeroConversionCriticalTraffic?: number
  attributionMinimumPercent?: number
  ga4TolerancePercent?: number
  trafficDropThresholdPercent?: number
  persist?: boolean
}

export type AnalyticsDataTrustPrismaLike = {
  eventFact?: any
  analyticsReportingDaily?: any
  analyticsGa4DailyMetric?: any
  analyticsDataTrustCheck?: any
}

const DEFAULT_LOOKBACK_DAYS = 7
const DEFAULT_SILENCE_WINDOW_HOURS = 24
const DEFAULT_MIN_CONVERSION_COUNT = 1
const DEFAULT_ZERO_CONVERSION_CRITICAL_TRAFFIC = 100
const DEFAULT_ATTRIBUTION_MINIMUM_PERCENT = 70
const DEFAULT_GA4_TOLERANCE_PERCENT = 20
const DEFAULT_TRAFFIC_DROP_THRESHOLD_PERCENT = 40

const normalizeEnvironment = (value: string | null | undefined) => {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'production' || normalized === 'prod' || normalized === 'live') {
    return 'prod'
  }
  if (normalized === 'staging' || normalized === 'stage') {
    return 'staging'
  }
  if (normalized === 'dev' || normalized === 'development' || normalized === 'local') {
    return 'dev'
  }
  return normalized || 'unknown'
}

const readEnvNumber = (keys: string[], fallback: number) => {
  for (const key of keys) {
    const value = process.env[key]
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }
  return fallback
}

const startOfUtcDay = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const addUtcDays = (value: Date, days: number) =>
  new Date(value.getTime() + days * 24 * 60 * 60 * 1000)

const asDecimalNumber = (value: Prisma.Decimal | number | null | undefined) => {
  if (value === null || value === undefined) {
    return 0
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }
  const parsed = Number(value.toString())
  return Number.isFinite(parsed) ? parsed : 0
}

const summarizeChecks = (checks: TrustCheck[]): TrustStatus => {
  if (checks.some((check) => check.status === 'fail')) {
    return 'fail'
  }
  if (checks.some((check) => check.status === 'warning')) {
    return 'warning'
  }
  return 'ok'
}

const summarizeFailureList = (checks: TrustCheck[]) => {
  const failing = checks.filter((check) => check.status !== 'ok')
  if (!failing.length) {
    return 'all trust checks healthy'
  }
  return failing.map((check) => `${check.check}:${check.status}`).join(', ')
}

const toTrend = (currentValue: number, previousValue: number) => {
  const delta = currentValue - previousValue
  const deltaPct = previousValue === 0 ? null : Number(((delta / previousValue) * 100).toFixed(2))
  return {
    direction: currentValue > previousValue ? ('up' as const) : currentValue < previousValue ? ('down' as const) : ('flat' as const),
    currentValue,
    previousValue,
    deltaPct,
  }
}

const serializeResult = (result: AnalyticsDataTrustResult) => ({
  ...result,
  checks: result.checks,
})

const buildCheck = (
  check: string,
  status: TrustStatus,
  value: number | null,
  expected: string,
  impact: string,
  details: Record<string, unknown>,
): TrustCheck => ({
  check,
  status,
  value,
  expected,
  impact,
  details,
})

const normalizeDecimalInput = (value: number | null) => {
  if (value === null) {
    return null
  }
  return Number.isFinite(value) ? value : null
}

const groupRuns = (rows: TrustPersistenceRow[]) => {
  const runs = new Map<
    string,
    {
      createdAt: string
      environment: string
      status: TrustStatus
      summary: string
      details: Record<string, unknown>
      checks: TrustCheck[]
    }
  >()

  for (const row of rows) {
    const key = row.createdAt.toISOString()
    if (runs.has(key)) {
      continue
    }

    const details = row.detailsJson && typeof row.detailsJson === 'object' ? (row.detailsJson as Record<string, unknown>) : {}
    const checks = Array.isArray(details.checks)
      ? (details.checks as TrustCheck[])
      : []

    runs.set(key, {
      createdAt: key,
      environment: row.environment,
      status: (details.status as TrustStatus) ?? (row.status === 'ok' || row.status === 'warning' || row.status === 'fail' ? row.status : 'warning'),
      summary: typeof details.summary === 'string' ? details.summary : 'all trust checks healthy',
      details,
      checks,
    })
  }

  return [...runs.values()]
}

async function persistTrustRun(prisma: AnalyticsDataTrustPrismaLike, result: AnalyticsDataTrustResult) {
  const trustTable = prisma.analyticsDataTrustCheck
  if (!trustTable) {
    return
  }
  const createdAt = new Date(result.updatedAt)
  const detailsJson = serializeResult(result) as Prisma.InputJsonValue

  await Promise.all(
    result.checks.map((check) =>
      trustTable.create({
        data: {
          environment: result.environment,
          checkName: check.check,
          status: check.status,
          metricValue: normalizeDecimalInput(check.value),
          expectedRange: check.expected,
          detailsJson,
          createdAt,
        },
      }),
    ),
  )
}

export async function runAnalyticsDataTrustChecks(
  prisma: AnalyticsDataTrustPrismaLike,
  options: AnalyticsDataTrustOptions = {},
): Promise<AnalyticsDataTrustResult> {
  const now = new Date()
  const environment = normalizeEnvironment(options.environment ?? process.env.RUNTIME_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV)
  const lookbackDays = Math.max(
    1,
    Number(
      options.lookbackDays ??
        readEnvNumber(['ANALYTICS_DATA_TRUST_LOOKBACK_DAYS'], DEFAULT_LOOKBACK_DAYS),
    ),
  )
  const silenceWindowHours = Math.max(
    1,
    Number(
      options.silenceWindowHours ??
        readEnvNumber(['ANALYTICS_DATA_TRUST_SILENCE_WINDOW_HOURS'], DEFAULT_SILENCE_WINDOW_HOURS),
    ),
  )
  const minConversionCount = Math.max(
    1,
    Number(
      options.minConversionCount ??
        readEnvNumber(['ANALYTICS_DATA_TRUST_MIN_CONVERSION_COUNT'], DEFAULT_MIN_CONVERSION_COUNT),
    ),
  )
  const zeroConversionCriticalTraffic = Math.max(
    1,
    Number(
      options.zeroConversionCriticalTraffic ??
        readEnvNumber(
          ['ANALYTICS_DATA_TRUST_ZERO_CONVERSION_CRITICAL_TRAFFIC'],
          DEFAULT_ZERO_CONVERSION_CRITICAL_TRAFFIC,
        ),
    ),
  )
  const attributionMinimumPercent = Math.min(
    100,
    Math.max(
      0,
      Number(
        options.attributionMinimumPercent ??
          readEnvNumber(
            ['ANALYTICS_DATA_TRUST_ATTRIBUTION_MINIMUM_PERCENT'],
            DEFAULT_ATTRIBUTION_MINIMUM_PERCENT,
          ),
      ),
    ),
  )
  const ga4TolerancePercent = Math.min(
    100,
    Math.max(
      0,
      Number(
        options.ga4TolerancePercent ??
          readEnvNumber(['ANALYTICS_DATA_TRUST_GA4_TOLERANCE_PERCENT'], DEFAULT_GA4_TOLERANCE_PERCENT),
      ),
    ),
  )
  const trafficDropThresholdPercent = Math.min(
    100,
    Math.max(
      0,
      Number(
        options.trafficDropThresholdPercent ??
          readEnvNumber(
            ['ANALYTICS_DATA_TRUST_TRAFFIC_DROP_THRESHOLD_PERCENT'],
            DEFAULT_TRAFFIC_DROP_THRESHOLD_PERCENT,
          ),
      ),
    ),
  )

  const currentWindowEnd = startOfUtcDay(now)
  const currentWindowStart = addUtcDays(currentWindowEnd, -lookbackDays)
  const previousWindowStart = addUtcDays(currentWindowStart, -lookbackDays)
  const silenceWindowStart = new Date(now.getTime() - silenceWindowHours * 60 * 60 * 1000)

  const eventFact = prisma.eventFact
  const reportingDaily = prisma.analyticsReportingDaily
  const ga4DailyMetric = prisma.analyticsGa4DailyMetric
  if (!eventFact || !reportingDaily || !ga4DailyMetric) {
    throw new Error('Analytics data trust requires event, reporting, and GA4 tables to be available.')
  }

  const [events24h, currentEvents, previousEvents, reportingCurrent, reportingPrevious, ga4Current, ownPurchasesCurrent] =
    await Promise.all([
      eventFact.count({
        where: {
          createdAt: { gte: silenceWindowStart },
        },
      }),
      eventFact.count({
        where: {
          eventDate: { gte: currentWindowStart, lt: currentWindowEnd },
        },
      }),
      eventFact.count({
        where: {
          eventDate: { gte: previousWindowStart, lt: currentWindowStart },
        },
      }),
      reportingDaily.aggregate({
        where: {
          date: { gte: currentWindowStart, lt: currentWindowEnd },
        },
        _sum: {
          sessions: true,
          purchase: true,
        },
      }),
      reportingDaily.aggregate({
        where: {
          date: { gte: previousWindowStart, lt: currentWindowStart },
        },
        _sum: {
          sessions: true,
          purchase: true,
        },
      }),
      ga4DailyMetric.aggregate({
        where: {
          date: { gte: currentWindowStart, lt: currentWindowEnd },
        },
        _sum: {
          purchases: true,
        },
      }),
      eventFact.count({
        where: {
          eventName: 'purchase',
          eventDate: { gte: currentWindowStart, lt: currentWindowEnd },
        },
      }),
    ])

  const reportingCurrentSum = reportingCurrent._sum as { sessions?: Prisma.Decimal | number | null; purchase?: Prisma.Decimal | number | null } | undefined
  const reportingPreviousSum = reportingPrevious._sum as { sessions?: Prisma.Decimal | number | null; purchase?: Prisma.Decimal | number | null } | undefined
  const ga4CurrentSum = ga4Current._sum as { purchases?: Prisma.Decimal | number | null } | undefined
  const currentSessions = asDecimalNumber(reportingCurrentSum?.sessions ?? 0)
  const previousSessions = asDecimalNumber(reportingPreviousSum?.sessions ?? 0)
  const currentPurchases = asDecimalNumber(reportingCurrentSum?.purchase ?? 0)
  const ga4Purchases = asDecimalNumber(ga4CurrentSum?.purchases ?? 0)
  const currentConversionCount = ownPurchasesCurrent

  const eventCoverageChecks = await Promise.all(
    ['whatsapp_click', 'form_submit', 'purchase'].map(async (eventName) => {
      const count = await eventFact.count({
        where: {
          eventName,
          eventDate: { gte: currentWindowStart, lt: currentWindowEnd },
        },
      })
      return buildCheck(
        `event_coverage_${eventName}`,
        count > 0 ? 'ok' : 'fail',
        count,
        '> 0',
        'critical',
        {
          event_name: eventName,
          window_days: lookbackDays,
          count,
        },
      )
    }),
  )

  const silenceStatus: TrustStatus = events24h === 0 ? 'fail' : 'ok'
  const silenceCheck = buildCheck(
    'silence_window',
    silenceStatus,
    events24h,
    '> 0',
    'critical',
    {
      window_hours: silenceWindowHours,
      count_24h: events24h,
    },
  )

  const conversionStatus: TrustStatus =
    currentSessions === 0
      ? 'warning'
      : currentConversionCount === 0
        ? currentSessions >= zeroConversionCriticalTraffic
          ? 'fail'
          : 'warning'
        : currentConversionCount < minConversionCount
          ? 'warning'
          : 'ok'
  const conversionCheck = buildCheck(
    'conversion_presence',
    conversionStatus,
    currentConversionCount,
    `>= ${minConversionCount}`,
    conversionStatus === 'fail' ? 'critical' : 'warning',
    {
      sessions_7d: currentSessions,
      conversions_7d: currentConversionCount,
      zero_conversion_critical_traffic: zeroConversionCriticalTraffic,
    },
  )

  const currentAttributionCoverageCount = await eventFact.count({
    where: {
      eventDate: { gte: currentWindowStart, lt: currentWindowEnd },
      source: { not: null },
      utmMedium: { not: null },
      utmCampaign: { not: null },
    },
  })
  const attributionCoveragePct = currentEvents > 0 ? (currentAttributionCoverageCount / currentEvents) * 100 : 0
  const attributionStatus: TrustStatus =
    currentEvents > 0 && attributionCoveragePct < attributionMinimumPercent ? 'warning' : 'ok'
  const attributionCheck = buildCheck(
    'attribution_coverage',
    attributionStatus,
    Number(attributionCoveragePct.toFixed(2)),
    `>= ${attributionMinimumPercent}%`,
    'warning',
    {
      covered_events: currentAttributionCoverageCount,
      total_events: currentEvents,
      minimum_percent: attributionMinimumPercent,
    },
  )

  const ga4DifferencePct =
    Math.max(ga4Purchases, currentPurchases) === 0
      ? null
      : Number((Math.abs(ga4Purchases - currentPurchases) / Math.max(ga4Purchases, currentPurchases) * 100).toFixed(2))
  const ga4AlignmentStatus: TrustStatus =
    ga4Purchases === 0 && currentPurchases === 0
      ? currentSessions > 0
        ? 'warning'
        : 'ok'
      : ga4DifferencePct !== null && ga4DifferencePct > ga4TolerancePercent
        ? 'fail'
        : 'ok'
  const ga4AlignmentCheck = buildCheck(
    'ga4_vs_event_facts_purchases',
    ga4AlignmentStatus,
    ga4DifferencePct,
    `<= ${ga4TolerancePercent}%`,
    ga4AlignmentStatus === 'fail' ? 'critical' : 'warning',
    {
      ga4_purchases_7d: ga4Purchases,
      reporting_purchase_7d: currentPurchases,
      tolerance_percent: ga4TolerancePercent,
    },
  )

  const dropPct =
    previousEvents === 0
      ? null
      : Number((((previousEvents - currentEvents) / previousEvents) * 100).toFixed(2))
  const dropStatus: TrustStatus =
    previousEvents > 0 && dropPct !== null && dropPct > trafficDropThresholdPercent ? 'warning' : 'ok'
  const dropCheck = buildCheck(
    'traffic_drop',
    dropStatus,
    dropPct,
    `<= ${trafficDropThresholdPercent}%`,
    'warning',
    {
      current_events: currentEvents,
      previous_events: previousEvents,
      threshold_percent: trafficDropThresholdPercent,
      current_window_days: lookbackDays,
    },
  )

  const checks = [
    ...eventCoverageChecks,
    conversionCheck,
    attributionCheck,
    ga4AlignmentCheck,
    dropCheck,
    silenceCheck,
  ]

  const status = summarizeChecks(checks)
  const summary = summarizeFailureList(checks)
  const result: AnalyticsDataTrustResult = {
    status,
    environment,
    summary,
    updatedAt: now.toISOString(),
    metrics: {
      events_24h: events24h,
      events_current_window: currentEvents,
      events_previous_window: previousEvents,
      conversions_current_window: currentConversionCount,
      sessions_current_window: currentSessions,
      attribution_coverage_pct: Number(attributionCoveragePct.toFixed(2)),
      ga4_purchases_current_window: ga4Purchases,
      reporting_purchases_current_window: currentPurchases,
      ga4_difference_pct: ga4DifferencePct,
      traffic_drop_pct: dropPct,
    },
    trend: toTrend(currentEvents, previousEvents),
    checks,
  }

  if (options.persist !== false) {
    await persistTrustRun(prisma, result)
  }

  return result
}

export async function listAnalyticsDataTrustHistory(
  prisma: AnalyticsDataTrustPrismaLike,
  limit = 10,
  environment?: string,
): Promise<AnalyticsDataTrustHistoryItem[]> {
  const trustTable = prisma.analyticsDataTrustCheck
  if (!trustTable) {
    return []
  }

  const rows = await trustTable.findMany({
    where: {
      ...(environment ? { environment } : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: Math.max(1, limit) * 10,
  })

  const runs = groupRuns(rows).slice(0, Math.max(1, limit))
  return runs.map((run) => ({
    status: run.status,
    summary: run.summary,
    createdAt: run.createdAt,
    environment: run.environment,
  }))
}

export async function getLatestAnalyticsDataTrustRun(
  prisma: AnalyticsDataTrustPrismaLike,
  environment?: string,
) {
  const history = await listAnalyticsDataTrustHistory(prisma, 1, environment)
  return history[0] ?? null
}

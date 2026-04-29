import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { Prisma, PrismaClient } from '@prisma/client'
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import { runAnalyticsDataTrustChecks } from '../src/analytics/data-trust/analytics-data-trust.core'

type HealthMode = 'default' | 'ci' | 'monitor'
type HealthStatus = 'ok' | 'warning' | 'fail'
type HealthSeverity = 'info' | 'warning' | 'critical'

export type HealthCheck = {
  name: string
  status: HealthStatus
  severity: HealthSeverity
  details: Record<string, unknown>
}

export type HealthResult = {
  status: HealthStatus
  mode: HealthMode
  environment: string
  summary: string
  incidentSignature: string
  duration_ms: number
  checks: HealthCheck[]
}

export type SerializedHealthResult = {
  status: HealthStatus
  mode: HealthMode
  environment: string
  summary: string
  checks: HealthCheck[]
  duration_ms: number
  incident_signature: string
}

type HealthOptions = {
  mode?: HealthMode
  baseUrl?: string
  queueName?: string
  queueUrl?: string
  json?: boolean
  alertWebhookUrl?: string | null
  alertCooldownMinutes?: number
  logsUrl?: string | null
  maxSyncLagHours?: number
  waitingWarningThreshold?: number
  waitingCriticalThreshold?: number
  failedCriticalThreshold?: number
  maxAttributionMismatchPct?: number
  minEventRows24h?: number
  dataTrustLookbackDays?: number
  dataTrustSilenceWindowHours?: number
  dataTrustMinConversionCount?: number
  dataTrustZeroConversionCriticalTraffic?: number
  dataTrustAttributionMinimumPercent?: number
  dataTrustGa4TolerancePercent?: number
  dataTrustTrafficDropThresholdPercent?: number
}

const DEFAULT_BASE_URL = 'http://localhost:4000'
const DEFAULT_QUEUE_NAME = 'analytics-pipeline'
const DEFAULT_MAX_SYNC_LAG_HOURS = 36
const DEFAULT_WAITING_WARNING_THRESHOLD = 10
const DEFAULT_WAITING_CRITICAL_THRESHOLD = 50
const DEFAULT_FAILED_CRITICAL_THRESHOLD = 5
const DEFAULT_MAX_ATTRIBUTION_MISMATCH_PCT = 20
const DEFAULT_MIN_EVENT_ROWS_24H = 1
const DEFAULT_ALERT_COOLDOWN_MINUTES = 30
const DEFAULT_DATA_TRUST_LOOKBACK_DAYS = 7
const DEFAULT_DATA_TRUST_SILENCE_WINDOW_HOURS = 24
const DEFAULT_DATA_TRUST_MIN_CONVERSION_COUNT = 1
const DEFAULT_DATA_TRUST_ZERO_CONVERSION_CRITICAL_TRAFFIC = 100
const DEFAULT_DATA_TRUST_ATTRIBUTION_MINIMUM_PERCENT = 70
const DEFAULT_DATA_TRUST_GA4_TOLERANCE_PERCENT = 20
const DEFAULT_DATA_TRUST_TRAFFIC_DROP_THRESHOLD_PERCENT = 40
const SYNCABLE_SOURCES = ['ga4', 'ads', 'search_console'] as const

function readEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return
  }

  const content = readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }
    const key = line.slice(0, separatorIndex).trim()
    if (!key || process.env[key]) {
      continue
    }
    let value = line.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

export function loadAnalyticsHealthEnv() {
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '.env.analytics.local'),
    join(process.cwd(), '..', 'deploy', 'env', 'backend.dev.env'),
    join(process.cwd(), '..', 'deploy', 'env', 'backend.prod.env'),
  ]

  for (const filePath of candidates) {
    readEnvFile(filePath)
  }
}

function readCliValue(name: string) {
  const argv = process.argv.slice(2)
  const directIndex = argv.findIndex((entry) => entry === name)
  if (directIndex !== -1) {
    return argv[directIndex + 1] || null
  }

  const prefix = `${name}=`
  const match = argv.find((entry) => entry.startsWith(prefix))
  return match ? match.slice(prefix.length) || null : null
}

function asNumber(value: string | number | null | undefined, fallback: number) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }
  return fallback
}

function normalizeEnvironment(value: string | null | undefined) {
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

function formatFailureList(checks: HealthCheck[]) {
  return checks
    .filter((check) => check.status !== 'ok')
    .map((check) => `${check.name}:${check.status}`)
    .join(', ')
}

function buildIncidentSignature(result: HealthResult) {
  const parts = result.checks
    .filter((check) => check.status !== 'ok')
    .map((check) => `${check.name}:${check.status}:${JSON.stringify(check.details)}`)
    .sort()
  return createHash('sha256').update(parts.join('|')).digest('hex')
}

function summarizeStatus(checks: HealthCheck[]): HealthStatus {
  if (checks.some((check) => check.status === 'fail')) {
    return 'fail'
  }
  if (checks.some((check) => check.status === 'warning')) {
    return 'warning'
  }
  return 'ok'
}

function serializeResult(result: HealthResult): SerializedHealthResult {
  return {
    status: result.status,
    mode: result.mode,
    environment: result.environment,
    summary: result.summary,
    checks: result.checks,
    duration_ms: result.duration_ms,
    incident_signature: result.incidentSignature,
  }
}

async function fetchJson(url: string, timeoutMs = 10_000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: 'application/json',
      },
    })
    const text = await response.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    return { response, body }
  } finally {
    clearTimeout(timeout)
  }
}

async function getQueueSnapshot(queueName: string, queueUrl: string) {
  const redis = new Redis(queueUrl, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  })
  const queue = new Queue(queueName, {
    connection: redis,
  })

  try {
    const [counts, repeatableJobs, waitingJobs, activeJobs] = await Promise.all([
      queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused'),
      queue.getRepeatableJobs(),
      queue.getJobs(['waiting'], 0, 25),
      queue.getJobs(['active'], 0, 25),
    ])

    return {
      counts,
      repeatableJobs,
      waitingJobs,
      activeJobs,
      ping: await redis.ping(),
    }
  } finally {
    await queue.close().catch(() => undefined)
    await redis.quit().catch(() => undefined)
  }
}

function ageInMinutes(timestamp: number | null | undefined) {
  if (!timestamp) {
    return null
  }
  return (Date.now() - timestamp) / 60_000
}

function makeCheck(
  name: string,
  status: HealthStatus,
  severity: HealthSeverity,
  details: Record<string, unknown>,
): HealthCheck {
  return { name, status, severity, details }
}

async function sendSlackAlert(input: {
  webhookUrl: string
  result: HealthResult
  signature: string
  logsUrl: string | null
  cooldownMinutes: number
  prisma: PrismaClient
}) {
  const { webhookUrl, result, signature, logsUrl, cooldownMinutes, prisma } = input
  const now = new Date()
  const existing = await prisma.analyticsHealthAlertState.findUnique({
    where: {
      environment: result.environment,
    },
  })

  const sameSignature = existing?.lastSignature === signature
  const withinCooldown =
    existing?.lastAlertedAt instanceof Date
      ? now.getTime() - existing.lastAlertedAt.getTime() < cooldownMinutes * 60_000
      : false

  if (sameSignature && withinCooldown) {
    return
  }

  const failedChecks = result.checks.filter((check) => check.status !== 'ok')
  const payload = {
    text: [
      `Analytics health ${result.status.toUpperCase()} in ${result.environment}`,
      `Summary: ${result.summary}`,
      `Checks: ${failedChecks.map((check) => `${check.name} (${check.status})`).join(', ') || 'none'}`,
      `Logs: ${logsUrl ?? 'n/a'}`,
      `Timestamp: ${now.toISOString()}`,
    ].join('\n'),
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Slack webhook failed (${response.status}): ${body}`)
  }

  await prisma.analyticsHealthAlertState.upsert({
    where: {
      environment: result.environment,
    },
    create: {
      environment: result.environment,
      lastStatus: result.status,
      lastSignature: signature,
      lastAlertedAt: now,
    },
    update: {
      lastStatus: result.status,
      lastSignature: signature,
      lastAlertedAt: now,
    },
  })
}

async function collectHealthChecks(
  prisma: PrismaClient,
  options: Required<Pick<HealthOptions, 'mode'>> & HealthOptions,
): Promise<HealthResult> {
  const baseUrl = options.baseUrl ?? process.env.ANALYTICS_HEALTH_BASE_URL ?? DEFAULT_BASE_URL
  const queueName = options.queueName ?? process.env.ANALYTICS_QUEUE_NAME ?? DEFAULT_QUEUE_NAME
  const queueUrl =
    options.queueUrl ??
    process.env.ANALYTICS_QUEUE_URL ??
    process.env.QUEUE_REDIS_URL ??
    process.env.REDIS_URL ??
    null
  const environment = normalizeEnvironment(
    process.env.RUNTIME_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV,
  )
  const maxSyncLagHours = asNumber(
    options.maxSyncLagHours ?? process.env.ANALYTICS_HEALTH_MAX_SYNC_LAG_HOURS,
    DEFAULT_MAX_SYNC_LAG_HOURS,
  )
  const waitingWarningThreshold = asNumber(
    options.waitingWarningThreshold ?? process.env.ANALYTICS_HEALTH_WAITING_WARNING_THRESHOLD,
    DEFAULT_WAITING_WARNING_THRESHOLD,
  )
  const waitingCriticalThreshold = asNumber(
    options.waitingCriticalThreshold ?? process.env.ANALYTICS_HEALTH_WAITING_CRITICAL_THRESHOLD,
    DEFAULT_WAITING_CRITICAL_THRESHOLD,
  )
  const failedCriticalThreshold = asNumber(
    options.failedCriticalThreshold ?? process.env.ANALYTICS_HEALTH_FAILED_CRITICAL_THRESHOLD,
    DEFAULT_FAILED_CRITICAL_THRESHOLD,
  )
  const maxAttributionMismatchPct = asNumber(
    options.maxAttributionMismatchPct ?? process.env.ANALYTICS_HEALTH_MAX_ATTRIBUTION_MISMATCH_PCT,
    DEFAULT_MAX_ATTRIBUTION_MISMATCH_PCT,
  )
  const minEventRows24h = asNumber(
    options.minEventRows24h ?? process.env.ANALYTICS_HEALTH_MIN_EVENT_ROWS_24H,
    DEFAULT_MIN_EVENT_ROWS_24H,
  )
  const dataTrustLookbackDays = asNumber(
    options.dataTrustLookbackDays ?? process.env.ANALYTICS_DATA_TRUST_LOOKBACK_DAYS,
    DEFAULT_DATA_TRUST_LOOKBACK_DAYS,
  )
  const dataTrustSilenceWindowHours = asNumber(
    options.dataTrustSilenceWindowHours ?? process.env.ANALYTICS_DATA_TRUST_SILENCE_WINDOW_HOURS,
    DEFAULT_DATA_TRUST_SILENCE_WINDOW_HOURS,
  )
  const dataTrustMinConversionCount = asNumber(
    options.dataTrustMinConversionCount ?? process.env.ANALYTICS_DATA_TRUST_MIN_CONVERSION_COUNT,
    DEFAULT_DATA_TRUST_MIN_CONVERSION_COUNT,
  )
  const dataTrustZeroConversionCriticalTraffic = asNumber(
    options.dataTrustZeroConversionCriticalTraffic ??
      process.env.ANALYTICS_DATA_TRUST_ZERO_CONVERSION_CRITICAL_TRAFFIC,
    DEFAULT_DATA_TRUST_ZERO_CONVERSION_CRITICAL_TRAFFIC,
  )
  const dataTrustAttributionMinimumPercent = asNumber(
    options.dataTrustAttributionMinimumPercent ??
      process.env.ANALYTICS_DATA_TRUST_ATTRIBUTION_MINIMUM_PERCENT,
    DEFAULT_DATA_TRUST_ATTRIBUTION_MINIMUM_PERCENT,
  )
  const dataTrustGa4TolerancePercent = asNumber(
    options.dataTrustGa4TolerancePercent ?? process.env.ANALYTICS_DATA_TRUST_GA4_TOLERANCE_PERCENT,
    DEFAULT_DATA_TRUST_GA4_TOLERANCE_PERCENT,
  )
  const dataTrustTrafficDropThresholdPercent = asNumber(
    options.dataTrustTrafficDropThresholdPercent ??
      process.env.ANALYTICS_DATA_TRUST_TRAFFIC_DROP_THRESHOLD_PERCENT,
    DEFAULT_DATA_TRUST_TRAFFIC_DROP_THRESHOLD_PERCENT,
  )
  const startedAt = Date.now()
  const checks: HealthCheck[] = []

  const backendHealth = await Promise.all([
    fetchJson(`${baseUrl.replace(/\/+$/u, '')}/api/healthz`),
    fetchJson(`${baseUrl.replace(/\/+$/u, '')}/api/readyz`),
  ])

  const healthz = backendHealth[0]
  const readyz = backendHealth[1]
  const healthzOk =
    healthz.response.ok &&
    typeof healthz.body === 'object' &&
    healthz.body !== null &&
    (healthz.body as { status?: string }).status === 'ok'
  checks.push(
    makeCheck('backend_healthz', healthzOk ? 'ok' : 'fail', 'critical', {
      http_status: healthz.response.status,
      status:
        typeof healthz.body === 'object' && healthz.body
          ? (healthz.body as { status?: string }).status ?? 'unknown'
          : 'invalid',
    }),
  )

  const readyzOk =
    readyz.response.ok &&
    typeof readyz.body === 'object' &&
    readyz.body !== null &&
    (readyz.body as { status?: string; db?: boolean }).status === 'ready' &&
    (readyz.body as { status?: string; db?: boolean }).db === true
  checks.push(
    makeCheck('backend_readyz', readyzOk ? 'ok' : 'fail', 'critical', {
      http_status: readyz.response.status,
      status:
        typeof readyz.body === 'object' && readyz.body
          ? (readyz.body as { status?: string }).status ?? 'unknown'
          : 'invalid',
      db:
        typeof readyz.body === 'object' && readyz.body
          ? Boolean((readyz.body as { db?: boolean }).db)
          : false,
    }),
  )

  let queueHealthy = false
  let workerHealthy = false
  if (!queueUrl) {
    checks.push(
      makeCheck('redis_health', 'fail', 'critical', {
        reason: 'queue url missing',
      }),
    )
    checks.push(
      makeCheck('queue_health', 'fail', 'critical', {
        reason: 'queue url missing',
      }),
    )
    checks.push(
      makeCheck('worker_health', 'fail', 'critical', {
        reason: 'queue url missing',
      }),
    )
  } else {
    try {
      const snapshot = await getQueueSnapshot(queueName, queueUrl)
      const waiting = snapshot.counts.waiting ?? 0
      const active = snapshot.counts.active ?? 0
      const failed = snapshot.counts.failed ?? 0
      const delayed = snapshot.counts.delayed ?? 0
      const completed = snapshot.counts.completed ?? 0
      const oldestWaitingAgeMinutes = Math.max(
        ...snapshot.waitingJobs.map((job) => ageInMinutes(job.timestamp) ?? 0),
        0,
      )
      const oldestActiveAgeMinutes = Math.max(
        ...snapshot.activeJobs.map((job) => ageInMinutes(job.processedOn ?? job.timestamp) ?? 0),
        0,
      )

      const redisOk = snapshot.ping === 'PONG'
      checks.push(
        makeCheck('redis_health', redisOk ? 'ok' : 'fail', 'critical', {
          ping: snapshot.ping,
        }),
      )

      const queueSeverity: HealthSeverity =
        failed > failedCriticalThreshold || waiting > waitingCriticalThreshold ? 'critical' : 'warning'
      const queueStatus: HealthStatus =
        failed > failedCriticalThreshold ||
        waiting > waitingCriticalThreshold ||
        (waiting > 0 && active === 0 && oldestWaitingAgeMinutes >= 10)
          ? 'fail'
          : waiting > waitingWarningThreshold || delayed > 0
            ? 'warning'
            : 'ok'
      queueHealthy = queueStatus !== 'fail'
      checks.push(
        makeCheck('queue_health', queueStatus, queueSeverity, {
          queue_name: queueName,
          waiting,
          active,
          failed,
          delayed,
          completed,
          repeatable_jobs: snapshot.repeatableJobs.length,
          oldest_waiting_age_minutes: Number(oldestWaitingAgeMinutes.toFixed(2)),
          oldest_active_age_minutes: Number(oldestActiveAgeMinutes.toFixed(2)),
        }),
      )

      const repeatableOk = snapshot.repeatableJobs.length >= 2
      const workerStatus: HealthStatus =
        !repeatableOk || (waiting > 0 && active === 0 && oldestWaitingAgeMinutes >= 10)
          ? 'fail'
          : completed > 0 || active > 0 || waiting === 0
            ? 'ok'
            : 'warning'
      workerHealthy = workerStatus !== 'fail'
      checks.push(
        makeCheck('worker_health', workerStatus, repeatableOk ? 'info' : 'critical', {
          repeatable_jobs: snapshot.repeatableJobs.length,
          waiting,
          active,
          completed,
          oldest_waiting_age_minutes: Number(oldestWaitingAgeMinutes.toFixed(2)),
        }),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      checks.push(
        makeCheck('redis_health', 'fail', 'critical', {
          error: message,
        }),
      )
      checks.push(
        makeCheck('queue_health', 'fail', 'critical', {
          error: message,
        }),
      )
      checks.push(
        makeCheck('worker_health', 'fail', 'critical', {
          error: message,
        }),
      )
    }
  }

  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(dayStart.getTime() - 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const eventCounts = await Promise.all([
    prisma.eventFact.count({ where: { eventDate: { gte: yesterdayStart } } }),
    prisma.eventFact.count({ where: { eventDate: { gte: sevenDaysAgo } } }),
    prisma.eventFact.count({
      where: {
        eventDate: { gte: sevenDaysAgo },
        source: null,
      },
    }),
    prisma.eventFact.count({
      where: {
        eventDate: { gte: sevenDaysAgo },
        OR: [{ utmMedium: null }, { utmCampaign: null }, { landingPage: null }],
      },
    }),
    prisma.eventFact.count({
      where: {
        eventDate: { gte: sevenDaysAgo },
        source: { not: null },
        utmMedium: { not: null },
        utmCampaign: { not: null },
        landingPage: { not: null },
      },
    }),
  ])
  const events24h = eventCounts[0]
  const events7d = eventCounts[1]
  const missingSource7d = eventCounts[2]
  const missingAttribution7d = eventCounts[3]
  const completeAttribution7d = eventCounts[4]
  const attributionCoveragePct = events7d > 0 ? (completeAttribution7d / events7d) * 100 : 0
  const eventIngestionStatus: HealthStatus =
    events24h === 0 && events7d > 0
      ? 'fail'
      : events24h === 0
        ? 'warning'
        : 'ok'
  checks.push(
    makeCheck('event_ingestion', eventIngestionStatus, eventIngestionStatus === 'fail' ? 'critical' : 'warning', {
      events_24h: events24h,
      events_7d: events7d,
      baseline_missing_source_7d: missingSource7d,
      baseline_missing_attribution_7d: missingAttribution7d,
    }),
  )

  const attributionStatus: HealthStatus =
    attributionCoveragePct < 50
      ? 'fail'
      : attributionCoveragePct < 80
        ? 'warning'
        : 'ok'
  checks.push(
    makeCheck('attribution_coverage', attributionStatus, attributionStatus === 'ok' ? 'info' : 'warning', {
      coverage_pct: Number(attributionCoveragePct.toFixed(2)),
      threshold_pct: 80,
      critical_threshold_pct: 50,
      missing_source_7d: missingSource7d,
      missing_attribution_7d: missingAttribution7d,
    }),
  )

  const metaRecent = await Promise.all([
    prisma.eventFact.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
        metaStatus: 'sent',
      },
    }),
    prisma.eventFact.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
        metaStatus: 'failed',
      },
    }),
    prisma.eventFact.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
        metaStatus: 'sent',
        OR: [{ fbp: { not: null } }, { fbc: { not: null } }],
      },
    }),
    prisma.eventFact.count({
      where: {
        createdAt: { gte: sevenDaysAgo },
        metaStatus: 'sent',
        metaEventId: null,
      },
    }),
  ])
  const metaSent7d = metaRecent[0]
  const metaFailed7d = metaRecent[1]
  const metaWithIdentity7d = metaRecent[2]
  const metaMissingEventId7d = metaRecent[3]
  const metaFailureRate = metaSent7d + metaFailed7d > 0 ? (metaFailed7d / (metaSent7d + metaFailed7d)) * 100 : 0
  const metaCoverageRate = metaSent7d > 0 ? (metaWithIdentity7d / metaSent7d) * 100 : 0
  const metaStatus: HealthStatus =
    metaFailed7d > 0 && metaFailureRate > 20
      ? 'fail'
      : metaSent7d === 0 && events7d > 0
        ? 'warning'
        : metaCoverageRate < 60
          ? 'warning'
          : 'ok'
  checks.push(
    makeCheck('meta_delivery', metaStatus, metaStatus === 'ok' ? 'info' : 'warning', {
      sent_7d: metaSent7d,
      failed_7d: metaFailed7d,
      failure_rate_pct: Number(metaFailureRate.toFixed(2)),
      identity_coverage_pct: Number(metaCoverageRate.toFixed(2)),
      missing_event_id_7d: metaMissingEventId7d,
    }),
  )

  const [ga4Rows7d, adsRows7d, scRows7d, reportingRows7d] = await Promise.all([
    prisma.analyticsGa4DailyMetric.count({ where: { date: { gte: sevenDaysAgo } } }),
    prisma.analyticsAdsDailyMetric.count({ where: { date: { gte: sevenDaysAgo } } }),
    prisma.analyticsSearchConsoleDailyMetric.count({ where: { date: { gte: sevenDaysAgo } } }),
    prisma.analyticsReportingDaily.count({ where: { date: { gte: sevenDaysAgo } } }),
  ])
  const crossSourceStatus: HealthStatus =
    (ga4Rows7d > 0 && reportingRows7d === 0) ||
    (adsRows7d > 0 && reportingRows7d === 0) ||
    (scRows7d > 0 && reportingRows7d === 0)
      ? 'fail'
      : ga4Rows7d + adsRows7d + scRows7d === 0
        ? 'warning'
        : 'ok'
  checks.push(
    makeCheck('cross_source_consistency', crossSourceStatus, crossSourceStatus === 'ok' ? 'info' : 'warning', {
      ga4_rows_7d: ga4Rows7d,
      ads_rows_7d: adsRows7d,
      search_console_rows_7d: scRows7d,
      reporting_rows_7d: reportingRows7d,
      queue_healthy: queueHealthy,
      worker_healthy: workerHealthy,
    }),
  )

  const failedDataQualityChecks = await prisma.analyticsDataQualityCheck.count({
    where: {
      createdAt: { gte: sevenDaysAgo },
      status: { not: 'ok' },
    },
  })
  const dataQualityStatus: HealthStatus =
    failedDataQualityChecks > 10 ? 'fail' : failedDataQualityChecks > 0 ? 'warning' : 'ok'
  checks.push(
    makeCheck('data_quality', dataQualityStatus, dataQualityStatus === 'ok' ? 'info' : 'warning', {
      non_ok_7d: failedDataQualityChecks,
    }),
  )

  const dataTrustResult = await runAnalyticsDataTrustChecks(prisma, {
    environment,
    lookbackDays: dataTrustLookbackDays,
    silenceWindowHours: dataTrustSilenceWindowHours,
    minConversionCount: dataTrustMinConversionCount,
    zeroConversionCriticalTraffic: dataTrustZeroConversionCriticalTraffic,
    attributionMinimumPercent: dataTrustAttributionMinimumPercent,
    ga4TolerancePercent: dataTrustGa4TolerancePercent,
    trafficDropThresholdPercent: dataTrustTrafficDropThresholdPercent,
    persist: true,
  })
  checks.push(
    makeCheck('data_trust', dataTrustResult.status, dataTrustResult.status === 'ok' ? 'info' : 'critical', {
      summary: dataTrustResult.summary,
      metrics: dataTrustResult.metrics,
      trend: dataTrustResult.trend,
      checks: dataTrustResult.checks,
    }),
  )

  const parityChecks = await (prisma as PrismaClient & {
    analyticsDataParityCheck: {
      findMany: (args?: unknown) => Promise<Array<{
        source: string
        metric: string
        status: string
        deltaPercent: { toString: () => string }
        snapshotGroup: string | null
        createdAt: Date
      }>>
    }
  }).analyticsDataParityCheck.findMany({
    orderBy: [{ createdAt: 'desc' }],
    take: 50,
  })
  const paritySummary = parityChecks.reduce(
    (acc, check) => {
      if (check.status === 'aligned') {
        acc.aligned += 1
      } else if (check.status === 'warning') {
        acc.warning += 1
      } else if (check.status === 'mismatch') {
        acc.mismatch += 1
      } else {
        acc.missing += 1
      }
      return acc
    },
    {
      aligned: 0,
      warning: 0,
      mismatch: 0,
      missing: 0,
    },
  )
  const dataParityStatus: HealthStatus =
    paritySummary.mismatch > 0
      ? 'fail'
      : paritySummary.warning > 0 || paritySummary.missing > 0
        ? 'warning'
        : parityChecks.length > 0
          ? 'ok'
          : 'warning'
  checks.push(
    makeCheck('data_parity', dataParityStatus, dataParityStatus === 'ok' ? 'info' : 'critical', {
      summary: paritySummary,
      latest_snapshot_group: parityChecks[0]?.snapshotGroup ?? null,
      last_run_at: parityChecks[0]?.createdAt?.toISOString?.() ?? null,
      latest: parityChecks.slice(0, 10).map((check) => ({
        source: check.source,
        metric: check.metric,
        status: check.status,
        delta_percent: Number(check.deltaPercent.toString()),
      })),
    }),
  )

  const recentExportRuns = await prisma.analyticsExportRun.findMany({
    orderBy: [{ createdAt: 'desc' }],
    take: 10,
    select: {
      status: true,
      createdAt: true,
      exportType: true,
      source: true,
    },
  })
  const failedExportRuns = recentExportRuns.filter((run) => run.status === 'error').length
  const exportStatus: HealthStatus = failedExportRuns > 0 ? 'warning' : 'ok'
  checks.push(
    makeCheck('export_history', exportStatus, 'warning', {
      recent_runs: recentExportRuns.length,
      failed_runs: failedExportRuns,
      latest_status: recentExportRuns[0]?.status ?? null,
      latest_export_type: recentExportRuns[0]?.exportType ?? null,
      latest_source: recentExportRuns[0]?.source ?? null,
      last_run_at: recentExportRuns[0]?.createdAt?.toISOString?.() ?? null,
    }),
  )

  const status = summarizeStatus(checks)
  const summary = formatFailureList(checks) || 'all checks healthy'
  const duration_ms = Date.now() - startedAt
  const incidentSignature = buildIncidentSignature({
    status,
    mode: options.mode,
    environment,
    summary,
    incidentSignature: '',
    duration_ms,
    checks,
  })
  return {
    status,
    mode: options.mode,
    environment,
    summary,
    incidentSignature,
    duration_ms,
    checks,
  }
}

async function maybePersistHealthCheck(prisma: PrismaClient, result: HealthResult) {
  await prisma.analyticsHealthCheck.create({
    data: {
      status: result.status,
      environment: result.environment,
      summary: result.summary,
      detailsJson: serializeResult(result) as Prisma.InputJsonValue,
      durationMs: result.duration_ms,
    },
  })
}

export async function runAnalyticsHealth(options: HealthOptions = {}) {
  loadAnalyticsHealthEnv()

  const prisma = new PrismaClient()
  const mode = options.mode ?? (readCliValue('--mode') as HealthMode | null) ?? 'default'
  const result = await collectHealthChecks(prisma, {
    ...options,
    mode,
  })

  try {
    await maybePersistHealthCheck(prisma, result)

    const alertWebhookUrl =
      options.alertWebhookUrl ??
      process.env.ANALYTICS_HEALTH_SLACK_WEBHOOK_URL ??
      process.env.SLACK_WEBHOOK_URL ??
      null
    if (alertWebhookUrl && result.status !== 'ok') {
      await sendSlackAlert({
        webhookUrl: alertWebhookUrl,
        result,
        signature: result.incidentSignature,
        logsUrl:
          options.logsUrl ??
          process.env.ANALYTICS_HEALTH_LOGS_URL ??
          `${options.baseUrl ?? process.env.ANALYTICS_HEALTH_BASE_URL ?? DEFAULT_BASE_URL}/api/analytics/health`,
        cooldownMinutes: asNumber(
          options.alertCooldownMinutes ?? process.env.ANALYTICS_HEALTH_ALERT_COOLDOWN_MINUTES,
          DEFAULT_ALERT_COOLDOWN_MINUTES,
        ),
        prisma,
      })
    }
  } finally {
    await prisma.$disconnect().catch(() => undefined)
  }

  return serializeResult(result)
}

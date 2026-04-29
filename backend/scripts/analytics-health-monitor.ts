import { createHash } from 'node:crypto'

import { PrismaClient } from '@prisma/client'

import { runAnalyticsHealth } from './analytics-health-core'

type HealthStatus = 'ok' | 'warning' | 'fail'

type HealthCheck = {
  name: string
  status: HealthStatus
  severity: 'info' | 'warning' | 'critical'
  details: Record<string, unknown>
}

type HealthRow = {
  status: string
  summary: string
  detailsJson: unknown
  createdAt: Date
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

function hasFlag(name: string) {
  return process.argv.slice(2).includes(name)
}

function asNumber(value: string | null | undefined, fallback: number) {
  if (!value) {
    return fallback
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
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

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) {
    return 'n/a'
  }
  const date = value instanceof Date ? value : new Date(value)
  return date.toISOString()
}

function deriveComponents(checks: HealthCheck[]) {
  const pick = (...patterns: RegExp[]) => {
    const matches = checks.filter((check) => patterns.some((pattern) => pattern.test(check.name)))
    if (!matches.length) {
      return null
    }
    if (matches.some((check) => check.status === 'fail')) {
      return 'fail' as const
    }
    if (matches.some((check) => check.status === 'warning')) {
      return 'warning' as const
    }
    return 'ok' as const
  }

  return {
    ingestion: pick(/event_ingestion|attribution_coverage|cross_source_consistency/iu),
    sync: pick(/sync|worker_health|queue_health/iu),
    queue: pick(/redis_health|queue_health|worker_health/iu),
    attribution: pick(/attribution_coverage|cross_source_consistency/iu),
    meta: pick(/meta_delivery/iu),
  }
}

function deriveDegraded(rows: HealthRow[]) {
  const recentStatuses = rows.slice(0, 3).map((row) => row.status)
  if (recentStatuses.length === 3 && recentStatuses.every((status) => status === 'warning')) {
    return true
  }

  const oneHourAgo = Date.now() - 60 * 60 * 1000
  const failCount = rows.filter(
    (row) => row.status === 'fail' && new Date(row.createdAt).getTime() >= oneHourAgo,
  ).length
  return failCount >= 2
}

function buildSummaryText(input: {
  environment: string
  resultStatus: HealthStatus
  summary: string
  updatedAt: Date | string | null | undefined
  checks: HealthCheck[]
  degraded: boolean
  logsUrl: string | null
}) {
  const components = deriveComponents(input.checks)
  return [
    `Analytics Health Status: ${input.resultStatus.toUpperCase()}`,
    `Environment: ${input.environment}`,
    `Last check: ${formatDateTime(input.updatedAt)}`,
    `Summary: ${input.summary}`,
    `Degraded: ${input.degraded ? 'YES' : 'NO'}`,
    'Components:',
    `- Queue: ${components.queue?.toUpperCase() ?? 'N/A'}`,
    `- Sync: ${components.sync?.toUpperCase() ?? 'N/A'}`,
    `- Ingestion: ${components.ingestion?.toUpperCase() ?? 'N/A'}`,
    `- Attribution: ${components.attribution?.toUpperCase() ?? 'N/A'}`,
    `- Meta: ${components.meta?.toUpperCase() ?? 'N/A'}`,
    `Logs: ${input.logsUrl ?? 'n/a'}`,
  ].join('\n')
}

function buildDigestText(input: {
  environment: string
  rows: HealthRow[]
  logsUrl: string | null
}) {
  const statusCounts = input.rows.reduce(
    (acc, row) => {
      if (row.status === 'ok' || row.status === 'warning' || row.status === 'fail') {
        acc[row.status] += 1
      }
      return acc
    },
    { ok: 0, warning: 0, fail: 0 },
  )

  const checksByName = new Map<string, { ok: number; warning: number; fail: number }>()
  const recentNotes = input.rows.slice(0, 5).map((row) => `${formatDateTime(row.createdAt)} ${row.status} ${row.summary}`)

  for (const row of input.rows) {
    const details = row.detailsJson && typeof row.detailsJson === 'object' ? row.detailsJson : null
    const checks = details && Array.isArray((details as { checks?: unknown }).checks)
      ? ((details as { checks: unknown[] }).checks as Array<Record<string, unknown>>)
      : []

    for (const check of checks) {
      const name = typeof check.name === 'string' ? check.name : 'unknown'
      const status =
        check.status === 'ok' || check.status === 'warning' || check.status === 'fail'
          ? check.status
          : 'warning'
      const current = checksByName.get(name) ?? { ok: 0, warning: 0, fail: 0 }
      current[status] += 1
      checksByName.set(name, current)
    }
  }

  const repeatedWarnings = [...checksByName.entries()]
    .filter(([, counts]) => counts.warning >= 2)
    .sort((left, right) => right[1].warning - left[1].warning)
    .slice(0, 5)

  return [
    `Analytics Health Digest: ${input.environment.toUpperCase()}`,
    `Window size: ${input.rows.length} runs`,
    `Status distribution: OK ${statusCounts.ok} | WARNING ${statusCounts.warning} | FAIL ${statusCounts.fail}`,
    `Persistent warnings: ${
      repeatedWarnings.length
        ? repeatedWarnings.map(([name, counts]) => `${name} (${counts.warning} warnings)`).join(', ')
        : 'none'
    }`,
    'Recent runs:',
    ...(recentNotes.length ? recentNotes.map((entry) => `- ${entry}`) : ['- no executions found']),
    `Logs: ${input.logsUrl ?? 'n/a'}`,
  ].join('\n')
}

async function postSlackMessage(webhookUrl: string, text: string) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ text }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Slack webhook failed (${response.status}): ${body}`)
  }
}

async function runHealthOnce() {
  const result = await runAnalyticsHealth({
    mode: 'monitor',
    baseUrl: readCliValue('--base-url') ?? undefined,
    queueName: readCliValue('--queue-name') ?? undefined,
    queueUrl: readCliValue('--queue-url') ?? undefined,
    alertWebhookUrl: process.env.ANALYTICS_HEALTH_SLACK_WEBHOOK_URL ?? process.env.SLACK_WEBHOOK_URL ?? null,
    alertCooldownMinutes: asNumber(
      readCliValue('--alert-cooldown-minutes') ?? process.env.ANALYTICS_HEALTH_ALERT_COOLDOWN_MINUTES,
      30,
    ),
    logsUrl: process.env.ANALYTICS_HEALTH_LOGS_URL ?? null,
    maxSyncLagHours: asNumber(
      readCliValue('--max-sync-lag-hours') ?? process.env.ANALYTICS_HEALTH_MAX_SYNC_LAG_HOURS,
      36,
    ),
    waitingWarningThreshold: asNumber(
      readCliValue('--waiting-warning-threshold') ?? process.env.ANALYTICS_HEALTH_WAITING_WARNING_THRESHOLD,
      10,
    ),
    waitingCriticalThreshold: asNumber(
      readCliValue('--waiting-critical-threshold') ?? process.env.ANALYTICS_HEALTH_WAITING_CRITICAL_THRESHOLD,
      50,
    ),
    failedCriticalThreshold: asNumber(
      readCliValue('--failed-critical-threshold') ?? process.env.ANALYTICS_HEALTH_FAILED_CRITICAL_THRESHOLD,
      5,
    ),
    maxAttributionMismatchPct: asNumber(
      readCliValue('--max-attribution-mismatch-pct') ?? process.env.ANALYTICS_HEALTH_MAX_ATTRIBUTION_MISMATCH_PCT,
      20,
    ),
  })

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result))

  const prisma = new PrismaClient()
  try {
    await publishSummaryIfDue(prisma, result)
  } finally {
    await prisma.$disconnect().catch(() => undefined)
  }

  return result.status
}

async function publishSummaryIfDue(prisma: PrismaClient, result: Awaited<ReturnType<typeof runAnalyticsHealth>>) {
  const webhookUrl = process.env.ANALYTICS_HEALTH_SLACK_WEBHOOK_URL ?? process.env.SLACK_WEBHOOK_URL ?? null
  if (!webhookUrl) {
    return
  }

  const summaryIntervalMinutes = asNumber(
    readCliValue('--summary-interval-minutes') ?? process.env.ANALYTICS_HEALTH_SUMMARY_INTERVAL_MINUTES,
    60,
  )
  const now = new Date()
  const existing = await prisma.analyticsHealthAlertState.findUnique({
    where: {
      environment: result.environment,
    },
  })

  const lastSummaryAt = existing?.lastSummaryAt ?? null
  if (lastSummaryAt && now.getTime() - lastSummaryAt.getTime() < summaryIntervalMinutes * 60_000) {
    return
  }

  const recentRows = (await prisma.analyticsHealthCheck.findMany({
    where: {
      environment: result.environment,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
  })) as HealthRow[]

  const checks = result.checks
  const degraded = deriveDegraded(recentRows)
  const text = buildSummaryText({
    environment: result.environment,
    resultStatus: result.status,
    summary: result.summary,
    updatedAt: recentRows[0]?.createdAt ?? null,
    checks,
    degraded,
    logsUrl: process.env.ANALYTICS_HEALTH_LOGS_URL ?? null,
  })

  await postSlackMessage(webhookUrl, text)

  await prisma.analyticsHealthAlertState.upsert({
    where: {
      environment: result.environment,
    },
    create: {
      environment: result.environment,
      lastStatus: result.status,
      lastSignature: result.incident_signature,
      lastAlertedAt: existing?.lastAlertedAt ?? null,
      lastSummaryAt: now,
      lastDigestAt: existing?.lastDigestAt ?? null,
      lastDigestSignature: existing?.lastDigestSignature ?? null,
    },
    update: {
      lastStatus: result.status,
      lastSignature: result.incident_signature,
      lastSummaryAt: now,
    },
  })
}

async function runDigest() {
  const prisma = new PrismaClient()
  const environment = normalizeEnvironment(process.env.RUNTIME_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV)
  const webhookUrl = process.env.ANALYTICS_HEALTH_SLACK_WEBHOOK_URL ?? process.env.SLACK_WEBHOOK_URL ?? null
  const limit = asNumber(readCliValue('--digest-limit') ?? process.env.ANALYTICS_HEALTH_DIGEST_LIMIT, 20)
  const lookbackHours = asNumber(
    readCliValue('--digest-window-hours') ?? process.env.ANALYTICS_HEALTH_DIGEST_WINDOW_HOURS,
    24,
  )
  const digestCooldownHours = asNumber(
    readCliValue('--digest-cooldown-hours') ?? process.env.ANALYTICS_HEALTH_DIGEST_COOLDOWN_HOURS,
    24,
  )
  const now = new Date()

  try {
    const rows = (await prisma.analyticsHealthCheck.findMany({
      where: {
        environment,
        createdAt: {
          gte: new Date(Date.now() - lookbackHours * 60 * 60 * 1000),
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: Number.isFinite(limit) && limit > 0 ? limit : 20,
    })) as HealthRow[]

    const digestSignature = createHash('sha256')
      .update(
        rows
          .map((row) => `${row.status}:${row.summary}:${row.createdAt.toISOString()}`)
          .join('|'),
      )
      .digest('hex')

    const existing = await prisma.analyticsHealthAlertState.findUnique({
      where: {
        environment,
      },
    })

    const lastDigestAt = existing?.lastDigestAt ?? null
    const withinCooldown =
      lastDigestAt instanceof Date
        ? now.getTime() - lastDigestAt.getTime() < digestCooldownHours * 60 * 60 * 1000
        : false
    const sameDigest = existing?.lastDigestSignature === digestSignature
    const shouldSkip = sameDigest && withinCooldown

    const output = {
      status: rows.length === 0
        ? ('warning' as const)
        : rows.some((row) => row.status === 'fail')
          ? ('fail' as const)
          : rows.some((row) => row.status === 'warning')
            ? ('warning' as const)
            : ('ok' as const),
      environment,
      digest: {
        windowHours: lookbackHours,
        totalRuns: rows.length,
        statusCounts: {
          ok: rows.filter((row) => row.status === 'ok').length,
          warning: rows.filter((row) => row.status === 'warning').length,
          fail: rows.filter((row) => row.status === 'fail').length,
        },
        recentRuns: rows.slice(0, 5).map((row) => ({
          status: row.status,
          summary: row.summary,
          createdAt: row.createdAt.toISOString(),
        })),
      },
    }

    if (webhookUrl && !shouldSkip) {
      await postSlackMessage(
        webhookUrl,
        buildDigestText({
          environment,
          rows,
          logsUrl: process.env.ANALYTICS_HEALTH_LOGS_URL ?? null,
        }),
      )

      await prisma.analyticsHealthAlertState.upsert({
        where: {
          environment,
        },
        create: {
          environment,
          lastStatus: output.status,
          lastSignature: digestSignature,
          lastAlertedAt: null,
          lastSummaryAt: existing?.lastSummaryAt ?? null,
          lastDigestAt: now,
          lastDigestSignature: digestSignature,
        },
        update: {
          lastStatus: output.status,
          lastDigestAt: now,
          lastDigestSignature: digestSignature,
        },
      })
    }

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(output))
    return output.status
  } finally {
    await prisma.$disconnect().catch(() => undefined)
  }
}

async function main() {
  const once = hasFlag('--once')
  const digest = hasFlag('--digest')
  const intervalMinutes = asNumber(
    readCliValue('--interval-minutes') ?? process.env.ANALYTICS_HEALTH_INTERVAL_MINUTES,
    15,
  )

  if (digest) {
    await runDigest()
    return
  }

  if (once) {
    const status = await runHealthOnce()
    process.exitCode = status === 'fail' ? 1 : 0
    return
  }

  // eslint-disable-next-line no-console
  console.log(`[analytics-health-monitor] starting with interval=${intervalMinutes}m`)
  while (true) {
    try {
      await runHealthOnce()
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[analytics-health-monitor] execution failed', error)
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMinutes * 60_000))
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[analytics-health-monitor] failed', error)
  process.exitCode = 1
})

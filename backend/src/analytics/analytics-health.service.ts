import { Injectable } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service'

type HealthCheckRecord = {
  name: string
  status: 'ok' | 'warning' | 'fail'
  severity?: 'info' | 'warning' | 'critical'
  details?: Record<string, unknown>
}

type HealthRow = {
  id: string
  status: string
  environment: string
  summary: string
  detailsJson: unknown
  durationMs: number
  createdAt: Date
}

type HealthRowView = {
  id: string
  status: string
  environment: string
  summary: string
  durationMs: number
  createdAt: string
  details: unknown
  checks: HealthCheckRecord[]
}

type HealthSnapshot = {
  status: 'ok' | 'warning' | 'fail'
  environment: string
  updatedAt: string | null
  summary: string
  degraded: boolean
  latest: HealthRowView | null
  history: HealthRowView[]
  lastChecks: HealthCheckRecord[]
  components: {
    ingestion: 'ok' | 'warning' | 'fail' | null
    sync: 'ok' | 'warning' | 'fail' | null
    queue: 'ok' | 'warning' | 'fail' | null
    attribution: 'ok' | 'warning' | 'fail' | null
    meta: 'ok' | 'warning' | 'fail' | null
    data_trust: 'ok' | 'warning' | 'fail' | null
    data_parity: 'ok' | 'warning' | 'fail' | null
    exports: 'ok' | 'warning' | 'fail' | null
  }
}

@Injectable()
export class AnalyticsHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealthOverview(limit = 20) {
    const snapshot = await this.buildSnapshot(limit)
    return {
      status: snapshot.status,
      environment: snapshot.environment,
      updatedAt: snapshot.updatedAt,
      summary: snapshot.summary,
      degraded: snapshot.degraded,
      latest: snapshot.latest,
      history: snapshot.history,
      lastChecks: snapshot.lastChecks,
      components: snapshot.components,
    }
  }

  async getHealthStatus() {
    const latest = await this.fetchLatestRow()
    return {
      status: this.normalizeStatus(latest?.status),
      updatedAt: latest?.createdAt ?? null,
      environment: latest?.environment ?? this.currentEnvironment(),
    }
  }

  async getHealthHistory(limit = 50) {
    return {
      history: await this.fetchRows(limit),
    }
  }

  async getHealthBadge() {
    const latest = await this.fetchLatestRow()
    return this.renderBadge(this.normalizeStatus(latest?.status))
  }

  private async buildSnapshot(limit: number): Promise<HealthSnapshot> {
    const normalizedLimit = Number.isFinite(limit) && limit > 0 ? limit : 20
    const rows = await this.fetchRows(Math.max(normalizedLimit, 50))
    const latest = rows[0] ?? null
    const latestChecks = latest?.checks ?? []

    return {
      status: this.normalizeStatus(latest?.status),
      environment: latest?.environment ?? this.currentEnvironment(),
      updatedAt: latest?.createdAt ?? null,
      summary: latest?.summary ?? 'No health checks recorded yet.',
      degraded: this.isDegraded(rows),
      latest,
      history: rows.slice(0, normalizedLimit),
      lastChecks: latestChecks,
      components: latest ? this.mapComponents(latest.details) : this.emptyComponents(),
    }
  }

  private async fetchRows(limit: number): Promise<HealthRowView[]> {
    const rows = (await this.prisma.analyticsHealthCheck.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: Number.isFinite(limit) && limit > 0 ? limit : 20,
    })) as HealthRow[]

    return rows.map((row) => this.mapRow(row))
  }

  private async fetchLatestRow(): Promise<HealthRowView | null> {
    const row = (await this.prisma.analyticsHealthCheck.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
    })) as HealthRow | null

    return row ? this.mapRow(row) : null
  }

  private currentEnvironment() {
    const value = String(process.env.RUNTIME_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV ?? '')
      .trim()
      .toLowerCase()
    if (value === 'production' || value === 'prod' || value === 'live') {
      return 'prod'
    }
    if (value === 'staging' || value === 'stage') {
      return 'staging'
    }
    if (value === 'dev' || value === 'development' || value === 'local') {
      return 'dev'
    }
    return value || 'unknown'
  }

  private normalizeStatus(value: string | null | undefined): 'ok' | 'warning' | 'fail' {
    if (value === 'ok' || value === 'warning' || value === 'fail') {
      return value
    }
    return 'warning'
  }

  private isDegraded(rows: HealthRowView[]) {
    const recentStatuses = rows.slice(0, 3).map((row) => row.status)
    const threeWarnings = recentStatuses.length === 3 && recentStatuses.every((status) => status === 'warning')
    if (threeWarnings) {
      return true
    }

    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const failCount = rows.filter(
      (row) => row.status === 'fail' && new Date(row.createdAt).getTime() >= oneHourAgo,
    ).length
    return failCount >= 2
  }

  private mapRow(row: HealthRow): HealthRowView {
    const details = this.normalizeDetails(row.detailsJson)
    return {
      id: row.id,
      status: this.normalizeStatus(row.status),
      environment: row.environment,
      summary: row.summary,
      durationMs: row.durationMs,
      createdAt: row.createdAt.toISOString(),
      details,
      checks: this.extractChecks(details),
    }
  }

  private normalizeDetails(details: unknown) {
    if (!details || typeof details !== 'object') {
      return {}
    }
    return details as Record<string, unknown>
  }

  private renderBadge(status: 'ok' | 'warning' | 'fail') {
    const label = 'analytics'
    const value = status
    const colors = {
      ok: '#059669',
      warning: '#d97706',
      fail: '#dc2626',
    } as const
    const width = 112
    const labelWidth = 72
    const valueWidth = width - labelWidth
    const color = colors[status]
    const ariaLabel = `analytics: ${status}`

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${ariaLabel}">
  <title>${ariaLabel}</title>
  <defs>
    <linearGradient id="s" x2="0" y2="100%">
      <stop offset="0" stop-color="#fff" stop-opacity=".18"/>
      <stop offset="1" stop-opacity=".18"/>
    </linearGradient>
    <mask id="m"><rect width="${width}" height="20" rx="4" fill="#fff"/></mask>
  </defs>
  <g mask="url(#m)">
    <rect width="${labelWidth}" height="20" fill="#111827"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Inter,Segoe UI,Helvetica,Arial,sans-serif" font-size="11">
    <text x="36" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>`
  }

  private emptyComponents(): HealthSnapshot['components'] {
    return {
      ingestion: null,
      sync: null,
      queue: null,
      attribution: null,
      meta: null,
      data_trust: null,
      data_parity: null,
      exports: null,
    }
  }

  private mapComponents(details: unknown): HealthSnapshot['components'] {
    const records = this.extractChecks(details)
    const pick = (...patterns: RegExp[]): 'ok' | 'warning' | 'fail' | null => {
      const matches = records.filter((record) => patterns.some((pattern) => pattern.test(record.name)))
      if (!matches.length) {
        return null
      }
      if (matches.some((check) => check.status === 'fail')) {
        return 'fail'
      }
      if (matches.some((check) => check.status === 'warning')) {
        return 'warning'
      }
      return 'ok'
    }

    return {
      ingestion: pick(/event_ingestion|attribution_coverage|cross_source_consistency/iu),
      sync: pick(/sync|worker_health|queue_health/iu),
      queue: pick(/redis_health|queue_health|worker_health/iu),
      attribution: pick(/attribution_coverage|cross_source_consistency/iu),
      meta: pick(/meta_delivery/iu),
      data_trust: pick(/data_trust|trust|conversion_presence|traffic_drop/iu),
      data_parity: pick(/data_parity|baseline_parity|parity_check/iu),
      exports: pick(/export_history|export_runs|export_run/iu),
    }
  }

  private extractChecks(details: unknown): HealthCheckRecord[] {
    if (!details || typeof details !== 'object') {
      return []
    }
    const checks = (details as { checks?: unknown }).checks
    if (!Array.isArray(checks)) {
      return []
    }
    return checks
      .filter((check): check is HealthCheckRecord => Boolean(check) && typeof check === 'object')
      .map((check) => ({
        name: typeof check.name === 'string' ? check.name : 'unknown',
        status:
          check.status === 'ok' || check.status === 'warning' || check.status === 'fail'
            ? check.status
            : 'warning',
        severity:
          check.severity === 'info' || check.severity === 'warning' || check.severity === 'critical'
            ? check.severity
            : 'info',
        details:
          check.details && typeof check.details === 'object' ? (check.details as Record<string, unknown>) : {},
      }))
  }
}

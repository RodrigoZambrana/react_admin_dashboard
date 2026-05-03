import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import {
  normalizeAnalyticsEventCategory,
  normalizeAnalyticsEventSource,
  normalizeAnalyticsEventName,
  normalizeAnalyticsMeasurementStatus,
} from './event-taxonomy'
import type {
  AnalyticsAdsDailyMetric,
  AnalyticsAiInsight,
  AnalyticsAiInsightRun,
  AnalyticsConnection,
  AnalyticsConnectionHealth,
  AnalyticsConnectionSource,
  AnalyticsInsight,
  AnalyticsInsightHistory,
  AnalyticsBaselineSnapshot,
  AnalyticsBaselineCheck,
  AnalyticsDataAnomaly,
  AnalyticsEventComparison,
  AnalyticsEventComparisonSummary,
  AnalyticsExportRun,
  AnalyticsDataParityCheck,
  AnalyticsDataParityStatus,
  AnalyticsDataQualityCheck,
  AnalyticsDataQualityStatus,
  AnalyticsEventInput,
  AnalyticsReportingDailyMetric,
  AnalyticsSearchConsoleDailyMetric,
  AnalyticsReportCatalogEntry,
  AnalyticsReportDataSource,
  AnalyticsReportReconciliation,
  AnalyticsReportRow,
  AnalyticsReportRun,
  AnalyticsReportRunSource,
  AnalyticsReportReconciliationStatus,
  AnalyticsSyncRun,
  AnalyticsEndpointUsage,
  AnalyticsUsageEvent,
} from './analytics.types'

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const asNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const extractEventId = (input: AnalyticsEventInput) => {
  const data = input.data ?? {}
  return (
    asString(input.event_id) ??
    asString((data as Record<string, unknown>).event_id) ??
    asString((data as Record<string, unknown>).eventId)
  )
}

const extractFbp = (input: AnalyticsEventInput) => {
  const data = input.data ?? {}
  return asString(input.fbp) ?? asString((data as Record<string, unknown>).fbp)
}

const extractFbc = (input: AnalyticsEventInput) => {
  const data = input.data ?? {}
  return asString(input.fbc) ?? asString((data as Record<string, unknown>).fbc)
}

const extractExternalTargets = (input: AnalyticsEventInput) => {
  const data = input.data ?? {}
  const fromInput = input.external_targets ?? (data as Record<string, unknown>).external_targets
  if (!Array.isArray(fromInput)) {
    return null
  }
  return fromInput
    .map((value) => asString(value))
    .filter((value): value is string => Boolean(value))
}

@Injectable()
export class AnalyticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get analyticsPrisma() {
    return this.prisma as PrismaService & {
      analyticsConnection: {
        findMany: (args?: unknown) => Promise<any[]>
        findFirst: (args?: unknown) => Promise<any | null>
        findUnique: (args?: unknown) => Promise<any | null>
        create: (args?: unknown) => Promise<any>
        update: (args?: unknown) => Promise<any>
        upsert: (args?: unknown) => Promise<any>
      }
      analyticsConnectionCredential: {
        findUnique: (args?: unknown) => Promise<any | null>
        upsert: (args?: unknown) => Promise<any>
        delete: (args?: unknown) => Promise<any>
      }
      analyticsInsight: { findMany: (args?: unknown) => Promise<any[]> }
      analyticsInsightHistory: {
        create: (args?: unknown) => Promise<any>
        createMany: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
      }
      analyticsAiInsightRun: {
        create: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
      }
      analyticsGa4DailyMetric: {
        upsert: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
      }
      analyticsAdsDailyMetric: {
        upsert: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
      }
      analyticsSearchConsoleDailyMetric: {
        upsert: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
      }
      analyticsReportingDaily: {
        upsert: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
      }
      analyticsReportCatalog: {
        findMany: (args?: unknown) => Promise<any[]>
        findUnique: (args?: unknown) => Promise<any | null>
        upsert: (args?: unknown) => Promise<any>
      }
      analyticsReportRun: {
        create: (args?: unknown) => Promise<any>
        update: (args?: unknown) => Promise<any>
        findFirst: (args?: unknown) => Promise<any | null>
        findMany: (args?: unknown) => Promise<any[]>
      }
      analyticsReportRow: {
        createMany: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
      }
      analyticsReportReconciliation: {
        create: (args?: unknown) => Promise<any>
        upsert: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
      }
      analyticsBaselineSnapshot: {
        create: (args?: unknown) => Promise<any>
        upsert: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
        findFirst: (args?: unknown) => Promise<any | null>
      }
      analyticsDataParityCheck: {
        create: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
        findFirst: (args?: unknown) => Promise<any | null>
      }
      analyticsUsageEvent: {
        create: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
      }
      analyticsEndpointUsage: {
        create: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
        count: (args?: unknown) => Promise<number>
      }
      analyticsBaselineCheck: {
        create: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
        count: (args?: unknown) => Promise<number>
      }
      analyticsDataAnomaly: {
        create: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
      }
      analyticsExportRun: {
        create: (args?: unknown) => Promise<any>
        update: (args?: unknown) => Promise<any>
        findUnique: (args?: unknown) => Promise<any | null>
        findMany: (args?: unknown) => Promise<any[]>
        count: (args?: unknown) => Promise<number>
      }
      analyticsDataQualityCheck: {
        create: (args?: unknown) => Promise<any>
        upsert: (args?: unknown) => Promise<any>
        findMany: (args?: unknown) => Promise<any[]>
        findFirst: (args?: unknown) => Promise<any | null>
      }
      analyticsSyncRun: {
        create: (args?: unknown) => Promise<any>
        update: (args?: unknown) => Promise<any>
        findFirst: (args?: unknown) => Promise<any | null>
        findMany: (args?: unknown) => Promise<any[]>
        findUnique: (args?: unknown) => Promise<any | null>
      }
    }
  }

  private mapReportCatalog(entry: any): AnalyticsReportCatalogEntry {
    return {
      key: entry.key,
      source: entry.source,
      title: entry.title,
      description: entry.description ?? null,
      baselineHeader: entry.baselineHeader,
      baselineTitle: entry.baselineTitle ?? null,
      equivalenceStatus: entry.equivalenceStatus,
      rowKeyStrategy: entry.rowKeyStrategy,
      dimensionLabels: entry.dimensionLabels ?? [],
      metricLabels: entry.metricLabels ?? [],
      apiDefinition: entry.apiDefinition ?? null,
      notes: entry.notes ?? null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    }
  }

  private mapReportRun(run: any): AnalyticsReportRun {
    return {
      id: run.id,
      reportKey: run.reportKey,
      source: run.source as AnalyticsReportRunSource,
      status: run.status as AnalyticsReportRun['status'],
      fromDate: run.fromDate?.toISOString() ?? null,
      toDate: run.toDate?.toISOString() ?? null,
      rowCount: run.rowCount,
      errorMessage: run.errorMessage ?? null,
      metadata: (run.metadata as Record<string, unknown>) ?? null,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      createdAt: run.createdAt.toISOString(),
    }
  }

  private mapReportRow(row: any): AnalyticsReportRow {
    return {
      id: row.id.toString(),
      reportRunId: row.reportRunId,
      reportKey: row.reportKey,
      source: row.source as AnalyticsReportDataSource,
      rowType: row.rowType,
      rowIndex: row.rowIndex,
      rowKey: row.rowKey,
      dimensions: (row.dimensions as Record<string, unknown>) ?? {},
      metrics: (row.metrics as Record<string, unknown>) ?? {},
      raw: (row.raw as Record<string, unknown>) ?? {},
      createdAt: row.createdAt.toISOString(),
    }
  }

  private mapReportReconciliation(entry: any): AnalyticsReportReconciliation {
    return {
      id: entry.id,
      reportKey: entry.reportKey,
      baselineRunId: entry.baselineRunId ?? null,
      syncRunId: entry.syncRunId ?? null,
      status: entry.status as AnalyticsReportReconciliationStatus,
      baselineRowCount: entry.baselineRowCount,
      syncRowCount: entry.syncRowCount,
      matchedRowCount: entry.matchedRowCount,
      baselineOnlyRowCount: entry.baselineOnlyRowCount,
      syncOnlyRowCount: entry.syncOnlyRowCount,
      deltaPercent: Number(entry.deltaPercent.toString()),
      summary: entry.summary,
      evidence: (entry.evidence as Record<string, unknown>) ?? null,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    }
  }

  private mapConnection(connection: any): AnalyticsConnection {
    const lastSuccessfulSyncAt = connection.lastSuccessfulSyncAt ?? connection.lastSyncedAt ?? null
    const nextSyncAt = connection.nextSyncAt ?? null
    const lagMinutes =
      nextSyncAt instanceof Date
        ? Math.max(0, Math.floor((Date.now() - nextSyncAt.getTime()) / 60000))
        : null

    return {
      id: connection.id,
      source: connection.source as AnalyticsConnection['source'],
      status: connection.status as AnalyticsConnection['status'],
      target: {
        id: connection.externalAccountId ?? connection.externalPropertyId ?? null,
        name: connection.displayName,
      },
      lastSyncAt: lastSuccessfulSyncAt?.toISOString() ?? null,
      nextSyncAt: nextSyncAt?.toISOString() ?? null,
      needsReauth: connection.needsReauth,
      health: {
        lagMinutes,
        lastAttemptedSyncAt: connection.lastAttemptedSyncAt?.toISOString() ?? null,
        lastSuccessfulSyncAt: lastSuccessfulSyncAt?.toISOString() ?? null,
        lastErrorMessage: connection.lastSyncErrorMessage ?? null,
        lastErrorAt: connection.lastSyncErrorAt?.toISOString() ?? null,
      } satisfies AnalyticsConnectionHealth,
    }
  }

  private mapSyncRun(run: any): AnalyticsSyncRun {
    return {
      id: run.id,
      connectionId: run.connectionId,
      jobType: run.jobType as AnalyticsSyncRun['jobType'],
      fromDate: run.fromDate?.toISOString() ?? null,
      toDate: run.toDate?.toISOString() ?? null,
      status: run.status as AnalyticsSyncRun['status'],
      queuedAt: run.queuedAt?.toISOString() ?? null,
      retryCount: run.retryCount ?? 0,
      partialFailureFlag: run.partialFailureFlag ?? false,
      durationMs: run.durationMs ?? null,
      recordsFetched: run.recordsFetched,
      recordsUpserted: run.recordsUpserted,
      errorMessage: run.errorMessage ?? null,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      createdAt: run.createdAt.toISOString(),
    }
  }

  private mapInsight(insight: any): AnalyticsInsight {
    return {
      id: insight.id,
      source: insight.source,
      metric: insight.metric,
      dimension: insight.dimension ?? null,
      title: insight.title,
      description: insight.description,
      recommendation: insight.recommendation,
      impact: insight.impact as AnalyticsInsight['impact'],
      confidence: Number(insight.confidence.toString()),
      evidence: (insight.evidence as Record<string, unknown>) ?? {},
      createdAt: insight.createdAt.toISOString(),
      resolvedAt: insight.resolvedAt?.toISOString() ?? null,
      status: insight.status as AnalyticsInsight['status'],
    }
  }

  private mapInsightHistory(entry: any): AnalyticsInsightHistory {
    return {
      id: entry.id,
      date: entry.date.toISOString(),
      insightType: entry.insightType,
      title: entry.title,
      description: entry.description,
      impact: entry.impact,
      recommendation: entry.recommendation,
      confidence: Number(entry.confidence.toString()),
      evidence: (entry.evidence as Record<string, unknown>) ?? {},
      sourceReport: entry.sourceReport ?? null,
      periodRange: (entry.periodRange as AnalyticsInsightHistory['periodRange']) ?? {
        current: { from: entry.date.toISOString(), to: entry.date.toISOString() },
        previous: { from: entry.date.toISOString(), to: entry.date.toISOString() },
      },
      score: Number(entry.score.toString()),
      summary: entry.summary ?? null,
      createdAt: entry.createdAt.toISOString(),
    }
  }

  private mapAiInsightRun(entry: any): AnalyticsAiInsightRun {
    return {
      id: entry.id,
      date: entry.date.toISOString(),
      summary: entry.summary,
      insightsJson: (entry.insightsJson as AnalyticsAiInsightRun['insightsJson']) ?? [],
      actionsJson: (entry.actionsJson as AnalyticsAiInsightRun['actionsJson']) ?? [],
      confidence: Number(entry.confidence.toString()),
      bundleJson: (entry.bundleJson as AnalyticsAiInsightRun['bundleJson']) ?? {},
      responseJson: (entry.responseJson as AnalyticsAiInsightRun['responseJson']) ?? {},
      createdAt: entry.createdAt.toISOString(),
    }
  }

  private mapReportingDailyMetric(row: any): AnalyticsReportingDailyMetric {
    return {
      id: row.id.toString(),
      date: row.date.toISOString(),
      channel: row.channel,
      source: row.source ?? null,
      medium: row.medium ?? null,
      campaign: row.campaign ?? null,
      productId: row.productId ?? null,
      landingPage: row.landingPage ?? null,
      device: row.device ?? null,
      country: row.country ?? null,
      sessions: row.sessions,
      users: row.users,
      revenue: Number(row.revenue.toString()),
      orders: row.orders,
      cost: Number(row.cost.toString()),
      impressions: row.impressions,
      clicks: row.clicks,
      views: row.views,
      addToCart: row.addToCart,
      eventCount: row.eventCount,
      keyEvents: row.keyEvents,
      ga4PurchaseProxy: row.ga4PurchaseProxy,
      purchase: row.purchase,
      createdAt: row.createdAt.toISOString(),
    }
  }

  private mapAdsDailyMetric(row: any): AnalyticsAdsDailyMetric {
    return {
      id: row.id.toString(),
      date: row.date.toISOString(),
      campaign: row.campaign,
      clicks: row.clicks,
      impressions: row.impressions,
      cost: Number(row.cost.toString()),
      conversions: row.conversions,
      conversionValue: Number(row.conversionValue.toString()),
      hasConversionData: row.hasConversionData,
      connectionId: row.connectionId ?? null,
      syncRunId: row.syncRunId ?? null,
      createdAt: row.createdAt.toISOString(),
    }
  }

  private mapSearchConsoleDailyMetric(row: any): AnalyticsSearchConsoleDailyMetric {
    return {
      id: row.id.toString(),
      date: row.date.toISOString(),
      query: row.query,
      page: row.page ?? null,
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: Number(row.ctr.toString()),
      position: Number(row.position.toString()),
      connectionId: row.connectionId ?? null,
      syncRunId: row.syncRunId ?? null,
      createdAt: row.createdAt.toISOString(),
    }
  }

  private mapBaselineSnapshot(snapshot: any): AnalyticsBaselineSnapshot {
    return {
      id: snapshot.id,
      connectionId: snapshot.connectionId ?? null,
      source: snapshot.source as AnalyticsBaselineSnapshot['source'],
      reportKey: snapshot.reportKey,
      date: snapshot.date.toISOString(),
      metricName: snapshot.metricName,
      dimensionHash: snapshot.dimensionHash,
      dimensionValues: (snapshot.dimensionValues as Record<string, unknown>) ?? null,
      value: Number(snapshot.value.toString()),
      queryHash: snapshot.queryHash,
      origin: snapshot.origin ?? 'api',
      snapshotGroup: snapshot.snapshotGroup ?? '',
      raw: (snapshot.raw as Record<string, unknown>) ?? null,
      createdAt: snapshot.createdAt.toISOString(),
    }
  }

  private mapDataParityCheck(check: any): {
    id: string
    source: AnalyticsDataParityCheck['source']
    metric: string
    dateFrom: string
    dateTo: string
    apiValue: number
    baselineValue: number
    deltaAbs: number
    deltaPercent: number
    status: AnalyticsDataParityStatus
    snapshotGroup: string
    createdAt: string
  } {
    return {
      id: check.id,
      source: check.source as AnalyticsDataParityCheck['source'],
      metric: check.metric,
      dateFrom: check.dateFrom.toISOString(),
      dateTo: check.dateTo.toISOString(),
      apiValue: Number(check.apiValue.toString()),
      baselineValue: Number(check.baselineValue.toString()),
      deltaAbs: Number(check.deltaAbs.toString()),
      deltaPercent: Number(check.deltaPercent.toString()),
      status: check.status as AnalyticsDataParityStatus,
      snapshotGroup: check.snapshotGroup ?? '',
      createdAt: check.createdAt.toISOString(),
    }
  }

  private mapUsageEvent(event: any): AnalyticsUsageEvent {
    return {
      id: event.id,
      endpoint: event.endpoint,
      userId: event.userId ?? null,
      timeRange: event.timeRange,
      filters: (event.filters as Record<string, unknown>) ?? null,
      responseTimeMs: event.responseTimeMs,
      responseSize: event.responseSize,
      trustLevel: event.trustLevel,
      hasData: event.hasData,
      createdAt: event.createdAt.toISOString(),
    }
  }

  private mapEndpointUsage(event: any): AnalyticsEndpointUsage {
    return {
      id: event.id,
      endpoint: event.endpoint,
      userId: event.userId ?? null,
      statusCode: event.statusCode,
      durationMs: event.durationMs,
      createdAt: event.createdAt.toISOString(),
    }
  }

  private mapBaselineCheck(check: any): AnalyticsBaselineCheck {
    return {
      id: check.id,
      date: check.date.toISOString(),
      source: check.source as AnalyticsBaselineCheck['source'],
      metric: check.metric,
      comparisonKind: check.comparisonKind as AnalyticsBaselineCheck['comparisonKind'],
      expectedValue: Number(check.expectedValue.toString()),
      actualValue: Number(check.actualValue.toString()),
      diffPct: Number(check.diffPct.toString()),
      status: check.status as AnalyticsBaselineCheck['status'],
      snapshotGroup: check.snapshotGroup,
      createdAt: check.createdAt.toISOString(),
    }
  }

  private mapDataAnomaly(anomaly: any): AnalyticsDataAnomaly {
    return {
      id: anomaly.id,
      type: anomaly.type,
      source: anomaly.source,
      metric: anomaly.metric ?? null,
      description: anomaly.description,
      severity: anomaly.severity,
      detectedAt: anomaly.detectedAt.toISOString(),
    }
  }

  private mapEventComparison(comparison: any): AnalyticsEventComparison {
    return {
      id: comparison.id,
      tenantId: comparison.tenantId,
      eventId: comparison.eventId,
      eventName: comparison.eventName,
      directEventTimestamp: comparison.directEventTimestamp?.toISOString() ?? null,
      gaEventTimestamp: comparison.gaEventTimestamp?.toISOString() ?? null,
      existsInDirect: comparison.existsInDirect,
      existsInGa: comparison.existsInGa,
      payloadMatch: comparison.payloadMatch,
      timeDiffMs: comparison.timeDiffMs ?? null,
      status: comparison.status,
      directSource: comparison.directSource ?? null,
      gaSource: comparison.gaSource ?? null,
      comparisonDate: comparison.comparisonDate?.toISOString() ?? null,
      directPayload: (comparison.directPayload as Record<string, unknown>) ?? null,
      gaPayload: (comparison.gaPayload as Record<string, unknown>) ?? null,
      createdAt: comparison.createdAt.toISOString(),
      updatedAt: comparison.updatedAt.toISOString(),
    }
  }

  private mapExportRun(run: any): AnalyticsExportRun {
    return {
      id: run.id,
      exportType: run.exportType,
      source: run.source ?? null,
      dateFrom: run.dateFrom.toISOString(),
      dateTo: run.dateTo.toISOString(),
      filters: (run.filters as Record<string, unknown>) ?? null,
      rowCount: run.rowCount ?? null,
      fileFormat: run.fileFormat,
      status: run.status,
      errorMessage: run.errorMessage ?? null,
      durationMs: run.durationMs ?? null,
      fileSize: run.fileSize ?? null,
      createdAt: run.createdAt.toISOString(),
    }
  }

  private mapDataQualityCheck(check: any): AnalyticsDataQualityCheck {
    return {
      id: check.id,
      connectionId: check.connectionId,
      reportKey: check.reportKey,
      date: check.date.toISOString(),
      metricName: check.metricName,
      dimensionHash: check.dimensionHash,
      baselineValue: Number(check.baselineValue.toString()),
      syncedValue: Number(check.syncedValue.toString()),
      diff: Number(check.diff.toString()),
      diffPercent: Number(check.diffPercent.toString()),
      status: check.status as AnalyticsDataQualityCheck['status'],
      baselineSnapshotId: check.baselineSnapshotId ?? null,
      syncRunId: check.syncRunId ?? null,
      queryHash: check.queryHash,
      createdAt: check.createdAt.toISOString(),
    }
  }

  async findConnectionBySource(source: string) {
    return this.analyticsPrisma.analyticsConnection.findFirst({
      where: { source },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findConnectionById(id: string) {
    return this.analyticsPrisma.analyticsConnection.findUnique({
      where: { id },
    })
  }

  async createConnection(input: {
    source: AnalyticsConnectionSource
    displayName: string
    status?: string
    needsReauth?: boolean
  }) {
    return this.analyticsPrisma.analyticsConnection.create({
      data: {
        source: input.source,
        displayName: input.displayName,
        status: input.status ?? 'needs_auth',
        needsReauth: input.needsReauth ?? false,
      },
    })
  }

  async createGa4Connection(input: {
    displayName: string
    status?: string
    needsReauth?: boolean
  }) {
    return this.createConnection({
      source: 'ga4',
      displayName: input.displayName,
      status: input.status,
      needsReauth: input.needsReauth,
    })
  }

  async createAdsConnection(input: {
    displayName: string
    status?: string
    needsReauth?: boolean
  }) {
    return this.createConnection({
      source: 'ads',
      displayName: input.displayName,
      status: input.status,
      needsReauth: input.needsReauth,
    })
  }

  async createSearchConsoleConnection(input: {
    displayName: string
    status?: string
    needsReauth?: boolean
  }) {
    return this.createConnection({
      source: 'search_console',
      displayName: input.displayName,
      status: input.status,
      needsReauth: input.needsReauth,
    })
  }

  async updateConnection(
    connectionId: string,
    data: Partial<{
      status: string
      displayName: string
      externalAccountId: string | null
      externalPropertyId: string | null
      syncIntervalMinutes: number
      lastAttemptedSyncAt: Date | null
      lastSyncedAt: Date | null
      lastSuccessfulSyncAt: Date | null
      lastSyncErrorMessage: string | null
      lastSyncErrorAt: Date | null
      nextSyncAt: Date | null
      needsReauth: boolean
    }>,
  ) {
    return this.analyticsPrisma.analyticsConnection.update({
      where: { id: connectionId },
      data,
    })
  }

  async upsertConnectionCredentials(
    connectionId: string,
    data: {
      refreshTokenEncrypted: string | null
      accessTokenEncrypted: string | null
      expiresAt: Date | null
      scopes: string[]
    },
  ) {
    return this.analyticsPrisma.analyticsConnectionCredential.upsert({
      where: { connectionId },
      update: {
        refreshTokenEncrypted: data.refreshTokenEncrypted,
        accessTokenEncrypted: data.accessTokenEncrypted,
        expiresAt: data.expiresAt,
        scopes: data.scopes,
      },
      create: {
        connectionId,
        refreshTokenEncrypted: data.refreshTokenEncrypted,
        accessTokenEncrypted: data.accessTokenEncrypted,
        expiresAt: data.expiresAt,
        scopes: data.scopes,
      },
    })
  }

  async getConnectionCredentials(connectionId: string) {
    return this.analyticsPrisma.analyticsConnectionCredential.findUnique({
      where: { connectionId },
    })
  }

  async createSyncRun(input: {
    connectionId: string
    jobType: string
    fromDate?: Date | null
    toDate?: Date | null
    status?: string
    queuedAt?: Date | null
    retryCount?: number
    partialFailureFlag?: boolean
  }) {
    return this.analyticsPrisma.analyticsSyncRun.create({
      data: {
        connectionId: input.connectionId,
        jobType: input.jobType,
        fromDate: input.fromDate ?? null,
        toDate: input.toDate ?? null,
        status: input.status ?? 'running',
        queuedAt: input.queuedAt ?? null,
        retryCount: input.retryCount ?? 0,
        partialFailureFlag: input.partialFailureFlag ?? false,
      },
    })
  }

  async findSyncRunById(syncRunId: string) {
    const run = await this.analyticsPrisma.analyticsSyncRun.findUnique({
      where: { id: syncRunId },
    })
    return run ? this.mapSyncRun(run) : null
  }

  async hasActiveSyncRun(connectionId: string) {
    const run = await this.analyticsPrisma.analyticsSyncRun.findFirst({
      where: {
        connectionId,
        status: {
          in: ['pending', 'running'],
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      select: {
        id: true,
      },
    })
    return Boolean(run)
  }

  async updateSyncRun(
    syncRunId: string,
    data: Partial<{
      status: string
      queuedAt: Date | null
      retryCount: number
      partialFailureFlag: boolean
      durationMs: number | null
      startedAt: Date | null
      recordsFetched: number
      recordsUpserted: number
      errorMessage: string | null
      finishedAt: Date | null
      fromDate: Date | null
      toDate: Date | null
    }>,
  ) {
    return this.analyticsPrisma.analyticsSyncRun.update({
      where: { id: syncRunId },
      data,
    })
  }

  async upsertGa4DailyMetric(input: {
    date: Date
    source: string
    medium: string
    campaign: string
    sessions: number
    users: number
    eventCount: number
    keyEvents: number
    purchases: number
    revenue: number
    connectionId: string | null
    syncRunId: string | null
  }) {
    return this.analyticsPrisma.analyticsGa4DailyMetric.upsert({
      where: {
        date_source_medium_campaign: {
          date: input.date,
          source: input.source,
          medium: input.medium,
          campaign: input.campaign,
        },
      },
      update: {
        sessions: input.sessions,
        users: input.users,
        eventCount: input.eventCount,
        keyEvents: input.keyEvents,
        purchases: input.purchases,
        revenue: input.revenue,
        connectionId: input.connectionId,
        syncRunId: input.syncRunId,
      },
      create: {
        date: input.date,
        source: input.source,
        medium: input.medium,
        campaign: input.campaign,
        sessions: input.sessions,
        users: input.users,
        eventCount: input.eventCount,
        keyEvents: input.keyEvents,
        purchases: input.purchases,
        revenue: input.revenue,
        connectionId: input.connectionId,
        syncRunId: input.syncRunId,
      },
    })
  }

  async upsertAdsDailyMetric(input: {
    date: Date
    campaign: string
    clicks: number
    impressions: number
    cost: number
    conversions: number
    conversionValue: number
    hasConversionData: boolean
    connectionId: string | null
    syncRunId: string | null
  }) {
    return this.analyticsPrisma.analyticsAdsDailyMetric.upsert({
      where: {
        date_campaign: {
          date: input.date,
          campaign: input.campaign,
        },
      },
      update: {
        clicks: input.clicks,
        impressions: input.impressions,
        cost: input.cost,
        conversions: input.conversions,
        conversionValue: input.conversionValue,
        hasConversionData: input.hasConversionData,
        connectionId: input.connectionId,
        syncRunId: input.syncRunId,
      },
      create: {
        date: input.date,
        campaign: input.campaign,
        clicks: input.clicks,
        impressions: input.impressions,
        cost: input.cost,
        conversions: input.conversions,
        conversionValue: input.conversionValue,
        hasConversionData: input.hasConversionData,
        connectionId: input.connectionId,
        syncRunId: input.syncRunId,
      },
    })
  }

  async upsertSearchConsoleDailyMetric(input: {
    date: Date
    query: string
    page: string | null
    clicks: number
    impressions: number
    ctr: number
    position: number
    connectionId?: string | null
    syncRunId?: string | null
  }) {
    return this.analyticsPrisma.analyticsSearchConsoleDailyMetric.upsert({
      where: {
        date_query_page: {
          date: input.date,
          query: input.query,
          page: input.page,
        },
      },
      update: {
        clicks: input.clicks,
        impressions: input.impressions,
        ctr: input.ctr,
        position: input.position,
        connectionId: input.connectionId ?? null,
        syncRunId: input.syncRunId ?? null,
      },
      create: {
        date: input.date,
        query: input.query,
        page: input.page,
        clicks: input.clicks,
        impressions: input.impressions,
        ctr: input.ctr,
        position: input.position,
        connectionId: input.connectionId ?? null,
        syncRunId: input.syncRunId ?? null,
      },
    })
  }

  async upsertReportingDaily(input: {
    date: Date
    channel: string
    source: string
    medium: string
    campaign: string
    productId: string
    landingPage: string
    device: string
    country: string
    sessions: number
    users: number
    revenue: number
    orders: number
    cost: number
    impressions: number
    clicks: number
    views: number
    addToCart: number
    eventCount: number
    keyEvents: number
    ga4PurchaseProxy: number
    purchase: number
  }) {
    return this.analyticsPrisma.analyticsReportingDaily.upsert({
      where: {
        date_channel_source_medium_campaign_productId_landingPage_device_country: {
          date: input.date,
          channel: input.channel,
          source: input.source,
          medium: input.medium,
          campaign: input.campaign,
          productId: input.productId,
          landingPage: input.landingPage,
          device: input.device,
          country: input.country,
        },
      },
      update: {
        sessions: input.sessions,
        users: input.users,
        revenue: input.revenue,
        orders: input.orders,
        cost: input.cost,
        impressions: input.impressions,
        clicks: input.clicks,
        views: input.views,
        addToCart: input.addToCart,
        eventCount: input.eventCount,
        keyEvents: input.keyEvents,
        ga4PurchaseProxy: input.ga4PurchaseProxy,
        purchase: input.purchase,
      },
      create: {
        date: input.date,
        channel: input.channel,
        source: input.source,
        medium: input.medium,
        campaign: input.campaign,
        productId: input.productId,
        landingPage: input.landingPage,
        device: input.device,
        country: input.country,
        sessions: input.sessions,
        users: input.users,
        revenue: input.revenue,
        orders: input.orders,
        cost: input.cost,
        impressions: input.impressions,
        clicks: input.clicks,
        views: input.views,
        addToCart: input.addToCart,
        eventCount: input.eventCount,
        keyEvents: input.keyEvents,
        ga4PurchaseProxy: input.ga4PurchaseProxy,
        purchase: input.purchase,
      },
    })
  }

  async saveEvent(input: AnalyticsEventInput) {
    const eventName = normalizeAnalyticsEventName(input.event) ?? 'unknown_event'
    const payload = JSON.parse(
      JSON.stringify({
        ...input,
        event: eventName,
        event_name: eventName,
      }),
    ) as Prisma.InputJsonValue
    const structuralPayload = (input.data as Record<string, unknown> | undefined) ?? {}
    const category = normalizeAnalyticsEventCategory(
      input.category ?? input.eventCategory ?? (payload as Record<string, unknown>).category,
      eventName,
    )
    const source = normalizeAnalyticsEventSource(input.source ?? (payload as Record<string, unknown>).source)
    const measurementStatus = normalizeAnalyticsMeasurementStatus(
      input.measurement_status ?? input.measurementStatus ?? (payload as Record<string, unknown>).measurement_status,
      category,
    )
    const eventId = extractEventId(input)
    const fbp = extractFbp(input)
    const fbc = extractFbc(input)
    const externalTargets = extractExternalTargets(input)
    const tenantId =
      asString(input.tenant_id) ??
      asString(structuralPayload.tenant_id)
    if (!tenantId) {
      throw new Error('Missing tenant_id for structural analytics event persistence')
    }
    const schemaVersion =
      Number(input.schema_version ?? structuralPayload.schema_version ?? 1)
    const pageType = asString(input.page_type) ?? asString(structuralPayload.page_type)
    const componentType = asString(input.component_type) ?? asString(structuralPayload.component_type)
    const componentId = asString(input.component_id) ?? asString(structuralPayload.component_id)
    const ctaId = asString(input.cta_id) ?? asString(structuralPayload.cta_id)
    const ctaName = asString(input.cta_name) ?? asString(structuralPayload.cta_name)
    const ctaType = asString(input.cta_type) ?? asString(structuralPayload.cta_type)
    const ctaContext = asString(input.cta_context) ?? asString(structuralPayload.cta_context)
    const ctaLocation = asString(input.cta_location) ?? asString(structuralPayload.cta_location)
    const position =
      typeof input.position === 'number' && Number.isFinite(input.position)
        ? input.position
        : asNumber(structuralPayload.position)
    return this.prisma.analyticsEvent.create({
      data: {
        tenantId,
        schemaVersion: Number.isFinite(schemaVersion) && schemaVersion > 0 ? schemaVersion : 1,
        ingestionSource: 'direct',
        ingestionPath: 'frontend_api',
        eventName,
        eventCategory: category,
        pageType,
        componentType,
        componentId,
        ctaId,
        ctaName,
        ctaType,
        ctaContext,
        ctaLocation,
        position: position !== null && position !== undefined ? new Prisma.Decimal(position) : null,
        source,
        measurementStatus,
        conversionFlag: category === 'conversion',
        eventId,
        sessionId: input.session_id,
        fbp,
        fbc,
        externalTargets: externalTargets ? (externalTargets as Prisma.InputJsonValue) : null,
        metaSentAt: null,
        metaEventId: null,
        metaStatus: null,
        url: input.url,
        userAgent: input.user_agent,
        referrer: input.referrer ?? null,
        correlationId: input.correlation_id ?? null,
        userId: input.user_id ?? null,
        timestamp: new Date(input.timestamp),
        payload,
      } as Prisma.AnalyticsEventCreateInput,
    })
  }

  async updateEventMetaDelivery(
    id: string,
    input: {
      metaStatus: string | null
      metaEventId: string | null
      metaSentAt: Date | null
      externalTargets?: Prisma.InputJsonValue | null
    },
  ) {
    return this.prisma.analyticsEvent.update({
      where: { id },
      data: {
        externalTargets: input.externalTargets ?? undefined,
        metaStatus: input.metaStatus,
        metaEventId: input.metaEventId,
        metaSentAt: input.metaSentAt,
      },
    })
  }

  async listEvents(from: Date, to: Date, eventNames?: string[], tenantId?: string) {
    return this.prisma.analyticsEvent.findMany({
      where: {
        timestamp: {
          gte: from,
          lte: to,
        },
        ...(tenantId
          ? {
              tenantId,
            }
          : {}),
        ...(eventNames && eventNames.length
          ? {
              eventName: {
                in: eventNames,
              },
            }
          : {}),
      },
      orderBy: {
        timestamp: 'asc',
      },
    })
  }

  async listUnprocessedEvents(limit = 1000) {
    return this.prisma.analyticsEvent.findMany({
      where: {
        processed: false,
      },
      orderBy: {
        timestamp: 'asc',
      },
      take: limit,
    })
  }

  async listEventsInRange(from: Date, to: Date, limit = 1000, cursorId?: string) {
    return this.prisma.analyticsEvent.findMany({
      where: {
        timestamp: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
      take: limit,
    })
  }

  async markEventsProcessed(ids: string[], processedAt = new Date()) {
    if (!ids.length) {
      return { count: 0 }
    }

    return this.prisma.analyticsEvent.updateMany({
      where: {
        id: {
          in: ids,
        },
      },
      data: {
        processed: true,
        processedAt,
      },
    })
  }

  async upsertSession(input: {
    id: string
    firstSeen: Date
    lastSeen: Date
    utmSource?: string | null
    utmMedium?: string | null
    utmCampaign?: string | null
    referrer?: string | null
  }) {
    const existing = await this.prisma.analyticsSession.findUnique({
      where: {
        id: input.id,
      },
    })

    if (!existing) {
      return this.prisma.analyticsSession.create({
        data: {
          id: input.id,
          firstSeen: input.firstSeen,
          lastSeen: input.lastSeen,
          utmSource: input.utmSource ?? null,
          utmMedium: input.utmMedium ?? null,
          utmCampaign: input.utmCampaign ?? null,
          referrer: input.referrer ?? null,
        },
      })
    }

    const firstSeen = existing.firstSeen && existing.firstSeen < input.firstSeen ? existing.firstSeen : input.firstSeen
    const lastSeen = existing.lastSeen && existing.lastSeen > input.lastSeen ? existing.lastSeen : input.lastSeen

    return this.prisma.analyticsSession.update({
      where: {
        id: input.id,
      },
      data: {
        firstSeen,
        lastSeen,
        utmSource: existing.utmSource ?? input.utmSource ?? null,
        utmMedium: existing.utmMedium ?? input.utmMedium ?? null,
        utmCampaign: existing.utmCampaign ?? input.utmCampaign ?? null,
        referrer: existing.referrer ?? input.referrer ?? null,
      },
    })
  }

  async upsertManyFacts(records: Prisma.EventFactCreateManyInput[]) {
    if (!records.length) {
      return { count: 0 }
    }

    const operations = records.map((record) =>
      this.prisma.eventFact.upsert({
        where: {
          sourceEventId: record.sourceEventId,
        },
        create: record,
        update: record,
      }),
    )

    const result = await this.prisma.$transaction(operations)
    return { count: result.length }
  }

  async getEventFactFunnel(from: Date, to: Date, steps: string[]) {
    const facts = await this.prisma.eventFact.findMany({
      where: {
        eventDate: {
          gte: from,
          lte: to,
        },
        eventName: {
          in: steps,
        },
      },
      select: {
        eventName: true,
        sessionId: true,
      },
    })

    const totals = new Map<string, { sessions: Set<string>; events: number }>()
    for (const step of steps) {
      totals.set(step, { sessions: new Set<string>(), events: 0 })
    }
    for (const fact of facts) {
      const current = totals.get(fact.eventName)
      if (!current) {
        continue
      }
      current.sessions.add(fact.sessionId)
      current.events += 1
    }

    return totals
  }

  async getSessionCountsByChannel(from: Date, to: Date) {
    return this.prisma.analyticsSession.findMany({
      where: {
        lastSeen: {
          gte: from,
          lte: to,
        },
      },
      select: {
        utmSource: true,
        id: true,
      },
    })
  }

  async getOrdersInRange(from: Date, to: Date) {
    return this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: from,
          lte: to,
        },
      },
      select: {
        uuid: true,
        grandTotal: true,
        orderCurrency: true,
        createdAt: true,
        sessionId: true,
        userId: true,
        utmSource: true,
        utmMedium: true,
        utmCampaign: true,
        referrer: true,
        items: {
          select: {
            productId: true,
            name: true,
            qty: true,
            price: true,
          },
        },
      },
    })
  }

  async getProductFacts(from: Date, to: Date) {
    return this.prisma.eventFact.findMany({
      where: {
        eventDate: {
          gte: from,
          lte: to,
        },
        productId: {
          not: null,
        },
      },
      select: {
        eventName: true,
        productId: true,
        value: true,
      },
    })
  }

  async listConnections() {
    const connections = await this.analyticsPrisma.analyticsConnection.findMany({
      orderBy: [{ source: 'asc' }, { displayName: 'asc' }],
    })
    return connections.map((connection) => this.mapConnection(connection))
  }

  async listReportingDaily(from: Date, to: Date) {
    const rows = await this.analyticsPrisma.analyticsReportingDaily.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ date: 'asc' }, { channel: 'asc' }, { campaign: 'asc' }],
    })

    return rows.map((row) => this.mapReportingDailyMetric(row))
  }

  async listReportingDailyBatch(from: Date, to: Date, limit = 1000, cursorId?: bigint | null) {
    const rows = await this.analyticsPrisma.analyticsReportingDaily.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ id: 'asc' }],
      take: limit,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    })

    return rows.map((row) => this.mapReportingDailyMetric(row))
  }

  async listAdsDailyMetrics(from: Date, to: Date) {
    const rows = await this.analyticsPrisma.analyticsAdsDailyMetric.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ date: 'asc' }, { campaign: 'asc' }],
    })

    return rows.map((row) => this.mapAdsDailyMetric(row))
  }

  async listAdsDailyMetricsBatch(from: Date, to: Date, limit = 1000, cursorId?: bigint | null) {
    const rows = await this.analyticsPrisma.analyticsAdsDailyMetric.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ id: 'asc' }],
      take: limit,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    })

    return rows.map((row) => this.mapAdsDailyMetric(row))
  }

  async listSearchConsoleDailyMetrics(from: Date, to: Date) {
    const rows = await this.analyticsPrisma.analyticsSearchConsoleDailyMetric.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ date: 'asc' }, { query: 'asc' }],
    })

    return rows.map((row) => this.mapSearchConsoleDailyMetric(row))
  }

  async listSearchConsoleDailyMetricsBatch(
    from: Date,
    to: Date,
    limit = 1000,
    cursorId?: bigint | null,
  ) {
    const rows = await this.analyticsPrisma.analyticsSearchConsoleDailyMetric.findMany({
      where: {
        date: {
          gte: from,
          lte: to,
        },
      },
      orderBy: [{ id: 'asc' }],
      take: limit,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    })

    return rows.map((row) => this.mapSearchConsoleDailyMetric(row))
  }

  async listSyncRuns(limit = 50) {
    const runs = await this.analyticsPrisma.analyticsSyncRun.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })
    return runs.map((run) => this.mapSyncRun(run))
  }

  async getLatestFailedSyncRun(connectionId: string) {
    const run = await this.analyticsPrisma.analyticsSyncRun.findFirst({
      where: {
        connectionId,
        status: 'failed',
      },
      orderBy: [{ startedAt: 'desc' }],
    })

    return run
      ? {
          ...this.mapSyncRun(run),
          fromDate: run.fromDate?.toISOString() ?? null,
          toDate: run.toDate?.toISOString() ?? null,
        }
      : null
  }

  async listInsights(limit = 50) {
    const insights = await this.analyticsPrisma.analyticsInsight.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })
    return insights.map((insight) => this.mapInsight(insight))
  }

  async listInsightHistory(limit = 100, insightType?: string) {
    const history = await this.analyticsPrisma.analyticsInsightHistory.findMany({
      where: insightType ? { insightType } : undefined,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })

    return history.map((entry) => this.mapInsightHistory(entry))
  }

  async createInsightHistory(input: {
    date: Date
    insightType: string
    title: string
    description: string
    impact: string
    recommendation: string
    confidence: number
    evidence: Prisma.InputJsonValue
    sourceReport?: string | null
    periodRange: Prisma.InputJsonValue
    score: number
    summary?: string | null
  }) {
    return this.analyticsPrisma.analyticsInsightHistory.create({
      data: {
        date: input.date,
        insightType: input.insightType,
        title: input.title,
        description: input.description,
        impact: input.impact,
        recommendation: input.recommendation,
        confidence: new Prisma.Decimal(input.confidence),
        evidence: input.evidence,
        sourceReport: input.sourceReport ?? null,
        periodRange: input.periodRange,
        score: new Prisma.Decimal(input.score),
        summary: input.summary ?? null,
      },
    })
  }

  async createInsightHistoryMany(
    inputs: Array<{
      date: Date
      insightType: string
      title: string
      description: string
      impact: string
      recommendation: string
      confidence: number
      evidence: Prisma.InputJsonValue
      sourceReport?: string | null
      periodRange: Prisma.InputJsonValue
      score: number
      summary?: string | null
    }>,
  ) {
    if (!inputs.length) {
      return { count: 0 }
    }

    return this.analyticsPrisma.analyticsInsightHistory.createMany({
      data: inputs.map((input) => ({
        date: input.date,
        insightType: input.insightType,
        title: input.title,
        description: input.description,
        impact: input.impact,
        recommendation: input.recommendation,
        confidence: new Prisma.Decimal(input.confidence),
        evidence: input.evidence,
        sourceReport: input.sourceReport ?? null,
        periodRange: input.periodRange,
        score: new Prisma.Decimal(input.score),
        summary: input.summary ?? null,
      })),
    })
  }

  async createAiInsightRun(input: {
    date: Date
    summary: string
    insightsJson: Prisma.InputJsonValue
    actionsJson: Prisma.InputJsonValue
    confidence: number
    bundleJson: Prisma.InputJsonValue
    responseJson: Prisma.InputJsonValue
  }) {
    return this.analyticsPrisma.analyticsAiInsightRun.create({
      data: {
        date: input.date,
        summary: input.summary,
        insightsJson: input.insightsJson,
        actionsJson: input.actionsJson,
        confidence: new Prisma.Decimal(input.confidence),
        bundleJson: input.bundleJson,
        responseJson: input.responseJson,
      },
    })
  }

  async listAiInsightRuns(limit = 50) {
    const runs = await this.analyticsPrisma.analyticsAiInsightRun.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })
    return runs.map((run) => this.mapAiInsightRun(run))
  }

  async listReportCatalog() {
    const entries = await this.analyticsPrisma.analyticsReportCatalog.findMany({
      orderBy: [{ title: 'asc' }],
    })
    return entries.map((entry) => this.mapReportCatalog(entry))
  }

  async upsertReportCatalog(input: {
    key: string
    source: string
    title: string
    description?: string | null
    baselineHeader: string
    baselineTitle?: string | null
    equivalenceStatus: string
    rowKeyStrategy: string
    dimensionLabels: string[]
    metricLabels: string[]
    apiDefinition?: Prisma.InputJsonValue | null
    notes?: string | null
  }) {
    return this.analyticsPrisma.analyticsReportCatalog.upsert({
      where: { key: input.key },
      update: {
        source: input.source,
        title: input.title,
        description: input.description ?? null,
        baselineHeader: input.baselineHeader,
        baselineTitle: input.baselineTitle ?? null,
        equivalenceStatus: input.equivalenceStatus,
        rowKeyStrategy: input.rowKeyStrategy,
        dimensionLabels: input.dimensionLabels,
        metricLabels: input.metricLabels,
        apiDefinition: input.apiDefinition ?? null,
        notes: input.notes ?? null,
      },
      create: {
        key: input.key,
        source: input.source,
        title: input.title,
        description: input.description ?? null,
        baselineHeader: input.baselineHeader,
        baselineTitle: input.baselineTitle ?? null,
        equivalenceStatus: input.equivalenceStatus,
        rowKeyStrategy: input.rowKeyStrategy,
        dimensionLabels: input.dimensionLabels,
        metricLabels: input.metricLabels,
        apiDefinition: input.apiDefinition ?? null,
        notes: input.notes ?? null,
      },
    })
  }

  async createReportRun(input: {
    reportKey: string
    source: string
    status?: string
    fromDate?: Date | null
    toDate?: Date | null
    metadata?: Prisma.InputJsonValue | null
  }) {
    return this.analyticsPrisma.analyticsReportRun.create({
      data: {
        reportKey: input.reportKey,
        source: input.source,
        status: input.status ?? 'running',
        fromDate: input.fromDate ?? null,
        toDate: input.toDate ?? null,
        metadata: input.metadata ?? null,
      },
    })
  }

  async updateReportRun(
    reportRunId: string,
    data: Partial<{
      status: string
      rowCount: number
      errorMessage: string | null
      fromDate: Date | null
      toDate: Date | null
      metadata: Prisma.InputJsonValue | null
      finishedAt: Date | null
    }>,
  ) {
    return this.analyticsPrisma.analyticsReportRun.update({
      where: { id: reportRunId },
      data,
    })
  }

  async listReportRuns(limit = 50, reportKey?: string) {
    const runs = await this.analyticsPrisma.analyticsReportRun.findMany({
      where: reportKey ? { reportKey } : undefined,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })
    return runs.map((run) => this.mapReportRun(run))
  }

  async listLatestReportRunBySource(reportKey: string, source: string) {
    const run = await this.analyticsPrisma.analyticsReportRun.findFirst({
      where: {
        reportKey,
        source,
      },
      orderBy: [{ createdAt: 'desc' }],
    })

    return run ? this.mapReportRun(run) : null
  }

  async listLatestReportRunBySourceAndRange(
    reportKey: string,
    source: string,
    fromDate: Date,
    toDate: Date,
  ) {
    const run = await this.analyticsPrisma.analyticsReportRun.findFirst({
      where: {
        reportKey,
        source,
        fromDate,
        toDate,
      },
      orderBy: [{ createdAt: 'desc' }],
    })

    return run ? this.mapReportRun(run) : null
  }

  async createReportRows(input: {
    reportRunId: string
    reportKey: string
    source: AnalyticsReportDataSource
    rows: Array<{
      rowType: string
      rowIndex: number
      rowKey: string
      dimensions: Prisma.InputJsonValue
      metrics: Prisma.InputJsonValue
      raw?: Prisma.InputJsonValue | null
    }>
  }) {
    if (!input.rows.length) {
      return { count: 0 }
    }

    return this.analyticsPrisma.analyticsReportRow.createMany({
      data: input.rows.map((row) => ({
        reportRunId: input.reportRunId,
        reportKey: input.reportKey,
        source: input.source,
        rowType: row.rowType,
        rowIndex: row.rowIndex,
        rowKey: row.rowKey,
        dimensions: row.dimensions,
        metrics: row.metrics,
        raw: row.raw ?? null,
      })),
      skipDuplicates: true,
    })
  }

  async listReportRows(reportRunId: string) {
    const rows = await this.analyticsPrisma.analyticsReportRow.findMany({
      where: { reportRunId },
      orderBy: [{ rowIndex: 'asc' }],
    })

    return rows.map((row) => this.mapReportRow(row))
  }

  async createOrUpdateReportReconciliation(input: {
    reportKey: string
    baselineRunId?: string | null
    syncRunId?: string | null
    status: string
    baselineRowCount: number
    syncRowCount: number
    matchedRowCount: number
    baselineOnlyRowCount: number
    syncOnlyRowCount: number
    deltaPercent: number
    summary: string
    evidence?: Prisma.InputJsonValue | null
  }) {
    return this.analyticsPrisma.analyticsReportReconciliation.upsert({
      where: {
        id: `${input.reportKey}:${input.baselineRunId ?? 'none'}:${input.syncRunId ?? 'none'}`,
      },
      update: {
        status: input.status,
        baselineRowCount: input.baselineRowCount,
        syncRowCount: input.syncRowCount,
        matchedRowCount: input.matchedRowCount,
        baselineOnlyRowCount: input.baselineOnlyRowCount,
        syncOnlyRowCount: input.syncOnlyRowCount,
        deltaPercent: new Prisma.Decimal(input.deltaPercent),
        summary: input.summary,
        evidence: input.evidence ?? null,
      },
      create: {
        id: `${input.reportKey}:${input.baselineRunId ?? 'none'}:${input.syncRunId ?? 'none'}`,
        reportKey: input.reportKey,
        baselineRunId: input.baselineRunId ?? null,
        syncRunId: input.syncRunId ?? null,
        status: input.status,
        baselineRowCount: input.baselineRowCount,
        syncRowCount: input.syncRowCount,
        matchedRowCount: input.matchedRowCount,
        baselineOnlyRowCount: input.baselineOnlyRowCount,
        syncOnlyRowCount: input.syncOnlyRowCount,
        deltaPercent: new Prisma.Decimal(input.deltaPercent),
        summary: input.summary,
        evidence: input.evidence ?? null,
      },
    })
  }

  async listReportReconciliations(limit = 50, reportKey?: string) {
    const reconciliations = await this.analyticsPrisma.analyticsReportReconciliation.findMany({
      where: reportKey ? { reportKey } : undefined,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })

    return reconciliations.map((entry) => this.mapReportReconciliation(entry))
  }

  async upsertBaselineSnapshot(input: {
    connectionId?: string | null
    source: 'ga4' | 'ads' | 'search_console'
    reportKey: string
    date: Date
    metricName: string
    dimensionHash: string
    dimensionValues: Prisma.InputJsonValue | null
    value: number
    queryHash: string
    origin?: 'api' | 'csv' | 'export'
    snapshotGroup?: string | null
    raw?: Prisma.InputJsonValue | null
  }) {
    return this.analyticsPrisma.analyticsBaselineSnapshot.upsert({
      where: {
        connectionId_source_reportKey_date_metricName_dimensionHash_queryHash: {
          connectionId: input.connectionId,
          source: input.source,
          reportKey: input.reportKey,
          date: input.date,
          metricName: input.metricName,
          dimensionHash: input.dimensionHash,
          queryHash: input.queryHash,
        },
      },
      update: {
        dimensionValues: input.dimensionValues,
        value: new Prisma.Decimal(input.value),
        origin: input.origin ?? 'api',
        snapshotGroup: input.snapshotGroup ?? '',
        raw: input.raw ?? null,
      },
      create: {
        connectionId: input.connectionId ?? null,
        source: input.source,
        reportKey: input.reportKey,
        date: input.date,
        metricName: input.metricName,
        dimensionHash: input.dimensionHash,
        dimensionValues: input.dimensionValues,
        value: new Prisma.Decimal(input.value),
        queryHash: input.queryHash,
        origin: input.origin ?? 'api',
        snapshotGroup: input.snapshotGroup ?? '',
        raw: input.raw ?? null,
      },
    })
  }

  async listBaselineSnapshots(
    limit = 50,
    reportKey?: string,
    filters?: { origin?: 'api' | 'csv' | 'export'; snapshotGroup?: string },
  ) {
    const snapshots = await this.analyticsPrisma.analyticsBaselineSnapshot.findMany({
      where: {
        ...(reportKey ? { reportKey } : {}),
        ...(filters?.origin ? { origin: filters.origin } : {}),
        ...(filters?.snapshotGroup ? { snapshotGroup: filters.snapshotGroup } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })

    return snapshots.map((snapshot) => this.mapBaselineSnapshot(snapshot))
  }

  async createDataParityCheck(input: {
    source: 'ga4' | 'ads' | 'search_console'
    metric: string
    dateFrom: Date
    dateTo: Date
    apiValue: number
    baselineValue: number
    deltaAbs: number
    deltaPercent: number
    status: AnalyticsDataParityStatus
    snapshotGroup?: string | null
  }) {
    return this.analyticsPrisma.analyticsDataParityCheck.create({
      data: {
        source: input.source,
        metric: input.metric,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        apiValue: new Prisma.Decimal(input.apiValue),
        baselineValue: new Prisma.Decimal(input.baselineValue),
        deltaAbs: new Prisma.Decimal(input.deltaAbs),
        deltaPercent: new Prisma.Decimal(input.deltaPercent),
        status: input.status,
        snapshotGroup: input.snapshotGroup ?? '',
      },
    })
  }

  async listDataParityChecks(limit = 100, source?: 'ga4' | 'ads' | 'search_console') {
    const checks = await this.analyticsPrisma.analyticsDataParityCheck.findMany({
      where: source ? { source } : undefined,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })
    return checks.map((check) => this.mapDataParityCheck(check))
  }

  async listLatestDataParityChecks() {
    const checks = await this.analyticsPrisma.analyticsDataParityCheck.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: 50,
    })
    return checks.map((check) => this.mapDataParityCheck(check))
  }

  async createUsageEvent(input: {
    endpoint: string
    userId?: number | null
    timeRange: string
    filters?: Prisma.InputJsonValue | null
    responseTimeMs: number
    responseSize: number
    trustLevel: string
    hasData: boolean
  }) {
    return this.analyticsPrisma.analyticsUsageEvent.create({
      data: {
        endpoint: input.endpoint,
        userId: input.userId ?? null,
        timeRange: input.timeRange,
        filters: input.filters ?? null,
        responseTimeMs: input.responseTimeMs,
        responseSize: input.responseSize,
        trustLevel: input.trustLevel,
        hasData: input.hasData,
      },
    })
  }

  async createEndpointUsage(input: {
    endpoint: string
    userId?: string | null
    statusCode: number
    durationMs: number
  }) {
    return this.analyticsPrisma.analyticsEndpointUsage.create({
      data: {
        endpoint: input.endpoint,
        userId: input.userId ?? null,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
      },
    })
  }

  async listEndpointUsage(limit = 100) {
    const rows = await this.analyticsPrisma.analyticsEndpointUsage.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })
    return rows.map((row) => this.mapEndpointUsage(row))
  }

  async listEndpointUsageByEndpoint(limit = 100) {
    const rows = await this.listEndpointUsage(limit)
    const aggregates = new Map<
      string,
      {
        endpoint: string
        calls: number
        latencySum: number
        errorCount: number
        lastCalledAt: string | null
      }
    >()

    for (const row of rows) {
      const current =
        aggregates.get(row.endpoint) ?? {
          endpoint: row.endpoint,
          calls: 0,
          latencySum: 0,
          errorCount: 0,
          lastCalledAt: null,
        }
      current.calls += 1
      current.latencySum += row.durationMs
      if (row.statusCode >= 400) {
        current.errorCount += 1
      }
      current.lastCalledAt = !current.lastCalledAt || current.lastCalledAt < row.createdAt ? row.createdAt : current.lastCalledAt
      aggregates.set(row.endpoint, current)
    }

    return [...aggregates.values()]
      .map((entry) => ({
        endpoint: entry.endpoint,
        calls: entry.calls,
        avgLatency: entry.calls > 0 ? Number((entry.latencySum / entry.calls).toFixed(2)) : 0,
        errorRate: entry.calls > 0 ? Number((entry.errorCount / entry.calls).toFixed(4)) : 0,
        lastCalledAt: entry.lastCalledAt,
      }))
      .sort((left, right) => right.calls - left.calls)
  }

  async listEndpointUsageDaily(limit = 30) {
    const rows = await this.listEndpointUsage(5000)
    const aggregates = new Map<string, { calls: number; errors: number }>()
    for (const row of rows) {
      const key = row.createdAt.slice(0, 10)
      const current = aggregates.get(key) ?? { calls: 0, errors: 0 }
      current.calls += 1
      if (row.statusCode >= 400) {
        current.errors += 1
      }
      aggregates.set(key, current)
    }
    return [...aggregates.entries()]
      .map(([date, value]) => ({
        date,
        calls: value.calls,
        errorRate: value.calls > 0 ? Number((value.errors / value.calls).toFixed(4)) : 0,
      }))
      .sort((left, right) => right.date.localeCompare(left.date))
      .slice(0, limit)
  }

  async countEndpointUsage(limit = 100) {
    return this.analyticsPrisma.analyticsEndpointUsage.count({
      take: limit,
    })
  }

  async listUsageEvents(limit = 100) {
    const events = await this.analyticsPrisma.analyticsUsageEvent.findMany({
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })
    return events.map((event) => this.mapUsageEvent(event))
  }

  async listUsageByEndpoint(limit = 100) {
    const events = await this.listUsageEvents(limit)
    const aggregates = new Map<
      string,
      {
        endpoint: string
        calls: number
        latencySum: number
        emptyCount: number
        trustLevels: Record<string, number>
        lastCalledAt: string | null
      }
    >()

    for (const event of events) {
      const current =
        aggregates.get(event.endpoint) ??
        {
          endpoint: event.endpoint,
          calls: 0,
          latencySum: 0,
          emptyCount: 0,
          trustLevels: {},
          lastCalledAt: null,
        }
      current.calls += 1
      current.latencySum += event.responseTimeMs
      if (!event.hasData) {
        current.emptyCount += 1
      }
      current.trustLevels[event.trustLevel] = (current.trustLevels[event.trustLevel] ?? 0) + 1
      current.lastCalledAt =
        !current.lastCalledAt || current.lastCalledAt < event.createdAt ? event.createdAt : current.lastCalledAt
      aggregates.set(event.endpoint, current)
    }

    return [...aggregates.values()]
      .map((entry) => ({
        endpoint: entry.endpoint,
        calls: entry.calls,
        avgLatency: entry.calls > 0 ? Number((entry.latencySum / entry.calls).toFixed(2)) : 0,
        emptyRate: entry.calls > 0 ? Number((entry.emptyCount / entry.calls).toFixed(4)) : 0,
        trustLevels: entry.trustLevels,
        lastCalledAt: entry.lastCalledAt,
      }))
      .sort((left, right) => right.calls - left.calls)
  }

  async createBaselineCheck(input: {
    date: Date
    source: 'ga4' | 'ads' | 'search_console'
    metric: string
    comparisonKind: 'api_vs_import' | 'export_vs_import'
    expectedValue: number
    actualValue: number
    diffPct: number
    status: 'ok' | 'warning' | 'mismatch'
    snapshotGroup: string
  }) {
    const check = await this.analyticsPrisma.analyticsBaselineCheck.create({
      data: {
        date: input.date,
        source: input.source,
        metric: input.metric,
        comparisonKind: input.comparisonKind,
        expectedValue: new Prisma.Decimal(input.expectedValue),
        actualValue: new Prisma.Decimal(input.actualValue),
        diffPct: new Prisma.Decimal(input.diffPct),
        status: input.status,
        snapshotGroup: input.snapshotGroup,
      },
    })
    return this.mapBaselineCheck(check)
  }

  async listBaselineChecks(limit = 100, filters?: { source?: 'ga4' | 'ads' | 'search_console'; comparisonKind?: string }) {
    const rows = await this.analyticsPrisma.analyticsBaselineCheck.findMany({
      where: {
        ...(filters?.source ? { source: filters.source } : {}),
        ...(filters?.comparisonKind ? { comparisonKind: filters.comparisonKind } : {}),
      },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })
    return rows.map((row) => this.mapBaselineCheck(row))
  }

  async countBaselineChecks() {
    return this.analyticsPrisma.analyticsBaselineCheck.count()
  }

  async createDataAnomaly(input: {
    type: string
    source: string
    metric?: string | null
    description: string
    severity: string
  }) {
    const anomaly = await this.analyticsPrisma.analyticsDataAnomaly.create({
      data: {
        type: input.type,
        source: input.source,
        metric: input.metric ?? null,
        description: input.description,
        severity: input.severity,
      },
    })
    return this.mapDataAnomaly(anomaly)
  }

  async listDataAnomalies(limit = 100) {
    const rows = await this.analyticsPrisma.analyticsDataAnomaly.findMany({
      orderBy: [{ detectedAt: 'desc' }],
      take: limit,
    })
    return rows.map((row) => this.mapDataAnomaly(row))
  }

  async createExportRun(input: {
    exportType: string
    source?: string | null
    dateFrom: Date
    dateTo: Date
    filters?: Prisma.InputJsonValue | null
    rowCount?: number | null
    fileFormat: string
    status: string
    errorMessage?: string | null
    durationMs?: number | null
    fileSize?: number | null
  }) {
    const run = await this.analyticsPrisma.analyticsExportRun.create({
      data: {
        exportType: input.exportType,
        source: input.source ?? null,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
        filters: input.filters ?? null,
        rowCount: input.rowCount ?? null,
        fileFormat: input.fileFormat,
        status: input.status,
        errorMessage: input.errorMessage ?? null,
        durationMs: input.durationMs ?? null,
        fileSize: input.fileSize ?? null,
      },
    })

    return this.mapExportRun(run)
  }

  async updateExportRun(
    id: string,
    input: Partial<{
      rowCount: number | null
      status: string
      errorMessage: string | null
      durationMs: number | null
      fileSize: number | null
    }>,
  ) {
    const run = await this.analyticsPrisma.analyticsExportRun.update({
      where: { id },
      data: {
        ...(input.rowCount !== undefined ? { rowCount: input.rowCount } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.errorMessage !== undefined ? { errorMessage: input.errorMessage } : {}),
        ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
        ...(input.fileSize !== undefined ? { fileSize: input.fileSize } : {}),
      },
    })

    return this.mapExportRun(run)
  }

  async listExportRuns(input: {
    limit: number
    offset: number
    exportType?: string | null
    source?: string | null
    status?: string | null
  }) {
    const where = {
      ...(input.exportType ? { exportType: input.exportType } : {}),
      ...(input.source ? { source: input.source } : {}),
      ...(input.status ? { status: input.status } : {}),
    }

    const [total, items] = await Promise.all([
      this.analyticsPrisma.analyticsExportRun.count({ where }),
      this.analyticsPrisma.analyticsExportRun.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: input.offset,
        take: input.limit,
      }),
    ])

    return {
      total,
      items: items.map((item) => this.mapExportRun(item)),
    }
  }

  async getExportRunById(id: string) {
    const run = await this.analyticsPrisma.analyticsExportRun.findUnique({
      where: { id },
    })

    return run ? this.mapExportRun(run) : null
  }

  async findLatestBaselineQuery(reportKey: string, queryHash: string) {
    const snapshots = await this.analyticsPrisma.analyticsBaselineSnapshot.findMany({
      where: {
        reportKey,
        queryHash,
      },
      orderBy: [{ createdAt: 'desc' }],
    })

    return snapshots.map((snapshot) => this.mapBaselineSnapshot(snapshot))
  }

  async upsertDataQualityCheck(input: {
    connectionId: string
    reportKey: string
    date: Date
    metricName: string
    dimensionHash: string
    baselineValue: number
    syncedValue: number
    diff: number
    diffPercent: number
    status: AnalyticsDataQualityStatus | string
    baselineSnapshotId?: string | null
    syncRunId?: string | null
    queryHash: string
  }) {
    return this.analyticsPrisma.analyticsDataQualityCheck.upsert({
      where: {
        connectionId_reportKey_date_metricName_dimensionHash_queryHash: {
          connectionId: input.connectionId,
          reportKey: input.reportKey,
          date: input.date,
          metricName: input.metricName,
          dimensionHash: input.dimensionHash,
          queryHash: input.queryHash,
        },
      },
      update: {
        baselineValue: new Prisma.Decimal(input.baselineValue),
        syncedValue: new Prisma.Decimal(input.syncedValue),
        diff: new Prisma.Decimal(input.diff),
        diffPercent: new Prisma.Decimal(input.diffPercent),
        status: input.status,
        baselineSnapshotId: input.baselineSnapshotId ?? null,
        queryHash: input.queryHash,
      },
      create: {
        connectionId: input.connectionId,
        reportKey: input.reportKey,
        date: input.date,
        metricName: input.metricName,
        dimensionHash: input.dimensionHash,
        baselineValue: new Prisma.Decimal(input.baselineValue),
        syncedValue: new Prisma.Decimal(input.syncedValue),
        diff: new Prisma.Decimal(input.diff),
        diffPercent: new Prisma.Decimal(input.diffPercent),
        status: input.status,
        baselineSnapshotId: input.baselineSnapshotId ?? null,
        syncRunId: input.syncRunId ?? null,
        queryHash: input.queryHash,
      },
    })
  }

  async listDataQualityChecks(limit = 50, reportKey?: string) {
    const checks = await this.analyticsPrisma.analyticsDataQualityCheck.findMany({
      where: reportKey ? { reportKey } : undefined,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })

    return checks.map((check) => this.mapDataQualityCheck(check))
  }

  async listLatestDataQualityChecks(reportKey?: string) {
    const checks = await this.analyticsPrisma.analyticsDataQualityCheck.findMany({
      where: reportKey ? { reportKey } : undefined,
      orderBy: [{ createdAt: 'desc' }],
    })

    return checks.map((check) => this.mapDataQualityCheck(check))
  }

  async upsertEventComparison(input: {
    tenantId: string
    eventId: string
    eventName: string
    directEventTimestamp?: Date | null
    gaEventTimestamp?: Date | null
    existsInDirect: boolean
    existsInGa: boolean
    payloadMatch: boolean
    timeDiffMs?: number | null
    status: AnalyticsEventComparison['status'] | string
    directSource?: string | null
    gaSource?: string | null
    comparisonDate?: Date | null
    directPayload?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null
    gaPayload?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | null
  }) {
    const directPayload =
      input.directPayload === null || input.directPayload === undefined ? Prisma.JsonNull : input.directPayload
    const gaPayload =
      input.gaPayload === null || input.gaPayload === undefined ? Prisma.JsonNull : input.gaPayload

    return this.analyticsPrisma.analyticsEventComparison.upsert({
      where: {
        tenantId_eventId: {
          tenantId: input.tenantId,
          eventId: input.eventId,
        },
      },
      update: {
        eventName: input.eventName,
        directEventTimestamp: input.directEventTimestamp ?? null,
        gaEventTimestamp: input.gaEventTimestamp ?? null,
        existsInDirect: input.existsInDirect,
        existsInGa: input.existsInGa,
        payloadMatch: input.payloadMatch,
        timeDiffMs: input.timeDiffMs ?? null,
        status: input.status,
        directSource: input.directSource ?? null,
        gaSource: input.gaSource ?? null,
        comparisonDate: input.comparisonDate ?? null,
        directPayload,
        gaPayload,
      },
      create: {
        tenantId: input.tenantId,
        eventId: input.eventId,
        eventName: input.eventName,
        directEventTimestamp: input.directEventTimestamp ?? null,
        gaEventTimestamp: input.gaEventTimestamp ?? null,
        existsInDirect: input.existsInDirect,
        existsInGa: input.existsInGa,
        payloadMatch: input.payloadMatch,
        timeDiffMs: input.timeDiffMs ?? null,
        status: input.status,
        directSource: input.directSource ?? null,
        gaSource: input.gaSource ?? null,
        comparisonDate: input.comparisonDate ?? null,
        directPayload,
        gaPayload,
      },
    })
  }

  async listEventComparisons(limit = 100, filters?: { tenantId?: string; status?: string; eventName?: string }) {
    const comparisons = await this.analyticsPrisma.analyticsEventComparison.findMany({
      where: {
        ...(filters?.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.eventName ? { eventName: filters.eventName } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
    })

    return comparisons.map((comparison) => this.mapEventComparison(comparison))
  }

  async listEventComparisonSummary(filters?: { tenantId?: string; eventName?: string }) {
    const comparisons = await this.analyticsPrisma.analyticsEventComparison.findMany({
      where: {
        ...(filters?.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters?.eventName ? { eventName: filters.eventName } : {}),
      },
    })

    const totalEvents = comparisons.length
    const matchCount = comparisons.filter((comparison) => comparison.status === 'match').length
    const missingInGaCount = comparisons.filter((comparison) => comparison.status === 'missing_in_ga').length
    const missingInDirectCount = comparisons.filter((comparison) => comparison.status === 'missing_in_direct').length
    const mismatchCount = comparisons.filter((comparison) => comparison.status === 'mismatch').length
    const purchaseMismatchCount = comparisons.filter(
      (comparison) => comparison.eventName === 'purchase' && comparison.status === 'mismatch',
    ).length
    const timeDiffValues = comparisons
      .map((comparison) => comparison.timeDiffMs)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
    const averageTimeDiffMs = timeDiffValues.length
      ? Math.round(timeDiffValues.reduce((sum, value) => sum + value, 0) / timeDiffValues.length)
      : null
    const matchRate = totalEvents > 0 ? Number(((matchCount / totalEvents) * 100).toFixed(2)) : 0
    const trackingHealthScore = totalEvents > 0 ? Number((matchCount / totalEvents).toFixed(4)) : 0
    const comparisonDates = comparisons
      .map((comparison) => comparison.comparisonDate)
      .filter((value): value is Date => value instanceof Date)
      .sort((left, right) => left.getTime() - right.getTime())

    return {
      tenantId: filters?.tenantId ?? 'all',
      totalEvents,
      matchCount,
      missingInGaCount,
      missingInDirectCount,
      mismatchCount,
      matchRate,
      trackingHealthScore,
      averageTimeDiffMs,
      purchaseMismatchCount,
      fromDate: comparisonDates[0]?.toISOString() ?? null,
      toDate: comparisonDates[comparisonDates.length - 1]?.toISOString() ?? null,
    } satisfies AnalyticsEventComparisonSummary
  }
}

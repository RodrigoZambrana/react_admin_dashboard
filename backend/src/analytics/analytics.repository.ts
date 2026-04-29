import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'

import { PrismaService } from '../prisma/prisma.service'
import {
  normalizeAnalyticsEventCategory,
  normalizeAnalyticsEventSource,
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
} from './analytics.types'

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
      connectionId: snapshot.connectionId,
      source: snapshot.source as AnalyticsBaselineSnapshot['source'],
      reportKey: snapshot.reportKey,
      date: snapshot.date.toISOString(),
      metricName: snapshot.metricName,
      dimensionHash: snapshot.dimensionHash,
      dimensionValues: (snapshot.dimensionValues as Record<string, unknown>) ?? null,
      value: Number(snapshot.value.toString()),
      queryHash: snapshot.queryHash,
      raw: (snapshot.raw as Record<string, unknown>) ?? null,
      createdAt: snapshot.createdAt.toISOString(),
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
  }) {
    return this.analyticsPrisma.analyticsSyncRun.create({
      data: {
        connectionId: input.connectionId,
        jobType: input.jobType,
        fromDate: input.fromDate ?? null,
        toDate: input.toDate ?? null,
        status: input.status ?? 'running',
      },
    })
  }

  async updateSyncRun(
    syncRunId: string,
    data: Partial<{
      status: string
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
    const payload = JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue
    const eventName = input.event?.trim() || 'unknown_event'
    const category = normalizeAnalyticsEventCategory(
      input.category ?? input.eventCategory ?? (payload as Record<string, unknown>).category,
      eventName,
    )
    const source = normalizeAnalyticsEventSource(input.source ?? (payload as Record<string, unknown>).source)
    const measurementStatus = normalizeAnalyticsMeasurementStatus(
      input.measurement_status ?? input.measurementStatus ?? (payload as Record<string, unknown>).measurement_status,
      category,
    )
    return this.prisma.analyticsEvent.create({
      data: {
        eventName,
        eventCategory: category,
        source,
        measurementStatus,
        sessionId: input.session_id,
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

  async listEvents(from: Date, to: Date, eventNames?: string[]) {
    return this.prisma.analyticsEvent.findMany({
      where: {
        timestamp: {
          gte: from,
          lte: to,
        },
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

    return this.prisma.eventFact.createMany({
      data: records,
      skipDuplicates: true,
    })
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
    connectionId: string
    source: 'ga4'
    reportKey: string
    date: Date
    metricName: string
    dimensionHash: string
    dimensionValues: Prisma.InputJsonValue | null
    value: number
    queryHash: string
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
        raw: input.raw ?? null,
      },
      create: {
        connectionId: input.connectionId,
        source: input.source,
        reportKey: input.reportKey,
        date: input.date,
        metricName: input.metricName,
        dimensionHash: input.dimensionHash,
        dimensionValues: input.dimensionValues,
        value: new Prisma.Decimal(input.value),
        queryHash: input.queryHash,
        raw: input.raw ?? null,
      },
    })
  }

  async listBaselineSnapshots(limit = 50, reportKey?: string) {
    const snapshots = await this.analyticsPrisma.analyticsBaselineSnapshot.findMany({
      where: reportKey ? { reportKey } : undefined,
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })

    return snapshots.map((snapshot) => this.mapBaselineSnapshot(snapshot))
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
}

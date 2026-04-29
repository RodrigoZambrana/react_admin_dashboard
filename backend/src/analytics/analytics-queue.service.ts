import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ModuleRef } from '@nestjs/core'
import { Job, JobsOptions, Queue, Worker } from 'bullmq'
import Redis from 'ioredis'
import { randomUUID } from 'crypto'

import { AnalyticsRepository } from './analytics.repository'
import {
  AnalyticsAdsSyncResult,
  AnalyticsGa4SyncResult,
  AnalyticsSearchConsoleSyncResult,
  AnalyticsSyncJobType,
  AnalyticsConnectionSource,
  AnalyticsSyncRun,
} from './analytics.types'
import { Ga4ConnectorService } from './ga4-connector.service'
import { AdsConnectorService } from './ads-connector.service'
import { SearchConsoleConnectorService } from './search-console-connector.service'
import { AnalyticsService } from './analytics.service'
import { AnalyticsDataParityService } from './data-parity/analytics-data-parity.service'

type SyncWindow = {
  fromDate: Date
  toDate: Date
}

type AnalyticsSyncJobData = {
  kind: 'sync'
  source: AnalyticsConnectionSource
  connectionId: string
  jobType: AnalyticsSyncJobType
  fromDate: string
  toDate: string
  syncRunId: string
  createdAt: string
}

type AnalyticsMaintenanceJobData =
  | {
      kind: 'scan_due_connections'
      createdAt: string
    }
  | {
      kind: 'normalize_events'
      limit: number
      createdAt: string
    }
  | {
      kind: 'baseline_check'
      createdAt: string
    }

type AnalyticsJobData = AnalyticsSyncJobData | AnalyticsMaintenanceJobData

const QUEUE_NAME = 'analytics-pipeline'
const REPEAT_SCAN_JOB_NAME = 'analytics-scan-due-connections'
const REPEAT_NORMALIZE_JOB_NAME = 'analytics-normalize-events'
const REPEAT_BASELINE_CHECK_JOB_NAME = 'analytics-baseline-check'
const SYNC_LOCK_TTL_MS = 45 * 60 * 1000
const REPEAT_SCAN_EVERY_MS = 5 * 60 * 1000
const REPEAT_NORMALIZE_EVERY_MS = 5 * 60 * 1000
const REPEAT_BASELINE_CHECK_EVERY_MS = 24 * 60 * 60 * 1000
const SYNCABLE_SOURCES = new Set<AnalyticsConnectionSource>(['ga4', 'ads', 'search_console'])

@Injectable()
export class AnalyticsQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsQueueService.name)
  private queue: Queue<AnalyticsJobData> | null = null
  private worker: Worker<AnalyticsJobData> | null = null
  private redis: Redis | null = null
  private inlineMode = false
  private readonly isWorkerMode =
    (process.env.ANALYTICS_QUEUE_WORKER ?? '').toLowerCase() === 'true'
  private readonly attempts: number
  private readonly retryDelayMs: number
  private readonly concurrency: number

  constructor(
    private readonly config: ConfigService,
    private readonly repository: AnalyticsRepository,
    private readonly moduleRef: ModuleRef,
    private readonly analyticsService: AnalyticsService,
    private readonly dataParityService: AnalyticsDataParityService,
  ) {
    this.attempts = Number(this.config.get<string>('ANALYTICS_QUEUE_ATTEMPTS') ?? '5')
    this.retryDelayMs = Number(this.config.get<string>('ANALYTICS_QUEUE_RETRY_DELAY_MS') ?? '15000')
    this.concurrency = Number(this.config.get<string>('ANALYTICS_QUEUE_CONCURRENCY') ?? '4')
  }

  async onModuleInit() {
    const connectionString =
      this.config.get<string>('ANALYTICS_QUEUE_URL') ||
      this.config.get<string>('QUEUE_REDIS_URL') ||
      this.config.get<string>('REDIS_URL')

    if (!connectionString) {
      if ((this.config.get<string>('NODE_ENV') ?? 'development') === 'production') {
        throw new Error('Analytics queue requires Redis in production.')
      }
      this.inlineMode = true
      this.logger.warn('No Redis connection string provided for analytics queue. Falling back to inline mode.')
      return
    }

    this.redis = new Redis(connectionString, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })

    this.queue = new Queue<AnalyticsJobData>(QUEUE_NAME, {
      connection: this.redis,
      defaultJobOptions: this.getDefaultJobOptions(),
    })

    await this.ensureRepeatableJobs()

    if (this.isWorkerMode) {
      this.worker = new Worker<AnalyticsJobData>(
        QUEUE_NAME,
        async (job) => this.handleJob(job),
        {
          connection: this.redis,
          concurrency: this.concurrency,
          autorun: true,
        },
      )

      this.worker.on('failed', (job, error) => {
        if (!job) {
          return
        }
        this.logger.error(`Analytics job ${job.name}:${job.id} failed after ${job.attemptsMade} attempts: ${error?.message}`)
      })
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close()
      this.worker = null
    }
    if (this.queue) {
      await this.queue.close()
      this.queue = null
    }
    if (this.redis) {
      try {
        await this.redis.quit()
      } catch (error) {
        this.logger.error(`Failed to close analytics Redis connection: ${(error as Error).message}`)
      } finally {
        this.redis = null
      }
    }
  }

  async enqueueInitialSync(
    source: 'ga4',
    connectionId: string,
    window: SyncWindow,
  ): Promise<AnalyticsGa4SyncResult>
  async enqueueInitialSync(
    source: 'ads',
    connectionId: string,
    window: SyncWindow,
  ): Promise<AnalyticsAdsSyncResult>
  async enqueueInitialSync(
    source: 'search_console',
    connectionId: string,
    window: SyncWindow,
  ): Promise<AnalyticsSearchConsoleSyncResult>
  async enqueueInitialSync(
    source: AnalyticsConnectionSource,
    connectionId: string,
    window: SyncWindow,
  ) {
    return this.enqueueSync(source, connectionId, 'initial_sync', window)
  }

  async enqueueIncrementalSync(
    source: 'ga4',
    connectionId: string,
    window: SyncWindow,
  ): Promise<AnalyticsGa4SyncResult>
  async enqueueIncrementalSync(
    source: 'ads',
    connectionId: string,
    window: SyncWindow,
  ): Promise<AnalyticsAdsSyncResult>
  async enqueueIncrementalSync(
    source: 'search_console',
    connectionId: string,
    window: SyncWindow,
  ): Promise<AnalyticsSearchConsoleSyncResult>
  async enqueueIncrementalSync(
    source: AnalyticsConnectionSource,
    connectionId: string,
    window: SyncWindow,
  ) {
    return this.enqueueSync(source, connectionId, 'incremental_sync', window)
  }

  async enqueueBackfillSync(
    source: 'ga4',
    connectionId: string,
    window: SyncWindow,
  ): Promise<AnalyticsGa4SyncResult>
  async enqueueBackfillSync(
    source: 'ads',
    connectionId: string,
    window: SyncWindow,
  ): Promise<AnalyticsAdsSyncResult>
  async enqueueBackfillSync(
    source: 'search_console',
    connectionId: string,
    window: SyncWindow,
  ): Promise<AnalyticsSearchConsoleSyncResult>
  async enqueueBackfillSync(
    source: AnalyticsConnectionSource,
    connectionId: string,
    window: SyncWindow,
  ) {
    return this.enqueueSync(source, connectionId, 'backfill', window)
  }

  async enqueueRepairSync(
    source: 'ga4',
    connectionId: string,
    window: SyncWindow,
  ): Promise<AnalyticsGa4SyncResult>
  async enqueueRepairSync(
    source: 'ads',
    connectionId: string,
    window: SyncWindow,
  ): Promise<AnalyticsAdsSyncResult>
  async enqueueRepairSync(
    source: 'search_console',
    connectionId: string,
    window: SyncWindow,
  ): Promise<AnalyticsSearchConsoleSyncResult>
  async enqueueRepairSync(
    source: AnalyticsConnectionSource,
    connectionId: string,
    window: SyncWindow,
  ) {
    return this.enqueueSync(source, connectionId, 'repair', window)
  }

  async enqueueNormalization(limit = 1000) {
    const createdAt = new Date().toISOString()
    const jobId = 'analytics-normalize-events-repeatable'

    if (this.inlineMode || !this.queue) {
      return this.analyticsService.runNormalizationBatch(limit)
    }

    await this.queue.add(
      REPEAT_NORMALIZE_JOB_NAME,
      {
        kind: 'normalize_events',
        limit,
        createdAt,
      },
      {
        jobId,
        repeat: {
          every: REPEAT_NORMALIZE_EVERY_MS,
        },
      },
    )

    return { scheduled: true, jobId }
  }

  private async enqueueSync(
    source: AnalyticsConnectionSource,
    connectionId: string,
    jobType: AnalyticsSyncJobType,
    window: SyncWindow,
  ) {
    const jobId = this.buildSyncJobId(source, connectionId, jobType, window)
    const queuedAt = new Date()

    if (!this.inlineMode && this.queue) {
      const existingJob = await this.queue.getJob(jobId)
      if (existingJob?.data?.kind === 'sync') {
        const existingSyncRun = await this.repository.findSyncRunById(existingJob.data.syncRunId)
        if (existingSyncRun) {
          return this.formatQueuedResult(source, existingSyncRun, window)
        }
      }
    }

    const syncRun = await this.repository.createSyncRun({
      connectionId,
      jobType,
      fromDate: window.fromDate,
      toDate: window.toDate,
      status: 'pending',
      queuedAt,
      retryCount: 0,
      partialFailureFlag: false,
    })

    if (this.inlineMode || !this.queue) {
      return this.executeSyncJob({
        source,
        connectionId,
        jobType,
        fromDate: window.fromDate,
        toDate: window.toDate,
        syncRunId: syncRun.id,
        createdAt: queuedAt.toISOString(),
      })
    }

    try {
      await this.queue.add(
        `sync:${source}`,
        {
          kind: 'sync',
          source,
          connectionId,
          jobType,
          fromDate: window.fromDate.toISOString(),
          toDate: window.toDate.toISOString(),
          syncRunId: syncRun.id,
          createdAt: queuedAt.toISOString(),
        },
        {
          jobId,
          attempts: this.attempts,
          backoff: {
            type: 'exponential',
            delay: this.retryDelayMs,
          },
          removeOnComplete: true,
          removeOnFail: false,
        } satisfies JobsOptions,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await this.repository.updateSyncRun(syncRun.id, {
        status: 'failed',
        errorMessage: message,
        finishedAt: new Date(),
        durationMs: 0,
        partialFailureFlag: false,
      })
      throw error
    }

    return this.formatQueuedResult(source, syncRun as unknown as AnalyticsSyncRun, window)
  }

  private async ensureRepeatableJobs() {
    if (!this.queue) {
      return
    }

    await this.queue.add(
      REPEAT_SCAN_JOB_NAME,
      {
        kind: 'scan_due_connections',
        createdAt: new Date().toISOString(),
      },
      {
        jobId: 'analytics-scan-due-connections-repeatable',
        repeat: {
          every: REPEAT_SCAN_EVERY_MS,
        },
      },
    )

    await this.queue.add(
      REPEAT_NORMALIZE_JOB_NAME,
      {
        kind: 'normalize_events',
        limit: 1000,
        createdAt: new Date().toISOString(),
      },
      {
        jobId: 'analytics-normalize-events-repeatable',
        repeat: {
          every: REPEAT_NORMALIZE_EVERY_MS,
        },
      },
    )

    await this.queue.add(
      REPEAT_BASELINE_CHECK_JOB_NAME,
      {
        kind: 'baseline_check',
        createdAt: new Date().toISOString(),
      },
      {
        jobId: 'analytics-baseline-check-repeatable',
        repeat: {
          every: REPEAT_BASELINE_CHECK_EVERY_MS,
        },
      },
    )
  }

  private getDefaultJobOptions(): JobsOptions {
    return {
      attempts: this.attempts,
      removeOnComplete: true,
      removeOnFail: false,
      backoff: {
        type: 'exponential',
        delay: this.retryDelayMs,
      },
    }
  }

  private async handleJob(job: Job<AnalyticsJobData>) {
    if (job.data.kind === 'sync') {
      return this.executeSyncJob({
        source: job.data.source,
        connectionId: job.data.connectionId,
        jobType: job.data.jobType,
        fromDate: new Date(job.data.fromDate),
        toDate: new Date(job.data.toDate),
        syncRunId: job.data.syncRunId,
        createdAt: job.data.createdAt,
        attemptsMade: job.attemptsMade,
      })
    }

    if (job.data.kind === 'normalize_events') {
      return this.analyticsService.runNormalizationBatch(job.data.limit)
    }

    if (job.data.kind === 'baseline_check') {
      return this.dataParityService.runProductionBaselineCheck()
    }

    return this.handleScanDueConnections()
  }

  private async handleScanDueConnections() {
    const now = Date.now()
    const connections = await this.repository.listConnections()
    const dueConnections = connections.filter((connection) => {
      if (!SYNCABLE_SOURCES.has(connection.source as AnalyticsConnectionSource)) {
        return false
      }
      if (connection.status === 'syncing' || connection.needsReauth) {
        return false
      }
      if (!connection.nextSyncAt) {
        return false
      }
      const nextSyncAt = new Date(connection.nextSyncAt).getTime()
      return Number.isFinite(nextSyncAt) && nextSyncAt <= now
    })

    for (const connection of dueConnections) {
      const activeRun = await this.repository.hasActiveSyncRun(connection.id)
      if (activeRun) {
        continue
      }
      const window = await this.resolveIncrementalWindow(connection.id)
      if (!window) {
        continue
      }

      try {
        await this.enqueueSync(connection.source as AnalyticsConnectionSource, connection.id, 'incremental_sync', window)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.logger.warn(`Failed to enqueue due analytics sync for ${connection.source}:${connection.id}: ${message}`)
      }
    }

    return { scanned: connections.length, enqueued: dueConnections.length }
  }

  private async executeSyncJob(input: {
    source: AnalyticsConnectionSource
    connectionId: string
    jobType: AnalyticsSyncJobType
    fromDate: Date
    toDate: Date
    syncRunId: string
    createdAt: string
    attemptsMade?: number
  }) {
    const lockKey = this.buildLockKey(input.source, input.connectionId)
    const lockToken = randomUUID()
    const lockAcquired = await this.acquireLock(lockKey, lockToken, SYNC_LOCK_TTL_MS)
    if (!lockAcquired) {
      throw new Error(`Analytics sync already running for ${input.source}:${input.connectionId}`)
    }

    const startedAt = new Date()
    try {
      await this.repository.updateSyncRun(input.syncRunId, {
        status: 'running',
        queuedAt: new Date(input.createdAt),
        retryCount: input.attemptsMade ?? 0,
        startedAt,
      })

      switch (input.source) {
        case 'ga4':
          return this.moduleRef.get(Ga4ConnectorService, { strict: false }).executeQueuedSync({
            connectionId: input.connectionId,
            jobType: input.jobType,
            fromDate: input.fromDate,
            toDate: input.toDate,
            syncRunId: input.syncRunId,
            startedAt,
            retries: input.attemptsMade ?? 0,
          })
        case 'ads':
          return this.moduleRef.get(AdsConnectorService, { strict: false }).executeQueuedSync({
            connectionId: input.connectionId,
            jobType: input.jobType,
            fromDate: input.fromDate,
            toDate: input.toDate,
            syncRunId: input.syncRunId,
            startedAt,
            retries: input.attemptsMade ?? 0,
          })
        case 'search_console':
          return this.moduleRef.get(SearchConsoleConnectorService, { strict: false }).executeQueuedSync({
            connectionId: input.connectionId,
            jobType: input.jobType,
            fromDate: input.fromDate,
            toDate: input.toDate,
            syncRunId: input.syncRunId,
            startedAt,
            retries: input.attemptsMade ?? 0,
          })
        default:
          throw new Error(`Unsupported analytics source: ${input.source}`)
      }
    } finally {
      await this.releaseLock(lockKey, lockToken)
    }
  }

  private async resolveIncrementalWindow(connectionId: string): Promise<SyncWindow | null> {
    const entry = await this.repository.findConnectionById(connectionId)
    if (!entry) {
      return null
    }
    const lastSuccessfulSyncAt = entry.lastSuccessfulSyncAt ?? entry.lastSyncedAt ?? null
    const parsedLastSuccessfulSyncAt =
      typeof lastSuccessfulSyncAt === 'string' ? new Date(lastSuccessfulSyncAt) : lastSuccessfulSyncAt
    if (!parsedLastSuccessfulSyncAt || Number.isNaN(parsedLastSuccessfulSyncAt.getTime())) {
      return {
        fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        toDate: new Date(),
      }
    }
    const fromDate = lastSuccessfulSyncAt
      ? new Date(parsedLastSuccessfulSyncAt.getTime() - 3 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    return {
      fromDate,
      toDate: new Date(),
    }
  }

  private buildSyncJobId(
    source: AnalyticsConnectionSource,
    connectionId: string,
    jobType: AnalyticsSyncJobType,
    window: SyncWindow,
  ) {
    const normalizeTimestamp = (value: Date) =>
      new Date(Math.floor(value.getTime() / 60000) * 60000).toISOString()
    return [
      'analytics-sync',
      source,
      connectionId,
      jobType,
      normalizeTimestamp(window.fromDate),
      normalizeTimestamp(window.toDate),
    ].join(':')
  }

  private buildLockKey(source: AnalyticsConnectionSource, connectionId: string) {
    return `analytics:lock:sync:${source}:${connectionId}`
  }

  private async acquireLock(key: string, token: string, ttlMs: number) {
    if (!this.redis) {
      return true
    }
    const result = await this.redis.set(key, token, 'PX', ttlMs, 'NX')
    return result === 'OK'
  }

  private async releaseLock(key: string, token: string) {
    if (!this.redis) {
      return
    }
    const script = `
      if redis.call("GET", KEYS[1]) == ARGV[1] then
        return redis.call("DEL", KEYS[1])
      end
      return 0
    `
    try {
      await this.redis.eval(script, 1, key, token)
    } catch (error) {
      this.logger.warn(`Failed to release analytics lock ${key}: ${(error as Error).message}`)
    }
  }

  private formatQueuedResult(
    source: AnalyticsConnectionSource,
    syncRun: AnalyticsSyncRun,
    window: SyncWindow,
  ): AnalyticsGa4SyncResult | AnalyticsAdsSyncResult | AnalyticsSearchConsoleSyncResult {
    const toIso = (value: string | Date | null | undefined) =>
      !value ? null : value instanceof Date ? value.toISOString() : new Date(value).toISOString()
    const syncRunPayload = {
      id: syncRun.id,
      connectionId: syncRun.connectionId,
      jobType: syncRun.jobType,
      fromDate: window.fromDate.toISOString(),
      toDate: window.toDate.toISOString(),
      status: syncRun.status as AnalyticsSyncRun['status'],
      queuedAt: toIso(syncRun.queuedAt),
      retryCount: syncRun.retryCount,
      partialFailureFlag: syncRun.partialFailureFlag,
      durationMs: syncRun.durationMs ?? null,
      recordsFetched: syncRun.recordsFetched,
      recordsUpserted: syncRun.recordsUpserted,
      errorMessage: syncRun.errorMessage,
      startedAt: toIso(syncRun.startedAt)!,
      finishedAt: toIso(syncRun.finishedAt),
      createdAt: toIso(syncRun.createdAt)!,
    }

    if (source === 'ga4') {
      return {
        connectionId: syncRun.connectionId,
        syncRun: syncRunPayload,
        ga4RowsUpserted: 0,
        reportingRowsUpserted: 0,
      }
    }

    if (source === 'ads') {
      return {
        connectionId: syncRun.connectionId,
        syncRun: syncRunPayload,
        adsRowsUpserted: 0,
      }
    }

    return {
      connectionId: syncRun.connectionId,
      syncRun: syncRunPayload,
      searchConsoleRowsUpserted: 0,
    }
  }
}

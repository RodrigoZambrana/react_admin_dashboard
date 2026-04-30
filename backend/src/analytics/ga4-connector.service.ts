import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  forwardRef,
  ServiceUnavailableException,
} from '@nestjs/common'
import { randomBytes, createHash } from 'crypto'

import { AnalyticsGoogleOAuthConfigService } from '../common/integrations/analytics-google-oauth-config.service'
import { ConfigEncryptionService } from '../common/security/config-encryption.service'
import { SecureConfigService } from '../common/security/secure-config.service'
import { AnalyticsQueueService } from './analytics-queue.service'
import { AnalyticsRepository } from './analytics.repository'
import { AnalyticsReportingService } from './reporting/analytics-reporting.service'
import { GA4_REPORT_CATALOG } from './reports/ga4-report-catalog'
import { buildGa4QueryHash } from './reports/ga4-report-quality'
import type {
  AnalyticsGa4OAuthStartResult,
  AnalyticsGa4Property,
  AnalyticsGa4SyncResult,
  AnalyticsSyncJobType,
} from './analytics.types'

const GA4_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GA4_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GA4_ADMIN_ENDPOINT = 'https://analyticsadmin.googleapis.com/v1alpha/accountSummaries'
const GA4_DATA_ENDPOINT = (propertyId: string) =>
  `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`

const GA4_SCOPES = ['https://www.googleapis.com/auth/analytics.readonly']
const OAUTH_SESSION_PREFIX = 'analytics:ga4:oauth'
const INITIAL_SYNC_DAYS = 30
const INCREMENTAL_OVERLAP_DAYS = 3
const RETRY_DELAY_MINUTES = 15
const OAUTH_TTL_MS = 15 * 60 * 1000
const PAGE_SIZE = 5000

type OAuthSessionRecord = {
  connectionId: string
  codeVerifier: string
  returnPath: string
  frontendOrigin: string | null
  expiresAt: string
}

type TokenResponse = {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope?: string
  token_type?: string
}

type AccountSummaryResponse = {
  accountSummaries?: Array<{
    account?: string
    displayName?: string
    propertySummaries?: Array<{
      property?: string
      displayName?: string
      propertyType?: string
    }>
  }>
}

type Ga4ReportRow = {
  dimensionValues?: Array<{ value?: string }>
  metricValues?: Array<{ value?: string }>
}

type Ga4ReportResponse = {
  rows?: Ga4ReportRow[]
}

type SyncRange = {
  from: Date
  to: Date
}

const base64UrlEncode = (buffer: Buffer) =>
  buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '')

const sha256Base64Url = (value: string) =>
  base64UrlEncode(createHash('sha256').update(value).digest())

const parseDimension = (row: Ga4ReportRow, index: number, fallback = 'unknown') => {
  const raw = row.dimensionValues?.[index]?.value?.trim()
  return raw && raw.length ? raw : fallback
}

const parseMetric = (row: Ga4ReportRow, index: number) => {
  const raw = row.metricValues?.[index]?.value
  const parsed = raw ? Number(raw) : 0
  return Number.isFinite(parsed) ? parsed : 0
}

const parseDateDimension = (value: string) => {
  if (!/^\d{8}$/.test(value)) {
    return new Date()
  }
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(4, 6)) - 1
  const day = Number(value.slice(6, 8))
  return new Date(Date.UTC(year, month, day))
}

const addDaysUtc = (value: Date, days: number) => {
  const clone = new Date(value)
  clone.setUTCDate(clone.getUTCDate() + days)
  return clone
}

const startOfDayUtc = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))

const normalizeTimestamp = (value: string) => {
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime()) ? new Date() : timestamp
}

const normalizeReturnPath = (returnPath?: string, frontendOrigin?: string | null) => {
  const trimmedReturnPath = returnPath?.trim() || '/app/analytics/connections'

  if (/^https?:\/\//iu.test(trimmedReturnPath)) {
    return trimmedReturnPath
  }

  if (frontendOrigin) {
    try {
      return new URL(trimmedReturnPath, frontendOrigin).toString()
    } catch {
      return trimmedReturnPath
    }
  }

  return trimmedReturnPath
}

@Injectable()
export class Ga4ConnectorService {
  private readonly logger = new Logger(Ga4ConnectorService.name)

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly googleConfig: AnalyticsGoogleOAuthConfigService,
    private readonly secureConfig: SecureConfigService,
    private readonly encryption: ConfigEncryptionService,
    private readonly reportParity: AnalyticsReportingService,
    @Inject(forwardRef(() => AnalyticsQueueService))
    private readonly analyticsQueue: AnalyticsQueueService,
  ) {}

  async startOAuth(
    returnPath?: string,
    frontendOrigin?: string | null,
  ): Promise<AnalyticsGa4OAuthStartResult> {
    const config = await this.googleConfig.getEffectiveConfig()
    const clientId = config.clientId
    const clientSecret = config.clientSecret
    const redirectUri = config.redirectUri

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('Google OAuth is not configured for analytics.')
    }

    const existing = await this.repository.findConnectionBySource('ga4')
    const connection = existing
      ? existing
      : await this.repository.createGa4Connection({
          displayName: 'Google Analytics 4',
          status: 'needs_auth',
          needsReauth: false,
        })

    await this.repository.updateConnection(connection.id, {
      status: 'needs_auth',
      needsReauth: false,
    })

    const state = randomBytes(32).toString('hex')
    const codeVerifier = base64UrlEncode(randomBytes(64))
    const expiresAt = new Date(Date.now() + OAUTH_TTL_MS)

    await this.secureConfig.setJson<OAuthSessionRecord>(this.getOAuthSessionKey(state), {
      connectionId: connection.id,
      codeVerifier,
      returnPath: normalizeReturnPath(returnPath, frontendOrigin),
      frontendOrigin: frontendOrigin?.trim() || null,
      expiresAt: expiresAt.toISOString(),
    })

    const url = new URL(GA4_AUTH_ENDPOINT)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', GA4_SCOPES.join(' '))
    url.searchParams.set('state', state)
    url.searchParams.set('code_challenge', sha256Base64Url(codeVerifier))
    url.searchParams.set('code_challenge_method', 'S256')
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')

    return {
      connectionId: connection.id,
      state,
      expiresAt: expiresAt.toISOString(),
      url: url.toString(),
    }
  }

  async completeOAuth(query: {
    state?: string | null
    code?: string | null
    error?: string | null
    error_description?: string | null
  }) {
    const state = (query.state ?? '').trim()
    if (!state) {
      throw new BadRequestException('Missing OAuth state.')
    }

    const session = await this.secureConfig.getJson<OAuthSessionRecord>(
      this.getOAuthSessionKey(state),
    )
    if (!session) {
      throw new BadRequestException('OAuth session not found or expired.')
    }

    const sessionValue = session.value
    if (new Date(sessionValue.expiresAt).getTime() < Date.now()) {
      await this.secureConfig.setString(this.getOAuthSessionKey(state), null)
      throw new BadRequestException('OAuth session expired.')
    }

    if (query.error) {
      await this.secureConfig.setString(this.getOAuthSessionKey(state), null)
      throw new BadRequestException(
        query.error_description?.trim() || `Google OAuth failed: ${query.error}`,
      )
    }

    const code = (query.code ?? '').trim()
    if (!code) {
      throw new BadRequestException('Missing authorization code.')
    }

    const config = await this.googleConfig.getEffectiveConfig()
    const clientId = config.clientId
    const clientSecret = config.clientSecret
    const redirectUri = config.redirectUri

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('Google OAuth is not configured for analytics.')
    }

    const token = await this.exchangeCode({
      code,
      codeVerifier: sessionValue.codeVerifier,
      clientId,
      clientSecret,
      redirectUri,
    })

    const expiresAt = new Date(Date.now() + token.expires_in * 1000)
    await this.repository.upsertConnectionCredentials(sessionValue.connectionId, {
      refreshTokenEncrypted: token.refresh_token
        ? this.encryption.encrypt(token.refresh_token)
        : null,
      accessTokenEncrypted: this.encryption.encrypt(token.access_token),
      expiresAt,
      scopes: GA4_SCOPES,
    })

    await this.repository.updateConnection(sessionValue.connectionId, {
      status: 'needs_auth',
      needsReauth: false,
    })

    await this.secureConfig.setString(this.getOAuthSessionKey(state), null)

  return {
    connectionId: sessionValue.connectionId,
    returnPath: sessionValue.returnPath,
    frontendOrigin: sessionValue.frontendOrigin,
  }
}

  async listProperties(connectionId: string): Promise<AnalyticsGa4Property[]> {
    const accessToken = await this.getValidAccessToken(connectionId)
    const response = await fetch(GA4_ADMIN_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const body = await this.safeJson(response)
      throw new InternalServerErrorException(
        `Unable to list GA4 properties: ${body?.error?.message ?? response.statusText}`,
      )
    }

    const payload = (await response.json()) as AccountSummaryResponse
    const properties: AnalyticsGa4Property[] = []

    for (const accountSummary of payload.accountSummaries ?? []) {
      const accountId = this.extractResourceId(accountSummary.account)
      const accountName = accountSummary.displayName ?? accountId
      for (const propertySummary of accountSummary.propertySummaries ?? []) {
        const propertyId = this.extractResourceId(propertySummary.property)
        if (!propertyId) {
          continue
        }
        properties.push({
          accountId,
          accountName,
          propertyId,
          propertyName: propertySummary.displayName ?? propertyId,
        })
      }
    }

    return properties
  }

  async selectProperty(connectionId: string, propertyId: string) {
    const property = await this.getPropertyById(connectionId, propertyId)
    if (!property) {
      throw new BadRequestException('Selected GA4 property is not available.')
    }

    await this.repository.updateConnection(connectionId, {
      externalAccountId: property.accountId,
      externalPropertyId: property.propertyId,
      displayName: property.propertyName,
      status: 'syncing',
      needsReauth: false,
      lastAttemptedSyncAt: null,
      lastSyncedAt: null,
      lastSuccessfulSyncAt: null,
      lastSyncErrorMessage: null,
      lastSyncErrorAt: null,
      nextSyncAt: null,
    })

    return this.runInitialSync(connectionId)
  }

  async runInitialSync(connectionId: string): Promise<AnalyticsGa4SyncResult> {
    const fromDate = addDaysUtc(new Date(), -(INITIAL_SYNC_DAYS - 1))
    return this.analyticsQueue.enqueueInitialSync('ga4', connectionId, {
      fromDate,
      toDate: new Date(),
    })
  }

  async executeQueuedSync(input: {
    connectionId: string
    jobType: AnalyticsSyncJobType
    fromDate: Date
    toDate: Date
    syncRunId: string
    startedAt: Date
    retries: number
  }): Promise<AnalyticsGa4SyncResult> {
    return this.runGa4Sync(input.connectionId, {
      jobType: input.jobType,
      fromDate: input.fromDate,
      toDate: input.toDate,
    }, input.syncRunId, input.startedAt, input.retries)
  }

  async runIncrementalSync(connectionId: string): Promise<AnalyticsGa4SyncResult> {
    const connection = await this.repository.findConnectionById(connectionId)
    if (!connection || connection.source !== 'ga4') {
      throw new BadRequestException('GA4 connection not found.')
    }

    const lastSuccessfulSyncAt = connection.lastSuccessfulSyncAt ?? connection.lastSyncedAt ?? null
    const fromDate = lastSuccessfulSyncAt
      ? addDaysUtc(startOfDayUtc(lastSuccessfulSyncAt), -INCREMENTAL_OVERLAP_DAYS)
      : addDaysUtc(new Date(), -(INITIAL_SYNC_DAYS - 1))

    return this.analyticsQueue.enqueueIncrementalSync('ga4', connectionId, {
      fromDate,
      toDate: new Date(),
    })
  }

  async runBackfill(
    connectionId: string,
    from?: string,
    to?: string,
  ): Promise<AnalyticsGa4SyncResult> {
    if (!from || !to) {
      throw new BadRequestException('Backfill requires from and to dates.')
    }

    return this.analyticsQueue.enqueueBackfillSync('ga4', connectionId, {
      fromDate: normalizeTimestamp(from),
      toDate: normalizeTimestamp(to),
    })
  }

  async runRepair(
    connectionId: string,
    from?: string,
    to?: string,
  ): Promise<AnalyticsGa4SyncResult> {
    const connection = await this.repository.findConnectionById(connectionId)
    if (!connection || connection.source !== 'ga4') {
      throw new BadRequestException('GA4 connection not found.')
    }

    const failedRun = await this.repository.getLatestFailedSyncRun(connectionId)
    const fromDate =
      from && from.trim().length
        ? normalizeTimestamp(from)
        : failedRun?.fromDate
          ? normalizeTimestamp(failedRun.fromDate)
          : connection.lastSuccessfulSyncAt ?? connection.lastSyncedAt ?? null
    const toDate =
      to && to.trim().length
        ? normalizeTimestamp(to)
        : failedRun?.toDate
          ? normalizeTimestamp(failedRun.toDate)
          : new Date()

    if (!fromDate || !toDate) {
      throw new BadRequestException('Repair requires a previous failed run or explicit from/to range.')
    }

    return this.analyticsQueue.enqueueRepairSync('ga4', connectionId, {
      fromDate,
      toDate,
    })
  }

  async runCanonicalReportSync(
    connectionId: string,
    from?: string,
    to?: string,
    reportKey?: string,
  ) {
    const connection = await this.repository.findConnectionById(connectionId)
    if (!connection || connection.source !== 'ga4') {
      throw new BadRequestException('GA4 connection not found.')
    }
    if (!connection.externalPropertyId) {
      throw new BadRequestException('GA4 property must be selected before syncing reports.')
    }

    const accessToken = await this.getValidAccessToken(connectionId)
    const propertyId = connection.externalPropertyId
    const fromDate = from ? normalizeTimestamp(from) : connection.lastSuccessfulSyncAt ?? new Date('2023-01-01T00:00:00.000Z')
    const toDate = to ? normalizeTimestamp(to) : new Date()
    let totalRows = 0
    const synced: Array<{ reportKey: string; rows: number }> = []

    const reports = reportKey
      ? GA4_REPORT_CATALOG.filter((report) => report.key === reportKey)
      : GA4_REPORT_CATALOG

    for (const report of reports) {
      if (!report.apiDefinition || report.apiDefinition.kind !== 'runReport') {
        continue
      }

      const rows = await this.fetchCanonicalReportRows({
        accessToken,
        propertyId,
        reportKey: report.key,
        dimensions: report.apiDefinition.dimensions,
        metrics: report.apiDefinition.metrics,
        dateRanges: report.apiDefinition.dateRanges?.length
          ? report.apiDefinition.dateRanges.map((range) => ({
              label: range.label,
              startDate: range.startDate === 'today' ? this.toGaDate(toDate) : range.startDate,
              endDate: range.endDate === 'today' ? this.toGaDate(toDate) : range.endDate,
            }))
          : [{ label: 'primary', startDate: this.toGaDate(fromDate), endDate: this.toGaDate(toDate) }],
        limit: report.apiDefinition.limit ?? PAGE_SIZE,
      })

      await this.reportParity.ingestCanonicalReportRows({
        reportKey: report.key,
        source: 'ga4_api',
        rows,
        fromDate,
        toDate,
        metadata: {
          connectionId,
          propertyId,
          reportKey: report.key,
          reportTitle: report.title,
        },
      })
      totalRows += rows.length
      synced.push({ reportKey: report.key, rows: rows.length })
    }

    return {
      connectionId,
      propertyId,
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      reportsSynced: synced,
      totalRows,
    }
  }

  async getReportBaseline(params: {
    connectionId: string
    reportKey: string
    fromDate: Date
    toDate: Date
  }) {
    const connection = await this.repository.findConnectionById(params.connectionId)
    if (!connection || connection.source !== 'ga4') {
      throw new BadRequestException('GA4 connection not found.')
    }
    if (!connection.externalPropertyId) {
      throw new BadRequestException('GA4 property must be selected before generating a baseline.')
    }

    const report = GA4_REPORT_CATALOG.find((entry) => entry.key === params.reportKey)
    if (!report || !report.apiDefinition || report.apiDefinition.kind !== 'runReport') {
      throw new BadRequestException(`GA4 report ${params.reportKey} is not baseline compatible.`)
    }

    const accessToken = await this.getValidAccessToken(params.connectionId)
    const propertyId = connection.externalPropertyId
    const dateRanges = report.apiDefinition.dateRanges?.length
      ? report.apiDefinition.dateRanges.map((range) => ({
          label: range.label,
          startDate: range.startDate === 'today' ? this.toGaDate(params.toDate) : range.startDate,
          endDate: range.endDate === 'today' ? this.toGaDate(params.toDate) : range.endDate,
        }))
      : [{ label: 'primary', startDate: this.toGaDate(params.fromDate), endDate: this.toGaDate(params.toDate) }]

    const rows = await this.fetchCanonicalReportRows({
      accessToken,
      propertyId,
      reportKey: report.key,
      dimensions: report.apiDefinition.dimensions,
      metrics: report.apiDefinition.metrics,
      dateRanges,
      limit: report.apiDefinition.limit ?? PAGE_SIZE,
    })

    return {
      connectionId: params.connectionId,
      propertyId,
      reportKey: report.key,
      fromDate: params.fromDate,
      toDate: params.toDate,
      queryHash: buildGa4QueryHash({
        connectionId: params.connectionId,
        propertyId,
        reportKey: report.key,
        fromDate: params.fromDate,
        toDate: params.toDate,
        dimensions: report.apiDefinition.dimensions,
        metrics: report.apiDefinition.metrics,
        dateRanges,
        limit: report.apiDefinition.limit ?? PAGE_SIZE,
      }),
      rows,
      report,
    }
  }

  private async runGa4Sync(
    connectionId: string,
    input: {
      jobType: AnalyticsSyncJobType
      fromDate: Date
      toDate: Date
    },
    syncRunId?: string,
    startedAt?: Date,
    retryCount = 0,
  ): Promise<AnalyticsGa4SyncResult> {
    const connection = await this.repository.findConnectionById(connectionId)
    if (!connection || connection.source !== 'ga4') {
      throw new BadRequestException('GA4 connection not found.')
    }
    if (!connection.externalPropertyId) {
      throw new BadRequestException('GA4 property must be selected before syncing.')
    }

    const now = new Date()
    const syncRun: any = syncRunId
      ? {
          id: syncRunId,
          connectionId,
          jobType: input.jobType,
          fromDate: input.fromDate,
          toDate: input.toDate,
          status: 'running' as const,
          queuedAt: startedAt ?? now,
          retryCount,
          partialFailureFlag: false,
          durationMs: null as number | null,
          recordsFetched: 0,
          recordsUpserted: 0,
          errorMessage: null as string | null,
          startedAt: startedAt ?? now,
          finishedAt: null as Date | null,
          createdAt: startedAt ?? now,
        }
      : await this.repository.createSyncRun({
          connectionId,
          jobType: input.jobType,
          fromDate: input.fromDate,
          toDate: input.toDate,
          status: 'running',
          queuedAt: now,
          retryCount,
        })

    await this.repository.updateConnection(connectionId, {
      status: 'syncing',
      needsReauth: false,
      lastAttemptedSyncAt: now,
      lastSyncErrorMessage: null,
      lastSyncErrorAt: null,
    })

    try {
      const accessToken = await this.getValidAccessToken(connectionId)
      const propertyId = connection.externalPropertyId
      const baseRows = await this.fetchAllReportRows({
        accessToken,
        propertyId,
        dimensions: ['date', 'sessionSource', 'sessionMedium', 'sessionCampaignName'],
        metrics: ['sessions', 'totalUsers', 'eventCount', 'keyEvents', 'totalRevenue'],
        fromDate: input.fromDate,
        toDate: input.toDate,
      })

      const detailRows = await this.fetchAllReportRows({
        accessToken,
        propertyId,
        dimensions: [
          'date',
          'sessionDefaultChannelGroup',
          'sessionSource',
          'sessionMedium',
          'sessionCampaignName',
          'landingPagePlusQueryString',
          'deviceCategory',
          'country',
        ],
        metrics: ['sessions', 'totalUsers', 'eventCount', 'keyEvents', 'totalRevenue'],
        fromDate: input.fromDate,
        toDate: input.toDate,
      })

      const ga4RowsUpserted = await this.persistGa4DailyMetrics(connectionId, syncRun.id, baseRows)
      const reportingRowsUpserted = await this.persistReportingDailyMetrics(
        detailRows,
        connectionId,
        syncRun.id,
      )

      const finishedAt = new Date()
      const durationMs = startedAt ? finishedAt.getTime() - startedAt.getTime() : null
      const nextSyncAt =
        input.jobType === 'repair'
          ? connection.nextSyncAt ?? new Date(Date.now() + (connection.syncIntervalMinutes ?? 60) * 60 * 1000)
          : new Date(Date.now() + (connection.syncIntervalMinutes ?? 60) * 60 * 1000)

      await this.repository.updateSyncRun(syncRun.id, {
        status: 'success',
        durationMs,
        recordsFetched: baseRows.length + detailRows.length,
        recordsUpserted: ga4RowsUpserted + reportingRowsUpserted,
        finishedAt,
      })
      await this.repository.updateConnection(connectionId, {
        status: 'ready',
        needsReauth: false,
        lastAttemptedSyncAt: now,
        lastSyncedAt: finishedAt,
        lastSuccessfulSyncAt: finishedAt,
        lastSyncErrorMessage: null,
        lastSyncErrorAt: null,
        nextSyncAt,
      })

      return {
        connectionId,
        syncRun: {
          id: syncRun.id,
          connectionId,
          jobType: input.jobType,
          fromDate: input.fromDate.toISOString(),
          toDate: input.toDate.toISOString(),
          status: 'success',
          queuedAt: (syncRun.queuedAt ?? startedAt ?? now).toISOString(),
          retryCount: syncRun.retryCount,
          partialFailureFlag: false,
          durationMs,
          recordsFetched: baseRows.length + detailRows.length,
          recordsUpserted: ga4RowsUpserted + reportingRowsUpserted,
          errorMessage: null,
          startedAt: syncRun.startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          createdAt: syncRun.createdAt.toISOString(),
        },
        ga4RowsUpserted,
        reportingRowsUpserted,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const failedAt = new Date()
      this.logger.error(`GA4 ${input.jobType} failed for connection ${connectionId}: ${message}`)
      await this.repository.updateSyncRun(syncRun.id, {
        status: 'failed',
        errorMessage: message,
        finishedAt: failedAt,
        durationMs: startedAt ? failedAt.getTime() - startedAt.getTime() : null,
        partialFailureFlag: false,
      })
      await this.repository.updateConnection(connectionId, {
        status: 'error',
        needsReauth: this.isAuthError(error),
        lastAttemptedSyncAt: now,
        lastSyncErrorMessage: message,
        lastSyncErrorAt: failedAt,
        nextSyncAt: this.isAuthError(error)
          ? null
          : new Date(Date.now() + RETRY_DELAY_MINUTES * 60 * 1000),
      })
      throw error
    }
  }

  private async persistGa4DailyMetrics(connectionId: string, syncRunId: string, rows: Ga4ReportRow[]) {
    let upserted = 0
    for (const row of rows) {
      const date = parseDateDimension(parseDimension(row, 0, '19700101'))
      const source = parseDimension(row, 1)
      const medium = parseDimension(row, 2)
      const campaign = parseDimension(row, 3)

      await this.repository.upsertGa4DailyMetric({
        date,
        source,
        medium,
        campaign,
        sessions: parseMetric(row, 0),
        users: parseMetric(row, 1),
        eventCount: parseMetric(row, 2),
        keyEvents: parseMetric(row, 3),
        purchases: parseMetric(row, 3),
        revenue: parseMetric(row, 4),
        connectionId,
        syncRunId,
      })
      upserted += 1
    }

    return upserted
  }

  private async persistReportingDailyMetrics(
    rows: Ga4ReportRow[],
    connectionId: string,
    syncRunId: string,
  ) {
    let upserted = 0
    for (const row of rows) {
      const date = parseDateDimension(parseDimension(row, 0, '19700101'))
      const channel = parseDimension(row, 1)
      const source = parseDimension(row, 2)
      const medium = parseDimension(row, 3)
      const campaign = parseDimension(row, 4)
      const landingPage = parseDimension(row, 5)
      const device = parseDimension(row, 6)
      const country = parseDimension(row, 7)
      const sessions = parseMetric(row, 0)
      const users = parseMetric(row, 1)
      const eventCount = parseMetric(row, 2)
      const keyEvents = parseMetric(row, 3)
      const revenue = parseMetric(row, 4)

      await this.repository.upsertReportingDaily({
        date,
        channel,
        source,
        medium,
        campaign,
        productId: '',
        landingPage,
        device,
        country,
        sessions,
        users,
        revenue,
        orders: 0,
        cost: 0,
        impressions: 0,
        clicks: 0,
        views: eventCount,
        addToCart: 0,
        eventCount,
        keyEvents,
        ga4PurchaseProxy: keyEvents,
        purchase: 0,
      })
      upserted += 1
    }

    return upserted
  }

  private async fetchAllReportRows(params: {
    accessToken: string
    propertyId: string
    dimensions: string[]
    metrics: string[]
    fromDate: Date
    toDate: Date
  }) {
    const rows: Ga4ReportRow[] = []
    let offset = 0

    while (true) {
      const response = await fetch(GA4_DATA_ENDPOINT(params.propertyId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: [
            {
              startDate: this.toGaDate(params.fromDate),
              endDate: this.toGaDate(params.toDate),
            },
          ],
          dimensions: params.dimensions.map((name) => ({ name })),
          metrics: params.metrics.map((name) => ({ name })),
          limit: PAGE_SIZE,
          offset,
        }),
      })

      if (!response.ok) {
        const body = await this.safeJson(response)
        throw new InternalServerErrorException(
          `Unable to sync GA4 data: ${body?.error?.message ?? response.statusText}`,
        )
      }

      const payload = (await response.json()) as Ga4ReportResponse
      const batch = payload.rows ?? []
      rows.push(...batch)

      if (batch.length < PAGE_SIZE) {
        break
      }
      offset += PAGE_SIZE
    }

    return rows
  }

  private async fetchCanonicalReportRows(params: {
    accessToken: string
    propertyId: string
    reportKey: string
    dimensions: string[]
    metrics: string[]
    dateRanges: Array<{
      label: string
      startDate: string
      endDate: string
    }>
    limit?: number
  }) {
    const rows: Record<string, unknown>[] = []
    let offset = 0
    const limit = params.limit ?? PAGE_SIZE
    const paginate = params.limit == null

    while (true) {
      const response = await fetch(GA4_DATA_ENDPOINT(params.propertyId), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dateRanges: params.dateRanges.map((range) => ({
            startDate: range.startDate,
            endDate: range.endDate,
          })),
          dimensions: params.dimensions.map((name) => ({ name })),
          metrics: params.metrics.map((name) => ({ name })),
          limit,
          offset,
        }),
      })

      if (!response.ok) {
        const body = await this.safeJson(response)
        throw new InternalServerErrorException(
          `Unable to sync GA4 canonical report ${params.reportKey}: ${body?.error?.message ?? response.statusText}`,
        )
      }

      const payload = (await response.json()) as Ga4ReportResponse
      const batch = payload.rows ?? []
      for (const [index, row] of batch.entries()) {
        const normalized: Record<string, unknown> = {}
        for (let dimIndex = 0; dimIndex < params.dimensions.length; dimIndex += 1) {
          normalized[`dimension_${dimIndex}`] = row.dimensionValues?.[dimIndex]?.value ?? null
        }
        for (const [metricIndex, metricValue] of (row.metricValues ?? []).entries()) {
          normalized[`metric_${metricIndex}`] = metricValue?.value ?? null
        }
        normalized._rowIndex = offset + index
        normalized._dateRanges = params.dateRanges
        rows.push(normalized)
      }

      if (!paginate || batch.length < limit) {
        break
      }
      offset += limit
    }

    if (params.dimensions[0] === 'date') {
      rows.sort((left, right) =>
        String(left.dimension_0 ?? '').localeCompare(String(right.dimension_0 ?? '')),
      )
    }

    return rows
  }

  private async getPropertyById(connectionId: string, propertyId: string) {
    const properties = await this.listProperties(connectionId)
    return (
      properties.find((property) => property.propertyId === propertyId) ?? null
    )
  }

  private async getValidAccessToken(connectionId: string) {
    const credential = await this.repository.getConnectionCredentials(connectionId)
    if (!credential) {
      throw new BadRequestException('GA4 credentials are not stored for this connection.')
    }

    const expiresAt = credential.expiresAt ? new Date(credential.expiresAt) : null
    const refreshToken = credential.refreshTokenEncrypted
      ? this.encryption.decrypt(credential.refreshTokenEncrypted)
      : null

    if (expiresAt && expiresAt.getTime() - Date.now() > 60_000) {
      if (!credential.accessTokenEncrypted) {
        throw new BadRequestException('GA4 access token is missing.')
      }
      return this.encryption.decrypt(credential.accessTokenEncrypted)
    }

    if (!refreshToken) {
      throw new BadRequestException('GA4 refresh token is missing and the connection must be reauthorized.')
    }

    const config = await this.googleConfig.getEffectiveConfig()
    const clientId = config.clientId
    const clientSecret = config.clientSecret
    if (!clientId || !clientSecret) {
      throw new ServiceUnavailableException('Google OAuth is not configured for analytics.')
    }

    const refreshed = await this.refreshToken({
      clientId,
      clientSecret,
      refreshToken,
    })

    const nextExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000)
    await this.repository.upsertConnectionCredentials(connectionId, {
      refreshTokenEncrypted: this.encryption.encrypt(refreshToken),
      accessTokenEncrypted: this.encryption.encrypt(refreshed.access_token),
      expiresAt: nextExpiresAt,
      scopes: refreshed.scope ? refreshed.scope.split(' ').filter(Boolean) : GA4_SCOPES,
    })

    return refreshed.access_token
  }

  private async exchangeCode(params: {
    code: string
    codeVerifier: string
    clientId: string
    clientSecret: string
    redirectUri: string
  }) {
    const response = await fetch(GA4_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        code: params.code,
        code_verifier: params.codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: params.redirectUri,
      }),
    })

    if (!response.ok) {
      const body = await this.safeJson(response)
      throw new InternalServerErrorException(
        `Unable to exchange GA4 authorization code: ${body?.error_description ?? body?.error ?? response.statusText}`,
      )
    }

    return (await response.json()) as TokenResponse
  }

  private async refreshToken(params: {
    clientId: string
    clientSecret: string
    refreshToken: string
  }) {
    const response = await fetch(GA4_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        refresh_token: params.refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      const body = await this.safeJson(response)
      throw new InternalServerErrorException(
        `Unable to refresh GA4 access token: ${body?.error_description ?? body?.error ?? response.statusText}`,
      )
    }

    return (await response.json()) as TokenResponse
  }

  private async safeJson(response: Response) {
    try {
      return await response.json()
    } catch {
      return null
    }
  }

  private extractResourceId(value?: string | null) {
    if (!value) {
      return ''
    }
    const parts = value.split('/')
    return parts[parts.length - 1] ?? value
  }

  private toGaDate(value: Date) {
    return value.toISOString().slice(0, 10)
  }

  private isAuthError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    return /unauthorized|invalid_grant|forbidden|reauthor/i.test(message)
  }

  private getOAuthSessionKey(state: string) {
    return `${OAUTH_SESSION_PREFIX}:${state}`
  }
}

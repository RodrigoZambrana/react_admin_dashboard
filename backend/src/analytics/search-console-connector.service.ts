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
import { ConfigService } from '@nestjs/config'

import { AnalyticsGoogleOAuthConfigService } from '../common/integrations/analytics-google-oauth-config.service'
import { ConfigEncryptionService } from '../common/security/config-encryption.service'
import { SecureConfigService } from '../common/security/secure-config.service'
import { AnalyticsQueueService } from './analytics-queue.service'
import { AnalyticsRepository } from './analytics.repository'
import type {
  AnalyticsSearchConsoleOAuthStartResult,
  AnalyticsSearchConsoleProperty,
  AnalyticsSearchConsoleSyncResult,
  AnalyticsSyncJobType,
} from './analytics.types'

const SC_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const SC_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const SC_SITES_ENDPOINT = 'https://searchconsole.googleapis.com/webmasters/v3/sites'
const SC_DATA_ENDPOINT = (siteUrl: string) =>
  `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`

const SC_SCOPES = ['https://www.googleapis.com/auth/webmasters.readonly']
const OAUTH_SESSION_PREFIX = 'analytics:search-console:oauth'
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

type SearchConsoleSiteEntry = {
  siteUrl?: string
  permissionLevel?: string
}

type SearchConsoleSitesResponse = {
  siteEntry?: SearchConsoleSiteEntry[]
}

type SearchConsoleRow = {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

type SearchConsoleQueryResponse = {
  rows?: SearchConsoleRow[]
}

const base64UrlEncode = (buffer: Buffer) =>
  buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '')

const sha256Base64Url = (value: string) =>
  base64UrlEncode(createHash('sha256').update(value).digest())

const parseMetric = (value: number | undefined, fallback = 0) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }
  return value
}

const parseDateDimension = (value: string) => {
  if (!/^\d{8}$/u.test(value)) {
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
export class SearchConsoleConnectorService {
  private readonly logger = new Logger(SearchConsoleConnectorService.name)

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly googleConfig: AnalyticsGoogleOAuthConfigService,
    private readonly secureConfig: SecureConfigService,
    private readonly encryption: ConfigEncryptionService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AnalyticsQueueService))
    private readonly analyticsQueue: AnalyticsQueueService,
  ) {}

  async startOAuth(
    returnPath?: string,
    frontendOrigin?: string | null,
  ): Promise<AnalyticsSearchConsoleOAuthStartResult> {
    const config = await this.googleConfig.getEffectiveConfig()
    const clientId = config.clientId
    const clientSecret = config.clientSecret
    const redirectUri = config.redirectUri

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('Google OAuth is not configured for analytics.')
    }

    const existing = await this.repository.findConnectionBySource('search_console')
    const connection = existing
      ? existing
      : await this.repository.createSearchConsoleConnection({
          displayName: 'Search Console',
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

    const url = new URL(SC_AUTH_ENDPOINT)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', SC_SCOPES.join(' '))
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
      scopes: SC_SCOPES,
    })

    await this.repository.updateConnection(sessionValue.connectionId, {
      status: 'needs_auth',
      needsReauth: false,
    })

    const properties = await this.listPropertiesFromAccessToken(token.access_token)
    const preferredProperty = this.getPreferredPropertyUrl()
    const selectedProperty =
      (preferredProperty
        ? properties.find((property) => property.siteUrl === preferredProperty)
        : null) ?? (properties.length === 1 ? properties[0] : null)

    if (selectedProperty) {
      await this.repository.updateConnection(sessionValue.connectionId, {
        externalAccountId: selectedProperty.siteUrl,
        externalPropertyId: selectedProperty.siteUrl,
        displayName: selectedProperty.siteUrl,
        status: 'ready',
        needsReauth: false,
        lastAttemptedSyncAt: null,
        lastSyncedAt: null,
        lastSuccessfulSyncAt: null,
        lastSyncErrorMessage: null,
        lastSyncErrorAt: null,
        nextSyncAt: null,
      })
    }

    await this.secureConfig.setString(this.getOAuthSessionKey(state), null)

    return {
      connectionId: sessionValue.connectionId,
      returnPath: sessionValue.returnPath,
      frontendOrigin: sessionValue.frontendOrigin,
    }
  }

  async listProperties(connectionId: string): Promise<AnalyticsSearchConsoleProperty[]> {
    const accessToken = await this.getValidAccessToken(connectionId)
    return this.listPropertiesFromAccessToken(accessToken)
  }

  async selectProperty(connectionId: string, siteUrl: string) {
    const property = await this.getPropertyByUrl(connectionId, siteUrl)
    if (!property) {
      throw new BadRequestException('Selected Search Console property is not available.')
    }

    await this.repository.updateConnection(connectionId, {
      externalAccountId: property.siteUrl,
      externalPropertyId: property.siteUrl,
      displayName: property.siteUrl,
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

  async runInitialSync(connectionId: string): Promise<AnalyticsSearchConsoleSyncResult> {
    const fromDate = addDaysUtc(new Date(), -(INITIAL_SYNC_DAYS - 1))
    return this.analyticsQueue.enqueueInitialSync('search_console', connectionId, {
      fromDate,
      toDate: new Date(),
    })
  }

  async runIncrementalSync(connectionId: string): Promise<AnalyticsSearchConsoleSyncResult> {
    const connection = await this.repository.findConnectionById(connectionId)
    if (!connection || connection.source !== 'search_console') {
      throw new BadRequestException('Search Console connection not found.')
    }

    const lastSuccessfulSyncAt = connection.lastSuccessfulSyncAt ?? connection.lastSyncedAt ?? null
    const fromDate = lastSuccessfulSyncAt
      ? addDaysUtc(startOfDayUtc(lastSuccessfulSyncAt), -INCREMENTAL_OVERLAP_DAYS)
      : addDaysUtc(new Date(), -(INITIAL_SYNC_DAYS - 1))

    return this.analyticsQueue.enqueueIncrementalSync('search_console', connectionId, {
      fromDate,
      toDate: new Date(),
    })
  }

  async runBackfill(
    connectionId: string,
    from?: string,
    to?: string,
  ): Promise<AnalyticsSearchConsoleSyncResult> {
    if (!from || !to) {
      throw new BadRequestException('Backfill requires from and to dates.')
    }

    return this.analyticsQueue.enqueueBackfillSync('search_console', connectionId, {
      fromDate: normalizeTimestamp(from),
      toDate: normalizeTimestamp(to),
    })
  }

  async runRepair(
    connectionId: string,
    from?: string,
    to?: string,
  ): Promise<AnalyticsSearchConsoleSyncResult> {
    const connection = await this.repository.findConnectionById(connectionId)
    if (!connection || connection.source !== 'search_console') {
      throw new BadRequestException('Search Console connection not found.')
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

    return this.analyticsQueue.enqueueRepairSync('search_console', connectionId, {
      fromDate,
      toDate,
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
  }): Promise<AnalyticsSearchConsoleSyncResult> {
    return this.runSearchConsoleSync(
      input.connectionId,
      {
        jobType: input.jobType,
        fromDate: input.fromDate,
        toDate: input.toDate,
      },
      input.syncRunId,
      input.startedAt,
      input.retries,
    )
  }

  private async runSearchConsoleSync(
    connectionId: string,
    input: {
      jobType: AnalyticsSyncJobType
      fromDate: Date
      toDate: Date
    },
    syncRunId?: string,
    startedAt?: Date,
    retryCount = 0,
  ): Promise<AnalyticsSearchConsoleSyncResult> {
    const connection = await this.repository.findConnectionById(connectionId)
    if (!connection || connection.source !== 'search_console') {
      throw new BadRequestException('Search Console connection not found.')
    }

    if (!connection.externalPropertyId) {
      throw new BadRequestException('Search Console property must be selected before syncing.')
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
      const rows = await this.fetchAllReportRows({
        accessToken,
        siteUrl: connection.externalPropertyId,
        fromDate: input.fromDate,
        toDate: input.toDate,
      })

      const upserted = await this.persistSearchConsoleDailyMetrics(connectionId, syncRun.id, rows)
      const finishedAt = new Date()
      const durationMs = startedAt ? finishedAt.getTime() - startedAt.getTime() : null
      const nextSyncAt =
        input.jobType === 'repair'
          ? connection.nextSyncAt ??
            new Date(Date.now() + (connection.syncIntervalMinutes ?? 60) * 60 * 1000)
          : new Date(Date.now() + (connection.syncIntervalMinutes ?? 60) * 60 * 1000)

      await this.repository.updateSyncRun(syncRun.id, {
        status: 'success',
        durationMs,
        recordsFetched: rows.length,
        recordsUpserted: upserted,
        finishedAt,
      })
      await this.repository.updateConnection(connectionId, {
        status: 'ready',
        needsReauth: false,
        externalAccountId: connection.externalPropertyId,
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
          recordsFetched: rows.length,
          recordsUpserted: upserted,
          errorMessage: null,
          startedAt: syncRun.startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          createdAt: syncRun.createdAt.toISOString(),
        },
        searchConsoleRowsUpserted: upserted,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const failedAt = new Date()
      this.logger.error(`Search Console ${input.jobType} failed for connection ${connectionId}: ${message}`)
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

  private async persistSearchConsoleDailyMetrics(
    connectionId: string,
    syncRunId: string,
    rows: SearchConsoleRow[],
  ) {
    let upserted = 0
    for (const row of rows) {
      const [dateRaw, queryRaw, pageRaw] = row.keys ?? []
      if (!dateRaw || !queryRaw) {
        continue
      }

      await this.repository.upsertSearchConsoleDailyMetric({
        date: parseDateDimension(dateRaw),
        query: queryRaw,
        page: pageRaw?.trim() || null,
        clicks: Math.round(parseMetric(row.clicks)),
        impressions: Math.round(parseMetric(row.impressions)),
        ctr: Number(parseMetric(row.ctr).toFixed(6)),
        position: Number(parseMetric(row.position).toFixed(6)),
        connectionId,
        syncRunId,
      })
      upserted += 1
    }

    return upserted
  }

  private async fetchAllReportRows(params: {
    accessToken: string
    siteUrl: string
    fromDate: Date
    toDate: Date
  }) {
    const rows: SearchConsoleRow[] = []
    let startRow = 0

    while (true) {
      const response = await fetch(SC_DATA_ENDPOINT(params.siteUrl), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: this.toGaDate(params.fromDate),
          endDate: this.toGaDate(params.toDate),
          dimensions: ['date', 'query', 'page'],
          rowLimit: PAGE_SIZE,
          startRow,
        }),
      })

      if (!response.ok) {
        const body = await this.safeJson(response)
        throw new InternalServerErrorException(
          `Unable to sync Search Console data: ${body?.error?.message ?? response.statusText}`,
        )
      }

      const payload = (await response.json()) as SearchConsoleQueryResponse
      const batch = payload.rows ?? []
      rows.push(...batch)

      if (batch.length < PAGE_SIZE) {
        break
      }
      startRow += batch.length
    }

    return rows
  }

  private async listPropertiesFromAccessToken(
    accessToken: string,
  ): Promise<AnalyticsSearchConsoleProperty[]> {
    const response = await fetch(SC_SITES_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const body = await this.safeJson(response)
      throw new InternalServerErrorException(
        `Unable to list Search Console properties: ${body?.error?.message ?? response.statusText}`,
      )
    }

    const payload = (await response.json()) as SearchConsoleSitesResponse
    return (payload.siteEntry ?? [])
      .map((entry) => {
        const siteUrl = entry.siteUrl?.trim()
        if (!siteUrl) {
          return null
        }
        return {
          siteUrl,
          permissionLevel: entry.permissionLevel ?? null,
          siteType: siteUrl.startsWith('sc-domain:') ? 'domain' : 'url',
        } satisfies AnalyticsSearchConsoleProperty
      })
      .filter((entry): entry is AnalyticsSearchConsoleProperty => Boolean(entry))
  }

  private async getPropertyByUrl(connectionId: string, siteUrl: string) {
    const accessToken = await this.getValidAccessToken(connectionId)
    const properties = await this.listPropertiesFromAccessToken(accessToken)
    return properties.find((property) => property.siteUrl === siteUrl) ?? null
  }

  private async getValidAccessToken(connectionId: string) {
    const credential = await this.repository.getConnectionCredentials(connectionId)
    if (!credential) {
      throw new BadRequestException('Search Console credentials are not stored for this connection.')
    }

    const expiresAt = credential.expiresAt ? new Date(credential.expiresAt) : null
    const refreshToken = credential.refreshTokenEncrypted
      ? this.encryption.decrypt(credential.refreshTokenEncrypted)
      : null

    if (expiresAt && expiresAt.getTime() - Date.now() > 60_000) {
      if (!credential.accessTokenEncrypted) {
        throw new BadRequestException('Search Console access token is missing.')
      }
      return this.encryption.decrypt(credential.accessTokenEncrypted)
    }

    if (!refreshToken) {
      throw new BadRequestException(
        'Search Console refresh token is missing and the connection must be reauthorized.',
      )
    }

    const google = await this.googleConfig.getEffectiveConfig()
    const clientId = google.clientId
    const clientSecret = google.clientSecret
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
      scopes: refreshed.scope ? refreshed.scope.split(' ').filter(Boolean) : SC_SCOPES,
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
    const response = await fetch(SC_TOKEN_ENDPOINT, {
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
        `Unable to exchange Search Console authorization code: ${body?.error_description ?? body?.error ?? response.statusText}`,
      )
    }

    return (await response.json()) as TokenResponse
  }

  private async refreshToken(params: {
    clientId: string
    clientSecret: string
    refreshToken: string
  }) {
    const response = await fetch(SC_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: params.clientId,
        client_secret: params.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: params.refreshToken,
      }),
    })

    if (!response.ok) {
      const body = await this.safeJson(response)
      throw new InternalServerErrorException(
        `Unable to refresh Search Console access token: ${body?.error_description ?? body?.error ?? response.statusText}`,
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

  private getOAuthSessionKey(state: string) {
    return `${OAUTH_SESSION_PREFIX}:${state}`
  }

  private getPreferredPropertyUrl() {
    const preferred = this.config.get<string>('GOOGLE_SEARCH_CONSOLE_PROPERTY')
    const fallback = this.config.get<string>('SEARCH_CONSOLE_PROPERTY')
    const value = (preferred ?? fallback ?? '').trim()
    return value.length ? value : null
  }

  private toGaDate(value: Date) {
    return value.toISOString().slice(0, 10)
  }

  private isAuthError(error: unknown) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
    return (
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('permission') ||
      message.includes('authentication') ||
      message.includes('authorization') ||
      message.includes('invalid_grant') ||
      message.includes('developer token') ||
      message.includes('reauthoriz')
    )
  }
}

import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import { randomBytes, createHash } from 'crypto'

import { AnalyticsGoogleOAuthConfigService } from '../common/integrations/analytics-google-oauth-config.service'
import { GoogleAdsConfigService } from '../common/integrations/google-ads-config.service'
import { ConfigEncryptionService } from '../common/security/config-encryption.service'
import { SecureConfigService } from '../common/security/secure-config.service'
import { AnalyticsRepository } from './analytics.repository'
import type {
  AnalyticsAdsOAuthStartResult,
  AnalyticsAdsSyncResult,
  AnalyticsSyncJobType,
} from './analytics.types'

const ADS_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const ADS_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const ADS_API_VERSION = 'v22'
const ADS_DATA_ENDPOINT = (customerId: string) =>
  `https://googleads.googleapis.com/${ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`

const ADS_SCOPES = ['https://www.googleapis.com/auth/adwords']
const OAUTH_SESSION_PREFIX = 'analytics:ads:oauth'
const INITIAL_SYNC_DAYS = 30
const INCREMENTAL_OVERLAP_DAYS = 3
const RETRY_DELAY_MINUTES = 15
const OAUTH_TTL_MS = 15 * 60 * 1000

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

type AdsCustomerMetadata = {
  customerId: string
  descriptiveName: string | null
  currencyCode: string | null
}

type AdsReportRow = {
  customer?: {
    id?: string
    descriptiveName?: string
    currencyCode?: string
  }
  segments?: {
    date?: string
  }
  campaign?: {
    id?: string
    name?: string
  }
  metrics?: {
    clicks?: string
    impressions?: string
    costMicros?: string
    conversions?: string
    conversionsValue?: string
  }
}

type AdsSearchStreamChunk = {
  results?: AdsReportRow[]
}

const base64UrlEncode = (buffer: Buffer) =>
  buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '')

const sha256Base64Url = (value: string) =>
  base64UrlEncode(createHash('sha256').update(value).digest())

const parseMetric = (value: string | undefined, fallback = 0) => {
  if (!value) {
    return fallback
  }
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const parseMicrosToDecimal = (value: string | undefined) => {
  const parsed = parseMetric(value, 0)
  return Number((parsed / 1_000_000).toFixed(4))
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

const normalizeCustomerId = (value: string) => value.replace(/\D+/g, '')

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
export class AdsConnectorService {
  private readonly logger = new Logger(AdsConnectorService.name)

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly googleConfig: AnalyticsGoogleOAuthConfigService,
    private readonly adsConfig: GoogleAdsConfigService,
    private readonly secureConfig: SecureConfigService,
    private readonly encryption: ConfigEncryptionService,
  ) {}

  async startOAuth(
    returnPath?: string,
    frontendOrigin?: string | null,
  ): Promise<AnalyticsAdsOAuthStartResult> {
    const google = await this.googleConfig.getEffectiveConfig()
    const clientId = google.clientId
    const clientSecret = google.clientSecret
    const redirectUri = google.redirectUri
    const ads = this.adsConfig.getEffectiveConfig()

    if (!clientId || !clientSecret || !redirectUri) {
      throw new ServiceUnavailableException('Google OAuth is not configured for analytics.')
    }

    if (!ads.developerToken || !ads.customerId) {
      throw new ServiceUnavailableException('Google Ads is not configured for analytics.')
    }

    const existing = await this.repository.findConnectionBySource('ads')
    const connection = existing
      ? existing
      : await this.repository.createAdsConnection({
          displayName: 'Google Ads',
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

    const url = new URL(ADS_AUTH_ENDPOINT)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', ADS_SCOPES.join(' '))
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

    const google = await this.googleConfig.getEffectiveConfig()
    const clientId = google.clientId
    const clientSecret = google.clientSecret
    const redirectUri = google.redirectUri
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
      scopes: ADS_SCOPES,
    })

    const ads = this.adsConfig.getEffectiveConfig()
    if (!ads.customerId || !ads.developerToken) {
      throw new ServiceUnavailableException('Google Ads is not configured for analytics.')
    }

    const accessToken = token.access_token
    const metadata = await this.getCustomerMetadata(accessToken, ads.customerId)
    await this.repository.updateConnection(sessionValue.connectionId, {
      externalAccountId: metadata.customerId,
      externalPropertyId: null,
      displayName: metadata.descriptiveName ?? `Google Ads ${metadata.customerId}`,
      status: 'ready',
      needsReauth: false,
      lastAttemptedSyncAt: null,
      lastSyncedAt: null,
      lastSuccessfulSyncAt: null,
      lastSyncErrorMessage: null,
      lastSyncErrorAt: null,
      nextSyncAt: null,
    })

    await this.secureConfig.setString(this.getOAuthSessionKey(state), null)

    return {
      connectionId: sessionValue.connectionId,
      returnPath: sessionValue.returnPath,
      frontendOrigin: sessionValue.frontendOrigin,
    }
  }

  async runInitialSync(connectionId: string): Promise<AnalyticsAdsSyncResult> {
    const fromDate = addDaysUtc(new Date(), -(INITIAL_SYNC_DAYS - 1))
    return this.runAdsSync(connectionId, {
      jobType: 'initial_sync',
      fromDate,
      toDate: new Date(),
    })
  }

  async runIncrementalSync(connectionId: string): Promise<AnalyticsAdsSyncResult> {
    const connection = await this.repository.findConnectionById(connectionId)
    if (!connection || connection.source !== 'ads') {
      throw new BadRequestException('Google Ads connection not found.')
    }

    const lastSuccessfulSyncAt = connection.lastSuccessfulSyncAt ?? connection.lastSyncedAt ?? null
    const fromDate = lastSuccessfulSyncAt
      ? addDaysUtc(startOfDayUtc(lastSuccessfulSyncAt), -INCREMENTAL_OVERLAP_DAYS)
      : addDaysUtc(new Date(), -(INITIAL_SYNC_DAYS - 1))

    return this.runAdsSync(connectionId, {
      jobType: 'incremental_sync',
      fromDate,
      toDate: new Date(),
    })
  }

  async runBackfill(connectionId: string, from?: string, to?: string): Promise<AnalyticsAdsSyncResult> {
    if (!from || !to) {
      throw new BadRequestException('Backfill requires from and to dates.')
    }

    return this.runAdsSync(connectionId, {
      jobType: 'backfill',
      fromDate: normalizeTimestamp(from),
      toDate: normalizeTimestamp(to),
    })
  }

  async runRepair(connectionId: string, from?: string, to?: string): Promise<AnalyticsAdsSyncResult> {
    const connection = await this.repository.findConnectionById(connectionId)
    if (!connection || connection.source !== 'ads') {
      throw new BadRequestException('Google Ads connection not found.')
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

    return this.runAdsSync(connectionId, {
      jobType: 'repair',
      fromDate,
      toDate,
    })
  }

  private async runAdsSync(
    connectionId: string,
    input: {
      jobType: AnalyticsSyncJobType
      fromDate: Date
      toDate: Date
    },
  ): Promise<AnalyticsAdsSyncResult> {
    const connection = await this.repository.findConnectionById(connectionId)
    if (!connection || connection.source !== 'ads') {
      throw new BadRequestException('Google Ads connection not found.')
    }

    const ads = this.adsConfig.getEffectiveConfig()
    const customerId = normalizeCustomerId(connection.externalAccountId ?? ads.customerId ?? '')
    if (!customerId) {
      throw new BadRequestException('Google Ads customerId is not configured for this connection.')
    }
    if (!ads.developerToken) {
      throw new ServiceUnavailableException('Google Ads developer token is not configured.')
    }

    const now = new Date()
    const syncRun = await this.repository.createSyncRun({
      connectionId,
      jobType: input.jobType,
      fromDate: input.fromDate,
      toDate: input.toDate,
      status: 'running',
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
        customerId,
        query: this.buildCampaignReportQuery(input.fromDate, input.toDate),
      })

      const adsRowsUpserted = await this.persistAdsDailyMetrics(connectionId, syncRun.id, rows)

      const finishedAt = new Date()
      const nextSyncAt =
        input.jobType === 'repair'
          ? connection.nextSyncAt ??
            new Date(Date.now() + (connection.syncIntervalMinutes ?? 60) * 60 * 1000)
          : new Date(Date.now() + (connection.syncIntervalMinutes ?? 60) * 60 * 1000)

      await this.repository.updateSyncRun(syncRun.id, {
        status: 'success',
        recordsFetched: rows.length,
        recordsUpserted: adsRowsUpserted,
        finishedAt,
      })
      await this.repository.updateConnection(connectionId, {
        status: 'ready',
        needsReauth: false,
        externalAccountId: customerId,
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
          recordsFetched: rows.length,
          recordsUpserted: adsRowsUpserted,
          errorMessage: null,
          startedAt: syncRun.startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          createdAt: syncRun.createdAt.toISOString(),
        },
        adsRowsUpserted,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const failedAt = new Date()
      this.logger.error(`Google Ads ${input.jobType} failed for connection ${connectionId}: ${message}`)
      await this.repository.updateSyncRun(syncRun.id, {
        status: 'failed',
        errorMessage: message,
        finishedAt: failedAt,
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

  private async persistAdsDailyMetrics(
    connectionId: string,
    syncRunId: string,
    rows: AdsReportRow[],
  ) {
    let upserted = 0
    for (const row of rows) {
      const dateRaw = row.segments?.date ?? ''
      const campaignId = row.campaign?.id?.trim() || row.campaign?.name?.trim() || 'unknown'

      await this.repository.upsertAdsDailyMetric({
        date: parseDateDimension(dateRaw),
        campaign: campaignId,
        clicks: parseMetric(row.metrics?.clicks),
        impressions: parseMetric(row.metrics?.impressions),
        cost: parseMicrosToDecimal(row.metrics?.costMicros),
        conversions: Math.round(parseMetric(row.metrics?.conversions)),
        conversionValue: Number(parseMetric(row.metrics?.conversionsValue).toFixed(4)),
        connectionId,
        syncRunId,
      })
      upserted += 1
    }

    return upserted
  }

  private async fetchAllReportRows(params: {
    accessToken: string
    customerId: string
    query: string
  }) {
    const response = await fetch(ADS_DATA_ENDPOINT(params.customerId), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': 'application/json',
        'developer-token': this.requireDeveloperToken(),
      },
      body: JSON.stringify({
        query: params.query,
      }),
    })

    if (!response.ok) {
      const body = await this.safeJson(response)
      throw new InternalServerErrorException(
        `Unable to sync Google Ads data: ${body?.error?.message ?? response.statusText}`,
      )
    }

    const payload = (await response.json()) as AdsSearchStreamChunk[] | AdsSearchStreamChunk
    const chunks = Array.isArray(payload) ? payload : [payload]
    const rows: AdsReportRow[] = []
    for (const chunk of chunks) {
      rows.push(...(chunk.results ?? []))
    }
    return rows
  }

  private buildCampaignReportQuery(fromDate: Date, toDate: Date) {
    return `
      SELECT
        segments.date,
        campaign.id,
        campaign.name,
        metrics.clicks,
        metrics.impressions,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value
      FROM campaign
      WHERE segments.date BETWEEN '${this.toGaDate(fromDate)}' AND '${this.toGaDate(toDate)}'
      ORDER BY segments.date, campaign.id
    `.replace(/\s+/g, ' ').trim()
  }

  private async getCustomerMetadata(accessToken: string, customerId: string): Promise<AdsCustomerMetadata> {
    const rows = await this.fetchAllReportRows({
      accessToken,
      customerId,
      query: `
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code
        FROM customer
        LIMIT 1
      `
        .replace(/\s+/g, ' ')
        .trim(),
    })

    const firstRow = rows[0] as AdsReportRow | undefined
    const metadataCustomerId = normalizeCustomerId(firstRow?.customer?.id ?? customerId)
    return {
      customerId: metadataCustomerId,
      descriptiveName: firstRow?.customer?.descriptiveName ?? null,
      currencyCode: firstRow?.customer?.currencyCode ?? null,
    }
  }

  private async getValidAccessToken(connectionId: string) {
    const credential = await this.repository.getConnectionCredentials(connectionId)
    if (!credential) {
      throw new BadRequestException('Google Ads credentials are not stored for this connection.')
    }

    const expiresAt = credential.expiresAt ? new Date(credential.expiresAt) : null
    const refreshToken = credential.refreshTokenEncrypted
      ? this.encryption.decrypt(credential.refreshTokenEncrypted)
      : null

    if (expiresAt && expiresAt.getTime() - Date.now() > 60_000) {
      if (!credential.accessTokenEncrypted) {
        throw new BadRequestException('Google Ads access token is missing.')
      }
      return this.encryption.decrypt(credential.accessTokenEncrypted)
    }

    if (!refreshToken) {
      throw new BadRequestException(
        'Google Ads refresh token is missing and the connection must be reauthorized.',
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
      scopes: refreshed.scope ? refreshed.scope.split(' ').filter(Boolean) : ADS_SCOPES,
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
    const response = await fetch(ADS_TOKEN_ENDPOINT, {
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
        `Unable to exchange Google Ads authorization code: ${body?.error_description ?? body?.error ?? response.statusText}`,
      )
    }

    return (await response.json()) as TokenResponse
  }

  private async refreshToken(params: {
    clientId: string
    clientSecret: string
    refreshToken: string
  }) {
    const response = await fetch(ADS_TOKEN_ENDPOINT, {
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
        `Unable to refresh Google Ads access token: ${body?.error_description ?? body?.error ?? response.statusText}`,
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

  private requireDeveloperToken() {
    const ads = this.adsConfig.getEffectiveConfig()
    if (!ads.developerToken) {
      throw new ServiceUnavailableException('Google Ads developer token is not configured.')
    }
    return ads.developerToken
  }

  private getOAuthSessionKey(state: string) {
    return `${OAUTH_SESSION_PREFIX}:${state}`
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

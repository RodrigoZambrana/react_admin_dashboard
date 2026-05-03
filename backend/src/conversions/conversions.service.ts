import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { createHash } from 'crypto'
import { Prisma } from '@prisma/client'

import { AnalyticsRepository } from '../analytics/analytics.repository'
import { AdsConnectorService } from '../analytics/ads-connector.service'
import { GrowthService } from '../growth/growth.service'
import { GoogleAdsConfigService } from '../common/integrations/google-ads-config.service'
import { PrismaService } from '../prisma/prisma.service'
import { resolveConversionMapEntry } from './conversion-map'
import type {
  ConversionReceiptListItem,
  ConversionTrackResult,
  TrackConversionInput,
} from './conversions.types'

const GOOGLE_ADS_API_VERSION = 'v22'

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

const normalizeCurrency = (value: unknown) => {
  const raw = asString(value)
  return raw ? raw.toUpperCase() : null
}

const normalizePhone = (value: string | null | undefined) => {
  const raw = asString(value)
  if (!raw) {
    return null
  }
  if (/^\+\d{6,15}$/u.test(raw)) {
    return raw
  }
  const digits = raw.replace(/\D+/g, '')
  if (!digits.length) {
    return null
  }
  return `+${digits}`
}

const hashSha256 = (value: string) =>
  createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

const toGoogleAdsDateTime = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value)
  const normalized = Number.isNaN(date.getTime()) ? new Date() : date
  const pad = (input: number) => String(input).padStart(2, '0')
  const offsetMinutes = -normalized.getTimezoneOffset()
  const sign = offsetMinutes >= 0 ? '+' : '-'
  const absOffset = Math.abs(offsetMinutes)
  const offsetHours = pad(Math.floor(absOffset / 60))
  const offsetMins = pad(absOffset % 60)
  return [
    normalized.getFullYear(),
    '-',
    pad(normalized.getMonth() + 1),
    '-',
    pad(normalized.getDate()),
    ' ',
    pad(normalized.getHours()),
    ':',
    pad(normalized.getMinutes()),
    ':',
    pad(normalized.getSeconds()),
    sign,
    offsetHours,
    ':',
    offsetMins,
  ].join('')
}

const resolveCustomerId = (value: string | null | undefined) => {
  const raw = asString(value)
  if (!raw) {
    return null
  }
  const digits = raw.replace(/\D+/g, '')
  return digits.length ? digits : null
}

const resolveConversionActionResource = (customerId: string, actionId: string) => {
  const trimmed = actionId.trim()
  if (trimmed.startsWith('customers/')) {
    return trimmed
  }
  const normalized = trimmed.replace(/^conversionActions\//iu, '')
  return `customers/${customerId}/conversionActions/${normalized}`
}

const extractFromRecord = (input: TrackConversionInput, keys: string[]) => {
  const data = input.data ?? {}
  const metadata = (input.metadata ?? {}) as Record<string, unknown>
  const search = [input as Record<string, unknown>, data, metadata]
  for (const bucket of search) {
    for (const key of keys) {
      const value = bucket[key]
      const str = asString(value)
      if (str) {
        return str
      }
    }
  }
  return null
}

const extractContactEvidence = (input: TrackConversionInput) => {
  const email = extractFromRecord(input, ['user_email', 'email', 'customer_email', 'budgetCustomerEmail'])
  const phone = normalizePhone(
    extractFromRecord(input, ['user_phone', 'phone', 'customer_phone', 'budgetCustomerPhone']),
  )
  return {
    email,
    phone,
  }
}

const extractTransactionId = (input: TrackConversionInput) =>
  extractFromRecord(input, [
    'transaction_id',
    'order_id',
    'document_id',
    'documentId',
    'transactionId',
    'orderId',
  ])

const extractConversionValue = (input: TrackConversionInput) => {
  const directValue = asNumber(input.value)
  if (directValue !== null) {
    return directValue
  }
  const metadata = (input.metadata ?? {}) as Record<string, unknown>
  const data = input.data ?? {}
  return (
    asNumber(metadata.value) ??
    asNumber(metadata.order_total) ??
    asNumber(metadata.grand_total) ??
    asNumber(data.value) ??
    asNumber(data.order_total) ??
    asNumber(data.grand_total)
  )
}

const extractCurrency = (input: TrackConversionInput) => {
  const directCurrency = normalizeCurrency(input.currency)
  if (directCurrency) {
    return directCurrency
  }
  const metadata = (input.metadata ?? {}) as Record<string, unknown>
  const data = input.data ?? {}
  return (
    normalizeCurrency(metadata.currency) ??
    normalizeCurrency(metadata.order_currency) ??
    normalizeCurrency(data.currency) ??
    normalizeCurrency(data.order_currency) ??
    'UYU'
  )
}

const extractUserIdentifiers = (input: TrackConversionInput) => {
  const evidence = extractContactEvidence(input)
  const identifiers: Array<Record<string, unknown>> = []
  if (evidence.email) {
    identifiers.push({
      hashedEmail: hashSha256(evidence.email),
      userIdentifierSource: 'FIRST_PARTY',
    })
  }
  if (evidence.phone) {
    identifiers.push({
      hashedPhoneNumber: hashSha256(evidence.phone),
      userIdentifierSource: 'FIRST_PARTY',
    })
  }
  return identifiers
}

const buildDedupeKey = (input: TrackConversionInput, canonicalName: string, transactionId: string | null) => {
  const eventId = asString(input.event_id) ?? asString((input.data ?? {})['event_id']) ?? null
  if (transactionId) {
    return `purchase:${canonicalName}:${transactionId}`
  }
  if (eventId) {
    return `${canonicalName}:${eventId}`
  }
  const sessionId = asString(input.session_id) ?? 'sessionless'
  const timestamp = asString(input.timestamp) ?? new Date().toISOString()
  return `${canonicalName}:${sessionId}:${timestamp}`
}

const toJson = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue

@Injectable()
export class ConversionsService {
  private readonly logger = new Logger(ConversionsService.name)

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly adsConnector: AdsConnectorService,
    private readonly growth: GrowthService,
    private readonly googleAdsConfig: GoogleAdsConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async track(input: TrackConversionInput): Promise<ConversionTrackResult> {
    const canonical = resolveConversionMapEntry(input.event)
    if (!canonical) {
      return this.skip(input, 'not_mapped', null, null)
    }

    const transactionId = extractTransactionId(input)
    const value = extractConversionValue(input)
    const currency = extractCurrency(input)
    const evidence = extractContactEvidence(input)
    const eventId = asString(input.event_id) ?? asString((input.data ?? {})['event_id']) ?? null
    const gclid = asString(input.gclid) ?? asString((input.data ?? {})['gclid']) ?? null
    const wbraid = asString(input.wbraid) ?? asString((input.data ?? {})['wbraid']) ?? null
    const gbraid = asString(input.gbraid) ?? asString((input.data ?? {})['gbraid']) ?? null
    const dedupeKey = buildDedupeKey(input, canonical.canonicalName, transactionId)
    const requestPayload = toJson({
      ...input,
      canonical_conversion_name: canonical.canonicalName,
      transaction_id: transactionId,
      currency,
      gclid,
      wbraid,
      gbraid,
    })

    const existing = await this.repository.findConversionReceiptByDedupeKey(dedupeKey)
    if (existing?.status === 'sent') {
      return {
        status: 'skipped',
        reason: 'duplicate',
        internalEventName: input.event,
        canonicalConversionName: canonical.canonicalName,
        receiptId: existing.id,
        dedupeKey,
        googleAds: {
          configured: true,
          uploaded: false,
          customerId: null,
          conversionActionResource: existing.adsConversionResource ?? null,
        },
      }
    }

    const receipt = existing
      ? await this.repository.updateConversionReceipt(existing.id, {
          status: 'pending',
          reason: null,
          attemptCount: (existing.attemptCount ?? 0) + 1,
          lastAttemptAt: new Date(),
          errorMessage: null,
        })
      : await this.repository.createConversionReceipt({
          internalEventName: input.event,
          canonicalConversionName: canonical.canonicalName,
          adsConversionAction: canonical.canonicalName,
          transactionId,
          eventId,
          gclid,
          wbraid,
          gbraid,
          value,
          currency,
          status: 'pending',
          reason: null,
          dedupeKey,
          requestPayload,
          attemptCount: 1,
          lastAttemptAt: new Date(),
        })

    if (canonical.requiresTransactionId && !transactionId) {
      await this.repository.updateConversionReceipt(receipt.id, {
        status: 'skipped',
        reason: 'missing_transaction_id',
        errorMessage: null,
        lastAttemptAt: new Date(),
      })
      return this.skip(input, 'missing_transaction_id', canonical.canonicalName, receipt.id, dedupeKey)
    }

    if (canonical.requiresValue && (!value || value <= 0)) {
      await this.repository.updateConversionReceipt(receipt.id, {
        status: 'skipped',
        reason: 'missing_conversion_value',
        errorMessage: null,
        lastAttemptAt: new Date(),
      })
      return this.skip(input, 'missing_conversion_value', canonical.canonicalName, receipt.id, dedupeKey)
    }

    if (canonical.requiresContactEvidence && !evidence.email && !evidence.phone && !gclid && !wbraid && !gbraid) {
      await this.repository.updateConversionReceipt(receipt.id, {
        status: 'skipped',
        reason: 'evidence_insufficient',
        errorMessage: null,
        lastAttemptAt: new Date(),
      })
      return this.skip(input, 'evidence_insufficient', canonical.canonicalName, receipt.id, dedupeKey)
    }

    const adsContext = await this.resolveGoogleAdsContext()
    if (!adsContext.configured) {
      await this.repository.updateConversionReceipt(receipt.id, {
        status: 'skipped',
        reason: adsContext.reason,
        errorMessage: null,
        lastAttemptAt: new Date(),
      })
      return this.skip(input, adsContext.reason ?? 'google_ads_not_configured', canonical.canonicalName, receipt.id, dedupeKey)
    }

    const userIdentifiers = extractUserIdentifiers(input)
    if (!gclid && !wbraid && !gbraid && userIdentifiers.length === 0) {
      await this.repository.updateConversionReceipt(receipt.id, {
        status: 'skipped',
        reason: 'identifiers_missing',
        errorMessage: null,
        lastAttemptAt: new Date(),
      })
      return this.skip(input, 'identifiers_missing', canonical.canonicalName, receipt.id, dedupeKey)
    }
    const clickConversion: Record<string, unknown> = {
      conversionAction: adsContext.conversionActionResource,
      conversionDateTime: toGoogleAdsDateTime(input.timestamp),
      conversionEnvironment: 'WEB',
    }

    if (transactionId) {
      clickConversion.orderId = transactionId
    }
    if (value && value > 0) {
      clickConversion.conversionValue = value
      clickConversion.currencyCode = currency
    }
    if (gclid) {
      clickConversion.gclid = gclid
    }
    if (wbraid) {
      clickConversion.wbraid = wbraid
    }
    if (gbraid) {
      clickConversion.gbraid = gbraid
    }
    if (userIdentifiers.length > 0) {
      clickConversion.userIdentifiers = userIdentifiers
    }

    try {
      const response = await this.uploadClickConversion(adsContext.customerId, adsContext.accessToken, clickConversion)
      const responsePayload = toJson(response)
      await this.repository.updateConversionReceipt(receipt.id, {
        status: 'sent',
        reason: null,
        responsePayload,
        errorMessage: null,
        sentAt: new Date(),
        lastAttemptAt: new Date(),
      })
      return {
        status: 'sent',
        reason: null,
        internalEventName: input.event,
        canonicalConversionName: canonical.canonicalName,
        receiptId: receipt.id,
        dedupeKey,
        googleAds: {
          configured: true,
          uploaded: true,
          customerId: adsContext.customerId,
          conversionActionResource: adsContext.conversionActionResource,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Google Ads conversion upload failed for ${dedupeKey}: ${message}`)
      await this.repository.updateConversionReceipt(receipt.id, {
        status: 'failed',
        reason: 'ads_upload_failed',
        errorMessage: message,
        lastAttemptAt: new Date(),
      })
      return {
        status: 'failed',
        reason: message,
        internalEventName: input.event,
        canonicalConversionName: canonical.canonicalName,
        receiptId: receipt.id,
        dedupeKey,
        googleAds: {
          configured: true,
          uploaded: false,
          customerId: adsContext.customerId,
          conversionActionResource: adsContext.conversionActionResource,
        },
      }
    }
  }

  async listReceipts(limit = 50): Promise<ConversionReceiptListItem[]> {
    const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50
    const rows = await this.repository.listConversionReceipts(safeLimit)
    return rows.map((row: any) => ({
      id: row.id,
      internalEventName: row.internalEventName,
      canonicalConversionName: row.canonicalConversionName,
      adsConversionAction: row.adsConversionAction ?? null,
      adsConversionResource: row.adsConversionResource ?? null,
      transactionId: row.transactionId ?? null,
      eventId: row.eventId ?? null,
      gclid: row.gclid ?? null,
      wbraid: row.wbraid ?? null,
      gbraid: row.gbraid ?? null,
      value: row.value === null || row.value === undefined ? null : Number(row.value),
      currency: row.currency ?? null,
      status: row.status,
      reason: row.reason ?? null,
      dedupeKey: row.dedupeKey,
      errorMessage: row.errorMessage ?? null,
      attemptCount: row.attemptCount ?? 0,
      lastAttemptAt: row.lastAttemptAt?.toISOString?.() ?? null,
      sentAt: row.sentAt?.toISOString?.() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }))
  }

  private async resolveGoogleAdsContext() {
    const config = await this.growth.getConfig()
    if (!config.googleAdsEnabled || !config.googleAdsConversionId) {
      return {
        configured: false as const,
        reason: 'google_ads_conversion_not_configured',
        customerId: null,
        conversionActionResource: null,
        accessToken: null,
      }
    }

    const adsIntegration = this.googleAdsConfig.getEffectiveConfig()
    if (!adsIntegration.developerToken) {
      return {
        configured: false as const,
        reason: 'google_ads_developer_token_missing',
        customerId: null,
        conversionActionResource: null,
        accessToken: null,
      }
    }
    const connection = await this.repository.findConnectionBySource('ads')
    const customerId = resolveCustomerId(connection?.externalAccountId ?? adsIntegration.customerId)
    if (!customerId) {
      return {
        configured: false as const,
        reason: 'google_ads_customer_id_missing',
        customerId: null,
        conversionActionResource: null,
        accessToken: null,
      }
    }

    let accessToken: string | null = null
    if (connection) {
      try {
        accessToken = await this.adsConnector.resolveAccessToken(connection.id)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.logger.warn(`Unable to resolve Google Ads access token for conversion upload: ${message}`)
        return {
          configured: false as const,
          reason: 'google_ads_access_token_missing',
          customerId,
          conversionActionResource: null,
          accessToken: null,
        }
      }
    }
    if (!accessToken) {
      return {
        configured: false as const,
        reason: 'google_ads_access_token_missing',
        customerId,
        conversionActionResource: null,
        accessToken: null,
      }
    }

    return {
      configured: true as const,
      reason: null,
      customerId,
      conversionActionResource: resolveConversionActionResource(customerId, config.googleAdsConversionId),
      accessToken,
    }
  }

  private async uploadClickConversion(
    customerId: string,
    accessToken: string,
    clickConversion: Record<string, unknown>,
  ) {
    const response = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}:uploadClickConversions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'developer-token': this.requireDeveloperToken(),
        },
        body: JSON.stringify({
          conversions: [clickConversion],
          partialFailure: false,
          validateOnly: false,
        }),
      },
    )

    const responseText = await response.text()
    if (!response.ok) {
      throw new Error(`google_ads_upload_${response.status}:${responseText}`)
    }

    try {
      return JSON.parse(responseText)
    } catch {
      return { raw: responseText }
    }
  }

  private requireDeveloperToken() {
    const config = this.googleAdsConfig.getEffectiveConfig()
    if (!config.developerToken) {
      throw new ServiceUnavailableException('Google Ads developer token is not configured.')
    }
    return config.developerToken
  }

  private skip(
    input: TrackConversionInput,
    reason: string,
    canonicalConversionName: string | null,
    receiptId: string | null,
    dedupeKey?: string | null,
  ): ConversionTrackResult {
    return {
      status: 'skipped',
      reason,
      internalEventName: input.event,
      canonicalConversionName: canonicalConversionName as ConversionTrackResult['canonicalConversionName'],
      receiptId,
      dedupeKey: dedupeKey ?? null,
      googleAds: {
        configured: false,
        uploaded: false,
        customerId: null,
        conversionActionResource: null,
      },
    }
  }
}

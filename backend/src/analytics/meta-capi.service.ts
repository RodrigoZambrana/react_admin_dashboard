import { Injectable, Logger } from '@nestjs/common'
import { createHash, randomUUID } from 'crypto'

import { GrowthService } from '../growth/growth.service'
import { ConfigEncryptionService } from '../common/security/config-encryption.service'
import { AnalyticsRepository } from './analytics.repository'
import type { AnalyticsEventInput } from './analytics.types'

type MetaCapiResult = {
  status: 'sent' | 'skipped' | 'blocked_by_consent' | 'not_configured' | 'failed'
  eventId: string | null
  metaEventId: string | null
  message: string | null
}

const META_CAPI_API_VERSION = 'v22.0'
const META_CAPI_ENDPOINT = (pixelId: string) =>
  `https://graph.facebook.com/${META_CAPI_API_VERSION}/${encodeURIComponent(pixelId)}/events`

const META_EVENT_NAME_MAP: Record<string, string> = {
  page_view: 'PageView',
  view_item: 'ViewContent',
  form_submit: 'Lead',
  lead_created: 'Lead',
  purchase: 'Purchase',
  whatsapp_click: 'Contact',
  phone_click: 'Contact',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
}

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const sha256Hex = (value: string) =>
  createHash('sha256').update(value.trim().toLowerCase()).digest('hex')

const mapEventName = (eventName: string) => {
  return META_EVENT_NAME_MAP[eventName] ?? eventName
}

const getNestedString = (value: unknown, path: string[]): string | null => {
  let current: unknown = value
  for (const segment of path) {
    if (!current || typeof current !== 'object') {
      return null
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return normalizeString(current)
}

const getFirstString = (...values: unknown[]) => {
  for (const value of values) {
    const normalized = normalizeString(value)
    if (normalized) {
      return normalized
    }
  }
  return null
}

@Injectable()
export class MetaCapiService {
  private readonly logger = new Logger(MetaCapiService.name)

  constructor(
    private readonly repository: AnalyticsRepository,
    private readonly growth: GrowthService,
    private readonly encryption: ConfigEncryptionService,
  ) {}

  async ensureConnection() {
    const config = await this.growth.getConfig()
    const enabled = config.metaPixelEnabled && config.metaConversionsApiEnabled
    const ready = enabled && Boolean(config.metaPixelId && config.metaConversionsApiToken)
    const status = ready ? 'ready' : enabled ? 'needs_auth' : 'disabled'
    const existing = await this.repository.findConnectionBySource('meta')

    if (!existing) {
      const connection = await this.repository.createConnection({
        source: 'meta',
        displayName: 'Meta Ads',
        status,
        needsReauth: !ready,
      })
      if (ready && config.metaConversionsApiToken) {
        await this.repository.upsertConnectionCredentials(connection.id, {
          accessTokenEncrypted: this.encryption.encrypt(config.metaConversionsApiToken),
          refreshTokenEncrypted: null,
          expiresAt: null,
          scopes: ['meta:capi'],
        })
      }
      return connection
    }

    const connection = await this.repository.updateConnection(existing.id, {
      status,
      needsReauth: !ready,
      externalAccountId: config.metaAdsAccountId ?? null,
      externalPropertyId: config.metaPixelId ?? null,
      displayName: 'Meta Ads',
      lastAttemptedSyncAt: existing.lastAttemptedSyncAt ?? null,
      lastSyncedAt: existing.lastSyncedAt ?? null,
      lastSuccessfulSyncAt: existing.lastSuccessfulSyncAt ?? null,
    })
    if (ready && config.metaConversionsApiToken) {
      await this.repository.upsertConnectionCredentials(existing.id, {
        accessTokenEncrypted: this.encryption.encrypt(config.metaConversionsApiToken),
        refreshTokenEncrypted: null,
        expiresAt: null,
        scopes: ['meta:capi'],
      })
    }
    return connection
  }

  async sendEvent(
    rawEvent: Awaited<ReturnType<AnalyticsRepository['saveEvent']>>,
    input: AnalyticsEventInput,
  ): Promise<MetaCapiResult> {
    const config = await this.growth.getConfig()
    const pixelId = config.metaPixelId
    const token = await this.getAccessToken()
    const ready = config.metaPixelEnabled && config.metaConversionsApiEnabled && pixelId && token

    await this.ensureConnection()

    if (!ready) {
      return this.persistDelivery(rawEvent.id, {
        status: 'not_configured',
        eventId: this.resolveEventId(rawEvent.id, input),
        metaEventId: null,
        message: 'Meta CAPI is not configured.',
      })
    }

    const consent = this.resolveConsent(input)
    if (!consent) {
      return this.persistDelivery(rawEvent.id, {
        status: 'blocked_by_consent',
        eventId: this.resolveEventId(rawEvent.id, input),
        metaEventId: null,
        message: 'Consent not granted.',
      })
    }

    const eventId = this.resolveEventId(rawEvent.id, input)
    const metaEventId = eventId ?? randomUUID()
    const metaEventName = mapEventName(rawEvent.eventName || input.event || 'custom')
    const eventTime = Math.floor(new Date(input.timestamp ?? rawEvent.timestamp).getTime() / 1000)
    const payload = {
      data: [
        {
          event_name: metaEventName,
          event_time: eventTime,
          event_id: metaEventId,
          action_source: 'website',
          event_source_url: input.url,
          user_data: this.buildUserData(rawEvent, input),
          custom_data: this.buildCustomData(rawEvent, input),
        },
      ],
    }

    try {
      const endpoint = META_CAPI_ENDPOINT(pixelId)
      const response = await fetch(`${endpoint}?access_token=${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const responseText = await response.text()
      if (!response.ok) {
        throw new Error(`Meta CAPI request failed (${response.status}): ${responseText}`)
      }

      await this.persistDelivery(rawEvent.id, {
        status: 'sent',
        eventId,
        metaEventId,
        message: null,
      })

      return {
        status: 'sent',
        eventId,
        metaEventId,
        message: null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Meta CAPI send failed for event ${eventId ?? rawEvent.id}: ${message}`)
      return this.persistDelivery(rawEvent.id, {
        status: 'failed',
        eventId,
        metaEventId,
        message,
      })
    }
  }

  private resolveConsent(input: AnalyticsEventInput) {
    const data = input.data ?? {}
    const metadata = (input.metadata ?? {}) as Record<string, unknown>
    const rawConsent = (data as Record<string, unknown>).consent
    const directConsent =
      (metadata.consent as Record<string, unknown> | undefined) ??
      (rawConsent as Record<string, unknown> | undefined)
    const marketing = getFirstString(
      (directConsent as Record<string, unknown> | undefined)?.marketing,
      (data as Record<string, unknown>).tracking_consent,
      (data as Record<string, unknown>).marketing_consent,
    )
    if (!marketing) {
      return true
    }
    return ['true', 'granted', 'yes', '1'].includes(marketing.toLowerCase())
  }

  private resolveEventId(rawId: string, input: AnalyticsEventInput) {
    return (
      normalizeString(input.event_id) ??
      normalizeString((input.data ?? {})['event_id']) ??
      normalizeString((input.data ?? {})['eventId']) ??
      rawId
    )
  }

  private buildUserData(rawEvent: Awaited<ReturnType<AnalyticsRepository['saveEvent']>>, input: AnalyticsEventInput) {
    const data = input.data ?? {}
    const metadata = (input.metadata ?? {}) as Record<string, unknown>
    const email = getFirstString(
      metadata.email,
      (data as Record<string, unknown>).email,
      (data as Record<string, unknown>).email_address,
    )
    const phone = getFirstString(
      metadata.phone,
      (data as Record<string, unknown>).phone,
      (data as Record<string, unknown>).phone_number,
    )
    const externalId = getFirstString(input.user_id, rawEvent.userId)
    const ipAddress = getFirstString(
      input.client_ip_address,
      (data as Record<string, unknown>).client_ip_address,
      (data as Record<string, unknown>).ip,
    )
    const userAgent = getFirstString(input.user_agent, rawEvent.userAgent)
    const fbp = getFirstString(input.fbp, rawEvent.fbp, (data as Record<string, unknown>).fbp)
    const fbc = getFirstString(input.fbc, rawEvent.fbc, (data as Record<string, unknown>).fbc)

    return {
      em: email ? [sha256Hex(email)] : undefined,
      ph: phone ? [sha256Hex(phone)] : undefined,
      external_id: externalId ? [sha256Hex(externalId)] : undefined,
      client_ip_address: ipAddress ?? undefined,
      client_user_agent: userAgent ?? undefined,
      fbp: fbp ?? undefined,
      fbc: fbc ?? undefined,
    }
  }

  private buildCustomData(rawEvent: Awaited<ReturnType<AnalyticsRepository['saveEvent']>>, input: AnalyticsEventInput) {
    const data = input.data ?? {}
    const ecommerce = (data.ecommerce as Record<string, unknown> | undefined) ?? null
    const currency = getFirstString(
      (ecommerce as Record<string, unknown> | null)?.currency,
      (data as Record<string, unknown>).currency,
    )
    const value = typeof input.value === 'number' && Number.isFinite(input.value) ? input.value : undefined
    const itemIds = Array.isArray(ecommerce?.items)
      ? ecommerce.items
          .map((item) => getFirstString((item as Record<string, unknown>).item_id, (item as Record<string, unknown>).id))
          .filter((item): item is string => Boolean(item))
      : []
    const contentName = getFirstString(
      getNestedString(ecommerce, ['content_name']),
      getNestedString(ecommerce, ['items', '0', 'item_name']),
    )

    return {
      currency: currency ?? undefined,
      value,
      content_ids: itemIds.length ? itemIds : undefined,
      content_name: contentName ?? undefined,
      content_type: itemIds.length ? 'product' : undefined,
      order_id: getFirstString(
        getNestedString(ecommerce, ['transaction_id']),
        getNestedString(data, ['transaction_id']),
        rawEvent.eventId ?? null,
      ) ?? undefined,
      num_items: itemIds.length || undefined,
    }
  }

  private async persistDelivery(
    rawEventId: string,
    input: {
      status: MetaCapiResult['status']
      eventId: string | null
      metaEventId: string | null
      message: string | null
    },
  ): Promise<MetaCapiResult> {
    await this.repository.updateEventMetaDelivery(rawEventId, {
      metaStatus: input.status,
      metaEventId: input.metaEventId,
      metaSentAt: input.status === 'sent' ? new Date() : null,
      externalTargets: ['ga4', 'google_ads', 'meta'],
    })

    return {
      status: input.status,
      eventId: input.eventId,
      metaEventId: input.metaEventId,
      message: input.message,
    }
  }

  private async getAccessToken() {
    const connection = await this.repository.findConnectionBySource('meta')
    const credential = connection ? await this.repository.getConnectionCredentials(connection.id) : null
    const storedToken = credential?.accessTokenEncrypted
      ? this.encryption.decrypt(credential.accessTokenEncrypted)
      : null
    if (storedToken) {
      return storedToken
    }
    const config = await this.growth.getConfig()
    return config.metaConversionsApiToken ?? null
  }
}

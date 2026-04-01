import { normalizeMetaPayload } from '../../normalization/unified-message.js'
import {
  extractMetaWebhookEvents,
  validateMetaWebhookSignature,
  validateMetaWebhookVerification,
} from './meta.webhook.js'
import { MetaSender } from './meta.sender.js'
import {
  PendingUtteranceAssembler,
  estimatePendingUtteranceDelay,
} from '../../runtime/pending-utterance-assembler.js'

const DEFAULT_META_QUIET_WINDOW_MS = 900
const DEFAULT_META_MAX_WINDOW_MS = 2600

const cleanString = (value) => {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized.length ? normalized : null
}

export class MetaAdapter {
  constructor(clients, config, options = {}) {
    this.clients = clients
    this.config = config
    this.sender = options.sender || new MetaSender(config, options)
    this.quietWindowMs =
      options.quietWindowMs ?? DEFAULT_META_QUIET_WINDOW_MS
    this.maxWindowMs =
      options.maxWindowMs ?? DEFAULT_META_MAX_WINDOW_MS
    this.turnAssembler =
      options.turnAssembler ||
      options.coalescer ||
      new PendingUtteranceAssembler({
        defaultDelayMs: this.quietWindowMs,
        maxWindowMs: this.maxWindowMs,
      })
  }

  buildCoalescerKey({ normalized, projection }) {
    return [
      normalized?.channel || 'meta',
      projection?.conversationId || normalized?.conversationId || 'conversation',
      normalized?.userId || normalized?.metadata?.threadId || 'user',
    ].join(':')
  }

  async processBufferedInboundEvents(items = [], context = {}) {
    const lastItem = items.at(-1)
    if (!lastItem) {
      return {
        normalized: null,
        conversation: null,
        ai: null,
      }
    }

    const normalizedMessages = items.map((entry) => entry.normalized).filter(Boolean)
    const latestNormalized = lastItem.normalized
    const projection = lastItem.projection
    const semanticTurn = context?.semanticTurn || null
    const evaluation = context?.evaluation || null
    const combinedText = normalizedMessages
      .map((entry) => String(entry?.text || '').trim())
      .filter(Boolean)
      .join('\n')
      .trim()
    const combinedAttachments = normalizedMessages.flatMap((entry) =>
      Array.isArray(entry?.attachments) ? entry.attachments : [],
    )

    if (evaluation?.canceled) {
      return {
        normalized: latestNormalized,
        conversation: projection,
        ai: null,
        coalescedInboundCount: normalizedMessages.length,
        semanticTurn,
        suppressed: true,
      }
    }

    const aiResult = await this.clients.ai.respond({
      ...latestNormalized,
      conversationId: projection.conversationId,
      text: combinedText,
      attachments: combinedAttachments,
      locale:
        projection?.preferences?.locale || latestNormalized?.metadata?.locale || undefined,
      currency:
        projection?.preferences?.currency ||
        latestNormalized?.metadata?.currency ||
        undefined,
      metadata: {
        ...(latestNormalized?.metadata && typeof latestNormalized.metadata === 'object'
          ? latestNormalized.metadata
          : {}),
        locale:
          projection?.preferences?.locale ||
          (latestNormalized?.metadata && typeof latestNormalized.metadata === 'object'
            ? latestNormalized.metadata.locale || null
            : null),
        currency:
          projection?.preferences?.currency ||
          (latestNormalized?.metadata && typeof latestNormalized.metadata === 'object'
            ? latestNormalized.metadata.currency || null
            : null),
        coalescedInboundCount: normalizedMessages.length,
        semanticTurnId:
          typeof semanticTurn?.id === 'string' ? semanticTurn.id : null,
        semanticTurnInputCount:
          typeof semanticTurn?.inputCount === 'number'
            ? semanticTurn.inputCount
            : normalizedMessages.length,
      },
    }, {
      cancellationToken: evaluation,
    })

    if (evaluation?.canceled) {
      return {
        normalized: latestNormalized,
        conversation: projection,
        ai: aiResult?.response ?? null,
        coalescedInboundCount: normalizedMessages.length,
        semanticTurn,
        suppressed: true,
      }
    }

    const responseText =
      aiResult?.response?.finalUserText?.trim() ||
      aiResult?.response?.text?.trim()
    if (responseText) {
      await this.clients.conversations.replyAsAgent(projection.conversationId, {
        body: responseText,
        finalUserText: responseText,
        debugSummary: aiResult?.response?.debugSummary ?? null,
        auditPayload: aiResult?.response?.auditPayload ?? null,
        metadata: {
          provider: aiResult?.response?.provider || 'mock',
          model: aiResult?.response?.model || null,
          channel: latestNormalized.channel,
          deliveryStatus: 'pending_external',
          aiMemory: aiResult?.response?.memory || null,
          coalescedInboundCount: normalizedMessages.length,
          semanticTurnId:
            typeof semanticTurn?.id === 'string' ? semanticTurn.id : null,
          semanticTurnInputCount:
            typeof semanticTurn?.inputCount === 'number'
              ? semanticTurn.inputCount
              : normalizedMessages.length,
        },
        toolCalls: aiResult?.response?.toolCalls ?? [],
        needsHuman: aiResult?.response?.needsHuman ?? false,
        grounding: aiResult?.response?.grounding ?? null,
      })
    }

    return {
      normalized: latestNormalized,
      conversation: projection,
      ai: aiResult?.response ?? null,
      coalescedInboundCount: normalizedMessages.length,
      semanticTurn,
    }
  }

  getEffectiveConfig() {
    return {
      enabled: this.config.metaEnabled !== false,
      messengerEnabled:
        this.config.metaEnabled !== false &&
        this.config.metaMessengerEnabled !== false,
      instagramEnabled:
        this.config.metaEnabled !== false &&
        this.config.metaInstagramEnabled !== false,
      publicBaseUrl: cleanString(this.config.metaPublicBaseUrl),
      pageId: cleanString(this.config.metaPageId),
      instagramBusinessAccountId: cleanString(
        this.config.instagramBusinessAccountId,
      ),
      appId: cleanString(this.config.metaAppId),
      verifyToken: cleanString(this.config.metaVerifyToken),
      appSecret: cleanString(this.config.metaAppSecret),
      pageAccessToken: cleanString(this.config.metaPageAccessToken),
      messengerPageAccessToken: cleanString(
        this.config.messengerPageAccessToken,
      ),
      instagramAccessToken: cleanString(this.config.instagramAccessToken),
    }
  }

  getStatus() {
    const enabled = this.config.metaEnabled !== false
    const messengerEnabled = enabled && this.config.metaMessengerEnabled !== false
    const instagramEnabled = enabled && this.config.metaInstagramEnabled !== false
    const publicBaseUrl = cleanString(this.config.metaPublicBaseUrl)
    const publicWebhookUrl = publicBaseUrl
      ? `${publicBaseUrl.replace(/\/$/, '')}/webhooks/meta`
      : null
    const verifyTokenPresent = Boolean(cleanString(this.config.metaVerifyToken))
    const appSecretPresent = Boolean(cleanString(this.config.metaAppSecret))
    const messengerPageAccessTokenPresent = Boolean(
      cleanString(this.config.messengerPageAccessToken) ||
        cleanString(this.config.metaPageAccessToken),
    )
    const instagramAccessTokenPresent = Boolean(
      cleanString(this.config.instagramAccessToken) ||
        cleanString(this.config.metaPageAccessToken) ||
        cleanString(this.config.messengerPageAccessToken),
    )
    const pageId = cleanString(this.config.metaPageId)
    const instagramBusinessAccountId = cleanString(
      this.config.instagramBusinessAccountId,
    )

    return {
      driver: 'meta',
      enabled,
      messengerEnabled,
      instagramEnabled,
      appId: cleanString(this.config.metaAppId),
      graphVersion: cleanString(this.config.metaGraphVersion) || 'v23.0',
      graphBaseUrl:
        cleanString(this.config.metaGraphBaseUrl) || 'https://graph.facebook.com',
      publicBaseUrl,
      publicWebhookUrl,
      verifyTokenPresent,
      appSecretPresent,
      webhookVerificationReady: verifyTokenPresent,
      signatureValidationReady: appSecretPresent,
      webhookInboundReady: verifyTokenPresent && appSecretPresent,
      messenger: {
        enabled: messengerEnabled,
        pageId,
        pageAccessTokenPresent: messengerPageAccessTokenPresent,
        outboundReady: messengerEnabled && messengerPageAccessTokenPresent,
      },
      instagram: {
        enabled: instagramEnabled,
        businessAccountId: instagramBusinessAccountId,
        accessTokenPresent: instagramAccessTokenPresent,
        outboundReady:
          instagramEnabled &&
          instagramAccessTokenPresent &&
          Boolean(instagramBusinessAccountId),
      },
      capabilities: {
        text: true,
        attachments: true,
        postbacks: true,
        quickReplies: true,
      },
    }
  }

  updateConfig(input = {}) {
    if (Object.prototype.hasOwnProperty.call(input, 'enabled')) {
      this.config.metaEnabled = input.enabled === true
    }
    if (Object.prototype.hasOwnProperty.call(input, 'messengerEnabled')) {
      this.config.metaMessengerEnabled = input.messengerEnabled === true
    }
    if (Object.prototype.hasOwnProperty.call(input, 'instagramEnabled')) {
      this.config.metaInstagramEnabled = input.instagramEnabled === true
    }
    if (Object.prototype.hasOwnProperty.call(input, 'publicBaseUrl')) {
      this.config.metaPublicBaseUrl = cleanString(input.publicBaseUrl)
    }
    if (Object.prototype.hasOwnProperty.call(input, 'pageId')) {
      this.config.metaPageId = cleanString(input.pageId)
    }
    if (Object.prototype.hasOwnProperty.call(input, 'instagramBusinessAccountId')) {
      this.config.instagramBusinessAccountId = cleanString(
        input.instagramBusinessAccountId,
      )
    }
    if (Object.prototype.hasOwnProperty.call(input, 'appId')) {
      this.config.metaAppId = cleanString(input.appId)
    }
    if (Object.prototype.hasOwnProperty.call(input, 'verifyToken')) {
      this.config.metaVerifyToken = cleanString(input.verifyToken)
    }
    if (Object.prototype.hasOwnProperty.call(input, 'appSecret')) {
      this.config.metaAppSecret = cleanString(input.appSecret)
    }
    if (Object.prototype.hasOwnProperty.call(input, 'pageAccessToken')) {
      this.config.metaPageAccessToken = cleanString(input.pageAccessToken)
    }
    if (Object.prototype.hasOwnProperty.call(input, 'messengerPageAccessToken')) {
      this.config.messengerPageAccessToken = cleanString(
        input.messengerPageAccessToken,
      )
    }
    if (Object.prototype.hasOwnProperty.call(input, 'instagramAccessToken')) {
      this.config.instagramAccessToken = cleanString(input.instagramAccessToken)
    }

    return this.getStatus()
  }

  verifyWebhook(searchParams) {
    return validateMetaWebhookVerification(searchParams, this.config.metaVerifyToken)
  }

  validateSignature(rawBody, signatureHeader) {
    return validateMetaWebhookSignature(rawBody, signatureHeader, this.config.metaAppSecret)
  }

  async handleWebhook(payload) {
    const events = extractMetaWebhookEvents(payload, {
      tenantKey: this.config.clientSlug || undefined,
    })

    const results = []
    let ignored = 0

    for (const event of events) {
      if (event.type === 'status') {
        ignored += 1
        continue
      }

      if (!this.isPlatformEnabled(event.platform)) {
        ignored += 1
        continue
      }

      results.push(await this.handleInboundEvent(event.payload))
    }

    return {
      ok: true,
      totalEvents: events.length,
      processedEvents: results.length,
      ignoredEvents: ignored,
      results,
    }
  }

  async handleInboundEvent(payload) {
    const normalized = normalizeMetaPayload(payload)
    if (!this.isPlatformEnabled(normalized.channel)) {
      return {
        normalized,
        conversation: null,
        ai: null,
        skipped: true,
      }
    }
    if (!normalized.text && (!Array.isArray(normalized.attachments) || !normalized.attachments.length)) {
      throw new Error('Meta inbound event requires text or attachments')
    }

    const projection = await this.clients.conversations.ingestInboundMessage({
      tenantKey: normalized.tenantKey,
      channel: normalized.channel,
      conversationId: normalized.conversationId || undefined,
      userId: normalized.userId,
      inboxAccountId: payload?.inboxAccountId || undefined,
      inboxAddress: payload?.pageId || payload?.inboxAddress || undefined,
      threadId: normalized.metadata?.threadId || payload?.threadId || undefined,
      externalMessageId:
        normalized.metadata?.providerMessageId || payload?.messageId || undefined,
      displayName: payload?.fromName || payload?.name || undefined,
      queueSlug: payload?.queueSlug || undefined,
      text: normalized.text,
      authorKind: normalized.authorKind,
      messageKind: normalized.messageKind,
      metadata: normalized.metadata,
      attachments: normalized.attachments,
    })

    if (projection.controlMode !== 'human') {
      const turnItem = {
        normalized,
        projection,
      }
      const flushDelayMs = estimatePendingUtteranceDelay({
        items: [turnItem],
        defaultDelayMs: this.quietWindowMs,
      })

      return this.turnAssembler.enqueue(
        this.buildCoalescerKey({ normalized, projection }),
        turnItem,
        (items, context) => this.processBufferedInboundEvents(items, context),
        {
          maxWindowMs: Math.max(this.maxWindowMs, flushDelayMs),
        },
      )
    }

    return {
      normalized,
      conversation: projection,
      ai: null,
    }
  }

  async handleInbound(payload) {
    if (Array.isArray(payload?.entry) && payload?.object) {
      return this.handleWebhook(payload)
    }

    return this.handleInboundEvent(payload)
  }

  async handleStatus(payload) {
    const statuses = this.extractStatuses(payload)

    const results = []
    for (const status of statuses) {
      const conversationId =
        status?.conversationId ||
        status?.metadata?.conversationId ||
        null

      if (!conversationId || !status?.messageId) {
        continue
      }

      const normalizedChannel = this.normalizeChannel(
        status?.channel || status?.metadata?.channel || 'whatsapp',
      )

      const result = await this.clients.conversations.syncOutboundStatus({
        conversationId,
        channel: normalizedChannel,
        inboxAccountId: status?.inboxAccountId || status?.metadata?.inboxAccountId,
        remoteId: status.messageId,
        externalMessageId: status?.externalMessageId || status.messageId,
        providerMessageId: status?.providerMessageId || status.messageId,
        deliveryStatus: this.normalizeDeliveryStatus(status?.status),
        occurredAt:
          status?.timestamp
            ? new Date(Number(status.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
        errorCode: status?.errorCode || status?.errors?.[0]?.code || undefined,
        errorMessage:
          status?.errorMessage || status?.errors?.[0]?.title || undefined,
        metadata: {
          channel: normalizedChannel,
          recipientId: status?.recipientId || null,
          rawStatus: status?.status || null,
          ...(status?.metadata || {}),
        },
      })

      results.push(result)
    }

    return {
      ok: true,
      statuses: results.length,
      results,
    }
  }

  async sendOutbound(payload) {
    const channel = this.normalizeChannel(payload?.channel || payload?.platform)
    if (!this.isPlatformEnabled(channel)) {
      throw new Error(`Meta platform ${channel} is disabled`)
    }
    const result = await this.sender.sendMessage({
      ...payload,
      channel,
      platform: channel,
    })
    return {
      ...result,
      channel,
    }
  }

  extractStatuses(payload) {
    if (Array.isArray(payload?.statuses)) {
      return payload.statuses
    }

    const entryStatuses =
      payload?.entry?.flatMap((entry) =>
        (entry?.changes || []).flatMap(
          (change) => change?.value?.statuses || [],
        ),
      ) || []

    return entryStatuses
  }

  normalizeChannel(channel) {
    const normalized = String(channel || '').trim().toLowerCase()
    if (normalized === 'messenger') {
      return 'facebook'
    }
    if (normalized === 'instagram') {
      return 'instagram'
    }
    if (normalized === 'facebook') {
      return 'facebook'
    }
    return 'facebook'
  }

  normalizeDeliveryStatus(status) {
    const normalized = String(status || '').trim().toLowerCase()
    switch (normalized) {
      case 'sent':
        return 'sent'
      case 'delivered':
        return 'delivered'
      case 'read':
        return 'read'
      case 'failed':
        return 'failed'
      case 'rejected':
        return 'rejected'
      default:
        return 'accepted'
    }
  }

  isPlatformEnabled(platform) {
    if (this.config.metaEnabled === false) {
      return false
    }

    const normalized = this.normalizeChannel(platform)
    if (normalized === 'instagram') {
      return this.config.metaInstagramEnabled !== false
    }

    return this.config.metaMessengerEnabled !== false
  }
}

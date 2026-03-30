import { normalizeWebchatPayload } from '../../normalization/unified-message.js'
import {
  estimateInboundCompletionDelay,
  InboundTurnCoalescer,
} from '../../runtime/inbound-turn-coalescer.js'

export class WebchatAdapter {
  constructor(clients, options = {}) {
    this.clients = clients
    this.coalescer =
      options.coalescer ||
      new InboundTurnCoalescer({
        quietWindowMs: options.quietWindowMs,
        maxWindowMs: options.maxWindowMs,
      })
  }

  buildCoalescerKey({ normalized, payload }) {
    return [
      'webchat',
      normalized?.conversationId || payload?.conversationId || 'conversation',
      normalized?.userId || payload?.guestId || 'guest',
    ].join(':')
  }

  async processBufferedInbound(items = []) {
    const lastItem = items.at(-1)
    if (!lastItem) {
      return {
        normalized: null,
        ai: null,
      }
    }

    const normalizedMessages = items.map((entry) => entry.normalized).filter(Boolean)
    const persistedMessages = items.map((entry) => entry.persistedInbound).filter(Boolean)
    const latestNormalized = lastItem.normalized
    const latestPersisted = persistedMessages.at(-1) || lastItem.persistedInbound
    const combinedText = normalizedMessages
      .map((entry) => String(entry?.text || '').trim())
      .filter(Boolean)
      .join('\n')
      .trim()
    const combinedAttachments = normalizedMessages.flatMap((entry) =>
      Array.isArray(entry?.attachments) ? entry.attachments : [],
    )

    const conversationScope = latestPersisted?.conversation?.scope || latestNormalized.scope
    const conversationCustomerId =
      Number.isInteger(latestPersisted?.conversation?.customerId) &&
      latestPersisted.conversation.customerId > 0
        ? latestPersisted.conversation.customerId
        : null
    const aiPayload = {
      ...latestNormalized,
      scope: conversationScope,
      customerId: conversationCustomerId,
      authenticated: conversationScope === 'customer_authenticated' || latestNormalized.authenticated,
      text: combinedText,
      attachments: combinedAttachments,
      metadata: {
        ...(latestNormalized.metadata || {}),
        coalescedInboundCount: normalizedMessages.length,
        authenticated:
          conversationScope === 'customer_authenticated' || latestNormalized.authenticated,
        customerId: conversationCustomerId,
      },
    }

    const aiResult = await this.clients.ai.respond(aiPayload)
    const responseText =
      aiResult?.response?.finalUserText?.trim() ||
      aiResult?.response?.text?.trim()

    if (responseText) {
      await this.clients.conversations.replyAsAgent(latestNormalized.conversationId, {
        body: responseText,
        finalUserText: responseText,
        debugSummary: aiResult?.response?.debugSummary ?? null,
        auditPayload: aiResult?.response?.auditPayload ?? null,
        metadata: {
          provider: aiResult?.response?.provider || 'mock',
          model: aiResult?.response?.model || null,
          channel: 'webchat',
          aiMemory: aiResult?.response?.memory || null,
          coalescedInboundCount: normalizedMessages.length,
        },
        toolCalls: aiResult?.response?.toolCalls ?? [],
        needsHuman: aiResult?.response?.needsHuman ?? false,
        grounding: aiResult?.response?.grounding ?? null,
      })
    }

    return {
      normalized: latestNormalized,
      ai: aiResult?.response ?? null,
      coalescedInboundCount: normalizedMessages.length,
    }
  }

  async handleInbound(payload) {
    const normalized = normalizeWebchatPayload(payload)
    if (!normalized.conversationId) {
      throw new Error('conversationId is required for webchat messages')
    }
    if (!normalized.text && (!Array.isArray(normalized.attachments) || !normalized.attachments.length)) {
      throw new Error('text or attachments are required for webchat messages')
    }

    const persistedInbound = await this.clients.conversations.createWebchatMessage({
      conversationId: normalized.conversationId,
      guestId: payload?.guestId || normalized.userId,
      text: normalized.text,
      locale:
        typeof payload?.locale === 'string'
          ? payload.locale
          : typeof normalized?.metadata?.locale === 'string'
            ? normalized.metadata.locale
            : undefined,
      currency:
        typeof payload?.currency === 'string'
          ? payload.currency
          : typeof normalized?.metadata?.currency === 'string'
            ? normalized.metadata.currency
            : undefined,
      attachments: normalized.attachments,
    })

    return this.coalescer.enqueue(
      this.buildCoalescerKey({ normalized, payload }),
      {
        payload,
        normalized,
        persistedInbound,
      },
      (items) => this.processBufferedInbound(items),
      {
        flushDelayMs: estimateInboundCompletionDelay({
          text: normalized.text,
          attachments: normalized.attachments,
        }),
      },
    )
  }
}

import { normalizeWebchatPayload } from '../../normalization/unified-message.js'
import {
  PendingUtteranceAssembler,
  estimatePendingUtteranceDelay,
} from '../../runtime/pending-utterance-assembler.js'

const DEFAULT_WEBCHAT_QUIET_WINDOW_MS = 1500
const DEFAULT_WEBCHAT_MAX_WINDOW_MS = 4200
const DEFAULT_WEBCHAT_MIN_REPLY_DELAY_MS = 900
const DEFAULT_WEBCHAT_MAX_REPLY_DELAY_MS = 2600
const DEFAULT_WEBCHAT_WAIT_FOR_MORE_REPLY_DELAY_MS = 1200

const delay = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

const calculateReplyDelay = ({
  text = '',
  minDelayMs = DEFAULT_WEBCHAT_MIN_REPLY_DELAY_MS,
  maxDelayMs = DEFAULT_WEBCHAT_MAX_REPLY_DELAY_MS,
}) => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return 0
  }

  const normalizedMinDelayMs = Number(minDelayMs)
  const normalizedMaxDelayMs = Number(maxDelayMs)
  const base = Math.max(
    0,
    Number.isFinite(normalizedMinDelayMs)
      ? normalizedMinDelayMs
      : DEFAULT_WEBCHAT_MIN_REPLY_DELAY_MS,
  )
  const max = Math.max(
    base,
    Number.isFinite(normalizedMaxDelayMs)
      ? normalizedMaxDelayMs
      : DEFAULT_WEBCHAT_MAX_REPLY_DELAY_MS,
  )
  const perChar = Math.min(normalized.length * 18, max - base)
  return Math.min(base + perChar, max)
}

export class WebchatAdapter {
  constructor(clients, options = {}) {
    this.clients = clients
    this.quietWindowMs =
      options.quietWindowMs ?? DEFAULT_WEBCHAT_QUIET_WINDOW_MS
    this.maxWindowMs =
      options.maxWindowMs ?? DEFAULT_WEBCHAT_MAX_WINDOW_MS
    this.minReplyDelayMs =
      options.minReplyDelayMs ?? DEFAULT_WEBCHAT_MIN_REPLY_DELAY_MS
    this.maxReplyDelayMs =
      options.maxReplyDelayMs ?? DEFAULT_WEBCHAT_MAX_REPLY_DELAY_MS
    this.waitForMoreReplyDelayMs =
      options.waitForMoreReplyDelayMs ?? DEFAULT_WEBCHAT_WAIT_FOR_MORE_REPLY_DELAY_MS
    this.turnAssembler =
      options.turnAssembler ||
      options.coalescer ||
      new PendingUtteranceAssembler({
        defaultDelayMs: this.quietWindowMs,
        maxWindowMs: this.maxWindowMs,
      })
    this.pendingReplies = new Map()
  }

  buildCoalescerKey({ normalized, payload }) {
    return [
      'webchat',
      normalized?.conversationId || payload?.conversationId || 'conversation',
      normalized?.userId || payload?.guestId || 'guest',
    ].join(':')
  }

  buildReplyKey({ normalized, payload }) {
    return this.buildCoalescerKey({ normalized, payload })
  }

  cancelPendingReply(replyKey) {
    const pendingReply = this.pendingReplies.get(replyKey)
    if (!pendingReply) {
      return
    }

    pendingReply.canceled = true
    this.pendingReplies.delete(replyKey)
  }

  async processBufferedInbound(items = [], context = {}) {
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
        semanticTurnId:
          typeof semanticTurn?.id === 'string' ? semanticTurn.id : null,
        semanticTurnInputCount:
          typeof semanticTurn?.inputCount === 'number'
            ? semanticTurn.inputCount
            : normalizedMessages.length,
        authenticated:
          conversationScope === 'customer_authenticated' || latestNormalized.authenticated,
        customerId: conversationCustomerId,
      },
    }

    if (evaluation?.canceled) {
      return {
        normalized: latestNormalized,
        ai: null,
        coalescedInboundCount: normalizedMessages.length,
        semanticTurn,
        suppressed: true,
      }
    }

    const aiResult = await this.clients.ai.respond(aiPayload, {
      cancellationToken: evaluation,
    })
    const responseText =
      aiResult?.response?.finalUserText?.trim() ||
      aiResult?.response?.text?.trim()

    if (evaluation?.canceled) {
      return {
        normalized: latestNormalized,
        ai: aiResult?.response ?? null,
        coalescedInboundCount: normalizedMessages.length,
        semanticTurn,
        suppressed: true,
      }
    }

    if (responseText) {
      const replyKey = this.buildReplyKey({
        normalized: latestNormalized,
        payload: lastItem?.payload,
      })
      const waitForMore =
        aiResult?.response?.memory?.conversationContext?.waitForMore === true ||
        aiResult?.response?.auditPayload?.turnInterpretation?.conversationContext
          ?.waitForMore === true
      const replyDelayMs = calculateReplyDelay({
        text: responseText,
        minDelayMs: this.minReplyDelayMs,
        maxDelayMs: this.maxReplyDelayMs,
      })
      const totalReplyDelayMs =
        replyDelayMs + (waitForMore ? this.waitForMoreReplyDelayMs : 0)
      const pendingReply = {
        canceled: false,
      }
      this.pendingReplies.set(replyKey, pendingReply)

      if (totalReplyDelayMs > 0) {
        await delay(totalReplyDelayMs)
      }

      if (
        pendingReply.canceled ||
        this.pendingReplies.get(replyKey) !== pendingReply
      ) {
        return {
          normalized: latestNormalized,
          ai: aiResult?.response ?? null,
          coalescedInboundCount: normalizedMessages.length,
          suppressed: true,
        }
      }

      try {
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
      } finally {
        if (this.pendingReplies.get(replyKey) === pendingReply) {
          this.pendingReplies.delete(replyKey)
        }
      }
    }

    return {
      normalized: latestNormalized,
      ai: aiResult?.response ?? null,
      coalescedInboundCount: normalizedMessages.length,
      semanticTurn,
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

    this.cancelPendingReply(this.buildReplyKey({ normalized, payload }))

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
    const turnItem = {
      payload,
      normalized,
      persistedInbound,
      receivedAt: new Date().toISOString(),
    }
    const flushDelayMs = estimatePendingUtteranceDelay({
      items: [turnItem],
      defaultDelayMs: this.quietWindowMs,
    })

    void this.turnAssembler
      .enqueue(
        this.buildCoalescerKey({ normalized, payload }),
        turnItem,
        (items, context) => this.processBufferedInbound(items, context),
        {
          maxWindowMs: Math.max(this.maxWindowMs, flushDelayMs),
        },
      )
      .catch((error) => {
        console.error('[webchat] Failed to process buffered inbound turn', error)
      })

    return {
      normalized,
      ai: null,
      status: 'queued',
      queued: true,
      acceptedAt: new Date().toISOString(),
      coalescedInboundCount: 1,
      flushDelayMs,
    }
  }
}

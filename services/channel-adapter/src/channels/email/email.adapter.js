import { normalizeEmailPayload } from '../../normalization/unified-message.js'
import {
  PendingUtteranceAssembler,
  estimatePendingUtteranceDelay,
} from '../../runtime/pending-utterance-assembler.js'

const DEFAULT_EMAIL_QUIET_WINDOW_MS = 1200
const DEFAULT_EMAIL_MAX_WINDOW_MS = 5000

export class EmailAdapter {
  constructor(clients, options = {}) {
    this.clients = clients
    this.quietWindowMs =
      options.quietWindowMs ?? DEFAULT_EMAIL_QUIET_WINDOW_MS
    this.maxWindowMs =
      options.maxWindowMs ?? DEFAULT_EMAIL_MAX_WINDOW_MS
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
      'email',
      projection?.conversationId || normalized?.conversationId || 'conversation',
      normalized?.userId || normalized?.metadata?.threadId || 'user',
    ].join(':')
  }

  async processBufferedInbound(items = [], context = {}) {
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

    const aiResult = await this.clients.ai.respond(
      {
        ...latestNormalized,
        conversationId: projection.conversationId,
        text: combinedText,
        attachments: combinedAttachments,
        metadata: {
          ...(latestNormalized?.metadata || {}),
          coalescedInboundCount: normalizedMessages.length,
          semanticTurnId:
            typeof semanticTurn?.id === 'string' ? semanticTurn.id : null,
          semanticTurnInputCount:
            typeof semanticTurn?.inputCount === 'number'
              ? semanticTurn.inputCount
              : normalizedMessages.length,
        },
      },
      {
        cancellationToken: evaluation,
      },
    )

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
          channel: 'email',
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

  async handleInbound(payload) {
    const normalized = normalizeEmailPayload(payload)
    const projection = await this.clients.conversations.ingestInboundMessage({
      tenantKey: normalized.tenantKey,
      channel: 'email',
      conversationId: normalized.conversationId || undefined,
      userId: normalized.userId,
      inboxAccountId: payload?.inboxAccountId || undefined,
      inboxAddress: payload?.inboxAddress || payload?.toAddress || undefined,
      subject: payload?.subject || null,
      threadId:
        payload?.threadId ||
        normalized.metadata?.threadId ||
        undefined,
      externalMessageId:
        payload?.providerMessageId ||
        payload?.messageId ||
        undefined,
      displayName:
        normalized.metadata?.fromName ||
        payload?.fromName ||
        undefined,
      email: payload?.fromAddress || payload?.from || undefined,
      queueSlug: payload?.queueSlug || undefined,
      text: normalized.text,
      authorKind: normalized.authorKind,
      messageKind: normalized.messageKind,
      metadata: normalized.metadata,
      attachments: normalized.attachments,
    })

    let ai = null
    if (projection.controlMode !== 'human') {
      const turnItem = {
        normalized,
        projection,
      }
      const flushDelayMs = estimatePendingUtteranceDelay({
        items: [turnItem],
        defaultDelayMs: this.quietWindowMs,
      })
      const result = await this.turnAssembler.enqueue(
        this.buildCoalescerKey({ normalized, projection }),
        turnItem,
        (items, context) => this.processBufferedInbound(items, context),
        {
          maxWindowMs: Math.max(this.maxWindowMs, flushDelayMs),
        },
      )
      ai = result?.ai ?? result ?? null
    }

    return {
      normalized,
      conversation: projection,
      ai,
    }
  }

  async handleStatus(payload) {
    const statuses = Array.isArray(payload?.statuses)
      ? payload.statuses
      : payload
      ? [payload]
      : []

    const results = []
    for (const status of statuses) {
      const conversationId =
        status?.conversationId ||
        status?.metadata?.conversationId ||
        null

      if (!conversationId || !status?.messageId) {
        continue
      }

      const result = await this.clients.conversations.syncOutboundStatus({
        conversationId,
        channel: 'email',
        inboxAccountId: status?.inboxAccountId || status?.metadata?.inboxAccountId,
        remoteId: status.messageId,
        externalMessageId: status?.externalMessageId || status.messageId,
        providerMessageId: status?.providerMessageId || status.messageId,
        deliveryStatus: this.normalizeDeliveryStatus(status?.status),
        occurredAt:
          status?.timestamp || status?.occurredAt
            ? new Date(status.timestamp || status.occurredAt).toISOString()
            : new Date().toISOString(),
        errorCode: status?.errorCode || undefined,
        errorMessage: status?.errorMessage || undefined,
        metadata: {
          channel: 'email',
          provider: status?.provider || status?.metadata?.provider || 'smtp',
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

  normalizeDeliveryStatus(status) {
    const normalized = String(status || '').trim().toLowerCase()

    switch (normalized) {
      case 'queued':
      case 'accepted':
      case 'sent':
      case 'delivered':
      case 'read':
      case 'failed':
      case 'rejected':
        return normalized
      case 'bounce':
      case 'bounced':
      case 'undelivered':
        return 'failed'
      default:
        return 'accepted'
    }
  }
}

import { normalizeEmailPayload } from '../../normalization/unified-message.js'

export class EmailAdapter {
  constructor(clients) {
    this.clients = clients
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
      const aiResult = await this.clients.ai.respond({
        ...normalized,
        conversationId: projection.conversationId,
      })
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
          },
          toolCalls: aiResult?.response?.toolCalls ?? [],
        })
      }
      ai = aiResult?.response ?? null
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

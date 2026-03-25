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
      metadata: normalized.metadata,
    })

    let ai = null
    if (projection.controlMode !== 'human') {
      const aiResult = await this.clients.ai.respond({
        ...normalized,
        conversationId: projection.conversationId,
      })
      const responseText = aiResult?.response?.text?.trim()
      if (responseText) {
        await this.clients.conversations.replyAsAgent(projection.conversationId, {
          body: responseText,
          metadata: {
            provider: aiResult?.response?.provider || 'mock',
            model: aiResult?.response?.model || null,
            channel: 'email',
            deliveryStatus: 'pending_external',
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
}

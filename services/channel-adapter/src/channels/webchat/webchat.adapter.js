import { normalizeWebchatPayload } from '../../normalization/unified-message.js'

export class WebchatAdapter {
  constructor(clients) {
    this.clients = clients
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
      attachments: normalized.attachments,
    })

    const conversationScope = persistedInbound?.conversation?.scope || normalized.scope
    const conversationCustomerId =
      Number.isInteger(persistedInbound?.conversation?.customerId) &&
      persistedInbound.conversation.customerId > 0
        ? persistedInbound.conversation.customerId
        : null
    const aiPayload = {
      ...normalized,
      scope: conversationScope,
      customerId: conversationCustomerId,
      authenticated: conversationScope === 'customer_authenticated' || normalized.authenticated,
      metadata: {
        ...(normalized.metadata || {}),
        authenticated:
          conversationScope === 'customer_authenticated' || normalized.authenticated,
        customerId: conversationCustomerId,
      },
    }

    const aiResult = await this.clients.ai.respond(aiPayload)
    const responseText =
      aiResult?.response?.finalUserText?.trim() ||
      aiResult?.response?.text?.trim()

    if (responseText) {
      await this.clients.conversations.replyAsAgent(normalized.conversationId, {
        body: responseText,
        finalUserText: responseText,
        debugSummary: aiResult?.response?.debugSummary ?? null,
        auditPayload: aiResult?.response?.auditPayload ?? null,
        metadata: {
          provider: aiResult?.response?.provider || 'mock',
          model: aiResult?.response?.model || null,
          channel: 'webchat',
          aiMemory: aiResult?.response?.memory || null,
        },
        toolCalls: aiResult?.response?.toolCalls ?? [],
        needsHuman: aiResult?.response?.needsHuman ?? false,
        grounding: aiResult?.response?.grounding ?? null,
      })
    }

    return {
      normalized,
      ai: aiResult?.response ?? null,
    }
  }
}

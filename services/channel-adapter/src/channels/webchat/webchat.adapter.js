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
    if (!normalized.text) {
      throw new Error('text is required for webchat messages')
    }

    await this.clients.conversations.createWebchatMessage({
      conversationId: normalized.conversationId,
      guestId: payload?.guestId || normalized.userId,
      text: normalized.text,
    })

    const aiResult = await this.clients.ai.respond(normalized)
    const responseText = aiResult?.response?.text?.trim()

    if (responseText) {
      await this.clients.conversations.replyAsAgent(normalized.conversationId, {
        body: responseText,
        metadata: {
          provider: aiResult?.response?.provider || 'mock',
          model: aiResult?.response?.model || null,
          channel: 'webchat',
        },
      })
    }

    return {
      normalized,
      ai: aiResult?.response ?? null,
    }
  }
}

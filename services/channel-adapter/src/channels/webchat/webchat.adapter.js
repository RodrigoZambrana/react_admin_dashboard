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

    await this.clients.conversations.createWebchatMessage({
      conversationId: normalized.conversationId,
      guestId: payload?.guestId || normalized.userId,
      text: normalized.text,
      attachments: normalized.attachments,
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

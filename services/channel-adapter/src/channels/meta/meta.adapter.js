import { normalizeMetaPayload } from '../../normalization/unified-message.js'

const META_GRAPH_BASE_URL = 'https://graph.facebook.com/v23.0'

export class MetaAdapter {
  constructor(clients, config) {
    this.clients = clients
    this.config = config
  }

  async handleInbound(payload) {
    const normalized = normalizeMetaPayload(payload)
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
            channel: normalized.channel,
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
    const channel = this.normalizeChannel(payload?.channel)
    const text = String(payload?.text || '').trim()
    const recipientId = String(payload?.recipientId || '').trim()

    if (!text) {
      throw new Error('text is required for meta outbound messages')
    }

    if (!recipientId) {
      throw new Error('recipientId is required for meta outbound messages')
    }

    const result = await this.sendViaMetaGraph(channel, recipientId, text, payload)
    return {
      ...result,
      channel,
    }
  }

  async sendViaMetaGraph(channel, recipientId, text, payload) {
    if (channel === 'whatsapp') {
      return this.sendWhatsappMessage(recipientId, text, payload)
    }

    if (channel === 'facebook' || channel === 'instagram') {
      return this.sendMessengerStyleMessage(channel, recipientId, text, payload)
    }

    return this.buildSimulatedResponse(channel, payload)
  }

  async sendWhatsappMessage(recipientId, text, payload) {
    const token = this.config.whatsappAccessToken
    const phoneNumberId = this.config.whatsappPhoneNumberId

    if (!token || !phoneNumberId) {
      return this.buildSimulatedResponse('whatsapp', payload)
    }

    const response = await fetch(
      `${META_GRAPH_BASE_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientId,
          type: 'text',
          text: { body: text },
        }),
      },
    )

    const raw = await response.text()
    const parsed = raw ? JSON.parse(raw) : {}

    if (!response.ok) {
      throw new Error(parsed?.error?.message || 'Failed to send WhatsApp message')
    }

    const remoteId = parsed?.messages?.[0]?.id || `wa:${Date.now()}`

    return {
      provider: 'meta-graph',
      remoteId,
      providerMessageId: remoteId,
      threadRemoteId: payload?.threadId || recipientId,
      deliveryStatus: 'accepted',
      metadata: parsed,
    }
  }

  async sendMessengerStyleMessage(channel, recipientId, text, payload) {
    const token =
      channel === 'instagram'
        ? this.config.instagramAccessToken
        : this.config.messengerPageAccessToken

    if (!token) {
      return this.buildSimulatedResponse(channel, payload)
    }

    const response = await fetch(`${META_GRAPH_BASE_URL}/me/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text },
        messaging_type: 'RESPONSE',
      }),
    })

    const raw = await response.text()
    const parsed = raw ? JSON.parse(raw) : {}

    if (!response.ok) {
      throw new Error(
        parsed?.error?.message || `Failed to send ${channel} message`,
      )
    }

    const remoteId = parsed?.message_id || `meta:${Date.now()}`

    return {
      provider: 'meta-graph',
      remoteId,
      providerMessageId: remoteId,
      threadRemoteId: payload?.threadId || recipientId,
      deliveryStatus: 'accepted',
      metadata: parsed,
    }
  }

  buildSimulatedResponse(channel, payload) {
    const remoteId = `sim:${channel}:${Date.now()}`
    return {
      provider: 'meta-simulated',
      remoteId,
      providerMessageId: remoteId,
      threadRemoteId: payload?.threadId || payload?.recipientId || null,
      deliveryStatus: 'accepted',
      metadata: {
        simulated: true,
      },
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
    return 'whatsapp'
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
}

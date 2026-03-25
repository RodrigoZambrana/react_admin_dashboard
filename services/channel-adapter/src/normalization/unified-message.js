import { sanitizeText } from './sanitization.js'

const normalizeBase = (channel, scope, payload) => ({
  channel,
  scope,
  tenantKey: payload?.tenantKey || 'default',
  userId: payload?.userId || payload?.guestId || payload?.from || 'unknown',
  conversationId: payload?.conversationId || null,
  text: sanitizeText(payload?.text || payload?.body || payload?.message || ''),
  metadata: payload?.metadata || {},
})

export function normalizeWebchatPayload(payload) {
  return normalizeBase('webchat', 'customer_public', payload)
}

export function normalizeEmailPayload(payload) {
  return {
    ...normalizeBase('email', 'customer_public', payload),
    userId: payload?.fromAddress || payload?.from || 'unknown',
    metadata: {
      subject: payload?.subject || null,
      threadId: payload?.threadId || null,
      fromName: payload?.fromName || null,
      ...(payload?.metadata || {}),
    },
  }
}

export function normalizeMetaPayload(payload) {
  const channelMap = {
    whatsapp: 'whatsapp',
    instagram: 'instagram',
    messenger: 'facebook',
    facebook: 'facebook',
  }
  const channel = channelMap[(payload?.channel || '').toLowerCase()] || 'whatsapp'

  return {
    ...normalizeBase(channel, 'customer_public', payload),
    userId: payload?.from || payload?.userId || 'unknown',
    metadata: {
      providerMessageId: payload?.providerMessageId || payload?.messageId || null,
      threadId: payload?.threadId || null,
      ...(payload?.metadata || {}),
    },
  }
}

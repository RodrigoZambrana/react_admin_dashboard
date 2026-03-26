import { sanitizeText } from './sanitization.js'

const normalizeBase = (channel, scope, payload) => ({
  channel,
  scope,
  role: payload?.role || null,
  tenantKey: payload?.tenantKey || 'default',
  userId: payload?.userId || payload?.guestId || payload?.from || 'unknown',
  conversationId: payload?.conversationId || null,
  text: sanitizeText(payload?.text || payload?.body || payload?.message || ''),
  authenticated: payload?.authenticated === true || payload?.metadata?.authenticated === true,
  authRole: payload?.authRole || null,
  authRoles: Array.isArray(payload?.authRoles) ? payload.authRoles : [],
  capabilityGroups: Array.isArray(payload?.capabilityGroups)
    ? payload.capabilityGroups
    : [],
  directCapabilities: Array.isArray(payload?.directCapabilities)
    ? payload.directCapabilities
    : [],
  capabilityEnvelope: Array.isArray(payload?.capabilityEnvelope)
    ? payload.capabilityEnvelope
    : [],
  attachments: Array.isArray(payload?.attachments)
    ? payload.attachments
    : Array.isArray(payload?.metadata?.attachments)
      ? payload.metadata.attachments
      : [],
  metadata: payload?.metadata || {},
})

export function normalizeWebchatPayload(payload) {
  const scope =
    payload?.scope === 'customer_authenticated' ||
    payload?.authLevel === 'customer' ||
    payload?.metadata?.authenticated === true
      ? 'customer_authenticated'
      : 'customer_public'

  return normalizeBase('webchat', scope, payload)
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

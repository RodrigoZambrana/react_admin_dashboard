import { sanitizeText } from './sanitization.js'

const AUTHOR_KINDS = new Set([
  'customer_human',
  'business_human',
  'business_auto',
  'channel_system',
  'operator_human',
  'agent_runtime',
  'unknown',
])

const MESSAGE_KINDS = new Set([
  'human_message',
  'business_auto_reply',
  'channel_system',
  'attachment_only',
  'system_event',
])

const normalizeContractValue = (value, allowedValues) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim().toLowerCase()
  return allowedValues.has(normalized) ? normalized : null
}

const resolveNormalizedArray = (payload, metadata, key) =>
  Array.isArray(payload?.[key])
    ? payload[key]
    : Array.isArray(metadata?.[key])
      ? metadata[key]
      : []

const resolveAuthorKind = ({ payload, metadata, defaultAuthorKind }) => {
  const explicitAuthorKind = normalizeContractValue(
    payload?.authorKind ?? metadata?.authorKind,
    AUTHOR_KINDS,
  )
  if (explicitAuthorKind) {
    return explicitAuthorKind
  }

  if (
    payload?.system === true ||
    payload?.isSystem === true ||
    metadata?.system === true ||
    metadata?.isSystem === true ||
    typeof payload?.eventType === 'string' ||
    typeof metadata?.eventType === 'string'
  ) {
    return 'channel_system'
  }

  if (
    payload?.autoReply === true ||
    payload?.isAutoReply === true ||
    metadata?.autoReply === true ||
    metadata?.isAutoReply === true
  ) {
    return 'business_auto'
  }

  return defaultAuthorKind
}

const resolveMessageKind = ({ payload, metadata, authorKind, text, attachments }) => {
  const explicitMessageKind = normalizeContractValue(
    payload?.messageKind ?? metadata?.messageKind,
    MESSAGE_KINDS,
  )
  if (explicitMessageKind) {
    return explicitMessageKind
  }

  if (authorKind === 'channel_system') {
    return 'channel_system'
  }

  if (authorKind === 'business_auto') {
    return 'business_auto_reply'
  }

  if (!text && Array.isArray(attachments) && attachments.length > 0) {
    return 'attachment_only'
  }

  return 'human_message'
}

const normalizeBase = (channel, scope, payload, options = {}) => {
  const metadata =
    payload?.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
  const attachments = resolveNormalizedArray(payload, metadata, 'attachments')
  const messageElements = resolveNormalizedArray(payload, metadata, 'messageElements')
  const text = sanitizeText(payload?.text || payload?.body || payload?.message || '')
  const authorKind = resolveAuthorKind({
    payload,
    metadata,
    defaultAuthorKind: options.defaultAuthorKind || 'customer_human',
  })
  const messageKind = resolveMessageKind({
    payload,
    metadata,
    authorKind,
    text,
    attachments,
  })

  return {
    channel,
    scope,
    role: payload?.role || null,
    tenantKey: payload?.tenantKey || 'default',
    userId: payload?.userId || payload?.guestId || payload?.from || 'unknown',
    conversationId: payload?.conversationId || null,
    customerId:
      Number.isInteger(payload?.customerId) && payload.customerId > 0
        ? payload.customerId
        : Number.isInteger(metadata?.customerId) && metadata.customerId > 0
          ? metadata.customerId
          : null,
    text,
    authenticated: payload?.authenticated === true || metadata?.authenticated === true,
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
    authorKind,
    messageKind,
    attachments,
    messageElements,
    metadata: {
      ...metadata,
      authorKind,
      messageKind,
    },
  }
}

export function normalizeWebchatPayload(payload) {
  const scope =
    payload?.scope === 'customer_authenticated' ||
    payload?.authLevel === 'customer' ||
    payload?.metadata?.authenticated === true
      ? 'customer_authenticated'
      : 'customer_public'

  return normalizeBase('webchat', scope, payload, {
    defaultAuthorKind: 'customer_human',
  })
}

export function normalizeEmailPayload(payload) {
  const base = normalizeBase('email', 'customer_public', payload, {
    defaultAuthorKind: 'customer_human',
  })
  return {
    ...base,
    userId: payload?.fromAddress || payload?.from || 'unknown',
    metadata: {
      ...base.metadata,
      subject: payload?.subject || null,
      threadId: payload?.threadId || null,
      fromName: payload?.fromName || null,
      ...((payload?.metadata && typeof payload.metadata === 'object')
        ? payload.metadata
        : {}),
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
  const base = normalizeBase(channel, 'customer_public', payload, {
    defaultAuthorKind: 'customer_human',
  })

  return {
    ...base,
    userId: payload?.from || payload?.userId || 'unknown',
    metadata: {
      ...base.metadata,
      providerMessageId: payload?.providerMessageId || payload?.messageId || null,
      threadId: payload?.threadId || null,
      ...((payload?.metadata && typeof payload.metadata === 'object')
        ? payload.metadata
        : {}),
    },
  }
}

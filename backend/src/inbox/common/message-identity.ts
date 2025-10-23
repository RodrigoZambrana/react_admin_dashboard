import { createHash } from 'crypto'
import type { InboxMessageDirection } from '@prisma/client'

export type MessageIdentityInput = {
  provider: string
  folder?: string | null
  remoteId?: string | null
  messageId?: string | null
  gmailId?: string | null
  headers?: Record<string, string> | undefined
  bodyHtml?: string | null
  bodyText?: string | null
}

export type QueueClassificationInput = {
  headers?: Record<string, string> | undefined
  to?: Array<{ address?: string | null }>
  cc?: Array<{ address?: string | null }>
  bcc?: Array<{ address?: string | null }>
  from?: { address?: string | null }
  labels?: string[]
  subject?: string | null
  folder?: string | null
  direction?: InboxMessageDirection
}

export const DEFAULT_FOLDER = 'INBOX'

export function normalizeFolder(folder?: string | null) {
  return (folder || DEFAULT_FOLDER).trim().toLowerCase()
}

export function deriveMessageUid(input: MessageIdentityInput): string {
  const provider = (input.provider || 'generic').trim().toLowerCase()
  const folder = normalizeFolder(input.folder)
  const base = deriveBaseIdentifier(input)
  return `${provider}:${folder}:${base}`
}

function deriveBaseIdentifier(input: MessageIdentityInput) {
  const normalized = normalizeMessageId(input.messageId)
  if (normalized) {
    return `mid:${normalized}`
  }
  if (input.gmailId) {
    return `gmail:${input.gmailId}`
  }
  const headerId = normalizeMessageId(input.headers?.['message-id'])
  if (headerId) {
    return `hdr:${headerId}`
  }
  if (input.remoteId) {
    return `remote:${String(input.remoteId).trim()}`
  }
  const hashSource = JSON.stringify({
    provider: input.provider,
    folder: input.folder,
    bodyHash: hashMessageBody(input),
  })
  return `hash:${sha1(hashSource)}`
}

function normalizeMessageId(messageId?: string | null) {
  if (!messageId) {
    return null
  }
  const trimmed = messageId.trim().toLowerCase()
  if (!trimmed) {
    return null
  }
  // Remove surrounding angle brackets if present
  return trimmed.replace(/^<|>$/g, '')
}

export function hashMessageBody(input: { bodyHtml?: string | null; bodyText?: string | null }) {
  const html = (input.bodyHtml || '').trim()
  const text = (input.bodyText || '').trim()
  if (!html && !text) {
    return null
  }
  return sha1(`${html}::${text}`)
}

function sha1(value: string) {
  return createHash('sha1').update(value).digest('hex')
}

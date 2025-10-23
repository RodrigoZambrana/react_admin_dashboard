import { normalizeMessageId } from '../../common/message-identity'

export type ThreadingHeaders = {
  messageId?: string | null
  inReplyTo?: string | null
  references?: Array<string | null | undefined> | null
  threadRemoteId?: string | null
}

export type NormalizedThreadingHeaders = {
  messageId?: string | null
  inReplyTo?: string | null
  references: string[]
  threadRemoteId?: string | null
}

export const normalizeThreadingHeaders = (
  headers: ThreadingHeaders,
): NormalizedThreadingHeaders => {
  const messageId = normalizeMessageId(headers.messageId)
  const inReplyTo = normalizeMessageId(headers.inReplyTo)
  const references = Array.isArray(headers.references)
    ? headers.references
        .map((reference) => normalizeMessageId(reference))
        .filter((reference): reference is string => Boolean(reference))
    : []

  return {
    messageId: messageId ?? null,
    inReplyTo: inReplyTo ?? null,
    references,
    threadRemoteId: headers.threadRemoteId ?? null,
  }
}

export const buildThreadKey = (headers: NormalizedThreadingHeaders): string | null => {
  if (headers.threadRemoteId) {
    return headers.threadRemoteId
  }
  if (headers.inReplyTo) {
    return headers.inReplyTo
  }
  if (headers.references.length > 0) {
    return headers.references[headers.references.length - 1]
  }
  if (headers.messageId) {
    return headers.messageId
  }
  return null
}

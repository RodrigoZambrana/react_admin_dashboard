import type { Mail } from '../store'

type MailMessage = Mail['message'][number]

const isRecord = (value: unknown): value is Record<string, unknown> =>
    Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const toNonEmptyString = (value: unknown) => {
    if (typeof value !== 'string') {
        return ''
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : ''
}

export const normalizeString = (value?: string | null) =>
    (value ?? '').trim().toLowerCase()

export const normalizeMessageIdentifier = (value?: string | null) => {
    if (!value) {
        return ''
    }
    return normalizeString(value.replace(/[<>]/g, ''))
}

const collectReferenceValues = (input: unknown): string[] => {
    if (!input) {
        return []
    }
    const values = Array.isArray(input) ? input : [input]
    return values
        .map((value) => {
            if (typeof value === 'string') {
                return normalizeMessageIdentifier(value)
            }
            if (value && typeof value === 'object' && 'toString' in value) {
                return normalizeMessageIdentifier(String(value))
            }
            return ''
        })
        .filter((value): value is string => Boolean(value))
}

export const extractMetadata = (mail?: Partial<Mail>) => {
    if (!mail) {
        return null
    }
    const metadata = mail.metadata
    return metadata && typeof metadata === 'object'
        ? (metadata as Record<string, unknown>)
        : null
}

export const extractMetadataIdentifier = (
    metadata: Record<string, unknown>,
    key: string,
) => {
    const raw = metadata[key]
    if (typeof raw === 'string') {
        const normalized = normalizeMessageIdentifier(raw)
        return normalized || ''
    }
    return ''
}

export const extractMetadataReferences = (metadata: Record<string, unknown>) => {
    const raw = metadata.references
    if (!raw) {
        return []
    }
    const values = Array.isArray(raw) ? raw : [raw]
    return values
        .map((value) =>
            typeof value === 'string' ? normalizeMessageIdentifier(value) : '',
        )
        .filter((value): value is string => Boolean(value))
}

const SUBJECT_PREFIXES = [
    're',
    'fw',
    'fwd',
    'rv',
    'res',
    'enc',
    'tr',
    'sv',
    'aw',
    'wg',
    'antw',
    'rép',
    'rsp',
    'resposta',
    '答复',
    '回复',
    '答覆',
]

const escapeRegex = (value: string) =>
    value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')

export const normalizeSubject = (subject?: string | null) => {
    const raw = (subject ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
    if (!raw) {
        return ''
    }
    let normalized = raw
    let changed = true
    while (changed) {
        changed = false
        for (const prefix of SUBJECT_PREFIXES) {
            const rx = new RegExp(`^${escapeRegex(prefix)}:\\s*`, 'i')
            if (rx.test(normalized)) {
                normalized = normalized.replace(rx, '').trim()
                changed = true
            }
        }
    }
    return normalized
}

const normalizeRecipients = (recipients?: string[]) => {
    if (!Array.isArray(recipients)) {
        return ''
    }
    return recipients
        .map((recipient) => normalizeString(recipient))
        .filter((recipient) => recipient.length > 0)
        .sort()
        .join(',')
}

export const buildConversationKey = (mail?: Partial<Mail>) => {
    if (!mail) {
        return ''
    }
    const subjectNorm = normalizeSubject(mail.subject || mail.title)
    const threadId = normalizeString(
        (mail as { threadRemoteId?: string | null })?.threadRemoteId,
    )
    if (threadId) {
        const key = `thread:${threadId}`
        return key
    }
    const metadata = extractMetadata(mail)
    if (metadata) {
        const metadataThreadKey = (() => {
            const raw = metadata.threadKey
            if (typeof raw === 'string') {
                const normalized = normalizeString(raw)
                if (normalized) {
                    return normalized
                }
            }
            return ''
        })()
        if (metadataThreadKey) {
            return `thread:${metadataThreadKey}`
        }
        const metadataInReplyTo = extractMetadataIdentifier(metadata, 'inReplyTo')
        if (metadataInReplyTo) {
            return `thread:${metadataInReplyTo}`
        }
        const metadataReferences = extractMetadataReferences(metadata)
        if (metadataReferences.length > 0) {
            return `thread:${metadataReferences[metadataReferences.length - 1]}`
        }
    }
    if (subjectNorm) {
        const key = `queue:${subjectNorm}`
        return key
    }
    const fallback = normalizeString(mail.from) || normalizeRecipients(mail.mail)
    if (fallback) {
        const key = `fallback:${fallback}`
        return key
    }
    return ''
}

const parseMessageTimestamp = (value?: string | null) => {
    if (!value) {
        return null
    }
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
}

const resolveMessageTimestamp = (message: MailMessage) => {
    return (
        parseMessageTimestamp(message.receivedAt) ??
        parseMessageTimestamp(message.sentAt) ??
        parseMessageTimestamp(message.date)
    )
}

const buildMessageKey = (message: MailMessage, index: number) => {
    if (message.id !== undefined && message.id !== null) {
        return `id:${String(message.id)}`
    }
    if (message.messageUid) {
        const normalizedUid = normalizeString(String(message.messageUid))
        if (normalizedUid) {
            return `uid:${normalizedUid}`
        }
    }
    const timestamp = resolveMessageTimestamp(message)
    const from = normalizeString(message.from)
    return `idx:${index}:${timestamp ?? 'na'}:${from}`
}

const mergeMessagePayload = (
    existing: MailMessage,
    incoming: MailMessage,
): MailMessage => {
    return {
        ...existing,
        ...incoming,
        mail: Array.isArray(incoming.mail)
            ? [...incoming.mail]
            : Array.isArray(existing.mail)
              ? [...existing.mail]
              : [],
        attachment: Array.isArray(incoming.attachment)
            ? [...incoming.attachment]
            : Array.isArray(existing.attachment)
              ? [...existing.attachment]
              : [],
        to: Array.isArray(incoming.to)
            ? [...incoming.to]
            : Array.isArray(existing.to)
              ? [...existing.to]
              : undefined,
        cc: Array.isArray(incoming.cc)
            ? [...incoming.cc]
            : Array.isArray(existing.cc)
              ? [...existing.cc]
              : undefined,
        bcc: Array.isArray(incoming.bcc)
            ? [...incoming.bcc]
            : Array.isArray(existing.bcc)
              ? [...existing.bcc]
              : undefined,
    }
}

export const mergeMailMessages = (
    existing?: MailMessage[],
    incoming?: MailMessage[],
): MailMessage[] => {
    const map = new Map<
        string,
        { message: MailMessage; timestamp: number | null; order: number }
    >()
    let order = 0

    const appendMessages = (messages?: MailMessage[]) => {
        if (!Array.isArray(messages)) {
            return
        }
        messages.forEach((message, index) => {
            if (!message) {
                return
            }
            const key = buildMessageKey(message, index)
            const timestamp = resolveMessageTimestamp(message)
            const cloned: MailMessage = { ...message }
            const existingEntry = map.get(key)
            if (existingEntry) {
                map.set(key, {
                    message: mergeMessagePayload(existingEntry.message, cloned),
                    timestamp:
                        timestamp !== null ? timestamp : existingEntry.timestamp,
                    order: Math.min(existingEntry.order, order),
                })
            } else {
                map.set(key, {
                    message: cloned,
                    timestamp,
                    order,
                })
            }
            order += 1
        })
    }

    appendMessages(existing)
    appendMessages(incoming)

    const merged = Array.from(map.values())
    merged.sort((a, b) => {
        const hasA = typeof a.timestamp === 'number' && !Number.isNaN(a.timestamp)
        const hasB = typeof b.timestamp === 'number' && !Number.isNaN(b.timestamp)
        if (hasA && hasB) {
            if (a.timestamp !== b.timestamp) {
                return (a.timestamp as number) - (b.timestamp as number)
            }
            return a.order - b.order
        }
        if (hasA) {
            return -1
        }
        if (hasB) {
            return 1
        }
        return a.order - b.order
    })

    return merged.map((entry) => entry.message)
}

const preferIdentifier = (
    candidate: Record<string, unknown>,
    fallback: Record<string, unknown>,
    key: 'messageId' | 'inReplyTo',
) => {
    const candidateValue = normalizeMessageIdentifier(candidate[key] as string)
    if (candidateValue) {
        return candidateValue
    }
    const fallbackValue = normalizeMessageIdentifier(fallback[key] as string)
    return fallbackValue || undefined
}

const preferThreadKey = (
    candidate: Record<string, unknown>,
    fallback: Record<string, unknown>,
) => {
    const candidateValue = normalizeString(toNonEmptyString(candidate.threadKey))
    if (candidateValue) {
        return candidateValue
    }
    const fallbackValue = normalizeString(toNonEmptyString(fallback.threadKey))
    return fallbackValue || undefined
}

const mergeHeaders = (
    candidate: Record<string, unknown>,
    fallback: Record<string, unknown>,
) => {
    const candidateHeaders = candidate.headers
    const fallbackHeaders = fallback.headers
    if (!isRecord(candidateHeaders) && !isRecord(fallbackHeaders)) {
        return undefined
    }
    return {
        ...(isRecord(fallbackHeaders) ? fallbackHeaders : {}),
        ...(isRecord(candidateHeaders) ? candidateHeaders : {}),
    }
}

const mergeAttachments = (
    candidate: Record<string, unknown>,
    fallback: Record<string, unknown>,
) => {
    const candidateAttachments = candidate.attachments
    const fallbackAttachments = fallback.attachments
    if (!Array.isArray(candidateAttachments) && !Array.isArray(fallbackAttachments)) {
        return undefined
    }
    const merged: unknown[] = []
    const seen = new Map<string, number>()
    const buildKey = (value: unknown, index: number) => {
        if (isRecord(value)) {
            const id = value.id
            if (typeof id === 'string' || typeof id === 'number') {
                return `id:${String(id)}`
            }
            const fileName =
                (typeof value.fileName === 'string' && value.fileName.trim()) ||
                (typeof value.name === 'string' && value.name.trim())
            if (fileName) {
                return `file:${fileName.toLowerCase()}`
            }
        }
        if (typeof value === 'string') {
            return `string:${value.toLowerCase()}`
        }
        return `idx:${index}`
    }
    const append = (items?: unknown[]) => {
        if (!Array.isArray(items)) {
            return
        }
        items.forEach((item, index) => {
            const key = buildKey(item, merged.length + index)
            if (seen.has(key)) {
                const targetIndex = seen.get(key) ?? 0
                const existing = merged[targetIndex]
                if (isRecord(existing) && isRecord(item)) {
                    merged[targetIndex] = { ...existing, ...item }
                }
                return
            }
            seen.set(key, merged.length)
            merged.push(item)
        })
    }
    append(Array.isArray(fallbackAttachments) ? fallbackAttachments : undefined)
    append(Array.isArray(candidateAttachments) ? candidateAttachments : undefined)
    return merged
}

export const mergeMailMetadata = (
    fallback?: Record<string, unknown> | null,
    candidate?: Record<string, unknown> | null,
): Record<string, unknown> | null => {
    const base = isRecord(fallback) ? { ...fallback } : {}
    const next = isRecord(candidate) ? { ...candidate } : {}

    const references = new Set<string>()
    collectReferenceValues(base.references).forEach((value) => references.add(value))
    collectReferenceValues(next.references).forEach((value) => references.add(value))

    const merged: Record<string, unknown> = {
        ...base,
        ...next,
    }

    const mergedMessageId = preferIdentifier(next, base, 'messageId')
    if (mergedMessageId) {
        merged.messageId = mergedMessageId
    } else {
        delete merged.messageId
    }

    const mergedInReplyTo = preferIdentifier(next, base, 'inReplyTo')
    if (mergedInReplyTo) {
        merged.inReplyTo = mergedInReplyTo
    } else {
        delete merged.inReplyTo
    }

    const mergedThreadKey = preferThreadKey(next, base)
    if (mergedThreadKey) {
        merged.threadKey = mergedThreadKey
    } else {
        delete merged.threadKey
    }

    if (references.size > 0) {
        merged.references = Array.from(references)
    } else {
        delete merged.references
    }

    const headers = mergeHeaders(next, base)
    if (headers) {
        merged.headers = headers
    } else {
        delete merged.headers
    }

    const attachments = mergeAttachments(next, base)
    if (attachments && attachments.length > 0) {
        merged.attachments = attachments
    } else {
        delete merged.attachments
    }

    return Object.keys(merged).length > 0 ? merged : null
}

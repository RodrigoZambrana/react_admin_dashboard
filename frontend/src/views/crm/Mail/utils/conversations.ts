import type { Mail } from '../store'

export const normalizeString = (value?: string | null) =>
    (value ?? '').trim().toLowerCase()

export const normalizeMessageIdentifier = (value?: string | null) => {
    if (!value) {
        return ''
    }
    return normalizeString(value.replace(/[<>]/g, ''))
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

import type { Mail } from '../store'

export const normalizeString = (value?: string | null) =>
    (value ?? '').trim().toLowerCase()

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

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

const normalizeRecipientList = (recipients?: string[]) => {
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
    const subjectSource = mail.subject ?? mail.title
    const subjectNorm = normalizeSubject(subjectSource)
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
    const fallback = normalizeString(mail.from) || normalizeRecipientList(mail.mail)
    if (fallback) {
        const key = `fallback:${fallback}`
        return key
    }
    return ''
}

export const getMailSortValue = (mail?: Partial<Mail>) => {
    if (!mail?.message || mail.message.length === 0) {
        return 0
    }
    const firstMessage = mail.message[0]
    const parsedDate = Date.parse(firstMessage.date)
    if (!Number.isNaN(parsedDate)) {
        return parsedDate
    }
    return typeof firstMessage.id === 'number' ? firstMessage.id : 0
}

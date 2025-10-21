import type { Mail } from '../store'

const normalizeString = (value?: string | null) =>
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

const normalizeSubject = (subject?: string | null) => {
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

const collectParticipants = (mail?: Partial<Mail>) => {
    const participants = new Set<string>()
    if (!mail) {
        return participants
    }
    const push = (value?: string | null) => {
        const normalized = normalizeString(value)
        if (normalized) {
            participants.add(normalized)
        }
    }
    push(mail.from)
    ;(mail.mail ?? []).forEach(push)
    if (Array.isArray(mail.message)) {
        mail.message.forEach((message) => {
            if (!message) {
                return
            }
            push(message.from)
            ;(message.mail ?? []).forEach(push)
            ;(message.to ?? []).forEach(push)
            ;(message.cc ?? []).forEach(push)
            ;(message.bcc ?? []).forEach(push)
        })
    }
    return participants
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
        console.info('[MailQueue] grouping criteria', {
            keySource: 'none',
            key: '',
            reason: 'mail-not-provided',
        })
        return ''
    }
    const subjectSource = mail.subject ?? mail.title
    const subjectNorm = normalizeSubject(subjectSource)
    const participants = Array.from(collectParticipants(mail)).sort()
    const participantSignature =
        participants.length > 0 ? participants.join(';') : ''
    const threadId = normalizeString(
        (mail as { threadRemoteId?: string | null })?.threadRemoteId,
    )
    const keyMetadata = {
        mailId: mail.id ?? null,
        remoteId: (mail as { remoteId?: string | null })?.remoteId ?? null,
        subject: subjectSource ?? '',
        subjectNorm,
        participantSignature,
        participantCount: participants.length,
        threadRemoteId: threadId || null,
    }
    if (subjectNorm) {
        const key = `queue:${subjectNorm}`
        console.info('[MailQueue] grouping criteria', {
            ...keyMetadata,
            keySource: 'subject',
            key,
        })
        return key
    }
    if (threadId) {
        const key = `thread:${threadId}`
        console.info('[MailQueue] grouping criteria', {
            ...keyMetadata,
            keySource: 'threadRemoteId',
            key,
        })
        return key
    }
    const fallback = normalizeString(mail.from) || normalizeRecipientList(mail.mail)
    if (fallback) {
        const key = `fallback:${fallback}`
        console.info('[MailQueue] grouping criteria', {
            ...keyMetadata,
            keySource: 'fallback',
            key,
        })
        return key
    }
    console.info('[MailQueue] grouping criteria', {
        ...keyMetadata,
        keySource: 'none',
        key: '',
    })
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

import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit'
import { apiGetCustomerMails, apiGetCustomerMail } from '@/services/CustomersService'
import {
    apiGetInboxAccounts,
    apiGetInboxMailboxes,
    apiGetInboxMessages,
    apiGetInboxThreads,
    apiSendInboxMessage,
    apiUpdateInboxMessageFlags,
    apiMoveInboxMessage,
    apiMarkInboxMessageSpam,
    type InboxAccountDto,
    type InboxMailboxDto,
    type InboxMessageSummaryDto,
    type InboxThreadSummaryDto,
    type SendInboxMessagePayload,
} from '@/services/InboxService'
import { applyMailLocalState } from '../utils/localMailState'

export type Category = {
    category: string
    value?: string
    label?: string
}

type Message = {
    id: string | number
    name: string
    authorLabel?: string | null
    mail: string[]
    from: string
    avatar: string
    date: string
    content: string
    attachment: MailAttachment[]
    to?: string[]
    cc?: string[]
    bcc?: string[]
    sentAt?: string | null
    receivedAt?: string | null
    direction?: 'inbound' | 'outbound'
    headers?: Record<string, string>
    messageUid?: string
}

export type Mail = {
    id: string | number
    name: string
    authorLabel?: string | null
    label: string
    group: string
    folder?: string | null
    flagged: boolean
    starred: boolean
    from: string
    avatar: string
    title: string
    subject?: string
    mail: string[]
    previewText?: string | null
    snippet?: string | null
    sentAt?: string | null
    receivedAt?: string | null
    isRead?: boolean
    provider?: string
    messageUid?: string | null
    threadRemoteId?: string | null
    canonicalThreadKey?: string | null
    conversationId?: string | null
    remoteId?: string | null
    queueId?: string | null
    queueSlug?: string | null
    queueName?: string | null
    activityAt?: string | null
    headers?: Record<string, string>
    ccAddresses?: string[]
    bccAddresses?: string[]
    replyToAddresses?: string[]
    message: Message[]
    metadata?: Record<string, unknown> | null
}

export type MailAttachment = {
    file: string
    size: string
    type: string
    id?: string
    url?: string
    inlineUrl?: string
    downloadUrl?: string
    contentType?: string
    contentBase64?: string
    content?: string
}

type GetCrmMailsRequest = Category

type GetCrmMailsResponse = Mail[]

type GetCrmMailRequest = { id: string }

type GetCrmMailResponse = Mail

type InboxMessagesByMailbox = Record<string, InboxMessageSummaryDto[]>
type InboxMailboxesByAccount = Record<string, InboxMailboxDto[]>
type InboxCursorByMailbox = Record<string, string | null | undefined>
type InboxRequestStatus = 'idle' | 'loading' | 'succeeded' | 'failed'
type InboxStatusByKey = Record<string, InboxRequestStatus>
type InboxErrorByKey = Record<string, string | null>

const normalizeMailboxId = (value?: string | null) =>
    (value ?? '').trim().toUpperCase()

type InboxSendAttempt = {
    id: string
    accountId: string
    status: 'pending' | 'succeeded' | 'failed'
    startedAt: string
    completedAt?: string
    messageId?: string
    error?: string | null
}

const isInboxMailbox = (mailbox: InboxMailboxDto) => {
    const normalizedId = normalizeMailboxId(mailbox.id)
    const normalizedType = normalizeMailboxId(mailbox.type)
    return normalizedId === 'INBOX' || normalizedType === 'INBOX'
}

const findPrimaryInboxMailboxId = (mailboxes: InboxMailboxDto[]) => {
    const inboxMailbox = mailboxes.find(isInboxMailbox)
    if (inboxMailbox) {
        return inboxMailbox.id
    }
    return mailboxes[0]?.id
}

const cloneMessageForMailbox = (
    message: InboxMessageSummaryDto,
    mailboxId: string,
) =>
    message.folder === mailboxId
        ? message
        : {
              ...message,
              folder: mailboxId,
          }

const toMailDirection = (
    direction: InboxMessageSummaryDto['direction'],
): 'inbound' | 'outbound' =>
    direction === 'OUTBOUND' ? 'outbound' : 'inbound'

const buildMailFromInboxMessage = (
    message: InboxMessageSummaryDto,
): Mail => {
    const sentAt = message.sentAt ?? null
    const receivedAt = message.receivedAt ?? null
    const preview =
        message.previewText ??
        message.snippet ??
        ''
    const fromAddress =
        message.from?.address ??
        message.from?.name ??
        ''
    const fromName =
        message.authorLabel ??
        message.from?.name ??
        fromAddress
    const metadataBase =
        message.metadata && typeof message.metadata === 'object'
            ? { ...(message.metadata as Record<string, unknown>) }
            : {}
    const metadata = {
        ...metadataBase,
        accountId: message.accountId,
        mailbox: message.folder ?? null,
        direction: message.direction,
        provider: message.provider,
        queueId: message.queueId ?? null,
        queueSlug: message.queueSlug ?? null,
        queueName: message.queueName ?? null,
        messageUid: message.messageUid,
    }
    const messageEntry: Message = {
        id: message.id,
        name: fromName,
        authorLabel: message.authorLabel ?? fromName,
        mail: message.to ?? [],
        from: fromAddress,
        avatar: '',
        date: receivedAt ?? sentAt ?? '',
        content: preview,
        attachment: [],
        to: message.to ?? [],
        cc: message.cc ?? [],
        bcc: message.bcc ?? [],
        sentAt,
        receivedAt,
        direction: toMailDirection(message.direction),
        headers: undefined,
        messageUid: message.messageUid,
    }
    const normalizedGroup = normalizeMailboxId(message.folder)
    const group =
        normalizedGroup && normalizedGroup.length > 0
            ? normalizedGroup.toLowerCase()
            : 'inbox'
    const mailObject: Mail = {
        id: message.id,
        name: fromName,
        authorLabel: message.authorLabel ?? fromName,
        label: message.folder ?? 'Inbox',
        group,
        folder: message.folder ?? null,
        flagged: message.isSpam,
        starred: message.isStarred,
        from: fromAddress,
        avatar: '',
        title: message.subject ?? '',
        subject: message.subject ?? '',
        mail: message.to ?? [],
        previewText: message.previewText ?? preview,
        snippet: message.snippet ?? preview,
        sentAt,
        receivedAt,
        isRead: message.isRead,
        provider: message.provider,
        messageUid: message.messageUid ?? null,
        threadRemoteId: message.threadRemoteId ?? null,
        canonicalThreadKey: message.canonicalThreadKey ?? null,
        remoteId: message.remoteId ?? message.id,
        queueId: message.queueId ?? null,
        queueSlug: message.queueSlug ?? null,
        queueName: message.queueName ?? null,
        activityAt: message.activityAt ?? receivedAt ?? sentAt,
        headers: undefined,
        ccAddresses: message.cc ?? [],
        bccAddresses: message.bcc ?? [],
        replyToAddresses: [],
        message: [messageEntry],
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
    }
    return applyMailLocalState(mailObject)
}

const buildMailFromInboxThread = (
    thread: InboxThreadSummaryDto,
): Mail => {
    const latestAt = thread.latestMessageAt ?? null
    const messages: Message[] = thread.messages.map((entry) => ({
        id: entry.id,
        name:
            entry.authorLabel ??
            entry.from?.name ??
            entry.from?.address ??
            '',
        authorLabel:
            entry.authorLabel ??
            entry.from?.name ??
            entry.from?.address ??
            '',
        mail: entry.to ?? [],
        from: entry.from?.address ?? '',
        avatar: '',
        date: entry.activityAt ?? entry.receivedAt ?? entry.sentAt ?? '',
        content: entry.previewText ?? entry.snippet ?? '',
        attachment: [],
        to: entry.to ?? [],
        cc: entry.cc ?? [],
        bcc: entry.bcc ?? [],
        sentAt: entry.sentAt ?? null,
        receivedAt: entry.receivedAt ?? null,
        direction: toMailDirection(entry.direction),
        headers: undefined,
        messageUid: undefined,
    }))

    return applyMailLocalState({
        id: thread.id,
        name:
            thread.authorLabel ??
            thread.from?.name ??
            thread.from?.address ??
            '',
        authorLabel:
            thread.authorLabel ??
            thread.from?.name ??
            thread.from?.address ??
            '',
        label: thread.mailbox,
        group: normalizeMailboxId(thread.mailbox).toLowerCase() || 'inbox',
        folder: thread.mailbox,
        flagged: thread.isSpam,
        starred: thread.isStarred,
        from: thread.from?.address ?? '',
        avatar: '',
        title: thread.subject ?? '',
        subject: thread.subject ?? '',
        mail: thread.to ?? [],
        previewText: thread.previewText ?? thread.snippet ?? '',
        snippet: thread.snippet ?? thread.previewText ?? '',
        sentAt: latestAt,
        receivedAt: latestAt,
        isRead: thread.isRead,
        provider: 'email-thread',
        messageUid: null,
        threadRemoteId: thread.threadRemoteId ?? null,
        canonicalThreadKey: thread.canonicalThreadKey,
        conversationId: thread.conversationId ?? null,
        remoteId: thread.latestRemoteId ?? thread.id,
        queueId: null,
        queueSlug: null,
        queueName: null,
        activityAt: latestAt,
        headers: undefined,
        ccAddresses: thread.cc ?? [],
        bccAddresses: thread.bcc ?? [],
        replyToAddresses: [],
        message: messages,
        metadata: {
            accountId: thread.accountId,
            mailbox: thread.mailbox,
            canonicalThreadKey: thread.canonicalThreadKey,
            conversationId: thread.conversationId ?? null,
            messageCount: thread.messageCount,
            latestMessageId: thread.latestMessageId ?? null,
        },
    })
}

const buildInboxThreadMailKey = (mail: Partial<Mail>) =>
    mail.canonicalThreadKey ||
    mail.threadRemoteId ||
    (mail.remoteId !== undefined && mail.remoteId !== null
        ? String(mail.remoteId)
        : String(mail.id ?? ''))

const sortMailMessagesChronologically = (messages: Message[]) =>
    [...messages].sort((left, right) => {
        const leftTime =
            parseTimestamp(left.receivedAt) ??
            parseTimestamp(left.sentAt) ??
            parseTimestamp(left.date) ??
            0
        const rightTime =
            parseTimestamp(right.receivedAt) ??
            parseTimestamp(right.sentAt) ??
            parseTimestamp(right.date) ??
            0
        return leftTime - rightTime
    })

const buildMailFromInboxThreadMessage = (
    message: InboxMessageSummaryDto,
): Mail => {
    const threadKey =
        message.canonicalThreadKey ??
        message.threadRemoteId ??
        message.remoteId
    const base = buildMailFromInboxMessage(message)
    const mailId = threadKey || base.id
    return applyMailLocalState({
        ...base,
        id: mailId,
        canonicalThreadKey: message.canonicalThreadKey ?? null,
        threadRemoteId: message.threadRemoteId ?? null,
        remoteId: message.remoteId,
        metadata: mergeMetadata(base.metadata, {
            canonicalThreadKey: message.canonicalThreadKey ?? null,
        }),
    })
}

const mergeMailMessages = (
    existing: Message[] | undefined,
    incoming: Message[] | undefined,
) => {
    const result = new Map<string, Message>()
    const buildKey = (message: Message, index: number) =>
        message.messageUid
            ? `uid:${message.messageUid}`
            : message.id !== undefined && message.id !== null
            ? `id:${String(message.id)}`
            : `idx:${index}:${message.date ?? ''}:${message.from ?? ''}`
    ;(existing ?? []).forEach((message, index) => {
        result.set(buildKey(message, index), message)
    })
    ;(incoming ?? []).forEach((message, index) => {
        const key = buildKey(message, (existing?.length ?? 0) + index)
        const current = result.get(key)
        if (current) {
            result.set(key, { ...current, ...message })
        } else {
            result.set(key, message)
        }
    })
    return Array.from(result.values())
}

const mergeMetadata = (
    previous: Record<string, unknown> | null | undefined,
    next: Record<string, unknown> | null | undefined,
) => {
    if (previous && next) {
        return { ...previous, ...next }
    }
    return next ?? previous ?? null
}

const mergeInboxMails = (existing: Mail[], updates: Mail[]) => {
    if (updates.length === 0) {
        return existing
    }
    const makeKey = (mail: Mail) =>
        mail.messageUid
            ? `uid:${mail.messageUid}`
            : mail.remoteId
                ? `remote:${mail.remoteId}`
                : `id:${String(mail.id)}`
    const byKey = new Map<string, Mail>()
    existing.forEach((mail) => {
        byKey.set(makeKey(mail), mail)
    })
    updates.forEach((mail) => {
        const key = makeKey(mail)
        const current = byKey.get(key)
        if (!current) {
            const unreadMail =
                mail.isRead === false
                    ? mail
                    : {
                          ...mail,
                          isRead: false,
                      }
            byKey.set(key, applyMailLocalState(unreadMail))
            return
        }
        const merged: Mail = applyMailLocalState({
            ...current,
            ...mail,
            metadata: mergeMetadata(current.metadata, mail.metadata),
            message: mergeMailMessages(current.message, mail.message),
        })
        byKey.set(key, merged)
    })
    return Array.from(byKey.values())
}

const mergeInboxThreadMails = (existing: Mail[], updates: Mail[]) => {
    if (updates.length === 0) {
        return existing
    }

    const byKey = new Map<string, Mail>()
    existing.forEach((mail) => {
        byKey.set(buildInboxThreadMailKey(mail), mail)
    })

    updates.forEach((mail) => {
        const key = buildInboxThreadMailKey(mail)
        const current = byKey.get(key)
        if (!current) {
            byKey.set(key, applyMailLocalState(mail))
            return
        }

        const currentTs = getMailActivityTimestamp(current)
        const nextTs = getMailActivityTimestamp(mail)
        const latest = nextTs >= currentTs ? mail : current
        const mergedMessages = sortMailMessagesChronologically(
            mergeMailMessages(current.message, mail.message),
        )

        byKey.set(
            key,
            applyMailLocalState({
                ...current,
                ...latest,
                id: latest.id ?? current.id,
                metadata: mergeMetadata(current.metadata, mail.metadata),
                message: mergedMessages,
                isRead: (current.isRead ?? true) && (mail.isRead ?? true),
                starred: Boolean(current.starred) || Boolean(mail.starred),
                flagged: Boolean(current.flagged) || Boolean(mail.flagged),
                canonicalThreadKey:
                    latest.canonicalThreadKey ??
                    current.canonicalThreadKey ??
                    null,
                threadRemoteId:
                    latest.threadRemoteId ?? current.threadRemoteId ?? null,
                remoteId: latest.remoteId ?? current.remoteId ?? null,
                activityAt:
                    latest.activityAt ?? current.activityAt ?? null,
            }),
        )
    })

    return Array.from(byKey.values())
}

const mergeMailboxMessages = (
    existing: InboxMessageSummaryDto[],
    incoming: InboxMessageSummaryDto[],
    mode: 'replace' | 'append' | 'prepend',
) => {
    if (mode === 'replace') {
        return incoming
    }
    const result = new Map<string, InboxMessageSummaryDto>()
    if (mode === 'append') {
        existing.forEach((message) => {
            const key = message.messageUid ?? message.id
            result.set(key, message)
        })
        incoming.forEach((message) => {
            const key = message.messageUid ?? message.id
            result.set(key, message)
        })
    } else {
        incoming.forEach((message) => {
            const key = message.messageUid ?? message.id
            result.set(key, message)
        })
        existing.forEach((message) => {
            const key = message.messageUid ?? message.id
            if (!result.has(key)) {
                result.set(key, message)
            }
        })
    }
    return Array.from(result.values())
}

const parseTimestamp = (value?: string | null) => {
    if (!value) {
        return null
    }
    const parsed = Date.parse(value)
    if (Number.isNaN(parsed)) {
        return null
    }
    return parsed
}

const getMailActivityTimestamp = (mail: Partial<Mail>) => {
    const candidates = [
        mail.activityAt,
        mail.receivedAt,
        mail.sentAt,
        mail.message?.[0]?.receivedAt,
        mail.message?.[0]?.sentAt,
        mail.message?.[0]?.date,
    ]

    for (const candidate of candidates) {
        const parsed = parseTimestamp(candidate ?? null)
        if (parsed !== null) {
            return parsed
        }
    }

    return 0
}

const extractMessageTimestamps = (message: InboxMessageSummaryDto) => {
    const timestamps: number[] = []
    const received = parseTimestamp(message.receivedAt)
    const sent = parseTimestamp(message.sentAt)
    if (received !== null) {
        timestamps.push(received)
    }
    if (sent !== null) {
        timestamps.push(sent)
    }
    const metadataUpdated =
        message.metadata &&
        typeof message.metadata === 'object' &&
        typeof (message.metadata as Record<string, unknown>).updatedAt ===
            'string'
            ? parseTimestamp(
                  (message.metadata as Record<string, unknown>)
                      .updatedAt as string,
              )
            : null
    if (metadataUpdated !== null) {
        timestamps.push(metadataUpdated)
    }
    return timestamps
}

const updateLastFetchedAt = (
    tracker: Record<string, string | null>,
    accountId: string,
    mailboxId: string,
    messages: InboxMessageSummaryDto[],
) => {
    const key = `${accountId}:${mailboxId}`
    const existing = tracker[key]
    let latest =
        existing !== undefined && existing !== null
            ? parseTimestamp(existing)
            : null
    messages.forEach((message) => {
        const candidates = extractMessageTimestamps(message)
        candidates.forEach((timestamp) => {
            if (timestamp !== null) {
                if (latest === null || timestamp > latest) {
                    latest = timestamp
                }
            }
        })
    })
    if (latest !== null) {
        tracker[key] = new Date(latest).toISOString()
    } else if (!(key in tracker)) {
        tracker[key] = new Date().toISOString()
    }
}

type InboxState = {
    accounts: InboxAccountDto[]
    accountsLoading: boolean
    mailboxesByAccount: InboxMailboxesByAccount
    mailboxesLoading: boolean
    mailboxesRequestStatus: InboxStatusByKey
    mailboxesErrorByAccount: InboxErrorByKey
    messagesByMailbox: InboxMessagesByMailbox
    messagesLoading: boolean
    messagesRequestStatus: InboxStatusByKey
    messagesErrorByMailbox: InboxErrorByKey
    nextCursorByMailbox: InboxCursorByMailbox
    lastFetchedAtByMailbox: Record<string, string | null>
    selectedAccountId?: string
    selectedMailboxId?: string
    sendStatus: InboxRequestStatus
    sendError: string | null
    lastActionStatus: InboxRequestStatus
    lastActionError: string | null
    sendLog: InboxSendAttempt[]
}

export type MailState = {
    mailListLoading: boolean
    mailLoading: boolean
    mailList: Mail[]
    mail: Partial<Mail>
    selectedMailId: string | number
    sideBarExpand: boolean
    mobileSideBarExpand: boolean
    selectedCategory: Partial<Category>
    reply: boolean
    newMessageDialog: boolean
    inbox: InboxState
}

export const SLICE_NAME = 'crmMail'

export const getMails = createAsyncThunk(
    SLICE_NAME + '/getMails',
    async (params: GetCrmMailsRequest) => {
        const response = await apiGetCustomerMails<
            GetCrmMailsResponse,
            GetCrmMailsRequest
        >(params)
        return response.data
    },
)

export const getMail = createAsyncThunk(
    SLICE_NAME + '/getMail',
    async (params: GetCrmMailRequest) => {
        const response = await apiGetCustomerMail<
            GetCrmMailResponse,
            GetCrmMailRequest
        >(params)
        return response.data
    },
)

export const fetchInboxAccounts = createAsyncThunk(
    `${SLICE_NAME}/fetchInboxAccounts`,
    async () => {
        const response = await apiGetInboxAccounts()
        return response.data
    },
)

export const fetchInboxMailboxes = createAsyncThunk(
    `${SLICE_NAME}/fetchInboxMailboxes`,
    async ({ accountId }: { accountId: string }) => {
        const response = await apiGetInboxMailboxes(accountId)
        return {
            accountId,
            mailboxes: response.data,
        }
    },
)

export const fetchInboxMessages = createAsyncThunk(
    `${SLICE_NAME}/fetchInboxMessages`,
    async ({
        accountId,
        mailbox,
        cursor,
        limit,
        since,
    }: {
        accountId: string
        mailbox: string
        cursor?: string
        limit?: number
        since?: string
    }) => {
        const response = await apiGetInboxMessages({
            accountId,
            mailbox,
            cursor,
            limit,
            since,
        })
        return {
            accountId,
            mailbox,
            result: response.data,
        }
    },
)

export const fetchInboxThreads = createAsyncThunk(
    `${SLICE_NAME}/fetchInboxThreads`,
    async ({
        accountId,
        mailbox,
        cursor,
        limit,
        since,
    }: {
        accountId: string
        mailbox: string
        cursor?: string
        limit?: number
        since?: string
    }) => {
        const response = await apiGetInboxThreads({
            accountId,
            mailbox,
            cursor,
            limit,
            since,
        })
        return {
            accountId,
            mailbox,
            result: response.data,
        }
    },
)

export const sendInboxMessage = createAsyncThunk(
    `${SLICE_NAME}/sendInboxMessage`,
    async ({
        accountId,
        payload,
    }: {
        accountId: string
        payload: SendInboxMessagePayload
    }) => {
        const response = await apiSendInboxMessage({
            accountId,
            payload,
        })
        return {
            accountId,
            message: response.data,
        }
    },
)

export const updateInboxMessageFlags = createAsyncThunk(
    `${SLICE_NAME}/updateInboxMessageFlags`,
    async ({
        accountId,
        remoteId,
        body,
        mailbox,
    }: {
        accountId: string
        remoteId: string
        mailbox: string
        body: {
            threadRemoteId?: string
            seen?: boolean
            starred?: boolean
            spam?: boolean
            metadata?: Record<string, unknown>
        }
    }) => {
        const response = await apiUpdateInboxMessageFlags({
            accountId,
            remoteId,
            body,
        })
        return {
            accountId,
            mailbox,
            message: response.data,
        }
    },
)

export const moveInboxMessage = createAsyncThunk(
    `${SLICE_NAME}/moveInboxMessage`,
    async ({
        accountId,
        remoteId,
        currentMailbox,
        body,
    }: {
        accountId: string
        remoteId: string
        currentMailbox: string
        body: { threadRemoteId?: string; targetMailbox: string }
    }) => {
        const response = await apiMoveInboxMessage({
            accountId,
            remoteId,
            body,
        })
        return {
            accountId,
            currentMailbox,
            targetMailbox: body.targetMailbox,
            message: response.data,
        }
    },
)

export const markInboxMessageSpam = createAsyncThunk(
    `${SLICE_NAME}/markInboxMessageSpam`,
    async ({
        accountId,
        remoteId,
        currentMailbox,
        body,
    }: {
        accountId: string
        remoteId: string
        currentMailbox: string
        body?: { threadRemoteId?: string }
    }) => {
        const response = await apiMarkInboxMessageSpam({
            accountId,
            remoteId,
            body,
        })
        return {
            accountId,
            currentMailbox,
            targetMailbox: response.data.folder ?? 'Spam',
            message: response.data,
        }
    },
)

export const initialState: MailState = {
    mailListLoading: false,
    mailLoading: false,
    mailList: [],
    mail: {},
    selectedMailId: '',
    sideBarExpand: true,
    mobileSideBarExpand: false,
    selectedCategory: {},
    reply: false,
    newMessageDialog: false,
    inbox: {
        accounts: [],
        accountsLoading: false,
        mailboxesByAccount: {},
        mailboxesLoading: false,
        mailboxesRequestStatus: {},
        mailboxesErrorByAccount: {},
        messagesByMailbox: {},
        messagesLoading: false,
        messagesRequestStatus: {},
        messagesErrorByMailbox: {},
        nextCursorByMailbox: {},
        lastFetchedAtByMailbox: {},
        selectedAccountId: undefined,
        selectedMailboxId: undefined,
        sendStatus: 'idle',
        sendError: null,
        lastActionStatus: 'idle',
        lastActionError: null,
        sendLog: [],
    },
}

const mailSlice = createSlice({
    name: `${SLICE_NAME}/state`,
    initialState,
    reducers: {
        updateMailList: (state, action) => {
            state.mailList = action.payload
        },
        updateMail: (state, action) => {
            state.mail = action.payload
            state.mailLoading = false
        },
        patchMail: (state, action) => {
            const { id, changes } = action.payload as {
                id: string | number
                changes: Partial<Mail>
            }
            state.mailList = state.mailList.map((mail) =>
                mail.id === id ? { ...mail, ...changes } : mail,
            )
            if (state.mail?.id === id) {
                state.mail = { ...state.mail, ...changes }
            }
        },
        updateMailId: (state, action) => {
            if (action.payload) {
                state.mailLoading = true
            }
            state.selectedMailId = action.payload
        },
        updateReply: (state, action) => {
            state.reply = action.payload
        },
        toggleSidebar: (state, action) => {
            state.sideBarExpand = action.payload
        },
        toggleMobileSidebar: (state, action) => {
            state.mobileSideBarExpand = action.payload
        },
        toggleNewMessageDialog: (state, action) => {
            state.newMessageDialog = action.payload
        },
        updateSelectedCategory: (state, action) => {
            state.selectedCategory = action.payload
            state.mailList = []
            state.mailListLoading = true
        },
        setSelectedInboxContext: (
            state,
            action: PayloadAction<{
                accountId?: string
                mailboxId?: string
            }>,
        ) => {
            const nextAccountId = action.payload.accountId
            const nextMailboxId = action.payload.mailboxId
            if (
                state.inbox.selectedAccountId === nextAccountId &&
                state.inbox.selectedMailboxId === nextMailboxId
            ) {
                return
            }
            state.inbox.selectedAccountId = nextAccountId
            state.inbox.selectedMailboxId = nextMailboxId
            state.mailList = []
            state.mailListLoading = true
            state.mailLoading = false
            state.mail = {}
            state.selectedMailId = ''
        },
        setSelectedInboxAccount: (state, action) => {
            if (state.inbox.selectedAccountId === action.payload) {
                return
            }
            state.inbox.selectedAccountId = action.payload
            state.inbox.selectedMailboxId = undefined
            state.mailList = []
            state.mailListLoading = true
            state.mailLoading = false
            state.mail = {}
            state.selectedMailId = ''
        },
        setSelectedInboxMailbox: (state, action) => {
            if (state.inbox.selectedMailboxId === action.payload) {
                return
            }
            state.inbox.selectedMailboxId = action.payload
            state.mailList = []
            state.mailListLoading = true
            state.mailLoading = false
            state.mail = {}
            state.selectedMailId = ''
        },
        ingestInboxEvent: (
            state,
            action: PayloadAction<{
                message: InboxMessageSummaryDto
                eventType?: string
            }>,
        ) => {
            const { message } = action.payload
            const folder = message.folder ?? 'INBOX'
            const mailboxKey = `${message.accountId}:${folder}`
            const existingList = state.inbox.messagesByMailbox[mailboxKey] ?? []
            state.inbox.messagesByMailbox[mailboxKey] = mergeMailboxMessages(
                existingList,
                [message],
                'prepend',
            )
            updateLastFetchedAt(
                state.inbox.lastFetchedAtByMailbox,
                message.accountId,
                folder,
                [message],
            )
            const isActiveMailbox =
                state.inbox.selectedAccountId === message.accountId &&
                state.inbox.selectedMailboxId === folder
            if (isActiveMailbox) {
                state.mailList = mergeInboxThreadMails(state.mailList, [
                    buildMailFromInboxThreadMessage(message),
                ])
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getMails.fulfilled, (state, action) => {
                state.mailListLoading = false
                state.mailList = action.payload
            })
            .addCase(getMails.pending, (state) => {
                state.mailListLoading = true
            })
            .addCase(getMail.fulfilled, (state, action) => {
                state.mailLoading = false
                state.mail = action.payload
            })
            .addCase(getMail.pending, (state) => {
                state.mailLoading = true
            })
            .addCase(fetchInboxAccounts.pending, (state) => {
                state.inbox.accountsLoading = true
            })
            .addCase(fetchInboxAccounts.fulfilled, (state, action) => {
                state.inbox.accountsLoading = false
                state.inbox.accounts = action.payload
                if (!state.inbox.selectedAccountId && action.payload.length > 0) {
                    state.inbox.selectedAccountId = action.payload[0].id
                }
            })
            .addCase(fetchInboxAccounts.rejected, (state) => {
                state.inbox.accountsLoading = false
            })
            .addCase(fetchInboxMailboxes.pending, (state, action) => {
                state.inbox.mailboxesLoading = true
                const accountId = action.meta.arg.accountId
                state.inbox.mailboxesRequestStatus[accountId] = 'loading'
                state.inbox.mailboxesErrorByAccount[accountId] = null
            })
            .addCase(fetchInboxMailboxes.fulfilled, (state, action) => {
                state.inbox.mailboxesLoading = false
                const { accountId, mailboxes } = action.payload
                state.inbox.mailboxesByAccount[accountId] = mailboxes
                state.inbox.mailboxesRequestStatus[accountId] = 'succeeded'
                state.inbox.mailboxesErrorByAccount[accountId] = null
                const currentSelected = state.inbox.selectedMailboxId
                const hasSelected =
                    currentSelected &&
                    mailboxes.some(
                        (mailbox) => mailbox.id === currentSelected,
                    )
                if (!hasSelected) {
        const preferredInboxId = findPrimaryInboxMailboxId(mailboxes)
        if (preferredInboxId) {
            state.inbox.selectedMailboxId = preferredInboxId
        } else if (!currentSelected && mailboxes.length > 0) {
            state.inbox.selectedMailboxId = mailboxes[0].id
        }
                }
            })
            .addCase(fetchInboxMailboxes.rejected, (state, action) => {
                state.inbox.mailboxesLoading = false
                const accountId = action.meta.arg.accountId
                state.inbox.mailboxesRequestStatus[accountId] = 'failed'
                state.inbox.mailboxesErrorByAccount[accountId] =
                    action.error?.message ?? 'Unable to load inbox mailboxes.'
            })
            .addCase(fetchInboxMessages.pending, (state, action) => {
                state.inbox.messagesLoading = true
                const key = `${action.meta.arg.accountId}:${action.meta.arg.mailbox}`
                state.inbox.messagesRequestStatus[key] = 'loading'
                state.inbox.messagesErrorByMailbox[key] = null
                if (
                    state.inbox.selectedAccountId === action.meta.arg.accountId &&
                    state.inbox.selectedMailboxId === action.meta.arg.mailbox
                ) {
                    state.mailListLoading = true
                }
            })
            .addCase(fetchInboxMessages.fulfilled, (state, action) => {
                state.inbox.messagesLoading = false
                const { accountId, mailbox, result } = action.payload
                const key = `${accountId}:${mailbox}`
                const mode: 'replace' | 'append' | 'prepend' = action.meta.arg.cursor
                    ? 'append'
                    : action.meta.arg.since
                        ? 'prepend'
                        : 'replace'
                const existingList = state.inbox.messagesByMailbox[key] ?? []
                const mergedMessages =
                    mode === 'replace'
                        ? result.items
                        : mergeMailboxMessages(existingList, result.items, mode)
                state.inbox.messagesByMailbox[key] = mergedMessages
                if (mode === 'append' || mode === 'replace') {
                    state.inbox.nextCursorByMailbox[key] = result.nextCursor ?? null
                } else {
                    state.inbox.nextCursorByMailbox[key] =
                        state.inbox.nextCursorByMailbox[key] ?? result.nextCursor ?? null
                }
                state.inbox.messagesRequestStatus[key] = 'succeeded'
                state.inbox.messagesErrorByMailbox[key] = null
                updateLastFetchedAt(
                    state.inbox.lastFetchedAtByMailbox,
                    accountId,
                    mailbox,
                    result.items,
                )
                const inboxMails = result.items.map(buildMailFromInboxMessage)
                const isActiveMailbox =
                    state.inbox.selectedAccountId === accountId &&
                    state.inbox.selectedMailboxId === mailbox
                if (isActiveMailbox) {
                    if (mode === 'replace') {
                        state.mailList = inboxMails
                    } else {
                        state.mailList = mergeInboxMails(state.mailList, inboxMails)
                    }
                    state.mailListLoading = false
                }
            })
            .addCase(fetchInboxMessages.rejected, (state, action) => {
                state.inbox.messagesLoading = false
                const key = `${action.meta.arg.accountId}:${action.meta.arg.mailbox}`
                state.inbox.messagesRequestStatus[key] = 'failed'
                state.inbox.messagesErrorByMailbox[key] =
                    action.error?.message ?? 'Unable to load inbox messages.'
                if (
                    state.inbox.selectedAccountId === action.meta.arg.accountId &&
                    state.inbox.selectedMailboxId === action.meta.arg.mailbox
                ) {
                    state.mailListLoading = false
                }
            })
            .addCase(fetchInboxThreads.pending, (state, action) => {
                state.inbox.messagesLoading = true
                const key = `${action.meta.arg.accountId}:${action.meta.arg.mailbox}`
                state.inbox.messagesRequestStatus[key] = 'loading'
                state.inbox.messagesErrorByMailbox[key] = null
                if (
                    state.inbox.selectedAccountId === action.meta.arg.accountId &&
                    state.inbox.selectedMailboxId === action.meta.arg.mailbox
                ) {
                    state.mailListLoading = true
                }
            })
            .addCase(fetchInboxThreads.fulfilled, (state, action) => {
                state.inbox.messagesLoading = false
                const { accountId, mailbox, result } = action.payload
                const key = `${accountId}:${mailbox}`
                const mode: 'replace' | 'append' =
                    action.meta.arg.cursor ? 'append' : 'replace'
                const inboxThreads = result.items.map(buildMailFromInboxThread)
                state.inbox.messagesRequestStatus[key] = 'succeeded'
                state.inbox.messagesErrorByMailbox[key] = null
                state.inbox.nextCursorByMailbox[key] = result.nextCursor ?? null
                if (
                    state.inbox.selectedAccountId === accountId &&
                    state.inbox.selectedMailboxId === mailbox
                ) {
                    state.mailList =
                        mode === 'replace'
                            ? inboxThreads
                            : mergeInboxThreadMails(state.mailList, inboxThreads)
                    state.mailListLoading = false
                }
            })
            .addCase(fetchInboxThreads.rejected, (state, action) => {
                state.inbox.messagesLoading = false
                const key = `${action.meta.arg.accountId}:${action.meta.arg.mailbox}`
                state.inbox.messagesRequestStatus[key] = 'failed'
                state.inbox.messagesErrorByMailbox[key] =
                    action.error?.message ?? 'Unable to load inbox threads.'
                if (
                    state.inbox.selectedAccountId === action.meta.arg.accountId &&
                    state.inbox.selectedMailboxId === action.meta.arg.mailbox
                ) {
                    state.mailListLoading = false
                }
            })
            .addCase(sendInboxMessage.pending, (state, action) => {
                state.inbox.sendStatus = 'loading'
                state.inbox.sendError = null
                const attemptId = action.meta.requestId
                const accountId = action.meta.arg.accountId
                const timestamp = new Date().toISOString()
                const entry: InboxSendAttempt = {
                    id: attemptId,
                    accountId,
                    status: 'pending',
                    startedAt: timestamp,
                    error: null,
                }
                state.inbox.sendLog = [entry, ...state.inbox.sendLog].slice(0, 50)
            })
            .addCase(sendInboxMessage.fulfilled, (state, action) => {
                state.inbox.sendStatus = 'succeeded'
                state.inbox.sendError = null
                const { accountId, message } = action.payload
                const targetMailboxIds = new Set<string>()
                if (message.folder) {
                    targetMailboxIds.add(message.folder)
                }
                if (!message.folder && state.inbox.selectedMailboxId) {
                    targetMailboxIds.add(state.inbox.selectedMailboxId)
                }
                if (targetMailboxIds.size === 0) {
                    targetMailboxIds.add('INBOX')
                }
                targetMailboxIds.forEach((mailboxId) => {
                    const resolvedMailboxId =
                        mailboxId && mailboxId.length > 0 ? mailboxId : 'INBOX'
                    const entry = cloneMessageForMailbox(
                        message,
                        resolvedMailboxId,
                    )
                    const key = `${accountId}:${resolvedMailboxId}`
                    const existing = state.inbox.messagesByMailbox[key] ?? []
                    state.inbox.messagesByMailbox[key] = mergeMailboxMessages(
                        existing,
                        [entry],
                        'prepend',
                    )
                    state.inbox.messagesRequestStatus[key] =
                        state.inbox.messagesRequestStatus[key] ?? 'idle'
                    state.inbox.messagesErrorByMailbox[key] =
                        state.inbox.messagesErrorByMailbox[key] ?? null
                    state.inbox.nextCursorByMailbox[key] =
                        state.inbox.nextCursorByMailbox[key] ?? null
                    updateLastFetchedAt(
                        state.inbox.lastFetchedAtByMailbox,
                        accountId,
                        resolvedMailboxId,
                        [entry],
                    )
                })
                state.mailList = mergeInboxThreadMails(state.mailList, [
                    buildMailFromInboxThreadMessage(message),
                ])
                const attemptId = action.meta.requestId
                const completionTime = new Date().toISOString()
                const logIndex = state.inbox.sendLog.findIndex(
                    (item) => item.id === attemptId,
                )
                if (logIndex >= 0) {
                    state.inbox.sendLog[logIndex] = {
                        ...state.inbox.sendLog[logIndex],
                        status: 'succeeded',
                        completedAt: completionTime,
                        messageId: message.id,
                        error: null,
                    }
                } else {
                    state.inbox.sendLog = [
                        {
                            id: attemptId,
                            accountId,
                            status: 'succeeded',
                            startedAt: completionTime,
                            completedAt: completionTime,
                            messageId: message.id,
                            error: null,
                        },
                        ...state.inbox.sendLog,
                    ].slice(0, 50)
                }
            })
            .addCase(sendInboxMessage.rejected, (state, action) => {
                state.inbox.sendStatus = 'failed'
                const errorMessage =
                    action.error?.message ?? 'Unable to send inbox message.'
                state.inbox.sendError = errorMessage
                const attemptId = action.meta.requestId
                const accountId = action.meta.arg.accountId
                const completionTime = new Date().toISOString()
                const logIndex = state.inbox.sendLog.findIndex(
                    (item) => item.id === attemptId,
                )
                if (logIndex >= 0) {
                    state.inbox.sendLog[logIndex] = {
                        ...state.inbox.sendLog[logIndex],
                        status: 'failed',
                        completedAt: completionTime,
                        error: errorMessage,
                    }
                } else {
                    state.inbox.sendLog = [
                        {
                            id: attemptId,
                            accountId,
                            status: 'failed',
                            startedAt: completionTime,
                            completedAt: completionTime,
                            error: errorMessage,
                        },
                        ...state.inbox.sendLog,
                    ].slice(0, 50)
                }
            })
            .addCase(updateInboxMessageFlags.pending, (state) => {
                state.inbox.lastActionStatus = 'loading'
                state.inbox.lastActionError = null
            })
            .addCase(updateInboxMessageFlags.fulfilled, (state, action) => {
                state.inbox.lastActionStatus = 'succeeded'
                state.inbox.lastActionError = null
                const { accountId, mailbox, message } = action.payload
                const sourceKey = `${accountId}:${mailbox}`
                const targetFolder = message.folder ?? mailbox
                const targetKey = `${accountId}:${targetFolder}`

                const sourceList = state.inbox.messagesByMailbox[sourceKey]
                if (sourceList) {
                    state.inbox.messagesByMailbox[sourceKey] = sourceList
                        .map((item) => (item.id === message.id ? message : item))
                        .filter((item) =>
                            targetFolder !== mailbox ? item.id !== message.id : true,
                        )
                }

                if (targetFolder !== mailbox) {
                    const existingTarget = state.inbox.messagesByMailbox[targetKey] ?? []
                    const filteredTarget = existingTarget.filter(
                        (item) => item.id !== message.id,
                    )
                    state.inbox.messagesByMailbox[targetKey] = [message, ...filteredTarget]
                } else if (!sourceList) {
                    const existingTarget = state.inbox.messagesByMailbox[targetKey] ?? []
                    state.inbox.messagesByMailbox[targetKey] = existingTarget.map((item) =>
                        item.id === message.id ? message : item,
                    )
                }

                const metadata = (message.metadata ??
                    null) as Record<string, unknown> | null
                const metadataLabel =
                    metadata && typeof metadata.label === 'string'
                        ? (metadata.label as string)
                        : undefined
                const metadataFlagged =
                    metadata && typeof metadata.flagged === 'boolean'
                        ? (metadata.flagged as boolean)
                        : undefined

                updateLastFetchedAt(
                    state.inbox.lastFetchedAtByMailbox,
                    accountId,
                    targetFolder,
                    [message],
                )
                state.mailList = mergeInboxThreadMails(state.mailList, [
                    buildMailFromInboxThreadMessage(message),
                ])

                state.mailList = state.mailList.map((mailItem) => {
                    if (buildInboxThreadMailKey(mailItem) === buildInboxThreadMailKey({
                        canonicalThreadKey: message.canonicalThreadKey ?? null,
                        threadRemoteId: message.threadRemoteId ?? null,
                        remoteId: message.remoteId,
                        id: message.id,
                    })) {
                        return {
                            ...mailItem,
                            isRead: message.isRead,
                            starred: message.isStarred,
                            flagged:
                                metadataFlagged !== undefined
                                    ? metadataFlagged
                                    : mailItem.flagged,
                            label:
                                metadataLabel !== undefined
                                    ? metadataLabel
                                    : mailItem.label,
                            metadata,
                        }
                    }
                    return mailItem
                })

                if (
                    buildInboxThreadMailKey(state.mail) ===
                    buildInboxThreadMailKey({
                        canonicalThreadKey: message.canonicalThreadKey ?? null,
                        threadRemoteId: message.threadRemoteId ?? null,
                        remoteId: message.remoteId,
                        id: message.id,
                    })
                ) {
                    state.mail = {
                        ...state.mail,
                        isRead: message.isRead,
                        starred: message.isStarred,
                        flagged:
                            metadataFlagged !== undefined
                                ? metadataFlagged
                                : state.mail.flagged,
                        label:
                            metadataLabel !== undefined ? metadataLabel : state.mail.label,
                        metadata,
                    }
                }
            })
            .addCase(updateInboxMessageFlags.rejected, (state, action) => {
                state.inbox.lastActionStatus = 'failed'
                state.inbox.lastActionError =
                    action.error?.message ?? 'Unable to update inbox message.'
            })
            .addCase(moveInboxMessage.pending, (state) => {
                state.inbox.lastActionStatus = 'loading'
                state.inbox.lastActionError = null
            })
            .addCase(moveInboxMessage.fulfilled, (state, action) => {
                state.inbox.lastActionStatus = 'succeeded'
                state.inbox.lastActionError = null
                const { accountId, currentMailbox, targetMailbox, message } =
                    action.payload
                const sourceKey = `${accountId}:${currentMailbox}`
                const targetKey = `${accountId}:${targetMailbox}`

                const sourceList = state.inbox.messagesByMailbox[sourceKey] ?? []
                state.inbox.messagesByMailbox[sourceKey] = sourceList.filter(
                    (item) => item.id !== message.id,
                )

                const targetList = state.inbox.messagesByMailbox[targetKey] ?? []
                state.inbox.messagesByMailbox[targetKey] = mergeMailboxMessages(
                    targetList,
                    [message],
                    'prepend',
                )
                updateLastFetchedAt(
                    state.inbox.lastFetchedAtByMailbox,
                    accountId,
                    targetMailbox,
                    [message],
                )

                const metadata = (message.metadata ??
                    null) as Record<string, unknown> | null
                state.mailList = mergeInboxThreadMails(state.mailList, [
                    buildMailFromInboxThreadMessage(message),
                ])
                state.mailList = state.mailList.map((mailItem) =>
                    buildInboxThreadMailKey(mailItem) ===
                    buildInboxThreadMailKey({
                        canonicalThreadKey: message.canonicalThreadKey ?? null,
                        threadRemoteId: message.threadRemoteId ?? null,
                        remoteId: message.remoteId,
                        id: message.id,
                    })
                        ? {
                              ...mailItem,
                              group: targetMailbox,
                              folder: targetMailbox,
                              metadata,
                          }
                        : mailItem,
                )

                if (
                    buildInboxThreadMailKey(state.mail) ===
                    buildInboxThreadMailKey({
                        canonicalThreadKey: message.canonicalThreadKey ?? null,
                        threadRemoteId: message.threadRemoteId ?? null,
                        remoteId: message.remoteId,
                        id: message.id,
                    })
                ) {
                    state.mail = {
                        ...state.mail,
                        group: targetMailbox,
                        folder: targetMailbox,
                        metadata,
                    }
                }
            })
            .addCase(moveInboxMessage.rejected, (state, action) => {
                state.inbox.lastActionStatus = 'failed'
                state.inbox.lastActionError =
                    action.error?.message ?? 'Unable to move inbox message.'
            })
            .addCase(markInboxMessageSpam.pending, (state) => {
                state.inbox.lastActionStatus = 'loading'
                state.inbox.lastActionError = null
            })
            .addCase(markInboxMessageSpam.fulfilled, (state, action) => {
                state.inbox.lastActionStatus = 'succeeded'
                state.inbox.lastActionError = null
                const { accountId, currentMailbox, targetMailbox, message } =
                    action.payload
                const sourceKey = `${accountId}:${currentMailbox}`
                const targetKey = `${accountId}:${targetMailbox}`

                const sourceList = state.inbox.messagesByMailbox[sourceKey] ?? []
                state.inbox.messagesByMailbox[sourceKey] = sourceList.filter(
                    (item) => item.id !== message.id,
                )

                const targetList = state.inbox.messagesByMailbox[targetKey] ?? []
                state.inbox.messagesByMailbox[targetKey] = mergeMailboxMessages(
                    targetList,
                    [message],
                    'prepend',
                )
                updateLastFetchedAt(
                    state.inbox.lastFetchedAtByMailbox,
                    accountId,
                    targetMailbox,
                    [message],
                )

                const metadata = (message.metadata ??
                    null) as Record<string, unknown> | null
                state.mailList = mergeInboxThreadMails(state.mailList, [
                    buildMailFromInboxThreadMessage(message),
                ])
                state.mailList = state.mailList.map((mailItem) =>
                    buildInboxThreadMailKey(mailItem) ===
                    buildInboxThreadMailKey({
                        canonicalThreadKey: message.canonicalThreadKey ?? null,
                        threadRemoteId: message.threadRemoteId ?? null,
                        remoteId: message.remoteId,
                        id: message.id,
                    })
                        ? {
                              ...mailItem,
                              group: targetMailbox,
                              folder: targetMailbox,
                              flagged: true,
                              metadata,
                          }
                        : mailItem,
                )

                if (
                    buildInboxThreadMailKey(state.mail) ===
                    buildInboxThreadMailKey({
                        canonicalThreadKey: message.canonicalThreadKey ?? null,
                        threadRemoteId: message.threadRemoteId ?? null,
                        remoteId: message.remoteId,
                        id: message.id,
                    })
                ) {
                    state.mail = {
                        ...state.mail,
                        group: targetMailbox,
                        folder: targetMailbox,
                        flagged: true,
                        metadata,
                    }
                }
            })
            .addCase(markInboxMessageSpam.rejected, (state, action) => {
                state.inbox.lastActionStatus = 'failed'
                state.inbox.lastActionError =
                    action.error?.message ?? 'Unable to mark inbox message as spam.'
            })
    },
})

export const {
    updateMailList,
    updateMail,
    patchMail,
    updateMailId,
    updateReply,
    toggleSidebar,
    toggleMobileSidebar,
    toggleNewMessageDialog,
    updateSelectedCategory,
    setSelectedInboxContext,
    setSelectedInboxAccount,
    setSelectedInboxMailbox,
    ingestInboxEvent,
} = mailSlice.actions

export default mailSlice.reducer

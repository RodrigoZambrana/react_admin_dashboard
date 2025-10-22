import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apiGetCustomerMails, apiGetCustomerMail } from '@/services/CustomersService'
import {
    apiGetInboxAccounts,
    apiGetInboxMailboxes,
    apiGetInboxMessages,
    apiSendInboxMessage,
    apiUpdateInboxMessageFlags,
    apiMoveInboxMessage,
    apiMarkInboxMessageSpam,
    type InboxAccountDto,
    type InboxMailboxDto,
    type InboxMessageSummaryDto,
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
}

export type Mail = {
    id: string | number
    name: string
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
    threadRemoteId?: string | null
    remoteId?: string | null
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

const isSentMailbox = (mailbox: InboxMailboxDto) => {
    const normalizedId = normalizeMailboxId(mailbox.id)
    const normalizedType = normalizeMailboxId(mailbox.type)
    return normalizedId === 'SENT' || normalizedType === 'SENT'
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
    }
    const messageEntry: Message = {
        id: message.id,
        name: fromName,
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
    }
    const normalizedGroup = normalizeMailboxId(message.folder)
    const group =
        normalizedGroup && normalizedGroup.length > 0
            ? normalizedGroup.toLowerCase()
            : 'inbox'
    const mailObject: Mail = {
        id: message.id,
        name: fromName,
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
        threadRemoteId: message.threadRemoteId ?? null,
        remoteId: message.remoteId ?? message.id,
        headers: undefined,
        ccAddresses: message.cc ?? [],
        bccAddresses: message.bcc ?? [],
        replyToAddresses: [],
        message: [messageEntry],
        metadata: Object.keys(metadata).length > 0 ? metadata : null,
    }
    return applyMailLocalState(mailObject)
}

const mergeMailMessages = (
    existing: Message[] | undefined,
    incoming: Message[] | undefined,
) => {
    const result = new Map<string, Message>()
    const buildKey = (message: Message, index: number) =>
        message.id !== undefined && message.id !== null
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
        mail.remoteId ? `remote:${mail.remoteId}` : `id:${String(mail.id)}`
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
            result.set(message.id, message)
        })
        incoming.forEach((message) => {
            result.set(message.id, message)
        })
    } else {
        incoming.forEach((message) => {
            result.set(message.id, message)
        })
        existing.forEach((message) => {
            if (!result.has(message.id)) {
                result.set(message.id, message)
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

const initialState: MailState = {
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
        },
        setSelectedInboxAccount: (state, action) => {
            state.inbox.selectedAccountId = action.payload
        },
        setSelectedInboxMailbox: (state, action) => {
            state.inbox.selectedMailboxId = action.payload
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
                const filtered = mailboxes.filter((mailbox) => !isSentMailbox(mailbox))
                const normalizedList =
                    filtered.length > 0 ? filtered : mailboxes
                state.inbox.mailboxesByAccount[accountId] = normalizedList
                state.inbox.mailboxesRequestStatus[accountId] = 'succeeded'
                state.inbox.mailboxesErrorByAccount[accountId] = null
                const currentSelected = state.inbox.selectedMailboxId
                const hasSelected =
                    currentSelected &&
                    normalizedList.some(
                        (mailbox) => mailbox.id === currentSelected,
                    )
                if (!hasSelected) {
                    const preferredId = findPrimaryInboxMailboxId(normalizedList)
                    if (preferredId) {
                        state.inbox.selectedMailboxId = preferredId
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
                state.mailList = mergeInboxMails(state.mailList, inboxMails)
            })
            .addCase(fetchInboxMessages.rejected, (state, action) => {
                state.inbox.messagesLoading = false
                const key = `${action.meta.arg.accountId}:${action.meta.arg.mailbox}`
                state.inbox.messagesRequestStatus[key] = 'failed'
                state.inbox.messagesErrorByMailbox[key] =
                    action.error?.message ?? 'Unable to load inbox messages.'
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
                const mailboxes = state.inbox.mailboxesByAccount[accountId] ?? []
                const primaryMailboxId =
                    findPrimaryInboxMailboxId(mailboxes) ??
                    state.inbox.selectedMailboxId ??
                    message.folder ??
                    mailboxes[0]?.id ??
                    'INBOX'
                const targetMailboxIds = new Set<string>()
                if (primaryMailboxId) {
                    targetMailboxIds.add(primaryMailboxId)
                }
                if (message.folder) {
                    targetMailboxIds.add(message.folder)
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
                const inboxMail = buildMailFromInboxMessage(message)
                state.mailList = mergeInboxMails(state.mailList, [inboxMail])
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
                state.mailList = mergeInboxMails(state.mailList, [
                    buildMailFromInboxMessage(message),
                ])

                state.mailList = state.mailList.map((mailItem) => {
                    if (mailItem.remoteId === message.remoteId) {
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

                if (state.mail?.remoteId === message.remoteId) {
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
                state.mailList = mergeInboxMails(state.mailList, [
                    buildMailFromInboxMessage(message),
                ])
                state.mailList = state.mailList.map((mailItem) =>
                    mailItem.remoteId === message.remoteId
                        ? {
                              ...mailItem,
                              group: targetMailbox,
                              folder: targetMailbox,
                              metadata,
                          }
                        : mailItem,
                )

                if (state.mail?.remoteId === message.remoteId) {
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
                state.mailList = mergeInboxMails(state.mailList, [
                    buildMailFromInboxMessage(message),
                ])
                state.mailList = state.mailList.map((mailItem) =>
                    mailItem.remoteId === message.remoteId
                        ? {
                              ...mailItem,
                              group: targetMailbox,
                              folder: targetMailbox,
                              flagged: true,
                              metadata,
                          }
                        : mailItem,
                )

                if (state.mail?.remoteId === message.remoteId) {
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
    setSelectedInboxAccount,
    setSelectedInboxMailbox,
} = mailSlice.actions

export default mailSlice.reducer

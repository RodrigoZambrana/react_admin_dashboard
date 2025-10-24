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

export type Category = {
    category: string
    value?: string
    label?: string
}

type Message = {
    id: number
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
    id: number
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
    selectedAccountId?: string
    selectedMailboxId?: string
    sendStatus: InboxRequestStatus
    sendError: string | null
    lastActionStatus: InboxRequestStatus
    lastActionError: string | null
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
        selectedAccountId: undefined,
        selectedMailboxId: undefined,
        sendStatus: 'idle',
        sendError: null,
        lastActionStatus: 'idle',
        lastActionError: null,
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
                state.inbox.mailboxesByAccount[accountId] = mailboxes
                state.inbox.mailboxesRequestStatus[accountId] = 'succeeded'
                state.inbox.mailboxesErrorByAccount[accountId] = null
                if (
                    !state.inbox.selectedMailboxId &&
                    mailboxes.length > 0
                ) {
                    state.inbox.selectedMailboxId = mailboxes[0].id
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
                const key = `${action.payload.accountId}:${action.payload.mailbox}`
                state.inbox.messagesByMailbox[key] = action.payload.result.items
                state.inbox.nextCursorByMailbox[key] =
                    action.payload.result.nextCursor ?? null
                state.inbox.messagesRequestStatus[key] = 'succeeded'
                state.inbox.messagesErrorByMailbox[key] = null
            })
            .addCase(fetchInboxMessages.rejected, (state, action) => {
                state.inbox.messagesLoading = false
                const key = `${action.meta.arg.accountId}:${action.meta.arg.mailbox}`
                state.inbox.messagesRequestStatus[key] = 'failed'
                state.inbox.messagesErrorByMailbox[key] =
                    action.error?.message ?? 'Unable to load inbox messages.'
            })
            .addCase(sendInboxMessage.pending, (state) => {
                state.inbox.sendStatus = 'loading'
                state.inbox.sendError = null
            })
            .addCase(sendInboxMessage.fulfilled, (state, action) => {
                state.inbox.sendStatus = 'succeeded'
                state.inbox.sendError = null
                const { accountId, message } = action.payload
                const folder = message.folder || 'Sent'
                const key = `${accountId}:${folder}`
                const existing = state.inbox.messagesByMailbox[key] ?? []
                const filtered = existing.filter((item) => item.id !== message.id)
                state.inbox.messagesByMailbox[key] = [message, ...filtered]
                state.inbox.messagesRequestStatus[key] =
                    state.inbox.messagesRequestStatus[key] ?? 'idle'
                state.inbox.messagesErrorByMailbox[key] =
                    state.inbox.messagesErrorByMailbox[key] ?? null
                state.inbox.nextCursorByMailbox[key] =
                    state.inbox.nextCursorByMailbox[key] ?? null
            })
            .addCase(sendInboxMessage.rejected, (state, action) => {
                state.inbox.sendStatus = 'failed'
                state.inbox.sendError =
                    action.error?.message ?? 'Unable to send inbox message.'
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
                const filteredTarget = targetList.filter(
                    (item) => item.id !== message.id,
                )
                state.inbox.messagesByMailbox[targetKey] = [message, ...filteredTarget]

                const metadata = (message.metadata ??
                    null) as Record<string, unknown> | null
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
                const filteredTarget = targetList.filter(
                    (item) => item.id !== message.id,
                )
                state.inbox.messagesByMailbox[targetKey] = [message, ...filteredTarget]

                const metadata = (message.metadata ??
                    null) as Record<string, unknown> | null
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

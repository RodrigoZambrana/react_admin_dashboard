import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { apiGetCustomerMails, apiGetCustomerMail } from '@/services/CustomersService'
import {
    apiGetInboxAccounts,
    apiGetInboxMailboxes,
    apiGetInboxMessages,
    type InboxAccountDto,
    type InboxMailboxDto,
    type InboxMessageListResponse,
    type InboxMessageSummaryDto,
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
    attachment: {
        file: string
        size: string
        type: string
    }[]
}

export type Mail = {
    id: number
    name: string
    label: string
    group: string
    flagged: boolean
    starred: boolean
    from: string
    avatar: string
    title: string
    mail: string[]
    message: Message[]
}

type GetCrmMailsRequest = Category

type GetCrmMailsResponse = Mail[]

type GetCrmMailRequest = { id: string }

type GetCrmMailResponse = Mail

type InboxMessagesByMailbox = Record<string, InboxMessageSummaryDto[]>
type InboxMailboxesByAccount = Record<string, InboxMailboxDto[]>
type InboxCursorByMailbox = Record<string, string | null | undefined>

type InboxState = {
    accounts: InboxAccountDto[]
    accountsLoading: boolean
    mailboxesByAccount: InboxMailboxesByAccount
    mailboxesLoading: boolean
    messagesByMailbox: InboxMessagesByMailbox
    messagesLoading: boolean
    nextCursorByMailbox: InboxCursorByMailbox
    selectedAccountId?: string
    selectedMailboxId?: string
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
        messagesByMailbox: {},
        messagesLoading: false,
        nextCursorByMailbox: {},
        selectedAccountId: undefined,
        selectedMailboxId: undefined,
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
            .addCase(fetchInboxMailboxes.pending, (state) => {
                state.inbox.mailboxesLoading = true
            })
            .addCase(fetchInboxMailboxes.fulfilled, (state, action) => {
                state.inbox.mailboxesLoading = false
                state.inbox.mailboxesByAccount[action.payload.accountId] =
                    action.payload.mailboxes
                if (
                    !state.inbox.selectedMailboxId &&
                    action.payload.mailboxes.length > 0
                ) {
                    state.inbox.selectedMailboxId = action.payload.mailboxes[0].id
                }
            })
            .addCase(fetchInboxMailboxes.rejected, (state) => {
                state.inbox.mailboxesLoading = false
            })
            .addCase(fetchInboxMessages.pending, (state) => {
                state.inbox.messagesLoading = true
            })
            .addCase(fetchInboxMessages.fulfilled, (state, action) => {
                state.inbox.messagesLoading = false
                const key = `${action.payload.accountId}:${action.payload.mailbox}`
                state.inbox.messagesByMailbox[key] = action.payload.result.items
                state.inbox.nextCursorByMailbox[key] =
                    action.payload.result.nextCursor ?? null
            })
            .addCase(fetchInboxMessages.rejected, (state) => {
                state.inbox.messagesLoading = false
            })
    },
})

export const {
    updateMailList,
    updateMail,
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

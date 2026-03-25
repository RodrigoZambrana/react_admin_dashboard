import ApiService from './ApiService'

export type InboxAccountDto = {
    id: string
    channel: string
    address?: string | null
    displayName?: string | null
    active: boolean
    metadata?: unknown
    createdAt?: string
    updatedAt?: string
}

export type InboxMailboxDto = {
    id: string
    label: string
    type?: string
    unreadCount?: number
    metadata?: unknown
}

export type InboxMessageSummaryDto = {
    id: string
    accountId: string
    provider: string
    messageUid: string
    remoteId: string
    threadRemoteId?: string | null
    canonicalThreadKey?: string | null
    subject?: string | null
    snippet?: string | null
    previewText?: string | null
    from?: { name?: string | null; address?: string | null } | null
    to: string[]
    cc: string[]
    bcc: string[]
    direction: 'INBOUND' | 'OUTBOUND'
    folder?: string | null
    isRead: boolean
    isStarred: boolean
    isSpam: boolean
    hasAttachments: boolean
    queueId?: string | null
    queueSlug?: string | null
    queueName?: string | null
    sentAt?: string | null
    receivedAt?: string | null
    activityAt?: string | null
    metadata?: Record<string, unknown> | null
}

export type InboxAttachmentDto = {
    id: string
    remoteId?: string | null
    fileName?: string | null
    contentType?: string | null
    size?: number | null
    metadata?: Record<string, unknown> | null
}

export type InboxMessageDetailDto = InboxMessageSummaryDto & {
    bodyHtml?: string | null
    bodyText?: string | null
    headers?: Record<string, string>
    attachments: InboxAttachmentDto[]
}

export type InboxMessageListResponse = {
    items: InboxMessageSummaryDto[]
    nextCursor?: string | null
}

export type InboxThreadSummaryDto = {
    id: string
    accountId: string
    mailbox: string
    canonicalThreadKey: string
    conversationId?: string | null
    subject?: string | null
    previewText?: string | null
    snippet?: string | null
    from?: { name?: string | null; address?: string | null } | null
    to: string[]
    cc: string[]
    bcc: string[]
    isRead: boolean
    isStarred: boolean
    isSpam: boolean
    hasAttachments: boolean
    latestMessageAt?: string | null
    latestMessageId?: string | null
    latestRemoteId?: string | null
    threadRemoteId?: string | null
    messageCount: number
    messages: Array<{
        id: string
        remoteId: string
        threadRemoteId?: string | null
        canonicalThreadKey?: string | null
        subject?: string | null
        previewText?: string | null
        snippet?: string | null
        from?: { name?: string | null; address?: string | null } | null
        to: string[]
        cc: string[]
        bcc: string[]
        direction: 'INBOUND' | 'OUTBOUND'
        isRead: boolean
        isStarred: boolean
        isSpam: boolean
        hasAttachments: boolean
        sentAt?: string | null
        receivedAt?: string | null
        activityAt?: string | null
    }>
}

export type InboxThreadListResponse = {
    items: InboxThreadSummaryDto[]
    nextCursor?: string | null
}

export type InboxSyncResponse = {
    accountId: string
    mailboxes: {
        mailbox: string
        fetched: number
        nextCursor?: string | null
        complete?: boolean
    }[]
}

export type SendInboxMessagePayload = {
    subject: string
    to: string[]
    cc?: string[]
    bcc?: string[]
    replyTo?: string[]
    replyToRemoteId?: string
    bodyHtml?: string
    bodyText?: string
    attachments?: {
        fileName: string
        contentType?: string
        content: string
    }[]
    metadata?: Record<string, unknown>
    fromAddress?: string
    fromName?: string
    queueId?: string
    queueSlug?: string
}

export const apiGetInboxAccounts = () => {
    return ApiService.fetchData<InboxAccountDto[]>({
        url: '/inbox/accounts',
        method: 'get',
    })
}

export const apiGetInboxMailboxes = (accountId: string) => {
    return ApiService.fetchData<InboxMailboxDto[]>({
        url: `/inbox/accounts/${accountId}/mailboxes`,
        method: 'get',
    })
}

export const apiGetInboxMessages = (params: {
    accountId: string
    mailbox: string
    cursor?: string
    limit?: number
    since?: string
}) => {
    const { accountId, mailbox, cursor, limit, since } = params
    return ApiService.fetchData<InboxMessageListResponse>({
        url: `/inbox/accounts/${accountId}/messages`,
        method: 'get',
        params: {
            mailbox,
            cursor,
            limit,
            since,
        },
    })
}

export const apiGetInboxThreads = (params: {
    accountId: string
    mailbox: string
    cursor?: string
    limit?: number
    since?: string
}) => {
    const { accountId, mailbox, cursor, limit, since } = params
    return ApiService.fetchData<InboxThreadListResponse>({
        url: `/inbox/accounts/${accountId}/threads`,
        method: 'get',
        params: {
            mailbox,
            cursor,
            limit,
            since,
        },
    })
}

export const apiGetInboxMessageDetail = (params: {
    accountId: string
    remoteId: string
    threadRemoteId?: string
}) => {
    const { accountId, remoteId, threadRemoteId } = params
    return ApiService.fetchData<InboxMessageDetailDto>({
        url: `/inbox/accounts/${accountId}/messages/${remoteId}`,
        method: 'get',
        params: {
            threadRemoteId,
        },
    })
}

export const apiSendInboxMessage = (params: {
    accountId: string
    payload: SendInboxMessagePayload
}) => {
    const { accountId, payload } = params
    return ApiService.fetchData<InboxMessageSummaryDto>({
        url: `/inbox/accounts/${accountId}/messages/send`,
        method: 'post',
        data: payload,
    })
}

export const apiUpdateInboxMessageFlags = (params: {
    accountId: string
    remoteId: string
    body: {
        threadRemoteId?: string
        seen?: boolean
        starred?: boolean
        spam?: boolean
    }
}) => {
    const { accountId, remoteId, body } = params
    return ApiService.fetchData<InboxMessageSummaryDto>({
        url: `/inbox/accounts/${accountId}/messages/${remoteId}/flags`,
        method: 'post',
        data: body,
    })
}

export const apiMoveInboxMessage = (params: {
    accountId: string
    remoteId: string
    body: { threadRemoteId?: string; targetMailbox: string }
}) => {
    const { accountId, remoteId, body } = params
    return ApiService.fetchData<InboxMessageSummaryDto>({
        url: `/inbox/accounts/${accountId}/messages/${remoteId}/move`,
        method: 'post',
        data: body,
    })
}

export const apiMarkInboxMessageSpam = (params: {
    accountId: string
    remoteId: string
    body?: { threadRemoteId?: string }
}) => {
    const { accountId, remoteId, body } = params
    return ApiService.fetchData<InboxMessageSummaryDto>({
        url: `/inbox/accounts/${accountId}/messages/${remoteId}/spam`,
        method: 'post',
        data: body,
    })
}

export const apiSyncInboxAccount = (params: {
    accountId: string
    body?: {
        mailboxes?: string[]
        limit?: number
        cursor?: string | null
        since?: string
        fullHistory?: boolean
        maxPages?: number
    }
}) => {
    const { accountId, body } = params
    return ApiService.fetchData<InboxSyncResponse>({
        url: `/inbox/accounts/${accountId}/sync`,
        method: 'post',
        data: body,
    })
}

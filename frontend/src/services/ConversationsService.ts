import ApiService from './ApiService'

export type ConversationSummary = {
    id: string
    tenantKey: string
    scope: string
    channel: string
    status: string
    controlMode: string
    subject: string | null
    externalUserId: string | null
    externalThreadId: string | null
    externalChannelRef: string | null
    lastMessageAt: string | null
    lastInboundAt: string | null
    lastOutboundAt: string | null
    createdAt: string
    updatedAt: string
    customer: {
        id: number
        name: string
        email: string | null
        phoneNumber: string | null
    } | null
    assignedToUser: {
        id: number
        name: string | null
        email: string
    } | null
    inboxAccount: {
        id: string
        displayName: string | null
        address: string | null
        channel: string
    } | null
    queue: {
        id: string
        slug: string
        name: string
        priority: number
        slaTargetMinutes: number
    } | null
    operational: {
        needsAssignment: boolean
        isSlaBreached: boolean
        slaAgeMinutes: number | null
        slaTargetMinutes: number | null
    }
    participants: Array<{
        id: string
        role: string
        displayName: string | null
        externalUserId: string | null
        customer: {
            id: number
            name: string
            email: string | null
        } | null
        user: {
            id: number
            name: string | null
            email: string
        } | null
    }>
    latestMessage: {
        id: string
        authorType: string
        kind: string
        body: string | null
        createdAt: string
    } | null
}

export type ConversationDetail = ConversationSummary & {
    messages: Array<{
        id: string
        authorType: string
        kind: string
        body: string | null
        normalizedText: string | null
        payload: Record<string, unknown> | null
        metadata: Record<string, unknown> | null
        sentAt: string | null
        receivedAt: string | null
        createdAt: string
        queue: {
            id: string
            slug: string
            name: string
        } | null
        transportEvents: Array<{
            id: string
            type: string
            payload: Record<string, unknown> | null
            occurredAt: string
        }>
    }>
    handoffEvents: Array<{
        id: string
        type: string
        previousMode: string | null
        nextMode: string | null
        notes: string | null
        createdAt: string
        actorUser: {
            id: number
            name: string | null
            email: string
        } | null
    }>
    toolCalls: Array<{
        id: string
        messageId: string | null
        toolName: string
        status: string
        validatedPayload: Record<string, unknown> | null
        resultPayload: Record<string, unknown> | string | null
        errorCode: string | null
        errorMessage: string | null
        createdAt: string
        updatedAt: string
    }>
}

export type ConversationListResponse = {
    items: ConversationSummary[]
    total: number
    page: number
    pageSize: number
    filters: {
        scope: string | null
        channel: string | null
        controlMode: string | null
        status: string | null
        assignedToMe: boolean
        assignedUserId: string | null
        inboxAccountId: string | null
        queueSlug: string | null
        search: string | null
    }
}

export type InboxSummary = {
    id: string
    channel: string
    displayName: string | null
    address: string | null
    active: boolean
    updatedAt: string
    scope: string
}

export type ConversationQueueSummary = {
    id: string
    slug: string
    name: string
    description: string | null
    isActive: boolean
    priority: number
    assignmentMode: string
    maxAssignedConversations: number | null
    operatorCount: number
    conversationCount: number
    waitingCustomerCount: number
    unassignedCount: number
    breachedSlaCount: number
    oldestInboundAt: string | null
    slaTargetMinutes: number
    assignedOpenCount: number
    configuredCapacity: number | null
    availableCapacity: number | null
    primaryOperators: Array<{
        id: number
        name: string
        email: string
        maxOpenConversations: number | null
    }>
}

export type CreateAdminInternalConversationInput = {
    tenantKey?: string
    subject: string
    message: string
}

export type RerouteConversationInput = {
    queueSlug?: string
    userId?: number
    notes?: string
}

const ConversationsService = {
    async fetchConversations(params?: Record<string, unknown>) {
        const response = await ApiService.fetchData<ConversationListResponse>({
            url: '/conversations',
            method: 'get',
            params,
        })
        return response.data
    },

    async fetchConversation(id: string) {
        const response = await ApiService.fetchData<ConversationDetail>({
            url: `/conversations/${id}`,
            method: 'get',
        })
        return response.data
    },

    async fetchInboxes() {
        const response = await ApiService.fetchData<InboxSummary[]>({
            url: '/conversations/inboxes',
            method: 'get',
        })
        return response.data
    },

    async fetchQueues() {
        const response = await ApiService.fetchData<ConversationQueueSummary[]>({
            url: '/conversations/queues',
            method: 'get',
        })
        return response.data
    },

    async takeoverConversation(id: string, notes?: string) {
        const response = await ApiService.fetchData<ConversationDetail>({
            url: `/conversations/${id}/takeover`,
            method: 'post',
            data: notes ? { notes } : {},
        })
        return response.data
    },

    async releaseConversation(id: string, notes?: string) {
        const response = await ApiService.fetchData<ConversationDetail>({
            url: `/conversations/${id}/release`,
            method: 'post',
            data: notes ? { notes } : {},
        })
        return response.data
    },

    async assignConversation(id: string, userId: number, notes?: string) {
        const response = await ApiService.fetchData<ConversationDetail>({
            url: `/conversations/${id}/assign`,
            method: 'post',
            data: notes ? { userId, notes } : { userId },
        })
        return response.data
    },

    async rerouteConversation(id: string, data: RerouteConversationInput) {
        const response = await ApiService.fetchData<ConversationDetail>({
            url: `/conversations/${id}/reroute`,
            method: 'post',
            data,
        })
        return response.data
    },

    async replyToConversation(id: string, body: string) {
        const response = await ApiService.fetchData<ConversationDetail>({
            url: `/conversations/${id}/reply`,
            method: 'post',
            data: { body, kind: 'text' },
        })
        return response.data
    },

    async createAdminInternalConversation(
        data: CreateAdminInternalConversationInput,
    ) {
        const response = await ApiService.fetchData<ConversationDetail>({
            url: '/conversations/admin-internal/session',
            method: 'post',
            data,
        })
        return response.data
    },
}

export default ConversationsService

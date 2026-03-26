import ApiService from './ApiService'

export type ConversationSummary = {
    id: string
    tenantKey: string
    scope: string
    role: string
    channel: string
    status: string
    controlMode: string
    needsHuman: boolean
    subject: string | null
    externalUserId: string | null
    externalThreadId: string | null
    externalChannelRef: string | null
    isPinned: boolean
    pinnedAt: string | null
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
    aiState: {
        needsHuman: boolean
        grounded: boolean
        fallbackReason: string | null
        sourceCount: number
        updatedAt: string | null
        memory: {
            taskId: string | null
            intentKey: string | null
            taskSummary: string | null
            currentTask: {
                intentKey: string | null
                status: string | null
                lastUpdate: string | null
                entities: Array<{
                    type: string | null
                    value: string | null
                }>
            } | null
            resetApplied: boolean
            resetCount: number
            lastResetAt: string | null
            historyTurnCount: number
        } | null
        audit: {
            role: string | null
            intentKey: string | null
            blockedTools: string[]
            executedTools: string[]
            fallbackActivated: boolean
            taskChanged: boolean
            createdAt: string | null
        } | null
        sources: Array<{
            id: string | null
            title: string | null
            scope: string | null
            sourceType: string | null
            score: number | null
        }>
    } | null
    aiAudit: {
        total: number
        search: number
        state: number
        parser: number
        crud: number
        latestToolName: string | null
        latestStatus: string | null
        updatedAt: string | null
    }
    readState: {
        lastReadAt: string | null
        unreadCount: number
        isRead: boolean
        manualUnread: boolean
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
        metadata: Record<string, unknown> | null
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

export type ConversationContact = {
    key: string
    kind: 'customer' | 'internal'
    customerId?: number
    label: string
    description: string | null
    email: string | null
    phoneNumber: string | null
    channel: string | null
    conversationId: string | null
    hasDeliveryChannel: boolean
    updatedAt: string | null
}

export type ConversationContactsResponse = {
    items: ConversationContact[]
}

export type StartContactConversationInput = {
    contactType: 'customer' | 'internal'
    customerId?: number
    tenantKey?: string
    message?: string
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

    async fetchContacts(params?: { search?: string; limit?: number }) {
        const response = await ApiService.fetchData<ConversationContactsResponse>({
            url: '/conversations/contacts',
            method: 'get',
            params,
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

    async markConversationRead(id: string) {
        const response = await ApiService.fetchData<ConversationDetail>({
            url: `/conversations/${id}/read`,
            method: 'post',
        })
        return response.data
    },

    async markConversationUnread(id: string) {
        const response = await ApiService.fetchData<ConversationDetail>({
            url: `/conversations/${id}/unread`,
            method: 'post',
        })
        return response.data
    },

    async pinConversation(id: string) {
        const response = await ApiService.fetchData<ConversationDetail>({
            url: `/conversations/${id}/pin`,
            method: 'post',
        })
        return response.data
    },

    async unpinConversation(id: string) {
        const response = await ApiService.fetchData<ConversationDetail>({
            url: `/conversations/${id}/unpin`,
            method: 'post',
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

    async startConversationFromContact(data: StartContactConversationInput) {
        const response = await ApiService.fetchData<ConversationDetail>({
            url: '/conversations/contact-session',
            method: 'post',
            data,
        })
        return response.data
    },
}

export default ConversationsService

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
            state?: string | null
            stateHistory?: string[]
            lastTransitionAt?: string | null
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
            intentConfidence?: number | null
            intentSource?: string | null
            actionKey?: string | null
            stage?: string | null
            stageHistory?: string[]
            decisionPath?: string[]
            blockedTools: string[]
            executedTools: string[]
            toolCalls?: Array<{
                name: string | null
                status: string | null
                target: string | null
            }>
            referencedMessages?: Array<{
                messageId: string | null
                createdAt: string | null
                    preview: string | null
            }>
            messageElementsUsed?: string[]
            messageElements?: Array<{
                kind: string | null
                source: string | null
                label: string | null
                preview: string | null
            }>
            messageContextOrigin?: string[]
            turnInterpretation?: {
                category: string | null
                currentTurnText: string | null
                intent: {
                    key: string | null
                    confidence: number | null
                    source: string | null
                    inherited: boolean
                } | null
                followUp: {
                    detected: boolean
                    inheritedIntentKey: string | null
                    confidence: number | null
                    source: string | null
                } | null
                topic: {
                    label: string | null
                    type: string | null
                    confidence: number | null
                    source: string | null
                } | null
                retrievalQuery: string | null
                operationalQuery: string | null
                threadResolution: {
                    threads: Array<{
                        key: string | null
                        baseKey: string | null
                        baseLabel: string | null
                        baseType: string | null
                        familyLabel: string | null
                        displayLabel: string | null
                        resolvedLabel: string | null
                        variantLabels: string[]
                        confidence: number | null
                        source: string | null
                    }>
                    activeThreadKey: string | null
                    activeThread: {
                        key: string | null
                        baseKey: string | null
                        baseLabel: string | null
                        baseType: string | null
                        familyLabel: string | null
                        displayLabel: string | null
                        resolvedLabel: string | null
                        variantLabels: string[]
                        confidence: number | null
                        source: string | null
                    } | null
                    multiTopicDetected: boolean
                    requiresDisambiguation: boolean
                    switchDetected: boolean
                    measurementOnlyTurn: boolean
                    promptText: string | null
                } | null
                quoteContext: {
                    requiresMeasurements: boolean
                    familyLabel: string | null
                    topicLabel: string | null
                    profileKey: string | null
                    profileLabel: string | null
                    missingFields: string[]
                    requiredFields: string[]
                    completionStatus: string | null
                    closureMode: string | null
                    capturedAttributes: Record<
                        string,
                        {
                            value: string | number | Record<string, unknown> | null
                            label: string | null
                            source: string | null
                        }
                    >
                } | null
            } | null
            detail?: string | null
            input?: string | null
            grounded?: boolean | null
            needsHuman?: boolean | null
            fallbackReason?: string | null
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
        authorUser: {
            id: number
            name: string | null
            email: string
        } | null
        authorLabel?: string | null
        kind: string
        body: string | null
        preview: string | null
        previewKind: string | null
        createdAt: string
        metadata: Record<string, unknown> | null
    } | null
}

export type ConversationDetail = ConversationSummary & {
    aiSuggestions: {
        conversationId: string
        targetMessageId: string | null
        targetMessageText?: string | null
        items: Array<{
            id: string
            title: string
            summary: string | null
            responseText: string
            detectedIntent: string | null
            confidence: number | null
            score: number
            matchedBy: string[]
            version: number
            feedback: {
                used: number
                edited: number
                discarded: number
            }
            source: {
                type: string
                candidateId: string
                observationId: string | null
                reviewedAt: string | null
            }
        }>
    }
    messages: Array<{
        id: string
        authorType: string
        authorKind?: string | null
        authorLabel?: string | null
        kind: string
        messageKind?: string | null
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

export type ConversationAiSuggestionFeedbackInput = {
    candidateId: string
    targetMessageId?: string | null
    targetMessageText?: string | null
    suggestedText?: string | null
    outcome?: 'used' | 'edited' | 'discarded'
}

export type ConversationMessageAttachmentInput = {
    assetType?: string | null
    fileName?: string | null
    contentType?: string | null
    content?: string | null
    textContent?: string | null
    metadata?: Record<string, unknown> | null
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

    async replyToConversation(
        id: string,
        body: string,
        aiSuggestionFeedback?: ConversationAiSuggestionFeedbackInput,
        attachments?: ConversationMessageAttachmentInput[],
    ) {
        const response = await ApiService.fetchData<ConversationDetail>({
            url: `/conversations/${id}/reply`,
            method: 'post',
            data: {
                body,
                kind: 'text',
                aiSuggestionFeedback,
                attachments,
            },
        })
        return response.data
    },

    async recordConversationSuggestionFeedback(
        id: string,
        feedback: ConversationAiSuggestionFeedbackInput,
    ) {
        const response = await ApiService.fetchData<{
            conversationId: string
            id: string
            outcome: string
            candidateId: string
            operatorMessageId: string | null
            createdAt: string
        }>({
            url: `/conversations/${id}/ai-suggestions/feedback`,
            method: 'post',
            data: {
                feedback,
            },
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

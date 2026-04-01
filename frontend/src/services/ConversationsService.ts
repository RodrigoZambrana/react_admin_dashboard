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
        transport?: string | null
    } | null
    channelState?: {
        transport: string | null
        archived: boolean | null
        read: boolean | null
        pinned: boolean | null
        muted: boolean | null
        mutePreset: string | null
        muteDurationMs: number | null
        mutedUntil: string | null
        deleted: boolean | null
        threadId: string | null
        updatedAt: string | null
        updatedByUserId: number | null
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

export type ConversationDebugMessageInput = {
    text?: string
    delayMs?: number
    attachments?: ConversationMessageAttachmentInput[]
}

export type ConversationDebugKnowledgeMode =
    | 'full'
    | 'retrieval_disabled'
    | 'retrieval_only'

export type ConversationDebugRunInput = {
    simulateAs?: 'guest' | 'authenticated'
    reset?: boolean
    disableKnowledge?: boolean
    knowledgeMode?: ConversationDebugKnowledgeMode
    tenantKey?: string
    guestId?: string
    name?: string
    email?: string
    locale?: string
    currency?: string
    page?: string
    waitTimeoutMs?: number
    messages?: ConversationDebugMessageInput[]
}

export type ConversationDebugTurn = {
    turnId: string | null
    createdAt: string | null
    semanticTurnId?: string | null
    userMessages: Array<{
        id: string
        authorKind: string | null
        body: string | null
        normalizedText: string | null
        createdAt: string | null
        attachments?: Array<Record<string, unknown>>
    }>
    originalUserInput: string | null
    processedInput: string | null
    contextSent: Record<string, unknown> | null
    promptSent: Record<string, unknown> | null
    rawAiResponse: Record<string, unknown> | null
    finalResponse: string | null
    debugSummary: string | null
    responseMode: 'deterministic' | 'generative' | 'hybrid' | null
    providerCallCount?: number | null
    decisionSource?: string | null
    naturalityScore?: number | null
    waitForMore?: boolean | null
    knowledgeRetrieved?: boolean | null
    knowledgeGrounded?: boolean | null
    intent: {
        key: string | null
        confidence: number | null
        source: string | null
    } | null
    turnInterpretation: Record<string, unknown> | null
    decisionTrace: Record<string, unknown> | null
    metrics: Record<string, unknown> | null
    grounding: {
        grounded: boolean | null
        fallbackReason: string | null
        sourceCount: number
        sources: Array<Record<string, unknown>>
    } | null
    actions: {
        evaluated: unknown[]
        executed: Array<{
            name: string | null
            status: string | null
            target: string | null
        }>
        discarded: string[]
    }
    pending?: boolean
}

export type ConversationDebugSnapshot = {
    conversation: {
        id: string
        tenantKey: string
        scope: string
        role: string
        channel: string
        status: string
        controlMode: string
        subject: string | null
        externalUserId: string | null
        createdAt: string
        updatedAt: string
        customer: ConversationSummary['customer']
        simulation: {
            authenticated: boolean
            externalUserId: string | null
            debugSession?: boolean
        }
    }
    turns: ConversationDebugTurn[]
    metrics?: {
        totalTurns: number
        groundedResponses: { count: number; percentage: number }
        fallbackResponses: { count: number; percentage: number }
        deterministicResponses: { count: number; percentage: number }
        hybridResponses: { count: number; percentage: number }
        generativeResponses: { count: number; percentage: number }
        actionsExecuted: { count: number; percentage: number }
        realChunkResponses: { count: number; percentage: number }
        knowledgeUsedResponses?: { count: number; percentage: number }
        retrievedOnlyResponses?: { count: number; percentage: number }
        modelOnlyResponses?: { count: number; percentage: number }
        semanticEmbeddingResponses: { count: number; percentage: number }
        possibleKnowledgeHallucinations: { count: number; percentage: number }
        multiCallTurns?: { count: number; percentage: number }
        waitForMoreTurns?: { count: number; percentage: number }
        avgNaturalityScore?: number
        chunksUtilized?: number
    }
    execution?: {
        created: boolean
        reset: boolean
        messagesDispatched: number
        settled: boolean
        waitTimeoutMs: number
        options?: {
            disableKnowledge: boolean
            knowledgeMode: ConversationDebugKnowledgeMode
            simulateAs: 'guest' | 'authenticated'
        }
        dispatches: Array<Record<string, unknown>>
    }
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

    async reactToWhatsappMessage(
        conversationId: string,
        messageId: string,
        emoji: string,
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            messageId: string
            emoji: string
            provider: string
        }>({
            url: `/conversations/${conversationId}/messages/${messageId}/whatsapp/reaction`,
            method: 'post',
            data: {
                emoji,
            },
        })
        return response.data
    },

    async reactToWebchatMessage(
        conversationId: string,
        messageId: string,
        emoji: string,
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            messageId: string
            emoji: string
            provider: string
        }>({
            url: `/conversations/${conversationId}/messages/${messageId}/webchat/reaction`,
            method: 'post',
            data: {
                emoji,
            },
        })
        return response.data
    },

    async replyToWebchatMessage(
        conversationId: string,
        messageId: string,
        body: string,
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            messageId: string
            quotedMessageId: string
        }>({
            url: `/conversations/${conversationId}/messages/${messageId}/webchat/reply`,
            method: 'post',
            data: {
                body,
            },
        })
        return response.data
    },

    async replyToWhatsappMessage(
        conversationId: string,
        messageId: string,
        body: string,
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            messageId: string
            quotedMessageId: string
        }>({
            url: `/conversations/${conversationId}/messages/${messageId}/whatsapp/reply`,
            method: 'post',
            data: {
                body,
            },
        })
        return response.data
    },

    async editWebchatMessage(
        conversationId: string,
        messageId: string,
        body: string,
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            messageId: string
            body: string
        }>({
            url: `/conversations/${conversationId}/messages/${messageId}/webchat/edit`,
            method: 'post',
            data: {
                body,
            },
        })
        return response.data
    },

    async editWhatsappMessage(
        conversationId: string,
        messageId: string,
        body: string,
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            messageId: string
            body: string
        }>({
            url: `/conversations/${conversationId}/messages/${messageId}/whatsapp/edit`,
            method: 'post',
            data: {
                body,
            },
        })
        return response.data
    },

    async deleteWebchatMessage(conversationId: string, messageId: string) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            messageId: string
            deleted: boolean
        }>({
            url: `/conversations/${conversationId}/messages/${messageId}/webchat/delete`,
            method: 'post',
        })
        return response.data
    },

    async deleteWhatsappMessage(conversationId: string, messageId: string) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            messageId: string
            deleted: boolean
        }>({
            url: `/conversations/${conversationId}/messages/${messageId}/whatsapp/delete`,
            method: 'post',
        })
        return response.data
    },

    async toggleWhatsappMessageStar(
        conversationId: string,
        messageId: string,
        starred: boolean,
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            messageId: string
            starred: boolean
        }>({
            url: `/conversations/${conversationId}/messages/${messageId}/whatsapp/star`,
            method: 'post',
            data: {
                starred,
            },
        })
        return response.data
    },

    async toggleWebchatMessageStar(
        conversationId: string,
        messageId: string,
        starred: boolean,
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            messageId: string
            starred: boolean
        }>({
            url: `/conversations/${conversationId}/messages/${messageId}/webchat/star`,
            method: 'post',
            data: {
                starred,
            },
        })
        return response.data
    },

    async forwardWhatsappMessage(
        conversationId: string,
        messageId: string,
        targetConversationId: string,
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            sourceConversationId: string
            sourceMessageId: string
            targetConversationId: string
            forwardedMessageId: string
        }>({
            url: `/conversations/${conversationId}/messages/${messageId}/whatsapp/forward`,
            method: 'post',
            data: {
                targetConversationId,
            },
        })
        return response.data
    },

    async toggleWhatsappChatArchive(
        conversationId: string,
        archived: boolean,
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            archived: boolean
        }>({
            url: `/conversations/${conversationId}/whatsapp/archive`,
            method: 'post',
            data: {
                archived,
            },
        })
        return response.data
    },

    async toggleWebchatChatArchive(
        conversationId: string,
        archived: boolean,
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            archived: boolean
        }>({
            url: `/conversations/${conversationId}/webchat/archive`,
            method: 'post',
            data: {
                archived,
            },
        })
        return response.data
    },

    async toggleWhatsappChatReadState(
        conversationId: string,
        read: boolean,
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            read: boolean
        }>({
            url: `/conversations/${conversationId}/whatsapp/read-state`,
            method: 'post',
            data: {
                read,
            },
        })
        return response.data
    },

    async toggleWhatsappChatPinState(
        conversationId: string,
        pinned: boolean,
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            pinned: boolean
        }>({
            url: `/conversations/${conversationId}/whatsapp/pin-state`,
            method: 'post',
            data: {
                pinned,
            },
        })
        return response.data
    },

    async setWhatsappChatMuteState(
        conversationId: string,
        preset: 'off' | '8h' | '7d',
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            muted: boolean
            mutePreset: string | null
            muteDurationMs: number | null
            mutedUntil: string | null
        }>({
            url: `/conversations/${conversationId}/whatsapp/mute-state`,
            method: 'post',
            data: {
                preset,
            },
        })
        return response.data
    },

    async setWebchatChatMuteState(
        conversationId: string,
        preset: 'off' | '8h' | '7d',
    ) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            muted: boolean
            mutePreset: string | null
            muteDurationMs: number | null
            mutedUntil: string | null
        }>({
            url: `/conversations/${conversationId}/webchat/mute-state`,
            method: 'post',
            data: {
                preset,
            },
        })
        return response.data
    },

    async deleteWebchatChat(conversationId: string) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            deleted: boolean
        }>({
            url: `/conversations/${conversationId}/webchat/delete`,
            method: 'post',
        })
        return response.data
    },

    async deleteWhatsappChat(conversationId: string) {
        const response = await ApiService.fetchData<{
            ok: boolean
            conversationId: string
            deleted: boolean
        }>({
            url: `/conversations/${conversationId}/whatsapp/delete`,
            method: 'post',
        })
        return response.data
    },

    async downloadWhatsappMessageMedia(
        conversationId: string,
        messageId: string,
        attachmentIndex: number,
    ) {
        return ApiService.fetchData<Blob>({
            url: `/conversations/${conversationId}/messages/${messageId}/whatsapp/media/${attachmentIndex}`,
            method: 'get',
            responseType: 'blob',
        })
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

    async fetchConversationDebug(id: string) {
        const response = await ApiService.fetchData<ConversationDebugSnapshot>({
            url: `/conversations/${id}/debug`,
            method: 'get',
        })
        return response.data
    },

    async runConversationDebug(id: string, data: ConversationDebugRunInput) {
        const response = await ApiService.fetchData<ConversationDebugSnapshot>({
            url: `/conversations/${id}/debug`,
            method: 'post',
            data,
        })
        return response.data
    },

    async createConversationDebug(data: ConversationDebugRunInput) {
        const response = await ApiService.fetchData<ConversationDebugSnapshot>({
            url: '/conversations/new/debug',
            method: 'post',
            data,
        })
        return response.data
    },

    async deleteConversationDebug(id: string) {
        const response = await ApiService.fetchData<{
            ok: boolean
            deleted: boolean
            conversationId: string
            channel: string
        }>({
            url: `/conversations/${id}/debug`,
            method: 'delete',
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

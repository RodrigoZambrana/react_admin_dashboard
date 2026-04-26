import ApiService from './ApiService'

const chatPlatformBaseUrl = (
    import.meta.env.VITE_AI_PLATFORM_URL ||
    'http://localhost:4110'
).replace(/\/$/, '')

const chatPlatformUrl = (path: string) =>
    `${chatPlatformBaseUrl}${path.startsWith('/') ? path : `/${path}`}`

const chatPlatformAdminConversationsUrl = (path = '') =>
    chatPlatformUrl(`/admin/conversations${path}`)

const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null
    }

    return value as Record<string, unknown>
}

const asString = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : null

const asBoolean = (value: unknown) => value === true

const asNumber = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : null

const createEmptyAiState = () => ({
    needsHuman: false,
    grounded: false,
    fallbackReason: null as string | null,
    sourceCount: 0,
    updatedAt: null as string | null,
    memory: null,
    audit: {
        role: null as string | null,
        intentKey: null as string | null,
        intentConfidence: null as number | null,
        intentSource: null as string | null,
        actionKey: null as string | null,
        stage: null as string | null,
        stageHistory: [] as string[],
        decisionPath: [] as string[],
        blockedTools: [] as string[],
        executedTools: [] as string[],
        toolCalls: [] as Array<{
            name: string | null
            status: string | null
            target: string | null
        }>,
        referencedMessages: [] as Array<{
            messageId: string | null
            createdAt: string | null
            preview: string | null
        }>,
        messageElementsUsed: [] as string[],
        messageElements: [] as Array<{
            kind: string | null
            source: string | null
            label: string | null
            preview: string | null
        }>,
        messageContextOrigin: [] as string[],
        turnInterpretation: null,
        detail: null as string | null,
        input: null as string | null,
        grounded: false,
        needsHuman: false,
        fallbackReason: null as string | null,
        fallbackActivated: false,
        taskChanged: false,
        createdAt: null as string | null,
    },
    sources: [] as Array<{
        id: string | null
        title: string | null
        scope: string | null
        sourceType: string | null
        score: number | null
    }>,
})

const createEmptyAiAudit = () => ({
    total: 0,
    search: 0,
    state: 0,
    parser: 0,
    crud: 0,
    latestToolName: null as string | null,
    latestStatus: null as string | null,
    updatedAt: null as string | null,
})

const normalizeChatPlatformConversation = (rawInput: unknown) => {
    const raw = asRecord(rawInput)
    if (!raw) {
        return null
    }

    const participant = asRecord(raw.participant)
    const latestMessage = asRecord(raw.latestMessage)
    const channelState = asRecord(raw.channelState)
    const operational = asRecord(raw.operational)
    const queue = asRecord(raw.queue)
    const inboxAccount = asRecord(raw.inboxAccount)
    const aiState = asRecord(raw.aiState)
    const aiAudit = asRecord(raw.aiAudit)
    const readState = asRecord(raw.readState)

    const displayName =
        asString(participant?.displayName) ||
        asString(raw.subject) ||
        asString(raw.externalUserId) ||
        'Conversación'

    const customer = {
        id: 0,
        name: displayName,
        email: asString(participant?.email),
        phoneNumber: null,
    }

    const inboxSummary = inboxAccount
        ? {
              id: asString(inboxAccount.id) ?? asString(raw.channel) ?? raw.id,
              displayName: asString(inboxAccount.displayName),
              address: asString(inboxAccount.address),
              channel: asString(inboxAccount.channel) ?? asString(raw.channel) ?? 'webchat',
              transport: asString(inboxAccount.transport),
          }
        : null

    const queueSummary = queue
        ? {
              id: asString(queue.id) ?? asString(queue.slug) ?? raw.id,
              slug: asString(queue.slug) ?? asString(queue.id) ?? 'default',
              name: asString(queue.name) ?? asString(queue.slug) ?? 'General',
              priority: asNumber(queue.priority) ?? 0,
              slaTargetMinutes: asNumber(queue.slaTargetMinutes) ?? 0,
          }
        : null

    const channelStateSummary = {
        transport: asString(channelState?.transport),
        archived: asBoolean(channelState?.archived),
        read: asBoolean(channelState?.read),
        pinned: asBoolean(channelState?.pinned),
        muted: asBoolean(channelState?.muted),
        mutePreset: asString(channelState?.mutePreset),
        muteDurationMs: asNumber(channelState?.muteDurationMs),
        mutedUntil: asString(channelState?.mutedUntil),
        deleted: asBoolean(channelState?.deleted),
        threadId: asString(channelState?.threadId),
        updatedAt: asString(channelState?.updatedAt),
        updatedByUserId: asNumber(channelState?.updatedByUserId),
    }

    const readStateSummary = {
        lastReadAt: asString(readState?.lastReadAt),
        unreadCount: asBoolean(channelState?.read) ? 0 : 1,
        isRead: asBoolean(channelState?.read),
        manualUnread: !asBoolean(channelState?.read),
    }

    const summary = {
        id: asString(raw.id) ?? raw.id,
        tenantKey: asString(raw.tenantKey) ?? asString(raw.tenantId) ?? 'demo-tenant',
        scope: asString(raw.scope) ?? 'customer_public',
        role: asString(raw.role) ?? 'customer_public',
        channel: asString(raw.channel) ?? 'webchat',
        status: asString(raw.status) ?? 'open',
        controlMode: asString(raw.controlMode) ?? 'ai',
        needsHuman: asBoolean(raw.needsHuman),
        subject: asString(raw.subject) ?? displayName,
        externalUserId:
            asString(raw.externalUserId) ||
            asString(participant?.guestId) ||
            asString(participant?.userId),
        externalThreadId: asString(raw.externalThreadId) ?? asString(participant?.threadId),
        externalChannelRef:
            asString(raw.externalChannelRef) ?? asString(participant?.inboxAddress),
        isPinned: asBoolean(raw.isPinned) || asBoolean(channelState?.pinned),
        pinnedAt: asString(raw.pinnedAt) ?? asString(channelState?.pinnedAt),
        lastMessageAt: asString(raw.lastMessageAt),
        lastInboundAt: asString(raw.lastInboundAt),
        lastOutboundAt: asString(raw.lastOutboundAt),
        createdAt: asString(raw.createdAt) ?? new Date().toISOString(),
        updatedAt: asString(raw.updatedAt) ?? asString(raw.createdAt) ?? new Date().toISOString(),
        customer,
        assignedToUser: null,
        inboxAccount: inboxSummary,
        channelState: channelStateSummary,
        queue: queueSummary,
        operational: {
            needsAssignment: asBoolean(operational?.needsAssignment),
            isSlaBreached: asBoolean(operational?.isSlaBreached),
            slaAgeMinutes: asNumber(operational?.slaAgeMinutes),
            slaTargetMinutes: asNumber(operational?.slaTargetMinutes),
        },
        aiState: aiState
            ? {
                  needsHuman: asBoolean(aiState.needsHuman),
                  grounded: asBoolean(aiState.grounded),
                  fallbackReason: asString(aiState.fallbackReason),
                  sourceCount: asNumber(aiState.sourceCount) ?? 0,
                  updatedAt: asString(aiState.updatedAt),
                  memory: asRecord(aiState.memory) as ConversationSummary['aiState']['memory'],
                  audit: asRecord(aiState.audit) as ConversationSummary['aiState']['audit'],
                  sources: Array.isArray(aiState.sources)
                      ? (aiState.sources as ConversationSummary['aiState']['sources'])
                      : [],
              }
            : createEmptyAiState(),
        aiAudit: aiAudit
            ? {
                  total: asNumber(aiAudit.total) ?? 0,
                  search: asNumber(aiAudit.search) ?? 0,
                  state: asNumber(aiAudit.state) ?? 0,
                  parser: asNumber(aiAudit.parser) ?? 0,
                  crud: asNumber(aiAudit.crud) ?? 0,
                  latestToolName: asString(aiAudit.latestToolName),
                  latestStatus: asString(aiAudit.latestStatus),
                  updatedAt: asString(aiAudit.updatedAt),
              }
            : createEmptyAiAudit(),
        readState: readStateSummary,
        participants: participant
            ? [
                  {
                      id: asString(participant.threadId) ?? asString(raw.id) ?? 'participant',
                      role: 'customer',
                      displayName,
                      externalUserId:
                          asString(participant.guestId) ||
                          asString(participant.userId) ||
                          asString(raw.externalUserId),
                      customer: {
                          id: 0,
                          name: displayName,
                          email: asString(participant.email),
                      },
                      user: null,
                  },
              ]
            : [],
        latestMessage: latestMessage
            ? {
                  id: asString(latestMessage.id) ?? 'latest-message',
                  authorType: asString(latestMessage.authorType) ?? 'agent',
                  authorUser: null,
                  authorLabel: asString(latestMessage.authorLabel),
                  kind: asString(latestMessage.kind) ?? 'text',
                  body: asString(latestMessage.body),
                  preview: asString(latestMessage.preview) ?? asString(latestMessage.body),
                  previewKind: asString(latestMessage.previewKind) ?? 'text',
                  createdAt:
                      asString(latestMessage.createdAt) ?? asString(raw.updatedAt) ?? new Date().toISOString(),
                  metadata: asRecord(latestMessage.metadata),
              }
            : null,
        participant: participant
            ? {
                  displayName,
                  guestId: asString(participant.guestId),
                  userId: asString(participant.userId),
                  email: asString(participant.email),
                  threadId: asString(participant.threadId),
                  inboxAccountId: asString(participant.inboxAccountId),
                  inboxAddress: asString(participant.inboxAddress),
                  queueSlug: asString(participant.queueSlug),
                  locale: asString(participant.locale),
                  currency: asString(participant.currency),
                  page: asString(participant.page),
              }
            : null,
        latestTimestamp: asString(raw.latestTimestamp) ?? asString(raw.lastMessageAt) ?? asString(raw.updatedAt),
        actionState: channelStateSummary,
    }

    return summary
}

const normalizeAiPlatformDetail = (rawInput: unknown): ConversationDetail | null => {
    const summary = normalizeChatPlatformConversation(rawInput)
    const raw = asRecord(rawInput)

    if (!summary || !raw) {
        return null
    }

    return {
        ...summary,
        aiSuggestions: asRecord(raw.aiSuggestions)
            ? (raw.aiSuggestions as ConversationDetail['aiSuggestions'])
            : {
                  conversationId: summary.id,
                  targetMessageId: null,
                  items: [],
              },
        messages: Array.isArray(raw.messages)
            ? (raw.messages as Array<Record<string, unknown>>).map((message) => ({
                  id: asString(message.id) ?? 'message',
                  authorType: asString(message.authorType) ?? 'agent',
                  authorKind: asString(message.authorKind),
                  authorLabel: asString(message.authorLabel),
                  kind: asString(message.kind) ?? 'text',
                  messageKind: asString(message.messageKind),
                  body: asString(message.body),
                  normalizedText: asString(message.normalizedText),
                  payload: asRecord(message.payload),
                  metadata: asRecord(message.metadata),
                  sentAt: asString(message.sentAt),
                  receivedAt: asString(message.receivedAt),
                  createdAt:
                      asString(message.createdAt) ?? asString(message.sentAt) ?? asString(message.receivedAt) ?? new Date().toISOString(),
                  queue: asRecord(message.queue)
                      ? {
                            id: asString((message.queue as Record<string, unknown>).id) ?? 'queue',
                            slug: asString((message.queue as Record<string, unknown>).slug) ?? 'queue',
                            name: asString((message.queue as Record<string, unknown>).name) ?? 'Queue',
                        }
                      : null,
                  transportEvents: Array.isArray(message.transportEvents)
                      ? (message.transportEvents as Array<Record<string, unknown>>).map((event) => ({
                            id: asString(event.id) ?? 'event',
                            type: asString(event.type) ?? 'event',
                            payload: asRecord(event.payload),
                            occurredAt:
                                asString(event.occurredAt) ?? asString(message.createdAt) ?? new Date().toISOString(),
                        }))
                      : [],
              }))
            : [],
        handoffEvents: Array.isArray(raw.handoffEvents)
            ? (raw.handoffEvents as Array<Record<string, unknown>>).map((event) => ({
                  id: asString(event.id) ?? 'event',
                  type: asString(event.type) ?? 'event',
                  previousMode: asString(event.previousMode),
                  nextMode: asString(event.nextMode),
                  notes: asString(event.notes),
                  createdAt: asString(event.createdAt) ?? new Date().toISOString(),
                  actorUser: asRecord(event.actorUser)
                      ? {
                            id: asNumber((event.actorUser as Record<string, unknown>).id) ?? 0,
                            name: asString((event.actorUser as Record<string, unknown>).name),
                            email: asString((event.actorUser as Record<string, unknown>).email) ?? '',
                        }
                      : null,
              }))
            : [],
        toolCalls: Array.isArray(raw.toolCalls)
            ? (raw.toolCalls as Array<Record<string, unknown>>).map((toolCall) => ({
                  id: asString(toolCall.id) ?? 'tool-call',
                  messageId: asString(toolCall.messageId),
                  toolName: asString(toolCall.toolName) ?? 'tool',
                  status: asString(toolCall.status) ?? 'ok',
                  validatedPayload: asRecord(toolCall.validatedPayload),
                  resultPayload:
                      asRecord(toolCall.resultPayload) || asString(toolCall.resultPayload),
                  errorCode: asString(toolCall.errorCode),
                  errorMessage: asString(toolCall.errorMessage),
                  createdAt: asString(toolCall.createdAt) ?? new Date().toISOString(),
                  updatedAt: asString(toolCall.updatedAt) ?? asString(toolCall.createdAt) ?? new Date().toISOString(),
              }))
            : [],
    }
}

const normalizeAiPlatformList = (
    response: { items?: unknown; total?: unknown } | null | undefined,
): ConversationSummary[] => {
    if (!response || !Array.isArray(response.items)) {
        return []
    }

    return response.items
        .map((item) => normalizeChatPlatformConversation(item))
        .filter((item): item is ConversationSummary => Boolean(item))
}

const applyConversationFilters = (
    items: ConversationSummary[],
    params?: Record<string, unknown>,
) => {
    const search =
        typeof params?.search === 'string' ? params.search.trim().toLowerCase() : ''
    const scope =
        typeof params?.scope === 'string' ? params.scope.trim() : ''
    const channel =
        typeof params?.channel === 'string' ? params.channel.trim() : ''
    const status =
        typeof params?.status === 'string' ? params.status.trim() : ''
    const inboxAccountId =
        typeof params?.inboxAccountId === 'string'
            ? params.inboxAccountId.trim()
            : ''
    const queueSlug =
        typeof params?.queueSlug === 'string' ? params.queueSlug.trim() : ''
    const assignedUserId =
        typeof params?.assignedUserId === 'string'
            ? params.assignedUserId.trim()
            : ''
    const assignedToMe = params?.assignedToMe === true || params?.assignedToMe === 'true'

    return items.filter((conversation) => {
        if (scope && scope !== 'all' && conversation.scope !== scope) {
            return false
        }
        if (channel && channel !== 'all' && conversation.channel !== channel) {
            return false
        }
        if (status && status !== 'all' && conversation.status !== status) {
            return false
        }
        if (
            inboxAccountId &&
            inboxAccountId !== 'all' &&
            conversation.inboxAccount?.id !== inboxAccountId &&
            !(inboxAccountId === 'virtual:webchat' && conversation.channel === 'webchat' && !conversation.inboxAccount)
        ) {
            return false
        }
        if (
            queueSlug &&
            queueSlug !== 'all' &&
            conversation.queue?.slug !== queueSlug
        ) {
            return false
        }
        if (
            assignedUserId &&
            assignedUserId !== 'all' &&
            String(conversation.assignedToUser?.id ?? '') !== assignedUserId
        ) {
            return false
        }
        if (assignedToMe && !conversation.assignedToUser) {
            return false
        }

        if (!search) {
            return true
        }

        const haystack = [
            conversation.subject,
            conversation.externalUserId,
            conversation.externalThreadId,
            conversation.customer?.name,
            conversation.customer?.email,
            conversation.inboxAccount?.displayName,
            conversation.inboxAccount?.address,
            conversation.latestMessage?.body,
            conversation.latestMessage?.preview,
        ]
            .filter(Boolean)
            .map((value) => String(value).toLowerCase())

        return haystack.some((value) => value.includes(search))
    })
}

const listChatPlatformConversations = async (limit = 500) => {
    const response = await ApiService.fetchData<{
        items: unknown[]
        total?: number
    }>({
        url: chatPlatformAdminConversationsUrl(),
        method: 'get',
        params: {
            limit,
            includeArchived: true,
            includeDeleted: true,
        },
    })

    return normalizeAiPlatformList(response.data)
}

const fetchChatPlatformConversationAction = async (
    url: string,
    data?: Record<string, unknown>,
) => {
    const response = await ApiService.fetchData<ConversationDetail>({
        url: chatPlatformUrl(url),
        method: 'post',
        data,
    })
    return response.data
}

const fetchChatPlatformDeleteAction = async (
    url: string,
    data?: Record<string, unknown>,
) => {
    const response = await ApiService.fetchData<{
        ok: boolean
        conversationId: string
        deleted: boolean
    }>({
        url: chatPlatformUrl(url),
        method: 'post',
        data,
    })
    return response.data
}

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
        const page =
            typeof params?.page === 'number' && Number.isFinite(params.page)
                ? Math.max(1, Math.trunc(params.page))
                : typeof params?.page === 'string' && Number.isFinite(Number(params.page))
                  ? Math.max(1, Math.trunc(Number(params.page)))
                  : 1
        const pageSize =
            typeof params?.pageSize === 'number' && Number.isFinite(params.pageSize)
                ? Math.min(Math.max(1, Math.trunc(params.pageSize)), 100)
                : typeof params?.pageSize === 'string' &&
                    Number.isFinite(Number(params.pageSize))
                  ? Math.min(Math.max(1, Math.trunc(Number(params.pageSize))), 100)
                  : 20

        const conversations = await listChatPlatformConversations(
            Math.max(200, page * pageSize),
        )
        const filtered = applyConversationFilters(conversations, params)
        const start = (page - 1) * pageSize
        const items = filtered.slice(start, start + pageSize)

        return {
            items,
            total: filtered.length,
            page,
            pageSize,
            filters: {
                scope:
                    typeof params?.scope === 'string'
                        ? params.scope
                        : null,
                channel:
                    typeof params?.channel === 'string'
                        ? params.channel
                        : null,
                controlMode:
                    typeof params?.controlMode === 'string'
                        ? params.controlMode
                        : null,
                status:
                    typeof params?.status === 'string'
                        ? params.status
                        : null,
                assignedToMe: params?.assignedToMe === true,
                assignedUserId:
                    typeof params?.assignedUserId === 'string'
                        ? params.assignedUserId
                        : null,
                inboxAccountId:
                    typeof params?.inboxAccountId === 'string'
                        ? params.inboxAccountId
                        : null,
                queueSlug:
                    typeof params?.queueSlug === 'string'
                        ? params.queueSlug
                        : null,
                search:
                    typeof params?.search === 'string'
                        ? params.search
                        : null,
            },
        } satisfies ConversationListResponse
    },

    async fetchConversation(id: string) {
        const response = await ApiService.fetchData<unknown>({
            url: chatPlatformAdminConversationsUrl(`/${id}`),
            method: 'get',
        })
        const normalized = normalizeAiPlatformDetail(response.data)
        if (!normalized) {
            throw new Error('conversation.notFound')
        }
        return normalized
    },

    async fetchInboxes() {
        const conversations = await listChatPlatformConversations(500)
        const inboxById = new Map<string, InboxSummary>()

        for (const conversation of conversations) {
            const inbox = conversation.inboxAccount
            if (!inbox?.id) {
                continue
            }
            if (!inboxById.has(inbox.id)) {
                inboxById.set(inbox.id, {
                    id: inbox.id,
                    channel: inbox.channel,
                    displayName: inbox.displayName,
                    address: inbox.address,
                    active: true,
                    updatedAt: conversation.updatedAt,
                    scope: conversation.scope,
                })
            }
        }

        return Array.from(inboxById.values()).sort((left, right) =>
            left.displayName && right.displayName
                ? left.displayName.localeCompare(right.displayName)
                : left.updatedAt.localeCompare(right.updatedAt),
        )
    },

    async fetchQueues() {
        const conversations = await listChatPlatformConversations(500)
        const queueBySlug = new Map<string, ConversationQueueSummary>()

        for (const conversation of conversations) {
            const queue = conversation.queue
            if (!queue?.slug) {
                continue
            }
            if (!queueBySlug.has(queue.slug)) {
                queueBySlug.set(queue.slug, {
                    id: queue.id,
                    slug: queue.slug,
                    name: queue.name,
                    description: null,
                    isActive: true,
                    priority: queue.priority,
                    assignmentMode: 'round_robin',
                    maxAssignedConversations: null,
                    operatorCount: 0,
                    conversationCount: 0,
                    waitingCustomerCount: 0,
                    unassignedCount: 0,
                    breachedSlaCount: 0,
                    oldestInboundAt: null,
                    slaTargetMinutes: queue.slaTargetMinutes,
                    assignedOpenCount: 0,
                    configuredCapacity: null,
                    availableCapacity: null,
                    primaryOperators: [],
                })
            }
        }

        return Array.from(queueBySlug.values()).sort(
            (left, right) => left.priority - right.priority,
        )
    },

    async fetchContacts(params?: { search?: string; limit?: number }) {
        const limit =
            typeof params?.limit === 'number' && Number.isFinite(params.limit)
                ? Math.min(Math.max(1, Math.trunc(params.limit)), 100)
                : 50
        const search = params?.search?.trim().toLowerCase() ?? ''
        const conversations = await listChatPlatformConversations(500)
        const contacts = conversations.flatMap((conversation) => {
            const contactKey = conversation.externalUserId || conversation.id
            const label =
                conversation.customer?.name ||
                conversation.participants?.[0]?.displayName ||
                conversation.subject ||
                contactKey
            const email = conversation.customer?.email ?? null
            const phoneNumber = conversation.customer?.phoneNumber ?? null
            const channel = conversation.channel

            return [
                {
                    key: contactKey,
                    kind: 'customer' as const,
                    customerId: conversation.customer?.id ?? undefined,
                    label,
                    description: conversation.latestMessage?.preview ?? null,
                    email,
                    phoneNumber,
                    channel,
                    conversationId: conversation.id,
                    hasDeliveryChannel: true,
                    updatedAt: conversation.updatedAt,
                },
            ]
        })

        const filtered = search
            ? contacts.filter((contact) =>
                  [
                      contact.label,
                      contact.description,
                      contact.email,
                      contact.phoneNumber,
                      contact.channel,
                  ]
                      .filter(Boolean)
                      .some((value) =>
                          String(value).toLowerCase().includes(search),
                      ),
              )
            : contacts

        return {
            items: filtered.slice(0, limit),
        } satisfies ConversationContactsResponse
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
        const data = await fetchChatPlatformConversationAction(
            `/admin/conversations/${conversationId}/archive`,
            { archived },
        )
        return {
            ok: true,
            conversationId: data.id,
            archived: Boolean(data.channelState?.archived),
        }
    },

    async toggleWebchatChatArchive(
        conversationId: string,
        archived: boolean,
    ) {
        const data = await fetchChatPlatformConversationAction(
            `/admin/conversations/${conversationId}/archive`,
            { archived },
        )
        return {
            ok: true,
            conversationId: data.id,
            archived: Boolean(data.channelState?.archived),
        }
    },

    async toggleWhatsappChatReadState(
        conversationId: string,
        read: boolean,
    ) {
        const data = await fetchChatPlatformConversationAction(
            `/admin/conversations/${conversationId}/${read ? 'read' : 'unread'}`,
        )
        return {
            ok: true,
            conversationId: data.id,
            read: Boolean(data.channelState?.read),
        }
    },

    async toggleWhatsappChatPinState(
        conversationId: string,
        pinned: boolean,
    ) {
        const data = await fetchChatPlatformConversationAction(
            `/admin/conversations/${conversationId}/${pinned ? 'pin' : 'unpin'}`,
        )
        return {
            ok: true,
            conversationId: data.id,
            pinned: Boolean(data.channelState?.pinned),
        }
    },

    async setWhatsappChatMuteState(
        conversationId: string,
        preset: 'off' | '8h' | '7d',
    ) {
        const data = await fetchChatPlatformConversationAction(
            `/admin/conversations/${conversationId}/mute-state`,
            { preset },
        )
        return {
            ok: true,
            conversationId: data.id,
            muted: Boolean(data.channelState?.muted),
            mutePreset: data.channelState?.mutePreset ?? null,
            muteDurationMs: data.channelState?.muteDurationMs ?? null,
            mutedUntil: data.channelState?.mutedUntil ?? null,
        }
    },

    async setWebchatChatMuteState(
        conversationId: string,
        preset: 'off' | '8h' | '7d',
    ) {
        const data = await fetchChatPlatformConversationAction(
            `/admin/conversations/${conversationId}/mute-state`,
            { preset },
        )
        return {
            ok: true,
            conversationId: data.id,
            muted: Boolean(data.channelState?.muted),
            mutePreset: data.channelState?.mutePreset ?? null,
            muteDurationMs: data.channelState?.muteDurationMs ?? null,
            mutedUntil: data.channelState?.mutedUntil ?? null,
        }
    },

    async deleteWebchatChat(conversationId: string) {
        return fetchChatPlatformDeleteAction(
            `/admin/conversations/${conversationId}/delete`,
        )
    },

    async deleteWhatsappChat(conversationId: string) {
        return fetchChatPlatformDeleteAction(
            `/admin/conversations/${conversationId}/delete`,
        )
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
        return fetchChatPlatformConversationAction(
            `/admin/conversations/${id}/read`,
        )
    },

    async markConversationUnread(id: string) {
        return fetchChatPlatformConversationAction(
            `/admin/conversations/${id}/unread`,
        )
    },

    async pinConversation(id: string) {
        return fetchChatPlatformConversationAction(
            `/admin/conversations/${id}/pin`,
        )
    },

    async unpinConversation(id: string) {
        return fetchChatPlatformConversationAction(
            `/admin/conversations/${id}/unpin`,
        )
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

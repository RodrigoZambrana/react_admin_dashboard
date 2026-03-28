import ApiService from './ApiService'

export type AiKnowledgeOverview = {
    tenantKey: string
    documents: Array<{
        status: string
        sourceType: string
        scope: string
        count: number
    }>
    candidates: Array<{
        status: string
        scope: string
        count: number
    }>
    rawEvents: Array<{
        status: string
        scope: string
        count: number
    }>
    ingestionRuns: Array<{
        status: string
        count: number
    }>
    feedback: {
        used: number
        edited: number
        discarded: number
        total: number
        applied: number
        adoptionRate: number
        discardRate: number
    }
}

export type AiKnowledgeDocument = {
    id: string
    tenantKey: string
    scope: string
    sourceType: string
    status: string
    originCategory: string
    contentType: string
    hasEmbedding: boolean
    sourceKey: string
    title: string
    summary: string | null
    content: string
    sourceFile: {
        name: string
        mimeType: string
        size: number
        downloadUrl: string
    } | null
    tags: string[]
    piiRiskLevel: string
    metadata: Record<string, unknown> | null
    approvedAt: string | null
    embedding: {
        provider: string
        model: string
        dimensions: number
        indexedAt: string
    } | null
    createdAt: string
    updatedAt: string
}

export type AiKnowledgeCandidate = {
    id: string
    tenantKey: string
    scope: string
    status: string
    sourceType: string
    originCategory: string
    contentType: string
    channel: string | null
    hasFeedback: boolean
    title: string
    summary: string | null
    excerpt: string
    redactedExcerpt: string | null
    detectedIntent: string | null
    problem: string | null
    contextSummary: string | null
    suggestedResponse: string | null
    approvedResponse: string | null
    confidence: number | null
    dedupeHash: string | null
    clusterKey: string | null
    version: number
    piiDetected: boolean
    metadata: Record<string, unknown> | null
    observation: {
        id: string
        status: string
        channel: string
        sourceAuthorType: string
        userMessage: string
        operatorReply: string | null
        aiReply: string | null
        createdAt: string
        updatedAt: string
    } | null
    conversation: {
        id: string
        subject: string | null
        channel: string
    } | null
    feedback: {
        used: number
        edited: number
        discarded: number
        total: number
        applied: number
        adoptionRate: number
        discardRate: number
    }
    createdAt: string
    updatedAt: string
}

export type AiKnowledgeRawEvent = {
    id: string
    tenantKey: string
    scope: string
    channel: string
    sourceAuthorType: string
    status: string
    userMessage: string
    normalizedMessage: string
    redactedMessage: string | null
    operatorReply: string | null
    aiReply: string | null
    detectedIntent: string | null
    problem: string | null
    contextSummary: string | null
    suggestedResponse: string | null
    confidence: number | null
    relevanceScore: number | null
    dedupeHash: string | null
    clusterKey: string | null
    messageElements: Array<Record<string, unknown>> | null
    messageContextOrigin: Array<Record<string, unknown>> | null
    attachments: Array<Record<string, unknown>> | null
    metadata: Record<string, unknown> | null
    conversation: {
        id: string
        subject: string | null
        channel: string
        scope: string
    } | null
    message: {
        id: string
        authorType: string
        kind: string
        body: string | null
        createdAt: string
    } | null
    candidate: {
        id: string
        status: string
        confidence: number | null
        version: number
    } | null
    createdAt: string
    updatedAt: string
}

export type AiKnowledgeIngestionRun = {
    id: string
    tenantKey: string
    sourceType: string
    triggerType: string
    status: string
    processedCount: number
    createdCandidates: number
    skippedCount: number
    errorCount: number
    observationCount: number
    metadata: Record<string, unknown> | null
    createdByUser: {
        id: number
        name: string | null
        email: string
    } | null
    startedAt: string
    finishedAt: string | null
    createdAt: string
    updatedAt: string
}

export type AiKnowledgeFeedback = {
    id: string
    tenantKey: string
    outcome: string
    scope: string
    channel: string
    suggestedText: string | null
    finalText: string | null
    metadata: Record<string, unknown> | null
    candidate: {
        id: string
        title: string
        detectedIntent: string | null
        status: string
        sourceType: string
        version: number
    }
    conversation: {
        id: string
        subject: string | null
        channel: string
        scope: string
    }
    actorUser: {
        id: number
        name: string | null
        email: string
    } | null
    targetMessage: {
        id: string
        body: string | null
        createdAt: string
    } | null
    operatorMessage: {
        id: string
        body: string | null
        createdAt: string
    } | null
    createdAt: string
    updatedAt: string
}

export type AiKnowledgeConversationBundle = {
    id: string
    tenantKey: string
    scope: string
    status: string
    title: string
    summary: string | null
    detectedIntents: string[]
    eventCount: number
    candidateCount: number
    approvedCount: number
    pendingCount: number
    previewQuestion: string | null
    previewResponse: string | null
    metadata: Record<string, unknown> | null
    reviewedAt: string | null
    createdAt: string
    updatedAt: string
    conversation: {
        id: string
        subject: string | null
        channel: string
        scope: string
    } | null
    createdByUser: {
        id: number
        name: string | null
        email: string
    } | null
    reviewedByUser: {
        id: number
        name: string | null
        email: string
    } | null
    rawEvents?: AiKnowledgeRawEvent[]
    candidates?: AiKnowledgeCandidate[]
}

export type AiKnowledgeNegativeExample = {
    id: string
    tenantKey: string
    scope: string
    status: string
    sourceKind: string
    title: string
    summary: string | null
    detectedIntent: string | null
    channel: string | null
    disallowedText: string
    correctedText: string | null
    metadata: Record<string, unknown> | null
    reviewedAt: string | null
    createdAt: string
    updatedAt: string
    conversation: {
        id: string
        subject: string | null
        channel: string
        scope: string
    } | null
    candidate: {
        id: string
        title: string
        detectedIntent: string | null
        status: string
        sourceType: string
        version: number
    } | null
    feedback: {
        id: string
        outcome: string
        suggestedText: string | null
        finalText: string | null
        createdAt: string
    } | null
    createdByUser: {
        id: number
        name: string | null
        email: string
    } | null
    reviewedByUser: {
        id: number
        name: string | null
        email: string
    } | null
}

export type AiKnowledgeSnapshotSource = {
    id: string
    sourceKind: string
    sourceId: string
    sourceVersion: number | null
    sourceStatus: string | null
    role: string
    excerpt: string | null
    metadata: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
}

export type AiKnowledgeSnapshotEntry = {
    id: string
    entryType: string
    key: string
    title: string
    plainText: string
    normalizedIntent: string | null
    topicKey: string | null
    confidence: number | null
    priority: string | null
    appliesToChannels: string[]
    metadata: Record<string, unknown> | null
    createdAt: string
    updatedAt: string
    sources: AiKnowledgeSnapshotSource[]
}

export type AiKnowledgeSnapshot = {
    id: string
    tenantKey: string
    scope: string
    status: string
    version: number
    generationReason: string
    summaryText: string | null
    metrics: Record<string, unknown> | null
    coverageScore: number | null
    metadata: Record<string, unknown> | null
    generatedAt: string | null
    createdAt: string
    updatedAt: string
    generatedByUser: {
        id: number
        name: string | null
        email: string
    } | null
    entries: AiKnowledgeSnapshotEntry[]
}

export type AiKnowledgeSnapshotDiffItem = {
    key: string
    title: string
    entryType: string
    topicKey: string | null
    normalizedIntent: string | null
    plainText: string
    confidence: number | null
    appliesToChannels: string[]
    sources: Array<{
        sourceKind: string
        sourceId: string
        role: string
        sourceStatus: string | null
        excerpt: string | null
        metadata: Record<string, unknown> | null
    }>
}

export type AiKnowledgeSnapshotDiff = {
    snapshot: {
        id: string
        version: number
        generatedAt: string | null
        status: string
        scope: string
    }
    compareTo: {
        id: string
        version: number
        generatedAt: string | null
        status: string
        scope: string
    } | null
    summary: {
        added: number
        removed: number
        changed: number
        unchanged: number
    }
    added: AiKnowledgeSnapshotDiffItem[]
    removed: AiKnowledgeSnapshotDiffItem[]
    changed: Array<{
        key: string
        fields: string[]
        current: AiKnowledgeSnapshotDiffItem
        previous: AiKnowledgeSnapshotDiffItem
    }>
}

export type AiKnowledgeQuoteProfileOption = {
    value: string
    aliases: string[]
}

export type AiKnowledgeQuoteProfileAttribute = {
    key: string
    label: string
    required: boolean
    captureKind: 'measurements' | 'quantity' | 'taxonomy_tag' | 'enum'
    taxonomyTag: string | null
    options: AiKnowledgeQuoteProfileOption[]
    subjectPrefix: string | null
}

export type AiKnowledgeQuoteProfile = {
    key: string
    label: string
    appliesToTopicKeys: string[]
    appliesToTopicLabels: string[]
    familyLabel: string | null
    pricingStrategy:
        | 'handoff_only'
        | 'immediate_unit_price'
        | 'immediate_square_meter'
        | 'parametric_exact_or_handoff'
    closureMode: 'collect_then_handoff' | 'collect_then_price_or_handoff'
    measurementCarrierTerms: string[]
    attributes: AiKnowledgeQuoteProfileAttribute[]
    sourceDocumentIds: string[]
}

export type AiKnowledgeQuoteProfilesManageState = {
    tenantKey: string
    scope: 'customer_public' | 'admin_internal'
    document: {
        id: string
        title: string
        summary: string | null
        content: string
        tags: string[]
        status: string
        createdAt: string
        updatedAt: string
    } | null
    items: AiKnowledgeQuoteProfile[]
    catalogConsistency: {
        tenantKey: string
        updatedAt: string
        productCount: number
        profileCount: number
        immediateProfiles: number
        immediateProfilesMatched: number
        immediateProfilesNeedingReview: number
        items: Array<{
            profileKey: string
            label: string
            pricingStrategy: string
            status: 'matched' | 'review' | 'not_applicable'
            requiresImmediateCatalog: boolean
            catalogMatchCount: number
            matchedProducts: Array<{
                id: number
                name: string
                mode: string
                unitOfMeasure: string
                categoryName: string | null
            }>
        }>
    }
    updatedAt: string
}

export type AiKnowledgeListResponse<T> = {
    items: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
    hasMore: boolean
    orderBy: string
    orderDir: 'asc' | 'desc'
}

export type ListKnowledgeDocumentsParams = {
    tenantKey?: string
    scope?: 'customer_public' | 'admin_internal'
    sourceType?:
        | 'docs'
        | 'web_url'
        | 'backend_dataset'
        | 'admin_curated'
        | 'conversation_derived'
    status?: 'draft' | 'active' | 'archived'
    search?: string
    sourceFileOnly?: boolean
    originCategory?:
        | 'uploaded_document'
        | 'website_url'
        | 'manual_entry'
        | 'conversation_approved'
        | 'dataset_snapshot'
        | 'trusted_doc'
    contentType?:
        | 'document_file'
        | 'web_page'
        | 'plain_text'
        | 'conversation_response'
        | 'dataset_snapshot'
        | 'multimodal_extract'
    hasEmbedding?: boolean
    orderBy?: 'updatedAt' | 'createdAt' | 'title' | 'sourceType' | 'status' | 'approvedAt'
    orderDir?: 'asc' | 'desc'
    page?: number
    pageSize?: number
}

export type ListKnowledgeCandidatesParams = {
    tenantKey?: string
    scope?: 'customer_public' | 'admin_internal'
    status?: 'pending' | 'approved' | 'rejected'
    sourceType?: 'docs' | 'backend_dataset' | 'admin_curated' | 'conversation_derived'
    search?: string
    detectedIntent?: string
    channel?: 'webchat' | 'whatsapp' | 'email' | 'meta' | 'admin_chat'
    originCategory?:
        | 'conversation_suggested'
        | 'conversation_approved'
        | 'manual_candidate'
        | 'dataset_candidate'
    hasFeedback?: boolean
    orderBy?:
        | 'updatedAt'
        | 'createdAt'
        | 'status'
        | 'confidence'
        | 'detectedIntent'
        | 'feedbackApplied'
    orderDir?: 'asc' | 'desc'
    page?: number
    pageSize?: number
}

export type ListKnowledgeRawEventsParams = {
    tenantKey?: string
    status?: 'new' | 'processed' | 'discarded'
    conversationId?: string
    search?: string
    channel?: 'webchat' | 'whatsapp' | 'email' | 'meta' | 'admin_chat'
    sourceAuthorType?: 'customer' | 'operator' | 'agent' | 'system'
    detectedIntent?: string
    orderBy?:
        | 'updatedAt'
        | 'createdAt'
        | 'status'
        | 'channel'
        | 'confidence'
        | 'detectedIntent'
    orderDir?: 'asc' | 'desc'
    page?: number
    pageSize?: number
}

export type ListKnowledgeIngestionRunsParams = {
    tenantKey?: string
    status?: 'running' | 'completed' | 'failed'
    sourceType?:
        | 'docs'
        | 'backend_dataset'
        | 'admin_curated'
        | 'conversation_derived'
        | 'conversation_message'
        | 'dataset'
    createdByUserId?: number
    from?: string
    to?: string
    orderBy?:
        | 'startedAt'
        | 'finishedAt'
        | 'createdAt'
        | 'status'
        | 'processedCount'
        | 'createdCandidates'
        | 'errorCount'
    orderDir?: 'asc' | 'desc'
    page?: number
    pageSize?: number
}

export type CreateCuratedKnowledgePayload = {
    tenantKey?: string
    scope: 'customer_public' | 'admin_internal'
    title: string
    summary?: string
    content: string
    tags?: string[]
    metadata?: Record<string, unknown>
}

export type CreateKnowledgeUrlPayload = {
    tenantKey?: string
    scope: 'customer_public' | 'admin_internal'
    url: string
    title?: string
    summary?: string
    tags?: string[]
    refreshPolicy?: 'manual' | 'daily' | 'weekly' | 'on_demand'
    crawl?: boolean
    crawlMaxDepth?: number
    crawlMaxPages?: number
    crawlSameDomainOnly?: boolean
    crawlRespectRobots?: boolean
    crawlExclude?: string[]
    metadata?: Record<string, unknown>
}

export type UpdateKnowledgeDocumentPayload = {
    scope?: 'customer_public' | 'admin_internal'
    status?: 'draft' | 'active' | 'archived'
    title?: string
    summary?: string
    content?: string
    tags?: string[]
    metadata?: Record<string, unknown>
}

export type ReviewKnowledgeCandidatePayload = {
    action: 'approve' | 'reject'
    promoteToDocument?: boolean
    scope?: 'customer_public' | 'admin_internal'
    title?: string
    summary?: string
    content?: string
}

export type ListKnowledgeFeedbackParams = {
    tenantKey?: string
    scope?: 'customer_public' | 'admin_internal'
    outcome?: 'used' | 'edited' | 'discarded'
    channel?: 'webchat' | 'whatsapp' | 'email' | 'meta' | 'admin_chat'
    candidateId?: string
    conversationId?: string
    search?: string
    orderBy?: 'createdAt' | 'updatedAt' | 'outcome' | 'channel' | 'candidateTitle' | 'actorName'
    orderDir?: 'asc' | 'desc'
    page?: number
    pageSize?: number
}

export type ListKnowledgeConversationBundlesParams = {
    tenantKey?: string
    scope?: 'customer_public' | 'admin_internal'
    status?: 'pending' | 'approved' | 'rejected'
    channel?: 'webchat' | 'whatsapp' | 'email' | 'meta' | 'admin_chat'
    search?: string
    orderBy?:
        | 'updatedAt'
        | 'createdAt'
        | 'approvedCount'
        | 'pendingCount'
        | 'eventCount'
        | 'candidateCount'
    orderDir?: 'asc' | 'desc'
    page?: number
    pageSize?: number
}

export type ListKnowledgeNegativeExamplesParams = {
    tenantKey?: string
    scope?: 'customer_public' | 'admin_internal'
    status?: 'pending' | 'approved' | 'rejected'
    sourceKind?: 'rejected_candidate' | 'discarded_feedback' | 'manual'
    channel?: 'webchat' | 'whatsapp' | 'email' | 'meta' | 'admin_chat'
    search?: string
    detectedIntent?: string
    orderBy?: 'updatedAt' | 'createdAt' | 'status' | 'sourceKind' | 'detectedIntent'
    orderDir?: 'asc' | 'desc'
    page?: number
    pageSize?: number
}

export type GetKnowledgeSnapshotParams = {
    tenantKey?: string
    scope?: 'customer_public' | 'admin_internal'
}

export type GetKnowledgeQuoteProfilesManageParams = {
    tenantKey?: string
    scope?: 'customer_public' | 'admin_internal'
}

export type UpsertKnowledgeQuoteProfilesManagePayload = {
    documentId?: string
    tenantKey?: string
    scope: 'customer_public' | 'admin_internal'
    title?: string
    summary?: string
    tags?: string[]
    profiles: Array<{
        key?: string
        label: string
        appliesToTopicKeys?: string[]
        appliesToTopicLabels?: string[]
        familyLabel?: string | null
        pricingStrategy:
            | 'handoff_only'
            | 'immediate_unit_price'
            | 'immediate_square_meter'
            | 'parametric_exact_or_handoff'
        closureMode: 'collect_then_handoff' | 'collect_then_price_or_handoff'
        measurementCarrierTerms?: string[]
        attributes: Array<{
            key?: string
            label: string
            required?: boolean
            captureKind: 'measurements' | 'quantity' | 'taxonomy_tag' | 'enum'
            taxonomyTag?: string | null
            subjectPrefix?: string | null
            options?: Array<{
                value: string
                aliases?: string[]
            }>
        }>
    }>
}

const AiKnowledgeService = {
    async getOverview() {
        return ApiService.fetchData<AiKnowledgeOverview>({
            url: '/ai/knowledge/overview',
            method: 'get',
        })
    },

    async getLatestSnapshot(params?: GetKnowledgeSnapshotParams) {
        return ApiService.fetchData<AiKnowledgeSnapshot>({
            url: '/ai/knowledge/snapshots/latest',
            method: 'get',
            params,
        })
    },

    async getQuoteProfilesManage(params?: GetKnowledgeQuoteProfilesManageParams) {
        return ApiService.fetchData<AiKnowledgeQuoteProfilesManageState>({
            url: '/ai/knowledge/quote-profiles/manage',
            method: 'get',
            params,
        })
    },

    async upsertQuoteProfilesManage(data: UpsertKnowledgeQuoteProfilesManagePayload) {
        return ApiService.fetchData<AiKnowledgeQuoteProfilesManageState>({
            url: '/ai/knowledge/quote-profiles/manage',
            method: 'put',
            data,
        })
    },

    async syncQuoteProfilesManage(data?: GetKnowledgeQuoteProfilesManageParams) {
        return ApiService.fetchData<AiKnowledgeQuoteProfilesManageState>({
            url: '/ai/knowledge/quote-profiles/manage/sync',
            method: 'post',
            data,
        })
    },

    async getSnapshot(id: string) {
        return ApiService.fetchData<AiKnowledgeSnapshot>({
            url: `/ai/knowledge/snapshots/${id}`,
            method: 'get',
        })
    },

    async getSnapshotPlainText(id: string) {
        return ApiService.fetchData<{
            id: string
            tenantKey: string
            scope: string
            version: number
            status: string
            generatedAt: string | null
            plainText: string
        }>({
            url: `/ai/knowledge/snapshots/${id}/plain-text`,
            method: 'get',
        })
    },

    async getSnapshotDiff(id: string, compareToId?: string) {
        return ApiService.fetchData<AiKnowledgeSnapshotDiff>({
            url: `/ai/knowledge/snapshots/${id}/diff`,
            method: 'get',
            params: {
                compareToId,
            },
        })
    },

    async listDocuments(params?: ListKnowledgeDocumentsParams) {
        return ApiService.fetchData<AiKnowledgeListResponse<AiKnowledgeDocument>>({
            url: '/ai/knowledge/documents',
            method: 'get',
            params: {
                ...params,
                sourceFileOnly:
                    params?.sourceFileOnly === undefined
                        ? undefined
                        : params.sourceFileOnly
                          ? 'true'
                          : 'false',
                hasEmbedding:
                    params?.hasEmbedding === undefined
                        ? undefined
                        : params.hasEmbedding
                          ? 'true'
                          : 'false',
            },
        })
    },

    async getDocument(id: string) {
        return ApiService.fetchData<AiKnowledgeDocument>({
            url: `/ai/knowledge/documents/${id}`,
            method: 'get',
        })
    },

    async listCandidates(params?: ListKnowledgeCandidatesParams) {
        return ApiService.fetchData<AiKnowledgeListResponse<AiKnowledgeCandidate>>({
            url: '/ai/knowledge/candidates',
            method: 'get',
            params: {
                ...params,
                hasFeedback:
                    params?.hasFeedback === undefined
                        ? undefined
                        : params.hasFeedback
                          ? 'true'
                          : 'false',
            },
        })
    },

    async getCandidate(id: string) {
        return ApiService.fetchData<AiKnowledgeCandidate>({
            url: `/ai/knowledge/candidates/${id}`,
            method: 'get',
        })
    },

    async listRawEvents(params?: ListKnowledgeRawEventsParams) {
        return ApiService.fetchData<AiKnowledgeListResponse<AiKnowledgeRawEvent>>({
            url: '/ai/knowledge/raw-events',
            method: 'get',
            params,
        })
    },

    async getRawEvent(id: string) {
        return ApiService.fetchData<AiKnowledgeRawEvent>({
            url: `/ai/knowledge/raw-events/${id}`,
            method: 'get',
        })
    },

    async listIngestionRuns(params?: ListKnowledgeIngestionRunsParams) {
        return ApiService.fetchData<AiKnowledgeListResponse<AiKnowledgeIngestionRun>>({
            url: '/ai/knowledge/ingestion-runs',
            method: 'get',
            params,
        })
    },

    async listFeedback(params?: ListKnowledgeFeedbackParams) {
        return ApiService.fetchData<AiKnowledgeListResponse<AiKnowledgeFeedback>>({
            url: '/ai/knowledge/feedback',
            method: 'get',
            params,
        })
    },

    async listConversationBundles(params?: ListKnowledgeConversationBundlesParams) {
        return ApiService.fetchData<AiKnowledgeListResponse<AiKnowledgeConversationBundle>>({
            url: '/ai/knowledge/conversation-bundles',
            method: 'get',
            params,
        })
    },

    async getConversationBundle(id: string) {
        return ApiService.fetchData<AiKnowledgeConversationBundle>({
            url: `/ai/knowledge/conversation-bundles/${id}`,
            method: 'get',
        })
    },

    async reviewConversationBundle(
        id: string,
        data: { action: 'approve' | 'reject'; summary?: string },
    ) {
        return ApiService.fetchData<AiKnowledgeConversationBundle>({
            url: `/ai/knowledge/conversation-bundles/${id}/review`,
            method: 'post',
            data,
        })
    },

    async listNegativeExamples(params?: ListKnowledgeNegativeExamplesParams) {
        return ApiService.fetchData<AiKnowledgeListResponse<AiKnowledgeNegativeExample>>({
            url: '/ai/knowledge/negative-examples',
            method: 'get',
            params,
        })
    },

    async getNegativeExample(id: string) {
        return ApiService.fetchData<AiKnowledgeNegativeExample>({
            url: `/ai/knowledge/negative-examples/${id}`,
            method: 'get',
        })
    },

    async reviewNegativeExample(
        id: string,
        data: {
            action: 'approve' | 'reject'
            title?: string
            summary?: string
            correctedText?: string
        },
    ) {
        return ApiService.fetchData<AiKnowledgeNegativeExample>({
            url: `/ai/knowledge/negative-examples/${id}/review`,
            method: 'post',
            data,
        })
    },

    async ingestDocs() {
        return ApiService.fetchData({
            url: '/ai/knowledge/ingest/docs',
            method: 'post',
            data: {},
        })
    },

    async ingestDatasets() {
        return ApiService.fetchData({
            url: '/ai/knowledge/ingest/datasets',
            method: 'post',
            data: {},
        })
    },

    async ingestConversations(limit = 100) {
        return ApiService.fetchData<{
            id: string
            tenantKey: string
            status: string
            processedCount: number
            createdCandidates: number
            skippedCount: number
            errorCount: number
        }>({
            url: '/ai/knowledge/ingest/conversations',
            method: 'post',
            data: {
                limit,
            },
        })
    },

    async indexDocuments() {
        return ApiService.fetchData<{
            tenantKey: string
            indexed: number
            documentIds: string[]
        }>({
            url: '/ai/knowledge/index',
            method: 'post',
            data: {},
        })
    },

    async createCurated(data: CreateCuratedKnowledgePayload) {
        return ApiService.fetchData<AiKnowledgeDocument>({
            url: '/ai/knowledge/curated',
            method: 'post',
            data,
        })
    },

    async updateDocument(id: string, data: UpdateKnowledgeDocumentPayload) {
        return ApiService.fetchData<AiKnowledgeDocument>({
            url: `/ai/knowledge/documents/${id}`,
            method: 'patch',
            data,
        })
    },

    async uploadDocument(data: FormData) {
        return ApiService.fetchData<AiKnowledgeDocument, FormData>({
            url: '/ai/knowledge/documents/upload',
            method: 'post',
            data,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
    },

    async createUrlDocument(data: CreateKnowledgeUrlPayload) {
        return ApiService.fetchData<AiKnowledgeDocument>({
            url: '/ai/knowledge/documents/url',
            method: 'post',
            data,
        })
    },

    async refreshUrlDocument(id: string) {
        return ApiService.fetchData<AiKnowledgeDocument>({
            url: `/ai/knowledge/documents/${id}/refresh`,
            method: 'post',
            data: {},
        })
    },

    async refreshDueUrlDocuments(data?: {
        tenantKey?: string
        scope?: 'customer_public' | 'admin_internal'
    }) {
        return ApiService.fetchData<{
            tenantKey: string
            requestedScope: string | null
            refreshedCount: number
            refreshedIds: string[]
        }>({
            url: '/ai/knowledge/documents/refresh-due',
            method: 'post',
            data: data ?? {},
        })
    },

    async deleteDocument(id: string) {
        return ApiService.fetchData<{ id: string; deleted: boolean }>({
            url: `/ai/knowledge/documents/${id}`,
            method: 'delete',
        })
    },

    async reviewCandidate(id: string, data: ReviewKnowledgeCandidatePayload) {
        return ApiService.fetchData<{
            candidate: AiKnowledgeCandidate
            promotedDocument?: AiKnowledgeDocument | null
        }>({
            url: `/ai/knowledge/candidates/${id}/review`,
            method: 'post',
            data,
        })
    },

    async createCandidateFromConversation(data: {
        conversationId: string
        messageId: string
        tenantKey?: string
        title?: string
        summary?: string
    }) {
        return ApiService.fetchData<{
            id: string | null
            status: string
            piiDetected: boolean
            rawEventId: string | null
        }>({
            url: '/ai/knowledge/candidates/from-conversation',
            method: 'post',
            data,
        })
    },
}

export default AiKnowledgeService

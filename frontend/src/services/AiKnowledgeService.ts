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
}

export type AiKnowledgeDocument = {
    id: string
    tenantKey: string
    scope: string
    sourceType: string
    status: string
    sourceKey: string
    title: string
    summary: string | null
    content: string
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
    title: string
    summary: string | null
    excerpt: string
    redactedExcerpt: string | null
    piiDetected: boolean
    metadata: Record<string, unknown> | null
    conversation: {
        id: string
        subject: string | null
        channel: string
    } | null
    createdAt: string
    updatedAt: string
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

export type ReviewKnowledgeCandidatePayload = {
    action: 'approve' | 'reject'
    promoteToDocument?: boolean
    scope?: 'customer_public' | 'admin_internal'
    title?: string
    summary?: string
    content?: string
}

const AiKnowledgeService = {
    async getOverview() {
        return ApiService.fetchData<AiKnowledgeOverview>({
            url: '/ai/knowledge/overview',
            method: 'get',
        })
    },

    async listDocuments() {
        return ApiService.fetchData<AiKnowledgeDocument[]>({
            url: '/ai/knowledge/documents',
            method: 'get',
        })
    },

    async listCandidates() {
        return ApiService.fetchData<AiKnowledgeCandidate[]>({
            url: '/ai/knowledge/candidates',
            method: 'get',
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
}

export default AiKnowledgeService

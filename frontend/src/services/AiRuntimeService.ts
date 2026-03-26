import ApiService from './ApiService'

export type AiRuntimeUsageSummary = {
    status: 'healthy' | 'near_limit' | 'exceeded' | 'unbounded'
    ratio: number | null
    nearLimit: boolean
    exceeded: boolean
    message: string
}

export type AiRuntimeConfigResponse = {
    enabled: boolean
    provider: 'mock' | 'openai' | 'ollama'
    model: string
    hasOpenAiApiKey: boolean
    openAiApiKeyMasked: string
    monthlySpendingLimitUsd: number | null
    currentUsageUsd: number | null
    warningThresholdPercent: number
    usageMessage: string | null
    adminInternalPrompt: string | null
    customerPublicPrompt: string | null
    usage: AiRuntimeUsageSummary
    source: 'environment' | 'database'
    updatedAt: string | null
}

export type AiActionCatalogEntry = {
    key: string
    label: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    path: string
    confirmationRequired: boolean
    scope: 'customer_public' | 'admin_internal'
    toolName?: string
    keywords?: string[]
    requiredFields?: string[]
    supportedFields?: string[]
    allowedValues?: string[]
    validationRules?: string[]
    confirmationPrompt?: string
}

export type UpdateAiRuntimeConfigPayload = {
    enabled: boolean
    provider: 'mock' | 'openai' | 'ollama'
    model: string
    openAiApiKey?: string
    monthlySpendingLimitUsd: number | null
    currentUsageUsd: number | null
    warningThresholdPercent: number
    usageMessage: string | null
    adminInternalPrompt: string | null
    customerPublicPrompt: string | null
}

export const apiGetAiRuntimeConfig = () => {
    return ApiService.fetchData<AiRuntimeConfigResponse>({
        url: '/ai/runtime-config',
        method: 'get',
    })
}

export const apiUpdateAiRuntimeConfig = (
    payload: UpdateAiRuntimeConfigPayload,
) => {
    return ApiService.fetchData<AiRuntimeConfigResponse, UpdateAiRuntimeConfigPayload>({
        url: '/ai/runtime-config',
        method: 'put',
        data: payload,
    })
}

export const apiGetAiActionsCatalog = () => {
    return ApiService.fetchData<AiActionCatalogEntry[]>({
        url: '/ai/actions/catalog',
        method: 'get',
    })
}

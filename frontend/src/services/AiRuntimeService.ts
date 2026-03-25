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
    usage: AiRuntimeUsageSummary
    source: 'environment' | 'database'
    updatedAt: string | null
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

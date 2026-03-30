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
    customerGreetingDefault: string | null
    customerGreetingMorning: string | null
    customerGreetingAfternoon: string | null
    customerGreetingConsultation: string | null
    customerGreetingHelp: string | null
    adminGreetingDefault: string | null
    customerGroundedRewriteEnabled?: boolean
    customerGroundedRewriteMaxChars?: number | null
    customerCapabilityProfile:
        | 'full_assistant'
        | 'ecommerce_content'
        | 'scheduling_content'
        | 'content_only'
        | 'custom'
    customerContentMode: 'enabled' | 'deterministic_only' | 'handoff_only'
    customerCommerceMode: 'enabled' | 'deterministic_only' | 'handoff_only'
    customerSchedulingMode: 'enabled' | 'deterministic_only' | 'handoff_only'
    customerWordingRegistry?: Record<
        string,
        | string
        | string[]
        | {
              messages: string | string[]
              goal?: string | null
              mustAskQuestion?: boolean
              maxChars?: number | null
              allowHybridRewrite?: boolean
          }
    > | null
    customerWordingRegistryJson?: string | null
    customerWordingOverrides?: Record<
        string,
        | string
        | string[]
        | {
              messages: string | string[]
              goal?: string | null
              mustAskQuestion?: boolean
              maxChars?: number | null
              allowHybridRewrite?: boolean
          }
    > | null
    customerWordingOverridesJson?: string | null
    customerHybridIntentRegistry?: Array<{
        id?: string
        intent: string
        confidence?: number
        priority?: number
        examples?: string[]
        includesAny?: string[]
        includesAll?: string[]
        regexAny?: string[]
        regexAll?: string[]
        decisionPath?: string[]
    }> | null
    customerHybridIntentRegistryJson?: string | null
    roleCatalog?: Array<{
        key: string
        type: 'customer' | 'admin'
        label: string
        memoryTurns: number
        allowedTools: string[]
        forbiddenIntents: string[]
        requiresConfirmation: string[]
        tone: string
        authRoles: string[]
        legacyScopes: string[]
    }>
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
    scope: 'customer_public' | 'customer_authenticated' | 'admin_internal'
    allowedRoles?: string[]
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
    customerGreetingDefault: string | null
    customerGreetingMorning: string | null
    customerGreetingAfternoon: string | null
    customerGreetingConsultation: string | null
    customerGreetingHelp: string | null
    adminGreetingDefault: string | null
    customerGroundedRewriteEnabled?: boolean
    customerGroundedRewriteMaxChars?: number | null
    customerCapabilityProfile:
        | 'full_assistant'
        | 'ecommerce_content'
        | 'scheduling_content'
        | 'content_only'
        | 'custom'
    customerContentMode: 'enabled' | 'deterministic_only' | 'handoff_only'
    customerCommerceMode: 'enabled' | 'deterministic_only' | 'handoff_only'
    customerSchedulingMode: 'enabled' | 'deterministic_only' | 'handoff_only'
    customerWordingOverridesJson?: string | null
    customerWordingRegistryJson?: string | null
    customerHybridIntentRegistryJson?: string | null
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

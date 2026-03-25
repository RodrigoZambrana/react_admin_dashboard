import { buildSystemPrompt } from './prompt/system-prompt.js'
import { createModelProvider } from './model/provider-factory.js'
import { createSearchProductsTool } from './tools/search-products.tool.js'

const needsProductSearch = (text) => {
  const normalized = text.toLowerCase()
  return [
    'producto',
    'cortina',
    'roller',
    'persiana',
    'mosquitero',
    'abertura',
    'precio',
    'catálogo',
  ].some((token) => normalized.includes(token))
}

export class AiAgentRuntime {
  constructor({ config, provider, memoryStore, backendClient }) {
    this.config = config
    this.activeConfig = config
    this.provider = provider
    this.memoryStore = memoryStore
    this.backendClient = backendClient
    this.runtimeConfigLoadedAt = 0
  }

  async refreshRuntimeConfig() {
    const now = Date.now()
    if (now - this.runtimeConfigLoadedAt < 30_000) {
      return this.activeConfig
    }

    try {
      const runtimeConfig = await this.backendClient.getRuntimeConfig()
      const nextConfig = {
        ...this.config,
        modelProvider: runtimeConfig.provider || this.config.modelProvider,
        modelName: runtimeConfig.model || this.config.modelName,
        openAiApiKey:
          runtimeConfig.openAiApiKey !== undefined
            ? runtimeConfig.openAiApiKey
            : this.config.openAiApiKey,
        enabled:
          runtimeConfig.enabled !== undefined
            ? runtimeConfig.enabled
            : true,
        monthlySpendingLimitUsd: runtimeConfig.monthlySpendingLimitUsd,
        currentUsageUsd: runtimeConfig.currentUsageUsd,
        warningThresholdPercent: runtimeConfig.warningThresholdPercent,
        usageMessage: runtimeConfig.usageMessage,
      }

      const currentSignature = `${this.activeConfig.modelProvider}:${this.activeConfig.modelName}:${Boolean(this.activeConfig.openAiApiKey)}`
      const nextSignature = `${nextConfig.modelProvider}:${nextConfig.modelName}:${Boolean(nextConfig.openAiApiKey)}`
      if (currentSignature !== nextSignature) {
        this.provider = createModelProvider(nextConfig)
      }
      this.activeConfig = nextConfig
    } catch (error) {
      console.warn('[ai-agent-service] Unable to refresh runtime config', error)
      this.activeConfig = {
        ...this.config,
        enabled: true,
      }
    }

    this.runtimeConfigLoadedAt = now
    return this.activeConfig
  }

  async respond(unifiedMessage) {
    const runtimeConfig = await this.refreshRuntimeConfig()
    if (runtimeConfig.enabled === false) {
      return {
        conversationId: unifiedMessage.conversationId || unifiedMessage.userId,
        scope: unifiedMessage.scope || 'customer_public',
        provider: this.provider.providerName,
        model: this.provider.modelName,
        text:
          runtimeConfig.usageMessage ||
          'El asistente está temporalmente deshabilitado. Un operador puede continuar la atención.',
        toolCalls: [],
      }
    }

    const conversationId = unifiedMessage.conversationId || unifiedMessage.userId
    const scope = unifiedMessage.scope || 'customer_public'
    const snapshot = await this.memoryStore.get(conversationId)
    const history = snapshot?.turns ?? []
    const tools = needsProductSearch(unifiedMessage.text)
      ? [createSearchProductsTool(this.backendClient)]
      : []

    const response = await this.provider.generate({
      scope,
      systemPrompt: buildSystemPrompt(scope),
      history,
      input: unifiedMessage.text,
      tools,
    })

    const now = new Date().toISOString()
    await this.memoryStore.appendTurn(
      conversationId,
      {
        role: 'customer',
        text: unifiedMessage.text,
        createdAt: now,
        metadata: {
          channel: unifiedMessage.channel,
        },
      },
      scope,
    )
    await this.memoryStore.appendTurn(
      conversationId,
      {
        role: 'agent',
        text: response.text,
        createdAt: new Date().toISOString(),
        metadata: {
          provider: this.provider.providerName,
          toolCalls: response.toolCalls ?? [],
        },
      },
      scope,
    )

    return {
      conversationId,
      scope,
      provider: this.provider.providerName,
      model: this.provider.modelName,
      text: response.text,
      toolCalls: response.toolCalls ?? [],
    }
  }
}

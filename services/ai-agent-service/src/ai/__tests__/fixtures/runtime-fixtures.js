import { AiAgentRuntime } from '../../agent.js'
import { InMemoryConversationStore } from '../../memory/in-memory-conversation-store.js'
import { recordProviderCall } from '../../model/provider-call-trace.js'

const CUSTOMER_ROLE_CATALOG = [
  {
    key: 'customer_public',
    type: 'customer',
    memoryTurns: 12,
    allowedTools: ['search_products'],
    forbiddenIntents: ['catalog.register_structured_items', 'orders.manage', 'catalog.manage'],
    requiresConfirmation: [],
    tone: 'helpful_public',
    legacyScopes: ['customer_public'],
  },
  {
    key: 'customer_authenticated',
    type: 'customer',
    memoryTurns: 12,
    allowedTools: ['search_products'],
    forbiddenIntents: ['catalog.register_structured_items', 'orders.manage', 'catalog.manage'],
    requiresConfirmation: [],
    tone: 'trusted_customer',
    legacyScopes: ['customer_authenticated', 'customer_logged'],
  },
]

const buildQuotaSnapshot = () => ({
  usage: {
    total_tokens: 0,
    total_requests: 0,
    start_time: 0,
    end_time: 0,
    source: 'openai',
    error: null,
  },
  costs: {
    total_spent: 0,
    currency: 'usd',
    start_time: 0,
    end_time: 0,
    source: 'openai',
    error: null,
  },
  quota: {
    budget_limit: 25,
    total_spent: 0,
    remaining: 25,
    exceeded: false,
    source: 'openai',
    error: null,
    checked_at: '2026-03-27T00:00:00.000Z',
  },
})

const resolveTenantEntry = (table, tenantKey, fallback) => {
  const value = table?.[tenantKey]
  return value === undefined ? fallback : value
}

export const createCustomerRuntimeFixture = ({
  searchKnowledgeByTenant = {},
  topicTaxonomyByTenant = {},
  quoteProfilesByTenant = {},
  generateResult = { text: 'ok', toolCalls: [] },
} = {}) => {
  const providerCalls = []

  const provider = {
    providerName: 'openai',
    modelName: 'gpt-4o-mini',
    generate: async (payload = {}) => {
      recordProviderCall({
        method: 'generate',
        stage: payload?.options?.stage || null,
        provider: 'openai',
        model: 'gpt-4o-mini',
      })
      providerCalls.push(payload)
      return generateResult
    },
    extractStructured: async (payload = {}) => {
      recordProviderCall({
        method: 'extractStructured',
        stage: payload?.options?.stage || null,
        provider: 'openai',
        model: 'gpt-4o-mini',
      })
      return null
    },
  }

  const backendClient = {
    runtimeRole: null,
    scoped(role) {
      return {
        ...this,
        runtimeRole: role,
        scoped: this.scoped,
      }
    },
    getRuntimeConfig: async () => ({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      customerGroundedRewriteEnabled: false,
      customerDecisionAssistEnabled: false,
      roleCatalog: CUSTOMER_ROLE_CATALOG,
    }),
    getActions: async () => [],
    searchKnowledge: async (query, scope, limit, tenantKey) => {
      const resolved = resolveTenantEntry(searchKnowledgeByTenant, tenantKey, { items: [] })
      return typeof resolved === 'function'
        ? resolved(query, scope, limit, tenantKey)
        : resolved
    },
    getTopicTaxonomy: async (tenantKey, scope = 'customer_public') => ({
      tenantKey: tenantKey || 'default',
      scope,
      items: resolveTenantEntry(topicTaxonomyByTenant, tenantKey, []),
      updatedAt: '2026-03-27T00:00:00.000Z',
    }),
    getQuoteProfiles: async (tenantKey, scope = 'customer_public') => ({
      tenantKey: tenantKey || 'default',
      scope,
      items: resolveTenantEntry(quoteProfilesByTenant, tenantKey, []),
      updatedAt: '2026-03-27T00:00:00.000Z',
    }),
    lookupOwnedCustomerDocument: async () => null,
    getUsageSnapshot: async () => buildQuotaSnapshot(),
    searchProducts: async () => [],
    searchCustomers: async () => [],
    searchOrders: async () => [],
    searchPayments: async () => [],
    searchAppointments: async () => [],
    searchCategories: async () => [],
    extractAssets: async () => ({ items: [] }),
  }

  const memoryStore = new InMemoryConversationStore()
  const runtime = new AiAgentRuntime({
    config: {
      modelProvider: 'openai',
      modelName: 'gpt-4o-mini',
      enabled: true,
    },
    provider,
    memoryStore,
    backendClient,
  })

  return { runtime, backendClient, providerCalls, memoryStore }
}

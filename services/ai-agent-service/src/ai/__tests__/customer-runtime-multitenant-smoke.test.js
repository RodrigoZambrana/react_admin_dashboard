import test from 'node:test'
import assert from 'node:assert/strict'

import { AiAgentRuntime } from '../agent.js'
import { InMemoryConversationStore } from '../memory/in-memory-conversation-store.js'

const DEFAULT_USAGE_SNAPSHOT = {
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
    budget_limit: 50,
    total_spent: 0,
    remaining: 50,
    exceeded: false,
    source: 'openai',
    error: null,
    checked_at: '2026-04-01T00:00:00.000Z',
  },
}

const buildTopicTaxonomy = () => [
  {
    key: 'product_family:ventanas',
    label: 'ventanas',
    kind: 'product_family',
    aliases: ['ventana', 'ventanas'],
    normalizationValue: 'ventanas',
    parentKeys: [],
    parentLabels: [],
    familyLabel: 'ventanas',
    tags: ['quote_requires_measurements', 'quote_requires_quantity'],
    sourceDocumentIds: ['doc-family-ventanas'],
  },
  {
    key: 'product_topic:ventana-corrediza-dvh',
    label: 'ventana corrediza dvh',
    kind: 'product_topic',
    aliases: ['ventana corrediza', 'ventanas corredizas', 'corrediza', 'corredizas', 'dvh'],
    normalizationValue: 'ventana corrediza dvh',
    parentKeys: ['product_family:ventanas'],
    parentLabels: ['ventanas'],
    familyLabel: 'ventanas',
    tags: ['quote_requires_measurements', 'quote_requires_quantity'],
    sourceDocumentIds: ['doc-topic-ventana-corrediza-dvh'],
  },
]

const buildQuoteProfiles = () => [
  {
    key: 'quote_profile:ventana_corrediza_dvh',
    label: 'Ventana corrediza DVH',
    appliesToTopicKeys: ['product_topic:ventana-corrediza-dvh'],
    appliesToTopicLabels: ['ventana corrediza', 'ventana corrediza dvh', 'corrediza', 'dvh'],
    familyLabel: 'ventanas',
    pricingStrategy: 'immediate_square_meter',
    closureMode: 'collect_then_price_or_handoff',
    measurementCarrierTerms: ['ventana', 'ventanas', 'abertura', 'aberturas'],
    attributes: [
      {
        key: 'measurements',
        label: 'las medidas aproximadas (ancho por alto)',
        captureKind: 'measurements',
        required: true,
      },
      {
        key: 'quantity',
        label: 'cuántas unidades necesitás',
        captureKind: 'quantity',
        required: true,
      },
      {
        key: 'color',
        label: 'el color',
        captureKind: 'enum',
        required: false,
        subjectPrefix: 'color',
        options: [
          { value: 'blanco', aliases: ['blanco', 'blanca'] },
          { value: 'negro', aliases: ['negro', 'negra'] },
        ],
      },
    ],
  },
]

const buildKnowledgeDoc = (tenantKey) => ({
  id: `doc-${tenantKey}-location-1`,
  title: `${tenantKey} · ubicación comercial`,
  scope: 'customer_public',
  sourceType: 'curated_document',
  summary:
    'Estamos en Montevideo y coordinamos visitas o seguimiento por este canal según el caso.',
  snippet:
    'Nos encontramos en Montevideo y coordinamos por WhatsApp cuando el cliente ya está avanzando una consulta.',
  score: 0.96,
  metadata: {
    factType: 'location',
  },
})

const createSmokeRuntime = ({
  tenantKey = 'atlas',
  knowledgeDoc = null,
} = {}) => {
  const providerCalls = []
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
      roleCatalog: [
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
      ],
    }),
    getActions: async () => [],
    getTopicTaxonomy: async (requestedTenantKey, scope) => ({
      tenantKey: requestedTenantKey || tenantKey,
      scope: scope || 'customer_public',
      items: buildTopicTaxonomy(),
      updatedAt: '2026-04-01T00:00:00.000Z',
    }),
    getQuoteProfiles: async (requestedTenantKey, scope) => ({
      tenantKey: requestedTenantKey || tenantKey,
      scope: scope || 'customer_public',
      items: buildQuoteProfiles(),
      updatedAt: '2026-04-01T00:00:00.000Z',
    }),
    searchKnowledge: async (query) => {
      const normalizedQuery = String(query || '').toLowerCase()
      if (normalizedQuery.includes('ubic') || normalizedQuery.includes('direccion')) {
        return {
          items: [knowledgeDoc || buildKnowledgeDoc(tenantKey)],
        }
      }

      return { items: [] }
    },
    searchProducts: async (query) =>
      /ventana|corrediza|dvh/i.test(String(query || ''))
        ? [
            {
              id: 77,
              name: `${tenantKey} ventana corrediza dvh`,
              currency: 'USD',
              amount: 120,
              unitOfMeasure: 'SQUARE_METER',
              mode: 'SIMPLE',
            },
          ]
        : [],
    previewProductQuote: async ({ quantity = 1 }) => ({
      product: {
        id: 77,
        name: `${tenantKey} ventana corrediza dvh`,
        mode: 'SIMPLE',
        unitOfMeasure: 'SQUARE_METER',
        currency: 'USD',
        published: true,
      },
      available: true,
      needsConfiguration: false,
      quantity,
      unitAmount: 120,
      currency: 'USD',
      effectiveQuantity: quantity,
      measurementPerUnit: 1,
      totalAmount: quantity * 120,
      items: [
        {
          quantity,
          widthMm: 1200,
          heightMm: 1500,
          measurementPerUnit: 1.8,
          effectiveQuantity: quantity,
          derivedUnitPrice: 120,
          totalAmount: quantity * 120,
          missingMeasurements: false,
        },
      ],
    }),
    searchAppointments: async () => [],
    searchCustomers: async () => [],
    searchOrders: async () => [],
    searchPayments: async () => [],
    searchCategories: async () => [],
    lookupOwnedCustomerDocument: async () => null,
    getUsageSnapshot: async () => DEFAULT_USAGE_SNAPSHOT,
    extractAssets: async () => ({ items: [] }),
    parseStructuredCatalogItems: async () => ({ items: [] }),
    prepareStructuredCatalogInsert: async () => ({ items: [] }),
    prepareStructuredCatalogQuote: async () => ({ items: [] }),
    createAppointment: async () => ({ id: 1 }),
    createCustomerAppointment: async () => ({ id: 1 }),
  }

  const provider = {
    providerName: 'openai',
    modelName: 'gpt-4o-mini',
    generate: async () => {
      providerCalls.push({ method: 'generate' })
      throw new Error('provider should not be called in multitenant smoke tests')
    },
    extractStructured: async () => {
      providerCalls.push({ method: 'extractStructured' })
      throw new Error('provider should not be called in multitenant smoke tests')
    },
  }

  const runtime = new AiAgentRuntime({
    config: {
      modelProvider: 'openai',
      modelName: 'gpt-4o-mini',
      enabled: true,
    },
    provider,
    memoryStore: new InMemoryConversationStore(),
    backendClient,
  })

  return { runtime, backendClient, providerCalls }
}

const runConversation = async ({ runtime, conversationId, tenantKey, turns }) => {
  const responses = []
  for (const turn of turns) {
    responses.push(
      await runtime.respond({
        conversationId,
        scope: 'customer_public',
        tenantKey,
        text: turn,
      }),
    )
  }

  return responses
}

test('customer_public keeps quote side-questions grounded on a synthetic tenant instead of leaking the document title', async () => {
  const { runtime, providerCalls } = createSmokeRuntime({
    tenantKey: 'atlas',
  })

  const responses = await runConversation({
    runtime,
    conversationId: 'smoke-multitenant-atlas-location',
    tenantKey: 'atlas',
    turns: [
      'Quiero presupuesto para una ventana corrediza de aluminio DVH de 120 x 150 y 2 unidades.',
      '¿Y ubicación?',
    ],
  })

  const sideQuestion = responses[1]

  assert.equal(providerCalls.length, 0)
  assert.equal(sideQuestion.grounding?.grounded, true)
  assert.match(sideQuestion.text, /montevideo|whatsapp|visitas/i)
  assert.doesNotMatch(sideQuestion.text, /atlas · ubicación comercial/i)
  assert.doesNotMatch(sideQuestion.text, /si seguimos con|material de referencia|quer[eé]s precio/i)
  assert.ok((sideQuestion.grounding?.usedFacts || []).length > 0)
  assert.ok((sideQuestion.grounding?.usedSourceIds || []).length > 0)
})

test('customer_public keeps quote continuity on a synthetic tenant without reopening measurements', async () => {
  const { runtime, providerCalls } = createSmokeRuntime({
    tenantKey: 'northline',
  })

  const responses = await runConversation({
    runtime,
    conversationId: 'smoke-multitenant-northline-quote',
    tenantKey: 'northline',
    turns: [
      'Quiero presupuesto para una ventana corrediza de aluminio DVH de 120 x 150 y 2 unidades.',
      'y en negro',
    ],
  })

  const followUp = responses[1]

  assert.equal(providerCalls.length, 0)
  assert.equal(followUp.audit?.intentKey, 'customer.quote')
  assert.match(followUp.text, /negro|cotizaci[oó]n|misma cotizaci[oó]n|seguimos/i)
  assert.doesNotMatch(followUp.text, /medidas aproximadas|cu[aá]ntas unidades/i)
})

test('customer_public keeps schedule continuity on a synthetic tenant without repeating captured details', async () => {
  const { runtime, providerCalls } = createSmokeRuntime({
    tenantKey: 'shoreline',
  })

  const responses = await runConversation({
    runtime,
    conversationId: 'smoke-multitenant-shoreline-schedule',
    tenantKey: 'shoreline',
    turns: [
      'Necesito coordinar una visita para mañana a las 10 en calle 123',
      'mi telefono es 099123456',
    ],
  })

  const followUp = responses[1]

  assert.equal(providerCalls.length, 0)
  assert.match(followUp.text, /tel[eé]fono|contacto|seguimos|coordin/i)
  assert.doesNotMatch(followUp.text, /mañana|calle 123|direcci[oó]n exacta/i)
  assert.doesNotMatch(followUp.text, /presupuesto|ventana corrediza|atlas|northline/i)
})

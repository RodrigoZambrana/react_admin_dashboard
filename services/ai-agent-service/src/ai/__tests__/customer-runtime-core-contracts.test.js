import test from 'node:test'
import assert from 'node:assert/strict'
import { AiAgentRuntime } from '../agent.js'
import { InMemoryConversationStore } from '../memory/in-memory-conversation-store.js'
import {
  normalizeIntentKeyValue,
} from '../conversation/decision-runtime.js'
import { resolveKnowledgeNeedDecision } from '../retrieval/retrieval-gate.js'
import {
  buildCustomerFaqKnowledgeResponse,
  selectCustomerFaqEvidence,
} from '../intents/customer-faq-response.js'
import { buildTenantRuntimePolicy } from '../tenant-policy/runtime-tenant-policy.js'
import { CUSTOMER_RUNTIME_CLOSURE_RESIDUAL_MINI_SET } from './fixtures/customer-runtime-closure-residual-mini-set.js'

const SYNTHETIC_TOPIC_TAXONOMY = [
  {
    key: 'product_family:window',
    label: 'ventanas',
    kind: 'product_family',
    aliases: ['ventana', 'ventanas'],
    normalizationValue: 'ventanas',
    parentKeys: [],
    parentLabels: [],
    familyLabel: 'ventanas',
    tags: ['measurements', 'quantity'],
    sourceDocumentIds: ['doc-family-window'],
  },
  {
    key: 'product_topic:aluminum-window',
    label: 'ventanas de aluminio',
    kind: 'product_topic',
    aliases: ['ventanas de aluminio', 'aluminio', 'ventana de aluminio'],
    normalizationValue: 'ventanas de aluminio',
    parentKeys: ['product_family:window'],
    parentLabels: ['ventanas'],
    familyLabel: 'ventanas',
    tags: ['measurements', 'quantity', 'color'],
    sourceDocumentIds: ['doc-topic-aluminum-window'],
  },
  {
    key: 'product_topic:roller-shade',
    label: 'cortina roller',
    kind: 'product_topic',
    aliases: ['roller', 'cortina roller'],
    normalizationValue: 'roller',
    parentKeys: ['product_family:shade'],
    parentLabels: ['cortinas'],
    familyLabel: 'cortinas',
    tags: ['measurements', 'quantity'],
    sourceDocumentIds: ['doc-topic-roller'],
  },
]

const SYNTHETIC_QUOTE_PROFILES = [
  {
    key: 'quote_profile:window',
    label: 'Ventanas de aluminio',
    appliesToTopicKeys: ['product_topic:aluminum-window'],
    appliesToTopicLabels: ['ventanas de aluminio', 'aluminio', 'ventana de aluminio'],
    familyLabel: 'ventanas',
    pricingStrategy: 'collect_then_price_or_handoff',
    closureMode: 'collect_then_price_or_handoff',
    measurementCarrierTerms: ['ventana', 'ventanas', 'vano', 'vanos'],
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
  {
    key: 'quote_profile:roller',
    label: 'Cortinas roller',
    appliesToTopicKeys: ['product_topic:roller-shade'],
    appliesToTopicLabels: ['roller', 'cortina roller'],
    familyLabel: 'cortinas',
    pricingStrategy: 'collect_then_price_or_handoff',
    closureMode: 'collect_then_price_or_handoff',
    measurementCarrierTerms: ['ventana', 'ventanas', 'vano', 'vanos'],
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
    ],
  },
]

const createCoreRuntime = ({ backendOverrides = {} } = {}) => {
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
          forbiddenIntents: [],
          requiresConfirmation: [],
          tone: 'helpful_public',
          legacyScopes: ['customer_public'],
        },
        {
          key: 'customer_authenticated',
          type: 'customer',
          memoryTurns: 12,
          allowedTools: ['search_products'],
          forbiddenIntents: [],
          requiresConfirmation: [],
          tone: 'trusted_customer',
          legacyScopes: ['customer_authenticated'],
        },
      ],
    }),
    getActions: async () => [],
    getTopicTaxonomy: async () => ({
      tenantKey: 'synthetic-core',
      scope: 'customer_public',
      items: SYNTHETIC_TOPIC_TAXONOMY,
      updatedAt: '2026-04-01T00:00:00.000Z',
    }),
    getQuoteProfiles: async () => ({
      tenantKey: 'synthetic-core',
      scope: 'customer_public',
      items: SYNTHETIC_QUOTE_PROFILES,
      updatedAt: '2026-04-01T00:00:00.000Z',
    }),
    searchKnowledge: async () => ({ items: [] }),
    searchProducts: async (query) => {
      const normalizedQuery = String(query || '').toLowerCase()
      if (normalizedQuery.includes('roller') || normalizedQuery.includes('cortina')) {
        return [
          {
            id: 'prod-roller-synthetic',
            name: 'Cortina roller sintética',
            currency: 'USD',
            amount: 120,
            unitOfMeasure: 'UNIT',
            mode: 'SIMPLE',
          },
        ]
      }

      if (normalizedQuery.includes('ventana') || normalizedQuery.includes('alumin')) {
        return [
          {
            id: 'prod-window-synthetic',
            name: 'Ventana de aluminio sintética',
            currency: 'USD',
            amount: 150,
            unitOfMeasure: 'UNIT',
            mode: 'SIMPLE',
          },
        ]
      }

      return []
    },
    searchAppointments: async () => [],
    searchCustomers: async () => [],
    searchOrders: async () => [],
    lookupOwnedCustomerDocument: async () => null,
    getUsageSnapshot: async () => ({
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
        budget_exceeded: false,
        source: 'openai',
        error: null,
      },
    }),
  }

  Object.assign(backendClient, backendOverrides)

  const provider = {
    providerName: 'openai',
    modelName: 'gpt-4o-mini',
    generate: async (payload) => {
      providerCalls.push({ method: 'generate', payload })
      throw new Error('provider should not be called in core contract tests')
    },
    extractStructured: async (payload) => {
      providerCalls.push({ method: 'extractStructured', payload })
      throw new Error('provider should not be called in core contract tests')
    },
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

const runTurns = async ({
  runtime,
  conversationId,
  tenantKey = 'synthetic-core',
  scope = 'customer_public',
  turns = [],
}) => {
  const responses = []
  for (const text of turns) {
    responses.push(
      await runtime.respond({
        conversationId,
        scope,
        tenantKey,
        text,
      }),
    )
  }
  return responses
}

const buildLocationRetrievalItems = () => [
  {
    id: 'doc-location-1',
    title: 'Central office',
    scope: 'customer_public',
    sourceType: 'curated_document',
    summary: 'Estamos en Montevideo y coordinamos visitas por WhatsApp cuando hace falta.',
    snippet: 'Nos encontramos en Montevideo y coordinamos por WhatsApp.',
    score: 0.96,
    metadata: { factType: 'location' },
  },
]

const buildLocationRetrievalItemsWithStrongTitle = () => [
  {
    id: 'doc-location-strong-title-1',
    title: 'Montevideo · ubicación comercial',
    scope: 'customer_public',
    sourceType: 'curated_document',
    summary:
      'Nos encontramos en Montevideo y coordinamos por WhatsApp cuando el cliente ya está avanzando una consulta.',
    snippet:
      'Nos encontramos en Montevideo y hacemos visitas a domicilio cuando hace falta.',
    score: 0.99,
    metadata: { factType: 'location' },
  },
]

test('selectCustomerFaqEvidence prefers factual location fragments over document titles', () => {
  const evidence = selectCustomerFaqEvidence({
    input: '¿Y ubicación?',
    retrievalItems: buildLocationRetrievalItems(),
    faqSubtype: 'location',
  })

  assert.ok(evidence.length > 0)
  assert.match(evidence[0].text, /montevideo|whatsapp/i)
  assert.doesNotMatch(evidence[0].text, /central office/i)
})

test('buildCustomerFaqKnowledgeResponse keeps factual location answers title-free', () => {
  const tenantRuntimePolicy = buildTenantRuntimePolicy({
    tenantKey: 'synthetic-core',
    topicTaxonomy: SYNTHETIC_TOPIC_TAXONOMY,
    quoteProfiles: SYNTHETIC_QUOTE_PROFILES,
  })

  const text = buildCustomerFaqKnowledgeResponse({
    input: '¿Y ubicación?',
    retrievalItems: buildLocationRetrievalItems(),
    intentKey: 'customer.topic_info',
    interpretation: {
      normalizedCurrentTurn: 'y ubicacion',
      topic: { label: 'ubicación', type: 'business_fact' },
      contextTopic: { label: 'ventanas de aluminio', type: 'product_topic' },
      resolutionReadiness: {
        lane: 'quote',
        answerMode: 'answer_side_question',
        sideQuestionSubtype: 'location',
      },
      followUp: { detected: true, inheritedIntentKey: 'customer.quote' },
    },
    tenantTopicTaxonomy: SYNTHETIC_TOPIC_TAXONOMY,
    tenantRuntimePolicy,
  })

  assert.match(text, /montevideo|whatsapp/i)
  assert.doesNotMatch(text, /central office|ubicación comercial/i)
})

test('location strong-looking titles still lose to factual evidence when shaping grounded answers', () => {
  const tenantRuntimePolicy = buildTenantRuntimePolicy({
    tenantKey: 'synthetic-core',
    topicTaxonomy: SYNTHETIC_TOPIC_TAXONOMY,
    quoteProfiles: SYNTHETIC_QUOTE_PROFILES,
  })
  const retrievalItems = buildLocationRetrievalItemsWithStrongTitle()

  const evidence = selectCustomerFaqEvidence({
    input: '¿Y ubicación?',
    retrievalItems,
    faqSubtype: 'location',
  })

  const text = buildCustomerFaqKnowledgeResponse({
    input: '¿Y ubicación?',
    retrievalItems,
    intentKey: 'customer.topic_info',
    interpretation: {
      normalizedCurrentTurn: 'y ubicacion',
      topic: { label: 'ubicación', type: 'business_fact' },
      contextTopic: { label: 'ventanas de aluminio', type: 'product_topic' },
      resolutionReadiness: {
        lane: 'quote',
        answerMode: 'answer_side_question',
        sideQuestionSubtype: 'location',
      },
      followUp: { detected: true, inheritedIntentKey: 'customer.quote' },
    },
    tenantTopicTaxonomy: SYNTHETIC_TOPIC_TAXONOMY,
    tenantRuntimePolicy,
  })

  assert.ok(evidence.length > 0)
  assert.match(evidence[0].text, /nos encontramos|visitas a domicilio|whatsapp/i)
  assert.doesNotMatch(evidence[0].text, /^montevideo · ubicación comercial\.?$/i)
  assert.match(text, /montevideo|visitas a domicilio|whatsapp/i)
  assert.doesNotMatch(text, /^montevideo · ubicación comercial\.?$/i)
})

test('resolveKnowledgeNeed keeps quote side questions grounded when the quote anchor is active', () => {
  const { runtime } = createCoreRuntime()
  const decision = runtime.resolveKnowledgeNeed({
    role: 'customer_public',
    intentKey: 'customer.quote',
    turnInterpretation: {
      currentTurnText: '¿Y ubicación?',
      normalizedCurrentTurn: 'y ubicacion',
      topic: { label: 'ventanas de aluminio', type: 'product_topic' },
      contextTopic: { label: 'ventanas de aluminio', type: 'product_topic' },
      followUp: { detected: true, inheritedIntentKey: 'customer.quote' },
      resolutionReadiness: {
        lane: 'quote',
        answerMode: 'answer_side_question',
        sideQuestionSubtype: 'location',
      },
    },
    tenantRuntimePolicy: buildTenantRuntimePolicy({
      tenantKey: 'synthetic-core',
      topicTaxonomy: SYNTHETIC_TOPIC_TAXONOMY,
      quoteProfiles: SYNTHETIC_QUOTE_PROFILES,
    }),
  })

  assert.equal(decision.knowledgeNeed, 'required')
  assert.equal(decision.reason, 'anchored_quote_side_question')
})

test('resolveKnowledgeNeed keeps payment and contact side questions inside the active thread', () => {
  const policy = buildTenantRuntimePolicy({
    tenantKey: 'synthetic-core',
    topicTaxonomy: SYNTHETIC_TOPIC_TAXONOMY,
    quoteProfiles: SYNTHETIC_QUOTE_PROFILES,
  })

  const paymentDecision = resolveKnowledgeNeedDecision({
    role: 'customer_public',
    intentKey: 'customer.quote',
    turnInterpretation: {
      currentTurnText: 'Me pasas cuenta bancaria?',
      normalizedCurrentTurn: 'me pasas cuenta bancaria',
      topic: { label: 'ventanas de aluminio', type: 'product_topic' },
      followUp: { detected: true, inheritedIntentKey: 'customer.quote' },
      resolutionReadiness: {
        lane: 'quote',
        answerMode: 'answer_side_question',
        sideQuestionSubtype: 'payment_methods',
      },
    },
    tenantRuntimePolicy: policy,
    responseContract: 'answer_side_question',
    intentRequiresStrictKnowledge: false,
    hasActiveKnowledgeTopicAnchor: () => true,
    hasActiveFactualKnowledgeAnchor: () => true,
    normalizeIntentKeyValue,
    looksLikeCommercialConditionQuestion: () => false,
    hasTenantInstallationSignal: () => false,
    hasTenantBusinessFactCoverage: () => false,
    factualFaqSubtypes: new Set(['location', 'business_hours', 'payment_methods', 'contact']),
    nonFactualSideQuestionResponseContracts: new Set(['guide_quote_exploration', 'ask_quote_field']),
    retrievalFreeResponseContracts: new Set([]),
    requiredRetrievalResponseContracts: new Set([]),
  })

  assert.equal(paymentDecision.knowledgeNeed, 'required')
  assert.equal(paymentDecision.reason, 'anchored_quote_side_question')
})

test('customer_public keeps quote side questions grounded without reopening intake', async () => {
  const { runtime, backendClient, providerCalls } = createCoreRuntime({
    backendOverrides: {
      searchKnowledge: async (query) => {
        const normalizedQuery = String(query || '').toLowerCase()
        if (normalizedQuery.includes('ubicacion') || normalizedQuery.includes('ubicación')) {
          return {
            items: buildLocationRetrievalItems(),
          }
        }
        return { items: [] }
      },
    },
  })

  const responses = await runTurns({
    runtime,
    conversationId: 'core-contract-quote-location',
    turns: [
      'Quiero presupuesto para una ventana de aluminio.',
      '¿Y ubicación?',
    ],
  })

  assert.equal(providerCalls.length, 0)
  assert.equal(responses[1].grounding?.grounded, true)
  assert.match(responses[1].text, /montevideo|whatsapp/i)
  assert.doesNotMatch(responses[1].text, /central office/i)
  assert.doesNotMatch(responses[1].text, /medidas aproximadas|cu[aá]ntas unidades/i)
})

test('customer_public does not repeat a captured quote measurement on a follow-up detail', async () => {
  const { runtime, providerCalls } = createCoreRuntime()

  const responses = await runTurns({
    runtime,
    conversationId: 'core-contract-quote-measurement-repeat',
    turns: [
      'Quiero presupuesto para una ventana de aluminio 120 x 80',
      'y negro',
    ],
  })

  assert.equal(providerCalls.length, 0)
  assert.equal(responses[0].auditPayload?.intentKey, 'customer.quote')
  assert.equal(responses[1].auditPayload?.intentKey, 'customer.quote')
  assert.doesNotMatch(responses[1].text, /medidas aproximadas|ancho por alto/i)
})

test('customer_public keeps operational quote attribute follow-ups inside quote instead of degrading to side-question mode', async () => {
  const { runtime, providerCalls } = createCoreRuntime()

  const responses = await runTurns({
    runtime,
    conversationId: 'core-contract-quote-attribute-follow-up',
    turns: [
      'Quiero presupuesto para una ventana de aluminio 120 x 80, dos unidades',
      'En blanco',
    ],
  })

  assert.equal(providerCalls.length, 0)
  assert.equal(responses[0].auditPayload?.intentKey, 'customer.quote')
  assert.equal(responses[1].auditPayload?.intentKey, 'customer.quote')
  assert.notEqual(
    responses[1].auditPayload?.metrics?.responseContract,
    'answer_side_question',
  )
  assert.notEqual(
    responses[1].auditPayload?.metrics?.effectiveAnswerMode,
    'answer_side_question',
  )
  assert.doesNotMatch(responses[1].text, /medidas aproximadas|ancho por alto|cu[aá]ntas unidades|cantidad/i)
})

test('customer_public asks only the missing schedule field and preserves captured date', async () => {
  const { runtime, providerCalls } = createCoreRuntime()

  const responses = await runTurns({
    runtime,
    conversationId: 'core-contract-schedule-missing-field',
    turns: [
      'Quiero agendar una visita el lunes a las 10',
      'La dirección es Av. Siempre Viva 123',
    ],
  })

  assert.equal(providerCalls.length, 0)
  assert.equal(responses[0].auditPayload?.intentKey, 'customer.schedule_request')
  assert.equal(responses[1].auditPayload?.intentKey, 'customer.schedule_request')
  assert.doesNotMatch(responses[1].text, /lunes|horario|a las 10/i)
})

test('customer_public keeps support continuity on a photo follow-up instead of falling back generically', async () => {
  const { runtime } = createCoreRuntime({
    backendOverrides: {
      searchKnowledge: async (query) => {
        const normalizedQuery = String(query || '').toLowerCase()
        if (
          normalizedQuery.includes('foto') ||
          normalizedQuery.includes('persiana') ||
          normalizedQuery.includes('revis')
        ) {
          return {
            items: [
              {
                id: 'doc-support-photo-1',
                title: 'Revisión de persianas',
                scope: 'customer_public',
                sourceType: 'curated_document',
                summary:
                  'Podemos revisar la foto, ver el material y coordinar la revisión por WhatsApp.',
                snippet:
                  'Enviame una foto y seguimos con la revisión por acá.',
                score: 0.99,
                metadata: { factType: 'support' },
              },
            ],
          }
        }

        return { items: [] }
      },
    },
  })
  runtime.provider.generate = async () => ({
    text: 'Enviame una foto y seguimos con la revisión por acá.',
    toolCalls: [],
  })

  const responses = await runTurns({
    runtime,
    conversationId: 'core-contract-support-photo-follow-up',
    turns: [
      'Buenas. Tengo unas persianas viejas de plástico que ya fueron reparadas una vez, quería saber si se pueden revisar y decirme si tienen reparación o hay que cambiarlas y cuando costaría. Gracias.',
      'Buenos días, de acuerdo, en un rato saco fotos y se las envío. Muchas gracias. Saludos',
    ],
  })

  assert.equal(responses[0].auditPayload?.intentKey, 'customer.support_request')
  assert.equal(responses[1].auditPayload?.intentKey, 'customer.support_request')
  assert.match(responses[1].text, /foto|revisi[oó]n/i)
  assert.doesNotMatch(responses[1].text, /cotizaci[oó]n|presupuesto|agendar/i)
})

test('customer_public keeps payment follow-ups inside the commercial thread', async () => {
  const { runtime, providerCalls } = createCoreRuntime()

  const responses = await runTurns({
    runtime,
    conversationId: 'core-contract-payment-follow-up',
    turns: ['Me pasas cuenta bancaria?', 'USD 462'],
  })

  assert.equal(providerCalls.length, 0)
  assert.doesNotMatch(responses[1].text, /tel[eé]fono y whatsapp|contacto por este medio/i)
  assert.match(responses[1].text, /transferir|se[nñ]a|comprobante|pago/i)
})

test('customer_public preserves light closure continuity without reopening quote intake', async () => {
  const { runtime, providerCalls } = createCoreRuntime()

  const responses = await runTurns({
    runtime,
    conversationId: 'core-contract-light-closure-quote',
    turns: [
      'Quiero presupuesto para una ventana de aluminio 120 x 80, dos unidades',
      'ok',
    ],
  })

  assert.equal(providerCalls.length, 0)
  assert.equal(responses[0].auditPayload?.intentKey, 'customer.quote')
  assert.equal(responses[1].auditPayload?.intentKey, 'customer.quote')
  assert.doesNotMatch(responses[1].text, /medidas aproximadas|cu[aá]ntas unidades|cantidad/i)
  assert.doesNotMatch(responses[1].text, /presupuesto nuevo|reenv[ií]ame|empecemos de nuevo/i)
})

test('closure residual mini set keeps quote-side availability follow-ups out of quote intake', async () => {
  const { runtime, providerCalls } = createCoreRuntime()

  const responses = await runTurns({
    runtime,
    conversationId: 'core-contract-closure-residual-availability-side-question',
    turns: [
      'Quiero presupuesto para una cortina roller de 120 x 80 y 2 unidades.',
      CUSTOMER_RUNTIME_CLOSURE_RESIDUAL_MINI_SET.representativeCases
        .quoteAvailabilitySideQuestion.userText,
    ],
  })

  assert.equal(providerCalls.length, 0)
  assert.equal(responses[0].auditPayload?.intentKey, 'customer.quote')
  assert.match(responses[1].text, /tiempo de entrega|agenda disponible|encaminado/i)
  assert.doesNotMatch(responses[1].text, /medidas aproximadas|cu[aá]ntas unidades|cantidad/i)
})

test('closure residual mini set keeps ready quote deferrals in closure mode instead of looping quote progression', async () => {
  const { runtime, providerCalls } = createCoreRuntime()

  const responses = await runTurns({
    runtime,
    conversationId: 'core-contract-closure-residual-quote-deferral',
    turns: [
      'Quiero presupuesto para una cortina roller de 120 x 80 y 2 unidades.',
      CUSTOMER_RUNTIME_CLOSURE_RESIDUAL_MINI_SET.representativeCases
        .quoteReadyClosure.userText,
    ],
  })

  assert.equal(providerCalls.length, 0)
  assert.equal(responses[0].auditPayload?.intentKey, 'customer.quote')
  assert.match(responses[1].text, /retomar|seguimos por ac[aá]|cotizaci[oó]n/i)
  assert.doesNotMatch(responses[1].text, /misma cotizaci[oó]n|sumo ese dato|medidas aproximadas/i)
})

test('closure residual mini set keeps schedule courtesy closures contextual instead of repeating empty continuations', async () => {
  const { runtime, providerCalls } = createCoreRuntime()

  const responses = await runTurns({
    runtime,
    conversationId: 'core-contract-closure-residual-schedule-courtesy',
    turns: [
      'Necesito coordinar una visita para revisar una cortina.',
      'El lunes me sirve.',
      'Después de las 18.',
      'Avenida Italia 1234.',
      CUSTOMER_RUNTIME_CLOSURE_RESIDUAL_MINI_SET.representativeCases
        .scheduleCourtesyClosure.userText,
    ],
  })

  assert.equal(providerCalls.length, 0)
  assert.equal(responses[4].auditPayload?.intentKey, 'customer.schedule_request')
  assert.match(responses[4].text, /retomar|seguimos por ac[aá]|coordinaci[oó]n/i)
  assert.doesNotMatch(
    responses[4].text,
    /zona o direcci[oó]n|qu[eé] d[ií]a|horario te queda mejor/i,
  )
})

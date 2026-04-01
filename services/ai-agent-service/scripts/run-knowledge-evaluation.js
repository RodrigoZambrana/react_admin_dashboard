import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { AiAgentRuntime } from '../src/ai/agent.js'
import { InMemoryConversationStore } from '../src/ai/memory/in-memory-conversation-store.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.resolve(__dirname, '..')
const DATASET_PATH = path.join(ROOT_DIR, 'evals', 'knowledge-regression.dataset.json')
const OUTPUT_DIR = path.resolve(ROOT_DIR, '..', '.qa', 'ai-agent', 'generated')
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'knowledge-regression-current.json')

const TOPIC_TAXONOMY = [
  {
    key: 'product_family:cortina',
    label: 'cortinas',
    kind: 'product_family',
    aliases: ['cortinas', 'cortina'],
    normalizationValue: 'cortinas',
    parentKeys: [],
    parentLabels: [],
    familyLabel: 'cortinas',
    tags: ['quote_requires_measurements', 'quote_requires_quantity'],
    sourceDocumentIds: ['doc-roller'],
  },
  {
    key: 'product_topic:cortinas-roller',
    label: 'cortinas roller',
    kind: 'product_topic',
    aliases: ['roller', 'cortinas roller'],
    normalizationValue: 'roller',
    parentKeys: ['product_family:cortina'],
    parentLabels: ['cortinas'],
    familyLabel: 'cortinas',
    tags: ['quote_requires_measurements', 'quote_requires_quantity'],
    sourceDocumentIds: ['doc-roller'],
  },
  {
    key: 'product_variant:blackout',
    label: 'blackout',
    kind: 'product_variant',
    aliases: ['blackout', 'black out'],
    normalizationValue: 'blackout',
    parentKeys: ['product_topic:cortinas-roller'],
    parentLabels: ['cortinas roller'],
    familyLabel: 'cortinas',
    tags: ['blackout'],
    sourceDocumentIds: ['doc-roller'],
  },
  {
    key: 'product_variant:screen',
    label: 'screen',
    kind: 'product_variant',
    aliases: ['screen'],
    normalizationValue: 'screen',
    parentKeys: ['product_topic:cortinas-roller'],
    parentLabels: ['cortinas roller'],
    familyLabel: 'cortinas',
    tags: ['screen'],
    sourceDocumentIds: ['doc-roller'],
  },
]

const QUOTE_PROFILES = [
  {
    key: 'roller-blackout',
    label: 'Roller blackout',
    appliesToTopicKeys: ['product_topic:cortinas-roller'],
    appliesToTopicLabels: ['cortinas roller'],
    familyLabel: 'cortinas',
    pricingStrategy: 'parametric_exact_or_handoff',
    closureMode: 'collect_then_handoff',
    measurementCarrierTerms: ['medidas'],
    attributes: [],
    sourceDocumentIds: ['doc-roller'],
  },
]

const KNOWLEDGE_ITEMS = [
  {
    id: 'doc-hours',
    documentId: 'doc-hours',
    title: 'Horario de atención',
    scope: 'customer_public',
    sourceType: 'docs',
    retrievalMode: 'chunk',
    snippet:
      'Atendemos de lunes a viernes de 9 a 18 hs y los sábados de 9 a 13 hs.',
    content:
      'Horario de atención: lunes a viernes de 9 a 18 hs y sábados de 9 a 13 hs.',
    scoreTerms: ['horario', 'atencion', 'lunes', 'viernes', 'sabados'],
    chunk: { id: 'chunk-hours', index: 0, charStart: 0, charEnd: 90 },
    embedding: { provider: 'openai', mode: 'semantic', model: 'text-embedding-3-small', dimensions: 256 },
  },
  {
    id: 'doc-payments',
    documentId: 'doc-payments',
    title: 'Formas de pago',
    scope: 'customer_public',
    sourceType: 'docs',
    retrievalMode: 'chunk',
    snippet:
      'Aceptamos efectivo, transferencia bancaria y tarjetas.',
    content:
      'Formas de pago: efectivo, transferencia bancaria y tarjetas.',
    scoreTerms: ['formas', 'pago', 'efectivo', 'transferencia', 'tarjetas'],
    chunk: { id: 'chunk-payments', index: 0, charStart: 0, charEnd: 85 },
    embedding: { provider: 'openai', mode: 'semantic', model: 'text-embedding-3-small', dimensions: 256 },
  },
  {
    id: 'doc-contact',
    documentId: 'doc-contact',
    title: 'Contacto comercial',
    scope: 'customer_public',
    sourceType: 'docs',
    retrievalMode: 'chunk',
    snippet:
      'Podés escribirnos por WhatsApp o llamarnos al teléfono comercial.',
    content:
      'Contacto: WhatsApp 099 000 111 y teléfono comercial 2400 0000.',
    scoreTerms: ['whatsapp', 'telefono', 'contacto'],
    chunk: { id: 'chunk-contact', index: 0, charStart: 0, charEnd: 88 },
    embedding: { provider: 'openai', mode: 'semantic', model: 'text-embedding-3-small', dimensions: 256 },
  },
  {
    id: 'doc-roller',
    documentId: 'doc-roller',
    title: 'Roller blackout y screen',
    scope: 'customer_public',
    sourceType: 'docs',
    retrievalMode: 'chunk',
    snippet:
      'Blackout bloquea casi toda la luz; screen deja pasar luz y visibilidad.',
    content:
      'Roller blackout bloquea casi por completo la luz. Screen deja pasar luz y mantiene visibilidad.',
    scoreTerms: ['roller', 'blackout', 'screen', 'luz'],
    chunk: { id: 'chunk-roller', index: 0, charStart: 0, charEnd: 110 },
    embedding: { provider: 'openai', mode: 'semantic', model: 'text-embedding-3-small', dimensions: 256 },
  },
]

const normalize = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const scoreKnowledgeItem = (item, query) => {
  const normalizedQuery = normalize(query)
  const terms = Array.isArray(item.scoreTerms) ? item.scoreTerms : []
  let score = 0
  for (const term of terms) {
    if (normalizedQuery.includes(normalize(term))) {
      score += 1
    }
  }
  if (normalize(item.title).includes(normalizedQuery)) {
    score += 1.5
  }
  return Number(score.toFixed(4))
}

const createRuntime = () => {
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
      ],
    }),
    getActions: async () => [],
    searchKnowledge: async (query, _scope = 'customer_public', limit = 5) => {
      const ranked = KNOWLEDGE_ITEMS.map((item) => ({
        ...item,
        score: scoreKnowledgeItem(item, query),
        lexicalScore: scoreKnowledgeItem(item, query),
        vectorScore: scoreKnowledgeItem(item, query) > 0 ? 0.82 : 0,
      }))
        .filter((item) => item.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit)

      return {
        tenantKey: 'urucortinas',
        query,
        scope: 'customer_public',
        retrievalMode: ranked.length ? 'chunk' : 'document',
        embeddingMode: {
          provider: 'openai',
          mode: 'semantic',
          model: 'text-embedding-3-small',
          dimensions: 256,
        },
        queryEmbedding: {
          provider: 'openai',
          mode: 'semantic',
          model: 'text-embedding-3-small',
          dimensions: 256,
          latencyMs: 15,
          cacheHit: false,
          providerError: null,
        },
        items: ranked,
      }
    },
    getTopicTaxonomy: async () => ({
      tenantKey: 'urucortinas',
      scope: 'customer_public',
      items: TOPIC_TAXONOMY,
      updatedAt: '2026-03-30T00:00:00.000Z',
    }),
    getQuoteProfiles: async () => ({
      tenantKey: 'urucortinas',
      scope: 'customer_public',
      items: QUOTE_PROFILES,
      updatedAt: '2026-03-30T00:00:00.000Z',
    }),
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
        budget_limit: 25,
        total_spent: 0,
        remaining: 25,
        exceeded: false,
        source: 'openai',
        error: null,
        checked_at: '2026-03-30T00:00:00.000Z',
      },
    }),
    searchProducts: async () => [],
    searchCategories: async () => [],
    searchCustomers: async () => [],
    searchAppointments: async () => [],
    searchOrders: async () => [],
    searchPayments: async () => [],
    extractAssets: async () => ({ items: [] }),
    lookupOwnedCustomerDocument: async () => null,
  }

  const provider = {
    providerName: 'openai',
    modelName: 'gpt-4o-mini',
    generate: async ({ promptInput }) => {
      const normalized = normalize(promptInput)
      if (normalized.includes('horario')) {
        return {
          text: 'Nuestro horario es de lunes a viernes de 9 a 18 hs y los sabados de 9 a 13 hs.',
          toolCalls: [],
        }
      }
      if (normalized.includes('formas de pago') || normalized.includes('medios de pago')) {
        return {
          text: 'Aceptamos efectivo, transferencia bancaria y tarjetas.',
          toolCalls: [],
        }
      }
      if (normalized.includes('whatsapp') || normalized.includes('telefono')) {
        return {
          text: 'Podés escribirnos por WhatsApp o llamarnos por telefono.',
          toolCalls: [],
        }
      }
      if (normalized.includes('blackout') && normalized.includes('screen')) {
        return {
          text: 'Blackout bloquea casi toda la luz, mientras que screen deja pasar luz y mantiene visibilidad.',
          toolCalls: [],
        }
      }
      return {
        text: 'Sí, tenemos roller blackout. Si querés cotizar, necesito las medidas y la cantidad.',
        toolCalls: [],
      }
    },
    extractStructured: async () => null,
  }

  return new AiAgentRuntime({
    config: {
      modelProvider: 'openai',
      modelName: 'gpt-4o-mini',
      enabled: true,
    },
    provider,
    memoryStore: new InMemoryConversationStore(),
    backendClient,
  })
}

const runCaseForMode = async (testCase, mode) => {
  const runtime = createRuntime()
  const conversationId = `eval-${testCase.id}-${mode}`
  let lastResponse = null

  for (const turn of testCase.turns) {
    lastResponse = await runtime.respond({
      conversationId,
      scope: 'customer_public',
      role: 'customer_public',
      tenantKey: 'urucortinas',
      text: turn,
      metadata: {
        debugOptions: {
          knowledgeMode: mode,
        },
      },
    })
  }

  const finalText = String(lastResponse?.finalUserText || lastResponse?.text || '')
  const auditPayload =
    lastResponse?.auditPayload && typeof lastResponse.auditPayload === 'object'
      ? lastResponse.auditPayload
      : {}
  const decisionTrace =
    auditPayload.decisionTrace && typeof auditPayload.decisionTrace === 'object'
      ? auditPayload.decisionTrace
      : {}
  const knowledge =
    decisionTrace.knowledge && typeof decisionTrace.knowledge === 'object'
      ? decisionTrace.knowledge
      : {}

  const expectedKnowledgeUsage =
    mode === 'retrieval_disabled' ? false : Boolean(testCase.expectedKnowledgeUsage)
  const actualKnowledgeUsage =
    knowledge.knowledgeUsed === true || knowledge.used === true
  const expectedKeywords = Array.isArray(testCase.expectedKeywords)
    ? testCase.expectedKeywords
    : []
  const missingKeywords = expectedKeywords.filter(
    (keyword) => !normalize(finalText).includes(normalize(keyword)),
  )

  return {
    caseId: testCase.id,
    mode,
    input: testCase.turns,
    finalText,
    intent: auditPayload.intentKey || null,
    responseOrigin: auditPayload.responseOrigin || null,
    knowledgeUsed: actualKnowledgeUsage,
    expectedKnowledgeUsage,
    possibleKnowledgeHallucination:
      knowledge.possibleKnowledgeHallucination === true,
    modelKnowledgeScore:
      typeof knowledge.modelKnowledgeScore === 'number'
        ? knowledge.modelKnowledgeScore
        : null,
    grounding: lastResponse?.grounding ?? null,
    checks: {
      intentMatch: auditPayload.intentKey === testCase.expectedIntent,
      keywordsMatch: missingKeywords.length === 0,
      knowledgeUsageMatch: actualKnowledgeUsage === expectedKnowledgeUsage,
    },
    missingKeywords,
  }
}

const summarizeMode = (results) => {
  const total = results.length
  const passedIntent = results.filter((entry) => entry.checks.intentMatch).length
  const passedKeywords = results.filter((entry) => entry.checks.keywordsMatch).length
  const passedKnowledge = results.filter(
    (entry) => entry.checks.knowledgeUsageMatch,
  ).length
  const grounded = results.filter((entry) => entry.knowledgeUsed).length
  const hallucinations = results.filter(
    (entry) => entry.possibleKnowledgeHallucination === true,
  ).length
  return {
    total,
    intentPrecision: total ? Number((passedIntent / total).toFixed(4)) : 0,
    keywordPrecision: total ? Number((passedKeywords / total).toFixed(4)) : 0,
    knowledgeUsagePrecision: total ? Number((passedKnowledge / total).toFixed(4)) : 0,
    groundingRate: total ? Number((grounded / total).toFixed(4)) : 0,
    hallucinationRate: total ? Number((hallucinations / total).toFixed(4)) : 0,
  }
}

const main = async () => {
  const dataset = JSON.parse(await fs.readFile(DATASET_PATH, 'utf8'))
  const modes = ['full', 'retrieval_only', 'retrieval_disabled']
  const results = {}

  for (const mode of modes) {
    const modeResults = []
    for (const testCase of dataset.cases) {
      modeResults.push(await runCaseForMode(testCase, mode))
    }
    results[mode] = {
      summary: summarizeMode(modeResults),
      cases: modeResults,
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    dataset: dataset.name,
    results,
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

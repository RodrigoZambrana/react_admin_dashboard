import test from 'node:test'
import assert from 'node:assert/strict'
import { AiAgentRuntime } from './agent.js'

const createRuntime = ({ generateResult, backendOverrides = {} } = {}) => {
  const backendClient = {
    getRuntimeConfig: async () => ({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
    }),
    getActions: async () => [
      {
        key: 'orders.create',
        scope: 'admin_internal',
        confirmationRequired: true,
        keywords: ['crear pedido', 'nuevo pedido'],
        toolName: 'create_order',
      },
      {
        key: 'products.update',
        scope: 'admin_internal',
        confirmationRequired: true,
        keywords: ['actualizar producto', 'editar producto', 'modificar producto'],
        toolName: 'update_product',
      },
      {
        key: 'payments.create',
        scope: 'admin_internal',
        confirmationRequired: true,
        keywords: ['registrar pago', 'crear pago', 'cobrar'],
        toolName: 'create_payment',
      },
      {
        key: 'orders.update_comment',
        scope: 'admin_internal',
        confirmationRequired: true,
        keywords: ['nota de pedido', 'comentario del pedido', 'agregar nota al pedido'],
        toolName: 'update_order_comment',
      },
      {
        key: 'categories.update',
        scope: 'admin_internal',
        confirmationRequired: true,
        keywords: ['actualizar categoria', 'actualizar categoría', 'editar categoria', 'editar categoría'],
        toolName: 'update_category',
      },
      {
        key: 'aberturas.register',
        scope: 'admin_internal',
        confirmationRequired: false,
        keywords: [
          'agregar estas aberturas al sistema',
          'agregar aberturas al sistema',
          'agregar a la lista de productos',
          'alta de aberturas',
        ],
        toolName: 'prepare_aberturas_insert',
      },
      {
        key: 'aberturas.parse',
        scope: 'admin_internal',
        confirmationRequired: false,
        keywords: ['abertura', 'aberturas', 'corrediza', 'batiente', 'dvh'],
        toolName: 'parse_aberturas',
      },
      {
        key: 'aberturas.prepare_quote',
        scope: 'admin_internal',
        confirmationRequired: false,
        keywords: ['presupuesto de aberturas', 'pasame este presupuesto', 'cotizar abertura'],
        toolName: 'prepare_aberturas_quote',
      },
    ],
    searchKnowledge: async () => ({ items: [] }),
    searchCategories: async (query) => [
      { id: 31, name: `Categoria ${query}`, parent: null },
    ],
    searchCustomers: async (query) => [
      { id: 251, name: `Cliente ${query}`, email: 'cliente@example.com' },
    ],
    searchProducts: async (query) => [
      { id: 77, name: `Producto ${query}`, currency: 'UYU', amount: 1500 },
    ],
    searchOrders: async (query) => [
      { id: 991, uuid: `ord-${query}`, customer: { name: `Cliente ${query}` } },
    ],
    searchPayments: async () => [],
    parseAberturas: async (payload) => ({
      itemCount: 1,
      summary: `1. VENTANA_CORREDIZA PROBBA 1100x1200 desde ${payload.source}`,
      items: [
        {
          lineNumber: 1,
          familyId: 'VENTANA_CORREDIZA',
          serie: 'PROBBA',
          widthMm: 1100,
          heightMm: 1200,
        },
      ],
    }),
    prepareAberturasInsert: async (payload) => ({
      itemCount: 1,
      readyItemCount: 1,
      summary: `1. VENTANA_CORREDIZA PROBBA 1100x1200 USD 234 desde ${payload.source}`,
      items: [
        {
          lineNumber: 1,
          familyId: 'VENTANA_CORREDIZA',
          serie: 'PROBBA',
          widthMm: 1100,
          heightMm: 1200,
          validForInsert: true,
          insertPayload: {
            name: 'VENTANA_CORREDIZA PROBBA BLANCO 1100x1200',
            salePrice: 234,
            currency: 'USD',
          },
        },
      ],
    }),
    prepareAberturasQuote: async (payload) => ({
      itemCount: 1,
      readyItemCount: 1,
      summary: `1. VENTANA_CORREDIZA PROBBA 1100x1200 USD 234 desde ${payload.source}`,
      items: [
        {
          lineNumber: 1,
          familyId: 'VENTANA_CORREDIZA',
          serie: 'PROBBA',
          widthMm: 1100,
          heightMm: 1200,
          readyForQuote: true,
          draftItem: {
            name: 'VENTANA_CORREDIZA PROBBA BLANCO 1100x1200',
            price: 234,
            currency: 'USD',
          },
        },
      ],
    }),
    ...backendOverrides,
  }

  const providerCalls = []
  const provider = {
    providerName: 'openai',
    modelName: 'gpt-4o-mini',
    generate: async (payload) => {
      providerCalls.push(payload)
      return generateResult ?? { text: 'ok', toolCalls: [] }
    },
  }

  const runtime = new AiAgentRuntime({
    config: {
      modelProvider: 'openai',
      modelName: 'gpt-4o-mini',
      enabled: true,
    },
    provider,
    memoryStore: {
      get: async () => ({ turns: [] }),
      appendTurn: async () => undefined,
    },
    backendClient,
  })

  return { runtime, backendClient, providerCalls }
}

test('admin_internal presearches customers for order creation flows', async () => {
  const { runtime, providerCalls } = createRuntime()

  const response = await runtime.respond({
    conversationId: 'conv-order',
    scope: 'admin_internal',
    tenantKey: 'urucortinas',
    text: 'crear pedido para Carlos Rodriguez con 2 rollers screen color blanco',
  })

  assert.equal(providerCalls.length, 1)
  assert.match(providerCalls[0].systemPrompt, /Contexto operativo previo 1:/)
  assert.match(providerCalls[0].systemPrompt, /search_customers: cliente#251/i)
  assert.ok(
    response.toolCalls.some((entry) => entry.name === 'search_customers' && entry.status === 'executed'),
  )
  assert.match(response.text, /Coincidencias encontradas:/)
  assert.match(response.text, /cliente #251 Cliente Carlos Rodriguez/i)
})

test('admin_internal presearches products for update flows before asking for ids', async () => {
  const { runtime, providerCalls } = createRuntime()

  const response = await runtime.respond({
    conversationId: 'conv-product',
    scope: 'admin_internal',
    tenantKey: 'urucortinas',
    text: 'actualizar producto Roller Screen con precio 1500',
  })

  assert.equal(providerCalls.length, 1)
  assert.match(providerCalls[0].systemPrompt, /search_products: producto#77/i)
  assert.ok(
    response.toolCalls.some((entry) => entry.name === 'search_products' && entry.status === 'executed'),
  )
})

test('admin_internal payment presearch resolves order/customer terms without garbage tokens', async () => {
  const { runtime } = createRuntime()

  const response = await runtime.respond({
    conversationId: 'conv-payment',
    scope: 'admin_internal',
    tenantKey: 'urucortinas',
    text: 'registrar pago de 15000 para el pedido de Carlos Rodriguez por transferencia',
  })

  assert.deepEqual(
    response.toolCalls
      .filter((entry) => entry.name === 'search_orders')
      .map((entry) => entry.arguments.query),
    ['Carlos Rodriguez'],
  )
  assert.deepEqual(
    response.toolCalls
      .filter((entry) => entry.name === 'search_customers')
      .map((entry) => entry.arguments.query),
    ['Carlos Rodriguez'],
  )
})

test('admin_internal pre-parses aberturas text and surfaces deterministic matches', async () => {
  const { runtime, providerCalls } = createRuntime()

  const response = await runtime.respond({
    conversationId: 'conv-aberturas',
    scope: 'admin_internal',
    tenantKey: 'urucortinas',
    text: 'Corrediza Probba blanco vidrio simple de 1.10 x 1.20',
  })

  assert.equal(providerCalls.length, 1)
  assert.match(providerCalls[0].systemPrompt, /parse_aberturas: 1\. VENTANA_CORREDIZA PROBBA 1100x1200/i)
  assert.ok(
    response.toolCalls.some((entry) => entry.name === 'parse_aberturas' && entry.status === 'executed'),
  )
  assert.match(response.text, /Coincidencias encontradas:/)
  assert.match(response.text, /parseo de aberturas:/i)
})

test('admin_internal prepares aberturas quote drafts when quote intent is explicit', async () => {
  const { runtime, providerCalls } = createRuntime()

  const response = await runtime.respond({
    conversationId: 'conv-aberturas-quote',
    scope: 'admin_internal',
    tenantKey: 'urucortinas',
    text: 'pasame este presupuesto: corrediza probba blanco 4mm de 1.10 x 1.20',
  })

  assert.equal(providerCalls.length, 1)
  assert.match(
    providerCalls[0].systemPrompt,
    /prepare_aberturas_quote: 1\. VENTANA_CORREDIZA PROBBA 1100x1200 USD 234/i,
  )
  assert.ok(
    response.toolCalls.some(
      (entry) => entry.name === 'prepare_aberturas_quote' && entry.status === 'executed',
    ),
  )
  assert.match(response.text, /borrador de aberturas:/i)
})

test('admin_internal add-to-system intent keeps aberturas in insert mode and hides quote tool', async () => {
  const { runtime, providerCalls } = createRuntime()

  const response = await runtime.respond({
    conversationId: 'conv-aberturas-register',
    scope: 'admin_internal',
    tenantKey: 'urucortinas',
    text: 'Necesito agregar estas aberturas al sistema: Corrediza Probba blanco vidrio simple de 1.10 x 1.20',
  })

  assert.equal(providerCalls.length, 1)
  assert.ok(
    providerCalls[0].tools.every((tool) => tool.name !== 'prepare_aberturas_quote'),
  )
  assert.ok(
    response.toolCalls.some(
      (entry) => entry.name === 'prepare_aberturas_insert' && entry.status === 'executed',
    ),
  )
  assert.ok(
    response.toolCalls.every((entry) => entry.name !== 'prepare_aberturas_quote'),
  )
})

test('admin_internal aberturas register flow keeps insert mode, preserves priced lines and flags missing price as pending', async () => {
  const { runtime, providerCalls } = createRuntime({
    generateResult: {
      text: [
        'Procesé la solicitud como alta al sistema.',
        'Listo para alta: Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234.',
        'Pendiente: Gala corrediza con DVH color negro de 1.90 x 2.20 porque falta precio.',
      ].join(' '),
      toolCalls: [],
    },
    backendOverrides: {
      prepareAberturasInsert: async () => ({
        itemCount: 2,
        readyItemCount: 1,
        summary:
          '1. VENTANA_CORREDIZA PROBBA 1100x1200 USD 234; 2. VENTANA_CORREDIZA GALA 1900x2200 pendiente price,currency',
        items: [
          {
            lineNumber: 1,
            familyId: 'VENTANA_CORREDIZA',
            serie: 'PROBBA',
            widthMm: 1100,
            heightMm: 1200,
            validForInsert: true,
            missingFields: [],
            insertPayload: {
              name: 'VENTANA_CORREDIZA PROBBA BLANCO 1100x1200',
              salePrice: 234,
              currency: 'USD',
            },
          },
          {
            lineNumber: 2,
            familyId: 'VENTANA_CORREDIZA',
            serie: 'GALA',
            widthMm: 1900,
            heightMm: 2200,
            validForInsert: false,
            missingFields: ['price', 'currency'],
            insertPayload: null,
          },
        ],
      }),
    },
  })

  const response = await runtime.respond({
    conversationId: 'conv-aberturas-register-rich',
    scope: 'admin_internal',
    tenantKey: 'urucortinas',
    text:
      'Necesito agregar estas aberturas al sistema: Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234; Gala corrediza con DVH color negro de 1.90 x 2.20',
  })

  assert.equal(providerCalls.length, 1)
  assert.ok(
    providerCalls[0].tools.every((tool) => tool.name !== 'prepare_aberturas_quote'),
  )
  assert.match(
    providerCalls[0].systemPrompt,
    /prepare_aberturas_insert: 1\. VENTANA_CORREDIZA PROBBA 1100x1200 USD 234; 2\. VENTANA_CORREDIZA GALA 1900x2200 pendiente price,currency/i,
  )
  assert.ok(
    response.toolCalls.some(
      (entry) => entry.name === 'prepare_aberturas_insert' && entry.status === 'executed',
    ),
  )
  assert.ok(
    response.toolCalls.every((entry) => entry.name !== 'prepare_aberturas_quote'),
  )
  assert.match(response.text, /alta al sistema/i)
  assert.match(response.text, /usd 234/i)
  assert.match(response.text, /falta precio/i)
  assert.doesNotMatch(response.text, /cotización disponible|precio estimado/i)
})

test('customer_public quote for the same abertura stays customer-safe and avoids internal registration language', async () => {
  const { runtime, backendClient, providerCalls } = createRuntime({
    generateResult: {
      text:
        'Para esa abertura podemos tomar como referencia una cotización de USD 234. Si quieres, un asesor puede continuar contigo para confirmar medidas, vidrio y disponibilidad.',
      toolCalls: [],
    },
  })

  backendClient.searchKnowledge = async () => ({
    items: [
      {
        id: 'doc-quote-1',
        title: 'UruCortinas · Cotizaciones de referencia de aberturas',
        scope: 'customer_public',
        sourceType: 'curated_document',
        summary:
          'Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234.',
        snippet:
          'Corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234.',
        score: 0.98,
      },
    ],
  })

  const response = await runtime.respond({
    conversationId: 'conv-aberturas-customer-quote',
    scope: 'customer_public',
    tenantKey: 'urucortinas',
    text:
      'Quiero cotización para una corrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120, con las mismas características.',
  })

  assert.equal(providerCalls.length, 1)
  assert.match(
    providerCalls[0].systemPrompt,
    /UruCortinas · Cotizaciones de referencia de aberturas/i,
  )
  assert.match(providerCalls[0].systemPrompt, /No podés ejecutar acciones administrativas internas/i)
  assert.ok(
    providerCalls[0].tools.every(
      (tool) =>
        tool.name !== 'prepare_aberturas_insert' &&
        tool.name !== 'prepare_aberturas_quote' &&
        tool.name !== 'parse_aberturas',
    ),
  )
  assert.equal(response.toolCalls.length, 0)
  assert.match(response.text, /cotización/i)
  assert.match(response.text, /usd 234/i)
  assert.doesNotMatch(response.text, /alta al sistema|lista de productos|payload|insert/i)
})

test('admin_internal presearches orders and categories for safe update flows', async () => {
  const { runtime, providerCalls } = createRuntime()

  const orderResponse = await runtime.respond({
    conversationId: 'conv-order-note',
    scope: 'admin_internal',
    tenantKey: 'urucortinas',
    text: 'agregar nota al pedido de Carlos Rodriguez indicando entrega por la tarde',
  })

  assert.equal(providerCalls.length, 1)
  assert.ok(
    orderResponse.toolCalls.some((entry) => entry.name === 'search_orders' && entry.status === 'executed'),
  )
  assert.match(orderResponse.text, /Coincidencias encontradas:/)

  const categoryResponse = await runtime.respond({
    conversationId: 'conv-category',
    scope: 'admin_internal',
    tenantKey: 'urucortinas',
    text: 'actualizar categoría rollers premium',
  })

  assert.ok(
    categoryResponse.toolCalls.some((entry) => entry.name === 'search_categories' && entry.status === 'executed'),
  )
})

test('customer_public provider fallback stays user-friendly and avoids internal provider details', async () => {
  const { runtime } = createRuntime()
  runtime.provider.generate = async () => {
    throw new Error('429 quota exceeded')
  }

  const response = await runtime.respond({
    conversationId: 'conv-public-fallback',
    scope: 'customer_public',
    tenantKey: 'urucortinas',
    text: 'Quiero saber más sobre cortinas roller',
  })

  assert.match(response.text, /Un asesor del equipo te indicará cómo continuar/i)
  assert.doesNotMatch(response.text, /cuota|proveedor|configuración|takeover/i)
  assert.equal(response.needsHuman, true)
})

test('admin_internal provider fallback stays operational without exposing provider diagnostics to the operator', async () => {
  const { runtime } = createRuntime()
  runtime.provider.generate = async () => {
    throw new Error('429 quota exceeded')
  }

  const response = await runtime.respond({
    conversationId: 'conv-admin-fallback',
    scope: 'admin_internal',
    tenantKey: 'urucortinas',
    text: 'crear pedido para Carlos Rodriguez',
  })

  assert.match(response.text, /no pude completar la asistencia automática/i)
  assert.doesNotMatch(response.text, /cuota|proveedor|configuración/i)
  assert.equal(response.needsHuman, true)
})

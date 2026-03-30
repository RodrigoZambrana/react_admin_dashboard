import test from 'node:test'
import assert from 'node:assert/strict'
import { detectIntent } from '../detect-intent.js'

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const findActionIntent = (input, actionCatalog = []) =>
  actionCatalog.find((entry) =>
    Array.isArray(entry.keywords)
      ? entry.keywords.some((keyword) => input.includes(normalizeText(keyword)))
      : false,
  ) || null

const deriveIntentKey = (role, input, actionIntent) => {
  const normalized = normalizeText(input)
  if (actionIntent?.key) {
    return actionIntent.key
  }
  if (role === 'admin_support' && /\b(ayuda|que podes hacer)\b/.test(normalized)) {
    return 'admin.capabilities'
  }
  if (/\bhola\b/.test(normalized)) {
    return role.startsWith('admin_') ? 'admin.light' : 'customer.light'
  }
  return role.startsWith('admin_') ? 'admin.other' : 'customer.other'
}

const inferActionIntentFromConversationContext = (currentInput, contextualInput, actionCatalog) => {
  if (/agregal[oa]/i.test(currentInput) && /probba|corrediza/i.test(contextualInput)) {
    return actionCatalog.find((entry) => entry.key === 'aberturas.register') || null
  }
  return null
}

test('detectIntent wraps legacy direct intent detection in a standard contract', () => {
  const detection = detectIntent({
    role: 'admin_support',
    input: 'Hola',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'admin.light')
  assert.equal(detection.source, 'rule')
  assert.equal(detection.confidence, 0.97)
  assert.deepEqual(detection.matchedKeywords, ['light_conversation'])
})

test('detectIntent keeps combined greetings in shared light handling', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Hola buenos días',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.light')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:greeting'))
})

test('detectIntent keeps actionable greetings out of shared light registry', () => {
  const actionCatalog = [
    {
      key: 'customers.create',
      keywords: ['registrar cliente', 'crear cliente'],
    },
  ]

  const detection = detectIntent({
    role: 'admin_support',
    input: 'Hola, registrar cliente Carlos',
    actionCatalog,
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customers.create')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('registry:catalog_keyword_match'))
})

test('detectIntent separates conceptual customer topic questions from exact product lookup', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Hola, tengo una duda sobre el DVH',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.topic_info')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:faq_topic'))
})

test('detectIntent treats business FAQ queries as customer topic info', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: '¿Cuál es su horario de atención?',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.topic_info')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:faq_topic'))
})

test('detectIntent treats broader payment concept queries as customer topic info', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: '¿Puedo abonar con débito o transferencia?',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.topic_info')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:faq_topic'))
})

test('detectIntent treats offering availability questions as customer topic info', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Quiero saber si tienen cortinas roller',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.topic_info')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:faq_topic'))
})

test('detectIntent treats consultar por topic questions as customer topic info', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Buenos días, quiero consultar por aberturas',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.topic_info')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:faq_topic'))
})

test('detectIntent resolves generic customer info openings without falling back to provider-led other', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Buenos días, mi nombre es Rodrigo y necesito información',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.clarify_request')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:generic_help_request'))
})

test('detectIntent can use nluAnalysis as a fallback for base customer intents', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'nadie responde nada',
    actionCatalog: [],
    inboundClassification: {
      category: 'other',
      confidence: 0.2,
      suggestedIntent: null,
      decisionPath: [],
    },
    nluAnalysis: {
      nlpIntent: 'frustration',
      nlpConfidence: 0.82,
    },
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.frustration')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('nlu:nlpjs:frustration'))
})

test('detectIntent can use configured hybrid intent registry as a customer fallback', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'me quedó medio raro el precio final',
    actionCatalog: [],
    inboundClassification: {
      category: 'other',
      confidence: 0.22,
      suggestedIntent: null,
      decisionPath: [],
    },
    customerHybridIntentRegistry: {
      rules: [
        {
          id: 'quote_clarification_runtime',
          intent: 'customer.quote',
          confidence: 0.92,
          priority: 80,
          examples: ['me quedó medio raro el precio final'],
          regexAny: ['\\bprecio\\b.*\\bfinal\\b'],
        },
      ],
    },
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.quote')
  assert.equal(detection.confidence, 0.92)
  assert.ok(
    detection.decisionPath.includes(
      'runtime:customer_hybrid_intent_registry:quote_clarification_runtime',
    ),
  )
})

test('detectIntent resolves post-sale service requests before generic customer fallback', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input:
      'Tengo instaladas unas cortinas con motor que necesitan service. Una dejó de funcionar y otra queremos moverla a otra ventana.',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.support_request')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:support_request'))
})

test('detectIntent resolves installation availability questions without mixing them with product info', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: '¿Cuándo tendrán disponibilidad para hacer la instalación?',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.schedule_request')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:schedule_request'))
})

test('detectIntent does not misclassify dejar pasar luz as a schedule request', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Busco de las que dejan pasar luz',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.notEqual(detection.intent, 'customer.schedule_request')
})

test('detectIntent resolves courtesy and acknowledgements as shared light customer turns', () => {
  const thanks = detectIntent({
    role: 'customer_public',
    input: 'gracias',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })
  const ack = detectIntent({
    role: 'customer_public',
    input: 'ok',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(thanks.intent, 'customer.light')
  assert.ok(thanks.decisionPath.includes('classifier:courtesy'))
  assert.equal(ack.intent, 'customer.light')
  assert.ok(ack.decisionPath.includes('classifier:courtesy'))
})

test('detectIntent treats punctuation-only customer input as unintelligible instead of empty fallback', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: '!!!???###',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.unintelligible')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:noise'))
})

test('detectIntent catches clearly unintelligible customer text without misclassifying it as a normal request', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'fsdgfgsjgfg sdfgsjgfdsjgf',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.unintelligible')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:unintelligible'))
})

test('detectIntent resolves incomplete customer requests before legacy fallback', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'quiero',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.incomplete')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:incomplete'))
})

test('detectIntent resolves customer multi-intent requests into a deterministic split flow intent', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Hola, quiero agendar una visita y también saber precios',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.multi_intent')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:multi_intent'))
})

test('detectIntent resolves sensitive customer complaints before calling the model', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Estoy muy molesto, nadie me responde',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.sensitive')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:sensitive'))
})

test('detectIntent resolves out-of-scope customer messages into a controlled intent', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: '¿Quién ganó el clásico?',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.out_of_scope')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:out_of_scope'))
})

test('detectIntent resolves contact requests before legacy fallback', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: '¿Tienen teléfono?',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.contact_info')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:contact'))
})

test('detectIntent requires authentication for protected customer account data before the model path', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Necesito saber el estado de mi pedido ORD-000154',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.auth_required')
  assert.ok(detection.decisionPath.includes('classifier:auth_required'))
})

test('detectIntent resolves owned document requests for authenticated customers before legacy fallback', () => {
  const detection = detectIntent({
    role: 'customer_authenticated',
    input: 'Necesito saber el estado de mi pedido ORD-000154',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.owned_document_request')
  assert.ok(detection.decisionPath.includes('classifier:owned_document_request'))
})

test('detectIntent resolves customer quote fallback from the central intent engine', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Quiero saber el precio de una corrediza negra con DVH',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.quote')
  assert.ok(detection.decisionPath.includes('registry:customer_quote_fallback'))
})

test('detectIntent resolves costo phrasing with specific product context as customer.quote', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'busco serie probba color negro, que costo tienen?',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.quote')
  assert.ok(detection.decisionPath.includes('registry:customer_quote_fallback'))
})

test('detectIntent resolves broad product family inquiries without relying on legacy customer fallback', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Estoy buscando cortinas',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.product_info')
  assert.ok(detection.decisionPath.includes('registry:customer_product_info_fallback'))
})

test('detectIntent does not turn standalone attachment artifacts into product_info fallback topics', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'IMG-20260318-WA0007.jpg (archivo adjunto)',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.notEqual(detection.intent, 'customer.product_info')
  assert.doesNotMatch(
    (detection.decisionPath || []).join(' '),
    /registry:customer_product_info_fallback/,
  )
})

test('detectIntent does not turn explicit reengagement markers into product_info fallback topics', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Perdón, me quedó para atrás el mensaje',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.notEqual(detection.intent, 'customer.product_info')
  assert.doesNotMatch(
    (detection.decisionPath || []).join(' '),
    /registry:customer_product_info_fallback/,
  )
})

test('detectIntent keeps broad family price questions in deterministic price guidance', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'precios cortnas',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.price_inquiry')
  assert.ok(detection.decisionPath.includes('classifier:price_inquiry'))
})

test('detectIntent resolves payment method questions even with pluralized pago wording', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'que medios de pagos aceptan',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.topic_info')
  assert.ok(detection.decisionPath.includes('classifier:faq_topic'))
})

test('detectIntent no longer uses legacy deriveIntentKey as the primary customer fallback', () => {
  const legacyCalls = []
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Quiero algo',
    actionCatalog: [],
    legacy: {
      deriveIntentKey(role, input, actionIntent) {
        legacyCalls.push({ role, input, actionIntent })
        return deriveIntentKey(role, input, actionIntent)
      },
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.incomplete')
  assert.equal(legacyCalls.length, 0)
  assert.ok(detection.decisionPath.includes('classifier:incomplete'))
})

test('detectIntent flags restricted customer attempts before legacy fallback', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'Quiero crear un producto roller blackout nuevo en el sistema',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'aberturas.register')
  assert.ok(detection.decisionPath.includes('policy:customer_restricted_aberturas'))
})

test('detectIntent resolves generic price inquiries before the model path', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'buenas nesecito saver precios',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.price_inquiry')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:price_inquiry'))
})

test('detectIntent resolves frustration signals before calling the model', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'esto no funciona nunca',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.frustration')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:frustration'))
})

test('detectIntent resolves rephrase requests without falling back to unknown', () => {
  const detection = detectIntent({
    role: 'customer_public',
    input: 'no entiendo',
    actionCatalog: [],
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'customer.rephrase_request')
  assert.equal(detection.source, 'rule')
  assert.ok(detection.decisionPath.includes('classifier:clarification_request'))
})

test('detectIntent marks contextual resolution as hybrid when using references and message elements', () => {
  const actionCatalog = [
    {
      key: 'aberturas.register',
      keywords: ['registrar abertura', 'agregar abertura'],
    },
  ]

  const detection = detectIntent({
    role: 'admin_operations',
    input: 'Agregala al sistema',
    reasoningInput:
      'Agregala al sistema\n\nCorrediza 2h2g serie probba blanco v4mm cierre fenix 110 x 120 usd 234',
    actionCatalog,
    referencedMessages: [
      {
        messageId: 'm-1',
        preview: 'Corrediza 2h2g serie probba blanco...',
      },
    ],
    messageContext: {
      usedElementCount: 1,
    },
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'aberturas.register')
  assert.equal(detection.source, 'hybrid')
  assert.equal(detection.actionIntent?.key, 'aberturas.register')
  assert.ok(detection.confidence >= 0.8)
  assert.ok(
    detection.decisionPath.includes('registry:aberturas_register_contextual'),
  )
  assert.ok(detection.decisionPath.includes('context:referenced_messages'))
  assert.ok(detection.decisionPath.includes('context:message_elements'))
})

test('detectIntent resolves operational intents from the central catalog before legacy fallback', () => {
  const actionCatalog = [
    {
      key: 'appointments.delete',
      keywords: ['eliminar cita', 'cancelar actividad'],
    },
    {
      key: 'payments.update_status',
      keywords: ['marcar pago', 'actualizar estado del pago'],
    },
  ]

  const detection = detectIntent({
    role: 'admin_operations',
    input: 'Marcar pago 15 como confirmado',
    actionCatalog,
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(detection.intent, 'payments.update_status')
  assert.equal(detection.actionIntent?.key, 'payments.update_status')
  assert.ok(detection.decisionPath.includes('registry:catalog_keyword_match'))
})

test('detectIntent resolves operational intents from explicit registry rules when wording is more natural than the catalog keywords', () => {
  const actionCatalog = [
    {
      key: 'appointments.update',
      keywords: ['actualizar cita', 'editar cita', 'mover cita'],
    },
    {
      key: 'customers.create',
      keywords: ['registrar cliente', 'crear cliente'],
    },
  ]

  const appointmentDetection = detectIntent({
    role: 'admin_support',
    input: 'Necesito reprogramar la visita del showroom para mañana',
    actionCatalog,
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(appointmentDetection.intent, 'appointments.update')
  assert.equal(appointmentDetection.actionIntent?.key, 'appointments.update')
  assert.ok(
    appointmentDetection.decisionPath.includes(
      'registry:appointments_update_rule',
    ),
  )

  const customerDetection = detectIntent({
    role: 'admin_sales',
    input: 'Quiero dar de alta una clienta nueva llamada Ana Pérez',
    actionCatalog,
    legacy: {
      deriveIntentKey,
      findActionIntent,
      inferActionIntentFromConversationContext,
    },
  })

  assert.equal(customerDetection.intent, 'customers.create')
  assert.equal(customerDetection.actionIntent?.key, 'customers.create')
  assert.ok(
    customerDetection.decisionPath.includes('registry:customers_create_rule'),
  )
})

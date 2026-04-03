import { buildIntentDetection } from './intent-types.js'
import { classifyInboundMessage } from './classify-inbound-message.js'
import { buildSemanticInfoIntent } from './semantic-info-intent.js'
import { extractExplicitSemanticSubject } from './semantic-turn-subject.js'
import {
  looksLikeCommercialConditionQuestion,
  looksLikeCustomerOrderStatusQuestion,
  looksLikeGenericPriceInquiry,
  looksLikeMaterialFollowUpRequest,
} from './customer-intent-patterns.js'
import { looksLikeCustomerScheduleAvailabilityRequest } from './customer-operational-heuristics.js'
import { hasTenantTopicSignal } from './customer-topic-taxonomy.js'
import { hasReengagementReferenceSignal } from './customer-semantic-signals.js'
import { matchCustomerHybridIntentRegistry } from './hybrid-intent-registry.js'
import {
  getBusinessRules,
  hasCatalogVocabularySignal,
  matchesBusinessRuleValue,
} from '../tenant-policy/runtime-tenant-policy.js'
import {
  STRUCTURED_CATALOG_REGISTER_INTENT,
  hasStructuredCatalogSignal,
} from '../structured-catalog-runtime.js'

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const ACTIONABLE_HINTS = [
  'registr',
  'crear',
  'actualiz',
  'elimin',
  'agendar',
  'cita',
  'pago',
  'pedido',
  'presupuesto',
  'cotiz',
  'catalog',
  'producto',
  'cliente',
  'stock',
]

const hasActionableHints = (normalizedInput) =>
  ACTIONABLE_HINTS.some((hint) => normalizedInput.includes(hint))

const LIGHT_ONLY_EXPRESSION =
  /^(?:hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|como estas|como andas|que tal|gracias|muchas gracias|ok|dale|perfecto|entendido|listo|saludos?)(?:\s+(?:hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|como estas|como andas|que tal|gracias|muchas gracias|ok|dale|perfecto|entendido|listo|saludos?))*$/u

const ADMIN_OPERATIONAL_ROLE_PREFIX = 'admin_'
const shouldUseLegacyDeriveIntent = (role) =>
  String(role || '').startsWith(ADMIN_OPERATIONAL_ROLE_PREFIX)

const CUSTOMER_INTENT_FALLBACK_RULES = [
  {
    intent: 'customer.topic_info',
    decisionPath: ['registry:customer_commercial_conditions'],
    matches: ({ normalizedInput }) => looksLikeCommercialConditionQuestion(normalizedInput),
  },
  {
    intent: 'customer.quote',
    decisionPath: ['registry:customer_quote_fallback'],
    matches: ({ normalizedInput }) => looksLikeGenericPriceInquiry(normalizedInput),
  },
  {
    intent: 'customer.order_status',
    decisionPath: ['registry:customer_order_status_fallback'],
    matches: ({ normalizedInput }) =>
      looksLikeCustomerOrderStatusQuestion(normalizedInput),
  },
  {
    intent: 'customer.support_request',
    decisionPath: ['registry:customer_support_fallback'],
    matches: ({ normalizedInput }) =>
      /\b(problema|soporte|reclamo|garantia|garantía|no funciona|no anda|service|servicio tecnico|servicio técnico|reparacion|reparación|reparar|dejo de funcionar|dejó de funcionar)\b/.test(
        normalizedInput,
      ),
  },
  {
    intent: 'customer.schedule_request',
    decisionPath: ['registry:customer_schedule_request_fallback'],
    matches: ({ normalizedInput, tenantRuntimePolicy }) =>
      looksLikeCustomerScheduleAvailabilityRequest(normalizedInput, {
        tenantRuntimePolicy,
      }),
  },
  {
    intent: 'customer.product_info',
    decisionPath: ['registry:customer_product_info_fallback'],
    matches: ({
      normalizedInput,
      rawInput,
      rawReasoningInput,
      inboundClassification,
      tenantTopicTaxonomy,
      tenantRuntimePolicy,
    }) => {
      const semanticSource = String(rawInput || rawReasoningInput || normalizedInput || '')
      if (
        /\barchivo adjunto\b/.test(normalizedInput) ||
        hasReengagementReferenceSignal(semanticSource)
      ) {
        return false
      }

      const semanticInfoIntent =
        inboundClassification?.semanticInfoIntent &&
        typeof inboundClassification.semanticInfoIntent === 'object'
          ? inboundClassification.semanticInfoIntent
          : buildSemanticInfoIntent({
              input: semanticSource,
              tenantTopicTaxonomy,
              tenantRuntimePolicy,
              followUpDetected: false,
            })
      const explicitSemanticSubject = extractExplicitSemanticSubject({
        input: semanticSource,
        tenantTopicTaxonomy,
        tenantRuntimePolicy,
      }).explicitSubject

      return (
        hasTenantTopicSignal(normalizedInput, tenantTopicTaxonomy) ||
        Boolean(semanticInfoIntent?.subject?.label) ||
        Boolean(explicitSemanticSubject?.label) ||
        looksLikeMaterialFollowUpRequest(semanticSource)
      )
    },
  },
]

const CUSTOMER_NLP_INTENT_MAP = {
  greeting: 'customer.light',
  courtesy: 'customer.light',
  generic_help_request: 'customer.clarify_request',
  product_inquiry: 'customer.product_info',
  price_inquiry: 'customer.quote',
  payment_methods: 'customer.topic_info',
  business_hours: 'customer.topic_info',
  location: 'customer.topic_info',
  contact_request: 'customer.contact_info',
  delivery_shipping: 'customer.topic_info',
  stock_availability: 'customer.topic_info',
  comparison: 'customer.topic_info',
  appointment_booking: 'customer.schedule_request',
  order_status: 'customer.order_status',
  support_request: 'customer.support_request',
  frustration: 'customer.frustration',
  clarification_request: 'customer.rephrase_request',
  out_of_scope: 'customer.out_of_scope',
}

const CUSTOMER_RESTRICTED_ACTION_RULES = [
  {
    intent: STRUCTURED_CATALOG_REGISTER_INTENT,
    decisionPath: ['policy:customer_restricted_structured_catalog'],
    matches: ({ normalizedInput, tenantRuntimePolicy }) =>
      /(agregar|registrar|dar de alta|alta de|crear|cargar).*(producto|productos|catalogo|catálogo).*(sistema|lista de productos)?/.test(
        normalizedInput,
      ) ||
      (/(agregar|registrar|dar de alta|alta de|crear|cargar)/.test(normalizedInput) &&
        hasStructuredCatalogSignal(normalizedInput, tenantRuntimePolicy)),
  },
  {
    intent: 'catalog.manage',
    decisionPath: ['policy:customer_restricted_catalog'],
    matches: ({ normalizedInput }) =>
      /(actualizar|editar|modificar|publicar|archivar|crear).*(producto|productos|categoria|categoría|stock)/.test(
        normalizedInput,
      ),
  },
  {
    intent: 'customers.manage',
    decisionPath: ['policy:customer_restricted_customers'],
    matches: ({ normalizedInput }) =>
      /(actualizar|editar|modificar|registrar).*(cliente|correo|telefono|teléfono|direccion|dirección)/.test(
        normalizedInput,
      ),
  },
  {
    intent: 'orders.manage',
    decisionPath: ['policy:customer_restricted_orders'],
    matches: ({ normalizedInput }) =>
      /(crear|registrar|editar|actualizar|cancelar|modificar).*(pedido|orden)/.test(
        normalizedInput,
      ),
  },
  {
    intent: 'payments.manage',
    decisionPath: ['policy:customer_restricted_payments'],
    matches: ({ normalizedInput, tenantRuntimePolicy }) =>
      /(marcar|confirmar|actualizar|anular|rechazar|modificar).*(pago|cobro)/.test(
        normalizedInput,
      ) ||
      (/(marcar|confirmar|actualizar|anular|rechazar|modificar)/.test(normalizedInput) &&
        matchesBusinessRuleValue(
          normalizedInput,
          getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [],
        )),
  },
]

const findCatalogActionIntent = (normalizedInput, actionCatalog = []) => {
  let bestMatch = null
  let bestScore = -1

  for (const entry of actionCatalog) {
    if (!Array.isArray(entry?.keywords)) {
      continue
    }

    for (const keyword of entry.keywords) {
      const normalizedKeyword = normalizeText(keyword)
      if (!normalizedKeyword || !normalizedInput.includes(normalizedKeyword)) {
        continue
      }

      if (normalizedKeyword.length > bestScore) {
        bestMatch = entry
        bestScore = normalizedKeyword.length
      }
    }
  }

  return bestMatch
}

const findActionIntentByKey = (actionCatalog = [], key) =>
  actionCatalog.find((entry) => entry?.key === key) || null

const OPERATIONAL_RULES = [
  {
    key: 'appointments.create',
    keywords: ['appointments_create_rule'],
    confidence: 0.91,
    decisionPath: ['registry:appointments_create_rule'],
    matches: ({ normalizedInput }) =>
      /(agendar|agenda|crear|coordinar|programar)/.test(normalizedInput) &&
      /(cita|visita|actividad|reunion|reunion showroom|showroom)/.test(
        normalizedInput,
      ),
  },
  {
    key: 'appointments.update',
    keywords: ['appointments_update_rule'],
    confidence: 0.9,
    decisionPath: ['registry:appointments_update_rule'],
    matches: ({ normalizedInput }) =>
      /(reprogramar|mover|editar|actualizar|modificar)/.test(normalizedInput) &&
      /(cita|visita|actividad|reunion|showroom)/.test(normalizedInput),
  },
  {
    key: 'appointments.delete',
    keywords: ['appointments_delete_rule'],
    confidence: 0.91,
    decisionPath: ['registry:appointments_delete_rule'],
    matches: ({ normalizedInput }) =>
      /(eliminar|borrar|cancelar|suspender)/.test(normalizedInput) &&
      /(cita|visita|actividad|reunion|showroom)/.test(normalizedInput),
  },
  {
    key: 'customers.create',
    keywords: ['customers_create_rule'],
    confidence: 0.9,
    decisionPath: ['registry:customers_create_rule'],
    matches: ({ normalizedInput }) =>
      /(crear|registrar|dar de alta|alta de|nuevo|nueva)/.test(normalizedInput) &&
      /\bclient[ea]\b/.test(normalizedInput),
  },
  {
    key: 'customers.update',
    keywords: ['customers_update_rule'],
    confidence: 0.89,
    decisionPath: ['registry:customers_update_rule'],
    matches: ({ normalizedInput }) =>
      /(actualizar|editar|modificar|cambiar)/.test(normalizedInput) &&
      /\bclient[ea]\b/.test(normalizedInput),
  },
  {
    key: 'products.create',
    keywords: ['products_create_rule'],
    confidence: 0.89,
    decisionPath: ['registry:products_create_rule'],
    matches: ({ normalizedInput }) =>
      /(crear|registrar|dar de alta|alta de|nuevo|nueva|cargar)/.test(
        normalizedInput,
      ) && /(producto|stock|catalogo|catalogo de productos)/.test(normalizedInput),
  },
  {
    key: 'products.update',
    keywords: ['products_update_rule'],
    confidence: 0.88,
    decisionPath: ['registry:products_update_rule'],
    matches: ({ normalizedInput }) =>
      /(actualizar|editar|modificar|cambiar|publicar|archivar|ajustar)/.test(
        normalizedInput,
      ) && /(producto|stock|catalogo|catalogo de productos)/.test(normalizedInput),
  },
  {
    key: 'payments.update_status',
    keywords: ['payments_update_status_rule'],
    confidence: 0.9,
    decisionPath: ['registry:payments_update_status_rule'],
    matches: ({ normalizedInput }) =>
      /(marcar|cambiar|actualizar|poner)/.test(normalizedInput) &&
      /\bpago\b/.test(normalizedInput) &&
      /(confirmad|pendient|rechazad|cancelad|anulad|aprobad|pagad)/.test(
        normalizedInput,
      ),
  },
  {
    key: STRUCTURED_CATALOG_REGISTER_INTENT,
    keywords: ['structured_catalog_register_rule'],
    confidence: 0.91,
    decisionPath: ['registry:structured_catalog_register_rule'],
    matches: ({
      normalizedInput,
      normalizedReasoningInput,
      tenantRuntimePolicy,
    }) =>
      /(agregar|registrar|dar de alta|alta de|cargar)/.test(normalizedInput) &&
      hasStructuredCatalogSignal(normalizedReasoningInput, tenantRuntimePolicy) &&
      /(sistema|lista de productos|producto|productos)/.test(
        normalizedReasoningInput,
      ),
  },
  {
    key: STRUCTURED_CATALOG_REGISTER_INTENT,
    keywords: ['contextual_structured_catalog_register'],
    confidence: 0.93,
    decisionPath: ['registry:structured_catalog_register_contextual'],
    matches: ({
      normalizedInput,
      normalizedReasoningInput,
      tenantRuntimePolicy,
    }) =>
      /(agregar|agrega|agregalo|agregala|registrar|registralo|registrala|cargar|cargalo|cargala|dar de alta|alta)/.test(
        normalizedInput,
      ) &&
      hasStructuredCatalogSignal(normalizedReasoningInput, tenantRuntimePolicy),
  },
]

const buildCustomerIntentFromClassification = (classification = null) => {
  const suggestedIntent = classification?.suggestedIntent
  if (!suggestedIntent) {
    return null
  }

  const keywordMap = {
    'customer.topic_info': 'customer_topic_info',
    'customer.contact_info': 'customer_contact_info',
    'customer.price_inquiry': 'customer_price_inquiry',
    'customer.support_request': 'customer_support_request',
    'customer.schedule_request': 'customer_schedule_request',
    'customer.auth_required': 'customer_auth_required',
    'customer.owned_document_request': 'customer_owned_document_request',
    'customer.private_account_data': 'customer_private_account_data',
    'customer.clarify_request': 'customer_clarify_request',
    'customer.rephrase_request': 'customer_rephrase_request',
    'customer.unintelligible': 'customer_unintelligible',
    'customer.incomplete': 'customer_incomplete',
    'customer.multi_intent': 'customer_multi_intent',
    'customer.repetition': 'customer_repetition',
    'customer.confirmation': 'customer_confirmation',
    'customer.cancellation': 'customer_cancellation',
    'customer.frustration': 'customer_frustration',
    'customer.sensitive': 'customer_sensitive',
    'customer.out_of_scope': 'customer_out_of_scope',
    'customer.light': 'light_conversation',
  }

  const defaultConfidence =
    typeof classification?.confidence === 'number'
      ? classification.confidence
      : suggestedIntent === 'customer.light'
        ? 0.97
        : 0.9

  return {
    intent: suggestedIntent,
    keywords: keywordMap[suggestedIntent] ? [keywordMap[suggestedIntent]] : [],
    confidence: defaultConfidence,
    decisionPath: Array.isArray(classification?.decisionPath)
      ? classification.decisionPath
      : [],
  }
}

const matchRegisteredIntent = ({
  role,
  normalizedInput,
  directActionIntent,
  inboundClassification = null,
}) => {
  if (directActionIntent?.key) {
    return null
  }

  const isAdmin = String(role || '').startsWith('admin_')

  if (!isAdmin) {
    const classifiedIntent = buildCustomerIntentFromClassification(
      inboundClassification,
    )
    if (classifiedIntent) {
      return classifiedIntent
    }
  }

  const matchesGreetingPattern =
    /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches)$/.test(
      normalizedInput,
    ) ||
    /^(hola\s+)?(buen dia|buenos dias|buenas tardes|buenas noches)(\s+(como estas|como andas|que tal))?$/.test(
      normalizedInput,
    ) ||
    /^(hola\s+)?(que tal|como estas|como andas)$/.test(normalizedInput)
  const isGreetingOnly = matchesGreetingPattern && !hasActionableHints(normalizedInput)
  const isThanksOnly = /^(gracias|muchas gracias|perfecto gracias)$/.test(
    normalizedInput,
  )
  const isAckOnly = /^(ok|dale|perfecto|entendido)$/.test(normalizedInput)
  const isStatusCheck = /^(como estas|como andas|estas ahi)$/.test(normalizedInput)
  const isLightOnly =
    !hasActionableHints(normalizedInput) &&
    LIGHT_ONLY_EXPRESSION.test(normalizedInput)

  if (isGreetingOnly || isThanksOnly || isAckOnly || isStatusCheck || isLightOnly) {
    return {
      intent: isAdmin ? 'admin.light' : 'customer.light',
      keywords: ['light_conversation'],
      confidence: 0.97,
      decisionPath: ['registry:shared_light'],
    }
  }

  if (
    isAdmin &&
    /\b(ayuda|que podes hacer|que puedes hacer|alcance|que haces|como me ayudas)\b/.test(
      normalizedInput,
    ) &&
    !hasActionableHints(normalizedInput)
  ) {
    return {
      intent: 'admin.capabilities',
      keywords: ['capabilities_request'],
      confidence: 0.98,
      decisionPath: ['registry:admin_capabilities'],
    }
  }

  return null
}

const matchOperationalRegistryIntent = ({
  role,
  normalizedInput,
  normalizedReasoningInput,
  actionCatalog,
  directActionIntent,
  tenantRuntimePolicy = null,
}) => {
  const isAdmin =
    String(role || '').startsWith(ADMIN_OPERATIONAL_ROLE_PREFIX) ||
    role === 'superadmin'
  if (!isAdmin || directActionIntent?.key) {
    return null
  }

  for (const rule of OPERATIONAL_RULES) {
    if (
      !rule.matches({
        normalizedInput,
        normalizedReasoningInput,
        tenantRuntimePolicy,
      })
    ) {
      continue
    }

    const actionIntent = findActionIntentByKey(actionCatalog, rule.key)
    if (actionIntent) {
      return {
        intent: rule.key,
        actionIntent,
        keywords: rule.keywords,
        confidence: rule.confidence,
        decisionPath: rule.decisionPath,
      }
    }
  }

  return null
}

const matchCustomerRestrictedIntent = ({
  role,
  normalizedInput,
  directActionIntent,
  tenantRuntimePolicy = null,
}) => {
  if (String(role || '').startsWith(ADMIN_OPERATIONAL_ROLE_PREFIX) || directActionIntent?.key) {
    return null
  }

  for (const rule of CUSTOMER_RESTRICTED_ACTION_RULES) {
    if (rule.matches({ normalizedInput, tenantRuntimePolicy })) {
      return rule
    }
  }

  return null
}

const matchCustomerFallbackIntent = ({
  role,
  rawInput = '',
  rawReasoningInput = '',
  normalizedInput,
  normalizedReasoningInput,
  inboundClassification,
  directActionIntent,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
}) => {
  if (
    String(role || '').startsWith(ADMIN_OPERATIONAL_ROLE_PREFIX) ||
    directActionIntent?.key ||
    inboundClassification?.suggestedIntent
  ) {
    return null
  }

  const restrictedRule = matchCustomerRestrictedIntent({
    role,
    normalizedInput,
    directActionIntent,
    tenantRuntimePolicy,
  })
  if (restrictedRule) {
    return restrictedRule
  }

  for (const rule of CUSTOMER_INTENT_FALLBACK_RULES) {
    if (
      rule.matches({
        rawInput,
        rawReasoningInput,
        normalizedInput,
        normalizedReasoningInput,
        inboundClassification,
        tenantTopicTaxonomy,
        tenantRuntimePolicy,
      })
    ) {
      return rule
    }
  }

  return null
}

const matchConfiguredCustomerFallbackIntent = ({
  role,
  input,
  reasoningInput = null,
  inboundClassification,
  directActionIntent,
  customerHybridIntentRegistry = [],
}) => {
  if (
    String(role || '').startsWith(ADMIN_OPERATIONAL_ROLE_PREFIX) ||
    directActionIntent?.key ||
    inboundClassification?.suggestedIntent
  ) {
    return null
  }

  return matchCustomerHybridIntentRegistry({
    registry: customerHybridIntentRegistry,
    input,
    reasoningInput,
  })
}

const detectLightIntentKeywords = (intent) => {
  if (intent === 'admin.light' || intent === 'customer.light') {
    return ['light_conversation']
  }
  if (intent === 'admin.capabilities') {
    return ['capabilities_request']
  }
  return []
}

const matchNlpCustomerIntent = ({
  role,
  normalizedInput,
  directActionIntent,
  inboundClassification = null,
  tenantTopicTaxonomy = [],
  nluAnalysis = null,
}) => {
  if (
    String(role || '').startsWith(ADMIN_OPERATIONAL_ROLE_PREFIX) ||
    directActionIntent?.key ||
    inboundClassification?.suggestedIntent
  ) {
    return null
  }

  const nlpIntent = CUSTOMER_NLP_INTENT_MAP[String(nluAnalysis?.nlpIntent || '')]
  const nlpConfidence =
    typeof nluAnalysis?.nlpConfidence === 'number' ? nluAnalysis.nlpConfidence : 0
  const tenantTopicSignal = hasTenantTopicSignal(normalizedInput, tenantTopicTaxonomy)
  if (!nlpIntent || nlpConfidence < 0.74) {
    return null
  }

  if (tenantTopicSignal) {
    return null
  }

  return {
    intent: nlpIntent,
    keywords: [`nlp_${String(nluAnalysis.nlpIntent).toLowerCase()}`],
    confidence: Math.min(Math.max(nlpConfidence, 0), 0.89),
    decisionPath: [`nlu:nlpjs:${String(nluAnalysis.nlpIntent).toLowerCase()}`],
  }
}

const matchClassifiedCustomerIntent = ({
  role,
  directActionIntent,
  inboundClassification = null,
}) => {
  if (
    String(role || '').startsWith(ADMIN_OPERATIONAL_ROLE_PREFIX) ||
    directActionIntent?.key ||
    !inboundClassification?.suggestedIntent
  ) {
    return null
  }

  return {
    intent: inboundClassification.suggestedIntent,
    keywords: [String(inboundClassification.category || 'classified_customer_intent')],
    confidence:
      typeof inboundClassification.confidence === 'number'
        ? Math.min(Math.max(inboundClassification.confidence, 0), 0.93)
        : 0.72,
    decisionPath: Array.isArray(inboundClassification.decisionPath)
      ? inboundClassification.decisionPath
      : ['classifier:suggested_intent'],
  }
}

const inferConfidence = ({ intent, directActionIntent, actionIntent, source }) => {
  if (directActionIntent) {
    return 0.92
  }
  if (actionIntent) {
    return source === 'hybrid' ? 0.84 : 0.88
  }
  if (intent === 'admin.capabilities') {
    return 0.98
  }
  if (intent === 'admin.light' || intent === 'customer.light') {
    return 0.97
  }
  return source === 'hybrid' ? 0.64 : 0.58
}

const matchKeywords = (input, actionIntent) => {
  if (!actionIntent || !Array.isArray(actionIntent.keywords)) {
    return []
  }

  const normalizedInput = normalizeText(input)
  return actionIntent.keywords.filter((keyword) =>
    normalizedInput.includes(normalizeText(keyword)),
  )
}

export const detectIntent = ({
  role,
  input,
  reasoningInput = null,
  actionCatalog = [],
  referencedMessages = [],
  messageContext = null,
  inboundClassification = null,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
  nluAnalysis = null,
  customerHybridIntentRegistry = [],
  legacy = {},
}) => {
  const effectiveInput = String(input || '')
  const effectiveReasoningInput =
    reasoningInput == null ? effectiveInput : String(reasoningInput)

  const normalizedInput = normalizeText(effectiveInput)
  const normalizedReasoningInput = normalizeText(effectiveReasoningInput)
  const resolvedInboundClassification =
    inboundClassification ||
    classifyInboundMessage({
      role,
      input: effectiveInput,
      tenantTopicTaxonomy,
      tenantRuntimePolicy,
    })
  const directActionIntent = findCatalogActionIntent(normalizedInput, actionCatalog)
  const customerFallbackIntent = matchCustomerFallbackIntent({
    role,
    rawInput: effectiveInput,
    rawReasoningInput: effectiveReasoningInput,
    normalizedInput,
    normalizedReasoningInput,
    inboundClassification: resolvedInboundClassification,
    directActionIntent,
    tenantTopicTaxonomy,
    tenantRuntimePolicy,
  })
  const configuredCustomerFallbackIntent = matchConfiguredCustomerFallbackIntent({
    role,
    input: effectiveInput,
    reasoningInput: effectiveReasoningInput,
    inboundClassification: resolvedInboundClassification,
    directActionIntent,
    customerHybridIntentRegistry,
  })
  const registryIntent = matchRegisteredIntent({
    role,
    normalizedInput,
    directActionIntent,
    inboundClassification: resolvedInboundClassification,
  })
  const operationalRegistryIntent = matchOperationalRegistryIntent({
    role,
    normalizedInput,
    normalizedReasoningInput,
    actionCatalog,
    directActionIntent,
    tenantRuntimePolicy,
  })
  const nlpCustomerIntent = matchNlpCustomerIntent({
    role,
    normalizedInput,
    directActionIntent,
    inboundClassification: resolvedInboundClassification,
    tenantTopicTaxonomy,
    nluAnalysis,
  })
  const classifiedCustomerIntent = matchClassifiedCustomerIntent({
    role,
    directActionIntent,
    inboundClassification: resolvedInboundClassification,
  })
  const preferredCustomerFallbackIntent =
    configuredCustomerFallbackIntent ||
    (nlpCustomerIntent &&
    (!customerFallbackIntent ||
      customerFallbackIntent.intent === 'customer.product_info') &&
    nlpCustomerIntent.intent !== customerFallbackIntent?.intent
      ? nlpCustomerIntent
      : customerFallbackIntent) ||
    (classifiedCustomerIntent &&
    (!customerFallbackIntent ||
      customerFallbackIntent.intent === 'customer.product_info') &&
    classifiedCustomerIntent.intent !== customerFallbackIntent?.intent
      ? classifiedCustomerIntent
      : customerFallbackIntent) ||
    classifiedCustomerIntent
  const directIntent =
    preferredCustomerFallbackIntent?.intent ||
    (shouldUseLegacyDeriveIntent(role) && legacy.deriveIntentKey
      ? legacy.deriveIntentKey(
          role,
          effectiveInput,
          directActionIntent ?? operationalRegistryIntent?.actionIntent ?? null,
          tenantRuntimePolicy,
        )
      : 'unknown')

  let actionIntent = directActionIntent ?? operationalRegistryIntent?.actionIntent ?? null
  const decisionPath = [
    ...(registryIntent?.decisionPath ?? []),
    ...(preferredCustomerFallbackIntent?.decisionPath ?? []),
    ...(operationalRegistryIntent?.decisionPath ?? []),
  ]

  if (directActionIntent) {
    decisionPath.push('registry:catalog_keyword_match')
  }

  if (!actionIntent && legacy.inferActionIntentFromConversationContext) {
    actionIntent = legacy.inferActionIntentFromConversationContext(
      effectiveInput,
      effectiveReasoningInput,
      actionCatalog,
      tenantRuntimePolicy,
    )
    if (actionIntent) {
      decisionPath.push('legacy:inferActionIntentFromConversationContext')
    }
  }

  if (!actionIntent) {
    actionIntent = findCatalogActionIntent(normalizedReasoningInput, actionCatalog)
    if (actionIntent) {
      decisionPath.push('registry:catalog_keyword_match(reasoning)')
    }
  }

  if (!actionIntent && legacy.findActionIntent) {
    actionIntent = legacy.findActionIntent(normalizedInput, actionCatalog)
    if (actionIntent) {
      decisionPath.push('legacy:findActionIntent')
    }
  }

  if (!actionIntent && legacy.findActionIntent) {
    actionIntent = legacy.findActionIntent(normalizedReasoningInput, actionCatalog)
    if (actionIntent) {
      decisionPath.push('legacy:findActionIntent(reasoning)')
    }
  }

  const intent = registryIntent?.intent
    ? registryIntent.intent
    : preferredCustomerFallbackIntent?.intent
      ? preferredCustomerFallbackIntent.intent
    : operationalRegistryIntent?.intent
      ? operationalRegistryIntent.intent
    : shouldUseLegacyDeriveIntent(role) && legacy.deriveIntentKey
      ? legacy.deriveIntentKey(
          role,
          effectiveReasoningInput,
          actionIntent,
          tenantRuntimePolicy,
        )
      : directIntent || 'customer.other'

  const usedContextualSignals =
    effectiveReasoningInput !== effectiveInput ||
    (Array.isArray(referencedMessages) && referencedMessages.length > 0) ||
    Number(messageContext?.usedElementCount || 0) > 0

  const source = usedContextualSignals ? 'hybrid' : 'rule'
  const matchedKeywords = registryIntent?.keywords?.length
    ? registryIntent.keywords
    : preferredCustomerFallbackIntent?.keywords?.length
      ? preferredCustomerFallbackIntent.keywords
    : operationalRegistryIntent?.keywords?.length
      ? operationalRegistryIntent.keywords
    : actionIntent
      ? matchKeywords(effectiveReasoningInput, actionIntent)
      : detectLightIntentKeywords(intent)

  if (!decisionPath.length) {
    decisionPath.push(
      shouldUseLegacyDeriveIntent(role)
        ? 'legacy:deriveIntentKey'
        : 'fallback:customer.other',
    )
  }

  if (usedContextualSignals) {
    decisionPath.push('context:reasoning_input')
  }
  if (Array.isArray(referencedMessages) && referencedMessages.length > 0) {
    decisionPath.push('context:referenced_messages')
  }
  if (Number(messageContext?.usedElementCount || 0) > 0) {
    decisionPath.push('context:message_elements')
  }

  return buildIntentDetection({
    intent,
    confidence:
      registryIntent?.confidence ??
      preferredCustomerFallbackIntent?.confidence ??
      inferConfidence({ intent, directActionIntent, actionIntent, source }),
    source,
    actionIntent,
    directActionIntent,
    matchedKeywords,
    decisionPath,
    referencedMessages,
  })
}

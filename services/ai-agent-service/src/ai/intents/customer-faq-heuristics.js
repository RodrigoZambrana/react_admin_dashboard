import {
  looksLikeGenericPriceInquiry,
  looksLikePaymentOperationalUpdate,
  looksLikeQuoteRequirementsQuestion,
} from './customer-intent-patterns.js'
import { hasTenantTopicSignal } from './customer-topic-taxonomy.js'
import {
  detectStandaloneAttachmentArtifactKind,
  hasMultimodalPlaceholderSignal,
  hasQuantityOnlyFollowUpSignal,
  hasReengagementReferenceSignal,
} from './customer-semantic-signals.js'
import {
  getBusinessRules,
  getVocabulary,
} from '../tenant-policy/runtime-tenant-policy.js'
import { getStaticLanguagePolicy } from '../../../../shared/language-policy/index.js'
import {
  extractCurrentCustomerTurnText,
  extractSemanticCustomerTurnText,
  normalizeSemanticCustomerTurnText,
} from '../ingress/customer-turn-normalization.js'

const normalizeText = (value) =>
  normalizeSemanticCustomerTurnText(value)

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const BASE_LANGUAGE_POLICY = getStaticLanguagePolicy('es-default')

const compileRegex = (entry, fallbackFlags = 'u') => {
  if (!entry || typeof entry !== 'object' || typeof entry.source !== 'string') {
    return null
  }

  return new RegExp(entry.source, entry.flags || fallbackFlags)
}

const compileRegexList = (entries = [], fallbackFlags = 'u') =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => compileRegex(entry, fallbackFlags))
    .filter(Boolean)

const WEB_LEAD_INTRO_PREFIX_REGEX = compileRegex(
  BASE_LANGUAGE_POLICY.webLeadIntroPattern,
  'u',
)

const stripWebLeadIntro = (value = '') => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return ''
  }

  const prefixMatch = normalized.match(WEB_LEAD_INTRO_PREFIX_REGEX)
  if (!prefixMatch) {
    return normalized
  }

  const remainder = normalized.slice(prefixMatch[0].length).trim()
  return remainder || normalized
}

const CUSTOMER_TOPIC_PATTERNS = compileRegexList(
  BASE_LANGUAGE_POLICY.customerTopicPatterns,
  'u',
)

const BASE_BUSINESS_FAQ_DEFINITIONS = (
  Array.isArray(BASE_LANGUAGE_POLICY.businessFaqDefinitions)
    ? BASE_LANGUAGE_POLICY.businessFaqDefinitions
    : []
).map((definition) => ({
  subtype: typeof definition?.subtype === 'string' ? definition.subtype : null,
  directPatterns: compileRegexList(definition?.directPatterns, 'u'),
  conceptStems: Array.isArray(definition?.conceptStems)
    ? definition.conceptStems
    : [],
  queryStems: Array.isArray(definition?.queryStems)
    ? definition.queryStems
    : [],
  knowledgeFactTypes: Array.isArray(definition?.knowledgeFactTypes)
    ? definition.knowledgeFactTypes
    : [],
  knowledgePageKinds: Array.isArray(definition?.knowledgePageKinds)
    ? definition.knowledgePageKinds
    : [],
  knowledgeTagStems: Array.isArray(definition?.knowledgeTagStems)
    ? definition.knowledgeTagStems
    : [],
  knowledgeCueStems: Array.isArray(definition?.knowledgeCueStems)
    ? definition.knowledgeCueStems
    : [],
})).filter((definition) => definition.subtype)

const getConfiguredFaqSignalTerms = (tenantRuntimePolicy = null, subtype = null) => {
  if (typeof subtype !== 'string' || !subtype.trim()) {
    return []
  }

  const faqSignals = getVocabulary(tenantRuntimePolicy)?.faqSignals
  if (!faqSignals || typeof faqSignals !== 'object') {
    return []
  }

  const configuredTerms = faqSignals[subtype]
  return Array.isArray(configuredTerms)
    ? configuredTerms
        .map((entry) => normalizeText(entry))
        .filter(Boolean)
    : []
}

const PAYMENT_METHOD_SHORT_FOLLOW_UP_PATTERNS = compileRegexList(
  BASE_LANGUAGE_POLICY.paymentMethodShortFollowUpPatterns,
  'iu',
)

const PAYMENT_METHOD_CONTEXT_INTENTS = new Set(
  Array.isArray(BASE_LANGUAGE_POLICY.paymentMethodContextIntents)
    ? BASE_LANGUAGE_POLICY.paymentMethodContextIntents
    : [],
)

const looksLikeShortPaymentMethodFollowUp = (input, options = {}) => {
  const normalizedInput = normalizeText(input)
  if (!normalizedInput || looksLikePaymentOperationalUpdate(normalizedInput)) {
    return false
  }

  if (
    PAYMENT_METHOD_SHORT_FOLLOW_UP_PATTERNS.some((pattern) =>
      pattern.test(normalizedInput),
    )
  ) {
    return true
  }

  const previousIntentKey =
    typeof options?.previousIntentKey === 'string'
      ? options.previousIntentKey.trim()
      : ''

  if (!PAYMENT_METHOD_CONTEXT_INTENTS.has(previousIntentKey)) {
    return false
  }

  const inputTokens = tokenizeSignalText(normalizedInput)
  const paymentDefinition = BASE_BUSINESS_FAQ_DEFINITIONS.find(
    (definition) => definition.subtype === 'payment_methods',
  )
  if (!paymentDefinition) {
    return false
  }

  const conceptMatches = countStemMatches(
    inputTokens,
    paymentDefinition.conceptStems,
  )
  const shortQuestionLike =
    normalizedInput.length <= 48 &&
    (/^\s*y\b/.test(normalizedInput) ||
      /\?$/.test(String(input || '').trim()) ||
      /\bcon\b/.test(normalizedInput))

  return conceptMatches >= 1 && shortQuestionLike
}

const CUSTOMER_TRANSACTIONAL_PATTERNS = compileRegexList(
  BASE_LANGUAGE_POLICY.customerTransactionalPatterns,
  'u',
)

const BASE_COMMON_CUSTOMER_SIGNAL_TOKENS = new Set(
  Array.isArray(BASE_LANGUAGE_POLICY.commonCustomerSignalTokens)
    ? BASE_LANGUAGE_POLICY.commonCustomerSignalTokens
    : [],
)

const buildCommonCustomerSignalTokens = (tenantRuntimePolicy = null) =>
  new Set([
    ...BASE_COMMON_CUSTOMER_SIGNAL_TOKENS,
    ...((getVocabulary(tenantRuntimePolicy)?.genericCustomerSignalTerms ?? [])
      .flatMap((entry) => normalizeText(entry).split(/\s+/u))
      .filter(Boolean)),
    ...((getVocabulary(tenantRuntimePolicy)?.catalogTerms ?? [])
      .flatMap((entry) => normalizeText(entry).split(/\s+/u))
      .filter((entry) => entry.length >= 3)),
    ...((getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [])
      .flatMap((entry) => normalizeText(entry).split(/\s+/u))
      .filter((entry) => entry.length >= 3)),
  ])

const PRIVATE_ACCOUNT_FAQ_GUARD_PATTERNS = compileRegexList(
  BASE_LANGUAGE_POLICY.privateAccountFaqGuardPatterns,
  'u',
)

const CUSTOMER_AVAILABILITY_PATTERNS = compileRegexList(
  BASE_LANGUAGE_POLICY.availabilityPatterns,
  'i',
)

const CUSTOMER_VARIANT_QUESTION_PATTERNS = compileRegexList(
  BASE_LANGUAGE_POLICY.variantQuestionPatterns,
  'i',
)

const CUSTOMER_DEFINITION_PATTERNS = compileRegexList(
  BASE_LANGUAGE_POLICY.definitionPatterns,
  'i',
)

const CUSTOMER_BENEFITS_PATTERNS = compileRegexList(
  BASE_LANGUAGE_POLICY.benefitsPatterns,
  'i',
)

const CUSTOMER_MAINTENANCE_PATTERNS = compileRegexList(
  BASE_LANGUAGE_POLICY.maintenancePatterns,
  'i',
)

const looksLikePrivateAccountFaqGuard = (input) => {
  const normalizedInput = normalizeText(input)
  if (!normalizedInput) {
    return false
  }

  return PRIVATE_ACCOUNT_FAQ_GUARD_PATTERNS.some((pattern) =>
    pattern.test(normalizedInput),
  )
}

const singularizeToken = (token) => {
  const value = String(token || '').trim()
  if (!value) {
    return ''
  }
  if (value.endsWith('es') && value.length > 4) {
    return value.slice(0, -2)
  }
  if (value.endsWith('s') && value.length > 3) {
    return value.slice(0, -1)
  }
  return value
}

const tokenizeSignalText = (value) =>
  normalizeText(value)
    .split(/\s+/u)
    .map((token) => singularizeToken(token))
    .filter(Boolean)

const hasStem = (tokens, stem) =>
  tokens.some((token) => token === stem || token.startsWith(stem))

const countStemMatches = (tokens, stems = []) =>
  stems.filter((stem) => hasStem(tokens, stem)).length

const normalizeKnowledgeItemMetadata = (item) => {
  const metadata =
    item?.metadata && typeof item.metadata === 'object' ? item.metadata : {}

  return {
    factType:
      typeof metadata.factType === 'string'
        ? normalizeText(metadata.factType)
        : null,
    pageKinds: Array.isArray(metadata.pageKinds)
      ? metadata.pageKinds
          .filter((entry) => typeof entry === 'string')
          .map((entry) => normalizeText(entry))
      : [],
  }
}

const scoreBusinessFaqDefinition = (
  definition,
  input,
  retrievalItems = [],
  tenantRuntimePolicy = null,
) => {
  const normalizedInput = stripWebLeadIntro(input)
  const inputTokens = tokenizeSignalText(normalizedInput)
  let score = 0

  if (definition.directPatterns.some((pattern) => pattern.test(normalizedInput))) {
    score += 8
  }

  const configuredSignalTerms = getConfiguredFaqSignalTerms(
    tenantRuntimePolicy,
    definition.subtype,
  )
  if (configuredSignalTerms.some((term) => normalizedInput.includes(term))) {
    score += 8
  }

  const conceptMatches = countStemMatches(inputTokens, definition.conceptStems)
  const queryMatches = countStemMatches(inputTokens, definition.queryStems)
  score += conceptMatches * 2 + Math.min(queryMatches, 2)

  if (definition.subtype === 'payment_methods') {
    if (conceptMatches > 0 && queryMatches > 0) {
      score += 3
    }
  } else if (definition.subtype === 'location') {
    if (hasStem(inputTokens, 'donde') && (hasStem(inputTokens, 'son') || hasStem(inputTokens, 'estan') || hasStem(inputTokens, 'quedan'))) {
      score += 4
    }
  } else if (definition.subtype === 'contact') {
    if (conceptMatches > 0 && queryMatches > 0) {
      score += 2
    }
  } else if (definition.subtype === 'business_hours') {
    if (conceptMatches > 0 && queryMatches > 0) {
      score += 2
    }
  }

  for (const item of Array.isArray(retrievalItems) ? retrievalItems.slice(0, 4) : []) {
    const { factType, pageKinds } = normalizeKnowledgeItemMetadata(item)
    const tags = Array.isArray(item?.tags)
      ? item.tags.map((tag) => normalizeText(tag))
      : []
    const combinedText = normalizeText(
      [item?.title, item?.summary, item?.snippet]
        .filter(Boolean)
        .join(' '),
    )

    if (factType && definition.knowledgeFactTypes.includes(factType)) {
      score += 12
    }
    if (pageKinds.some((pageKind) => definition.knowledgePageKinds.includes(pageKind))) {
      score += 4
    }
    if (
      tags.some((tag) =>
        definition.knowledgeTagStems.some((stem) => hasStem(tokenizeSignalText(tag), stem)),
      )
    ) {
      score += 2
    }
    if (
      definition.knowledgeCueStems.some((stem) =>
        combinedText.includes(stem),
      )
    ) {
      score += 1.5
    }
  }

  return score
}

const detectBusinessFaqSubtype = (input, options = {}) => {
  const retrievalItems = Array.isArray(options?.retrievalItems)
    ? options.retrievalItems
    : []
  const tenantRuntimePolicy =
    options?.tenantRuntimePolicy && typeof options.tenantRuntimePolicy === 'object'
      ? options.tenantRuntimePolicy
      : null

  if (looksLikeShortPaymentMethodFollowUp(input, options)) {
    return 'payment_methods'
  }

  let bestMatch = null
  for (const definition of BASE_BUSINESS_FAQ_DEFINITIONS) {
    const score = scoreBusinessFaqDefinition(
      definition,
      input,
      retrievalItems,
      tenantRuntimePolicy,
    )
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        subtype: definition.subtype,
        score,
      }
    }
  }

  return bestMatch && bestMatch.score >= 4 ? bestMatch.subtype : null
}

export const looksLikeCustomerTopicQuestion = (text, options = {}) => {
  const normalized = normalizeText(text)
  const requestedTopic = extractRequestedTopicLabel(normalized)
  const hasTopicSignals =
    Boolean(requestedTopic) || hasTenantTopicSignal(normalized, options?.tenantTopicTaxonomy)
  const hasAvailabilitySignals = looksLikeCustomerAvailabilityQuestion(normalized)
  return (
    (((hasTopicSignals || hasAvailabilitySignals) &&
      CUSTOMER_TOPIC_PATTERNS.some((pattern) => pattern.test(normalized))) ||
      hasAvailabilitySignals ||
      Boolean(detectBusinessFaqSubtype(normalized, options))) &&
    !CUSTOMER_TRANSACTIONAL_PATTERNS.some((pattern) => pattern.test(normalized)) &&
    !looksLikeQuoteRequirementsQuestion(normalized) &&
    !looksLikeGenericPriceInquiry(normalized)
  )
}

export const looksLikeCustomerAvailabilityQuestion = (text) => {
  const currentTurnText = extractCurrentCustomerTurnText(text)
  if (looksLikeGenericPriceInquiry(currentTurnText)) {
    return false
  }

  return CUSTOMER_AVAILABILITY_PATTERNS.some((pattern) =>
    pattern.test(currentTurnText),
  )
}

export const looksLikeCustomerVariantQuestion = (text) =>
  CUSTOMER_VARIANT_QUESTION_PATTERNS.some((pattern) =>
    pattern.test(extractCurrentCustomerTurnText(text)),
  )

export const looksLikeCustomerBusinessHoursQuestion = (text, options = {}) =>
  detectBusinessFaqSubtype(text, options) === 'business_hours'

export const looksLikeCustomerLocationQuestion = (text, options = {}) =>
  detectBusinessFaqSubtype(text, options) === 'location'

export const looksLikeCustomerPaymentMethodsQuestion = (text, options = {}) =>
  detectBusinessFaqSubtype(text, options) === 'payment_methods'

export const looksLikeCustomerContactQuestion = (text, options = {}) =>
  detectBusinessFaqSubtype(text, options) === 'contact'

export const looksLikeCustomerDefinitionQuestion = (text) =>
  CUSTOMER_DEFINITION_PATTERNS.some((pattern) =>
    pattern.test(extractCurrentCustomerTurnText(text)),
  )

export const looksLikeCustomerBenefitsQuestion = (text) =>
  CUSTOMER_BENEFITS_PATTERNS.some((pattern) =>
    pattern.test(extractCurrentCustomerTurnText(text)),
  )

export const looksLikeCustomerMaintenanceQuestion = (text) =>
  CUSTOMER_MAINTENANCE_PATTERNS.some((pattern) =>
    pattern.test(extractCurrentCustomerTurnText(text)),
  )

export const looksLikeCustomerGenericInfoRequest = (text) => {
  const normalized = normalizeText(text)
  if (!normalized) {
    return false
  }

  const hasGenericAsk =
    normalized.includes('inform') ||
    normalized.includes('consult') ||
    normalized.includes('ayud') ||
    normalized.includes('info')

  if (!hasGenericAsk) {
    return false
  }

  if (looksLikeCustomerTopicQuestion(normalized)) {
    return false
  }

  return !CUSTOMER_TRANSACTIONAL_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  )
}

const looksLikeSuspiciousNoiseToken = (token, tenantRuntimePolicy = null) => {
  if (typeof token !== 'string' || token.length < 6) {
    return false
  }

  if (buildCommonCustomerSignalTokens(tenantRuntimePolicy).has(token)) {
    return false
  }

  const vowels = token.match(/[aeiou]/g) || []
  const consonants = token.match(/[bcdfghjklmnñpqrstvwxyz]/g) || []

  if (!consonants.length) {
    return false
  }

  return vowels.length === 0 || (vowels.length === 1 && consonants.length >= 7)
}

export const looksLikeCustomerUnintelligibleText = (
  text,
  tenantRuntimePolicy = null,
) => {
  const normalized = normalizeText(text)
  if (!normalized || normalized.length < 8) {
    return false
  }

  if (
    looksLikeCustomerTopicQuestion(normalized) ||
    looksLikeCustomerGenericInfoRequest(normalized)
  ) {
    return false
  }

  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)

  if (
    !tokens.length ||
    tokens.some((token) =>
      buildCommonCustomerSignalTokens(tenantRuntimePolicy).has(token),
    )
  ) {
    return false
  }

  const suspiciousTokens = tokens.filter((token) =>
    looksLikeSuspiciousNoiseToken(token, tenantRuntimePolicy),
  )
  if (tokens.length === 1) {
    return suspiciousTokens.length === 1 && tokens[0].length >= 8
  }
  return (
    suspiciousTokens.length > 0 &&
    suspiciousTokens.length >= Math.ceil(tokens.length * 0.6)
  )
}

export const detectCustomerFaqSubtype = (input, options = {}) => {
  const sanitizedInput = stripWebLeadIntro(input)

  if (looksLikePrivateAccountFaqGuard(input)) {
    return null
  }

  const businessSubtype = detectBusinessFaqSubtype(sanitizedInput, options)
  if (businessSubtype) {
    return businessSubtype
  }
  if (looksLikeCustomerVariantQuestion(sanitizedInput)) {
    return 'variants'
  }
  if (looksLikeCustomerAvailabilityQuestion(sanitizedInput)) {
    return 'availability'
  }
  if (
    /\b(instalaci[oó]n|colocaci[oó]n|instalar|colocar|incluye instalaci[oó]n|incluye colocaci[oó]n)\b/i.test(
      sanitizedInput,
    )
  ) {
    return 'installation'
  }
  if (looksLikeCustomerMaintenanceQuestion(sanitizedInput)) {
    return 'maintenance'
  }
  if (looksLikeCustomerBenefitsQuestion(sanitizedInput)) {
    return 'benefits'
  }
  if (looksLikeCustomerDefinitionQuestion(sanitizedInput)) {
    return 'definition'
  }
  return 'general'
}

const stripTrailingTransactionalQuery = (value) =>
  compactText(
    String(value || '').replace(
      /\b(?:que|qué)\s+(?:costo|costos|precio|precios|valor|valores)\s+(?:tiene|tienen)\b.*$/iu,
      '',
    ),
  )

const isGenericRequestedTopicLabel = (value) =>
  /\b(eso|esto|mi caso|tu caso|el caso|este caso|ese caso|aplica|aplique|sirve|sirva|funciona|funcione|mismo|misma|si|sí|gracias|muchas gracias|ok|dale|perfecto|listo)\b/iu.test(
    compactText(value || ''),
  )

const normalizeRequestedTopicLabel = (value) =>
  compactText(
    stripTrailingTransactionalQuery(
      String(value || '')
        .replace(
          /^(?:quiero\s+saber\s+si\s+tienen|quisiera\s+saber\s+si\s+tienen|saber\s+si\s+tienen|si\s+tienen|quiero\s+consultar\s+por|quiero\s+consultar\s+sobre|consultar\s+por|consultar\s+sobre|consulta\s+por|consulta\s+sobre|quiero\s+saber\s+sobre|quiero\s+saber\s+de|necesito\s+saber\s+sobre|me\s+gustaria\s+saber\s+sobre|me\s+gustaría\s+saber\s+sobre)\s+/iu,
          '',
        )
        .replace(
          /^(?:precio|precios|presupuesto|presupuestos|cotizacion|cotización|cotizaciones|costo|costos|valor|valores|importe|importes|monto|montos)\s+/iu,
          '',
        )
        .replace(
          /^(?:tengo\s+que\s+(?:pasarte|mandarte|sumarte|agregarte)|te\s+(?:paso|mando|sumo|agrego)|(?:pasarte|mandarte|sumarte|agregarte))\s+(?:un|una|otro|otra)\s+/iu,
          '',
        )
        .replace(/^(?:(?:si|sí|y|las|los|la|el)\s+){1,4}/iu, '')
        .replace(/^(de|del|la|las|el|los)\s+/iu, '')
        .replace(/\s+(?:mas|más)$/iu, ''),
    ),
  )

export const extractRequestedTopicLabel = (input) => {
  const currentInput = extractCurrentCustomerTurnText(input)
  const semanticInput = stripWebLeadIntro(extractSemanticCustomerTurnText(input))
  const looksLikeMessagePlaceholder =
    /\b(?:esperando|aguardando)\s+(?:este|ese|el)\s+mensaje\b/iu.test(
      semanticInput,
    )
  const looksLikeScheduleAvailabilityPayload =
    /\b(?:pueden|puedo|podrian|podrían|pasan|pasar|ir|venir|domicilio|visita)\b/iu.test(
      semanticInput,
    ) &&
    /\b(?:hoy|mañana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|a\s+las|\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/iu.test(
      semanticInput,
    )
  if (
    !semanticInput ||
    looksLikeMessagePlaceholder ||
    looksLikeScheduleAvailabilityPayload ||
    hasQuantityOnlyFollowUpSignal(semanticInput) ||
    hasReengagementReferenceSignal(currentInput) ||
    looksLikeQuoteRequirementsQuestion(semanticInput) ||
    looksLikePaymentOperationalUpdate(semanticInput)
  ) {
    return null
  }

  const patterns = [
    /\b(?:que|qué)\s+(medios de pago|medios de pagos|formas de pago|formas de pagos)\s+aceptan\b/iu,
    /\b(?:que|qué)\s+(telefono|teléfono|whatsapp|numero de contacto|número de contacto)\s+(tienen|manejan)\b/iu,
    /\b(?:quiero saber si tienen|quisiera saber si tienen)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
    /\b(?:quiero consultar por|quiero consultar sobre|consultar por|consultar sobre|consulta por|consulta sobre)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
    /\b(?:estoy buscando|ando buscando|busco)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
    /\b(?:quiero saber sobre|quiero saber de|necesito saber sobre|me gustaria saber sobre|me gustaría saber sobre)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
    /\b(?:quiero|necesito)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
    /\b(?:quiero ver|quiero conocer|me interesa|me interesan|me interesan las|me interesan los)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
    /\b(?:tienen|manejan|ofrecen|trabajan con|cuentan con)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
  ]

  for (const pattern of patterns) {
    const match = semanticInput.match(pattern)
    if (match?.[1]) {
      const candidate = normalizeRequestedTopicLabel(match[1])
      if (candidate && !isGenericRequestedTopicLabel(candidate)) {
        return candidate
      }
    }
  }

  const shortFollowUpMatch = semanticInput.match(
    /^(?:y\s+)?([a-záéíóúñ0-9][a-záéíóúñ0-9\s-]{1,48})\??$/iu,
  )
  if (shortFollowUpMatch?.[1]) {
    const candidate = normalizeRequestedTopicLabel(shortFollowUpMatch[1])
    if (
      candidate &&
      !isGenericRequestedTopicLabel(candidate) &&
      !/\b(info|informacion|consulta|consultar|ayuda|algo|eso|esto|mismo|estoy|buscando|busco|necesito|quiero|me interesa|me interesan|que tipos tienen|qué tipos tienen|que opciones tienen|qué opciones tienen|que variantes tienen|qué variantes tienen|cuales tienen|cuáles tienen|que tipos hay|qué tipos hay|que opciones hay|qué opciones hay|que variantes hay|qué variantes hay|que datos necesitas para cotizar|qué datos necesitas para cotizar|que informacion necesitas para cotizar|qué información necesitas para cotizar|que medidas necesitas para cotizar|qué medidas necesitas para cotizar|(?:dime|decime|mostrame|mu[eé]strame|pasame)\s+(?:las\s+)?(?:opciones|variantes|tipos|modelos|versiones|formatos))\b/iu.test(
        candidate,
      )
    ) {
      return candidate
    }
  }

  return null
}

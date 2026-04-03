import {
  looksLikeGenericPriceInquiry,
  looksLikePaymentOperationalUpdate,
  looksLikeQuoteRequirementsQuestion,
} from './customer-intent-patterns.js'
import { hasTenantTopicSignal } from './customer-topic-taxonomy.js'
import {
  detectStandaloneAttachmentArtifactKind,
  hasMultimodalPlaceholderSignal,
} from './customer-semantic-signals.js'
import {
  buildSemanticInfoIntent,
  detectInfoRequestShape,
  semanticInfoShapeToFaqSubtype,
} from './semantic-info-intent.js'
import {
  getBusinessRules,
  getVocabulary,
} from '../tenant-policy/runtime-tenant-policy.js'
import { getStaticLanguagePolicy } from '../../../../shared/language-policy/index.js'
import {
  extractCurrentCustomerTurnText,
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
  const semanticInfoIntent = buildSemanticInfoIntent({
    input: text,
    tenantTopicTaxonomy: Array.isArray(options?.tenantTopicTaxonomy)
      ? options.tenantTopicTaxonomy
      : [],
    tenantRuntimePolicy:
      options?.tenantRuntimePolicy && typeof options.tenantRuntimePolicy === 'object'
        ? options.tenantRuntimePolicy
        : null,
    contextTopic:
      options?.contextTopic && typeof options.contextTopic === 'object'
        ? options.contextTopic
        : null,
    previousQuoteContext:
      options?.previousQuoteContext &&
      typeof options.previousQuoteContext === 'object'
        ? options.previousQuoteContext
        : null,
    followUpDetected: options?.followUpDetected === true,
  })
  const requestedTopic = semanticInfoIntent?.subject?.label || null
  const hasTopicSignals =
    Boolean(requestedTopic) || hasTenantTopicSignal(normalized, options?.tenantTopicTaxonomy)
  const hasAvailabilitySignals = looksLikeCustomerAvailabilityQuestion(normalized)
  const businessFaqSubtype = detectBusinessFaqSubtype(normalized, options)
  const hasSemanticTopicFlowSignal =
    semanticInfoIntent.shape !== 'unknown' &&
    (hasTopicSignals ||
      semanticInfoIntent.subjectMode === 'implicit_from_context' ||
      semanticInfoIntent.shape !== 'general_info')

  return (
    ((hasSemanticTopicFlowSignal ||
      hasAvailabilitySignals ||
      Boolean(businessFaqSubtype)) &&
      !CUSTOMER_TRANSACTIONAL_PATTERNS.some((pattern) => pattern.test(normalized)) &&
      !looksLikeQuoteRequirementsQuestion(normalized) &&
      !looksLikeGenericPriceInquiry(normalized))
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

export const looksLikeCustomerVariantComparisonQuestion = (text) =>
  detectInfoRequestShape(text) === 'comparison'

export const looksLikeCustomerVariantQuestion = (text) =>
  ['variant_discovery', 'comparison'].includes(detectInfoRequestShape(text))

export const looksLikeCustomerBusinessHoursQuestion = (text, options = {}) =>
  detectBusinessFaqSubtype(text, options) === 'business_hours'

export const looksLikeCustomerLocationQuestion = (text, options = {}) =>
  detectBusinessFaqSubtype(text, options) === 'location'

export const looksLikeCustomerPaymentMethodsQuestion = (text, options = {}) =>
  detectBusinessFaqSubtype(text, options) === 'payment_methods'

export const looksLikeCustomerContactQuestion = (text, options = {}) =>
  detectBusinessFaqSubtype(text, options) === 'contact'

export const looksLikeCustomerDefinitionQuestion = (text) =>
  detectInfoRequestShape(text) === 'definition'

export const looksLikeCustomerBenefitsQuestion = (text) =>
  detectInfoRequestShape(text) === 'benefits'

export const looksLikeCustomerMaintenanceQuestion = (text) =>
  CUSTOMER_MAINTENANCE_PATTERNS.some((pattern) =>
    pattern.test(extractCurrentCustomerTurnText(text)),
  )

export const looksLikeCustomerGenericInfoRequest = (text) => {
  const normalized = normalizeText(text)
  if (!normalized) {
    return false
  }

  if (detectInfoRequestShape(normalized) === 'general_info') {
    return true
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

export const looksLikeCustomerProductInfoOpening = (text, options = {}) => {
  const semanticInfoIntent = buildSemanticInfoIntent({
    input: text,
    tenantTopicTaxonomy: Array.isArray(options?.tenantTopicTaxonomy)
      ? options.tenantTopicTaxonomy
      : [],
    tenantRuntimePolicy:
      options?.tenantRuntimePolicy && typeof options.tenantRuntimePolicy === 'object'
        ? options.tenantRuntimePolicy
        : null,
    contextTopic:
      options?.contextTopic && typeof options.contextTopic === 'object'
        ? options.contextTopic
        : null,
    previousQuoteContext:
      options?.previousQuoteContext &&
      typeof options.previousQuoteContext === 'object'
        ? options.previousQuoteContext
        : null,
    followUpDetected: options?.followUpDetected === true,
  })

  return (
    semanticInfoIntent.shape === 'general_info' &&
    semanticInfoIntent.subjectMode === 'explicit'
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
  const semanticFaqSubtype = semanticInfoShapeToFaqSubtype(
    detectInfoRequestShape(sanitizedInput),
  )
  if (semanticFaqSubtype && semanticFaqSubtype !== 'general') {
    return semanticFaqSubtype
  }
  if (looksLikeCustomerAvailabilityQuestion(sanitizedInput)) {
    return 'availability'
  }
  if (
    /\b(instalaci[oó]n|colocaci[oó]n|instalar|instalan|colocar|colocan|incluye instalaci[oó]n|incluye colocaci[oó]n|hacen colocaci[oó]n|hacen instalaci[oó]n|realizan colocaci[oó]n|realizan instalaci[oó]n)\b/i.test(
      sanitizedInput,
    )
  ) {
    return 'installation'
  }
  if (looksLikeCustomerMaintenanceQuestion(sanitizedInput)) {
    return 'maintenance'
  }
  return 'general'
}

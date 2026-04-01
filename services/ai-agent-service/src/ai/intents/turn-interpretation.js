import {
  detectCustomerFaqSubtype,
  extractRequestedTopicLabel,
} from './customer-faq-heuristics.js'
import {
  extractCurrentCustomerTurnText,
  extractSemanticCustomerTurnText,
} from '../ingress/customer-turn-normalization.js'
import {
  BASE_CONVERSATIONAL_ES_SIGNALS,
  countStemMatches,
  detectStandaloneAttachmentArtifactKind,
  hasMultimodalReferenceSignal,
  hasQuantityOnlyFollowUpSignal,
  looksLikeCatalogStructureSignal,
  looksLikeQuoteExpansionSignal,
  hasReengagementReferenceSignal,
  hasScheduleAdministrativeSignal,
  hasScheduleStatusFollowUpSignal,
} from './customer-semantic-signals.js'
import {
  looksLikeCommercialConditionQuestion,
  looksLikeConfiguredProductInterest,
  looksLikeGenericPriceInquiry,
  looksLikeQuoteRequirementsQuestion,
  looksLikeQuoteWaitingFollowUp,
} from './customer-intent-patterns.js'
import {
  looksLikeCustomerScheduleAvailabilityRequest,
  looksLikeCustomerSupportServiceRequest,
} from './customer-operational-heuristics.js'
import {
  buildCustomerQuoteContext,
  extractCustomerQuoteSeed,
} from './customer-quote-context.js'
import {
  extractCustomerQuoteLeadText,
  extractCustomerQuotedMeasurements,
} from '../nlu/customer-measurement-parser.js'
import { buildCustomerScheduleContext } from './customer-schedule-context.js'
import { buildCustomerSupportContext } from './customer-support-context.js'
import { resolveConversationThreads } from './conversation-thread-resolver.js'
import {
  extractTenantFamilyLabel,
  extractTenantVariantLabels,
  findBestTenantTopicMatch,
  findTenantTopicMatches,
  isContextualTopicDescriptorMatch,
} from './customer-topic-taxonomy.js'
import { buildConversationContext } from '../conversation/conversation-context.js'
import { getVocabulary } from '../tenant-policy/runtime-tenant-policy.js'
import { isGenericQuoteTopicLabel } from './quote-semantics.js'

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const TOPIC_STOP_TOKENS = new Set([
  'y',
  'tambien',
  'también',
  'eso',
  'esta',
  'este',
  'ese',
  'esa',
  'mismo',
  'misma',
  'quiero',
  'necesito',
  'consulta',
  'consultar',
  'informacion',
  'información',
  'sobre',
  'por',
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'cotizar',
  'cotizacion',
  'cotización',
  'presupuesto',
  'presupuestos',
  'solicitar',
  'solicito',
  'quiera',
  'quisiera',
])

const TOPIC_RESOLUTION_FILLER_TOKENS = new Set([
  ...TOPIC_STOP_TOKENS,
  'si',
  'total',
])

const getTopicResolutionFillerTokens = (tenantRuntimePolicy = null) =>
  new Set([
    ...TOPIC_RESOLUTION_FILLER_TOKENS,
    ...((getVocabulary(tenantRuntimePolicy)?.topicResolutionFillerTerms ?? [])
      .flatMap((entry) => normalizeText(entry).split(/\s+/u))
      .filter(Boolean)),
  ])

const getVariantContextTerms = (tenantRuntimePolicy = null) =>
  (getVocabulary(tenantRuntimePolicy)?.variantContextTerms ?? [])
    .flatMap((entry) => normalizeText(entry).split(/\s+/u))
    .filter(Boolean)

const getQuoteAttributeFollowUpHints = ({
  attribute = null,
  tenantRuntimePolicy = null,
} = {}) => {
  const hints =
    getVocabulary(tenantRuntimePolicy)?.quoteAttributeFollowUpHints &&
    typeof getVocabulary(tenantRuntimePolicy).quoteAttributeFollowUpHints === 'object'
      ? getVocabulary(tenantRuntimePolicy).quoteAttributeFollowUpHints
      : {}
  const keys = [
    attribute?.taxonomyTag,
    attribute?.key,
  ]
    .map((entry) => normalizeText(entry).replace(/\s+/g, '_'))
    .filter(Boolean)

  return Array.from(
    new Set(
      keys.flatMap((key) => {
        const configured = Array.isArray(hints[key]) ? hints[key] : []
        return configured
          .map((entry) => normalizeText(entry))
          .filter(Boolean)
      }),
    ),
  )
}

const FAQ_TOPIC_LABELS = {
  location: 'ubicación',
  business_hours: 'horario de atención',
  payment_methods: 'medios de pago',
  contact: 'contacto',
}

const looksLikeVariantFollowUp = (currentTurnText) =>
  /\b((que|qué)\s+(tipos|opciones|variantes|lineas|líneas|modelos)\s+(tienen|hay|manejan)|cuales\s+(tienen|hay|manejan)|cu[aá]les\s+(tienen|hay|manejan)|((que|qué)\s+(versiones|formatos)\s+(tienen|hay))|(dime|decime|mostrame|mu[eé]strame|pasame)\s+(las\s+)?(opciones|variantes|tipos|modelos|versiones|formatos))\b/i.test(
    String(currentTurnText || ''),
  )

const SCHEDULE_SIGNAL_SETS = BASE_CONVERSATIONAL_ES_SIGNALS.schedule

const looksLikeScheduleSeedInput = (currentTurnText, tenantRuntimePolicy = null) => {
  const text = String(currentTurnText || '')
  if (looksLikeCommercialConditionQuestion(text)) {
    return false
  }

  return looksLikeCustomerScheduleAvailabilityRequest(text, { tenantRuntimePolicy })
}

const looksLikeScheduleAdministrativePayload = (currentTurnText) =>
  hasScheduleAdministrativeSignal(currentTurnText) ||
  hasScheduleStatusFollowUpSignal(currentTurnText)

const looksLikeScheduleAcknowledgement = (currentTurnText) =>
  /^(si|sí|dale|ok|perfecto|listo)$/i.test(String(currentTurnText || '').trim())

const shouldCarrySupportContext = ({
  role,
  currentTurnText,
  normalizedCurrentTurnText,
  intentDetection = null,
  previousIntentKey = null,
  previousSupportContext = null,
  previousScheduleContext = null,
  previousConversationContext = null,
  quoteContext = null,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
  followUpDetected = false,
  attachmentArtifactTurn = false,
}) => {
  if (!isCustomerRole(role)) {
    return false
  }

  if (intentDetection?.intent === 'customer.support_request') {
    return true
  }

  const hasPreviousSupportLane =
    previousIntentKey === 'customer.support_request' ||
    Boolean(previousSupportContext) ||
    (previousScheduleContext && previousScheduleContext.reason === 'revisión técnica') ||
    previousConversationContext?.activeDomain === 'support'

  if (!hasPreviousSupportLane) {
    return false
  }

  const strongQuotePivot =
    intentDetection?.intent === 'customer.quote' &&
    (looksLikeGenericPriceInquiry(normalizedCurrentTurnText) ||
      Boolean(quoteContext?.measurements) ||
      Number(quoteContext?.quantity?.total || 0) > 0)

  const explicitSupportSignal = looksLikeCustomerSupportServiceRequest(currentTurnText, {
    tenantTopicTaxonomy,
    tenantRuntimePolicy,
  })

  if (strongQuotePivot && !explicitSupportSignal) {
    return false
  }

  return (
    explicitSupportSignal ||
    followUpDetected ||
    attachmentArtifactTurn ||
    looksLikeScheduleAdministrativePayload(currentTurnText) ||
    looksLikeScheduleAcknowledgement(currentTurnText)
  )
}

const looksLikeShortTopicOnlyFollowUp = (currentTurnText) => {
  const normalized = normalizeText(currentTurnText)
  if (!normalized) {
    return false
  }

  const tokens = normalized.split(' ').filter(Boolean)
  if (tokens.length > 2) {
    return false
  }

  return Boolean(extractRequestedTopicLabel(currentTurnText))
}

const looksLikeMeasurementOnlyFollowUp = (currentTurnText) =>
  Boolean(extractCustomerQuotedMeasurements(currentTurnText))

const looksLikeQuantityOnlyFollowUp = (currentTurnText) =>
  hasQuantityOnlyFollowUpSignal(currentTurnText)

const QUOTE_ATTRIBUTE_MAX_TOKENS = 6

const escapeRegex = (value) =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeAttributeOptionAliases = (attribute = null) =>
  Array.isArray(attribute?.options)
    ? attribute.options
        .flatMap((option) => [
          option?.value,
          ...(Array.isArray(option?.aliases) ? option.aliases : []),
        ])
        .map((entry) => normalizeText(entry))
        .filter(Boolean)
    : []

const matchesQuoteAttributeEnumOnlyFollowUp = (currentTurnText, attribute = null) => {
  const normalized = normalizeText(currentTurnText)
  if (!normalized) {
    return false
  }

  return normalizeAttributeOptionAliases(attribute).some((alias) =>
    new RegExp(`\\b${escapeRegex(alias)}\\b`, 'iu').test(normalized),
  )
}

const matchesQuoteAttributeTaxonomyOnlyFollowUp = (
  currentTurnText,
  attribute = null,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
) => {
  const normalizedTag = normalizeText(attribute?.taxonomyTag).replace(/\s+/g, '_')
  if (!normalizedTag) {
    return false
  }

  const matches = findTenantTopicMatches(currentTurnText, tenantTopicTaxonomy, {
    kinds: ['product_variant', 'product_topic', 'product_family'],
    limit: 8,
    variantContextTerms: getVariantContextTerms(tenantRuntimePolicy),
  })
  const hasTaggedMatch = matches.some((entry) =>
    (Array.isArray(entry?.tags) ? entry.tags : []).some(
      (tag) => normalizeText(tag).replace(/\s+/g, '_') === normalizedTag,
    ),
  )

  if (hasTaggedMatch) {
    return true
  }

  const hintTerms = getQuoteAttributeFollowUpHints({
    attribute,
    tenantRuntimePolicy,
  })
  if (!hintTerms.length) {
    return false
  }

  const normalizedInput = normalizeText(currentTurnText)
  return hintTerms.some((term) =>
    new RegExp(`\\b${escapeRegex(term)}\\b`, 'iu').test(normalizedInput),
  )
}

const matchesQuoteAttributeOnlyFollowUp = ({
  currentTurnText,
  attribute = null,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
}) => {
  switch (attribute?.captureKind) {
    case 'measurements':
      return looksLikeMeasurementOnlyFollowUp(currentTurnText)
    case 'quantity':
      return looksLikeQuantityOnlyFollowUp(currentTurnText)
    case 'enum':
      return matchesQuoteAttributeEnumOnlyFollowUp(currentTurnText, attribute)
    case 'taxonomy_tag':
      return matchesQuoteAttributeTaxonomyOnlyFollowUp(
        currentTurnText,
        attribute,
        tenantTopicTaxonomy,
        tenantRuntimePolicy,
      )
    default:
      return false
  }
}

const detectQuoteAttributeOnlyFollowUp = ({
  currentTurnText,
  previousQuoteContext = null,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
}) => {
  const missingFields = Array.isArray(previousQuoteContext?.missingFields)
    ? previousQuoteContext.missingFields.filter((entry) => typeof entry === 'string')
    : []
  if (!missingFields.length) {
    return {
      detected: false,
      keys: [],
    }
  }

  const normalized = normalizeText(currentTurnText)
  if (!normalized || /[?¿]/u.test(String(currentTurnText || ''))) {
    return {
      detected: false,
      keys: [],
    }
  }

  const tokens = normalized.split(' ').filter(Boolean)
  if (tokens.length > QUOTE_ATTRIBUTE_MAX_TOKENS) {
    return {
      detected: false,
      keys: [],
    }
  }

  const requiredAttributes = Array.isArray(previousQuoteContext?.requiredAttributes)
    ? previousQuoteContext.requiredAttributes.filter(
        (entry) => entry && typeof entry === 'object' && typeof entry.key === 'string',
      )
    : []
  const missingAttributes = requiredAttributes.length
    ? requiredAttributes.filter((attribute) => missingFields.includes(attribute.key))
    : missingFields.map((key) => ({ key }))
  const keys = []
  for (const attribute of missingAttributes) {
    const matched =
      matchesQuoteAttributeOnlyFollowUp({
        currentTurnText,
        attribute,
        tenantTopicTaxonomy,
        tenantRuntimePolicy,
      })
    if (matched) {
      keys.push(attribute.key)
    }
  }

  return {
    detected: keys.length > 0,
    keys,
  }
}

const isCustomerRole = (role) =>
  String(role || '') === 'customer_public' ||
  String(role || '') === 'customer_authenticated'

const looksLikeEllipticFollowUp = (currentTurnText) => {
  const normalized = normalizeText(currentTurnText)
  if (!normalized) {
    return false
  }

  const tokens = normalized.split(' ').filter(Boolean)
  if (tokens.length > 8) {
    return false
  }

  return /^(y|tambien|también|eso|esta|este|ese|esa|cuanto|cuánto|demora|tarda|sirve|incluye|viene|puede venir|se puede)/.test(
    normalized,
  ) ||
    hasMultimodalReferenceSignal(currentTurnText) ||
    hasReengagementReferenceSignal(currentTurnText) ||
    looksLikeVariantFollowUp(currentTurnText) ||
    looksLikeShortTopicOnlyFollowUp(currentTurnText)
}

const looksLikeReferentialFollowUp = (currentTurnText) =>
  /\b(eso|esta|este|ese|esa|esas|esos|lo anterior|lo de arriba|ese mismo|esa misma)\b/i.test(
    String(currentTurnText || ''),
  )

const looksLikeConfirmationOnlyFollowUp = (currentTurnText) =>
  /^(si|sí|dale|ok|perfecto|listo|de acuerdo|esta bien|está bien)$/i.test(
    String(currentTurnText || '').trim(),
  )

const extractTopicTokens = (value) =>
  normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !TOPIC_STOP_TOKENS.has(token))

const looksLikePriceOrQuoteTurn = (value) =>
  looksLikeGenericPriceInquiry(String(value || ''))

const selectPreferredTopicMatchFromInput = (
  value,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
) => {
  const normalizedInput = normalizeText(value)
  const matches = findTenantTopicMatches(value, tenantTopicTaxonomy, {
    kinds: ['product_family', 'product_topic', 'product_variant'],
    limit: 6,
    variantContextTerms: getVariantContextTerms(tenantRuntimePolicy),
  })
  if (!matches.length) {
    return null
  }

  const filteredMatches = matches.filter(
    (match) => !isContextualTopicDescriptorMatch(match, normalizedInput),
  )
  const candidatePool = filteredMatches.length > 0 ? filteredMatches : matches

  return (
    candidatePool.find((match) => match.kind === 'product_topic') ||
    candidatePool.find((match) => match.kind === 'product_variant') ||
    candidatePool[0]
  )
}

const buildCanonicalTopic = ({
  label,
  type,
  confidence,
  source,
}) => {
  const cleanLabel = String(label || '').replace(/\s+/g, ' ').trim()
  if (!cleanLabel || isGenericQuoteTopicLabel(cleanLabel)) {
    return null
  }

  return {
    label: cleanLabel,
    type: type || 'unknown',
    confidence:
      typeof confidence === 'number' && Number.isFinite(confidence)
        ? Math.max(0, Math.min(1, confidence))
        : 0,
    source: source || 'unknown',
    tokens: extractTopicTokens(cleanLabel),
  }
}

const buildCanonicalTopicFromThread = (thread = null) => {
  if (!thread?.resolvedLabel && !thread?.baseLabel) {
    return null
  }

  const label = thread.resolvedLabel || thread.baseLabel
  const type =
    Array.isArray(thread.variantLabels) && thread.variantLabels.length > 0
      ? 'product_variant'
      : thread.baseType || 'product_topic'

  return buildCanonicalTopic({
    label,
    type,
    confidence:
      typeof thread?.confidence === 'number' ? thread.confidence : 0.86,
    source: thread?.source || 'conversation_thread',
  })
}

const buildCanonicalTopicFromQuoteMemory = ({
  previousTopic = null,
  previousQuoteContext = null,
  activeThread = null,
} = {}) => {
  if (previousTopic?.label && !isGenericQuoteTopicLabel(previousTopic.label)) {
    return {
      label: previousTopic.label,
      type: previousTopic.type || 'unknown',
      confidence:
        typeof previousTopic.confidence === 'number' ? previousTopic.confidence : 0.68,
      source: previousTopic.source || 'conversation_memory',
      tokens: Array.isArray(previousTopic.tokens)
        ? previousTopic.tokens
        : extractTopicTokens(previousTopic.label || ''),
    }
  }

  const threadTopic = buildCanonicalTopicFromThread(activeThread)
  if (threadTopic?.label) {
    return threadTopic
  }

  const fallbackLabel =
    previousQuoteContext?.topicLabel || previousQuoteContext?.familyLabel || null
  if (!fallbackLabel || isGenericQuoteTopicLabel(fallbackLabel)) {
    return null
  }

  return buildCanonicalTopic({
    label: fallbackLabel,
    type:
      typeof previousQuoteContext?.topicType === 'string'
        ? previousQuoteContext.topicType
        : 'product_topic',
    confidence: 0.66,
    source: 'quote_memory',
  })
}

const inferTopicType = (label, faqSubtype, tenantTopicTaxonomy = []) => {
  if (
    faqSubtype === 'location' ||
    faqSubtype === 'business_hours' ||
    faqSubtype === 'payment_methods' ||
    faqSubtype === 'contact'
  ) {
    return 'business_fact'
  }

  const taxonomyMatch = findBestTenantTopicMatch(label, tenantTopicTaxonomy, {
    kinds: ['product_family', 'product_topic', 'product_variant'],
  })

  if (taxonomyMatch?.kind === 'product_family') {
    return 'product_family'
  }

  if (taxonomyMatch?.kind === 'product_variant') {
    return 'product_variant'
  }

  return 'product_topic'
}

const resolveTopicLabel = (
  label,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
) => {
  const cleanLabel = String(label || '').replace(/\s+/g, ' ').trim()
  if (!cleanLabel || isGenericQuoteTopicLabel(cleanLabel)) {
    return null
  }

  const taxonomyMatch = findBestTenantTopicMatch(cleanLabel, tenantTopicTaxonomy, {
    kinds: ['product_family', 'product_topic', 'product_variant'],
  })
  if (!taxonomyMatch) {
    return cleanLabel
  }

  const normalizedLabel = normalizeText(cleanLabel)
  const normalizedMatchedLabel = normalizeText(taxonomyMatch.label)
  const normalizedMatchedAlias = normalizeText(taxonomyMatch.matchedAlias || '')
  const tokenCount = normalizedLabel.split(/\s+/).filter(Boolean).length
  const residualTokens = normalizedLabel
    .replace(new RegExp(`\\b${normalizedMatchedAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), ' ')
    .split(/\s+/)
    .filter(Boolean)
  const familyTokens = normalizeText(taxonomyMatch.familyLabel || '')
    .split(/\s+/)
    .filter(Boolean)
  const canCollapseToMatchedTopic =
    residualTokens.length > 0 &&
    residualTokens.every(
      (token) =>
        getTopicResolutionFillerTokens(tenantRuntimePolicy).has(token) ||
        familyTokens.includes(token) ||
        /^\d+$/.test(token),
    )
  if (
    normalizedLabel === normalizedMatchedLabel ||
    normalizedLabel === normalizedMatchedAlias ||
    tokenCount === 1 ||
    canCollapseToMatchedTopic
  ) {
    return taxonomyMatch.label
  }

  return cleanLabel
}

const resolveStructuralFamilyLabel = (
  tenantRuntimePolicy = null,
  tenantTopicTaxonomy = [],
) => {
  const configuredFamilyLabel =
    typeof getVocabulary(tenantRuntimePolicy)?.catalogFamilyLabel === 'string'
      ? getVocabulary(tenantRuntimePolicy).catalogFamilyLabel.trim()
      : ''
  if (!configuredFamilyLabel) {
    return null
  }

  return (
    resolveTopicLabel(configuredFamilyLabel, tenantTopicTaxonomy, tenantRuntimePolicy) ||
    configuredFamilyLabel
  )
}

const isStructuralScopedTopic = (
  topic,
  tenantRuntimePolicy = null,
  tenantTopicTaxonomy = [],
) => {
  const structuralFamilyLabel = resolveStructuralFamilyLabel(
    tenantRuntimePolicy,
    tenantTopicTaxonomy,
  )
  const topicLabel = String(topic?.label || '').trim()
  if (!topicLabel || !structuralFamilyLabel) {
    return false
  }

  const normalizedStructuralFamily = normalizeText(structuralFamilyLabel)

  return (
    normalizeText(topicLabel) === normalizedStructuralFamily ||
    normalizeText(extractTenantFamilyLabel(topicLabel, tenantTopicTaxonomy) || '') ===
      normalizedStructuralFamily ||
    normalizeText(extractTenantFamilyLabel(topic?.familyLabel || '', tenantTopicTaxonomy) || '') ===
      normalizedStructuralFamily
  )
}

const buildStructuralCanonicalTopic = (
  tenantRuntimePolicy = null,
  tenantTopicTaxonomy = [],
) => {
  const resolvedLabel = resolveStructuralFamilyLabel(
    tenantRuntimePolicy,
    tenantTopicTaxonomy,
  )
  if (!resolvedLabel) {
    return null
  }

  return buildCanonicalTopic({
    label: resolvedLabel,
    type: inferTopicType(resolvedLabel, null, tenantTopicTaxonomy),
    confidence: 0.82,
    source: 'catalog_structure_heuristic',
  })
}

const buildRetrievalQuery = ({
  currentTurnText,
  intentKey,
  topic,
  previousTopic,
  previousQuoteContext = null,
  faqSubtype,
  quoteContext = null,
  threadResolution = null,
  tenantTopicTaxonomy = [],
}) => {
  if (!topic?.label) {
    return currentTurnText
  }

  if (topic.type === 'business_fact') {
    return topic.label
  }

  if (faqSubtype === 'variants' && previousTopic?.label) {
    return `variantes de ${previousTopic.label}`.replace(/\s+/g, ' ').trim()
  }

  if (
    (intentKey === 'customer.quote' || intentKey === 'customer.price_inquiry') &&
    topic?.label
  ) {
    const queryParts = []
    const pushQueryPart = (value) => {
      const normalizedValue = normalizeText(value)
      if (
        normalizedValue &&
        !queryParts.some((entry) => normalizeText(entry) === normalizedValue)
      ) {
        queryParts.push(value)
      }
    }
    const familyHint =
      extractTenantFamilyLabel(topic.label, tenantTopicTaxonomy) ||
      extractTenantFamilyLabel(previousTopic?.label || '', tenantTopicTaxonomy) ||
      compactText(previousQuoteContext?.familyLabel || '') ||
      compactText(quoteContext?.familyLabel || '') ||
      compactText(threadResolution?.activeThread?.familyLabel || '') ||
      extractTenantFamilyLabel(previousQuoteContext?.topicLabel || '', tenantTopicTaxonomy) ||
      extractTenantFamilyLabel(quoteContext?.familyLabel || '', tenantTopicTaxonomy) ||
      extractTenantFamilyLabel(quoteContext?.topicLabel || '', tenantTopicTaxonomy) ||
      extractTenantFamilyLabel(
        threadResolution?.activeThread?.familyLabel || '',
        tenantTopicTaxonomy,
      ) ||
      extractTenantFamilyLabel(
        threadResolution?.activeThread?.resolvedLabel ||
          threadResolution?.activeThread?.baseLabel ||
          '',
        tenantTopicTaxonomy,
      )
    if (intentKey === 'customer.quote') {
      pushQueryPart('precio')
    }
    if (familyHint) {
      pushQueryPart(familyHint)
    }

    const currentVariants = extractTenantVariantLabels(topic.label, tenantTopicTaxonomy)
    const inheritedVariants = extractTenantVariantLabels(
      previousTopic?.label || '',
      tenantTopicTaxonomy,
    ).filter((term) => !currentVariants.includes(term))

    pushQueryPart(topic.label)
    if (looksLikePriceOrQuoteTurn(currentTurnText) && inheritedVariants.length) {
      for (const variant of inheritedVariants) {
        pushQueryPart(variant)
      }
    }

    const query = queryParts.join(' ').replace(/\s+/g, ' ').trim()
    return query
  }

  if (topic.type === 'product_variant' && previousTopic?.label) {
    const normalizedTopicLabel = normalizeText(topic.label)
    const normalizedPreviousLabel = normalizeText(previousTopic.label)
    if (normalizedTopicLabel.includes(normalizedPreviousLabel)) {
      return `tienen ${topic.label}`.replace(/\s+/g, ' ').trim()
    }
    return `tienen ${previousTopic.label} ${topic.label}`.replace(/\s+/g, ' ').trim()
  }

  if (topic.type === 'product_family' || topic.type === 'product_topic') {
    const familyHint =
      !extractTenantFamilyLabel(topic.label, tenantTopicTaxonomy) && previousTopic?.label
        ? extractTenantFamilyLabel(previousTopic.label, tenantTopicTaxonomy)
        : null

    if (familyHint) {
      return `tienen ${familyHint} ${topic.label}`.replace(/\s+/g, ' ').trim()
    }

    if (
      intentKey === 'customer.product_info' ||
      intentKey === 'customer.topic_info' ||
      intentKey === 'customer.quote'
    ) {
      return `tienen ${topic.label}`.replace(/\s+/g, ' ').trim()
    }
  }

  return currentTurnText
}

export const buildTurnInterpretation = ({
  role,
  originalInput,
  effectiveInput,
  normalizedInput,
  reasoningInput,
  inboundClassification = null,
  directIntentKey = null,
  intentDetection = null,
  previousTaskState = null,
  referencedMessages = [],
  tenantTopicTaxonomy = [],
  tenantQuoteProfiles = [],
  tenantRuntimePolicy = null,
  nluAnalysis = null,
}) => {
  const rawInterpretationInput = originalInput || effectiveInput || normalizedInput || ''
  const normalizedInterpretationInput = normalizedInput || effectiveInput || originalInput || ''
  const rawCurrentTurnText = extractCurrentCustomerTurnText(rawInterpretationInput)
  const currentTurnText = extractSemanticCustomerTurnText(rawInterpretationInput)
  const normalizedCurrentTurnText = extractSemanticCustomerTurnText(
    normalizedInterpretationInput,
  )
  const attachmentArtifactTurn = Boolean(
    detectStandaloneAttachmentArtifactKind(rawInterpretationInput) ||
      detectStandaloneAttachmentArtifactKind(rawCurrentTurnText),
  )
  const quoteSeed =
    intentDetection?.intent === 'customer.quote' ||
    intentDetection?.intent === 'customer.price_inquiry'
      ? extractCustomerQuoteSeed(currentTurnText, { tenantTopicTaxonomy })
      : null
  const quoteSeedSubjectText = compactText(quoteSeed?.subjectText || '')
  const topicDetectionInput =
    intentDetection?.intent === 'customer.quote' ||
    intentDetection?.intent === 'customer.price_inquiry'
      ? quoteSeedSubjectText || extractCustomerQuoteLeadText(currentTurnText)
      : currentTurnText
  const normalizedTopicDetectionInput =
    intentDetection?.intent === 'customer.quote' ||
    intentDetection?.intent === 'customer.price_inquiry'
      ? quoteSeedSubjectText || extractCustomerQuoteLeadText(normalizedCurrentTurnText)
      : normalizedCurrentTurnText
  const normalizedCurrentTurn = normalizeText(normalizedCurrentTurnText)
  const measurementOnlyFollowUp = looksLikeMeasurementOnlyFollowUp(currentTurnText)
  const quantityOnlyFollowUp = looksLikeQuantityOnlyFollowUp(currentTurnText)
  const quoteWaitingFollowUp = looksLikeQuoteWaitingFollowUp(
    normalizedCurrentTurnText,
  )
  const previousIntentKey = previousTaskState?.intentKey || null
  const previousTopic =
    previousTaskState?.canonicalTopic && typeof previousTaskState.canonicalTopic === 'object'
      ? previousTaskState.canonicalTopic
      : null
  const previousQuoteContext =
    previousTaskState?.quoteContext && typeof previousTaskState.quoteContext === 'object'
      ? previousTaskState.quoteContext
      : null
  const previousScheduleContext =
    previousTaskState?.scheduleContext &&
    typeof previousTaskState.scheduleContext === 'object'
      ? previousTaskState.scheduleContext
      : null
  const previousSupportContext =
    previousTaskState?.supportContext &&
    typeof previousTaskState.supportContext === 'object'
      ? previousTaskState.supportContext
      : null
  const previousConversationContext =
    previousTaskState?.conversationContext &&
    typeof previousTaskState.conversationContext === 'object'
      ? previousTaskState.conversationContext
      : null
  const quoteConfirmationFollowUp =
    isCustomerRole(role) &&
    previousIntentKey === 'customer.quote' &&
    Boolean(previousQuoteContext?.topicLabel) &&
    String(previousQuoteContext?.pendingClarification?.type || '') !==
      'catalog_match_ambiguous' &&
    ['ready_for_pricing_or_handoff', 'ready_for_handoff'].includes(
      String(previousQuoteContext?.completionStatus || ''),
    ) &&
    !['guide_quote_exploration', 'ask_clarification', 'hold_for_more_context'].includes(
      String(
        previousConversationContext?.responseStrategy ||
          previousConversationContext?.resolutionReadiness?.answerMode ||
          '',
      ),
    ) &&
    looksLikeConfirmationOnlyFollowUp(currentTurnText)
  const confirmationOnlyFollowUp =
    isCustomerRole(role) &&
    Boolean(previousIntentKey) &&
    looksLikeConfirmationOnlyFollowUp(currentTurnText)
  const quoteAttributeOnlyFollowUp = detectQuoteAttributeOnlyFollowUp({
    currentTurnText,
    previousQuoteContext,
    tenantTopicTaxonomy,
    tenantRuntimePolicy,
  })
  const followUpDetected =
    isCustomerRole(role) &&
    Boolean(previousIntentKey) &&
    (attachmentArtifactTurn ||
      looksLikeEllipticFollowUp(normalizedCurrentTurnText) ||
      looksLikeReferentialFollowUp(normalizedCurrentTurnText) ||
      confirmationOnlyFollowUp ||
      quoteConfirmationFollowUp ||
      measurementOnlyFollowUp ||
      quantityOnlyFollowUp ||
      quoteAttributeOnlyFollowUp.detected ||
      quoteWaitingFollowUp)
  const intentInherited =
    followUpDetected &&
    Boolean(previousIntentKey) &&
    intentDetection?.intent === previousIntentKey

  const faqSubtype = detectCustomerFaqSubtype(normalizedCurrentTurnText, {
    previousIntentKey,
    tenantRuntimePolicy,
  })
  const threadResolution = resolveConversationThreads({
    currentTurnText,
    previousTaskState,
    tenantTopicTaxonomy,
    measurementCarrierTerms: previousQuoteContext?.measurementCarrierTerms || [],
    nluAnalysis,
  })
  const requestedTopicLabel = measurementOnlyFollowUp
    || quantityOnlyFollowUp
    || quoteWaitingFollowUp
    ? null
    : extractRequestedTopicLabel(normalizedTopicDetectionInput)
  const requestedTopicMatch =
    requestedTopicLabel && !measurementOnlyFollowUp
      ? findBestTenantTopicMatch(requestedTopicLabel, tenantTopicTaxonomy, {
          kinds: ['product_family', 'product_topic', 'product_variant'],
        })
      : null
  const resolvedTopicLabel = FAQ_TOPIC_LABELS[faqSubtype]
    ? null
    : resolveTopicLabel(requestedTopicLabel, tenantTopicTaxonomy, tenantRuntimePolicy)
  const preferStandaloneVariantTopic =
    requestedTopicMatch?.kind === 'product_variant' && !previousTopic?.label
  const catalogStructureSignal = looksLikeCatalogStructureSignal(
    currentTurnText,
    tenantRuntimePolicy,
  )
  const quoteExpansionSignal = looksLikeQuoteExpansionSignal(
    currentTurnText,
    tenantRuntimePolicy,
  )
  const quoteCarryTopic = buildCanonicalTopicFromQuoteMemory({
    previousTopic,
    previousQuoteContext,
    activeThread: threadResolution?.activeThread || null,
  })

  let canonicalTopic = null
  if (FAQ_TOPIC_LABELS[faqSubtype]) {
    canonicalTopic = buildCanonicalTopic({
      label: FAQ_TOPIC_LABELS[faqSubtype],
      type: 'business_fact',
      confidence: 0.82,
      source: 'faq_subtype',
    })
  } else if (threadResolution?.activeThread && !preferStandaloneVariantTopic) {
    canonicalTopic = buildCanonicalTopicFromThread(threadResolution.activeThread)
  } else if (resolvedTopicLabel) {
    canonicalTopic = buildCanonicalTopic({
      label: resolvedTopicLabel,
      type: inferTopicType(resolvedTopicLabel, faqSubtype, tenantTopicTaxonomy),
      confidence: followUpDetected ? 0.93 : 0.88,
      source:
        resolvedTopicLabel !== requestedTopicLabel
        ? 'topic_taxonomy'
        : followUpDetected
          ? 'follow_up_heuristic'
          : 'message_heuristic',
    })
  }

  if (
    !canonicalTopic &&
    !FAQ_TOPIC_LABELS[faqSubtype] &&
    tenantTopicTaxonomy.length > 0
  ) {
    const fullInputTopicMatch = selectPreferredTopicMatchFromInput(
      normalizedTopicDetectionInput,
      tenantTopicTaxonomy,
      tenantRuntimePolicy,
    )

    if (fullInputTopicMatch?.label) {
      canonicalTopic = buildCanonicalTopic({
        label: fullInputTopicMatch.label,
        type: fullInputTopicMatch.kind || 'unknown',
        confidence: looksLikeConfiguredProductInterest(
          normalizedCurrentTurnText,
          tenantTopicTaxonomy,
        )
          ? 0.9
          : 0.74,
        source: 'topic_taxonomy_full_input',
      })
    }
  }

  if (!canonicalTopic && (followUpDetected || attachmentArtifactTurn) && quoteCarryTopic?.label) {
    canonicalTopic = buildCanonicalTopic({
      label: quoteCarryTopic.label,
      type: quoteCarryTopic.type || 'unknown',
      confidence: 0.66,
      source: 'conversation_memory',
    })
  }

  if (
    catalogStructureSignal &&
    !isStructuralScopedTopic(
      canonicalTopic,
      tenantRuntimePolicy,
      tenantTopicTaxonomy,
    )
  ) {
    canonicalTopic =
      buildStructuralCanonicalTopic(
        tenantRuntimePolicy,
        tenantTopicTaxonomy,
      ) || canonicalTopic
  }

  if (
    !canonicalTopic &&
    quoteCarryTopic?.label &&
    (looksLikeQuoteRequirementsQuestion(normalizedCurrentTurnText) ||
      faqSubtype === 'variants' ||
      looksLikeConfiguredProductInterest(
        normalizedCurrentTurnText,
        tenantTopicTaxonomy,
      ) ||
      measurementOnlyFollowUp ||
      quantityOnlyFollowUp ||
      quoteWaitingFollowUp)
  ) {
    canonicalTopic = buildCanonicalTopic({
      label: quoteCarryTopic.label,
      type: quoteCarryTopic.type || 'unknown',
      confidence: 0.72,
      source: 'conversation_memory',
    })
  }

  if (
    !canonicalTopic &&
    quoteExpansionSignal &&
    quoteCarryTopic?.label
  ) {
    canonicalTopic = buildCanonicalTopic({
      label: quoteCarryTopic.label,
      type: quoteCarryTopic.type || 'unknown',
      confidence: 0.74,
      source: 'quote_expansion_memory',
    })
  }

  if (attachmentArtifactTurn && quoteCarryTopic?.label) {
    canonicalTopic = buildCanonicalTopic({
      label: quoteCarryTopic.label,
      type: quoteCarryTopic.type || 'unknown',
      confidence: 0.78,
      source: 'attachment_memory',
    })
  }

  const switchedQuoteSubject =
    Boolean(threadResolution?.switchDetected) &&
    Boolean(quoteCarryTopic?.label) &&
    Boolean(canonicalTopic?.label) &&
    normalizeText(canonicalTopic.label) !== normalizeText(quoteCarryTopic.label)
  const shouldCarryQuoteContextFromMemory =
    Boolean(quoteCarryTopic?.label) &&
    !switchedQuoteSubject &&
    (attachmentArtifactTurn ||
      followUpDetected ||
      quoteAttributeOnlyFollowUp.detected ||
      looksLikeQuoteRequirementsQuestion(normalizedCurrentTurnText) ||
      looksLikeConfiguredProductInterest(
        normalizedCurrentTurnText,
        tenantTopicTaxonomy,
      ) ||
      quoteConfirmationFollowUp ||
      looksLikeGenericPriceInquiry(normalizedCurrentTurnText) ||
      quantityOnlyFollowUp ||
      quoteWaitingFollowUp ||
      (canonicalTopic?.label &&
        normalizeText(canonicalTopic.label) === normalizeText(quoteCarryTopic.label)))
  const quoteContext = buildCustomerQuoteContext({
    currentTurnText,
    topic: canonicalTopic,
    previousTopic,
    previousQuoteContext:
      shouldCarryQuoteContextFromMemory &&
      previousQuoteContext
        ? previousQuoteContext
        : null,
    activeThread: threadResolution?.activeThread || null,
    tenantTopicTaxonomy,
    tenantQuoteProfiles,
  })
  const fallbackQuoteContext =
    !quoteContext &&
    shouldCarryQuoteContextFromMemory &&
    previousQuoteContext &&
    quoteAttributeOnlyFollowUp.detected
      ? (() => {
          const previousMissingFields = Array.isArray(previousQuoteContext?.missingFields)
            ? previousQuoteContext.missingFields.filter((entry) => typeof entry === 'string')
            : []
          const remainingMissingFields = previousMissingFields.filter(
            (entry) => !quoteAttributeOnlyFollowUp.keys.includes(entry),
          )

          return {
            ...previousQuoteContext,
            missingFields: remainingMissingFields,
            completionStatus: remainingMissingFields.length ? 'needs_info' : 'ready_for_handoff',
          }
        })()
      : null
  const effectiveQuoteContext = quoteContext || fallbackQuoteContext
  const shouldBuildScheduleContext =
    isCustomerRole(role) &&
    (() => {
      const explicitScheduleSignal =
        intentDetection?.intent === 'customer.schedule_request' ||
        looksLikeScheduleSeedInput(currentTurnText, tenantRuntimePolicy)
      const explicitScheduleCancellation =
        intentDetection?.intent === 'customer.cancellation' &&
        Boolean(
          previousScheduleContext ||
            previousIntentKey === 'customer.schedule_request' ||
            previousConversationContext?.activeDomain === 'schedule',
        )
      const contextualScheduleSignal =
        looksLikeScheduleAdministrativePayload(currentTurnText) &&
        (previousIntentKey === 'customer.schedule_request' ||
          previousConversationContext?.activeDomain === 'schedule' ||
          previousSupportContext?.wantsVisit === true ||
          previousIntentKey === 'customer.support_request')
      const carriedScheduleLane =
        (previousConversationContext?.activeDomain === 'schedule' ||
          previousIntentKey === 'customer.schedule_request') &&
        (looksLikeScheduleAdministrativePayload(currentTurnText) ||
          looksLikeScheduleAcknowledgement(currentTurnText))

      return (
        explicitScheduleSignal ||
        explicitScheduleCancellation ||
        contextualScheduleSignal ||
        carriedScheduleLane
      )
    })()
  const scheduleContext = shouldBuildScheduleContext
    ? buildCustomerScheduleContext({
        currentTurnText,
        previousScheduleContext,
        previousQuoteContext,
        currentTopic: canonicalTopic,
        previousIntentKey,
        previousCanonicalTopic: previousTopic,
        nluAnalysis,
      })
    : null
  const supportContext =
    shouldCarrySupportContext({
      role,
      currentTurnText,
      normalizedCurrentTurnText,
      intentDetection,
      previousIntentKey,
      previousSupportContext,
      previousScheduleContext,
      previousConversationContext,
      quoteContext,
      tenantTopicTaxonomy,
      tenantRuntimePolicy,
      followUpDetected,
      attachmentArtifactTurn,
    })
      ? buildCustomerSupportContext({
          currentTurnText,
          previousSupportContext,
          previousScheduleContext,
          currentScheduleContext: scheduleContext,
          currentTopic: canonicalTopic,
          previousQuoteContext,
          tenantTopicTaxonomy,
          tenantRuntimePolicy,
        })
      : null
  const retrievalQuery = buildRetrievalQuery({
    currentTurnText: normalizedCurrentTurnText,
    intentKey: intentDetection?.intent || null,
    topic: canonicalTopic,
    previousTopic,
    previousQuoteContext,
    faqSubtype,
    quoteContext,
    threadResolution,
    tenantTopicTaxonomy,
  })
  const conversationContext = buildConversationContext({
    role,
    currentTurnText,
    attachmentArtifactTurn,
    inboundClassification,
    intentDetection,
    previousIntentKey,
    previousConversationContext,
    previousQuoteContext,
    tenantRuntimePolicy,
    topic: canonicalTopic,
    contextTopic: previousTopic,
    quoteContext: effectiveQuoteContext,
    supportContext,
    scheduleContext,
    faqSubtype,
    followUp: {
      detected: Boolean(followUpDetected),
      quantityOnly: Boolean(quantityOnlyFollowUp),
      measurementOnly: Boolean(measurementOnlyFollowUp),
      attributeOnly: Boolean(quoteAttributeOnlyFollowUp.detected),
      attributeKeys: quoteAttributeOnlyFollowUp.keys,
      confirmationOnly: Boolean(confirmationOnlyFollowUp),
      quoteConfirmation: Boolean(quoteConfirmationFollowUp),
      quoteWaiting: Boolean(quoteWaitingFollowUp),
    },
    threadResolution,
    nluAnalysis,
  })

  return {
    originalInput: String(originalInput || ''),
    effectiveInput: String(effectiveInput || ''),
    normalizedInput: String(normalizedInput || ''),
    currentTurnText,
    attachmentArtifactTurn,
    normalizedCurrentTurn,
    reasoningInput: String(reasoningInput || ''),
    category: inboundClassification?.category || 'other',
    intent: {
      key: intentDetection?.intent || 'unknown',
      confidence:
        typeof intentDetection?.confidence === 'number'
          ? intentDetection.confidence
          : 0,
      source: intentDetection?.source || 'rule',
      inherited: Boolean(intentInherited),
    },
    followUp: {
      detected: Boolean(followUpDetected),
      inheritedIntentKey: intentInherited ? previousIntentKey : null,
      confidence: followUpDetected ? (intentInherited ? 0.92 : 0.76) : 0,
      source: followUpDetected ? 'conversation_memory' : 'none',
      quantityOnly: Boolean(quantityOnlyFollowUp),
      measurementOnly: Boolean(measurementOnlyFollowUp),
      attributeOnly: Boolean(quoteAttributeOnlyFollowUp.detected),
      attributeKeys: quoteAttributeOnlyFollowUp.keys,
      confirmationOnly: Boolean(confirmationOnlyFollowUp),
      quoteConfirmation: Boolean(quoteConfirmationFollowUp),
      quoteWaiting: Boolean(quoteWaitingFollowUp),
      referencedMessageCount: Array.isArray(referencedMessages)
        ? referencedMessages.length
        : 0,
    },
    topic: canonicalTopic,
    contextTopic: previousTopic
      ? {
          label: previousTopic.label,
          type: previousTopic.type || 'unknown',
          confidence:
            typeof previousTopic.confidence === 'number' ? previousTopic.confidence : 0,
          source: previousTopic.source || 'conversation_memory',
          tokens: Array.isArray(previousTopic.tokens)
            ? previousTopic.tokens
            : extractTopicTokens(previousTopic.label || ''),
        }
      : null,
    conversationContext,
    resolutionReadiness: conversationContext?.resolutionReadiness || null,
    quoteContext: effectiveQuoteContext,
    supportContext,
    scheduleContext,
    faqSubtype,
    retrievalQuery,
    operationalQuery: retrievalQuery,
    threadResolution,
    nlu: nluAnalysis,
  }
}

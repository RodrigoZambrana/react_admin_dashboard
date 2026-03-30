import {
  detectCustomerFaqSubtype,
  extractCurrentCustomerTurnText,
  extractSemanticCustomerTurnText,
  extractRequestedTopicLabel,
} from './customer-faq-heuristics.js'
import {
  BASE_CONVERSATIONAL_ES_SIGNALS,
  countStemMatches,
  detectStandaloneAttachmentArtifactKind,
  hasMultimodalReferenceSignal,
  hasQuantityOnlyFollowUpSignal,
  looksLikeOpeningStructureSignal,
  looksLikeQuoteExpansionSignal,
  hasReengagementReferenceSignal,
  hasScheduleAdministrativeSignal,
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
  extractCustomerQuoteLeadText,
  extractCustomerQuotedMeasurements,
} from './customer-quote-context.js'
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

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

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
  'serie',
  'linea',
  'lineas',
  'color',
  'blanco',
  'blanca',
  'blancos',
  'blancas',
  'negro',
  'negra',
  'negros',
  'negras',
  'gris',
  'plateado',
  'bronce',
  'dvh',
  'doble',
  'vidrio',
  'vidriado',
  'hermetico',
  'hermetica',
])

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

const looksLikeScheduleSeedInput = (currentTurnText) => {
  const text = String(currentTurnText || '')
  if (looksLikeCommercialConditionQuestion(text)) {
    return false
  }

  return looksLikeCustomerScheduleAvailabilityRequest(text)
}

const looksLikeScheduleAdministrativePayload = (currentTurnText) =>
  hasScheduleAdministrativeSignal(currentTurnText)

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

const extractTopicTokens = (value) =>
  normalizeText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !TOPIC_STOP_TOKENS.has(token))

const looksLikePriceOrQuoteTurn = (value) =>
  looksLikeGenericPriceInquiry(String(value || ''))

const selectPreferredTopicMatchFromInput = (value, tenantTopicTaxonomy = []) => {
  const normalizedInput = normalizeText(value)
  const matches = findTenantTopicMatches(value, tenantTopicTaxonomy, {
    kinds: ['product_family', 'product_topic', 'product_variant'],
    limit: 6,
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
  if (!cleanLabel) {
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

const resolveTopicLabel = (label, tenantTopicTaxonomy = []) => {
  const cleanLabel = String(label || '').replace(/\s+/g, ' ').trim()
  if (!cleanLabel) {
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
        TOPIC_RESOLUTION_FILLER_TOKENS.has(token) ||
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

const isAberturasScopedTopic = (topic, tenantTopicTaxonomy = []) => {
  const topicLabel = String(topic?.label || '').trim()
  if (!topicLabel) {
    return false
  }

  if (/\babertur/.test(normalizeText(topicLabel))) {
    return true
  }

  return (
    extractTenantFamilyLabel(topicLabel, tenantTopicTaxonomy) === 'aberturas' ||
    extractTenantFamilyLabel(topic?.familyLabel || '', tenantTopicTaxonomy) === 'aberturas'
  )
}

const buildAberturasCanonicalTopic = (tenantTopicTaxonomy = []) => {
  const resolvedLabel = resolveTopicLabel('aberturas', tenantTopicTaxonomy) || 'aberturas'
  return buildCanonicalTopic({
    label: resolvedLabel,
    type: inferTopicType(resolvedLabel, null, tenantTopicTaxonomy),
    confidence: 0.82,
    source: 'opening_structure_heuristic',
  })
}

const buildRetrievalQuery = ({
  currentTurnText,
  intentKey,
  topic,
  previousTopic,
  faqSubtype,
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
      extractTenantFamilyLabel(previousTopic?.label || '', tenantTopicTaxonomy)
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

    return queryParts.join(' ').replace(/\s+/g, ' ').trim()
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
    detectStandaloneAttachmentArtifactKind(rawCurrentTurnText),
  )
  const topicDetectionInput =
    intentDetection?.intent === 'customer.quote' ||
    intentDetection?.intent === 'customer.price_inquiry'
      ? extractCustomerQuoteLeadText(currentTurnText)
      : currentTurnText
  const normalizedTopicDetectionInput =
    intentDetection?.intent === 'customer.quote' ||
    intentDetection?.intent === 'customer.price_inquiry'
      ? extractCustomerQuoteLeadText(normalizedCurrentTurnText)
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
  const followUpDetected =
    isCustomerRole(role) &&
    Boolean(previousIntentKey) &&
    (attachmentArtifactTurn ||
      looksLikeEllipticFollowUp(normalizedCurrentTurnText) ||
      looksLikeReferentialFollowUp(normalizedCurrentTurnText) ||
      measurementOnlyFollowUp ||
      quantityOnlyFollowUp ||
      quoteWaitingFollowUp)
  const intentInherited =
    followUpDetected &&
    Boolean(previousIntentKey) &&
    intentDetection?.intent === previousIntentKey

  const faqSubtype = detectCustomerFaqSubtype(normalizedCurrentTurnText, {
    previousIntentKey,
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
    : resolveTopicLabel(requestedTopicLabel, tenantTopicTaxonomy)
  const preferStandaloneVariantTopic =
    requestedTopicMatch?.kind === 'product_variant' && !previousTopic?.label
  const openingStructureSignal = looksLikeOpeningStructureSignal(currentTurnText)
  const quoteExpansionSignal = looksLikeQuoteExpansionSignal(currentTurnText)

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

  if (!canonicalTopic && (followUpDetected || attachmentArtifactTurn) && previousTopic?.label) {
    canonicalTopic = buildCanonicalTopic({
      label: previousTopic.label,
      type: previousTopic.type || 'unknown',
      confidence: 0.66,
      source: 'conversation_memory',
    })
  }

  if (
    openingStructureSignal &&
    !isAberturasScopedTopic(canonicalTopic, tenantTopicTaxonomy)
  ) {
    canonicalTopic = buildAberturasCanonicalTopic(tenantTopicTaxonomy)
  }

  if (
    !canonicalTopic &&
    previousTopic?.label &&
    (looksLikeQuoteRequirementsQuestion(normalizedCurrentTurnText) ||
      looksLikeConfiguredProductInterest(
        normalizedCurrentTurnText,
        tenantTopicTaxonomy,
      ) ||
      measurementOnlyFollowUp ||
      quantityOnlyFollowUp ||
      quoteWaitingFollowUp)
  ) {
    canonicalTopic = buildCanonicalTopic({
      label: previousTopic.label,
      type: previousTopic.type || 'unknown',
      confidence: 0.72,
      source: 'conversation_memory',
    })
  }

  if (
    !canonicalTopic &&
    quoteExpansionSignal &&
    previousTopic?.label
  ) {
    canonicalTopic = buildCanonicalTopic({
      label: previousTopic.label,
      type: previousTopic.type || 'unknown',
      confidence: 0.74,
      source: 'quote_expansion_memory',
    })
  }

  if (attachmentArtifactTurn && previousTopic?.label) {
    canonicalTopic = buildCanonicalTopic({
      label: previousTopic.label,
      type: previousTopic.type || 'unknown',
      confidence: 0.78,
      source: 'attachment_memory',
    })
  }

  const retrievalQuery = buildRetrievalQuery({
    currentTurnText: normalizedCurrentTurnText,
    intentKey: intentDetection?.intent || null,
    topic: canonicalTopic,
    previousTopic,
    faqSubtype,
    tenantTopicTaxonomy,
  })
  const shouldCarryQuoteContextFromMemory =
    Boolean(previousTopic?.label) &&
    (attachmentArtifactTurn ||
      followUpDetected ||
      looksLikeQuoteRequirementsQuestion(normalizedCurrentTurnText) ||
      looksLikeConfiguredProductInterest(
        normalizedCurrentTurnText,
        tenantTopicTaxonomy,
      ) ||
      looksLikeGenericPriceInquiry(normalizedCurrentTurnText) ||
      quantityOnlyFollowUp ||
      quoteWaitingFollowUp ||
      (canonicalTopic?.label &&
        normalizeText(canonicalTopic.label) === normalizeText(previousTopic.label)))
  const quoteContext = buildCustomerQuoteContext({
    currentTurnText,
    topic: canonicalTopic,
    previousTopic,
    previousQuoteContext:
      shouldCarryQuoteContextFromMemory &&
      previousQuoteContext
        ? previousQuoteContext
        : null,
    tenantTopicTaxonomy,
    tenantQuoteProfiles,
  })
  const shouldBuildScheduleContext =
    isCustomerRole(role) &&
    (() => {
      const explicitScheduleSignal =
        intentDetection?.intent === 'customer.schedule_request' ||
        looksLikeScheduleSeedInput(currentTurnText)
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

      return explicitScheduleSignal || contextualScheduleSignal || carriedScheduleLane
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
        })
      : null
  const conversationContext = buildConversationContext({
    role,
    currentTurnText,
    inboundClassification,
    intentDetection,
    previousConversationContext,
    topic: canonicalTopic,
    quoteContext,
    supportContext,
    scheduleContext,
    followUp: {
      detected: Boolean(followUpDetected),
    },
    threadResolution,
    nluAnalysis,
  })

  return {
    originalInput: String(originalInput || ''),
    effectiveInput: String(effectiveInput || ''),
    normalizedInput: String(normalizedInput || ''),
    currentTurnText,
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
    quoteContext,
    supportContext,
    scheduleContext,
    retrievalQuery,
    operationalQuery: retrievalQuery,
    threadResolution,
    nlu: nluAnalysis,
  }
}

import { normalizeSemanticText } from '../intents/customer-semantic-signals.js'
import { buildQuoteProgressionPolicy } from './quote-progression-policy.js'
import {
  buildConversationState,
  filterResolvedConversationFields,
  resolveNextConversationField,
} from './conversation-state.js'

const normalizeText = normalizeSemanticText

const EXPLORATION_INTENTS = new Set([
  'customer.product_info',
  'customer.topic_info',
  'customer.price_inquiry',
  'customer.clarify_request',
  'customer.rephrase_request',
])

const OPERATIONAL_INTENTS = new Set([
  'customer.quote',
  'customer.support_request',
  'customer.schedule_request',
  'customer.contact_info',
  'customer.order_status',
  'customer.auth_required',
  'customer.owned_document_request',
  'customer.private_account_data',
])

const BUSINESS_FACT_INTENTS = new Set([
  'customer.topic_info',
  'customer.contact_info',
])

const SIDE_QUESTION_FAQ_SUBTYPES = new Set([
  'business_hours',
  'location',
  'payment_methods',
  'contact',
  'installation',
])

const QUESTION_LIKE_REGEX =
  /[?¿]|\b(cu[aá]nto|que|qué|como|cómo|cu[aá]l|cuando|cuándo|pueden|podr[ií]an)\b/u
const THOUGHT_IN_PROGRESS_REGEX =
  /(?:\b(de|con|para|porque|por|y|o|que|qué|si|sí|pero|aunque)\s*|[:,-]\s*)$/u
const RESET_CUE_REGEX =
  /\b(?:nuevo caso|nuevo tema|otra consulta|otro tema|cambiando de tema|dejando eso|aparte|por otro lado)\b/iu
const ATTACHMENT_PLACEHOLDER_REGEX =
  /(?:archivo adjunto|multimedia omitido|(?:^|[\s(])(?:img|vid|image|video)[-_][a-z0-9._-]+(?:\)|\s|$)|\.(?:jpg|jpeg|png|webp|mp4|mov|pdf)\b)/iu
const SCHEDULE_TURN_SIGNAL_REGEX =
  /\b(agendar|agenda|visita|coordinar|coordino|coordinarla|coordinarlo|puedo|podemos|pueden|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|mañana|pasado|hoy|a las|entre las|\d{1,2}:\d{2}|direccion|dirección|domicilio|calle|esquina|whatsapp|tel[eé]fono|contacto)\b/iu
const QUOTE_SEED_INPUT_REGEX =
  /\b(?:necesit[a-záéíóúñ]*|precis[a-záéíóúñ]*|cotiz[a-záéíóúñ]*|presupuest[a-záéíóúñ]*|me interesa)\b/u
const LIGHT_CLOSURE_FOLLOW_UP_REGEX =
  /^(ok|dale|perfecto|listo|gracias|muchas gracias|saludos?|buen dia|buenos dias|buenas tardes|buenas noches|claro|bien|genial|barbaro|b[aá]rbaro)(?:\s+(ok|dale|perfecto|listo|gracias|muchas gracias|saludos?|buen dia|buenos dias|buenas tardes|buenas noches|claro|bien|genial|barbaro|b[aá]rbaro))*$/iu
const LIGHT_CLOSURE_CONTINUATION_REGEX =
  /\b(vemos?\s+mas\s+adelante|vemos?\s+m[aá]s\s+adelante|lo\s+vemos?\s+mas\s+adelante|lo\s+vemos?\s+m[aá]s\s+adelante|por\s+ahora\s+no|por\s+ahora\s+no\s+puedo|m[aá]s\s+adelante|despu[eé]s\s+vemos|veo\s+y\s+me\s+comunico|te\s+aviso|les\s+aviso)\b/iu

const readPreviousLane = (previousConversationContext = null) => {
  if (
    previousConversationContext?.resolutionReadiness &&
    typeof previousConversationContext.resolutionReadiness === 'object' &&
    typeof previousConversationContext.resolutionReadiness.lane === 'string'
  ) {
    return previousConversationContext.resolutionReadiness.lane
  }

  if (typeof previousConversationContext?.activeDomain === 'string') {
    return previousConversationContext.activeDomain
  }

  return null
}

const looksLikeLightClosureFollowUp = (value = '') => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  return (
    LIGHT_CLOSURE_FOLLOW_UP_REGEX.test(normalized) ||
    LIGHT_CLOSURE_CONTINUATION_REGEX.test(normalized)
  )
}

const looksLikeExploratoryProductSwitch = ({
  currentTurnText = '',
  intentKey = null,
  topic = null,
  threadResolution = null,
  previousConversationContext = null,
} = {}) => {
  const normalizedIntent = String(intentKey || '').trim()
  if (!['customer.quote', 'customer.price_inquiry'].includes(normalizedIntent)) {
    return false
  }

  const previousTopicLabel = normalizeText(
    previousConversationContext?.topicLabel ||
      previousConversationContext?.resolutionReadiness?.knownFacts?.topic ||
      '',
  )
  const currentTopicLabel = normalizeText(topic?.label || '')
  const topicSwitched =
    threadResolution?.switchDetected === true ||
    (previousTopicLabel &&
      currentTopicLabel &&
      previousTopicLabel !== currentTopicLabel)

  if (!topicSwitched) {
    return false
  }

  if (
    !['product_family', 'product_topic', 'product_variant'].includes(
      String(topic?.type || ''),
    )
  ) {
    return false
  }

  const normalized = normalizeText(currentTurnText)
  if (!normalized || !QUESTION_LIKE_REGEX.test(normalized)) {
    return false
  }

  if (
    QUOTE_SEED_INPUT_REGEX.test(normalized) ||
    /\b\d{1,4}\s*[xX]\s*\d{1,4}\b/u.test(String(currentTurnText || '')) ||
    /\b\d+\b/u.test(normalized)
  ) {
    return false
  }

  return true
}

const resolveReadinessTurnIntent = ({
  intentKey = null,
  inboundCategory = null,
  faqSubtype = null,
  topic = null,
  scheduleContext = null,
  previousConversationContext = null,
  followUp = null,
  currentTurnText = '',
  threadResolution = null,
}) => {
  const normalizedIntent =
    typeof intentKey === 'string' && intentKey.trim() ? intentKey.trim() : null

  if (normalizedIntent && normalizedIntent !== 'unknown') {
    if (
      looksLikeExploratoryProductSwitch({
        currentTurnText,
        intentKey: normalizedIntent,
        topic,
        threadResolution,
        previousConversationContext,
      })
    ) {
      return 'customer.product_info'
    }
    return normalizedIntent
  }

  if (
    faqSubtype === 'variants' &&
    ['product_family', 'product_topic', 'product_variant'].includes(
      String(topic?.type || ''),
    )
  ) {
    return 'customer.product_info'
  }

  const previousLane = readPreviousLane(previousConversationContext)
  if (
    previousLane === 'schedule' &&
    scheduleContext &&
    (
      inboundCategory === 'confirmation' ||
      inboundCategory === 'courtesy' ||
      Boolean(followUp?.detected)
    )
  ) {
    return 'customer.schedule_request'
  }

  return normalizedIntent
}

export const determineActiveLane = ({
  intentKey = null,
  inboundCategory = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  topic = null,
  faqSubtype = null,
  previousConversationContext = null,
  threadResolution = null,
}) => {
  const previousLane = readPreviousLane(previousConversationContext)
  const directLaneByIntent = {
    'customer.schedule_request': 'schedule',
    'customer.support_request': 'support',
    'customer.quote': 'quote',
    'customer.price_inquiry': 'quote',
    'customer.contact_info': 'contact',
    'customer.private_account_data': 'general',
    'customer.order_status': 'general',
    'customer.auth_required': 'general',
    'customer.owned_document_request': 'general',
  }
  const hasSupportLane =
    Boolean(supportContext) ||
    intentKey === 'customer.support_request' ||
    inboundCategory === 'support_request'
  const hasQuoteLane =
    Boolean(quoteContext) ||
    intentKey === 'customer.quote' ||
    intentKey === 'customer.price_inquiry' ||
    inboundCategory === 'price_inquiry'
  const hasScheduleLane =
    Boolean(scheduleContext) ||
    intentKey === 'customer.schedule_request' ||
    inboundCategory === 'schedule_request'

  if (directLaneByIntent[String(intentKey || '')]) {
    return directLaneByIntent[String(intentKey || '')]
  }

  if (hasSupportLane && previousLane === 'support') {
    return 'support'
  }

  if (hasScheduleLane && previousLane === 'schedule') {
    return 'schedule'
  }

  if (hasQuoteLane && previousLane === 'quote') {
    return 'quote'
  }

  if (hasSupportLane) {
    return 'support'
  }

  if (hasScheduleLane) {
    return 'schedule'
  }

  if (hasQuoteLane) {
    return 'quote'
  }

  if (intentKey === 'customer.multi_intent' || inboundCategory === 'multi_intent') {
    if (typeof previousLane === 'string') {
      return previousLane
    }

    return 'general'
  }

  const previousOperationalLane = ['quote', 'support', 'schedule'].includes(
    String(previousLane || ''),
  )
  const activeOperationalThread =
    previousOperationalLane &&
    (
      typeof previousConversationContext?.threadKey === 'string' ||
      typeof previousConversationContext?.resumePointer === 'string' ||
      Boolean(threadResolution?.activeThreadKey)
    )

  if (
    activeOperationalThread &&
    (
      topic?.type === 'business_fact' ||
      SIDE_QUESTION_FAQ_SUBTYPES.has(String(faqSubtype || '')) ||
      BUSINESS_FACT_INTENTS.has(String(intentKey || '')) ||
      inboundCategory === 'faq_topic'
    )
  ) {
    return previousLane
  }

  if (
    intentKey === 'customer.contact_info' ||
    inboundCategory === 'contact' ||
    faqSubtype === 'contact'
  ) {
    return 'contact'
  }

  if (
    topic?.type === 'business_fact' ||
    SIDE_QUESTION_FAQ_SUBTYPES.has(String(faqSubtype || '')) ||
    BUSINESS_FACT_INTENTS.has(String(intentKey || '')) ||
    inboundCategory === 'faq_topic'
  ) {
    return 'business_info'
  }

  if (typeof previousLane === 'string') {
    return previousLane
  }

  return 'general'
}

export const resolveReadinessMissingFields = ({
  lane = 'general',
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
}) => {
  if (lane === 'schedule' && Array.isArray(scheduleContext?.missingFields)) {
    return scheduleContext.missingFields.filter((entry) => typeof entry === 'string')
  }

  if (lane === 'support' && Array.isArray(supportContext?.missingFields)) {
    return supportContext.missingFields.filter((entry) => typeof entry === 'string')
  }

  if (lane === 'quote' && Array.isArray(quoteContext?.missingFields)) {
    return quoteContext.missingFields.filter((entry) => typeof entry === 'string')
  }

  return []
}

export const buildKnownFacts = ({
  topic = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
}) => {
  const facts = {}

  if (typeof topic?.label === 'string' && topic.label.trim()) {
    facts.topic = topic.label.trim()
  }

  if (typeof quoteContext?.quantity?.total === 'number') {
    facts.quantity = quoteContext.quantity.total
  }
  if (quoteContext?.measurements?.displayLabel) {
    facts.measurements = quoteContext.measurements.displayLabel
  }

  if (typeof supportContext?.productType === 'string') {
    facts.supportProduct = supportContext.productType
  }
  if (typeof supportContext?.issueSummary === 'string') {
    facts.supportIssue = supportContext.issueSummary
  }

  if (typeof scheduleContext?.address === 'string') {
    facts.address = scheduleContext.address
  }
  if (scheduleContext?.date?.dateLabel) {
    facts.day = scheduleContext.date.dateLabel
  }
  if (scheduleContext?.time?.timeLabel) {
    facts.time = scheduleContext.time.timeLabel
  }

  return facts
}

const resolveSideQuestionSubtype = ({
  lane = 'general',
  turnIntent = null,
  inboundCategory = null,
  faqSubtype = null,
  previousConversationContext = null,
}) => {
  const previousLane = readPreviousLane(previousConversationContext)
  const isOperationalLane =
    ['quote', 'support', 'schedule'].includes(String(lane || '')) ||
    ['quote', 'support', 'schedule'].includes(String(previousLane || ''))

  if (!isOperationalLane) {
    return null
  }

  if (
    turnIntent === 'customer.contact_info' ||
    inboundCategory === 'contact' ||
    faqSubtype === 'contact'
  ) {
    return 'contact'
  }

  if (SIDE_QUESTION_FAQ_SUBTYPES.has(String(faqSubtype || ''))) {
    return faqSubtype
  }

  return null
}

const OPERATIONAL_LANES = new Set(['quote', 'support', 'schedule'])

const readPreviousResumePointer = (previousConversationContext = null) => {
  const explicitPointer =
    typeof previousConversationContext?.resumePointer === 'string'
      ? previousConversationContext.resumePointer.trim()
      : ''
  if (explicitPointer) {
    return explicitPointer
  }

  const previousReadiness =
    previousConversationContext?.resolutionReadiness &&
    typeof previousConversationContext.resolutionReadiness === 'object'
      ? previousConversationContext.resolutionReadiness
      : null
  const readinessPointer =
    typeof previousReadiness?.nextUsefulField === 'string'
      ? previousReadiness.nextUsefulField.trim()
      : ''

  return readinessPointer || null
}

const shouldResumeOperationalFlow = ({
  lane = null,
  previousLane = null,
  followUp = null,
  threadResolution = null,
  previousConversationContext = null,
  sideQuestionSubtype = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  attachmentArtifactTurn = false,
} = {}) => {
  if (
    !OPERATIONAL_LANES.has(String(previousLane || '')) ||
    !OPERATIONAL_LANES.has(String(lane || ''))
  ) {
    return false
  }

  if (String(previousLane || '') === String(lane || '')) {
    return true
  }

  if (sideQuestionSubtype) {
    return true
  }

  if (followUp?.detected === true) {
    return true
  }

  if (attachmentArtifactTurn === true) {
    return true
  }

  if (threadResolution?.activeThreadKey) {
    return true
  }

  if (previousConversationContext?.threadKey) {
    return true
  }

  return Boolean(quoteContext || supportContext || scheduleContext)
}

const resolveQuoteStructuralMissingFields = ({
  missingFields = [],
  quoteContext = null,
}) => {
  const normalizedMissingFields = (Array.isArray(missingFields) ? missingFields : []).filter(
    (entry) => typeof entry === 'string' && entry.trim(),
  )
  const requiredAttributeKeys = new Set(
    (Array.isArray(quoteContext?.requiredAttributes)
      ? quoteContext.requiredAttributes
      : []
    )
      .map((attribute) =>
        typeof attribute?.key === 'string' ? attribute.key.trim() : '',
      )
      .filter(Boolean),
  )

  const structuralFieldKeys = new Set([
    'product',
    'quantity',
    'measurements',
    ...requiredAttributeKeys,
    ...normalizedMissingFields,
  ])

  return normalizedMissingFields.filter(
    (entry) => typeof entry === 'string' && structuralFieldKeys.has(entry),
  )
}

const analyzeWaitForMoreInput = ({
  currentTurnText,
  inboundCategory = null,
  turnIntent = null,
  lane = 'general',
  quoteContext = null,
  supportContext = null,
  followUp = null,
  missingFields = [],
  sideQuestionSubtype = null,
  quoteOriginThread = false,
  resumeOperationalFlow = false,
}) => {
  const normalized = normalizeText(currentTurnText)
  const reasons = []

  if (!normalized) {
    return {
      waitForMore: false,
      reasons,
    }
  }

  if (sideQuestionSubtype) {
    return {
      waitForMore: false,
      reasons,
    }
  }

  if (inboundCategory === 'incomplete' || turnIntent === 'customer.incomplete') {
    reasons.push('incomplete_input')
    return {
      waitForMore: true,
      reasons,
    }
  }

  if (THOUGHT_IN_PROGRESS_REGEX.test(String(currentTurnText || '').trim())) {
    reasons.push('trailing_thought')
    return {
      waitForMore: true,
      reasons,
    }
  }

  if (lane === 'quote') {
    const structuralMissingFields = resolveQuoteStructuralMissingFields({
      missingFields,
      quoteContext,
    })
    const quoteProgression = buildQuoteProgressionPolicy({
      input: currentTurnText,
      intentKey: turnIntent,
      turnIntent,
      quoteContext,
      followUp,
      missingFields,
      sideQuestionSubtype,
    })
    if (quoteProgression.preferInformationFirst) {
      return {
        waitForMore: false,
        reasons,
      }
    }

    if (
      quoteOriginThread === true &&
      resumeOperationalFlow === true &&
      followUp?.detected === true &&
      !quoteProgression.slotOnlyFollowUp &&
      !quoteProgression.quoteSeedDetected &&
      !QUESTION_LIKE_REGEX.test(normalized)
    ) {
      return {
        waitForMore: false,
        reasons,
      }
    }

    const hasConcreteQuotePayload =
      Boolean(quoteContext?.measurements) ||
      (Array.isArray(quoteContext?.measurementItems) &&
        quoteContext.measurementItems.length > 0) ||
      Number(quoteContext?.quantity?.total || 0) > 0
    const shouldHoldAsQuoteFragment =
      quoteOriginThread === true ||
      turnIntent === 'customer.quote' ||
      quoteProgression.quoteSeedDetected === true ||
      hasConcreteQuotePayload

    if (
      shouldHoldAsQuoteFragment &&
      structuralMissingFields.length > 0 &&
      followUp?.detected &&
      (
        quoteProgression.quantityOnlyFollowUp ||
        quoteProgression.measurementOnlyFollowUp ||
        quoteProgression.attributeOnlyFollowUp
      )
    ) {
      reasons.push('quote_related_fragment')
      if (quoteProgression.quantityOnlyFollowUp) {
        reasons.push('quote_missing_measurements')
      }
      if (quoteProgression.measurementOnlyFollowUp) {
        reasons.push('quote_missing_quantity')
      }
      if (
        quoteProgression.attributeOnlyFollowUp &&
        Array.isArray(quoteProgression.attributeKeys)
      ) {
        quoteProgression.attributeKeys.forEach((field) => {
          reasons.push(`quote_missing_${field}`)
        })
      }
      return {
        waitForMore: true,
        reasons,
      }
    }
    if (
      !QUESTION_LIKE_REGEX.test(normalized) &&
      structuralMissingFields.length > 0 &&
      !hasConcreteQuotePayload &&
      normalized.split(/\s+/u).length <= 6
    ) {
      reasons.push('short_quote_seed')
      return {
        waitForMore: true,
        reasons,
      }
    }
  }

  if (
    lane === 'support' &&
    supportContext &&
    !supportContext.issueSummary &&
    typeof supportContext.productType === 'string' &&
    normalizeText(supportContext.productType) === normalized
  ) {
    reasons.push('support_product_only')
    return {
      waitForMore: true,
      reasons,
    }
  }

  return {
    waitForMore: false,
    reasons,
  }
}

const buildUserGoal = (lane) =>
  lane === 'quote'
    ? 'cotizar'
    : lane === 'support'
      ? 'resolver soporte o reparación'
      : lane === 'schedule'
        ? 'coordinar una visita'
        : lane === 'contact'
          ? 'obtener datos de contacto'
        : 'entender la consulta'

const normalizeContextMissingFields = ({
  context = null,
  conversationState = null,
} = {}) => {
  if (!context || typeof context !== 'object') {
    return context
  }

  const missingFields = filterResolvedConversationFields({
    missingFields: Array.isArray(context?.missingFields) ? context.missingFields : [],
    conversationState,
  })

  return {
    ...context,
    missingFields,
  }
}

export const normalizeOperationalContextsWithConversationState = ({
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  conversationState = null,
} = {}) => {
  const normalizedQuoteContext = normalizeContextMissingFields({
    context: quoteContext,
    conversationState,
  })
  const unresolvedQuoteFields = new Set(
    Array.isArray(normalizedQuoteContext?.missingFields)
      ? normalizedQuoteContext.missingFields
      : [],
  )
  const normalizedQuoteMissingAttributes = Array.isArray(quoteContext?.missingAttributes)
    ? quoteContext.missingAttributes.filter(
        (entry) =>
          entry &&
          typeof entry === 'object' &&
          unresolvedQuoteFields.has(String(entry.key || '').trim()),
      )
    : Array.isArray(quoteContext?.requiredAttributes)
      ? quoteContext.requiredAttributes.filter(
          (entry) =>
            entry &&
            typeof entry === 'object' &&
            unresolvedQuoteFields.has(String(entry.key || '').trim()),
        )
      : []

  return {
    quoteContext:
      normalizedQuoteContext && typeof normalizedQuoteContext === 'object'
        ? {
            ...normalizedQuoteContext,
            missingAttributes: normalizedQuoteMissingAttributes,
          }
        : normalizedQuoteContext,
    supportContext: normalizeContextMissingFields({
      context: supportContext,
      conversationState,
    }),
    scheduleContext: normalizeContextMissingFields({
      context: scheduleContext,
      conversationState,
    }),
  }
}

export const stabilizeReadinessWithConversationState = ({
  readiness = null,
  conversationState = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
} = {}) => {
  if (!readiness || typeof readiness !== 'object') {
    return readiness
  }

  const missingFields = filterResolvedConversationFields({
    missingFields: Array.isArray(readiness?.missingFields) ? readiness.missingFields : [],
    conversationState,
  })
  const nextUsefulField =
    resolveNextConversationField({
      requestedField:
        typeof readiness?.nextUsefulField === 'string' ? readiness.nextUsefulField : null,
      missingFields,
      conversationState,
    }) ||
    missingFields[0] ||
    null

  let answerMode =
    typeof readiness?.answerMode === 'string' ? readiness.answerMode.trim() : null

  if (answerMode === 'ask_quote_field' && !nextUsefulField) {
    answerMode = 'quote_ready'
  } else if (answerMode === 'ask_support_field' && !nextUsefulField) {
    answerMode = 'continue_support_resolution'
  } else if (answerMode === 'ask_schedule_field' && !nextUsefulField) {
    answerMode = 'confirm_schedule'
  }

  return {
    ...readiness,
    missingFields,
    nextUsefulField,
    answerMode,
  }
}

export const buildResolutionReadiness = ({
  role,
  currentTurnText,
  attachmentArtifactTurn = false,
  inboundClassification = null,
  intentDetection = null,
  previousIntentKey = null,
  previousConversationContext = null,
  topic = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  followUp = null,
  threadResolution = null,
  nluAnalysis = null,
  faqSubtype = null,
  tenantRuntimePolicy = null,
}) => {
  const inboundCategory = inboundClassification?.category || null
  const turnIntent = resolveReadinessTurnIntent({
    intentKey: intentDetection?.intent || null,
    inboundCategory,
    faqSubtype,
    topic,
    scheduleContext,
    previousConversationContext,
    followUp,
    currentTurnText,
    threadResolution,
  })
  const lane = determineActiveLane({
    intentKey: turnIntent,
    inboundCategory,
    quoteContext,
    supportContext,
    scheduleContext,
    topic,
    faqSubtype,
    previousConversationContext,
    threadResolution,
  })
  const rawMissingFields = resolveReadinessMissingFields({
    lane,
    quoteContext,
    supportContext,
    scheduleContext,
  })
  const confidence =
    typeof intentDetection?.confidence === 'number'
      ? Math.max(0, Math.min(1, intentDetection.confidence))
      : typeof previousConversationContext?.confidence === 'number'
      ? previousConversationContext.confidence
      : 0.5
  const previousReadiness =
    previousConversationContext?.resolutionReadiness &&
    typeof previousConversationContext.resolutionReadiness === 'object'
      ? previousConversationContext.resolutionReadiness
      : null
  const previousLane = readPreviousLane(previousConversationContext)
  const previousResumePointer = readPreviousResumePointer(previousConversationContext)
  const resumeOperationalFlow = shouldResumeOperationalFlow({
    lane,
    previousLane,
    followUp,
    threadResolution,
    previousConversationContext,
    sideQuestionSubtype: null,
    quoteContext,
    supportContext,
    scheduleContext,
    attachmentArtifactTurn,
  })
  const provisionalConversationState = buildConversationState({
    previousConversationState: previousConversationContext?.conversationState || null,
    tenantRuntimePolicy,
    readiness: {
      lane,
      turnIntent,
      confidence,
      answerMode: null,
      mode: null,
      nextUsefulField: null,
    },
    intentKey: turnIntent,
    intentConfidence: confidence,
    topic,
    contextTopic: null,
    quoteContext,
    supportContext,
    scheduleContext,
    currentTurnText,
    previousAgentText: previousConversationContext?.conversationState?.context?.lastBotMessage || '',
  })
  const missingFields = filterResolvedConversationFields({
    missingFields: rawMissingFields,
    conversationState: provisionalConversationState,
  })
  const nextUsefulField =
    resolveNextConversationField({
      requestedField: resumeOperationalFlow ? previousResumePointer : null,
      missingFields,
      conversationState: provisionalConversationState,
    }) ||
    missingFields[0] ||
    null
  const sideQuestionSubtype = resolveSideQuestionSubtype({
    lane,
    turnIntent,
    inboundCategory,
    faqSubtype,
    previousConversationContext,
  })
  const quoteProgression =
    lane === 'quote'
      ? buildQuoteProgressionPolicy({
          input: currentTurnText,
          intentKey: turnIntent,
          turnIntent,
          quoteContext,
          followUp,
          missingFields,
          sideQuestionSubtype,
        })
      : null
  const previousIntentWasQuote = String(previousIntentKey || '') === 'customer.quote'
  const previousQuoteDisambiguationPending =
    previousReadiness?.requiresDisambiguation === true ||
    previousReadiness?.quoteMultiTopic === true
  const quoteOriginThread =
    previousIntentWasQuote ||
    (String(previousReadiness?.lane || '') === 'quote' &&
      (
        String(previousReadiness?.turnIntent || '') === 'customer.quote' ||
        previousQuoteDisambiguationPending ||
        previousReadiness?.quoteSeedDetected === true ||
        previousReadiness?.quoteActionReady === true ||
        previousReadiness?.quoteInformationFirst === true ||
        ['ask_quote_field', 'quote_ready', 'inform_then_guide_quote'].includes(
          String(previousReadiness?.answerMode || ''),
        )
      ))
  const waitForMoreAnalysis = analyzeWaitForMoreInput({
    currentTurnText,
    inboundCategory,
    turnIntent,
    lane,
    quoteContext,
    supportContext,
    followUp,
    missingFields,
    sideQuestionSubtype,
    quoteOriginThread,
    resumeOperationalFlow,
  })
  const waitForMore = waitForMoreAnalysis.waitForMore === true
  const previousConversationStage =
    typeof previousConversationContext?.conversationState?.context?.conversationStage === 'string'
      ? previousConversationContext.conversationState.context.conversationStage
      : null
  const lightClosureFollowUp = looksLikeLightClosureFollowUp(currentTurnText)
  const operationalSideQuestionCandidate =
    !sideQuestionSubtype &&
    !waitForMore &&
    ['quote', 'support', 'schedule'].includes(String(lane || '')) &&
    EXPLORATION_INTENTS.has(String(turnIntent || '')) &&
    QUESTION_LIKE_REGEX.test(normalizeText(currentTurnText))
  const topicOnlyTurnText =
    lane === 'quote' &&
    ['customer.product_info', 'customer.topic_info', 'customer.price_inquiry'].includes(
      String(turnIntent || ''),
    ) &&
    ['product_family', 'product_topic', 'product_variant'].includes(String(topic?.type || '')) &&
    !QUESTION_LIKE_REGEX.test(normalizeText(currentTurnText)) &&
    !QUOTE_SEED_INPUT_REGEX.test(normalizeText(currentTurnText)) &&
    !/\b\d{1,4}\s*[xX]\s*\d{1,4}\b/u.test(String(currentTurnText || '')) &&
    !/\b\d+\b/u.test(normalizeText(currentTurnText)) &&
    normalizeText(currentTurnText).split(/\s+/u).filter(Boolean).length <= 4

  let mode = 'exploration'
  let answerMode = 'guided_exploration'

  if (!String(role || '').startsWith('customer_')) {
    mode = 'flow'
    answerMode = 'execute_flow'
  } else if (
    ['greeting', 'courtesy', 'confirmation', 'cancellation'].includes(inboundCategory) ||
    lightClosureFollowUp
  ) {
    mode = 'small_talk'
    answerMode = 'light_turn'
  } else if (
    ['noise', 'unintelligible'].includes(inboundCategory) ||
    threadResolution?.requiresDisambiguation
  ) {
    mode = 'unclear'
    answerMode = 'ask_clarification'
  } else if (sideQuestionSubtype || operationalSideQuestionCandidate) {
    mode = 'exploration'
    answerMode = 'answer_side_question'
  } else if (waitForMore) {
    mode = lane === 'general' ? 'unclear' : 'exploration'
    answerMode = 'hold_for_more_context'
  } else if (lane === 'schedule' && scheduleContext) {
    mode = 'flow'
    answerMode = nextUsefulField ? 'ask_schedule_field' : 'confirm_schedule'
  } else if (lane === 'support' && supportContext) {
    mode = 'flow'
    answerMode = nextUsefulField ? 'ask_support_field' : 'continue_support_resolution'
  } else if (lane === 'quote') {
    const shouldInformThenGuideQuote = quoteProgression?.preferInformationFirst
    const quoteProfileRecognized =
      quoteContext?.profileResolved === true ||
      (typeof quoteContext?.profileKey === 'string' && quoteContext.profileKey.trim())
    const hasConcreteQuotePayload =
      Boolean(quoteContext?.measurements) ||
      (Array.isArray(quoteContext?.measurementItems) &&
        quoteContext.measurementItems.length > 0) ||
      Number(quoteContext?.quantity?.total || 0) > 0 ||
      (quoteContext?.capturedAttributes &&
        typeof quoteContext.capturedAttributes === 'object' &&
        Object.keys(quoteContext.capturedAttributes).length > 0)
    const canStartOperationalQuoteFlow =
      OPERATIONAL_INTENTS.has(String(turnIntent || '')) &&
      hasConcreteQuotePayload &&
      quoteProfileRecognized

    if (shouldInformThenGuideQuote) {
      mode = 'exploration'
      answerMode = 'inform_then_guide_quote'
    } else if (canStartOperationalQuoteFlow) {
      mode = 'flow'
      answerMode = nextUsefulField ? 'ask_quote_field' : 'quote_ready'
    } else {
      mode = 'exploration'
      answerMode = 'guide_quote_exploration'
    }
  } else if (EXPLORATION_INTENTS.has(String(turnIntent || ''))) {
    mode = 'exploration'
    answerMode = 'guided_exploration'
  } else if (OPERATIONAL_INTENTS.has(String(turnIntent || ''))) {
    mode = 'flow'
    answerMode = nextUsefulField ? 'ask_next_useful_field' : 'execute_flow'
  } else {
    mode = 'unclear'
    answerMode = 'ask_clarification'
  }

  return {
    lane,
    turnIntent,
    waitForMore,
    waitForMoreReasons: Array.isArray(waitForMoreAnalysis.reasons)
      ? waitForMoreAnalysis.reasons
      : [],
    missingFields,
    nextUsefulField,
    answerMode,
    mode,
    sideQuestionSubtype,
    parentThreadKey:
      resumeOperationalFlow &&
      typeof previousConversationContext?.threadKey === 'string'
        ? previousConversationContext.threadKey
        : null,
    resumePointer: nextUsefulField || (resumeOperationalFlow ? previousResumePointer : null),
    threadKey:
      typeof threadResolution?.activeThreadKey === 'string'
        ? threadResolution.activeThreadKey
        : typeof previousConversationContext?.threadKey === 'string'
          ? previousConversationContext.threadKey
          : null,
    confidence,
    quoteStage: quoteProgression?.stage || null,
    quoteActionReady: Boolean(quoteProgression?.allowQuoteAction),
    quoteInformationFirst: Boolean(quoteProgression?.preferInformationFirst),
    quoteSeedDetected: Boolean(quoteProgression?.quoteSeedDetected),
    quoteTopicOnlyTurn: Boolean(quoteProgression?.topicOnlyExploration),
    quoteTopicOnlyTurnText: Boolean(topicOnlyTurnText),
    quoteThreadPresent: Boolean(quoteContext),
    quoteMultiTopic: Boolean(quoteContext?.multiTopic),
    quoteOriginThread: Boolean(quoteOriginThread),
    quoteStructuredContext:
      Boolean(quoteProgression?.allowQuoteAction) ||
      Boolean(quoteContext?.measurements) ||
      Number(quoteContext?.quantity?.total || 0) > 0,
    previousIntentWasQuote,
    previousQuoteDisambiguationPending: Boolean(previousQuoteDisambiguationPending),
    resetCueDetected: RESET_CUE_REGEX.test(String(currentTurnText || '')),
    supportThreadPresent: Boolean(supportContext),
    followUpDetected: Boolean(followUp?.detected),
    requiresDisambiguation: Boolean(threadResolution?.requiresDisambiguation),
    artifactTurn:
      attachmentArtifactTurn === true ||
      ATTACHMENT_PLACEHOLDER_REGEX.test(String(currentTurnText || '').trim()),
    scheduleTurnSignals: SCHEDULE_TURN_SIGNAL_REGEX.test(
      normalizeText(currentTurnText),
    ),
    knownFacts: buildKnownFacts({
      topic,
      quoteContext,
      supportContext,
      scheduleContext,
    }),
    userGoal: buildUserGoal(lane),
    nluSource: typeof nluAnalysis?.source === 'string' ? nluAnalysis.source : null,
  }
}

export const readInterpretationResolutionReadiness = (interpretation = null) => {
  if (interpretation?.resolutionReadiness && typeof interpretation.resolutionReadiness === 'object') {
    return interpretation.resolutionReadiness
  }

  if (
    interpretation?.conversationContext?.resolutionReadiness &&
    typeof interpretation.conversationContext.resolutionReadiness === 'object'
  ) {
    return interpretation.conversationContext.resolutionReadiness
  }

  const conversationContext =
    interpretation?.conversationContext && typeof interpretation.conversationContext === 'object'
      ? interpretation.conversationContext
      : null

  if (!conversationContext) {
    return null
  }

  return {
    lane:
      typeof conversationContext.activeDomain === 'string'
        ? conversationContext.activeDomain
        : null,
    turnIntent:
      typeof interpretation?.intent?.key === 'string' ? interpretation.intent.key : null,
    waitForMore: Boolean(conversationContext.waitForMore),
    waitForMoreReasons: Array.isArray(conversationContext.waitForMoreReasons)
      ? conversationContext.waitForMoreReasons
      : [],
    missingFields: [],
    nextUsefulField:
      typeof conversationContext.nextUsefulField === 'string'
        ? conversationContext.nextUsefulField
        : null,
    answerMode:
      typeof conversationContext.responseStrategy === 'string'
        ? conversationContext.responseStrategy
        : null,
    mode: typeof conversationContext.mode === 'string' ? conversationContext.mode : null,
    sideQuestionSubtype: null,
    threadKey:
      typeof conversationContext.threadKey === 'string'
        ? conversationContext.threadKey
        : null,
    confidence:
      typeof conversationContext.confidence === 'number'
        ? conversationContext.confidence
        : null,
    quoteStage:
      typeof conversationContext.quoteStage === 'string'
        ? conversationContext.quoteStage
        : null,
    quoteActionReady: Boolean(conversationContext.quoteActionReady),
    quoteInformationFirst: Boolean(conversationContext.quoteInformationFirst),
    followUpDetected: Boolean(conversationContext.followUpDetected),
    knownFacts:
      conversationContext.knownFacts &&
      typeof conversationContext.knownFacts === 'object' &&
      !Array.isArray(conversationContext.knownFacts)
        ? conversationContext.knownFacts
        : {},
    userGoal:
      typeof conversationContext.userGoal === 'string'
        ? conversationContext.userGoal
        : null,
    nluSource:
      typeof conversationContext.nluSource === 'string'
        ? conversationContext.nluSource
        : null,
  }
}

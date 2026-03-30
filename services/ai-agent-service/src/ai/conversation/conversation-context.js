import { normalizeSemanticText } from '../intents/customer-semantic-signals.js'

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

const QUESTION_LIKE_REGEX = /[?¿]|\b(cu[aá]nto|que|qué|como|cómo|cu[aá]l|cuando|cuándo|pueden|podr[ií]an)\b/u
const THOUGHT_IN_PROGRESS_REGEX =
  /(?:\b(de|con|para|porque|por|y|o|que|qué|si|sí|pero|aunque)\s*|[:,-]\s*)$/u

const determineActiveDomain = ({
  intentKey = null,
  inboundCategory = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  previousConversationContext = null,
}) => {
  const hasSupportDomain =
    Boolean(supportContext) ||
    intentKey === 'customer.support_request' ||
    inboundCategory === 'support_request'
  const hasQuoteDomain =
    Boolean(quoteContext) ||
    ['customer.quote', 'customer.price_inquiry', 'customer.product_info'].includes(
      String(intentKey || ''),
    ) ||
    inboundCategory === 'price_inquiry'
  const hasScheduleDomain =
    Boolean(scheduleContext) ||
    intentKey === 'customer.schedule_request' ||
    inboundCategory === 'schedule_request'

  if (hasSupportDomain) {
    return 'support'
  }

  if (hasQuoteDomain) {
    return 'quote'
  }

  if (
    hasScheduleDomain
  ) {
    return 'schedule'
  }

  if (intentKey === 'customer.contact_info' || inboundCategory === 'contact') {
    return 'contact'
  }

  if (
    BUSINESS_FACT_INTENTS.has(String(intentKey || '')) ||
    inboundCategory === 'faq_topic'
  ) {
    return 'business_info'
  }

  if (typeof previousConversationContext?.activeDomain === 'string') {
    return previousConversationContext.activeDomain
  }

  return 'general'
}

const resolveNextUsefulField = ({
  activeDomain,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
}) => {
  if (activeDomain === 'schedule' && Array.isArray(scheduleContext?.missingFields)) {
    return scheduleContext.missingFields[0] || null
  }

  if (activeDomain === 'support' && Array.isArray(supportContext?.missingFields)) {
    return supportContext.missingFields[0] || null
  }

  if (activeDomain === 'quote' && Array.isArray(quoteContext?.missingFields)) {
    return quoteContext.missingFields[0] || null
  }

  return null
}

const buildKnownFacts = ({ topic = null, quoteContext = null, supportContext = null, scheduleContext = null }) => {
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

const detectThoughtInProgress = ({
  currentTurnText,
  inboundCategory = null,
  intentKey = null,
  activeDomain,
  quoteContext = null,
  supportContext = null,
}) => {
  const normalized = normalizeText(currentTurnText)
  if (!normalized) {
    return false
  }

  if (inboundCategory === 'incomplete' || intentKey === 'customer.incomplete') {
    return true
  }

  if (THOUGHT_IN_PROGRESS_REGEX.test(String(currentTurnText || '').trim())) {
    return true
  }

  if (activeDomain === 'quote') {
    const hasQuotePayload =
      Boolean(quoteContext?.measurements) ||
      Number(quoteContext?.quantity?.total || 0) > 0 ||
      (quoteContext?.capturedAttributes &&
        Object.keys(quoteContext.capturedAttributes).length > 0)
    if (
      !QUESTION_LIKE_REGEX.test(normalized) &&
      !hasQuotePayload &&
      normalized.split(/\s+/u).length <= 6
    ) {
      return true
    }
  }

  if (
    activeDomain === 'support' &&
    supportContext &&
    !supportContext.issueSummary &&
    typeof supportContext.productType === 'string' &&
    normalizeText(supportContext.productType) === normalized
  ) {
    return true
  }

  return false
}

export const buildConversationContext = ({
  role,
  currentTurnText,
  inboundClassification = null,
  intentDetection = null,
  previousConversationContext = null,
  topic = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  followUp = null,
  threadResolution = null,
  nluAnalysis = null,
}) => {
  const currentIntentKey = intentDetection?.intent || null
  const inboundCategory = inboundClassification?.category || null
  const activeDomain = determineActiveDomain({
    intentKey: currentIntentKey,
    inboundCategory,
    quoteContext,
    supportContext,
    scheduleContext,
    previousConversationContext,
  })
  const nextUsefulField = resolveNextUsefulField({
    activeDomain,
    quoteContext,
    supportContext,
    scheduleContext,
  })
  const thoughtInProgress = detectThoughtInProgress({
    currentTurnText,
    inboundCategory,
    intentKey: currentIntentKey,
    activeDomain,
    quoteContext,
    supportContext,
  })
  const confidence =
    typeof intentDetection?.confidence === 'number'
      ? Math.max(0, Math.min(1, intentDetection.confidence))
      : typeof previousConversationContext?.confidence === 'number'
        ? previousConversationContext.confidence
        : 0.5

  let mode = 'exploration'
  let responseStrategy = 'guided_exploration'

  if (!String(role || '').startsWith('customer_')) {
    mode = 'flow'
    responseStrategy = 'execute_flow'
  } else if (['greeting', 'courtesy', 'confirmation', 'cancellation'].includes(inboundCategory)) {
    mode = 'small_talk'
    responseStrategy = 'light_turn'
  } else if (
    ['noise', 'unintelligible'].includes(inboundCategory) ||
    threadResolution?.requiresDisambiguation
  ) {
    mode = 'unclear'
    responseStrategy = 'ask_clarification'
  } else if (thoughtInProgress) {
    mode = activeDomain === 'general' ? 'unclear' : 'exploration'
    responseStrategy = 'hold_for_more_context'
  } else if (activeDomain === 'schedule' && scheduleContext) {
    mode = 'flow'
    responseStrategy = nextUsefulField ? 'ask_schedule_field' : 'confirm_schedule'
  } else if (activeDomain === 'support' && supportContext) {
    mode = 'flow'
    responseStrategy = nextUsefulField ? 'ask_support_field' : 'continue_support_resolution'
  } else if (activeDomain === 'quote') {
    if (
      OPERATIONAL_INTENTS.has(String(currentIntentKey || '')) &&
      (QUESTION_LIKE_REGEX.test(normalizeText(currentTurnText)) ||
        Boolean(quoteContext?.measurements) ||
        Number(quoteContext?.quantity?.total || 0) > 0)
    ) {
      mode = 'flow'
      responseStrategy = nextUsefulField ? 'ask_quote_field' : 'quote_ready'
    } else {
      mode = 'exploration'
      responseStrategy = 'guide_quote_exploration'
    }
  } else if (EXPLORATION_INTENTS.has(String(currentIntentKey || ''))) {
    mode = 'exploration'
    responseStrategy = 'guided_exploration'
  } else if (OPERATIONAL_INTENTS.has(String(currentIntentKey || ''))) {
    mode = 'flow'
    responseStrategy = nextUsefulField ? 'ask_next_useful_field' : 'execute_flow'
  } else {
    mode = 'unclear'
    responseStrategy = 'ask_clarification'
  }

  return {
    mode,
    activeDomain,
    responseStrategy,
    nextUsefulField,
    waitForMore: Boolean(thoughtInProgress),
    topicLabel: typeof topic?.label === 'string' ? topic.label : null,
    userGoal:
      activeDomain === 'quote'
        ? 'cotizar'
        : activeDomain === 'support'
          ? 'resolver soporte o reparación'
          : activeDomain === 'schedule'
            ? 'coordinar una visita'
            : activeDomain === 'contact'
              ? 'obtener datos de contacto'
              : 'entender la consulta',
    confidence,
    followUpDetected: Boolean(followUp?.detected),
    threadKey:
      typeof threadResolution?.activeThreadKey === 'string'
        ? threadResolution.activeThreadKey
        : typeof previousConversationContext?.threadKey === 'string'
          ? previousConversationContext.threadKey
          : null,
    knownFacts: buildKnownFacts({
      topic,
      quoteContext,
      supportContext,
      scheduleContext,
    }),
    nluSource: typeof nluAnalysis?.source === 'string' ? nluAnalysis.source : null,
  }
}

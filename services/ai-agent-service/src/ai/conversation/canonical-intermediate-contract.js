import {
  extractTenantFamilyLabel,
  findBestTenantTopicMatch,
} from '../intents/customer-topic-taxonomy.js'
import {
  extractCustomerQuoteLeadText,
  extractCustomerQuoteSeed,
} from '../intents/customer-quote-context.js'
import { extractExplicitSemanticSubject } from '../intents/semantic-turn-subject.js'

export const CANONICAL_INTERMEDIATE_CONTRACT_VERSION = '1'

const compactText = (value) =>
  typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''

const isMeaningfulValue = (value) =>
  (typeof value === 'string' && compactText(value).length > 0) ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  value === true

const pickObject = (...values) =>
  values.find((value) => value && typeof value === 'object' && !Array.isArray(value)) || null

const pickArray = (...values) => values.find((value) => Array.isArray(value)) || []

const toStringOrNull = (value) => {
  const text = compactText(value)
  return text.length > 0 ? text : null
}

const toNumberOrZero = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0

const toRawTextOrEmpty = (value) => (typeof value === 'string' && value.trim().length > 0 ? value : '')

const cloneJson = (value) => {
  if (value == null) {
    return value
  }

  return JSON.parse(JSON.stringify(value))
}

const PRODUCT_TOPIC_KINDS = new Set([
  'product_family',
  'product_topic',
  'product_variant',
])
const QUOTE_CORE_FIELDS = new Set(['product', 'measurements', 'quantity'])
const OPERATIONAL_CONTEXT_FIELDS = new Set(['address', 'date', 'time', 'contact', 'issue'])

const extractResolutionReadiness = ({
  resolutionReadiness = null,
  conversationContext = null,
  turnInterpretation = null,
} = {}) =>
  pickObject(
    resolutionReadiness,
    conversationContext?.resolutionReadiness,
    turnInterpretation?.resolutionReadiness,
  )

const extractConversationState = ({
  conversationState = null,
  conversationContext = null,
  turnInterpretation = null,
} = {}) =>
  pickObject(
    conversationState,
    conversationContext?.conversationState,
    turnInterpretation?.conversationState,
  )

const extractBaseConfirmedFacts = (conversationState = null) => {
  const slots =
    conversationState?.slots && typeof conversationState.slots === 'object'
      ? conversationState.slots
      : {}
  const facts = {}

  for (const key of ['address', 'date', 'time', 'product', 'dimensions', 'quantity']) {
    const entry = slots[key]
    if (entry && typeof entry === 'object' && isMeaningfulValue(entry.value)) {
      facts[key] = entry.value
    }
  }

  return facts
}

const extractTenantConfirmedFacts = (conversationState = null) => {
  const slots =
    conversationState?.tenant?.slots && typeof conversationState.tenant.slots === 'object'
      ? conversationState.tenant.slots
      : {}
  const facts = {}

  for (const [key, entry] of Object.entries(slots)) {
    if (entry && typeof entry === 'object' && isMeaningfulValue(entry.value)) {
      facts[key] = entry.value
    }
  }

  return facts
}

const derivePreviousLane = (previousConversationContext = null) =>
  toStringOrNull(
    previousConversationContext?.resolutionReadiness?.lane ||
      previousConversationContext?.activeDomain ||
      previousConversationContext?.activeLane,
  )

const deriveThreadAction = ({
  previousConversationContext = null,
  readiness = null,
  threadKey = null,
  activeThreadId = null,
} = {}) => {
  if (!readiness || typeof readiness !== 'object') {
    return 'start'
  }

  if (readiness.resetCueDetected === true) {
    return 'reset'
  }

  const previousLane = derivePreviousLane(previousConversationContext)
  const currentLane = toStringOrNull(readiness.lane)
  const previousThreadKey = toStringOrNull(
    previousConversationContext?.threadKey ||
      previousConversationContext?.resolutionReadiness?.threadKey,
  )
  const previousActiveThreadId = toStringOrNull(
    previousConversationContext?.resolutionReadiness?.activeThreadId,
  )
  const effectiveThreadKey = toStringOrNull(threadKey || activeThreadId || readiness.threadKey)
  const effectiveActiveThreadId = toStringOrNull(
    activeThreadId || readiness.activeThreadId || readiness.threadKey,
  )

  if (
    previousLane &&
    currentLane &&
    previousLane !== currentLane &&
    currentLane !== 'general'
  ) {
    return 'switch'
  }

  if (
    previousThreadKey &&
    effectiveThreadKey &&
    previousThreadKey !== effectiveThreadKey
  ) {
    return 'switch'
  }

  if (
    previousActiveThreadId &&
    effectiveActiveThreadId &&
    previousActiveThreadId !== effectiveActiveThreadId
  ) {
    return 'switch'
  }

  if (effectiveThreadKey || effectiveActiveThreadId) {
    return previousThreadKey || previousActiveThreadId ? 'preserve' : 'start'
  }

  if (toStringOrNull(readiness.resumePointer)) {
    return 'resume'
  }

  if (readiness.followUpDetected === true) {
    return 'preserve'
  }

  return 'start'
}

const deriveStaleToInvalidate = ({
  previousConversationContext = null,
  readiness = null,
} = {}) => {
  const previousLane = derivePreviousLane(previousConversationContext)
  const currentLane = toStringOrNull(readiness?.lane)
  if (!previousLane || !currentLane || previousLane === currentLane) {
    return []
  }

  const previousBaseFacts = extractBaseConfirmedFacts(
    previousConversationContext?.conversationState || null,
  )

  if (previousLane === 'schedule' && currentLane !== 'schedule') {
    return ['address', 'date', 'time'].filter((key) =>
      isMeaningfulValue(previousBaseFacts[key]),
    )
  }

  return []
}

const resolveCanonicalQuoteSubjectLabel = ({
  currentTurnText = '',
  turnInterpretation = null,
  conversationState = null,
  quoteContext = null,
  tenantTopicTaxonomy = [],
} = {}) => {
  const quoteTopicLabel = toStringOrNull(quoteContext?.topicLabel)
  if (quoteTopicLabel) {
    return quoteTopicLabel
  }

  const rememberedProduct = toStringOrNull(conversationState?.slots?.product?.value)
  if (rememberedProduct) {
    return rememberedProduct
  }

  const currentTopic =
    turnInterpretation?.topic &&
    PRODUCT_TOPIC_KINDS.has(String(turnInterpretation.topic.type || ''))
      ? toStringOrNull(turnInterpretation.topic.label)
      : null
  if (currentTopic) {
    return currentTopic
  }

  const contextTopic =
    turnInterpretation?.contextTopic &&
    PRODUCT_TOPIC_KINDS.has(String(turnInterpretation.contextTopic.type || ''))
      ? toStringOrNull(turnInterpretation.contextTopic.label)
      : null
  if (contextTopic) {
    return contextTopic
  }

  const effectiveTurnText =
    toRawTextOrEmpty(turnInterpretation?.rawCurrentTurnText) ||
    toRawTextOrEmpty(currentTurnText) ||
    toRawTextOrEmpty(turnInterpretation?.currentTurnText) ||
    ''
  const extractedQuoteSeed = effectiveTurnText
    ? extractCustomerQuoteSeed(effectiveTurnText, { tenantTopicTaxonomy })
    : null
  const extractedTopicCandidate = toStringOrNull(extractedQuoteSeed?.topicCandidate?.label)
  if (extractedTopicCandidate) {
    return extractedTopicCandidate
  }

  const extractedFamilyLabel = toStringOrNull(extractedQuoteSeed?.familyLabel)
  if (extractedFamilyLabel) {
    return extractedFamilyLabel
  }

  const directTopicMatch =
    effectiveTurnText && Array.isArray(tenantTopicTaxonomy) && tenantTopicTaxonomy.length > 0
      ? findBestTenantTopicMatch(effectiveTurnText, tenantTopicTaxonomy, {
          kinds: ['product_family', 'product_topic', 'product_variant'],
        })
      : null
  if (directTopicMatch?.label) {
    return toStringOrNull(directTopicMatch.label)
  }

  const familyLabel =
    effectiveTurnText && Array.isArray(tenantTopicTaxonomy) && tenantTopicTaxonomy.length > 0
      ? extractTenantFamilyLabel(effectiveTurnText, tenantTopicTaxonomy)
      : null
  if (toStringOrNull(familyLabel)) {
    return toStringOrNull(familyLabel)
  }

  const quoteLeadText = toStringOrNull(extractCustomerQuoteLeadText(effectiveTurnText))
  const extractedRequestedTopic = toStringOrNull(
    extractExplicitSemanticSubject({
      input: quoteLeadText || effectiveTurnText,
      tenantTopicTaxonomy,
    }).explicitSubject?.label,
  )
  if (!extractedRequestedTopic) {
    return null
  }

  const requestedTopicMatch =
    Array.isArray(tenantTopicTaxonomy) && tenantTopicTaxonomy.length > 0
      ? findBestTenantTopicMatch(extractedRequestedTopic, tenantTopicTaxonomy, {
          kinds: ['product_family', 'product_topic', 'product_variant'],
        })
      : null

  return toStringOrNull(requestedTopicMatch?.label || extractedRequestedTopic)
}

const deriveDefaultQuoteNextUsefulField = ({
  readiness = null,
  quoteContext = null,
  conversationState = null,
  subjectLabel = null,
} = {}) => {
  const explicitField = toStringOrNull(readiness?.nextUsefulField || quoteContext?.nextUsefulField)
  if (explicitField) {
    return explicitField
  }

  const hasMeasurements =
    Boolean(quoteContext?.measurements) ||
    (Array.isArray(quoteContext?.measurementItems) && quoteContext.measurementItems.length > 0) ||
    isMeaningfulValue(conversationState?.slots?.dimensions?.value)
  const quantityValue =
    typeof quoteContext?.quantity?.total === 'number' && Number.isFinite(quoteContext.quantity.total)
      ? quoteContext.quantity.total
      : typeof conversationState?.slots?.quantity?.value === 'number' &&
          Number.isFinite(conversationState.slots.quantity.value)
        ? conversationState.slots.quantity.value
        : 0

  if (!toStringOrNull(subjectLabel)) {
    return 'product'
  }

  if (!hasMeasurements) {
    return 'measurements'
  }

  if (quantityValue <= 0) {
    return 'quantity'
  }

  return null
}

const buildQuoteSeed = ({
  quoteContext = null,
  readiness = null,
  conversationState = null,
  subjectLabel = null,
} = {}) => {
  const measurementItems = Array.isArray(quoteContext?.measurementItems)
    ? quoteContext.measurementItems
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          displayLabel: toStringOrNull(entry.displayLabel),
          widthMm:
            typeof entry.widthMm === 'number' && Number.isFinite(entry.widthMm)
              ? entry.widthMm
              : null,
          heightMm:
            typeof entry.heightMm === 'number' && Number.isFinite(entry.heightMm)
              ? entry.heightMm
              : null,
          quantity:
            typeof entry.quantity === 'number' && Number.isFinite(entry.quantity)
              ? entry.quantity
              : null,
          label: toStringOrNull(entry.label),
        }))
    : []

  return {
    present: Boolean(
      quoteContext || readiness?.quoteStructuredContext === true || toStringOrNull(subjectLabel),
    ),
    topicLabel: toStringOrNull(quoteContext?.topicLabel),
    subjectLabel: toStringOrNull(subjectLabel),
    subjectKnown: Boolean(toStringOrNull(subjectLabel)),
    familyLabel: toStringOrNull(quoteContext?.familyLabel),
    profileResolved: quoteContext?.profileResolved === true,
    items: measurementItems,
    capturedAttributes:
      quoteContext?.capturedAttributes && typeof quoteContext.capturedAttributes === 'object'
        ? cloneJson(quoteContext.capturedAttributes)
        : {},
    missingFields: pickArray(quoteContext?.missingFields, readiness?.missingFields).filter(
      (entry) => typeof entry === 'string',
    ),
    missingAttributes: Array.isArray(quoteContext?.missingAttributes)
      ? cloneJson(quoteContext.missingAttributes)
      : [],
    nextUsefulField: deriveDefaultQuoteNextUsefulField({
      readiness,
      quoteContext,
      conversationState,
      subjectLabel,
    }),
    stage: toStringOrNull(readiness?.quoteStage || quoteContext?.stage),
    actionReady: readiness?.quoteActionReady === true,
    informationFirst: readiness?.quoteInformationFirst === true,
  }
}

const sanitizeSupportContext = (supportContext = null) => {
  if (!supportContext || typeof supportContext !== 'object') {
    return null
  }

  return {
    productType: toStringOrNull(supportContext.productType),
    issueSummary: toStringOrNull(supportContext.issueSummary),
    missingFields: Array.isArray(supportContext.missingFields)
      ? supportContext.missingFields.filter((entry) => typeof entry === 'string')
      : [],
    completionStatus: toStringOrNull(supportContext.completionStatus),
    nextUsefulField: toStringOrNull(supportContext.nextUsefulField),
  }
}

const sanitizeScheduleContext = (scheduleContext = null) => {
  if (!scheduleContext || typeof scheduleContext !== 'object') {
    return null
  }

  return {
    address: toStringOrNull(scheduleContext.address),
    date: toStringOrNull(scheduleContext.date),
    time: toStringOrNull(scheduleContext.time),
    missingFields: Array.isArray(scheduleContext.missingFields)
      ? scheduleContext.missingFields.filter((entry) => typeof entry === 'string')
      : [],
    completionStatus: toStringOrNull(scheduleContext.completionStatus),
    nextUsefulField: toStringOrNull(scheduleContext.nextUsefulField),
  }
}

const sanitizeQuoteContext = (quoteContext = null) => {
  if (!quoteContext || typeof quoteContext !== 'object') {
    return null
  }

  return {
    topicLabel: toStringOrNull(quoteContext.topicLabel),
    familyLabel: toStringOrNull(quoteContext.familyLabel),
    missingFields: Array.isArray(quoteContext.missingFields)
      ? quoteContext.missingFields.filter((entry) => typeof entry === 'string')
      : [],
    completionStatus: toStringOrNull(quoteContext.completionStatus),
    nextUsefulField: toStringOrNull(quoteContext.nextUsefulField),
    quantity:
      typeof quoteContext?.quantity?.total === 'number' &&
      Number.isFinite(quoteContext.quantity.total)
        ? quoteContext.quantity.total
        : null,
    measurements:
      quoteContext?.measurements && typeof quoteContext.measurements === 'object'
        ? {
            displayLabel: toStringOrNull(
              quoteContext.measurements.displayLabel ||
                quoteContext.measurements.confirmationLabel,
            ),
            widthMm:
              typeof quoteContext.measurements.widthMm === 'number' &&
              Number.isFinite(quoteContext.measurements.widthMm)
                ? quoteContext.measurements.widthMm
                : null,
            heightMm:
              typeof quoteContext.measurements.heightMm === 'number' &&
              Number.isFinite(quoteContext.measurements.heightMm)
                ? quoteContext.measurements.heightMm
                : null,
          }
        : null,
    measurementItemCount: Array.isArray(quoteContext.measurementItems)
      ? quoteContext.measurementItems.length
      : 0,
  }
}

const deriveReplyAct = ({
  answerMode = null,
  responseContract = null,
} = {}) => {
  const contract = toStringOrNull(responseContract)
  const mode = toStringOrNull(answerMode)
  const effective = contract || mode

  if (!effective) {
    return null
  }

  if (effective === 'answer_side_question') {
    return 'answer_question'
  }

  if (effective === 'inform_then_guide_quote') {
    return 'answer_question_then_continue'
  }

  if (/^ask_/.test(effective)) {
    return 'ask_missing_field'
  }

  if (effective === 'hold_for_more_context') {
    return 'hold_for_more_context'
  }

  if (['confirm_schedule', 'continue_support_resolution'].includes(effective)) {
    return 'confirm_progress'
  }

  if (['quote_ready', 'execute_flow'].includes(effective)) {
    return 'handoff_required'
  }

  if (effective === 'guide_quote_exploration') {
    return 'guide_exploration'
  }

  if (effective === 'light_turn') {
    return 'light_turn'
  }

  return effective
}

const deriveFactsToMentionMode = ({
  replyAct = null,
  quoteSeed = null,
} = {}) => {
  if (replyAct === 'ask_missing_field') {
    return Array.isArray(quoteSeed?.items) && quoteSeed.items.length > 1
      ? 'disambiguation'
      : 'minimal'
  }

  if (replyAct === 'confirm_progress') {
    return 'summary'
  }

  if (
    replyAct === 'answer_question' ||
    replyAct === 'answer_question_then_continue'
  ) {
    return 'minimal'
  }

  return 'minimal'
}

const deriveOpeningStyle = ({
  replyAct = null,
  answerFirst = false,
} = {}) => {
  if (answerFirst || replyAct === 'answer_question') {
    return 'direct'
  }

  if (['ask_missing_field', 'confirm_progress', 'hold_for_more_context'].includes(replyAct)) {
    return 'brief_ack'
  }

  return 'contextual_ack'
}

const deriveRenderPlanNextUsefulField = ({
  contract = null,
  readiness = null,
  conversationContext = null,
  state = null,
} = {}) => {
  const inheritedNextUsefulField = toStringOrNull(
    readiness?.nextUsefulField || conversationContext?.nextUsefulField,
  )
  const quoteNextUsefulField = toStringOrNull(contract?.quoteSeed?.nextUsefulField)

  if (toStringOrNull(contract?.turn?.lane) === 'quote' && quoteNextUsefulField) {
    const threadSwitched = toStringOrNull(contract?.thread?.threadAction) === 'switch'
    const staleFactsInvalidated =
      Array.isArray(contract?.facts?.staleToInvalidate) &&
      contract.facts.staleToInvalidate.length > 0
    const inheritedLooksOperational =
      Boolean(inheritedNextUsefulField) &&
      (
        OPERATIONAL_CONTEXT_FIELDS.has(inheritedNextUsefulField) ||
        inheritedNextUsefulField === toStringOrNull(contract?.thread?.resumePointer) ||
        inheritedNextUsefulField === toStringOrNull(state?.lastAskedSlot)
      )
    const quoteReplyProgression =
      ['guide_exploration', 'answer_question_then_continue', 'ask_missing_field'].includes(
        String(contract?.outcome?.replyAct || ''),
      )

    if (threadSwitched || staleFactsInvalidated) {
      return quoteNextUsefulField
    }

    if (
      QUOTE_CORE_FIELDS.has(quoteNextUsefulField) &&
      (!inheritedNextUsefulField || inheritedLooksOperational || quoteReplyProgression)
    ) {
      return quoteNextUsefulField
    }
  }

  return toStringOrNull(inheritedNextUsefulField || quoteNextUsefulField)
}

export const buildCanonicalResponseDirectives = (contract = null) => {
  if (!contract || typeof contract !== 'object') {
    return null
  }

  return {
    schemaVersion: toStringOrNull(contract?.schemaVersion),
    lane: toStringOrNull(contract?.turn?.lane),
    threadAction: toStringOrNull(contract?.thread?.threadAction),
    staleToInvalidate: Array.isArray(contract?.facts?.staleToInvalidate)
      ? contract.facts.staleToInvalidate.filter((entry) => typeof entry === 'string')
      : [],
    answerMode: toStringOrNull(contract?.outcome?.answerMode),
    responseContract: toStringOrNull(contract?.outcome?.responseContract),
    replyAct: toStringOrNull(contract?.outcome?.replyAct),
    answerFirst: contract?.outcome?.answerFirst === true,
    waitForMore: contract?.outcome?.waitForMore === true,
    handoffAllowed: contract?.outcome?.handoffAllowed === true,
    nextUsefulField: toStringOrNull(
      contract?.renderPlan?.nextUsefulField || contract?.quoteSeed?.nextUsefulField,
    ),
    subjectLabel: toStringOrNull(contract?.quoteSeed?.subjectLabel),
    subjectKnown: contract?.quoteSeed?.subjectKnown === true,
    factsToMentionMode: toStringOrNull(contract?.renderPlan?.factsToMentionMode),
    avoidRepeatingFacts: contract?.renderPlan?.avoidRepeatingFacts !== false,
    avoidLiteralEcho: contract?.renderPlan?.avoidLiteralEcho !== false,
    openingStyle: toStringOrNull(contract?.renderPlan?.openingStyle),
  }
}

const buildEmptyContract = () => ({
  schemaVersion: CANONICAL_INTERMEDIATE_CONTRACT_VERSION,
  turn: {
    currentText: '',
    turnIntent: null,
    intentConfidence: 0,
    lane: null,
    activeIntent: null,
    followUpDetected: false,
    sideQuestionSubtype: null,
    questionLikeTurn: false,
    resetCueDetected: false,
  },
  thread: {
    threadKey: null,
    activeThreadId: null,
    parentThreadKey: null,
    resumePointer: null,
    threadAction: 'start',
    quoteThreadConflict: false,
  },
  facts: {
    confirmed: {
      base: {},
      tenant: {},
    },
    tentative: {},
    currentTurn: {},
    staleToInvalidate: [],
  },
  quoteSeed: {
    present: false,
    topicLabel: null,
    subjectLabel: null,
    subjectKnown: false,
    familyLabel: null,
    profileResolved: false,
    items: [],
    capturedAttributes: {},
    missingFields: [],
    missingAttributes: [],
    nextUsefulField: null,
    stage: null,
    actionReady: false,
    informationFirst: false,
  },
  operationalContexts: {
    quote: null,
    support: null,
    schedule: null,
    capturedNotes: [],
  },
  outcome: {
    answerMode: null,
    responseContract: null,
    knowledgeNeed: null,
    knowledgeReason: null,
    replyAct: null,
    answerFirst: false,
    waitForMore: false,
    waitForMoreReasons: [],
    handoffAllowed: false,
    handoffReason: null,
    progressBlocked: false,
    progressGuard: null,
  },
  renderPlan: {
    nextUsefulField: null,
    lastAskedSlot: null,
    factsToMentionMode: 'minimal',
    avoidRepeatingFacts: true,
    avoidLiteralEcho: true,
    openingStyle: 'contextual_ack',
  },
})

export const buildCanonicalIntermediateContract = ({
  currentTurnText = '',
  previousConversationContext = null,
  conversationContext = null,
  resolutionReadiness = null,
  conversationState = null,
  turnInterpretation = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  responseContract = null,
  knowledgeDecision = null,
  tenantTopicTaxonomy = [],
} = {}) => {
  const readiness = extractResolutionReadiness({
    resolutionReadiness,
    conversationContext,
    turnInterpretation,
  })
  const state = extractConversationState({
    conversationState,
    conversationContext,
    turnInterpretation,
  })
  const contract = buildEmptyContract()

  contract.turn.currentText = String(currentTurnText || turnInterpretation?.currentTurnText || '')
  contract.turn.turnIntent = toStringOrNull(
    readiness?.turnIntent || turnInterpretation?.intent?.key || state?.intent?.key,
  )
  contract.turn.intentConfidence =
    typeof state?.intent?.confidence === 'number' && Number.isFinite(state.intent.confidence)
      ? state.intent.confidence
      : toNumberOrZero(readiness?.confidence)
  contract.turn.lane = toStringOrNull(
    readiness?.lane || conversationContext?.activeDomain || state?.lane,
  )
  contract.turn.activeIntent = toStringOrNull(readiness?.activeIntent)
  contract.turn.followUpDetected = readiness?.followUpDetected === true
  contract.turn.sideQuestionSubtype = toStringOrNull(readiness?.sideQuestionSubtype)
  contract.turn.questionLikeTurn = readiness?.questionLikeTurn === true
  contract.turn.resetCueDetected = readiness?.resetCueDetected === true

  contract.thread.threadKey = toStringOrNull(
    readiness?.threadKey || conversationContext?.threadKey,
  )
  contract.thread.activeThreadId = toStringOrNull(readiness?.activeThreadId)
  contract.thread.parentThreadKey = toStringOrNull(readiness?.parentThreadKey)
  contract.thread.resumePointer = toStringOrNull(
    readiness?.resumePointer || conversationContext?.resumePointer,
  )
  contract.thread.quoteThreadConflict = readiness?.quoteThreadConflictExploration === true
  contract.thread.threadAction = deriveThreadAction({
    previousConversationContext,
    readiness,
    threadKey: contract.thread.threadKey,
    activeThreadId: contract.thread.activeThreadId,
  })

  const effectiveQuoteContext = pickObject(quoteContext, turnInterpretation?.quoteContext)
  const canonicalQuoteSubjectLabel = resolveCanonicalQuoteSubjectLabel({
    currentTurnText: contract.turn.currentText,
    turnInterpretation,
    conversationState: state,
    quoteContext: effectiveQuoteContext,
    tenantTopicTaxonomy,
  })

  contract.facts.confirmed.base = extractBaseConfirmedFacts(state)
  contract.facts.confirmed.tenant = extractTenantConfirmedFacts(state)
  contract.facts.staleToInvalidate = deriveStaleToInvalidate({
    previousConversationContext,
    readiness,
  })

  contract.quoteSeed = buildQuoteSeed({
    quoteContext: effectiveQuoteContext,
    readiness,
    conversationState: state,
    subjectLabel: canonicalQuoteSubjectLabel,
  })

  contract.operationalContexts = {
    quote: sanitizeQuoteContext(effectiveQuoteContext),
    support: sanitizeSupportContext(
      pickObject(supportContext, turnInterpretation?.supportContext),
    ),
    schedule: sanitizeScheduleContext(
      pickObject(scheduleContext, turnInterpretation?.scheduleContext),
    ),
    capturedNotes: [],
  }

  contract.outcome.answerMode = toStringOrNull(
    readiness?.answerMode || conversationContext?.responseStrategy,
  )
  contract.outcome.responseContract = toStringOrNull(responseContract)
  contract.outcome.knowledgeNeed = toStringOrNull(knowledgeDecision?.knowledgeNeed)
  contract.outcome.knowledgeReason = toStringOrNull(knowledgeDecision?.reason)
  contract.outcome.waitForMore = readiness?.waitForMore === true
  contract.outcome.waitForMoreReasons = Array.isArray(readiness?.waitForMoreReasons)
    ? readiness.waitForMoreReasons.filter((entry) => typeof entry === 'string')
    : []
  contract.outcome.progressGuard =
    readiness?.progressGuard && typeof readiness.progressGuard === 'object'
      ? cloneJson(readiness.progressGuard)
      : null
  contract.outcome.progressBlocked = readiness?.progressGuard?.blocked === true
  contract.outcome.replyAct = deriveReplyAct({
    answerMode: contract.outcome.answerMode,
    responseContract: contract.outcome.responseContract,
  })
  contract.outcome.answerFirst = ['answer_question', 'answer_question_then_continue'].includes(
    String(contract.outcome.replyAct || ''),
  )
  contract.outcome.handoffAllowed =
    contract.quoteSeed.actionReady === true ||
    contract.outcome.replyAct === 'handoff_required' ||
    /^ready_for_/u.test(String(quoteContext?.completionStatus || ''))
  contract.outcome.handoffReason = contract.outcome.handoffAllowed
    ? toStringOrNull(
        quoteContext?.completionStatus ||
          contract.outcome.responseContract ||
          contract.outcome.answerMode,
      )
    : null

  contract.renderPlan.nextUsefulField = deriveRenderPlanNextUsefulField({
    contract,
    readiness,
    conversationContext,
    state,
  })
  contract.renderPlan.lastAskedSlot = toStringOrNull(state?.lastAskedSlot)
  contract.renderPlan.factsToMentionMode = deriveFactsToMentionMode({
    replyAct: contract.outcome.replyAct,
    quoteSeed: contract.quoteSeed,
  })
  contract.renderPlan.openingStyle = deriveOpeningStyle({
    replyAct: contract.outcome.replyAct,
    answerFirst: contract.outcome.answerFirst,
  })

  return contract
}

export const enrichCanonicalIntermediateContract = (
  contract = null,
  { responseContract = null, knowledgeDecision = null } = {},
) => {
  const base = contract && typeof contract === 'object' ? cloneJson(contract) : buildEmptyContract()
  base.outcome.responseContract = toStringOrNull(responseContract)
  base.outcome.knowledgeNeed = toStringOrNull(knowledgeDecision?.knowledgeNeed)
  base.outcome.knowledgeReason = toStringOrNull(knowledgeDecision?.reason)
  base.outcome.replyAct = deriveReplyAct({
    answerMode: base.outcome.answerMode,
    responseContract: base.outcome.responseContract,
  })
  base.outcome.answerFirst = ['answer_question', 'answer_question_then_continue'].includes(
    String(base.outcome.replyAct || ''),
  )
  base.outcome.handoffAllowed =
    base.quoteSeed.actionReady === true ||
    base.outcome.replyAct === 'handoff_required' ||
    /^ready_for_/u.test(String(base.outcome.handoffReason || ''))
  base.renderPlan.factsToMentionMode = deriveFactsToMentionMode({
    replyAct: base.outcome.replyAct,
    quoteSeed: base.quoteSeed,
  })
  base.renderPlan.openingStyle = deriveOpeningStyle({
    replyAct: base.outcome.replyAct,
    answerFirst: base.outcome.answerFirst,
  })
  return base
}

export const sanitizeCanonicalIntermediateContractForAudit = (contract = null) => {
  if (!contract || typeof contract !== 'object') {
    return null
  }

  return {
    schemaVersion: toStringOrNull(contract.schemaVersion),
    turn: {
      turnIntent: toStringOrNull(contract?.turn?.turnIntent),
      lane: toStringOrNull(contract?.turn?.lane),
      activeIntent: toStringOrNull(contract?.turn?.activeIntent),
      followUpDetected: contract?.turn?.followUpDetected === true,
      sideQuestionSubtype: toStringOrNull(contract?.turn?.sideQuestionSubtype),
      questionLikeTurn: contract?.turn?.questionLikeTurn === true,
      resetCueDetected: contract?.turn?.resetCueDetected === true,
    },
    thread: {
      threadKey: toStringOrNull(contract?.thread?.threadKey),
      activeThreadId: toStringOrNull(contract?.thread?.activeThreadId),
      threadAction: toStringOrNull(contract?.thread?.threadAction),
      resumePointer: toStringOrNull(contract?.thread?.resumePointer),
      quoteThreadConflict: contract?.thread?.quoteThreadConflict === true,
    },
    facts: {
      confirmedBase:
        contract?.facts?.confirmed?.base &&
        typeof contract.facts.confirmed.base === 'object'
          ? cloneJson(contract.facts.confirmed.base)
          : {},
      staleToInvalidate: Array.isArray(contract?.facts?.staleToInvalidate)
        ? contract.facts.staleToInvalidate.filter((entry) => typeof entry === 'string')
        : [],
    },
    quoteSeed: {
      present: contract?.quoteSeed?.present === true,
      topicLabel: toStringOrNull(contract?.quoteSeed?.topicLabel),
      subjectLabel: toStringOrNull(contract?.quoteSeed?.subjectLabel),
      subjectKnown: contract?.quoteSeed?.subjectKnown === true,
      itemCount: Array.isArray(contract?.quoteSeed?.items) ? contract.quoteSeed.items.length : 0,
      missingFields: Array.isArray(contract?.quoteSeed?.missingFields)
        ? contract.quoteSeed.missingFields.filter((entry) => typeof entry === 'string')
        : [],
      nextUsefulField: toStringOrNull(contract?.quoteSeed?.nextUsefulField),
      stage: toStringOrNull(contract?.quoteSeed?.stage),
      actionReady: contract?.quoteSeed?.actionReady === true,
    },
    operationalContexts: {
      capturedNotes: Array.isArray(contract?.operationalContexts?.capturedNotes)
        ? cloneJson(contract.operationalContexts.capturedNotes)
        : [],
    },
    outcome: {
      answerMode: toStringOrNull(contract?.outcome?.answerMode),
      responseContract: toStringOrNull(contract?.outcome?.responseContract),
      knowledgeNeed: toStringOrNull(contract?.outcome?.knowledgeNeed),
      knowledgeReason: toStringOrNull(contract?.outcome?.knowledgeReason),
      replyAct: toStringOrNull(contract?.outcome?.replyAct),
      answerFirst: contract?.outcome?.answerFirst === true,
      waitForMore: contract?.outcome?.waitForMore === true,
      waitForMoreReasons: Array.isArray(contract?.outcome?.waitForMoreReasons)
        ? contract.outcome.waitForMoreReasons.filter((entry) => typeof entry === 'string')
        : [],
      handoffAllowed: contract?.outcome?.handoffAllowed === true,
      handoffReason: toStringOrNull(contract?.outcome?.handoffReason),
      progressBlocked: contract?.outcome?.progressBlocked === true,
    },
    renderPlan: {
      nextUsefulField: toStringOrNull(contract?.renderPlan?.nextUsefulField),
      lastAskedSlot: toStringOrNull(contract?.renderPlan?.lastAskedSlot),
      factsToMentionMode: toStringOrNull(contract?.renderPlan?.factsToMentionMode),
      avoidRepeatingFacts: contract?.renderPlan?.avoidRepeatingFacts !== false,
      avoidLiteralEcho: contract?.renderPlan?.avoidLiteralEcho !== false,
      openingStyle: toStringOrNull(contract?.renderPlan?.openingStyle),
    },
  }
}

export const sanitizeCanonicalResponseDirectivesForAudit = (directives = null) => {
  if (!directives || typeof directives !== 'object') {
    return null
  }

  return {
    schemaVersion: toStringOrNull(directives?.schemaVersion),
    lane: toStringOrNull(directives?.lane),
    threadAction: toStringOrNull(directives?.threadAction),
    staleToInvalidate: Array.isArray(directives?.staleToInvalidate)
      ? directives.staleToInvalidate.filter((entry) => typeof entry === 'string')
      : [],
    answerMode: toStringOrNull(directives?.answerMode),
    responseContract: toStringOrNull(directives?.responseContract),
    replyAct: toStringOrNull(directives?.replyAct),
    answerFirst: directives?.answerFirst === true,
    waitForMore: directives?.waitForMore === true,
    handoffAllowed: directives?.handoffAllowed === true,
    nextUsefulField: toStringOrNull(directives?.nextUsefulField),
    subjectLabel: toStringOrNull(directives?.subjectLabel),
    subjectKnown: directives?.subjectKnown === true,
    factsToMentionMode: toStringOrNull(directives?.factsToMentionMode),
    avoidRepeatingFacts: directives?.avoidRepeatingFacts !== false,
    avoidLiteralEcho: directives?.avoidLiteralEcho !== false,
    openingStyle: toStringOrNull(directives?.openingStyle),
  }
}

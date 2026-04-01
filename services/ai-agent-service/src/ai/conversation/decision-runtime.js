import {
  filterResolvedConversationFields,
  isConversationFieldResolved,
  mapConversationFieldToSlot,
  resolveNextConversationField,
} from './conversation-state.js'
import { normalizeCustomerTextForIntent } from '../intents/customer-text-normalizer.js'

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const CUSTOMER_LANE_ACTIVE_INTENT_KEYS = Object.freeze({
  quote: 'customer.quote',
  support: 'customer.support_request',
  schedule: 'customer.schedule_request',
  contact: 'customer.contact_info',
  business_info: 'customer.topic_info',
})

const CUSTOMER_TURN_INTENT_PRESERVATION_KEYS = new Set([
  'customer.other',
  'customer.light',
  'customer.clarify_request',
  'customer.rephrase_request',
  'customer.incomplete',
  'customer.contact_info',
  'customer.order_status',
  'customer.auth_required',
  'customer.owned_document_request',
  'customer.private_account_data',
  'customer.multi_intent',
  'customer.confirmation',
  'customer.cancellation',
  'customer.frustration',
  'customer.sensitive',
  'customer.out_of_scope',
])

const CUSTOMER_FLOW_CARRYOVER_ANSWER_MODES = new Set([
  'hold_for_more_context',
  'ask_quote_field',
  'quote_ready',
  'ask_support_field',
  'continue_support_resolution',
  'ask_schedule_field',
  'confirm_schedule',
  'ask_next_useful_field',
  'execute_flow',
])

const CUSTOMER_EXPLORATION_INTENT_KEYS = new Set([
  'customer.product_info',
  'customer.topic_info',
  'customer.price_inquiry',
])

const CUSTOMER_PURE_EXPLORATION_INTENT_KEYS = new Set([
  'customer.product_info',
  'customer.topic_info',
])

const CUSTOMER_OPERATIONAL_INTENT_KEYS = new Set([
  'customer.quote',
  'customer.support_request',
  'customer.schedule_request',
  'customer.contact_info',
  'customer.order_status',
  'customer.auth_required',
  'customer.owned_document_request',
  'customer.private_account_data',
])

const GENERIC_NON_PROGRESS_ANSWER_MODES = new Set([
  'guided_exploration',
  'guide_quote_exploration',
  'ask_clarification',
  'hold_for_more_context',
])

const SIGNAL_ONLY_ANSWER_MODES = new Set([
  'answer_side_question',
])

export const normalizeIntentKeyValue = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  if (!normalized.length || normalized === 'unknown') {
    return null
  }

  return normalized
}

export const readConversationActiveLane = (conversationContext = null) => {
  if (
    conversationContext?.resolutionReadiness &&
    typeof conversationContext.resolutionReadiness === 'object' &&
    typeof conversationContext.resolutionReadiness.lane === 'string' &&
    conversationContext.resolutionReadiness.lane.trim()
  ) {
    return conversationContext.resolutionReadiness.lane.trim()
  }

  if (
    typeof conversationContext?.activeLane === 'string' &&
    conversationContext.activeLane.trim()
  ) {
    return conversationContext.activeLane.trim()
  }

  if (
    typeof conversationContext?.activeDomain === 'string' &&
    conversationContext.activeDomain.trim()
  ) {
    return conversationContext.activeDomain.trim()
  }

  return null
}

export const hasConcreteSchedulePayload = (scheduleContext = null) =>
  Boolean(
    scheduleContext?.startAt ||
      scheduleContext?.address ||
      scheduleContext?.contactPhone ||
      scheduleContext?.contactEmail ||
      scheduleContext?.date?.dateLabel ||
      scheduleContext?.time?.timeLabel,
  )

export const hasQuoteDecisionContext = (quoteContext = null) =>
  Boolean(
    quoteContext &&
      (
        typeof quoteContext?.topicLabel === 'string' ||
        typeof quoteContext?.familyLabel === 'string' ||
        Boolean(quoteContext?.measurements) ||
        (Array.isArray(quoteContext?.measurementItems) &&
          quoteContext.measurementItems.length > 0) ||
        Number(quoteContext?.quantity?.total || 0) > 0 ||
        (quoteContext?.capturedAttributes &&
          typeof quoteContext.capturedAttributes === 'object' &&
          Object.keys(quoteContext.capturedAttributes).length > 0)
      ),
  )

export const hasSupportDecisionContext = (supportContext = null) =>
  Boolean(
    supportContext &&
      (
        typeof supportContext?.productType === 'string' ||
        typeof supportContext?.issueSummary === 'string' ||
        typeof supportContext?.address === 'string' ||
        Boolean(supportContext?.preferredDate?.dateLabel) ||
        Boolean(supportContext?.preferredTime?.timeLabel) ||
        Boolean(supportContext?.wantsVisit)
      ),
  )

export const hasScheduleDecisionContext = (scheduleContext = null) =>
  Boolean(
    scheduleContext &&
      (
        typeof scheduleContext?.address === 'string' ||
        Boolean(scheduleContext?.date?.dateLabel) ||
        Boolean(scheduleContext?.time?.timeLabel) ||
        typeof scheduleContext?.contactPhone === 'string' ||
        typeof scheduleContext?.contactEmail === 'string'
      ),
  )

const getOperationalContextForLane = ({
  lane = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
} = {}) => {
  if (lane === 'quote') {
    return quoteContext
  }
  if (lane === 'support') {
    return supportContext
  }
  if (lane === 'schedule') {
    return scheduleContext
  }
  return null
}

export const hasOperationalDecisionContext = ({
  lane = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
} = {}) => {
  if (lane === 'quote') {
    return hasQuoteDecisionContext(quoteContext)
  }
  if (lane === 'support') {
    return hasSupportDecisionContext(supportContext)
  }
  if (lane === 'schedule') {
    return hasScheduleDecisionContext(scheduleContext)
  }
  return false
}

const getOperationalAnswerModeForLane = (lane = null, nextUsefulField = null) => {
  if (lane === 'quote') {
    return nextUsefulField ? 'ask_quote_field' : 'quote_ready'
  }
  if (lane === 'support') {
    return nextUsefulField ? 'ask_support_field' : 'continue_support_resolution'
  }
  if (lane === 'schedule') {
    return nextUsefulField ? 'ask_schedule_field' : 'confirm_schedule'
  }
  return null
}

const getOperationalMissingFieldsForLane = ({
  lane = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  conversationState = null,
} = {}) => {
  const context = getOperationalContextForLane({
    lane,
    quoteContext,
    supportContext,
    scheduleContext,
  })
  const rawMissingFields = Array.isArray(context?.missingFields)
    ? context.missingFields.filter((entry) => typeof entry === 'string')
    : []

  return filterResolvedConversationFields({
    missingFields: rawMissingFields,
    conversationState,
  })
}

const chooseNextMissingFieldForDecision = ({
  requestedField = null,
  missingFields = [],
  conversationState = null,
  avoidLastAskedSlot = true,
} = {}) => {
  const normalizedMissingFields = (Array.isArray(missingFields) ? missingFields : []).filter(
    (field) => typeof field === 'string' && field.trim(),
  )
  const preferredField = resolveNextConversationField({
    requestedField,
    missingFields: normalizedMissingFields,
    conversationState,
  })
  const lastAskedSlot =
    avoidLastAskedSlot && typeof conversationState?.lastAskedSlot === 'string'
      ? conversationState.lastAskedSlot
      : null

  if (!preferredField || !lastAskedSlot || normalizedMissingFields.length <= 1) {
    return preferredField || normalizedMissingFields[0] || null
  }

  const preferredSlot = mapConversationFieldToSlot(preferredField, conversationState)
  if (preferredSlot !== lastAskedSlot) {
    return preferredField
  }

  const alternativeField =
    normalizedMissingFields.find((field) => {
      if (isConversationFieldResolved(field, conversationState)) {
        return false
      }
      const slotKey = mapConversationFieldToSlot(field, conversationState)
      return !slotKey || slotKey !== lastAskedSlot
    }) || null

  return alternativeField || preferredField
}

const resolveConversationFieldIdentity = (field = null, conversationState = null) => {
  const normalizedField = compactText(field)
  if (!normalizedField) {
    return null
  }

  return (
    mapConversationFieldToSlot(normalizedField, conversationState) || normalizedField
  )
}

const normalizeDecisionTopicLabel = (value) =>
  normalizeCustomerTextForIntent(compactText(value || ''))

const normalizeQuoteMeasurementFingerprint = (quoteContext = null) => {
  const measurements =
    quoteContext?.measurements && typeof quoteContext.measurements === 'object'
      ? quoteContext.measurements
      : null
  const measurementItems = Array.isArray(quoteContext?.measurementItems)
    ? quoteContext.measurementItems
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          widthMm: Number(entry.widthMm || 0) || null,
          heightMm: Number(entry.heightMm || 0) || null,
          quantity: Number(entry.quantity || 0) || null,
        }))
    : []

  if (!measurements && measurementItems.length === 0) {
    return null
  }

  return JSON.stringify({
    widthMm: Number(measurements?.widthMm || 0) || null,
    heightMm: Number(measurements?.heightMm || 0) || null,
    items: measurementItems,
  })
}

const normalizeQuoteAttributeKeys = (value = []) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .filter((entry) => typeof entry === 'string')
        .map((entry) => compactText(entry))
        .filter(Boolean),
    ),
  )

const hasCurrentTurnQuoteSlotContribution = ({
  readiness = null,
  currentQuoteContext = null,
  previousQuoteContext = null,
  currentMissingFields = [],
  previousMissingFields = [],
} = {}) => {
  const normalizedCurrentMissingFields = Array.isArray(currentMissingFields)
    ? currentMissingFields.filter((entry) => typeof entry === 'string')
    : []
  const normalizedPreviousMissingFields = Array.isArray(previousMissingFields)
    ? previousMissingFields.filter((entry) => typeof entry === 'string')
    : []
  const previousMissingFieldSet = new Set(normalizedPreviousMissingFields)
  const currentMissingFieldSet = new Set(normalizedCurrentMissingFields)
  const attributeKeys = normalizeQuoteAttributeKeys(readiness?.quoteAttributeKeys)

  if (
    readiness?.quoteMeasurementOnlyFollowUp === true &&
    (previousMissingFieldSet.has('measurements') ||
      currentMissingFieldSet.has('measurements') ||
      compactText(readiness?.resumePointer) === 'measurements' ||
      compactText(readiness?.nextUsefulField) === 'measurements')
  ) {
    return true
  }

  if (
    readiness?.quoteQuantityOnlyFollowUp === true &&
    (previousMissingFieldSet.has('quantity') ||
      currentMissingFieldSet.has('quantity') ||
      compactText(readiness?.resumePointer) === 'quantity' ||
      compactText(readiness?.nextUsefulField) === 'quantity')
  ) {
    return true
  }

  if (
    readiness?.quoteAttributeOnlyFollowUp === true &&
    attributeKeys.some(
      (field) => previousMissingFieldSet.has(field) || currentMissingFieldSet.has(field),
    )
  ) {
    return true
  }

  const currentMeasurementFingerprint = normalizeQuoteMeasurementFingerprint(
    currentQuoteContext,
  )
  const previousMeasurementFingerprint = normalizeQuoteMeasurementFingerprint(
    previousQuoteContext,
  )
  const measurementsChanged =
    Boolean(currentMeasurementFingerprint) &&
    currentMeasurementFingerprint !== previousMeasurementFingerprint &&
    (previousMissingFieldSet.has('measurements') ||
      currentMissingFieldSet.has('measurements') ||
      compactText(readiness?.resumePointer) === 'measurements' ||
      compactText(readiness?.nextUsefulField) === 'measurements')

  const currentQuantity =
    currentQuoteContext?.quantity && typeof currentQuoteContext.quantity === 'object'
      ? currentQuoteContext.quantity
      : null
  const previousQuantity =
    previousQuoteContext?.quantity && typeof previousQuoteContext.quantity === 'object'
      ? previousQuoteContext.quantity
      : null
  const currentQuantityTotal = Number(currentQuantity?.total || 0)
  const previousQuantityTotal = Number(previousQuantity?.total || 0)
  const quantityChanged =
    currentQuantityTotal > 0 &&
    currentQuantityTotal !== previousQuantityTotal &&
    (previousMissingFieldSet.has('quantity') ||
      currentMissingFieldSet.has('quantity') ||
      compactText(readiness?.resumePointer) === 'quantity' ||
      compactText(readiness?.nextUsefulField) === 'quantity')

  const resolvedMissingAttribute =
    attributeKeys.length > 0 &&
    attributeKeys.some(
      (field) => previousMissingFieldSet.has(field) && !currentMissingFieldSet.has(field),
    )

  return measurementsChanged || quantityChanged || resolvedMissingAttribute
}

const resolveQuoteThreadConflictExploration = ({
  readiness = null,
  previousConversationContext = null,
  previousActiveThreadKey = null,
  threadResolution = null,
  quoteContext = null,
  previousQuoteContext = null,
  missingFields = [],
} = {}) => {
  const readinessLane = normalizeIntentKeyValue(readiness?.lane)
  const previousLane = normalizeIntentKeyValue(
    readConversationActiveLane(previousConversationContext),
  )

  if (readinessLane !== 'quote' || previousLane !== 'quote') {
    return false
  }

  const previousReadiness =
    previousConversationContext?.resolutionReadiness &&
    typeof previousConversationContext.resolutionReadiness === 'object'
      ? previousConversationContext.resolutionReadiness
      : null
  const previousThreadKey =
    compactText(
      previousConversationContext?.threadKey ||
        previousReadiness?.threadKey ||
        previousActiveThreadKey ||
        '',
    ) || null
  const currentThreadKey =
    compactText(
      threadResolution?.activeThreadKey || readiness?.threadKey || previousThreadKey || '',
    ) || null

  if (!previousThreadKey || !currentThreadKey || previousThreadKey === currentThreadKey) {
    return false
  }

  const previousTopicLabel = normalizeDecisionTopicLabel(
    previousConversationContext?.topicLabel ||
      previousReadiness?.knownFacts?.topic ||
      previousConversationContext?.conversationState?.slots?.product?.value ||
      '',
  )
  const currentTopicLabel = normalizeDecisionTopicLabel(
    threadResolution?.activeThread?.resolvedLabel ||
      threadResolution?.activeThread?.baseLabel ||
      readiness?.knownFacts?.topic ||
      quoteContext?.topicLabel ||
      quoteContext?.familyLabel ||
      '',
  )

  if (!previousTopicLabel || !currentTopicLabel || previousTopicLabel === currentTopicLabel) {
    return false
  }

  return !hasCurrentTurnQuoteSlotContribution({
    readiness,
    currentQuoteContext: quoteContext,
    previousQuoteContext,
    currentMissingFields: missingFields,
    previousMissingFields: previousReadiness?.missingFields,
  })
}

const hasRecognizedQuoteProgressProfile = (quoteContext = null) =>
  Boolean(
    quoteContext &&
      (
        quoteContext?.profileResolved === true ||
        (typeof quoteContext?.profileKey === 'string' && quoteContext.profileKey.trim())
      ),
  )

const buildDecisionProgressGuard = ({
  readiness = null,
  lane = null,
  answerMode = null,
  nextUsefulField = null,
  operationalAnswerMode = null,
  hasOperationalThread = false,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  quoteThreadConflictExploration = false,
  quoteExplorationWithoutSlotContribution = false,
} = {}) => {
  const normalizedLane = normalizeIntentKeyValue(lane)
  const normalizedAnswerMode =
    typeof answerMode === 'string' && answerMode.trim() ? answerMode.trim() : null
  const result = {
    active: ['quote', 'support', 'schedule'].includes(String(normalizedLane || '')),
    blocked: false,
    allowAdvance: false,
    reason: null,
    forcedMode: null,
    forcedAnswerMode: null,
  }

  if (!result.active) {
    result.reason = 'non_operational_lane'
    return result
  }

  if (
    readiness?.sideQuestionSubtype ||
    normalizedAnswerMode === 'answer_side_question'
  ) {
    return {
      ...result,
      allowAdvance: true,
      reason:
        normalizedAnswerMode === 'answer_side_question'
          ? 'side_question_contract'
          : 'side_question_with_resume',
      forcedMode: 'exploration',
      forcedAnswerMode: 'answer_side_question',
    }
  }

  if (readiness?.requiresDisambiguation === true) {
    result.reason = 'requires_disambiguation'
    return result
  }

  if (quoteThreadConflictExploration) {
    return {
      ...result,
      blocked: true,
      reason: 'quote_thread_conflict',
      forcedMode: 'exploration',
      forcedAnswerMode: 'guide_quote_exploration',
    }
  }

  if (quoteExplorationWithoutSlotContribution) {
    return {
      ...result,
      blocked: true,
      reason: 'quote_exploration_without_slot_contribution',
      forcedMode: 'exploration',
      forcedAnswerMode: 'guide_quote_exploration',
    }
  }

  if (!hasOperationalThread) {
    result.reason = 'no_active_thread'
    return result
  }

  if (normalizedLane === 'quote') {
    const normalizedTurnIntentKey = normalizeIntentKeyValue(readiness?.turnIntent)
    const quoteCompletionStatus = String(quoteContext?.completionStatus || '')
    const quoteCanClose = ['ready_for_pricing_or_handoff', 'ready_for_handoff'].includes(
      quoteCompletionStatus,
    )
    const quoteProfileRecognized = hasRecognizedQuoteProgressProfile(quoteContext)
    const quoteNeedsOperationalField = Boolean(nextUsefulField)
    const quoteInformationFirst =
      readiness?.quoteInformationFirst === true ||
      readiness?.quoteTopicOnlyTurn === true ||
      readiness?.quoteTopicOnlyTurnText === true
    const quoteExplorationOutsideOperationalThread =
      CUSTOMER_EXPLORATION_INTENT_KEYS.has(String(normalizedTurnIntentKey || '')) &&
      readiness?.quoteOriginThread !== true

    if (quoteExplorationOutsideOperationalThread) {
      return {
        ...result,
        blocked: true,
        reason: 'quote_exploration_root',
        forcedMode: 'exploration',
        forcedAnswerMode:
          normalizedAnswerMode === 'inform_then_guide_quote'
            ? 'inform_then_guide_quote'
            : 'guide_quote_exploration',
      }
    }

    if (!quoteProfileRecognized && !quoteCanClose) {
      return {
        ...result,
        blocked: true,
        reason: 'quote_profile_unrecognized',
        forcedMode: 'exploration',
        forcedAnswerMode: 'guide_quote_exploration',
      }
    }

    if (quoteInformationFirst) {
      return {
        ...result,
        blocked: true,
        reason: 'quote_information_first',
        forcedMode:
          normalizedAnswerMode === 'inform_then_guide_quote' ? 'exploration' : null,
        forcedAnswerMode:
          normalizedAnswerMode === 'inform_then_guide_quote'
            ? 'inform_then_guide_quote'
            : 'guide_quote_exploration',
      }
    }

    if (quoteNeedsOperationalField || quoteCanClose) {
      return {
        ...result,
        allowAdvance: true,
        reason: quoteNeedsOperationalField ? 'ask_next_missing_field' : 'quote_ready',
        forcedMode: 'flow',
        forcedAnswerMode: operationalAnswerMode,
      }
    }

    return {
      ...result,
      blocked: true,
      reason: 'quote_no_progress_target',
      forcedMode: 'exploration',
      forcedAnswerMode: 'guide_quote_exploration',
    }
  }

  if (normalizedLane === 'support') {
    const hasSupportTarget =
      hasSupportDecisionContext(supportContext) ||
      typeof readiness?.threadKey === 'string' ||
      typeof readiness?.activeThreadId === 'string'
    const supportHasConcreteResolution =
      !nextUsefulField &&
      (
        typeof supportContext?.issueSummary === 'string' ||
        typeof supportContext?.address === 'string' ||
        Boolean(supportContext?.preferredDate?.dateLabel) ||
        Boolean(supportContext?.preferredTime?.timeLabel) ||
        Boolean(supportContext?.wantsVisit)
      )
    if (!hasSupportTarget) {
      return {
        ...result,
        blocked: true,
        reason: 'support_no_progress_target',
      }
    }

    if (!nextUsefulField && !supportHasConcreteResolution) {
      return {
        ...result,
        blocked: true,
        reason: 'support_no_resolution_delta',
      }
    }

    return {
      ...result,
      allowAdvance: true,
      reason: nextUsefulField ? 'ask_next_missing_field' : 'support_continue',
      forcedMode: 'flow',
      forcedAnswerMode: operationalAnswerMode,
    }
  }

  if (normalizedLane === 'schedule') {
    const hasScheduleTarget =
      hasConcreteSchedulePayload(scheduleContext) ||
      typeof readiness?.threadKey === 'string' ||
      typeof readiness?.activeThreadId === 'string'
    const scheduleReadyToConfirm =
      !nextUsefulField &&
      (
        Boolean(scheduleContext?.startAt) ||
        (
          typeof scheduleContext?.address === 'string' &&
          Boolean(scheduleContext?.date?.dateLabel) &&
          Boolean(scheduleContext?.time?.timeLabel)
        )
      )
    if (!hasScheduleTarget) {
      return {
        ...result,
        blocked: true,
        reason: 'schedule_no_progress_target',
      }
    }

    if (!nextUsefulField && !scheduleReadyToConfirm) {
      return {
        ...result,
        blocked: true,
        reason: 'schedule_no_resolution_delta',
      }
    }

    return {
      ...result,
      allowAdvance: true,
      reason: nextUsefulField ? 'ask_next_missing_field' : 'schedule_confirm',
      forcedMode: 'flow',
      forcedAnswerMode: operationalAnswerMode,
    }
  }

  return result
}

export const faqSubtypeBelongsToOperationalLane = ({
  faqSubtype = null,
  lane = null,
} = {}) => {
  const normalizedFaqSubtype = compactText(faqSubtype).toLowerCase()
  const normalizedLane = normalizeIntentKeyValue(lane)

  if (!normalizedFaqSubtype) {
    return false
  }

  if (normalizedLane === 'quote' || normalizedLane === 'support') {
    return true
  }

  if (normalizedLane === 'schedule') {
    return false
  }

  return false
}

export const resolveSideQuestionIntentKey = ({
  normalizedTurnIntentKey = null,
  sideQuestionSubtype = null,
} = {}) => {
  if (
    normalizedTurnIntentKey === 'customer.topic_info' ||
    normalizedTurnIntentKey === 'customer.contact_info'
  ) {
    return normalizedTurnIntentKey
  }

  if (String(sideQuestionSubtype || '') === 'contact') {
    return 'customer.contact_info'
  }

  return 'customer.topic_info'
}

export const applyPreResponseDecisionGuards = ({
  readiness = null,
  previousConversationContext = null,
  previousActiveThreadKey = null,
  threadResolution = null,
  quoteContext = null,
  previousQuoteContext = null,
  supportContext = null,
  scheduleContext = null,
  conversationState = null,
} = {}) => {
  if (!readiness || typeof readiness !== 'object') {
    return readiness
  }

  const previousLane = normalizeIntentKeyValue(
    readConversationActiveLane(previousConversationContext),
  )
  const previousReadiness =
    previousConversationContext?.resolutionReadiness &&
    typeof previousConversationContext.resolutionReadiness === 'object'
      ? previousConversationContext.resolutionReadiness
      : null
  const activeThreadId =
    compactText(
      threadResolution?.activeThreadKey ||
        readiness?.threadKey ||
        previousConversationContext?.threadKey ||
        previousReadiness?.threadKey ||
        previousActiveThreadKey ||
        '',
    ) || null
  const hasCurrentOperationalContext = (lane) =>
    hasOperationalDecisionContext({
      lane,
      quoteContext,
      supportContext,
      scheduleContext,
    })
  const hasOperationalThreadToResume = ['quote', 'support', 'schedule'].includes(
    String(previousLane || ''),
  )
  const currentTurnIntentKey = normalizeIntentKeyValue(readiness?.turnIntent)
  let lane = normalizeIntentKeyValue(readiness?.lane) || previousLane || null
  const keepCurrentOperationalLane =
    lane &&
    lane !== previousLane &&
    ['quote', 'support', 'schedule'].includes(String(lane || '')) &&
    (
      hasCurrentOperationalContext(lane) ||
      (
        lane === 'quote' &&
        currentTurnIntentKey === 'customer.quote'
      ) ||
      (
        lane === 'support' &&
        currentTurnIntentKey === 'customer.support_request'
      ) ||
      (
        lane === 'schedule' &&
        currentTurnIntentKey === 'customer.schedule_request'
      )
    )
  const previousPendingField =
    compactText(
      previousConversationContext?.resumePointer ||
        previousReadiness?.nextUsefulField ||
        '',
    ) || null
  const previousOperationalContinuationPending =
    ['quote', 'support', 'schedule'].includes(String(previousLane || '')) &&
    (
      Boolean(previousPendingField) ||
      CUSTOMER_FLOW_CARRYOVER_ANSWER_MODES.has(
        String(previousReadiness?.answerMode || ''),
      )
    )
  const previousMissingFields = Array.isArray(previousReadiness?.missingFields)
    ? previousReadiness.missingFields
    : []
  if (
    hasOperationalThreadToResume &&
    (
      !['quote', 'support', 'schedule'].includes(String(lane || '')) ||
      (lane !== previousLane &&
        hasCurrentOperationalContext(previousLane) &&
        !keepCurrentOperationalLane)
    ) &&
    (readiness?.followUpDetected === true ||
      activeThreadId ||
      hasCurrentOperationalContext(previousLane) ||
      previousOperationalContinuationPending)
  ) {
    lane = previousLane
  }

  const missingFields = getOperationalMissingFieldsForLane({
    lane,
    quoteContext,
    supportContext,
    scheduleContext,
    conversationState,
  })
  const requestedField =
    compactText(
      readiness?.resumePointer ||
        readiness?.nextUsefulField ||
        previousConversationContext?.resumePointer ||
        previousReadiness?.nextUsefulField ||
        '',
    ) || null
  let nextUsefulField = chooseNextMissingFieldForDecision({
    requestedField,
    missingFields,
    conversationState,
  })
  let answerMode =
    typeof readiness?.answerMode === 'string' && readiness.answerMode.trim()
      ? readiness.answerMode.trim()
      : null
  let mode =
    typeof readiness?.mode === 'string' && readiness.mode.trim()
      ? readiness.mode.trim()
      : null
  const operationalAnswerMode = getOperationalAnswerModeForLane(lane, nextUsefulField)
  const hasOperationalThread =
    ['quote', 'support', 'schedule'].includes(String(lane || '')) &&
    (Boolean(activeThreadId) ||
      hasCurrentOperationalContext(lane) ||
      hasOperationalThreadToResume)
  const signalBelongsToActiveThread = faqSubtypeBelongsToOperationalLane({
    faqSubtype: readiness?.sideQuestionSubtype,
    lane,
  })
  const normalizedTurnIntentKey = normalizeIntentKeyValue(readiness?.turnIntent)
  const currentTurnWordCount =
    typeof readiness?.currentTurnWordCount === 'number' &&
    Number.isFinite(readiness.currentTurnWordCount)
      ? readiness.currentTurnWordCount
      : 0
  const questionLikeTurn = readiness?.questionLikeTurn === true
  const lightOrNeutralTurnIntent = new Set([
    'customer.light',
    'customer.confirmation',
    'customer.other',
    'customer.incomplete',
    'customer.clarify_request',
  ]).has(String(normalizedTurnIntentKey || ''))
  const quoteCurrentTurnAddsSlots = hasCurrentTurnQuoteSlotContribution({
    readiness,
    currentQuoteContext: quoteContext,
    previousQuoteContext,
    currentMissingFields: missingFields,
    previousMissingFields,
  })
  const samePendingFieldAsPreviousTurn =
    resolveConversationFieldIdentity(nextUsefulField, conversationState) != null &&
    resolveConversationFieldIdentity(nextUsefulField, conversationState) ===
      resolveConversationFieldIdentity(previousPendingField, conversationState)
  const substantiveQuoteFollowUpWithoutSlotContribution =
    normalizedTurnIntentKey === 'customer.quote' &&
    readiness?.followUpDetected === true &&
    currentTurnWordCount > 4 &&
    !lightOrNeutralTurnIntent
  const quoteOperationalSideQuestionSignal =
    lane === 'quote' &&
    hasOperationalThread &&
    !readiness?.sideQuestionSubtype &&
    quoteCurrentTurnAddsSlots !== true &&
    !readiness?.lightClosureFollowUp &&
    (
      (
        CUSTOMER_EXPLORATION_INTENT_KEYS.has(String(normalizedTurnIntentKey || '')) &&
        (questionLikeTurn || currentTurnWordCount > 4)
      ) ||
      substantiveQuoteFollowUpWithoutSlotContribution
    )
  const quoteExplorationWithoutSlotContribution =
    lane === 'quote' &&
    CUSTOMER_EXPLORATION_INTENT_KEYS.has(String(normalizedTurnIntentKey || '')) &&
    quoteCurrentTurnAddsSlots !== true &&
    !readiness?.sideQuestionSubtype &&
    !quoteOperationalSideQuestionSignal
  const quoteThreadConflictExploration = resolveQuoteThreadConflictExploration({
    readiness,
    previousConversationContext,
    previousActiveThreadKey,
    threadResolution,
    quoteContext,
    previousQuoteContext,
    missingFields,
  })
  const shouldOverrideSignalAnswerMode =
    hasOperationalThread &&
    signalBelongsToActiveThread &&
    SIGNAL_ONLY_ANSWER_MODES.has(String(answerMode || ''))

  if (
    /^ask_/.test(String(answerMode || '')) &&
    nextUsefulField &&
    isConversationFieldResolved(nextUsefulField, conversationState)
  ) {
    nextUsefulField = chooseNextMissingFieldForDecision({
      requestedField: null,
      missingFields,
      conversationState,
    })
  }

  const progressGuard = buildDecisionProgressGuard({
    readiness,
    lane,
    answerMode,
    nextUsefulField,
    operationalAnswerMode,
    hasOperationalThread,
    quoteContext,
    supportContext,
    scheduleContext,
    quoteThreadConflictExploration,
    quoteExplorationWithoutSlotContribution,
  })

  if (/^ask_/.test(String(answerMode || '')) && !nextUsefulField) {
    answerMode = operationalAnswerMode
    mode = 'flow'
  } else if (progressGuard.forcedAnswerMode) {
    answerMode = progressGuard.forcedAnswerMode
    if (progressGuard.forcedMode) {
      mode = progressGuard.forcedMode
    }
  } else if (
    progressGuard.allowAdvance &&
    (
      GENERIC_NON_PROGRESS_ANSWER_MODES.has(String(answerMode || '')) ||
      String(answerMode || '') === 'light_turn'
    )
  ) {
    answerMode = operationalAnswerMode
    if (progressGuard.forcedMode) {
      mode = progressGuard.forcedMode
    }
  } else if (shouldOverrideSignalAnswerMode && readiness?.sideQuestionSubtype == null) {
    answerMode = operationalAnswerMode
    mode = 'flow'
  }

  const shouldPauseRepeatedOutstandingAsk =
    hasOperationalThread &&
    Boolean(nextUsefulField) &&
    samePendingFieldAsPreviousTurn &&
    lightOrNeutralTurnIntent &&
    (
      readiness?.lightClosureFollowUp === true ||
      currentTurnWordCount <= 8
    )

  if (quoteOperationalSideQuestionSignal) {
    nextUsefulField = null
    answerMode = 'answer_side_question'
    mode = 'exploration'
  } else if (shouldPauseRepeatedOutstandingAsk) {
    answerMode = 'hold_for_more_context'
    mode = 'exploration'
  }

  if (progressGuard.blocked === true && progressGuard.forcedAnswerMode === 'guide_quote_exploration') {
    nextUsefulField = null
  }

  if (!answerMode && operationalAnswerMode) {
    answerMode = operationalAnswerMode
  }

  return {
    ...readiness,
    lane: lane || readiness?.lane || null,
    missingFields,
    nextUsefulField,
    answerMode,
    mode: mode || readiness?.mode || null,
    threadKey: activeThreadId || readiness?.threadKey || null,
    activeThreadId,
    activeIntent:
      quoteThreadConflictExploration
        ? normalizeIntentKeyValue(readiness?.turnIntent) || 'customer.product_info'
        : (lane && CUSTOMER_LANE_ACTIVE_INTENT_KEYS[lane]) || readiness?.turnIntent || null,
    quoteCurrentTurnAddsSlots,
    quoteThreadConflictExploration,
    progressGuard,
    resumePointer:
      nextUsefulField ||
      requestedField ||
      (typeof readiness?.resumePointer === 'string' ? readiness.resumePointer : null),
  }
}

export const projectOperationalContextsForDecision = ({
  readiness = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  conversationState = null,
} = {}) => {
  const lane = normalizeIntentKeyValue(readiness?.lane)
  const answerMode = normalizeIntentKeyValue(readiness?.answerMode)
  const nextUsefulField =
    typeof readiness?.nextUsefulField === 'string' && readiness.nextUsefulField.trim()
      ? readiness.nextUsefulField.trim()
      : null

  const projectContext = (context, { emptyOnResolved = false } = {}) => {
    if (!context || typeof context !== 'object') {
      return context
    }

    const normalizedMissingFields = filterResolvedConversationFields({
      missingFields: Array.isArray(context?.missingFields) ? context.missingFields : [],
      conversationState,
    })

    let projectedMissingFields = normalizedMissingFields
    if (nextUsefulField && /^ask_/.test(String(answerMode || ''))) {
      projectedMissingFields = normalizedMissingFields.includes(nextUsefulField)
        ? [nextUsefulField]
        : normalizedMissingFields
    } else if (emptyOnResolved) {
      projectedMissingFields = []
    }

    const projectedMissingAttributes = Array.isArray(context?.missingAttributes)
      ? context.missingAttributes.filter(
          (entry) =>
            entry &&
            typeof entry === 'object' &&
            projectedMissingFields.includes(String(entry.key || '').trim()),
        )
      : Array.isArray(context?.requiredAttributes)
        ? context.requiredAttributes.filter(
            (entry) =>
              entry &&
              typeof entry === 'object' &&
              projectedMissingFields.includes(String(entry.key || '').trim()),
          )
        : []

    return {
      ...context,
      missingFields: projectedMissingFields,
      missingAttributes: projectedMissingAttributes,
      nextUsefulField,
    }
  }

  return {
    quoteContext:
      lane === 'quote'
        ? (() => {
            const projected = projectContext(quoteContext, {
              emptyOnResolved: answerMode === 'quote_ready',
            })
            if (!projected || typeof projected !== 'object') {
              return projected
            }
            if (answerMode !== 'quote_ready') {
              return projected
            }
            return {
              ...projected,
              completionStatus:
                typeof projected.completionStatus === 'string' &&
                projected.completionStatus.trim()
                  ? projected.completionStatus
                  : 'ready_for_handoff',
            }
          })()
        : quoteContext,
    supportContext:
      lane === 'support'
        ? projectContext(supportContext, {
            emptyOnResolved: answerMode === 'continue_support_resolution',
          })
        : supportContext,
    scheduleContext:
      lane === 'schedule'
        ? projectContext(scheduleContext, {
            emptyOnResolved: answerMode === 'confirm_schedule',
          })
        : scheduleContext,
  }
}

export const resolveCustomerActiveIntentKeyFromReadiness = ({
  role,
  turnIntentKey = null,
  readiness = null,
} = {}) => {
  const normalizedTurnIntentKey = normalizeIntentKeyValue(turnIntentKey)

  if (!(role === 'customer_public' || role === 'customer_authenticated')) {
    return normalizedTurnIntentKey || 'unknown'
  }

  if (!readiness || typeof readiness !== 'object') {
    return normalizedTurnIntentKey || 'unknown'
  }

  const readinessLane = normalizeIntentKeyValue(readiness.lane)
  const laneIntentKey = readinessLane
    ? CUSTOMER_LANE_ACTIVE_INTENT_KEYS[readinessLane] || null
    : null
  const answerMode = normalizeIntentKeyValue(readiness.answerMode)
  const waitForMoreReasons = Array.isArray(readiness?.waitForMoreReasons)
    ? readiness.waitForMoreReasons.filter((entry) => typeof entry === 'string')
    : []
  const hasStructuredQuoteSignal =
    readiness?.quoteStructuredContext === true ||
    readiness?.quoteActionReady === true ||
    Number(readiness?.knownFacts?.quantity || 0) > 0 ||
    typeof readiness?.knownFacts?.measurements === 'string'
  const hasQuoteFragmentCarryover = waitForMoreReasons.some(
    (reason) =>
      reason === 'quote_related_fragment' || String(reason).startsWith('quote_missing_'),
  )
  const shortQuoteSeedWait =
    waitForMoreReasons.length > 0 &&
    waitForMoreReasons.every((reason) => reason === 'short_quote_seed')
  const previousIntentWasQuote = readiness?.previousIntentWasQuote === true
  const hasQuoteContinuationSignal =
    readiness?.quoteOriginThread === true ||
    readiness?.quoteSeedDetected === true ||
    hasStructuredQuoteSignal ||
    hasQuoteFragmentCarryover
  const hasActiveQuoteThreadSignal =
    readinessLane === 'quote' &&
    (
      readiness?.quoteOriginThread === true ||
      readiness?.followUpDetected === true ||
      previousIntentWasQuote === true ||
      (
        typeof readiness?.activeThreadId === 'string' &&
        readiness.activeThreadId.trim()
      ) ||
      (
        typeof readiness?.threadKey === 'string' &&
        readiness.threadKey.trim()
      )
    )
  const previousQuoteDisambiguationPending =
    readiness?.previousQuoteDisambiguationPending === true
  const resetCueDetected = readiness?.resetCueDetected === true
  const topicOnlyExplorationTurn =
    readiness?.quoteTopicOnlyTurn === true ||
    readiness?.quoteTopicOnlyTurnText === true
  const canIgnoreInheritedQuoteStructure =
    CUSTOMER_PURE_EXPLORATION_INTENT_KEYS.has(String(normalizedTurnIntentKey || '')) &&
    previousIntentWasQuote !== true &&
    topicOnlyExplorationTurn
  const canPreserveExploratoryIntent =
    CUSTOMER_PURE_EXPLORATION_INTENT_KEYS.has(String(normalizedTurnIntentKey || '')) ||
    (
      normalizedTurnIntentKey === 'customer.price_inquiry' &&
      previousIntentWasQuote !== true &&
      previousQuoteDisambiguationPending !== true
    )
  const shouldDowngradeWeakQuoteTurn =
    readinessLane === 'quote' &&
    normalizedTurnIntentKey === 'customer.quote' &&
    readiness?.quoteOriginThread !== true &&
    readiness?.quoteSeedDetected !== true &&
    !hasStructuredQuoteSignal &&
    !hasQuoteFragmentCarryover &&
    readiness?.requiresDisambiguation !== true &&
    readiness?.quoteMultiTopic !== true &&
    (
      String(answerMode || '') === 'guide_quote_exploration' ||
      shortQuoteSeedWait ||
      readiness?.quoteTopicOnlyTurn === true ||
      readiness?.quoteTopicOnlyTurnText === true
    )
  const isOperationalContinuation =
    Boolean(laneIntentKey) &&
    ['quote', 'support', 'schedule'].includes(String(readinessLane || '')) &&
    (
      readinessLane === 'quote'
        ? hasQuoteContinuationSignal &&
          (
            CUSTOMER_FLOW_CARRYOVER_ANSWER_MODES.has(String(answerMode || '')) ||
            readiness?.followUpDetected === true ||
            (
              typeof readiness?.threadKey === 'string' &&
              readiness.threadKey.trim()
            )
          )
        : CUSTOMER_FLOW_CARRYOVER_ANSWER_MODES.has(String(answerMode || '')) ||
          readiness?.followUpDetected === true ||
          (
            typeof readiness?.threadKey === 'string' &&
            readiness.threadKey.trim() &&
            (readinessLane !== 'quote' || hasStructuredQuoteSignal)
          )
    )
  const shouldPreserveQuoteExplorationIntent =
    readinessLane === 'quote' &&
    canPreserveExploratoryIntent &&
    (!hasStructuredQuoteSignal || canIgnoreInheritedQuoteStructure) &&
    !hasQuoteFragmentCarryover &&
    readiness?.requiresDisambiguation !== true &&
    readiness?.quoteMultiTopic !== true &&
    previousQuoteDisambiguationPending !== true &&
    (
      resetCueDetected ||
      readiness?.quoteInformationFirst === true ||
      topicOnlyExplorationTurn ||
      shortQuoteSeedWait ||
      String(answerMode || '') === 'guide_quote_exploration'
    ) &&
    (
      previousIntentWasQuote !== true ||
      resetCueDetected
    )
  const shouldElevateDisambiguatedQuoteTurn =
    readiness?.requiresDisambiguation === true &&
    CUSTOMER_EXPLORATION_INTENT_KEYS.has(String(normalizedTurnIntentKey || '')) &&
    hasQuoteContinuationSignal
  const shouldPreserveTurnIntent =
    CUSTOMER_TURN_INTENT_PRESERVATION_KEYS.has(String(normalizedTurnIntentKey || '')) &&
    !(
      readinessLane === 'quote' &&
      hasQuoteContinuationSignal &&
      ['customer.clarify_request', 'customer.other', 'customer.incomplete'].includes(
        String(normalizedTurnIntentKey || ''),
      )
    )
  const isWeakGenericTurnIntent = ['customer.other', 'customer.incomplete', 'unknown', null].includes(
    normalizedTurnIntentKey,
  )

  if (normalizedTurnIntentKey === 'customer.multi_intent') {
    return normalizedTurnIntentKey
  }

  if (
    readiness?.supportThreadPresent === true &&
    typeof readiness?.knownFacts?.supportIssue === 'string' &&
    (
      normalizedTurnIntentKey === 'customer.support_request' ||
      normalizeIntentKeyValue(readiness?.turnIntent) === 'customer.support_request'
    )
  ) {
    return 'customer.support_request'
  }

  if (readiness?.quoteThreadConflictExploration === true) {
    return CUSTOMER_EXPLORATION_INTENT_KEYS.has(String(normalizedTurnIntentKey || ''))
      ? normalizedTurnIntentKey
      : 'customer.product_info'
  }

  if (
    readinessLane === 'quote' &&
    CUSTOMER_EXPLORATION_INTENT_KEYS.has(String(normalizedTurnIntentKey || '')) &&
    readiness?.quoteCurrentTurnAddsSlots !== true &&
    !readiness?.sideQuestionSubtype &&
    !hasActiveQuoteThreadSignal
  ) {
    return normalizedTurnIntentKey
  }

  if (shouldDowngradeWeakQuoteTurn) {
    return 'customer.product_info'
  }

  if (
    readiness?.quoteThreadPresent === true &&
    readiness?.artifactTurn === true &&
    ['customer.incomplete', 'customer.other', 'unknown', null].includes(
      normalizedTurnIntentKey,
    )
  ) {
    return 'customer.quote'
  }

  if (readinessLane === 'quote' && laneIntentKey) {
    if (CUSTOMER_OPERATIONAL_INTENT_KEYS.has(String(normalizedTurnIntentKey || ''))) {
      return normalizedTurnIntentKey
    }
    if (shouldElevateDisambiguatedQuoteTurn) {
      return laneIntentKey
    }
    if (shouldPreserveQuoteExplorationIntent) {
      return normalizedTurnIntentKey
    }
    if (
      (isOperationalContinuation ||
        hasQuoteFragmentCarryover ||
        readiness?.quoteSeedDetected === true ||
        readiness?.artifactTurn === true) &&
      !readiness?.sideQuestionSubtype &&
      (
        isWeakGenericTurnIntent ||
        shouldPreserveTurnIntent ||
        CUSTOMER_EXPLORATION_INTENT_KEYS.has(String(normalizedTurnIntentKey || ''))
      )
    ) {
      return laneIntentKey
    }
  }

  if (
    readinessLane === 'support' &&
    laneIntentKey &&
    CUSTOMER_OPERATIONAL_INTENT_KEYS.has(String(normalizedTurnIntentKey || ''))
  ) {
    return normalizedTurnIntentKey
  }

  if (
    readinessLane === 'support' &&
    laneIntentKey &&
    isOperationalContinuation &&
    !readiness?.sideQuestionSubtype &&
    (
      normalizedTurnIntentKey == null ||
      shouldPreserveTurnIntent
    )
  ) {
    return laneIntentKey
  }

  if (
    readiness?.supportThreadPresent === true &&
    readiness?.artifactTurn === true &&
    ['customer.schedule_request', 'customer.incomplete', 'customer.other', null].includes(
      normalizedTurnIntentKey,
    )
  ) {
    return 'customer.support_request'
  }

  if (
    readinessLane === 'schedule' &&
    laneIntentKey &&
    readiness?.quoteThreadPresent === true &&
    hasStructuredQuoteSignal &&
    readiness?.scheduleTurnSignals !== true &&
    (
      readiness?.artifactTurn === true ||
      readiness?.followUpDetected === true
    ) &&
    ['customer.schedule_request', 'customer.incomplete', 'customer.other', null].includes(
      normalizedTurnIntentKey,
    )
  ) {
    return 'customer.quote'
  }

  if (
    readinessLane === 'schedule' &&
    laneIntentKey &&
    ['customer.confirmation', 'customer.cancellation'].includes(
      String(normalizedTurnIntentKey || ''),
    )
  ) {
    return normalizedTurnIntentKey
  }

  if (
    readinessLane === 'schedule' &&
    laneIntentKey &&
    CUSTOMER_OPERATIONAL_INTENT_KEYS.has(String(normalizedTurnIntentKey || ''))
  ) {
    return normalizedTurnIntentKey
  }

  if (
    readinessLane === 'schedule' &&
    laneIntentKey &&
    isOperationalContinuation &&
    !readiness?.sideQuestionSubtype &&
    (
      normalizedTurnIntentKey == null ||
      shouldPreserveTurnIntent
    )
  ) {
    return laneIntentKey
  }

  if (
    readiness?.sideQuestionSubtype &&
    laneIntentKey &&
    ['quote', 'support', 'schedule'].includes(String(readinessLane || '')) &&
    (
      typeof readiness?.activeThreadId === 'string' ||
      typeof readiness?.threadKey === 'string' ||
      readiness?.followUpDetected === true
    )
  ) {
    return resolveSideQuestionIntentKey({
      normalizedTurnIntentKey,
      sideQuestionSubtype: readiness?.sideQuestionSubtype,
    })
  }

  if (
    answerMode === 'answer_side_question' &&
    laneIntentKey &&
    ['quote', 'support', 'schedule'].includes(String(readinessLane || '')) &&
    (
      typeof readiness?.activeThreadId === 'string' ||
      typeof readiness?.threadKey === 'string' ||
      readiness?.followUpDetected === true
    ) &&
    !shouldPreserveTurnIntent
  ) {
    return resolveSideQuestionIntentKey({
      normalizedTurnIntentKey,
      sideQuestionSubtype: readiness?.sideQuestionSubtype,
    })
  }

  if (
    readiness?.sideQuestionSubtype ||
    answerMode === 'answer_side_question' ||
    readiness?.mode === 'small_talk' ||
    readiness?.mode === 'unclear' ||
    shouldPreserveTurnIntent
  ) {
    return normalizedTurnIntentKey || laneIntentKey || 'unknown'
  }

  if (
    laneIntentKey &&
    CUSTOMER_FLOW_CARRYOVER_ANSWER_MODES.has(String(answerMode || ''))
  ) {
    return laneIntentKey
  }

  return normalizedTurnIntentKey || laneIntentKey || 'unknown'
}

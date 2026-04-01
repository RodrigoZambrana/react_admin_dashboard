import { readInterpretationResolutionReadiness } from '../conversation/resolution-readiness.js'

export const decideNextStep = ({
  role,
  conversationMode,
  deterministicResponse = null,
  intentKey = null,
  interpretation = null,
  assistantDecision = null,
  assistantMinConfidence = 0.8,
}) => {
  const readiness = readInterpretationResolutionReadiness(interpretation)

  const applyAssistantDecision = (baseDecision) => {
    if (
      !assistantDecision ||
      typeof assistantDecision.action !== 'string' ||
      !Number.isFinite(Number(assistantDecision.confidence)) ||
      Number(assistantDecision.confidence) < assistantMinConfidence
    ) {
      return baseDecision
    }

    const assistantAction = String(assistantDecision.action).trim()
    const nextUsefulField =
      typeof readiness?.nextUsefulField === 'string'
        ? readiness.nextUsefulField
        : null
    const waitForMore = readiness?.waitForMore === true
    const allowedActions = new Set([
      'execute_flow',
      'conversational_mode',
      'ask_clarification',
      'small_talk',
    ])

    if (!allowedActions.has(assistantAction)) {
      return baseDecision
    }

    const result = {
      ...baseDecision,
      assistantSuggestion: {
        action: assistantAction,
        confidence: Number(assistantDecision.confidence),
        reasoning:
          typeof assistantDecision.reasoning === 'string'
            ? assistantDecision.reasoning
            : null,
        missingFields: Array.isArray(assistantDecision.missingFields)
          ? assistantDecision.missingFields
          : [],
        applied: false,
      },
    }

    if (assistantAction === baseDecision.nextStep) {
      result.assistantSuggestion.applied = true
      result.reason = `${baseDecision.reason}+assistant_confirmed`
      return result
    }

    if (waitForMore && assistantAction === 'execute_flow') {
      return result
    }

    if (
      assistantAction === 'execute_flow' &&
      !nextUsefulField &&
      !deterministicResponse
    ) {
      return result
    }

    const allowedSwitch =
      (baseDecision.nextStep === 'execute_flow' &&
        ['conversational_mode', 'ask_clarification'].includes(assistantAction)) ||
      (['conversational_mode', 'ask_clarification'].includes(baseDecision.nextStep) &&
        ['execute_flow', 'conversational_mode', 'ask_clarification'].includes(
          assistantAction,
        )) ||
      (baseDecision.nextStep === 'small_talk' && assistantAction === 'ask_clarification')

    if (!allowedSwitch) {
      return result
    }

    result.nextStep = assistantAction
    result.shouldGenerateLanguage = assistantAction !== 'execute_flow'
    result.shouldUseDeterministicDraft =
      assistantAction === 'execute_flow'
        ? Boolean(deterministicResponse)
        : Boolean(deterministicResponse)
    result.reason = `${baseDecision.reason}+assistant_override`
    result.assistantSuggestion.applied = true
    return result
  }

  if (!String(role || '').startsWith('customer_')) {
    return applyAssistantDecision({
      nextStep: 'execute_flow',
      shouldUseDeterministicDraft: Boolean(deterministicResponse),
      shouldGenerateLanguage: false,
      reason: 'non_customer_role',
    })
  }

  const responseStrategy =
    typeof readiness?.answerMode === 'string'
      ? readiness.answerMode
      : null
  const nextUsefulField =
    typeof readiness?.nextUsefulField === 'string'
      ? readiness.nextUsefulField
      : null
  const waitForMore = readiness?.waitForMore === true

  if (waitForMore) {
    return applyAssistantDecision({
      nextStep: 'conversational_mode',
      shouldUseDeterministicDraft: Boolean(deterministicResponse),
      shouldGenerateLanguage: true,
      reason: 'wait_for_more_context',
      nextUsefulField,
      responseStrategy,
    })
  }

  const readinessMappedDecision = (() => {
    switch (responseStrategy) {
      case 'light_turn':
        return {
          nextStep: 'small_talk',
          shouldUseDeterministicDraft: Boolean(deterministicResponse),
          shouldGenerateLanguage: false,
          reason: 'readiness:light_turn',
        }
      case 'ask_clarification':
        return {
          nextStep: 'ask_clarification',
          shouldUseDeterministicDraft: Boolean(deterministicResponse),
          shouldGenerateLanguage: Boolean(deterministicResponse),
          reason: 'readiness:ask_clarification',
        }
      case 'answer_side_question':
      case 'guided_exploration':
      case 'guide_quote_exploration':
      case 'inform_then_guide_quote':
        return {
          nextStep: 'conversational_mode',
          shouldUseDeterministicDraft: Boolean(deterministicResponse),
          shouldGenerateLanguage: true,
          reason: `readiness:${responseStrategy}`,
        }
      case 'ask_quote_field':
      case 'quote_ready':
      case 'ask_support_field':
      case 'continue_support_resolution':
      case 'ask_schedule_field':
      case 'confirm_schedule':
      case 'ask_next_useful_field':
      case 'execute_flow':
        return {
          nextStep: 'execute_flow',
          shouldUseDeterministicDraft: Boolean(deterministicResponse),
          shouldGenerateLanguage: Boolean(deterministicResponse),
          reason: `readiness:${responseStrategy}`,
        }
      default:
        return null
    }
  })()

  if (readinessMappedDecision) {
    return applyAssistantDecision({
      ...readinessMappedDecision,
      nextUsefulField,
      responseStrategy,
    })
  }

  switch (conversationMode?.mode) {
    case 'small_talk':
      return applyAssistantDecision({
        nextStep: 'small_talk',
        shouldUseDeterministicDraft: Boolean(deterministicResponse),
        shouldGenerateLanguage: false,
        reason: 'small_talk_mode',
        nextUsefulField,
        responseStrategy,
      })
    case 'unclear':
      return applyAssistantDecision({
        nextStep: 'ask_clarification',
        shouldUseDeterministicDraft: Boolean(deterministicResponse),
        shouldGenerateLanguage: Boolean(deterministicResponse),
        reason: 'unclear_mode',
        nextUsefulField,
        responseStrategy,
      })
    case 'exploration':
      return applyAssistantDecision({
        nextStep: 'conversational_mode',
        shouldUseDeterministicDraft: Boolean(deterministicResponse),
        shouldGenerateLanguage: true,
        reason: 'exploration_mode',
        nextUsefulField,
        responseStrategy,
      })
    case 'flow':
    default:
      return applyAssistantDecision({
        nextStep: 'execute_flow',
        shouldUseDeterministicDraft: Boolean(deterministicResponse),
        shouldGenerateLanguage:
          Boolean(deterministicResponse) &&
          [
            'customer.product_info',
            'customer.topic_info',
            'customer.support_request',
            'customer.schedule_request',
            'customer.quote',
        ].includes(String(intentKey || '')),
        reason: 'flow_mode',
        nextUsefulField,
        responseStrategy,
      })
  }
}

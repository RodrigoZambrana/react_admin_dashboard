import { normalizeSemanticText } from '../intents/customer-semantic-signals.js'

const SMALL_TALK_CATEGORIES = new Set([
  'greeting',
  'courtesy',
  'confirmation',
  'cancellation',
])

const FLOW_INTENTS = new Set([
  'customer.quote',
  'customer.support_request',
  'customer.schedule_request',
  'customer.contact_info',
  'customer.order_status',
  'customer.auth_required',
  'customer.owned_document_request',
  'customer.private_account_data',
])

const EXPLORATION_INTENTS = new Set([
  'customer.product_info',
  'customer.topic_info',
  'customer.price_inquiry',
  'customer.clarify_request',
  'customer.rephrase_request',
])

const hasExplicitExplorationSignal = (normalizedInput) =>
  /\b(opciones|variantes|tipos|modelos|versiones|formatos|sirve|conviene|deja pasar luz|dejen pasar luz|dejan pasar luz|que me recomendas|que me recomend[aá]s|estoy viendo|estoy buscando|busco|me interesa|quisiera ver)\b/u.test(
    normalizedInput,
  )

const hasSmallTalkSignal = (normalizedInput) =>
  /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|gracias|ok|dale|perfecto|listo)(?:\b|$)/u.test(
    normalizedInput,
  )

export const classifyConversationMode = ({
  role,
  input,
  inboundClassification = null,
  analysis = null,
  intentKey = null,
  interpretation = null,
}) => {
  if (!String(role || '').startsWith('customer_')) {
    return {
      mode: 'flow',
      confidence: 1,
      reason: 'non_customer_role',
      source: 'rule',
    }
  }

  const normalizedInput = normalizeSemanticText(input)
  const analysisIntent = analysis?.intent || null
  const effectiveIntent = analysisIntent && analysisIntent !== 'none' ? analysisIntent : intentKey
  const llmConfidence =
    typeof analysis?.confidence === 'number' ? analysis.confidence : 0
  const contextMode =
    ['flow', 'exploration', 'unclear', 'small_talk'].includes(
      String(interpretation?.conversationContext?.mode || ''),
    )
      ? interpretation.conversationContext.mode
      : null

  if (
    hasSmallTalkSignal(normalizedInput) &&
    (SMALL_TALK_CATEGORIES.has(inboundClassification?.category) || normalizedInput.split(' ').length <= 4)
  ) {
    return {
      mode: 'small_talk',
      confidence: 0.95,
      reason: 'small_talk_signal',
      source: 'rule',
    }
  }

  if (contextMode === 'small_talk') {
    return {
      mode: 'small_talk',
      confidence:
        typeof interpretation?.conversationContext?.confidence === 'number'
          ? interpretation.conversationContext.confidence
          : 0.92,
      reason: 'conversation_context_small_talk',
      source: 'conversation_context',
    }
  }

  if (
    ['noise', 'unintelligible', 'incomplete'].includes(inboundClassification?.category) ||
    effectiveIntent === 'none'
  ) {
    if (contextMode === 'exploration' || contextMode === 'flow') {
      return {
        mode: contextMode,
        confidence:
          typeof interpretation?.conversationContext?.confidence === 'number'
            ? interpretation.conversationContext.confidence
            : llmConfidence || inboundClassification?.confidence || 0.7,
        reason: 'conversation_context_overrides_low_signal',
        source: 'conversation_context',
      }
    }

    return {
      mode: normalizedInput && normalizedInput.length > 2 ? 'unclear' : 'small_talk',
      confidence: llmConfidence || inboundClassification?.confidence || 0.75,
      reason: 'insufficient_signal',
      source: analysis?.source || 'rule',
    }
  }

  if (
    analysis?.conversationModeHint &&
    analysis.conversationModeHint === 'exploration' &&
    hasExplicitExplorationSignal(normalizedInput)
  ) {
    return {
      mode: 'exploration',
      confidence: llmConfidence || 0.7,
      reason: 'llm_hint_exploration',
      source: analysis?.source || 'rule',
    }
  }

  if (contextMode) {
    return {
      mode: contextMode,
      confidence:
        typeof interpretation?.conversationContext?.confidence === 'number'
          ? interpretation.conversationContext.confidence
          : llmConfidence || inboundClassification?.confidence || 0.72,
      reason: 'conversation_context',
      source: 'conversation_context',
    }
  }

  if (
    FLOW_INTENTS.has(effectiveIntent) &&
    llmConfidence >= 0.7
  ) {
    return {
      mode: 'flow',
      confidence: llmConfidence,
      reason: 'clear_flow_intent',
      source: analysis?.source || 'rule',
    }
  }

  if (
    EXPLORATION_INTENTS.has(effectiveIntent) ||
    hasExplicitExplorationSignal(normalizedInput) ||
    Boolean(interpretation?.followUp?.detected && interpretation?.topic?.label)
  ) {
    return {
      mode: llmConfidence >= 0.7 && FLOW_INTENTS.has(effectiveIntent) ? 'flow' : 'exploration',
      confidence: llmConfidence || inboundClassification?.confidence || 0.68,
      reason: 'guided_exploration',
      source: analysis?.source || 'rule',
    }
  }

  if (llmConfidence >= 0.7) {
    return {
      mode: 'flow',
      confidence: llmConfidence,
      reason: 'high_confidence_default',
      source: analysis?.source || 'rule',
    }
  }

  return {
    mode: 'unclear',
    confidence: Math.max(llmConfidence, inboundClassification?.confidence || 0.55),
    reason: 'default_unclear',
    source: analysis?.source || 'rule',
  }
}

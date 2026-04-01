import { readInterpretationResolutionReadiness } from './resolution-readiness.js'

export const resolveCustomerResponseContract = ({
  role,
  intentKey,
  turnInterpretation,
  tenantRuntimePolicy = null,
  intentRequiresStrictKnowledge = false,
  hasActiveKnowledgeTopicAnchor,
  hasActiveFactualKnowledgeAnchor,
  factualFaqSubtypes,
} = {}) => {
  if (!(role === 'customer_public' || role === 'customer_authenticated')) {
    return null
  }

  const readiness = readInterpretationResolutionReadiness(turnInterpretation)
  if (typeof readiness?.answerMode === 'string' && readiness.answerMode.trim()) {
    const answerMode = readiness.answerMode.trim()
    const sideQuestionSubtype =
      typeof readiness?.sideQuestionSubtype === 'string'
        ? readiness.sideQuestionSubtype
        : typeof turnInterpretation?.faqSubtype === 'string'
          ? turnInterpretation.faqSubtype
          : null
    const topicType =
      typeof turnInterpretation?.topic?.type === 'string'
        ? turnInterpretation.topic.type
        : typeof turnInterpretation?.contextTopic?.type === 'string'
          ? turnInterpretation.contextTopic.type
          : null
    const currentTurnText =
      typeof turnInterpretation?.currentTurnText === 'string'
        ? turnInterpretation.currentTurnText
        : ''
    const hasTopicAnchor = hasActiveKnowledgeTopicAnchor({
      turnInterpretation,
      currentTurnText,
      tenantRuntimePolicy,
    })
    const hasActiveFactualAnchor = hasActiveFactualKnowledgeAnchor({
      intentKey,
      turnInterpretation,
      currentTurnText,
      tenantRuntimePolicy,
    })
    const productTopicAnchor =
      hasActiveFactualAnchor &&
      ['product_family', 'product_topic', 'product_variant'].includes(
        String(topicType || ''),
      )
    const structuralQuoteFragmentTurn = Boolean(
      turnInterpretation?.followUp?.measurementOnly ||
        turnInterpretation?.followUp?.quantityOnly ||
        turnInterpretation?.followUp?.attributeOnly,
    )
    const quoteExplorationInformationTurn = Boolean(
      ['hold_for_more_context', 'guide_quote_exploration'].includes(answerMode) &&
        readiness?.lane === 'quote' &&
        ['customer.product_info', 'customer.topic_info'].includes(
          String(intentKey || ''),
        ) &&
        productTopicAnchor &&
        !structuralQuoteFragmentTurn,
    )
    const quoteSideFactualQuestion =
      answerMode === 'guide_quote_exploration' &&
      readiness?.lane === 'quote' &&
      ((factualFaqSubtypes.has(String(sideQuestionSubtype || '')) &&
        hasActiveFactualAnchor) ||
        productTopicAnchor)

    if (quoteExplorationInformationTurn || quoteSideFactualQuestion) {
      return 'inform_then_guide_quote'
    }

    return answerMode
  }

  if (intentRequiresStrictKnowledge) {
    return 'strict_knowledge_response'
  }

  return null
}

import { readInterpretationResolutionReadiness } from '../conversation/resolution-readiness.js'
import { getBusinessRules } from '../tenant-policy/runtime-tenant-policy.js'

export const resolveKnowledgeNeedDecision = ({
  role,
  intentKey,
  turnInterpretation,
  tenantRuntimePolicy = null,
  responseContract = null,
  intentRequiresStrictKnowledge = false,
  hasActiveKnowledgeTopicAnchor,
  hasActiveFactualKnowledgeAnchor,
  normalizeIntentKeyValue,
  looksLikeCommercialConditionQuestion,
  hasTenantInstallationSignal,
  hasTenantBusinessFactCoverage,
  factualFaqSubtypes,
  nonFactualSideQuestionResponseContracts,
  retrievalFreeResponseContracts,
  requiredRetrievalResponseContracts,
} = {}) => {
  const readiness = readInterpretationResolutionReadiness(turnInterpretation)
  const lane = typeof readiness?.lane === 'string' ? readiness.lane : null
  const missingFields = Array.isArray(readiness?.missingFields)
    ? readiness.missingFields.filter((entry) => typeof entry === 'string')
    : []
  const sideQuestionSubtype =
    typeof readiness?.sideQuestionSubtype === 'string'
      ? readiness.sideQuestionSubtype
      : typeof turnInterpretation?.faqSubtype === 'string'
        ? turnInterpretation.faqSubtype
        : null
  const currentTurnText =
    typeof turnInterpretation?.currentTurnText === 'string'
      ? turnInterpretation.currentTurnText
      : ''
  const paymentMethods = getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? []
  const inheritedIntentKey =
    typeof turnInterpretation?.followUp?.inheritedIntentKey === 'string'
      ? turnInterpretation.followUp.inheritedIntentKey
      : null
  const topicType =
    typeof turnInterpretation?.topic?.type === 'string'
      ? turnInterpretation.topic.type
      : typeof turnInterpretation?.contextTopic?.type === 'string'
        ? turnInterpretation.contextTopic.type
        : null
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
  const interpretedTurnIntentKey =
    typeof turnInterpretation?.intent?.key === 'string'
      ? normalizeIntentKeyValue(turnInterpretation.intent.key)
      : null
  const readinessTurnIntentKey =
    typeof readiness?.turnIntent === 'string'
      ? normalizeIntentKeyValue(readiness.turnIntent)
      : null
  const activeInformationAnchor =
    hasActiveFactualAnchor ||
    ['customer.product_info', 'customer.topic_info', 'customer.contact_info'].includes(
      String(readinessTurnIntentKey || interpretedTurnIntentKey || ''),
    )
  const strictKnowledgeRequired = intentRequiresStrictKnowledge
  const policyBackedInstallationCondition =
    looksLikeCommercialConditionQuestion(currentTurnText) &&
    hasTenantInstallationSignal(currentTurnText, tenantRuntimePolicy)
  const policyBackedQuoteOrSupportPaymentFaq =
    String(sideQuestionSubtype || '') === 'payment_methods' &&
    paymentMethods.length > 0 &&
    (['quote', 'support'].includes(String(lane || '')) ||
      turnInterpretation?.followUp?.detected === true ||
      [
        'customer.product_info',
        'customer.topic_info',
        'customer.quote',
        'customer.price_inquiry',
        'customer.support_request',
      ].includes(String(inheritedIntentKey || '')))
  const policyBackedBusinessFactFaq = hasTenantBusinessFactCoverage({
    tenantRuntimePolicy,
    faqSubtype: sideQuestionSubtype,
    intentKey,
    responseContract,
    lane,
  })
  const factualFaq =
    factualFaqSubtypes.has(String(sideQuestionSubtype || '')) &&
    (String(lane || '') !== 'quote' ||
      hasActiveFactualAnchor ||
      String(topicType || '') === 'business_fact')
  const anchoredVariantFaq =
    String(sideQuestionSubtype || '') === 'variants' &&
    hasActiveFactualAnchor &&
    !['support', 'schedule', 'general'].includes(String(lane || ''))
  const anchoredProductInformationTurn =
    hasActiveFactualAnchor &&
    ['customer.product_info', 'customer.topic_info'].includes(String(intentKey || '')) &&
    ['product_family', 'product_topic', 'product_variant'].includes(
      String(topicType || ''),
    ) &&
    !['support', 'schedule', 'general'].includes(String(lane || ''))
  const anchoredInformationTurn =
    ['customer.product_info', 'customer.topic_info', 'customer.contact_info'].includes(
      String(intentKey || ''),
    ) &&
    hasActiveFactualAnchor &&
    activeInformationAnchor &&
    !['support', 'schedule', 'general'].includes(String(lane || ''))
  const anchoredQuoteInformationTurn =
    String(intentKey || '') === 'customer.quote' &&
    String(responseContract || '') === 'inform_then_guide_quote' &&
    hasActiveFactualAnchor &&
    ['product_family', 'product_topic', 'product_variant'].includes(
      String(topicType || ''),
    ) &&
    !['support', 'schedule', 'general'].includes(String(lane || ''))
  const guidedContinuationTurn =
    missingFields.length > 0 &&
    ['quote', 'schedule', 'support'].includes(String(lane || '')) &&
    [
      'answer_side_question',
      'ask_quote_field',
      'ask_schedule_field',
      'ask_support_field',
      'guide_quote_exploration',
      'ask_clarification',
      'hold_for_more_context',
      'continue_support_resolution',
    ].includes(String(responseContract || ''))
  const anchoredQuoteSideQuestion =
    String(intentKey || '') === 'customer.quote' &&
    String(lane || '') === 'quote' &&
    String(responseContract || '') === 'answer_side_question' &&
    (
      hasActiveFactualAnchor ||
      hasTopicAnchor ||
      activeInformationAnchor ||
      ['product_family', 'product_topic', 'product_variant', 'business_fact'].includes(
        String(topicType || ''),
      )
    )
  const quoteBusinessFactSideQuestion =
    String(lane || '') === 'quote' &&
    (factualFaq || String(topicType || '') === 'business_fact')
  const confirmationOnlyFollowUp =
    turnInterpretation?.followUp?.confirmationOnly === true
  const quoteConfirmationFollowUp =
    turnInterpretation?.followUp?.quoteConfirmation === true
  const nonFactualSideQuestionTurn =
    nonFactualSideQuestionResponseContracts.has(String(responseContract || '')) &&
    !factualFaq &&
    String(topicType || '') !== 'business_fact' &&
    !anchoredVariantFaq &&
    !anchoredInformationTurn &&
    !policyBackedQuoteOrSupportPaymentFaq &&
    !policyBackedInstallationCondition
  const quoteInformationalResponseNeedsKnowledge =
    String(responseContract || '') === 'inform_then_guide_quote' &&
    (factualFaq ||
      String(topicType || '') === 'business_fact' ||
      anchoredVariantFaq ||
      anchoredQuoteInformationTurn ||
      anchoredInformationTurn ||
      looksLikeCommercialConditionQuestion(currentTurnText))

  if (!(role === 'customer_public' || role === 'customer_authenticated')) {
    return {
      responseContract,
      knowledgeNeed: 'optional',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'non_customer_role',
    }
  }

  if (policyBackedInstallationCondition) {
    return {
      responseContract,
      knowledgeNeed: 'none',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'policy_backed_installation_rule',
    }
  }

  if (policyBackedQuoteOrSupportPaymentFaq) {
    return {
      responseContract,
      knowledgeNeed: 'none',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'policy_backed_payment_terms',
    }
  }

  if (policyBackedBusinessFactFaq) {
    return {
      responseContract,
      knowledgeNeed: 'none',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'policy_backed_business_fact',
    }
  }

  if (confirmationOnlyFollowUp && !factualFaq && String(topicType || '') !== 'business_fact') {
    return {
      responseContract,
      knowledgeNeed: 'none',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'confirmation_only_followup',
    }
  }

  if (quoteConfirmationFollowUp) {
    return {
      responseContract,
      knowledgeNeed: 'none',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'quote_followup_acknowledgement',
    }
  }

  if (anchoredQuoteSideQuestion) {
    return {
      responseContract,
      knowledgeNeed: hasActiveFactualAnchor ? 'required' : 'optional',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'anchored_quote_side_question',
    }
  }

  if (retrievalFreeResponseContracts.has(String(responseContract || ''))) {
    return {
      responseContract,
      knowledgeNeed: 'none',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'response_contract_blocks_retrieval',
    }
  }

  if (nonFactualSideQuestionTurn) {
    return {
      responseContract,
      knowledgeNeed: 'none',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'non_factual_side_question_blocks_retrieval',
    }
  }

  if (
    String(responseContract || '') === 'ask_clarification' &&
    !anchoredVariantFaq &&
    !anchoredProductInformationTurn
  ) {
    return {
      responseContract,
      knowledgeNeed: 'none',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'clarification_contract_blocks_retrieval',
    }
  }

  if (
    guidedContinuationTurn &&
    !quoteBusinessFactSideQuestion &&
    !anchoredVariantFaq &&
    !anchoredProductInformationTurn &&
    !policyBackedQuoteOrSupportPaymentFaq
  ) {
    return {
      responseContract,
      knowledgeNeed: 'none',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'guided_continuation_blocks_retrieval',
    }
  }

  if (
    String(responseContract || '') === 'inform_then_guide_quote' &&
    String(lane || '') === 'quote' &&
    !quoteInformationalResponseNeedsKnowledge
  ) {
    return {
      responseContract,
      knowledgeNeed: 'none',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'quote_information_contract_without_fact_anchor',
    }
  }

  if (strictKnowledgeRequired) {
    return {
      responseContract,
      knowledgeNeed: 'required',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'strict_knowledge_intent',
    }
  }

  if (factualFaq) {
    return {
      responseContract,
      knowledgeNeed: 'required',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'factual_faq',
    }
  }

  if (anchoredVariantFaq) {
    return {
      responseContract,
      knowledgeNeed: 'required',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'anchored_variant_faq',
    }
  }

  if (anchoredInformationTurn) {
    return {
      responseContract,
      knowledgeNeed: 'required',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'anchored_information_turn',
    }
  }

  if (anchoredQuoteInformationTurn) {
    return {
      responseContract,
      knowledgeNeed: 'required',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'anchored_quote_information_turn',
    }
  }

  if (requiredRetrievalResponseContracts.has(String(responseContract || ''))) {
    return {
      responseContract,
      knowledgeNeed: hasTopicAnchor || factualFaq ? 'required' : 'none',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason:
        hasTopicAnchor || factualFaq
          ? 'response_contract_requires_knowledge'
          : 'missing_topic_anchor',
    }
  }

  if (['support', 'schedule', 'general'].includes(String(lane || ''))) {
    return {
      responseContract,
      knowledgeNeed: 'none',
      lane,
      sideQuestionSubtype,
      hasTopicAnchor,
      reason: 'non_knowledge_lane',
    }
  }

  return {
    responseContract,
    knowledgeNeed: hasTopicAnchor ? 'optional' : 'none',
    lane,
    sideQuestionSubtype,
    hasTopicAnchor,
    reason: hasTopicAnchor ? 'optional_anchor_present' : 'no_expected_knowledge_use',
  }
}

export const shouldSkipKnowledgeRetrieval = (knowledgeDecision = null) =>
  knowledgeDecision?.knowledgeNeed === 'none'

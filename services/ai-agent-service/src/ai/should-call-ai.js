const CUSTOMER_PROVIDER_AVOIDABLE_CATEGORIES = new Set([
  'greeting',
  'courtesy',
  'confirmation',
  'cancellation',
  'generic_help_request',
  'clarification_request',
  'incomplete',
  'noise',
  'unintelligible',
  'contact',
  'price_inquiry',
  'support_request',
  'schedule_request',
  'auth_required',
  'owned_document_request',
  'private_account_data',
  'multi_intent',
  'frustration',
  'sensitive',
  'repetition',
  'out_of_scope',
])

export const shouldCallAI = ({
  role,
  intentKey,
  inboundClassification = null,
  deterministicResponse = null,
}) => {
  if (deterministicResponse) {
    return {
      shouldCall: false,
      reason: 'deterministic_response',
    }
  }

  if (
    String(role || '').startsWith('customer_') &&
    CUSTOMER_PROVIDER_AVOIDABLE_CATEGORIES.has(inboundClassification?.category)
  ) {
    return {
      shouldCall: false,
      reason: `classified:${inboundClassification.category}`,
    }
  }

  return {
    shouldCall: true,
    reason: 'llm_value_add',
  }
}

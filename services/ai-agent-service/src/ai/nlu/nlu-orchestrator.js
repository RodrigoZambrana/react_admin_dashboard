import { findTenantTopicMatches } from '../intents/customer-topic-taxonomy.js'
import { detectCustomerBaseIntentWithNlp } from './nlpjs-intent-service.js'
import { recognizeCustomerEntities } from './recognizers-service.js'

const CUSTOMER_ROLES = new Set(['customer_public', 'customer_authenticated'])

export const orchestrateCustomerNlu = async ({
  role,
  input,
  tenantTopicTaxonomy = [],
  inboundClassification = null,
}) => {
  if (!CUSTOMER_ROLES.has(String(role || ''))) {
    return null
  }

  const effectiveInput = String(input || '')
  const entities = recognizeCustomerEntities(effectiveInput)
  const topicMatches = findTenantTopicMatches(effectiveInput, tenantTopicTaxonomy, {
    kinds: ['product_family', 'product_topic', 'product_variant'],
    limit: 10,
  })
  const shouldRunNlp =
    !inboundClassification?.suggestedIntent ||
    ['other', 'actionable_intent', 'faq_topic', 'generic_help_request'].includes(
      String(inboundClassification?.category || ''),
    )
  const nlp = shouldRunNlp
    ? await detectCustomerBaseIntentWithNlp(effectiveInput)
    : {
        intent: null,
        confidence: 0,
        alternatives: [],
        source: 'nlpjs_skipped',
      }

  return {
    entities,
    topicMatches,
    nlpIntent: nlp.intent,
    nlpConfidence: nlp.confidence,
    nlpAlternatives: nlp.alternatives,
    source: nlp.source,
  }
}

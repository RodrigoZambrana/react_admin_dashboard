import { resolveCustomerResponseContract } from './response-resolver.js'
import { resolveKnowledgeNeedDecision } from '../retrieval/retrieval-gate.js'

export const resolveTurnKnowledgeControl = ({
  role,
  intentKey,
  turnInterpretation,
  tenantRuntimePolicy = null,
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
  const responseContract = resolveCustomerResponseContract({
    role,
    intentKey,
    turnInterpretation,
    tenantRuntimePolicy,
    intentRequiresStrictKnowledge,
    hasActiveKnowledgeTopicAnchor,
    hasActiveFactualKnowledgeAnchor,
    factualFaqSubtypes,
  })

  const knowledgeDecision = resolveKnowledgeNeedDecision({
    role,
    intentKey,
    turnInterpretation,
    tenantRuntimePolicy,
    responseContract,
    intentRequiresStrictKnowledge,
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
  })

  return {
    responseContract,
    knowledgeDecision,
  }
}

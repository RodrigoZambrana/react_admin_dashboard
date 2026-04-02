import { buildResolutionReadiness } from './resolution-readiness.js'
import { buildConversationState } from './conversation-state.js'
import {
  buildCanonicalIntermediateContract,
  buildCanonicalResponseDirectives,
} from './canonical-intermediate-contract.js'

export const shouldWaitForMoreInput = (conversationState = {}) =>
  buildResolutionReadiness(conversationState).waitForMore

export const buildConversationContext = (input = {}) => {
  const readiness = buildResolutionReadiness(input)
  const conversationState = buildConversationState({
    previousConversationState: input?.previousConversationContext?.conversationState || null,
    tenantRuntimePolicy: input?.tenantRuntimePolicy || null,
    readiness,
    intentKey: input?.intentDetection?.intent || null,
    intentConfidence: input?.intentDetection?.confidence || null,
    topic: input?.topic || null,
    contextTopic: input?.contextTopic || null,
    quoteContext: input?.quoteContext || null,
    supportContext: input?.supportContext || null,
    scheduleContext: input?.scheduleContext || null,
    currentTurnText: input?.currentTurnText || '',
    previousAgentText: '',
  })
  const canonicalIntermediateContract = buildCanonicalIntermediateContract({
    currentTurnText: input?.rawCurrentTurnText || input?.currentTurnText || '',
    previousConversationContext: input?.previousConversationContext || null,
    resolutionReadiness: readiness,
    conversationState,
    quoteContext: input?.quoteContext || null,
    supportContext: input?.supportContext || null,
    scheduleContext: input?.scheduleContext || null,
    tenantTopicTaxonomy: Array.isArray(input?.tenantTopicTaxonomy)
      ? input.tenantTopicTaxonomy
      : [],
  })
  const canonicalResponseDirectives =
    buildCanonicalResponseDirectives(canonicalIntermediateContract)

  return {
    mode: readiness.mode,
    activeDomain: readiness.lane,
    responseStrategy: readiness.answerMode,
    nextUsefulField: readiness.nextUsefulField,
    waitForMore: readiness.waitForMore,
    waitForMoreReasons: readiness.waitForMoreReasons,
    topicLabel: typeof input?.topic?.label === 'string' ? input.topic.label : null,
    userGoal: readiness.userGoal,
    confidence: readiness.confidence,
    followUpDetected: readiness.followUpDetected,
    quoteStage: readiness.quoteStage,
    quoteActionReady: readiness.quoteActionReady,
    quoteInformationFirst: readiness.quoteInformationFirst,
    threadKey: readiness.threadKey,
    parentThreadKey:
      typeof readiness.parentThreadKey === 'string' ? readiness.parentThreadKey : null,
    resumePointer:
      typeof readiness.resumePointer === 'string' ? readiness.resumePointer : null,
    knownFacts: readiness.knownFacts,
    nluSource: readiness.nluSource,
    resolutionReadiness: readiness,
    conversationState,
    canonicalIntermediateContract,
    canonicalResponseDirectives,
  }
}

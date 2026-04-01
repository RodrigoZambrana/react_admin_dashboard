import { hasCatalogVocabularySignal } from '../tenant-policy/runtime-tenant-policy.js'

export const reconcileResponseGroundingAudit = ({
  response,
  retrievalContext,
  interpretation = null,
  tenantRuntimePolicy = null,
  compactText,
  normalizeGroundingFactList,
  extractMeaningfulTokens,
  extractTopicTokens,
  responseMentionsCanonicalTopic,
} = {}) => {
  if (!response || typeof response !== 'object') {
    return response
  }

  const responseText = compactText(response?.finalUserText || response?.text || '')
  const retrievalItems = Array.isArray(retrievalContext?.items)
    ? retrievalContext.items.filter((item) => item && typeof item === 'object').slice(0, 4)
    : []
  const explicitGrounding =
    response?.grounding && typeof response.grounding === 'object' ? response.grounding : {}
  const usedFacts = normalizeGroundingFactList(explicitGrounding.usedFacts)
  const explicitGrounded =
    (explicitGrounding.knowledgeGrounded === true || explicitGrounding.grounded === true) &&
    usedFacts.length > 0
  const explicitUsed =
    (explicitGrounding.knowledgeUsed === true || explicitGrounding.used === true) &&
    usedFacts.length > 0

  if (!responseText) {
    return {
      ...response,
      grounding: {
        ...explicitGrounding,
        grounded: false,
        used: false,
        knowledgeUsed: false,
        knowledgeGrounded: false,
      },
    }
  }

  if (!retrievalItems.length) {
    return {
      ...response,
      grounding: {
        ...explicitGrounding,
        grounded: explicitGrounded,
        used: explicitUsed || explicitGrounded,
        knowledgeUsed: explicitUsed || explicitGrounded,
        knowledgeGrounded: explicitGrounded,
        evidenceTokens: [],
        groundedByEvidence: false,
      },
    }
  }

  const responseTokens = extractMeaningfulTokens(responseText)
  const evidenceTokens = Array.from(
    new Set(
      retrievalItems.flatMap((item) =>
        [item?.title, item?.summary, item?.snippet].flatMap((entry) =>
          extractMeaningfulTokens(entry),
        ),
      ),
    ),
  )
  const overlappingEvidenceTokens = responseTokens.filter((token) =>
    evidenceTokens.includes(token),
  )
  const topicCandidates = [
    interpretation?.topic,
    interpretation?.contextTopic,
    interpretation?.quoteContext?.topicLabel
      ? {
          label: interpretation.quoteContext.topicLabel,
          tokens: extractTopicTokens(interpretation.quoteContext.topicLabel),
        }
      : null,
    interpretation?.quoteContext?.familyLabel
      ? {
          label: interpretation.quoteContext.familyLabel,
          tokens: extractTopicTokens(interpretation.quoteContext.familyLabel),
        }
      : null,
  ].filter(Boolean)
  const mentionsKnownTopic = topicCandidates.some((topic) =>
    responseMentionsCanonicalTopic(responseText, topic),
  )
  const hasCatalogSignal = hasCatalogVocabularySignal(responseText, tenantRuntimePolicy)
  const groundedByEvidence =
    overlappingEvidenceTokens.length >= 2 ||
    (mentionsKnownTopic && overlappingEvidenceTokens.length >= 1) ||
    (mentionsKnownTopic && hasCatalogSignal)

  return {
    ...response,
    grounding: {
      ...explicitGrounding,
      grounded: explicitGrounded,
      used: explicitUsed || explicitGrounded,
      knowledgeUsed: explicitUsed || explicitGrounded,
      knowledgeGrounded: explicitGrounded,
      evidenceTokens: overlappingEvidenceTokens.slice(0, 8),
      groundedByEvidence,
      mentionsKnownTopic,
      hasCatalogSignal,
    },
  }
}

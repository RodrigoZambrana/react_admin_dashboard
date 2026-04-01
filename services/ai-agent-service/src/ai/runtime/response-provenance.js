const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeStringList = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .filter((entry) => typeof entry === 'string')
        .map((entry) => compactText(entry))
        .filter(Boolean),
    ),
  )

const normalizeGroundingFacts = (values = []) =>
  normalizeStringList(values).map((entry) => entry.slice(0, 160))

const normalizeGroundingSourceIds = (values = []) =>
  normalizeStringList(values).map((entry) => entry.slice(0, 120))

const inferResponseOrigin = ({
  response = null,
  responseMode = null,
  aiExchange = null,
  providerGenerationAttempted = false,
} = {}) => {
  const rewriteApplied = response?.grounding?.rewriteApplied === true

  if (rewriteApplied && responseMode === 'hybrid') {
    return 'hybrid_grounded_rewrite'
  }

  if (responseMode === 'hybrid') {
    return 'hybrid'
  }

  if (rewriteApplied) {
    return response?.grounding?.grounded === true
      ? 'grounded_rewrite'
      : 'rewritten_response'
  }

  if (aiExchange && providerGenerationAttempted) {
    return response?.grounding?.grounded === true
      ? 'provider_grounded'
      : 'provider_generate'
  }

  if (providerGenerationAttempted) {
    return 'provider_attempt_fallback'
  }

  return response?.grounding?.grounded === true
    ? 'deterministic_grounded'
    : 'deterministic'
}

const buildGroundingState = ({ response = null, retrievalContext = null } = {}) => {
  const grounding =
    response?.grounding && typeof response.grounding === 'object'
      ? response.grounding
      : {}
  const retrievalItems = Array.isArray(retrievalContext?.items)
    ? retrievalContext.items
    : []

  const grounded = grounding.grounded === true
  const knowledgeRetrieved =
    typeof grounding.knowledgeRetrieved === 'boolean'
      ? grounding.knowledgeRetrieved
      : retrievalItems.length > 0
  const knowledgeUsed =
    typeof grounding.knowledgeUsed === 'boolean'
      ? grounding.knowledgeUsed
      : grounding.used === true || grounded
  const sourceCount = Array.isArray(grounding.sources)
    ? grounding.sources.filter((entry) => entry && typeof entry === 'object').length
    : retrievalItems.length

  return {
    grounded,
    knowledgeRetrieved,
    knowledgeUsed,
    sourceCount,
    usedFacts: normalizeGroundingFacts(grounding.usedFacts),
    usedSourceIds: normalizeGroundingSourceIds(grounding.usedSourceIds),
    fallbackReason:
      typeof grounding.fallbackReason === 'string'
        ? grounding.fallbackReason
        : null,
    fallbackSubtype:
      typeof grounding.fallbackSubtype === 'string'
        ? grounding.fallbackSubtype
        : null,
    rewriteApplied: grounding.rewriteApplied === true,
    rewriteMode:
      typeof grounding.rewriteMode === 'string' ? grounding.rewriteMode : null,
  }
}

const buildTenantValidationState = ({
  tenantRuntimePolicy = null,
  retrievalContext = null,
} = {}) => ({
  tenantKey:
    typeof tenantRuntimePolicy?.tenantKey === 'string'
      ? tenantRuntimePolicy.tenantKey
      : null,
  policyApplied: Boolean(tenantRuntimePolicy),
  catalogTopicCount: Array.isArray(tenantRuntimePolicy?.catalog)
    ? tenantRuntimePolicy.catalog.length
    : 0,
  quoteProfileCount: Array.isArray(tenantRuntimePolicy?.quoteProfiles)
    ? tenantRuntimePolicy.quoteProfiles.length
    : 0,
  catalogTermCount: Array.isArray(tenantRuntimePolicy?.vocabulary?.catalogTerms)
    ? tenantRuntimePolicy.vocabulary.catalogTerms.length
    : 0,
  knowledgeMode:
    typeof retrievalContext?.knowledgeMode === 'string'
      ? retrievalContext.knowledgeMode
      : null,
})

const sanitizeLoopIntervention = (value = null) => {
  const intervention = value && typeof value === 'object' ? value : {}

  return {
    applied: intervention.applied === true,
    strategy:
      typeof intervention.strategy === 'string' ? intervention.strategy : null,
    reason: typeof intervention.reason === 'string' ? intervention.reason : null,
    lane: typeof intervention.lane === 'string' ? intervention.lane : null,
    requestedField:
      typeof intervention.requestedField === 'string'
        ? intervention.requestedField
        : null,
    requestedFieldResolved: intervention.requestedFieldResolved === true,
    repeatedResponse: intervention.repeatedResponse === true,
    semanticOverlapLoop: intervention.semanticOverlapLoop === true,
    semanticOverlapScore:
      typeof intervention.semanticOverlapScore === 'number'
        ? intervention.semanticOverlapScore
        : 0,
  }
}

export const buildResponseRuntimeContract = ({
  intentKey = null,
  answerMode = null,
  response = null,
  retrievalContext = null,
  responseMode = null,
  aiExchange = null,
  providerGenerationAttempted = false,
  tenantRuntimePolicy = null,
  loopIntervention = null,
  finalizationStage = 'response_built',
} = {}) => {
  const groundingState = buildGroundingState({ response, retrievalContext })
  const responseContract =
    typeof retrievalContext?.responseContract === 'string'
      ? retrievalContext.responseContract
      : null
  const knowledgeNeed =
    typeof retrievalContext?.knowledgeNeed === 'string'
      ? retrievalContext.knowledgeNeed
      : null

  return {
    intentKey:
      typeof intentKey === 'string' && compactText(intentKey)
        ? compactText(intentKey)
        : null,
    answerMode:
      typeof answerMode === 'string' && compactText(answerMode)
        ? compactText(answerMode)
        : null,
    responseContract,
    provenance: {
      responseMode:
        typeof responseMode === 'string' ? compactText(responseMode) : null,
      responseOrigin: inferResponseOrigin({
        response,
        responseMode,
        aiExchange,
        providerGenerationAttempted,
      }),
      providerGenerationAttempted: Boolean(providerGenerationAttempted),
      aiGenerationUsed: Boolean(aiExchange && typeof aiExchange === 'object'),
      rewriteApplied: groundingState.rewriteApplied,
      rewriteMode: groundingState.rewriteMode,
      knowledgeMode:
        typeof retrievalContext?.knowledgeMode === 'string'
          ? retrievalContext.knowledgeMode
          : 'full',
      knowledgeNeed,
      retrievalQuery: compactText(retrievalContext?.retrievalQuery || '').slice(0, 240),
      retrievalSourceCount: Array.isArray(retrievalContext?.items)
        ? retrievalContext.items.length
        : groundingState.sourceCount,
    },
    groundingState,
    rewriteEligible:
      groundingState.grounded &&
      !groundingState.fallbackReason &&
      response?.needsHuman !== true,
    loopIntervention: sanitizeLoopIntervention(loopIntervention),
    tenantValidation: buildTenantValidationState({
      tenantRuntimePolicy,
      retrievalContext,
    }),
    finalizationStage:
      typeof finalizationStage === 'string' && compactText(finalizationStage)
        ? compactText(finalizationStage)
        : 'response_built',
  }
}

export const reconcileResponseProvenance = ({
  response,
  retrievalContext,
  interpretation = null,
  tenantRuntimePolicy = null,
  intentKey = null,
  answerMode = null,
  responseMode = null,
  aiExchange = null,
  providerGenerationAttempted = false,
  dependencies = {},
} = {}) => {
  const reconciledResponse = dependencies.reconcileResponseGroundingAudit({
    response,
    retrievalContext,
    interpretation,
    tenantRuntimePolicy,
    compactText: dependencies.compactText,
    normalizeGroundingFactList: dependencies.normalizeGroundingFactList,
    extractMeaningfulTokens: dependencies.extractMeaningfulTokens,
    extractTopicTokens: dependencies.extractTopicTokens,
    responseMentionsCanonicalTopic: dependencies.responseMentionsCanonicalTopic,
  })

  return {
    response: reconciledResponse,
    responseRuntime: buildResponseRuntimeContract({
      intentKey,
      answerMode,
      response: reconciledResponse,
      retrievalContext,
      responseMode,
      aiExchange,
      providerGenerationAttempted,
      tenantRuntimePolicy,
      finalizationStage: 'grounding_reconciled',
    }),
  }
}

export const finalizeResponseRuntimeContract = ({
  responseRuntime = null,
  response = null,
  retrievalContext = null,
  loopIntervention = null,
  finalizationStage = 'response_finalized',
} = {}) => {
  const nextGroundingState = buildGroundingState({ response, retrievalContext })
  const baseContract =
    responseRuntime && typeof responseRuntime === 'object'
      ? responseRuntime
      : buildResponseRuntimeContract({
          response,
          retrievalContext,
          loopIntervention,
          finalizationStage,
        })

  return {
    ...baseContract,
    groundingState: nextGroundingState,
    rewriteEligible:
      nextGroundingState.grounded &&
      !nextGroundingState.fallbackReason &&
      response?.needsHuman !== true,
    loopIntervention: sanitizeLoopIntervention(loopIntervention),
    finalizationStage:
      typeof finalizationStage === 'string' && compactText(finalizationStage)
        ? compactText(finalizationStage)
        : 'response_finalized',
  }
}

export const sanitizeResponseRuntimeContract = (value = null) => {
  if (!value || typeof value !== 'object') {
    return null
  }

  return {
    intentKey: typeof value.intentKey === 'string' ? value.intentKey : null,
    answerMode: typeof value.answerMode === 'string' ? value.answerMode : null,
    responseContract:
      typeof value.responseContract === 'string' ? value.responseContract : null,
    provenance:
      value.provenance && typeof value.provenance === 'object'
        ? {
            responseMode:
              typeof value.provenance.responseMode === 'string'
                ? value.provenance.responseMode
                : null,
            responseOrigin:
              typeof value.provenance.responseOrigin === 'string'
                ? value.provenance.responseOrigin
                : null,
            providerGenerationAttempted: Boolean(
              value.provenance.providerGenerationAttempted,
            ),
            aiGenerationUsed: Boolean(value.provenance.aiGenerationUsed),
            rewriteApplied: Boolean(value.provenance.rewriteApplied),
            rewriteMode:
              typeof value.provenance.rewriteMode === 'string'
                ? value.provenance.rewriteMode
                : null,
            knowledgeMode:
              typeof value.provenance.knowledgeMode === 'string'
                ? value.provenance.knowledgeMode
                : null,
            knowledgeNeed:
              typeof value.provenance.knowledgeNeed === 'string'
                ? value.provenance.knowledgeNeed
                : null,
            retrievalQuery: compactText(value.provenance.retrievalQuery || '').slice(0, 240),
            retrievalSourceCount:
              typeof value.provenance.retrievalSourceCount === 'number'
                ? value.provenance.retrievalSourceCount
                : 0,
          }
        : null,
    groundingState:
      value.groundingState && typeof value.groundingState === 'object'
        ? {
            grounded: Boolean(value.groundingState.grounded),
            knowledgeRetrieved: Boolean(value.groundingState.knowledgeRetrieved),
            knowledgeUsed: Boolean(value.groundingState.knowledgeUsed),
            sourceCount:
              typeof value.groundingState.sourceCount === 'number'
                ? value.groundingState.sourceCount
                : 0,
            usedFacts: normalizeGroundingFacts(value.groundingState.usedFacts).slice(0, 4),
            usedSourceIds: normalizeGroundingSourceIds(
              value.groundingState.usedSourceIds,
            ).slice(0, 6),
            fallbackReason:
              typeof value.groundingState.fallbackReason === 'string'
                ? value.groundingState.fallbackReason
                : null,
            fallbackSubtype:
              typeof value.groundingState.fallbackSubtype === 'string'
                ? value.groundingState.fallbackSubtype
                : null,
            rewriteApplied: Boolean(value.groundingState.rewriteApplied),
            rewriteMode:
              typeof value.groundingState.rewriteMode === 'string'
                ? value.groundingState.rewriteMode
                : null,
          }
        : null,
    rewriteEligible: Boolean(value.rewriteEligible),
    loopIntervention: sanitizeLoopIntervention(value.loopIntervention),
    tenantValidation:
      value.tenantValidation && typeof value.tenantValidation === 'object'
        ? {
            tenantKey:
              typeof value.tenantValidation.tenantKey === 'string'
                ? value.tenantValidation.tenantKey
                : null,
            policyApplied: Boolean(value.tenantValidation.policyApplied),
            catalogTopicCount:
              typeof value.tenantValidation.catalogTopicCount === 'number'
                ? value.tenantValidation.catalogTopicCount
                : 0,
            quoteProfileCount:
              typeof value.tenantValidation.quoteProfileCount === 'number'
                ? value.tenantValidation.quoteProfileCount
                : 0,
            catalogTermCount:
              typeof value.tenantValidation.catalogTermCount === 'number'
                ? value.tenantValidation.catalogTermCount
                : 0,
            knowledgeMode:
              typeof value.tenantValidation.knowledgeMode === 'string'
                ? value.tenantValidation.knowledgeMode
                : null,
          }
        : null,
    finalizationStage:
      typeof value.finalizationStage === 'string'
        ? value.finalizationStage
        : null,
  }
}

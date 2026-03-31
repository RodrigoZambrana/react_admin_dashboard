import { buildSystemPrompt } from './prompt/system-prompt.js'
import { createModelProvider } from './model/provider-factory.js'
import {
  getProviderCallTrace,
  hasProviderCallTrace,
  runWithProviderCallTrace,
} from './model/provider-call-trace.js'
import { getToolsForRole } from './tools/tool-registry.js'
import { z } from 'zod'
import {
  analyzeRoleResolution,
  canRoleExecuteIntent,
  canRoleUseTool,
  getRoleCatalog,
  getRoleConfig,
  normalizeRole,
  resolveRole,
  roleRequiresConfirmation,
  roleToScope,
} from './roles/role-runtime.js'
import { sanitizeUserInput } from './security/sanitize-input.js'
import {
  isSystemNoiseMessage,
  SYSTEM_NOISE_IGNORE_REASON,
} from './ingress/system-noise.js'
import { interpretMessageElements } from './message-elements/interpret-message-elements.js'
import { buildMessageContext } from './message-elements/build-message-context.js'
import { analyzeMessage } from './nlp/analyze-message.js'
import { classifyConversationMode } from './classification/classify-conversation-mode.js'
import { assistNextStep } from './orchestrator/assist-next-step.js'
import { decideNextStep } from './orchestrator/decide-next-step.js'
import { handleConversationalMode } from './conversation/handle-conversational-mode.js'
import {
  normalizeOperationalContextsWithConversationState,
  readInterpretationResolutionReadiness,
  stabilizeReadinessWithConversationState,
} from './conversation/resolution-readiness.js'
import { resolveCustomerResponseContract } from './conversation/response-resolver.js'
import { resolveTurnKnowledgeControl } from './conversation/turn-controller.js'
import {
  buildConversationState,
  filterResolvedConversationFields,
  isConversationFieldResolved,
  mapConversationFieldToSlot,
  resolveNextConversationField,
} from './conversation/conversation-state.js'
import { generateResponse } from './nlp/generate-response.js'
import { validateResponseGuardrails } from './guardrails/validate-response.js'
import { detectIntent } from './intents/detect-intent.js'
import { classifyInboundMessage } from './intents/classify-inbound-message.js'
import { classifyCustomerProtectedDataRequest } from './intents/customer-protected-data.js'
import {
  detectCustomerFaqSubtype,
  extractRequestedTopicLabel,
} from './intents/customer-faq-heuristics.js'
import { buildTurnInterpretation } from './intents/turn-interpretation.js'
import { resolveCustomerQuoteResolution } from './intents/customer-quote-resolution.js'
import {
  capabilityModeBlocksAutomaticResolution,
  capabilityModeBlocksProviderEnhancements,
  getCustomerCapabilityForIntent,
  getCustomerCapabilityMode,
  resolveCustomerCapabilityRuntime,
} from './capabilities/customer-capability-runtime.js'
import {
  buildTenantBusinessFactFaqResponse,
  buildContextualProductReference,
  buildCustomerFaqKnowledgeResponse,
  buildGenericCustomerKnowledgeFallbackText,
  buildQuoteProgressHint,
  extractKnowledgeFallbackStatements,
  resolveOperationalPaymentMethodsInline,
  selectCustomerFaqEvidence,
} from './intents/customer-faq-response.js'
import {
  getBusinessFacts,
  findBestPolicyTopicMatch,
  getBusinessRules,
  getProductCatalog,
  getQuoteRequirements,
  getVocabulary,
  hasCatalogVocabularySignal,
  matchesBusinessRuleValue,
} from './tenant-policy/runtime-tenant-policy.js'
import { buildTenantPolicyEnvelope } from './tenant-policy/tenant-router.js'
import {
  formatStructuredCatalogInsertItem,
  formatStructuredCatalogPendingItem,
  resolveStructuredCatalogSuccessLabel,
  STRUCTURED_CATALOG_INSERT_TOOL,
  STRUCTURED_CATALOG_PARSE_INTENT,
  STRUCTURED_CATALOG_PARSE_TOOL,
  STRUCTURED_CATALOG_PREPARE_QUOTE_INTENT,
  STRUCTURED_CATALOG_QUOTE_TOOL,
  STRUCTURED_CATALOG_REGISTER_INTENT,
  hasStructuredCatalogSignal,
  isStructuredCatalogActionKey,
  isStructuredCatalogToolName,
} from './structured-catalog-runtime.js'
import {
  looksLikeCommercialConditionQuestion,
  looksLikeConfiguredProductInterest,
  looksLikeGenericPriceInquiry,
  looksLikeInformationExpansionRequest,
  looksLikeInstalledReplacementAssessmentRequest,
  looksLikeLightFilterPreferenceRequest,
  looksLikeMaterialFollowUpRequest,
  looksLikePaymentOperationalUpdate,
  looksLikePaymentProofArtifact,
  looksLikePaymentProofFollowUpRequest,
  looksLikeQuoteRequirementsQuestion,
  looksLikeQuoteWaitingFollowUp,
} from './intents/customer-intent-patterns.js'
import { normalizeCustomerTextForIntent } from './intents/customer-text-normalizer.js'
import {
  detectStandaloneAttachmentArtifactKind,
  hasMultimodalPlannedArtifactSignal,
  hasMultimodalReferenceSignal,
  hasReengagementReferenceSignal,
} from './intents/customer-semantic-signals.js'
import {
  buildCustomerScheduleAppointmentPayload,
  buildCustomerScheduleCancellationText,
  buildCustomerScheduleConfirmationClarifyText,
  buildCustomerScheduleSearchWindow,
  findCustomerScheduleOverlap,
} from './intents/customer-schedule-resolution.js'
import {
  formatChatMoney,
  inferChatLocaleFromText,
  localePrefersEnglish,
  normalizeChatLocale,
} from './locale-format.js'
import { orchestrateCustomerNlu } from './nlu/nlu-orchestrator.js'
import { shouldCallAI } from './should-call-ai.js'
import {
  executeRegisteredActionStep,
  getActionDefinition,
  getActionExecutionDefinition,
} from './actions/action-registry.js'
import { AGENT_STATE_EVENTS } from './state/state-types.js'
import { applyAgentStateEvents } from './state/transition-state.js'
import {
  buildCustomerAvailabilityFallbackText,
  buildCustomerSupportRequestText,
  buildCustomerCapabilityHandoffText,
  buildCustomerInformationThenHandoffText,
  buildCustomerLightFilterGuidanceText,
  buildCustomerMaterialFollowUpText,
  buildCustomerMultimodalQuoteArtifactPlannedText,
  buildCustomerMultimodalQuoteArtifactText,
  buildCustomerMultimodalGenericArtifactPlannedText,
  buildCustomerMultimodalGenericArtifactText,
  buildCustomerMultimodalSupportArtifactPlannedText,
  buildCustomerMultimodalSupportArtifactText,
  buildCustomerQuoteHandoffText,
  buildCustomerQuoteRequestText,
  buildCustomerQuoteWaitingFollowUpText,
  buildCustomerQuoteResolutionText,
  buildCustomerReengagementFollowUpText,
  buildCustomerReengagementNeutralText,
  buildCustomerScheduleCreatedText,
  buildCustomerScheduleUnavailableText,
  renderCustomerDeterministicText,
  renderExecutionOutcome,
  renderLightConversationText,
  renderOperationDraftOutcome,
  renderOutcomeText,
} from './outcomes/render-outcome.js'
import {
  getWordingTemplateMeta,
  pickWordingVariant,
  resolveWordingChannelProfile,
} from './outcomes/wording-registry.js'
import { collectCustomerHybridIntentHints } from './intents/hybrid-intent-registry.js'
import {
  resolveKnowledgeNeedDecision,
  shouldSkipKnowledgeRetrieval,
} from './retrieval/retrieval-gate.js'
import { reconcileResponseGroundingAudit } from './grounding/grounding-audit.js'

const STOP_TOKENS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
  'un',
  'una',
  'unos',
  'unas',
  'y',
  'o',
  'con',
  'sin',
  'para',
  'por',
  'que',
  'me',
  'mi',
  'tu',
  'su',
  'es',
  'en',
  'al',
  'lo',
  'se',
  'ya',
  'ahora',
  'necesito',
  'quiero',
  'hola',
  'buenas',
  'gracias',
])

const NON_REASONING_AUTHOR_KINDS = new Set(['business_auto', 'channel_system'])
const NON_REASONING_MESSAGE_KINDS = new Set([
  'business_auto_reply',
  'channel_system',
  'system_event',
])

const normalizeAuthorKind = (value) =>
  typeof value === 'string' && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null

const normalizeMessageKind = (value) =>
  typeof value === 'string' && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null

const resolveUnifiedAuthorKind = (unifiedMessage = {}, role = null) => {
  const metadata =
    unifiedMessage?.metadata && typeof unifiedMessage.metadata === 'object'
      ? unifiedMessage.metadata
      : {}
  const explicitAuthorKind = normalizeAuthorKind(
    unifiedMessage?.authorKind ?? metadata?.authorKind,
  )
  if (explicitAuthorKind) {
    return explicitAuthorKind
  }

  if (role && isAdminConversationalRole(role)) {
    return 'operator_human'
  }

  return 'customer_human'
}

const resolveUnifiedMessageKind = (unifiedMessage = {}, authorKind = 'customer_human') => {
  const metadata =
    unifiedMessage?.metadata && typeof unifiedMessage.metadata === 'object'
      ? unifiedMessage.metadata
      : {}
  const explicitMessageKind = normalizeMessageKind(
    unifiedMessage?.messageKind ?? metadata?.messageKind,
  )
  if (explicitMessageKind) {
    return explicitMessageKind
  }

  if (authorKind === 'channel_system') {
    return 'channel_system'
  }

  if (authorKind === 'business_auto') {
    return 'business_auto_reply'
  }

  if (!String(unifiedMessage?.text || '').trim()) {
    const attachments = Array.isArray(unifiedMessage?.attachments)
      ? unifiedMessage.attachments
      : []
    if (attachments.length > 0) {
      return 'attachment_only'
    }
  }

  return 'human_message'
}

const shouldIgnoreMessageForReasoning = ({ authorKind = null, messageKind = null }) =>
  NON_REASONING_AUTHOR_KINDS.has(normalizeAuthorKind(authorKind)) ||
  NON_REASONING_MESSAGE_KINDS.has(normalizeMessageKind(messageKind))

const isReasoningRelevantMemoryTurn = (turn) =>
  !shouldIgnoreMessageForReasoning({
    authorKind: turn?.metadata?.authorKind ?? null,
    messageKind: turn?.metadata?.messageKind ?? null,
  })

const filterReasoningRelevantTurns = (turns = []) =>
  (Array.isArray(turns) ? turns : []).filter((turn) => isReasoningRelevantMemoryTurn(turn))

const scopeForKnowledge = (scope) =>
  scope === 'customer_authenticated' ? 'customer_public' : scope

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeUniqueTerms = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .filter((entry) => typeof entry === 'string')
        .map((entry) => normalizeText(entry))
        .filter(Boolean),
    ),
  )

const getTenantCatalogTerms = (tenantRuntimePolicy = null) =>
  normalizeUniqueTerms(getVocabulary(tenantRuntimePolicy)?.catalogTerms ?? [])

const getTenantBrandTokens = (tenantRuntimePolicy = null) =>
  normalizeUniqueTerms(getVocabulary(tenantRuntimePolicy)?.brandTokens ?? [])

const hasTenantBrandSignal = (value, tenantRuntimePolicy = null) => {
  const normalizedInput = normalizeText(value)
  if (!normalizedInput) {
    return false
  }

  return getTenantBrandTokens(tenantRuntimePolicy).some((token) =>
    normalizedInput.includes(token),
  )
}

const hasTenantInstallationSignal = (value, tenantRuntimePolicy = null) =>
  matchesBusinessRuleValue(
    value,
    getBusinessRules(tenantRuntimePolicy)?.installationTerms ?? [],
  )

const subjectMatchesComparableFamily = (subject, tenantRuntimePolicy = null) => {
  const acceptedFamilies =
    getBusinessRules(tenantRuntimePolicy)?.lightFilterComparableFamilies ?? []
  if (!Array.isArray(acceptedFamilies) || acceptedFamilies.length === 0) {
    return false
  }

  if (matchesBusinessRuleValue(subject, acceptedFamilies)) {
    return true
  }

  const topicMatch = findBestPolicyTopicMatch(subject, tenantRuntimePolicy)
  const familyLabel =
    typeof topicMatch?.familyLabel === 'string' ? topicMatch.familyLabel : topicMatch?.label

  return matchesBusinessRuleValue(familyLabel, acceptedFamilies)
}

const NATURALITY_STOPWORDS = new Set([
  'de',
  'la',
  'el',
  'los',
  'las',
  'y',
  'o',
  'que',
  'a',
  'en',
  'un',
  'una',
  'para',
  'con',
  'por',
  'si',
  'lo',
  'te',
  'tu',
  'se',
  'me',
  'ya',
  'eso',
  'esta',
  'este',
  'queres',
  'querés',
  'necesitas',
  'necesitás',
  'puedo',
  'ayudo',
  'ayudarte',
])

const extractMeaningfulTokens = (value) =>
  Array.from(
    new Set(
      normalizeText(value)
        .split(/\s+/u)
        .filter((entry) => entry.length >= 4 && !NATURALITY_STOPWORDS.has(entry)),
    ),
  )

const scoreNaturality = ({
  responseText = '',
  previousAgentText = '',
  currentTurnText = '',
  followUpDetected = false,
  clarificationRequested = false,
  previousClarificationRequested = false,
}) => {
  const normalizedResponse = compactText(responseText)
  const normalizedPreviousAgent = compactText(previousAgentText)
  const normalizedCurrentTurn = compactText(currentTurnText)
  const penalties = []
  let score = 100

  if (!normalizedResponse) {
    penalties.push('empty_response')
    score -= 100
  }

  if (
    normalizedResponse &&
    normalizedPreviousAgent &&
    normalizeText(normalizedResponse) === normalizeText(normalizedPreviousAgent)
  ) {
    penalties.push('repeated_response')
    score -= 35
  }

  const responseTokens = extractMeaningfulTokens(normalizedResponse)
  const previousAgentTokens = extractMeaningfulTokens(normalizedPreviousAgent)
  const newTokens = responseTokens.filter((entry) => !previousAgentTokens.includes(entry))

  if (normalizedResponse && responseTokens.length > 0 && newTokens.length === 0) {
    penalties.push('no_new_information')
    score -= 20
  }

  if (followUpDetected && normalizedCurrentTurn) {
    const turnTokens = extractMeaningfulTokens(normalizedCurrentTurn)
    const intersectsTurnContext = turnTokens.some((entry) => responseTokens.includes(entry))
    if (!intersectsTurnContext && newTokens.length === 0) {
      penalties.push('follow_up_context_ignored')
      score -= 15
    }
  }

  if (clarificationRequested && previousClarificationRequested) {
    penalties.push('clarification_loop')
    score -= 20
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    penalties,
    addsNewInformation: newTokens.length > 0,
  }
}

const sanitizeCommercialConditionTopicLabel = (value) => {
  const clean = compactText(value)
  if (!clean) {
    return null
  }

  const normalized = normalizeText(clean)
  if (!normalized) {
    return null
  }

  if (/\b(instalacion|colocacion)\b/.test(normalized)) {
    return null
  }

  if (
    /^(incluye|incluido|incluida|agrega|agregado|agregada|contempla|contemplado|contemplada)\b/.test(
      normalized,
    )
  ) {
    return null
  }

  return clean
}

const resolveUnifiedLocale = (unifiedMessage = {}) => {
  const metadata =
    unifiedMessage?.metadata && typeof unifiedMessage.metadata === 'object'
      ? unifiedMessage.metadata
      : {}
  return normalizeChatLocale(
    unifiedMessage?.locale ||
      metadata?.locale ||
      inferChatLocaleFromText(unifiedMessage?.text, 'es-UY'),
  )
}

const resolveUnifiedCurrency = (unifiedMessage = {}) => {
  const metadata =
    unifiedMessage?.metadata && typeof unifiedMessage.metadata === 'object'
      ? unifiedMessage.metadata
      : {}
  const candidate = unifiedMessage?.currency || metadata?.currency || 'UYU'
  const normalized = String(candidate || '')
    .trim()
    .toUpperCase()
  return /^[A-Z]{3,5}$/.test(normalized) ? normalized : 'UYU'
}

const formatPublicMoney = (currency, amount, locale = 'es-UY') =>
  formatChatMoney(currency, amount, { locale })

const buildToolCallFingerprint = (entry) => {
  const target =
    entry?.arguments?.query ??
    entry?.arguments?.text ??
    entry?.arguments?.id ??
    entry?.target ??
    null
  return `${entry?.name || 'tool'}:${entry?.status || 'unknown'}:${String(target || '').trim().toLowerCase()}`
}

const dedupeToolCalls = (toolCalls = []) => {
  const uniqueEntries = new Map()
  for (const entry of Array.isArray(toolCalls) ? toolCalls : []) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const fingerprint = buildToolCallFingerprint(entry)
    if (!uniqueEntries.has(fingerprint)) {
      uniqueEntries.set(fingerprint, entry)
    }
  }
  return Array.from(uniqueEntries.values())
}

const extractTopicTokens = (text) =>
  Array.from(
    new Set(
      normalizeText(text)
        .split(' ')
        .filter((token) => token.length >= 3 && !STOP_TOKENS.has(token)),
    ),
  ).slice(0, 12)

const calculateTopicOverlap = (a = [], b = []) => {
  if (!a.length || !b.length) {
    return 0
  }

  const left = new Set(a)
  const right = new Set(b)
  let intersection = 0
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1
    }
  }
  return intersection / new Set([...left, ...right]).size
}

const explicitResetRequested = (text) =>
  /(nuevo caso|nuevo tema|otra consulta|otro tema|cambiando de tema|dejando eso|aparte|por otro lado)/i.test(
    String(text || ''),
  )

const looksLikeCustomerFollowUp = (text) =>
  /(ese mismo|esa misma|el mismo|la misma|mismo modelo|mismo item|misma configuracion|misma configuración|mismas caracteristicas|mismas características|ese modelo|ese item|ese producto|esa opcion|esa opción|puede venir|viene en|incluye|tambien|también)/i.test(
    String(text || ''),
  )

const looksLikeAttachmentReference = (text) =>
  /(adjunto|archivo|pdf|imagen|captura|audio|voz|excel|planilla|csv|xlsx|foto|comprobante)/i.test(
    String(text || ''),
  )

const looksLikeScheduleContinuationInput = (text) =>
  /\b(hoy|mañana|pasado mañana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|\d{1,2}\/\d{1,2}(?:\/\d{4})?|a las\s+\d{1,2}(?::\d{2})?|\d{1,2}:\d{2}|entre las|franja|temprano|temprana|despues de las|después de las|por la mañana|por la tarde|por la noche|direccion|dirección|ubicacion|ubicación|avenida|av\.|calle|ruta|telefono|teléfono|celular|whatsapp|mail|email|correo)\b/i.test(
    String(text || ''),
  ) ||
  /\b(a\s+que\s+hora|a\s+qué\s+hora)\b.*\b(pasan|pasar|podrian|podrían|pueden|venir)\b/i.test(
    String(text || ''),
  ) ||
  /\b(podrian|podrían|pueden)\s+(pasar|venir)\b/i.test(String(text || ''))

const looksLikeExplicitFaqQuestionInput = (text) => {
  const value = String(text || '').trim()
  if (!value) {
    return false
  }

  return (
    /[?¿]/.test(value) ||
    /\b(cual|cu[aá]l|como|cómo|donde|dónde|cuando|cuándo)\b/i.test(value) ||
    /\b(medios de pago|formas de pago|horario|horarios)\b/i.test(value) ||
    /\b(?:aceptan|manejan|trabajan con|tienen)\b.*\b(?:tarjeta|tarjetas|transferencia|efectivo|debito|d[eé]bito|credito|cr[eé]dito|telefono|tel[eé]fono|whatsapp|mail|email)\b/i.test(
      value,
    )
  )
}

const NON_QUOTE_CONTINUATION_FAQ_SUBTYPES = new Set([
  'business_hours',
  'location',
  'payment_methods',
  'contact',
  'maintenance',
  'benefits',
  'definition',
])

const SAFE_CUSTOMER_HYBRID_REWRITE_KEYS = new Set()
const WEAK_NEUTRAL_REENGAGEMENT_INTENTS = new Set([
  'customer.other',
  'unknown',
  'customer.light',
  'customer.clarify_request',
  'customer.rephrase_request',
  'customer.incomplete',
])

const looksLikeShortContextualFollowUp = (text) => {
  const normalized = normalizeText(text)
  const tokens = normalized.split(' ').filter(Boolean)
  if (!normalized || tokens.length > 8) {
    return false
  }

  return /^(?:si[\s,.]+)?(y|tambien|también|eso|este|esta|ese|esa|el mismo|la misma|mismo modelo|misma opcion|misma opción|cuanto|cuánto|cuanto demora|cuánto demora|demora|tarda|sirve|viene|incluye|se puede|puede venir)/i.test(
    normalized,
  )
}

const hasCurrentTurnQuoteSignal = ({
  currentTurnText = '',
  currentQuoteContext = null,
  previousQuoteContext = null,
}) => {
  const currentMeasurements =
    currentQuoteContext?.measurements && typeof currentQuoteContext.measurements === 'object'
      ? currentQuoteContext.measurements
      : null
  const previousMeasurements =
    previousQuoteContext?.measurements && typeof previousQuoteContext.measurements === 'object'
      ? previousQuoteContext.measurements
      : null
  const currentQuantity =
    currentQuoteContext?.quantity && typeof currentQuoteContext.quantity === 'object'
      ? currentQuoteContext.quantity
      : null
  const previousQuantity =
    previousQuoteContext?.quantity && typeof previousQuoteContext.quantity === 'object'
      ? previousQuoteContext.quantity
      : null

  const measurementsChanged =
    Boolean(currentMeasurements) &&
    (currentMeasurements?.widthMm !== previousMeasurements?.widthMm ||
      currentMeasurements?.heightMm !== previousMeasurements?.heightMm)
  const quantityChanged =
    Number(currentQuantity?.total || 0) > 0 &&
    currentQuantity?.total !== previousQuantity?.total

  return (
    measurementsChanged ||
    quantityChanged ||
    looksLikeGenericPriceInquiry(currentTurnText) ||
    looksLikeQuoteRequirementsQuestion(currentTurnText) ||
    looksLikeQuoteWaitingFollowUp(currentTurnText)
  )
}

const looksLikeContextualReference = (text) =>
  /(esto|eso|este|esta|ese|esa|lo de arriba|lo anterior|el anterior|la anterior|ese mismo|esa misma|registral[oa]s?|agregal[oa]s?|cargal[oa]s?|procesal[oa]s?|usalo|úsalo|usala|úsala|seg[uú]n|tomando lo anterior)/i.test(
    String(text || ''),
  )

const isGenericCustomerIntentKey = (intentKey) =>
  ['customer.other', 'unknown'].includes(String(intentKey || ''))

const CONTEXTUAL_CUSTOMER_CONTINUATION_INTENTS = new Set([
  'customer.other',
  'unknown',
  'customer.light',
  'customer.clarify_request',
  'customer.incomplete',
  'customer.product_info',
  'customer.topic_info',
])

const intentNamespace = (intentKey) => String(intentKey || '').split('.')[0] || 'other'

const isAdminConversationalRole = (role) =>
  String(role || '').startsWith('admin_') || role === 'superadmin'

const looksLikeAdminCapabilitiesRequest = (text) =>
  /\b(ayuda|help|que podes hacer|que pod(e|é)s hacer|como me podes ayudar|como me pod(e|é)s ayudar|en que me ayudas|en que pod(e|é)s ayudar|que acciones podes hacer|que gestiones podes resolver|que podes resolver)\b/i.test(
    String(text || ''),
  )

const looksLikeActionableLanguage = (text) =>
  /\b(crear|registrar|agendar|actualizar|editar|modificar|eliminar|borrar|cancelar|marcar|publicar|archivar|cotizar|presupuesto|pedido|pago|producto|cliente|item|categoria|categoría|stock)\b/i.test(
    String(text || ''),
  )

const looksLikeLightConversation = (text) => {
  const normalized = normalizeText(text)
  if (!normalized || looksLikeActionableLanguage(normalized)) {
    return false
  }

  const tokenCount = normalized.split(' ').filter(Boolean).length
  if (tokenCount > 6) {
    return false
  }

  return /\b(hola|buenas|buen dia|buenas tardes|buenas noches|gracias|ok|dale|perfecto|listo|como estas|como va|genial|excelente)\b/i.test(
    normalized,
  )
}

const resolveLightConversationKind = (text) => {
  const normalized = normalizeText(text)

  if (/\b(como estas|como va)\b/.test(normalized)) {
    return 'status_check'
  }
  if (/\b(gracias|muchas gracias|genial|excelente)\b/.test(normalized)) {
    return 'thanks'
  }
  if (/\b(ok|dale|perfecto|listo)\b/.test(normalized)) {
    return 'ack'
  }
  return 'greeting'
}

const looksLikeLightClosureFollowUp = (text) => {
  const normalized = normalizeText(text)
  if (!normalized) {
    return false
  }

  return (
    /^(ok|dale|perfecto|listo|gracias|muchas gracias|saludos?|buen dia|buenos dias|buenas tardes|buenas noches|claro|bien|genial|barbaro|b[aá]rbaro)(?:\s+(ok|dale|perfecto|listo|gracias|muchas gracias|saludos?|buen dia|buenos dias|buenas tardes|buenas noches|claro|bien|genial|barbaro|b[aá]rbaro))*$/i.test(
      normalized,
    ) ||
    /\b(vemos?\s+mas\s+adelante|vemos?\s+m[aá]s\s+adelante|lo\s+vemos?\s+mas\s+adelante|lo\s+vemos?\s+m[aá]s\s+adelante|por\s+ahora\s+no|por\s+ahora\s+no\s+puedo|m[aá]s\s+adelante|despu[eé]s\s+vemos|veo\s+y\s+me\s+comunico|te\s+aviso|les\s+aviso)\b/i.test(
      normalized,
    )
  )
}

const looksLikeClosureContinuationResponse = (text) =>
  /(cuando quieras retomarlo, seguimos por aca|cualquier cosa me escribis|quedo por aca)/i.test(
    normalizeText(text),
  )

const buildClosureContinuationReply = (previousAgentText = '') =>
  looksLikeClosureContinuationResponse(previousAgentText)
    ? 'Dale, cualquier cosa me escribís.'
    : 'Perfecto. Cuando quieras retomarlo, seguimos por acá.'

const sanitizeLoopSubjectLabel = (value = null) => {
  const compacted = compactText(value)
  const normalized = normalizeText(compacted)
  if (!normalized) {
    return null
  }

  if (
    /^\d+(?:[.,]\d+)?$/u.test(normalized) ||
    /^(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)$/u.test(normalized) ||
    QUOTE_DETAIL_FOLLOW_UP_STOP_TOKENS.has(normalized)
  ) {
    return null
  }

  return compacted
}

const looksLikeGenericClarificationResponse = (text) =>
  /no me queda totalmente claro|que necesit[aá]s resolver exactamente|quer[eé]s contarme un poco m[aá]s para orientarte mejor|contame un poco m[aá]s y lo vemos/i.test(
    normalizeText(text),
  )

const looksLikeGenericQuoteIntakeResponse = (text) =>
  /contame que queres cotizar|que producto te interesa|para prepararte un presupuesto|orientarte mejor con el precio/i.test(
    normalizeText(text),
  )

const looksLikeGenericContactResponse = (text) =>
  /tenemos atenci[oó]n por tel[eé]fono y whatsapp|te comparto el contacto por este medio|si, tenemos tel[eé]fono y whatsapp/i.test(
    normalizeText(text),
  )

const looksLikeGenericConsultationClosureResponse = (text) =>
  /si quieres, seguimos con tu consulta|si quer[eé]s, seguimos con tu consulta/i.test(
    normalizeText(text),
  )

const looksLikeGenericQuoteHandoffResponse = (text) =>
  /no tengo una configuraci[oó]n publicada con precio inmediato|le enviamos la cotizaci[oó]n a la brevedad|asesor del equipo se comunica para continuar/i.test(
    normalizeText(text),
  )

const looksLikeAwaitingProofResponse = (text) =>
  /cuando lo env[ií]es por ac[aá], lo tomo|cuando lo env[ií]es por ac[aá], lo dejo en seguimiento/i.test(
    normalizeText(text),
  )

const looksLikeOperationalStatusContinuation = (text) =>
  looksLikeScheduleContinuationInput(text) ||
  /\b(quedaron de avisar|ya e llamado|ya he llamado|pasaran|pasarán|estoy en|los espero|las espero|te espero)\b/i.test(
    String(text || ''),
  )

const looksLikeAmountOnlyReply = (text) =>
  /^\s*(?:usd|uyu|\$)?\s*\d+(?:[.,]\d{1,2})?\s*(?:usd|uyu)?\s*$/iu.test(
    String(text || '').trim(),
  )

const looksLikeAddressOrTimeReply = (text) =>
  /\b(direcci[oó]n|zona|esq|esquina|avenida|av\.?|calle|apto|apartamento|shop|local|horario|hoy|mañana|lunes|martes|mi[eé]rcoles|miercoles|jueves|viernes|s[aá]bado|sabado|domingo|a las|pasen|ir[ií]an|volver|vuelvan)\b/i.test(
    String(text || ''),
  ) || /\b\d{3,5}\b/.test(String(text || ''))

const QUOTE_DETAIL_FOLLOW_UP_STOP_TOKENS = new Set([
  'si',
  'sí',
  'no',
  'ok',
  'dale',
  'perfecto',
  'listo',
  'gracias',
  'muchas',
  'bien',
  'claro',
  'buen',
  'dia',
  'días',
  'dias',
])

const looksLikeQuoteDetailFollowUp = (text) => {
  const raw = String(text || '')
  const normalized = normalizeText(raw)
  if (!normalized || /[?¿]/u.test(raw) || looksLikeLightClosureFollowUp(raw)) {
    return false
  }

  if (
    looksLikeAmountOnlyReply(raw) ||
    /\b\d{1,4}(?:[.,]\d+)?\s*[x×]\s*\d{1,4}(?:[.,]\d+)?\b/u.test(normalized) ||
    looksLikeGenericPriceInquiry(raw) ||
    looksLikeQuoteRequirementsQuestion(raw) ||
    looksLikeQuoteWaitingFollowUp(raw) ||
    looksLikeMaterialFollowUpRequest(raw) ||
    looksLikeInformationExpansionRequest(raw) ||
    looksLikeCommercialConditionQuestion(raw) ||
    looksLikeOperationalStatusContinuation(raw) ||
    looksLikeAttachmentReference(raw)
  ) {
    return false
  }

  const tokens = normalized.split(/\s+/u).filter(Boolean)
  if (!tokens.length || tokens.length > 8) {
    return false
  }

  const meaningfulTokens = tokens.filter(
    (token) => !QUOTE_DETAIL_FOLLOW_UP_STOP_TOKENS.has(token),
  )

  return meaningfulTokens.some((token) => token.length >= 4 || /\d/u.test(token))
}

const looksLikeCoordinationAskResponse = (text) =>
  /podemos coordinar|coordinar (?:una )?(?:visita|revision|revisión|instalacion|instalación)|zona o direcci[oó]n|d[ií]a u horario|horario te queda mejor|tel[eé]fono o mail/i.test(
    normalizeText(text),
  )

const responseActivatesFallback = (response) =>
  Boolean(response?.needsHuman || response?.grounding?.fallbackReason)

const hasExplicitConfirmation = (input) =>
  [
    /^confirmo$/i,
    /^confirmar$/i,
    /^autorizo$/i,
    /^adelante$/i,
    /^procede$/i,
    /^procede por favor$/i,
    /^procede con eso$/i,
    /^procede con la operacion$/i,
    /^procede con la operación$/i,
    /^procede con el cambio$/i,
    /^proced[ée]$/i,
    /^ejecuta$/i,
    /^si hacelo$/i,
    /^sí hacelo$/i,
    /^si confirmo$/i,
    /^sí confirmo$/i,
  ].some((pattern) => pattern.test(normalizeText(input)))

const shouldPreferCustomerQuoteGuidance = ({
  input,
  intentKey,
  interpretation = null,
  tenantTopicTaxonomy = [],
}) => {
  if (intentKey !== 'customer.quote') {
    return false
  }

  const readiness = readInterpretationResolutionReadiness(interpretation)
  if (!readiness || typeof readiness !== 'object') {
    return false
  }

  if (readiness.lane !== 'quote') {
    return false
  }

  if (readiness.answerMode === 'inform_then_guide_quote') {
    return false
  }

  const quoteContext =
    interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
      ? interpretation.quoteContext
      : null
  const hasMeasurements = Boolean(quoteContext?.measurements)
  const requiresMeasurements = Boolean(quoteContext?.requiresMeasurements)
  const missingFields = Array.isArray(readiness?.missingFields)
    ? readiness.missingFields.filter((entry) => typeof entry === 'string')
    : Array.isArray(quoteContext?.missingFields)
      ? quoteContext.missingFields.filter((entry) => typeof entry === 'string')
      : []
  const completionStatus =
    typeof quoteContext?.completionStatus === 'string'
      ? quoteContext.completionStatus
      : null
  const quoteTopicType = String(interpretation?.topic?.type || '')
  const hasSpecificQuoteConfiguration =
    looksLikeConfiguredProductInterest(input, tenantTopicTaxonomy) ||
    quoteTopicType === 'product_variant'

  if (readiness.quoteInformationFirst === true) {
    return false
  }

  return (
    looksLikeQuoteRequirementsQuestion(input) ||
    Boolean(quoteContext?.multiTopic) ||
    missingFields.length > 0 ||
    readiness.quoteActionReady === true ||
    completionStatus === 'ready_for_handoff' ||
    (requiresMeasurements && !hasMeasurements) ||
    (hasMeasurements && !hasSpecificQuoteConfiguration)
  )
}

const composeQuoteKnowledgeFirstText = ({
  informationText = '',
  input = '',
  interpretation = null,
  tenantTopicTaxonomy = [],
}) => {
  const baseText = compactText(informationText)
  if (!baseText) {
    return baseText
  }

  const readiness = readInterpretationResolutionReadiness(interpretation)
  const missingFields = Array.isArray(readiness?.missingFields)
    ? readiness.missingFields.filter((entry) => typeof entry === 'string')
    : []
  if (
    readiness?.lane !== 'quote' ||
    readiness?.waitForMore === true ||
    missingFields.length === 0
  ) {
    return baseText
  }

  const shouldBridgeQuoteGuidance =
    !(
      String(interpretation?.topic?.type || '') === 'product_variant' &&
      normalizeText(input).split(/\s+/u).filter(Boolean).length <= 3 &&
      readiness?.quoteSeedDetected !== true &&
      readiness?.turnIntent !== 'customer.quote'
    ) &&
    !readiness?.sideQuestionSubtype &&
    !looksLikeInformationExpansionRequest(input) &&
    !looksLikeMaterialFollowUpRequest(input) &&
    (
      readiness?.quoteInformationFirst === true ||
      readiness?.quoteSeedDetected === true ||
      ['customer.product_info', 'customer.topic_info', 'customer.price_inquiry'].includes(
        String(readiness?.turnIntent || ''),
      ) ||
      readiness?.turnIntent === 'customer.quote' ||
      readiness?.quoteOriginThread === true
    )

  if (!shouldBridgeQuoteGuidance) {
    return baseText
  }

  let quoteBridge = compactText(
    buildCustomerQuoteRequestText(input, {
      interpretation,
      tenantTopicTaxonomy,
    }),
  )
  if (!quoteBridge) {
    return baseText
  }

  quoteBridge = quoteBridge.replace(/^(?:claro|perfecto|bien|listo)\.\s*/iu, '')
  if (!quoteBridge) {
    return baseText
  }

  if (normalizeText(baseText).includes(normalizeText(quoteBridge))) {
    return baseText
  }

  const trimmedInformationText = baseText.replace(
    /\s+Si\s+quier(?:e|é)s?,?\s+te\s+(?:cuento|ampl[ií]o|resumo|oriento|digo)[^.?!]*[.?!]?\s*$/iu,
    '',
  )

  return compactText(`${trimmedInformationText || baseText} ${quoteBridge}`)
}

const resolveEffectiveCustomerAnswerMode = ({
  input = '',
  interpretation = null,
  response = null,
}) => {
  const readiness = readInterpretationResolutionReadiness(interpretation)
  const answerMode =
    typeof readiness?.answerMode === 'string' ? readiness.answerMode : null
  const missingFields = Array.isArray(readiness?.missingFields)
    ? readiness.missingFields.filter((entry) => typeof entry === 'string')
    : []

  if (
    readiness?.lane === 'quote' &&
    response?.grounding?.grounded === true &&
    missingFields.length > 0
  ) {
    return 'inform_then_guide_quote'
  }

  return answerMode || null
}

const hasActiveKnowledgeTopicAnchor = ({
  turnInterpretation = null,
  currentTurnText = '',
  tenantRuntimePolicy = null,
} = {}) => {
  const explicitTopicAnchor = Boolean(turnInterpretation?.topic?.label)
  const contextTopicLabel = compactText(turnInterpretation?.contextTopic?.label || '')
  const contextTopicSource = compactText(turnInterpretation?.contextTopic?.source || '')
  const followUpDetected = turnInterpretation?.followUp?.detected === true
  const explicitContextTopicAnchor =
    Boolean(contextTopicLabel) && contextTopicSource !== 'conversation_memory'
  const carriedContextTopicAnchor = Boolean(contextTopicLabel) && followUpDetected
  const carriedQuoteTopicAnchor =
    followUpDetected &&
    Boolean(
      turnInterpretation?.quoteContext?.topicLabel ||
        turnInterpretation?.quoteContext?.familyLabel,
    )

  return (
    explicitTopicAnchor ||
    explicitContextTopicAnchor ||
    carriedContextTopicAnchor ||
    carriedQuoteTopicAnchor ||
    hasCatalogVocabularySignal(currentTurnText, tenantRuntimePolicy)
  )
}

const hasActiveFactualKnowledgeAnchor = ({
  intentKey = null,
  turnInterpretation = null,
  currentTurnText = '',
  tenantRuntimePolicy = null,
} = {}) => {
  const readiness = readInterpretationResolutionReadiness(turnInterpretation)
  const normalizedIntentKey = normalizeIntentKeyValue(intentKey)
  const interpretedTurnIntentKey =
    typeof turnInterpretation?.intent?.key === 'string'
      ? normalizeIntentKeyValue(turnInterpretation.intent.key)
      : null
  const readinessTurnIntentKey =
    typeof readiness?.turnIntent === 'string'
      ? normalizeIntentKeyValue(readiness.turnIntent)
      : null
  const followUpDetected = turnInterpretation?.followUp?.detected === true
  const topicSource = compactText(turnInterpretation?.topic?.source || '')
  const explicitTopicAnchor =
    Boolean(turnInterpretation?.topic?.label) &&
    !['thread_match', 'conversation_memory'].includes(topicSource)
  const carriedContextTopicAnchor =
    followUpDetected &&
    Boolean(
      turnInterpretation?.contextTopic?.label ||
        turnInterpretation?.quoteContext?.topicLabel ||
        turnInterpretation?.quoteContext?.familyLabel,
    )
  const catalogVocabularySignal = hasCatalogVocabularySignal(
    currentTurnText,
    tenantRuntimePolicy,
  )
  const explicitInformationalIntent = [
    'customer.product_info',
    'customer.topic_info',
    'customer.contact_info',
  ].includes(
    String(normalizedIntentKey || readinessTurnIntentKey || interpretedTurnIntentKey || ''),
  )
  const topicType =
    typeof turnInterpretation?.topic?.type === 'string'
      ? turnInterpretation.topic.type
      : typeof turnInterpretation?.contextTopic?.type === 'string'
        ? turnInterpretation.contextTopic.type
        : null
  const readinessLane = compactText(readiness?.lane || '')
  const activeBusinessFactTopic =
    explicitTopicAnchor && String(topicType || '') === 'business_fact'
  const quoteSafeInformationalIntent =
    explicitInformationalIntent &&
    (
      readinessLane !== 'quote' ||
      followUpDetected ||
      explicitTopicAnchor ||
      catalogVocabularySignal ||
      activeBusinessFactTopic
    )

  return (
    explicitTopicAnchor ||
    carriedContextTopicAnchor ||
    quoteSafeInformationalIntent ||
    activeBusinessFactTopic ||
    catalogVocabularySignal
  )
}

const RETRIEVAL_FREE_RESPONSE_CONTRACTS = new Set([
  'ask_quote_field',
  'guide_quote_exploration',
  'hold_for_more_context',
  'ask_schedule_field',
  'ask_support_field',
  'continue_support_resolution',
  'light_turn',
])

const REQUIRED_RETRIEVAL_RESPONSE_CONTRACTS = new Set(['inform_then_guide_quote'])

const FACTUAL_FAQ_SUBTYPES = new Set([
  'business_hours',
  'location',
  'contact',
  'availability',
  'definition',
])

const normalizeTenantFactEntries = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .filter((entry) => typeof entry === 'string')
        .map((entry) => compactText(entry))
        .filter(Boolean),
    ),
  )

const hasSpecificFaqSubtype = (value) => {
  const normalized = compactText(value).toLowerCase()
  return Boolean(normalized) && normalized !== 'general' && normalized !== 'unknown'
}

const resolveFaqSubtypeDecisionContext = ({
  faqSubtype = null,
  readiness = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
} = {}) => {
  const specificFaqSubtype = hasSpecificFaqSubtype(faqSubtype) ? faqSubtype : null
  const activeThreadLane = normalizeIntentKeyValue(readiness?.lane)
  const hasOperationalThread =
    ['quote', 'support', 'schedule'].includes(String(activeThreadLane || '')) &&
    (
      Boolean(
        compactText(
          readiness?.activeThreadId ||
            readiness?.threadKey ||
            '',
        ),
      ) ||
      readiness?.followUpDetected === true ||
      hasOperationalDecisionContext({
        lane: activeThreadLane,
        quoteContext,
        supportContext,
        scheduleContext,
      })
    )

  if (!specificFaqSubtype) {
    return {
      activeThreadLane: hasOperationalThread ? activeThreadLane : null,
      threadScopedFaqSubtype: null,
      fallbackFaqSubtype: null,
      belongsToActiveThread: false,
    }
  }

  return {
    activeThreadLane: hasOperationalThread ? activeThreadLane : null,
    threadScopedFaqSubtype: hasOperationalThread ? specificFaqSubtype : null,
    fallbackFaqSubtype: hasOperationalThread ? null : specificFaqSubtype,
    belongsToActiveThread: hasOperationalThread,
  }
}

const hasTenantBusinessFactCoverage = ({
  tenantRuntimePolicy = null,
  faqSubtype = null,
  intentKey = null,
  responseContract = null,
  lane = null,
} = {}) => {
  const businessFacts = getBusinessFacts(tenantRuntimePolicy)
  const specificFaqSubtype = hasSpecificFaqSubtype(faqSubtype) ? faqSubtype : null

  if (
    !specificFaqSubtype &&
    ((intentKey === 'customer.contact_info' || String(lane || '') === 'contact') &&
      ['execute_flow', 'answer_side_question', 'strict_knowledge_response'].includes(
        String(responseContract || ''),
      ))
  ) {
    return normalizeTenantFactEntries(businessFacts?.contact).length > 0
  }

  return false
}

const NON_FACTUAL_SIDE_QUESTION_RESPONSE_CONTRACTS = new Set([
  'answer_side_question',
  'guided_exploration',
])

const normalizeGroundingFactList = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .map((entry) => compactText(entry))
        .filter(Boolean),
    ),
  ).slice(0, 8)

const normalizeGroundingSourceIdList = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .map((entry) => compactText(entry))
        .filter(Boolean),
    ),
  ).slice(0, 12)

const normalizeGroundingSources = (values = []) =>
  (Array.isArray(values) ? values : [])
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      id: compactText(entry.id || entry.documentId || ''),
      documentId: compactText(entry.documentId || entry.id || ''),
      title: compactText(entry.title || ''),
      scope: compactText(entry.scope || '') || null,
      sourceType: compactText(entry.sourceType || '') || null,
      retrievalMode: compactText(entry.retrievalMode || '') || null,
      score:
        typeof entry.score === 'number' && Number.isFinite(entry.score) ? entry.score : null,
      lexicalScore:
        typeof entry.lexicalScore === 'number' && Number.isFinite(entry.lexicalScore)
          ? entry.lexicalScore
          : null,
      chunk:
        entry.chunk && typeof entry.chunk === 'object'
          ? {
              id: compactText(entry.chunk.id || '') || null,
            }
          : null,
    }))
    .filter((entry) => entry.id || entry.title || entry.sourceType)

const buildRetrievalGroundingSources = (retrievalItems = [], usedSourceIds = []) => {
  const selectedIds = new Set(normalizeGroundingSourceIdList(usedSourceIds))
  const normalizedItems = Array.isArray(retrievalItems)
    ? retrievalItems.filter((entry) => entry && typeof entry === 'object')
    : []

  const selectedItems =
    selectedIds.size > 0
      ? normalizedItems.filter((item) => {
          const sourceId = compactText(item?.id || item?.documentId || '')
          return sourceId && selectedIds.has(sourceId)
        })
      : normalizedItems.slice(0, 3)

  return normalizeGroundingSources(
    selectedItems.map((item) => ({
      id: item.id,
      documentId: item.documentId || item.id,
      title: item.title,
      scope: item.scope,
      sourceType: item.sourceType,
      retrievalMode:
        typeof item.retrievalMode === 'string' ? item.retrievalMode : null,
      score:
        typeof item.score === 'number' && Number.isFinite(item.score) ? item.score : null,
      lexicalScore:
        typeof item.lexicalScore === 'number' && Number.isFinite(item.lexicalScore)
          ? item.lexicalScore
          : null,
      chunk:
        item.chunk && typeof item.chunk === 'object'
          ? {
              id: item.chunk.id || null,
            }
          : null,
    })),
  )
}

const buildTenantPolicyGroundingSource = ({
  tenantKey = 'default',
  sourceKey = 'policy',
  title = 'Tenant policy',
} = {}) =>
  normalizeGroundingSources([
    {
      id: `tenant-policy:${compactText(tenantKey) || 'default'}:${compactText(sourceKey) || 'policy'}`,
      documentId: null,
      title,
      scope: 'tenant_policy',
      sourceType: 'tenant_policy',
      retrievalMode: null,
      score: null,
      lexicalScore: null,
    },
  ])

const buildStructuredGroundingSource = ({
  tenantKey = 'default',
  sourceType = 'runtime_source',
  scope = 'runtime',
  sourceKey = 'entry',
  title = 'Runtime source',
} = {}) =>
  normalizeGroundingSources([
    {
      id: `${compactText(sourceType) || 'runtime_source'}:${compactText(tenantKey) || 'default'}:${compactText(sourceKey) || 'entry'}`,
      documentId: null,
      title,
      scope,
      sourceType,
      retrievalMode: null,
      score: null,
      lexicalScore: null,
    },
  ])

const extractGroundingFactsFromText = (text = '', limit = 2) =>
  String(text || '')
    .split(/(?<=[.!?])\s+/u)
    .map((entry) => compactText(entry))
    .filter(
      (entry) =>
        entry &&
        entry.length >= 12 &&
        !/^(si quer[eé]s|si quieres|if you want|¿|could you|want me to)/iu.test(entry),
    )
    .slice(0, limit)

const buildRetrievalFaqGroundingContract = ({
  input = '',
  retrievalItems = [],
  interpretation = null,
  tenantRuntimePolicy = null,
  paymentMethods = [],
  text = '',
  existing = null,
} = {}) => {
  const detectionInput =
    typeof interpretation?.normalizedCurrentTurn === 'string' &&
    interpretation.normalizedCurrentTurn.trim()
      ? interpretation.normalizedCurrentTurn.trim()
      : input
  const faqSubtype = detectCustomerFaqSubtype(detectionInput, {
    retrievalItems,
    tenantRuntimePolicy,
  })
  const evidence = selectCustomerFaqEvidence({
    input: detectionInput,
    retrievalItems,
    faqSubtype,
    paymentMethods,
    tenantRuntimePolicy,
  })
  const evidenceFacts = evidence.map((entry) => entry?.text).filter(Boolean)
  const fallbackFacts = extractKnowledgeFallbackStatements(retrievalItems, {
    input: detectionInput,
    tenantRuntimePolicy,
    limit: 2,
  })
  const usedFacts =
    evidenceFacts.length > 0
      ? evidenceFacts
      : fallbackFacts.length > 0
        ? fallbackFacts
        : extractGroundingFactsFromText(text, 2)
  const usedSourceIds = normalizeGroundingSourceIdList([
    ...evidence.map((entry) => entry?.sourceId || entry?.documentId || ''),
    ...retrievalItems
      .slice(0, Math.max(1, usedFacts.length))
      .map((entry) => entry?.id || entry?.documentId || ''),
  ])

  return buildGroundingContract({
    existing,
    knowledgeRetrieved: Array.isArray(retrievalItems) && retrievalItems.length > 0,
    usedFacts,
    usedSourceIds,
    sources: buildRetrievalGroundingSources(retrievalItems, usedSourceIds),
  })
}

const buildGroundingContract = ({
  existing = null,
  knowledgeRetrieved = false,
  usedFacts = [],
  usedSourceIds = [],
  sources = [],
} = {}) => {
  const normalizedFacts = normalizeGroundingFactList(usedFacts)
  const normalizedSources = normalizeGroundingSources(sources)
  const normalizedSourceIds = normalizeGroundingSourceIdList([
    ...usedSourceIds,
    ...normalizedSources.map((entry) => entry.id).filter(Boolean),
  ])
  const knowledgeUsed = normalizedFacts.length > 0
  const knowledgeGrounded = knowledgeUsed

  return {
    ...(existing && typeof existing === 'object' ? existing : {}),
    grounded: knowledgeGrounded,
    used: knowledgeUsed,
    knowledgeUsed,
    knowledgeRetrieved: Boolean(knowledgeRetrieved),
    knowledgeGrounded,
    usedFacts: normalizedFacts,
    usedSourceIds: normalizedSourceIds,
    sourceCount: normalizedSources.length,
    sources: normalizedSources,
    fallbackReason:
      typeof existing?.fallbackReason === 'string' ? existing.fallbackReason : null,
  }
}

const buildRetrievalContextSources = (retrievalContext = null) =>
  buildRetrievalGroundingSources(retrievalContext?.items ?? [])

const finalizeResponseGrounding = ({
  response = null,
  retrievalContext = null,
  providerGenerationAttempted = false,
} = {}) => {
  const explicitGrounding =
    response?.grounding && typeof response.grounding === 'object' ? response.grounding : {}
  const usedFacts = normalizeGroundingFactList(explicitGrounding.usedFacts)
  const explicitKnowledgeGrounded =
    (typeof explicitGrounding.knowledgeGrounded === 'boolean'
      ? explicitGrounding.knowledgeGrounded
      : typeof explicitGrounding.grounded === 'boolean'
        ? explicitGrounding.grounded
        : false) && usedFacts.length > 0
  const explicitKnowledgeUsed =
    typeof explicitGrounding.knowledgeUsed === 'boolean'
      ? explicitGrounding.knowledgeUsed && usedFacts.length > 0
      : explicitGrounding.used === true
        ? usedFacts.length > 0
        : usedFacts.length > 0
  const explicitKnowledgeRetrieved =
    typeof explicitGrounding.knowledgeRetrieved === 'boolean'
      ? explicitGrounding.knowledgeRetrieved
      : Array.isArray(retrievalContext?.items)
        ? retrievalContext.items.length > 0
        : false
  const sources =
    Array.isArray(explicitGrounding.sources) && explicitGrounding.sources.length > 0
      ? normalizeGroundingSources(explicitGrounding.sources)
      : explicitKnowledgeRetrieved
        ? buildRetrievalContextSources(retrievalContext)
        : []
  const usedSourceIds = normalizeGroundingSourceIdList(
    explicitGrounding.usedSourceIds?.length ? explicitGrounding.usedSourceIds : sources.map((entry) => entry.id),
  )

  return {
    ...explicitGrounding,
    grounded: explicitKnowledgeGrounded,
    used: explicitKnowledgeUsed,
    knowledgeUsed: explicitKnowledgeUsed,
    knowledgeRetrieved: explicitKnowledgeRetrieved,
    knowledgeGrounded: explicitKnowledgeGrounded,
    usedFacts,
    usedSourceIds,
    sourceCount:
      typeof explicitGrounding.sourceCount === 'number' &&
      Number.isFinite(explicitGrounding.sourceCount)
        ? explicitGrounding.sourceCount
        : sources.length,
    sources,
    fallbackReason:
      typeof explicitGrounding.fallbackReason === 'string'
        ? explicitGrounding.fallbackReason
        : response?.needsHuman
          ? 'missing_approved_context'
          : providerGenerationAttempted &&
              explicitKnowledgeRetrieved !== true &&
              (Array.isArray(response?.toolCalls) ? response.toolCalls.length === 0 : true) &&
              explicitKnowledgeGrounded !== true
            ? 'missing_approved_context'
            : null,
  }
}

const CUSTOMER_LANE_ACTIVE_INTENT_KEYS = Object.freeze({
  quote: 'customer.quote',
  support: 'customer.support_request',
  schedule: 'customer.schedule_request',
  contact: 'customer.contact_info',
  business_info: 'customer.topic_info',
})

const CUSTOMER_TURN_INTENT_PRESERVATION_KEYS = new Set([
  'customer.other',
  'customer.light',
  'customer.clarify_request',
  'customer.rephrase_request',
  'customer.incomplete',
  'customer.contact_info',
  'customer.order_status',
  'customer.auth_required',
  'customer.owned_document_request',
  'customer.private_account_data',
  'customer.multi_intent',
  'customer.confirmation',
  'customer.cancellation',
  'customer.frustration',
  'customer.sensitive',
  'customer.out_of_scope',
])

const CUSTOMER_FLOW_CARRYOVER_ANSWER_MODES = new Set([
  'hold_for_more_context',
  'ask_quote_field',
  'quote_ready',
  'ask_support_field',
  'continue_support_resolution',
  'ask_schedule_field',
  'confirm_schedule',
  'ask_next_useful_field',
  'execute_flow',
])

const CUSTOMER_EXPLORATION_INTENT_KEYS = new Set([
  'customer.product_info',
  'customer.topic_info',
  'customer.price_inquiry',
])

const CUSTOMER_PURE_EXPLORATION_INTENT_KEYS = new Set([
  'customer.product_info',
  'customer.topic_info',
])

const CUSTOMER_OPERATIONAL_INTENT_KEYS = new Set([
  'customer.quote',
  'customer.support_request',
  'customer.schedule_request',
  'customer.contact_info',
  'customer.order_status',
  'customer.auth_required',
  'customer.owned_document_request',
  'customer.private_account_data',
])

const normalizeIntentKeyValue = (value) => {
  if (typeof value !== 'string') {
    return null
  }

  const normalized = value.trim()
  if (!normalized.length || normalized === 'unknown') {
    return null
  }

  return normalized
}

const readConversationActiveLane = (conversationContext = null) => {
  if (
    conversationContext?.resolutionReadiness &&
    typeof conversationContext.resolutionReadiness === 'object' &&
    typeof conversationContext.resolutionReadiness.lane === 'string' &&
    conversationContext.resolutionReadiness.lane.trim()
  ) {
    return conversationContext.resolutionReadiness.lane.trim()
  }

  if (
    typeof conversationContext?.activeLane === 'string' &&
    conversationContext.activeLane.trim()
  ) {
    return conversationContext.activeLane.trim()
  }

  if (
    typeof conversationContext?.activeDomain === 'string' &&
    conversationContext.activeDomain.trim()
  ) {
    return conversationContext.activeDomain.trim()
  }

  return null
}

const hasConcreteSchedulePayload = (scheduleContext = null) =>
  Boolean(
    scheduleContext?.startAt ||
      scheduleContext?.address ||
      scheduleContext?.contactPhone ||
      scheduleContext?.contactEmail ||
      scheduleContext?.date?.dateLabel ||
      scheduleContext?.time?.timeLabel,
  )

const hasQuoteDecisionContext = (quoteContext = null) =>
  Boolean(
    quoteContext &&
      (
        typeof quoteContext?.topicLabel === 'string' ||
        typeof quoteContext?.familyLabel === 'string' ||
        Boolean(quoteContext?.measurements) ||
        (Array.isArray(quoteContext?.measurementItems) &&
          quoteContext.measurementItems.length > 0) ||
        Number(quoteContext?.quantity?.total || 0) > 0 ||
        (quoteContext?.capturedAttributes &&
          typeof quoteContext.capturedAttributes === 'object' &&
          Object.keys(quoteContext.capturedAttributes).length > 0)
      ),
  )

const hasSupportDecisionContext = (supportContext = null) =>
  Boolean(
    supportContext &&
      (
        typeof supportContext?.productType === 'string' ||
        typeof supportContext?.issueSummary === 'string' ||
        typeof supportContext?.address === 'string' ||
        Boolean(supportContext?.preferredDate?.dateLabel) ||
        Boolean(supportContext?.preferredTime?.timeLabel) ||
        Boolean(supportContext?.wantsVisit)
      ),
  )

const hasScheduleDecisionContext = (scheduleContext = null) =>
  Boolean(
    scheduleContext &&
      (
        typeof scheduleContext?.address === 'string' ||
        Boolean(scheduleContext?.date?.dateLabel) ||
        Boolean(scheduleContext?.time?.timeLabel) ||
        typeof scheduleContext?.contactPhone === 'string' ||
        typeof scheduleContext?.contactEmail === 'string'
      ),
  )

const getOperationalContextForLane = ({
  lane = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
} = {}) => {
  if (lane === 'quote') {
    return quoteContext
  }
  if (lane === 'support') {
    return supportContext
  }
  if (lane === 'schedule') {
    return scheduleContext
  }
  return null
}

const hasOperationalDecisionContext = ({
  lane = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
} = {}) => {
  if (lane === 'quote') {
    return hasQuoteDecisionContext(quoteContext)
  }
  if (lane === 'support') {
    return hasSupportDecisionContext(supportContext)
  }
  if (lane === 'schedule') {
    return hasScheduleDecisionContext(scheduleContext)
  }
  return false
}

const getOperationalAnswerModeForLane = (lane = null, nextUsefulField = null) => {
  if (lane === 'quote') {
    return nextUsefulField ? 'ask_quote_field' : 'quote_ready'
  }
  if (lane === 'support') {
    return nextUsefulField ? 'ask_support_field' : 'continue_support_resolution'
  }
  if (lane === 'schedule') {
    return nextUsefulField ? 'ask_schedule_field' : 'confirm_schedule'
  }
  return null
}

const getOperationalMissingFieldsForLane = ({
  lane = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  conversationState = null,
} = {}) => {
  const context = getOperationalContextForLane({
    lane,
    quoteContext,
    supportContext,
    scheduleContext,
  })
  const rawMissingFields = Array.isArray(context?.missingFields)
    ? context.missingFields.filter((entry) => typeof entry === 'string')
    : []

  return filterResolvedConversationFields({
    missingFields: rawMissingFields,
    conversationState,
  })
}

const chooseNextMissingFieldForDecision = ({
  requestedField = null,
  missingFields = [],
  conversationState = null,
  avoidLastAskedSlot = true,
} = {}) => {
  const normalizedMissingFields = (Array.isArray(missingFields) ? missingFields : []).filter(
    (field) => typeof field === 'string' && field.trim(),
  )
  const preferredField = resolveNextConversationField({
    requestedField,
    missingFields: normalizedMissingFields,
    conversationState,
  })
  const lastAskedSlot =
    avoidLastAskedSlot && typeof conversationState?.lastAskedSlot === 'string'
      ? conversationState.lastAskedSlot
      : null

  if (!preferredField || !lastAskedSlot || normalizedMissingFields.length <= 1) {
    return preferredField || normalizedMissingFields[0] || null
  }

  const preferredSlot = mapConversationFieldToSlot(preferredField, conversationState)
  if (preferredSlot !== lastAskedSlot) {
    return preferredField
  }

  const alternativeField =
    normalizedMissingFields.find((field) => {
      if (isConversationFieldResolved(field, conversationState)) {
        return false
      }
      const slotKey = mapConversationFieldToSlot(field, conversationState)
      return !slotKey || slotKey !== lastAskedSlot
    }) || null

  return alternativeField || preferredField
}

const GENERIC_NON_PROGRESS_ANSWER_MODES = new Set([
  'guided_exploration',
  'guide_quote_exploration',
  'ask_clarification',
  'hold_for_more_context',
])

const applyPreResponseDecisionGuards = ({
  readiness = null,
  previousConversationContext = null,
  previousActiveThreadKey = null,
  threadResolution = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  conversationState = null,
} = {}) => {
  if (!readiness || typeof readiness !== 'object') {
    return readiness
  }

  const previousLane = normalizeIntentKeyValue(
    readConversationActiveLane(previousConversationContext),
  )
  const previousReadiness =
    previousConversationContext?.resolutionReadiness &&
    typeof previousConversationContext.resolutionReadiness === 'object'
      ? previousConversationContext.resolutionReadiness
      : null
  const activeThreadId =
    compactText(
      threadResolution?.activeThreadKey ||
        readiness?.threadKey ||
        previousConversationContext?.threadKey ||
        previousReadiness?.threadKey ||
        previousActiveThreadKey ||
        '',
    ) || null
  const hasCurrentOperationalContext = (lane) =>
    hasOperationalDecisionContext({
      lane,
      quoteContext,
      supportContext,
      scheduleContext,
    })
  const hasOperationalThreadToResume = ['quote', 'support', 'schedule'].includes(
    String(previousLane || ''),
  )
  let lane = normalizeIntentKeyValue(readiness?.lane) || previousLane || null
  if (
    hasOperationalThreadToResume &&
    (
      !['quote', 'support', 'schedule'].includes(String(lane || '')) ||
      (lane !== previousLane && hasCurrentOperationalContext(previousLane))
    ) &&
    (readiness?.followUpDetected === true ||
      activeThreadId ||
      hasCurrentOperationalContext(previousLane))
  ) {
    lane = previousLane
  }

  const missingFields = getOperationalMissingFieldsForLane({
    lane,
    quoteContext,
    supportContext,
    scheduleContext,
    conversationState,
  })
  const requestedField =
    compactText(
      readiness?.resumePointer ||
        readiness?.nextUsefulField ||
        previousConversationContext?.resumePointer ||
        previousReadiness?.nextUsefulField ||
        '',
    ) || null
  let nextUsefulField = chooseNextMissingFieldForDecision({
    requestedField,
    missingFields,
    conversationState,
  })
  let answerMode =
    typeof readiness?.answerMode === 'string' && readiness.answerMode.trim()
      ? readiness.answerMode.trim()
      : null
  const operationalAnswerMode = getOperationalAnswerModeForLane(lane, nextUsefulField)
  const hasOperationalThread =
    ['quote', 'support', 'schedule'].includes(String(lane || '')) &&
    (Boolean(activeThreadId) ||
      hasCurrentOperationalContext(lane) ||
      hasOperationalThreadToResume)

  if (
    /^ask_/.test(String(answerMode || '')) &&
    nextUsefulField &&
    isConversationFieldResolved(nextUsefulField, conversationState)
  ) {
    nextUsefulField = chooseNextMissingFieldForDecision({
      requestedField: null,
      missingFields,
      conversationState,
    })
  }

  if (/^ask_/.test(String(answerMode || '')) && !nextUsefulField) {
    answerMode = operationalAnswerMode
  } else if (
    hasOperationalThread &&
    GENERIC_NON_PROGRESS_ANSWER_MODES.has(String(answerMode || ''))
  ) {
    answerMode = operationalAnswerMode
  }

  if (!answerMode && operationalAnswerMode) {
    answerMode = operationalAnswerMode
  }

  return {
    ...readiness,
    lane: lane || readiness?.lane || null,
    missingFields,
    nextUsefulField,
    answerMode,
    threadKey: activeThreadId || readiness?.threadKey || null,
    activeThreadId,
    activeIntent:
      (lane && CUSTOMER_LANE_ACTIVE_INTENT_KEYS[lane]) || readiness?.turnIntent || null,
    resumePointer:
      nextUsefulField ||
      requestedField ||
      (typeof readiness?.resumePointer === 'string' ? readiness.resumePointer : null),
  }
}

const projectOperationalContextsForDecision = ({
  readiness = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  conversationState = null,
} = {}) => {
  const lane = normalizeIntentKeyValue(readiness?.lane)
  const answerMode = normalizeIntentKeyValue(readiness?.answerMode)
  const nextUsefulField =
    typeof readiness?.nextUsefulField === 'string' && readiness.nextUsefulField.trim()
      ? readiness.nextUsefulField.trim()
      : null

  const projectContext = (context, { emptyOnResolved = false } = {}) => {
    if (!context || typeof context !== 'object') {
      return context
    }

    const normalizedMissingFields = filterResolvedConversationFields({
      missingFields: Array.isArray(context?.missingFields) ? context.missingFields : [],
      conversationState,
    })

    let projectedMissingFields = normalizedMissingFields
    if (nextUsefulField && /^ask_/.test(String(answerMode || ''))) {
      projectedMissingFields = normalizedMissingFields.includes(nextUsefulField)
        ? [nextUsefulField]
        : normalizedMissingFields
    } else if (emptyOnResolved) {
      projectedMissingFields = []
    }

    const projectedMissingAttributes = Array.isArray(context?.missingAttributes)
      ? context.missingAttributes.filter(
          (entry) =>
            entry &&
            typeof entry === 'object' &&
            projectedMissingFields.includes(String(entry.key || '').trim()),
        )
      : Array.isArray(context?.requiredAttributes)
        ? context.requiredAttributes.filter(
            (entry) =>
              entry &&
              typeof entry === 'object' &&
              projectedMissingFields.includes(String(entry.key || '').trim()),
          )
        : []

    return {
      ...context,
      missingFields: projectedMissingFields,
      missingAttributes: projectedMissingAttributes,
      nextUsefulField,
    }
  }

  return {
    quoteContext:
      lane === 'quote'
        ? (() => {
            const projected = projectContext(quoteContext, {
              emptyOnResolved: answerMode === 'quote_ready',
            })
            if (!projected || typeof projected !== 'object') {
              return projected
            }
            if (answerMode !== 'quote_ready') {
              return projected
            }
            return {
              ...projected,
              completionStatus:
                typeof projected.completionStatus === 'string' &&
                projected.completionStatus.trim()
                  ? projected.completionStatus
                  : 'ready_for_handoff',
            }
          })()
        : quoteContext,
    supportContext:
      lane === 'support'
        ? projectContext(supportContext, {
            emptyOnResolved: answerMode === 'continue_support_resolution',
          })
        : supportContext,
    scheduleContext:
      lane === 'schedule'
        ? projectContext(scheduleContext, {
            emptyOnResolved: answerMode === 'confirm_schedule',
          })
        : scheduleContext,
  }
}

const resolveCustomerActiveIntentKeyFromReadiness = ({
  role,
  turnIntentKey = null,
  readiness = null,
}) => {
  const normalizedTurnIntentKey = normalizeIntentKeyValue(turnIntentKey)

  if (!(role === 'customer_public' || role === 'customer_authenticated')) {
    return normalizedTurnIntentKey || 'unknown'
  }

  if (!readiness || typeof readiness !== 'object') {
    return normalizedTurnIntentKey || 'unknown'
  }

  const readinessLane = normalizeIntentKeyValue(readiness.lane)
  const laneIntentKey = readinessLane
    ? CUSTOMER_LANE_ACTIVE_INTENT_KEYS[readinessLane] || null
    : null
  const answerMode = normalizeIntentKeyValue(readiness.answerMode)
  const waitForMoreReasons = Array.isArray(readiness?.waitForMoreReasons)
    ? readiness.waitForMoreReasons.filter((entry) => typeof entry === 'string')
    : []
  const hasStructuredQuoteSignal =
    readiness?.quoteStructuredContext === true ||
    readiness?.quoteActionReady === true ||
    Number(readiness?.knownFacts?.quantity || 0) > 0 ||
    typeof readiness?.knownFacts?.measurements === 'string'
  const hasQuoteFragmentCarryover = waitForMoreReasons.some(
    (reason) =>
      reason === 'quote_related_fragment' || String(reason).startsWith('quote_missing_'),
  )
  const shortQuoteSeedWait =
    waitForMoreReasons.length > 0 &&
    waitForMoreReasons.every((reason) => reason === 'short_quote_seed')
  const hasQuoteContinuationSignal =
    readiness?.quoteOriginThread === true ||
    readiness?.quoteSeedDetected === true ||
    hasStructuredQuoteSignal ||
    hasQuoteFragmentCarryover
  const previousIntentWasQuote = readiness?.previousIntentWasQuote === true
  const previousQuoteDisambiguationPending =
    readiness?.previousQuoteDisambiguationPending === true
  const resetCueDetected = readiness?.resetCueDetected === true
  const topicOnlyExplorationTurn =
    readiness?.quoteTopicOnlyTurn === true ||
    readiness?.quoteTopicOnlyTurnText === true
  const canIgnoreInheritedQuoteStructure =
    CUSTOMER_PURE_EXPLORATION_INTENT_KEYS.has(String(normalizedTurnIntentKey || '')) &&
    previousIntentWasQuote !== true &&
    topicOnlyExplorationTurn
  const canPreserveExploratoryIntent =
    CUSTOMER_PURE_EXPLORATION_INTENT_KEYS.has(String(normalizedTurnIntentKey || '')) ||
    (
      normalizedTurnIntentKey === 'customer.price_inquiry' &&
      previousIntentWasQuote !== true &&
      previousQuoteDisambiguationPending !== true
    )
  const shouldDowngradeWeakQuoteTurn =
    readinessLane === 'quote' &&
    normalizedTurnIntentKey === 'customer.quote' &&
    readiness?.quoteOriginThread !== true &&
    readiness?.quoteSeedDetected !== true &&
    !hasStructuredQuoteSignal &&
    !hasQuoteFragmentCarryover &&
    readiness?.requiresDisambiguation !== true &&
    readiness?.quoteMultiTopic !== true &&
    (
      String(answerMode || '') === 'guide_quote_exploration' ||
      shortQuoteSeedWait ||
      readiness?.quoteTopicOnlyTurn === true ||
      readiness?.quoteTopicOnlyTurnText === true
    )
  const isOperationalContinuation =
    Boolean(laneIntentKey) &&
    ['quote', 'support', 'schedule'].includes(String(readinessLane || '')) &&
    (
      readinessLane === 'quote'
        ? hasQuoteContinuationSignal &&
          (
            CUSTOMER_FLOW_CARRYOVER_ANSWER_MODES.has(String(answerMode || '')) ||
            readiness?.followUpDetected === true ||
            (
              typeof readiness?.threadKey === 'string' &&
              readiness.threadKey.trim()
            )
          )
        : CUSTOMER_FLOW_CARRYOVER_ANSWER_MODES.has(String(answerMode || '')) ||
          readiness?.followUpDetected === true ||
          (
            typeof readiness?.threadKey === 'string' &&
            readiness.threadKey.trim() &&
            (readinessLane !== 'quote' || hasStructuredQuoteSignal)
          )
    )
  const shouldPreserveQuoteExplorationIntent =
    readinessLane === 'quote' &&
    canPreserveExploratoryIntent &&
    (!hasStructuredQuoteSignal || canIgnoreInheritedQuoteStructure) &&
    !hasQuoteFragmentCarryover &&
    readiness?.requiresDisambiguation !== true &&
    readiness?.quoteMultiTopic !== true &&
    previousQuoteDisambiguationPending !== true &&
    (
      resetCueDetected ||
      readiness?.quoteInformationFirst === true ||
      topicOnlyExplorationTurn ||
      shortQuoteSeedWait ||
      String(answerMode || '') === 'guide_quote_exploration'
    ) &&
    (
      previousIntentWasQuote !== true ||
      resetCueDetected
    )
  const shouldElevateDisambiguatedQuoteTurn =
    readiness?.requiresDisambiguation === true &&
    CUSTOMER_EXPLORATION_INTENT_KEYS.has(String(normalizedTurnIntentKey || '')) &&
    (
      hasQuoteContinuationSignal
    )
  const shouldPreserveTurnIntent =
    CUSTOMER_TURN_INTENT_PRESERVATION_KEYS.has(String(normalizedTurnIntentKey || '')) &&
    !(
      readinessLane === 'quote' &&
      hasQuoteContinuationSignal &&
      ['customer.clarify_request', 'customer.other', 'customer.incomplete'].includes(
        String(normalizedTurnIntentKey || ''),
      )
    )
  const isWeakGenericTurnIntent = ['customer.other', 'customer.incomplete', 'unknown', null].includes(
    normalizedTurnIntentKey,
  )

  if (normalizedTurnIntentKey === 'customer.multi_intent') {
    return normalizedTurnIntentKey
  }

  if (
    readiness?.supportThreadPresent === true &&
    typeof readiness?.knownFacts?.supportIssue === 'string' &&
    (
      normalizedTurnIntentKey === 'customer.support_request' ||
      normalizeIntentKeyValue(readiness?.turnIntent) === 'customer.support_request'
    )
  ) {
    return 'customer.support_request'
  }

  if (shouldDowngradeWeakQuoteTurn) {
    return 'customer.product_info'
  }

  if (
    readiness?.quoteThreadPresent === true &&
    readiness?.artifactTurn === true &&
    ['customer.incomplete', 'customer.other', 'unknown', null].includes(
      normalizedTurnIntentKey,
    )
  ) {
    return 'customer.quote'
  }

  if (readinessLane === 'quote' && laneIntentKey) {
    if (CUSTOMER_OPERATIONAL_INTENT_KEYS.has(String(normalizedTurnIntentKey || ''))) {
      return normalizedTurnIntentKey
    }
    if (shouldElevateDisambiguatedQuoteTurn) {
      return laneIntentKey
    }
    if (shouldPreserveQuoteExplorationIntent) {
      return normalizedTurnIntentKey
    }
    if (
      (isOperationalContinuation ||
        hasQuoteFragmentCarryover ||
        readiness?.quoteSeedDetected === true ||
        readiness?.artifactTurn === true) &&
      !readiness?.sideQuestionSubtype &&
      (
        isWeakGenericTurnIntent ||
        shouldPreserveTurnIntent ||
        CUSTOMER_EXPLORATION_INTENT_KEYS.has(String(normalizedTurnIntentKey || ''))
      )
    ) {
      return laneIntentKey
    }
  }

  if (
    readinessLane === 'support' &&
    laneIntentKey &&
    CUSTOMER_OPERATIONAL_INTENT_KEYS.has(String(normalizedTurnIntentKey || ''))
  ) {
    return normalizedTurnIntentKey
  }

  if (
    readinessLane === 'support' &&
    laneIntentKey &&
    isOperationalContinuation &&
    !readiness?.sideQuestionSubtype &&
    (
      normalizedTurnIntentKey == null ||
      shouldPreserveTurnIntent
    )
  ) {
    return laneIntentKey
  }

  if (
    readiness?.supportThreadPresent === true &&
    readiness?.artifactTurn === true &&
    ['customer.schedule_request', 'customer.incomplete', 'customer.other', null].includes(
      normalizedTurnIntentKey,
    )
  ) {
    return 'customer.support_request'
  }

  if (
    readinessLane === 'schedule' &&
    laneIntentKey &&
    readiness?.quoteThreadPresent === true &&
    hasStructuredQuoteSignal &&
    readiness?.scheduleTurnSignals !== true &&
    (
      readiness?.artifactTurn === true ||
      readiness?.followUpDetected === true
    ) &&
    ['customer.schedule_request', 'customer.incomplete', 'customer.other', null].includes(
      normalizedTurnIntentKey,
    )
  ) {
    return 'customer.quote'
  }

  if (
    readinessLane === 'schedule' &&
    laneIntentKey &&
    CUSTOMER_OPERATIONAL_INTENT_KEYS.has(String(normalizedTurnIntentKey || ''))
  ) {
    return normalizedTurnIntentKey
  }

  if (
    readinessLane === 'schedule' &&
    laneIntentKey &&
    isOperationalContinuation &&
    !readiness?.sideQuestionSubtype &&
    (
      normalizedTurnIntentKey == null ||
      shouldPreserveTurnIntent
    )
  ) {
    return laneIntentKey
  }

  if (
    readiness?.sideQuestionSubtype &&
    laneIntentKey &&
    ['quote', 'support', 'schedule'].includes(String(readinessLane || '')) &&
    (
      typeof readiness?.activeThreadId === 'string' ||
      typeof readiness?.threadKey === 'string' ||
      readiness?.followUpDetected === true
    )
  ) {
    return laneIntentKey
  }

  if (
    answerMode === 'answer_side_question' &&
    laneIntentKey &&
    ['quote', 'support', 'schedule'].includes(String(readinessLane || '')) &&
    (
      typeof readiness?.activeThreadId === 'string' ||
      typeof readiness?.threadKey === 'string' ||
      readiness?.followUpDetected === true
    ) &&
    !shouldPreserveTurnIntent
  ) {
    return laneIntentKey
  }

  if (
    readiness?.sideQuestionSubtype ||
    answerMode === 'answer_side_question' ||
    readiness?.mode === 'small_talk' ||
    readiness?.mode === 'unclear' ||
    shouldPreserveTurnIntent
  ) {
    return normalizedTurnIntentKey || laneIntentKey || 'unknown'
  }

  if (
    laneIntentKey &&
    CUSTOMER_FLOW_CARRYOVER_ANSWER_MODES.has(String(answerMode || ''))
  ) {
    return laneIntentKey
  }

  return normalizedTurnIntentKey || laneIntentKey || 'unknown'
}

const parsePositiveInteger = (value) => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

const resolveTrustedCustomerId = (unifiedMessage) =>
  parsePositiveInteger(
    unifiedMessage?.customerId ??
      unifiedMessage?.metadata?.customerId ??
      unifiedMessage?.metadata?.conversationCustomerId ??
      null,
  )

const isDebugModeEnabled = () => process.env.NODE_ENV !== 'production'

const extractProviderStatusCode = (error) => {
  const candidates = [
    error?.status,
    error?.statusCode,
    error?.response?.status,
    error?.cause?.status,
    error?.cause?.statusCode,
    error?.cause?.response?.status,
  ]

  for (const value of candidates) {
    const parsed = Number(value)
    if (Number.isInteger(parsed) && parsed >= 400 && parsed < 600) {
      return parsed
    }
  }

  const message = error instanceof Error ? error.message : String(error || '')
  const statusMatch = message.match(/(?:^|\b)(4\d{2}|5\d{2})(?:\b|$)/)
  if (statusMatch?.[1]) {
    return Number(statusMatch[1])
  }

  return null
}

const extractProviderErrorEvidence = (error) => {
  const stack = [
    error,
    error?.error,
    error?.response?.data,
    error?.response?.data?.error,
    error?.cause,
    error?.cause?.error,
    error?.cause?.response?.data,
    error?.cause?.response?.data?.error,
  ]

  const messages = new Set()
  const codes = new Set()
  const types = new Set()

  for (const candidate of stack) {
    if (!candidate) {
      continue
    }

    if (typeof candidate === 'string') {
      messages.add(candidate)
      continue
    }

    if (typeof candidate !== 'object') {
      continue
    }

    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      messages.add(candidate.message.trim())
    }
    if (typeof candidate.error === 'string' && candidate.error.trim()) {
      messages.add(candidate.error.trim())
    }
    if (typeof candidate.code === 'string' && candidate.code.trim()) {
      codes.add(candidate.code.trim().toLowerCase())
    }
    if (typeof candidate.type === 'string' && candidate.type.trim()) {
      types.add(candidate.type.trim().toLowerCase())
    }
  }

  const combinedMessage = Array.from(messages).join(' | ')
  return {
    combinedMessage,
    normalizedMessage: combinedMessage.toLowerCase(),
    codes: Array.from(codes),
    types: Array.from(types),
  }
}

const classifyProviderFailure = (error) => {
  const message = error instanceof Error ? error.message : String(error || 'provider error')
  const evidence = extractProviderErrorEvidence(error)
  const normalized = evidence.normalizedMessage || message.toLowerCase()
  const statusCode = extractProviderStatusCode(error)
  const hasCode = (...values) =>
    values.some(
      (value) =>
        evidence.codes.includes(String(value).toLowerCase()) ||
        evidence.types.includes(String(value).toLowerCase()),
    )

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    hasCode('invalid_api_key', 'authentication_error', 'invalid_request_error') ||
    normalized.includes('invalid api key') ||
    normalized.includes('incorrect api key') ||
    normalized.includes('authentication') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden')
  ) {
    return {
      reason: 'provider_auth_failed',
      statusCode,
      detail: 'Fallo de autenticación/autorización contra el proveedor.',
    }
  }

  if (
    hasCode(
      'billing_hard_limit_reached',
      'billing_limit_reached',
      'account_deactivated',
      'insufficient_quota',
    ) ||
    normalized.includes('billing hard limit') ||
    normalized.includes('billing limit reached') ||
    normalized.includes('credit balance') ||
    normalized.includes('account deactivated') ||
    normalized.includes('saldo insuficiente') ||
    normalized.includes('cuota agotada') ||
    normalized.includes('exceeded your current quota') ||
    normalized.includes('billing details') ||
    normalized.includes('monthly usage limit') ||
    normalized.includes('consumed all your credits')
  ) {
    return {
      reason: 'provider_quota_exceeded',
      statusCode,
      detail: 'La cuota o el crédito disponible del proveedor está agotado.',
    }
  }

  if (
    statusCode === 429 ||
    hasCode('rate_limit_exceeded', 'requests_per_minute', 'tokens_per_minute') ||
    normalized.includes('rate limit') ||
    normalized.includes('too many requests') ||
    normalized.includes('requests per min') ||
    normalized.includes('tokens per min') ||
    normalized.includes('retry after')
  ) {
    return {
      reason: 'provider_rate_limited',
      statusCode,
      detail: 'El proveedor rechazó la solicitud por límite temporal de tasa o concurrencia.',
    }
  }

  if (
    normalized.includes('context length') ||
    normalized.includes('maximum context length') ||
    normalized.includes('too many tokens') ||
    normalized.includes('prompt is too long') ||
    normalized.includes('maximum number of tokens')
  ) {
    return {
      reason: 'provider_context_limit',
      statusCode,
      detail: 'La solicitud excedió el contexto o la cantidad máxima de tokens permitida por el modelo.',
    }
  }

  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('etimedout') ||
    normalized.includes('aborterror') ||
    normalized.includes('socket hang up')
  ) {
    return {
      reason: 'provider_timeout',
      statusCode,
      detail: 'La llamada al proveedor expiró antes de completarse.',
    }
  }

  if (
    statusCode === 400 ||
    statusCode === 422 ||
    normalized.includes('invalid_request_error') ||
    normalized.includes('bad request') ||
    normalized.includes('malformed')
  ) {
    return {
      reason: 'provider_bad_request',
      statusCode,
      detail: 'El proveedor rechazó la solicitud por formato o parámetros inválidos.',
    }
  }

  if (
    [500, 502, 503, 504].includes(statusCode) ||
    normalized.includes('service unavailable') ||
    normalized.includes('bad gateway') ||
    normalized.includes('gateway timeout') ||
    normalized.includes('internal server error') ||
    normalized.includes('temporarily unavailable')
  ) {
    return {
      reason: 'provider_unavailable',
      statusCode,
      detail: 'El proveedor estuvo temporalmente no disponible.',
    }
  }

  return {
    reason: 'provider_error',
    statusCode,
    detail: 'El proveedor devolvió un error no clasificado con suficiente precisión.',
  }
}

const deriveIntentKey = (role, input, actionIntent, tenantRuntimePolicy = null) => {
  if (actionIntent?.key) {
    return actionIntent.key
  }

  const normalized = normalizeText(input)

  if (isAdminConversationalRole(role)) {
    if (looksLikeAdminCapabilitiesRequest(normalized)) {
      return 'admin.capabilities'
    }
    if (looksLikeLightConversation(normalized)) {
      return 'admin.light'
    }
    if (hasStructuredCatalogSignal(normalized, tenantRuntimePolicy)) {
      return STRUCTURED_CATALOG_PARSE_INTENT
    }
    if (/(cliente|correo|telefono|direccion|dirección)/.test(normalized)) {
      return 'customers.manage'
    }
    if (/(presupuesto|cotizacion|cotizacion|quote)/.test(normalized)) {
      return 'quotes.manage'
    }
    if (/(pedido|orden)/.test(normalized)) {
      return 'orders.manage'
    }
    if (/(pago|cobro|transferencia)/.test(normalized)) {
      return 'payments.manage'
    }
    if (/(producto|categoria|categor[aí]a|stock)/.test(normalized)) {
      return 'catalog.manage'
    }
    return 'admin.other'
  }
  return 'customer.other'
}

const buildTaskSummary = (intentKey, turns = [], input = '', quoteContext = null) => {
  const recentTurns = filterReasoningRelevantTurns(turns)
    .slice(-4)
    .map((turn) => `${turn.role}: ${String(turn.text || '').trim()}`)
    .filter(Boolean)

  const currentInput = String(input || '').trim()
  const parts = [`intención=${intentKey}`]
  const measurementLabel =
    quoteContext?.measurements?.displayLabel ||
    quoteContext?.measurements?.confirmationLabel ||
    null
  if (recentTurns.length) {
    parts.push(`contexto_reciente=${recentTurns.join(' | ')}`)
  }
  if (measurementLabel) {
    parts.push(`medidas=${measurementLabel}`)
  }
  if (quoteContext?.quantity?.total) {
    parts.push(`cantidad=${quoteContext.quantity.total}`)
  }
  if (quoteContext?.capturedAttributes && typeof quoteContext.capturedAttributes === 'object') {
    for (const [key, entry] of Object.entries(quoteContext.capturedAttributes)) {
      if (
        key === 'measurements' ||
        key === 'quantity' ||
        !entry ||
        typeof entry !== 'object'
      ) {
        continue
      }
      const value =
        typeof entry.label === 'string' && entry.label.trim()
          ? entry.label.trim()
          : typeof entry.value === 'string' && entry.value.trim()
            ? entry.value.trim()
            : null
      if (value) {
        parts.push(`${key}=${value}`)
      }
    }
  }
  if (currentInput) {
    parts.push(`consulta_actual=${currentInput}`)
  }
  return parts.join(' ; ')
}

const sanitizeQuoteContextForAudit = (quoteContext = null) => {
  if (!quoteContext || typeof quoteContext !== 'object') {
    return null
  }

  const sanitizeAttribute = (entry) =>
    entry && typeof entry === 'object'
      ? {
          key: typeof entry.key === 'string' ? entry.key : null,
          label: typeof entry.label === 'string' ? entry.label : null,
          required: entry.required !== false,
          captureKind:
            typeof entry.captureKind === 'string' ? entry.captureKind : null,
          subjectPrefix:
            typeof entry.subjectPrefix === 'string' ? entry.subjectPrefix : null,
        }
      : null

  const sanitizeCapturedAttribute = (entry) =>
    entry && typeof entry === 'object'
      ? {
          value:
            typeof entry.value === 'string' || typeof entry.value === 'number'
              ? entry.value
              : entry.value &&
                  typeof entry.value === 'object' &&
                  !Array.isArray(entry.value)
                ? entry.value
                : null,
          label: typeof entry.label === 'string' ? entry.label : null,
          source: typeof entry.source === 'string' ? entry.source : null,
        }
      : null

  return {
    requiresMeasurements: Boolean(quoteContext.requiresMeasurements),
    familyLabel:
      typeof quoteContext.familyLabel === 'string' ? quoteContext.familyLabel : null,
    topicLabel:
      typeof quoteContext.topicLabel === 'string' ? quoteContext.topicLabel : null,
    profileKey:
      typeof quoteContext.profileKey === 'string' ? quoteContext.profileKey : null,
    profileLabel:
      typeof quoteContext.profileLabel === 'string' ? quoteContext.profileLabel : null,
    missingFields: Array.isArray(quoteContext.missingFields)
      ? quoteContext.missingFields.filter((entry) => typeof entry === 'string')
      : [],
    requiredFields: Array.isArray(quoteContext.requiredFields)
      ? quoteContext.requiredFields.filter((entry) => typeof entry === 'string')
      : [],
    requiredAttributes: Array.isArray(quoteContext.requiredAttributes)
      ? quoteContext.requiredAttributes
          .map(sanitizeAttribute)
          .filter(Boolean)
      : [],
    profileAttributes: Array.isArray(quoteContext.profileAttributes)
      ? quoteContext.profileAttributes
          .map(sanitizeAttribute)
          .filter(Boolean)
      : [],
    missingAttributes: Array.isArray(quoteContext.missingAttributes)
      ? quoteContext.missingAttributes
          .map(sanitizeAttribute)
          .filter(Boolean)
      : [],
    completionStatus:
      typeof quoteContext.completionStatus === 'string'
        ? quoteContext.completionStatus
        : null,
    closureMode:
      typeof quoteContext.closureMode === 'string' ? quoteContext.closureMode : null,
    pricingStrategy:
      typeof quoteContext.pricingStrategy === 'string'
        ? quoteContext.pricingStrategy
        : null,
    rawPricingStrategy:
      typeof quoteContext.rawPricingStrategy === 'string'
        ? quoteContext.rawPricingStrategy
        : null,
    mixedPricingStrategies: Boolean(quoteContext.mixedPricingStrategies),
    mentionedPricingStrategies: Array.isArray(quoteContext.mentionedPricingStrategies)
      ? quoteContext.mentionedPricingStrategies.filter((entry) => typeof entry === 'string')
      : [],
    quantity:
      quoteContext.quantity && typeof quoteContext.quantity === 'object'
        ? {
            total:
              typeof quoteContext.quantity.total === 'number'
                ? quoteContext.quantity.total
                : null,
            source:
              typeof quoteContext.quantity.source === 'string'
                ? quoteContext.quantity.source
                : null,
          }
        : null,
    measurements:
      quoteContext.measurements && typeof quoteContext.measurements === 'object'
        ? {
            widthMm:
              typeof quoteContext.measurements.widthMm === 'number'
                ? quoteContext.measurements.widthMm
                : null,
            heightMm:
              typeof quoteContext.measurements.heightMm === 'number'
                ? quoteContext.measurements.heightMm
                : null,
            displayUnit:
              typeof quoteContext.measurements.displayUnit === 'string'
                ? quoteContext.measurements.displayUnit
                : null,
            displayLabel:
              typeof quoteContext.measurements.displayLabel === 'string'
                ? quoteContext.measurements.displayLabel
                : null,
            confirmationLabel:
              typeof quoteContext.measurements.confirmationLabel === 'string'
                ? quoteContext.measurements.confirmationLabel
                : null,
          }
        : null,
    measurementItems: Array.isArray(quoteContext.measurementItems)
      ? quoteContext.measurementItems
          .filter((entry) => entry && typeof entry === 'object')
          .map((entry) => ({
            widthMm: typeof entry.widthMm === 'number' ? entry.widthMm : null,
            heightMm: typeof entry.heightMm === 'number' ? entry.heightMm : null,
            displayUnit:
              typeof entry.displayUnit === 'string' ? entry.displayUnit : null,
            displayLabel:
              typeof entry.displayLabel === 'string' ? entry.displayLabel : null,
            quantity: typeof entry.quantity === 'number' ? entry.quantity : null,
          }))
      : [],
    measurementCarrierTerms: Array.isArray(quoteContext.measurementCarrierTerms)
      ? quoteContext.measurementCarrierTerms.filter((entry) => typeof entry === 'string')
      : [],
    capturedAttributes:
      quoteContext.capturedAttributes && typeof quoteContext.capturedAttributes === 'object'
        ? Object.fromEntries(
            Object.entries(quoteContext.capturedAttributes)
              .map(([key, value]) => [key, sanitizeCapturedAttribute(value)])
              .filter(([, value]) => Boolean(value)),
          )
        : {},
  }
}

const sanitizeScheduleContextForAudit = (scheduleContext = null) => {
  if (!scheduleContext || typeof scheduleContext !== 'object') {
    return null
  }

  return {
    title: typeof scheduleContext.title === 'string' ? scheduleContext.title : null,
    reason: typeof scheduleContext.reason === 'string' ? scheduleContext.reason : null,
    purpose:
      typeof scheduleContext.purpose === 'string' ? scheduleContext.purpose : null,
    completionStatus:
      typeof scheduleContext.completionStatus === 'string'
        ? scheduleContext.completionStatus
        : null,
    startAt: typeof scheduleContext.startAt === 'string' ? scheduleContext.startAt : null,
    endAt: typeof scheduleContext.endAt === 'string' ? scheduleContext.endAt : null,
    address:
      typeof scheduleContext.address === 'string' ? scheduleContext.address : null,
    contactName:
      typeof scheduleContext.contactName === 'string'
        ? scheduleContext.contactName
        : null,
    contactPhone:
      typeof scheduleContext.contactPhone === 'string'
        ? scheduleContext.contactPhone
        : null,
    contactEmail:
      typeof scheduleContext.contactEmail === 'string'
        ? scheduleContext.contactEmail
        : null,
    missingFields: Array.isArray(scheduleContext.missingFields)
      ? scheduleContext.missingFields.filter((entry) => typeof entry === 'string')
      : [],
    date:
      scheduleContext.date && typeof scheduleContext.date === 'object'
        ? {
            dateLabel:
              typeof scheduleContext.date.dateLabel === 'string'
                ? scheduleContext.date.dateLabel
                : null,
            exact: Boolean(scheduleContext.date.exact),
          }
        : null,
    time:
      scheduleContext.time && typeof scheduleContext.time === 'object'
        ? {
            timeLabel:
              typeof scheduleContext.time.timeLabel === 'string'
                ? scheduleContext.time.timeLabel
                : null,
            exact: Boolean(scheduleContext.time.exact),
          }
        : null,
  }
}

const sanitizeSupportContextForAudit = (supportContext = null) => {
  if (!supportContext || typeof supportContext !== 'object') {
    return null
  }

  return {
    productType:
      typeof supportContext.productType === 'string' ? supportContext.productType : null,
    issueSummary:
      typeof supportContext.issueSummary === 'string' ? supportContext.issueSummary : null,
    issueKind:
      typeof supportContext.issueKind === 'string' ? supportContext.issueKind : null,
    wantsVisit: Boolean(supportContext.wantsVisit),
    address:
      typeof supportContext.address === 'string' ? supportContext.address : null,
    contactPhone:
      typeof supportContext.contactPhone === 'string' ? supportContext.contactPhone : null,
    contactEmail:
      typeof supportContext.contactEmail === 'string' ? supportContext.contactEmail : null,
    preferredDate:
      supportContext.preferredDate && typeof supportContext.preferredDate === 'object'
        ? {
            dateLabel:
              typeof supportContext.preferredDate.dateLabel === 'string'
                ? supportContext.preferredDate.dateLabel
                : null,
            exact: Boolean(supportContext.preferredDate.exact),
          }
        : null,
    preferredTime:
      supportContext.preferredTime && typeof supportContext.preferredTime === 'object'
        ? {
            timeLabel:
              typeof supportContext.preferredTime.timeLabel === 'string'
                ? supportContext.preferredTime.timeLabel
                : null,
            exact: Boolean(supportContext.preferredTime.exact),
          }
        : null,
    missingFields: Array.isArray(supportContext.missingFields)
      ? supportContext.missingFields.filter((entry) => typeof entry === 'string')
      : [],
    stage: typeof supportContext.stage === 'string' ? supportContext.stage : null,
    completionStatus:
      typeof supportContext.completionStatus === 'string'
        ? supportContext.completionStatus
        : null,
    existingInstallation: Boolean(supportContext.existingInstallation),
  }
}

const sanitizeConversationContextForAudit = (conversationContext = null) => {
  if (!conversationContext || typeof conversationContext !== 'object') {
    return null
  }

  const resolutionReadiness =
    conversationContext?.resolutionReadiness &&
    typeof conversationContext.resolutionReadiness === 'object'
      ? conversationContext.resolutionReadiness
      : null

  return {
    mode: typeof conversationContext.mode === 'string' ? conversationContext.mode : null,
    activeDomain:
      typeof conversationContext.activeDomain === 'string'
        ? conversationContext.activeDomain
        : null,
    responseStrategy:
      typeof conversationContext.responseStrategy === 'string'
        ? conversationContext.responseStrategy
        : null,
    nextUsefulField:
      typeof conversationContext.nextUsefulField === 'string'
        ? conversationContext.nextUsefulField
        : null,
    waitForMore: Boolean(conversationContext.waitForMore),
    waitForMoreReasons: Array.isArray(conversationContext.waitForMoreReasons)
      ? conversationContext.waitForMoreReasons
          .filter((entry) => typeof entry === 'string')
          .slice(0, 8)
      : [],
    topicLabel:
      typeof conversationContext.topicLabel === 'string'
        ? conversationContext.topicLabel
        : null,
    userGoal:
      typeof conversationContext.userGoal === 'string'
        ? conversationContext.userGoal
        : null,
    confidence:
      typeof conversationContext.confidence === 'number'
        ? conversationContext.confidence
        : null,
    followUpDetected: Boolean(conversationContext.followUpDetected),
    quoteStage:
      typeof conversationContext.quoteStage === 'string'
        ? conversationContext.quoteStage
        : null,
    quoteActionReady: Boolean(conversationContext.quoteActionReady),
    quoteInformationFirst: Boolean(conversationContext.quoteInformationFirst),
    threadKey:
      typeof conversationContext.threadKey === 'string'
        ? conversationContext.threadKey
        : null,
    knownFacts:
      conversationContext.knownFacts &&
      typeof conversationContext.knownFacts === 'object' &&
      !Array.isArray(conversationContext.knownFacts)
        ? conversationContext.knownFacts
        : {},
    resolutionReadiness: resolutionReadiness
      ? {
          lane:
            typeof resolutionReadiness.lane === 'string'
              ? resolutionReadiness.lane
              : null,
          turnIntent:
            typeof resolutionReadiness.turnIntent === 'string'
              ? resolutionReadiness.turnIntent
              : null,
          waitForMore: Boolean(resolutionReadiness.waitForMore),
          waitForMoreReasons: Array.isArray(resolutionReadiness.waitForMoreReasons)
            ? resolutionReadiness.waitForMoreReasons
                .filter((entry) => typeof entry === 'string')
                .slice(0, 8)
            : [],
          missingFields: Array.isArray(resolutionReadiness.missingFields)
            ? resolutionReadiness.missingFields
                .filter((entry) => typeof entry === 'string')
                .slice(0, 8)
            : [],
          nextUsefulField:
            typeof resolutionReadiness.nextUsefulField === 'string'
              ? resolutionReadiness.nextUsefulField
              : null,
          answerMode:
            typeof resolutionReadiness.answerMode === 'string'
              ? resolutionReadiness.answerMode
              : null,
          sideQuestionSubtype:
            typeof resolutionReadiness.sideQuestionSubtype === 'string'
              ? resolutionReadiness.sideQuestionSubtype
              : null,
          threadKey:
            typeof resolutionReadiness.threadKey === 'string'
              ? resolutionReadiness.threadKey
              : null,
          activeThreadId:
            typeof resolutionReadiness.activeThreadId === 'string'
              ? resolutionReadiness.activeThreadId
              : null,
          activeIntent:
            typeof resolutionReadiness.activeIntent === 'string'
              ? resolutionReadiness.activeIntent
              : null,
        }
      : null,
    conversationState: sanitizeConversationStateForAudit(
      conversationContext?.conversationState || null,
    ),
  }
}

const sanitizeConversationStateForAudit = (conversationState = null) => {
  if (!conversationState || typeof conversationState !== 'object') {
    return null
  }

  const sanitizeSlot = (entry, key) => {
    if (!entry || typeof entry !== 'object') {
      return key === 'quantity'
        ? { value: null }
        : key === 'address'
          ? { value: null, source: null }
          : { value: null }
    }

    return key === 'quantity'
      ? {
          value:
            typeof entry.value === 'number' && Number.isFinite(entry.value)
              ? entry.value
              : null,
        }
      : key === 'address'
        ? {
            value:
              typeof entry.value === 'string' && entry.value.trim()
                ? entry.value
                : null,
            source:
              typeof entry.source === 'string' && entry.source.trim()
                ? entry.source
                : null,
          }
        : {
            value:
              typeof entry.value === 'string' && entry.value.trim()
                ? entry.value
                : null,
          }
  }

  return {
    lane:
      typeof conversationState.lane === 'string' ? conversationState.lane : null,
    intent:
      conversationState.intent && typeof conversationState.intent === 'object'
        ? {
            key:
              typeof conversationState.intent.key === 'string'
                ? conversationState.intent.key
                : null,
            confidence:
              typeof conversationState.intent.confidence === 'number'
                ? conversationState.intent.confidence
                : null,
          }
        : null,
    slots:
      conversationState.slots && typeof conversationState.slots === 'object'
        ? {
            address: sanitizeSlot(conversationState.slots.address, 'address'),
            date: sanitizeSlot(conversationState.slots.date, 'date'),
            time: sanitizeSlot(conversationState.slots.time, 'time'),
            product: sanitizeSlot(conversationState.slots.product, 'product'),
            dimensions: sanitizeSlot(conversationState.slots.dimensions, 'dimensions'),
            quantity: sanitizeSlot(conversationState.slots.quantity, 'quantity'),
          }
        : null,
    slotStatus:
      conversationState.slotStatus && typeof conversationState.slotStatus === 'object'
        ? {
            missing: Array.isArray(conversationState.slotStatus.missing)
              ? conversationState.slotStatus.missing.filter(
                  (entry) => typeof entry === 'string',
                )
              : [],
            completed: Array.isArray(conversationState.slotStatus.completed)
              ? conversationState.slotStatus.completed.filter(
                  (entry) => typeof entry === 'string',
                )
              : [],
          }
        : null,
    tenant:
      conversationState.tenant && typeof conversationState.tenant === 'object'
        ? {
            slots:
              conversationState.tenant.slots &&
              typeof conversationState.tenant.slots === 'object'
                ? Object.fromEntries(
                    Object.entries(conversationState.tenant.slots)
                      .filter(([key]) => typeof key === 'string' && key.trim())
                      .map(([key, value]) => [
                        key,
                        value && typeof value === 'object'
                          ? {
                              value:
                                typeof value.value === 'string' && value.value.trim()
                                  ? value.value
                                  : typeof value.value === 'number' &&
                                      Number.isFinite(value.value)
                                    ? value.value
                                    : null,
                              source:
                                typeof value.source === 'string' && value.source.trim()
                                  ? value.source
                                  : null,
                            }
                          : { value: null, source: null },
                      ]),
                  )
                : {},
            slotStatus:
              conversationState.tenant.slotStatus &&
              typeof conversationState.tenant.slotStatus === 'object'
                ? {
                    missing: Array.isArray(conversationState.tenant.slotStatus.missing)
                      ? conversationState.tenant.slotStatus.missing.filter(
                          (entry) => typeof entry === 'string',
                        )
                      : [],
                    completed: Array.isArray(conversationState.tenant.slotStatus.completed)
                      ? conversationState.tenant.slotStatus.completed.filter(
                          (entry) => typeof entry === 'string',
                        )
                      : [],
                  }
                : null,
          }
        : null,
    normalization:
      conversationState.normalization &&
      typeof conversationState.normalization === 'object'
        ? {
            slotKeys: Array.isArray(conversationState.normalization.slotKeys)
              ? conversationState.normalization.slotKeys.filter(
                  (entry) => typeof entry === 'string',
                )
              : [],
            tenantSlots: Array.isArray(conversationState.normalization.tenantSlots)
              ? conversationState.normalization.tenantSlots.filter(
                  (entry) => typeof entry === 'string',
                )
              : [],
            fieldToSlotKey:
              conversationState.normalization.fieldToSlotKey &&
              typeof conversationState.normalization.fieldToSlotKey === 'object'
                ? Object.fromEntries(
                    Object.entries(conversationState.normalization.fieldToSlotKey).filter(
                      ([field, slotKey]) =>
                        typeof field === 'string' &&
                        field.trim() &&
                        typeof slotKey === 'string' &&
                        slotKey.trim(),
                    ),
                  )
                : {},
          }
        : null,
    lastAskedSlot:
      typeof conversationState.lastAskedSlot === 'string'
        ? conversationState.lastAskedSlot
        : null,
    context:
      conversationState.context && typeof conversationState.context === 'object'
        ? {
            lastUserMessage:
              typeof conversationState.context.lastUserMessage === 'string'
                ? conversationState.context.lastUserMessage
                : null,
            lastBotMessage:
              typeof conversationState.context.lastBotMessage === 'string'
                ? conversationState.context.lastBotMessage
                : null,
            conversationStage:
              typeof conversationState.context.conversationStage === 'string'
                ? conversationState.context.conversationStage
                : null,
          }
        : null,
  }
}

const sanitizeKnowledgeSourcesForAudit = (items = []) =>
  Array.isArray(items)
    ? items
        .filter((entry) => entry && typeof entry === 'object')
        .slice(0, 8)
        .map((entry) => ({
          id: typeof entry.id === 'string' ? entry.id : null,
          documentId:
            typeof entry.documentId === 'string' ? entry.documentId : null,
          title: typeof entry.title === 'string' ? entry.title : null,
          sourceType:
            typeof entry.sourceType === 'string' ? entry.sourceType : null,
          scope: typeof entry.scope === 'string' ? entry.scope : null,
          retrievalMode:
            typeof entry.retrievalMode === 'string'
              ? entry.retrievalMode
              : null,
          score:
            typeof entry.score === 'number' && Number.isFinite(entry.score)
              ? Number(entry.score.toFixed(4))
              : null,
          lexicalScore:
            typeof entry.lexicalScore === 'number' &&
            Number.isFinite(entry.lexicalScore)
              ? Number(entry.lexicalScore.toFixed(4))
              : null,
          vectorScore:
            typeof entry.vectorScore === 'number' &&
            Number.isFinite(entry.vectorScore)
              ? Number(entry.vectorScore.toFixed(4))
              : null,
          snippet:
            typeof entry.snippet === 'string'
              ? entry.snippet.slice(0, 280)
              : null,
          embedding:
            entry.embedding && typeof entry.embedding === 'object'
              ? {
                  provider:
                    typeof entry.embedding.provider === 'string'
                      ? entry.embedding.provider
                      : null,
                  mode:
                    typeof entry.embedding.mode === 'string'
                      ? entry.embedding.mode
                      : null,
                  model:
                    typeof entry.embedding.model === 'string'
                      ? entry.embedding.model
                      : null,
                  dimensions:
                    typeof entry.embedding.dimensions === 'number'
                      ? entry.embedding.dimensions
                      : null,
                }
              : null,
          chunk:
            entry.chunk && typeof entry.chunk === 'object'
              ? {
                  id:
                    typeof entry.chunk.id === 'string' ? entry.chunk.id : null,
                  index:
                    typeof entry.chunk.index === 'number'
                      ? entry.chunk.index
                      : null,
                  charStart:
                    typeof entry.chunk.charStart === 'number'
                      ? entry.chunk.charStart
                      : null,
                  charEnd:
                    typeof entry.chunk.charEnd === 'number'
                      ? entry.chunk.charEnd
                      : null,
                }
              : null,
        }))
    : []

const sanitizeEmbeddingModeForAudit = (embeddingMode = null) => {
  if (!embeddingMode || typeof embeddingMode !== 'object') {
    return null
  }

  return {
    provider:
      typeof embeddingMode.provider === 'string' ? embeddingMode.provider : null,
    mode: typeof embeddingMode.mode === 'string' ? embeddingMode.mode : null,
    model: typeof embeddingMode.model === 'string' ? embeddingMode.model : null,
    dimensions:
      typeof embeddingMode.dimensions === 'number' ? embeddingMode.dimensions : null,
  }
}

const resolveKnowledgeModeForAudit = ({
  context = null,
  previousAuditPayload = null,
  knowledgeDisabled = false,
}) => {
  const candidate =
    typeof context?.knowledgeMode === 'string'
      ? context.knowledgeMode
      : typeof previousAuditPayload?.decisionTrace?.knowledge?.mode === 'string'
        ? previousAuditPayload.decisionTrace.knowledge.mode
        : null

  if (candidate === 'full' || candidate === 'retrieval_disabled' || candidate === 'retrieval_only') {
    return candidate
  }

  return knowledgeDisabled ? 'retrieval_disabled' : 'full'
}

const tokenizeKnowledgeSignals = (value = '') =>
  String(value || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4)

const inferKnowledgeSpecificitySignals = ({
  response = null,
  context = null,
  previousAuditPayload = null,
}) => {
  const responseText =
    typeof response?.finalUserText === 'string'
      ? response.finalUserText
      : typeof response?.text === 'string'
        ? response.text
        : ''
  const responseLower = responseText.toLowerCase()
  const topicLabel =
    typeof context?.turnInterpretation?.topic?.label === 'string'
      ? context.turnInterpretation.topic.label
      : typeof context?.turnInterpretation?.quoteContext?.topicLabel === 'string'
        ? context.turnInterpretation.quoteContext.topicLabel
        : typeof previousAuditPayload?.turnInterpretation?.topic?.label === 'string'
          ? previousAuditPayload.turnInterpretation.topic.label
          : typeof previousAuditPayload?.turnInterpretation?.quoteContext?.topicLabel ===
                'string'
            ? previousAuditPayload.turnInterpretation.quoteContext.topicLabel
            : ''
  const keywordTokens = Array.isArray(context?.matchedKeywords)
    ? context.matchedKeywords
    : Array.isArray(previousAuditPayload?.matchedKeywords)
      ? previousAuditPayload.matchedKeywords
      : []
  const signalTerms = Array.from(
    new Set([
      ...tokenizeKnowledgeSignals(topicLabel),
      ...keywordTokens
        .filter((entry) => typeof entry === 'string')
        .flatMap((entry) => tokenizeKnowledgeSignals(entry)),
    ]),
  )
  const tenantRuntimePolicy =
    context?.tenantRuntimePolicy && typeof context.tenantRuntimePolicy === 'object'
      ? context.tenantRuntimePolicy
      : null
  const matchedTerms = signalTerms
    .filter((token) => responseLower.includes(token))
    .slice(0, 12)
  const hasCatalogSignal = hasCatalogVocabularySignal(responseText, tenantRuntimePolicy)
  const brandSignals = getTenantBrandTokens(tenantRuntimePolicy).filter((token) =>
    responseLower.includes(token),
  )
  const hasMeasurementSignal = /\b\d+(?:[.,]\d+)?\s*(?:x|×)\s*\d+(?:[.,]\d+)?\b/u.test(
    responseText,
  )
  const signals = [
    ...matchedTerms,
    ...brandSignals,
    ...(hasCatalogSignal ? ['catalog_term_detected'] : []),
    ...(hasMeasurementSignal ? ['measurement_pattern_detected'] : []),
  ]

  return {
    domainSpecific: signals.length > 0,
    signals,
  }
}

const sanitizeOrchestratorDecisionForAudit = (decision = null) => {
  if (!decision || typeof decision !== 'object') {
    return null
  }

  return {
    nextStep:
      typeof decision.nextStep === 'string' ? decision.nextStep : null,
    shouldUseDeterministicDraft: Boolean(decision.shouldUseDeterministicDraft),
    shouldGenerateLanguage: Boolean(decision.shouldGenerateLanguage),
    reason: typeof decision.reason === 'string' ? decision.reason : null,
    nextUsefulField:
      typeof decision.nextUsefulField === 'string'
        ? decision.nextUsefulField
        : null,
    responseStrategy:
      typeof decision.responseStrategy === 'string'
        ? decision.responseStrategy
        : null,
    assistantSuggestion:
      decision.assistantSuggestion && typeof decision.assistantSuggestion === 'object'
        ? {
            action:
              typeof decision.assistantSuggestion.action === 'string'
                ? decision.assistantSuggestion.action
                : null,
            confidence:
              typeof decision.assistantSuggestion.confidence === 'number'
                ? decision.assistantSuggestion.confidence
                : null,
            reasoning:
              typeof decision.assistantSuggestion.reasoning === 'string'
                ? decision.assistantSuggestion.reasoning
                : null,
            missingFields: Array.isArray(decision.assistantSuggestion.missingFields)
              ? decision.assistantSuggestion.missingFields
                  .filter((entry) => typeof entry === 'string')
                  .slice(0, 8)
              : [],
            applied: Boolean(decision.assistantSuggestion.applied),
          }
        : null,
  }
}

const inferResponseModeForAudit = ({
  response = null,
  context = null,
  previousAuditPayload = null,
}) => {
  if (
    typeof context?.responseMode === 'string' &&
    ['deterministic', 'generative', 'hybrid'].includes(context.responseMode)
  ) {
    return context.responseMode
  }

  if (
    typeof previousAuditPayload?.responseMode === 'string' &&
    ['deterministic', 'generative', 'hybrid'].includes(previousAuditPayload.responseMode)
  ) {
    return previousAuditPayload.responseMode
  }

  const hasRewrite = response?.rewriteExchange && typeof response.rewriteExchange === 'object'
  const hasAiExchange = context?.aiExchange && typeof context.aiExchange === 'object'
  const deterministicApplied =
    context?.deterministicApplied === true ||
    response?.deterministicApplied === true ||
    Boolean(response?.debug?.deterministicApplied)

  if (deterministicApplied && (hasAiExchange || hasRewrite)) {
    return 'hybrid'
  }
  if (deterministicApplied) {
    return 'deterministic'
  }
  if (hasAiExchange || hasRewrite) {
    return 'generative'
  }
  return 'deterministic'
}

const inferResponseOriginForAudit = ({
  response = null,
  responseMode = 'deterministic',
  knowledgeGrounded = false,
  knowledgeRetrieved = false,
  fallbackReason = null,
}) => {
  if (typeof fallbackReason === 'string' && fallbackReason.trim()) {
    return 'fallback'
  }
  if (responseMode === 'deterministic' && !knowledgeGrounded && !knowledgeRetrieved) {
    return 'deterministic'
  }
  if (knowledgeGrounded && responseMode === 'hybrid') {
    return 'hybrid_grounded'
  }
  if (knowledgeGrounded) {
    return 'knowledge_grounded'
  }
  if (knowledgeRetrieved) {
    return 'knowledge_retrieved_only'
  }
  if (responseMode === 'generative' || responseMode === 'hybrid') {
    return 'model_only'
  }
  return 'deterministic'
}

const estimateModelKnowledgeScore = ({
  responseMode = 'deterministic',
  knowledgeGrounded = false,
  knowledgeRetrieved = false,
  specificitySignals = { domainSpecific: false, signals: [] },
  response = null,
}) => {
  const responseText =
    typeof response?.finalUserText === 'string'
      ? response.finalUserText
      : typeof response?.text === 'string'
        ? response.text
        : ''
  let score = 0

  if (!knowledgeGrounded && !knowledgeRetrieved) {
    score += 0.45
  }
  if (specificitySignals?.domainSpecific) {
    score += 0.25
  }
  if (Array.isArray(specificitySignals?.signals)) {
    score += Math.min(specificitySignals.signals.length, 4) * 0.07
  }
  if (responseMode === 'generative' || responseMode === 'hybrid') {
    score += 0.15
  }
  if (responseText.length >= 120) {
    score += 0.08
  }
  if (responseText.length >= 220) {
    score += 0.05
  }

  return Number(Math.max(0, Math.min(score, 1)).toFixed(4))
}

const buildDecisionTraceForAudit = ({
  response = null,
  context = null,
  previousAuditPayload = null,
  toolCalls = [],
  fallbackReason = null,
}) => {
  const responseMode = inferResponseModeForAudit({
    response,
    context,
    previousAuditPayload,
  })
  const explicitGrounding =
    response?.grounding && typeof response.grounding === 'object' ? response.grounding : {}
  const retrievalItems = Array.isArray(context?.retrievalItems)
    ? context.retrievalItems
    : Array.isArray(previousAuditPayload?.decisionTrace?.knowledge?.sources)
      ? previousAuditPayload.decisionTrace.knowledge.sources
      : []
  const sanitizedSources = sanitizeKnowledgeSourcesForAudit(
    Array.isArray(explicitGrounding?.sources) && explicitGrounding.sources.length > 0
      ? explicitGrounding.sources
      : retrievalItems,
  )
  const executedActions = Array.isArray(toolCalls)
    ? toolCalls
        .filter((entry) => entry?.status === 'executed' && entry?.name)
        .map((entry) => entry.name)
    : []
  const knowledgeDisabled = Boolean(
    context?.knowledgeDisabled ?? previousAuditPayload?.decisionTrace?.knowledge?.disabled,
  )
  const waitForMoreReasons = Array.isArray(
    context?.turnInterpretation?.conversationContext?.waitForMoreReasons,
  )
    ? context.turnInterpretation.conversationContext.waitForMoreReasons
    : Array.isArray(
          previousAuditPayload?.turnInterpretation?.conversationContext?.waitForMoreReasons,
        )
      ? previousAuditPayload.turnInterpretation.conversationContext.waitForMoreReasons
      : []
  const deterministicApplied =
    Boolean(context?.deterministicApplied) ||
    responseMode === 'deterministic' ||
    responseMode === 'hybrid'
  const actionEvaluated =
    typeof context?.actionKey === 'string'
      ? context.actionKey
      : typeof previousAuditPayload?.actionKey === 'string'
        ? previousAuditPayload.actionKey
        : null
  const orchestratorDecision = sanitizeOrchestratorDecisionForAudit(
    context?.orchestratorDecision ?? previousAuditPayload?.orchestratorDecision,
  )
  const knowledgeMode = resolveKnowledgeModeForAudit({
    context,
    previousAuditPayload,
    knowledgeDisabled,
  })
  const embeddingMode = sanitizeEmbeddingModeForAudit(
    context?.embeddingMode ??
      previousAuditPayload?.decisionTrace?.knowledge?.embeddingMode ??
      sanitizedSources.find((entry) => entry?.embedding)?.embedding ??
      null,
  )
  const retrievalMode =
    typeof context?.retrievalMode === 'string'
      ? context.retrievalMode
      : typeof previousAuditPayload?.decisionTrace?.knowledge?.retrievalMode === 'string'
        ? previousAuditPayload.decisionTrace.knowledge.retrievalMode
        : typeof sanitizedSources[0]?.retrievalMode === 'string'
          ? sanitizedSources[0].retrievalMode
          : null
  const chunkIds = sanitizedSources
    .map((entry) => entry?.chunk?.id)
    .filter((entry) => typeof entry === 'string')
  const knowledgeGrounded =
    typeof response?.grounding?.knowledgeGrounded === 'boolean'
      ? response.grounding.knowledgeGrounded
      : Boolean(response?.grounding?.grounded)
  const knowledgeRetrieved =
    typeof response?.grounding?.knowledgeRetrieved === 'boolean'
      ? response.grounding.knowledgeRetrieved
      : Array.isArray(context?.retrievalItems)
        ? context.retrievalItems.length > 0
        : sanitizedSources.length > 0
  const knowledgeUsed =
    typeof response?.grounding?.knowledgeUsed === 'boolean'
      ? response.grounding.knowledgeUsed
      : response?.grounding?.used === true
      ? true
      : knowledgeGrounded
  const usedFacts = normalizeGroundingFactList(response?.grounding?.usedFacts)
  const usedSourceIds = normalizeGroundingSourceIdList(response?.grounding?.usedSourceIds)
  const specificitySignals = inferKnowledgeSpecificitySignals({
    response,
    context,
    previousAuditPayload,
  })
  const modelKnowledgeScore = estimateModelKnowledgeScore({
    responseMode,
    knowledgeGrounded,
    knowledgeRetrieved,
    specificitySignals,
    response,
  })
  const possibleKnowledgeHallucination =
    !knowledgeRetrieved &&
    !knowledgeGrounded &&
    modelKnowledgeScore >= 0.7
  const modelKnowledgeLikely = modelKnowledgeScore >= 0.55
  const responseOrigin = inferResponseOriginForAudit({
    response,
    responseMode,
    knowledgeGrounded,
    knowledgeRetrieved,
    fallbackReason,
  })
  const providerTrace =
    context?.providerCallTrace && typeof context.providerCallTrace === 'object'
      ? context.providerCallTrace
      : previousAuditPayload?.decisionTrace?.provider &&
          typeof previousAuditPayload.decisionTrace.provider === 'object'
        ? previousAuditPayload.decisionTrace.provider
        : null
  const notExecutedReason = executedActions.length
    ? null
    : fallbackReason ||
      orchestratorDecision?.reason ||
      (knowledgeDisabled ? 'knowledge_disabled_for_debug' : null) ||
      (context?.blockedTools?.length ? 'blocked_tools' : null) ||
      (context?.turnInterpretation?.conversationContext?.waitForMore
        ? 'waiting_for_more_input'
        : null) ||
      null

  return {
    intent: {
      key:
        typeof context?.intentKey === 'string'
          ? context.intentKey
          : typeof previousAuditPayload?.intentKey === 'string'
            ? previousAuditPayload.intentKey
            : null,
      confidence:
        typeof context?.intentConfidence === 'number'
          ? context.intentConfidence
          : typeof previousAuditPayload?.intentConfidence === 'number'
            ? previousAuditPayload.intentConfidence
            : null,
      source:
        typeof context?.intentSource === 'string'
          ? context.intentSource
          : typeof previousAuditPayload?.intentSource === 'string'
            ? previousAuditPayload.intentSource
            : null,
      matchedKeywords: Array.isArray(context?.matchedKeywords)
        ? context.matchedKeywords.filter((entry) => typeof entry === 'string').slice(0, 12)
        : Array.isArray(previousAuditPayload?.decisionTrace?.intent?.matchedKeywords)
          ? previousAuditPayload.decisionTrace.intent.matchedKeywords
          : [],
      category:
        typeof context?.inboundCategory === 'string'
          ? context.inboundCategory
          : typeof previousAuditPayload?.decisionTrace?.intent?.category === 'string'
            ? previousAuditPayload.decisionTrace.intent.category
            : null,
    },
    patternsMatched: Array.from(
      new Set([
        ...(Array.isArray(context?.decisionPath) ? context.decisionPath : []),
        ...(Array.isArray(context?.matchedKeywords) ? context.matchedKeywords : []),
        ...(Array.isArray(previousAuditPayload?.decisionTrace?.patternsMatched)
          ? previousAuditPayload.decisionTrace.patternsMatched
          : []),
      ]),
    ).slice(0, 20),
    knowledge: {
      mode: knowledgeMode,
      modeReason:
        typeof context?.knowledgeModeReason === 'string'
          ? context.knowledgeModeReason
          : typeof previousAuditPayload?.decisionTrace?.knowledge?.modeReason === 'string'
            ? previousAuditPayload.decisionTrace.knowledge.modeReason
            : null,
      embeddingMode,
      queryEmbedding:
        context?.queryEmbedding && typeof context.queryEmbedding === 'object'
          ? {
              latencyMs:
                typeof context.queryEmbedding.latencyMs === 'number'
                  ? context.queryEmbedding.latencyMs
                  : null,
              cacheHit: context.queryEmbedding.cacheHit === true,
              providerError:
                typeof context.queryEmbedding.providerError === 'string'
                  ? context.queryEmbedding.providerError
                  : null,
            }
          : previousAuditPayload?.decisionTrace?.knowledge?.queryEmbedding ?? null,
      retrievalMode,
      responseContract:
        typeof context?.responseContract === 'string'
          ? context.responseContract
          : typeof previousAuditPayload?.decisionTrace?.knowledge?.responseContract === 'string'
            ? previousAuditPayload.decisionTrace.knowledge.responseContract
            : null,
      knowledgeNeed:
        typeof context?.knowledgeNeed === 'string'
          ? context.knowledgeNeed
          : typeof previousAuditPayload?.decisionTrace?.knowledge?.knowledgeNeed === 'string'
            ? previousAuditPayload.decisionTrace.knowledge.knowledgeNeed
            : null,
      retrievalSkippedByKnowledgeNeed:
        context?.retrievalSkippedByKnowledgeNeed === true ||
        previousAuditPayload?.decisionTrace?.knowledge?.retrievalSkippedByKnowledgeNeed === true,
      responseContractResolvedBeforeRetrieval:
        context?.responseContractResolvedBeforeRetrieval === true ||
        previousAuditPayload?.decisionTrace?.knowledge?.responseContractResolvedBeforeRetrieval ===
          true,
      disabled: knowledgeDisabled,
      used: knowledgeUsed,
      knowledgeUsed,
      grounded: knowledgeGrounded,
      retrieved: knowledgeRetrieved,
      retrievedOnly: knowledgeRetrieved && !knowledgeGrounded,
      sourceCount: sanitizedSources.length,
      chunkIds: Array.from(new Set(chunkIds)).slice(0, 12),
      sources: sanitizedSources,
      usedFacts,
      usedSourceIds,
      modelKnowledgeLikely,
      modelKnowledgeScore,
      possibleKnowledgeHallucination,
      domainSpecificSignals: specificitySignals.signals,
    },
    deterministic: {
      applied: deterministicApplied,
      responseMode,
      responseOrigin,
    },
    conversation: {
      mode:
        typeof context?.conversationMode?.mode === 'string'
          ? context.conversationMode.mode
          : typeof previousAuditPayload?.decisionTrace?.conversation?.mode === 'string'
            ? previousAuditPayload.decisionTrace.conversation.mode
            : null,
      responseStrategy:
        typeof context?.turnInterpretation?.conversationContext?.responseStrategy === 'string'
          ? context.turnInterpretation.conversationContext.responseStrategy
          : typeof previousAuditPayload?.turnInterpretation?.conversationContext
                ?.responseStrategy === 'string'
            ? previousAuditPayload.turnInterpretation.conversationContext.responseStrategy
            : null,
      waitForMore: Boolean(
        context?.turnInterpretation?.conversationContext?.waitForMore ||
          previousAuditPayload?.turnInterpretation?.conversationContext?.waitForMore,
      ),
      waitForMoreReasons,
      decisionSource:
        typeof context?.decisionSource === 'string'
          ? context.decisionSource
          : typeof previousAuditPayload?.decisionTrace?.conversation?.decisionSource ===
              'string'
            ? previousAuditPayload.decisionTrace.conversation.decisionSource
            : null,
    },
    provider: {
      callCount:
        typeof providerTrace?.count === 'number' ? providerTrace.count : 0,
      budget:
        typeof providerTrace?.budget === 'number' ? providerTrace.budget : 1,
      calls: Array.isArray(providerTrace?.calls) ? providerTrace.calls : [],
      blocked: Array.isArray(providerTrace?.blocked) ? providerTrace.blocked : [],
    },
    action: {
      evaluated: actionEvaluated,
      orchestratorNextStep: orchestratorDecision?.nextStep || null,
      executed: executedActions,
      notExecutedReason,
    },
  }
}

const sanitizeAiExchangeForAudit = (exchange = null) => {
  if (!exchange || typeof exchange !== 'object') {
    return null
  }

  const request = exchange.request && typeof exchange.request === 'object'
    ? exchange.request
    : null
  const response = exchange.response && typeof exchange.response === 'object'
    ? exchange.response
    : null

  return {
    request: request
      ? {
          mode:
            typeof request.mode === 'string' ? request.mode : null,
          processedInput:
            typeof request.processedInput === 'string'
              ? request.processedInput.slice(0, 400)
              : null,
          contextBlock:
            typeof request.contextBlock === 'string'
              ? request.contextBlock.slice(0, 4000)
              : null,
          taskSummary:
            typeof request.taskSummary === 'string'
              ? request.taskSummary.slice(0, 800)
              : null,
          currentTask:
            request.currentTask && typeof request.currentTask === 'object'
              ? request.currentTask
              : null,
          approvedDraft:
            typeof request.approvedDraft === 'string'
              ? request.approvedDraft.slice(0, 800)
              : null,
          approvedFacts: Array.isArray(request.approvedFacts)
            ? request.approvedFacts
                .map((entry) => String(entry || '').trim())
                .filter(Boolean)
                .slice(0, 12)
            : [],
          systemPrompt:
            typeof request.systemPrompt === 'string'
              ? request.systemPrompt.slice(0, 6000)
              : null,
          promptInput:
            typeof request.promptInput === 'string'
              ? request.promptInput.slice(0, 4000)
              : null,
          promptHistory: Array.isArray(request.promptHistory)
            ? request.promptHistory
                .map((entry) =>
                  entry && typeof entry === 'object'
                    ? {
                        role:
                          typeof entry.role === 'string' ? entry.role : null,
                        text:
                          typeof entry.text === 'string'
                            ? entry.text.slice(0, 400)
                            : null,
                      }
                    : null,
                )
                .filter(Boolean)
                .slice(0, 8)
            : [],
        }
      : null,
    response: response
      ? {
          source:
            typeof response.source === 'string' ? response.source : null,
          text:
            typeof response.text === 'string'
              ? response.text.slice(0, 4000)
              : null,
          toolCalls: Array.isArray(response.toolCalls)
            ? response.toolCalls.map((entry) => ({
                name:
                  typeof entry?.name === 'string' ? entry.name : null,
                status:
                  typeof entry?.status === 'string' ? entry.status : null,
              }))
            : [],
          error:
            typeof response.error === 'string' ? response.error : null,
        }
      : null,
  }
}

const sanitizeThreadForAudit = (thread = null) => {
  if (!thread || typeof thread !== 'object') {
    return null
  }

  return {
    key: typeof thread.key === 'string' ? thread.key : null,
    baseKey: typeof thread.baseKey === 'string' ? thread.baseKey : null,
    baseLabel: typeof thread.baseLabel === 'string' ? thread.baseLabel : null,
    baseType: typeof thread.baseType === 'string' ? thread.baseType : null,
    familyLabel:
      typeof thread.familyLabel === 'string' ? thread.familyLabel : null,
    displayLabel:
      typeof thread.displayLabel === 'string' ? thread.displayLabel : null,
    resolvedLabel:
      typeof thread.resolvedLabel === 'string' ? thread.resolvedLabel : null,
    variantLabels: Array.isArray(thread.variantLabels)
      ? thread.variantLabels.filter((entry) => typeof entry === 'string')
      : [],
    confidence:
      typeof thread.confidence === 'number' && Number.isFinite(thread.confidence)
        ? thread.confidence
        : null,
    source: typeof thread.source === 'string' ? thread.source : null,
  }
}

const sanitizeThreadResolutionForAudit = (threadResolution = null) => {
  if (!threadResolution || typeof threadResolution !== 'object') {
    return null
  }

  return {
    threads: Array.isArray(threadResolution.threads)
      ? threadResolution.threads.map(sanitizeThreadForAudit).filter(Boolean)
      : [],
    activeThreadKey:
      typeof threadResolution.activeThreadKey === 'string'
        ? threadResolution.activeThreadKey
        : null,
    activeThread: sanitizeThreadForAudit(threadResolution.activeThread),
    multiTopicDetected: Boolean(threadResolution.multiTopicDetected),
    requiresDisambiguation: Boolean(threadResolution.requiresDisambiguation),
    switchDetected: Boolean(threadResolution.switchDetected),
    measurementOnlyTurn: Boolean(threadResolution.measurementOnlyTurn),
    promptText:
      typeof threadResolution.promptText === 'string'
        ? threadResolution.promptText
        : null,
  }
}

const summarizeMessageElementsForAudit = (messageContext = null) => {
  const usedElements = Array.isArray(messageContext?.usedElements)
    ? messageContext.usedElements
    : []

  return usedElements.map((element) => {
    const previewSource =
      element?.text ||
      element?.extractedText ||
      element?.transcript ||
      element?.title ||
      null

    return {
      kind: typeof element?.kind === 'string' ? element.kind : null,
      source: typeof element?.source === 'string' ? element.source : null,
      label:
        element?.caption ||
        element?.title ||
        element?.assetId ||
        (typeof element?.kind === 'string' ? element.kind : 'elemento'),
      preview:
        typeof previewSource === 'string' && previewSource.trim()
          ? previewSource.trim().slice(0, 180)
          : null,
    }
  })
}

const buildMessageContextOrigin = (
  messageContext = null,
  referencedMessages = [],
  extraOrigins = [],
) => {
  const origin = []
  if (String(messageContext?.baseText || '').trim()) {
    origin.push('message_text')
  }
  if (Array.isArray(messageContext?.usedElementKinds)) {
    for (const kind of messageContext.usedElementKinds) {
      origin.push(`message_element:${kind}`)
    }
  }
  if (Array.isArray(referencedMessages) && referencedMessages.length) {
    origin.push('referenced_messages')
  }
  if (Array.isArray(extraOrigins) && extraOrigins.length) {
    origin.push(...extraOrigins)
  }
  return Array.from(new Set(origin))
}

const summarizeResults = (toolName, results = []) => {
  if (toolName === STRUCTURED_CATALOG_PARSE_TOOL) {
    return results?.summary
      ? `${STRUCTURED_CATALOG_PARSE_TOOL}: ${results.summary}`
      : `${STRUCTURED_CATALOG_PARSE_TOOL}: sin items detectados.`
  }

  if (toolName === STRUCTURED_CATALOG_QUOTE_TOOL) {
    return results?.summary
      ? `${STRUCTURED_CATALOG_QUOTE_TOOL}: ${results.summary}`
      : `${STRUCTURED_CATALOG_QUOTE_TOOL}: sin items listos para cotización.`
  }

  if (toolName === STRUCTURED_CATALOG_INSERT_TOOL) {
    return results?.summary
      ? `${STRUCTURED_CATALOG_INSERT_TOOL}: ${results.summary}`
      : `${STRUCTURED_CATALOG_INSERT_TOOL}: sin items listos para alta.`
  }

  if (!Array.isArray(results) || !results.length) {
    return `${toolName}: sin resultados.`
  }

  const preview = results
    .slice(0, 3)
    .map((item) => {
      switch (toolName) {
        case 'search_categories':
          return `categoria#${item.id} ${item.name}${item.parent?.name ? ` padre:${item.parent.name}` : ''}`
        case 'search_customers':
          return `cliente#${item.id} ${item.name}${item.email ? ` <${item.email}>` : ''}${item.phoneNumber ? ` tel:${item.phoneNumber}` : ''}`
        case 'search_orders':
        case 'search_quotes':
          return `${toolName === 'search_quotes' ? 'presupuesto' : 'pedido'}#${item.id} uuid:${item.uuid} cliente:${item.customer?.name ?? 'sin cliente'}${item.currency ? ` ${item.currency}` : ''}${item.grandTotal != null ? ` total:${item.grandTotal}` : ''}`
        case 'search_payments':
          return `pago#${item.id}${item.reference ? ` ref:${item.reference}` : ''}${item.currency ? ` ${item.currency}` : ''}${item.amount != null ? ` monto:${item.amount}` : ''}${item.order?.uuid ? ` pedido:${item.order.uuid}` : ''}`
        case 'search_products':
          return `producto#${item.id} ${item.name}${item.productCode ? ` código:${item.productCode}` : ''}${item.currency && item.amount != null ? ` ${item.currency} ${item.amount}` : ''}`
        default:
          return JSON.stringify(item)
      }
    })
    .join(' | ')

  return `${toolName}: ${preview}`
}

const summarizeMatchesForUser = (toolName, results = []) => {
  if (toolName === STRUCTURED_CATALOG_PARSE_TOOL) {
    return typeof results?.summary === 'string'
      ? `parseo estructurado de catálogo: ${results.summary}`
      : null
  }

  if (toolName === STRUCTURED_CATALOG_QUOTE_TOOL) {
    return typeof results?.summary === 'string'
      ? `borrador estructurado para cotización: ${results.summary}`
      : null
  }

  if (toolName === STRUCTURED_CATALOG_INSERT_TOOL) {
    return typeof results?.summary === 'string'
      ? `alta estructurada de catálogo: ${results.summary}`
      : null
  }

  if (!Array.isArray(results) || !results.length) {
    return null
  }

  const preview = results
    .slice(0, 2)
    .map((item) => {
      switch (toolName) {
        case 'search_categories':
          return `categoría #${item.id} ${item.name}${item.parent?.name ? ` (padre: ${item.parent.name})` : ''}`
        case 'search_customers':
          return `cliente #${item.id} ${item.name}${item.email ? ` <${item.email}>` : ''}`
        case 'search_orders':
          return `pedido #${item.id}${item.uuid ? ` (${item.uuid})` : ''}${item.customer?.name ? ` de ${item.customer.name}` : ''}`
        case 'search_quotes':
          return `presupuesto #${item.id}${item.uuid ? ` (${item.uuid})` : ''}${item.customer?.name ? ` de ${item.customer.name}` : ''}`
        case 'search_payments':
          return `pago #${item.id}${item.reference ? ` (${item.reference})` : ''}${item.order?.uuid ? ` pedido ${item.order.uuid}` : ''}`
        case 'search_products':
          return `producto #${item.id} ${item.name}${item.currency && item.amount != null ? ` ${item.currency} ${item.amount}` : ''}`
        default:
          return null
      }
    })
    .filter(Boolean)
    .join(', ')

  return preview || null
}

const deriveOperationalMatches = (operationalContext = null) => {
  const explicitMatches = Array.isArray(operationalContext?.matches)
    ? operationalContext.matches.filter(
        (entry) => typeof entry === 'string' && entry.trim().length > 0,
      )
    : []
  if (explicitMatches.length > 0) {
    return explicitMatches
  }

  const toolCalls = Array.isArray(operationalContext?.toolCalls)
    ? operationalContext.toolCalls
    : []

  return toolCalls
    .filter((entry) => {
      if (entry?.status !== 'executed') {
        return false
      }
      if (isStructuredCatalogToolName(entry.name)) {
        return Boolean(entry.result?.itemCount)
      }
      return Array.isArray(entry.result) && entry.result.length > 0
    })
    .map((entry) => summarizeMatchesForUser(entry.name, entry.result))
    .filter(Boolean)
}

const findActionIntent = (input, actionCatalog = []) => {
  let bestMatch = null
  let bestScore = -1

  for (const entry of actionCatalog) {
    if (!Array.isArray(entry.keywords)) {
      continue
    }
    for (const token of entry.keywords) {
      const normalized = String(token).toLowerCase()
      if (!normalized || !input.includes(normalized)) {
        continue
      }
      if (normalized.length > bestScore) {
        bestMatch = entry
        bestScore = normalized.length
      }
    }
  }

  return bestMatch
}

const inferActionIntentFromConversationContext = (
  currentInput,
  contextualInput,
  actionCatalog = [],
  tenantRuntimePolicy = null,
) => {
  const normalizedCurrent = normalizeText(currentInput)
  const normalizedContext = normalizeText(contextualInput)

  const hasCreateVerb =
    /(agregar|agrega|agregalo|agregala|registrar|registralo|registrala|cargar|cargalo|cargala|dar de alta|alta)/.test(
      normalizedCurrent,
    )
  const hasQuoteVerb =
    /(cotizar|cotizacion|cotizacion|presupuesto|precio|cuanto sale|cuanto cuesta|pasame)/.test(
      normalizedCurrent,
    )
  const hasStructuredCatalogContext = hasStructuredCatalogSignal(
    normalizedContext,
    tenantRuntimePolicy,
  )

    if (hasCreateVerb && hasStructuredCatalogContext) {
      return (
      actionCatalog.find((entry) => entry?.key === STRUCTURED_CATALOG_REGISTER_INTENT) ??
        null
    )
  }

  if (hasQuoteVerb && hasStructuredCatalogContext) {
    return (
      actionCatalog.find(
        (entry) => entry?.key === STRUCTURED_CATALOG_PREPARE_QUOTE_INTENT,
      ) ?? null
    )
  }

  return null
}

const extractNamedEntity = (text, patterns) => {
  for (const pattern of patterns) {
    const match = text.match(pattern)
    const value = match?.[1]?.trim()
    if (value) {
      return value.replace(/[.,;:]$/g, '').trim()
    }
  }
  return null
}

const normalizeEntityQuery = (value) =>
  value
    ?.replace(/^(?:el|la)\s+/iu, '')
    ?.replace(/^(?:pedido|presupuesto|cliente|producto)\s+de\s+/iu, '')
    ?.replace(/^(?:pedido|presupuesto|cliente|producto)\s+/iu, '')
    ?.trim() || null

const escapeInlineRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractDimensionToken = (input) => {
  const match = String(input || '').match(/\b(\d{2,4})\s*[xX]\s*(\d{2,4})\b/u)
  if (!match?.[1] || !match?.[2]) {
    return null
  }
  return `${match[1]}x${match[2]}`
}

const buildCustomerProductSearchQuery = (input, tenantRuntimePolicy = null) => {
  const dimensionToken = extractDimensionToken(input)
  if (dimensionToken) {
    return dimensionToken
  }

  const tenantTopicMatch = findBestPolicyTopicMatch(input, tenantRuntimePolicy)
  if (tenantTopicMatch?.label) {
    return normalizeEntityQuery(tenantTopicMatch.label)
  }

  const catalogTerms = (getVocabulary(tenantRuntimePolicy)?.catalogTerms ?? [])
    .filter((entry) => typeof entry === 'string' && entry.trim())
    .map((entry) => entry.trim())
    .sort((left, right) => right.length - left.length)
  const catalogPattern =
    catalogTerms.length > 0
      ? new RegExp(`\\b(${catalogTerms.map((entry) => escapeInlineRegex(entry)).join('|')})\\b`, 'iu')
      : null
  const catalogQueryToken = extractNamedEntity(String(input || ''), [
    ...(catalogPattern ? [catalogPattern] : []),
    /\b([a-z]*\d+[a-z0-9-]*)\b/iu,
  ])

  return normalizeEntityQuery(catalogQueryToken || String(input || ''))
}

const OPERATION_DRAFT_TOOL_NAME = '__operation_draft__'

const VERIFICATION_ROUTE_BUILDERS = {
  customer: (id) => `/app/crm/customer-details?id=${id}`,
  product: (id) => `/app/products/edit/${id}`,
  appointment: (id) => `/app/calendar/activities/details?id=${id}`,
  order: (id) => `/app/sales/order-details/${id}`,
  quote: (id) => `/app/sales/budget-details/${id}`,
  payment: (id) => `/app/accounting/payments?paymentId=${id}`,
}

const MAX_EXTRACTED_ASSETS = 4
const MAX_EXTRACTED_TEXT_LENGTH = 6000

export class AiAgentRuntime {
  constructor({ config, provider, memoryStore, backendClient }) {
    this.config = config
    this.activeConfig = config
    this.provider = provider
    this.memoryStore = memoryStore
    this.backendClient = backendClient
    this.runtimeConfigLoadedAt = 0
    this.actionCatalog = []
    this.actionCatalogLoadedAt = 0
    this.roleCatalog = getRoleCatalog()
    this.quotaStatus = null
    this.quotaStatusLoadedAt = 0
    this.topicTaxonomyCache = new Map()
    this.quoteProfilesCache = new Map()
    this.tenantRuntimePolicyCache = new Map()
  }

  buildCustomerVariationSeed({
    conversationId = null,
    intentKey = null,
    history = [],
    input = '',
  } = {}) {
    const turns = Array.isArray(history) ? history.length : 0
    return [conversationId || 'conversation', intentKey || 'intent', turns, String(input || '').length].join(':')
  }

  resolveCustomerCapabilityRuntime() {
    return resolveCustomerCapabilityRuntime(this.activeConfig)
  }

  getCustomerCapabilityMode(intentKey) {
    return getCustomerCapabilityMode(this.activeConfig, intentKey)
  }

  resolveProviderOptions(kind = 'default') {
    const source = this.activeConfig || this.config || {}
    const defaultModel = source.modelName || this.provider?.modelName
    const defaultTemperature =
      typeof source.temperature === 'number' ? source.temperature : 0.2
    const defaultMaxOutputTokens =
      typeof source.openAiMaxOutputTokens === 'number'
        ? source.openAiMaxOutputTokens
        : 280

    if (kind === 'interpretation') {
      return {
        modelName: source.openAiInterpretationModel || defaultModel,
        temperature:
          typeof source.openAiInterpretationTemperature === 'number'
            ? source.openAiInterpretationTemperature
            : 0,
        maxOutputTokens: Math.max(120, Math.min(360, defaultMaxOutputTokens)),
      }
    }

    if (kind === 'decision') {
      return {
        modelName:
          source.openAiDecisionModel ||
          source.openAiInterpretationModel ||
          defaultModel,
        temperature:
          typeof source.openAiDecisionTemperature === 'number'
            ? source.openAiDecisionTemperature
            : typeof source.openAiInterpretationTemperature === 'number'
              ? source.openAiInterpretationTemperature
              : 0,
        maxOutputTokens: Math.max(120, Math.min(240, defaultMaxOutputTokens)),
      }
    }

    if (kind === 'rewrite') {
      return {
        modelName: source.openAiRewriteModel || defaultModel,
        temperature:
          typeof source.openAiRewriteTemperature === 'number'
            ? source.openAiRewriteTemperature
            : Math.min(defaultTemperature, 0.35),
        maxOutputTokens: Math.max(120, Math.min(320, defaultMaxOutputTokens)),
      }
    }

    if (kind === 'response') {
      return {
        modelName: source.openAiResponseModel || defaultModel,
        temperature:
          typeof source.openAiResponseTemperature === 'number'
            ? source.openAiResponseTemperature
            : Math.max(defaultTemperature, 0.35),
        maxOutputTokens: Math.max(140, Math.min(320, defaultMaxOutputTokens)),
      }
    }

    return {
      modelName: defaultModel,
      temperature: defaultTemperature,
      maxOutputTokens: defaultMaxOutputTokens,
    }
  }

  buildCustomerApprovedFacts({
    intentKey,
    interpretation = null,
    response = null,
    retrievalContext = null,
  }) {
    const facts = []
    const topic =
      interpretation?.topic?.label ||
      interpretation?.contextTopic?.label ||
      interpretation?.quoteContext?.topicLabel ||
      interpretation?.quoteContext?.familyLabel ||
      null
    if (topic) {
      facts.push(`Tema actual: ${topic}.`)
    }
    const quoteMissingFields = Array.isArray(interpretation?.quoteContext?.missingFields)
      ? interpretation.quoteContext.missingFields
      : []
    if (quoteMissingFields.length) {
      facts.push(`Datos faltantes de cotización: ${quoteMissingFields.join(', ')}.`)
    }
    if (interpretation?.supportContext?.productType) {
      facts.push(`Producto de soporte: ${interpretation.supportContext.productType}.`)
    }
    if (interpretation?.supportContext?.issueSummary) {
      facts.push(`Problema reportado: ${interpretation.supportContext.issueSummary}.`)
    }
    const scheduleReason = interpretation?.scheduleContext?.reasonLabel
    if (scheduleReason) {
      facts.push(`Motivo de agenda: ${scheduleReason}.`)
    }
    if (interpretation?.conversationContext?.activeDomain) {
      facts.push(
        `Dominio conversacional activo: ${interpretation.conversationContext.activeDomain}.`,
      )
    }
    if (interpretation?.conversationContext?.nextUsefulField) {
      facts.push(
        `Siguiente dato útil: ${interpretation.conversationContext.nextUsefulField}.`,
      )
    }
    if (interpretation?.followUp?.detected) {
      facts.push('El turno actual es un follow-up sobre el hilo activo.')
    }
    if (response?.grounding?.grounded === true && Array.isArray(retrievalContext?.items)) {
      retrievalContext.items.slice(0, 2).forEach((item) => {
        const title = String(item?.title || '').trim()
        const snippet = String(item?.snippet || item?.summary || '')
          .replace(/\s+/g, ' ')
          .trim()
        if (title || snippet) {
          facts.push(
            `Fuente aprobada${title ? `: ${title}` : ''}${snippet ? ` :: ${snippet.slice(0, 160)}` : ''}`,
          )
        }
      })
    }
    if (intentKey) {
      facts.push(`Intención resuelta por backend: ${intentKey}.`)
    }

    return facts
  }

  shouldUseDecisionAssist({ role, conversationMode, interpretation = null }) {
    const readiness = readInterpretationResolutionReadiness(interpretation)
    return (
      (role === 'customer_public' || role === 'customer_authenticated') &&
      this.activeConfig?.customerDecisionAssistEnabled === true &&
      typeof this.provider?.extractStructured === 'function' &&
      ['flow', 'exploration', 'unclear'].includes(String(conversationMode?.mode || '')) &&
      readiness?.waitForMore !== true
    )
  }

  getDecisionAssistMinConfidence() {
    const configured = Number(this.activeConfig?.customerDecisionAssistMinConfidence)
    if (Number.isFinite(configured) && configured >= 0.6 && configured <= 0.98) {
      return configured
    }

    return 0.82
  }

  buildDecisionAssistState({
    intentKey,
    inboundClassification = null,
    interpretation = null,
    conversationMode = null,
    analysis = null,
  }) {
    const readiness = readInterpretationResolutionReadiness(interpretation)
    return {
      intent: intentKey || null,
      inboundCategory: inboundClassification?.category || null,
      activeDomain: readiness?.lane || null,
      mode: conversationMode?.mode || readiness?.mode || null,
      nextUsefulField: readiness?.nextUsefulField || null,
      responseStrategy: readiness?.answerMode || null,
      knownFacts: readiness?.knownFacts || {},
      interpretationConfidence:
        typeof analysis?.confidence === 'number'
          ? analysis.confidence
          : typeof readiness?.confidence === 'number'
            ? readiness.confidence
            : null,
      quoteContext: interpretation?.quoteContext
        ? {
            missingFields: interpretation.quoteContext.missingFields || [],
            quantity: interpretation.quoteContext.quantity || null,
            measurements: interpretation.quoteContext.measurements || null,
            topicLabel:
              interpretation.quoteContext.topicLabel ||
              interpretation.quoteContext.familyLabel ||
              null,
          }
        : null,
      supportContext: interpretation?.supportContext
        ? {
            productType: interpretation.supportContext.productType || null,
            issueSummary: interpretation.supportContext.issueSummary || null,
            missingFields: interpretation.supportContext.missingFields || [],
            wantsVisit: interpretation.supportContext.wantsVisit === true,
          }
        : null,
      scheduleContext: interpretation?.scheduleContext
        ? {
            missingFields: interpretation.scheduleContext.missingFields || [],
            address: interpretation.scheduleContext.address || null,
            preferredDate: interpretation.scheduleContext.date?.dateLabel || null,
            preferredTime: interpretation.scheduleContext.time?.timeLabel || null,
            reason: interpretation.scheduleContext.reasonLabel || null,
          }
        : null,
    }
  }

  buildDecisionAssistRequirements(interpretation = null) {
    const readiness = readInterpretationResolutionReadiness(interpretation)
    const quoteMissing = Array.isArray(interpretation?.quoteContext?.missingFields)
      ? interpretation.quoteContext.missingFields
      : []
    const supportMissing = Array.isArray(interpretation?.supportContext?.missingFields)
      ? interpretation.supportContext.missingFields
      : []
    const scheduleMissing = Array.isArray(interpretation?.scheduleContext?.missingFields)
      ? interpretation.scheduleContext.missingFields
      : []
    const executeFlowMissing =
      Array.isArray(readiness?.missingFields) && readiness.missingFields.length > 0
        ? readiness.missingFields
        : scheduleMissing.length > 0
        ? scheduleMissing
        : supportMissing.length > 0
          ? supportMissing
          : quoteMissing

    return {
      execute_flow: executeFlowMissing,
      conversational_mode: [],
      ask_clarification: executeFlowMissing,
      small_talk: [],
    }
  }

  shouldAttemptControlledCustomerNaturalization({
    role,
    intentKey,
    response,
    decision = null,
  }) {
    if (
      !(role === 'customer_public' || role === 'customer_authenticated') ||
      typeof this.provider?.resolveClient !== 'function' ||
      this.activeConfig?.customerControlledNaturalizationEnabled !== true ||
      !response ||
      !String(response.text || '').trim()
    ) {
      return false
    }

    if (
      [
        'customer.auth_required',
        'customer.owned_document_request',
        'customer.private_account_data',
        'customer.sensitive',
      ].includes(String(intentKey || ''))
    ) {
      return false
    }

    if (
      capabilityModeBlocksProviderEnhancements(this.getCustomerCapabilityMode(intentKey))
    ) {
      return false
    }

    if (response?.needsHuman || response?.grounding?.fallbackReason) {
      return false
    }

    if (
      typeof response?.wordingKey === 'string' &&
      response.wordingKey &&
      !SAFE_CUSTOMER_HYBRID_REWRITE_KEYS.has(response.wordingKey)
    ) {
      return false
    }

    if (decision?.nextStep === 'conversational_mode' || decision?.nextStep === 'ask_clarification') {
      return true
    }

    return [
      'customer.product_info',
      'customer.topic_info',
      'customer.quote',
      'customer.support_request',
      'customer.schedule_request',
      'customer.contact_info',
      'customer.rephrase_request',
      'customer.incomplete',
    ].includes(String(intentKey || ''))
  }

  async maybeNaturalizeDeterministicCustomerResponse({
    role,
    intentKey,
    input,
    response,
    decision = null,
    interpretation = null,
    retrievalContext = null,
    channel = null,
  }) {
    if (
      !this.shouldAttemptControlledCustomerNaturalization({
        role,
        intentKey,
        response,
        decision,
      })
    ) {
      return response
    }

    const quota = await this.ensureProviderQuotaAvailable()
    if (!quota.allowed) {
      return response
    }

    const approvedFacts = this.buildCustomerApprovedFacts({
      intentKey,
      interpretation,
      response,
      retrievalContext,
    })
    const rewritten = await generateResponse({
      provider: this.provider,
      role,
      input,
      approvedDraft: response.text,
      approvedFacts,
      goal:
        decision?.nextStep === 'ask_clarification'
          ? 'Mantener una aclaración breve y concreta para orientar el próximo paso.'
          : 'Responder natural, breve y guiando hacia el siguiente paso útil sin perder el sentido operativo.',
      mustAskQuestion: decision?.nextStep === 'ask_clarification',
      maxChars:
        response?.grounding?.grounded === true
          ? Math.max(
              140,
              Math.min(
                400,
                Number(this.activeConfig?.customerGroundedRewriteMaxChars || 240),
              ),
            )
          : 260,
      providerOptions: this.resolveProviderOptions(
        response?.grounding?.grounded === true ? 'rewrite' : 'response',
      ),
      channel,
      channelProfile: this.getResponseChannelProfile(channel),
    })

    const nextText = String(rewritten?.text || '').trim()
    if (!nextText) {
      return response
    }

    return {
      ...response,
      text: nextText,
      finalUserText: nextText,
      debug: {
        ...(response?.debug || {}),
        detail: response?.debug?.detail
          ? `${response.debug.detail} Se aplicó una naturalización controlada posterior a la decisión determinística.`
          : 'Se aplicó una naturalización controlada posterior a la decisión determinística.',
      },
    }
  }

  getCustomerWordingOverrides() {
    return (
      this.activeConfig?.customerWordingRegistry ||
      this.activeConfig?.customerWordingOverrides ||
      null
    )
  }

  getCustomerHybridIntentRegistry() {
    return this.activeConfig?.customerHybridIntentRegistry || null
  }

  getResponseChannelProfile(channel = null) {
    return resolveWordingChannelProfile(channel)
  }

  getCustomerWordingTemplateMeta(key, options = {}) {
    return getWordingTemplateMeta({
      key,
      registry: this.getCustomerWordingOverrides(),
      channel: options?.channel || null,
      channelProfile:
        options?.channelProfile || this.getResponseChannelProfile(options?.channel),
    })
  }

  resolveCustomerHybridWordingKey({
    intentKey,
    response = null,
    interpretation = null,
  }) {
    const explicitKey =
      typeof response?.wordingKey === 'string' && response.wordingKey.trim()
        ? response.wordingKey.trim()
        : typeof response?.debug?.wordingKey === 'string' &&
            response.debug.wordingKey.trim()
          ? response.debug.wordingKey.trim()
          : null
    if (explicitKey) {
      return explicitKey
    }

    const fallbackSubtype =
      typeof response?.grounding?.fallbackSubtype === 'string'
        ? response.grounding.fallbackSubtype
        : null
    if (fallbackSubtype === 'quote_handoff') {
      return 'customer.quote.handoff_ready'
    }
    if (fallbackSubtype === 'material_followup') {
      return 'customer.fallback.material_followup'
    }
    if (fallbackSubtype === 'information_then_handoff') {
      return 'customer.fallback.information_then_handoff'
    }

    if (intentKey === 'customer.support_request') {
      return 'customer.support.followup'
    }

    if (intentKey === 'customer.schedule_request' || intentKey === 'customer.confirmation') {
      const scheduleContext =
        interpretation?.scheduleContext && typeof interpretation.scheduleContext === 'object'
          ? interpretation.scheduleContext
          : null
      const missingFields = Array.isArray(scheduleContext?.missingFields)
        ? scheduleContext.missingFields
        : []
      const hasDate = Boolean(scheduleContext?.date?.dateLabel)
      const hasTime = Boolean(scheduleContext?.time?.timeLabel)
      const hasAddress =
        typeof scheduleContext?.address === 'string' && scheduleContext.address.trim().length > 0

      if (hasDate && !hasTime) {
        return 'customer.schedule.confirmation.day_known'
      }
      if (!hasDate && hasTime) {
        return 'customer.schedule.confirmation.time_known'
      }
      if (hasDate && hasTime && !hasAddress) {
        return 'customer.schedule.confirmation.address_missing'
      }
      if (missingFields.includes('date')) {
        return 'customer.schedule.progress.ask_day'
      }
      if (missingFields.includes('time')) {
        return 'customer.schedule.progress.ask_time'
      }
      if (missingFields.includes('address')) {
        return 'customer.schedule.progress.ask_address'
      }
      if (missingFields.includes('contact')) {
        return 'customer.schedule.progress.ask_contact'
      }
      if (missingFields.length > 0) {
        return 'customer.schedule.confirmation.full_missing'
      }
    }

    if (
      intentKey === 'customer.product_info' ||
      intentKey === 'customer.topic_info'
    ) {
      const topicType =
        typeof interpretation?.topic?.type === 'string'
          ? interpretation.topic.type
          : typeof interpretation?.contextTopic?.type === 'string'
            ? interpretation.contextTopic.type
            : null
      if (topicType === 'product_family') {
        return 'customer.product.options_offer'
      }
      if (
        ['product_topic', 'product_variant', 'product_family'].includes(
          String(topicType || ''),
        )
      ) {
        return 'customer.product.info_offer'
      }
    }

    return null
  }

  isSafeCustomerHybridWordingKey(key) {
    return typeof key === 'string' && SAFE_CUSTOMER_HYBRID_REWRITE_KEYS.has(key)
  }

  shouldApplySafeCustomerHybridRewrite({
    wordingKey,
    input,
    channel = null,
  }) {
    const templateMeta = this.getCustomerWordingTemplateMeta(wordingKey, {
      channel,
    })
    if (templateMeta.allowHybridRewrite === true && wordingKey) {
      if (
        wordingKey === 'customer.product.info_offer' ||
        wordingKey === 'customer.product.options_offer'
      ) {
        return (
          looksLikeShortContextualFollowUp(input) ||
          looksLikeCustomerFollowUp(input) ||
          looksLikeContextualReference(input)
        )
      }

      return true
    }

    if (!this.isSafeCustomerHybridWordingKey(wordingKey)) {
      return false
    }

    if (
      wordingKey === 'customer.product.info_offer' ||
      wordingKey === 'customer.product.options_offer'
    ) {
      return (
        looksLikeShortContextualFollowUp(input) ||
        looksLikeCustomerFollowUp(input) ||
        looksLikeContextualReference(input)
      )
    }

    return true
  }

  resolveCustomerRewriteMode({
    wordingKey,
    input,
    response = null,
    channel = null,
  }) {
    if (
      this.shouldApplySafeCustomerHybridRewrite({
        wordingKey,
        input,
        channel,
      })
    ) {
      return 'light_style'
    }

    const isDeterministicGroundedFollowUp =
      response?.grounding?.grounded === true &&
      (looksLikeShortContextualFollowUp(input) ||
        looksLikeCustomerFollowUp(input) ||
        looksLikeContextualReference(input))

    return isDeterministicGroundedFollowUp
      ? 'light_style'
      : 'grounded_rewrite'
  }

  buildCustomerCapabilityModeResponse({
    intentKey,
    interpretation = null,
    variationSeed = '',
  }) {
    const capability = getCustomerCapabilityForIntent(intentKey)
    const mode = this.getCustomerCapabilityMode(intentKey)
    if (!capability || !capabilityModeBlocksAutomaticResolution(mode)) {
      return null
    }

    let text = buildCustomerCapabilityHandoffText({
      capability,
      variationSeed,
      wordingOverrides: this.getCustomerWordingOverrides(),
    })
    const needsHuman = true

    if (capability === 'commerce') {
      const subject =
        interpretation?.quoteContext?.topicLabel ||
        interpretation?.quoteContext?.familyLabel ||
        interpretation?.topic?.label ||
        interpretation?.contextTopic?.label ||
        'la configuración solicitada'
      text = buildCustomerQuoteHandoffText({
        subject,
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
      })
    } else if (capability === 'content') {
      const subject =
        interpretation?.topic?.label ||
        interpretation?.contextTopic?.label ||
        'esa opción'
      text = buildCustomerInformationThenHandoffText({
        subject,
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
      })
    }

    const capabilityGrounding = buildGroundingContract({
      knowledgeRetrieved: false,
      usedFacts: extractGroundingFactsFromText(text, 2),
      sources: buildStructuredGroundingSource({
        sourceType: 'runtime_capability',
        scope: 'capability',
        sourceKey: `${capability || 'conversation'}:${mode || 'default'}`,
        title: `Capability ${capability || 'conversation'}`,
      }),
    })

    return {
      text,
      wordingKey:
        capability === 'commerce'
          ? 'customer.quote.handoff_ready'
          : capability === 'content'
            ? 'customer.fallback.information_then_handoff'
            : null,
      toolCalls: [],
      needsHuman,
      grounding: {
        ...capabilityGrounding,
        fallbackReason: `capability_${capability}_handoff_only`,
        fallbackSubtype:
          capability === 'commerce'
            ? 'quote_handoff'
            : capability === 'content'
              ? 'information_then_handoff'
              : 'schedule_handoff',
      },
      debug: {
        actionKey: intentKey,
        wordingKey:
          capability === 'commerce'
            ? 'customer.quote.handoff_ready'
            : capability === 'content'
              ? 'customer.fallback.information_then_handoff'
              : null,
        detail:
          `La capability ${capability} está en modo ${mode}; se devolvió un fallback controlado en lugar de intentar resolución automática.`,
      },
    }
  }

  async refreshRuntimeConfig() {
    const now = Date.now()
    if (now - this.runtimeConfigLoadedAt < 30_000) {
      return this.activeConfig
    }

    try {
      const runtimeConfig = await this.backendClient.getRuntimeConfig()
      const nextConfig = {
        ...this.config,
        modelProvider: runtimeConfig.provider || this.config.modelProvider,
        modelName: runtimeConfig.model || this.config.modelName,
        openAiApiKey:
          runtimeConfig.openAiApiKey !== undefined
            ? runtimeConfig.openAiApiKey
            : this.config.openAiApiKey,
        enabled:
          runtimeConfig.enabled !== undefined
            ? runtimeConfig.enabled
            : true,
        monthlySpendingLimitUsd: runtimeConfig.monthlySpendingLimitUsd,
        currentUsageUsd: runtimeConfig.currentUsageUsd,
        warningThresholdPercent: runtimeConfig.warningThresholdPercent,
        usageMessage: runtimeConfig.usageMessage,
        adminInternalPrompt: runtimeConfig.adminInternalPrompt,
        customerPublicPrompt: runtimeConfig.customerPublicPrompt,
        customerGreetingDefault: runtimeConfig.customerGreetingDefault,
        customerGreetingMorning: runtimeConfig.customerGreetingMorning,
        customerGreetingAfternoon: runtimeConfig.customerGreetingAfternoon,
        customerGreetingConsultation: runtimeConfig.customerGreetingConsultation,
        customerGreetingHelp: runtimeConfig.customerGreetingHelp,
        adminGreetingDefault: runtimeConfig.adminGreetingDefault,
        customerGroundedRewriteEnabled:
          runtimeConfig.customerGroundedRewriteEnabled,
        customerGroundedRewriteMaxChars:
          runtimeConfig.customerGroundedRewriteMaxChars,
        customerDecisionAssistEnabled:
          runtimeConfig.customerDecisionAssistEnabled,
        customerDecisionAssistMinConfidence:
          runtimeConfig.customerDecisionAssistMinConfidence,
        customerCapabilityProfile:
          runtimeConfig.customerCapabilityProfile,
        customerContentMode: runtimeConfig.customerContentMode,
        customerCommerceMode: runtimeConfig.customerCommerceMode,
        customerSchedulingMode: runtimeConfig.customerSchedulingMode,
        customerWordingRegistry:
          runtimeConfig.customerWordingRegistry ||
          runtimeConfig.customerWordingOverrides ||
          null,
        customerWordingOverrides: runtimeConfig.customerWordingOverrides || null,
        customerHybridIntentRegistry:
          runtimeConfig.customerHybridIntentRegistry || null,
        roleCatalog: getRoleCatalog(runtimeConfig.roleCatalog),
        updatedAt: runtimeConfig.updatedAt || null,
      }

      const currentSignature = this.buildProviderSignature(this.activeConfig)
      const nextSignature = this.buildProviderSignature(nextConfig)
      if (currentSignature !== nextSignature) {
        this.provider = createModelProvider(nextConfig)
      }
      this.activeConfig = nextConfig
      this.roleCatalog = getRoleCatalog(runtimeConfig.roleCatalog)
    } catch (error) {
      console.warn('[ai-agent-service] Unable to refresh runtime config', error)
      this.activeConfig = {
        ...this.config,
        enabled: true,
      }
      this.roleCatalog = getRoleCatalog()
    }

    this.runtimeConfigLoadedAt = now
    return this.activeConfig
  }

  async invalidateCaches({ refreshRuntime = false } = {}) {
    this.runtimeConfigLoadedAt = 0
    this.actionCatalogLoadedAt = 0
    this.actionCatalog = []
    this.quotaStatusLoadedAt = 0
    this.quotaStatus = null
    this.topicTaxonomyCache.clear()
    this.quoteProfilesCache.clear()
    this.tenantRuntimePolicyCache.clear()

    if (refreshRuntime) {
      await this.refreshRuntimeConfig()
    }
  }

  async getTenantTopicTaxonomy(backendClient, tenantKey, scope = 'customer_public') {
    const cacheKey = `${tenantKey || 'default'}:${scope || 'customer_public'}`
    const now = Date.now()
    const cached = this.topicTaxonomyCache.get(cacheKey)
    if (cached && now - cached.loadedAt < 120_000) {
      return cached.items
    }

    if (typeof backendClient?.getTopicTaxonomy !== 'function') {
      return []
    }

    try {
      const result = await backendClient.getTopicTaxonomy(tenantKey, scope)
      const items = Array.isArray(result?.items) ? result.items : []
      this.topicTaxonomyCache.set(cacheKey, { loadedAt: now, items })
      return items
    } catch (error) {
      console.warn('[ai-agent-service] Unable to load tenant topic taxonomy', error)
      this.topicTaxonomyCache.set(cacheKey, { loadedAt: now, items: [] })
      return []
    }
  }

  async getTenantQuoteProfiles(backendClient, tenantKey, scope = 'customer_public') {
    const cacheKey = `${tenantKey || 'default'}:${scope || 'customer_public'}`
    const now = Date.now()
    const cached = this.quoteProfilesCache.get(cacheKey)
    if (cached && now - cached.loadedAt < 120_000) {
      return cached.items
    }

    if (typeof backendClient?.getQuoteProfiles !== 'function') {
      return []
    }

    try {
      const result = await backendClient.getQuoteProfiles(tenantKey, scope)
      const items = Array.isArray(result?.items) ? result.items : []
      this.quoteProfilesCache.set(cacheKey, { loadedAt: now, items })
      return items
    } catch (error) {
      console.warn('[ai-agent-service] Unable to load tenant quote profiles', error)
      this.quoteProfilesCache.set(cacheKey, { loadedAt: now, items: [] })
      return []
    }
  }

  async getTenantRuntimePolicy(backendClient, tenantKey, scope = 'customer_public') {
    const cacheKey = `${tenantKey || 'default'}:${scope || 'customer_public'}`
    const now = Date.now()
    const cached = this.tenantRuntimePolicyCache.get(cacheKey)
    if (cached && now - cached.loadedAt < 120_000) {
      return cached.policy
    }

    const [topicTaxonomy, quoteProfiles] = await Promise.all([
      this.getTenantTopicTaxonomy(backendClient, tenantKey, scope),
      this.getTenantQuoteProfiles(backendClient, tenantKey, scope),
    ])
    const policy = buildTenantPolicyEnvelope({
      tenantKey: tenantKey || 'default',
      topicTaxonomy,
      quoteProfiles,
    })
    this.tenantRuntimePolicyCache.set(cacheKey, { loadedAt: now, policy })
    return policy
  }

  async resolveExtractedAssetContext(unifiedMessage, backendClient) {
    const attachments = Array.isArray(unifiedMessage?.attachments)
      ? unifiedMessage.attachments
      : Array.isArray(unifiedMessage?.metadata?.attachments)
        ? unifiedMessage.metadata.attachments
        : []

    const assets = attachments
      .filter((item) => item && typeof item === 'object')
      .slice(0, MAX_EXTRACTED_ASSETS)
      .map((item) => ({
        assetType: item.assetType || item.kind || null,
        fileName: item.fileName || item.filename || item.name || null,
        contentType: item.contentType || item.mimeType || null,
        content: item.content || null,
        textContent:
          item.textContent ||
          item.transcriptText ||
          item.ocrText ||
          item.rawText ||
          null,
        preferAi: item.preferAi !== false,
        metadata:
          item.metadata && typeof item.metadata === 'object'
            ? item.metadata
            : {
                transcriptText: item.transcriptText || null,
                ocrText: item.ocrText || null,
                rawText: item.rawText || null,
              },
      }))
      .filter(
        (item) =>
          item.content ||
          item.textContent ||
          item.metadata?.transcriptText ||
          item.metadata?.ocrText ||
          item.metadata?.rawText,
      )

    if (!assets.length || typeof backendClient?.extractAssets !== 'function') {
      return {
        items: [],
        appendedInput: null,
      }
    }

    try {
      const result = await backendClient.extractAssets({ assets })
      const items = Array.isArray(result?.items) ? result.items : []
      return {
        items,
        appendedInput: null,
      }
    } catch (error) {
      return {
        items: [
          {
            assetType: 'unknown',
            fileName: null,
            contentType: null,
            source: 'unparsed',
            stage: 'failed',
            rawText: null,
            normalizedText: null,
            structuredRows: [],
            warnings: [
              error instanceof Error
                ? error.message
                : 'attachment_extraction_failed',
            ],
            confidence: 0,
            requiresStructuredExtraction: false,
            usableForContext: false,
            debug: {
              byteLength: null,
              rowCount: 0,
              sheetCount: null,
              usedOpenAi: false,
              reason: 'attachment_extraction_failed',
            },
          },
        ],
        appendedInput: null,
      }
    }
  }

  buildInputWithExtractedAssets(input, extractedAssets = []) {
    const relevant = extractedAssets
      .filter((item) => item?.usableForContext && item?.normalizedText)
      .slice(0, MAX_EXTRACTED_ASSETS)

    if (!relevant.length) {
      return String(input || '')
    }

    const sections = relevant.map((item, index) => {
      const header = `[Adjunto ${index + 1}: ${item.fileName || item.assetType || 'archivo'}]`
      const text = String(item.normalizedText || '')
        .slice(0, MAX_EXTRACTED_TEXT_LENGTH)
        .trim()
      return `${header}\n${text}`
    })

    return [String(input || '').trim(), 'Contexto extraído desde adjuntos:', ...sections]
      .filter(Boolean)
      .join('\n\n')
      .trim()
  }

  buildPublicMemoryState(taskMemory, snapshotOverride = null) {
    const effectiveSnapshot = snapshotOverride || taskMemory?.snapshot || null
    const taskState = effectiveSnapshot?.taskState ?? null
    const canonicalTopic =
      taskMemory?.canonicalTopic ||
      (taskState?.canonicalTopic && typeof taskState.canonicalTopic === 'object'
        ? taskState.canonicalTopic
        : null)

    return {
      taskId: taskMemory?.taskId ?? taskState?.taskId ?? null,
      intentKey: taskMemory?.intentKey ?? taskState?.intentKey ?? null,
      turnIntentKey: taskMemory?.turnIntentKey ?? taskState?.turnIntentKey ?? null,
      activeLane: taskMemory?.activeLane ?? taskState?.activeLane ?? null,
      state: typeof taskState?.state === 'string' ? taskState.state : null,
      stateHistory: Array.isArray(taskState?.stateHistory)
        ? taskState.stateHistory.filter((entry) => typeof entry === 'string')
        : [],
      lastTransitionAt:
        typeof taskState?.lastTransitionAt === 'string'
          ? taskState.lastTransitionAt
          : null,
      taskSummary: taskMemory?.taskSummary ?? taskState?.taskSummary ?? null,
      currentTask: taskMemory?.currentTask ?? taskState?.currentTask ?? null,
      canonicalTopic: canonicalTopic
        ? {
            label:
              typeof canonicalTopic.label === 'string' ? canonicalTopic.label : null,
            type: typeof canonicalTopic.type === 'string' ? canonicalTopic.type : null,
            confidence:
              typeof canonicalTopic.confidence === 'number'
                ? canonicalTopic.confidence
                : null,
            source:
              typeof canonicalTopic.source === 'string' ? canonicalTopic.source : null,
          }
        : null,
      quoteContext:
        taskMemory?.quoteContext ||
        sanitizeQuoteContextForAudit(taskState?.quoteContext),
      supportContext:
        taskMemory?.supportContext ||
        sanitizeSupportContextForAudit(taskState?.supportContext),
      scheduleContext:
        taskMemory?.scheduleContext ||
        sanitizeScheduleContextForAudit(taskState?.scheduleContext),
      conversationState:
        taskMemory?.conversationState ||
        sanitizeConversationStateForAudit(taskState?.conversationState),
      resetApplied: Boolean(taskMemory?.resetApplied),
      resetCount:
        typeof taskMemory?.resetCount === 'number'
          ? taskMemory.resetCount
          : typeof taskState?.resetCount === 'number'
            ? taskState.resetCount
            : 0,
      lastResetAt: taskMemory?.lastResetAt ?? taskState?.lastResetAt ?? null,
      historyTurnCount: Array.isArray(taskMemory?.history)
        ? taskMemory.history.length
        : Array.isArray(effectiveSnapshot?.turns)
          ? effectiveSnapshot.turns.length
          : 0,
    }
  }

  deriveAgentStateEventsFromResponse(response) {
    const fallbackReason =
      typeof response?.grounding?.fallbackReason === 'string'
        ? response.grounding.fallbackReason
        : null
    const toolCalls = Array.isArray(response?.toolCalls) ? response.toolCalls : []

    if (toolCalls.some((entry) => entry?.status === 'draft')) {
      return fallbackReason === 'requires_confirmation'
        ? [AGENT_STATE_EVENTS.BUILD_DRAFT, AGENT_STATE_EVENTS.REQUEST_CONFIRMATION]
        : [AGENT_STATE_EVENTS.BUILD_DRAFT]
    }

    if (toolCalls.some((entry) => entry?.status === 'executed')) {
      return [AGENT_STATE_EVENTS.START_EXECUTION, AGENT_STATE_EVENTS.EXECUTION_SUCCEEDED]
    }

    if (toolCalls.some((entry) => entry?.status === 'failed')) {
      return [AGENT_STATE_EVENTS.START_EXECUTION, AGENT_STATE_EVENTS.EXECUTION_FAILED]
    }

    if (response?.needsHuman) {
      return [AGENT_STATE_EVENTS.HANDOFF_REQUESTED]
    }

    if (
      fallbackReason &&
      [
        'execution_failed',
        'execution_partial_failure',
        'role_intent_blocked',
        'role_tool_blocked',
        'role_resolution_ambiguous',
        'prompt_injection_blocked',
        'provider_quota_exceeded',
        'provider_rate_limited',
        'provider_auth_failed',
        'provider_bad_request',
        'provider_context_limit',
        'provider_timeout',
        'provider_unavailable',
        'provider_error',
      ].includes(fallbackReason)
    ) {
      return [AGENT_STATE_EVENTS.EXECUTION_FAILED]
    }

    return [AGENT_STATE_EVENTS.COMPLETE]
  }

  applyTaskStateFromResponse(taskMemory, response, options = {}) {
    const effectiveSnapshot =
      options.snapshot ||
      (taskMemory?.snapshot ? structuredClone(taskMemory.snapshot) : null)

    if (!effectiveSnapshot?.taskState) {
      return {
        snapshot: effectiveSnapshot,
        memory: this.buildPublicMemoryState(taskMemory, effectiveSnapshot),
      }
    }

    const at = options.at || new Date().toISOString()
    const events = Array.isArray(options.events)
      ? options.events
      : this.deriveAgentStateEventsFromResponse(response)
    const stateTransition = applyAgentStateEvents(effectiveSnapshot.taskState, events, {
      at,
    })

    effectiveSnapshot.taskState = {
      ...effectiveSnapshot.taskState,
      state: stateTransition.state,
      stateHistory: stateTransition.stateHistory,
      lastTransitionAt: stateTransition.lastTransitionAt,
      currentTask: effectiveSnapshot.taskState.currentTask
        ? {
            ...effectiveSnapshot.taskState.currentTask,
            status: stateTransition.currentTaskStatus,
            lastUpdate: at,
          }
        : effectiveSnapshot.taskState.currentTask,
      updatedAt: at,
    }
    const currentQuoteContext =
      effectiveSnapshot.taskState?.quoteContext &&
      typeof effectiveSnapshot.taskState.quoteContext === 'object'
        ? { ...effectiveSnapshot.taskState.quoteContext }
        : null
    if (currentQuoteContext) {
      const responseQuoteResolution =
        response?.quoteResolution && typeof response.quoteResolution === 'object'
          ? response.quoteResolution
          : null
      if (
        responseQuoteResolution?.status === 'product_not_found' &&
        responseQuoteResolution?.productNotFoundSubtype === 'catalog_match_ambiguous'
      ) {
        currentQuoteContext.pendingClarification = {
          type: 'catalog_match_ambiguous',
          subjectLabel:
            typeof responseQuoteResolution.subjectLabel === 'string'
              ? responseQuoteResolution.subjectLabel
              : null,
          candidateProducts: Array.isArray(responseQuoteResolution.candidateProducts)
            ? responseQuoteResolution.candidateProducts
                .filter((entry) => entry && typeof entry === 'object')
                .slice(0, 3)
                .map((entry) => ({
                  id:
                    typeof entry.id === 'number' && Number.isFinite(entry.id)
                      ? entry.id
                      : null,
                  name:
                    typeof entry.name === 'string' && entry.name.trim()
                      ? entry.name.trim()
                      : null,
                  currency:
                    typeof entry.currency === 'string' && entry.currency.trim()
                      ? entry.currency.trim()
                      : null,
                  amount:
                    typeof entry.amount === 'number' && Number.isFinite(entry.amount)
                      ? entry.amount
                      : null,
                  unitOfMeasure:
                    typeof entry.unitOfMeasure === 'string' && entry.unitOfMeasure.trim()
                      ? entry.unitOfMeasure.trim()
                      : null,
                }))
            : [],
        }
      } else if (responseQuoteResolution) {
        currentQuoteContext.pendingClarification = null
      }

      effectiveSnapshot.taskState = {
        ...effectiveSnapshot.taskState,
        quoteContext: currentQuoteContext,
      }
    }
    effectiveSnapshot.updatedAt = at

    return {
      snapshot: effectiveSnapshot,
      memory: this.buildPublicMemoryState(taskMemory, effectiveSnapshot),
    }
  }

  isTurnCanceled(runtimeOptions = {}) {
    return runtimeOptions?.cancellationToken?.canceled === true
  }

  async persistConversationSnapshot(
    conversationId,
    snapshot,
    runtimeOptions = {},
  ) {
    if (!snapshot || this.isTurnCanceled(runtimeOptions)) {
      return false
    }

    await this.memoryStore.replace(conversationId, snapshot)
    return true
  }

  async appendConversationTurn(
    conversationId,
    turn,
    scope,
    role,
    runtimeOptions = {},
  ) {
    if (!turn || this.isTurnCanceled(runtimeOptions)) {
      return false
    }

    await this.memoryStore.appendTurn(conversationId, turn, scope, role)
    return true
  }

  pendingMemoryTransaction({
    conversationId,
    snapshot = null,
    scope,
    role,
    runtimeOptions = {},
  }) {
    if (!conversationId || this.isTurnCanceled(runtimeOptions)) {
      return null
    }

    return {
      conversationId,
      scope,
      role,
      snapshot: snapshot ? structuredClone(snapshot) : null,
      turns: [],
      runtimeOptions,
    }
  }

  stageConversationTurn(transaction, turn) {
    if (
      !transaction ||
      !turn ||
      this.isTurnCanceled(transaction.runtimeOptions)
    ) {
      return transaction
    }

    transaction.turns.push(turn)
    return transaction
  }

  async responseCommit(transaction) {
    if (
      !transaction ||
      !transaction.snapshot ||
      this.isTurnCanceled(transaction.runtimeOptions)
    ) {
      return null
    }

    const committedSnapshot = structuredClone(transaction.snapshot)
    committedSnapshot.scope = transaction.scope
    committedSnapshot.role = transaction.role
    committedSnapshot.turns = [
      ...(Array.isArray(committedSnapshot.turns) ? committedSnapshot.turns : []),
      ...(Array.isArray(transaction.turns) ? transaction.turns : []),
    ]
    committedSnapshot.updatedAt = new Date().toISOString()
    await this.memoryStore.replace(transaction.conversationId, committedSnapshot)
    return committedSnapshot
  }

  resolveInferenceContext({
    input,
    snapshot,
    extractedAssets = [],
    directActionIntent = null,
    directIntentKey = null,
  }) {
    const baseInput = String(input || '').trim()
    if (!baseInput || !Array.isArray(snapshot?.turns) || !snapshot.turns.length) {
      return {
        reasoningInput: baseInput,
        referencedMessages: [],
      }
    }

    const directIntentIsGeneric =
      directIntentKey === 'admin.other' || isGenericCustomerIntentKey(directIntentKey)

    const shouldUseRecentContext =
      (!directActionIntent && directIntentIsGeneric) ||
      looksLikeContextualReference(baseInput) ||
      looksLikeShortContextualFollowUp(baseInput) ||
      looksLikeCustomerFollowUp(baseInput) ||
      looksLikeAttachmentReference(baseInput) ||
      (extractedAssets.length > 0 &&
        !extractedAssets.some(
          (item) => item?.usableForContext && String(item?.normalizedText || '').trim(),
        ))

    if (!shouldUseRecentContext) {
      return {
        reasoningInput: baseInput,
        referencedMessages: [],
      }
    }

    const recentTurns = filterReasoningRelevantTurns([...snapshot.turns])
      .reverse()
      .filter(
        (turn) =>
          (turn?.role === 'customer' || turn?.role === 'agent') &&
          turn?.text &&
          !(
            turn?.role === 'customer' &&
            hasExplicitConfirmation(turn.text)
          ),
      )
      .slice(0, 4)
      .reverse()

    if (!recentTurns.length) {
      return {
        reasoningInput: baseInput,
        referencedMessages: [],
      }
    }

    const contextBlock = recentTurns
      .map((turn, index) => {
        const messageId = turn?.metadata?.messageId ? ` id:${turn.metadata.messageId}` : ''
        const roleLabel = turn?.role === 'agent' ? 'Agente' : 'Cliente'
        return `[${roleLabel} ${index + 1}${messageId}] ${String(turn.text).slice(0, 280)}`
      })
      .join('\n')

    return {
      reasoningInput: `${baseInput}\n\nContexto conversacional reciente relevante:\n${contextBlock}`.trim(),
      referencedMessages: recentTurns.map((turn) => ({
        messageId: turn?.metadata?.messageId || null,
        createdAt: turn?.createdAt || null,
        role: turn?.role || null,
        preview: String(turn?.text || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 160),
        extractedAssetCount: Number(turn?.metadata?.extractedAssetCount || 0),
      })),
    }
  }

  countDraftOpenItems(draft) {
    if (!draft?.sections || !Array.isArray(draft.sections)) {
      return 0
    }
    return draft.sections.reduce((total, section) => {
      const title = normalizeText(section?.title)
      if (title !== 'faltantes' && title !== 'dudosos' && title !== 'pendientes') {
        return total
      }
      return total + (Array.isArray(section?.items) ? section.items.length : 0)
    }, 0)
  }

  buildStructuredExtractionSpec(actionIntent, input, extractedAssets = []) {
    if (!this.provider?.extractStructured || !actionIntent) {
      return null
    }

    const sourceBlocks = [String(input || '').trim()]
    for (const asset of extractedAssets) {
      if (asset?.usableForContext && asset?.normalizedText) {
        sourceBlocks.push(
          `[${asset.fileName || asset.assetType || 'adjunto'}]\n${String(asset.normalizedText).slice(
            0,
            4000,
          )}`,
        )
      }
    }
    const sourceText = sourceBlocks.filter(Boolean).join('\n\n').trim()
    if (!sourceText) {
      return null
    }

    if (actionIntent.key === 'customers.create' || actionIntent.key === 'customers.update') {
      return {
        systemPrompt:
          'Extrae únicamente datos operativos de cliente desde el texto y devuelve campos estructurados. No inventes valores.',
        input: sourceText,
        schema: {
          name: z.string().nullable().optional(),
          email: z.string().nullable().optional(),
          phoneNumber: z.string().nullable().optional(),
          location: z.string().nullable().optional(),
        },
        format: (result) => [
          result?.name ? `nombre: ${result.name}` : null,
          result?.email ? `email: ${result.email}` : null,
          result?.phoneNumber ? `telefono: ${result.phoneNumber}` : null,
          result?.location ? `ubicacion: ${result.location}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      }
    }

    if (actionIntent.key === 'products.create' || actionIntent.key === 'products.update') {
      return {
        systemPrompt:
          'Extrae únicamente datos operativos de producto desde el texto y devuelve campos estructurados. No inventes valores.',
        input: sourceText,
        schema: {
          name: z.string().nullable().optional(),
          productCode: z.string().nullable().optional(),
          currency: z.string().nullable().optional(),
          salePrice: z.number().nullable().optional(),
          stock: z.number().int().nullable().optional(),
        },
        format: (result) => [
          result?.name ? `producto ${result.name}` : null,
          result?.productCode ? `codigo: ${result.productCode}` : null,
          result?.salePrice != null ? `precio ${result.salePrice}` : null,
          result?.currency ? `moneda: ${result.currency}` : null,
          result?.stock != null ? `stock ${result.stock}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      }
    }

    if (
      actionIntent.key === 'appointments.create' ||
      actionIntent.key === 'appointments.update'
    ) {
      return {
        systemPrompt:
          'Extrae únicamente datos operativos de una cita o actividad desde el texto y devuelve campos estructurados. No inventes valores.',
        input: sourceText,
        schema: {
          title: z.string().nullable().optional(),
          startDate: z.string().nullable().optional(),
          startTime: z.string().nullable().optional(),
          location: z.string().nullable().optional(),
        },
        format: (result) =>
          [
            result?.title ? `titulado ${result.title}` : null,
            result?.startDate && result?.startTime
              ? `para el ${result.startDate} a las ${result.startTime}`
              : null,
            result?.location ? `en ${result.location}` : null,
          ]
            .filter(Boolean)
            .join(' '),
      }
    }

    if (
      actionIntent.key === 'orders.update_status' ||
      actionIntent.key === 'quotes.update_status' ||
      actionIntent.key === 'payments.update_status'
    ) {
      const entityLabel =
        actionIntent.key === 'orders.update_status'
          ? 'pedido'
          : actionIntent.key === 'quotes.update_status'
            ? 'presupuesto'
            : 'pago'

      return {
        systemPrompt:
          `Extrae únicamente datos operativos para actualización de ${entityLabel}. Devuelve referencia de la entidad y nuevo estado en términos humanos. No inventes valores.`,
        input: sourceText,
        schema: {
          targetRef: z.string().nullable().optional(),
          customerName: z.string().nullable().optional(),
          statusText: z.string().nullable().optional(),
        },
        format: (result) =>
          [
            result?.targetRef
              ? `${entityLabel} ${result.targetRef}`
              : result?.customerName
                ? `${entityLabel} de ${result.customerName}`
                : null,
            result?.statusText ? `estado ${result.statusText}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
      }
    }

    if (
      actionIntent.key === 'orders.update_comment' ||
      actionIntent.key === 'quotes.update_comment'
    ) {
      const entityLabel =
        actionIntent.key === 'orders.update_comment' ? 'pedido' : 'presupuesto'

      return {
        systemPrompt:
          `Extrae únicamente datos operativos para comentario de ${entityLabel}. Devuelve referencia de la entidad y comentario final. No inventes valores.`,
        input: sourceText,
        schema: {
          targetRef: z.string().nullable().optional(),
          customerName: z.string().nullable().optional(),
          comment: z.string().nullable().optional(),
        },
        format: (result) =>
          [
            result?.targetRef
              ? `${entityLabel} ${result.targetRef}`
              : result?.customerName
                ? `${entityLabel} de ${result.customerName}`
                : null,
            result?.comment ? `comentario ${result.comment}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
      }
    }

    if (actionIntent.key === 'quotes.send' || actionIntent.key === 'quotes.confirm') {
      return {
        systemPrompt:
          'Extrae únicamente datos operativos de un presupuesto para enviarlo o confirmarlo. Devuelve referencia del presupuesto o nombre del cliente si aparece. No inventes valores.',
        input: sourceText,
        schema: {
          targetRef: z.string().nullable().optional(),
          customerName: z.string().nullable().optional(),
        },
        format: (result) =>
          [
            result?.targetRef
              ? `presupuesto ${result.targetRef}`
              : result?.customerName
                ? `presupuesto de ${result.customerName}`
                : null,
          ]
            .filter(Boolean)
            .join('\n'),
      }
    }

    if (actionIntent.key === 'payments.update') {
      return {
        systemPrompt:
          'Extrae únicamente datos operativos de actualización de pago. Devuelve referencia del pago, método, referencia externa y notas si existen. No inventes valores.',
        input: sourceText,
        schema: {
          targetRef: z.string().nullable().optional(),
          customerName: z.string().nullable().optional(),
          method: z.string().nullable().optional(),
          reference: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
        },
        format: (result) =>
          [
            result?.targetRef
              ? `pago ${result.targetRef}`
              : result?.customerName
                ? `pago de ${result.customerName}`
                : null,
            result?.method ? `metodo ${result.method}` : null,
            result?.reference ? `referencia ${result.reference}` : null,
            result?.notes ? `nota ${result.notes}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
      }
    }

    if (
      actionIntent.key === 'catalog.register_structured_items' ||
      actionIntent.key === 'catalog.prepare_structured_quote' ||
      actionIntent.key === 'catalog.parse_structured_items'
    ) {
      return {
        systemPrompt:
          'Separa cada ítem cotizable en una línea independiente y preserva solo los datos presentes: tipo, configuración, atributos, medidas y precio. No inventes datos faltantes ni mezcles atributos entre líneas.',
        input: sourceText,
        schema: {
          lines: z.array(z.string()).max(20).optional(),
        },
        format: (result) =>
          Array.isArray(result?.lines)
            ? result.lines
                .map((line) => String(line || '').trim())
                .filter(Boolean)
                .join('\n')
            : '',
      }
    }

    return null
  }

  async maybeRefineDraftWithStructuredExtraction({
    role,
    actionIntent,
    actionCatalog,
    input,
    extractedAssets,
    operationalContext,
    draft,
    backendClient,
  }) {
    const spec = this.buildStructuredExtractionSpec(
      actionIntent,
      input,
      extractedAssets,
    )
    if (!spec) {
      return {
        draft,
        operationalContext,
      }
    }

    const currentGaps = this.countDraftOpenItems(draft)
    if (draft?.ready && currentGaps === 0) {
      return {
        draft,
        operationalContext,
      }
    }

    try {
      const quotaCheck = await this.ensureProviderQuotaAvailable()
      if (!quotaCheck.allowed) {
        return {
          draft,
          operationalContext,
        }
      }
      const structured = await this.provider.extractStructured({
        systemPrompt: spec.systemPrompt,
        input: spec.input,
        schema: spec.schema,
        options: {
          stage: 'structured_draft',
        },
      })
      const hintText = spec.format(structured)
      if (!hintText) {
        return {
          draft,
          operationalContext,
        }
      }

      const rebuiltInput = `${input}\n${hintText}`.trim()
      const rebuiltOperationalContext = await this.getOperationalContext(
        { text: rebuiltInput },
        role,
        actionCatalog,
        backendClient,
      )
      const rebuiltDraft = this.buildOperationDraft(
        actionIntent,
        rebuiltInput,
        rebuiltOperationalContext,
        extractedAssets,
      )

      if (!rebuiltDraft) {
        return {
          draft,
          operationalContext,
        }
      }

      const rebuiltGaps = this.countDraftOpenItems(rebuiltDraft)
      if (rebuiltDraft.ready || rebuiltGaps < currentGaps) {
        rebuiltDraft.debugDetail = [
          rebuiltDraft.debugDetail,
          'Se agregó extracción estructurada IA para completar campos ambiguos.',
        ]
          .filter(Boolean)
          .join(' ')
        return {
          draft: rebuiltDraft,
          operationalContext: rebuiltOperationalContext,
        }
      }
      return {
        draft,
        operationalContext,
      }
    } catch {
      return {
        draft,
        operationalContext,
      }
    }
  }

  async respond(unifiedMessage, runtimeOptions = {}) {
    if (!hasProviderCallTrace()) {
      return runWithProviderCallTrace({ budget: 1 }, () =>
        this.respond(unifiedMessage, runtimeOptions),
      )
    }

    const runtimeConfig = await this.refreshRuntimeConfig()
    if (runtimeConfig.enabled === false) {
      const disabledRole = resolveRole(unifiedMessage, this.roleCatalog)
      return {
        conversationId: unifiedMessage.conversationId || unifiedMessage.userId,
        scope: roleToScope(disabledRole, this.roleCatalog),
        role: disabledRole,
        provider: this.provider.providerName,
        model: this.provider.modelName,
        text:
          runtimeConfig.usageMessage ||
          'El asistente está temporalmente deshabilitado. Un operador puede continuar la atención.',
        toolCalls: [],
        audit: {
          role: disabledRole,
          intentKey: null,
          blockedTools: [],
          executedTools: [],
          fallbackActivated: true,
          taskChanged: false,
          createdAt: new Date().toISOString(),
        },
      }
    }

    const conversationId = unifiedMessage.conversationId || unifiedMessage.userId
    const sanitizedInput = sanitizeUserInput(unifiedMessage.text)
    if (isSystemNoiseMessage(sanitizedInput?.sanitized)) {
      return {
        conversationId,
        scope: unifiedMessage.scope || null,
        role: null,
        provider: this.provider.providerName,
        model: this.provider.modelName,
        text: '',
        finalUserText: '',
        toolCalls: [],
        suppressed: true,
        audit: {
          role: null,
          intentKey: null,
          blockedTools: [],
          executedTools: [],
          fallbackActivated: false,
          taskChanged: false,
          ignoredInbound: true,
          ignoreReason: SYSTEM_NOISE_IGNORE_REASON,
          authorKind: 'customer_human',
          messageKind: 'human_message',
          createdAt: new Date().toISOString(),
        },
      }
    }
    const role = resolveRole(unifiedMessage, this.roleCatalog)
    const roleConfig = getRoleConfig(role, this.roleCatalog)
    const roleResolution = analyzeRoleResolution(unifiedMessage, this.roleCatalog)
    const scope = roleToScope(role, this.roleCatalog)
    const authorKind = resolveUnifiedAuthorKind(unifiedMessage, role)
    const messageKind = resolveUnifiedMessageKind(unifiedMessage, authorKind)
    if (shouldIgnoreMessageForReasoning({ authorKind, messageKind })) {
      return {
        conversationId,
        scope,
        role,
        provider: this.provider.providerName,
        model: this.provider.modelName,
        text: '',
        finalUserText: '',
        toolCalls: [],
        suppressed: true,
        audit: {
          role,
          intentKey: null,
          blockedTools: [],
          executedTools: [],
          fallbackActivated: false,
          taskChanged: false,
          ignoredInbound: true,
          ignoreReason: messageKind,
          authorKind,
          messageKind,
          createdAt: new Date().toISOString(),
        },
      }
    }
    const scopedBackendClient = this.createTurnBackendClient(
      this.backendClient.scoped(role),
    )
    const snapshot = await this.memoryStore.get(conversationId)
    const previousSnapshot = snapshot ? structuredClone(snapshot) : null
    const previousTaskState = previousSnapshot?.taskState ?? snapshot?.taskState ?? null
    const priorIntentKey = previousTaskState?.intentKey || null
    const recentReasoningTurns = filterReasoningRelevantTurns(
      previousSnapshot?.turns ?? snapshot?.turns ?? [],
    )
    const fullActionCatalog = await this.getActionCatalog(role, {
      includeUnauthorized: true,
    })
    const actionCatalog = fullActionCatalog.filter(
      (entry) =>
        !Array.isArray(entry.allowedRoles) ||
        entry.allowedRoles.length === 0 ||
        entry.allowedRoles.includes(role),
    )
    const detectionActionCatalog =
      roleConfig.type === 'admin' ? fullActionCatalog : actionCatalog
    const tenantPolicyScope =
      roleConfig.type === 'admin' ? 'admin_internal' : 'customer_public'
    const tenantRuntimePolicy = await this.getTenantRuntimePolicy(
      scopedBackendClient,
      unifiedMessage?.tenantKey,
      tenantPolicyScope,
    )
    const tenantTopicTaxonomy = getProductCatalog(tenantRuntimePolicy)
    const tenantQuoteProfiles = Array.isArray(tenantRuntimePolicy?.quoteProfiles)
      ? tenantRuntimePolicy.quoteProfiles
      : []
    const extractedAssetContext = await this.resolveExtractedAssetContext(
      unifiedMessage,
      scopedBackendClient,
    )
    const messageElements = interpretMessageElements({
      text: sanitizedInput.sanitized,
      messageElements: unifiedMessage?.messageElements,
      attachments: unifiedMessage?.attachments,
      extractedAssets: extractedAssetContext.items,
    })
    const messageContext = buildMessageContext(messageElements, sanitizedInput.sanitized)
    const effectiveInput = messageContext.effectiveInput || sanitizedInput.sanitized
    const customerTextNormalization =
      roleConfig.type === 'customer'
        ? normalizeCustomerTextForIntent(effectiveInput, {
            tenantTopicTaxonomy,
          })
        : null
    const interpretedInput =
      customerTextNormalization?.normalizedInput || effectiveInput
    const inboundClassification = classifyInboundMessage({
      role,
      input: effectiveInput,
      recentTurns: recentReasoningTurns,
      pendingState: previousSnapshot?.taskState ?? snapshot?.taskState ?? null,
      tenantTopicTaxonomy,
      tenantRuntimePolicy,
    })
    const messageContextExtraOrigins =
      customerTextNormalization?.changed ? ['customer_text_normalization'] : []
    const messageContextAudit = {
      messageElements: summarizeMessageElementsForAudit(messageContext),
      messageContextOrigin: buildMessageContextOrigin(
        messageContext,
        [],
        messageContextExtraOrigins,
      ),
    }
    const nluAnalysis =
      roleConfig.type === 'customer'
        ? await orchestrateCustomerNlu({
            role,
            input: interpretedInput,
            tenantTopicTaxonomy,
            inboundClassification,
          })
        : null
    const customerHybridIntentRegistry = this.getCustomerHybridIntentRegistry()
    const initialIntentDetection = detectIntent({
      role,
      input: interpretedInput,
      actionCatalog: detectionActionCatalog,
      messageContext,
      inboundClassification,
      tenantTopicTaxonomy,
      tenantRuntimePolicy,
      nluAnalysis,
      customerHybridIntentRegistry,
      legacy: {
        deriveIntentKey,
        findActionIntent,
        inferActionIntentFromConversationContext,
      },
    })
    const directActionIntent = initialIntentDetection.directActionIntent
    const directIntentKey = initialIntentDetection.intent
    const inferenceContext = this.resolveInferenceContext({
      input: interpretedInput,
      snapshot: previousSnapshot ?? snapshot,
      extractedAssets: extractedAssetContext.items,
      directActionIntent,
      directIntentKey,
    })
    messageContextAudit.messageContextOrigin = buildMessageContextOrigin(
      messageContext,
      inferenceContext.referencedMessages,
      messageContextExtraOrigins,
    )
    const reasoningInput = inferenceContext.reasoningInput || interpretedInput
    const intentDetection = detectIntent({
      role,
      input: interpretedInput,
      reasoningInput,
      actionCatalog: detectionActionCatalog,
      referencedMessages: inferenceContext.referencedMessages,
      messageContext,
      inboundClassification,
      tenantTopicTaxonomy,
      tenantRuntimePolicy,
      nluAnalysis,
      customerHybridIntentRegistry,
      legacy: {
        deriveIntentKey,
        findActionIntent,
        inferActionIntentFromConversationContext,
      },
    })
    const actionIntent = intentDetection.actionIntent
    const intentKey = intentDetection.intent
    const turnInterpretation = buildTurnInterpretation({
      role,
      originalInput: sanitizedInput.original,
      effectiveInput,
      normalizedInput: interpretedInput,
      reasoningInput,
      inboundClassification,
      directIntentKey,
      intentDetection,
      previousTaskState,
      referencedMessages: inferenceContext.referencedMessages,
      tenantTopicTaxonomy,
      tenantQuoteProfiles,
      tenantRuntimePolicy,
      nluAnalysis,
    })
    const resolvedDecisionPath = Array.from(
      new Set([
        ...intentDetection.decisionPath,
        ...(customerTextNormalization?.changed
          ? ['preprocess:customer_text_normalization']
          : []),
        ...(turnInterpretation.followUp.detected
          ? ['interpretation:follow_up']
          : []),
        ...(turnInterpretation.intent.inherited
          ? ['interpretation:intent_inherited']
          : []),
        ...(turnInterpretation.topic?.label
          ? [`interpretation:topic:${turnInterpretation.topic.type || 'unknown'}`]
          : []),
        ...(turnInterpretation.threadResolution?.requiresDisambiguation
          ? ['interpretation:thread_disambiguation']
          : []),
      ]),
    )
    const allowLlmInterpretation =
      roleConfig.type === 'customer' &&
      !['greeting', 'courtesy', 'noise'].includes(
        String(inboundClassification?.category || ''),
      )
    const taskMemory = this.resolveTaskMemory(
      snapshot,
      conversationId,
      role,
      scope,
      turnInterpretation.currentTurnText || effectiveInput,
      actionIntent,
      intentDetection,
      turnInterpretation,
      tenantRuntimePolicy,
    )
    if (taskMemory?.quoteContext && typeof taskMemory.quoteContext === 'object') {
      turnInterpretation.quoteContext = taskMemory.quoteContext
    }
    if (taskMemory?.supportContext && typeof taskMemory.supportContext === 'object') {
      turnInterpretation.supportContext = taskMemory.supportContext
    }
    if (taskMemory?.scheduleContext && typeof taskMemory.scheduleContext === 'object') {
      turnInterpretation.scheduleContext = taskMemory.scheduleContext
    }
    if (taskMemory?.conversationContext && typeof taskMemory.conversationContext === 'object') {
      turnInterpretation.conversationContext = taskMemory.conversationContext
    }
    if (taskMemory?.conversationState && typeof taskMemory.conversationState === 'object') {
      turnInterpretation.conversationState = taskMemory.conversationState
    }
    if (
      taskMemory?.conversationContext?.resolutionReadiness &&
      typeof taskMemory.conversationContext.resolutionReadiness === 'object'
    ) {
      turnInterpretation.resolutionReadiness =
        taskMemory.conversationContext.resolutionReadiness
    }
    const llmInterpretation = await analyzeMessage({
      provider: this.provider,
      role,
      input: turnInterpretation.currentTurnText || effectiveInput,
      recentTurns: recentReasoningTurns,
      inboundClassification,
      intentKey,
      interpretation: turnInterpretation,
      intentRegistryHints: collectCustomerHybridIntentHints({
        registry: customerHybridIntentRegistry,
        input: turnInterpretation.currentTurnText || effectiveInput,
        reasoningInput,
      }),
      taskSummary: taskMemory.taskSummary,
      currentTask: taskMemory.currentTask,
      allowModel: false,
      providerOptions: {
        ...this.resolveProviderOptions('interpretation'),
        stage: 'interpretation',
      },
    })
    const conversationMode = classifyConversationMode({
      role,
      input: turnInterpretation.currentTurnText || effectiveInput,
      inboundClassification,
      analysis: llmInterpretation,
      intentKey,
      interpretation: turnInterpretation,
    })
    const hardInjectionBlock =
      sanitizedInput.injectionDetected &&
      /(prompt|tools?|herramientas?|datos internos|configuraci[oó]n|act[uú]a como admin|admin)/i.test(
        sanitizedInput.original,
      )
    if (hardInjectionBlock) {
      return this.finalizeBlockedTurn({
        conversationId,
        scope,
        role,
        roleConfig,
        roleResolution,
        taskMemory,
        intentDetection,
        intentKey: taskMemory.intentKey,
        blockedTools: [],
        fallbackReason: 'prompt_injection_blocked',
        stage: 'security_block',
        detail:
          'Se interceptó un intento explícito de prompt injection o elevación de privilegios antes de consultar conocimiento, tools o endpoints operativos.',
        actionKey: actionIntent?.key ?? null,
        input: sanitizedInput.sanitized,
        decisionPath: resolvedDecisionPath,
        messageContext,
        messageContextAudit,
        runtimeOptions,
      })
    }
    const intentAllowed = canRoleExecuteIntent(role, intentKey, this.roleCatalog)
    const baseTools = getToolsForRole(roleConfig, scopedBackendClient)
    const { tools, blockedTools } = this.filterToolsForIntent(
      baseTools,
      actionIntent,
      role,
      effectiveInput,
    )
    const requestedToolName = actionIntent?.toolName ?? null
    const requestedToolRequiresConfirmation =
      requestedToolName &&
      roleRequiresConfirmation(role, requestedToolName, this.roleCatalog) &&
      !hasExplicitConfirmation(sanitizedInput.sanitized)
    const requestedToolBlocked =
      Boolean(requestedToolName) &&
      blockedTools.includes(requestedToolName) &&
      !tools.some((tool) => tool.name === requestedToolName) &&
      !requestedToolRequiresConfirmation

    if (!intentAllowed) {
      return this.finalizeBlockedTurn({
        conversationId,
        scope,
        role,
        roleConfig,
        roleResolution,
        taskMemory,
        intentDetection,
        intentKey,
        blockedTools,
        fallbackReason: roleResolution.ambiguous
          ? 'role_resolution_ambiguous'
          : 'role_intent_blocked',
        stage: 'policy_block',
        detail: roleResolution.ambiguous
          ? 'Configuración amplia o ambigua de grupos/capacidades.'
          : 'El intent detectado no está habilitado para el rol conversacional resuelto.',
        actionKey: actionIntent?.key ?? null,
        input: sanitizedInput.sanitized,
        decisionPath: resolvedDecisionPath,
        messageContext,
        messageContextAudit,
        runtimeOptions,
      })
    }

    if (requestedToolBlocked) {
      return this.finalizeBlockedTurn({
        conversationId,
        scope,
        role,
        roleConfig,
        roleResolution,
        taskMemory,
        intentDetection,
        intentKey,
        blockedTools,
        fallbackReason: roleResolution.ambiguous
          ? 'role_resolution_ambiguous'
          : 'role_tool_blocked',
        stage: 'tool_block',
        detail: requestedToolRequiresConfirmation
          ? 'La tool requiere confirmación explícita antes de ejecutarse.'
          : `La tool solicitada (${requestedToolName || 'n/a'}) no quedó habilitada para este rol.`,
        actionKey: actionIntent?.key ?? null,
        input: sanitizedInput.sanitized,
        decisionPath: resolvedDecisionPath,
        messageContext,
        messageContextAudit,
        runtimeOptions,
      })
    }

    const confirmationResponse = await this.tryExecutePendingConfirmation({
      snapshot: previousSnapshot,
      taskMemory,
      conversationId,
      role,
      scope,
      input: effectiveInput,
      backendClient: scopedBackendClient,
    })
    if (confirmationResponse) {
      const responseWithDebug = this.appendAdminDebugSummary(confirmationResponse, {
        stage: 'confirmation_execution',
        role,
        input: sanitizedInput.sanitized,
        intentKey: taskMemory.intentKey,
        intentConfidence: intentDetection.confidence,
        intentSource: intentDetection.source,
        decisionPath: resolvedDecisionPath,
        actionKey: confirmationResponse.debug?.actionKey ?? null,
        blockedTools,
        toolCalls: confirmationResponse.toolCalls ?? [],
        messageElementsUsed: messageContext.usedElementKinds,
        messageElements: messageContextAudit.messageElements,
        messageContextOrigin: messageContextAudit.messageContextOrigin,
        semanticTurnId: unifiedMessage?.metadata?.semanticTurnId || null,
        providerCallTrace: getProviderCallTrace(),
        decisionSource: 'resolution_readiness:execute_flow',
        detail: confirmationResponse.debug?.detail ?? null,
      })
      const finalizedTask = this.applyTaskStateFromResponse(
        taskMemory,
        responseWithDebug,
        {
          events: (responseWithDebug.toolCalls ?? []).some(
            (entry) => entry?.status === 'failed',
          )
            ? [AGENT_STATE_EVENTS.START_EXECUTION, AGENT_STATE_EVENTS.EXECUTION_FAILED]
            : [AGENT_STATE_EVENTS.START_EXECUTION, AGENT_STATE_EVENTS.EXECUTION_SUCCEEDED],
        },
      )
      const memoryTransaction = this.pendingMemoryTransaction({
        conversationId,
        snapshot: finalizedTask.snapshot,
        scope,
        role,
        runtimeOptions,
      })

      const now = new Date().toISOString()
      this.stageConversationTurn(memoryTransaction, {
        role: 'customer',
        text:
          extractedAssetContext.items.length > 0
            ? effectiveInput
            : sanitizedInput.sanitized,
        createdAt: now,
        metadata: {
          channel: unifiedMessage.channel,
          messageId: unifiedMessage.messageId || null,
          authorKind,
          messageKind,
          taskId: taskMemory.taskId,
          intentKey: taskMemory.intentKey,
          role,
          injectionDetected: sanitizedInput.injectionDetected,
          messageElementCount: messageElements.length,
        },
      })
      this.stageConversationTurn(memoryTransaction, {
        role: 'agent',
        text: responseWithDebug.text,
        createdAt: new Date().toISOString(),
        metadata: {
          provider: this.provider.providerName,
          authorKind: 'agent_runtime',
          messageKind: 'human_message',
          toolCalls: responseWithDebug.toolCalls ?? [],
          finalUserText:
            responseWithDebug.finalUserText ?? responseWithDebug.text ?? null,
          debugSummary: responseWithDebug.debugSummary ?? null,
          auditPayload: responseWithDebug.auditPayload ?? null,
          taskId: taskMemory.taskId,
          intentKey: taskMemory.intentKey,
          role,
          messageElementCount: messageElements.length,
        },
      })
      await this.responseCommit(memoryTransaction)

      return {
        conversationId,
        scope,
        role,
        provider: this.provider.providerName,
        model: this.provider.modelName,
        text: responseWithDebug.text,
        finalUserText: responseWithDebug.finalUserText ?? responseWithDebug.text,
        debugSummary: responseWithDebug.debugSummary ?? null,
        auditPayload: responseWithDebug.auditPayload ?? null,
        toolCalls: responseWithDebug.toolCalls ?? [],
        needsHuman: Boolean(responseWithDebug.needsHuman),
        grounding: finalizeResponseGrounding({
          response: responseWithDebug,
          retrievalContext: { items: [] },
          providerGenerationAttempted: false,
        }),
        memory: finalizedTask.memory,
        audit: {
          role,
          intentKey: taskMemory.intentKey,
          blockedTools,
          executedTools: (responseWithDebug.toolCalls ?? [])
            .filter((entry) => entry?.status === 'executed' && entry?.name)
            .map((entry) => entry.name),
          fallbackActivated: responseActivatesFallback(responseWithDebug),
          taskChanged: taskMemory.resetApplied,
          state: finalizedTask.memory.state,
          stateHistory: finalizedTask.memory.stateHistory,
          lastTransitionAt: finalizedTask.memory.lastTransitionAt,
          createdAt: new Date().toISOString(),
        },
      }
    }

    const history = taskMemory.history
    const customerVariationSeed = this.buildCustomerVariationSeed({
      conversationId,
      intentKey: taskMemory.intentKey,
      history,
      input: turnInterpretation.currentTurnText || effectiveInput,
    })
    const protectedCustomerDataResponse = await this.buildProtectedCustomerDataResponse({
      role,
      input: turnInterpretation.currentTurnText || reasoningInput,
      inboundClassification,
      unifiedMessage,
      backendClient: scopedBackendClient,
    })
    const retrievalContext = protectedCustomerDataResponse
      ? {
          items: [],
          sources: [],
          sourceCount: 0,
          disabled: false,
          disabledReason: null,
          knowledgeMode: this.resolveDebugKnowledgeMode(unifiedMessage),
          embeddingMode: null,
          retrievalMode: null,
        }
      : await this.getRetrievalContext(
        {
          ...unifiedMessage,
          text: turnInterpretation.retrievalQuery || reasoningInput,
        },
        role,
          scope,
          scopedBackendClient,
        {
          intentKey,
          turnInterpretation,
          tenantRuntimePolicy,
        },
      )
    const operationalInput =
      roleConfig.type === 'customer'
        ? turnInterpretation.operationalQuery ||
          turnInterpretation.currentTurnText ||
          effectiveInput
        : reasoningInput
    const operationalContext = protectedCustomerDataResponse
      ? { items: [], matches: [], toolCalls: [] }
      : await this.getOperationalContext(
          { ...unifiedMessage, text: operationalInput },
          role,
          actionCatalog,
          scopedBackendClient,
          actionIntent,
          intentKey,
          tenantRuntimePolicy,
        )

    const deterministicAdminResponse = this.buildDeterministicAdminResponse({
      role,
      input: reasoningInput,
      intentKey: taskMemory.intentKey,
    })
    const deterministicQuoteResolutionResponse =
      protectedCustomerDataResponse
        ? null
        : await this.buildDeterministicQuoteResolutionResponse({
            role,
            input: turnInterpretation.currentTurnText || effectiveInput,
            intentKey: taskMemory.intentKey,
            interpretation: turnInterpretation,
            operationalContext,
            backendClient: scopedBackendClient,
            tenantTopicTaxonomy,
            tenantKey: unifiedMessage.tenantKey || null,
            unifiedMessage,
            variationSeed: customerVariationSeed,
          })
    const deterministicScheduleResolutionResponse =
      protectedCustomerDataResponse
        ? null
        : await this.buildDeterministicScheduleResolutionResponse({
            role,
            input: turnInterpretation.currentTurnText || effectiveInput,
            intentKey: taskMemory.intentKey,
            interpretation: turnInterpretation,
            backendClient: scopedBackendClient,
            unifiedMessage,
            conversationId,
            variationSeed: customerVariationSeed,
          })
    const deterministicInstallationConditionResponse =
      protectedCustomerDataResponse
        ? null
        : await this.buildDeterministicInstallationConditionResponse({
            role,
            input: turnInterpretation.currentTurnText || effectiveInput,
            intentKey: taskMemory.intentKey,
            interpretation: turnInterpretation,
            operationalContext,
            backendClient: scopedBackendClient,
            tenantTopicTaxonomy,
            tenantRuntimePolicy,
            tenantKey: unifiedMessage.tenantKey || null,
            unifiedMessage,
          })
    const deterministicKnowledgeResponse = this.buildDeterministicKnowledgeResponse({
      role,
      input: turnInterpretation.currentTurnText || reasoningInput,
      intentKey: taskMemory.intentKey,
      previousIntentKey: priorIntentKey,
      retrievalContext,
      interpretation: turnInterpretation,
      tenantTopicTaxonomy,
      tenantRuntimePolicy,
      variationSeed: customerVariationSeed,
      channel: unifiedMessage.channel || null,
    })
    const deterministicCustomerResponse = this.buildDeterministicCustomerResponse({
      role,
      input: turnInterpretation.currentTurnText || effectiveInput,
      intentKey: taskMemory.intentKey,
      previousIntentKey: priorIntentKey,
      inboundClassification,
      interpretation: turnInterpretation,
      tenantTopicTaxonomy,
      tenantRuntimePolicy,
      variationSeed: customerVariationSeed,
      unifiedMessage,
    })
    const deterministicConversationResponse =
      protectedCustomerDataResponse ||
      deterministicAdminResponse ||
      deterministicQuoteResolutionResponse ||
      deterministicScheduleResolutionResponse ||
      deterministicInstallationConditionResponse ||
      deterministicKnowledgeResponse ||
      deterministicCustomerResponse
    const deterministicResult = deterministicConversationResponse
      ? { response: deterministicConversationResponse, operationalContext }
      : await this.buildDeterministicOperationalResponse({
      role,
      input: reasoningInput,
      actionIntent,
      actionCatalog,
      operationalContext,
      extractedAssets: extractedAssetContext.items,
      requestedToolRequiresConfirmation,
      backendClient: scopedBackendClient,
    })
    const resolvedOperationalContext =
      deterministicResult?.operationalContext ?? operationalContext
    const assistantDecision = await assistNextStep({
      provider: this.provider,
      allowModel: false,
      conversation: [
        ...recentReasoningTurns,
        {
          role: 'customer',
          text: turnInterpretation.currentTurnText || effectiveInput,
        },
      ],
      state: this.buildDecisionAssistState({
        intentKey: taskMemory.intentKey,
        inboundClassification,
        interpretation: turnInterpretation,
        conversationMode,
        analysis: llmInterpretation,
      }),
      interpretation: turnInterpretation,
      allowedActions: [
        'execute_flow',
        'conversational_mode',
        'ask_clarification',
        'small_talk',
      ],
      requiredFieldsByAction: this.buildDecisionAssistRequirements(turnInterpretation),
      taskSummary: taskMemory.taskSummary,
      currentTask: taskMemory.currentTask,
      providerOptions: {
        ...this.resolveProviderOptions('decision'),
        stage: 'decision',
      },
    })
    const orchestratorDecision = decideNextStep({
      role,
      conversationMode,
      deterministicResponse: deterministicResult?.response ?? null,
      intentKey: taskMemory.intentKey,
      interpretation: turnInterpretation,
      assistantDecision,
      assistantMinConfidence: this.getDecisionAssistMinConfidence(),
    })

    if (deterministicResult?.response) {
      deterministicResult.response = await this.maybeRewriteGroundedCustomerResponse({
        role,
        intentKey: taskMemory.intentKey,
        input: turnInterpretation.currentTurnText || effectiveInput,
        response: deterministicResult.response,
        retrievalContext,
        runtimeConfig,
        interpretation: turnInterpretation,
        channel: unifiedMessage.channel || null,
      })
      deterministicResult.response =
        await this.maybeNaturalizeDeterministicCustomerResponse({
          role,
          intentKey: taskMemory.intentKey,
          input: turnInterpretation.currentTurnText || effectiveInput,
          response: deterministicResult.response,
          decision: orchestratorDecision,
          interpretation: turnInterpretation,
          retrievalContext,
          channel: unifiedMessage.channel || null,
        })
    }

    const aiDecision = shouldCallAI({
      role,
      intentKey: taskMemory.intentKey,
      inboundClassification,
      deterministicResponse: deterministicResult?.response ?? null,
      retrievalContext,
    })
    const capabilityMode = this.getCustomerCapabilityMode(taskMemory.intentKey)
    const providerBlockedByCapability =
      capabilityModeBlocksProviderEnhancements(capabilityMode)
    const retrievalOnlyWithoutGrounding =
      retrievalContext.knowledgeMode === 'retrieval_only' &&
      ['business_info', 'contact'].includes(
        String(turnInterpretation?.conversationContext?.activeDomain || ''),
      ) &&
      (!Array.isArray(retrievalContext.items) || retrievalContext.items.length === 0) &&
      deterministicResult?.response?.grounding?.grounded !== true

    let generatedResponse
    let aiExchange = null
    let providerGenerationAttempted = false
    if (retrievalOnlyWithoutGrounding) {
      generatedResponse = this.enforceKnowledgeModePolicy({
        response: {
          ...(deterministicResult?.response || {}),
          text: deterministicResult?.response?.text || '',
          finalUserText:
            deterministicResult?.response?.finalUserText ||
            deterministicResult?.response?.text ||
            '',
          needsHuman:
            typeof deterministicResult?.response?.needsHuman === 'boolean'
              ? deterministicResult.response.needsHuman
              : true,
          grounding: {
            ...(deterministicResult?.response?.grounding || {}),
            grounded: false,
          },
          toolCalls: Array.isArray(deterministicResult?.response?.toolCalls)
            ? deterministicResult.response.toolCalls
            : [],
        },
        retrievalContext,
        role,
        knowledgeMode: retrievalContext.knowledgeMode,
      })
    } else if ((!aiDecision.shouldCall || providerBlockedByCapability) && deterministicResult) {
      generatedResponse = deterministicResult.response
    } else if (providerBlockedByCapability) {
      generatedResponse =
        this.buildCustomerCapabilityModeResponse({
          intentKey: taskMemory.intentKey,
          interpretation: turnInterpretation,
          variationSeed: customerVariationSeed,
        }) ||
        deterministicResult?.response ||
        null
    } else {
      const quotaCheck = await this.ensureProviderQuotaAvailable()
      if (!quotaCheck.allowed) {
        generatedResponse = this.buildProviderFallbackResponse({
          role,
          roleConfig,
          intentKey: taskMemory.intentKey,
          input: effectiveInput,
          retrievalContext,
          operationalContext: resolvedOperationalContext,
          fallbackReason: 'budget_exceeded',
          interpretation: turnInterpretation,
          tenantTopicTaxonomy,
          tenantRuntimePolicy,
          previousIntentKey: priorIntentKey,
          channel: unifiedMessage.channel || null,
        })
        generatedResponse = this.appendAdminDebugSummary(generatedResponse, {
          stage: 'provider_generation',
          role,
          input: reasoningInput,
          intentKey: taskMemory.intentKey,
          intentConfidence: intentDetection.confidence,
          intentSource: intentDetection.source,
          decisionPath: resolvedDecisionPath,
          actionKey: actionIntent?.key ?? null,
          blockedTools,
          toolCalls: resolvedOperationalContext.toolCalls ?? [],
          referencedMessages: inferenceContext.referencedMessages,
          messageElementsUsed: messageContext.usedElementKinds,
          messageElements: messageContextAudit.messageElements,
          messageContextOrigin: messageContextAudit.messageContextOrigin,
          detail: `La llamada al proveedor se bloqueó antes de ejecutarse porque el presupuesto mensual configurado ya quedó excedido${quotaCheck.quota?.source ? ` (fuente=${quotaCheck.quota.source})` : ''}.`,
        })
      } else {
        try {
          providerGenerationAttempted = true
          if (
            orchestratorDecision.nextStep === 'conversational_mode' &&
            orchestratorDecision.shouldGenerateLanguage &&
            typeof this.provider?.resolveClient === 'function'
          ) {
            const approvedFacts = this.buildCustomerApprovedFacts({
              intentKey: taskMemory.intentKey,
              interpretation: turnInterpretation,
              response: deterministicResult?.response ?? null,
              retrievalContext,
            })
            const conversationalResponse = await handleConversationalMode({
              provider: this.provider,
              role,
              input: turnInterpretation.currentTurnText || effectiveInput,
              recentTurns: history,
              interpretation: turnInterpretation,
              approvedDraft: orchestratorDecision.shouldUseDeterministicDraft
                ? deterministicResult?.response?.finalUserText ||
                  deterministicResult?.response?.text ||
                  null
                : null,
              approvedFacts,
              taskSummary: taskMemory.taskSummary,
              currentTask: taskMemory.currentTask,
              providerOptions: {
                ...this.resolveProviderOptions('response'),
                stage: 'response',
              },
              channel: unifiedMessage.channel || null,
              channelProfile: this.getResponseChannelProfile(unifiedMessage.channel),
            })
            if (conversationalResponse?.text) {
              aiExchange = {
                request: {
                  mode:
                    conversationalResponse?.debugContext?.requestMode ||
                    'llm_conversational',
                  processedInput:
                    conversationalResponse?.debugContext?.processedInput ||
                    (turnInterpretation.currentTurnText || effectiveInput),
                  contextBlock:
                    conversationalResponse?.debugContext?.llmContextBlock || null,
                  taskSummary: taskMemory.taskSummary,
                  currentTask: taskMemory.currentTask,
                  approvedDraft:
                    conversationalResponse?.debugContext?.approvedDraft || null,
                  approvedFacts:
                    conversationalResponse?.debugContext?.approvedFacts || [],
                  systemPrompt:
                    conversationalResponse?.debugContext?.systemPrompt || null,
                  promptInput:
                    conversationalResponse?.debugContext?.promptInput || null,
                  promptHistory:
                    conversationalResponse?.debugContext?.promptHistory || [],
                },
                response: {
                  source:
                    conversationalResponse?.source || 'llm_conversational',
                  text:
                    conversationalResponse?.debugContext?.rawResponseText ||
                    conversationalResponse.text,
                  toolCalls: [],
                },
              }
              generatedResponse = {
                text: conversationalResponse.text,
                finalUserText: conversationalResponse.text,
                toolCalls: [],
                debug: {
                  actionKey: taskMemory.intentKey,
                  detail:
                    'La respuesta se generó en modo conversacional controlado sobre facts aprobados y contexto reciente.',
                },
              }
            }
          }

          if (!generatedResponse) {
            const systemPrompt = buildSystemPrompt(role, {
              actionCatalog,
              retrievalContext: retrievalContext.items,
              operationalContext: resolvedOperationalContext.items,
              taskSummary: taskMemory.taskSummary,
              currentTask: taskMemory.currentTask,
              blockedTools,
              customInstructions:
                roleConfig.type === 'admin'
                  ? runtimeConfig.adminInternalPrompt
                  : runtimeConfig.customerPublicPrompt,
            })
            const providerResponse = await this.provider.generate({
              role,
              systemPrompt,
              history,
              input: reasoningInput,
              tools,
              actionCatalog,
              retrievalContext: retrievalContext.items,
              options: {
                ...this.resolveProviderOptions('response'),
                stage: 'response',
              },
            })
            generatedResponse = providerResponse
            aiExchange = {
              request: {
                mode: 'provider_generate',
                processedInput: reasoningInput,
                contextBlock: null,
                taskSummary: taskMemory.taskSummary,
                currentTask: taskMemory.currentTask,
                approvedDraft: null,
                approvedFacts: [],
                systemPrompt,
                promptInput: reasoningInput,
                promptHistory: history,
              },
              response: {
                source: 'provider_generate',
                text:
                  typeof providerResponse?.text === 'string'
                    ? providerResponse.text
                    : null,
                toolCalls: Array.isArray(providerResponse?.toolCalls)
                  ? providerResponse.toolCalls
                  : [],
              },
            }
          }
        } catch (error) {
          const providerFailure = classifyProviderFailure(error)
          const fallbackReason = providerFailure.reason

          aiExchange = {
            request: {
              mode: 'provider_generate',
              processedInput: reasoningInput,
              contextBlock: null,
              taskSummary: taskMemory.taskSummary,
              currentTask: taskMemory.currentTask,
              approvedDraft: null,
              approvedFacts: [],
              systemPrompt: null,
              promptInput: reasoningInput,
              promptHistory: history,
            },
            response: {
              source: 'provider_error',
              text: null,
              toolCalls: [],
              error: `${fallbackReason}${providerFailure.statusCode ? ` (HTTP ${providerFailure.statusCode})` : ''}`,
            },
          }
          generatedResponse = this.buildProviderFallbackResponse({
            role,
            roleConfig,
            intentKey: taskMemory.intentKey,
            input: effectiveInput,
            retrievalContext,
            operationalContext: resolvedOperationalContext,
            fallbackReason,
            interpretation: turnInterpretation,
            tenantTopicTaxonomy,
            tenantRuntimePolicy,
            previousIntentKey: priorIntentKey,
            channel: unifiedMessage.channel || null,
          })

          generatedResponse = this.appendAdminDebugSummary(generatedResponse, {
            stage: 'provider_generation',
            role,
            input: reasoningInput,
            intentKey: taskMemory.intentKey,
            intentConfidence: intentDetection.confidence,
            intentSource: intentDetection.source,
            decisionPath: resolvedDecisionPath,
            actionKey: actionIntent?.key ?? null,
            blockedTools,
            toolCalls: resolvedOperationalContext.toolCalls ?? [],
            referencedMessages: inferenceContext.referencedMessages,
            messageElementsUsed: messageContext.usedElementKinds,
            messageElements: messageContextAudit.messageElements,
            messageContextOrigin: messageContextAudit.messageContextOrigin,
            detail: `Fallo en la etapa de generación del modelo: ${fallbackReason}${providerFailure.statusCode ? ` (HTTP ${providerFailure.statusCode})` : ''}. ${providerFailure.detail}`,
          })
        }
      }
    }

    const mergedToolCalls = dedupeToolCalls([
      ...(resolvedOperationalContext.toolCalls ?? []),
      ...(generatedResponse.toolCalls ?? []),
    ])
    const response = this.applyGroundingFallback(
      effectiveInput,
      role,
      retrievalContext,
      {
        ...generatedResponse,
        toolCalls: mergedToolCalls,
      },
    )
    const responseValidation = this.validateFinalConversationResponse({
      role,
      input: turnInterpretation.currentTurnText || effectiveInput,
      intentKey: taskMemory.intentKey,
      response,
      inboundClassification,
      retrievalContext,
      interpretation: turnInterpretation,
      tenantTopicTaxonomy,
      tenantRuntimePolicy,
      previousIntentKey: priorIntentKey,
      channel: unifiedMessage.channel || null,
    })
    const responseBeforeGuardrails = responseValidation.response
    const hasDeterministicConversationResponse = Boolean(deterministicResult?.response)
    const guardrailMode = hasDeterministicConversationResponse ? null : conversationMode.mode
    const guardrailMaxChars = hasDeterministicConversationResponse
      ? role === 'customer_public' || role === 'customer_authenticated'
        ? 420
        : 360
      : responseValidation.response?.grounding?.grounded === true
        ? Math.max(
            140,
            Math.min(
              420,
              Number(runtimeConfig.customerGroundedRewriteMaxChars || 240),
            ),
          )
        : 280

    const guardrailedText = validateResponseGuardrails({
      text: responseBeforeGuardrails?.text,
      fallbackText: response?.text || deterministicResult?.response?.text || '',
      mode: guardrailMode,
      maxChars: guardrailMaxChars,
      requireQuestion:
        !hasDeterministicConversationResponse &&
        (orchestratorDecision.nextStep === 'conversational_mode' ||
          orchestratorDecision.nextStep === 'ask_clarification'),
      fallbackQuestion:
        conversationMode.mode === 'exploration'
          ? '¿Qué necesitás resolver exactamente?'
          : '¿Querés contarme un poco más para orientarte mejor?',
    })
    const responseMode =
      hasDeterministicConversationResponse && (aiExchange || responseBeforeGuardrails?.rewriteExchange)
        ? 'hybrid'
        : hasDeterministicConversationResponse
          ? 'deterministic'
          : aiExchange || responseBeforeGuardrails?.rewriteExchange
            ? 'generative'
            : 'deterministic'
    const responseAfterGuardrails = {
      ...responseBeforeGuardrails,
      text: guardrailedText.text,
      finalUserText: guardrailedText.text,
      deterministicApplied: hasDeterministicConversationResponse,
      responseMode,
      debug: {
        ...(responseBeforeGuardrails?.debug || {}),
        detail: guardrailedText.issues.length
          ? [
              responseBeforeGuardrails?.debug?.detail,
              `Guardrails aplicados: ${guardrailedText.issues.join(', ')}.`,
            ]
              .filter(Boolean)
              .join(' ')
          : responseValidation.response?.debug?.detail,
      },
    }
    const knowledgeControlledResponse = this.enforceKnowledgeModePolicy({
      response: responseAfterGuardrails,
      retrievalContext,
      role,
      knowledgeMode: retrievalContext.knowledgeMode || 'full',
    })
    const groundedResponse = this.reconcileResponseGrounding({
      response: knowledgeControlledResponse,
      retrievalContext,
      interpretation: turnInterpretation,
      tenantRuntimePolicy,
    })
    const finalConversationResponse = this.preventCustomerResponseLoop({
      response: groundedResponse,
      previousSnapshot,
      interpretation: turnInterpretation,
    })
    const responseMetrics = this.buildConversationalMetrics({
      role,
      interpretation: turnInterpretation,
      inboundClassification,
      previousSnapshot,
      response: finalConversationResponse,
      validation: responseValidation.validation,
      providerGenerationAttempted,
      unifiedMessage,
      providerCallTrace: getProviderCallTrace(),
      aiExchange,
      decisionSource:
        typeof turnInterpretation?.resolutionReadiness?.answerMode === 'string'
          ? `resolution_readiness:${turnInterpretation.resolutionReadiness.answerMode}`
          : typeof turnInterpretation?.conversationContext?.responseStrategy === 'string'
            ? `resolution_readiness:${turnInterpretation.conversationContext.responseStrategy}`
            : 'resolution_readiness:unknown',
      retrievalContext,
    })
    const annotatedResponse = this.appendAdminDebugSummary(
      this.annotateOperationalMatches(
        finalConversationResponse,
        resolvedOperationalContext,
        role,
      ),
      {
        stage: deterministicResult ? 'deterministic_decision' : 'llm_response',
        role,
        input: reasoningInput,
        intentKey: taskMemory.intentKey,
        intentConfidence: intentDetection.confidence,
        intentSource: intentDetection.source,
        decisionPath: resolvedDecisionPath,
        actionKey: actionIntent?.key ?? null,
        blockedTools,
        aiExchange,
        toolCalls: dedupeToolCalls([
          ...(resolvedOperationalContext.toolCalls ?? []),
          ...(response.toolCalls ?? []),
        ]),
        referencedMessages: inferenceContext.referencedMessages,
        messageElementsUsed: messageContext.usedElementKinds,
        messageElements: messageContextAudit.messageElements,
        messageContextOrigin: messageContextAudit.messageContextOrigin,
        turnInterpretation,
        responseValidation: responseValidation.validation,
        conversationAnalysis: llmInterpretation,
        conversationMode,
        orchestratorDecision,
        metrics: responseMetrics,
        matchedKeywords: intentDetection.matchedKeywords,
        inboundCategory: inboundClassification?.category || null,
        retrievalItems: retrievalContext.items,
        responseContract: retrievalContext.responseContract || null,
        knowledgeNeed: retrievalContext.knowledgeNeed || null,
        retrievalSkippedByKnowledgeNeed:
          retrievalContext.disabledReason === 'not_needed_for_turn' ||
          retrievalContext.knowledgeNeed === 'none',
        responseContractResolvedBeforeRetrieval:
          Boolean(retrievalContext.responseContract) &&
          Boolean(retrievalContext.knowledgeNeed),
        knowledgeDisabled: retrievalContext.disabled === true,
        knowledgeMode: retrievalContext.knowledgeMode || 'full',
        knowledgeModeReason: retrievalContext.knowledgeModeReason || null,
        embeddingMode: retrievalContext.embeddingMode || null,
        retrievalMode: retrievalContext.retrievalMode || null,
        queryEmbedding: retrievalContext.queryEmbedding || null,
        tenantRuntimePolicy,
        deterministicApplied: hasDeterministicConversationResponse,
        responseMode,
        semanticTurnId: unifiedMessage?.metadata?.semanticTurnId || null,
        providerCallTrace: getProviderCallTrace(),
        decisionSource:
          typeof responseMetrics?.decisionSource === 'string'
            ? responseMetrics.decisionSource
            : 'resolution_readiness:unknown',
        detail: deterministicResult
          ? `La respuesta se resolvió por flujo determinístico de backend${extractedAssetContext.items.length ? ' usando contexto extraído de adjuntos' : ''} para evitar depender del modelo.`
          : 'La respuesta final se generó con el modelo sobre el contexto operativo y documental disponible.',
      },
    )
    const executedToolNames = (annotatedResponse.toolCalls ?? [])
      .filter((entry) => entry?.status === 'executed' && entry?.name)
      .map((entry) => entry.name)
    const audit = {
      role,
      intentKey: taskMemory.intentKey,
      blockedTools,
      executedTools: executedToolNames,
      fallbackActivated: responseActivatesFallback(annotatedResponse),
      taskChanged: taskMemory.resetApplied,
      referencedMessages: inferenceContext.referencedMessages,
      intentConfidence: intentDetection.confidence,
      intentSource: intentDetection.source,
      decisionPath: resolvedDecisionPath,
      messageElementsUsed: messageContext.usedElementKinds,
      messageElements: messageContextAudit.messageElements,
      messageContextOrigin: messageContextAudit.messageContextOrigin,
      turnInterpretation,
      conversationAnalysis: llmInterpretation,
      conversationMode,
      orchestratorDecision,
      responseValidation: responseValidation.validation,
      metrics: responseMetrics,
      responseMode,
      createdAt: new Date().toISOString(),
    }
    const finalizedTask = this.applyTaskStateFromResponse(taskMemory, annotatedResponse)
    const memoryTransaction = this.pendingMemoryTransaction({
      conversationId,
      snapshot: finalizedTask.snapshot,
      scope,
      role,
      runtimeOptions,
    })
    const now = new Date().toISOString()
    this.stageConversationTurn(memoryTransaction, {
      role: 'customer',
      text:
        extractedAssetContext.items.length > 0
          ? effectiveInput
          : sanitizedInput.sanitized,
      createdAt: now,
      metadata: {
        channel: unifiedMessage.channel,
        messageId: unifiedMessage.messageId || null,
        authorKind,
        messageKind,
        taskId: taskMemory.taskId,
        intentKey: taskMemory.intentKey,
        role,
        injectionDetected: sanitizedInput.injectionDetected,
        extractedAssetCount: extractedAssetContext.items.length,
        messageElementCount: messageElements.length,
      },
    })
    this.stageConversationTurn(memoryTransaction, {
      role: 'agent',
      text: annotatedResponse.text,
      createdAt: new Date().toISOString(),
      metadata: {
        provider: this.provider.providerName,
        authorKind: 'agent_runtime',
        messageKind: 'human_message',
        toolCalls: annotatedResponse.toolCalls ?? [],
        finalUserText:
          annotatedResponse.finalUserText ?? annotatedResponse.text ?? null,
        debugSummary: annotatedResponse.debugSummary ?? null,
        auditPayload: annotatedResponse.auditPayload ?? null,
        taskId: taskMemory.taskId,
        intentKey: taskMemory.intentKey,
        role,
        extractedAssetCount: extractedAssetContext.items.length,
        messageElementCount: messageElements.length,
      },
    })
    await this.responseCommit(memoryTransaction)

    return {
      conversationId,
      scope,
      role,
      provider: this.provider.providerName,
      model: this.provider.modelName,
      text: annotatedResponse.text,
      finalUserText: annotatedResponse.finalUserText ?? annotatedResponse.text,
      debugSummary: annotatedResponse.debugSummary ?? null,
      auditPayload: annotatedResponse.auditPayload ?? null,
      toolCalls: annotatedResponse.toolCalls ?? [],
      quoteResolution: annotatedResponse.quoteResolution ?? null,
      needsHuman: Boolean(annotatedResponse.needsHuman),
      grounding: finalizeResponseGrounding({
        response: annotatedResponse,
        retrievalContext,
        providerGenerationAttempted,
      }),
      memory: {
        ...finalizedTask.memory,
      },
      audit: {
        ...audit,
        state: finalizedTask.memory.state,
        stateHistory: finalizedTask.memory.stateHistory,
        lastTransitionAt: finalizedTask.memory.lastTransitionAt,
      },
    }
  }

  async getActionCatalog(role, options = {}) {
    const includeUnauthorized = options?.includeUnauthorized === true
    const now = Date.now()
    if (now - this.actionCatalogLoadedAt > 60_000) {
      try {
        this.actionCatalog = await this.backendClient.getActions()
        this.actionCatalogLoadedAt = now
      } catch (error) {
        console.warn('[ai-agent-service] Unable to refresh action catalog', error)
      }
    }

    if (includeUnauthorized) {
      return this.actionCatalog || []
    }

    return (this.actionCatalog || []).filter(
      (entry) =>
        !Array.isArray(entry.allowedRoles) ||
        entry.allowedRoles.length === 0 ||
        entry.allowedRoles.includes(role),
    )
  }

  resolveDebugKnowledgeMode(unifiedMessage) {
    const debugOptions =
      unifiedMessage?.metadata && typeof unifiedMessage.metadata === 'object'
        ? unifiedMessage.metadata.debugOptions
        : null
    const explicitMode =
      debugOptions && typeof debugOptions === 'object'
        ? debugOptions.knowledgeMode
        : null

    if (
      explicitMode === 'full' ||
      explicitMode === 'retrieval_disabled' ||
      explicitMode === 'retrieval_only'
    ) {
      return explicitMode
    }

    if (
      debugOptions &&
      typeof debugOptions === 'object' &&
      debugOptions.disableKnowledge === true
    ) {
      return 'retrieval_disabled'
    }

    return 'full'
  }

  intentRequiresStrictKnowledge({ role, intentKey, turnInterpretation } = {}) {
    if (!(role === 'customer_public' || role === 'customer_authenticated')) {
      return false
    }

    if (intentKey === 'customer.multi_intent') {
      return false
    }

    if (intentKey === 'customer.contact_info') {
      return true
    }

    const readiness = readInterpretationResolutionReadiness(turnInterpretation)
    const faqSubtype =
      typeof turnInterpretation?.faqSubtype === 'string'
        ? turnInterpretation.faqSubtype
        : null
    const topicType =
      typeof turnInterpretation?.topic?.type === 'string'
        ? turnInterpretation.topic.type
        : null
    const activeDomain =
      typeof readiness?.lane === 'string'
        ? readiness.lane
        : null

    if (
      intentKey !== 'customer.contact_info' &&
      activeDomain !== 'business_info' &&
      activeDomain !== 'contact'
    ) {
      return false
    }

    if (
      ['location', 'business_hours', 'payment_methods', 'contact'].includes(
        String(faqSubtype || ''),
      ) ||
      topicType === 'business_fact'
    ) {
      return true
    }

    if (
      intentKey !== 'customer.topic_info' &&
      intentKey !== 'customer.contact_info' &&
      intentKey !== 'customer.faq'
    ) {
      return false
    }
    if (topicType === 'product_topic' || topicType === 'product_variant') {
      return false
    }

    return activeDomain === 'business_info' || activeDomain === 'contact'
  }

  resolveEffectiveKnowledgeMode({
    unifiedMessage,
    role,
    intentKey,
    turnInterpretation,
  }) {
    const explicitMode = this.resolveDebugKnowledgeMode(unifiedMessage)
    if (explicitMode !== 'full') {
      return explicitMode
    }

    return this.intentRequiresStrictKnowledge({
      role,
      intentKey,
      turnInterpretation,
    })
      ? 'retrieval_only'
      : 'full'
  }

  resolveResponseContract({
    role,
    intentKey,
    turnInterpretation,
    tenantRuntimePolicy = null,
  } = {}) {
    return resolveCustomerResponseContract({
      role,
      intentKey,
      turnInterpretation,
      tenantRuntimePolicy,
      intentRequiresStrictKnowledge: this.intentRequiresStrictKnowledge({
        role,
        intentKey,
        turnInterpretation,
      }),
      hasActiveKnowledgeTopicAnchor,
      hasActiveFactualKnowledgeAnchor,
      factualFaqSubtypes: FACTUAL_FAQ_SUBTYPES,
    })
  }

  resolveKnowledgeNeed({
    role,
    intentKey,
    turnInterpretation,
    tenantRuntimePolicy = null,
  } = {}) {
    const responseContract = this.resolveResponseContract({
      role,
      intentKey,
      turnInterpretation,
      tenantRuntimePolicy,
    })
    return resolveKnowledgeNeedDecision({
      role,
      intentKey,
      turnInterpretation,
      tenantRuntimePolicy,
      responseContract,
      intentRequiresStrictKnowledge: this.intentRequiresStrictKnowledge({
        role,
        intentKey,
        turnInterpretation,
      }),
      hasActiveKnowledgeTopicAnchor,
      hasActiveFactualKnowledgeAnchor,
      normalizeIntentKeyValue,
      looksLikeCommercialConditionQuestion,
      hasTenantInstallationSignal,
      hasTenantBusinessFactCoverage,
      factualFaqSubtypes: FACTUAL_FAQ_SUBTYPES,
      nonFactualSideQuestionResponseContracts:
        NON_FACTUAL_SIDE_QUESTION_RESPONSE_CONTRACTS,
      retrievalFreeResponseContracts: RETRIEVAL_FREE_RESPONSE_CONTRACTS,
      requiredRetrievalResponseContracts: REQUIRED_RETRIEVAL_RESPONSE_CONTRACTS,
    })
  }

  shouldSkipCustomerKnowledgeRetrieval({
    role,
    intentKey,
    turnInterpretation,
    tenantRuntimePolicy = null,
  } = {}) {
    return shouldSkipKnowledgeRetrieval(
      this.resolveKnowledgeNeed({
        role,
        intentKey,
        turnInterpretation,
        tenantRuntimePolicy,
      }),
    )
  }

  async getRetrievalContext(
    unifiedMessage,
    role,
    scope,
    backendClient = this.backendClient,
    options = {},
  ) {
    const text = unifiedMessage.text?.trim() || ''
    const searchText = compactText(
      options?.turnInterpretation?.retrievalQuery || text,
    )
    const turnKnowledgeControl = resolveTurnKnowledgeControl({
      role,
      intentKey: options.intentKey || null,
      turnInterpretation: options.turnInterpretation || null,
      tenantRuntimePolicy: options.tenantRuntimePolicy || null,
      intentRequiresStrictKnowledge: this.intentRequiresStrictKnowledge({
        role,
        intentKey: options.intentKey || null,
        turnInterpretation: options.turnInterpretation || null,
      }),
      hasActiveKnowledgeTopicAnchor,
      hasActiveFactualKnowledgeAnchor,
      normalizeIntentKeyValue,
      looksLikeCommercialConditionQuestion,
      hasTenantInstallationSignal,
      hasTenantBusinessFactCoverage,
      factualFaqSubtypes: FACTUAL_FAQ_SUBTYPES,
      nonFactualSideQuestionResponseContracts:
        NON_FACTUAL_SIDE_QUESTION_RESPONSE_CONTRACTS,
      retrievalFreeResponseContracts: RETRIEVAL_FREE_RESPONSE_CONTRACTS,
      requiredRetrievalResponseContracts: REQUIRED_RETRIEVAL_RESPONSE_CONTRACTS,
    })
    const knowledgeDecision = turnKnowledgeControl.knowledgeDecision
    const knowledgeMode = this.resolveEffectiveKnowledgeMode({
      unifiedMessage,
      role,
      intentKey: options.intentKey || null,
      turnInterpretation: options.turnInterpretation || null,
    })
    const skipRetrieval = knowledgeDecision.knowledgeNeed === 'none'
    if (searchText.length < 4) {
      return {
        items: [],
        disabled: knowledgeMode === 'retrieval_disabled',
        disabledReason: null,
        responseContract: knowledgeDecision.responseContract,
        knowledgeNeed: knowledgeDecision.knowledgeNeed,
        knowledgeNeedReason: knowledgeDecision.reason,
        retrievalQuery: searchText,
        knowledgeMode,
        knowledgeModeReason:
          knowledgeMode === 'retrieval_only' ? 'intent_requires_strict_knowledge' : null,
        embeddingMode: null,
        queryEmbedding: null,
        retrievalMode: null,
      }
    }

    if (skipRetrieval) {
      return {
        items: [],
        sources: [],
        sourceCount: 0,
        disabled: false,
        disabledReason: 'not_needed_for_turn',
        responseContract: knowledgeDecision.responseContract,
        knowledgeNeed: knowledgeDecision.knowledgeNeed,
        knowledgeNeedReason: knowledgeDecision.reason,
        retrievalQuery: searchText,
        knowledgeMode,
        knowledgeModeReason: 'not_needed_for_turn',
        embeddingMode: null,
        queryEmbedding: null,
        retrievalMode: null,
      }
    }

    if (knowledgeMode === 'retrieval_disabled') {
      return {
        items: [],
        disabled: true,
        disabledReason: 'debug_disabled',
        responseContract: knowledgeDecision.responseContract,
        knowledgeNeed: knowledgeDecision.knowledgeNeed,
        knowledgeNeedReason: knowledgeDecision.reason,
        retrievalQuery: searchText,
        knowledgeMode,
        knowledgeModeReason: 'debug_disabled',
        embeddingMode: null,
        queryEmbedding: null,
        retrievalMode: null,
      }
    }

    try {
      const response = await backendClient.searchKnowledge(
        searchText,
        scopeForKnowledge(scope),
        role.startsWith('admin_') || role === 'superadmin' ? 6 : 4,
        unifiedMessage.tenantKey,
      )
      return {
        ...(response ?? { items: [] }),
        disabled: false,
        disabledReason: null,
        responseContract: knowledgeDecision.responseContract,
        knowledgeNeed: knowledgeDecision.knowledgeNeed,
        knowledgeNeedReason: knowledgeDecision.reason,
        retrievalQuery: searchText,
        knowledgeMode,
        knowledgeModeReason:
          knowledgeMode === 'retrieval_only' ? 'intent_requires_strict_knowledge' : null,
        embeddingMode:
          response?.embeddingMode && typeof response.embeddingMode === 'object'
            ? response.embeddingMode
            : null,
        queryEmbedding:
          response?.queryEmbedding && typeof response.queryEmbedding === 'object'
            ? response.queryEmbedding
            : null,
        retrievalMode:
          typeof response?.retrievalMode === 'string'
            ? response.retrievalMode
            : null,
      }
    } catch (error) {
      console.warn('[ai-agent-service] Unable to retrieve knowledge context', error)
      return {
        items: [],
        disabled: false,
        disabledReason: 'retrieval_error',
        responseContract: knowledgeDecision.responseContract,
        knowledgeNeed: knowledgeDecision.knowledgeNeed,
        knowledgeNeedReason: knowledgeDecision.reason,
        retrievalQuery: searchText,
        knowledgeMode,
        knowledgeModeReason:
          knowledgeMode === 'retrieval_only' ? 'intent_requires_strict_knowledge' : null,
        embeddingMode: null,
        queryEmbedding: null,
        retrievalMode: null,
      }
    }
  }

  enforceKnowledgeModePolicy({
    response,
    retrievalContext,
    role,
    knowledgeMode,
  }) {
    if (knowledgeMode !== 'retrieval_only') {
      return response
    }

    const hasRetrievedKnowledge = Array.isArray(retrievalContext?.items)
      ? retrievalContext.items.length > 0
      : false
    const grounded = response?.grounding?.grounded === true

    if (hasRetrievedKnowledge || grounded) {
      return response
    }

    const fallbackText =
      role === 'customer_public' || role === 'customer_authenticated'
        ? 'No encuentro contenido aprobado para responder eso solo desde la base de conocimiento. Tomamos tu consulta y te respondemos a la brevedad.'
        : 'No encuentro contenido aprobado para responder esto en modo retrieval-only sin apoyarme en conocimiento paramétrico del modelo.'

    return {
      ...response,
      text: fallbackText,
      finalUserText: fallbackText,
      needsHuman: true,
      grounding: {
        ...(response?.grounding || {}),
        grounded: false,
        fallbackReason: 'retrieval_only_no_grounding',
      },
      debug: {
        ...(response?.debug || {}),
        detail: [
          response?.debug?.detail,
          'Knowledge mode retrieval_only: se bloqueó la respuesta porque no hubo retrieval útil ni grounding aprobado.',
        ]
          .filter(Boolean)
          .join(' '),
      },
      toolCalls: Array.isArray(response?.toolCalls) ? response.toolCalls : [],
    }
  }

  reconcileResponseGrounding({
    response,
    retrievalContext,
    interpretation = null,
    tenantRuntimePolicy = null,
  }) {
    return reconcileResponseGroundingAudit({
      response,
      retrievalContext,
      interpretation,
      tenantRuntimePolicy,
      compactText,
      normalizeGroundingFactList,
      extractMeaningfulTokens,
      extractTopicTokens,
      responseMentionsCanonicalTopic: (responseText, topic) =>
        this.responseMentionsCanonicalTopic(responseText, topic),
    })
  }

  preventCustomerResponseLoop({
    response,
    previousSnapshot = null,
    interpretation = null,
  }) {
    if (!response || typeof response !== 'object') {
      return response
    }

    const responseText = compactText(response?.finalUserText || response?.text || '')
    if (!responseText) {
      return response
    }
    const currentTurnText = String(
      interpretation?.currentTurnText ||
        interpretation?.effectiveInput ||
        interpretation?.originalInput ||
        '',
    )
    const paymentProofContinuityInput =
      looksLikePaymentProofArtifact(currentTurnText) ||
      looksLikePaymentProofFollowUpRequest(currentTurnText) ||
      looksLikePaymentOperationalUpdate(currentTurnText)

    const previousAgentTurn = Array.isArray(previousSnapshot?.turns)
      ? [...previousSnapshot.turns]
          .reverse()
          .find((entry) => entry?.role === 'agent' && typeof entry?.text === 'string')
      : null
    const previousAgentText = compactText(previousAgentTurn?.text || '')
    const tokenizeLoopText = (value) =>
      normalizeText(value)
        .split(/[^a-z0-9]+/u)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length >= 3)
    const tokenJaccard = (left, right) => {
      const leftSet = new Set(left)
      const rightSet = new Set(right)
      if (!leftSet.size && !rightSet.size) {
        return 1
      }
      const intersection = Array.from(leftSet).filter((token) =>
        rightSet.has(token),
      ).length
      const union = new Set([...leftSet, ...rightSet]).size
      return union === 0 ? 0 : intersection / union
    }
    const repeatedResponse =
      previousAgentText &&
      normalizeText(previousAgentText) === normalizeText(responseText)
    const loopingResponse =
      previousAgentText &&
      !repeatedResponse &&
      tokenJaccard(
        tokenizeLoopText(previousAgentText),
        tokenizeLoopText(responseText),
      ) >= 0.78
    if (paymentProofContinuityInput && !repeatedResponse && !loopingResponse) {
      return response
    }
    const readiness = readInterpretationResolutionReadiness(interpretation)
    const missingFields = Array.isArray(readiness?.missingFields)
      ? readiness.missingFields.filter((entry) => typeof entry === 'string')
      : []
    const conversationState =
      interpretation?.conversationState && typeof interpretation.conversationState === 'object'
        ? interpretation.conversationState
        : null
    const effectiveMissingFields = filterResolvedConversationFields({
      missingFields,
      conversationState,
    })
    const quoteContext =
      interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
        ? interpretation.quoteContext
        : null
    const supportContext =
      interpretation?.supportContext && typeof interpretation.supportContext === 'object'
        ? interpretation.supportContext
        : null
    const scheduleContext =
      interpretation?.scheduleContext && typeof interpretation.scheduleContext === 'object'
        ? interpretation.scheduleContext
        : null
    const resolveRequestedFieldFromResponse = (text) => {
      const normalized = normalizeText(text)
      if (!normalized) {
        return null
      }
      if (/\b(zona|direccion|dirección|domicilio|ubicacion|ubicación)\b/u.test(normalized)) {
        return 'address'
      }
      if (/\b(que dia|qué día|dia te sirve|día te sirve)\b/u.test(normalized)) {
        return 'date'
      }
      if (
        /\b(horario|franja|a que hora|a qué hora|hora te queda|hora te sirve)\b/u.test(
          normalized,
        )
      ) {
        return 'time'
      }
      if (/\b(cuantas unidades|cuántas unidades|cantidad)\b/u.test(normalized)) {
        return 'quantity'
      }
      if (
        /\b(medidas|ancho por alto|medida aproximada|medidas aproximadas)\b/u.test(
          normalized,
        )
      ) {
        return 'measurements'
      }
      if (
        /\b(que producto|qué producto|que solucion|qué solución|que queres cotizar|qué querés cotizar)\b/u.test(
          normalized,
        )
      ) {
        return 'product'
      }
      return null
    }
    const requestedField = resolveRequestedFieldFromResponse(responseText)
    const asksResolvedField =
      requestedField && isConversationFieldResolved(requestedField, conversationState)
    const quantity = Number(quoteContext?.quantity?.total || readiness?.knownFacts?.quantity || 0)
    const measurementsLabel =
      quoteContext?.measurements?.displayLabel ||
      quoteContext?.measurements?.confirmationLabel ||
      null
    const effectiveIntentKey = normalizeIntentKeyValue(
      interpretation?.intent?.key || readiness?.turnIntent || null,
    )
    const previousQuoteSubject = compactText(conversationState?.slots?.product?.value || '')
    const currentQuoteSubject = compactText(
      quoteContext?.topicLabel || quoteContext?.familyLabel || '',
    )
    const stableQuoteSubject = sanitizeLoopSubjectLabel(
      previousQuoteSubject &&
        currentQuoteSubject &&
        normalizeText(previousQuoteSubject).includes(normalizeText(currentQuoteSubject)) &&
        previousQuoteSubject.split(/\s+/u).length > currentQuoteSubject.split(/\s+/u).length
        ? previousQuoteSubject
        : currentQuoteSubject || previousQuoteSubject || null,
    )
    const hasActiveQuoteThread = Boolean(
      quoteContext?.topicLabel ||
        quoteContext?.familyLabel ||
        quantity > 0 ||
        measurementsLabel,
    )
    const quoteLoopBreakEligible =
      (readiness?.lane === 'quote' || quoteContext) &&
      effectiveIntentKey !== 'customer.schedule_request' &&
      effectiveIntentKey !== 'customer.support_request' &&
      !scheduleContext &&
      !supportContext
    const initialReadyQuoteHandoff =
      !previousAgentText &&
      ['ready_for_pricing_or_handoff', 'ready_for_handoff'].includes(
        String(quoteContext?.completionStatus || ''),
      ) &&
      looksLikeGenericQuoteHandoffResponse(responseText)
    if (initialReadyQuoteHandoff) {
      return response
    }
    const courtesyContinuationCandidate =
      looksLikeLightClosureFollowUp(currentTurnText) &&
      ((readiness?.lane === 'quote' && hasActiveQuoteThread) ||
        readiness?.lane === 'support' ||
        readiness?.lane === 'schedule' ||
        quoteContext ||
        supportContext ||
        scheduleContext) &&
      (looksLikeGenericContactResponse(responseText) ||
        looksLikeGenericQuoteIntakeResponse(responseText) ||
        looksLikeGenericQuoteHandoffResponse(responseText) ||
        looksLikeCoordinationAskResponse(responseText))
    const quoteDetailContinuationCandidate =
      hasActiveQuoteThread &&
      Boolean(previousAgentText) &&
      (readiness?.lane === 'quote' || quoteContext) &&
      looksLikeQuoteDetailFollowUp(currentTurnText) &&
      (looksLikeGenericQuoteIntakeResponse(responseText) ||
        looksLikeGenericQuoteHandoffResponse(responseText))
    const quoteSubjectSpecificityRegressionCandidate =
      hasActiveQuoteThread &&
      Boolean(previousAgentText) &&
      (looksLikeQuoteDetailFollowUp(currentTurnText) ||
        Boolean(measurementsLabel) ||
        quantity > 0) &&
      stableQuoteSubject &&
      !normalizeText(responseText).includes(normalizeText(stableQuoteSubject)) &&
      Boolean(currentQuoteSubject) &&
      normalizeText(responseText).includes(normalizeText(currentQuoteSubject))
    const strongActiveThread =
      hasActiveQuoteThread ||
      Boolean(
        interpretation?.threadResolution?.activeThread?.displayLabel ||
          interpretation?.topic?.label ||
          interpretation?.contextTopic?.label ||
          supportContext?.issueSummary ||
          supportContext?.address ||
          scheduleContext?.address ||
          scheduleContext?.date?.dateLabel ||
          scheduleContext?.time?.timeLabel,
      )
    const fallbackContractCandidate =
      strongActiveThread &&
      !looksLikeLightClosureFollowUp(currentTurnText) &&
      (looksLikeGenericClarificationResponse(responseText) ||
        looksLikeGenericConsultationClosureResponse(responseText))
    const closureLoopCandidate =
      strongActiveThread &&
      !looksLikeLightClosureFollowUp(currentTurnText) &&
      looksLikeClosureContinuationResponse(responseText)
    const partialScheduleLoopCandidate =
      (readiness?.lane === 'schedule' || scheduleContext) &&
      /\b(d[ií]a y horario|horario y d[ií]a|qu[eé] d[ií]a y horario)\b/i.test(responseText) &&
      effectiveMissingFields.length === 1 &&
      ['date', 'time'].includes(String(effectiveMissingFields[0] || ''))

    if (
      !repeatedResponse &&
      !loopingResponse &&
      !courtesyContinuationCandidate &&
      !quoteDetailContinuationCandidate &&
      !quoteSubjectSpecificityRegressionCandidate &&
      !asksResolvedField &&
      !fallbackContractCandidate &&
      !closureLoopCandidate &&
      !partialScheduleLoopCandidate
    ) {
      return response
    }

    const buildQuoteLoopBreak = () => {
      if (looksLikeLightClosureFollowUp(currentTurnText)) {
        return buildClosureContinuationReply(previousAgentText)
      }

      const stateNotes = []
      if (stableQuoteSubject) {
        stateNotes.push(`ya tomé ${stableQuoteSubject}`)
      }
      if (measurementsLabel) {
        stateNotes.push(`me queda ${measurementsLabel}`)
      }
      if (quantity > 0) {
        stateNotes.push(quantity === 1 ? 'anoto 1 unidad' : `anoto ${quantity} unidades`)
      }

      const remainingConfigurationEntries = (
        Array.isArray(quoteContext?.missingAttributes)
          ? quoteContext.missingAttributes
          : Array.isArray(quoteContext?.requiredAttributes)
          ? quoteContext.requiredAttributes.filter((attribute) =>
                effectiveMissingFields.includes(attribute?.key),
              )
            : []
      )
        .filter((attribute) => {
          const key = String(attribute?.key || '').trim()
          if (!key) {
            return false
          }

          if (
            effectiveMissingFields.includes('measurements') &&
            (key === 'measurements' || key === 'measurement_items')
          ) {
            return false
          }

          if (effectiveMissingFields.includes('quantity') && key === 'quantity') {
            return false
          }

          if (effectiveMissingFields.includes('product') && key === 'product') {
            return false
          }

          return true
        })
        .map((attribute) => ({
          key: compactText(attribute?.key || ''),
          label: compactText(
            attribute?.label || attribute?.subjectPrefix || attribute?.key || '',
          ),
        }))
        .filter((entry) => entry.key && entry.label)
      const uniqueRemainingConfigurationEntries = Array.from(
        new Map(
          remainingConfigurationEntries.map((entry) => [
            normalizeText(entry.key || entry.label),
            entry,
          ]),
        ).values(),
      )
      const preferredRemainingConfigurationEntry =
        uniqueRemainingConfigurationEntries.length > 1 &&
        conversationState?.lastAskedSlot &&
        String(conversationState.lastAskedSlot) ===
          String(uniqueRemainingConfigurationEntries[0]?.key || '')
          ? uniqueRemainingConfigurationEntries[1]
          : uniqueRemainingConfigurationEntries[0] || null
      const nextTenantConfigurationLabel =
        preferredRemainingConfigurationEntry?.label || null
      const remainingConfigurationLabel =
        uniqueRemainingConfigurationEntries.length === 0
          ? null
          : uniqueRemainingConfigurationEntries.length === 1
            ? uniqueRemainingConfigurationEntries[0].label
            : `${uniqueRemainingConfigurationEntries
                .slice(0, -1)
                .map((entry) => entry.label)
                .join(', ')} y ${uniqueRemainingConfigurationEntries.at(-1)?.label}`
      const coreQuoteMissingFields = effectiveMissingFields.filter((field) =>
        ['measurements', 'quantity', 'product'].includes(String(field || '')),
      )
      const onlyTenantConfigurationPending =
        quoteLoopBreakEligible &&
        coreQuoteMissingFields.length === 0 &&
        Boolean(remainingConfigurationLabel)
      const repeatedMeasurementsAskCandidate =
        (repeatedResponse || loopingResponse) &&
        conversationState?.lastAskedSlot === 'dimensions' &&
        effectiveMissingFields.includes('measurements')
      const repeatedQuantityAskCandidate =
        (repeatedResponse || loopingResponse) &&
        conversationState?.lastAskedSlot === 'quantity' &&
        effectiveMissingFields.includes('quantity')

      const nextAsk =
        repeatedMeasurementsAskCandidate
          ? 'Si no las tenés exactas, pasame una medida aproximada o una foto y avanzo con eso.'
          : repeatedQuantityAskCandidate
            ? 'Si no sabés la cantidad exacta, decime aunque sea aproximada y sigo con eso.'
            : effectiveMissingFields.includes('measurements')
          ? remainingConfigurationLabel
            ? `Decime las medidas aproximadas (ancho por alto). Si ya lo sabés, después confirmame ${remainingConfigurationLabel}.`
            : 'Decime las medidas aproximadas (ancho por alto).'
          : effectiveMissingFields.includes('quantity')
            ? remainingConfigurationLabel
              ? `Decime cuántas unidades necesitás. Si ya lo sabés, además confirmame ${remainingConfigurationLabel}.`
              : 'Decime cuántas unidades necesitás.'
            : effectiveMissingFields.includes('product')
              ? 'Decime qué producto querés cotizar.'
              : nextTenantConfigurationLabel
                ? stableQuoteSubject
                  ? `Para seguir con la cotización de ${stableQuoteSubject}, confirmame ${nextTenantConfigurationLabel}.`
                  : `Para seguir con la cotización, confirmame ${nextTenantConfigurationLabel}.`
                : null
      if (quoteDetailContinuationCandidate) {
        return compactText(
          [
            'Perfecto.',
            stableQuoteSubject
              ? `Sumo ese dato para la misma cotización de ${stableQuoteSubject}.`
              : 'Sumo ese dato para la misma cotización.',
            nextAsk || 'La dejamos encaminada y, si hace falta algo más, seguimos por acá.',
          ]
            .filter(Boolean)
            .join(' '),
        )
      }
      if (quoteSubjectSpecificityRegressionCandidate && stableQuoteSubject) {
        if (measurementsLabel) {
          return compactText(
            [
              'Perfecto.',
              `Tomo una medida aproximada de ${measurementsLabel} para ${stableQuoteSubject}.`,
              nextAsk || 'La dejamos encaminada y, si hace falta algo más, seguimos por acá.',
            ].join(' '),
          )
        }
        return compactText(
          [
            'Perfecto.',
            `Sumo ese dato para la misma cotización de ${stableQuoteSubject}.`,
            nextAsk || 'La dejamos encaminada y, si hace falta algo más, seguimos por acá.',
          ].join(' '),
        )
      }
      if (onlyTenantConfigurationPending) {
        return compactText(
          [
            'Perfecto.',
            stateNotes.length ? `${stateNotes.join(', ')}.` : null,
            nextAsk,
          ]
            .filter(Boolean)
            .join(' '),
        )
      }
      if (!nextAsk) {
        return null
      }

      return compactText(
        [
          'Perfecto.',
          stateNotes.length ? `${stateNotes.join(', ')}.` : null,
          nextAsk,
        ]
          .filter(Boolean)
          .join(' '),
      )
    }

    const buildSupportLoopBreak = () => {
      if (looksLikeLightClosureFollowUp(currentTurnText)) {
        return buildClosureContinuationReply(previousAgentText)
      }

      const stateNotes = []
      if (supportContext?.productType) {
        stateNotes.push(`ya tomo que es ${supportContext.productType}`)
      }
      if (supportContext?.issueSummary) {
        stateNotes.push('ya me queda qué habría que revisar')
      }
      if (supportContext?.address) {
        stateNotes.push('ya tengo la dirección')
      }

      const nextAsk =
        effectiveMissingFields.includes('issue')
          ? 'Contame qué falla o qué habría que revisar.'
          : effectiveMissingFields.includes('product')
            ? 'Decime qué producto es.'
            : effectiveMissingFields.includes('date')
              ? 'Decime qué día te sirve.'
              : effectiveMissingFields.includes('time')
                ? 'Decime qué horario te queda mejor.'
                : effectiveMissingFields.includes('address')
                  ? 'Pasame la zona o dirección.'
                  : effectiveMissingFields.includes('contact')
                    ? 'Pasame un teléfono o mail de contacto.'
                    : null
      if (!nextAsk) {
        return null
      }

      return compactText(
        [
          'Perfecto.',
          stateNotes.length ? `${stateNotes.join(', ')}.` : null,
          nextAsk,
        ]
          .filter(Boolean)
          .join(' '),
      )
    }

    const buildScheduleLoopBreak = () => {
      if (looksLikeLightClosureFollowUp(currentTurnText)) {
        return buildClosureContinuationReply(previousAgentText)
      }

      const stateNotes = []
      const scheduleDateLabel =
        scheduleContext?.date?.dateLabel || scheduleContext?.date?.label || null
      const scheduleTimeLabel =
        scheduleContext?.time?.timeLabel || scheduleContext?.time?.label || null
      if (scheduleContext?.address) {
        stateNotes.push('ya tengo la dirección')
      }
      if (scheduleDateLabel) {
        stateNotes.push(`me sirve ${scheduleDateLabel}`)
      }
      if (scheduleTimeLabel) {
        stateNotes.push(`y ${scheduleTimeLabel}`)
      }

      const nextAsk =
        effectiveMissingFields.includes('date')
          ? 'Decime qué día te sirve.'
          : effectiveMissingFields.includes('time')
            ? 'Decime qué horario te queda mejor.'
            : effectiveMissingFields.includes('address')
              ? 'Pasame la zona o dirección.'
              : effectiveMissingFields.includes('contact')
                ? 'Pasame un teléfono o mail de contacto.'
                : null
      if (!nextAsk) {
        return null
      }

      return compactText(
        [
          'Perfecto.',
          stateNotes.length ? `${stateNotes.join(', ')}.` : null,
          nextAsk,
        ]
          .filter(Boolean)
          .join(' '),
      )
    }

    const buildGenericLoopBreak = () => {
      const subjectLabel = sanitizeLoopSubjectLabel(
        interpretation?.topic?.label ||
          interpretation?.contextTopic?.label ||
          quoteContext?.topicLabel ||
          quoteContext?.familyLabel ||
          supportContext?.productType ||
          '',
      )

      if (looksLikeLightClosureFollowUp(currentTurnText)) {
        return buildClosureContinuationReply(previousAgentText)
      }

      if (looksLikeAwaitingProofResponse(responseText)) {
        if (looksLikePaymentProofArtifact(currentTurnText)) {
          return 'Perfecto. Recibí el comprobante y lo dejo en seguimiento para confirmar la acreditación a la brevedad.'
        }
        if (
          looksLikePaymentProofFollowUpRequest(currentTurnText) ||
          looksLikePaymentOperationalUpdate(currentTurnText)
        ) {
          return 'Perfecto. Quedo atento al comprobante por acá para dejarlo en seguimiento.'
        }
      }

      if (looksLikeGenericClarificationResponse(responseText)) {
        if (looksLikeOperationalStatusContinuation(currentTurnText)) {
          return 'Perfecto. Si esto sigue por coordinación o visita, pasame día, horario o dirección y avanzo por ahí.'
        }
        if (subjectLabel) {
          return `Claro. Si seguimos con ${subjectLabel}, decime si querés precio, fotos o material de referencia, o coordinar cómo seguir.`
        }
        if (looksLikeAttachmentReference(currentTurnText)) {
          return 'Perfecto. Recibí eso. Decime si esto sigue por una cotización, una revisión o una coordinación, y avanzo por ahí.'
        }
        return 'Perfecto. Para no mezclar temas, decime si esto sigue por una cotización, una revisión o una coordinación, y avanzo por ahí.'
      }

      if (looksLikeGenericConsultationClosureResponse(responseText)) {
        if (
          looksLikeGenericPriceInquiry(currentTurnText) ||
          hasCatalogVocabularySignal(currentTurnText, tenantRuntimePolicy)
        ) {
          return 'Claro. Si es por esa consulta, pasame la medida aproximada y te oriento con la cotización.'
        }
        if (/\b(ambas|los dos|las dos)\b/i.test(currentTurnText)) {
          return 'Perfecto. Si querés ambas opciones, te las comparo por acá. Si podés, pasame la medida aproximada.'
        }
      }

      if (looksLikeGenericContactResponse(responseText)) {
        if (readiness?.lane === 'schedule' || scheduleContext) {
          return (
            buildScheduleLoopBreak() ||
            'Perfecto. Con eso lo dejamos encaminado. Decime qué día u horario te queda mejor.'
          )
        }
        if (readiness?.lane === 'support' || supportContext) {
          return (
            buildSupportLoopBreak() ||
            'Perfecto. Con eso lo dejamos encaminado. Pasame zona o dirección y qué día u horario te queda bien.'
          )
        }
        if (
          /\b(tiempo de entrega|cuanto demora|cuánto demora|demora|cuanto tarda|cuánto tarda|tarda|plazo de entrega|entrega)\b/i.test(
            currentTurnText,
          )
        ) {
          return 'Claro. El tiempo de entrega se confirma según el trabajo y la agenda disponible. Si querés, te lo dejo encaminado para que te lo confirmen por acá.'
        }
        if (
          looksLikeAmountOnlyReply(currentTurnText) ||
          /\b(cuenta bancaria|cuenta|transferencia|se[nñ]a|comprobante|giro)\b/i.test(
            currentTurnText,
          )
        ) {
          return 'Perfecto. Si vas a transferir o dejar una seña, cuando hagas el pago mandame el comprobante por acá y lo dejamos encaminado.'
        }
        if (looksLikeAddressOrTimeReply(currentTurnText)) {
          return 'Perfecto. Con eso ya lo encamino. Si querés coordinar visita o revisión, decime qué día u horario te queda mejor.'
        }
      }

      if (looksLikeGenericQuoteIntakeResponse(responseText)) {
        if (looksLikeOperationalStatusContinuation(currentTurnText)) {
          return 'Perfecto. Si preferís coordinar visita para medir o revisar, pasame la zona o dirección y qué día u horario te queda bien.'
        }
        if (
          subjectLabel &&
          /\b(foto|fotos|imagen|imagenes|material|catalogo|cat[aá]logo|referencias)\b/i.test(
            currentTurnText,
          )
        ) {
          return `Claro. Si querés referencias de ${subjectLabel}, lo dejo encaminado para compartir fotos o material por este canal.`
        }
      }

      if (looksLikeGenericQuoteHandoffResponse(responseText)) {
        if (looksLikeLightClosureFollowUp(currentTurnText)) {
          return buildClosureContinuationReply(previousAgentText)
        }
        if (subjectLabel || looksLikeQuoteDetailFollowUp(currentTurnText)) {
          return compactText(
            [
              'Perfecto.',
              subjectLabel
                ? `Sumo ese dato para la misma cotización de ${subjectLabel}.`
                : 'Sumo ese dato para la misma cotización.',
              'La dejamos encaminada y, si hace falta algo más, seguimos por acá.',
            ].join(' '),
          )
        }
      }

      return null
    }

    let rewrittenText = null
    if (quoteLoopBreakEligible) {
      rewrittenText = buildQuoteLoopBreak()
    }

    if (!rewrittenText && (readiness?.lane === 'schedule' || scheduleContext)) {
      rewrittenText = buildScheduleLoopBreak()
    }

    if (!rewrittenText && (readiness?.lane === 'support' || supportContext)) {
      rewrittenText = buildSupportLoopBreak()
    }

    if (!rewrittenText) {
      rewrittenText = buildGenericLoopBreak()
    }

    if (!rewrittenText || normalizeText(rewrittenText) === normalizeText(responseText)) {
      return response
    }

    return {
      ...response,
      text: rewrittenText,
      finalUserText: rewrittenText,
      debug: {
        ...(response?.debug || {}),
        detail: response?.debug?.detail
          ? `${response.debug.detail} Se reformuló la salida para cortar un loop y avanzar con el próximo dato útil.`
          : 'Se reformuló la salida para cortar un loop y avanzar con el próximo dato útil.',
      },
    }
  }

  async getOperationalContext(
    unifiedMessage,
    role,
    actionCatalog,
    backendClient = this.backendClient,
    resolvedActionIntent = null,
    resolvedIntentKey = null,
    tenantRuntimePolicy = null,
  ) {
    const input = unifiedMessage.text?.trim()
    if (!input || input.length < 4) {
      return { items: [], toolCalls: [] }
    }

    const normalized = input.toLowerCase()
    const actionIntent = resolvedActionIntent || findActionIntent(normalized, actionCatalog)
    const executions = []
    const queuedSearches = new Set()
    const queueSearch = async (toolName, query) => {
      const cleanQuery = query?.trim()
      if (!cleanQuery || cleanQuery.length < 2) {
        return
      }
      const dedupeKey = `${toolName}:${cleanQuery.toLowerCase()}`
      if (queuedSearches.has(dedupeKey)) {
        return
      }
      queuedSearches.add(dedupeKey)
      try {
        let result = []
        if (toolName === 'search_customers') {
          result = await backendClient.searchCustomers(cleanQuery, 5)
        } else if (toolName === 'search_orders') {
          result = await backendClient.searchOrders(cleanQuery, 5, 'ORDER')
        } else if (toolName === 'search_quotes') {
          result = await backendClient.searchOrders(cleanQuery, 5, 'BUDGET')
        } else if (toolName === 'search_payments') {
          result = await backendClient.searchPayments(cleanQuery, 5)
        } else if (toolName === 'search_appointments') {
          result = await backendClient.searchAppointments(cleanQuery, 5)
        } else if (toolName === 'search_products') {
          result = await backendClient.searchProducts(cleanQuery, 5)
        } else if (toolName === 'search_categories') {
          result = await backendClient.searchCategories(cleanQuery, 5)
        }
        executions.push({
          name: toolName,
          arguments: { query: cleanQuery, limit: 5 },
          result,
          status: 'executed',
        })
      } catch (error) {
        executions.push({
          name: toolName,
          arguments: { query: cleanQuery, limit: 5 },
          result: null,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'preflight search failed',
        })
      }
    }

    const buildContextPayload = () => {
      const items = executions.map((entry) =>
        entry.status === 'failed'
          ? `${entry.name}: búsqueda previa fallida para "${entry.arguments.query || entry.arguments.text || 'la solicitud'}".`
          : summarizeResults(entry.name, entry.result),
      )
      const matches = executions
        .filter((entry) => {
          if (entry.status !== 'executed') {
            return false
          }
          if (isStructuredCatalogToolName(entry.name)) {
            return Boolean(entry.result?.itemCount)
          }
          return Array.isArray(entry.result) && entry.result.length > 0
        })
        .map((entry) => summarizeMatchesForUser(entry.name, entry.result))
        .filter(Boolean)

      return {
        items,
        matches,
        toolCalls: executions,
      }
    }

    const productTerm =
      extractNamedEntity(input, [
        /\bproducto\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|por|y|,|$))/iu,
      ]) ||
      findBestPolicyTopicMatch(input, tenantRuntimePolicy)?.label ||
      null

    if (!(role.startsWith('admin_') || role === 'superadmin')) {
      const customerIntent = resolvedIntentKey || 'customer.other'
      if (
        customerIntent === 'customer.quote' ||
        customerIntent === 'customer.product_info'
      ) {
        await queueSearch(
          'search_products',
          buildCustomerProductSearchQuery(productTerm || input, tenantRuntimePolicy),
        )
      }
      return buildContextPayload()
    }

    if (!actionIntent) {
      return { items: [], toolCalls: [] }
    }

    const customerTerm = normalizeEntityQuery(extractNamedEntity(input, [
      /\b(?:cliente|para el cliente|para)\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|por|para|y)\b|,|$)/iu,
      /\bpedido\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:por|con)\b|,|$)/iu,
      /\bpresupuesto\s+para\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:por|con)\b|,|$)/iu,
    ]))

    if (actionIntent.key === 'customers.update') {
      await queueSearch('search_customers', customerTerm || input)
    }

    if (
      actionIntent.key === 'appointments.update' ||
      actionIntent.key === 'appointments.delete'
    ) {
      await queueSearch('search_appointments', input)
    }

    if (actionIntent.key === 'categories.create') {
      await queueSearch('search_categories', input)
    }

    if (actionIntent.key === 'categories.update') {
      await queueSearch('search_categories', input)
    }

    if (actionIntent.key === 'orders.create' || actionIntent.key === 'quotes.create') {
      await queueSearch('search_customers', customerTerm || input)
      await queueSearch(
        'search_products',
        buildCustomerProductSearchQuery(productTerm || input, tenantRuntimePolicy),
      )
    }

    if (actionIntent.key === 'payments.create') {
      const orderTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpedido\s+((?:\d{2,}|[a-f0-9-]{8,}))(?=\s|$)/iu,
          /\bpedido\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:por|con)\b|,|$)/iu,
        ]),
      ) || customerTerm
      await queueSearch('search_orders', orderTerm || input)
      if (customerTerm) {
        await queueSearch('search_customers', customerTerm)
      }
    }

    if (actionIntent.key === 'orders.update_status') {
      const orderTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpedido\s+((?:\d{2,}|[a-f0-9-]{8,}))(?=\s|$)/iu,
          /\bpedido\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:a|como|por|con)\b|,|$)/iu,
        ]),
      )
      await queueSearch('search_orders', orderTerm || customerTerm || input)
    }

    if (
      actionIntent.key === 'orders.update_comment' ||
      actionIntent.key === 'orders.update_structure'
    ) {
      const orderTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpedido\s+((?:\d{2,}|[a-f0-9-]{8,}))(?=\s|$)/iu,
          /\bpedido\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|para|por)\b|,|$)/iu,
        ]),
      )
      await queueSearch('search_orders', orderTerm || customerTerm || input)
    }

    if (
      actionIntent.key === 'quotes.update_status' ||
      actionIntent.key === 'quotes.send' ||
      actionIntent.key === 'quotes.confirm' ||
      actionIntent.key === 'quotes.update_structure'
    ) {
      const quoteTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpresupuesto\s+((?:\d{2,}|[a-f0-9-]{8,}))(?=\s|$)/iu,
          /\bpresupuesto\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:a|como|por|con)\b|,|$)/iu,
        ]),
      )
      await queueSearch('search_quotes', quoteTerm || customerTerm || input)
    }

    if (actionIntent.key === 'quotes.update_comment') {
      const quoteTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpresupuesto\s+((?:\d{2,}|[a-f0-9-]{8,}))(?=\s|$)/iu,
          /\bpresupuesto\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|para|por)\b|,|$)/iu,
        ]),
      )
      await queueSearch('search_quotes', quoteTerm || customerTerm || input)
    }

    if (actionIntent.key === 'quotes.update_structure' || actionIntent.key === 'orders.update_structure') {
      await queueSearch('search_products', productTerm || input)
    }

    if (actionIntent.key === 'payments.update_status') {
      const paymentTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpago\s+((?:\d{2,}|[a-z0-9-]{4,}))(?=\s|$)/iu,
          /\bpago\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:a|como|por|con)\b|,|$)/iu,
        ]),
      )
      await queueSearch('search_payments', paymentTerm || input)
      if (customerTerm) {
        await queueSearch('search_customers', customerTerm)
      }
    }

    if (actionIntent.key === 'payments.update') {
      const paymentTerm = normalizeEntityQuery(
        extractNamedEntity(input, [
          /\bpago\s+((?:\d{2,}|[a-z0-9-]{4,}))(?=\s|$)/iu,
          /\bpago\s+de\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|para|por)\b|,|$)/iu,
        ]),
      )
      await queueSearch('search_payments', paymentTerm || input)
      if (customerTerm) {
        await queueSearch('search_customers', customerTerm)
      }
    }

    if (
      actionIntent.key === 'products.update' ||
      actionIntent.key === 'products.archive' ||
      actionIntent.key === 'products.adjust_stock' ||
      actionIntent.key === 'products.publish'
    ) {
      await queueSearch('search_products', productTerm || input)
    }

    if (actionIntent.key === STRUCTURED_CATALOG_PARSE_INTENT) {
      try {
        const result = await backendClient.parseStructuredCatalogItems({
          text: input,
          source: 'admin_internal_chat',
        })
        executions.push({
          name: STRUCTURED_CATALOG_PARSE_TOOL,
          arguments: { text: input, source: 'admin_internal_chat' },
          result,
          status: 'executed',
        })
      } catch (error) {
        executions.push({
          name: STRUCTURED_CATALOG_PARSE_TOOL,
          arguments: { text: input, source: 'admin_internal_chat' },
          result: null,
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'structured catalog parse failed',
        })
      }
    }

    if (actionIntent.key === STRUCTURED_CATALOG_REGISTER_INTENT) {
      try {
        const result = await backendClient.prepareStructuredCatalogInsert({
          text: input,
          source: 'admin_internal_chat',
        })
        executions.push({
          name: STRUCTURED_CATALOG_INSERT_TOOL,
          arguments: { text: input, source: 'admin_internal_chat' },
          result,
          status: 'executed',
        })
      } catch (error) {
        executions.push({
          name: STRUCTURED_CATALOG_INSERT_TOOL,
          arguments: { text: input, source: 'admin_internal_chat' },
          result: null,
          status: 'failed',
          errorMessage:
            error instanceof Error
              ? error.message
              : 'structured catalog insert draft failed',
        })
      }
    }

    if (actionIntent.key === STRUCTURED_CATALOG_PREPARE_QUOTE_INTENT) {
      try {
        const result = await backendClient.prepareStructuredCatalogQuote({
          text: input,
          source: 'admin_internal_chat',
        })
        executions.push({
          name: STRUCTURED_CATALOG_QUOTE_TOOL,
          arguments: { text: input, source: 'admin_internal_chat' },
          result,
          status: 'executed',
        })
      } catch (error) {
        executions.push({
          name: STRUCTURED_CATALOG_QUOTE_TOOL,
          arguments: { text: input, source: 'admin_internal_chat' },
          result: null,
          status: 'failed',
          errorMessage:
            error instanceof Error
              ? error.message
              : 'structured catalog quote draft failed',
        })
      }
    }

    return buildContextPayload()
  }

  annotateOperationalMatches(response, operationalContext, role) {
    const matches = deriveOperationalMatches({
      matches: operationalContext?.matches,
      toolCalls: [
        ...(Array.isArray(operationalContext?.toolCalls)
          ? operationalContext.toolCalls
          : []),
        ...(Array.isArray(response?.toolCalls) ? response.toolCalls : []),
      ],
    })
    if (
      !(role.startsWith('admin_') || role === 'superadmin') ||
      matches.length === 0 ||
      typeof response?.text !== 'string'
    ) {
      return response
    }

    if (/coincidencias encontradas|encontr[eé]|matches/i.test(response.text)) {
      return response
    }

    const annotatedText = `Coincidencias encontradas: ${matches.join('; ')}.\n\n${response.text}`

    return {
      ...response,
      finalUserText: annotatedText,
      text: annotatedText,
    }
  }

  applyGroundingFallback(input, role, retrievalContext, response) {
    const hasToolCalls = Array.isArray(response?.toolCalls) && response.toolCalls.length > 0
    const hasApprovedContext =
      Array.isArray(retrievalContext?.items) && retrievalContext.items.length > 0
    const normalized = (input || '').trim().toLowerCase()
    const wordingKey = String(response?.wordingKey || '')
    const safeDeterministicConversation =
      response?.debug?.actionKey === 'customer.light' ||
      response?.debug?.actionKey === 'customer.clarify_request' ||
      response?.debug?.actionKey === 'customer.rephrase_request' ||
      response?.debug?.actionKey === 'customer.unintelligible' ||
      response?.debug?.actionKey === 'customer.incomplete' ||
      response?.debug?.actionKey === 'customer.product_info' ||
      response?.debug?.actionKey === 'customer.topic_info' ||
      response?.debug?.actionKey === 'customer.price_inquiry' ||
      response?.debug?.actionKey === 'customer.quote' ||
      response?.debug?.actionKey === 'customer.support_request' ||
      response?.debug?.actionKey === 'customer.schedule_request' ||
      response?.debug?.actionKey === 'customer.auth_required' ||
      response?.debug?.actionKey === 'customer.owned_document_request' ||
      response?.debug?.actionKey === 'customer.private_account_data' ||
      response?.debug?.actionKey === 'customer.contact_info' ||
      response?.debug?.actionKey === 'customer.multi_intent' ||
      response?.debug?.actionKey === 'customer.repetition' ||
      response?.debug?.actionKey === 'customer.confirmation' ||
      response?.debug?.actionKey === 'customer.cancellation' ||
      response?.debug?.actionKey === 'customer.frustration' ||
      response?.debug?.actionKey === 'customer.sensitive' ||
      response?.debug?.actionKey === 'customer.out_of_scope' ||
      response?.debug?.actionKey === 'customer.multimodal' ||
      response?.debug?.actionKey === 'customer.reengagement' ||
      wordingKey.startsWith('customer.multimodal.') ||
      wordingKey.startsWith('customer.reengagement.') ||
      response?.debug?.actionKey === 'admin.light' ||
      response?.debug?.actionKey === 'admin.capabilities'

    if (typeof response?.grounding?.fallbackReason === 'string') {
      return response
    }

    if (
      hasToolCalls ||
      hasApprovedContext ||
      this.isLightweightGreeting(normalized) ||
      safeDeterministicConversation
    ) {
      return response
    }

    if (isAdminConversationalRole(role)) {
      return {
        ...response,
        text: this.buildSharedOutcomeText({
          audience: 'admin',
          outcome: 'low_confidence',
        }),
        toolCalls: [],
        needsHuman: false,
        grounding: {
          grounded: false,
          fallbackReason: 'missing_approved_context',
        },
      }
    }

    return {
      ...response,
      text: this.buildSharedOutcomeText({
        audience: 'customer',
        outcome: 'low_confidence',
      }),
      toolCalls: [],
      needsHuman: false,
      grounding: {
        grounded: false,
        fallbackReason: 'missing_approved_context',
      },
    }
  }

  isLightweightGreeting(input) {
    return [
      'hola',
      'buenas',
      'buen día',
      'buen dia',
      'buenas tardes',
      'buenas noches',
      'gracias',
      'ok',
    ].includes(input)
  }

  buildProviderSignature(config) {
    return JSON.stringify({
      provider: config?.modelProvider || null,
      model: config?.modelName || null,
      openAiApiKey: config?.openAiApiKey || '',
      updatedAt: config?.updatedAt || null,
    })
  }

  async refreshQuotaStatus() {
    const now = Date.now()
    if (now - this.quotaStatusLoadedAt < 30_000) {
      return this.quotaStatus
    }

    try {
      const snapshot = await this.backendClient.getUsageSnapshot()
      this.quotaStatus = snapshot?.quota ?? null
    } catch (error) {
      console.warn('[ai-agent-service] Unable to refresh quota status', error)
      this.quotaStatus = null
    }

    this.quotaStatusLoadedAt = now
    return this.quotaStatus
  }

  async ensureProviderQuotaAvailable() {
    if (this.provider?.providerName !== 'openai') {
      return { allowed: true, quota: null }
    }

    const quota = await this.refreshQuotaStatus()
    if (quota?.exceeded) {
      return { allowed: false, quota }
    }

    return { allowed: true, quota }
  }

  buildProviderFallbackResponse({
    role,
    roleConfig,
    intentKey,
    input,
    retrievalContext,
    operationalContext,
    fallbackReason,
    interpretation = null,
    tenantTopicTaxonomy = [],
    tenantRuntimePolicy = null,
    previousIntentKey = null,
    channel = null,
  }) {
    return (
      this.buildCustomerKnowledgeFallbackResponse({
        role,
        intentKey,
        input,
        retrievalContext,
        fallbackReason,
        interpretation,
        tenantTopicTaxonomy,
        tenantRuntimePolicy,
        previousIntentKey,
        channel,
      }) ||
      this.buildCustomerSearchFallbackResponse({
        role,
        intentKey,
        operationalContext,
        fallbackReason,
        input,
        interpretation,
        tenantTopicTaxonomy,
      }) || {
        text: this.buildSharedOutcomeText({
          audience: this.getConversationAudience(role),
          outcome: 'provider_failure',
        }),
        toolCalls: [],
        needsHuman: roleConfig?.type === 'customer',
        grounding: {
          grounded: false,
          fallbackReason,
        },
      }
    )
  }

  createTurnBackendClient(baseClient) {
    const runtime = this
    const cache = new Map()
    const cacheableMethods = new Set([
      'searchKnowledge',
      'searchProducts',
      'searchCategories',
      'searchCustomers',
      'searchAppointments',
      'searchOrders',
      'searchPayments',
    ])

    const cloneCachedResult = (value) =>
      value == null ? value : structuredClone(value)

    return new Proxy(baseClient, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver)
        if (prop === 'scoped' && typeof value === 'function') {
          return (role) => runtime.createTurnBackendClient(value.call(target, role))
        }
        if (typeof value !== 'function') {
          return value
        }
        if (!cacheableMethods.has(String(prop))) {
          return value.bind(target)
        }
        return async (...args) => {
          const cacheKey = `${String(prop)}:${JSON.stringify(args)}`
          if (cache.has(cacheKey)) {
            return cloneCachedResult(cache.get(cacheKey))
          }
          const result = await value.apply(target, args)
          cache.set(cacheKey, cloneCachedResult(result))
          return cloneCachedResult(result)
        }
      },
    })
  }

  filterToolsForIntent(tools, actionIntent, role, input) {
    if (!Array.isArray(tools)) {
      return { tools: [], blockedTools: [] }
    }

    const blockedTools = []
    if (!actionIntent) {
      return { tools, blockedTools }
    }

    const searchTools = tools.filter((tool) => tool.name.startsWith('search_'))
    const allowedNames = new Set(searchTools.map((tool) => tool.name))
    if (actionIntent.toolName) {
      allowedNames.add(actionIntent.toolName)
    }

    if (
      actionIntent.key === STRUCTURED_CATALOG_PARSE_INTENT ||
      actionIntent.key === STRUCTURED_CATALOG_REGISTER_INTENT
    ) {
      for (const tool of tools) {
        if (tool.name === STRUCTURED_CATALOG_QUOTE_TOOL) {
          blockedTools.push(tool.name)
          allowedNames.delete(tool.name)
        }
        if (
          actionIntent.key === STRUCTURED_CATALOG_REGISTER_INTENT &&
          tool.name === STRUCTURED_CATALOG_PARSE_TOOL
        ) {
          blockedTools.push(tool.name)
          allowedNames.delete(tool.name)
        }
      }
    }

    const requiresConfirmation =
      actionIntent.toolName &&
      roleRequiresConfirmation(role, actionIntent.toolName, this.roleCatalog)
    if (requiresConfirmation && !hasExplicitConfirmation(input)) {
      blockedTools.push(actionIntent.toolName)
      allowedNames.delete(actionIntent.toolName)
    }

    const filteredTools = tools.filter(
      (tool) =>
        allowedNames.has(tool.name) &&
        canRoleUseTool(role, tool.name, this.roleCatalog),
    )

    if (
      actionIntent?.toolName &&
      !filteredTools.some((tool) => tool.name === actionIntent.toolName) &&
      !blockedTools.includes(actionIntent.toolName)
    ) {
      blockedTools.push(actionIntent.toolName)
    }

    return {
      tools: filteredTools,
      blockedTools: Array.from(new Set(blockedTools)),
    }
  }

  buildStructuredCatalogRegisterDraft(actionIntent, operationalContext) {
    const insertDraft = this.getExecutedToolResult(
      operationalContext?.toolCalls,
      STRUCTURED_CATALOG_INSERT_TOOL,
    )

    if (!insertDraft) {
      return null
    }

    const readyItems = Array.isArray(insertDraft.items)
      ? insertDraft.items.filter((item) => item?.validForInsert && item?.insertPayload)
      : []
    const pendingItems = Array.isArray(insertDraft.items)
      ? insertDraft.items.filter((item) => !item?.validForInsert)
      : []

    return {
      actionKey: actionIntent.key,
      ready: readyItems.length > 0,
      intro: 'He preparado el alta al sistema de los ítems estructurados detectados.',
      sections: [
        {
          title: 'Listas para alta',
          items: readyItems.map((item) => formatStructuredCatalogInsertItem(item)),
        },
        {
          title: 'Pendientes',
          items: pendingItems.map((item) => formatStructuredCatalogPendingItem(item)),
        },
      ],
      confirmationPrompt:
        '¿Deseas agregar al sistema los ítems válidos? Si confirmas, crearé los productos y te devolveré el enlace al detalle.',
      pendingPrompt:
        'Todavía no hay ítems suficientes para completar el alta. Corrige los faltantes y vuelve a intentarlo.',
      execute: {
        type: 'batch',
        items: readyItems.map((item) => ({
          toolName: 'create_product',
          payload: item.insertPayload,
          verifyEntity: 'product',
          successLabel: resolveStructuredCatalogSuccessLabel(item),
        })),
      },
      batchSuccessTitle: 'Alta ejecutada correctamente para los siguientes productos:',
      debugDetail: `Se usó ${STRUCTURED_CATALOG_INSERT_TOOL} sobre el texto de entrada. Ítems listos: ${readyItems.length}. Ítems pendientes: ${pendingItems.length}.`,
    }
  }

  buildAppointmentCreateDraft(actionIntent, input) {
    const actionDefinition = getActionDefinition(actionIntent?.key)
    const draftPresentation = actionDefinition?.draftPresentation || {}
    const execution = getActionExecutionDefinition(actionIntent?.key)
    const appointmentDraft = this.extractAppointmentDraft(input)
    const confirmed = []
    const missing = []

    if (appointmentDraft.title) {
      confirmed.push(`título: ${appointmentDraft.title}`)
    } else {
      missing.push('título')
    }

    if (appointmentDraft.startLabel) {
      confirmed.push(`inicio: ${appointmentDraft.startLabel}`)
    } else {
      missing.push('fecha y hora de inicio')
    }

    if (appointmentDraft.location) {
      confirmed.push(`ubicación: ${appointmentDraft.location}`)
    } else {
      missing.push('ubicación')
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0,
      intro:
        draftPresentation.intro || 'Identifiqué una nueva cita para agendar.',
      sections: [
        { title: 'Confirmados', items: confirmed },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt:
        draftPresentation.confirmationPrompt ||
        '¿Deseas agendar esta cita? Si confirmas, la crearé ahora.',
      pendingPrompt:
        draftPresentation.pendingPrompt ||
        'Antes de seguir necesito completar esos datos.',
      execute: {
        type: 'single',
        toolName: execution?.toolName || 'create_appointment',
        payload: {
          title: appointmentDraft.title,
          startAt: appointmentDraft.startAt,
          location: appointmentDraft.location || undefined,
        },
        verifyEntity: execution?.verifyEntity ?? 'appointment',
        verifyMode: execution?.verifyMode ?? 'detail',
      },
      executionSuccessPrefix:
        draftPresentation.successPrefix || 'Cita creada correctamente.',
      errorText:
        draftPresentation.errorText ||
        'La confirmación fue recibida, pero la creación de la cita falló. Revisa el payload y el error reportado abajo.',
      debugDetail:
        draftPresentation.debugDetail ||
        'Se extrajeron título, fecha/hora y ubicación desde el texto de entrada para una creación confirmable.',
    }
  }

  buildAppointmentUpdateDraft(actionIntent, input, operationalContext) {
    const actionDefinition = getActionDefinition(actionIntent?.key)
    const draftPresentation = actionDefinition?.draftPresentation || {}
    const execution = getActionExecutionDefinition(actionIntent?.key)
    const explicitId = this.extractExplicitId(input, ['actividad', 'cita'])
    const target = this.selectEntityMatch(
      this.getExecutedToolResult(operationalContext?.toolCalls, 'search_appointments'),
      explicitId,
    )
    const appointmentDraft = this.extractAppointmentDraft(input)
    const changes = []
    const missing = []

    if (target) {
      changes.push(`actividad objetivo: #${target.id} ${target.title || 'sin título'}`)
    } else {
      missing.push('actividad objetivo')
    }
    if (appointmentDraft.title) {
      changes.push(`nuevo título: ${appointmentDraft.title}`)
    }
    if (appointmentDraft.startLabel) {
      changes.push(`nuevo inicio: ${appointmentDraft.startLabel}`)
    }
    if (appointmentDraft.location) {
      changes.push(`nueva ubicación: ${appointmentDraft.location}`)
    }

    const payload = {
      ...(appointmentDraft.title ? { title: appointmentDraft.title } : {}),
      ...(appointmentDraft.startAt ? { startAt: appointmentDraft.startAt } : {}),
      ...(appointmentDraft.location ? { location: appointmentDraft.location } : {}),
    }

    if (!Object.keys(payload).length) {
      missing.push('cambios a aplicar')
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0,
      intro:
        draftPresentation.intro || 'He preparado la actualización de la cita.',
      sections: [
        { title: 'Confirmados', items: changes },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt:
        draftPresentation.confirmationPrompt ||
        '¿Deseas aplicar estos cambios a la cita encontrada?',
      pendingPrompt:
        draftPresentation.pendingPrompt ||
        'Antes de seguir necesito identificar la cita objetivo y los cambios a aplicar.',
      execute: {
        type: 'single',
        toolName: execution?.toolName || 'update_appointment',
        targetId: target?.id ?? null,
        payload,
        verifyEntity: execution?.verifyEntity ?? 'appointment',
        verifyMode: execution?.verifyMode ?? 'detail',
      },
      executionSuccessPrefix:
        draftPresentation.successPrefix || 'Cita actualizada correctamente.',
      errorText:
        draftPresentation.errorText ||
        'La confirmación fue recibida, pero la actualización de la cita falló. Revisa el payload y el error reportado abajo.',
    }
  }

  buildAppointmentDeleteDraft(actionIntent, input, operationalContext) {
    const actionDefinition = getActionDefinition(actionIntent?.key)
    const draftPresentation = actionDefinition?.draftPresentation || {}
    const execution = getActionExecutionDefinition(actionIntent?.key)
    const explicitId = this.extractExplicitId(input, ['actividad', 'cita'])
    const matchedTarget = this.selectEntityMatch(
      this.getExecutedToolResult(operationalContext?.toolCalls, 'search_appointments'),
      explicitId,
    )
    const target =
      matchedTarget ??
      (explicitId != null
        ? {
            id: explicitId,
            title: null,
          }
        : null)

    return {
      actionKey: actionIntent.key,
      ready: Boolean(target?.id),
      intro:
        draftPresentation.intro || 'He preparado la eliminación de la cita.',
      sections: [
        {
          title: 'Confirmados',
          items: target
            ? [
                `${draftPresentation.targetLabel || 'actividad objetivo'}: #${target.id} ${target.title || 'sin título'}`,
              ]
            : [],
        },
        {
          title: 'Faltantes',
          items: target ? [] : [draftPresentation.targetLabel || 'actividad objetivo'],
        },
      ],
      confirmationPrompt:
        draftPresentation.confirmationPrompt ||
        '¿Deseas eliminar esta cita? Si confirmas, ejecutaré la eliminación y te devolveré el resultado.',
      pendingPrompt:
        draftPresentation.pendingPrompt ||
        'Antes de seguir necesito identificar con precisión la actividad a eliminar.',
      execute: {
        type: 'single',
        toolName: execution?.toolName || 'delete_appointment',
        targetId: target?.id ?? null,
        payload: {},
        verifyEntity: execution?.verifyEntity ?? null,
        verifyMode: execution?.verifyMode ?? 'none',
      },
      executionSuccessPrefix:
        draftPresentation.successPrefix || 'Cita eliminada correctamente.',
      errorText:
        draftPresentation.errorText ||
        'La confirmación fue recibida, pero no pude eliminar la cita. Revisa el error reportado abajo.',
      debugDetail:
        draftPresentation.debugDetail ||
        'Delete confirmable resuelto sobre actividad previamente encontrada por prebúsqueda.',
    }
  }

  buildCustomerCreateDraft(actionIntent, input) {
    const actionDefinition = getActionDefinition(actionIntent?.key)
    const draftPresentation = actionDefinition?.draftPresentation || {}
    const execution = getActionExecutionDefinition(actionIntent?.key)
    const name =
      extractNamedEntity(String(input || ''), [
        /\b(?:registrar|crear|alta de|nuevo|nueva)\s+(?:el\s+)?cliente\s+(.+?)(?=\s+(?:con|correo|mail|email|telefono|tel[eé]fono|tel|cel|whatsapp|direccion|dirección|ubicacion|ubicación)\b|$)/iu,
        /\bcliente\s+(.+?)(?=\s+(?:con|correo|mail|email|telefono|tel[eé]fono|tel|cel|whatsapp|direccion|dirección|ubicacion|ubicación)\b|$)/iu,
      ]) || null
    const email = this.extractEmailValue(input)
    const phoneNumber = this.extractPhoneValue(input)
    const location = this.extractLocationValue(input)

    const confirmed = []
    const missing = []
    const doubtful = []

    if (name) {
      confirmed.push(`nombre: ${name}`)
    } else {
      missing.push('nombre')
    }

    if (email) {
      confirmed.push(`email: ${email}`)
    } else if (/\b(?:correo|mail|email)\b/i.test(String(input || ''))) {
      doubtful.push('email')
    }

    if (phoneNumber) {
      confirmed.push(`teléfono: ${phoneNumber}`)
      const digits = phoneNumber.replace(/\D+/g, '')
      if (digits.length < 8) {
        doubtful.push('teléfono')
      }
    } else if (/\b(?:telefono|tel[eé]fono|tel|cel|whatsapp)\b/i.test(String(input || ''))) {
      doubtful.push('teléfono')
    }

    if (location) {
      confirmed.push(`ubicación: ${location}`)
    }

    const payload = {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(location ? { location } : {}),
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0 && doubtful.length === 0,
      intro: draftPresentation.intro || 'He preparado el alta del cliente.',
      sections: [
        { title: 'Confirmados', items: confirmed },
        { title: 'Dudosos', items: doubtful },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt:
        draftPresentation.confirmationPrompt ||
        '¿Deseas registrar este cliente ahora?',
      pendingPrompt:
        draftPresentation.pendingPrompt ||
        'Antes de seguir necesito completar o corregir los datos faltantes o dudosos.',
      execute: {
        type: 'single',
        toolName: execution?.toolName || 'create_customer',
        payload,
        verifyEntity: execution?.verifyEntity ?? 'customer',
        verifyMode: execution?.verifyMode ?? 'detail',
      },
      executionSuccessPrefix:
        draftPresentation.successPrefix || 'Cliente procesado correctamente.',
      errorText:
        draftPresentation.errorText ||
        'La confirmación fue recibida, pero no pude registrar el cliente. Revisa el payload y el error reportado abajo.',
    }
  }

  buildCustomerUpdateDraft(actionIntent, input, operationalContext) {
    const actionDefinition = getActionDefinition(actionIntent?.key)
    const draftPresentation = actionDefinition?.draftPresentation || {}
    const execution = getActionExecutionDefinition(actionIntent?.key)
    const explicitId = this.extractExplicitId(input, ['cliente'])
    const target = this.selectEntityMatch(
      this.getExecutedToolResult(operationalContext?.toolCalls, 'search_customers'),
      explicitId,
    )
    const email = this.extractEmailValue(input)
    const phoneNumber = this.extractPhoneValue(input)
    const location = this.extractLocationValue(input)
    const name =
      extractNamedEntity(String(input || ''), [
        /\b(?:renombrar|cambiar nombre de|actualizar nombre de)\s+(?:cliente\s+)?(.+?)(?=\s+(?:a|por)\s+[a-záéíóúñ0-9 .'-]+$)/iu,
      ]) || null

    const confirmed = []
    const missing = []
    const doubtful = []

    if (target) {
      confirmed.push(
        `${draftPresentation.targetLabel || 'cliente objetivo'}: #${target.id} ${target.name}`,
      )
    } else {
      missing.push(draftPresentation.targetLabel || 'cliente objetivo')
    }

    const payload = {
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(location ? { location } : {}),
    }

    if (email) {
      confirmed.push(`email: ${email}`)
    } else if (/\b(?:correo|mail|email)\b/i.test(String(input || ''))) {
      doubtful.push('email')
    }
    if (phoneNumber) {
      confirmed.push(`teléfono: ${phoneNumber}`)
      const digits = phoneNumber.replace(/\D+/g, '')
      if (digits.length < 8) {
        doubtful.push('teléfono')
      }
    }
    if (location) {
      confirmed.push(`ubicación: ${location}`)
    }
    if (name) {
      confirmed.push(`nombre: ${name}`)
    }

    if (!Object.keys(payload).length) {
      missing.push('campos a modificar')
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0 && doubtful.length === 0,
      intro:
        draftPresentation.intro || 'He preparado la actualización del cliente.',
      sections: [
        { title: 'Confirmados', items: confirmed },
        { title: 'Dudosos', items: doubtful },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt:
        draftPresentation.confirmationPrompt ||
        '¿Deseas aplicar estos cambios al cliente encontrado?',
      pendingPrompt:
        draftPresentation.pendingPrompt ||
        'Antes de seguir necesito identificar el cliente objetivo y corregir los datos dudosos o faltantes.',
      execute: {
        type: 'single',
        toolName: execution?.toolName || 'update_customer',
        targetId: target?.id ?? null,
        payload,
        verifyEntity: execution?.verifyEntity ?? 'customer',
        verifyMode: execution?.verifyMode ?? 'detail',
      },
      executionSuccessPrefix:
        draftPresentation.successPrefix || 'Cliente actualizado correctamente.',
      errorText:
        draftPresentation.errorText ||
        'La confirmación fue recibida, pero no pude actualizar el cliente. Revisa el payload y el error reportado abajo.',
    }
  }

  getRowCandidate(row, candidates = []) {
    if (!row || typeof row !== 'object') {
      return null
    }
    const entries = Object.entries(row)
    for (const candidate of candidates) {
      const normalizedCandidate = normalizeText(candidate)
      const matched = entries.find(
        ([key]) => normalizeText(key) === normalizedCandidate,
      )
      if (matched && matched[1] != null && String(matched[1]).trim()) {
        return String(matched[1]).trim()
      }
    }
    return null
  }

  buildProductBatchDraft(actionIntent, extractedAssets = []) {
    const actionDefinition = getActionDefinition(actionIntent?.key)
    const draftPresentation = actionDefinition?.draftPresentation || {}
    const execution = getActionExecutionDefinition(actionIntent?.key)
    const rows = extractedAssets
      .filter(
        (asset) => Array.isArray(asset?.structuredRows) && asset.structuredRows.length > 0,
      )
      .flatMap((asset) => asset.structuredRows)

    if (!rows.length) {
      return null
    }

    const readyItems = []
    const pendingItems = []

    rows.forEach((row, index) => {
      const name = this.getRowCandidate(row, ['name', 'nombre', 'producto', 'product'])
      const currency = this.getRowCandidate(row, ['currency', 'moneda'])
      const amountRaw = this.getRowCandidate(row, [
        'salePrice',
        'sale_price',
        'precio',
        'price',
      ])
      const stockRaw = this.getRowCandidate(row, ['stock', 'existencias'])
      const productCode = this.getRowCandidate(row, [
        'productCode',
        'product_code',
        'codigo',
        'código',
        'code',
      ])

      const salePrice =
        amountRaw != null && amountRaw !== ''
          ? Number(String(amountRaw).replace(',', '.'))
          : null
      const stock =
        stockRaw != null && stockRaw !== ''
          ? Number.parseInt(String(stockRaw), 10)
          : null
      const missing = []
      if (!name) missing.push('name')
      if (salePrice != null && !currency) missing.push('currency')
      if (amountRaw != null && (salePrice == null || Number.isNaN(salePrice))) {
        missing.push('salePrice')
      }

      const payload = {
        ...(name ? { name } : {}),
        ...(productCode ? { productCode } : {}),
        ...(salePrice != null && Number.isFinite(salePrice) ? { salePrice } : {}),
        ...(currency ? { currency } : {}),
        ...(stock != null && Number.isFinite(stock) ? { stock } : {}),
      }

      const summary = `${index + 1}. ${name || 'sin nombre'}${
        currency && salePrice != null ? ` ${currency} ${salePrice}` : ''
      }${stock != null && Number.isFinite(stock) ? ` stock:${stock}` : ''}`.trim()

      if (!missing.length) {
        readyItems.push({
          summary,
          payload,
        })
      } else {
        pendingItems.push({
          summary,
          missing,
        })
      }
    })

    if (!readyItems.length && !pendingItems.length) {
      return null
    }

    return {
      actionKey: actionIntent.key,
      ready: readyItems.length > 0,
      intro:
        draftPresentation.batchIntro ||
        'He preparado el alta en lote de productos desde los datos tabulares detectados.',
      sections: [
        {
          title: draftPresentation.batchReadyTitle || 'Listos para alta',
          items: readyItems.map((item) => item.summary),
        },
        {
          title: draftPresentation.batchPendingTitle || 'Pendientes',
          items: pendingItems.map(
            (item) => `${item.summary}: falta ${item.missing.join(', ')}`,
          ),
        },
      ],
      confirmationPrompt:
        draftPresentation.batchConfirmationPrompt ||
        '¿Deseas crear los productos válidos detectados en el lote? Si confirmas, los crearé ahora y devolveré enlaces de verificación.',
      pendingPrompt:
        draftPresentation.batchPendingPrompt ||
        'Todavía no hay filas válidas suficientes para ejecutar el alta en lote.',
      execute: {
        type: 'batch',
        items: readyItems.map((item) => ({
          toolName: execution?.toolName || 'create_product',
          payload: item.payload,
          verifyEntity: execution?.verifyEntity ?? 'product',
          verifyMode: execution?.verifyMode ?? 'detail',
          successLabel: item.payload.name,
        })),
      },
      batchSuccessTitle:
        draftPresentation.batchSuccessTitle ||
        'Productos creados correctamente desde el lote:',
      debugDetail:
        draftPresentation.batchDebugDetail ||
        'Se usaron filas tabulares extraídas desde CSV/XLSX para construir un draft batch de productos.',
    }
  }

  buildProductCreateDraft(actionIntent, input) {
    const actionDefinition = getActionDefinition(actionIntent?.key)
    const draftPresentation = actionDefinition?.draftPresentation || {}
    const execution = getActionExecutionDefinition(actionIntent?.key)
    const name =
      extractNamedEntity(String(input || ''), [
        /\b(?:crear|nuevo|alta de)\s+producto\s+(.+?)(?=\s+(?:con|precio|stock|codigo|c[oó]digo|descripci[oó]n|moneda|currency|publicado|publicar)\b|$)/iu,
        /\bproducto\s+(.+?)(?=\s+(?:con|precio|stock|codigo|c[oó]digo|descripci[oó]n|moneda|currency|publicado|publicar)\b|$)/iu,
      ]) || null
    const { currency, amount } = this.extractCurrencyAmount(input)
    const stock = this.extractIntegerValue(String(input || ''), [
      /\bstock\s*(?:de|en)?\s*(\d+)\b/iu,
    ])
    const productCode =
      extractNamedEntity(String(input || ''), [/\b(?:codigo|c[oó]digo)\s*(?:es|:)?\s*([a-z0-9-]+)\b/iu]) ||
      null

    const confirmed = []
    const missing = []
    const doubtful = []

    if (name) {
      confirmed.push(`nombre: ${name}`)
    } else {
      missing.push('nombre')
    }
    if (amount != null) {
      confirmed.push(`precio: ${amount}`)
      if (!currency) {
        doubtful.push('moneda')
      }
    } else if (/\bprecio\b/i.test(String(input || ''))) {
      missing.push('precio')
    }
    if (currency) {
      confirmed.push(`moneda: ${currency}`)
    }
    if (stock != null) {
      confirmed.push(`stock: ${stock}`)
    }
    if (productCode) {
      confirmed.push(`código: ${productCode}`)
    }

    const payload = {
      ...(name ? { name } : {}),
      ...(productCode ? { productCode } : {}),
      ...(amount != null ? { salePrice: amount } : {}),
      ...(currency ? { currency } : {}),
      ...(stock != null ? { stock } : {}),
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0 && doubtful.length === 0,
      intro: draftPresentation.intro || 'He preparado el alta del producto.',
      sections: [
        { title: 'Confirmados', items: confirmed },
        { title: 'Dudosos', items: doubtful },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt:
        draftPresentation.confirmationPrompt ||
        '¿Deseas crear este producto ahora?',
      pendingPrompt:
        draftPresentation.pendingPrompt ||
        'Antes de seguir necesito completar o corregir precio, moneda o nombre del producto.',
      execute: {
        type: 'single',
        toolName: execution?.toolName || 'create_product',
        payload,
        verifyEntity: execution?.verifyEntity ?? 'product',
        verifyMode: execution?.verifyMode ?? 'detail',
      },
      executionSuccessPrefix:
        draftPresentation.successPrefix || 'Producto creado correctamente.',
      errorText:
        draftPresentation.errorText ||
        'La confirmación fue recibida, pero no pude crear el producto. Revisa el payload y el error reportado abajo.',
    }
  }

  buildProductUpdateDraft(actionIntent, input, operationalContext) {
    const actionDefinition = getActionDefinition(actionIntent?.key)
    const draftPresentation = actionDefinition?.draftPresentation || {}
    const execution = getActionExecutionDefinition(actionIntent?.key)
    const explicitId = this.extractExplicitId(input, ['producto'])
    const target = this.selectEntityMatch(
      this.getExecutedToolResult(operationalContext?.toolCalls, 'search_products'),
      explicitId,
    )
    const { currency, amount } = this.extractCurrencyAmount(input)
    const stock = this.extractIntegerValue(String(input || ''), [
      /\bstock\s*(?:de|en)?\s*(\d+)\b/iu,
    ])
    const name =
      extractNamedEntity(String(input || ''), [
        /\b(?:renombrar|cambiar nombre de|actualizar nombre de)\s+(?:producto\s+)?(.+?)(?=\s+(?:a|por)\s+[a-záéíóúñ0-9 .'-]+$)/iu,
      ]) || null

    const confirmed = []
    const missing = []
    const doubtful = []

    if (target) {
      confirmed.push(
        `${draftPresentation.targetLabel || 'producto objetivo'}: #${target.id} ${target.name}`,
      )
    } else {
      missing.push(draftPresentation.targetLabel || 'producto objetivo')
    }

    if (amount != null) {
      confirmed.push(`precio: ${amount}`)
      if (!currency) {
        doubtful.push('moneda')
      }
    }
    if (currency) {
      confirmed.push(`moneda: ${currency}`)
    }
    if (stock != null) {
      confirmed.push(`stock: ${stock}`)
    }
    if (name) {
      confirmed.push(`nombre: ${name}`)
    }

    const payload = {
      ...(name ? { name } : {}),
      ...(amount != null ? { salePrice: amount } : {}),
      ...(currency ? { currency } : {}),
      ...(stock != null ? { stock } : {}),
    }

    if (!Object.keys(payload).length) {
      missing.push('campos a modificar')
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0 && doubtful.length === 0,
      intro:
        draftPresentation.intro || 'He preparado la actualización del producto.',
      sections: [
        { title: 'Confirmados', items: confirmed },
        { title: 'Dudosos', items: doubtful },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt:
        draftPresentation.confirmationPrompt ||
        '¿Deseas aplicar estos cambios al producto encontrado?',
      pendingPrompt:
        draftPresentation.pendingPrompt ||
        'Antes de seguir necesito identificar el producto objetivo y corregir los datos faltantes o dudosos.',
      execute: {
        type: 'single',
        toolName: execution?.toolName || 'update_product',
        targetId: target?.id ?? null,
        payload,
        verifyEntity: execution?.verifyEntity ?? 'product',
        verifyMode: execution?.verifyMode ?? 'detail',
      },
      executionSuccessPrefix:
        draftPresentation.successPrefix || 'Producto actualizado correctamente.',
      errorText:
        draftPresentation.errorText ||
        'La confirmación fue recibida, pero no pude actualizar el producto. Revisa el payload y el error reportado abajo.',
    }
  }

  buildDocumentActionDraft(actionIntent, input, operationalContext) {
    const actionDefinition = getActionDefinition(actionIntent?.key)
    if (!actionDefinition) {
      return null
    }

    const draftPresentation = actionDefinition.draftPresentation || {}
    const toolName = actionDefinition.searchTool
    const entity = actionDefinition.entityType
    const targetEntityLabel =
      draftPresentation.targetEntityLabel ||
      actionDefinition.execute?.entityLabel ||
      (entity === 'quote' ? 'presupuesto' : entity === 'order' ? 'pedido' : 'pago')
    const explicitId = this.extractExplicitId(
      input,
      entity === 'order'
        ? ['pedido']
        : entity === 'quote'
          ? ['presupuesto']
          : ['pago'],
    )
    const target = this.selectEntityMatch(
      this.getExecutedToolResult(operationalContext?.toolCalls, toolName),
      explicitId,
    )

    const confirmed = []
    const missing = []
    let payload = {}
    let toolNameToExecute = actionDefinition.executionTool || null
    let verifyEntity = actionDefinition.verifyEntity || entity
    let intro = draftPresentation.intro || 'He preparado la operación solicitada.'
    let confirmationPrompt =
      draftPresentation.confirmationPrompt || '¿Deseas confirmar esta operación?'
    let successPrefix =
      draftPresentation.successPrefix || 'Operación ejecutada correctamente.'
    let pendingPrompt =
      draftPresentation.pendingPrompt ||
      'Antes de seguir necesito identificar correctamente la entidad objetivo y completar los datos faltantes.'
    let errorText =
      'La confirmación fue recibida, pero no pude completar la operación. Revisa el error reportado abajo.'

    if (target) {
      const targetLabel =
        entity === 'payment'
          ? `pago objetivo: #${target.id}${target.reference ? ` (${target.reference})` : ''}`
          : `${targetEntityLabel} objetivo: #${target.id}${target.uuid ? ` (${target.uuid})` : ''}`
      confirmed.push(targetLabel)
    } else {
      missing.push(`${targetEntityLabel} objetivo`)
    }

    if (actionIntent.key === 'orders.update_status' || actionIntent.key === 'quotes.update_status' || actionIntent.key === 'payments.update_status') {
      const status = this.extractStatusValue(actionIntent.key, input)
      if (status) {
        confirmed.push(`nuevo estado: ${status}`)
        payload = { status }
      } else {
        missing.push('nuevo estado')
      }
    } else if (actionIntent.key === 'orders.update_comment' || actionIntent.key === 'quotes.update_comment') {
      const comment = this.extractCommentValue(input)
      if (comment) {
        confirmed.push(`comentario: ${comment}`)
        payload = { comment }
      } else {
        missing.push('comentario')
      }
    } else if (actionIntent.key === 'quotes.send') {
    } else if (actionIntent.key === 'quotes.confirm') {
    } else if (actionIntent.key === 'payments.update') {
      const method =
        extractNamedEntity(String(input || ''), [/\b(?:m[eé]todo|metodo)\s*(?:es|:)?\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:referencia|nota|notas)\b|$)/iu]) ||
        null
      const reference =
        extractNamedEntity(String(input || ''), [/\breferencia\s*(?:es|:)?\s+([a-záéíóúñ0-9 .'-]+)$/iu]) ||
        null
      const notes =
        extractNamedEntity(String(input || ''), [/\bnota[s]?\s*(?:es|:)?\s+(.+)$/iu]) ||
        null

      payload = {
        ...(method ? { method } : {}),
        ...(reference ? { reference } : {}),
        ...(notes ? { notes } : {}),
      }

      if (method) confirmed.push(`método: ${method}`)
      if (reference) confirmed.push(`referencia: ${reference}`)
      if (notes) confirmed.push(`nota: ${notes}`)
      if (!Object.keys(payload).length) {
        missing.push('campos a modificar')
      }
    }

    return {
      actionKey: actionIntent.key,
      ready: missing.length === 0,
      intro,
      sections: [
        { title: 'Confirmados', items: confirmed },
        { title: 'Faltantes', items: missing },
      ],
      confirmationPrompt,
      pendingPrompt,
      execute: {
        type: 'single',
        toolName: toolNameToExecute,
        targetId: target?.id ?? null,
        payload,
        verifyEntity,
      },
      executionSuccessPrefix: successPrefix,
      errorText,
    }
  }

  async buildDeterministicOperationalResponse({
    role,
    input,
    actionIntent,
    actionCatalog,
    operationalContext,
    extractedAssets,
    requestedToolRequiresConfirmation,
    backendClient,
  }) {
    if (!(role.startsWith('admin_') || role === 'superadmin') || !actionIntent) {
      return null
    }
    const requiresConfirmationFlow =
      requestedToolRequiresConfirmation ||
      actionIntent.key === STRUCTURED_CATALOG_REGISTER_INTENT
    if (!requiresConfirmationFlow) {
      return null
    }

    let draft = this.buildOperationDraft(
      actionIntent,
      input,
      operationalContext,
      extractedAssets,
    )
    const refined = await this.maybeRefineDraftWithStructuredExtraction({
      role,
      actionIntent,
      actionCatalog,
      input,
      extractedAssets,
      operationalContext,
      draft,
      backendClient,
    })
    draft = refined.draft
    const response = this.buildOperationDraftResponse(actionIntent, draft)
    if (!response) {
      return null
    }
    return {
      response,
      operationalContext: refined.operationalContext,
    }
  }

  async buildDeterministicQuoteResolutionResponse({
    role,
    input,
    intentKey,
    interpretation = null,
    operationalContext = null,
    backendClient,
    tenantTopicTaxonomy = [],
    tenantKey = null,
    unifiedMessage = null,
    variationSeed = '',
  }) {
    if (
      !(role === 'customer_public' || role === 'customer_authenticated') ||
      ![
        'customer.quote',
        'customer.product_info',
        'customer.price_inquiry',
        'customer.incomplete',
        'customer.other',
        'unknown',
      ].includes(String(intentKey || ''))
    ) {
      return null
    }

    const quoteContext =
      interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
        ? interpretation.quoteContext
        : null
    const pendingQuoteClarification =
      quoteContext?.pendingClarification &&
      typeof quoteContext.pendingClarification === 'object'
        ? quoteContext.pendingClarification
        : null
    const quoteAmbiguityPending =
      String(pendingQuoteClarification?.type || '') === 'catalog_match_ambiguous'
    const inheritedIntentKey =
      typeof interpretation?.followUp?.inheritedIntentKey === 'string'
        ? interpretation.followUp.inheritedIntentKey
        : null
    const quoteConfirmationFollowUp = interpretation?.followUp?.quoteConfirmation === true
    const channel = unifiedMessage?.channel || null
    const channelProfile = this.getResponseChannelProfile(channel)
    const effectiveIntentKey = intentKey
    const quoteWorkflowFollowUp =
      effectiveIntentKey === 'customer.quote' ||
      (quoteConfirmationFollowUp && inheritedIntentKey === 'customer.quote')
    if (
      !quoteContext ||
      !quoteWorkflowFollowUp ||
      looksLikeCommercialConditionQuestion(input) ||
      String(quoteContext.completionStatus || '') !== 'ready_for_pricing_or_handoff'
    ) {
      return null
    }

    const locale = resolveUnifiedLocale(unifiedMessage)
    const targetCurrency = resolveUnifiedCurrency(unifiedMessage)
    const tenantGroundingKey = unifiedMessage?.tenantKey || tenantKey || 'default'
    const buildQuoteWorkflowGrounding = (
      responseText,
      {
        sourceType = 'quote_workflow',
        scope = 'quote',
        sourceKey = interpretation?.quoteContext?.profileKey || 'quote_resolution',
        title = interpretation?.quoteContext?.profileLabel || 'Quote workflow',
        facts = null,
      } = {},
    ) =>
      buildGroundingContract({
        knowledgeRetrieved: false,
        usedFacts:
          Array.isArray(facts) && facts.length > 0
            ? facts
            : extractGroundingFactsFromText(responseText, 2),
        sources: buildStructuredGroundingSource({
          tenantKey: tenantGroundingKey,
          sourceType,
          scope,
          sourceKey,
          title,
        }),
      })

    const commerceMode = this.getCustomerCapabilityMode('customer.quote')
    if (capabilityModeBlocksAutomaticResolution(commerceMode)) {
      const handoffText = buildCustomerQuoteHandoffText({
        subject:
          quoteContext?.topicLabel ||
          quoteContext?.familyLabel ||
          interpretation?.topic?.label ||
          interpretation?.contextTopic?.label ||
          'la configuración solicitada',
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
      })
      return {
        text: handoffText,
        toolCalls: [],
        needsHuman: true,
        grounding: {
          ...buildQuoteWorkflowGrounding(handoffText, {
            sourceType: 'runtime_capability',
            scope: 'capability',
            sourceKey: 'commerce_handoff',
            title: 'Commerce capability handoff',
          }),
          fallbackReason: 'capability_commerce_handoff_only',
          fallbackSubtype: 'quote_handoff',
        },
        debug: {
          actionKey: 'customer.quote',
          detail:
            'La capability commerce está en modo handoff_only y se dejó la cotización completa en seguimiento, sin intentar precio inmediato.',
        },
      }
    }

    if (
      (looksLikeQuoteWaitingFollowUp(input) || quoteConfirmationFollowUp) &&
      !quoteAmbiguityPending &&
      (Boolean(interpretation?.followUp?.detected) ||
        inheritedIntentKey === 'customer.quote' ||
        Boolean(interpretation?.contextTopic?.label)) &&
      (Boolean(quoteContext?.measurements) ||
        (Array.isArray(quoteContext?.measurementItems) &&
          quoteContext.measurementItems.length > 0) ||
        Number(quoteContext?.quantity?.total || 0) > 0 ||
        Boolean(interpretation?.contextTopic?.label))
    ) {
      const waitingText = buildCustomerQuoteWaitingFollowUpText({
        input,
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
        channel,
        channelProfile,
      })
      return {
        text: waitingText,
        toolCalls: [],
        needsHuman: true,
        grounding: {
          ...buildQuoteWorkflowGrounding(waitingText, {
            sourceKey: interpretation?.quoteContext?.profileKey || 'quote_waiting_followup',
            title:
              interpretation?.quoteContext?.profileLabel || 'Quote waiting follow-up',
          }),
          fallbackReason: null,
          fallbackSubtype: 'quote_handoff',
        },
        debug: {
          actionKey: 'customer.quote',
          detail:
            'Se mantuvo el seguimiento de una cotización ya encaminada ante un acknowledgement o espera explícita del cliente, sin reabrir el intake ni recalcular el producto.',
        },
      }
    }

    if (
      quoteAmbiguityPending &&
      quoteConfirmationFollowUp &&
      Array.isArray(pendingQuoteClarification?.candidateProducts) &&
      pendingQuoteClarification.candidateProducts.length > 0
    ) {
      const clarificationResolution = {
        strategy: String(quoteContext?.pricingStrategy || '').trim() || 'quote_profile',
        status: 'product_not_found',
        subjectLabel:
          pendingQuoteClarification.subjectLabel ||
          quoteContext?.topicLabel ||
          quoteContext?.familyLabel ||
          'la configuración solicitada',
        productNotFoundSubtype: 'catalog_match_ambiguous',
        candidateProducts: pendingQuoteClarification.candidateProducts,
      }
      const clarificationText = buildCustomerQuoteResolutionText(
        clarificationResolution,
        {
          interpretation,
          conversationState: interpretation?.conversationState || null,
          tenantTopicTaxonomy,
          variationSeed,
          locale,
          wordingOverrides: this.getCustomerWordingOverrides(),
          channel,
          channelProfile,
        },
      )
      if (clarificationText) {
        return {
          text: clarificationText,
          wordingKey: 'customer.quote.ambiguous_options',
          toolCalls: [],
          needsHuman: false,
          grounding: buildGroundingContract({
            knowledgeRetrieved: false,
            knowledgeUsed: true,
            usedFacts: [
              `Consulta reconocida: ${
                pendingQuoteClarification.subjectLabel ||
                quoteContext?.topicLabel ||
                quoteContext?.familyLabel ||
                'la configuración solicitada'
              }.`,
              'Sigue habiendo más de una opción publicada compatible.',
            ],
            sources: buildStructuredGroundingSource({
              tenantKey: tenantKey || 'default',
              sourceType: 'tenant_policy',
              scope: 'quote_profile',
              sourceKey:
                interpretation?.quoteContext?.profileKey ||
                pendingQuoteClarification.subjectLabel ||
                'quote_ambiguity',
              title:
                interpretation?.quoteContext?.profileLabel ||
                pendingQuoteClarification.subjectLabel ||
                'Quote ambiguity clarification',
            }),
          }),
          quoteResolution: clarificationResolution,
          debug: {
            actionKey: 'customer.quote',
            wordingKey: 'customer.quote.ambiguous_options',
            detail:
              'Se mantuvo la aclaración guiada de una cotización ambigua ante un follow-up confirmatorio, sin degradarla a handoff humano.',
          },
        }
      }
    }

    const resolution = await resolveCustomerQuoteResolution({
      input,
      interpretation,
      operationalContext,
      backendClient,
      tenantKey,
      role,
      locale,
      targetCurrency,
      knowledgeMode: this.resolveDebugKnowledgeMode(unifiedMessage),
    })
    if (!resolution) {
      return null
    }

    const text = buildCustomerQuoteResolutionText(resolution, {
      interpretation,
      conversationState: interpretation?.conversationState || null,
      tenantTopicTaxonomy,
      variationSeed,
      locale,
      wordingOverrides: this.getCustomerWordingOverrides(),
      channel,
      channelProfile,
    })
    if (!text) {
      return null
    }

    let detail =
      'Se resolvió de forma determinística la siguiente acción para una consulta de cotización.'
    if (resolution.status === 'resolved') {
      if (resolution.strategy === 'immediate_square_meter') {
        detail =
          'Se calculó una cotización inmediata por metro cuadrado usando el producto publicado y las medidas capturadas en la conversación.'
      } else if (resolution.strategy === 'immediate_unit_price') {
        detail =
          'Se calculó una cotización inmediata por precio unitario usando el producto publicado y la cantidad capturada.'
      } else if (resolution.strategy === 'parametric_exact_or_handoff') {
        detail =
          'Se resolvió una cotización paramétrica inmediata porque la configuración exacta ya tenía precio disponible.'
      }
    } else if (resolution.status === 'product_not_found') {
      detail =
        resolution.productNotFoundSubtype === 'catalog_missing_but_known_in_knowledge'
          ? 'Se capturó el intake completo. Hay conocimiento informacional sobre la consulta, pero no existe una configuración publicada con precio inmediato.'
          : resolution.productNotFoundSubtype ===
              'catalog_present_without_immediate_price'
            ? 'Se capturó el intake completo. Existe una opción en catálogo, pero no tiene un precio inmediato publicable para responder en el momento.'
          : resolution.productNotFoundSubtype === 'catalog_match_ambiguous'
            ? 'Se capturó el intake completo, pero hay más de una opción publicada compatible. Se pidió una aclaración guiada para elegir la variante sin cerrar el caso como handoff.'
          : 'Se capturó el intake completo, pero no se encontró un producto publicado con precio inmediato para esa configuración.'
    } else if (resolution.status === 'needs_handoff') {
      detail =
        resolution.detail === 'immediate_preview_unavailable'
          ? 'Se capturó el intake completo, pero el preview de pricing inmediato no pudo resolverse de forma confiable y se deriva a un asesor.'
          : resolution.detail === 'external_parametric_quote_required'
            ? 'Se capturó el intake completo de un producto paramétrico. No hay precio inmediato publicable y el caso se deriva para cotización externa o revisión humana.'
          : 'Se capturó el intake completo, pero el caso requiere derivación porque no existe precio inmediato confiable para responder en el acto.'
    }

    const isQuoteAmbiguityClarification =
      resolution.status === 'product_not_found' &&
      resolution.productNotFoundSubtype === 'catalog_match_ambiguous'
    const wordingKey =
      resolution.status === 'resolved'
        ? null
        : isQuoteAmbiguityClarification
          ? 'customer.quote.ambiguous_options'
          : 'customer.quote.handoff_ready'
    const quoteSubjectLabel =
      compactText(
        resolution.subjectLabel ||
          interpretation?.quoteContext?.profileLabel ||
          interpretation?.quoteContext?.topicLabel ||
          interpretation?.quoteContext?.familyLabel ||
          '',
      ) || 'la configuración solicitada'
    const quoteProfileSource =
      interpretation?.quoteContext?.profileKey || quoteSubjectLabel
    const quoteResolutionGrounding =
      resolution.status === 'resolved'
        ? buildGroundingContract({
            knowledgeRetrieved: false,
            usedFacts: [
              `Cotización inmediata para ${resolution.subjectLabel || 'la configuración solicitada'}.`,
              resolution.totalAmount != null && resolution.currency
                ? `Total estimado: ${formatPublicMoney(resolution.currency, resolution.totalAmount, locale)}.`
                : null,
              resolution.unitAmount != null && resolution.currency
                ? `Valor unitario de referencia: ${formatPublicMoney(resolution.currency, resolution.unitAmount, locale)}.`
                : null,
              Number(resolution.quantity || 0) > 0
                ? `Cantidad considerada: ${Number(resolution.quantity)}.`
                : null,
            ],
            sources: buildStructuredGroundingSource({
              tenantKey: tenantKey || 'default',
              sourceType: 'published_catalog',
              scope: 'catalog',
              sourceKey:
                resolution?.productMatch?.id != null
                  ? `product:${resolution.productMatch.id}`
                  : compactText(resolution.subjectLabel || 'quote_resolution'),
              title:
                resolution?.productMatch?.name ||
                resolution.subjectLabel ||
                'Published catalog match',
            }),
          })
        : resolution.status === 'product_not_found' &&
            resolution.productNotFoundSubtype === 'catalog_missing_but_known_in_knowledge' &&
            Array.isArray(resolution.knowledgeHits) &&
            resolution.knowledgeHits.length > 0
          ? buildRetrievalFaqGroundingContract({
              input,
              retrievalItems: resolution.knowledgeHits,
              interpretation,
              tenantRuntimePolicy: null,
              text,
            })
          : resolution.status === 'product_not_found' ||
              resolution.status === 'needs_handoff'
            ? buildGroundingContract({
                knowledgeRetrieved: false,
                usedFacts: [
                  `Consulta reconocida: ${quoteSubjectLabel}.`,
                  resolution.productNotFoundSubtype ===
                  'catalog_present_without_immediate_price'
                    ? 'No hay un precio inmediato publicable para esa configuración.'
                    : resolution.productNotFoundSubtype === 'catalog_match_ambiguous'
                      ? 'Hay más de una opción publicada compatible para esa configuración.'
                      : resolution.productNotFoundSubtype ===
                            'catalog_missing_but_known_in_knowledge' ||
                          resolution.detail === 'external_parametric_quote_required'
                        ? 'La consulta requiere cotización externa o seguimiento comercial.'
                        : 'No existe un precio inmediato confiable para responder en el momento.',
                ],
                sources: buildStructuredGroundingSource({
                  tenantKey: tenantKey || 'default',
                  sourceType: 'tenant_policy',
                  scope: 'quote_profile',
                  sourceKey: quoteProfileSource,
                  title:
                    interpretation?.quoteContext?.profileLabel ||
                    quoteSubjectLabel ||
                    'Quote profile',
                }),
              })
          : {
              grounded: false,
              fallbackReason: null,
            }

    return {
      text,
      wordingKey,
      toolCalls: [],
      needsHuman: resolution.status !== 'resolved' && !isQuoteAmbiguityClarification,
      grounding: {
        ...quoteResolutionGrounding,
        fallbackReason:
          typeof quoteResolutionGrounding?.fallbackReason === 'string'
            ? quoteResolutionGrounding.fallbackReason
            : null,
        fallbackSubtype:
          resolution.status === 'resolved'
            ? null
            : isQuoteAmbiguityClarification
              ? null
              : resolution.status === 'product_not_found' &&
                  resolution.productNotFoundSubtype ===
                    'catalog_missing_but_known_in_knowledge'
                ? 'information_then_handoff'
                : 'quote_handoff',
      },
      quoteResolution: resolution,
      debug: {
        actionKey: 'customer.quote',
        wordingKey,
        detail,
      },
    }
  }

  async buildDeterministicInstallationConditionResponse({
    role,
    input,
    intentKey,
    interpretation = null,
    operationalContext = null,
    backendClient,
    tenantTopicTaxonomy = [],
    tenantRuntimePolicy = null,
    tenantKey = null,
    unifiedMessage = null,
  }) {
    if (
      !(role === 'customer_public' || role === 'customer_authenticated') ||
      !looksLikeCommercialConditionQuestion(input) ||
      !hasTenantInstallationSignal(input, tenantRuntimePolicy)
    ) {
      return null
    }

    const locale = resolveUnifiedLocale(unifiedMessage)
    const prefersEnglish = localePrefersEnglish(locale)
    const targetCurrency = resolveUnifiedCurrency(unifiedMessage)

    const stableTopicLabel =
      sanitizeCommercialConditionTopicLabel(interpretation?.contextTopic?.label) ||
      sanitizeCommercialConditionTopicLabel(interpretation?.quoteContext?.topicLabel) ||
      sanitizeCommercialConditionTopicLabel(interpretation?.quoteContext?.familyLabel) ||
      sanitizeCommercialConditionTopicLabel(interpretation?.topic?.label) ||
      ''

    const topicLabel =
      buildContextualProductReference({
        requestedTopicLabel: stableTopicLabel,
        topicLabel:
          sanitizeCommercialConditionTopicLabel(interpretation?.topic?.label) || null,
        contextTopicLabel:
          sanitizeCommercialConditionTopicLabel(interpretation?.contextTopic?.label) || null,
        tenantTopicTaxonomy,
      }) ||
      stableTopicLabel ||
      'esa opción'

    let preview = null
    let productMatch = null

      try {
        const resolution = await resolveCustomerQuoteResolution({
          input,
          interpretation,
          operationalContext,
          backendClient,
          tenantKey,
          role,
          locale,
          targetCurrency,
          knowledgeMode: this.resolveDebugKnowledgeMode(unifiedMessage),
        })
      if (resolution?.preview) {
        preview = resolution.preview
        productMatch = resolution.productMatch || null
      }
    } catch {
      // keep a safe fallback below
    }

    if (!preview && topicLabel && topicLabel !== 'esa opción') {
      try {
        const matches = await backendClient.searchProducts(topicLabel, 5)
        const candidate = Array.isArray(matches)
          ? matches.find(
              (entry) =>
                entry &&
                typeof entry === 'object' &&
                Number(entry.id) > 0 &&
                String(entry.mode || '').toUpperCase() !== 'PARAMETRIC',
            )
          : null
        if (candidate?.id) {
          preview = await backendClient.previewProductQuote({
            productId: Number(candidate.id),
            quantity: 1,
            targetCurrency,
          })
          productMatch = candidate
        }
      } catch {
        // keep a safe fallback below
      }
    }

    const installation = preview?.installation && typeof preview.installation === 'object'
      ? preview.installation
      : null
    const mode = String(
      installation?.mode ||
        preview?.installationResolutionMode ||
        '',
    ).trim()
    const pricePresentationMode = String(
      installation?.pricePresentationMode ||
        preview?.installationPricePresentationMode ||
        '',
    ).trim()
    const publicInstallationAmount =
      installation && typeof installation.amount === 'number' && Number.isFinite(installation.amount)
        ? installation.amount
        : null
    const publicInstallationCurrency =
      typeof installation?.currency === 'string' && installation.currency.trim()
        ? installation.currency.trim().toUpperCase()
        : null
    const publicInstallationAmountLabel = formatPublicMoney(
      publicInstallationCurrency,
      publicInstallationAmount,
      locale,
    )

    let text = prefersEnglish
      ? `Installation for ${topicLabel} is confirmed according to the product and the scope of the work. If you want, I can leave it included in the request so it gets confirmed with the quote.`
      : `La instalación para ${topicLabel} se confirma según el producto y el alcance del trabajo. Si querés, la dejamos considerada en la solicitud para que te lo confirmen con la cotización.`

    if (mode === 'INCLUDED') {
      text = prefersEnglish
        ? `In principle, installation for ${topicLabel} is included in this option. In any case, the final scope is confirmed according to the actual work to be done.`
        : `En principio, la instalación para ${topicLabel} queda contemplada en esta opción. De todos modos, el alcance final se confirma según el trabajo a realizar.`
    } else if (mode === 'OPTIONAL_ADD_ON') {
      text = prefersEnglish
        ? `Installation for ${topicLabel} can be added as an additional service. If you want, I can leave it included separately in the request.`
        : `La instalación para ${topicLabel} puede agregarse como un servicio adicional. Si querés, la dejamos contemplada aparte dentro de la solicitud.`
    } else if (mode === 'SEPARATE_SERVICE') {
      text = prefersEnglish
        ? `Installation for ${topicLabel} is handled as a separate service and is confirmed according to the scope of the work. If you want, I can leave it considered in the request.`
        : `La instalación para ${topicLabel} se maneja como un servicio separado y se confirma según el alcance del trabajo. Si querés, la dejamos considerada en la solicitud.`
    } else if (mode === 'NOT_OFFERED') {
      text = prefersEnglish
        ? `At the moment, I do not have installation included for ${topicLabel}. If you want, an advisor can confirm alternatives for your case.`
        : `En principio, no tengo instalación incluida para ${topicLabel}. Si querés, un asesor puede confirmarte alternativas según el caso.`
    } else if (
      installation?.needsMeasurements ||
      preview?.needsConfiguration
    ) {
      text = prefersEnglish
        ? `Installation for ${topicLabel} is confirmed according to the product and the scope of the work. If you want, send me the approximate measurements and I will leave it ready to continue.`
        : `La instalación para ${topicLabel} se confirma según el producto y el alcance del trabajo. Si querés, pasame las medidas aproximadas y lo dejamos encaminado.`
    }

    if (
      pricePresentationMode === 'FROM_BASE' &&
      publicInstallationAmountLabel &&
      (mode === 'OPTIONAL_ADD_ON' || mode === 'SEPARATE_SERVICE' || mode === 'UNKNOWN')
    ) {
      text =
        mode === 'SEPARATE_SERVICE'
          ? prefersEnglish
            ? `Installation for ${topicLabel} is handled as a separate service. Right now it starts from ${publicInstallationAmountLabel}, subject to the final scope of the work.`
            : `La instalación para ${topicLabel} se maneja como un servicio separado. Hoy se toma a partir de ${publicInstallationAmountLabel}, sujeto al alcance final del trabajo.`
          : prefersEnglish
            ? `Installation for ${topicLabel} can be added as an additional service. Right now it starts from ${publicInstallationAmountLabel}, subject to the final scope of the work.`
            : `La instalación para ${topicLabel} puede agregarse como un servicio adicional. Hoy se maneja a partir de ${publicInstallationAmountLabel}, sujeto al alcance final del trabajo.`
    }

    const installationGrounding =
      productMatch || installation
        ? buildGroundingContract({
            knowledgeRetrieved: false,
            usedFacts: extractGroundingFactsFromText(text, 2),
            sources: productMatch
              ? buildStructuredGroundingSource({
                  tenantKey: tenantKey || 'default',
                  sourceType: 'published_catalog',
                  scope: 'catalog',
                  sourceKey: `product:${productMatch.id || compactText(productMatch.name || topicLabel)}`,
                  title: productMatch.name || topicLabel,
                })
              : buildTenantPolicyGroundingSource({
                  tenantKey: tenantKey || 'default',
                  sourceKey: `installation:${topicLabel}`,
                  title: `Installation policy · ${topicLabel}`,
                }),
          })
        : {
            grounded: false,
            fallbackReason: null,
          }

    return {
      text,
      toolCalls: [],
      needsHuman: false,
      grounding: installationGrounding,
      debug: {
        actionKey: intentKey,
        detail:
          productMatch || installation
            ? 'Se resolvió una condición comercial de instalación usando la política estructurada del producto o de su categoría.'
            : 'No había una política estructurada suficiente para afirmar instalación; se devolvió una respuesta conservadora.',
      },
    }
  }

  async buildDeterministicScheduleResolutionResponse({
    role,
    input,
    intentKey,
    interpretation = null,
    backendClient,
    unifiedMessage = null,
    conversationId = null,
    variationSeed = '',
  }) {
    if (
      !(role === 'customer_public' || role === 'customer_authenticated') ||
      ![
        'customer.schedule_request',
        'customer.confirmation',
        'customer.cancellation',
      ].includes(String(intentKey || ''))
    ) {
      return null
    }

    const scheduleContext =
      interpretation?.scheduleContext && typeof interpretation.scheduleContext === 'object'
        ? interpretation.scheduleContext
        : null
    if (!scheduleContext) {
      return null
    }

    const locale = resolveUnifiedLocale(unifiedMessage)
    const tenantGroundingKey = unifiedMessage?.tenantKey || 'default'
    const buildScheduleWorkflowGrounding = (
      responseText,
      {
        sourceType = 'schedule_workflow',
        scope = 'schedule',
        sourceKey = String(intentKey || 'schedule_request'),
        title = 'Schedule workflow',
        facts = null,
      } = {},
    ) =>
      buildGroundingContract({
        knowledgeRetrieved: false,
        usedFacts:
          Array.isArray(facts) && facts.length > 0
            ? facts
            : extractGroundingFactsFromText(responseText, 2),
        sources: buildStructuredGroundingSource({
          tenantKey: tenantGroundingKey,
          sourceType,
          scope,
          sourceKey,
          title,
        }),
      })

    if (intentKey === 'customer.cancellation') {
      const cancellationText = buildCustomerScheduleCancellationText(scheduleContext, {
        locale,
      })
      return {
        text: cancellationText,
        toolCalls: [],
        needsHuman: false,
        grounding: buildScheduleWorkflowGrounding(cancellationText, {
          sourceKey: 'schedule_cancellation',
          title: 'Schedule cancellation',
        }),
        debug: {
          actionKey: 'customer.schedule_request',
          detail:
            'Se cerró de forma determinística un flujo de visita técnica cuando el cliente canceló la coordinación.',
        },
      }
    }

    const confirmationClarifyText = buildCustomerScheduleConfirmationClarifyText({
      intentKey,
      scheduleContext,
      variationSeed,
      locale,
      wordingOverrides: this.getCustomerWordingOverrides(),
    })
    if (confirmationClarifyText) {
      return {
        text: confirmationClarifyText,
        toolCalls: [],
        needsHuman: false,
        grounding: buildScheduleWorkflowGrounding(confirmationClarifyText, {
          sourceKey: 'schedule_confirmation_clarify',
          title: 'Schedule confirmation clarification',
        }),
        debug: {
          actionKey: 'customer.schedule_request',
          detail:
            'Se pidió una aclaración mínima dentro del mismo flujo de agenda cuando el cliente confirmó de forma ambigua sin completar todos los datos.',
        },
      }
    }

    if (String(scheduleContext.completionStatus || '') !== 'ready_to_schedule') {
      return null
    }

    const schedulingMode = this.getCustomerCapabilityMode('customer.schedule_request')
    if (capabilityModeBlocksAutomaticResolution(schedulingMode)) {
      const handoffText = buildCustomerCapabilityHandoffText({
        capability: 'scheduling',
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
      })
      return {
        text: handoffText,
        toolCalls: [],
        needsHuman: true,
        grounding: {
          ...buildScheduleWorkflowGrounding(handoffText, {
            sourceType: 'runtime_capability',
            scope: 'capability',
            sourceKey: 'scheduling_handoff',
            title: 'Scheduling capability handoff',
          }),
          fallbackReason: 'capability_scheduling_handoff_only',
          fallbackSubtype: 'schedule_handoff',
        },
        debug: {
          actionKey: 'customer.schedule_request',
          detail:
            'La capability scheduling está en modo handoff_only y se dejó la coordinación completa en seguimiento sin consultar ni crear calendarEvent.',
        },
      }
    }

    const searchWindow = buildCustomerScheduleSearchWindow(scheduleContext)
    const toolCalls = []
    const searchCustomerAppointments =
      typeof backendClient.searchCustomerAppointments === 'function'
        ? backendClient.searchCustomerAppointments.bind(backendClient)
        : backendClient.searchAppointments.bind(backendClient)
    const createCustomerAppointment =
      typeof backendClient.createCustomerAppointment === 'function'
        ? backendClient.createCustomerAppointment.bind(backendClient)
        : backendClient.createAppointment.bind(backendClient)

    if (searchWindow?.dateFrom && searchWindow?.dateTo) {
      const dayAppointments = await searchCustomerAppointments({
        dateFrom: searchWindow.dateFrom,
        dateTo: searchWindow.dateTo,
        limit: 50,
      })
      toolCalls.push({
        name: 'search_appointments',
        status: 'executed',
        arguments: {
          dateFrom: searchWindow.dateFrom,
          dateTo: searchWindow.dateTo,
          limit: 50,
        },
        result: dayAppointments,
      })

      const overlap = findCustomerScheduleOverlap(scheduleContext, dayAppointments)
      if (overlap) {
        const unavailableText = buildCustomerScheduleUnavailableText({
          scheduleContext,
        }, {
          locale,
          variationSeed,
          wordingOverrides: this.getCustomerWordingOverrides(),
        })
        return {
          text: unavailableText,
          toolCalls,
          needsHuman: false,
          grounding: buildScheduleWorkflowGrounding(unavailableText, {
            sourceType: 'calendar_availability',
            scope: 'schedule',
            sourceKey: 'calendar_overlap',
            title: 'Calendar availability',
          }),
          debug: {
            actionKey: 'customer.schedule_request',
            detail:
              'Se validó disponibilidad real en calendarEvent y se detectó solapamiento para la visita técnica solicitada.',
          },
        }
      }
    }

    const appointmentPayload = buildCustomerScheduleAppointmentPayload({
      scheduleContext,
      conversationId,
      customerId: resolveTrustedCustomerId(unifiedMessage),
    })
    if (!appointmentPayload?.startAt) {
      return null
    }

    try {
      const appointment = await createCustomerAppointment(appointmentPayload)
      toolCalls.push({
        name: 'create_appointment',
        status: 'executed',
        arguments: appointmentPayload,
        result: appointment,
      })
      const createdText = buildCustomerScheduleCreatedText({
        scheduleContext,
        appointment,
      }, {
        locale,
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
      })

      return {
        text: createdText,
        toolCalls,
        needsHuman: false,
        grounding: buildScheduleWorkflowGrounding(createdText, {
          sourceType: 'customer_appointment',
          scope: 'schedule',
          sourceKey:
            appointment?.id != null ? `appointment:${appointment.id}` : 'appointment_created',
          title: 'Customer appointment',
        }),
        debug: {
          actionKey: 'customer.schedule_request',
          detail:
            'Se validó disponibilidad y se creó una visita técnica en calendarEvent con los datos capturados de la conversación.',
        },
      }
    } catch (error) {
      toolCalls.push({
        name: 'create_appointment',
        status: 'failed',
        arguments: appointmentPayload,
        error: error instanceof Error ? error.message : 'create_appointment failed',
      })
      const scheduleFollowUpText =
        'Perfecto. Ya tengo lo necesario para coordinar la visita técnica. Lo dejo en seguimiento para que un asesor confirme la disponibilidad y te responda a la brevedad.'

      return {
        text: scheduleFollowUpText,
        toolCalls,
        needsHuman: true,
        grounding: buildScheduleWorkflowGrounding(scheduleFollowUpText, {
          sourceKey: 'schedule_followup',
          title: 'Schedule follow-up',
        }),
        debug: {
          actionKey: 'customer.schedule_request',
          detail:
            'Se capturó el intake completo de la visita técnica, pero la creación automática en calendarEvent falló y se deriva a un asesor.',
        },
      }
    }
  }

  buildDeterministicCustomerResponse({
    role,
    input,
    intentKey,
    previousIntentKey = null,
    inboundClassification = null,
    interpretation = null,
    tenantTopicTaxonomy = [],
    tenantRuntimePolicy = null,
    variationSeed = '',
    unifiedMessage = null,
  }) {
    const readiness = readInterpretationResolutionReadiness(interpretation)
    const readinessLane =
      typeof readiness?.lane === 'string' ? readiness.lane.trim() : null
    const readinessAnswerMode = normalizeIntentKeyValue(readiness?.answerMode)
    const mustHonorOperationalReadiness =
      ['quote', 'support', 'schedule'].includes(String(readinessLane || '')) &&
      [
        'ask_quote_field',
        'quote_ready',
        'ask_support_field',
        'continue_support_resolution',
        'ask_schedule_field',
        'confirm_schedule',
      ].includes(String(readinessAnswerMode || ''))
    let effectiveIntentKey = intentKey
    if (mustHonorOperationalReadiness) {
      effectiveIntentKey =
        CUSTOMER_LANE_ACTIVE_INTENT_KEYS[String(readinessLane || '')] ||
        effectiveIntentKey
    }
    const quoteTopicType = String(interpretation?.topic?.type || '')
    const hasSpecificQuoteTopic =
      interpretation?.topic &&
      ['product_family', 'product_topic', 'product_variant'].includes(quoteTopicType)
    const hasSpecificQuoteConfiguration =
      looksLikeConfiguredProductInterest(input, tenantTopicTaxonomy) ||
      quoteTopicType === 'product_variant'
    const quoteMissingFields = Array.isArray(interpretation?.quoteContext?.missingFields)
      ? interpretation.quoteContext.missingFields.filter(
          (entry) => typeof entry === 'string',
        )
      : []
    const quoteCompletionStatus =
      typeof interpretation?.quoteContext?.completionStatus === 'string'
        ? interpretation.quoteContext.completionStatus
        : null
    const threadLabels = Array.isArray(interpretation?.threadResolution?.threads)
      ? interpretation.threadResolution.threads
          .map((entry) =>
            String(entry?.displayLabel || entry?.resolvedLabel || entry?.baseLabel || '').trim(),
          )
          .filter(Boolean)
      : []
    const hasMixedThreadedQuoteProgress =
      effectiveIntentKey === 'customer.quote' &&
      threadLabels.length > 1 &&
      Boolean(interpretation?.threadResolution?.requiresDisambiguation) &&
      (Boolean(interpretation?.quoteContext?.measurements) ||
        (Array.isArray(interpretation?.quoteContext?.measurementItems) &&
          interpretation.quoteContext.measurementItems.length > 0) ||
        Number(interpretation?.quoteContext?.quantity?.total || 0) > 0)
    const threadDisambiguationText =
      typeof interpretation?.threadResolution?.promptText === 'string' &&
      interpretation.threadResolution.promptText.trim()
        ? interpretation.threadResolution.promptText.trim()
        : null
    const shouldSuppressThreadDisambiguation =
      effectiveIntentKey === 'customer.quote' &&
      Boolean(interpretation?.quoteContext?.mixedPricingStrategies)
    const hasQuoteProgressContext =
      effectiveIntentKey === 'customer.quote' &&
      ((Boolean(interpretation?.quoteContext?.measurements) &&
        Boolean(interpretation?.followUp?.detected) &&
        Boolean(
          interpretation?.quoteContext?.requiresMeasurements ||
            interpretation?.quoteContext?.familyLabel ||
          interpretation?.quoteContext?.topicLabel,
        )) ||
        looksLikeQuoteRequirementsQuestion(input))
    const standaloneAttachmentArtifactInput =
      typeof unifiedMessage?.text === 'string' && unifiedMessage.text.trim()
        ? unifiedMessage.text
        : input
    const standaloneAttachmentArtifactKind = detectStandaloneAttachmentArtifactKind(
      standaloneAttachmentArtifactInput,
    )
    const channel = unifiedMessage?.channel || null
    const channelProfile = this.getResponseChannelProfile(channel)
    const tenantGroundingKey =
      unifiedMessage?.tenantKey ||
      tenantRuntimePolicy?.tenantKey ||
      'default'
    const buildWorkflowGrounding = (
      responseText,
      {
        sourceType = 'conversation_workflow',
        scope = 'conversation',
        sourceKey = String(effectiveIntentKey || 'conversation'),
        title = 'Conversation workflow',
        facts = null,
      } = {},
    ) =>
      buildGroundingContract({
        knowledgeRetrieved: false,
        usedFacts:
          Array.isArray(facts) && facts.length > 0
            ? facts
            : extractGroundingFactsFromText(responseText, 2),
        sources: buildStructuredGroundingSource({
          tenantKey: tenantGroundingKey,
          sourceType,
          scope,
          sourceKey,
          title,
        }),
      })
    const inheritedIntentKey =
      typeof interpretation?.followUp?.inheritedIntentKey === 'string'
        ? interpretation.followUp.inheritedIntentKey
        : null
    const hasQuoteDetailContext = Boolean(
      interpretation?.quoteContext?.topicLabel ||
        interpretation?.quoteContext?.familyLabel ||
        interpretation?.quoteContext?.measurements ||
        Number(interpretation?.quoteContext?.quantity?.total || 0) > 0 ||
        (interpretation?.quoteContext?.capturedAttributes &&
          Object.keys(interpretation.quoteContext.capturedAttributes).length > 0),
    )
    const hasSupportContext =
      Boolean(interpretation?.supportContext) ||
      effectiveIntentKey === 'customer.support_request' ||
      inheritedIntentKey === 'customer.support_request' ||
      previousIntentKey === 'customer.support_request'
    const hasQuoteContext =
      ['customer.quote', 'customer.price_inquiry'].includes(effectiveIntentKey) ||
      (['customer.product_info', 'customer.topic_info'].includes(effectiveIntentKey) &&
        hasQuoteDetailContext)
    const hasExplicitMultimodalReferenceCue = hasMultimodalReferenceSignal(input)
    const hasExplicitMultimodalArtifactPlanCue =
      hasMultimodalPlannedArtifactSignal(input)
    const hasExplicitReengagementCue = hasReengagementReferenceSignal(input)
    const hasMultimodalFollowUpReference =
      hasExplicitMultimodalReferenceCue &&
      Boolean(
        interpretation?.followUp?.detected ||
          interpretation?.contextTopic?.label ||
          hasQuoteDetailContext,
      )
    const hasMultimodalArtifactPlan =
      hasExplicitMultimodalArtifactPlanCue &&
      Boolean(
        interpretation?.followUp?.detected ||
          inheritedIntentKey ||
          interpretation?.contextTopic?.label ||
          hasQuoteDetailContext ||
          effectiveIntentKey === 'customer.quote' ||
          effectiveIntentKey === 'customer.support_request',
      )
    const hasReengagementReference =
      hasExplicitReengagementCue &&
      Boolean(
        interpretation?.followUp?.detected ||
          inheritedIntentKey ||
          interpretation?.contextTopic?.label ||
          hasQuoteDetailContext ||
          effectiveIntentKey === 'customer.quote' ||
          effectiveIntentKey === 'customer.support_request',
      )
    const inboundDecisionPath = Array.isArray(inboundClassification?.decisionPath)
      ? inboundClassification.decisionPath
      : []
    const hasPaymentProofContinuitySignal =
      inboundDecisionPath.some((entry) =>
        [
          'classifier:payment_followup_support_request',
          'classifier:payment_proof_artifact',
          'classifier:payment_operational_update',
        ].includes(String(entry || '')),
      ) ||
      looksLikePaymentProofFollowUpRequest(input) ||
      looksLikePaymentProofArtifact(input) ||
      looksLikePaymentOperationalUpdate(input)
    const currentFaqSubtype = detectCustomerFaqSubtype(input, {
      previousIntentKey: hasSupportContext
        ? 'customer.support_request'
        : inheritedIntentKey || effectiveIntentKey,
      tenantRuntimePolicy,
    })
    const faqDecisionContext = resolveFaqSubtypeDecisionContext({
      faqSubtype: currentFaqSubtype,
      readiness,
      quoteContext: interpretation?.quoteContext || null,
      supportContext: interpretation?.supportContext || null,
      scheduleContext: interpretation?.scheduleContext || null,
    })
    const threadScopedFaqSubtype = faqDecisionContext.threadScopedFaqSubtype
    const fallbackFaqSubtype = faqDecisionContext.fallbackFaqSubtype
    const activeFaqThreadLane = faqDecisionContext.activeThreadLane
    const effectiveFaqSubtype = threadScopedFaqSubtype || fallbackFaqSubtype
    const hasSpecificCurrentFaqSubtype = hasSpecificFaqSubtype(effectiveFaqSubtype)
    const tenantBusinessFactResponse = buildTenantBusinessFactFaqResponse({
      faqSubtype:
        !hasSpecificCurrentFaqSubtype &&
        (effectiveIntentKey === 'customer.contact_info' || readinessLane === 'contact')
          ? 'contact'
          : null,
      tenantRuntimePolicy,
    })
    const normalizedSupportInput = normalizeText(input)
    const hasSupportReviewCue =
      /\b(repar\w*|revisi\w*|service|cambi\w*|ajust\w*|mover|acortar)\b/.test(
        normalizedSupportInput,
      )
    const hasSupportVisitCue =
      /\b(cuando|cu[aá]ndo|podr\w*|pued\w*|venir|pasar|domicilio|visita|coordinar|manana|mañana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|a las|\d{1,2}:\d{2}|entre las|los espero|las espero|te espero)\b/.test(
        normalizedSupportInput,
      )

    const canUseNeutralContinuityResponse =
      (standaloneAttachmentArtifactKind ||
        hasExplicitMultimodalReferenceCue ||
        hasExplicitMultimodalArtifactPlanCue ||
        hasExplicitReengagementCue) &&
      ['unknown', 'customer.other'].includes(String(effectiveIntentKey || ''))
    const canUseTopicInfoDeterministicResponse =
      effectiveIntentKey === 'customer.topic_info' &&
      (hasSupportContext ||
        hasQuoteContext ||
        readinessLane === 'contact' ||
        ['payment_methods', 'contact', 'availability'].includes(
          String(effectiveFaqSubtype || ''),
        ))
    const canUseAvailabilityDeterministicResponse =
      fallbackFaqSubtype === 'availability' &&
      !mustHonorOperationalReadiness &&
      !hasPaymentProofContinuitySignal &&
      readinessLane !== 'schedule' &&
      !standaloneAttachmentArtifactKind &&
      !hasSupportContext &&
      !hasQuoteContext &&
      [
        'customer.topic_info',
        'customer.contact_info',
        'customer.other',
        'unknown',
        'customer.light',
        'customer.confirmation',
        'customer.incomplete',
        'customer.clarify_request',
        'customer.rephrase_request',
        'customer.repetition',
      ].includes(String(effectiveIntentKey || ''))

    if (
      !(role === 'customer_public' || role === 'customer_authenticated') ||
      !(
        [
          'customer.light',
          'customer.clarify_request',
          'customer.rephrase_request',
          'customer.unintelligible',
          'customer.incomplete',
          'customer.product_info',
          'customer.price_inquiry',
          'customer.support_request',
          'customer.schedule_request',
          'customer.auth_required',
          'customer.owned_document_request',
          'customer.private_account_data',
          'customer.contact_info',
          'customer.multi_intent',
          'customer.repetition',
          'customer.confirmation',
          'customer.cancellation',
          'customer.frustration',
          'customer.sensitive',
          'customer.out_of_scope',
          'customer.quote',
        ].includes(effectiveIntentKey) ||
        canUseAvailabilityDeterministicResponse ||
        canUseNeutralContinuityResponse ||
        canUseTopicInfoDeterministicResponse
      )
    ) {
      return null
    }

    const capabilityMode = this.getCustomerCapabilityMode(effectiveIntentKey)
    if (
      capabilityModeBlocksAutomaticResolution(capabilityMode) &&
      ['customer.product_info', 'customer.topic_info', 'customer.contact_info'].includes(
        effectiveIntentKey,
      )
    ) {
      return this.buildCustomerCapabilityModeResponse({
        intentKey: effectiveIntentKey,
        interpretation,
        variationSeed,
      })
    }

    if (
      tenantBusinessFactResponse &&
      !mustHonorOperationalReadiness &&
      (effectiveIntentKey === 'customer.contact_info' || readinessLane === 'contact') &&
      !hasSpecificCurrentFaqSubtype
    ) {
      return {
        text: tenantBusinessFactResponse.text,
        toolCalls: [],
        needsHuman: false,
        grounding: buildGroundingContract({
          knowledgeRetrieved: false,
          usedFacts: tenantBusinessFactResponse.usedFacts,
          sources: buildTenantPolicyGroundingSource({
            tenantKey: tenantGroundingKey,
            sourceKey: tenantBusinessFactResponse.sourceKey,
            title: tenantBusinessFactResponse.title,
          }),
        }),
        debug: {
          actionKey: effectiveIntentKey,
          detail:
            'Se respondió una FAQ operativa directamente desde facts estructuradas del tenant, sin abrir retrieval ni depender del proveedor.',
        },
      }
    }

    if (
      hasMixedThreadedQuoteProgress &&
      threadLabels.length > 1
    ) {
      const threadList =
        threadLabels.length === 2
          ? `${threadLabels[0]} y ${threadLabels[1]}`
          : `${threadLabels.slice(0, -1).join(', ')} y ${threadLabels.at(-1)}`
      const mixedQuoteText =
        `Perfecto. Veo que la solicitud mezcla ${threadList}. Como requieren una resolución distinta, dejo la cotización en seguimiento para que un asesor la revise completa y te responda a la brevedad.`

      return {
        text: mixedQuoteText,
        toolCalls: [],
        needsHuman: true,
        grounding: buildWorkflowGrounding(mixedQuoteText, {
          sourceType: 'thread_resolution',
          scope: 'quote',
          sourceKey: `mixed:${threadLabels.join('|')}`,
          title: 'Quote thread resolution',
          facts: [
            `La solicitud mezcla ${threadList}.`,
            'La cotización requiere seguimiento por asesor.',
          ],
        }),
        debug: {
          actionKey: effectiveIntentKey,
          detail:
            'Se evitó desambiguar en una cotización multi-producto con intake avanzado y se priorizó el camino menos optimista: seguimiento completo por asesor.',
        },
      }
    }

    if (
      threadDisambiguationText &&
      !shouldSuppressThreadDisambiguation &&
      [
        'customer.product_info',
        'customer.topic_info',
        'customer.quote',
        'customer.price_inquiry',
      ].includes(effectiveIntentKey)
    ) {
      return {
        text: threadDisambiguationText,
        toolCalls: [],
        needsHuman: false,
        grounding: buildWorkflowGrounding(threadDisambiguationText, {
          sourceType: 'thread_resolution',
          scope: 'conversation',
          sourceKey: `prompt:${effectiveIntentKey}`,
          title: 'Thread disambiguation',
        }),
        debug: {
          actionKey: effectiveIntentKey,
          detail:
            'Se devolvió una aclaración determinística para separar hilos conversacionales cuando el cliente mezcla más de un tema en el mismo turno.',
        },
      }
    }

    const hasMaterialFollowUpContext =
      Boolean(
        interpretation?.followUp?.detected ||
          interpretation?.contextTopic?.label ||
          interpretation?.topic?.label ||
          interpretation?.quoteContext?.topicLabel ||
          interpretation?.quoteContext?.familyLabel,
      )

    if (
      ['customer.quote', 'customer.product_info', 'customer.topic_info'].includes(
        effectiveIntentKey,
      ) &&
      looksLikeMaterialFollowUpRequest(input) &&
      hasMaterialFollowUpContext
    ) {
      const materialSubject =
        interpretation?.topic?.label ||
        interpretation?.contextTopic?.label ||
        interpretation?.quoteContext?.topicLabel ||
        interpretation?.quoteContext?.familyLabel ||
        'esa opción'
      const materialText = buildCustomerMaterialFollowUpText({
        subject: materialSubject,
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
        channel,
        channelProfile,
      })

      return {
        text: materialText,
        wordingKey: 'customer.fallback.material_followup',
        toolCalls: [],
        needsHuman: false,
        grounding: buildWorkflowGrounding(materialText, {
          sourceType: 'tenant_policy',
          scope: 'topic_followup',
          sourceKey: `material:${compactText(materialSubject) || 'topic'}`,
          title: `Material follow-up · ${materialSubject}`,
        }),
        debug: {
          actionKey: effectiveIntentKey,
          wordingKey: 'customer.fallback.material_followup',
          detail:
            'Se priorizó un follow-up visual o de material dentro del hilo activo sin reabrir intake de cotización.',
        },
      }
    }

    const hasProductFollowUpContext = Boolean(
      interpretation?.followUp?.detected ||
        interpretation?.contextTopic?.label ||
        interpretation?.topic?.label,
    )
    const hasInheritedCommercialIntentContext = [
      'customer.product_info',
      'customer.topic_info',
      'customer.quote',
      'customer.price_inquiry',
      'customer.support_request',
    ].includes(String(inheritedIntentKey || previousIntentKey || ''))
    const hasCommercialThreadPaymentContext = Boolean(
      hasQuoteContext ||
        interpretation?.followUp?.detected ||
        hasInheritedCommercialIntentContext ||
        (interpretation?.followUp?.detected &&
          (interpretation?.contextTopic?.label ||
            interpretation?.quoteContext?.topicLabel ||
            interpretation?.quoteContext?.familyLabel)),
    )
    const canUseStandalonePaymentMethodsResponse =
      fallbackFaqSubtype === 'payment_methods' &&
      !mustHonorOperationalReadiness &&
      !hasSupportContext &&
      !hasCommercialThreadPaymentContext &&
      !hasPaymentProofContinuitySignal &&
      !standaloneAttachmentArtifactKind &&
      !hasMultimodalArtifactPlan &&
      !hasMultimodalFollowUpReference &&
      [
        'customer.topic_info',
        'customer.contact_info',
        'customer.other',
        'customer.light',
        'customer.confirmation',
        'customer.incomplete',
        'customer.clarify_request',
        'customer.rephrase_request',
        'customer.repetition',
        'unknown',
      ].includes(String(effectiveIntentKey || ''))

    const productFollowUpSubject =
      interpretation?.topic?.label ||
      interpretation?.contextTopic?.label ||
      interpretation?.quoteContext?.topicLabel ||
      interpretation?.quoteContext?.familyLabel ||
      'esa opción'

    if (
      ['customer.product_info', 'customer.topic_info'].includes(effectiveIntentKey) &&
      hasProductFollowUpContext &&
      looksLikeLightFilterPreferenceRequest(input) &&
      subjectMatchesComparableFamily(productFollowUpSubject, tenantRuntimePolicy)
    ) {
      const lightFilterText = buildCustomerLightFilterGuidanceText({
        subject: productFollowUpSubject,
        guidance: getBusinessRules(tenantRuntimePolicy)?.lightFilterGuidance ?? null,
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
        channel,
        channelProfile,
      })
      return {
        text: lightFilterText,
        wordingKey: 'customer.product.light_filter_guidance',
        toolCalls: [],
        needsHuman: false,
        grounding: buildWorkflowGrounding(lightFilterText, {
          sourceType: 'tenant_policy',
          scope: 'product_guidance',
          sourceKey: `light_filter:${compactText(productFollowUpSubject) || 'topic'}`,
          title: `Light filter guidance · ${productFollowUpSubject}`,
        }),
        debug: {
          actionKey: effectiveIntentKey,
          wordingKey: 'customer.product.light_filter_guidance',
          detail:
            'Se priorizó guía contextual de variantes configuradas para paso de luz sin degradar la consulta a agenda ni a lookup de producto publicado.',
        },
      }
    }

    if (
      ['customer.product_info', 'customer.topic_info'].includes(effectiveIntentKey) &&
      hasProductFollowUpContext &&
      effectiveFaqSubtype === 'variants'
    ) {
      const productOptionsSubject =
        buildContextualProductReference({
          requestedTopicLabel: productFollowUpSubject,
          topicLabel: interpretation?.topic?.label || null,
          contextTopicLabel: interpretation?.contextTopic?.label || null,
          tenantTopicTaxonomy,
        }) || productFollowUpSubject
      const optionsText = pickWordingVariant({
        key: 'customer.product.options_offer',
        variationSeed,
        overrides: this.getCustomerWordingOverrides(),
        channel,
        channelProfile,
        variables: {
          topic: productOptionsSubject,
        },
        fallback: `Perfecto, trabajamos con distintas opciones de ${productOptionsSubject}. Si querés, te cuento cuáles convienen más según uso, luz y privacidad.`,
      })

      return {
        text: optionsText,
        wordingKey: 'customer.product.options_offer',
        toolCalls: [],
        needsHuman: false,
        grounding: buildWorkflowGrounding(optionsText, {
          sourceType: 'tenant_policy',
          scope: 'product_options',
          sourceKey: `options:${compactText(productOptionsSubject) || 'topic'}`,
          title: `Product options · ${productOptionsSubject}`,
        }),
        debug: {
          actionKey: effectiveIntentKey,
          wordingKey: 'customer.product.options_offer',
          detail:
            'Se mantuvo el hilo activo del producto para responder un follow-up de variantes sin reabrir intake ni caer al proveedor.',
        },
      }
    }

    if (
      ['customer.quote', 'customer.price_inquiry'].includes(effectiveIntentKey) &&
      looksLikeInstalledReplacementAssessmentRequest(
        input,
        tenantTopicTaxonomy,
        tenantRuntimePolicy,
      )
    ) {
      const replacementSubjectLabel = compactText(
        interpretation?.quoteContext?.topicLabel ||
          interpretation?.quoteContext?.familyLabel ||
          interpretation?.topic?.label ||
          interpretation?.contextTopic?.label ||
          '',
      )
      const replacementSubjectClause = replacementSubjectLabel
        ? `el cambio de ${replacementSubjectLabel}`
        : 'ese cambio'
      const replacementText = pickWordingVariant({
        key: 'customer.quote.replacement_followup',
        variationSeed,
        overrides: this.getCustomerWordingOverrides(),
        channel,
        channelProfile,
        variables: {
          subjectClause: replacementSubjectClause,
        },
        fallback:
          `Perfecto. Para orientarte mejor con ${replacementSubjectClause}, pasame una foto y las medidas que tengas. Si querés, además decime la zona o dirección y lo dejamos encaminado.`,
      })
      return {
        text: replacementText,
        wordingKey: 'customer.quote.replacement_followup',
        toolCalls: [],
        needsHuman: false,
        grounding: buildWorkflowGrounding(replacementText, {
          sourceType: 'quote_workflow',
          scope: 'quote',
          sourceKey: `replacement:${compactText(replacementSubjectLabel) || 'general'}`,
          title: `Replacement follow-up · ${replacementSubjectLabel || 'general'}`,
        }),
        debug: {
          actionKey: effectiveIntentKey,
          wordingKey: 'customer.quote.replacement_followup',
          detail:
            'Se detectó un pedido de cambio o reemplazo sobre elementos ya instalados y se pidió foto, medidas y ubicación sin degradarlo a un quote genérico.',
        },
      }
    }

    if (
      hasSupportContext &&
      hasPaymentProofContinuitySignal &&
      (hasMultimodalArtifactPlan ||
        standaloneAttachmentArtifactKind ||
        hasMultimodalFollowUpReference)
    ) {
      const supportProofText = buildCustomerSupportRequestText(input, {
        interpretation,
        tenantTopicTaxonomy,
        paymentMethods: getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [],
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
        channel,
        channelProfile,
      })
      return {
        text: supportProofText,
        toolCalls: [],
        needsHuman: false,
        grounding: buildWorkflowGrounding(supportProofText, {
          sourceType: 'support_workflow',
          scope: 'support',
          sourceKey: 'payment_proof_followup',
          title: 'Support payment-proof workflow',
        }),
        debug: {
          actionKey: effectiveIntentKey,
          detail:
            'Se priorizó continuidad operativa de comprobante de pago sobre la rama multimodal genérica.',
        },
      }
    }

    if (
      (hasSupportContext || activeFaqThreadLane === 'support') &&
      threadScopedFaqSubtype === 'payment_methods' &&
      !(hasSupportReviewCue && hasSupportVisitCue) &&
      !hasPaymentProofContinuitySignal &&
      !standaloneAttachmentArtifactKind &&
      !hasMultimodalArtifactPlan &&
      !hasMultimodalFollowUpReference
    ) {
      const paymentMethods = resolveOperationalPaymentMethodsInline(input, {
        paymentMethods: getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [],
      })
      return {
        text: pickWordingVariant({
          key: 'customer.faq.payment_methods_operational_followup',
          variationSeed,
          overrides: this.getCustomerWordingOverrides(),
          channel,
          channelProfile,
          variables: {
            paymentMethods,
          },
          fallback: `Aceptamos ${paymentMethods}. Si ya mandaste el adjunto o el comprobante, lo dejo en seguimiento y continuamos por este canal.`,
        }),
        wordingKey: 'customer.faq.payment_methods_operational_followup',
        toolCalls: [],
        needsHuman: false,
        grounding: buildGroundingContract({
          knowledgeRetrieved: false,
          usedFacts: [`Aceptamos ${paymentMethods}.`],
          sources: buildTenantPolicyGroundingSource({
            tenantKey:
              unifiedMessage?.tenantKey ||
              tenantRuntimePolicy?.tenantKey ||
              'default',
            sourceKey: 'payment_methods',
            title: 'Tenant payment methods',
          }),
        }),
        debug: {
          actionKey: effectiveIntentKey,
          wordingKey: 'customer.faq.payment_methods_operational_followup',
          detail:
            'Se respondió una consulta operativa de medios de pago dentro de un hilo de soporte sin depender del buscador ni del proveedor.',
        },
      }
    }

    if (canUseStandalonePaymentMethodsResponse) {
      const paymentMethods = resolveOperationalPaymentMethodsInline(input, {
        paymentMethods: getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [],
      })
      if (compactText(paymentMethods)) {
        return {
          text: pickWordingVariant({
            key: 'customer.faq.payment_methods',
            variationSeed,
            overrides: this.getCustomerWordingOverrides(),
            channel,
            channelProfile,
            variables: {
              paymentMethods,
            },
            fallback:
              `Aceptamos ${paymentMethods}. Si querés, te indico opciones o condiciones según el medio de pago.`,
          }),
          wordingKey: 'customer.faq.payment_methods',
          toolCalls: [],
          needsHuman: false,
          grounding: buildGroundingContract({
            knowledgeRetrieved: false,
            usedFacts: [`Aceptamos ${paymentMethods}.`],
            sources: buildTenantPolicyGroundingSource({
              tenantKey:
                unifiedMessage?.tenantKey ||
                tenantRuntimePolicy?.tenantKey ||
                'default',
              sourceKey: 'payment_methods',
              title: 'Tenant payment methods',
            }),
          }),
          debug: {
            actionKey: effectiveIntentKey,
            wordingKey: 'customer.faq.payment_methods',
            detail:
              'Se respondió una consulta standalone de medios de pago usando business rules del tenant, sin caer en fallback de contacto ni en retrieval-only.',
          },
        }
      }
    }

    if (
      (hasCommercialThreadPaymentContext || activeFaqThreadLane === 'quote') &&
      threadScopedFaqSubtype === 'payment_methods' &&
      !hasSupportContext &&
      !hasPaymentProofContinuitySignal &&
      !standaloneAttachmentArtifactKind &&
      !hasMultimodalArtifactPlan &&
      !hasMultimodalFollowUpReference
    ) {
      const paymentMethods = resolveOperationalPaymentMethodsInline(input, {
        paymentMethods: getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [],
      })
      return {
        text: pickWordingVariant({
          key: 'customer.faq.payment_methods',
          variationSeed,
          overrides: this.getCustomerWordingOverrides(),
          channel,
          channelProfile,
          variables: {
            paymentMethods,
          },
          fallback:
            `Aceptamos ${paymentMethods}. Si querés, te indico opciones o condiciones según el medio de pago para ese presupuesto.`,
        }),
        wordingKey: 'customer.faq.payment_methods',
        toolCalls: [],
        needsHuman: false,
        grounding: buildGroundingContract({
          knowledgeRetrieved: false,
          usedFacts: [`Aceptamos ${paymentMethods}.`],
          sources: buildTenantPolicyGroundingSource({
            tenantKey:
              unifiedMessage?.tenantKey ||
              tenantRuntimePolicy?.tenantKey ||
              'default',
            sourceKey: 'payment_methods',
            title: 'Tenant payment methods',
          }),
        }),
        debug: {
          actionKey: effectiveIntentKey,
          wordingKey: 'customer.faq.payment_methods',
          detail:
            'Se respondió una consulta de medios de pago dentro de un hilo comercial activo usando business rules del tenant, sin abrir un retrieval que no se iba a usar.',
        },
      }
    }

    if (
      hasMultimodalArtifactPlan &&
      (hasSupportContext || hasQuoteContext)
    ) {
      const multimodalPlannedText = hasSupportContext
        ? buildCustomerMultimodalSupportArtifactPlannedText({
            variationSeed,
            wordingOverrides: this.getCustomerWordingOverrides(),
            channel,
            channelProfile,
          })
        : buildCustomerMultimodalQuoteArtifactPlannedText({
            variationSeed,
            wordingOverrides: this.getCustomerWordingOverrides(),
            channel,
            channelProfile,
            interpretation,
          })
      return {
        text: multimodalPlannedText,
        wordingKey: hasSupportContext
          ? 'customer.multimodal.support_artifact_planned'
          : 'customer.multimodal.quote_artifact_planned',
        toolCalls: [],
        needsHuman: false,
        grounding: buildWorkflowGrounding(multimodalPlannedText, {
          sourceType: hasSupportContext ? 'support_workflow' : 'quote_workflow',
          scope: hasSupportContext ? 'support' : 'quote',
          sourceKey: hasSupportContext ? 'artifact_planned_support' : 'artifact_planned_quote',
          title: hasSupportContext
            ? 'Support artifact planned'
            : 'Quote artifact planned',
        }),
        debug: {
          actionKey: effectiveIntentKey,
          detail:
            'Se mantuvo continuidad útil cuando el cliente anunció que enviará fotos o material dentro del hilo activo.',
        },
      }
    }

    if (hasExplicitMultimodalArtifactPlanCue && !hasSupportContext && !hasQuoteContext) {
      return {
        text: buildCustomerMultimodalGenericArtifactPlannedText({
          variationSeed,
          wordingOverrides: this.getCustomerWordingOverrides(),
          channel,
          channelProfile,
        }),
        wordingKey: 'customer.multimodal.generic_artifact_planned',
        toolCalls: [],
        needsHuman: false,
        grounding: {
          grounded: false,
          fallbackReason: null,
        },
        debug: {
          actionKey: 'customer.multimodal',
          detail:
            'Se mantuvo una continuidad multimodal neutra cuando el cliente anunció un adjunto sin suficiente contexto para asumir quote o soporte.',
        },
      }
    }

    if (
      hasReengagementReference &&
      (hasSupportContext || hasQuoteContext)
    ) {
      const reengagementText = buildCustomerReengagementFollowUpText({
        kind: hasSupportContext ? 'support' : 'quote',
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
        channel,
        channelProfile,
      })
      return {
        text: reengagementText,
        wordingKey: hasSupportContext
          ? 'customer.reengagement.support_followup'
          : 'customer.reengagement.quote_followup',
        toolCalls: [],
        needsHuman: false,
        grounding: buildWorkflowGrounding(reengagementText, {
          sourceType: hasSupportContext ? 'support_workflow' : 'quote_workflow',
          scope: hasSupportContext ? 'support' : 'quote',
          sourceKey: hasSupportContext ? 'reengagement_support' : 'reengagement_quote',
          title: hasSupportContext ? 'Support reengagement' : 'Quote reengagement',
        }),
        debug: {
          actionKey: effectiveIntentKey,
          detail:
            'Se trató un reenganche explícito conservando el hilo previo en lugar de reiniciar la conversación.',
        },
      }
    }

    if (
      hasExplicitReengagementCue &&
      !hasSupportContext &&
      !hasQuoteContext &&
      WEAK_NEUTRAL_REENGAGEMENT_INTENTS.has(String(effectiveIntentKey || ''))
    ) {
      return {
        text: buildCustomerReengagementNeutralText({
          variationSeed,
          wordingOverrides: this.getCustomerWordingOverrides(),
          channel,
          channelProfile,
        }),
        wordingKey: 'customer.reengagement.neutral_followup',
        toolCalls: [],
        needsHuman: false,
        grounding: {
          grounded: false,
          fallbackReason: null,
        },
        debug: {
          actionKey: 'customer.reengagement',
          detail:
            'Se retomó el hilo con una pregunta orientadora neutral cuando no había suficiente contexto para asumir quote o soporte.',
        },
      }
    }

    if (
      standaloneAttachmentArtifactKind &&
      (hasSupportContext || hasQuoteContext)
    ) {
      const contextualArtifactText = hasSupportContext
        ? buildCustomerMultimodalSupportArtifactText({
            variationSeed,
            wordingOverrides: this.getCustomerWordingOverrides(),
            channel,
            channelProfile,
          })
        : buildCustomerMultimodalQuoteArtifactText({
            variationSeed,
            wordingOverrides: this.getCustomerWordingOverrides(),
            channel,
            channelProfile,
            interpretation,
          })
      return {
        text: contextualArtifactText,
        wordingKey: hasSupportContext
          ? 'customer.multimodal.support_artifact_received'
          : 'customer.multimodal.quote_artifact_received',
        toolCalls: [],
        needsHuman: false,
        grounding: buildWorkflowGrounding(contextualArtifactText, {
          sourceType: hasSupportContext ? 'support_workflow' : 'quote_workflow',
          scope: hasSupportContext ? 'support' : 'quote',
          sourceKey: hasSupportContext ? 'artifact_received_support' : 'artifact_received_quote',
          title: hasSupportContext ? 'Support artifact received' : 'Quote artifact received',
        }),
        debug: {
          actionKey: effectiveIntentKey,
          detail:
            'Se trató un adjunto como continuidad contextual del hilo activo, evitando volver a un intake genérico.',
        },
      }
    }

    if (standaloneAttachmentArtifactKind) {
      return {
        text: buildCustomerMultimodalGenericArtifactText({
          variationSeed,
          wordingOverrides: this.getCustomerWordingOverrides(),
          channel,
          channelProfile,
          artifactKind: standaloneAttachmentArtifactKind,
        }),
        wordingKey: 'customer.multimodal.generic_artifact_received',
        toolCalls: [],
        needsHuman: false,
        grounding: {
          grounded: false,
          fallbackReason: null,
        },
        debug: {
          actionKey: 'customer.multimodal',
          detail:
            'Se respondió un adjunto sin contexto suficiente con una continuidad multimodal neutra, sin convertir el nombre del archivo en un tema.',
        },
      }
    }

    if (
      hasMultimodalFollowUpReference &&
      (hasSupportContext || hasQuoteContext)
    ) {
      const contextualArtifactReferenceText = hasSupportContext
        ? buildCustomerMultimodalSupportArtifactText({
            variationSeed,
            wordingOverrides: this.getCustomerWordingOverrides(),
            channel,
            channelProfile,
            referenceOnly: true,
          })
        : buildCustomerMultimodalQuoteArtifactText({
            variationSeed,
            wordingOverrides: this.getCustomerWordingOverrides(),
            channel,
            channelProfile,
            referenceOnly: true,
            interpretation,
          })
      return {
        text: contextualArtifactReferenceText,
        wordingKey: hasSupportContext
          ? 'customer.multimodal.support_artifact_reference'
          : 'customer.multimodal.quote_artifact_reference',
        toolCalls: [],
        needsHuman: false,
        grounding: buildWorkflowGrounding(contextualArtifactReferenceText, {
          sourceType: hasSupportContext ? 'support_workflow' : 'quote_workflow',
          scope: hasSupportContext ? 'support' : 'quote',
          sourceKey: hasSupportContext ? 'artifact_reference_support' : 'artifact_reference_quote',
          title: hasSupportContext ? 'Support artifact reference' : 'Quote artifact reference',
        }),
        debug: {
          actionKey: effectiveIntentKey,
          detail:
            'Se respondió una referencia multimodal corta manteniendo el hilo activo y el siguiente paso útil.',
        },
      }
    }

    if (hasExplicitMultimodalReferenceCue && !hasSupportContext && !hasQuoteContext) {
      return {
        text: buildCustomerMultimodalGenericArtifactText({
          variationSeed,
          wordingOverrides: this.getCustomerWordingOverrides(),
          channel,
          channelProfile,
          referenceOnly: true,
          artifactKind: standaloneAttachmentArtifactKind,
        }),
        wordingKey: 'customer.multimodal.generic_artifact_reference',
        toolCalls: [],
        needsHuman: false,
        grounding: {
          grounded: false,
          fallbackReason: null,
        },
        debug: {
          actionKey: 'customer.multimodal',
          detail:
            'Se respondió una referencia multimodal corta sin asumir un hilo comercial u operativo que no estaba suficientemente sustentado.',
        },
      }
    }

    if (
      standaloneAttachmentArtifactKind &&
      ['customer.incomplete', 'customer.product_info', 'customer.other', 'unknown'].includes(
        effectiveIntentKey,
      )
    ) {
      return {
        text: renderCustomerDeterministicText({
          intentKey: 'customer.incomplete',
          input: standaloneAttachmentArtifactInput,
          inboundClassification,
          config: this.activeConfig,
          interpretation,
          tenantTopicTaxonomy,
          paymentMethods: getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [],
          installationTerms: getBusinessRules(tenantRuntimePolicy)?.installationTerms ?? [],
          locale: resolveUnifiedLocale(unifiedMessage || { text: standaloneAttachmentArtifactInput }),
          variationSeed,
          wordingOverrides: this.getCustomerWordingOverrides(),
          channel,
          channelProfile,
        }),
        toolCalls: [],
        needsHuman: false,
        grounding: {
          grounded: false,
          fallbackReason: null,
        },
        debug: {
          actionKey: 'customer.incomplete',
          detail:
            'Se trató un adjunto puro sin contexto adicional como continuidad incompleta útil, evitando degradarlo a producto o consulta genérica.',
        },
      }
    }

    if (canUseAvailabilityDeterministicResponse) {
      const availabilityText = buildCustomerAvailabilityFallbackText()
      return {
        text: availabilityText,
        toolCalls: [],
        needsHuman: false,
        grounding: buildWorkflowGrounding(availabilityText, {
          sourceType: 'availability_workflow',
          scope: 'availability',
          sourceKey: 'delivery_time_guidance',
          title: 'Availability guidance',
        }),
        debug: {
          actionKey: effectiveIntentKey === 'customer.topic_info' ? effectiveIntentKey : 'customer.topic_info',
          detail:
            'Se devolvió una respuesta determinística para disponibilidad o tiempo de entrega sin abrir retrieval ni depender del proveedor.',
        },
      }
    }

    if (effectiveIntentKey === 'customer.product_info') {
      return null
    }

    if (
      effectiveIntentKey === 'customer.topic_info' &&
      effectiveFaqSubtype === 'definition' &&
      hasProductFollowUpContext
    ) {
      return null
    }

    if (
      effectiveIntentKey === 'customer.quote' &&
      hasSpecificQuoteConfiguration &&
      hasSpecificQuoteTopic &&
      quoteMissingFields.length === 0 &&
      quoteCompletionStatus === 'ready_for_pricing_or_handoff' &&
      !hasQuoteProgressContext
    ) {
      return null
    }

    const text = renderCustomerDeterministicText({
      intentKey: effectiveIntentKey,
      input,
      inboundClassification,
      config: this.activeConfig,
      interpretation,
      tenantTopicTaxonomy,
      paymentMethods: getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [],
      installationTerms: getBusinessRules(tenantRuntimePolicy)?.installationTerms ?? [],
      faqSubtype: effectiveFaqSubtype,
      locale: resolveUnifiedLocale(unifiedMessage || { text: input }),
      variationSeed,
      wordingOverrides: this.getCustomerWordingOverrides(),
      channel,
      channelProfile,
    })
    let detail = null

    switch (effectiveIntentKey) {
      case 'customer.clarify_request':
        detail =
          'Se devolvió una aclaración mínima determinística para un pedido genérico de información de cliente.'
        break
      case 'customer.rephrase_request':
        detail =
          'Se devolvió una respuesta determinística para una solicitud de reexplicación o aclaración del cliente.'
        break
      case 'customer.unintelligible':
        detail =
          'Se devolvió una respuesta determinística para texto ininteligible de cliente, solicitando reformulación mínima.'
        break
      case 'customer.incomplete':
        detail =
          'Se devolvió una aclaración mínima determinística para un mensaje incompleto de cliente.'
        break
      case 'customer.price_inquiry':
        detail =
          'Se devolvió una respuesta determinística para una consulta genérica de precios, solicitando el dato mínimo faltante.'
        break
      case 'customer.quote':
        detail =
          'Se devolvió una respuesta determinística para una solicitud genérica de presupuesto, pidiendo el alcance mínimo antes de consultar conocimiento o proveedor.'
        break
      case 'customer.support_request':
        detail =
          'Se devolvió una respuesta determinística para un pedido de service, revisión o ajuste sobre un producto ya instalado.'
        break
      case 'customer.schedule_request':
        detail =
          'Se devolvió una respuesta determinística para coordinar visita o instalación, solicitando zona, dirección y franja mínima.'
        break
      case 'customer.auth_required':
        detail =
          'Se devolvió una respuesta determinística exigiendo autenticación antes de exponer información sensible de pedidos, presupuestos o cuenta.'
        break
      case 'customer.owned_document_request':
        detail =
          'Se devolvió una respuesta determinística para pedir la referencia del documento propio antes de consultar datos sensibles del cliente autenticado.'
        break
      case 'customer.private_account_data':
        detail =
          'Se devolvió una respuesta determinística para proteger datos privados de cuenta fuera de las superficies autorizadas.'
        break
      case 'customer.contact_info':
        detail =
          'Se devolvió una respuesta determinística de contacto cuando todavía no había evidencia suficiente para una respuesta más específica.'
        break
      case 'customer.topic_info':
        detail =
          effectiveFaqSubtype === 'availability'
            ? 'Se devolvió una respuesta determinística sobre disponibilidad o tiempo de entrega sin abrir retrieval ni depender del proveedor.'
            : 'Se devolvió una respuesta determinística para una consulta informativa del cliente.'
        break
      case 'customer.multi_intent':
        detail =
          'Se devolvió una guía determinística para dividir una consulta multi-intención de cliente.'
        break
      case 'customer.repetition':
        detail =
          'Se devolvió una respuesta determinística para una consulta repetida del cliente, evitando repetir exactamente el mismo wording.'
        break
      case 'customer.confirmation':
        detail =
          'Se devolvió una confirmación determinística del cliente sobre un flujo pendiente.'
        break
      case 'customer.cancellation':
        detail =
          'Se devolvió una cancelación determinística del cliente sobre un flujo pendiente.'
        break
      case 'customer.frustration':
        detail =
          'Se devolvió una respuesta determinística empática para una señal de frustración del cliente.'
        break
      case 'customer.sensitive':
        detail =
          'Se devolvió una respuesta determinística de contención y derivación humana para un mensaje sensible de cliente.'
        break
      case 'customer.out_of_scope':
        detail =
          'Se devolvió una respuesta determinística controlada para una consulta fuera de dominio.'
        break
      default:
        detail =
          'Se devolvió una respuesta determinística para saludo o intercambio liviano de cliente.'
        break
    }

    const defaultDeterministicGroundingByIntent =
      effectiveIntentKey === 'customer.quote' || effectiveIntentKey === 'customer.price_inquiry'
        ? buildWorkflowGrounding(text, {
            sourceType: 'quote_workflow',
            scope: 'quote',
            sourceKey:
              interpretation?.quoteContext?.profileKey ||
              compactText(
                interpretation?.quoteContext?.topicLabel ||
                  interpretation?.quoteContext?.familyLabel ||
                  'quote_intake',
              ),
            title:
              interpretation?.quoteContext?.profileLabel ||
              interpretation?.quoteContext?.topicLabel ||
              interpretation?.quoteContext?.familyLabel ||
              'Quote workflow',
          })
        : effectiveIntentKey === 'customer.support_request'
          ? buildWorkflowGrounding(text, {
              sourceType: 'support_workflow',
              scope: 'support',
              sourceKey: compactText(
                interpretation?.supportContext?.productType || 'support_intake',
              ),
              title: interpretation?.supportContext?.productType || 'Support workflow',
            })
          : effectiveIntentKey === 'customer.schedule_request' ||
              effectiveIntentKey === 'customer.confirmation' ||
              effectiveIntentKey === 'customer.cancellation'
            ? buildWorkflowGrounding(text, {
                sourceType: 'schedule_workflow',
                scope: 'schedule',
                sourceKey: String(effectiveIntentKey || 'schedule_request'),
                title: 'Schedule workflow',
              })
            : [
                'customer.auth_required',
                'customer.owned_document_request',
                'customer.private_account_data',
                'customer.sensitive',
                'customer.out_of_scope',
              ].includes(effectiveIntentKey)
              ? buildWorkflowGrounding(text, {
                  sourceType: 'runtime_policy',
                  scope: 'policy',
                  sourceKey: String(effectiveIntentKey || 'policy'),
                  title: 'Runtime policy',
                })
              : effectiveIntentKey === 'customer.multi_intent'
                ? buildWorkflowGrounding(text, {
                    sourceType: 'conversation_workflow',
                    scope: 'conversation',
                    sourceKey: 'multi_intent_priority',
                    title: 'Multi-intent prioritization',
                  })
                : { grounded: false, fallbackReason: null }

    return {
      text,
      toolCalls: [],
      needsHuman: intentKey === 'customer.sensitive',
      grounding: defaultDeterministicGroundingByIntent,
      debug: {
        actionKey: effectiveIntentKey,
        detail,
      },
    }
  }

  async buildProtectedCustomerDataResponse({
    role,
    input,
    inboundClassification = null,
    unifiedMessage,
    backendClient,
  }) {
    if (!(role === 'customer_public' || role === 'customer_authenticated')) {
      return null
    }

    const protectedData =
      inboundClassification &&
      ['auth_required', 'owned_document_request', 'private_account_data'].includes(
        inboundClassification.category,
      )
        ? inboundClassification
        : classifyCustomerProtectedDataRequest({ role, input })

    if (!protectedData?.suggestedIntent) {
      return null
    }

    if (protectedData.suggestedIntent !== 'customer.owned_document_request') {
      return this.buildDeterministicCustomerResponse({
        role,
        input,
        intentKey: protectedData.suggestedIntent,
        inboundClassification: protectedData,
      })
    }

    const customerId = resolveTrustedCustomerId(unifiedMessage)
    if (!customerId) {
      return this.buildDeterministicCustomerResponse({
        role,
        input,
        intentKey: 'customer.auth_required',
        inboundClassification: {
          ...protectedData,
          category: 'auth_required',
          suggestedIntent: 'customer.auth_required',
        },
      })
    }

    if (!protectedData.identifier || !protectedData.documentType) {
      return this.buildDeterministicCustomerResponse({
        role,
        input,
        intentKey: 'customer.owned_document_request',
        inboundClassification: protectedData,
      })
    }

    try {
      const ownedDocument = await backendClient.lookupOwnedCustomerDocument(
        customerId,
        protectedData.identifier,
        protectedData.documentType,
      )

      if (!ownedDocument) {
        const label =
          protectedData.documentType === 'BUDGET' ? 'presupuesto' : 'pedido'
        return {
          text: `No encontré ese ${label} asociado a tu cuenta. Si quieres, revisa la referencia y me la vuelves a indicar.`,
          toolCalls: [],
          needsHuman: false,
          grounding: { grounded: false, fallbackReason: null },
          debug: {
            actionKey: protectedData.suggestedIntent,
            detail:
              'La búsqueda ownership-safe no encontró un documento asociado al customerId autenticado.',
          },
        }
      }

      const formatAmount = (currency, amount) => {
        if (typeof amount !== 'number' || !Number.isFinite(amount) || !currency) {
          return null
        }
        return `${String(currency).toUpperCase()} ${new Intl.NumberFormat('es-UY', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(amount)}`
      }

      const formatDate = (value) => {
        if (!value) return null
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return null
        return new Intl.DateTimeFormat('es-UY', {
          day: 'numeric',
          month: 'numeric',
          year: 'numeric',
        }).format(date)
      }

      const documentLabel =
        ownedDocument.documentType === 'BUDGET' ? 'presupuesto' : 'pedido'
      const lines = [
        `Sí, encontré ${ownedDocument.documentType === 'BUDGET' ? 'el' : 'el'} ${documentLabel} ${ownedDocument.reference} asociado a tu cuenta.`,
      ]

      if (ownedDocument.statusLabel) {
        lines.push(`Estado actual: ${ownedDocument.statusLabel}.`)
      }

      const total = formatAmount(ownedDocument.currency, ownedDocument.grandTotal)
      if (total) {
        lines.push(`Total de referencia: ${total}.`)
      }

      const validUntil = formatDate(ownedDocument.validUntil)
      if (validUntil && ownedDocument.documentType === 'BUDGET') {
        lines.push(`Vigencia: ${validUntil}.`)
      }

      return {
        text: lines.join(' '),
        toolCalls: [],
        needsHuman: false,
        grounding: buildGroundingContract({
          knowledgeRetrieved: false,
          usedFacts: lines,
          sources: buildStructuredGroundingSource({
            sourceType: 'owned_document',
            scope: 'customer_document',
            sourceKey:
              ownedDocument.reference ||
              `${ownedDocument.documentType || 'document'}:${customerId || 'customer'}`,
            title: `${documentLabel} ${ownedDocument.reference || ''}`.trim(),
          }),
        }),
        debug: {
          actionKey: protectedData.suggestedIntent,
          detail:
            'Se devolvió un resumen ownership-safe de un documento del cliente autenticado usando backend validado por customerId.',
        },
      }
    } catch (error) {
      return {
        text:
          'No pude verificar ese dato de cuenta en este momento. Si quieres, revisa la referencia y lo intentamos de nuevo, o seguimos por un asesor.',
        toolCalls: [],
        needsHuman: false,
        grounding: { grounded: false, fallbackReason: 'owned_document_lookup_failed' },
        debug: {
          actionKey: protectedData.suggestedIntent,
          detail:
            error instanceof Error
              ? error.message
              : 'owned_customer_document_lookup_failed',
        },
      }
    }
  }

  buildDeterministicKnowledgeResponse({
    role,
    input,
    intentKey,
    previousIntentKey = null,
    retrievalContext,
    interpretation = null,
    tenantTopicTaxonomy = [],
    tenantRuntimePolicy = null,
    variationSeed = '',
    channel = null,
  }) {
    if (
      !(role === 'customer_public' || role === 'customer_authenticated') ||
      ![
        'customer.topic_info',
        'customer.contact_info',
        'customer.product_info',
        'customer.quote',
      ].includes(intentKey)
    ) {
      return null
    }

    const capabilityMode = this.getCustomerCapabilityMode(intentKey)
    if (capabilityModeBlocksAutomaticResolution(capabilityMode)) {
      return this.buildCustomerCapabilityModeResponse({
        intentKey,
        interpretation,
        variationSeed,
      })
    }

    if (
      shouldPreferCustomerQuoteGuidance({
        input,
        intentKey,
        interpretation,
        tenantTopicTaxonomy,
      })
    ) {
      return null
    }

    if (
      intentKey === 'customer.quote' &&
      !(
        interpretation?.topic &&
        ['product_family', 'product_topic', 'product_variant'].includes(
          String(interpretation.topic.type || ''),
        )
      )
    ) {
      return null
    }

    const retrievalItems = Array.isArray(retrievalContext?.items)
      ? retrievalContext.items.filter((item) => item && typeof item === 'object')
      : []
    if (!retrievalItems.length) {
      return null
    }

    const topScore =
      typeof retrievalItems[0]?.score === 'number' && Number.isFinite(retrievalItems[0].score)
        ? retrievalItems[0].score
        : 0
    if (topScore < 0.45) {
      return null
    }

    const text =
      buildCustomerFaqKnowledgeResponse({
        input,
        retrievalItems,
        intentKey,
        interpretation,
        tenantTopicTaxonomy,
        tenantRuntimePolicy,
        paymentMethods: getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [],
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
        previousIntentKey,
        channel,
        channelProfile: this.getResponseChannelProfile(channel),
      }) ||
      buildGenericCustomerKnowledgeFallbackText(intentKey, retrievalItems, input, {
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
        channel,
        channelProfile: this.getResponseChannelProfile(channel),
      })
    if (!text) {
      return null
    }

    const groundedText = composeQuoteKnowledgeFirstText({
      informationText: text,
      input,
      interpretation,
      tenantTopicTaxonomy,
    })

    return {
      text: groundedText,
      wordingKey: this.resolveCustomerHybridWordingKey({
        intentKey,
        interpretation,
      }),
      toolCalls: [],
      needsHuman: false,
      grounding: buildRetrievalFaqGroundingContract({
        input,
        retrievalItems,
        interpretation,
        tenantRuntimePolicy,
        paymentMethods: getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [],
        text: groundedText,
      }),
      debug: {
        actionKey: intentKey,
        wordingKey: this.resolveCustomerHybridWordingKey({
          intentKey,
          interpretation,
        }),
        detail:
          'Se resolvió una respuesta determinística directamente desde conocimiento aprobado, sin depender del proveedor.',
      },
    }
  }

  shouldAttemptGroundedCustomerRewrite({
    role,
    intentKey,
    input,
    response,
    retrievalContext,
    runtimeConfig,
    interpretation = null,
  }) {
    if (
      !(role === 'customer_public' || role === 'customer_authenticated') ||
      !runtimeConfig?.customerGroundedRewriteEnabled
    ) {
      return false
    }

    const wordingKey = this.resolveCustomerHybridWordingKey({
      intentKey,
      response,
      interpretation,
    })
    const rewriteFaqSubtype = detectCustomerFaqSubtype(input, {
      previousIntentKey:
        typeof interpretation?.followUp?.inheritedIntentKey === 'string'
          ? interpretation.followUp.inheritedIntentKey
          : null,
      tenantRuntimePolicy:
        interpretation?.tenantRuntimePolicy && typeof interpretation.tenantRuntimePolicy === 'object'
          ? interpretation.tenantRuntimePolicy
          : null,
    })
    if (
      /^customer\.multimodal\./.test(String(wordingKey || '')) ||
      wordingKey === 'customer.faq.payment_methods_operational_followup' ||
      wordingKey === 'customer.quote.replacement_followup' ||
      wordingKey === 'customer.reengagement.support_followup'
    ) {
      return false
    }
    if (
      rewriteFaqSubtype === 'payment_methods' &&
      (looksLikeShortContextualFollowUp(input) ||
        looksLikeCustomerFollowUp(input) ||
        looksLikeContextualReference(input) ||
        Boolean(interpretation?.followUp?.detected))
    ) {
      return false
    }
    const rewriteMode = this.resolveCustomerRewriteMode({
      wordingKey,
      input,
      response,
    })

    const capabilityMode = this.getCustomerCapabilityMode(intentKey)
    if (capabilityModeBlocksProviderEnhancements(capabilityMode)) {
      return false
    }

    if (rewriteMode !== 'light_style') {
      if (
        ![
          'customer.topic_info',
          'customer.contact_info',
          'customer.product_info',
          'customer.quote',
        ].includes(intentKey) ||
        response?.needsHuman ||
        response?.grounding?.grounded !== true
      ) {
        return false
      }
    }

    if (
      !String(response?.text || '').trim()
    ) {
      return false
    }

    if (rewriteMode === 'light_style') {
      return true
    }

    if (
      !Array.isArray(retrievalContext?.items) ||
      retrievalContext.items.length === 0
    ) {
      return false
    }

    const maxChars = Number(runtimeConfig.customerGroundedRewriteMaxChars || 220)
    const responseText = String(response.text || '')
    return (
      looksLikeShortContextualFollowUp(input) ||
      looksLikeCustomerFollowUp(input) ||
      looksLikeContextualReference(input) ||
      /:\s/.test(responseText) ||
      responseText.length > maxChars
    )
  }

  async maybeRewriteGroundedCustomerResponse({
    role,
    intentKey,
    input,
    response,
    retrievalContext,
    runtimeConfig,
    interpretation = null,
    channel = null,
  }) {
    if (
      !this.shouldAttemptGroundedCustomerRewrite({
        role,
        intentKey,
        input,
        response,
        retrievalContext,
        runtimeConfig,
        interpretation,
      })
    ) {
      return response
    }

    const wordingKey = this.resolveCustomerHybridWordingKey({
      intentKey,
      response,
      interpretation,
    })
    const rewriteMode = this.resolveCustomerRewriteMode({
      wordingKey,
      input,
      response,
      channel,
    })
    const templateMeta = this.getCustomerWordingTemplateMeta(wordingKey, {
      channel,
    })
    const quota = await this.ensureProviderQuotaAvailable()
    if (!quota.allowed) {
      return response
    }

    const maxChars = Math.max(
      80,
      Math.min(
        400,
        Number(
          templateMeta.maxChars ||
            runtimeConfig.customerGroundedRewriteMaxChars ||
            220,
        ),
      ),
    )
    const retrievalItems = Array.isArray(retrievalContext?.items)
      ? retrievalContext.items
      : []
    const sources = retrievalItems
      .slice(0, 3)
      .map((item, index) => {
        const evidence = String(item?.snippet || item?.summary || item?.title || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 240)
        return `[Fuente ${index + 1}] ${item?.title || 'sin título'} :: ${evidence}`
      })
      .join('\n')

    try {
      const rewritten = await generateResponse({
        provider: this.provider,
        role,
        input: [
          String(input || '').trim(),
          wordingKey ? `Clave semántica segura: ${wordingKey}` : null,
          retrievalItems.length
            ? ['Fuentes aprobadas usadas:', sources].join('\n\n')
            : null,
        ]
          .filter(Boolean)
          .join('\n\n'),
        approvedDraft: String(response?.text || '').trim(),
        approvedFacts: this.buildCustomerApprovedFacts({
          intentKey,
          interpretation,
          response,
          retrievalContext,
        }),
        goal:
          templateMeta.goal ||
          (rewriteMode === 'light_style'
            ? 'Aplicar solo light-style: mejorar fluidez y claridad sin cambiar lane, responseContract, knowledgeNeed, retrieval ni reglas de negocio.'
            : 'Mejorar naturalidad de una respuesta grounded sin perder facts aprobados.'),
        mustAskQuestion: templateMeta.mustAskQuestion === true,
        maxChars,
        draftLabel: 'Borrador grounded',
        providerOptions: this.resolveProviderOptions('rewrite'),
        channel,
        channelProfile: this.getResponseChannelProfile(channel),
      })

      const rewrittenText = String(rewritten?.text || '').replace(/\s+/g, ' ').trim()

      if (!rewrittenText) {
        return response
      }

      return {
        ...response,
        text: rewrittenText,
        finalUserText: rewrittenText,
        rewriteExchange:
          rewritten?.debugContext && typeof rewritten.debugContext === 'object'
            ? {
                request: {
                  mode:
                    rewriteMode === 'light_style' ? 'llm_light_style' : 'llm_rewrite',
                  processedInput: String(input || '').trim() || null,
                  contextBlock: null,
                  taskSummary: null,
                  currentTask: null,
                  approvedDraft:
                    typeof rewritten.debugContext.approvedDraft === 'string'
                      ? rewritten.debugContext.approvedDraft
                      : String(response?.text || '').trim() || null,
                  approvedFacts: Array.isArray(rewritten.debugContext.approvedFacts)
                    ? rewritten.debugContext.approvedFacts
                    : [],
                  systemPrompt:
                    typeof rewritten.debugContext.systemPrompt === 'string'
                      ? rewritten.debugContext.systemPrompt
                      : null,
                  promptInput:
                    typeof rewritten.debugContext.promptInput === 'string'
                      ? rewritten.debugContext.promptInput
                      : null,
                  promptHistory: Array.isArray(rewritten.debugContext.promptHistory)
                    ? rewritten.debugContext.promptHistory
                    : [],
                },
                response: {
                  source: rewritten?.source || 'llm_rewrite',
                  text:
                    typeof rewritten.debugContext.rawResponseText === 'string'
                      ? rewritten.debugContext.rawResponseText
                      : rewrittenText,
                  toolCalls: [],
                },
              }
            : null,
        grounding: {
          ...(response?.grounding || {}),
          rewriteApplied: true,
          rewriteMode,
        },
        wordingKey: wordingKey || response?.wordingKey || null,
        debug: {
          ...(response?.debug || {}),
          wordingKey:
            wordingKey ||
            (typeof response?.debug?.wordingKey === 'string'
              ? response.debug.wordingKey
              : null),
          detail: response?.debug?.detail
            ? `${response.debug.detail} ${
                rewriteMode === 'light_style'
                  ? 'Se aplicó light-style opcional sobre un turno determinístico sin alterar decisiones ni retrieval.'
                  : 'Se aplicó una reescritura grounded opcional para mejorar naturalidad sin cambiar la base factual.'
              }`
            : rewriteMode === 'light_style'
              ? 'Se aplicó light-style opcional sobre un turno determinístico sin alterar decisiones ni retrieval.'
              : 'Se aplicó una reescritura grounded opcional para mejorar naturalidad sin cambiar la base factual.',
        },
      }
    } catch {
      return response
    }
  }

  appendValidationDetail(response, detail) {
    if (!detail) {
      return response
    }

    return {
      ...response,
      debug: {
        ...(response?.debug || {}),
        detail: response?.debug?.detail
          ? `${response.debug.detail} ${detail}`
          : detail,
      },
    }
  }

  normalizeResponseComparableText(value) {
    return normalizeText(String(value || ''))
  }

  responseMentionsCanonicalTopic(responseText, topic) {
    const normalizedResponse = this.normalizeResponseComparableText(responseText)
    const normalizedLabel = this.normalizeResponseComparableText(topic?.label || '')
    if (!normalizedResponse || !normalizedLabel) {
      return false
    }

    if (normalizedResponse.includes(normalizedLabel)) {
      return true
    }

    const topicTokens = Array.isArray(topic?.tokens)
      ? topic.tokens
          .map((token) => this.normalizeResponseComparableText(token))
          .filter((token) => token.length >= 3)
      : normalizedLabel.split(/\s+/).filter((token) => token.length >= 3)

    if (!topicTokens.length) {
      return false
    }

    const matchedCount = topicTokens.filter((token) =>
      normalizedResponse.includes(token),
    ).length

    if (topicTokens.length === 1) {
      return matchedCount === 1
    }

    return matchedCount >= Math.ceil(topicTokens.length / 2)
  }

  buildCanonicalTopicGuardResponse(
    intentKey,
    topic,
    tenantTopicTaxonomy = [],
    variationSeed = '',
    options = {},
  ) {
    const fallbackTopicLabel =
      typeof options?.fallbackTopicLabel === 'string'
        ? options.fallbackTopicLabel
        : null
    const fallbackTopicType =
      typeof options?.fallbackTopicType === 'string'
        ? options.fallbackTopicType
        : 'product_topic'
    const topicType =
      typeof topic?.type === 'string' && topic.type.trim()
        ? topic.type
        : fallbackTopicLabel
          ? fallbackTopicType
          : null
    const label = compactText(topic?.label || fallbackTopicLabel || '')
    if (!label || !/^product_/.test(String(topicType || ''))) {
      return null
    }

    const displayLabel =
      buildContextualProductReference({
        requestedTopicLabel: label,
        topicLabel: label,
        tenantTopicTaxonomy,
      }) || label

    const wordingKey =
      String(topicType || '') === 'product_family'
        ? 'customer.product.options_offer'
        : 'customer.product.info_offer'
    const text = pickWordingVariant({
      key: wordingKey,
      variationSeed,
      overrides: this.getCustomerWordingOverrides(),
      variables: { topic: displayLabel },
      fallback:
        intentKey === 'customer.product_info'
          ? `Sí, contamos con ${displayLabel}. Si quieres, te amplío beneficios, usos y opciones según lo que necesitas.`
          : `Sí, trabajamos con ${displayLabel}. Si quieres, te cuento opciones, líneas y prestaciones según lo que necesitas.`,
    })

    return {
      text,
      wordingKey,
      toolCalls: [],
      needsHuman: false,
      grounding: buildGroundingContract({
        knowledgeRetrieved: false,
        usedFacts: extractGroundingFactsFromText(text, 1),
        sources: buildTenantPolicyGroundingSource({
          sourceKey: `topic:${displayLabel}`,
          title: `Tenant topic · ${displayLabel}`,
        }),
      }),
      debug: {
        actionKey: intentKey,
        wordingKey,
        detail:
          'Se devolvió una respuesta canónica basada en el tópico interpretado para evitar fuga literal de knowledge.',
      },
    }
  }

  detectRawKnowledgeLeak({
    responseText,
    retrievalContext,
    tenantRuntimePolicy = null,
  }) {
    const normalizedResponse = this.normalizeResponseComparableText(responseText)
    if (!normalizedResponse) {
      return false
    }

    const retrievalItems = Array.isArray(retrievalContext?.items)
      ? retrievalContext.items.filter((item) => item && typeof item === 'object').slice(0, 4)
      : []
    if (!retrievalItems.length) {
      return false
    }

    const tenantCatalogTerms = getTenantCatalogTerms(tenantRuntimePolicy)
    const tenantBrandTokens = getTenantBrandTokens(tenantRuntimePolicy)
    const hasTenantCatalogLeakSignal =
      tenantCatalogTerms.length > 0 &&
      ((responseText.match(/,/g) || []).length >= 3) &&
      tenantCatalogTerms.some((term) => normalizedResponse.includes(term))
    const hasTenantBrandLeakSignal = tenantBrandTokens.some((term) =>
      normalizedResponse.includes(term),
    )

    const suspiciousResponse =
      /[|·]/.test(responseText) ||
      /\b(catalogo|catálogo|preguntas frecuentes|menu|inicio)\b/i.test(responseText) ||
      hasTenantBrandLeakSignal ||
      hasTenantCatalogLeakSignal

    if (!suspiciousResponse) {
      return false
    }

    for (const item of retrievalItems) {
      const sources = [
        { kind: 'title', value: item?.title },
        { kind: 'summary', value: item?.summary },
        { kind: 'snippet', value: item?.snippet },
      ]

      for (const source of sources) {
        const normalizedSource = this.normalizeResponseComparableText(source.value)
        if (!normalizedSource || normalizedSource.length < 18) {
          continue
        }

        const looksRawSource =
          source.kind === 'title' ||
          /[|·]/.test(String(source.value || '')) ||
          /\b(catalogo|catálogo|preguntas frecuentes|menu|inicio)\b/i.test(
            String(source.value || ''),
          )

        if (!looksRawSource) {
          continue
        }

        if (
          normalizedResponse === normalizedSource ||
          (normalizedSource.length >= 24 &&
            normalizedResponse.includes(normalizedSource)) ||
          normalizedSource.startsWith(normalizedResponse) ||
          normalizedResponse.startsWith(normalizedSource)
        ) {
          return true
        }
      }
    }

    return false
  }

  resolveTopicGuardFallback({ input, interpretation = null }) {
    const interpretedTopicLabel =
      typeof interpretation?.topic?.label === 'string' && interpretation.topic.label.trim()
        ? interpretation.topic.label.trim()
        : null
    if (interpretedTopicLabel) {
      return {
        label: interpretedTopicLabel,
        type:
          typeof interpretation?.topic?.type === 'string' && interpretation.topic.type.trim()
            ? interpretation.topic.type.trim()
            : 'product_topic',
      }
    }

    const contextualTopicLabel =
      typeof interpretation?.contextTopic?.label === 'string' &&
      interpretation.contextTopic.label.trim()
        ? interpretation.contextTopic.label.trim()
        : null
    if (contextualTopicLabel) {
      return {
        label: contextualTopicLabel,
        type:
          typeof interpretation?.contextTopic?.type === 'string' &&
          interpretation.contextTopic.type.trim()
            ? interpretation.contextTopic.type.trim()
            : 'product_topic',
      }
    }

    const requestedTopicLabel = extractRequestedTopicLabel(input)
    if (!requestedTopicLabel) {
      return null
    }

    return {
      label: requestedTopicLabel,
      type: 'product_topic',
    }
  }

  getLastAgentAuditPayload(snapshot) {
    const turns = Array.isArray(snapshot?.turns) ? snapshot.turns : []
    for (let index = turns.length - 1; index >= 0; index -= 1) {
      const turn = turns[index]
      if (!turn || !['agent', 'assistant'].includes(String(turn.role || ''))) {
        continue
      }

      const auditPayload = turn?.metadata?.auditPayload
      if (auditPayload && typeof auditPayload === 'object') {
        return auditPayload
      }
    }

    return null
  }

  validateFinalConversationResponse({
    role,
    input,
    intentKey,
    response,
    inboundClassification = null,
    retrievalContext = null,
    interpretation = null,
    tenantTopicTaxonomy = [],
    tenantRuntimePolicy = null,
    previousIntentKey = null,
    channel = null,
  }) {
    const validation = {
      applied: false,
      adjusted: false,
      issues: [],
      rawSnippetLeakDetected: false,
      topicMismatchDetected: false,
      emptyTextDetected: false,
      fallbackUsed: false,
    }
    const isCustomerRole =
      role === 'customer_public' || role === 'customer_authenticated'
    let nextResponse =
      response && typeof response === 'object'
        ? { ...response }
        : {
            text: '',
            toolCalls: [],
            needsHuman: false,
            grounding: { grounded: false, fallbackReason: null },
          }

    const buildClarificationFallback = () =>
      isCustomerRole
        ? this.buildDeterministicCustomerResponse({
            role,
            input,
            intentKey: 'customer.clarify_request',
            previousIntentKey,
            inboundClassification:
              inboundClassification && typeof inboundClassification === 'object'
                ? inboundClassification
                : {
                    category: 'clarification_request',
                    confidence: 0.5,
                  },
          })
        : {
            text: this.buildSharedOutcomeText({
              audience: this.getConversationAudience(role),
              outcome: 'low_confidence',
            }),
            toolCalls: [],
            needsHuman: false,
            grounding: {
              grounded: false,
              fallbackReason: 'empty_response',
            },
            debug: {
              detail:
                'Se reemplazó una respuesta vacía por un fallback controlado para no emitir un turno inválido.',
            },
          }

    const currentText = compactText(
      nextResponse?.finalUserText || nextResponse?.text || '',
    )
    if (!currentText) {
      validation.applied = true
      validation.adjusted = true
      validation.emptyTextDetected = true
      validation.issues.push('empty_response')
      nextResponse = this.appendValidationDetail(
        buildClarificationFallback(),
        'Se normalizó una respuesta vacía antes de emitirla.',
      )
    }

    const canValidateKnowledge =
      isCustomerRole &&
      ['customer.topic_info', 'customer.contact_info', 'customer.product_info', 'customer.quote'].includes(
        intentKey,
      ) &&
      Array.isArray(retrievalContext?.items) &&
      retrievalContext.items.length > 0
    const validationFaqSubtype = detectCustomerFaqSubtype(input, {
      previousIntentKey:
        typeof interpretation?.followUp?.inheritedIntentKey === 'string'
          ? interpretation.followUp.inheritedIntentKey
          : previousIntentKey,
      tenantRuntimePolicy:
        interpretation?.tenantRuntimePolicy && typeof interpretation.tenantRuntimePolicy === 'object'
          ? interpretation.tenantRuntimePolicy
          : null,
    })
    const hasProductTopicContext =
      /^product_/.test(String(interpretation?.topic?.type || '')) ||
      /^product_/.test(String(interpretation?.contextTopic?.type || ''))
    const isProductFollowUpThread =
      Boolean(interpretation?.followUp?.detected) &&
      (hasProductTopicContext ||
        Boolean(
          interpretation?.topic?.label ||
            interpretation?.contextTopic?.label ||
            interpretation?.quoteContext?.topicLabel,
        ))
    const stableText = compactText(nextResponse?.finalUserText || nextResponse?.text || '')
    const responseContainsDirectPrice =
      /\b(?:usd|uyu|us\$|\$)\s*\d+(?:[.,]\d+)?\b/i.test(stableText) ||
      /\b\d+(?:[.,]\d+)?\s*(?:usd|uyu|us\$)\b/i.test(stableText)
    const topicGuardFallback = this.resolveTopicGuardFallback({
      input,
      interpretation,
    })
    const buildGroundedKnowledgeReplacement = () => {
      const candidates = [
        this.buildDeterministicKnowledgeResponse({
          role,
          input,
          intentKey,
          previousIntentKey,
          retrievalContext,
          interpretation,
          tenantTopicTaxonomy,
          tenantRuntimePolicy,
          channel,
        }),
        this.buildCustomerKnowledgeFallbackResponse({
          role,
          intentKey,
          input,
          retrievalContext,
          fallbackReason: null,
          interpretation,
          tenantTopicTaxonomy,
          tenantRuntimePolicy,
          previousIntentKey,
          channel,
        }),
        this.buildCanonicalTopicGuardResponse(
          intentKey,
          interpretation?.topic,
          tenantTopicTaxonomy,
          '',
          {
            fallbackTopicLabel: topicGuardFallback?.label || null,
            fallbackTopicType: topicGuardFallback?.type || 'product_topic',
          },
        ),
        intentKey === 'customer.quote'
          ? this.buildDeterministicCustomerResponse({
              role,
              input,
              intentKey,
              previousIntentKey,
              inboundClassification,
              interpretation,
              tenantTopicTaxonomy,
              unifiedMessage: channel ? { channel } : null,
            })
          : null,
      ].filter(Boolean)

      return (
        candidates.find((entry) => entry?.grounding?.grounded === true) ||
        candidates[0] ||
        null
      )
    }

    const shouldReplaceGenericClarificationWithTopicGuard =
      isCustomerRole &&
      ['customer.topic_info', 'customer.product_info'].includes(intentKey) &&
      topicGuardFallback?.label &&
      /sobre qu[eé]\s+te gustar[ií]a informaci[oó]n/i.test(stableText)

    if (shouldReplaceGenericClarificationWithTopicGuard) {
      validation.applied = true
      validation.adjusted = true
      validation.issues.push('generic_clarification_with_clear_topic')
      const canonicalTopicGuardResponse = this.buildCanonicalTopicGuardResponse(
        intentKey,
        interpretation?.topic,
        tenantTopicTaxonomy,
        '',
        {
          fallbackTopicLabel: topicGuardFallback.label,
          fallbackTopicType: topicGuardFallback.type || 'product_topic',
        },
      )
      if (canonicalTopicGuardResponse) {
        nextResponse = this.appendValidationDetail(
          canonicalTopicGuardResponse,
          'Se reemplazó una aclaración genérica por una respuesta canónica del tópico ya detectado.',
        )
      }
    }

    if (canValidateKnowledge) {
      const rawSnippetLeakDetected = this.detectRawKnowledgeLeak({
        responseText: stableText,
        retrievalContext,
        tenantRuntimePolicy,
      })
      if (rawSnippetLeakDetected) {
        validation.applied = true
        validation.rawSnippetLeakDetected = true
        validation.issues.push('raw_knowledge_leak')
        const deterministicKnowledgeResponse = buildGroundedKnowledgeReplacement()
        if (deterministicKnowledgeResponse) {
          validation.adjusted = true
          nextResponse = this.appendValidationDetail(
            deterministicKnowledgeResponse,
            'Se reemplazó una respuesta demasiado cruda por una formulación determinística basada en conocimiento aprobado.',
          )
        }
      }

      const shouldValidateTopicConsistency =
        interpretation?.followUp?.detected &&
        /^product_/.test(String(interpretation?.topic?.type || ''))

      if (
        shouldValidateTopicConsistency &&
        !this.responseMentionsCanonicalTopic(
          compactText(nextResponse?.finalUserText || nextResponse?.text || ''),
          interpretation?.topic,
        )
      ) {
        validation.applied = true
        validation.topicMismatchDetected = true
        validation.issues.push('follow_up_topic_mismatch')
        const deterministicKnowledgeResponse = buildGroundedKnowledgeReplacement()
        if (deterministicKnowledgeResponse) {
          validation.adjusted = true
          nextResponse = this.appendValidationDetail(
            deterministicKnowledgeResponse,
            `Se rearmó la respuesta para mantener continuidad con el tópico "${interpretation?.topic?.label || 'actual'}".`,
          )
        }
      }

      const shouldReplaceUngroundedKnowledgeResponse =
        nextResponse?.grounding?.grounded !== true &&
        !responseContainsDirectPrice &&
        !responseActivatesFallback(nextResponse) &&
        !rawSnippetLeakDetected &&
        !validation.topicMismatchDetected &&
        !(
          isProductFollowUpThread &&
          intentKey === 'customer.topic_info' &&
          validationFaqSubtype === 'general' &&
          hasProductTopicContext
        )

      if (shouldReplaceUngroundedKnowledgeResponse) {
        const deterministicKnowledgeResponse = buildGroundedKnowledgeReplacement()
        if (deterministicKnowledgeResponse?.grounding?.grounded === true) {
          validation.applied = true
          validation.adjusted = true
          validation.issues.push('retrieval_without_grounded_response')
          nextResponse = this.appendValidationDetail(
            deterministicKnowledgeResponse,
            'Se reemplazó una respuesta sin grounding efectivo por una formulación determinística basada en el retrieval aprobado.',
          )
        }
      }
    }

    validation.fallbackUsed = responseActivatesFallback(nextResponse)
    return {
      response: nextResponse,
      validation,
    }
  }

  buildConversationalMetrics({
    role,
    interpretation = null,
    inboundClassification = null,
    previousSnapshot = null,
    response,
    validation = null,
    providerGenerationAttempted = false,
    unifiedMessage = null,
    providerCallTrace = null,
    aiExchange = null,
    decisionSource = null,
    retrievalContext = null,
  }) {
    const previousAuditPayload = this.getLastAgentAuditPayload(previousSnapshot)
    const previousAgentTurn = Array.isArray(previousSnapshot?.turns)
      ? [...previousSnapshot.turns]
          .reverse()
          .find((entry) => entry?.role === 'agent' && typeof entry?.text === 'string')
      : null
    const clarificationCategories = new Set([
      'generic_help_request',
      'clarification_request',
      'incomplete',
      'noise',
      'unintelligible',
      'multi_intent',
    ])
    const clarificationIntents = new Set([
      'customer.clarify_request',
      'customer.rephrase_request',
      'customer.incomplete',
      'customer.unintelligible',
      'customer.multi_intent',
    ])
    const previousClarificationRequested =
      Boolean(previousAuditPayload?.metrics?.clarificationRequested) ||
      clarificationIntents.has(String(previousAuditPayload?.intentKey || ''))
    const currentCategory = String(inboundClassification?.category || '')
    const currentResponseIntent =
      String(response?.debug?.actionKey || interpretation?.intent?.key || '')
    const clarificationRequested =
      clarificationCategories.has(currentCategory) ||
      clarificationIntents.has(currentResponseIntent)
    const followUpDetected = Boolean(interpretation?.followUp?.detected)
    const waitForMore =
      readInterpretationResolutionReadiness(interpretation)?.waitForMore === true
    const isCustomerRole =
      role === 'customer_public' || role === 'customer_authenticated'
    const naturality = scoreNaturality({
      responseText: response?.finalUserText || response?.text || '',
      previousAgentText: previousAgentTurn?.text || '',
      currentTurnText: interpretation?.currentTurnText || '',
      followUpDetected,
      clarificationRequested,
      previousClarificationRequested,
    })
    const knowledgeGrounded =
      typeof response?.grounding?.knowledgeGrounded === 'boolean'
        ? response.grounding.knowledgeGrounded
        : response?.grounding?.grounded === true
    const knowledgeRetrieved =
      typeof response?.grounding?.knowledgeRetrieved === 'boolean'
        ? response.grounding.knowledgeRetrieved
        : Array.isArray(retrievalContext?.items)
          ? retrievalContext.items.length > 0
          : Array.isArray(response?.grounding?.sources)
            ? response.grounding.sources.length > 0
            : false
    const knowledgeUsed =
      typeof response?.grounding?.knowledgeUsed === 'boolean'
        ? response.grounding.knowledgeUsed
        : response?.grounding?.used === true
          ? true
          : knowledgeGrounded
    const semanticTurnId =
      typeof unifiedMessage?.metadata?.semanticTurnId === 'string'
        ? unifiedMessage.metadata.semanticTurnId
        : null
    const effectiveAnswerMode = resolveEffectiveCustomerAnswerMode({
      input: interpretation?.currentTurnText || '',
      interpretation,
      response,
    })
    const responseContract =
      typeof retrievalContext?.responseContract === 'string'
        ? retrievalContext.responseContract
        : null
    const knowledgeNeed =
      typeof retrievalContext?.knowledgeNeed === 'string'
        ? retrievalContext.knowledgeNeed
        : null
    const providerCallCount =
      typeof providerCallTrace?.count === 'number' ? providerCallTrace.count : 0
    const rewriteMode =
      typeof response?.grounding?.rewriteMode === 'string'
        ? response.grounding.rewriteMode
        : null
    const rewriteRequestMode =
      typeof response?.rewriteExchange?.request?.mode === 'string'
        ? response.rewriteExchange.request.mode
        : null
    const aiRequestMode =
      typeof aiExchange?.request?.mode === 'string' ? aiExchange.request.mode : null
    const aiCallMode =
      providerCallCount <= 0
        ? 'none'
        : rewriteMode === 'light_style' || rewriteRequestMode === 'llm_light_style'
          ? 'light_style'
          : aiRequestMode === 'llm_conversational' ||
              aiRequestMode === 'provider_generate' ||
              rewriteRequestMode === 'llm_rewrite'
            ? 'controlled_generation'
            : 'controlled_generation'
    const aiModeExclusiveSatisfied =
      providerCallCount <= 1 &&
      !(
        Boolean(aiExchange && typeof aiExchange === 'object') &&
        response?.grounding?.rewriteApplied === true
      )

    return {
      semanticTurnId,
      providerCallCount,
      aiCallMode,
      singleAiCallSatisfied: providerCallCount <= 1,
      aiModeExclusiveSatisfied,
      waitForMore,
      followUpDetected,
      followUpFallback: followUpDetected && responseActivatesFallback(response),
      followUpResolvedWithoutProvider:
        followUpDetected &&
        !providerGenerationAttempted &&
        response?.grounding?.rewriteApplied !== true &&
        !responseActivatesFallback(response),
      knowledgeRetrieved,
      knowledgeUsed,
      knowledgeGrounded,
      responseContract,
      knowledgeNeed,
      retrievalSkippedByKnowledgeNeed:
        retrievalContext?.disabledReason === 'not_needed_for_turn' || knowledgeNeed === 'none',
      responseContractResolvedBeforeRetrieval:
        Boolean(responseContract) && Boolean(knowledgeNeed),
      decisionSource,
      effectiveAnswerMode,
      naturalityScore: naturality.score,
      naturalityPenalties: naturality.penalties,
      naturalityAddsNewInformation: naturality.addsNewInformation,
      intentInherited: Boolean(interpretation?.intent?.inherited),
      rawSnippetLeakDetected: Boolean(validation?.rawSnippetLeakDetected),
      groundedRewriteApplied: Boolean(response?.grounding?.rewriteApplied),
      lightStyleApplied:
        response?.grounding?.rewriteApplied === true &&
        response?.grounding?.rewriteMode === 'light_style',
      clarificationRequested,
      clarificationResolved:
        isCustomerRole &&
        previousClarificationRequested &&
        !clarificationRequested &&
        !responseActivatesFallback(response),
    }
  }

  buildDeterministicAdminResponse({ role, input, intentKey }) {
    if (!isAdminConversationalRole(role)) {
      return null
    }

    if (intentKey === 'admin.light') {
      return {
        text: this.buildSharedLightConversationText({
          audience: 'admin',
          kind: resolveLightConversationKind(input),
          input,
        }),
        toolCalls: [],
        needsHuman: false,
        grounding: {
          grounded: false,
          fallbackReason: null,
        },
        debug: {
          actionKey: 'admin.light',
          detail:
            'Se devolvió una respuesta determinística para saludo o intercambio liviano del asistente interno.',
        },
      }
    }

    if (intentKey !== 'admin.capabilities') {
      return null
    }

    return {
      text: this.buildAdminCapabilitiesMessage(role),
      toolCalls: [],
      needsHuman: false,
      grounding: {
        grounded: false,
        fallbackReason: null,
      },
      debug: {
        actionKey: 'admin.capabilities',
        detail:
          'Se devolvió una respuesta determinística con el alcance operativo del asistente interno para el rol conversacional actual.',
      },
    }
  }

  buildAdminCapabilitiesMessage(role) {
    switch (role) {
      case 'admin_support':
        return 'Puedo ayudarte a buscar clientes, pedidos, presupuestos y pagos, y también a agendar, editar o cancelar actividades. Si me das la gestión puntual, te preparo el siguiente paso.'
      case 'admin_sales':
        return 'Puedo ayudarte con clientes, presupuestos y cotizaciones estructuradas de catálogo. También puedo dejar listos envíos, confirmaciones y cambios de estado de presupuestos con validación previa.'
      case 'admin_operations':
        return 'Puedo ayudarte con productos, categorías, pedidos, pagos y altas estructuradas de catálogo. Si la acción modifica datos, primero te muestro un borrador y luego ejecuto con tu confirmación.'
      case 'admin_supervisor':
        return 'Puedo ayudarte a revisar y coordinar operaciones internas de ventas, soporte y ejecución. Si la acción cambia datos, te muestro el borrador y dejo trazabilidad antes de ejecutar.'
      case 'superadmin':
        return 'Puedo ayudarte con soporte operativo interno, revisión transversal y preparación de acciones del sistema. Si me indicas la gestión, te digo qué puedo resolver directamente y qué requiere confirmación.'
      default:
        return 'Estoy para apoyo operativo interno. Puedo ayudarte a revisar contexto, detectar la intención y preparar acciones del sistema con validación y confirmación cuando corresponda.'
    }
  }

  buildSharedLightConversationText({ audience, kind, input = '' }) {
    return renderLightConversationText({
      audience,
      kind,
      input,
      config: {
        customerGreetingDefault: this.activeConfig?.customerGreetingDefault,
        customerGreetingMorning: this.activeConfig?.customerGreetingMorning,
        customerGreetingAfternoon: this.activeConfig?.customerGreetingAfternoon,
        customerGreetingConsultation:
          this.activeConfig?.customerGreetingConsultation,
        customerGreetingHelp: this.activeConfig?.customerGreetingHelp,
        adminGreetingDefault: this.activeConfig?.adminGreetingDefault,
      },
    })
  }

  getConversationAudience(role) {
    return isAdminConversationalRole(role) ? 'admin' : 'customer'
  }

  buildSharedOutcomeText({ audience, outcome, variant = null }) {
    return renderOutcomeText({ audience, outcome, variant })
  }

  extractAppointmentDraft(input) {
    const title =
      extractNamedEntity(input, [
        /\btitulad[ao]\s+(.+?)(?=\s+para\s+(?:el\s+)?\d{1,2}\/\d{1,2}\/\d{4}\s+a\s+las\s+\d{1,2}:\d{2}|\s+en\s+|$)/iu,
        /\bcita\s+(.+?)(?=\s+para\s+(?:el\s+)?\d{1,2}\/\d{1,2}\/\d{4}\s+a\s+las\s+\d{1,2}:\d{2}|\s+en\s+|$)/iu,
      ]) || null

    const scheduleMatch = String(input || '').match(
      /\b(?:para\s+el|el)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+a\s+las\s+(\d{1,2}:\d{2})/iu,
    )
    const startLabel = scheduleMatch
      ? `${scheduleMatch[1]} ${scheduleMatch[2]}`
      : null

    const location =
      extractNamedEntity(input, [/\ben\s+([a-záéíóúñ0-9 .,'/-]+)$/iu]) || null

    const startAt = scheduleMatch
      ? this.parseAppointmentDateToIso(scheduleMatch[1], scheduleMatch[2])
      : null

    return {
      title,
      startLabel,
      startAt,
      location,
    }
  }

  parseAppointmentDateToIso(datePart, timePart) {
    const match = String(datePart || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (!match) {
      return null
    }
    const [, day, month, year] = match
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart}:00.000Z`
  }

  appendAdminDebugSummary(response, context) {
    const finalUserText =
      typeof response?.finalUserText === 'string'
        ? response.finalUserText
        : typeof response?.text === 'string'
          ? response.text
          : ''
    const existingDebugSummary =
      typeof response?.debugSummary === 'string' && response.debugSummary.trim()
        ? response.debugSummary.trim()
        : null
    const effectiveContext = {
      ...context,
      actionKey: context?.actionKey || response?.debug?.actionKey || null,
      detail: context?.detail || response?.debug?.detail || null,
    }
    const auditPayload = this.buildOutcomeAuditPayload(response, effectiveContext)

    if (
      !isDebugModeEnabled() ||
      !(context?.role?.startsWith('admin_') || context?.role === 'superadmin') ||
      !response ||
      !finalUserText
    ) {
      return {
        ...response,
        finalUserText,
        debugSummary: existingDebugSummary,
        auditPayload,
        text: finalUserText,
      }
    }

    const nextDebugSummary = this.buildAdminDebugSummary(effectiveContext)
    const debugSummary = [existingDebugSummary, nextDebugSummary]
      .filter(Boolean)
      .join('\n\n')

    return {
      ...response,
      finalUserText,
      debugSummary,
      auditPayload,
      text: debugSummary ? `${finalUserText}\n\n${debugSummary}` : finalUserText,
    }
  }

  buildAdminDebugSummary(context) {
    const toolLines = Array.isArray(context.toolCalls)
      ? dedupeToolCalls(context.toolCalls).map((entry) => {
          const target =
            entry?.arguments?.query ??
            entry?.arguments?.text ??
            entry?.arguments?.id ??
            null
          return `${entry?.name || 'tool'}:${entry?.status || 'unknown'}${target ? `(${String(target).slice(0, 120)})` : ''}`
        })
      : []

    const debugLines = [
      '[debug]',
      `etapa=${context.stage || 'unknown'}`,
      `intent=${context.intentKey || 'n/a'}`,
      `intent_source=${context.intentSource || 'n/a'}`,
      `intent_confidence=${
        typeof context.intentConfidence === 'number'
          ? context.intentConfidence.toFixed(2)
          : 'n/a'
      }`,
      `accion=${context.actionKey || 'n/a'}`,
      `input=${String(context.input || '').slice(0, 240)}`,
    ]

    if (Array.isArray(context.blockedTools) && context.blockedTools.length) {
      debugLines.push(`tools_bloqueadas=${context.blockedTools.join(',')}`)
    }
    if (toolLines.length) {
      debugLines.push(`tools=${toolLines.join(' | ')}`)
    }
    if (Array.isArray(context.referencedMessages) && context.referencedMessages.length) {
      debugLines.push(
        `referencias=${context.referencedMessages
          .map(
            (item) =>
              item?.messageId ||
              item?.createdAt ||
              String(item?.preview || '').slice(0, 40) ||
              'mensaje_reciente',
          )
          .join(' | ')}`,
      )
    }
    if (Array.isArray(context.messageElementsUsed) && context.messageElementsUsed.length) {
      debugLines.push(`elementos=${context.messageElementsUsed.join(',')}`)
    }
    if (Array.isArray(context.messageContextOrigin) && context.messageContextOrigin.length) {
      debugLines.push(`origen=${context.messageContextOrigin.join(',')}`)
    }
    if (typeof context.knowledgeMode === 'string') {
      debugLines.push(`knowledge_mode=${context.knowledgeMode}`)
    }
    if (typeof context.knowledgeModeReason === 'string') {
      debugLines.push(`knowledge_mode_reason=${context.knowledgeModeReason}`)
    }
    if (typeof context.retrievalMode === 'string') {
      debugLines.push(`retrieval_mode=${context.retrievalMode}`)
    }
    if (
      context.embeddingMode &&
      typeof context.embeddingMode === 'object' &&
      typeof context.embeddingMode.mode === 'string'
    ) {
      debugLines.push(
        `embedding_mode=${context.embeddingMode.mode}:${context.embeddingMode.provider || 'unknown'}`,
      )
    }
    if (
      context.queryEmbedding &&
      typeof context.queryEmbedding === 'object' &&
      typeof context.queryEmbedding.latencyMs === 'number'
    ) {
      debugLines.push(
        `embedding_latency_ms=${context.queryEmbedding.latencyMs}`,
      )
    }
    if (context.detail) {
      debugLines.push(`detalle=${context.detail}`)
    }

    return debugLines.join('\n')
  }

  buildOutcomeAuditPayload(response, context) {
    const previousAuditPayload =
      response?.auditPayload && typeof response.auditPayload === 'object'
        ? response.auditPayload
        : null
    const currentStage = context?.stage || 'unknown'
    const previousStage =
      typeof previousAuditPayload?.stage === 'string' && previousAuditPayload.stage
        ? previousAuditPayload.stage
        : null
    const stageHistory = Array.from(
      new Set(
        [
          ...(Array.isArray(previousAuditPayload?.stageHistory)
            ? previousAuditPayload.stageHistory
            : []),
          previousStage,
          currentStage,
        ].filter(Boolean),
      ),
    )
    const fallbackReason =
      typeof response?.grounding?.fallbackReason === 'string'
        ? response.grounding.fallbackReason
        : typeof previousAuditPayload?.fallbackReason === 'string'
          ? previousAuditPayload.fallbackReason
          : null
    const fallbackSubtype =
      typeof response?.grounding?.fallbackSubtype === 'string'
        ? response.grounding.fallbackSubtype
        : typeof previousAuditPayload?.fallbackSubtype === 'string'
          ? previousAuditPayload.fallbackSubtype
          : null
    const blockedTools = Array.from(
      new Set([
        ...(Array.isArray(previousAuditPayload?.blockedTools)
          ? previousAuditPayload.blockedTools
          : []),
        ...(Array.isArray(context?.blockedTools) ? context.blockedTools : []),
      ]),
    )
    const toolCalls = dedupeToolCalls([
      ...(Array.isArray(previousAuditPayload?.toolCalls)
        ? previousAuditPayload.toolCalls
        : []),
      ...(Array.isArray(context?.toolCalls)
        ? context.toolCalls.map((entry) => ({
            name: entry?.name || null,
            status: entry?.status || null,
            target:
              entry?.arguments?.query ??
              entry?.arguments?.text ??
              entry?.arguments?.id ??
              null,
          }))
        : []),
    ])
    const referencedMessages = [
      ...(Array.isArray(previousAuditPayload?.referencedMessages)
        ? previousAuditPayload.referencedMessages
        : []),
      ...(Array.isArray(context?.referencedMessages)
        ? context.referencedMessages.map((entry) => ({
            messageId: entry?.messageId || null,
            createdAt: entry?.createdAt || null,
            preview: String(entry?.preview || '').slice(0, 140) || null,
          }))
        : []),
    ]
    const orchestratorDecision = sanitizeOrchestratorDecisionForAudit(
      context?.orchestratorDecision ?? previousAuditPayload?.orchestratorDecision,
    )
    const responseMode = inferResponseModeForAudit({
      response,
      context,
      previousAuditPayload,
    })
    const decisionTrace = buildDecisionTraceForAudit({
      response,
      context,
      previousAuditPayload,
      toolCalls,
      fallbackReason,
    })

    return {
      stage: fallbackReason && previousStage ? previousStage : currentStage,
      stageHistory,
      role: context?.role || previousAuditPayload?.role || null,
      intentKey: context?.intentKey || previousAuditPayload?.intentKey || null,
      intentConfidence:
        typeof context?.intentConfidence === 'number'
          ? context.intentConfidence
          : typeof previousAuditPayload?.intentConfidence === 'number'
            ? previousAuditPayload.intentConfidence
            : null,
      intentSource:
        context?.intentSource || previousAuditPayload?.intentSource || null,
      matchedKeywords: Array.from(
        new Set([
          ...(Array.isArray(previousAuditPayload?.matchedKeywords)
            ? previousAuditPayload.matchedKeywords
            : []),
          ...(Array.isArray(context?.matchedKeywords) ? context.matchedKeywords : []),
        ]),
      ),
      actionKey: context?.actionKey || previousAuditPayload?.actionKey || null,
      input:
        String(context?.input || '').slice(0, 240) ||
        previousAuditPayload?.input ||
        null,
      aiExchange:
        sanitizeAiExchangeForAudit(context?.aiExchange) ??
        previousAuditPayload?.aiExchange ??
        null,
      rewriteExchange:
        sanitizeAiExchangeForAudit(response?.rewriteExchange) ??
        previousAuditPayload?.rewriteExchange ??
        null,
      blockedTools,
      toolCalls,
      referencedMessages,
      decisionPath: Array.from(
        new Set([
          ...(Array.isArray(previousAuditPayload?.decisionPath)
            ? previousAuditPayload.decisionPath
            : []),
          ...(Array.isArray(context?.decisionPath) ? context.decisionPath : []),
        ]),
      ),
      messageElementsUsed: Array.from(
        new Set([
          ...(Array.isArray(previousAuditPayload?.messageElementsUsed)
            ? previousAuditPayload.messageElementsUsed
            : []),
          ...(Array.isArray(context?.messageElementsUsed)
            ? context.messageElementsUsed
            : []),
        ]),
      ),
      messageElements: Array.from(
        new Map(
          [
            ...(Array.isArray(previousAuditPayload?.messageElements)
              ? previousAuditPayload.messageElements
              : []),
            ...(Array.isArray(context?.messageElements) ? context.messageElements : []),
          ]
            .map((entry) => (entry && typeof entry === 'object' ? entry : null))
            .filter(Boolean)
            .map((entry) => [
              `${entry.kind || 'unknown'}:${entry.label || ''}:${entry.preview || ''}`,
              {
                kind: typeof entry.kind === 'string' ? entry.kind : null,
                source: typeof entry.source === 'string' ? entry.source : null,
                label: typeof entry.label === 'string' ? entry.label : null,
                preview: typeof entry.preview === 'string' ? entry.preview : null,
              },
            ]),
        ).values(),
      ),
      messageContextOrigin: Array.from(
        new Set([
          ...(Array.isArray(previousAuditPayload?.messageContextOrigin)
            ? previousAuditPayload.messageContextOrigin
            : []),
          ...(Array.isArray(context?.messageContextOrigin)
            ? context.messageContextOrigin
            : []),
        ]),
      ),
      detail: context?.detail || previousAuditPayload?.detail || null,
      needsHuman:
        typeof response?.needsHuman === 'boolean' ? response.needsHuman : null,
      grounded:
        typeof response?.grounding?.grounded === 'boolean'
          ? response.grounding.grounded
          : null,
      providerCallCount:
        typeof context?.metrics?.providerCallCount === 'number'
          ? context.metrics.providerCallCount
          : typeof previousAuditPayload?.providerCallCount === 'number'
            ? previousAuditPayload.providerCallCount
            : typeof decisionTrace?.provider?.callCount === 'number'
              ? decisionTrace.provider.callCount
              : 0,
      aiCallMode:
        typeof context?.metrics?.aiCallMode === 'string'
          ? context.metrics.aiCallMode
          : typeof previousAuditPayload?.aiCallMode === 'string'
            ? previousAuditPayload.aiCallMode
            : null,
      knowledgeRetrieved:
        typeof context?.metrics?.knowledgeRetrieved === 'boolean'
          ? context.metrics.knowledgeRetrieved
          : Boolean(previousAuditPayload?.knowledgeRetrieved),
      knowledgeUsed:
        typeof context?.metrics?.knowledgeUsed === 'boolean'
          ? context.metrics.knowledgeUsed
          : Boolean(previousAuditPayload?.knowledgeUsed),
      knowledgeGrounded:
        typeof context?.metrics?.knowledgeGrounded === 'boolean'
          ? context.metrics.knowledgeGrounded
          : Boolean(previousAuditPayload?.knowledgeGrounded),
      decisionSource:
        typeof context?.metrics?.decisionSource === 'string'
          ? context.metrics.decisionSource
          : typeof previousAuditPayload?.decisionSource === 'string'
            ? previousAuditPayload.decisionSource
            : typeof decisionTrace?.conversation?.decisionSource === 'string'
              ? decisionTrace.conversation.decisionSource
              : null,
      effectiveAnswerMode:
        typeof context?.metrics?.effectiveAnswerMode === 'string'
          ? context.metrics.effectiveAnswerMode
          : typeof previousAuditPayload?.effectiveAnswerMode === 'string'
            ? previousAuditPayload.effectiveAnswerMode
            : null,
      naturalityScore:
        typeof context?.metrics?.naturalityScore === 'number'
          ? context.metrics.naturalityScore
          : typeof previousAuditPayload?.naturalityScore === 'number'
            ? previousAuditPayload.naturalityScore
            : null,
      semanticTurnId:
        typeof context?.semanticTurnId === 'string'
          ? context.semanticTurnId
          : typeof previousAuditPayload?.semanticTurnId === 'string'
            ? previousAuditPayload.semanticTurnId
            : null,
      turnInterpretation:
        context?.turnInterpretation && typeof context.turnInterpretation === 'object'
          ? {
              category:
                typeof context.turnInterpretation.category === 'string'
                  ? context.turnInterpretation.category
                  : null,
              currentTurnText: String(
                context.turnInterpretation.currentTurnText || '',
              ).slice(0, 240),
              intent:
                context.turnInterpretation.intent &&
                typeof context.turnInterpretation.intent === 'object'
                  ? {
                      key:
                        typeof context.turnInterpretation.intent.key === 'string'
                          ? context.turnInterpretation.intent.key
                          : null,
                      confidence:
                        typeof context.turnInterpretation.intent.confidence === 'number'
                          ? context.turnInterpretation.intent.confidence
                          : null,
                      source:
                        typeof context.turnInterpretation.intent.source === 'string'
                          ? context.turnInterpretation.intent.source
                          : null,
                      inherited: Boolean(
                        context.turnInterpretation.intent.inherited,
                      ),
                    }
                  : null,
              followUp:
                context.turnInterpretation.followUp &&
                typeof context.turnInterpretation.followUp === 'object'
                  ? {
                      detected: Boolean(
                        context.turnInterpretation.followUp.detected,
                      ),
                      inheritedIntentKey:
                        typeof context.turnInterpretation.followUp
                          .inheritedIntentKey === 'string'
                          ? context.turnInterpretation.followUp.inheritedIntentKey
                          : null,
                      confidence:
                        typeof context.turnInterpretation.followUp.confidence === 'number'
                          ? context.turnInterpretation.followUp.confidence
                          : null,
                      source:
                        typeof context.turnInterpretation.followUp.source === 'string'
                          ? context.turnInterpretation.followUp.source
                          : null,
                      quantityOnly: Boolean(
                        context.turnInterpretation.followUp.quantityOnly,
                      ),
                      measurementOnly: Boolean(
                        context.turnInterpretation.followUp.measurementOnly,
                      ),
                      quoteWaiting: Boolean(
                        context.turnInterpretation.followUp.quoteWaiting,
                      ),
                    }
                  : null,
              topic:
                context.turnInterpretation.topic &&
                typeof context.turnInterpretation.topic === 'object'
                  ? {
                      label:
                        typeof context.turnInterpretation.topic.label === 'string'
                          ? context.turnInterpretation.topic.label
                          : null,
                      type:
                        typeof context.turnInterpretation.topic.type === 'string'
                          ? context.turnInterpretation.topic.type
                          : null,
                      confidence:
                        typeof context.turnInterpretation.topic.confidence === 'number'
                          ? context.turnInterpretation.topic.confidence
                          : null,
                      source:
                        typeof context.turnInterpretation.topic.source === 'string'
                          ? context.turnInterpretation.topic.source
                          : null,
                    }
                  : null,
              retrievalQuery: String(
                context.turnInterpretation.retrievalQuery || '',
              ).slice(0, 240),
              operationalQuery: String(
                context.turnInterpretation.operationalQuery || '',
              ).slice(0, 240),
              threadResolution: sanitizeThreadResolutionForAudit(
                context.turnInterpretation.threadResolution,
              ),
              quoteContext: sanitizeQuoteContextForAudit(
                context.turnInterpretation.quoteContext,
              ),
              supportContext: sanitizeSupportContextForAudit(
                context.turnInterpretation.supportContext,
              ),
              scheduleContext: sanitizeScheduleContextForAudit(
                context.turnInterpretation.scheduleContext,
              ),
              conversationContext: sanitizeConversationContextForAudit(
                context.turnInterpretation.conversationContext,
              ),
            }
          : previousAuditPayload?.turnInterpretation ?? null,
      responseValidation:
        context?.responseValidation && typeof context.responseValidation === 'object'
          ? {
              applied: Boolean(context.responseValidation.applied),
              adjusted: Boolean(context.responseValidation.adjusted),
              issues: Array.isArray(context.responseValidation.issues)
                ? context.responseValidation.issues
                : [],
              rawSnippetLeakDetected: Boolean(
                context.responseValidation.rawSnippetLeakDetected,
              ),
              topicMismatchDetected: Boolean(
                context.responseValidation.topicMismatchDetected,
              ),
              emptyTextDetected: Boolean(
                context.responseValidation.emptyTextDetected,
              ),
              fallbackUsed: Boolean(context.responseValidation.fallbackUsed),
            }
          : previousAuditPayload?.responseValidation ?? null,
      metrics:
        context?.metrics && typeof context.metrics === 'object'
          ? {
              semanticTurnId:
                typeof context.metrics.semanticTurnId === 'string'
                  ? context.metrics.semanticTurnId
                  : null,
              providerCallCount:
                typeof context.metrics.providerCallCount === 'number'
                  ? context.metrics.providerCallCount
                  : 0,
              aiCallMode:
                typeof context.metrics.aiCallMode === 'string'
                  ? context.metrics.aiCallMode
                  : null,
              singleAiCallSatisfied: Boolean(
                context.metrics.singleAiCallSatisfied,
              ),
              aiModeExclusiveSatisfied: Boolean(
                context.metrics.aiModeExclusiveSatisfied,
              ),
              waitForMore: Boolean(context.metrics.waitForMore),
              knowledgeRetrieved: Boolean(context.metrics.knowledgeRetrieved),
              knowledgeUsed: Boolean(context.metrics.knowledgeUsed),
              knowledgeGrounded: Boolean(context.metrics.knowledgeGrounded),
              responseContract:
                typeof context.metrics.responseContract === 'string'
                  ? context.metrics.responseContract
                  : null,
              knowledgeNeed:
                typeof context.metrics.knowledgeNeed === 'string'
                  ? context.metrics.knowledgeNeed
                  : null,
              retrievalSkippedByKnowledgeNeed: Boolean(
                context.metrics.retrievalSkippedByKnowledgeNeed,
              ),
              responseContractResolvedBeforeRetrieval: Boolean(
                context.metrics.responseContractResolvedBeforeRetrieval,
              ),
              decisionSource:
                typeof context.metrics.decisionSource === 'string'
                  ? context.metrics.decisionSource
                  : null,
              effectiveAnswerMode:
                typeof context.metrics.effectiveAnswerMode === 'string'
                  ? context.metrics.effectiveAnswerMode
                  : null,
              naturalityScore:
                typeof context.metrics.naturalityScore === 'number'
                  ? context.metrics.naturalityScore
                  : null,
              naturalityPenalties: Array.isArray(context.metrics.naturalityPenalties)
                ? context.metrics.naturalityPenalties
                : [],
              naturalityAddsNewInformation: Boolean(
                context.metrics.naturalityAddsNewInformation,
              ),
              followUpDetected: Boolean(context.metrics.followUpDetected),
              followUpFallback: Boolean(context.metrics.followUpFallback),
              followUpResolvedWithoutProvider: Boolean(
                context.metrics.followUpResolvedWithoutProvider,
              ),
              intentInherited: Boolean(context.metrics.intentInherited),
              rawSnippetLeakDetected: Boolean(
                context.metrics.rawSnippetLeakDetected,
              ),
              groundedRewriteApplied: Boolean(
                context.metrics.groundedRewriteApplied,
              ),
              lightStyleApplied: Boolean(context.metrics.lightStyleApplied),
              clarificationRequested: Boolean(
                context.metrics.clarificationRequested,
              ),
              clarificationResolved: Boolean(
                context.metrics.clarificationResolved,
              ),
            }
          : previousAuditPayload?.metrics ?? null,
      responseMode,
      responseOrigin:
        typeof decisionTrace?.deterministic?.responseOrigin === 'string'
          ? decisionTrace.deterministic.responseOrigin
          : typeof previousAuditPayload?.responseOrigin === 'string'
            ? previousAuditPayload.responseOrigin
            : null,
      orchestratorDecision,
      decisionTrace,
      fallbackReason,
      fallbackSubtype,
    }
  }

  buildCustomerKnowledgeFallbackResponse({
    role,
    intentKey,
    input,
    retrievalContext,
    fallbackReason,
    interpretation = null,
    tenantTopicTaxonomy = [],
    tenantRuntimePolicy = null,
    variationSeed = '',
    previousIntentKey = null,
    channel = null,
  }) {
    if (
      !(role === 'customer_public' || role === 'customer_authenticated') ||
      !['customer.topic_info', 'customer.product_info', 'customer.quote'].includes(
        intentKey,
      )
    ) {
      return null
    }

    if (
      shouldPreferCustomerQuoteGuidance({
        input,
        intentKey,
        interpretation,
        tenantTopicTaxonomy,
      })
    ) {
      return null
    }

    if (
      intentKey === 'customer.quote' &&
      !(
        interpretation?.topic &&
        ['product_family', 'product_topic', 'product_variant'].includes(
          String(interpretation.topic.type || ''),
        )
      )
    ) {
      return null
    }

    const retrievalItems = Array.isArray(retrievalContext?.items)
      ? retrievalContext.items.filter((item) => item && typeof item === 'object')
      : []
    if (!retrievalItems.length) {
      return null
    }

    const subject =
      interpretation?.topic?.label ||
      interpretation?.contextTopic?.label ||
      'esa opción'

    if (looksLikeMaterialFollowUpRequest(input)) {
      const materialFollowUpText = buildCustomerMaterialFollowUpText({
        subject,
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
        channel,
        channelProfile: this.getResponseChannelProfile(channel),
      })
      return {
        text: materialFollowUpText,
        wordingKey: 'customer.fallback.material_followup',
        toolCalls: [],
        needsHuman: false,
        grounding: {
          ...buildRetrievalFaqGroundingContract({
            input,
            retrievalItems,
            interpretation,
            tenantRuntimePolicy,
            paymentMethods: getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [],
            text: materialFollowUpText,
          }),
          fallbackReason,
          fallbackSubtype: 'material_followup',
        },
        debug: {
          actionKey: intentKey,
          wordingKey: 'customer.fallback.material_followup',
          detail:
            'Se devolvió un fallback de material_followup para ampliar información visual o material sin depender de pricing automático.',
        },
      }
    }

    if (looksLikeInformationExpansionRequest(input)) {
      const informationHandoffText = buildCustomerInformationThenHandoffText({
        subject,
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
        channel,
        channelProfile: this.getResponseChannelProfile(channel),
      })
      return {
        text: informationHandoffText,
        wordingKey: 'customer.fallback.information_then_handoff',
        toolCalls: [],
        needsHuman: false,
        grounding: {
          ...buildRetrievalFaqGroundingContract({
            input,
            retrievalItems,
            interpretation,
            tenantRuntimePolicy,
            paymentMethods: getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [],
            text: informationHandoffText,
          }),
          fallbackReason,
          fallbackSubtype: 'information_then_handoff',
        },
        debug: {
          actionKey: intentKey,
          wordingKey: 'customer.fallback.information_then_handoff',
          detail:
            'Se devolvió un fallback information_then_handoff para ampliar contenido general y dejar seguimiento humano si hace falta.',
        },
      }
    }

    const text =
      buildCustomerFaqKnowledgeResponse({
        input,
        retrievalItems,
        intentKey,
        interpretation,
        tenantTopicTaxonomy,
        tenantRuntimePolicy,
        paymentMethods: getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [],
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
        previousIntentKey,
        channel,
        channelProfile: this.getResponseChannelProfile(channel),
      }) ||
      buildGenericCustomerKnowledgeFallbackText(intentKey, retrievalItems, input, {
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
        channel,
        channelProfile: this.getResponseChannelProfile(channel),
      })
    if (!text) {
      return null
    }

    const groundedText = composeQuoteKnowledgeFirstText({
      informationText: text,
      input,
      interpretation,
      tenantTopicTaxonomy,
    })

    return {
      text: groundedText,
      wordingKey: this.resolveCustomerHybridWordingKey({
        intentKey,
        interpretation,
      }),
      toolCalls: [],
      needsHuman: false,
      grounding: {
        ...buildRetrievalFaqGroundingContract({
          input,
          retrievalItems,
          interpretation,
          tenantRuntimePolicy,
          paymentMethods: getBusinessRules(tenantRuntimePolicy)?.paymentMethods ?? [],
          text: groundedText,
        }),
        fallbackReason,
        fallbackSubtype: null,
      },
      debug: {
        actionKey: intentKey,
        wordingKey: this.resolveCustomerHybridWordingKey({
          intentKey,
          interpretation,
        }),
        detail:
          'Se devolvió una respuesta determinística apoyada en conocimiento aprobado después de una falla del proveedor.',
      },
    }
  }

  buildCustomerSearchFallbackResponse({
    role,
    intentKey,
    operationalContext,
    fallbackReason,
    input = '',
    interpretation = null,
    tenantTopicTaxonomy = [],
  }) {
    if (
      !(role === 'customer_public' || role === 'customer_authenticated') ||
      !(intentKey === 'customer.quote' || intentKey === 'customer.product_info')
    ) {
      return null
    }

    if (
      shouldPreferCustomerQuoteGuidance({
        input,
        intentKey,
        interpretation,
        tenantTopicTaxonomy,
      })
    ) {
      return null
    }

    const matches = this.getExecutedToolResult(
      operationalContext?.toolCalls,
      'search_products',
    )
    if (!Array.isArray(matches)) {
      return null
    }

    const firstMatch = matches[0] ?? null
    if (!firstMatch) {
      return {
        text:
          'No encontré un producto publicado que coincida exactamente con esa configuración. Un asesor del equipo te indicará cómo continuar y te ayudará a confirmar alternativas, medidas y disponibilidad.',
        toolCalls: [],
        needsHuman: true,
        grounding: {
          grounded: false,
          fallbackReason,
        },
      }
    }

    const amount =
      typeof firstMatch.amount === 'number' && Number.isFinite(firstMatch.amount)
        ? firstMatch.amount
        : null
    const currency =
      typeof firstMatch.currency === 'string' && firstMatch.currency.trim()
        ? firstMatch.currency.trim().toUpperCase()
        : null
    const productName = String(firstMatch.name || 'el producto consultado').trim()

    const lines = [
      `Encontré una coincidencia publicada para tu consulta: ${productName}.`,
    ]

    if (amount != null && currency) {
      lines.push(`Precio de referencia: ${currency} ${amount}.`)
    } else {
      lines.push(
        'En este momento no pude confirmar el precio exacto, pero un asesor puede ayudarte a validarlo.',
      )
    }

    if (intentKey === 'customer.quote') {
      lines.push(buildQuoteProgressHint(quoteContext))
    } else {
      lines.push(
        'Si necesitas más detalle o una cotización, un asesor puede continuar contigo y ayudarte con el siguiente paso.',
      )
    }

    return {
      text: lines.join(' '),
      toolCalls: [],
      needsHuman: false,
      grounding: {
        ...buildGroundingContract({
          knowledgeRetrieved: false,
          usedFacts: lines.filter(
            (entry, index) => index < 2 || /precio de referencia/i.test(entry),
          ),
          sources: buildStructuredGroundingSource({
            sourceType: 'published_catalog',
            scope: 'catalog',
            sourceKey:
              firstMatch?.id != null
                ? `product:${firstMatch.id}`
                : compactText(productName || 'catalog_match'),
            title: productName,
          }),
        }),
        fallbackReason,
      },
    }
  }

  getExecutedToolResult(toolCalls, toolName) {
    return (
      (Array.isArray(toolCalls)
        ? toolCalls.find(
            (entry) => entry?.name === toolName && entry?.status === 'executed',
          )?.result
        : null) ?? null
    )
  }

  extractExplicitId(input, labels = []) {
    const normalizedLabels = Array.isArray(labels) ? labels : [labels]
    for (const label of normalizedLabels) {
      const match = String(input || '').match(
        new RegExp(`\\b${label}\\s+#?(\\d+)\\b`, 'iu'),
      )
      if (match?.[1]) {
        return Number(match[1])
      }
    }
    return null
  }

  selectEntityMatch(results, explicitId = null) {
    if (!Array.isArray(results) || !results.length) {
      return null
    }
    if (explicitId != null) {
      return results.find((item) => Number(item?.id) === Number(explicitId)) ?? null
    }
    return results[0] ?? null
  }

  extractEmailValue(input) {
    const match = String(input || '').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/iu)
    return match?.[0]?.trim().toLowerCase() ?? null
  }

  extractPhoneValue(input) {
    const labeled =
      extractNamedEntity(String(input || ''), [
        /\b(?:telefono|tel[eé]fono|tel|cel|celular|whatsapp|wpp)\s*(?:es|:)?\s*([+()0-9 \-]{6,})/iu,
      ]) ?? null
    const raw =
      labeled ??
      extractNamedEntity(String(input || ''), [
        /\b(\+?\d[\d ()-]{6,}\d)\b/u,
      ])

    if (!raw) {
      return null
    }

    const cleaned = raw.replace(/[^\d+]/g, '')
    return cleaned.length >= 7 ? cleaned : null
  }

  extractCurrencyAmount(input) {
    const text = String(input || '')
    const direct = text.match(/\b(usd|uyu|eur)\s*([0-9]+(?:[.,][0-9]{1,2})?)\b/iu)
    if (direct) {
      return {
        currency: direct[1].toUpperCase(),
        amount: Number(direct[2].replace(',', '.')),
      }
    }

    const reverse = text.match(/\b([0-9]+(?:[.,][0-9]{1,2})?)\s*(usd|uyu|eur)\b/iu)
    if (reverse) {
      return {
        currency: reverse[2].toUpperCase(),
        amount: Number(reverse[1].replace(',', '.')),
      }
    }

    return { currency: null, amount: null }
  }

  extractIntegerValue(input, patterns = []) {
    for (const pattern of patterns) {
      const match = String(input || '').match(pattern)
      if (match?.[1]) {
        return Number(match[1])
      }
    }
    return null
  }

  extractCommentValue(input) {
    return (
      extractNamedEntity(String(input || ''), [
        /\b(?:comentario|nota)\s+(?:del|de la|para el|para la)?\s*(?:pedido|presupuesto|pago)?\s*(?:indicando|que|:)?\s+(.+)$/iu,
        /\bindicando\s+(.+)$/iu,
      ]) ?? null
    )
  }

  extractLocationValue(input) {
    return (
      extractNamedEntity(String(input || ''), [
        /\b(?:direccion|dirección|ubicacion|ubicación)\s*(?:es|:)?\s+(.+?)(?=\s+(?:correo|mail|email|telefono|tel[eé]fono|tel|cel|whatsapp)\b|$)/iu,
        /\ben\s+([a-záéíóúñ0-9 .,'/-]+)$/iu,
      ]) ?? null
    )
  }

  extractStatusValue(actionKey, input) {
    const normalized = normalizeText(input)

    if (actionKey === 'orders.update_status') {
      if (/\bpendiente\b/.test(normalized)) return 'pending'
      if (/\bpago|pagado\b/.test(normalized)) return 'paid'
      if (/\bcancelado|cancelar\b/.test(normalized)) return 'cancelled'
      if (/\bentregado|entregar\b/.test(normalized)) return 'delivered'
      return null
    }

    if (actionKey === 'quotes.update_status') {
      if (/\bborrador|draft\b/.test(normalized)) return 'budget_draft'
      if (/\benviado|enviar\b/.test(normalized)) return 'budget_sent'
      if (/\baceptado|aceptar\b/.test(normalized)) return 'budget_accepted'
      if (/\bconvertido|convertir\b/.test(normalized)) return 'budget_converted'
      if (/\bcancelado|cancelar\b/.test(normalized)) return 'budget_cancelled'
      if (/\bvencido|expirado|expirar\b/.test(normalized)) return 'budget_expired'
      return null
    }

    if (actionKey === 'payments.update_status') {
      if (/\bconfirmado|confirmar\b/.test(normalized)) return 'CONFIRMED'
      if (/\bregistrado|registrar\b/.test(normalized)) return 'REGISTERED'
      if (/\bfallido|rechazado|fallar\b/.test(normalized)) return 'FAILED'
      return null
    }

    return null
  }

  buildOperationDraftToolCall(actionIntent, draft) {
    return {
      name: OPERATION_DRAFT_TOOL_NAME,
      status: 'draft',
      arguments: {
        actionKey: actionIntent.key,
      },
      result: {
        actionKey: actionIntent.key,
        draft,
      },
    }
  }

  buildOperationDraftResponse(actionIntent, draft) {
    return renderOperationDraftOutcome({
      draft,
      actionIntent,
      audience: 'admin',
      buildDraftToolCall: (nextActionIntent, nextDraft) =>
        this.buildOperationDraftToolCall(nextActionIntent, nextDraft),
    })
  }

  buildVerificationLink(entity, result) {
    const builder = VERIFICATION_ROUTE_BUILDERS[entity]
    if (!builder) {
      return null
    }

    let id = null
    if (entity === 'customer') {
      id = result?.customer?.id ?? result?.id ?? null
    } else if (entity === 'order') {
      id = result?.convertedOrderId ?? result?.id ?? null
    } else {
      id = result?.id ?? null
    }

    return id != null ? builder(id) : null
  }

  async executeOperationDraft(draft, backendClient) {
    if (!draft?.execute) {
      return { executions: [], detail: 'No se encontró metadata de ejecución en el draft.' }
    }

    const executeSingle = async (step) => {
      try {
        return await executeRegisteredActionStep(step, backendClient)
      } catch (error) {
        const execution = {
          name: step.toolName,
          arguments:
            step.targetId != null
              ? { id: step.targetId, ...(step.payload ?? {}) }
              : { ...(step.payload ?? {}) },
        }
        return {
          ...execution,
          result: null,
          status: 'failed',
          verifyEntity: step.verifyEntity ?? null,
          successLabel: step.successLabel ?? null,
          errorMessage: error instanceof Error ? error.message : `${step.toolName} failed`,
        }
      }
    }

    if (draft.execute.type === 'batch') {
      const executions = []
      for (const step of draft.execute.items ?? []) {
        executions.push(await executeSingle(step))
      }
      return {
        executions,
        detail: `Ejecución batch completada. Ejecutados: ${executions.filter((entry) => entry.status === 'executed').length}. Fallidos: ${executions.filter((entry) => entry.status === 'failed').length}.`,
      }
    }

    const execution = await executeSingle(draft.execute)
    return {
      executions: [execution],
      detail:
        execution.status === 'executed'
          ? `Se ejecutó ${execution.name} correctamente.`
          : execution.errorMessage || `Falló ${execution.name}.`,
    }
  }

  formatExecutionResponse(draft, executions = []) {
    return renderExecutionOutcome({
      draft,
      executions,
      audience: 'admin',
      buildVerificationLink: (entity, result) =>
        this.buildVerificationLink(entity, result),
    })
  }

  buildOperationDraft(
    actionIntent,
    input,
    operationalContext,
    extractedAssets = [],
  ) {
    const actionDefinition = getActionDefinition(actionIntent?.key)
    if (!actionDefinition) {
      return null
    }

    switch (actionDefinition.draftBuilder) {
      case 'buildStructuredCatalogRegisterDraft':
        return this.buildStructuredCatalogRegisterDraft(actionIntent, operationalContext)
      case 'buildAppointmentCreateDraft':
        return this.buildAppointmentCreateDraft(actionIntent, input)
      case 'buildAppointmentUpdateDraft':
        return this.buildAppointmentUpdateDraft(actionIntent, input, operationalContext)
      case 'buildAppointmentDeleteDraft':
        return this.buildAppointmentDeleteDraft(actionIntent, input, operationalContext)
      case 'buildCustomerCreateDraft':
        return this.buildCustomerCreateDraft(actionIntent, input)
      case 'buildCustomerUpdateDraft':
        return this.buildCustomerUpdateDraft(actionIntent, input, operationalContext)
      case 'buildProductCreateDraft':
        return actionDefinition.batchDraftBuilder
          ? this[actionDefinition.batchDraftBuilder](actionIntent, extractedAssets) ||
              this.buildProductCreateDraft(actionIntent, input)
          : this.buildProductCreateDraft(actionIntent, input)
      case 'buildProductUpdateDraft':
        return this.buildProductUpdateDraft(actionIntent, input, operationalContext)
      case 'buildDocumentActionDraft':
        return this.buildDocumentActionDraft(actionIntent, input, operationalContext)
      default:
        return null
    }
  }

  async tryExecutePendingConfirmation({
    snapshot,
    taskMemory,
    conversationId,
    role,
    scope,
    input,
    backendClient,
  }) {
    if (
      !(role.startsWith('admin_') || role === 'superadmin') ||
      !hasExplicitConfirmation(input)
    ) {
      return null
    }

    const pendingTaskId = snapshot?.taskState?.taskId ?? taskMemory.taskId
    const pendingIntentKey = snapshot?.taskState?.intentKey ?? taskMemory.intentKey

    const agentToolTurns = [...(snapshot?.turns ?? [])]
      .reverse()
      .filter(
        (turn) =>
          turn?.role === 'agent' &&
          Array.isArray(turn?.metadata?.toolCalls),
      )
    const lastToolCarrier =
      agentToolTurns.find((turn) => turn?.metadata?.taskId === pendingTaskId) ??
      agentToolTurns[0] ??
      null

    const toolCalls = Array.isArray(lastToolCarrier?.metadata?.toolCalls)
      ? lastToolCarrier.metadata.toolCalls
      : []

    const operationDraft =
      toolCalls.find(
        (entry) =>
          entry?.name === OPERATION_DRAFT_TOOL_NAME &&
          entry?.status === 'draft' &&
          entry?.result?.actionKey === pendingIntentKey &&
          entry?.result?.draft,
      )?.result?.draft ?? null

    if (operationDraft) {
      const { executions, detail } = await this.executeOperationDraft(
        operationDraft,
        backendClient,
      )
      const response = this.formatExecutionResponse(operationDraft, executions)

      return {
        ...response,
        toolCalls: executions,
        debug: {
          actionKey: `${pendingIntentKey}.confirm`,
          detail,
        },
      }
    }

    const insertDraft = toolCalls.find(
      (entry) =>
        entry?.name === STRUCTURED_CATALOG_INSERT_TOOL &&
        entry?.status === 'executed' &&
        entry?.result?.itemCount,
    )?.result

    if (pendingIntentKey === STRUCTURED_CATALOG_REGISTER_INTENT && insertDraft) {
      const readyItems = Array.isArray(insertDraft.items)
        ? insertDraft.items.filter((item) => item?.validForInsert && item?.insertPayload)
        : []
      if (!readyItems.length) {
        return {
          text:
            'No hay ítems válidos para crear todavía. Corrige los faltantes detectados y vuelve a confirmar.',
          toolCalls: [],
          needsHuman: false,
          grounding: { grounded: false, fallbackReason: 'pending_required_fields' },
          debug: {
            actionKey: `${STRUCTURED_CATALOG_REGISTER_INTENT}.confirm`,
            detail: 'La confirmación llegó, pero el draft no contiene insertPayloads válidos.',
          },
        }
      }

      const executions = []
      for (const item of readyItems) {
        try {
          const created = await backendClient.createProduct(item.insertPayload)
          executions.push({
            name: 'create_product',
            arguments: item.insertPayload,
            result: created,
            status: 'executed',
          })
        } catch (error) {
          executions.push({
            name: 'create_product',
            arguments: item.insertPayload,
            result: null,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'create_product failed',
          })
        }
      }

      const success = executions.filter((entry) => entry.status === 'executed')
      const failed = executions.filter((entry) => entry.status === 'failed')
      const lines = []
      if (success.length) {
        lines.push('Alta ejecutada correctamente para los siguientes productos:')
        for (const entry of success) {
          lines.push(
            `- ${entry.result?.name || entry.arguments?.name || 'Producto'} · detalle: /app/products/edit/${entry.result?.id}`,
          )
        }
      }
      if (failed.length) {
        lines.push('', 'Fallos de creación:')
        for (const entry of failed) {
          lines.push(
            `- ${entry.arguments?.name || 'Producto'}: ${entry.errorMessage || 'error desconocido'}`,
          )
        }
      }

      return {
        text: lines.join('\n'),
        toolCalls: executions,
        needsHuman: failed.length > 0,
        grounding: {
          grounded: false,
          fallbackReason: failed.length > 0 ? 'execution_partial_failure' : null,
        },
        debug: {
          actionKey: `${STRUCTURED_CATALOG_REGISTER_INTENT}.confirm`,
          detail: `Se confirmó el draft de alta. Productos creados: ${success.length}. Fallidos: ${failed.length}.`,
        },
      }
    }

    const customerTurns = [...(snapshot?.turns ?? [])]
      .reverse()
      .filter(
        (turn) =>
          turn?.role === 'customer' &&
          turn?.text &&
          !hasExplicitConfirmation(turn.text),
      )
    const lastCustomerText =
      customerTurns.find((turn) => turn?.metadata?.taskId === pendingTaskId)
        ?.text ??
      customerTurns[0]?.text ??
      null

    if (pendingIntentKey === 'appointments.create' && lastCustomerText) {
      const draft = this.extractAppointmentDraft(lastCustomerText)
      if (!draft.title || !draft.startAt) {
        return {
          text:
            'No pude confirmar la creación porque faltan datos estructurales de la cita. Revisa título, fecha y hora.',
          toolCalls: [],
          needsHuman: false,
          grounding: { grounded: false, fallbackReason: 'pending_required_fields' },
          debug: {
            actionKey: 'appointments.create.confirm',
            detail: 'La confirmación llegó, pero no se pudo reconstruir un payload válido de la cita.',
          },
        }
      }

      try {
        const created = await backendClient.createAppointment({
          title: draft.title,
          startAt: draft.startAt,
          location: draft.location || undefined,
        })
        return {
          text: `Cita creada correctamente: ${created.title} · detalle operativo: actividad #${created.id}.`,
          toolCalls: [
            {
              name: 'create_appointment',
              arguments: {
                title: draft.title,
                startAt: draft.startAt,
                location: draft.location || undefined,
              },
              result: created,
              status: 'executed',
            },
          ],
          needsHuman: false,
          grounding: { grounded: false, fallbackReason: null },
          debug: {
            actionKey: 'appointments.create.confirm',
            detail: 'Se reconstruyó el payload de cita desde el turno previo y se ejecutó create_appointment.',
          },
        }
      } catch (error) {
        return {
          text:
            'La confirmación fue recibida, pero la creación de la cita falló. Revisa el payload y el error reportado abajo.',
          toolCalls: [
            {
              name: 'create_appointment',
              arguments: {
                title: draft.title,
                startAt: draft.startAt,
                location: draft.location || undefined,
              },
              result: null,
              status: 'failed',
              errorMessage:
                error instanceof Error ? error.message : 'create_appointment failed',
            },
          ],
          needsHuman: true,
          grounding: { grounded: false, fallbackReason: 'execution_failed' },
          debug: {
            actionKey: 'appointments.create.confirm',
            detail:
              error instanceof Error ? error.message : 'create_appointment failed',
          },
        }
      }
    }

    return null
  }

  resolveTaskMemory(
    snapshot,
    conversationId,
    role,
    scope,
    input,
    actionIntent,
    intentDetection = null,
    turnInterpretation = null,
    tenantRuntimePolicy = null,
  ) {
    const now = new Date().toISOString()
    const previousTaskState = snapshot?.taskState ?? null
    const previousIntentKey = previousTaskState?.intentKey || null
    const previousTurnIntentKey =
      previousTaskState?.turnIntentKey || previousIntentKey || null
    const previousCanonicalTopic =
      previousTaskState?.canonicalTopic && typeof previousTaskState.canonicalTopic === 'object'
        ? previousTaskState.canonicalTopic
        : null
    const previousQuoteContext =
      previousTaskState?.quoteContext && typeof previousTaskState.quoteContext === 'object'
        ? previousTaskState.quoteContext
        : null
    const previousScheduleContext =
      previousTaskState?.scheduleContext &&
      typeof previousTaskState.scheduleContext === 'object'
        ? previousTaskState.scheduleContext
        : null
    const previousSupportContext =
      previousTaskState?.supportContext &&
      typeof previousTaskState.supportContext === 'object'
        ? previousTaskState.supportContext
        : null
    const previousConversationContext =
      previousTaskState?.conversationContext &&
      typeof previousTaskState.conversationContext === 'object'
        ? previousTaskState.conversationContext
        : null
    const previousConversationState =
      previousTaskState?.conversationState &&
      typeof previousTaskState.conversationState === 'object'
        ? previousTaskState.conversationState
        : previousConversationContext?.conversationState &&
            typeof previousConversationContext.conversationState === 'object'
          ? previousConversationContext.conversationState
          : null
    const previousConversationThreads = Array.isArray(previousTaskState?.conversationThreads)
      ? previousTaskState.conversationThreads
      : []
    const previousActiveThreadKey =
      typeof previousTaskState?.activeThreadKey === 'string'
        ? previousTaskState.activeThreadKey
        : null
    const previousActiveLane = readConversationActiveLane(previousConversationContext)
    const interpretedTopicLabel =
      typeof turnInterpretation?.topic?.label === 'string'
        ? turnInterpretation.topic.label
        : null
    let currentTopicTokens = extractTopicTokens(interpretedTopicLabel || input)
    let currentCanonicalTopic =
      interpretedTopicLabel
        ? {
            label: turnInterpretation.topic.label,
            type: turnInterpretation.topic.type || 'unknown',
            confidence:
              typeof turnInterpretation.topic.confidence === 'number'
                ? turnInterpretation.topic.confidence
                : 0,
            source: turnInterpretation.topic.source || 'unknown',
            tokens: currentTopicTokens,
          }
        : previousCanonicalTopic
    let currentQuoteContext =
      turnInterpretation?.quoteContext && typeof turnInterpretation.quoteContext === 'object'
        ? turnInterpretation.quoteContext
        : previousQuoteContext
    let currentScheduleContext =
      turnInterpretation?.scheduleContext &&
      typeof turnInterpretation.scheduleContext === 'object'
        ? turnInterpretation.scheduleContext
        : previousScheduleContext
    let currentSupportContext =
      turnInterpretation?.supportContext &&
      typeof turnInterpretation.supportContext === 'object'
        ? turnInterpretation.supportContext
        : previousSupportContext
    let currentConversationContext =
      turnInterpretation?.conversationContext &&
      typeof turnInterpretation.conversationContext === 'object'
        ? turnInterpretation.conversationContext
        : previousConversationContext
    let currentConversationThreads = Array.isArray(
      turnInterpretation?.threadResolution?.threads,
    )
      ? turnInterpretation.threadResolution.threads
      : previousConversationThreads
    let currentActiveThreadKey =
      typeof turnInterpretation?.threadResolution?.activeThreadKey === 'string' &&
      turnInterpretation.threadResolution.activeThreadKey.trim()
        ? turnInterpretation.threadResolution.activeThreadKey.trim()
        : previousActiveThreadKey

    const readiness =
      readInterpretationResolutionReadiness(turnInterpretation) ||
      currentConversationContext?.resolutionReadiness ||
      null
    const turnIntentKey =
      normalizeIntentKeyValue(readiness?.turnIntent) ||
      normalizeIntentKeyValue(intentDetection?.intent) ||
      deriveIntentKey(role, input, actionIntent, tenantRuntimePolicy)
    let activeLane = normalizeIntentKeyValue(readiness?.lane) || null
    let effectiveReadiness =
      readiness && typeof readiness === 'object'
        ? {
            ...readiness,
            lane: activeLane || readiness.lane || null,
            turnIntent: turnIntentKey || readiness.turnIntent || null,
          }
        : null
    const currentTurnText = turnInterpretation?.currentTurnText || input || ''
    let currentIntentKey = resolveCustomerActiveIntentKeyFromReadiness({
      role,
      turnIntentKey,
      readiness: effectiveReadiness,
    })

    if (currentConversationContext && typeof currentConversationContext === 'object') {
      currentConversationContext = {
        ...currentConversationContext,
        activeLane: activeLane || currentConversationContext.activeLane || null,
        activeDomain:
          activeLane ||
          currentConversationContext.activeDomain ||
          currentConversationContext.activeLane ||
          null,
        resolutionReadiness:
          effectiveReadiness || currentConversationContext.resolutionReadiness || null,
      }
    }

    const shouldCarryQuoteTopicFromMemory =
      (role === 'customer_public' || role === 'customer_authenticated') &&
      activeLane === 'quote' &&
      currentIntentKey === 'customer.quote' &&
      !currentCanonicalTopic &&
      previousCanonicalTopic &&
      Boolean(currentQuoteContext?.measurements || previousQuoteContext?.measurements)

    if (shouldCarryQuoteTopicFromMemory) {
      currentCanonicalTopic = {
        ...previousCanonicalTopic,
        tokens: Array.isArray(previousCanonicalTopic.tokens)
          ? previousCanonicalTopic.tokens
          : currentTopicTokens,
      }
      currentTopicTokens = Array.isArray(previousCanonicalTopic.tokens)
        ? previousCanonicalTopic.tokens
        : currentTopicTokens
    }

    const previousTopicIsProduct =
      previousCanonicalTopic &&
      ['product_family', 'product_topic', 'product_variant'].includes(
        String(previousCanonicalTopic.type || ''),
      )
    const currentTopicIsBusinessFact =
      currentCanonicalTopic &&
      String(currentCanonicalTopic.type || '') === 'business_fact'
    const preserveProductThreadOnBusinessFaq =
      previousTopicIsProduct &&
      currentTopicIsBusinessFact &&
      (currentIntentKey === 'customer.topic_info' ||
        currentIntentKey === 'customer.contact_info')

    if (preserveProductThreadOnBusinessFaq) {
      currentCanonicalTopic = {
        ...previousCanonicalTopic,
        tokens: Array.isArray(previousCanonicalTopic.tokens)
          ? previousCanonicalTopic.tokens
          : currentTopicTokens,
      }
      currentTopicTokens = Array.isArray(previousTaskState?.topicTokens)
        ? previousTaskState.topicTokens
        : Array.isArray(previousCanonicalTopic.tokens)
          ? previousCanonicalTopic.tokens
          : currentTopicTokens
    }

    const shouldCarryPreviousTopicIntoGenericFollowUp =
      !(role.startsWith('admin_') || role === 'superadmin') &&
      previousIntentKey &&
      isGenericCustomerIntentKey(currentIntentKey) &&
      (turnInterpretation?.followUp?.detected ||
        looksLikeCustomerFollowUp(currentTurnText) ||
        looksLikeShortContextualFollowUp(currentTurnText) ||
        looksLikeContextualReference(currentTurnText))

    if (shouldCarryPreviousTopicIntoGenericFollowUp) {
      currentTopicTokens = Array.from(
        new Set([...(previousTaskState?.topicTokens ?? []), ...currentTopicTokens]),
      ).slice(0, 12)
      if (!currentCanonicalTopic && previousCanonicalTopic) {
        currentCanonicalTopic = {
          ...previousCanonicalTopic,
          tokens: currentTopicTokens,
        }
      }
    }

    const previousNamespace = intentNamespace(previousIntentKey)
    const currentNamespace = intentNamespace(currentIntentKey)
    const overlap = calculateTopicOverlap(
      previousTaskState?.topicTokens ?? [],
      currentTopicTokens,
    )

    let shouldReset = explicitResetRequested(input)

    if (!shouldReset && previousTaskState) {
      if (role.startsWith('admin_') || role === 'superadmin') {
        shouldReset =
          previousNamespace !== currentNamespace ||
          ((isStructuredCatalogActionKey(currentIntentKey) ||
            isStructuredCatalogActionKey(previousIntentKey)) &&
            overlap < 0.18 &&
            currentTopicTokens.length > 0)
      } else {
        const laneStableContinuation =
          previousActiveLane &&
          activeLane &&
          previousActiveLane === activeLane &&
          ['quote', 'support', 'schedule'].includes(String(activeLane || ''))

        shouldReset =
          previousIntentKey !== currentIntentKey &&
          !laneStableContinuation &&
          overlap < 0.12 &&
          currentIntentKey !== 'customer.light'

        if (preserveProductThreadOnBusinessFaq || laneStableContinuation) {
          shouldReset = false
        }
      }
    }

    if (
      shouldReset &&
      !(
        turnInterpretation?.quoteContext &&
        typeof turnInterpretation.quoteContext === 'object'
      ) &&
      !(
        turnInterpretation?.supportContext &&
        typeof turnInterpretation.supportContext === 'object'
      )
    ) {
      currentQuoteContext = null
      currentScheduleContext = null
      currentSupportContext = null
      currentConversationThreads = []
      currentActiveThreadKey = null
    }

    const previousAgentText = Array.isArray(snapshot?.turns)
      ? [...snapshot.turns]
          .reverse()
          .find((entry) => entry?.role === 'agent' && typeof entry?.text === 'string')
          ?.text || ''
      : ''
    let currentConversationState = buildConversationState({
      previousConversationState,
      tenantRuntimePolicy,
      readiness: effectiveReadiness,
      intentKey: currentIntentKey,
      intentConfidence: intentDetection?.confidence ?? null,
      topic: currentCanonicalTopic,
      contextTopic: previousCanonicalTopic,
      quoteContext: currentQuoteContext,
      supportContext: currentSupportContext,
      scheduleContext: currentScheduleContext,
      currentTurnText,
      previousAgentText,
    })
    const normalizedContexts = normalizeOperationalContextsWithConversationState({
      quoteContext: currentQuoteContext,
      supportContext: currentSupportContext,
      scheduleContext: currentScheduleContext,
      conversationState: currentConversationState,
    })
    currentQuoteContext = normalizedContexts.quoteContext
    currentSupportContext = normalizedContexts.supportContext
    currentScheduleContext = normalizedContexts.scheduleContext
    effectiveReadiness = applyPreResponseDecisionGuards({
      readiness: effectiveReadiness,
      previousConversationContext,
      previousActiveThreadKey,
      threadResolution: turnInterpretation?.threadResolution || null,
      quoteContext: currentQuoteContext,
      supportContext: currentSupportContext,
      scheduleContext: currentScheduleContext,
      conversationState: currentConversationState,
    })
    activeLane = normalizeIntentKeyValue(effectiveReadiness?.lane) || activeLane
    currentIntentKey = resolveCustomerActiveIntentKeyFromReadiness({
      role,
      turnIntentKey,
      readiness: effectiveReadiness,
    })
    currentConversationState = buildConversationState({
      previousConversationState,
      tenantRuntimePolicy,
      readiness: effectiveReadiness,
      intentKey: currentIntentKey,
      intentConfidence: intentDetection?.confidence ?? null,
      topic: currentCanonicalTopic,
      contextTopic: previousCanonicalTopic,
      quoteContext: currentQuoteContext,
      supportContext: currentSupportContext,
      scheduleContext: currentScheduleContext,
      currentTurnText,
      previousAgentText,
    })
    let stabilizedReadiness = stabilizeReadinessWithConversationState({
      readiness: effectiveReadiness,
      conversationState: currentConversationState,
      quoteContext: currentQuoteContext,
      supportContext: currentSupportContext,
      scheduleContext: currentScheduleContext,
    })
    stabilizedReadiness = applyPreResponseDecisionGuards({
      readiness: stabilizedReadiness,
      previousConversationContext,
      previousActiveThreadKey,
      threadResolution: turnInterpretation?.threadResolution || null,
      quoteContext: currentQuoteContext,
      supportContext: currentSupportContext,
      scheduleContext: currentScheduleContext,
      conversationState: currentConversationState,
    })
    const projectedContexts = projectOperationalContextsForDecision({
      readiness: stabilizedReadiness,
      quoteContext: currentQuoteContext,
      supportContext: currentSupportContext,
      scheduleContext: currentScheduleContext,
      conversationState: currentConversationState,
    })
    currentQuoteContext = projectedContexts.quoteContext
    currentSupportContext = projectedContexts.supportContext
    currentScheduleContext = projectedContexts.scheduleContext
    activeLane = normalizeIntentKeyValue(stabilizedReadiness?.lane) || activeLane
    currentIntentKey = resolveCustomerActiveIntentKeyFromReadiness({
      role,
      turnIntentKey,
      readiness: stabilizedReadiness,
    })
    currentConversationState = buildConversationState({
      previousConversationState,
      tenantRuntimePolicy,
      readiness: stabilizedReadiness,
      intentKey: currentIntentKey,
      intentConfidence: intentDetection?.confidence ?? null,
      topic: currentCanonicalTopic,
      contextTopic: previousCanonicalTopic,
      quoteContext: currentQuoteContext,
      supportContext: currentSupportContext,
      scheduleContext: currentScheduleContext,
      currentTurnText,
      previousAgentText,
    })
    currentActiveThreadKey =
      compactText(
        stabilizedReadiness?.activeThreadId ||
          stabilizedReadiness?.threadKey ||
          currentActiveThreadKey ||
          '',
      ) || null

    if (currentConversationContext && typeof currentConversationContext === 'object') {
      currentConversationContext = {
        ...currentConversationContext,
        activeLane: activeLane || currentConversationContext.activeLane || null,
        activeDomain:
          activeLane ||
          currentConversationContext.activeDomain ||
          currentConversationContext.activeLane ||
          null,
        threadKey:
          currentActiveThreadKey || currentConversationContext.threadKey || null,
        resumePointer:
          stabilizedReadiness?.resumePointer ||
          currentConversationContext.resumePointer ||
          null,
        resolutionReadiness: stabilizedReadiness,
        conversationState: currentConversationState,
      }
    }

    if (turnInterpretation && typeof turnInterpretation === 'object') {
      turnInterpretation.quoteContext = currentQuoteContext
      turnInterpretation.supportContext = currentSupportContext
      turnInterpretation.scheduleContext = currentScheduleContext
      if (currentConversationContext && typeof currentConversationContext === 'object') {
        turnInterpretation.conversationContext = currentConversationContext
      }
      if (stabilizedReadiness && typeof stabilizedReadiness === 'object') {
        turnInterpretation.resolutionReadiness = stabilizedReadiness
      }
    }

    const taskId = shouldReset
      ? `${conversationId}:${Date.now()}`
      : previousTaskState?.taskId || `${conversationId}:1`

    const nextSnapshot = snapshot
      ? structuredClone(snapshot)
      : {
          conversationId,
          scope,
          role,
          turns: [],
          summary: null,
          compiledContext: null,
          taskState: null,
          updatedAt: now,
        }

    nextSnapshot.scope = scope
    nextSnapshot.role = role
    nextSnapshot.updatedAt = now
    const history = filterReasoningRelevantTurns(nextSnapshot.turns ?? [])
      .filter((turn) => turn?.metadata?.taskId === taskId)
      .slice(-(getRoleConfig(role, this.roleCatalog)?.memoryTurns ?? 8))
    const taskSummary = buildTaskSummary(
      currentIntentKey,
      history,
      input,
      currentQuoteContext,
    )
    const detectedState = applyAgentStateEvents(
      previousTaskState,
      [AGENT_STATE_EVENTS.DETECT_INTENT],
      {
        at: now,
        reset: shouldReset,
      },
    )
    const currentTask = {
      intentKey: currentIntentKey,
      turnIntentKey,
      activeLane,
      entities: [
        ...(currentCanonicalTopic?.label
          ? [
              {
                type: currentCanonicalTopic.type || 'topic',
                value: currentCanonicalTopic.label,
              },
            ]
          : []),
        ...(currentQuoteContext?.measurements
          ? [
              {
                type: 'quote_measurements',
                value:
                  currentQuoteContext.measurements.displayLabel ||
                  `${currentQuoteContext.measurements.widthMm || '?'}x${currentQuoteContext.measurements.heightMm || '?'}`,
              },
              {
                type: 'quote_width_mm',
                value: String(currentQuoteContext.measurements.widthMm || ''),
              },
              {
                type: 'quote_height_mm',
                value: String(currentQuoteContext.measurements.heightMm || ''),
              },
            ]
          : []),
        ...(currentQuoteContext?.quantity?.total
          ? [
              {
                type: 'quote_quantity',
                value: String(currentQuoteContext.quantity.total),
              },
            ]
          : []),
        ...(
          currentQuoteContext?.capturedAttributes &&
          typeof currentQuoteContext.capturedAttributes === 'object'
            ? Object.entries(currentQuoteContext.capturedAttributes)
                .filter(
                  ([key, entry]) =>
                    key !== 'measurements' &&
                    key !== 'quantity' &&
                    entry &&
                    typeof entry === 'object' &&
                    (typeof entry.label === 'string' || typeof entry.value === 'string'),
                )
                .map(([key, entry]) => ({
                  type: `quote_${key}`,
                  value:
                    typeof entry.label === 'string' && entry.label.trim()
                      ? entry.label
                      : String(entry.value || ''),
                }))
            : []
        ),
        ...(typeof currentSupportContext?.productType === 'string'
          ? [
              {
                type: 'support_product_type',
                value: currentSupportContext.productType,
              },
            ]
          : []),
        ...(typeof currentSupportContext?.issueSummary === 'string'
          ? [
              {
                type: 'support_issue',
                value: currentSupportContext.issueSummary,
              },
            ]
          : []),
        ...currentTopicTokens.map((token) => ({
          type: 'topic_token',
          value: token,
        })),
      ],
      status: detectedState.currentTaskStatus,
      lastUpdate: now,
    }

    nextSnapshot.taskState = {
      taskId,
      intentKey: currentIntentKey,
      turnIntentKey,
      activeLane,
      state: detectedState.state,
      stateHistory: detectedState.stateHistory,
      lastTransitionAt: detectedState.lastTransitionAt,
      topicTokens: currentTopicTokens,
      canonicalTopic: currentCanonicalTopic,
      quoteContext: currentQuoteContext,
      supportContext: currentSupportContext,
      scheduleContext: currentScheduleContext,
      conversationContext: currentConversationContext,
      conversationState: currentConversationState,
      conversationThreads: currentConversationThreads,
      activeThreadKey: currentActiveThreadKey,
      taskSummary,
      currentTask,
      resetCount: (previousTaskState?.resetCount ?? 0) + (shouldReset ? 1 : 0),
      lastResetAt: shouldReset ? now : previousTaskState?.lastResetAt ?? null,
      updatedAt: now,
    }

    return {
      snapshot: nextSnapshot,
      taskId,
      intentKey: currentIntentKey,
      turnIntentKey,
      activeLane,
      taskSummary,
      currentTask,
      canonicalTopic: currentCanonicalTopic,
      quoteContext: currentQuoteContext,
      supportContext: currentSupportContext,
      scheduleContext: currentScheduleContext,
      conversationContext: currentConversationContext,
      conversationState: currentConversationState,
      conversationThreads: currentConversationThreads,
      activeThreadKey: currentActiveThreadKey,
      resetApplied: shouldReset,
      resetCount: nextSnapshot.taskState.resetCount,
      lastResetAt: nextSnapshot.taskState.lastResetAt,
      history,
    }
  }

  buildRoleBlockedResponse(role, roleResolution = { ambiguous: false }) {
    if (isAdminConversationalRole(role)) {
      return this.buildSharedOutcomeText({
        audience: 'admin',
        outcome: 'blocked',
        variant: roleResolution?.ambiguous ? 'ambiguous' : null,
      })
    }

    return this.buildSharedOutcomeText({
      audience: 'customer',
      outcome: 'blocked',
    })
  }

  async finalizeBlockedTurn({
    conversationId,
    scope,
    role,
    roleConfig,
    roleResolution,
    taskMemory,
    intentDetection,
    intentKey,
    blockedTools = [],
    fallbackReason,
    stage,
    detail,
    actionKey = null,
    input = null,
    decisionPath = [],
    messageContext,
    messageContextAudit,
    runtimeOptions = {},
  }) {
    const fallback = this.buildRoleBlockedResponse(role, roleResolution)
    const debugResponse = this.appendAdminDebugSummary(
      {
        text: fallback,
        toolCalls: [],
        needsHuman: roleConfig.type === 'customer',
        grounding: {
          grounded: false,
          fallbackReason,
        },
      },
      {
        stage,
        role,
        input,
        intentKey,
        intentConfidence: intentDetection?.confidence ?? null,
        intentSource: intentDetection?.source ?? null,
        decisionPath: Array.isArray(decisionPath) ? decisionPath : [],
        actionKey,
        blockedTools,
        messageElementsUsed: messageContext?.usedElementKinds ?? [],
        messageElements: messageContextAudit?.messageElements ?? [],
        messageContextOrigin: messageContextAudit?.messageContextOrigin ?? [],
        detail,
      },
    )
    const finalizedTask = this.applyTaskStateFromResponse(taskMemory, debugResponse, {
      events: [AGENT_STATE_EVENTS.EXECUTION_FAILED],
    })
    const memoryTransaction = this.pendingMemoryTransaction({
      conversationId,
      snapshot: finalizedTask.snapshot,
      scope,
      role,
      runtimeOptions,
    })
    const now = new Date().toISOString()
    if (typeof input === 'string' && input.trim()) {
      this.stageConversationTurn(memoryTransaction, {
        role: 'customer',
        text: input.trim(),
        createdAt: now,
        metadata: {
          taskId: taskMemory?.taskId ?? null,
          intentKey,
          role,
          authorKind: 'customer',
          messageKind: 'human_message',
          messageElementCount: Array.isArray(messageContext?.usedElementKinds)
            ? messageContext.usedElementKinds.length
            : 0,
        },
      })
    }
    this.stageConversationTurn(memoryTransaction, {
      role: 'agent',
      text: debugResponse.text,
      createdAt: new Date().toISOString(),
      metadata: {
        provider: this.provider.providerName,
        authorKind: 'agent_runtime',
        messageKind: 'human_message',
        toolCalls: [],
        finalUserText: debugResponse.finalUserText ?? debugResponse.text ?? null,
        debugSummary: debugResponse.debugSummary ?? null,
        auditPayload: debugResponse.auditPayload ?? null,
        taskId: taskMemory?.taskId ?? null,
        intentKey,
        role,
        messageElementCount: Array.isArray(messageContext?.usedElementKinds)
          ? messageContext.usedElementKinds.length
          : 0,
      },
    })
    await this.responseCommit(memoryTransaction)

    return {
      conversationId,
      scope,
      role,
      provider: this.provider.providerName,
      model: this.provider.modelName,
      text: debugResponse.text,
      finalUserText: debugResponse.finalUserText ?? debugResponse.text,
      debugSummary: debugResponse.debugSummary ?? null,
      auditPayload: debugResponse.auditPayload ?? null,
      toolCalls: [],
      needsHuman: roleConfig.type === 'customer',
      grounding: {
        grounded: false,
        fallbackReason,
        sourceCount: 0,
        sources: [],
      },
      memory: finalizedTask.memory,
      audit: {
        role,
        intentKey,
        roleResolutionMode: roleResolution.mode,
        blockedTools,
        executedTools: [],
        fallbackActivated: true,
        taskChanged: taskMemory.resetApplied,
        intentConfidence: intentDetection?.confidence ?? null,
        intentSource: intentDetection?.source ?? null,
        decisionPath: Array.isArray(decisionPath) ? decisionPath : [],
        messageElementsUsed: messageContext?.usedElementKinds ?? [],
        messageElements: messageContextAudit?.messageElements ?? [],
        messageContextOrigin: messageContextAudit?.messageContextOrigin ?? [],
        state: finalizedTask.memory.state,
        stateHistory: finalizedTask.memory.stateHistory,
        lastTransitionAt: finalizedTask.memory.lastTransitionAt,
        createdAt: new Date().toISOString(),
      },
    }
  }
}

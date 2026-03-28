import { buildSystemPrompt } from './prompt/system-prompt.js'
import { createModelProvider } from './model/provider-factory.js'
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
import { interpretMessageElements } from './message-elements/interpret-message-elements.js'
import { buildMessageContext } from './message-elements/build-message-context.js'
import { detectIntent } from './intents/detect-intent.js'
import { classifyInboundMessage } from './intents/classify-inbound-message.js'
import { classifyCustomerProtectedDataRequest } from './intents/customer-protected-data.js'
import { detectCustomerFaqSubtype } from './intents/customer-faq-heuristics.js'
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
  buildContextualProductReference,
  buildCustomerFaqKnowledgeResponse,
  buildGenericCustomerKnowledgeFallbackText,
} from './intents/customer-faq-response.js'
import {
  looksLikeCommercialConditionQuestion,
  looksLikeConfiguredProductInterest,
  looksLikeGenericPriceInquiry,
  looksLikeInformationExpansionRequest,
  looksLikeMaterialFollowUpRequest,
  looksLikeQuoteRequirementsQuestion,
  looksLikeQuoteWaitingFollowUp,
} from './intents/customer-intent-patterns.js'
import { normalizeCustomerTextForIntent } from './intents/customer-text-normalizer.js'
import {
  buildCustomerScheduleAppointmentPayload,
  buildCustomerScheduleCancellationText,
  buildCustomerScheduleConfirmationClarifyText,
  buildCustomerScheduleSearchWindow,
  findCustomerScheduleOverlap,
} from './intents/customer-schedule-resolution.js'
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
  buildCustomerCapabilityHandoffText,
  buildCustomerInformationThenHandoffText,
  buildCustomerMaterialFollowUpText,
  buildCustomerQuoteHandoffText,
  buildCustomerQuoteWaitingFollowUpText,
  buildCustomerQuoteResolutionText,
  buildCustomerScheduleCreatedText,
  buildCustomerScheduleUnavailableText,
  renderCustomerDeterministicText,
  renderExecutionOutcome,
  renderLightConversationText,
  renderOperationDraftOutcome,
  renderOutcomeText,
} from './outcomes/render-outcome.js'
import { pickWordingVariant } from './outcomes/wording-registry.js'

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

const formatPublicMoney = (currency, amount) => {
  if (!currency || typeof amount !== 'number' || !Number.isFinite(amount)) {
    return null
  }

  return `${String(currency).toUpperCase()} ${new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`
}

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
  /(ese mismo|esa misma|el mismo|la misma|mismo modelo|misma abertura|mismas caracteristicas|mismas características|ese modelo|esa abertura|ese producto|esa opcion|esa opción|puede venir|viene en|color negro|color blanco|incluye|tambien|también)/i.test(
    String(text || ''),
  )

const looksLikeAttachmentReference = (text) =>
  /(adjunto|archivo|pdf|imagen|captura|audio|voz|excel|planilla|csv|xlsx|foto|comprobante)/i.test(
    String(text || ''),
  )

const looksLikeScheduleContinuationInput = (text) =>
  /\b(hoy|mañana|pasado mañana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|\d{1,2}\/\d{1,2}(?:\/\d{4})?|a las\s+\d{1,2}(?::\d{2})?|\d{1,2}:\d{2}|despues de las|después de las|por la mañana|por la tarde|por la noche|direccion|dirección|ubicacion|ubicación|avenida|av\.|calle|ruta|telefono|teléfono|celular|whatsapp|mail|email|correo)\b/i.test(
    String(text || ''),
  )

const NON_QUOTE_CONTINUATION_FAQ_SUBTYPES = new Set([
  'business_hours',
  'location',
  'payment_methods',
  'contact',
  'maintenance',
  'benefits',
  'definition',
])

const SAFE_CUSTOMER_HYBRID_REWRITE_KEYS = new Set([
  'customer.quote.handoff_ready',
  'customer.schedule.progress.ask_day',
  'customer.schedule.progress.ask_time',
  'customer.schedule.progress.ask_address',
  'customer.schedule.progress.ask_contact',
  'customer.schedule.confirmation.day_known',
  'customer.schedule.confirmation.time_known',
  'customer.schedule.confirmation.address_missing',
  'customer.schedule.confirmation.full_missing',
  'customer.support.followup',
  'customer.product.info_offer',
  'customer.product.options_offer',
  'customer.fallback.material_followup',
  'customer.fallback.information_then_handoff',
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

const intentNamespace = (intentKey) => String(intentKey || '').split('.')[0] || 'other'

const isAdminConversationalRole = (role) =>
  String(role || '').startsWith('admin_') || role === 'superadmin'

const looksLikeAdminCapabilitiesRequest = (text) =>
  /\b(ayuda|help|que podes hacer|que pod(e|é)s hacer|como me podes ayudar|como me pod(e|é)s ayudar|en que me ayudas|en que pod(e|é)s ayudar|que acciones podes hacer|que gestiones podes resolver|que podes resolver)\b/i.test(
    String(text || ''),
  )

const looksLikeActionableLanguage = (text) =>
  /\b(crear|registrar|agendar|actualizar|editar|modificar|eliminar|borrar|cancelar|marcar|publicar|archivar|cotizar|presupuesto|pedido|pago|producto|cliente|abertura|categoria|categoría|stock)\b/i.test(
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

  const quoteContext =
    interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
      ? interpretation.quoteContext
      : null
  const hasMeasurements = Boolean(quoteContext?.measurements)
  const requiresMeasurements = Boolean(quoteContext?.requiresMeasurements)
  const missingFields = Array.isArray(quoteContext?.missingFields)
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

  return (
    looksLikeQuoteRequirementsQuestion(input) ||
    Boolean(quoteContext?.multiTopic) ||
    missingFields.length > 0 ||
    completionStatus === 'ready_for_handoff' ||
    (requiresMeasurements && !hasMeasurements) ||
    (hasMeasurements && !hasSpecificQuoteConfiguration)
  )
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

const deriveIntentKey = (role, input, actionIntent) => {
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
    if (/(abertura|aberturas|corrediza|batiente|dvh|monoblock|paño fijo|pano fijo)/.test(normalized)) {
      return 'aberturas.parse'
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
    series: typeof quoteContext.series === 'string' ? quoteContext.series : null,
    glass: typeof quoteContext.glass === 'string' ? quoteContext.glass : null,
    color: typeof quoteContext.color === 'string' ? quoteContext.color : null,
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
  if (toolName === 'parse_aberturas') {
    return results?.summary
      ? `parse_aberturas: ${results.summary}`
      : 'parse_aberturas: sin items detectados.'
  }

  if (toolName === 'prepare_aberturas_quote') {
    return results?.summary
      ? `prepare_aberturas_quote: ${results.summary}`
      : 'prepare_aberturas_quote: sin items listos para cotización.'
  }

  if (toolName === 'prepare_aberturas_insert') {
    return results?.summary
      ? `prepare_aberturas_insert: ${results.summary}`
      : 'prepare_aberturas_insert: sin items listos para alta.'
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
  if (toolName === 'parse_aberturas') {
    return typeof results?.summary === 'string'
      ? `parseo de aberturas: ${results.summary}`
      : null
  }

  if (toolName === 'prepare_aberturas_quote') {
    return typeof results?.summary === 'string'
      ? `borrador de aberturas: ${results.summary}`
      : null
  }

  if (toolName === 'prepare_aberturas_insert') {
    return typeof results?.summary === 'string'
      ? `alta de aberturas: ${results.summary}`
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
  const hasAberturasContext =
    /(abertura|aberturas|corrediza|batiente|dvh|monoblock|pano fijo|paño fijo)/.test(
      normalizedContext,
    )

  if (hasCreateVerb && hasAberturasContext) {
    return actionCatalog.find((entry) => entry?.key === 'aberturas.register') ?? null
  }

  if (hasQuoteVerb && hasAberturasContext) {
    return actionCatalog.find((entry) => entry?.key === 'aberturas.prepare_quote') ?? null
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

const extractDimensionToken = (input) => {
  const match = String(input || '').match(/\b(\d{2,4})\s*[xX]\s*(\d{2,4})\b/u)
  if (!match?.[1] || !match?.[2]) {
    return null
  }
  return `${match[1]}x${match[2]}`
}

const buildCustomerProductSearchQuery = (input) => {
  const dimensionToken = extractDimensionToken(input)
  if (dimensionToken) {
    return dimensionToken
  }

  const seriesToken = extractNamedEntity(String(input || ''), [
    /\bserie\s+([a-záéíóúñ0-9-]+)\b/iu,
    /\b(probba|gala(?:\s+cr)?|monoblock|screen|blackout|roller|corrediza|batiente|ventana|puerta)\b/iu,
  ])

  return normalizeEntityQuery(seriesToken || String(input || ''))
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

  getCustomerWordingOverrides() {
    return this.activeConfig?.customerWordingOverrides || null
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
  }) {
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
        grounded: false,
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
        customerCapabilityProfile:
          runtimeConfig.customerCapabilityProfile,
        customerContentMode: runtimeConfig.customerContentMode,
        customerCommerceMode: runtimeConfig.customerCommerceMode,
        customerSchedulingMode: runtimeConfig.customerSchedulingMode,
        customerWordingOverrides: runtimeConfig.customerWordingOverrides || null,
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
    effectiveSnapshot.updatedAt = at

    return {
      snapshot: effectiveSnapshot,
      memory: this.buildPublicMemoryState(taskMemory, effectiveSnapshot),
    }
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
      actionIntent.key === 'aberturas.register' ||
      actionIntent.key === 'aberturas.prepare_quote' ||
      actionIntent.key === 'aberturas.parse'
    ) {
      return {
        systemPrompt:
          'Separa cada abertura o item cotizable en una línea independiente y preserva solo los datos presentes: tipo, serie, color, vidrio, medidas y precio. No inventes datos faltantes ni mezcles atributos entre líneas.',
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

  async respond(unifiedMessage) {
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
    const tenantTopicTaxonomy =
      roleConfig.type === 'customer'
        ? await this.getTenantTopicTaxonomy(
            scopedBackendClient,
            unifiedMessage?.tenantKey,
            'customer_public',
          )
        : []
    const tenantQuoteProfiles =
      roleConfig.type === 'customer'
        ? await this.getTenantQuoteProfiles(
            scopedBackendClient,
            unifiedMessage?.tenantKey,
            'customer_public',
          )
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
      input: interpretedInput,
      recentTurns: recentReasoningTurns,
      pendingState: previousSnapshot?.taskState ?? snapshot?.taskState ?? null,
      tenantTopicTaxonomy,
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
    const initialIntentDetection = detectIntent({
      role,
      input: interpretedInput,
      actionCatalog: detectionActionCatalog,
      messageContext,
      inboundClassification,
      tenantTopicTaxonomy,
      nluAnalysis,
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
      nluAnalysis,
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
      previousTaskState: previousSnapshot?.taskState ?? snapshot?.taskState ?? null,
      referencedMessages: inferenceContext.referencedMessages,
      tenantTopicTaxonomy,
      tenantQuoteProfiles,
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
    const taskMemory = this.resolveTaskMemory(
      snapshot,
      conversationId,
      role,
      scope,
      turnInterpretation.currentTurnText || effectiveInput,
      actionIntent,
      intentDetection,
      turnInterpretation,
    )
    await this.memoryStore.replace(conversationId, taskMemory.snapshot)
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
      await this.memoryStore.replace(conversationId, finalizedTask.snapshot)

      const now = new Date().toISOString()
      await this.memoryStore.appendTurn(
        conversationId,
        {
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
        },
        scope,
        role,
      )
      await this.memoryStore.appendTurn(
        conversationId,
        {
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
        },
        scope,
        role,
      )

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
        grounding: {
          grounded: false,
          fallbackReason:
            typeof responseWithDebug?.grounding?.fallbackReason === 'string'
              ? responseWithDebug.grounding.fallbackReason
              : null,
          sourceCount: 0,
          sources: [],
        },
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
      ? { items: [], sources: [], sourceCount: 0 }
      : await this.getRetrievalContext(
          {
            ...unifiedMessage,
            text: turnInterpretation.retrievalQuery || reasoningInput,
          },
          role,
          scope,
          scopedBackendClient,
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
            tenantKey: unifiedMessage.tenantKey || null,
          })
    const deterministicKnowledgeResponse = this.buildDeterministicKnowledgeResponse({
      role,
      input: turnInterpretation.currentTurnText || reasoningInput,
      intentKey: taskMemory.intentKey,
      retrievalContext,
      interpretation: turnInterpretation,
      tenantTopicTaxonomy,
      variationSeed: customerVariationSeed,
    })
    const deterministicCustomerResponse = this.buildDeterministicCustomerResponse({
      role,
      input: turnInterpretation.currentTurnText || effectiveInput,
      intentKey: taskMemory.intentKey,
      inboundClassification,
      interpretation: turnInterpretation,
      tenantTopicTaxonomy,
      variationSeed: customerVariationSeed,
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

    if (deterministicResult?.response) {
      deterministicResult.response = await this.maybeRewriteGroundedCustomerResponse({
        role,
        intentKey: taskMemory.intentKey,
        input: turnInterpretation.currentTurnText || effectiveInput,
        response: deterministicResult.response,
        retrievalContext,
        runtimeConfig,
        interpretation: turnInterpretation,
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

    let generatedResponse
    let providerGenerationAttempted = false
    if ((!aiDecision.shouldCall || providerBlockedByCapability) && deterministicResult) {
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
          generatedResponse = await this.provider.generate({
            role,
            systemPrompt: buildSystemPrompt(role, {
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
            }),
            history,
            input: reasoningInput,
            tools,
            actionCatalog,
            retrievalContext: retrievalContext.items,
          })
        } catch (error) {
          const providerFailure = classifyProviderFailure(error)
          const fallbackReason = providerFailure.reason

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
    })
    const responseMetrics = this.buildConversationalMetrics({
      role,
      interpretation: turnInterpretation,
      inboundClassification,
      previousSnapshot,
      response: responseValidation.response,
      validation: responseValidation.validation,
      providerGenerationAttempted,
    })
    const annotatedResponse = this.appendAdminDebugSummary(
      this.annotateOperationalMatches(
        responseValidation.response,
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
        metrics: responseMetrics,
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
      responseValidation: responseValidation.validation,
      metrics: responseMetrics,
      createdAt: new Date().toISOString(),
    }
    const finalizedTask = this.applyTaskStateFromResponse(taskMemory, annotatedResponse)
    await this.memoryStore.replace(conversationId, finalizedTask.snapshot)

    const now = new Date().toISOString()
    await this.memoryStore.appendTurn(
      conversationId,
      {
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
      },
      scope,
      role,
    )
    await this.memoryStore.appendTurn(
      conversationId,
      {
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
      },
      scope,
      role,
    )

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
      grounding: {
        grounded:
          typeof annotatedResponse?.grounding?.grounded === 'boolean'
            ? annotatedResponse.grounding.grounded
            : retrievalContext.items.length > 0,
        fallbackReason:
          typeof annotatedResponse?.grounding?.fallbackReason === 'string'
              ? annotatedResponse.grounding.fallbackReason
            : annotatedResponse.needsHuman
              ? 'missing_approved_context'
              : providerGenerationAttempted &&
                  retrievalContext.items.length === 0 &&
                  (Array.isArray(annotatedResponse.toolCalls)
                    ? annotatedResponse.toolCalls.length === 0
                    : true) &&
                  annotatedResponse?.grounding?.grounded !== true
                ? 'missing_approved_context'
              : null,
        sourceCount: retrievalContext.items.length,
        sources: retrievalContext.items.map((item) => ({
          id: item.id,
          title: item.title,
          scope: item.scope,
          sourceType: item.sourceType,
          score:
            typeof item.score === 'number' && Number.isFinite(item.score)
              ? item.score
              : null,
        })),
      },
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

  async getRetrievalContext(unifiedMessage, role, scope, backendClient = this.backendClient) {
    const text = unifiedMessage.text?.trim() || ''
    if (text.length < 4) {
      return { items: [] }
    }

    try {
      const response = await backendClient.searchKnowledge(
        text,
        scopeForKnowledge(scope),
        role.startsWith('admin_') || role === 'superadmin' ? 6 : 4,
        unifiedMessage.tenantKey,
      )
      return response ?? { items: [] }
    } catch (error) {
      console.warn('[ai-agent-service] Unable to retrieve knowledge context', error)
      return { items: [] }
    }
  }

  async getOperationalContext(
    unifiedMessage,
    role,
    actionCatalog,
    backendClient = this.backendClient,
    resolvedActionIntent = null,
    resolvedIntentKey = null,
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
          if (
            entry.name === 'parse_aberturas' ||
            entry.name === 'prepare_aberturas_quote' ||
            entry.name === 'prepare_aberturas_insert'
          ) {
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

    const productTerm = extractNamedEntity(input, [
      /\bproducto\s+([a-záéíóúñ0-9 .'-]+?)(?=\s+(?:con|por|y|,|$))/iu,
      /\b\d+\s+((?:rollers?\s+(?:screen|blackout))(?:\s+[a-záéíóúñ0-9-]+){0,4})(?=\s*(?:,|$))/iu,
      /\b((?:rollers?\s+(?:screen|blackout)|roller\s+(?:screen|blackout)|persianas?(?:\s+[a-záéíóúñ0-9-]+){0,4}|toldos?(?:\s+[a-záéíóúñ0-9-]+){0,4}|aberturas?(?:\s+[a-záéíóúñ0-9-]+){0,4}))(?=\s+(?:de|con|por|para|,|$))/iu,
    ])

    if (!(role.startsWith('admin_') || role === 'superadmin')) {
      const customerIntent = resolvedIntentKey || 'customer.other'
      if (
        customerIntent === 'customer.quote' ||
        customerIntent === 'customer.product_info'
      ) {
        await queueSearch(
          'search_products',
          buildCustomerProductSearchQuery(productTerm || input),
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
      await queueSearch('search_products', productTerm || input)
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

    if (actionIntent.key === 'aberturas.parse') {
      try {
        const result = await backendClient.parseAberturas({
          text: input,
          source: 'admin_internal_chat',
        })
        executions.push({
          name: 'parse_aberturas',
          arguments: { text: input, source: 'admin_internal_chat' },
          result,
          status: 'executed',
        })
      } catch (error) {
        executions.push({
          name: 'parse_aberturas',
          arguments: { text: input, source: 'admin_internal_chat' },
          result: null,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'aberturas parse failed',
        })
      }
    }

    if (actionIntent.key === 'aberturas.register') {
      try {
        const result = await backendClient.prepareAberturasInsert({
          text: input,
          source: 'admin_internal_chat',
        })
        executions.push({
          name: 'prepare_aberturas_insert',
          arguments: { text: input, source: 'admin_internal_chat' },
          result,
          status: 'executed',
        })
      } catch (error) {
        executions.push({
          name: 'prepare_aberturas_insert',
          arguments: { text: input, source: 'admin_internal_chat' },
          result: null,
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'aberturas insert draft failed',
        })
      }
    }

    if (actionIntent.key === 'aberturas.prepare_quote') {
      try {
        const result = await backendClient.prepareAberturasQuote({
          text: input,
          source: 'admin_internal_chat',
        })
        executions.push({
          name: 'prepare_aberturas_quote',
          arguments: { text: input, source: 'admin_internal_chat' },
          result,
          status: 'executed',
        })
      } catch (error) {
        executions.push({
          name: 'prepare_aberturas_quote',
          arguments: { text: input, source: 'admin_internal_chat' },
          result: null,
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'aberturas quote draft failed',
        })
      }
    }

    return buildContextPayload()
  }

  annotateOperationalMatches(response, operationalContext, role) {
    if (
      !(role.startsWith('admin_') || role === 'superadmin') ||
      !Array.isArray(operationalContext?.matches) ||
      operationalContext.matches.length === 0 ||
      typeof response?.text !== 'string'
    ) {
      return response
    }

    if (/coincidencias encontradas|encontr[eé]|matches/i.test(response.text)) {
      return response
    }

    return {
      ...response,
      text: `Coincidencias encontradas: ${operationalContext.matches.join('; ')}.\n\n${response.text}`,
    }
  }

  applyGroundingFallback(input, role, retrievalContext, response) {
    const hasToolCalls = Array.isArray(response?.toolCalls) && response.toolCalls.length > 0
    const hasApprovedContext =
      Array.isArray(retrievalContext?.items) && retrievalContext.items.length > 0
    const normalized = (input || '').trim().toLowerCase()
    const safeDeterministicConversation =
      response?.debug?.actionKey === 'customer.light' ||
      response?.debug?.actionKey === 'customer.clarify_request' ||
      response?.debug?.actionKey === 'customer.rephrase_request' ||
      response?.debug?.actionKey === 'customer.unintelligible' ||
      response?.debug?.actionKey === 'customer.incomplete' ||
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
      actionIntent.key === 'aberturas.parse' ||
      actionIntent.key === 'aberturas.register'
    ) {
      for (const tool of tools) {
        if (tool.name === 'prepare_aberturas_quote') {
          blockedTools.push(tool.name)
          allowedNames.delete(tool.name)
        }
        if (actionIntent.key === 'aberturas.register' && tool.name === 'parse_aberturas') {
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

  buildAberturasRegisterDraft(actionIntent, operationalContext) {
    const insertDraft = this.getExecutedToolResult(
      operationalContext?.toolCalls,
      'prepare_aberturas_insert',
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
      intro: 'He preparado la alta al sistema de las aberturas detectadas.',
      sections: [
        {
          title: 'Listas para alta',
          items: readyItems.map((item) => {
            const price = item?.insertPayload?.salePrice ?? item?.price ?? null
            const currency =
              item?.insertPayload?.currency ?? item?.currency ?? null
            return `${item?.lineNumber || '?'}. ${item?.familyId || 'sin familia'} ${item?.serie || 'sin serie'} ${item?.widthMm || '?'}x${item?.heightMm || '?'}${currency && price != null ? ` ${currency} ${price}` : ''}`.trim()
          }),
        },
        {
          title: 'Pendientes',
          items: pendingItems.map((item) => {
            const missing = Array.isArray(item?.missingFields) && item.missingFields.length
              ? item.missingFields
              : [
                  item?.price == null ? 'price' : null,
                  !item?.currency ? 'currency' : null,
                ].filter(Boolean)
            return `${item?.lineNumber || '?'}. ${item?.familyId || 'sin familia'} ${item?.serie || 'sin serie'} ${item?.widthMm || '?'}x${item?.heightMm || '?'}: falta ${missing.join(', ') || 'revisión manual'}`
          }),
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
          successLabel: item.insertPayload?.name || `${item?.familyId || 'Abertura'} ${item?.serie || ''}`.trim(),
        })),
      },
      batchSuccessTitle: 'Alta ejecutada correctamente para los siguientes productos:',
      debugDetail: `Se usó prepare_aberturas_insert sobre el texto de entrada. Ítems listos: ${readyItems.length}. Ítems pendientes: ${pendingItems.length}.`,
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
      requestedToolRequiresConfirmation || actionIntent.key === 'aberturas.register'
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
    const effectiveIntentKey = intentKey
    if (
      !quoteContext ||
      effectiveIntentKey !== 'customer.quote' ||
      looksLikeCommercialConditionQuestion(input) ||
      String(quoteContext.completionStatus || '') !== 'ready_for_pricing_or_handoff'
    ) {
      return null
    }

    const commerceMode = this.getCustomerCapabilityMode('customer.quote')
    if (capabilityModeBlocksAutomaticResolution(commerceMode)) {
      return {
        text: buildCustomerQuoteHandoffText({
          subject:
            quoteContext?.topicLabel ||
            quoteContext?.familyLabel ||
            interpretation?.topic?.label ||
          interpretation?.contextTopic?.label ||
          'la configuración solicitada',
          variationSeed,
          wordingOverrides: this.getCustomerWordingOverrides(),
        }),
        toolCalls: [],
        needsHuman: true,
        grounding: {
          grounded: false,
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
      looksLikeQuoteWaitingFollowUp(input) &&
      (Boolean(quoteContext?.measurements) ||
        (Array.isArray(quoteContext?.measurementItems) &&
          quoteContext.measurementItems.length > 0) ||
        Number(quoteContext?.quantity?.total || 0) > 0)
    ) {
      return {
        text: buildCustomerQuoteWaitingFollowUpText({
          variationSeed,
          wordingOverrides: this.getCustomerWordingOverrides(),
        }),
        toolCalls: [],
        needsHuman: true,
        grounding: {
          grounded: false,
          fallbackReason: null,
          fallbackSubtype: 'quote_handoff',
        },
        debug: {
          actionKey: 'customer.quote',
          detail:
            'Se mantuvo el seguimiento de una cotización ya encaminada cuando el cliente indicó que espera el presupuesto, sin reabrir el intake ni recalcular el producto.',
        },
      }
    }

    const resolution = await resolveCustomerQuoteResolution({
      input,
      interpretation,
      operationalContext,
      backendClient,
      tenantKey,
      role,
    })
    if (!resolution) {
      return null
    }

    const text = buildCustomerQuoteResolutionText(resolution, {
      interpretation,
      tenantTopicTaxonomy,
      variationSeed,
      wordingOverrides: this.getCustomerWordingOverrides(),
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
          : 'Se capturó el intake completo, pero no se encontró un producto publicado con precio inmediato para esa configuración.'
    } else if (resolution.status === 'needs_handoff') {
      detail =
        resolution.detail === 'immediate_preview_unavailable'
          ? 'Se capturó el intake completo, pero el preview de pricing inmediato no pudo resolverse de forma confiable y se deriva a un asesor.'
          : resolution.detail === 'external_parametric_quote_required'
            ? 'Se capturó el intake completo de un producto paramétrico. No hay precio inmediato publicable y el caso se deriva para cotización externa o revisión humana.'
          : 'Se capturó el intake completo, pero el caso requiere derivación porque no existe precio inmediato confiable para responder en el acto.'
    }

    return {
      text,
      wordingKey: resolution.status === 'resolved' ? null : 'customer.quote.handoff_ready',
      toolCalls: [],
      needsHuman: resolution.status !== 'resolved',
      grounding: {
        grounded: false,
        fallbackReason: null,
        fallbackSubtype:
          resolution.status === 'resolved'
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
        wordingKey:
          resolution.status === 'resolved' ? null : 'customer.quote.handoff_ready',
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
    tenantKey = null,
  }) {
    if (
      !(role === 'customer_public' || role === 'customer_authenticated') ||
      !looksLikeCommercialConditionQuestion(input) ||
      !/\b(instalacion|instalación|colocacion|colocación)\b/i.test(String(input || ''))
    ) {
      return null
    }

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
    )

    let text = `La instalación para ${topicLabel} se confirma según el producto y el alcance del trabajo. Si querés, la dejamos considerada en la solicitud para que te lo confirmen con la cotización.`

    if (mode === 'INCLUDED') {
      text = `En principio, la instalación para ${topicLabel} queda contemplada en esta opción. De todos modos, el alcance final se confirma según el trabajo a realizar.`
    } else if (mode === 'OPTIONAL_ADD_ON') {
      text = `La instalación para ${topicLabel} puede agregarse como un servicio adicional. Si querés, la dejamos contemplada aparte dentro de la solicitud.`
    } else if (mode === 'SEPARATE_SERVICE') {
      text = `La instalación para ${topicLabel} se maneja como un servicio separado y se confirma según el alcance del trabajo. Si querés, la dejamos considerada en la solicitud.`
    } else if (mode === 'NOT_OFFERED') {
      text = `En principio, no tengo instalación incluida para ${topicLabel}. Si querés, un asesor puede confirmarte alternativas según el caso.`
    } else if (
      installation?.needsMeasurements ||
      preview?.needsConfiguration
    ) {
      text = `La instalación para ${topicLabel} se confirma según el producto y el alcance del trabajo. Si querés, pasame las medidas aproximadas y lo dejamos encaminado.`
    }

    if (
      pricePresentationMode === 'FROM_BASE' &&
      publicInstallationAmountLabel &&
      (mode === 'OPTIONAL_ADD_ON' || mode === 'SEPARATE_SERVICE' || mode === 'UNKNOWN')
    ) {
      text =
        mode === 'SEPARATE_SERVICE'
          ? `La instalación para ${topicLabel} se maneja como un servicio separado. Hoy se toma a partir de ${publicInstallationAmountLabel}, sujeto al alcance final del trabajo.`
          : `La instalación para ${topicLabel} puede agregarse como un servicio adicional. Hoy se maneja a partir de ${publicInstallationAmountLabel}, sujeto al alcance final del trabajo.`
    }

    return {
      text,
      toolCalls: [],
      needsHuman: false,
      grounding: {
        grounded: false,
        fallbackReason: null,
      },
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

    if (intentKey === 'customer.cancellation') {
      return {
        text: buildCustomerScheduleCancellationText(scheduleContext),
        toolCalls: [],
        needsHuman: false,
        grounding: {
          grounded: false,
          fallbackReason: null,
        },
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
      wordingOverrides: this.getCustomerWordingOverrides(),
    })
    if (confirmationClarifyText) {
      return {
        text: confirmationClarifyText,
        toolCalls: [],
        needsHuman: false,
        grounding: {
          grounded: false,
          fallbackReason: null,
        },
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
      return {
        text: buildCustomerCapabilityHandoffText({
          capability: 'scheduling',
          variationSeed,
          wordingOverrides: this.getCustomerWordingOverrides(),
        }),
        toolCalls: [],
        needsHuman: true,
        grounding: {
          grounded: false,
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
        return {
          text: buildCustomerScheduleUnavailableText({
            scheduleContext,
          }, {
            variationSeed,
            wordingOverrides: this.getCustomerWordingOverrides(),
          }),
          toolCalls,
          needsHuman: false,
          grounding: {
            grounded: false,
            fallbackReason: null,
          },
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

      return {
        text: buildCustomerScheduleCreatedText({
          scheduleContext,
          appointment,
        }, {
          variationSeed,
          wordingOverrides: this.getCustomerWordingOverrides(),
        }),
        toolCalls,
        needsHuman: false,
        grounding: {
          grounded: false,
          fallbackReason: null,
        },
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

      return {
        text: 'Perfecto. Ya tengo lo necesario para coordinar la visita técnica. Lo dejo en seguimiento para que un asesor confirme la disponibilidad y te responda a la brevedad.',
        toolCalls,
        needsHuman: true,
        grounding: {
          grounded: false,
          fallbackReason: null,
        },
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
    inboundClassification = null,
    interpretation = null,
    tenantTopicTaxonomy = [],
    variationSeed = '',
  }) {
    const effectiveIntentKey = intentKey
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

    if (
      !(role === 'customer_public' || role === 'customer_authenticated') ||
      ![
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
      ].includes(effectiveIntentKey)
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
      hasMixedThreadedQuoteProgress &&
      threadLabels.length > 1
    ) {
      const threadList =
        threadLabels.length === 2
          ? `${threadLabels[0]} y ${threadLabels[1]}`
          : `${threadLabels.slice(0, -1).join(', ')} y ${threadLabels.at(-1)}`

      return {
        text: `Perfecto. Veo que la solicitud mezcla ${threadList}. Como requieren una resolución distinta, dejo la cotización en seguimiento para que un asesor la revise completa y te responda a la brevedad.`,
        toolCalls: [],
        needsHuman: true,
        grounding: {
          grounded: false,
          fallbackReason: null,
        },
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
        grounding: {
          grounded: false,
          fallbackReason: null,
        },
        debug: {
          actionKey: effectiveIntentKey,
          detail:
            'Se devolvió una aclaración determinística para separar hilos conversacionales cuando el cliente mezcla más de un tema en el mismo turno.',
        },
      }
    }

    if (effectiveIntentKey === 'customer.product_info') {
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
      variationSeed,
      wordingOverrides: this.getCustomerWordingOverrides(),
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

    return {
      text,
      toolCalls: [],
      needsHuman: intentKey === 'customer.sensitive',
      grounding: {
        grounded: false,
        fallbackReason: null,
      },
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
        grounding: {
          grounded: true,
          fallbackReason: null,
        },
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
    retrievalContext,
    interpretation = null,
    tenantTopicTaxonomy = [],
    variationSeed = '',
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
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
      }) ||
      buildGenericCustomerKnowledgeFallbackText(intentKey, retrievalItems, input, {
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
      })
    if (!text) {
      return null
    }

    return {
      text,
      wordingKey: this.resolveCustomerHybridWordingKey({
        intentKey,
        interpretation,
      }),
      toolCalls: [],
      needsHuman: false,
      grounding: {
        grounded: true,
        fallbackReason: null,
      },
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
    const safeWordingKey = this.shouldApplySafeCustomerHybridRewrite({
      wordingKey,
      input,
    })

    const capabilityMode = this.getCustomerCapabilityMode(intentKey)
    if (capabilityModeBlocksProviderEnhancements(capabilityMode)) {
      return false
    }

    if (!safeWordingKey) {
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

    if (safeWordingKey) {
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
    const safeWordingKey = this.shouldApplySafeCustomerHybridRewrite({
      wordingKey,
      input,
    })
    const quota = await this.ensureProviderQuotaAvailable()
    if (!quota.allowed) {
      return response
    }

    const maxChars = Math.max(
      80,
      Math.min(400, Number(runtimeConfig.customerGroundedRewriteMaxChars || 220)),
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
      const rewritten = await this.provider.generate({
        role,
        systemPrompt: [
          safeWordingKey
            ? 'Reescribí una respuesta determinística de bajo riesgo para cliente final.'
            : 'Reescribí una respuesta ya grounded para cliente final.',
          safeWordingKey
            ? 'Conservá exactamente el sentido operativo del borrador y solo variá la redacción.'
            : 'Usá únicamente los hechos presentes en el borrador y en las fuentes aprobadas.',
          'No inventes datos, productos, horarios, ubicaciones, teléfonos, precios ni condiciones.',
          `Respondé en español, natural, breve y coherente, idealmente en 1 o 2 frases y dentro de ${maxChars} caracteres.`,
          'Si el borrador ya es correcto, devolvelo casi igual pero mejor redactado.',
        ].join(' '),
        history: [],
        input: [
          `Consulta original: ${String(input || '').trim()}`,
          wordingKey ? `Clave semántica segura: ${wordingKey}` : null,
          `Borrador grounded: ${String(response?.text || '').trim()}`,
          retrievalItems.length
            ? ['Fuentes aprobadas usadas:', sources].join('\n\n')
            : null,
        ]
          .filter(Boolean)
          .join('\n\n'),
        tools: [],
      })

      const rewrittenText = String(rewritten?.text || '')
        .replace(/\s+/g, ' ')
        .trim()

      if (!rewrittenText) {
        return response
      }

      return {
        ...response,
        text: rewrittenText,
        finalUserText: rewrittenText,
        grounding: {
          ...(response?.grounding || {}),
          rewriteApplied: true,
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
            ? `${response.debug.detail} Se aplicó una reescritura grounded opcional para mejorar naturalidad sin cambiar la base factual.`
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
  ) {
    const label = compactText(topic?.label || '')
    if (!label || !/^product_/.test(String(topic?.type || ''))) {
      return null
    }

    const displayLabel =
      buildContextualProductReference({
        requestedTopicLabel: label,
        topicLabel: label,
        tenantTopicTaxonomy,
      }) || label

    const wordingKey =
      String(topic?.type || '') === 'product_family'
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
      grounding: {
        grounded: true,
        fallbackReason: null,
      },
      debug: {
        actionKey: intentKey,
        wordingKey,
        detail:
          'Se devolvió una respuesta canónica basada en el tópico interpretado para evitar fuga literal de knowledge.',
      },
    }
  }

  detectRawKnowledgeLeak({ responseText, retrievalContext }) {
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

    const suspiciousResponse =
      /[|·]/.test(responseText) ||
      /\b(catalogo|catálogo|preguntas frecuentes|menu|inicio|urucortinas)\b/i.test(
        responseText,
      ) ||
      (((responseText.match(/,/g) || []).length >= 3) &&
        /\b(roller|venecianas|persianas|automatizacion|automatización|aberturas|dvh|screen|blackout)\b/i.test(
          responseText,
        ))

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
    const stableText = compactText(nextResponse?.finalUserText || nextResponse?.text || '')

    if (canValidateKnowledge) {
      const rawSnippetLeakDetected = this.detectRawKnowledgeLeak({
        responseText: stableText,
        retrievalContext,
      })
      if (rawSnippetLeakDetected) {
        validation.applied = true
        validation.rawSnippetLeakDetected = true
        validation.issues.push('raw_knowledge_leak')
        const deterministicKnowledgeResponse =
          (intentKey === 'customer.quote'
            ? this.buildDeterministicCustomerResponse({
                role,
                input,
                intentKey,
                inboundClassification,
                interpretation,
                tenantTopicTaxonomy,
              })
            : null) ||
          this.buildCanonicalTopicGuardResponse(
            intentKey,
            interpretation?.topic,
            tenantTopicTaxonomy,
          ) ||
          this.buildDeterministicKnowledgeResponse({
            role,
            input,
            intentKey,
            retrievalContext,
            interpretation,
            tenantTopicTaxonomy,
          }) ||
          this.buildCustomerKnowledgeFallbackResponse({
            role,
            intentKey,
            input,
            retrievalContext,
            fallbackReason: null,
            interpretation,
            tenantTopicTaxonomy,
          })
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
        const deterministicKnowledgeResponse =
          (intentKey === 'customer.quote'
            ? this.buildDeterministicCustomerResponse({
                role,
                input,
                intentKey,
                inboundClassification,
                interpretation,
                tenantTopicTaxonomy,
              })
            : null) ||
          this.buildCanonicalTopicGuardResponse(
            intentKey,
            interpretation?.topic,
            tenantTopicTaxonomy,
          ) ||
          this.buildDeterministicKnowledgeResponse({
            role,
            input,
            intentKey,
            retrievalContext,
            interpretation,
            tenantTopicTaxonomy,
          }) ||
          this.buildCustomerKnowledgeFallbackResponse({
            role,
            intentKey,
            input,
            retrievalContext,
            fallbackReason: null,
            interpretation,
            tenantTopicTaxonomy,
          })
        if (deterministicKnowledgeResponse) {
          validation.adjusted = true
          nextResponse = this.appendValidationDetail(
            deterministicKnowledgeResponse,
            `Se rearmó la respuesta para mantener continuidad con el tópico "${interpretation?.topic?.label || 'actual'}".`,
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
  }) {
    const previousAuditPayload = this.getLastAgentAuditPayload(previousSnapshot)
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
    const isCustomerRole =
      role === 'customer_public' || role === 'customer_authenticated'

    return {
      followUpDetected,
      followUpFallback: followUpDetected && responseActivatesFallback(response),
      followUpResolvedWithoutProvider:
        followUpDetected &&
        !providerGenerationAttempted &&
        response?.grounding?.rewriteApplied !== true &&
        !responseActivatesFallback(response),
      intentInherited: Boolean(interpretation?.intent?.inherited),
      rawSnippetLeakDetected: Boolean(validation?.rawSnippetLeakDetected),
      groundedRewriteApplied: Boolean(response?.grounding?.rewriteApplied),
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
        return 'Puedo ayudarte con clientes, presupuestos y cotización de aberturas. También puedo dejar listos envíos, confirmaciones y cambios de estado de presupuestos con validación previa.'
      case 'admin_operations':
        return 'Puedo ayudarte con productos, categorías, pedidos, pagos y altas de aberturas. Si la acción modifica datos, primero te muestro un borrador y luego ejecuto con tu confirmación.'
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
      actionKey: context?.actionKey || previousAuditPayload?.actionKey || null,
      input:
        String(context?.input || '').slice(0, 240) ||
        previousAuditPayload?.input ||
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
              scheduleContext: sanitizeScheduleContextForAudit(
                context.turnInterpretation.scheduleContext,
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
              clarificationRequested: Boolean(
                context.metrics.clarificationRequested,
              ),
              clarificationResolved: Boolean(
                context.metrics.clarificationResolved,
              ),
            }
          : previousAuditPayload?.metrics ?? null,
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
    variationSeed = '',
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
      return {
        text: buildCustomerMaterialFollowUpText({
          subject,
          variationSeed,
          wordingOverrides: this.getCustomerWordingOverrides(),
        }),
        wordingKey: 'customer.fallback.material_followup',
        toolCalls: [],
        needsHuman: false,
        grounding: {
          grounded: false,
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
      return {
        text: buildCustomerInformationThenHandoffText({
          subject,
          variationSeed,
          wordingOverrides: this.getCustomerWordingOverrides(),
        }),
        wordingKey: 'customer.fallback.information_then_handoff',
        toolCalls: [],
        needsHuman: false,
        grounding: {
          grounded: false,
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
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
      }) ||
      buildGenericCustomerKnowledgeFallbackText(intentKey, retrievalItems, input, {
        variationSeed,
        wordingOverrides: this.getCustomerWordingOverrides(),
      })
    if (!text) {
      return null
    }

    return {
      text,
      wordingKey: this.resolveCustomerHybridWordingKey({
        intentKey,
        interpretation,
      }),
      toolCalls: [],
      needsHuman: false,
      grounding: {
        grounded: true,
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
      lines.push(
        'Si quieres, un asesor puede continuar contigo para confirmar medidas, vidrio y disponibilidad antes de cerrar la cotización.',
      )
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
        grounded: true,
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
      case 'buildAberturasRegisterDraft':
        return this.buildAberturasRegisterDraft(actionIntent, operationalContext)
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
        entry?.name === 'prepare_aberturas_insert' &&
        entry?.status === 'executed' &&
        entry?.result?.itemCount,
    )?.result

    if (pendingIntentKey === 'aberturas.register' && insertDraft) {
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
            actionKey: 'aberturas.register.confirm',
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
          actionKey: 'aberturas.register.confirm',
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
  ) {
    const now = new Date().toISOString()
    const previousTaskState = snapshot?.taskState ?? null
    const previousIntentKey = previousTaskState?.intentKey || null
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
    const previousConversationThreads = Array.isArray(previousTaskState?.conversationThreads)
      ? previousTaskState.conversationThreads
      : []
    const previousActiveThreadKey =
      typeof previousTaskState?.activeThreadKey === 'string'
        ? previousTaskState.activeThreadKey
        : null
    let currentIntentKey =
      intentDetection?.intent || deriveIntentKey(role, input, actionIntent)
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
    const currentTurnTextForQuoteContinuation =
      turnInterpretation?.currentTurnText || input || ''
    const quoteContinuationFaqSubtype =
      String(currentIntentKey || '') === 'customer.topic_info'
        ? detectCustomerFaqSubtype(currentTurnTextForQuoteContinuation)
        : null
    const quoteContinuationBlockedByFaq =
      String(currentIntentKey || '') === 'customer.topic_info' &&
      (NON_QUOTE_CONTINUATION_FAQ_SUBTYPES.has(quoteContinuationFaqSubtype) ||
        looksLikeCommercialConditionQuestion(currentTurnTextForQuoteContinuation) ||
        explicitResetRequested(currentTurnTextForQuoteContinuation))
    const measurementPromotableCustomerIntents = new Set([
      'customer.product_info',
      'customer.price_inquiry',
      'customer.topic_info',
      'customer.other',
      'unknown',
    ])
    const currentTurnCarriesQuoteSignal = hasCurrentTurnQuoteSignal({
      currentTurnText: currentTurnTextForQuoteContinuation,
      currentQuoteContext,
      previousQuoteContext,
    })
    const hasMeasurementDrivenTurnSignal =
      Boolean(currentQuoteContext?.measurements) &&
      Boolean(
        currentQuoteContext?.measurements?.widthMm !==
          previousQuoteContext?.measurements?.widthMm ||
          currentQuoteContext?.measurements?.heightMm !==
            previousQuoteContext?.measurements?.heightMm ||
          currentQuoteContext?.quantity?.total !== previousQuoteContext?.quantity?.total ||
          looksLikeShortContextualFollowUp(currentTurnTextForQuoteContinuation) ||
          currentTurnCarriesQuoteSignal,
      )
    const shouldPromoteMeasurementProgressToQuote =
      (role === 'customer_public' || role === 'customer_authenticated') &&
      measurementPromotableCustomerIntents.has(String(currentIntentKey || '')) &&
      hasMeasurementDrivenTurnSignal &&
      !quoteContinuationBlockedByFaq &&
      Boolean(
        currentQuoteContext?.requiresMeasurements ||
          previousQuoteContext?.requiresMeasurements ||
          (turnInterpretation?.followUp?.detected &&
            (currentCanonicalTopic?.label || previousCanonicalTopic?.label)),
      )

    if (shouldPromoteMeasurementProgressToQuote) {
      currentIntentKey = 'customer.quote'
    }

    const quoteContinuationPromotableCustomerIntents = new Set([
      'customer.product_info',
      'customer.topic_info',
      'customer.price_inquiry',
      'customer.other',
      'unknown',
    ])
    const shouldKeepCurrentIntentOutsideQuote = quoteContinuationBlockedByFaq
    const quoteProgressChanged =
      Boolean(currentQuoteContext) &&
      (currentQuoteContext?.topicLabel !== previousQuoteContext?.topicLabel ||
        currentQuoteContext?.familyLabel !== previousQuoteContext?.familyLabel ||
        currentQuoteContext?.completionStatus !== previousQuoteContext?.completionStatus ||
        currentQuoteContext?.measurements?.widthMm !==
          previousQuoteContext?.measurements?.widthMm ||
        currentQuoteContext?.measurements?.heightMm !==
          previousQuoteContext?.measurements?.heightMm ||
        currentQuoteContext?.quantity?.total !== previousQuoteContext?.quantity?.total ||
        (Array.isArray(currentQuoteContext?.missingFields)
          ? currentQuoteContext.missingFields.join('|')
          : '') !==
          (Array.isArray(previousQuoteContext?.missingFields)
            ? previousQuoteContext.missingFields.join('|')
            : ''))
    const hasExplicitQuoteContinuationTurnSignal =
      currentTurnCarriesQuoteSignal ||
      looksLikeCustomerFollowUp(currentTurnTextForQuoteContinuation)
    const hasQuoteContinuationSignal =
      Boolean(currentQuoteContext) &&
      Boolean(
        quoteProgressChanged ||
          hasExplicitQuoteContinuationTurnSignal ||
          turnInterpretation?.followUp?.detected,
      )
    const shouldPromoteQuoteContinuation =
      (role === 'customer_public' || role === 'customer_authenticated') &&
      previousIntentKey === 'customer.quote' &&
      quoteContinuationPromotableCustomerIntents.has(String(currentIntentKey || '')) &&
      !shouldKeepCurrentIntentOutsideQuote &&
      hasQuoteContinuationSignal

    if (shouldPromoteQuoteContinuation) {
      currentIntentKey = 'customer.quote'
    }

    const shouldDemoteStaleQuoteCarryOverToProductInfo =
      (role === 'customer_public' || role === 'customer_authenticated') &&
      currentIntentKey === 'customer.quote' &&
      intentDetection?.intent === 'customer.product_info' &&
      previousIntentKey !== 'customer.quote' &&
      !quoteContinuationBlockedByFaq &&
      !currentTurnCarriesQuoteSignal &&
      !turnInterpretation?.followUp?.detected &&
      Boolean(
        currentQuoteContext?.measurements || Number(currentQuoteContext?.quantity?.total || 0) > 0,
      )

    if (shouldDemoteStaleQuoteCarryOverToProductInfo) {
      currentIntentKey = 'customer.product_info'
    }

    const scheduleContinuationPromotableCustomerIntents = new Set([
      'customer.other',
      'unknown',
      'customer.light',
      'customer.clarify_request',
      'customer.product_info',
      'customer.topic_info',
      'customer.contact_info',
      'customer.quote',
    ])
    const currentTurnTextForScheduleContinuation =
      turnInterpretation?.currentTurnText || input || ''
    const scheduleProgressChanged =
      Boolean(currentScheduleContext) &&
      (currentScheduleContext?.startAt !== previousScheduleContext?.startAt ||
        currentScheduleContext?.address !== previousScheduleContext?.address ||
        currentScheduleContext?.contactPhone !== previousScheduleContext?.contactPhone ||
        currentScheduleContext?.contactEmail !== previousScheduleContext?.contactEmail ||
        currentScheduleContext?.date?.dateLabel !== previousScheduleContext?.date?.dateLabel ||
        currentScheduleContext?.time?.timeLabel !== previousScheduleContext?.time?.timeLabel)
    const hasScheduleContinuationSignal =
      Boolean(currentScheduleContext) &&
      (scheduleProgressChanged ||
        looksLikeScheduleContinuationInput(currentTurnTextForScheduleContinuation))
    const shouldPromoteScheduleContinuation =
      (role === 'customer_public' || role === 'customer_authenticated') &&
      (previousIntentKey === 'customer.schedule_request' ||
        Boolean(previousScheduleContext)) &&
      scheduleContinuationPromotableCustomerIntents.has(String(currentIntentKey || '')) &&
      !explicitResetRequested(currentTurnTextForScheduleContinuation) &&
      hasScheduleContinuationSignal

    if (shouldPromoteScheduleContinuation) {
      currentIntentKey = 'customer.schedule_request'
    }

    const shouldCarryQuoteTopicFromMemory =
      (role === 'customer_public' || role === 'customer_authenticated') &&
      previousIntentKey === 'customer.quote' &&
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

    if (
      !(role.startsWith('admin_') || role === 'superadmin') &&
      previousIntentKey &&
      isGenericCustomerIntentKey(currentIntentKey) &&
      (turnInterpretation?.followUp?.detected ||
        looksLikeCustomerFollowUp(input) ||
        looksLikeShortContextualFollowUp(input) ||
        looksLikeContextualReference(input))
    ) {
      currentIntentKey = previousIntentKey
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

    const normalizedTurnForScheduleConfirmation = normalizeText(
      currentTurnTextForScheduleContinuation,
    )
    const shouldRestoreScheduleConfirmationIntent =
      (role === 'customer_public' || role === 'customer_authenticated') &&
      Boolean(previousScheduleContext) &&
      Boolean(currentScheduleContext) &&
      !explicitResetRequested(currentTurnTextForScheduleContinuation) &&
      /^(si|sí|dale|ok|perfecto|confirmo|listo)$/i.test(
        normalizedTurnForScheduleConfirmation,
      )
    const shouldRestoreScheduleCancellationIntent =
      (role === 'customer_public' || role === 'customer_authenticated') &&
      Boolean(previousScheduleContext) &&
      Boolean(currentScheduleContext) &&
      !explicitResetRequested(currentTurnTextForScheduleContinuation) &&
      /^(no|no eso no|mejor no|cancelar|dejalo|déjalo|dejemos eso|eso no)$/i.test(
        normalizedTurnForScheduleConfirmation,
      )

    if (shouldRestoreScheduleConfirmationIntent) {
      currentIntentKey = 'customer.confirmation'
    } else if (shouldRestoreScheduleCancellationIntent) {
      currentIntentKey = 'customer.cancellation'
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
          ((currentNamespace === 'aberturas' || previousNamespace === 'aberturas') &&
            overlap < 0.18 &&
            currentTopicTokens.length > 0)
      } else {
        shouldReset =
          previousIntentKey !== currentIntentKey &&
          overlap < 0.12 &&
          currentIntentKey !== 'customer.light'

        if (preserveProductThreadOnBusinessFaq) {
          shouldReset = false
        }
      }
    }

    if (
      shouldReset &&
      !(
        turnInterpretation?.quoteContext &&
        typeof turnInterpretation.quoteContext === 'object'
      )
    ) {
      currentQuoteContext = null
      currentScheduleContext = null
      currentConversationThreads = []
      currentActiveThreadKey = null
    }

    const taskId = shouldReset
      ? `${conversationId}:${Date.now()}`
      : previousTaskState?.taskId || `${conversationId}:1`

    const nextSnapshot = snapshot ?? {
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
      state: detectedState.state,
      stateHistory: detectedState.stateHistory,
      lastTransitionAt: detectedState.lastTransitionAt,
      topicTokens: currentTopicTokens,
      canonicalTopic: currentCanonicalTopic,
      quoteContext: currentQuoteContext,
      scheduleContext: currentScheduleContext,
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
      taskSummary,
      currentTask,
      canonicalTopic: currentCanonicalTopic,
      quoteContext: currentQuoteContext,
      scheduleContext: currentScheduleContext,
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
    await this.memoryStore.replace(conversationId, finalizedTask.snapshot)

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

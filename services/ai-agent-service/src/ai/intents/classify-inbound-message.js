import {
  extractRequestedTopicLabel,
  looksLikeCustomerContactQuestion,
  looksLikeCustomerTopicQuestion,
  looksLikeCustomerUnintelligibleText,
} from './customer-faq-heuristics.js'
import {
  looksLikeGenericPriceInquiry,
  looksLikeInstalledReplacementAssessmentRequest,
  looksLikeQuoteExpansionFollowUp,
  looksLikeStructuredQuoteSeed,
  looksLikePaymentProofArtifact,
  looksLikePaymentOperationalUpdate,
  looksLikePaymentProofFollowUpRequest,
  looksLikeQuoteRequirementsQuestion,
} from './customer-intent-patterns.js'
import {
  looksLikeCustomerScheduleAvailabilityRequest,
  looksLikeCustomerSupportServiceRequest,
} from './customer-operational-heuristics.js'
import { classifyCustomerProtectedDataRequest } from './customer-protected-data.js'
import {
  findBestTenantTopicMatch,
  hasTenantTopicSignal,
} from './customer-topic-taxonomy.js'
import { normalizeCustomerTextForIntent } from './customer-text-normalizer.js'
import {
  detectStandaloneAttachmentArtifactKind,
  hasMultimodalPlaceholderSignal,
  looksLikeOpeningStructureSignal,
  hasScheduleAdministrativeSignal,
  normalizeSemanticText,
} from './customer-semantic-signals.js'

const normalizeText = normalizeSemanticText
const DIMENSION_PAIR_REGEX = /\b\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\b/u
const MULTIMODAL_PLACEHOLDER_PHRASE_REGEX =
  /\b(?:multimedia omitido|imagen omitida|audio omitido|video omitido)\b/gu
const WEB_LEAD_INTRO_ONLY_REGEX =
  /^(?:hola|buen dia|buenos dias|buenas tardes|buenas noches)?\s*(?:[,!:.-]\s*)?(?:te contacto|te escribo|me contacto)\s+desde\s+la\s+web(?:\s+de\s+urucortinas)?\s*:?\s*$/iu

const looksLikeInstallationQuoteContext = (normalizedInput) =>
  /\b(cotiz\w*|presupuest\w*|precio|precios|costo|costos|valor|importe)\b/u.test(
    normalizedInput,
  ) &&
  /\b(instalacion|instalación|colocacion|colocación|colocar)\b/u.test(normalizedInput) &&
  (DIMENSION_PAIR_REGEX.test(normalizedInput) ||
    /\b(ventana|ventanas|abertura|aberturas|marco|marcos|guia|gu[ií]a|guias|gu[ií]as)\b/u.test(
      normalizedInput,
    ))

const looksLikeOpeningInstallationAssessmentContext = (normalizedInput) => {
  const hasRelevantProduct =
    /\b(cortina|cortinas|persiana|persianas|ventana|ventanas|abertura|aberturas)\b/u.test(
      normalizedInput,
    )
  const hasOpeningContext =
    looksLikeOpeningStructureSignal(normalizedInput) ||
    /\b(marco|marcos|guia|gu[ií]a|guias|gu[ií]as|ventana|ventanas|abertura|aberturas)\b/u.test(
      normalizedInput,
    )
  const hasInstallationAssessmentSignal =
    /\b(superficie|exterior|colocar|colocacion|colocación|instalacion|instalación|uniforme|lisa)\b/u.test(
      normalizedInput,
    )
  const hasRepairSignal =
    /\b(repar\w*|service|servicio|ajust\w*|arregl\w*|romp\w*|tranc\w*|fall\w*|mantenimiento)\b/u.test(
      normalizedInput,
    )

  return (
    hasRelevantProduct &&
    hasOpeningContext &&
    hasInstallationAssessmentSignal &&
    !hasRepairSignal
  )
}

const stripMultimodalPlaceholderPhrases = (value) =>
  normalizeText(value).replace(MULTIMODAL_PLACEHOLDER_PHRASE_REGEX, '').trim()

const looksLikeRawNoiseInput = (value) => {
  const rawInput = String(value || '').trim()
  if (rawInput.length <= 1) {
    return false
  }

  return /^[!?@#$%^&*()_+\-=\[\]{};:'",.<>/\\|`~\s]+$/u.test(rawInput)
}

export const INBOUND_MESSAGE_CATEGORIES = [
  'greeting',
  'courtesy',
  'confirmation',
  'cancellation',
  'generic_help_request',
  'clarification_request',
  'incomplete',
  'noise',
  'unintelligible',
  'faq_topic',
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
  'actionable_intent',
  'other',
]

const CUSTOMER_SCOPE_KEYS = new Set(['customer_public', 'customer_authenticated'])

const CUSTOMER_GENERIC_DOMAIN_TERMS =
  /\b(horario|ubicacion|direccion|medios de pago|formas de pago|transferencia|tarjeta|efectivo|envio|entrega|pedido|presupuesto|cotizacion|precio|precios|medida|medidas|visita|cita|showroom|soporte|reclamo|telefono|teléfono|whatsapp|contacto|service|servicio|reparacion|reparación|instalacion|instalación|coordinar|disponibilidad|producto|productos|servicio|servicios|modelo|linea|línea|variante|version|versión)\b/

const ACTIONABLE_HINTS =
  /\b(cotiz|presupuesto|precio|precios|pedido|orden|envio|entrega|agendar|agenda|visita|cita|comprar|quiero una|quiero uno|medida|medidas|soporte|reclamo|problema|service|repar|instalacion|instalación|coordinar|disponibilidad)\b/

const CONTACT_PATTERNS = [
  /\b(tienen telefono|tienen teléfono|tienen whatsapp|numero de contacto|número de contacto|datos de contacto|telefono|teléfono|whatsapp|llamar|comunicarme|comunicarse|hablar con alguien)\b/,
]

const GENERIC_HELP_PATTERNS = [
  /\b(info|informacion|consulta|consultar|quiero saber|quisiera saber|necesito saber|me ayudas|me ayuda|ayuda|necesito ayuda)\b/,
]

const INCOMPLETE_PATTERNS = [
  /^(quiero|necesito|preciso|quisiera|busco|me interesa)$/u,
  /^(quiero|necesito|preciso|quisiera)\s+(eso|esto)$/u,
  /^(me interesa|busco)\s+(eso|esto)$/u,
  /^(quiero|necesito|preciso|quisiera|busco|me interesa)\s+algo$/u,
]

const COURTESY_PATTERNS = [
  /^(gracias|muchas gracias|genial|excelente)$/u,
  /^(ok|dale|perfecto|entendido|listo)$/u,
  /^(no es necesario|no hace falta|no gracias)(?:\s+gracias)?$/u,
]

const CONFIRMATION_PATTERNS = [
  /^(si|sí|si dale|sí dale|dale|perfecto|ok|confirmo|confirmar|listo)$/u,
]

const CANCELLATION_PATTERNS = [
  /^(no|no eso no|mejor no|cancelar|dejalo|déjalo|dejemos eso|eso no)$/u,
]

const GREETING_PATTERNS = [
  /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches)$/u,
  /^(hola\s+)?(buen dia|buenos dias|buenas tardes|buenas noches)(\s+(como estas|como andas|que tal))?$/u,
  /^(hola\s+)?(que tal|como estas|como andas)$/u,
  /^(como estas|como andas|estas ahi)$/u,
]

const NOISE_PATTERNS = [
  /^[!?@#$%^&*()_+\-=\[\]{};:'",.<>/\\|`~\s]+$/u,
  /^([a-z0-9])\1{6,}$/u,
]

const SENSITIVE_PATTERNS = [
  /\b(muy molesto|muy enojado|muy enojada|indignado|indignada|furioso|furiosa|nadie me responde|pesimo servicio|p[eé]simo servicio|quiero hablar con un responsable|esto es una estafa|voy a denunciar|reclamo formal|queja formal)\b/,
]

const FRUSTRATION_PATTERNS = [
  /\b(esto no funciona nunca|ya intente todo y no anda|ya intent[eé] todo y no anda|sigue sin funcionar|otra vez lo mismo)\b/,
]

const CLARIFICATION_PATTERNS = [
  /^(no entiendo|no entendi|no entend[ií]|no comprendo|no me queda claro|no lo entiendo)$/u,
]

const OUT_OF_SCOPE_PATTERNS = [
  /\b(quien gano|quien ganó|elecciones|presidente|politica|pol[ií]tica|clima|temperatura|lluvia|receta|cocinar|futbol|fútbol|partido|clasico|cl[aá]sico|horoscopo|hor[oó]scopo)\b/,
]

const MULTI_INTENT_CONNECTORS = /\b(y|y tambien|y también|ademas|adem[aá]s|por otro lado|tambien|tambi[eé]n)\b/

const MULTI_INTENT_BUCKETS = [
  {
    key: 'appointment',
    label: 'la visita',
    pattern: /\b(agendar|agenda|coordinar|programar|visita|cita|showroom)\b/,
  },
  {
    key: 'pricing',
    label: 'los precios',
    pattern: /\b(precio|precios|cotizacion|cotización|presupuesto|cuanto sale|cu[aá]nto sale)\b/,
  },
  {
    key: 'order_status',
    label: 'el pedido',
    pattern: /\b(pedido|orden|seguimiento|estado del pedido|envio|envío|entrega)\b/,
  },
  {
    key: 'support',
    label: 'el soporte',
    pattern: /\b(soporte|problema|reclamo|no funciona|garantia|garant[ií]a)\b/,
  },
  {
    key: 'business_info',
    label: 'la información general',
    pattern: /\b(horario|ubicacion|ubicación|direccion|dirección|medios de pago|formas de pago)\b/,
  },
  {
    key: 'contact',
    label: 'el contacto',
    pattern: /\b(telefono|teléfono|whatsapp|contacto|llamar|hablar con alguien|comunicarme|comunicarse)\b/,
  },
  {
    key: 'general_help',
    label: 'tu consulta',
    pattern: /\b(info|informacion|consulta|consultar|ayuda|quiero saber|necesito ayuda)\b/,
  },
]

const isCustomerRole = (role) => CUSTOMER_SCOPE_KEYS.has(String(role || ''))

const buildClassification = ({
  category,
  confidence,
  suggestedIntent = null,
  decisionPath = [],
  focusAreas = [],
  documentType = null,
  identifier = null,
  requestType = null,
}) => ({
  category: INBOUND_MESSAGE_CATEGORIES.includes(category) ? category : 'other',
  confidence:
    typeof confidence === 'number' && Number.isFinite(confidence)
      ? Math.max(0, Math.min(1, confidence))
      : 0,
  suggestedIntent: suggestedIntent || null,
  decisionPath: Array.isArray(decisionPath) ? decisionPath.filter(Boolean) : [],
  focusAreas: Array.isArray(focusAreas)
    ? focusAreas
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => ({
          key: typeof entry.key === 'string' ? entry.key : null,
          label: typeof entry.label === 'string' ? entry.label : null,
        }))
        .filter((entry) => entry.key && entry.label)
    : [],
  documentType: typeof documentType === 'string' ? documentType : null,
  identifier:
    typeof identifier === 'string' && identifier.trim() ? identifier.trim() : null,
  requestType: typeof requestType === 'string' ? requestType : null,
})

const detectMultiIntentAreas = (normalizedInput) =>
  MULTI_INTENT_BUCKETS.filter((entry) => entry.pattern.test(normalizedInput)).map(
    ({ key, label }) => ({ key, label }),
  )

const countRepeatedCustomerTurns = (
  normalizedInput,
  recentTurns = [],
  tenantTopicTaxonomy = [],
) => {
  if (!normalizedInput || !Array.isArray(recentTurns) || !recentTurns.length) {
    return 0
  }

  let count = 0
  for (let index = recentTurns.length - 1; index >= 0; index -= 1) {
    const turn = recentTurns[index]
    if (!turn) {
      continue
    }

    if (!['customer', 'user'].includes(String(turn.role || ''))) {
      continue
    }

    const normalizedTurn = normalizeCustomerTextForIntent(turn.text, {
      tenantTopicTaxonomy,
    }).normalizedInput
    if (normalizedTurn !== normalizedInput) {
      break
    }
    count += 1
  }

  return count
}

const looksLikeScheduleAdministrativeFollowUp = (
  normalizedInput,
  recentTurns = [],
) => {
  if (!normalizedInput || !Array.isArray(recentTurns) || !recentTurns.length) {
    return false
  }

  const hasAdministrativeSignal = hasScheduleAdministrativeSignal(normalizedInput)

  if (!hasAdministrativeSignal) {
    return false
  }

  const recentWindow = recentTurns.slice(-4)
  return recentWindow.some((turn) => {
    if (!turn || typeof turn.text !== 'string') {
      return false
    }

    const normalizedTurn = normalizeText(turn.text)
    return /\b(coordinar|agendar|programar|visita|cita|disponibilidad|te propongo uno|proponga uno|terminar de coordinar|seguir con la visita|instalacion|instalación|colocacion|colocación|reparacion|reparación|revision|revisión|service|trabajos? a medida|a medida)\b/u.test(
      normalizedTurn,
    )
  })
}

const hasSpecificPriceContext = (normalizedInput, tenantTopicTaxonomy = []) =>
  Boolean(
    (() => {
      if (looksLikeQuoteRequirementsQuestion(normalizedInput)) {
        return false
      }

      const extractedTopic = extractRequestedTopicLabel(normalizedInput)
      const extractedTopicMatch =
        extractedTopic && !looksLikeGenericPriceInquiry(extractedTopic)
          ? findBestTenantTopicMatch(extractedTopic, tenantTopicTaxonomy)
          : null
      const extractedTopicTokens =
        extractedTopic && !looksLikeGenericPriceInquiry(extractedTopic)
          ? normalizeText(extractedTopic)
              .split(/\s+/)
              .map((token) => token.trim())
              .filter((token) => token.length >= 4)
          : []
      const hasSpecificExtractedTopic =
        Boolean(extractedTopic) &&
        !looksLikeGenericPriceInquiry(extractedTopic) &&
        (
          extractedTopicMatch?.kind === 'product_topic' ||
          extractedTopicMatch?.kind === 'product_variant' ||
          extractedTopicTokens.length >= 2 ||
          /\b\d{2,4}\b/.test(extractedTopic || '')
        )
      if (hasSpecificExtractedTopic) {
        return true
      }

      const subject = normalizeText(normalizedInput)
        .replace(
          /\b(quiero|quisiera|necesito|me gustaria|me gustaría|saber|pasame|pasar|me pasas|me podes|me pod[eé]s|podrias|podr[ií]as|cuanto|cu[aá]nto|que|qué|el|la|los|las|un|una|unos|unas|de|del|por|para|aproximado|aproximada|estimado|estimada|final|precio|precios|presupuesto|presupuestos|cotizacion|cotización|cotizaciones|costo|costos|cuesta|cuestan|valor|valores|importe|importes|monto|montos|sale|vale)\b/g,
          ' ',
        )
        .replace(/\s+/g, ' ')
        .trim()
      const subjectTokens = subject
        .split(/\s+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4)
      const subjectTopicMatch = findBestTenantTopicMatch(
        subject,
        tenantTopicTaxonomy,
      )
      const inputTopicMatch = findBestTenantTopicMatch(
        normalizedInput,
        tenantTopicTaxonomy,
      )
      const hasSpecificTenantTopic =
        subjectTopicMatch?.kind === 'product_topic' ||
        subjectTopicMatch?.kind === 'product_variant' ||
        inputTopicMatch?.kind === 'product_topic' ||
        inputTopicMatch?.kind === 'product_variant'

      return (
        hasSpecificTenantTopic ||
        subjectTokens.length >= 2 ||
        /\b\d{2,4}\b/.test(normalizedInput)
      )
    })(),
  )

export const classifyInboundMessage = ({
  role,
  input,
  recentTurns = [],
  pendingState = null,
  tenantTopicTaxonomy = [],
}) => {
  if (isCustomerRole(role) && looksLikeRawNoiseInput(input)) {
    return buildClassification({
      category: 'noise',
      confidence: 0.97,
      suggestedIntent: 'customer.unintelligible',
      decisionPath: ['classifier:noise'],
    })
  }

  const normalizedInput = isCustomerRole(role)
    ? normalizeCustomerTextForIntent(input, {
        tenantTopicTaxonomy,
      }).normalizedInput
    : normalizeText(input)
  if (!normalizedInput) {
    return buildClassification({
      category: 'incomplete',
      confidence: 0.9,
      suggestedIntent: isCustomerRole(role) ? 'customer.incomplete' : null,
      decisionPath: ['classifier:empty_input'],
    })
  }

  if (
    hasMultimodalPlaceholderSignal(input) &&
    !stripMultimodalPlaceholderPhrases(input)
  ) {
    return buildClassification({
      category: 'incomplete',
      confidence: 0.72,
      suggestedIntent: isCustomerRole(role) ? 'customer.incomplete' : null,
      decisionPath: ['classifier:multimodal_placeholder_only'],
    })
  }

  if (!isCustomerRole(role)) {
    return buildClassification({
      category: ACTIONABLE_HINTS.test(normalizedInput) ? 'actionable_intent' : 'other',
      confidence: 0.5,
      decisionPath: [
        ACTIONABLE_HINTS.test(normalizedInput)
          ? 'classifier:actionable_intent'
          : 'classifier:other',
      ],
    })
  }

  if (WEB_LEAD_INTRO_ONLY_REGEX.test(String(input || '').trim())) {
    return buildClassification({
      category: 'generic_help_request',
      confidence: 0.82,
      suggestedIntent: 'customer.clarify_request',
      decisionPath: ['classifier:web_lead_intro_only'],
    })
  }

  const protectedDataClassification = classifyCustomerProtectedDataRequest({
    role,
    input: normalizedInput,
  })
  if (protectedDataClassification) {
    return buildClassification(protectedDataClassification)
  }

  const hasPendingConfirmation =
    typeof pendingState?.state === 'string' &&
    pendingState.state.toUpperCase() === 'WAITING_CONFIRMATION'

  if (hasPendingConfirmation && CONFIRMATION_PATTERNS.some((pattern) => pattern.test(normalizedInput))) {
    return buildClassification({
      category: 'confirmation',
      confidence: 0.96,
      suggestedIntent: 'customer.confirmation',
      decisionPath: ['classifier:confirmation'],
    })
  }

  if (hasPendingConfirmation && CANCELLATION_PATTERNS.some((pattern) => pattern.test(normalizedInput))) {
    return buildClassification({
      category: 'cancellation',
      confidence: 0.96,
      suggestedIntent: 'customer.cancellation',
      decisionPath: ['classifier:cancellation'],
    })
  }

  if (NOISE_PATTERNS.some((pattern) => pattern.test(normalizedInput))) {
    return buildClassification({
      category: 'noise',
      confidence: 0.97,
      suggestedIntent: 'customer.unintelligible',
      decisionPath: ['classifier:noise'],
    })
  }

  const repetitionCount = countRepeatedCustomerTurns(
    normalizedInput,
    recentTurns,
    tenantTopicTaxonomy,
  )
  if (repetitionCount >= 2) {
    return buildClassification({
      category: 'repetition',
      confidence: 0.94,
      suggestedIntent: 'customer.repetition',
      decisionPath: ['classifier:repetition'],
    })
  }

  if (SENSITIVE_PATTERNS.some((pattern) => pattern.test(normalizedInput))) {
    return buildClassification({
      category: 'sensitive',
      confidence: 0.95,
      suggestedIntent: 'customer.sensitive',
      decisionPath: ['classifier:sensitive'],
    })
  }

  if (
    OUT_OF_SCOPE_PATTERNS.some((pattern) => pattern.test(normalizedInput)) &&
    !CUSTOMER_GENERIC_DOMAIN_TERMS.test(normalizedInput) &&
    !hasTenantTopicSignal(normalizedInput, tenantTopicTaxonomy)
  ) {
    return buildClassification({
      category: 'out_of_scope',
      confidence: 0.93,
      suggestedIntent: 'customer.out_of_scope',
      decisionPath: ['classifier:out_of_scope'],
    })
  }

  const multiIntentAreas = detectMultiIntentAreas(normalizedInput)
  if (
    MULTI_INTENT_CONNECTORS.test(normalizedInput) &&
    multiIntentAreas.length >= 2
  ) {
    return buildClassification({
      category: 'multi_intent',
      confidence: 0.91,
      suggestedIntent: 'customer.multi_intent',
      decisionPath: ['classifier:multi_intent'],
      focusAreas: multiIntentAreas.slice(0, 3),
    })
  }

  if (
    looksLikeOpeningInstallationAssessmentContext(normalizedInput) &&
    !looksLikeGenericPriceInquiry(normalizedInput)
  ) {
    return buildClassification({
      category: 'price_inquiry',
      confidence: 0.83,
      suggestedIntent: 'customer.quote',
      decisionPath: ['classifier:opening_installation_assessment_quote'],
    })
  }

  if (
    looksLikeCustomerSupportServiceRequest(normalizedInput, {
      recentTurns,
      tenantTopicTaxonomy,
    })
  ) {
    return buildClassification({
      category: 'support_request',
      confidence: 0.92,
      suggestedIntent: 'customer.support_request',
      decisionPath: ['classifier:support_request'],
    })
  }

  if (looksLikeQuoteExpansionFollowUp(normalizedInput, tenantTopicTaxonomy)) {
    return buildClassification({
      category: 'price_inquiry',
      confidence: 0.9,
      suggestedIntent: 'customer.quote',
      decisionPath: ['classifier:quote_expansion_followup'],
    })
  }

  if (looksLikeStructuredQuoteSeed(normalizedInput, tenantTopicTaxonomy)) {
    return buildClassification({
      category: 'price_inquiry',
      confidence: 0.91,
      suggestedIntent: 'customer.quote',
      decisionPath: ['classifier:structured_quote_seed'],
    })
  }

  if (
    looksLikeOpeningStructureSignal(input) &&
    (DIMENSION_PAIR_REGEX.test(normalizedInput) || looksLikeGenericPriceInquiry(normalizedInput))
  ) {
    return buildClassification({
      category: 'price_inquiry',
      confidence: 0.9,
      suggestedIntent: 'customer.quote',
      decisionPath: ['classifier:opening_structure_quote'],
    })
  }

  if (looksLikeInstalledReplacementAssessmentRequest(normalizedInput)) {
    return buildClassification({
      category: 'price_inquiry',
      confidence: 0.9,
      suggestedIntent: 'customer.quote',
      decisionPath: ['classifier:replacement_quote_request'],
    })
  }

  if (looksLikePaymentProofFollowUpRequest(normalizedInput)) {
    return buildClassification({
      category: 'support_request',
      confidence: 0.91,
      suggestedIntent: 'customer.support_request',
      decisionPath: ['classifier:payment_followup_support_request'],
    })
  }

  if (looksLikePaymentProofArtifact(normalizedInput)) {
    return buildClassification({
      category: 'support_request',
      confidence: 0.9,
      suggestedIntent: 'customer.support_request',
      decisionPath: ['classifier:payment_proof_artifact'],
    })
  }

  if (looksLikePaymentOperationalUpdate(normalizedInput)) {
    return buildClassification({
      category: 'support_request',
      confidence: 0.9,
      suggestedIntent: 'customer.support_request',
      decisionPath: ['classifier:payment_operational_update'],
    })
  }

  if (looksLikeInstallationQuoteContext(normalizedInput)) {
    return buildClassification({
      category: 'price_inquiry',
      confidence: 0.9,
      suggestedIntent: 'customer.quote',
      decisionPath: ['classifier:installation_quote_context'],
    })
  }

  if (looksLikeCustomerScheduleAvailabilityRequest(normalizedInput)) {
    return buildClassification({
      category: 'schedule_request',
      confidence: 0.91,
      suggestedIntent: 'customer.schedule_request',
      decisionPath: ['classifier:schedule_request'],
    })
  }

  if (looksLikeScheduleAdministrativeFollowUp(normalizedInput, recentTurns)) {
    return buildClassification({
      category: 'schedule_request',
      confidence: 0.89,
      suggestedIntent: 'customer.schedule_request',
      decisionPath: ['classifier:schedule_request_contextual_followup'],
    })
  }

  if (FRUSTRATION_PATTERNS.some((pattern) => pattern.test(normalizedInput))) {
    return buildClassification({
      category: 'frustration',
      confidence: 0.9,
      suggestedIntent: 'customer.frustration',
      decisionPath: ['classifier:frustration'],
    })
  }

  if (detectStandaloneAttachmentArtifactKind(input)) {
    return buildClassification({
      category: 'incomplete',
      confidence: 0.91,
      suggestedIntent: 'customer.incomplete',
      decisionPath: ['classifier:attachment_artifact_only'],
    })
  }

  if (INCOMPLETE_PATTERNS.some((pattern) => pattern.test(normalizedInput))) {
    return buildClassification({
      category: 'incomplete',
      confidence: 0.92,
      suggestedIntent: 'customer.incomplete',
      decisionPath: ['classifier:incomplete'],
    })
  }

  if (CLARIFICATION_PATTERNS.some((pattern) => pattern.test(normalizedInput))) {
    return buildClassification({
      category: 'clarification_request',
      confidence: 0.94,
      suggestedIntent: 'customer.rephrase_request',
      decisionPath: ['classifier:clarification_request'],
    })
  }

  if (CONTACT_PATTERNS.some((pattern) => pattern.test(normalizedInput)) || looksLikeCustomerContactQuestion(normalizedInput)) {
    return buildClassification({
      category: 'contact',
      confidence: 0.93,
      suggestedIntent: 'customer.contact_info',
      decisionPath: ['classifier:contact'],
    })
  }

  if (
    looksLikeGenericPriceInquiry(normalizedInput) &&
    !/\b(agendar|agenda|visita|cita|pedido|orden)\b/.test(normalizedInput) &&
    !hasSpecificPriceContext(normalizedInput, tenantTopicTaxonomy)
  ) {
    return buildClassification({
      category: 'price_inquiry',
      confidence: 0.92,
      suggestedIntent: 'customer.price_inquiry',
      decisionPath: ['classifier:price_inquiry'],
    })
  }

  if (looksLikeCustomerTopicQuestion(normalizedInput, { tenantTopicTaxonomy })) {
    return buildClassification({
      category: 'faq_topic',
      confidence: 0.93,
      suggestedIntent: 'customer.topic_info',
      decisionPath: ['classifier:faq_topic'],
    })
  }

  if (GENERIC_HELP_PATTERNS.some((pattern) => pattern.test(normalizedInput))) {
    if (!ACTIONABLE_HINTS.test(normalizedInput)) {
      return buildClassification({
        category: 'generic_help_request',
        confidence: 0.9,
        suggestedIntent: 'customer.clarify_request',
        decisionPath: ['classifier:generic_help_request'],
      })
    }
  }

  if (looksLikeCustomerUnintelligibleText(normalizedInput)) {
    return buildClassification({
      category: 'unintelligible',
      confidence: 0.95,
      suggestedIntent: 'customer.unintelligible',
      decisionPath: ['classifier:unintelligible'],
    })
  }

  if (COURTESY_PATTERNS.some((pattern) => pattern.test(normalizedInput))) {
    return buildClassification({
      category: 'courtesy',
      confidence: 0.97,
      suggestedIntent: 'customer.light',
      decisionPath: ['classifier:courtesy'],
    })
  }

  if (GREETING_PATTERNS.some((pattern) => pattern.test(normalizedInput))) {
    return buildClassification({
      category: 'greeting',
      confidence: 0.97,
      suggestedIntent: 'customer.light',
      decisionPath: ['classifier:greeting'],
    })
  }

  if (
    ACTIONABLE_HINTS.test(normalizedInput) ||
    CUSTOMER_GENERIC_DOMAIN_TERMS.test(normalizedInput) ||
    hasTenantTopicSignal(normalizedInput, tenantTopicTaxonomy)
  ) {
    return buildClassification({
      category: 'actionable_intent',
      confidence: 0.62,
      decisionPath: ['classifier:actionable_intent'],
    })
  }

  return buildClassification({
    category: 'other',
    confidence: 0.4,
    decisionPath: ['classifier:other'],
  })
}

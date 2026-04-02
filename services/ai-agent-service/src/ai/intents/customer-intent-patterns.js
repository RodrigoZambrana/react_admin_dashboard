import { hasTenantTopicSignal } from './customer-topic-taxonomy.js'
import {
  BASE_CONVERSATIONAL_ES_SIGNALS,
  countStemMatches,
  hasPhraseMatch,
  hasStemMatch,
  looksLikeQuoteExpansionSignal,
  normalizeSemanticText,
  tokenizeSemanticText,
} from './customer-semantic-signals.js'
import { getVocabulary } from '../tenant-policy/runtime-tenant-policy.js'

const normalizeText = normalizeSemanticText

const tokenize = tokenizeSemanticText

const PRICE_DIRECT_PATTERNS = [
  /\b(precio|precios|presupuesto|presupuestos|cotizacion|cotizacion(?:es)?|cotización|cotizaciones|cotizar|cotizame|cotízame|cotizan|cotizamos|importe|importes|monto|montos|tarifa|tarifas|arancel|aranceles)\b/u,
  /\b(cu[aá]nto|que|qué)\s+(sale|cuesta|vale|valdria|valdría|saldria|saldría|seria|sería)\b/u,
  /\b(costo|costos|costo aproximado|costo estimado|precio final|precio aproximado|precio estimado)\b/u,
  /\b(pasame|pasame el|me pasas|me podes pasar|me pod[eé]s pasar)\s+(precio|presupuesto|cotizacion|cotización|valor|costo)\b/u,
]

const PRICE_CONCEPT_STEMS = [
  'preci',
  'presupuest',
  'cotiz',
  'cost',
  'import',
  'monto',
  'tarif',
  'arancel',
  'estim',
  'aproxim',
  'valor',
]

const PRICE_QUERY_STEMS = [
  'cuant',
  'sale',
  'cuest',
  'pas',
  'pagar',
  'valdr',
  'saldr',
  'saber',
  'consult',
  'quer',
  'ten',
  'tien',
]

const QUOTE_REQUIREMENTS_DIRECT_PATTERNS = [
  /\b(que|qué)\s+(datos|informacion|información|medidas|medida|detalle|detalles)\s+(necesitan|necesitas|precisan|preciso|piden|te paso|tengo que pasar)\b/u,
  /\b(para|a fin de)\s+(cotizar|presupuestar|hacer un presupuesto|hacer una cotizacion|hacer una cotización)\b/u,
  /\b(que|qué)\s+(necesitan|necesitas|precisan|piden)\s+para\s+(cotizar|presupuestar)\b/u,
  /\b(?:en|de)?\s*que\s+pued(?:o|es|e|en)\s+cotizar\b/u,
]

const QUOTE_WAITING_FOLLOW_UP_PATTERNS = [
  /\b(espero|aguardo)\s+(el|la)\s+(presupuesto|cotizacion|cotización|respuesta)\b/u,
  /\b(quedo|qued[oó])\s+(a la espera|esperando)\b.*\b(presupuesto|cotizacion|cotización|respuesta|asesor)\b/u,
  /\b(espero|aguardo)\b.*\b(presupuesto|cotizacion|cotización|respuesta|asesor)\b/u,
  /\b(gracias|muchas gracias)\b.*\b(presupuesto|cotizacion|cotización)\b/u,
]

const QUOTE_CLARIFICATION_PATTERNS = [
  /\b(presupuesto|cotizacion|cotización)\b.*\b(no me qued[oó] claro|aclar|explic|detalle|detall|total|final)\b/u,
  /\b(no me qued[oó] claro|aclar|explic|detalle|detall)\b.*\b(presupuesto|cotizacion|cotización|total|final)\b/u,
  /\b(presupuesto|cotizacion|cotización)\s+(enviado|mandado|pasado)\b/u,
]

const INTEREST_VERB_PATTERNS = [
  /\b(me interesa|estoy buscando|ando buscando|busco|quiero|necesito|preciso|me gustaria|me gustaría)\b/u,
]

const CONFIGURATION_SIGNAL_PATTERNS = [
  /\b(color|medida|medidas|serie|linea|línea|modelo|tipo|version|versión|ancho|alto|material|terminacion|terminación|perfil|configuracion|configuración|atributo)\b/u,
]

const QUOTE_SEED_DETAIL_PATTERNS = [
  /\b\d{1,4}(?:[.,]\d+)?\s*x\s*\d{1,4}(?:[.,]\d+)?\b/u,
  /\b\d{1,4}\s+(?:unidades?|items?|item|piezas?)\b/u,
  /\b(?:son|serian|serían|necesito|quiero|preciso)\s+\d{1,4}\b/u,
]

const MATERIAL_FOLLOW_UP_PATTERNS = [
  /\b(foto|fotos|imagen|imagenes|imágenes|catalogo|catálogo|muestrario|referencias|material)\b/u,
  /\b(me podes enviar|me pod[eé]s enviar|me mandas|me mand[aá]s|podrias mandar|podr[ií]as mandar)\b.*\b(foto|fotos|imagen|imagenes|cat[aá]logo|material)\b/u,
]

const LIGHT_FILTER_PREFERENCE_PATTERNS = [
  /\b(deja|dejan|deje|dejen)\s+pasar\s+luz\b/u,
  /\b(deja|dejan|deje|dejen)\s+entrar\s+luz\b/u,
  /\b(que|qué)\s+(deje|dejen)\s+pasar\s+luz\b/u,
  /\b(paso|entrada)\s+(parcial|suave)\s+de\s+luz\b/u,
  /\b(entre|pase)\s+luz\b/u,
]

const INFORMATION_EXPANSION_PATTERNS = [
  /\b(mas info|más info|mas informacion|más información|mas detalles|más detalles|amplia|ampliame|ampliar|contame mas|contame más|explicame mejor|expl[ií]came mejor)\b/u,
  /\b(tenes|tienen|hay)\b.*\b(info|informacion|información|detalles)\b/u,
  /\b(que|qué)\s+(tipos?|opciones?|variantes?)\s+(tenes|tienen|hay)\b/u,
]

const DELIVERY_TIME_FAQ_PATTERNS = [
  /\b(tiempo de entrega|plazo de entrega)\b/u,
  /\b(cu[aá]nto|cuanto)\s+(demora|tarda)\b/u,
  /\b(demora|tarda)\b/u,
]

const ORDER_STATUS_DIRECT_PATTERNS = [
  /\b(estado del pedido|estado de mi pedido|seguimiento|tracking)\b/u,
  /\b(mi pedido|mi orden|mi envio|mi envío)\b/u,
  /\b(numero|número)\s+de\s+(pedido|orden)\b/u,
]

const ORDER_STATUS_ENTITY_PATTERN = /\b(pedido|orden|envio|envío|entrega)\b/u
const ORDER_STATUS_TRACKING_CUE_PATTERN =
  /\b(estado|seguimiento|tracking|numero|número|llega|llegan|sale|salio|salió|va|viene|confirmaron|confirmado)\b/u

const COMMERCIAL_CONDITION_PATTERNS = [
  /\b(incluye|viene con|es con|trae)\b.*\b(instalacion|instalación|colocacion|colocación|envio|envío|garantia|garantía)\b/u,
  /\b(instalacion|instalación|colocacion|colocación|envio|envío|garantia|garantía)\b.*\b(incluye|incluido|incluida|incluidos|incluidas)\b/u,
  /\b(tiene|tienen|hay)\b.*\b(instalacion|instalación|colocacion|colocación|envio|envío|garantia|garantía)\b/u,
  /\b(?:ustedes\s+)?(?:lo|la|los|las)?\s*(?:colocan|instalan)\b/u,
  /\b(?:hacen|realizan|ofrecen)\b.*\b(instalacion|instalación|colocacion|colocación)\b/u,
  /\b(?:puede|pueden)\b.*\b(instalar|colocar)\b/u,
  /\b(es aparte|va aparte|se cobra aparte)\b.*\b(instalacion|instalación|colocacion|colocación|envio|envío)\b/u,
  /\b(con|sin)\s+(instalacion|instalación|colocacion|colocación)\b.*\b(cambia|cambiaria|cambiaría|varia|varía|incluye|incluido|incluida|queda|seria|sería|sale|cuesta)\b/u,
  /\b(cambia|cambiaria|cambiaría|varia|varía|incluye|incluido|incluida|queda|seria|sería|sale|cuesta)\b.*\b(con|sin)\s+(instalacion|instalación|colocacion|colocación)\b/u,
  /\b(con|sin)\s+(instalacion|instalación|colocacion|colocación)\b.*\b(o|u)\b.*\b(con|sin)\s+(instalacion|instalación|colocacion|colocación)\b/u,
  /\b(instalacion|instalación|colocacion|colocación)\b.*\b(mismo|igual|cambia|cambiaria|cambiaría|varia|varía|menor|mayor)\b/u,
  /\b(precio|costo|valor|importe)\b.*\b(mismo|igual|cambia|cambiaria|cambiaría|varia|varía|menor|mayor)\b.*\b(instalacion|instalación|colocacion|colocación)\b/u,
]

const PAYMENT_SIGNAL_SETS = BASE_CONVERSATIONAL_ES_SIGNALS.payment
const hasStem = (tokens, stem) => hasStemMatch(tokens, stem)

const uniqueTerms = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .filter((value) => typeof value === 'string')
        .map((value) => normalizeText(value))
        .filter(Boolean),
    ),
  )

const hasConfiguredTerm = (normalizedInput, terms = []) =>
  uniqueTerms(terms).some((term) => normalizedInput.includes(term))

const getConfiguredQuoteItemTerms = (tenantRuntimePolicy = null) =>
  uniqueTerms(getVocabulary(tenantRuntimePolicy)?.quoteItemTerms ?? [])

const getConfiguredProductContextTerms = (tenantRuntimePolicy = null) =>
  uniqueTerms(getVocabulary(tenantRuntimePolicy)?.productContextTerms ?? [])

export const looksLikeGenericPriceInquiry = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  if (PRICE_DIRECT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true
  }

  const tokens = tokenize(normalized)
  const conceptMatches = PRICE_CONCEPT_STEMS.filter((stem) =>
    hasStem(tokens, stem),
  ).length
  const queryMatches = PRICE_QUERY_STEMS.filter((stem) =>
    hasStem(tokens, stem),
  ).length

  if (conceptMatches >= 2) {
    return true
  }

  if (conceptMatches >= 1 && queryMatches >= 1) {
    return true
  }

  return false
}

export const looksLikeQuoteRequirementsQuestion = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  const matchedPatterns = QUOTE_REQUIREMENTS_DIRECT_PATTERNS.filter((pattern) =>
    pattern.test(normalized),
  ).length

  return (
    matchedPatterns >= 2 ||
    (matchedPatterns >= 1 &&
      /\b(cotizar|presupuestar|presupuesto|cotizacion|cotización)\b/u.test(
        normalized,
      ))
  )
}

export const looksLikeCustomerOrderStatusQuestion = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  const looksLikeDeliveryTimeFaq = DELIVERY_TIME_FAQ_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  )
  const hasExplicitOrderReference = /\b(pedido|orden|envio|envío)\b/u.test(normalized)

  if (looksLikeDeliveryTimeFaq && !hasExplicitOrderReference) {
    return false
  }

  if (ORDER_STATUS_DIRECT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true
  }

  return (
    ORDER_STATUS_ENTITY_PATTERN.test(normalized) &&
    ORDER_STATUS_TRACKING_CUE_PATTERN.test(normalized) &&
    !looksLikeDeliveryTimeFaq
  )
}

export const looksLikeQuoteWaitingFollowUp = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  return QUOTE_WAITING_FOLLOW_UP_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  )
}

export const looksLikeQuoteClarificationRequest = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  const looksLikeStructuredQuoteSubmission =
    /\b(enviar|mandar|pasar|solicitar|pedir|hacer)\b.*\b(presupuesto|cotizacion|cotización)\b/u.test(
      normalized,
    ) &&
    (/\b\d{1,4}(?:[.,]\d{1,3})?\s*[x×]\s*\d{1,4}(?:[.,]\d{1,3})?\b/u.test(
      normalized,
    ) ||
      /\btotal\s*:?\s*\d+\s+(items?|productos?|unidades?)\b/u.test(
        normalized,
      ))

  if (looksLikeStructuredQuoteSubmission) {
    return false
  }

  return QUOTE_CLARIFICATION_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const looksLikeConfiguredProductInterest = (
  value,
  tenantTopicTaxonomy = [],
) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  const hasInterestVerb = INTEREST_VERB_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  )
  const hasConfigurationSignal = CONFIGURATION_SIGNAL_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  )
  const hasTenantSignal = hasTenantTopicSignal(normalized, tenantTopicTaxonomy)
  const looksLikeConceptQuestion =
    /\b(que es|qué es|como funciona|cómo funciona|para que sirve|para qué sirve|beneficios|ventajas|desventajas|explicame|explícame|contame)\b/u.test(
      normalized,
    )

  return (
    hasInterestVerb &&
    hasConfigurationSignal &&
    hasTenantSignal &&
    !looksLikeConceptQuestion
  )
}

export const looksLikeStructuredQuoteSeed = (
  value,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  if (!hasTenantTopicSignal(normalized, tenantTopicTaxonomy)) {
    return false
  }

  const hasInterestVerb = INTEREST_VERB_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  )
  const hasQuoteDetails =
    QUOTE_SEED_DETAIL_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    (/\b\d{1,4}\b/u.test(normalized) &&
      hasConfiguredTerm(normalized, getConfiguredQuoteItemTerms(tenantRuntimePolicy)))

  return hasQuoteDetails && (hasInterestVerb || looksLikeGenericPriceInquiry(normalized))
}

export const looksLikeMaterialFollowUpRequest = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  return MATERIAL_FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const looksLikeLightFilterPreferenceRequest = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  return LIGHT_FILTER_PREFERENCE_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const looksLikeInformationExpansionRequest = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  return INFORMATION_EXPANSION_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const looksLikeCommercialConditionQuestion = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  return COMMERCIAL_CONDITION_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const looksLikeInstalledReplacementAssessmentRequest = (
  value,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  const hasReplacementAction =
    /\b(cambiar|cambio|reemplazar|reemplazo|sustituir|sustitucion|sustitución|sacar|retirar)\b/u.test(
      normalized,
    )
  const hasInstalledContext =
    /\b(de mi casa|de casa|viej[ao]s?|instalad[ao]s?|ya (?:tengo|estan|están)|existente|actual(?:es)?)\b/u.test(
      normalized,
    )
  const hasRelevantProduct =
    hasTenantTopicSignal(normalized, tenantTopicTaxonomy) ||
    hasConfiguredTerm(normalized, getConfiguredProductContextTerms(tenantRuntimePolicy))
  const asksForBudgeting =
    /\b(presupuesto|presupuestar|cotizacion|cotización|cotizar|cu[aá]nto sale|precio)\b/u.test(
      normalized,
    )

  return hasReplacementAction && hasRelevantProduct && (hasInstalledContext || asksForBudgeting)
}

export const looksLikeQuoteExpansionFollowUp = (
  value,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  const hasTenantTopic =
    hasTenantTopicSignal(normalized, tenantTopicTaxonomy) ||
    hasConfiguredTerm(normalized, getConfiguredProductContextTerms(tenantRuntimePolicy))

  if (!hasTenantTopic) {
    return false
  }

  return looksLikeQuoteExpansionSignal(normalized, tenantRuntimePolicy)
}

export const looksLikePaymentProofFollowUpRequest = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  const tokens = tokenize(normalized)
  const hasProofCore =
    countStemMatches(tokens, PAYMENT_SIGNAL_SETS.proofCoreStems) >= 1
  const hasOperationalSubject =
    countStemMatches(tokens, PAYMENT_SIGNAL_SETS.operationalSubjectStems) >= 1
  const hasFollowUpAction =
    countStemMatches(tokens, PAYMENT_SIGNAL_SETS.proofFollowUpActionStems) >= 1

  return (hasProofCore || hasOperationalSubject) && hasFollowUpAction
}

export const looksLikePaymentProofArtifact = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  const tokens = tokenize(normalized)
  const hasProofCore =
    countStemMatches(tokens, PAYMENT_SIGNAL_SETS.proofCoreStems) >= 1
  const hasArtifactHint =
    countStemMatches(tokens, PAYMENT_SIGNAL_SETS.artifactHintStems) >= 1 ||
    hasPhraseMatch(normalized, PAYMENT_SIGNAL_SETS.artifactHintPhrases)
  const hasProofPlusTransfer =
    hasStemMatch(tokens, 'comprobante') && hasStemMatch(tokens, 'transfer')
  const hasTransferPlusBank =
    hasStemMatch(tokens, 'transfer') && hasStemMatch(tokens, 'banco')

  return (
    (hasProofCore && hasArtifactHint) ||
    hasProofPlusTransfer ||
    (hasTransferPlusBank && hasArtifactHint)
  )
}

export const looksLikePaymentOperationalUpdate = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  const tokens = tokenize(normalized)
  const hasOperationalSubject =
    countStemMatches(tokens, PAYMENT_SIGNAL_SETS.operationalSubjectStems) >= 1
  const hasCompletionAction =
    countStemMatches(tokens, PAYMENT_SIGNAL_SETS.completionActionStems) >= 1
  const hasCompletionState =
    countStemMatches(tokens, PAYMENT_SIGNAL_SETS.completionStateStems) >= 1
  const hasTransferVerb =
    countStemMatches(tokens, PAYMENT_SIGNAL_SETS.transferVerbStems) >= 1
  const hasTransferCompletion =
    hasTransferVerb ||
    (hasStemMatch(tokens, 'transfer') && (hasCompletionAction || hasCompletionState))

  return (
    looksLikePaymentProofFollowUpRequest(normalized) ||
    looksLikePaymentProofArtifact(normalized) ||
    (hasOperationalSubject && hasCompletionAction) ||
    (hasOperationalSubject && hasCompletionState) ||
    hasTransferCompletion
  )
}

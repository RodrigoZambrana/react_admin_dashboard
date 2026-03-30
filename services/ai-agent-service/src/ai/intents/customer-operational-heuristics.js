import {
  BASE_CONVERSATIONAL_ES_SIGNALS,
  DOMAIN_SUPPORT_ES_SIGNALS,
  countStemMatches,
  hasPhraseMatch,
  normalizeSemanticText,
  stripConversationalGreetingPrefix,
  tokenizeSemanticText,
} from './customer-semantic-signals.js'
import { hasTenantTopicSignal } from './customer-topic-taxonomy.js'
import { looksLikeCommercialConditionQuestion } from './customer-intent-patterns.js'

const normalizeText = normalizeSemanticText
const tokenize = tokenizeSemanticText

const SUPPORT_SIGNAL_SETS = BASE_CONVERSATIONAL_ES_SIGNALS.support
const DOMAIN_SIGNAL_SETS = DOMAIN_SUPPORT_ES_SIGNALS

const SCHEDULE_AVAILABILITY_DIRECT_PATTERNS = [
  /\b(coordinar|agendar|programar)\s+(visita|instalacion|instalación|colocacion|colocación|relevamiento|medicion|medición)\b/,
  /\b(cuando|cuándo)\s+(podrian|podrían|pueden|tendran|tendrán)\s+(pasar|venir|instalar|colocar)\b/,
  /\b(a\s+que\s+hora|a\s+qué\s+hora)\s+(podrian|podrían|pueden)\s+(pasar|venir)\b/,
  /\b(disponibilidad)\b.*\b(instalacion|instalación|visita|colocacion|colocación)\b/,
  /\b(pasar a medir|pasar a ver|hacer la instalacion|hacer la instalación)\b/,
  /\b(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|mañana|manana|hoy)\b.*\b(puede ser|pude ser|podria ser|podría ser|me sirve|me queda bien)\b/,
  /\b(?:los|las|te)\s+espero\b.*\b(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|mañana|manana|hoy|a las|entre las|\d{1,2}:\d{2})\b/,
]

const SCHEDULE_AVAILABILITY_ACTION_STEMS = [
  'agend',
  'coordin',
  'program',
  'visit',
  'cita',
  'instal',
  'coloc',
  'venir',
  'mostrar',
  'medir',
  'relev',
]

const SCHEDULE_AVAILABILITY_ACTION_PHRASES = [
  'pasar a medir',
  'pasar a ver',
  'pasar por',
  'venir a medir',
  'venir a ver',
  'coordinar visita',
  'coordinar una visita',
  'los espero',
  'las espero',
  'te espero',
]

const SCHEDULE_AVAILABILITY_TIME_STEMS = [
  'dispon',
  'horari',
  'franj',
  'tempran',
  'manan',
  'tarde',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
  'direccion',
  'zona',
]

const SUPPORT_PRODUCT_IDENTIFICATION_REGEX =
  /^(?:es|son)\s+(?:una|un|unas|unos)?\s*(?:cortina|cortinas|persiana|persianas|abertura|aberturas|ventana|ventanas|puerta|puertas|roller)\b/

const SUPPORT_EXISTING_ITEM_REGEX =
  /\b(existent\w*|instalad\w*|ya\s+instalad\w*|la\s+que\s+tengo|lo\s+que\s+tengo)\b/

const COMMERCIAL_PRODUCT_DISCOVERY_REGEX =
  /\b(opcion|opciones|modelo|modelos|variantes?|lineas?|linea|catalogo|catálogo|tipos?)\b/

export const looksLikeCustomerSupportComponentReplacementRequest = (input) => {
  const normalized = normalizeText(input)
  if (!normalized) {
    return false
  }

  const tokens = tokenize(normalized)
  const actionMatches = countStemMatches(tokens, SUPPORT_SIGNAL_SETS.replacementStems)
  const componentMatches = countStemMatches(tokens, DOMAIN_SIGNAL_SETS.componentStems)

  return actionMatches >= 1 && componentMatches >= 1
}

const hasRecentSupportOrProductContext = (
  recentTurns = [],
  tenantTopicTaxonomy = [],
) => {
  if (!Array.isArray(recentTurns) || recentTurns.length === 0) {
    return false
  }

  const recentWindow = recentTurns.slice(-4)
  return recentWindow.some((turn) => {
    const normalizedTurn = normalizeText(turn?.text || '')
    if (!normalizedTurn) {
      return false
    }

    const tokens = tokenize(normalizedTurn)
    const hasSupportSignal =
      countStemMatches(tokens, SUPPORT_SIGNAL_SETS.serviceStems) >= 1 ||
      countStemMatches(tokens, SUPPORT_SIGNAL_SETS.replacementStems) >= 1 ||
      countStemMatches(tokens, DOMAIN_SIGNAL_SETS.componentStems) >= 1 ||
      hasPhraseMatch(normalizedTurn, SUPPORT_SIGNAL_SETS.problemPhrases)

    return hasSupportSignal || hasTenantTopicSignal(normalizedTurn, tenantTopicTaxonomy)
  })
}

export const looksLikeCustomerSupportServiceRequest = (input, options = {}) => {
  const normalized = normalizeText(input)
  if (!normalized) {
    return false
  }

  const tokens = tokenize(normalized)
  const componentMatches = countStemMatches(tokens, DOMAIN_SIGNAL_SETS.componentStems)
  const genericProductMatches = countStemMatches(tokens, DOMAIN_SIGNAL_SETS.productContextStems)
  const serviceMatches = countStemMatches(tokens, SUPPORT_SIGNAL_SETS.serviceStems)
  const replacementMatches = countStemMatches(tokens, SUPPORT_SIGNAL_SETS.replacementStems)
  const problemMatches = countStemMatches(tokens, SUPPORT_SIGNAL_SETS.problemStems)
  const tenantTopicSignal = hasTenantTopicSignal(
    normalized,
    options?.tenantTopicTaxonomy || [],
  )
  const recentContext = hasRecentSupportOrProductContext(
    options?.recentTurns,
    options?.tenantTopicTaxonomy,
  )
  const hasProblemPhrase = hasPhraseMatch(normalized, SUPPORT_SIGNAL_SETS.problemPhrases)
  const hasProductContext = genericProductMatches >= 1 || tenantTopicSignal
  const hasProductIdentificationFollowUp =
    recentContext &&
    hasProductContext &&
    tokens.length <= 8 &&
    (SUPPORT_PRODUCT_IDENTIFICATION_REGEX.test(normalized) ||
      SUPPORT_EXISTING_ITEM_REGEX.test(normalized)) &&
    !COMMERCIAL_PRODUCT_DISCOVERY_REGEX.test(normalized)
  const hasPhotoContinuationSignal =
    /\b(foto|fotos|imagen|imagenes|im[aá]genes|captura)\b/.test(normalized) &&
    /\b(envi|mando|mandar|paso|pasar|adjunt|saco|sacar)\b/.test(normalized)

  if (hasProductIdentificationFollowUp) {
    return true
  }

  if (serviceMatches >= 1 || hasProblemPhrase) {
    return true
  }

  if (serviceMatches + replacementMatches >= 2) {
    return true
  }

  if (componentMatches >= 1 && replacementMatches >= 1 && (hasProductContext || recentContext)) {
    return true
  }

  if (componentMatches >= 2 && replacementMatches >= 1) {
    return true
  }

  if (hasProductContext && componentMatches >= 1 && problemMatches >= 1) {
    return true
  }

  if (recentContext && hasPhotoContinuationSignal) {
    return true
  }

  if (
    recentContext &&
    (serviceMatches >= 1 || replacementMatches >= 1) &&
    SUPPORT_EXISTING_ITEM_REGEX.test(normalized)
  ) {
    return true
  }

  if (
    hasProductContext &&
    problemMatches >= 1 &&
    /\b(revisar|revision|revisión|pasar|venir|coordinar|visita|mantenimiento)\b/.test(
      normalized,
    )
  ) {
    return true
  }

  if (hasProductContext && (serviceMatches >= 1 || replacementMatches >= 1) && problemMatches >= 1) {
    return true
  }

  return hasProductContext && (serviceMatches >= 1 || replacementMatches >= 1) && normalized.includes('no ')
}

export const looksLikeCustomerScheduleAvailabilityRequest = (input) => {
  const normalized = stripConversationalGreetingPrefix(input)
  if (!normalized) {
    return false
  }

  const commercialConditionQuestion = looksLikeCommercialConditionQuestion(normalized)
  const hasQuoteSignal =
    /\b(cotiz\w*|presupuest\w*|precio|precios|costo|costos|cuanto sale|cu[aá]nto sale|cuesta|valor|importe)\b/u.test(
      normalized,
    )
  const hasExplicitAvailabilitySignal =
    /\b(cuando|cu[aá]ndo|a\s+que\s+hora|a\s+qu[eé]\s+hora|disponibilidad|coordinar|agendar|programar|venir|pasar|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|mañana|manana|hoy|a las|entre las)\b/u.test(
      normalized,
    )

  if (commercialConditionQuestion) {
    return false
  }

  if (hasQuoteSignal && !hasExplicitAvailabilitySignal) {
    return false
  }

  if (SCHEDULE_AVAILABILITY_DIRECT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true
  }

  if (hasPhraseMatch(normalized, SCHEDULE_AVAILABILITY_ACTION_PHRASES)) {
    return true
  }

  const tokens = tokenize(normalized)
  const actionMatches = countStemMatches(tokens, SCHEDULE_AVAILABILITY_ACTION_STEMS)
  const timeMatches = countStemMatches(tokens, SCHEDULE_AVAILABILITY_TIME_STEMS)

  if (actionMatches >= 2) {
    return true
  }

  return actionMatches >= 1 && timeMatches >= 1
}

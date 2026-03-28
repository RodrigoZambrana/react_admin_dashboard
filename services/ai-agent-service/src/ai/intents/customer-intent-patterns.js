import { hasTenantTopicSignal } from './customer-topic-taxonomy.js'

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const tokenize = (value) => normalizeText(value).split(/\s+/).filter(Boolean)

const hasStem = (tokens, stem) =>
  tokens.some((token) => token === stem || token.startsWith(stem))

const PRICE_DIRECT_PATTERNS = [
  /\b(precio|precios|presupuesto|presupuestos|cotizacion|cotizacion(?:es)?|cotización|cotizaciones|cotizar|cotizame|cotízame|cotizan|cotizamos|importe|importes|monto|montos|tarifa|tarifas|arancel|aranceles)\b/u,
  /\b(cu[aá]nto|que|qué)\s+(sale|cuesta|vale|valdria|valdría|saldria|saldría)\b/u,
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
]

const QUOTE_WAITING_FOLLOW_UP_PATTERNS = [
  /\b(espero|aguardo)\s+(el|la)\s+(presupuesto|cotizacion|cotización|respuesta)\b/u,
  /\b(quedo|qued[oó])\s+(a la espera|esperando)\b.*\b(presupuesto|cotizacion|cotización|respuesta|asesor)\b/u,
  /\b(espero|aguardo)\b.*\b(presupuesto|cotizacion|cotización|respuesta|asesor)\b/u,
]

const INTEREST_VERB_PATTERNS = [
  /\b(me interesa|estoy buscando|ando buscando|busco|quiero|necesito|preciso|me gustaria|me gustaría)\b/u,
]

const CONFIGURATION_SIGNAL_PATTERNS = [
  /\b(color|medida|medidas|serie|linea|línea|modelo|tipo|version|versión|ancho|alto|material|terminacion|terminación|perfil|apertura|doble vidrio|dvh)\b/u,
]

const MATERIAL_FOLLOW_UP_PATTERNS = [
  /\b(foto|fotos|imagen|imagenes|imágenes|catalogo|catálogo|muestrario|referencias|material)\b/u,
  /\b(me podes enviar|me pod[eé]s enviar|me mandas|me mand[aá]s|podrias mandar|podr[ií]as mandar)\b.*\b(foto|fotos|imagen|imagenes|cat[aá]logo|material)\b/u,
]

const INFORMATION_EXPANSION_PATTERNS = [
  /\b(mas info|más info|mas informacion|más información|mas detalles|más detalles|amplia|ampliame|ampliar|contame mas|contame más|explicame mejor|expl[ií]came mejor)\b/u,
  /\b(tenes|tienen|hay)\b.*\b(info|informacion|información|detalles)\b/u,
]

const COMMERCIAL_CONDITION_PATTERNS = [
  /\b(incluye|viene con|es con|trae)\b.*\b(instalacion|instalación|colocacion|colocación|envio|envío|garantia|garantía)\b/u,
  /\b(instalacion|instalación|colocacion|colocación|envio|envío|garantia|garantía)\b.*\b(incluye|incluido|incluida|incluidos|incluidas)\b/u,
  /\b(tiene|tienen|hay)\b.*\b(instalacion|instalación|colocacion|colocación|envio|envío|garantia|garantía)\b/u,
  /\b(es aparte|va aparte|se cobra aparte)\b.*\b(instalacion|instalación|colocacion|colocación|envio|envío)\b/u,
]

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

export const looksLikeQuoteWaitingFollowUp = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  return QUOTE_WAITING_FOLLOW_UP_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  )
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

export const looksLikeMaterialFollowUpRequest = (value) => {
  const normalized = normalizeText(value)
  if (!normalized) {
    return false
  }

  return MATERIAL_FOLLOW_UP_PATTERNS.some((pattern) => pattern.test(normalized))
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

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const tokenize = (value) =>
  normalizeText(value)
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter(Boolean)

const hasStem = (tokens, stems = []) =>
  stems.some((stem) => tokens.some((token) => token === stem || token.startsWith(stem)))

const countStemMatches = (tokens, stems = []) =>
  stems.filter((stem) =>
    tokens.some((token) => token === stem || token.startsWith(stem)),
  ).length

const SUPPORT_SERVICE_DIRECT_PATTERNS = [
  /\b(service|servicio tecnico|servicio técnico|reparacion|reparación|reparar|revisión|revision)\b/,
  /\b(necesita[n]?\s+service|necesita[n]?\s+reparaci[oó]n)\b/,
  /\b(dejo de funcionar|dejó de funcionar|anda mal|no anda bien|quedo mal|qued[oó] mal)\b/,
]

const SUPPORT_SERVICE_PRODUCT_STEMS = [
  'cortin',
  'persian',
  'abertur',
  'ventan',
  'puert',
  'motor',
  'eje',
  'guia',
  'guia',
  'panel',
]

const SUPPORT_SERVICE_ACTION_STEMS = [
  'service',
  'servici',
  'repar',
  'arregl',
  'ajust',
  'acort',
  'mover',
  'cambi',
  'revision',
  'revisi',
  'garant',
]

const SUPPORT_SERVICE_PROBLEM_STEMS = [
  'funcion',
  'fall',
  'anda',
  'instalad',
  'colocad',
  'rot',
  'trab',
]

const SCHEDULE_AVAILABILITY_DIRECT_PATTERNS = [
  /\b(coordinar|agendar|programar)\s+(visita|instalacion|instalación|colocacion|colocación|relevamiento|medicion|medición)\b/,
  /\b(cuando|cuándo)\s+(podrian|podrían|pueden|tendran|tendrán)\s+(pasar|venir|instalar|colocar)\b/,
  /\b(disponibilidad)\b.*\b(instalacion|instalación|visita|colocacion|colocación)\b/,
  /\b(pasar a medir|pasar a ver|hacer la instalacion|hacer la instalación)\b/,
]

const SCHEDULE_AVAILABILITY_ACTION_STEMS = [
  'agend',
  'coordin',
  'program',
  'visit',
  'cita',
  'instal',
  'coloc',
  'pasar',
  'venir',
  'mostrar',
  'medir',
  'relev',
]

const SCHEDULE_AVAILABILITY_TIME_STEMS = [
  'dispon',
  'horari',
  'franj',
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

export const looksLikeCustomerSupportServiceRequest = (input) => {
  const normalized = normalizeText(input)
  if (!normalized) {
    return false
  }

  if (SUPPORT_SERVICE_DIRECT_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true
  }

  const tokens = tokenize(normalized)
  const productMatches = countStemMatches(tokens, SUPPORT_SERVICE_PRODUCT_STEMS)
  const actionMatches = countStemMatches(tokens, SUPPORT_SERVICE_ACTION_STEMS)
  const problemMatches = countStemMatches(tokens, SUPPORT_SERVICE_PROBLEM_STEMS)

  if (actionMatches >= 2) {
    return true
  }

  if (productMatches >= 1 && actionMatches >= 1 && problemMatches >= 1) {
    return true
  }

  return productMatches >= 1 && actionMatches >= 1 && normalized.includes('no ')
}

export const looksLikeCustomerScheduleAvailabilityRequest = (input) => {
  const normalized = normalizeText(input)
  if (!normalized) {
    return false
  }

  if (SCHEDULE_AVAILABILITY_DIRECT_PATTERNS.some((pattern) => pattern.test(normalized))) {
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

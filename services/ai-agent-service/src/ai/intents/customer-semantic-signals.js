import {
  getBusinessRules,
  getVocabulary,
} from '../tenant-policy/runtime-tenant-policy.js'
import { getStaticLanguagePolicy } from '../../../../shared/language-policy/index.js'

const BASE_LANGUAGE_POLICY = getStaticLanguagePolicy('es-default')
const BASE_CUSTOMER_SEMANTIC_SIGNALS_POLICY =
  BASE_LANGUAGE_POLICY.customerSemanticSignals &&
  typeof BASE_LANGUAGE_POLICY.customerSemanticSignals === 'object'
    ? BASE_LANGUAGE_POLICY.customerSemanticSignals
    : {}

export const normalizeSemanticText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const tokenizeSemanticText = (value) =>
  normalizeSemanticText(value)
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter(Boolean)

export const hasStemMatch = (tokens = [], stem) =>
  tokens.some((token) => token === stem || token.startsWith(stem))

export const countStemMatches = (tokens = [], stems = []) =>
  stems.filter((stem) => hasStemMatch(tokens, stem)).length

export const hasPhraseMatch = (normalizedText, phrases = []) =>
  phrases.some((phrase) => {
    const normalizedPhrase = normalizeSemanticText(phrase)
    if (!normalizedPhrase) {
      return false
    }

    return normalizedText.includes(normalizedPhrase)
  })

export const BASE_CONVERSATIONAL_ES_SIGNALS = {
  quote: {
    expansionActionStems: ['pas', 'mand', 'sum', 'agreg', 'anad', 'inclu'],
    expansionQuantityStems: ['otro', 'otra', 'mas'],
    expansionPhrases: [
      'pasarte un',
      'pasarte una',
      'pasarte otro',
      'pasarte otra',
      'te paso un',
      'te paso una',
      'te paso otro',
      'te paso otra',
      'sumar un',
      'sumar una',
      'sumar otro',
      'sumar otra',
      'agregar un',
      'agregar una',
      'agregar otro',
      'agregar otra',
    ],
  },
  payment: {
    proofCoreStems: ['comprobante', 'deposit', 'sena', 'giro'],
    operationalSubjectStems: ['comprobante', 'pago', 'deposit', 'sena', 'giro'],
    artifactContextStems: ['transfer', 'banco'],
    proofFollowUpActionStems: [
      'adjunt',
      'envi',
      'mand',
      'pas',
      'revis',
      'confirm',
      'acredit',
    ],
    artifactHintStems: ['pdf', 'jpg', 'jpeg', 'png', 'adjunto'],
    artifactHintPhrases: ['archivo adjunto'],
    completionActionStems: [
      'ya',
      'recien',
      'acabo',
      'hice',
      'realic',
      'mand',
      'envi',
      'gir',
      'pagu',
    ],
    transferVerbStems: ['transferi'],
    completionStateStems: ['hech', 'realiz', 'enviad', 'mandad', 'girad', 'listo'],
  },
  schedule: {
    seedStems: [
      'coordin',
      'agend',
      'program',
      'visit',
      'cita',
      'instal',
      'coloc',
      'dispon',
      'venir',
    ],
    seedPhrases: [
      'pasar a medir',
      'pasar a ver',
      'pasar por',
      'venir a medir',
      'venir a ver',
      'coordinar visita',
      'coordinar una visita',
      'coordinar instalacion',
      'coordinar la instalacion',
      'hacer la instalacion',
      'hacer la colocacion',
    ],
    administrativeStems: [
      'hoy',
      'manana',
      'lunes',
      'martes',
      'miercoles',
      'jueves',
      'viernes',
      'sabado',
      'domingo',
      'hora',
      'horari',
      'franj',
      'tempran',
      'despues',
      'manana',
      'tarde',
      'noche',
      'direccion',
      'ubicacion',
      'avenida',
      'calle',
      'ruta',
      'telefono',
      'celular',
      'whatsapp',
      'mail',
      'email',
      'correo',
      'zona',
      'contact',
    ],
    administrativePhrases: ['pasado manana', 'a las', 'por la manana', 'por la tarde', 'por la noche'],
    reasonLabels: {
      technicalVisit: 'visita técnica',
      technicalReview: 'revisión técnica',
      installation: 'instalación',
      supportSchedulePurpose: 'coordinar una revisión técnica',
    },
  },
  support: {
    serviceStems: [
      'service',
      'servici',
      'repar',
      'revision',
      'revisi',
      'ajust',
      'acort',
      'mover',
      'garant',
    ],
    replacementStems: ['cambi', 'reemplaz'],
    problemStems: [
      'funcion',
      'fall',
      'anda',
      'instalad',
      'colocad',
      'rot',
      'trab',
      'torc',
      'tranc',
      'desprend',
      'solt',
      'cuerd',
      'flej',
      'gui',
    ],
    problemPhrases: [
      'dejo de funcionar',
      'anda mal',
      'no anda bien',
      'quedo mal',
      'necesita service',
      'necesitan service',
      'necesita reparacion',
      'necesitan reparacion',
      'se tranca',
      'se torcio',
      'se salio',
      'se desprendio',
      'se rompio la cuerda',
      'se torcio la cinta',
      'necesita mantenimiento',
      'necesitamos coordinar mantenimiento',
    ],
  },
  multimodal: {
    referentialPhrases: [
      'sirve esa',
      'sirve eso',
      'con eso ya se entiende',
      'con eso se entiende',
      'te mando otra foto',
      'te paso otra foto',
      'si hace falta te mando otra foto',
      'si hace falta te paso otra foto',
      'ahi te mando otra foto',
    ],
    plannedArtifactPhrases: [
      'en un rato saco fotos y se las envio',
      'en un rato saco fotos y te las envio',
      'en un rato saco fotos y las envio',
      'te mando una foto',
      'te mando otra foto',
      'te paso una foto',
      'te paso otra foto',
      'te envio una foto',
      'te envio otra foto',
      'si hace falta te mando otra foto',
      'si hace falta te paso otra foto',
      'mando fotos',
      'paso fotos',
      'adjunto fotos',
      'te mando imagen',
      'te paso imagen',
    ],
    placeholderPhrases: [
      'multimedia omitido',
      'imagen omitida',
      'audio omitido',
      'video omitido',
    ],
  },
  reengagement: {
    referentialPhrases: [
      'retomo esto',
      'retomo el tema',
      'seguimos con esto',
      'seguimos con eso',
      'como seguimos con eso',
      'cómo seguimos con eso',
      'perdon me quedo para atras el mensaje',
      'perdón me quedó para atrás el mensaje',
      'quedo para atras el mensaje',
      'me quedo para atras el mensaje',
    ],
  },
}

export const DOMAIN_SUPPORT_ES_SIGNALS = {
  componentStems: [],
  productContextStems: ['producto', 'servicio', 'item'],
}

const uniqueTerms = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .filter((value) => typeof value === 'string')
        .map((value) => normalizeSemanticText(value))
        .filter(Boolean),
    ),
  )

const hasConfiguredTerm = (normalizedValue, terms = []) =>
  uniqueTerms(terms).some((term) => normalizedValue.includes(term))

const ATTACHMENT_REFERENCE_TERMS = uniqueTerms(
  BASE_LANGUAGE_POLICY.attachmentReferenceTerms,
)
const GENERIC_HELP_TERMS = uniqueTerms(
  BASE_CUSTOMER_SEMANTIC_SIGNALS_POLICY.genericHelpTerms,
)
const INCOMPLETE_INPUTS = new Set(uniqueTerms(BASE_LANGUAGE_POLICY.incompleteInputs))
const SERVICE_CAPABILITY_SIGNAL_TERMS = {
  verbTerms: uniqueTerms(BASE_LANGUAGE_POLICY.serviceCapabilitySignals?.verbTerms),
  customWorkTerms: uniqueTerms(BASE_LANGUAGE_POLICY.serviceCapabilitySignals?.customWorkTerms),
  installationTerms: uniqueTerms(
    BASE_LANGUAGE_POLICY.serviceCapabilitySignals?.installationTerms,
  ),
}

export const getDomainSupportSignals = (tenantRuntimePolicy = null) => {
  const vocabulary = getVocabulary(tenantRuntimePolicy)
  const productContextTerms = uniqueTerms(vocabulary?.productContextTerms)
  const supportComponentTerms = uniqueTerms(vocabulary?.supportComponentTerms)

  return {
    componentStems: supportComponentTerms.length
      ? supportComponentTerms
      : DOMAIN_SUPPORT_ES_SIGNALS.componentStems,
    productContextStems: productContextTerms.length
      ? productContextTerms
      : DOMAIN_SUPPORT_ES_SIGNALS.productContextStems,
  }
}

export const getCatalogStructureSignals = (tenantRuntimePolicy = null) => {
  const vocabulary = getVocabulary(tenantRuntimePolicy)
  return {
    carrierTerms: uniqueTerms(vocabulary?.catalogCarrierTerms),
    structuralTerms: uniqueTerms(vocabulary?.catalogStructuralTerms),
    structuralPhrases: uniqueTerms(vocabulary?.catalogStructuralPhrases),
  }
}

export const hasGenericHelpSignal = (value) => {
  const normalized = normalizeSemanticText(value)
  if (!normalized) {
    return false
  }

  return hasConfiguredTerm(normalized, GENERIC_HELP_TERMS)
}

export const looksLikeIncompleteSeedSignal = (value) => {
  const normalized = normalizeSemanticText(value)
  if (!normalized) {
    return false
  }

  return INCOMPLETE_INPUTS.has(normalized)
}

export const detectServiceCapabilityHints = (value, tenantRuntimePolicy = null) => {
  const normalized = normalizeSemanticText(value)
  if (!normalized) {
    return {
      serviceCapabilityHint: false,
      installationCapabilityHint: false,
      customWorkCapabilityHint: false,
    }
  }

  const capabilityVerbPresent = hasConfiguredTerm(
    normalized,
    SERVICE_CAPABILITY_SIGNAL_TERMS.verbTerms,
  )
  const customWorkCapabilityHint = hasConfiguredTerm(
    normalized,
    SERVICE_CAPABILITY_SIGNAL_TERMS.customWorkTerms,
  )
  const installationCapabilityHint = hasConfiguredTerm(normalized, [
    ...SERVICE_CAPABILITY_SIGNAL_TERMS.installationTerms,
    ...(getBusinessRules(tenantRuntimePolicy)?.installationTerms ?? []),
  ])
  const serviceCapabilityHint =
    capabilityVerbPresent &&
    (customWorkCapabilityHint || installationCapabilityHint)

  return {
    serviceCapabilityHint,
    installationCapabilityHint: serviceCapabilityHint && installationCapabilityHint,
    customWorkCapabilityHint: serviceCapabilityHint && customWorkCapabilityHint,
  }
}

const CONVERSATIONAL_GREETING_PREFIX =
  /^(?:hola|buen dia|buenos dias|buen día|buenos días|buenas tardes|buenas noches|que tal|qué tal|como estas|cómo estás)\b\s*/iu

const SCHEDULE_ADMINISTRATIVE_PHONE_REGEX = /\b(?:\+?\d[\d\s-]{6,}\d)\b/u
const SCHEDULE_ADMINISTRATIVE_ADDRESS_SHAPE_REGEX =
  /\b[a-záéíóúñ.'-]{2,}(?:\s+[a-záéíóúñ.'-]{2,}){1,4}\s+\d{1,5}(?![.,]\d)\b/iu

export const stripConversationalGreetingPrefix = (value) =>
  normalizeSemanticText(value).replace(CONVERSATIONAL_GREETING_PREFIX, '').trim()

export const hasScheduleSeedSignal = (value) => {
  const normalized = normalizeSemanticText(value)
  if (!normalized) {
    return false
  }

  const tokens = tokenizeSemanticText(normalized)

  if (
    countStemMatches(tokens, ['coordin', 'agend', 'program', 'visit', 'cita', 'dispon']) >= 1
  ) {
    return true
  }

  if (hasPhraseMatch(normalized, BASE_CONVERSATIONAL_ES_SIGNALS.schedule.seedPhrases)) {
    return true
  }

  const hasContextualScheduleStem =
    countStemMatches(tokens, ['instal', 'coloc', 'venir']) >= 1

  if (!hasContextualScheduleStem) {
    return false
  }

  return (
    hasScheduleAdministrativeSignal(normalized) ||
    /\b(cuando|cuándo|podri\w*|pued\w*|a que hora|a qué hora|los espero|las espero|te espero)\b/u.test(
      normalized,
    )
  )
}

export const hasScheduleAdministrativeSignal = (value) => {
  const normalized = stripConversationalGreetingPrefix(value)
  if (!normalized) {
    return false
  }

  return (
    countStemMatches(
      tokenizeSemanticText(normalized),
      BASE_CONVERSATIONAL_ES_SIGNALS.schedule.administrativeStems,
    ) >= 1 ||
    hasPhraseMatch(
      normalized,
      BASE_CONVERSATIONAL_ES_SIGNALS.schedule.administrativePhrases,
    ) ||
    /\b\d{1,2}\/\d{1,2}(?:\/\d{4})?\b/.test(String(value || '')) ||
    /\b(?:a\s+las|a\s+la|tipo|hora|horario)\s+\d{1,2}(?::\d{2})?\b/iu.test(
      String(value || ''),
    ) ||
    /\b\d{1,2}:\d{2}\b/.test(String(value || '')) ||
    /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/iu.test(String(value || '')) ||
    SCHEDULE_ADMINISTRATIVE_PHONE_REGEX.test(String(value || '')) ||
    SCHEDULE_ADMINISTRATIVE_ADDRESS_SHAPE_REGEX.test(String(value || ''))
  )
}

const SCHEDULE_STATUS_FOLLOW_UP_REGEX =
  /\b(?:alguna\s+novedad|novedades?|pudiste|pudieron|confirmaron|confirmaste|avisaron|avisaste|entonces)\b/u

export const hasScheduleStatusFollowUpSignal = (value) => {
  const normalized = stripConversationalGreetingPrefix(value)
  if (!normalized) {
    return false
  }

  return SCHEDULE_STATUS_FOLLOW_UP_REGEX.test(normalized)
}

const QUANTITY_ONLY_FOLLOW_UP_REGEX =
  /^\s*(?:(?:necesito|quiero|preciso|seria|serían|serian|son)\s+)?(\d{1,4})(?:\s+(?:unidades?|items?|item|piezas?))?\s*$/iu

export const hasQuantityOnlyFollowUpSignal = (value) =>
  QUANTITY_ONLY_FOLLOW_UP_REGEX.test(String(value || ''))

export const detectStandaloneAttachmentArtifactKind = (value) => {
  const raw = String(value || '').replace(/^[\u200e\u200f\u202a-\u202e]+/g, '')
  const normalized = raw.toLowerCase().replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return null
  }

  if (/^<?\s*multimedia omitido\s*>?$/.test(normalized)) {
    return 'placeholder'
  }

  if (/^<?\s*imagen omitida\s*>?$/.test(normalized)) {
    return 'image'
  }

  if (/^<?\s*audio omitido\s*>?$/.test(normalized)) {
    return 'audio'
  }

  if (/^<?\s*video omitido\s*>?$/.test(normalized)) {
    return 'video'
  }

  if (
    /^(?:ptt-[a-z0-9-]+\.opus|[a-z0-9_.-]+\.(?:opus|ogg|mp3|wav|m4a))(?:\s*\(archivo adjunto\))?$/.test(
      normalized,
    )
  ) {
    return 'audio'
  }

  if (
    /^(?:img-[a-z0-9-]+\.(?:jpg|jpeg|png|webp)|[a-z0-9_.-]+\.(?:jpg|jpeg|png|webp|gif))(?:\s*\(archivo adjunto\))?$/.test(
      normalized,
    )
  ) {
    return 'image'
  }

  if (
    /^(?:vid-[a-z0-9-]+\.(?:mp4|mov|avi|webm|mpeg|mpg)|[a-z0-9_.-]+\.(?:mp4|mov|avi|webm|mpeg|mpg))(?:\s*\(archivo adjunto\))?$/.test(
      normalized,
    )
  ) {
    return 'video'
  }

  if (
    /^[a-z0-9_.-]+\.(?:pdf|doc|docx|xls|xlsx|csv|txt)(?:\s*\(archivo adjunto\))?$/.test(
      normalized,
    ) ||
    normalized === 'archivo adjunto'
  ) {
    return 'document'
  }

  return null
}

export const hasAttachmentReferenceSignal = (value) => {
  const normalized = normalizeSemanticText(value)
  if (!normalized) {
    return false
  }

  return (
    detectStandaloneAttachmentArtifactKind(value) !== null ||
    hasConfiguredTerm(normalized, ATTACHMENT_REFERENCE_TERMS)
  )
}

export const hasMultimodalReferenceSignal = (value) => {
  const normalized = normalizeSemanticText(value)
  if (!normalized) {
    return false
  }

  return hasPhraseMatch(normalized, BASE_CONVERSATIONAL_ES_SIGNALS.multimodal.referentialPhrases)
}

export const hasMultimodalPlannedArtifactSignal = (value) => {
  const normalized = normalizeSemanticText(value)
  if (!normalized) {
    return false
  }

  if (
    hasPhraseMatch(
      normalized,
      BASE_CONVERSATIONAL_ES_SIGNALS.multimodal.plannedArtifactPhrases,
    )
  ) {
    return true
  }

  return (
    /\b(foto|fotos|imagen|imagenes|captura|audio|video|archivo|adjunto)\b/.test(
      normalized,
    ) &&
    /\b(envi|mando|mandar|paso|pasar|adjunt|saco|sacar|comparto)\b/.test(normalized)
  )
}

export const hasMultimodalPlaceholderSignal = (value) => {
  const normalized = normalizeSemanticText(value)
  if (!normalized) {
    return false
  }

  return hasPhraseMatch(normalized, BASE_CONVERSATIONAL_ES_SIGNALS.multimodal.placeholderPhrases)
}

export const hasReengagementReferenceSignal = (value) => {
  const normalized = normalizeSemanticText(value)
  if (!normalized) {
    return false
  }

  return hasPhraseMatch(
    normalized,
    BASE_CONVERSATIONAL_ES_SIGNALS.reengagement.referentialPhrases,
  )
}

export const looksLikeQuoteExpansionSignal = (value, tenantRuntimePolicy = null) => {
  const normalized = stripConversationalGreetingPrefix(value)
  if (!normalized) {
    return false
  }

  if (hasPhraseMatch(normalized, BASE_CONVERSATIONAL_ES_SIGNALS.quote.expansionPhrases)) {
    return true
  }

  const tokens = tokenizeSemanticText(normalized)
  const domainSignals = getDomainSupportSignals(tenantRuntimePolicy)
  const productVocabulary = [
    ...domainSignals.productContextStems,
    ...(getVocabulary(tenantRuntimePolicy)?.quoteItemTerms ?? []),
  ]
  const hasExpansionAction =
    countStemMatches(tokens, BASE_CONVERSATIONAL_ES_SIGNALS.quote.expansionActionStems) >= 1
  const hasExpansionQuantity =
    countStemMatches(tokens, BASE_CONVERSATIONAL_ES_SIGNALS.quote.expansionQuantityStems) >= 1
  const hasProductContext =
    countStemMatches(tokens, domainSignals.productContextStems) >= 1 ||
    hasConfiguredTerm(normalized, productVocabulary)

  return hasExpansionAction && hasExpansionQuantity && hasProductContext
}

export const looksLikeCatalogStructureSignal = (value, tenantRuntimePolicy = null) => {
  const normalized = stripConversationalGreetingPrefix(value)
  if (!normalized) {
    return false
  }

  const catalogSignals = getCatalogStructureSignals(tenantRuntimePolicy)

  if (hasPhraseMatch(normalized, catalogSignals.structuralPhrases)) {
    return true
  }

  const tokens = tokenizeSemanticText(normalized)
  const structuralMatches = countStemMatches(tokens, catalogSignals.structuralTerms)
  const hasCatalogCarrier = hasConfiguredTerm(normalized, catalogSignals.carrierTerms)

  return hasCatalogCarrier && structuralMatches >= 2
}

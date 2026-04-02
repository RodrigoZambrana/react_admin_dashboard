import {
  looksLikePaymentOperationalUpdate,
  looksLikePaymentProofArtifact,
  looksLikePaymentProofFollowUpRequest,
  looksLikeQuoteClarificationRequest,
  looksLikeQuoteRequirementsQuestion,
  looksLikeQuoteWaitingFollowUp,
} from '../intents/customer-intent-patterns.js'
import { looksLikeCustomerSupportComponentReplacementRequest } from '../intents/customer-operational-heuristics.js'
import {
  formatQuoteResolutionAmount,
  formatQuoteResolutionArea,
} from '../intents/customer-quote-resolution.js'
import {
  extractTenantFamilyLabel,
  findBestTenantTopicMatch,
  isContextualTopicDescriptorMatch,
} from '../intents/customer-topic-taxonomy.js'
import { detectStandaloneAttachmentArtifactKind } from '../intents/customer-semantic-signals.js'
import {
  filterResolvedConversationFields,
  resolveNextConversationField,
} from '../conversation/conversation-state.js'
import { localePrefersEnglish, normalizeChatLocale } from '../locale-format.js'
import { pickWordingVariant } from './wording-registry.js'

const normalizeLightInput = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()
const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const LIGHT_CLOSURE_ONLY_PATTERN =
  /^(?:ok|dale|perfecto|listo|gracias|muchas gracias|saludos?|buen dia|buenos dias|buenas tardes|buenas noches|claro|bien|genial|barbaro|b[aá]rbaro)(?:\s+(?:ok|dale|perfecto|listo|gracias|muchas gracias|saludos?|buen dia|buenos dias|buenas tardes|buenas noches|claro|bien|genial|barbaro|b[aá]rbaro))*$/u
const QUOTE_DEFERRAL_PATTERN =
  /\b(vemos?\s+mas\s+adelante|vemos?\s+m[aá]s\s+adelante|lo\s+vemos?\s+mas\s+adelante|lo\s+vemos?\s+m[aá]s\s+adelante|por\s+ahora\s+no|por\s+ahora\s+no\s+puedo|mas\s+adelante|m[aá]s\s+adelante|otro\s+momento|despues\s+vemos|despu[eé]s\s+vemos|veo\s+y\s+me\s+comunico|te\s+aviso|les\s+aviso|despu[eé]s\s+te\s+aviso)\b/u
const QUOTE_VISIT_COORDINATION_PATTERN =
  /\b(medir|midan|midieras|midan\s+ustedes|pasen\s+a\s+medir|tomen\s+medidas|visita|coordinar|direccion|direcci[oó]n|ubicacion|ubicaci[oó]n|manana|ma[nñ]ana|lunes|martes|miercoles|mi[eé]rcoles|jueves|viernes|sabado|s[aá]bado|domingo|horario|a\s+las|no\s+puedo)\b/u

const dedupeStrings = (values = []) => {
  const seen = new Set()
  const result = []
  for (const value of values) {
    const clean = compactText(value)
    const key = normalizeLightInput(clean)
    if (!clean || !key || seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(clean)
  }
  return result
}

const formatNaturalList = (items = [], locale = 'es-UY') => {
  const cleanItems = dedupeStrings(items).slice(0, 3)
  if (!cleanItems.length) {
    return ''
  }
  if (cleanItems.length === 1) {
    return cleanItems[0]
  }
  if (cleanItems.length === 2) {
    const joiner = localePrefersEnglish(locale) ? ' and ' : ' y '
    return `${cleanItems[0]}${joiner}${cleanItems[1]}`
  }

  const lastItem = cleanItems.pop()
  const joiner = localePrefersEnglish(locale) ? ' and ' : ' y '
  return `${cleanItems.join(', ')}${joiner}${lastItem}`
}

const buildTermRegex = (terms = [], flags = 'iu') => {
  const cleanTerms = dedupeStrings(
    (Array.isArray(terms) ? terms : [terms])
      .map((entry) => compactText(entry))
      .filter(Boolean),
  )
    .map((entry) => normalizeLightInput(entry))
    .filter((entry) => entry.length >= 3)
    .sort((left, right) => right.length - left.length)

  if (!cleanTerms.length) {
    return null
  }

  return new RegExp(`\\b(?:${cleanTerms.map((entry) => escapeRegex(entry)).join('|')})\\b`, flags)
}

const readConversationState = (options = null, interpretation = null) =>
  options?.conversationState ||
  interpretation?.conversationState ||
  interpretation?.conversationContext?.conversationState ||
  null

const extractTenantCatalogTerms = (tenantTopicTaxonomy = []) =>
  dedupeStrings(
    (Array.isArray(tenantTopicTaxonomy) ? tenantTopicTaxonomy : []).flatMap((entry) => [
      entry?.label,
      entry?.familyLabel,
      ...(Array.isArray(entry?.aliases) ? entry.aliases : []),
      ...(Array.isArray(entry?.parentLabels) ? entry.parentLabels : []),
    ]),
  )

const extractPaymentTerms = (paymentMethods = []) =>
  dedupeStrings(
    (Array.isArray(paymentMethods) ? paymentMethods : []).flatMap((entry) => {
      const clean = compactText(entry)
      return [clean, ...clean.split(/[^a-z0-9áéíóúñ]+/iu)]
    }),
  ).filter((entry) => normalizeLightInput(entry).length >= 3)

const hasConfiguredPaymentSignal = (normalizedText, paymentMethods = []) => {
  if (!normalizedText) {
    return false
  }

  if (/\b(pago|pagos|abonar|abono|cobro)\b/.test(normalizedText)) {
    return true
  }

  const paymentRegex = buildTermRegex(extractPaymentTerms(paymentMethods))
  return Boolean(paymentRegex?.test(normalizedText))
}

const hasConfiguredInstallationSignal = (normalizedText, installationTerms = []) => {
  if (!normalizedText) {
    return false
  }

  const installationRegex = buildTermRegex(installationTerms)
  return Boolean(installationRegex?.test(normalizedText))
}

const looksLikeLightClosureOnly = (normalizedText) =>
  Boolean(normalizedText) && LIGHT_CLOSURE_ONLY_PATTERN.test(normalizedText)

const looksLikeQuoteDeferralFollowUp = (normalizedText) =>
  Boolean(normalizedText) && QUOTE_DEFERRAL_PATTERN.test(normalizedText)

const looksLikeQuoteVisitCoordinationFollowUp = (normalizedText) =>
  Boolean(normalizedText) && QUOTE_VISIT_COORDINATION_PATTERN.test(normalizedText)

const buildQuoteAmbiguousOptionLabels = (resolution, subjectLabel = '') => {
  const normalizedSubject = normalizeLightInput(subjectLabel)
  const subjectTokens = normalizedSubject
    .split(/\s+/)
    .filter((token) => token.length >= 3)
  const candidateProducts = Array.isArray(resolution?.candidateProducts)
    ? resolution.candidateProducts
    : []

  return dedupeStrings(
    candidateProducts
      .map((product) => {
        const rawLabel = compactText(product?.name || '')
        if (!rawLabel) {
          return null
        }

        const labelTokens = rawLabel.split(/\s+/)
        const filteredTokens = labelTokens.filter((token) => {
          const normalizedToken = normalizeLightInput(token)
          return (
            normalizedToken &&
            !subjectTokens.includes(normalizedToken) &&
            !/^\d{2,4}(?:x\d{2,4})?$/.test(normalizedToken)
          )
        })

        const simplifiedLabel = compactText(filteredTokens.join(' '))
        if (
          simplifiedLabel &&
          simplifiedLabel.length >= 4 &&
          normalizeLightInput(simplifiedLabel) !== normalizedSubject
        ) {
          return simplifiedLabel
        }

        return rawLabel
      })
      .filter(Boolean),
  )
}

const buildQuoteAmbiguousOptionsClause = (resolution, locale, subjectLabel = '') => {
  const optionLabels = buildQuoteAmbiguousOptionLabels(resolution, subjectLabel)
  if (!optionLabels.length) {
    return localePrefersEnglish(locale)
      ? 'There is more than one published configuration that could fit this request.'
      : 'Hay más de una configuración publicada que puede encajar con ese pedido.'
  }

  const optionsList = formatNaturalList(optionLabels, locale)
  return localePrefersEnglish(locale)
    ? `The closest ones here are ${optionsList}.`
    : `Las que mejor encajan acá son ${optionsList}.`
}

const QUOTE_SUBJECT_STOP_WORDS = new Set([
  'de',
  'del',
  'para',
  'por',
  'con',
  'sin',
  'el',
  'la',
  'los',
  'las',
  'mi',
  'mis',
  'tu',
  'tus',
  'su',
  'sus',
])
const QUOTE_SUBJECT_LEADING_NOISE_REGEX = /^(?:pero|porque|si|igual|aunque|y)\b/u
const QUOTE_SUBJECT_NARRATIVE_FRAGMENT_REGEX =
  /\b(?:esta|está|estan|están|es|son|tengo|tenemos|quiero|necesito|preciso|habria|habría|reparar|cambiar)\b/u
const GENERIC_QUOTE_SUBJECT_LABELS = new Set([
  'cotizar',
  'cotizacion',
  'presupuesto',
  'precio',
  'precios',
])

const isGenericQuoteSubjectLabel = (value) => {
  const normalized = normalizeLightInput(value)
  if (!normalized) {
    return false
  }

  if (GENERIC_QUOTE_SUBJECT_LABELS.has(normalized)) {
    return true
  }

  return /^(?:quiero|necesito|preciso|busco|seria|serian)?\s*(?:una?\s+)?(?:cotizar|cotizacion|presupuesto|precio|precios)$/u.test(
    normalized,
  )
}

const sanitizeQuoteSubjectLabel = (
  value,
  tenantTopicTaxonomy = [],
  { preferTaxonomyLabel = true } = {},
) => {
  const clean = compactText(value)
  const normalized = normalizeLightInput(clean)
  if (!normalized) {
    return null
  }

  if (
    /^\d+(?:[.,]\d+)?$/u.test(normalized) ||
    /^(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)$/u.test(normalized)
  ) {
    return null
  }

  const directTopicMatch =
    preferTaxonomyLabel && Array.isArray(tenantTopicTaxonomy) && tenantTopicTaxonomy.length
      ? findBestTenantTopicMatch(clean, tenantTopicTaxonomy, {
          kinds: ['product_family', 'product_topic', 'product_variant'],
        })
      : null
  if (preferTaxonomyLabel && directTopicMatch?.label) {
    return directTopicMatch.label
  }

  const tokens = normalized.split(/\s+/u).filter(Boolean)
  if (!tokens.length) {
    return null
  }

  if (
    QUOTE_SUBJECT_STOP_WORDS.has(tokens[0]) &&
    !tokens.some((token) => token.length >= 5 && !QUOTE_SUBJECT_STOP_WORDS.has(token))
  ) {
    return null
  }

  if (/^(?:de|del|para|por|con|sin)\b/u.test(normalized)) {
    return null
  }

  if (/^(?:el|la|los|las|mi|mis|tu|tus|su|sus)\b/u.test(normalized) && tokens.length <= 6) {
    return null
  }

  if (
    !directTopicMatch &&
    tokens.length >= 4 &&
    (QUOTE_SUBJECT_LEADING_NOISE_REGEX.test(normalized) ||
      QUOTE_SUBJECT_NARRATIVE_FRAGMENT_REGEX.test(normalized))
  ) {
    return null
  }

  if (isGenericQuoteSubjectLabel(normalized)) {
    return null
  }

  return clean
}

const sanitizeQuoteSubjectPhrase = (value) =>
  sanitizeQuoteSubjectLabel(value, [], { preferTaxonomyLabel: false })

const looksLikeMetaQuoteQuestion = (value) => {
  const normalized = normalizeLightInput(value)
  if (!normalized) {
    return false
  }

  return (
    /\b(?:en|de)?\s*que\s+pued(?:o|es|e|en)\s+cotizar\b/u.test(normalized) ||
    /\bque\s+me\s+pued(?:e|en)\s+cotizar\b/u.test(normalized) ||
    /\ben\s+que\s+trabajan\b/u.test(normalized)
  )
}

const trimTrailingSentencePunctuation = (value) =>
  compactText(String(value || '').replace(/[,\s.;:]+$/g, ''))

const looksLikeClosureContinuationResponse = (text) =>
  /(cuando quieras retomarlo, seguimos por aca|cualquier cosa me escribis|quedo por aca)/i.test(
    normalizeLightInput(text),
  )

const buildClosureContinuationReply = (previousAgentText = '') =>
  looksLikeClosureContinuationResponse(previousAgentText)
    ? 'Dale, cualquier cosa me escribís.'
    : 'Perfecto. Cuando quieras retomarlo, seguimos por acá.'

const looksLikeSafeScheduleAddress = (value) => {
  const compacted = trimTrailingSentencePunctuation(value)
  const normalized = normalizeLightInput(compacted)
  if (!normalized) {
    return false
  }

  const wordCount = compacted.split(/\s+/u).filter(Boolean).length
  const hasAddressMarker =
    /\b(avenida|av\.?|calle|ruta|camino|bulevar|blvr|esquina|esq|km|kilometro|kilómetro|manzana|solar|apto|apartamento|local|zona|barrio)\b/iu.test(
      compacted,
    ) || /\d/.test(compacted)
  const looksNarrative =
    /\b(buen(?:os|as)?|realizamos|vamos a realizar|se agrega|trajeron|cambio de|lo que dice|est[aá] es la|esta es la|la vamos a|con ustedes)\b/iu.test(
      compacted,
    )

  if (looksNarrative) {
    return false
  }

  if (hasAddressMarker) {
    return true
  }

  return wordCount > 0 && wordCount <= 4
}

const toDisplayName = (value) =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 1)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ')

const extractCustomerIntroName = (text) => {
  const match = String(text || '').match(
    /\b(?:mi nombre es|me llamo|soy)\s+([a-záéíóúñ]+(?:\s+[a-záéíóúñ]+)?)/iu,
  )
  return match?.[1] ? toDisplayName(match[1]) : null
}

const DEFAULT_GREETING_TEMPLATES = {
  customerDefault: 'Hola. ¿En qué podemos ayudarte hoy?',
  customerMorning: 'Buenos días. ¿En qué podemos ayudarte?',
  customerAfternoon: 'Buenas tardes. ¿En qué podemos ayudarte hoy?',
  customerConsultation: 'Hola. Claro, cuéntanos tu consulta.',
  customerHelp: 'Hola. Claro, ¿con qué te ayudamos?',
  adminDefault: 'Hola. ¿En qué te ayudo hoy?',
}

const resolveGreetingTemplates = (config = {}) => {
  const source = config && typeof config === 'object' ? config : {}

  return {
  customerDefault:
    typeof source.customerGreetingDefault === 'string' && source.customerGreetingDefault.trim()
      ? source.customerGreetingDefault.trim()
      : DEFAULT_GREETING_TEMPLATES.customerDefault,
  customerMorning:
    typeof source.customerGreetingMorning === 'string' && source.customerGreetingMorning.trim()
      ? source.customerGreetingMorning.trim()
      : DEFAULT_GREETING_TEMPLATES.customerMorning,
  customerAfternoon:
    typeof source.customerGreetingAfternoon === 'string' && source.customerGreetingAfternoon.trim()
      ? source.customerGreetingAfternoon.trim()
      : DEFAULT_GREETING_TEMPLATES.customerAfternoon,
  customerConsultation:
    typeof source.customerGreetingConsultation === 'string' &&
    source.customerGreetingConsultation.trim()
      ? source.customerGreetingConsultation.trim()
      : DEFAULT_GREETING_TEMPLATES.customerConsultation,
  customerHelp:
    typeof source.customerGreetingHelp === 'string' && source.customerGreetingHelp.trim()
      ? source.customerGreetingHelp.trim()
      : DEFAULT_GREETING_TEMPLATES.customerHelp,
  adminDefault:
    typeof source.adminGreetingDefault === 'string' && source.adminGreetingDefault.trim()
      ? source.adminGreetingDefault.trim()
      : DEFAULT_GREETING_TEMPLATES.adminDefault,
  }
}

const renderCustomerGreeting = (input, config) => {
  const templates = resolveGreetingTemplates(config)
  const normalizedInput = normalizeLightInput(input)

  if (/^buenos dias\b/.test(normalizedInput)) {
    return templates.customerMorning
  }
  if (/^buenas tardes\b/.test(normalizedInput)) {
    return templates.customerAfternoon
  }
  if (/^buenas(?:[,.]|\s)*tengo una consulta\b/.test(normalizedInput)) {
    return templates.customerConsultation
  }
  if (/^hola(?:[,.]|\s)*necesito ayuda\b/.test(normalizedInput)) {
    return templates.customerHelp
  }
  return templates.customerDefault
}

export const renderLightConversationText = ({ audience, kind, input = '', config = null }) => {
  const templates = resolveGreetingTemplates(config)
  if (audience === 'admin') {
    if (kind === 'thanks') {
      return 'Perfecto. Si quieres, sigo contigo con la próxima gestión.'
    }
    if (kind === 'ack') {
      return 'Perfecto. Cuando quieras, sigo con eso.'
    }
    if (kind === 'status_check') {
      return 'Todo bien por acá. Decime qué gestión quieres resolver y la preparamos.'
    }
    return templates.adminDefault
  }

  if (kind === 'thanks') {
    return 'Perfecto. Si quieres, seguimos con tu consulta.'
  }
  if (kind === 'ack') {
    return 'Perfecto. Cuando quieras, seguimos.'
  }
  if (kind === 'status_check') {
    return 'Todo bien por acá. ¿En qué podemos ayudarte?'
  }
  return renderCustomerGreeting(input, config)
}

const resolveCustomerLightKind = (input) => {
  const normalized = normalizeLightInput(input)
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

export const buildCustomerClarifyRequestText = (input) => {
  const normalized = normalizeLightInput(input)
  const name = extractCustomerIntroName(input)
  let salutation = null

  if (/^buenos dias\b/.test(normalized)) {
    salutation = 'Buenos días'
  } else if (/^buenas tardes\b/.test(normalized)) {
    salutation = 'Buenas tardes'
  } else if (/^buenas noches\b/.test(normalized)) {
    salutation = 'Buenas noches'
  } else if (/^(hola|buenas)\b/.test(normalized)) {
    salutation = 'Hola'
  }

  const prefix = salutation
    ? `${salutation}${name ? `, ${name}` : ''}. `
    : name
      ? `${name}, `
      : ''

  return `${prefix}Claro, ¿sobre qué te gustaría información?`
}

export const buildCustomerRephraseRequestText = () =>
  'Claro. Si quieres, te lo explico de otra forma. Dime qué parte no quedó clara.'

export const buildCustomerUnintelligibleText = () =>
  'Disculpe, no entendimos su consulta. ¿Puede indicarnos en qué podemos ayudarle?'

export const buildCustomerIncompleteText = (input) => {
  const normalized = normalizeLightInput(input)
  const attachmentArtifactKind = detectStandaloneAttachmentArtifactKind(input)

  if (attachmentArtifactKind === 'audio') {
    return 'Recibí el audio. Si querés, decime en una línea qué necesitás revisar y lo seguimos por acá.'
  }

  if (attachmentArtifactKind === 'image') {
    return 'Recibí la imagen. Si querés, contame en una línea qué necesitás ver o cotizar y seguimos por acá.'
  }

  if (attachmentArtifactKind === 'video') {
    return 'Recibí el video. Si querés, decime en una línea qué necesitás revisar o cotizar y seguimos por acá.'
  }

  if (attachmentArtifactKind === 'document') {
    return 'Recibí el archivo. Si querés, indicame en una línea qué necesitás revisar y lo seguimos por acá.'
  }

  if (/^(necesito|preciso)\b/.test(normalized)) {
    return 'Claro. ¿Qué necesitas exactamente?'
  }

  if (/^(quiero|quisiera|me interesa|busco)\b/.test(normalized)) {
    return 'Claro. ¿Qué te gustaría consultar?'
  }

  return 'Claro. ¿Podrías darme un poco más de detalle para ayudarte mejor?'
}

const resolveQuoteSubjectLabel = (interpretation = null, tenantTopicTaxonomy = []) => {
  const quoteContextTopicLabel =
    looksLikeMetaQuoteQuestion(interpretation?.quoteContext?.topicLabel)
      ? null
      : interpretation?.quoteContext?.topicLabel
  const quoteContextVariantLabel = sanitizeQuoteSubjectLabel(
    interpretation?.quoteContext?.variantLabel || '',
    tenantTopicTaxonomy,
  )
  const quoteContextSubjectLabel =
    quoteContextTopicLabel && quoteContextVariantLabel
      ? normalizeLightInput(quoteContextTopicLabel).includes(
          normalizeLightInput(quoteContextVariantLabel),
        )
        ? quoteContextTopicLabel
        : compactText(`${quoteContextTopicLabel} ${quoteContextVariantLabel}`)
      : quoteContextTopicLabel || quoteContextVariantLabel || null
  const normalizedQuoteContextTopicLabel = normalizeLightInput(quoteContextTopicLabel || '')
  const activeThreadResolvedLabel = sanitizeQuoteSubjectLabel(
    interpretation?.threadResolution?.activeThread?.resolvedLabel || '',
    tenantTopicTaxonomy,
  )
  const activeThreadBaseLabel = sanitizeQuoteSubjectLabel(
    interpretation?.threadResolution?.activeThread?.baseLabel || '',
    tenantTopicTaxonomy,
  )
  const activeThreadLabel = activeThreadResolvedLabel || activeThreadBaseLabel || null
  const normalizedActiveThreadLabel = normalizeLightInput(activeThreadLabel || '')
  const quoteContextTopicIsMoreSpecificThanActiveThread =
    normalizedQuoteContextTopicLabel &&
    (!normalizedActiveThreadLabel ||
      normalizedQuoteContextTopicLabel.includes(normalizedActiveThreadLabel) ||
      quoteContextTopicLabel.split(/\s+/u).length >
        String(activeThreadLabel || '').split(/\s+/u).length)
  if (!quoteContextTopicIsMoreSpecificThanActiveThread && activeThreadLabel) {
    return activeThreadLabel
  }

  const currentTopicType = String(interpretation?.topic?.type || '')
  const currentTopicRaw =
    interpretation?.topic &&
    ['product_family', 'product_topic', 'product_variant'].includes(currentTopicType)
      ? interpretation.topic.label
      : null
  const currentContextTopicRaw =
    interpretation?.contextTopic &&
    ['product_family', 'product_topic', 'product_variant'].includes(
      String(interpretation.contextTopic.type || ''),
    )
      ? interpretation.contextTopic.label
      : null
  const currentTopic = looksLikeMetaQuoteQuestion(currentTopicRaw) ? null : currentTopicRaw
  const currentContextTopic = looksLikeMetaQuoteQuestion(currentContextTopicRaw)
    ? null
    : currentContextTopicRaw
  const referenceText = [
    currentContextTopic,
    currentTopic,
  ]
    .filter(Boolean)
    .join(' ')
  const familyLabel =
    extractTenantFamilyLabel(referenceText, tenantTopicTaxonomy) ||
    interpretation?.quoteContext?.familyLabel ||
    null
  const currentTurnSpecificTopic = findBestTenantTopicMatch(
    interpretation?.currentTurnText || '',
    tenantTopicTaxonomy,
    {
      kinds: ['product_topic', 'product_variant'],
    },
  )
  const currentTurnSpecificTopicIsContextualDescriptor = isContextualTopicDescriptorMatch(
    currentTurnSpecificTopic,
    interpretation?.currentTurnText || '',
  )
  const currentTurnSpecificTopicAlias = normalizeLightInput(
    currentTurnSpecificTopic?.matchedAlias || '',
  )
  const currentTurnSpecificTopicConflictsWithContext =
    currentTurnSpecificTopic?.kind === 'product_topic' &&
    currentTurnSpecificTopicAlias &&
    !currentTurnSpecificTopicAlias.includes(' ') &&
    currentTurnSpecificTopic?.familyLabel &&
    familyLabel &&
    normalizeLightInput(currentTurnSpecificTopic.familyLabel) !==
      normalizeLightInput(familyLabel) &&
    new RegExp(
      `\\b(?:en|con|sin|otro\\s+con|otra\\s+con)\\s+${currentTurnSpecificTopicAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
      'i',
    ).test(normalizeLightInput(interpretation?.currentTurnText || ''))

  if (
    currentTurnSpecificTopic?.label &&
    !currentTurnSpecificTopicIsContextualDescriptor &&
    !currentTurnSpecificTopicConflictsWithContext &&
    (currentTopicType === 'product_family' || !currentTopic)
  ) {
    return currentTurnSpecificTopic.label
  }

  if (
    currentTopic &&
    currentTopicType === 'product_variant' &&
    familyLabel &&
    !normalizeLightInput(currentTopic).includes(normalizeLightInput(familyLabel))
  ) {
    return `${familyLabel} ${currentTopic}`.replace(/\s+/g, ' ').trim()
  }

  const normalizedCurrentTopic = normalizeLightInput(currentTopic || '')
  const quoteContextTopicIsMoreSpecific =
    normalizedQuoteContextTopicLabel &&
    (!normalizedCurrentTopic ||
      normalizedQuoteContextTopicLabel.includes(normalizedCurrentTopic) ||
      quoteContextTopicLabel.split(/\s+/u).length > String(currentTopic || '').split(/\s+/u).length)

  if (quoteContextTopicIsMoreSpecific) {
    const cleanQuoteContextTopic = sanitizeQuoteSubjectLabel(
      quoteContextSubjectLabel,
      tenantTopicTaxonomy,
    )
    if (cleanQuoteContextTopic) {
      return cleanQuoteContextTopic
    }
  }

  const candidates = [
    quoteContextSubjectLabel,
    currentTopic,
    familyLabel,
    currentContextTopic,
    interpretation?.quoteContext?.familyLabel || null,
  ]

  for (const candidate of candidates) {
    const cleanCandidate = sanitizeQuoteSubjectLabel(candidate, tenantTopicTaxonomy)
    if (cleanCandidate) {
      return cleanCandidate
    }
  }

  return null
}

const formatQuoteMissingFields = (missingAttributes = []) => {
  const labels = missingAttributes
    .map((attribute) =>
      typeof attribute?.label === 'string' && attribute.label.trim()
        ? attribute.label.trim()
        : typeof attribute?.key === 'string'
          ? attribute.key
          : null,
    )
    .filter(Boolean)
  if (!labels.length) {
    return ''
  }
  if (labels.length === 1) {
    return labels[0]
  }
  if (labels.length === 2) {
    return `${labels[0]} y ${labels[1]}`
  }
  return `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}`
}

const buildNextQuoteMissingPrompt = ({
  missingAttributes = [],
  prefix = 'Si querés, confirmame',
  fallback = 'Lo dejo sumado como referencia para la cotización y seguimos por acá.',
} = {}) => {
  const firstMissing = Array.isArray(missingAttributes)
    ? missingAttributes.find((entry) => entry && typeof entry === 'object')
    : null
  const label =
    typeof firstMissing?.label === 'string' && firstMissing.label.trim()
      ? firstMissing.label.trim()
      : typeof firstMissing?.key === 'string' && firstMissing.key.trim()
        ? firstMissing.key.trim().replace(/[_-]+/g, ' ')
        : null

  return label ? `${prefix} ${label}.` : fallback
}

const formatQuoteMeasurementSummary = (quoteContext = null) => {
  const items = Array.isArray(quoteContext?.measurementItems)
    ? quoteContext.measurementItems.filter((entry) => entry?.displayLabel)
    : []

  if (items.length > 1) {
    return 'con las medidas indicadas'
  }

  const singleMeasurement =
    compactText(quoteContext?.measurements?.displayLabel || '') ||
    compactText(items[0]?.displayLabel || '')

  if (!singleMeasurement) {
    return null
  }

  return `de ${singleMeasurement}`
}

const buildQuoteHandoffSummary = ({
  quoteContext = null,
  subject = 'la configuración solicitada',
}) => {
  const quantity =
    typeof quoteContext?.quantity?.total === 'number' &&
    Number.isFinite(quoteContext.quantity.total) &&
    quoteContext.quantity.total > 0
      ? quoteContext.quantity.total
      : null
  const measurementSummary = formatQuoteMeasurementSummary(quoteContext)

  if (quantity && measurementSummary) {
    return `para ${quantity} ${quantity === 1 ? 'unidad' : 'unidades'} de ${subject} ${measurementSummary}`.replace(
      /\s+/g,
      ' ',
    ).trim()
  }

  if (quantity) {
    return `para ${quantity} ${quantity === 1 ? 'unidad' : 'unidades'} de ${subject}`.replace(
      /\s+/g,
      ' ',
    ).trim()
  }

  if (measurementSummary) {
    return `para ${subject} ${measurementSummary}`.replace(/\s+/g, ' ').trim()
  }

  return `para ${subject}`
}

const buildQuoteTechnicalReviewTail = (interpretation = null, locale = 'es-UY') => {
  const currentTurnText = compactText(interpretation?.currentTurnText || '')
  if (!/\b(dividir|partes|apertura|recomendacion|recomendación|tecnica|técnica)\b/i.test(currentTurnText)) {
    return ''
  }

  return localePrefersEnglish(locale)
    ? ' If any technical recommendation or split suggestion is needed, an advisor will include it in the follow-up.'
    : ' Si hace falta alguna recomendación técnica o definir cómo conviene dividirlo, un asesor lo revisa en el seguimiento.'
}

const QUOTE_SUBJECT_DESCRIPTOR_STOP_TOKENS = new Set([
  'de',
  'del',
  'la',
  'el',
  'los',
  'las',
])

const deriveCatalogSpecificQuoteDescriptor = (subjectLabel = '', candidateProducts = []) => {
  const subjectTokens = new Set(
    normalizeLightInput(subjectLabel)
      .split(/\s+/u)
      .filter(Boolean),
  )
  const productNames = Array.isArray(candidateProducts)
    ? candidateProducts
        .map((entry) => compactText(entry?.name || ''))
        .filter(Boolean)
    : []
  if (productNames.length < 2) {
    return null
  }

  const tokenLists = productNames.map((name) =>
    Array.from(
      new Set(
        normalizeLightInput(name)
          .split(/[^a-z0-9áéíóúñü]+/iu)
          .filter((token) => token.length >= 4),
      ),
    ),
  )
  const commonTokens = tokenLists[0].filter((token) =>
    tokenLists.every((list) => list.includes(token)),
  )
  const descriptor = commonTokens.find(
    (token) =>
      !subjectTokens.has(token) && !QUOTE_SUBJECT_DESCRIPTOR_STOP_TOKENS.has(token),
  )
  return descriptor || null
}

const buildQuoteAttributeMaps = (quoteContext = null) => {
  const profileAttributes = Array.isArray(quoteContext?.profileAttributes)
    ? quoteContext.profileAttributes.filter((entry) => entry && typeof entry === 'object')
    : []
  const attributeMap = new Map(
    profileAttributes.map((entry) => [String(entry.key || '').trim(), entry]),
  )
  const capturedEntries =
    quoteContext?.capturedAttributes && typeof quoteContext.capturedAttributes === 'object'
      ? Object.entries(quoteContext.capturedAttributes)
          .filter(([key, value]) => key && value && typeof value === 'object')
      : []

  return {
    attributeMap,
    capturedEntries,
  }
}

const buildDecoratedQuoteSubject = (subjectLabel = null, quoteContext = null) => {
  const cleanSubject = compactText(subjectLabel)
  const { attributeMap, capturedEntries } = buildQuoteAttributeMaps(quoteContext)
  const decorators = []

  for (const [key, entry] of capturedEntries) {
    if (key === 'measurements' || key === 'quantity') {
      continue
    }

    const attribute = attributeMap.get(key)
    const subjectPrefix =
      typeof attribute?.subjectPrefix === 'string' && attribute.subjectPrefix.trim()
        ? attribute.subjectPrefix.trim()
        : null
    if (!subjectPrefix) {
      continue
    }

    const rawValue =
      typeof entry?.label === 'string' && entry.label.trim()
        ? entry.label.trim()
        : typeof entry?.value === 'string' && entry.value.trim()
          ? entry.value.trim()
          : null
    if (!rawValue) {
      continue
    }

    if (cleanSubject && new RegExp(`\\b${rawValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(cleanSubject)) {
      continue
    }

    decorators.push(
      subjectPrefix === 'con'
        ? `${subjectPrefix} ${rawValue}`
        : `${subjectPrefix} ${rawValue}`,
    )
  }

  return compactText([cleanSubject, ...decorators].filter(Boolean).join(' '))
}

const normalizeQuoteFieldKey = (value) => {
  const normalized = normalizeLightInput(value)
  if (!normalized) {
    return null
  }

  if (
    [
      'measurement',
      'measurements',
      'measurement_item',
      'measurement_items',
      'dimension',
      'dimensions',
      'size',
      'sizes',
    ].includes(normalized)
  ) {
    return 'measurements'
  }

  if (['quantity', 'qty', 'unit', 'units'].includes(normalized)) {
    return 'quantity'
  }

  if (['product', 'subject', 'topic'].includes(normalized)) {
    return 'product'
  }

  if (
    ['configuration', 'configuracion', 'config', 'option', 'options', 'profile', 'variant'].includes(
      normalized,
    )
  ) {
    return 'configuration'
  }

  return normalized
}

const buildSubjectAwareQuotePrompt = ({
  mode = 'quote',
  subjectLabel = null,
  nextUsefulField = null,
} = {}) => {
  const cleanSubject = compactText(subjectLabel)
  const normalizedField = normalizeQuoteFieldKey(nextUsefulField)
  const effectiveField =
    cleanSubject && normalizedField === 'product'
      ? 'measurements'
      : normalizedField || (cleanSubject ? 'measurements' : 'product')

  switch (effectiveField) {
    case 'measurements':
      return cleanSubject
        ? mode === 'price'
          ? `Claro. Para orientarte con el precio de ${cleanSubject}, pasame las medidas aproximadas.`
          : `Claro. Para cotizar ${cleanSubject}, pasame las medidas aproximadas.`
        : mode === 'price'
          ? 'Claro. Para orientarte con el precio, pasame las medidas aproximadas.'
          : 'Claro. Para prepararte un presupuesto, pasame las medidas aproximadas.'
    case 'quantity':
      return cleanSubject
        ? mode === 'price'
          ? `Claro. Para orientarte con el precio de ${cleanSubject}, decime cuántas unidades necesitás.`
          : `Claro. Para cotizar ${cleanSubject}, decime cuántas unidades necesitás.`
        : mode === 'price'
          ? 'Claro. Para orientarte con el precio, decime cuántas unidades necesitás.'
          : 'Claro. Para prepararte un presupuesto, decime cuántas unidades necesitás.'
    case 'configuration':
      return cleanSubject
        ? mode === 'price'
          ? `Claro. Para orientarte con el precio de ${cleanSubject}, decime qué opción o configuración buscás.`
          : `Claro. Para cotizar ${cleanSubject}, decime qué opción o configuración buscás.`
        : mode === 'price'
          ? 'Claro. Para orientarte con el precio, decime qué opción o configuración buscás.'
          : 'Claro. Para prepararte un presupuesto, decime qué opción o configuración buscás.'
    case 'product':
    default:
      return mode === 'price'
        ? 'Claro. ¿De qué producto o medida te gustaría saber el precio?'
        : 'Claro. Para prepararte un presupuesto, decime qué producto o solución te interesa y, si aplica, las medidas aproximadas.'
  }
}

const buildQuoteProgressText = ({
  mode = 'quote',
  currentTurnText = '',
  subjectLabel = null,
  interpretation = null,
  quoteContext = null,
  conversationState = null,
  tenantTopicTaxonomy = [],
  variationSeed = '',
  wordingOverrides = null,
}) => {
  const measurementLabel =
    quoteContext?.measurements?.confirmationLabel ||
    quoteContext?.measurements?.displayLabel ||
    null
  const canonicalIntermediateContract =
    interpretation?.canonicalIntermediateContract ||
    interpretation?.conversationContext?.canonicalIntermediateContract ||
    null
  const canonicalResponseDirectives =
    interpretation?.canonicalResponseDirectives ||
    interpretation?.conversationContext?.canonicalResponseDirectives ||
    null
  const canonicalSubjectLabel = compactText(
    canonicalResponseDirectives?.subjectLabel ||
      canonicalIntermediateContract?.quoteSeed?.subjectLabel ||
      '',
  )
  const canonicalNextUsefulField = compactText(
    canonicalResponseDirectives?.nextUsefulField ||
      canonicalIntermediateContract?.renderPlan?.nextUsefulField ||
      canonicalIntermediateContract?.quoteSeed?.nextUsefulField ||
      '',
  )
  const canonicalHandoffAllowed =
    canonicalResponseDirectives?.handoffAllowed === true ||
    canonicalIntermediateContract?.outcome?.handoffAllowed === true
  const rememberedSubject =
    sanitizeQuoteSubjectPhrase(conversationState?.slots?.product?.value || '') || ''
  const requestedSubject =
    sanitizeQuoteSubjectPhrase(canonicalSubjectLabel || subjectLabel || '') || ''
  const cleanSubject =
    rememberedSubject &&
    (!requestedSubject ||
      normalizeLightInput(rememberedSubject).includes(normalizeLightInput(requestedSubject)) ||
      rememberedSubject.split(/\s+/u).length > requestedSubject.split(/\s+/u).length)
      ? rememberedSubject
      : requestedSubject
  const genericQuoteSubject = isGenericQuoteSubjectLabel(cleanSubject)
  const topicRecognized =
    quoteContext?.topicRecognized === true && genericQuoteSubject !== true
  const profileResolved =
    quoteContext?.profileResolved === true && genericQuoteSubject !== true
  const decoratedSubject = buildDecoratedQuoteSubject(cleanSubject, quoteContext)
  const unresolvedMissingFields = filterResolvedConversationFields({
    missingFields: Array.isArray(quoteContext?.missingFields)
      ? quoteContext.missingFields
      : [],
    conversationState,
  })
  const missingAttributes = Array.isArray(quoteContext?.missingAttributes)
    ? quoteContext.missingAttributes.filter((entry) => entry && typeof entry === 'object')
    : Array.isArray(quoteContext?.requiredAttributes)
      ? quoteContext.requiredAttributes.filter(
          (entry) =>
            entry &&
            typeof entry === 'object' &&
            unresolvedMissingFields.includes(entry.key),
        )
      : []
  const missingLabel = formatQuoteMissingFields(missingAttributes)
  const mentionedTopics = Array.isArray(quoteContext?.mentionedTopics)
    ? quoteContext.mentionedTopics
        .map((entry) => String(entry?.label || '').trim())
        .filter(Boolean)
    : []
  const measurementItems = Array.isArray(quoteContext?.measurementItems)
    ? quoteContext.measurementItems.filter((entry) => entry && typeof entry === 'object')
    : []
  const measurementItemCount = measurementItems.length
  const hasMultipleMeasurementItems = measurementItemCount > 1
  const mixedPricingStrategies = Boolean(quoteContext?.mixedPricingStrategies)

  if (quoteContext?.multiTopic && mixedPricingStrategies && mentionedTopics.length > 1) {
    const topicList =
      mentionedTopics.length === 2
        ? `${mentionedTopics[0]} y ${mentionedTopics[1]}`
        : `${mentionedTopics.slice(0, -1).join(', ')} y ${mentionedTopics.at(-1)}`

    if (measurementLabel || Number(quoteContext?.quantity?.total || 0) > 0) {
      return `Perfecto. Veo que la solicitud mezcla ${topicList}. Como requieren una resolución distinta, dejo la cotización en seguimiento para que un asesor la revise completa y te responda a la brevedad.`
    }

    return `Perfecto. Podemos revisar ${topicList}. Como la solicitud mezcla productos con distinta forma de cotización, conviene dejar cada uno por separado o derivarlo a un asesor. Si querés, pasame las medidas y la configuración de cada uno y lo dejamos encaminado.`
  }

  if (quoteContext?.multiTopic && mentionedTopics.length > 1) {
    const topicList =
      mentionedTopics.length === 2
        ? `${mentionedTopics[0]} y ${mentionedTopics[1]}`
        : `${mentionedTopics.slice(0, -1).join(', ')} y ${mentionedTopics.at(-1)}`
    return `Perfecto. Podemos revisar ${topicList}. Para avanzar con la cotización, pasame las medidas y la configuración de cada una por separado, o decime con cuál querés empezar.`
  }

  if (quoteContext?.completionStatus === 'ready_for_handoff') {
    if (looksLikeQuoteWaitingFollowUp(currentTurnText)) {
      return pickWordingVariant({
        key: 'customer.quote.waiting_followup',
        variationSeed,
        overrides: wordingOverrides,
        fallback:
          'Perfecto. Quedó en seguimiento. Si hace falta algún dato adicional, te lo piden por aquí.',
      })
    }
    const quantity = Number(quoteContext?.quantity?.total || 0)
    const measurementItems = Array.isArray(quoteContext?.measurementItems)
      ? quoteContext.measurementItems
      : []
    const detailParts = []

    if (quantity > 0) {
      detailParts.push(quantity === 1 ? '1 unidad' : `${quantity} unidades`)
    }

    if (measurementItems.length > 1) {
      detailParts.push(
        measurementItems.length === 1
          ? 'la medida indicada'
          : `${measurementItems.length} medidas indicadas`,
      )
    } else if (measurementLabel) {
      detailParts.push(measurementLabel)
    }

    const handoffIntro =
      detailParts.length > 0
        ? decoratedSubject
          ? `Perfecto. Ya tengo ${detailParts.join(' y ')} para ${decoratedSubject}.`
          : `Perfecto. Ya tengo ${detailParts.join(' y ')} para la solicitud.`
        : decoratedSubject
          ? `Perfecto. Ya quedó encaminada la solicitud de ${decoratedSubject}.`
          : 'Perfecto. Ya quedó encaminada la solicitud.'

    const readyHandoffClose = pickWordingVariant({
      key: 'customer.quote.handoff_ready',
      variationSeed,
      overrides: wordingOverrides,
      fallback:
        'Le enviamos la cotización a la brevedad. Si hace falta algún dato adicional, un asesor del equipo se comunica para continuar.',
    })
    return `${handoffIntro} ${readyHandoffClose}`.trim()
  }

  if (looksLikeQuoteClarificationRequest(currentTurnText)) {
    return pickWordingVariant({
      key: 'customer.quote.clarification_followup',
      variationSeed,
      overrides: wordingOverrides,
      fallback:
        'Claro. Para no cambiarte nada de lo ya cotizado, dejo la aclaración en seguimiento para revisión del total y de los detalles a la brevedad.',
    })
  }

  if (
    quoteContext?.completionStatus === 'ready_for_pricing_or_handoff' &&
    !missingLabel
  ) {
    return null
  }

  if (!topicRecognized) {
    if (cleanSubject) {
      return buildSubjectAwareQuotePrompt({
        mode,
        subjectLabel: buildDecoratedQuoteSubject(cleanSubject, quoteContext) || cleanSubject,
        nextUsefulField: canonicalNextUsefulField,
      })
    }

    if (measurementItems.length > 1) {
      return `Perfecto. Tomo ${measurementItems.length} medidas aproximadas. Para avanzar con la cotización, decime también qué producto o solución buscás.`
    }

    if (measurementLabel) {
      return `Perfecto. Tomo una medida aproximada de ${measurementLabel}. Para avanzar con la cotización, decime también qué producto o solución buscás.`
    }

    return mode === 'price'
      ? 'Claro. Para orientarte con el precio, decime de qué producto o medida se trata.'
      : 'Claro. Para prepararte un presupuesto, decime qué producto o solución te interesa y, si aplica, las medidas aproximadas.'
  }

  if (!profileResolved) {
    const hasQuantity = Number(quoteContext?.quantity?.total || 0) > 0
    const genericMissing = []
    if (!measurementLabel) {
      genericMissing.push('las medidas aproximadas (ancho por alto)')
    }
    if (!hasQuantity) {
      genericMissing.push('cuántas unidades necesitás')
    }
    const genericMissingLabel = formatQuoteMissingFields(
      genericMissing.map((label, index) => ({
        key: `generic_${index}`,
        label,
      })),
    )

    if ((hasMultipleMeasurementItems || measurementLabel) && hasQuantity) {
      if (canonicalHandoffAllowed) {
        return decoratedSubject
          ? `Perfecto. Ya tengo una base para la cotización de ${decoratedSubject}. Si el caso requiere validación adicional, un asesor continúa con el siguiente paso.`
          : 'Perfecto. Ya tengo una base para la cotización. Si el caso requiere validación adicional, un asesor continúa con el siguiente paso.'
      }
    }

    if (decoratedSubject && genericMissingLabel) {
      return `Claro. Para tomar la solicitud de cotización de ${decoratedSubject}, decime ${genericMissingLabel}.`
    }

    if (genericMissingLabel) {
      return `Claro. Para tomar la solicitud de cotización, decime ${genericMissingLabel}.`
    }
  }

  if (hasMultipleMeasurementItems || measurementLabel) {
    const intro = hasMultipleMeasurementItems
      ? decoratedSubject
        ? `Perfecto. Tomo ${measurementItemCount} medidas aproximadas para ${decoratedSubject}.`
        : `Perfecto. Tomo ${measurementItemCount} medidas aproximadas.`
      : decoratedSubject
        ? `Perfecto. Tomo una medida aproximada de ${measurementLabel} para ${decoratedSubject}.`
        : `Perfecto. Tomo una medida aproximada de ${measurementLabel}.`
    const followUp = missingLabel
      ? mode === 'price'
        ? decoratedSubject
          ? `Para orientarte mejor con el precio de ${decoratedSubject}, decime también ${missingLabel}.`
          : `Para orientarte mejor con el precio, decime también ${missingLabel}.`
        : decoratedSubject
          ? `Para avanzar con la cotización de ${decoratedSubject}, decime también ${missingLabel}.`
          : `Para avanzar con la cotización, decime también ${missingLabel}.`
      : mode === 'price'
        ? decoratedSubject
          ? `Para orientarte mejor con el precio de ${decoratedSubject}, decime también la opción o configuración que buscás.`
          : 'Para orientarte mejor con el precio, decime también qué producto o configuración buscás.'
        : decoratedSubject
          ? `Para avanzar con la cotización de ${decoratedSubject}, decime también la opción o configuración que buscás.`
          : 'Para avanzar con la cotización, decime también qué producto o configuración buscás.'
    return `${intro} ${followUp}`
  }

  if (missingLabel && decoratedSubject) {
    return mode === 'price'
      ? `Claro. Para orientarte con el precio de ${decoratedSubject}, decime ${missingLabel}.`
      : `Claro. Para prepararte un presupuesto de ${decoratedSubject}, decime ${missingLabel}.`
  }

  if (quoteContext?.requiresMeasurements && cleanSubject) {
    return mode === 'price'
      ? `Claro. Para orientarte con el precio de ${cleanSubject}, decime las medidas aproximadas y la configuración que tenés en mente.`
      : `Claro. Para prepararte un presupuesto de ${cleanSubject}, decime las medidas aproximadas y la configuración que tenés en mente.`
  }

  return null
}

export const buildCustomerPriceInquiryText = (input, options = {}) => {
  const normalized = normalizeLightInput(input)
  const interpretation =
    options?.interpretation && typeof options.interpretation === 'object'
      ? options.interpretation
      : null
  const conversationState = readConversationState(options, interpretation)
  const tenantTopicTaxonomy = Array.isArray(options?.tenantTopicTaxonomy)
    ? options.tenantTopicTaxonomy
    : []
  const quoteContext =
    interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
      ? interpretation.quoteContext
      : null
  const quoteProgressText = buildQuoteProgressText({
    mode: 'price',
    currentTurnText: input,
    subjectLabel: resolveQuoteSubjectLabel(interpretation, tenantTopicTaxonomy),
    interpretation,
    quoteContext,
    conversationState,
    tenantTopicTaxonomy,
    variationSeed: options?.variationSeed,
    wordingOverrides: options?.wordingOverrides,
  })

  if (quoteProgressText) {
    return quoteProgressText
  }

  if (looksLikeQuoteRequirementsQuestion(normalized)) {
    const referenceText = [
      interpretation?.contextTopic?.label,
      interpretation?.topic?.label,
    ]
      .filter(Boolean)
      .join(' ')
    const familyLabel = extractTenantFamilyLabel(
      referenceText,
      tenantTopicTaxonomy,
    )
    if (familyLabel) {
      return `Para cotizar ${familyLabel}, decime las medidas aproximadas y la configuración que tenés en mente.`
    }
    return 'Para orientarte con una cotización, decime las medidas aproximadas y la configuración que tenés en mente.'
  }

  if (/\b(precio|precios)\b/.test(normalized)) {
    return 'Claro. ¿De qué producto o medida te gustaría saber el precio?'
  }

  return 'Claro. ¿Qué producto te interesa para poder orientarte mejor con el precio?'
}

export const buildCustomerQuoteRequestText = (input, options = {}) => {
  const normalized = normalizeLightInput(input)
  const interpretation =
    options?.interpretation && typeof options.interpretation === 'object'
      ? options.interpretation
      : null
  const conversationState = readConversationState(options, interpretation)
  const tenantTopicTaxonomy = Array.isArray(options?.tenantTopicTaxonomy)
    ? options.tenantTopicTaxonomy
    : []
  const quoteContext =
    interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
      ? interpretation.quoteContext
      : null
  const quoteWaitingFollowUp =
    looksLikeQuoteWaitingFollowUp(normalized) &&
    Boolean(
      quoteContext?.measurements ||
        (Array.isArray(quoteContext?.measurementItems) &&
          quoteContext.measurementItems.length > 0) ||
        Number(quoteContext?.quantity?.total || 0) > 0 ||
        interpretation?.contextTopic?.label,
    )
  const hasQuoteThreadContext = Boolean(
    quoteContext?.measurements ||
      (Array.isArray(quoteContext?.measurementItems) &&
        quoteContext.measurementItems.length > 0) ||
      Number(quoteContext?.quantity?.total || 0) > 0 ||
      interpretation?.contextTopic?.label ||
      interpretation?.topic?.label ||
      quoteContext?.topicLabel ||
      quoteContext?.familyLabel,
  )

  if (quoteWaitingFollowUp) {
    return buildCustomerQuoteWaitingFollowUpText({
      input,
      variationSeed: options?.variationSeed,
      wordingOverrides: options?.wordingOverrides,
      channel: options?.channel || null,
      channelProfile: options?.channelProfile || null,
    })
  }

  if (
    hasQuoteThreadContext &&
    (looksLikeLightClosureOnly(normalized) || looksLikeQuoteDeferralFollowUp(normalized))
  ) {
    return buildClosureContinuationReply(conversationState?.context?.lastBotMessage || '')
  }

  if (
    hasQuoteThreadContext &&
    looksLikeQuoteVisitCoordinationFollowUp(normalized)
  ) {
    return 'Perfecto. Si preferís que la midamos nosotros, pasame la zona o dirección y qué día u horario te queda bien, y coordinamos la visita.'
  }

  const quoteProgressText = buildQuoteProgressText({
    mode: 'quote',
    currentTurnText: input,
    subjectLabel: resolveQuoteSubjectLabel(interpretation, tenantTopicTaxonomy),
    interpretation,
    quoteContext,
    conversationState,
    tenantTopicTaxonomy,
    variationSeed: options?.variationSeed,
    wordingOverrides: options?.wordingOverrides,
  })

  if (quoteProgressText) {
    return quoteProgressText
  }

  const measurementLabel =
    quoteContext?.measurements?.confirmationLabel ||
    quoteContext?.measurements?.displayLabel ||
    null
  const measurementItems = Array.isArray(quoteContext?.measurementItems)
    ? quoteContext.measurementItems.filter((entry) => entry && typeof entry === 'object')
    : []
  if (measurementItems.length > 1) {
    return `Perfecto. Tomo ${measurementItems.length} medidas aproximadas. Para avanzar con la cotización, decime también qué producto o solución buscás.`
  }
  if (measurementLabel) {
    return `Perfecto. Tomo una medida aproximada de ${measurementLabel}. Para avanzar con la cotización, decime también qué producto o solución buscás.`
  }

  const referenceText = [
    interpretation?.contextTopic?.label,
    interpretation?.topic?.label,
  ]
    .filter(Boolean)
    .join(' ')
  const familyLabel = extractTenantFamilyLabel(referenceText, tenantTopicTaxonomy)

  if (familyLabel) {
    return `Claro. Para prepararte un presupuesto de ${familyLabel}, decime qué opción buscas y, si aplica, las medidas aproximadas.`
  }

  if (/\b(presupuesto|cotizacion|cotización|cotizar)\b/.test(normalized)) {
    return 'Claro. Para prepararte un presupuesto, decime qué producto o solución te interesa y, si aplica, las medidas aproximadas.'
  }

  return 'Claro. Contame qué querés cotizar y, si aplica, las medidas aproximadas.'
}

export const buildCustomerQuoteResolutionText = (resolution, options = {}) => {
  if (!resolution || typeof resolution !== 'object') {
    return null
  }

  const variationSeed = String(options?.variationSeed || '')
  const interpretation =
    options?.interpretation && typeof options.interpretation === 'object'
      ? options.interpretation
      : null
  const interpretedSubject = resolveQuoteSubjectLabel(
    interpretation,
    Array.isArray(options?.tenantTopicTaxonomy) ? options.tenantTopicTaxonomy : [],
  )
  const quoteContext =
    interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
      ? interpretation.quoteContext
      : null
  const tenantTopicTaxonomy = Array.isArray(options?.tenantTopicTaxonomy)
    ? options.tenantTopicTaxonomy
    : []
  const rememberedSubject =
    sanitizeQuoteSubjectPhrase(options?.conversationState?.slots?.product?.value || '') ||
    ''
  const locale = normalizeChatLocale(options?.locale)
  const prefersEnglish = localePrefersEnglish(locale)
  const rawBaseSubject =
    interpretedSubject ||
    compactText(resolution.subjectLabel || '') ||
    'la configuración solicitada'
  const baseSubject =
    rememberedSubject &&
    (!rawBaseSubject ||
      normalizeLightInput(rememberedSubject).includes(normalizeLightInput(rawBaseSubject)) ||
      rememberedSubject.split(/\s+/u).length > rawBaseSubject.split(/\s+/u).length)
      ? rememberedSubject
      : rawBaseSubject
  const catalogSpecificDescriptor = deriveCatalogSpecificQuoteDescriptor(
    baseSubject,
    resolution?.candidateProducts,
  )
  const refinedBaseSubject =
    catalogSpecificDescriptor &&
    !normalizeLightInput(baseSubject).includes(catalogSpecificDescriptor)
      ? compactText(`${baseSubject} ${catalogSpecificDescriptor}`)
      : baseSubject
  const exactProductLabel = compactText(resolution?.productMatch?.name || '')
  const resolvedSubjectBase =
    resolution?.strategy === 'immediate_unit_price' && exactProductLabel
      ? exactProductLabel
      : refinedBaseSubject
  const decoratedSubject =
    buildDecoratedQuoteSubject(resolvedSubjectBase, quoteContext) || resolvedSubjectBase
  const handoffSummary = buildQuoteHandoffSummary({
    quoteContext,
    subject: decoratedSubject,
  })
  const technicalReviewTail = buildQuoteTechnicalReviewTail(interpretation, locale)
  const quantity =
    typeof resolution.quantity === 'number' && Number.isFinite(resolution.quantity)
      ? resolution.quantity
      : null
  const totalAmount = formatQuoteResolutionAmount(
    resolution.currency,
    resolution.totalAmount,
    locale,
  )
  const readyHandoffClose = pickWordingVariant({
    key: 'customer.quote.handoff_ready',
    variationSeed,
    overrides: options?.wordingOverrides,
    fallback:
      prefersEnglish
        ? 'Thanks for the information. We will send you the quote shortly. If any extra detail is needed, one of our advisors will contact you to continue.'
        : 'Gracias por la información enviada. Le enviamos la cotización a la brevedad. Si hace falta algún dato adicional, un asesor del equipo se comunica para continuar.',
  })

  if (resolution.status === 'product_not_found') {
    if (resolution.productNotFoundSubtype === 'catalog_match_ambiguous') {
      const optionsClause = buildQuoteAmbiguousOptionsClause(
        resolution,
        locale,
        decoratedSubject,
      )
      return pickWordingVariant({
        key: 'customer.quote.ambiguous_options',
        variationSeed,
        overrides: options?.wordingOverrides,
        channel: options?.channel || null,
        channelProfile: options?.channelProfile || null,
        variables: {
          subject: decoratedSubject,
          optionsClause,
        },
        fallback: prefersEnglish
          ? `For ${decoratedSubject}, I have more than one possible option. ${optionsClause} If you want, I can tell you the difference or you can tell me which one you want quoted.`
          : `Para ${decoratedSubject} tengo más de una opción posible. ${optionsClause} Si querés, te cuento la diferencia o me decís cuál querés cotizar.`,
      })
    }
    if (resolution.productNotFoundSubtype === 'catalog_present_but_strategy_unavailable') {
      return (
        prefersEnglish
          ? `I already have the information needed ${handoffSummary}. Right now I cannot find a published configuration with immediate pricing to resolve it automatically.${technicalReviewTail} ${readyHandoffClose}`
          : `Ya tengo los datos necesarios ${handoffSummary}. En este momento no encuentro una configuración publicada con precio inmediato para resolverla automáticamente.${technicalReviewTail} ${readyHandoffClose}`
      ).trim()
    }
    if (resolution.productNotFoundSubtype === 'catalog_present_without_immediate_price') {
      return (
        prefersEnglish
          ? `I already have the information needed ${handoffSummary}. There is a catalog option, but it does not have an immediate published price to answer you right away.${technicalReviewTail} ${readyHandoffClose}`
          : `Ya tengo los datos necesarios ${handoffSummary}. Existe una opción en catálogo, pero no tiene un precio inmediato publicado para responderte en el momento.${technicalReviewTail} ${readyHandoffClose}`
      ).trim()
    }
    if (resolution.productNotFoundSubtype === 'catalog_missing_but_known_in_knowledge') {
      return (
        prefersEnglish
          ? `I can guide you with the general information available about ${decoratedSubject}, but I do not currently have a published configuration with immediate pricing.${technicalReviewTail} ${readyHandoffClose}`
          : `Puedo orientarte con información general disponible sobre ${decoratedSubject}, pero ahora no tengo una configuración publicada con precio inmediato.${technicalReviewTail} ${readyHandoffClose}`
      ).trim()
    }
    return (
      prefersEnglish
        ? `I already have the information needed ${handoffSummary}. Right now I cannot find a published option with immediate pricing for that configuration.${technicalReviewTail} ${readyHandoffClose}`
        : `Ya tengo los datos necesarios ${handoffSummary}. En este momento no encuentro una opción publicada con precio inmediato para esa configuración.${technicalReviewTail} ${readyHandoffClose}`
    ).trim()
  }

  if (resolution.status === 'needs_handoff') {
    if (resolution.detail === 'immediate_preview_unavailable') {
      return (
        prefersEnglish
          ? `I already have the information needed ${handoffSummary}. Since there is no reliable automatic calculation available right now,${technicalReviewTail} ${readyHandoffClose.charAt(0).toLowerCase()}${readyHandoffClose.slice(1)}`
          : `Ya tengo los datos necesarios ${handoffSummary}. Como no hay una resolución automática confiable para calcularla en este momento,${technicalReviewTail} ${readyHandoffClose.charAt(0).toLowerCase()}${readyHandoffClose.slice(1)}`
      ).trim()
    }
    if (resolution.detail === 'external_parametric_quote_required') {
      return (
        prefersEnglish
          ? `I already have the information needed ${handoffSummary}. Since this configuration requires external review and quoting,${technicalReviewTail} ${readyHandoffClose.charAt(0).toLowerCase()}${readyHandoffClose.slice(1)}`
          : `Ya tengo los datos necesarios ${handoffSummary}. Como esta configuración requiere revisión y cotización externa,${technicalReviewTail} ${readyHandoffClose.charAt(0).toLowerCase()}${readyHandoffClose.slice(1)}`
      ).trim()
    }
    return `${readyHandoffClose}${technicalReviewTail}`.trim()
  }

  if (resolution.status !== 'resolved' || !totalAmount) {
    return null
  }

  if (resolution.strategy === 'immediate_unit_price') {
    if (quantity && quantity > 1) {
      return prefersEnglish
        ? `Perfect. For ${quantity} units of ${decoratedSubject}, the estimated price is ${totalAmount}.`
        : `Perfecto. Para ${quantity} unidades de ${decoratedSubject}, el precio estimado es ${totalAmount}.`
    }
    return prefersEnglish
      ? `Perfect. For ${decoratedSubject}, the estimated price is ${totalAmount}.`
      : `Perfecto. Para ${decoratedSubject}, el precio estimado es ${totalAmount}.`
  }

  if (resolution.strategy === 'immediate_square_meter') {
    const totalArea =
      typeof resolution.totalAreaM2 === 'number' && Number.isFinite(resolution.totalAreaM2)
        ? formatQuoteResolutionArea(resolution.totalAreaM2, locale)
        : null
    const firstMeasurement =
      compactText(resolution.measurementLabel || '') ||
      compactText(resolution.items?.[0]?.displayLabel || '')

    if (Array.isArray(resolution.items) && resolution.items.length > 1) {
      const quantityLabel =
        quantity && quantity > 1 ? `${quantity} unidades de ` : ''
      const areaSuffix =
        totalArea
          ? prefersEnglish
            ? ` The calculation takes ${totalArea} m² in total.`
            : ` El cálculo toma ${totalArea} m² en total.`
          : ''
      return (
        prefersEnglish
          ? `Perfect. For ${quantityLabel}${decoratedSubject} with the indicated measurements, the estimated price is ${totalAmount}.${areaSuffix}`
          : `Perfecto. Para ${quantityLabel}${decoratedSubject} con las medidas indicadas, el precio estimado es ${totalAmount}.${areaSuffix}`
      ).trim()
    }

    if (quantity && quantity > 1 && firstMeasurement) {
      const areaSuffix =
        totalArea
          ? prefersEnglish
            ? ` The calculation takes ${totalArea} m² in total.`
            : ` El cálculo toma ${totalArea} m² en total.`
          : ''
      return (
        prefersEnglish
          ? `Perfect. For ${quantity} units of ${decoratedSubject} measuring ${firstMeasurement}, the estimated price is ${totalAmount}.${areaSuffix}`
          : `Perfecto. Para ${quantity} unidades de ${decoratedSubject} de ${firstMeasurement}, el precio estimado es ${totalAmount}.${areaSuffix}`
      ).trim()
    }

    if (firstMeasurement) {
      const areaSuffix =
        totalArea
          ? prefersEnglish
            ? ` The calculation takes ${totalArea} m² in total.`
            : ` El cálculo toma ${totalArea} m² en total.`
          : ''
      return (
        prefersEnglish
          ? `Perfect. For ${decoratedSubject} measuring ${firstMeasurement}, the estimated price is ${totalAmount}.${areaSuffix}`
          : `Perfecto. Para ${decoratedSubject} de ${firstMeasurement}, el precio estimado es ${totalAmount}.${areaSuffix}`
      ).trim()
    }

    return prefersEnglish
      ? `Perfect. For ${decoratedSubject}, the estimated price is ${totalAmount}.`
      : `Perfecto. Para ${decoratedSubject}, el precio estimado es ${totalAmount}.`
  }

  if (resolution.strategy === 'parametric_exact_or_handoff') {
    if (Array.isArray(resolution.items) && resolution.items.length > 1) {
      return prefersEnglish
        ? `Perfect. I found a ready quote for ${decoratedSubject} with the indicated measurements. The estimated total is ${totalAmount}.`
        : `Perfecto. Encontré una cotización lista para ${decoratedSubject} con las medidas indicadas. El total estimado es ${totalAmount}.`
    }
    if (quantity && quantity > 1) {
      return prefersEnglish
        ? `Perfect. I found a ready quote for ${quantity} units of ${decoratedSubject}. The estimated total is ${totalAmount}.`
        : `Perfecto. Encontré una cotización lista para ${quantity} unidades de ${decoratedSubject}. El total estimado es ${totalAmount}.`
    }
    return prefersEnglish
      ? `Perfect. I found a ready quote for ${decoratedSubject}. The estimated price is ${totalAmount}.`
      : `Perfecto. Encontré una cotización lista para ${decoratedSubject}. El precio estimado es ${totalAmount}.`
  }

  return null
}

export const buildCustomerSupportRequestText = (input, options = {}) => {
  const normalized = normalizeLightInput(input)
  const tenantTopicTaxonomy = Array.isArray(options?.tenantTopicTaxonomy)
    ? options.tenantTopicTaxonomy
    : []
  const paymentMethods = Array.isArray(options?.paymentMethods)
    ? options.paymentMethods
    : []
  const interpretation =
    options?.interpretation && typeof options.interpretation === 'object'
      ? options.interpretation
      : null
  const conversationState = readConversationState(options, interpretation)
  const supportContext =
    interpretation?.supportContext && typeof interpretation.supportContext === 'object'
      ? interpretation.supportContext
      : null
  const scheduleContext =
    interpretation?.scheduleContext && typeof interpretation.scheduleContext === 'object'
      ? interpretation.scheduleContext
      : null
  const supportTopicLabel = compactText(
    interpretation?.topic?.label || interpretation?.contextTopic?.label || '',
  )
  const supportSubject = supportTopicLabel
    ? `el producto ${supportTopicLabel}`
    : supportContext?.productType
      ? `el producto ${supportContext.productType}`
      : 'el producto instalado'
  const supportReviewStemPattern =
    /\b(repar\w*|revisi\w*|service|cambi\w*|ajust\w*|mover|acortar)\b/
  const supportVisitStemPattern =
    /\b(cuando|cuándo|podr\w*|pued\w*|venir|pasar|domicilio|visita|coordinar|manana|mañana|lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo|a las|\d{1,2}:\d{2})\b/
  const supportMaterialCompatibilityPattern =
    /\b(trabajan con|manejan|sirve|se puede|pueden)\b.*\b(material|materiales|tipo|este tipo|eso|esto)\b/
  const configuredProductRegex = buildTermRegex(extractTenantCatalogTerms(tenantTopicTaxonomy))
  const supportProductIdentificationPattern =
    /^(?:es|son)\s+(?:una|un|unas|unos)?\s*\S+/u
  const hasSupportVisitSignal = supportVisitStemPattern.test(normalized)
  const hasSupportPaymentSignal = hasConfiguredPaymentSignal(normalized, paymentMethods)
  const supportProductIdentificationDetected =
    supportProductIdentificationPattern.test(normalized) &&
    (Boolean(supportTopicLabel) ||
      Boolean(supportContext?.productType) ||
      Boolean(configuredProductRegex?.test(normalized)))
  const unresolvedSupportFields = filterResolvedConversationFields({
    missingFields: Array.isArray(supportContext?.missingFields)
      ? supportContext.missingFields
      : [],
    conversationState,
  })
  const firstMissingSupportField = resolveNextConversationField({
    missingFields: unresolvedSupportFields,
    conversationState,
  })
  const scheduleReason =
    supportReviewStemPattern.test(normalized) || looksLikeCustomerSupportComponentReplacementRequest(normalized)
      ? 'una revisión técnica'
      : scheduleContext?.reason || 'la visita técnica'
  const scheduleKnownParts = formatScheduleKnownParts(scheduleContext)
  const buildSupportVisitCaptureText = ({
    includePaymentMethods = false,
    includeCostTail = false,
  } = {}) => {
    const unresolvedScheduleFields = filterResolvedConversationFields({
      missingFields: Array.isArray(scheduleContext?.missingFields)
        ? scheduleContext.missingFields
        : [],
      conversationState,
    })
    const requestedFields = []

    if (unresolvedScheduleFields.includes('address')) {
      requestedFields.push('la dirección')
    }
    if (unresolvedScheduleFields.includes('contact')) {
      requestedFields.push('un teléfono o email de contacto')
    }
    if (unresolvedScheduleFields.includes('date')) {
      requestedFields.push('qué día te queda bien')
    }
    if (unresolvedScheduleFields.includes('time')) {
      requestedFields.push('qué horario te queda mejor')
    }

    if (!requestedFields.length) {
      if (!scheduleKnownParts.length) {
        requestedFields.push('la dirección y un teléfono o email de contacto')
      } else if (
        !scheduleContext?.address ||
        (!scheduleContext?.contactPhone && !scheduleContext?.contactEmail)
      ) {
        requestedFields.push('la dirección y un teléfono o email de contacto')
      }
    }

    const fieldsText =
      requestedFields.length === 0
        ? null
        : requestedFields.length === 1
          ? requestedFields[0]
          : `${requestedFields.slice(0, -1).join(', ')} y ${requestedFields.at(-1)}`
    const capturedText = scheduleKnownParts.length
      ? ` Por ahora tomo ${scheduleKnownParts.join(' · ')}.`
      : ''
    const configuredPaymentMethods = formatNaturalList(paymentMethods, options?.locale || 'es-UY')
    const paymentText = includePaymentMethods
      ? configuredPaymentMethods
        ? ` Aceptamos ${configuredPaymentMethods}.`
        : ''
      : ''
    const costText = includeCostTail
      ? ' El costo final y el medio de pago te lo confirmamos según lo que haya que revisar.'
      : ''

    if (!fieldsText) {
      return `Claro. Podemos coordinar una revisión para ver qué conviene hacer.${paymentText}${capturedText}${costText}`.trim()
    }

    return `Claro. Podemos coordinar una revisión para ver qué conviene hacer.${paymentText} Si te sirve, pasame ${fieldsText}.${capturedText}${costText}`.trim()
  }

  if (
    looksLikePaymentProofArtifact(normalized)
  ) {
    return 'Perfecto. Recibí el comprobante y lo dejo en seguimiento para confirmar la acreditación a la brevedad.'
  }

  if (looksLikePaymentProofFollowUpRequest(normalized)) {
    return 'Perfecto. Cuando lo envíes por acá, lo tomo y lo dejo en seguimiento para confirmar la acreditación a la brevedad.'
  }

  if (looksLikePaymentOperationalUpdate(normalized)) {
    return 'Perfecto. Cuando realices el pago, mandame el comprobante por acá y lo dejamos encaminado para confirmar la acreditación.'
  }

  if (
    supportContext?.productType &&
    firstMissingSupportField === 'issue' &&
    interpretation?.conversationContext?.waitForMore
  ) {
    return pickWordingVariant({
      key: 'customer.support.issue_followup_soft',
      variationSeed: String(options?.variationSeed || ''),
      variables: {
        subject: supportContext.productType,
      },
      overrides: options?.wordingOverrides || null,
      channel: options?.channel || null,
      channelProfile: options?.channelProfile || null,
      fallback: `Bien. Si es ${supportContext.productType}, contame qué habría que reparar o qué está fallando y seguimos desde ahí.`,
    })
  }

  if (firstMissingSupportField === 'product') {
    return pickWordingVariant({
      key: 'customer.support.ask_product_type',
      variationSeed: String(options?.variationSeed || ''),
      overrides: options?.wordingOverrides || null,
      channel: options?.channel || null,
      channelProfile: options?.channelProfile || null,
      fallback:
        'Claro. Para orientarte mejor, decime qué tipo de producto es y lo seguimos.',
    })
  }

  if (firstMissingSupportField === 'issue') {
    return pickWordingVariant({
      key: 'customer.support.ask_issue',
      variationSeed: String(options?.variationSeed || ''),
      variables: {
        subject: supportContext?.productType || supportSubject,
      },
      overrides: options?.wordingOverrides || null,
      channel: options?.channel || null,
      channelProfile: options?.channelProfile || null,
      fallback: `Perfecto. Si es ${supportContext?.productType || supportSubject}, contame qué problema tiene o qué habría que revisar.`,
    })
  }

  if (supportContext?.wantsVisit && supportContext?.issueSummary && !hasSupportPaymentSignal) {
    if (scheduleContext) {
      return buildCustomerScheduleProgressText(
        {
          ...scheduleContext,
          reason: scheduleReason,
        },
        {
          conversationState,
          locale: options?.locale,
          variationSeed: String(options?.variationSeed || ''),
          wordingOverrides: options?.wordingOverrides || null,
          channel: options?.channel || null,
          channelProfile: options?.channelProfile || null,
          currentTurnText: input,
        },
      )
    }

    return pickWordingVariant({
      key: 'customer.support.review_visit',
      variationSeed: String(options?.variationSeed || ''),
      overrides: options?.wordingOverrides || null,
      channel: options?.channel || null,
      channelProfile: options?.channelProfile || null,
      fallback: buildSupportVisitCaptureText(),
    })
  }

  if (
    supportProductIdentificationDetected &&
    !hasSupportVisitSignal &&
    !hasSupportPaymentSignal &&
    !supportReviewStemPattern.test(normalized)
  ) {
    return pickWordingVariant({
      key: 'customer.support.product_identification',
      variationSeed: String(options?.variationSeed || ''),
      variables: {
        subject: supportSubject,
      },
      overrides: options?.wordingOverrides || null,
      channel: options?.channel || null,
      channelProfile: options?.channelProfile || null,
      fallback: `Bien. Si es ${supportSubject}, contame qué habría que reparar o qué está fallando, y lo encaminamos.`,
    })
  }

  if (
    supportContext?.wantsVisit &&
    hasSupportPaymentSignal &&
    (hasSupportVisitSignal || scheduleContext)
  ) {
    return pickWordingVariant({
      key: 'customer.support.review_visit_payment',
      variationSeed: String(options?.variationSeed || ''),
      overrides: options?.wordingOverrides || null,
      channel: options?.channel || null,
      channelProfile: options?.channelProfile || null,
      fallback: buildSupportVisitCaptureText({
        includePaymentMethods: true,
        includeCostTail: true,
      }),
    })
  }

  if (scheduleContext && hasSupportVisitSignal && !hasSupportPaymentSignal) {
    return buildCustomerScheduleProgressText(
      {
        ...scheduleContext,
        reason: scheduleReason,
      },
      {
        conversationState,
        locale: options?.locale,
        variationSeed: String(options?.variationSeed || ''),
        wordingOverrides: options?.wordingOverrides || null,
        channel: options?.channel || null,
        channelProfile: options?.channelProfile || null,
        currentTurnText: input,
      },
    )
  }

  if (
    scheduleContext &&
    supportContext?.wantsVisit &&
    ['date', 'time', 'address', 'contact'].includes(String(firstMissingSupportField || ''))
  ) {
    return buildCustomerScheduleProgressText(
      {
        ...scheduleContext,
        reason: scheduleReason,
      },
      {
        conversationState,
        locale: options?.locale,
        variationSeed: String(options?.variationSeed || ''),
        wordingOverrides: options?.wordingOverrides || null,
        channel: options?.channel || null,
        channelProfile: options?.channelProfile || null,
        currentTurnText: input,
      },
    )
  }

  if (looksLikeCustomerSupportComponentReplacementRequest(normalized)) {
    if (/\b(cuanto|cuánto|costaria|costaría|costo|precio|saldria|saldría)\b/.test(normalized)) {
      return pickWordingVariant({
        key: 'customer.support.component_replacement_priced',
        variationSeed: String(options?.variationSeed || ''),
        variables: {
          subject: supportSubject,
        },
        overrides: options?.wordingOverrides || null,
        channel: options?.channel || null,
        channelProfile: options?.channelProfile || null,
        fallback: `Claro. Si es por cambio de un componente de ${supportSubject}, lo trabajamos como service. Para pasarte un costo más exacto necesito confirmar si es solo eso o si hay algo más para revisar. Si querés, mandame una foto y la zona o dirección, y lo encaminamos.`,
      })
    }

    return pickWordingVariant({
      key: 'customer.support.component_replacement',
      variationSeed: String(options?.variationSeed || ''),
      variables: {
        subject: supportSubject,
      },
      overrides: options?.wordingOverrides || null,
      channel: options?.channel || null,
      channelProfile: options?.channelProfile || null,
      fallback: `Claro. Si es por cambio de un componente de ${supportSubject}, lo trabajamos como service. Si querés, mandame una foto y la zona o dirección, y lo encaminamos.`,
    })
  }

  if (
    /\b(revisar|revision|revisión|cambiar|costaria|costaría|costaria|coste|costaría)\b/.test(
      normalized,
    ) &&
    (/\b(producto|motor|equipo|instalado)\b/.test(normalized) ||
      Boolean(configuredProductRegex?.test(normalized)))
  ) {
    return pickWordingVariant({
      key: 'customer.support.review_or_change',
      variationSeed: String(options?.variationSeed || ''),
      overrides: options?.wordingOverrides || null,
      channel: options?.channel || null,
      channelProfile: options?.channelProfile || null,
      fallback:
        'Claro. Podemos coordinar una revisión para ver si conviene reparar o cambiarlo. Si te sirve, pasame la zona o dirección y qué día u horario te queda mejor.',
    })
  }

  if (
    supportReviewStemPattern.test(normalized) &&
    hasSupportVisitSignal
  ) {
    if (scheduleContext) {
      return buildCustomerScheduleProgressText(scheduleContext, {
        conversationState,
        locale: options?.locale,
        variationSeed: String(options?.variationSeed || ''),
        wordingOverrides: options?.wordingOverrides || null,
        channel: options?.channel || null,
        channelProfile: options?.channelProfile || null,
        currentTurnText: input,
      })
    }

    return pickWordingVariant({
      key: 'customer.support.review_visit',
      variationSeed: String(options?.variationSeed || ''),
      overrides: options?.wordingOverrides || null,
      channel: options?.channel || null,
      channelProfile: options?.channelProfile || null,
      fallback: buildSupportVisitCaptureText(),
    })
  }

  if (supportMaterialCompatibilityPattern.test(normalized)) {
    return 'Sí, lo podemos revisar como service sobre lo ya instalado. Si querés, mandame una foto y la zona o dirección, y coordinamos cómo seguir.'
  }

  if (/\b(mover|acortar|ajustar|reubicar|cambiar de lugar)\b/.test(normalized)) {
    return 'Claro. Si necesitás mover, acortar o ajustar una instalación existente, mandame una foto y la zona o dirección, y coordinamos cómo seguir.'
  }

  if (/\b(dejo de funcionar|dejó de funcionar|no funciona|no anda)\b/.test(normalized)) {
    return 'Claro. Si es un producto ya instalado, lo trabajamos como revisión técnica. Si querés, mandame una foto y la zona o dirección, y coordinamos cómo seguir.'
  }

  return pickWordingVariant({
    key: 'customer.support.followup',
    variationSeed: String(options?.variationSeed || ''),
    overrides: options?.wordingOverrides || null,
    channel: options?.channel || null,
    channelProfile: options?.channelProfile || null,
    fallback:
      'Claro. Si necesitas service o una revisión, cuéntanos qué producto es y qué hay que ajustar, y coordinamos cómo seguir.',
  })
}

export const buildCustomerScheduleRequestText = (input, options = {}) => {
  const normalized = normalizeLightInput(input)
  const locale = normalizeChatLocale(options?.locale)
  const prefersEnglish = localePrefersEnglish(locale)

  if (hasConfiguredInstallationSignal(normalized, options?.installationTerms ?? [])) {
    return prefersEnglish
      ? 'Sure. To coordinate the installation, tell me the area or address and what day or time works best for you.'
      : 'Claro. Para coordinar la instalación, decime la zona o dirección y qué día u horario te queda mejor.'
  }

  return prefersEnglish
    ? 'Sure. We can coordinate a visit. Tell me the area or address and what day or time works best for you.'
    : 'Claro. Podemos coordinar una visita. Decime la zona o dirección y qué día u horario te queda mejor.'
}

const formatScheduleReasonForSentence = (reason) => {
  const normalized = compactText(reason)
  if (!normalized) {
    return 'la visita técnica'
  }
  if (/^la\s+/i.test(normalized) || /^una\s+/i.test(normalized)) {
    return normalized
  }
  if (/^visita\b/i.test(normalized)) {
    return `una ${normalized}`
  }
  if (/^instalaci[oó]n\b/i.test(normalized)) {
    return `la ${normalized}`
  }
  return normalized
}

const formatScheduleKnownParts = (scheduleContext = null) => {
  const parts = []
  const dateLabel =
    typeof scheduleContext?.date?.dateLabel === 'string'
      ? scheduleContext.date.dateLabel
      : null
  const timeLabel =
    typeof scheduleContext?.time?.timeLabel === 'string'
      ? scheduleContext.time.timeLabel
      : null

  if (dateLabel && timeLabel) {
    parts.push(`${dateLabel} a las ${timeLabel}`)
  } else if (dateLabel) {
    parts.push(dateLabel)
  } else if (timeLabel) {
    parts.push(timeLabel)
  }

  if (
    typeof scheduleContext?.address === 'string' &&
    scheduleContext.address.trim() &&
    looksLikeSafeScheduleAddress(scheduleContext.address)
  ) {
    parts.push(trimTrailingSentencePunctuation(scheduleContext.address))
  }

  return parts
}

export const buildCustomerScheduleProgressText = (
  scheduleContext = null,
  options = {},
) => {
  const locale = normalizeChatLocale(options?.locale)
  const prefersEnglish = localePrefersEnglish(locale)
  const variationSeed = String(options?.variationSeed || '')
  const wordingOverrides = options?.wordingOverrides || null
  const currentTurnText = String(options?.currentTurnText || '')
  const conversationState = options?.conversationState || null
  const missingFields = Array.isArray(scheduleContext?.missingFields)
    ? scheduleContext.missingFields
    : []
  const unresolvedMissingFields = filterResolvedConversationFields({
    missingFields,
    conversationState,
  })
  const knownParts = formatScheduleKnownParts(scheduleContext)
  const reason =
    formatScheduleReasonForSentence(scheduleContext?.reason || 'la visita técnica')
  const requestedField = resolveNextConversationField({
    requestedField:
      typeof options?.nextUsefulField === 'string' && options.nextUsefulField.trim()
        ? options.nextUsefulField.trim()
        : null,
    missingFields: unresolvedMissingFields,
    conversationState,
  })

  const renderSingleScheduleFieldAsk = (field) => {
    switch (field) {
      case 'date':
        return pickWordingVariant({
          key: 'customer.schedule.progress.ask_day',
          variationSeed,
          overrides: wordingOverrides,
          channel: options?.channel || null,
          channelProfile: options?.channelProfile || null,
          variables: { reason },
          fallback: prefersEnglish
            ? `Perfect. To coordinate ${reason}, tell me what day works for you.`
            : `Perfecto. Para coordinar ${reason}, decime qué día te queda bien.`,
        })
      case 'time':
        return pickWordingVariant({
          key: 'customer.schedule.progress.ask_time',
          variationSeed,
          overrides: wordingOverrides,
          channel: options?.channel || null,
          channelProfile: options?.channelProfile || null,
          variables: { reason },
          fallback: prefersEnglish
            ? `Perfect. To coordinate ${reason}, tell me a specific time that works for you.`
            : `Perfecto. Para coordinar ${reason}, decime un horario concreto que te sirva.`,
        })
      case 'address':
        return pickWordingVariant({
          key: 'customer.schedule.progress.ask_address',
          variationSeed,
          overrides: wordingOverrides,
          channel: options?.channel || null,
          channelProfile: options?.channelProfile || null,
          variables: { reason },
          fallback: prefersEnglish
            ? `Perfect. To coordinate ${reason}, send me the address where we would need to go.`
            : `Perfecto. Para coordinar ${reason}, pasame la dirección donde habría que ir.`,
        })
      case 'contact':
        return pickWordingVariant({
          key: 'customer.schedule.progress.ask_contact',
          variationSeed,
          overrides: wordingOverrides,
          channel: options?.channel || null,
          channelProfile: options?.channelProfile || null,
          variables: { reason },
          fallback: prefersEnglish
            ? `Perfect. To coordinate ${reason}, send me a phone number or email for contact.`
            : `Perfecto. Para coordinar ${reason}, pasame un teléfono o email de contacto.`,
        })
      default:
        return null
    }
  }

  if (!unresolvedMissingFields.length) {
    return pickWordingVariant({
      key: 'customer.schedule.progress.ready',
      variationSeed,
      overrides: wordingOverrides,
      channel: options?.channel || null,
      channelProfile: options?.channelProfile || null,
      variables: { reason },
      fallback: prefersEnglish
        ? `Perfect. I already have what I need to coordinate ${reason}. I am checking availability and will confirm the booking shortly.`
        : `Perfecto. Ya tengo lo necesario para coordinar ${reason}. Estoy validando la disponibilidad y te confirmo el agendamiento.`,
    })
  }

  if (
    unresolvedMissingFields.includes('time') &&
    /\b(franja|a\s+que\s+hora|a\s+qué\s+hora|temprano|temprana)\b/i.test(
      currentTurnText,
    )
  ) {
    return pickWordingVariant({
      key: 'customer.schedule.availability_followup',
      variationSeed,
      overrides: wordingOverrides,
      channel: options?.channel || null,
      channelProfile: options?.channelProfile || null,
      fallback: prefersEnglish
        ? 'I cannot confirm an exact time slot from here yet. If you want, send me the address and a contact phone number and I will leave the visit ready to coordinate.'
        : 'Todavía no te puedo confirmar una franja exacta por acá. Si querés, pasame la dirección y un teléfono de contacto y lo dejamos encaminado para coordinar la visita.',
    })
  }

  if (requestedField) {
    const singleFieldResponse = renderSingleScheduleFieldAsk(requestedField)
    if (singleFieldResponse) {
      return singleFieldResponse
    }
  }

  const missingLabels = unresolvedMissingFields
    .map((field) =>
      field === 'date'
        ? prefersEnglish
          ? 'the day'
          : 'el día'
        : field === 'time'
          ? prefersEnglish
            ? 'the time'
            : 'el horario'
          : field === 'address'
            ? prefersEnglish
              ? 'the address'
              : 'la dirección'
            : field === 'contact'
              ? prefersEnglish
                ? 'a contact phone number or email'
                : 'un teléfono o email de contacto'
              : null,
    )
    .filter(Boolean)
  const missingText = prefersEnglish
    ? missingLabels.length === 2
      ? `${missingLabels[0]} and ${missingLabels[1]}`
      : `${missingLabels.slice(0, -1).join(', ')} and ${missingLabels.at(-1)}`
    : missingLabels.length === 2
      ? `${missingLabels[0]} y ${missingLabels[1]}`
      : `${missingLabels.slice(0, -1).join(', ')} y ${missingLabels.at(-1)}`
  const knownText = knownParts.length
    ? prefersEnglish
      ? ` So far I have ${knownParts.join(' · ')}.`
      : ` Por ahora tomo ${knownParts.join(' · ')}.`
    : ''
  return prefersEnglish
    ? `Perfect. To coordinate ${reason}, I need ${missingText}.${knownText}`
    : `Perfecto. Para coordinar ${reason}, necesito ${missingText}.${knownText}`
}

export const buildCustomerScheduleCreatedText = ({
  scheduleContext = null,
  appointment = null,
}, options = {}) => {
  const locale = normalizeChatLocale(options?.locale)
  const prefersEnglish = localePrefersEnglish(locale)
  const variationSeed = String(options?.variationSeed || '')
  const knownParts = formatScheduleKnownParts(scheduleContext)
  const timeText = knownParts.length ? knownParts.join(' · ') : 'el horario solicitado'
  return pickWordingVariant({
    key: 'customer.schedule.created',
    variationSeed,
    overrides: options?.wordingOverrides,
    channel: options?.channel || null,
    channelProfile: options?.channelProfile || null,
    variables: { timeText },
    fallback: prefersEnglish
      ? `Perfect. The technical visit is now scheduled for ${timeText}.`
      : `Perfecto. Ya dejé agendada la visita técnica para ${timeText}.`,
  })
}

export const buildCustomerScheduleUnavailableText = ({
  scheduleContext = null,
}, options = {}) => {
  const locale = normalizeChatLocale(options?.locale)
  const prefersEnglish = localePrefersEnglish(locale)
  const variationSeed = String(options?.variationSeed || '')
  const knownParts = formatScheduleKnownParts(scheduleContext)
  const scheduleText = knownParts.length
    ? knownParts.join(' · ')
    : prefersEnglish
      ? 'that time slot'
      : 'ese horario'
  return pickWordingVariant({
    key: 'customer.schedule.unavailable',
    variationSeed,
    overrides: options?.wordingOverrides,
    channel: options?.channel || null,
    channelProfile: options?.channelProfile || null,
    variables: { scheduleText },
    fallback: prefersEnglish
      ? `I no longer have availability for ${scheduleText}. If you want, send me another day or time option and I will check it.`
      : `En ese momento ya no tengo disponibilidad para ${scheduleText}. Si querés, pasame otra opción de día u horario y lo reviso.`,
  })
}

export const buildCustomerAuthRequiredText = () =>
  'Para revisar pedidos, presupuestos, facturas o datos de tu cuenta, necesito que ingreses con tu cuenta. Cuando quieras, seguimos desde ahí.'

export const buildCustomerOwnedDocumentRequestText = (documentType = null) => {
  if (documentType === 'BUDGET') {
    return 'Claro. Indícame la referencia del presupuesto asociado a tu cuenta y lo reviso contigo.'
  }
  return 'Claro. Indícame la referencia del pedido asociado a tu cuenta y lo reviso contigo.'
}

export const buildCustomerPrivateAccountDataText = (requestType = null) => {
  if (requestType === 'invoice') {
    return 'Por seguridad, las facturas solo se muestran dentro de tu cuenta o por un asesor autorizado. Si quieres, te indico cómo seguir.'
  }
  if (requestType === 'address') {
    return 'Por seguridad, las direcciones de tu cuenta solo se muestran dentro de tu cuenta autenticada.'
  }
  return 'Por seguridad, ese tipo de información solo se comparte dentro de tu cuenta o por un asesor autorizado.'
}

export const buildCustomerOutOfScopeText = () =>
  'Puedo ayudarte con consultas sobre productos, precios, medidas, envíos, pagos y seguimiento. Si quieres, cuéntanos sobre qué tema necesitas ayuda.'

export const buildCustomerSensitiveText = () =>
  'Entiendo la molestia. Voy a dejar tu consulta para que un asesor del equipo la revise y te responda lo antes posible.'

export const buildCustomerFrustrationText = () =>
  'Lamento el inconveniente. Cuéntame qué no está funcionando y lo revisamos contigo; si hace falta, lo deriva un asesor.'

export const buildCustomerRepetitionText = () =>
  'Veo que sigues con la misma consulta. Si quieres, dime un poco más de detalle y lo revisamos, o lo derivamos con un asesor.'

export const buildCustomerContactFallbackText = () =>
  'Claro. Si quieres, te indico por aquí nuestros datos de contacto.'

export const buildCustomerAvailabilityFallbackText = () =>
  'Claro. La disponibilidad y el tiempo de entrega se confirman según el trabajo y la agenda disponible. Si querés, te lo dejo encaminado para que te lo confirmen por acá.'

export const buildCustomerMaterialFollowUpText = ({
  subject = 'esa opción',
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
} = {}) =>
  pickWordingVariant({
    key: 'customer.fallback.material_followup',
    variationSeed,
    overrides: wordingOverrides,
    channel,
    channelProfile,
    variables: { subject },
    fallback: `Puedo dejar en seguimiento tu pedido para que un asesor te comparta fotos o material de referencia sobre ${subject} por este mismo canal.`,
  })

export const buildCustomerLightFilterGuidanceText = ({
  subject = 'esa opción',
  guidance = null,
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
} = {}) =>
  pickWordingVariant({
    key: 'customer.product.light_filter_guidance',
    variationSeed,
    overrides: wordingOverrides,
    channel,
    channelProfile,
    variables: {
      topic: subject,
      translucentOption: compactText(guidance?.translucentOption || ''),
      opaqueOption: compactText(guidance?.opaqueOption || ''),
      comparisonSubject: compactText(guidance?.comparisonSubject || ''),
    },
    fallback:
      compactText(guidance?.translucentOption || '') &&
      compactText(guidance?.opaqueOption || '')
        ? `Si buscás ${subject} que deje pasar luz, normalmente se orienta a ${compactText(guidance?.translucentOption || '')}. Si querés, te cuento la diferencia con ${compactText(guidance?.opaqueOption || '')} y cuál conviene más según ${compactText(guidance?.comparisonSubject || 'lo que necesitás')}.`
        : `Si buscás ${subject} con paso parcial de luz, te cuento qué opciones conviene comparar y cuál suele rendir mejor según lo que necesitás.`,
  })

export const buildCustomerInformationThenHandoffText = ({
  subject = 'esa opción',
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
} = {}) =>
  pickWordingVariant({
    key: 'customer.fallback.information_then_handoff',
    variationSeed,
    overrides: wordingOverrides,
    channel,
    channelProfile,
    variables: { subject },
    fallback: `Puedo orientarte con la información general disponible sobre ${subject}. Si querés, además dejo la consulta en seguimiento para que un asesor la amplíe por este canal.`,
  })

export const buildCustomerQuoteHandoffText = ({
  subject = 'la configuración solicitada',
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
} = {}) =>
  pickWordingVariant({
    key: 'customer.fallback.quote_handoff',
    variationSeed,
    overrides: wordingOverrides,
    channel,
    channelProfile,
    variables: { subject },
    fallback: `Ya tengo la información necesaria de ${subject}. Dejo la solicitud en seguimiento para que un asesor la revise y te responda a la brevedad.`,
  })

export const buildCustomerQuoteWaitingFollowUpText = ({
  input = '',
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
} = {}) =>
  pickWordingVariant({
    key: /\b(gracias|muchas gracias)\b.*\b(presupuesto|cotizacion|cotización)\b/i.test(
      String(input || ''),
    )
      ? 'customer.quote.waiting_followup_ack'
      : 'customer.quote.waiting_followup',
    variationSeed,
    overrides: wordingOverrides,
    channel,
    channelProfile,
    fallback:
      'Perfecto. Quedó en seguimiento. Si hace falta algún dato adicional, te lo piden por aquí.',
  })

export const buildCustomerMultimodalSupportArtifactText = ({
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
  referenceOnly = false,
} = {}) =>
  pickWordingVariant({
    key: referenceOnly
      ? 'customer.multimodal.support_artifact_reference'
      : 'customer.multimodal.support_artifact_received',
    variationSeed,
    overrides: wordingOverrides,
    channel,
    channelProfile,
    fallback: referenceOnly
      ? 'Sí, con eso ya queda mejor orientada la revisión y lo dejo en seguimiento. Si querés, pasame la zona o dirección y qué día u horario te sirve y lo dejamos encaminado.'
      : 'Recibí el adjunto y lo dejo en seguimiento para revisar el caso. Si querés, pasame la zona o dirección y qué día u horario te sirve.',
  })

export const buildCustomerMultimodalGenericArtifactText = ({
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
  referenceOnly = false,
  artifactKind = null,
} = {}) => {
  const artifactLabel =
    artifactKind === 'audio'
      ? 'el audio'
      : artifactKind === 'image'
        ? 'la imagen'
        : artifactKind === 'video'
          ? 'el video'
          : artifactKind === 'document'
            ? 'el archivo'
            : 'el adjunto'
  const artifactReferenceLabel =
    artifactKind === 'audio'
      ? 'ese audio'
      : artifactKind === 'image'
        ? 'esa imagen'
        : artifactKind === 'video'
          ? 'ese video'
          : artifactKind === 'document'
            ? 'ese archivo'
            : 'eso'

  return pickWordingVariant({
    key: referenceOnly
      ? 'customer.multimodal.generic_artifact_reference'
      : 'customer.multimodal.generic_artifact_received',
    variationSeed,
    overrides: wordingOverrides,
    channel,
    channelProfile,
    variables: {
      artifactLabel,
      artifactReferenceLabel,
    },
    fallback: referenceOnly
      ? artifactKind === 'audio'
        ? 'Sí, con ese audio ya tengo una mejor referencia. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.'
        : artifactKind === 'image'
          ? 'Sí, con esa imagen ya tengo una mejor referencia. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.'
          : artifactKind === 'video'
            ? 'Sí, con ese video ya tengo una mejor referencia. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.'
            : artifactKind === 'document'
              ? 'Sí, con ese archivo ya tengo una mejor referencia. Si es un comprobante o documentación, lo dejo en seguimiento. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.'
              : 'Sí, con eso ya tengo una mejor referencia. Si es un comprobante o documentación, lo dejo en seguimiento. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.'
      : artifactKind === 'audio'
        ? 'Recibí el audio. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.'
        : artifactKind === 'image'
          ? 'Recibí la imagen. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.'
          : artifactKind === 'video'
            ? 'Recibí el video. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.'
            : artifactKind === 'document'
            ? 'Recibí el archivo. Si esto es un comprobante o documentación, lo dejo en seguimiento. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.'
              : 'Recibí el adjunto. Si esto es un comprobante o documentación, lo dejo en seguimiento. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.',
  })
}

export const buildCustomerMultimodalGenericArtifactPlannedText = ({
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
} = {}) =>
  pickWordingVariant({
    key: 'customer.multimodal.generic_artifact_planned',
    variationSeed,
    overrides: wordingOverrides,
    channel,
    channelProfile,
    fallback:
      'Dale, enviámelo cuando puedas. Si es un comprobante o documentación, lo dejo en seguimiento. Si es por una revisión o consulta, decime en una línea qué necesitás y seguimos por acá.',
  })

export const buildCustomerMultimodalSupportArtifactPlannedText = ({
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
} = {}) =>
  pickWordingVariant({
    key: 'customer.multimodal.support_artifact_planned',
    variationSeed,
    overrides: wordingOverrides,
    channel,
    channelProfile,
    fallback:
      'Perfecto. Cuando me pases las fotos o el material lo revisamos con más contexto. Si querés, además decime la zona o dirección y qué día u horario te sirve.',
  })

export const buildCustomerMultimodalQuoteArtifactText = ({
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
  referenceOnly = false,
  interpretation = null,
} = {}) =>
  (() => {
    const quoteContext =
      interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
        ? interpretation.quoteContext
        : null
    const subjectLabel =
      compactText(
        quoteContext?.topicLabel ||
          quoteContext?.familyLabel ||
          interpretation?.topic?.label ||
          interpretation?.contextTopic?.label ||
          '',
      ) || 'la cotización'
    const missingFields = Array.isArray(quoteContext?.missingFields)
      ? quoteContext.missingFields
      : []
    const missingAttributes = Array.isArray(quoteContext?.missingAttributes)
      ? quoteContext.missingAttributes.filter((entry) => entry && typeof entry === 'object')
      : Array.isArray(quoteContext?.requiredAttributes)
        ? quoteContext.requiredAttributes.filter(
            (entry) =>
              entry &&
              typeof entry === 'object' &&
              missingFields.includes(String(entry.key || '')),
          )
        : []
    const nextStep = buildNextQuoteMissingPrompt({
      missingAttributes,
      prefix: 'Si querés, confirmame',
      fallback: 'Lo dejo sumado como referencia para la cotización y seguimos por acá.',
    })

    return pickWordingVariant({
      key: referenceOnly
        ? 'customer.multimodal.quote_artifact_reference'
        : 'customer.multimodal.quote_artifact_received',
      variationSeed,
      overrides: wordingOverrides,
      channel,
      channelProfile,
      variables: {
        subject: subjectLabel,
        nextStep,
      },
      fallback: referenceOnly
        ? `Sí, con eso ya tengo mejor referencia para ${subjectLabel} y la sumo a la cotización. ${nextStep}`
        : `Recibí el adjunto. Lo sumo como referencia para ${subjectLabel} y dejo el caso en seguimiento. ${nextStep}`,
    })
  })()

export const buildCustomerMultimodalQuoteArtifactPlannedText = ({
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
  interpretation = null,
} = {}) =>
  (() => {
    const quoteContext =
      interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
        ? interpretation.quoteContext
        : null
    const subjectLabel =
      compactText(
        quoteContext?.topicLabel ||
          quoteContext?.familyLabel ||
          interpretation?.topic?.label ||
          interpretation?.contextTopic?.label ||
          '',
      ) || 'la cotización'
    const missingFields = Array.isArray(quoteContext?.missingFields)
      ? quoteContext.missingFields
      : []
    const missingAttributes = Array.isArray(quoteContext?.missingAttributes)
      ? quoteContext.missingAttributes.filter((entry) => entry && typeof entry === 'object')
      : Array.isArray(quoteContext?.requiredAttributes)
        ? quoteContext.requiredAttributes.filter(
            (entry) =>
              entry &&
              typeof entry === 'object' &&
              missingFields.includes(String(entry.key || '')),
          )
        : []
    const nextStep = buildNextQuoteMissingPrompt({
      missingAttributes,
      prefix: 'Si querés, además confirmame',
      fallback: 'Con eso la dejo mejor encaminada.',
    })

    return pickWordingVariant({
      key: 'customer.multimodal.quote_artifact_planned',
      variationSeed,
      overrides: wordingOverrides,
      channel,
      channelProfile,
      variables: {
        subject: subjectLabel,
        nextStep,
      },
      fallback: `Perfecto. Cuando me pases las fotos o el material lo tomo como referencia para ${subjectLabel} y lo dejo en seguimiento. ${nextStep}`,
    })
  })()

export const buildCustomerReengagementFollowUpText = ({
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
  kind = 'quote',
} = {}) =>
  pickWordingVariant({
    key:
      kind === 'support'
        ? 'customer.reengagement.support_followup'
        : 'customer.reengagement.quote_followup',
    variationSeed,
    overrides: wordingOverrides,
    channel,
    channelProfile,
    fallback:
      kind === 'support'
        ? 'Claro, retomamos con la revisión. Si querés, pasame la zona o dirección y qué día u horario te sirve, o mandame una foto si todavía no la enviaste.'
        : 'Claro, retomamos con esa cotización. Si querés, confirmame la opción o el dato que faltaba y seguimos desde ahí.',
  })

export const buildCustomerReengagementNeutralText = ({
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
} = {}) =>
  pickWordingVariant({
    key: 'customer.reengagement.neutral_followup',
    variationSeed,
    overrides: wordingOverrides,
    channel,
    channelProfile,
    fallback:
      'Claro, retomamos por acá. Decime si esto sigue por una cotización, una revisión o un pago, y te encamino desde ahí.',
  })

export const buildCustomerCapabilityHandoffText = ({
  capability = 'content',
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
} = {}) => {
  const key =
    capability === 'commerce'
      ? 'customer.capability.commerce_handoff'
      : capability === 'scheduling'
        ? 'customer.capability.scheduling_handoff'
        : 'customer.capability.content_handoff'

  const fallback =
    capability === 'commerce'
      ? 'Puedo tomar los datos necesarios y dejar la solicitud en seguimiento para que un asesor continúe la cotización por aquí.'
      : capability === 'scheduling'
        ? 'Puedo relevar los datos de la visita y dejarla en seguimiento para que un asesor confirme la disponibilidad por aquí.'
        : 'Puedo dejar esta consulta en seguimiento para que un asesor te amplíe la información por aquí.'

  return pickWordingVariant({
    key,
    variationSeed,
    overrides: wordingOverrides,
    channel,
    channelProfile,
    fallback,
  })
}

export const buildCustomerConfirmationText = () =>
  'Perfecto. Continuamos con eso.'

export const buildCustomerCancellationText = () =>
  'Entendido. Dejamos eso sin efecto. Si quieres, dime cómo seguimos.'

export const buildCustomerMultiIntentText = (
  classification = null,
  { input = '', interpretation = null, tenantTopicTaxonomy = [] } = {},
) => {
  const focusAreas = Array.isArray(classification?.focusAreas)
    ? classification.focusAreas.filter((entry) => entry?.key && entry?.label)
    : []
  const normalizedInput = String(input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const configuredMeasurementCarrier =
    (Array.isArray(interpretation?.quoteContext?.measurementCarrierTerms)
      ? interpretation.quoteContext.measurementCarrierTerms
      : []
    )
      .map((entry) => compactText(entry))
      .find((entry) => {
        const normalizedEntry = normalizeLightInput(entry)
        return normalizedEntry && normalizedInput.includes(normalizedEntry)
      }) || null
  const subjectLabel = compactText(
    configuredMeasurementCarrier ||
      resolveQuoteSubjectLabel(interpretation, tenantTopicTaxonomy) ||
      '',
  )

  if (
    focusAreas.some((entry) => entry.key === 'contact') &&
    focusAreas.some((entry) => entry.key === 'general_help')
  ) {
    return 'Hola. Claro, cuéntanos tu consulta. Si prefieres, también podemos dejarte los datos de contacto o derivarlo con un asesor.'
  }

  if (
    focusAreas.some((entry) => entry.key === 'pricing') &&
    /disponibilidad/.test(normalizedInput)
  ) {
    const subject = subjectLabel || 'el producto'
    return `Puedo ayudarte con el presupuesto y con la disponibilidad para ${subject}. Si te sirve, pasame la zona o dirección y vemos cómo coordinarlo; y para ${subject} seguimos con los datos que ya tengas.`
  }

  if (focusAreas.some((entry) => entry.key === 'appointment')) {
    return 'Puedo ayudarte con ambas cosas. Empecemos por la visita, ¿qué día te viene bien?'
  }

  if (focusAreas.length >= 2) {
    return `Puedo ayudarte con ${focusAreas[0].label} y ${focusAreas[1].label}. Empecemos por ${focusAreas[0].label}, ¿te parece?`
  }

  return 'Puedo ayudarte con más de un tema. Empecemos por uno, ¿cuál prefieres ver primero?'
}

export const renderCustomerDeterministicText = ({
  intentKey,
  input = '',
  inboundClassification = null,
  config = null,
  interpretation = null,
  tenantTopicTaxonomy = [],
  paymentMethods = [],
  installationTerms = [],
  faqSubtype = null,
  variationSeed = '',
  wordingOverrides = null,
  locale = 'es-UY',
  channel = null,
  channelProfile = null,
}) => {
  const conversationState = readConversationState(null, interpretation)
  switch (intentKey) {
    case 'customer.clarify_request':
      return buildCustomerClarifyRequestText(input)
    case 'customer.rephrase_request':
      return buildCustomerRephraseRequestText()
    case 'customer.unintelligible':
      return buildCustomerUnintelligibleText()
    case 'customer.incomplete':
      return buildCustomerIncompleteText(input)
    case 'customer.price_inquiry':
      return buildCustomerPriceInquiryText(input, {
        interpretation,
        tenantTopicTaxonomy,
        variationSeed,
        wordingOverrides,
        channel,
        channelProfile,
      })
    case 'customer.quote':
      return buildCustomerQuoteRequestText(input, {
        interpretation,
        tenantTopicTaxonomy,
        variationSeed,
        wordingOverrides,
        channel,
        channelProfile,
      })
    case 'customer.support_request':
      return buildCustomerSupportRequestText(input, {
        interpretation,
        tenantTopicTaxonomy,
        paymentMethods,
        variationSeed,
        wordingOverrides,
        channel,
        channelProfile,
      })
    case 'customer.schedule_request':
      return interpretation?.scheduleContext
        ? buildCustomerScheduleProgressText(interpretation.scheduleContext, {
            conversationState,
            locale,
            variationSeed,
            wordingOverrides,
            channel,
            channelProfile,
            currentTurnText: input,
          })
        : buildCustomerScheduleRequestText(input, {
            locale,
            installationTerms,
          })
    case 'customer.auth_required':
      return buildCustomerAuthRequiredText()
    case 'customer.owned_document_request':
      return buildCustomerOwnedDocumentRequestText(
        inboundClassification?.documentType ?? null,
      )
    case 'customer.private_account_data':
      return buildCustomerPrivateAccountDataText(
        inboundClassification?.requestType ?? null,
      )
    case 'customer.contact_info':
      return buildCustomerContactFallbackText()
    case 'customer.topic_info':
      if (faqSubtype === 'availability') {
        return buildCustomerAvailabilityFallbackText()
      }
      return null
    case 'customer.multi_intent':
      return buildCustomerMultiIntentText(inboundClassification, {
        input,
        interpretation,
        tenantTopicTaxonomy,
      })
    case 'customer.repetition':
      return buildCustomerRepetitionText()
    case 'customer.confirmation':
      return buildCustomerConfirmationText()
    case 'customer.cancellation':
      return buildCustomerCancellationText()
    case 'customer.frustration':
      return buildCustomerFrustrationText()
    case 'customer.sensitive':
      return buildCustomerSensitiveText()
    case 'customer.out_of_scope':
      return buildCustomerOutOfScopeText()
    case 'customer.light':
      return renderLightConversationText({
        audience: 'customer',
        kind: resolveCustomerLightKind(input),
        input,
        config,
      })
    default:
      return null
  }
}

export const renderOutcomeText = ({ audience, outcome, variant = null }) => {
  if (audience === 'admin') {
    if (outcome === 'blocked') {
      return variant === 'ambiguous'
        ? 'La configuración actual del usuario es demasiado amplia o ambigua para resolver esta acción de forma segura. Necesito un alcance más claro para continuar.'
        : 'Esa acción no está habilitada para tu rol conversacional actual. Si corresponde, continúa por el circuito operativo interno adecuado.'
    }
    if (outcome === 'missing_data') {
      return 'Necesito un dato más para prepararlo bien. Si me lo indicas, sigo con la gestión.'
    }
    if (outcome === 'low_confidence') {
      return 'No tengo contexto suficiente para resolverlo con seguridad. Dame el dato mínimo que falta o indícame exactamente sobre qué elemento quieres actuar.'
    }
    if (outcome === 'handoff') {
      return 'Este caso conviene derivarlo al circuito interno correspondiente para que siga por el camino operativo adecuado.'
    }
    if (outcome === 'provider_failure') {
      return 'No pude completar la asistencia operativa en este momento. Si quieres, puedo intentar continuar con otro dato concreto o dejar el contexto listo para seguir por el circuito interno.'
    }
    if (outcome === 'execution_failure') {
      return 'La operación no pudo completarse. Revisa el detalle del error y el payload validado antes de volver a intentarlo.'
    }
    if (outcome === 'partial_batch') {
      return 'La operación batch terminó con resultados mixtos. Revisa ejecutados, fallidos y pendientes antes de continuar.'
    }
    return ''
  }

  if (outcome === 'blocked') {
    return 'Esa acción no está disponible desde este canal. Un asesor del equipo puede ayudarte a continuar por la vía correcta.'
  }
  if (outcome === 'missing_data') {
    return 'Necesito un dato más para ayudarte bien. Si me lo indicas, sigo contigo.'
  }
  if (outcome === 'low_confidence') {
    return 'No me queda totalmente claro a qué te refieres. Si me das un poco más de contexto, sigo contigo.'
  }
  if (outcome === 'handoff') {
    return 'Si quieres, un asesor del equipo puede continuar contigo para ayudarte con el siguiente paso.'
  }
  if (outcome === 'provider_failure') {
    return 'En este momento no pude completar la respuesta automática. Un asesor del equipo te indicará cómo continuar y te ayudará con el siguiente paso.'
  }
  if (outcome === 'execution_failure') {
    return 'No pude completar esa gestión correctamente. Un asesor puede ayudarte a revisarla y continuar.'
  }
  if (outcome === 'partial_batch') {
    return 'La operación se completó solo en parte. Si quieres, un asesor puede ayudarte a revisar lo que quedó pendiente.'
  }
  return ''
}

export const renderOperationDraftOutcome = ({
  draft,
  actionIntent,
  buildDraftToolCall,
  audience = 'admin',
}) => {
  if (!draft) {
    return null
  }

  const lines = [draft.intro]
  for (const section of draft.sections ?? []) {
    if (!Array.isArray(section?.items) || section.items.length === 0) {
      continue
    }
    lines.push('', `${section.title}:`, ...section.items.map((item) => `- ${item}`))
  }

  if (draft.ready) {
    lines.push(
      '',
      draft.confirmationPrompt ||
        actionIntent.confirmationPrompt ||
        '¿Deseas confirmar esta operación?',
    )
  } else {
    lines.push(
      '',
      draft.pendingPrompt ||
        renderOutcomeText({
          audience,
          outcome: 'missing_data',
        }),
    )
  }

  return {
    text: lines.join('\n'),
    toolCalls: [buildDraftToolCall(actionIntent, draft)],
    needsHuman: false,
    grounding: {
      grounded: false,
      fallbackReason: draft.ready ? 'requires_confirmation' : 'pending_required_fields',
    },
    debug: {
      actionKey: actionIntent.key,
      detail:
        draft.debugDetail ||
        'Se preparó un draft operativo confirmable antes de ejecutar la acción real.',
    },
  }
}

export const renderExecutionOutcome = ({
  draft,
  executions = [],
  buildVerificationLink,
  audience = 'admin',
}) => {
  const success = executions.filter((entry) => entry.status === 'executed')
  const failed = executions.filter((entry) => entry.status === 'failed')

  if (draft?.execute?.type === 'batch') {
    const lines = []
    if (success.length) {
      lines.push(
        draft.batchSuccessTitle ||
          'Operación ejecutada correctamente para los siguientes elementos:',
      )
      for (const entry of success) {
        const link = buildVerificationLink(entry.verifyEntity, entry.result)
      lines.push(
          `- ${entry.resultSummary?.label || entry.successLabel || entry.result?.name || entry.arguments?.name || 'Elemento'}${link ? ` · detalle: ${link}` : ''}`,
        )
      }
    }
    if (failed.length) {
      lines.push(...(lines.length ? ['', 'Fallos:'] : ['Fallos:']))
      for (const entry of failed) {
        lines.push(
          `- ${entry.successLabel || entry.arguments?.name || 'Elemento'}: ${entry.errorMessage || 'error desconocido'}`,
        )
      }
    }
    return {
      text:
        lines.join('\n') ||
        renderOutcomeText({ audience, outcome: failed.length ? 'partial_batch' : 'success' }),
      needsHuman: failed.length > 0,
      grounding: {
        grounded: false,
        fallbackReason: failed.length > 0 ? 'execution_partial_failure' : null,
      },
    }
  }

  const [entry] = executions
  if (!entry) {
    return {
      text: renderOutcomeText({ audience, outcome: 'execution_failure' }),
      needsHuman: true,
      grounding: { grounded: false, fallbackReason: 'execution_failed' },
    }
  }

  if (entry.status === 'failed') {
    return {
      text:
        draft.errorText ||
        `${renderOutcomeText({ audience, outcome: 'execution_failure' })} Error: ${
          entry.errorMessage || 'error desconocido'
        }.`,
      needsHuman: true,
      grounding: { grounded: false, fallbackReason: 'execution_failed' },
    }
  }

  const link = buildVerificationLink(
    entry.resultSummary?.verifyEntity ?? entry.verifyEntity,
    entry.resultSummary?.verificationResult ?? entry.result,
  )
  const successText =
    draft.successText ||
    `${draft.executionSuccessPrefix || 'Operación ejecutada correctamente.'}${
      link ? ` Verificación: ${link}` : ''
    }`

  return {
    text: successText,
    needsHuman: false,
    grounding: { grounded: false, fallbackReason: null },
  }
}

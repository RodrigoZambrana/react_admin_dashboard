import {
  detectCustomerFaqSubtype,
  looksLikeCustomerProductInfoOpening,
} from './customer-faq-heuristics.js'
import { extractCurrentCustomerTurnText } from '../ingress/customer-turn-normalization.js'
import { readInterpretationResolutionReadiness } from '../conversation/resolution-readiness.js'
import { extractExplicitSemanticSubject } from './semantic-turn-subject.js'
import {
  looksLikeConfiguredProductInterest,
  looksLikeGenericPriceInquiry,
  looksLikeQuoteRequirementsQuestion,
} from './customer-intent-patterns.js'
import {
  extractTenantFamilyLabel,
  extractTenantVariantLabels,
  findBestTenantTopicMatch,
  normalizeTenantTopicTaxonomy,
} from './customer-topic-taxonomy.js'
import { pickWordingVariant } from '../outcomes/wording-registry.js'
import { looksLikeQuoteExpansionSignal } from './customer-semantic-signals.js'
import {
  getBusinessFacts,
  getBusinessRules,
  getVocabulary,
  hasCatalogVocabularySignal,
} from '../tenant-policy/runtime-tenant-policy.js'

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeText = (value) =>
  compactText(
    extractCurrentCustomerTurnText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
  )

const buildTopicMatchAliases = (topicMatch = null) =>
  Array.from(
    new Set(
      [
        topicMatch?.label,
        topicMatch?.normalizationValue,
        ...(Array.isArray(topicMatch?.aliases) ? topicMatch.aliases : []),
      ]
        .map((entry) => normalizeText(entry))
        .filter(Boolean),
    ),
  )

const topicMatchEquals = (left = null, right = null) =>
  Boolean(left?.key) && Boolean(right?.key) && left.key === right.key

const sourceMentionsTopicMatch = (sourceText = '', topicMatch = null) => {
  const normalizedSource = normalizeText(sourceText)
  if (!normalizedSource || !topicMatch) {
    return false
  }

  return buildTopicMatchAliases(topicMatch).some((alias) => {
    return (
      normalizedSource === alias ||
      normalizedSource.includes(` ${alias} `) ||
      normalizedSource.startsWith(`${alias} `) ||
      normalizedSource.endsWith(` ${alias}`) ||
      normalizedSource.includes(alias)
    )
  })
}

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
  'mis',
  'tu',
  'tus',
  'su',
  'sus',
  'al',
  'lo',
  'como',
  'cuanto',
  'cuanta',
  'cuantos',
  'cuantas',
  'sobre',
  'necesito',
  'quiero',
  'saber',
  'tener',
  'tienen',
  'informacion',
  'información',
  'consulta',
  'consultar',
])

const extractTopicTokens = (text) =>
  normalizeText(text)
    .split(/\s+/u)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 3 && !STOP_TOKENS.has(entry))

const readSemanticInfoIntent = (interpretation = null) =>
  interpretation?.semanticInfoIntent &&
  typeof interpretation.semanticInfoIntent === 'object'
    ? interpretation.semanticInfoIntent
    : null

const resolveFaqTopicSignals = ({
  input,
  interpretation = null,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
} = {}) => {
  const semanticInfoIntent = readSemanticInfoIntent(interpretation)
  const semanticSubjectResolution =
    typeof semanticInfoIntent?.subjectResolution === 'string'
      ? semanticInfoIntent.subjectResolution
      : 'unresolved'
  const semanticSubjectLabel =
    typeof semanticInfoIntent?.subject?.label === 'string' &&
    semanticInfoIntent.subject.label.trim()
      ? semanticInfoIntent.subject.label.trim()
      : null
  const hasResolvedSemanticSubject =
    Boolean(semanticSubjectLabel) && semanticSubjectResolution !== 'unresolved'
  const suppressRequestedTopicLabel =
    semanticInfoIntent?.shouldSuppressRequestedTopicLabel === true
  const extractedRequestedTopicLabel = suppressRequestedTopicLabel
    ? null
    : extractExplicitSemanticSubject({
        input,
        tenantTopicTaxonomy,
        tenantRuntimePolicy,
      }).explicitSubject?.label || null
  const quoteContextTopicLabel =
    typeof interpretation?.quoteContext?.topicLabel === 'string' &&
    interpretation.quoteContext.topicLabel.trim()
      ? interpretation.quoteContext.topicLabel.trim()
      : null
  const interpretationTopicLabel =
    typeof interpretation?.topic?.label === 'string' && interpretation.topic.label.trim()
      ? interpretation.topic.label.trim()
      : null
  const shouldPreferQuoteContextTopic =
    !hasResolvedSemanticSubject &&
    looksLikeQuoteExpansionSignal(input, tenantRuntimePolicy) &&
    quoteContextTopicLabel &&
    (!extractedRequestedTopicLabel ||
      normalizeText(quoteContextTopicLabel).includes(
        normalizeText(extractedRequestedTopicLabel),
      ))

  const requestedTopicLabel = hasResolvedSemanticSubject
    ? semanticSubjectLabel
    : shouldPreferQuoteContextTopic
      ? quoteContextTopicLabel
      : extractedRequestedTopicLabel &&
          String(interpretation?.topic?.type || '') === 'product_family'
        ? extractedRequestedTopicLabel
        : interpretationTopicLabel || extractedRequestedTopicLabel

  return {
    semanticInfoIntent,
    semanticSubjectResolution,
    semanticSubjectLabel,
    hasResolvedSemanticSubject,
    suppressRequestedTopicLabel,
    extractedRequestedTopicLabel,
    quoteContextTopicLabel,
    interpretationTopicLabel,
    shouldPreferQuoteContextTopic,
    requestedTopicLabel,
  }
}

const calculateTopicOverlap = (left = [], right = []) => {
  if (!left.length || !right.length) {
    return 0
  }

  const target = new Set(right)
  return left.filter((token) => target.has(token)).length
}

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const getKnowledgeStatementPrefixes = (tenantRuntimePolicy = null) =>
  Array.isArray(getVocabulary(tenantRuntimePolicy)?.knowledgeStatementPrefixes)
    ? getVocabulary(tenantRuntimePolicy).knowledgeStatementPrefixes
        .filter(
          (entry) =>
            entry &&
            typeof entry === 'object' &&
            typeof entry.match === 'string' &&
            entry.match.trim() &&
            typeof entry.replacement === 'string' &&
            entry.replacement.trim(),
        )
        .map((entry) => ({
          match: compactText(entry.match),
          replacement: compactText(entry.replacement),
        }))
    : []

const applyKnowledgeStatementPrefixes = (
  statement,
  tenantRuntimePolicy = null,
) => {
  let next = compactText(statement)

  for (const prefix of getKnowledgeStatementPrefixes(tenantRuntimePolicy)) {
    const pattern = new RegExp(
      `^${escapeRegex(prefix.match)}\\s*[:\\-]\\s*`,
      'iu',
    )
    if (pattern.test(next)) {
      next = compactText(next.replace(pattern, `${prefix.replacement} `))
      break
    }
  }

  return next
}

const normalizeKnowledgeFallbackStatement = (
  statement,
  tenantRuntimePolicy = null,
) => {
  let next = compactText(statement)
  if (!next) {
    return ''
  }

  next = applyKnowledgeStatementPrefixes(next, tenantRuntimePolicy)

  if (!/[.!?]$/u.test(next)) {
    next = `${next}.`
  }

  return next.charAt(0).toUpperCase() + next.slice(1)
}

const LOCATION_SIGNAL_REGEX =
  /\b(direccion|dirección|ubicacion|ubicación|local|showroom|sucursal|montevideo|uruguay|calle|av\.|avenida)\b/i

const LOCATION_LABELED_STATEMENT_REGEX =
  /^(?:direccion|dirección|ubicacion|ubicación|showroom|sucursal)\s*[:\-]/i

const LOCATION_STRONG_SIGNAL_REGEX =
  /\b(nos encontramos en|estamos en|local comercial|no contamos con local comercial|atencion totalmente en linea|atención totalmente en línea|visitas? a domicilio|showroom\s+(?:en|ubicad[oa])|sucursal\s+(?:en|ubicad[oa]))\b/i

const LOCATION_CITY_ONLY_REGEX =
  /^(?:montevideo(?:,\s*uruguay)?|[a-z\s]+,\s*uruguay)[.!?]?$/i

const LOCATION_COMMERCIAL_CONTEXT_REGEX =
  /\b(venta e instalacion|venta e instalación|instalacion|instalación|fabricacion|fabricación|presupuesto|solicita|producto|productos|servicio|servicios|configuracion|configuración|comercial)\b/i

const BUSINESS_HOURS_SIGNAL_REGEX =
  /\b(horario|lun(?:es)?|mar(?:tes)?|mie(?:rcoles)?|miércoles|jue(?:ves)?|vie(?:rnes)?|sab(?:ado|ados)?|sábado(?:s)?|dom(?:ingo|ingos)?)\b/i

const CONTACT_SIGNAL_REGEX =
  /\b(telefono|teléfono|whatsapp|contacto|llamar|comunicarse|comunicate|escribinos)\b/i

const EMAIL_SIGNAL_REGEX =
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i

const splitKnowledgeTextIntoFragments = (source) => {
  const placeholders = [
    ['Av.', 'Av__ABBR__'],
    ['Avda.', 'Avda__ABBR__'],
  ]

  let text = String(source || '')
  for (const [search, replacement] of placeholders) {
    text = text.replaceAll(search, replacement)
  }

  return text
    .split(/(?:\.\s+|\n+)/u)
    .map((entry) => {
      let restored = entry
      for (const [search, replacement] of placeholders) {
        restored = restored.replaceAll(replacement, search)
      }
      return compactText(restored).replace(/^[•*-]\s*/u, '')
    })
    .filter((entry) => entry.length >= 18)
}

const hasLocationSignals = (text) =>
  LOCATION_SIGNAL_REGEX.test(normalizeText(text || ''))

const isStrongLocationEvidence = (text) => {
  const normalized = normalizeText(text || '')
  return (
    LOCATION_LABELED_STATEMENT_REGEX.test(compactText(text || '')) ||
    LOCATION_STRONG_SIGNAL_REGEX.test(normalized) ||
    LOCATION_CITY_ONLY_REGEX.test(compactText(text || ''))
  )
}

const isWeakCommercialLocationEvidence = (text, tenantRuntimePolicy = null) => {
  const normalized = normalizeText(text || '')
  if (!hasLocationSignals(normalized) || isStrongLocationEvidence(normalized)) {
    return false
  }
  return (
    LOCATION_COMMERCIAL_CONTEXT_REGEX.test(normalized) ||
    hasCatalogVocabularySignal(normalized, tenantRuntimePolicy)
  )
}

const isLocationClarificationAnswer = (text) =>
  /\b(direccion|dirección|ubicacion|ubicación|ciudad|local|showroom|sucursal)\b/i.test(
    normalizeText(text || ''),
  )

const looksLikeBusinessHoursEvidence = (text) => {
  const raw = compactText(text || '')
  const normalized = normalizeText(text || '')
  return (
    BUSINESS_HOURS_SIGNAL_REGEX.test(normalized) ||
    /\b\d{1,2}[:.]\d{2}\b/.test(raw)
  )
}

const looksLikeContactEvidence = (text) =>
  CONTACT_SIGNAL_REGEX.test(normalizeText(text || '')) ||
  EMAIL_SIGNAL_REGEX.test(compactText(text || ''))

const isOperationalBusinessInfoEvidence = ({
  text,
  paymentMethods = [],
  tenantRuntimePolicy = null,
}) => {
  const normalized = normalizeText(text || '')
  if (!normalized) {
    return false
  }

  return (
    looksLikeBusinessHoursEvidence(text) ||
    looksLikeContactEvidence(text) ||
    isStrongLocationEvidence(text) ||
    isWeakCommercialLocationEvidence(text, tenantRuntimePolicy) ||
    hasExplicitPaymentTerms(text, paymentMethods)
  )
}

const extractConfiguredPaymentTerms = (paymentMethods = []) =>
  Array.from(
    new Set(
      (Array.isArray(paymentMethods) ? paymentMethods : []).flatMap((entry) => {
        const clean = compactText(entry)
        return [clean, ...clean.split(/[^a-z0-9áéíóúñ]+/iu)]
      }),
    ),
  )
    .map((entry) => normalizeText(entry))
    .filter((entry) => entry.length >= 3)

const hasConfiguredPaymentMethodMention = (text, paymentMethods = []) => {
  const normalized = normalizeText(text || '')
  if (!normalized) {
    return false
  }

  return extractConfiguredPaymentTerms(paymentMethods).some((term) =>
    normalized.includes(term),
  )
}

const hasExplicitPaymentTerms = (text, paymentMethods = []) => {
  const normalized = normalizeText(text || '')
  if (!normalized) {
    return false
  }

  if (/\b(pago|pagos|abonar|abono|cobro|cuotas?|financiacion|financiación)\b/i.test(normalized)) {
    return true
  }
  return hasConfiguredPaymentMethodMention(normalized, paymentMethods)
}

export const DEFAULT_OPERATIONAL_PAYMENT_METHODS_INLINE =
  'los medios habilitados para este tenant'

const formatInlineList = (values = []) => {
  const items = Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .filter((entry) => typeof entry === 'string')
        .map((entry) => compactText(entry))
        .filter(Boolean),
    ),
  )

  if (items.length === 0) {
    return DEFAULT_OPERATIONAL_PAYMENT_METHODS_INLINE
  }
  if (items.length === 1) {
    return items[0]
  }
  if (items.length === 2) {
    return `${items[0]} y ${items[1]}`
  }
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
}

const normalizeTenantBusinessFactEntries = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .filter((entry) => typeof entry === 'string')
        .map((entry) => compactText(entry))
        .filter(Boolean),
    ),
  )

const buildTenantBusinessFactPayload = ({
  faqSubtype,
  tenantRuntimePolicy = null,
} = {}) => {
  const businessFacts = getBusinessFacts(tenantRuntimePolicy)
  const tenantKey = compactText(tenantRuntimePolicy?.tenantKey || 'default') || 'default'

  if (faqSubtype === 'contact') {
    const channels = normalizeTenantBusinessFactEntries(businessFacts?.contact)
    if (!channels.length) {
      return null
    }

    const inlineChannels = formatInlineList(channels)
    return {
      sourceKey: 'contact',
      title: 'Tenant contact channels',
      sourceId: `tenant-policy:${tenantKey}:contact`,
      text: `Tenemos atención por ${inlineChannels}. Si querés, te comparto el contacto por este medio.`,
      usedFacts: [`Canales de contacto disponibles: ${inlineChannels}.`],
    }
  }

  if (faqSubtype === 'business_hours') {
    const hours = normalizeTenantBusinessFactEntries(businessFacts?.businessHours)
    if (!hours.length) {
      return null
    }

    return {
      sourceKey: 'business_hours',
      title: 'Tenant business hours',
      sourceId: `tenant-policy:${tenantKey}:business_hours`,
      text: `Nuestro horario de atención es ${formatInlineList(hours)}.`,
      usedFacts: [`Horario de atención: ${formatInlineList(hours)}.`],
    }
  }

  if (faqSubtype === 'location') {
    const locationFacts = normalizeTenantBusinessFactEntries(businessFacts?.location)
    if (!locationFacts.length) {
      return null
    }

    return {
      sourceKey: 'location',
      title: 'Tenant location policy',
      sourceId: `tenant-policy:${tenantKey}:location`,
      text: locationFacts.join(' '),
      usedFacts: locationFacts.slice(0, 2),
    }
  }

  return null
}

export const buildTenantBusinessFactFaqResponse = ({
  faqSubtype,
  tenantRuntimePolicy = null,
} = {}) => buildTenantBusinessFactPayload({ faqSubtype, tenantRuntimePolicy })

export const resolveOperationalPaymentMethodsInline = (input = '', options = {}) => {
  const normalized = normalizeText(input)
  const configuredPaymentMethods = formatInlineList(options?.paymentMethods ?? [])
  if (!normalized) {
    return configuredPaymentMethods
  }

  if (hasExplicitPaymentTerms(normalized)) {
    return configuredPaymentMethods
  }

  return configuredPaymentMethods
}

const looksLikePriceOrQuoteTurn = (text) =>
  looksLikeGenericPriceInquiry(normalizeText(text || ''))

const QUOTE_SEED_INTENT_REGEX =
  /\b(?:necesit[a-záéíóúñ]*|precis[a-záéíóúñ]*|cotiz[a-záéíóúñ]*|presupuest[a-záéíóúñ]*|me interesa)\b/iu

const extractPriceReference = (text) => {
  const match = String(text || '').match(/\b(usd|uyu|us\$|\$)\s*([0-9]+(?:[.,][0-9]{1,2})?)\b/iu)
  if (!match) {
    return null
  }

  const currency = String(match[1] || '').toUpperCase().replace('US$', 'USD')
  const amount = compactText(match[2] || '')
  if (!currency || !amount) {
    return null
  }

  return `${currency} ${amount}`
}

const isProductTopicType = (topic) =>
  topic &&
  ['product_family', 'product_topic', 'product_variant'].includes(
    String(topic.type || ''),
  )

const buildQuoteGuidanceText = ({
  referenceLabel = null,
  familyLabel = null,
  variantLabels = [],
  tenantTopicTaxonomy = [],
  quoteContext = null,
}) => {
  const cleanReference = compactText(referenceLabel || '')
  const cleanFamily = compactText(familyLabel || '')
  const cleanQuoteContextVariant = compactText(quoteContext?.variantLabel || '')
  const referenceVariantMatch = cleanReference
    ? findBestTenantTopicMatch(cleanReference, tenantTopicTaxonomy, {
        kinds: ['product_variant'],
      })
    : null
  const measurementLabel =
    quoteContext?.measurements?.confirmationLabel ||
    quoteContext?.measurements?.displayLabel ||
    null
  const missingFields = Array.isArray(quoteContext?.missingFields)
    ? quoteContext.missingFields.filter((entry) => typeof entry === 'string')
    : []
  const missingConfigurationLabels = Array.isArray(quoteContext?.missingAttributes)
    ? quoteContext.missingAttributes
        .map((attribute) => {
          if (!attribute || ['measurements', 'quantity'].includes(attribute.key)) {
            return null
          }

          if (typeof attribute.label === 'string' && attribute.label.trim()) {
            return attribute.label.trim()
          }

          return typeof attribute.key === 'string' ? attribute.key : null
        })
        .filter(Boolean)
    : []
  const requestedConfigurationLabels =
    missingConfigurationLabels.length > 0 ? missingConfigurationLabels : variantLabels
  const needsMeasurements = missingFields.includes('measurements')
  const needsQuantity = missingFields.includes('quantity')
  const referenceExtendsFamily =
    cleanReference &&
    cleanFamily &&
    normalizeText(cleanReference).includes(normalizeText(cleanFamily))
  const baseSubject =
    cleanReference &&
    (!referenceVariantMatch ||
      referenceVariantMatch.kind !== 'product_variant' ||
      referenceExtendsFamily ||
      cleanReference.split(/\s+/u).length > 1)
      ? cleanReference
      : cleanFamily || cleanReference
  const subject =
    baseSubject && cleanQuoteContextVariant
      ? normalizeText(baseSubject).includes(normalizeText(cleanQuoteContextVariant))
        ? baseSubject
        : compactText(`${baseSubject} ${cleanQuoteContextVariant}`)
      : baseSubject

  const lines = []
  if (measurementLabel) {
    if (subject) {
      lines.push(`Tomo una medida aproximada de ${measurementLabel} para ${subject}.`)
    } else {
      lines.push(`Tomo una medida aproximada de ${measurementLabel}.`)
    }
  } else if (subject) {
    lines.push(
      needsQuantity
        ? `Para cotizar ${subject}, decime las medidas aproximadas y cuántas unidades necesitás.`
        : `Para cotizar ${subject}, decime las medidas aproximadas.`,
    )
  } else {
    lines.push(
      needsQuantity
        ? 'Para orientarte con una cotización, decime las medidas aproximadas y cuántas unidades necesitás.'
        : 'Para orientarte con una cotización, decime las medidas aproximadas.',
    )
  }

  if (requestedConfigurationLabels.length > 0) {
    lines.push(
      `${
        measurementLabel
          ? needsQuantity
            ? 'Para avanzar con la cotización, indicame también cuántas unidades y'
            : 'Para avanzar con la cotización, indicame también'
          : needsQuantity
            ? 'Si ya tenés definida la configuración, indicame también cuántas unidades y'
            : 'Si ya tenés definida la configuración, indicame también'
      } ${formatVariantList(
        requestedConfigurationLabels,
      )}.`,
    )
  } else {
    lines.push(
      measurementLabel
        ? needsQuantity
          ? 'Para avanzar con la cotización, también podés indicarme cuántas unidades y la opción o configuración que buscás.'
          : 'Para avanzar con la cotización, también podés indicarme la opción o configuración que buscás.'
        : needsQuantity
          ? 'Si ya tenés definida la configuración, también indicame cuántas unidades.'
          : 'Si ya tenés definida la configuración, también podés indicármela.',
    )
  }

  return lines.join(' ')
}

export const buildMissingQuoteGuidanceLabels = (quoteContext = null) => {
  const missingAttributes = Array.isArray(quoteContext?.missingAttributes)
    ? quoteContext.missingAttributes
    : Array.isArray(quoteContext?.requiredAttributes)
      ? quoteContext.requiredAttributes
      : []
  const missingFields = Array.isArray(quoteContext?.missingFields)
    ? quoteContext.missingFields.filter((entry) => typeof entry === 'string')
    : []

  const attributeLabels = missingAttributes
    .filter((attribute) => attribute && typeof attribute === 'object')
    .map((attribute) => ({
      key: compactText(attribute?.key || ''),
      label: compactText(attribute?.label || attribute?.subjectPrefix || attribute?.key || ''),
    }))
    .filter(
      (attribute) =>
        attribute.label &&
        !['measurements', 'quantity', 'product'].includes(attribute.key),
    )
    .map((attribute) => attribute.label)

  const genericLabels = []
  if (missingFields.includes('measurements')) {
    genericLabels.push('las medidas aproximadas')
  }
  if (missingFields.includes('quantity')) {
    genericLabels.push('la cantidad')
  }

  return Array.from(new Set([...attributeLabels, ...genericLabels]))
}

export const buildQuoteProgressHint = (quoteContext = null) => {
  const labels = buildMissingQuoteGuidanceLabels(quoteContext)
  if (labels.length === 0) {
    return 'Si quieres, te ayudo a revisar la configuración pendiente o la disponibilidad.'
  }

  return `Si quieres, te ayudo a revisar ${formatVariantList(labels)} o la disponibilidad.`
}

export const buildContextualProductReference = ({
  requestedTopicLabel,
  topicLabel = null,
  contextTopicLabel = null,
  tenantTopicTaxonomy = [],
}) => {
  const normalizedRequestedTopic = normalizeText(requestedTopicLabel || '')
  const requested = compactText(requestedTopicLabel || '')
  const requestedMatch = findBestTenantTopicMatch(
    requestedTopicLabel,
    tenantTopicTaxonomy,
  )
  const strippedRequestedTopicLabel = requested
    .split(/\s+/u)
    .slice(1)
    .join(' ')
    .trim()
  const strippedRequestedMatch = strippedRequestedTopicLabel
    ? findBestTenantTopicMatch(strippedRequestedTopicLabel, tenantTopicTaxonomy)
    : null
  const familyHint =
    requestedMatch?.kind === 'product_family'
      ? requestedMatch.label
      : requestedMatch?.familyLabel ||
        extractTenantFamilyLabel(requestedTopicLabel, tenantTopicTaxonomy) ||
    extractTenantFamilyLabel(topicLabel, tenantTopicTaxonomy) ||
    extractTenantFamilyLabel(contextTopicLabel, tenantTopicTaxonomy)

  if (!requested) {
    return familyHint
  }

  if (
    !requestedMatch &&
    familyHint &&
    strippedRequestedMatch?.kind === 'product_variant'
  ) {
    return `${familyHint} configuración ${strippedRequestedMatch.label}`
      .replace(/\s+/g, ' ')
      .trim()
  }

  if (
    requestedMatch?.kind === 'product_topic' &&
    requestedMatch.matchedAlias === normalizedRequestedTopic
  ) {
    return requestedMatch.label
  }

  if (
    requestedMatch?.kind === 'product_variant' &&
    requestedMatch.matchedAlias === normalizedRequestedTopic
  ) {
    const parentLabel =
      requestedMatch.parentLabels.find((label) => normalizeText(label) !== normalizedRequestedTopic) ||
      requestedMatch.familyLabel ||
      familyHint
    if (parentLabel) {
      return `${parentLabel} ${requestedMatch.label}`.replace(/\s+/g, ' ').trim()
    }
  }

  if (familyHint) {
    const normalizedFamilyHint = normalizeText(familyHint)
    if (normalizedRequestedTopic.startsWith('color ')) {
      return `${familyHint} ${requested}`.replace(/\s+/g, ' ').trim()
    }
    if (!normalizedRequestedTopic.includes(normalizedFamilyHint)) {
      return `${familyHint} ${requested}`.replace(/\s+/g, ' ').trim()
    }
  }

  return requested
}

const formatVariantList = (items = []) => {
  if (items.length === 0) {
    return ''
  }
  if (items.length === 1) {
    return items[0]
  }
  if (items.length === 2) {
    return `${items[0]} y ${items[1]}`
  }
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
}

const extractCommercialVariantListFromEvidence = (source, options = {}) => {
  const tenantTopicTaxonomy = Array.isArray(options?.tenantTopicTaxonomy)
    ? options.tenantTopicTaxonomy
    : []
  const requestedTopicTokens = new Set(
    extractTopicTokens(options?.requestedTopicLabel || ''),
  )
  const seen = new Set()
  const variants = []
  const rawSources = Array.isArray(source) ? source : [source]
  const requestedTopicMatch = findBestTenantTopicMatch(
    Array.from(requestedTopicTokens).join(' '),
    tenantTopicTaxonomy,
  )

  for (const entry of rawSources) {
    const text = compactText(entry)
    if (!text) {
      continue
    }

    const matches = text.matchAll(
      /\b(?:lineas?|líneas?|series?|opciones)\b[^.!?]*?\b(?:como|en)\s+([^.!?]+?)(?=(?:\s+con\b|\s+segun\b|[.!?]|$))/giu,
    )

    for (const match of matches) {
      const fragment = compactText(match[1] || '')
      if (!fragment) {
        continue
      }

      const candidates = fragment
        .split(/\s*(?:,| y | e | o | u |\/)\s*/iu)
        .map((item) => compactText(item))
        .filter(Boolean)

      for (const candidate of candidates) {
        const normalizedCandidate = normalizeText(candidate)
        if (
          !normalizedCandidate ||
          requestedTopicTokens.has(normalizedCandidate) ||
          normalizedCandidate.length < 3 ||
          normalizedCandidate.split(/\s+/u).length > 3
        ) {
          continue
        }

        const candidateTopicMatch = findBestTenantTopicMatch(candidate, tenantTopicTaxonomy)
        if (
          candidateTopicMatch &&
          requestedTopicMatch &&
          topicMatchEquals(candidateTopicMatch, requestedTopicMatch)
        ) {
          continue
        }

        if (seen.has(normalizedCandidate)) {
          continue
        }

        seen.add(normalizedCandidate)
        variants.push(candidate)
      }
    }
  }

  return variants
}

const extractProductVariantsFromEvidence = (evidence = [], tenantTopicTaxonomy = []) => {
  const normalizedEvidence = normalizeText(
    evidence.map((entry) => entry?.text || '').join(' '),
  )
  const orderedTaxonomyVariants = normalizeTenantTopicTaxonomy(
    tenantTopicTaxonomy,
  ).filter((entry) => entry.kind === 'product_variant')
  const labels = []
  const seen = new Set()

  for (const entry of orderedTaxonomyVariants) {
    const matched = entry.aliases.some((alias) =>
      normalizedEvidence.includes(` ${alias} `) ||
      normalizedEvidence.startsWith(`${alias} `) ||
      normalizedEvidence.endsWith(` ${alias}`) ||
      normalizedEvidence === alias,
    )
    if (!matched || seen.has(entry.label)) {
      continue
    }
    seen.add(entry.label)
    labels.push(entry.label)
  }

  if (labels.length > 0) {
    return labels
  }

  return extractTenantVariantLabels(normalizedEvidence, tenantTopicTaxonomy)
}

const extractKnowledgeFragmentsFromItem = (item) =>
  [
    { sourceKind: 'snippet', value: item?.snippet },
    { sourceKind: 'summary', value: item?.summary },
    { sourceKind: 'content', value: item?.content },
    { sourceKind: 'title', value: item?.title },
  ].flatMap((source) =>
    splitKnowledgeTextIntoFragments(source.value).map((entry) => ({
      text: entry,
      sourceKind: source.sourceKind,
    })),
  )

const scoreCustomerFaqEvidence = ({
  fragment,
  faqSubtype,
  inputTokens = [],
  requestedTopicTokens = [],
  item,
  sourceKind = 'content',
  paymentMethods = [],
  tenantRuntimePolicy = null,
}) => {
  const normalizedFragment = normalizeText(fragment)
  const fragmentTokens = extractTopicTokens(fragment)
  let score = calculateTopicOverlap(inputTokens, fragmentTokens)

  if (requestedTopicTokens.length) {
    score += calculateTopicOverlap(requestedTopicTokens, fragmentTokens) * 2
  }

  if (faqSubtype === 'business_hours') {
    if (/\b(horario|lunes|martes|miercoles|miércoles|jueves|viernes|sabados|sábados|domingos)\b/.test(normalizedFragment)) {
      score += 3
    }
    if (/\b\d{1,2}[:.]\d{2}\b/.test(fragment)) {
      score += 2
    }
  } else if (faqSubtype === 'location') {
    if (isStrongLocationEvidence(fragment)) {
      score += 6
    } else if (hasLocationSignals(fragment)) {
      score += 1.5
    }
    if (isWeakCommercialLocationEvidence(fragment, tenantRuntimePolicy)) {
      score -= 5
    }
    const normalizedTitle = normalizeText(item?.title || '')
    if (/\b(contacto|preguntas frecuentes|faq)\b/.test(normalizedTitle)) {
      score += 2
    }
  } else if (faqSubtype === 'payment_methods') {
    if (hasExplicitPaymentTerms(normalizedFragment, paymentMethods)) {
      score += 3
    }
  } else if (faqSubtype === 'contact') {
    if (/\b(telefono|teléfono|whatsapp|contacto|llamar|comunicarse)\b/.test(normalizedFragment)) {
      score += 3
    }
    if (/\b\d{6,}\b/.test(normalizedFragment.replace(/\s+/g, ''))) {
      score += 2
    }
  } else if (faqSubtype === 'maintenance') {
    if (/\b(limpia|limpiar|mantenimiento|mantener|cuidado)\b/.test(normalizedFragment)) {
      score += 3
    }
  } else if (faqSubtype === 'benefits') {
    if (/\b(beneficio|beneficios|ventaja|ventajas|aislamiento|acustico|acústico|termico|térmico)\b/.test(normalizedFragment)) {
      score += 3
    }
  } else if (faqSubtype === 'definition') {
    if (/\b(es|sirve|funciona|permite)\b/.test(normalizedFragment)) {
      score += 2
    }
  } else if (faqSubtype === 'availability') {
    score += 2
  }

  if (
    requestedTopicTokens.length > 0 &&
    !['business_hours', 'location', 'payment_methods', 'contact'].includes(
      faqSubtype,
    ) &&
    isOperationalBusinessInfoEvidence({
      text: fragment,
      paymentMethods,
      tenantRuntimePolicy,
    })
  ) {
    score -= 6
  }

  const retrievalScore =
    typeof item?.score === 'number' && Number.isFinite(item.score) ? item.score : 0
  score += Math.min(retrievalScore, 1)

  if (sourceKind === 'snippet') {
    score += 0.9
  } else if (sourceKind === 'summary') {
    score += 0.6
  } else if (sourceKind === 'content') {
    score += 0.3
  } else if (sourceKind === 'title') {
    score -= 1.5
  }

  return score
}

export const selectCustomerFaqEvidence = ({
  input,
  retrievalItems,
  faqSubtype,
  intentKey = null,
  paymentMethods = [],
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
  interpretation = null,
}) => {
  const inputTokens = extractTopicTokens(input)
  const { requestedTopicLabel } = resolveFaqTopicSignals({
    input,
    interpretation,
    tenantTopicTaxonomy,
    tenantRuntimePolicy,
  })
  const requestedTopicTokens = extractTopicTokens(requestedTopicLabel || '')
  const candidates = []
  const seen = new Set()
  let order = 0

  for (const item of retrievalItems.slice(0, 4)) {
    const fragments = extractKnowledgeFragmentsFromItem(item)
    for (const fragment of fragments) {
      const normalized = normalizeText(fragment.text)
      if (!normalized || seen.has(normalized)) {
        continue
      }
      seen.add(normalized)
      candidates.push({
        text: normalizeKnowledgeFallbackStatement(
          fragment.text,
          tenantRuntimePolicy,
        ),
        sourceKind: fragment.sourceKind,
        sourceId: compactText(item?.id || item?.documentId || ''),
        documentId: compactText(item?.documentId || item?.id || ''),
        score: scoreCustomerFaqEvidence({
          fragment: fragment.text,
          faqSubtype,
          inputTokens,
          requestedTopicTokens,
          item,
          sourceKind: fragment.sourceKind,
          paymentMethods,
          tenantRuntimePolicy,
        }),
        order,
      })
      order += 1
    }
  }

  const ordered = candidates
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return left.order - right.order
    })

  const shouldFilterOperationalEvidence =
    ['customer.product_info', 'customer.topic_info'].includes(
      String(intentKey || ''),
    ) &&
    !['business_hours', 'location', 'payment_methods', 'contact'].includes(
      faqSubtype,
    )

  const effectiveOrdered = (() => {
    const withoutOperationalLeakage = shouldFilterOperationalEvidence
      ? (() => {
          const filtered = ordered.filter(
            (entry) =>
              !isOperationalBusinessInfoEvidence({
                text: entry.text,
                paymentMethods,
                tenantRuntimePolicy,
              }),
          )
          return filtered.length ? filtered : ordered
        })()
      : ordered

    const nonTitleEvidence = withoutOperationalLeakage.filter(
      (entry) => entry.sourceKind !== 'title',
    )
    return nonTitleEvidence.length ? nonTitleEvidence : withoutOperationalLeakage
  })()

  if (faqSubtype === 'location') {
    const strongLocationCandidates = ordered.filter((entry) =>
      isStrongLocationEvidence(entry.text),
    )
    if (strongLocationCandidates.length) {
      return strongLocationCandidates.slice(0, 2)
    }

    const locationCandidates = ordered.filter(
      (entry) =>
        hasLocationSignals(entry.text) &&
        !isWeakCommercialLocationEvidence(entry.text, tenantRuntimePolicy) &&
        entry.sourceKind !== 'title',
    )
    return locationCandidates.slice(0, 2)
  }

  if (faqSubtype === 'payment_methods') {
    const configuredPaymentCandidates = ordered.filter((entry) =>
      hasConfiguredPaymentMethodMention(entry.text, paymentMethods),
    )
    if (configuredPaymentCandidates.length) {
      return configuredPaymentCandidates.slice(0, 1)
    }

    const paymentCandidates = ordered.filter((entry) =>
      hasExplicitPaymentTerms(entry.text, paymentMethods),
    )
    if (paymentCandidates.length) {
      return paymentCandidates.slice(0, 1)
    }
  }

  if (faqSubtype === 'benefits') {
    return effectiveOrdered.slice(0, 2)
  }

  if (faqSubtype === 'variants') {
    return effectiveOrdered.slice(0, 3)
  }

  return effectiveOrdered.slice(0, 1)
}

const toInlineBusinessAnswer = (statement) =>
  compactText(
    String(statement || '')
      .replace(/^(horario de atencion|horario de atención)\s*[:\-]?\s*/iu, '')
      .replace(/^(direccion|dirección|ubicacion|ubicación)\s*[:\-]?\s*/iu, '')
      .replace(/^(medios de pago|formas de pago)\s*[:\-]?\s*/iu, '')
      .replace(/^(disponibles?)\s*[:\-]?\s*/iu, '')
      .replace(/^(telefono|teléfono|whatsapp|contacto)\s*[:\-]?\s*/iu, '')
      .replace(/^(aceptamos)\s+/iu, '')
      .replace(/^(puedes contactarnos en)\s+/iu, '')
      .replace(/^(estamos en)\s+/iu, ''),
  )

const buildShapedCustomerFaqResponse = ({
  faqSubtype,
  evidence,
  intentKey,
  topicLabel = null,
  tenantTopicTaxonomy = [],
  variationSeed = '',
  wordingOverrides = null,
  previousIntentKey = null,
  preferOperationalPaymentFollowUp = false,
  preferOperationalScheduleFollowUp = false,
  channel = null,
  channelProfile = null,
}) => {
  const firstEvidence = evidence[0]?.text || null
  const secondEvidence = evidence[1]?.text || null
  if (!firstEvidence) {
    return null
  }

  if (faqSubtype === 'business_hours') {
    if (preferOperationalScheduleFollowUp) {
      return pickWordingVariant({
        key: 'customer.schedule.availability_followup',
        variationSeed,
        overrides: wordingOverrides,
        channel,
        channelProfile,
        fallback:
          'Todavía no te puedo confirmar una franja exacta por acá. Si querés, pasame la dirección y un teléfono de contacto y lo dejamos encaminado para coordinar la visita.',
      })
    }
    return `Nuestro horario de atención es ${toInlineBusinessAnswer(firstEvidence)}`
  }

  if (faqSubtype === 'location') {
    const preferredLocationEvidence =
      !isStrongLocationEvidence(firstEvidence) &&
      secondEvidence &&
      isStrongLocationEvidence(secondEvidence)
        ? secondEvidence
        : firstEvidence
    const secondaryLocationEvidence =
      preferredLocationEvidence === firstEvidence ? secondEvidence : firstEvidence
    const normalizedFirst = normalizeText(preferredLocationEvidence)
    if (
      /^nos encontramos en\b/i.test(preferredLocationEvidence) ||
      /^estamos en\b/i.test(preferredLocationEvidence)
    ) {
      return preferredLocationEvidence
    }
    if (
      /\b(no contamos con local comercial|atencion totalmente en linea|atención totalmente en línea)\b/.test(
        normalizedFirst,
      )
    ) {
      const lines = [preferredLocationEvidence]
      if (
        secondaryLocationEvidence &&
        /\b(visitas? a domicilio|relevamiento|asesoramiento)\b/.test(
          normalizeText(secondaryLocationEvidence),
        )
      ) {
        lines.push(secondaryLocationEvidence)
      }
      return lines.join(' ')
    }
    return `Estamos en ${toInlineBusinessAnswer(preferredLocationEvidence)}`
  }

  if (faqSubtype === 'payment_methods') {
    const inlineAnswer = toInlineBusinessAnswer(firstEvidence).replace(/[.!?]+$/u, '')
    if (
      previousIntentKey === 'customer.support_request' ||
      preferOperationalPaymentFollowUp
    ) {
      return pickWordingVariant({
        key: 'customer.faq.payment_methods_operational_followup',
        variationSeed,
        variables: {
          paymentMethods: inlineAnswer,
        },
        overrides: wordingOverrides,
        channel,
        channelProfile,
        fallback: `Aceptamos ${inlineAnswer}. Si ya mandaste el material o el comprobante, lo dejo en seguimiento y seguimos por acá.`,
      })
    }
    return pickWordingVariant({
      key: 'customer.faq.payment_methods',
      variationSeed,
      variables: {
        paymentMethods: inlineAnswer,
      },
      overrides: wordingOverrides,
      channel,
      channelProfile,
      fallback: `Aceptamos ${inlineAnswer}. Si querés, te indico opciones o condiciones según el medio de pago.`,
    })
  }

  if (faqSubtype === 'contact') {
    return `Puedes contactarnos en ${toInlineBusinessAnswer(firstEvidence)}`
  }

  if (faqSubtype === 'maintenance') {
    return `Sí. ${firstEvidence} Si quieres, te comparto recomendaciones puntuales para ese tipo de producto.`
  }

  if (faqSubtype === 'benefits') {
    const lines = [`Sí. ${firstEvidence}`]
    if (secondEvidence) {
      lines.push(secondEvidence)
    }
    lines.push('Si quieres, te ayudo a ver qué opción te conviene más según lo que buscas.')
    return lines.join(' ')
  }

  if (faqSubtype === 'definition') {
    return `Sí. ${firstEvidence} Si quieres, te lo explico de forma más simple o te cuento cuándo conviene.`
  }

  if (faqSubtype === 'variants') {
    const variants = extractProductVariantsFromEvidence(evidence, tenantTopicTaxonomy)
    if (topicLabel && variants.length) {
      return `Tenemos ${topicLabel} en ${formatVariantList(variants)}. Si quieres, te cuento cuál conviene más según luz, privacidad y uso.`
    }
    if (topicLabel) {
      return `Tenemos varias opciones de ${topicLabel}. ${firstEvidence} Si quieres, te cuento diferencias y usos según lo que necesitas.`
    }
    return `Tenemos varias opciones. ${firstEvidence} Si quieres, te cuento diferencias y usos según lo que necesitas.`
  }

  if (intentKey === 'customer.topic_info') {
    return `Sí. ${firstEvidence} Si quieres, te amplío según lo que necesitas.`
  }

  return null
}

const buildTopicSpecificKnowledgeFallbackText = (
  input,
  retrievalItems,
  options = {},
) => {
  const detectionInput =
    typeof options?.detectionInput === 'string' && options.detectionInput.trim()
      ? options.detectionInput.trim()
      : input
  const normalizedInput = normalizeText(detectionInput)
  const combinedSourceText = normalizeText(
    retrievalItems
      .flatMap((item) => [item?.title, item?.summary, item?.snippet, item?.content])
      .filter(Boolean)
      .join(' '),
  )
  const faqSubtype =
    options?.faqSubtype ||
    detectCustomerFaqSubtype(detectionInput, {
      retrievalItems,
      tenantRuntimePolicy: options?.tenantRuntimePolicy || null,
    })
  if (
    faqSubtype === 'business_hours' ||
    faqSubtype === 'location' ||
    faqSubtype === 'payment_methods' ||
    faqSubtype === 'contact'
  ) {
    return null
  }
  const intentKey = typeof options?.intentKey === 'string' ? options.intentKey : null
  const evidenceEntries = Array.isArray(options?.evidence)
    ? options.evidence.filter((entry) => entry && typeof entry === 'object')
    : []
  const evidenceTexts = evidenceEntries.map((entry) => entry?.text || '').filter(Boolean)
  const evidenceSourceText = evidenceTexts.join(' ')
  const primaryEvidenceEntry = evidenceEntries[0] || null
  const primaryEvidenceRaw = compactText(primaryEvidenceEntry?.text || '')
  const primaryEvidence =
    primaryEvidenceRaw &&
    primaryEvidenceEntry?.sourceKind !== 'title' &&
    !isOperationalBusinessInfoEvidence({
      text: primaryEvidenceRaw,
      paymentMethods:
        Array.isArray(getBusinessRules(options?.tenantRuntimePolicy || null)?.paymentMethods)
          ? getBusinessRules(options?.tenantRuntimePolicy || null).paymentMethods
          : [],
      tenantRuntimePolicy: options?.tenantRuntimePolicy || null,
    })
      ? primaryEvidenceRaw
      : ''
  const interpretation =
    options?.interpretation && typeof options.interpretation === 'object'
      ? options.interpretation
      : null
  const readiness = readInterpretationResolutionReadiness(interpretation)
  const quoteSideQuestionContract =
    readiness?.lane === 'quote' &&
    readiness?.answerMode === 'answer_side_question'
  const tenantTopicTaxonomy = Array.isArray(options?.tenantTopicTaxonomy)
    ? options.tenantTopicTaxonomy
    : []
  const {
    semanticInfoIntent,
    requestedTopicLabel,
    hasResolvedSemanticSubject,
  } = resolveFaqTopicSignals({
    input: detectionInput,
    interpretation,
    tenantTopicTaxonomy,
    tenantRuntimePolicy: options?.tenantRuntimePolicy || null,
  })
  const requestedTopicMatch = findBestTenantTopicMatch(
    requestedTopicLabel || interpretation?.topic?.label || '',
    tenantTopicTaxonomy,
  )
  const normalizedRequestedTopic = normalizeText(requestedTopicLabel || '')
  const taxonomyTopicMatch = findBestTenantTopicMatch(
    requestedTopicLabel || interpretation?.topic?.label || '',
    tenantTopicTaxonomy,
  )
  const resolvedTopicReference = buildContextualProductReference({
    requestedTopicLabel,
    topicLabel: interpretation?.topic?.label || null,
    contextTopicLabel: interpretation?.contextTopic?.label || null,
    tenantTopicTaxonomy,
  })
  const displayTopicLabel = resolvedTopicReference || requestedTopicLabel
  const priceReference = extractPriceReference(evidenceSourceText || combinedSourceText)
  const quoteRequirementsQuestion = looksLikeQuoteRequirementsQuestion(detectionInput)
  const configuredProductInterest = looksLikeConfiguredProductInterest(
    detectionInput,
    tenantTopicTaxonomy,
  )
  const currentAndContextText = [
    detectionInput,
    interpretation?.topic?.label,
    interpretation?.contextTopic?.label,
  ]
    .filter(Boolean)
    .join(' ')
  const currentFamilyLabel =
    extractTenantFamilyLabel(currentAndContextText, tenantTopicTaxonomy) ||
    extractTenantFamilyLabel(
      interpretation?.contextTopic?.label || interpretation?.topic?.label || '',
      tenantTopicTaxonomy,
    )
  const currentVariantLabels = Array.from(
    new Set(
      extractTenantVariantLabels(currentAndContextText, tenantTopicTaxonomy),
    ),
  )
  const quoteContext =
    interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
      ? interpretation.quoteContext
      : null
  const productInfoOpening =
    (
      (
        semanticInfoIntent?.shape === 'general_info' &&
        semanticInfoIntent?.subjectMode === 'explicit' &&
        semanticInfoIntent?.subjectResolution === 'resolved_subject'
      ) ||
      (!semanticInfoIntent &&
        looksLikeCustomerProductInfoOpening(detectionInput, {
          tenantTopicTaxonomy,
        }))
    ) &&
    !looksLikePriceOrQuoteTurn(detectionInput)
  const shouldAppendQuoteBridge =
    !quoteSideQuestionContract &&
    !productInfoOpening &&
    (intentKey === 'customer.quote' || QUOTE_SEED_INTENT_REGEX.test(detectionInput))
  const quoteBridgeText =
    shouldAppendQuoteBridge
      ? buildQuoteGuidanceText({
          referenceLabel:
            resolvedTopicReference ||
            displayTopicLabel ||
            interpretation?.topic?.label ||
            interpretation?.contextTopic?.label ||
            null,
          familyLabel: currentFamilyLabel,
          variantLabels: currentVariantLabels,
          tenantTopicTaxonomy,
          quoteContext,
        })
      : null
  const variationSeed = String(options?.variationSeed || '')
  const wordingOverrides = options?.wordingOverrides || null
  const channel = options?.channel || null
  const channelProfile = options?.channelProfile || null

  if (quoteRequirementsQuestion && !quoteSideQuestionContract) {
    return buildQuoteGuidanceText({
      referenceLabel:
        resolvedTopicReference ||
        (isProductTopicType(interpretation?.contextTopic)
          ? interpretation.contextTopic.label
          : null),
      familyLabel: currentFamilyLabel,
      variantLabels: currentVariantLabels,
      tenantTopicTaxonomy,
      quoteContext,
    })
  }

  if (intentKey === 'customer.quote' && priceReference && !quoteSideQuestionContract) {
    const measurementLabel =
      quoteContext?.measurements?.displayLabel || quoteContext?.measurements?.confirmationLabel
    if (measurementLabel) {
      return `Para esa configuración y una medida aproximada de ${measurementLabel} podemos tomar como referencia una cotización de ${priceReference}. ${buildQuoteProgressHint(
        quoteContext,
      )}`
    }
    return `Para esa configuración podemos tomar como referencia una cotización de ${priceReference}. ${buildQuoteProgressHint(
      quoteContext,
    )}`
  }

  if (
    !quoteSideQuestionContract &&
    configuredProductInterest &&
    (currentFamilyLabel ||
      isProductTopicType(interpretation?.contextTopic) ||
      isProductTopicType(interpretation?.topic))
  ) {
    return `Perfecto. ${buildQuoteGuidanceText({
      referenceLabel:
        resolvedTopicReference ||
        interpretation?.contextTopic?.label ||
        interpretation?.topic?.label ||
        null,
      familyLabel: currentFamilyLabel,
      variantLabels: currentVariantLabels,
      tenantTopicTaxonomy,
      quoteContext,
    })}`
  }

  if (
    requestedTopicMatch?.kind === 'product_variant' &&
    sourceMentionsTopicMatch(combinedSourceText, requestedTopicMatch)
  ) {
    const shouldPreferGenericVariantDefinition =
      faqSubtype === 'definition' &&
      !interpretation?.followUp?.detected &&
      !interpretation?.contextTopic?.label
    const contextualTopicSignal = normalizeText(
      [
        resolvedTopicReference,
        interpretation?.topic?.label,
        interpretation?.contextTopic?.label,
      ]
        .filter(Boolean)
        .join(' '),
    )
    const contextualFamilyLabel = extractTenantFamilyLabel(
      contextualTopicSignal,
      tenantTopicTaxonomy,
    )
    const contextualVariants = extractTenantVariantLabels(
      contextualTopicSignal,
      tenantTopicTaxonomy,
    )
    const hasContextualProductAnchor = Boolean(
      interpretation?.topic?.label || interpretation?.contextTopic?.label,
    )
    if (
      !shouldPreferGenericVariantDefinition &&
      hasContextualProductAnchor &&
      (contextualFamilyLabel || contextualVariants.length > 0)
    ) {
      const contextualEvidence = compactText(evidenceTexts[0] || '')
      const variantLabel = displayTopicLabel || requestedTopicMatch.label
      const contextualReference =
        displayTopicLabel &&
        sourceMentionsTopicMatch(displayTopicLabel, requestedTopicMatch)
          ? displayTopicLabel
          : contextualFamilyLabel
            ? `${contextualFamilyLabel} con ${variantLabel}`
            : `esa configuración con ${variantLabel}`
      const contextualFallbackEvidence = contextualFamilyLabel
        ? `Las ${contextualFamilyLabel} con ${variantLabel} mejoran prestaciones y se configuran según medidas y línea.`
        : `La configuración con ${variantLabel} mejora prestaciones y se define según medidas y línea.`
      return `Sí, trabajamos con ${contextualReference}. ${
        contextualEvidence ||
        contextualFallbackEvidence
      } Si quieres, te cuento opciones, líneas y prestaciones según lo que necesitas.`
    }

    const lines = [
      `Sí. ${compactText(evidenceTexts[0] || '') || `${requestedTopicMatch.label} es una variante disponible dentro de las configuraciones trabajadas.`}`,
    ]
    const evidenceVariants = extractCommercialVariantListFromEvidence(
      [
        ...evidenceTexts,
        ...retrievalItems.flatMap((item) => [item?.summary, item?.snippet, item?.title, item?.content]),
      ],
      {
        requestedTopicLabel:
          displayTopicLabel || requestedTopicLabel || requestedTopicMatch.label,
        tenantTopicTaxonomy,
      },
    )
    if (evidenceVariants.length > 0) {
      lines.push(
        `Se usa en líneas de mayor prestación como ${formatVariantList(evidenceVariants)}.`,
      )
    }
    lines.push(
      'Si quieres, te explico beneficios, cuándo conviene y qué opciones manejan.',
    )
    return lines.join(' ')
  }

  if (
    requestedTopicLabel &&
    resolvedTopicReference &&
    !quoteSideQuestionContract &&
    (intentKey === 'customer.quote' || looksLikePriceOrQuoteTurn(input))
  ) {
    if (priceReference) {
      return `Para esa configuración podemos tomar como referencia una cotización de ${priceReference}. ${buildQuoteProgressHint(
        quoteContext,
      )}`
    }

    const evidenceOverlap = calculateTopicOverlap(
      extractTopicTokens(resolvedTopicReference),
      extractTopicTokens(evidenceSourceText || combinedSourceText),
    )
    if (
      evidenceOverlap > 0 ||
      extractTenantVariantLabels(combinedSourceText, tenantTopicTaxonomy).length > 0 ||
      Boolean(extractTenantFamilyLabel(combinedSourceText, tenantTopicTaxonomy))
    ) {
      const contextLabel =
        interpretation?.contextTopic?.label || interpretation?.topic?.label || ''
      const contextVariantLabels = extractTenantVariantLabels(
        contextLabel,
        tenantTopicTaxonomy,
      )
      const requestedVariantLabels = extractTenantVariantLabels(
        normalizedRequestedTopic,
        tenantTopicTaxonomy,
      )
      const missingContextVariant = contextVariantLabels.find(
        (variant) => !requestedVariantLabels.includes(variant),
      )

      return `Sí, trabajamos con ${resolvedTopicReference}. Para orientarte con el costo, decime las medidas${
        missingContextVariant ? ` y si lo buscas con ${missingContextVariant}` : ''
      }.`
    }
  }

  if (displayTopicLabel && faqSubtype === 'availability') {
    const requestedTopicTokens = extractTopicTokens(displayTopicLabel)
    const evidenceOverlap = calculateTopicOverlap(
      requestedTopicTokens,
      extractTopicTokens(evidenceSourceText),
    )
    const combinedOverlap = calculateTopicOverlap(
      requestedTopicTokens,
      extractTopicTokens(combinedSourceText),
    )
    const overlap = Math.max(evidenceOverlap, combinedOverlap)
    if (requestedTopicTokens.length && overlap > 0) {
      const availabilityText = pickWordingVariant({
        key: 'customer.faq.product_availability',
        variationSeed,
        overrides: wordingOverrides,
        channel,
        channelProfile,
        variables: { topic: displayTopicLabel },
        fallback: `Sí, contamos con ${displayTopicLabel}. Si quieres, te amplío beneficios, usos y opciones según lo que necesitas.`,
      })
      return quoteBridgeText ? `${availabilityText} ${quoteBridgeText}`.trim() : availabilityText
    }
  }

  if (displayTopicLabel && faqSubtype === 'general') {
    const requestedTopicTokens = extractTopicTokens(displayTopicLabel)
    const evidenceOverlap = calculateTopicOverlap(
      requestedTopicTokens,
      extractTopicTokens(evidenceSourceText),
    )
    const combinedOverlap = calculateTopicOverlap(
      requestedTopicTokens,
      extractTopicTokens(combinedSourceText),
    )
    const overlap = Math.max(evidenceOverlap, combinedOverlap)
    if (requestedTopicTokens.length && overlap > 0) {
      const evidenceVariantLabels = extractTenantVariantLabels(
        combinedSourceText,
        tenantTopicTaxonomy,
      )
      if (
        taxonomyTopicMatch?.kind === 'product_family' &&
        (/\b(varios tipos|opciones)\b/i.test(combinedSourceText) ||
          evidenceVariantLabels.length > 0)
      ) {
        return pickWordingVariant({
          key: 'customer.faq.product_family_options',
          variationSeed,
          overrides: wordingOverrides,
          channel,
          channelProfile,
          variables: { topic: displayTopicLabel },
          fallback: `Perfecto, trabajamos con varios tipos de ${displayTopicLabel}. ¿Tenés alguno en mente o querés que te cuente opciones?`,
        })
      }
      if (taxonomyTopicMatch?.kind === 'product_variant' && primaryEvidence) {
        const variantText = pickWordingVariant({
          key: 'customer.faq.product_variant_with_evidence',
          variationSeed,
          overrides: wordingOverrides,
          channel,
          channelProfile,
          variables: {
            topic: displayTopicLabel,
            evidence: primaryEvidence,
          },
          fallback: `Sí, también tenemos ${displayTopicLabel}. ${primaryEvidence} Si quieres, te cuento cuál conviene más según luz, privacidad y uso.`,
        })
        return quoteBridgeText ? `${variantText} ${quoteBridgeText}`.trim() : variantText
      }
      if (primaryEvidence) {
        const generalWithEvidenceText = pickWordingVariant({
          key: 'customer.faq.product_general_with_evidence',
          variationSeed,
          overrides: wordingOverrides,
          channel,
          channelProfile,
          variables: {
            topic: displayTopicLabel,
            evidence: primaryEvidence,
          },
          fallback: `Sí, trabajamos con ${displayTopicLabel}. ${primaryEvidence} Si quieres, te cuento opciones y usos según lo que necesitas.`,
        })
        return quoteBridgeText
          ? `${generalWithEvidenceText} ${quoteBridgeText}`.trim()
          : generalWithEvidenceText
      }
      const generalProductText = pickWordingVariant({
        key: 'customer.faq.product_general',
        variationSeed,
        overrides: wordingOverrides,
        channel,
        channelProfile,
        variables: { topic: displayTopicLabel },
        fallback: `Sí, trabajamos con ${displayTopicLabel}. Si quieres, te cuento opciones, líneas y prestaciones según lo que necesitas.`,
      })
      return quoteBridgeText ? `${generalProductText} ${quoteBridgeText}`.trim() : generalProductText
    }
  }

  return null
}

export const extractKnowledgeFallbackStatements = (retrievalItems, options = {}) => {
  const limit =
    typeof options?.limit === 'number' && Number.isFinite(options.limit)
      ? options.limit
      : 2
  const inputTokens = extractTopicTokens(options?.input || '')
  const candidates = []
  const seen = new Set()
  let order = 0

  for (const item of retrievalItems.slice(0, 3)) {
    const sources = [item?.summary, item?.snippet, item?.content, item?.title]
    for (const source of sources) {
      const fragments = splitKnowledgeTextIntoFragments(source)

      for (const fragment of fragments) {
        const normalized = normalizeText(fragment)
        if (!normalized || seen.has(normalized)) {
          continue
        }
        seen.add(normalized)
        const fragmentTokens = extractTopicTokens(fragment)
        const overlap = inputTokens.length
          ? calculateTopicOverlap(inputTokens, fragmentTokens)
          : 0
        candidates.push({
          text: normalizeKnowledgeFallbackStatement(
            fragment,
            options?.tenantRuntimePolicy || null,
          ),
          overlap,
          order,
        })
        order += 1
      }
    }
  }

  return candidates
    .sort((left, right) => {
      if (right.overlap !== left.overlap) {
        return right.overlap - left.overlap
      }
      return left.order - right.order
    })
    .slice(0, limit)
    .map((entry) => entry.text)
}

export const buildGenericCustomerKnowledgeFallbackText = (
  intentKey,
  retrievalItems,
  input = '',
  options = {},
) => {
  const readiness = readInterpretationResolutionReadiness(
    options?.interpretation && typeof options.interpretation === 'object'
      ? options.interpretation
      : null,
  )
  const quoteSideQuestionContract =
    readiness?.lane === 'quote' &&
    readiness?.answerMode === 'answer_side_question'
  const statements = extractKnowledgeFallbackStatements(retrievalItems, {
    input,
    tenantRuntimePolicy: options?.tenantRuntimePolicy || null,
  })
  if (!statements.length) {
    return null
  }

  const lines = []
  if (intentKey === 'customer.topic_info') {
    lines.push(`Sí. ${statements[0]}`)
  } else {
    lines.push(statements[0])
  }

  if (statements[1]) {
    lines.push(statements[1])
  }

  if (intentKey === 'customer.quote' && !quoteSideQuestionContract) {
    lines.push(
      'Si quieres, te ayudo a revisar qué opción encaja mejor y luego confirmamos medidas o disponibilidad.',
    )
  } else {
    lines.push(
      pickWordingVariant({
        key: 'customer.faq.product_availability',
        variationSeed: String(options?.variationSeed || ''),
        overrides: options?.wordingOverrides || null,
        channel: options?.channel || null,
        channelProfile: options?.channelProfile || null,
        variables: { topic: 'esa opción' },
        fallback:
          'Sí, contamos con esa opción. Si quieres, te amplío beneficios, usos y opciones según lo que necesitas.',
      }).replace(/^Sí,\s*(?:contamos con|trabajamos con)\s+esa opción\.\s*/i, ''),
    )
  }

  return lines.join(' ')
}

export const buildCustomerFaqKnowledgeResponse = ({
  input,
  retrievalItems,
  intentKey,
  interpretation = null,
  tenantTopicTaxonomy = [],
  tenantRuntimePolicy = null,
  paymentMethods = [],
  variationSeed = '',
  wordingOverrides = null,
  previousIntentKey = null,
  channel = null,
  channelProfile = null,
}) => {
  const detectionInput =
    typeof interpretation?.normalizedCurrentTurn === 'string' &&
    interpretation.normalizedCurrentTurn.trim()
      ? interpretation.normalizedCurrentTurn.trim()
      : input
  const readiness = readInterpretationResolutionReadiness(interpretation)
  const interpretedFaqSubtype = [
    readiness?.sideQuestionSubtype,
    interpretation?.faqSubtype,
  ].find((value) => {
    const normalized = compactText(value).toLowerCase()
    return Boolean(normalized) && normalized !== 'general' && normalized !== 'unknown'
  })
  const directFaqSubtype = detectCustomerFaqSubtype(detectionInput, {
    tenantRuntimePolicy,
  })
  const retrievalAwareFaqSubtype = detectCustomerFaqSubtype(detectionInput, {
    retrievalItems,
    tenantRuntimePolicy,
  })
  const semanticInfoIntent = readSemanticInfoIntent(interpretation)
  const {
    requestedTopicLabel,
    hasResolvedSemanticSubject,
  } = resolveFaqTopicSignals({
    input: detectionInput,
    interpretation,
    tenantTopicTaxonomy,
    tenantRuntimePolicy,
  })
  const semanticProductInfoOpening =
    semanticInfoIntent?.shape === 'general_info' &&
    semanticInfoIntent?.subjectMode === 'explicit' &&
    semanticInfoIntent?.subjectResolution === 'resolved_subject'
  const hasProductInfoAnchor =
    ['customer.product_info', 'customer.topic_info'].includes(
      String(intentKey || ''),
    ) &&
    (
      semanticInfoIntent?.shape === 'general_info' ||
      semanticInfoIntent?.shape === 'variant_discovery' ||
      semanticInfoIntent?.shape === 'comparison' ||
      hasResolvedSemanticSubject ||
      (!semanticInfoIntent &&
        looksLikeCustomerProductInfoOpening(detectionInput, {
          tenantTopicTaxonomy,
        })) ||
      semanticProductInfoOpening ||
      Boolean(requestedTopicLabel) ||
      Boolean(interpretation?.topic?.label) ||
      Boolean(interpretation?.contextTopic?.label)
    )
  const faqSubtype =
    interpretedFaqSubtype ||
    (
      hasProductInfoAnchor &&
      ['general', 'variants', 'benefits', 'definition', 'availability', 'installation', 'maintenance'].includes(
        String(directFaqSubtype || ''),
      )
        ? directFaqSubtype
        : retrievalAwareFaqSubtype
    )
  const inheritedIntentKey =
    typeof interpretation?.followUp?.inheritedIntentKey === 'string'
      ? interpretation.followUp.inheritedIntentKey
      : null
  const preferOperationalPaymentFollowUp =
    faqSubtype === 'payment_methods' &&
    (previousIntentKey === 'customer.support_request' ||
      inheritedIntentKey === 'customer.support_request' ||
      Boolean(interpretation?.followUp?.detected))
  const preferOperationalScheduleFollowUp =
    faqSubtype === 'business_hours' &&
    (previousIntentKey === 'customer.schedule_request' ||
      inheritedIntentKey === 'customer.schedule_request' ||
      Boolean(interpretation?.scheduleContext))
  const evidence = selectCustomerFaqEvidence({
    input: detectionInput,
    retrievalItems,
    faqSubtype,
    intentKey,
    paymentMethods,
    tenantTopicTaxonomy,
    tenantRuntimePolicy,
    interpretation,
  })
  if (!evidence.length) {
    if (faqSubtype === 'location') {
      if (isLocationClarificationAnswer(input)) {
        return 'Todavía no tengo registrada la dirección exacta para compartir. ¿Querés que un asesor te la confirme?'
      }
      return '¿Buscas nuestra dirección o ciudad? Si me confirmas, te lo comparto.'
    }
    return null
  }

  return (
    buildTopicSpecificKnowledgeFallbackText(input, retrievalItems, {
      detectionInput,
      faqSubtype,
      evidence,
      intentKey,
      interpretation,
      tenantTopicTaxonomy,
      tenantRuntimePolicy,
      variationSeed,
      wordingOverrides,
    }) ||
    buildShapedCustomerFaqResponse({
      faqSubtype,
      evidence,
      intentKey,
      topicLabel:
        typeof interpretation?.topic?.label === 'string'
          ? interpretation.topic.label
          : null,
      tenantTopicTaxonomy,
      variationSeed,
      wordingOverrides,
      previousIntentKey,
      preferOperationalPaymentFollowUp,
      preferOperationalScheduleFollowUp,
      channel,
      channelProfile,
    })
  )
}

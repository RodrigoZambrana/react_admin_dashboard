import {
  detectCustomerFaqSubtype,
  extractCurrentCustomerTurnText,
  extractRequestedTopicLabel,
} from './customer-faq-heuristics.js'
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

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeText = (value) =>
  compactText(
    extractCurrentCustomerTurnText(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, ''),
  )

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

const calculateTopicOverlap = (left = [], right = []) => {
  if (!left.length || !right.length) {
    return 0
  }

  const target = new Set(right)
  return left.filter((token) => target.has(token)).length
}

const normalizeKnowledgeFallbackStatement = (statement) => {
  let next = compactText(statement)
  if (!next) {
    return ''
  }

  next = next
    .replace(/^dvh\s*[:\-]\s*/iu, 'El DVH es ')
    .replace(/^screen\s*[:\-]\s*/iu, 'Screen: ')
    .replace(/^blackout\s*[:\-]\s*/iu, 'Blackout: ')

  if (!/[.!?]$/u.test(next)) {
    next = `${next}.`
  }

  return next.charAt(0).toUpperCase() + next.slice(1)
}

const LOCATION_SIGNAL_REGEX =
  /\b(direccion|dirección|ubicacion|ubicación|local|showroom|sucursal|montevideo|uruguay|calle|av\.|avenida)\b/i

const LOCATION_STRONG_SIGNAL_REGEX =
  /\b(nos encontramos en|estamos en|direccion|dirección|ubicacion|ubicación|local comercial|no contamos con local comercial|atencion totalmente en linea|atención totalmente en línea|visitas? a domicilio|showroom|sucursal)\b/i

const LOCATION_CITY_ONLY_REGEX =
  /^(?:montevideo(?:,\s*uruguay)?|[a-z\s]+,\s*uruguay)[.!?]?$/i

const LOCATION_COMMERCIAL_CONTEXT_REGEX =
  /\b(venta e instalacion|venta e instalación|instalacion|instalación|fabricacion|fabricación|presupuesto|solicita|producto|productos|servicio|servicios|aberturas|cortinas|persianas|dvh)\b/i

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
    LOCATION_STRONG_SIGNAL_REGEX.test(normalized) ||
    LOCATION_CITY_ONLY_REGEX.test(compactText(text || ''))
  )
}

const isWeakCommercialLocationEvidence = (text) => {
  const normalized = normalizeText(text || '')
  if (!hasLocationSignals(normalized) || isStrongLocationEvidence(normalized)) {
    return false
  }
  return LOCATION_COMMERCIAL_CONTEXT_REGEX.test(normalized)
}

const isLocationClarificationAnswer = (text) =>
  /\b(direccion|dirección|ubicacion|ubicación|ciudad|local|showroom|sucursal)\b/i.test(
    normalizeText(text || ''),
  )

const hasExplicitPaymentTerms = (text) =>
  /\b(efectivo|transferencia|tarjeta|tarjetas|cuotas|financiacion|financiación|debito|débito|credito|crédito)\b/i.test(
    normalizeText(text || ''),
  )

export const DEFAULT_OPERATIONAL_PAYMENT_METHODS_INLINE =
  'efectivo, transferencia bancaria y tarjetas'

export const resolveOperationalPaymentMethodsInline = (input = '') => {
  const normalized = normalizeText(input)
  if (!normalized) {
    return DEFAULT_OPERATIONAL_PAYMENT_METHODS_INLINE
  }

  if (hasExplicitPaymentTerms(normalized)) {
    return DEFAULT_OPERATIONAL_PAYMENT_METHODS_INLINE
  }

  return DEFAULT_OPERATIONAL_PAYMENT_METHODS_INLINE
}

const looksLikePriceOrQuoteTurn = (text) =>
  looksLikeGenericPriceInquiry(normalizeText(text || ''))

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
  quoteContext = null,
}) => {
  const cleanReference = compactText(referenceLabel || '')
  const cleanFamily = compactText(familyLabel || '')
  const normalizedReference = normalizeText(cleanReference)
  const measurementLabel =
    quoteContext?.measurements?.confirmationLabel ||
    quoteContext?.measurements?.displayLabel ||
    null
  const subject =
    cleanFamily ||
    (cleanReference && !/\b(dvh|screen|blackout|probba|gala|summa)\b/.test(
      normalizedReference,
    )
      ? cleanReference
      : '')

  const lines = []
  if (measurementLabel) {
    if (subject) {
      lines.push(`Tomo una medida aproximada de ${measurementLabel} para ${subject}.`)
    } else {
      lines.push(`Tomo una medida aproximada de ${measurementLabel}.`)
    }
  } else if (subject) {
    lines.push(`Para cotizar ${subject}, decime las medidas aproximadas.`)
  } else {
    lines.push(
      'Para orientarte con una cotización, decime las medidas aproximadas.',
    )
  }

  if (variantLabels.length > 0) {
    lines.push(
      `${
        measurementLabel
          ? 'Para avanzar con la cotización, indicame también'
          : 'Si ya tenés definida la configuración, indicame también'
      } ${formatVariantList(
        variantLabels,
      )}.`,
    )
  } else {
    lines.push(
      measurementLabel
        ? 'Para avanzar con la cotización, también podés indicarme la opción o configuración que buscás.'
        : 'Si ya tenés definida la configuración, también podés indicármela.',
    )
  }

  return lines.join(' ')
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

  if (/^serie\s+/iu.test(requested) && familyHint) {
    return `${familyHint} linea ${requested.replace(/^serie\s+/iu, '')}`
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
    if (isWeakCommercialLocationEvidence(fragment)) {
      score -= 5
    }
    const normalizedTitle = normalizeText(item?.title || '')
    if (/\b(contacto|preguntas frecuentes|faq)\b/.test(normalizedTitle)) {
      score += 2
    }
  } else if (faqSubtype === 'payment_methods') {
    if (/\b(pago|pagos|tarjeta|transferencia|efectivo|cuotas|financiacion|financiación)\b/.test(normalizedFragment)) {
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

const selectCustomerFaqEvidence = ({ input, retrievalItems, faqSubtype }) => {
  const inputTokens = extractTopicTokens(input)
  const requestedTopicLabel = extractRequestedTopicLabel(input)
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
        text: normalizeKnowledgeFallbackStatement(fragment.text),
        score: scoreCustomerFaqEvidence({
          fragment: fragment.text,
          faqSubtype,
          inputTokens,
          requestedTopicTokens,
          item,
          sourceKind: fragment.sourceKind,
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
        !isWeakCommercialLocationEvidence(entry.text),
    )
    return locationCandidates.slice(0, 2)
  }

  if (faqSubtype === 'payment_methods') {
    const paymentCandidates = ordered.filter((entry) =>
      hasExplicitPaymentTerms(entry.text),
    )
    if (paymentCandidates.length) {
      return paymentCandidates.slice(0, 1)
    }
  }

  if (faqSubtype === 'benefits') {
    return ordered.slice(0, 2)
  }

  if (faqSubtype === 'variants') {
    return ordered.slice(0, 3)
  }

  return ordered.slice(0, 1)
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
    const normalizedFirst = normalizeText(firstEvidence)
    if (
      /^nos encontramos en\b/i.test(firstEvidence) ||
      /^estamos en\b/i.test(firstEvidence)
    ) {
      return firstEvidence
    }
    if (
      /\b(no contamos con local comercial|atencion totalmente en linea|atención totalmente en línea)\b/.test(
        normalizedFirst,
      )
    ) {
      const lines = [firstEvidence]
      if (
        secondEvidence &&
        /\b(visitas? a domicilio|relevamiento|asesoramiento)\b/.test(
          normalizeText(secondEvidence),
        )
      ) {
        lines.push(secondEvidence)
      }
      return lines.join(' ')
    }
    return `Estamos en ${toInlineBusinessAnswer(firstEvidence)}`
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
    detectCustomerFaqSubtype(detectionInput, { retrievalItems })
  if (
    faqSubtype === 'business_hours' ||
    faqSubtype === 'location' ||
    faqSubtype === 'payment_methods' ||
    faqSubtype === 'contact'
  ) {
    return null
  }
  const intentKey = typeof options?.intentKey === 'string' ? options.intentKey : null
  const evidenceTexts = Array.isArray(options?.evidence)
    ? options.evidence.map((entry) => entry?.text || '').filter(Boolean)
    : []
  const evidenceSourceText = evidenceTexts.join(' ')
  const interpretation =
    options?.interpretation && typeof options.interpretation === 'object'
      ? options.interpretation
      : null
  const tenantTopicTaxonomy = Array.isArray(options?.tenantTopicTaxonomy)
    ? options.tenantTopicTaxonomy
    : []
  const extractedRequestedTopicLabel = extractRequestedTopicLabel(detectionInput)
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
    looksLikeQuoteExpansionSignal(detectionInput) &&
    quoteContextTopicLabel &&
    (!extractedRequestedTopicLabel ||
      normalizeText(quoteContextTopicLabel).includes(
        normalizeText(extractedRequestedTopicLabel),
      ))
  const requestedTopicLabel =
    shouldPreferQuoteContextTopic
      ? quoteContextTopicLabel
      : extractedRequestedTopicLabel &&
          String(interpretation?.topic?.type || '') === 'product_family'
        ? extractedRequestedTopicLabel
        : interpretationTopicLabel || extractedRequestedTopicLabel
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
  const variationSeed = String(options?.variationSeed || '')
  const wordingOverrides = options?.wordingOverrides || null
  const channel = options?.channel || null
  const channelProfile = options?.channelProfile || null

  if (quoteRequirementsQuestion) {
    return buildQuoteGuidanceText({
      referenceLabel:
        resolvedTopicReference ||
        (isProductTopicType(interpretation?.contextTopic)
          ? interpretation.contextTopic.label
          : null),
      familyLabel: currentFamilyLabel,
      variantLabels: currentVariantLabels,
      quoteContext,
    })
  }

  if (intentKey === 'customer.quote' && priceReference) {
    const measurementLabel =
      quoteContext?.measurements?.displayLabel || quoteContext?.measurements?.confirmationLabel
    if (measurementLabel) {
      return `Para esa configuración y una medida aproximada de ${measurementLabel} podemos tomar como referencia una cotización de ${priceReference}. Si quieres, te ayudo a revisar vidrio, color o disponibilidad.`
    }
    return `Para esa configuración podemos tomar como referencia una cotización de ${priceReference}. Si quieres, te ayudo a revisar medidas, vidrio y disponibilidad.`
  }

  if (
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
      quoteContext,
    })}`
  }

  if (/\bdvh\b/.test(normalizedInput) && /\bdvh\b/.test(combinedSourceText)) {
    const contextualTopicSignal = normalizeText(
      [
        resolvedTopicReference,
        interpretation?.topic?.label,
        interpretation?.contextTopic?.label,
      ]
        .filter(Boolean)
        .join(' '),
    )
    if (/\b(abertur|aluminio|probba|gala|summa)\b/.test(contextualTopicSignal)) {
      const contextualEvidence = compactText(evidenceTexts[0] || '')
      const contextualReference =
        displayTopicLabel && /\bdvh\b/.test(normalizeText(displayTopicLabel))
          ? displayTopicLabel
          : 'aberturas con DVH'
      return `Sí, trabajamos con ${contextualReference}. ${
        contextualEvidence ||
        'Las aberturas con DVH mejoran aislamiento y se configuran según medidas y línea.'
      } Si quieres, te cuento opciones, líneas y prestaciones según lo que necesitas.`
    }

    const lines = [
      'Sí. El DVH es doble vidriado hermético y mejora aislamiento térmico y acústico.',
    ]
    if (/(probba|gala|summa)/.test(combinedSourceText)) {
      lines.push(
        'En Urucortinas se usa en líneas de mayor prestación como Probba, Gala y Summa.',
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
    (intentKey === 'customer.quote' || looksLikePriceOrQuoteTurn(input))
  ) {
    if (priceReference) {
      return `Para esa configuración podemos tomar como referencia una cotización de ${priceReference}. Si quieres, te ayudo a revisar medidas, vidrio y disponibilidad.`
    }

    const evidenceOverlap = calculateTopicOverlap(
      extractTopicTokens(resolvedTopicReference),
      extractTopicTokens(evidenceSourceText || combinedSourceText),
    )
    if (
      evidenceOverlap > 0 ||
      combinedSourceText.includes('probba') ||
      combinedSourceText.includes('aberturas')
    ) {
      const contextLabel =
        interpretation?.contextTopic?.label || interpretation?.topic?.label || ''
      const hasDvhContext =
        /\b(dvh|doble vidrio)\b/i.test(normalizeText(contextLabel)) &&
        !/\b(dvh|doble vidrio)\b/i.test(normalizedRequestedTopic)

      return `Sí, trabajamos con ${resolvedTopicReference}. Para orientarte con el costo, decime las medidas${hasDvhContext ? ' y si lo buscas con DVH' : ''}.`
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
      return pickWordingVariant({
        key: 'customer.faq.product_availability',
        variationSeed,
        overrides: wordingOverrides,
        channel,
        channelProfile,
        variables: { topic: displayTopicLabel },
        fallback: `Sí, contamos con ${displayTopicLabel}. Si quieres, te amplío beneficios, usos y opciones según lo que necesitas.`,
      })
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
      if (
        taxonomyTopicMatch?.kind === 'product_family' &&
        /\b(varios tipos|roller|blackout|venecianas|screen|opciones)\b/i.test(
          combinedSourceText,
        )
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
      const primaryEvidence = compactText(evidenceTexts[0] || '')
      if (taxonomyTopicMatch?.kind === 'product_variant' && primaryEvidence) {
        const resolvedLabel = /\broller\b/i.test(primaryEvidence)
          ? `roller ${displayTopicLabel}`
          : displayTopicLabel
        return pickWordingVariant({
          key: 'customer.faq.product_variant_with_evidence',
          variationSeed,
          overrides: wordingOverrides,
          channel,
          channelProfile,
          variables: {
            topic: resolvedLabel,
            evidence: primaryEvidence,
          },
          fallback: `Sí, también tenemos ${resolvedLabel}. ${primaryEvidence} Si quieres, te cuento cuál conviene más según luz, privacidad y uso.`,
        })
      }
      if (primaryEvidence) {
        return pickWordingVariant({
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
      }
      return pickWordingVariant({
        key: 'customer.faq.product_general',
        variationSeed,
        overrides: wordingOverrides,
        channel,
        channelProfile,
        variables: { topic: displayTopicLabel },
        fallback: `Sí, trabajamos con ${displayTopicLabel}. Si quieres, te cuento opciones, líneas y prestaciones según lo que necesitas.`,
      })
    }
  }

  return null
}

const extractKnowledgeFallbackStatements = (retrievalItems, options = {}) => {
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
          text: normalizeKnowledgeFallbackStatement(fragment),
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
  const statements = extractKnowledgeFallbackStatements(retrievalItems, {
    input,
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

  if (intentKey === 'customer.quote') {
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
  const faqSubtype = detectCustomerFaqSubtype(detectionInput, { retrievalItems })
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

import {
  looksLikeGenericPriceInquiry,
  looksLikePaymentOperationalUpdate,
  looksLikeQuoteRequirementsQuestion,
} from './customer-intent-patterns.js'
import { hasTenantTopicSignal } from './customer-topic-taxonomy.js'
import {
  detectStandaloneAttachmentArtifactKind,
  hasMultimodalPlaceholderSignal,
  hasQuantityOnlyFollowUpSignal,
  hasReengagementReferenceSignal,
  normalizeSemanticText,
} from './customer-semantic-signals.js'

export const extractCurrentCustomerTurnText = (value) =>
  String(value || '')
    .split(/\n+\s*Contexto conversacional reciente relevante:\s*/iu)[0]
    .replace(/<se edit[oó]\s+este\s+mensaje\.?>/giu, ' ')
    .replace(/<multimedia\s+omitido>/giu, ' ')
    .replace(/<imagen\s+omitida>/giu, ' ')
    .replace(/<audio\s+omitido>/giu, ' ')
    .replace(/<video\s+omitido>/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const extractSemanticCustomerTurnText = (value) => {
  const current = extractCurrentCustomerTurnText(value)
  if (!current) {
    return ''
  }

  if (
    hasMultimodalPlaceholderSignal(current) ||
    detectStandaloneAttachmentArtifactKind(current)
  ) {
    return ''
  }

  return current
}

export const stripPlaceholderOnlyCustomerTurnText = (value) => {
  return extractSemanticCustomerTurnText(value)
}

const normalizeText = (value) =>
  normalizeSemanticText(stripPlaceholderOnlyCustomerTurnText(value))

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const CUSTOMER_TOPIC_PATTERNS = [
  /\b(que es|duda sobre|consulta sobre|consulta por|consultar sobre|consultar por|como funciona|para que sirve|beneficios|ventajas|desventajas|diferencia entre|que diferencia hay|informacion sobre|info sobre|explicame|explicame sobre|contame sobre|quiero saber sobre|quiero consultar sobre|quiero consultar por|como se limpia|como limpian|mantenimiento de|como mantener)\b/,
  /\b(tienen|manejan|ofrecen|trabajan con|cuentan con)\b/,
]

const BUSINESS_FAQ_DEFINITIONS = [
  {
    subtype: 'business_hours',
    directPatterns: [
      /\b(horario|horarios|horario de atencion|horario de atención|cuando abren|cuando cierran)\b/,
      /\b(cual|cu[aá]l)\s+es\s+su\s+horario\b/,
      /\bcomo\b.*\batienden\b/,
    ],
    conceptStems: ['horari', 'atiend', 'abren', 'cierran', 'atencion'],
    queryStems: ['cual', 'cuando', 'como', 'hoy', 'manana'],
    knowledgeFactTypes: ['business_hours'],
    knowledgePageKinds: ['hours_page', 'contact_page', 'faq_page'],
    knowledgeTagStems: ['horari', 'business_hour'],
    knowledgeCueStems: ['horari', 'lunes', 'viernes', 'sabado', 'domingo'],
  },
  {
    subtype: 'location',
    directPatterns: [
      /\b(donde estan|donde están|de donde son|donde quedan|ubicacion|ubicación|direccion|dirección|local comercial|sucursal|showroom|ciudad)\b/,
      /\b(en\s+que\s+ciudad)\b/,
    ],
    conceptStems: [
      'ubic',
      'direccion',
      'local',
      'sucursal',
      'showroom',
      'ciudad',
      'montevideo',
      'donde',
      'quedan',
    ],
    queryStems: ['estan', 'son', 'encuentran', 'queda', 'quedan'],
    knowledgeFactTypes: ['location', 'local_commercial'],
    knowledgePageKinds: ['contact_page', 'faq_page'],
    knowledgeTagStems: ['location', 'local', 'contact'],
    knowledgeCueStems: [
      'nos encontramos',
      'estamos en',
      'montevideo',
      'local comercial',
      'visitas a domicilio',
    ],
  },
  {
    subtype: 'payment_methods',
    directPatterns: [
      /\b(medios de pago|medios de pagos|formas de pago|formas de pagos)\b/,
      /\b(aceptan|manejan|trabajan con)\s+(tarjeta|tarjetas|transferencia|efectivo|cuotas)\b/,
      /\b(como|cómo)\s+se\s+(paga|abona)\b/,
      /\b(se puede pagar|puedo pagar)\b/,
    ],
    conceptStems: [
      'pag',
      'abon',
      'tarjet',
      'transfer',
      'efectiv',
      'cuot',
      'financi',
      'debit',
      'credit',
    ],
    queryStems: ['acept', 'manej', 'trabaj', 'pued', 'medio', 'forma', 'como'],
    knowledgeFactTypes: ['payment_methods'],
    knowledgePageKinds: ['payments_page', 'faq_page'],
    knowledgeTagStems: ['payment', 'pag', 'tarjet', 'transfer'],
    knowledgeCueStems: ['efectivo', 'transferencia', 'tarjetas', 'cuotas', 'medios de pago'],
  },
  {
    subtype: 'contact',
    directPatterns: [
      /\b(telefono|teléfono|celular|whatsapp|numero de contacto|número de contacto|correo|mail|email|datos? de contacto)\b/,
      /\b(tienen|manejan)\s+(telefono|teléfono|whatsapp|mail|email)\b/,
      /\b(hablar con alguien|comunicarme|comunicarse|llamar)\b/,
    ],
    conceptStems: [
      'telefon',
      'celular',
      'whatsapp',
      'contact',
      'llamar',
      'comunic',
      'correo',
      'mail',
      'email',
      'numero',
    ],
    queryStems: ['tienen', 'manejan', 'puedo', 'como', 'hablar'],
    knowledgeFactTypes: ['contact_phone', 'contact_email'],
    knowledgePageKinds: ['contact_page', 'faq_page'],
    knowledgeTagStems: ['contact', 'phone', 'email', 'whatsapp'],
    knowledgeCueStems: ['whatsapp', 'telefono', 'email', '@'],
  },
]

const PAYMENT_METHOD_SHORT_FOLLOW_UP_PATTERNS = [
  /^(?:y\s+)?con\s+(transferencia|transferencia bancaria|efectivo|tarjeta|tarjetas|debito|d[eé]bito|credito|cr[eé]dito|cuotas?)\??$/iu,
  /^(?:y\s+)?(transferencia|transferencia bancaria|efectivo|tarjeta|tarjetas|debito|d[eé]bito|credito|cr[eé]dito|cuotas?)\??$/iu,
  /^(?:aceptan|manejan|trabajan con)\s+(transferencia|efectivo|tarjeta|tarjetas|debito|d[eé]bito|credito|cr[eé]dito|cuotas?)\??$/iu,
]

const PAYMENT_METHOD_CONTEXT_INTENTS = new Set([
  'customer.quote',
  'customer.price_inquiry',
  'customer.product_info',
  'customer.topic_info',
  'customer.schedule_request',
  'customer.support_request',
])

const looksLikeShortPaymentMethodFollowUp = (input, options = {}) => {
  const normalizedInput = normalizeText(input)
  if (!normalizedInput || looksLikePaymentOperationalUpdate(normalizedInput)) {
    return false
  }

  if (
    PAYMENT_METHOD_SHORT_FOLLOW_UP_PATTERNS.some((pattern) =>
      pattern.test(normalizedInput),
    )
  ) {
    return true
  }

  const previousIntentKey =
    typeof options?.previousIntentKey === 'string'
      ? options.previousIntentKey.trim()
      : ''

  if (!PAYMENT_METHOD_CONTEXT_INTENTS.has(previousIntentKey)) {
    return false
  }

  const inputTokens = tokenizeSignalText(normalizedInput)
  const paymentDefinition = BUSINESS_FAQ_DEFINITIONS.find(
    (definition) => definition.subtype === 'payment_methods',
  )
  if (!paymentDefinition) {
    return false
  }

  const conceptMatches = countStemMatches(
    inputTokens,
    paymentDefinition.conceptStems,
  )
  const shortQuestionLike =
    normalizedInput.length <= 48 &&
    (/^\s*y\b/.test(normalizedInput) ||
      /\?$/.test(String(input || '').trim()) ||
      /\bcon\b/.test(normalizedInput))

  return conceptMatches >= 1 && shortQuestionLike
}

const CUSTOMER_TRANSACTIONAL_PATTERNS = [
  /\b(stock|disponibilidad|pedido|orden|envio|entrega|comprar|quiero una|quiero uno|medida|medidas)\b/,
]

const COMMON_CUSTOMER_SIGNAL_TOKENS = new Set([
  'hola',
  'buenas',
  'buenos',
  'dias',
  'tardes',
  'noches',
  'necesito',
  'quiero',
  'consulta',
  'consultar',
  'informacion',
  'info',
  'ayuda',
  'horario',
  'ubicacion',
  'direccion',
  'telefono',
  'whatsapp',
  'contacto',
  'pago',
  'pagos',
  'transferencia',
  'tarjeta',
  'roller',
  'blackout',
  'screen',
  'persiana',
  'persianas',
  'cortina',
  'cortinas',
  'abertura',
  'aberturas',
  'dvh',
  'envio',
  'entrega',
  'precio',
  'cotizacion',
  'presupuesto',
])

const PRIVATE_ACCOUNT_FAQ_GUARD_PATTERNS = [
  /\b(mi direccion|direccion de entrega|domicilio de entrega)\b/u,
  /\b(mi factura|mis facturas|factura de mi pedido|facturas de mi cuenta)\b/u,
  /\b(mi correo|mi email|mail del sistema|correo del sistema|email del sistema)\b/u,
  /\b(mi cuenta|datos de cuenta|mis datos)\b/u,
]

const looksLikePrivateAccountFaqGuard = (input) => {
  const normalizedInput = normalizeText(input)
  if (!normalizedInput) {
    return false
  }

  return PRIVATE_ACCOUNT_FAQ_GUARD_PATTERNS.some((pattern) =>
    pattern.test(normalizedInput),
  )
}

const singularizeToken = (token) => {
  const value = String(token || '').trim()
  if (!value) {
    return ''
  }
  if (value.endsWith('es') && value.length > 4) {
    return value.slice(0, -2)
  }
  if (value.endsWith('s') && value.length > 3) {
    return value.slice(0, -1)
  }
  return value
}

const tokenizeSignalText = (value) =>
  normalizeText(value)
    .split(/\s+/u)
    .map((token) => singularizeToken(token))
    .filter(Boolean)

const hasStem = (tokens, stem) =>
  tokens.some((token) => token === stem || token.startsWith(stem))

const countStemMatches = (tokens, stems = []) =>
  stems.filter((stem) => hasStem(tokens, stem)).length

const normalizeKnowledgeItemMetadata = (item) => {
  const metadata =
    item?.metadata && typeof item.metadata === 'object' ? item.metadata : {}

  return {
    factType:
      typeof metadata.factType === 'string'
        ? normalizeText(metadata.factType)
        : null,
    pageKinds: Array.isArray(metadata.pageKinds)
      ? metadata.pageKinds
          .filter((entry) => typeof entry === 'string')
          .map((entry) => normalizeText(entry))
      : [],
  }
}

const scoreBusinessFaqDefinition = (definition, input, retrievalItems = []) => {
  const normalizedInput = normalizeText(input)
  const inputTokens = tokenizeSignalText(normalizedInput)
  let score = 0

  if (definition.directPatterns.some((pattern) => pattern.test(normalizedInput))) {
    score += 8
  }

  const conceptMatches = countStemMatches(inputTokens, definition.conceptStems)
  const queryMatches = countStemMatches(inputTokens, definition.queryStems)
  score += conceptMatches * 2 + Math.min(queryMatches, 2)

  if (definition.subtype === 'payment_methods') {
    if (conceptMatches > 0 && queryMatches > 0) {
      score += 3
    }
  } else if (definition.subtype === 'location') {
    if (hasStem(inputTokens, 'donde') && (hasStem(inputTokens, 'son') || hasStem(inputTokens, 'estan') || hasStem(inputTokens, 'quedan'))) {
      score += 4
    }
  } else if (definition.subtype === 'contact') {
    if (conceptMatches > 0 && queryMatches > 0) {
      score += 2
    }
  } else if (definition.subtype === 'business_hours') {
    if (conceptMatches > 0 && queryMatches > 0) {
      score += 2
    }
  }

  for (const item of Array.isArray(retrievalItems) ? retrievalItems.slice(0, 4) : []) {
    const { factType, pageKinds } = normalizeKnowledgeItemMetadata(item)
    const tags = Array.isArray(item?.tags)
      ? item.tags.map((tag) => normalizeText(tag))
      : []
    const combinedText = normalizeText(
      [item?.title, item?.summary, item?.snippet]
        .filter(Boolean)
        .join(' '),
    )

    if (factType && definition.knowledgeFactTypes.includes(factType)) {
      score += 12
    }
    if (pageKinds.some((pageKind) => definition.knowledgePageKinds.includes(pageKind))) {
      score += 4
    }
    if (
      tags.some((tag) =>
        definition.knowledgeTagStems.some((stem) => hasStem(tokenizeSignalText(tag), stem)),
      )
    ) {
      score += 2
    }
    if (
      definition.knowledgeCueStems.some((stem) =>
        combinedText.includes(stem),
      )
    ) {
      score += 1.5
    }
  }

  return score
}

const detectBusinessFaqSubtype = (input, options = {}) => {
  const retrievalItems = Array.isArray(options?.retrievalItems)
    ? options.retrievalItems
    : []

  if (looksLikeShortPaymentMethodFollowUp(input, options)) {
    return 'payment_methods'
  }

  let bestMatch = null
  for (const definition of BUSINESS_FAQ_DEFINITIONS) {
    const score = scoreBusinessFaqDefinition(definition, input, retrievalItems)
    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        subtype: definition.subtype,
        score,
      }
    }
  }

  return bestMatch && bestMatch.score >= 4 ? bestMatch.subtype : null
}

export const looksLikeCustomerTopicQuestion = (text, options = {}) => {
  const normalized = normalizeText(text)
  const requestedTopic = extractRequestedTopicLabel(normalized)
  const hasTopicSignals =
    Boolean(requestedTopic) || hasTenantTopicSignal(normalized, options?.tenantTopicTaxonomy)
  return (
    ((hasTopicSignals &&
      CUSTOMER_TOPIC_PATTERNS.some((pattern) => pattern.test(normalized))) ||
      Boolean(detectBusinessFaqSubtype(normalized))) &&
    !CUSTOMER_TRANSACTIONAL_PATTERNS.some((pattern) => pattern.test(normalized)) &&
    !looksLikeQuoteRequirementsQuestion(normalized) &&
    !looksLikeGenericPriceInquiry(normalized)
  )
}

export const looksLikeCustomerAvailabilityQuestion = (text) =>
  /\b(tienen|manejan|ofrecen|trabajan con|cuentan con)\b/i.test(
    extractCurrentCustomerTurnText(text),
  )

export const looksLikeCustomerVariantQuestion = (text) =>
  /\b((que|qué)\s+(tipos|opciones|variantes|lineas|líneas|modelos)\s+(tienen|hay|manejan)|cuales\s+(tienen|hay|manejan)|cu[aá]les\s+(tienen|hay|manejan)|((que|qué)\s+(versiones|formatos)\s+(tienen|hay))|(dime|decime|mostrame|mu[eé]strame|pasame)\s+(las\s+)?(opciones|variantes|tipos|modelos|versiones|formatos))\b/i.test(
    extractCurrentCustomerTurnText(text),
  )

export const looksLikeCustomerBusinessHoursQuestion = (text) =>
  detectBusinessFaqSubtype(text) === 'business_hours'

export const looksLikeCustomerLocationQuestion = (text) =>
  detectBusinessFaqSubtype(text) === 'location'

export const looksLikeCustomerPaymentMethodsQuestion = (text) =>
  detectBusinessFaqSubtype(text) === 'payment_methods'

export const looksLikeCustomerContactQuestion = (text) =>
  detectBusinessFaqSubtype(text) === 'contact'

export const looksLikeCustomerDefinitionQuestion = (text) =>
  /\b(que es|duda sobre|como funciona|para que sirve|explicame|explicame sobre|contame sobre|quiero saber sobre)\b/i.test(
    extractCurrentCustomerTurnText(text),
  )

export const looksLikeCustomerBenefitsQuestion = (text) =>
  /\b(beneficios|ventajas|desventajas|diferencia entre|que diferencia hay)\b/i.test(
    extractCurrentCustomerTurnText(text),
  )

export const looksLikeCustomerMaintenanceQuestion = (text) =>
  /\b(como se limpia|como limpian|mantenimiento de|como mantener)\b/i.test(
    extractCurrentCustomerTurnText(text),
  )

export const looksLikeCustomerGenericInfoRequest = (text) => {
  const normalized = normalizeText(text)
  if (!normalized) {
    return false
  }

  const hasGenericAsk =
    normalized.includes('inform') ||
    normalized.includes('consult') ||
    normalized.includes('ayud') ||
    normalized.includes('info')

  if (!hasGenericAsk) {
    return false
  }

  if (looksLikeCustomerTopicQuestion(normalized)) {
    return false
  }

  return !CUSTOMER_TRANSACTIONAL_PATTERNS.some((pattern) =>
    pattern.test(normalized),
  )
}

const looksLikeSuspiciousNoiseToken = (token) => {
  if (typeof token !== 'string' || token.length < 6) {
    return false
  }

  if (COMMON_CUSTOMER_SIGNAL_TOKENS.has(token)) {
    return false
  }

  const vowels = token.match(/[aeiou]/g) || []
  const consonants = token.match(/[bcdfghjklmnñpqrstvwxyz]/g) || []

  if (!consonants.length) {
    return false
  }

  return vowels.length === 0 || (vowels.length === 1 && consonants.length >= 7)
}

export const looksLikeCustomerUnintelligibleText = (text) => {
  const normalized = normalizeText(text)
  if (!normalized || normalized.length < 8) {
    return false
  }

  if (
    looksLikeCustomerTopicQuestion(normalized) ||
    looksLikeCustomerGenericInfoRequest(normalized)
  ) {
    return false
  }

  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)

  if (!tokens.length || tokens.some((token) => COMMON_CUSTOMER_SIGNAL_TOKENS.has(token))) {
    return false
  }

  const suspiciousTokens = tokens.filter(looksLikeSuspiciousNoiseToken)
  if (tokens.length === 1) {
    return suspiciousTokens.length === 1 && tokens[0].length >= 8
  }
  return (
    suspiciousTokens.length > 0 &&
    suspiciousTokens.length >= Math.ceil(tokens.length * 0.6)
  )
}

export const detectCustomerFaqSubtype = (input, options = {}) => {
  if (looksLikePrivateAccountFaqGuard(input)) {
    return null
  }

  const businessSubtype = detectBusinessFaqSubtype(input, options)
  if (businessSubtype) {
    return businessSubtype
  }
  if (looksLikeCustomerVariantQuestion(input)) {
    return 'variants'
  }
  if (looksLikeCustomerAvailabilityQuestion(input)) {
    return 'availability'
  }
  if (looksLikeCustomerMaintenanceQuestion(input)) {
    return 'maintenance'
  }
  if (looksLikeCustomerBenefitsQuestion(input)) {
    return 'benefits'
  }
  if (looksLikeCustomerDefinitionQuestion(input)) {
    return 'definition'
  }
  return 'general'
}

const stripTrailingTransactionalQuery = (value) =>
  compactText(
    String(value || '').replace(
      /\b(?:que|qué)\s+(?:costo|costos|precio|precios|valor|valores)\s+(?:tiene|tienen)\b.*$/iu,
      '',
    ),
  )

const isGenericRequestedTopicLabel = (value) =>
  /\b(eso|esto|mi caso|tu caso|el caso|este caso|ese caso|aplica|aplique|sirve|sirva|funciona|funcione|mismo|misma)\b/iu.test(
    compactText(value || ''),
  )

const normalizeRequestedTopicLabel = (value) =>
  compactText(
    stripTrailingTransactionalQuery(
      String(value || '')
        .replace(
          /^(?:quiero\s+saber\s+si\s+tienen|quisiera\s+saber\s+si\s+tienen|saber\s+si\s+tienen|si\s+tienen|quiero\s+consultar\s+por|quiero\s+consultar\s+sobre|consultar\s+por|consultar\s+sobre|consulta\s+por|consulta\s+sobre|quiero\s+saber\s+sobre|quiero\s+saber\s+de|necesito\s+saber\s+sobre|me\s+gustaria\s+saber\s+sobre|me\s+gustaría\s+saber\s+sobre)\s+/iu,
          '',
        )
        .replace(
          /^(?:precio|precios|presupuesto|presupuestos|cotizacion|cotización|cotizaciones|costo|costos|valor|valores|importe|importes|monto|montos)\s+/iu,
          '',
        )
        .replace(
          /^(?:tengo\s+que\s+(?:pasarte|mandarte|sumarte|agregarte)|te\s+(?:paso|mando|sumo|agrego)|(?:pasarte|mandarte|sumarte|agregarte))\s+(?:un|una|otro|otra)\s+/iu,
          '',
        )
        .replace(/^(?:(?:si|sí|y|las|los|la|el)\s+){1,4}/iu, '')
        .replace(/^(de|del|la|las|el|los)\s+/iu, '')
        .replace(/\s+(?:mas|más)$/iu, ''),
    ),
  )

export const extractRequestedTopicLabel = (input) => {
  const currentInput = extractCurrentCustomerTurnText(input)
  const semanticInput = extractSemanticCustomerTurnText(input)
  if (
    !semanticInput ||
    hasQuantityOnlyFollowUpSignal(semanticInput) ||
    hasReengagementReferenceSignal(currentInput) ||
    looksLikeQuoteRequirementsQuestion(semanticInput) ||
    looksLikePaymentOperationalUpdate(semanticInput)
  ) {
    return null
  }

  const patterns = [
    /\b(?:que|qué)\s+(medios de pago|medios de pagos|formas de pago|formas de pagos)\s+aceptan\b/iu,
    /\b(?:que|qué)\s+(telefono|teléfono|whatsapp|numero de contacto|número de contacto)\s+(tienen|manejan)\b/iu,
    /\b(?:quiero saber si tienen|quisiera saber si tienen)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
    /\b(?:quiero consultar por|quiero consultar sobre|consultar por|consultar sobre|consulta por|consulta sobre)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
    /\b(?:estoy buscando|ando buscando|busco)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
    /\b(?:quiero saber sobre|quiero saber de|necesito saber sobre|me gustaria saber sobre|me gustaría saber sobre)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
    /\b(?:quiero|necesito)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
    /\b(?:quiero ver|quiero conocer|me interesa|me interesan|me interesan las|me interesan los)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
    /\b(?:tienen|manejan|ofrecen|trabajan con|cuentan con)\s+(.+?)(?=$|\?|,|\.| pero | y )/iu,
  ]

  for (const pattern of patterns) {
    const match = semanticInput.match(pattern)
    if (match?.[1]) {
      const candidate = normalizeRequestedTopicLabel(match[1])
      if (candidate && !isGenericRequestedTopicLabel(candidate)) {
        return candidate
      }
    }
  }

  const shortFollowUpMatch = semanticInput.match(
    /^(?:y\s+)?([a-záéíóúñ0-9][a-záéíóúñ0-9\s-]{1,48})\??$/iu,
  )
  if (shortFollowUpMatch?.[1]) {
    const candidate = normalizeRequestedTopicLabel(shortFollowUpMatch[1])
    if (
      candidate &&
      !isGenericRequestedTopicLabel(candidate) &&
      !/\b(info|informacion|consulta|consultar|ayuda|algo|eso|esto|mismo|estoy|buscando|busco|necesito|quiero|me interesa|me interesan|que tipos tienen|qué tipos tienen|que opciones tienen|qué opciones tienen|que variantes tienen|qué variantes tienen|cuales tienen|cuáles tienen|que tipos hay|qué tipos hay|que opciones hay|qué opciones hay|que variantes hay|qué variantes hay|que datos necesitas para cotizar|qué datos necesitas para cotizar|que informacion necesitas para cotizar|qué información necesitas para cotizar|que medidas necesitas para cotizar|qué medidas necesitas para cotizar|(?:dime|decime|mostrame|mu[eé]strame|pasame)\s+(?:las\s+)?(?:opciones|variantes|tipos|modelos|versiones|formatos))\b/iu.test(
        candidate,
      )
    ) {
      return candidate
    }
  }

  return null
}

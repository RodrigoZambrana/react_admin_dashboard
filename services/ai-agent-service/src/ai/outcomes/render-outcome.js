import {
  looksLikeQuoteRequirementsQuestion,
  looksLikeQuoteWaitingFollowUp,
} from '../intents/customer-intent-patterns.js'
import {
  formatQuoteResolutionAmount,
  formatQuoteResolutionArea,
} from '../intents/customer-quote-resolution.js'
import { extractTenantFamilyLabel } from '../intents/customer-topic-taxonomy.js'
import { pickWordingVariant } from './wording-registry.js'

const normalizeLightInput = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const trimTrailingSentencePunctuation = (value) =>
  compactText(String(value || '').replace(/[,\s.;:]+$/g, ''))

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

  if (/^(necesito|preciso)\b/.test(normalized)) {
    return 'Claro. ¿Qué necesitas exactamente?'
  }

  if (/^(quiero|quisiera|me interesa|busco)\b/.test(normalized)) {
    return 'Claro. ¿Qué te gustaría consultar?'
  }

  return 'Claro. ¿Podrías darme un poco más de detalle para ayudarte mejor?'
}

const resolveQuoteSubjectLabel = (interpretation = null, tenantTopicTaxonomy = []) => {
  const currentTopicType = String(interpretation?.topic?.type || '')
  const currentTopic =
    interpretation?.topic &&
    ['product_family', 'product_topic', 'product_variant'].includes(currentTopicType)
      ? interpretation.topic.label
      : null
  const currentContextTopic =
    interpretation?.contextTopic &&
    ['product_family', 'product_topic', 'product_variant'].includes(
      String(interpretation.contextTopic.type || ''),
    )
      ? interpretation.contextTopic.label
      : null
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

  if (
    currentTopic &&
    currentTopicType === 'product_variant' &&
    familyLabel &&
    !normalizeLightInput(currentTopic).includes(normalizeLightInput(familyLabel))
  ) {
    return `${familyLabel} ${currentTopic}`.replace(/\s+/g, ' ').trim()
  }

  return (
    currentTopic ||
    interpretation?.quoteContext?.topicLabel ||
    familyLabel ||
    currentContextTopic ||
    interpretation?.quoteContext?.familyLabel ||
    null
  )
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

const buildQuoteProgressText = ({
  mode = 'quote',
  currentTurnText = '',
  subjectLabel = null,
  quoteContext = null,
  variationSeed = '',
  wordingOverrides = null,
}) => {
  const measurementLabel =
    quoteContext?.measurements?.confirmationLabel ||
    quoteContext?.measurements?.displayLabel ||
    null
  const topicRecognized = quoteContext?.topicRecognized !== false
  const profileResolved = quoteContext?.profileResolved !== false
  const cleanSubject = String(subjectLabel || '').trim()
  const decoratedSubject = buildDecoratedQuoteSubject(cleanSubject, quoteContext)
  const missingAttributes = Array.isArray(quoteContext?.missingAttributes)
    ? quoteContext.missingAttributes.filter((entry) => entry && typeof entry === 'object')
    : Array.isArray(quoteContext?.requiredAttributes)
      ? quoteContext.requiredAttributes.filter(
          (entry) =>
            entry &&
            typeof entry === 'object' &&
            Array.isArray(quoteContext?.missingFields) &&
            quoteContext.missingFields.includes(entry.key),
        )
      : []
  const missingLabel = formatQuoteMissingFields(missingAttributes)
  const mentionedTopics = Array.isArray(quoteContext?.mentionedTopics)
    ? quoteContext.mentionedTopics
        .map((entry) => String(entry?.label || '').trim())
        .filter(Boolean)
    : []
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
    return pickWordingVariant({
      key: 'customer.quote.handoff_ready',
      variationSeed,
      overrides: wordingOverrides,
      fallback:
        'Gracias por la información enviada. Le enviamos la cotización a la brevedad. Si hace falta algún dato adicional, un asesor del equipo se comunica para continuar.',
    })
  }

  if (
    quoteContext?.completionStatus === 'ready_for_pricing_or_handoff' &&
    !missingLabel
  ) {
    return null
  }

  if (!topicRecognized) {
    if (measurementLabel) {
      return `Perfecto. Tomo una medida aproximada de ${measurementLabel}. Para avanzar con la cotización, decime también qué producto o solución buscás.`
    }

    return mode === 'price'
      ? 'Claro. Para orientarte con el precio, decime primero qué producto o solución buscás.'
      : 'Claro. Para prepararte un presupuesto, decime primero qué producto o solución buscás.'
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

    if (measurementLabel && hasQuantity) {
      return decoratedSubject
        ? `Perfecto. Ya tengo una base para la cotización de ${decoratedSubject}. Si el caso requiere validación adicional, un asesor continúa con el siguiente paso.`
        : 'Perfecto. Ya tengo una base para la cotización. Si el caso requiere validación adicional, un asesor continúa con el siguiente paso.'
    }

    if (decoratedSubject && genericMissingLabel) {
      return `Claro. Para tomar la solicitud de cotización de ${decoratedSubject}, decime ${genericMissingLabel}.`
    }

    if (genericMissingLabel) {
      return `Claro. Para tomar la solicitud de cotización, decime ${genericMissingLabel}.`
    }
  }

  if (measurementLabel) {
    const intro = decoratedSubject
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
    quoteContext,
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
  const tenantTopicTaxonomy = Array.isArray(options?.tenantTopicTaxonomy)
    ? options.tenantTopicTaxonomy
    : []
  const quoteContext =
    interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
      ? interpretation.quoteContext
      : null
  const quoteProgressText = buildQuoteProgressText({
    mode: 'quote',
    currentTurnText: input,
    subjectLabel: resolveQuoteSubjectLabel(interpretation, tenantTopicTaxonomy),
    quoteContext,
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
    return 'Claro. Para prepararte un presupuesto, decime qué producto o servicio te interesa y, si aplica, las medidas aproximadas.'
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
  const quoteContext =
    interpretation?.quoteContext && typeof interpretation.quoteContext === 'object'
      ? interpretation.quoteContext
      : null
  const baseSubject =
    compactText(resolution.subjectLabel || '') ||
    resolveQuoteSubjectLabel(interpretation, Array.isArray(options?.tenantTopicTaxonomy) ? options.tenantTopicTaxonomy : []) ||
    'la configuración solicitada'
  const exactProductLabel = compactText(resolution?.productMatch?.name || '')
  const resolvedSubjectBase =
    resolution?.strategy === 'immediate_unit_price' && exactProductLabel
      ? exactProductLabel
      : baseSubject
  const decoratedSubject =
    buildDecoratedQuoteSubject(resolvedSubjectBase, quoteContext) || resolvedSubjectBase
  const quantity =
    typeof resolution.quantity === 'number' && Number.isFinite(resolution.quantity)
      ? resolution.quantity
      : null
  const totalAmount = formatQuoteResolutionAmount(
    resolution.currency,
    resolution.totalAmount,
  )
  const readyHandoffClose = pickWordingVariant({
    key: 'customer.quote.handoff_ready',
    variationSeed,
    overrides: options?.wordingOverrides,
    fallback:
      'Gracias por la información enviada. Le enviamos la cotización a la brevedad. Si hace falta algún dato adicional, un asesor del equipo se comunica para continuar.',
  })

  if (resolution.status === 'product_not_found') {
    if (resolution.productNotFoundSubtype === 'catalog_match_ambiguous') {
      return `Tengo una coincidencia parcial para ${decoratedSubject}, pero necesito que me confirmes cuál opción querés cotizar para no mezclar productos. Si querés, te ayudo a dejarlo encaminado y lo revisa un asesor.`
    }
    if (resolution.productNotFoundSubtype === 'catalog_present_but_strategy_unavailable') {
      return `Ya tengo los datos necesarios para la cotización de ${decoratedSubject}. En este momento no encuentro una configuración publicada con precio inmediato para resolverla automáticamente. ${readyHandoffClose}`.trim()
    }
    if (resolution.productNotFoundSubtype === 'catalog_present_without_immediate_price') {
      return `Ya tengo los datos necesarios para la cotización de ${decoratedSubject}. Existe una opción en catálogo, pero no tiene un precio inmediato publicado para responderte en el momento. ${readyHandoffClose}`.trim()
    }
    if (resolution.productNotFoundSubtype === 'catalog_missing_but_known_in_knowledge') {
      return `Puedo orientarte con información general disponible sobre ${decoratedSubject}, pero ahora no tengo una configuración publicada con precio inmediato. ${readyHandoffClose}`.trim()
    }
    return `Ya tengo los datos necesarios para la cotización de ${decoratedSubject}. En este momento no encuentro una opción publicada con precio inmediato para esa configuración. ${readyHandoffClose}`.trim()
  }

  if (resolution.status === 'needs_handoff') {
    if (resolution.detail === 'immediate_preview_unavailable') {
      return `Ya tengo los datos necesarios para la cotización de ${decoratedSubject}. Como no hay una resolución automática confiable para calcularla en este momento, ${readyHandoffClose.charAt(0).toLowerCase()}${readyHandoffClose.slice(1)}`.trim()
    }
    if (resolution.detail === 'external_parametric_quote_required') {
      return `Ya tengo los datos necesarios para la cotización de ${decoratedSubject}. Como esta configuración requiere revisión y cotización externa, ${readyHandoffClose.charAt(0).toLowerCase()}${readyHandoffClose.slice(1)}`.trim()
    }
    return readyHandoffClose
  }

  if (resolution.status !== 'resolved' || !totalAmount) {
    return null
  }

  if (resolution.strategy === 'immediate_unit_price') {
    if (quantity && quantity > 1) {
      return `Perfecto. Para ${quantity} unidades de ${decoratedSubject}, el precio estimado es ${totalAmount}.`
    }
    return `Perfecto. Para ${decoratedSubject}, el precio estimado es ${totalAmount}.`
  }

  if (resolution.strategy === 'immediate_square_meter') {
    const totalArea =
      typeof resolution.totalAreaM2 === 'number' && Number.isFinite(resolution.totalAreaM2)
        ? formatQuoteResolutionArea(resolution.totalAreaM2)
        : null
    const firstMeasurement =
      compactText(resolution.measurementLabel || '') ||
      compactText(resolution.items?.[0]?.displayLabel || '')

    if (Array.isArray(resolution.items) && resolution.items.length > 1) {
      const quantityLabel =
        quantity && quantity > 1 ? `${quantity} unidades de ` : ''
      const areaSuffix =
        totalArea
          ? ` El cálculo toma ${totalArea} m² en total.`
          : ''
      return `Perfecto. Para ${quantityLabel}${decoratedSubject} con las medidas indicadas, el precio estimado es ${totalAmount}.${areaSuffix}`.trim()
    }

    if (quantity && quantity > 1 && firstMeasurement) {
      const areaSuffix =
        totalArea
          ? ` El cálculo toma ${totalArea} m² en total.`
          : ''
      return `Perfecto. Para ${quantity} unidades de ${decoratedSubject} de ${firstMeasurement}, el precio estimado es ${totalAmount}.${areaSuffix}`.trim()
    }

    if (firstMeasurement) {
      const areaSuffix =
        totalArea
          ? ` El cálculo toma ${totalArea} m² en total.`
          : ''
      return `Perfecto. Para ${decoratedSubject} de ${firstMeasurement}, el precio estimado es ${totalAmount}.${areaSuffix}`.trim()
    }

    return `Perfecto. Para ${decoratedSubject}, el precio estimado es ${totalAmount}.`
  }

  if (resolution.strategy === 'parametric_exact_or_handoff') {
    if (Array.isArray(resolution.items) && resolution.items.length > 1) {
      return `Perfecto. Encontré una cotización lista para ${decoratedSubject} con las medidas indicadas. El total estimado es ${totalAmount}.`
    }
    if (quantity && quantity > 1) {
      return `Perfecto. Encontré una cotización lista para ${quantity} unidades de ${decoratedSubject}. El total estimado es ${totalAmount}.`
    }
    return `Perfecto. Encontré una cotización lista para ${decoratedSubject}. El precio estimado es ${totalAmount}.`
  }

  return null
}

export const buildCustomerSupportRequestText = (input, options = {}) => {
  const normalized = normalizeLightInput(input)

  if (/\b(mover|acortar|ajustar|cambiar de ventana)\b/.test(normalized)) {
    return 'Claro. Si necesitas mover, acortar o ajustar una instalación existente, cuéntanos qué producto es y coordinamos cómo seguir.'
  }

  if (/\b(dejo de funcionar|dejó de funcionar|no funciona|no anda)\b/.test(normalized)) {
    return 'Claro. Si se trata de un producto ya instalado, cuéntanos qué dejó de funcionar y coordinamos la revisión.'
  }

  return pickWordingVariant({
    key: 'customer.support.followup',
    variationSeed: String(options?.variationSeed || ''),
    overrides: options?.wordingOverrides || null,
    fallback:
      'Claro. Si necesitas service o una revisión, cuéntanos qué producto es y qué hay que ajustar, y coordinamos cómo seguir.',
  })
}

export const buildCustomerScheduleRequestText = (input) => {
  const normalized = normalizeLightInput(input)

  if (/\b(instalacion|instalación|colocacion|colocación)\b/.test(normalized)) {
    return 'Claro. Para coordinar la instalación, decime la zona o dirección y qué día u horario te queda mejor.'
  }

  return 'Claro. Podemos coordinar una visita. Decime la zona o dirección y qué día u horario te queda mejor.'
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

  if (typeof scheduleContext?.address === 'string' && scheduleContext.address.trim()) {
    parts.push(trimTrailingSentencePunctuation(scheduleContext.address))
  }

  return parts
}

export const buildCustomerScheduleProgressText = (
  scheduleContext = null,
  options = {},
) => {
  const variationSeed = String(options?.variationSeed || '')
  const wordingOverrides = options?.wordingOverrides || null
  const missingFields = Array.isArray(scheduleContext?.missingFields)
    ? scheduleContext.missingFields
    : []
  const knownParts = formatScheduleKnownParts(scheduleContext)
  const reason =
    formatScheduleReasonForSentence(scheduleContext?.reason || 'la visita técnica')

  if (!missingFields.length) {
    return pickWordingVariant({
      key: 'customer.schedule.progress.ready',
      variationSeed,
      overrides: wordingOverrides,
      variables: { reason },
      fallback: `Perfecto. Ya tengo lo necesario para coordinar ${reason}. Estoy validando la disponibilidad y te confirmo el agendamiento.`,
    })
  }

  if (missingFields.length === 1) {
    switch (missingFields[0]) {
      case 'day':
        return pickWordingVariant({
          key: 'customer.schedule.progress.ask_day',
          variationSeed,
          overrides: wordingOverrides,
          variables: { reason },
          fallback: `Perfecto. Para coordinar ${reason}, decime qué día te queda bien.`,
        })
      case 'time':
        return pickWordingVariant({
          key: 'customer.schedule.progress.ask_time',
          variationSeed,
          overrides: wordingOverrides,
          variables: { reason },
          fallback: `Perfecto. Para coordinar ${reason}, decime un horario concreto que te sirva.`,
        })
      case 'address':
        return pickWordingVariant({
          key: 'customer.schedule.progress.ask_address',
          variationSeed,
          overrides: wordingOverrides,
          variables: { reason },
          fallback: `Perfecto. Para coordinar ${reason}, pasame la dirección donde habría que ir.`,
        })
      case 'contact':
        return pickWordingVariant({
          key: 'customer.schedule.progress.ask_contact',
          variationSeed,
          overrides: wordingOverrides,
          variables: { reason },
          fallback: `Perfecto. Para coordinar ${reason}, pasame un teléfono o email de contacto.`,
        })
      default:
        break
    }
  }

  const missingLabels = missingFields
    .map((field) =>
      field === 'day'
        ? 'el día'
        : field === 'time'
          ? 'el horario'
          : field === 'address'
            ? 'la dirección'
            : field === 'contact'
              ? 'un teléfono o email de contacto'
              : null,
    )
    .filter(Boolean)
  const missingText =
    missingLabels.length === 2
      ? `${missingLabels[0]} y ${missingLabels[1]}`
      : `${missingLabels.slice(0, -1).join(', ')} y ${missingLabels.at(-1)}`
  const knownText = knownParts.length
    ? ` Por ahora tomo ${knownParts.join(' · ')}.`
    : ''
  return `Perfecto. Para coordinar ${reason}, necesito ${missingText}.${knownText}`
}

export const buildCustomerScheduleCreatedText = ({
  scheduleContext = null,
  appointment = null,
}, options = {}) => {
  const variationSeed = String(options?.variationSeed || '')
  const knownParts = formatScheduleKnownParts(scheduleContext)
  const timeText = knownParts.length ? knownParts.join(' · ') : 'el horario solicitado'
  return pickWordingVariant({
    key: 'customer.schedule.created',
    variationSeed,
    overrides: options?.wordingOverrides,
    variables: { timeText },
    fallback: `Perfecto. Ya dejé agendada la visita técnica para ${timeText}.`,
  })
}

export const buildCustomerScheduleUnavailableText = ({
  scheduleContext = null,
}, options = {}) => {
  const variationSeed = String(options?.variationSeed || '')
  const knownParts = formatScheduleKnownParts(scheduleContext)
  const scheduleText = knownParts.length ? knownParts.join(' · ') : 'ese horario'
  return pickWordingVariant({
    key: 'customer.schedule.unavailable',
    variationSeed,
    overrides: options?.wordingOverrides,
    variables: { scheduleText },
    fallback: `En ese momento ya no tengo disponibilidad para ${scheduleText}. Si querés, pasame otra opción de día u horario y lo reviso.`,
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

export const buildCustomerMaterialFollowUpText = ({
  subject = 'esa opción',
  variationSeed = '',
  wordingOverrides = null,
} = {}) =>
  pickWordingVariant({
    key: 'customer.fallback.material_followup',
    variationSeed,
    overrides: wordingOverrides,
    variables: { subject },
    fallback: `Puedo dejar en seguimiento tu pedido para que un asesor te comparta fotos o material de referencia sobre ${subject} por este mismo canal.`,
  })

export const buildCustomerInformationThenHandoffText = ({
  subject = 'esa opción',
  variationSeed = '',
  wordingOverrides = null,
} = {}) =>
  pickWordingVariant({
    key: 'customer.fallback.information_then_handoff',
    variationSeed,
    overrides: wordingOverrides,
    variables: { subject },
    fallback: `Puedo orientarte con la información general disponible sobre ${subject}. Si querés, además dejo la consulta en seguimiento para que un asesor la amplíe por este canal.`,
  })

export const buildCustomerQuoteHandoffText = ({
  subject = 'la configuración solicitada',
  variationSeed = '',
  wordingOverrides = null,
} = {}) =>
  pickWordingVariant({
    key: 'customer.fallback.quote_handoff',
    variationSeed,
    overrides: wordingOverrides,
    variables: { subject },
    fallback: `Ya tengo la información necesaria de ${subject}. Dejo la solicitud en seguimiento para que un asesor la revise y te responda a la brevedad.`,
  })

export const buildCustomerQuoteWaitingFollowUpText = ({
  variationSeed = '',
  wordingOverrides = null,
} = {}) =>
  pickWordingVariant({
    key: 'customer.quote.waiting_followup',
    variationSeed,
    overrides: wordingOverrides,
    fallback:
      'Perfecto. Quedó en seguimiento. Si hace falta algún dato adicional, te lo piden por aquí.',
  })

export const buildCustomerCapabilityHandoffText = ({
  capability = 'content',
  variationSeed = '',
  wordingOverrides = null,
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
    fallback,
  })
}

export const buildCustomerConfirmationText = () =>
  'Perfecto. Continuamos con eso.'

export const buildCustomerCancellationText = () =>
  'Entendido. Dejamos eso sin efecto. Si quieres, dime cómo seguimos.'

export const buildCustomerMultiIntentText = (classification = null) => {
  const focusAreas = Array.isArray(classification?.focusAreas)
    ? classification.focusAreas.filter((entry) => entry?.key && entry?.label)
    : []

  if (
    focusAreas.some((entry) => entry.key === 'contact') &&
    focusAreas.some((entry) => entry.key === 'general_help')
  ) {
    return 'Hola. Claro, cuéntanos tu consulta. Si prefieres, también podemos dejarte los datos de contacto o derivarlo con un asesor.'
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
  variationSeed = '',
  wordingOverrides = null,
}) => {
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
      })
    case 'customer.quote':
      return buildCustomerQuoteRequestText(input, {
        interpretation,
        tenantTopicTaxonomy,
        variationSeed,
        wordingOverrides,
      })
    case 'customer.support_request':
      return buildCustomerSupportRequestText(input, {
        variationSeed,
        wordingOverrides,
      })
    case 'customer.schedule_request':
      return interpretation?.scheduleContext
        ? buildCustomerScheduleProgressText(interpretation.scheduleContext, {
            variationSeed,
            wordingOverrides,
          })
        : buildCustomerScheduleRequestText(input)
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
    case 'customer.multi_intent':
      return buildCustomerMultiIntentText(inboundClassification)
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
        : 'Esa acción no está habilitada para tu alcance conversacional actual. Si corresponde, continúa por el circuito operativo interno adecuado.'
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

import {
  buildMissingQuoteGuidanceLabels,
} from '../intents/customer-faq-response.js'
import { pickWordingVariant } from '../outcomes/wording-registry.js'
import { looksLikeClosureContinuationResponse } from './closure-signals.js'

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

// Transitional safety net only. Wording keys remain the source of truth.
const TRANSITIONAL_FALLBACKS = Object.freeze({
  closureContinuationOpen: 'Perfecto. Cuando quieras retomarlo, seguimos por aca.',
  closureContinuationAck: 'Dale, cualquier cosa me escribis.',
  searchNoMatch:
    'No encontre un producto publicado que coincida exactamente con esa configuracion. Un asesor del equipo te indicara como continuar y te ayudara a confirmar alternativas, medidas y disponibilidad.',
  searchMatchFound:
    'Encontre una coincidencia publicada para tu consulta: {productName}.',
  searchPriceAvailable: 'Precio de referencia: {currency} {amount}.',
  searchPriceMissing:
    'En este momento no pude confirmar el precio exacto, pero un asesor puede ayudarte a validarlo.',
  searchQuoteNextStepDefault:
    'Si queres, te ayudo a revisar la configuracion pendiente o la disponibilidad.',
  searchQuoteNextStepPending:
    'Si queres, te ayudo a revisar {pendingLabels} o la disponibilidad.',
  searchProductNextStep:
    'Si necesitas mas detalle o una cotizacion, un asesor puede continuar contigo y ayudarte con el siguiente paso.',
})

const renderWording = ({
  wordingKey,
  variationSeed = '',
  variables = {},
  fallback = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
} = {}) =>
  pickWordingVariant({
    key: wordingKey,
    variationSeed,
    variables,
    fallback,
    overrides: wordingOverrides,
    channel,
    channelProfile,
  })

const resolveCatalogMatchAmount = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? String(value) : null

const formatInlineList = (values = []) => {
  const items = Array.isArray(values)
    ? values
        .filter((entry) => typeof entry === 'string')
        .map((entry) => compactText(entry))
        .filter(Boolean)
    : []
  if (items.length <= 1) {
    return items[0] || ''
  }
  if (items.length === 2) {
    return `${items[0]} y ${items[1]}`
  }

  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

export const resolveClosureContinuationShape = ({
  previousAgentText = '',
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
} = {}) => {
  const wordingKey = looksLikeClosureContinuationResponse(previousAgentText)
    ? 'customer.closure.continuation_ack'
    : 'customer.closure.continuation_open'
  const fallback =
    wordingKey === 'customer.closure.continuation_ack'
      ? TRANSITIONAL_FALLBACKS.closureContinuationAck
      : TRANSITIONAL_FALLBACKS.closureContinuationOpen

  return {
    wordingKey,
    variables: {},
    contract: {
      responseKind: 'closure_continuation',
      keepsChannelOpen: true,
    },
    text: renderWording({
      wordingKey,
      variationSeed,
      fallback,
      wordingOverrides,
      channel,
      channelProfile,
    }),
  }
}

export const buildClosureContinuationReply = (options = {}) =>
  resolveClosureContinuationShape(options)

const resolveQuoteNextStepSegment = ({
  quoteContext = null,
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
} = {}) => {
  const pendingLabels = formatInlineList(buildMissingQuoteGuidanceLabels(quoteContext))
  const wordingKey = pendingLabels
    ? 'customer.search_fallback.quote_next_step_pending'
    : 'customer.search_fallback.quote_next_step_default'

  return {
    wordingKey,
    variables: pendingLabels ? { pendingLabels } : {},
    text: renderWording({
      wordingKey,
      variationSeed,
      variables: pendingLabels ? { pendingLabels } : {},
      fallback: pendingLabels
        ? TRANSITIONAL_FALLBACKS.searchQuoteNextStepPending
        : TRANSITIONAL_FALLBACKS.searchQuoteNextStepDefault,
      wordingOverrides,
      channel,
      channelProfile,
    }),
  }
}

export const resolveCustomerSearchFallbackShape = ({
  firstMatch = null,
  intentKey = null,
  quoteContext = null,
  variationSeed = '',
  wordingOverrides = null,
  channel = null,
  channelProfile = null,
} = {}) => {
  if (!firstMatch || typeof firstMatch !== 'object') {
    const wordingKey = 'customer.search_fallback.no_match'
    return {
      wordingKey,
      segmentKeys: [wordingKey],
      needsHuman: true,
      referenceTitle: null,
      contract: {
        responseKind: 'published_search_no_match',
        keepsLane: intentKey === 'customer.quote' ? 'quote' : 'product_info',
        nextStep: 'human_followup',
      },
      text: renderWording({
        wordingKey,
        variationSeed,
        fallback: TRANSITIONAL_FALLBACKS.searchNoMatch,
        wordingOverrides,
        channel,
        channelProfile,
      }),
    }
  }

  const productName = compactText(firstMatch.name || 'el producto consultado')
  const currency =
    typeof firstMatch.currency === 'string' && firstMatch.currency.trim()
      ? firstMatch.currency.trim().toUpperCase()
      : null
  const amount = resolveCatalogMatchAmount(firstMatch.amount)

  const segments = [
    {
      wordingKey: 'customer.search_fallback.match_found',
      variables: {
        productName: productName || 'el producto consultado',
      },
      text: renderWording({
        wordingKey: 'customer.search_fallback.match_found',
        variationSeed,
        variables: {
          productName: productName || 'el producto consultado',
        },
        fallback: TRANSITIONAL_FALLBACKS.searchMatchFound,
        wordingOverrides,
        channel,
        channelProfile,
      }),
    },
    amount && currency
      ? {
          wordingKey: 'customer.search_fallback.price_available',
          variables: {
            currency,
            amount,
          },
          text: renderWording({
            wordingKey: 'customer.search_fallback.price_available',
            variationSeed,
            variables: {
              currency,
              amount,
            },
            fallback: TRANSITIONAL_FALLBACKS.searchPriceAvailable,
            wordingOverrides,
            channel,
            channelProfile,
          }),
        }
      : {
          wordingKey: 'customer.search_fallback.price_missing',
          variables: {},
          text: renderWording({
            wordingKey: 'customer.search_fallback.price_missing',
            variationSeed,
            fallback: TRANSITIONAL_FALLBACKS.searchPriceMissing,
            wordingOverrides,
            channel,
            channelProfile,
          }),
        },
    intentKey === 'customer.quote'
      ? resolveQuoteNextStepSegment({
          quoteContext,
          variationSeed,
          wordingOverrides,
          channel,
          channelProfile,
        })
      : {
          wordingKey: 'customer.search_fallback.next_step',
          variables: {},
          text: renderWording({
            wordingKey: 'customer.search_fallback.next_step',
            variationSeed,
            fallback: TRANSITIONAL_FALLBACKS.searchProductNextStep,
            wordingOverrides,
            channel,
            channelProfile,
          }),
        },
  ]

  return {
    wordingKey: segments[0].wordingKey,
    segmentKeys: segments.map((segment) => segment.wordingKey),
    needsHuman: false,
    referenceTitle: productName || null,
    contract: {
      responseKind: 'published_search_match',
      keepsLane: intentKey === 'customer.quote' ? 'quote' : 'product_info',
      nextStep: intentKey === 'customer.quote' ? 'quote_progress' : 'advisor_followup_optional',
    },
    text: compactText(segments.map((segment) => segment.text).join(' ')),
  }
}

export const buildCustomerSearchFallbackText = (options = {}) =>
  resolveCustomerSearchFallbackShape(options)

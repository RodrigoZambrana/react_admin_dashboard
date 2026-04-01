import {
  getVocabulary,
  hasCatalogVocabularySignal,
} from './tenant-policy/runtime-tenant-policy.js'

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const uniqueStrings = (values = []) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [values])
        .filter((value) => typeof value === 'string')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  )

export const STRUCTURED_CATALOG_REGISTER_INTENT = 'catalog.register_structured_items'
export const STRUCTURED_CATALOG_PREPARE_QUOTE_INTENT =
  'catalog.prepare_structured_quote'
export const STRUCTURED_CATALOG_PARSE_INTENT = 'catalog.parse_structured_items'

export const STRUCTURED_CATALOG_INSERT_TOOL = 'prepare_structured_catalog_insert'
export const STRUCTURED_CATALOG_QUOTE_TOOL = 'prepare_structured_catalog_quote'
export const STRUCTURED_CATALOG_PARSE_TOOL = 'parse_structured_catalog_items'

const STRUCTURED_CATALOG_ACTION_KEYS = new Set([
  STRUCTURED_CATALOG_REGISTER_INTENT,
  STRUCTURED_CATALOG_PREPARE_QUOTE_INTENT,
  STRUCTURED_CATALOG_PARSE_INTENT,
])

const STRUCTURED_CATALOG_TOOL_NAMES = new Set([
  STRUCTURED_CATALOG_INSERT_TOOL,
  STRUCTURED_CATALOG_QUOTE_TOOL,
  STRUCTURED_CATALOG_PARSE_TOOL,
])

export const isStructuredCatalogActionKey = (value = null) =>
  STRUCTURED_CATALOG_ACTION_KEYS.has(String(value || '').trim())

export const isStructuredCatalogToolName = (value = null) =>
  STRUCTURED_CATALOG_TOOL_NAMES.has(String(value || '').trim())

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const formatStructuredCatalogDimensions = (item = null) =>
  `${item?.widthMm || '?'}x${item?.heightMm || '?'}`

const resolveStructuredCatalogConfigurationLabel = (item = null) =>
  compactText(
    item?.configurationLabel ||
      item?.variantLabel ||
      item?.profileLabel ||
      item?.insertPayload?.configurationLabel ||
      '',
  )

export const formatStructuredCatalogInsertItem = (item = null) => {
  const price = item?.insertPayload?.salePrice ?? item?.price ?? null
  const currency = item?.insertPayload?.currency ?? item?.currency ?? null
  const catalogEntryLabel = compactText(
    [
      item?.familyId || item?.familyLabel || 'sin familia',
      resolveStructuredCatalogConfigurationLabel(item) || 'sin configuración',
    ]
      .filter(Boolean)
      .join(' '),
  )
  return compactText(
    `${item?.lineNumber || '?'}. ${catalogEntryLabel} ${formatStructuredCatalogDimensions(
      item,
    )}${currency && price != null ? ` ${currency} ${price}` : ''}`,
  )
}

export const formatStructuredCatalogPendingItem = (item = null) => {
  const missing =
    Array.isArray(item?.missingFields) && item.missingFields.length
      ? item.missingFields
      : [item?.price == null ? 'price' : null, !item?.currency ? 'currency' : null].filter(
          Boolean,
        )
  const catalogEntryLabel = compactText(
    [
      item?.familyId || item?.familyLabel || 'sin familia',
      resolveStructuredCatalogConfigurationLabel(item) || 'sin configuración',
    ]
      .filter(Boolean)
      .join(' '),
  )
  return compactText(
    `${item?.lineNumber || '?'}. ${catalogEntryLabel} ${formatStructuredCatalogDimensions(
      item,
    )}: falta ${missing.join(', ') || 'revisión manual'}`,
  )
}

export const resolveStructuredCatalogSuccessLabel = (item = null) =>
  compactText(
    item?.insertPayload?.name ||
      [
        item?.familyId || item?.familyLabel || 'Ítem',
        resolveStructuredCatalogConfigurationLabel(item),
      ]
        .filter(Boolean)
        .join(' '),
  )

const hasConfiguredVocabularyTerm = (normalizedInput, terms = []) =>
  uniqueStrings(terms).some((term) => {
    const normalizedTerm = normalizeText(term)
    return normalizedTerm && normalizedInput.includes(normalizedTerm)
  })

const STRUCTURED_DIMENSION_REGEX = /\b\d{2,5}\s*(?:x|por)\s*\d{2,5}\b/u
const STRUCTURED_PRICE_REGEX =
  /\b(?:usd|uyu|eur|us\$|\$)\s*\d+(?:[.,]\d+)?\b|\b\d+(?:[.,]\d+)?\s*(?:usd|uyu|eur|us\$)\b/iu
const hasStructuredCatalogShapeSignal = ({
  normalizedInput = '',
  configuredTerms = [],
} = {}) => {
  if (!normalizedInput) {
    return false
  }

  const hasDimensions = STRUCTURED_DIMENSION_REGEX.test(normalizedInput)
  const hasPrice = STRUCTURED_PRICE_REGEX.test(normalizedInput)
  const hasConfiguration = hasConfiguredVocabularyTerm(normalizedInput, configuredTerms)

  return hasDimensions && (hasPrice || hasConfiguration)
}

export const hasStructuredCatalogSignal = (value, tenantRuntimePolicy = null) => {
  const normalizedInput = normalizeText(value)
  if (!normalizedInput) {
    return false
  }

  if (hasCatalogVocabularySignal(normalizedInput, tenantRuntimePolicy)) {
    return true
  }

  const vocabulary = getVocabulary(tenantRuntimePolicy)
  const configuredTerms = uniqueStrings([
    ...(Array.isArray(vocabulary?.catalogCarrierTerms)
      ? vocabulary.catalogCarrierTerms
      : []),
    ...(Array.isArray(vocabulary?.catalogStructuralTerms)
      ? vocabulary.catalogStructuralTerms
      : []),
    ...(Array.isArray(vocabulary?.catalogStructuralPhrases)
      ? vocabulary.catalogStructuralPhrases
      : []),
    vocabulary?.catalogFamilyLabel,
  ])

  return (
    hasConfiguredVocabularyTerm(normalizedInput, configuredTerms) ||
    hasStructuredCatalogShapeSignal({
      normalizedInput,
      configuredTerms,
    })
  )
}

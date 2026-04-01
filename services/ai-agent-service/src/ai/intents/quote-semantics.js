import { getStaticLanguagePolicy } from '../../../../shared/language-policy/index.js'
import { normalizeCustomerTopicText } from './customer-topic-taxonomy.js'

const BASE_LANGUAGE_POLICY = getStaticLanguagePolicy('es-default')

const compileRegex = (entry, fallbackFlags = 'u') => {
  if (!entry || typeof entry !== 'object' || typeof entry.source !== 'string') {
    return null
  }

  return new RegExp(entry.source, entry.flags || fallbackFlags)
}

const compileRegexList = (entries = [], fallbackFlags = 'u') =>
  (Array.isArray(entries) ? entries : [])
    .map((entry) => compileRegex(entry, fallbackFlags))
    .filter(Boolean)

const GENERIC_QUOTE_TOPIC_LABELS = new Set(
  (Array.isArray(BASE_LANGUAGE_POLICY.genericQuoteTopicLabels)
    ? BASE_LANGUAGE_POLICY.genericQuoteTopicLabels
    : []
  )
    .map((entry) => normalizeCustomerTopicText(entry))
    .filter(Boolean),
)

const GENERIC_QUOTE_TOPIC_PATTERNS = compileRegexList(
  BASE_LANGUAGE_POLICY.genericQuoteTopicPatterns,
  'u',
)

export const isGenericQuoteTopicLabel = (value) => {
  const normalized = normalizeCustomerTopicText(value)
  if (!normalized) {
    return false
  }

  if (GENERIC_QUOTE_TOPIC_LABELS.has(normalized)) {
    return true
  }

  return GENERIC_QUOTE_TOPIC_PATTERNS.some((pattern) => pattern.test(normalized))
}

export const normalizeGenericQuoteTopicLabel = (value) =>
  normalizeCustomerTopicText(value)

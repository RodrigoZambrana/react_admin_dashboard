import { getStaticLanguagePolicy } from '../../../../shared/language-policy/index.js'
import { normalizeSemanticText } from '../intents/customer-semantic-signals.js'
import {
  looksLikeCommercialConditionQuestion,
  looksLikeGenericPriceInquiry,
  looksLikeInformationExpansionRequest,
  looksLikeMaterialFollowUpRequest,
  looksLikeQuoteRequirementsQuestion,
  looksLikeQuoteWaitingFollowUp,
} from '../intents/customer-intent-patterns.js'
import { looksLikeAmountOnlyReply } from './response-signals.js'

const BASE_LANGUAGE_POLICY = getStaticLanguagePolicy('es-default')

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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

const CONVERSATION_SIGNAL_PATTERNS =
  BASE_LANGUAGE_POLICY.conversationSignalPatterns &&
  typeof BASE_LANGUAGE_POLICY.conversationSignalPatterns === 'object'
    ? Object.fromEntries(
        Object.entries(BASE_LANGUAGE_POLICY.conversationSignalPatterns).map(
          ([key, entries]) => [key, compileRegexList(entries, 'u')],
        ),
      )
    : {}

const TOPIC_STOP_TOKENS = new Set(
  Array.isArray(BASE_LANGUAGE_POLICY.conversationTopicStopTokens)
    ? BASE_LANGUAGE_POLICY.conversationTopicStopTokens
        .map((entry) => normalizeSemanticText(entry))
        .filter(Boolean)
    : [],
)

const QUOTE_DETAIL_STOP_TOKENS = new Set(
  Array.isArray(BASE_LANGUAGE_POLICY.quoteDetailFollowUpStopTokens)
    ? BASE_LANGUAGE_POLICY.quoteDetailFollowUpStopTokens
        .map((entry) => normalizeSemanticText(entry))
        .filter(Boolean)
    : [],
)

const ATTACHMENT_REFERENCE_REGEX = (() => {
  const terms = Array.isArray(BASE_LANGUAGE_POLICY.attachmentReferenceTerms)
    ? BASE_LANGUAGE_POLICY.attachmentReferenceTerms
        .map((entry) => normalizeSemanticText(entry))
        .filter(Boolean)
    : []
  if (!terms.length) {
    return null
  }

  return new RegExp(`\\b(?:${terms.map((entry) => escapeRegex(entry)).join('|')})\\b`, 'u')
})()

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const matchesConversationSignal = (
  value,
  signalKey,
  { normalize = true } = {},
) => {
  const source = normalize ? normalizeSemanticText(value) : compactText(value)
  if (!source) {
    return false
  }

  const patterns = Array.isArray(CONVERSATION_SIGNAL_PATTERNS[signalKey])
    ? CONVERSATION_SIGNAL_PATTERNS[signalKey]
    : []

  return patterns.some((pattern) => pattern.test(source))
}

export const extractConversationTopicTokens = (value) =>
  Array.from(
    new Set(
      normalizeSemanticText(value)
        .split(/\s+/u)
        .filter((token) => token.length >= 3 && !TOPIC_STOP_TOKENS.has(token)),
    ),
  ).slice(0, 12)

export const calculateConversationTopicOverlap = (left = [], right = []) => {
  if (!left.length || !right.length) {
    return 0
  }

  const leftSet = new Set(left)
  const rightSet = new Set(right)
  let intersection = 0
  for (const token of leftSet) {
    if (rightSet.has(token)) {
      intersection += 1
    }
  }

  return intersection / new Set([...leftSet, ...rightSet]).size
}

export const hasExplicitConversationReset = (value) =>
  matchesConversationSignal(value, 'explicitResetRequested')

export const looksLikeCustomerFollowUp = (value) =>
  matchesConversationSignal(value, 'customerFollowUp')

export const looksLikeAttachmentReference = (value) => {
  const normalized = normalizeSemanticText(value)
  return Boolean(normalized) && Boolean(ATTACHMENT_REFERENCE_REGEX?.test(normalized))
}

export const looksLikeScheduleContinuationInput = (value) =>
  matchesConversationSignal(value, 'scheduleContinuationInput')

export const looksLikeExplicitFaqQuestionInput = (value) => {
  const raw = String(value || '').trim()
  if (!raw) {
    return false
  }

  return /[?¿]/u.test(raw) || matchesConversationSignal(raw, 'explicitFaqQuestionInput')
}

export const looksLikeShortContextualFollowUp = (value) => {
  const normalized = normalizeSemanticText(value)
  const tokens = normalized.split(/\s+/u).filter(Boolean)
  if (!normalized || tokens.length > 8) {
    return false
  }

  return matchesConversationSignal(normalized, 'shortContextualFollowUp', {
    normalize: false,
  })
}

export const looksLikeContextualReference = (value) =>
  matchesConversationSignal(value, 'contextualReference')

export const looksLikeLightClosureFollowUp = (value) =>
  matchesConversationSignal(value, 'lightClosureFollowUp')

export const looksLikeClosureContinuationResponse = (value) =>
  matchesConversationSignal(value, 'closureContinuationResponse')

export const sanitizeLoopSubjectLabel = (value = null) => {
  const compacted = compactText(value)
  const normalized = normalizeSemanticText(compacted)
  if (!normalized) {
    return null
  }

  if (
    /^\d+(?:[.,]\d+)?$/u.test(normalized) ||
    /^(uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)$/u.test(normalized) ||
    QUOTE_DETAIL_STOP_TOKENS.has(normalized)
  ) {
    return null
  }

  return compacted
}

export const looksLikeOperationalStatusContinuation = (value) =>
  looksLikeScheduleContinuationInput(value) ||
  matchesConversationSignal(value, 'operationalStatusContinuation')

export const looksLikeAddressOrTimeReply = (value) =>
  matchesConversationSignal(value, 'addressOrTimeReply')

export const looksLikeQuoteDetailFollowUp = (value) => {
  const raw = String(value || '')
  const normalized = normalizeSemanticText(raw)
  if (!normalized || /[?¿]/u.test(raw) || looksLikeLightClosureFollowUp(raw)) {
    return false
  }

  if (
    looksLikeAmountOnlyReply(raw) ||
    /\b\d{1,4}(?:[.,]\d+)?\s*[x×]\s*\d{1,4}(?:[.,]\d+)?\b/u.test(normalized) ||
    looksLikeGenericPriceInquiry(raw) ||
    looksLikeQuoteRequirementsQuestion(raw) ||
    looksLikeQuoteWaitingFollowUp(raw) ||
    looksLikeMaterialFollowUpRequest(raw) ||
    looksLikeInformationExpansionRequest(raw) ||
    looksLikeCommercialConditionQuestion(raw) ||
    looksLikeOperationalStatusContinuation(raw) ||
    looksLikeAttachmentReference(raw)
  ) {
    return false
  }

  const tokens = normalized.split(/\s+/u).filter(Boolean)
  if (!tokens.length || tokens.length > 8) {
    return false
  }

  const meaningfulTokens = tokens.filter((token) => !QUOTE_DETAIL_STOP_TOKENS.has(token))
  return meaningfulTokens.some((token) => token.length >= 4 || /\d/u.test(token))
}

export const looksLikeCoordinationAskResponse = (value) =>
  matchesConversationSignal(value, 'coordinationAskResponse')

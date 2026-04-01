import { getStaticLanguagePolicy } from '../../../../shared/language-policy/index.js'
import { normalizeSemanticText } from '../intents/customer-semantic-signals.js'

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

const RESPONSE_SIGNAL_PATTERNS =
  BASE_LANGUAGE_POLICY.responseSignalPatterns &&
  typeof BASE_LANGUAGE_POLICY.responseSignalPatterns === 'object'
    ? Object.fromEntries(
        Object.entries(BASE_LANGUAGE_POLICY.responseSignalPatterns).map(
          ([key, entries]) => [key, compileRegexList(entries, 'u')],
        ),
      )
    : {}

const matchesResponseSignal = (value, signalKey) => {
  const normalized = normalizeSemanticText(value)
  if (!normalized) {
    return false
  }

  const patterns = Array.isArray(RESPONSE_SIGNAL_PATTERNS[signalKey])
    ? RESPONSE_SIGNAL_PATTERNS[signalKey]
    : []

  return patterns.some((pattern) => pattern.test(normalized))
}

export const looksLikeGenericClarificationResponse = (value) =>
  matchesResponseSignal(value, 'genericClarification')

export const looksLikeGenericQuoteIntakeResponse = (value) =>
  matchesResponseSignal(value, 'genericQuoteIntake')

export const looksLikeGenericContactResponse = (value) =>
  matchesResponseSignal(value, 'genericContact')

export const looksLikeGenericConsultationClosureResponse = (value) =>
  matchesResponseSignal(value, 'genericConsultationClosure')

export const looksLikeGenericQuoteHandoffResponse = (value) =>
  matchesResponseSignal(value, 'genericQuoteHandoff')

export const looksLikeAwaitingProofResponse = (value) =>
  matchesResponseSignal(value, 'awaitingProof')

export const hasPaymentContinuationSignal = (value) =>
  matchesResponseSignal(value, 'paymentContinuation')

export const looksLikeAmountOnlyReply = (value) =>
  /^\s*(?:usd|uyu|\$)?\s*\d+(?:[.,]\d{1,2})?\s*(?:usd|uyu)?\s*$/iu.test(
    String(value || '').trim(),
  )

export const looksLikeSpecificPaymentMethodQuestion = (value) => {
  const normalized = normalizeSemanticText(value)
  if (!normalized) {
    return false
  }

  if (matchesResponseSignal(normalized, 'specificPaymentMethodQuestion')) {
    return true
  }

  return normalized.length <= 48 && hasPaymentContinuationSignal(normalized)
}

export const looksLikeBankAccountPaymentQuestion = (value) => {
  const normalized = normalizeSemanticText(value)
  if (!normalized) {
    return false
  }

  return /\b(cuenta bancaria|datos? bancarios?|transferencia bancaria|cuenta en pesos|cuenta en dolares)\b/u.test(
    normalized,
  )
}

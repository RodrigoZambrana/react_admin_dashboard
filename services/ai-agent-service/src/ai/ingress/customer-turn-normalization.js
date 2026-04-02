import {
  detectStandaloneAttachmentArtifactKind,
  hasMultimodalPlaceholderSignal,
  normalizeSemanticText,
} from '../intents/customer-semantic-signals.js'

export const extractRawCurrentCustomerTurnText = (value) =>
  String(value || '')
    .split(/\n+\s*Contexto conversacional reciente relevante:\s*/iu)[0]
    .replace(/<se edit[oó]\s+este\s+mensaje\.?>/giu, ' ')
    .replace(/<multimedia\s+omitido>/giu, ' ')
    .replace(/<imagen\s+omitida>/giu, ' ')
    .replace(/<audio\s+omitido>/giu, ' ')
    .replace(/<video\s+omitido>/giu, ' ')
    .replace(/\r\n?/gu, '\n')
    .replace(/[^\S\n]+/gu, ' ')
    .replace(/\n{3,}/gu, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim()

export const extractCurrentCustomerTurnText = (value) =>
  extractRawCurrentCustomerTurnText(value)
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

export const stripPlaceholderOnlyCustomerTurnText = (value) =>
  extractSemanticCustomerTurnText(value)

export const normalizeSemanticCustomerTurnText = (value) =>
  normalizeSemanticText(stripPlaceholderOnlyCustomerTurnText(value))

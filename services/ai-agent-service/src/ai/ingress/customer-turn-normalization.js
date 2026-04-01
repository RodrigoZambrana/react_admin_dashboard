import {
  detectStandaloneAttachmentArtifactKind,
  hasMultimodalPlaceholderSignal,
  normalizeSemanticText,
} from '../intents/customer-semantic-signals.js'

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

export const stripPlaceholderOnlyCustomerTurnText = (value) =>
  extractSemanticCustomerTurnText(value)

export const normalizeSemanticCustomerTurnText = (value) =>
  normalizeSemanticText(stripPlaceholderOnlyCustomerTurnText(value))

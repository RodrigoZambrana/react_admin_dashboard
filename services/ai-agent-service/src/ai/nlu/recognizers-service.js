import {
  recognizeCurrency,
  recognizeDateTime,
  recognizeDimension,
  recognizeNumber,
  recognizePhoneNumber,
} from '@microsoft/recognizers-text-suite'
import { extractCustomerQuotedMeasurements } from '../intents/customer-quote-context.js'

const DEFAULT_CULTURE = 'es-uy'

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const mapResolutionValues = (value) => {
  if (!value || typeof value !== 'object') {
    return []
  }

  const candidates = Array.isArray(value.values)
    ? value.values
    : Array.isArray(value.value)
      ? value.value
      : value.value && typeof value.value === 'object'
        ? [value.value]
        : []

  return candidates
    .filter((entry) => entry && typeof entry === 'object')
    .map((entry) => ({
      value:
        entry.value ??
        entry.number ??
        entry.timex ??
        entry.text ??
        null,
      unit: entry.unit ?? null,
      type: entry.type ?? null,
      timex: entry.timex ?? null,
    }))
}

const mapRecognizerResult = (entry) => ({
  text: compactText(entry?.text || ''),
  typeName: entry?.typeName || null,
  start: Number.isInteger(entry?.start) ? entry.start : null,
  end: Number.isInteger(entry?.end) ? entry.end : null,
  resolution: mapResolutionValues(entry?.resolution),
})

const EMAIL_REGEX =
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/giu

const extractEmails = (input) =>
  Array.from(new Set(String(input || '').match(EMAIL_REGEX) || [])).map((value) => ({
    text: value,
    value,
  }))

export const recognizeCustomerEntities = (input, options = {}) => {
  const text = String(input || '')
  if (!text.trim()) {
    return {
      culture: DEFAULT_CULTURE,
      numbers: [],
      currencies: [],
      dateTimes: [],
      phones: [],
      emails: [],
      dimensions: [],
      dimensionPairs: [],
      hasStructuredEntities: false,
    }
  }

  const culture =
    typeof options?.culture === 'string' && options.culture.trim()
      ? options.culture.trim().toLowerCase()
      : DEFAULT_CULTURE

  const numbers = recognizeNumber(text, culture).map(mapRecognizerResult)
  const currencies = recognizeCurrency(text, culture).map(mapRecognizerResult)
  const dateTimes = recognizeDateTime(text, culture).map(mapRecognizerResult)
  const phones = recognizePhoneNumber(text, culture).map(mapRecognizerResult)
  const dimensions = recognizeDimension(text, culture).map(mapRecognizerResult)
  const emails = extractEmails(text)
  const quotedMeasurements = extractCustomerQuotedMeasurements(text)
  const dimensionPairs = quotedMeasurements
    ? [
        {
          widthMm: quotedMeasurements.widthMm,
          heightMm: quotedMeasurements.heightMm,
          displayUnit: quotedMeasurements.displayUnit,
          displayLabel: quotedMeasurements.displayLabel,
          confirmationLabel: quotedMeasurements.confirmationLabel,
          rawMatch: quotedMeasurements.rawMatch,
          source: quotedMeasurements.source || 'quote_pair_regex',
        },
      ]
    : []

  return {
    culture,
    numbers,
    currencies,
    dateTimes,
    phones,
    emails,
    dimensions,
    dimensionPairs,
    hasStructuredEntities:
      numbers.length > 0 ||
      currencies.length > 0 ||
      dateTimes.length > 0 ||
      phones.length > 0 ||
      emails.length > 0 ||
      dimensions.length > 0 ||
      dimensionPairs.length > 0,
  }
}

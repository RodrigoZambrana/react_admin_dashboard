const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeMeasurementText = (value) =>
  compactText(
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]+/g, ' '),
  )

export const DIMENSION_VALUE_SOURCE = '\\d{1,4}(?:[.,]\\d{1,3})?'
export const DIMENSION_UNIT_SOURCE =
  'mm|milimetros?|milímetros?|cm|centimetros?|centímetros?|m|mts?|metros?'
export const DIMENSION_SEPARATOR_SOURCE = '(?:x|×|por)'
export const DIMENSION_PAIR_SOURCE = `\\b(${DIMENSION_VALUE_SOURCE})\\s*(${DIMENSION_UNIT_SOURCE})?\\s*${DIMENSION_SEPARATOR_SOURCE}\\s*(${DIMENSION_VALUE_SOURCE})\\s*(${DIMENSION_UNIT_SOURCE})?\\b`

const DIMENSION_PAIR_REGEX = new RegExp(DIMENSION_PAIR_SOURCE, 'iu')

const SOFT_WINDOW_DIMENSION_MAX_MM = 6000

const MEASUREMENT_SECTION_INTRO_PATTERNS = [
  /\b(?:a\s+continuacion|a\s+continuación|adjunto|te\s+paso|dejo|detallo|detalle|van|van\s+las)\b.*\b(?:medidas?|dimensiones?)\b/iu,
  /\b(?:medidas?|dimensiones?)\b.*:$/iu,
  /^\s*(?:medidas?|dimensiones?)\s*:?$/iu,
]

const GENERIC_MEASUREMENT_LEAD_TOKENS = new Set([
  'aprox',
  'aproximadas',
  'aproximados',
  'aproximadamente',
  'despues',
  'después',
  'dimensiones',
  'dimension',
  'es',
  'la',
  'las',
  'los',
  'medida',
  'medidas',
  'son',
  'total',
  'un',
  'una',
  'van',
  'va',
  'y',
])

export const DEFAULT_MEASUREMENT_CARRIER_TERMS = []

export const DEFAULT_LINE_ITEM_TERMS = [
  'unidad',
  'unidades',
  'item',
  'items',
  'pieza',
  'piezas',
]

const dedupeNormalizedMeasurementTexts = (values = []) => {
  const seen = new Set()
  const result = []

  for (const value of values) {
    const normalized = normalizeMeasurementText(value)
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    result.push(normalized)
  }

  return result
}

const normalizeUnit = (value) => {
  const normalized = normalizeMeasurementText(value)
  if (!normalized) {
    return null
  }

  if (normalized === 'mm' || normalized.startsWith('milimetr')) {
    return 'mm'
  }
  if (normalized === 'cm' || normalized.startsWith('centimetr')) {
    return 'cm'
  }
  if (
    normalized === 'm' ||
    normalized === 'mt' ||
    normalized === 'mts' ||
    normalized.startsWith('metro')
  ) {
    return 'm'
  }

  return null
}

const parseNumericDimension = (raw) => {
  const normalized = String(raw || '').trim().replace(',', '.')
  if (!normalized) {
    return null
  }

  const numeric = Number(normalized)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

const hasDecimalsInRawDimension = (raw) => /[.,]/.test(String(raw || '').trim())

const inferImplicitUnit = (raw, numeric, pairValues = []) => {
  if (numeric == null) {
    return null
  }

  const source = String(raw || '').trim()
  const hasDecimals = /[.,]/.test(source)
  const minPairValue = pairValues.length ? Math.min(...pairValues) : numeric

  if (hasDecimals) {
    if (numeric <= 10) {
      return 'm'
    }
    if (numeric <= 500) {
      return 'cm'
    }
    return 'mm'
  }

  if (numeric >= 1000) {
    return 'mm'
  }
  if (minPairValue <= 10) {
    return 'm'
  }
  if (numeric >= 30 && numeric <= 500) {
    return 'cm'
  }
  if (numeric > 0 && numeric < 30) {
    return 'm'
  }

  return 'mm'
}

const resolveImplicitDimensionUnits = ({
  rawWidth,
  rawHeight,
  explicitUnitLeft = null,
  explicitUnitRight = null,
}) => {
  const sharedUnit = explicitUnitLeft || explicitUnitRight || null
  if (sharedUnit) {
    return {
      widthUnit: sharedUnit,
      heightUnit: sharedUnit,
    }
  }

  const widthNumeric = parseNumericDimension(rawWidth)
  const heightNumeric = parseNumericDimension(rawHeight)
  const pairNumericValues = [widthNumeric, heightNumeric].filter(
    (entry) => typeof entry === 'number',
  )
  const widthHasDecimals = hasDecimalsInRawDimension(rawWidth)
  const heightHasDecimals = hasDecimalsInRawDimension(rawHeight)

  let widthUnit = inferImplicitUnit(rawWidth, widthNumeric, pairNumericValues)
  let heightUnit = inferImplicitUnit(rawHeight, heightNumeric, pairNumericValues)

  if (widthHasDecimals !== heightHasDecimals) {
    const integerNumeric = widthHasDecimals ? heightNumeric : widthNumeric
    const decimalUnit = widthHasDecimals ? widthUnit : heightUnit
    const integerAsMetersMm =
      typeof integerNumeric === 'number' ? Math.round(integerNumeric * 1000) : null
    const integerAsCentimetersMm =
      typeof integerNumeric === 'number' ? Math.round(integerNumeric * 10) : null
    const shouldNormalizeMixedPairToCentimeters =
      decimalUnit === 'm' &&
      typeof integerNumeric === 'number' &&
      integerNumeric >= 30 &&
      integerNumeric <= 500 &&
      typeof integerAsMetersMm === 'number' &&
      integerAsMetersMm > SOFT_WINDOW_DIMENSION_MAX_MM &&
      typeof integerAsCentimetersMm === 'number' &&
      integerAsCentimetersMm <= SOFT_WINDOW_DIMENSION_MAX_MM

    if (shouldNormalizeMixedPairToCentimeters) {
      if (widthHasDecimals) {
        heightUnit = 'cm'
      } else {
        widthUnit = 'cm'
      }
    }
  }

  return {
    widthUnit,
    heightUnit,
  }
}

const convertDimensionToMm = (raw, explicitUnit, pairValues = []) => {
  const numeric = parseNumericDimension(raw)
  if (numeric == null) {
    return null
  }

  const unit = explicitUnit || inferImplicitUnit(raw, numeric, pairValues)
  if (!unit) {
    return null
  }

  switch (unit) {
    case 'm':
      return { valueMm: Math.round(numeric * 1000), displayValue: numeric, displayUnit: 'm' }
    case 'cm':
      return { valueMm: Math.round(numeric * 10), displayValue: numeric, displayUnit: 'cm' }
    case 'mm':
    default:
      return { valueMm: Math.round(numeric), displayValue: numeric, displayUnit: 'mm' }
  }
}

const convertMmToDisplayValue = (valueMm, unit) => {
  if (typeof valueMm !== 'number' || !Number.isFinite(valueMm) || valueMm <= 0) {
    return null
  }

  switch (unit) {
    case 'm':
      return valueMm / 1000
    case 'cm':
      return valueMm / 10
    case 'mm':
    default:
      return valueMm
  }
}

const resolveMeasurementDisplayUnit = ({ width, height, sharedUnit = null }) => {
  if (
    sharedUnit &&
    width?.displayUnit === sharedUnit &&
    height?.displayUnit === sharedUnit
  ) {
    return sharedUnit
  }

  if (width?.displayUnit && width.displayUnit === height?.displayUnit) {
    return width.displayUnit
  }

  const widthMm = Number(width?.valueMm)
  const heightMm = Number(height?.valueMm)
  if (
    Number.isFinite(widthMm) &&
    Number.isFinite(heightMm) &&
    widthMm > 0 &&
    heightMm > 0
  ) {
    if (
      widthMm <= SOFT_WINDOW_DIMENSION_MAX_MM &&
      heightMm <= SOFT_WINDOW_DIMENSION_MAX_MM &&
      (width?.displayUnit === 'm' || height?.displayUnit === 'm')
    ) {
      return 'm'
    }

    if (
      widthMm <= SOFT_WINDOW_DIMENSION_MAX_MM &&
      heightMm <= SOFT_WINDOW_DIMENSION_MAX_MM &&
      widthMm % 10 === 0 &&
      heightMm % 10 === 0
    ) {
      return 'cm'
    }

    if (widthMm % 1000 === 0 && heightMm % 1000 === 0) {
      return 'm'
    }
  }

  return 'mm'
}

const formatDisplayNumber = (value, unit) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  const options =
    unit === 'm'
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }
      : Number.isInteger(value)
        ? { maximumFractionDigits: 0, useGrouping: false }
        : { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false }

  return new Intl.NumberFormat('es-UY', options).format(value)
}

const buildLineItemQuantityRegex = (lineItemTerms = []) => {
  const terms = Array.from(
    new Set([
      ...DEFAULT_LINE_ITEM_TERMS,
      ...DEFAULT_MEASUREMENT_CARRIER_TERMS,
      ...dedupeNormalizedMeasurementTexts(lineItemTerms),
    ]),
  ).sort((left, right) => right.length - left.length)

  if (!terms.length) {
    return /^(?:[-*]\s*)?(\d{1,4})\s+\b/iu
  }

  const escapedTerms = terms
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')

  return new RegExp(`^(?:[-*]\\s*)?(\\d{1,4})\\s+(?:${escapedTerms})\\b`, 'iu')
}

const buildMeasurementItemRegex = (lineItemTerms = []) => {
  const terms = Array.from(
    new Set([
      ...DEFAULT_LINE_ITEM_TERMS,
      ...DEFAULT_MEASUREMENT_CARRIER_TERMS,
      ...dedupeNormalizedMeasurementTexts(lineItemTerms),
    ]),
  ).sort((left, right) => right.length - left.length)

  const escapedTerms = terms
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const quantitySeparatorFragment = escapedTerms
    ? `(?:\\s+(?:${escapedTerms})\\s*|\\s+)`
    : '\\s+'

  return new RegExp(
    `(?<![\\d.,])(\\d{1,4})${quantitySeparatorFragment}(?:de\\s+)?(${DIMENSION_VALUE_SOURCE})\\s*(${DIMENSION_UNIT_SOURCE})?\\s*${DIMENSION_SEPARATOR_SOURCE}\\s*(${DIMENSION_VALUE_SOURCE})\\s*(${DIMENSION_UNIT_SOURCE})?`,
    'giu',
  )
}

const extractMeasurementPair = (value) => {
  const match = String(value || '').match(DIMENSION_PAIR_REGEX)
  if (!match?.[1] || !match?.[3]) {
    return null
  }

  const rawWidth = String(match[1]).trim()
  const rawHeight = String(match[3]).trim()
  const explicitUnitLeft = normalizeUnit(match[2])
  const explicitUnitRight = normalizeUnit(match[4])

  if (explicitUnitLeft && explicitUnitRight && explicitUnitLeft !== explicitUnitRight) {
    return null
  }

  const pairNumericValues = [
    parseNumericDimension(rawWidth),
    parseNumericDimension(rawHeight),
  ].filter((entry) => typeof entry === 'number')
  const sharedUnit = explicitUnitLeft || explicitUnitRight || null
  const { widthUnit, heightUnit } = resolveImplicitDimensionUnits({
    rawWidth,
    rawHeight,
    explicitUnitLeft,
    explicitUnitRight,
  })
  const width = convertDimensionToMm(rawWidth, sharedUnit || widthUnit, pairNumericValues)
  const height = convertDimensionToMm(rawHeight, sharedUnit || heightUnit, pairNumericValues)

  if (!width || !height || width.valueMm <= 0 || height.valueMm <= 0) {
    return null
  }

  const displayUnit = resolveMeasurementDisplayUnit({
    width,
    height,
    sharedUnit,
  })
  const displayWidth =
    formatDisplayNumber(convertMmToDisplayValue(width.valueMm, displayUnit), displayUnit) ||
    compactText(rawWidth)
  const displayHeight =
    formatDisplayNumber(convertMmToDisplayValue(height.valueMm, displayUnit), displayUnit) ||
    compactText(rawHeight)
  const displayLabel = `${displayWidth} x ${displayHeight} ${displayUnit}`.trim()

  return {
    widthMm: width.valueMm,
    heightMm: height.valueMm,
    displayUnit,
    displayLabel,
    confirmationLabel: `${displayLabel} de ancho por alto`,
    rawMatch: compactText(match[0]),
    source: 'message_dimensions',
  }
}

const extractMeasurementPairFromMatchGroups = ({
  rawWidth,
  rawHeight,
  explicitUnitLeft = null,
  explicitUnitRight = null,
  rawMatch = null,
}) => {
  if (!rawWidth || !rawHeight) {
    return null
  }

  const normalizedUnitLeft = normalizeUnit(explicitUnitLeft)
  const normalizedUnitRight = normalizeUnit(explicitUnitRight)
  if (
    normalizedUnitLeft &&
    normalizedUnitRight &&
    normalizedUnitLeft !== normalizedUnitRight
  ) {
    return null
  }

  const pairNumericValues = [
    parseNumericDimension(rawWidth),
    parseNumericDimension(rawHeight),
  ].filter((entry) => typeof entry === 'number')
  const sharedUnit = normalizedUnitLeft || normalizedUnitRight || null
  const { widthUnit, heightUnit } = resolveImplicitDimensionUnits({
    rawWidth,
    rawHeight,
    explicitUnitLeft: normalizedUnitLeft,
    explicitUnitRight: normalizedUnitRight,
  })
  const width = convertDimensionToMm(rawWidth, sharedUnit || widthUnit, pairNumericValues)
  const height = convertDimensionToMm(rawHeight, sharedUnit || heightUnit, pairNumericValues)

  if (!width || !height || width.valueMm <= 0 || height.valueMm <= 0) {
    return null
  }

  const displayUnit = resolveMeasurementDisplayUnit({
    width,
    height,
    sharedUnit,
  })
  const displayWidth =
    formatDisplayNumber(convertMmToDisplayValue(width.valueMm, displayUnit), displayUnit) ||
    compactText(rawWidth)
  const displayHeight =
    formatDisplayNumber(convertMmToDisplayValue(height.valueMm, displayUnit), displayUnit) ||
    compactText(rawHeight)
  const displayLabel = `${displayWidth} x ${displayHeight} ${displayUnit}`.trim()

  return {
    widthMm: width.valueMm,
    heightMm: height.valueMm,
    displayUnit,
    displayLabel,
    confirmationLabel: `${displayLabel} de ancho por alto`,
    rawMatch: compactText(rawMatch || `${rawWidth} x ${rawHeight}`),
    source: 'message_dimensions',
  }
}

const extractInlineMeasurementItems = (value, options = {}) => {
  const sourceText = String(value || '')
  const lineItemTerms = Array.isArray(options?.lineItemTerms)
    ? options.lineItemTerms
    : []
  const matcher = buildMeasurementItemRegex(lineItemTerms)
  const items = []
  const seen = new Set()

  for (const match of sourceText.matchAll(matcher)) {
    const quantity = Number(match?.[1] || 0)
    const measurement = extractMeasurementPairFromMatchGroups({
      rawWidth: String(match?.[2] || '').trim(),
      rawHeight: String(match?.[4] || '').trim(),
      explicitUnitLeft: match?.[3] || null,
      explicitUnitRight: match?.[5] || null,
      rawMatch: match?.[0] || null,
    })
    if (!measurement || !Number.isInteger(quantity) || quantity <= 0) {
      continue
    }

    const fingerprint = `${measurement.widthMm}:${measurement.heightMm}:${quantity}`
    if (seen.has(fingerprint)) {
      continue
    }
    seen.add(fingerprint)

    const prefix = sourceText.slice(0, match.index || 0)
    items.push({
      ...measurement,
      quantity,
      lineNumber: prefix.split('\n').length,
    })
  }

  return items
}

const extractMeasurementPairsFromText = (value) => {
  const matcher = new RegExp(DIMENSION_PAIR_SOURCE, 'giu')
  const items = []
  const seen = new Set()

  for (const match of String(value || '').matchAll(matcher)) {
    const measurement = extractMeasurementPairFromMatchGroups({
      rawWidth: String(match?.[1] || '').trim(),
      rawHeight: String(match?.[3] || '').trim(),
      explicitUnitLeft: match?.[2] || null,
      explicitUnitRight: match?.[4] || null,
      rawMatch: match?.[0] || null,
    })
    if (!measurement) {
      continue
    }

    const fingerprint = `${measurement.widthMm}:${measurement.heightMm}:${measurement.rawMatch}`
    if (seen.has(fingerprint)) {
      continue
    }
    seen.add(fingerprint)
    items.push(measurement)
  }

  return items
}

const splitMeasurementCandidateLines = (value) =>
  String(value || '')
    .split(/(?:\n+|;)/u)
    .map((entry) => compactText(entry))
    .filter(Boolean)

const looksLikeMeasurementSectionIntro = (line) =>
  MEASUREMENT_SECTION_INTRO_PATTERNS.some((pattern) => pattern.test(compactText(line)))

const findFirstPatternIndex = (value, patterns = []) => {
  const sourceText = String(value || '')
  let firstIndex = Number.POSITIVE_INFINITY

  for (const pattern of patterns) {
    const matcher = new RegExp(pattern.source, pattern.flags)
    const match = matcher.exec(sourceText)
    if (match && typeof match.index === 'number') {
      firstIndex = Math.min(firstIndex, match.index)
    }
  }

  return Number.isFinite(firstIndex) ? firstIndex : null
}

const sanitizeLeadTextBeforeMeasurements = (value) => {
  const compactValue = compactText(value)
  if (!compactValue) {
    return ''
  }

  const normalizedTokens = normalizeMeasurementText(compactValue)
    .split(/\s+/u)
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (
    normalizedTokens.length > 0 &&
    normalizedTokens.every((token) => GENERIC_MEASUREMENT_LEAD_TOKENS.has(token))
  ) {
    return ''
  }

  return compactValue
}

export const extractLineItemQuantity = (
  line,
  lineItemTerms = [],
  measurementRawMatch = null,
) => {
  const compactLine = compactText(line)
  const match = compactLine.match(buildLineItemQuantityRegex(lineItemTerms))
  if (!match?.[1]) {
    const normalizedMeasurementRawMatch = compactText(measurementRawMatch)
    if (!normalizedMeasurementRawMatch) {
      return null
    }

    const measurementStartIndex = compactLine.indexOf(normalizedMeasurementRawMatch)
    if (measurementStartIndex <= 0) {
      return null
    }

    const prefix = compactText(compactLine.slice(0, measurementStartIndex))
    const genericPrefixMatch = prefix.match(/^(?:[-*]\s*)?(\d{1,4})\b(.*)$/iu)
    if (!genericPrefixMatch?.[1]) {
      return null
    }

    const quantity = Number(genericPrefixMatch[1])
    const descriptor = compactText(genericPrefixMatch[2] || '')
    const hasDescriptor =
      descriptor.length > 0 &&
      /\b[a-záéíóúñ][a-záéíóúñ0-9-]*\b/iu.test(descriptor)

    return Number.isInteger(quantity) && quantity > 0 && hasDescriptor ? quantity : null
  }

  const parsed = Number(match[1])
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export const extractCustomerQuotedMeasurementItems = (value, options = {}) => {
  const lineItemTerms = Array.isArray(options?.lineItemTerms)
    ? options.lineItemTerms
    : []
  const inlineItems = extractInlineMeasurementItems(value, { lineItemTerms })
  if (inlineItems.length > 0) {
    return inlineItems
  }

  const items = []
  const seen = new Set()

  for (const [index, line] of splitMeasurementCandidateLines(value).entries()) {
    const lineMeasurements = extractMeasurementPairsFromText(line)
    if (!lineMeasurements.length) {
      continue
    }

    if (lineMeasurements.length === 1) {
      const [measurement] = lineMeasurements
      const fingerprint = `${measurement.widthMm}:${measurement.heightMm}:${measurement.rawMatch}`
      if (seen.has(fingerprint)) {
        continue
      }
      seen.add(fingerprint)

      items.push({
        ...measurement,
        quantity: extractLineItemQuantity(
          line,
          lineItemTerms,
          measurement.rawMatch,
        ),
        lineNumber: index + 1,
      })
      continue
    }

    for (const measurement of lineMeasurements) {
      const fingerprint = `${measurement.widthMm}:${measurement.heightMm}:${measurement.rawMatch}`
      if (seen.has(fingerprint)) {
        continue
      }
      seen.add(fingerprint)

      items.push({
        ...measurement,
        quantity: null,
        lineNumber: index + 1,
      })
    }
  }

  if (items.length > 0) {
    return items
  }

  const measurement = extractMeasurementPair(value)
  return measurement
    ? [
        {
          ...measurement,
          quantity: null,
          lineNumber: 1,
        },
      ]
    : []
}

export const extractCustomerQuotedMeasurements = (value, options = {}) => {
  const items = extractCustomerQuotedMeasurementItems(value, options)
  if (!items.length) {
    return null
  }

  const [first] = items
  return {
    widthMm: first.widthMm,
    heightMm: first.heightMm,
    displayUnit: first.displayUnit,
    displayLabel: first.displayLabel,
    confirmationLabel: first.confirmationLabel,
    rawMatch: first.rawMatch,
    source: first.source,
  }
}

export const extractCustomerQuoteLeadText = (value) => {
  const compactValue = compactText(value)
  const lines = String(value || '')
    .split(/\n+/u)
    .map((entry) => compactText(entry))
    .filter(Boolean)

  const leadLines = []
  for (const line of lines) {
    if (DIMENSION_PAIR_REGEX.test(line) || looksLikeMeasurementSectionIntro(line)) {
      break
    }
    leadLines.push(line)
  }

  if (leadLines.length > 0 && leadLines.length < lines.length) {
    return sanitizeLeadTextBeforeMeasurements(leadLines.join(' '))
  }

  const cutIndex = findFirstPatternIndex(compactValue, [
    DIMENSION_PAIR_REGEX,
    ...MEASUREMENT_SECTION_INTRO_PATTERNS,
  ])
  if (cutIndex != null && cutIndex > 0) {
    const sanitizedLead = sanitizeLeadTextBeforeMeasurements(compactValue.slice(0, cutIndex))
    return sanitizedLead
  }

  return compactValue
}

import {
  findBestTenantTopicMatch,
  findTenantTopicMatches,
  isContextualTopicDescriptorMatch,
} from './customer-topic-taxonomy.js'

const compactText = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const normalizeText = (value) =>
  compactText(
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]+/g, ' '),
  )

const DIMENSION_VALUE_SOURCE = '\\d{1,4}(?:[.,]\\d{1,3})?'
const DIMENSION_UNIT_SOURCE =
  'mm|milimetros?|milímetros?|cm|centimetros?|centímetros?|m|mts?|metros?'
const DIMENSION_PAIR_SOURCE = `\\b(${DIMENSION_VALUE_SOURCE})\\s*(${DIMENSION_UNIT_SOURCE})?\\s*[x×]\\s*(${DIMENSION_VALUE_SOURCE})\\s*(${DIMENSION_UNIT_SOURCE})?\\b`

const DIMENSION_PAIR_REGEX = new RegExp(DIMENSION_PAIR_SOURCE, 'iu')

const EXPLICIT_TOTAL_QUANTITY_PATTERNS = [
  /\b(?:por\s+un\s+total\s+de|total\s+de)\s+(\d{1,4})\b/iu,
  /\bson\s+(\d{1,4})\b/iu,
  /\b(\d{1,4})\s+(?:unidades?|items?|item|piezas?)\b/iu,
  /\b(\d{1,4})\s+(?:cortinas?|rollers?|persianas?|ventanas?|puertas?|aberturas?|esteras?)\b/iu,
]

const BARE_QUANTITY_FOLLOW_UP_REGEX =
  /^\s*(?:(?:necesito|quiero|preciso|seria|serían|serian|son)\s+)?(\d{1,4})(?:\s+(?:unidades?|items?|item|piezas?))?\s*$/iu

const SOFT_WINDOW_DIMENSION_MAX_MM = 6000

const MEASUREMENT_SECTION_INTRO_PATTERNS = [
  /\b(?:a\s+continuacion|a\s+continuación|adjunto|te\s+paso|dejo|detallo|detalle|van|van\s+las)\b.*\b(?:medidas?|dimensiones?)\b/iu,
  /\b(?:medidas?|dimensiones?)\b.*:$/iu,
  /^\s*(?:medidas?|dimensiones?)\s*:?$/iu,
]

const QUOTE_MEASUREMENT_TAG_PATTERNS = [
  /\bquote\b.*\brequir\w*\b.*\bmeasure\w*/,
  /\brequir\w*\b.*\bmeasure\w*/,
  /\bmeasure\w*\b.*\brequir\w*/,
  /\bcustom\b.*\bquote/,
  /\bmade to measure\b/,
  /\ba medida\b/,
]

const QUOTE_REQUIREMENT_TAG_PATTERNS = [
  { pattern: /\bquote[\s_-]*requires?[\s_-]*measurements?\b/, field: 'measurements' },
  { pattern: /\bquote[\s_-]*requires?[\s_-]*quantity\b/, field: 'quantity' },
  { pattern: /\bquote[\s_-]*requires?[\s_-]*series?\b/, field: 'series' },
  { pattern: /\bquote[\s_-]*requires?[\s_-]*glass\b/, field: 'glass' },
  { pattern: /\bquote[\s_-]*requires?[\s_-]*color\b/, field: 'color' },
]

const QUOTE_SLOT_TAG_PATTERNS = [
  { pattern: /\bquote[\s_-]*slot[\s_-]*series?\b/, field: 'series' },
  { pattern: /\bquote[\s_-]*slot[\s_-]*glass\b/, field: 'glass' },
  { pattern: /\bquote[\s_-]*slot[\s_-]*color\b/, field: 'color' },
]

const QUOTE_HANDOFF_TAG_PATTERNS = [
  /\bquote[\s_-]*(?:close|closure|complete)[\s_-]*handoff\b/,
  /\bquote[\s_-]*handoff\b/,
]

const IMPLICIT_SINGLE_ITEM_QUOTE_PATTERNS = [
  /\b(un|una)\b/iu,
  /\buna\s+(?:corrediza|batiente|ventana|puerta|cortina|roller|persiana)\b/iu,
]

const DEFAULT_MEASUREMENT_CARRIER_TERMS = [
  'ventana',
  'ventanas',
  'puerta',
  'puertas',
  'vano',
  'vanos',
  'hueco',
  'huecos',
  'paño',
  'paños',
  'pano',
  'panos',
]

const DEFAULT_LINE_ITEM_TERMS = ['unidad', 'unidades', 'item', 'items', 'pieza', 'piezas']

const normalizeQuoteProfileTag = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const normalizeQuoteProfileText = (value) =>
  compactText(
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]+/g, ' '),
  )

const normalizeUnit = (value) => {
  const normalized = normalizeText(value)
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

const normalizeTag = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const extractQuoteRequirementFieldsFromTags = (tags = []) => {
  const fields = new Set()
  for (const tag of Array.isArray(tags) ? tags : []) {
    const normalizedTag = normalizeTag(tag)
    for (const entry of QUOTE_REQUIREMENT_TAG_PATTERNS) {
      if (entry.pattern.test(normalizedTag)) {
        fields.add(entry.field)
      }
    }
  }
  return Array.from(fields)
}

const extractQuoteSlotFieldFromTags = (tags = []) => {
  for (const tag of Array.isArray(tags) ? tags : []) {
    const normalizedTag = normalizeTag(tag)
    for (const entry of QUOTE_SLOT_TAG_PATTERNS) {
      if (entry.pattern.test(normalizedTag)) {
        return entry.field
      }
    }
  }
  return null
}

const resolveQuoteClosureModeFromTags = (tags = []) =>
  (Array.isArray(tags) ? tags : []).some((tag) =>
    QUOTE_HANDOFF_TAG_PATTERNS.some((pattern) => pattern.test(normalizeTag(tag))),
  )
    ? 'collect_then_handoff'
    : null

const dedupeNormalizedTexts = (values = []) => {
  const seen = new Set()
  const result = []
  for (const value of values) {
    const normalized = normalizeQuoteProfileText(value)
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

const normalizeQuoteProfileAttributeOptions = (options = []) =>
  Array.isArray(options)
    ? options
        .map((entry) => {
          if (typeof entry === 'string') {
            const normalized = normalizeQuoteProfileText(entry)
            if (!normalized) {
              return null
            }
            return {
              value: normalized,
              aliases: [normalized],
            }
          }

          if (!entry || typeof entry !== 'object') {
            return null
          }

          const value = normalizeQuoteProfileText(entry.value)
          if (!value) {
            return null
          }
          return {
            value,
            aliases: dedupeNormalizedTexts([value, ...(Array.isArray(entry.aliases) ? entry.aliases : [])]),
          }
        })
        .filter(Boolean)
    : []

const normalizeQuoteProfiles = (profiles = []) =>
  Array.isArray(profiles)
    ? profiles
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => {
          const attributes = Array.isArray(entry.attributes)
            ? entry.attributes
                .map((attribute) => {
                  if (!attribute || typeof attribute !== 'object') {
                    return null
                  }
                  const key =
                    typeof attribute.key === 'string' && attribute.key.trim()
                      ? attribute.key.trim().toLowerCase()
                      : null
                  if (!key) {
                    return null
                  }

                  const rawCaptureKind =
                    typeof attribute.captureKind === 'string'
                      ? attribute.captureKind.trim()
                      : key === 'measurements'
                        ? 'measurements'
                        : key === 'quantity'
                          ? 'quantity'
                          : attribute.taxonomyTag
                            ? 'taxonomy_tag'
                            : 'enum'
                  const captureKind = new Set([
                    'measurements',
                    'quantity',
                    'taxonomy_tag',
                    'enum',
                  ]).has(rawCaptureKind)
                    ? rawCaptureKind
                    : 'enum'

                  return {
                    key,
                    label:
                      typeof attribute.label === 'string' && attribute.label.trim()
                        ? attribute.label.trim()
                        : key.replace(/_/g, ' '),
                    required: attribute.required !== false,
                    captureKind,
                    taxonomyTag:
                      typeof attribute.taxonomyTag === 'string' && attribute.taxonomyTag.trim()
                        ? normalizeQuoteProfileTag(attribute.taxonomyTag)
                        : null,
                    options: normalizeQuoteProfileAttributeOptions(attribute.options),
                    subjectPrefix:
                      typeof attribute.subjectPrefix === 'string' &&
                      attribute.subjectPrefix.trim()
                        ? attribute.subjectPrefix.trim()
                        : null,
                  }
                })
                .filter(Boolean)
            : []

          return {
            key:
              typeof entry.key === 'string' && entry.key.trim()
                ? entry.key.trim()
                : '',
            label:
              typeof entry.label === 'string' && entry.label.trim()
                ? entry.label.trim()
                : '',
            appliesToTopicKeys: Array.isArray(entry.appliesToTopicKeys)
              ? entry.appliesToTopicKeys
                  .filter((value) => typeof value === 'string' && value.trim())
                  .map((value) => value.trim())
              : [],
            appliesToTopicLabels: dedupeNormalizedTexts(entry.appliesToTopicLabels),
            familyLabel:
              typeof entry.familyLabel === 'string' && entry.familyLabel.trim()
                ? normalizeQuoteProfileText(entry.familyLabel)
                : null,
            pricingStrategy:
              entry.pricingStrategy === 'immediate_unit_price' ||
              entry.pricingStrategy === 'immediate_square_meter' ||
              entry.pricingStrategy === 'parametric_exact_or_handoff' ||
              entry.pricingStrategy === 'handoff_only'
                ? entry.pricingStrategy
                : entry.closureMode === 'collect_then_handoff'
                  ? 'handoff_only'
                  : 'parametric_exact_or_handoff',
            closureMode:
              entry.closureMode === 'collect_then_handoff'
                ? 'collect_then_handoff'
                : 'collect_then_price_or_handoff',
            measurementCarrierTerms: dedupeNormalizedTexts([
              ...DEFAULT_MEASUREMENT_CARRIER_TERMS,
              ...(Array.isArray(entry.measurementCarrierTerms)
                ? entry.measurementCarrierTerms
                : []),
            ]),
            attributes,
          }
        })
        .filter((entry) => entry.key && entry.label && entry.attributes.length > 0)
    : []

const collectTopicMatchSignals = (topic, tenantTopicTaxonomy = []) => {
  if (!topic?.label) {
    return {
      directKind: null,
      directKey: null,
      preferredTopicKey: null,
      preferredTopicLabel: null,
      keys: [],
      labels: [],
      familyLabel: null,
    }
  }

  const directMatch = findBestTenantTopicMatch(topic.label, tenantTopicTaxonomy, {
    kinds: ['product_family', 'product_topic', 'product_variant'],
  })
  const familyLabel =
    normalizeQuoteProfileText(
      topic.familyLabel || directMatch?.familyLabel || (directMatch?.kind === 'product_family' ? directMatch.label : ''),
    ) || null
  const preferredTopicKey =
    directMatch?.kind === 'product_variant'
      ? (Array.isArray(directMatch?.parentKeys)
          ? directMatch.parentKeys.find((entry) =>
              String(entry || '').startsWith('product_topic:'),
            ) || null
          : null)
      : directMatch?.kind === 'product_topic'
        ? directMatch.key
        : null
  const preferredTopicLabel =
    directMatch?.kind === 'product_variant'
      ? (Array.isArray(directMatch?.parentLabels)
          ? directMatch.parentLabels.find(Boolean) || null
          : null)
      : directMatch?.kind === 'product_topic'
        ? directMatch.label
        : null
  const labels = dedupeNormalizedTexts([
    topic.label,
    topic.familyLabel,
    directMatch?.label,
    directMatch?.familyLabel,
    ...(Array.isArray(directMatch?.parentLabels) ? directMatch.parentLabels : []),
  ])
  const keys = Array.from(
    new Set(
      [
        directMatch?.key,
        ...(Array.isArray(directMatch?.parentKeys) ? directMatch.parentKeys : []),
      ].filter(Boolean),
    ),
  )

  return {
    directKind: directMatch?.kind || null,
    directKey: directMatch?.key || null,
    preferredTopicKey,
    preferredTopicLabel:
      normalizeQuoteProfileText(preferredTopicLabel) || null,
    keys,
    labels,
    familyLabel,
  }
}

const getQuoteProfileSpecificityScore = (profile = null) => {
  const topicKeys = Array.isArray(profile?.appliesToTopicKeys)
    ? profile.appliesToTopicKeys
    : []

  if (topicKeys.some((key) => String(key || '').startsWith('product_variant:'))) {
    return 4
  }
  if (topicKeys.some((key) => String(key || '').startsWith('product_topic:'))) {
    return 3
  }
  if (topicKeys.some((key) => String(key || '').startsWith('product_family:'))) {
    return 2
  }
  return profile?.familyLabel ? 1 : 0
}

const resolveQuoteProfileForContext = ({
  topic = null,
  previousTopic = null,
  previousQuoteContext = null,
  quoteProfiles = [],
  tenantTopicTaxonomy = [],
}) => {
  const normalizedProfiles = normalizeQuoteProfiles(quoteProfiles)
  if (!normalizedProfiles.length) {
    return null
  }

  const previousProfileKey =
    typeof previousQuoteContext?.profileKey === 'string'
      ? previousQuoteContext.profileKey
      : null
  const currentSignals = collectTopicMatchSignals(topic, tenantTopicTaxonomy)
  const previousSignals = collectTopicMatchSignals(previousTopic, tenantTopicTaxonomy)

  let bestProfile = null
  let bestScore = -1

  for (const profile of normalizedProfiles) {
    let score = 0
    const profileKeySet = new Set(profile.appliesToTopicKeys)
    const profileLabelSet = new Set(profile.appliesToTopicLabels)

    if (previousProfileKey && profile.key === previousProfileKey) {
      score += 4
    }
    if (
      currentSignals.preferredTopicKey &&
      profileKeySet.has(currentSignals.preferredTopicKey)
    ) {
      score += 220
    }
    if (
      currentSignals.preferredTopicLabel &&
      profileLabelSet.has(currentSignals.preferredTopicLabel)
    ) {
      score += 160
    }
    if (currentSignals.directKey && profileKeySet.has(currentSignals.directKey)) {
      score += currentSignals.directKind === 'product_topic' ? 180 : 120
    }
    if (currentSignals.keys.some((key) => profileKeySet.has(key))) {
      score += 120
    }
    if (currentSignals.labels.some((label) => profileLabelSet.has(label))) {
      score += 80
    }
    if (profile.familyLabel && currentSignals.familyLabel === profile.familyLabel) {
      score += 36
    }
    if (
      previousSignals.preferredTopicKey &&
      profileKeySet.has(previousSignals.preferredTopicKey)
    ) {
      score += 72
    }
    if (previousSignals.keys.some((key) => profileKeySet.has(key))) {
      score += 24
    }
    if (previousSignals.labels.some((label) => profileLabelSet.has(label))) {
      score += 18
    }
    if (profile.familyLabel && previousSignals.familyLabel === profile.familyLabel) {
      score += 8
    }

    const specificity = getQuoteProfileSpecificityScore(profile)
    const currentBestSpecificity = getQuoteProfileSpecificityScore(bestProfile)

    if (
      score > bestScore ||
      (score === bestScore && specificity > currentBestSpecificity)
    ) {
      bestScore = score
      bestProfile = profile
    }
  }

  return bestScore > 0 ? bestProfile : null
}

const canReusePreviousQuoteData = ({
  topic = null,
  previousQuoteContext = null,
  activeProfile = null,
}) => {
  if (!previousQuoteContext || typeof previousQuoteContext !== 'object') {
    return false
  }

  if (!topic?.label) {
    return true
  }

  const currentTopicLabel = normalizeQuoteProfileText(topic.label)
  const previousTopicLabel = normalizeQuoteProfileText(previousQuoteContext.topicLabel)
  if (currentTopicLabel && previousTopicLabel && currentTopicLabel === previousTopicLabel) {
    return true
  }

  const currentProfileKey =
    typeof activeProfile?.key === 'string' ? activeProfile.key.trim() : ''
  const previousProfileKey =
    typeof previousQuoteContext.profileKey === 'string'
      ? previousQuoteContext.profileKey.trim()
      : ''
  return Boolean(currentProfileKey && previousProfileKey && currentProfileKey === previousProfileKey)
}

const resolveQuoteTopicProfile = ({
  topic = null,
  quoteProfiles = [],
  tenantTopicTaxonomy = [],
}) => {
  if (!topic || typeof topic !== 'object' || !topic.label) {
    return null
  }

  const explicitProfile = resolveQuoteProfileForContext({
    topic,
    previousTopic: null,
    previousQuoteContext: null,
    quoteProfiles,
    tenantTopicTaxonomy,
  })
  if (explicitProfile) {
    return explicitProfile
  }

  const requiresMeasurements = topicRequiresMeasurements(topic, tenantTopicTaxonomy)
  return buildFallbackQuoteProfile({
    topic,
    previousTopic: null,
    tenantTopicTaxonomy,
    requiresMeasurements,
  })
}

const buildFallbackQuoteProfile = ({
  topic = null,
  previousTopic = null,
  tenantTopicTaxonomy = [],
  requiresMeasurements = false,
}) => {
  const relevantMatches = resolveQuoteRelevantMatches({
    topic,
    previousTopic,
    tenantTopicTaxonomy,
  })
  const requirements = resolveQuoteRequirements(relevantMatches, requiresMeasurements)
  if (!requirements.requiredFields.length && !requiresMeasurements) {
    return null
  }

  const attributes = requirements.requiredFields.map((field) => ({
    key: field,
    label:
      field === 'measurements'
        ? 'las medidas aproximadas (ancho por alto)'
        : field === 'quantity'
          ? 'cuántas unidades necesitás'
          : field === 'series'
            ? 'la serie'
            : field === 'glass'
              ? 'el tipo de vidrio'
              : field === 'color'
                ? 'el color'
                : field,
    required: true,
    captureKind:
      field === 'measurements'
        ? 'measurements'
        : field === 'quantity'
          ? 'quantity'
          : field === 'series'
            ? 'taxonomy_tag'
            : field === 'glass'
              ? 'taxonomy_tag'
              : 'enum',
    taxonomyTag:
      field === 'series'
        ? 'quote_slot_series'
        : field === 'glass'
          ? 'quote_slot_glass'
          : field === 'color'
            ? 'quote_slot_color'
            : null,
    options: [],
    subjectPrefix:
      field === 'series'
        ? 'serie'
        : field === 'glass'
          ? 'con'
          : field === 'color'
            ? 'color'
            : null,
  }))

  return {
    key: 'fallback:quote_profile',
    label: 'Perfil de cotización',
    appliesToTopicKeys: [],
    appliesToTopicLabels: [],
    familyLabel:
      normalizeQuoteProfileText(topic?.familyLabel || previousTopic?.familyLabel || '') ||
      null,
    pricingStrategy:
      requirements.closureMode === 'collect_then_handoff'
        ? 'handoff_only'
        : 'parametric_exact_or_handoff',
    closureMode: requirements.closureMode,
    measurementCarrierTerms: [...DEFAULT_MEASUREMENT_CARRIER_TERMS],
    attributes,
  }
}

const buildLineItemQuantityRegex = (lineItemTerms = []) => {
  const terms = Array.from(
    new Set([
      ...DEFAULT_LINE_ITEM_TERMS,
      ...DEFAULT_MEASUREMENT_CARRIER_TERMS,
      ...dedupeNormalizedTexts(lineItemTerms),
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
      ...dedupeNormalizedTexts(lineItemTerms),
    ]),
  ).sort((left, right) => right.length - left.length)

  const escapedTerms = terms
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  const quantitySeparatorFragment = escapedTerms
    ? `(?:\\s+(?:${escapedTerms})\\s*|\\s+)`
    : '\\s+'

  return new RegExp(
    `(?<![\\d.,])(\\d{1,4})${quantitySeparatorFragment}(?:de\\s+)?(${DIMENSION_VALUE_SOURCE})\\s*(${DIMENSION_UNIT_SOURCE})?\\s*[x×]\\s*(${DIMENSION_VALUE_SOURCE})\\s*(${DIMENSION_UNIT_SOURCE})?`,
    'giu',
  )
}

const extractProfileEnumAttributeValue = (value, attribute) => {
  const normalized = normalizeQuoteProfileText(value)
  if (!normalized || !Array.isArray(attribute?.options)) {
    return null
  }

  let bestOption = null
  let bestAlias = null
  for (const option of attribute.options) {
    for (const alias of Array.isArray(option?.aliases) ? option.aliases : []) {
      if (!alias) {
        continue
      }
      const matcher = new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu')
      if (matcher.test(normalized) && (!bestAlias || alias.length > bestAlias.length)) {
        bestOption = option
        bestAlias = alias
      }
    }
  }

  return bestOption
    ? {
        value: bestOption.value,
        label: bestOption.value,
        source: 'profile_enum',
      }
    : null
}

const extractProfileTaxonomyAttributeValue = (
  value,
  attribute,
  tenantTopicTaxonomy = [],
) => {
  if (!attribute?.taxonomyTag) {
    return null
  }

  const normalizedTag = normalizeQuoteProfileTag(attribute.taxonomyTag)
  const matches = findTenantTopicMatches(value, tenantTopicTaxonomy, {
    kinds: ['product_variant', 'product_topic', 'product_family'],
    limit: 12,
  })

  const match = matches.find((entry) =>
    (Array.isArray(entry?.tags) ? entry.tags : []).some(
      (tag) => normalizeQuoteProfileTag(tag) === normalizedTag,
    ),
  )

  return match
    ? {
        value: match.label,
        label: match.label,
        source: 'topic_taxonomy',
      }
    : null
}

const topicRequiresMeasurements = (topic, tenantTopicTaxonomy = []) => {
  if (!topic?.label) {
    return false
  }

  const directMatch = findBestTenantTopicMatch(topic.label, tenantTopicTaxonomy, {
    kinds: ['product_family', 'product_topic', 'product_variant'],
  })
  const matches = [
    directMatch,
    directMatch?.familyLabel
      ? findBestTenantTopicMatch(directMatch.familyLabel, tenantTopicTaxonomy, {
          kinds: ['product_family'],
        })
      : null,
    topic?.familyLabel
      ? findBestTenantTopicMatch(topic.familyLabel, tenantTopicTaxonomy, {
          kinds: ['product_family'],
        })
      : null,
  ].filter(Boolean)

  return matches.some((match) =>
    (Array.isArray(match?.tags) ? match.tags : []).some((tag) =>
      QUOTE_MEASUREMENT_TAG_PATTERNS.some((pattern) => pattern.test(normalizeTag(tag))),
    ),
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

const extractLineItemQuantity = (line, lineItemTerms = []) => {
  const match = compactText(line).match(buildLineItemQuantityRegex(lineItemTerms))
  if (!match?.[1]) {
    return null
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
    const measurement = extractMeasurementPair(line)
    if (!measurement) {
      continue
    }

    const fingerprint = `${measurement.widthMm}:${measurement.heightMm}:${measurement.rawMatch}`
    if (seen.has(fingerprint)) {
      continue
    }
    seen.add(fingerprint)

    items.push({
      ...measurement,
      quantity: extractLineItemQuantity(line, lineItemTerms),
      lineNumber: index + 1,
    })
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
    return compactText(leadLines.join(' ')) || compactValue
  }

  const cutIndex = findFirstPatternIndex(compactValue, [
    DIMENSION_PAIR_REGEX,
    ...MEASUREMENT_SECTION_INTRO_PATTERNS,
  ])
  if (cutIndex != null && cutIndex > 0) {
    return compactText(compactValue.slice(0, cutIndex)) || compactValue
  }

  return compactValue
}

export const extractCustomerQuotedQuantity = (
  value,
  measurementItems = [],
  options = {},
) => {
  const lineItemTerms = Array.isArray(options?.lineItemTerms)
    ? options.lineItemTerms
    : []
  const leadText = extractCustomerQuoteLeadText(value)
  const fullText = compactText(value)
  const quantitySearchTargets = dedupeNormalizedTexts([leadText, fullText])
  let explicitQuantity = null
  for (const sourceText of quantitySearchTargets) {
    for (const pattern of EXPLICIT_TOTAL_QUANTITY_PATTERNS) {
      const match = sourceText.match(pattern)
      if (match?.[1]) {
        const total = Number(match[1])
        if (Number.isInteger(total) && total > 0) {
          explicitQuantity = {
            total,
            source: sourceText === leadText ? 'explicit_total' : 'explicit_total_full_text',
          }
          break
        }
      }
    }
    if (explicitQuantity) {
      break
    }
  }

  if (options?.allowBareQuantity) {
    const bareQuantityMatch = leadText.match(BARE_QUANTITY_FOLLOW_UP_REGEX)
    if (bareQuantityMatch?.[1]) {
      const total = Number(bareQuantityMatch[1])
      if (Number.isInteger(total) && total > 0) {
        return {
          total,
          source: 'bare_follow_up',
        }
      }
    }
  }

  const summedQuantity = measurementItems.reduce((accumulator, item) => {
    const quantity = Number(item?.quantity)
    return Number.isInteger(quantity) && quantity > 0 ? accumulator + quantity : accumulator
  }, 0)
  if (summedQuantity > 0) {
    if (
      explicitQuantity &&
      Number.isInteger(explicitQuantity.total) &&
      explicitQuantity.total > 0 &&
      summedQuantity <= explicitQuantity.total
    ) {
      return explicitQuantity
    }

    return {
      total: summedQuantity,
      source: 'measurement_items',
    }
  }

  if (explicitQuantity) {
    return explicitQuantity
  }

  for (const sourceText of quantitySearchTargets) {
    const inlineQuantity = extractLineItemQuantity(sourceText, lineItemTerms)
    if (inlineQuantity) {
      return {
        total: inlineQuantity,
        source: sourceText === leadText ? 'inline_line_item' : 'inline_line_item_full_text',
      }
    }
  }

  return null
}

const buildMentionedQuoteTopics = (
  value,
  tenantTopicTaxonomy = [],
  options = {},
) => {
  const leadText = extractCustomerQuoteLeadText(value)
  const normalizedLeadText = normalizeText(leadText)
  const measurementCarrierTerms = new Set(
    dedupeNormalizedTexts([
      ...DEFAULT_MEASUREMENT_CARRIER_TERMS,
      ...(Array.isArray(options?.measurementCarrierTerms)
        ? options.measurementCarrierTerms
        : []),
    ]),
  )
  const matches = findTenantTopicMatches(leadText, tenantTopicTaxonomy, {
    kinds: ['product_family', 'product_topic'],
    limit: 8,
  })
  const mentioned = []
  const seen = new Set()

  for (const match of matches) {
    const matchedAlias = normalizeText(match.matchedAlias || '')
    if (
      match.kind === 'product_family' &&
      measurementCarrierTerms.has(matchedAlias)
    ) {
      continue
    }

    if (
      match.kind === 'product_family' &&
      matches.some(
        (entry) =>
          entry !== match &&
          entry.kind === 'product_topic' &&
          normalizeText(entry.familyLabel || '') === normalizeText(match.label),
      )
    ) {
      continue
    }

    if (
      match.kind === 'product_topic' &&
      matches.some((entry) => entry.kind === 'product_family') &&
      isContextualTopicDescriptorMatch(match, normalizedLeadText)
    ) {
      continue
    }

    const fingerprint = `${match.kind}:${normalizeText(match.label)}`
    if (seen.has(fingerprint)) {
      continue
    }

    seen.add(fingerprint)
    mentioned.push({
      key: match.key,
      label: match.label,
      kind: match.kind,
      familyLabel: match.familyLabel || (match.kind === 'product_family' ? match.label : null),
    })
  }

  return mentioned
}

const resolveQuoteRelevantMatches = ({
  topic = null,
  previousTopic = null,
  tenantTopicTaxonomy = [],
}) => {
  const matches = []
  const seen = new Set()
  const pushMatch = (value, kinds = ['product_family', 'product_topic', 'product_variant']) => {
    const match = value
      ? findBestTenantTopicMatch(value, tenantTopicTaxonomy, {
          kinds,
        })
      : null
    if (!match || seen.has(match.key)) {
      return
    }
    seen.add(match.key)
    matches.push(match)
    return match
  }

  const currentMatch = pushMatch(topic?.label)
  pushMatch(topic?.familyLabel || currentMatch?.familyLabel, ['product_family'])
  const previousMatch = pushMatch(previousTopic?.label)
  pushMatch(previousTopic?.familyLabel || previousMatch?.familyLabel, ['product_family'])

  return matches
}

const resolveQuoteRequirements = (matches = [], fallbackRequiresMeasurements = false) => {
  const fields = new Set()
  let closureMode = null

  for (const match of matches) {
    for (const field of extractQuoteRequirementFieldsFromTags(match?.tags)) {
      fields.add(field)
    }
    closureMode ||= resolveQuoteClosureModeFromTags(match?.tags)
  }

  if (!fields.size && fallbackRequiresMeasurements) {
    fields.add('measurements')
  }

  return {
    requiredFields: Array.from(fields),
    closureMode: closureMode || 'collect_then_price_or_handoff',
  }
}

const sanitizeQuoteProfileAttribute = (attribute) => ({
  key: attribute.key,
  label: attribute.label,
  required: attribute.required !== false,
  captureKind: attribute.captureKind,
  subjectPrefix: attribute.subjectPrefix || null,
})

const resolveQuoteCapturedAttributes = ({
  currentTurnText,
  quoteProfile,
  previousQuoteContext = null,
  tenantTopicTaxonomy = [],
  measurements = null,
  quantity = null,
}) => {
  const previousCaptured =
    previousQuoteContext?.capturedAttributes &&
    typeof previousQuoteContext.capturedAttributes === 'object'
      ? previousQuoteContext.capturedAttributes
      : {}
  const captured = {}

  for (const attribute of Array.isArray(quoteProfile?.attributes)
    ? quoteProfile.attributes
    : []) {
    let currentValue = null
    if (attribute.captureKind === 'measurements' && measurements) {
      currentValue = {
        value: measurements,
        label:
          measurements.confirmationLabel || measurements.displayLabel || null,
        source: measurements.source || 'message_dimensions',
      }
    } else if (attribute.captureKind === 'quantity' && quantity?.total) {
      currentValue = {
        value: quantity.total,
        label: String(quantity.total),
        source: quantity.source || 'message_quantity',
      }
    } else if (attribute.captureKind === 'taxonomy_tag') {
      currentValue = extractProfileTaxonomyAttributeValue(
        currentTurnText,
        attribute,
        tenantTopicTaxonomy,
      )
    } else if (attribute.captureKind === 'enum') {
      currentValue = extractProfileEnumAttributeValue(currentTurnText, attribute)
    }

    if (currentValue) {
      captured[attribute.key] = currentValue
      continue
    }

    const previousValue = previousCaptured?.[attribute.key]
    if (
      previousValue &&
      typeof previousValue === 'object' &&
      previousValue.value !== undefined
    ) {
      captured[attribute.key] = previousValue
    }
  }

  return captured
}

const inferSingleConfiguredItemQuantity = ({
  currentTurnText,
  measurementItems = [],
  existingQuantity = null,
  capturedAttributes = {},
  mentionedTopics = [],
  topic = null,
  tenantTopicTaxonomy = [],
}) => {
  if (existingQuantity || measurementItems.length !== 1) {
    return null
  }

  const leadText = extractCustomerQuoteLeadText(currentTurnText)
  const normalizedLeadText = normalizeText(leadText)
  if (!normalizedLeadText) {
    return null
  }

  const hasSingularCue = IMPLICIT_SINGLE_ITEM_QUOTE_PATTERNS.some((pattern) =>
    pattern.test(leadText),
  )
  if (!hasSingularCue) {
    return null
  }

  const directMatches = findTenantTopicMatches(leadText, tenantTopicTaxonomy, {
    kinds: ['product_family', 'product_topic', 'product_variant'],
    limit: 4,
  })
  const hasTopicSignal =
    Boolean(topic?.label) ||
    directMatches.length > 0 ||
    (Array.isArray(mentionedTopics) && mentionedTopics.length > 0)
  const hasConfigurationSignal = Object.entries(capturedAttributes).some(
    ([key, value]) =>
      key !== 'measurements' &&
      key !== 'quantity' &&
      value &&
      typeof value === 'object' &&
      value.value !== undefined,
  )

  if (!hasTopicSignal && !hasConfigurationSignal) {
    return null
  }

  return {
    total: 1,
    source: 'implicit_single_item',
  }
}

export const buildCustomerQuoteContext = ({
  currentTurnText,
  topic = null,
  previousTopic = null,
  previousQuoteContext = null,
  tenantTopicTaxonomy = [],
  tenantQuoteProfiles = [],
}) => {
  const activeTopic =
    topic && typeof topic === 'object' && topic.label
      ? topic
      : previousTopic && typeof previousTopic === 'object' && previousTopic.label
        ? previousTopic
        : null

  const requiresMeasurements =
    topicRequiresMeasurements(topic, tenantTopicTaxonomy) ||
    topicRequiresMeasurements(previousTopic, tenantTopicTaxonomy) ||
    Boolean(previousQuoteContext?.requiresMeasurements)
  const activeProfile =
    resolveQuoteProfileForContext({
      topic,
      previousTopic,
      previousQuoteContext,
      quoteProfiles: tenantQuoteProfiles,
      tenantTopicTaxonomy,
    }) ||
    buildFallbackQuoteProfile({
      topic,
      previousTopic,
      tenantTopicTaxonomy,
      requiresMeasurements,
    })
  const measurementCarrierTerms = Array.isArray(activeProfile?.measurementCarrierTerms)
    ? activeProfile.measurementCarrierTerms
    : [...DEFAULT_MEASUREMENT_CARRIER_TERMS]
  const extractedMeasurementItems = extractCustomerQuotedMeasurementItems(currentTurnText, {
    lineItemTerms: measurementCarrierTerms,
  })
  const extractedMeasurements =
    extractedMeasurementItems.length > 0
      ? {
          widthMm: extractedMeasurementItems[0].widthMm,
          heightMm: extractedMeasurementItems[0].heightMm,
          displayUnit: extractedMeasurementItems[0].displayUnit,
          displayLabel: extractedMeasurementItems[0].displayLabel,
          confirmationLabel: extractedMeasurementItems[0].confirmationLabel,
          rawMatch: extractedMeasurementItems[0].rawMatch,
          source: extractedMeasurementItems[0].source,
        }
      : null
  const activeTopicMatch = activeTopic?.label
    ? findBestTenantTopicMatch(activeTopic.label, tenantTopicTaxonomy, {
        kinds: ['product_family', 'product_topic', 'product_variant'],
      })
    : null
  const shouldReusePreviousQuoteData = canReusePreviousQuoteData({
    topic,
    previousQuoteContext,
    activeProfile,
  })
  const measurementItems =
    extractedMeasurementItems.length > 0
      ? extractedMeasurementItems
      : shouldReusePreviousQuoteData && Array.isArray(previousQuoteContext?.measurementItems)
        ? previousQuoteContext.measurementItems
        : []
  const measurements =
    extractedMeasurements ||
    (shouldReusePreviousQuoteData &&
    previousQuoteContext?.measurements &&
    typeof previousQuoteContext.measurements === 'object'
      ? previousQuoteContext.measurements
      : null)
  const allowBareQuantityFollowUp =
    Boolean(measurements || measurementItems.length > 0) &&
    Boolean(
      Array.isArray(activeProfile?.attributes) &&
        activeProfile.attributes.some(
          (attribute) => attribute?.key === 'quantity' && attribute.required !== false,
        ),
    )
  const quantity =
    extractCustomerQuotedQuantity(currentTurnText, measurementItems, {
      lineItemTerms: measurementCarrierTerms,
      allowBareQuantity: allowBareQuantityFollowUp,
    }) ||
    (shouldReusePreviousQuoteData &&
    previousQuoteContext?.quantity &&
    typeof previousQuoteContext.quantity === 'object'
      ? previousQuoteContext.quantity
      : null)
  const mentionedTopics = buildMentionedQuoteTopics(currentTurnText, tenantTopicTaxonomy, {
    measurementCarrierTerms,
  })
  const preferredSpecificMentionedTopic =
    mentionedTopics.find((entry) =>
      ['product_topic', 'product_variant'].includes(String(entry?.kind || '')),
    ) || null
  const multiTopic = mentionedTopics.length > 1
  const mentionedProfiles = mentionedTopics
    .map((mentionedTopic) =>
      resolveQuoteTopicProfile({
        topic: mentionedTopic,
        quoteProfiles: tenantQuoteProfiles,
        tenantTopicTaxonomy,
      }),
    )
    .filter((entry) => entry && typeof entry === 'object')
  const mentionedPricingStrategies = dedupeNormalizedTexts(
    mentionedProfiles
      .map((profile) =>
        typeof profile?.pricingStrategy === 'string' && profile.pricingStrategy.trim()
          ? profile.pricingStrategy.trim()
          : profile?.closureMode === 'collect_then_handoff'
            ? 'handoff_only'
            : 'parametric_exact_or_handoff',
      )
      .filter(Boolean),
  )
  const mixedPricingStrategies = mentionedPricingStrategies.length > 1
  const capturedAttributes = resolveQuoteCapturedAttributes({
    currentTurnText,
    quoteProfile: activeProfile,
    previousQuoteContext: shouldReusePreviousQuoteData ? previousQuoteContext : null,
    tenantTopicTaxonomy,
    measurements,
    quantity,
  })
  const effectiveQuantity =
    quantity ||
    inferSingleConfiguredItemQuantity({
      currentTurnText,
      measurementItems,
      existingQuantity: quantity,
      capturedAttributes,
      mentionedTopics,
      topic,
      tenantTopicTaxonomy,
    })
  if (effectiveQuantity?.total && !capturedAttributes.quantity) {
    capturedAttributes.quantity = {
      value: effectiveQuantity.total,
      label: String(effectiveQuantity.total),
      source: effectiveQuantity.source || 'message_quantity',
    }
  }
  if (measurements && !capturedAttributes.measurements) {
    capturedAttributes.measurements = {
      value: measurements,
      label: measurements.confirmationLabel || measurements.displayLabel || null,
      source: measurements.source || 'message_dimensions',
    }
  }

  const profileAttributes = Array.isArray(activeProfile?.attributes)
    ? activeProfile.attributes.map(sanitizeQuoteProfileAttribute)
    : []
  const requiredAttributes = profileAttributes.filter(
    (attribute) => attribute.required !== false,
  )

  if (
    !requiresMeasurements &&
    !measurements &&
    !effectiveQuantity &&
    !Object.keys(capturedAttributes).length &&
    !multiTopic
  ) {
    return null
  }

  const capturedFields = Object.fromEntries(
    profileAttributes.map((attribute) => [
      attribute.key,
      Boolean(
        capturedAttributes?.[attribute.key] &&
          capturedAttributes[attribute.key].value !== undefined &&
          capturedAttributes[attribute.key].value !== null &&
          capturedAttributes[attribute.key].value !== '',
      ),
    ]),
  )
  const missingAttributes = requiredAttributes.filter(
    (attribute) => !capturedFields[attribute.key],
  )
  const missingFields = missingAttributes.map((attribute) => attribute.key)
  const multiItem =
    measurementItems.length > 1 || Number(effectiveQuantity?.total || 0) > 1
  const profileResolved = Boolean(
    activeProfile && !String(activeProfile.key || '').startsWith('fallback:'),
  )
  const rawPricingStrategy =
    activeProfile?.pricingStrategy ||
    (activeProfile?.closureMode === 'collect_then_handoff'
      ? 'handoff_only'
      : 'parametric_exact_or_handoff')
  const pricingStrategy = mixedPricingStrategies ? 'handoff_only' : rawPricingStrategy
  const supportsImmediatePricing =
    profileResolved &&
    (pricingStrategy === 'immediate_unit_price' ||
      pricingStrategy === 'immediate_square_meter' ||
      pricingStrategy === 'parametric_exact_or_handoff')
  const topicRecognized = Boolean(
    activeTopicMatch ||
      (profileResolved &&
        activeProfile &&
        (activeProfile.appliesToTopicKeys.length > 0 ||
          activeProfile.appliesToTopicLabels.length > 0 ||
          activeProfile.familyLabel)),
  )
  const completionStatus =
    (multiTopic && !mixedPricingStrategies) || !topicRecognized || missingFields.length > 0
      ? 'needs_info'
      : mixedPricingStrategies &&
          measurementItems.length === 0 &&
          !(Number(effectiveQuantity?.total || 0) > 0)
        ? 'needs_info'
        : !supportsImmediatePricing
        ? 'ready_for_handoff'
        : 'ready_for_pricing_or_handoff'

  return {
    requiresMeasurements,
    topicRecognized,
    familyLabel:
      preferredSpecificMentionedTopic?.familyLabel ||
      activeTopic?.familyLabel ||
      activeTopicMatch?.familyLabel ||
      (activeTopicMatch?.kind === 'product_family' ? activeTopicMatch.label : null) ||
      previousQuoteContext?.familyLabel ||
      null,
    topicLabel:
      preferredSpecificMentionedTopic?.label ||
      activeTopic?.label ||
      previousQuoteContext?.topicLabel ||
      null,
    profileKey: activeProfile?.key || null,
    profileLabel: activeProfile?.label || null,
    profileResolved,
    requiredFields: requiredAttributes.map((attribute) => attribute.key),
    requiredAttributes,
    profileAttributes,
    pricingStrategy,
    rawPricingStrategy,
    closureMode: activeProfile?.closureMode || 'collect_then_price_or_handoff',
    measurements,
    measurementItems,
    quantity: effectiveQuantity,
    capturedAttributes,
    series: capturedAttributes?.series?.value || null,
    glass: capturedAttributes?.glass?.value || null,
    color: capturedAttributes?.color?.value || null,
    capturedFields,
    mentionedTopics,
    mentionedProfiles: mentionedProfiles.map((profile) => ({
      key: profile.key,
      label: profile.label,
      pricingStrategy:
        typeof profile.pricingStrategy === 'string' && profile.pricingStrategy.trim()
          ? profile.pricingStrategy
          : profile.closureMode === 'collect_then_handoff'
            ? 'handoff_only'
            : 'parametric_exact_or_handoff',
      closureMode: profile.closureMode || 'collect_then_price_or_handoff',
      familyLabel: profile.familyLabel || null,
    })),
    mentionedPricingStrategies,
    mixedPricingStrategies,
    multiTopic,
    multiItem,
    completionStatus,
    missingAttributes,
    missingFields,
    measurementCarrierTerms,
    source: extractedMeasurements ? 'message_text' : previousQuoteContext?.source || 'conversation_memory',
  }
}

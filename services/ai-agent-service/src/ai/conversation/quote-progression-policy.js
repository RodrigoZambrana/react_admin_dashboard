const QUESTION_LIKE_REGEX =
  /[?¿]|\b(cu[aá]nto|que|qué|como|cómo|cu[aá]l|cuando|cuándo|pueden|podr[ií]an)\b/u
const QUOTE_SEED_INPUT_REGEX =
  /\b(?:necesit[a-záéíóúñ]*|precis[a-záéíóúñ]*|cotiz[a-záéíóúñ]*|presupuest[a-záéíóúñ]*|me interesa)\b/u

const CORE_QUOTE_FIELDS = ['product', 'quantity', 'measurements']

const normalizeText = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const buildQuoteProgressionPolicy = ({
  input = '',
  intentKey = null,
  turnIntent = null,
  quoteContext = null,
  followUp = null,
  missingFields = null,
  sideQuestionSubtype = null,
} = {}) => {
  const normalizedInput = normalizeText(input)
  const effectiveIntentKey = turnIntent || intentKey
  const measurementsCaptured = Boolean(
    quoteContext?.measurements ||
      (Array.isArray(quoteContext?.measurementItems) &&
        quoteContext.measurementItems.length > 0),
  )
  const quantityCaptured = Number(quoteContext?.quantity?.total || 0) > 0
  const productKnown = Boolean(
    quoteContext?.topicRecognized &&
      (
        quoteContext?.topicLabel ||
        quoteContext?.familyLabel ||
        quoteContext?.profileResolved
      ),
  )
  const completionStatus =
    typeof quoteContext?.completionStatus === 'string'
      ? quoteContext.completionStatus
      : null
  const followUpDetected = Boolean(followUp?.detected)
  const quantityOnlyFollowUp = Boolean(followUp?.quantityOnly)
  const measurementOnlyFollowUp = Boolean(followUp?.measurementOnly)
  const attributeOnlyFollowUp = Boolean(followUp?.attributeOnly)
  const attributeKeys = Array.isArray(followUp?.attributeKeys)
    ? Array.from(
        new Set(
          followUp.attributeKeys
            .filter((entry) => typeof entry === 'string')
            .map((entry) => String(entry).trim())
            .filter(Boolean),
        ),
      )
    : []
  const slotOnlyFollowUp =
    quantityOnlyFollowUp || measurementOnlyFollowUp || attributeOnlyFollowUp
  const waitingFollowUp = Boolean(followUp?.quoteWaiting)
  const quoteSeedDetected =
    effectiveIntentKey === 'customer.quote' || QUOTE_SEED_INPUT_REGEX.test(normalizedInput)
  const minimumContextComplete =
    productKnown && quantityCaptured && measurementsCaptured
  const allowQuoteAction =
    minimumContextComplete &&
    ['ready_for_pricing_or_handoff', 'ready_for_handoff'].includes(
      String(completionStatus || ''),
    )
  const missingRequiredFields = Array.isArray(missingFields)
    ? missingFields.filter((entry) => typeof entry === 'string')
    : Array.isArray(quoteContext?.missingFields)
      ? quoteContext.missingFields.filter((entry) => typeof entry === 'string')
      : []
  const missingCoreFields = CORE_QUOTE_FIELDS.filter((field) => {
    if (field === 'product') {
      return !productKnown
    }
    if (field === 'quantity') {
      return !quantityCaptured
    }
    return !measurementsCaptured
  })
  const preferInformationFirst =
    quoteSeedDetected &&
    productKnown &&
    !quantityCaptured &&
    !measurementsCaptured &&
    !slotOnlyFollowUp &&
    !waitingFollowUp &&
    !sideQuestionSubtype
  const topicOnlyExploration =
    productKnown &&
    !quoteSeedDetected &&
    !quantityCaptured &&
    !measurementsCaptured &&
    !slotOnlyFollowUp &&
    !waitingFollowUp &&
    !sideQuestionSubtype &&
    !QUESTION_LIKE_REGEX.test(normalizedInput) &&
    normalizedInput.split(/\s+/u).filter(Boolean).length <= 4
  const shouldHoldForRelatedInputs =
    followUpDetected &&
    slotOnlyFollowUp &&
    productKnown &&
    missingRequiredFields.length > 0 &&
    !allowQuoteAction &&
    !sideQuestionSubtype &&
    !QUESTION_LIKE_REGEX.test(normalizedInput)

  return {
    productKnown,
    quantityCaptured,
    measurementsCaptured,
    missingRequiredFields,
    missingCoreFields,
    minimumContextComplete,
    allowQuoteAction,
    preferInformationFirst,
    quoteSeedDetected,
    topicOnlyExploration,
    shouldHoldForRelatedInputs,
    slotOnlyFollowUp,
    attributeOnlyFollowUp,
    attributeKeys,
    quantityOnlyFollowUp,
    measurementOnlyFollowUp,
    waitingFollowUp,
    stage: preferInformationFirst
      ? 'information'
      : !productKnown
        ? 'intent_confirmation'
        : allowQuoteAction
          ? 'action'
          : 'data_collection',
  }
}

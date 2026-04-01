import { getConversationStatePolicy } from '../tenant-policy/runtime-tenant-policy.js'

const BASE_SLOT_KEYS = ['address', 'date', 'time', 'product', 'dimensions', 'quantity']

const BASE_FIELD_TO_SLOT_KEY = {
  address: 'address',
  day: 'date',
  date: 'date',
  time: 'time',
  topic: 'product',
  product: 'product',
  product_type: 'product',
  measurements: 'dimensions',
  quantity: 'quantity',
}

const BASE_FIELD_KEYS = new Set(Object.keys(BASE_FIELD_TO_SLOT_KEY))
const BASE_SLOT_KEY_SET = new Set(BASE_SLOT_KEYS)

const compactText = (value) =>
  typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : ''

const normalizeSubjectLabel = (value) =>
  compactText(
    String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]+/gu, ' '),
  )

const isMeaningfulValue = (value) =>
  (typeof value === 'string' && compactText(value).length > 0) ||
  (typeof value === 'number' && Number.isFinite(value))

const hasQuoteSlotContribution = (quoteContext = null) =>
  Boolean(
    quoteContext &&
      (
        quoteContext?.measurements ||
        (Array.isArray(quoteContext?.measurementItems) &&
          quoteContext.measurementItems.length > 0) ||
        Number(quoteContext?.quantity?.total || 0) > 0 ||
        (quoteContext?.capturedAttributes &&
          typeof quoteContext.capturedAttributes === 'object' &&
          Object.keys(quoteContext.capturedAttributes).length > 0)
      ),
  )

const isSlotKeyResolved = ({
  slotKey = null,
  baseSlots = {},
  tenantSlots = {},
} = {}) => {
  if (typeof slotKey !== 'string' || !slotKey.trim()) {
    return false
  }

  return (
    isMeaningfulValue(baseSlots?.[slotKey]?.value) ||
    isMeaningfulValue(tenantSlots?.[slotKey]?.value)
  )
}

const pickTextValue = (...values) =>
  values.map(compactText).find((value) => value.length > 0) || null

const pickNumericValue = (...values) =>
  values.find((value) => typeof value === 'number' && Number.isFinite(value)) ?? null

const buildMeasurementSlotValue = (quoteContext = null, previousValue = null) => {
  const directLabel = pickTextValue(
    quoteContext?.measurements?.confirmationLabel,
    quoteContext?.measurements?.displayLabel,
  )
  if (directLabel) {
    return directLabel
  }

  const measurementItems = Array.isArray(quoteContext?.measurementItems)
    ? quoteContext.measurementItems.filter((entry) => entry && typeof entry === 'object')
    : []
  const itemLabels = measurementItems
    .map((entry) => pickTextValue(entry?.displayLabel))
    .filter(Boolean)

  if (itemLabels.length) {
    return itemLabels.join(' · ')
  }

  return pickTextValue(previousValue)
}

const resolveConversationStage = ({
  answerMode = null,
  mode = null,
  missingSlots = [],
} = {}) => {
  if (
    ['confirm_schedule', 'continue_support_resolution', 'quote_ready', 'execute_flow'].includes(
      String(answerMode || ''),
    )
  ) {
    return 'execution'
  }

  if (
    ['light_turn'].includes(String(answerMode || '')) ||
    (String(mode || '') === 'small_talk' && missingSlots.length === 0)
  ) {
    return 'closing'
  }

  return 'exploration'
}

const resolveConversationStateConfig = ({
  tenantRuntimePolicy = null,
  previousConversationState = null,
  quoteContext = null,
} = {}) => {
  const previousNormalization =
    previousConversationState?.normalization &&
    typeof previousConversationState.normalization === 'object'
      ? previousConversationState.normalization
      : {}
  const policyConfig = getConversationStatePolicy(tenantRuntimePolicy)
  const policySlotAliases =
    policyConfig?.slotAliases && typeof policyConfig.slotAliases === 'object'
      ? policyConfig.slotAliases
      : {}
  const tenantSlots = Array.isArray(policyConfig?.tenantSlots)
    ? policyConfig.tenantSlots.filter((entry) => typeof entry === 'string' && entry.trim())
    : Array.isArray(previousNormalization?.tenantSlots)
      ? previousNormalization.tenantSlots.filter(
          (entry) => typeof entry === 'string' && entry.trim(),
        )
      : []
  const quoteAttributeTenantSlots = Array.from(
    new Set([
      ...(Array.isArray(quoteContext?.requiredAttributes)
        ? quoteContext.requiredAttributes
            .map((entry) => (typeof entry?.key === 'string' ? entry.key.trim() : ''))
            .filter(Boolean)
        : []),
      ...(quoteContext?.capturedAttributes && typeof quoteContext.capturedAttributes === 'object'
        ? Object.keys(quoteContext.capturedAttributes)
            .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
            .filter(Boolean)
        : []),
    ]),
  ).filter(
    (slotKey) => !BASE_SLOT_KEY_SET.has(slotKey) && !BASE_FIELD_KEYS.has(slotKey),
  )
  const normalizedTenantSlots = Array.from(
    new Set([...tenantSlots, ...quoteAttributeTenantSlots]),
  )

  return {
    slotKeys: BASE_SLOT_KEYS,
    fieldToSlotKey: {
      ...BASE_FIELD_TO_SLOT_KEY,
      ...Object.fromEntries(
        Object.entries(policySlotAliases).filter(
          ([field, slotKey]) =>
            typeof field === 'string' &&
            field.trim() &&
            typeof slotKey === 'string' &&
            slotKey.trim(),
        ),
      ),
      ...Object.fromEntries(
        normalizedTenantSlots.map((slotKey) => [slotKey, slotKey]),
      ),
    },
    tenantSlots: normalizedTenantSlots,
  }
}

export const mapConversationFieldToSlot = (field = null, conversationState = null) => {
  if (typeof field !== 'string') {
    return null
  }

  const configuredFieldMap =
    conversationState?.normalization?.fieldToSlotKey &&
    typeof conversationState.normalization.fieldToSlotKey === 'object'
      ? conversationState.normalization.fieldToSlotKey
      : BASE_FIELD_TO_SLOT_KEY

  return configuredFieldMap[field] || null
}

export const isConversationFieldResolved = (
  field = null,
  conversationState = null,
) => {
  const slotKey = mapConversationFieldToSlot(field, conversationState)
  if (!slotKey) {
    return false
  }

  const slot = conversationState?.slots?.[slotKey]
  if (isMeaningfulValue(slot?.value)) {
    return true
  }

  const tenantSlot = conversationState?.tenant?.slots?.[slotKey]
  return isMeaningfulValue(tenantSlot?.value)
}

export const resolveNextConversationField = ({
  requestedField = null,
  missingFields = [],
  conversationState = null,
} = {}) => {
  const queue = [
    requestedField,
    ...((Array.isArray(missingFields) ? missingFields : []).filter(
      (field) => typeof field === 'string',
    )),
  ].filter((field, index, list) => field && list.indexOf(field) === index)

  for (const field of queue) {
    const slotKey = mapConversationFieldToSlot(field, conversationState)
    if (!slotKey) {
      return field
    }
    if (!isConversationFieldResolved(field, conversationState)) {
      return field
    }
  }

  return null
}

export const filterResolvedConversationFields = ({
  missingFields = [],
  conversationState = null,
} = {}) =>
  (Array.isArray(missingFields) ? missingFields : []).filter(
    (field) => !isConversationFieldResolved(field, conversationState),
  )

export const buildConversationState = ({
  previousConversationState = null,
  tenantRuntimePolicy = null,
  readiness = null,
  intentKey = null,
  intentConfidence = null,
  topic = null,
  contextTopic = null,
  quoteContext = null,
  supportContext = null,
  scheduleContext = null,
  currentTurnText = '',
  previousAgentText = '',
} = {}) => {
  const previousSlots =
    previousConversationState?.slots && typeof previousConversationState.slots === 'object'
      ? previousConversationState.slots
      : {}
  const previousTenantState =
    previousConversationState?.tenant && typeof previousConversationState.tenant === 'object'
      ? previousConversationState.tenant
      : {}
  const normalization = resolveConversationStateConfig({
    tenantRuntimePolicy,
    previousConversationState,
    quoteContext,
  })
  const tenantSlotKeys = normalization.tenantSlots
  const currentQuoteSubjectLabel = pickTextValue(
    quoteContext?.topicLabel,
    quoteContext?.familyLabel,
    topic?.label,
  )
  const previousQuoteSubjectLabel = pickTextValue(
    previousSlots?.product?.value,
    contextTopic?.label,
  )
  const quoteSubjectChanged =
    currentQuoteSubjectLabel &&
    previousQuoteSubjectLabel &&
    normalizeSubjectLabel(currentQuoteSubjectLabel) !==
      normalizeSubjectLabel(previousQuoteSubjectLabel)
  const resetQuoteSlotCarryover =
    quoteSubjectChanged && !hasQuoteSlotContribution(quoteContext)
  const previousDimensionValue = resetQuoteSlotCarryover
    ? null
    : previousSlots?.dimensions?.value
  const previousQuantityValue = resetQuoteSlotCarryover
    ? null
    : previousSlots?.quantity?.value

  const slots = {
    address: {
      value: pickTextValue(
        scheduleContext?.address,
        supportContext?.address,
        previousSlots?.address?.value,
      ),
      source: pickTextValue(scheduleContext?.address, supportContext?.address)
        ? 'explicit'
        : previousSlots?.address?.source || null,
    },
    date: {
      value: pickTextValue(
        scheduleContext?.date?.dateLabel,
        supportContext?.preferredDate?.dateLabel,
        previousSlots?.date?.value,
      ),
    },
    time: {
      value: pickTextValue(
        scheduleContext?.time?.timeLabel,
        supportContext?.preferredTime?.timeLabel,
        previousSlots?.time?.value,
      ),
    },
    product: {
      value: pickTextValue(
        quoteContext?.topicLabel,
        quoteContext?.familyLabel,
        topic?.label,
        contextTopic?.label,
        supportContext?.productType,
        previousSlots?.product?.value,
      ),
    },
    dimensions: {
      value: buildMeasurementSlotValue(quoteContext, previousDimensionValue),
    },
    quantity: {
      value: pickNumericValue(
        quoteContext?.quantity?.total,
        previousQuantityValue,
      ),
    },
  }
  const tenantSlots = Object.fromEntries(
    tenantSlotKeys.map((slotKey) => {
      const capturedValue =
        quoteContext?.capturedAttributes &&
        typeof quoteContext.capturedAttributes === 'object' &&
        quoteContext.capturedAttributes[slotKey] &&
        typeof quoteContext.capturedAttributes[slotKey] === 'object'
          ? quoteContext.capturedAttributes[slotKey]
          : null
      const previousValue =
        !resetQuoteSlotCarryover &&
        previousTenantState?.slots &&
        typeof previousTenantState.slots === 'object'
          ? previousTenantState.slots[slotKey]
          : null
      return [
        slotKey,
        capturedValue
          ? {
              value:
                capturedValue.label ??
                (typeof capturedValue.value === 'string' ||
                typeof capturedValue.value === 'number'
                  ? capturedValue.value
                  : null),
              source:
                typeof capturedValue.source === 'string' && capturedValue.source.trim()
                  ? capturedValue.source.trim()
                  : 'explicit',
            }
          : previousValue && typeof previousValue === 'object'
            ? { ...previousValue }
            : { value: null, source: null },
      ]
    }),
  )

  const rawMissingFields = [
    ...(Array.isArray(quoteContext?.missingFields) ? quoteContext.missingFields : []),
    ...(Array.isArray(supportContext?.missingFields) ? supportContext.missingFields : []),
    ...(Array.isArray(scheduleContext?.missingFields) ? scheduleContext.missingFields : []),
  ]
  const missing = Array.from(
    new Set(
      rawMissingFields
        .map((field) =>
          mapConversationFieldToSlot(field, {
            normalization,
          }),
        )
        .filter(Boolean),
    ),
  ).filter(
    (slotKey) =>
      !isSlotKeyResolved({
        slotKey,
        baseSlots: slots,
        tenantSlots,
      }),
  )
  const completed = BASE_SLOT_KEYS.filter((slotKey) =>
    isMeaningfulValue(slots?.[slotKey]?.value),
  )
  const tenantCompleted = tenantSlotKeys.filter((slotKey) =>
    isMeaningfulValue(tenantSlots?.[slotKey]?.value),
  )
  const tenantMissing = tenantSlotKeys.filter((slotKey) => !tenantCompleted.includes(slotKey))

  let lastAskedSlot =
    typeof previousConversationState?.lastAskedSlot === 'string'
      ? previousConversationState.lastAskedSlot
      : null
  if (resetQuoteSlotCarryover) {
    lastAskedSlot = null
  }
  const nextSlotKey = mapConversationFieldToSlot(readiness?.nextUsefulField || null, {
    normalization,
  })
  if (
    /^ask_/.test(String(readiness?.answerMode || '')) ||
    String(readiness?.answerMode || '') === 'hold_for_more_context'
  ) {
    lastAskedSlot =
      nextSlotKey &&
      !isSlotKeyResolved({
        slotKey: nextSlotKey,
        baseSlots: slots,
        tenantSlots,
      })
        ? nextSlotKey
        : null
  } else if (!missing.length) {
    lastAskedSlot = null
  }

  return {
    lane:
      typeof readiness?.lane === 'string' && readiness.lane.trim()
        ? readiness.lane.trim()
        : 'general',
    intent: {
      key:
        typeof intentKey === 'string' && intentKey.trim()
          ? intentKey.trim()
          : typeof readiness?.turnIntent === 'string' && readiness.turnIntent.trim()
            ? readiness.turnIntent.trim()
            : 'unknown',
      confidence:
        typeof intentConfidence === 'number' && Number.isFinite(intentConfidence)
          ? intentConfidence
          : typeof readiness?.confidence === 'number' && Number.isFinite(readiness.confidence)
            ? readiness.confidence
            : 0,
    },
    slots,
    slotStatus: {
      missing,
      completed,
    },
    tenant: {
      slots: tenantSlots,
      slotStatus: {
        missing: tenantMissing,
        completed: tenantCompleted,
      },
    },
    normalization: {
      fieldToSlotKey: normalization.fieldToSlotKey,
      slotKeys: normalization.slotKeys,
      tenantSlots: tenantSlotKeys,
    },
    lastAskedSlot,
    context: {
      lastUserMessage: compactText(currentTurnText),
      lastBotMessage: compactText(previousAgentText),
      conversationStage: resolveConversationStage({
        answerMode: readiness?.answerMode || null,
        mode: readiness?.mode || null,
        missingSlots: missing,
      }),
    },
  }
}

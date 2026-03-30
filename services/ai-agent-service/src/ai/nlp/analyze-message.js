import { z } from 'zod'

import { buildAnalyzeMessagePrompt, CUSTOMER_INTERPRETATION_INTENTS } from '../prompts/analysis.prompt.js'

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const buildFallbackEntities = (interpretation = null) => {
  const entities = {}
  const topicLabel =
    interpretation?.topic?.label ||
    interpretation?.contextTopic?.label ||
    interpretation?.quoteContext?.topicLabel ||
    interpretation?.quoteContext?.familyLabel ||
    null
  if (topicLabel) {
    entities.topic = topicLabel
  }
  const variant =
    interpretation?.quoteContext?.variantLabel ||
    interpretation?.topic?.variantLabel ||
    null
  if (variant) {
    entities.variant = variant
  }
  const quantity =
    interpretation?.quoteContext?.quantity?.total ||
    interpretation?.quoteContext?.quantity?.value ||
    null
  if (typeof quantity === 'number' && Number.isFinite(quantity)) {
    entities.quantity = quantity
  }
  const measurements = Array.isArray(interpretation?.quoteContext?.measurementItems)
    ? interpretation.quoteContext.measurementItems.length
    : interpretation?.quoteContext?.measurements
      ? 1
      : 0
  if (measurements > 0) {
    entities.measurementsCaptured = true
  }
  if (interpretation?.scheduleContext?.address?.label) {
    entities.address = interpretation.scheduleContext.address.label
  }
  if (typeof interpretation?.scheduleContext?.address === 'string') {
    entities.address = interpretation.scheduleContext.address
  }
  if (typeof interpretation?.supportContext?.productType === 'string') {
    entities.supportProduct = interpretation.supportContext.productType
  }
  if (typeof interpretation?.supportContext?.issueSummary === 'string') {
    entities.supportNeed = interpretation.supportContext.issueSummary
  }
  return entities
}

const sanitizeStructuredResult = (result, fallback) => {
  const intent = CUSTOMER_INTERPRETATION_INTENTS.includes(result?.intent)
    ? result.intent
    : fallback.intent
  const confidence = clamp(
    typeof result?.confidence === 'number' ? result.confidence : fallback.confidence,
    0,
    1,
  )
  const entities =
    result?.entities && typeof result.entities === 'object' && !Array.isArray(result.entities)
      ? Object.fromEntries(
          Object.entries(result.entities)
            .filter(([, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => [key, value]),
        )
      : fallback.entities
  const conversationModeHint =
    ['flow', 'exploration', 'unclear', 'small_talk'].includes(
      String(result?.conversation_mode || ''),
    )
      ? result.conversation_mode
      : fallback.conversationModeHint

  return {
    intent,
    entities,
    confidence,
    rawText: fallback.rawText,
    conversationModeHint,
    source: result ? 'llm' : fallback.source,
  }
}

export const analyzeMessage = async ({
  provider,
  role,
  input,
  recentTurns = [],
  inboundClassification = null,
  intentKey = null,
  interpretation = null,
  intentRegistryHints = [],
  allowModel = true,
  providerOptions = {},
}) => {
  const fallback = {
    intent: intentKey || inboundClassification?.suggestedIntent || null,
    entities: buildFallbackEntities(interpretation),
    confidence: clamp(
      typeof inboundClassification?.confidence === 'number'
        ? inboundClassification.confidence
        : 0.55,
      0,
      1,
    ),
    rawText: String(input || ''),
    conversationModeHint: null,
    source: 'heuristic',
  }

  if (!allowModel || !provider?.extractStructured) {
    return fallback
  }

  try {
    const schema = {
      intent: z.enum(CUSTOMER_INTERPRETATION_INTENTS),
      confidence: z.number().min(0).max(1),
      conversation_mode: z
        .enum(['flow', 'exploration', 'unclear', 'small_talk'])
        .optional(),
      entities: z
        .object({
          topic: z.string().optional(),
          variant: z.string().optional(),
          quantity: z.number().optional(),
          paymentMethod: z.string().optional(),
          supportNeed: z.string().optional(),
          supportProduct: z.string().optional(),
          address: z.string().optional(),
          contact: z.string().optional(),
          artifactKind: z.string().optional(),
          lightPreference: z.string().optional(),
          measurementsCaptured: z.boolean().optional(),
        })
        .optional(),
    }

    const result = await provider.extractStructured({
      systemPrompt: buildAnalyzeMessagePrompt({
        role,
        input,
        recentTurns,
        inboundClassification,
        intentKey,
        interpretation,
        intentRegistryHints,
      }),
      input: String(input || ''),
      schema,
      options: providerOptions,
    })

    return sanitizeStructuredResult(result, fallback)
  } catch {
    return fallback
  }
}

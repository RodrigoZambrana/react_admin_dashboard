import { z } from 'zod'

import { buildDecisionAssistPrompt } from '../prompts/decision.prompt.js'

const normalizeMissingFields = (value, requiredFieldsByAction = {}) => {
  const knownFields = new Set(
    Object.values(requiredFieldsByAction || {})
      .flatMap((entry) => (Array.isArray(entry) ? entry : []))
      .filter((entry) => typeof entry === 'string' && entry.trim())
      .map((entry) => String(entry).trim()),
  )

  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .filter((entry) => typeof entry === 'string')
        .map((entry) => String(entry).trim())
        .filter((entry) => entry && (knownFields.size === 0 || knownFields.has(entry))),
    ),
  )
}

export const assistNextStep = async ({
  provider,
  conversation = [],
  state = {},
  allowedActions = [],
  requiredFieldsByAction = {},
  allowModel = false,
  providerOptions = {},
}) => {
  const normalizedActions = Array.from(
    new Set(
      (Array.isArray(allowedActions) ? allowedActions : [])
        .filter((entry) => typeof entry === 'string')
        .map((entry) => String(entry).trim())
        .filter(Boolean),
    ),
  )

  if (!allowModel || !provider?.extractStructured || normalizedActions.length === 0) {
    return null
  }

  try {
    const schema = {
      action: z.string(),
      missingFields: z.array(z.string()).optional(),
      confidence: z.number().min(0).max(1),
      reasoning: z.string().optional(),
    }

    const result = await provider.extractStructured({
      systemPrompt: buildDecisionAssistPrompt({
        conversation,
        state,
        allowedActions: normalizedActions,
        requiredFieldsByAction,
      }),
      input: JSON.stringify({
        conversation: conversation.slice(-6),
        state,
        allowedActions: normalizedActions,
        requiredFieldsByAction,
      }),
      schema,
      options: providerOptions,
    })

    const action = String(result?.action || '').trim()
    if (!normalizedActions.includes(action)) {
      return null
    }

    return {
      action,
      missingFields: normalizeMissingFields(result?.missingFields, requiredFieldsByAction),
      confidence:
        typeof result?.confidence === 'number' && Number.isFinite(result.confidence)
          ? Math.max(0, Math.min(1, result.confidence))
          : 0,
      reasoning:
        typeof result?.reasoning === 'string' && result.reasoning.trim()
          ? result.reasoning.trim()
          : null,
      source: 'llm',
    }
  } catch {
    return null
  }
}

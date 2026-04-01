import { buildControlledConversationalPrompt } from '../prompts/analysis.prompt.js'
import { buildCustomerLlmContextBlock } from './customer-llm-context.js'

export const handleConversationalMode = async ({
  provider,
  role,
  input,
  recentTurns = [],
  interpretation = null,
  approvedDraft = null,
  approvedFacts = [],
  taskSummary = null,
  currentTask = null,
  providerOptions = {},
  channel = null,
  channelProfile = 'chat',
}) => {
  const llmContextBlock = buildCustomerLlmContextBlock({
    recentTurns,
    interpretation,
    taskSummary,
    currentTask,
    recentTurnLimit: 8,
    maxCharsPerTurn: 160,
  })

  if (!provider?.generate) {
    return approvedDraft
      ? {
          text: approvedDraft,
          source: 'draft',
          debugContext: {
            requestMode: 'approved_draft',
            processedInput: String(input || '').trim() || null,
            llmContextBlock,
            approvedDraft,
            approvedFacts,
            rawResponseText: approvedDraft,
          },
        }
      : null
  }

  const currentState = interpretation?.followUp?.detected
    ? 'El turno actual parece un follow-up contextual del hilo activo.'
    : null
  const systemPrompt = buildControlledConversationalPrompt({
    role,
    goal:
      'Responder de manera natural pero guiando al usuario hacia el siguiente paso útil sin perder foco.',
    approvedFacts,
    currentState,
    channel,
    channelProfile,
    llmContextBlock,
  })
  const promptInput = [
    approvedDraft ? `Borrador aprobado por backend: ${approvedDraft}` : null,
    `Mensaje actual: ${String(input || '').trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n')
  const promptHistory = recentTurns.slice(-6)

  const generated = await provider.generate({
    role,
    systemPrompt,
    history: promptHistory,
    input: promptInput,
    tools: [],
    options: providerOptions,
  })

  const text = String(generated?.text || '').replace(/\s+/g, ' ').trim()
  if (!text) {
    return approvedDraft
      ? {
          text: approvedDraft,
          source: 'draft',
          debugContext: {
            requestMode: 'approved_draft',
            processedInput: String(input || '').trim() || null,
            llmContextBlock,
            approvedDraft,
            approvedFacts,
            rawResponseText: approvedDraft,
          },
        }
      : null
  }

  return {
    text,
    source: 'llm_conversational',
    debugContext: {
      requestMode: 'llm_conversational',
      processedInput: String(input || '').trim() || null,
      llmContextBlock,
      approvedDraft,
      approvedFacts,
      systemPrompt,
      promptInput,
      promptHistory,
      rawResponseText: text,
    },
  }
}

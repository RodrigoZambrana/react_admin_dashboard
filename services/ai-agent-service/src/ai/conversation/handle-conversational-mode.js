import { buildControlledConversationalPrompt } from '../prompts/analysis.prompt.js'

export const handleConversationalMode = async ({
  provider,
  role,
  input,
  recentTurns = [],
  interpretation = null,
  approvedDraft = null,
  approvedFacts = [],
  providerOptions = {},
  channel = null,
  channelProfile = 'chat',
}) => {
  if (!provider?.generate) {
    return approvedDraft
      ? {
          text: approvedDraft,
          source: 'draft',
        }
      : null
  }

  const currentState = [
    interpretation?.conversationContext?.activeDomain
      ? `Dominio activo: ${interpretation.conversationContext.activeDomain}.`
      : null,
    interpretation?.conversationContext?.responseStrategy
      ? `Estrategia conversacional: ${interpretation.conversationContext.responseStrategy}.`
      : null,
    interpretation?.conversationContext?.nextUsefulField
      ? `Siguiente dato útil: ${interpretation.conversationContext.nextUsefulField}.`
      : null,
    interpretation?.conversationContext?.waitForMore
      ? 'El cliente parece estar terminando de expresar la idea: no cierres en falso ni repitas preguntas duras.'
      : null,
    interpretation?.topic?.label
      ? `Tema actual: ${interpretation.topic.label}.`
      : null,
    interpretation?.quoteContext?.missingFields?.length
      ? `Datos faltantes: ${interpretation.quoteContext.missingFields.join(', ')}.`
      : null,
    interpretation?.supportContext?.productType
      ? `Producto de soporte: ${interpretation.supportContext.productType}.`
      : null,
    interpretation?.supportContext?.issueSummary
      ? `Problema reportado: ${interpretation.supportContext.issueSummary}.`
      : null,
    interpretation?.followUp?.detected ? 'El turno actual parece follow-up contextual.' : null,
  ]
    .filter(Boolean)
    .join(' ')

  const generated = await provider.generate({
    role,
    systemPrompt: buildControlledConversationalPrompt({
      role,
      goal:
        'Responder de manera natural pero guiando al usuario hacia el siguiente paso útil sin perder foco.',
      approvedFacts,
      currentState,
      channel,
      channelProfile,
    }),
    history: recentTurns.slice(-4),
    input: [
      approvedDraft ? `Borrador aprobado por backend: ${approvedDraft}` : null,
      `Mensaje actual: ${String(input || '').trim()}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    tools: [],
    options: providerOptions,
  })

  const text = String(generated?.text || '').replace(/\s+/g, ' ').trim()
  if (!text) {
    return approvedDraft
      ? {
          text: approvedDraft,
          source: 'draft',
        }
      : null
  }

  return {
    text,
    source: 'llm_conversational',
  }
}

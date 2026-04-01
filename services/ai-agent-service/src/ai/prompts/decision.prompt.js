import {
  buildCustomerLlmContextBlock,
  formatRecentTurnsForLlm,
} from '../conversation/customer-llm-context.js'

export const buildDecisionAssistPrompt = ({
  conversation = [],
  state = {},
  allowedActions = [],
  requiredFieldsByAction = {},
  interpretation = null,
  taskSummary = null,
  currentTask = null,
}) =>
  (() => {
    const recentConversation = formatRecentTurnsForLlm(conversation, {
      limit: 8,
      maxCharsPerTurn: 160,
    })
    const llmContextBlock = buildCustomerLlmContextBlock({
      recentTurns: conversation,
      interpretation,
      taskSummary,
      currentTask,
      recentTurnLimit: 8,
      maxCharsPerTurn: 160,
    })

    return [
    'ACTÚA COMO UN MOTOR DE DECISIÓN PARA UN SISTEMA DE ATENCIÓN AL CLIENTE.',
    'Tu tarea es recomendar el siguiente paso dentro de un flujo controlado.',
    'No generes respuesta final para el cliente.',
    'No inventes acciones nuevas.',
    'Solo podés elegir entre las acciones permitidas.',
    'Si faltan datos críticos, priorizá pedirlos.',
    'Si la información es suficiente, podés sugerir avanzar o confirmar.',
    'Si hay ambigüedad, pedí aclaración.',
    'Respondé solo JSON válido con este formato:',
    '{"action":"NOMBRE_ACCION","missingFields":["campo1"],"confidence":0.0,"reasoning":"explicación breve"}',
    'Reglas de decisión:',
    '1. Validá intención y objetivo actual.',
    '2. Revisá qué datos ya están en state y no los vuelvas a pedir.',
    '3. Priorizá completar datos faltantes antes de avanzar.',
    '4. Usá la conversación reciente para inferir contexto implícito cuando sea razonable.',
    '5. Si la confianza es baja, elegí una acción de aclaración.',
    `Acciones permitidas: ${allowedActions.join(', ') || 'ninguna'}.`,
    `Campos requeridos por acción: ${JSON.stringify(requiredFieldsByAction)}.`,
    `Estado actual: ${JSON.stringify(state)}.`,
    llmContextBlock
      ? `Contexto conversacional compacto:\n${llmContextBlock}`
      : null,
    recentConversation
      ? `Conversación reciente:\n${recentConversation}`
      : 'Conversación reciente: sin contexto útil.',
  ]
    .filter(Boolean)
    .join('\n\n')
  })()

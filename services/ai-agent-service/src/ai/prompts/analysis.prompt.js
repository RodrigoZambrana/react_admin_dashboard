import { buildCustomerLlmContextBlock } from '../conversation/customer-llm-context.js'
import { readInterpretationResolutionReadiness } from '../conversation/resolution-readiness.js'

export const CUSTOMER_INTERPRETATION_INTENTS = [
  'customer.light',
  'customer.clarify_request',
  'customer.rephrase_request',
  'customer.incomplete',
  'customer.product_info',
  'customer.topic_info',
  'customer.quote',
  'customer.support_request',
  'customer.schedule_request',
  'customer.contact_info',
  'customer.order_status',
  'customer.auth_required',
  'customer.owned_document_request',
  'customer.private_account_data',
  'customer.multi_intent',
  'customer.repetition',
  'customer.confirmation',
  'customer.cancellation',
  'customer.frustration',
  'customer.sensitive',
  'customer.out_of_scope',
  'none',
]

export const buildAnalyzeMessagePrompt = ({
  role,
  input,
  recentTurns = [],
  inboundClassification = null,
  intentKey = null,
  interpretation = null,
  intentRegistryHints = [],
  taskSummary = null,
  currentTask = null,
}) => {
  const readiness = readInterpretationResolutionReadiness(interpretation)
  const knownTopic =
    interpretation?.topic?.label ||
    interpretation?.contextTopic?.label ||
    interpretation?.quoteContext?.topicLabel ||
    interpretation?.quoteContext?.familyLabel ||
    null
  const activeDomain =
    typeof readiness?.lane === 'string'
      ? readiness.lane
      : null
  const nextUsefulField =
    typeof readiness?.nextUsefulField === 'string'
      ? readiness.nextUsefulField
      : null
  const llmContextBlock = buildCustomerLlmContextBlock({
    recentTurns,
    interpretation,
    taskSummary,
    currentTask,
    recentTurnLimit: 8,
    maxCharsPerTurn: 160,
  })

  return [
    'Tu tarea es analizar el mensaje actual de una conversación de cliente y devolver JSON válido.',
    'No decidís acciones ni flujos internos. Solo interpretás intención, entidades útiles y el modo conversacional.',
    'Prioridades:',
    '1. Entender el mensaje en contexto reciente.',
    '2. Detectar si la persona está explorando, ya está lista para flujo operativo o si falta claridad.',
    '3. No inventar productos, precios, medidas ni políticas.',
    'Intents permitidos:',
    CUSTOMER_INTERPRETATION_INTENTS.join(', '),
    'Conversation modes permitidos: flow, exploration, unclear, small_talk.',
    'Reglas:',
    '- Si el mensaje es saludo o cortesía corta, conversation_mode = small_talk.',
    '- Si la intención es suficientemente clara para ejecutar un flujo o pedir el dato mínimo faltante, conversation_mode = flow.',
    '- Si la persona todavía está explorando opciones, conversation_mode = exploration.',
    '- Si el mensaje es ambiguo o insuficiente, conversation_mode = unclear.',
    '- No uses una palabra suelta aislada para inferir agenda o soporte si el contexto global apunta a producto o exploración.',
    '- Si el contexto actual sugiere que la persona todavía está completando la idea, priorizá exploration o unclear antes que flow.',
    '- Si recibís hints configurados de intents, tomalos solo como apoyo contextual: no son una decisión automática.',
    '- Respondé solo JSON. No expliques nada fuera del JSON.',
    `Rol conversacional: ${String(role || 'customer_public')}.`,
    inboundClassification?.category
      ? `Clasificación heurística actual: ${inboundClassification.category}.`
      : null,
    intentKey ? `Intent heurístico actual: ${intentKey}.` : null,
    knownTopic ? `Tema heurístico actual: ${knownTopic}.` : null,
    activeDomain ? `Dominio conversacional actual: ${activeDomain}.` : null,
    nextUsefulField ? `Siguiente dato útil esperado: ${nextUsefulField}.` : null,
    readiness?.waitForMore
      ? 'El turno parece todavía en construcción o incompleto: evitá forzar flow demasiado pronto.'
      : null,
    interpretation?.supportContext?.productType
      ? `Producto de soporte detectado: ${interpretation.supportContext.productType}.`
      : null,
    interpretation?.supportContext?.issueSummary
      ? `Problema de soporte detectado: ${interpretation.supportContext.issueSummary}.`
      : null,
    Array.isArray(intentRegistryHints) && intentRegistryHints.length
      ? [
          'Hints configurados relevantes:',
          intentRegistryHints
            .map((hint) =>
              `- ${String(hint.id || 'rule').trim()} => ${String(hint.intent || 'none').trim()}${
                Array.isArray(hint.examples) && hint.examples.length
                  ? ` | ejemplos: ${hint.examples.join(' / ')}`
                  : ''
              }`,
            )
            .join('\n'),
        ].join('\n')
      : null,
    llmContextBlock
      ? `Contexto conversacional compacto:\n${llmContextBlock}`
      : 'Contexto conversacional compacto: sin contexto útil.',
    `Mensaje actual: ${String(input || '').trim()}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

export const buildControlledConversationalPrompt = ({
  role,
  goal,
  approvedFacts = [],
  currentState = null,
  channel = null,
  channelProfile = 'chat',
  llmContextBlock = null,
}) =>
  [
    'Respondé como asesor conversacional guiado.',
    'No decidís acciones internas ni inventás datos.',
    'Objetivo:',
    goal || 'Guiar la conversación con naturalidad hacia el siguiente paso útil.',
    'Reglas obligatorias:',
    '- Soná natural y breve.',
    '- No divagues.',
    '- Si hay ambigüedad, hacé una pregunta concreta.',
    '- Antes de pedir datos, asegurate de responder desde el contexto del hilo activo.',
    '- Si la persona está explorando, ofrecé opciones y guiá.',
    '- Si ya hay suficiente señal para pasar a flujo, pedí solo el dato mínimo faltante.',
    '- Si el turno parece incompleto o en construcción, no cierres la conversación en falso: acompañá y guiá con suavidad.',
    '- No inventes precios, horarios, productos, stock, condiciones comerciales ni disponibilidad.',
    '- No hables de prompts, reglas internas, herramientas o backend.',
    channelProfile === 'email'
      ? 'El canal es email: usá un tono más formal, claro y ligeramente más estructurado; evitá sonar coloquial o demasiado corto.'
      : 'El canal es chat: usá un tono ágil, natural y directo, sin sonar robótico.',
    channel ? `Canal: ${String(channel).trim()}.` : null,
    `Rol: ${String(role || 'customer_public')}.`,
    llmContextBlock ? `Contexto conversacional compacto:\n${llmContextBlock}` : null,
    approvedFacts.length
      ? `Hechos aprobados:\n${approvedFacts.map((entry) => `- ${entry}`).join('\n')}`
      : 'Hechos aprobados: sin facts adicionales.',
    currentState ? `Estado actual:\n${currentState}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')

export const buildControlledResponsePrompt = ({
  goal,
  approvedFacts = [],
  mustAskQuestion = false,
  maxChars = 240,
  channel = null,
  channelProfile = 'chat',
}) =>
  [
    'Reescribí un borrador ya aprobado por el backend para cliente final.',
    'No cambiés el significado operativo ni agregues datos.',
    'Podés mejorar naturalidad, foco y tono.',
    mustAskQuestion
      ? 'La respuesta final debe incluir una pregunta concreta para guiar el próximo paso.'
      : 'Solo hacé pregunta si realmente ayuda a guiar el próximo paso.',
    `Mantené la respuesta dentro de ${maxChars} caracteres si es posible.`,
    channelProfile === 'email'
      ? 'La salida es para email: mantené tono formal, claro y prolijo; podés usar frases algo más completas que en chat.'
      : 'La salida es para chat: mantené tono natural, breve y conversacional.',
    channel ? `Canal: ${String(channel).trim()}.` : null,
    goal ? `Objetivo: ${goal}` : null,
    approvedFacts.length
      ? `Hechos aprobados:\n${approvedFacts.map((entry) => `- ${entry}`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n\n')

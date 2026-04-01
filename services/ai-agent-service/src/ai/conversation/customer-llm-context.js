import { readInterpretationResolutionReadiness } from './resolution-readiness.js'

const compactText = (value, maxChars = 180) => {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim()
  if (!normalized) {
    return null
  }
  if (normalized.length <= maxChars) {
    return normalized
  }
  return `${normalized.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`
}

const formatFacts = (knownFacts = {}) => {
  if (!knownFacts || typeof knownFacts !== 'object' || Array.isArray(knownFacts)) {
    return null
  }

  const entries = Object.entries(knownFacts)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${String(value).replace(/\s+/g, ' ').trim()}`)

  return entries.length ? entries.join(' ; ') : null
}

const formatCurrentTask = (currentTask = null) => {
  if (!currentTask || typeof currentTask !== 'object') {
    return null
  }

  const entities = Array.isArray(currentTask.entities)
    ? currentTask.entities
        .filter(
          (entry) =>
            entry &&
            typeof entry === 'object' &&
            typeof entry.type === 'string' &&
            typeof entry.value === 'string' &&
            entry.type.trim() &&
            entry.value.trim(),
        )
        .slice(0, 6)
        .map((entry) => `${entry.type}:${entry.value}`)
    : []

  return compactText(
    [
      currentTask.intentKey ? `intent=${currentTask.intentKey}` : null,
      currentTask.status ? `estado=${currentTask.status}` : null,
      entities.length ? `entidades=${entities.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join(' ; '),
    320,
  )
}

const looksLikeQuestion = (text) =>
  /[?¿]|\b(cu[aá]l|qu[eé]|c[oó]mo|cu[aá]ndo|cu[aá]nt|d[oó]nde|pod[eé]s|podr[ií]as|prefer[ií]s)\b/iu.test(
    String(text || ''),
  )

const findLastAgentTurn = (recentTurns = []) => {
  let fallback = null
  for (let index = recentTurns.length - 1; index >= 0; index -= 1) {
    const turn = recentTurns[index]
    if (turn?.role === 'agent' || turn?.role === 'assistant') {
      const text = compactText(turn?.text || '', 220)
      if (text) {
        if (!fallback) {
          fallback = text
        }
        if (looksLikeQuestion(text)) {
          return text
        }
      }
    }
  }
  return fallback
}

const formatMissingFields = (value = []) => {
  const fields = Array.isArray(value)
    ? value.filter((entry) => typeof entry === 'string' && entry.trim())
    : []
  return fields.length ? fields.join(', ') : null
}

export const formatRecentTurnsForLlm = (
  recentTurns = [],
  { limit = 8, maxCharsPerTurn = 180 } = {},
) =>
  recentTurns
    .slice(-limit)
    .map((turn) => {
      const role = turn?.role === 'agent' || turn?.role === 'assistant' ? 'agent' : 'customer'
      const text = compactText(turn?.text || '', maxCharsPerTurn)
      return text ? `${role}: ${text}` : null
    })
    .filter(Boolean)
    .join('\n')

export const buildCustomerLlmContextBlock = ({
  recentTurns = [],
  interpretation = null,
  taskSummary = null,
  currentTask = null,
  recentTurnLimit = 8,
  maxCharsPerTurn = 180,
} = {}) => {
  const readiness = readInterpretationResolutionReadiness(interpretation)
  const activeThreadLabel =
    compactText(interpretation?.threadResolution?.activeThread?.resolvedLabel || '') ||
    compactText(interpretation?.threadResolution?.activeThread?.baseLabel || '') ||
    null
  const knownFacts = formatFacts(readiness?.knownFacts)
  const lastAgentTurn = findLastAgentTurn(recentTurns)
  const recentTurnsBlock = formatRecentTurnsForLlm(recentTurns, {
    limit: recentTurnLimit,
    maxCharsPerTurn,
  })
  const currentTaskLine = formatCurrentTask(currentTask)
  const quoteMissingFields = formatMissingFields(interpretation?.quoteContext?.missingFields)
  const supportMissingFields = formatMissingFields(interpretation?.supportContext?.missingFields)
  const scheduleMissingFields = formatMissingFields(
    interpretation?.scheduleContext?.missingFields,
  )

  return [
    taskSummary ? `Resumen operativo: ${compactText(taskSummary, 420)}` : null,
    currentTaskLine ? `Tarea vigente: ${currentTaskLine}` : null,
    readiness?.mode ? `Modo conversacional: ${readiness.mode}.` : null,
    readiness?.lane ? `Lane activo: ${readiness.lane}.` : null,
    readiness?.turnIntent ? `Intent del turno: ${readiness.turnIntent}.` : null,
    activeThreadLabel ? `Hilo activo: ${activeThreadLabel}.` : null,
    readiness?.userGoal ? `Objetivo del usuario: ${compactText(readiness.userGoal, 220)}.` : null,
    readiness?.nextUsefulField ? `Próximo dato útil: ${readiness.nextUsefulField}.` : null,
    readiness?.answerMode ? `Modo de respuesta: ${readiness.answerMode}.` : null,
    readiness?.sideQuestionSubtype
      ? `Side question detectada: ${readiness.sideQuestionSubtype}.`
      : null,
    readiness?.quoteStage
      ? `Etapa de cotización: ${readiness.quoteStage}.`
      : null,
    readiness?.waitForMore
      ? 'El cliente parece seguir completando la idea: evitá forzar flujo o cierre prematuro.'
      : null,
    quoteMissingFields ? `Datos faltantes de cotización: ${quoteMissingFields}.` : null,
    supportMissingFields ? `Datos faltantes de soporte: ${supportMissingFields}.` : null,
    scheduleMissingFields ? `Datos faltantes de agenda: ${scheduleMissingFields}.` : null,
    knownFacts ? `Hechos conocidos: ${knownFacts}.` : null,
    lastAgentTurn ? `Última guía o pregunta del sistema: ${lastAgentTurn}` : null,
    recentTurnsBlock ? `Historial reciente ampliado:\n${recentTurnsBlock}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')
}

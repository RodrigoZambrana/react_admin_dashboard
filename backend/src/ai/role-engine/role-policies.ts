import {
  type AiConversationRole,
  getAiRoleConfig,
} from './role.config'

export const canUseTool = (
  role: AiConversationRole,
  toolName?: string | null,
): boolean => {
  if (!toolName) {
    return false
  }
  const config = getAiRoleConfig(role)
  return config.allowedTools.includes(toolName)
}

export const canExecuteIntent = (
  role: AiConversationRole,
  intentKey?: string | null,
): boolean => {
  if (!intentKey) {
    return true
  }
  const config = getAiRoleConfig(role)
  return !config.forbiddenIntents.some(
    (entry) => intentKey === entry || intentKey.startsWith(`${entry}.`),
  )
}

export const shouldResetContext = (
  role: AiConversationRole,
  intentChange: {
    changed: boolean
    previousIntentKey?: string | null
    currentIntentKey?: string | null
    overlap?: number
  },
): boolean => {
  if (!intentChange.changed) {
    return false
  }

  const config = getAiRoleConfig(role)
  if (config.type === 'admin') {
    return true
  }

  return (intentChange.overlap ?? 0) < 0.12
}

export const canExposeField = (
  role: AiConversationRole,
  field: string,
): boolean => {
  const normalized = String(field || '').trim()
  if (!normalized) {
    return false
  }

  if (['openAiApiKey', 'secrets', 'promptSource', 'internalEndpoints'].includes(normalized)) {
    return false
  }

  return getAiRoleConfig(role).exposedFields.includes(normalized)
}

export const requiresConfirmationForTool = (
  role: AiConversationRole,
  toolName?: string | null,
): boolean => {
  if (!toolName) {
    return false
  }
  return getAiRoleConfig(role).requiresConfirmation.includes(toolName)
}

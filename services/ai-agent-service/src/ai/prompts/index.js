import { basePromptRules } from './base.prompt.js'
import { customerSharedRules } from './customer.prompt.js'
import { adminSharedRules } from './admin.prompt.js'
import { customerPublicPromptRules } from './roles/customer_public.prompt.js'
import { customerAuthenticatedPromptRules } from './roles/customer_authenticated.prompt.js'
import { adminSupportPromptRules } from './roles/admin_support.prompt.js'
import { adminSalesPromptRules } from './roles/admin_sales.prompt.js'
import { adminOperationsPromptRules } from './roles/admin_operations.prompt.js'
import { adminSupervisorPromptRules } from './roles/admin_supervisor.prompt.js'
import { superadminPromptRules } from './roles/superadmin.prompt.js'

const ROLE_RULES = {
  customer_public: customerPublicPromptRules,
  customer_authenticated: customerAuthenticatedPromptRules,
  admin_support: adminSupportPromptRules,
  admin_sales: adminSalesPromptRules,
  admin_operations: adminOperationsPromptRules,
  admin_supervisor: adminSupervisorPromptRules,
  superadmin: superadminPromptRules,
}

const roleTypeRules = (role) =>
  String(role || '').startsWith('admin_') || role === 'superadmin'
    ? adminSharedRules
    : customerSharedRules

export function buildSystemPrompt(role, options = {}) {
  const roleRules = ROLE_RULES[role] ?? customerPublicPromptRules
  const actionGuides =
    Array.isArray(options.actionCatalog) && options.actionCatalog.length
      ? [
          'Las acciones reales del sistema deben seguir su contrato operativo. Si una acción requiere confirmación, no la ejecutes sin una confirmación explícita.',
          ...options.actionCatalog
            .filter((entry) => entry.confirmationRequired)
            .map((entry) => {
              const requiredFields = Array.isArray(entry.requiredFields)
                ? entry.requiredFields.join(', ')
                : ''
              const validationRules = Array.isArray(entry.validationRules)
                ? entry.validationRules.join(' ')
                : ''
              return `Acción ${entry.key || entry.toolName}: requiere confirmación.${requiredFields ? ` Campos mínimos: ${requiredFields}.` : ''}${validationRules ? ` Validaciones: ${validationRules}` : ''}`
            }),
        ]
      : []

  const retrievalRules =
    Array.isArray(options.retrievalContext) && options.retrievalContext.length
      ? [
          'Tenés contexto aprobado recuperado para esta conversación. Usalo antes que conocimiento general.',
          'Si respondés con ese contexto, citá por título las fuentes aprobadas usadas.',
          ...options.retrievalContext.map(
            (entry, index) =>
              [
                `Fuente aprobada ${index + 1}: ${entry.title}.`,
                entry.summary ? `Resumen: ${entry.summary}.` : null,
                entry.snippet ? `Fragmento: ${entry.snippet}.` : null,
              ]
                .filter(Boolean)
                .join(' '),
          ),
        ]
      : []

  const operationalContextRules =
    Array.isArray(options.operationalContext) && options.operationalContext.length
      ? [
          'Tenés contexto operativo previo generado por herramientas reales. Aprovechalo para no pedir datos ya resueltos.',
          ...options.operationalContext.map(
            (entry, index) => `Contexto operativo ${index + 1}: ${entry}`,
          ),
        ]
      : []

  const taskSummary =
    typeof options.taskSummary === 'string' && options.taskSummary.trim()
      ? [`Resumen operativo de la tarea actual: ${options.taskSummary.trim()}`]
      : []

  const currentTask =
    options.currentTask && typeof options.currentTask === 'object'
      ? [
          `Tarea actual: intención=${options.currentTask.intentKey || 'sin intención'}; estado=${options.currentTask.status || 'open'}.${
            Array.isArray(options.currentTask.entities) && options.currentTask.entities.length
              ? ` Entidades=${options.currentTask.entities
                  .map((entry) => `${entry.type}:${entry.value}`)
                  .join(', ')}.`
              : ''
          }`,
        ]
      : []

  const blockedToolRules =
    Array.isArray(options.blockedTools) && options.blockedTools.length
      ? [
          `Herramientas bloqueadas para este rol en esta interacción: ${options.blockedTools.join(', ')}. No intentes usarlas ni sugerir que el usuario puede ejecutarlas directamente.`,
        ]
      : []

  const customInstructions =
    typeof options.customInstructions === 'string' && options.customInstructions.trim()
      ? [
          `Instrucciones adicionales vigentes: ${options.customInstructions.trim()}`,
        ]
      : []

  return [
    ...basePromptRules,
    ...roleTypeRules(role),
    ...roleRules,
    ...actionGuides,
    ...operationalContextRules,
    ...retrievalRules,
    ...taskSummary,
    ...currentTask,
    ...blockedToolRules,
    ...customInstructions,
  ].join(' ')
}

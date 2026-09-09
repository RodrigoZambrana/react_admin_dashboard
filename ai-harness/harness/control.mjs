#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { collectPromotionCandidates, countBy, countByProduct } from './backlog-governance.mjs'

const harnessDir = dirname(dirname(fileURLToPath(import.meta.url)))
const defaultRoot = dirname(harnessDir)
const lifecycleTransactionName = 'ai-harness-lifecycle-transaction.json'

const canonicalAuditorSections = [
  { id: 'control-validity', heading: '## 1. Validez y frescura del control' },
  { id: 'portfolio-status', heading: '## 2. Estado global y pendientes' },
  { id: 'alignment', heading: '## 3. Alineamiento con acuerdos y planificación' },
  { id: 'deviations', heading: '## 4. Desvíos, evidencia faltante y sobredeclaraciones' },
  { id: 'human-decisions', heading: '## 5. Decisiones humanas requeridas' },
  { id: 'next-task', heading: '## 6. Única próxima tarea recomendada' },
]
const requiredAuditorSectionIds = canonicalAuditorSections.map(({ id }) => id)

const makePrompt = (task, head, sourcesFingerprint) => {
  if (!task) return null
  const lines = [
    `# Próxima tarea gobernada — ${task.id}`,
    '',
    '## Baseline',
    '',
    `- Commit observado: \`${head}\`.`,
    `- Estado requerido: \`${task.status}\`.`,
    `- Fingerprint de autoridades: \`${sourcesFingerprint}\`.`,
    '',
    '## Objetivo',
    '',
    task.objective,
    '',
    '## Alcance incluido',
    '',
    ...(task.scope?.in ?? []).map((entry) => `- ${entry}`),
    '',
    '## Fuera de alcance',
    '',
    ...(task.scope?.out ?? []).map((entry) => `- ${entry}`),
    '',
    '## Criterios de aceptación',
    '',
    ...(task.acceptanceCriteria ?? []).map((entry) => `- ${entry}`),
    '',
    '## Verificación',
    '',
    ...(task.verification ?? []).map((entry) => `- ${entry}`),
    '',
    '## Restricciones',
    '',
    '- Aplicar el AI Harness y actualizar sus fuentes de verdad.',
    '- No ampliar el alcance ni resolver decisiones humanas por inferencia.',
    '- No comenzar tareas dependientes durante este cierre.',
  ]
  return `${lines.join('\n')}\n`
}

export const validateAuditorResponse = (
  content,
  contract,
  { requireOutcome = true, expectedRecommendation } = {},
) => {
  const errors = []
  const sections = Array.isArray(contract?.sections) ? contract.sections : []
  const contentLines = String(content).split(/\r?\n/u)
  const visibleLines = []
  let insideFence = false
  for (const [index, line] of contentLines.entries()) {
    if (line.startsWith('```')) {
      insideFence = !insideFence
      continue
    }
    if (!insideFence) visibleLines.push({ index, line })
  }
  if (insideFence) errors.push('La respuesta contiene un bloque de código sin cerrar.')
  const sectionIds = sections.map(({ id }) => id)
  if (sections.length !== requiredAuditorSectionIds.length
    || sectionIds.some((id, index) => id !== requiredAuditorSectionIds[index])) {
    errors.push('El contrato no define las seis secciones obligatorias en el orden canónico.')
    return errors
  }

  const allowedHeadings = sections.map(({ heading }) => heading)
  const observedH2 = visibleLines.filter(({ line }) => line.startsWith('## ')).map(({ line }) => line)
  if (observedH2.length !== allowedHeadings.length
    || observedH2.some((heading, index) => heading !== allowedHeadings[index])) {
    errors.push('La respuesta debe contener únicamente los seis encabezados H2 canónicos.')
  }

  let previousIndex = -1
  const sectionPositions = []
  for (const section of sections) {
    const heading = section?.heading
    if (typeof heading !== 'string' || !heading.startsWith('## ')) {
      errors.push(`La sección ${section?.id ?? 'desconocida'} no tiene un heading Markdown válido.`)
      continue
    }
    const matches = visibleLines.filter(({ line }) => line === heading).map(({ index }) => index)
    if (matches.length !== 1) {
      errors.push(`La sección ${section.id} debe aparecer exactamente una vez.`)
      continue
    }
    if (matches[0] <= previousIndex) errors.push(`La sección ${section.id} está fuera de orden.`)
    previousIndex = matches[0]
    sectionPositions.push({ id: section.id, index: matches[0] })
  }

  if (!errors.length) {
    for (const [index, section] of sectionPositions.entries()) {
      const end = sectionPositions[index + 1]?.index ?? contentLines.length
      const body = contentLines.slice(section.index + 1, end).filter((line) => line.trim())
      if (!body.length) errors.push(`La sección ${section.id} no puede quedar vacía.`)
    }

    if (requireOutcome) {
      const recommendationStart = sectionPositions.at(-1).index + 1
      const recommendationLines = visibleLines
        .filter(({ index }) => index >= recommendationStart)
        .map(({ line }) => line)
      const taskLines = recommendationLines.filter((line) => line.startsWith('- Tarea:'))
      const blockedLines = recommendationLines.filter((line) => line.startsWith('- **Recomendación bloqueada**'))
      if (taskLines.length + blockedLines.length !== 1) {
        errors.push('La última sección debe contener exactamente una tarea o una recomendación bloqueada.')
      }

      const destinationLines = recommendationLines.filter((line) => line.startsWith('- Destino: **'))
      if (destinationLines.length !== 1
        || !/^- Destino: \*\*(NEW_CHAT|CONTINUE_EXISTING_TASK|NONE)\*\*\.$/u.test(destinationLines[0])) {
        errors.push('La última sección debe declarar exactamente un destino de handoff válido.')
      }

      if (expectedRecommendation !== undefined) {
        const expectedDestination = expectedRecommendation?.handoff?.destination ?? 'NONE'
        if (!destinationLines.includes(`- Destino: **${expectedDestination}**.`)) {
          errors.push(`El destino no coincide con la acción gobernada: ${expectedDestination}.`)
        }

        const promptMarker = '- Prompt exacto para copiar:'
        if (expectedRecommendation?.prompt?.content) {
          const markerIndex = content.indexOf(promptMarker)
          const fenceStart = markerIndex >= 0 ? content.indexOf('```text\n', markerIndex) : -1
          const promptStart = fenceStart >= 0 ? fenceStart + '```text\n'.length : -1
          const fenceEnd = promptStart >= 0 ? content.indexOf('\n```', promptStart) : -1
          const copiedPrompt = promptStart >= 0 && fenceEnd >= 0
            ? `${content.slice(promptStart, fenceEnd)}\n`
            : null
          if (copiedPrompt !== expectedRecommendation.prompt?.content) {
            errors.push('El prompt copiable no coincide exactamente con recommendation.prompt.content.')
          }
        } else if (content.includes(promptMarker)) {
          errors.push('Una transición no ejecutable no debe publicar un prompt de implementación.')
        }
      }
    }
  }
  return errors
}

export const renderAuditorResponse = (report, contract) => {
  const sections = Array.isArray(contract?.sections) && contract.sections.length === canonicalAuditorSections.length
    ? contract.sections
    : canonicalAuditorSections
  const headings = Object.fromEntries(sections.map(({ id, heading }) => [id, heading]))
  const lines = [
    headings['control-validity'],
    '',
    `- Validación: **${report.validation}**.`,
    `- Frescura: **${report.freshness}**.`,
    `- Generado: \`${report.generatedAt}\`.`,
    '',
    headings['portfolio-status'],
    '',
  ]

  if (report.facts) {
    lines.push(
      `- Harness: \`${report.facts.harness.version}\`; paridad aplicable con LACNIC: **${report.facts.harness.parityAchieved ? 'alcanzada' : 'no alcanzada'}**.`,
      `- Backlog: **${report.facts.backlog.total}** tareas — ${Object.entries(report.facts.backlog.byStatus).map(([status, count]) => `${status}: ${count}`).join(', ')}.`,
      `- Requerimientos: **${report.facts.requirements.total}** — ${Object.entries(report.facts.requirements.byStatus).map(([status, count]) => `${status}: ${count}`).join(', ')}.`,
      `- Cursor operativo: **${report.facts.current.status}**${report.facts.current.sessionId ? ` (\`${report.facts.current.sessionId}\`)` : ''}.`,
    )
  } else {
    lines.push('- Estado global no calculable hasta corregir las discrepancias de control.')
  }

  lines.push('', headings.alignment, '', `- Estado: **${report.alignment.status}**.`)
  for (const check of report.alignment.checks ?? []) {
    lines.push(`- ${check.id}: **${check.status}** — ${check.detail}`)
  }

  lines.push('', headings.deviations, '')
  if (!(report.warnings?.length || report.discrepancies?.length)) {
    lines.push('- Sin alertas, desvíos ni evidencia faltante detectados por el control automático.')
  } else {
    for (const warning of report.warnings ?? []) lines.push(`- Alerta: ${warning}`)
    for (const discrepancy of report.discrepancies ?? []) {
      lines.push(`- Desvío \`${discrepancy.kind}\` en \`${discrepancy.path}\`: ${discrepancy.detail}`)
    }
  }

  lines.push('', headings['human-decisions'], '')
  lines.push(`- Decisiones abiertas en el portfolio: **${report.humanDecisions.pendingCount}**.`)
  if (report.humanDecisions.forRecommendedTask?.length) {
    for (const decision of report.humanDecisions.forRecommendedTask) {
      lines.push(`- Requerida para \`${decision.taskId}\`: ${decision.summary}`)
    }
  } else {
    lines.push('- La recomendación actual no requiere una decisión humana previa.')
  }
  lines.push(`- Autoridad: ${report.humanDecisions.authority}`)

  lines.push('', headings['next-task'], '')
  if (report.recommendation) {
    const destination = report.recommendation.handoff?.destination
      ?? (report.recommendation.action === 'CONTINUE' ? 'CONTINUE_EXISTING_TASK' : 'NEW_CHAT')
    lines.push(
      `- Acción: **${report.recommendation.action}**.`,
      `- Destino: **${destination}**.`,
      report.recommendation.action === 'PROMOTE'
        ? '- Uso: actualizar la fuente canónica mediante una transición gobernada antes de iniciar la tarea; el control no realiza esa mutación.'
        : destination === 'NEW_CHAT'
          ? '- Uso: crear un nuevo chat de implementación y pegar allí el prompt completo. No ejecutarlo dentro del chat auditor.'
          : `- Uso: continuar en la tarea de implementación asociada a \`${report.recommendation.handoff?.sessionId ?? 'la sesión activa'}\`. No ejecutarlo dentro del chat auditor.`,
      `- Tarea: **${report.recommendation.taskId} — ${report.recommendation.title}**.`,
      `- Propósito: ${report.recommendation.objective}`,
      `- Motivo: ${report.recommendation.reason}`,
    )
    if (report.recommendation.prompt?.content) {
      lines.push(
        '- Prompt exacto para copiar:',
        '',
        '```text',
        ...report.recommendation.prompt.content.trimEnd().split('\n'),
        '```',
      )
    }
  } else {
    lines.push(
      '- Destino: **NONE**.',
      '- **Recomendación bloqueada** hasta corregir el control o el alineamiento. No corresponde iniciar otra tarea ni se publica un prompt ejecutable.',
    )
  }

  return `${lines.join('\n')}\n`
}

export function buildControlReport(root = defaultRoot) {
  const warnings = []
  const discrepancies = []
  const parsed = new Map()
  const requiredPaths = [
    'ai-harness/VERSION',
    'ai-harness/config/project.json',
    'planning/backlog.json',
    'ai-harness-local/decisions/index.json',
    'ai-harness-local/feature_list.json',
    'ai-harness-local/progress/current.json',
    'ai-harness-local/control/capabilities.json',
    'ai-harness-local/control/requirements.json',
    'ai-harness-local/control/policy.json',
    'ai-harness-local/control/auditor-task.json',
    'ai-harness-local/control/response-contract.json',
  ]

  const addDiscrepancy = (kind, path, detail) => discrepancies.push({ kind, path, detail })
  const loadJson = (path) => {
    const absolute = join(root, path)
    if (!existsSync(absolute)) {
      addDiscrepancy('MISSING_AUTHORITY', path, 'No existe la fuente requerida.')
      return null
    }
    try {
      const value = JSON.parse(readFileSync(absolute, 'utf8'))
      parsed.set(path, value)
      return value
    } catch (error) {
      addDiscrepancy('INVALID_JSON', path, error.message)
      return null
    }
  }

  for (const path of requiredPaths.slice(1)) loadJson(path)
  const config = parsed.get('ai-harness/config/project.json')
  for (const path of config?.canonicalDocs ?? []) requiredPaths.push(path)
  const auditorTask = parsed.get('ai-harness-local/control/auditor-task.json')
  const responseContract = parsed.get('ai-harness-local/control/response-contract.json')
  for (const path of [auditorTask?.promptPath, auditorTask?.responseContractPath, responseContract?.templatePath].filter(Boolean)) {
    requiredPaths.push(path)
  }

  const authorityPaths = [...new Set(requiredPaths)].sort()
  const hash = createHash('sha256')
  for (const path of authorityPaths) {
    const absolute = join(root, path)
    if (!existsSync(absolute)) {
      if (!discrepancies.some((item) => item.path === path)) {
        addDiscrepancy('MISSING_AUTHORITY', path, 'No existe la fuente requerida.')
      }
      continue
    }
    const bytes = readFileSync(absolute)
    const fileHash = createHash('sha256').update(bytes).digest('hex')
    hash.update(`${path}\0${fileHash}\n`)
  }
  const sourcesFingerprint = discrepancies.length ? null : hash.digest('hex')

  let branch = 'unknown'
  let head = 'unknown'
  let gitDir = null
  let porcelain = []
  try {
    branch = execFileSync('git', ['branch', '--show-current'], { cwd: root, encoding: 'utf8' }).trim()
    head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
    gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], { cwd: root, encoding: 'utf8' }).trim()
    porcelain = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
      cwd: root,
      encoding: 'utf8',
    }).split('\n').filter(Boolean)
  } catch (error) {
    addDiscrepancy('GIT_UNAVAILABLE', '.', error.message)
  }
  if (gitDir && existsSync(join(gitDir, lifecycleTransactionName))) {
    addDiscrepancy(
      'LIFECYCLE_RECOVERY_REQUIRED',
      join(gitDir, lifecycleTransactionName),
      'Existe un cierre o transición pendiente de consolidación; ejecutar lifecycle recover antes de recomendar START.',
    )
  }
  if (porcelain.length) warnings.push(`El árbol tiene ${porcelain.length} cambios; el reporte describe el estado vivo, no un cierre versionado.`)

  const backlog = parsed.get('planning/backlog.json')
  const decisions = parsed.get('ai-harness-local/decisions/index.json')
  const featureList = parsed.get('ai-harness-local/feature_list.json')
  const current = parsed.get('ai-harness-local/progress/current.json')
  const capabilities = parsed.get('ai-harness-local/control/capabilities.json')
  const requirements = parsed.get('ai-harness-local/control/requirements.json')
  const policy = parsed.get('ai-harness-local/control/policy.json')
  const tasks = Array.isArray(backlog?.tasks) ? backlog.tasks : []
  const taskById = new Map()
  const acceptedDecisionIds = new Set(
    (decisions?.decisions ?? []).filter(({ status }) => status === 'accepted').map(({ id }) => id),
  )

  for (const task of tasks) {
    if (!task?.id) {
      addDiscrepancy('INVALID_TASK', 'planning/backlog.json', 'Existe una tarea sin id.')
      continue
    }
    if (taskById.has(task.id)) addDiscrepancy('DUPLICATE_TASK', 'planning/backlog.json', task.id)
    taskById.set(task.id, task)
  }
  for (const task of tasks) {
    if (!task?.id) continue
    for (const dependency of task.dependencies ?? []) {
      if (!taskById.has(dependency)) {
        addDiscrepancy('MISSING_DEPENDENCY', 'planning/backlog.json', `${task.id} -> ${dependency}`)
      }
    }
    for (const decisionRef of task.decisionRefs ?? []) {
      if (!acceptedDecisionIds.has(decisionRef)) {
        addDiscrepancy('UNACCEPTED_DECISION', 'planning/backlog.json', `${task.id} -> ${decisionRef}`)
      }
    }
    if (task.status === 'ready') {
      const pendingDependencies = (task.dependencies ?? []).filter((id) => taskById.get(id)?.status !== 'done')
      if (pendingDependencies.length || (task.decisionsRequired?.length ?? 0) > 0) {
        addDiscrepancy('INVALID_READY_TASK', 'planning/backlog.json', task.id)
      }
    }
  }

  const recommendationOrder = policy?.recommendationOrder ?? []
  const recommendationRank = new Map(recommendationOrder.map((id, index) => [id, index]))
  const backlogRank = new Map(tasks.map(({ id }, index) => [id, index]))
  const rankTask = (id) => recommendationRank.get(id) ?? recommendationOrder.length + (backlogRank.get(id) ?? tasks.length)
  const promotionCandidates = collectPromotionCandidates(tasks, {
    compare: (left, right) => rankTask(left.taskId) - rankTask(right.taskId),
  })
  if (promotionCandidates.length) {
    warnings.push(`${promotionCandidates.length} tarea(s) blocked cumplen los gates para una promoción explícita a ready.`)
  }

  const activeFeatures = (featureList?.features ?? []).filter(({ status }) => status === 'in_progress')
  const activeTasks = tasks.filter(({ status }) => status === 'in_progress')
  if (activeFeatures.length > 1) {
    addDiscrepancy('MULTIPLE_ACTIVE_FEATURES', 'ai-harness-local/feature_list.json', `${activeFeatures.length} activas`)
  }
  if (current?.status === 'active' && activeFeatures[0]?.id !== current.sessionId) {
    addDiscrepancy('STATE_MISMATCH', 'ai-harness-local/progress/current.json', 'La sesión no coincide con feature_list.json.')
  }
  if (current?.status === 'active' && !['implementation', 'preclose'].includes(current.phase)) {
    addDiscrepancy('STATE_MISMATCH', 'ai-harness-local/progress/current.json', `Fase lifecycle inválida: ${current.phase ?? 'ausente'}.`)
  }
  if (current?.status === 'idle' && activeFeatures.length) {
    addDiscrepancy('STATE_MISMATCH', 'ai-harness-local/progress/current.json', 'Hay feature activa con checkpoint idle.')
  }
  if (activeTasks.length > 1) {
    addDiscrepancy('MULTIPLE_ACTIVE_TASKS', 'planning/backlog.json', `${activeTasks.length} tareas in_progress`)
  }
  if (current?.status === 'active'
    && (activeTasks.length !== 1
      || activeTasks[0]?.id !== current.backlogTaskId
      || activeFeatures[0]?.backlogTaskId !== current.backlogTaskId)) {
    addDiscrepancy('STATE_MISMATCH', 'planning/backlog.json', 'Backlog, feature y checkpoint no describen la misma tarea activa.')
  }
  if (current?.status === 'idle' && activeTasks.length) {
    addDiscrepancy('STATE_MISMATCH', 'planning/backlog.json', 'Hay una tarea in_progress con checkpoint idle.')
  }

  const auditorPath = 'ai-harness-local/control/auditor-task.json'
  if (auditorTask) {
    if (auditorTask.mode !== 'read-only' || auditorTask.authority !== false) {
      addDiscrepancy('INVALID_AUDITOR_AUTHORITY', auditorPath, 'El auditor debe ser read-only y no tener autoridad de aprobación.')
    }
    if (auditorTask.creation?.status !== 'confirmed') {
      addDiscrepancy(
        'AUDITOR_TASK_NOT_READY',
        auditorPath,
        `Estado observado: ${auditorTask.creation?.status ?? 'ausente'}. La creación real debe estar confirmada antes de recomendar trabajo.`,
      )
    } else {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(auditorTask.creation?.threadId ?? '')) {
        addDiscrepancy('INVALID_AUDITOR_TASK', auditorPath, 'Una creación confirmada debe registrar un threadId UUID real.')
      }
      if (!auditorTask.creation?.verifiedAt || Number.isNaN(Date.parse(auditorTask.creation.verifiedAt))) {
        addDiscrepancy('INVALID_AUDITOR_TASK', auditorPath, 'Una creación confirmada debe registrar verifiedAt.')
      }
      if (auditorTask.creation?.verificationMethod !== 'codex.read_thread') {
        addDiscrepancy('INVALID_AUDITOR_TASK', auditorPath, 'La confirmación debe provenir de codex.read_thread.')
      }
      if (auditorTask.creation?.verifiedTitle !== auditorTask.title) {
        addDiscrepancy('INVALID_AUDITOR_TASK', auditorPath, 'El título verificado no coincide con el perfil auditor.')
      }
      if (auditorTask.creation?.auditCwd !== auditorTask.canonicalRepository) {
        addDiscrepancy('INVALID_AUDITOR_TASK', auditorPath, 'La tarea no quedó vinculada al repositorio canónico de auditoría.')
      }
    }
  }

  const responseContractPath = 'ai-harness-local/control/response-contract.json'
  if (responseContract) {
    const templatePath = responseContract.templatePath
    const template = templatePath && existsSync(join(root, templatePath))
      ? readFileSync(join(root, templatePath), 'utf8')
      : ''
    for (const error of validateAuditorResponse(template, responseContract, { requireOutcome: false })) {
      addDiscrepancy('INVALID_AUDITOR_RESPONSE_CONTRACT', responseContractPath, error)
    }
    if (auditorTask?.responseContractPath !== responseContractPath) {
      addDiscrepancy('INVALID_AUDITOR_TASK', auditorPath, 'La tarea no referencia el contrato canónico de respuesta.')
    }
  }

  const allowedCapabilityStatuses = new Set(['IMPLEMENTED', 'PARTIAL', 'PLANNED', 'NOT_APPLICABLE'])
  for (const capability of capabilities?.capabilities ?? []) {
    if (!allowedCapabilityStatuses.has(capability.status)) {
      addDiscrepancy('INVALID_CAPABILITY_STATUS', 'ai-harness-local/control/capabilities.json', capability.id)
    }
    for (const evidencePath of capability.evidence ?? []) {
      if (!existsSync(join(root, evidencePath))) {
        addDiscrepancy('MISSING_CAPABILITY_EVIDENCE', evidencePath, capability.id)
      }
    }
    if (['PARTIAL', 'PLANNED'].includes(capability.status) && !(capability.taskRefs?.length > 0)) {
      addDiscrepancy('UNPLANNED_CAPABILITY_GAP', 'ai-harness-local/control/capabilities.json', capability.id)
    }
    for (const taskRef of capability.taskRefs ?? []) {
      if (!taskById.has(taskRef)) {
        addDiscrepancy('MISSING_CAPABILITY_TASK', 'ai-harness-local/control/capabilities.json', `${capability.id} -> ${taskRef}`)
      }
    }
  }

  for (const requirement of requirements?.requirements ?? []) {
    if (!(requirement.taskRefs?.length > 0)) {
      addDiscrepancy('UNCOVERED_REQUIREMENT', 'ai-harness-local/control/requirements.json', requirement.id)
    }
    for (const taskRef of requirement.taskRefs ?? []) {
      if (!taskById.has(taskRef)) {
        addDiscrepancy('MISSING_REQUIREMENT_TASK', 'ai-harness-local/control/requirements.json', `${requirement.id} -> ${taskRef}`)
      }
    }
    for (const decisionRef of requirement.decisionRefs ?? []) {
      if (!acceptedDecisionIds.has(decisionRef)) {
        addDiscrepancy('MISSING_REQUIREMENT_DECISION', 'ai-harness-local/control/requirements.json', `${requirement.id} -> ${decisionRef}`)
      }
    }
    for (const sourceRef of requirement.sourceRefs ?? []) {
      if (!existsSync(join(root, sourceRef))) {
        addDiscrepancy('MISSING_REQUIREMENT_SOURCE', sourceRef, requirement.id)
      }
    }
  }

  const reaches = (fromId, targetId, seen = new Set()) => {
    if (fromId === targetId) return true
    if (seen.has(fromId)) return false
    seen.add(fromId)
    return (taskById.get(fromId)?.dependencies ?? []).some((dependency) => reaches(dependency, targetId, seen))
  }
  const alignmentChecks = []
  const addAlignment = (id, status, detail, decisionRefs = []) =>
    alignmentChecks.push({ id, status, detail, decisionRefs })

  const implementationTypes = new Set(policy?.implementationTypes ?? [])
  const premature = tasks.filter((task) =>
    ['ready', 'in_progress'].includes(task.status) && implementationTypes.has(task.type),
  )
  addAlignment(
    'ALIGN-DISCOVERY-FIRST',
    premature.length ? 'FAIL' : 'PASS',
    premature.length
      ? `Implementación habilitada antes del gate: ${premature.map(({ id }) => id).join(', ')}`
      : 'No hay tareas funcionales o de refactor habilitadas antes de sus gates.',
    ['DEC-002'],
  )

  for (const rule of policy?.requiredPredecessors ?? []) {
    const task = taskById.get(rule.taskId)
    const missing = (rule.mustReach ?? []).filter((dependency) => !task || !reaches(rule.taskId, dependency))
    addAlignment(
      `ALIGN-${rule.taskId}`,
      missing.length ? 'FAIL' : 'PASS',
      missing.length
        ? `${rule.taskId} no alcanza estas dependencias: ${missing.join(', ')}`
        : `${rule.taskId} conserva la secuencia estratégica requerida.`,
      [rule.decisionRef],
    )
  }

  addAlignment(
    'ALIGN-REQUIREMENTS',
    discrepancies.some(({ kind }) => kind.startsWith('MISSING_REQUIREMENT') || kind === 'UNCOVERED_REQUIREMENT') ? 'FAIL' : 'PASS',
    'Los requerimientos iniciales tienen tareas, decisiones y fuentes trazables.',
    ['DEC-007'],
  )

  const dynamicExecution = policy?.dynamicExecution
  const requiredDynamicRequirementRefs = ['REQ-007', 'REQ-009']
  const requiredDynamicTaskRefs = ['HAR-003', 'HAR-004', 'HAR-005', 'HAR-006', 'HAR-008', 'QA-001']
  const dynamicRequirementRefs = dynamicExecution?.requirementRefs ?? []
  const dynamicTaskRefs = dynamicExecution?.taskRefs ?? []
  const requirementById = new Map((requirements?.requirements ?? []).map((requirement) => [requirement.id, requirement]))
  const requiredHumanAuthority = [
    'product_decisions',
    'priority_changes',
    'scope_changes',
    'exceptions',
    'destructive_or_remote_operations',
    'high_risk_releases',
  ]
  const dynamicPolicyIssues = []
  if (dynamicExecution?.canonicalBacklog !== 'planning/backlog.json' || dynamicExecution?.productDimension !== 'product') {
    dynamicPolicyIssues.push('la cola única o su dimensión de producto no están fijadas')
  }
  if (!acceptedDecisionIds.has(dynamicExecution?.decisionRef)) {
    dynamicPolicyIssues.push('la decisión de avance dinámico no está aceptada')
  }
  for (const requirementId of requiredDynamicRequirementRefs) {
    if (!dynamicRequirementRefs.includes(requirementId)) dynamicPolicyIssues.push(`la política no enlaza ${requirementId}`)
  }
  for (const taskId of requiredDynamicTaskRefs) {
    if (!dynamicTaskRefs.includes(taskId)) dynamicPolicyIssues.push(`la política no enlaza ${taskId}`)
  }
  if (dynamicExecution?.promotion?.from !== 'blocked'
    || dynamicExecution?.promotion?.to !== 'ready'
    || dynamicExecution?.promotion?.requiresDependenciesStatus !== 'done'
    || dynamicExecution?.promotion?.requiresNoPendingDecisions !== true
    || dynamicExecution?.promotion?.controlMode !== 'read-only') {
    dynamicPolicyIssues.push('la promoción gobernada no conserva los gates o el modo read-only')
  }
  for (const authority of requiredHumanAuthority) {
    if (!(dynamicExecution?.humanAuthority ?? []).includes(authority)) {
      dynamicPolicyIssues.push(`falta autoridad humana reservada: ${authority}`)
    }
  }
  for (const requirementId of requiredDynamicRequirementRefs) {
    const requirement = requirementById.get(requirementId)
    if (!requirement) {
      dynamicPolicyIssues.push(`falta el requerimiento ${requirementId}`)
      continue
    }
    if (!(requirement.decisionRefs ?? []).includes(dynamicExecution.decisionRef)) {
      dynamicPolicyIssues.push(`${requirementId} no enlaza ${dynamicExecution.decisionRef}`)
    }
    const missingTasks = requiredDynamicTaskRefs.filter((taskId) => !(requirement.taskRefs ?? []).includes(taskId))
    if (missingTasks.length) dynamicPolicyIssues.push(`${requirementId} no enlaza ${missingTasks.join(', ')}`)
  }
  for (const taskId of requiredDynamicTaskRefs) {
    if (!(taskById.get(taskId)?.decisionRefs ?? []).includes(dynamicExecution?.decisionRef)) {
      dynamicPolicyIssues.push(`${taskId} no enlaza ${dynamicExecution?.decisionRef ?? 'la decisión dinámica'}`)
    }
  }
  addAlignment(
    'ALIGN-DYNAMIC-EXECUTION',
    dynamicPolicyIssues.length ? 'FAIL' : 'PASS',
    dynamicPolicyIssues.length
      ? `Gobierno de avance dinámico incompleto: ${dynamicPolicyIssues.join('; ')}.`
      : 'Backlog único, vistas por producto, promoción read-only, coordinación reproducible y autoridad humana conservan sus enlaces.',
    dynamicExecution?.decisionRef ? [dynamicExecution.decisionRef] : [],
  )

  const lifecycleCommit = policy?.lifecycleCommit
  const lifecycleCommitIssues = []
  if (!acceptedDecisionIds.has(lifecycleCommit?.decisionRef)) lifecycleCommitIssues.push('la autorización durable no está aceptada')
  if (lifecycleCommit?.requiredForDone !== true
    || lifecycleCommit?.mode !== 'isolated-local'
    || lifecycleCommit?.requiresPrecloseCandidate !== true
    || lifecycleCommit?.includesFinalCloseArtifacts !== true
    || lifecycleCommit?.preservesPreexistingIndex !== true
    || lifecycleCommit?.remoteOperations !== false
    || lifecycleCommit?.controlBlocksOnPendingJournal !== true) {
    lifecycleCommitIssues.push('la política de commit local o sus límites están incompletos')
  }
  addAlignment(
    'ALIGN-LIFECYCLE-COMMIT',
    lifecycleCommitIssues.length ? 'FAIL' : 'PASS',
    lifecycleCommitIssues.length
      ? `Gobierno del commit de cierre incompleto: ${lifecycleCommitIssues.join('; ')}.`
      : 'Done/idle exige commit local aislado; recovery y control conservan cierre fail-closed sin operaciones remotas.',
    lifecycleCommit?.decisionRef ? [lifecycleCommit.decisionRef] : [],
  )

  const validation = discrepancies.length ? 'FAIL' : 'OK'
  const alignmentStatus = validation === 'FAIL'
    ? 'UNVERIFIABLE'
    : alignmentChecks.some(({ status }) => status === 'FAIL') ? 'DRIFT' : 'ALIGNED'

  const inProgressTask = tasks.find(({ status }) => status === 'in_progress')
  const nextReady = recommendationOrder
    .map((id) => taskById.get(id))
    .find((task) => task?.status === 'ready')
    ?? tasks.find(({ status }) => status === 'ready')
  const nextPromotion = promotionCandidates[0] ?? null
  const promoteBeforeReady = nextPromotion && (!nextReady || rankTask(nextPromotion.taskId) < rankTask(nextReady.id))
  const recommendationAction = inProgressTask ? 'CONTINUE' : promoteBeforeReady ? 'PROMOTE' : nextReady ? 'START' : null
  const nextTask = inProgressTask ?? (promoteBeforeReady ? taskById.get(nextPromotion.taskId) : nextReady) ?? null
  const promptHead = inProgressTask && current?.git?.baseCommit ? current.git.baseCommit : head
  const prompt = validation === 'OK' && alignmentStatus === 'ALIGNED' && recommendationAction !== 'PROMOTE'
    ? makePrompt(nextTask, promptHead, sourcesFingerprint)
    : null
  const promptSha256 = prompt ? createHash('sha256').update(prompt).digest('hex') : null
  const openDecisionEntries = tasks.flatMap((task) =>
    (task.decisionsRequired ?? []).map((summary) => ({ taskId: task.id, summary })),
  )

  const capabilityItems = capabilities?.capabilities ?? []
  const applicableCapabilities = capabilityItems.filter(({ status }) => status !== 'NOT_APPLICABLE')
  const capabilityCounts = countBy(capabilityItems, 'status')
  const parityAchieved = applicableCapabilities.length > 0
    && applicableCapabilities.every(({ status }) => status === 'IMPLEMENTED')

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    validation,
    freshness: validation === 'OK' ? 'FRESH' : 'UNVERIFIABLE',
    facts: validation === 'OK' ? {
      git: { branch, head, treeClean: porcelain.length === 0, changes: porcelain },
      harness: {
        version: existsSync(join(root, 'ai-harness', 'VERSION'))
          ? readFileSync(join(root, 'ai-harness', 'VERSION'), 'utf8').trim()
          : null,
        sourcesFingerprint,
        parityTarget: capabilities?.parityTarget ?? null,
        parityAchieved,
        capabilitiesByStatus: capabilityCounts,
        remainingCapabilities: applicableCapabilities
          .filter(({ status }) => status !== 'IMPLEMENTED')
          .map(({ id, status, taskRefs = [], remaining }) => ({ id, status, taskRefs, remaining })),
      },
      backlog: {
        total: tasks.length,
        byStatus: countBy(tasks, 'status'),
        byPriority: countBy(tasks, 'priority'),
        byProduct: countByProduct(tasks),
        readyIds: tasks.filter(({ status }) => status === 'ready').map(({ id }) => id),
        inProgressIds: tasks.filter(({ status }) => status === 'in_progress').map(({ id }) => id),
        promotionCandidates,
      },
      requirements: {
        total: requirements?.requirements?.length ?? 0,
        byStatus: countBy(requirements?.requirements ?? [], 'status'),
      },
      decisions: {
        total: decisions?.decisions?.length ?? 0,
        acceptedIds: [...acceptedDecisionIds],
      },
      current: {
        status: current?.status ?? null,
        sessionId: current?.sessionId ?? null,
        objective: current?.objective ?? null,
        phase: current?.phase ?? null,
        baseCommit: current?.git?.baseCommit ?? null,
      },
      auditor: {
        title: auditorTask?.title ?? null,
        status: auditorTask?.creation?.status ?? null,
        threadId: auditorTask?.creation?.threadId ?? null,
        verifiedAt: auditorTask?.creation?.verifiedAt ?? null,
        responseContractVersion: responseContract?.schemaVersion ?? null,
        requiredSections: responseContract?.sections?.map(({ id }) => id) ?? [],
      },
    } : null,
    alignment: { status: alignmentStatus, checks: alignmentChecks },
    humanDecisions: {
      pendingCount: openDecisionEntries.length,
      forRecommendedTask: nextTask
        ? openDecisionEntries.filter(({ taskId }) => taskId === nextTask.id)
        : [],
      authority: 'Las personas aprueban decisiones de producto, cambios de prioridad o alcance, excepciones, operaciones destructivas o remotas y releases de alto riesgo.',
    },
    warnings,
    discrepancies,
    recommendation: validation === 'OK' && alignmentStatus === 'ALIGNED' && nextTask && recommendationAction ? {
      derived: true,
      authority: false,
      action: recommendationAction,
      taskId: nextTask.id,
      title: nextTask.title,
      objective: nextTask.objective,
      reason: inProgressTask
        ? 'Existe una única tarea en progreso y debe cerrarse antes de abrir otra.'
        : recommendationAction === 'PROMOTE'
          ? nextPromotion.reason
          : 'Es la primera tarea ready según el orden de gobierno aceptado.',
      handoff: {
        destination: inProgressTask ? 'CONTINUE_EXISTING_TASK' : recommendationAction === 'PROMOTE' ? 'NONE' : 'NEW_CHAT',
        sessionId: inProgressTask ? current?.sessionId ?? null : null,
      },
      prompt: prompt ? {
        content: prompt,
        contentSha256: promptSha256,
        sourcesFingerprint,
      } : null,
    } : null,
  }
}

const renderHuman = (report) => {
  console.log(`Control del AI Harness: ${report.validation} / ${report.alignment.status}`)
  if (report.facts) {
    console.log(`Harness ${report.facts.harness.version}; paridad LACNIC aplicable: ${report.facts.harness.parityAchieved ? 'sí' : 'no'}`)
    console.log(`Backlog: ${report.facts.backlog.total} tareas ${JSON.stringify(report.facts.backlog.byStatus)}`)
    console.log(`Requerimientos: ${report.facts.requirements.total} ${JSON.stringify(report.facts.requirements.byStatus)}`)
  }
  for (const warning of report.warnings) console.log(`! ${warning}`)
  for (const discrepancy of report.discrepancies) console.log(`✗ ${discrepancy.kind}: ${discrepancy.detail}`)
  if (report.recommendation) {
    console.log(`Próxima acción: ${report.recommendation.action} ${report.recommendation.taskId} — ${report.recommendation.title}`)
  } else {
    console.log('Próxima acción: bloqueada hasta corregir control/alineamiento.')
  }
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) {
  const report = buildControlReport()
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
  else if (process.argv.includes('--auditor-response')) {
    const contractPath = join(defaultRoot, 'ai-harness-local/control/response-contract.json')
    const contract = existsSync(contractPath) ? JSON.parse(readFileSync(contractPath, 'utf8')) : null
    const content = renderAuditorResponse(report, contract)
    const errors = validateAuditorResponse(content, contract, { expectedRecommendation: report.recommendation })
    process.stdout.write(content)
    if (errors.length) {
      for (const error of errors) console.error(`INVALID_AUDITOR_RESPONSE: ${error}`)
      process.exitCode = 1
    }
  } else if (process.argv.includes('--next-prompt')) {
    if (!report.recommendation?.prompt?.content) process.exitCode = 1
    else process.stdout.write(report.recommendation.prompt.content)
  } else renderHuman(report)
  if (report.validation !== 'OK' || report.alignment.status !== 'ALIGNED') process.exitCode = 1
}

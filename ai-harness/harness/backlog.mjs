#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const harnessDir = dirname(dirname(fileURLToPath(import.meta.url)))
const root = dirname(harnessDir)
const backlogPath = join(root, 'planning', 'backlog.json')
const args = process.argv.slice(2)
const idIndex = args.indexOf('--id')
const selectedId = idIndex >= 0 ? args[idIndex + 1] : null
const errors = []
const allowedStatuses = new Set(['proposed', 'ready', 'blocked', 'in_progress', 'done', 'deferred'])
const allowedPriorities = new Set(['P0', 'P1', 'P2', 'P3'])
const allowedSizes = new Set(['S', 'M', 'L', 'XL'])
const requiredStrings = ['id', 'title', 'product', 'type', 'phase', 'priority', 'status', 'objective', 'rationale', 'size']
const requiredArrays = ['dependencies', 'acceptanceCriteria', 'verification', 'risks', 'decisionsRequired', 'decisionRefs', 'sourceRefs']

if (!existsSync(backlogPath)) {
  console.error(`No existe ${backlogPath}`)
  process.exit(1)
}

let backlog
try {
  backlog = JSON.parse(readFileSync(backlogPath, 'utf8'))
} catch (error) {
  console.error(`Backlog JSON inválido: ${error.message}`)
  process.exit(1)
}

if (backlog.schemaVersion !== 1) errors.push('schemaVersion debe ser 1')
if (!/^\d{4}-\d{2}-\d{2}$/u.test(backlog.generatedAt ?? '')) errors.push('generatedAt debe usar YYYY-MM-DD')
if (!Array.isArray(backlog.tasks)) errors.push('tasks debe ser un array')

const tasks = Array.isArray(backlog.tasks) ? backlog.tasks : []
const decisionsPath = join(root, 'ai-harness-local', 'decisions', 'index.json')
let acceptedDecisionIds = new Set()
try {
  const decisionLog = JSON.parse(readFileSync(decisionsPath, 'utf8'))
  acceptedDecisionIds = new Set(
    (decisionLog.decisions ?? [])
      .filter(({ status }) => status === 'accepted')
      .map(({ id }) => id),
  )
} catch (error) {
  errors.push(`No se pudo leer el registro de decisiones: ${error.message}`)
}
const byId = new Map()
for (const [index, task] of tasks.entries()) {
  const label = task?.id ?? `tasks[${index}]`
  for (const field of requiredStrings) {
    if (typeof task?.[field] !== 'string' || !task[field].trim()) errors.push(`${label}: ${field} es obligatorio`)
  }
  for (const field of requiredArrays) {
    if (!Array.isArray(task?.[field])) errors.push(`${label}: ${field} debe ser un array`)
  }
  if (!/^[A-Z]{2,4}-\d{3}$/u.test(task?.id ?? '')) errors.push(`${label}: id inválido`)
  if (byId.has(task?.id)) errors.push(`${label}: id duplicado`)
  else if (task?.id) byId.set(task.id, task)
  if (!allowedStatuses.has(task?.status)) errors.push(`${label}: status inválido`)
  if (!allowedPriorities.has(task?.priority)) errors.push(`${label}: priority inválida`)
  if (!allowedSizes.has(task?.size)) errors.push(`${label}: size inválido`)
  if (!Array.isArray(task?.scope?.in) || task.scope.in.length === 0) errors.push(`${label}: scope.in requiere elementos`)
  if (!Array.isArray(task?.scope?.out) || task.scope.out.length === 0) errors.push(`${label}: scope.out requiere elementos`)
  if ((task?.acceptanceCriteria?.length ?? 0) < 2) errors.push(`${label}: requiere al menos 2 criterios de aceptación`)
  if ((task?.verification?.length ?? 0) < 1) errors.push(`${label}: requiere verificación`)
  if ((task?.risks?.length ?? 0) < 1) errors.push(`${label}: requiere riesgos explícitos`)
  if ((task?.sourceRefs?.length ?? 0) < 1) errors.push(`${label}: requiere fuentes`)
  if ((task?.decisionRefs?.length ?? 0) < 1) errors.push(`${label}: requiere decisionRefs`)
  for (const decisionId of task?.decisionRefs ?? []) {
    if (!acceptedDecisionIds.has(decisionId)) errors.push(`${label}: decisión no aceptada o inexistente ${decisionId}`)
  }
  if (task?.status === 'ready' && (task.decisionsRequired?.length ?? 0) > 0) {
    errors.push(`${label}: una tarea ready no puede tener decisiones pendientes`)
  }
  if (task?.status === 'blocked' && !task?.blockingReason) errors.push(`${label}: blocked requiere blockingReason`)
}

for (const task of tasks) {
  for (const dependency of task.dependencies ?? []) {
    if (!byId.has(dependency)) errors.push(`${task.id}: dependencia inexistente ${dependency}`)
    if (dependency === task.id) errors.push(`${task.id}: no puede depender de sí misma`)
  }
  if (task.status === 'ready') {
    const pending = (task.dependencies ?? []).filter((id) => byId.get(id)?.status !== 'done')
    if (pending.length) errors.push(`${task.id}: ready con dependencias no terminadas: ${pending.join(', ')}`)
  }
}

const visiting = new Set()
const visited = new Set()
const visit = (id, path = []) => {
  if (visiting.has(id)) {
    errors.push(`Ciclo de dependencias: ${[...path, id].join(' -> ')}`)
    return
  }
  if (visited.has(id)) return
  visiting.add(id)
  for (const dependency of byId.get(id)?.dependencies ?? []) visit(dependency, [...path, id])
  visiting.delete(id)
  visited.add(id)
}
for (const id of byId.keys()) visit(id)

if (errors.length) {
  for (const error of errors) console.error(`✗ ${error}`)
  console.error(`Backlog inválido: ${errors.length} error(es)`)
  process.exit(1)
}

if (selectedId) {
  const task = byId.get(selectedId)
  if (!task) {
    console.error(`No existe la tarea ${selectedId}`)
    process.exit(2)
  }
  console.log(JSON.stringify(task, null, 2))
} else if (args.includes('--ready')) {
  const ready = tasks.filter(({ status }) => status === 'ready')
  for (const task of ready) console.log(`${task.id}\t${task.priority}\t${task.product}\t${task.title}`)
  console.log(`${ready.length} tarea(s) listas`)
} else {
  const counts = tasks.reduce((result, task) => {
    result[task.status] = (result[task.status] ?? 0) + 1
    return result
  }, {})
  console.log(`Backlog válido: ${tasks.length} tareas`)
  console.log(JSON.stringify(counts, null, 2))
}

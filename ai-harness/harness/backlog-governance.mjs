import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const PROMOTION_REASON = 'Todas las dependencias están done y no quedan decisiones pendientes; el harness escribe blocked → ready. Las personas no confirman este cálculo; aprueban prioridad, alcance, excepciones y el arranque.'
export const BACKLOG_FRAGMENT_FILES = ['platform.json', 'ecommerce.json', 'metrics.json', 'ai-channels.json']

export const countBy = (items, field) =>
  items.reduce((counts, item) => {
    const key = item?.[field] ?? 'unknown'
    counts[key] = (counts[key] ?? 0) + 1
    return counts
  }, {})

export const countByProduct = (tasks) =>
  Object.fromEntries(
    [...new Set(tasks.map(({ product }) => product))]
      .sort((left, right) => left.localeCompare(right))
      .map((product) => [product, {
        total: tasks.filter((task) => task.product === product).length,
        byStatus: countBy(tasks.filter((task) => task.product === product), 'status'),
      }]),
  )

export const reconstructBacklogViews = (tasks) => ({
  general: {
    total: tasks.length,
    byStatus: countBy(tasks, 'status'),
    ids: tasks.map(({ id }) => id),
  },
  byProduct: countByProduct(tasks),
})

export const indexTasks = (tasks) => {
  const taskById = new Map()
  for (const task of tasks ?? []) {
    if (task?.id) taskById.set(task.id, task)
  }
  return taskById
}

export const pendingDependencies = (task, taskById) =>
  (task.dependencies ?? []).filter((id) => taskById.get(id)?.status !== 'done')

export const isPromotionEligible = (task, taskById) =>
  task?.status === 'blocked'
  && pendingDependencies(task, taskById).length === 0
  && (task.decisionsRequired ?? []).length === 0

export const collectPromotionCandidates = (tasks, { compare } = {}) => {
  const taskById = indexTasks(tasks)
  const candidates = []
  for (const task of tasks ?? []) {
    if (!isPromotionEligible(task, taskById)) continue
    candidates.push({
      taskId: task.id,
      title: task.title,
      from: 'blocked',
      to: 'ready',
      derived: true,
      authority: false,
      reason: PROMOTION_REASON,
    })
  }
  if (compare) candidates.sort(compare)
  return candidates
}

export const findBacklogFragmentRelPath = (root, taskId) => {
  for (const name of BACKLOG_FRAGMENT_FILES) {
    const rel = `planning/fragments/${name}`
    const abs = join(root, rel)
    if (!existsSync(abs)) continue
    const fragment = JSON.parse(readFileSync(abs, 'utf8'))
    if ((fragment.tasks ?? []).some(({ id }) => id === taskId)) return rel
  }
  return null
}

export const applyTaskStatus = (tasks, taskId, status, extra = {}) => {
  const next = structuredClone(tasks)
  const task = next.find(({ id }) => id === taskId)
  if (!task) {
    const error = new Error(`No existe ${taskId} en el backlog canónico.`)
    error.code = 'TASK_NOT_FOUND'
    throw error
  }
  Object.assign(task, extra)
  task.status = status
  if (status !== 'blocked') delete task.blockingReason
  return next
}

export const applyPromotionToTasks = (tasks, taskId) => {
  const taskById = indexTasks(tasks)
  const task = taskById.get(taskId)
  if (!task) {
    const error = new Error(`No existe ${taskId} en el backlog canónico.`)
    error.code = 'TASK_NOT_FOUND'
    throw error
  }
  if (!isPromotionEligible(task, taskById)) {
    const error = new Error(`${taskId} no cumple los gates de promoción gobernada.`)
    error.code = 'PROMOTION_NOT_ELIGIBLE'
    throw error
  }
  return applyTaskStatus(tasks, taskId, 'ready')
}

export const applyEligiblePromotionsToTasks = (tasks) => {
  let next = tasks
  const applied = []
  for (const candidate of collectPromotionCandidates(next)) {
    next = applyPromotionToTasks(next, candidate.taskId)
    applied.push(candidate)
  }
  return { tasks: next, applied }
}

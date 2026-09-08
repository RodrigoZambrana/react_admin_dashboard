#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  realpathSync,
  closeSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { buildControlReport } from './control.mjs'

const harnessDir = dirname(dirname(fileURLToPath(import.meta.url)))
const defaultRoot = dirname(harnessDir)
const transactionName = 'ai-harness-lifecycle-transaction.json'
const json = (value) => `${JSON.stringify(value, null, 2)}\n`
const nowIso = (clock) => clock().toISOString()
const dayOf = (iso) => iso.slice(0, 10)

const statePaths = {
  backlog: 'planning/backlog.json',
  features: 'ai-harness-local/feature_list.json',
  current: 'ai-harness-local/progress/current.json',
  currentMd: 'ai-harness-local/progress/current.md',
  history: 'ai-harness-local/progress/history.md',
}

const requiredWriteSet = [
  statePaths.backlog,
  statePaths.features,
  statePaths.current,
  statePaths.currentMd,
  statePaths.history,
  'ai-harness-local/features/done/',
  'ai-harness-local/receipts/',
]

export class LifecycleError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'LifecycleError'
    this.code = code
  }
}

const fail = (code, message) => {
  throw new LifecycleError(code, message)
}

const git = (root, args, options = {}) => execFileSync('git', args, {
  cwd: root,
  encoding: options.encoding ?? 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  maxBuffer: 20 * 1024 * 1024,
})

const readJson = (root, path) => {
  try {
    return JSON.parse(readFileSync(join(root, path), 'utf8'))
  } catch (error) {
    fail('INVALID_AUTHORITY', `${path}: ${error.message}`)
  }
}

const normalizePath = (root, input) => {
  if (typeof input !== 'string' || !input.trim()) fail('INVALID_WRITE_SET', 'El write-set contiene una ruta vacía.')
  const directory = input.endsWith('/')
  const normalized = input.replaceAll('\\', '/').replace(/^\.\//u, '').replace(/\/+$/u, '')
  const absolute = resolve(root, normalized)
  const rel = relative(root, absolute).replaceAll(sep, '/')
  if (!rel || rel === '..' || rel.startsWith('../') || rel.startsWith('/')) {
    fail('INVALID_WRITE_SET', `Ruta fuera del repositorio: ${input}`)
  }
  return `${rel}${directory ? '/' : ''}`
}

const matchesWriteSet = (path, writeSet) => writeSet.some((entry) =>
  entry.endsWith('/') ? path.startsWith(entry) : path === entry,
)

const validateWriteSet = (root, entries) => {
  const writeSet = [...new Set((entries ?? []).map((entry) => normalizePath(root, entry)))].sort()
  if (!writeSet.length) fail('INVALID_WRITE_SET', 'Start requiere al menos una ruta en el write-set.')
  const missing = requiredWriteSet.filter((path) => !matchesWriteSet(path.replace(/\/$/u, ''), writeSet)
    && !writeSet.includes(path))
  if (missing.length) fail('INVALID_WRITE_SET', `El write-set no cubre fuentes de lifecycle: ${missing.join(', ')}`)
  return writeSet
}

const porcelainEntries = (root) => {
  const output = git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'])
  const tokens = output.split('\0').filter(Boolean)
  const entries = []
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const status = token.slice(0, 2)
    const path = token.slice(3)
    const entry = { status, path }
    if (status.includes('R') || status.includes('C')) entry.originalPath = tokens[++index]
    entries.push(entry)
  }
  return entries
}

const baselineNameStatus = (root, baseCommit) => git(root, ['diff', '--name-status', baseCommit, '--'])
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [status, path, destination] = line.split('\t')
    return destination ? { status, path, destination } : { status, path }
  })

const changedPaths = (root, baseCommit) => {
  const statusPaths = porcelainEntries(root).flatMap(({ path, originalPath }) => [path, originalPath].filter(Boolean))
  const baselinePaths = git(root, ['diff', '--name-only', '-z', baseCommit, '--']).split('\0').filter(Boolean)
  return [...new Set([...statusPaths, ...baselinePaths])].sort()
}

const pathFingerprint = (root, baseCommit, path) => {
  const hash = createHash('sha256')
  hash.update(git(root, ['diff', '--binary', '--no-ext-diff', baseCommit, '--', path]))
  hash.update('\0STATUS\0')
  hash.update(git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', path]))
  const absolute = join(root, path)
  if (existsSync(absolute)) {
    try {
      hash.update('\0FILE\0')
      hash.update(readFileSync(absolute))
    } catch {
      hash.update('\0NON_FILE\0')
    }
  }
  return hash.digest('hex')
}

const snapshotChanges = (root, baseCommit) => changedPaths(root, baseCommit).map((path) => ({
  path,
  fingerprint: pathFingerprint(root, baseCommit, path),
}))

const gitContext = (root) => {
  let topLevel
  try {
    topLevel = git(root, ['rev-parse', '--show-toplevel']).trim()
  } catch (error) {
    fail('GIT_UNAVAILABLE', error.stderr?.trim() || error.message)
  }
  if (realpathSync(topLevel) !== realpathSync(root)) fail('INVALID_ROOT', `La raíz Git es ${topLevel}, no ${root}.`)
  const branch = git(root, ['branch', '--show-current']).trim()
  if (!branch) fail('DETACHED_HEAD', 'Lifecycle no admite HEAD desacoplado.')
  const head = git(root, ['rev-parse', 'HEAD']).trim()
  const gitDir = git(root, ['rev-parse', '--absolute-git-dir']).trim()
  const commonDir = git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim()
  return { branch, head, worktree: realpathSync(root), gitDir, commonDir, linkedWorktree: gitDir !== commonDir }
}

const journalPath = (root) => join(gitContext(root).gitDir, transactionName)

const atomicWrite = (path, content) => {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`
  writeFileSync(temporary, content)
  renameSync(temporary, path)
}

const restoreJournal = (root, journal) => {
  for (const entry of [...journal.entries].reverse()) {
    const target = join(root, entry.path)
    if (entry.existed) atomicWrite(target, Buffer.from(entry.contentBase64, 'base64'))
    else if (existsSync(target)) unlinkSync(target)
  }
}

export const recoverLifecycle = (root = defaultRoot) => {
  const path = journalPath(root)
  if (!existsSync(path)) return { recovered: false }
  let journal
  try {
    journal = JSON.parse(readFileSync(path, 'utf8'))
    if (journal.schema !== 'ai-harness.lifecycle-transaction/v1' || !Array.isArray(journal.entries)) {
      fail('INVALID_JOURNAL', `Journal de recovery inválido: ${path}`)
    }
    restoreJournal(root, journal)
    unlinkSync(path)
    return { recovered: true, transition: journal.transition, transactionId: journal.transactionId }
  } catch (error) {
    if (error instanceof LifecycleError) throw error
    fail('RECOVERY_FAILED', `${path}: ${error.message}`)
  }
}

export const applyAtomicFileTransaction = (root, transition, writes, options = {}) => {
  const gitState = gitContext(root)
  const path = join(gitState.gitDir, transactionName)
  if (existsSync(path)) fail('RECOVERY_REQUIRED', `Existe una transacción incompleta: ejecuta recover (${path}).`)
  const normalized = [...writes.entries()].map(([entryPath, content]) => ({
    path: normalizePath(root, entryPath).replace(/\/$/u, ''),
    content: Buffer.isBuffer(content) ? content : Buffer.from(String(content)),
  }))
  const journal = {
    schema: 'ai-harness.lifecycle-transaction/v1',
    transactionId: randomUUID(),
    transition,
    createdAt: new Date().toISOString(),
    entries: normalized.map(({ path: entryPath }) => {
      const absolute = join(root, entryPath)
      return {
        path: entryPath,
        existed: existsSync(absolute),
        contentBase64: existsSync(absolute) ? readFileSync(absolute).toString('base64') : null,
      }
    }),
  }
  const descriptor = openSync(path, 'wx')
  try {
    writeFileSync(descriptor, json(journal))
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }

  try {
    for (const [index, entry] of normalized.entries()) {
      atomicWrite(join(root, entry.path), entry.content)
      if (options.crashAfterWrites === index + 1) {
        const error = new LifecycleError('SIMULATED_CRASH', 'Fallo simulado con journal pendiente.')
        error.leaveJournal = true
        throw error
      }
      if (options.failAfterWrites === index + 1) fail('INJECTED_FAILURE', 'Fallo de escritura simulado.')
    }
    unlinkSync(path)
  } catch (error) {
    if (error.leaveJournal) throw error
    try {
      restoreJournal(root, journal)
      if (existsSync(path)) unlinkSync(path)
    } catch (rollbackError) {
      fail('ROLLBACK_FAILED', `${error.message}; rollback: ${rollbackError.message}`)
    }
    throw error
  }
  return { transactionId: journal.transactionId, files: normalized.map(({ path: entryPath }) => entryPath) }
}

const ensureNoJournal = (root) => {
  const path = journalPath(root)
  if (existsSync(path)) fail('RECOVERY_REQUIRED', 'Hay una transición incompleta; ejecuta lifecycle recover antes de continuar.')
}

const assertBranchAndBaseline = (root, current) => {
  const observed = gitContext(root)
  if (observed.branch !== current.git.baseBranch) {
    fail('BRANCH_CHANGED', `Branch esperada ${current.git.baseBranch}; observada ${observed.branch}.`)
  }
  if (current.git.worktree && realpathSync(current.git.worktree) !== observed.worktree) {
    fail('WORKTREE_CHANGED', `Worktree esperado ${current.git.worktree}; observado ${observed.worktree}.`)
  }
  try {
    git(root, ['merge-base', '--is-ancestor', current.git.baseCommit, 'HEAD'])
  } catch {
    fail('BASELINE_DIVERGED', `${current.git.baseCommit} ya no es ancestro de HEAD.`)
  }
  return observed
}

const validateScopeDiff = (root, current) => {
  const preexisting = new Map((current.git.preexistingChanges ?? []).map((entry) => [entry.path, entry.fingerprint]))
  const paths = changedPaths(root, current.git.baseCommit)
  const ownedPaths = []
  const preservedPreexistingPaths = []
  const violations = []
  for (const path of paths) {
    if (matchesWriteSet(path, current.writeSet)) {
      ownedPaths.push(path)
      continue
    }
    const before = preexisting.get(path)
    const after = pathFingerprint(root, current.git.baseCommit, path)
    if (before && before === after) preservedPreexistingPaths.push(path)
    else violations.push(path)
  }
  if (violations.length) fail('WRITE_SET_VIOLATION', `Cambios fuera del write-set: ${violations.join(', ')}`)
  return { paths, ownedPaths, preservedPreexistingPaths }
}

const candidateFingerprint = (root, current, ownedPaths) => {
  const volatile = new Set([statePaths.features, statePaths.current, statePaths.currentMd])
  const hash = createHash('sha256')
  for (const path of ownedPaths.filter((item) => !volatile.has(item)).sort()) {
    hash.update(`${path}\0${pathFingerprint(root, current.git.baseCommit, path)}\n`)
  }
  return hash.digest('hex')
}

const validateEvidence = (task, evidence) => {
  if (evidence?.schema !== 'ai-harness.preclose-evidence/v1') fail('INVALID_EVIDENCE', 'Schema de evidencia inválido.')
  if (evidence.taskId !== task.id) fail('INVALID_EVIDENCE', `La evidencia corresponde a ${evidence.taskId ?? 'ninguna tarea'}, no ${task.id}.`)
  const validateGroup = (expected, actual, key) => {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      fail('INCOMPLETE_EVIDENCE', `${key} debe cubrir ${expected.length} elemento(s).`)
    }
    for (const requirement of expected) {
      const matches = actual.filter((entry) => entry.requirement === requirement)
      if (matches.length !== 1 || matches[0].status !== 'passed' || typeof matches[0].evidence !== 'string' || !matches[0].evidence.trim()) {
        fail('INCOMPLETE_EVIDENCE', `${key} no demuestra: ${requirement}`)
      }
    }
  }
  validateGroup(task.acceptanceCriteria ?? [], evidence.acceptance, 'acceptance')
  validateGroup(task.verification ?? [], evidence.verification, 'verification')
}

const currentMarkdown = (current) => {
  const task = current.task
  const plan = (current.plan ?? []).map((step) => `${step.status === 'done' ? '- [x]' : '- [ ]'} ${step.description}`).join('\n')
  const preclose = current.phase === 'preclose'
    ? `\n## Preclose\n\n- Preparado: \`${current.preclose.preparedAt}\`.\n- HEAD observado: \`${current.preclose.git.head}\`.\n- Fingerprint del candidato: \`${current.preclose.diff.candidateFingerprint}\`.\n`
    : ''
  return `# Sesión actual\n\nEstado: active\nModo: ${current.mode}\nId: ${current.sessionId}\n\n## Objetivo\n\n${current.objective}\n\n## Plan\n\n${plan}\n\n## Paso actual\n\n${current.phase === 'preclose' ? 'Candidato validado; ejecutar close sin alterar el diff.' : 'Implementar dentro del write-set y reunir evidencia de aceptación y verificación.'}\n\n## Decisiones vigentes\n\n${(task.decisionRefs ?? []).map((id) => `- \`${id}\`.`).join('\n')}\n\n## Baseline y write-set\n\n- Branch: \`${current.git.baseBranch}\`.\n- Commit: \`${current.git.baseCommit}\`.\n- Worktree: \`${current.git.worktree}\`.\n- Cambios preexistentes: ${current.git.preexistingChanges.length}.\n- Write-set:\n${current.writeSet.map((path) => `  - \`${path}\``).join('\n')}\n${preclose}\n## Bloqueos\n\n- Ninguno.\n`
}

const idleMarkdown = (taskId, summary, closedAt) => `# Sesión actual\n\nEstado: idle\nModo: ninguno\nId: ninguno\n\n## Objetivo\n\nNo hay una tarea activa. \`${taskId}\` cerró mediante lifecycle atómico.\n\n## Plan\n\n- [x] ${summary}\n\n## Último paso completado\n\nCierre gobernado de \`${taskId}\` a las \`${closedAt}\`.\n\n## Paso actual\n\nEsperar el siguiente cálculo del control.\n\n## Próximo paso\n\nEjecutar \`npm run --silent harness:control -- --json\`.\n\n## Bloqueos\n\n- Ninguno.\n`

export const startLifecycle = (root = defaultRoot, options = {}) => {
  ensureNoJournal(root)
  const observed = gitContext(root)
  const backlog = readJson(root, statePaths.backlog)
  const features = readJson(root, statePaths.features)
  const current = readJson(root, statePaths.current)
  const task = (backlog.tasks ?? []).find(({ id }) => id === options.taskId)
  if (!task) fail('TASK_NOT_FOUND', `No existe ${options.taskId}.`)
  if (current.status !== 'idle') fail('INVALID_TRANSITION', `Start requiere checkpoint idle; observado ${current.status}.`)
  if (task.status !== 'ready') fail('INVALID_TASK_STATUS', `${task.id} debe estar ready; observado ${task.status}.`)
  if ((backlog.tasks ?? []).some(({ status }) => status === 'in_progress')) fail('TASK_ALREADY_ACTIVE', 'Ya existe una tarea in_progress.')
  if ((features.features ?? []).some(({ status }) => status === 'in_progress')) fail('FEATURE_ALREADY_ACTIVE', 'Ya existe una feature in_progress.')
  const pending = (task.dependencies ?? []).filter((id) => backlog.tasks.find((candidate) => candidate.id === id)?.status !== 'done')
  if (pending.length) fail('DEPENDENCIES_OPEN', `Dependencias sin cerrar: ${pending.join(', ')}`)
  if ((task.decisionsRequired ?? []).length) fail('HUMAN_DECISION_REQUIRED', 'La tarea conserva decisiones humanas pendientes.')
  if (options.expectedHead && options.expectedHead !== observed.head) fail('BASELINE_MISMATCH', `HEAD esperado ${options.expectedHead}; observado ${observed.head}.`)
  if (options.expectedBranch && options.expectedBranch !== observed.branch) fail('BRANCH_MISMATCH', `Branch esperada ${options.expectedBranch}; observada ${observed.branch}.`)
  if (options.expectedSourcesFingerprint) {
    const report = buildControlReport(root)
    if (report.validation !== 'OK' || report.alignment.status !== 'ALIGNED') {
      fail('CONTROL_NOT_READY', 'El control no está válido y alineado; start queda bloqueado.')
    }
    if (report.facts.harness.sourcesFingerprint !== options.expectedSourcesFingerprint) {
      fail('AUTHORITY_FINGERPRINT_MISMATCH', `Fingerprint esperado ${options.expectedSourcesFingerprint}; observado ${report.facts.harness.sourcesFingerprint}.`)
    }
  }
  const writeSet = validateWriteSet(root, options.writeSet)
  const preexistingChanges = snapshotChanges(root, observed.head)
  const overlaps = preexistingChanges.filter(({ path }) => matchesWriteSet(path, writeSet)).map(({ path }) => path)
  if (overlaps.length) fail('PREEXISTING_OVERLAP', `Cambios preexistentes solapan el write-set: ${overlaps.join(', ')}`)

  const startedAt = nowIso(options.clock ?? (() => new Date()))
  const sessionId = options.sessionId ?? `${task.id.toLowerCase()}-${startedAt.replace(/\D/gu, '').slice(0, 14)}`
  if ((features.features ?? []).some(({ id }) => id === sessionId)) fail('SESSION_ALREADY_EXISTS', `La sesión ${sessionId} ya existe.`)
  const feature = {
    id: sessionId,
    backlogTaskId: task.id,
    type: task.type,
    status: 'in_progress',
    title: task.title,
    objective: task.objective,
    scope: structuredClone(task.scope),
    acceptanceCriteria: structuredClone(task.acceptanceCriteria),
    verification: structuredClone(task.verification),
    decisionRefs: structuredClone(task.decisionRefs),
    git: { ...observed, baseBranch: observed.branch, baseCommit: observed.head, preexistingChanges },
    writeSet,
    startedAt,
  }
  task.status = 'in_progress'
  features.features.unshift(feature)
  const nextCurrent = {
    schemaVersion: 1,
    status: 'active',
    sessionId,
    backlogTaskId: task.id,
    mode: 'harness-development',
    phase: 'implementation',
    startedAt,
    objective: task.objective,
    task: {
      id: task.id,
      title: task.title,
      scope: structuredClone(task.scope),
      acceptanceCriteria: structuredClone(task.acceptanceCriteria),
      verification: structuredClone(task.verification),
      decisionRefs: structuredClone(task.decisionRefs),
    },
    git: feature.git,
    writeSet,
    lastCompleted: current.lastCompleted ?? null,
    nextRecommended: `Implementar ${task.id} dentro del write-set declarado`,
    plan: [
      { id: 'implementation', status: 'in_progress', description: 'Implementar el alcance gobernado' },
      { id: 'verification', status: 'pending', description: 'Reunir aceptación, verificación y diff' },
      { id: 'closure', status: 'pending', description: 'Ejecutar el cierre atómico' },
    ],
    files: writeSet,
    blockers: [],
  }
  const writes = new Map([
    [statePaths.backlog, json(backlog)],
    [statePaths.features, json(features)],
    [statePaths.current, json(nextCurrent)],
    [statePaths.currentMd, currentMarkdown(nextCurrent)],
  ])
  const transaction = applyAtomicFileTransaction(root, 'start', writes, options.transaction)
  return { transition: 'start', sessionId, taskId: task.id, git: feature.git, writeSet, transaction }
}

export const precloseLifecycle = (root = defaultRoot, options = {}) => {
  ensureNoJournal(root)
  const current = readJson(root, statePaths.current)
  if (current.status !== 'active' || !['implementation', 'preclose'].includes(current.phase)) {
    fail('INVALID_TRANSITION', `Preclose requiere active/implementation o un preclose a refrescar; observado ${current.status}/${current.phase ?? 'sin fase'}.`)
  }
  const backlog = readJson(root, statePaths.backlog)
  const features = readJson(root, statePaths.features)
  const task = backlog.tasks.find(({ id }) => id === current.backlogTaskId)
  const feature = features.features.find(({ id }) => id === current.sessionId)
  if (task?.status !== 'in_progress' || feature?.status !== 'in_progress' || feature.backlogTaskId !== task.id) {
    fail('STATE_MISMATCH', 'Backlog, feature y checkpoint no describen la misma tarea activa.')
  }
  const evidence = options.evidence
  validateEvidence(current.task, evidence)
  const observed = assertBranchAndBaseline(root, current)
  const diff = validateScopeDiff(root, current)
  const preparedAt = nowIso(options.clock ?? (() => new Date()))
  const receipt = {
    schema: 'ai-harness.git-diff-receipt/v1',
    baseCommit: current.git.baseCommit,
    head: observed.head,
    branch: observed.branch,
    worktree: observed.worktree,
    linkedWorktree: observed.linkedWorktree,
    changedPaths: diff.paths,
    ownedPaths: diff.ownedPaths,
    preservedPreexistingPaths: diff.preservedPreexistingPaths,
    nameStatus: baselineNameStatus(root, current.git.baseCommit),
    workingTree: porcelainEntries(root),
    candidateFingerprint: candidateFingerprint(root, current, diff.ownedPaths),
  }
  const nextCurrent = structuredClone(current)
  nextCurrent.phase = 'preclose'
  nextCurrent.preclose = { preparedAt, evidence: structuredClone(evidence), git: observed, diff: receipt }
  nextCurrent.nextRecommended = 'Ejecutar close sin alterar el candidato validado'
  nextCurrent.plan = (nextCurrent.plan ?? []).map((step) => ({
    ...step,
    status: step.id === 'closure' ? step.status : 'done',
  }))
  feature.phase = 'preclose'
  feature.preparedAt = preparedAt
  const writes = new Map([
    [statePaths.features, json(features)],
    [statePaths.current, json(nextCurrent)],
    [statePaths.currentMd, currentMarkdown(nextCurrent)],
  ])
  const transaction = applyAtomicFileTransaction(root, 'preclose', writes, options.transaction)
  return { transition: 'preclose', sessionId: current.sessionId, taskId: task.id, diff: receipt, transaction }
}

export const closeLifecycle = (root = defaultRoot, options = {}) => {
  ensureNoJournal(root)
  if (typeof options.summary !== 'string' || !options.summary.trim()) fail('SUMMARY_REQUIRED', 'Close requiere un resumen no vacío.')
  const current = readJson(root, statePaths.current)
  if (current.status !== 'active' || current.phase !== 'preclose' || !current.preclose) {
    fail('INVALID_TRANSITION', `Close requiere active/preclose; observado ${current.status}/${current.phase ?? 'sin fase'}.`)
  }
  const backlog = readJson(root, statePaths.backlog)
  const features = readJson(root, statePaths.features)
  const task = backlog.tasks.find(({ id }) => id === current.backlogTaskId)
  const feature = features.features.find(({ id }) => id === current.sessionId)
  if (task?.status !== 'in_progress' || feature?.status !== 'in_progress' || feature.backlogTaskId !== task.id) {
    fail('STATE_MISMATCH', 'Backlog, feature y checkpoint no describen la misma tarea preclose.')
  }
  const observed = assertBranchAndBaseline(root, current)
  const diff = validateScopeDiff(root, current)
  const fingerprint = candidateFingerprint(root, current, diff.ownedPaths)
  if (fingerprint !== current.preclose.diff.candidateFingerprint) {
    fail('CANDIDATE_CHANGED', 'El candidato cambió después de preclose; vuelve a ejecutar preclose con evidencia nueva.')
  }
  const closedAt = nowIso(options.clock ?? (() => new Date()))
  const day = dayOf(closedAt)
  const receiptPath = `ai-harness-local/receipts/${day.slice(0, 4)}/${day}/${current.sessionId}.json`
  const featurePath = `ai-harness-local/features/done/${day.slice(0, 4)}/${day}-${current.sessionId}.json`
  if (existsSync(join(root, receiptPath)) || existsSync(join(root, featurePath))) {
    fail('RECEIPT_ALREADY_EXISTS', 'Close no sobrescribe recibos existentes.')
  }
  const receipt = {
    schema: 'ai-harness.lifecycle-close-receipt/v1',
    sessionId: current.sessionId,
    backlogTaskId: task.id,
    status: 'done',
    startedAt: current.startedAt,
    preparedAt: current.preclose.preparedAt,
    closedAt,
    summary: options.summary.trim(),
    task: structuredClone(current.task),
    git: {
      branch: current.git.baseBranch,
      baseCommit: current.git.baseCommit,
      headAtClose: observed.head,
      worktree: observed.worktree,
      linkedWorktree: observed.linkedWorktree,
      preexistingChanges: structuredClone(current.git.preexistingChanges ?? []),
      diff: structuredClone(current.preclose.diff),
    },
    evidence: structuredClone(current.preclose.evidence),
    decisionRefs: structuredClone(current.task.decisionRefs ?? []),
    productChanges: options.productChanges === true,
  }
  task.status = 'done'
  feature.status = 'done'
  feature.completedAt = closedAt
  feature.result = { summary: receipt.summary, receipt: receiptPath, featureReceipt: featurePath }
  const featureReceipt = { ...structuredClone(receipt), schema: 'ai-harness.feature-close-receipt/v1', feature: structuredClone(feature) }
  const previousHistory = readFileSync(join(root, statePaths.history), 'utf8').trimEnd()
  const history = `${previousHistory}\n\n## ${day} — ${task.id}: ${task.title}\n\n- ${receipt.summary}\n- Baseline: \`${current.git.baseCommit}\`; HEAD al cierre: \`${observed.head}\`; branch: \`${observed.branch}\`.\n- Preclose validó ${current.task.acceptanceCriteria.length} criterios, ${current.task.verification.length} verificaciones y ${current.preclose.diff.ownedPaths.length} rutas del write-set.\n- Recibo: \`${receiptPath}\`.\n`
  const idle = {
    schemaVersion: 1,
    status: 'idle',
    sessionId: null,
    backlogTaskId: null,
    mode: null,
    phase: null,
    startedAt: null,
    objective: null,
    lastCompleted: `${closedAt}: ${task.id} — ${receipt.summary}`,
    nextRecommended: 'Recalcular el control y seleccionar una única tarea elegible',
    plan: [
      { id: 'implementation', status: 'done', description: 'Implementar el alcance gobernado' },
      { id: 'verification', status: 'done', description: 'Reunir aceptación, verificación y diff' },
      { id: 'closure', status: 'done', description: 'Ejecutar el cierre atómico' },
    ],
    files: current.writeSet,
    blockers: [],
    lastReceipt: receiptPath,
  }
  const writes = new Map([
    [statePaths.backlog, json(backlog)],
    [statePaths.features, json(features)],
    [statePaths.current, json(idle)],
    [statePaths.currentMd, idleMarkdown(task.id, receipt.summary, closedAt)],
    [statePaths.history, history],
    [receiptPath, json(receipt)],
    [featurePath, json(featureReceipt)],
  ])
  const transaction = applyAtomicFileTransaction(root, 'close', writes, options.transaction)
  return { transition: 'close', sessionId: current.sessionId, taskId: task.id, receiptPath, featurePath, transaction }
}

const parseCli = (argv) => {
  const [command, ...args] = argv
  const values = new Map()
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    if (!flag.startsWith('--')) fail('INVALID_ARGUMENT', `Argumento inesperado: ${flag}`)
    const value = args[++index]
    if (value === undefined || value.startsWith('--')) fail('INVALID_ARGUMENT', `Falta valor para ${flag}`)
    const previous = values.get(flag)
    values.set(flag, previous === undefined ? value : Array.isArray(previous) ? [...previous, value] : [previous, value])
  }
  const many = (flag) => {
    const value = values.get(flag)
    return value === undefined ? [] : Array.isArray(value) ? value : [value]
  }
  return { command, values, many }
}

const runCli = () => {
  const { command, values, many } = parseCli(process.argv.slice(2))
  let result
  if (command === 'start') {
    result = startLifecycle(defaultRoot, {
      taskId: values.get('--task'),
      sessionId: values.get('--session'),
      expectedHead: values.get('--expected-head'),
      expectedBranch: values.get('--expected-branch'),
      expectedSourcesFingerprint: values.get('--expected-fingerprint'),
      writeSet: many('--write-set'),
    })
  } else if (command === 'preclose') {
    const evidencePath = values.get('--evidence')
    if (!evidencePath) fail('INVALID_ARGUMENT', 'Preclose requiere --evidence <archivo.json>.')
    result = precloseLifecycle(defaultRoot, { evidence: JSON.parse(readFileSync(resolve(evidencePath), 'utf8')) })
  } else if (command === 'close') {
    result = closeLifecycle(defaultRoot, {
      summary: values.get('--summary'),
      productChanges: values.get('--product-changes') === 'true',
    })
  } else if (command === 'recover') {
    result = recoverLifecycle(defaultRoot)
  } else {
    fail('INVALID_COMMAND', 'Uso: lifecycle start|preclose|close|recover')
  }
  process.stdout.write(`${json(result)}`)
}

const isMain = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url
if (isMain) {
  try {
    runCli()
  } catch (error) {
    console.error(`${error.code ?? 'LIFECYCLE_ERROR'}: ${error.message}`)
    process.exitCode = 1
  }
}

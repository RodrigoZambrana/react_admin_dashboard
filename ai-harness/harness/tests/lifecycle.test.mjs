import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'

import {
  closeLifecycle,
  precloseLifecycle,
  recoverLifecycle,
  startLifecycle,
} from '../lifecycle.mjs'

const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
const readJson = (root, path) => JSON.parse(readFileSync(join(root, path), 'utf8'))
const stateFiles = [
  'planning/backlog.json',
  'ai-harness-local/feature_list.json',
  'ai-harness-local/progress/current.json',
  'ai-harness-local/progress/current.md',
  'ai-harness-local/progress/history.md',
]
const requiredWriteSet = [
  'src/owned.txt',
  'planning/backlog.json',
  'ai-harness-local/feature_list.json',
  'ai-harness-local/features/done/',
  'ai-harness-local/progress/',
  'ai-harness-local/receipts/',
]

const task = {
  id: 'HAR-002',
  title: 'Lifecycle test',
  product: 'AI Harness',
  type: 'harness-governance',
  status: 'ready',
  objective: 'Probar transiciones',
  scope: { in: ['lifecycle'], out: ['remote'] },
  dependencies: ['HAR-001'],
  acceptanceCriteria: ['La transición es atómica.', 'El diff queda gobernado.'],
  verification: ['Tests Git temporales.'],
  decisionsRequired: [],
  decisionRefs: ['DEC-001'],
}

const makeFixture = () => {
  const root = mkdtempSync(join(tmpdir(), 'growth-lifecycle-'))
  for (const path of [
    'planning',
    'ai-harness-local/progress',
    'ai-harness-local/features/done',
    'ai-harness-local/receipts',
    'src',
  ]) mkdirSync(join(root, path), { recursive: true })
  writeJson(join(root, 'planning/backlog.json'), {
    schemaVersion: 1,
    tasks: [{ id: 'HAR-001', status: 'done' }, structuredClone(task)],
  })
  writeJson(join(root, 'ai-harness-local/feature_list.json'), { features: [] })
  writeJson(join(root, 'ai-harness-local/progress/current.json'), {
    schemaVersion: 1,
    status: 'idle',
    sessionId: null,
    lastCompleted: 'fixture',
  })
  writeFileSync(join(root, 'ai-harness-local/progress/current.md'), '# Sesión actual\n\nEstado: idle\n')
  writeFileSync(join(root, 'ai-harness-local/progress/history.md'), '# Historial\n')
  writeFileSync(join(root, 'src/owned.txt'), 'base\n')
  writeFileSync(join(root, 'legacy.txt'), 'legacy\n')
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root })
  git(root, 'config', 'user.name', 'Harness Test')
  git(root, 'config', 'user.email', 'harness@example.invalid')
  git(root, 'add', '.')
  git(root, 'commit', '-qm', 'fixture')
  return root
}

const evidence = () => ({
  schema: 'ai-harness.preclose-evidence/v1',
  taskId: 'HAR-002',
  acceptance: task.acceptanceCriteria.map((requirement) => ({ requirement, status: 'passed', evidence: 'node --test' })),
  verification: task.verification.map((requirement) => ({ requirement, status: 'passed', evidence: 'suite passed' })),
})

const snapshot = (root) => Object.fromEntries(stateFiles.map((path) => [path, readFileSync(join(root, path), 'utf8')]))

test('una transición inválida falla sin modificar autoridades', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const before = snapshot(root)

  assert.throws(() => precloseLifecycle(root, { evidence: evidence() }), { code: 'INVALID_TRANSITION' })
  assert.deepEqual(snapshot(root), before)
})

test('start limpio conserva tarea, alcance, baseline, branch y write-set', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const baseline = git(root, 'rev-parse', 'HEAD')

  const result = startLifecycle(root, {
    taskId: 'HAR-002',
    sessionId: 'clean-session',
    expectedHead: baseline,
    expectedBranch: 'main',
    writeSet: requiredWriteSet,
  })
  const current = readJson(root, 'ai-harness-local/progress/current.json')

  assert.equal(result.sessionId, 'clean-session')
  assert.equal(current.status, 'active')
  assert.equal(current.phase, 'implementation')
  assert.equal(current.git.baseCommit, baseline)
  assert.equal(current.git.baseBranch, 'main')
  assert.deepEqual(current.git.preexistingChanges, [])
  assert.deepEqual(current.task.scope, task.scope)
  assert.deepEqual(current.writeSet, [...requiredWriteSet].sort())
  assert.equal(readJson(root, 'planning/backlog.json').tasks[1].status, 'in_progress')
})

test('start clasifica cambios sucios ajenos y preclose exige que permanezcan intactos', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(join(root, 'legacy.txt'), 'cambio previo\n')

  startLifecycle(root, { taskId: 'HAR-002', sessionId: 'dirty-session', writeSet: requiredWriteSet })
  let current = readJson(root, 'ai-harness-local/progress/current.json')
  assert.deepEqual(current.git.preexistingChanges.map(({ path }) => path), ['legacy.txt'])

  writeFileSync(join(root, 'src/owned.txt'), 'implementado\n')
  const prepared = precloseLifecycle(root, { evidence: evidence() })
  assert.ok(prepared.diff.ownedPaths.includes('src/owned.txt'))
  assert.deepEqual(prepared.diff.preservedPreexistingPaths, ['legacy.txt'])
  assert.ok(prepared.diff.nameStatus.some(({ path }) => path === 'src/owned.txt'))
  assert.ok(prepared.diff.workingTree.some(({ path }) => path === 'legacy.txt'))
  current = readJson(root, 'ai-harness-local/progress/current.json')
  assert.equal(current.phase, 'preclose')
})

test('preclose rechaza evidencia incompleta y mutaciones fuera del write-set sin tocar estado', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  startLifecycle(root, { taskId: 'HAR-002', sessionId: 'guard-session', writeSet: requiredWriteSet })
  let before = snapshot(root)
  const incomplete = evidence()
  incomplete.acceptance.pop()
  assert.throws(() => precloseLifecycle(root, { evidence: incomplete }), { code: 'INCOMPLETE_EVIDENCE' })
  assert.deepEqual(snapshot(root), before)

  writeFileSync(join(root, 'legacy.txt'), 'cambio nuevo\n')
  before = snapshot(root)
  assert.throws(() => precloseLifecycle(root, { evidence: evidence() }), { code: 'WRITE_SET_VIOLATION' })
  assert.deepEqual(snapshot(root), before)
})

test('un linked worktree conserva su identidad y branch en el recibo Git', (t) => {
  const primary = makeFixture()
  const parent = dirname(primary)
  const worktree = join(parent, `${primary.split('/').at(-1)}-worktree`)
  t.after(() => {
    try { execFileSync('git', ['worktree', 'remove', '--force', worktree], { cwd: primary }) } catch {}
    rmSync(primary, { recursive: true, force: true })
    rmSync(worktree, { recursive: true, force: true })
  })
  execFileSync('git', ['worktree', 'add', '-q', '-b', 'lifecycle-worktree', worktree], { cwd: primary })

  const result = startLifecycle(worktree, {
    taskId: 'HAR-002',
    sessionId: 'worktree-session',
    expectedBranch: 'lifecycle-worktree',
    writeSet: requiredWriteSet,
  })

  assert.equal(result.git.linkedWorktree, true)
  assert.equal(result.git.baseBranch, 'lifecycle-worktree')
  assert.equal(result.git.worktree, realpathSync(worktree))
  assert.notEqual(result.git.gitDir, result.git.commonDir)
})

test('una escritura fallida revierte start por completo', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const before = snapshot(root)

  assert.throws(() => startLifecycle(root, {
    taskId: 'HAR-002',
    sessionId: 'rollback-session',
    writeSet: requiredWriteSet,
    transaction: { failAfterWrites: 2 },
  }), { code: 'INJECTED_FAILURE' })

  assert.deepEqual(snapshot(root), before)
  assert.equal(recoverLifecycle(root).recovered, false)
})

test('recover restaura una transición interrumpida a partir del journal Git', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const before = snapshot(root)

  assert.throws(() => startLifecycle(root, {
    taskId: 'HAR-002',
    sessionId: 'crash-session',
    writeSet: requiredWriteSet,
    transaction: { crashAfterWrites: 2 },
  }), { code: 'SIMULATED_CRASH' })
  assert.notDeepEqual(snapshot(root), before)

  const recovery = recoverLifecycle(root)
  assert.equal(recovery.recovered, true)
  assert.equal(recovery.transition, 'start')
  assert.deepEqual(snapshot(root), before)
})

test('close actualiza todas las fuentes o las revierte como una unidad', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  startLifecycle(root, { taskId: 'HAR-002', sessionId: 'close-session', writeSet: requiredWriteSet })
  writeFileSync(join(root, 'src/owned.txt'), 'implementado\n')
  precloseLifecycle(root, { evidence: evidence() })
  const beforeFailedClose = snapshot(root)

  assert.throws(() => closeLifecycle(root, {
    summary: 'Lifecycle verificado.',
    clock: () => new Date('2026-09-08T23:30:00.000Z'),
    transaction: { failAfterWrites: 7 },
  }), { code: 'INJECTED_FAILURE' })
  assert.deepEqual(snapshot(root), beforeFailedClose)
  assert.equal(readJson(root, 'planning/backlog.json').tasks[1].status, 'in_progress')
  assert.equal(existsSync(join(root, 'ai-harness-local/receipts/2026/2026-09-08/close-session.json')), false)
  assert.equal(existsSync(join(root, 'ai-harness-local/features/done/2026/2026-09-08-close-session.json')), false)

  const result = closeLifecycle(root, {
    summary: 'Lifecycle verificado.',
    clock: () => new Date('2026-09-08T23:30:00.000Z'),
  })
  const commitPaths = git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', result.commit.id).split('\n').filter(Boolean).sort()
  assert.equal(readJson(root, 'planning/backlog.json').tasks[1].status, 'done')
  assert.equal(readJson(root, 'ai-harness-local/feature_list.json').features[0].status, 'done')
  assert.equal(readJson(root, 'ai-harness-local/progress/current.json').status, 'idle')
  assert.equal(readJson(root, result.receiptPath).status, 'done')
  assert.equal(readJson(root, result.featurePath).schema, 'ai-harness.feature-close-receipt/v2')
  assert.equal(readJson(root, result.receiptPath).schema, 'ai-harness.lifecycle-close-receipt/v2')
  assert.equal(git(root, 'rev-parse', 'HEAD'), result.commit.id)
  assert.deepEqual(commitPaths, result.commit.paths)
  assert.equal(git(root, 'status', '--porcelain=v1'), '')
  const committedReceipt = JSON.parse(git(root, 'show', `${result.commit.id}:${result.receiptPath}`))
  assert.equal(committedReceipt.git.commit.sessionTrailer, 'AI-Harness-Session: close-session')
  assert.deepEqual(committedReceipt.git.commit.paths, commitPaths)
  assert.equal(git(root, 'log', '--all', '--format=%H', '--grep=AI-Harness-Session: close-session'), result.commit.id)
  assert.match(readFileSync(join(root, 'ai-harness-local/progress/history.md'), 'utf8'), /HAR-002: Lifecycle test/u)
})

test('un fallo de commit restaura estado, index y artefactos sin cerrar la tarea', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  startLifecycle(root, { taskId: 'HAR-002', sessionId: 'commit-failure', writeSet: requiredWriteSet })
  writeFileSync(join(root, 'src/owned.txt'), 'implementado\n')
  precloseLifecycle(root, { evidence: evidence() })
  const headBefore = git(root, 'rev-parse', 'HEAD')
  const stateBefore = snapshot(root)
  const indexBefore = git(root, 'diff', '--cached', '--binary')
  const statusBefore = git(root, 'status', '--porcelain=v1')

  assert.throws(() => closeLifecycle(root, {
    summary: 'No debe consolidarse.',
    transaction: { failCommit: true },
  }), { code: 'COMMIT_FAILED' })

  assert.equal(git(root, 'rev-parse', 'HEAD'), headBefore)
  assert.deepEqual(snapshot(root), stateBefore)
  assert.equal(git(root, 'diff', '--cached', '--binary'), indexBefore)
  assert.equal(git(root, 'status', '--porcelain=v1'), statusBefore)
  assert.equal(readJson(root, 'planning/backlog.json').tasks[1].status, 'in_progress')
  assert.equal(readJson(root, 'ai-harness-local/progress/current.json').phase, 'preclose')
  assert.equal(existsSync(join(root, 'ai-harness-local/receipts/2026/2026-09-08/commit-failure.json')), false)
})

test('close excluye archivos ajenos al write-set y los conserva sin stage', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(join(root, 'legacy.txt'), 'cambio previo sin stage\n')
  startLifecycle(root, { taskId: 'HAR-002', sessionId: 'foreign-file', writeSet: requiredWriteSet })
  writeFileSync(join(root, 'src/owned.txt'), 'implementado\n')
  precloseLifecycle(root, { evidence: evidence() })

  const result = closeLifecycle(root, { summary: 'Candidato aislado.' })
  const commitPaths = git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', result.commit.id).split('\n').filter(Boolean)

  assert.ok(!commitPaths.includes('legacy.txt'))
  assert.equal(readFileSync(join(root, 'legacy.txt'), 'utf8'), 'cambio previo sin stage\n')
  assert.equal(git(root, 'diff', '--name-only', '--', 'legacy.txt'), 'legacy.txt')
  assert.equal(git(root, 'diff', '--cached', '--name-only', '--', 'legacy.txt'), '')
})

test('close preserva un index preexistente y no lo incorpora al commit', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(join(root, 'legacy.txt'), 'cambio previo staged\n')
  git(root, 'add', 'legacy.txt')
  const stagedBefore = git(root, 'diff', '--cached', '--binary', '--', 'legacy.txt')
  startLifecycle(root, { taskId: 'HAR-002', sessionId: 'preexisting-index', writeSet: requiredWriteSet })
  writeFileSync(join(root, 'src/owned.txt'), 'implementado\n')
  precloseLifecycle(root, { evidence: evidence() })

  const result = closeLifecycle(root, { summary: 'Index aislado.' })
  const commitPaths = git(root, 'diff-tree', '--no-commit-id', '--name-only', '-r', result.commit.id).split('\n').filter(Boolean)

  assert.ok(!commitPaths.includes('legacy.txt'))
  assert.equal(git(root, 'diff', '--cached', '--binary', '--', 'legacy.txt'), stagedBefore)
  assert.match(git(root, 'status', '--porcelain=v1'), /^M  legacy\.txt$/mu)
})

test('close crea el commit en la branch de un linked worktree', (t) => {
  const primary = makeFixture()
  const parent = dirname(primary)
  const worktree = join(parent, `${primary.split('/').at(-1)}-close-worktree`)
  t.after(() => {
    try { execFileSync('git', ['worktree', 'remove', '--force', worktree], { cwd: primary }) } catch {}
    rmSync(primary, { recursive: true, force: true })
    rmSync(worktree, { recursive: true, force: true })
  })
  const primaryHead = git(primary, 'rev-parse', 'HEAD')
  execFileSync('git', ['worktree', 'add', '-q', '-b', 'close-worktree', worktree], { cwd: primary })
  startLifecycle(worktree, { taskId: 'HAR-002', sessionId: 'linked-close', writeSet: requiredWriteSet })
  writeFileSync(join(worktree, 'src/owned.txt'), 'implementado en worktree\n')
  precloseLifecycle(worktree, { evidence: evidence() })

  const result = closeLifecycle(worktree, { summary: 'Linked worktree consolidado.' })

  assert.equal(result.commit.branch, 'close-worktree')
  assert.equal(git(worktree, 'rev-parse', 'HEAD'), result.commit.id)
  assert.equal(git(primary, 'rev-parse', 'HEAD'), primaryHead)
  assert.equal(readJson(worktree, result.receiptPath).git.linkedWorktree, true)
  assert.equal(git(worktree, 'status', '--porcelain=v1'), '')
})

test('recover revierte un cierre interrumpido después de crear el commit', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  startLifecycle(root, { taskId: 'HAR-002', sessionId: 'commit-recovery', writeSet: requiredWriteSet })
  writeFileSync(join(root, 'src/owned.txt'), 'implementado\n')
  precloseLifecycle(root, { evidence: evidence() })
  const headBefore = git(root, 'rev-parse', 'HEAD')
  const stateBefore = snapshot(root)
  const statusBefore = git(root, 'status', '--porcelain=v1')

  assert.throws(() => closeLifecycle(root, {
    summary: 'Cierre interrumpido.',
    transaction: { crashAfterCommit: true },
  }), { code: 'SIMULATED_COMMIT_CRASH' })
  assert.notEqual(git(root, 'rev-parse', 'HEAD'), headBefore)
  assert.equal(readJson(root, 'planning/backlog.json').tasks[1].status, 'done')

  const recovery = recoverLifecycle(root)
  assert.equal(recovery.recovered, true)
  assert.equal(recovery.transition, 'close')
  assert.equal(git(root, 'rev-parse', 'HEAD'), headBefore)
  assert.deepEqual(snapshot(root), stateBefore)
  assert.equal(git(root, 'status', '--porcelain=v1'), statusBefore)
})

test('preclose falla sin mutar cuando cambia la branch fijada por start', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  startLifecycle(root, { taskId: 'HAR-002', sessionId: 'branch-session', writeSet: requiredWriteSet })
  git(root, 'switch', '-qc', 'otra-branch')
  const before = snapshot(root)

  assert.throws(() => precloseLifecycle(root, { evidence: evidence() }), { code: 'BRANCH_CHANGED' })
  assert.deepEqual(snapshot(root), before)
})

test('close sincroniza el fragmento dueño cuando está en el write-set', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(join(root, 'planning/fragments'), { recursive: true })
  writeJson(join(root, 'planning/fragments/platform.json'), {
    tasks: [{ id: 'HAR-001', status: 'done' }, structuredClone(task)],
  })
  git(root, 'add', 'planning/fragments/platform.json')
  git(root, 'commit', '-qm', 'fragment')
  const writeSet = [...requiredWriteSet, 'planning/fragments/platform.json']

  startLifecycle(root, { taskId: 'HAR-002', sessionId: 'fragment-sync', writeSet })
  assert.equal(readJson(root, 'planning/fragments/platform.json').tasks.find(({ id }) => id === 'HAR-002').status, 'in_progress')
  writeFileSync(join(root, 'src/owned.txt'), 'implementado\n')
  precloseLifecycle(root, { evidence: evidence() })
  closeLifecycle(root, { summary: 'Vista general y por producto quedan alineadas.' })

  assert.equal(readJson(root, 'planning/backlog.json').tasks.find(({ id }) => id === 'HAR-002').status, 'done')
  assert.equal(readJson(root, 'planning/fragments/platform.json').tasks.find(({ id }) => id === 'HAR-002').status, 'done')
})

test('close promociona sucesores elegibles en el backlog y el fragmento dueño', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const successor = {
    id: 'HAR-003',
    title: 'Sucesor promocionable',
    product: 'AI Harness',
    status: 'blocked',
    blockingReason: 'Espera HAR-002.',
    objective: 'Quedar ready al cerrar la dependencia',
    dependencies: ['HAR-002'],
    decisionsRequired: [],
    acceptanceCriteria: ['El sucesor queda ready.'],
    verification: ['Estado en backlog y fragmento.'],
    decisionRefs: ['DEC-012'],
  }
  const backlog = readJson(root, 'planning/backlog.json')
  backlog.tasks.push(successor)
  writeJson(join(root, 'planning/backlog.json'), backlog)
  mkdirSync(join(root, 'planning/fragments'), { recursive: true })
  writeJson(join(root, 'planning/fragments/platform.json'), {
    tasks: [{ id: 'HAR-001', status: 'done' }, structuredClone(task), structuredClone(successor)],
  })
  git(root, 'add', 'planning/backlog.json', 'planning/fragments/platform.json')
  git(root, 'commit', '-qm', 'successor')
  const writeSet = [...requiredWriteSet, 'planning/fragments/platform.json']

  startLifecycle(root, { taskId: 'HAR-002', sessionId: 'promote-on-close', writeSet })
  writeFileSync(join(root, 'src/owned.txt'), 'implementado\n')
  precloseLifecycle(root, { evidence: evidence() })
  closeLifecycle(root, { summary: 'El cierre promociona sucesores elegibles.' })

  const closedBacklog = readJson(root, 'planning/backlog.json')
  const fragment = readJson(root, 'planning/fragments/platform.json')
  const promoted = closedBacklog.tasks.find(({ id }) => id === 'HAR-003')
  assert.equal(closedBacklog.tasks.find(({ id }) => id === 'HAR-002').status, 'done')
  assert.equal(promoted.status, 'ready')
  assert.equal(promoted.blockingReason, undefined)
  assert.equal(fragment.tasks.find(({ id }) => id === 'HAR-002').status, 'done')
  assert.equal(fragment.tasks.find(({ id }) => id === 'HAR-003').status, 'ready')
})

test('close detecta cambios posteriores a preclose y no altera fuentes', (t) => {
  const root = makeFixture()
  t.after(() => rmSync(root, { recursive: true, force: true }))
  startLifecycle(root, { taskId: 'HAR-002', sessionId: 'changed-session', writeSet: requiredWriteSet })
  writeFileSync(join(root, 'src/owned.txt'), 'primera versión\n')
  precloseLifecycle(root, { evidence: evidence() })
  writeFileSync(join(root, 'src/owned.txt'), 'segunda versión\n')
  const before = snapshot(root)

  assert.throws(() => closeLifecycle(root, { summary: 'No debe cerrar.' }), { code: 'CANDIDATE_CHANGED' })
  assert.deepEqual(snapshot(root), before)
  assert.equal(readJson(root, 'planning/backlog.json').tasks[1].status, 'in_progress')

  const refreshed = evidence()
  refreshed.acceptance[0].evidence = 'suite ejecutada nuevamente'
  precloseLifecycle(root, { evidence: refreshed })
  assert.doesNotThrow(() => closeLifecycle(root, { summary: 'Candidato refrescado y cerrado.' }))
})

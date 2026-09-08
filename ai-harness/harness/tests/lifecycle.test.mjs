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
  assert.equal(readJson(root, 'planning/backlog.json').tasks[1].status, 'done')
  assert.equal(readJson(root, 'ai-harness-local/feature_list.json').features[0].status, 'done')
  assert.equal(readJson(root, 'ai-harness-local/progress/current.json').status, 'idle')
  assert.equal(readJson(root, result.receiptPath).status, 'done')
  assert.equal(readJson(root, result.featurePath).schema, 'ai-harness.feature-close-receipt/v1')
  assert.match(readFileSync(join(root, 'ai-harness-local/progress/history.md'), 'utf8'), /HAR-002: Lifecycle test/u)
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

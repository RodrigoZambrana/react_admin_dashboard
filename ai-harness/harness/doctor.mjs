#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const harnessDir = dirname(dirname(fileURLToPath(import.meta.url)))
const root = dirname(harnessDir)
const configPath = join(harnessDir, 'config', 'project.json')
const versionPath = join(harnessDir, 'VERSION')
const errors = []
const warnings = []
const ok = []

const add = (bucket, message) => bucket.push(message)
const parseJson = (path, label) => {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    add(errors, `${label}: ${error.message}`)
    return null
  }
}

const git = (...args) =>
  execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

if (!existsSync(configPath)) {
  add(errors, 'Falta ai-harness/config/project.json')
}

const config = existsSync(configPath) ? parseJson(configPath, 'Configuración inválida') : null
const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor < 20) add(errors, `Node ${process.versions.node}: se requiere Node >=20`)
else add(ok, `Node ${process.versions.node}`)

if (!existsSync(versionPath)) add(errors, 'Falta ai-harness/VERSION')
else {
  const version = readFileSync(versionPath, 'utf8').trim()
  if (!/^\d+\.\d+\.\d+$/u.test(version)) add(errors, `Versión de harness inválida: ${version}`)
  if (!existsSync(join(harnessDir, 'releases', `${version}.md`))) {
    add(errors, `Falta release note para harness ${version}`)
  }
}

if (config) {
  const ids = new Set()
  for (const workspace of config.workspaces ?? []) {
    if (!workspace.id || ids.has(workspace.id)) {
      add(errors, `Workspace sin id único: ${workspace.id ?? '(vacío)'}`)
      continue
    }
    ids.add(workspace.id)
    const workspacePath = join(root, workspace.path)
    if (!existsSync(workspacePath)) {
      add(errors, `${workspace.id}: no existe ${workspace.path}`)
      continue
    }
    const levels = workspace.verification ?? {}
    if (!Array.isArray(levels.quick) || levels.quick.length === 0) {
      add(errors, `${workspace.id}: falta verificación quick`)
    }
    const cwd = join(root, workspace.verificationCwd ?? workspace.path)
    if (!existsSync(cwd)) add(errors, `${workspace.id}: verificationCwd no existe`)
    add(ok, `${workspace.id} -> ${workspace.path}`)
  }

  for (const doc of config.canonicalDocs ?? []) {
    if (!existsSync(join(root, doc))) add(errors, `Falta documento canónico: ${doc}`)
  }
}

const currentPath = join(root, 'ai-harness-local', 'progress', 'current.json')
if (!existsSync(currentPath)) add(errors, 'Falta el checkpoint ai-harness-local/progress/current.json')
else {
  const current = parseJson(currentPath, 'Checkpoint inválido')
  if (current && !['idle', 'active', 'blocked'].includes(current.status)) {
    add(errors, `Estado de checkpoint no admitido: ${current.status}`)
  }
  const featurePath = join(root, 'ai-harness-local', 'feature_list.json')
  if (!existsSync(featurePath)) add(errors, 'Falta ai-harness-local/feature_list.json')
  else {
    const featureList = parseJson(featurePath, 'Feature list inválida')
    const active = featureList?.features?.filter(({ status }) => status === 'in_progress') ?? []
    if (active.length > 1) add(errors, 'Hay más de una feature in_progress')
    if (current?.status === 'active' && active[0]?.id !== current.sessionId) {
      add(errors, 'El checkpoint activo no coincide con feature_list.json')
    }
  }

  const currentMdPath = join(root, 'ai-harness-local', 'progress', 'current.md')
  if (!existsSync(currentMdPath)) add(errors, 'Falta el checkpoint humano progress/current.md')
  else if (current?.sessionId) {
    const currentMd = readFileSync(currentMdPath, 'utf8')
    if (!currentMd.includes(`Id: ${current.sessionId}`)) add(errors, 'current.md no coincide con sessionId')
  }
}

const decisionsPath = join(root, 'ai-harness-local', 'decisions', 'index.json')
if (!existsSync(decisionsPath)) add(errors, 'Falta el registro local de decisiones')
else {
  const decisionLog = parseJson(decisionsPath, 'Registro de decisiones inválido')
  const ids = new Set()
  for (const decision of decisionLog?.decisions ?? []) {
    if (!/^DEC-\d{3}$/u.test(decision.id ?? '')) add(errors, `Id de decisión inválido: ${decision.id}`)
    if (ids.has(decision.id)) add(errors, `Decisión duplicada: ${decision.id}`)
    ids.add(decision.id)
    if (!['accepted', 'proposed', 'superseded'].includes(decision.status)) {
      add(errors, `Estado de decisión inválido: ${decision.id}`)
    }
    for (const ref of decision.sourceRefs ?? []) {
      if (!existsSync(join(root, ref))) add(errors, `${decision.id}: fuente inexistente ${ref}`)
    }
  }
  add(ok, `${ids.size} decisiones locales registradas`)
}

try {
  const tracked = git('ls-files').split('\n').filter(Boolean)
  const trackedSecrets = tracked.filter((path) => {
    const name = path.split('/').at(-1)
    return name === '.env' || (name?.startsWith('.env.') && !name.endsWith('.example'))
  })
  if (trackedSecrets.length) add(errors, `Archivos de entorno versionados: ${trackedSecrets.join(', ')}`)
  else add(ok, 'No hay archivos .env reales versionados')

  const generatedSegments = new Set(['dist', 'build', 'coverage', '.next', 'test-results', '.cache'])
  const suspect = tracked.filter((path) =>
    path.split('/').some((part) => generatedSegments.has(part)) ||
    path.endsWith('.bak') || path.endsWith('.DS_Store') || path.endsWith('.sql.gz'),
  )
  if (suspect.length) {
    add(warnings, `${suspect.length} artefactos generados/backups están versionados; revisar inventario de limpieza`)
  }

  const dirty = git('status', '--porcelain=v1', '--untracked-files=all').split('\n').filter(Boolean)
  if (dirty.length) add(warnings, `Working tree con ${dirty.length} cambios; delimitar ownership antes de editar`)
  else add(ok, 'Working tree limpio')

  const gitDir = git('rev-parse', '--absolute-git-dir').trim()
  const commonDir = git('rev-parse', '--path-format=absolute', '--git-common-dir').trim()
  if (gitDir !== commonDir) add(warnings, 'Checkout enlazado/worktree: confirmar estrategia antes de cambios amplios')
  else add(ok, 'Checkout canónico')
} catch (error) {
  add(errors, `No se pudo inspeccionar Git: ${error.message}`)
}

const result = {
  projectRoot: root,
  harnessVersion: existsSync(versionPath)
    ? readFileSync(versionPath, 'utf8').trim()
    : null,
  ok,
  warnings,
  errors,
}

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
} else {
  console.log(`AI Harness ${result.harnessVersion ?? 'sin versión'}`)
  for (const message of ok) console.log(`✓ ${message}`)
  for (const message of warnings) console.log(`! ${message}`)
  for (const message of errors) console.log(`✗ ${message}`)
  console.log(`Resultado: ${errors.length} error(es), ${warnings.length} advertencia(s)`)
}

process.exitCode = errors.length ? 1 : 0

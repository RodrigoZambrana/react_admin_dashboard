#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const harnessDir = dirname(dirname(fileURLToPath(import.meta.url)))
const root = dirname(harnessDir)
const config = JSON.parse(readFileSync(join(harnessDir, 'config', 'project.json'), 'utf8'))
const args = process.argv.slice(2)
const valueOf = (flag, fallback) => {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : fallback
}
const scopeArg = valueOf('--scope', 'changed')
const level = valueOf('--level', 'quick')
const dryRun = args.includes('--dry-run')
const allowedLevels = new Set(['quick', 'standard', 'release'])

if (!allowedLevels.has(level)) {
  console.error(`Nivel inválido: ${level}. Usa quick, standard o release.`)
  process.exit(2)
}

const byId = new Map(config.workspaces.map((workspace) => [workspace.id, workspace]))
const changedPaths = () => {
  const output = execFileSync('git', ['status', '--porcelain=v1', '--untracked-files=all'], {
    cwd: root,
    encoding: 'utf8',
  })
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3).split(' -> ').at(-1))
}

const scopesForPath = (path) => {
  if (path.startsWith('backend/src/analytics/') || path.startsWith('backend/src/growth/')) return ['metrics']
  if (path.startsWith('backend/')) return ['commerce-backend']
  if (path.startsWith('frontend/')) return ['admin']
  if (path.startsWith('ecommerce/')) return ['storefront']
  if (path.startsWith('ai-platform/')) return ['ai-platform']
  if (path.startsWith('services/channel-adapter/') || path.startsWith('services/shared/')) return ['channel-adapter']
  if (path.startsWith('ai-harness/') || path.startsWith('ai-harness-local/') || path === 'AGENTS.md') return ['harness']
  if (path.startsWith('deploy/') || path.startsWith('tools/') || path.startsWith('scripts/')) {
    return ['commerce-backend', 'admin', 'storefront', 'ai-platform', 'channel-adapter']
  }
  return ['harness']
}

let scopes
if (scopeArg === 'all') scopes = config.workspaces.map(({ id }) => id)
else if (scopeArg === 'changed') scopes = changedPaths().flatMap(scopesForPath)
else scopes = scopeArg.split(',').map((item) => item.trim()).filter(Boolean)
scopes = [...new Set(scopes)]

if (args.includes('--list')) {
  for (const workspace of config.workspaces) console.log(`${workspace.id}\t${workspace.product}`)
  process.exit(0)
}

if (!scopes.length) {
  console.log('No hay cambios que verificar.')
  process.exit(0)
}

const invalid = scopes.filter((scope) => !byId.has(scope))
if (invalid.length) {
  console.error(`Scopes desconocidos: ${invalid.join(', ')}`)
  process.exit(2)
}

const commands = []
const seen = new Set()
for (const scope of scopes) {
  const workspace = byId.get(scope)
  const cwd = join(root, workspace.verificationCwd ?? workspace.path)
  for (const command of workspace.verification[level] ?? []) {
    const key = `${cwd}\0${command}`
    if (!seen.has(key)) commands.push({ scope, cwd, command })
    seen.add(key)
  }
}

console.log(`Verificación ${level}: ${scopes.join(', ')}`)
for (const item of commands) {
  console.log(`\n[${item.scope}] ${item.command}`)
  if (dryRun) continue
  const result = spawnSync(item.command, {
    cwd: item.cwd,
    env: { ...process.env, AI_HARNESS_VERIFY_LEVEL: level },
    shell: true,
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    console.error(`Falló ${item.scope} con código ${result.status ?? 'desconocido'}`)
    process.exit(result.status ?? 1)
  }
}

console.log(dryRun ? '\nPlan de verificación válido.' : '\nVerificación completada.')

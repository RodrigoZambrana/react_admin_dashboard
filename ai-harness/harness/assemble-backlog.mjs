#!/usr/bin/env node

import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const harnessDir = dirname(dirname(fileURLToPath(import.meta.url)))
const root = dirname(harnessDir)
const fragmentsDir = join(root, 'planning', 'fragments')
const outputPath = join(root, 'planning', 'backlog.json')
const temporaryPath = `${outputPath}.tmp`
const fragmentNames = ['platform.json', 'ecommerce.json', 'metrics.json', 'ai-channels.json']
const errors = []
const tasks = []

for (const fragmentName of fragmentNames) {
  const fragmentPath = join(fragmentsDir, fragmentName)
  if (!existsSync(fragmentPath)) {
    errors.push(`Falta ${fragmentPath}`)
    continue
  }

  try {
    const fragment = JSON.parse(readFileSync(fragmentPath, 'utf8'))
    if (!Array.isArray(fragment.tasks)) {
      errors.push(`${fragmentName}: tasks debe ser un array`)
      continue
    }
    tasks.push(...fragment.tasks)
  } catch (error) {
    errors.push(`${fragmentName}: JSON inválido: ${error.message}`)
  }
}

if (errors.length) {
  for (const error of errors) console.error(`✗ ${error}`)
  process.exit(1)
}

const priorityOrder = new Map([
  ['P0', 0],
  ['P1', 1],
  ['P2', 2],
  ['P3', 3],
])
tasks.sort((left, right) => {
  const priorityDelta = (priorityOrder.get(left.priority) ?? 99) - (priorityOrder.get(right.priority) ?? 99)
  return priorityDelta || left.id.localeCompare(right.id)
})

const backlog = {
  schemaVersion: 1,
  generatedAt: '2026-09-08',
  tasks,
}

writeFileSync(temporaryPath, `${JSON.stringify(backlog, null, 2)}\n`)
renameSync(temporaryPath, outputPath)
console.log(`Backlog ensamblado: ${tasks.length} tareas desde ${fragmentNames.length} fragmentos`)

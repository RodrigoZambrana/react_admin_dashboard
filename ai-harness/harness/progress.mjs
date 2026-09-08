#!/usr/bin/env node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const harnessDir = dirname(dirname(fileURLToPath(import.meta.url)))
const root = dirname(harnessDir)
const state = JSON.parse(
  readFileSync(join(root, 'ai-harness-local', 'progress', 'current.json'), 'utf8'),
)

console.log(`Estado: ${state.status}`)
console.log(`Objetivo: ${state.objective ?? 'ninguno'}`)
if (state.lastCompleted) console.log(`Último cierre: ${state.lastCompleted}`)
if (state.nextRecommended) console.log(`Próximo paso: ${state.nextRecommended}`)
if (state.blockers?.length) {
  console.log('Bloqueos:')
  for (const blocker of state.blockers) console.log(`- ${blocker}`)
}

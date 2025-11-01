#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..')
const schemaPath = resolve(repoRoot, 'env.schema.json')

const schema = JSON.parse(readFileSync(schemaPath, 'utf8'))

/** @type {Record<string, string[]>} */
const envGroups = {
  backend: [
    'backend/.env',
    'backend/.env.example',
    'deploy/env/backend.dev.env',
    'deploy/env/backend.dev.env.example',
    'deploy/env/backend.testing.env.example',
    'deploy/env/backend.prod.env.example',
  ],
  frontend: [
    'frontend/.env',
    'frontend/.env.example',
    'deploy/env/frontend.dev.env',
    'deploy/env/frontend.dev.env.example',
    'deploy/env/frontend.testing.env.example',
    'deploy/env/frontend.prod.env.example',
  ],
  storefront: [
    'ecommerce/.env',
    'ecommerce/.env.example',
    'ecommerce/.env.local',
    'deploy/env/storefront.dev.env',
    'deploy/env/storefront.dev.env.example',
    'deploy/env/storefront.testing.env.example',
    'deploy/env/storefront.prod.env.example',
  ],
}

const parseEnvKeys = (content) => {
  const keys = new Set()
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const equalsIndex = line.indexOf('=')
    if (equalsIndex === -1) continue
    const key = line.slice(0, equalsIndex).trim()
    if (key) keys.add(key)
  }
  return keys
}

let hasErrors = false

for (const [service, files] of Object.entries(envGroups)) {
  const requiredKeys = schema[service]
  if (!requiredKeys || requiredKeys.length === 0) {
    console.warn(`[warn] No schema defined for service "${service}". Skipping.`)
    continue
  }
  for (const file of files) {
    const absPath = resolve(repoRoot, file)
    if (!existsSync(absPath)) {
      console.error(`[error] Expected env file missing: ${file}`)
      hasErrors = true
      continue
    }
    const presentKeys = parseEnvKeys(readFileSync(absPath, 'utf8'))
    const missing = requiredKeys.filter((key) => !presentKeys.has(key))
    if (missing.length > 0) {
      hasErrors = true
      console.error(
        `[error] ${file} está incompleto. Faltan: ${missing.join(', ')}`,
      )
    }
  }
}

if (hasErrors) {
  console.error('\nAlgunas variables obligatorias faltan en al menos un archivo .env.')
  process.exit(1)
} else {
  console.log('Todos los archivos .env contienen las variables requeridas.')
}

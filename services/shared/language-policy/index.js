import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const POLICY_DIR = path.join(__dirname, 'policies')
const cache = new Map()

const normalizePolicyKey = (value) => {
  const normalized = String(value || '').trim()
  return normalized || 'es-default'
}

const clonePolicy = (policy) => JSON.parse(JSON.stringify(policy))

const loadPolicyFile = (policyKey) => {
  const fileName = `${policyKey}.json`
  const filePath = path.join(POLICY_DIR, fileName)
  if (!fs.existsSync(filePath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export const getStaticLanguagePolicy = (policyKey = 'es-default') => {
  const normalizedPolicyKey = normalizePolicyKey(policyKey)
  if (!cache.has(normalizedPolicyKey)) {
    const resolved =
      loadPolicyFile(normalizedPolicyKey) || loadPolicyFile('es-default')
    cache.set(normalizedPolicyKey, resolved || { policyKey: 'es-default' })
  }

  return clonePolicy(cache.get(normalizedPolicyKey))
}


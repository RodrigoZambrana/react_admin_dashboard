import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const POLICY_DIR = path.join(__dirname, 'policies')
const cache = new Map()

const normalizeTenantKey = (value) => {
  const normalized = String(value || '').trim()
  return normalized || 'default'
}

const clonePolicy = (policy) => JSON.parse(JSON.stringify(policy))

const loadPolicyFile = (tenantKey) => {
  const fileName = `${tenantKey}.json`
  const filePath = path.join(POLICY_DIR, fileName)
  if (!fs.existsSync(filePath)) {
    return null
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

export const getStaticTenantPolicy = (tenantKey) => {
  const normalizedTenantKey = normalizeTenantKey(tenantKey)
  if (!cache.has(normalizedTenantKey)) {
    const resolved = loadPolicyFile(normalizedTenantKey) || loadPolicyFile('default')
    cache.set(normalizedTenantKey, resolved || { tenantKey: 'default' })
  }

  return clonePolicy(cache.get(normalizedTenantKey))
}

export const getStaticTenantVocabulary = (tenantKey) =>
  getStaticTenantPolicy(tenantKey)?.vocabulary ?? {}

export const getStaticTenantBusinessRules = (tenantKey) =>
  getStaticTenantPolicy(tenantKey)?.businessRules ?? {}

export const getStaticTenantConversationStatePolicy = (tenantKey) =>
  getStaticTenantPolicy(tenantKey)?.conversationState ?? {}

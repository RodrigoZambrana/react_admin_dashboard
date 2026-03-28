import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const LOCAL_DATABASE_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'postgres-local',
  'codex-local-postgres',
  'host.docker.internal',
])

const PRODUCTION_ENV_VALUES = new Set([
  'prod',
  'production',
  'live',
])

type MaintenanceScriptGuardOptions = {
  scriptName: string
  argv?: string[]
  destructive?: boolean
  defaultDryRun?: boolean
  allowRemoteWithFlag?: boolean
}

type MaintenanceScriptGuardResult = {
  dryRun: boolean
  confirmed: boolean
  databaseHost: string | null
}

export function loadEnvFromBackendRoot() {
  const envPath = join(process.cwd(), '.env')
  if (!existsSync(envPath)) {
    return
  }

  const content = readFileSync(envPath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    if (!key || process.env[key]) {
      continue
    }

    let value = line.slice(separatorIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

const readRuntimeEnvironment = () => {
  const candidates = [
    process.env.RUNTIME_ENV,
    process.env.APP_ENV,
    process.env.NODE_ENV,
    process.env.ENVIRONMENT,
    process.env.VERCEL_ENV,
    process.env.RAILWAY_ENVIRONMENT,
  ]

  for (const candidate of candidates) {
    const normalized = String(candidate || '').trim().toLowerCase()
    if (normalized) {
      return normalized
    }
  }

  return 'unknown'
}

const parseDatabaseHost = (databaseUrl: string) => {
  try {
    const parsed = new URL(databaseUrl)
    return parsed.hostname?.trim().toLowerCase() || null
  } catch {
    return null
  }
}

const isProductionEnvironment = (environment: string) =>
  PRODUCTION_ENV_VALUES.has(environment)

const isLocalDatabaseHost = (host: string | null) =>
  Boolean(host && LOCAL_DATABASE_HOSTS.has(host))

export function assertMaintenanceScriptSafety(
  options: MaintenanceScriptGuardOptions,
): MaintenanceScriptGuardResult {
  const argv = options.argv ?? process.argv.slice(2)
  const destructive = options.destructive !== false
  const defaultDryRun = options.defaultDryRun !== false
  const dryRun =
    argv.includes('--dry-run') || (defaultDryRun && !argv.includes('--confirm'))
  const confirmed = argv.includes('--confirm')
  const databaseUrl = process.env.DATABASE_URL
  const runtimeEnvironment = readRuntimeEnvironment()

  if (!databaseUrl) {
    throw new Error(
      `[${options.scriptName}] DATABASE_URL is required before running maintenance scripts.`,
    )
  }

  if (isProductionEnvironment(runtimeEnvironment)) {
    throw new Error(
      `[${options.scriptName}] blocked: maintenance scripts are disabled in production environments.`,
    )
  }

  const databaseHost = parseDatabaseHost(databaseUrl)
  const remoteAllowed =
    options.allowRemoteWithFlag === true &&
    String(process.env.ALLOW_REMOTE_MAINTENANCE || '')
      .trim()
      .toLowerCase() === 'true'

  if (!isLocalDatabaseHost(databaseHost) && !remoteAllowed) {
    throw new Error(
      `[${options.scriptName}] blocked: target database host "${databaseHost || 'unknown'}" is not local. Use a local PostgreSQL target or set ALLOW_REMOTE_MAINTENANCE=true deliberately in a non-production environment.`,
    )
  }

  if (destructive && !dryRun && !confirmed) {
    throw new Error(
      `[${options.scriptName}] blocked: destructive execution requires --confirm. Run with --dry-run first, then repeat with --confirm if the target and summary are correct.`,
    )
  }

  return {
    dryRun,
    confirmed,
    databaseHost,
  }
}

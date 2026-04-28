import type { PrismaClient } from '@prisma/client'
import { seedConfig } from './config.seed'
import { seedIntegrations } from './integrations.seed'
import { seedSettings } from './settings.seed'
import { resolveSeedEnvironment, type SeedLog } from './seed-utils'
import { validateSeedInputs } from './validation'

export type SeedRunSummary = {
  environment: string
  log: SeedLog
  warnings: string[]
  sections: {
    config: Awaited<ReturnType<typeof seedConfig>>
    integrations: Awaited<ReturnType<typeof seedIntegrations>>
    settings: Awaited<ReturnType<typeof seedSettings>>
  }
}

export async function runMultiEnvironmentSeeds(prisma: PrismaClient): Promise<SeedRunSummary> {
  const validation = validateSeedInputs()
  if (validation.missingCritical.length > 0) {
    throw new Error(`Missing critical seed configuration: ${validation.missingCritical.join(', ')}`)
  }

  const environment = resolveSeedEnvironment()
  // Bootstrap-only: each domain seed materializes defaults only when no persisted value exists.
  // Existing admin-managed rows in SystemConfig / SecureConfig remain authoritative.
  const config = await seedConfig(prisma, environment)
  const integrations = await seedIntegrations(prisma, environment)
  const settings = await seedSettings(prisma, environment)

  const log: SeedLog = {
    created:
      config.settingsCreated +
      config.systemConfigCreated +
      integrations.secureEntriesCreated +
      settings.settingsCreated,
    skipped: 0,
    touched: 0,
  }

  return {
    environment,
    log,
    warnings: validation.warnings,
    sections: {
      config,
      integrations,
      settings,
    },
  }
}

export { validateSeedInputs } from './validation'

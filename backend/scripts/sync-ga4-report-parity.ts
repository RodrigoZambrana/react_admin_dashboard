import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { inspect } from 'node:util'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'

import { AnalyticsModule } from '../src/analytics/analytics.module'
import { Ga4ConnectorService } from '../src/analytics/ga4-connector.service'
import { AnalyticsReportingService } from '../src/analytics/reporting/analytics-reporting.service'
import {
  assertMaintenanceScriptSafety,
  loadEnvFromBackendRoot,
} from './script-safety'

const SCRIPT_NAME = 'sync-ga4-report-parity'
const LOCAL_ENV_FILES = ['.env.analytics.local', '.env']

type ScriptArgs = {
  connectionId: string
  reportKeys: string[]
  from?: string
  to?: string
  reconcile: boolean
  json: boolean
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AnalyticsModule],
})
class Ga4ReportParityScriptModule {}

function readFlag(name: string) {
  const argv = process.argv.slice(2)
  const index = argv.findIndex((entry) => entry === name)
  if (index === -1) {
    return null
  }
  return argv[index + 1] || null
}

function parseArgs(): ScriptArgs {
  const reportKeys =
    readFlag('--report-key')
      ?.split(',')
      .map((value) => value.trim())
      .filter(Boolean) ?? []

  const connectionId = readFlag('--connection-id') || ''

  return {
    connectionId,
    reportKeys,
    from: readFlag('--from') || undefined,
    to: readFlag('--to') || undefined,
    reconcile: process.argv.slice(2).includes('--reconcile'),
    json: process.argv.slice(2).includes('--json'),
  }
}

function printOutput(value: unknown, json: boolean) {
  const rendered = json
    ? JSON.stringify(value, null, 2)
    : inspect(value, { depth: 10, colors: true, compact: false })
  // eslint-disable-next-line no-console
  console.log(rendered)
}

function loadScriptEnv() {
  for (const fileName of LOCAL_ENV_FILES) {
    const envPath = join(process.cwd(), fileName)
    if (!existsSync(envPath)) {
      continue
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
}

async function main() {
  loadEnvFromBackendRoot()
  loadScriptEnv()
  const safety = assertMaintenanceScriptSafety({
    scriptName: SCRIPT_NAME,
    destructive: false,
    defaultDryRun: true,
    allowRemoteWithFlag: true,
  })
  const args = parseArgs()

  if (!args.connectionId) {
    throw new Error('--connection-id is required')
  }

  const app = await NestFactory.createApplicationContext(Ga4ReportParityScriptModule, {
    logger: ['error', 'warn'],
  })

  try {
    const ga4 = app.get(Ga4ConnectorService)
    const reporting = app.get(AnalyticsReportingService)
    const catalog = await reporting.listCatalog()
    const effectiveReportKeys =
      args.reportKeys.length > 0 ? args.reportKeys : catalog.map((entry) => entry.key)

    if (safety.dryRun) {
      printOutput(
        {
          mode: 'dry_run',
          databaseHost: safety.databaseHost,
          connectionId: args.connectionId,
          reportKeys: effectiveReportKeys,
          from: args.from ?? null,
          to: args.to ?? null,
          reconcile: args.reconcile,
        },
        args.json,
      )
      return
    }

    const syncResults: Array<Awaited<ReturnType<Ga4ConnectorService['runCanonicalReportSync']>>> =
      []
    for (const reportKey of effectiveReportKeys) {
      const result = await ga4.runCanonicalReportSync(
        args.connectionId,
        args.from,
        args.to,
        reportKey,
      )
      syncResults.push(result)
    }

    const reconciliationPromises: Array<Promise<unknown>> = args.reconcile
      ? effectiveReportKeys.map((reportKey) => reporting.reconcileReport(reportKey))
      : []

    const reconciliations = await Promise.all(reconciliationPromises)
    const catalogAfter = await reporting.listCatalog()
    const runs = await reporting.listRuns(100, effectiveReportKeys[0] ?? undefined)

    printOutput(
      {
        mode: 'apply',
        databaseHost: safety.databaseHost,
        connectionId: args.connectionId,
        reportKeys: effectiveReportKeys,
        syncResults,
        reconciliations,
        catalogSize: catalogAfter.length,
        latestRunsCount: runs.length,
      },
      args.json,
    )
  } finally {
    await app.close()
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`[${SCRIPT_NAME}] failed`, error)
  process.exitCode = 1
})

import { inspect } from 'node:util'
import { Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { KnowledgeModule } from '../src/knowledge/knowledge.module'
import { KnowledgeService } from '../src/knowledge/knowledge.service'
import {
  assertMaintenanceScriptSafety,
  loadEnvFromBackendRoot,
} from './script-safety'

type ScriptArgs = {
  tenantKey?: string
  scope?: 'customer_public' | 'admin_internal'
  selection: 'pending' | 'failed' | 'all'
  batchSize?: number
  json: boolean
}

const SCRIPT_NAME = 'reindex-knowledge-chunks'

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), KnowledgeModule],
})
class KnowledgeReindexScriptModule {}

function readFlag(name: string) {
  const argv = process.argv.slice(2)
  const index = argv.findIndex((entry) => entry === name)
  if (index === -1) {
    return null
  }
  return argv[index + 1] || null
}

function parseArgs(): ScriptArgs {
  const rawScope = readFlag('--scope')
  const rawSelection = readFlag('--selection')
  const rawBatchSize = readFlag('--batch-size')

  return {
    tenantKey: readFlag('--tenant') || undefined,
    scope:
      rawScope === 'customer_public' || rawScope === 'admin_internal'
        ? rawScope
        : undefined,
    selection:
      rawSelection === 'all' || rawSelection === 'failed'
        ? rawSelection
        : 'pending',
    batchSize:
      rawBatchSize && Number.isFinite(Number(rawBatchSize))
        ? Number(rawBatchSize)
        : undefined,
    json: process.argv.slice(2).includes('--json'),
  }
}

function printOutput(value: unknown, json: boolean) {
  const rendered = json
    ? JSON.stringify(value, null, 2)
    : inspect(value, { depth: 8, colors: true, compact: false })
  // eslint-disable-next-line no-console
  console.log(rendered)
}

async function main() {
  loadEnvFromBackendRoot()
  const safety = assertMaintenanceScriptSafety({
    scriptName: SCRIPT_NAME,
    destructive: false,
    defaultDryRun: true,
    allowRemoteWithFlag: true,
  })
  const args = parseArgs()

  const app = await NestFactory.createApplicationContext(
    KnowledgeReindexScriptModule,
    {
      logger: ['error', 'warn'],
    },
  )

  try {
    const knowledge = app.get(KnowledgeService)
    const before = await knowledge.getKnowledgeIndexStatus(args.tenantKey)

    if (safety.dryRun) {
      printOutput(
        {
          mode: 'dry_run',
          databaseHost: safety.databaseHost,
          filters: {
            tenantKey: args.tenantKey ?? before.tenantKey,
            scope: args.scope ?? null,
            selection: args.selection,
            batchSize: args.batchSize ?? null,
          },
          before,
        },
        args.json,
      )
      return
    }

    const summary = await knowledge.indexDocuments(
      {
        tenantKey: args.tenantKey,
        scope: args.scope,
        selection: args.selection,
        batchSize: args.batchSize,
        background: false,
      },
      0,
    )
    const after = await knowledge.getKnowledgeIndexStatus(args.tenantKey)

    printOutput(
      {
        mode: 'apply',
        databaseHost: safety.databaseHost,
        filters: {
          tenantKey: args.tenantKey ?? after.tenantKey,
          scope: args.scope ?? null,
          selection: args.selection,
          batchSize: args.batchSize ?? null,
        },
        summary,
        after,
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

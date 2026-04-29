import { PrismaClient } from '@prisma/client'
import { readFile } from 'fs/promises'

import { GA4_REPORT_CATALOG } from '../src/analytics/reports/ga4-report-catalog'
import { normalizeReportRowKey, splitGa4BaselineBlocks } from '../src/analytics/reports/ga4-report-parser'

const prisma = new PrismaClient() as any

const filePath = process.argv[2] ?? process.env.GA4_BASELINE_EXPORT_PATH

if (!filePath) {
  throw new Error('Missing GA4 baseline CSV path. Pass it as argv[2] or GA4_BASELINE_EXPORT_PATH.')
}

const asJson = (value: Record<string, unknown>) => JSON.parse(JSON.stringify(value))

async function main() {
  for (const entry of GA4_REPORT_CATALOG) {
    await prisma.analyticsReportCatalog.upsert({
      where: { key: entry.key },
      update: {
        source: 'ga4',
        title: entry.title,
        description: entry.description,
        baselineHeader: entry.baselineHeader,
        baselineTitle: entry.baselineTitle ?? null,
        equivalenceStatus: entry.equivalenceStatus,
        rowKeyStrategy: entry.rowKeyStrategy,
        dimensionLabels: entry.dimensionLabels,
        metricLabels: entry.metricLabels,
        apiDefinition: entry.apiDefinition ? asJson(entry.apiDefinition as Record<string, unknown>) : null,
        notes: entry.notes ?? null,
      },
      create: {
        key: entry.key,
        source: 'ga4',
        title: entry.title,
        description: entry.description,
        baselineHeader: entry.baselineHeader,
        baselineTitle: entry.baselineTitle ?? null,
        equivalenceStatus: entry.equivalenceStatus,
        rowKeyStrategy: entry.rowKeyStrategy,
        dimensionLabels: entry.dimensionLabels,
        metricLabels: entry.metricLabels,
        apiDefinition: entry.apiDefinition ? asJson(entry.apiDefinition as Record<string, unknown>) : null,
        notes: entry.notes ?? null,
      },
    })
  }

  const content = await readFile(filePath, 'utf8')
  const blocks = splitGa4BaselineBlocks(content)

  for (const block of blocks) {
    const run = await prisma.analyticsReportRun.create({
      data: {
        reportKey: block.definition.key,
        source: 'baseline_import',
        status: 'success',
        rowCount: block.rows.length,
        metadata: asJson({
          sourcePath: filePath,
          baselineHeader: block.header,
          baselineTitle: block.title,
        }),
        finishedAt: new Date(),
      },
    })

    const rows = block.rows.map((row, rowIndex) => {
      const dimensions = Object.fromEntries(
        block.definition.dimensionLabels.map((label, index) => [label, row[index] ?? null]),
      )
      const metricsStartIndex = block.definition.dimensionLabels.length
      const metrics = Object.fromEntries(
        block.definition.metricLabels.map((label, index) => [label, row[metricsStartIndex + index] ?? null]),
      )

      return {
        reportRunId: run.id,
        reportKey: block.definition.key,
        source: 'baseline_csv',
        rowType: 'baseline',
        rowIndex,
        rowKey: normalizeReportRowKey(
          block.definition,
          Object.fromEntries(
            block.definition.dimensionLabels.map((label, index) => [label, row[index] ?? '']),
          ),
          rowIndex,
        ),
        dimensions: asJson(dimensions),
        metrics: asJson(metrics),
        raw: asJson({ columns: row }),
      }
    })

    if (rows.length > 0) {
      await prisma.analyticsReportRow.createMany({
        data: rows,
        skipDuplicates: true,
      })
    }
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

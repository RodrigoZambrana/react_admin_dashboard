import { PrismaService } from '../src/prisma/prisma.service'
import { AnalyticsRepository } from '../src/analytics/analytics.repository'
import { AnalyticsDataParityService } from '../src/analytics/data-parity/analytics-data-parity.service'

const DEFAULT_BASELINE_DIR = '/Users/rodrigo/Personal/Proyectos/urucortinas/analitycs'

const rootDir = process.argv[2] ?? process.env.ANALYTICS_BASELINE_CSV_DIR ?? DEFAULT_BASELINE_DIR
const from = process.argv[3] ?? process.env.ANALYTICS_BASELINE_FROM ?? null
const to = process.argv[4] ?? process.env.ANALYTICS_BASELINE_TO ?? null

async function main() {
  const prisma = new PrismaService()
  await prisma.$connect()
  try {
    const repository = new AnalyticsRepository(prisma)
    const parity = new AnalyticsDataParityService(repository)
    const result = await parity.runBaselineCheck({
      rootDir,
      from,
      to,
    })

    const lines = result.checks.map((check) => {
      const delta = Math.abs(check.deltaPercent).toFixed(2)
      return `${check.source.toUpperCase()} ${check.metric}: ${check.status} (${delta}%)`
    })
    console.log(lines.join('\n'))
    console.log(
      JSON.stringify(
        {
          ok: result.overallStatus !== 'fail',
          overallStatus: result.overallStatus,
          summary: result.summary,
          snapshotGroup: result.snapshotGroup,
          csvImport: result.csvImport,
          apiImport: result.apiImport,
        },
        null,
        2,
      ),
    )

    if (result.overallStatus === 'fail') {
      process.exitCode = 1
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

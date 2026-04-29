import { PrismaService } from '../src/prisma/prisma.service'
import { AnalyticsRepository } from '../src/analytics/analytics.repository'
import { AnalyticsDataParityService } from '../src/analytics/data-parity/analytics-data-parity.service'

const DEFAULT_BASELINE_DIR = '/Users/rodrigo/Personal/Proyectos/urucortinas/analitycs'

const rootDir = process.argv[2] ?? process.env.ANALYTICS_BASELINE_CSV_DIR ?? DEFAULT_BASELINE_DIR
const snapshotGroup = process.argv[3] ?? process.env.ANALYTICS_BASELINE_SNAPSHOT_GROUP ?? undefined

async function main() {
  const prisma = new PrismaService()
  await prisma.$connect()
  try {
    const repository = new AnalyticsRepository(prisma)
    const parity = new AnalyticsDataParityService(repository)
    const result = await parity.importCsvBaselines(rootDir, snapshotGroup)
    console.log(JSON.stringify({ ok: true, ...result }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

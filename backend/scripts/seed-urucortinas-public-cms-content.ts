import { PrismaClient } from '@prisma/client'
import { seedUrucortinasPublicCmsContent } from '../prisma/public-cms-content'

const prisma = new PrismaClient()

async function main() {
  await seedUrucortinasPublicCmsContent(prisma)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import 'dotenv/config'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

const OUTPUT_PATH = resolve(__dirname, '../prisma/baseline/urucortinas_minimal_baseline.json')

const serialize = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return Buffer.from(value).toString('base64')
  }
  if (value instanceof Prisma.Decimal) {
    return value.toString()
  }
  if (Array.isArray(value)) {
    return value.map((item) => serialize(item))
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, nested]) => [key, serialize(nested)]),
    )
  }
  return value
}

async function main() {
  const fixture = {
    calendarEventTypes: await prisma.calendarEventType.findMany({ orderBy: { id: 'asc' } }),
    companyProfiles: await prisma.companyProfile.findMany({ orderBy: { id: 'asc' } }),
    currencyRates: await prisma.currencyRate.findMany({ orderBy: { id: 'asc' } }),
    emailSettings: await prisma.emailSetting.findMany({ orderBy: { id: 'asc' } }),
    emailTemplates: await prisma.emailTemplate.findMany({ orderBy: { id: 'asc' } }),
    notificationSettings: await prisma.notificationSetting.findMany({ orderBy: { id: 'asc' } }),
    productCategories: await prisma.productCategory.findMany({ orderBy: { id: 'asc' } }),
    products: await prisma.product.findMany({ orderBy: { id: 'asc' } }),
    productImages: await prisma.productImage.findMany({ orderBy: { id: 'asc' } }),
    roleNotificationRules: await prisma.roleNotificationRule.findMany({ orderBy: { id: 'asc' } }),
    shippingOptions: await prisma.shippingOption.findMany({ orderBy: { id: 'asc' } }),
    systemConfig: await prisma.systemConfig.findMany({ orderBy: { key: 'asc' } }),
    aberturaGlossaryItems: await prisma.aberturaGlossaryItem.findMany({ orderBy: { id: 'asc' } }),
    dimensionPriceMatrix: await prisma.dimensionPriceMatrix.findMany({ orderBy: { id: 'asc' } }),
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify(serialize(fixture), null, 2))
  console.log(`Baseline fixture exported to ${OUTPUT_PATH}`)
}

main()
  .catch((error) => {
    console.error('Failed to export baseline fixture:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

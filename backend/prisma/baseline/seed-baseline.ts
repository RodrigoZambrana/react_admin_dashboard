import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'

type BaselineFixture = {
  calendarEventTypes: Array<Record<string, unknown>>
  companyProfiles: Array<Record<string, unknown>>
  currencyRates: Array<Record<string, unknown>>
  emailSettings: Array<Record<string, unknown>>
  emailTemplates: Array<Record<string, unknown>>
  notificationSettings: Array<Record<string, unknown>>
  productCategories: Array<Record<string, unknown>>
  products: Array<Record<string, unknown>>
  productImages: Array<Record<string, unknown>>
  roleNotificationRules: Array<Record<string, unknown>>
  shippingOptions: Array<Record<string, unknown>>
  systemConfig: Array<Record<string, unknown>>
  aberturaGlossaryItems: Array<Record<string, unknown>>
  dimensionPriceMatrix: Array<Record<string, unknown>>
}

const FIXTURE_PATH = resolve(__dirname, 'urucortinas_minimal_baseline.json')

const parseDate = (value: unknown) => (typeof value === 'string' ? new Date(value) : value)
const parseBuffer = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? Buffer.from(value, 'base64') : null

const readFixture = (): BaselineFixture => JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as BaselineFixture

const syncSequence = async (prisma: PrismaClient, tableRef: string, column = 'id') => {
  const identifier =
    tableRef.includes('.') || tableRef.includes('"') ? tableRef : `"${tableRef}"`
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('${tableRef}', '${column}'), COALESCE((SELECT MAX(${column}) FROM ${identifier}), 1), (SELECT COUNT(*) > 0 FROM ${identifier}));`,
  )
}

export async function seedUruCortinasBaseline(prisma: PrismaClient) {
  if (process.env.SEED_BASELINE !== 'true') {
    return
  }

  const existingProducts = await prisma.product.count()
  const existingTemplates = await prisma.emailTemplate.count()
  if (existingProducts > 0 || existingTemplates > 0) {
    console.log('[seed] Baseline already present; skipping urucortinas baseline fixture.')
    return
  }

  const fixture = readFixture()

  await prisma.calendarEventType.createMany({
    data: fixture.calendarEventTypes.map((row) => ({
      ...row,
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
    })) as any,
  })

  await prisma.companyProfile.createMany({
    data: fixture.companyProfiles.map((row) => ({
      ...row,
      logo: parseBuffer(row.logo),
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
    })) as any,
  })

  await prisma.currencyRate.createMany({
    data: fixture.currencyRates.map((row) => ({
      ...row,
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
    })) as any,
  })

  await prisma.emailSetting.createMany({
    data: fixture.emailSettings.map((row) => ({
      ...row,
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
    })) as any,
  })

  await prisma.emailTemplate.createMany({
    data: fixture.emailTemplates.map((row) => ({
      ...row,
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
    })) as any,
  })

  await prisma.notificationSetting.createMany({
    data: fixture.notificationSettings.map((row) => ({
      ...row,
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
    })) as any,
  })

  await prisma.productCategory.createMany({
    data: fixture.productCategories.map((row) => ({
      ...row,
      parentId: null,
      installServiceProductId: null,
    })) as any,
  })

  for (const row of fixture.productCategories) {
    if (row.parentId === null && row.installServiceProductId === null) {
      continue
    }
    await prisma.productCategory.update({
      where: { id: row.id as number },
      data: {
        parentId: (row.parentId as number | null) ?? null,
        installServiceProductId: (row.installServiceProductId as number | null) ?? null,
      },
    })
  }

  await prisma.product.createMany({
    data: fixture.products.map((row) => ({
      ...row,
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
    })) as any,
  })

  await prisma.productImage.createMany({
    data: fixture.productImages as any,
  })

  await prisma.roleNotificationRule.createMany({
    data: fixture.roleNotificationRules.map((row) => ({
      ...row,
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
    })) as any,
  })

  await prisma.shippingOption.createMany({
    data: fixture.shippingOptions.map((row) => ({
      ...row,
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
    })) as any,
  })

  await prisma.systemConfig.createMany({
    data: fixture.systemConfig as any,
  })

  await prisma.aberturaGlossaryItem.createMany({
    data: fixture.aberturaGlossaryItems.map((row) => ({
      ...row,
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
    })) as any,
  })

  await prisma.dimensionPriceMatrix.createMany({
    data: fixture.dimensionPriceMatrix.map((row) => ({
      ...row,
      referenceDate: parseDate(row.referenceDate),
      createdAt: parseDate(row.createdAt),
      updatedAt: parseDate(row.updatedAt),
    })) as any,
  })

  await syncSequence(prisma, 'public."CalendarEventType"')
  await syncSequence(prisma, 'public."CompanyProfile"')
  await syncSequence(prisma, 'public."CurrencyRate"')
  await syncSequence(prisma, 'public."EmailSetting"')
  await syncSequence(prisma, 'public."EmailTemplate"')
  await syncSequence(prisma, 'public."NotificationSetting"')
  await syncSequence(prisma, 'public."ProductCategory"')
  await syncSequence(prisma, 'public."Product"')
  await syncSequence(prisma, 'public."ProductImage"')
  await syncSequence(prisma, 'public."RoleNotificationRule"')
  await syncSequence(prisma, 'public."ShippingOption"')
  await syncSequence(prisma, 'public.abertura_glossary_items')
  await syncSequence(prisma, 'public.dimension_price_matrix')

  console.log('[seed] urucortinas minimal baseline loaded.')
}

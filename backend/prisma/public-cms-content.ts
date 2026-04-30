import { PrismaClient } from '@prisma/client'
import { DEFAULT_STOREFRONT_CONFIG } from '../src/storefront/defaults/config'

export async function seedUrucortinasPublicCmsContent(prisma: PrismaClient) {
  const configRow = await prisma.systemConfig.findUnique({
    where: { key: 'storefront:config' },
  })

  if (!configRow) {
    await prisma.systemConfig.create({
      data: {
        key: 'storefront:config',
        value: JSON.stringify(DEFAULT_STOREFRONT_CONFIG),
      },
    })
    return
  }

  if (configRow.value !== JSON.stringify(DEFAULT_STOREFRONT_CONFIG)) {
    await prisma.systemConfig.update({
      where: { key: 'storefront:config' },
      data: {
        value: JSON.stringify(DEFAULT_STOREFRONT_CONFIG),
      },
    })
  }
}

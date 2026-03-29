import type { PrismaService } from '../../prisma/prisma.service'

const DEFAULT_SHIPPING_OPTIONS = [
  {
    name: 'Retiro en depósito',
    deliveryFees: 0,
    estimatedMin: 0,
    estimatedMax: 0,
    img: null,
  },
  {
    name: 'Entrega a domicilio',
    deliveryFees: 0,
    estimatedMin: 0,
    estimatedMax: 0,
    img: null,
  },
] as const

export async function ensureDefaultShippingOptions(prisma: PrismaService) {
  const existing = await prisma.shippingOption.findMany({
    orderBy: { id: 'asc' },
  })

  if (existing.length > 0) {
    return existing
  }

  await prisma.shippingOption.createMany({
    data: DEFAULT_SHIPPING_OPTIONS.map((option) => ({
      name: option.name,
      deliveryFees: option.deliveryFees,
      estimatedMin: option.estimatedMin,
      estimatedMax: option.estimatedMax,
      img: option.img,
    })),
    skipDuplicates: true,
  })

  return prisma.shippingOption.findMany({
    orderBy: { id: 'asc' },
  })
}

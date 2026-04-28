import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SalesController } from './sales.controller'
import { ProductMode } from '@prisma/client'

const createPrismaMock = () => {
  const tx = {
    product: {
      create: vi.fn(),
      update: vi.fn(),
    },
    productRelation: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      create: vi.fn(),
    },
    productVariant: {
      deleteMany: vi.fn(),
    },
    productOption: {
      deleteMany: vi.fn(),
    },
    productImage: {
      deleteMany: vi.fn(),
    },
  }

  const prisma = {
    systemConfig: {
      findUnique: vi.fn(),
    },
    product: {
      create: tx.product.create,
      update: tx.product.update,
      findUnique: vi.fn(),
    },
    productRelation: tx.productRelation,
    productVariant: tx.productVariant,
    productOption: tx.productOption,
    productImage: tx.productImage,
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  }

  return { prisma, tx }
}

describe('SalesController SEO product persistence', () => {
  let prisma: ReturnType<typeof createPrismaMock>['prisma']
  let tx: ReturnType<typeof createPrismaMock>['tx']
  let controller: SalesController

  beforeEach(() => {
    const mock = createPrismaMock()
    prisma = mock.prisma
    tx = mock.tx
    prisma.systemConfig.findUnique.mockResolvedValue({ value: '22' })
    prisma.product.create.mockResolvedValue({ id: 10, img: null })
    prisma.product.update.mockResolvedValue({ id: 10 })
    prisma.product.findUnique.mockResolvedValue({
      id: 10,
      mode: ProductMode.SIMPLE,
      installServiceProductId: null,
      salePrice: 1200,
      costPrice: 800,
      stock: 3,
      permanentStock: false,
      currency: 'UYU',
      categoryId: null,
      installationResolutionMode: null,
      installationChargeScope: null,
      installationPricePresentationMode: null,
    })
    controller = new SalesController(prisma as any, {} as any)
  })

  it('persists SEO fields when creating a product', async () => {
    await controller.createProduct({
      name: 'Cortina Roller',
      categoryId: 1,
      costPrice: 800,
      salePrice: 1200,
      stock: 3,
      seoTitle: 'Cortina Roller | urucortinas',
      seoDescription: 'Cortina roller con tela screen y confección a medida.',
      seoImageUrl: '/assets/images/products/roller-og.png',
      description: 'Descripción',
      currency: 'UYU',
      unitOfMeasure: 'UNIT',
      published: true,
    } as any)

    expect(tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          seoTitle: 'Cortina Roller | urucortinas',
          seoDescription: 'Cortina roller con tela screen y confección a medida.',
          seoImageUrl: '/assets/images/products/roller-og.png',
        }),
      }),
    )
  })

  it('persists SEO fields when updating a product', async () => {
    await controller.updateProduct({
      id: 10,
      name: 'Cortina Roller',
      categoryId: 1,
      costPrice: 800,
      salePrice: 1200,
      stock: 3,
      seoTitle: 'Cortina Roller | urucortinas',
      seoDescription: 'Cortina roller con tela screen y confección a medida.',
      seoImageUrl: '/assets/images/products/roller-og.png',
      description: 'Descripción',
      currency: 'UYU',
      unitOfMeasure: 'UNIT',
      published: true,
    } as any)

    expect(tx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          seoTitle: 'Cortina Roller | urucortinas',
          seoDescription: 'Cortina roller con tela screen y confección a medida.',
          seoImageUrl: '/assets/images/products/roller-og.png',
        }),
      }),
    )
  })
})

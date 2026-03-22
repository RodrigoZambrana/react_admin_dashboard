import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrderStockIntegrityService } from '../order-stock-integrity.service'

const createPrisma = () => ({
  product: {
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  productVariant: {
    updateMany: vi.fn(),
    update: vi.fn(),
  },
  order: {
    findUnique: vi.fn(),
  },
})

describe('OrderStockIntegrityService', () => {
  let prisma: ReturnType<typeof createPrisma>
  let service: OrderStockIntegrityService

  beforeEach(() => {
    prisma = createPrisma()
    service = new OrderStockIntegrityService(prisma as any)
  })

  it('commits storefront stock against product or variant targets', async () => {
    prisma.product.updateMany.mockResolvedValue({ count: 1 })
    prisma.productVariant.updateMany.mockResolvedValue({ count: 1 })

    await service.commitStorefrontItems([
      {
        quantity: 2,
        product: { id: 10, stock: 5, permanentStock: false, name: 'Cortina roller' },
        variant: null,
      },
      {
        quantity: 1,
        product: { id: 20, stock: 0, permanentStock: false, name: 'Abertura serie 20' },
        variant: { id: 33, stock: 4, permanentStock: false, productId: 20 },
      },
    ])

    expect(prisma.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 10 }),
        data: { stock: { decrement: 2 } },
      }),
    )
    expect(prisma.productVariant.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 33 }),
        data: { stock: { decrement: 1 } },
      }),
    )
  })

  it('releases committed stock when an order is cancelled', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 77,
      items: [
        {
          qty: 2,
          product: { id: 10, stock: 3, permanentStock: false, name: 'Cortina roller' },
          variant: null,
        },
        {
          qty: 1,
          product: { id: 20, stock: 0, permanentStock: false, name: 'Abertura serie 20' },
          variant: { id: 33, stock: 2, permanentStock: false, productId: 20 },
        },
      ],
    })

    await service.releaseOrderStock(77)

    expect(prisma.product.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { stock: { increment: 2 } },
    })
    expect(prisma.productVariant.update).toHaveBeenCalledWith({
      where: { id: 33 },
      data: { stock: { increment: 1 } },
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { decimal } from '../../common/currency/money.util'
import { M2DerivedProductsService } from '../m2-derived-products.service'

const createPrisma = () => ({
  product: {
    findMany: vi.fn(),
  },
  productCategory: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  standardSize: {
    findMany: vi.fn(),
  },
})

const createBudgetCalculator = () => ({
  calculateForProduct: vi.fn().mockImplementation(async (_product: any, width: number, height: number) => {
    const unitPrice = 100
    return {
      productId: 1874,
      width,
      height,
      area: width * height,
      unitPrice,
      totalPrice: Number((unitPrice * width * height).toFixed(2)),
      measurementType: 'M2',
      strategy: 'M2',
    }
  }),
})

const createCache = () => ({
  get: vi.fn(),
  set: vi.fn(async (_key: string, value: unknown) => value),
  invalidateBaseProduct: vi.fn(),
})

const createStockService = () => ({
  getStock: vi.fn().mockResolvedValue(7),
})

describe('M2DerivedProductsService', () => {
  let prisma: ReturnType<typeof createPrisma>
  let budgetCalculator: ReturnType<typeof createBudgetCalculator>
  let cache: ReturnType<typeof createCache>
  let stockService: ReturnType<typeof createStockService>
  let service: M2DerivedProductsService

  beforeEach(() => {
    prisma = createPrisma()
    budgetCalculator = createBudgetCalculator()
    cache = createCache()
    stockService = createStockService()
    service = new M2DerivedProductsService(
      prisma as any,
      budgetCalculator as any,
      cache as any,
      stockService as any,
      { slug: 'urucortinas' } as any,
    )
  })

  it('generates one virtual product per active standard size and caches the result', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 1874,
        name: 'Cortina de Bandas Verticales',
        productCode: 'BANDAS-01',
        description: 'Descripción base',
        salePrice: decimal(2400),
        currency: 'UYU',
        unitOfMeasure: 'SQUARE_METER',
        published: true,
        isBudgetCalculable: true,
        calculationStrategy: 'M2',
        productType: 'PHYSICAL',
        stock: 9,
        updatedAt: new Date('2026-03-23T12:00:00.000Z'),
        category: { id: 12, name: 'Cortinas' },
        images: [
          {
            id: 1,
            img: '/assets/images/products/bandas.jpg',
            name: 'Bandas Verticales',
            sortOrder: 0,
          },
        ],
      },
    ])
    prisma.standardSize.findMany.mockResolvedValue([
      {
        id: 6,
        width: decimal(1.2),
        height: decimal(1.2),
        label: '1.20 x 1.20',
        isActive: true,
        sortOrder: 0,
        updatedAt: new Date('2026-03-23T12:00:00.000Z'),
      },
      {
        id: 7,
        width: decimal(1),
        height: decimal(1.5),
        label: '1.00 x 1.50',
        isActive: true,
        sortOrder: 1,
        updatedAt: new Date('2026-03-23T12:00:00.000Z'),
      },
    ])
    cache.get.mockResolvedValue(null)

    const result = await service.listM2DerivedProducts()

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(
      expect.objectContaining({
        id: '1874:6',
        baseProductId: 1874,
        sizeId: 6,
        slug: 'cortina-de-bandas-verticales-1-20-x-1-20',
        name: 'Cortina de Bandas Verticales - 1.20 x 1.20',
        totalPrice: 144,
        stock: 7,
      }),
    )
    expect(result[1]).toEqual(
      expect.objectContaining({
        id: '1874:7',
        baseProductId: 1874,
        sizeId: 7,
        slug: 'cortina-de-bandas-verticales-1-00-x-1-50',
        totalPrice: 150,
      }),
    )
    expect(budgetCalculator.calculateForProduct).toHaveBeenCalledTimes(2)
    expect(stockService.getStock).toHaveBeenCalledWith(1874, 6, 9)
    expect(stockService.getStock).toHaveBeenCalledWith(1874, 7, 9)
    expect(cache.set).toHaveBeenCalledTimes(1)
  })

  it('returns cached derived products without recalculating when the cache is warm', async () => {
    cache.get.mockResolvedValue([
      {
        id: '1874:6',
        baseProductId: 1874,
        sizeId: 6,
        name: 'Cortina de Bandas Verticales - 1.20 x 1.20',
        updatedAt: '2026-03-23T12:00:00.000Z',
        description: 'Descripción base',
        images: [],
        width: 1.2,
        height: 1.2,
        area: 1.44,
        unitPricePerM2: 2400,
        totalPrice: 3456,
        stock: 7,
        currency: 'UYU',
        sizeLabel: '1.20 x 1.20',
        slug: 'cortina-de-bandas-verticales-1-20-x-1-20',
      },
    ])
    prisma.product.findMany.mockResolvedValue([
      {
        id: 1874,
        name: 'Cortina de Bandas Verticales',
        productCode: 'BANDAS-01',
        description: 'Descripción base',
        salePrice: decimal(2400),
        currency: 'UYU',
        unitOfMeasure: 'SQUARE_METER',
        published: true,
        isBudgetCalculable: true,
        calculationStrategy: 'M2',
        productType: 'PHYSICAL',
        stock: 9,
        updatedAt: new Date('2026-03-23T12:00:00.000Z'),
        category: { id: 12, name: 'Cortinas' },
        images: [],
      },
    ])
    prisma.standardSize.findMany.mockResolvedValue([
      {
        id: 6,
        width: decimal(1.2),
        height: decimal(1.2),
        label: '1.20 x 1.20',
        isActive: true,
        sortOrder: 0,
        updatedAt: new Date('2026-03-23T12:00:00.000Z'),
      },
    ])

    const result = await service.listM2DerivedProducts()

    expect(result).toHaveLength(1)
    expect(result[0]?.slug).toBe('cortina-de-bandas-verticales-1-20-x-1-20')
    expect(budgetCalculator.calculateForProduct).not.toHaveBeenCalled()
    expect(cache.set).not.toHaveBeenCalled()
  })

  it('resolves a derived product by slug or id from the generated list', async () => {
    vi.spyOn(service, 'listM2DerivedProducts').mockResolvedValue([
      {
        id: '1874:6',
        baseProductId: 1874,
        sizeId: 6,
        name: 'Cortina de Bandas Verticales - 1.20 x 1.20',
        updatedAt: '2026-03-23T12:00:00.000Z',
        description: 'Descripción base',
        images: [],
        width: 1.2,
        height: 1.2,
        area: 1.44,
        unitPricePerM2: 2400,
        totalPrice: 3456,
        stock: 7,
        currency: 'UYU',
        sizeLabel: '1.20 x 1.20',
        slug: 'cortina-de-bandas-verticales-1-20-x-1-20',
      },
    ])

    await expect(service.resolveM2DerivedProductByIdentifier('cortina-de-bandas-verticales-1-20-x-1-20')).resolves.toEqual(
      expect.objectContaining({ sizeId: 6 }),
    )
    await expect(service.resolveM2DerivedProductByIdentifier('1874:6')).resolves.toEqual(
      expect.objectContaining({ baseProductId: 1874 }),
    )
    await expect(service.resolveM2DerivedProductByIdentifier('missing')).resolves.toBeNull()
  })
})

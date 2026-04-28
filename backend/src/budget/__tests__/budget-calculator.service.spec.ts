import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { ProductType, Prisma, SalesUnit } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { BudgetCalculatorService } from '../budget-calculator.service'
import type { BudgetProductSource } from '../budget.types'
import { M2CalculationStrategy } from '../strategies/m2-calculation.strategy'

const makeProduct = (overrides: Partial<BudgetProductSource> = {}): BudgetProductSource => ({
  id: 1,
  name: 'Cortina Roller',
  productCode: 'cortina-roller',
  img: '/images/roller.jpg',
  description: 'Producto de prueba',
  salePrice: new Prisma.Decimal('60'),
  currency: 'USD',
  unitOfMeasure: SalesUnit.SQUARE_METER,
  published: true,
  isBudgetCalculable: true,
  calculationStrategy: 'M2',
  productType: ProductType.PHYSICAL,
  ...overrides,
})

const createPrismaMock = () => ({
  product: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  customerStatus: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  customer: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
})

const createGoogleConfigMock = (recaptchaEnabled = false) => ({
  getEffectiveConfig: vi.fn().mockResolvedValue({
    recaptcha: {
      storefront: {
        enabled: recaptchaEnabled,
        siteKey: recaptchaEnabled ? 'site-key' : null,
      },
      secretKey: recaptchaEnabled ? 'secret-key' : null,
    },
  }),
})

const createService = (
  options: { tenant?: string; recaptchaEnabled?: boolean } = {},
) => {
  const prisma = createPrismaMock()
  const googleConfig = createGoogleConfigMock(options.recaptchaEnabled ?? false)
  const service = new BudgetCalculatorService(
    prisma as any,
    { slug: options.tenant ?? 'urucortinas' } as any,
    googleConfig as any,
    new M2CalculationStrategy(),
  )

  return { prisma, googleConfig, service }
}

describe('BudgetCalculatorService', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('lists only eligible products and maps the public projection', async () => {
    const { prisma, service } = createService()
    prisma.product.findMany.mockResolvedValue([
      makeProduct({
        id: 7,
        name: 'Veneciana aluminio',
        productCode: 'venecianas-aluminio',
        salePrice: new Prisma.Decimal('123.456'),
      }),
    ])

    const result = await service.listProducts()

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productType: ProductType.PHYSICAL,
          published: true,
          isBudgetCalculable: true,
          unitOfMeasure: SalesUnit.SQUARE_METER,
        },
      }),
    )
    expect(result).toEqual([
      expect.objectContaining({
        id: 7,
        slug: 'venecianas-aluminio',
        name: 'Veneciana aluminio',
        unitPrice: 123.46,
        currency: 'USD',
        measurementType: 'M2',
        isPublic: true,
        isBudgetCalculable: true,
        calculationStrategy: 'M2',
      }),
    ])
  })

  it('returns an empty array when no budget products are available', async () => {
    const { prisma, service } = createService()
    prisma.product.findMany.mockResolvedValue([])

    await expect(service.listProducts()).resolves.toEqual([])
  })

  it('rejects budget access outside the urucortinas tenant', async () => {
    const { service } = createService({ tenant: 'other-tenant' })

    await expect(service.listProducts()).rejects.toBeInstanceOf(NotFoundException)
  })

  it('calculates area, total and public product data from the selected strategy', async () => {
    const { prisma, service } = createService()
    prisma.product.findUnique.mockResolvedValue(
      makeProduct({
        id: 12,
        name: 'Roller blackout',
        productCode: 'roller-blackout',
        salePrice: new Prisma.Decimal('99.995'),
        currency: 'UYU',
      }),
    )

    const result = await service.calculate({
      productId: 12,
      width: 1.5,
      height: 2,
    })

    expect(result).toMatchObject({
      productId: 12,
      width: 1.5,
      height: 2,
      area: 3,
      unitPrice: 100,
      totalPrice: 300,
      currency: 'UYU',
      strategy: 'M2',
      product: {
        id: 12,
        slug: 'roller-blackout',
        name: 'Roller blackout',
        unitPrice: 100,
        currency: 'UYU',
        isPublic: true,
        isBudgetCalculable: true,
        calculationStrategy: 'M2',
      },
    })
  })

  it('rejects ineligible products when calculating', async () => {
    const { prisma, service } = createService()
    prisma.product.findUnique.mockResolvedValue(
      makeProduct({
        published: false,
      }),
    )

    await expect(
      service.calculate({
        productId: 1,
        width: 1,
        height: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException)
  })

  it('adds items to cart preserving quantity and subtotal', async () => {
    const { prisma, service } = createService()
    prisma.product.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === 1) {
        return makeProduct({
          id: 1,
          name: 'Producto A',
          productCode: 'producto-a',
          salePrice: new Prisma.Decimal('100'),
          currency: 'USD',
        })
      }

      return makeProduct({
        id: 2,
        name: 'Producto B',
        productCode: 'producto-b',
        salePrice: new Prisma.Decimal('50'),
        currency: 'USD',
      })
    })

    const result = await service.addToCart({
      items: [
        { productId: 1, width: 2, height: 1.5, qty: 2 },
        { productId: 2, width: 1, height: 1, qty: 3 },
      ],
    })

    expect(result.currency).toBe('USD')
    expect(result.subtotal).toBe(750)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({
      productId: 1,
      qty: 2,
      width: 2,
      height: 1.5,
      unitPrice: 100,
      totalPrice: 300,
    })
    expect(result.items[1]).toMatchObject({
      productId: 2,
      qty: 3,
      width: 1,
      height: 1,
      unitPrice: 50,
      totalPrice: 50,
    })
  })

  it('rejects add-to-cart when items use different currencies', async () => {
    const { prisma, service } = createService()
    prisma.product.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === 1) {
        return makeProduct({
          id: 1,
          productCode: 'producto-a',
          currency: 'USD',
        })
      }

      return makeProduct({
        id: 2,
        productCode: 'producto-b',
        currency: 'UYU',
        salePrice: new Prisma.Decimal('50'),
      })
    })

    await expect(
      service.addToCart({
        items: [
          { productId: 1, width: 1, height: 1, qty: 1 },
          { productId: 2, width: 1, height: 1, qty: 1 },
        ],
      }),
    ).rejects.toThrow('Budget items must share the same currency')
  })

  it('requires a recaptcha token when storefront recaptcha is enabled', async () => {
    const { prisma, service } = createService({ recaptchaEnabled: true })
    prisma.product.findUnique.mockResolvedValue(makeProduct())

    await expect(
      service.addToCart({
        items: [{ productId: 1, width: 1, height: 1, qty: 1 }],
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('summarizes items with qty, shipping and normalized customer details', async () => {
    const { prisma, service } = createService()
    prisma.product.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === 1) {
        return makeProduct({
          id: 1,
          productCode: 'producto-a',
          salePrice: new Prisma.Decimal('100'),
          currency: 'USD',
        })
      }

      return makeProduct({
        id: 2,
        productCode: 'producto-b',
        salePrice: new Prisma.Decimal('50'),
        currency: 'USD',
      })
    })

    const result = await service.summarize({
      items: [
        { productId: 1, width: 2, height: 1, qty: 2 },
        { productId: 2, width: 1, height: 1, qty: 1 },
      ],
      shippingFee: 12.345,
      customerName: '  Rodrigo  ',
      customerEmail: '  RODRIGO@MAIL.COM ',
      customerPhone: '  098 123 456 ',
      customerNotes: '  Entregar por la tarde  ',
    })

    expect(result.currency).toBe('USD')
    expect(result.subtotal).toBe(450)
    expect(result.shippingFee).toBe(12.35)
    expect(result.grandTotal).toBe(462.35)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({
      productId: 1,
      qty: 2,
      lineTotal: 400,
      unitPrice: 100,
    })
    expect(result.items[1]).toMatchObject({
      productId: 2,
      qty: 1,
      lineTotal: 50,
      unitPrice: 50,
    })
    expect(result.customer).toEqual({
      name: 'Rodrigo',
      email: 'RODRIGO@MAIL.COM',
      phone: '098 123 456',
      notes: 'Entregar por la tarde',
    })
  })

  it('rejects summarize when currencies do not match', async () => {
    const { prisma, service } = createService()
    prisma.product.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === 1) {
        return makeProduct({
          id: 1,
          productCode: 'producto-a',
          currency: 'USD',
        })
      }

      return makeProduct({
        id: 2,
        productCode: 'producto-b',
        currency: 'UYU',
      })
    })

    await expect(
      service.summarize({
        items: [
          { productId: 1, width: 1, height: 1, qty: 1 },
          { productId: 2, width: 1, height: 1, qty: 1 },
        ],
      }),
    ).rejects.toThrow('Budget items must share the same currency')
  })

  it('creates a lead customer and assigns the budget status', async () => {
    const { prisma, service } = createService()
    prisma.customer.findUnique.mockResolvedValue(null)
    prisma.customer.findFirst.mockResolvedValue(null)
    prisma.customerStatus.findFirst.mockResolvedValue(null)
    prisma.customerStatus.create.mockResolvedValue({ id: 9 })
    prisma.customer.create.mockResolvedValue({
      id: 42,
      name: 'Rodrigo',
      email: 'rodrigo@mail.com',
      phoneNumber: '+59898123456',
      statusId: 9,
    })

    const result = await service.saveLead({
      name: ' Rodrigo ',
      email: ' Rodrigo@Mail.com ',
      phone: ' 098 123 456 ',
    })

    expect(prisma.customerStatus.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Lead presupuesto',
        }),
      }),
    )
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Rodrigo',
          email: 'rodrigo@mail.com',
          phoneNumber: '+59898123456',
          preferredLocale: 'es',
          preferredCurrency: 'UYU',
          statusId: 9,
        }),
      }),
    )
    expect(result).toEqual({
      customerId: 42,
      name: 'Rodrigo',
      email: 'rodrigo@mail.com',
      phone: '+59898123456',
      status: 'Lead presupuesto',
    })
  })

  it('updates an existing customer instead of duplicating it', async () => {
    const { prisma, service } = createService()
    prisma.customer.findUnique.mockResolvedValue({
      id: 7,
      name: 'Rodrigo',
      email: null,
      phoneNumber: null,
      statusId: null,
    })
    prisma.customer.findFirst.mockResolvedValue(null)
    prisma.customerStatus.findFirst.mockResolvedValue({ id: 33 })
    prisma.customer.update.mockResolvedValue({
      id: 7,
      name: 'Rodrigo Pérez',
      email: 'rodrigo@mail.com',
      phoneNumber: '+59898123456',
      statusId: 33,
    })

    const result = await service.saveLead({
      name: ' Rodrigo Pérez ',
      email: ' rodrigo@mail.com ',
      phone: ' 098123456 ',
    })

    expect(prisma.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({
          name: 'Rodrigo Pérez',
          email: 'rodrigo@mail.com',
          phoneNumber: '+59898123456',
          statusId: 33,
        }),
      }),
    )
    expect(result).toEqual({
      customerId: 7,
      name: 'Rodrigo Pérez',
      email: 'rodrigo@mail.com',
      phone: '+59898123456',
      status: 'Lead presupuesto',
    })
  })

  it('rejects lead payloads without a contact channel', async () => {
    const { service } = createService()

    await expect(
      service.saveLead({
        name: 'Rodrigo',
      }),
    ).rejects.toThrow('Necesitamos al menos un medio de contacto.')
  })

  it('rejects lead payloads when email and phone map to different customers', async () => {
    const { prisma, service } = createService()
    prisma.customer.findUnique.mockResolvedValue({ id: 1 })
    prisma.customer.findFirst.mockResolvedValue({ id: 2 })

    await expect(
      service.saveLead({
        name: 'Rodrigo',
        email: 'rodrigo@mail.com',
        phone: '098123456',
      }),
    ).rejects.toThrow('El correo y el WhatsApp indicados pertenecen a contactos distintos.')
  })
})

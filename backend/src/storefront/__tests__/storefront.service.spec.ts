import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DocumentType, ProductMode } from '@prisma/client'
import { decimal } from '../../common/currency/money.util'
import { StorefrontService } from '../storefront.service'
import { ORDER_STATUS_CODES } from '../../common/constants/order-statuses'

const createPrisma = () => ({
  $transaction: vi.fn(async (callback: any) =>
    callback({
      order: {
        create: vi.fn(),
        findUniqueOrThrow: vi.fn(),
      },
      payment: {
        create: vi.fn(),
      },
      product: {
        updateMany: vi.fn(),
      },
      productVariant: {
        updateMany: vi.fn(),
      },
    }),
  ),
  storefrontPaymentIntent: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  order: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  customer: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  customerAddress: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  customerStatus: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  productVariant: {
    findMany: vi.fn(),
  },
  dimensionPriceMatrix: {
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  shippingOption: {
    findUnique: vi.fn(),
  },
})

const createCurrencyConversion = () => ({
  normalizeCurrency: vi.fn((value?: string | null) => value?.trim().toUpperCase() ?? null),
  getEnabledCurrencies: vi.fn().mockResolvedValue(['UYU']),
  getBaseCurrency: vi.fn().mockResolvedValue('UYU'),
  buildRatesSnapshot: vi.fn().mockResolvedValue({
    base: 'UYU',
    generatedAt: '2026-03-22T10:00:00.000Z',
    rates: { UYU: 1 },
  }),
  convertWithSnapshot: vi.fn((amount: string | number) => ({
    amount: decimal(amount),
    rate: decimal(1),
  })),
})

const createNotifications = () => ({
  notifyOrderReceived: vi.fn().mockResolvedValue(undefined),
})

const createMercadoPago = () => ({
  isEnabled: vi.fn().mockReturnValue(true),
  attachPaymentIntentToOrder: vi.fn().mockResolvedValue(undefined),
})

const createParametricPricing = () => ({
  quote: vi.fn(),
  getDefaultParametricProductId: vi.fn((productId?: number) => productId ?? 2115),
})

const createPublishedProductResolver = () => ({
  resolvePublishedParametricProduct: vi.fn(),
  resolvePublishedParametricVariant: vi.fn().mockResolvedValue(null),
})

const createPaymentSettlement = () => ({
  apply: vi.fn().mockResolvedValue({
    paymentId: 1,
    orderId: 1,
    previousStatusId: ORDER_STATUS_CODES.PENDING,
    nextStatusId: ORDER_STATUS_CODES.PENDING,
    notifyPaymentReceived: false,
    notifyOrderStatusChanged: false,
  }),
  dispatch: vi.fn().mockResolvedValue(undefined),
})

describe('StorefrontService.createOrder', () => {
  let prisma: ReturnType<typeof createPrisma>
  let service: StorefrontService
  let mercadoPago: ReturnType<typeof createMercadoPago>
  let parametricPricing: ReturnType<typeof createParametricPricing>
  let publishedProductResolver: ReturnType<typeof createPublishedProductResolver>
  let paymentSettlement: ReturnType<typeof createPaymentSettlement>

  beforeEach(() => {
    prisma = createPrisma()
    prisma.customer.findFirst.mockResolvedValue(null)
    prisma.customerStatus.findFirst.mockResolvedValue({ id: 1, name: 'Activo', code: 'activo' })
    prisma.customerStatus.create.mockResolvedValue({ id: 1, name: 'Activo', code: 'activo' })
    mercadoPago = createMercadoPago()
    parametricPricing = createParametricPricing()
    publishedProductResolver = createPublishedProductResolver()
    paymentSettlement = createPaymentSettlement()

    service = new StorefrontService(
      prisma as any,
      {} as any,
      {} as any,
      createCurrencyConversion() as any,
      createNotifications() as any,
      { sendWelcome: vi.fn().mockResolvedValue(undefined) } as any,
      mercadoPago as any,
      {} as any,
      parametricPricing as any,
      {} as any,
      { commitStorefrontItems: vi.fn().mockResolvedValue(undefined) } as any,
      paymentSettlement as any,
      publishedProductResolver as any,
      { sendEmailVerification: vi.fn().mockResolvedValue(undefined) } as any,
      {} as any,
    )

    vi.spyOn(service as any, 'ensureDefaultPasswordHash').mockResolvedValue(undefined)
    vi.spyOn(service as any, 'syncCustomerProfileFromCheckout').mockImplementation(async (customer: any) => customer)
    ;(service as any).defaultCustomerPasswordHash = 'hash'
  })

  const buildBaseOrderPayload = () => ({
    customer: {
      email: 'buyer@example.com',
      firstName: 'Ana',
      lastName: 'Pérez',
      phone: '+59891234567',
      locale: 'es' as const,
    },
    shippingAddress: {
      line1: 'Av. Italia 1234',
      line2: 'Apto 2',
      city: 'Montevideo',
      department: 'Montevideo',
      state: 'Montevideo',
      zip: '11000',
      country: 'UY',
    },
    shippingOptionId: 3,
    currency: 'UYU',
  })

  it('does not mark storefront orders as paid when an attached payment intent is only authorized, and snapshots shipping option data', async () => {
    prisma.storefrontPaymentIntent.findUnique.mockResolvedValue({ orderId: null })
    prisma.customer.findUnique.mockResolvedValue(null)
    prisma.customer.create.mockResolvedValue({
      id: 10,
      email: 'buyer@example.com',
      firstName: 'Ana',
      lastName: 'Pérez',
      preferredLocale: 'es',
    })
    prisma.product.findMany.mockResolvedValue([
      {
        id: 2115,
        name: 'Ventana corrediza',
        published: true,
        mode: ProductMode.SIMPLE,
        salePrice: decimal(122),
        costPrice: decimal(80),
        taxRate: 22,
        currency: 'UYU',
        productCode: 'VENT-01',
        stock: 8,
        permanentStock: false,
        status: 0,
        images: [],
      },
    ])
    prisma.productVariant.findMany.mockResolvedValue([])
    prisma.shippingOption.findUnique.mockResolvedValue({
      id: 3,
      name: 'Envío Montevideo',
      deliveryFees: 10,
      estimatedMin: 1,
      estimatedMax: 3,
    })
    prisma.order.create.mockResolvedValue({
      id: 42,
      uuid: 'ord-42',
      createdAt: new Date('2026-03-22T10:00:00.000Z'),
      documentType: DocumentType.ORDER,
      statusId: ORDER_STATUS_CODES.PENDING,
      orderCurrency: 'UYU',
      paymentMethodId: 1,
      shippingAddress1: 'Av. Italia 1234',
      shippingAddress2: 'Apto 2',
      shippingCity: 'Montevideo',
      shippingState: 'Montevideo',
      shippingZip: '11000',
      billingAddress1: 'Av. Italia 1234',
      billingAddress2: 'Apto 2',
      billingCity: 'Montevideo',
      billingState: 'Montevideo',
      billingZip: '11000',
      shippingVendor: 'Envío Montevideo',
      deliveryFees: decimal(10),
      estimatedMin: 1,
      estimatedMax: 3,
      subTotal: decimal(100),
      tax: decimal(22),
      grandTotal: decimal(132),
      items: [
        {
          productId: 2115,
          qty: 1,
          price: decimal(122),
          unitAmount: decimal(122),
          name: 'Ventana corrediza',
          nameSnapshot: 'Ventana corrediza',
          img: null,
          specJson: null,
          specSummary: null,
          variantId: null,
        },
      ],
      payments: [],
      storefrontPayments: [],
    })
    prisma.order.findUnique.mockResolvedValue({
      id: 42,
      uuid: 'ord-42',
      createdAt: new Date('2026-03-22T10:00:00.000Z'),
      documentType: DocumentType.ORDER,
      statusId: ORDER_STATUS_CODES.PENDING,
      orderCurrency: 'UYU',
      paymentMethodId: 1,
      shippingAddress1: 'Av. Italia 1234',
      shippingAddress2: 'Apto 2',
      shippingCity: 'Montevideo',
      shippingState: 'Montevideo',
      shippingZip: '11000',
      billingAddress1: 'Av. Italia 1234',
      billingAddress2: 'Apto 2',
      billingCity: 'Montevideo',
      billingState: 'Montevideo',
      billingZip: '11000',
      shippingVendor: 'Envío Montevideo',
      deliveryFees: decimal(10),
      estimatedMin: 1,
      estimatedMax: 3,
      subTotal: decimal(100),
      tax: decimal(22),
      grandTotal: decimal(132),
      items: [
        {
          productId: 2115,
          qty: 1,
          price: decimal(122),
          unitAmount: decimal(122),
          name: 'Ventana corrediza',
          nameSnapshot: 'Ventana corrediza',
          img: null,
          specJson: null,
          specSummary: null,
          variantId: null,
        },
      ],
      payments: [],
      storefrontPayments: [
        {
          id: 'intent-42',
          provider: 'mercadopago',
          status: 'authorized',
          statusDetail: 'pending_capture',
          amount: decimal(132),
          currency: 'UYU',
          externalPaymentId: 'mp-42',
          installments: 1,
          cardBrand: 'visa',
          cardLastFour: '4242',
          createdAt: new Date('2026-03-22T10:01:00.000Z'),
          updatedAt: new Date('2026-03-22T10:02:00.000Z'),
        },
      ],
    })

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        order: {
          create: prisma.order.create,
          findUniqueOrThrow: prisma.order.findUnique,
        },
        payment: {
          create: vi.fn().mockResolvedValue({ id: 1 }),
        },
        product: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        productVariant: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      }),
    )

    const result = await service.createOrder({
      customer: {
        email: 'buyer@example.com',
        firstName: 'Ana',
        lastName: 'Pérez',
        phone: '+59891234567',
        locale: 'es',
      },
      shippingAddress: {
        line1: 'Av. Italia 1234',
        line2: 'Apto 2',
        city: 'Montevideo',
        department: 'Montevideo',
        state: 'Montevideo',
        zip: '11000',
        country: 'UY',
      },
      items: [{ productId: 2115, quantity: 1 }],
      paymentIntentId: 'intent-42',
      shippingOptionId: 3,
      currency: 'UYU',
    })

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shippingVendor: 'Envío Montevideo',
          deliveryFees: expect.anything(),
          estimatedMin: 1,
          estimatedMax: 3,
          grandTotal: expect.anything(),
        }),
      }),
    )
    expect(mercadoPago.attachPaymentIntentToOrder).toHaveBeenCalledWith(42, 'intent-42')
    expect(result.paymentStatus).toBe('processing')
    expect(result.summary.shipping.amount).toBe(10)
    expect(result.payment?.status).toBe('processing')
  })

  it('reuses an identical existing customer address instead of creating a duplicate', async () => {
    prisma.customerAddress.findMany.mockResolvedValue([
      {
        id: 8,
        customerId: 10,
        label: 'Casa',
        line1: 'Norberto Ortiz 4086',
        line2: 'Porton verde, Santa Ana',
        street: 'Norberto Ortiz',
        number: '4086',
        apartment: 'Porton verde',
        corner: 'Santa Ana',
        city: 'Montevideo',
        department: 'Montevideo',
        neighborhood: 'Aguada',
        country: 'Uruguay',
        comments: '',
        isPrimary: true,
        createdAt: new Date('2026-03-24T10:00:00.000Z'),
        updatedAt: new Date('2026-03-24T10:00:00.000Z'),
      },
    ])

    await (service as any).syncCustomerPrimaryAddressFromCheckout(10, {
      line1: 'Norberto Ortiz 4086',
      line2: 'Porton verde, Santa Ana',
      street: 'Norberto Ortiz',
      number: '4086',
      apartment: 'Porton verde',
      corner: 'Santa Ana',
      city: 'Montevideo',
      department: 'Montevideo',
      neighborhood: 'Aguada',
      state: 'Montevideo',
      zip: '11000',
      country: 'Uruguay',
      comments: '',
    })

    expect(prisma.customerAddress.create).not.toHaveBeenCalled()
    expect(prisma.customerAddress.update).not.toHaveBeenCalled()
    expect(prisma.customerAddress.updateMany).toHaveBeenCalledWith({
      where: { customerId: 10, NOT: { id: 8 } },
      data: { isPrimary: false },
    })
  })

  it('persists storefront orders in the requested checkout currency', async () => {
    prisma.storefrontPaymentIntent.findUnique.mockResolvedValue(null)
    prisma.customer.findUnique.mockResolvedValue(null)
    prisma.customer.create.mockResolvedValue({
      id: 10,
      email: 'buyer@example.com',
      firstName: 'Ana',
      lastName: 'Pérez',
      preferredLocale: 'es',
    })
    prisma.product.findMany.mockResolvedValue([
      {
        id: 2115,
        name: 'Ventana corrediza',
        published: true,
        mode: ProductMode.SIMPLE,
        salePrice: decimal(160),
        costPrice: decimal(80),
        taxRate: 22,
        currency: 'USD',
        productCode: 'VENT-01',
        stock: 8,
        permanentStock: false,
        status: 0,
        images: [],
      },
    ])
    prisma.productVariant.findMany.mockResolvedValue([])
    prisma.shippingOption.findUnique.mockResolvedValue({
      id: 3,
      name: 'Envío Montevideo',
      deliveryFees: 10,
      estimatedMin: 1,
      estimatedMax: 3,
    })
    prisma.order.create.mockResolvedValue({
      id: 44,
      uuid: 'ord-44',
      createdAt: new Date('2026-03-24T10:00:00.000Z'),
      documentType: DocumentType.ORDER,
      statusId: ORDER_STATUS_CODES.PENDING,
      orderCurrency: 'UYU',
      paymentMethodId: null,
      shippingAddress1: 'Av. Italia 1234',
      shippingAddress2: 'Apto 2',
      shippingCity: 'Montevideo',
      shippingDepartment: 'Montevideo',
      shippingNeighborhood: 'Aguada',
      shippingCountry: 'Uruguay',
      shippingState: 'Montevideo',
      shippingZip: '11000',
      billingAddress1: 'Av. Italia 1234',
      billingAddress2: 'Apto 2',
      billingCity: 'Montevideo',
      billingDepartment: 'Montevideo',
      billingNeighborhood: 'Aguada',
      billingCountry: 'Uruguay',
      billingState: 'Montevideo',
      billingZip: '11000',
      shippingVendor: 'Envío Montevideo',
      deliveryFees: decimal(10),
      estimatedMin: 1,
      estimatedMax: 3,
      subTotal: decimal(160),
      tax: decimal(35.2),
      grandTotal: decimal(205.2),
      items: [],
      payments: [],
      storefrontPayments: [],
    })
    prisma.order.findUnique.mockResolvedValue({
      id: 44,
      uuid: 'ord-44',
      createdAt: new Date('2026-03-24T10:00:00.000Z'),
      documentType: DocumentType.ORDER,
      statusId: ORDER_STATUS_CODES.PENDING,
      orderCurrency: 'UYU',
      paymentMethodId: null,
      shippingAddress1: 'Av. Italia 1234',
      shippingAddress2: 'Apto 2',
      shippingCity: 'Montevideo',
      shippingDepartment: 'Montevideo',
      shippingNeighborhood: 'Aguada',
      shippingCountry: 'Uruguay',
      shippingState: 'Montevideo',
      shippingZip: '11000',
      billingAddress1: 'Av. Italia 1234',
      billingAddress2: 'Apto 2',
      billingCity: 'Montevideo',
      billingDepartment: 'Montevideo',
      billingNeighborhood: 'Aguada',
      billingCountry: 'Uruguay',
      billingState: 'Montevideo',
      billingZip: '11000',
      shippingVendor: 'Envío Montevideo',
      deliveryFees: decimal(10),
      estimatedMin: 1,
      estimatedMax: 3,
      subTotal: decimal(160),
      tax: decimal(35.2),
      grandTotal: decimal(205.2),
      items: [],
      payments: [],
      storefrontPayments: [],
    })

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        order: {
          create: prisma.order.create,
          findUniqueOrThrow: prisma.order.findUnique,
        },
        payment: {
          create: vi.fn().mockResolvedValue({ id: 1 }),
        },
        product: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
        productVariant: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      }),
    )

    await service.createOrder({
      ...buildBaseOrderPayload(),
      currency: 'UYU',
      items: [{ productId: 2115, quantity: 1 }],
      shippingAddress: {
        ...buildBaseOrderPayload().shippingAddress,
        neighborhood: 'Aguada',
      },
    })

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderCurrency: 'UYU',
        }),
      }),
    )
  })

  it('allows simple products to create an order with productId and quantity only', async () => {
    prisma.storefrontPaymentIntent.findUnique.mockResolvedValue(null)
    prisma.customer.findUnique.mockResolvedValue(null)
    prisma.customer.create.mockResolvedValue({
      id: 10,
      email: 'buyer@example.com',
      firstName: 'Ana',
      lastName: 'Pérez',
      preferredLocale: 'es',
    })
    prisma.product.findMany.mockResolvedValue([
      {
        id: 1873,
        name: 'Cortina Roller',
        published: true,
        mode: ProductMode.SIMPLE,
        salePrice: decimal(50),
        costPrice: decimal(25),
        taxRate: 22,
        currency: 'UYU',
        productCode: 'ROLLER-01',
        stock: 8,
        permanentStock: false,
        status: 0,
        images: [],
      },
    ])
    prisma.productVariant.findMany.mockResolvedValue([])
    prisma.shippingOption.findUnique.mockResolvedValue({
      id: 3,
      name: 'Envío Montevideo',
      deliveryFees: 10,
      estimatedMin: 1,
      estimatedMax: 3,
    })
    prisma.order.create.mockResolvedValue({
      id: 43,
      uuid: 'ord-43',
      createdAt: new Date('2026-03-22T10:00:00.000Z'),
      documentType: DocumentType.ORDER,
      statusId: ORDER_STATUS_CODES.PENDING,
      orderCurrency: 'UYU',
      paymentMethodId: null,
      shippingAddress1: 'Av. Italia 1234',
      shippingAddress2: 'Apto 2',
      shippingCity: 'Montevideo',
      shippingState: 'Montevideo',
      shippingZip: '11000',
      billingAddress1: 'Av. Italia 1234',
      billingAddress2: 'Apto 2',
      billingCity: 'Montevideo',
      billingState: 'Montevideo',
      billingZip: '11000',
      shippingVendor: 'Envío Montevideo',
      deliveryFees: decimal(10),
      estimatedMin: 1,
      estimatedMax: 3,
      subTotal: decimal(50),
      tax: decimal(11),
      grandTotal: decimal(60),
      items: [
        {
          productId: 1873,
          qty: 1,
          price: decimal(50),
          unitAmount: decimal(50),
          name: 'Cortina Roller',
          nameSnapshot: 'Cortina Roller',
          img: null,
          specJson: null,
          specSummary: null,
          variantId: null,
        },
      ],
      payments: [],
      storefrontPayments: [],
    })
    prisma.order.findUnique.mockResolvedValue({
      id: 43,
      uuid: 'ord-43',
      createdAt: new Date('2026-03-22T10:00:00.000Z'),
      documentType: DocumentType.ORDER,
      statusId: ORDER_STATUS_CODES.PENDING,
      orderCurrency: 'UYU',
      paymentMethodId: null,
      shippingAddress1: 'Av. Italia 1234',
      shippingAddress2: 'Apto 2',
      shippingCity: 'Montevideo',
      shippingState: 'Montevideo',
      shippingZip: '11000',
      billingAddress1: 'Av. Italia 1234',
      billingAddress2: 'Apto 2',
      billingCity: 'Montevideo',
      billingState: 'Montevideo',
      billingZip: '11000',
      shippingVendor: 'Envío Montevideo',
      deliveryFees: decimal(10),
      estimatedMin: 1,
      estimatedMax: 3,
      subTotal: decimal(50),
      tax: decimal(11),
      grandTotal: decimal(60),
      items: [
        {
          productId: 1873,
          qty: 1,
          price: decimal(50),
          unitAmount: decimal(50),
          name: 'Cortina Roller',
          nameSnapshot: 'Cortina Roller',
          img: null,
          specJson: null,
          specSummary: null,
          variantId: null,
        },
      ],
      payments: [],
      storefrontPayments: [],
    })

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        order: { create: prisma.order.create, findUniqueOrThrow: prisma.order.findUnique },
        payment: { create: vi.fn().mockResolvedValue({ id: 501 }) },
        product: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        productVariant: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      }),
    )

    const result = await service.createOrder({
      ...buildBaseOrderPayload(),
      items: [{ productId: 1873, quantity: 1 }],
    })

    expect(result.id).toBe(43)
    const createPayload = prisma.order.create.mock.calls[0]?.[0]
    expect(createPayload?.data?.items?.create?.[0]?.product).toEqual({ connect: { id: 1873 } })
    expect(createPayload?.data?.items?.create?.[0]?.variant).toBeUndefined()
    expect(createPayload?.data?.items?.create?.[0]?.parametricConfig).toBeUndefined()
  })

  it('requires variantId for variable products', async () => {
    prisma.customer.findUnique.mockResolvedValue(null)
    prisma.customer.create.mockResolvedValue({
      id: 10,
      email: 'buyer@example.com',
      firstName: 'Ana',
      lastName: 'Pérez',
      preferredLocale: 'es',
    })
    prisma.product.findMany.mockResolvedValue([
      {
        id: 3001,
        name: 'Producto Variable',
        published: true,
        mode: ProductMode.VARIABLE,
        salePrice: decimal(50),
        costPrice: decimal(25),
        taxRate: 22,
        currency: 'UYU',
        productCode: 'VAR-01',
        stock: 8,
        permanentStock: false,
        status: 0,
        images: [],
      },
    ])
    prisma.productVariant.findMany.mockResolvedValue([])
    prisma.shippingOption.findUnique.mockResolvedValue({
      id: 3,
      name: 'Envío Montevideo',
      deliveryFees: 10,
      estimatedMin: 1,
      estimatedMax: 3,
    })

    await expect(
      service.createOrder({
        ...buildBaseOrderPayload(),
        items: [{ productId: 3001, quantity: 1 }],
      }),
    ).rejects.toThrow('A product variant must be selected for this item.')
  })

  it('creates an order for published parametric products using the canonical backend definition even if storefront sends configuration', async () => {
    prisma.customer.findUnique.mockResolvedValue(null)
    prisma.customer.create.mockResolvedValue({
      id: 10,
      email: 'buyer@example.com',
      firstName: 'Ana',
      lastName: 'Pérez',
      preferredLocale: 'es',
    })
    prisma.product.findMany.mockResolvedValue([
      {
        id: 2115,
        name: 'Ventana corrediza',
        published: true,
        mode: ProductMode.PARAMETRIC,
        salePrice: decimal(122),
        costPrice: decimal(80),
        taxRate: 22,
        currency: 'UYU',
        productCode: 'VENT-01',
        stock: 8,
        permanentStock: false,
        status: 0,
        images: [],
      },
    ])
    const publishedParametricVariant = {
      configuration: {
        familyId: 'VENTANA_CORREDIZA',
        serie: '20',
        material: 'ALUMINIO',
        color: 'BLANCO',
        vidrio: '3MM',
        widthMm: 1500,
        heightMm: 2000,
        hasMosquitero: false,
        hasShutterMonoblock: false,
        shutterMaterial: '',
        currency: 'USD',
        source: 'published_product',
        referenceDate: '2026-03-22T00:00:00.000Z',
        specifications: 'Serie 20 / Blanco / 3mm / 1500x2000',
      },
      specifications: [
        { label: 'Serie', value: '20' },
        { label: 'Material', value: 'ALUMINIO' },
        { label: 'Color', value: 'BLANCO' },
      ],
    }
    publishedProductResolver.resolvePublishedParametricProduct.mockResolvedValue(publishedParametricVariant)
    publishedProductResolver.resolvePublishedParametricVariant.mockResolvedValue(publishedParametricVariant)
    prisma.productVariant.findMany.mockResolvedValue([])
    prisma.shippingOption.findUnique.mockResolvedValue({
      id: 3,
      name: 'Envío Montevideo',
      deliveryFees: 10,
      estimatedMin: 1,
      estimatedMax: 3,
    })
    prisma.order.create.mockResolvedValue({
      id: 44,
      uuid: 'ord-44',
      createdAt: new Date('2026-03-22T10:00:00.000Z'),
      documentType: DocumentType.ORDER,
      statusId: ORDER_STATUS_CODES.PENDING,
      orderCurrency: 'UYU',
      paymentMethodId: null,
      shippingAddress1: 'Av. Italia 1234',
      shippingAddress2: 'Apto 2',
      shippingCity: 'Montevideo',
      shippingState: 'Montevideo',
      shippingZip: '11000',
      billingAddress1: 'Av. Italia 1234',
      billingAddress2: 'Apto 2',
      billingCity: 'Montevideo',
      billingState: 'Montevideo',
      billingZip: '11000',
      shippingVendor: 'Envío Montevideo',
      deliveryFees: decimal(10),
      estimatedMin: 1,
      estimatedMax: 3,
      subTotal: decimal(122),
      tax: decimal(26.84),
      grandTotal: decimal(132),
      items: [
        {
          productId: 2115,
          qty: 1,
          price: decimal(122),
          unitAmount: decimal(122),
          name: 'Ventana corrediza',
          nameSnapshot: 'Ventana corrediza',
          img: null,
          specJson: [
            { label: 'Serie', value: '20' },
            { label: 'Color', value: 'BLANCO' },
          ],
          specSummary: 'Serie: 20\nColor: BLANCO',
          variantId: null,
          parametricConfig: {
            familyId: 'VENTANA_CORREDIZA',
            serie: '20',
            material: 'ALUMINIO',
            color: 'BLANCO',
            vidrio: '3MM',
            widthMm: 1500,
            heightMm: 2000,
          },
        },
      ],
      payments: [],
      storefrontPayments: [],
    })
    prisma.order.findUnique.mockResolvedValue({
      id: 44,
      uuid: 'ord-44',
      createdAt: new Date('2026-03-22T10:00:00.000Z'),
      documentType: DocumentType.ORDER,
      statusId: ORDER_STATUS_CODES.PENDING,
      orderCurrency: 'UYU',
      paymentMethodId: null,
      shippingAddress1: 'Av. Italia 1234',
      shippingAddress2: 'Apto 2',
      shippingCity: 'Montevideo',
      shippingState: 'Montevideo',
      shippingZip: '11000',
      billingAddress1: 'Av. Italia 1234',
      billingAddress2: 'Apto 2',
      billingCity: 'Montevideo',
      billingState: 'Montevideo',
      billingZip: '11000',
      shippingVendor: 'Envío Montevideo',
      deliveryFees: decimal(10),
      estimatedMin: 1,
      estimatedMax: 3,
      subTotal: decimal(122),
      tax: decimal(26.84),
      grandTotal: decimal(132),
      items: [
        {
          productId: 2115,
          qty: 1,
          price: decimal(122),
          unitAmount: decimal(122),
          name: 'Ventana corrediza',
          nameSnapshot: 'Ventana corrediza',
          img: null,
          specJson: [
            { label: 'Serie', value: '20' },
            { label: 'Color', value: 'BLANCO' },
          ],
          specSummary: 'Serie: 20\nColor: BLANCO',
          variantId: null,
          parametricConfig: {
            familyId: 'VENTANA_CORREDIZA',
            serie: '20',
            material: 'ALUMINIO',
            color: 'BLANCO',
            vidrio: '3MM',
            widthMm: 1500,
            heightMm: 2000,
          },
        },
      ],
      payments: [],
      storefrontPayments: [],
    })

    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        order: { create: prisma.order.create, findUniqueOrThrow: prisma.order.findUnique },
        payment: { create: vi.fn().mockResolvedValue({ id: 502 }) },
        product: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        productVariant: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      }),
    )

    const result = await service.createOrder({
      ...buildBaseOrderPayload(),
      items: [
        {
          productId: 2115,
          quantity: 1,
          configuration: {
            familyId: 'VENTANA_CORREDIZA',
            serie: '20',
            material: 'ALUMINIO',
            color: 'BLANCO',
            vidrio: '3MM',
            widthMm: 1500,
            heightMm: 2000,
          },
        },
      ],
    })

    expect(result.id).toBe(44)
    expect(parametricPricing.quote).not.toHaveBeenCalled()
    const createPayload = prisma.order.create.mock.calls[0]?.[0]
    expect(createPayload?.data?.items?.create?.[0]?.parametricConfig).toEqual(
      expect.objectContaining({
        familyId: 'VENTANA_CORREDIZA',
        serie: '20',
        color: 'BLANCO',
        vidrio: '3MM',
        widthMm: 1500,
        heightMm: 2000,
      }),
    )
    expect(createPayload?.data?.items?.create?.[0]?.specSummary).toContain('Serie: 20')
  })

  it('still fails for parametric products when no canonical backend definition exists', async () => {
    prisma.customer.findUnique.mockResolvedValue(null)
    prisma.customer.create.mockResolvedValue({
      id: 10,
      email: 'buyer@example.com',
      firstName: 'Ana',
      lastName: 'Pérez',
      preferredLocale: 'es',
    })
    prisma.product.findMany.mockResolvedValue([
      {
        id: 2115,
        name: 'Ventana corrediza',
        published: true,
        mode: ProductMode.PARAMETRIC,
        salePrice: decimal(122),
        costPrice: decimal(80),
        taxRate: 22,
        currency: 'UYU',
        productCode: 'VENT-01',
        stock: 8,
        permanentStock: false,
        status: 0,
        images: [],
      },
    ])
    publishedProductResolver.resolvePublishedParametricProduct.mockResolvedValue(null)
    prisma.productVariant.findMany.mockResolvedValue([])
    prisma.shippingOption.findUnique.mockResolvedValue({
      id: 3,
      name: 'Envío Montevideo',
      deliveryFees: 10,
      estimatedMin: 1,
      estimatedMax: 3,
    })

    await expect(
      service.createOrder({
        ...buildBaseOrderPayload(),
        items: [{ productId: 2115, quantity: 1 }],
      }),
    ).rejects.toThrow('Parametric configuration is required for this product.')
  })

  it('prepares a canonical parametric checkout snapshot before payment', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 2115,
        name: 'Ventana corrediza',
        published: true,
        mode: ProductMode.PARAMETRIC,
        currency: 'UYU',
        productCode: 'ABERTURAS',
      },
    ])
    prisma.product.findUnique.mockResolvedValue({
      id: 2115,
      mode: ProductMode.PARAMETRIC,
    })
    prisma.dimensionPriceMatrix.count.mockResolvedValue(0)
    prisma.productVariant.findMany.mockResolvedValue([])
    prisma.shippingOption.findUnique.mockResolvedValue({ id: 3, name: 'Envío Montevideo' })
    parametricPricing.quote.mockResolvedValue({
      available: true,
      price: 100,
      currency: 'UYU',
      source: 'matrix',
      referenceDate: '2026-03-22T00:00:00.000Z',
      matrixRowId: 15,
      specifications: 'Serie 20 / Blanco / 3mm',
      requested: {
        familyId: 'ABERTURAS',
        serie: '20',
        material: 'ALUMINIO',
        color: 'BLANCO',
        vidrio: '3MM',
        widthMm: 1500,
        heightMm: 2000,
        hasMosquitero: false,
        hasShutterMonoblock: false,
        shutterMaterial: '',
      },
    })

    const snapshot = await service.prepareCheckoutSnapshot({
      ...buildBaseOrderPayload(),
      items: [
        {
          productId: 2115,
          quantity: 1,
          configuration: {
            familyId: 'aberturas',
            serie: '20',
            material: 'ALUMINIO',
            color: 'BLANCO',
            vidrio: '3MM',
            widthMm: 1500,
            heightMm: 2000,
            hasMosquitero: false,
            hasShutterMonoblock: false,
            shutterMaterial: '',
          },
        },
      ],
    })

    expect(snapshot.items).toEqual([
      expect.objectContaining({
        productId: 2115,
        quantity: 1,
        configuration: expect.objectContaining({
          familyId: 'ABERTURAS',
          serie: '20',
          color: 'BLANCO',
          vidrio: '3MM',
          widthMm: 1500,
          heightMm: 2000,
          source: 'matrix',
          matrixRowId: 15,
        }),
      }),
    ])
  })

  it('prepares a canonical checkout snapshot for published parametric products even if storefront sends configuration', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 2115,
        name: 'Ventana corrediza',
        published: true,
        mode: ProductMode.PARAMETRIC,
        currency: 'USD',
        productCode: 'VENT-01',
      },
    ])
    prisma.productVariant.findMany.mockResolvedValue([])
    prisma.shippingOption.findUnique.mockResolvedValue({ id: 3, name: 'Envío Montevideo' })
    const publishedParametricVariant = {
      price: 224,
      currency: 'USD',
      configuration: {
        familyId: 'VENTANA_CORREDIZA',
        serie: '20',
        material: 'ALUMINIO',
        color: 'BLANCO',
        vidrio: '3MM',
        widthMm: 1500,
        heightMm: 2000,
        hasMosquitero: false,
        hasShutterMonoblock: false,
        shutterMaterial: '',
        currency: 'USD',
        source: 'published_product',
        referenceDate: '2026-03-22T00:00:00.000Z',
        specifications: 'Serie 20 / Blanco / 3mm / 1500x2000',
      },
      specifications: [
        { label: 'Serie', value: '20' },
        { label: 'Material', value: 'ALUMINIO' },
        { label: 'Color', value: 'BLANCO' },
      ],
    }
    publishedProductResolver.resolvePublishedParametricProduct.mockResolvedValue(publishedParametricVariant)
    publishedProductResolver.resolvePublishedParametricVariant.mockResolvedValue(publishedParametricVariant)

    const snapshot = await service.prepareCheckoutSnapshot({
      ...buildBaseOrderPayload(),
      items: [
        {
          productId: 2115,
          quantity: 1,
          configuration: {
            familyId: 'VENTANA_CORREDIZA',
            serie: '20',
            material: 'ALUMINIO',
            color: 'BLANCO',
            vidrio: '3MM',
            widthMm: 1500,
            heightMm: 2000,
          },
        },
      ],
    })

    expect(parametricPricing.quote).not.toHaveBeenCalled()
    expect(snapshot.items).toEqual([
      expect.objectContaining({
        productId: 2115,
        quantity: 1,
        configuration: expect.objectContaining({
          familyId: 'VENTANA_CORREDIZA',
          serie: '20',
          color: 'BLANCO',
          vidrio: '3MM',
          widthMm: 1500,
          heightMm: 2000,
          source: 'published_product',
        }),
      }),
    ])
  })

  it('prepares a mixed checkout snapshot with simple, variable and published parametric products', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 1873,
        name: 'Cortina Roller',
        published: true,
        mode: ProductMode.SIMPLE,
        currency: 'UYU',
        productCode: 'ROLLER-01',
      },
      {
        id: 3001,
        name: 'Producto Variable',
        published: true,
        mode: ProductMode.VARIABLE,
        currency: 'UYU',
        productCode: 'VAR-01',
      },
      {
        id: 2115,
        name: 'Ventana corrediza',
        published: true,
        mode: ProductMode.PARAMETRIC,
        currency: 'USD',
        productCode: 'VENT-01',
      },
    ])
    prisma.productVariant.findMany.mockResolvedValue([
      {
        id: 901,
        productId: 3001,
        isActive: true,
        stock: 10,
        permanentStock: false,
        salePrice: decimal(80),
        costPrice: decimal(40),
        label: 'Azul',
        sku: 'VAR-01-AZUL',
        images: [],
        selections: [],
      },
    ])
    prisma.shippingOption.findUnique.mockResolvedValue({ id: 3, name: 'Envío Montevideo' })
    const publishedParametricVariant = {
      price: 224,
      currency: 'USD',
      configuration: {
        familyId: 'VENTANA_CORREDIZA',
        serie: '20',
        material: 'ALUMINIO',
        color: 'BLANCO',
        vidrio: '3MM',
        widthMm: 1500,
        heightMm: 2000,
        hasMosquitero: true,
        hasShutterMonoblock: true,
        shutterMaterial: 'PVC',
        currency: 'USD',
        source: 'published_product',
      },
      specifications: [
        { label: 'Serie', value: '20' },
        { label: 'Color', value: 'BLANCO' },
      ],
    }
    publishedProductResolver.resolvePublishedParametricProduct.mockImplementation(async (productId: number) => {
      if (productId !== 2115) {
        return null
      }
      return publishedParametricVariant
    })
    publishedProductResolver.resolvePublishedParametricVariant.mockResolvedValue(publishedParametricVariant)

    const snapshot = await service.prepareCheckoutSnapshot({
      ...buildBaseOrderPayload(),
      items: [
        { productId: 1873, quantity: 2 },
        { productId: 3001, quantity: 1, variantId: 901 },
        { productId: 2115, quantity: 1 },
      ],
    })

    expect(snapshot.items).toEqual([
      expect.objectContaining({ productId: 1873, quantity: 2 }),
      expect.objectContaining({ productId: 3001, quantity: 1, variantId: 901 }),
      expect.objectContaining({
        productId: 2115,
        quantity: 1,
        configuration: expect.objectContaining({
          familyId: 'VENTANA_CORREDIZA',
          serie: '20',
          color: 'BLANCO',
        }),
      }),
    ])
  })

  it('allows multiple checkout lines for the same published parametric product with different configurations', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 2115,
        name: 'Ventana corrediza',
        published: true,
        mode: ProductMode.PARAMETRIC,
        currency: 'USD',
        productCode: 'VENT-01',
      },
    ])
    prisma.productVariant.findMany.mockResolvedValue([])
    prisma.shippingOption.findUnique.mockResolvedValue({ id: 3, name: 'Envío Montevideo' })
    publishedProductResolver.resolvePublishedParametricProduct.mockImplementation(async (productId: number) => {
      if (productId !== 2115) {
        return null
      }
      return {
        price: 224,
        currency: 'USD',
        configuration: {
          familyId: 'VENTANA_CORREDIZA',
          serie: '20',
          material: 'ALUMINIO',
          color: 'BLANCO',
          vidrio: '3MM',
          widthMm: 1500,
          heightMm: 2000,
          hasMosquitero: false,
          hasShutterMonoblock: false,
          shutterMaterial: '',
          currency: 'USD',
          source: 'published_product',
        },
        specifications: [
          { label: 'Serie', value: '20' },
          { label: 'Color', value: 'BLANCO' },
        ],
      }
    })

    const resolvePublishedParametricConfigurationSpy = vi
      .spyOn(service as any, 'resolvePublishedParametricConfiguration')
      .mockImplementation(async (_productId: number, configuration?: Record<string, unknown> | null) => ({
        price:
          configuration?.hasMosquitero || configuration?.hasShutterMonoblock
            ? 260
            : 224,
        currency: 'USD',
        specifications: [
          { label: 'Serie', value: '20' },
          { label: 'Color', value: 'BLANCO' },
        ],
        configuration: {
          familyId: 'VENTANA_CORREDIZA',
          serie: '20',
          material: 'ALUMINIO',
          color: 'BLANCO',
          vidrio: '3MM',
          widthMm: 1500,
          heightMm: 2000,
          hasMosquitero: Boolean(configuration?.hasMosquitero),
          hasShutterMonoblock: Boolean(configuration?.hasShutterMonoblock),
          shutterMaterial: configuration?.hasShutterMonoblock ? 'PVC' : '',
          currency: 'USD',
        },
      }))

    const snapshot = await service.prepareCheckoutSnapshot({
      ...buildBaseOrderPayload(),
      items: [
        {
          productId: 2115,
          quantity: 2,
          configuration: {
            familyId: 'VENTANA_CORREDIZA',
            serie: '20',
            material: 'ALUMINIO',
            color: 'BLANCO',
            vidrio: '3MM',
            widthMm: 1500,
            heightMm: 2000,
            hasMosquitero: false,
            hasShutterMonoblock: false,
            shutterMaterial: '',
          },
        },
        {
          productId: 2115,
          quantity: 2,
          configuration: {
            familyId: 'VENTANA_CORREDIZA',
            serie: '20',
            material: 'ALUMINIO',
            color: 'BLANCO',
            vidrio: '3MM',
            widthMm: 1500,
            heightMm: 2000,
            hasMosquitero: true,
            hasShutterMonoblock: true,
            shutterMaterial: 'PVC',
          },
        },
      ],
    })

    expect(resolvePublishedParametricConfigurationSpy.mock.calls.length).toBeGreaterThanOrEqual(2)
    expect(snapshot.items).toEqual([
      expect.objectContaining({
        productId: 2115,
        quantity: 2,
        configuration: expect.objectContaining({
          hasMosquitero: false,
          hasShutterMonoblock: false,
        }),
      }),
      expect.objectContaining({
        productId: 2115,
        quantity: 2,
        configuration: expect.objectContaining({
          hasMosquitero: true,
          hasShutterMonoblock: true,
          shutterMaterial: 'PVC',
        }),
      }),
    ])
  })

  it('keeps published parametric default pricing and configuration aligned between listing and detail', async () => {
    prisma.product.findFirst.mockResolvedValue({
      id: 2115,
      name: 'Ventana corrediza',
      published: true,
      productType: 'PHYSICAL',
      mode: ProductMode.PARAMETRIC,
      salePrice: decimal(331),
      costPrice: decimal(180),
      taxRate: 22,
      currency: 'USD',
      productCode: 'VENT-01',
      stock: 10,
      permanentStock: false,
      status: 0,
      description: 'Descripción',
      specifications: null,
      categoryId: null,
      category: null,
      tags: [],
      brand: null,
      vendor: null,
      img: null,
      images: [],
      options: [],
      variants: [],
      createdAt: new Date('2026-03-23T12:00:00.000Z'),
      updatedAt: new Date('2026-03-23T12:00:00.000Z'),
    })
    prisma.product.findMany.mockResolvedValue([])
    publishedProductResolver.resolvePublishedParametricProduct.mockResolvedValue({
      defaultVariantKey: 'base:1',
      configuration: {
        familyId: 'VENTANA_CORREDIZA',
        serie: '20',
        material: 'ALUMINIO',
        color: 'BLANCO',
        vidrio: '3MM',
        widthMm: 1800,
        heightMm: 1200,
        hasMosquitero: false,
        hasShutterMonoblock: false,
        shutterMaterial: '',
      },
      specifications: [
        { label: 'Serie', value: '20' },
        { label: 'Color', value: 'BLANCO' },
      ],
      selectors: {
        series: ['20'],
        materials: ['ALUMINIO'],
        colors: ['BLANCO'],
        glass: ['3MM'],
        shutterMaterials: ['PVC'],
        hasMosquiteroOption: true,
        hasMonoblockOption: true,
      },
      variants: [
        {
          id: 1,
          key: 'base:1',
          price: 190,
          currency: 'USD',
          configuration: {
            familyId: 'VENTANA_CORREDIZA',
            serie: '20',
            material: 'ALUMINIO',
            color: 'BLANCO',
            vidrio: '3MM',
            widthMm: 1800,
            heightMm: 1200,
            hasMosquitero: false,
            hasShutterMonoblock: false,
            shutterMaterial: '',
          },
          specifications: [
            { label: 'Serie', value: '20' },
            { label: 'Material', value: 'ALUMINIO' },
            { label: 'Color', value: 'BLANCO' },
            { label: 'Vidrio', value: '3MM' },
          ],
          optionValues: {
            familyId: 'VENTANA_CORREDIZA',
            serie: '20',
            material: 'ALUMINIO',
            color: 'BLANCO',
            vidrio: '3MM',
            widthMm: 1800,
            heightMm: 1200,
            hasMosquitero: false,
            hasShutterMonoblock: false,
            shutterMaterial: '',
          },
        },
        {
          id: 2,
          key: 'combo:2',
          price: 331,
          currency: 'USD',
          configuration: {
            familyId: 'VENTANA_CORREDIZA',
            serie: '20',
            material: 'ALUMINIO',
            color: 'BLANCO',
            vidrio: '3MM',
            widthMm: 1800,
            heightMm: 1200,
            hasMosquitero: true,
            hasShutterMonoblock: true,
            shutterMaterial: 'PVC',
          },
          specifications: [
            { label: 'Serie', value: '20' },
            { label: 'Material', value: 'ALUMINIO' },
            { label: 'Color', value: 'BLANCO' },
            { label: 'Vidrio', value: '3MM' },
            { label: 'Mosquitero', value: 'Sí' },
            { label: 'Monoblock', value: 'PVC' },
          ],
          optionValues: {
            familyId: 'VENTANA_CORREDIZA',
            serie: '20',
            material: 'ALUMINIO',
            color: 'BLANCO',
            vidrio: '3MM',
            widthMm: 1800,
            heightMm: 1200,
            hasMosquitero: true,
            hasShutterMonoblock: true,
            shutterMaterial: 'PVC',
          },
        },
      ],
    })

    const detail = await service.getProduct('ventana-corrediza-20-blanco-3mm-1800x1200')

    expect(detail.price.amount).toBe(190)
    expect(detail.salePrice?.amount).toBe(190)
    expect(detail.configuration).toEqual(
      expect.objectContaining({
        hasMosquitero: false,
        hasShutterMonoblock: false,
      }),
    )
    expect(detail.specifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Serie', value: '20' }),
        expect.objectContaining({ label: 'Color', value: 'BLANCO' }),
      ]),
    )
  })
})

describe('StorefrontService.reconcileApprovedPaymentIntent', () => {
  let prisma: ReturnType<typeof createPrisma>
  let service: StorefrontService

  beforeEach(() => {
    prisma = createPrisma()

    service = new StorefrontService(
      prisma as any,
      {} as any,
      {} as any,
      createCurrencyConversion() as any,
      createNotifications() as any,
      { sendWelcome: vi.fn().mockResolvedValue(undefined) } as any,
      createMercadoPago() as any,
      {} as any,
      createParametricPricing() as any,
      {} as any,
      { commitStorefrontItems: vi.fn().mockResolvedValue(undefined) } as any,
      createPaymentSettlement() as any,
      createPublishedProductResolver() as any,
      { sendEmailVerification: vi.fn().mockResolvedValue(undefined) } as any,
      {} as any,
    )
  })

  it('creates an order from an approved payment intent snapshot and marks it as resolved', async () => {
    prisma.storefrontPaymentIntent.findUnique.mockResolvedValueOnce({
      id: 'intent-1',
      orderId: null,
      status: 'approved',
      metadata: {
        checkoutToken: 'checkout-1',
        checkoutSnapshot: {
          customer: {
            email: 'buyer@example.com',
            firstName: 'Ana',
            lastName: 'Pérez',
            phone: '+59891234567',
            locale: 'es',
          },
          shippingAddress: {
            line1: 'Av. Italia 1234',
            city: 'Montevideo',
            department: 'Montevideo',
            zip: '11000',
            country: 'UY',
          },
          shippingOptionId: 3,
          fulfillmentMode: 'home_delivery',
          currency: 'UYU',
          items: [{ productId: 2115, quantity: 1 }],
        },
      },
    })

    const createOrderSpy = vi.spyOn(service, 'createOrder').mockResolvedValue({
      id: 105,
      uuid: 'ord-105',
      orderNumber: 'ORD-000105',
      reference: 'ORD-000105',
      placedAt: '2026-03-22T20:00:00.000Z',
      status: 'pending',
      statusLabel: 'Pendiente',
      statusColor: 'gray',
      statusBadgeColor: 'secondary',
      paymentStatus: 'paid',
      paymentStatusLabel: 'Pagado',
      paymentStatusColor: 'blue',
      paymentStatusBadgeColor: 'primary',
      fulfillmentStatus: 'pending',
      fulfillmentStatusLabel: 'Pendiente',
      items: [],
      summary: {
        items: [],
        subtotal: { amount: 10, currency: 'UYU' },
        tax: { amount: 0, currency: 'UYU' },
        shipping: { amount: 0, currency: 'UYU' },
        discounts: [],
        grandTotal: { amount: 10, currency: 'UYU' },
      },
      shippingAddress: {
        line1: 'Av. Italia 1234',
        city: 'Montevideo',
        department: 'Montevideo',
        zip: '11000',
        country: 'UY',
      },
      billingAddress: {
        line1: 'Av. Italia 1234',
        city: 'Montevideo',
        department: 'Montevideo',
        zip: '11000',
        country: 'UY',
      },
    } as any)

    const result = await service.reconcileApprovedPaymentIntent('intent-1')

    expect(createOrderSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentIntentId: 'intent-1',
        checkoutToken: 'checkout-1',
        items: [{ productId: 2115, quantity: 1 }],
      }),
    )
    expect(prisma.storefrontPaymentIntent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'intent-1' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            reconciliationStatus: 'resolved',
            reconciliationOrderId: 105,
          }),
        }),
      }),
    )
    expect(result?.id).toBe(105)
  })

  it('marks approved intents without checkout snapshot for manual review', async () => {
    prisma.storefrontPaymentIntent.findUnique.mockResolvedValueOnce({
      id: 'intent-2',
      orderId: null,
      status: 'approved',
      metadata: {
        checkoutToken: 'checkout-2',
      },
    })

    const createOrderSpy = vi.spyOn(service, 'createOrder')

    const result = await service.reconcileApprovedPaymentIntent('intent-2')

    expect(createOrderSpy).not.toHaveBeenCalled()
    expect(prisma.storefrontPaymentIntent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'intent-2' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            reconciliationStatus: 'manual_review_required',
            reconciliationReason: 'approved_without_checkout_snapshot',
          }),
        }),
      }),
    )
    expect(result).toBeNull()
  })

  it('normalizes customer-facing payment summary to order currency when storefront provider currency differs', () => {
    const order = {
      grandTotal: decimal(875),
      orderCurrency: 'USD',
      paymentMethodId: 1,
      payments: [],
    }

    const summary = (service as any).buildOrderPaymentSummary(
      {
        id: 'intent-3',
        provider: 'mercadopago',
        status: 'approved',
        statusDetail: 'accredited',
        externalPaymentId: 'mp-3',
        amount: decimal(38160),
        currency: 'UYU',
        installments: 1,
        cardBrand: 'visa',
        cardLastFour: '1111',
        createdAt: new Date('2026-03-23T01:00:00.000Z'),
        updatedAt: new Date('2026-03-23T01:05:00.000Z'),
      },
      null,
      'USD',
      order as any,
      'paid',
    )

    expect(summary.amount).toEqual({ amount: 875, currency: 'USD' })
  })
})

describe('StorefrontService customer-facing order DTOs', () => {
  let prisma: ReturnType<typeof createPrisma>
  let service: StorefrontService
  let timeline: { list: ReturnType<typeof vi.fn> }

  beforeEach(() => {
    prisma = createPrisma()
    timeline = {
      list: vi.fn(),
    }
    service = new StorefrontService(
      prisma as any,
      {} as any,
      {} as any,
      createCurrencyConversion() as any,
      createNotifications() as any,
      { sendWelcome: vi.fn().mockResolvedValue(undefined) } as any,
      createMercadoPago() as any,
      {} as any,
      createParametricPricing() as any,
      timeline as any,
      { commitStorefrontItems: vi.fn().mockResolvedValue(undefined) } as any,
      createPaymentSettlement() as any,
      createPublishedProductResolver() as any,
      { sendEmailVerification: vi.fn().mockResolvedValue(undefined) } as any,
      {} as any,
    )
  })

  it('omits numeric ids and payment intent ids from customer order responses', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        id: 42,
        uuid: '05277d56-b93d-5ccd-9e52-30d720bae805',
        createdAt: new Date('2026-03-23T18:00:00.000Z'),
        updatedAt: new Date('2026-03-23T18:05:00.000Z'),
        date: new Date('2026-03-23T18:00:00.000Z'),
        documentType: DocumentType.ORDER,
        customerId: 7,
        statusId: ORDER_STATUS_CODES.PENDING,
        orderCurrency: 'USD',
        paymentMethodId: 1,
        shippingAddress1: 'Rambla 123',
        shippingAddress2: null,
        shippingCity: 'Montevideo',
        shippingState: 'Montevideo',
        shippingZip: '11000',
        billingAddress1: 'Rambla 123',
        billingAddress2: null,
        billingCity: 'Montevideo',
        billingState: 'Montevideo',
        billingZip: '11000',
        shippingVendor: 'Envío',
        deliveryFees: decimal(10),
        estimatedMin: 1,
        estimatedMax: 3,
        subTotal: decimal(100),
        tax: decimal(22),
        grandTotal: decimal(132),
        comment: 'Nota del cliente',
        items: [],
        payments: [],
        storefrontPayments: [
          {
            id: 'intent-1',
            provider: 'mercadopago',
            status: 'approved',
            statusDetail: 'accredited',
            externalPaymentId: '123456789',
            amount: decimal(132),
            currency: 'USD',
            installments: 1,
            cardBrand: 'visa',
            cardLastFour: '1111',
            createdAt: new Date('2026-03-23T18:01:00.000Z'),
            updatedAt: new Date('2026-03-23T18:02:00.000Z'),
          },
        ],
      },
    ])

    const [order] = await service.listCustomerOrders(7)

    expect(order).not.toHaveProperty('id')
    expect(order.payment).not.toHaveProperty('paymentIntentId')
    expect(order.uuid).toBe('05277d56-b93d-5ccd-9e52-30d720bae805')
    expect(order.payment?.paymentId).toBe('123456789')
    expect(order.shippingAddress.country).toBe('')
  })

  it('sanitizes customer timeline metadata and uses public order identifiers', async () => {
    prisma.order.findFirst
      .mockResolvedValueOnce({ id: 42 })
      .mockResolvedValueOnce({
        id: 42,
        uuid: '05277d56-b93d-5ccd-9e52-30d720bae805',
        createdAt: new Date('2026-03-23T18:00:00.000Z'),
        updatedAt: new Date('2026-03-23T18:05:00.000Z'),
        date: new Date('2026-03-23T18:00:00.000Z'),
        customerId: 7,
        documentType: DocumentType.ORDER,
        statusId: ORDER_STATUS_CODES.PENDING,
        orderCurrency: 'USD',
        estimatedMin: 1,
        estimatedMax: 3,
        grandTotal: decimal(132),
        payments: [],
        storefrontPayments: [],
        items: [],
      })

    timeline.list.mockResolvedValue([
      {
        eventId: 'timeline-1',
        orderId: 42,
        type: 'PAYMENT_FULL',
        timestamp: '2026-03-23T18:02:00.000Z',
        actor: 'provider:system',
        amount: 132,
        currency: 'USD',
        paymentMethod: 'mercadopago',
        remainingAmount: 0,
        estimateDate: null,
        statusFrom: null,
        statusTo: null,
        message: 'Payment complete',
        metadata: {
          paymentId: 99,
          source: 'storefront:payment-summary',
          activityTitle: 'Entrega coordinada',
          linkedAt: '2026-03-23T18:01:00.000Z',
        },
      },
    ])

    const result = await service.getCustomerOrderTimeline(7, '05277d56-b93d-5ccd-9e52-30d720bae805')

    expect(result.order).not.toHaveProperty('id')
    expect(result.order.uuid).toBe('05277d56-b93d-5ccd-9e52-30d720bae805')
    expect(result.events[0]?.orderId).toBe('05277d56-b93d-5ccd-9e52-30d720bae805')
    expect(result.events[0]?.metadata).toEqual({
      activityTitle: 'Entrega coordinada',
      linkedAt: '2026-03-23T18:01:00.000Z',
    })
  })
})

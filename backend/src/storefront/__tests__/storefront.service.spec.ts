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
    create: vi.fn(),
  },
  customer: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  product: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
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
  convertWithSnapshot: vi.fn(),
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
})

describe('StorefrontService.createOrder', () => {
  let prisma: ReturnType<typeof createPrisma>
  let service: StorefrontService
  let mercadoPago: ReturnType<typeof createMercadoPago>
  let parametricPricing: ReturnType<typeof createParametricPricing>
  let publishedProductResolver: ReturnType<typeof createPublishedProductResolver>

  beforeEach(() => {
    prisma = createPrisma()
    mercadoPago = createMercadoPago()
    parametricPricing = createParametricPricing()
    publishedProductResolver = createPublishedProductResolver()

    service = new StorefrontService(
      prisma as any,
      {} as any,
      {} as any,
      createCurrencyConversion() as any,
      createNotifications() as any,
      mercadoPago as any,
      {} as any,
      parametricPricing as any,
      {} as any,
      { commitStorefrontItems: vi.fn().mockResolvedValue(undefined) } as any,
      publishedProductResolver as any,
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
      locale: 'es' as const,
    },
    shippingAddress: {
      line1: 'Av. Italia 1234',
      line2: 'Apto 2',
      city: 'Montevideo',
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
        locale: 'es',
      },
      shippingAddress: {
        line1: 'Av. Italia 1234',
        line2: 'Apto 2',
        city: 'Montevideo',
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
        order: { create: prisma.order.create },
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
    publishedProductResolver.resolvePublishedParametricProduct.mockResolvedValue({
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
    })
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
        order: { create: prisma.order.create },
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
      {
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
      },
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
    publishedProductResolver.resolvePublishedParametricProduct.mockResolvedValue({
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
    })

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
      {
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
      },
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
      },
    ])
    prisma.shippingOption.findUnique.mockResolvedValue({ id: 3, name: 'Envío Montevideo' })
    publishedProductResolver.resolvePublishedParametricProduct.mockImplementation(async (productId: number) => {
      if (productId !== 2115) {
        return null
      }
      return {
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
    })

    const snapshot = await service.prepareCheckoutSnapshot({
      ...buildBaseOrderPayload(),
      items: [
        { productId: 1873, quantity: 2 },
        { productId: 3001, quantity: 1, variantId: 901 },
        { productId: 2115, quantity: 1 },
      ],
    })

    expect(snapshot.items).toEqual([
      { productId: 1873, quantity: 2 },
      { productId: 3001, quantity: 1, variantId: 901 },
      {
        productId: 2115,
        quantity: 1,
        configuration: expect.objectContaining({
          familyId: 'VENTANA_CORREDIZA',
          serie: '20',
          color: 'BLANCO',
        }),
      },
    ])
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
      createMercadoPago() as any,
      {} as any,
      createParametricPricing() as any,
      {} as any,
      { commitStorefrontItems: vi.fn().mockResolvedValue(undefined) } as any,
      createPublishedProductResolver() as any,
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
            locale: 'es',
          },
          shippingAddress: {
            line1: 'Av. Italia 1234',
            city: 'Montevideo',
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
        zip: '11000',
        country: 'UY',
      },
      billingAddress: {
        line1: 'Av. Italia 1234',
        city: 'Montevideo',
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
})

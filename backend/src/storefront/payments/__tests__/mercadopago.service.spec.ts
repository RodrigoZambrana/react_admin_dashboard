import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentStatus } from '@prisma/client'
import { MercadoPagoService } from '../mercadopago.service'
import { decimal } from '../../../common/currency/money.util'

const createConfig = (overrides: Record<string, string | undefined> = {}) => {
  const store = new Map<string, string | undefined>(
    Object.entries({
      PAYMENTS_PROVIDER: 'none',
      MP_TIMEOUT_MS: '12000',
      ...overrides,
    }),
  )

  return {
    get: vi.fn((key: string) => store.get(key)),
  }
}

const createPrisma = () => ({
  storefrontPaymentIntent: {
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  order: {
    findUnique: vi.fn(),
  },
  payment: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
})

const createSecureConfig = () => ({
  getJson: vi.fn(),
})

const createPaymentSettlement = () => ({
  apply: vi.fn().mockResolvedValue({
    paymentId: 7,
    orderId: 42,
    previousStatusId: 1,
    nextStatusId: 1,
    notifyPaymentReceived: false,
    notifyOrderStatusChanged: false,
  }),
  dispatch: vi.fn().mockResolvedValue(undefined),
})

describe('MercadoPagoService', () => {
  let prisma: ReturnType<typeof createPrisma>
  let paymentSettlement: ReturnType<typeof createPaymentSettlement>
  let service: MercadoPagoService

  beforeEach(() => {
    vi.clearAllMocks()
    prisma = createPrisma()
    paymentSettlement = createPaymentSettlement()
    service = new MercadoPagoService(
      createConfig() as any,
      prisma as any,
      createSecureConfig() as any,
      paymentSettlement as any,
    )
  })

  it('maps authorized storefront intents to registered mirrored payments', () => {
    expect((service as any).mapPaymentStatus('authorized')).toBe(PaymentStatus.REGISTERED)
    expect((service as any).mapPaymentStatus('approved')).toBe(PaymentStatus.CONFIRMED)
  })

  it('routes attach updates through settlement orchestration', async () => {
    prisma.storefrontPaymentIntent.findUnique.mockResolvedValue({
      id: 'intent-1',
      orderId: null,
      status: 'authorized',
      statusDetail: 'pending_capture',
      amount: decimal(150),
      currency: 'UYU',
      externalPaymentId: 'mp-1',
      description: 'Checkout payment',
    })
    prisma.storefrontPaymentIntent.update.mockResolvedValue({
      id: 'intent-1',
      orderId: 42,
      status: 'authorized',
      statusDetail: 'pending_capture',
      amount: decimal(150),
      currency: 'UYU',
      externalPaymentId: 'mp-1',
      description: 'Checkout payment',
    })
    prisma.payment.findFirst.mockResolvedValue({
      id: 7,
      amount: decimal(150),
      currency: 'UYU',
      status: PaymentStatus.REGISTERED,
      notes: 'Previous payment',
    })
    prisma.payment.update.mockResolvedValue({ id: 7 })

    await service.attachPaymentIntentToOrder(42, 'intent-1')

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 7 },
        data: expect.objectContaining({
          status: PaymentStatus.REGISTERED,
        }),
      }),
    )
    expect(paymentSettlement.apply).toHaveBeenCalledWith({
      paymentId: 7,
      previousPaymentStatus: PaymentStatus.REGISTERED,
    })
    expect(paymentSettlement.dispatch).toHaveBeenCalled()
  })

  it('routes webhook sync creates through settlement orchestration', async () => {
    vi.spyOn(service, 'getPayment').mockResolvedValue({
      id: 901,
      status: 'authorized',
      status_detail: 'pending_capture',
      transaction_amount: 200,
      currency_id: 'UYU',
      payment_method_id: 'visa',
      payment_type_id: 'credit_card',
      date_last_updated: '2026-03-22T10:00:00.000Z',
      live_mode: false,
    } as any)

    prisma.storefrontPaymentIntent.findFirst.mockResolvedValue({
      id: 'intent-2',
      orderId: 55,
      status: 'pending',
      statusDetail: null,
      amount: decimal(200),
      currency: 'UYU',
      installments: null,
      paymentMethodId: null,
      paymentTypeId: null,
      statementDescriptor: null,
      description: 'Checkout payment',
      rawResponse: null,
      refundsRaw: null,
      processedAt: null,
      statusUpdatedAt: null,
      liveMode: false,
      cardLastFour: null,
      cardBrand: null,
      cardholderName: null,
      payerEmail: 'buyer@example.com',
      payerFirstName: null,
      payerLastName: null,
      payerIdentificationType: null,
      payerIdentificationNumber: null,
    })
    prisma.storefrontPaymentIntent.update.mockResolvedValue({
      id: 'intent-2',
      orderId: 55,
      status: 'authorized',
      statusDetail: 'pending_capture',
      amount: decimal(200),
      currency: 'UYU',
      installments: null,
      paymentMethodId: 'visa',
      paymentTypeId: 'credit_card',
      statementDescriptor: null,
      description: 'Checkout payment',
      externalPaymentId: 'mp-2',
      liveMode: false,
    })
    prisma.order.findUnique.mockResolvedValue({
      grandTotal: decimal(875),
      orderCurrency: 'USD',
    })
    prisma.payment.findFirst.mockResolvedValue(null)
    prisma.payment.create.mockResolvedValue({ id: 91 })
    paymentSettlement.apply.mockResolvedValue({
      paymentId: 91,
      orderId: 55,
      previousStatusId: 1,
      nextStatusId: 1,
      notifyPaymentReceived: false,
      notifyOrderStatusChanged: false,
    })

    await service.syncPaymentIntentByExternalId('mp-2')

    expect(prisma.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: 55,
          amount: decimal(875),
          currency: 'USD',
          status: PaymentStatus.REGISTERED,
          metadata: expect.objectContaining({
            providerAmount: 200,
            providerCurrency: 'UYU',
            accountingAmount: 875,
            accountingCurrency: 'USD',
          }),
        }),
      }),
    )
    expect(paymentSettlement.apply).toHaveBeenCalledWith({
      paymentId: 91,
      previousPaymentStatus: null,
    })
    expect(paymentSettlement.dispatch).toHaveBeenCalled()
  })
})

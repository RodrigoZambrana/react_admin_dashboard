import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentStatus, PaymentType } from '@prisma/client'
import { PaymentsService } from '../payments.service'
import { decimal } from '../../common/currency/money.util'

const createPrisma = () => ({
  $transaction: vi.fn(async (callback: any) => callback(createTx())),
  payment: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
})

const createTx = () => ({
  order: {
    findUnique: vi.fn(),
  },
  payment: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  paymentAttachment: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
})

const createOrderFinance = () => ({
  getOrderPaymentSummary: vi.fn(),
  recalculateOrderFinancials: vi.fn(),
})

const createTimeline = () => ({
  removePaymentEvents: vi.fn(),
  ensurePaymentWaiting: vi.fn(),
})

const createSettlement = () => ({
  apply: vi.fn(),
  dispatch: vi.fn(),
})

describe('PaymentsService', () => {
  let prisma: ReturnType<typeof createPrisma>
  let tx: ReturnType<typeof createTx>
  let settlement: ReturnType<typeof createSettlement>
  let service: PaymentsService

  beforeEach(() => {
    vi.clearAllMocks()
    tx = createTx()
    prisma = createPrisma() as any
    prisma.$transaction.mockImplementation(async (callback: any) => callback(tx))
    settlement = createSettlement()
    service = new PaymentsService(
      prisma as any,
      createOrderFinance() as any,
      createTimeline() as any,
      settlement as any,
    )
  })

  it('routes createPayment through shared settlement orchestration', async () => {
    tx.order.findUnique.mockResolvedValue({
      id: 42,
      orderCurrency: 'UYU',
    })
    tx.payment.create.mockResolvedValue({
      id: 7,
      orderId: 42,
      amount: decimal(150),
      currency: 'UYU',
      status: PaymentStatus.CONFIRMED,
      type: PaymentType.BALANCE,
      method: 'Cash',
      date: new Date('2026-03-22T10:00:00.000Z'),
    })
    settlement.apply.mockResolvedValue({
      paymentId: 7,
      orderId: 42,
      previousStatusId: 1,
      nextStatusId: 2,
      notifyPaymentReceived: true,
      notifyOrderStatusChanged: true,
    })
    vi.spyOn(service, 'getPayment').mockResolvedValue({
      id: 7,
      status: PaymentStatus.CONFIRMED,
    } as any)

    await service.createPayment({
      orderId: 42,
      amount: 150,
      currency: 'UYU',
      type: PaymentType.BALANCE,
      status: PaymentStatus.CONFIRMED,
      method: 'Cash',
      attachments: [],
    })

    expect(settlement.apply).toHaveBeenCalledWith(
      {
        paymentId: 7,
        previousPaymentStatus: null,
      },
      tx,
    )
    expect(settlement.dispatch).toHaveBeenCalledWith({
      paymentId: 7,
      orderId: 42,
      previousStatusId: 1,
      nextStatusId: 2,
      notifyPaymentReceived: true,
      notifyOrderStatusChanged: true,
    })
  })

  it('routes updatePayment through shared settlement orchestration with previous status', async () => {
    tx.payment.findUnique.mockResolvedValue({
      id: 11,
      orderId: 77,
      amount: decimal(90),
      currency: 'UYU',
      status: PaymentStatus.REGISTERED,
      type: PaymentType.BALANCE,
      method: 'Mercado Pago',
      date: new Date('2026-03-22T10:00:00.000Z'),
    })
    tx.payment.update.mockResolvedValue({ id: 11 })
    settlement.apply.mockResolvedValue({
      paymentId: 11,
      orderId: 77,
      previousStatusId: 1,
      nextStatusId: 1,
      notifyPaymentReceived: false,
      notifyOrderStatusChanged: false,
    })
    vi.spyOn(service, 'getPayment').mockResolvedValue({
      id: 11,
      status: PaymentStatus.REGISTERED,
    } as any)

    await service.updatePayment(11, {
      status: PaymentStatus.CONFIRMED,
    })

    expect(settlement.apply).toHaveBeenCalledWith(
      {
        paymentId: 11,
        previousPaymentStatus: PaymentStatus.REGISTERED,
      },
      tx,
    )
    expect(settlement.dispatch).toHaveBeenCalled()
  })

  it('lists payments with order and customer summaries', async () => {
    prisma.payment.findMany.mockResolvedValue([
      {
        id: 21,
        orderId: 99,
        amount: decimal(150),
        currency: 'UYU',
        type: PaymentType.BALANCE,
        status: PaymentStatus.CONFIRMED,
        reference: 'REF-21',
        method: 'Cash',
        paymentMethodId: null,
        date: new Date('2026-03-24T10:00:00.000Z'),
        notes: null,
        createdAt: new Date('2026-03-24T10:00:00.000Z'),
        updatedAt: new Date('2026-03-24T10:05:00.000Z'),
        attachments: [],
        order: {
          id: 99,
          customerId: 7,
          customer: {
            name: 'Buyer Example',
          },
          grandTotal: decimal(150),
          orderCurrency: 'UYU',
          statusId: 1,
        },
      },
    ])
    prisma.payment.count.mockResolvedValue(1)

    const result = await service.listPayments({ pageIndex: 1, pageSize: 25 } as any)

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          order: expect.any(Object),
          attachments: expect.any(Object),
        }),
      }),
    )
    expect(result.total).toBe(1)
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.order?.customerName).toBe('Buyer Example')
  })
})

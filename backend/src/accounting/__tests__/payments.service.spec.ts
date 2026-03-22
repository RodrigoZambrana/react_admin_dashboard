import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentStatus, PaymentType } from '@prisma/client'
import { PaymentsService } from '../payments.service'
import { decimal } from '../../common/currency/money.util'

const createPrisma = () => ({
  $transaction: vi.fn(async (callback: any) => callback(createTx())),
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
    prisma = {
      $transaction: vi.fn(async (callback: any) => callback(tx)),
    }
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
})

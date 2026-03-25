import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentStatus, PaymentType } from '@prisma/client'
import { decimal } from '../../common/currency/money.util'
import { OrderPaymentSettlementService } from '../order-payment-settlement.service'

const createPrisma = () => ({
  payment: {
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  order: {
    findUnique: vi.fn(),
  },
})

const createOrderFinance = () => ({
  recalculateOrderFinancials: vi.fn(),
})

const createTimeline = () => ({
  ensurePaymentWaiting: vi.fn(),
  recordPaymentCapture: vi.fn(),
  recordStatusTransition: vi.fn(),
})

const createNotifications = () => ({
  notifyPaymentReceived: vi.fn(),
  notifyOrderStatusChanged: vi.fn(),
})

describe('OrderPaymentSettlementService', () => {
  let prisma: ReturnType<typeof createPrisma>
  let orderFinance: ReturnType<typeof createOrderFinance>
  let timeline: ReturnType<typeof createTimeline>
  let notifications: ReturnType<typeof createNotifications>
  let service: OrderPaymentSettlementService

  beforeEach(() => {
    prisma = createPrisma()
    orderFinance = createOrderFinance()
    timeline = createTimeline()
    notifications = createNotifications()
    service = new OrderPaymentSettlementService(
      prisma as any,
      orderFinance as any,
      timeline as any,
      notifications as any,
    )
  })

  it('records capture and dispatches notifications when a payment becomes confirmed and order turns paid', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 7,
      orderId: 42,
      amount: decimal(200),
      currency: 'UYU',
      status: PaymentStatus.CONFIRMED,
      method: 'Mercado Pago',
      paymentMethodId: 1,
      type: PaymentType.BALANCE,
      date: new Date('2026-03-22T10:00:00.000Z'),
    })
    prisma.order.findUnique
      .mockResolvedValueOnce({
        id: 42,
        statusId: 1,
        orderCurrency: 'UYU',
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      })
      .mockResolvedValueOnce({
        statusId: 2,
      })
    prisma.payment.count.mockResolvedValue(0)
    orderFinance.recalculateOrderFinancials.mockResolvedValue({
      outstanding: decimal(0),
      currency: 'UYU',
    })

    const plan = await service.apply({
      paymentId: 7,
      previousPaymentStatus: PaymentStatus.REGISTERED,
    })

    expect(timeline.ensurePaymentWaiting).toHaveBeenCalled()
    expect(timeline.recordPaymentCapture).toHaveBeenCalled()
    expect(timeline.recordStatusTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 42,
        previousStatusId: 1,
        nextStatusId: 2,
      }),
      expect.anything(),
    )
    expect(plan).toEqual({
      paymentId: 7,
      orderId: 42,
      previousStatusId: 1,
      nextStatusId: 2,
      notifyPaymentReceived: true,
      notifyOrderStatusChanged: true,
    })

    await service.dispatch(plan)

    expect(notifications.notifyPaymentReceived).toHaveBeenCalledWith(7)
    expect(notifications.notifyOrderStatusChanged).toHaveBeenCalledWith(42, 1, 2)
  })

  it('does not record capture or payment notifications for registered payments', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 9,
      orderId: 77,
      amount: decimal(120),
      currency: 'UYU',
      status: PaymentStatus.REGISTERED,
      method: 'Mercado Pago',
      paymentMethodId: 1,
      type: PaymentType.BALANCE,
      date: new Date('2026-03-22T10:00:00.000Z'),
    })
    prisma.order.findUnique
      .mockResolvedValueOnce({
        id: 77,
        statusId: 1,
        orderCurrency: 'UYU',
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      })
      .mockResolvedValueOnce({
        statusId: 1,
      })
    orderFinance.recalculateOrderFinancials.mockResolvedValue({
      outstanding: decimal(120),
      currency: 'UYU',
    })

    const plan = await service.apply({
      paymentId: 9,
      previousPaymentStatus: PaymentStatus.REGISTERED,
    })

    expect(timeline.ensurePaymentWaiting).toHaveBeenCalled()
    expect(timeline.recordPaymentCapture).not.toHaveBeenCalled()
    expect(timeline.recordStatusTransition).not.toHaveBeenCalled()
    expect(plan.notifyPaymentReceived).toBe(false)
    expect(plan.notifyOrderStatusChanged).toBe(false)

    await service.dispatch(plan)

    expect(notifications.notifyPaymentReceived).not.toHaveBeenCalled()
    expect(notifications.notifyOrderStatusChanged).not.toHaveBeenCalled()
  })

  it('suppresses payment and status notifications when checkout and payment settle immediately together', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 11,
      orderId: 88,
      amount: decimal(331),
      currency: 'USD',
      status: PaymentStatus.CONFIRMED,
      method: 'Mercado Pago',
      paymentMethodId: 1,
      type: PaymentType.BALANCE,
      date: new Date(),
    })
    prisma.order.findUnique
      .mockResolvedValueOnce({
        id: 88,
        statusId: 1,
        orderCurrency: 'USD',
        createdAt: new Date(),
      })
      .mockResolvedValueOnce({
        statusId: 2,
      })
    prisma.payment.count.mockResolvedValue(0)
    orderFinance.recalculateOrderFinancials.mockResolvedValue({
      outstanding: decimal(0),
      currency: 'USD',
    })

    const plan = await service.apply({
      paymentId: 11,
      previousPaymentStatus: PaymentStatus.REGISTERED,
    })

    expect(plan.notifyPaymentReceived).toBe(false)
    expect(plan.notifyOrderStatusChanged).toBe(false)

    await service.dispatch(plan)

    expect(notifications.notifyPaymentReceived).not.toHaveBeenCalled()
    expect(notifications.notifyOrderStatusChanged).not.toHaveBeenCalled()
  })

  it('does not suppress notifications for cash payments confirmed shortly after order creation', async () => {
    prisma.payment.findUnique.mockResolvedValue({
      id: 12,
      orderId: 89,
      amount: decimal(331),
      currency: 'USD',
      status: PaymentStatus.CONFIRMED,
      method: 'Cash',
      paymentMethodId: 2,
      type: PaymentType.BALANCE,
      date: new Date(),
    })
    prisma.order.findUnique
      .mockResolvedValueOnce({
        id: 89,
        statusId: 1,
        orderCurrency: 'USD',
        createdAt: new Date(),
      })
      .mockResolvedValueOnce({
        statusId: 2,
      })
    prisma.payment.count.mockResolvedValue(0)
    orderFinance.recalculateOrderFinancials.mockResolvedValue({
      outstanding: decimal(0),
      currency: 'USD',
    })

    const plan = await service.apply({
      paymentId: 12,
      previousPaymentStatus: PaymentStatus.REGISTERED,
    })

    expect(plan.notifyPaymentReceived).toBe(true)
    expect(plan.notifyOrderStatusChanged).toBe(true)
  })

  it('swallows notification dispatch errors and continues with the remaining dispatches', async () => {
    const loggerError = vi
      .spyOn((service as unknown as { logger: { error: (message: string) => void } }).logger, 'error')
      .mockImplementation(() => undefined)

    notifications.notifyPaymentReceived.mockRejectedValueOnce(new Error('smtp down'))
    notifications.notifyOrderStatusChanged.mockResolvedValueOnce(undefined)

    await expect(
      service.dispatch({
        paymentId: 12,
        orderId: 89,
        previousStatusId: 1,
        nextStatusId: 2,
        notifyPaymentReceived: true,
        notifyOrderStatusChanged: true,
      }),
    ).resolves.toBeUndefined()

    expect(notifications.notifyPaymentReceived).toHaveBeenCalledWith(12)
    expect(notifications.notifyOrderStatusChanged).toHaveBeenCalledWith(89, 1, 2)
    expect(loggerError).toHaveBeenCalledWith(
      'Failed to dispatch payment received notifications for payment 12: smtp down',
    )
  })
})

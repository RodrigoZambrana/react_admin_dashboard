import { BadRequestException } from '@nestjs/common'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OrderFinanceService } from '../order-finance.service'
import { ORDER_STATUS_CODES } from '../../common/constants/order-statuses'
import { DepositRequirementType, PaymentStatus, PaymentType, Prisma } from '@prisma/client'
import { decimal } from '../../common/currency/money.util'

const createPrisma = () => ({
  $transaction: vi.fn(async (callback: (tx: any) => Promise<unknown>) =>
    callback({
      order: {
        findUnique: vi.fn(),
      },
    }),
  ),
})

describe('OrderFinanceService.ensureStatusCanTransition', () => {
  let prisma: ReturnType<typeof createPrisma>
  let service: OrderFinanceService

  beforeEach(() => {
    prisma = createPrisma()
    service = new OrderFinanceService(prisma as any, {} as any)
  })

  it('rejects reactivating a cancelled order into an active status', async () => {
    const txOrderFindUnique = vi.fn().mockResolvedValue({ statusId: ORDER_STATUS_CODES.CANCELLED })
    prisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        order: {
          findUnique: txOrderFindUnique,
        },
      }),
    )
    vi.spyOn(service, 'recalculateOrderFinancials').mockResolvedValue({
      orderId: 42,
      currency: 'UYU',
      grandTotal: {} as any,
      depositRequired: {} as any,
      depositPaidConfirmed: {} as any,
      balancePaidConfirmed: {} as any,
      refundsConfirmed: {} as any,
      totalPaidConfirmed: {} as any,
      depositPending: {} as any,
      balancePending: {} as any,
      refundsPending: {} as any,
      outstanding: {} as any,
      customerCredit: {} as any,
      depositMet: true,
    })

    await expect(
      service.ensureStatusCanTransition(42, ORDER_STATUS_CODES.PENDING),
    ).rejects.toMatchObject({
      response: {
        message: 'sales.orders.validation.cancelledReopenRequiresNewOrder',
      },
    })
  })

  it('allows idempotent transitions that keep an order cancelled', async () => {
    const txOrderFindUnique = vi.fn().mockResolvedValue({ statusId: ORDER_STATUS_CODES.CANCELLED })
    prisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<unknown>) =>
      callback({
        order: {
          findUnique: txOrderFindUnique,
        },
      }),
    )
    vi.spyOn(service, 'recalculateOrderFinancials').mockResolvedValue({
      orderId: 42,
      currency: 'UYU',
      grandTotal: {} as any,
      depositRequired: {} as any,
      depositPaidConfirmed: {} as any,
      balancePaidConfirmed: {} as any,
      refundsConfirmed: {} as any,
      totalPaidConfirmed: {} as any,
      depositPending: {} as any,
      balancePending: {} as any,
      refundsPending: {} as any,
      outstanding: {} as any,
      customerCredit: {} as any,
      depositMet: false,
    })

    await expect(
      service.ensureStatusCanTransition(42, ORDER_STATUS_CODES.CANCELLED),
    ).resolves.toBeUndefined()
  })
})

describe('OrderFinanceService.recalculateOrderFinancials', () => {
  it('reuses a concurrently created work order instead of failing with a unique code conflict', async () => {
    const prisma = {
      order: {
        findUnique: vi.fn().mockResolvedValue({
          id: 107,
          orderCurrency: 'UYU',
          grandTotal: decimal(32360),
          minimumDepositType: DepositRequirementType.PERCENTAGE,
          minimumDepositValue: decimal(30),
          statusId: ORDER_STATUS_CODES.PENDING,
          confirmedAt: null,
          depositSatisfiedAt: null,
          customerCredit: decimal(0),
          payments: [
            {
              amount: decimal(32360),
              type: PaymentType.DEPOSIT,
              status: PaymentStatus.CONFIRMED,
            },
          ],
          workOrders: [],
        }),
        update: vi.fn().mockResolvedValue(undefined),
      },
      workOrder: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 77, orderId: 107, code: 'WO-000107' }),
        create: vi.fn().mockRejectedValue(
          Object.assign(Object.create(Prisma.PrismaClientKnownRequestError.prototype), {
            code: 'P2002',
          }),
        ),
      },
      productionOrder: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 501, orderId: 107, workOrderId: 77 }),
        update: vi.fn(),
      },
      systemConfig: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    }

    const service = new OrderFinanceService(
      prisma as any,
      {
        get: vi.fn((key: string) => (key === 'CLIENT_SLUG' ? 'urucortinas' : undefined)),
      } as any,
    )

    const summary = await service.recalculateOrderFinancials(107)

    expect(prisma.workOrder.create).toHaveBeenCalledWith({
      data: {
        orderId: 107,
        code: 'WO-000107',
        status: 'PENDING',
      },
    })
    expect(prisma.productionOrder.create).toHaveBeenCalledWith({
      data: {
        orderId: 107,
        workOrderId: 77,
        status: 'PENDING',
        priority: 1,
      },
    })
    expect(summary.orderId).toBe(107)
    expect(summary.depositMet).toBe(true)
  })
})

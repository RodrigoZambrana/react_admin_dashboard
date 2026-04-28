import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountingController } from '../accounting.controller'

const createPrisma = () => ({
  order: {
    findMany: vi.fn(),
  },
  expense: {
    findMany: vi.fn(),
  },
})

describe('AccountingController', () => {
  let prisma: ReturnType<typeof createPrisma>
  let controller: AccountingController

  beforeEach(() => {
    prisma = createPrisma()
    controller = new AccountingController(prisma as any)
  })

  it('builds a summary dashboard from orders and expenses', async () => {
    prisma.order.findMany.mockResolvedValue([
      {
        date: new Date('2026-03-01T10:00:00.000Z'),
        grandTotal: '150.00',
        tax: '27.00',
        orderCurrency: 'UYU',
        items: [],
      },
      {
        date: new Date('2026-03-15T10:00:00.000Z'),
        grandTotal: '250.00',
        tax: '45.00',
        orderCurrency: 'UYU',
        items: [],
      },
    ])
    prisma.expense.findMany.mockResolvedValue([
      {
        date: new Date('2026-03-10T10:00:00.000Z'),
        amount: '100.00',
        currency: 'UYU',
        taxCreditEligible: true,
      },
    ])

    const result = await controller.dashboard({ startDate: 1740787200, endDate: 1743465600 } as any)

    expect(prisma.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    )
    expect(result.range.granularity).toBe('month')
    expect(
      result.monthly.some(
        (month) => month.sales === 400 && month.expenses === 100,
      ),
    ).toBe(true)
    expect(result.totals.sales).toBe(400)
    expect(result.totals.expenses).toBe(100)
    expect(result.currencySummary).toHaveLength(3)
  })
})

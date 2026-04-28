import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CustomersController } from '../customers.controller'

const createPrisma = () => ({
  customer: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  customerStatus: {
    findUnique: vi.fn(),
  },
})

describe('CustomersController', () => {
  let prisma: ReturnType<typeof createPrisma>
  let controller: CustomersController

  beforeEach(() => {
    prisma = createPrisma()
    controller = new CustomersController(prisma as any)
  })

  it('builds a dashboard summary for the customer registry', async () => {
    prisma.customer.count.mockResolvedValue(12)
    prisma.customer.findMany.mockResolvedValue([
      {
        id: 2,
        name: 'Ana Pérez',
        img: null,
        createdAt: new Date('2026-03-25T10:00:00.000Z'),
        email: 'ana@example.com',
      },
      {
        id: 1,
        name: 'Juan Gómez',
        img: null,
        createdAt: new Date('2026-03-24T10:00:00.000Z'),
        email: 'juan@example.com',
      },
    ])

    const result = await controller.dashboard()

    expect(prisma.customer.count).toHaveBeenCalledTimes(1)
    expect(result.statisticData[0]?.value).toBe(12)
    expect(result.recentLeadsData).toHaveLength(2)
    expect(result.recentLeadsData[0]?.email).toBe('ana@example.com')
  })

  it('filters customers through the direct backend query endpoint', async () => {
    prisma.customer.count.mockResolvedValue(1)
    prisma.customer.findMany.mockResolvedValue([
      {
        id: 7,
        name: 'Buyer Example',
        email: 'buyer@example.com',
        phoneNumber: '+59891234567',
        statusId: 1,
        status: { name: 'Activo', color: '#00ff00' },
        addresses: [{ id: 11, isPrimary: true }],
        phones: [{ phone: '+59891234567', isPrimary: true }],
      },
    ])

    const result = await controller.queryCustomers({
      query: 'buyer',
      pageIndex: 1,
      pageSize: 10,
      sort: { key: 'name', order: 'asc' },
    } as any)

    expect(prisma.customer.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              name: expect.objectContaining({ contains: 'buyer' }),
            }),
          ]),
        }),
      }),
    )
    expect(result.total).toBe(1)
    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.phoneNumber).toBe('+59891234567')
  })
})

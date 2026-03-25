import { describe, expect, it, vi } from 'vitest'
import { DocumentType, EventType, PaymentStatus } from '@prisma/client'
import { AiService } from '../ai.service'

const createPrisma = () => ({
  product: {
    findMany: vi.fn().mockResolvedValue([
      {
        id: 1,
        name: 'Producto base',
        productCode: 'PRD-1',
        mode: 'SIMPLE',
        productType: 'PHYSICAL',
        currency: 'UYU',
        salePrice: { toNumber: () => 1000 },
        costPrice: { toNumber: () => 500 },
        stock: 5,
        published: true,
        category: { id: 7, name: 'Rollers' },
      },
    ]),
    count: vi.fn().mockResolvedValue(1),
    create: vi.fn().mockResolvedValue({
      id: 10,
      name: 'Nuevo producto',
      currency: 'UYU',
      salePrice: { toNumber: () => 1500 },
      mode: 'SIMPLE',
    }),
  },
  customerStatus: {
    findFirst: vi.fn().mockResolvedValue({ id: 1 }),
  },
  customer: {
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({
      id: 22,
      name: 'Cliente IA',
      email: 'cliente@example.com',
      phoneNumber: '+59891234567',
      preferredLocale: 'es',
      statusId: 1,
    }),
    update: vi.fn(),
    findUnique: vi.fn().mockResolvedValue({
      id: 22,
      name: 'Cliente IA',
    }),
  },
  calendarEvent: {
    create: vi.fn().mockResolvedValue({
      id: 44,
      title: 'Visita técnica',
      startAt: new Date('2026-03-25T10:00:00.000Z'),
      endAt: new Date('2026-03-25T11:00:00.000Z'),
      type: EventType.MEETING,
    }),
  },
  order: {
    create: vi.fn().mockResolvedValue({
      id: 55,
      uuid: 'uuid-55',
      documentType: DocumentType.ORDER,
    }),
    findUnique: vi.fn().mockResolvedValue({
      id: 55,
      uuid: 'uuid-55',
    }),
  },
  orderTimelineEvent: {
    create: vi.fn().mockResolvedValue({ id: 1 }),
  },
  payment: {
    create: vi.fn().mockResolvedValue({
      id: 66,
      amount: { toNumber: () => 1500 },
      currency: 'UYU',
      status: PaymentStatus.REGISTERED,
    }),
  },
  $transaction: vi.fn(async (operations) => Promise.all(operations)),
})

describe('AiService', () => {
  it('lists generic actions', () => {
    const service = new AiService(
      createPrisma() as never,
      { get: vi.fn() } as never,
      { getJson: vi.fn() } as never,
    )
    const actions = service.listActions()
    expect(actions.some((entry) => entry.key === 'orders.create')).toBe(true)
    expect(actions.some((entry) => entry.key === 'appointments.create')).toBe(true)
  })

  it('creates or updates a customer generically', async () => {
    const prisma = createPrisma()
    const service = new AiService(
      prisma as never,
      { get: vi.fn() } as never,
      { getJson: vi.fn() } as never,
    )

    const result = await service.createCustomer({
      name: 'Cliente IA',
      email: 'cliente@example.com',
      phoneNumber: '+59891234567',
    })

    expect(result.mode).toBe('created')
    expect(prisma.customer.create).toHaveBeenCalled()
  })

  it('creates a generic order document', async () => {
    const prisma = createPrisma()
    const service = new AiService(
      prisma as never,
      { get: vi.fn() } as never,
      { getJson: vi.fn() } as never,
    )

    const result = await service.createOrder({
      customerId: 22,
      currency: 'UYU',
      deliveryFees: 200,
      items: [
        {
          name: 'Cortina roller',
          price: 1000,
          qty: 2,
        },
      ],
    })

    expect(result.documentType).toBe(DocumentType.ORDER)
    expect(result.grandTotal).toBe(2200)
    expect(prisma.order.create).toHaveBeenCalled()
    expect(prisma.orderTimelineEvent.create).toHaveBeenCalled()
  })
})

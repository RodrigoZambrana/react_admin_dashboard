import { describe, expect, it, vi } from 'vitest'
import { DocumentType, EventType, PaymentStatus } from '@prisma/client'
import { AiService } from '../ai.service'
import { AberturasParserService } from '../../aberturas/parser/aberturas-parser.service'

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
    findUnique: vi.fn().mockResolvedValue({ id: 10 }),
    update: vi.fn().mockResolvedValue({
      id: 10,
      name: 'Producto actualizado',
      currency: 'UYU',
      salePrice: { toNumber: () => 1900 },
      mode: 'SIMPLE',
      published: false,
    }),
  },
  productCategory: {
    findMany: vi.fn().mockResolvedValue([
      {
        id: 7,
        name: 'Rollers',
        description: 'Productos roller',
        parentId: null,
        parent: null,
      },
    ]),
    count: vi.fn().mockResolvedValue(1),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue({ id: 77 }),
    create: vi.fn().mockResolvedValue({
      id: 77,
      name: 'Aberturas',
      description: 'Categoria general',
      parentId: null,
    }),
    update: vi.fn().mockResolvedValue({
      id: 77,
      name: 'Aberturas premium',
      description: 'Categoria actualizada',
      parentId: null,
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
      firstName: 'Cliente',
      lastName: 'IA',
      email: 'cliente@example.com',
      phoneNumber: '+59891234567',
      location: 'Montevideo',
      title: 'Compras',
      preferredLocale: 'es',
    }),
    findMany: vi.fn().mockResolvedValue([
      {
        id: 22,
        name: 'Cliente IA',
        firstName: 'Cliente',
        lastName: 'IA',
        email: 'cliente@example.com',
        phoneNumber: '+59891234567',
        location: 'Montevideo',
        preferredLocale: 'es',
        updatedAt: new Date('2026-03-25T12:00:00.000Z'),
      },
    ]),
    count: vi.fn().mockResolvedValue(1),
  },
  calendarEvent: {
    create: vi.fn().mockResolvedValue({
      id: 44,
      title: 'Visita técnica',
      startAt: new Date('2026-03-25T10:00:00.000Z'),
      endAt: new Date('2026-03-25T11:00:00.000Z'),
      type: EventType.MEETING,
    }),
    findMany: vi.fn().mockResolvedValue([
      {
        id: 44,
        title: 'Visita técnica',
        description: 'Cliente Montevideo',
        type: EventType.MEETING,
        startAt: new Date('2026-03-25T10:00:00.000Z'),
        endAt: new Date('2026-03-25T11:00:00.000Z'),
        location: 'Pocitos',
        updatedAt: new Date('2026-03-25T09:00:00.000Z'),
      },
    ]),
    count: vi.fn().mockResolvedValue(1),
    findUnique: vi.fn().mockResolvedValue({
      id: 44,
      title: 'Visita técnica',
      startAt: new Date('2026-03-25T10:00:00.000Z'),
      endAt: new Date('2026-03-25T11:00:00.000Z'),
    }),
    update: vi.fn().mockResolvedValue({
      id: 44,
      title: 'Visita técnica actualizada',
      startAt: new Date('2026-03-25T12:00:00.000Z'),
      endAt: new Date('2026-03-25T13:00:00.000Z'),
      type: EventType.MEETING,
    }),
    delete: vi.fn().mockResolvedValue({ id: 44 }),
  },
  order: {
    create: vi.fn().mockResolvedValue({
      id: 55,
      uuid: 'uuid-55',
      documentType: DocumentType.ORDER,
    }),
    findMany: vi.fn().mockResolvedValue([
      {
        id: 55,
        uuid: 'uuid-55',
        documentType: DocumentType.ORDER,
        orderCurrency: 'UYU',
        grandTotal: { toNumber: () => 2200 },
        comment: 'Pedido de prueba',
        validUntil: null,
        updatedAt: new Date('2026-03-25T12:00:00.000Z'),
        customer: {
          id: 22,
          name: 'Cliente IA',
        },
      },
    ]),
    count: vi.fn().mockResolvedValue(1),
    findUnique: vi.fn().mockResolvedValue({
      id: 55,
      uuid: 'uuid-55',
      documentType: DocumentType.ORDER,
    }),
    update: vi.fn().mockResolvedValue({
      id: 55,
      uuid: 'uuid-55',
      documentType: DocumentType.ORDER,
      comment: 'Comentario actualizado',
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
    findMany: vi.fn().mockResolvedValue([
      {
        id: 66,
        amount: { toNumber: () => 1500 },
        currency: 'UYU',
        type: 'DEPOSIT',
        status: PaymentStatus.REGISTERED,
        method: 'transferencia',
        reference: 'PAY-001',
        updatedAt: new Date('2026-03-25T12:30:00.000Z'),
        order: {
          id: 55,
          uuid: 'uuid-55',
          customer: {
            id: 22,
            name: 'Cliente IA',
          },
        },
      },
    ]),
    count: vi.fn().mockResolvedValue(1),
    findUnique: vi.fn().mockResolvedValue({
      id: 66,
      status: PaymentStatus.REGISTERED,
      method: 'transferencia',
      reference: 'PAY-001',
      notes: 'nota previa',
      orderId: 55,
      order: {
        uuid: 'uuid-55',
      },
    }),
    update: vi.fn().mockResolvedValue({
      id: 66,
      status: PaymentStatus.CONFIRMED,
      method: 'transferencia',
      reference: 'PAY-001',
      notes: 'nota actualizada',
      orderId: 55,
      order: {
        uuid: 'uuid-55',
      },
    }),
  },
  $transaction: vi.fn(async (operationsOrCallback) => {
    if (typeof operationsOrCallback === 'function') {
      throw new Error('transaction callback should be rebound in createService')
    }
    return Promise.all(operationsOrCallback)
  }),
})

const createService = () => {
  const prisma = createPrisma()
  prisma.$transaction = vi.fn(async (operationsOrCallback) => {
    if (typeof operationsOrCallback === 'function') {
      return operationsOrCallback(prisma as never)
    }
    return Promise.all(operationsOrCallback)
  })
  const salesDocuments = {
    updateDocumentStatus: vi.fn().mockResolvedValue(true),
    sendBudget: vi.fn().mockResolvedValue({
      budgetId: 55,
      statusId: 1010,
      validUntilDate: new Date('2026-04-01T00:00:00.000Z'),
    }),
    confirmBudget: vi.fn().mockResolvedValue({
      budgetId: 55,
      orderId: 88,
    }),
  }
  const paymentSettlement = {
    apply: vi.fn().mockResolvedValue({
      paymentId: 66,
      orderId: 55,
      previousStatusId: 100,
      nextStatusId: 200,
      notifyPaymentReceived: true,
      notifyOrderStatusChanged: true,
    }),
    dispatch: vi.fn().mockResolvedValue(undefined),
  }
  const aberturasGlossary = {
    listGrouped: vi.fn().mockResolvedValue({
      tipo: [
        { label: 'CORREDIZA', value: 'VENTANA_CORREDIZA' },
        { label: 'PUERTA BATIENTE 1H', value: 'PUERTA_BATIENTE_1H' },
      ],
      serie: [
        { label: 'PROBBA', value: 'PROBBA' },
        { label: 'GALA 45', value: 'GALA45' },
      ],
      color: [
        { label: 'BLANCO', value: 'BLANCO' },
        { label: 'NEGRO', value: 'NEGRO' },
      ],
      vidrio: [
        { label: '4MM', value: '4MM' },
        { label: 'DVH (4/9/5)', value: 'DVH(4/9/5)' },
      ],
    }),
    getConfig: vi.fn().mockResolvedValue({
      nearest: {
        maxResults: 3,
        dimensionTolerancePercent: 12,
        dimensionMinToleranceMm: 40,
      },
      pricing: {
        markupPercent: 25,
      },
    }),
  }
  const parametricPricing = {
    searchMatrixDefault: vi.fn().mockResolvedValue({
      exact: {
        matchLevel: 'exact',
        metadata: { similarityScore: 1 },
        row: {
          familyId: 'VENTANA_CORREDIZA',
          serie: 'PROBBA',
          color: 'BLANCO',
          vidrio: '4MM',
          widthMm: 1100,
          heightMm: 1200,
          detailSnapshot: 'Corrediza Probba blanco 1100x1200',
          specifications: 'Serie PROBBA',
          source: 'matrix',
          referenceDate: '2026-03-20T00:00:00.000Z',
        },
        resolution: {
          available: true,
          price: 234,
          currency: 'USD',
        },
      },
      nearest: [],
      suggestions: [],
    }),
  }

  const service = new AiService(
    prisma as never,
    { get: vi.fn() } as never,
    { getJson: vi.fn() } as never,
    salesDocuments as never,
    paymentSettlement as never,
    new AberturasParserService(aberturasGlossary as never) as never,
    parametricPricing as never,
  )

  return { prisma, service, salesDocuments, paymentSettlement, aberturasGlossary, parametricPricing }
}

describe('AiService', () => {
  it('lists generic actions', () => {
    const { service } = createService()
    const actions = service.listActions()
    expect(actions.some((entry) => entry.key === 'orders.create')).toBe(true)
    expect(actions.some((entry) => entry.key === 'appointments.create')).toBe(true)
    expect(actions.some((entry) => entry.key === 'customers.search')).toBe(true)
    expect(actions.some((entry) => entry.key === 'appointments.delete')).toBe(true)
    expect(actions.some((entry) => entry.key === 'products.archive')).toBe(true)
    expect(actions.some((entry) => entry.key === 'orders.search')).toBe(true)
    expect(actions.some((entry) => entry.key === 'quotes.search')).toBe(true)
    expect(actions.some((entry) => entry.key === 'payments.search')).toBe(true)
    expect(actions.some((entry) => entry.key === 'orders.update_status')).toBe(true)
    expect(actions.some((entry) => entry.key === 'quotes.send')).toBe(true)
    expect(actions.some((entry) => entry.key === 'quotes.confirm')).toBe(true)
    expect(actions.some((entry) => entry.key === 'payments.update_status')).toBe(true)
    expect(actions.some((entry) => entry.key === 'categories.search')).toBe(true)
    expect(actions.some((entry) => entry.key === 'categories.create')).toBe(true)
    expect(actions.some((entry) => entry.key === 'categories.update')).toBe(true)
    expect(actions.some((entry) => entry.key === 'products.adjust_stock')).toBe(true)
    expect(actions.some((entry) => entry.key === 'products.publish')).toBe(true)
    expect(actions.some((entry) => entry.key === 'orders.update_comment')).toBe(true)
    expect(actions.some((entry) => entry.key === 'quotes.update_comment')).toBe(true)
    expect(actions.some((entry) => entry.key === 'payments.update')).toBe(true)
    expect(actions.some((entry) => entry.key === 'aberturas.parse')).toBe(true)
    expect(actions.find((entry) => entry.key === 'payments.create')).toMatchObject({
      toolName: 'create_payment',
      confirmationRequired: true,
      requiredFields: ['orderId', 'amount', 'currency'],
    })
  })

  it('creates or updates a customer generically', async () => {
    const { prisma, service } = createService()

    const result = await service.createCustomer({
      name: 'Cliente IA',
      email: 'cliente@example.com',
      phoneNumber: '+59891234567',
    })

    expect(result.mode).toBe('created')
    expect(prisma.customer.create).toHaveBeenCalled()
  })

  it('creates a generic order document', async () => {
    const { prisma, service } = createService()

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

  it('lists orders, quotes and payments for admin search-first flows', async () => {
    const { prisma, service } = createService()

    const orders = await service.listOrders({
      search: 'cliente',
      documentType: DocumentType.ORDER,
      page: 1,
      pageSize: 10,
    })
    expect(orders.total).toBe(1)
    expect(orders.items[0]).toMatchObject({
      id: 55,
      uuid: 'uuid-55',
      currency: 'UYU',
    })

    const quotes = await service.listOrders({
      search: 'cliente',
      documentType: DocumentType.BUDGET,
      page: 1,
      pageSize: 10,
    })
    expect(quotes.total).toBe(1)
    expect(prisma.order.findMany).toHaveBeenCalledTimes(2)

    const payments = await service.listPayments({
      search: 'transferencia',
      page: 1,
      pageSize: 10,
    })
    expect(payments.total).toBe(1)
    expect(payments.items[0]).toMatchObject({
      id: 66,
      currency: 'UYU',
      reference: 'PAY-001',
    })
    expect(prisma.payment.findMany).toHaveBeenCalled()
  })

  it('lists and updates customers for admin actions', async () => {
    const { prisma, service } = createService()

    const listed = await service.listCustomers({ search: 'cliente', page: 1, pageSize: 10 })
    expect(listed.total).toBe(1)
    expect(prisma.customer.findMany).toHaveBeenCalled()

    const updated = await service.updateCustomer(22, {
      name: 'Cliente IA Actualizado',
      location: 'Centro',
    })
    expect(updated.mode).toBe('updated')
    expect(prisma.customer.update).toHaveBeenCalled()
  })

  it('lists, updates and deletes appointments for admin actions', async () => {
    const { prisma, service } = createService()

    const listed = await service.listAppointments({
      search: 'visita',
      page: 1,
      pageSize: 10,
    })
    expect(listed.total).toBe(1)
    expect(prisma.calendarEvent.findMany).toHaveBeenCalled()

    const updated = await service.updateAppointment(44, {
      title: 'Visita técnica actualizada',
      startAt: '2026-03-25T12:00:00.000Z',
      endAt: '2026-03-25T13:00:00.000Z',
    })
    expect(updated.title).toBe('Visita técnica actualizada')

    const deleted = await service.deleteAppointment(44)
    expect(deleted).toMatchObject({ id: 44, deleted: true })
    expect(prisma.calendarEvent.delete).toHaveBeenCalledWith({ where: { id: 44 } })
  })

  it('updates and archives products for admin actions', async () => {
    const { prisma, service } = createService()

    const updated = await service.updateProduct(10, {
      name: 'Producto actualizado',
      salePrice: 1900,
    })
    expect(updated.name).toBe('Producto actualizado')
    expect(prisma.product.update).toHaveBeenCalled()

    const archived = await service.archiveProduct(10)
    expect(archived).toMatchObject({ id: 10, archived: true, published: false })
  })

  it('filters product search by published state for customer AI roles', async () => {
    const { prisma, service } = createService()

    await service.listProducts({ search: 'producto', page: 1, pageSize: 10 }, 'customer_public')
    expect(prisma.product.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          published: true,
        }),
      }),
    )

    await service.listProducts({ search: 'producto', page: 1, pageSize: 10 }, 'admin_operations')
    expect(prisma.product.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.not.objectContaining({
          published: true,
        }),
      }),
    )
  })

  it('lists categories, creates categories and adjusts stock as general safe operations', async () => {
    const { prisma, service } = createService()
    prisma.product.findUnique.mockResolvedValueOnce({
      id: 10,
      name: 'Producto base',
      stock: 5,
    })
    prisma.product.update.mockResolvedValueOnce({
      id: 10,
      name: 'Producto base',
      stock: 8,
    })

    const categories = await service.listCategories({
      search: 'roller',
      page: 1,
      pageSize: 10,
    })
    expect(categories.total).toBe(1)
    expect(prisma.productCategory.findMany).toHaveBeenCalled()

    const created = await service.createCategory({
      name: 'Aberturas',
    })
    expect(created.mode).toBe('created')
    expect(prisma.productCategory.create).toHaveBeenCalled()

    const stockAdjusted = await service.adjustProductStock(10, {
      delta: 3,
    })
    expect(stockAdjusted).toMatchObject({
      id: 10,
      previousStock: 5,
      stock: 8,
      deltaApplied: 3,
    })
  })

  it('updates categories and republishes products as general safe operations', async () => {
    const { prisma, service } = createService()
    prisma.product.update.mockResolvedValueOnce({
      id: 10,
      name: 'Producto base',
      published: true,
    })

    const updatedCategory = await service.updateCategory(77, {
      name: 'Aberturas premium',
      description: 'Categoria actualizada',
    })
    expect(updatedCategory).toMatchObject({
      mode: 'updated',
      category: {
        id: 77,
        name: 'Aberturas premium',
      },
    })
    expect(prisma.productCategory.update).toHaveBeenCalled()

    const published = await service.publishProduct(10)
    expect(published).toMatchObject({
      id: 10,
      published: true,
      archived: false,
    })
  })

  it('parses aberturas text into structured deterministic items', async () => {
    const { service } = createService()

    const parsed = await service.parseAberturas({
      text: 'Corrediza Probba blanco vidrio simple de 1.10 x 1.20',
      source: 'whatsapp',
    })

    expect(parsed.itemCount).toBe(1)
    expect(parsed.items[0]).toMatchObject({
      familyId: 'VENTANA_CORREDIZA',
      serie: 'PROBBA',
      color: 'BLANCO',
      widthMm: 1100,
      heightMm: 1200,
      material: 'ALUMINIO',
    })
    expect(parsed.summary).toMatch(/PROBBA 1100x1200/i)
  })

  it('prepares aberturas quote drafts with parametric pricing matches', async () => {
    const { service, parametricPricing } = createService()

    const prepared = await service.prepareAberturasQuote({
      text: 'Corrediza Probba blanco 4mm de 1.10 x 1.20',
      source: 'whatsapp',
    })

    expect(parametricPricing.searchMatrixDefault).toHaveBeenCalled()
    expect(prepared.readyItemCount).toBe(1)
    expect(prepared.items[0]).toMatchObject({
      readyForQuote: true,
      pricing: {
        price: 234,
        currency: 'USD',
      },
      draftItem: {
        name: expect.stringMatching(/PROBBA/i),
        price: 234,
        currency: 'USD',
      },
    })
  })

  it('updates order, quote and payment statuses with real safe flows', async () => {
    const { prisma, service, salesDocuments, paymentSettlement } = createService()

    const orderUpdated = await service.updateOrderStatus(55, { status: 'paid' })
    expect(orderUpdated).toMatchObject({
      id: 55,
      documentType: DocumentType.ORDER,
      updated: true,
      status: { code: 'paid' },
    })
    expect(salesDocuments.updateDocumentStatus).toHaveBeenCalledWith(
      DocumentType.ORDER,
      55,
      expect.objectContaining({ status: 200 }),
    )

    const quoteSent = await service.sendQuote(55)
    expect(quoteSent).toMatchObject({
      id: 55,
      documentType: DocumentType.BUDGET,
      updated: true,
      status: { code: 'budget_sent' },
    })

    const quoteConfirmed = await service.confirmQuote(55)
    expect(quoteConfirmed).toMatchObject({
      id: 55,
      convertedOrderId: 88,
      documentType: DocumentType.BUDGET,
      updated: true,
      status: { code: 'budget_converted' },
    })

    const paymentUpdated = await service.updatePaymentStatus(66, {
      status: PaymentStatus.CONFIRMED,
    })
    expect(paymentUpdated).toMatchObject({
      id: 66,
      status: PaymentStatus.CONFIRMED,
      updated: true,
    })
    expect(prisma.payment.update).toHaveBeenCalled()
    expect(paymentSettlement.apply).toHaveBeenCalled()
    expect(paymentSettlement.dispatch).toHaveBeenCalled()
  })

  it('updates document comments and payment metadata with safe generic operations', async () => {
    const { prisma, service } = createService()
    prisma.order.findUnique
      .mockResolvedValueOnce({
        id: 55,
        uuid: 'uuid-55',
        documentType: DocumentType.ORDER,
      })
      .mockResolvedValueOnce({
        id: 55,
        uuid: 'uuid-55',
        documentType: DocumentType.BUDGET,
      })
    prisma.order.update
      .mockResolvedValueOnce({
        id: 55,
        uuid: 'uuid-55',
        documentType: DocumentType.ORDER,
        comment: 'Comentario pedido',
      })
      .mockResolvedValueOnce({
        id: 55,
        uuid: 'uuid-55',
        documentType: DocumentType.BUDGET,
        comment: 'Comentario presupuesto',
      })
    prisma.payment.findUnique.mockResolvedValueOnce({
      id: 66,
      orderId: 55,
      order: { uuid: 'uuid-55' },
    })
    prisma.payment.update.mockResolvedValueOnce({
      id: 66,
      orderId: 55,
      method: 'efectivo',
      reference: 'PAY-009',
      notes: 'Cobro parcial',
      order: { uuid: 'uuid-55' },
    })

    const orderComment = await service.updateOrderComment(55, {
      comment: 'Comentario pedido',
    })
    expect(orderComment).toMatchObject({
      id: 55,
      documentType: DocumentType.ORDER,
      comment: 'Comentario pedido',
      updated: true,
    })

    const quoteComment = await service.updateQuoteComment(55, {
      comment: 'Comentario presupuesto',
    })
    expect(quoteComment).toMatchObject({
      id: 55,
      documentType: DocumentType.BUDGET,
      comment: 'Comentario presupuesto',
      updated: true,
    })

    const paymentUpdated = await service.updatePayment(66, {
      method: 'efectivo',
      reference: 'PAY-009',
      notes: 'Cobro parcial',
    })
    expect(paymentUpdated).toMatchObject({
      id: 66,
      orderUuid: 'uuid-55',
      method: 'efectivo',
      reference: 'PAY-009',
      notes: 'Cobro parcial',
      updated: true,
    })
  })

  it('updates order and quote structure via canonical replace flow', async () => {
    const { service, salesDocuments } = createService()
    salesDocuments.getDocumentDetails = vi
      .fn()
      .mockResolvedValueOnce({
        id: 55,
        uuid: 'uuid-55',
        date: '2026-03-25T12:00:00.000Z',
        customer: { id: 22 },
        items: [
          {
            id: 1,
            productId: 10,
            name: 'Cortina roller',
            price: 1000,
            qty: 2,
            unitCurrency: 'UYU',
          },
        ],
        paymentMethod: { name: 'Transferencia' },
        orderCurrency: 'UYU',
        billingSameAsShipping: true,
        shippingAddress1: 'Av. Italia 1234',
        shippingCity: 'Montevideo',
        shippingState: 'Montevideo',
        shippingCountry: 'Uruguay',
        billingAddress1: 'Av. Italia 1234',
        billingCity: 'Montevideo',
        billingState: 'Montevideo',
        billingCountry: 'Uruguay',
        deliveryFees: 100,
        shippingVendor: 'DAC',
        estimatedMin: 2,
        estimatedMax: 4,
        comment: 'Comentario previo',
      })
      .mockResolvedValueOnce({
        id: 55,
        uuid: 'uuid-55',
        orderCurrency: 'USD',
        validUntilDate: null,
        deliveryFees: 200,
        shippingVendor: 'Agencia Central',
        items: [{ id: 1 }, { id: 2 }],
      })
      .mockResolvedValueOnce({
        id: 56,
        uuid: 'uuid-56',
        date: '2026-03-25T12:00:00.000Z',
        customer: { id: 22 },
        items: [
          {
            id: 2,
            productId: 11,
            name: 'Presupuesto base',
            price: 500,
            qty: 1,
            unitCurrency: 'USD',
          },
        ],
        paymentMethod: { name: 'Transferencia' },
        orderCurrency: 'USD',
        billingSameAsShipping: true,
        shippingAddress1: 'Av. Italia 1234',
        shippingCity: 'Montevideo',
        shippingState: 'Montevideo',
        shippingCountry: 'Uruguay',
        billingAddress1: 'Av. Italia 1234',
        billingCity: 'Montevideo',
        billingState: 'Montevideo',
        billingCountry: 'Uruguay',
        deliveryFees: 0,
        shippingVendor: null,
        estimatedMin: null,
        estimatedMax: null,
        validUntilDate: '2026-03-31T00:00:00.000Z',
        comment: null,
      })
      .mockResolvedValueOnce({
        id: 56,
        uuid: 'uuid-56',
        orderCurrency: 'USD',
        validUntilDate: '2026-04-05T00:00:00.000Z',
        deliveryFees: 0,
        shippingVendor: null,
        items: [{ id: 2 }],
      })
    salesDocuments.replaceDocument = vi.fn().mockResolvedValue(true)

    const updatedOrder = await service.updateOrderStructure(55, {
      currency: 'USD',
      deliveryFees: 200,
      shippingVendor: 'Agencia Central',
      appendItems: [
        {
          name: 'Mosquitero adicional',
          price: 90,
          qty: 1,
        },
      ],
    })
    expect(salesDocuments.replaceDocument).toHaveBeenCalledWith(
      DocumentType.ORDER,
      55,
      expect.objectContaining({
        orderCurrency: 'USD',
        shipping: expect.objectContaining({
          shippingVendor: 'Agencia Central',
          deliveryFees: 200,
        }),
        items: expect.arrayContaining([
          expect.objectContaining({ name: 'Cortina roller' }),
          expect.objectContaining({ name: 'Mosquitero adicional' }),
        ]),
      }),
    )
    expect(updatedOrder).toMatchObject({
      id: 55,
      documentType: DocumentType.ORDER,
      currency: 'USD',
      itemCount: 2,
    })

    const updatedQuote = await service.updateQuoteStructure(56, {
      validForDays: 10,
      removeItemNames: ['Presupuesto base'],
      appendItems: [
        {
          name: 'Corrediza Probba',
          price: 234,
          qty: 1,
          currency: 'USD',
        },
      ],
    })
    expect(salesDocuments.replaceDocument).toHaveBeenCalledWith(
      DocumentType.BUDGET,
      56,
      expect.objectContaining({
        validUntilDate: expect.any(String),
        items: [expect.objectContaining({ name: 'Corrediza Probba' })],
      }),
    )
    expect(updatedQuote).toMatchObject({
      id: 56,
      documentType: DocumentType.BUDGET,
      currency: 'USD',
      itemCount: 1,
    })
  })

  it('persists prompt overrides in runtime config', async () => {
    const storedValue = {
      enabled: true,
      provider: 'openai' as const,
      model: 'gpt-4o-mini',
      openAiApiKey: null,
      monthlySpendingLimitUsd: 25,
      currentUsageUsd: 0,
      warningThresholdPercent: 80,
      usageMessage: 'Monitor usage closely before enabling high-volume channels.',
      adminInternalPrompt: 'Usar siempre el informe de UruCortinas.',
      customerPublicPrompt: 'Responder solo con información aprobada.',
    }
    const secureConfig = {
      getJson: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          value: storedValue,
          updatedAt: new Date('2026-03-25T10:00:00.000Z'),
        }),
      setJson: vi.fn().mockResolvedValue(undefined),
    }
    const service = new AiService(
      createPrisma() as never,
      {
        get: vi.fn((key: string) => {
          if (key === 'AI_MODEL_PROVIDER') return 'openai'
          if (key === 'AI_MODEL_NAME') return 'gpt-4o-mini'
          return undefined
        }),
      } as never,
      secureConfig as never,
      { updateDocumentStatus: vi.fn(), sendBudget: vi.fn(), confirmBudget: vi.fn() } as never,
      { apply: vi.fn(), dispatch: vi.fn() } as never,
      { listGrouped: vi.fn(), getConfig: vi.fn() } as never,
      { searchMatrixDefault: vi.fn() } as never,
    )

    const result = await service.updateRuntimeConfig({
      provider: 'openai',
      model: 'gpt-4o-mini',
      adminInternalPrompt: 'Usar siempre el informe de UruCortinas.',
      customerPublicPrompt: 'Responder solo con información aprobada.',
    })

    expect(secureConfig.setJson).toHaveBeenCalledWith(
      'AI_RUNTIME_CONFIG',
      expect.objectContaining({
        adminInternalPrompt: 'Usar siempre el informe de UruCortinas.',
        customerPublicPrompt: 'Responder solo con información aprobada.',
      }),
    )
    expect(result).toMatchObject({
      adminInternalPrompt: 'Usar siempre el informe de UruCortinas.',
      customerPublicPrompt: 'Responder solo con información aprobada.',
    })
  })
})

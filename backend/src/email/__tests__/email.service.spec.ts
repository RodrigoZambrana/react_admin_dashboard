import { describe, expect, it, beforeEach, vi } from 'vitest'
import { EmailService } from '../email.service'
import { EmailCategory, EmailRecipientType, PaymentStatus } from '@prisma/client'
import type { EmailMessage } from '../email.types'

const createService = () => {
  const prisma = {
    order: {
      findUnique: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
    },
  } as any

  const templateService = {
    render: vi.fn(async (params: any) => ({
      subject: 'Test Subject',
      html: '<p>Body</p>',
      text: 'Body',
      locale: params?.payload?.locale ?? 'en',
      templateId: 1,
    })),
  }

  const queue = {
    enqueue: vi.fn(async () => ({ id: 1 })),
  }

  const settings = {
    isEnabled: vi.fn(async () => true),
    isRecipientDeliveryEnabled: vi.fn(async (_recipientType: EmailRecipientType) => true),
    resolveAdminRecipients: vi.fn(async () => ({ to: ['admin@example.com'], cc: [], bcc: [] })),
    getCategorySettings: vi.fn(async () => ({ fromAddress: 'no-reply@example.com', fromName: 'Acme', enabled: true })),
    getCompanyProfile: vi.fn(async () => ({
      legalName: 'Acme Corp',
      tradeName: 'Acme',
      email: 'support@example.com',
      phone: null,
      website: null,
      addressLine1: null,
      addressLine2: null,
    })),
  }

  const config = {
    get: vi.fn(() => undefined),
  } as any

  const service = new EmailService(prisma, templateService as any, queue as any, settings as any, config)

  return { service, prisma, templateService, queue, settings }
}

const extractMessage = (mock: ReturnType<typeof vi.fn>, index: number): EmailMessage => {
  const call = mock.mock.calls[index]
  expect(call).toBeDefined()
  return call[0] as EmailMessage
}

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queues customer and admin emails for order confirmations', async () => {
    const { service, prisma, queue, settings } = createService()

    prisma.order.findUnique.mockResolvedValue({
      id: 42,
      uuid: 'ORD-42',
      date: new Date('2024-05-01T10:00:00Z'),
      status: { name: 'Pending' },
      customer: {
        id: 99,
        name: 'Jane Doe',
        email: 'jane@example.com',
      },
      items: [
        { name: 'Widget', qty: 2, price: 50 },
      ],
      subTotal: 100,
      tax: 22,
      grandTotal: 122,
      orderCurrency: 'USD',
    })

    await service.sendOrderReceived({ orderId: 42 })

    expect(prisma.order.findUnique).toHaveBeenCalled()
    expect(queue.enqueue).toHaveBeenCalledTimes(2)

    const customerMessage = extractMessage(queue.enqueue, 0)
    expect(customerMessage.category).toBe(EmailCategory.ORDERS)
    expect(customerMessage.recipientType).toBe(EmailRecipientType.CUSTOMER)
    expect(customerMessage.locale).toBe('en')
    expect(customerMessage.recipients[0]).toMatchObject({ email: 'jane@example.com', locale: 'en' })
    expect(customerMessage.payload.event).toBe('order.received')

    const adminMessage = extractMessage(queue.enqueue, 1)
    expect(adminMessage.recipientType).toBe(EmailRecipientType.ADMIN)
    expect(adminMessage.locale).toBe('es')
    expect(adminMessage.recipients[0]).toMatchObject({ email: 'admin@example.com', locale: 'es' })
    expect(adminMessage.payload.event).toBe('order.received_admin')

    expect(settings.resolveAdminRecipients).toHaveBeenCalledWith(EmailCategory.ORDERS)
  })

  it('skips customer emails when delivery disabled', async () => {
    const { service, prisma, queue, settings } = createService()

    settings.isRecipientDeliveryEnabled.mockImplementation(async (recipientType: EmailRecipientType) => {
      return recipientType === EmailRecipientType.ADMIN
    })

    prisma.order.findUnique.mockResolvedValue({
      id: 7,
      uuid: 'ORD-7',
      date: new Date('2024-05-05T10:00:00Z'),
      status: { name: 'Pending' },
      customer: {
        id: 10,
        name: 'Sam Customer',
        email: 'sam@example.com',
      },
      items: [{ name: 'Widget', qty: 1, price: 20 }],
      subTotal: 20,
      tax: 0,
      grandTotal: 20,
      orderCurrency: 'USD',
    })

    await service.sendOrderReceived({ orderId: 7 })

    expect(queue.enqueue).toHaveBeenCalledTimes(1)
    const adminMessage = extractMessage(queue.enqueue, 0)
    expect(adminMessage.recipientType).toBe(EmailRecipientType.ADMIN)
    expect(adminMessage.recipients[0].email).toBe('admin@example.com')
  })

  it('skips sending when category disabled', async () => {
    const { service, settings, prisma, queue } = createService()

    settings.isEnabled.mockResolvedValue(false)
    prisma.order.findUnique.mockResolvedValue(null)

    await service.sendOrderReceived({ orderId: 1 })

    expect(queue.enqueue).not.toHaveBeenCalled()
  })

  it('queues payment confirmation emails only when status confirmed', async () => {
    const { service, prisma, queue } = createService()

    prisma.payment.findUnique.mockResolvedValue({
      id: 13,
      orderId: 42,
      order: {
        id: 42,
        uuid: 'ORD-42',
        customer: {
          id: 5,
          name: 'Alex Smith',
          email: 'alex@example.com',
        },
        statusId: 200,
      },
      paymentMethodId: 1,
      amount: 99,
      currency: 'USD',
      method: 'VISA',
      status: PaymentStatus.CONFIRMED,
      date: new Date('2024-05-02T12:00:00Z'),
    })

    await service.sendPaymentReceived({ paymentId: 13 })

    expect(prisma.payment.findUnique).toHaveBeenCalled()
    expect(queue.enqueue).toHaveBeenCalled()
  })

  it('sends password reset email with sanitized display name', async () => {
    const { service, queue } = createService()

    await service.sendPasswordReset({
      email: 'User@Example.com',
      resetUrl: 'https://app/reset?token=abc',
      expiresAt: new Date('2024-05-03T15:00:00Z'),
      displayName: '  Chris P.  ',
      isAdmin: true,
    })

    expect(queue.enqueue).toHaveBeenCalledTimes(1)
    const message = extractMessage(queue.enqueue, 0)
    expect(message.category).toBe(EmailCategory.AUTH)
    expect(message.recipientType).toBe(EmailRecipientType.ADMIN)
    expect(message.recipients[0].email).toBe('user@example.com')
    expect(message.recipients[0].name).toBe('Chris P.')
  })
})

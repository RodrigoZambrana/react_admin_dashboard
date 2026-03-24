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
    resolveEmailProviderConfig: vi.fn(async () => ({
      provider: 'SMTP',
      fromAddress: 'desarrollo@software-strategy.com',
      fromName: 'Acme',
      customerEmailsEnabled: true,
      adminEmailsEnabled: true,
      smtp: {
        host: 'smtp.example.test',
        port: 587,
        secure: false,
        allowInvalidCerts: false,
        user: 'user',
        password: 'secret',
      },
    })),
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
  const clientConfig = {
    slug: 'urucortinas',
    displayName: 'UruCortinas',
    shared: { locale: 'es-UY', currency: 'UYU', timezone: 'America/Montevideo' },
  } as any

  const service = new EmailService(prisma, templateService as any, queue as any, settings as any, config, clientConfig)

  return { service, prisma, templateService, queue, settings, config }
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
        phoneNumber: '+59899111222',
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
    expect(adminMessage.payload.customer).toMatchObject({ phone: '+59899111222' })

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
      reference: 'MP-123',
      order: {
        id: 42,
        uuid: 'ORD-42',
        date: new Date('2024-05-01T10:00:00Z'),
        customer: {
          id: 5,
          name: 'Alex Smith',
          email: 'alex@example.com',
          phoneNumber: '+59899888777',
          preferredLocale: 'es',
        },
        statusId: 200,
        items: [
          { name: 'Ventana', qty: 1, price: 99, description: 'Serie: 20 • Color: Blanco' },
        ],
        payments: [
          { amount: 99, status: PaymentStatus.CONFIRMED },
        ],
        grandTotal: 99,
        orderCurrency: 'USD',
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
    expect(queue.enqueue).toHaveBeenCalledTimes(2)

    const customerMessage = extractMessage(queue.enqueue, 0)
    expect(customerMessage.recipientType).toBe(EmailRecipientType.CUSTOMER)
    expect(customerMessage.locale).toBe('es')
    expect(customerMessage.recipients[0]).toMatchObject({ email: 'alex@example.com', locale: 'es' })
    expect(customerMessage.payload.locale).toBe('es')
    expect(customerMessage.payload.statusLabel).toBe('Confirmado')
    expect(customerMessage.payload.isFullyPaid).toBe(true)
    expect(customerMessage.payload.customer).toMatchObject({ phone: '+59899888777' })
    expect(customerMessage.payload.totals).toMatchObject({
      grandTotalRaw: 99,
      totalPaidRaw: 99,
      remainingRaw: 0,
      currency: 'USD',
    })

    const adminMessage = extractMessage(queue.enqueue, 1)
    expect(adminMessage.recipientType).toBe(EmailRecipientType.ADMIN)
    expect(adminMessage.locale).toBe('es')
    expect(adminMessage.recipients[0]).toMatchObject({ email: 'admin@example.com', locale: 'es' })
    expect(adminMessage.payload.locale).toBe('es')
    expect(adminMessage.payload.reference).toBe('MP-123')
  })

  it('marks payment email payload as partial when order still has outstanding balance', async () => {
    const { service, prisma, queue } = createService()

    prisma.payment.findUnique.mockResolvedValue({
      id: 14,
      orderId: 55,
      reference: null,
      order: {
        id: 55,
        uuid: 'ORD-55',
        date: new Date('2024-05-02T10:00:00Z'),
        customer: {
          id: 8,
          name: 'Taylor Client',
          email: 'taylor@example.com',
          phoneNumber: null,
          preferredLocale: 'en',
        },
        statusId: 100,
        items: [{ name: 'Blind', qty: 1, price: 200, description: null }],
        payments: [{ amount: 80, status: PaymentStatus.CONFIRMED }],
        grandTotal: 200,
        orderCurrency: 'USD',
      },
      paymentMethodId: 1,
      amount: 80,
      currency: 'USD',
      method: 'VISA',
      status: PaymentStatus.CONFIRMED,
      date: new Date('2024-05-02T12:00:00Z'),
    })

    await service.sendPaymentReceived({ paymentId: 14, sendToAdmin: false })

    expect(queue.enqueue).toHaveBeenCalledTimes(1)
    const customerMessage = extractMessage(queue.enqueue, 0)
    expect(customerMessage.payload.isFullyPaid).toBe(false)
    expect(customerMessage.payload.totals).toMatchObject({
      totalPaidRaw: 80,
      remainingRaw: 120,
      grandTotalRaw: 200,
    })
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

  it('queues welcome email for customer onboarding', async () => {
    const { service, queue } = createService()

    await service.sendWelcome({
      email: 'NewUser@example.com',
      locale: 'es',
      displayName: '  Sofía Cliente  ',
      accountUrl: 'https://store.example.com/account/profile',
    })

    expect(queue.enqueue).toHaveBeenCalledTimes(1)
    const message = extractMessage(queue.enqueue, 0)
    expect(message.category).toBe(EmailCategory.AUTH)
    expect(message.recipientType).toBe(EmailRecipientType.CUSTOMER)
    expect(message.locale).toBe('es')
    expect(message.recipients[0]).toMatchObject({
      email: 'newuser@example.com',
      name: 'Sofía Cliente',
      locale: 'es',
    })
    expect(message.payload).toMatchObject({
      event: 'welcome',
      resetUrl: null,
      accountUrl: 'https://store.example.com/account/profile',
      displayName: 'Sofía Cliente',
    })
  })

  it('falls back to storefront site url when customer portal url is not configured', async () => {
    const { service, queue, config } = createService()
    config.get.mockImplementation((key: string) => {
      if (key === 'NEXT_PUBLIC_SITE_URL') return 'http://localhost:3000'
      return undefined
    })

    await service.sendWelcome({
      email: 'fallback@example.com',
      locale: 'es',
      displayName: 'Cliente',
    })

    const message = extractMessage(queue.enqueue, 0)
    expect(message.payload).toMatchObject({
      event: 'welcome',
      accountUrl: 'http://localhost:3000/account/profile',
    })
  })
})

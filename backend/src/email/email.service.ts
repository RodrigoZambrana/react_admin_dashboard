import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  EmailCategory,
  EmailRecipientType,
  EmailTemplateVariant,
  PaymentStatus,
  Prisma,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { EmailTemplateService } from './email-template.service'
import { EmailQueueService } from './queue/email-queue.service'
import { EmailSettingsService } from './email-settings.service'
import {
  EmailMessage,
  EmailRecipient,
  OrderEmailContext,
  PaymentEmailContext,
  PasswordResetEmailContext,
} from './email.types'

type OrderEmailOptions = {
  orderId: number
  sendToCustomer?: boolean
  sendToAdmin?: boolean
  localeOverride?: string | null
}

type PaymentEmailOptions = {
  paymentId: number
  sendToCustomer?: boolean
  sendToAdmin?: boolean
  localeOverride?: string | null
}

type PasswordResetEmailOptions = {
  userId?: number | null
  customerId?: number | null
  email: string
  resetUrl: string
  expiresAt: Date
  locale?: string | null
  displayName?: string | null
  isAdmin?: boolean
}

type TestEmailOptions = {
  category: EmailCategory
  variant?: EmailTemplateVariant
  locale?: string
  to: string
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name)
  private companyCache: { expiresAt: number; data: { companyName: string; companyFooter: string } } | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: EmailTemplateService,
    private readonly queue: EmailQueueService,
    private readonly settings: EmailSettingsService,
    private readonly config: ConfigService,
  ) {}

  async sendOrderReceived(options: OrderEmailOptions) {
    if (!(await this.settings.isEnabled(EmailCategory.ORDERS))) {
      this.logger.debug('Order emails disabled; skipping send.')
      return
    }
    const order = await this.prisma.order.findUnique({
      where: { id: options.orderId },
      include: {
        customer: true,
        items: true,
        status: true,
      },
    })
    if (!order) {
      this.logger.warn(`Order ${options.orderId} not found; cannot send email.`)
      return
    }
    const customer = order.customer
    if (!customer) {
      this.logger.warn(`Order ${order.id} has no customer; skipping customer email.`)
    }

    const locale = this.resolveLocale(options.localeOverride)
    const company = await this.getCompanyContext()
    const orderPayload = this.buildOrderPayload(order, locale)
    const extras = { ...company }

    if (options.sendToCustomer !== false && customer?.email) {
      const recipients: EmailRecipient[] = [
        {
          email: customer.email,
          name: this.sanitizeName(customer.name ?? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`),
          locale,
        },
      ]
      const message = await this.buildMessage<OrderEmailContext>({
        category: EmailCategory.ORDERS,
        variant: EmailTemplateVariant.CUSTOMER,
        locale,
        recipientType: EmailRecipientType.CUSTOMER,
        recipients,
        payload: orderPayload,
        extras,
      })
      await this.queue.enqueue(message)
    }

    if (options.sendToAdmin !== false) {
      const recipientsConfig = await this.settings.resolveAdminRecipients(EmailCategory.ORDERS)
      if (recipientsConfig.to.length) {
        const recipients: EmailRecipient[] = recipientsConfig.to.map((email) => ({ email, name: null, locale }))
        const message = await this.buildMessage<OrderEmailContext>({
          category: EmailCategory.ORDERS,
          variant: EmailTemplateVariant.ADMIN,
          locale,
          recipientType: EmailRecipientType.ADMIN,
          recipients,
          payload: orderPayload,
          extras,
          cc: recipientsConfig.cc,
          bcc: recipientsConfig.bcc,
        })
        await this.queue.enqueue(message)
      } else {
        this.logger.debug('No admin recipients configured for order emails.')
      }
    }
  }

  async sendPaymentReceived(options: PaymentEmailOptions) {
    if (!(await this.settings.isEnabled(EmailCategory.PAYMENTS))) {
      this.logger.debug('Payment emails disabled; skipping send.')
      return
    }
    const payment = await this.prisma.payment.findUnique({
      where: { id: options.paymentId },
      include: {
        order: {
          include: {
            customer: true,
            status: true,
          },
        },
        paymentMethod: true,
      },
    })
    if (!payment) {
      this.logger.warn(`Payment ${options.paymentId} not found.`)
      return
    }
    const order = payment.order
    if (!order) {
      this.logger.warn(`Payment ${payment.id} has no associated order.`)
      return
    }
    const customer = order.customer
    const locale = this.resolveLocale(options.localeOverride)
    const company = await this.getCompanyContext()
    const payload = this.buildPaymentPayload(payment, locale)
    const extras = { ...company }

    if (options.sendToCustomer !== false && customer?.email) {
      const recipients: EmailRecipient[] = [
        {
          email: customer.email,
          name: this.sanitizeName(customer.name ?? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`),
          locale,
        },
      ]
      const message = await this.buildMessage<PaymentEmailContext>({
        category: EmailCategory.PAYMENTS,
        variant: EmailTemplateVariant.CUSTOMER,
        locale,
        recipientType: EmailRecipientType.CUSTOMER,
        recipients,
        payload,
        extras,
      })
      await this.queue.enqueue(message)
    }

    if (options.sendToAdmin !== false) {
      const recipientsConfig = await this.settings.resolveAdminRecipients(EmailCategory.PAYMENTS)
      if (recipientsConfig.to.length) {
        const recipients: EmailRecipient[] = recipientsConfig.to.map((email) => ({ email, name: null, locale }))
        const message = await this.buildMessage<PaymentEmailContext>({
          category: EmailCategory.PAYMENTS,
          variant: EmailTemplateVariant.ADMIN,
          locale,
          recipientType: EmailRecipientType.ADMIN,
          recipients,
          payload,
          extras,
          cc: recipientsConfig.cc,
          bcc: recipientsConfig.bcc,
        })
        await this.queue.enqueue(message)
      } else {
        this.logger.debug('No admin recipients configured for payment emails.')
      }
    }
  }

  async sendPasswordReset(options: PasswordResetEmailOptions) {
    if (!(await this.settings.isEnabled(EmailCategory.AUTH))) {
      this.logger.debug('Auth emails disabled; skipping password reset email.')
      return
    }
    const email = this.normalizeEmail(options.email)
    if (!email) {
      this.logger.warn('Password reset email skipped because address is invalid or empty.')
      return
    }
    const locale = this.resolveLocale(options.locale)
    const company = await this.getCompanyContext()
    const displayName = this.sanitizeName(options.displayName) || email
    const payload: PasswordResetEmailContext = {
      resetUrl: options.resetUrl,
      expiresAt: this.formatDate(options.expiresAt, locale),
      displayName,
      locale,
      isAdmin: Boolean(options.isAdmin),
    }
    const variant = options.isAdmin ? EmailTemplateVariant.ADMIN : EmailTemplateVariant.CUSTOMER
    const recipients: EmailRecipient[] = [{ email, name: displayName, locale }]
    const message = await this.buildMessage<PasswordResetEmailContext>({
      category: EmailCategory.AUTH,
      variant,
      locale,
      recipientType: options.isAdmin ? EmailRecipientType.ADMIN : EmailRecipientType.CUSTOMER,
      recipients,
      payload,
      extras: company,
    })
    await this.queue.enqueue(message)
  }

  async sendTestEmail(options: TestEmailOptions) {
    const locale = this.resolveLocale(options.locale)
    const to = this.normalizeEmail(options.to)
    if (!to) {
      throw new Error('Valid test recipient email is required')
    }
    const company = await this.getCompanyContext()
    const samplePayload = this.buildSamplePayload(options.category, locale)
    const variant = options.variant ?? EmailTemplateVariant.CUSTOMER
    const recipientType = variant === EmailTemplateVariant.ADMIN ? EmailRecipientType.ADMIN : EmailRecipientType.CUSTOMER
    const message = await this.buildMessage<any>({
      category: options.category,
      variant,
      locale,
      recipientType,
      recipients: [{ email: to, name: null, locale }],
      payload: samplePayload,
      extras: company,
    })
    await this.queue.enqueue(message)
  }

  private resolveLocale(locale?: string | null) {
    const normalized = (locale ?? '').toString().trim()
    if (!normalized) {
      return this.config.get<string>('DEFAULT_EMAIL_LOCALE') ?? 'en'
    }
    return normalized
  }

  private sanitizeName(name?: string | null) {
    if (!name) return null
    return name.replace(/[\r\n]+/g, ' ').trim() || null
  }

  private normalizeEmail(email?: string | null) {
    if (!email) return null
    const normalized = email.trim().toLowerCase()
    if (!normalized.includes('@')) {
      return null
    }
    return normalized
  }

  private formatDate(date: Date | string, locale: string) {
    const dt = typeof date === 'string' ? new Date(date) : date
    if (Number.isNaN(dt.getTime())) {
      return new Date().toISOString()
    }
    try {
      return new Intl.DateTimeFormat(locale || 'en', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(dt)
    } catch (error) {
      return dt.toISOString()
    }
  }

  private formatAmount(value: Prisma.Decimal.Value, locale: string) {
    const decimal = new Prisma.Decimal(value ?? 0)
    const numeric = Number(decimal.toFixed(2))
    try {
      return new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(numeric)
    } catch (error) {
      return decimal.toFixed(2)
    }
  }

  private buildOrderPayload(order: Prisma.OrderGetPayload<{ include: { customer: true; items: true; status: true } }>, locale: string): OrderEmailContext {
    const items = order.items.map((item) => {
      const qty = Number(item.qty ?? 0)
      const price = new Prisma.Decimal(item.price ?? 0)
      const subtotal = price.times(qty)
      return {
        name: item.name,
        quantity: qty,
        unitPrice: this.formatAmount(item.price ?? 0, locale),
        subtotal: this.formatAmount(subtotal, locale),
      }
    })
    const totals = {
      subtotal: this.formatAmount(order.subTotal ?? 0, locale),
      tax: order.tax ? this.formatAmount(order.tax, locale) : null,
      grandTotal: this.formatAmount(order.grandTotal ?? 0, locale),
      currency: order.orderCurrency ?? 'USD',
    }
    const customer = order.customer
    return {
      orderId: order.id,
      orderNumber: order.uuid || String(order.id),
      orderDate: this.formatDate(order.date, locale),
      status: order.status?.name ?? null,
      customer: {
        id: customer?.id ?? 0,
        name: this.sanitizeName(customer?.name) ?? null,
        email: customer?.email ?? '',
        locale,
      },
      items,
      totals,
      paymentUrl: null,
      portalUrl: this.config.get<string>('CUSTOMER_PORTAL_URL') ?? null,
      locale,
    }
  }

  private buildPaymentPayload(
    payment: Prisma.PaymentGetPayload<{
      include: {
        order: { include: { customer: true; status: true } }
        paymentMethod: true
      }
    }>,
    locale: string,
  ): PaymentEmailContext {
    const order = payment.order
    const customer = order.customer
    return {
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.uuid || String(order.id),
      amount: this.formatAmount(payment.amount, locale),
      currency: payment.currency,
      method: payment.paymentMethod?.name || payment.method || null,
      status: payment.status,
      processedAt: this.formatDate(payment.date, locale),
      customer: {
        id: customer?.id ?? 0,
        name: this.sanitizeName(customer?.name) ?? null,
        email: customer?.email ?? '',
        locale,
      },
      portalUrl: this.config.get<string>('CUSTOMER_PORTAL_URL') ?? null,
      locale,
    }
  }

  private async buildMessage<TPayload>(params: {
    category: EmailCategory
    variant: EmailTemplateVariant
    locale: string
    recipientType: EmailRecipientType
    recipients: EmailRecipient[]
    payload: TPayload & { locale: string }
    extras?: Record<string, unknown>
    cc?: string[]
    bcc?: string[]
  }): Promise<EmailMessage> {
    const render = await this.templates.render(
      {
        category: params.category,
        variant: params.variant,
        payload: params.payload,
      } as any,
      params.extras,
    )
    const fromSettings = await this.settings.getCategorySettings(params.category)
    return {
      category: params.category,
      variant: params.variant,
      locale: render.locale,
      recipientType: params.recipientType,
      recipients: params.recipients,
      subject: render.subject,
      html: render.html,
      text: render.text,
      cc: params.cc,
      bcc: params.bcc,
      from: {
        email: fromSettings.fromAddress,
        name: fromSettings.fromName ?? undefined,
      },
      payload: params.payload as unknown as Record<string, unknown>,
      templateId: render.templateId ?? null,
    }
  }

  private async getCompanyContext() {
    const now = Date.now()
    if (this.companyCache && this.companyCache.expiresAt > now) {
      return this.companyCache.data
    }
    const profile = await this.settings.getCompanyProfile()
    const companyName = profile.tradeName ?? profile.legalName ?? this.config.get<string>('COMPANY_NAME') ?? 'Sistema Administrativo'
    const footerParts: string[] = []
    if (profile.email) footerParts.push(profile.email)
    if (profile.phone) footerParts.push(profile.phone)
    if (profile.website) footerParts.push(profile.website)
    const companyFooter = footerParts.length ? footerParts.join(' • ') : companyName
    this.companyCache = {
      expiresAt: now + 5 * 60 * 1000,
      data: { companyName, companyFooter },
    }
    return this.companyCache.data
  }

  private buildSamplePayload(category: EmailCategory, locale: string) {
    switch (category) {
      case EmailCategory.ORDERS: {
        const payload: OrderEmailContext = {
          orderId: 1001,
          orderNumber: 'ORD-1001',
          orderDate: this.formatDate(new Date(), locale),
          status: 'Pending',
          customer: { id: 1, name: 'Sample Customer', email: 'customer@example.com', locale },
          items: [
            { name: 'Sample Item A', quantity: 2, unitPrice: this.formatAmount(59.9, locale), subtotal: this.formatAmount(119.8, locale) },
            { name: 'Sample Item B', quantity: 1, unitPrice: this.formatAmount(39.5, locale), subtotal: this.formatAmount(39.5, locale) },
          ],
          totals: {
            subtotal: this.formatAmount(159.3, locale),
            tax: this.formatAmount(28.68, locale),
            grandTotal: this.formatAmount(187.98, locale),
            currency: 'USD',
          },
          paymentUrl: null,
          portalUrl: this.config.get<string>('CUSTOMER_PORTAL_URL') ?? null,
          locale,
        }
        return payload
      }
      case EmailCategory.PAYMENTS: {
        const payload: PaymentEmailContext = {
          paymentId: 501,
          orderId: 1001,
          orderNumber: 'ORD-1001',
          amount: this.formatAmount(120, locale),
          currency: 'USD',
          method: 'Credit Card',
          status: PaymentStatus.CONFIRMED,
          processedAt: this.formatDate(new Date(), locale),
          customer: { id: 1, name: 'Sample Customer', email: 'customer@example.com', locale },
          portalUrl: this.config.get<string>('CUSTOMER_PORTAL_URL') ?? null,
          locale,
        }
        return payload
      }
      case EmailCategory.AUTH:
      default: {
        const expires = new Date()
        expires.setHours(expires.getHours() + 2)
        const payload: PasswordResetEmailContext = {
          resetUrl: 'https://example.com/reset?token=demo',
          expiresAt: this.formatDate(expires, locale),
          displayName: 'Sample User',
          locale,
          isAdmin: false,
        }
        return payload
      }
    }
  }
}

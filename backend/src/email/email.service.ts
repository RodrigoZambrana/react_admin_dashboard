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
  OrderEmailAddress,
  OrderEmailContext,
  PaymentEmailContext,
  PasswordResetEmailContext,
} from './email.types'
import { findOrderStatusById } from '../common/constants/order-statuses'
import { findPaymentMethodById } from '../common/constants/payment-methods'

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

const isOrderEmailContext = (
  payload: OrderEmailContext | PaymentEmailContext | PasswordResetEmailContext,
): payload is OrderEmailContext => {
  return typeof payload === 'object' && payload !== null && 'documentType' in payload && 'event' in payload
}

type SalesDocumentStatusEmailOptions = {
  documentType: 'ORDER' | 'BUDGET'
  orderId: number
  previousStatusId?: number | null
  nextStatusId?: number | null
  sendToCustomer?: boolean
  sendToAdmin?: boolean
  localeOverride?: string | null
  eventOverride?: string
}

type PasswordResetEmailOptions = {
  userId?: number | null
  customerId?: number | null
  email: string
  resetUrl?: string | null
  supportUrl?: string | null
  expiresAt?: Date | null
  locale?: string | null
  displayName?: string | null
  isAdmin?: boolean
  event?: 'reset_link' | 'password_changed' | 'recovery_notice'
}

type TestEmailOptions = {
  category: EmailCategory
  variant?: EmailTemplateVariant
  locale?: string
  to: string
  scenarioKey?: string
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

    const company = await this.getCompanyContext()
    const extras = { ...company }

    if (options.sendToCustomer !== false && customer?.email) {
      const customerLocalePreference =
        (customer as { preferredLocale?: string | null })?.preferredLocale ?? options.localeOverride
      const customerLocale = this.resolveLocale(customerLocalePreference)
      const customerPayload = this.buildOrderPayload(order, customerLocale, { event: 'order.received' })
      const recipients: EmailRecipient[] = [
        {
          email: customer.email,
          name: this.sanitizeName(customer.name ?? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`),
          locale: customerLocale,
        },
      ]
      const message = await this.buildMessage<OrderEmailContext>({
        category: EmailCategory.ORDERS,
        variant: EmailTemplateVariant.CUSTOMER,
        locale: customerLocale,
        recipientType: EmailRecipientType.CUSTOMER,
        recipients,
        payload: customerPayload,
        extras,
      })
      await this.queue.enqueue(message)
    }

    if (options.sendToAdmin !== false) {
      const adminLocale = this.resolveLocale('es')
      const adminPayload = this.buildOrderPayload(order, adminLocale, { event: 'order.received_admin' })
      const recipientsConfig = await this.settings.resolveAdminRecipients(EmailCategory.ORDERS)
      if (recipientsConfig.to.length) {
        const recipients: EmailRecipient[] = recipientsConfig.to.map((email) => ({
          email,
          name: null,
          locale: adminLocale,
        }))
        const message = await this.buildMessage<OrderEmailContext>({
          category: EmailCategory.ORDERS,
          variant: EmailTemplateVariant.ADMIN,
          locale: adminLocale,
          recipientType: EmailRecipientType.ADMIN,
          recipients,
          payload: adminPayload,
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
          },
        },
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

  async sendOrderStatusChanged(options: Omit<SalesDocumentStatusEmailOptions, 'documentType'>) {
    await this.sendSalesDocumentStatusEmail({ ...options, documentType: 'ORDER' })
  }

  async sendBudgetStatusChanged(options: Omit<SalesDocumentStatusEmailOptions, 'documentType'>) {
    await this.sendSalesDocumentStatusEmail({ ...options, documentType: 'BUDGET' })
  }

  async sendBudgetCreated(options: { budgetId: number; sendToCustomer?: boolean; sendToAdmin?: boolean; localeOverride?: string | null }) {
    await this.sendSalesDocumentStatusEmail({
      documentType: 'BUDGET',
      orderId: options.budgetId,
      previousStatusId: null,
      nextStatusId: null,
      sendToCustomer: options.sendToCustomer,
      sendToAdmin: options.sendToAdmin,
      localeOverride: options.localeOverride,
      eventOverride: 'budget.created',
    })
  }

  private async sendSalesDocumentStatusEmail(options: SalesDocumentStatusEmailOptions) {
    if (!(await this.settings.isEnabled(EmailCategory.ORDERS))) {
      this.logger.debug('Order emails disabled; skipping status change send.')
      return
    }
    const order = await this.prisma.order.findUnique({
      where: { id: options.orderId },
      include: {
        customer: true,
        items: true,
      },
    })
    if (!order) {
      this.logger.warn(`Sales document ${options.orderId} not found; cannot send status email.`)
      return
    }
    const documentType = (order.documentType ?? 'ORDER') as OrderEmailContext['documentType']
    if (documentType !== options.documentType) {
      this.logger.debug(
        `Skipping status email for document ${order.id} because expected ${options.documentType} but was ${documentType}.`,
      )
      return
    }
    const locale = this.resolveLocale(options.localeOverride)
    const company = await this.getCompanyContext()
    const nextStatusId = options.nextStatusId ?? order.statusId ?? null
    const previousStatusId = options.previousStatusId ?? null
    const nextStatus = nextStatusId ? findOrderStatusById(nextStatusId) : null
    const previousStatus = previousStatusId ? findOrderStatusById(previousStatusId) : null
    const eventKey = options.eventOverride ?? this.resolveStatusEventKey(documentType, nextStatus?.code ?? null)
    const overrides: Partial<OrderEmailContext> = {
      event: eventKey,
      status: this.resolveStatusLabel(nextStatus, locale),
      statusCode: nextStatus?.code ?? null,
      previousStatus: this.resolveStatusLabel(previousStatus, locale),
      previousStatusCode: previousStatus?.code ?? null,
    }
    const payload = this.buildOrderPayload(order, locale, overrides)
    const extras = { ...company }

    if (options.sendToCustomer !== false) {
      const customerEmail = payload.customer.email
      if (customerEmail) {
        const recipients: EmailRecipient[] = [
          {
            email: customerEmail,
            name: payload.customer.name,
            locale,
          },
        ]
        const message = await this.buildMessage<OrderEmailContext>({
          category: EmailCategory.ORDERS,
          variant: EmailTemplateVariant.CUSTOMER,
          locale,
          recipientType: EmailRecipientType.CUSTOMER,
          recipients,
          payload,
          extras,
        })
        await this.queue.enqueue(message)
      } else {
        this.logger.debug(`Sales document ${order.id} has no customer email; skipping customer status email.`)
      }
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
          payload,
          extras,
          cc: recipientsConfig.cc,
          bcc: recipientsConfig.bcc,
        })
        await this.queue.enqueue(message)
      } else {
        this.logger.debug(`No admin recipients configured for ${documentType.toLowerCase()} status emails.`)
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
    const event = options.event ?? 'reset_link'
    if (event === 'reset_link' && (!options.resetUrl || !options.expiresAt)) {
      this.logger.warn('Password reset email skipped because required reset link parameters are missing.')
      return
    }
    const expiresAt = options.expiresAt ? this.formatDate(options.expiresAt, locale) : null
    const resetUrl = options.resetUrl ?? options.supportUrl ?? null
    const payload: PasswordResetEmailContext = {
      event,
      resetUrl,
      supportUrl: options.supportUrl ?? null,
      expiresAt,
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
    const samplePayload = this.buildSamplePayload(options.category, locale, options.scenarioKey)
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

  private buildDeliveryEstimateLabel(
    minHours: number | null | undefined,
    maxHours: number | null | undefined,
    locale: string,
  ): string | null {
    const isSpanish = locale.toLowerCase().startsWith('es')
    const normalizedMin = typeof minHours === 'number' && Number.isFinite(minHours) ? Math.trunc(minHours) : null
    const normalizedMax = typeof maxHours === 'number' && Number.isFinite(maxHours) ? Math.trunc(maxHours) : null
    const formatDays = (value: number) => {
      const unit = isSpanish ? (value === 1 ? 'día' : 'días') : value === 1 ? 'day' : 'days'
      return `${value} ${unit}`
    }
    if (normalizedMin === null && normalizedMax === null) {
      return null
    }
    if (normalizedMin !== null && normalizedMax !== null) {
      if (normalizedMin === normalizedMax) {
        return isSpanish ? `Dentro de ${formatDays(normalizedMin)}` : `Within ${formatDays(normalizedMin)}`
      }
      return isSpanish
        ? `Entre ${formatDays(normalizedMin)} y ${formatDays(normalizedMax)}`
        : `Between ${formatDays(normalizedMin)} and ${formatDays(normalizedMax)}`
    }
    if (normalizedMin !== null) {
      return isSpanish ? `Desde ${formatDays(normalizedMin)}` : `From ${formatDays(normalizedMin)}`
    }
    if (normalizedMax !== null) {
      return isSpanish ? `Hasta ${formatDays(normalizedMax)}` : `Up to ${formatDays(normalizedMax)}`
    }
    return null
  }

  private buildAddressPayload(params: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    zip?: string | null
    country?: string | null
  }): OrderEmailAddress | null {
    const sanitize = (value?: string | null) => {
      if (typeof value !== 'string') {
        return null
      }
      const trimmed = value.trim()
      return trimmed.length ? trimmed : null
    }
    const line1 = sanitize(params.line1)
    const line2 = sanitize(params.line2)
    const city = sanitize(params.city)
    const state = sanitize(params.state)
    const zip = sanitize(params.zip)
    const country = sanitize(params.country)
    const lines: string[] = []
    const firstLineParts = [line1, line2].filter((segment): segment is string => Boolean(segment))
    const firstLine = firstLineParts.join(' ').trim()
    if (firstLine) {
      lines.push(firstLine)
    }
    const cityStateParts = [city, state].filter((segment): segment is string => Boolean(segment))
    const cityState = cityStateParts.join(', ').trim()
    const locationLineParts = [cityState || null, zip].filter((segment): segment is string => Boolean(segment))
    const locationLine = locationLineParts.join(' ').trim()
    if (locationLine) {
      lines.push(locationLine)
    }
    if (country) {
      lines.push(country)
    }
    if (!lines.length) {
      return null
    }
    return {
      line1,
      line2,
      city,
      state,
      zip,
      country,
      lines,
    }
  }

  private buildOrderPayload(
    order: Prisma.OrderGetPayload<{
      include: {
        customer: true
        items: true
      }
    }>,
    locale: string,
    overrides: Partial<OrderEmailContext> = {},
  ): OrderEmailContext {
    const items = order.items.map((item) => {
      const qty = Number(item.qty ?? 0)
      const price = new Prisma.Decimal(item.price ?? 0)
      const subtotal = price.times(qty)
      return {
        name: item.name,
        quantity: qty,
        unitPrice: this.formatAmount(item.price ?? 0, locale),
        unitPriceRaw: Number(price.toFixed(2)),
        subtotal: this.formatAmount(subtotal, locale),
        subtotalRaw: Number(subtotal.toFixed(2)),
        description: item.description ?? null,
      }
    })
    const subtotalDecimal = new Prisma.Decimal(order.subTotal ?? 0)
    const taxDecimal = order.tax ? new Prisma.Decimal(order.tax) : null
    const grandTotalDecimal = new Prisma.Decimal(order.grandTotal ?? 0)
    const totals = {
      subtotal: this.formatAmount(order.subTotal ?? 0, locale),
      subtotalRaw: Number(subtotalDecimal.toFixed(2)),
      tax: order.tax ? this.formatAmount(order.tax, locale) : null,
      taxRaw: taxDecimal ? Number(taxDecimal.toFixed(2)) : null,
      grandTotal: this.formatAmount(order.grandTotal ?? 0, locale),
      grandTotalRaw: Number(grandTotalDecimal.toFixed(2)),
      currency: order.orderCurrency ?? 'USD',
    }
    const customer = order.customer
    const statusDefinition = findOrderStatusById(order.statusId ?? null)
    const documentType = (order.documentType ?? 'ORDER') as OrderEmailContext['documentType']
    const paymentMethod = order.paymentMethodId
      ? findPaymentMethodById(order.paymentMethodId)?.label ?? null
      : null
    const links = this.buildDocumentLinks(order, documentType)
    const shippingVendor =
      typeof order.shippingVendor === 'string' && order.shippingVendor.trim().length
        ? order.shippingVendor.trim()
        : null
    const shippingAddress = this.buildAddressPayload({
      line1: order.shippingAddress1,
      line2: order.shippingAddress2,
      city: order.shippingCity,
      state: order.shippingState,
      zip: order.shippingZip,
      country: null,
    })
    const billingAddress = this.buildAddressPayload({
      line1: order.billingAddress1,
      line2: order.billingAddress2,
      city: order.billingCity,
      state: order.billingState,
      zip: order.billingZip,
      country: null,
    })
    const hasMinEstimate = order.estimatedMin !== null && order.estimatedMin !== undefined
    const hasMaxEstimate = order.estimatedMax !== null && order.estimatedMax !== undefined
    const deliveryEstimate = hasMinEstimate || hasMaxEstimate
      ? {
          minHours: hasMinEstimate ? order.estimatedMin ?? null : null,
          maxHours: hasMaxEstimate ? order.estimatedMax ?? null : null,
        }
      : null
    const deliveryEstimateLabel = this.buildDeliveryEstimateLabel(
      hasMinEstimate ? order.estimatedMin ?? null : null,
      hasMaxEstimate ? order.estimatedMax ?? null : null,
      locale,
    )
    const payload: OrderEmailContext = {
      orderId: order.id,
      orderNumber: order.uuid || String(order.id),
      documentType: documentType,
      event: 'order.update',
      orderDate: this.formatDate(order.date, locale),
      status: this.resolveStatusLabel(statusDefinition, locale),
      statusCode: statusDefinition?.code ?? null,
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
      adminUrl: this.config.get<string>('ADMIN_PORTAL_URL') ?? null,
      links,
      validUntil: order.validUntil ? this.formatDate(order.validUntil, locale) : null,
      paymentMethod,
      deliveryEstimate,
      deliveryEstimateLabel,
      shippingVendor,
      shippingAddress,
      billingAddress,
      notes: order.comment ?? null,
      locale,
    }
    let mergedLinks: OrderEmailContext['links'] = payload.links ?? null
    if (overrides.links !== undefined) {
      mergedLinks = overrides.links === null ? null : { ...(payload.links ?? {}), ...overrides.links }
    }
    const result: OrderEmailContext = {
      ...payload,
      ...overrides,
      links: mergedLinks,
    }
    const hasDeliveryEstimateOverride = Object.prototype.hasOwnProperty.call(overrides, 'deliveryEstimate')
    const hasDeliveryLabelOverride = Object.prototype.hasOwnProperty.call(overrides, 'deliveryEstimateLabel')
    if ((hasDeliveryEstimateOverride && !hasDeliveryLabelOverride) || result.deliveryEstimateLabel === undefined) {
      result.deliveryEstimateLabel = this.buildDeliveryEstimateLabel(
        result.deliveryEstimate?.minHours ?? null,
        result.deliveryEstimate?.maxHours ?? null,
        locale,
      )
    }
    return result
  }

  private buildPaymentPayload(
    payment: Prisma.PaymentGetPayload<{
      include: {
        order: { include: { customer: true } }
      }
    }>,
    locale: string,
  ): PaymentEmailContext {
    const order = payment.order
    const customer = order.customer
    const paymentMethod = findPaymentMethodById(payment.paymentMethodId ?? null)
    return {
      paymentId: payment.id,
      orderId: order.id,
      orderNumber: order.uuid || String(order.id),
      amount: this.formatAmount(payment.amount, locale),
      currency: payment.currency,
      method: payment.method || paymentMethod?.label || null,
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
    const replyToOverride = this.config.get<string>('EMAIL_REPLY_TO') ?? null
    const listUnsubscribeHeader = this.config.get<string>('EMAIL_LIST_UNSUBSCRIBE') ?? null
    const headers: Record<string, string> | undefined = listUnsubscribeHeader
      ? { 'List-Unsubscribe': listUnsubscribeHeader }
      : undefined
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
      replyTo: replyToOverride ?? fromSettings.fromAddress,
      headers,
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

  private buildSamplePayload(category: EmailCategory, locale: string, scenarioKey?: string) {
    switch (category) {
      case EmailCategory.ORDERS:
        if (scenarioKey && scenarioKey.startsWith('budget.')) {
          return this.buildBudgetSample(locale, scenarioKey)
        }
        return this.buildOrderSample(locale, scenarioKey)
      case EmailCategory.PAYMENTS:
        return this.buildPaymentSample(locale)
      case EmailCategory.AUTH:
      default:
        return this.buildPasswordSample(locale, scenarioKey)
    }
  }

  private buildOrderSample(locale: string, scenarioKey?: string): OrderEmailContext {
    const isSpanish = locale.toLowerCase().startsWith('es')
    const format = (value: number) => this.formatAmount(value, locale)
    const baseDate = new Date()
    const deliveryEstimateBase = { minHours: 24, maxHours: 72 }
    const shippingAddress = this.buildAddressPayload({
      line1: isSpanish ? 'Av. Siempre Viva 742' : '742 Evergreen Street',
      line2: isSpanish ? 'Apto. 12B' : 'Suite 12B',
      city: isSpanish ? 'Montevideo' : 'Springfield',
      state: isSpanish ? 'Montevideo' : 'IL',
      zip: isSpanish ? '11800' : '62704',
      country: isSpanish ? 'Uruguay' : 'USA',
    })
    const billingAddress = this.buildAddressPayload({
      line1: isSpanish ? '18 de Julio 1234' : '123 Market Street',
      line2: isSpanish ? 'Oficina 301' : 'Floor 3, Office 301',
      city: isSpanish ? 'Montevideo' : 'Springfield',
      state: isSpanish ? 'Montevideo' : 'IL',
      zip: isSpanish ? '11300' : '62701',
      country: isSpanish ? 'Uruguay' : 'USA',
    })
    const base: OrderEmailContext = {
      orderId: 1001,
      orderNumber: 'ORD-1001',
      documentType: 'ORDER',
      event: 'order.received',
      orderDate: this.formatDate(baseDate, locale),
      status: isSpanish ? 'Pendiente' : 'Pending',
      statusCode: 'pending',
      previousStatus: null,
      previousStatusCode: null,
      customer: { id: 1, name: 'Sample Customer', email: 'customer@example.com', locale },
      items: [
        {
          name: isSpanish ? 'Caja de regalo premium' : 'Premium Gift Box',
          quantity: 2,
          unitPrice: format(59.9),
          unitPriceRaw: 59.9,
          subtotal: format(119.8),
          subtotalRaw: 119.8,
          description: isSpanish ? 'Incluye tarjeta personalizada.' : 'Includes custom card.',
        },
        {
          name: isSpanish ? 'Tarjeta de felicitación' : 'Greeting Card',
          quantity: 1,
          unitPrice: format(39.5),
          unitPriceRaw: 39.5,
          subtotal: format(39.5),
          subtotalRaw: 39.5,
          description: null,
        },
      ],
      totals: {
        subtotal: format(159.3),
        subtotalRaw: 159.3,
        tax: format(28.68),
        taxRaw: 28.68,
        grandTotal: format(187.98),
        grandTotalRaw: 187.98,
        currency: 'USD',
      },
      paymentUrl: null,
      portalUrl: this.config.get<string>('CUSTOMER_PORTAL_URL') ?? null,
      links: {
        customer: 'https://example.com/orders/ORD-1001',
        admin: 'https://admin.example.com/orders/1001',
        payment: null,
      },
      adminUrl: this.config.get<string>('ADMIN_PORTAL_URL') ?? 'https://admin.example.com/orders/1001',
      validUntil: this.formatDate(new Date(baseDate.getTime() + 7 * 24 * 60 * 60 * 1000), locale),
      paymentMethod: 'Mercado Pago',
      deliveryEstimate: deliveryEstimateBase,
      deliveryEstimateLabel: this.buildDeliveryEstimateLabel(
        deliveryEstimateBase.minHours,
        deliveryEstimateBase.maxHours,
        locale,
      ),
      shippingVendor: isSpanish ? 'Envío Express' : 'Express Courier',
      shippingAddress,
      billingAddress,
      notes: isSpanish ? 'El cliente solicitó envoltura para regalo.' : 'Customer requested gift wrap.',
      locale,
    }

    switch (scenarioKey) {
      case 'order.paid':
        return {
          ...base,
          event: 'order.status.paid',
          status: isSpanish ? 'Pagado' : 'Paid',
          statusCode: 'paid',
          previousStatus: isSpanish ? 'Pendiente' : 'Pending',
          previousStatusCode: 'pending',
          paymentMethod: 'Mercado Pago',
          deliveryEstimate: { minHours: 12, maxHours: 48 },
          deliveryEstimateLabel: this.buildDeliveryEstimateLabel(12, 48, locale),
        }
      case 'order.delivered':
        return {
          ...base,
          event: 'order.status.delivered',
          status: isSpanish ? 'Entregado' : 'Delivered',
          statusCode: 'delivered',
          deliveryEstimate: null,
          deliveryEstimateLabel: null,
          notes: isSpanish ? 'Pedido entregado y firmado por el cliente.' : 'Order delivered and signed by customer.',
        }
      case 'order.cancelled':
        return {
          ...base,
          event: 'order.status.cancelled',
          status: isSpanish ? 'Cancelado' : 'Cancelled',
          statusCode: 'cancelled',
          previousStatus: isSpanish ? 'Pendiente' : 'Pending',
          previousStatusCode: 'pending',
          paymentMethod: null,
          deliveryEstimate: null,
          deliveryEstimateLabel: null,
          notes: isSpanish
            ? 'El cliente canceló por pedido duplicado.'
            : 'Customer cancelled due to duplicate order.',
        }
      case 'order.cash':
        return {
          ...base,
          paymentMethod: isSpanish ? 'Efectivo' : 'Cash',
          notes: isSpanish
            ? 'Pago en efectivo contra entrega.'
            : 'Cash on delivery requested by the customer.',
        }
      case 'order.large': {
        const largeItems = [
          {
            name: isSpanish ? 'Estación de trabajo profesional' : 'Professional Workstation',
            quantity: 1,
            unitPriceRaw: 1299.99,
            unitPrice: format(1299.99),
            subtotalRaw: 1299.99,
            subtotal: format(1299.99),
            description: '32GB RAM · 1TB SSD',
          },
          {
            name: isSpanish ? 'Servicio de calibración' : 'Calibration Service',
            quantity: 1,
            unitPriceRaw: 120,
            unitPrice: format(120),
            subtotalRaw: 120,
            subtotal: format(120),
            description: null,
          },
          {
            name: isSpanish ? 'Instalación en sitio' : 'On-site Installation',
            quantity: 1,
            unitPriceRaw: 180,
            unitPrice: format(180),
            subtotalRaw: 180,
            subtotal: format(180),
            description: null,
          },
        ]
        const subtotalRaw = 1299.99 + 120 + 180
        const taxRaw = subtotalRaw * 0.22
        const grandTotalRaw = subtotalRaw + taxRaw
        return {
          ...base,
          items: largeItems,
          totals: {
            subtotal: format(subtotalRaw),
            subtotalRaw,
            tax: format(taxRaw),
            taxRaw,
            grandTotal: format(grandTotalRaw),
            grandTotalRaw,
            currency: 'USD',
          },
          deliveryEstimate: { minHours: 72, maxHours: 168 },
          deliveryEstimateLabel: this.buildDeliveryEstimateLabel(72, 168, locale),
          notes: isSpanish
            ? 'Incluye configuración profesional y visita técnica.'
            : 'Includes professional setup and on-site technician visit.',
        }
      }
      default:
        return base
    }
  }

  private buildBudgetSample(locale: string, scenarioKey?: string): OrderEmailContext {
    const isSpanish = locale.toLowerCase().startsWith('es')
    const format = (value: number) => this.formatAmount(value, locale)
    const now = new Date()
    const validUntil = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
    const base: OrderEmailContext = {
      orderId: 5001,
      orderNumber: 'BUD-2024-001',
      documentType: 'BUDGET',
      event: 'budget.status.sent',
      orderDate: this.formatDate(now, locale),
      status: isSpanish ? 'Presupuesto - Enviado' : 'Quote - Sent',
      statusCode: 'budget_sent',
      previousStatus: null,
      previousStatusCode: null,
      customer: { id: 2, name: 'Acme Industries', email: 'purchasing@acme.test', locale },
      items: [
        {
          name: isSpanish ? 'Plan de servicio anual' : 'Annual Service Plan',
          quantity: 1,
          unitPriceRaw: 450,
          unitPrice: format(450),
          subtotalRaw: 450,
          subtotal: format(450),
          description: isSpanish ? 'Cobertura 24/7 y visitas trimestrales.' : '24/7 coverage with quarterly visits.',
        },
        {
          name: isSpanish ? 'Capacitación inicial' : 'Onboarding Training',
          quantity: 1,
          unitPriceRaw: 120,
          unitPrice: format(120),
          subtotalRaw: 120,
          subtotal: format(120),
          description: null,
        },
      ],
      totals: {
        subtotal: format(570),
        subtotalRaw: 570,
        tax: format(119.7),
        taxRaw: 119.7,
        grandTotal: format(689.7),
        grandTotalRaw: 689.7,
        currency: 'USD',
      },
      paymentUrl: null,
      portalUrl: this.config.get<string>('CUSTOMER_PORTAL_URL') ?? null,
      links: {
        customer: 'https://example.com/budgets/BUD-2024-001',
        admin: 'https://admin.example.com/budgets/5001',
        payment: null,
      },
      adminUrl: this.config.get<string>('ADMIN_PORTAL_URL') ?? 'https://admin.example.com/budgets/5001',
      validUntil: this.formatDate(validUntil, locale),
      paymentMethod: null,
      deliveryEstimate: null,
      notes: isSpanish ? 'Incluye instalación opcional sin costo.' : 'Includes optional installation at no additional cost.',
      locale,
    }

    switch (scenarioKey) {
      case 'budget.created':
        return {
          ...base,
          event: 'budget.created',
          status: isSpanish ? 'Presupuesto - Borrador' : 'Quote - Draft',
          statusCode: 'budget_draft',
        }
      case 'budget.accepted':
        return {
          ...base,
          event: 'budget.status.accepted',
          status: isSpanish ? 'Presupuesto - Aceptado' : 'Quote - Accepted',
          statusCode: 'budget_accepted',
          previousStatus: isSpanish ? 'Presupuesto - Enviado' : 'Quote - Sent',
          previousStatusCode: 'budget_sent',
          notes: isSpanish ? 'Aprobado por el cliente. Pendiente de firma.' : 'Approved by customer. Awaiting signature.',
        }
      case 'budget.converted':
        return {
          ...base,
          event: 'budget.status.converted',
          status: isSpanish ? 'Presupuesto - Convertido' : 'Quote - Converted',
          statusCode: 'budget_converted',
          previousStatus: isSpanish ? 'Presupuesto - Aceptado' : 'Quote - Accepted',
          previousStatusCode: 'budget_accepted',
        }
      case 'budget.expired': {
        const pastDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
        return {
          ...base,
          event: 'budget.status.expired',
          status: isSpanish ? 'Presupuesto - Expirado' : 'Quote - Expired',
          statusCode: 'budget_expired',
          validUntil: this.formatDate(pastDate, locale),
          notes: isSpanish ? 'El presupuesto venció y requiere actualización.' : 'Quote expired and needs review.',
        }
      }
      case 'budget.cancelled':
        return {
          ...base,
          event: 'budget.status.cancelled',
          status: isSpanish ? 'Presupuesto - Cancelado' : 'Quote - Cancelled',
          statusCode: 'budget_cancelled',
          previousStatus: isSpanish ? 'Presupuesto - Enviado' : 'Quote - Sent',
          previousStatusCode: 'budget_sent',
          notes: isSpanish ? 'Cancelado por solicitud del cliente.' : 'Cancelled at customer request.',
        }
      case 'budget.sent':
      default:
        return base
    }
  }

  private buildPaymentSample(locale: string): PaymentEmailContext {
    return {
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
  }

  private buildPasswordSample(locale: string, scenarioKey?: string): PasswordResetEmailContext {
    const expires = new Date()
    expires.setHours(expires.getHours() + 2)
    const base: PasswordResetEmailContext = {
      event: 'reset_link',
      resetUrl: 'https://example.com/reset?token=demo',
      expiresAt: this.formatDate(expires, locale),
      displayName: locale.toLowerCase().startsWith('es') ? 'Usuario de ejemplo' : 'Sample User',
      locale,
      isAdmin: false,
    }

    switch (scenarioKey) {
      case 'auth.changed':
        return {
          ...base,
          event: 'password_changed',
          resetUrl: 'https://example.com/account/security',
          expiresAt: null,
        }
      case 'auth.recovery':
        return {
          ...base,
          event: 'recovery_notice',
          resetUrl: 'https://example.com/account/security',
          expiresAt: null,
        }
      default:
        return base
    }
  }

  async buildPreviewPayload(
    category: EmailCategory,
    variant: EmailTemplateVariant,
    locale: string,
    scenarioKey?: string,
  ) {
    let payload = this.buildSamplePayload(category, locale, scenarioKey)
    if (
      category === EmailCategory.ORDERS &&
      variant === EmailTemplateVariant.ADMIN &&
      isOrderEmailContext(payload) &&
      payload.documentType === 'ORDER' &&
      payload.event === 'order.received'
    ) {
      const updatedPayload: OrderEmailContext = {
        ...payload,
        event: 'order.received_admin',
      }
      payload = updatedPayload
    }
    const extras = await this.getCompanyContext()
    return { payload, extras, variant }
  }

  getSampleScenarioOptions(category: EmailCategory, variant: EmailTemplateVariant, locale: string) {
    const isSpanish = locale.toLowerCase().startsWith('es')
    const t = (en: string, es: string) => (isSpanish ? es : en)
    if (category === EmailCategory.ORDERS) {
      const receivedLabel =
        variant === EmailTemplateVariant.ADMIN
          ? t('Order received (staff copy)', 'Pedido recibido (equipo)')
          : t('Order received (basic)', 'Pedido recibido (básico)')
      const scenarios = [
        { key: 'order.received', label: receivedLabel },
        { key: 'order.paid', label: t('Order paid', 'Pedido pagado') },
        { key: 'order.delivered', label: t('Order delivered', 'Pedido entregado') },
        { key: 'order.cancelled', label: t('Order cancelled', 'Pedido cancelado') },
        { key: 'order.cash', label: t('Cash on delivery', 'Pago en efectivo') },
        { key: 'order.large', label: t('Large order with services', 'Pedido grande con servicios') },
        { key: 'budget.created', label: t('Budget draft', 'Presupuesto borrador') },
        { key: 'budget.sent', label: t('Budget sent to customer', 'Presupuesto enviado al cliente') },
        { key: 'budget.accepted', label: t('Budget accepted', 'Presupuesto aceptado') },
        { key: 'budget.converted', label: t('Budget converted to order', 'Presupuesto convertido en pedido') },
        { key: 'budget.expired', label: t('Budget expired', 'Presupuesto expirado') },
        { key: 'budget.cancelled', label: t('Budget cancelled', 'Presupuesto cancelado') },
      ]
      return scenarios
    }
    if (category === EmailCategory.PAYMENTS) {
      return [{ key: 'payment.default', label: t('Payment confirmed', 'Pago confirmado') }]
    }
    return [
      { key: 'auth.reset', label: t('Password reset', 'Restablecer contraseña') },
      { key: 'auth.changed', label: t('Password changed', 'Contraseña actualizada') },
      { key: 'auth.recovery', label: t('Recovery alert', 'Aviso de recuperación') },
    ]
  }

  private resolveStatusLabel(definition: ReturnType<typeof findOrderStatusById>, locale: string) {
    if (!definition) {
      return null
    }
    const normalized = (locale || '').split(/[-_]/)[0]?.toLowerCase() || 'en'
    if (definition.translations && definition.translations[normalized]) {
      return definition.translations[normalized]
    }
    return definition.label
  }

  private buildDocumentLinks(
    order: Prisma.OrderGetPayload<{ include: { customer: true; items: true } }>,
    documentType: OrderEmailContext['documentType'],
  ): OrderEmailContext['links'] {
    const customerBase = this.config.get<string>('CUSTOMER_PORTAL_URL') ?? null
    const adminBase = this.config.get<string>('ADMIN_PORTAL_URL') ?? null
    const identifier = order.uuid || String(order.id)
    const customerPath = documentType === 'BUDGET' ? `/budgets/${identifier}` : `/orders/${identifier}`
    const adminPath = documentType === 'BUDGET' ? `/admin/budgets/${order.id}` : `/admin/orders/${order.id}`
    return {
      customer: this.joinUrl(customerBase, customerPath),
      admin: this.joinUrl(adminBase, adminPath),
      payment: null,
    }
  }

  private joinUrl(base: string | null, path: string) {
    if (!base) {
      return null
    }
    const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base
    const normalizedPath = path.startsWith('/') ? path : `/${path}`
    return `${trimmedBase}${normalizedPath}`
  }

  private resolveStatusEventKey(documentType: OrderEmailContext['documentType'], statusCode: string | null) {
    if (documentType === 'BUDGET') {
      switch (statusCode) {
        case 'budget_sent':
          return 'budget.status.sent'
        case 'budget_accepted':
          return 'budget.status.accepted'
        case 'budget_converted':
          return 'budget.status.converted'
        case 'budget_expired':
          return 'budget.status.expired'
        case 'budget_cancelled':
          return 'budget.status.cancelled'
        default:
          return 'budget.status.updated'
      }
    }
    switch (statusCode) {
      case 'paid':
        return 'order.status.paid'
      case 'delivered':
        return 'order.status.delivered'
      case 'cancelled':
        return 'order.status.cancelled'
      case 'pending':
        return 'order.status.pending'
      default:
        return 'order.status.updated'
    }
  }
}

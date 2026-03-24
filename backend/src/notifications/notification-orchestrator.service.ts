import { Injectable, Logger } from '@nestjs/common'
import {
  NotificationAudience,
  NotificationChannel,
  NotificationEventType,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationsService } from './notifications.service'
import { NotificationSettingsService } from './notification-settings.service'
import { EmailService } from '../email/email.service'
import { CreateNotificationInput } from './notifications.types'
import { findOrderStatusById } from '../common/constants/order-statuses'
import { findPaymentMethodById } from '../common/constants/payment-methods'

type NotificationEntityType = 'order' | 'payment' | 'customer' | 'quote'

@Injectable()
export class NotificationOrchestratorService {
  private readonly logger = new Logger(NotificationOrchestratorService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly settings: NotificationSettingsService,
    private readonly email: EmailService,
  ) {}

  async notifyOrderReceived(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        payments: {
          select: {
            amount: true,
            currency: true,
            status: true,
          },
        },
      },
    })
    if (!order) {
      this.logger.warn(`Order ${orderId} not found for notification`)
      return
    }
    const metadataBase = this.buildOrderMetadata(order)
    await this.dispatchCustomerOrderReceived(order, metadataBase)
    await this.dispatchAdminOrderReceived(order, metadataBase)
  }

  async notifyPaymentReceived(paymentId: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
      },
    })
    if (!payment || !payment.order) {
      this.logger.warn(`Payment ${paymentId} not found for notification`)
      return
    }
    const metadata = this.buildPaymentMetadata(payment)
    await this.dispatchCustomerPaymentReceived(payment, metadata)
    await this.dispatchAdminPaymentReceived(payment, metadata)
  }

  async notifyOrderStatusChanged(orderId: number, previousStatusId: number | null, nextStatusId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
      },
    })
    if (!order) {
      this.logger.warn(`Order ${orderId} not found for status change notification`)
      return
    }
    const previousStatus = previousStatusId ? findOrderStatusById(previousStatusId) : null
    const nextStatus = findOrderStatusById(nextStatusId)
    const currentStatus = findOrderStatusById(order.statusId ?? null)

    const metadata = {
      ...this.buildOrderMetadata(order),
      previousStatusCode: previousStatus?.id ?? null,
      previousStatus: previousStatus?.label ?? null,
      statusCode: nextStatus?.id ?? currentStatus?.id ?? null,
      status: nextStatus?.label ?? currentStatus?.label ?? null,
    }
    await this.dispatchCustomerOrderStatusChange(order, metadata)
    await this.dispatchAdminOrderStatusChange(order, metadata)
  }

  private async dispatchCustomerOrderReceived(order: any, metadataBase: Record<string, unknown>) {
    const channels = await this.settings.resolveAudienceChannels(
      NotificationEventType.ORDER_RECEIVED,
      NotificationAudience.CUSTOMER,
    )
    const customerLocale = this.getCustomerLocale(order.customer)
    const notifications: CreateNotificationInput[] = []
    if (channels[NotificationChannel.IN_APP]?.enabled && order.customerId) {
      const metadata = this.buildNotificationMetadata(
        'order',
        order.id,
        NotificationAudience.CUSTOMER,
        metadataBase,
      )
      const message = this.translateCustomerOrderReceived(customerLocale, metadata)
      notifications.push({
        eventType: NotificationEventType.ORDER_RECEIVED,
        audience: NotificationAudience.CUSTOMER,
        channel: NotificationChannel.IN_APP,
        customerId: order.customerId,
        orderId: order.id,
        title: message.title,
        body: message.body,
        metadata,
      })
    }
    if (notifications.length) {
      await this.notifications.createNotifications(notifications)
    }

    const emailSetting = channels[NotificationChannel.EMAIL]
    if (emailSetting?.enabled) {
      await this.email.sendOrderReceived({
        orderId: order.id,
        localeOverride: customerLocale,
        sendToCustomer: true,
        sendToAdmin: false,
      })
    }
  }

  private async dispatchAdminOrderReceived(order: any, metadataBase: Record<string, unknown>) {
    const channels = await this.settings.resolveAudienceChannels(
      NotificationEventType.ORDER_RECEIVED,
      NotificationAudience.ADMIN,
    )
    const recipients = await this.settings.resolveAdminRecipients(NotificationEventType.ORDER_RECEIVED)
    const adminLocale: 'en' | 'es' = 'es'
    const notifications: CreateNotificationInput[] = []
    if (channels[NotificationChannel.IN_APP]?.enabled && recipients.length) {
      const metadata = this.buildNotificationMetadata(
        'order',
        order.id,
        NotificationAudience.ADMIN,
        metadataBase,
      )
      for (const recipient of recipients) {
        const message = this.translateAdminOrderReceived(adminLocale, metadata)
        notifications.push({
          eventType: NotificationEventType.ORDER_RECEIVED,
          audience: NotificationAudience.ADMIN,
          channel: NotificationChannel.IN_APP,
          recipientId: recipient.id,
          orderId: order.id,
          title: message.title,
          body: message.body,
          metadata,
        })
      }
      await this.notifications.createNotifications(notifications)
    }

    const emailSetting = channels[NotificationChannel.EMAIL]
    if (emailSetting?.enabled) {
      await this.email.sendOrderReceived({
        orderId: order.id,
        localeOverride: adminLocale,
        sendToCustomer: false,
        sendToAdmin: true,
      })
    }
  }

  private async dispatchCustomerPaymentReceived(payment: any, metadataBase: Record<string, unknown>) {
    const channels = await this.settings.resolveAudienceChannels(
      NotificationEventType.PAYMENT_RECEIVED,
      NotificationAudience.CUSTOMER,
    )
    const notifications: CreateNotificationInput[] = []
    if (channels[NotificationChannel.IN_APP]?.enabled && payment.order?.customerId) {
      const metadata = this.buildNotificationMetadata(
        'payment',
        payment.id,
        NotificationAudience.CUSTOMER,
        metadataBase,
      )
      const locale = this.getCustomerLocale(payment.order?.customer)
      const message = this.translateCustomerPaymentReceived(locale, metadata)
      notifications.push({
        eventType: NotificationEventType.PAYMENT_RECEIVED,
        audience: NotificationAudience.CUSTOMER,
        channel: NotificationChannel.IN_APP,
        customerId: payment.order.customerId,
        orderId: payment.orderId,
        paymentId: payment.id,
        title: message.title,
        body: message.body,
        metadata,
      })
      await this.notifications.createNotifications(notifications)
    }

    const emailSetting = channels[NotificationChannel.EMAIL]
    if (emailSetting?.enabled) {
      await this.email.sendPaymentReceived({
        paymentId: payment.id,
        sendToCustomer: true,
        sendToAdmin: false,
      })
    }
  }

  private async dispatchAdminPaymentReceived(payment: any, metadataBase: Record<string, unknown>) {
    const channels = await this.settings.resolveAudienceChannels(
      NotificationEventType.PAYMENT_RECEIVED,
      NotificationAudience.ADMIN,
    )
    const recipients = await this.settings.resolveAdminRecipients(NotificationEventType.PAYMENT_RECEIVED)
    const notifications: CreateNotificationInput[] = []
    if (channels[NotificationChannel.IN_APP]?.enabled && recipients.length) {
      const metadata = this.buildNotificationMetadata(
        'payment',
        payment.id,
        NotificationAudience.ADMIN,
        metadataBase,
      )
      for (const recipient of recipients) {
        const locale = this.getUserLocale(recipient)
        const message = this.translateAdminPaymentReceived(locale, metadata)
        notifications.push({
          eventType: NotificationEventType.PAYMENT_RECEIVED,
          audience: NotificationAudience.ADMIN,
          channel: NotificationChannel.IN_APP,
          recipientId: recipient.id,
          orderId: payment.orderId,
          paymentId: payment.id,
          title: message.title,
          body: message.body,
          metadata,
        })
      }
      await this.notifications.createNotifications(notifications)
    }

    const emailSetting = channels[NotificationChannel.EMAIL]
    if (emailSetting?.enabled) {
      await this.email.sendPaymentReceived({
        paymentId: payment.id,
        sendToCustomer: false,
        sendToAdmin: true,
      })
    }
  }

  private async dispatchCustomerOrderStatusChange(order: any, metadataBase: Record<string, unknown>) {
    const channels = await this.settings.resolveAudienceChannels(
      NotificationEventType.ORDER_STATUS_CHANGED,
      NotificationAudience.CUSTOMER,
    )
    const metadata = this.buildNotificationMetadata(
      'order',
      order.id,
      NotificationAudience.CUSTOMER,
      metadataBase,
    )

    if (channels[NotificationChannel.IN_APP]?.enabled && order.customerId) {
      const locale = this.getCustomerLocale(order.customer)
      const message = this.translateCustomerOrderStatus(locale, metadata)
      await this.notifications.createNotifications([
        {
          eventType: NotificationEventType.ORDER_STATUS_CHANGED,
          audience: NotificationAudience.CUSTOMER,
          channel: NotificationChannel.IN_APP,
          customerId: order.customerId,
          orderId: order.id,
          title: message.title,
          body: message.body,
          metadata,
        },
      ])
    }

    const emailSetting = channels[NotificationChannel.EMAIL]
    if (emailSetting?.enabled) {
      await this.email.sendOrderStatusChanged({
        orderId: order.id,
        previousStatusId: (metadata.previousStatusCode as number | null) ?? null,
        nextStatusId: (metadata.statusCode as number | null) ?? null,
        sendToAdmin: false,
      })
    }
  }

  private async dispatchAdminOrderStatusChange(order: any, metadataBase: Record<string, unknown>) {
    const channels = await this.settings.resolveAudienceChannels(
      NotificationEventType.ORDER_STATUS_CHANGED,
      NotificationAudience.ADMIN,
    )
    const recipients = await this.settings.resolveAdminRecipients(NotificationEventType.ORDER_STATUS_CHANGED)
    const metadata = this.buildNotificationMetadata(
      'order',
      order.id,
      NotificationAudience.ADMIN,
      metadataBase,
    )

    if (channels[NotificationChannel.IN_APP]?.enabled && recipients.length) {
      const notifications: CreateNotificationInput[] = recipients.map((recipient) => {
        const locale = this.getUserLocale(recipient)
        const message = this.translateAdminOrderStatus(locale, metadata)
        return {
          eventType: NotificationEventType.ORDER_STATUS_CHANGED,
          audience: NotificationAudience.ADMIN,
          channel: NotificationChannel.IN_APP,
          recipientId: recipient.id,
          orderId: order.id,
          title: message.title,
          body: message.body,
          metadata,
        }
      })
      await this.notifications.createNotifications(notifications)
    }

    const emailSetting = channels[NotificationChannel.EMAIL]
    if (emailSetting?.enabled) {
      await this.email.sendOrderStatusChanged({
        orderId: order.id,
        previousStatusId: (metadata.previousStatusCode as number | null) ?? null,
        nextStatusId: (metadata.statusCode as number | null) ?? null,
        sendToCustomer: false,
        sendToAdmin: true,
      })
    }
  }

  private buildOrderMetadata(order: any) {
    const orderNumber = this.resolveOrderIdentifier(order)
    const amount = order.grandTotal ? Number(order.grandTotal) : null
    const statusDefinition = findOrderStatusById(order.statusId ?? null)
    return {
      orderId: order.id,
      orderUuid: order.uuid ?? null,
      orderNumber,
      amount,
      currency: order.orderCurrency ?? order.currency ?? null,
      customerId: order.customerId,
      customerName:
        order.customer?.name ??
        [order.customer?.firstName, order.customer?.lastName].filter(Boolean).join(' ').trim() ??
        null,
      status: statusDefinition?.label ?? null,
      statusCode: statusDefinition?.id ?? null,
    }
  }

  private buildPaymentMetadata(payment: any) {
    const orderNumber = this.resolveOrderIdentifier(payment.order ?? { id: payment.orderId, uuid: null })
    const amount = payment.amount ? Number(payment.amount) : null
    const currency = payment.currency ?? payment.order?.orderCurrency ?? null
    const paymentMethod = findPaymentMethodById(payment.paymentMethodId ?? null)
    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      orderUuid: payment.order?.uuid ?? null,
      orderNumber,
      amount,
      currency,
      amountFormatted: amount !== null && currency ? `${amount.toFixed(2)} ${currency}` : amount,
      method: payment.method ?? paymentMethod?.label ?? null,
      customerId: payment.order?.customerId ?? null,
      customerName:
        payment.order?.customer?.name ??
        [payment.order?.customer?.firstName, payment.order?.customer?.lastName].filter(Boolean).join(' ').trim() ??
        null,
    }
  }

  private resolveOrderIdentifier(order: { id?: number | string | null; uuid?: string | null }) {
    if (typeof order?.uuid === 'string' && order.uuid.trim().length > 0) {
      return order.uuid.trim()
    }
    return order?.id ?? ''
  }

  private buildNotificationMetadata(
    type: NotificationEntityType,
    entityId: number | string | null,
    audience: NotificationAudience,
    base: Record<string, unknown>,
  ): Record<string, unknown> {
    const redirectPath = this.resolveRedirectPath(type, entityId, audience, base)
    return {
      ...base,
      type,
      entityId,
      redirectPath,
    }
  }

  private resolveRedirectPath(
    type: NotificationEntityType,
    entityId: number | string | null,
    audience: NotificationAudience,
    base: Record<string, unknown>,
  ): string | null {
    if (!type) {
      return null
    }
    if (audience === NotificationAudience.CUSTOMER) {
      return this.resolveCustomerRedirect(type, entityId, base)
    }
    if (audience === NotificationAudience.ADMIN) {
      return this.resolveAdminRedirect(type, entityId)
    }
    return null
  }

  private resolveCustomerRedirect(
    type: NotificationEntityType,
    entityId: number | string | null,
    base: Record<string, unknown>,
  ): string | null {
    const orderSegment = this.extractOrderPathSegment(base)
    switch (type) {
      case 'order': {
        if (orderSegment) {
          return `/account/orders/${orderSegment}`
        }
        if (this.hasEntityId(entityId)) {
          return `/account/orders/${entityId}`
        }
        return '/account/orders'
      }
      case 'payment': {
        if (orderSegment) {
          const paymentParam = this.hasEntityId(entityId) ? `?payment=${entityId}` : ''
          return `/account/orders/${orderSegment}${paymentParam}`
        }
        if (this.hasEntityId(entityId)) {
          return `/account/payments/${entityId}`
        }
        return '/account/orders'
      }
      default: {
        if (this.hasEntityId(entityId)) {
          return `/account/notifications/${entityId}`
        }
        return '/account/notifications'
      }
    }
  }

  private resolveAdminRedirect(
    type: NotificationEntityType,
    entityId: number | string | null,
  ): string | null {
    switch (type) {
      case 'order':
        if (this.hasEntityId(entityId)) {
          return `/app/sales/order-details/${entityId}`
        }
        return '/app/sales/order-list'
      case 'quote':
        if (this.hasEntityId(entityId)) {
          return `/app/sales/budget-details/${entityId}`
        }
        return '/app/sales/budget-list'
      case 'payment':
        if (this.hasEntityId(entityId)) {
          return `/app/accounting/payments?paymentId=${entityId}`
        }
        return '/app/accounting/payments'
      case 'customer':
        if (this.hasEntityId(entityId)) {
          return `/app/crm/customer-details?id=${entityId}`
        }
        return '/app/crm/customers'
      default:
        if (this.hasEntityId(entityId)) {
          return `/app/notifications/${entityId}`
        }
        return '/app/notifications'
    }
  }

  private getCustomerLocale(customer: unknown): 'en' | 'es' {
    if (customer && typeof customer === 'object' && 'preferredLocale' in (customer as Record<string, unknown>)) {
      const localeValue = (customer as Record<string, unknown>).preferredLocale
      if (typeof localeValue === 'string') {
        return this.normalizeLocale(localeValue)
      }
    }
    return 'es'
  }

  private getUserLocale(user: { lang?: string | null }): 'en' | 'es' {
    if (typeof user.lang === 'string') {
      return this.normalizeLocale(user.lang)
    }
    return 'es'
  }

  private normalizeLocale(value: unknown): 'en' | 'es' {
    const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
    if (normalized.startsWith('en')) {
      return 'en'
    }
    return 'es'
  }

  private formatTemplate(template: string, values: Record<string, unknown>): string {
    return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
      const raw = values[key]
      if (raw === undefined || raw === null) {
        return ''
      }
      return String(raw)
    })
  }

  private interpolate(
    templates: Record<'en' | 'es', { title: string; body: string }>,
    locale: 'en' | 'es',
    values: Record<string, unknown>,
  ): { title: string; body: string } {
    const entry = templates[locale] ?? templates.es
    return {
      title: this.formatTemplate(entry.title, values),
      body: this.formatTemplate(entry.body, values),
    }
  }

  private translateCustomerOrderReceived(
    locale: 'en' | 'es',
    metadata: Record<string, unknown>,
  ): { title: string; body: string } {
    const orderNumber = this.getMetadataString(metadata, 'orderNumber') ?? ''
    const templates = {
      en: {
        title: 'We received your order #{orderNumber}',
        body: 'We are reviewing your order and will notify you of updates.',
      },
      es: {
        title: 'Recibimos tu pedido #{orderNumber}',
        body: 'Estamos revisando tu pedido y te avisaremos de las novedades.',
      },
    }
    return this.interpolate(templates, locale, { orderNumber })
  }

  private translateAdminOrderReceived(
    locale: 'en' | 'es',
    metadata: Record<string, unknown>,
  ): { title: string; body: string } {
    const orderNumber = this.getMetadataString(metadata, 'orderNumber') ?? ''
    const customerName = this.getMetadataString(metadata, 'customerName')
    if (customerName) {
      const templates = {
        en: {
          title: 'New order #{orderNumber}',
          body: '{customerName} placed a new order.',
        },
        es: {
          title: 'Nuevo pedido #{orderNumber}',
          body: '{customerName} realizó un nuevo pedido.',
        },
      }
      return this.interpolate(templates, locale, { orderNumber, customerName })
    }
    const templates = {
      en: {
        title: 'New order #{orderNumber}',
        body: 'A new order was placed.',
      },
      es: {
        title: 'Nuevo pedido #{orderNumber}',
        body: 'Se registró un nuevo pedido.',
      },
    }
    return this.interpolate(templates, locale, { orderNumber })
  }

  private translateCustomerPaymentReceived(
    locale: 'en' | 'es',
    metadata: Record<string, unknown>,
  ): { title: string; body: string } {
    const orderNumber = this.getMetadataString(metadata, 'orderNumber') ?? ''
    const templates = {
      en: {
        title: 'Payment received for order #{orderNumber}',
        body: 'Thank you! Your payment has been confirmed.',
      },
      es: {
        title: 'Pago recibido para el pedido #{orderNumber}',
        body: '¡Gracias! Confirmamos tu pago.',
      },
    }
    return this.interpolate(templates, locale, { orderNumber })
  }

  private translateAdminPaymentReceived(
    locale: 'en' | 'es',
    metadata: Record<string, unknown>,
  ): { title: string; body: string } {
    const orderNumber = this.getMetadataString(metadata, 'orderNumber') ?? ''
    const amount = this.resolveAmountDisplay(metadata)
    if (amount) {
      const templates = {
        en: {
          title: 'Payment confirmed for order #{orderNumber}',
          body: 'Payment of {amount} was confirmed.',
        },
        es: {
          title: 'Pago confirmado para el pedido #{orderNumber}',
          body: 'Se confirmó el pago de {amount}.',
        },
      }
      return this.interpolate(templates, locale, { orderNumber, amount })
    }
    const templates = {
      en: {
        title: 'Payment confirmed for order #{orderNumber}',
        body: 'Payment was confirmed.',
      },
      es: {
        title: 'Pago confirmado para el pedido #{orderNumber}',
        body: 'Se confirmó el pago.',
      },
    }
    return this.interpolate(templates, locale, { orderNumber })
  }

  private translateCustomerOrderStatus(
    locale: 'en' | 'es',
    metadata: Record<string, unknown>,
  ): { title: string; body: string } {
    const orderNumber = this.getMetadataString(metadata, 'orderNumber') ?? ''
    const status = this.resolveLocalizedOrderStatus(locale, metadata)
    if (status) {
      const templates = {
        en: {
          title: 'Your order #{orderNumber} is now {status}',
          body: 'Status changed to {status}.',
        },
        es: {
          title: 'Tu pedido #{orderNumber} ahora está {status}',
          body: 'El estado cambió a {status}.',
        },
      }
      return this.interpolate(templates, locale, { orderNumber, status })
    }
    const templates = {
      en: {
        title: 'Your order #{orderNumber} was updated',
        body: 'Order status updated.',
      },
      es: {
        title: 'Tu pedido #{orderNumber} se actualizó',
        body: 'El estado del pedido se actualizó.',
      },
    }
    return this.interpolate(templates, locale, { orderNumber })
  }

  private translateAdminOrderStatus(
    locale: 'en' | 'es',
    metadata: Record<string, unknown>,
  ): { title: string; body: string } {
    const orderNumber = this.getMetadataString(metadata, 'orderNumber') ?? ''
    const status = this.resolveLocalizedOrderStatus(locale, metadata)
    if (status) {
      const templates = {
        en: {
          title: 'Order #{orderNumber} {status}',
          body: 'Status changed to {status}.',
        },
        es: {
          title: 'Pedido #{orderNumber} {status}',
          body: 'El estado cambió a {status}.',
        },
      }
      return this.interpolate(templates, locale, { orderNumber, status })
    }
    const templates = {
      en: {
        title: 'Order #{orderNumber} status updated',
        body: 'Order status updated.',
      },
      es: {
        title: 'Se actualizó el estado del pedido #{orderNumber}',
        body: 'El estado del pedido se actualizó.',
      },
    }
    return this.interpolate(templates, locale, { orderNumber })
  }

  private resolveLocalizedOrderStatus(
    locale: 'en' | 'es',
    metadata: Record<string, unknown>,
  ): string | null {
    const rawStatusCode = metadata.statusCode
    const statusCode =
      typeof rawStatusCode === 'number'
        ? rawStatusCode
        : typeof rawStatusCode === 'string'
          ? Number(rawStatusCode)
          : Number.NaN

    if (Number.isFinite(statusCode)) {
      const definition = findOrderStatusById(statusCode)
      if (definition) {
        const translation = definition.translations?.[locale]
        if (typeof translation === 'string' && translation.trim()) {
          return translation.trim()
        }
        if (typeof definition.label === 'string' && definition.label.trim()) {
          return definition.label.trim()
        }
      }
    }

    return this.getMetadataString(metadata, 'status')
  }

  private getMetadataString(metadata: Record<string, unknown>, key: string): string | null {
    const value = metadata[key]
    if (typeof value === 'string') {
      return value
    }
    if (typeof value === 'number') {
      return value.toString()
    }
    return null
  }

  private resolveAmountDisplay(metadata: Record<string, unknown>): string | null {
    const formatted = this.getMetadataString(metadata, 'amountFormatted')
    if (formatted) {
      return formatted
    }
    const amountRaw = metadata.amount
    if (typeof amountRaw === 'number') {
      const currency = this.getMetadataString(metadata, 'currency')
      return currency ? `${amountRaw.toFixed(2)} ${currency}` : amountRaw.toFixed(2)
    }
    if (typeof amountRaw === 'string' && amountRaw.trim()) {
      const currency = this.getMetadataString(metadata, 'currency')
      return currency ? `${amountRaw} ${currency}` : amountRaw
    }
    return null
  }

  private extractOrderPathSegment(base: Record<string, unknown>): string | null {
    const uuid = base.orderUuid
    if (typeof uuid === 'string' && uuid.trim().length > 0) {
      return uuid
    }
    const numberValue = base.orderNumber
    if (typeof numberValue === 'string' && numberValue.trim().length > 0) {
      return numberValue
    }
    const orderId = base.orderId
    if (typeof orderId === 'number' || typeof orderId === 'string') {
      return String(orderId)
    }
    return null
  }

  private hasEntityId(entityId: number | string | null): entityId is number | string {
    if (entityId === null || entityId === undefined) {
      return false
    }
    if (typeof entityId === 'string') {
      return entityId.trim().length > 0
    }
    return true
  }
}

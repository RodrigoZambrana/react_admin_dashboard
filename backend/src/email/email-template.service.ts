import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { EmailCategory, EmailTemplate, EmailTemplateVariant } from '@prisma/client'
import { TEMPLATE_DEFINITIONS, TemplateDefinition } from './templates/definitions'
import { EmailRenderContext } from './email.types'
import Handlebars from 'handlebars'
// eslint-disable-next-line @typescript-eslint/no-var-requires
import mjml2html = require('mjml')
import { htmlToText } from 'html-to-text'

type CompiledTemplate = {
  id: number
  locale: string
  category: EmailCategory
  variant: EmailTemplateVariant
  subjectCompiler: Handlebars.TemplateDelegate
  bodyCompiler: Handlebars.TemplateDelegate
  version: number
}

type RenderResult = {
  subject: string
  html: string
  text: string
  locale: string
  templateId?: number
}

const MJML_INCLUDE_PATTERN = /<\s*mj-include\b/i
const MAX_MJML_TEMPLATE_CHARS = 120_000

const EVENT_LABELS: Record<string, Record<string, string>> = {
  en: {
    'order.received': 'We received your order',
    'order.received_admin': 'New order received',
    'order.status.pending': 'Order pending',
    'order.status.paid': 'Payment confirmed',
    'order.status.delivered': 'Order delivered',
    'order.status.cancelled': 'Order cancelled',
    'order.status.updated': 'Order update',
    'budget.created': 'Your quote is ready',
    'budget.status.sent': 'Quote sent',
    'budget.status.accepted': 'Quote approved',
    'budget.status.converted': 'Quote converted to order',
    'budget.status.expired': 'Quote expired',
    'budget.status.cancelled': 'Quote cancelled',
    'budget.status.updated': 'Quote update',
  },
  es: {
    'order.received': 'Recibimos tu pedido',
    'order.received_admin': 'Nuevo pedido recibido',
    'order.status.pending': 'Pedido pendiente',
    'order.status.paid': 'Pago confirmado',
    'order.status.delivered': 'Pedido entregado',
    'order.status.cancelled': 'Pedido cancelado',
    'order.status.updated': 'Actualización de pedido',
    'budget.created': 'Tu presupuesto está listo',
    'budget.status.sent': 'Presupuesto enviado',
    'budget.status.accepted': 'Presupuesto aprobado',
    'budget.status.converted': 'Presupuesto convertido en pedido',
    'budget.status.expired': 'Presupuesto vencido',
    'budget.status.cancelled': 'Presupuesto cancelado',
    'budget.status.updated': 'Actualización de presupuesto',
  },
}

@Injectable()
export class EmailTemplateService implements OnModuleInit {
  private readonly logger = new Logger(EmailTemplateService.name)
  private readonly hbs = Handlebars.create()
  private templateCache = new Map<string, CompiledTemplate>()
  private readonly compileMjml = (markup: string, options?: Record<string, unknown>) => mjml2html(markup, options)

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.registerHelpers()
  }

  async onModuleInit() {
    await this.synchronizeStaticTemplates()
    await this.reloadActiveTemplates()
  }

  private registerHelpers() {
    this.hbs.registerHelper('uppercase', (value?: string | null) => (value ? String(value).toUpperCase() : ''))
    this.hbs.registerHelper('lowercase', (value?: string | null) => (value ? String(value).toLowerCase() : ''))
    this.hbs.registerHelper('default', (value: unknown, fallback: unknown) =>
      value === undefined || value === null || value === '' ? fallback : value,
    )
    this.hbs.registerHelper('eq', (a: unknown, b: unknown) => a === b)
    this.hbs.registerHelper('neq', (a: unknown, b: unknown) => a !== b)
    this.hbs.registerHelper('and', (...args: unknown[]) => args.slice(0, -1).every((entry) => Boolean(entry)))
    this.hbs.registerHelper('or', (...args: unknown[]) => args.slice(0, -1).some((entry) => Boolean(entry)))
    this.hbs.registerHelper('currencySymbol', (currency?: string | null) => this.resolveCurrencySymbol(currency))
    this.hbs.registerHelper(
      'formatCurrency',
      (value: unknown, currency?: string | null, options?: Handlebars.HelperOptions) =>
        this.formatCurrencyValue(value, currency, options),
    )
    this.hbs.registerHelper('formatDateTime', (value: unknown, options?: Handlebars.HelperOptions) =>
      this.formatDateValue(value, options, { includeTime: true }),
    )
    this.hbs.registerHelper('formatDate', (value: unknown, options?: Handlebars.HelperOptions) =>
      this.formatDateValue(value, options, { includeTime: false }),
    )
    this.hbs.registerHelper('eventLabel', (event: string, options?: Handlebars.HelperOptions) =>
      this.resolveEventLabel(event, options),
    )
    this.hbs.registerHelper('eventMessage', (payload: unknown, options?: Handlebars.HelperOptions) =>
      this.resolveEventMessage(payload, options, 'customer'),
    )
    this.hbs.registerHelper('eventAdminMessage', (payload: unknown, options?: Handlebars.HelperOptions) =>
      this.resolveEventMessage(payload, options, 'admin'),
    )
  }

  private resolveCurrencySymbol(raw?: string | null) {
    const currency = (raw ?? '').toUpperCase()
    if (!currency) {
      return '$'
    }
    switch (currency) {
      case 'USD':
        return 'US$'
      case 'UYU':
        return '$'
      case 'EUR':
        return '€'
      case 'GBP':
        return '£'
      default:
        return currency
    }
  }

  private formatCurrencyValue(
    value: unknown,
    currency: string | null | undefined,
    options?: Handlebars.HelperOptions,
  ) {
    if (value === null || value === undefined || value === '') {
      return ''
    }
    const numeric = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(numeric)) {
      return String(value)
    }
    const locale = this.resolveLocale(options)
    const symbol = this.resolveCurrencySymbol(currency)
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numeric)
    return `${symbol} ${formatted}`.trim()
  }

  private formatDateValue(
    value: unknown,
    options: Handlebars.HelperOptions | undefined,
    config: { includeTime: boolean },
  ) {
    if (value === null || value === undefined || value === '') {
      return ''
    }
    const date = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(date.getTime())) {
      return ''
    }
    const locale = this.resolveLocale(options)
    const timeZone = options?.hash?.timeZone || this.config.get<string>('EMAIL_DEFAULT_TIMEZONE') || undefined
    const formatOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }
    if (config.includeTime) {
      formatOptions.hour = '2-digit'
      formatOptions.minute = '2-digit'
    }
    return new Intl.DateTimeFormat(locale, { ...formatOptions, timeZone: timeZone || undefined }).format(date)
  }

  private resolveLocale(options?: Handlebars.HelperOptions) {
    const fallback = this.config.get<string>('DEFAULT_EMAIL_LOCALE') || 'en'
    if (!options?.data) {
      return fallback
    }
    const root = options.data.root as { payload?: { locale?: string }; locale?: string } | undefined
    return root?.payload?.locale || root?.locale || fallback
  }

  private resolveEventLabel(event: string, options?: Handlebars.HelperOptions) {
    if (!event) {
      return 'Update'
    }
    const locale = this.resolveLocale(options)
    const language = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const labels = EVENT_LABELS[language] ?? EVENT_LABELS.en
    return labels[event] ?? labels['order.status.updated'] ?? event
  }

  private resolveEventMessage(
    payload: unknown,
    options: Handlebars.HelperOptions | undefined,
    audience: 'customer' | 'admin',
  ) {
    if (!payload || typeof payload !== 'object') {
      return ''
    }
    const locale = this.resolveLocale(options)
    const language = locale.split(/[-_]/)[0]?.toLowerCase() || 'en'
    const isSpanish = language === 'es'
    const data = payload as Record<string, unknown>
    const docType = String(data.documentType ?? 'ORDER').toUpperCase()
    const event = String(data.event ?? '')
    const orderNumber =
      data.orderNumber !== undefined && data.orderNumber !== null && data.orderNumber !== ''
        ? String(data.orderNumber)
        : null
    const orderDate = data.orderDate ? String(data.orderDate) : null
    const validUntil = data.validUntil ? String(data.validUntil) : null
    const customer =
      (data.customer as Record<string, unknown> | undefined) ?? undefined
    const customerName =
      (customer?.name as string | undefined) ||
      (customer?.email as string | undefined) ||
      (isSpanish ? 'el cliente' : 'the customer')

    const makeRef = (type: 'order' | 'quote') => {
      const nounEn = type === 'order' ? 'order' : 'quote'
      const nounEs = type === 'order' ? 'pedido' : 'presupuesto'
      if (orderNumber) {
        if (isSpanish) {
          return `el ${nounEs} #${orderNumber}`
        }
        return `${nounEn} #${orderNumber}`
      }
      if (isSpanish) {
        return audience === 'customer'
          ? `tu ${nounEs}`
          : `el ${nounEs}`
      }
      if (audience === 'customer') {
        return type === 'order' ? 'your order' : 'your quote'
      }
      return `the ${nounEn}`
    }

    const finalize = (text?: string | null) => {
      if (!text) {
        return null
      }
      const trimmed = text.trim()
      if (!trimmed) {
        return null
      }
      return trimmed.endsWith('.') ? trimmed : `${trimmed}.`
    }

    const joinSentences = (...sentences: Array<string | null>) =>
      sentences.filter(Boolean).join(' ')

    const orderRef = makeRef('order')
    const quoteRef = makeRef('quote')
    const dateFragment = (value: string | null, prefixEn: string, prefixEs: string) => {
      if (!value) {
        return ''
      }
      return isSpanish ? ` ${prefixEs} ${value}` : ` ${prefixEn} ${value}`
    }

    const buildCustomerMessage = () => {
      if (docType === 'BUDGET') {
        switch (event) {
          case 'budget.created':
            return joinSentences(
              finalize(
                isSpanish
                ? `Preparamos ${quoteRef}${dateFragment(orderDate, 'on', 'el')} para que lo revises.`
                : `We prepared ${quoteRef}${dateFragment(orderDate, 'on', 'el')} for you to review.`,
              ),
              finalize(
                isSpanish
                  ? 'Revisá los detalles a continuación.'
                  : 'Review the details below.',
              ),
            )
          case 'budget.status.sent':
            return finalize(
              isSpanish
                ? 'Tu presupuesto está listo para compartir.'
                : 'Your quote is ready to share.',
            )
          case 'budget.status.accepted':
            return finalize(
              isSpanish
                ? 'Gracias por aprobar tu presupuesto. Coordinaremos los próximos pasos a la brevedad.'
                : 'Thanks for approving your quote. We will coordinate the next steps shortly.',
            )
          case 'budget.status.converted':
            return finalize(
              isSpanish
                ? 'Tu presupuesto ahora es un pedido. Te mantendremos al tanto del progreso.'
                : 'Your quote is now an order. We will keep you posted with progress.',
            )
          case 'budget.status.expired':
            return joinSentences(
              finalize(
                isSpanish
                  ? `${quoteRef} venció${validUntil ? ` el ${validUntil}` : ''}.`
                  : `${quoteRef} expired${validUntil ? ` on ${validUntil}` : ''}.`,
              ),
              finalize(
                isSpanish
                  ? 'Contactanos si necesitás una versión actualizada.'
                  : 'Contact us if you need an updated version.',
              ),
            )
          case 'budget.status.cancelled':
            return finalize(
              isSpanish
                ? 'Este presupuesto fue cancelado según tu solicitud. Escribinos si querés reactivarlo.'
                : 'This quote was cancelled as requested. Reach out if you would like to reactivate it.',
            )
          default:
            return finalize(
              isSpanish
                ? 'Aquí tenés la última actualización de tu presupuesto.'
                : 'Here is the latest update for your quote.',
            )
        }
      }
      switch (event) {
        case 'order.received':
          return joinSentences(
            finalize(
              (isSpanish ? 'Recibimos' : 'We received') +
                ` ${orderRef}${dateFragment(orderDate, 'on', 'el')}.`,
            ),
            finalize(
              isSpanish
                ? 'Te avisaremos a medida que avance.'
                : 'We will share updates as it moves forward.',
            ),
          )
        case 'order.status.paid':
          return finalize(
            isSpanish
              ? 'Confirmamos tu pago. Estamos preparando todo para el próximo paso.'
              : 'Your payment was confirmed. We are preparing everything for the next step.',
          )
        case 'order.status.delivered':
          return finalize(
            isSpanish
              ? 'Tu pedido fue entregado. ¡Gracias por elegirnos!'
              : 'Your items have been delivered. Enjoy!',
          )
        case 'order.status.cancelled':
          return finalize(
            isSpanish
              ? 'Tu pedido fue cancelado. Contactanos si podemos ayudarte.'
              : 'Your order was cancelled. Contact us if we can help further.',
          )
        default:
          return finalize(
            isSpanish
              ? 'Te compartimos la última novedad de tu pedido.'
              : 'Here is the latest update for your order.',
          )
      }
    }

    const buildAdminMessage = () => {
      if (docType === 'BUDGET') {
        switch (event) {
          case 'budget.created':
            return finalize(
              isSpanish
                ? `Nuevo ${quoteRef} creado por ${customerName}${dateFragment(orderDate, 'on', 'el')}.`
                : `New ${quoteRef} created by ${customerName}${dateFragment(orderDate, 'on', 'el')}.`,
            )
          case 'budget.status.sent':
            return finalize(
              isSpanish
                ? `${quoteRef} compartido con el cliente.`
                : `${quoteRef} shared with the customer.`,
            )
          case 'budget.status.accepted':
            return finalize(
              isSpanish
                ? `El cliente aprobó ${quoteRef}. Revisá los próximos pasos.`
                : `Customer approved ${quoteRef}. Review next steps.`,
            )
          case 'budget.status.converted':
            return finalize(
              isSpanish
                ? `${quoteRef} se convirtió en pedido. Supervisá el avance.`
                : `${quoteRef} converted to an order. Monitor fulfillment progress.`,
            )
          case 'budget.status.expired':
            return finalize(
              isSpanish
                ? `${quoteRef} venció${validUntil ? ` el ${validUntil}` : ''}.`
                : `${quoteRef} expired${validUntil ? ` on ${validUntil}` : ''}.`,
            )
          case 'budget.status.cancelled':
            return finalize(
              isSpanish
                ? `${quoteRef} cancelado a pedido del cliente.`
                : `${quoteRef} cancelled per customer request.`,
            )
          default:
            return finalize(
              isSpanish
                ? `Actualización de ${quoteRef} para seguimiento.`
                : `${quoteRef} update for follow-up.`,
            )
        }
      }
      switch (event) {
        case 'order.received':
        case 'order.received_admin':
          return finalize(
            isSpanish
              ? `Nuevo ${orderNumber ? `pedido #${orderNumber}` : 'pedido'} generado por ${customerName}${dateFragment(orderDate, 'on', 'el')}.`
              : `New ${orderNumber ? `order #${orderNumber}` : 'order'} placed by ${customerName}${dateFragment(orderDate, 'on', 'el')}.`,
          )
        case 'order.status.paid':
          return finalize(
            isSpanish
              ? `${orderRef} marcado como pagado. Confirmá logística o facturación.`
              : `${orderRef} marked as paid. Confirm logistics or invoicing.`,
          )
        case 'order.status.delivered':
          return finalize(
            isSpanish
              ? `${orderRef} entregado. Cerrá las tareas pendientes.`
              : `${orderRef} delivered. Close out outstanding tasks.`,
          )
        case 'order.status.cancelled':
          return finalize(
            isSpanish
              ? `${orderRef} cancelado. Revisá inventario o devoluciones.`
              : `${orderRef} cancelled. Review inventory or refund actions.`,
          )
        default:
          return finalize(
            isSpanish
              ? `Actualización del ${orderRef}.`
              : `${orderRef} updated.`,
          )
      }
    }

    return audience === 'customer' ? buildCustomerMessage() ?? '' : buildAdminMessage() ?? ''
  }

  private async synchronizeStaticTemplates() {
    const existing = await this.prisma.emailTemplate.findMany()
    const existingMap = new Map<string, EmailTemplate>()
    for (const template of existing) {
      existingMap.set(
        this.makeTemplateKey(template.category, template.variant, template.locale, template.version),
        template,
      )
    }

    const latestTarget = new Map<
      string,
      { category: EmailCategory; variant: EmailTemplateVariant; locale: string; version: number }
    >()

    for (const def of TEMPLATE_DEFINITIONS) {
      const key = this.makeTemplateKey(def.category, def.variant, def.locale, def.version)
      const familyKey = this.makeTemplateFamilyKey(def.category, def.variant, def.locale)
      const tracked = latestTarget.get(familyKey)
      if (!tracked || def.version > tracked.version) {
        latestTarget.set(familyKey, {
          category: def.category,
          variant: def.variant,
          locale: def.locale,
          version: def.version,
        })
      }

      if (!existingMap.has(key)) {
        const created = await this.prisma.emailTemplate.create({
          data: {
            category: def.category,
            variant: def.variant,
            locale: def.locale,
            version: def.version,
            subject: def.subject,
            body: def.body,
            active: true,
          },
        })
        existingMap.set(key, created)
      }
    }

    for (const { category, variant, locale, version } of latestTarget.values()) {
      await this.prisma.emailTemplate.updateMany({
        where: {
          category,
          variant,
          locale,
          version: { lt: version },
          active: true,
        },
        data: { active: false },
      })
    }
  }

  private makeTemplateKey(category: EmailCategory, variant: EmailTemplateVariant, locale: string, version: number) {
    return `${category}:${variant}:${locale}:${version}`
  }

  private makeCacheKey(category: EmailCategory, variant: EmailTemplateVariant, locale: string) {
    return `${category}:${variant}:${locale}`
  }

  private makeTemplateFamilyKey(category: EmailCategory, variant: EmailTemplateVariant, locale: string) {
    return `${category}:${variant}:${locale}`
  }

  private async reloadActiveTemplates() {
    const templates = await this.prisma.emailTemplate.findMany({
      where: { active: true },
    })

    const newCache = new Map<string, CompiledTemplate>()
    for (const template of templates) {
      try {
        const compiled = this.compileTemplate(template)
        newCache.set(this.makeCacheKey(template.category, template.variant, template.locale), compiled)
      } catch (error) {
        this.logger.error(`Failed to compile email template ${template.id}: ${(error as Error).message}`)
      }
    }
    this.templateCache = newCache
    this.logger.log(`Loaded ${this.templateCache.size} email templates into cache`)
  }

  private compileTemplate(template: EmailTemplate): CompiledTemplate {
    this.assertSafeMjmlMarkup(template.body, { templateId: template.id, phase: 'compile' })
    const subjectCompiler = this.hbs.compile(template.subject, { noEscape: false })
    const bodyCompiler = this.hbs.compile(template.body, { noEscape: false })
    return {
      id: template.id,
      locale: template.locale,
      category: template.category,
      variant: template.variant,
      subjectCompiler,
      bodyCompiler,
      version: template.version,
    }
  }

  private findTemplate(category: EmailCategory, variant: EmailTemplateVariant, locale: string): CompiledTemplate | null {
    const key = this.makeCacheKey(category, variant, locale)
    if (this.templateCache.has(key)) {
      return this.templateCache.get(key) ?? null
    }
    const defaultLocale = this.config.get<string>('DEFAULT_EMAIL_LOCALE') || 'en'
    const fallbackKey = this.makeCacheKey(category, variant, defaultLocale)
    if (this.templateCache.has(fallbackKey)) {
      return this.templateCache.get(fallbackKey) ?? null
    }
    return null
  }

  async render(context: EmailRenderContext, extras?: Record<string, unknown>): Promise<RenderResult> {
    const template = this.findTemplate(context.category, context.variant, context.payload.locale) ?? this.findTemplate(context.category, context.variant, 'en')
    if (!template) {
      throw new Error(`No email template found for category=${context.category} variant=${context.variant}`)
    }
    return this.renderUsingCompiled(template, context.payload, extras)
  }

  private async renderUsingCompiled(
    template: CompiledTemplate,
    payload: EmailRenderContext['payload'],
    extras?: Record<string, unknown>,
  ): Promise<RenderResult> {
    const baseContext = {
      payload,
      companyName: extras?.companyName ?? this.config.get<string>('COMPANY_NAME') ?? 'Sistema Administrativo',
      companyFooter:
        extras?.companyFooter ??
        this.config.get<string>('COMPANY_EMAIL_FOOTER') ??
        'You are receiving this email because you have an active account with us.',
    }

    const subject = template.subjectCompiler(baseContext)
    const mjmlMarkup = template.bodyCompiler(baseContext)
    this.assertSafeMjmlMarkup(mjmlMarkup, { templateId: template.id, phase: 'render' })
    const result = this.compileMjml(mjmlMarkup, {
      validationLevel: 'soft',
      fonts: {
        Inter: 'https://fonts.googleapis.com/css?family=Inter',
      },
    })
    if (result.errors && result.errors.length) {
      this.logger.warn(
        `MJML compilation for template ${template.id} produced warnings: ${result.errors
          .map((error) => error.formattedMessage ?? error.message)
          .join('; ')}`,
      )
    }
    if (!result.html) {
      throw new Error(`Failed to compile MJML template ${template.id}`)
    }
    const text = htmlToText(result.html, {
      wordwrap: 80,
      selectors: [
        { selector: 'a', options: { ignoreHref: false } },
        { selector: 'img', format: 'skip' },
      ],
    })

    return {
      subject,
      html: result.html,
      text,
      locale: template.locale,
      templateId: template.id,
    }
  }

  private assertSafeMjmlMarkup(
    markup: string,
    context: { templateId?: number; phase: 'compile' | 'render' },
  ) {
    if (markup.length > MAX_MJML_TEMPLATE_CHARS) {
      throw new Error(
        `MJML template ${context.templateId ?? 'unknown'} exceeds the maximum allowed size during ${context.phase}`,
      )
    }
    if (MJML_INCLUDE_PATTERN.test(markup)) {
      throw new Error(
        `MJML template ${context.templateId ?? 'unknown'} uses mj-include, which is disabled for security reasons`,
      )
    }
  }

  async reloadTemplates() {
    await this.reloadActiveTemplates()
  }

  async listActiveTemplates() {
    return this.prisma.emailTemplate.findMany({
      where: { active: true },
      select: {
        id: true,
        category: true,
        variant: true,
        locale: true,
        version: true,
        updatedAt: true,
      },
      orderBy: [
        { category: 'asc' },
        { variant: 'asc' },
        { locale: 'asc' },
      ],
    })
  }

  async getTemplateById(id: number) {
    return this.prisma.emailTemplate.findUnique({ where: { id } })
  }

  async updateTemplate(
    id: number,
    data: { subject?: string; body?: string; active?: boolean },
  ) {
    const updated = await this.prisma.emailTemplate.update({
      where: { id },
      data: {
        subject: data.subject,
        body: data.body,
        active: data.active,
      },
    })
    await this.reloadActiveTemplates()
    return updated
  }

  async renderTemplateById(
    id: number,
    payload: EmailRenderContext['payload'],
    extras?: Record<string, unknown>,
  ) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { id } })
    if (!template) {
      throw new Error(`Email template ${id} not found`)
    }
    const compiled = this.compileTemplate(template)
    return this.renderUsingCompiled(compiled, payload, extras)
  }
}

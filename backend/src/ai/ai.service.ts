import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DocumentType, EventType, PaymentStatus, PaymentType, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { SecureConfigService } from '../common/security/secure-config.service'
import { CreateAiAppointmentDto } from './dto/create-ai-appointment.dto'
import { CreateAiCustomerDto } from './dto/create-ai-customer.dto'
import { CreateAiOrderDto, GenerateAiQuoteDto } from './dto/create-ai-order.dto'
import { CreateAiPaymentDto } from './dto/create-ai-payment.dto'
import { CreateAiProductDto } from './dto/create-ai-product.dto'
import { ListAiProductsDto } from './dto/list-ai-products.dto'
import { UpdateAiRuntimeConfigDto } from './dto/update-ai-runtime-config.dto'

type AiActionCatalogEntry = {
  key: string
  label: string
  method: 'GET' | 'POST'
  path: string
  confirmationRequired: boolean
  scope: 'customer_public' | 'admin_internal'
  toolName?: string
  keywords?: string[]
  requiredFields?: string[]
  confirmationPrompt?: string
}

type StoredAiRuntimeConfig = {
  enabled: boolean
  provider: 'mock' | 'openai' | 'ollama'
  model: string
  openAiApiKey?: string | null
  monthlySpendingLimitUsd?: number | null
  currentUsageUsd?: number | null
  warningThresholdPercent: number
  usageMessage?: string | null
}

@Injectable()
export class AiService {
  static readonly AI_RUNTIME_CONFIG_KEY = 'AI_RUNTIME_CONFIG'

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly secureConfig: SecureConfigService,
  ) {}

  listActions(): AiActionCatalogEntry[] {
    return [
      {
        key: 'products.search',
        label: 'Search products',
        method: 'GET',
        path: '/api/ai/products',
        confirmationRequired: false,
        scope: 'customer_public',
      },
      {
        key: 'customers.create',
        label: 'Create or update customer',
        method: 'POST',
        path: '/api/ai/customers',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'create_customer',
        keywords: ['crear cliente', 'alta de cliente', 'nuevo cliente'],
        requiredFields: ['name'],
        confirmationPrompt:
          'Antes de ejecutar, confirmá nombre del cliente y, si aplica, email y teléfono.',
      },
      {
        key: 'appointments.create',
        label: 'Create appointment',
        method: 'POST',
        path: '/api/ai/appointments',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'create_appointment',
        keywords: ['agendar cita', 'crear cita', 'agendar visita', 'agendar'],
        requiredFields: ['title', 'startAt'],
        confirmationPrompt:
          'Antes de ejecutar, confirmá título, fecha/hora de inicio y ubicación o contexto si aplica.',
      },
      {
        key: 'products.create',
        label: 'Create product',
        method: 'POST',
        path: '/api/ai/products',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'create_product',
        keywords: ['crear producto', 'alta de producto', 'nuevo producto'],
        requiredFields: ['name'],
        confirmationPrompt:
          'Antes de ejecutar, confirmá nombre del producto, moneda y precio de venta. Si corresponde, agregá categoría, modo y stock.',
      },
      {
        key: 'orders.create',
        label: 'Create order',
        method: 'POST',
        path: '/api/ai/orders',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'create_order',
        keywords: ['crear pedido', 'crear orden', 'nuevo pedido'],
        requiredFields: ['customerId', 'items'],
        confirmationPrompt:
          'Antes de ejecutar, confirmá cliente, moneda, items y cualquier cargo de entrega.',
      },
      {
        key: 'quotes.create',
        label: 'Generate quote',
        method: 'POST',
        path: '/api/ai/quotes',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'create_quote',
        keywords: ['crear presupuesto', 'generar presupuesto', 'cotizar'],
        requiredFields: ['customerId', 'items'],
        confirmationPrompt:
          'Antes de ejecutar, confirmá cliente, items, moneda y vigencia si aplica.',
      },
      {
        key: 'payments.create',
        label: 'Create payment',
        method: 'POST',
        path: '/api/ai/payments',
        confirmationRequired: true,
        scope: 'admin_internal',
        toolName: 'create_payment',
        keywords: ['crear pago', 'registrar pago', 'cobrar'],
        requiredFields: ['orderId', 'amount', 'currency'],
        confirmationPrompt:
          'Antes de ejecutar, confirmá pedido, monto, moneda, método y estado del pago.',
      },
    ]
  }

  async listProducts(query: ListAiProductsDto) {
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const search = query.search?.trim()

    const where: Prisma.ProductWhereInput = {}
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { productCode: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ])

    return {
      items: items.map((product) => ({
        id: product.id,
        name: product.name,
        productCode: product.productCode,
        mode: product.mode,
        productType: product.productType,
        currency: product.currency,
        salePrice: Number(product.salePrice),
        costPrice: Number(product.costPrice),
        stock: product.stock,
        published: product.published,
        category: product.category,
      })),
      total,
      page,
      pageSize,
    }
  }

  async createCustomer(input: CreateAiCustomerDto) {
    const email = input.email?.trim().toLowerCase() || null
    const phoneNumber = input.phoneNumber?.trim() || null
    const firstStatus = await this.prisma.customerStatus.findFirst({
      orderBy: { id: 'asc' },
      select: { id: true },
    })

    const existing = await this.prisma.customer.findFirst({
      where: {
        OR: [email ? { email } : undefined, phoneNumber ? { phoneNumber } : undefined].filter(
          Boolean,
        ) as Prisma.CustomerWhereInput[],
      },
    })

    if (existing) {
      const customer = await this.prisma.customer.update({
        where: { id: existing.id },
        data: {
          name: input.name.trim(),
          firstName: input.firstName?.trim() || existing.firstName,
          lastName: input.lastName?.trim() || existing.lastName,
          email: email ?? existing.email,
          phoneNumber: phoneNumber ?? existing.phoneNumber,
          preferredLocale: input.preferredLocale?.trim() || existing.preferredLocale,
          statusId: existing.statusId ?? firstStatus?.id ?? null,
        },
      })

      return { customer, mode: 'updated' as const }
    }

    const customer = await this.prisma.customer.create({
      data: {
        name: input.name.trim(),
        firstName: input.firstName?.trim() || null,
        lastName: input.lastName?.trim() || null,
        email,
        phoneNumber,
        preferredLocale: input.preferredLocale?.trim() || 'es',
        statusId: firstStatus?.id ?? null,
      },
    })

    return { customer, mode: 'created' as const }
  }

  async createAppointment(input: CreateAiAppointmentDto) {
    const startAt = new Date(input.startAt)
    const endAt = input.endAt ? new Date(input.endAt) : null
    if (endAt && endAt < startAt) {
      throw new BadRequestException('appointment.endBeforeStart')
    }

    const event = await this.prisma.calendarEvent.create({
      data: {
        title: input.title.trim(),
        description: input.description?.trim() || null,
        type: input.type ?? EventType.MEETING,
        startAt,
        endAt,
        location: input.location?.trim() || null,
        metadata: {
          ...(input.metadata ?? {}),
          source: 'ai',
          customerId: input.customerId ?? null,
        },
        projectId: input.projectId ?? null,
        taskId: input.taskId ?? null,
      },
    })

    return {
      id: event.id,
      title: event.title,
      startAt: event.startAt,
      endAt: event.endAt,
      type: event.type,
    }
  }

  async createProduct(input: CreateAiProductDto) {
    const product = await this.prisma.product.create({
      data: {
        name: input.name.trim(),
        productCode: input.productCode?.trim() || null,
        description: input.description?.trim() || null,
        categoryId: input.categoryId ?? null,
        productType: input.productType,
        mode: input.mode,
        salePrice: this.toDecimal(input.salePrice ?? 0),
        costPrice: this.toDecimal(input.costPrice ?? 0),
        currency: (input.currency?.trim() || 'UYU').toUpperCase(),
        unitOfMeasure: input.unitOfMeasure,
        stock: input.stock ?? 0,
        published: input.published ?? true,
      },
    })

    return {
      id: product.id,
      name: product.name,
      currency: product.currency,
      salePrice: Number(product.salePrice),
      mode: product.mode,
    }
  }

  async createOrder(input: CreateAiOrderDto) {
    return this.createDocument(DocumentType.ORDER, input)
  }

  async generateQuote(input: GenerateAiQuoteDto) {
    return this.createDocument(DocumentType.BUDGET, input)
  }

  async createPayment(input: CreateAiPaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
      select: { id: true, uuid: true },
    })
    if (!order) {
      throw new NotFoundException('order.notFound')
    }

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        amount: this.toDecimal(input.amount),
        currency: input.currency.trim().toUpperCase(),
        type: input.type ?? PaymentType.BALANCE,
        status: input.status ?? PaymentStatus.REGISTERED,
        method: input.method?.trim() || 'AI',
        reference: input.reference?.trim() || `ai:${randomUUID()}`,
        notes: input.notes?.trim() || null,
        metadata: {
          source: 'ai',
        },
      },
    })

    await this.prisma.orderTimelineEvent.create({
      data: {
        eventId: `ai-payment-${payment.id}-${randomUUID()}`,
        orderId: order.id,
        type: 'PAYMENT_REGISTERED',
        actor: 'ai',
        amount: payment.amount,
        currency: payment.currency,
        paymentMethod: payment.method,
        message: `AI payment created for order ${order.uuid}`,
        metadata: {
          paymentId: payment.id,
          paymentStatus: payment.status,
          source: 'ai',
        },
      },
    })

    return {
      id: payment.id,
      orderId: order.id,
      orderUuid: order.uuid,
      amount: Number(payment.amount),
      currency: payment.currency,
      status: payment.status,
    }
  }

  async getRuntimeConfigSummary() {
    const stored = await this.secureConfig.getJson<StoredAiRuntimeConfig>(
      AiService.AI_RUNTIME_CONFIG_KEY,
    )
    const resolved = this.mergeRuntimeConfig(stored?.value)
    const usage = this.buildUsageSummary(resolved)

    return {
      enabled: resolved.enabled,
      provider: resolved.provider,
      model: resolved.model,
      hasOpenAiApiKey: Boolean(resolved.openAiApiKey),
      openAiApiKeyMasked: resolved.openAiApiKey ? 'configured' : '',
      monthlySpendingLimitUsd: resolved.monthlySpendingLimitUsd,
      currentUsageUsd: resolved.currentUsageUsd,
      warningThresholdPercent: resolved.warningThresholdPercent,
      usageMessage: resolved.usageMessage ?? null,
      usage,
      source: stored ? 'database' : 'environment',
      updatedAt: stored?.updatedAt ?? null,
    }
  }

  async getRuntimeConfigInternal() {
    const stored = await this.secureConfig.getJson<StoredAiRuntimeConfig>(
      AiService.AI_RUNTIME_CONFIG_KEY,
    )
    const resolved = this.mergeRuntimeConfig(stored?.value)
    const usage = this.buildUsageSummary(resolved)

    return {
      enabled: resolved.enabled,
      provider: resolved.provider,
      model: resolved.model,
      openAiApiKey: resolved.openAiApiKey ?? '',
      monthlySpendingLimitUsd: resolved.monthlySpendingLimitUsd,
      currentUsageUsd: resolved.currentUsageUsd,
      warningThresholdPercent: resolved.warningThresholdPercent,
      usageMessage: resolved.usageMessage ?? null,
      usage,
      updatedAt: stored?.updatedAt ?? null,
    }
  }

  async updateRuntimeConfig(input: UpdateAiRuntimeConfigDto) {
    const current = await this.secureConfig.getJson<StoredAiRuntimeConfig>(
      AiService.AI_RUNTIME_CONFIG_KEY,
    )
    const merged: StoredAiRuntimeConfig = {
      ...this.mergeRuntimeConfig(current?.value),
      ...Object.fromEntries(
        Object.entries({
          enabled: input.enabled,
          provider: input.provider,
          model: input.model?.trim() || undefined,
          monthlySpendingLimitUsd: input.monthlySpendingLimitUsd,
          currentUsageUsd: input.currentUsageUsd,
          warningThresholdPercent: input.warningThresholdPercent,
          usageMessage:
            input.usageMessage === undefined ? undefined : input.usageMessage?.trim() || null,
        }).filter(([, value]) => value !== undefined),
      ),
    }

    if (input.openAiApiKey !== undefined) {
      merged.openAiApiKey = input.openAiApiKey.trim() || null
    }

    await this.secureConfig.setJson(AiService.AI_RUNTIME_CONFIG_KEY, merged)
    return this.getRuntimeConfigSummary()
  }

  private async createDocument(
    documentType: DocumentType,
    input: CreateAiOrderDto | GenerateAiQuoteDto,
  ) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: input.customerId },
      select: {
        id: true,
        name: true,
      },
    })
    if (!customer) {
      throw new NotFoundException('customer.notFound')
    }
    if (!input.items.length) {
      throw new BadRequestException('order.itemsRequired')
    }

    const currency = (input.currency?.trim() || 'UYU').toUpperCase()
    const deliveryFees = this.toDecimal(input.deliveryFees ?? 0)
    const subTotal = input.items.reduce(
      (acc, item) => acc.plus(this.toDecimal(item.price).mul(item.qty)),
      new Prisma.Decimal(0),
    )
    const grandTotal = subTotal.plus(deliveryFees)
    const validUntil =
      documentType === DocumentType.BUDGET && 'validForDays' in input
        ? new Date(Date.now() + ((input.validForDays ?? 7) * 24 * 60 * 60 * 1000))
        : null

    const document = await this.prisma.order.create({
      data: {
        documentType,
        customerId: customer.id,
        comment: input.comment?.trim() || null,
        orderCurrency: currency,
        shippingAddress1: input.shippingAddress1?.trim() || null,
        shippingAddress2: input.shippingAddress2?.trim() || null,
        shippingCity: input.shippingCity?.trim() || null,
        shippingDepartment: input.shippingDepartment?.trim() || null,
        shippingNeighborhood: input.shippingNeighborhood?.trim() || null,
        shippingZip: input.shippingZip?.trim() || null,
        shippingCountry: input.shippingCountry?.trim() || null,
        deliveryFees,
        subTotal,
        grandTotal,
        validUntil,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId ?? null,
            name: item.name.trim(),
            price: this.toDecimal(item.price),
            qty: item.qty,
            description: item.description?.trim() || null,
            comments: item.comments?.trim() || null,
            unitAmount: this.toDecimal(item.price),
            unitCurrency: currency,
            unitAmountOrderCurrency: this.toDecimal(item.price),
            nameSnapshot: item.name.trim(),
          })),
        },
      },
    })

    await this.prisma.orderTimelineEvent.create({
      data: {
        eventId: `ai-${documentType.toLowerCase()}-${document.id}-${randomUUID()}`,
        orderId: document.id,
        type: documentType === DocumentType.ORDER ? 'ORDER_CREATED' : 'BUDGET_CREATED',
        actor: 'ai',
        amount: grandTotal,
        currency,
        message: `${documentType === DocumentType.ORDER ? 'Order' : 'Quote'} created by AI`,
        metadata: {
          source: 'ai',
          customerName: customer.name,
        },
      },
    })

    return {
      id: document.id,
      uuid: document.uuid,
      documentType: document.documentType,
      customerId: customer.id,
      customerName: customer.name,
      currency,
      subTotal: Number(subTotal),
      deliveryFees: Number(deliveryFees),
      grandTotal: Number(grandTotal),
      validUntil,
    }
  }

  private toDecimal(value: number | string) {
    return new Prisma.Decimal(value)
  }

  private mergeRuntimeConfig(
    stored?: Partial<StoredAiRuntimeConfig> | null,
  ): StoredAiRuntimeConfig {
    const enabledFromEnv = (this.config.get<string>('AI_ENABLED') ?? 'true') === 'true'
    const limitFromEnv = this.readNumberFromEnv('AI_MONTHLY_SPENDING_LIMIT_USD')
    const usageFromEnv = this.readNumberFromEnv('AI_CURRENT_USAGE_USD')
    const warningFromEnv =
      this.readNumberFromEnv('AI_WARNING_THRESHOLD_PERCENT') ?? 80

    return {
      enabled: stored?.enabled ?? enabledFromEnv,
      provider: stored?.provider ?? ((this.config.get<string>('AI_MODEL_PROVIDER') as StoredAiRuntimeConfig['provider']) || 'openai'),
      model: stored?.model ?? this.config.get<string>('AI_MODEL_NAME') ?? 'gpt-4o-mini',
      openAiApiKey:
        stored?.openAiApiKey !== undefined
          ? stored.openAiApiKey
          : this.config.get<string>('OPENAI_API_KEY') ?? '',
      monthlySpendingLimitUsd:
        stored?.monthlySpendingLimitUsd ?? limitFromEnv ?? 25,
      currentUsageUsd:
        stored?.currentUsageUsd ?? usageFromEnv ?? 0,
      warningThresholdPercent:
        stored?.warningThresholdPercent ?? warningFromEnv,
      usageMessage:
        stored?.usageMessage ?? 'Monitor usage closely before enabling high-volume channels.',
    }
  }

  private buildUsageSummary(config: StoredAiRuntimeConfig) {
    const limit = config.monthlySpendingLimitUsd ?? null
    const usage = config.currentUsageUsd ?? 0
    if (!limit || limit <= 0) {
      return {
        status: 'unbounded' as const,
        ratio: null,
        nearLimit: false,
        exceeded: false,
        message: 'No spending limit configured yet.',
      }
    }

    const ratio = usage / limit
    const threshold = (config.warningThresholdPercent ?? 80) / 100
    const exceeded = ratio >= 1
    const nearLimit = !exceeded && ratio >= threshold

    return {
      status: exceeded ? 'exceeded' : nearLimit ? 'near_limit' : 'healthy',
      ratio,
      nearLimit,
      exceeded,
      message: exceeded
        ? 'Current usage exceeded the configured spending limit.'
        : nearLimit
          ? 'Current usage is approaching the configured spending limit.'
          : 'Current usage remains within the configured operating range.',
    }
  }

  private readNumberFromEnv(key: string) {
    const raw = this.config.get<string>(key)
    if (raw === undefined || raw === null || raw === '') {
      return null
    }
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  }
}

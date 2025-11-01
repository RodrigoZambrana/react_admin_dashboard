// @ts-nocheck
import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import type { PaymentCreateResponse } from 'mercadopago/dist/clients/payment/create/types'
import type { PaymentGetResponse } from 'mercadopago/dist/clients/payment/get/types'
import { Prisma, PaymentStatus, PaymentType, StorefrontPaymentIntent } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { MercadoPagoChargeDto } from '../dto/mercadopago-charge.dto'
import { decimal, decimalToNumber } from '../../common/currency/money.util'
import { SecureConfigService } from '../../common/security/secure-config.service'
import { findPaymentMethodByCode } from '../../common/constants/payment-methods'

type CreateChargeOptions = {
  idempotencyKey?: string | null
  cartId?: string | null
  userAgent?: string | null
  ipAddress?: string | null
}

type MercadoPagoErrorPayload = {
  message?: string
  error?: string
  status?: number
  cause?: Array<{ code?: string; description?: string }>
}

const DEFAULT_TIMEOUT_MS = 12_000
const MERCADO_PAGO_PROVIDER = 'mercadopago'
export const MERCADO_PAGO_SECURE_CONFIG_KEY = 'payments.mercadopago'

type StoredMercadoPagoConfig = {
  accessToken?: string | null
  publicKey?: string | null
  integratorId?: string | null
  applicationId?: string | null
  country?: string | null
  timeoutMs?: number | null
}

type ResolvedMercadoPagoConfig = {
  accessToken?: string
  publicKey?: string
  integratorId?: string
  applicationId?: string
  country?: string
  timeoutMs: number
  source: 'environment' | 'database'
  updatedAt: Date | null
}

const sanitizeString = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name)
  private readonly enabled: boolean
  private readonly envDefaults: Required<Pick<ResolvedMercadoPagoConfig, 'timeoutMs'>> &
    Omit<StoredMercadoPagoConfig, 'timeoutMs'>
  private paymentClient: Payment | null = null
  private paymentMethodIdCache?: number
  private clientSignature: string | null = null
  private lastKnownAccessToken: string | null = null

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly secureConfig: SecureConfigService,
  ) {
    const provider = (config.get<string>('PAYMENTS_PROVIDER') ?? '').toLowerCase().trim()
    this.enabled = provider === MERCADO_PAGO_PROVIDER

    const timeout = Number.parseInt(String(config.get('MP_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS), 10)

    this.envDefaults = {
      accessToken: config.get<string>('MP_ACCESS_TOKEN') ?? undefined,
      integratorId: config.get<string>('MP_INTEGRATOR_ID') ?? undefined,
      applicationId: config.get<string>('MP_APPLICATION_ID') ?? undefined,
      country: (config.get<string>('MP_COUNTRY') ?? '').trim().toUpperCase() || undefined,
      publicKey: config.get<string>('MP_PUBLIC_KEY') ?? undefined,
      timeoutMs: Number.isNaN(timeout) ? DEFAULT_TIMEOUT_MS : timeout,
    }

    this.lastKnownAccessToken = this.envDefaults.accessToken ?? null

    if (!this.enabled) {
      if (provider && provider !== MERCADO_PAGO_PROVIDER) {
        this.logger.log(`Payments provider "${provider}" configured. Mercado Pago service is disabled.`)
      }
      return
    }

    if (!this.envDefaults.accessToken) {
      this.logger.warn(
        'Mercado Pago integration enabled but MP_ACCESS_TOKEN is not set. Waiting for admin-provided credentials.',
      )
    } else {
      this.ensureClientWithConfig({
        accessToken: this.envDefaults.accessToken,
        integratorId: this.envDefaults.integratorId,
        applicationId: this.envDefaults.applicationId,
        country: this.envDefaults.country,
        publicKey: this.envDefaults.publicKey,
        timeoutMs: this.envDefaults.timeoutMs,
        source: 'environment',
        updatedAt: null,
      })
    }
  }

  isEnabled(): boolean {
    return this.enabled && Boolean(this.lastKnownAccessToken)
  }

  async createCardPayment(
    dto: MercadoPagoChargeDto,
    options: CreateChargeOptions = {},
  ): Promise<StorefrontPaymentIntent> {
    const { client, config } = await this.acquireClient()

    const body = {
      transaction_amount: Number(dto.transactionAmount.toFixed(2)),
      token: dto.token,
      description: dto.description,
      installments: dto.installments,
      payment_method_id: dto.paymentMethodId,
      statement_descriptor: dto.statementDescriptor,
      currency_id: dto.currency,
      payer: {
        email: dto.payer.email,
        first_name: dto.payer.firstName,
        last_name: dto.payer.lastName,
        identification: {
          type: dto.payer.identification.type,
          number: dto.payer.identification.number,
        },
      },
      metadata: {
        cartId: dto.cartId ?? options.cartId ?? null,
        orderId: dto.orderId ?? null,
        origin: 'storefront',
        country: config.country ?? null,
      },
    } as Record<string, unknown>

    if (dto.issuerId) {
      body.issuer_id = dto.issuerId
    }

    if (config.applicationId) {
      body.application_id = config.applicationId
    }

    const requestOptions = {
      idempotencyKey: options.idempotencyKey ?? undefined,
    }

    let payment: PaymentCreateResponse
    try {
      payment = await client.create({ body, requestOptions })
    } catch (error) {
      throw this.normalizeMercadoPagoError(error)
    }

    const paymentData = payment as unknown as Record<string, any>

    const amount = Number(paymentData.transaction_amount ?? dto.transactionAmount)
    const currency = (paymentData.currency_id ?? dto.currency ?? 'ARS').toUpperCase()

    const orderId = dto.orderId
    const externalPaymentId = paymentData.id ? String(paymentData.id) : undefined
    const cardInfo = (paymentData.card ?? {}) as Record<string, any>
    const cardholder = (cardInfo.cardholder ?? {}) as Record<string, any>

    const record = await this.prisma.storefrontPaymentIntent.create({
      data: {
        provider: MERCADO_PAGO_PROVIDER,
        externalPaymentId,
        status: paymentData.status ?? 'unknown',
        statusDetail: paymentData.status_detail ?? null,
        amount: decimal(amount),
        currency,
        installments: paymentData.installments ?? dto.installments ?? null,
        paymentMethodId: paymentData.payment_method_id ?? dto.paymentMethodId ?? null,
        paymentTypeId: paymentData.payment_type_id ?? null,
        cardBrand: paymentData.payment_method_id ?? cardInfo.payment_method ?? null,
        cardLastFour: (cardInfo.last_four_digits as string | undefined) ?? null,
        cardholderName: (cardholder.name as string | undefined) ?? dto.payer?.firstName ?? null,
        statementDescriptor: paymentData.statement_descriptor ?? dto.statementDescriptor ?? null,
        description: dto.description ?? null,
        cartId: dto.cartId ?? options.cartId ?? null,
        orderId: orderId ? Number.parseInt(orderId, 10) || null : null,
        payerEmail: dto.payer.email,
        payerIdentificationType: dto.payer.identification.type,
        payerIdentificationNumber: dto.payer.identification.number,
        payerFirstName: dto.payer.firstName ?? null,
        payerLastName: dto.payer.lastName ?? null,
        riskLevel: (paymentData.risk_execution_mode as string | undefined) ?? null,
        fraudStatus: (paymentData.fraud_mode as string | undefined) ?? null,
        captureMethod: (paymentData.capture_method as string | undefined) ?? null,
        paymentMethodType: paymentData.payment_type_id ?? null,
        metadata: paymentData.metadata ? (paymentData.metadata as Prisma.JsonValue) : undefined,
        rawResponse: paymentData as Prisma.JsonValue,
        rawError: null,
        idempotencyKey: options.idempotencyKey ?? null,
        requestId: null,
        liveMode: (paymentData.live_mode as boolean | undefined) ?? null,
        refundsRaw: paymentData.refunds ? (paymentData.refunds as Prisma.JsonValue) : undefined,
        processedAt: paymentData.date_approved ? new Date(paymentData.date_approved) : null,
        statusUpdatedAt: paymentData.date_last_updated ? new Date(paymentData.date_last_updated) : null,
      },
    })

    return record
  }

  async getPayment(externalId: string): Promise<PaymentGetResponse | null> {
    const { client } = await this.acquireClient()
    try {
      return await client.get({ id: externalId })
    } catch (error) {
      const normalized = this.normalizeMercadoPagoError(error, false)
      if (normalized instanceof BadRequestException) {
        this.logger.warn(`Mercado Pago payment ${externalId} not found or inaccessible.`)
        return null
      }
      throw normalized
    }
  }

  async syncPaymentIntentByExternalId(externalPaymentId: string) {
    const payment = await this.getPayment(externalPaymentId)
    if (!payment) {
      return null
    }

    const paymentData = payment as unknown as Record<string, any>
    const intent = await this.prisma.storefrontPaymentIntent.findUnique({
      where: { externalPaymentId },
    })

    if (!intent) {
      this.logger.warn(`Received Mercado Pago webhook for unknown payment ${externalPaymentId}`)
      return null
    }

    const updateData: Prisma.StorefrontPaymentIntentUpdateInput = {
      status: (paymentData.status as string | undefined) ?? intent.status,
      statusDetail: (paymentData.status_detail as string | undefined) ?? intent.statusDetail,
      amount: decimal(Number(paymentData.transaction_amount ?? decimalToNumber(intent.amount))),
      currency: (paymentData.currency_id ?? intent.currency ?? 'ARS').toUpperCase(),
      installments: (paymentData.installments as number | undefined) ?? intent.installments,
      paymentMethodId: (paymentData.payment_method_id as string | undefined) ?? intent.paymentMethodId,
      paymentTypeId: (paymentData.payment_type_id as string | undefined) ?? intent.paymentTypeId,
      statementDescriptor:
        (paymentData.statement_descriptor as string | undefined) ?? intent.statementDescriptor,
      description: (paymentData.description as string | undefined) ?? intent.description,
      rawResponse: paymentData as Prisma.JsonValue,
      refundsRaw: paymentData.refunds ? (paymentData.refunds as Prisma.JsonValue) : undefined,
      processedAt: paymentData.date_approved ? new Date(paymentData.date_approved) : intent.processedAt,
      statusUpdatedAt: paymentData.date_last_updated
        ? new Date(paymentData.date_last_updated)
        : intent.statusUpdatedAt,
      liveMode: (paymentData.live_mode as boolean | undefined) ?? intent.liveMode,
    }

    if (paymentData.card) {
      const card = paymentData.card as Record<string, unknown>
      updateData.cardLastFour = (card.last_four_digits as string | null | undefined) ?? intent.cardLastFour
      updateData.cardBrand =
        (card.payment_method as string | null | undefined) ??
        (card['card_brand'] as string | null | undefined) ??
        (paymentData.payment_method_id as string | null | undefined) ??
        intent.cardBrand
      if (card.cardholder && typeof card.cardholder === 'object') {
        const holder = card.cardholder as Record<string, unknown>
        updateData.cardholderName = (holder.name as string | null | undefined) ?? intent.cardholderName
      }
    }

    if (paymentData.payer) {
      const payer = paymentData.payer as Record<string, unknown>
      updateData.payerEmail = (payer.email as string | undefined) ?? intent.payerEmail
      updateData.payerFirstName = (payer.first_name as string | undefined) ?? intent.payerFirstName
      updateData.payerLastName = (payer.last_name as string | undefined) ?? intent.payerLastName
      if (payer.identification && typeof payer.identification === 'object') {
        const identification = payer.identification as Record<string, unknown>
        updateData.payerIdentificationType =
          (identification.type as string | undefined) ?? intent.payerIdentificationType
        updateData.payerIdentificationNumber =
          (identification.number as string | undefined) ?? intent.payerIdentificationNumber
      }
    }

    const updated = await this.prisma.storefrontPaymentIntent.update({
      where: { id: intent.id },
      data: updateData,
    })

    if (updated.orderId) {
      await this.upsertOrderPayment(updated.orderId, updated)
    }

    return updated
  }

  async attachPaymentIntentToOrder(orderId: number, intentId: string) {
    const intent = await this.prisma.storefrontPaymentIntent.findUnique({
      where: { id: intentId },
    })

    if (!intent) {
      throw new BadRequestException('El pago no existe o venció. Vuelve a intentarlo.')
    }

    if (intent.orderId && intent.orderId !== orderId) {
      throw new BadRequestException('Este pago ya está vinculado a otro pedido.')
    }

    const updated = await this.prisma.storefrontPaymentIntent.update({
      where: { id: intentId },
      data: { orderId },
    })

    await this.upsertOrderPayment(orderId, updated)

    return updated
  }

  private async upsertOrderPayment(orderId: number, intent: StorefrontPaymentIntent) {
    const status = intent.status ?? 'pending'
    const mappedStatus = this.mapPaymentStatus(status)

    const paymentMethodId = this.ensurePaymentMethod()
    const amount = intent.amount
    const currency = intent.currency ?? 'USD'
    const reference = intent.externalPaymentId ?? undefined

    const metadata: Record<string, unknown> = {
      provider: MERCADO_PAGO_PROVIDER,
      paymentIntentId: intent.id,
      statusDetail: intent.statusDetail,
    }

    const existing = await this.prisma.payment.findFirst({
      where: {
        orderId,
        reference: reference ?? undefined,
      },
    })

    if (existing) {
      await this.prisma.payment.update({
        where: { id: existing.id },
        data: {
          amount: amount ?? existing.amount,
          currency: currency ?? existing.currency,
          status: mappedStatus,
          notes: intent.description ?? existing.notes,
          metadata,
        },
      })
      return existing
    }

    await this.prisma.payment.create({
      data: {
        orderId,
        paymentMethodId,
        method: MERCADO_PAGO_PROVIDER,
        amount: amount ?? decimal(0),
        currency,
        type: PaymentType.BALANCE,
        status: mappedStatus,
        reference: reference ?? undefined,
        notes: intent.description ?? undefined,
        metadata,
      },
    })
  }

  private ensurePaymentMethod(): number {
    if (this.paymentMethodIdCache) {
      return this.paymentMethodIdCache
    }
    const method = findPaymentMethodByCode('mercado_pago')
    if (!method) {
      throw new Error('Mercado Pago payment method is not configured')
    }
    this.paymentMethodIdCache = method.id
    return method.id
  }

  private mapPaymentStatus(status: string): PaymentStatus {
    const normalized = status.toLowerCase()
    if (normalized === 'approved' || normalized === 'authorized') {
      return PaymentStatus.CONFIRMED
    }
    if (normalized === 'in_process' || normalized === 'pending' || normalized === 'in_mediation') {
      return PaymentStatus.REGISTERED
    }
    return PaymentStatus.FAILED
  }

  async refreshConfig(): Promise<void> {
    if (!this.enabled) {
      return
    }
    this.clientSignature = null
    this.paymentClient = null
    await this.resolveRuntimeConfig().then((config) => {
      if (config.accessToken) {
        this.ensureClientWithConfig(config)
      }
    })
  }

  async getEffectiveConfig(): Promise<ResolvedMercadoPagoConfig> {
    return this.resolveRuntimeConfig()
  }

  async getPublicConfig(): Promise<{ enabled: boolean; publicKey: string | null; country: string | null; updatedAt: Date | null }> {
    const config = await this.resolveRuntimeConfig()
    return {
      enabled: this.isEnabled(),
      publicKey: config.publicKey ?? null,
      country: config.country ?? null,
      updatedAt: config.updatedAt,
    }
  }

  private async acquireClient(): Promise<{ client: Payment; config: ResolvedMercadoPagoConfig }> {
    if (!this.enabled) {
      throw new ServiceUnavailableException('Mercado Pago integration is disabled.')
    }
    const config = await this.resolveRuntimeConfig()
    if (!config.accessToken) {
      throw new ServiceUnavailableException('Mercado Pago credentials are not configured.')
    }

    const client = this.ensureClientWithConfig(config)
    if (!client) {
      throw new ServiceUnavailableException('Mercado Pago client not initialized.')
    }
    return { client, config }
  }

  private async resolveRuntimeConfig(): Promise<ResolvedMercadoPagoConfig> {
    let stored: StoredMercadoPagoConfig | null = null
    let updatedAt: Date | null = null
    try {
      const record = await this.secureConfig.getJson<StoredMercadoPagoConfig>(MERCADO_PAGO_SECURE_CONFIG_KEY)
      if (record) {
        stored = record.value
        updatedAt = record.updatedAt
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to load Mercado Pago secure config: ${message}`)
    }

    const accessToken = sanitizeString(stored?.accessToken) ?? sanitizeString(this.envDefaults.accessToken)
    const publicKey = sanitizeString(stored?.publicKey) ?? sanitizeString(this.envDefaults.publicKey)
    const integratorId = sanitizeString(stored?.integratorId) ?? sanitizeString(this.envDefaults.integratorId)
    const applicationId = sanitizeString(stored?.applicationId) ?? sanitizeString(this.envDefaults.applicationId)
    const resolvedCountry = sanitizeString(stored?.country) ?? sanitizeString(this.envDefaults.country)
    const timeoutCandidate = Number(
      stored?.timeoutMs !== undefined && stored?.timeoutMs !== null ? stored.timeoutMs : this.envDefaults.timeoutMs,
    )

    const resolved: ResolvedMercadoPagoConfig = {
      accessToken,
      publicKey,
      integratorId,
      applicationId,
      country: resolvedCountry ? resolvedCountry.toUpperCase() : undefined,
      timeoutMs: Number.isFinite(timeoutCandidate) && timeoutCandidate > 0 ? timeoutCandidate : DEFAULT_TIMEOUT_MS,
      source: stored ? 'database' : 'environment',
      updatedAt,
    }

    this.lastKnownAccessToken = resolved.accessToken ?? null

    return resolved
  }

  private ensureClientWithConfig(config: ResolvedMercadoPagoConfig): Payment | null {
    if (!config.accessToken) {
      this.paymentClient = null
      this.clientSignature = null
      this.lastKnownAccessToken = null
      return null
    }

    const signature = this.buildClientSignature(config)
    if (this.paymentClient && this.clientSignature === signature) {
      this.lastKnownAccessToken = config.accessToken
      return this.paymentClient
    }

    try {
      const clientConfig = new MercadoPagoConfig({
        accessToken: config.accessToken,
        options: { timeout: config.timeoutMs },
        integratorId: config.integratorId,
      })
      this.paymentClient = new Payment(clientConfig)
      this.clientSignature = signature
      this.lastKnownAccessToken = config.accessToken
      return this.paymentClient
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to initialize Mercado Pago client: ${message}`)
      this.paymentClient = null
      this.clientSignature = null
      throw new ServiceUnavailableException('Unable to initialize Mercado Pago client.')
    }
  }

  private buildClientSignature(config: ResolvedMercadoPagoConfig): string {
    return `${config.accessToken ?? ''}::${config.integratorId ?? ''}::${config.timeoutMs}`
  }

  private normalizeMercadoPagoError(error: unknown, throwOnNotFound = true) {
    if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) {
      return error
    }

    const payload = this.extractErrorPayload(error)
    const statusCode = payload.status ?? 400
    const baseMessage =
      payload.cause && payload.cause.length > 0
        ? payload.cause.map((item) => item.description).filter(Boolean).join('. ')
        : payload.message ?? payload.error ?? 'No pudimos procesar el pago. Revisa los datos e intenta nuevamente.'

    if (!throwOnNotFound && statusCode === 404) {
      return new BadRequestException(baseMessage)
    }

    if (statusCode >= 500) {
      this.logger.error(`Mercado Pago error ${statusCode}: ${baseMessage}`)
      return new ServiceUnavailableException(
        'Mercado Pago no está disponible en este momento. Intenta nuevamente en unos instantes.',
      )
    }

    return new BadRequestException(baseMessage)
  }

  private extractErrorPayload(error: unknown): MercadoPagoErrorPayload {
    if (!error || typeof error !== 'object') {
      return {}
    }

    if ('message' in error && typeof error.message === 'string' && !('cause' in error)) {
      return { message: error.message, status: (error as Error & { status?: number }).status }
    }

    if ('cause' in error && Array.isArray((error as Record<string, unknown>).cause)) {
      const cause = (error as Record<string, unknown>).cause as Array<{ code?: string; description?: string }>
      return {
        message: (error as Record<string, unknown>).message as string | undefined,
        error: (error as Record<string, unknown>).error as string | undefined,
        status: (error as Record<string, unknown>).status as number | undefined,
        cause,
      }
    }

    if ('response' in error && typeof error.response === 'object' && error.response) {
      const response = error.response as Record<string, unknown>
      if ('data' in response && response.data && typeof response.data === 'object') {
        return response.data as MercadoPagoErrorPayload
      }
    }

    return {}
  }
}

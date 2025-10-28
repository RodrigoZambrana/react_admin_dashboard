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

@Injectable()
export class MercadoPagoService {
  private readonly logger = new Logger(MercadoPagoService.name)
  private readonly enabled: boolean
  private readonly accessToken?: string
  private readonly integratorId?: string
  private readonly country?: string
  private readonly paymentClient?: Payment
  private paymentMethodIdCache?: number
  private readonly applicationId?: string

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const provider = (config.get<string>('PAYMENTS_PROVIDER') ?? '').toLowerCase().trim()
    this.enabled = provider === MERCADO_PAGO_PROVIDER
    this.accessToken = config.get<string>('MP_ACCESS_TOKEN') ?? undefined
    this.integratorId = config.get<string>('MP_INTEGRATOR_ID') ?? undefined
    this.country = (config.get<string>('MP_COUNTRY') ?? '').trim().toUpperCase() || undefined
    this.applicationId = config.get<string>('MP_APPLICATION_ID') ?? undefined

    if (!this.enabled) {
      if (provider && provider !== MERCADO_PAGO_PROVIDER) {
        this.logger.log(`Payments provider "${provider}" configured. Mercado Pago service is disabled.`)
      }
      return
    }

    if (!this.accessToken) {
      this.logger.error('Mercado Pago integration enabled but MP_ACCESS_TOKEN is not set.')
      throw new Error('MP_ACCESS_TOKEN must be configured when PAYMENTS_PROVIDER=mercadopago')
    }

    const timeout = Number.parseInt(String(config.get('MP_TIMEOUT_MS') ?? DEFAULT_TIMEOUT_MS), 10)

    const clientConfig = new MercadoPagoConfig({
      accessToken: this.accessToken,
      options: { timeout: Number.isNaN(timeout) ? DEFAULT_TIMEOUT_MS : timeout },
      integratorId: this.integratorId,
    })

    this.paymentClient = new Payment(clientConfig)
  }

  isEnabled(): boolean {
    return this.enabled && Boolean(this.paymentClient)
  }

  async createCardPayment(
    dto: MercadoPagoChargeDto,
    options: CreateChargeOptions = {},
  ): Promise<StorefrontPaymentIntent> {
    this.ensureEnabled()

    if (!this.paymentClient) {
      throw new ServiceUnavailableException('Mercado Pago client not initialized')
    }

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
        country: this.country ?? null,
      },
    } as Record<string, unknown>

    if (dto.issuerId) {
      body.issuer_id = dto.issuerId
    }

    if (this.applicationId) {
      body.application_id = this.applicationId
    }

    const requestOptions = {
      idempotencyKey: options.idempotencyKey ?? undefined,
    }

    let payment: PaymentCreateResponse
    try {
      payment = await this.paymentClient.create({ body, requestOptions })
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
    this.ensureEnabled()
    if (!this.paymentClient) {
      throw new ServiceUnavailableException('Mercado Pago client not initialized')
    }
    try {
      return await this.paymentClient.get({ id: externalId })
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

    const paymentMethodId = await this.ensurePaymentMethod()
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

  private async ensurePaymentMethod(): Promise<number> {
    if (this.paymentMethodIdCache) {
      return this.paymentMethodIdCache
    }
    const record = await this.prisma.paymentMethod.upsert({
      where: { name: 'Mercado Pago' },
      update: {},
      create: { name: 'Mercado Pago' },
    })
    this.paymentMethodIdCache = record.id
    return record.id
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

  private ensureEnabled(): void {
    if (!this.isEnabled()) {
      throw new ServiceUnavailableException('Mercado Pago integration is disabled.')
    }
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

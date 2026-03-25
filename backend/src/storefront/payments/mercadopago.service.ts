// @ts-nocheck
import { BadRequestException, Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago'
import type { PaymentCreateResponse } from 'mercadopago/dist/clients/payment/create/types'
import type { PaymentGetResponse } from 'mercadopago/dist/clients/payment/get/types'
import { Prisma, PaymentStatus, PaymentType, StorefrontPaymentIntent } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { MercadoPagoChargeDto } from '../dto/mercadopago-charge.dto'
import { decimal, decimalToNumber } from '../../common/currency/money.util'
import { SecureConfigService } from '../../common/security/secure-config.service'
import { findPaymentMethodByCode } from '../../common/constants/payment-methods'
import { OrderPaymentSettlementService } from '../../orders/order-payment-settlement.service'

type CreateChargeOptions = {
  idempotencyKey?: string | null
  cartId?: string | null
  checkoutToken?: string | null
  checkoutSnapshot?: CheckoutSnapshot | null
  userAgent?: string | null
  ipAddress?: string | null
}

type CheckoutSnapshot = Record<string, unknown>

type MercadoPagoErrorPayload = {
  message?: string
  error?: string
  status?: number
  cause?: Array<{ code?: string; description?: string }>
}

const DEFAULT_TIMEOUT_MS = 12_000
const MERCADO_PAGO_PROVIDER = 'mercadopago'
export const MERCADO_PAGO_SECURE_CONFIG_KEY = 'payments.mercadopago'
const SNAPSHOT_CLEANUP_INTERVAL_MS = 15 * 60 * 1000
const SNAPSHOT_OBSOLETE_TTL_MS = {
  negativeTerminal: 60 * 60 * 1000,
  inFlight: 24 * 60 * 60 * 1000,
  approvedWithoutOrder: 7 * 24 * 60 * 60 * 1000,
  unknown: 48 * 60 * 60 * 1000,
} as const

type StoredMercadoPagoConfig = {
  provider?: string | null
  accessToken?: string | null
  publicKey?: string | null
  integratorId?: string | null
  applicationId?: string | null
  country?: string | null
  timeoutMs?: number | null
}

type ResolvedMercadoPagoConfig = {
  provider: 'mercadopago' | 'none'
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

const safeStringify = (input: unknown): string => {
  try {
    return JSON.stringify(input)
  } catch {
    return '[unserializable]'
  }
}

const normalizeAmount = (raw: unknown): number => {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw
  }
  const normalized = String(raw ?? '')
    .trim()
    .replace(/\./g, '')
    .replace(/,/g, '.')
  const parsed = Number.parseFloat(normalized)
  return parsed
}

const sanitizeCheckoutSnapshot = (value: unknown): CheckoutSnapshot | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  return value as CheckoutSnapshot
}

const buildMercadoPagoProviderMetadata = (input: {
  cartId?: string | null
  checkoutToken?: string | null
  orderId?: string | null
}): Record<string, string> => {
  const metadata: Record<string, string> = {}

  const cartId = sanitizeString(input.cartId)
  const checkoutToken = sanitizeString(input.checkoutToken)
  const orderId = sanitizeString(input.orderId)

  if (cartId) {
    metadata.cartId = cartId
  }

  if (checkoutToken) {
    metadata.checkoutToken = checkoutToken
  }

  if (orderId) {
    metadata.orderId = orderId
  }

  return metadata
}

@Injectable()
export class MercadoPagoService implements OnModuleInit {
  private readonly logger = new Logger(MercadoPagoService.name)
  private readonly envProvider: 'mercadopago' | 'none'
  private provider: 'mercadopago' | 'none'
  private readonly envDefaults: Required<Pick<ResolvedMercadoPagoConfig, 'timeoutMs'>> &
    Omit<StoredMercadoPagoConfig, 'timeoutMs' | 'provider'>
  private paymentClient: Payment | null = null
  private preferenceClient: Preference | null = null
  private paymentMethodIdCache?: number
  private clientSignature: string | null = null
  private lastKnownAccessToken: string | null = null
  private lastSnapshotCleanupAt = 0

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly secureConfig: SecureConfigService,
    private readonly paymentSettlement: OrderPaymentSettlementService,
  ) {
    const envProviderConfig = (config.get<string>('PAYMENTS_PROVIDER') ?? MERCADO_PAGO_PROVIDER).toLowerCase().trim()
    this.envProvider = envProviderConfig === MERCADO_PAGO_PROVIDER ? MERCADO_PAGO_PROVIDER : 'none'
    this.provider = this.envProvider

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

    if (!this.providerEnabled()) {
      if (this.envProvider !== MERCADO_PAGO_PROVIDER && envProviderConfig) {
        this.logger.log(`Payments provider "${envProviderConfig}" configured. Mercado Pago service is disabled.`)
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

  async onModuleInit() {
    await this.maybeCleanupObsoleteCheckoutSnapshots('module-init')
    await this.refreshConfig()
  }

  private providerEnabled(): boolean {
    return this.provider === MERCADO_PAGO_PROVIDER
  }

  isEnabled(): boolean {
    return this.providerEnabled() && Boolean(this.lastKnownAccessToken)
  }

  async createCardPayment(
    dto: MercadoPagoChargeDto,
    options: CreateChargeOptions = {},
  ): Promise<StorefrontPaymentIntent> {
    await this.maybeCleanupObsoleteCheckoutSnapshots('charge')
    const { client, config } = await this.acquireClient()

    const transactionAmount = Number(dto.transactionAmount.toFixed(2))
    const currencyCode = (dto.currency ?? '').trim().toUpperCase() || undefined

    const payerEmail = dto.payer.email.trim()
    const payerFirstName = dto.payer.firstName?.trim()
    const payerLastName = dto.payer.lastName?.trim()
    const rawIdentificationType = sanitizeString(dto.payer.identification?.type)
    const identificationType = rawIdentificationType?.toUpperCase()
    const identificationNumber = sanitizeString(dto.payer.identification?.number)?.replace(/[^\dA-Za-z]/g, '')

    if (config.country === 'UY' && identificationType && ['OTRO', 'OTHER'].includes(identificationType)) {
      throw new BadRequestException(
        'El tipo de documento no es válido para Uruguay. Usa CI o RUT para continuar con Mercado Pago.',
      )
    }

    const payer: Record<string, unknown> = {
      email: payerEmail,
    }

    if (rawIdentificationType && identificationNumber) {
      payer.identification = {
        type: rawIdentificationType,
        number: identificationNumber,
      }
    }

    if (payerFirstName) {
      payer.first_name = payerFirstName
    }

    if (payerLastName) {
      payer.last_name = payerLastName
    }

    const body: Record<string, unknown> = {
      token: dto.token,
      transaction_amount: transactionAmount,
      installments: dto.installments,
      payment_method_id: dto.paymentMethodId,
      payer,
    }

    if (dto.description) {
      body.description = dto.description
    }

    if (dto.statementDescriptor) {
      body.statement_descriptor = dto.statementDescriptor
    }

    if (dto.issuerId) {
      const issuerIdNumber = Number(dto.issuerId)
      if (Number.isFinite(issuerIdNumber)) {
        body.issuer_id = issuerIdNumber
      }
    }

    if (config.applicationId) {
      body.application_id = config.applicationId
    }

    const requestOptions = {
      idempotencyKey: options.idempotencyKey ?? undefined,
    }

    this.logger.debug(
      `Mercado Pago charge payload: amount=${transactionAmount} currency=${currencyCode ?? dto.currency} method=${dto.paymentMethodId} issuer=${dto.issuerId ?? 'none'} installments=${dto.installments} hasIdentification=${rawIdentificationType && identificationNumber ? 'yes' : 'no'} identificationType=${identificationType ?? 'none'} cartId=${dto.cartId ?? options.cartId ?? 'none'} orderId=${dto.orderId ?? 'none'}`,
    )

    let payment: PaymentCreateResponse
    try {
      payment = await client.create({ body, requestOptions })
    } catch (error) {
      throw this.normalizeMercadoPagoError(error)
    }

    const paymentData = payment as unknown as Record<string, any>

    const amount = Number(paymentData.transaction_amount ?? dto.transactionAmount)
    const currency = (paymentData.currency_id ?? currencyCode ?? dto.currency ?? 'ARS').toUpperCase()

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
        payerEmail,
        payerIdentificationType: identificationType ?? null,
        payerIdentificationNumber: identificationNumber ?? null,
        payerFirstName: payerFirstName ?? null,
        payerLastName: payerLastName ?? null,
        riskLevel: (paymentData.risk_execution_mode as string | undefined) ?? null,
        fraudStatus: (paymentData.fraud_mode as string | undefined) ?? null,
        captureMethod: (paymentData.capture_method as string | undefined) ?? null,
        paymentMethodType: paymentData.payment_type_id ?? null,
        metadata: {
          ...(paymentData.metadata && typeof paymentData.metadata === 'object'
            ? (paymentData.metadata as Record<string, unknown>)
            : {}),
          cartId: dto.cartId ?? options.cartId ?? null,
          checkoutToken: dto.checkoutToken ?? options.checkoutToken ?? null,
          checkoutSnapshot:
            sanitizeCheckoutSnapshot(options.checkoutSnapshot) ??
            sanitizeCheckoutSnapshot(dto.checkoutSnapshot) ??
            null,
        } as Prisma.JsonValue,
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

  async createPreference(dto: {
    amount: number
    currency: string
    description?: string | null
    cartId?: string | null
    checkoutToken?: string | null
    orderId?: string | null
    statementDescriptor?: string | null
    payerEmail?: string | null
    backUrls?: { success?: string | null; failure?: string | null; pending?: string | null }
    maxInstallments?: number | null
    checkoutSnapshot?: CheckoutSnapshot | null
  }): Promise<{ preferenceId: string }> {
    await this.maybeCleanupObsoleteCheckoutSnapshots('preference')
    if (!this.providerEnabled()) {
      throw new ServiceUnavailableException('Mercado Pago integration is disabled.')
    }

    const config = await this.resolveRuntimeConfig()
    const preferenceClient = this.ensurePreferenceClientWithConfig(config)

    if (!preferenceClient || !config.accessToken) {
      throw new ServiceUnavailableException('Mercado Pago credentials are not configured.')
    }

    const amountRaw = dto.amount as unknown
    const amount = normalizeAmount(amountRaw)
    if (!Number.isFinite(amount) || amount <= 0) {
      const rawLabel = String(amountRaw ?? 'undefined')
      this.logger.warn(`Mercado Pago preference rejected: invalid amount "${rawLabel}"`)
      throw new BadRequestException(`Monto inválido para crear la preferencia de Mercado Pago. Valor recibido: "${rawLabel}".`)
    }
    const amountRounded = Math.round(amount * 100) / 100

    const currency = (dto.currency ?? '').trim().toUpperCase()
    if (!currency) {
      throw new BadRequestException('La moneda es obligatoria para crear la preferencia de Mercado Pago.')
    }

    const description = sanitizeString(dto.description) ?? 'Order payment'
    const statementDescriptor = sanitizeString(dto.statementDescriptor)
    const payerEmail = sanitizeString(dto.payerEmail)
    const sanitizeBackUrl = (value?: string | null) =>
      value && /^https?:\/\//i.test(value.trim()) ? value.trim() : undefined
    const backUrlsRaw = dto.backUrls && (dto.backUrls.success || dto.backUrls.failure || dto.backUrls.pending)
    const backUrls = backUrlsRaw
      ? {
          success: sanitizeBackUrl(dto.backUrls.success),
          failure: sanitizeBackUrl(dto.backUrls.failure),
          pending: sanitizeBackUrl(dto.backUrls.pending),
        }
      : undefined
    const maxInstallments =
      typeof dto.maxInstallments === 'number' && Number.isFinite(dto.maxInstallments) && dto.maxInstallments > 0
        ? Math.floor(dto.maxInstallments)
        : null

    const providerMetadata = buildMercadoPagoProviderMetadata({
      cartId: dto.cartId,
      checkoutToken: dto.checkoutToken,
      orderId: dto.orderId,
    })

    const body: Record<string, unknown> = {
      items: [
        {
          id: dto.orderId ?? dto.cartId ?? 'order',
          title: description,
          quantity: 1,
          unit_price: amountRounded,
          currency_id: currency,
        },
      ],
      metadata: providerMetadata,
    }

    if (maxInstallments) {
      body.payment_methods = {
        installments: maxInstallments,
      }
    }

    if (statementDescriptor) {
      body.statement_descriptor = statementDescriptor
    }

    if (payerEmail) {
      body.payer = { email: payerEmail }
    }

    const hasSuccessUrl = Boolean(backUrls?.success)
    const hasFailureUrl = Boolean(backUrls?.failure)
    const hasPendingUrl = Boolean(backUrls?.pending)
    if (hasSuccessUrl || hasFailureUrl || hasPendingUrl) {
      const filteredBackUrls: Record<string, string> = {}
      if (hasSuccessUrl && backUrls?.success) filteredBackUrls.success = backUrls.success
      if (hasFailureUrl && backUrls?.failure) filteredBackUrls.failure = backUrls.failure
      if (hasPendingUrl && backUrls?.pending) filteredBackUrls.pending = backUrls.pending
      if (Object.keys(filteredBackUrls).length > 0) {
        body.back_urls = filteredBackUrls
      }
      // auto_return se omite mientras las URLs no sean absolutas y confirmadas
    }

    this.logger.debug(
      `Mercado Pago preference payload: amountRaw=${String(amountRaw)}, parsed=${amountRounded}, currency=${currency}, cartId=${dto.cartId}, orderId=${dto.orderId}`,
    )

    let preference: Record<string, any>
    try {
      preference = await preferenceClient.create({ body })
    } catch (error) {
      this.logger.warn(`Mercado Pago preference create failed | error=${safeStringify(error)}`)
      throw this.normalizeMercadoPagoError(error)
    }

    const preferenceId =
      preference?.id ??
      preference?.body?.id ??
      preference?.response?.id ??
      preference?.response?.data?.id ??
      null

    if (!preferenceId) {
      throw new ServiceUnavailableException('Failed to create Mercado Pago preference.')
    }

    const checkoutSnapshot = sanitizeCheckoutSnapshot(dto.checkoutSnapshot) ?? null
    const existingPendingIntent =
      dto.checkoutToken || dto.cartId
        ? await this.prisma.storefrontPaymentIntent.findFirst({
            where: {
              provider: MERCADO_PAGO_PROVIDER,
              externalPaymentId: null,
              ...(dto.cartId ? { cartId: dto.cartId } : {}),
              ...(dto.checkoutToken
                ? {
                    metadata: {
                      path: ['checkoutToken'],
                      equals: dto.checkoutToken,
                    },
                  }
                : {}),
            },
            orderBy: { createdAt: 'desc' },
          })
        : null

    const localMetadata: Record<string, unknown> = {
      preferenceId: String(preferenceId),
      cartId: dto.cartId ?? null,
      checkoutToken: dto.checkoutToken ?? null,
      orderId: dto.orderId ?? null,
      checkoutSnapshot,
      providerMetadata,
    }

    if (existingPendingIntent) {
      await this.prisma.storefrontPaymentIntent.update({
        where: { id: existingPendingIntent.id },
        data: {
          status: 'preference_created',
          statusDetail: null,
          amount: decimal(amountRounded),
          currency,
          description,
          statementDescriptor: statementDescriptor ?? null,
          cartId: dto.cartId ?? null,
          payerEmail: payerEmail ?? null,
          metadata: localMetadata as Prisma.JsonValue,
        },
      })
    } else {
      await this.prisma.storefrontPaymentIntent.create({
        data: {
          provider: MERCADO_PAGO_PROVIDER,
          status: 'preference_created',
          statusDetail: null,
          amount: decimal(amountRounded),
          currency,
          description,
          statementDescriptor: statementDescriptor ?? null,
          cartId: dto.cartId ?? null,
          orderId: dto.orderId ? Number.parseInt(dto.orderId, 10) || null : null,
          payerEmail: payerEmail ?? null,
          metadata: localMetadata as Prisma.JsonValue,
        },
      })
    }

    return { preferenceId: String(preferenceId) }
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

    const updated = await this.resolvePaymentIntentByExternalId(externalPaymentId, undefined, payment as unknown as Record<string, any>)

    if (!updated) {
      this.logger.warn(`Received Mercado Pago webhook for unknown payment ${externalPaymentId}`)
      return null
    }

    if (updated.orderId) {
      const dispatchPlan = await this.upsertOrderPayment(updated.orderId, updated)
      await this.paymentSettlement.dispatch(dispatchPlan)
    }

    return updated
  }

  async resolvePaymentIntentByExternalId(
    externalPaymentId: string,
    context?: { cartId?: string | null; checkoutToken?: string | null; payerEmail?: string | null },
    paymentDataArg?: Record<string, any> | null,
  ) {
    await this.maybeCleanupObsoleteCheckoutSnapshots('resolve')
    const paymentData =
      paymentDataArg ?? ((await this.getPayment(externalPaymentId)) as unknown as Record<string, any> | null)
    if (!paymentData) {
      return null
    }

    const existingByExternalId = await this.prisma.storefrontPaymentIntent.findFirst({
      where: { externalPaymentId },
    })

    const existingByContext =
      !existingByExternalId && (context?.checkoutToken || context?.cartId)
        ? await this.prisma.storefrontPaymentIntent.findFirst({
            where: {
              provider: MERCADO_PAGO_PROVIDER,
              externalPaymentId: null,
              ...(context?.cartId ? { cartId: context.cartId } : {}),
              ...(context?.checkoutToken
                ? {
                    metadata: {
                      path: ['checkoutToken'],
                      equals: context.checkoutToken,
                    },
                  }
                : {}),
            },
            orderBy: { createdAt: 'desc' },
          })
        : null

    const existing = existingByExternalId ?? existingByContext ?? null

    const paymentMetadata =
      paymentData.metadata && typeof paymentData.metadata === 'object'
        ? (paymentData.metadata as Record<string, unknown>)
        : {}

    const resolvedCartId =
      sanitizeString(paymentMetadata.cartId as string | undefined) ??
      sanitizeString(context?.cartId) ??
      existing?.cartId ??
      undefined
    const resolvedCheckoutToken =
      sanitizeString(paymentMetadata.checkoutToken as string | undefined) ??
      sanitizeString(context?.checkoutToken) ??
      undefined
    const resolvedPayerEmail =
      sanitizeString(paymentData.payer?.email as string | undefined) ??
      sanitizeString(context?.payerEmail) ??
      existing?.payerEmail ??
      undefined

    const baseData: Prisma.StorefrontPaymentIntentUpdateInput = {
      externalPaymentId,
      status: (paymentData.status as string | undefined) ?? existing?.status ?? 'pending',
      statusDetail: (paymentData.status_detail as string | undefined) ?? existing?.statusDetail ?? null,
      amount: decimal(Number(paymentData.transaction_amount ?? decimalToNumber(existing?.amount ?? decimal(0)))),
      currency: (paymentData.currency_id ?? existing?.currency ?? 'ARS').toUpperCase(),
      installments: (paymentData.installments as number | undefined) ?? existing?.installments,
      paymentMethodId: (paymentData.payment_method_id as string | undefined) ?? existing?.paymentMethodId,
      paymentTypeId: (paymentData.payment_type_id as string | undefined) ?? existing?.paymentTypeId,
      statementDescriptor:
        (paymentData.statement_descriptor as string | undefined) ?? existing?.statementDescriptor,
      description: (paymentData.description as string | undefined) ?? existing?.description,
      rawResponse: paymentData as Prisma.JsonValue,
      refundsRaw: paymentData.refunds ? (paymentData.refunds as Prisma.JsonValue) : undefined,
      processedAt: paymentData.date_approved
        ? new Date(paymentData.date_approved)
        : existing?.processedAt,
      statusUpdatedAt: paymentData.date_last_updated
        ? new Date(paymentData.date_last_updated)
        : existing?.statusUpdatedAt,
      liveMode: (paymentData.live_mode as boolean | undefined) ?? existing?.liveMode,
      cartId: resolvedCartId ?? null,
      payerEmail: resolvedPayerEmail ?? null,
      metadata: {
        ...(existing?.metadata && typeof existing.metadata === 'object'
          ? (existing.metadata as Record<string, unknown>)
          : {}),
        ...paymentMetadata,
        cartId: resolvedCartId ?? null,
        checkoutToken: resolvedCheckoutToken ?? null,
      } as Prisma.JsonValue,
    }

    if (paymentData.card) {
      const card = paymentData.card as Record<string, unknown>
      baseData.cardLastFour = (card.last_four_digits as string | null | undefined) ?? existing?.cardLastFour
      baseData.cardBrand =
        (card.payment_method as string | null | undefined) ??
        (card['card_brand'] as string | null | undefined) ??
        (paymentData.payment_method_id as string | null | undefined) ??
        existing?.cardBrand
      if (card.cardholder && typeof card.cardholder === 'object') {
        const holder = card.cardholder as Record<string, unknown>
        baseData.cardholderName = (holder.name as string | null | undefined) ?? existing?.cardholderName
      }
    }

    if (paymentData.payer) {
      const payer = paymentData.payer as Record<string, unknown>
      baseData.payerEmail = (payer.email as string | undefined) ?? resolvedPayerEmail ?? null
      baseData.payerFirstName = (payer.first_name as string | undefined) ?? existing?.payerFirstName
      baseData.payerLastName = (payer.last_name as string | undefined) ?? existing?.payerLastName
      if (payer.identification && typeof payer.identification === 'object') {
        const identification = payer.identification as Record<string, unknown>
        baseData.payerIdentificationType =
          (identification.type as string | undefined) ?? existing?.payerIdentificationType
        baseData.payerIdentificationNumber =
          (identification.number as string | undefined) ?? existing?.payerIdentificationNumber
      }
    }

    if (existing) {
      return this.prisma.storefrontPaymentIntent.update({
        where: { id: existing.id },
        data: baseData,
      })
    }

    return this.prisma.storefrontPaymentIntent.create({
      data: {
        provider: MERCADO_PAGO_PROVIDER,
        status: (baseData.status as string | undefined) ?? 'pending',
        statusDetail: (baseData.statusDetail as string | null | undefined) ?? null,
        amount: baseData.amount as Prisma.Decimal,
        currency: (baseData.currency as string | undefined) ?? 'ARS',
        externalPaymentId,
        installments: (baseData.installments as number | null | undefined) ?? null,
        paymentMethodId: (baseData.paymentMethodId as string | null | undefined) ?? null,
        paymentTypeId: (baseData.paymentTypeId as string | null | undefined) ?? null,
        cardBrand: (baseData.cardBrand as string | null | undefined) ?? null,
        cardLastFour: (baseData.cardLastFour as string | null | undefined) ?? null,
        cardholderName: (baseData.cardholderName as string | null | undefined) ?? null,
        statementDescriptor: (baseData.statementDescriptor as string | null | undefined) ?? null,
        description: (baseData.description as string | null | undefined) ?? null,
        cartId: resolvedCartId ?? null,
        payerEmail: (baseData.payerEmail as string | null | undefined) ?? null,
        payerIdentificationType: (baseData.payerIdentificationType as string | null | undefined) ?? null,
        payerIdentificationNumber: (baseData.payerIdentificationNumber as string | null | undefined) ?? null,
        payerFirstName: (baseData.payerFirstName as string | null | undefined) ?? null,
        payerLastName: (baseData.payerLastName as string | null | undefined) ?? null,
        rawResponse: paymentData as Prisma.JsonValue,
        refundsRaw: paymentData.refunds ? (paymentData.refunds as Prisma.JsonValue) : undefined,
        processedAt: baseData.processedAt as Date | null | undefined,
        statusUpdatedAt: baseData.statusUpdatedAt as Date | null | undefined,
        liveMode: (baseData.liveMode as boolean | null | undefined) ?? null,
        metadata: baseData.metadata as Prisma.JsonValue,
      },
    })
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

    const dispatchPlan = await this.upsertOrderPayment(orderId, updated)
    await this.paymentSettlement.dispatch(dispatchPlan)

    return updated
  }

  private async upsertOrderPayment(orderId: number, intent: StorefrontPaymentIntent) {
    const status = intent.status ?? 'pending'
    const mappedStatus = this.mapPaymentStatus(status)

    const paymentMethodId = this.ensurePaymentMethod()
    const orderMonetary = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        grandTotal: true,
        orderCurrency: true,
      },
    })

    const providerAmount = intent.amount ?? decimal(0)
    const providerCurrency = (intent.currency ?? 'USD').toUpperCase()
    const amount = orderMonetary?.grandTotal ?? providerAmount
    const currency = (orderMonetary?.orderCurrency ?? providerCurrency).toUpperCase()
    const reference = intent.externalPaymentId ?? undefined

    const metadata: Record<string, unknown> = {
      provider: MERCADO_PAGO_PROVIDER,
      paymentIntentId: intent.id,
      statusDetail: intent.statusDetail,
      providerAmount: decimalToNumber(providerAmount),
      providerCurrency,
      accountingAmount: decimalToNumber(amount),
      accountingCurrency: currency,
    }

    const existing = await this.prisma.payment.findFirst({
      where: {
        orderId,
        reference: reference ?? undefined,
      },
    })

    if (existing) {
      const previousStatus = existing.status
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
      return this.paymentSettlement.apply({
        paymentId: existing.id,
        previousPaymentStatus: previousStatus,
      })
    }

    try {
      const created = await this.prisma.payment.create({
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
      return this.paymentSettlement.apply({
        paymentId: created.id,
        previousPaymentStatus: null,
      })
    } catch (error) {
      if (
        reference &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const concurrent = await this.prisma.payment.findFirst({
          where: {
            orderId,
            reference,
          },
        })

        if (concurrent) {
          const previousStatus = concurrent.status
          await this.prisma.payment.update({
            where: { id: concurrent.id },
            data: {
              amount: amount ?? concurrent.amount,
              currency: currency ?? concurrent.currency,
              status: mappedStatus,
              notes: intent.description ?? concurrent.notes,
              metadata,
            },
          })

          return this.paymentSettlement.apply({
            paymentId: concurrent.id,
            previousPaymentStatus: previousStatus,
          })
        }
      }

      throw error
    }
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
    if (normalized === 'approved' || normalized === 'captured') {
      return PaymentStatus.CONFIRMED
    }
    if (
      normalized === 'authorized' ||
      normalized === 'in_process' ||
      normalized === 'pending' ||
      normalized === 'in_mediation'
    ) {
      return PaymentStatus.REGISTERED
    }
    return PaymentStatus.FAILED
  }

  async refreshConfig(): Promise<void> {
    this.clientSignature = null
    this.paymentClient = null
    this.preferenceClient = null
    await this.resolveRuntimeConfig().then((config) => {
      if (this.providerEnabled() && config.accessToken) {
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
    if (!this.providerEnabled()) {
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

    const resolvedProvider = this.resolveProvider(stored?.provider)
    const accessToken = sanitizeString(stored?.accessToken) ?? sanitizeString(this.envDefaults.accessToken)
    const publicKey = sanitizeString(stored?.publicKey) ?? sanitizeString(this.envDefaults.publicKey)
    const integratorId = sanitizeString(stored?.integratorId) ?? sanitizeString(this.envDefaults.integratorId)
    const applicationId = sanitizeString(stored?.applicationId) ?? sanitizeString(this.envDefaults.applicationId)
    const resolvedCountry = sanitizeString(stored?.country) ?? sanitizeString(this.envDefaults.country)
    const timeoutCandidate = Number(
      stored?.timeoutMs !== undefined && stored?.timeoutMs !== null ? stored.timeoutMs : this.envDefaults.timeoutMs,
    )

    this.provider = resolvedProvider

    const resolved: ResolvedMercadoPagoConfig = {
      provider: resolvedProvider,
      accessToken,
      publicKey,
      integratorId,
      applicationId,
      country: resolvedCountry ? resolvedCountry.toUpperCase() : undefined,
      timeoutMs: Number.isFinite(timeoutCandidate) && timeoutCandidate > 0 ? timeoutCandidate : DEFAULT_TIMEOUT_MS,
      source: stored ? 'database' : 'environment',
      updatedAt,
    }

    this.lastKnownAccessToken = this.providerEnabled() ? resolved.accessToken ?? null : null

    return resolved
  }

  private ensureClientWithConfig(config: ResolvedMercadoPagoConfig): Payment | null {
    if (!config.accessToken) {
      this.paymentClient = null
      this.preferenceClient = null
      this.clientSignature = null
      this.lastKnownAccessToken = null
      return null
    }

    const signature = this.buildClientSignature(config)
    if (this.paymentClient && this.preferenceClient && this.clientSignature === signature) {
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
      this.preferenceClient = new Preference(clientConfig)
      this.clientSignature = signature
      this.lastKnownAccessToken = config.accessToken
      return this.paymentClient
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to initialize Mercado Pago client: ${message}`)
      this.paymentClient = null
      this.preferenceClient = null
      this.clientSignature = null
      throw new ServiceUnavailableException('Unable to initialize Mercado Pago client.')
    }
  }

  private buildClientSignature(config: ResolvedMercadoPagoConfig): string {
    return `${config.accessToken ?? ''}::${config.integratorId ?? ''}::${config.timeoutMs}`
  }

  private ensurePreferenceClientWithConfig(config: ResolvedMercadoPagoConfig): Preference | null {
    if (!config.accessToken) {
      this.preferenceClient = null
      this.clientSignature = null
      this.lastKnownAccessToken = null
      return null
    }

    const signature = this.buildClientSignature(config)
    if (this.preferenceClient && this.clientSignature === signature) {
      this.lastKnownAccessToken = config.accessToken
      return this.preferenceClient
    }

    try {
      const clientConfig = new MercadoPagoConfig({
        accessToken: config.accessToken,
        options: { timeout: config.timeoutMs },
        integratorId: config.integratorId,
      })
      this.preferenceClient = new Preference(clientConfig)
      this.clientSignature = signature
      this.lastKnownAccessToken = config.accessToken
      return this.preferenceClient
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to initialize Mercado Pago preference client: ${message}`)
      this.paymentClient = null
      this.preferenceClient = null
      this.clientSignature = null
      throw new ServiceUnavailableException('Unable to initialize Mercado Pago client.')
    }
  }

  private resolveProvider(candidate?: string | null): 'mercadopago' | 'none' {
    if (!candidate) {
      return this.envProvider
    }
    const normalized = candidate.trim().toLowerCase()
    if (normalized === MERCADO_PAGO_PROVIDER) {
      return MERCADO_PAGO_PROVIDER
    }
    if (normalized === 'disabled' || normalized === 'none') {
      return 'none'
    }
    return this.envProvider
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
        : payload.message ?? payload.error ?? null
    const rawErrorMessage = error instanceof Error ? error.message : String(error)
    const resolvedMessage =
      baseMessage && baseMessage.trim().length > 0
        ? baseMessage
        : rawErrorMessage || 'No pudimos procesar el pago. Revisa los datos e intenta nuevamente.'

    const responsePayload = {
      message: resolvedMessage,
      mp: payload,
      raw: safeStringify(error),
    }

    if (!throwOnNotFound && statusCode === 404) {
      return new BadRequestException(responsePayload)
    }

    if (statusCode >= 500) {
      this.logger.error(`Mercado Pago error ${statusCode}: ${baseMessage}`)
      return new ServiceUnavailableException(
        {
          message: 'Mercado Pago no está disponible en este momento. Intenta nuevamente en unos instantes.',
          mp: payload,
          raw: rawErrorMessage,
        },
      )
    }

    this.logger.warn(
      `Mercado Pago error ${statusCode}: ${resolvedMessage} | payload=${safeStringify(payload)} | raw=${rawErrorMessage}`,
    )
    return new BadRequestException(responsePayload)
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

  private async maybeCleanupObsoleteCheckoutSnapshots(trigger: string) {
    const now = Date.now()
    if (now - this.lastSnapshotCleanupAt < SNAPSHOT_CLEANUP_INTERVAL_MS) {
      return
    }
    this.lastSnapshotCleanupAt = now
    try {
      await this.cleanupObsoleteCheckoutSnapshots(trigger, new Date(now))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Mercado Pago snapshot cleanup failed during ${trigger}: ${message}`)
    }
  }

  private async cleanupObsoleteCheckoutSnapshots(trigger: string, now: Date) {
    const oldestRelevantDate = new Date(now.getTime() - SNAPSHOT_OBSOLETE_TTL_MS.negativeTerminal)
    const candidates = await this.prisma.storefrontPaymentIntent.findMany({
      where: {
        orderId: null,
        createdAt: { lte: oldestRelevantDate },
      },
      select: {
        id: true,
        status: true,
        statusDetail: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
        statusUpdatedAt: true,
        externalPaymentId: true,
      },
      take: 200,
      orderBy: { createdAt: 'asc' },
    })

    let cleaned = 0
    for (const intent of candidates) {
      const metadata =
        intent.metadata && typeof intent.metadata === 'object' && !Array.isArray(intent.metadata)
          ? ({ ...(intent.metadata as Record<string, unknown>) } satisfies Record<string, unknown>)
          : null
      if (!metadata || !('checkoutSnapshot' in metadata) || !metadata.checkoutSnapshot) {
        continue
      }

      const cleanupPolicy = this.resolveSnapshotCleanupPolicy(intent.status)
      const referenceDate = intent.statusUpdatedAt ?? intent.updatedAt ?? intent.createdAt
      const ageMs = now.getTime() - referenceDate.getTime()
      if (ageMs < cleanupPolicy.ttlMs) {
        continue
      }

      metadata.checkoutSnapshot = null
      metadata.checkoutSnapshotObsoleteAt = now.toISOString()
      metadata.checkoutSnapshotObsoleteReason = cleanupPolicy.reason
      metadata.checkoutSnapshotCleanupTrigger = trigger
      metadata.checkoutSnapshotOriginalStatus = intent.status
      metadata.checkoutSnapshotOriginalStatusDetail = intent.statusDetail ?? null

      await this.prisma.storefrontPaymentIntent.update({
        where: { id: intent.id },
        data: {
          metadata: metadata as Prisma.JsonValue,
        },
      })
      cleaned += 1
    }

    if (cleaned > 0) {
      this.logger.log(`Mercado Pago snapshot cleanup (${trigger}) marked ${cleaned} intent(s) as obsolete.`)
    }
  }

  private resolveSnapshotCleanupPolicy(status: string | null | undefined): {
    ttlMs: number
    reason: string
  } {
    const normalized = (status ?? '').trim().toLowerCase()

    if (['rejected', 'cancelled', 'canceled', 'refunded', 'charged_back', 'failed'].includes(normalized)) {
      return {
        ttlMs: SNAPSHOT_OBSOLETE_TTL_MS.negativeTerminal,
        reason: 'terminal_payment_without_order',
      }
    }

    if (['approved', 'captured'].includes(normalized)) {
      return {
        ttlMs: SNAPSHOT_OBSOLETE_TTL_MS.approvedWithoutOrder,
        reason: 'approved_without_order_reconciliation_window_expired',
      }
    }

    if (['authorized', 'in_process', 'pending', 'processing', 'in_mediation'].includes(normalized)) {
      return {
        ttlMs: SNAPSHOT_OBSOLETE_TTL_MS.inFlight,
        reason: 'payment_intent_stale_without_order',
      }
    }

    return {
      ttlMs: SNAPSHOT_OBSOLETE_TTL_MS.unknown,
      reason: 'unknown_payment_state_without_order',
    }
  }
}

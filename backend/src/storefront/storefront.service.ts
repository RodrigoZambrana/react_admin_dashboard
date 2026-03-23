import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common'
import {
  Prisma,
  DocumentType,
  Customer,
  CustomerAddress,
  OrderItem,
  ProductType,
  ProductMode,
  ProductAttributeType,
  CompanyProfile,
  PaymentStatus,
  StorefrontPaymentIntent,
} from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { NotificationOrchestratorService } from '../notifications/notification-orchestrator.service'
import { CurrencyConversionService } from '../common/currency/currency-conversion.service'
import { decimal, decimalToNumber } from '../common/currency/money.util'
import { buildImageDataUrl, ensureNodeBuffer } from '../common/images/image.utils'
import { DEFAULT_STOREFRONT_CONFIG } from './defaults/config'
import { DEFAULT_HOME_LAYOUTS, FALLBACK_LAYOUT_KEY } from './defaults/layouts'
import {
  buildCategorySlug,
  buildLegacyCategorySlug,
  buildLegacyProductSlug,
  buildProductSlug,
  slugify,
} from './utils'
import type {
  HomeLayoutDefinition,
  HomeModuleConfig,
  InventoryStatus,
  MoneyDto,
  OrderSummary,
  ProductDetailDto,
  ProductSummaryDto,
  ProductAttributeTypeDto,
  ProductVariantDto,
  ProductVariantSelectionDto,
  StorefrontConfig,
  CheckoutLineItem,
  CustomerProfile,
  CustomerWishlistDto,
  StorefrontCategoryTree,
  StorefrontAuthSession,
  StorefrontShippingOptionDto,
  OrderDeliverySummary,
} from './types'
import { StorefrontProductQueryDto } from './dto/product-query.dto'
import {
  StorefrontRegisterDto,
  StorefrontLoginDto,
  StorefrontRefreshDto,
  StorefrontUpdateProfileDto,
} from './dto/auth.dto'
import { StorefrontCreateOrderDto } from './dto/order.dto'
import { createHash } from 'crypto'
import { StorefrontAddressDto } from './dto/address.dto'
import { MercadoPagoService } from './payments/mercadopago.service'
import { GoogleConfigService } from '../common/integrations/google-config.service'
import type { FastifyRequest } from 'fastify'
import { findOrderStatusById, ORDER_STATUS_CODES } from '../common/constants/order-statuses'
import { findPaymentMethodById, findPaymentMethodByCode } from '../common/constants/payment-methods'
import { ParametricPricingService } from '../pricing/parametric-pricing.service'
import type { ParametricQuoteInput } from '../pricing/types'
import { OrderTimelineService } from '../orders/order-timeline.service'
import { OrderStockIntegrityService } from '../orders/order-stock-integrity.service'
import {
  StorefrontPublishedProductResolverService,
  type PublishedParametricProductDefinition,
  type PublishedParametricVariantDefinition,
} from './storefront-published-product-resolver.service'
import { buildPhoneLookupCandidates, normalizePhoneNumber } from '../common/utils/phone'

const ACCESS_TOKEN_EXPIRES_IN = '15m'
const REFRESH_TOKEN_EXPIRES_IN = '7d'

const INVENTORY_STATUS: Record<number, 'in-stock' | 'limited' | 'out-of-stock'> = {
  0: 'in-stock',
  1: 'limited',
  2: 'out-of-stock',
}

const CHECKOUT_UUID_PREFIX = 'storefront:checkout:'

const mapStatusColorToBadge = (color?: string | null): 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
  if (!color) {
    return 'secondary'
  }
  const normalized = color.toLowerCase()
  if (normalized.includes('green')) {
    return 'success'
  }
  if (normalized.includes('orange') || normalized.includes('yellow')) {
    return 'warning'
  }
  if (normalized.includes('red')) {
    return 'error'
  }
  if (normalized.includes('blue')) {
    return 'primary'
  }
  return 'secondary'
}

const PAYMENT_STATUS_META: Record<
  string,
  { label: string; badge: 'primary' | 'secondary' | 'success' | 'warning' | 'error'; color: string }
> = {
  paid: { label: 'Pagado', badge: 'primary', color: 'blue' },
  pending: { label: 'Pendiente', badge: 'warning', color: 'orange' },
  processing: { label: 'En revisión', badge: 'warning', color: 'orange' },
  failed: { label: 'Fallido', badge: 'error', color: 'red' },
}

const resolvePaymentStatusMeta = (
  status: string,
): { label: string; badge: 'primary' | 'secondary' | 'success' | 'warning' | 'error'; color: string } => {
  const normalized = status.toLowerCase()
  return PAYMENT_STATUS_META[normalized] ?? { label: status, badge: 'secondary', color: 'gray' }
}

const parsePositiveInt = (value?: string | number | null, fallback = 1): number => {
  if (value === undefined || value === null) return fallback
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (Number.isNaN(parsed) || parsed <= 0) return fallback
  return parsed
}

const splitStreetAndNumber = (
  line?: string | null,
): { street: string; number: string } => {
  const trimmed = (line ?? '').trim()
  if (!trimmed) {
    return { street: '', number: 'S/N' }
  }
  const match = trimmed.match(/^(.*?)[\s,]+(\d[\dA-Za-z\-\/]*)$/)
  if (!match) {
    return { street: trimmed, number: 'S/N' }
  }
  const street = match[1].trim()
  const number = match[2].trim() || 'S/N'
  return {
    street: street || trimmed,
    number,
  }
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase()

const isEmailIdentifier = (value: string): boolean => value.includes('@')

const sanitizePhoneInput = (value?: string | null): string | null => {
  const normalized = normalizePhoneNumber(value)
  return normalized && normalized.length >= 6 ? normalized : null
}

const normalizeLocalePreference = (value?: string | null): 'en' | 'es' => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (normalized.startsWith('en')) {
    return 'en'
  }
  return 'es'
}

const getPreferredLocale = (record: unknown): 'en' | 'es' => {
  if (record && typeof record === 'object' && 'preferredLocale' in (record as Record<string, unknown>)) {
    const value = (record as Record<string, unknown>).preferredLocale
    if (typeof value === 'string') {
      return normalizeLocalePreference(value)
    }
  }
  return 'es'
}

const deriveCountryCode = (countryName?: string | null): string | null => {
  if (!countryName) return null
  const normalized = countryName.trim()
  if (!normalized) return null
  const predefined: Record<string, string> = {
    Uruguay: 'UY',
    Argentina: 'AR',
    Brasil: 'BR',
    Brazil: 'BR',
    Chile: 'CL',
    Paraguay: 'PY',
    Perú: 'PE',
    Peru: 'PE',
    Bolivia: 'BO',
    Colombia: 'CO',
    México: 'MX',
    Mexico: 'MX',
    España: 'ES',
    Spain: 'ES',
  }
  if (predefined[normalized]) {
    return predefined[normalized]
  }
  const sanitized = normalized.replace(/[^A-Za-z]/g, ' ').trim()
  if (!sanitized) return null
  const words = sanitized.split(/\s+/)
  if (words.length === 1) {
    const word = words[0].toUpperCase()
    if (word.length >= 2) return word.slice(0, 2)
    if (word.length === 1) return `${word}${word}`
    return null
  }
  const initials = words
    .map((word) => (word[0] || '').toUpperCase())
    .join('')
    .replace(/[^A-Z]/g, '')
  if (initials.length >= 2) {
    return initials.slice(0, 3)
  }
  return sanitized.slice(0, 2).toUpperCase() || null
}

const mergeDeep = <T>(target: T, source: Record<string, unknown>): T => {
  if (typeof target !== 'object' || target === null) {
    return target
  }
  const output: Record<string, unknown> = { ...(target as Record<string, unknown>) }
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue
    if (value === null) {
      output[key] = null
      continue
    }
    if (Array.isArray(value)) {
      output[key] = value
      continue
    }
    if (typeof value === 'object' && typeof target[key] === 'object' && target[key] !== null) {
      output[key] = mergeDeep(target[key] as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      output[key] = value
    }
  }
  return output as T
}

const mapInventoryStatus = (product: { status: number; permanentStock: boolean | null }): InventoryStatus => {
  if (product.permanentStock) return 'in-stock'
  return (INVENTORY_STATUS[product.status] ?? 'in-stock') as InventoryStatus
}

const generateCheckoutUuid = (seed: string): string => {
  const hashBuffer = createHash('sha1').update(`${CHECKOUT_UUID_PREFIX}${seed}`).digest()
  // Set version to 5
  hashBuffer[6] = (hashBuffer[6] & 0x0f) | 0x50
  // Set variant to RFC 4122
  hashBuffer[8] = (hashBuffer[8] & 0x3f) | 0x80
  const hex = hashBuffer.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

const money = (amount: number, currency = 'USD'): MoneyDto => ({ amount, currency })

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: true
    payments: true
    storefrontPayments: true
  }
}>

type OrderIdentifierCandidate = { id: number; createdAt: Date; uuid: string | null }
type CustomerWithAddresses = Customer & { addresses: CustomerAddress[] }
type OrderSummaryWithReference = OrderSummary & { reference: string }
type WishlistWithItems = Prisma.WishlistGetPayload<{
  include: {
    items: {
      include: {
        product: {
          include: {
            images: true
            category: true
          }
        }
      }
    }
  }
}>

type ProductWithVariants = Prisma.ProductGetPayload<{
  include: {
    images: true
    category: true
    options: {
      include: {
        values: true
      }
    }
    variants: {
      include: {
        images: true
        selections: {
          include: {
            optionValue: {
              include: {
                option: true
              }
            }
          }
        }
      }
    }
  }
}>

@Injectable()
export class StorefrontService implements OnModuleInit {
  private readonly logger = new Logger(StorefrontService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly currencyConversion: CurrencyConversionService,
    private readonly notifications: NotificationOrchestratorService,
    private readonly mercadoPago: MercadoPagoService,
    private readonly googleConfig: GoogleConfigService,
    private readonly parametricPricing: ParametricPricingService,
    private readonly timeline: OrderTimelineService,
    private readonly stockIntegrity: OrderStockIntegrityService,
    private readonly publishedProductResolver: StorefrontPublishedProductResolverService,
  ) {}

  private defaultCustomerPassword!: string
  private defaultCustomerPasswordHash!: string
  private readonly companySingletonKey = 'default'
  private readonly snapshotFallbackConfigKey = 'storefront:snapshotFallbackEnabled'

  private normalizeConfigString(value: unknown): string {
    if (value === null || value === undefined) {
      return ''
    }
    return String(value).trim()
  }

  private normalizeConfigBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'number') {
      return value !== 0
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (!normalized) {
        return false
      }
      return ['1', 'true', 'yes', 'si', 'sí', 'y'].includes(normalized)
    }
    return false
  }

  private normalizeConfigNumber(value: unknown, field: string): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value)
    }
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.').trim()
      if (!normalized) {
        throw new BadRequestException(`Missing value for ${field}`)
      }
      const parsed = Number(normalized)
      if (!Number.isFinite(parsed)) {
        throw new BadRequestException(`Invalid numeric value for ${field}`)
      }
      return Math.trunc(parsed)
    }
    throw new BadRequestException(`Invalid numeric value for ${field}`)
  }

  private async resolvePublishedParametricConfiguration(
    productId: number,
    rawConfiguration?: Record<string, unknown> | null,
    fallbackCurrency?: string | null,
  ): Promise<PublishedParametricVariantDefinition | null> {
    return this.publishedProductResolver.resolvePublishedParametricVariant(productId, rawConfiguration, fallbackCurrency)
  }

  private buildProductTypeCode(familyId?: string | null): string {
    if (!familyId || typeof familyId !== 'string') {
      return ''
    }
    const ascii = familyId
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Za-z0-9_ ]+/g, ' ')
    const parts = ascii
      .split(/[_\s]+/)
      .map((segment) => segment.trim())
      .filter(Boolean)
    if (!parts.length) {
      return ''
    }
    const candidate = parts.length > 1 ? parts[1] : parts[0]
    if (!candidate) {
      return ''
    }
    const upper = candidate.toUpperCase()
    return upper.length <= 4 ? upper : upper.substring(0, 4)
  }

  private isApprovedStorefrontPaymentStatus(status?: string | null): boolean {
    const normalized = (status ?? '').trim().toLowerCase()
    return normalized === 'approved' || normalized === 'captured'
  }

  private extractCheckoutSnapshotFromIntent(intent: Pick<StorefrontPaymentIntent, 'metadata'>): StorefrontCreateOrderDto | null {
    if (!intent.metadata || typeof intent.metadata !== 'object' || Array.isArray(intent.metadata)) {
      return null
    }

    const metadata = intent.metadata as Record<string, unknown>
    const snapshot = metadata.checkoutSnapshot
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
      return null
    }

    return snapshot as StorefrontCreateOrderDto
  }

  private extractCheckoutTokenFromIntent(intent: Pick<StorefrontPaymentIntent, 'metadata'>): string | undefined {
    if (!intent.metadata || typeof intent.metadata !== 'object' || Array.isArray(intent.metadata)) {
      return undefined
    }

    const checkoutToken = (intent.metadata as Record<string, unknown>).checkoutToken
    if (typeof checkoutToken !== 'string') {
      return undefined
    }

    const normalized = checkoutToken.trim()
    return normalized.length > 0 ? normalized : undefined
  }

  private async loadOrderSummaryById(orderId: number): Promise<OrderSummaryWithReference | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        payments: true,
        storefrontPayments: true,
      },
    })

    return order ? this.toOrderSummary(order) : null
  }

  private async updatePaymentIntentReconciliationMetadata(
    intentId: string,
    metadataSource: Prisma.JsonValue | null,
    updates: Record<string, unknown>,
  ) {
    const metadata =
      metadataSource && typeof metadataSource === 'object' && !Array.isArray(metadataSource)
        ? ({ ...(metadataSource as Record<string, unknown>) } satisfies Record<string, unknown>)
        : {}

    Object.assign(metadata, updates)

    await this.prisma.storefrontPaymentIntent.update({
      where: { id: intentId },
      data: {
        metadata: metadata as Prisma.InputJsonValue,
      },
    })
  }

  async reconcileApprovedPaymentIntent(intentId: string): Promise<OrderSummaryWithReference | null> {
    const intent = await this.prisma.storefrontPaymentIntent.findUnique({
      where: { id: intentId },
    })

    if (!intent) {
      return null
    }

    if (intent.orderId) {
      return this.loadOrderSummaryById(intent.orderId)
    }

    if (!this.isApprovedStorefrontPaymentStatus(intent.status)) {
      return null
    }

    const checkoutSnapshot = this.extractCheckoutSnapshotFromIntent(intent)
    if (!checkoutSnapshot) {
      await this.updatePaymentIntentReconciliationMetadata(intent.id, intent.metadata, {
        reconciliationStatus: 'manual_review_required',
        reconciliationReason: 'approved_without_checkout_snapshot',
        reconciliationUpdatedAt: new Date().toISOString(),
      })
      return null
    }

    const checkoutToken = checkoutSnapshot.checkoutToken ?? this.extractCheckoutTokenFromIntent(intent)

    if (!this.mercadoPago.isEnabled()) {
      await this.updatePaymentIntentReconciliationMetadata(intent.id, intent.metadata, {
        reconciliationStatus: 'deferred_provider_unavailable',
        reconciliationReason: 'payments_provider_disabled',
        reconciliationUpdatedAt: new Date().toISOString(),
      })
      return null
    }

    try {
      const order = await this.createOrder({
        ...checkoutSnapshot,
        paymentIntentId: intent.id,
        ...(checkoutToken ? { checkoutToken } : {}),
      })

      await this.updatePaymentIntentReconciliationMetadata(intent.id, intent.metadata, {
        reconciliationStatus: 'resolved',
        reconciliationReason: null,
        reconciliationUpdatedAt: new Date().toISOString(),
        reconciliationOrderId: order.id,
      })

      return order
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Failed to reconcile approved payment intent ${intent.id}: ${message}`)

      await this.updatePaymentIntentReconciliationMetadata(intent.id, intent.metadata, {
        reconciliationStatus: 'auto_reconcile_failed',
        reconciliationReason: 'order_creation_failed',
        reconciliationLastError: message,
        reconciliationUpdatedAt: new Date().toISOString(),
      })

      return null
    }
  }

  async reconcileHistoricalApprovedPaymentIntents(limit = 25): Promise<{
    processed: number
    reconciled: number
    manualReview: number
  }> {
    if (!this.mercadoPago.isEnabled()) {
      return {
        processed: 0,
        reconciled: 0,
        manualReview: 0,
      }
    }

    const intents = await this.prisma.storefrontPaymentIntent.findMany({
      where: {
        orderId: null,
        status: { in: ['approved', 'captured'] },
      },
      orderBy: [{ statusUpdatedAt: 'desc' }, { updatedAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.max(1, Math.min(limit, 100)),
    })

    let reconciled = 0
    let manualReview = 0

    for (const intent of intents) {
      const result = await this.reconcileApprovedPaymentIntent(intent.id)
      if (result) {
        reconciled += 1
        continue
      }

      if (!this.extractCheckoutSnapshotFromIntent(intent)) {
        manualReview += 1
      }
    }

    return {
      processed: intents.length,
      reconciled,
      manualReview,
    }
  }

  private mapCompanyProfile(record?: CompanyProfile | null): StorefrontConfig['companyProfile'] {
    if (!record) {
      return null
    }

    const logoBuffer = ensureNodeBuffer(record.logo)

    return {
      legalName: record.legalName ?? null,
      tradeName: record.tradeName ?? null,
      taxId: record.taxId ?? null,
      email: record.email ?? null,
      phone: record.phone ?? null,
      website: record.website ?? null,
      addressLine1: record.addressLine1 ?? null,
      addressLine2: record.addressLine2 ?? null,
      logo: logoBuffer ? buildImageDataUrl(logoBuffer) : null,
    }
  }

  async onModuleInit() {
    await this.ensureDefaultPasswordHash()

    try {
      await this.prisma.customer.updateMany({
        where: {
          passwordHash: null,
          storefrontDefaultPasswordHash: null,
        },
        data: {
          storefrontDefaultPasswordHash: this.defaultCustomerPasswordHash,
        },
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
        this.logger.warn(
          'Customer.passwordHash column missing; skipped storefront default password bootstrap. Run latest migrations to enable this feature.',
        )
      } else {
        throw error
      }
    }

    try {
      const result = await this.reconcileHistoricalApprovedPaymentIntents()
      if (result.reconciled > 0 || result.manualReview > 0) {
        this.logger.log(
          `Storefront payment reconciliation bootstrap processed ${result.processed} intent(s): ${result.reconciled} reconciled, ${result.manualReview} marked for manual review.`,
        )
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.warn(`Storefront payment reconciliation bootstrap failed: ${message}`)
    }
  }

  async getConfig(): Promise<StorefrontConfig> {
    const configRow = await this.prisma.systemConfig.findUnique({ where: { key: 'storefront:config' } })
    let overrides: Record<string, unknown> = {}
    if (configRow?.value) {
      try {
        overrides = JSON.parse(configRow.value)
      } catch (error) {
        overrides = {}
      }
    }
    const merged = mergeDeep(DEFAULT_STOREFRONT_CONFIG, overrides)
    const snapshotFallbackRecord = await this.prisma.systemConfig.findUnique({
      where: { key: this.snapshotFallbackConfigKey },
    })
    const snapshotFallbackEnabled = snapshotFallbackRecord?.value === 'false' ? false : true
    const layouts = Array.isArray(merged.layouts) && merged.layouts.length > 0 ? merged.layouts : DEFAULT_HOME_LAYOUTS
    const defaultLayout = layouts.some((layout) => layout.key === merged.defaultLayout) ? merged.defaultLayout : FALLBACK_LAYOUT_KEY

    let companyProfile: StorefrontConfig['companyProfile'] = merged.companyProfile ?? null
    const hasCompanyProfileOverride = Object.prototype.hasOwnProperty.call(overrides, 'companyProfile')

    if (!hasCompanyProfileOverride) {
      const record = await this.prisma.companyProfile.findUnique({
        where: { singleton: this.companySingletonKey },
      })
      const resolved = this.mapCompanyProfile(record)
      companyProfile = resolved ?? companyProfile
    }

    const paymentInfo = await this.mercadoPago.getPublicConfig()
    const payments =
      paymentInfo.enabled || paymentInfo.publicKey || paymentInfo.country
        ? {
            mercadopago: {
              enabled: paymentInfo.enabled,
              publicKey: paymentInfo.publicKey,
              country: paymentInfo.country,
              updatedAt: paymentInfo.updatedAt ? paymentInfo.updatedAt.toISOString() : null,
            },
          }
        : {
            mercadopago: null,
          }

    const googleIntegration = await this.googleConfig.getEffectiveConfig()
    const storefrontGoogleEnabled =
      googleIntegration.google.enabled &&
      googleIntegration.google.storefrontEnabled &&
      Boolean(googleIntegration.google.clientId) &&
      Boolean(googleIntegration.google.clientSecret) &&
      Boolean(googleIntegration.google.redirectUri)
    const storefrontRecaptchaEnabled =
      googleIntegration.recaptcha.storefront.enabled &&
      Boolean(googleIntegration.recaptcha.storefront.siteKey)

    const integrations = {
      google: {
        enabled: storefrontGoogleEnabled,
      },
      recaptcha: {
        enabled: storefrontRecaptchaEnabled,
        siteKey: storefrontRecaptchaEnabled ? googleIntegration.recaptcha.storefront.siteKey : null,
      },
    }

    const mergedResilienceFlag =
      typeof merged.resilience?.snapshotFallbackEnabled === 'boolean'
        ? merged.resilience.snapshotFallbackEnabled
        : true

    const resilience = {
      snapshotFallbackEnabled: Boolean(mergedResilienceFlag) && snapshotFallbackEnabled,
    }

    return {
      ...merged,
      layouts,
      defaultLayout,
      companyProfile,
      payments,
      integrations,
      resilience,
    }
  }

  async listShippingOptions(): Promise<StorefrontShippingOptionDto[]> {
    const rows = await this.prisma.shippingOption.findMany({
      orderBy: { id: 'asc' },
    })

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      deliveryFees: Number(row.deliveryFees ?? 0),
      estimatedMin: row.estimatedMin ?? null,
      estimatedMax: row.estimatedMax ?? null,
      img: row.img ?? null,
    }))
  }

  async getCurrencySettings() {
    const enabledCurrencies = await this.currencyConversion.getEnabledCurrencies()
    const snapshot = await this.currencyConversion.buildRatesSnapshot(enabledCurrencies)
    const rates: Record<string, number> = {}
    for (const [currency, rate] of Object.entries(snapshot.rates)) {
      rates[currency] = Number(rate)
    }
    const uniqueCurrencies = Array.from(new Set([snapshot.base, ...enabledCurrencies]))

    return {
      baseCurrency: snapshot.base,
      enabledCurrencies: uniqueCurrencies,
      rates,
      generatedAt: snapshot.generatedAt,
    }
  }

  async getHomeLayout(key: string): Promise<HomeLayoutDefinition> {
    const layoutKey = key || FALLBACK_LAYOUT_KEY
    const config = await this.getConfig()
    const layout = config.layouts.find((candidate) => candidate.key === layoutKey)
    if (layout) return layout
    const fallback = DEFAULT_HOME_LAYOUTS.find((candidate) => candidate.key === layoutKey)
    if (fallback) return fallback
    throw new NotFoundException('Layout not found')
  }

  async listCategories(): Promise<StorefrontCategoryTree[]> {
    const categories = await this.prisma.productCategory.findMany({
      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true } } },
    })
    const nodes = new Map<number, StorefrontCategoryTree>()
    for (const category of categories) {
      const imageUrl = category.image ? String(category.image).trim() : null
      const productCount =
        category._count.products - (category.installServiceProductId ? 1 : 0)
      nodes.set(category.id, {
        id: category.id,
        slug: buildCategorySlug(category.id, category.name),
        name: category.name,
        description: category.description ?? null,
        thumbnail: imageUrl
          ? { id: `category-${category.id}`, url: imageUrl, alt: category.name }
          : null,
        productCount: Math.max(0, productCount),
        parentId: category.parentId ?? null,
        children: [],
      })
    }

    const roots: StorefrontCategoryTree[] = []
    for (const node of nodes.values()) {
      if (node.parentId !== null && nodes.has(node.parentId)) {
        nodes.get(node.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }

    const sortTree = (branch: StorefrontCategoryTree[]) => {
      branch.sort((a, b) => a.name.localeCompare(b.name))
      branch.forEach((child) => sortTree(child.children))
    }

    sortTree(roots)
    return roots
  }

  private async collectCategoryHierarchyIds(categoryId: number): Promise<number[]> {
    const categories = await this.prisma.productCategory.findMany({
      select: { id: true, parentId: true },
    })
    const exists = categories.some((category) => category.id === categoryId)
    if (!exists) {
      return []
    }
    const childrenMap = new Map<number, number[]>()
    for (const category of categories) {
      if (category.parentId !== null) {
        if (!childrenMap.has(category.parentId)) {
          childrenMap.set(category.parentId, [])
        }
        childrenMap.get(category.parentId)!.push(category.id)
      }
    }
    const result: number[] = []
    const stack: number[] = [categoryId]
    const visited = new Set<number>()
    while (stack.length > 0) {
      const current = stack.pop()!
      if (visited.has(current)) {
        continue
      }
      visited.add(current)
      result.push(current)
      const children = childrenMap.get(current)
      if (children && children.length) {
        stack.push(...children)
      }
    }
    return result
  }

  private collectCategoryHierarchyIdsFromRecords(
    categories: Array<{ id: number; parentId: number | null }>,
    categoryId: number,
  ): number[] {
    const exists = categories.some((category) => category.id === categoryId)
    if (!exists) {
      return []
    }

    const childrenMap = new Map<number, number[]>()
    for (const category of categories) {
      if (category.parentId !== null) {
        if (!childrenMap.has(category.parentId)) {
          childrenMap.set(category.parentId, [])
        }
        childrenMap.get(category.parentId)!.push(category.id)
      }
    }

    const result: number[] = []
    const stack: number[] = [categoryId]
    const visited = new Set<number>()

    while (stack.length > 0) {
      const current = stack.pop()!
      if (visited.has(current)) {
        continue
      }
      visited.add(current)
      result.push(current)
      const children = childrenMap.get(current)
      if (children?.length) {
        stack.push(...children)
      }
    }

    return result
  }

  private async resolveCategoryHierarchyIds(identifier?: string | null): Promise<number[] | null> {
    const trimmed = identifier?.trim()
    if (!trimmed) {
      return null
    }

    const categories = await this.prisma.productCategory.findMany({
      select: { id: true, name: true, parentId: true },
    })

    const normalized = trimmed.toLowerCase()
    const legacySlugMatch = normalized.match(/-(\d+)$/)
    const legacyCategoryId = legacySlugMatch ? Number.parseInt(legacySlugMatch[1], 10) : Number.NaN

    let matchedCategoryId: number | null = null
    if (Number.isFinite(legacyCategoryId) && legacyCategoryId > 0) {
      matchedCategoryId = categories.some((category) => category.id === legacyCategoryId)
        ? legacyCategoryId
        : null
    }

    if (matchedCategoryId === null) {
      const matchedCategory = categories.find((category) => {
        const currentSlug = buildCategorySlug(category.id, category.name).toLowerCase()
        const legacySlug = buildLegacyCategorySlug(category.id, category.name).toLowerCase()
        return (
          currentSlug === normalized ||
          legacySlug === normalized ||
          category.name.trim().toLowerCase() === normalized
        )
      })

      matchedCategoryId = matchedCategory?.id ?? null
    }

    if (matchedCategoryId === null) {
      return []
    }

    return this.collectCategoryHierarchyIdsFromRecords(categories, matchedCategoryId)
  }

  private async resolveStorefrontProductIdByIdentifier(identifier: string): Promise<number | null> {
    const trimmed = identifier.trim()
    if (!trimmed) {
      return null
    }

    const byId = parsePositiveInt(trimmed, -1)
    const baseWhere: Prisma.ProductWhereInput = {
      published: true,
      productType: ProductType.PHYSICAL,
    }

    if (byId > 0) {
      const productById = await this.prisma.product.findFirst({
        where: { ...baseWhere, id: byId },
        select: { id: true },
      })
      if (productById) {
        return productById.id
      }
    }

    const productByCode = await this.prisma.product.findFirst({
      where: {
        ...baseWhere,
        productCode: { equals: trimmed, mode: 'insensitive' },
      },
      select: { id: true },
    })

    if (productByCode) {
      return productByCode.id
    }

    const candidates = await this.prisma.product.findMany({
      where: baseWhere,
      select: { id: true, name: true, productCode: true },
    })

    const normalized = trimmed.toLowerCase()
    const product = candidates.find((candidate) => {
      const currentSlug = buildProductSlug(candidate.id, candidate.name, candidate.productCode ?? undefined).toLowerCase()
      const legacySlug = buildLegacyProductSlug(candidate.id, candidate.name, candidate.productCode ?? undefined).toLowerCase()
      return currentSlug === normalized || legacySlug === normalized
    })

    return product?.id ?? null
  }

  async listProducts(query: StorefrontProductQueryDto) {
    const page = parsePositiveInt(query.page, 1)
    const pageSize = Math.min(parsePositiveInt(query.pageSize, 12), 48)
    const where: Prisma.ProductWhereInput = { published: true, productType: ProductType.PHYSICAL }

    if (query.category) {
      const trimmed = query.category.trim()
      const categoryIds = await this.resolveCategoryHierarchyIds(trimmed)
      if (categoryIds && categoryIds.length > 0) {
        where.categoryId = categoryIds.length === 1 ? categoryIds[0] : { in: categoryIds }
      } else {
        const normalized = trimmed.toLowerCase()
        where.category = {
          OR: [
            { name: { equals: normalized, mode: 'insensitive' } },
            { name: { equals: trimmed, mode: 'insensitive' } },
          ],
        }
      }
    }

    if (query.search) {
      const term = query.search.trim()
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { productCode: { contains: term, mode: 'insensitive' } },
      ]
    }

    if (query.tag) {
      where.tags = { has: query.tag }
    }

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = []
    switch (query.sort) {
      case 'price-asc':
        orderBy.push({ salePrice: 'asc' })
        break
      case 'price-desc':
        orderBy.push({ salePrice: 'desc' })
        break
      case 'newest':
        orderBy.push({ createdAt: 'desc' })
        break
      default:
        orderBy.push({ name: 'asc' })
        break
    }

    const [total, products] = await this.prisma.$transaction([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          images: {
            where: { variantId: null },
            orderBy: { sortOrder: 'asc' },
          },
          category: true,
        },
      }),
    ])

    const publishedParametricDefinitions = await this.resolvePublishedParametricDefinitions(products)
    const data = products.map((product) =>
      this.toProductSummary(product, publishedParametricDefinitions.get(product.id) ?? null),
    )
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    return {
      data,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  async getProduct(identifier: string): Promise<ProductDetailDto> {
    const resolvedProductId = await this.resolveStorefrontProductIdByIdentifier(identifier)
    if (!resolvedProductId) {
      throw new NotFoundException('Product not found')
    }

    const where: Prisma.ProductWhereInput = {
      id: resolvedProductId,
      published: true,
      productType: ProductType.PHYSICAL,
    }

    let product: ProductWithVariants | null = null

    try {
      product = (await this.prisma.product.findFirst({
        where,
        include: {
          images: {
            where: { variantId: null },
            orderBy: { sortOrder: 'asc' },
          },
          category: true,
          options: {
            include: {
              values: {
                orderBy: { sortOrder: 'asc' },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
          variants: {
            include: {
              images: {
                orderBy: { sortOrder: 'asc' },
              },
              selections: {
                include: {
                  optionValue: {
                    include: {
                      option: true,
                    },
                  },
                },
              },
            },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      })) as ProductWithVariants | null
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2021') {
        const minimal = await this.prisma.product.findFirst({
          where,
          include: {
            images: {
              where: { variantId: null },
              orderBy: { sortOrder: 'asc' },
            },
            category: true,
          },
        })

        if (minimal) {
          this.logger.warn(
            `[storefront] Product option/variant tables missing; returning simplified product for identifier "${identifier}".`,
          )
          product = {
            ...minimal,
            options: [] as ProductWithVariants['options'],
            variants: [] as ProductWithVariants['variants'],
          } as ProductWithVariants
        }
      } else {
        throw error
      }
    }

    if (!product) {
      throw new NotFoundException('Product not found')
    }

    const publishedParametricDefinition =
      product.mode === ProductMode.PARAMETRIC
        ? await this.publishedProductResolver.resolvePublishedParametricProduct(product.id, product.currency)
        : null
    const detail = this.toProductDetail(product, publishedParametricDefinition)

    const related = await this.prisma.product.findMany({
      where: {
        published: true,
        id: { not: product.id },
        categoryId: product.categoryId ?? undefined,
        productType: ProductType.PHYSICAL,
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        images: {
          where: { variantId: null },
          orderBy: { sortOrder: 'asc' },
        },
        category: true,
      },
    })

    const relatedPublishedDefinitions = await this.resolvePublishedParametricDefinitions(related)
    detail.relatedProducts = related.map((item) =>
      this.toProductSummary(item, relatedPublishedDefinitions.get(item.id) ?? null),
    )
    return detail
  }

  async getRecommendations(productId: number, limit = 8): Promise<ProductSummaryDto[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
      },
    })
    if (!product || product.productType !== ProductType.PHYSICAL) {
      throw new NotFoundException('Product not found')
    }

    const items = await this.prisma.product.findMany({
      where: {
        published: true,
        id: { not: product.id },
        categoryId: product.categoryId ?? undefined,
        productType: ProductType.PHYSICAL,
      },
      take: limit,
      include: {
        images: {
          where: { variantId: null },
          orderBy: { sortOrder: 'asc' },
        },
        category: true,
      },
    })
    const publishedParametricDefinitions = await this.resolvePublishedParametricDefinitions(items)
    return items.map((item) =>
      this.toProductSummary(item, publishedParametricDefinitions.get(item.id) ?? null),
    )
  }

  private async resolveStorefrontParametricProductId(productId: number): Promise<number> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, mode: true },
    })

    if (!product) {
      throw new NotFoundException('Product not found')
    }

    const ownMatrixRows = await this.prisma.dimensionPriceMatrix.count({
      where: { productId },
    })

    if (ownMatrixRows > 0) {
      return productId
    }

    if (product.mode === ProductMode.PARAMETRIC) {
      return this.parametricPricing.getDefaultParametricProductId()
    }

    return productId
  }

  async getParametricProductConfig(productId: number) {
    const resolvedProductId = await this.resolveStorefrontParametricProductId(productId)
    return this.parametricPricing.getProductConfig(resolvedProductId)
  }

  async quoteParametricProduct(payload: Parameters<ParametricPricingService['quote']>[0]) {
    const resolvedProductId = await this.resolveStorefrontParametricProductId(payload.productId)
    const quoteInput: ParametricQuoteInput = {
      productId: resolvedProductId,
      familyId: this.normalizeConfigString((payload as any).familyId ?? ''),
      serie: this.normalizeConfigString((payload as any).serie ?? ''),
      material: this.normalizeConfigString((payload as any).material ?? ''),
      color: this.normalizeConfigString((payload as any).color ?? ''),
      vidrio: this.normalizeConfigString((payload as any).vidrio ?? ''),
      widthMm: this.normalizeConfigNumber((payload as any).widthMm, 'width'),
      heightMm: this.normalizeConfigNumber((payload as any).heightMm, 'height'),
      hasMosquitero: this.normalizeConfigBoolean((payload as any).hasMosquitero),
      hasShutterMonoblock: this.normalizeConfigBoolean((payload as any).hasShutterMonoblock),
      shutterMaterial: this.normalizeConfigString((payload as any).shutterMaterial ?? ''),
    }
    return this.parametricPricing.quote(quoteInput)
  }

  async prepareCheckoutSnapshot(dto: StorefrontCreateOrderDto): Promise<StorefrontCreateOrderDto> {
    const fulfillmentMode = dto.fulfillmentMode ?? 'home_delivery'

    if (fulfillmentMode !== 'home_delivery') {
      throw new BadRequestException('La modalidad de entrega seleccionada no está disponible.')
    }

    const normalizedCountry = (dto.shippingAddress.country ?? '').trim().toUpperCase()
    if (!['UY', 'URUGUAY'].includes(normalizedCountry)) {
      throw new BadRequestException('Actualmente solo se admiten entregas en Uruguay.')
    }

    if (dto.shippingOptionId === undefined || dto.shippingOptionId === null) {
      throw new BadRequestException('Debes seleccionar una opción de entrega para continuar.')
    }

    const shippingOptionId = Number(dto.shippingOptionId)
    if (!Number.isFinite(shippingOptionId) || shippingOptionId <= 0) {
      throw new BadRequestException('La opción de envío seleccionada no existe.')
    }

    const shippingOption = await this.prisma.shippingOption.findUnique({
      where: { id: shippingOptionId },
      select: { id: true },
    })

    if (!shippingOption) {
      throw new BadRequestException('La opción de envío seleccionada no existe.')
    }

    const productIds = dto.items.map((item) => item.productId)
    const uniqueProductIds = Array.from(new Set(productIds))
    const products = await this.prisma.product.findMany({
      where: { id: { in: uniqueProductIds }, published: true },
      select: {
        id: true,
        name: true,
        mode: true,
        currency: true,
        productCode: true,
      },
    })

    if (products.length !== uniqueProductIds.length) {
      throw new BadRequestException('One or more products are unavailable')
    }

    const productById = new Map(products.map((product) => [product.id, product]))

    const variantIds = dto.items
      .map((item) => (item.variantId ? Number(item.variantId) : null))
      .filter((id): id is number => Number.isFinite(id) && id! > 0)

    const variants = variantIds.length
      ? await this.prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: {
            id: true,
            productId: true,
            isActive: true,
          },
        })
      : []

    const variantById = new Map(variants.map((variant) => [variant.id, variant]))

    const normalizedItems = await Promise.all(
      dto.items.map(async (item) => {
        const product = productById.get(item.productId)
        if (!product) {
          throw new BadRequestException('One or more products are unavailable')
        }

        const quantity = Math.max(1, Number(item.quantity ?? 1))
        const variantId =
          item.variantId !== undefined && item.variantId !== null ? Number(item.variantId) : null
        const variant = variantId ? variantById.get(variantId) ?? null : null

        if (variantId && !variant) {
          throw new BadRequestException('Selected product variant is invalid or unavailable.')
        }

        if (product.mode === ProductMode.VARIABLE && !variant) {
          throw new BadRequestException('A product variant must be selected for this item.')
        }

        if (variant) {
          if (variant.productId !== product.id) {
            throw new BadRequestException('Invalid product variant selected for this product.')
          }

          if (!variant.isActive) {
            throw new BadRequestException('Selected variant is not currently available.')
          }
        }

        if (product.mode === ProductMode.PARAMETRIC) {
          const publishedVariant = await this.resolvePublishedParametricConfiguration(
            product.id,
            item.configuration && typeof item.configuration === 'object'
              ? (item.configuration as Record<string, unknown>)
              : null,
            product.currency,
          )
          if (publishedVariant) {
            return {
              productId: product.id,
              quantity,
              configuration: publishedVariant.configuration,
            }
          }

          if (!item.configuration || typeof item.configuration !== 'object') {
            throw new BadRequestException('Parametric configuration is required for this product.')
          }

          const rawConfig = item.configuration as Record<string, unknown>
          const resolvedProductId = await this.resolveStorefrontParametricProductId(product.id)
          const quote = await this.parametricPricing.quote({
            productId: resolvedProductId,
            familyId: this.normalizeConfigString(
              rawConfig.familyId ?? rawConfig.family_id ?? product.productCode ?? product.name,
            ),
            serie: this.normalizeConfigString(rawConfig.series ?? rawConfig.serie),
            material: this.normalizeConfigString(rawConfig.material ?? 'ALUMINIO'),
            color: this.normalizeConfigString(rawConfig.color ?? 'NATURAL'),
            vidrio: this.normalizeConfigString(rawConfig.vidrio ?? rawConfig.glass ?? '4 MM'),
            widthMm: this.normalizeConfigNumber(rawConfig.widthMm ?? rawConfig.width_mm ?? rawConfig.width, 'width'),
            heightMm: this.normalizeConfigNumber(
              rawConfig.heightMm ?? rawConfig.height_mm ?? rawConfig.height,
              'height',
            ),
            hasMosquitero: this.normalizeConfigBoolean(
              rawConfig.hasMosquitero ?? rawConfig.mosquitoNet ?? rawConfig.mosquitero,
            ),
            hasShutterMonoblock: this.normalizeConfigBoolean(
              rawConfig.hasShutterMonoblock ??
                rawConfig.monoblock ??
                rawConfig.has_monoblock ??
                rawConfig.monoblockEnabled,
            ),
            shutterMaterial: this.normalizeConfigString(
              rawConfig.shutterMaterial ??
                rawConfig.shutter_material ??
                rawConfig.shutterSystem ??
                rawConfig.shutter_system ??
                rawConfig.monoblockSystem ??
                rawConfig.monoblockMaterial ??
                '',
            ),
          })

          if (!quote.available || quote.price === undefined) {
            throw new BadRequestException('Selected configuration is not available.')
          }

          return {
            productId: product.id,
            quantity,
            configuration: {
              familyId: quote.requested.familyId ?? null,
              serie: quote.requested.serie,
              material: quote.requested.material,
              color: quote.requested.color,
              vidrio: quote.requested.vidrio,
              widthMm: quote.requested.widthMm,
              heightMm: quote.requested.heightMm,
              hasMosquitero: quote.requested.hasMosquitero,
              hasShutterMonoblock: quote.requested.hasShutterMonoblock,
              shutterMaterial: quote.requested.shutterMaterial ?? '',
              currency: quote.currency ?? product.currency ?? null,
              referenceDate: quote.referenceDate ?? null,
              source: quote.source ?? null,
              matrixRowId: quote.matrixRowId ?? null,
              specifications: quote.specifications ?? null,
            },
          }
        }

        return {
          productId: product.id,
          quantity,
          ...(variant ? { variantId: variant.id } : {}),
        }
      }),
    )

    const normalizeAddress = (address: StorefrontCreateOrderDto['shippingAddress']) => ({
      line1: this.normalizeConfigString(address.line1),
      line2: this.normalizeConfigString(address.line2 ?? '') || undefined,
      city: this.normalizeConfigString(address.city),
      state: this.normalizeConfigString(address.state ?? '') || undefined,
      zip: this.normalizeConfigString(address.zip),
      country: normalizedCountry,
    })

    return {
      customer: {
        email: normalizeEmail(dto.customer.email),
        firstName: this.normalizeConfigString(dto.customer.firstName),
        lastName: this.normalizeConfigString(dto.customer.lastName),
        phone: sanitizePhoneInput(dto.customer.phone) ?? undefined,
        locale: dto.customer.locale ? normalizeLocalePreference(dto.customer.locale) : undefined,
      },
      shippingAddress: normalizeAddress(dto.shippingAddress),
      ...(dto.billingAddress ? { billingAddress: normalizeAddress(dto.billingAddress) } : {}),
      items: normalizedItems,
      notes: this.normalizeConfigString(dto.notes ?? '') || undefined,
      paymentIntentId: this.normalizeConfigString(dto.paymentIntentId ?? '') || undefined,
      checkoutToken: this.normalizeConfigString(dto.checkoutToken ?? '') || undefined,
      shippingOptionId,
      fulfillmentMode,
      currency: this.currencyConversion.normalizeCurrency(dto.currency) ?? undefined,
    }
  }

  private async ensureDefaultPasswordHash() {
    if (this.defaultCustomerPasswordHash) {
      return
    }

    const configured = this.config.get<string>('STOREFRONT_GENERIC_CUSTOMER_PASSWORD')?.trim()
    const fallback = 'Storefront@2024'

    if (!configured || configured.length < 8) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new Error('STOREFRONT_GENERIC_CUSTOMER_PASSWORD must be configured with at least 8 characters in production.')
      }
      console.warn('[storefront] Using fallback STOREFRONT_GENERIC_CUSTOMER_PASSWORD for development. Set a custom value in your environment to override it.')
      this.defaultCustomerPassword = fallback
    } else {
      this.defaultCustomerPassword = configured
    }

    this.defaultCustomerPasswordHash = await bcrypt.hash(this.defaultCustomerPassword, 12)
  }

  private async findCustomerByIdentifier(identifier: string): Promise<Customer | null> {
    const trimmed = identifier.trim()
    if (!trimmed) {
      return null
    }

    if (isEmailIdentifier(trimmed)) {
      const email = normalizeEmail(trimmed)
      if (!email) return null
      return this.prisma.customer.findUnique({ where: { email } })
    }

    const phone = sanitizePhoneInput(trimmed)
    if (!phone) {
      return null
    }

    return this.prisma.customer.findFirst({
      where: {
        phoneNumber: {
          in: buildPhoneLookupCandidates(phone),
        },
      },
    })
  }

  private async verifyCustomerPassword(customer: Customer, password: string): Promise<{ valid: boolean; usingDefault: boolean }> {
    if (customer.passwordHash) {
      const matchesPrimary = await bcrypt.compare(password, customer.passwordHash)
      if (matchesPrimary) {
        return { valid: true, usingDefault: false }
      }
    }

    if (customer.storefrontDefaultPasswordHash) {
      const matchesDefault = await bcrypt.compare(password, customer.storefrontDefaultPasswordHash)
      if (matchesDefault) {
        return { valid: true, usingDefault: true }
      }
    }

    return { valid: false, usingDefault: false }
  }

  async registerCustomer(dto: StorefrontRegisterDto) {
    await this.ensureDefaultPasswordHash()

    const email = dto.email ? normalizeEmail(dto.email) : null
    const phone = sanitizePhoneInput(dto.phone)

    if (!dto.phone?.trim().length) {
      throw new BadRequestException('Phone number is required')
    }

    if (!phone) {
      throw new BadRequestException('Invalid phone number')
    }

    const [existingByEmail, existingByPhone] = await Promise.all([
      email ? this.prisma.customer.findUnique({ where: { email } }) : Promise.resolve(null),
      phone
        ? this.prisma.customer.findFirst({
            where: {
              phoneNumber: {
                in: buildPhoneLookupCandidates(phone),
              },
            },
          })
        : Promise.resolve(null),
    ])

    if (existingByEmail && existingByPhone && existingByEmail.id !== existingByPhone.id) {
      throw new ConflictException('Customer already exists')
    }

    const existing = existingByEmail ?? existingByPhone
    if (existing?.passwordHash) {
      throw new ConflictException('Customer already exists')
    }

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const preferredLocale = dto.locale ? normalizeLocalePreference(dto.locale) : undefined
    const customer = existing
      ? await this.prisma.customer.update({
          where: { id: existing.id },
          data: {
            ...(email ? { email } : {}),
            firstName: dto.firstName,
            lastName: dto.lastName,
            name: `${dto.firstName} ${dto.lastName}`.trim(),
            passwordHash,
            storefrontDefaultPasswordHash: null,
            passwordAlgorithm: 'bcrypt',
            passwordAlgVersion: 12,
            passwordUpdatedAt: new Date(),
            ...(phone ? { phoneNumber: phone } : {}),
            ...(preferredLocale ? { preferredLocale } : {}),
          },
        })
      : await this.prisma.customer.create({
          data: {
            email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            name: `${dto.firstName} ${dto.lastName}`.trim(),
            passwordHash,
            storefrontDefaultPasswordHash: null,
            passwordAlgorithm: 'bcrypt',
            passwordAlgVersion: 12,
            passwordUpdatedAt: new Date(),
            ...(phone ? { phoneNumber: phone } : {}),
            preferredLocale: preferredLocale ?? 'es',
          },
        })

    return this.createSessionForCustomer(customer)
  }

  async login(dto: StorefrontLoginDto) {
    await this.ensureDefaultPasswordHash()

    const customer = await this.findCustomerByIdentifier(dto.identifier)
    if (!customer) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const { valid, usingDefault } = await this.verifyCustomerPassword(customer, dto.password)
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const updateData: Prisma.CustomerUpdateInput = { updatedAt: new Date() }
    if (!usingDefault) {
      updateData.storefrontDefaultPasswordHash = null
    } else if (!customer.storefrontDefaultPasswordHash) {
      updateData.storefrontDefaultPasswordHash = this.defaultCustomerPasswordHash
    }

    const updated = await this.prisma.customer.update({
      where: { id: customer.id },
      data: updateData,
    })

    return this.createSessionForCustomer(updated)
  }

  async refreshSession(dto: StorefrontRefreshDto) {
    try {
      const payload = (await this.jwt.verifyAsync(dto.refreshToken)) as Record<string, unknown>
      if (payload.scope !== 'storefront' || payload.tokenType !== 'refresh' || typeof payload.sub !== 'number') {
        throw new UnauthorizedException('Invalid token')
      }

      const customer = await this.prisma.customer.findUnique({ where: { id: payload.sub } })
      if (!customer) {
        throw new UnauthorizedException('Customer not found')
      }
      const tokenVersion = typeof payload.ver === 'number' ? payload.ver : null
      if (tokenVersion !== null && tokenVersion !== customer.storefrontSessionVersion) {
        throw new UnauthorizedException('Session expired')
      }
      return this.createSessionForCustomer(customer)
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  async getSessionFromRequest(
    req: FastifyRequest,
  ): Promise<{ session: StorefrontAuthSession; refreshed: boolean }> {
    const accessToken = req.cookies?.storefront_access_token ?? null
    const refreshTokenCookie = req.cookies?.storefront_refresh_token ?? null
    let accessTokenFailed = false

    if (accessToken) {
      try {
        const payload = (await this.jwt.verifyAsync(accessToken)) as Record<string, unknown>
        if (payload.scope !== 'storefront' || payload.tokenType !== 'access') {
          throw new UnauthorizedException('Invalid token')
        }

        const customerId =
          typeof payload.sub === 'number'
            ? payload.sub
            : typeof payload.sub === 'string'
              ? Number.parseInt(payload.sub, 10)
              : Number.NaN

        if (!Number.isFinite(customerId)) {
          throw new UnauthorizedException('Invalid token subject')
        }

        const customer = await this.prisma.customer.findUnique({ where: { id: customerId } })
        if (!customer) {
          throw new UnauthorizedException('Customer not found')
        }

        const tokenVersion = typeof payload.ver === 'number' ? payload.ver : null
        if (tokenVersion !== null && tokenVersion !== customer.storefrontSessionVersion) {
          throw new UnauthorizedException('Session expired')
        }

        const [addresses, wishlistSummary] = await Promise.all([
          this.prisma.customerAddress.findMany({
            where: { customerId: customer.id },
            orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
          }),
          this.getWishlistSummary(customer.id),
        ])

        const expiresAt =
          typeof payload.exp === 'number'
            ? new Date(payload.exp * 1000).toISOString()
            : new Date(Date.now() + 15 * 60 * 1000).toISOString()

        return {
          refreshed: false,
          session: {
            accessToken,
            refreshToken: refreshTokenCookie ?? null,
            expiresAt,
            customer: {
              id: customer.id,
              email: customer.email ?? '',
              firstName: customer.firstName,
              lastName: customer.lastName,
              phone: customer.phoneNumber ?? undefined,
              preferredLocale: getPreferredLocale(customer),
              wishlistCount: wishlistSummary.count,
              wishlistProductIds: wishlistSummary.productIds,
              addresses: addresses.map((address) => this.toCustomerAddress(address)),
            },
          },
        }
      } catch (error) {
        accessTokenFailed = true
      }
    }

    if (refreshTokenCookie) {
      try {
        const session = await this.refreshSession({ refreshToken: refreshTokenCookie })
        return { session, refreshed: true }
      } catch (error) {
        throw new UnauthorizedException('Invalid session')
      }
    }

    if (accessTokenFailed) {
      throw new UnauthorizedException('Invalid session')
    }

    throw new UnauthorizedException('Not authenticated')
  }

  async createOrder(dto: StorefrontCreateOrderDto) {
    const email = normalizeEmail(dto.customer.email)
    const phone = sanitizePhoneInput(dto.customer.phone)
    await this.ensureDefaultPasswordHash()

    if (dto.paymentIntentId) {
      const intentRecord = await this.prisma.storefrontPaymentIntent.findUnique({
        where: { id: dto.paymentIntentId },
        select: { orderId: true },
      })

      if (!intentRecord) {
        throw new BadRequestException('El pago no existe o venció. Vuelve a intentarlo.')
      }

      if (intentRecord.orderId) {
        const existingOrder = await this.prisma.order.findUnique({
          where: { id: intentRecord.orderId },
          include: {
            items: true,
            payments: true,
            storefrontPayments: true,
          },
        })

        if (existingOrder) {
          return this.toOrderSummary(existingOrder)
        }
      }
    }

    const normalizedCheckoutToken =
      typeof dto.checkoutToken === 'string' && dto.checkoutToken.trim().length > 0
        ? dto.checkoutToken.trim()
        : null
    const checkoutUuid = normalizedCheckoutToken ? generateCheckoutUuid(normalizedCheckoutToken) : null

    let order: OrderWithRelations | null = null
    let isNewOrder = false
    const fulfillmentMode = dto.fulfillmentMode ?? 'home_delivery'

    if (fulfillmentMode !== 'home_delivery') {
      throw new BadRequestException('La modalidad de entrega seleccionada no está disponible.')
    }

    const normalizedCountry = (dto.shippingAddress.country ?? '').trim().toUpperCase()
    if (!['UY', 'URUGUAY'].includes(normalizedCountry)) {
      throw new BadRequestException('Actualmente solo se admiten entregas en Uruguay.')
    }

    if (checkoutUuid) {
      order = await this.prisma.order.findUnique({
        where: { uuid: checkoutUuid },
        include: {
          items: true,
          payments: true,
          storefrontPayments: true,
        },
      })
    }

    let customer = await this.prisma.customer.findUnique({ where: { email } })
    const localePreference = dto.customer.locale ? normalizeLocalePreference(dto.customer.locale) : null
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          email,
          firstName: dto.customer.firstName,
          lastName: dto.customer.lastName,
          name: `${dto.customer.firstName} ${dto.customer.lastName}`.trim(),
          phoneNumber: phone,
          storefrontDefaultPasswordHash: this.defaultCustomerPasswordHash,
          phones: dto.customer.phone
            ? {
                create: [{ phone: phone ?? dto.customer.phone }],
              }
            : undefined,
          preferredLocale: localePreference ?? 'es',
        },
      })
    } else if (!customer.passwordHash && !customer.storefrontDefaultPasswordHash) {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          storefrontDefaultPasswordHash: this.defaultCustomerPasswordHash,
          ...(phone && !customer.phoneNumber ? { phoneNumber: phone } : {}),
          ...(localePreference && getPreferredLocale(customer) !== localePreference
            ? { preferredLocale: localePreference }
            : {}),
        },
      })
    } else if (phone && !customer.phoneNumber) {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          phoneNumber: phone,
          ...(localePreference && getPreferredLocale(customer) !== localePreference
            ? { preferredLocale: localePreference }
            : {}),
        },
      })
    } else if (localePreference && getPreferredLocale(customer) !== localePreference) {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: { preferredLocale: localePreference },
      })
    }

    customer = await this.syncCustomerProfileFromCheckout(customer, dto)

    const productIds = dto.items.map((item) => item.productId)
    const uniqueProductIds = Array.from(new Set(productIds))
    const products = await this.prisma.product.findMany({
      where: { id: { in: uniqueProductIds }, published: true },
      include: {
        images: {
          where: { variantId: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
    })
    if (products.length !== uniqueProductIds.length) {
      throw new BadRequestException('One or more products are unavailable')
    }
    const productById = new Map(products.map((product) => [product.id, product]))

    const variantIds = dto.items
      .map((item) => (item.variantId ? Number(item.variantId) : null))
      .filter((id): id is number => Number.isFinite(id) && id! > 0)

    const variants = variantIds.length
      ? await this.prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          include: {
            product: true,
            images: { orderBy: { sortOrder: 'asc' } },
            selections: {
              include: {
                optionValue: {
                  include: {
                    option: true,
                  },
                },
              },
            },
          },
        })
      : []
    const variantById = new Map(variants.map((variant) => [variant.id, variant]))

    const rawLineItems = await Promise.all(
      dto.items.map(async (item) => {
        const product = productById.get(item.productId)
        if (!product) {
          throw new BadRequestException('One or more products are unavailable')
        }

        let priceCurrency = this.currencyConversion.normalizeCurrency(product.currency)
        let costCurrency = priceCurrency

        const variantId =
          item.variantId !== undefined && item.variantId !== null ? Number(item.variantId) : null
        const variant = variantId ? variantById.get(variantId) ?? null : null

        if (variantId && !variant) {
          throw new BadRequestException('Selected product variant is invalid or unavailable.')
        }

        if (product.mode === ProductMode.VARIABLE && !variant) {
          throw new BadRequestException('A product variant must be selected for this item.')
        }

        if (variant) {
          if (variant.productId !== product.id) {
            throw new BadRequestException('Invalid product variant selected for this product.')
          }
          if (!variant.isActive) {
            throw new BadRequestException('Selected variant is not currently available.')
          }
        }

        const quantity = Math.max(1, Number(item.quantity ?? 1))
        const baseSalePrice = decimalToNumber(product.salePrice)
        const baseCostPrice = decimalToNumber(product.costPrice)

        let unitPrice = decimal(baseSalePrice)
        let unitCost = decimal(baseCostPrice)
        let salePriceAmount = baseSalePrice
        let costPriceAmount = baseCostPrice
        let specEntries: { label: string; value: string }[] = []
        let specSummary = ''
        let primaryImage = product.images?.[0]?.img ?? null
        let displayName = product.name
        let skuSnapshot = product.productCode ?? undefined
        let parametricSnapshot: Awaited<ReturnType<ParametricPricingService['quote']>> | null = null
        let parametricConfig: Record<string, unknown> | undefined

        if (product.mode === ProductMode.PARAMETRIC) {
          const publishedParametricVariant = await this.resolvePublishedParametricConfiguration(
            product.id,
            item.configuration && typeof item.configuration === 'object'
              ? (item.configuration as Record<string, unknown>)
              : null,
            product.currency,
          )
          if (publishedParametricVariant) {
            salePriceAmount = publishedParametricVariant.price
            unitPrice = decimal(publishedParametricVariant.price)
            specEntries = publishedParametricVariant.specifications
            specSummary = specEntries.map((entry) => `${entry.label}: ${entry.value}`).join('\n')
            displayName = product.name
            skuSnapshot = product.productCode ?? undefined
            parametricConfig = publishedParametricVariant.configuration
            priceCurrency =
              this.currencyConversion.normalizeCurrency(publishedParametricVariant.currency ?? product.currency) ??
              priceCurrency
          } else {
            if (!item.configuration || typeof item.configuration !== 'object') {
              throw new BadRequestException('Parametric configuration is required for this product.')
            }

            const rawConfig = item.configuration as Record<string, unknown>
            const quoteInput: ParametricQuoteInput = {
              productId: product.id,
              familyId: this.normalizeConfigString(
                rawConfig.familyId ?? rawConfig.family_id ?? product.productCode ?? product.name,
              ),
              serie: this.normalizeConfigString(rawConfig.series ?? rawConfig.serie),
              material: this.normalizeConfigString(rawConfig.material ?? 'ALUMINIO'),
              color: this.normalizeConfigString(rawConfig.color ?? 'NATURAL'),
              vidrio: this.normalizeConfigString(rawConfig.vidrio ?? rawConfig.glass ?? '4 MM'),
              widthMm: this.normalizeConfigNumber(rawConfig.widthMm ?? rawConfig.width_mm ?? rawConfig.width, 'width'),
              heightMm: this.normalizeConfigNumber(rawConfig.heightMm ?? rawConfig.height_mm ?? rawConfig.height, 'height'),
              hasMosquitero: this.normalizeConfigBoolean(
                rawConfig.hasMosquitero ?? rawConfig.mosquitoNet ?? rawConfig.mosquitero,
              ),
              hasShutterMonoblock: this.normalizeConfigBoolean(
                rawConfig.hasShutterMonoblock ??
                  rawConfig.monoblock ??
                  rawConfig.has_monoblock ??
                  rawConfig.monoblockEnabled,
              ),
              shutterMaterial: this.normalizeConfigString(
                rawConfig.shutterMaterial ??
                  rawConfig.shutter_material ??
                  rawConfig.shutterSystem ??
                  rawConfig.shutter_system ??
                  rawConfig.monoblockSystem ??
                  rawConfig.monoblockMaterial ??
                  '',
              ),
            }
            const quote = await this.parametricPricing.quote(quoteInput)
            parametricSnapshot = quote
            if (!quote.available || quote.price === undefined) {
              throw new BadRequestException('Selected configuration is not available.')
            }
            salePriceAmount = quote.price
            unitPrice = decimal(quote.price)
            unitCost = decimal(baseCostPrice)
            priceCurrency = this.currencyConversion.normalizeCurrency(quote.currency ?? product.currency) ?? priceCurrency
            const widthMm = quote.requested.widthMm
            const heightMm = quote.requested.heightMm
            specEntries = [
              { label: 'Serie', value: quote.requested.serie || 'N/A' },
              { label: 'Material', value: quote.requested.material || 'N/A' },
              { label: 'Color', value: quote.requested.color || 'NATURAL' },
              { label: 'Vidrio', value: quote.requested.vidrio || '4 MM' },
              { label: 'Ancho', value: `${widthMm} mm` },
              { label: 'Alto', value: `${heightMm} mm` },
              {
                label: 'Mosquitero',
                value: quote.requested.hasMosquitero ? 'Sí' : 'No',
              },
            ]
            if (quote.requested.hasShutterMonoblock) {
              specEntries.push({
                label: 'Material Monoblock',
                value: quote.requested.shutterMaterial || 'N/A',
              })
            }
            specSummary = specEntries.map((entry) => `${entry.label}: ${entry.value}`).join('\n')
            displayName = `${product.name} (${widthMm}x${heightMm} mm)`
            const skuBase = (product.productCode ?? slugify(product.name)).toUpperCase().replace(/[^A-Z0-9]/g, '')
            const typeCode = this.buildProductTypeCode(quote.requested.familyId)
            const widthKey = Math.round(widthMm)
            const heightKey = Math.round(heightMm)
            const skuParts = [typeCode, skuBase, `${widthKey}x${heightKey}`].filter(
              (part) => typeof part === 'string' && part.length > 0,
            )
            skuSnapshot = skuParts.join('-')
            parametricConfig = {
              ...quote.requested,
              price: quote.price,
              currency: quote.currency ?? product.currency ?? priceCurrency,
              detailSnapshot: quote.detailSnapshot ?? null,
              referenceDate: quote.referenceDate ?? null,
            }
          }
        } else {
          salePriceAmount =
            variant && variant.salePrice !== null && variant.salePrice !== undefined
              ? decimalToNumber(variant.salePrice)
              : baseSalePrice
          costPriceAmount =
            variant && variant.costPrice !== null && variant.costPrice !== undefined
              ? decimalToNumber(variant.costPrice)
              : baseCostPrice
          unitPrice = decimal(salePriceAmount)
          unitCost = decimal(costPriceAmount)
          const variantStock =
            variant && variant.stock !== null && variant.stock !== undefined
              ? variant.stock
              : product.stock ?? 0
          const variantPermanent =
            variant && variant.permanentStock !== null && variant.permanentStock !== undefined
              ? variant.permanentStock
              : product.permanentStock ?? false
          if (variant && !variantPermanent && Number(variantStock ?? 0) <= 0) {
            throw new BadRequestException('Selected variant is out of stock.')
          }

          specEntries =
            variant?.selections.map((selection) => ({
              label: selection.optionValue.option.name,
              value: selection.optionValue.label,
            })) ?? []
          specSummary = specEntries.map((entry) => `${entry.label}: ${entry.value}`).join('\n')
          primaryImage = variant?.images[0]?.img ?? product.images?.[0]?.img ?? null
          displayName = variant?.label ? `${product.name} - ${variant.label}` : product.name
          skuSnapshot = variant?.sku ?? product.productCode ?? undefined
        }

        costCurrency = costCurrency ?? priceCurrency

        return {
          product,
          variant,
          quantity,
          unitPrice,
          unitCost,
          salePriceAmount,
          costPriceAmount,
          specEntries,
          specSummary,
          image: primaryImage,
          nameSnapshot: displayName,
          skuSnapshot,
          parametricSnapshot,
          parametricConfig,
          priceCurrency: priceCurrency ?? null,
          costCurrency: costCurrency ?? priceCurrency ?? null,
        }
      }),
    )

    const enabledCurrencies = await this.currencyConversion.getEnabledCurrencies()
    const baseCurrency = await this.currencyConversion.getBaseCurrency()
    const requestedCurrency = dto.currency ? this.currencyConversion.normalizeCurrency(dto.currency) : null
    const lineItemCurrencies = rawLineItems
      .map((item) => item.priceCurrency)
      .filter((code): code is string => Boolean(code))

    let orderCurrency =
      requestedCurrency && enabledCurrencies.includes(requestedCurrency)
        ? requestedCurrency
        : null

    if (!orderCurrency) {
      orderCurrency =
        lineItemCurrencies.find((code) => enabledCurrencies.includes(code)) ??
        lineItemCurrencies[0] ??
        (enabledCurrencies.includes(baseCurrency) ? baseCurrency : baseCurrency)
    }

    if (!orderCurrency) {
      orderCurrency = baseCurrency || 'USD'
    }

    const requiredCurrencies = new Set<string>([orderCurrency, baseCurrency])
    lineItemCurrencies.forEach((code) => code && requiredCurrencies.add(code))
    rawLineItems
      .map((item) => item.costCurrency)
      .filter((code): code is string => Boolean(code))
      .forEach((code) => requiredCurrencies.add(code))

    const fxSnapshot = await this.currencyConversion.buildRatesSnapshot(Array.from(requiredCurrencies))
    const fxRatesPayload = {
      base: fxSnapshot.base,
      generatedAt: fxSnapshot.generatedAt,
      rates: Object.fromEntries(
        Object.entries(fxSnapshot.rates).map(([code, rate]) => [code, rate.toString()]),
      ),
    }

    const convertAmount = (amount: Prisma.Decimal, fromCurrency: string | null | undefined) => {
      const normalizedFrom = this.currencyConversion.normalizeCurrency(fromCurrency) ?? orderCurrency
      if (normalizedFrom === orderCurrency) {
        return { amount, rate: decimal(1) }
      }
      return this.currencyConversion.convertWithSnapshot(
        amount.toString(),
        normalizedFrom,
        orderCurrency,
        fxSnapshot,
        { amountScale: 4, rateScale: 8 },
      )
    }

    const lineItems = rawLineItems.map((item) => {
      const priceConversion = convertAmount(item.unitPrice, item.priceCurrency ?? orderCurrency)
      const costConversion = convertAmount(
        item.unitCost,
        item.costCurrency ?? item.priceCurrency ?? orderCurrency,
      )
      return {
        ...item,
        orderCurrencyUnitPrice: priceConversion.amount,
        priceConversionRate: priceConversion.rate,
        orderCurrencyUnitCost: costConversion.amount,
        costConversionRate: costConversion.rate,
        priceCurrency: this.currencyConversion.normalizeCurrency(item.priceCurrency) ?? orderCurrency,
        costCurrency:
          this.currencyConversion.normalizeCurrency(item.costCurrency) ??
          this.currencyConversion.normalizeCurrency(item.priceCurrency) ??
          orderCurrency,
      }
    })

    const selectedPaymentMethod = dto.paymentIntentId
      ? findPaymentMethodByCode('mercado_pago')
      : findPaymentMethodByCode('cash')
    const shippingOption =
      dto.shippingOptionId !== undefined && dto.shippingOptionId !== null
        ? await this.prisma.shippingOption.findUnique({
            where: { id: Number(dto.shippingOptionId) },
          })
        : null

    if (dto.shippingOptionId !== undefined && dto.shippingOptionId !== null && !shippingOption) {
      throw new BadRequestException('La opción de envío seleccionada no existe.')
    }

    if (!shippingOption) {
      throw new BadRequestException('Debes seleccionar una opción de entrega para continuar.')
    }

    const deliveryFeesDecimal = decimal(Number(shippingOption?.deliveryFees ?? 0)).toDecimalPlaces(2)
    const grossSubtotalDecimal = lineItems.reduce(
      (sum, item) => sum.plus(item.orderCurrencyUnitPrice.times(item.quantity)),
      decimal(0),
    )
    const taxRatePercentRaw = Number(products[0]?.taxRate ?? 0)
    const taxRateDecimal = decimal(taxRatePercentRaw).dividedBy(100)

    let netSubtotalDecimal = grossSubtotalDecimal
    let taxDecimal = decimal(0)

    if (taxRateDecimal.greaterThan(0)) {
      const divisor = decimal(1).plus(taxRateDecimal)
      const netSubtotal = grossSubtotalDecimal.dividedBy(divisor)
      const netRounded = netSubtotal.toDecimalPlaces(2)
      const taxRounded = grossSubtotalDecimal.minus(netRounded).toDecimalPlaces(2)
      netSubtotalDecimal = netRounded
      taxDecimal = taxRounded
    }

    const grandTotalDecimal = grossSubtotalDecimal.plus(deliveryFeesDecimal).toDecimalPlaces(2)

    if (!order) {
      try {
        order = await this.prisma.$transaction(async (tx) => {
          await this.stockIntegrity.commitStorefrontItems(lineItems, tx)

          return tx.order.create({
            data: {
              ...(checkoutUuid ? { uuid: checkoutUuid } : {}),
              documentType: DocumentType.ORDER,
              customer: { connect: { id: customer.id } },
              date: new Date(),
              shippingAddress1: dto.shippingAddress.line1,
              shippingAddress2: dto.shippingAddress.line2,
              shippingCity: dto.shippingAddress.city,
              shippingState: dto.shippingAddress.state,
              shippingZip: dto.shippingAddress.zip,
              billingAddress1: dto.billingAddress?.line1 ?? dto.shippingAddress.line1,
              billingAddress2: dto.billingAddress?.line2 ?? dto.shippingAddress.line2,
              billingCity: dto.billingAddress?.city ?? dto.shippingAddress.city,
              billingState: dto.billingAddress?.state ?? dto.shippingAddress.state,
              billingZip: dto.billingAddress?.zip ?? dto.shippingAddress.zip,
              shippingVendor: shippingOption?.name ?? null,
              deliveryFees: deliveryFeesDecimal,
              estimatedMin: shippingOption?.estimatedMin ?? null,
              estimatedMax: shippingOption?.estimatedMax ?? null,
              subTotal: netSubtotalDecimal.toDecimalPlaces(2),
              tax: taxDecimal.toDecimalPlaces(2),
              grandTotal: grandTotalDecimal.toDecimalPlaces(2),
              orderCurrency,
              fxBase: fxSnapshot.base,
              fxRates: fxRatesPayload,
              currencySnapshot: orderCurrency,
              exchangeRateSnapshot: fxRatesPayload,
              comment: dto.notes,
              paymentMethodId: selectedPaymentMethod?.id ?? null,
              statusId: ORDER_STATUS_CODES.PENDING,
              items: {
                create: lineItems.map((item) => ({
                  product: { connect: { id: item.product.id } },
                  ...(item.variant ? { variant: { connect: { id: item.variant.id } } } : {}),
                  name: item.nameSnapshot,
                  qty: item.quantity,
                  price: item.orderCurrencyUnitPrice.toDecimalPlaces(2),
                  unitCurrency: orderCurrency,
                  unitAmount: item.orderCurrencyUnitPrice.toDecimalPlaces(4),
                  unitAmountOrderCurrency: item.orderCurrencyUnitPrice.toDecimalPlaces(4),
                  conversionRate: item.priceConversionRate.toDecimalPlaces(8),
                  unitPriceSnapshot: item.orderCurrencyUnitPrice.toDecimalPlaces(4),
                  unitCostAmount: item.unitCost.toDecimalPlaces(4),
                  unitCostCurrency: item.costCurrency,
                  unitCostOrderCurrency: item.orderCurrencyUnitCost.toDecimalPlaces(4),
                  skuSnapshot: item.skuSnapshot,
                  nameSnapshot: item.nameSnapshot,
                  img: item.image ?? undefined,
                  specSummary: item.specSummary || null,
                  specJson: item.specEntries.length ? item.specEntries : undefined,
                  parametricConfig: item.parametricConfig
                    ? (item.parametricConfig as Prisma.InputJsonValue)
                    : undefined,
                  parametricBreakdown: item.parametricSnapshot
                    ? {
                        price: item.parametricSnapshot.price,
                        currency: item.parametricSnapshot.currency,
                        detailSnapshot: item.parametricSnapshot.detailSnapshot,
                        requested: item.parametricSnapshot.requested,
                      }
                    : undefined,
                  parametricReferenceDate: undefined,
                  parametricSource: undefined,
                  parametricVersion: undefined,
                })),
              },
            },
            include: {
              items: true,
              payments: true,
              storefrontPayments: true,
            },
          })
        })
        isNewOrder = true
      } catch (error) {
        if (
          checkoutUuid &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const existingOrder = await this.prisma.order.findUnique({
            where: { uuid: checkoutUuid },
            include: {
              items: true,
              payments: true,
              storefrontPayments: true,
            },
          })
          if (existingOrder) {
            order = existingOrder
          } else {
            throw error
          }
        } else {
          throw error
        }
      }
    }

    if (!order) {
      throw new BadRequestException('Unable to create order. Please try again.')
    }

    if (dto.paymentIntentId && !this.mercadoPago.isEnabled()) {
      throw new BadRequestException('Mercado Pago payments are not enabled en este entorno.')
    }

    if (dto.paymentIntentId) {
      try {
        await this.mercadoPago.attachPaymentIntentToOrder(order.id, dto.paymentIntentId)
        const refreshed = await this.prisma.order.findUnique({
          where: { id: order.id },
          include: {
            items: true,
            payments: true,
            storefrontPayments: true,
          },
        })
        if (refreshed) {
          order = refreshed
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        this.logger.error(`Failed to attach Mercado Pago payment to order ${order.id}: ${message}`)
        throw error
      }
    }

    const summary = this.toOrderSummary(order, {
      shippingAddress: dto.shippingAddress,
      billingAddress: dto.billingAddress ?? dto.shippingAddress,
    })

    if (isNewOrder) {
      this.notifications
        .notifyOrderReceived(order.id)
        .catch((error) =>
          this.logger.error(
            `Failed to dispatch notifications for order ${order.id}: ${(error as Error).message}`,
          ),
        )
    }

    return summary
  }

  async getCustomerProfile(customerId: number): Promise<CustomerProfile> {
    const [customer, wishlistSummary] = await Promise.all([
      this.prisma.customer.findUnique({
        where: { id: customerId },
        include: { addresses: true },
      }),
      this.getWishlistSummary(customerId),
    ])
    if (!customer) {
      throw new NotFoundException('Customer not found')
    }
    return this.toCustomerProfile(customer, wishlistSummary)
  }

  async updateCustomerProfile(customerId: number, dto: StorefrontUpdateProfileDto): Promise<CustomerProfile> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { addresses: true },
    })
    if (!customer) {
      throw new NotFoundException('Customer not found')
    }

    let nextEmail = customer.email ? customer.email.trim().toLowerCase() : null
    let nextPhone = customer.phoneNumber ? customer.phoneNumber.trim() : null

    const updateData: Prisma.CustomerUpdateInput = {}
    if (dto.firstName !== undefined) {
      updateData.firstName = dto.firstName
    }
    if (dto.lastName !== undefined) {
      updateData.lastName = dto.lastName
    }
    if (dto.firstName !== undefined || dto.lastName !== undefined) {
      const first = dto.firstName ?? customer.firstName ?? ''
      const last = dto.lastName ?? customer.lastName ?? ''
      const fullName = `${first} ${last}`.trim()
      if (fullName) {
        updateData.name = fullName
      }
    }

    if (dto.email !== undefined) {
      const trimmedEmail = dto.email ? dto.email.trim() : ''
      if (trimmedEmail) {
        const normalizedEmail = normalizeEmail(trimmedEmail)
        const existingEmail = await this.prisma.customer.findFirst({
          where: {
            email: normalizedEmail,
            id: { not: customerId },
          },
          select: { id: true },
        })
        if (existingEmail) {
          throw new ConflictException('Email is already in use')
        }
        updateData.email = normalizedEmail
        nextEmail = normalizedEmail
      } else {
        updateData.email = null
        nextEmail = null
      }
    }

    if (dto.phone !== undefined) {
      const sanitizedPhone = dto.phone ? sanitizePhoneInput(dto.phone) : null
      if (dto.phone && !sanitizedPhone) {
        throw new BadRequestException('Invalid phone number')
      }
      if (sanitizedPhone) {
        const existingPhone = await this.prisma.customer.findFirst({
          where: {
            phoneNumber: sanitizedPhone,
            id: { not: customerId },
          },
          select: { id: true },
        })
        if (existingPhone) {
          throw new ConflictException('Phone number is already in use')
        }
      }
      updateData.phoneNumber = sanitizedPhone
      nextPhone = sanitizedPhone
    }

    if (dto.dateOfBirth !== undefined) {
      let birthday: Date | null = null
      if (dto.dateOfBirth) {
        const parsed = new Date(dto.dateOfBirth)
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException('Invalid date of birth')
        }
        birthday = parsed
      }
      updateData.birthday = birthday
    }

    if (dto.locale !== undefined) {
      updateData.preferredLocale = normalizeLocalePreference(dto.locale)
    }

    if (!nextEmail && !nextPhone) {
      throw new BadRequestException('At least one contact method is required')
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: updateData,
      })
    }

    const [updated, wishlistSummary] = await Promise.all([
      this.prisma.customer.findUnique({
        where: { id: customerId },
        include: { addresses: true },
      }),
      this.getWishlistSummary(customerId),
    ])
    if (!updated) {
      throw new NotFoundException('Customer not found')
    }
    return this.toCustomerProfile(updated, wishlistSummary)
  }

  async listCustomerOrders(customerId: number): Promise<OrderSummaryWithReference[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        customerId,
        documentType: DocumentType.ORDER,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        payments: true,
        storefrontPayments: true,
      },
    })

    return orders.map((order) => this.toOrderSummary(order))
  }

  async getCustomerOrder(customerId: number, identifier: string): Promise<OrderSummaryWithReference> {
    const orderId = await this.resolveCustomerOrderId(customerId, identifier)
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
        documentType: DocumentType.ORDER,
      },
      include: {
        items: true,
        payments: true,
        storefrontPayments: true,
      },
    })

    if (!order) {
      throw new NotFoundException('Order not found')
    }

    return this.toOrderSummary(order)
  }

  async getCustomerOrderTimeline(customerId: number, identifier: string) {
    const orderId = await this.resolveCustomerOrderId(customerId, identifier)
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        customerId,
        documentType: DocumentType.ORDER,
      },
      include: {
        payments: true,
        storefrontPayments: true,
        items: true,
      },
    })

    if (!order) {
      throw new NotFoundException('Order not found')
    }

    const orderTotal = decimalToNumber(order.grandTotal ?? decimal(0))
    const orderCurrency = order.orderCurrency ?? 'USD'
    const orderCurrencyCode = orderCurrency.toUpperCase()

    const storefrontIntents = (order.storefrontPayments ?? [])
      .slice()
      .sort((a, b) => {
        const left = (a.updatedAt ?? a.createdAt).getTime()
        const right = (b.updatedAt ?? b.createdAt).getTime()
        return right - left
      })
    const primaryIntent = storefrontIntents[0] ?? null

    const paymentsDesc = (order.payments ?? [])
      .slice()
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    const primaryPayment = paymentsDesc[0] ?? null

    const paymentsAsc = (order.payments ?? [])
      .slice()
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    const paymentStatus = this.resolvePaymentStatus(order, primaryIntent, paymentsDesc)
    let paymentSummary = this.buildOrderPaymentSummary(primaryIntent, primaryPayment, orderCurrency, order, paymentStatus)

    const events = await this.timeline.list(order.id)
    const hasPaymentEvent = events.some((event) => {
      const type = (event.type || '').toUpperCase()
      return type === 'PAYMENT_WAITING' || type === 'PAYMENT_PARTIAL' || type === 'PAYMENT_FULL'
    })

    if (!hasPaymentEvent) {
      if (paymentsAsc.length > 0) {
        let accumulated = 0
        paymentsAsc.forEach((payment, index) => {
          const amountNumber = decimalToNumber(payment.amount ?? decimal(0))
          accumulated += amountNumber
          const currencyCode = (payment.currency ?? orderCurrency).toUpperCase()
          const sameCurrency = currencyCode === orderCurrencyCode

          let eventType: 'PAYMENT_PARTIAL' | 'PAYMENT_FULL' = 'PAYMENT_PARTIAL'
          let remainingAmount: number | null = null

          if (sameCurrency) {
            remainingAmount = Math.max(0, orderTotal - accumulated)
            if (remainingAmount <= 0.01) {
              eventType = 'PAYMENT_FULL'
            }
          } else if (index === paymentsAsc.length - 1 && paymentStatus === 'paid') {
            eventType = 'PAYMENT_FULL'
          }

          events.push({
            eventId: `synthetic:order:${order.id}:payment:${payment.id}`,
            orderId: order.id,
            type: eventType,
            timestamp: payment.date.toISOString(),
            actor: payment.method ?? 'system',
            amount: amountNumber,
            currency: currencyCode,
            paymentMethod: payment.method ?? null,
            remainingAmount,
            estimateDate: null,
            statusFrom: null,
            statusTo: null,
            message: payment.notes ?? null,
            metadata: { source: 'storefront:payment-record' },
          })
        })
      } else if (paymentSummary) {
        const amountValue = typeof paymentSummary.amount?.amount === 'number' ? paymentSummary.amount?.amount : null
        const currencyCode = (paymentSummary.amount?.currency ?? orderCurrency).toUpperCase()
        const sameCurrency = currencyCode === orderCurrencyCode

        let eventType: 'PAYMENT_FULL' | 'PAYMENT_PARTIAL' | 'PAYMENT_WAITING' | null = null
        if (paymentStatus === 'paid') {
          if (sameCurrency && amountValue !== null && Math.abs(orderTotal - amountValue) > 0.01) {
            eventType = 'PAYMENT_PARTIAL'
          } else {
            eventType = 'PAYMENT_FULL'
          }
        } else if (paymentStatus === 'processing' || paymentStatus === 'pending') {
          eventType = 'PAYMENT_WAITING'
        }

        if (eventType) {
          let remainingAmount: number | null = null
          if (eventType === 'PAYMENT_PARTIAL' && sameCurrency && amountValue !== null) {
            remainingAmount = Math.max(0, orderTotal - amountValue)
          } else if (eventType === 'PAYMENT_FULL') {
            remainingAmount = 0
          } else if (eventType === 'PAYMENT_WAITING' && sameCurrency && amountValue !== null) {
            remainingAmount = Math.max(0, orderTotal - amountValue)
          }

          events.push({
            eventId: `synthetic:order:${order.id}:${eventType.toLowerCase()}`,
            orderId: order.id,
            type: eventType,
            timestamp: paymentSummary.updatedAt ?? order.updatedAt.toISOString(),
            actor: paymentSummary.provider ?? 'system',
            amount: amountValue,
            currency: currencyCode,
            paymentMethod: null,
            remainingAmount,
            estimateDate: null,
            statusFrom: null,
            statusTo: null,
            message: paymentSummary.statusDetail ?? null,
            metadata: { source: 'storefront:payment-summary' },
          })
        }
      }
    }

    events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    const paymentEventsSorted = events
      .filter((event) => {
        const normalized = (event.type || '').toUpperCase()
        return (
          normalized === 'PAYMENT_WAITING' ||
          normalized === 'PAYMENT_PARTIAL' ||
          normalized === 'PAYMENT_FULL'
        )
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    const hasSummaryEvent = events.some((event) => (event.type || '').toUpperCase() === 'PAYMENT_FULL_SUMMARY')

    if (!hasSummaryEvent && paymentEventsSorted.length > 0) {
      const lastPaymentEvent = paymentEventsSorted[paymentEventsSorted.length - 1]
      const hasPriorPartialPayment = paymentEventsSorted
        .slice(0, -1)
        .some((event) => (event.type || '').toUpperCase() === 'PAYMENT_PARTIAL')
      const lastRemaining =
        typeof lastPaymentEvent.remainingAmount === 'number' ? Number(lastPaymentEvent.remainingAmount) : null
      const lastType = (lastPaymentEvent.type || '').toUpperCase()
      const isFullyPaid =
        lastType === 'PAYMENT_FULL' || (lastRemaining !== null && lastRemaining <= 0.01)

      if (isFullyPaid && hasPriorPartialPayment) {
        const baseTimestamp = paymentSummary?.updatedAt ?? lastPaymentEvent.timestamp
        const summaryDate = new Date(baseTimestamp)
        const summaryTimestamp = new Date(summaryDate.getTime() + 1).toISOString()
        events.push({
          eventId: `synthetic:order:${order.id}:payment_full_summary`,
          orderId: order.id,
          type: 'PAYMENT_FULL_SUMMARY',
          timestamp: summaryTimestamp,
          actor: paymentSummary?.provider ?? lastPaymentEvent.actor ?? 'system',
          amount: null,
          currency: null,
          paymentMethod: null,
          remainingAmount: 0,
          estimateDate: null,
          statusFrom: null,
          statusTo: null,
          message: paymentSummary?.statusDetail ?? null,
          metadata: { source: 'storefront:payment-summary' },
        })
        events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      }
    }

    return {
      order: {
        id: order.id,
        customerId: order.customerId,
        statusId: order.statusId,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
        date: order.date.toISOString(),
        grandTotal: orderTotal,
        orderCurrency: order.orderCurrency,
        estimatedMin: order.estimatedMin,
        estimatedMax: order.estimatedMax,
      },
      events,
    }
  }

  async getCustomerWishlist(customerId: number): Promise<CustomerWishlistDto> {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { customerId },
      include: {
        items: {
          orderBy: { createdAt: 'desc' },
          include: {
            product: {
              include: {
                images: {
                  where: { variantId: null },
                  orderBy: { sortOrder: 'asc' },
                },
                category: true,
              },
            },
          },
        },
      },
    })

    if (!wishlist) {
      return { items: [], count: 0, productIds: [] }
    }

    return this.toWishlistDto(wishlist)
  }

  async addProductToWishlist(customerId: number, productId: number): Promise<CustomerWishlistDto> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, published: true, productType: true },
    })

    if (!product || !product.published || product.productType !== ProductType.PHYSICAL) {
      throw new NotFoundException('Product not found')
    }

    const wishlist = await this.ensureCustomerWishlist(customerId)

    await this.prisma.wishlistItem.upsert({
      where: { wishlistId_productId: { wishlistId: wishlist.id, productId } },
      update: {},
      create: {
        wishlistId: wishlist.id,
        productId,
      },
    })

    return this.getCustomerWishlist(customerId)
  }

  async removeProductFromWishlist(customerId: number, productId: number): Promise<CustomerWishlistDto> {
    const wishlist = await this.prisma.wishlist.findUnique({
      where: { customerId },
      select: { id: true },
    })

    if (!wishlist) {
      return { items: [], count: 0, productIds: [] }
    }

    await this.prisma.$transaction([
      this.prisma.wishlistItem.deleteMany({
        where: { wishlistId: wishlist.id, productId },
      }),
      this.prisma.wishlist.update({
        where: { id: wishlist.id },
        data: { updatedAt: new Date() },
      }),
    ])

    return this.getCustomerWishlist(customerId)
  }

  private async ensureCustomerWishlist(customerId: number) {
    return this.prisma.wishlist.upsert({
      where: { customerId },
      update: { updatedAt: new Date() },
      create: { customerId },
    })
  }

  private toWishlistDto(wishlist: WishlistWithItems): CustomerWishlistDto {
    const items = wishlist.items
      .filter((item) => item.product && item.product.published && item.product.productType === ProductType.PHYSICAL)
      .map((item) => ({
        productId: item.productId,
        addedAt: item.createdAt.toISOString(),
        product: this.toProductSummary(item.product),
      }))

    const productIds = items.map((item) => item.productId)

    return {
      items,
      count: items.length,
      productIds,
    }
  }

  private async resolvePublishedParametricDefinitions(
    products: Array<Prisma.ProductGetPayload<{ include: { images: true; category: true } }>>,
  ): Promise<Map<number, PublishedParametricProductDefinition | null>> {
    const parametricProducts = products.filter((product) => product.mode === ProductMode.PARAMETRIC)
    if (parametricProducts.length === 0) {
      return new Map()
    }

    const uniqueIds = Array.from(new Set(parametricProducts.map((product) => product.id)))
    const definitions = await Promise.all(
      uniqueIds.map(async (productId) => [
        productId,
        await this.publishedProductResolver.resolvePublishedParametricProduct(productId),
      ] as const),
    )

    return new Map<number, PublishedParametricProductDefinition | null>(definitions)
  }

  private buildPublishedParametricVariantLabel(
    specifications: Array<{ label: string; value: string }> | undefined,
  ): string | null {
    if (!specifications?.length) {
      return null
    }

    const entries = specifications
      .filter((entry) => entry?.label && entry?.value)
      .filter((entry) => entry.label.trim().toLowerCase() !== 'material')
      .map((entry) => `${entry.label}: ${entry.value}`)

    return entries.length > 0 ? entries.join(' • ') : null
  }

  private toProductSummary(
    product: Prisma.ProductGetPayload<{ include: { images: true; category: true } }>,
    publishedParametricDefinition?: PublishedParametricProductDefinition | null,
  ): ProductSummaryDto {
    const thumbnail = product.images?.[0]
    const price = decimalToNumber(product.salePrice)
    const salePrice = decimalToNumber(product.salePrice)
    const publishedVariantLabel = publishedParametricDefinition
      ? this.buildPublishedParametricVariantLabel(publishedParametricDefinition.specifications)
      : null
    const summary: ProductSummaryDto = {
      id: product.id,
      slug: buildProductSlug(product.id, product.name, product.productCode ?? undefined),
      sku: product.productCode,
      name: product.name,
      shortDescription: product.description,
      price: money(price, product.currency ?? 'USD'),
      salePrice: money(salePrice, product.currency ?? 'USD'),
      inventoryStatus: mapInventoryStatus(product),
      tags: product.tags ?? [],
      categories: product.category
        ? [
            {
              id: product.category.id,
              slug: buildCategorySlug(product.category.id, product.category.name),
              name: product.category.name,
            },
          ]
        : [],
      thumbnail: thumbnail
        ? {
            id: thumbnail.id,
            url: thumbnail.img,
            alt: thumbnail.name,
          }
        : undefined,
      mode:
        product.mode === ProductMode.VARIABLE
          ? 'variable'
          : product.mode === ProductMode.PARAMETRIC
          ? 'parametric'
          : 'simple',
      variantLabel: publishedVariantLabel,
      configuration: publishedParametricDefinition?.configuration ?? undefined,
      specifications: publishedParametricDefinition?.specifications ?? undefined,
    }
    return summary
  }

  private computeInventoryStatus(stock: number, permanentStock: boolean): InventoryStatus {
    if (permanentStock) {
      return 'in-stock'
    }
    if (stock <= 0) {
      return 'out-of-stock'
    }
    if (stock < 5) {
      return 'limited'
    }
    return 'in-stock'
  }

  private toProductDetail(
    product: ProductWithVariants,
    publishedParametricDefinition?: PublishedParametricProductDefinition | null,
  ): ProductDetailDto {
    const summary = this.toProductSummary(product)
    const attributes = product.options.map((option) => ({
      id: option.id,
      type: option.type as ProductAttributeType,
      name: option.name,
      values: option.values
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((value) => ({
          id: value.id,
          key: value.code,
          label: value.label,
          value: value.value ?? null,
          colorHex: value.colorHex ?? null,
          imageUrl: value.imageUrl ?? null,
          imageAlt: value.imageAlt ?? null,
          sortOrder: value.sortOrder,
        })),
    }))
    const attributeOrder = new Map<ProductAttributeType, number>()
    attributes.forEach((attribute, index) => {
      attributeOrder.set(attribute.type, index)
    })

    const baseSalePrice = decimalToNumber(product.salePrice)
    const baseCostPrice = decimalToNumber(product.costPrice)
    const baseStock = Number(product.stock ?? 0)
    const basePermanent = Boolean(product.permanentStock)

    const variants: ProductVariantDto[] = product.variants.map((variant) => {
      const variantSalePrice =
        variant.salePrice !== null && variant.salePrice !== undefined
          ? decimalToNumber(variant.salePrice)
          : baseSalePrice
      const variantStock =
        variant.stock !== null && variant.stock !== undefined ? variant.stock : baseStock
      const variantPermanent =
        variant.permanentStock !== null && variant.permanentStock !== undefined
          ? variant.permanentStock
          : basePermanent
      const attributePayload = Array.isArray(variant.attributes)
        ? (variant.attributes as Array<Record<string, unknown>>)
        : []
      const selections: ProductVariantSelectionDto[] = []
      attributePayload.forEach((entry) => {
        const attribute = entry?.attribute as ProductAttributeType | undefined
        const key = typeof entry?.key === 'string' ? entry.key : undefined
        if (!attribute || !key) {
          return
        }
        const label = typeof entry?.label === 'string' ? entry.label : null
        const value = typeof entry?.value === 'string' ? entry.value : null
        const colorHex = typeof entry?.colorHex === 'string' ? entry.colorHex : null
        const imageUrl = typeof entry?.imageUrl === 'string' ? entry.imageUrl : null
        const imageAlt = typeof entry?.imageAlt === 'string' ? entry.imageAlt : null
        selections.push({
          attribute: attribute as ProductAttributeTypeDto,
          valueKey: key,
          label,
          value,
          colorHex,
          imageUrl,
          imageAlt,
        })
      })
      selections.sort(
        (a, b) =>
          (attributeOrder.get(a.attribute as ProductAttributeType) ?? 0) -
          (attributeOrder.get(b.attribute as ProductAttributeType) ?? 0),
      )

      return {
        id: variant.id,
        key: variant.key,
        sku: variant.sku ?? null,
        barcode: variant.barcode ?? null,
        isActive: variant.isActive,
        price: money(variantSalePrice, product.currency ?? 'USD'),
        stock: variantStock,
        inventoryStatus: variant.isActive
          ? this.computeInventoryStatus(variantStock, variantPermanent)
          : ('out-of-stock' as InventoryStatus),
        attributes: selections,
        images: variant.images.map((image) => ({
          id: image.id,
          url: image.img,
          alt: image.name ?? null,
        })),
      }
    })

    return {
      ...summary,
      description: product.description,
      descriptionHtml: product.description,
      specifications: product.specifications
        ? product.specifications.split('\n').map((line) => {
            const [label, ...rest] = line.split(':')
            return { label: label.trim(), value: rest.join(':').trim() }
          })
        : product.mode === ProductMode.PARAMETRIC && publishedParametricDefinition
        ? publishedParametricDefinition.specifications
        : undefined,
      gallery: product.images.map((image) => ({
        id: image.id,
        url: image.img,
        alt: image.name,
      })),
      relatedProducts: [],
      attributes: attributes.length ? attributes : undefined,
      variants: variants.length ? variants : undefined,
      publishedParametricOptions:
        product.mode === ProductMode.PARAMETRIC && publishedParametricDefinition
          ? {
              defaultVariantKey: publishedParametricDefinition.defaultVariantKey,
              defaultConfiguration: publishedParametricDefinition.configuration,
              defaultSpecifications: publishedParametricDefinition.specifications,
              selectors: publishedParametricDefinition.selectors,
              variants: publishedParametricDefinition.variants.map((variant) => ({
                id: variant.id,
                key: variant.key,
                price: money(variant.price, variant.currency ?? product.currency ?? 'USD'),
                configuration: variant.configuration,
                specifications: variant.specifications,
                optionValues: variant.optionValues,
              })),
            }
          : undefined,
    }
  }

  private buildOrderNumber(orderId: number): string {
    return `ORD-${orderId.toString().padStart(6, '0')}`
  }

  private buildOrderReference(order: OrderIdentifierCandidate): string {
    const hash = createHash('sha1')
      .update(`storefront-order:${order.id}:${order.createdAt.toISOString()}`)
      .digest('hex')
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(
      20,
      32,
    )}`
  }

  private toCheckoutLineItem(item: OrderItem, currency: string): CheckoutLineItem {
    const unitAmount = decimalToNumber(item.unitAmount ?? item.price)
    const totalAmount = decimalToNumber(item.price) * item.qty
    const specifications = this.extractOrderItemSpecifications(item)
    return {
      productId: item.productId ?? 0,
      quantity: item.qty,
      variantId: item.variantId ?? undefined,
      price: money(unitAmount, currency),
      total: money(totalAmount, currency),
      name: item.nameSnapshot ?? item.name,
      image: item.img ?? undefined,
      specifications,
    }
  }

  private extractOrderItemSpecifications(item: OrderItem): Array<{ label?: string | null; value?: string | null }> | undefined {
    const specs: Array<{ label?: string | null; value?: string | null }> = []

    const json = item.specJson as unknown
    if (json && typeof json === 'object') {
      if (Array.isArray(json)) {
        json.forEach((entry) => {
          if (entry && typeof entry === 'object') {
            const record = entry as Record<string, unknown>
            const label = typeof record.label === 'string' ? record.label : typeof record.name === 'string' ? record.name : undefined
            const value = typeof record.value === 'string' ? record.value : undefined
            if (label || value) {
              specs.push({ label, value })
            }
          }
        })
      } else {
        Object.entries(json as Record<string, unknown>).forEach(([label, rawValue]) => {
          const value = typeof rawValue === 'string' ? rawValue : rawValue !== null && rawValue !== undefined ? String(rawValue) : undefined
          specs.push({ label, value })
        })
      }
    }

    if (specs.length === 0 && typeof item.specSummary === 'string' && item.specSummary.trim()) {
      item.specSummary
        .split(/\n+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
        .forEach((entry) => {
          const [label, ...rest] = entry.split(':')
          if (rest.length > 0) {
            specs.push({ label: label.trim(), value: rest.join(':').trim() })
          } else {
            specs.push({ label: undefined, value: label.trim() })
          }
        })
    }

    return specs.length > 0 ? specs : undefined
  }

  private toOrderSummary(
    order: OrderWithRelations,
    overrides?: {
      shippingAddress?: StorefrontCreateOrderDto['shippingAddress']
      billingAddress?: StorefrontCreateOrderDto['billingAddress']
    },
  ): OrderSummaryWithReference {
    const currency = order.orderCurrency || 'USD'
    const items = order.items.map((item) => this.toCheckoutLineItem(item, currency))

    const subtotal = decimalToNumber(order.subTotal ?? decimal(0))
    const tax = decimalToNumber(order.tax ?? decimal(0))
    const shipping = decimalToNumber(order.deliveryFees ?? decimal(0))
    const grandTotal =
      order.grandTotal !== null && order.grandTotal !== undefined
        ? decimalToNumber(order.grandTotal)
        : subtotal + tax + shipping

    const shippingAddress =
      overrides?.shippingAddress ?? {
        line1: order.shippingAddress1 ?? '',
        line2: order.shippingAddress2 ?? undefined,
        city: order.shippingCity ?? '',
        state: order.shippingState ?? '',
        zip: order.shippingZip ?? '',
        country: 'Unknown',
      }

    const billingAddress =
      overrides?.billingAddress ?? {
        line1: order.billingAddress1 ?? shippingAddress.line1,
        line2: order.billingAddress2 ?? shippingAddress.line2,
        city: order.billingCity ?? shippingAddress.city,
        state: order.billingState ?? shippingAddress.state,
        zip: order.billingZip ?? shippingAddress.zip,
        country: shippingAddress.country,
      }

    const deliverySummary = this.buildDeliverySummary(order)
    const statusDefinition = findOrderStatusById(order.statusId ?? null)
    const statusCode = statusDefinition?.code ?? 'pending'
    const statusLabel = statusDefinition?.label ?? 'Pendiente'
    const statusColor = statusDefinition?.color ?? 'gray'
    const statusBadgeColor = mapStatusColorToBadge(statusDefinition?.color)
    const fulfillmentStatus = statusCode

    const intents = (order.storefrontPayments ?? [])
      .slice()
      .sort((a, b) => {
        const left = a.updatedAt ?? a.createdAt
        const right = b.updatedAt ?? b.createdAt
        return right.getTime() - left.getTime()
      })
    const primaryIntent = intents[0] ?? null

    const payments = (order.payments ?? [])
      .slice()
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    const primaryPayment = payments[0] ?? null

    const paymentStatus = this.resolvePaymentStatus(order, primaryIntent, payments)
    const paymentMeta = resolvePaymentStatusMeta(paymentStatus)
    const paymentSummary = this.buildOrderPaymentSummary(primaryIntent, primaryPayment, currency, order, paymentStatus)

    return {
      id: order.id,
      uuid: order.uuid,
      orderNumber: this.buildOrderNumber(order.id),
      reference: this.buildOrderReference(order),
      placedAt: order.createdAt.toISOString(),
      status: statusCode,
      statusLabel,
      statusColor,
      statusBadgeColor,
      paymentStatus,
      paymentStatusLabel: paymentMeta.label,
      paymentStatusColor: paymentMeta.color,
      paymentStatusBadgeColor: paymentMeta.badge,
      fulfillmentStatus,
      fulfillmentStatusLabel: statusLabel,
      items,
      summary: {
        items,
        subtotal: money(subtotal, currency),
        tax: money(tax, currency),
        shipping: money(shipping, currency),
        discounts: [],
        grandTotal: money(grandTotal, currency),
        estimatedDelivery: deliverySummary?.estimatedLabel ?? undefined,
        delivery: deliverySummary ?? undefined,
      },
      delivery: deliverySummary ?? undefined,
      shippingAddress,
      billingAddress,
      payment: paymentSummary ?? undefined,
    }
  }

  private buildDeliverySummary(order: OrderWithRelations): OrderDeliverySummary | null {
    const estimatedMin = order.estimatedMin ?? null
    const estimatedMax = order.estimatedMax ?? null
    const estimatedLabel =
      estimatedMin !== null && estimatedMax !== null
        ? estimatedMin === estimatedMax
          ? `${estimatedMin} día${estimatedMin === 1 ? '' : 's'}`
          : `${estimatedMin}-${estimatedMax} días`
        : estimatedMin !== null
          ? `${estimatedMin} día${estimatedMin === 1 ? '' : 's'}`
          : null

    if (!order.shippingVendor && estimatedLabel === null) {
      return null
    }

    return {
      mode: 'home_delivery',
      modeLabel: 'Envío a domicilio',
      shippingVendor: order.shippingVendor ?? null,
      estimatedMin,
      estimatedMax,
      estimatedLabel,
    }
  }

  private resolvePaymentStatus(
    order: OrderWithRelations,
    intent: StorefrontPaymentIntent | null,
    payments: OrderWithRelations['payments'],
  ): string {
    const orderCurrency = (order.orderCurrency ?? 'USD').toUpperCase()
    const orderTotal = decimalToNumber(order.grandTotal ?? decimal(0))
    const tolerance = orderTotal > 0 ? Math.max(orderTotal * 0.001, 0.01) : 0.01

    const normalizedPayments = payments ?? []
    const confirmedPayments = normalizedPayments.filter(
      (payment) => payment.status === PaymentStatus.CONFIRMED,
    )
    let confirmedTotal = 0
    for (const payment of confirmedPayments) {
      const amount = decimalToNumber(payment.amount ?? decimal(0))
      if (!Number.isFinite(amount)) {
        continue
      }
      const paymentCurrency = (payment.currency ?? orderCurrency).toUpperCase()
      if (!orderCurrency || !paymentCurrency || paymentCurrency === orderCurrency) {
        confirmedTotal += amount
        continue
      }
      confirmedTotal += amount
    }

    if (orderTotal > 0 && confirmedTotal > 0) {
      const remaining = Math.max(0, orderTotal - confirmedTotal)
      if (remaining <= tolerance) {
        return 'paid'
      }
      return 'partial'
    }

    if (intent) {
      const normalized = (intent.status ?? '').toLowerCase()
      const intentAmount = decimalToNumber(intent.amount ?? decimal(0))
      const intentCurrency = (intent.currency ?? orderCurrency).toUpperCase()
      const sameCurrency =
        !orderCurrency || !intentCurrency || intentCurrency === orderCurrency
      const coversTotal =
        orderTotal > 0 && sameCurrency && Number.isFinite(intentAmount)
          ? Math.max(0, orderTotal - intentAmount) <= tolerance
          : false

      if (['approved', 'captured'].includes(normalized)) {
        if (coversTotal) {
          return 'paid'
        }
        if (intentAmount > 0) {
          return 'partial'
        }
        return 'processing'
      }
      if (['authorized', 'in_process', 'pending', 'in_mediation'].includes(normalized)) {
        return 'processing'
      }
      if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(normalized)) {
        return 'failed'
      }
      if (normalized) {
        return normalized
      }
    }

    if (confirmedPayments.length > 0) {
      return orderTotal > 0 ? 'partial' : 'paid'
    }

    if (normalizedPayments.length > 0) {
      return this.mapInternalPaymentStatus(normalizedPayments[0].status)
    }

    return 'pending'
  }

  private mapInternalPaymentStatus(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.CONFIRMED:
        return 'paid'
      case PaymentStatus.REGISTERED:
        return 'pending'
      case PaymentStatus.FAILED:
        return 'failed'
      default:
        return String(status).toLowerCase()
    }
  }

  private buildOrderPaymentSummary(
    intent: StorefrontPaymentIntent | null,
    payment: (OrderWithRelations['payments'][number] & { updatedAt: Date }) | null,
    fallbackCurrency: string,
    order: OrderWithRelations,
    resolvedStatus: string,
  ) {
    if (intent) {
      const currency = intent.currency ?? fallbackCurrency
      return {
        provider: intent.provider,
        status: resolvedStatus,
        statusDetail: intent.statusDetail ?? undefined,
        paymentId: intent.externalPaymentId ?? undefined,
        paymentIntentId: intent.id,
        amount: money(decimalToNumber(intent.amount ?? decimal(0)), currency),
        installments: intent.installments ?? undefined,
        cardBrand: intent.cardBrand ?? undefined,
        cardLastFour: intent.cardLastFour ?? undefined,
        updatedAt: (intent.updatedAt ?? intent.createdAt).toISOString(),
      }
    }

    if (payment) {
      const currency = payment.currency ?? fallbackCurrency
      const paymentMethod = findPaymentMethodById(order.paymentMethodId ?? null)
      return {
        provider: paymentMethod?.label ?? payment.method ?? 'manual',
        status: resolvedStatus ?? this.mapInternalPaymentStatus(payment.status),
        statusDetail: undefined,
        paymentId: payment.reference ?? undefined,
        paymentIntentId: undefined,
        amount: money(decimalToNumber(payment.amount ?? decimal(0)), currency),
        installments: undefined,
        cardBrand: undefined,
        cardLastFour: undefined,
        updatedAt: payment.updatedAt.toISOString(),
      }
    }

    return null
  }

  private toCustomerAddress(address: CustomerAddress): CustomerProfile['addresses'][number] {
    const line1 = [address.street, address.number].filter(Boolean).join(' ').trim()
    const line2 = [address.apartment, address.corner, address.comments].filter(Boolean).join(', ').trim()
    const normalizeOptional = (value?: string | null) => {
      const trimmed = String(value ?? '').trim()
      return trimmed.length ? trimmed : null
    }

    return {
      id: address.id,
      line1,
      line2: line2 || undefined,
      street: normalizeOptional(address.street),
      number: normalizeOptional(address.number),
      apartment: normalizeOptional(address.apartment),
      corner: normalizeOptional(address.corner),
      comments: normalizeOptional(address.comments),
      city: address.city,
      state: '',
      zip: '',
      country: address.country,
      countryCode: deriveCountryCode(address.country),
      label: address.label ?? undefined,
      isPrimary: address.isPrimary,
    }
  }

  private async syncCustomerProfileFromCheckout(
    customer: Customer,
    dto: StorefrontCreateOrderDto,
  ): Promise<Customer> {
    const trimmedFirst = dto.customer.firstName?.trim() ?? ''
    const trimmedLast = dto.customer.lastName?.trim() ?? ''
    const normalizedName = `${trimmedFirst} ${trimmedLast}`.trim()
    const normalizedPhone = sanitizePhoneInput(dto.customer.phone)

    const updateData: Prisma.CustomerUpdateInput = {}
    if (trimmedFirst && trimmedFirst !== (customer.firstName ?? '')) {
      updateData.firstName = trimmedFirst
    }
    if (trimmedLast && trimmedLast !== (customer.lastName ?? '')) {
      updateData.lastName = trimmedLast
    }
    if (normalizedName && normalizedName !== (customer.name ?? '')) {
      updateData.name = normalizedName
    }
    if (normalizedPhone && normalizedPhone !== (customer.phoneNumber ?? null)) {
      updateData.phoneNumber = normalizedPhone
    }

    let updatedCustomer = customer
    if (Object.keys(updateData).length > 0) {
      updatedCustomer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: updateData,
      })
    }

    if (dto.customer.locale) {
      const localePreference = normalizeLocalePreference(dto.customer.locale)
      if (getPreferredLocale(updatedCustomer) !== localePreference) {
        updatedCustomer = await this.prisma.customer.update({
          where: { id: customer.id },
          data: { preferredLocale: localePreference },
        })
      }
    }

    if (normalizedPhone) {
      const existingPhone = await this.prisma.customerPhone.findFirst({
        where: { customerId: customer.id, phone: normalizedPhone },
      })
      if (!existingPhone) {
        await this.prisma.customerPhone.create({
          data: {
            customerId: customer.id,
            phone: normalizedPhone,
            isPrimary:
              !updatedCustomer.phoneNumber || updatedCustomer.phoneNumber === normalizedPhone,
          },
        })
      } else if (
        !existingPhone.isPrimary &&
        updatedCustomer.phoneNumber &&
        updatedCustomer.phoneNumber === normalizedPhone
      ) {
        await this.prisma.customerPhone.update({
          where: { id: existingPhone.id },
          data: { isPrimary: true },
        })
        await this.prisma.customerPhone.updateMany({
          where: { customerId: customer.id, NOT: { id: existingPhone.id } },
          data: { isPrimary: false },
        })
      }
    }

    const shipping = dto.shippingAddress
    if (shipping) {
      const { street, number } = splitStreetAndNumber(shipping.line1)
      const normalizedCity = shipping.city?.trim() || 'Montevideo'
      const normalizedCountry = shipping.country?.trim() || 'UY'
      const normalizedComments = shipping.line2?.trim() || null

      const addresses = await this.prisma.customerAddress.findMany({
        where: { customerId: customer.id },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      })
      const primary = addresses.find((address) => address.isPrimary) ?? addresses[0] ?? null
      const addressData = {
        street: street || normalizedCity,
        number: number || 'S/N',
        city: normalizedCity,
        country: normalizedCountry,
        comments: normalizedComments,
      }

      if (!primary) {
        await this.prisma.customerAddress.create({
          data: {
            customerId: customer.id,
            ...addressData,
            isPrimary: true,
          },
        })
      } else {
        const needsUpdate =
          primary.street !== addressData.street ||
          primary.number !== addressData.number ||
          primary.city !== addressData.city ||
          primary.country !== addressData.country ||
          (primary.comments ?? null) !== addressData.comments

        if (needsUpdate || !primary.isPrimary) {
          await this.prisma.customerAddress.update({
            where: { id: primary.id, customerId: customer.id },
            data: {
              ...addressData,
              isPrimary: true,
            },
          })
        }

        await this.prisma.customerAddress.updateMany({
          where: { customerId: customer.id, NOT: { id: primary.id } },
          data: { isPrimary: false },
        })
      }
    }

    return updatedCustomer
  }

  private toCustomerProfile(
    customer: CustomerWithAddresses,
    wishlistSummary: { count: number; productIds: number[] } = { count: 0, productIds: [] },
  ): CustomerProfile {
    const addresses = customer.addresses
      .slice()
      .sort((a, b) => {
        if (a.isPrimary === b.isPrimary) {
          return a.id - b.id
        }
        return a.isPrimary ? -1 : 1
      })
      .map((address) => this.toCustomerAddress(address))

    return {
      id: customer.id,
      email: customer.email ?? '',
      firstName: customer.firstName ?? '',
      lastName: customer.lastName ?? '',
      phone: customer.phoneNumber ?? undefined,
      avatarUrl: customer.img ?? undefined,
      dateOfBirth: customer.birthday ? customer.birthday.toISOString() : null,
      preferredLocale: getPreferredLocale(customer),
      wishlistCount: wishlistSummary.count,
      wishlistProductIds: wishlistSummary.productIds,
      addresses,
    }
  }

  private async resolveCustomerOrderId(customerId: number, identifier: string): Promise<number> {
    const normalized = identifier.trim()
    if (!normalized) {
      throw new NotFoundException('Order not found')
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
      throw new NotFoundException('Order not found')
    }

    const order = await this.prisma.order.findFirst({
      where: {
        customerId,
        documentType: DocumentType.ORDER,
        uuid: { equals: normalized, mode: 'insensitive' },
      },
      select: { id: true },
    })
    if (!order) {
      throw new NotFoundException('Order not found')
    }
    return order.id
  }

  private async getWishlistSummary(customerId: number) {
    const items = await this.prisma.wishlistItem.findMany({
      where: {
        wishlist: { customerId },
        product: {
          published: true,
          productType: ProductType.PHYSICAL,
        },
      },
      select: { productId: true },
    })

    const productIds = items.map((item) => item.productId)
    return {
      count: productIds.length,
      productIds,
    }
  }

  async createSessionForCustomer(customer: Customer): Promise<StorefrontAuthSession> {
    return this.buildSession(customer)
  }

  private async buildSession(customer: Customer): Promise<StorefrontAuthSession> {
    const accessPayload = {
      sub: customer.id,
      email: customer.email,
      firstName: customer.firstName ?? '',
      lastName: customer.lastName ?? '',
      scope: 'storefront' as const,
      tokenType: 'access' as const,
      ver: customer.storefrontSessionVersion,
    }

    const refreshPayload = {
      sub: customer.id,
      scope: 'storefront' as const,
      tokenType: 'refresh' as const,
      ver: customer.storefrontSessionVersion,
    }

    const [accessToken, refreshToken, addresses, wishlistSummary] = await Promise.all([
      this.jwt.signAsync(accessPayload, { expiresIn: ACCESS_TOKEN_EXPIRES_IN }),
      this.jwt.signAsync(refreshPayload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN }),
      this.prisma.customerAddress.findMany({
        where: { customerId: customer.id },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      }),
      this.getWishlistSummary(customer.id),
    ])

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      customer: {
        id: customer.id,
        email: customer.email ?? '',
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phoneNumber ?? undefined,
        preferredLocale: getPreferredLocale(customer),
        wishlistCount: wishlistSummary.count,
        wishlistProductIds: wishlistSummary.productIds,
        addresses: addresses.map((address) => this.toCustomerAddress(address)),
      },
    }
  }

  private trim(value: unknown): string {
    return String(value ?? '').trim()
  }

  private normalizeNullable(value: unknown): string | null {
    const trimmed = this.trim(value)
    return trimmed.length ? trimmed : null
  }

  private normalizeAddressInput(dto: StorefrontAddressDto) {
    return {
      street: this.trim(dto.street),
      number: this.trim(dto.number),
      city: this.trim(dto.city),
      country: this.trim(dto.country),
      corner: this.normalizeNullable(dto.corner),
      apartment: this.normalizeNullable(dto.apartment),
      comments: this.normalizeNullable(dto.comments),
      label: this.normalizeNullable(dto.label),
      isPrimary:
        dto.isPrimary === undefined || dto.isPrimary === null ? undefined : Boolean(dto.isPrimary),
    }
  }

  async listCustomerAddresses(customerId: number) {
    const addresses = await this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    })
    return addresses.map((address) => this.toCustomerAddress(address))
  }

  async createCustomerAddress(customerId: number, dto: StorefrontAddressDto): Promise<CustomerProfile> {
    const normalized = this.normalizeAddressInput(dto)

    const addressCount = await this.prisma.customerAddress.count({ where: { customerId } })
    let isPrimary = normalized.isPrimary ?? false
    if (addressCount === 0) {
      isPrimary = true
    }

    const created = await this.prisma.customerAddress.create({
      data: {
        customerId,
        street: normalized.street,
        number: normalized.number,
        corner: normalized.corner,
        apartment: normalized.apartment,
        city: normalized.city,
        country: normalized.country,
        comments: normalized.comments,
        label: normalized.label,
        isPrimary,
      },
    })

    if (created.isPrimary) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId, NOT: { id: created.id } },
        data: { isPrimary: false },
      })
    }

    return this.getCustomerProfile(customerId)
  }

  async updateCustomerAddress(
    customerId: number,
    addressId: number,
    dto: StorefrontAddressDto,
  ): Promise<CustomerProfile> {
    const existing = await this.prisma.customerAddress.findUnique({ where: { id: addressId, customerId } })
    if (!existing) {
      throw new NotFoundException('storefront.address.not_found')
    }

    const normalized = this.normalizeAddressInput(dto)
    const shouldUpdatePrimary = normalized.isPrimary !== undefined

    const updated = await this.prisma.customerAddress.update({
      where: { id: addressId, customerId },
      data: {
        street: normalized.street,
        number: normalized.number,
        corner: normalized.corner,
        apartment: normalized.apartment,
        city: normalized.city,
        country: normalized.country,
        comments: normalized.comments,
        label: normalized.label,
        ...(shouldUpdatePrimary ? { isPrimary: Boolean(normalized.isPrimary) } : {}),
      },
    })

    if (shouldUpdatePrimary && updated.isPrimary) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId, NOT: { id: updated.id } },
        data: { isPrimary: false },
      })
    } else if (shouldUpdatePrimary && !updated.isPrimary) {
      const primaryExists = await this.prisma.customerAddress.count({
        where: { customerId, isPrimary: true },
      })
      if (primaryExists === 0) {
        await this.prisma.customerAddress.update({
          where: { id: updated.id },
          data: { isPrimary: true },
        })
      }
    }

    return this.getCustomerProfile(customerId)
  }

  async deleteCustomerAddress(customerId: number, addressId: number): Promise<CustomerProfile> {
    const existing = await this.prisma.customerAddress.findUnique({ where: { id: addressId, customerId } })
    if (!existing) {
      throw new NotFoundException('storefront.address.not_found')
    }

    await this.prisma.customerAddress.delete({ where: { id: addressId, customerId } })

    if (existing.isPrimary) {
      const next = await this.prisma.customerAddress.findFirst({
        where: { customerId },
        orderBy: [{ createdAt: 'asc' }],
      })
      if (next) {
        await this.prisma.customerAddress.update({
          where: { id: next.id },
          data: { isPrimary: true },
        })
      }
    }

    return this.getCustomerProfile(customerId)
  }

  async setPrimaryCustomerAddress(customerId: number, addressId: number): Promise<CustomerProfile> {
    const target = await this.prisma.customerAddress.findUnique({ where: { id: addressId, customerId } })
    if (!target) {
      throw new NotFoundException('storefront.address.not_found')
    }

    await this.prisma.$transaction([
      this.prisma.customerAddress.updateMany({
        where: { customerId },
        data: { isPrimary: false },
      }),
      this.prisma.customerAddress.update({
        where: { id: target.id },
        data: { isPrimary: true },
      }),
    ])

    return this.getCustomerProfile(customerId)
  }
}

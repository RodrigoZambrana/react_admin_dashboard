import { BadRequestException, Injectable, Logger, StreamableFile } from '@nestjs/common'
import { Prisma, CustomerAddress, DocumentType, SalesUnit, DepositRequirementType } from '@prisma/client'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { parse } from 'path'
import type { FastifyRequest } from 'fastify'
import { PrismaService } from '../prisma/prisma.service'
import { CreateOrderDto } from '../sales/dto/order.dto'
import { CurrencyConversionService, CurrencyRatesSnapshot } from '../common/currency/currency-conversion.service'
import {
  persistSalesDocumentFile,
  deleteSalesDocumentFile,
  resolveSalesDocumentLocalPath,
} from '../common/uploads/documents'
import { sanitizeRichText } from '../common/utils/sanitize'

type MultipartFile = import('@fastify/multipart').MultipartFile
import {
  decimal,
  roundDecimal,
  multiplyDecimals,
  addDecimals,
  divideDecimals,
} from '../common/currency/money.util'
import { OrderFinanceService } from './order-finance.service'
import type { OrderPaymentSummary } from './order-finance.service'
import { OrderTimelineService } from './order-timeline.service'
import { NotificationOrchestratorService } from '../notifications/notification-orchestrator.service'
import { EmailService } from '../email/email.service'
import {
  findOrderStatusByCode,
  findOrderStatusById,
  getDefaultStatusForDocument,
  listOrderStatuses,
  matchOrderStatus,
  ORDER_STATUS_CODES,
} from '../common/constants/order-statuses'
import {
  DEFAULT_PAYMENT_METHOD_ID,
  findPaymentMethodById,
  matchPaymentMethod,
  listPaymentMethods,
} from '../common/constants/payment-methods'
import { UpdateOrderDeliveryDto } from './dto/update-delivery.dto'
import { OrderStockIntegrityService } from './order-stock-integrity.service'

const SALES_UNIT_KEYWORDS: Record<SalesUnit, string[]> = {
  [SalesUnit.UNIT]: ['unit', 'units', 'unidad', 'unidades', 'u'],
  [SalesUnit.SQUARE_METER]: [
    'squaremeter',
    'squaremeters',
    'metroscuadrados',
    'metrocuadrado',
    'metroscuadrado',
    'm2',
    'sqm',
    'mt2',
  ],
  [SalesUnit.LINEAR_METER]: [
    'linearmeter',
    'linearmeters',
    'metrolineal',
    'metroslineales',
    'ml',
    'lm',
  ],
}

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    customer: true
  }
}>

type OrderSortKey =
  | 'id'
  | 'date'
  | 'customer'
  | 'status'
  | 'statusId'
  | 'paymentMehod'
  | 'totalAmount'
  | 'validUntilDate'

type BudgetStatusKey = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'CONVERTED' | 'CANCELED' | 'EXPIRED'

type StaticOrderStatusRecord = {
  id: number
  code: number
  name: string
  color: string | null
}

type StaticPaymentMethodRecord = {
  id: number
  name: string
}

type LinkedActivitySummary = {
  id: number
  title: string
  startAt: string | null
  endAt: string | null
  allDay: boolean
  type: string | null
  location: string | null
}

type CalendarEventWithType = Prisma.CalendarEventGetPayload<{
  include: { eventType: true }
}>

@Injectable()
export class SalesDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyConversion: CurrencyConversionService,
    private readonly orderFinance: OrderFinanceService,
    private readonly timeline: OrderTimelineService,
    private readonly notifications: NotificationOrchestratorService,
    private readonly email: EmailService,
    private readonly stockIntegrity: OrderStockIntegrityService,
  ) {}

  private readonly logger = new Logger(SalesDocumentsService.name)

  private readonly disclaimerConfigKey = 'documentDisclaimerHtml'

  private disclaimerCache: { value: string | null; expiresAt: number } | null = null

  private withDocumentType(documentType: DocumentType, where: Prisma.OrderWhereInput = {}) {
    return {
      ...where,
      documentType,
    }
  }

  private decimalToNumber(
    value?: Prisma.Decimal | number | string | null,
  ): number | null {
    if (value === null || value === undefined) {
      return null
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null
    }
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }
    return Number((value as Prisma.Decimal).toString())
  }

  private resolvePaymentAwareStatus(
    documentType: DocumentType,
    baseStatusId: number | null | undefined,
    outstanding: number | null,
  ): number {
    const normalizedBase = Number(baseStatusId ?? 0)
    if (documentType !== DocumentType.ORDER) {
      return normalizedBase
    }
    if (
      normalizedBase === ORDER_STATUS_CODES.CANCELLED ||
      normalizedBase === ORDER_STATUS_CODES.DELIVERED
    ) {
      return normalizedBase
    }
    if (outstanding === null || outstanding === undefined) {
      return normalizedBase || ORDER_STATUS_CODES.PENDING
    }
    return outstanding > 0.01 ? ORDER_STATUS_CODES.PENDING : ORDER_STATUS_CODES.PAID
  }

  private normalizeActivityId(value?: string | number | null): number | null {
    if (value === undefined || value === null) {
      return null
    }
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
      return null
    }
    const normalized = Math.trunc(numeric)
    return normalized > 0 ? normalized : null
  }

  private hasActivityInput(value?: string | number | null): boolean {
    if (value === undefined || value === null) {
      return false
    }
    if (typeof value === 'number') {
      return true
    }
    return value.trim().length > 0
  }

  private normalizeActivityMetadata(
    metadata: Prisma.JsonValue | null | undefined,
  ): Record<string, unknown> | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null
    }
    return metadata as Record<string, unknown>
  }

  private formatActivityAddress(metadata: Record<string, unknown> | null): string | null {
    if (!metadata) {
      return null
    }
    const addressRaw = metadata.address
    if (!addressRaw || typeof addressRaw !== 'object' || Array.isArray(addressRaw)) {
      return null
    }
    const address = addressRaw as Record<string, unknown>
    const extract = (value: unknown) => (typeof value === 'string' ? value.trim() : '')
    const line1 = [extract(address.street), extract(address.number)]
      .filter((segment) => segment.length)
      .join(' ')
      .trim()
    const line2 = [extract(address.city), extract(address.country)]
      .filter((segment) => segment.length)
      .join(', ')
      .trim()
    const label = [line1, line2].filter((segment) => segment.length).join(', ')
    return label.length ? label : null
  }

  private toActivitySummary(activity?: CalendarEventWithType | null): LinkedActivitySummary | null {
    if (!activity) {
      return null
    }
    const metadata = this.normalizeActivityMetadata(activity.metadata)
    const extractString = (value: unknown): string | null => {
      if (typeof value !== 'string') {
        return null
      }
      const trimmed = value.trim()
      return trimmed.length ? trimmed : null
    }
    const location =
      extractString(activity.location) ??
      extractString(metadata?.location) ??
      this.formatActivityAddress(metadata) ??
      null
    const typeLabel =
      extractString(metadata?.eventTypeName) ??
      extractString(metadata?.eventType) ??
      extractString(metadata?.type) ??
      extractString(activity.eventType?.name) ??
      extractString(activity.type) ??
      null
    return {
      id: activity.id,
      title: activity.title,
      startAt: activity.startAt ? activity.startAt.toISOString() : null,
      endAt: activity.endAt ? activity.endAt.toISOString() : null,
      allDay: Boolean(activity.allDay),
      type: typeLabel,
      location,
    }
  }

  private async fetchActivitySummary(activityId: number): Promise<LinkedActivitySummary | null> {
    const activity = await this.prisma.calendarEvent.findUnique({
      where: { id: activityId },
      include: { eventType: true },
    })
    return this.toActivitySummary(activity as CalendarEventWithType | null)
  }

  private async getBudgetStatusId(key: BudgetStatusKey) {
    const codeMap: Record<BudgetStatusKey, string> = {
      DRAFT: 'budget_draft',
      SENT: 'budget_sent',
      ACCEPTED: 'budget_accepted',
      CONVERTED: 'budget_converted',
      CANCELED: 'budget_cancelled',
      EXPIRED: 'budget_expired',
    }
    const definition = findOrderStatusByCode(codeMap[key])
    return definition?.id ?? null
  }

  private decimalToString(
    value: Prisma.Decimal | number | string | null | undefined,
    scale = 2,
  ): string | null {
    if (value === null || value === undefined) {
      return null
    }
    const decimalValue =
      value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value)
    return decimalValue.toFixed(scale)
  }

  private formatSpecKey(key: string) {
    return key
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }

  private buildSpecSummary(customAttributes: Prisma.JsonValue | null | undefined) {
    if (!customAttributes || typeof customAttributes !== 'object' || Array.isArray(customAttributes)) {
      return null
    }
    const entries = Object.entries(customAttributes as Record<string, unknown>)
      .filter(([, value]) => value !== undefined && value !== null && `${value}`.toString().trim().length)
      .map(([key, value]) => `${this.formatSpecKey(key)}: ${value}`)
    return entries.length ? entries.join(', ') : null
  }

  private computeDefaultValidity() {
    const now = new Date()
    const validity = new Date(now)
    validity.setDate(validity.getDate() + 30)
    return validity
  }

  private resolveDeliveryEstimate(
    date: Date,
    estimatedMin?: number | null,
    estimatedMax?: number | null,
  ) {
    const sanitize = (value?: number | null) => {
      if (value === null || value === undefined) {
        return null
      }
      const numeric = Number(value)
      if (!Number.isFinite(numeric)) {
        return null
      }
      return Math.max(0, Math.round(numeric))
    }
    const minDays = sanitize(estimatedMin)
    const maxDays = sanitize(estimatedMax)
    if (minDays === null && maxDays === null) {
      return null
    }
    const baseline = new Date(date)
    baseline.setHours(0, 0, 0, 0)
    const offset = maxDays ?? minDays ?? 0
    const estimate = new Date(baseline)
    estimate.setDate(estimate.getDate() + offset)
    return {
      estimate,
      minDays,
      maxDays,
    }
  }

  private sanitizeDisclaimer(value?: string | null) {
    if (typeof value !== 'string') {
      return null
    }
    const trimmed = value.trim()
    if (!trimmed.length) {
      return null
    }
    const sanitized = sanitizeRichText(trimmed, 'sales.orders.disclaimer')
    return sanitized.length ? sanitized : null
  }

  private async getDefaultDocumentDisclaimer() {
    const now = Date.now()
    if (this.disclaimerCache && this.disclaimerCache.expiresAt > now) {
      return this.disclaimerCache.value
    }

    const record = await this.prisma.systemConfig.findUnique({
      where: { key: this.disclaimerConfigKey },
    })

    const value =
      typeof record?.value === 'string' && record.value.trim().length
        ? record.value
        : null

    this.disclaimerCache = { value, expiresAt: now + 60 * 1000 }
    return value
  }

  private async resolveDocumentDisclaimer(value?: string | null) {
    if (value === '') {
      return null
    }
    const sanitized = this.sanitizeDisclaimer(value)
    if (sanitized) {
      return sanitized
    }
    return (await this.getDefaultDocumentDisclaimer()) ?? null
  }

  private buildDocumentFileName(
    documentType: DocumentType,
    id: number,
    original?: string | null,
  ) {
    const fallbackBase = `${documentType.toLowerCase()}-${id}`
    if (typeof original !== 'string') {
      return `${fallbackBase}.pdf`
    }

    const trimmed = original.trim()
    if (!trimmed.length) {
      return `${fallbackBase}.pdf`
    }

    const parsed = parse(trimmed)
    const base = parsed.name.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '')
    const safeBase = base.length ? base : fallbackBase
    const ext = parsed.ext && parsed.ext.trim().length ? parsed.ext : '.pdf'
    const safeExt = ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`
    return `${safeBase}${safeExt}`
  }

  private normalizeCustomAttributes(attrs: unknown): Prisma.JsonObject | null {
    if (!attrs || typeof attrs !== 'object' || Array.isArray(attrs)) {
      return null
    }
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(attrs as Record<string, unknown>)) {
      if (value === undefined || value === null) {
        continue
      }
      if (typeof value === 'string') {
        const trimmed = value.trim()
        if (!trimmed.length) continue
        result[key] = trimmed
      } else {
        result[key] = value
      }
    }
    return Object.keys(result).length ? (result as Prisma.JsonObject) : null
  }

  private coerceNumber(value: unknown): number | null {
    if (value === null || value === undefined) {
      return null
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
    if (typeof value === 'string') {
      const normalized = value.replace(',', '.').trim()
      if (!normalized.length) {
        return null
      }
      const numeric = Number(normalized)
      return Number.isFinite(numeric) ? numeric : null
    }
    return null
  }

  private readAttributeNumber(
    attrs: Prisma.JsonObject | null,
    key: string,
  ): number | null {
    if (!attrs) {
      return null
    }
    const record = attrs as Record<string, unknown>
    const variations = [key, key.toLowerCase(), key.toUpperCase()]
    for (const candidate of variations) {
      if (candidate in record) {
        const numeric = this.coerceNumber(record[candidate])
        if (numeric !== null) {
          return numeric
        }
      }
    }
    return null
  }

  private computeMeasurementFactor(
    unit: SalesUnit | null,
    attrs: Prisma.JsonObject | null,
  ): number | null {
    if (!unit) {
      return null
    }
    if (unit === SalesUnit.UNIT) {
      return 1
    }
    if (!attrs) {
      return null
    }
    if (unit === SalesUnit.SQUARE_METER) {
      const width = this.readAttributeNumber(attrs, 'width')
      const height = this.readAttributeNumber(attrs, 'height')
      if (width === null || height === null) {
        return null
      }
      const measurement = width * height
      return Number.isFinite(measurement) && measurement > 0 ? measurement : null
    }
    if (unit === SalesUnit.LINEAR_METER) {
      const length = this.readAttributeNumber(attrs, 'length')
      if (length === null) {
        return null
      }
      return Number.isFinite(length) && length > 0 ? length : null
    }
    return null
  }

  private resolveSalesUnit(value: unknown, fallback?: SalesUnit | null): SalesUnit | null {
    if (typeof value === 'string' && value.trim()) {
      const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '')
      for (const [unit, keywords] of Object.entries(SALES_UNIT_KEYWORDS)) {
        if (keywords.includes(normalized)) {
          return unit as SalesUnit
        }
      }
      const upper = value.trim().toUpperCase()
      if ((Object.values(SalesUnit) as string[]).includes(upper)) {
        return upper as SalesUnit
      }
    }
    return fallback ?? null
  }

  private async getTaxRate() {
    const cfg = await this.prisma.systemConfig.findUnique({ where: { key: 'taxRate' } })
    const val = Number(cfg?.value ?? '22')
    return Number.isNaN(val) ? 22 : val
  }

  previewSalesUnitPricing(input: {
    salePrice: Prisma.Decimal | number | string | null | undefined
    currency?: string | null
    unitOfMeasure?: SalesUnit | string | null
    quantity?: number | string | null
    customAttributes?: Record<string, unknown> | Prisma.JsonObject | null
  }) {
    const baseUnitPrice = this.decimalToNumber(input.salePrice)
    if (baseUnitPrice === null || !Number.isFinite(baseUnitPrice) || baseUnitPrice < 0) {
      throw new BadRequestException('pricing.preview.invalidSalePrice')
    }

    const unit = this.resolveSalesUnit(input.unitOfMeasure, SalesUnit.UNIT) ?? SalesUnit.UNIT
    const customAttributes = this.normalizeCustomAttributes(input.customAttributes)
    const quantityRaw = this.coerceNumber(input.quantity)
    const quantity =
      quantityRaw === null || !Number.isFinite(quantityRaw) || quantityRaw <= 0
        ? 1
        : Math.max(quantityRaw, 1)

    const measurementPerUnit = this.computeMeasurementFactor(unit, customAttributes)
    if (unit !== SalesUnit.UNIT && measurementPerUnit === null) {
      return {
        unitOfMeasure: unit,
        quantity,
        measurementPerUnit: null,
        effectiveQuantity: null,
        derivedUnitPrice: null,
        totalAmount: null,
        currency: input.currency?.trim().toUpperCase() || null,
        missingMeasurements: true,
      }
    }

    const effectiveQuantity =
      unit === SalesUnit.UNIT
        ? quantity
        : Number((measurementPerUnit ?? 0) * quantity)
    const derivedUnitPrice =
      unit === SalesUnit.UNIT
        ? baseUnitPrice
        : Number(baseUnitPrice * Number(measurementPerUnit ?? 0))
    const totalAmount =
      unit === SalesUnit.UNIT
        ? Number(baseUnitPrice * quantity)
        : Number(derivedUnitPrice * quantity)

    return {
      unitOfMeasure: unit,
      quantity,
      measurementPerUnit:
        measurementPerUnit === null ? null : Number(measurementPerUnit),
      effectiveQuantity: Number.isFinite(effectiveQuantity)
        ? Number(effectiveQuantity)
        : null,
      derivedUnitPrice: Number.isFinite(derivedUnitPrice)
        ? Number(derivedUnitPrice)
        : null,
      totalAmount: Number.isFinite(totalAmount) ? Number(totalAmount) : null,
      currency: input.currency?.trim().toUpperCase() || null,
      missingMeasurements: false,
    }
  }

  private toOrderStatusRecord(definition: ReturnType<typeof findOrderStatusById>) {
    if (!definition) {
      return null
    }
    return {
      id: definition.id,
      code: definition.id,
      name: definition.label,
      color: definition.color ?? null,
    }
  }

  private getStatusRecordById(statusId: number | null, documentType: DocumentType) {
    if (statusId === null || statusId === undefined) {
      return null
    }
    const definition = findOrderStatusById(statusId)
    if (definition && definition.documentTypes.includes(documentType)) {
      return this.toOrderStatusRecord(definition)
    }
    return null
  }

  private getDefaultStatusRecord(documentType: DocumentType, preferredCode?: number | null) {
    if (preferredCode !== undefined && preferredCode !== null) {
      const preferred = this.getStatusRecordById(preferredCode, documentType)
      if (preferred) {
        return preferred
      }
    }
    const definition = getDefaultStatusForDocument(documentType)
    return definition ? this.toOrderStatusRecord(definition) : null
  }

  private toPaymentMethodRecord(definition: ReturnType<typeof findPaymentMethodById>) {
    if (!definition) {
      return null
    }
    return {
      id: definition.id,
      name: definition.label,
    }
  }

  private getPaymentMethodRecordById(id: number | null) {
    if (id === null || id === undefined) {
      return null
    }
    return this.toPaymentMethodRecord(findPaymentMethodById(id))
  }

  private getPaymentMethodRecordByName(name: string) {
    if (!name) {
      return null
    }
    return this.toPaymentMethodRecord(matchPaymentMethod(name))
  }

  private findPaymentMethodIdsByTerm(term: string) {
    const normalized = term.trim().toLowerCase()
    if (!normalized) {
      return []
    }
    const matches = listPaymentMethods().filter((method) => {
      if (method.label.toLowerCase().includes(normalized)) {
        return true
      }
      return Object.values(method.translations ?? {}).some((value) =>
        value?.toLowerCase().includes(normalized),
      )
    })
    return matches.map((method) => method.id)
  }

  private findStatusIdsByTerm(term: string, documentType: DocumentType) {
    const normalized = term.trim().toLowerCase()
    if (!normalized) {
      return []
    }
    const matches = listOrderStatuses(documentType).filter((status) => {
      if (status.label.toLowerCase().includes(normalized)) {
        return true
      }
      return Object.values(status.translations ?? {}).some((value) =>
        value?.toLowerCase().includes(normalized),
      )
    })
    return matches.map((status) => status.id)
  }

  private serializeFxSnapshot(snapshot: CurrencyRatesSnapshot) {
    const rates: Record<string, string> = {}
    for (const [currency, rate] of Object.entries(snapshot.rates)) {
      rates[currency] = rate.toFixed(8)
    }
    return {
      base: snapshot.base,
      generatedAt: snapshot.generatedAt,
      rates,
    }
  }

  private async getDefaultOrderStatus(preferredCode = ORDER_STATUS_CODES.PENDING) {
    return this.getDefaultStatusRecord(DocumentType.ORDER, preferredCode)
  }

  private async prepareOrderMonetaryData(
    dto: CreateOrderDto,
    taxRate: number,
  ): Promise<{
    orderCurrency: string
    snapshot: CurrencyRatesSnapshot
    items: Prisma.OrderItemCreateWithoutOrderInput[]
    subTotal: Prisma.Decimal
    tax: Prisma.Decimal
    grandTotal: Prisma.Decimal
    delivery: Prisma.Decimal
  }> {
    const requestedOrderCurrency = dto.orderCurrency
      ? this.currencyConversion.normalizeCurrency(dto.orderCurrency)
      : null
    const normalizedOrderCurrency =
      requestedOrderCurrency ?? (await this.currencyConversion.getBaseCurrency())
    if (!normalizedOrderCurrency) {
      throw new BadRequestException('Invalid order currency')
    }
    const enabledCurrencies = await this.currencyConversion.getEnabledCurrencies()
    if (requestedOrderCurrency && !enabledCurrencies.includes(normalizedOrderCurrency)) {
      throw new BadRequestException('Order currency is not enabled in the system')
    }
    const orderCurrency = normalizedOrderCurrency

    const productIds = dto.items
      .map((item) => Number(item.productId))
      .filter((id) => Number.isFinite(id) && id > 0)

    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            currency: true,
            salePrice: true,
            costPrice: true,
            name: true,
            productCode: true,
            unitOfMeasure: true,
            specifications: true,
          },
        })
      : []
    const productMap = new Map(products.map((product) => [product.id, product]))

    const requiredCurrencies = new Set<string>([orderCurrency])

    const itemMeta = dto.items.map((item) => {
      const numericProductId = Number(item.productId)
      const product =
        Number.isFinite(numericProductId) && numericProductId > 0
          ? productMap.get(numericProductId) ?? null
          : null
      const customAttributes = this.normalizeCustomAttributes(
        (item as unknown as { customAttributes?: Record<string, unknown> }).customAttributes,
      )
      const pricingMethod = this.resolveSalesUnit(
        (item as unknown as { pricingMethod?: string }).pricingMethod,
        product?.unitOfMeasure ?? null,
      )
      const measurement = this.computeMeasurementFactor(pricingMethod, customAttributes)
      const isMeasurementBased =
        pricingMethod === SalesUnit.SQUARE_METER || pricingMethod === SalesUnit.LINEAR_METER
      const specSummary = this.buildSpecSummary(customAttributes as Prisma.JsonValue | null)
      const providedCurrency = item.currency ? this.currencyConversion.normalizeCurrency(item.currency) : null
      if (item.currency && !providedCurrency) {
        throw new BadRequestException(`Invalid currency provided for item "${item.name}"`)
      }
      const explicitUnitCurrencyRaw = (item as unknown as { unitCurrency?: string })?.unitCurrency
      const explicitUnitCurrency = explicitUnitCurrencyRaw
        ? this.currencyConversion.normalizeCurrency(explicitUnitCurrencyRaw)
        : null
      if (explicitUnitCurrencyRaw && !explicitUnitCurrency) {
        throw new BadRequestException(`Invalid unit currency provided for item "${item.name}"`)
      }
      const productCurrency = product?.currency
        ? this.currencyConversion.normalizeCurrency(product.currency)
        : null
      if (product?.currency && !productCurrency) {
        throw new BadRequestException(`Unsupported currency configured for product "${product.name}"`)
      }
      if (productCurrency) {
        requiredCurrencies.add(productCurrency)
      }
      const unitCurrency = explicitUnitCurrency ?? productCurrency ?? providedCurrency ?? orderCurrency
      requiredCurrencies.add(unitCurrency)
      if (providedCurrency) {
        requiredCurrencies.add(providedCurrency)
      }
      const priceCurrency = providedCurrency ?? orderCurrency
      requiredCurrencies.add(priceCurrency)
      const qtyRaw = Number(item.qty ?? 1)
      const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? Math.round(qtyRaw) : 1
      const priceValue = Number(item.price)
      const fallbackPrice = Number(product?.salePrice ?? 0)
      const rawPrice = Number.isFinite(priceValue) ? priceValue : fallbackPrice
      const explicitUnitPriceValue = Number((item as unknown as { unitPrice?: number })?.unitPrice)
      const explicitUnitAmount = Number.isFinite(explicitUnitPriceValue)
        ? roundDecimal(explicitUnitPriceValue, 4)
        : null
      const unitCost = product?.costPrice ? roundDecimal(product.costPrice, 4) : null
      const costCurrency = productCurrency ?? explicitUnitCurrency ?? providedCurrency ?? orderCurrency
      if (unitCost && costCurrency) {
        requiredCurrencies.add(costCurrency)
      }
      return {
        item,
        product,
        priceCurrency,
        rawPrice,
        unitCurrency,
        qty,
        numericProductId,
        explicitUnitAmount,
        unitCost,
        costCurrency,
        customAttributes,
        pricingMethod,
        measurement,
        isMeasurementBased,
        specSummary,
      }
    })

    const snapshot = await this.currencyConversion.buildRatesSnapshot(Array.from(requiredCurrencies))
    let subTotal = decimal(0)
    const createItems: Prisma.OrderItemCreateWithoutOrderInput[] = []

    for (const meta of itemMeta) {
      const qtyDecimal = decimal(meta.qty)
      const hasMeasurement =
        meta.isMeasurementBased &&
        meta.measurement !== null &&
        meta.measurement !== undefined &&
        meta.measurement > 0
      const measurementValue = hasMeasurement ? Number(meta.measurement) : 1
      const measurementDecimal = decimal(measurementValue)

      let unitAmount: Prisma.Decimal
      let unitAmountOrderCurrency: Prisma.Decimal
      let conversionRate: Prisma.Decimal
      let derivedUnitOrderCurrency: Prisma.Decimal

      if (meta.explicitUnitAmount !== null && meta.explicitUnitAmount !== undefined) {
        unitAmount = roundDecimal(meta.explicitUnitAmount, 4)
        const unitConversion = this.currencyConversion.convertWithSnapshot(
          unitAmount,
          meta.unitCurrency,
          orderCurrency,
          snapshot,
          { amountScale: 4, rateScale: 8 },
        )
        unitAmountOrderCurrency = roundDecimal(unitConversion.amount, 4)
        conversionRate = unitConversion.rate
        derivedUnitOrderCurrency = hasMeasurement
          ? roundDecimal(multiplyDecimals(unitAmountOrderCurrency, measurementDecimal), 4)
          : unitAmountOrderCurrency
      } else {
        const priceDecimal = roundDecimal(meta.rawPrice, 4)
        const perInstanceConversion = this.currencyConversion.convertWithSnapshot(
          priceDecimal,
          meta.priceCurrency,
          orderCurrency,
          snapshot,
          { amountScale: 4, rateScale: 8 },
        )
        derivedUnitOrderCurrency = roundDecimal(perInstanceConversion.amount, 4)
        conversionRate = perInstanceConversion.rate
        unitAmountOrderCurrency = hasMeasurement
          ? roundDecimal(divideDecimals(derivedUnitOrderCurrency, measurementDecimal), 4)
          : derivedUnitOrderCurrency

        if (meta.priceCurrency === meta.unitCurrency) {
          unitAmount = hasMeasurement
            ? roundDecimal(divideDecimals(priceDecimal, measurementDecimal), 4)
            : priceDecimal
        } else {
          const perMeasurementBase = hasMeasurement
            ? roundDecimal(divideDecimals(priceDecimal, measurementDecimal), 4)
            : priceDecimal
          const perUnitConversion = this.currencyConversion.convertWithSnapshot(
            perMeasurementBase,
            meta.priceCurrency,
            meta.unitCurrency,
            snapshot,
            { amountScale: 4, rateScale: 8 },
          )
          unitAmount = roundDecimal(perUnitConversion.amount, 4)
        }
      }

      const unitPriceRounded = roundDecimal(derivedUnitOrderCurrency, 2)
      const lineTotal = roundDecimal(multiplyDecimals(unitPriceRounded, qtyDecimal), 2)
      subTotal = subTotal.plus(lineTotal)

      let unitCostOrderCurrency: Prisma.Decimal | null = null
      if (meta.unitCost) {
        const costConversion = this.currencyConversion.convertWithSnapshot(
          meta.unitCost,
          meta.costCurrency,
          orderCurrency,
          snapshot,
          { amountScale: 4, rateScale: 8 },
        )
        const costAmountOrderCurrency = roundDecimal(costConversion.amount, 4)
        unitCostOrderCurrency = hasMeasurement
          ? roundDecimal(multiplyDecimals(costAmountOrderCurrency, measurementDecimal), 4)
          : costAmountOrderCurrency
      }

      const unitPriceSnapshotDecimal =
        meta.explicitUnitAmount !== null && meta.explicitUnitAmount !== undefined
          ? roundDecimal(meta.explicitUnitAmount, 4)
          : unitAmount
      const skuSnapshot = meta.product?.productCode ?? null
      const nameSnapshot = meta.product?.name ?? meta.item.name
      const comments = meta.item.comments?.trim?.() ? meta.item.comments.trim() : null
      const customAttributesJson = meta.customAttributes as Prisma.InputJsonValue | undefined
      const specJson = meta.customAttributes as Prisma.InputJsonValue | undefined

      const itemData: Prisma.OrderItemCreateWithoutOrderInput = {
        product:
          meta.product && meta.numericProductId
            ? { connect: { id: meta.numericProductId } }
            : undefined,
        name: meta.item.name,
        price: unitPriceRounded.toFixed(2),
        qty: meta.qty,
        img: meta.item.img ?? null,
        description: meta.item.description ?? null,
        comments,
        unitAmount: unitAmount.toFixed(4),
        unitCurrency: meta.unitCurrency,
        unitAmountOrderCurrency: unitAmountOrderCurrency.toFixed(4),
        conversionRate: conversionRate.toFixed(8),
        unitCostAmount: meta.unitCost ? meta.unitCost.toFixed(4) : undefined,
        unitCostCurrency: meta.unitCost ? meta.costCurrency : undefined,
        unitCostOrderCurrency: unitCostOrderCurrency ? unitCostOrderCurrency.toFixed(4) : undefined,
        customAttributes: customAttributesJson,
        pricingMethodSnapshot: meta.pricingMethod ?? undefined,
        unitPriceSnapshot: unitPriceSnapshotDecimal.toFixed(4),
        skuSnapshot: skuSnapshot ?? undefined,
        nameSnapshot: nameSnapshot ?? undefined,
        specSummary: meta.specSummary ?? undefined,
        specJson,
      }
      createItems.push(itemData)
    }

    if (!createItems.length) {
      throw new BadRequestException('Order items are invalid or empty')
    }

    const delivery = roundDecimal(dto.shipping?.deliveryFees ?? 0, 2)
    const taxRateDecimal = decimal(taxRate)
    const taxFraction = divideDecimals(taxRateDecimal, addDecimals(decimal(100), taxRateDecimal))
    const tax = roundDecimal(multiplyDecimals(subTotal, taxFraction), 2)
    const grandTotal = roundDecimal(addDecimals(subTotal, delivery), 2)

    return {
      orderCurrency,
      snapshot,
      items: createItems,
      subTotal,
      tax,
      grandTotal,
      delivery,
    }
  }

  private resolveScalarParam(raw: unknown): string {
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string' || typeof item === 'number') {
          return String(item)
        }
      }
      return ''
    }
    if (typeof raw === 'string' || typeof raw === 'number') {
      return String(raw)
    }
    return ''
  }

  private normalizeOrderDirection(value: string): 'asc' | 'desc' | undefined {
    const normalized = value?.toLowerCase?.() || ''
    if (normalized === 'asc' || normalized === 'ascending' || normalized === 'ascend') {
      return 'asc'
    }
    if (normalized === 'desc' || normalized === 'descending' || normalized === 'descend') {
      return 'desc'
    }
    return undefined
  }

  private normalizeOrderSortKey(key: string): OrderSortKey | undefined {
    const normalized = key?.toString?.().trim()
    if (!normalized) return undefined
    if (['id', 'date', 'customer', 'status', 'statusId', 'paymentMehod', 'totalAmount', 'validUntilDate'].includes(normalized)) {
      return normalized as OrderSortKey
    }
    return undefined
  }

  private parseSortObject(raw: unknown): Record<string, unknown> | undefined {
    if (!raw) return undefined
    if (typeof raw === 'object') return raw as Record<string, unknown>
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined
      } catch {
        return undefined
      }
    }
    return undefined
  }

  private extractOrderSort(q: any): { key: OrderSortKey; order: 'asc' | 'desc' } | undefined {
    let sortObj: Record<string, unknown> | undefined = this.parseSortObject(q?.sort)
    if (!sortObj) {
      const nestedKey = q?.['sort[key]'] ?? q?.['sort.key']
      const nestedOrder = q?.['sort[order]'] ?? q?.['sort.order']
      if (nestedKey !== undefined || nestedOrder !== undefined) {
        sortObj = { key: nestedKey, order: nestedOrder }
      }
    }
    if (!sortObj) {
      if (q?.sortKey !== undefined || q?.sortOrder !== undefined) {
        sortObj = { key: q?.sortKey, order: q?.sortOrder }
      }
    }
    const sortKeyRaw = this.resolveScalarParam(sortObj?.key)
    const sortOrderRaw = this.resolveScalarParam(sortObj?.order)
    const key = this.normalizeOrderSortKey(sortKeyRaw)
    const order = this.normalizeOrderDirection(sortOrderRaw)
    if (!key || !order) return undefined
    return { key, order }
  }

  private buildOrderOrderBy(sort?: { key: OrderSortKey; order: 'asc' | 'desc' }): Prisma.OrderOrderByWithRelationInput[] {
    const orderBy: Prisma.OrderOrderByWithRelationInput[] = []
    if (sort) {
      switch (sort.key) {
        case 'id':
          orderBy.push({ id: sort.order })
          break
        case 'date':
          orderBy.push({ date: sort.order })
          break
        case 'validUntilDate':
          orderBy.push({ validUntil: sort.order })
          break
        case 'customer':
          orderBy.push({ customer: { name: sort.order } })
          break
        case 'status':
          orderBy.push({ statusId: sort.order })
          break
        case 'statusId':
          orderBy.push({ statusId: sort.order })
          break
        case 'paymentMehod':
          orderBy.push({ paymentMethodId: sort.order })
          break
        case 'totalAmount':
          orderBy.push({ grandTotal: sort.order })
          break
      }
    }
    if (!orderBy.length) {
      orderBy.push({ id: 'desc' })
    } else if (sort?.key !== 'id') {
      orderBy.push({ id: 'desc' })
    }
    return orderBy
  }

  private buildOrderSearchWhere(raw: unknown, documentType: DocumentType): Prisma.OrderWhereInput | undefined {
    const queryValue = this.resolveScalarParam(raw).trim()
    if (!queryValue) return undefined
    const terms = queryValue.split(/\s+/).map((term) => term.trim()).filter(Boolean)
    if (!terms.length) return undefined

    const andConditions: Prisma.OrderWhereInput[] = terms.map((term) => {
      const sanitizedTerm = term.replace(/^#/, '')
      const digitsOnly = sanitizedTerm.replace(/[^\d]/g, '')
      const numericId = digitsOnly ? Number(digitsOnly) : undefined
      const paymentMethodIds = this.findPaymentMethodIdsByTerm(term)
      const statusIds = this.findStatusIdsByTerm(term, documentType)
      const orConditions: Prisma.OrderWhereInput[] = [
        { customer: { name: { contains: term, mode: 'insensitive' } } },
        { customer: { email: { contains: term, mode: 'insensitive' } } },
        { customer: { phoneNumber: { contains: term, mode: 'insensitive' } } },
        { shippingAddress1: { contains: term, mode: 'insensitive' } },
        { shippingAddress2: { contains: term, mode: 'insensitive' } },
        { shippingCity: { contains: term, mode: 'insensitive' } },
        { shippingState: { contains: term, mode: 'insensitive' } },
      ]
      if (paymentMethodIds.length) {
        orConditions.push({ paymentMethodId: { in: paymentMethodIds } })
      }
      if (statusIds.length) {
        orConditions.push({ statusId: { in: statusIds } })
      }
      if (numericId && Number.isFinite(numericId)) {
        orConditions.push({ id: numericId })
      }
      return { OR: orConditions }
    })

    return { AND: andConditions }
  }

  private buildCsv(rows: unknown[][]): string {
    return rows
      .map((row) =>
        row
          .map((value) => {
            if (value === null || value === undefined) {
              return ''
            }
            const str = String(value)
            if (str.includes('"') || str.includes(',') || /\s/.test(str)) {
              return '"' + str.replace(/"/g, '""') + '"'
            }
            return str
          })
          .join(','),
      )
      .join('\n')
  }

  private parseCsv(content: string): string[][] {
    const rows: string[][] = []
    let currentRow: string[] = []
    let currentValue = ''
    let inQuotes = false

    const pushValue = () => {
      currentRow.push(currentValue)
      currentValue = ''
    }

    for (let i = 0; i < content.length; i += 1) {
      const char = content[i]
      const nextChar = content[i + 1]
      if (inQuotes) {
        if (char === '"' && nextChar === '"') {
          currentValue += '"'
          i += 1
          continue
        }
        if (char === '"') {
          inQuotes = false
          continue
        }
        currentValue += char
      } else {
        if (char === '"') {
          inQuotes = true
        } else if (char === ',') {
          pushValue()
        } else if (char === '\n') {
          pushValue()
          rows.push(currentRow)
          currentRow = []
        } else if (char === '\r') {
          continue
        } else {
          currentValue += char
        }
      }
    }
    pushValue()
    if (currentRow.length) {
      rows.push(currentRow)
    }
    return rows
  }

  private normalizeHeaderKey(key: string | undefined | null): string {
    if (!key) return ''
    return String(key).trim().toLowerCase().replace(/\s+/g, '')
  }

  private getCell(row: string[], columnIndex: Map<string, number>, key: string, aliases: string[] = []): string {
    const normalizedKey = this.normalizeHeaderKey(key)
    const candidates = [normalizedKey, ...aliases.map((alias) => this.normalizeHeaderKey(alias))]
    for (const candidate of candidates) {
      if (!candidate) continue
      if (columnIndex.has(candidate)) {
        const idx = columnIndex.get(candidate) as number
        return row[idx] ?? ''
      }
    }
    return ''
  }

  private parseNumber(value?: string | number | null): number {
    if (value === undefined || value === null || value === '') return 0
    const num = Number(value)
    return Number.isNaN(num) ? 0 : num
  }

  private parseDate(value?: string | number | null): Date | undefined {
    if (value === undefined || value === null || value === '') return undefined
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? undefined : date
  }

  private async resolveCustomer(
    email: string,
    name: string,
    phone: string | undefined,
    cache: Map<string, { id: number }>,
  ) {
    const cached = cache.get(email)
    if (cached) return cached

    const existing = await this.prisma.customer.findUnique({ where: { email } })
    if (existing) {
      cache.set(email, { id: existing.id })
      return { id: existing.id }
    }

    const created = await this.prisma.customer.create({
      data: {
        email,
        name,
        phoneNumber: phone || null,
      },
      select: { id: true },
    })
    cache.set(email, created)
    return created
  }

  private async resolvePaymentMethod(
    name: string,
    cache: Map<string, number>,
  ) {
    const trimmed = name.trim()
    if (!trimmed) {
      return null
    }
    const normalized = trimmed.toLowerCase()
    if (cache.has(normalized)) {
      return cache.get(normalized) as number
    }

    const definition = matchPaymentMethod(trimmed) ?? matchPaymentMethod(normalized)
    if (definition) {
      cache.set(normalized, definition.id)
      return definition.id
    }

    const numeric = Number(trimmed)
    if (Number.isFinite(numeric) && numeric > 0) {
      const byId = findPaymentMethodById(numeric)
      if (byId) {
        cache.set(normalized, byId.id)
        return byId.id
      }
    }

    if (DEFAULT_PAYMENT_METHOD_ID) {
      cache.set(normalized, DEFAULT_PAYMENT_METHOD_ID)
      return DEFAULT_PAYMENT_METHOD_ID
    }

    return null
  }

  private async resolveStatus(
    row: string[],
    columnIndex: Map<string, number>,
    documentType: DocumentType,
    statusById: Map<number, number>,
    statusByName: Map<string, number>,
    defaultStatusId?: number,
  ) {
    const rawStatusId = this.getCell(row, columnIndex, 'statusId', ['status'])
    const rawStatusName = this.getCell(row, columnIndex, 'statusName')
    if (rawStatusId) {
      const numericStatus = rawStatusId ? Math.round(this.parseNumber(rawStatusId)) : 0
      if (numericStatus && statusById.has(numericStatus)) {
        return statusById.get(numericStatus) as number
      }
      if (numericStatus) {
        const definition = findOrderStatusById(numericStatus)
        if (definition && definition.documentTypes.includes(documentType)) {
          statusById.set(numericStatus, definition.id)
          statusByName.set(definition.label.toLowerCase(), definition.id)
          return definition.id
        }
      }
    }
    if (rawStatusName) {
      const nameKey = rawStatusName.trim().toLowerCase()
      if (statusByName.has(nameKey)) {
        return statusByName.get(nameKey) as number
      }
      const matched = matchOrderStatus(rawStatusName, documentType)
      if (matched) {
        statusByName.set(nameKey, matched.id)
        statusById.set(matched.id, matched.id)
        return matched.id
      }
    }
    return defaultStatusId ?? null
  }

  async listDocuments(documentType: DocumentType, q: any) {
    const pageIndexRaw = Number(q.pageIndex)
    const pageSizeRaw = Number(q.pageSize)
    const pageIndex = Number.isFinite(pageIndexRaw) && pageIndexRaw > 0 ? Math.floor(pageIndexRaw) : 1
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : 50

    const where = this.withDocumentType(documentType, this.buildOrderSearchWhere(q.query, documentType) ?? {})
    const total = await this.prisma.order.count({ where })
    const sort = this.extractOrderSort(q)
    const orderBy = this.buildOrderOrderBy(sort)

    const orders = await this.prisma.order.findMany({
      where,
      orderBy,
      skip: (pageIndex - 1) * pageSize,
      take: pageSize,
      include: {
        customer: true,
      },
    })

    let paymentSummaryByOrderId: Map<number, OrderPaymentSummary> | null = null
    if (documentType === DocumentType.ORDER && orders.length) {
      const summaries = await Promise.all(
        orders.map(async (order) => {
          try {
            return await this.orderFinance.getOrderPaymentSummary(order.id)
          } catch (error) {
            this.logger.warn(
              `Failed to compute payment summary for order ${order.id}: ${(error as Error).message}`,
            )
            return null
          }
        }),
      )
      paymentSummaryByOrderId = new Map<number, OrderPaymentSummary>()
      summaries.forEach((summary) => {
        if (summary) {
          paymentSummaryByOrderId?.set(summary.orderId, summary)
        }
      })
    }

    const defaultStatus = documentType === DocumentType.BUDGET
      ? this.getDefaultStatusRecord(DocumentType.BUDGET, ORDER_STATUS_CODES.BUDGET_DRAFT)
      : await this.getDefaultOrderStatus()

    const data = orders.map((o: OrderWithRelations) => {
      const validity = o.validUntil ? new Date(o.validUntil).toISOString() : null
      const statusRecord = this.getStatusRecordById(o.statusId ?? null, documentType) ?? defaultStatus
      const paymentMethodRecord = this.getPaymentMethodRecordById(o.paymentMethodId ?? null)
      const paymentSummary = paymentSummaryByOrderId?.get(o.id) ?? null
      const outstandingNumber = paymentSummary ? this.decimalToNumber(paymentSummary.outstanding) : null
      const totalPaidNumber = paymentSummary ? this.decimalToNumber(paymentSummary.totalPaidConfirmed) : null
      const normalizedStatusId = this.resolvePaymentAwareStatus(
        documentType,
        statusRecord?.id ?? null,
        outstandingNumber,
      )
      return {
        id: String(o.id),
        uuid: o.uuid ?? null,
        orderNumber: o.uuid ?? null,
        reference: o.uuid ?? null,
        date: Math.floor(new Date(o.date).getTime() / 1000),
        validUntilDate: validity,
        validityDate: validity,
        customer: o.customer?.name || '',
        status: normalizedStatusId,
        paymentMehod: paymentMethodRecord?.name ?? '',
        paymentIdendifier: '',
        totalAmount: Number(o.grandTotal?.toString?.() ?? o.grandTotal ?? 0),
        orderCurrency: o.orderCurrency,
        payments: paymentSummary
          ? {
              summary: {
                currency: paymentSummary.currency,
                totalPaidConfirmed: totalPaidNumber ?? 0,
                outstanding: outstandingNumber ?? 0,
              },
            }
          : undefined,
      }
    })
    return { data, total }
  }

  async exportDocuments(documentType: DocumentType, q: any): Promise<StreamableFile> {
    const where = this.withDocumentType(documentType, this.buildOrderSearchWhere(q.query, documentType) ?? {})
    const sort = this.extractOrderSort(q)
    const orderBy = this.buildOrderOrderBy(sort)

    const orders = await this.prisma.order.findMany({
      where,
      orderBy,
      include: {
        customer: true,
      },
    })
    const defaultStatus = documentType === DocumentType.BUDGET
      ? this.getDefaultStatusRecord(DocumentType.BUDGET, ORDER_STATUS_CODES.BUDGET_DRAFT)
      : await this.getDefaultOrderStatus()

    const header: unknown[] = [
      'id',
      'date',
      'customer',
      'customerEmail',
      'customerPhone',
      'statusId',
      'statusName',
      'paymentMethod',
      'grandTotal',
      'orderCurrency',
      'fxBase',
      'fxRates',
      'subTotal',
      'tax',
      'deliveryFees',
      'shippingCity',
      'shippingState',
      'shippingVendor',
      'billingCity',
      'billingState',
      'comment',
      'createdAt',
      'updatedAt',
    ]

    const dataRows: unknown[][] = orders.map((order: OrderWithRelations) => {
      const statusRecord = this.getStatusRecordById(order.statusId ?? null, documentType) ?? defaultStatus
      const paymentMethodRecord = this.getPaymentMethodRecordById(order.paymentMethodId ?? null)
      const statusId = statusRecord?.id ?? ''
      const statusName = statusRecord?.name ?? ''
      return [
        order.id,
        order.date instanceof Date ? order.date.toISOString() : new Date(order.date).toISOString(),
        order.customer?.name ?? '',
        order.customer?.email ?? '',
        order.customer?.phoneNumber ?? '',
        statusId,
        statusName,
        paymentMethodRecord?.name ?? '',
        order.grandTotal !== null && order.grandTotal !== undefined ? order.grandTotal.toFixed(2) : '',
        order.orderCurrency ?? '',
        order.fxBase ?? '',
        order.fxRates ? JSON.stringify(order.fxRates) : '',
        order.subTotal !== null && order.subTotal !== undefined ? order.subTotal.toFixed(2) : '',
        order.tax !== null && order.tax !== undefined ? order.tax.toFixed(2) : '',
        order.deliveryFees !== null && order.deliveryFees !== undefined ? order.deliveryFees.toFixed(2) : '',
        order.shippingCity ?? '',
        order.shippingState ?? '',
        order.shippingVendor ?? '',
        order.billingCity ?? '',
        order.billingState ?? '',
        order.comment ?? '',
        order.createdAt instanceof Date ? order.createdAt.toISOString() : new Date(order.createdAt).toISOString(),
        order.updatedAt instanceof Date ? order.updatedAt.toISOString() : new Date(order.updatedAt).toISOString(),
      ]
    })

    const csv = this.buildCsv([header, ...dataRows])
    const filename = `orders-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    })
  }

  async importDocuments(documentType: DocumentType, req: FastifyRequest) {
    const file = await (req as any)?.file?.()
    if (!file) throw new BadRequestException('sales.orders.import.fileRequired')
    const buffer = await file.toBuffer()
    if (!buffer || buffer.length === 0) throw new BadRequestException('sales.orders.import.emptyFile')

    const rows = this.parseCsv(buffer.toString('utf8'))
    if (!rows.length) throw new BadRequestException('sales.orders.import.emptyFile')

    const header = rows.shift() ?? []
    const columnIndex = new Map<string, number>()
    header.forEach((col, idx) => {
      const normalized = this.normalizeHeaderKey(col)
      if (normalized) columnIndex.set(normalized, idx)
    })

    const requiredColumns = ['customerEmail', 'grandTotal']
    const missingColumns = requiredColumns.filter(
      (col) => !columnIndex.has(this.normalizeHeaderKey(col)),
    )
    if (missingColumns.length) {
      throw new BadRequestException(`Missing required columns: ${missingColumns.join(', ')}`)
    }

    const defaultStatus = await this.getDefaultOrderStatus()
    const statusById = new Map<number, number>()
    const statusByName = new Map<string, number>()
    if (defaultStatus?.id) {
      statusById.set(defaultStatus.id, defaultStatus.id)
      if (defaultStatus.name) statusByName.set(defaultStatus.name.toLowerCase(), defaultStatus.id)
    }

    const paymentCache = new Map<string, number>()
    const customerCache = new Map<string, any>()

    const errors: { row: number; message: string }[] = []
    let imported = 0

    const enabledCurrencies = await this.currencyConversion.getEnabledCurrencies()
    const baseCurrency = await this.currencyConversion.getBaseCurrency()
    const defaultOrderCurrency =
      this.currencyConversion.normalizeCurrency(enabledCurrencies[0]) ?? baseCurrency
    const baseRates = await this.currencyConversion.listRates(baseCurrency)
    const defaultFxRates = {
      base: baseCurrency,
      generatedAt: new Date().toISOString(),
      rates: baseRates.reduce(
        (acc, rate) => {
          acc[rate.quote] = new Prisma.Decimal(rate.rate).toFixed(8)
          return acc
        },
        { [baseCurrency]: '1' } as Record<string, string>,
      ),
    }
    const cloneDefaultFxRates = () => JSON.parse(JSON.stringify(defaultFxRates))

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]
      const lineNumber = i + 2
      try {
        const rawId = this.getCell(row, columnIndex, 'id')
        if (rawId) {
          const numericId = Math.round(this.parseNumber(rawId))
          if (numericId > 0) {
            const exists = await this.prisma.order.findFirst({
              where: { id: numericId, documentType },
            })
            if (exists) {
              errors.push({ row: lineNumber, message: `Order with id ${numericId} already exists` })
              continue
            }
          }
        }

        const email = this.getCell(row, columnIndex, 'customerEmail')
        if (!email) throw new Error('customerEmail is required')
        const name = this.getCell(row, columnIndex, 'customer') || email
        const phone = this.getCell(row, columnIndex, 'customerPhone')
        const customer = await this.resolveCustomer(email, name, phone, customerCache)

        const paymentName = this.getCell(row, columnIndex, 'paymentMethod', ['paymentMehod'])
        const paymentMethodId = await this.resolvePaymentMethod(paymentName || 'Cash', paymentCache)

        const statusId = await this.resolveStatus(
          row,
          columnIndex,
          documentType,
          statusById,
          statusByName,
          defaultStatus?.id,
        )

        const date = this.parseDate(this.getCell(row, columnIndex, 'date')) || new Date()
        const createdAt = this.parseDate(this.getCell(row, columnIndex, 'createdAt'))
        const shippingCity = this.getCell(row, columnIndex, 'shippingCity')
        const shippingState = this.getCell(row, columnIndex, 'shippingState')
        const shippingVendor = this.getCell(row, columnIndex, 'shippingVendor')
        const billingCity = this.getCell(row, columnIndex, 'billingCity')
        const billingState = this.getCell(row, columnIndex, 'billingState')
        const comment = this.getCell(row, columnIndex, 'comment')
        const grandTotal = this.parseNumber(this.getCell(row, columnIndex, 'grandTotal'))
        const subTotalCell = this.getCell(row, columnIndex, 'subTotal')
        const subTotal = subTotalCell ? this.parseNumber(subTotalCell) : grandTotal
        const tax = this.parseNumber(this.getCell(row, columnIndex, 'tax'))
        const deliveryFees = this.parseNumber(this.getCell(row, columnIndex, 'deliveryFees'))
        const orderCurrencyRaw = this.getCell(row, columnIndex, 'orderCurrency')
        const orderCurrency =
          this.currencyConversion.normalizeCurrency(orderCurrencyRaw) ?? defaultOrderCurrency
        const fxBaseRaw = this.getCell(row, columnIndex, 'fxBase')
        const fxBase = this.currencyConversion.normalizeCurrency(fxBaseRaw) ?? defaultFxRates.base
        const fxRatesCell = this.getCell(row, columnIndex, 'fxRates')
        let fxRates: any = cloneDefaultFxRates()
        if (fxRatesCell) {
          try {
            const parsed = JSON.parse(fxRatesCell)
            if (parsed && typeof parsed === 'object') {
              fxRates = parsed
            }
          } catch {
            fxRates = cloneDefaultFxRates()
          }
        }
        if (!fxRates || typeof fxRates !== 'object') {
          fxRates = cloneDefaultFxRates()
        }
        fxRates.base = fxBase
        if (!fxRates.rates || typeof fxRates.rates !== 'object') {
          fxRates.rates = { [fxBase]: '1' }
        } else if (!fxRates.rates[fxBase]) {
          fxRates.rates[fxBase] = '1'
        }

        await this.prisma.order.create({
          data: {
            documentType,
            customerId: customer.id,
            date,
            createdAt: createdAt ?? undefined,
            updatedAt: createdAt ?? undefined,
            statusId,
            paymentMethodId,
            shippingCity: shippingCity || null,
            shippingState: shippingState || null,
            shippingVendor: shippingVendor || null,
            billingCity: billingCity || null,
            billingState: billingState || null,
            comment: comment || null,
            grandTotal,
            subTotal,
            tax,
            deliveryFees,
            orderCurrency,
            fxBase,
            fxRates,
          },
        })
        imported += 1
      } catch (error: any) {
        errors.push({ row: lineNumber, message: error?.message || 'Unknown error' })
      }
    }

    return { imported, errors }
  }

  async deleteDocuments(documentType: DocumentType, idPayload: { id: string | string[] }) {
    const ids = Array.isArray(idPayload.id) ? idPayload.id : [idPayload.id]
    const numericIds = ids.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    if (!numericIds.length) {
      throw new BadRequestException('sales.orders.validation.invalidIds')
    }
    const documents = await this.prisma.order.findMany({
      where: { id: { in: numericIds }, documentType },
      select: { documentFilePath: true },
    })

    await this.prisma.order.deleteMany({ where: { id: { in: numericIds }, documentType } })

    await Promise.all(documents.map((doc) => deleteSalesDocumentFile(doc.documentFilePath)))
    return { deleted: numericIds.length }
  }

  async getDocumentDetails(documentType: DocumentType, id: number) {
    const order = await this.prisma.order.findFirst({
      where: { id, documentType },
      include: {
        customer: {
          include: {
            addresses: {
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            },
          },
        },
        items: { include: { product: true } },
        payments: {
          include: {
            attachments: {
              select: {
                id: true,
                name: true,
                mimeType: true,
                size: true,
                createdAt: true,
              },
            },
          },
          orderBy: { date: 'asc' },
        },
        activity: {
          include: {
            eventType: true,
          },
        },
      },
    })
    if (!order) return null
    const paymentMethodRecord = this.getPaymentMethodRecordById(order.paymentMethodId ?? null)
    const statusRecord = this.getStatusRecordById(order.statusId ?? null, documentType)
    const customerAddresses = order.customer?.addresses ?? []
    const primaryAddress =
      customerAddresses.find((addr) => addr.isPrimary) ?? customerAddresses[0] ?? null
    const secondaryAddress =
      customerAddresses.find((addr) => !addr.isPrimary && addr.id !== primaryAddress?.id) ?? null

    const normalizeString = (value?: string | null) => {
      if (typeof value !== 'string') {
        return null
      }
      const trimmed = value.trim()
      return trimmed.length ? trimmed : null
    }

    const formatLine1 = (addr: CustomerAddress | null) => {
      if (!addr) {
        return null
      }
      const line = [normalizeString(addr.street), normalizeString(addr.number)]
        .filter((segment): segment is string => Boolean(segment))
        .join(' ')
      return line.length ? line : null
    }

    const formatLine2 = (addr: CustomerAddress | null) => {
      if (!addr) {
        return null
      }
      const apartment = normalizeString(addr.apartment)
      const corner = normalizeString(addr.corner)
      const parts = [
        apartment ? `Apt ${apartment}` : null,
        corner,
      ].filter((segment): segment is string => Boolean(segment))
      if (!parts.length) {
        return null
      }
      return parts.join(' • ')
    }

    const shippingAddressSource = primaryAddress
    const billingAddressSource = secondaryAddress ?? primaryAddress

    const shippingAddress1 =
      normalizeString(order.shippingAddress1) ?? formatLine1(shippingAddressSource)
    const shippingAddress2 =
      normalizeString(order.shippingAddress2) ?? formatLine2(shippingAddressSource)
    const shippingCity =
      normalizeString(order.shippingCity) ?? normalizeString(shippingAddressSource?.city)
    const shippingState = normalizeString(order.shippingState)
    const shippingCountry =
      normalizeString((order as { shippingCountry?: string | null }).shippingCountry) ??
      normalizeString(shippingAddressSource?.country)
    const billingAddress1 =
      normalizeString(order.billingAddress1) ?? formatLine1(billingAddressSource)
    const billingAddress2 =
      normalizeString(order.billingAddress2) ?? formatLine2(billingAddressSource)
    const billingCity =
      normalizeString(order.billingCity) ?? normalizeString(billingAddressSource?.city)
    const billingState = normalizeString(order.billingState)
    const billingCountry =
      normalizeString((order as { billingCountry?: string | null }).billingCountry) ??
      normalizeString(billingAddressSource?.country)

    const [previousOrdersCount, previousBudgetsCount] = await Promise.all([
      this.prisma.order.count({
        where: {
          customerId: order.customerId,
          id: { not: order.id },
          documentType: DocumentType.ORDER,
        },
      }),
      this.prisma.order.count({
        where: {
          customerId: order.customerId,
          documentType: DocumentType.BUDGET,
          ...(order.documentType === DocumentType.BUDGET
            ? { id: { not: order.id } }
            : {}),
        },
      }),
    ])

    const customer = order.customer
      ? (() => {
          const { addresses: _addresses, ...rest } = order.customer
          return {
            ...rest,
            previousOrder: previousOrdersCount,
            previousBudgets: previousBudgetsCount,
          }
        })()
      : null

    const disclaimer =
      order.disclaimer ?? (await this.getDefaultDocumentDisclaimer()) ?? null

    const validity = order.validUntil ? order.validUntil.toISOString() : null

    let paymentSummary: Awaited<ReturnType<OrderFinanceService['getOrderPaymentSummary']>> | null = null
    try {
      paymentSummary = await this.orderFinance.getOrderPaymentSummary(order.id)
    } catch (error) {
      paymentSummary = null
    }

    return {
      id: order.id,
      uuid: order.uuid ?? null,
      orderNumber: order.uuid ?? null,
      reference: order.uuid ?? null,
      date: order.date,
      validUntilDate: validity,
      validityDate: validity,
      customer,
      items: order.items.map((item) => ({
        ...item,
        price: Number(item.price?.toString?.() ?? item.price ?? 0),
        unitAmount: item.unitAmount ? Number(item.unitAmount.toString()) : null,
        unitAmountOrderCurrency: item.unitAmountOrderCurrency
          ? Number(item.unitAmountOrderCurrency.toString())
          : null,
        conversionRate: item.conversionRate ? Number(item.conversionRate.toString()) : null,
        unitCostAmount: item.unitCostAmount ? Number(item.unitCostAmount.toString()) : null,
        unitCostOrderCurrency: item.unitCostOrderCurrency
          ? Number(item.unitCostOrderCurrency.toString())
          : null,
        unitCurrency: item.unitCurrency ?? null,
        unitCostCurrency: item.unitCostCurrency ?? null,
        comments: item.comments ?? null,
      })),
      paymentMethod: paymentMethodRecord,
      status: statusRecord,
      activity: this.toActivitySummary(order.activity as CalendarEventWithType | null),
      activityId: order.activityId ?? null,
      subTotal: Number(order.subTotal?.toString?.() ?? order.subTotal ?? 0),
      tax: Number(order.tax?.toString?.() ?? order.tax ?? 0),
      deliveryFees: order.deliveryFees === null ? null : Number(order.deliveryFees.toString()),
      grandTotal: Number(order.grandTotal?.toString?.() ?? order.grandTotal ?? 0),
      documentFilePath: order.documentFilePath ?? null,
      documentFileName: order.documentFileName ?? null,
      documentFileMime: order.documentFileMime ?? null,
      documentFileSize: order.documentFileSize ?? null,
      documentGeneratedAt: order.documentGeneratedAt ?? null,
      orderCurrency: order.orderCurrency,
      fxBase: order.fxBase,
      fxRates: order.fxRates,
      comment: order.comment,
      billingSameAsShipping: order.billingSameAsShipping,
      shippingAddress1: shippingAddress1 ?? null,
      shippingAddress2: shippingAddress2 ?? null,
      shippingCity: shippingCity ?? null,
      shippingState: shippingState ?? null,
      shippingZip: normalizeString(order.shippingZip),
      shippingCountry: shippingCountry ?? null,
      billingAddress1: billingAddress1 ?? null,
      billingAddress2: billingAddress2 ?? null,
      billingCity: billingCity ?? null,
      billingState: billingState ?? null,
      billingZip: normalizeString(order.billingZip),
      billingCountry: billingCountry ?? null,
      shippingVendor: order.shippingVendor ?? null,
      estimatedMin: order.estimatedMin ?? null,
      estimatedMax: order.estimatedMax ?? null,
      disclaimer,
      minimumDepositType: order.minimumDepositType,
      minimumDepositValue: Number(
        order.minimumDepositValue?.toString?.() ?? order.minimumDepositValue ?? 0,
      ),
      customerCredit: Number(
        order.customerCredit?.toString?.() ?? order.customerCredit ?? 0,
      ),
      confirmedAt: order.confirmedAt ? order.confirmedAt.toISOString() : null,
      depositSatisfiedAt: order.depositSatisfiedAt ? order.depositSatisfiedAt.toISOString() : null,
      payments: {
        summary: paymentSummary
          ? {
              currency: paymentSummary.currency,
              depositRequired: Number(paymentSummary.depositRequired.toString()),
              depositPaidConfirmed: Number(paymentSummary.depositPaidConfirmed.toString()),
              balancePaidConfirmed: Number(paymentSummary.balancePaidConfirmed.toString()),
              refundsConfirmed: Number(paymentSummary.refundsConfirmed.toString()),
              totalPaidConfirmed: Number(paymentSummary.totalPaidConfirmed.toString()),
              depositPending: Number(paymentSummary.depositPending.toString()),
              balancePending: Number(paymentSummary.balancePending.toString()),
              refundsPending: Number(paymentSummary.refundsPending.toString()),
              outstanding: Number(paymentSummary.outstanding.toString()),
              customerCredit: Number(paymentSummary.customerCredit.toString()),
              depositMet: paymentSummary.depositMet,
            }
          : null,
        records: order.payments.map((payment) => {
          const paymentMethodDef = this.getPaymentMethodRecordById(payment.paymentMethodId ?? null)
          return {
            id: payment.id,
            orderId: payment.orderId,
            amount: Number(payment.amount.toString()),
            currency: payment.currency,
            type: payment.type,
            status: payment.status,
            reference: payment.reference ?? null,
            method: payment.method ?? paymentMethodDef?.name ?? null,
            paymentMethodId: paymentMethodDef?.id ?? payment.paymentMethodId ?? null,
            date: payment.date.toISOString(),
            notes: payment.notes ?? null,
            createdAt: payment.createdAt.toISOString(),
            updatedAt: payment.updatedAt.toISOString(),
            attachments: payment.attachments.map((attachment) => ({
              id: attachment.id,
              name: attachment.name,
              type: attachment.mimeType ?? null,
              size: attachment.size ?? null,
              createdAt: attachment.createdAt.toISOString(),
              url: `/accounting/payments/${payment.id}/attachments/${attachment.id}`,
            })),
          }
        }),
      },
    }
  }

  async getDocumentPdf(documentType: DocumentType, id: number) {
    const order = await this.prisma.order.findFirst({
      where: { id, documentType },
      select: {
        documentFilePath: true,
        documentFileName: true,
        documentFileMime: true,
        documentFileSize: true,
        documentPdf: true,
      },
    })

    if (!order) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }

    const fileName = this.buildDocumentFileName(documentType, id, order.documentFileName)
    const mime = order.documentFileMime ?? 'application/pdf'

    if (order.documentPdf) {
      const buffer = Buffer.isBuffer(order.documentPdf)
        ? order.documentPdf
        : Buffer.from(order.documentPdf)
      return new StreamableFile(buffer, {
        type: mime,
        disposition: `inline; filename="${fileName}"`,
        length: buffer.length,
      })
    }

    const localPath = resolveSalesDocumentLocalPath(order.documentFilePath)
    if (localPath) {
      try {
        const stats = await stat(localPath)
        const stream = createReadStream(localPath)
        return new StreamableFile(stream, {
          type: mime,
          disposition: `inline; filename="${fileName}"`,
          length: stats?.size ?? order.documentFileSize ?? undefined,
        })
      } catch (error: any) {
        if (error?.code !== 'ENOENT') {
          throw error
        }
      }
    }

    throw new BadRequestException('sales.orders.validation.notFound')
  }

  async createDocument(documentType: DocumentType, dto: CreateOrderDto) {
    const customerId = Number(dto.customerId)
    if (!customerId) throw new BadRequestException('sales.orders.validation.customerRequired')
    if (!Array.isArray(dto.items) || dto.items.length === 0) throw new BadRequestException('sales.orders.validation.itemsRequired')

    const taxRate = await this.getTaxRate()
    const monetary = await this.prepareOrderMonetaryData(dto, taxRate)

    const completedStatus = await this.getDefaultOrderStatus(ORDER_STATUS_CODES.PENDING)

    const disclaimer = await this.resolveDocumentDisclaimer(dto.disclaimer)

    const depositRequirement = await this.orderFinance.resolveDepositRequirement({
      type: dto.minimumDepositType ?? null,
      value: dto.minimumDepositValue ?? null,
    })

    const composeAddress = (addr?: any) => {
      if (!addr) return undefined
      const line1 = addr.addressLine1 || `${addr.street || ''} ${addr.number || ''}${addr.apartment ? ' Apt ' + addr.apartment : ''}`.trim()
      const line2 = addr.addressLine2 || (addr.corner ? `Esquina: ${addr.corner}` : '')
      const country = typeof addr.country === 'string' && addr.country.trim().length ? addr.country.trim() : undefined
      return line1 && addr.city && (addr.state || country)
        ? {
            addressLine1: line1,
            addressLine2: line2,
            city: addr.city,
            state: addr.state,
            country: country ?? addr.state,
          }
        : undefined
    }

    const paymentCache = new Map<string, number>()
    let paymentMethodId: number | null = null
    if (dto.paymentMehod !== undefined && dto.paymentMehod !== null) {
      paymentMethodId = await this.resolvePaymentMethod(String(dto.paymentMehod), paymentCache)
    }
    if (paymentMethodId === null) {
      paymentMethodId = DEFAULT_PAYMENT_METHOD_ID
    }

    let shippingAddress = composeAddress(dto.shippingAddress)
    if (!shippingAddress) {
      const primaryAddr = await this.prisma.customerAddress.findFirst({ where: { customerId, isPrimary: true } })
      if (!primaryAddr) throw new BadRequestException('sales.orders.validation.customerAddressRequired')
      shippingAddress = {
        addressLine1: `${primaryAddr.street} ${primaryAddr.number}${primaryAddr.apartment ? ' Apt ' + primaryAddr.apartment : ''}`,
        addressLine2: primaryAddr.corner ? `Esquina: ${primaryAddr.corner}` : '',
        city: primaryAddr.city,
        state: null,
        country: primaryAddr.country,
      }
    }

    const rawValidUntil = dto.validUntil ?? dto.validUntilDate ?? null
    const activityInputProvided = this.hasActivityInput(dto.activityId ?? null)
    const normalizedActivityId = this.normalizeActivityId(dto.activityId ?? null)
    if (activityInputProvided && normalizedActivityId === null) {
      throw new BadRequestException('sales.orders.validation.activityInvalid')
    }
    let linkedActivity: LinkedActivitySummary | null = null
    if (normalizedActivityId !== null) {
      linkedActivity = await this.fetchActivitySummary(normalizedActivityId)
      if (!linkedActivity) {
        throw new BadRequestException('sales.orders.validation.activityNotFound')
      }
    }

    const created = await this.prisma.order.create({
      data: {
        documentType,
        customerId,
        date: dto.date ? new Date(dto.date) : new Date(),
        shippingAddress1: shippingAddress.addressLine1,
        shippingAddress2: shippingAddress.addressLine2,
        shippingCity: shippingAddress.city,
        shippingState: shippingAddress.state ?? null,
        shippingCountry: shippingAddress.country ?? null,
        ...(dto.billingSameAsShipping
          ? {
              billingAddress1: shippingAddress.addressLine1,
              billingAddress2: shippingAddress.addressLine2,
              billingCity: shippingAddress.city,
              billingState: shippingAddress.state ?? null,
              billingCountry: shippingAddress.country ?? null,
            }
          : (() => {
              const b = composeAddress(dto.billingAddress)
              return b
                ? {
                    billingAddress1: b.addressLine1,
                    billingAddress2: b.addressLine2,
                    billingCity: b.city,
                    billingState: b.state ?? null,
                    billingCountry: b.country ?? null,
                  }
                : {}
            })()),
        billingSameAsShipping: dto.billingSameAsShipping,
        shippingVendor: dto.shipping?.shippingVendor,
        statusId: completedStatus?.id,
        paymentMethodId,
        deliveryFees: monetary.delivery.toFixed(2),
        estimatedMin: dto.shipping?.estimatedMin,
        estimatedMax: dto.shipping?.estimatedMax,
        comment: dto.comment,
        subTotal: monetary.subTotal.toFixed(2),
        tax: monetary.tax.toFixed(2),
        grandTotal: monetary.grandTotal.toFixed(2),
        minimumDepositType: depositRequirement.type,
        minimumDepositValue: depositRequirement.value.toFixed(2),
        orderCurrency: monetary.orderCurrency,
        fxBase: monetary.snapshot.base,
        fxRates: this.serializeFxSnapshot(monetary.snapshot),
        currencySnapshot: monetary.orderCurrency,
        taxRateSnapshot: decimal(taxRate).toFixed(4),
        exchangeRateSnapshot: this.serializeFxSnapshot(monetary.snapshot),
        validUntil: rawValidUntil ? new Date(rawValidUntil) : null,
        activityId: linkedActivity?.id ?? null,
        disclaimer,
        metadata: dto.metadata ? (dto.metadata as Prisma.InputJsonValue) : undefined,
        items: { create: monetary.items },
      },
    })
    await this.orderFinance.recalculateOrderFinancials(created.id)
    if (documentType === DocumentType.ORDER) {
      try {
        await this.timeline.ensureOrderReceived(created.id, created.createdAt, 'system')
        await this.timeline.ensurePaymentWaiting(
          created.id,
          monetary.grandTotal,
          monetary.orderCurrency,
          undefined,
          created.createdAt,
        )
        const estimate = this.resolveDeliveryEstimate(
          created.date ?? created.createdAt,
          created.estimatedMin ?? null,
          created.estimatedMax ?? null,
        )
        if (estimate) {
          const metadata: Record<string, unknown> = {}
          if (estimate.minDays !== null) {
            metadata.estimatedMinDays = estimate.minDays
          }
          if (estimate.maxDays !== null) {
            metadata.estimatedMaxDays = estimate.maxDays
          }
          await this.timeline.recordEstimateSnapshot(created.id, {
            estimateDate: estimate.estimate,
            actor: 'system',
            type: 'ESTIMATE_SET',
            timestamp: created.createdAt,
            metadata: Object.keys(metadata).length ? metadata : undefined,
          })
        }
        if (linkedActivity) {
          await this.timeline.recordActivityLink(
            {
              orderId: created.id,
              activityId: linkedActivity.id,
              activityTitle: linkedActivity.title,
              activityStart: linkedActivity.startAt,
              activityEnd: linkedActivity.endAt,
              activityAllDay: linkedActivity.allDay,
              activityType: linkedActivity.type,
              activityLocation: linkedActivity.location,
              actor: 'admin',
              timestamp: created.createdAt,
              action: 'linked',
            },
          )
        }
      } catch (error) {
        this.logger.warn(
          `Failed to initialize timeline for order ${created.id}: ${(error as Error).message}`,
        )
      }
    }
    if (documentType === DocumentType.ORDER) {
      this.notifications
        .notifyOrderReceived(created.id)
        .catch((error) => this.logger.error(`Failed to dispatch notifications for order ${created.id}: ${(error as Error).message}`))
    } else if (documentType === DocumentType.BUDGET) {
      this.email
        .sendBudgetCreated({ budgetId: created.id })
        .catch((error) => this.logger.error(`Failed to dispatch budget created email for ${created.id}: ${(error as Error).message}`))
    }
    return created.id
  }

  async replaceDocument(
    documentType: DocumentType,
    id: number,
    dto: CreateOrderDto,
  ) {
    const existing = await this.prisma.order.findFirst({
      where: { id, documentType },
      include: {
        activity: {
          include: {
            eventType: true,
          },
        },
      },
    })
    if (!existing) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }
    const customerId = Number(dto.customerId)
    if (!customerId) throw new BadRequestException('sales.orders.validation.customerRequired')
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('sales.orders.validation.itemsRequired')
    }

    const taxRate = await this.getTaxRate()
    const monetary = await this.prepareOrderMonetaryData(dto, taxRate)

    const disclaimer = await this.resolveDocumentDisclaimer(dto.disclaimer)

    const composeAddress = (addr?: any) => {
      if (!addr) return undefined
      const line1 = addr.addressLine1 || `${addr.street || ''} ${addr.number || ''}${addr.apartment ? ' Apt ' + addr.apartment : ''}`.trim()
      const line2 = addr.addressLine2 || (addr.corner ? `Esquina: ${addr.corner}` : '')
      const country = typeof addr.country === 'string' && addr.country.trim().length ? addr.country.trim() : undefined
      return line1 && addr.city && (addr.state || country)
        ? {
            addressLine1: line1,
            addressLine2: line2,
            city: addr.city,
            state: addr.state,
            country: country ?? addr.state,
          }
        : undefined
    }

    const replacePaymentCache = new Map<string, number>()
    let paymentMethodId: number | null = null
    if (dto.paymentMehod !== undefined && dto.paymentMehod !== null) {
      paymentMethodId = await this.resolvePaymentMethod(String(dto.paymentMehod), replacePaymentCache)
    }
    if (paymentMethodId === null) {
      paymentMethodId = existing.paymentMethodId ?? DEFAULT_PAYMENT_METHOD_ID
    }

    let shippingAddress = composeAddress(dto.shippingAddress)
    if (!shippingAddress) {
      const primaryAddr = await this.prisma.customerAddress.findFirst({ where: { customerId, isPrimary: true } })
      if (!primaryAddr) throw new BadRequestException('sales.orders.validation.customerAddressRequired')
      shippingAddress = {
        addressLine1: `${primaryAddr.street} ${primaryAddr.number}${primaryAddr.apartment ? ' Apt ' + primaryAddr.apartment : ''}`,
        addressLine2: primaryAddr.corner ? `Esquina: ${primaryAddr.corner}` : '',
        city: primaryAddr.city,
        state: null,
        country: primaryAddr.country,
      }
    }

    const billingFromShipping = dto.billingSameAsShipping
      ? shippingAddress
      : composeAddress(dto.billingAddress)

    const rawValidUntil = dto.validUntil ?? dto.validUntilDate ?? null
    const activityFieldProvided = Object.prototype.hasOwnProperty.call(dto, 'activityId')
    const previousActivityId = existing.activityId ?? null
    const previousActivitySummary = this.toActivitySummary(existing.activity as CalendarEventWithType | null)
    const activityInputProvided = this.hasActivityInput(dto.activityId ?? null)
    let nextActivitySummary: LinkedActivitySummary | null = previousActivitySummary
    let nextActivityId = previousActivityId
    if (activityFieldProvided) {
      const normalizedActivityId = this.normalizeActivityId(dto.activityId ?? null)
      if (activityInputProvided && normalizedActivityId === null) {
        throw new BadRequestException('sales.orders.validation.activityInvalid')
      }
      if (normalizedActivityId !== null) {
        if (normalizedActivityId === previousActivityId && previousActivitySummary) {
          nextActivitySummary = previousActivitySummary
          nextActivityId = previousActivitySummary.id
        } else {
          const resolved = await this.fetchActivitySummary(normalizedActivityId)
          if (!resolved) {
            throw new BadRequestException('sales.orders.validation.activityNotFound')
          }
          nextActivitySummary = resolved
          nextActivityId = resolved.id
        }
      } else {
        nextActivitySummary = null
        nextActivityId = null
      }
    }
    const activityChanged = activityFieldProvided && previousActivityId !== nextActivityId

    let depositRequirement:
      | {
          type: DepositRequirementType
          value: Prisma.Decimal
        }
      | null = null
    if (dto.minimumDepositType !== undefined || dto.minimumDepositValue !== undefined) {
      depositRequirement = await this.orderFinance.resolveDepositRequirement({
        type: dto.minimumDepositType ?? null,
        value: dto.minimumDepositValue ?? null,
      })
    }

    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        customerId,
        date: dto.date ? new Date(dto.date) : new Date(),
        shippingAddress1: shippingAddress.addressLine1,
        shippingAddress2: shippingAddress.addressLine2,
        shippingCity: shippingAddress.city,
        shippingState: shippingAddress.state ?? null,
        shippingCountry: shippingAddress.country ?? null,
        billingSameAsShipping: dto.billingSameAsShipping,
        billingAddress1: billingFromShipping?.addressLine1 ?? null,
        billingAddress2: billingFromShipping?.addressLine2 ?? null,
        billingCity: billingFromShipping?.city ?? null,
        billingState: billingFromShipping?.state ?? null,
        billingCountry: billingFromShipping?.country ?? null,
        shippingVendor: dto.shipping?.shippingVendor,
        paymentMethodId,
        deliveryFees: monetary.delivery.toFixed(2),
        estimatedMin: dto.shipping?.estimatedMin,
        estimatedMax: dto.shipping?.estimatedMax,
        comment: dto.comment,
        metadata: dto.metadata === undefined ? undefined : (dto.metadata as Prisma.InputJsonValue),
        subTotal: monetary.subTotal.toFixed(2),
        tax: monetary.tax.toFixed(2),
        grandTotal: monetary.grandTotal.toFixed(2),
        ...(depositRequirement
          ? {
              minimumDepositType: depositRequirement.type,
              minimumDepositValue: depositRequirement.value.toFixed(2),
            }
          : {}),
        orderCurrency: monetary.orderCurrency,
        fxBase: monetary.snapshot.base,
        fxRates: this.serializeFxSnapshot(monetary.snapshot),
        currencySnapshot: monetary.orderCurrency,
        taxRateSnapshot: decimal(taxRate).toFixed(4),
        exchangeRateSnapshot: this.serializeFxSnapshot(monetary.snapshot),
        validUntil: rawValidUntil ? new Date(rawValidUntil) : existing.validUntil,
        documentFilePath: null,
        documentFileName: null,
        documentFileMime: null,
        documentFileSize: null,
        documentGeneratedAt: null,
        ...(activityFieldProvided ? { activityId: nextActivityId } : {}),
        disclaimer,
        items: {
          deleteMany: {},
          create: monetary.items,
        },
      },
      select: {
        id: true,
        date: true,
        estimatedMin: true,
        estimatedMax: true,
        createdAt: true,
        updatedAt: true,
        orderCurrency: true,
      },
    })
    await deleteSalesDocumentFile(existing.documentFilePath)
    await this.orderFinance.recalculateOrderFinancials(existing.id)
    if (documentType === DocumentType.ORDER) {
      try {
        const previousEstimate = this.resolveDeliveryEstimate(
          existing.date ?? existing.createdAt ?? new Date(),
          existing.estimatedMin ?? null,
          existing.estimatedMax ?? null,
        )
        const currentEstimate = this.resolveDeliveryEstimate(
          updated.date ?? updated.createdAt,
          updated.estimatedMin ?? null,
          updated.estimatedMax ?? null,
        )
        if (
          currentEstimate &&
          (!previousEstimate ||
            currentEstimate.estimate.getTime() !== previousEstimate.estimate.getTime() ||
            currentEstimate.minDays !== previousEstimate.minDays ||
            currentEstimate.maxDays !== previousEstimate.maxDays)
        ) {
          const metadata: Record<string, unknown> = {}
          if (previousEstimate) {
            metadata.previousEstimateDate = previousEstimate.estimate.toISOString()
            if (previousEstimate.minDays !== null) {
              metadata.previousEstimatedMinDays = previousEstimate.minDays
            }
            if (previousEstimate.maxDays !== null) {
              metadata.previousEstimatedMaxDays = previousEstimate.maxDays
            }
          }
          metadata.nextEstimateDate = currentEstimate.estimate.toISOString()
          if (currentEstimate.minDays !== null) {
            metadata.nextEstimatedMinDays = currentEstimate.minDays
          }
          if (currentEstimate.maxDays !== null) {
            metadata.nextEstimatedMaxDays = currentEstimate.maxDays
          }
          await this.timeline.recordEstimateSnapshot(existing.id, {
            estimateDate: currentEstimate.estimate,
            previousEstimate: previousEstimate?.estimate ?? null,
            actor: 'system',
            type: previousEstimate ? 'ESTIMATE_UPDATED' : 'ESTIMATE_SET',
            timestamp: updated.updatedAt ?? new Date(),
            metadata,
          })
        }
        if (activityChanged) {
          if (nextActivitySummary) {
            await this.timeline.recordActivityLink({
              orderId: existing.id,
              activityId: nextActivitySummary.id,
              activityTitle: nextActivitySummary.title,
              activityStart: nextActivitySummary.startAt,
              activityEnd: nextActivitySummary.endAt,
              activityAllDay: nextActivitySummary.allDay,
              activityType: nextActivitySummary.type,
              activityLocation: nextActivitySummary.location,
              actor: 'admin',
              timestamp: updated.updatedAt ?? new Date(),
              action: previousActivityId ? 'updated' : 'linked',
            })
          } else if (previousActivityId !== null) {
            await this.timeline.recordActivityUnlink({
              orderId: existing.id,
              activityId: previousActivityId,
              activityTitle: previousActivitySummary?.title ?? null,
              actor: 'admin',
              timestamp: updated.updatedAt ?? new Date(),
            })
          }
        }
      } catch (error) {
        this.logger.warn(
          `Failed to append estimate timeline event for order ${existing.id}: ${(error as Error).message}`,
        )
      }
    }
    return true
  }

  async updateOrderDeliveryDetails(id: number, dto: UpdateOrderDeliveryDto) {
    const order = await this.prisma.order.findFirst({
      where: { id, documentType: DocumentType.ORDER },
      select: {
        id: true,
        deliveryFees: true,
        shippingVendor: true,
        estimatedMin: true,
        estimatedMax: true,
        date: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    if (!order) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }

    const baselineDate = order.date ?? order.createdAt ?? new Date()
    const previousEstimate = this.resolveDeliveryEstimate(
      baselineDate,
      order.estimatedMin ?? null,
      order.estimatedMax ?? null,
    )

    const updateData: Prisma.OrderUpdateInput = {}
    if (dto.shippingVendor !== undefined) {
      const trimmed = dto.shippingVendor?.trim() ?? ''
      updateData.shippingVendor = trimmed.length ? trimmed : null
    }
    if (dto.deliveryFees !== undefined) {
      updateData.deliveryFees = decimal(dto.deliveryFees ?? 0).toFixed(2)
    }

    const shouldClearEstimate = dto.clearEstimate === true
    let nextEstimatedMin = order.estimatedMin ?? null
    let nextEstimatedMax = order.estimatedMax ?? null

    if (shouldClearEstimate) {
      nextEstimatedMin = null
      nextEstimatedMax = null
    } else {
      if (dto.estimatedDate) {
        const parsed = new Date(dto.estimatedDate)
        if (Number.isNaN(parsed.getTime())) {
          throw new BadRequestException('orders.delivery.validation.invalidEstimateDate')
        }
        const diffDays = Math.max(
          0,
          Math.round((parsed.getTime() - baselineDate.getTime()) / (24 * 60 * 60 * 1000)),
        )
        nextEstimatedMin = diffDays
        nextEstimatedMax = diffDays
      }

      if (dto.estimatedMinDays !== undefined) {
        nextEstimatedMin = Math.max(0, Math.round(Number(dto.estimatedMinDays)))
      }
      if (dto.estimatedMaxDays !== undefined) {
        const raw = Math.max(0, Math.round(Number(dto.estimatedMaxDays)))
        nextEstimatedMax = nextEstimatedMin !== null ? Math.max(nextEstimatedMin, raw) : raw
      }
    }

    if (shouldClearEstimate) {
      if (order.estimatedMin !== null || order.estimatedMax !== null) {
        updateData.estimatedMin = null
        updateData.estimatedMax = null
      }
    } else if (nextEstimatedMin !== null || nextEstimatedMax !== null) {
      if (nextEstimatedMax === null && nextEstimatedMin !== null) {
        nextEstimatedMax = nextEstimatedMin
      }
      if (nextEstimatedMin === null && nextEstimatedMax !== null) {
        nextEstimatedMin = nextEstimatedMax
      }
      if (
        nextEstimatedMin !== (order.estimatedMin ?? null) ||
        nextEstimatedMax !== (order.estimatedMax ?? null)
      ) {
        updateData.estimatedMin = nextEstimatedMin
        updateData.estimatedMax = nextEstimatedMax
      }
    }

    if (Object.keys(updateData).length === 0) {
      const computedEstimate = this.resolveDeliveryEstimate(
        baselineDate,
        order.estimatedMin ?? null,
        order.estimatedMax ?? null,
      )
      return {
        id: order.id,
        shipping: {
          deliveryFees: Number(order.deliveryFees?.toString?.() ?? order.deliveryFees ?? 0),
          shippingVendor: order.shippingVendor ?? null,
          estimatedMin: order.estimatedMin ?? null,
          estimatedMax: order.estimatedMax ?? null,
          estimatedDate: computedEstimate ? computedEstimate.estimate.toISOString() : null,
        },
      }
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: updateData,
      select: {
        id: true,
        deliveryFees: true,
        shippingVendor: true,
        estimatedMin: true,
        estimatedMax: true,
        date: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const currentEstimate = this.resolveDeliveryEstimate(
      updated.date ?? updated.createdAt ?? new Date(),
      updated.estimatedMin ?? null,
      updated.estimatedMax ?? null,
    )

    const estimateChanged =
      (previousEstimate?.estimate?.getTime() ?? null) !==
        (currentEstimate?.estimate?.getTime() ?? null) ||
      previousEstimate?.minDays !== currentEstimate?.minDays ||
      previousEstimate?.maxDays !== currentEstimate?.maxDays

    if (currentEstimate && estimateChanged) {
      const metadata: Record<string, unknown> = {
        source: 'admin',
      }
      if (dto.estimatedDate) {
        metadata.estimatedDateInput = dto.estimatedDate
      }
      if (dto.estimatedMinDays !== undefined) {
        metadata.estimatedMinDays = Math.max(0, Math.round(Number(dto.estimatedMinDays)))
      }
      if (dto.estimatedMaxDays !== undefined) {
        metadata.estimatedMaxDays = Math.max(0, Math.round(Number(dto.estimatedMaxDays)))
      }
      try {
        await this.timeline.recordEstimateSnapshot(order.id, {
          estimateDate: currentEstimate.estimate,
          previousEstimate: previousEstimate?.estimate ?? null,
          actor: 'admin',
          type: previousEstimate ? 'ESTIMATE_UPDATED' : 'ESTIMATE_SET',
          timestamp: updated.updatedAt ?? new Date(),
          metadata,
        })
      } catch (error) {
        this.logger.warn(
          `Failed to append estimate timeline event for order ${order.id}: ${(error as Error).message}`,
        )
      }
    }

    return {
      id: updated.id,
      shipping: {
        deliveryFees: Number(updated.deliveryFees?.toString?.() ?? updated.deliveryFees ?? 0),
        shippingVendor: updated.shippingVendor ?? null,
        estimatedMin: updated.estimatedMin ?? null,
        estimatedMax: updated.estimatedMax ?? null,
        estimatedDate: currentEstimate ? currentEstimate.estimate.toISOString() : null,
      },
    }
  }

  async updateDocumentComment(documentType: DocumentType, id: number, body: { comment?: string }) {
    const result = await this.prisma.order.updateMany({
      where: { id: id, documentType },
      data: { comment: body.comment ?? null },
    })
    if (result.count === 0) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }
    return true
  }

  async updateDocumentStatus(
    documentType: DocumentType,
    id: number,
    body: { status: number; force?: boolean },
  ) {
    let previousStatusId: number | null = null
    if (documentType === DocumentType.ORDER) {
      await this.orderFinance.ensureStatusCanTransition(id, body.status, Boolean(body.force))
    }
    const existing = await this.prisma.order.findFirst({
      where: { id, documentType },
      select: { statusId: true },
    })
    if (!existing) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }
    previousStatusId = existing.statusId ?? null
    const result = await this.prisma.order.updateMany({
      where: { id: id, documentType },
      data: { statusId: body.status },
    })
    if (result.count === 0) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }
    if (documentType === DocumentType.ORDER) {
      if (
        previousStatusId !== body.status &&
        body.status === ORDER_STATUS_CODES.CANCELLED
      ) {
        await this.stockIntegrity.releaseOrderStock(id)
      }
      this.notifications
        .notifyOrderStatusChanged(id, previousStatusId, body.status)
        .catch((error) => this.logger.error(`Failed to dispatch status change notifications for order ${id}: ${(error as Error).message}`))
      try {
        await this.timeline.recordStatusTransition({
          orderId: id,
          previousStatusId,
          nextStatusId: body.status,
          actor: 'admin',
          timestamp: new Date(),
        })
      } catch (error) {
        this.logger.warn(
          `Failed to append status change timeline event for order ${id}: ${(error as Error).message}`,
        )
      }
    } else if (documentType === DocumentType.BUDGET) {
      this.email
        .sendBudgetStatusChanged({ orderId: id, previousStatusId, nextStatusId: body.status })
        .catch((error) => this.logger.error(`Failed to dispatch budget status email for ${id}: ${(error as Error).message}`))
    }
    return true
  }

  async updateDocumentPaymentMethod(
    documentType: DocumentType,
    id: number,
    body: { paymentMehod?: string | number | null },
  ) {
    const raw = body.paymentMehod
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      const cleared = await this.prisma.order.updateMany({
        where: { id, documentType },
        data: { paymentMethodId: null },
      })
      if (cleared.count === 0) {
        throw new BadRequestException('sales.orders.validation.notFound')
      }
      return true
    }
    const paymentCache = new Map<string, number>()
    let pmId = await this.resolvePaymentMethod(String(raw), paymentCache)
    if (pmId === null) {
      pmId = DEFAULT_PAYMENT_METHOD_ID
    }
    const updated = await this.prisma.order.updateMany({
      where: { id: id, documentType },
      data: { paymentMethodId: pmId },
    })
    if (updated.count === 0) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }
    return true
  }

  async persistDocumentFile(
    documentType: DocumentType,
    id: number,
    file: MultipartFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('sales.orders.import.fileRequired')
    }

    const existing = await this.prisma.order.findFirst({
      where: { id, documentType },
      select: {
        id: true,
        documentFilePath: true,
      },
    })

    if (!existing) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }

    const stored = await persistSalesDocumentFile(file, {
      documentType: documentType === DocumentType.BUDGET ? 'BUDGET' : 'ORDER',
      previousPath: existing.documentFilePath,
    })

    const updated = await this.prisma.order.update({
      where: { id: existing.id },
      data: {
        documentFilePath: stored.path,
        documentFileName: stored.name,
        documentFileMime: stored.mime,
        documentFileSize: stored.size,
        documentGeneratedAt: new Date(),
      },
      select: {
        documentFilePath: true,
        documentFileName: true,
        documentFileMime: true,
        documentFileSize: true,
        documentGeneratedAt: true,
      },
    })

    return {
      path: updated.documentFilePath,
      name: updated.documentFileName,
      mime: updated.documentFileMime,
      size: updated.documentFileSize,
      generatedAt: updated.documentGeneratedAt?.toISOString() ?? null,
    }
  }

  async sendBudget(id: number, userId: number | null) {
    const sentStatusId = (await this.getBudgetStatusId('SENT')) ?? ORDER_STATUS_CODES.BUDGET_DRAFT
    const result = await this.prisma.$transaction(async (tx) => {
      const budget = await tx.order.findFirst({
        where: { id: id, documentType: DocumentType.BUDGET },
      })
      if (!budget) {
        throw new BadRequestException('sales.budgets.notFound')
      }
      const validity = budget.validUntil ?? this.computeDefaultValidity()
      await tx.order.update({
        where: { id: budget.id },
        data: {
          statusId: sentStatusId,
          validUntil: validity,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      })
      return {
        budgetId: budget.id,
        statusId: sentStatusId,
        validUntilDate: validity,
        validityDate: validity,
        updatedBy: userId ?? null,
        previousStatusId: budget.statusId ?? null,
      }
    })
    const { previousStatusId, ...response } = result
    this.email
      .sendBudgetStatusChanged({
        orderId: response.budgetId,
        previousStatusId,
        nextStatusId: response.statusId,
      })
      .catch((error) => this.logger.error(`Failed to dispatch budget sent email for ${response.budgetId}: ${(error as Error).message}`))
    return response
  }

  async confirmBudget(id: number, userId: number | null) {
    const convertedStatusId = (await this.getBudgetStatusId('CONVERTED')) ?? ORDER_STATUS_CODES.BUDGET_DRAFT
    const defaultOrderStatus = await this.getDefaultOrderStatus()
    const result = await this.prisma.$transaction(async (tx) => {
      const budget = await tx.order.findFirst({
        where: { id, documentType: DocumentType.BUDGET },
        select: {
          id: true,
          customerId: true,
          paymentMethodId: true,
          shippingAddress1: true,
          shippingAddress2: true,
          shippingCity: true,
          shippingState: true,
          shippingZip: true,
          shippingCountry: true,
          billingAddress1: true,
          billingAddress2: true,
          billingCity: true,
          billingState: true,
          billingZip: true,
          billingCountry: true,
          billingSameAsShipping: true,
          shippingVendor: true,
          deliveryFees: true,
          estimatedMin: true,
          estimatedMax: true,
          comment: true,
          disclaimer: true,
          metadata: true,
          statusId: true,
          subTotal: true,
          tax: true,
          grandTotal: true,
          orderCurrency: true,
          fxBase: true,
          fxRates: true,
          currencySnapshot: true,
          taxRateSnapshot: true,
          exchangeRateSnapshot: true,
          validUntil: true,
          convertedOrderId: true,
          items: true,
        },
      })
      if (!budget) {
        throw new BadRequestException('sales.budgets.notFound')
      }
      if (budget.convertedOrderId) {
        return {
          budgetId: budget.id,
          orderId: budget.convertedOrderId,
          previousStatusId: budget.statusId ?? null,
          statusUpdated: false,
        }
      }

      const fxRatesJson = budget.fxRates as Prisma.InputJsonValue | undefined
      const exchangeSnapshotJson = budget.exchangeRateSnapshot
        ? (budget.exchangeRateSnapshot as Prisma.InputJsonValue)
        : fxRatesJson

      const budgetDisclaimer =
        budget.disclaimer ?? (await this.getDefaultDocumentDisclaimer()) ?? null

      const newOrder = await tx.order.create({
        data: {
          documentType: DocumentType.ORDER,
          originId: budget.id,
          customerId: budget.customerId,
          date: new Date(),
          paymentMethodId: budget.paymentMethodId,
          shippingAddress1: budget.shippingAddress1,
          shippingAddress2: budget.shippingAddress2,
          shippingCity: budget.shippingCity,
          shippingState: budget.shippingState,
          shippingZip: budget.shippingZip,
          shippingCountry: (budget as { shippingCountry?: string | null }).shippingCountry ?? null,
          billingAddress1: budget.billingAddress1,
          billingAddress2: budget.billingAddress2,
          billingCity: budget.billingCity,
          billingState: budget.billingState,
          billingZip: budget.billingZip,
          billingCountry: (budget as { billingCountry?: string | null }).billingCountry ?? null,
          billingSameAsShipping: budget.billingSameAsShipping,
          shippingVendor: budget.shippingVendor,
          deliveryFees: this.decimalToString(budget.deliveryFees) ?? undefined,
          estimatedMin: budget.estimatedMin,
          estimatedMax: budget.estimatedMax,
          comment: budget.comment,
          disclaimer: budgetDisclaimer,
          statusId: defaultOrderStatus?.id ?? null,
          subTotal: this.decimalToString(budget.subTotal) ?? '0',
          tax: this.decimalToString(budget.tax) ?? '0',
          grandTotal: this.decimalToString(budget.grandTotal) ?? '0',
          orderCurrency: budget.orderCurrency,
          fxBase: budget.fxBase,
          fxRates: fxRatesJson,
          currencySnapshot: budget.currencySnapshot ?? budget.orderCurrency,
          taxRateSnapshot: this.decimalToString(budget.taxRateSnapshot, 4),
          exchangeRateSnapshot: exchangeSnapshotJson,
          metadata: budget.metadata ?? undefined,
          items: {
            create: budget.items.map((item) => {
              const specSummary = this.buildSpecSummary(item.customAttributes)
              const mergedComment = [item.comments, specSummary].filter(Boolean).join('\n\n') || null
              return {
                productId: item.productId ?? undefined,
                name: item.name,
                price: this.decimalToString(item.price) ?? '0',
                qty: item.qty,
                img: item.img,
                description: item.description,
                comments: mergedComment,
                unitAmount: this.decimalToString(item.unitAmount, 4),
                unitCurrency: item.unitCurrency ?? undefined,
                unitAmountOrderCurrency: this.decimalToString(item.unitAmountOrderCurrency, 4),
                conversionRate: this.decimalToString(item.conversionRate, 8),
                unitCostAmount: this.decimalToString(item.unitCostAmount, 4),
                unitCostCurrency: item.unitCostCurrency ?? undefined,
                unitCostOrderCurrency: this.decimalToString(item.unitCostOrderCurrency, 4),
                customAttributes: item.customAttributes as Prisma.InputJsonValue | undefined,
                pricingMethodSnapshot: item.pricingMethodSnapshot ?? undefined,
                unitPriceSnapshot: this.decimalToString(item.unitPriceSnapshot, 4),
                skuSnapshot: item.skuSnapshot ?? undefined,
                nameSnapshot: item.nameSnapshot ?? item.name,
                specSummary: specSummary ?? undefined,
                specJson: (item.specJson ?? item.customAttributes) as Prisma.InputJsonValue | undefined,
              }
            }),
          },
        },
      })

      await tx.order.update({
        where: { id: budget.id },
        data: {
          statusId: convertedStatusId,
          convertedOrderId: newOrder.id,
          convertedAt: new Date(),
          convertedBy: userId ?? undefined,
          version: { increment: 1 },
          updatedAt: new Date(),
        },
      })

      return {
        budgetId: budget.id,
        orderId: newOrder.id,
        previousStatusId: budget.statusId ?? null,
        statusUpdated: true,
      }
    })
    if (result.orderId) {
      this.notifications
        .notifyOrderReceived(result.orderId)
        .catch((error) => this.logger.error(`Failed to dispatch notifications for converted order ${result.orderId}: ${(error as Error).message}`))
    }
    if (result.statusUpdated !== false) {
      this.email
        .sendBudgetStatusChanged({
          orderId: result.budgetId,
          previousStatusId: result.previousStatusId ?? null,
          nextStatusId: convertedStatusId,
        })
        .catch((error) => this.logger.error(`Failed to dispatch budget converted email for ${result.budgetId}: ${(error as Error).message}`))
    }
    const { statusUpdated, previousStatusId: _previousStatusId, ...payload } = result
    return payload
  }
}

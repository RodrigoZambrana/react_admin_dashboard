import { BadRequestException, Injectable, StreamableFile } from '@nestjs/common'
import { Prisma, CustomerAddress, DocumentType, SalesUnit } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { PrismaService } from '../prisma/prisma.service'
import { CreateOrderDto } from '../sales/dto/order.dto'
import { CurrencyConversionService, CurrencyRatesSnapshot } from '../common/currency/currency-conversion.service'
import {
  decimal,
  roundDecimal,
  multiplyDecimals,
  addDecimals,
  divideDecimals,
} from '../common/currency/money.util'
import PDFDocument from 'pdfkit'

const BUDGET_STATUS = {
  DRAFT: { code: 1000, name: 'Presupuesto - Borrador', color: '#9ca3af' },
  SENT: { code: 1010, name: 'Presupuesto - Enviado', color: '#3b82f6' },
  ACCEPTED: { code: 1020, name: 'Presupuesto - Aceptado', color: '#10b981' },
  CONVERTED: { code: 1030, name: 'Presupuesto - Convertido', color: '#22c55e' },
  CANCELED: { code: 1040, name: 'Presupuesto - Cancelado', color: '#ef4444' },
  EXPIRED: { code: 1050, name: 'Presupuesto - Expirado', color: '#f97316' },
} as const

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

const ORDER_LIST_INCLUDE = {
  customer: true,
  paymentMethod: true,
  status: true,
} satisfies Prisma.OrderInclude

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: typeof ORDER_LIST_INCLUDE
}>

type OrderSortKey =
  | 'id'
  | 'date'
  | 'customer'
  | 'status'
  | 'statusId'
  | 'paymentMehod'
  | 'totalAmount'

@Injectable()
export class SalesDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyConversion: CurrencyConversionService,
  ) {}

  private readonly companySingletonKey = 'default'

  private readonly budgetStatusCache = new Map<keyof typeof BUDGET_STATUS, number>()

  private withDocumentType(documentType: DocumentType, where: Prisma.OrderWhereInput = {}) {
    return {
      ...where,
      documentType,
    }
  }

  private async getBudgetStatusId(key: keyof typeof BUDGET_STATUS) {
    if (this.budgetStatusCache.has(key)) {
      return this.budgetStatusCache.get(key) as number
    }

    const statusDef = BUDGET_STATUS[key]
    const status = await this.prisma.orderStatus.upsert({
      where: { code: statusDef.code },
      update: { name: statusDef.name, color: statusDef.color },
      create: { code: statusDef.code, name: statusDef.name, color: statusDef.color },
    })
    this.budgetStatusCache.set(key, status.id)
    return status.id
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

  private decimalToNumber(
    value: Prisma.Decimal | number | string | null | undefined,
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
    if (value instanceof Prisma.Decimal) {
      return Number(value.toString())
    }
    return null
  }

  private formatCurrencyValue(amount: number, currency: string) {
    try {
      return new Intl.NumberFormat('es-UY', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount)
    } catch {
      return `${currency} ${amount.toFixed(2)}`
    }
  }

  private formatDateValue(value?: Date | string | null) {
    if (!value) {
      return null
    }
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) {
      return null
    }
    try {
      return new Intl.DateTimeFormat('es-UY').format(date)
    } catch {
      return date.toISOString().split('T')[0]
    }
  }

  private normalizeScalarString(value?: string | null) {
    if (typeof value !== 'string') {
      return null
    }
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }

  private async loadCompanyProfileSummary(
    client: PrismaService | Prisma.TransactionClient,
  ) {
    const profile = await client.companyProfile.findUnique({
      where: { singleton: this.companySingletonKey },
      select: {
        legalName: true,
        tradeName: true,
        taxId: true,
        email: true,
        phone: true,
        website: true,
        addressLine1: true,
        addressLine2: true,
      },
    })
    if (!profile) {
      return null
    }
    const displayName =
      this.normalizeScalarString(profile.tradeName) ||
      this.normalizeScalarString(profile.legalName) ||
      'Presupuesto'
    const addressLines = [
      this.normalizeScalarString(profile.addressLine1),
      this.normalizeScalarString(profile.addressLine2),
    ].filter((line): line is string => Boolean(line))
    const detailLines = [
      this.normalizeScalarString(profile.email)
        ? `Email: ${profile.email?.trim()}`
        : null,
      this.normalizeScalarString(profile.phone)
        ? `Tel: ${profile.phone?.trim()}`
        : null,
      this.normalizeScalarString(profile.website),
      this.normalizeScalarString(profile.taxId)
        ? `RUT: ${profile.taxId?.trim()}`
        : null,
    ].filter((line): line is string => Boolean(line))
    return {
      displayName,
      legalName: this.normalizeScalarString(profile.legalName),
      lines: [...addressLines, ...detailLines],
    }
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

  private async getDefaultOrderStatus(preferredCode = 3) {
    const preferred = await this.prisma.orderStatus.findUnique({ where: { code: preferredCode } })
    if (preferred) {
      return preferred
    }
    return this.prisma.orderStatus.findFirst({ orderBy: { code: 'asc' } })
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
        specSummary,
      }
    })

    const snapshot = await this.currencyConversion.buildRatesSnapshot(Array.from(requiredCurrencies))
    let subTotal = decimal(0)
    const createItems: Prisma.OrderItemCreateWithoutOrderInput[] = []

    for (const meta of itemMeta) {
      const qtyDecimal = decimal(meta.qty)
      let unitAmount: Prisma.Decimal
      if (meta.explicitUnitAmount !== null && meta.explicitUnitAmount !== undefined) {
        unitAmount = roundDecimal(meta.explicitUnitAmount, 4)
      } else if (meta.priceCurrency !== meta.unitCurrency) {
        const sourceAmount = roundDecimal(meta.rawPrice, 4)
        const sourceConversion = this.currencyConversion.convertWithSnapshot(
          sourceAmount,
          meta.priceCurrency,
          meta.unitCurrency,
          snapshot,
          { amountScale: 4, rateScale: 8 },
        )
        unitAmount = roundDecimal(sourceConversion.amount, 4)
      } else {
        unitAmount = roundDecimal(meta.rawPrice, 4)
      }

      const conversion = this.currencyConversion.convertWithSnapshot(
        unitAmount,
        meta.unitCurrency,
        orderCurrency,
        snapshot,
        { amountScale: 4, rateScale: 8 },
      )
      const unitAmountOrderCurrency = conversion.amount
      const conversionRate = conversion.rate
      const unitPriceRounded = roundDecimal(unitAmountOrderCurrency, 2)
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
        unitCostOrderCurrency = costConversion.amount
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
    if (['id', 'date', 'customer', 'status', 'statusId', 'paymentMehod', 'totalAmount'].includes(normalized)) {
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
        case 'customer':
          orderBy.push({ customer: { name: sort.order } })
          break
        case 'status':
          orderBy.push({ status: { name: sort.order } })
          break
        case 'statusId':
          orderBy.push({ statusId: sort.order })
          break
        case 'paymentMehod':
          orderBy.push({ paymentMethod: { name: sort.order } })
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

  private buildOrderSearchWhere(raw: unknown): Prisma.OrderWhereInput | undefined {
    const queryValue = this.resolveScalarParam(raw).trim()
    if (!queryValue) return undefined
    const terms = queryValue.split(/\s+/).map((term) => term.trim()).filter(Boolean)
    if (!terms.length) return undefined

    const andConditions: Prisma.OrderWhereInput[] = terms.map((term) => {
      const sanitizedTerm = term.replace(/^#/, '')
      const digitsOnly = sanitizedTerm.replace(/[^\d]/g, '')
      const numericId = digitsOnly ? Number(digitsOnly) : undefined
      const orConditions: Prisma.OrderWhereInput[] = [
        { customer: { name: { contains: term, mode: 'insensitive' } } },
        { customer: { email: { contains: term, mode: 'insensitive' } } },
        { customer: { phoneNumber: { contains: term, mode: 'insensitive' } } },
        { paymentMethod: { name: { contains: term, mode: 'insensitive' } } },
        { status: { name: { contains: term, mode: 'insensitive' } } },
        { shippingAddress1: { contains: term, mode: 'insensitive' } },
        { shippingAddress2: { contains: term, mode: 'insensitive' } },
        { shippingCity: { contains: term, mode: 'insensitive' } },
        { shippingState: { contains: term, mode: 'insensitive' } },
      ]
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
    const normalized = name.trim().toLowerCase()
    if (cache.has(normalized)) {
      return cache.get(normalized) as number
    }
    const existing = await this.prisma.paymentMethod.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    })
    if (existing) {
      cache.set(normalized, existing.id)
      return existing.id
    }
    const created = await this.prisma.paymentMethod.create({ data: { name } })
    cache.set(normalized, created.id)
    return created.id
  }

  private async resolveStatus(
    row: string[],
    columnIndex: Map<string, number>,
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
        const existing = await this.prisma.orderStatus.findUnique({ where: { code: numericStatus } })
        if (existing) {
          statusById.set(numericStatus, existing.id)
          statusByName.set(existing.name.toLowerCase(), existing.id)
          return existing.id
        }
      }
    }
    if (rawStatusName) {
      const nameKey = rawStatusName.trim().toLowerCase()
      if (statusByName.has(nameKey)) {
        return statusByName.get(nameKey) as number
      }
      const existing = await this.prisma.orderStatus.findFirst({
        where: { name: { equals: rawStatusName, mode: 'insensitive' } },
      })
      if (existing) {
        statusByName.set(nameKey, existing.id)
        statusById.set(existing.code, existing.id)
        return existing.id
      }
    }
    return defaultStatusId ?? null
  }

  async listDocuments(documentType: DocumentType, q: any) {
    const pageIndexRaw = Number(q.pageIndex)
    const pageSizeRaw = Number(q.pageSize)
    const pageIndex = Number.isFinite(pageIndexRaw) && pageIndexRaw > 0 ? Math.floor(pageIndexRaw) : 1
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : 50

    const where = this.withDocumentType(documentType, this.buildOrderSearchWhere(q.query) ?? {})
    const total = await this.prisma.order.count({ where })
    const sort = this.extractOrderSort(q)
    const orderBy = this.buildOrderOrderBy(sort)

    const orders = await this.prisma.order.findMany({
      where,
      orderBy,
      skip: (pageIndex - 1) * pageSize,
      take: pageSize,
      include: ORDER_LIST_INCLUDE,
    })

    const defaultStatus = documentType === DocumentType.BUDGET
      ? await this.prisma.orderStatus.findUnique({ where: { code: BUDGET_STATUS.DRAFT.code } })
      : await this.getDefaultOrderStatus()

    const data = orders.map((o: OrderWithRelations) => ({
      id: String(o.id),
      date: Math.floor(new Date(o.date).getTime() / 1000),
      customer: o.customer?.name || '',
      status: (o.statusId ?? defaultStatus?.id) || 0,
      paymentMehod: o.paymentMethod?.name || '',
      paymentIdendifier: '',
      totalAmount: Number(o.grandTotal?.toString?.() ?? o.grandTotal ?? 0),
      orderCurrency: o.orderCurrency,
    }))
    return { data, total }
  }

  async exportDocuments(documentType: DocumentType, q: any): Promise<StreamableFile> {
    const where = this.withDocumentType(documentType, this.buildOrderSearchWhere(q.query) ?? {})
    const sort = this.extractOrderSort(q)
    const orderBy = this.buildOrderOrderBy(sort)

    const orders = await this.prisma.order.findMany({
      where,
      orderBy,
      include: ORDER_LIST_INCLUDE,
    })
    const defaultStatus = documentType === DocumentType.BUDGET
      ? await this.prisma.orderStatus.findUnique({ where: { code: BUDGET_STATUS.DRAFT.code } })
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
      const statusId = (order.statusId ?? defaultStatus?.id) ?? ''
      const statusName = order.status?.name ?? defaultStatus?.name ?? ''
      return [
        order.id,
        order.date instanceof Date ? order.date.toISOString() : new Date(order.date).toISOString(),
        order.customer?.name ?? '',
        order.customer?.email ?? '',
        order.customer?.phoneNumber ?? '',
        statusId,
        statusName,
        order.paymentMethod?.name ?? '',
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

        const statusId = await this.resolveStatus(row, columnIndex, statusById, statusByName, defaultStatus?.id)

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

        const created = await this.prisma.order.create({
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
          select: { id: true },
        })
        if (documentType === DocumentType.BUDGET) {
          await this.generateBudgetPdfForClient(this.prisma, created.id)
        }
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
    await this.prisma.order.deleteMany({ where: { id: { in: numericIds }, documentType } })
    return true
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
        paymentMethod: true,
        status: true,
      },
    })
    if (!order) return null
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
    const shippingState =
      normalizeString(order.shippingState) ?? normalizeString(shippingAddressSource?.country)
    const billingAddress1 =
      normalizeString(order.billingAddress1) ?? formatLine1(billingAddressSource)
    const billingAddress2 =
      normalizeString(order.billingAddress2) ?? formatLine2(billingAddressSource)
    const billingCity =
      normalizeString(order.billingCity) ?? normalizeString(billingAddressSource?.city)
    const billingState =
      normalizeString(order.billingState) ?? normalizeString(billingAddressSource?.country)

    const previousOrdersCount = await this.prisma.order.count({
      where: {
        customerId: order.customerId,
        id: { not: order.id },
      },
    })

    const customer = order.customer
      ? (() => {
          const { addresses: _addresses, ...rest } = order.customer
          return {
            ...rest,
            previousOrder: previousOrdersCount,
          }
        })()
      : null

    return {
      id: order.id,
      date: order.date,
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
      paymentMethod: order.paymentMethod,
      status: order.status,
      subTotal: Number(order.subTotal?.toString?.() ?? order.subTotal ?? 0),
      tax: Number(order.tax?.toString?.() ?? order.tax ?? 0),
      deliveryFees: order.deliveryFees === null ? null : Number(order.deliveryFees.toString()),
      grandTotal: Number(order.grandTotal?.toString?.() ?? order.grandTotal ?? 0),
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
      billingAddress1: billingAddress1 ?? null,
      billingAddress2: billingAddress2 ?? null,
      billingCity: billingCity ?? null,
      billingState: billingState ?? null,
      billingZip: normalizeString(order.billingZip),
      shippingVendor: order.shippingVendor ?? null,
      estimatedMin: order.estimatedMin ?? null,
      estimatedMax: order.estimatedMax ?? null,
    }
  }

  private async buildBudgetPdfBuffer(
    client: PrismaService | Prisma.TransactionClient,
    orderId: number,
  ): Promise<Buffer> {
    const order = await client.order.findFirst({
      where: { id: orderId, documentType: DocumentType.BUDGET },
      include: {
        customer: {
          include: {
            addresses: {
              orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
            },
          },
        },
        items: true,
        paymentMethod: true,
      },
    })
    if (!order) {
      throw new BadRequestException('sales.budgets.notFound')
    }

    const customerAddresses = order.customer?.addresses ?? []
    const primaryAddress =
      customerAddresses.find((addr) => addr.isPrimary) ?? customerAddresses[0] ?? null
    const secondaryAddress =
      customerAddresses.find(
        (addr) => !addr.isPrimary && addr.id !== primaryAddress?.id,
      ) ?? null

    const normalize = (value?: string | null) => this.normalizeScalarString(value)
    const formatLine1 = (addr: CustomerAddress | null) => {
      if (!addr) {
        return null
      }
      const street = normalize(addr.street)
      const number = normalize(addr.number)
      if (street && number) {
        return `${street} ${number}`
      }
      return street ?? number
    }
    const formatLine2 = (addr: CustomerAddress | null) => {
      if (!addr) {
        return null
      }
      const apartment = normalize(addr.apartment)
      const corner = normalize(addr.corner)
      const parts = [
        apartment ? `Apt ${apartment}` : null,
        corner,
      ].filter((segment): segment is string => Boolean(segment))
      return parts.length ? parts.join(' • ') : null
    }
    const buildLines = (
      line1?: string | null,
      line2?: string | null,
      city?: string | null,
      state?: string | null,
      zip?: string | null,
    ) => {
      const lines: string[] = []
      if (line1) lines.push(line1)
      if (line2) lines.push(line2)
      const cityState = [city, state]
        .filter((segment): segment is string => Boolean(segment))
        .join(', ')
      if (cityState) lines.push(cityState)
      if (zip) lines.push(zip)
      return lines
    }

    const shippingLine1 = normalize(order.shippingAddress1) ?? formatLine1(primaryAddress)
    const shippingLine2 = normalize(order.shippingAddress2) ?? formatLine2(primaryAddress)
    const shippingCity =
      normalize(order.shippingCity) ?? normalize(primaryAddress?.city)
    const shippingState =
      normalize(order.shippingState) ?? normalize(primaryAddress?.country)
    const shippingZip = normalize(order.shippingZip)
    const shippingLines = buildLines(
      shippingLine1,
      shippingLine2,
      shippingCity,
      shippingState,
      shippingZip,
    )

    const billingLine1 =
      normalize(order.billingAddress1) ?? formatLine1(secondaryAddress ?? primaryAddress)
    const billingLine2 =
      normalize(order.billingAddress2) ?? formatLine2(secondaryAddress ?? primaryAddress)
    const billingCity =
      normalize(order.billingCity) ?? normalize((secondaryAddress ?? primaryAddress)?.city)
    const billingState =
      normalize(order.billingState) ?? normalize((secondaryAddress ?? primaryAddress)?.country)
    const billingZip = normalize(order.billingZip)
    const billingLines = buildLines(
      billingLine1,
      billingLine2,
      billingCity,
      billingState,
      billingZip,
    )

    const company = await this.loadCompanyProfileSummary(client)
    const currency = normalize(order.orderCurrency) ?? 'UYU'
    const subTotal = this.decimalToNumber(order.subTotal) ?? 0
    const tax = this.decimalToNumber(order.tax) ?? 0
    const deliveryFees = this.decimalToNumber(order.deliveryFees) ?? 0
    const grandTotal = this.decimalToNumber(order.grandTotal) ?? subTotal + deliveryFees
    const paymentMethodName = normalize(order.paymentMethod?.name)

    const items = order.items.map((item) => {
      const qtyRaw = Number(item.qty ?? 0)
      const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 0
      const unitBase =
        this.decimalToNumber(item.unitAmountOrderCurrency) ??
        this.decimalToNumber(item.price) ??
        0
      const unitPrice = Number.isFinite(unitBase)
        ? Math.round(unitBase * 100) / 100
        : 0
      const total = Math.round(unitPrice * qty * 100) / 100
      const extras: string[] = []
      const specSummary = normalize(item.specSummary)
      if (specSummary) {
        extras.push(specSummary)
      }
      const description = normalize(item.description)
      if (description) {
        extras.push(description)
      }
      const comments = normalize(item.comments)
      if (comments) {
        extras.push(comments)
      }
      return {
        name: item.name,
        qty,
        unitPrice,
        total,
        details: extras.join('\n'),
      }
    })

    const generatedDate = this.formatDateValue(order.date)
    const validUntil = this.formatDateValue(order.validUntil)
    const customerName = normalize(order.customer?.name) ?? '—'
    const customerEmail = normalize(order.customer?.email)
    const customerPhone = normalize(order.customer?.phoneNumber)

    return await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 })
      const buffers: Buffer[] = []
      doc.on('data', (chunk) => buffers.push(chunk))
      doc.on('error', (error) => reject(error))
      doc.on('end', () => resolve(Buffer.concat(buffers)))

      const marginLeft = doc.page.margins.left
      const marginRight = doc.page.margins.right
      const marginTop = doc.page.margins.top
      const usableWidth = doc.page.width - marginLeft - marginRight
      const rightColumnWidth = 200

      let headerBottomLeft = marginTop
      if (company) {
        doc.font('Helvetica-Bold').fontSize(20)
        doc.text(company.displayName, marginLeft, marginTop, {
          width: usableWidth - rightColumnWidth - 16,
        })
        if (company.legalName && company.legalName !== company.displayName) {
          doc.font('Helvetica').fontSize(10)
          doc.text(company.legalName, {
            width: usableWidth - rightColumnWidth - 16,
          })
        }
        doc.font('Helvetica').fontSize(10)
        for (const line of company.lines) {
          doc.text(line, {
            width: usableWidth - rightColumnWidth - 16,
          })
        }
        headerBottomLeft = doc.y
      } else {
        doc.font('Helvetica-Bold').fontSize(20)
        doc.text('Presupuesto', marginLeft, marginTop, {
          width: usableWidth - rightColumnWidth - 16,
        })
        headerBottomLeft = doc.y
      }

      doc.font('Helvetica-Bold').fontSize(18)
      doc.text(
        `Presupuesto #${order.id}`,
        marginLeft + usableWidth - rightColumnWidth,
        marginTop,
        { width: rightColumnWidth, align: 'right' },
      )
      doc.font('Helvetica').fontSize(10)
      doc.text(
        `Fecha: ${generatedDate ?? '-'}`,
        marginLeft + usableWidth - rightColumnWidth,
        doc.y,
        { width: rightColumnWidth, align: 'right' },
      )
      if (validUntil) {
        doc.text(
          `Válido hasta: ${validUntil}`,
          marginLeft + usableWidth - rightColumnWidth,
          doc.y,
          { width: rightColumnWidth, align: 'right' },
        )
      }
      doc.text(
        `Moneda: ${currency}`,
        marginLeft + usableWidth - rightColumnWidth,
        doc.y,
        { width: rightColumnWidth, align: 'right' },
      )
      if (paymentMethodName) {
        doc.text(
          `Pago: ${paymentMethodName}`,
          marginLeft + usableWidth - rightColumnWidth,
          doc.y,
          { width: rightColumnWidth, align: 'right' },
        )
      }
      const headerBottomRight = doc.y
      doc.y = Math.max(headerBottomLeft, headerBottomRight) + 20

      doc.font('Helvetica-Bold').fontSize(12)
      doc.text('Cliente', marginLeft, doc.y)
      doc.font('Helvetica').fontSize(10)
      doc.text(customerName)
      if (customerEmail) {
        doc.text(`Email: ${customerEmail}`)
      }
      if (customerPhone) {
        doc.text(`Tel: ${customerPhone}`)
      }
      const addressSection = shippingLines.length ? shippingLines : billingLines
      if (addressSection.length) {
        for (const line of addressSection) {
          doc.text(line)
        }
      }
      doc.moveDown(0.5)

      const tableTop = doc.y + 10
      doc.font('Helvetica-Bold').fontSize(11)
      doc.text('Producto', marginLeft, tableTop, { width: 260 })
      doc.text('Cant.', marginLeft + 270, tableTop, { width: 60, align: 'right' })
      doc.text('Precio', marginLeft + 340, tableTop, { width: 80, align: 'right' })
      doc.text('Total', marginLeft + 430, tableTop, { width: 80, align: 'right' })
      doc.moveTo(marginLeft, tableTop + 15)
        .lineTo(marginLeft + usableWidth, tableTop + 15)
        .strokeColor('#d1d5db')
        .stroke()
      doc.strokeColor('#000000')
      doc.font('Helvetica').fontSize(10)
      doc.y = tableTop + 20

      for (const item of items) {
        doc.font('Helvetica').fontSize(10)
        doc.text(item.name, marginLeft, doc.y, { width: 260 })
        doc.text(String(item.qty), marginLeft + 270, doc.y, {
          width: 60,
          align: 'right',
        })
        doc.text(
          this.formatCurrencyValue(item.unitPrice, currency),
          marginLeft + 340,
          doc.y,
          { width: 80, align: 'right' },
        )
        doc.text(
          this.formatCurrencyValue(item.total, currency),
          marginLeft + 430,
          doc.y,
          { width: 80, align: 'right' },
        )
        if (item.details) {
          doc.moveDown(0.15)
          doc.font('Helvetica-Oblique').fontSize(9)
          doc.text(item.details, marginLeft, doc.y, { width: 260 })
        }
        doc.moveDown(0.6)
      }

      doc.moveDown(0.5)
      doc.moveTo(marginLeft, doc.y)
        .lineTo(marginLeft + usableWidth, doc.y)
        .strokeColor('#d1d5db')
        .stroke()
      doc.strokeColor('#000000')

      const totalsX = marginLeft + usableWidth - 200
      const totalsLabelWidth = 100
      const totalsValueWidth = 100
      const totals = [
        { label: 'Subtotal', value: subTotal, bold: false },
        { label: 'Impuestos', value: tax, bold: false },
        { label: 'Envío', value: deliveryFees, bold: false },
        { label: 'Total', value: grandTotal, bold: true },
      ]
      for (const totalRow of totals) {
        const fontName = totalRow.bold ? 'Helvetica-Bold' : 'Helvetica'
        doc.font(fontName).fontSize(totalRow.bold ? 11 : 10)
        doc.text(totalRow.label, totalsX, doc.y + 4, {
          width: totalsLabelWidth,
          align: 'right',
        })
        doc.text(
          this.formatCurrencyValue(totalRow.value, currency),
          totalsX + totalsLabelWidth + 10,
          doc.y - (totalRow.bold ? 0 : 2),
          { width: totalsValueWidth, align: 'right' },
        )
      }

      if (normalize(order.comment)) {
        doc.moveDown(1)
        doc.font('Helvetica-Bold').fontSize(11)
        doc.text('Notas', marginLeft, doc.y)
        doc.font('Helvetica').fontSize(10)
        doc.text(order.comment ?? '', {
          width: usableWidth,
        })
      }

      doc.end()
    })
  }

  private async generateBudgetPdfForClient(
    client: PrismaService | Prisma.TransactionClient,
    orderId: number,
  ) {
    const buffer = await this.buildBudgetPdfBuffer(client, orderId)
    const pdfBytes = new Uint8Array(buffer)
    await client.order.update({
      where: { id: orderId },
      data: { documentPdf: pdfBytes },
    })
  }

  async createDocument(documentType: DocumentType, dto: CreateOrderDto) {
    const customerId = Number(dto.customerId)
    if (!customerId) throw new BadRequestException('sales.orders.validation.customerRequired')
    if (!Array.isArray(dto.items) || dto.items.length === 0) throw new BadRequestException('sales.orders.validation.itemsRequired')

    const taxRate = await this.getTaxRate()
    const monetary = await this.prepareOrderMonetaryData(dto, taxRate)

    const completedStatus = await this.getDefaultOrderStatus()

    const composeAddress = (addr?: any) => {
      if (!addr) return undefined
      const line1 = addr.addressLine1 || `${addr.street || ''} ${addr.number || ''}${addr.apartment ? ' Apt ' + addr.apartment : ''}`.trim()
      const line2 = addr.addressLine2 || (addr.corner ? `Corner: ${addr.corner}` : '')
      return line1 && addr.city && addr.state
        ? { addressLine1: line1, addressLine2: line2, city: addr.city, state: addr.state }
        : undefined
    }

    let paymentMethodId: number | null = null
    if (dto.paymentMehod) {
      const maybeId = Number(dto.paymentMehod)
      if (!Number.isNaN(maybeId) && maybeId > 0) {
        const pm = await this.prisma.paymentMethod.findUnique({ where: { id: maybeId } })
        if (pm) {
          paymentMethodId = pm.id
        }
      }
      if (paymentMethodId === null) {
        const name = String(dto.paymentMehod).trim()
        if (name) {
          const pm = await this.prisma.paymentMethod.upsert({
            where: { name },
            update: {},
            create: { name },
          })
          paymentMethodId = pm.id
        }
      }
    }

    let shippingAddress = composeAddress(dto.shippingAddress)
    if (!shippingAddress) {
      const primaryAddr = await this.prisma.customerAddress.findFirst({ where: { customerId, isPrimary: true } })
      if (!primaryAddr) throw new BadRequestException('sales.orders.validation.customerAddressRequired')
      shippingAddress = {
        addressLine1: `${primaryAddr.street} ${primaryAddr.number}${primaryAddr.apartment ? ' Apt ' + primaryAddr.apartment : ''}`,
        addressLine2: primaryAddr.corner ? `Corner: ${primaryAddr.corner}` : '',
        city: primaryAddr.city,
        state: primaryAddr.country,
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
        shippingState: shippingAddress.state,
        ...(dto.billingSameAsShipping
          ? {
              billingAddress1: shippingAddress.addressLine1,
              billingAddress2: shippingAddress.addressLine2,
              billingCity: shippingAddress.city,
              billingState: shippingAddress.state,
            }
          : (() => {
              const b = composeAddress(dto.billingAddress)
              return b
                ? {
                    billingAddress1: b.addressLine1,
                    billingAddress2: b.addressLine2,
                    billingCity: b.city,
                    billingState: b.state,
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
        orderCurrency: monetary.orderCurrency,
        fxBase: monetary.snapshot.base,
        fxRates: this.serializeFxSnapshot(monetary.snapshot),
        currencySnapshot: monetary.orderCurrency,
        taxRateSnapshot: decimal(taxRate).toFixed(4),
        exchangeRateSnapshot: this.serializeFxSnapshot(monetary.snapshot),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        items: { create: monetary.items },
      },
      select: { id: true },
    })
    if (documentType === DocumentType.BUDGET) {
      await this.generateBudgetPdfForClient(this.prisma, created.id)
    }
    return { id: created.id }
  }

  async replaceDocument(
    documentType: DocumentType,
    id: number,
    dto: CreateOrderDto,
  ) {
    const existing = await this.prisma.order.findFirst({ where: { id, documentType } })
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

    const composeAddress = (addr?: any) => {
      if (!addr) return undefined
      const line1 = addr.addressLine1 || `${addr.street || ''} ${addr.number || ''}${addr.apartment ? ' Apt ' + addr.apartment : ''}`.trim()
      const line2 = addr.addressLine2 || (addr.corner ? `Corner: ${addr.corner}` : '')
      return line1 && addr.city && addr.state
        ? { addressLine1: line1, addressLine2: line2, city: addr.city, state: addr.state }
        : undefined
    }

    let paymentMethodId: number | null = null
    if (dto.paymentMehod) {
      const maybeId = Number(dto.paymentMehod)
      if (!Number.isNaN(maybeId) && maybeId > 0) {
        const pm = await this.prisma.paymentMethod.findUnique({ where: { id: maybeId } })
        if (pm) {
          paymentMethodId = pm.id
        }
      }
      if (paymentMethodId === null) {
        const name = String(dto.paymentMehod).trim()
        if (name) {
          const pm = await this.prisma.paymentMethod.upsert({
            where: { name },
            update: {},
            create: { name },
          })
          paymentMethodId = pm.id
        }
      }
    }

    let shippingAddress = composeAddress(dto.shippingAddress)
    if (!shippingAddress) {
      const primaryAddr = await this.prisma.customerAddress.findFirst({ where: { customerId, isPrimary: true } })
      if (!primaryAddr) throw new BadRequestException('sales.orders.validation.customerAddressRequired')
      shippingAddress = {
        addressLine1: `${primaryAddr.street} ${primaryAddr.number}${primaryAddr.apartment ? ' Apt ' + primaryAddr.apartment : ''}`,
        addressLine2: primaryAddr.corner ? `Corner: ${primaryAddr.corner}` : '',
        city: primaryAddr.city,
        state: primaryAddr.country,
      }
    }

    const billingFromShipping = dto.billingSameAsShipping
      ? shippingAddress
      : composeAddress(dto.billingAddress)

    await this.prisma.order.update({
      where: { id },
      data: {
        customerId,
        date: dto.date ? new Date(dto.date) : new Date(),
        shippingAddress1: shippingAddress.addressLine1,
        shippingAddress2: shippingAddress.addressLine2,
        shippingCity: shippingAddress.city,
        shippingState: shippingAddress.state,
        billingSameAsShipping: dto.billingSameAsShipping,
        billingAddress1: billingFromShipping?.addressLine1 ?? null,
        billingAddress2: billingFromShipping?.addressLine2 ?? null,
        billingCity: billingFromShipping?.city ?? null,
        billingState: billingFromShipping?.state ?? null,
        shippingVendor: dto.shipping?.shippingVendor,
        paymentMethodId,
        deliveryFees: monetary.delivery.toFixed(2),
        estimatedMin: dto.shipping?.estimatedMin,
        estimatedMax: dto.shipping?.estimatedMax,
        comment: dto.comment,
        subTotal: monetary.subTotal.toFixed(2),
        tax: monetary.tax.toFixed(2),
        grandTotal: monetary.grandTotal.toFixed(2),
        orderCurrency: monetary.orderCurrency,
        fxBase: monetary.snapshot.base,
        fxRates: this.serializeFxSnapshot(monetary.snapshot),
        currencySnapshot: monetary.orderCurrency,
        taxRateSnapshot: decimal(taxRate).toFixed(4),
        exchangeRateSnapshot: this.serializeFxSnapshot(monetary.snapshot),
        validUntil: dto.validUntil ? new Date(dto.validUntil) : existing.validUntil,
        items: {
          deleteMany: {},
          create: monetary.items,
        },
      },
    })
    if (documentType === DocumentType.BUDGET) {
      await this.generateBudgetPdfForClient(this.prisma, id)
    }
    return { id }
  }

  async updateDocumentComment(documentType: DocumentType, id: number, body: { comment?: string }) {
    const result = await this.prisma.order.updateMany({
      where: { id: id, documentType },
      data: { comment: body.comment ?? null },
    })
    if (result.count === 0) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }
    if (documentType === DocumentType.BUDGET) {
      await this.generateBudgetPdfForClient(this.prisma, id)
    }
    return true
  }

  async updateDocumentStatus(documentType: DocumentType, id: number, body: { status: number }) {
    const result = await this.prisma.order.updateMany({
      where: { id: id, documentType },
      data: { statusId: body.status },
    })
    if (result.count === 0) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }
    if (documentType === DocumentType.BUDGET) {
      await this.generateBudgetPdfForClient(this.prisma, id)
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
    let pmId: number | null = null
    let pm: { id: number } | null = null
    const maybeNum = Number(raw)
    if (!Number.isNaN(maybeNum) && String(raw).trim() === String(maybeNum)) {
      pmId = maybeNum
      pm = await this.prisma.paymentMethod.findUnique({ where: { id: pmId } })
    }
    if (!pm) {
      const name = String(raw).trim()
      pm = await this.prisma.paymentMethod.upsert({ where: { name }, update: {}, create: { name } })
    }
    const updated = await this.prisma.order.updateMany({
      where: { id: id, documentType },
      data: { paymentMethodId: pm.id },
    })
    if (updated.count === 0) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }
    if (documentType === DocumentType.BUDGET) {
      await this.generateBudgetPdfForClient(this.prisma, id)
    }
    return true
  }

  async sendBudget(id: number, userId: number | null) {
    const sentStatusId = await this.getBudgetStatusId('SENT')
    return this.prisma.$transaction(async (tx) => {
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
      await this.generateBudgetPdfForClient(tx, budget.id)
      return {
        budgetId: budget.id,
        statusId: sentStatusId,
        validUntil: validity,
        updatedBy: userId ?? null,
      }
    })
  }

  async confirmBudget(id: number, userId: number | null) {
    const convertedStatusId = await this.getBudgetStatusId('CONVERTED')
    const defaultOrderStatus = await this.getDefaultOrderStatus()
    return this.prisma.$transaction(async (tx) => {
      const budget = await tx.order.findFirst({
        where: { id, documentType: DocumentType.BUDGET },
        include: { items: true },
      })
      if (!budget) {
        throw new BadRequestException('sales.budgets.notFound')
      }
      if (budget.convertedOrderId) {
        return { budgetId: budget.id, orderId: budget.convertedOrderId }
      }

      const fxRatesJson = budget.fxRates as Prisma.InputJsonValue | undefined
      const exchangeSnapshotJson = budget.exchangeRateSnapshot
        ? (budget.exchangeRateSnapshot as Prisma.InputJsonValue)
        : fxRatesJson

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
          billingAddress1: budget.billingAddress1,
          billingAddress2: budget.billingAddress2,
          billingCity: budget.billingCity,
          billingState: budget.billingState,
          billingZip: budget.billingZip,
          billingSameAsShipping: budget.billingSameAsShipping,
          shippingVendor: budget.shippingVendor,
          deliveryFees: this.decimalToString(budget.deliveryFees) ?? undefined,
          estimatedMin: budget.estimatedMin,
          estimatedMax: budget.estimatedMax,
          comment: budget.comment,
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

      return { budgetId: budget.id, orderId: newOrder.id }
    })
  }

  async getDocumentPdf(documentType: DocumentType, id: number): Promise<StreamableFile> {
    let order = await this.prisma.order.findFirst({
      where: { id, documentType },
      select: { documentPdf: true },
    })
    if ((!order || !order.documentPdf) && documentType === DocumentType.BUDGET) {
      await this.generateBudgetPdfForClient(this.prisma, id)
      order = await this.prisma.order.findFirst({
        where: { id, documentType },
        select: { documentPdf: true },
      })
    }
    if (!order || !order.documentPdf) {
      throw new BadRequestException('sales.documents.pdfNotFound')
    }
    const filename = `${documentType === DocumentType.BUDGET ? 'budget' : 'order'}-${id}.pdf`
    return new StreamableFile(Buffer.from(order.documentPdf), {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    })
  }
}

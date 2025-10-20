import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Patch,
  Put,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common'
import { Prisma, CustomerAddress } from '@prisma/client'
import type { FastifyRequest } from 'fastify'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
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

@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currencyConversion: CurrencyConversionService,
  ) {}

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
          select: { id: true, currency: true, salePrice: true, costPrice: true, name: true },
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
        comments: meta.item.comments?.trim?.() ? meta.item.comments.trim() : null,
        unitAmount: unitAmount.toFixed(4),
        unitCurrency: meta.unitCurrency,
        unitAmountOrderCurrency: unitAmountOrderCurrency.toFixed(4),
        conversionRate: conversionRate.toFixed(8),
        unitCostAmount: meta.unitCost ? meta.unitCost.toFixed(4) : undefined,
        unitCostCurrency: meta.unitCost ? meta.costCurrency : undefined,
        unitCostOrderCurrency: unitCostOrderCurrency ? unitCostOrderCurrency.toFixed(4) : undefined,
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

  @Get()
  async listOrders(@Query() q: any) {
    const pageIndexRaw = Number(q.pageIndex)
    const pageSizeRaw = Number(q.pageSize)
    const pageIndex = Number.isFinite(pageIndexRaw) && pageIndexRaw > 0 ? Math.floor(pageIndexRaw) : 1
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : 50

    const where = this.buildOrderSearchWhere(q.query) ?? {}
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

    const defaultStatus = await this.getDefaultOrderStatus()

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

  @Get('export')
  async exportOrders(@Query() q: any): Promise<StreamableFile> {
    const where = this.buildOrderSearchWhere(q.query) ?? {}
    const sort = this.extractOrderSort(q)
    const orderBy = this.buildOrderOrderBy(sort)

    const orders = await this.prisma.order.findMany({
      where,
      orderBy,
      include: ORDER_LIST_INCLUDE,
    })
    const defaultStatus = await this.getDefaultOrderStatus()

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

  @Post('import')
  async importOrders(@Req() req: FastifyRequest) {
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
            const exists = await this.prisma.order.findUnique({ where: { id: numericId } })
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

        await this.prisma.order.create({
          data: {
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

  @Delete()
  async deleteOrders(@Body() body: { id: string | string[] }) {
    const ids = Array.isArray(body.id) ? body.id : [body.id]
    const numericIds = ids.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0)
    if (!numericIds.length) {
      throw new BadRequestException('sales.orders.validation.invalidIds')
    }
    await this.prisma.order.deleteMany({ where: { id: { in: numericIds } } })
    return true
  }

  @Get(':id/details')
  async orderDetails(@Param('id', ParseIntPipe) id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
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

  @Post()
  async createOrder(@Body() dto: CreateOrderDto) {
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

    await this.prisma.order.create({
      data: {
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
        items: { create: monetary.items },
      },
    })
    return true
  }

  @Put(':id')
  async replaceOrder(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateOrderDto,
  ) {
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
        items: {
          deleteMany: {},
          create: monetary.items,
        },
      },
    })
    return true
  }

  @Patch(':id/comment')
  async updateOrderComment(@Param('id', ParseIntPipe) id: number, @Body() body: { comment?: string }) {
    await this.prisma.order.update({
      where: { id },
      data: { comment: body.comment ?? null },
    })
    return true
  }

  @Put(':id/status')
  async updateOrderStatus(@Param('id', ParseIntPipe) id: number, @Body() body: { status: number }) {
    await this.prisma.order.update({ where: { id }, data: { statusId: body.status } })
    return true
  }

  @Put(':id/payment-method')
  async updateOrderPaymentMethod(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { paymentMehod?: string | number | null },
  ) {
    const raw = body.paymentMehod
    if (raw === undefined || raw === null || String(raw).trim() === '') {
      await this.prisma.order.update({ where: { id }, data: { paymentMethodId: null } })
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
    await this.prisma.order.update({ where: { id }, data: { paymentMethodId: pm.id } })
    return true
  }
}

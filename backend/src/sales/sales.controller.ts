import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
  UseGuards,
} from '@nestjs/common'
import { Prisma, SalesUnit } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { UpsertProductDto, UpdateProductDto, TableQueryDto as ProductQuery } from './dto/product.dto'
import { calculateOrderLineTotals, costPriceFromSale, decimalToNumber, roundCurrency, salePriceFromCost } from './utils/pricing'
import { DashboardFilterDto } from './dto/dashboard.dto'
import type { FastifyRequest } from 'fastify'

type ProductSortKey =
  | 'id'
  | 'name'
  | 'productCode'
  | 'brand'
  | 'vendor'
  | 'salePrice'
  | 'costPrice'
  | 'stock'
  | 'status'
  | 'published'
  | 'category'

const SALES_UNIT_KEYWORDS: Record<SalesUnit, string[]> = {
  [SalesUnit.UNIT]: ['unit', 'units', 'unidad', 'unidades', 'u'],
  [SalesUnit.SQUARE_METER]: ['squaremeter', 'squaremeters', 'metroscuadrados', 'metrocuadrado', 'metroscuadrado', 'm2', 'sqm', 'mt2'],
  [SalesUnit.LINEAR_METER]: ['linearmeter', 'linearmeters', 'metrolineal', 'metroslineales', 'ml', 'lm'],
}

@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private prisma: PrismaService) {}

  private async getTaxRate() {
    const cfg = await this.prisma.systemConfig.findUnique({ where: { key: 'taxRate' } })
    const val = Number(cfg?.value ?? '22')
    return Number.isNaN(val) ? 22 : val
  }

  private deriveInventoryStatus(stock?: number | null, permanent?: boolean | null): 0 | 1 | 2 {
    const numericStock = Number(stock ?? 0)
    const normalizedStock = Number.isNaN(numericStock) ? 0 : numericStock
    const isPermanent = Boolean(permanent)
    if (isPermanent) {
      return 0
    }
    if (normalizedStock <= 0) {
      return 2
    }
    if (normalizedStock < 5) {
      return 1
    }
    return 0
  }

  private startOfDay(date: Date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }

  private dayKey(date: Date) {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  private formatCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return ''
    }
    const str = String(value)
    if (/[",\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }

  private buildCsv(rows: unknown[][]): string {
    return rows.map((row) => row.map((cell) => this.formatCsvValue(cell)).join(',')).join('\n')
  }

  private normalizeProductSortKey(raw?: string | null): ProductSortKey | undefined {
    const key = raw?.toString()?.trim()
    if (!key) return undefined
    const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase()
    switch (normalized) {
      case 'id':
        return 'id'
      case 'name':
        return 'name'
      case 'productcode':
        return 'productCode'
      case 'brand':
        return 'brand'
      case 'vendor':
        return 'vendor'
      case 'price':
      case 'saleprice':
      case 'precioventa':
        return 'salePrice'
      case 'costprice':
      case 'preciocosto':
      case 'costperitem':
        return 'costPrice'
      case 'stock':
        return 'stock'
      case 'status':
        return 'status'
      case 'published':
        return 'published'
      case 'category':
        return 'category'
      default:
        return undefined
    }
  }

  private normalizeSortDirection(raw?: string | null): 'asc' | 'desc' | undefined {
    const direction = raw?.toString()?.toLowerCase?.() ?? ''
    if (direction === 'asc' || direction === 'ascending' || direction === 'ascend') return 'asc'
    if (direction === 'desc' || direction === 'descending' || direction === 'descend') return 'desc'
    return undefined
  }

  private buildProductOrderBy(sort?: { key?: string; order?: 'asc' | 'desc' | '' }): Prisma.ProductOrderByWithRelationInput[] {
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = []
    const key = this.normalizeProductSortKey(sort?.key)
    const order = this.normalizeSortDirection(sort?.order ?? '')
    if (key && order) {
      switch (key) {
        case 'id':
          orderBy.push({ id: order })
          break
        case 'name':
          orderBy.push({ name: order })
          break
        case 'productCode':
          orderBy.push({ productCode: order })
          break
        case 'brand':
          orderBy.push({ brand: order })
          break
        case 'vendor':
          orderBy.push({ vendor: order })
          break
        case 'salePrice':
          orderBy.push({ salePrice: order })
          break
        case 'costPrice':
          orderBy.push({ costPrice: order })
          break
        case 'stock':
          orderBy.push({ stock: order })
          break
        case 'status':
          orderBy.push({ status: order })
          break
        case 'published':
          orderBy.push({ published: order })
          break
        case 'category':
          orderBy.push({ category: { name: order } })
          break
      }
    }
    // Ensure deterministic fallback order
    orderBy.push({ id: 'desc' })
    return orderBy
  }

  private buildProductWhere(dto: ProductQuery): Prisma.ProductWhereInput {
    const andConditions: Prisma.ProductWhereInput[] = []

    const parseFilterData = (input: unknown): Record<string, unknown> | undefined => {
      if (!input) return undefined
      if (typeof input === 'string') {
        try {
          const parsed = JSON.parse(input)
          return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined
        } catch {
          return undefined
        }
      }
      if (typeof input === 'object') {
        return input as Record<string, unknown>
      }
      return undefined
    }

    const appendSearch = (value?: string | null) => {
      const term = value?.toString()?.trim()
      if (!term) return
      andConditions.push({
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { productCode: { contains: term, mode: 'insensitive' } },
          { brand: { contains: term, mode: 'insensitive' } },
          { vendor: { contains: term, mode: 'insensitive' } },
        ],
      })
    }

    appendSearch(dto.query)
    const filterData = parseFilterData((dto as any)?.filterData)
    const filterName = filterData?.name
    if (typeof filterName === 'string') {
      appendSearch(filterName)
    }

    const currencySelection = filterData?.currency
    const currencyList: string[] = []
    const pushCurrency = (value: unknown) => {
      if (typeof value !== 'string' && typeof value !== 'number') return
      const normalized = String(value).trim().toUpperCase()
      if (!normalized || !/^[A-Z]{3,5}$/.test(normalized)) return
      if (!currencyList.includes(normalized)) {
        currencyList.push(normalized)
      }
    }
    if (Array.isArray(currencySelection)) {
      for (const item of currencySelection) {
        pushCurrency(item)
      }
    } else if (currencySelection !== undefined && currencySelection !== null) {
      pushCurrency(currencySelection)
    }
    if (currencyList.length) {
      andConditions.push({
        currency: { in: currencyList },
      })
    }

    if (!andConditions.length) return {}
    return { AND: andConditions }
  }

  private normalizeHeaderKey(key: string | undefined | null): string {
    if (!key) return ''
    return key.toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  private parseCsv(content: string): string[][] {
    const normalized = content.replace(/^\uFEFF/, '')
    const lines = normalized.split(/\r?\n/)
    const rows: string[][] = []
    for (const rawLine of lines) {
      if (!rawLine || !rawLine.trim()) continue
      const cells: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < rawLine.length; i += 1) {
        const ch = rawLine[i]
        if (ch === '"') {
          if (inQuotes && rawLine[i + 1] === '"') {
            current += '"'
            i += 1
          } else {
            inQuotes = !inQuotes
          }
        } else if (ch === ',' && !inQuotes) {
          cells.push(current)
          current = ''
        } else {
          current += ch
        }
      }
      cells.push(current)
      rows.push(cells.map((cell) => cell.trim()))
    }
    return rows
  }

  private getCell(row: string[], columnIndex: Map<string, number>, key: string, aliases: string[] = []): string {
    const keys = [key, ...aliases]
    for (const candidate of keys) {
      const normalized = this.normalizeHeaderKey(candidate)
      if (!normalized) continue
      const idx = columnIndex.get(normalized)
      if (idx !== undefined) {
        return (row[idx] ?? '').trim()
      }
    }
    return ''
  }

  private parseNumber(value?: string | number | null): number {
    if (value === null || value === undefined) return 0
    const raw = typeof value === 'number' ? value.toString() : value
    const trimmed = raw.trim()
    if (!trimmed) return 0
    const numericLike = trimmed.replace(/\s+/g, '')
    const dotNormalized =
      numericLike.includes(',') && !numericLike.includes('.')
        ? numericLike.replace(/,/g, '.')
        : numericLike.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '')
    const direct = Number(dotNormalized)
    if (!Number.isNaN(direct)) return direct
    const fallback = Number(dotNormalized.replace(/[^0-9.\-]/g, ''))
    return Number.isNaN(fallback) ? 0 : fallback
  }

  private parseDate(value?: string | number | null): Date | undefined {
    if (value === null || value === undefined) return undefined
    const raw = typeof value === 'number' ? value.toString() : value
    const trimmed = raw.trim()
    if (!trimmed) return undefined
    const num = Number(trimmed)
    if (!Number.isNaN(num) && trimmed.length <= 13) {
      const millis = trimmed.length <= 10 ? num * 1000 : num
      const dateFromNum = new Date(millis)
      if (!Number.isNaN(dateFromNum.getTime())) return dateFromNum
    }
    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) return parsed
    return undefined
  }

  private parseOptionalBoolean(raw: unknown): boolean | undefined {
    if (raw === null || raw === undefined) return undefined
    if (typeof raw === 'boolean') return raw
    const str = raw.toString().trim()
    if (!str) return undefined
    const normalized = str.toLowerCase()
    if (['1', 'true', 'yes', 'y', 'si', 'sí', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false
    return undefined
  }

  private parseSalesUnit(raw: unknown): SalesUnit | undefined {
    if (raw === null || raw === undefined) return undefined
    const str = raw.toString().trim()
    if (!str) return undefined
    const upper = str.toUpperCase()
    if ((Object.values(SalesUnit) as string[]).includes(upper)) {
      return upper as SalesUnit
    }
    const normalized = str
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w]+/g, '')

    for (const [unit, keywords] of Object.entries(SALES_UNIT_KEYWORDS) as [SalesUnit, string[]][]) {
      if (keywords.includes(normalized)) {
        return unit
      }
    }

    return undefined
  }

  private normalizeOptionalString(value?: string | null): string | undefined {
    const trimmed = value?.toString?.().trim?.()
    return trimmed ? trimmed : undefined
  }

  private splitTags(value?: string | null): string[] | undefined {
    const normalized = this.normalizeOptionalString(value)
    if (!normalized) return undefined
    const items = normalized
      .split(/[|,]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
    return items.length ? items : undefined
  }

  private async resolveCategoryId(
    name: string | undefined,
    cache: Map<string, number>,
  ): Promise<number | undefined> {
    const normalized = this.normalizeOptionalString(name)
    if (!normalized) return undefined
    const key = normalized.toLowerCase()
    if (cache.has(key)) return cache.get(key)
    let category = await this.prisma.productCategory.findFirst({
      where: { name: { equals: normalized, mode: 'insensitive' } },
    })
    if (!category) {
      category = await this.prisma.productCategory.create({ data: { name: normalized } })
    }
    cache.set(key, category.id)
    return category.id
  }

  private async resolveCustomer(
    email: string,
    name: string,
    phone: string,
    cache: Map<string, any>,
  ) {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) throw new Error('customerEmail is required')
    const cached = cache.get(normalizedEmail)
    if (cached) return cached

    let customer = await this.prisma.customer.findFirst({ where: { email: normalizedEmail } })
    const trimmedName = name?.trim?.() || normalizedEmail
    const phoneNumber = phone?.trim?.() || undefined

    if (!customer) {
      const parts = trimmedName.split(/\s+/).filter(Boolean)
      const firstName = parts.shift() || ''
      const lastName = parts.join(' ')
      customer = await this.prisma.customer.create({
        data: {
          email: normalizedEmail,
          name: trimmedName,
          firstName: firstName || null,
          lastName: lastName || null,
          phoneNumber: phoneNumber || null,
        },
      })
    } else {
      const updates: Prisma.CustomerUpdateInput = {}
      if (trimmedName && (!customer.name || customer.name !== trimmedName)) {
        updates.name = trimmedName
      }
      if (trimmedName && (!customer.firstName || !customer.lastName)) {
        const parts = trimmedName.split(/\s+/).filter(Boolean)
        if (!customer.firstName && parts[0]) updates.firstName = parts[0]
        if (!customer.lastName && parts.length > 1) updates.lastName = parts.slice(1).join(' ')
      }
      if (phoneNumber && !customer.phoneNumber) {
        updates.phoneNumber = phoneNumber
      }
      if (Object.keys(updates).length > 0) {
        customer = await this.prisma.customer.update({
          where: { id: customer.id },
          data: updates,
        })
      }
    }
    cache.set(normalizedEmail, customer)
    return customer
  }

  private async resolvePaymentMethod(
    methodName: string,
    cache: Map<string, number>,
  ): Promise<number | undefined> {
    const normalizedName = (methodName || 'Cash').trim()
    if (!normalizedName) return undefined
    const key = normalizedName.toLowerCase()
    if (cache.has(key)) return cache.get(key)
    let method = await this.prisma.paymentMethod.findFirst({
      where: { name: { equals: normalizedName, mode: 'insensitive' } },
    })
    if (!method) {
      method = await this.prisma.paymentMethod.create({ data: { name: normalizedName } })
    }
    cache.set(key, method.id)
    return method.id
  }

  private async resolveStatus(
    row: string[],
    columnIndex: Map<string, number>,
    byId: Map<number, number>,
    byName: Map<string, number>,
    fallbackId?: number,
  ): Promise<number | undefined> {
    const rawStatusId = this.getCell(row, columnIndex, 'statusId', ['status'])
    const numericStatus = rawStatusId ? Math.round(this.parseNumber(rawStatusId)) : 0
    if (numericStatus > 0) {
      if (byId.has(numericStatus)) return byId.get(numericStatus)
      const status = await this.prisma.orderStatus.findUnique({ where: { id: numericStatus } })
      if (status) {
        byId.set(status.id, status.id)
        if (status.name) byName.set(status.name.toLowerCase(), status.id)
        return status.id
      }
    }
    const rawStatusName = this.getCell(row, columnIndex, 'statusName')
    if (rawStatusName) {
      const normalizedName = rawStatusName.trim().toLowerCase()
      if (normalizedName && byName.has(normalizedName)) {
        return byName.get(normalizedName)
      }
      const status = await this.prisma.orderStatus.findFirst({
        where: { name: { equals: rawStatusName, mode: 'insensitive' } },
      })
      if (status) {
        byId.set(status.id, status.id)
        if (status.name) byName.set(status.name.toLowerCase(), status.id)
        return status.id
      }
    }
    return fallbackId
  }

  @Post('dashboard')
  async dashboard(@Body() dto: DashboardFilterDto) {
    const { startDate, endDate } = dto ?? {}
    const dateRange: Prisma.DateTimeFilter = {}
    if (typeof startDate === 'number' && !Number.isNaN(startDate)) {
      dateRange.gte = new Date(startDate * 1000)
    }
    if (typeof endDate === 'number' && !Number.isNaN(endDate)) {
      dateRange.lte = new Date(endDate * 1000)
    }

    const where: Prisma.OrderWhereInput = {}
    if (Object.keys(dateRange).length > 0) {
      where.date = dateRange
    }

    // Revenue and orders
    const orders = await this.prisma.order.findMany({
      where,
      include: { items: { include: { product: true } } },
    })
    let revenue = 0
    let totalCost = 0

    // Report categories and series based on selected range
    const categories: number[] = []
    const revenueSeries: number[] = []
    const netIncomeSeries: number[] = []

    const revenueByDay = new Map<string, number>()
    const netIncomeByDay = new Map<string, number>()
    const revenueByMonth = new Map<string, number>()
    const netIncomeByMonth = new Map<string, number>()
    const hourlyRevenue = Array.from({ length: 24 }, () => 0)
    const hourlyNetIncome = Array.from({ length: 24 }, () => 0)
    const qtyByProduct = new Map<number, number>()
    for (const order of orders) {
      const orderDateObj = new Date(order.date)
      const date = this.startOfDay(orderDateObj)
      const key = this.dayKey(date)
      let orderSales = 0
      let orderCost = 0
      for (const item of order.items) {
        const qty = item.qty || 0
        if (item.productId) {
          qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) || 0) + qty)
        }
        const { saleTotal: lineSale, costTotal: lineCost } = calculateOrderLineTotals({
          price: item.price,
          qty: item.qty,
          product: item.product ?? undefined,
        })
        orderSales += lineSale
        orderCost += lineCost
      }
      revenue += orderSales
      totalCost += orderCost
      const orderNetIncome = orderSales - orderCost
      const currentRevenue = revenueByDay.get(key) ?? 0
      revenueByDay.set(key, currentRevenue + orderSales)
      netIncomeByDay.set(key, (netIncomeByDay.get(key) ?? 0) + orderNetIncome)
      const monthKey = `${orderDateObj.getFullYear()}-${orderDateObj.getMonth()}`
      revenueByMonth.set(monthKey, (revenueByMonth.get(monthKey) ?? 0) + orderSales)
      netIncomeByMonth.set(monthKey, (netIncomeByMonth.get(monthKey) ?? 0) + orderNetIncome)
      const hour = orderDateObj.getHours()
      if (hour >= 0 && hour < 24) {
        hourlyRevenue[hour] += orderSales
        hourlyNetIncome[hour] += orderNetIncome
      }
    }

    let rangeStart = typeof startDate === 'number' ? this.startOfDay(new Date(startDate * 1000)) : undefined
    let rangeEnd = typeof endDate === 'number' ? this.startOfDay(new Date(endDate * 1000)) : undefined

    if (!rangeStart && orders.length > 0) {
      const minDate = orders.reduce((min, order) => {
        const current = this.startOfDay(new Date(order.date))
        return current < min ? current : min
      }, this.startOfDay(new Date(orders[0].date)))
      rangeStart = minDate
    }

    if (!rangeEnd && orders.length > 0) {
      const maxDate = orders.reduce((max, order) => {
        const current = this.startOfDay(new Date(order.date))
        return current > max ? current : max
      }, this.startOfDay(new Date(orders[0].date)))
      rangeEnd = maxDate
    }

    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      const today = this.startOfDay(new Date())
      rangeStart = today
      rangeEnd = today
    }

    const dayMs = 24 * 60 * 60 * 1000
    const totalSpanDays =
      rangeEnd && rangeStart
        ? Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / dayMs)
        : 0
    const isSingleDayRange = !rangeStart || !rangeEnd ? true : totalSpanDays <= 0
    const isFullYearRange =
      !!rangeStart &&
      !!rangeEnd &&
      rangeStart.getFullYear() === rangeEnd.getFullYear() &&
      rangeStart.getMonth() === 0 &&
      rangeStart.getDate() === 1 &&
      rangeEnd.getMonth() === 11

    const granularity: 'hour' | 'day' | 'month' = isSingleDayRange
      ? 'hour'
      : isFullYearRange
        ? 'month'
        : 'day'

    if (granularity === 'hour') {
      const base = rangeStart ?? this.startOfDay(new Date())
      for (let hour = 0; hour < 24; hour++) {
        const bucketTime = new Date(base)
        bucketTime.setHours(hour, 0, 0, 0)
        categories.push(Math.floor(bucketTime.getTime() / 1000))
        revenueSeries.push(
          Math.round((hourlyRevenue[hour] + Number.EPSILON) * 100) / 100,
        )
        netIncomeSeries.push(
          Math.round((hourlyNetIncome[hour] + Number.EPSILON) * 100) / 100,
        )
      }
    } else if (granularity === 'month') {
      const year = rangeStart?.getFullYear() ?? new Date().getFullYear()
      for (let month = 0; month < 12; month++) {
        const bucketTime = new Date(year, month, 1)
        const monthKey = `${year}-${month}`
        categories.push(Math.floor(bucketTime.getTime() / 1000))
        revenueSeries.push(
          Math.round(((revenueByMonth.get(monthKey) ?? 0) + Number.EPSILON) * 100) /
            100,
        )
        netIncomeSeries.push(
          Math.round(((netIncomeByMonth.get(monthKey) ?? 0) + Number.EPSILON) * 100) /
            100,
        )
      }
    } else {
      for (let ts = rangeStart.getTime(); ts <= rangeEnd.getTime(); ts += dayMs) {
        const current = new Date(ts)
        current.setHours(0, 0, 0, 0)
        const key = this.dayKey(current)
        const bucketRevenue = revenueByDay.get(key) ?? 0
        const bucketNetIncome = netIncomeByDay.get(key) ?? 0
        categories.push(Math.floor(current.getTime() / 1000))
        revenueSeries.push(
          Math.round((bucketRevenue + Number.EPSILON) * 100) / 100,
        )
        netIncomeSeries.push(
          Math.round((bucketNetIncome + Number.EPSILON) * 100) / 100,
        )
      }
    }

    // Top products by sold qty
    const products = await this.prisma.product.findMany()
    const topProducts = products
      .map((p) => ({
        id: String(p.id),
        name: p.name,
        img: p.img || '',
        sold: qtyByProduct.get(p.id) || 0,
        specifications: (p as any).specifications ?? undefined,
      }))
      .filter((p) => p.sold > 0)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 6)

    // Latest orders short list
    const latest = await this.prisma.order.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { customer: true, paymentMethod: true },
      take: 8,
    })
    const latestOrderData = latest.map((o) => ({
      id: String(o.id),
      date: Math.floor(new Date(o.date).getTime() / 1000),
      customer: o.customer?.name || '',
      status: o.statusId || 0,
      paymentMehod: o.paymentMethod?.name || '',
      paymentIdendifier: '',
      totalAmount: o.grandTotal,
    }))

    // Sales by categories
    const cats = await this.prisma.productCategory.findMany({ include: { products: true } })
    const categorySummary = cats
      .map((category) => {
        const label = category.name?.trim()
        const value = category.products.reduce(
          (sum, product) => sum + (qtyByProduct.get(product.id) || 0),
          0,
        )
        return { label, value }
      })
      .filter((item) => Boolean(item.label))
      .sort((a, b) => b.value - a.value)
    const categoryLabels = categorySummary.map((item) => item.label as string)
    const categoryTotals = categorySummary.map((item) => item.value)

    const netIncome = revenue - totalCost

    return {
      statisticData: {
        orders: { value: orders.length, growShrink: 0 },
        revenue: { value: Math.round(revenue * 100) / 100, growShrink: 0 },
        netIncome: { value: Math.round(netIncome * 100) / 100, growShrink: 0 },
      },
      salesReportData: {
        series: [
          { name: 'Revenue', data: revenueSeries },
          { name: 'Net Income', data: netIncomeSeries },
        ],
        categories,
        granularity,
      },
      topProductsData: topProducts,
      latestOrderData,
      salesByCategoriesData: { labels: categoryLabels, data: categoryTotals },
    }
  }

  // Products
  @Post('products')
  async listProducts(@Body() dto: ProductQuery) {
    const where = this.buildProductWhere(dto)
    const total = await this.prisma.product.count({ where })
    const pageIndex = Number(dto.pageIndex || 1)
    const pageSize = Number(dto.pageSize || 50)

    const orderBy = this.buildProductOrderBy(dto.sort)

    const rows = await this.prisma.product.findMany({
      where,
      orderBy,
      skip: (pageIndex - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        productCode: true,
        img: true,
        salePrice: true,
        costPrice: true,
        currency: true,
        unitOfMeasure: true,
        stock: true,
        permanentStock: true,
        status: true,
        published: true,
        tags: true,
        brand: true,
        vendor: true,
        category: { select: { name: true } },
        specifications: true,
      },
    })
    const data = rows.map((p) => ({
      id: String(p.id),
      name: p.name,
      productCode: p.productCode || '',
      img: p.img || '',
      category: (p as any).category?.name || '',
      salePrice: decimalToNumber(p.salePrice),
      costPrice: decimalToNumber(p.costPrice),
      currency: p.currency,
      unitOfMeasure: p.unitOfMeasure,
      stock: p.stock,
      permanentStock: p.permanentStock,
      status: this.deriveInventoryStatus(p.stock, p.permanentStock),
      published: p.published,
      tags: (p as any).tags || [],
      brand: p.brand || '',
      vendor: p.vendor || '',
      specifications: p.specifications ?? '',
    }))
    return { data, total }
  }

  @Post('products/export')
  async exportProducts(@Body() dto: ProductQuery): Promise<StreamableFile> {
    const where = this.buildProductWhere(dto)
    const orderBy = this.buildProductOrderBy(dto.sort)
    const products = await this.prisma.product.findMany({
      where,
      orderBy,
      include: {
        category: { select: { name: true } },
      },
    })

    const statusLabel: Record<number, string> = {
      0: 'In Stock',
      1: 'Limited',
      2: 'Out of Stock',
    }

    const header: unknown[] = [
      'id',
      'name',
      'productCode',
      'brand',
      'vendor',
      'category',
      'salePrice',
      'costPrice',
      'currency',
      'unitOfMeasure',
      'stock',
      'status',
      'statusLabel',
      'permanentStock',
      'published',
      'tags',
      'specifications',
      'createdAt',
      'updatedAt',
    ]

    const rows: unknown[][] = products.map((product) => {
      const statusValue = Number(product.status ?? this.deriveInventoryStatus(product.stock, product.permanentStock))
      const salePriceValue =
        product.salePrice !== null && product.salePrice !== undefined
          ? decimalToNumber(product.salePrice).toFixed(2)
          : ''
      const costPriceValue =
        product.costPrice !== null && product.costPrice !== undefined
          ? decimalToNumber(product.costPrice).toFixed(2)
          : ''
      const tags = Array.isArray(product.tags) ? product.tags.join('|') : ''
      const created =
        product.createdAt instanceof Date ? product.createdAt : new Date(product.createdAt ?? undefined)
      const updated =
        product.updatedAt instanceof Date ? product.updatedAt : new Date(product.updatedAt ?? undefined)
      return [
        product.id,
        product.name,
        product.productCode ?? '',
        product.brand ?? '',
        product.vendor ?? '',
        product.category?.name ?? '',
        salePriceValue,
        costPriceValue,
        product.currency ?? '',
        product.unitOfMeasure ?? SalesUnit.UNIT,
        product.stock ?? 0,
        statusValue,
        statusLabel[statusValue] ?? '',
        product.permanentStock ? 'true' : 'false',
        product.published ? 'true' : 'false',
        tags,
        product.specifications ?? '',
        Number.isNaN(created.getTime()) ? '' : created.toISOString(),
        Number.isNaN(updated.getTime()) ? '' : updated.toISOString(),
      ]
    })

    const csv = this.buildCsv([header, ...rows])
    const filename = `products-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
    return new StreamableFile(Buffer.from(csv, 'utf8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    })
  }

  @Post('products/import')
  async importProducts(@Req() req: FastifyRequest) {
    const file = await (req as any)?.file?.()
    if (!file) throw new BadRequestException('sales.productList.import.fileRequired')
    const buffer = await file.toBuffer()
    if (!buffer || buffer.length === 0) throw new BadRequestException('sales.productList.import.emptyFile')

    const rows = this.parseCsv(buffer.toString('utf8'))
    if (!rows.length) throw new BadRequestException('sales.productList.import.emptyFile')

    const header = rows.shift() ?? []
    const columnIndex = new Map<string, number>()
    header.forEach((col, idx) => {
      const normalized = this.normalizeHeaderKey(col)
      if (normalized) columnIndex.set(normalized, idx)
    })

    if (!columnIndex.has(this.normalizeHeaderKey('name'))) {
      throw new BadRequestException('Missing required column: name')
    }

    const categoryCache = new Map<string, number>()
    const errors: { row: number; message: string }[] = []
    let created = 0
    let updated = 0

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]
      const lineNumber = i + 2
      try {
        const idRaw = this.getCell(row, columnIndex, 'id')
        const id = idRaw ? Math.round(this.parseNumber(idRaw)) : undefined
        const codeRaw = this.getCell(row, columnIndex, 'productCode', ['code', 'sku'])
        const productCode = this.normalizeOptionalString(codeRaw)
        const nameRaw = this.getCell(row, columnIndex, 'name', ['productname'])
        const name = this.normalizeOptionalString(nameRaw)
        if (!name) throw new Error('Product name is required')

        const description = this.normalizeOptionalString(this.getCell(row, columnIndex, 'description', ['desc']))
        const img = this.normalizeOptionalString(this.getCell(row, columnIndex, 'img', ['image', 'imageurl']))
        const brand = this.normalizeOptionalString(this.getCell(row, columnIndex, 'brand'))
        const vendor = this.normalizeOptionalString(this.getCell(row, columnIndex, 'vendor'))
        const categoryName = this.normalizeOptionalString(this.getCell(row, columnIndex, 'category', ['categoryname']))
        const tags = this.splitTags(this.getCell(row, columnIndex, 'tags'))
        const currencyRaw = this.normalizeOptionalString(this.getCell(row, columnIndex, 'currency', ['currencycode']))
        const currency = currencyRaw ? currencyRaw.toUpperCase() : undefined
        const unitRaw = this.normalizeOptionalString(
          this.getCell(row, columnIndex, 'unitOfMeasure', ['salesUnit', 'unit', 'unitType', 'unidadVenta', 'unidad', 'unidad_de_venta'])
        )

        const salePriceRaw = this.getCell(row, columnIndex, 'salePrice', ['price', 'precioVenta', 'precioventa', 'precio_venta'])
        const stockRaw = this.getCell(row, columnIndex, 'stock')
        const taxRateRaw = this.getCell(row, columnIndex, 'taxRate', ['tax'])
        const costPriceRaw = this.getCell(row, columnIndex, 'costPrice', ['cost', 'costPerItem', 'precioCosto', 'preciocosto', 'precio_costo'])
        const bulkRaw = this.getCell(row, columnIndex, 'bulkDiscountPrice', ['bulkprice'])
        const permanentRaw = this.getCell(row, columnIndex, 'permanentStock', ['permanent'])
        const publishedRaw = this.getCell(row, columnIndex, 'published')
        const createdAtRaw = this.getCell(row, columnIndex, 'createdAt')

        const salePrice = salePriceRaw === '' ? undefined : this.parseNumber(salePriceRaw)
        const stock = stockRaw === '' ? undefined : this.parseNumber(stockRaw)
        const taxRate = taxRateRaw === '' ? undefined : this.parseNumber(taxRateRaw)
        const costPrice = costPriceRaw === '' ? undefined : this.parseNumber(costPriceRaw)
        const bulkDiscountPrice = bulkRaw === '' ? undefined : this.parseNumber(bulkRaw)
        const permanentStock = this.parseOptionalBoolean(permanentRaw)
        const published = this.parseOptionalBoolean(publishedRaw)
        const createdAt = this.parseDate(createdAtRaw)
        const unitOfMeasure = this.parseSalesUnit(unitRaw)

        const resolvedCostPrice =
          costPrice !== undefined
            ? roundCurrency(costPrice)
            : salePrice !== undefined
              ? costPriceFromSale(salePrice)
              : 0
        const resolvedSalePrice =
          salePrice !== undefined
            ? roundCurrency(salePrice)
            : salePriceFromCost(resolvedCostPrice)

        let product =
          id && id > 0
            ? await this.prisma.product.findUnique({ where: { id } })
            : null
        if (!product && productCode) {
          product = await this.prisma.product.findFirst({
            where: { productCode: productCode },
          })
        }

        const categoryId = await this.resolveCategoryId(categoryName, categoryCache)

        if (!product) {
          const fallbackTax = taxRate ?? (await this.getTaxRate())
          const normalizedStock = stock ?? 0
          const normalizedPermanent = permanentStock ?? false
          const status = this.deriveInventoryStatus(normalizedStock, normalizedPermanent)
          const createData: Prisma.ProductCreateInput = {
            name,
            productCode: productCode ?? undefined,
            description: description ?? undefined,
            img: img ?? undefined,
            salePrice: resolvedSalePrice,
            costPrice: resolvedCostPrice,
            currency: (currency ?? 'UYU').toUpperCase(),
            unitOfMeasure: unitOfMeasure ?? SalesUnit.UNIT,
            stock: Math.round(normalizedStock),
            permanentStock: normalizedPermanent,
            status,
            costPerItem: resolvedCostPrice,
            bulkDiscountPrice: bulkDiscountPrice ?? undefined,
            taxRate: fallbackTax,
            tags: tags ?? [],
            brand: brand ?? undefined,
            vendor: vendor ?? undefined,
            published: published ?? false,
          }
          if (categoryId) {
            createData.category = { connect: { id: categoryId } }
          }
          if (createdAt && !Number.isNaN(createdAt.getTime())) {
            createData.createdAt = createdAt
          }
          await this.prisma.product.create({ data: createData })
          created += 1
        } else {
          const updateData: Prisma.ProductUpdateInput = {
            name,
          }
          if (productCode !== undefined) updateData.productCode = productCode
          if (description !== undefined) updateData.description = description
          if (img !== undefined) updateData.img = img
          if (currency) updateData.currency = currency
          if (salePrice !== undefined) {
            updateData.salePrice = resolvedSalePrice
          }
          if (costPrice !== undefined) {
            updateData.costPrice = resolvedCostPrice
            updateData.costPerItem = resolvedCostPrice
          }
          if (stock !== undefined) updateData.stock = Math.round(stock)
          if (permanentStock !== undefined) updateData.permanentStock = permanentStock
          if (bulkDiscountPrice !== undefined) updateData.bulkDiscountPrice = bulkDiscountPrice
          if (taxRate !== undefined) updateData.taxRate = taxRate
          if (tags !== undefined) updateData.tags = tags
          if (brand !== undefined) updateData.brand = brand
          if (vendor !== undefined) updateData.vendor = vendor
          if (published !== undefined) updateData.published = published
          if (unitOfMeasure !== undefined) updateData.unitOfMeasure = unitOfMeasure
          if (categoryId) {
            updateData.category = { connect: { id: categoryId } }
          }
          const nextStock =
            stock !== undefined ? stock : product.stock ?? 0
          const nextPermanent =
            permanentStock !== undefined ? permanentStock : product.permanentStock ?? false
          updateData.status = this.deriveInventoryStatus(Number(nextStock), Boolean(nextPermanent))
          await this.prisma.product.update({
            where: { id: product.id },
            data: updateData,
          })
          updated += 1
        }
      } catch (error) {
        let message = 'Unknown import error'
        if (error instanceof BadRequestException) {
          const response = error.getResponse() as any
          message = response?.message || error.message
        } else if (error instanceof Error) {
          message = error.message
        }
        errors.push({ row: lineNumber, message })
      }
    }

    return {
      success: errors.length === 0,
      imported: created + updated,
      created,
      updated,
      failed: errors.length,
      errors,
    }
  }

  @Get('product')
  async getProduct(@Query('id') id: string) {
    const nId = Number(id)
    const data = await this.prisma.product.findUnique({
      where: { id: nId },
      include: { images: true, category: true },
    })
    if (!data) return null
    return {
      ...data,
      salePrice: decimalToNumber(data.salePrice),
      costPrice: decimalToNumber(data.costPrice),
    }
  }

  @Post('products/create')
  async createProduct(@Body() dto: UpsertProductDto) {
    const tags = (dto.tags || []).map((t: any) => (typeof t === 'string' ? t : t.value))
    const taxRate = await this.getTaxRate()
    const permanentStock = dto.permanentStock ?? false
    const status = this.deriveInventoryStatus(dto.stock, permanentStock)
    await this.prisma.product.create({
      data: {
        name: dto.name,
        productCode: dto.productCode,
        img: dto.img,
        description: dto.description,
        specifications: dto.specifications?.trim?.() ? dto.specifications.trim() : null,
        categoryId: dto.categoryId,
        salePrice: roundCurrency(dto.salePrice),
        costPrice: roundCurrency(dto.costPrice),
        currency: (dto.currency || 'UYU').toUpperCase(),
        unitOfMeasure: dto.unitOfMeasure ?? SalesUnit.UNIT,
        stock: dto.stock,
        permanentStock,
        status,
        costPerItem: dto.costPerItem ?? roundCurrency(dto.costPrice),
        bulkDiscountPrice: dto.bulkDiscountPrice,
        taxRate,
        tags,
        brand: dto.brand,
        vendor: dto.vendor,
        published: dto.published ?? false,
        images: dto.imgList && dto.imgList.length ? {
          create: dto.imgList.map((im, idx) => ({ name: im.name, img: im.img, sortOrder: idx }))
        } : undefined,
      },
    })
    return true
  }

  @Put('products/update')
  async updateProduct(@Body() dto: UpdateProductDto) {
    if (!dto.id) return false
    const tags =
      // only update tags if provided, otherwise leave unchanged
      (dto as any).tags === undefined
        ? undefined
        : ((dto.tags || []).map((t: any) => (typeof t === 'string' ? t : t.value)))
    const taxRate = await this.getTaxRate()
    const normalizedSalePrice = dto.salePrice === undefined ? undefined : roundCurrency(dto.salePrice)
    const normalizedCostPrice = dto.costPrice === undefined ? undefined : roundCurrency(dto.costPrice)
    const updateData: any = {
      name: dto.name,
      productCode: dto.productCode,
      img: dto.img,
      description: dto.description,
      specifications:
        dto.specifications === undefined
          ? undefined
          : dto.specifications?.trim?.()
          ? dto.specifications.trim()
          : null,
      salePrice: normalizedSalePrice,
      costPrice: normalizedCostPrice,
      stock: dto.stock,
      costPerItem:
        dto.costPerItem === undefined ? normalizedCostPrice : roundCurrency(dto.costPerItem),
      bulkDiscountPrice: dto.bulkDiscountPrice,
      taxRate,
      tags,
      brand: dto.brand,
      vendor: dto.vendor,
      permanentStock: dto.permanentStock === undefined ? undefined : dto.permanentStock,
      currency:
        dto.currency === undefined
          ? undefined
          : (dto.currency || 'UYU').toUpperCase(),
      unitOfMeasure:
        dto.unitOfMeasure === undefined ? undefined : dto.unitOfMeasure,
      // only update published if provided
      published: dto.published === undefined ? undefined : dto.published,
    }
    const existing = await this.prisma.product.findUnique({
      where: { id: dto.id },
      select: { stock: true, permanentStock: true },
    })
    if (!existing) {
      throw new BadRequestException('Product not found')
    }
    const nextStock = dto.stock !== undefined ? dto.stock : existing.stock
    const nextPermanent =
      dto.permanentStock !== undefined ? dto.permanentStock : existing.permanentStock
    updateData.status = this.deriveInventoryStatus(nextStock, nextPermanent)
    if (dto.categoryId !== undefined) {
      updateData.categoryId = dto.categoryId
    }
    if (dto.imgList) {
      updateData.images = {
        deleteMany: {},
        create: dto.imgList.map((im: any, idx: number) => ({ name: im.name, img: im.img, sortOrder: idx })),
      }
      if (!dto.img && dto.imgList.length > 0) {
        updateData.img = dto.imgList[0].img
      }
    }
    await this.prisma.product.update({
      where: { id: dto.id },
      data: updateData,
    })
    return true
  }

  @Delete('products/delete')
  async deleteProducts(@Body() body: { id: string | string[] }) {
    const ids = Array.isArray(body.id) ? body.id : [body.id]
    const numIds = ids.map((x) => Number(x)).filter(Boolean)
    await this.prisma.product.deleteMany({ where: { id: { in: numIds } } })
    return true
  }
}

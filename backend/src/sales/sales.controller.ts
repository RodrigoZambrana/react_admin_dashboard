import {
  Body,
  BadRequestException,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { UpsertProductDto, UpdateProductDto, TableQueryDto as ProductQuery } from './dto/product.dto'
import { CreateOrderDto } from './dto/order.dto'
import { DashboardFilterDto } from './dto/dashboard.dto'

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
      include: { items: true },
    })
    const revenue = orders.reduce((s, o) => s + (o.grandTotal || 0), 0)
    const purchases = orders.reduce(
      (s, o) => s + o.items.reduce((ss, it) => ss + (it.price || 0) * (it.qty || 0), 0),
      0,
    )

    // Report categories and series based on selected range
    const categories: number[] = []
    const purchasesSeries: number[] = []

    const purchasesByDay = new Map<string, number>()
    const purchasesByMonth = new Map<string, number>()
    const hourlyPurchases = Array.from({ length: 24 }, () => 0)
    for (const order of orders) {
      const orderDateObj = new Date(order.date)
      const date = this.startOfDay(orderDateObj)
      const key = this.dayKey(date)
      const orderPurchases = order.items.reduce(
        (sum, item) => sum + (item.price || 0) * (item.qty || 0),
        0,
      )
      const currentPurchases = purchasesByDay.get(key) ?? 0
      purchasesByDay.set(key, currentPurchases + orderPurchases)
      const monthKey = `${orderDateObj.getFullYear()}-${orderDateObj.getMonth()}`
      purchasesByMonth.set(monthKey, (purchasesByMonth.get(monthKey) ?? 0) + orderPurchases)
      const hour = orderDateObj.getHours()
      if (hour >= 0 && hour < 24) {
        hourlyPurchases[hour] += orderPurchases
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
        purchasesSeries.push(
          Math.round((hourlyPurchases[hour] + Number.EPSILON) * 100) / 100,
        )
      }
    } else if (granularity === 'month') {
      const year = rangeStart?.getFullYear() ?? new Date().getFullYear()
      for (let month = 0; month < 12; month++) {
        const bucketTime = new Date(year, month, 1)
        const monthKey = `${year}-${month}`
        categories.push(Math.floor(bucketTime.getTime() / 1000))
        purchasesSeries.push(
          Math.round(((purchasesByMonth.get(monthKey) ?? 0) + Number.EPSILON) * 100) /
            100,
        )
      }
    } else {
      for (let ts = rangeStart.getTime(); ts <= rangeEnd.getTime(); ts += dayMs) {
        const current = new Date(ts)
        current.setHours(0, 0, 0, 0)
        const key = this.dayKey(current)
        const bucketPurchases = purchasesByDay.get(key) ?? 0
        categories.push(Math.floor(current.getTime() / 1000))
        purchasesSeries.push(
          Math.round((bucketPurchases + Number.EPSILON) * 100) / 100,
        )
      }
    }

    // Top products by sold qty
    const products = await this.prisma.product.findMany()
    const qtyByProduct = new Map<number, number>()
    for (const o of orders) {
      for (const it of o.items) {
        if (it.productId) {
          qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) || 0) + (it.qty || 0))
        }
      }
    }
    const topProducts = products
      .map((p) => ({ id: String(p.id), name: p.name, img: p.img || '', sold: qtyByProduct.get(p.id) || 0 }))
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
      .map((c) => ({
        label: c.name,
        value: c.products.reduce(
          (sum, p) => sum + (qtyByProduct.get(p.id) || 0),
          0,
        ),
      }))
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value)
    const categoryLabels = categorySummary.map((item) => item.label)
    const categoryTotals = categorySummary.map((item) => item.value)

    return {
      statisticData: {
        revenue: { value: Math.round(revenue * 100) / 100, growShrink: 0 },
        orders: { value: orders.length, growShrink: 0 },
        purchases: { value: Math.round(purchases * 100) / 100, growShrink: 0 },
      },
      salesReportData: {
        series: [
          { name: 'Purchases', data: purchasesSeries },
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
    const where = dto.query
      ? ({ name: { contains: dto.query, mode: 'insensitive' as any } } as any)
      : ({} as any)
    const total = await this.prisma.product.count({ where })
    const pageIndex = Number(dto.pageIndex || 1)
    const pageSize = Number(dto.pageSize || 50)

    const sortKey = (dto.sort?.key || '').toString()
    const sortOrderRaw = (dto.sort?.order || '').toString().toLowerCase()
    const sortOrder: 'asc' | 'desc' | undefined =
      sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? (sortOrderRaw as 'asc' | 'desc') : undefined

    const orderBy: Prisma.ProductOrderByWithRelationInput[] = []
    if (sortKey && sortOrder) {
      switch (sortKey) {
        case 'name':
          orderBy.push({ name: sortOrder })
          break
        case 'productCode':
          orderBy.push({ productCode: sortOrder })
          break
        case 'brand':
          orderBy.push({ brand: sortOrder })
          break
        case 'vendor':
          orderBy.push({ vendor: sortOrder })
          break
        case 'price':
          orderBy.push({ price: sortOrder })
          break
        case 'stock':
          orderBy.push({ stock: sortOrder })
          break
        case 'status':
          orderBy.push({ status: sortOrder })
          break
        case 'published':
          orderBy.push({ published: sortOrder })
          break
        case 'category':
          orderBy.push({ category: { name: sortOrder } })
          break
        default:
          orderBy.push({ id: sortOrder })
          break
      }
    }
    orderBy.push({ id: 'desc' })

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
        price: true,
        currency: true,
        stock: true,
        permanentStock: true,
        status: true,
        published: true,
        tags: true,
        brand: true,
        vendor: true,
        category: { select: { name: true } },
      },
    })
    const data = rows.map((p) => ({
      id: String(p.id),
      name: p.name,
      productCode: p.productCode || '',
      img: p.img || '',
      category: (p as any).category?.name || '',
      price: p.price,
      currency: p.currency,
      stock: p.stock,
      permanentStock: p.permanentStock,
      status: this.deriveInventoryStatus(p.stock, p.permanentStock),
      published: p.published,
      tags: (p as any).tags || [],
      brand: p.brand || '',
      vendor: p.vendor || '',
    }))
    return { data, total }
  }

  @Get('product')
  async getProduct(@Query('id') id: string) {
    const nId = Number(id)
    const data = await this.prisma.product.findUnique({
      where: { id: nId },
      include: { images: true, category: true },
    })
    return data
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
        categoryId: dto.categoryId,
        price: dto.price,
        currency: (dto.currency || 'UYU').toUpperCase(),
        stock: dto.stock,
        permanentStock,
        status,
        costPerItem: dto.costPerItem,
        bulkDiscountPrice: dto.bulkDiscountPrice,
        taxRate,
        tags,
        brand: dto.brand,
        vendor: dto.vendor,
        published: dto.published ?? true,
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
    const updateData: any = {
      name: dto.name,
      productCode: dto.productCode,
      img: dto.img,
      description: dto.description,
      price: dto.price,
      stock: dto.stock,
      costPerItem: dto.costPerItem,
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

  // Orders
  @Get('orders')
  async listOrders(@Query() q: any) {
    const pageIndex = Number(q.pageIndex || 1)
    const pageSize = Number(q.pageSize || 50)
    const total = await this.prisma.order.count()

    // --- Helpers de normalización ---
    const resolveParam = (v: unknown): string => {
      if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : ''
      return typeof v === 'string' || typeof v === 'number' ? String(v) : ''
    }

    const parseSortObject = (raw: unknown): Record<string, unknown> | undefined => {
      if (!raw) return undefined
      if (typeof raw === 'object') return raw as Record<string, unknown>
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw)
          return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined
        } catch { return undefined }
      }
      return undefined
    }

    const normalizeOrder = (val: string): 'asc' | 'desc' | undefined => {
      const v = val?.toLowerCase?.() || ''
      if (v === 'asc' || v === 'ascending' || v === 'ascend') return 'asc'
      if (v === 'desc' || v === 'descending' || v === 'descend') return 'desc'
      return undefined
    }

    type SortKey =
      | 'id'
      | 'date'
      | 'customer'
      | 'status'       // ordena por status.name
      | 'statusId'     // ordena por statusId numérico
      | 'paymentMehod' // (typo adrede) ordena por paymentMethod.name
      | 'totalAmount'

    const normalizeKey = (k: string): SortKey | undefined => {
      const key = k?.toString?.().trim()
      if (!key) return undefined
      if (['id','date','customer','status','statusId','paymentMehod','totalAmount'].includes(key)) {
        return key as SortKey
      }
      return undefined
    }

    // --- Lectura flexible de sort ---
    let sortObj: Record<string, unknown> | undefined = parseSortObject(q.sort)
    if (!sortObj) {
      // Nested: sort[key], sort[order]
      const nk = q['sort[key]'] ?? q['sort.key']
      const no = q['sort[order]'] ?? q['sort.order']
      if (nk || no) sortObj = { key: nk, order: no }
    }
    if (!sortObj) {
      // Flat: sortKey, sortOrder
      if (q.sortKey || q.sortOrder) sortObj = { key: q.sortKey, order: q.sortOrder }
    }

    const sortKeyRaw = resolveParam(sortObj?.['key'])
    const sortOrderRaw = resolveParam(sortObj?.['order'])
    const sortKey = normalizeKey(sortKeyRaw)
    const sortOrder = normalizeOrder(sortOrderRaw)

    // --- Construcción de orderBy ---
    const orderBy: Prisma.OrderOrderByWithRelationInput[] = []

    if (sortKey && sortOrder) {
      switch (sortKey) {
        case 'id':
          orderBy.push({ id: sortOrder })
          break
        case 'date':
          orderBy.push({ date: sortOrder })
          break
        case 'customer':
          orderBy.push({ customer: { name: sortOrder } })
          break
        case 'status':
          // por nombre de estado (relación)
          orderBy.push({ status: { name: sortOrder } })
          break
        case 'statusId':
          // orden numérico directo por id de estado
          orderBy.push({ statusId: sortOrder })
          break
        case 'paymentMehod':
          // typo intencional para matchear con el front
          orderBy.push({ paymentMethod: { name: sortOrder } })
          break
        case 'totalAmount':
          orderBy.push({ grandTotal: sortOrder })
          break
      }
    }
    // Estabilidad secundaria
    const isSortingById = sortKey === 'id' && !!sortOrder
    if (!orderBy.length) {
      orderBy.push({ id: 'desc' })
    } else if (!isSortingById) {
      orderBy.push({ id: 'desc' })
    }

    const orderListInclude = {
      customer: true,
      paymentMethod: true,
      status: true,
    } satisfies Prisma.OrderInclude

    type OrderWithRelations = Prisma.OrderGetPayload<{
      include: typeof orderListInclude
    }>

    const orders = await this.prisma.order.findMany({
      orderBy,
      skip: (pageIndex - 1) * pageSize,
      take: pageSize,
      include: orderListInclude,
    })

    // Default status: Completed (code = 3)
    const defaultStatus = await this.prisma.orderStatus.findUnique({ where: { code: 3 } })

    const data = orders.map((o: OrderWithRelations) => ({
      id: String(o.id),
      date: Math.floor(new Date(o.date).getTime() / 1000),
      customer: o.customer?.name || '',
      status: (o.statusId ?? defaultStatus?.id) || 0,
      paymentMehod: o.paymentMethod?.name || '',
      paymentIdendifier: '',
      totalAmount: o.grandTotal,
    }))
    return { data, total }
  }

  @Delete('orders/delete')
  async deleteOrders(@Body() body: { id: string | string[] }) {
    const ids = Array.isArray(body.id) ? body.id : [body.id]
    const numIds = ids.map((x) => Number(x)).filter(Boolean)
    if (!numIds.length) return false
    // Delete child records first to satisfy FK constraints
    await this.prisma.orderItem.deleteMany({ where: { orderId: { in: numIds } } })
    await this.prisma.order.deleteMany({ where: { id: { in: numIds } } })
    return true
  }

  @Get('orders-details')
  async orderDetails(@Query('id') id: string) {
    return this.getOrder(id)
  }

  @Get('order')
  async getOrder(@Query('id') id: string) {
    const o = await this.prisma.order.findUnique({
      where: { id: Number(id) },
      include: { items: true, customer: true, paymentMethod: true },
    })
    return o
  }

  @Post('orders/create')
  async createOrder(@Body() dto: CreateOrderDto) {
    const customerId = Number(dto.customerId)
    if (!customerId) throw new BadRequestException('sales.orders.validation.customerRequired')
    const items = dto.items || []
    if (!Array.isArray(items) || items.length === 0) throw new BadRequestException('sales.orders.validation.itemsRequired')
    const subTotal = items.reduce((s, it) => s + (it.price || 0) * (it.qty || 0), 0)
    const delivery = Number(dto.shipping?.deliveryFees || 0)
    const taxRate = await this.getTaxRate()
    const tax = Math.round(subTotal * (taxRate / (100 + taxRate)) * 100) / 100
    const grandTotal = Math.round((subTotal + delivery) * 100) / 100

    // Resolve payment method if provided
    let paymentMethodId: number | undefined = undefined
    let pmName = String((dto as any).paymentMehod ?? '').trim()
    if (!pmName) pmName = 'Cash'
    if (pmName.toLowerCase() === 'cash') pmName = 'Cash'
    const maybeNum = Number(pmName)
    if (!Number.isNaN(maybeNum) && pmName === String(maybeNum)) {
      const found = await this.prisma.paymentMethod.findUnique({ where: { id: maybeNum } })
      if (found) paymentMethodId = found.id
    }
    if (!paymentMethodId) {
      const pm = await this.prisma.paymentMethod.upsert({ where: { name: pmName }, update: {}, create: { name: pmName } })
      paymentMethodId = pm.id
    }

    const createItems = items
      .map((it) => ({
        productId: Number(it.productId) || undefined,
        name: (it as any)?.name,
        price: Number((it as any)?.price || 0),
        qty: Number((it as any)?.qty || 0),
        img: (it as any)?.img,
        description: (it as any)?.description,
      }))
      .filter((it) => Boolean(it.name) && (Boolean(it.productId) || it.productId === undefined) && it.qty > 0)

    if (createItems.length === 0) {
      throw new BadRequestException('Order items are invalid or empty')
    }

    // Default status Completed (code = 3)
    const completedStatus = await this.prisma.orderStatus.findUnique({ where: { code: 3 } })

    const composeAddress = (addr?: any) => {
      if (!addr) return undefined
      const line1 = addr.addressLine1 || `${addr.street || ''} ${addr.number || ''}${addr.apartment ? ' Apt ' + addr.apartment : ''}`.trim()
      const line2 = addr.addressLine2 || (addr.corner ? `Corner: ${addr.corner}` : '')
      return line1 && addr.city && addr.state
        ? { addressLine1: line1, addressLine2: line2, city: addr.city, state: addr.state }
        : undefined
    }

    // Default shipping address from customer primary address if not provided
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
        deliveryFees: delivery,
        estimatedMin: dto.shipping?.estimatedMin,
        estimatedMax: dto.shipping?.estimatedMax,
        comment: dto.comment,
        subTotal,
        tax,
        grandTotal,
        items: { create: createItems },
      },
    })
    return true
  }

  @Put('orders/save')
  async saveOrder(@Body() body: any) {
    const id = Number(body.id)
    if (!id) return false
    await this.prisma.order.update({
      where: { id },
      data: {
        comment: body.comment,
      },
    })
    return true
  }

  @Put('orders/update')
  async updateOrderStatus(@Body() body: { id: string; status: number }) {
    const id = Number(body.id)
    await this.prisma.order.update({ where: { id }, data: { statusId: body.status } })
    return true
  }

  @Put('orders/update-method')
  async updateOrderPaymentMethod(@Body() body: { id: string; paymentMehod?: string | number | null }) {
    const id = Number(body.id)
    if (!id) return false
    const raw = body.paymentMehod
    // Allow clearing the payment method
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
      pm = await this.prisma.paymentMethod.upsert({
        where: { name },
        update: {},
        create: { name },
      })
    }
    await this.prisma.order.update({ where: { id }, data: { paymentMethodId: pm.id } })
    return true
  }
}
import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { UpsertProductDto, UpdateProductDto, TableQueryDto as ProductQuery } from './dto/product.dto'
import { CreateOrderDto } from './dto/order.dto'

@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private prisma: PrismaService) {}

  private async getTaxRate() {
    const cfg = await this.prisma.systemConfig.findUnique({ where: { key: 'taxRate' } })
    const val = Number(cfg?.value ?? '22')
    return Number.isNaN(val) ? 22 : val
  }

  @Post('dashboard')
  async dashboard() {
    // Revenue and orders
    const orders = await this.prisma.order.findMany({ include: { items: true } })
    const revenue = orders.reduce((s, o) => s + (o.grandTotal || 0), 0)
    const purchases = orders.reduce(
      (s, o) => s + o.items.reduce((ss, it) => ss + (it.price || 0) * (it.qty || 0), 0),
      0,
    )

    // Report categories (last 12 weeks)
    const categories: string[] = []
    const revenueSeries: number[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i * 7)
      categories.push(`${d.getMonth() + 1}/${d.getDate()}`)
      revenueSeries.push(Math.round((revenue / 12) * (0.6 + Math.random())))
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
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 6)

    // Latest orders short list
    const latest = await this.prisma.order.findMany({ orderBy: { id: 'desc' }, include: { customer: true, paymentMethod: true }, take: 8 })
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
    const categoryLabels = cats.map((c) => c.name)
    const categoryTotals = cats.map((c) => c.products.reduce((s, p) => s + (p.price || 0) * (qtyByProduct.get(p.id) || 0), 0))

    return {
      statisticData: {
        revenue: { value: Math.round(revenue * 100) / 100, growShrink: 0 },
        orders: { value: orders.length, growShrink: 0 },
        purchases: { value: Math.round(purchases * 100) / 100, growShrink: 0 },
      },
      salesReportData: {
        series: [{ name: 'Revenue', data: revenueSeries }],
        categories,
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
    const pageSize = Number(dto.pageSize || 10)

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
        stock: true,
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
      stock: p.stock,
      status: p.status,
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
    await this.prisma.product.create({
      data: {
        name: dto.name,
        productCode: dto.productCode,
        img: dto.img,
        description: dto.description,
        categoryId: dto.categoryId,
        price: dto.price,
        stock: dto.stock,
        status: dto.status,
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
      status: dto.status,
      costPerItem: dto.costPerItem,
      bulkDiscountPrice: dto.bulkDiscountPrice,
      taxRate,
      tags,
      brand: dto.brand,
      vendor: dto.vendor,
      // only update published if provided
      published: dto.published === undefined ? undefined : dto.published,
    }
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
    const pageSize = Number(q.pageSize || 10)
    const total = await this.prisma.order.count()
    const sortKey = (q.sort?.key || '').toString()
    const sortOrderRaw = (q.sort?.order || '').toString().toLowerCase()
    const sortOrder: 'asc' | 'desc' | undefined =
      sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? (sortOrderRaw as 'asc' | 'desc') : undefined

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
          orderBy.push({ status: { name: sortOrder } })
          break
        case 'paymentMehod':
          orderBy.push({ paymentMethod: { name: sortOrder } })
          break
        case 'totalAmount':
          orderBy.push({ grandTotal: sortOrder })
          break
      }
    }
    orderBy.push({ id: 'desc' })

    // Default status: Completed (code = 3)
    const defaultStatus = await this.prisma.orderStatus.findUnique({ where: { code: 3 } })
    const orderListInclude = {
      customer: true,
      paymentMethod: true,
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

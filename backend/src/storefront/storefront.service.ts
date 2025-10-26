import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common'
import { Prisma, DocumentType, Customer } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt'
import { PrismaService } from '../prisma/prisma.service'
import { decimal, decimalToNumber } from '../common/currency/money.util'
import { DEFAULT_STOREFRONT_CONFIG } from './defaults/config'
import { DEFAULT_HOME_LAYOUTS, FALLBACK_LAYOUT_KEY } from './defaults/layouts'
import { buildCategorySlug, buildProductSlug, slugify } from './utils'
import type {
  HomeLayoutDefinition,
  HomeModuleConfig,
  InventoryStatus,
  MoneyDto,
  ProductDetailDto,
  ProductSummaryDto,
  StorefrontConfig,
} from './types'
import { StorefrontProductQueryDto } from './dto/product-query.dto'
import { StorefrontRegisterDto, StorefrontLoginDto, StorefrontRefreshDto } from './dto/auth.dto'
import { StorefrontCreateOrderDto } from './dto/order.dto'

const ACCESS_TOKEN_EXPIRES_IN = '15m'
const REFRESH_TOKEN_EXPIRES_IN = '7d'

const INVENTORY_STATUS: Record<number, 'in-stock' | 'limited' | 'out-of-stock'> = {
  0: 'in-stock',
  1: 'limited',
  2: 'out-of-stock',
}

const parsePositiveInt = (value?: string | number | null, fallback = 1): number => {
  if (value === undefined || value === null) return fallback
  const parsed = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (Number.isNaN(parsed) || parsed <= 0) return fallback
  return parsed
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase()

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

const money = (amount: number, currency = 'USD'): MoneyDto => ({ amount, currency })

@Injectable()
export class StorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

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
    const layouts = Array.isArray(merged.layouts) && merged.layouts.length > 0 ? merged.layouts : DEFAULT_HOME_LAYOUTS
    const defaultLayout = layouts.some((layout) => layout.key === merged.defaultLayout) ? merged.defaultLayout : FALLBACK_LAYOUT_KEY
    return {
      ...merged,
      layouts,
      defaultLayout,
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

  async listCategories() {
    const categories = await this.prisma.productCategory.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    })
    return categories.map((category) => ({
      id: category.id,
      slug: buildCategorySlug(category.id, category.name),
      name: category.name,
      description: null,
      productCount: category._count.products,
    }))
  }

  async listProducts(query: StorefrontProductQueryDto) {
    const page = parsePositiveInt(query.page, 1)
    const pageSize = Math.min(parsePositiveInt(query.pageSize, 12), 48)
    const where: Prisma.ProductWhereInput = { published: true }

    if (query.category) {
      const normalized = query.category.toLowerCase()
      where.category = {
        OR: [
          { name: { equals: normalized, mode: 'insensitive' } },
          { name: { equals: query.category, mode: 'insensitive' } },
        ],
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
          images: { orderBy: { sortOrder: 'asc' } },
          category: true,
        },
      }),
    ])

    const data = products.map((product) => this.toProductSummary(product))
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
    const byId = parsePositiveInt(identifier, -1)
    const product = await this.prisma.product.findFirst({
      where: {
        AND: [
          { published: true },
          {
            OR: [
              byId > 0 ? { id: byId } : undefined,
              { productCode: { equals: identifier, mode: 'insensitive' } },
            ].filter(Boolean) as Prisma.ProductWhereInput[],
          },
        ],
      },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        category: true,
      },
    })

    if (!product) {
      throw new NotFoundException('Product not found')
    }

    const detail = this.toProductDetail(product)

    const related = await this.prisma.product.findMany({
      where: {
        published: true,
        id: { not: product.id },
        categoryId: product.categoryId ?? undefined,
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        category: true,
      },
    })

    detail.relatedProducts = related.map((item) => this.toProductSummary(item))
    return detail
  }

  async getRecommendations(productId: number, limit = 8): Promise<ProductSummaryDto[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
      },
    })
    if (!product) {
      throw new NotFoundException('Product not found')
    }

    const items = await this.prisma.product.findMany({
      where: {
        published: true,
        id: { not: product.id },
        categoryId: product.categoryId ?? undefined,
      },
      take: limit,
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        category: true,
      },
    })
    return items.map((item) => this.toProductSummary(item))
  }

  async registerCustomer(dto: StorefrontRegisterDto) {
    const email = normalizeEmail(dto.email)
    const existing = await this.prisma.customer.findUnique({ where: { email } })
    if (existing?.passwordHash) {
      throw new ConflictException('Customer already exists')
    }

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const customer = existing
      ? await this.prisma.customer.update({
          where: { id: existing.id },
          data: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            name: `${dto.firstName} ${dto.lastName}`.trim(),
            passwordHash,
          },
        })
      : await this.prisma.customer.create({
          data: {
            email,
            firstName: dto.firstName,
            lastName: dto.lastName,
            name: `${dto.firstName} ${dto.lastName}`.trim(),
            passwordHash,
          },
        })

    return this.buildSession(customer)
  }

  async login(dto: StorefrontLoginDto) {
    const email = normalizeEmail(dto.email)
    const customer = await this.prisma.customer.findUnique({ where: { email } })
    if (!customer?.passwordHash) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const valid = await bcrypt.compare(dto.password, customer.passwordHash)
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { updatedAt: new Date() },
    })

    return this.buildSession(customer)
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
      return this.buildSession(customer)
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token')
    }
  }

  async createOrder(dto: StorefrontCreateOrderDto) {
    const email = normalizeEmail(dto.customer.email)
    let customer = await this.prisma.customer.findUnique({ where: { email } })
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          email,
          firstName: dto.customer.firstName,
          lastName: dto.customer.lastName,
          name: `${dto.customer.firstName} ${dto.customer.lastName}`.trim(),
          phones: dto.customer.phone
            ? {
                create: [{ phone: dto.customer.phone }],
              }
            : undefined,
        },
      })
    }

    const productIds = dto.items.map((item) => item.productId)
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, published: true },
    })
    if (products.length !== dto.items.length) {
      throw new BadRequestException('One or more products are unavailable')
    }

    const items = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!
      const unitPrice = decimal(product.salePrice)
      return {
        product,
        quantity: item.quantity,
        unitPrice,
      }
    })

    const currency = products[0]?.currency ?? 'USD'
    const subtotalDecimal = items.reduce((sum, item) => sum.plus(item.unitPrice.times(item.quantity)), decimal(0))
    const taxRate = decimal(products[0]?.taxRate ?? 22).dividedBy(100)
    const taxDecimal = subtotalDecimal.times(taxRate)
    const grandTotalDecimal = subtotalDecimal.plus(taxDecimal)

    const order = await this.prisma.order.create({
      data: {
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
        subTotal: subtotalDecimal,
        tax: taxDecimal,
        grandTotal: grandTotalDecimal,
        orderCurrency: currency,
        comment: dto.notes,
        items: {
          create: items.map((item) => ({
            product: { connect: { id: item.product.id } },
            name: item.product.name,
            qty: item.quantity,
            price: item.unitPrice,
            unitCurrency: currency,
            unitAmount: item.unitPrice,
            unitPriceSnapshot: item.unitPrice,
            skuSnapshot: item.product.productCode ?? undefined,
            nameSnapshot: item.product.name,
          })),
        },
      },
      include: {
        items: true,
      },
    })

    return {
      id: order.id,
      orderNumber: `ORD-${order.id}`,
      placedAt: order.createdAt.toISOString(),
      status: 'pending',
      paymentStatus: 'pending',
      fulfillmentStatus: 'pending',
      items: order.items.map((item) => ({
        productId: item.productId!,
        quantity: item.qty,
        price: money(decimalToNumber(item.unitAmount ?? item.price), currency),
        total: money(decimalToNumber(item.price.times(item.qty)), currency),
      })),
      summary: {
        items: order.items.map((item) => ({
          productId: item.productId!,
          quantity: item.qty,
          price: money(decimalToNumber(item.unitAmount ?? item.price), currency),
          total: money(decimalToNumber(item.price.times(item.qty)), currency),
        })),
        subtotal: money(decimalToNumber(subtotalDecimal), currency),
        tax: money(decimalToNumber(taxDecimal), currency),
        shipping: money(0, currency),
        grandTotal: money(decimalToNumber(grandTotalDecimal), currency),
      },
      shippingAddress: dto.shippingAddress,
      billingAddress: dto.billingAddress ?? dto.shippingAddress,
    }
  }

  private toProductSummary(product: Prisma.ProductGetPayload<{ include: { images: true; category: true } }>): ProductSummaryDto {
    const thumbnail = product.images?.[0]
    const price = decimalToNumber(product.salePrice)
    const salePrice = decimalToNumber(product.salePrice)
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
    }
    return summary
  }

  private toProductDetail(product: Prisma.ProductGetPayload<{ include: { images: true; category: true } }>): ProductDetailDto {
    const summary = this.toProductSummary(product)
    return {
      ...summary,
      description: product.description,
      descriptionHtml: product.description,
      specifications: product.specifications
        ? product.specifications.split('\n').map((line) => {
            const [label, ...rest] = line.split(':')
            return { label: label.trim(), value: rest.join(':').trim() }
          })
        : undefined,
      gallery: product.images.map((image) => ({
        id: image.id,
        url: image.img,
        alt: image.name,
      })),
      relatedProducts: [],
    }
  }

  private async buildSession(customer: Customer) {
    const accessPayload = {
      sub: customer.id,
      email: customer.email,
      firstName: customer.firstName ?? '',
      lastName: customer.lastName ?? '',
      scope: 'storefront' as const,
      tokenType: 'access' as const,
    }

    const refreshPayload = {
      sub: customer.id,
      scope: 'storefront' as const,
      tokenType: 'refresh' as const,
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, { expiresIn: ACCESS_TOKEN_EXPIRES_IN }),
      this.jwt.signAsync(refreshPayload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN }),
    ])

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
      },
    }
  }
}

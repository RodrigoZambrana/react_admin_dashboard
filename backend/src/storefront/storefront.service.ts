import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common'
import { Prisma, DocumentType, Customer, CustomerAddress, OrderItem, ProductType, CompanyProfile } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { decimal, decimalToNumber } from '../common/currency/money.util'
import { buildImageDataUrl, ensureNodeBuffer } from '../common/images/image.utils'
import { DEFAULT_STOREFRONT_CONFIG } from './defaults/config'
import { DEFAULT_HOME_LAYOUTS, FALLBACK_LAYOUT_KEY } from './defaults/layouts'
import { buildCategorySlug, buildProductSlug, slugify } from './utils'
import type {
  HomeLayoutDefinition,
  HomeModuleConfig,
  InventoryStatus,
  MoneyDto,
  OrderSummary,
  ProductDetailDto,
  ProductSummaryDto,
  StorefrontConfig,
  CheckoutLineItem,
  CustomerProfile,
  StorefrontCategoryTree,
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

const normalizePhone = (phone: string): string => phone.replace(/[^\d+]/g, '')

const isEmailIdentifier = (value: string): boolean => value.includes('@')

const sanitizePhoneInput = (value?: string | null): string | null => {
  if (!value) {
    return null
  }
  const normalized = normalizePhone(value)
  return normalized.length >= 6 ? normalized : null
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

const money = (amount: number, currency = 'USD'): MoneyDto => ({ amount, currency })

type OrderWithRelations = Prisma.OrderGetPayload<{
  include: {
    items: true
    status: true
    paymentMethod: true
  }
}>

type OrderIdentifierCandidate = { id: number; createdAt: Date; uuid: string | null }
type CustomerWithAddresses = Customer & { addresses: CustomerAddress[] }
type OrderSummaryWithReference = OrderSummary & { reference: string }

@Injectable()
export class StorefrontService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private defaultCustomerPassword!: string
  private defaultCustomerPasswordHash!: string
  private readonly companySingletonKey = 'default'

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

    await this.prisma.customer.updateMany({
      where: {
        passwordHash: null,
        storefrontDefaultPasswordHash: null,
      },
      data: {
        storefrontDefaultPasswordHash: this.defaultCustomerPasswordHash,
      },
    })
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

    return {
      ...merged,
      layouts,
      defaultLayout,
      companyProfile,
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

  async listProducts(query: StorefrontProductQueryDto) {
    const page = parsePositiveInt(query.page, 1)
    const pageSize = Math.min(parsePositiveInt(query.pageSize, 12), 48)
    const where: Prisma.ProductWhereInput = { published: true, productType: ProductType.PHYSICAL }

    if (query.category) {
      const trimmed = query.category.trim()
      const slugMatch = trimmed.match(/-(\d+)$/)
      if (slugMatch) {
        const categoryId = Number.parseInt(slugMatch[1], 10)
        if (Number.isFinite(categoryId) && categoryId > 0) {
          const categoryIds = await this.collectCategoryHierarchyIds(categoryId)
          if (categoryIds.length > 0) {
            where.categoryId =
              categoryIds.length === 1 ? categoryIds[0] : { in: categoryIds }
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
          { productType: ProductType.PHYSICAL },
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
        productType: ProductType.PHYSICAL,
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
        images: { orderBy: { sortOrder: 'asc' } },
        category: true,
      },
    })
    return items.map((item) => this.toProductSummary(item))
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

    return this.prisma.customer.findUnique({ where: { phoneNumber: phone } })
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

    const email = normalizeEmail(dto.email)
    const existing = await this.prisma.customer.findUnique({ where: { email } })
    if (existing?.passwordHash) {
      throw new ConflictException('Customer already exists')
    }

    const phone = sanitizePhoneInput(dto.phone)
    const passwordHash = await bcrypt.hash(dto.password, 12)
    const customer = existing
      ? await this.prisma.customer.update({
          where: { id: existing.id },
          data: {
            firstName: dto.firstName,
            lastName: dto.lastName,
            name: `${dto.firstName} ${dto.lastName}`.trim(),
            passwordHash,
            storefrontDefaultPasswordHash: null,
            ...(phone ? { phoneNumber: phone } : {}),
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
            ...(phone ? { phoneNumber: phone } : {}),
          },
        })

    return this.buildSession(customer)
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

    return this.buildSession(updated)
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
    const phone = sanitizePhoneInput(dto.customer.phone)
    await this.ensureDefaultPasswordHash()
    let customer = await this.prisma.customer.findUnique({ where: { email } })
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
        },
      })
    } else if (!customer.passwordHash && !customer.storefrontDefaultPasswordHash) {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          storefrontDefaultPasswordHash: this.defaultCustomerPasswordHash,
          ...(phone && !customer.phoneNumber ? { phoneNumber: phone } : {}),
        },
      })
    } else if (phone && !customer.phoneNumber) {
      customer = await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          phoneNumber: phone,
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
        status: true,
        paymentMethod: true,
      },
    })

    return this.toOrderSummary(order, {
      shippingAddress: dto.shippingAddress,
      billingAddress: dto.billingAddress ?? dto.shippingAddress,
    })
  }

  async getCustomerProfile(customerId: number): Promise<CustomerProfile> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { addresses: true },
    })
    if (!customer) {
      throw new NotFoundException('Customer not found')
    }
    return this.toCustomerProfile(customer)
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

    if (!nextEmail && !nextPhone) {
      throw new BadRequestException('At least one contact method is required')
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.customer.update({
        where: { id: customerId },
        data: updateData,
      })
    }

    const updated = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { addresses: true },
    })
    if (!updated) {
      throw new NotFoundException('Customer not found')
    }
    return this.toCustomerProfile(updated)
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
        status: true,
        paymentMethod: true,
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
        status: true,
        paymentMethod: true,
      },
    })

    if (!order) {
      throw new NotFoundException('Order not found')
    }

    return this.toOrderSummary(order)
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
    return {
      productId: item.productId ?? 0,
      quantity: item.qty,
      price: money(unitAmount, currency),
      total: money(totalAmount, currency),
      name: item.nameSnapshot ?? item.name,
      image: item.img ?? undefined,
    }
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

    const status = order.status?.name ?? 'pending'

    return {
      id: order.id,
      uuid: order.uuid,
      orderNumber: this.buildOrderNumber(order.id),
      reference: this.buildOrderReference(order),
      placedAt: order.createdAt.toISOString(),
      status,
      paymentStatus: 'pending',
      fulfillmentStatus: status,
      items,
      summary: {
        items,
        subtotal: money(subtotal, currency),
        tax: money(tax, currency),
        shipping: money(shipping, currency),
        discounts: [],
        grandTotal: money(grandTotal, currency),
      },
      shippingAddress,
      billingAddress,
    }
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

  private toCustomerProfile(customer: CustomerWithAddresses): CustomerProfile {
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
      addresses,
    }
  }

  private async resolveCustomerOrderId(customerId: number, identifier: string): Promise<number> {
    const normalized = identifier.trim()
    if (!normalized) {
      throw new NotFoundException('Order not found')
    }

    const normalizedLower = normalized.toLowerCase()

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized)) {
      const byUuid = await this.prisma.order.findFirst({
        where: {
          customerId,
          documentType: DocumentType.ORDER,
          uuid: { equals: normalized, mode: 'insensitive' },
        },
        select: { id: true },
      })
      if (byUuid) {
        return byUuid.id
      }
    }

    const numericCandidate = Number.parseInt(normalized.replace(/^ord[-_]?/i, ''), 10)
    if (!Number.isNaN(numericCandidate)) {
      return numericCandidate
    }

    if (/^[a-z0-9]+$/i.test(normalized)) {
      const base36Candidate = Number.parseInt(normalized, 36)
      if (!Number.isNaN(base36Candidate)) {
        return base36Candidate
      }
    }

    const orders = await this.prisma.order.findMany({
      where: {
        customerId,
        documentType: DocumentType.ORDER,
      },
      select: {
        id: true,
        createdAt: true,
        uuid: true,
      },
    })

    const match = orders.find((order) => {
      const orderUuid = order.uuid ? order.uuid.toLowerCase() : null
      return orderUuid === normalizedLower || this.buildOrderReference(order) === normalized
    })
    if (!match) {
      throw new NotFoundException('Order not found')
    }
    return match.id
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

    const [accessToken, refreshToken, addresses] = await Promise.all([
      this.jwt.signAsync(accessPayload, { expiresIn: ACCESS_TOKEN_EXPIRES_IN }),
      this.jwt.signAsync(refreshPayload, { expiresIn: REFRESH_TOKEN_EXPIRES_IN }),
      this.prisma.customerAddress.findMany({
        where: { customerId: customer.id },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      }),
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
        phone: customer.phoneNumber ?? undefined,
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

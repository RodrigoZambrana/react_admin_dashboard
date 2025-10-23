import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  UseGuards,
  Query,
  BadRequestException,
  Param,
  Request,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Prisma } from '@prisma/client'
import type { CompanyProfile } from '@prisma/client'
import { Roles, ROLES } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { CurrencyConversionService } from '../common/currency/currency-conversion.service'
import { STANDARD_CURRENCIES } from '../common/currency/currency.constants'
import {
  buildImageDataUrl,
  detectImageMimeType,
  ensureNodeBuffer,
} from '../common/images/image.utils'

type ThemeConfigPayload = {
  themeColor: string
  direction: 'ltr' | 'rtl'
  mode: 'light' | 'dark'
  primaryColorLevel: number
  panelExpand: boolean
  navMode: 'transparent' | 'light' | 'dark' | 'themed'
  cardBordered: boolean
  layout: {
    type: 'classic' | 'modern' | 'stackedSide' | 'simple' | 'decked' | 'blank'
    sideNavCollapse: boolean
  }
}
type BasicStatusConfig = { name: string; color?: string | null }
type OrderStatusConfig = BasicStatusConfig & { code?: number | null }
type NamedEntityConfig = { name: string }
type ShippingOptionConfig = {
  name: string
  deliveryFees?: number | null
  estimatedMin?: number | null
  estimatedMax?: number | null
  img?: string | null
}
type CalendarEventTypeConfig = {
  name: string
  color?: string | null
  description?: string | null
}
type ExchangeRateExport = { quote: string; rate: string; updatedAt: Date | null }
type SystemConfigExport = {
  taxRate: number
  currencies: string[]
  currencyBase: string
  exchangeRates: ExchangeRateExport[]
  themeConfig: ThemeConfigPayload
}
type SettingsExportPayload = {
  meta: { exportedAt: string; version: number }
  orderStatuses: OrderStatusConfig[]
  customerStatuses: BasicStatusConfig[]
  expenseStatuses: BasicStatusConfig[]
  expenseCategories: NamedEntityConfig[]
  productCategories: NamedEntityConfig[]
  paymentMethods: NamedEntityConfig[]
  shippingOptions: ShippingOptionConfig[]
  calendarEventTypes: CalendarEventTypeConfig[]
  systemConfig: SystemConfigExport
  companyProfile: CompanyProfileResponse
}
type SettingsImportPayload = Partial<Omit<SettingsExportPayload, 'meta'>> & {
  meta?: Partial<SettingsExportPayload['meta']>
}
type CompanyProfileResponse = {
  legalName: string
  tradeName: string
  taxId?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  logo?: string | null
}
type CompanyProfilePayload = {
  legalName?: unknown
  tradeName?: unknown
  taxId?: unknown
  email?: unknown
  phone?: unknown
  website?: unknown
  addressLine1?: unknown
  addressLine2?: unknown
  logo?: unknown
}
import type { FastifyRequest } from 'fastify'
import { parseSingleFileMultipart } from '../common/uploads/multipart'
import {
  normalizeShippingLogoPath,
  persistShippingLogo,
  deleteShippingLogo,
} from '../common/uploads/shipping'

@Controller('settings')
export class SettingsController {
  constructor(
    private prisma: PrismaService,
    private currencyConversion: CurrencyConversionService,
  ) {}

  private readonly companySingletonKey = 'default'

  private readonly defaultCalendarEventTypes = [
    { name: 'Reunión', color: '#2563eb' },
    { name: 'Tarea', color: '#059669' },
    { name: 'Taller', color: '#7c3aed' },
    { name: 'Otro', color: '#6b7280' },
  ]

  private readonly defaultOrderStatuses: OrderStatusConfig[] = [
    { code: 0, name: 'Pagado', color: 'emerald-500' },
    { code: 1, name: 'Pendiente', color: 'amber-500' },
    { code: 2, name: 'Cancelado', color: 'red-500' },
  ]

  private readonly defaultThemeConfig: ThemeConfigPayload = {
    themeColor: 'indigo',
    direction: 'ltr',
    mode: 'light',
    primaryColorLevel: 600,
    panelExpand: false,
    navMode: 'light',
    cardBordered: true,
    layout: {
      type: 'modern',
      sideNavCollapse: false,
    },
  }

  private readonly defaultCompanyProfile: CompanyProfileResponse = {
    legalName: 'Sistema Administrativo, Inc.',
    tradeName: 'Sistema Administrativo',
    taxId: 'RUC 1234567890',
    email: 'facturacion@sistemadministrativo.com',
    phone: '(123) 456-7890',
    website: 'www.sistemadministrativo.com',
    addressLine1: '9498 Harvard Street',
    addressLine2: 'Fairfield, Chicago Town 06824',
    logo: null,
  }

  private readonly maxLogoSizeBytes = 512 * 1024

  private toPrismaBytes(bytes: Buffer | Uint8Array): Uint8Array<ArrayBuffer>
  private toPrismaBytes(bytes: Buffer | Uint8Array | null): Uint8Array<ArrayBuffer> | null
  private toPrismaBytes(
    bytes: Buffer | Uint8Array | undefined,
  ): Uint8Array<ArrayBuffer> | undefined
  private toPrismaBytes(
    bytes: Buffer | Uint8Array | null | undefined,
  ): Uint8Array<ArrayBuffer> | null | undefined
  private toPrismaBytes(
    bytes: Buffer | Uint8Array | null | undefined,
  ): Uint8Array<ArrayBuffer> | null | undefined {
    if (bytes === undefined || bytes === null) {
      return bytes
    }
    if (Buffer.isBuffer(bytes)) {
      return Uint8Array.from(bytes) as Uint8Array<ArrayBuffer>
    }
    return bytes as Uint8Array<ArrayBuffer>
  }

  private mapCompanyProfile(record?: CompanyProfile | null): CompanyProfileResponse {
    if (!record) {
      return { ...this.defaultCompanyProfile }
    }
    const logoBuffer = ensureNodeBuffer(record.logo)
    return {
      legalName: record.legalName,
      tradeName: record.tradeName,
      taxId: record.taxId ?? null,
      email: record.email ?? null,
      phone: record.phone ?? null,
      website: record.website ?? null,
      addressLine1: record.addressLine1 ?? null,
      addressLine2: record.addressLine2 ?? null,
      logo: logoBuffer ? buildImageDataUrl(logoBuffer) : null,
    }
  }

  private buildCompanyProfileData(body: CompanyProfilePayload) {
    const legalName = this.sanitizeName(body.legalName)
    if (!legalName) {
      throw new BadRequestException('settings.companyProfile.legalNameRequired')
    }
    const tradeName = this.sanitizeName(body.tradeName)
    if (!tradeName) {
      throw new BadRequestException('settings.companyProfile.tradeNameRequired')
    }

    const optional = (value: unknown) => this.sanitizeName(value)

    return {
      legalName,
      tradeName,
      taxId: optional(body.taxId),
      email: optional(body.email),
      phone: optional(body.phone),
      website: optional(body.website),
      addressLine1: optional(body.addressLine1),
      addressLine2: optional(body.addressLine2),
    }
  }

  private parseLogoInput(value: unknown): Uint8Array<ArrayBuffer> | null | undefined {
    if (value === undefined) {
      return undefined
    }
    if (value === null) {
      return null
    }
    if (typeof value !== 'string') {
      throw new BadRequestException('settings.companyProfile.logoInvalid')
    }
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    let base64Payload = trimmed
    if (trimmed.startsWith('data:')) {
      const match = trimmed.match(/^data:([^;]+);base64,(.+)$/)
      if (!match) {
        throw new BadRequestException('settings.companyProfile.logoInvalid')
      }
      base64Payload = match[2]
    }

    let buffer: Buffer
    try {
      buffer = Buffer.from(base64Payload, 'base64')
    } catch {
      throw new BadRequestException('settings.companyProfile.logoInvalid')
    }

    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('settings.companyProfile.logoInvalid')
    }

    if (buffer.length > this.maxLogoSizeBytes) {
      throw new BadRequestException('settings.companyProfile.logoTooLarge')
    }

    const mimeType = detectImageMimeType(buffer)
    if (!mimeType) {
      throw new BadRequestException('settings.companyProfile.logoUnsupported')
    }

    return this.toPrismaBytes(buffer)
  }

  private sanitizeThemeConfig(payload: Partial<ThemeConfigPayload>): ThemeConfigPayload {
    const allowedDirections: ThemeConfigPayload['direction'][] = ['ltr', 'rtl']
    const allowedModes: ThemeConfigPayload['mode'][] = ['light', 'dark']
    const allowedNavModes: ThemeConfigPayload['navMode'][] = [
      'transparent',
      'light',
      'dark',
      'themed',
    ]
    const allowedLayouts: ThemeConfigPayload['layout']['type'][] = [
      'classic',
      'modern',
      'stackedSide',
      'simple',
      'decked',
      'blank',
    ]
    const allowedColorLevels = [400, 500, 600, 700, 800, 900]

    const next: ThemeConfigPayload = {
      ...this.defaultThemeConfig,
      ...payload,
      layout: {
        ...this.defaultThemeConfig.layout,
        ...(payload.layout ?? {}),
      },
    }

    const trimmedColor = String(payload.themeColor ?? next.themeColor).trim()
    next.themeColor = trimmedColor || this.defaultThemeConfig.themeColor

    if (!allowedDirections.includes(next.direction)) {
      next.direction = this.defaultThemeConfig.direction
    }

    if (!allowedModes.includes(next.mode)) {
      next.mode = this.defaultThemeConfig.mode
    }

    if (!allowedNavModes.includes(next.navMode)) {
      next.navMode = this.defaultThemeConfig.navMode
    }

    const requestedLevel = Number(payload.primaryColorLevel ?? next.primaryColorLevel)
    next.primaryColorLevel = allowedColorLevels.includes(requestedLevel)
      ? (requestedLevel as ThemeConfigPayload['primaryColorLevel'])
      : this.defaultThemeConfig.primaryColorLevel

    if (!allowedLayouts.includes(next.layout.type)) {
      next.layout.type = this.defaultThemeConfig.layout.type
    }

    if (payload.panelExpand !== undefined) {
      next.panelExpand = Boolean(payload.panelExpand)
    }

    if (payload.cardBordered !== undefined) {
      next.cardBordered = Boolean(payload.cardBordered)
    }

    if (payload.layout?.sideNavCollapse !== undefined) {
      next.layout.sideNavCollapse = Boolean(payload.layout.sideNavCollapse)
    }

    return next
  }

  private parseNumber(value: unknown, fallback: number) {
    if (value === null || value === undefined || value === '') {
      return fallback
    }
    const num = Number(value)
    return Number.isFinite(num) ? num : fallback
  }

  private parseInteger(value: unknown, fallback: number) {
    const num = this.parseNumber(value, fallback)
    return Math.round(num)
  }

  private normalizeColor(value?: string | null) {
    if (!value) {
      return '#2563eb'
    }
    const trimmed = value.trim()
    const hexPattern = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
    if (hexPattern.test(trimmed)) {
      return trimmed.length === 4
        ? '#' + trimmed.substring(1).split('').map((c) => c + c).join('').toLowerCase()
        : trimmed.toLowerCase()
    }
    return trimmed
  }

  private normalizeOptionalColor(value: unknown) {
    if (value === null || value === undefined) {
      return null
    }
    const trimmed = String(value).trim()
    if (!trimmed) {
      return null
    }
    return this.normalizeColor(trimmed)
  }

  private sanitizeName(value: unknown) {
    const name = String(value ?? '').trim()
    return name.length ? name : null
  }

  private parseOptionalNumber(value: unknown) {
    if (value === null || value === undefined || value === '') {
      return null
    }
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }

  private parseOptionalInteger(value: unknown) {
    const num = this.parseOptionalNumber(value)
    return num === null ? null : Math.round(num)
  }

  private async ensureCalendarEventTypesSeeded() {
    const count = await this.prisma.calendarEventType.count()
    if (count === 0) {
      await this.prisma.calendarEventType.createMany({
        data: this.defaultCalendarEventTypes.map((item) => ({
          name: item.name,
          color: this.normalizeColor(item.color),
        })),
        skipDuplicates: true,
      })
    }
  }

  private async ensureOrderStatusesSeeded() {
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.orderStatus.count()
      if (existing > 0) {
        return
      }
      await tx.orderStatus.createMany({
        data: this.defaultOrderStatuses.map((status, index) => ({
          name: status.name,
          color: this.normalizeOptionalColor(status.color),
          code:
            status.code !== undefined && status.code !== null
              ? this.parseInteger(status.code, index)
              : index,
        })),
        skipDuplicates: true,
      })
    })
  }

  @Get('company-profile')
  @UseGuards(JwtAuthGuard)
  async getCompanyProfile() {
    const profile = await this.prisma.companyProfile.findUnique({
      where: { singleton: this.companySingletonKey },
    })
    return this.mapCompanyProfile(profile)
  }

  @Put('company-profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updateCompanyProfile(@Body() body: CompanyProfilePayload) {
    const data = this.buildCompanyProfileData(body)
    const logoBuffer = this.parseLogoInput(body.logo)
    const prismaLogo = this.toPrismaBytes(logoBuffer)
    const updateData: Prisma.CompanyProfileUpdateInput = {
      ...data,
      ...(logoBuffer !== undefined ? { logo: prismaLogo } : {}),
    }
    const createData: Prisma.CompanyProfileCreateInput = {
      singleton: this.companySingletonKey,
      ...data,
      ...(logoBuffer !== undefined ? { logo: prismaLogo } : {}),
    }
    const updated = await this.prisma.companyProfile.upsert({
      where: { singleton: this.companySingletonKey },
      update: updateData,
      create: createData,
    })
    return this.mapCompanyProfile(updated)
  }

  // Order Statuses
  @Get('order-statuses')
  @UseGuards(JwtAuthGuard)
  async getOrderStatuses() {
    await this.ensureOrderStatusesSeeded()
    return this.prisma.orderStatus.findMany({ orderBy: { id: 'asc' } })
  }
  @Post('order-statuses/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async createOrderStatus(@Body() body: { id?: number; name: string; color?: string }) {
    const nextCode = (await this.prisma.orderStatus.count())
    await this.prisma.orderStatus.create({ data: { name: body.name, code: nextCode, color: body.color } })
    return true
  }
  @Put('order-statuses/update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updateOrderStatus(@Body() body: { id: number; name?: string; color?: string }) {
    await this.prisma.orderStatus.update({ where: { id: body.id }, data: { name: body.name, color: body.color } })
    return true
  }
  @Delete('order-statuses/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async deleteOrderStatus(@Body() body: { id: number }) {
    await this.prisma.orderStatus.delete({ where: { id: body.id } })
    return true
  }

  // Customer Statuses
  @Get('customer-statuses')
  @UseGuards(JwtAuthGuard)
  getCustomerStatuses() {
    return this.prisma.customerStatus.findMany({ orderBy: { id: 'asc' } })
  }
  @Post('customer-statuses/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async createCustomerStatus(@Body() body: { id?: number; name: string; color?: string }) {
    await this.prisma.customerStatus.create({ data: { name: body.name, color: body.color } })
    return true
  }
  @Put('customer-statuses/update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updateCustomerStatus(@Body() body: { id: number | string; name?: string; color?: string }) {
    const id = Number(body.id)
    if (!Number.isFinite(id)) {
      throw new BadRequestException('Invalid status id')
    }
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      data.name = body.name
    }
    if (body.color !== undefined) {
      data.color = body.color
    }
    try {
      await this.prisma.customerStatus.update({ where: { id }, data })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new BadRequestException('Customer status not found')
      }
      throw error
    }
    return true
  }
  @Delete('customer-statuses/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async deleteCustomerStatus(@Body() body: { id: number }) {
    await this.prisma.customerStatus.delete({ where: { id: body.id } })
    return true
  }

  // Expense Statuses
  @Get('expense-statuses')
  @UseGuards(JwtAuthGuard)
  getExpenseStatuses() {
    return this.prisma.expenseStatus.findMany({ orderBy: { id: 'asc' } })
  }
  @Post('expense-statuses/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async createExpenseStatus(@Body() body: { id?: number; name: string; color?: string }) {
    await this.prisma.expenseStatus.create({ data: { name: body.name, color: body.color } })
    return true
  }
  @Put('expense-statuses/update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updateExpenseStatus(@Body() body: { id: number; name?: string; color?: string }) {
    await this.prisma.expenseStatus.update({ where: { id: body.id }, data: { name: body.name, color: body.color } })
    return true
  }
  @Delete('expense-statuses/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async deleteExpenseStatus(@Body() body: { id: number }) {
    await this.prisma.expenseStatus.delete({ where: { id: body.id } })
    return true
  }

  // Product Categories
  @Get('product-categories')
  @UseGuards(JwtAuthGuard)
  getProductCategories() {
    return this.prisma.productCategory.findMany({ orderBy: { id: 'asc' } })
  }
  @Post('product-categories/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async createProductCategory(@Body() body: { name: string }) {
    await this.prisma.productCategory.create({ data: { name: body.name } })
    return true
  }
  @Put('product-categories/update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updateProductCategory(@Body() body: { id: number; name?: string }) {
    await this.prisma.productCategory.update({ where: { id: body.id }, data: { name: body.name } })
    return true
  }
  @Delete('product-categories/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async deleteProductCategory(@Body() body: { id: number }) {
    await this.prisma.productCategory.delete({ where: { id: body.id } })
    return true
  }

  // Payment Methods
  @Get('payment-methods')
  @UseGuards(JwtAuthGuard)
  getPaymentMethods() {
    return this.prisma.paymentMethod.findMany({ orderBy: { id: 'asc' } })
  }
  @Post('payment-methods/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async createPaymentMethod(@Body() body: { name: string }) {
    await this.prisma.paymentMethod.create({ data: { name: body.name } })
    return true
  }
  @Put('payment-methods/update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updatePaymentMethod(@Body() body: { id: number; name?: string }) {
    await this.prisma.paymentMethod.update({ where: { id: body.id }, data: { name: body.name } })
    return true
  }
  @Delete('payment-methods/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async deletePaymentMethod(@Body() body: { id: number }) {
    await this.prisma.paymentMethod.delete({ where: { id: body.id } })
    return true
  }

  // Shipping Options
  @Get('shipping-options')
  @UseGuards(JwtAuthGuard)
  getShippingOptions() {
    return this.prisma.shippingOption.findMany({ orderBy: { id: 'asc' } })
  }

  @Post('shipping-options/create')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async createShippingOption(@Request() req: FastifyRequest) {
    const { fields, file } = await parseSingleFileMultipart(req)

    const name = String(fields.name ?? '').trim()
    if (!name) {
      throw new BadRequestException('Name is required')
    }
    const deliveryFees = this.parseNumber(fields.deliveryFees, 0)
    const estimatedMin = this.parseInteger(fields.estimatedMin, 0)
    const estimatedMax = this.parseInteger(fields.estimatedMax, estimatedMin)

    let img = normalizeShippingLogoPath(fields.img)
    if (file) {
      img = await persistShippingLogo(file)
    }

    await this.prisma.shippingOption.create({
      data: {
        name,
        deliveryFees,
        estimatedMin,
        estimatedMax,
        img: img ?? undefined,
      },
    })
    return true
  }

  @Put('shipping-options/update')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updateShippingOption(@Request() req: FastifyRequest) {
    const { fields, file } = await parseSingleFileMultipart(req)

    const id = Number(fields.id)
    if (!Number.isFinite(id)) {
      throw new BadRequestException('Invalid shipping option id')
    }

    const existing = await this.prisma.shippingOption.findUnique({
      where: { id },
      select: { img: true, estimatedMin: true },
    })

    if (!existing) {
      throw new BadRequestException('Invalid shipping option id')
    }

    const data: Prisma.ShippingOptionUpdateInput = {}

    if (fields.name !== undefined) {
      const name = String(fields.name ?? '').trim()
      if (!name) {
        throw new BadRequestException('Name is required')
      }
      data.name = name
    }

    if (fields.deliveryFees !== undefined) {
      data.deliveryFees = this.parseNumber(fields.deliveryFees, 0)
    }

    let estimatedMinUpdate: number | undefined

    if (fields.estimatedMin !== undefined) {
      estimatedMinUpdate = this.parseInteger(fields.estimatedMin, 0)
      data.estimatedMin = estimatedMinUpdate
    }

    if (fields.estimatedMax !== undefined) {
      const fallback =
        typeof estimatedMinUpdate === 'number'
          ? estimatedMinUpdate
          : existing.estimatedMin ?? 0
      data.estimatedMax = this.parseInteger(fields.estimatedMax, fallback)
    }

    if (file) {
      data.img = await persistShippingLogo(file, existing.img)
    } else if (fields.img !== undefined) {
      data.img = normalizeShippingLogoPath(fields.img) ?? null
    }

    await this.prisma.shippingOption.update({ where: { id }, data })
    return true
  }

  @Delete('shipping-options/delete')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async deleteShippingOption(@Body() body: { id: number | string }) {
    const id = Number(body.id)
    if (!Number.isFinite(id)) {
      throw new BadRequestException('Invalid shipping option id')
    }
    const existing = await this.prisma.shippingOption.findUnique({
      where: { id },
      select: { img: true },
    })
    if (!existing) {
      throw new BadRequestException('Invalid shipping option id')
    }
    await this.prisma.shippingOption.delete({ where: { id } })
    await deleteShippingLogo(existing.img)
    return true
  }

  // Configuration import/export
  @Get('configurations/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async exportConfigurations(): Promise<SettingsExportPayload> {
    const [
      orderStatuses,
      customerStatuses,
      expenseStatuses,
      expenseCategories,
      productCategories,
      paymentMethods,
      shippingOptions,
      calendarEventTypes,
      systemConfigs,
      companyProfile,
    ] = await Promise.all([
      this.prisma.orderStatus.findMany({ orderBy: { code: 'asc' } }),
      this.prisma.customerStatus.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.expenseStatus.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.expenseCategory.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.productCategory.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.paymentMethod.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.shippingOption.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.calendarEventType.findMany({ orderBy: { id: 'asc' } }),
      this.prisma.systemConfig.findMany(),
      this.prisma.companyProfile.findUnique({
        where: { singleton: this.companySingletonKey },
      }),
    ])

    const systemConfigMap = new Map(systemConfigs.map((cfg) => [cfg.key, cfg.value]))

    const taxRateRaw = systemConfigMap.get('taxRate')
    const parsedTaxRate = Number(taxRateRaw ?? '22')
    const taxRate = Number.isFinite(parsedTaxRate) ? parsedTaxRate : 22

    let themeConfig = this.defaultThemeConfig
    const themeConfigRaw = systemConfigMap.get('themeConfig')
    if (themeConfigRaw) {
      try {
        const parsed = JSON.parse(themeConfigRaw)
        themeConfig = this.sanitizeThemeConfig(parsed)
      } catch {
        themeConfig = this.defaultThemeConfig
      }
    }

    let currencies = ['USD', 'UYU']
    const currenciesRaw = systemConfigMap.get('currencies')
    if (currenciesRaw) {
      try {
        const parsed = JSON.parse(currenciesRaw)
        if (Array.isArray(parsed)) {
          const normalized = parsed
            .map((item) => this.currencyConversion.normalizeCurrency(item))
            .filter((item): item is string => Boolean(item))
          if (normalized.length) {
            currencies = normalized
          }
        }
      } catch {
        // keep defaults
      }
    }

    const currencyBase = await this.currencyConversion.getBaseCurrency()
    const exchangeRateRecords = await this.currencyConversion.listRates(currencyBase)
    const exchangeRates: ExchangeRateExport[] = exchangeRateRecords.map((rate) => ({
      quote: rate.quote,
      rate: rate.rate.toString(),
      updatedAt: rate.updatedAt ?? null,
    }))
    exchangeRates.unshift({ quote: currencyBase, rate: '1', updatedAt: null })

    return {
      meta: { exportedAt: new Date().toISOString(), version: 1 },
      orderStatuses: orderStatuses.map(({ name, color, code }) => ({
        name,
        color,
        code,
      })),
      customerStatuses: customerStatuses.map(({ name, color }) => ({
        name,
        color,
      })),
      expenseStatuses: expenseStatuses.map(({ name, color }) => ({
        name,
        color,
      })),
      expenseCategories: expenseCategories.map(({ name }) => ({ name })),
      productCategories: productCategories.map(({ name }) => ({ name })),
      paymentMethods: paymentMethods.map(({ name }) => ({ name })),
      shippingOptions: shippingOptions.map(
        ({ name, deliveryFees, estimatedMin, estimatedMax, img }) => ({
          name,
          deliveryFees,
          estimatedMin,
          estimatedMax,
          img,
        }),
      ),
      calendarEventTypes: calendarEventTypes.map(({ name, color, description }) => ({
        name,
        color,
        description,
      })),
      systemConfig: {
        taxRate,
        currencies,
        currencyBase,
        exchangeRates,
        themeConfig,
      },
      companyProfile: this.mapCompanyProfile(companyProfile),
    }
  }

  @Post('configurations/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async importConfigurations(@Body() payload: SettingsImportPayload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new BadRequestException('Invalid payload')
    }

    const readArray = (value: unknown, field: string): unknown[] => {
      if (value === null || value === undefined) {
        return []
      }
      if (!Array.isArray(value)) {
        throw new BadRequestException(`${field} must be an array`)
      }
      return value
    }

    const collectNamedItems = <T>(
      source: unknown[],
      builder: (raw: Record<string, unknown>, name: string) => T | null,
    ): T[] => {
      const map = new Map<string, T>()
      for (const entry of source) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          continue
        }
        const raw = entry as Record<string, unknown>
        const name = this.sanitizeName(raw['name'])
        if (!name || map.has(name)) {
          continue
        }
        const result = builder(raw, name)
        if (result) {
          map.set(name, result)
        }
      }
      return Array.from(map.values())
    }

    const hasOrderStatuses = Object.prototype.hasOwnProperty.call(payload, 'orderStatuses')
    const hasCustomerStatuses = Object.prototype.hasOwnProperty.call(payload, 'customerStatuses')
    const hasExpenseStatuses = Object.prototype.hasOwnProperty.call(payload, 'expenseStatuses')
    const hasExpenseCategories = Object.prototype.hasOwnProperty.call(payload, 'expenseCategories')
    const hasProductCategories = Object.prototype.hasOwnProperty.call(payload, 'productCategories')
    const hasPaymentMethods = Object.prototype.hasOwnProperty.call(payload, 'paymentMethods')
    const hasShippingOptions = Object.prototype.hasOwnProperty.call(payload, 'shippingOptions')
    const hasCalendarEventTypes = Object.prototype.hasOwnProperty.call(
      payload,
      'calendarEventTypes',
    )
    const hasSystemConfig = Object.prototype.hasOwnProperty.call(payload, 'systemConfig')
    const hasCompanyProfile = Object.prototype.hasOwnProperty.call(payload, 'companyProfile')

    if (
      hasOrderStatuses &&
      payload.orderStatuses !== undefined &&
      payload.orderStatuses !== null &&
      !Array.isArray(payload.orderStatuses)
    ) {
      throw new BadRequestException('orderStatuses must be an array')
    }

    const sanitizedOrderStatuses: { name: string; code: number; color: string | null }[] = []
    if (hasOrderStatuses) {
      const items = Array.isArray(payload.orderStatuses) ? payload.orderStatuses : []
      const usedCodes = new Set<number>()
      let nextCode = 0
      for (const entry of items) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
          continue
        }
        const raw = entry as Record<string, unknown>
        const name = this.sanitizeName(raw['name'])
        if (!name) {
          continue
        }
        let code = this.parseOptionalInteger(raw['code'])
        if (code !== null && code < 0) {
          code = null
        }
        if (code === null) {
          while (usedCodes.has(nextCode)) {
            nextCode += 1
          }
          code = nextCode
          nextCode += 1
        } else {
          while (usedCodes.has(code)) {
            code += 1
          }
          nextCode = code + 1
        }
        usedCodes.add(code)
        sanitizedOrderStatuses.push({
          name,
          code,
          color: this.normalizeOptionalColor(raw['color']),
        })
      }
    }

    const sanitizedCustomerStatuses = hasCustomerStatuses
      ? collectNamedItems(
          readArray(payload.customerStatuses as unknown, 'customerStatuses'),
          (raw, name) => ({
            name,
            color: this.normalizeOptionalColor(raw['color']),
          }),
        )
      : []

    const sanitizedExpenseStatuses = hasExpenseStatuses
      ? collectNamedItems(
          readArray(payload.expenseStatuses as unknown, 'expenseStatuses'),
          (raw, name) => ({
            name,
            color: this.normalizeOptionalColor(raw['color']),
          }),
        )
      : []

    const sanitizedExpenseCategories = hasExpenseCategories
      ? collectNamedItems(
          readArray(payload.expenseCategories as unknown, 'expenseCategories'),
          (_, name) => ({ name }),
        )
      : []

    const sanitizedProductCategories = hasProductCategories
      ? collectNamedItems(
          readArray(payload.productCategories as unknown, 'productCategories'),
          (_, name) => ({ name }),
        )
      : []

    const sanitizedPaymentMethods = hasPaymentMethods
      ? collectNamedItems(
          readArray(payload.paymentMethods as unknown, 'paymentMethods'),
          (_, name) => ({ name }),
        )
      : []

    const sanitizedShippingOptions = hasShippingOptions
      ? collectNamedItems(
          readArray(payload.shippingOptions as unknown, 'shippingOptions'),
          (raw, name) => {
            const deliveryFees = this.parseOptionalNumber(raw['deliveryFees'])
            let estimatedMin = this.parseOptionalInteger(raw['estimatedMin'])
            if (estimatedMin !== null && estimatedMin < 0) {
              estimatedMin = 0
            }
            let estimatedMax = this.parseOptionalInteger(raw['estimatedMax'])
            if (estimatedMax !== null && estimatedMin !== null && estimatedMax < estimatedMin) {
              estimatedMax = estimatedMin
            }
            if (estimatedMax === null && estimatedMin !== null) {
              estimatedMax = estimatedMin
            }
            const imgRaw = raw['img']
            let img: string | null = null
            if (imgRaw !== null && imgRaw !== undefined) {
              const trimmed = String(imgRaw).trim()
              if (trimmed) {
                img = trimmed
              }
            }
            return {
              name,
              deliveryFees,
              estimatedMin,
              estimatedMax,
              img,
            }
          },
        )
      : []

    const sanitizedCalendarEventTypes = hasCalendarEventTypes
      ? collectNamedItems(
          readArray(payload.calendarEventTypes as unknown, 'calendarEventTypes'),
          (raw, name) => {
            const color = this.normalizeOptionalColor(raw['color']) ?? '#2563eb'
            const descriptionRaw = raw['description']
            let description: string | null = null
            if (descriptionRaw !== null && descriptionRaw !== undefined) {
              const trimmed = String(descriptionRaw).trim()
              if (trimmed) {
                description = trimmed
              }
            }
            return {
              name,
              color,
              description,
            }
          },
        )
      : []

    if (hasCalendarEventTypes && sanitizedCalendarEventTypes.length === 0) {
      sanitizedCalendarEventTypes.push(
        ...this.defaultCalendarEventTypes.map((item) => ({
          name: item.name,
          color: this.normalizeColor(item.color),
          description: null,
        })),
      )
    }

    let companyProfileData: ReturnType<typeof this.buildCompanyProfileData> | null = null
    let companyProfileLogo: Uint8Array<ArrayBuffer> | null | undefined = undefined
    if (hasCompanyProfile) {
      const rawProfile = payload.companyProfile as unknown
      if (
        !rawProfile ||
        typeof rawProfile !== 'object' ||
        Array.isArray(rawProfile)
      ) {
        throw new BadRequestException('companyProfile must be an object')
      }
      companyProfileData = this.buildCompanyProfileData(
        rawProfile as CompanyProfilePayload,
      )
      companyProfileLogo = this.parseLogoInput(
        (rawProfile as CompanyProfilePayload).logo,
      )
    }

    const systemConfigUpdates: {
      taxRate?: number
      currencies?: string[]
      currencyBase?: string
      exchangeRates?: { quote: string; rate: number }[]
      themeConfig?: ThemeConfigPayload
    } = {}

    if (hasSystemConfig) {
      const rawConfig = payload.systemConfig as unknown
      if (
        rawConfig !== null &&
        (typeof rawConfig !== 'object' || Array.isArray(rawConfig))
      ) {
        throw new BadRequestException('systemConfig must be an object')
      }
      if (rawConfig && typeof rawConfig === 'object' && !Array.isArray(rawConfig)) {
        const config = rawConfig as Record<string, unknown>
        if (Object.prototype.hasOwnProperty.call(config, 'taxRate')) {
          const taxRateValue = this.parseOptionalNumber(config['taxRate'])
          if (taxRateValue === null) {
            throw new BadRequestException('taxRate must be a valid number')
          }
          systemConfigUpdates.taxRate = taxRateValue
        }
        if (Object.prototype.hasOwnProperty.call(config, 'currencies')) {
          const currenciesValue = config['currencies']
          if (!Array.isArray(currenciesValue) || !currenciesValue.length) {
            throw new BadRequestException(
              'systemConfig.currencies must be a non-empty array',
            )
          }
          const currencyArray = currenciesValue as unknown[]
          const normalizedCurrencies = currencyArray
            .map((code) => this.currencyConversion.normalizeCurrency(code))
            .filter((code): code is string => Boolean(code))
          if (!normalizedCurrencies.length) {
            throw new BadRequestException(
              'systemConfig.currencies must include at least one valid code',
            )
          }
          systemConfigUpdates.currencies = normalizedCurrencies
        }
        if (Object.prototype.hasOwnProperty.call(config, 'currencyBase')) {
          const base = this.currencyConversion.normalizeCurrency(config['currencyBase'])
          if (!base) {
            throw new BadRequestException('currencyBase must be a valid currency code')
          }
          systemConfigUpdates.currencyBase = base
        }
        if (Object.prototype.hasOwnProperty.call(config, 'exchangeRates')) {
          const ratesValue = config['exchangeRates']
          if (ratesValue !== undefined && ratesValue !== null) {
            if (!Array.isArray(ratesValue)) {
              throw new BadRequestException('exchangeRates must be an array of rate objects')
            }
            const normalizedRates = (ratesValue as unknown[])
              .map((entry) => {
                if (!entry || typeof entry !== 'object') return null
                const rateEntry = entry as { quote?: unknown; rate?: unknown }
                const quote = this.currencyConversion.normalizeCurrency(rateEntry.quote)
                const rateNumber = Number(rateEntry.rate)
                if (!quote || !Number.isFinite(rateNumber) || rateNumber <= 0) {
                  return null
                }
                return { quote, rate: rateNumber }
              })
              .filter((entry): entry is { quote: string; rate: number } => Boolean(entry))
            systemConfigUpdates.exchangeRates = normalizedRates
          }
        }
        if (Object.prototype.hasOwnProperty.call(config, 'themeConfig')) {
          const themeValue = config['themeConfig']
          if (!themeValue || typeof themeValue !== 'object' || Array.isArray(themeValue)) {
            throw new BadRequestException('themeConfig must be an object')
          }
          systemConfigUpdates.themeConfig = this.sanitizeThemeConfig(
            themeValue as Partial<ThemeConfigPayload>,
          )
        }
      }
    }

    const summary: Record<string, number> = {}
    let resolvedBaseForRates: string | undefined
    if (systemConfigUpdates.exchangeRates) {
      resolvedBaseForRates =
        systemConfigUpdates.currencyBase ?? (await this.currencyConversion.getBaseCurrency())
    }

    await this.prisma.$transaction(async (tx) => {
      if (hasOrderStatuses) {
        await tx.orderStatus.deleteMany({})
        if (sanitizedOrderStatuses.length) {
          await tx.orderStatus.createMany({
            data: sanitizedOrderStatuses.map(({ name, color, code }) => ({
              name,
              color: color ?? null,
              code,
            })),
          })
        }
        summary.orderStatuses = sanitizedOrderStatuses.length
      }

      if (hasCustomerStatuses) {
        await tx.customerStatus.deleteMany({})
        if (sanitizedCustomerStatuses.length) {
          await tx.customerStatus.createMany({
            data: sanitizedCustomerStatuses.map(({ name, color }) => ({
              name,
              color: color ?? null,
            })),
          })
        }
        summary.customerStatuses = sanitizedCustomerStatuses.length
      }

      if (hasExpenseStatuses) {
        await tx.expenseStatus.deleteMany({})
        if (sanitizedExpenseStatuses.length) {
          await tx.expenseStatus.createMany({
            data: sanitizedExpenseStatuses.map(({ name, color }) => ({
              name,
              color: color ?? null,
            })),
          })
        }
        summary.expenseStatuses = sanitizedExpenseStatuses.length
      }

      if (hasExpenseCategories) {
        await tx.expenseCategory.deleteMany({})
        if (sanitizedExpenseCategories.length) {
          await tx.expenseCategory.createMany({
            data: sanitizedExpenseCategories.map(({ name }) => ({ name })),
          })
        }
        summary.expenseCategories = sanitizedExpenseCategories.length
      }

      if (hasProductCategories) {
        await tx.productCategory.deleteMany({})
        if (sanitizedProductCategories.length) {
          await tx.productCategory.createMany({
            data: sanitizedProductCategories.map(({ name }) => ({ name })),
          })
        }
        summary.productCategories = sanitizedProductCategories.length
      }

      if (hasPaymentMethods) {
        await tx.paymentMethod.deleteMany({})
        if (sanitizedPaymentMethods.length) {
          await tx.paymentMethod.createMany({
            data: sanitizedPaymentMethods.map(({ name }) => ({ name })),
          })
        }
        summary.paymentMethods = sanitizedPaymentMethods.length
      }

      if (hasShippingOptions) {
        await tx.shippingOption.deleteMany({})
        if (sanitizedShippingOptions.length) {
          await tx.shippingOption.createMany({
            data: sanitizedShippingOptions.map(
              ({ name, deliveryFees, estimatedMin, estimatedMax, img }) => ({
                name,
                deliveryFees,
                estimatedMin,
                estimatedMax,
                img,
              }),
            ),
          })
        }
        summary.shippingOptions = sanitizedShippingOptions.length
      }

      if (hasCalendarEventTypes) {
        await tx.calendarEventType.deleteMany({})
        if (sanitizedCalendarEventTypes.length) {
          await tx.calendarEventType.createMany({
            data: sanitizedCalendarEventTypes.map(({ name, color, description }) => ({
              name,
              color,
              description: description ?? null,
            })),
          })
        }
        summary.calendarEventTypes = sanitizedCalendarEventTypes.length
      }

      if (hasCompanyProfile && companyProfileData) {
        const prismaLogo = this.toPrismaBytes(companyProfileLogo)
        const updateCompanyProfileData: Prisma.CompanyProfileUpdateInput = {
          ...companyProfileData,
          ...(companyProfileLogo !== undefined ? { logo: prismaLogo } : {}),
        }
        const createCompanyProfileData: Prisma.CompanyProfileCreateInput = {
          singleton: this.companySingletonKey,
          ...companyProfileData,
          ...(companyProfileLogo !== undefined ? { logo: prismaLogo } : {}),
        }
        await tx.companyProfile.upsert({
          where: { singleton: this.companySingletonKey },
          update: updateCompanyProfileData,
          create: createCompanyProfileData,
        })
        summary.companyProfile = 1
      }

      if (hasSystemConfig) {
        if (systemConfigUpdates.taxRate !== undefined) {
          await tx.systemConfig.upsert({
            where: { key: 'taxRate' },
            update: { value: String(systemConfigUpdates.taxRate) },
            create: { key: 'taxRate', value: String(systemConfigUpdates.taxRate) },
          })
          summary.taxRate = 1
        }
        if (systemConfigUpdates.currencies) {
          await this.currencyConversion.setEnabledCurrencies(systemConfigUpdates.currencies, tx)
          summary.currencies = systemConfigUpdates.currencies.length
        }
        let currentBase = resolvedBaseForRates
        if (systemConfigUpdates.currencyBase) {
          currentBase = await this.currencyConversion.setBaseCurrency(systemConfigUpdates.currencyBase, tx)
          summary.currencyBase = 1
        }
        if (systemConfigUpdates.exchangeRates && currentBase) {
          await this.currencyConversion.replaceRates(currentBase, systemConfigUpdates.exchangeRates, tx)
          summary.exchangeRates = systemConfigUpdates.exchangeRates.length
        }
        if (systemConfigUpdates.themeConfig) {
          await tx.systemConfig.upsert({
            where: { key: 'themeConfig' },
            update: { value: JSON.stringify(systemConfigUpdates.themeConfig) },
            create: {
              key: 'themeConfig',
              value: JSON.stringify(systemConfigUpdates.themeConfig),
            },
          })
          summary.themeConfig = 1
        }
      }
    })

    return { success: true, summary }
  }

  // System Config
  @Get('system-config')
  @UseGuards(JwtAuthGuard)
  async getSystemConfig() {
    const cfg = await this.prisma.systemConfig.findMany()
    const map = new Map(cfg.map((c) => [c.key, c.value]))
    const taxRate = Number(map.get('taxRate') ?? '22')
    const baseCurrency = await this.currencyConversion.getBaseCurrency()
    const exchangeRates = await this.currencyConversion.listRates(baseCurrency)
    const ratesPayload: { quote: string; rate: number; updatedAt: Date | null }[] = exchangeRates.map((rate) => ({
      quote: rate.quote,
      rate: Number(rate.rate.toString()),
      updatedAt: rate.updatedAt ?? null,
    }))
    ratesPayload.unshift({ quote: baseCurrency, rate: 1, updatedAt: null })

    return {
      taxRate: Number.isNaN(taxRate) ? 22 : taxRate,
      currencies: await this.currencyConversion.getEnabledCurrencies(),
      currencyBase: baseCurrency,
      exchangeRates: ratesPayload,
      currencyOptions: this.currencyConversion.getStandardCurrencies(),
    }
  }

  @Put('system-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updateSystemConfig(
    @Body() body: { taxRate?: number; currencyBase?: string; currencies?: string[] },
  ) {
    if (body.currencies) {
      const normalized = body.currencies
        .map((code) => this.currencyConversion.normalizeCurrency(code))
        .filter((code): code is string => Boolean(code))
      if (!normalized.length) {
        throw new BadRequestException('At least one valid currency must be provided')
      }
      await this.currencyConversion.setEnabledCurrencies(normalized)
    }
    if (body.currencyBase) {
      const base = this.currencyConversion.normalizeCurrency(body.currencyBase)
      if (!base) {
        throw new BadRequestException('Invalid base currency')
      }
      const enabled = await this.currencyConversion.getEnabledCurrencies()
      if (!enabled.includes(base)) {
        await this.currencyConversion.setEnabledCurrencies([base, ...enabled])
      }
      await this.currencyConversion.setBaseCurrency(base)
    }
    if (body.taxRate !== undefined) {
      const value = Number(body.taxRate)
      if (!Number.isNaN(value)) {
        await this.prisma.systemConfig.upsert({
          where: { key: 'taxRate' },
          update: { value: String(value) },
          create: { key: 'taxRate', value: String(value) },
        })
      }
    }
    return true
  }

  @Get('theme-config')
  @UseGuards(JwtAuthGuard)
  async getThemeConfig() {
    const record = await this.prisma.systemConfig.findUnique({ where: { key: 'themeConfig' } })
    if (!record) {
      return this.defaultThemeConfig
    }

    try {
      const parsed = JSON.parse(record.value)
      return this.sanitizeThemeConfig(parsed)
    } catch (error) {
      return this.defaultThemeConfig
    }
  }

  @Put('theme-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updateThemeConfig(@Body() body: Partial<ThemeConfigPayload>) {
    const sanitized = this.sanitizeThemeConfig(body)

    await this.prisma.systemConfig.upsert({
      where: { key: 'themeConfig' },
      update: { value: JSON.stringify(sanitized) },
      create: { key: 'themeConfig', value: JSON.stringify(sanitized) },
    })

    return sanitized
  }

  @Get('system-config/currencies')
  @UseGuards(JwtAuthGuard)
  async getCurrencies() {
    return this.currencyConversion.getEnabledCurrencies()
  }

  @Get('system-config/currencies/options')
  @UseGuards(JwtAuthGuard)
  async getCurrencyOptions() {
    return STANDARD_CURRENCIES
  }

  @Get('system-config/exchange-rates')
  @UseGuards(JwtAuthGuard)
  async getExchangeRates() {
    const baseCurrency = await this.currencyConversion.getBaseCurrency()
    const rates = await this.currencyConversion.listRates(baseCurrency)
    return {
      baseCurrency,
      rates: rates.map((rate) => ({
        quote: rate.quote,
        rate: Number(rate.rate.toString()),
        updatedAt: rate.updatedAt,
      })),
    }
  }

  @Put('system-config/exchange-rates')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updateExchangeRates(
    @Body()
    body: {
      baseCurrency?: string
      rates?: Array<{ quote: string; rate: number }>
    },
  ) {
    let baseCurrency = await this.currencyConversion.getBaseCurrency()
    if (body.baseCurrency) {
      baseCurrency = await this.currencyConversion.setBaseCurrency(body.baseCurrency)
    }
    let updatedRates = await this.currencyConversion.listRates(baseCurrency)
    if (Array.isArray(body.rates)) {
      updatedRates = await this.currencyConversion.replaceRates(baseCurrency, body.rates)
    }
    return {
      baseCurrency,
      rates: updatedRates.map((rate) => ({
        quote: rate.quote,
        rate: Number(rate.rate.toString()),
        updatedAt: rate.updatedAt,
      })),
    }
  }

  @Post('system-config/currencies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async createCurrency(@Body() body: { code: string }) {
    const code = this.currencyConversion.normalizeCurrency(body.code)
    if (!code) {
      throw new BadRequestException('Invalid currency code')
    }
    const current = await this.currencyConversion.getEnabledCurrencies()
    if (current.includes(code)) {
      throw new BadRequestException('Currency already exists')
    }
    return this.currencyConversion.setEnabledCurrencies([...current, code])
  }

  @Put('system-config/currencies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updateCurrency(@Body() body: { current: string; next: string }) {
    const currentCode = this.currencyConversion.normalizeCurrency(body.current)
    const nextCode = this.currencyConversion.normalizeCurrency(body.next)
    if (!currentCode || !nextCode) {
      throw new BadRequestException('Invalid currency code')
    }
    const list = await this.currencyConversion.getEnabledCurrencies()
    if (!list.includes(currentCode)) {
      throw new BadRequestException('Currency not found')
    }
    if (currentCode === nextCode) {
      return list
    }
    if (list.includes(nextCode)) {
      throw new BadRequestException('Currency already exists')
    }
    const updated = list.map((item) => (item === currentCode ? nextCode : item))
    return this.currencyConversion.setEnabledCurrencies(updated)
  }

  @Delete('system-config/currencies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async deleteCurrency(@Body() body: { code: string }) {
    const code = this.currencyConversion.normalizeCurrency(body.code)
    if (!code) {
      throw new BadRequestException('Invalid currency code')
    }
    const list = await this.currencyConversion.getEnabledCurrencies()
    if (!list.includes(code)) {
      throw new BadRequestException('Currency not found')
    }
    const updated = list.filter((item) => item !== code)
    if (!updated.length) {
      throw new BadRequestException('At least one currency must remain')
    }
    return this.currencyConversion.setEnabledCurrencies(updated)
  }

  @Get('calendar-event-types')
  @UseGuards(JwtAuthGuard)
  async getCalendarEventTypes() {
    await this.ensureCalendarEventTypesSeeded()
    return this.prisma.calendarEventType.findMany({ orderBy: { id: 'asc' } })
  }

  @Post('calendar-event-types')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async createCalendarEventType(
    @Body() body: { name: string; color?: string; description?: string },
  ) {
    const name = (body.name || '').trim()
    if (!name) {
      throw new BadRequestException('Event type name is required')
    }
    const color = this.normalizeColor(body.color)
    const created = await this.prisma.calendarEventType.create({
      data: {
        name,
        color,
        description: body.description?.trim() || null,
      },
    })
    return created
  }

  @Put('calendar-event-types/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updateCalendarEventType(
    @Param('id') id: string,
    @Body() body: { name?: string; color?: string; description?: string },
  ) {
    const eventTypeId = Number(id)
    if (!Number.isFinite(eventTypeId)) {
      throw new BadRequestException('Invalid event type id')
    }
    const data: Record<string, unknown> = {}
    if (body.name !== undefined) {
      const name = body.name.trim()
      if (!name) {
        throw new BadRequestException('Event type name cannot be empty')
      }
      data.name = name
    }
    if (body.color !== undefined) {
      data.color = this.normalizeColor(body.color)
    }
    if (body.description !== undefined) {
      const desc = body.description.trim()
      data.description = desc ? desc : null
    }
    if (Object.keys(data).length === 0) {
      return this.prisma.calendarEventType.findUnique({ where: { id: eventTypeId } })
    }
    try {
      return await this.prisma.calendarEventType.update({
        where: { id: eventTypeId },
        data,
      })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new BadRequestException('Event type not found')
      }
      throw error
    }
  }

  @Delete('calendar-event-types/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async deleteCalendarEventType(@Param('id') id: string) {
    const eventTypeId = Number(id)
    if (!Number.isFinite(eventTypeId)) {
      throw new BadRequestException('Invalid event type id')
    }
    const remaining = await this.prisma.calendarEventType.count()
    if (remaining <= 1) {
      throw new BadRequestException('At least one event type must remain')
    }
    try {
      await this.prisma.calendarEventType.delete({ where: { id: eventTypeId } })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new BadRequestException('Event type not found')
      }
      throw error
    }
    return true
  }

  // Countries and Cities (simple demo lists)
  @Get('countries')
  countries() {
    return [
      { code: 'US', name: 'United States' },
      { code: 'CA', name: 'Canada' },
      { code: 'MX', name: 'Mexico' },
      { code: 'UY', name: 'Uruguay' },
      { code: 'AR', name: 'Argentina' },
      { code: 'ES', name: 'Spain' },
      { code: 'JP', name: 'Japan' },
    ]
  }

  @Get('cities')
  cities(@Query('country') country?: string) {
    const all = {
      US: ['New York', 'Los Angeles', 'Chicago', 'Houston'],
      CA: ['Toronto', 'Vancouver', 'Montreal'],
      MX: ['Ciudad de México', 'Guadalajara', 'Monterrey'],
      UY: ['Montevideo', 'Salto', 'Paysandú'],
      AR: ['Buenos Aires', 'Córdoba', 'Rosario'],
      ES: ['Madrid', 'Barcelona', 'Valencia'],
      JP: ['Tokyo', 'Osaka', 'Kyoto'],
    } as Record<string, string[]>
    const key = (country || 'US').toUpperCase()
    return (all[key] || all['US']).map((name) => ({ name }))
  }
}

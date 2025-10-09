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
import { Roles, ROLES } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'

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
import type { FastifyRequest } from 'fastify'
import { parseSingleFileMultipart } from '../common/uploads/multipart'
import {
  normalizeShippingLogoPath,
  persistShippingLogo,
  deleteShippingLogo,
} from '../common/uploads/shipping'

@Controller('settings')
export class SettingsController {
  constructor(private prisma: PrismaService) {}

  private readonly defaultCalendarEventTypes = [
    { name: 'Reunión', color: '#2563eb' },
    { name: 'Tarea', color: '#059669' },
    { name: 'Taller', color: '#7c3aed' },
    { name: 'Otro', color: '#6b7280' },
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

  private normalizeCurrency(code?: unknown) {
    if (!code) return null
    const trimmed = String(code).trim().toUpperCase()
    if (!/^[A-Z]{3,5}$/.test(trimmed)) {
      return null
    }
    return trimmed
  }

  private async loadCurrencies(): Promise<string[]> {
    const record = await this.prisma.systemConfig.findUnique({ where: { key: 'currencies' } })
    if (!record) {
      return ['USD', 'UYU']
    }
    try {
      const parsed = JSON.parse(record.value)
      if (Array.isArray(parsed)) {
        const normalized = parsed
          .map((item) => this.normalizeCurrency(item))
          .filter((item): item is string => Boolean(item))
        return normalized.length ? normalized : ['USD', 'UYU']
      }
    } catch (error) {
      // fall through to default
    }
    return ['USD', 'UYU']
  }

  private async saveCurrencies(codes: string[]) {
    const unique = Array.from(new Set(codes))
    await this.prisma.systemConfig.upsert({
      where: { key: 'currencies' },
      update: { value: JSON.stringify(unique) },
      create: { key: 'currencies', value: JSON.stringify(unique) },
    })
    return unique
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

  // Order Statuses
  @Get('order-statuses')
  @UseGuards(JwtAuthGuard)
  getOrderStatuses() {
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

  // System Config
  @Get('system-config')
  @UseGuards(JwtAuthGuard)
  async getSystemConfig() {
    const cfg = await this.prisma.systemConfig.findMany()
    const map = new Map(cfg.map((c) => [c.key, c.value]))
    const taxRate = Number(map.get('taxRate') ?? '22')
    return {
      taxRate: Number.isNaN(taxRate) ? 22 : taxRate,
      currencies: await this.loadCurrencies(),
    }
  }

  @Put('system-config')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updateSystemConfig(@Body() body: { taxRate?: number }) {
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
    return this.loadCurrencies()
  }

  @Post('system-config/currencies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async createCurrency(@Body() body: { code: string }) {
    const code = this.normalizeCurrency(body.code)
    if (!code) {
      throw new BadRequestException('Invalid currency code')
    }
    const current = await this.loadCurrencies()
    if (current.includes(code)) {
      throw new BadRequestException('Currency already exists')
    }
    return this.saveCurrencies([...current, code])
  }

  @Put('system-config/currencies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async updateCurrency(@Body() body: { current: string; next: string }) {
    const currentCode = this.normalizeCurrency(body.current)
    const nextCode = this.normalizeCurrency(body.next)
    if (!currentCode || !nextCode) {
      throw new BadRequestException('Invalid currency code')
    }
    const list = await this.loadCurrencies()
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
    return this.saveCurrencies(updated)
  }

  @Delete('system-config/currencies')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
  async deleteCurrency(@Body() body: { code: string }) {
    const code = this.normalizeCurrency(body.code)
    if (!code) {
      throw new BadRequestException('Invalid currency code')
    }
    const list = await this.loadCurrencies()
    if (!list.includes(code)) {
      throw new BadRequestException('Currency not found')
    }
    const updated = list.filter((item) => item !== code)
    if (!updated.length) {
      throw new BadRequestException('At least one currency must remain')
    }
    return this.saveCurrencies(updated)
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

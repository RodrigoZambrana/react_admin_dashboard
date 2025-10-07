import { Body, Controller, Delete, Get, Post, Put, UseGuards, Query, BadRequestException, Param } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Prisma } from '@prisma/client'

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private prisma: PrismaService) {}

  private readonly defaultCalendarEventTypes = [
    { name: 'Reunión', color: '#2563eb' },
    { name: 'Tarea', color: '#059669' },
    { name: 'Taller', color: '#7c3aed' },
    { name: 'Otro', color: '#6b7280' },
  ]

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
  getOrderStatuses() {
    return this.prisma.orderStatus.findMany({ orderBy: { id: 'asc' } })
  }
  @Post('order-statuses/create')
  async createOrderStatus(@Body() body: { id?: number; name: string; color?: string }) {
    const nextCode = (await this.prisma.orderStatus.count())
    await this.prisma.orderStatus.create({ data: { name: body.name, code: nextCode, color: body.color } })
    return true
  }
  @Put('order-statuses/update')
  async updateOrderStatus(@Body() body: { id: number; name?: string; color?: string }) {
    await this.prisma.orderStatus.update({ where: { id: body.id }, data: { name: body.name, color: body.color } })
    return true
  }
  @Delete('order-statuses/delete')
  async deleteOrderStatus(@Body() body: { id: number }) {
    await this.prisma.orderStatus.delete({ where: { id: body.id } })
    return true
  }

  // Customer Statuses
  @Get('customer-statuses')
  getCustomerStatuses() {
    return this.prisma.customerStatus.findMany({ orderBy: { id: 'asc' } })
  }
  @Post('customer-statuses/create')
  async createCustomerStatus(@Body() body: { id?: number; name: string; color?: string }) {
    await this.prisma.customerStatus.create({ data: { name: body.name, color: body.color } })
    return true
  }
  @Put('customer-statuses/update')
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
  async deleteCustomerStatus(@Body() body: { id: number }) {
    await this.prisma.customerStatus.delete({ where: { id: body.id } })
    return true
  }

  // Expense Statuses
  @Get('expense-statuses')
  getExpenseStatuses() {
    return this.prisma.expenseStatus.findMany({ orderBy: { id: 'asc' } })
  }
  @Post('expense-statuses/create')
  async createExpenseStatus(@Body() body: { id?: number; name: string; color?: string }) {
    await this.prisma.expenseStatus.create({ data: { name: body.name, color: body.color } })
    return true
  }
  @Put('expense-statuses/update')
  async updateExpenseStatus(@Body() body: { id: number; name?: string; color?: string }) {
    await this.prisma.expenseStatus.update({ where: { id: body.id }, data: { name: body.name, color: body.color } })
    return true
  }
  @Delete('expense-statuses/delete')
  async deleteExpenseStatus(@Body() body: { id: number }) {
    await this.prisma.expenseStatus.delete({ where: { id: body.id } })
    return true
  }

  // Product Categories
  @Get('product-categories')
  getProductCategories() {
    return this.prisma.productCategory.findMany({ orderBy: { id: 'asc' } })
  }
  @Post('product-categories/create')
  async createProductCategory(@Body() body: { name: string }) {
    await this.prisma.productCategory.create({ data: { name: body.name } })
    return true
  }
  @Put('product-categories/update')
  async updateProductCategory(@Body() body: { id: number; name?: string }) {
    await this.prisma.productCategory.update({ where: { id: body.id }, data: { name: body.name } })
    return true
  }
  @Delete('product-categories/delete')
  async deleteProductCategory(@Body() body: { id: number }) {
    await this.prisma.productCategory.delete({ where: { id: body.id } })
    return true
  }

  // Payment Methods
  @Get('payment-methods')
  getPaymentMethods() {
    return this.prisma.paymentMethod.findMany({ orderBy: { id: 'asc' } })
  }
  @Post('payment-methods/create')
  async createPaymentMethod(@Body() body: { name: string }) {
    await this.prisma.paymentMethod.create({ data: { name: body.name } })
    return true
  }
  @Put('payment-methods/update')
  async updatePaymentMethod(@Body() body: { id: number; name?: string }) {
    await this.prisma.paymentMethod.update({ where: { id: body.id }, data: { name: body.name } })
    return true
  }
  @Delete('payment-methods/delete')
  async deletePaymentMethod(@Body() body: { id: number }) {
    await this.prisma.paymentMethod.delete({ where: { id: body.id } })
    return true
  }

  // System Config
  @Get('system-config')
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

  @Get('system-config/currencies')
  async getCurrencies() {
    return this.loadCurrencies()
  }

  @Post('system-config/currencies')
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
  async getCalendarEventTypes() {
    await this.ensureCalendarEventTypesSeeded()
    return this.prisma.calendarEventType.findMany({ orderBy: { id: 'asc' } })
  }

  @Post('calendar-event-types')
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

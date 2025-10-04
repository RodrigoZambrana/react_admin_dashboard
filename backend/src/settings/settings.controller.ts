import { Body, Controller, Delete, Get, Post, Put, UseGuards, Query, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Prisma } from '@prisma/client'

@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private prisma: PrismaService) {}

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

  // Product Statuses
  @Get('product-statuses')
  getProductStatuses() {
    return this.prisma.productStatus.findMany({ orderBy: { id: 'asc' } })
  }
  @Post('product-statuses/create')
  async createProductStatus(@Body() body: { id?: number; name: string; color?: string }) {
    const nextCode = (await this.prisma.productStatus.count())
    await this.prisma.productStatus.create({ data: { name: body.name, code: nextCode, color: body.color } })
    return true
  }
  @Put('product-statuses/update')
  async updateProductStatus(@Body() body: { id: number; name?: string; color?: string }) {
    await this.prisma.productStatus.update({ where: { id: body.id }, data: { name: body.name, color: body.color } })
    return true
  }
  @Delete('product-statuses/delete')
  async deleteProductStatus(@Body() body: { id: number }) {
    await this.prisma.productStatus.delete({ where: { id: body.id } })
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

  @Get('calendar-event-types')
  async getCalendarEventTypes() {
    const record = await this.prisma.systemConfig.findUnique({
      where: { key: 'calendarEventTypes' },
    })
    const fallback = [
      { key: 'meeting', label: 'Meeting' },
      { key: 'task', label: 'Task' },
      { key: 'workshop', label: 'Workshop' },
      { key: 'other', label: 'Other' },
    ]
    if (!record) {
      return fallback
    }
    try {
      const parsed = JSON.parse(record.value)
      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch (error) {
      // fallthrough to fallback
    }
    return fallback
  }

  @Put('calendar-event-types')
  async updateCalendarEventTypes(
    @Body()
    body: {
      types: { key: string; label: string }[]
    },
  ) {
    const sanitized = Array.isArray(body.types)
      ? body.types
          .filter((item) => item && item.key && item.label)
          .map((item) => ({
            key: String(item.key).trim(),
            label: String(item.label).trim(),
          }))
      : []
    const value = sanitized.length > 0 ? sanitized : [
      { key: 'meeting', label: 'Meeting' },
      { key: 'task', label: 'Task' },
      { key: 'workshop', label: 'Workshop' },
      { key: 'other', label: 'Other' },
    ]
    await this.prisma.systemConfig.upsert({
      where: { key: 'calendarEventTypes' },
      update: { value: JSON.stringify(value) },
      create: { key: 'calendarEventTypes', value: JSON.stringify(value) },
    })
    return value
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

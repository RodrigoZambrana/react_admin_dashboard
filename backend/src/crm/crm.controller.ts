import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  Query,
  Post,
  UseGuards,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TableQueryDto } from './dto/table-query.dto'

@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CrmController {
  constructor(private prisma: PrismaService) {}

  @Get('dashboard')
  async dashboard() {
    const totalCustomers = await this.prisma.customer.count()
    const recent = await this.prisma.customer.findMany({ orderBy: { id: 'desc' }, take: 8 })
    const regions = ['NA', 'EU', 'APAC', 'LATAM', 'MEA']
    const leadByRegionData = regions.map((r) => ({ name: r, value: Math.max(1, Math.round(totalCustomers / regions.length + Math.random() * 3)) }))
    return {
      statisticData: [
        { key: 'total', label: 'Total customers', value: totalCustomers, growShrink: 0 },
        { key: 'active', label: 'Active customers', value: Math.max(0, totalCustomers - 1), growShrink: 0 },
        { key: 'new', label: 'New customers', value: Math.min(5, totalCustomers), growShrink: 0 },
      ],
      leadByRegionData,
      recentLeadsData: recent.map((c) => ({
        id: c.id,
        name: c.name,
        avatar: c.img || '',
        status: 0,
        createdTime: Math.floor(new Date(c.createdAt).getTime() / 1000),
        email: c.email,
        assignee: '',
      })),
      emailSentData: { precent: 25, opened: 50, unopen: 150, total: 200 },
    }
  }

  @Post('customers')
  async listCustomers(@Body() dto: TableQueryDto) {
    const where: any = {}

    if (dto.query) {
      where.OR = [
        { name: { contains: dto.query, mode: 'insensitive' as any } },
        { email: { contains: dto.query, mode: 'insensitive' as any } },
      ]
    }

    const statusFilter = dto.filterData?.statusId
    if (
      statusFilter !== undefined &&
      statusFilter !== null &&
      statusFilter !== '' &&
      statusFilter !== 'all'
    ) {
      const parsed = Number(statusFilter)
      if (!Number.isNaN(parsed)) {
        where.statusId = parsed
      } else if (typeof statusFilter === 'string') {
        where.status = {
          name: {
            equals: statusFilter,
            mode: 'insensitive' as any,
          },
        }
      }
    }

    const total = await this.prisma.customer.count({ where })
    const rows = await this.prisma.customer.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (dto.pageIndex - 1) * dto.pageSize,
      take: dto.pageSize,
      include: {
        addresses: { select: { id: true, isPrimary: true } },
        status: true,
      },
    })

    const data = rows.map((customer) => {
      const { addresses, status, ...rest } = customer
      return {
        ...rest,
        firstName: rest.firstName || '',
        lastName: rest.lastName || '',
        statusId: customer.statusId ?? null,
        status: status?.name || '',
        statusName: status?.name || '',
        statusColor: status?.color || null,
        hasPrimaryAddress: (addresses || []).some((addr) => addr.isPrimary),
      }
    })

    return { data, total }
  }

  @Put('customers')
  async putCustomer(@Body() body: any) {
    const id = Number(body.id)
    const firstName = body.firstName || ''
    const lastName = body.lastName || ''
    const name = body.name || [firstName, lastName].filter(Boolean).join(' ')
    const personal = body.personalInfo || {}

    const coalesce = (primary: any, fallback: any) =>
      primary !== undefined ? primary : fallback

    const statusRaw =
      body.statusId ?? body.status?.id ?? body.status ?? body.statusName ?? null
    const statusNumber =
      statusRaw === null || statusRaw === undefined
        ? null
        : Number(statusRaw)
    const statusId =
      statusRaw === null || statusRaw === undefined
        ? undefined
        : Number.isNaN(statusNumber)
        ? statusRaw
        : statusNumber

    const birthdaySource =
      personal.birthday ?? body.birthday ?? body?.personalInfo?.birthday

    const data: any = {
      name,
      firstName,
      lastName,
      email: body.email,
      img: body.img,
      location: coalesce(personal.location, body.location),
      title: coalesce(personal.title, body.title),
      phoneNumber: coalesce(personal.phoneNumber, body.phoneNumber),
      facebook: coalesce(personal.facebook, body.facebook),
      twitter: coalesce(personal.twitter, body.twitter),
      pinterest: coalesce(personal.pinterest, body.pinterest),
      linkedIn: coalesce(personal.linkedIn, body.linkedIn),
    }

    if (birthdaySource !== undefined) {
      data.birthday = birthdaySource
        ? new Date(birthdaySource)
        : null
    }

    if (statusId !== undefined) {
      data.statusId = statusId === '' ? null : (statusId as number | string)
    }

    if (id) {
      return this.prisma.customer.update({
        where: { id },
        data,
        include: { status: true },
      })
    }

    return this.prisma.customer.create({
      data,
      include: { status: true },
    })
  }

  @Get('calendar')
  async calendar(@Query('projectId') projectId?: string, @Query('createdById') createdById?: string, @Query('taskId') taskId?: string) {
    const where: any = {}
    if (projectId) where.projectId = Number(projectId)
    if (createdById) where.createdById = Number(createdById)
    if (taskId) where.taskId = Number(taskId)
    const events = await this.prisma.calendarEvent.findMany({ where, orderBy: { startAt: 'asc' } })
    return { events }
  }

  @Get('customer-details')
  async customerDetails(@Query('id') id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: Number(id) },
      include: {
        addresses: true,
        status: true,
        orders: {
          include: {
            items: true,
            status: true,
          },
          orderBy: { date: 'desc' },
        },
      },
    })
    if (!customer) return null
    const orders = (customer.orders || []).map((o) => ({
      id: String(o.id),
      status: o.status?.name || '',
      statusCode: o.status?.code,
      amount: o.grandTotal || 0,
      date: Math.floor(new Date(o.date).getTime() / 1000),
      itemCount: (o.items || []).reduce((sum, it) => sum + (it.qty || 0), 0),
    }))
    return {
      id: String(customer.id),
      name: customer.name,
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email,
      img: customer.img || '',
      role: customer.title || '',
      lastOnline: Math.floor(customer.updatedAt.getTime() / 1000),
      status: customer.status?.name || '',
      phoneNumber: customer.phoneNumber || '',
      personalInfo: {
        location: customer.location || '',
        title: customer.title || '',
        birthday: customer.birthday
          ? customer.birthday.toISOString().split('T')[0]
          : '',
        phoneNumber: customer.phoneNumber || '',
        facebook: customer.facebook || '',
        twitter: customer.twitter || '',
        pinterest: customer.pinterest || '',
        linkedIn: customer.linkedIn || '',
      },
      addresses: customer.addresses,
      orders,
    }
  }

  // Customer Addresses CRUD
  @Get('customer-addresses')
  async listAddresses(@Query('customerId') customerId: string) {
    const cid = Number(customerId)
    if (!cid) return []
    return this.prisma.customerAddress.findMany({ where: { customerId: cid }, orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }] })
  }

  @Post('customer-addresses')
  async createAddress(@Body() body: any) {
    const cid = Number(body.customerId)
    const created = await this.prisma.customerAddress.create({
      data: {
        customerId: cid,
        street: body.street,
        number: String(body.number || ''),
        corner: body.corner,
        apartment: body.apartment,
        city: body.city,
        country: body.country,
        isPrimary: Boolean(body.isPrimary),
      },
    })
    if (created.isPrimary) {
      await this.prisma.customerAddress.updateMany({ where: { customerId: cid, NOT: { id: created.id } }, data: { isPrimary: false } })
    }
    return created
  }

  @Put('customer-addresses/:id')
  async updateAddress(@Query('id') _id: string, @Body() body: any) {
    const id = Number((_id || body.id))
    const updated = await this.prisma.customerAddress.update({
      where: { id },
      data: {
        street: body.street,
        number: String(body.number || ''),
        corner: body.corner,
        apartment: body.apartment,
        city: body.city,
        country: body.country,
        isPrimary: body.isPrimary,
      },
    })
    if (updated.isPrimary) {
      await this.prisma.customerAddress.updateMany({ where: { customerId: updated.customerId, NOT: { id: updated.id } }, data: { isPrimary: false } })
    }
    return updated
  }

  @Put('customer-addresses/:id/set-primary')
  async setPrimaryAddress(@Query('id') id: string) {
    const addr = await this.prisma.customerAddress.findUnique({ where: { id: Number(id) } })
    if (!addr) return false
    await this.prisma.$transaction([
      this.prisma.customerAddress.updateMany({ where: { customerId: addr.customerId }, data: { isPrimary: false } }),
      this.prisma.customerAddress.update({ where: { id: addr.id }, data: { isPrimary: true } }),
    ])
    return true
  }

  @Delete('customer-addresses/:id')
  async deleteAddress(@Query('id') id: string) {
    await this.prisma.customerAddress.delete({ where: { id: Number(id) } })
    return true
  }

  @Delete('customer/delete')
  async deleteCustomer(@Body() body: any) {
    const id = Number(body.id)
    if (!id) return false
    await this.prisma.customer.delete({ where: { id } })
    return true
  }

  @Get('customers-statistic')
  async customersStatistic() {
    const total = await this.prisma.customer.count()
    // Simple placeholder for active/new counts
    return {
      totalCustomers: { value: total, growShrink: 0 },
      activeCustomers: { value: Math.max(0, total - 1), growShrink: 0 },
      newCustomers: { value: Math.min(total, 5), growShrink: 0 },
    }
  }
}

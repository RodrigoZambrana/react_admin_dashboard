import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  Query,
  Post,
  UseGuards,
  BadRequestException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
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

    const sortKey = (dto.sort?.key || '').toString()
    const sortOrderRaw = (dto.sort?.order || '').toString().toLowerCase()
    const sortOrder: 'asc' | 'desc' | undefined =
      sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? (sortOrderRaw as 'asc' | 'desc') : undefined

    const orderBy: Prisma.CustomerOrderByWithRelationInput[] = []
    if (sortKey && sortOrder) {
      switch (sortKey) {
        case 'name':
          orderBy.push({ name: sortOrder })
          break
        case 'email':
          orderBy.push({ email: sortOrder })
          break
        case 'status':
          orderBy.push({ status: { name: sortOrder } })
          break
      }
    }
    orderBy.push({ id: 'desc' })

    const customerListInclude = {
      addresses: { select: { id: true, isPrimary: true } },
      status: true,
      phones: {
        select: {
          phone: true,
          isPrimary: true,
        },
      },
    } satisfies Prisma.CustomerInclude

    type CustomerWithRelations = Prisma.CustomerGetPayload<{
      include: typeof customerListInclude
    }>

    const rows = await this.prisma.customer.findMany({
      where,
      orderBy,
      skip: (dto.pageIndex - 1) * dto.pageSize,
      take: dto.pageSize,
      include: customerListInclude,
    })

    const data = rows.map((customer: CustomerWithRelations) => {
      const { addresses, status, phones, ...rest } = customer
      const sortedPhones = (phones || []).sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1))
      const phoneNumbers = sortedPhones.map((p) => p.phone)
      return {
        ...rest,
        firstName: rest.firstName || '',
        lastName: rest.lastName || '',
        statusId: customer.statusId ?? null,
        status: status?.name || '',
        statusName: status?.name || '',
        statusColor: status?.color || null,
        hasPrimaryAddress: (addresses || []).some((addr) => addr.isPrimary),
        phoneNumber: phoneNumbers[0] || rest.phoneNumber || '',
        phoneNumbers,
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
    let statusId: number | null | undefined
    if (statusRaw === null || statusRaw === undefined) {
      statusId = undefined
    } else if (statusRaw === '') {
      statusId = null
    } else if (typeof statusRaw === 'number') {
      statusId = Number.isNaN(statusRaw) ? undefined : statusRaw
    } else {
      const parsed = Number(statusRaw)
      statusId = Number.isNaN(parsed) ? undefined : parsed
    }

    if (typeof statusId === 'number') {
      const statusExists = await this.prisma.customerStatus.findUnique({
        where: { id: statusId },
      })
      if (!statusExists) {
        statusId = undefined
      }
    }

    const birthdaySource =
      personal.birthday ?? body.birthday ?? body?.personalInfo?.birthday

    const incomingPhones = Array.isArray(body.phoneNumbers)
      ? body.phoneNumbers
      : Array.isArray(personal.phoneNumbers)
      ? personal.phoneNumbers
      : [coalesce(personal.phoneNumber, body.phoneNumber)].filter(Boolean)

    const phoneNumbers = (incomingPhones || [])
      .map((phone: any) => (typeof phone === 'string' ? phone.trim() : ''))
      .filter((phone: string) => phone.length > 0)

    const data: any = {
      name,
      firstName,
      lastName,
      email: body.email,
      img: body.img,
      location: coalesce(personal.location, body.location),
      title: coalesce(personal.title, body.title),
      facebook: coalesce(personal.facebook, body.facebook),
      twitter: coalesce(personal.twitter, body.twitter),
      pinterest: coalesce(personal.pinterest, body.pinterest),
      linkedIn: coalesce(personal.linkedIn, body.linkedIn),
    }

    data.phoneNumber = phoneNumbers[0] ?? null

    if (birthdaySource !== undefined) {
      data.birthday = birthdaySource
        ? new Date(birthdaySource)
        : null
    }

    if (statusId !== undefined) {
      data.statusId = statusId
    }

    let customer
    if (id) {
      customer = await this.prisma.customer.update({
        where: { id },
        data,
      })
    } else {
      if (data.statusId === undefined) {
        const activeStatus = await this.prisma.customerStatus.upsert({
          where: {
            name: 'Active',
          },
          update: {},
          create: {
            name: 'Active',
            color: '#10B981',
          },
        })
        data.statusId = activeStatus.id
      }
      customer = await this.prisma.customer.create({
        data,
      })
    }

    const customerId = customer.id

    if (customerId) {
      await this.prisma.customerPhone.deleteMany({ where: { customerId } })
      if (phoneNumbers.length) {
        await this.prisma.customerPhone.createMany({
          data: phoneNumbers.map((phone: string, index: number) => ({
            customerId,
            phone,
            isPrimary: index === 0,
          })),
        })
      }

      if (body.address) {
        const addr = body.address || {}
        const addressData = {
          street: String(addr.street || ''),
          number: String(addr.number || ''),
          corner: addr.corner ? String(addr.corner) : null,
          apartment: addr.apartment ? String(addr.apartment) : null,
          city: String(addr.city || ''),
          country: String(addr.country || ''),
          isPrimary: true,
        }

        const hasMeaningfulData = [
          addressData.street,
          addressData.number,
          addressData.city,
          addressData.country,
        ].some((value) => Boolean(String(value || '').trim()))

        if (hasMeaningfulData) {
          const existingPrimary = await this.prisma.customerAddress.findFirst({
            where: { customerId, isPrimary: true },
          })

          if (existingPrimary) {
            await this.prisma.customerAddress.update({
              where: { id: existingPrimary.id },
              data: {
                ...addressData,
              },
            })
          } else {
            await this.prisma.customerAddress.create({
              data: {
                customerId,
                ...addressData,
              },
            })
          }
        }
      }
    }

    const updated = await this.prisma.customer.findUnique({
      where: { id: customerId },
      include: { status: true, phones: true, addresses: true },
    })

    if (!updated) return null

    const { phones, ...rest } = updated as any
    const sortedPhones = (phones || []).sort((a: any, b: any) =>
      a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1,
    )
    const finalPhoneNumbers = sortedPhones.map((p: any) => p.phone)

    return {
      ...rest,
      phoneNumber: rest.phoneNumber || finalPhoneNumbers[0] || null,
      phoneNumbers: finalPhoneNumbers,
    }
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
        phones: true,
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
    const phoneNumbers = (customer.phones || [])
      .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1))
      .map((p) => p.phone)

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
      phoneNumber: phoneNumbers[0] || customer.phoneNumber || '',
      phoneNumbers,
      personalInfo: {
        location: customer.location || '',
        title: customer.title || '',
        birthday: customer.birthday
          ? customer.birthday.toISOString().split('T')[0]
          : '',
        phoneNumber: phoneNumbers[0] || customer.phoneNumber || '',
        phoneNumbers,
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
    const hasOrders = await this.prisma.order.count({ where: { customerId: id } })
    if (hasOrders > 0) {
      throw new BadRequestException('text.messages.customerDeleteHasOrders')
    }
    await this.prisma.customer.delete({ where: { id } })
    return true
  }

  @Get('customers-statistic')
  async customersStatistic() {
    const total = await this.prisma.customer.count()

    const potentialActiveStatuses = await this.prisma.customerStatus.findMany({
      where: {
        OR: [
          { name: { equals: 'Active', mode: 'insensitive' as any } },
          { name: { equals: 'Activo', mode: 'insensitive' as any } },
        ],
      },
      select: { id: true },
    })

    let active = 0
    if (potentialActiveStatuses.length > 0) {
      active = await this.prisma.customer.count({
        where: { statusId: { in: potentialActiveStatuses.map((s) => s.id) } },
      })
    } else {
      active = await this.prisma.customer.count({
        where: {
          OR: [
            { status: null },
            {
              status: {
                name: {
                  contains: 'active',
                  mode: 'insensitive' as any,
                },
              },
            },
            {
              status: {
                name: {
                  contains: 'activo',
                  mode: 'insensitive' as any,
                },
              },
            },
          ],
        },
      })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const newCustomers = await this.prisma.customer.count({
      where: { createdAt: { gte: startOfMonth } },
    })

    return {
      totalCustomers: { value: total },
      activeCustomers: { value: active },
      newCustomers: { value: newCustomers },
    }
  }
}

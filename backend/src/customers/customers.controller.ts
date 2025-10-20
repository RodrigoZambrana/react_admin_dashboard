import {
  Body,
  Controller,
  Delete,
  Get,
  Put,
  Query,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { TableQueryDto } from './dto/table-query.dto'
import { UpdateCustomerDto } from './dto/update-customer.dto'
import { decimalToNumber } from '../common/currency/money.util'

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(private prisma: PrismaService) {}

  private readonly defaultCountryCode = '+598'

  private extractPhoneCandidates(source: unknown): string[] {
    if (!Array.isArray(source)) {
      return []
    }
    return (source as unknown[]).map((item) => {
      if (item === undefined || item === null) {
        return ''
      }
      if (typeof item === 'string') {
        return item
      }
      if (typeof item === 'number' && Number.isFinite(item)) {
        return String(item)
      }
      if (typeof item === 'object' && item !== null && 'phone' in (item as Record<string, unknown>)) {
        const candidate = (item as Record<string, unknown>).phone
        if (candidate === undefined || candidate === null) {
          return ''
        }
        if (typeof candidate === 'string') {
          return candidate
        }
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
          return String(candidate)
        }
        return String(candidate)
      }
      return String(item)
    }).filter((value) => value.trim().length > 0)
  }

  private normalizePhoneValue(input: unknown, defaultCountryCode = this.defaultCountryCode): string {
    if (input === undefined || input === null) {
      return ''
    }
    const raw =
      typeof input === 'string'
        ? input
        : typeof input === 'number' && Number.isFinite(input)
        ? String(input)
        : String(input ?? '')
    const trimmed = raw.trim()
    if (!trimmed) {
      return ''
    }
    let normalized = trimmed.replace(/[^\d+]+/g, '')
    if (normalized.startsWith('00')) {
      normalized = `+${normalized.slice(2)}`
    }
    const hasExplicitPrefix = normalized.startsWith('+')
    if (!hasExplicitPrefix) {
      normalized = `+${normalized}`
    }
    const digits = normalized.slice(1).replace(/\D/g, '')
    if (!digits) {
      return ''
    }
    const defaultDigits = String(defaultCountryCode || '')
      .replace(/[^\d]/g, '')
    if (hasExplicitPrefix) {
      if (defaultDigits && digits.startsWith(defaultDigits)) {
        const national = digits.slice(defaultDigits.length).replace(/^0+/, '')
        if (national.length) {
          return `+${defaultDigits}${national}`
        }
      }
      return `+${digits}`
    }
    const digitsWithoutLeadingZeros = digits.replace(/^0+/, '')
    if (!digitsWithoutLeadingZeros) {
      return ''
    }
    if (defaultDigits && digitsWithoutLeadingZeros.startsWith(defaultDigits)) {
      return `+${digitsWithoutLeadingZeros}`
    }
    return defaultDigits
      ? `+${defaultDigits}${digitsWithoutLeadingZeros}`
      : `+${digitsWithoutLeadingZeros}`
  }

  private normalizePhoneList(inputs: unknown[]): string[] {
    const normalized = inputs
      .map((value) => this.normalizePhoneValue(value))
      .filter((phone) => phone.length > 0)
    return Array.from(new Set(normalized))
  }

  private mergeEventMetadata(
    metadata: unknown,
    eventType?: { id: number; name: string; color: string | null } | null,
  ) {
    const base =
      metadata && typeof metadata === 'object'
        ? { ...(metadata as Record<string, unknown>) }
        : {}
    if (eventType) {
      base.eventTypeId = eventType.id
      base.eventTypeName = eventType.name
      if (eventType.color && !base.color) {
        base.color = eventType.color
      }
    }
    return Object.keys(base).length > 0 ? base : null
  }

  private serializeEventAttachments(
    attachments: {
      id: number
      name: string
      mimeType: string | null
      size: number | null
    }[] = [],
  ) {
    return attachments.map((attachment) => ({
      id: attachment.id,
      name: attachment.name,
      type: attachment.mimeType ?? undefined,
      size: attachment.size ?? undefined,
    }))
  }

  private extractUniqueConstraintTargets(error: Prisma.PrismaClientKnownRequestError) {
    const target = error.meta?.target
    if (Array.isArray(target)) {
      return target
        .map((value) => (value ? value.toString() : ''))
        .filter((value) => value.length > 0)
    }
    if (typeof target === 'string' && target.trim().length > 0) {
      return [target.trim()]
    }
    return []
  }

  private throwCustomerUniqueConstraint(error: Prisma.PrismaClientKnownRequestError): never {
    const targets = this.extractUniqueConstraintTargets(error).map((value) =>
      value.toLowerCase(),
    )
    const errors: Array<{ field: string; message: string; key: string }> = []

    if (targets.some((target) => target.includes('email'))) {
      errors.push({
        field: 'email',
        key: 'text.messages.customerEmailTaken',
        message: 'Ya existe un cliente con este correo electrónico.',
      })
    }
    if (targets.some((target) => target.includes('phone'))) {
      errors.push({
        field: 'phoneNumber',
        key: 'text.messages.customerPhoneTaken',
        message: 'Ya existe un cliente con este número de teléfono.',
      })
    }

    const messageKey =
      errors.length === 1
        ? errors[0].key
        : errors.length > 1
        ? 'text.messages.customerEmailAndPhoneTaken'
        : 'text.messages.customerDuplicate'

    const response: Record<string, unknown> = { message: messageKey }
    if (errors.length) {
      response.errors = errors
    }
    throw new ConflictException(response)
  }

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
        email: c.email || '',
        assignee: '',
      })),
      emailSentData: { precent: 25, opened: 50, unopen: 150, total: 200 },
    }
  }

  @Post('query')
  async queryCustomers(@Body() dto: TableQueryDto) {
    const where: any = {}

    const rawQuery = typeof dto.query === 'string' ? dto.query.trim() : ''
    if (rawQuery) {
      where.OR = [
        { name: { contains: rawQuery, mode: 'insensitive' as any } },
        { email: { contains: rawQuery, mode: 'insensitive' as any } },
        { phoneNumber: { contains: rawQuery, mode: 'insensitive' as any } },
        {
          phones: {
            some: {
              phone: {
                contains: rawQuery,
                mode: 'insensitive' as any,
              },
            },
          },
        },
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
        case 'phoneNumber':
          orderBy.push({ phoneNumber: sortOrder })
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
        email: rest.email || '',
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

  @Put()
  async putCustomer(@Body() dto: UpdateCustomerDto) {
    const id = Number(dto.id ?? 0)
    const personal =
      dto.personalInfo && typeof dto.personalInfo === 'object'
        ? dto.personalInfo
        : {}
    const rawFirstName =
      typeof dto.firstName === 'string'
        ? dto.firstName
        : typeof personal.firstName === 'string'
        ? personal.firstName
        : ''
    const rawLastName =
      typeof dto.lastName === 'string'
        ? dto.lastName
        : typeof personal.lastName === 'string'
        ? personal.lastName
        : ''
    const firstName = rawFirstName.trim()
    const lastName = rawLastName.trim()
    const providedName =
      typeof dto.name === 'string' && dto.name.trim().length ? dto.name.trim() : ''
    const name = providedName || [firstName, lastName].filter(Boolean).join(' ')

    const coalesce = (primary: any, fallback: any) =>
      primary !== undefined ? primary : fallback

    const statusRaw =
      dto.statusId ?? dto.status?.id ?? (dto as any)?.status ?? dto.statusName ?? null
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
      personal.birthday ?? dto.birthday ?? dto.personalInfo?.birthday

    let phoneCandidates: string[] = []
    if (Array.isArray(dto.phoneNumbers) && dto.phoneNumbers.length) {
      phoneCandidates = this.extractPhoneCandidates(dto.phoneNumbers)
    } else if (Array.isArray(personal.phoneNumbers) && personal.phoneNumbers.length) {
      phoneCandidates = this.extractPhoneCandidates(personal.phoneNumbers)
    } else {
      const legacyPhone = coalesce(personal.phoneNumber, dto.phoneNumber)
      if (legacyPhone !== undefined && legacyPhone !== null) {
        phoneCandidates = [legacyPhone]
      }
    }

    let phoneNumbers = this.normalizePhoneList(phoneCandidates)

    if (!phoneNumbers.length && id) {
      const existingCustomer = await this.prisma.customer.findUnique({
        where: { id },
        select: {
          phoneNumber: true,
          phones: {
            select: {
              phone: true,
              isPrimary: true,
            },
          },
        },
      })

      if (existingCustomer) {
        const sortedExistingPhones = (existingCustomer.phones || []).sort((a, b) =>
          a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1,
        )
        const fallbackPhones = sortedExistingPhones.length
          ? sortedExistingPhones.map((entry) => entry.phone)
          : existingCustomer.phoneNumber
            ? [existingCustomer.phoneNumber]
            : []
        if (fallbackPhones.length) {
          // Reuse stored phones when the payload omits them (e.g. status-only updates).
          phoneNumbers = this.normalizePhoneList(fallbackPhones)
        }
      }
    }

    if (!phoneNumbers.length) {
      throw new BadRequestException({
        message: 'text.validation.phoneNumberRequired',
        errors: [
          {
            field: 'phoneNumbers',
            key: 'text.validation.phoneNumberRequired',
          },
        ],
      })
    }

    const emailSource =
      dto.email !== undefined
        ? dto.email
        : personal.email !== undefined
        ? personal.email
        : undefined

    const img = dto.img
    const location = coalesce(personal.location, dto.location)
    const titleValue = coalesce(personal.title, dto.title)
    const facebookValue = coalesce(personal.facebook, dto.facebook)
    const twitterValue = coalesce(personal.twitter, dto.twitter)
    const pinterestValue = coalesce(personal.pinterest, dto.pinterest)
    const linkedInValue = coalesce(personal.linkedIn, dto.linkedIn)

    const createData: Prisma.CustomerUncheckedCreateInput = {
      name,
      firstName: firstName || null,
      lastName: lastName || null,
      phoneNumber: phoneNumbers[0] ?? null,
    }

    if (img !== undefined) {
      createData.img = img
    }
    if (location !== undefined) {
      createData.location = location
    }
    if (titleValue !== undefined) {
      createData.title = titleValue
    }
    if (facebookValue !== undefined) {
      createData.facebook = facebookValue
    }
    if (twitterValue !== undefined) {
      createData.twitter = twitterValue
    }
    if (pinterestValue !== undefined) {
      createData.pinterest = pinterestValue
    }
    if (linkedInValue !== undefined) {
      createData.linkedIn = linkedInValue
    }
    if (emailSource !== undefined) {
      createData.email = emailSource
    }
    if (birthdaySource !== undefined) {
      createData.birthday = birthdaySource
        ? new Date(birthdaySource)
        : null
    }
    if (statusId !== undefined) {
      createData.statusId = statusId
    }

    const updateData: Prisma.CustomerUncheckedUpdateInput = { ...createData }

    let customer
    try {
      if (id) {
        customer = await this.prisma.customer.update({
          where: { id },
          data: updateData,
        })
      } else {
        if (createData.statusId === undefined) {
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
          createData.statusId = activeStatus.id
        }
        customer = await this.prisma.customer.create({
          data: createData,
        })
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        this.throwCustomerUniqueConstraint(error)
      }
      throw error
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

      if (dto.address) {
        const addr = dto.address || {}
        const normalizeNullable = (value: unknown) => {
          if (value === undefined || value === null) {
            return null
          }
          const stringified = String(value).trim()
          return stringified.length > 0 ? stringified : null
        }

        const addressData = {
          street: String(addr.street || '').trim(),
          number: String(addr.number || '').trim(),
          corner: normalizeNullable(addr.corner),
          apartment: normalizeNullable(addr.apartment),
          city: String(addr.city || '').trim(),
          country: String(addr.country || '').trim(),
          comments: normalizeNullable(addr.comments),
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
      firstName: rest.firstName || '',
      lastName: rest.lastName || '',
      email: rest.email || '',
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
    const events = await this.prisma.calendarEvent.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: { eventType: true, attachments: true },
    })
    const normalized = events.map((event) => {
      const { attachments = [], ...rest } = event as any
      return {
        ...rest,
        attachments: this.serializeEventAttachments(attachments),
        color: rest.color || rest.eventType?.color || null,
        metadata: this.mergeEventMetadata(rest.metadata, rest.eventType ?? undefined),
      }
    })
    return { events: normalized }
  }

  @Get(':id')
  async customerDetails(@Param('id', ParseIntPipe) id: number) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
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
    const orders = (customer.orders || []).map((o) => {
      const amount = decimalToNumber(o.grandTotal, 2)
      const currencyRaw =
        typeof o.orderCurrency === 'string' ? o.orderCurrency.trim() : ''
      const currency = currencyRaw.length ? currencyRaw : undefined
      return {
        id: String(o.id),
        status: o.status?.name || '',
        statusCode: o.status?.code,
        amount,
        currency,
        date: Math.floor(new Date(o.date).getTime() / 1000),
        itemCount: (o.items || []).reduce((sum, it) => sum + (it.qty || 0), 0),
      }
    })
    const phoneNumbers = (customer.phones || [])
      .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1))
      .map((p) => p.phone)

    const metadataFilters: Prisma.CalendarEventWhereInput[] = []
    const customerIdString = String(customer.id)
    const customerIdNumber = customer.id
    const metadataPaths = ['customerId', 'customerID', 'crmId', 'userId', 'linkedCustomerId', 'linkedUserId']
    for (const path of metadataPaths) {
      metadataFilters.push({ metadata: { path: [path], equals: customerIdString } } as Prisma.CalendarEventWhereInput)
      metadataFilters.push({ metadata: { path: [path], equals: customerIdNumber } } as Prisma.CalendarEventWhereInput)
    }
    const activitiesRaw =
      metadataFilters.length > 0
        ? await this.prisma.calendarEvent.findMany({
            where: { OR: metadataFilters },
            orderBy: { startAt: 'desc' },
            take: 50,
            include: {
              eventType: true,
            },
          })
        : []
    const activities = activitiesRaw.map((event) => {
      const metadata = this.mergeEventMetadata(event.metadata, event.eventType ?? undefined)
      const color =
        event.color ||
        event.eventType?.color ||
        (metadata && typeof metadata === 'object' ? ((metadata as Record<string, unknown>).color as string | undefined) : null) ||
        null
      const eventTypeName =
        (metadata && typeof metadata === 'object'
          ? ((metadata as Record<string, unknown>).eventTypeName as string | undefined)
          : undefined) ||
        event.eventType?.name ||
        event.type ||
        ''
      const startTimestamp = Math.floor(new Date(event.startAt).getTime() / 1000)
      const endTimestamp = event.endAt ? Math.floor(new Date(event.endAt).getTime() / 1000) : null
      const locationLabel =
        (metadata && typeof metadata === 'object'
          ? ((metadata as Record<string, unknown>).locationLabel as string | undefined)
          : undefined) || event.location || ''
      return {
        id: String(event.id),
        title: event.title,
        description: event.description || '',
        type: eventTypeName,
        color,
        startDate: startTimestamp,
        endDate: endTimestamp,
        allDay: Boolean(event.allDay),
        location: locationLabel,
      }
    })

    return {
      id: String(customer.id),
      name: customer.name,
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
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
      activities,
    }
  }

  // Customer Addresses CRUD
  @Get(':id/addresses')
  async listAddresses(@Param('id', ParseIntPipe) customerId: number) {
    return this.prisma.customerAddress.findMany({
      where: { customerId },
      orderBy: [{ isPrimary: 'desc' }, { id: 'asc' }],
    })
  }

  private normalizeNullable(value: unknown) {
    if (value === undefined || value === null) return null
    const stringified = String(value).trim()
    return stringified.length ? stringified : null
  }

  private trimOrEmpty(value: unknown) {
    return String(value ?? '').trim()
  }

  @Post(':id/addresses')
  async createAddress(
    @Param('id', ParseIntPipe) customerId: number,
    @Body() body: any,
  ) {
    const created = await this.prisma.customerAddress.create({
      data: {
        customerId,
        street: this.trimOrEmpty(body.street),
        number: this.trimOrEmpty(body.number),
        corner: this.normalizeNullable(body.corner),
        apartment: this.normalizeNullable(body.apartment),
        city: this.trimOrEmpty(body.city),
        country: this.trimOrEmpty(body.country),
        comments: this.normalizeNullable(body.comments),
        isPrimary: Boolean(body.isPrimary),
      },
    })
    if (created.isPrimary) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId, NOT: { id: created.id } },
        data: { isPrimary: false },
      })
    }
    return created
  }

  @Put(':customerId/addresses/:id')
  async updateAddress(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    const updated = await this.prisma.customerAddress.update({
      where: { id, customerId },
      data: {
        street: this.trimOrEmpty(body.street),
        number: this.trimOrEmpty(body.number),
        corner: this.normalizeNullable(body.corner),
        apartment: this.normalizeNullable(body.apartment),
        city: this.trimOrEmpty(body.city),
        country: this.trimOrEmpty(body.country),
        comments: this.normalizeNullable(body.comments),
        isPrimary: Boolean(body.isPrimary),
      },
    })
    if (updated.isPrimary) {
      await this.prisma.customerAddress.updateMany({
        where: { customerId, NOT: { id: updated.id } },
        data: { isPrimary: false },
      })
    }
    return updated
  }

  @Put(':customerId/addresses/:id/set-primary')
  async setPrimaryAddress(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const addr = await this.prisma.customerAddress.findUnique({ where: { id, customerId } })
    if (!addr) return false
    await this.prisma.$transaction([
      this.prisma.customerAddress.updateMany({ where: { customerId }, data: { isPrimary: false } }),
      this.prisma.customerAddress.update({ where: { id: addr.id }, data: { isPrimary: true } }),
    ])
    return true
  }

  @Delete(':customerId/addresses/:id')
  async deleteAddress(
    @Param('customerId', ParseIntPipe) customerId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.prisma.customerAddress.delete({ where: { id, customerId } })
    return true
  }

  @Delete(':id')
  async deleteCustomer(@Param('id', ParseIntPipe) id: number) {
    const hasOrders = await this.prisma.order.count({ where: { customerId: id } })
    if (hasOrders > 0) {
      throw new BadRequestException('text.messages.customerDeleteHasOrders')
    }
    await this.prisma.customer.delete({ where: { id } })
    return true
  }

  @Get('statistics')
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

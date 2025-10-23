import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  NotFoundException,
  Res,
  BadRequestException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import { FastifyReply } from 'fastify'
import { DashboardFilterDto } from './dto/dashboard.dto'

type ExpenseSortKey =
  | 'id'
  | 'name'
  | 'date'
  | 'vendor'
  | 'category'
  | 'status'
  | 'paymentMethod'
  | 'amount'

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private prisma: PrismaService) {}

  private decodeAttachmentContent(content: unknown): Uint8Array<ArrayBuffer> | null {
    if (typeof content !== 'string') {
      return null
    }
    const normalized = content.includes(',') ? content.split(',').pop() || '' : content
    if (!normalized) {
      return null
    }
    try {
      const buffer = Buffer.from(normalized, 'base64')
      if (!buffer.length) {
        return null
      }
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer
      return new Uint8Array(arrayBuffer)
    } catch (error) {
      return null
    }
  }

  private extractAttachmentPayload(
    input: unknown,
  ): {
    keepIds: number[]
    newAttachments: {
      name: string
      mimeType: string | null
      size: number | null
      content: Uint8Array<ArrayBuffer>
    }[]
    provided: boolean
  } {
    if (!Array.isArray(input)) {
      return { keepIds: [], newAttachments: [], provided: false }
    }
    const keepIds = new Set<number>()
    const newAttachments: {
      name: string
      mimeType: string | null
      size: number | null
      content: Uint8Array<ArrayBuffer>
    }[] = []

    input.forEach((raw) => {
      if (!raw || typeof raw !== 'object') {
        return
      }
      const attachment = raw as Record<string, unknown>
      const contentCandidate =
        attachment.content || attachment.contentBase64 || attachment.data
      if (contentCandidate) {
        const byteContent = this.decodeAttachmentContent(contentCandidate)
        if (byteContent) {
          const name =
            typeof attachment.name === 'string' && attachment.name.trim().length
              ? attachment.name.trim()
              : 'attachment'
          const mimeType =
            typeof attachment.type === 'string' && attachment.type.trim().length
              ? attachment.type.trim()
              : typeof attachment.mimeType === 'string' &&
                (attachment.mimeType as string).trim().length
              ? (attachment.mimeType as string).trim()
              : null
          const sizeValue = Number(attachment.size)
          newAttachments.push({
            name,
            mimeType,
            size:
              Number.isFinite(sizeValue) && sizeValue > 0
                ? sizeValue
                : byteContent.byteLength,
            content: byteContent,
          })
        }
        return
      }

      const idValue = Number(attachment.id)
      if (Number.isFinite(idValue) && idValue > 0) {
        keepIds.add(idValue)
      }
    })

    return { keepIds: Array.from(keepIds), newAttachments, provided: true }
  }

  private serializeAttachments(
    attachments: {
      id: number
      name: string
      mimeType: string | null
      size: number | null
      content: Buffer | Uint8Array<ArrayBuffer> | null
    }[] = [],
    options: { includeContent?: boolean } = {},
  ) {
    const { includeContent = false } = options
    return attachments.map((attachment) => {
      const base: Record<string, unknown> = {
        id: attachment.id,
        name: attachment.name,
        type: attachment.mimeType ?? undefined,
        size: attachment.size ?? undefined,
        url: `/expenses/attachments/${attachment.id}`,
      }
      if (includeContent) {
        const rawContent = attachment.content
        if (rawContent) {
          const nodeBuffer = Buffer.isBuffer(rawContent)
            ? rawContent
            : Buffer.from(rawContent)
          base.content = nodeBuffer.toString('base64')
        }
      }
      return base
    })
  }

  private toNullableNumber(value: unknown): number | null | undefined {
    if (value === undefined) {
      return undefined
    }
    if (value === null || value === '') {
      return null
    }
    const num = Number(value)
    if (Number.isNaN(num)) {
      return undefined
    }
    return num
  }

  private resolveExpenseDate(value: unknown): Date {
    if (value === undefined || value === null || value === '') {
      return new Date()
    }
    if (value instanceof Date) {
      return value
    }
    const numeric = Number(value)
    if (!Number.isNaN(numeric)) {
      if (Math.abs(numeric) >= 10 ** 12) {
        return new Date(numeric)
      }
      return new Date(numeric * 1000)
    }
    const parsed = new Date(String(value))
    if (Number.isNaN(parsed.getTime())) {
      return new Date()
    }
    return parsed
  }

  private startOfDay(date: Date) {
    const d = new Date(date)
    d.setHours(0, 0, 0, 0)
    return d
  }

  private dayKey(date: Date) {
    const year = date.getFullYear()
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  private normalizeCurrency(value: unknown): string | null | undefined {
    if (value === undefined) {
      return undefined
    }
    if (value === null) {
      return null
    }
    const normalized = String(value).trim().toUpperCase()
    if (!normalized) {
      return null
    }
    return normalized.slice(0, 8)
  }

  private normalizeBooleanFlag(value: unknown): boolean | undefined {
    if (value === undefined) {
      return undefined
    }
    if (typeof value === 'boolean') {
      return value
    }
    if (typeof value === 'number') {
      if (Number.isNaN(value)) {
        return undefined
      }
      return value !== 0
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (!normalized) {
        return undefined
      }
      if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
        return true
      }
      if (['false', '0', 'no', 'n', 'off'].includes(normalized)) {
        return false
      }
      return undefined
    }
    return undefined
  }

  private resolveScalarParam(raw: unknown): string {
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string' || typeof item === 'number') {
          return String(item)
        }
      }
      return ''
    }
    if (typeof raw === 'string' || typeof raw === 'number') {
      return String(raw)
    }
    return ''
  }

  private normalizeExpenseDirection(value: string): 'asc' | 'desc' | undefined {
    const normalized = value?.toLowerCase?.() || ''
    if (normalized === 'asc' || normalized === 'ascending' || normalized === 'ascend') {
      return 'asc'
    }
    if (normalized === 'desc' || normalized === 'descending' || normalized === 'descend') {
      return 'desc'
    }
    return undefined
  }

  private normalizeExpenseSortKey(key: string): ExpenseSortKey | undefined {
    const normalized = key?.toString?.().trim()
    if (!normalized) return undefined
    const map: Record<string, ExpenseSortKey> = {
      id: 'id',
      name: 'name',
      date: 'date',
      vendor: 'vendor',
      title: 'vendor',
      category: 'category',
      categoryid: 'category',
      categoryname: 'category',
      status: 'status',
      statusid: 'status',
      statusname: 'status',
      paymentmethod: 'paymentMethod',
      paymentmethodid: 'paymentMethod',
      paymentmethodname: 'paymentMethod',
      amount: 'amount',
    }
    return map[normalized.toLowerCase()] ?? undefined
  }

  private parseSortObject(raw: unknown): Record<string, unknown> | undefined {
    if (!raw) return undefined
    if (typeof raw === 'object') return raw as Record<string, unknown>
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : undefined
      } catch {
        return undefined
      }
    }
    return undefined
  }

  private extractExpenseSort(q: any): { key: ExpenseSortKey; order: 'asc' | 'desc' } | undefined {
    let sortObj: Record<string, unknown> | undefined = this.parseSortObject(q?.sort)
    if (!sortObj) {
      const nestedKey = q?.['sort[key]'] ?? q?.['sort.key']
      const nestedOrder = q?.['sort[order]'] ?? q?.['sort.order']
      if (nestedKey !== undefined || nestedOrder !== undefined) {
        sortObj = { key: nestedKey, order: nestedOrder }
      }
    }
    if (!sortObj) {
      if (q?.sortKey !== undefined || q?.sortOrder !== undefined) {
        sortObj = { key: q?.sortKey, order: q?.sortOrder }
      }
    }
    const sortKeyRaw = this.resolveScalarParam(sortObj?.key)
    const sortOrderRaw = this.resolveScalarParam(sortObj?.order)
    const key = this.normalizeExpenseSortKey(sortKeyRaw)
    const order = this.normalizeExpenseDirection(sortOrderRaw)
    if (!key || !order) return undefined
    return { key, order }
  }

  private buildExpenseOrderBy(sort?: { key: ExpenseSortKey; order: 'asc' | 'desc' }): Prisma.ExpenseOrderByWithRelationInput[] {
    const orderBy: Prisma.ExpenseOrderByWithRelationInput[] = []
    if (sort) {
      switch (sort.key) {
        case 'id':
          orderBy.push({ id: sort.order })
          break
        case 'name':
          orderBy.push({ name: sort.order })
          break
        case 'date':
          orderBy.push({ date: sort.order })
          break
        case 'vendor':
          orderBy.push({ title: sort.order })
          break
        case 'category':
          orderBy.push({ category: { name: sort.order } })
          break
        case 'status':
          orderBy.push({ status: { name: sort.order } })
          break
        case 'paymentMethod':
          orderBy.push({ paymentMethod: { name: sort.order } })
          break
        case 'amount':
          orderBy.push({ amount: sort.order })
          break
      }
    }
    if (!orderBy.length) {
      orderBy.push({ id: 'desc' })
    } else if (sort?.key !== 'id') {
      orderBy.push({ id: 'desc' })
    }
    return orderBy
  }

  @Post('dashboard')
  async dashboard(@Body() dto: DashboardFilterDto) {
    const { startDate, endDate } = dto ?? {}
    const dateRange: Prisma.DateTimeFilter = {}
    if (typeof startDate === 'number' && Number.isFinite(startDate)) {
      dateRange.gte = new Date(startDate * 1000)
    }
    if (typeof endDate === 'number' && Number.isFinite(endDate)) {
      dateRange.lte = new Date(endDate * 1000)
    }

    const where: Prisma.ExpenseWhereInput = {}
    if (Object.keys(dateRange).length > 0) {
      where.date = dateRange
    }

    const aggregate = await this.prisma.expense.aggregate({
      where,
      _sum: { amount: true },
      _count: true,
    })
    const total = Number(aggregate._sum.amount ?? 0)
    const count = typeof aggregate._count === 'number' ? aggregate._count : 0

    const expenses = await this.prisma.expense.findMany({
      where,
      select: {
        id: true,
        amount: true,
        date: true,
        category: { select: { name: true } },
      },
    })

    const expensesByDay = new Map<string, number>()
    const expensesByMonth = new Map<string, number>()
    const hourlyExpenses = Array.from({ length: 24 }, () => 0)
    const categoryTotals = new Map<string, number>()

    for (const expense of expenses) {
      const amount = Number(expense.amount || 0) || 0
      const expenseDate = new Date(expense.date)
      const day = this.startOfDay(expenseDate)
      const key = this.dayKey(day)
      expensesByDay.set(key, (expensesByDay.get(key) ?? 0) + amount)

      const monthKey = `${expenseDate.getFullYear()}-${expenseDate.getMonth()}`
      expensesByMonth.set(monthKey, (expensesByMonth.get(monthKey) ?? 0) + amount)

      const hour = expenseDate.getHours()
      if (hour >= 0 && hour < 24) {
        hourlyExpenses[hour] += amount
      }

      const categoryName = expense.category?.name?.trim()
      if (categoryName) {
        categoryTotals.set(categoryName, (categoryTotals.get(categoryName) ?? 0) + amount)
      }
    }

    let rangeStart =
      typeof startDate === 'number' && Number.isFinite(startDate)
        ? this.startOfDay(new Date(startDate * 1000))
        : undefined
    let rangeEnd =
      typeof endDate === 'number' && Number.isFinite(endDate)
        ? this.startOfDay(new Date(endDate * 1000))
        : undefined

    if ((!rangeStart || !rangeEnd) && expenses.length > 0) {
      let minDate: Date | undefined
      let maxDate: Date | undefined
      for (const expense of expenses) {
        const currentDay = this.startOfDay(new Date(expense.date))
        if (!minDate || currentDay < minDate) {
          minDate = currentDay
        }
        if (!maxDate || currentDay > maxDate) {
          maxDate = currentDay
        }
      }
      if (!rangeStart && minDate) {
        rangeStart = minDate
      }
      if (!rangeEnd && maxDate) {
        rangeEnd = maxDate
      }
    }

    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      const today = this.startOfDay(new Date())
      rangeStart = today
      rangeEnd = today
    }

    const dayMs = 24 * 60 * 60 * 1000
    const totalSpanDays = Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / dayMs)
    const isSingleDayRange = totalSpanDays <= 0
    const isFullYearRange =
      rangeStart.getFullYear() === rangeEnd.getFullYear() &&
      rangeStart.getMonth() === 0 &&
      rangeStart.getDate() === 1 &&
      rangeEnd.getMonth() === 11

    const granularity: 'hour' | 'day' | 'month' = isSingleDayRange
      ? 'hour'
      : isFullYearRange
        ? 'month'
        : 'day'

    const categories: number[] = []
    const seriesData: number[] = []

    if (granularity === 'hour') {
      const base = rangeStart ?? this.startOfDay(new Date())
      for (let hour = 0; hour < 24; hour++) {
        const bucketTime = new Date(base)
        bucketTime.setHours(hour, 0, 0, 0)
        categories.push(Math.floor(bucketTime.getTime() / 1000))
        seriesData.push(
          Math.round((hourlyExpenses[hour] + Number.EPSILON) * 100) / 100,
        )
      }
    } else if (granularity === 'month') {
      const year = rangeStart.getFullYear()
      for (let month = 0; month < 12; month++) {
        const bucketTime = new Date(year, month, 1)
        const monthKey = `${year}-${month}`
        categories.push(Math.floor(bucketTime.getTime() / 1000))
        seriesData.push(
          Math.round(((expensesByMonth.get(monthKey) ?? 0) + Number.EPSILON) * 100) /
            100,
        )
      }
    } else {
      for (let ts = rangeStart.getTime(); ts <= rangeEnd.getTime(); ts += dayMs) {
        const current = new Date(ts)
        current.setHours(0, 0, 0, 0)
        const key = this.dayKey(current)
        const bucketExpenses = expensesByDay.get(key) ?? 0
        categories.push(Math.floor(current.getTime() / 1000))
        seriesData.push(
          Math.round((bucketExpenses + Number.EPSILON) * 100) / 100,
        )
      }
    }

    const latest = await this.prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 8,
      include: {
        status: true,
        paymentMethod: true,
        attachments: true,
      },
    })
    const latestExpensesData = latest.map((e) => ({
      id: String(e.id),
      date: Math.floor(new Date(e.date).getTime() / 1000),
      name: e.name || e.title,
      vendor: e.title,
      statusId: e.statusId ?? null,
      statusName: e.status?.name || '',
      statusColor: e.status?.color || null,
      paymentMethodId: e.paymentMethodId ?? null,
      paymentMethodName: e.paymentMethod?.name || '',
      paymentReference: e.paymentReference || '',
      amount: e.amount,
      currency: e.currency || null,
      taxCreditEligible: Boolean(e.taxCreditEligible),
      attachments: this.serializeAttachments(e.attachments ?? [], { includeContent: false }),
    }))

    const expenseCategories = await this.prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    })

    const seenCategoryLabels = new Set<string>()
    const categorySummary: { label: string; value: number }[] = []

    for (const category of expenseCategories) {
      const label = category.name?.trim()
      if (!label) {
        continue
      }
      const rawValue = categoryTotals.get(label) ?? 0
      const value = Math.round((rawValue + Number.EPSILON) * 100) / 100
      categorySummary.push({ label, value })
      seenCategoryLabels.add(label)
    }

    for (const [label, rawValue] of categoryTotals.entries()) {
      if (!label || seenCategoryLabels.has(label)) {
        continue
      }
      const value = Math.round((rawValue + Number.EPSILON) * 100) / 100
      categorySummary.push({ label, value })
    }

    categorySummary.sort((a, b) => b.value - a.value)

    const labels = categorySummary.map(({ label }) => label)
    const data = categorySummary.map(({ value }) => value)

    return {
      statisticData: {
        total: { value: Math.round(total * 100) / 100, growShrink: 0 },
        transactions: { value: count, growShrink: 0 },
        recurring: { value: 0, growShrink: 0 },
      },
      expensesReportData: {
        series: [{ name: 'Expenses', data: seriesData }],
        categories,
        granularity,
      },
      latestExpensesData,
      expensesByCategoriesData: { labels, data },
    }
  }

  @Get()
  async list(@Query() q: any) {
    const pageIndexRaw = Number(q.pageIndex)
    const pageSizeRaw = Number(q.pageSize)
    const pageIndex = Number.isFinite(pageIndexRaw) && pageIndexRaw > 0 ? Math.floor(pageIndexRaw) : 1
    const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : 50

    const queryValue = this.resolveScalarParam(q?.query).trim()
    let where: Prisma.ExpenseWhereInput = {}
    if (queryValue) {
      where = {
        OR: [
          { name: { contains: queryValue, mode: 'insensitive' } },
          { title: { contains: queryValue, mode: 'insensitive' } },
          { paymentReference: { contains: queryValue, mode: 'insensitive' } },
          { description: { contains: queryValue, mode: 'insensitive' } },
          { category: { name: { contains: queryValue, mode: 'insensitive' } } },
          { status: { name: { contains: queryValue, mode: 'insensitive' } } },
          { paymentMethod: { name: { contains: queryValue, mode: 'insensitive' } } },
        ],
      }
    }

    const total = await this.prisma.expense.count({ where })
    const sort = this.extractExpenseSort(q)
    const orderBy = this.buildExpenseOrderBy(sort)
    const rows = await this.prisma.expense.findMany({
      where,
      orderBy,
      skip: (pageIndex - 1) * pageSize,
      take: pageSize,
      include: {
        category: true,
        status: true,
        paymentMethod: true,
        attachments: true,
      },
    })
    const data = rows.map((e) => ({
      id: String(e.id),
      date: Math.floor(new Date(e.date).getTime() / 1000),
      name: e.name || e.title,
      vendor: e.title,
      categoryId: e.categoryId ?? null,
      categoryName: e.category?.name || '',
      statusId: e.statusId ?? null,
      statusName: e.status?.name || '',
      statusColor: e.status?.color || null,
      paymentMethodId: e.paymentMethodId ?? null,
      paymentMethodName: e.paymentMethod?.name || '',
      paymentReference: e.paymentReference || '',
      amount: e.amount,
      note: e.description || '',
      currency: e.currency || null,
      taxCreditEligible: Boolean(e.taxCreditEligible),
      attachments: this.serializeAttachments(e.attachments ?? [], { includeContent: false }),
    }))
    return { data, total }
  }

  @Delete('delete')
  async delete(@Body() body: { id: string | string[] }) {
    const ids = Array.isArray(body.id) ? body.id : [body.id]
    const numIds = ids.map((x) => Number(x)).filter(Boolean)
    await this.prisma.expense.deleteMany({ where: { id: { in: numIds } } })
    return true
  }

  @Get('detail')
  async detail(@Query('id') id: string) {
    const expenseId = Number(id)
    if (!Number.isFinite(expenseId)) {
      return null
    }
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
      include: {
        category: true,
        status: true,
        paymentMethod: true,
        attachments: true,
      },
    })
    if (!expense) {
      return null
    }
    return {
      id: String(expense.id),
      name: expense.name || expense.title,
      title: expense.title,
      vendor: expense.title,
      amount: expense.amount,
      date: Math.floor(expense.date.getTime() / 1000),
      categoryId: expense.categoryId ?? null,
      categoryName: expense.category?.name || '',
      statusId: expense.statusId ?? null,
      statusName: expense.status?.name || '',
      statusColor: expense.status?.color || null,
      paymentMethodId: expense.paymentMethodId ?? null,
      paymentMethodName: expense.paymentMethod?.name || '',
      paymentReference: expense.paymentReference || '',
      description: expense.description || '',
      note: expense.description || '',
      currency: expense.currency || null,
      taxCreditEligible: Boolean(expense.taxCreditEligible),
      attachments: this.serializeAttachments(expense.attachments ?? [], {
        includeContent: false,
      }),
    }
  }

  @Post('create')
  async create(@Body() body: any) {
    const rawName = body?.name ?? body?.title ?? body?.vendor
    const name =
      typeof rawName === 'string'
        ? rawName.trim()
        : rawName && typeof rawName?.toString === 'function'
          ? rawName.toString().trim()
          : ''
    if (!name) {
      throw new BadRequestException('Name is required')
    }

    const rawVendor = body?.vendor ?? body?.title
    const vendor =
      typeof rawVendor === 'string'
        ? rawVendor.trim()
        : rawVendor && typeof rawVendor?.toString === 'function'
          ? rawVendor.toString().trim()
          : ''

    const amountValue = Number(body?.amount)
    if (!Number.isFinite(amountValue)) {
      throw new BadRequestException('Amount must be a valid number')
    }
    if (amountValue <= 0) {
      throw new BadRequestException('Amount must be greater than 0')
    }
    const amount = Math.round((amountValue + Number.EPSILON) * 100) / 100

    const date = this.resolveExpenseDate(body.date)
    const categoryId = this.toNullableNumber(body.categoryId ?? body.category)
    const statusId = this.toNullableNumber(body.statusId ?? body.status)
    const paymentMethodId = this.toNullableNumber(
      body.paymentMethodId ?? body.paymentMehod ?? body.paymentMethod,
    )
    const descriptionRaw = body?.description ?? body?.note
    const description =
      typeof descriptionRaw === 'string'
        ? descriptionRaw.trim()
        : descriptionRaw && typeof descriptionRaw?.toString === 'function'
          ? descriptionRaw.toString().trim()
          : ''
    const paymentReferenceInput =
      body?.paymentReference ?? body?.paymentIdendifier ?? body?.reference
    const paymentReference =
      typeof paymentReferenceInput === 'string'
        ? paymentReferenceInput.trim() || null
        : paymentReferenceInput && typeof paymentReferenceInput?.toString === 'function'
          ? paymentReferenceInput.toString().trim() || null
          : null
    const currencyInput = this.normalizeCurrency(body.currency ?? body.currencyCode)
    const taxCreditRaw =
      body?.taxCreditEligible ??
      body?.taxCredit ??
      body?.eligibleForTaxCredit ??
      body?.generatesTaxCredit
    const taxCreditEligible = this.normalizeBooleanFlag(taxCreditRaw)

    const data: Prisma.ExpenseCreateInput = {
      title: vendor || name,
      name,
      description: description || null,
      amount,
      date,
      paymentReference,
      taxCreditEligible: taxCreditEligible ?? true,
    }

    if (currencyInput === undefined) {
      data.currency = 'UYU'
    } else {
      data.currency = currencyInput
    }

    const [categoryRecord, statusRecord, paymentMethodRecord] = await Promise.all([
      typeof categoryId === 'number'
        ? this.prisma.expenseCategory.findUnique({ where: { id: categoryId } })
        : Promise.resolve(null),
      typeof statusId === 'number'
        ? this.prisma.expenseStatus.findUnique({ where: { id: statusId } })
        : Promise.resolve(null),
      typeof paymentMethodId === 'number'
        ? this.prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } })
        : Promise.resolve(null),
    ])

    if (categoryRecord) {
      data.category = { connect: { id: categoryRecord.id } }
    }
    if (statusRecord) {
      data.status = { connect: { id: statusRecord.id } }
    }
    if (paymentMethodRecord) {
      data.paymentMethod = { connect: { id: paymentMethodRecord.id } }
    }

    const attachmentPayload = this.extractAttachmentPayload(body.attachments)

    await this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({ data })

      if (attachmentPayload.newAttachments.length) {
        await tx.expenseAttachment.createMany({
          data: attachmentPayload.newAttachments.map((attachment) => ({
            expenseId: created.id,
            name: attachment.name,
            mimeType: attachment.mimeType,
            size: attachment.size,
            content: attachment.content,
          })),
        })
      }
    })

    return true
  }

  @Put('update')
  async update(@Body() body: any) {
    const expenseId = Number(body.id)
    if (!Number.isFinite(expenseId)) {
      return false
    }

    const titleRaw = body.title ?? body.vendor
    const descriptionRaw =
      body.description !== undefined ? body.description : body.note
    const amountRaw = body.amount
    const dateRaw = body.date
    const categoryId = this.toNullableNumber(body.categoryId ?? body.category)
    const statusId = this.toNullableNumber(body.statusId ?? body.status)
    const paymentMethodId = this.toNullableNumber(
      body.paymentMethodId ?? body.paymentMehod ?? body.paymentMethod,
    )
    const paymentReferenceInput =
      body.paymentReference ?? body.paymentIdendifier ?? body.reference
    const currencyInput = this.normalizeCurrency(body.currency ?? body.currencyCode)
    const taxCreditRaw =
      body.taxCreditEligible ??
      body.taxCredit ??
      body.eligibleForTaxCredit ??
      body.generatesTaxCredit
    const taxCreditEligible = this.normalizeBooleanFlag(taxCreditRaw)

    const data: Prisma.ExpenseUpdateInput = {}

    if (titleRaw !== undefined) {
      const normalizedTitle = String(titleRaw).trim()
      data.title = normalizedTitle || 'Expense'
    }

    if (descriptionRaw !== undefined) {
      const normalizedDescription = String(descriptionRaw || '').trim()
      data.description = normalizedDescription || null
    }

    if (amountRaw !== undefined) {
      data.amount = Number(amountRaw || 0)
    }

    if (dateRaw !== undefined) {
      data.date = this.resolveExpenseDate(dateRaw)
    }

    if (paymentReferenceInput !== undefined) {
      const reference = String(paymentReferenceInput || '').trim()
      data.paymentReference = reference || null
    }

    if (currencyInput !== undefined) {
      data.currency = currencyInput
    }
    if (taxCreditEligible !== undefined) {
      data.taxCreditEligible = taxCreditEligible
    }

    if (categoryId !== undefined) {
      data.category =
        categoryId === null
          ? { disconnect: true }
          : { connect: { id: categoryId } }
    }

    if (statusId !== undefined) {
      data.status =
        statusId === null
          ? { disconnect: true }
          : { connect: { id: statusId } }
    }

    if (paymentMethodId !== undefined) {
      data.paymentMethod =
        paymentMethodId === null
          ? { disconnect: true }
          : { connect: { id: paymentMethodId } }
    }

    const attachmentPayload = this.extractAttachmentPayload(body.attachments)

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id: expenseId },
        data,
      })

      if (attachmentPayload.provided) {
        const keepIds = attachmentPayload.keepIds
        if (keepIds.length) {
          await tx.expenseAttachment.deleteMany({
            where: {
              expenseId: updated.id,
              id: { notIn: keepIds },
            },
          })
        } else {
          await tx.expenseAttachment.deleteMany({
            where: { expenseId: updated.id },
          })
        }

        if (attachmentPayload.newAttachments.length) {
          await tx.expenseAttachment.createMany({
            data: attachmentPayload.newAttachments.map((attachment) => ({
              expenseId: updated.id,
              name: attachment.name,
              mimeType: attachment.mimeType,
              size: attachment.size,
              content: attachment.content,
            })),
          })
        }
      }
    })

    return true
  }

  @Get('categories')
  categories() {
    return this.prisma.expenseCategory.findMany({ orderBy: { id: 'asc' } })
  }

  @Post('categories/create')
  async createCategory(@Body() body: { name: string }) {
    await this.prisma.expenseCategory.create({ data: { name: body.name } })
    return true
  }

  @Put('categories/update')
  async updateCategory(@Body() body: { id: number; name?: string }) {
    await this.prisma.expenseCategory.update({ where: { id: body.id }, data: { name: body.name } })
    return true
  }

  @Delete('categories/delete')
  async deleteCategory(@Body() body: { id: number }) {
    await this.prisma.expenseCategory.delete({ where: { id: body.id } })
    return true
  }

  @Get('attachments/:id')
  async getAttachment(
    @Param('id') id: string,
    @Query('mode') mode = 'attachment',
    @Res({ passthrough: true }) res: FastifyReply,
  ) {
    const attachmentId = Number(id)
    if (!attachmentId || Number.isNaN(attachmentId)) {
      throw new NotFoundException('Attachment not found')
    }

    const attachment = await this.prisma.expenseAttachment.findUnique({
      where: { id: attachmentId },
    })

    if (!attachment) {
      throw new NotFoundException('Attachment not found')
    }

    const mimeType = attachment.mimeType || 'application/octet-stream'
    const disposition = mode === 'inline' ? 'inline' : 'attachment'
    const fallbackName = attachment.name?.trim().length
      ? attachment.name.trim()
      : 'attachment'
    const encodedFileName = encodeURIComponent(fallbackName)

    res.header('Content-Type', mimeType)
    res.header(
      'Content-Disposition',
      `${disposition}; filename*=UTF-8''${encodedFileName}`,
    )
    if (attachment.size ?? attachment.content.length) {
      res.header(
        'Content-Length',
        String(attachment.size ?? attachment.content.length ?? 0),
      )
    }

    return res.send(Buffer.from(attachment.content))
  }

  @Delete('attachments/:id')
  async deleteAttachment(@Param('id') id: string) {
    const attachmentId = Number(id)
    if (!attachmentId || Number.isNaN(attachmentId)) {
      throw new NotFoundException('Attachment not found')
    }

    try {
      await this.prisma.expenseAttachment.delete({ where: { id: attachmentId } })
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException('Attachment not found')
      }
      throw error
    }

    return { success: true }
  }
}

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
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import { FastifyReply } from 'fastify'

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private prisma: PrismaService) {}

  private decodeAttachmentContent(content: unknown): Buffer | null {
    if (typeof content !== 'string') {
      return null
    }
    const normalized = content.includes(',') ? content.split(',').pop() || '' : content
    if (!normalized) {
      return null
    }
    try {
      return Buffer.from(normalized, 'base64')
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
      content: Buffer
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
      content: Buffer
    }[] = []

    input.forEach((raw) => {
      if (!raw || typeof raw !== 'object') {
        return
      }
      const attachment = raw as Record<string, unknown>
      const contentCandidate =
        attachment.content || attachment.contentBase64 || attachment.data
      if (contentCandidate) {
        const buffer = this.decodeAttachmentContent(contentCandidate)
        if (buffer) {
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
            size: Number.isFinite(sizeValue) && sizeValue > 0 ? sizeValue : buffer.length,
            content: buffer,
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
      content: Buffer | Uint8Array
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
        base.content = attachment.content?.toString('base64')
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

  @Post('dashboard')
  async dashboard() {
    const sum = await this.prisma.expense.aggregate({ _sum: { amount: true }, _count: true })
    const total = sum._sum.amount || 0
    const count = sum._count || 0

    // Build a simple report for last 12 weeks
    const categories: string[] = []
    const seriesData: number[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i * 7)
      categories.push(`${d.getMonth() + 1}/${d.getDate()}`)
      // naive distribution
      seriesData.push(Math.max(0, Math.round((total / 12) * (0.6 + Math.random()))))
    }

    // Latest expenses
    const latest = await this.prisma.expense.findMany({
      orderBy: { id: 'desc' },
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
      vendor: e.title,
      statusId: e.statusId ?? null,
      statusName: e.status?.name || '',
      statusColor: e.status?.color || null,
      paymentMethodId: e.paymentMethodId ?? null,
      paymentMethodName: e.paymentMethod?.name || '',
      paymentReference: e.paymentReference || '',
      amount: e.amount,
      currency: e.currency || null,
      attachments: this.serializeAttachments(e.attachments ?? [], { includeContent: false }),
    }))

    // By categories breakdown
    const cats = await this.prisma.expenseCategory.findMany({ include: { expenses: true } })
    const labels = cats.map((c) => c.name)
    const data = cats.map((c) => c.expenses.reduce((s, x) => s + (x.amount || 0), 0))

    return {
      statisticData: {
        total: { value: Math.round(total * 100) / 100, growShrink: 0 },
        transactions: { value: count, growShrink: 0 },
        recurring: { value: 0, growShrink: 0 },
      },
      expensesReportData: {
        series: [{ name: 'Expenses', data: seriesData }],
        categories,
      },
      latestExpensesData,
      expensesByCategoriesData: { labels, data },
    }
  }

  @Get()
  async list(@Query() q: any) {
    const pageIndex = Number(q.pageIndex || 1)
    const pageSize = Number(q.pageSize || 50)
    const where = q.query
      ? ({ title: { contains: String(q.query), mode: 'insensitive' as any } } as any)
      : ({} as any)
    const total = await this.prisma.expense.count({ where })
    const sortKey = (q.sort?.key || '').toString()
    const sortOrderRaw = (q.sort?.order || '').toString().toLowerCase()
    const sortOrder: 'asc' | 'desc' | undefined =
      sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? (sortOrderRaw as 'asc' | 'desc') : undefined
    const orderBy: Prisma.ExpenseOrderByWithRelationInput[] = []
    if (sortKey && sortOrder) {
      switch (sortKey) {
        case 'id':
          orderBy.push({ id: sortOrder })
          break
        case 'date':
          orderBy.push({ date: sortOrder })
          break
        case 'vendor':
          orderBy.push({ title: sortOrder })
          break
        case 'category':
          orderBy.push({ category: { name: sortOrder } })
          break
        case 'status':
          orderBy.push({ status: { name: sortOrder } })
          break
        case 'amount':
          orderBy.push({ amount: sortOrder })
          break
      }
    }
    orderBy.push({ id: 'desc' })
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
      attachments: this.serializeAttachments(expense.attachments ?? [], {
        includeContent: false,
      }),
    }
  }

  @Post('create')
  async create(@Body() body: any) {
    const title = String(body.title || body.vendor || '').trim() || 'Expense'
    const amount = Number(body.amount || 0)
    const date = this.resolveExpenseDate(body.date)
    const categoryId = this.toNullableNumber(body.categoryId ?? body.category)
    const statusId = this.toNullableNumber(body.statusId ?? body.status)
    const paymentMethodId = this.toNullableNumber(
      body.paymentMethodId ?? body.paymentMehod ?? body.paymentMethod,
    )
    const paymentReference =
      (body.paymentReference ?? body.paymentIdendifier ?? body.reference ?? '').trim() || null
    const currencyInput = this.normalizeCurrency(body.currency ?? body.currencyCode)

    const data: Prisma.ExpenseCreateInput = {
      title,
      description: body.description || body.note || null,
      amount,
      date,
      paymentReference,
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

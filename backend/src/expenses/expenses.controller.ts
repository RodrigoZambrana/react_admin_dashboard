import { Body, Controller, Delete, Get, Post, Put, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private prisma: PrismaService) {}

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
    const latest = await this.prisma.expense.findMany({ orderBy: { id: 'desc' }, take: 8 })
    const latestExpensesData = latest.map((e) => ({
      id: String(e.id),
      date: Math.floor(new Date(e.date).getTime() / 1000),
      vendor: e.title,
      status: e.statusId || 0,
      paymentMehod: 'Card',
      paymentIdendifier: '',
      amount: e.amount,
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
    const pageSize = Number(q.pageSize || 10)
    const where = q.query
      ? ({ title: { contains: String(q.query), mode: 'insensitive' as any } } as any)
      : ({} as any)
    const total = await this.prisma.expense.count({ where })
    const rows = await this.prisma.expense.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: (pageIndex - 1) * pageSize,
      take: pageSize,
      // include: { category: true, status: true },
    })
    const data = rows.map((e) => ({
      id: String(e.id),
      date: Math.floor(new Date(e.date).getTime() / 1000),
      vendor: e.title,
      category: '',
      status: e.statusId || 0,
      paymentMehod: '',
      paymentIdendifier: '',
      amount: e.amount,
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
    return this.prisma.expense.findUnique({ where: { id: Number(id) } })
  }

  @Post('create')
  async create(@Body() body: any) {
    await this.prisma.expense.create({
      data: {
        title: body.title,
        description: body.description,
        amount: Number(body.amount || 0),
        date: body.date ? new Date(body.date) : new Date(),
      },
    })
    return true
  }

  @Put('update')
  async update(@Body() body: any) {
    await this.prisma.expense.update({
      where: { id: Number(body.id) },
      data: {
        title: body.title,
        description: body.description,
        amount: Number(body.amount || 0),
        date: body.date ? new Date(body.date) : new Date(),
      },
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
}

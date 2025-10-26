import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  PaymentStatus,
  PaymentType,
  Prisma,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { OrderFinanceService } from '../orders/order-finance.service'
import {
  CreatePaymentDto,
  PaymentListQueryDto,
  UpdatePaymentDto,
} from './dto/payment.dto'
import { roundDecimal } from '../common/currency/money.util'

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orderFinance: OrderFinanceService,
  ) {}

  private async resolvePaymentMethod(
    client: PrismaClientOrTx,
    paymentMethodId?: number | null,
    methodName?: string | null,
  ): Promise<{ id: number; name: string } | null> {
    if (paymentMethodId) {
      const pm = await client.paymentMethod.findUnique({ where: { id: paymentMethodId } })
      if (pm) {
        return pm
      }
    }
    if (methodName) {
      const normalized = methodName.trim()
      if (normalized.length) {
        const pm = await client.paymentMethod.upsert({
          where: { name: normalized },
          update: {},
          create: { name: normalized },
        })
        return pm
      }
    }
    return null
  }

  private serializePayment(payment: Prisma.PaymentGetPayload<{
    include: {
      order: {
        include: {
          customer: true
          status: true
        }
      }
      paymentMethod: true
    }
  }>) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      amount: Number(payment.amount.toString()),
      currency: payment.currency,
      type: payment.type,
      status: payment.status,
      reference: payment.reference ?? null,
      method: payment.method ?? payment.paymentMethod?.name ?? null,
      paymentMethodId: payment.paymentMethodId ?? null,
      date: payment.date.toISOString(),
      notes: payment.notes ?? null,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
      order: payment.order
        ? {
            id: payment.order.id,
            customerId: payment.order.customerId,
            customerName: payment.order.customer?.name ?? null,
            grandTotal: Number(payment.order.grandTotal?.toString?.() ?? payment.order.grandTotal ?? 0),
            currency: payment.order.orderCurrency,
            status: payment.order.status
              ? {
                  id: payment.order.status.id,
                  code: payment.order.status.code,
                  name: payment.order.status.name,
                }
              : null,
          }
        : null,
    }
  }

  async listPayments(query: PaymentListQueryDto) {
    const pageIndex = query.pageIndex && query.pageIndex > 0 ? query.pageIndex : 1
    const pageSize =
      query.pageSize && query.pageSize > 0 && query.pageSize <= 200 ? query.pageSize : 25

    const where: Prisma.PaymentWhereInput = {}

    if (query.orderId) {
      where.orderId = query.orderId
    }
    if (query.status) {
      where.status = query.status
    }
    if (query.type) {
      where.type = query.type
    }
    if (query.query) {
      const normalized = query.query.trim()
      if (normalized.length) {
        const numericOrderId = Number(normalized)
        const orderIdFilter =
          Number.isFinite(numericOrderId) && String(numericOrderId) === normalized
            ? {
                orderId: numericOrderId,
              }
            : null
        where.OR = [
          { reference: { contains: normalized, mode: 'insensitive' } },
          { method: { contains: normalized, mode: 'insensitive' } },
          { order: { customer: { name: { contains: normalized, mode: 'insensitive' } } } },
          ...(orderIdFilter ? [orderIdFilter] as Prisma.PaymentWhereInput[] : []),
        ]
      }
    }

    if (query.startDate || query.endDate) {
      const dateFilter: Prisma.DateTimeFilter = {}
      if (query.startDate) {
        dateFilter.gte = new Date(query.startDate)
      }
      if (query.endDate) {
        const end = new Date(query.endDate)
        dateFilter.lte = end
      }
      where.date = dateFilter
    }

    let orderBy: Prisma.PaymentOrderByWithRelationInput[] = [{ date: 'desc' }]
    if (query.sortKey && query.sortOrder) {
      const sortOrder = query.sortOrder
      const mapping: Record<string, Prisma.PaymentOrderByWithRelationInput> = {
        date: { date: sortOrder },
        amount: { amount: sortOrder },
        status: { status: sortOrder },
        type: { type: sortOrder },
        order: { orderId: sortOrder },
      }
      if (mapping[query.sortKey]) {
        orderBy = [mapping[query.sortKey]]
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy,
        skip: (pageIndex - 1) * pageSize,
        take: pageSize,
        include: {
          order: {
            include: {
              customer: true,
              status: true,
            },
          },
          paymentMethod: true,
        },
      }),
      this.prisma.payment.count({ where }),
    ])

    return {
      data: items.map((item) => this.serializePayment(item)),
      total,
      pageIndex,
      pageSize,
    }
  }

  async getPayment(id: number) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: true,
            status: true,
          },
        },
        paymentMethod: true,
      },
    })
    if (!payment) {
      throw new NotFoundException('accounting.payments.validation.notFound')
    }
    const summary = await this.orderFinance.getOrderPaymentSummary(payment.orderId)
    return {
      ...this.serializePayment(payment),
      summary: {
        currency: summary.currency,
        grandTotal: Number(summary.grandTotal.toString()),
        depositRequired: Number(summary.depositRequired.toString()),
        depositPaidConfirmed: Number(summary.depositPaidConfirmed.toString()),
        balancePaidConfirmed: Number(summary.balancePaidConfirmed.toString()),
        refundsConfirmed: Number(summary.refundsConfirmed.toString()),
        totalPaidConfirmed: Number(summary.totalPaidConfirmed.toString()),
        outstanding: Number(summary.outstanding.toString()),
        customerCredit: Number(summary.customerCredit.toString()),
        depositMet: summary.depositMet,
      },
    }
  }

  async createPayment(dto: CreatePaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: dto.orderId },
        select: { id: true, orderCurrency: true },
      })
      if (!order) {
        throw new BadRequestException('accounting.payments.validation.orderNotFound')
      }

      const currency = (dto.currency ?? order.orderCurrency ?? 'UYU').toUpperCase()
      const paymentMethod = await this.resolvePaymentMethod(
        tx,
        dto.paymentMethodId ?? null,
        dto.method ?? null,
      )
      const amountDecimal = roundDecimal(dto.amount, 2)
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          amount: amountDecimal.toFixed(2),
          currency,
          type: dto.type ?? PaymentType.BALANCE,
          status: dto.status ?? PaymentStatus.CONFIRMED,
          paymentMethodId: paymentMethod?.id ?? null,
          method: paymentMethod?.name ?? dto.method?.trim() ?? null,
          reference: dto.reference?.trim() || null,
          date: dto.date ? new Date(dto.date) : new Date(),
          notes: dto.notes?.trim() || null,
        },
      })
      await this.orderFinance.recalculateOrderFinancials(order.id, tx)
      return payment
    }).then((payment) => this.getPayment(payment.id))
  }

  async updatePayment(id: number, dto: UpdatePaymentDto) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({ where: { id } })
      if (!payment) {
        throw new NotFoundException('accounting.payments.validation.notFound')
      }
      const data: Prisma.PaymentUpdateInput = {}
      if (dto.amount !== undefined) {
        data.amount = roundDecimal(dto.amount, 2).toFixed(2)
      }
      if (dto.currency) {
        data.currency = dto.currency.trim().toUpperCase()
      }
      if (dto.type) {
        data.type = dto.type
      }
      if (dto.status) {
        data.status = dto.status
      }
      if (dto.reference !== undefined) {
        data.reference = dto.reference?.trim() || null
      }
      if (dto.notes !== undefined) {
        data.notes = dto.notes?.trim() || null
      }
      if (dto.date) {
        data.date = new Date(dto.date)
      }
      if (dto.paymentMethodId !== undefined || dto.method !== undefined) {
        const paymentMethod = await this.resolvePaymentMethod(
          tx,
          dto.paymentMethodId ?? null,
          dto.method ?? null,
        )
        data.paymentMethod = paymentMethod
          ? { connect: { id: paymentMethod.id } }
          : { disconnect: true }
        data.method = paymentMethod?.name ?? dto.method?.trim() ?? null
      }

      await tx.payment.update({
        where: { id },
        data,
      })
      await this.orderFinance.recalculateOrderFinancials(payment.orderId, tx)
      return id
    }).then(() => this.getPayment(id))
  }

  async deletePayment(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.payment.findUnique({
        where: { id },
      })
      if (!existing) {
        throw new NotFoundException('accounting.payments.validation.notFound')
      }
      await tx.payment.delete({ where: { id } })
      await this.orderFinance.recalculateOrderFinancials(existing.orderId, tx)
      return true
    })
  }
}

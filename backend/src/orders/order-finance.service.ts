import { BadRequestException, Injectable } from '@nestjs/common'
import {
  DepositRequirementType,
  PaymentStatus,
  PaymentType,
  Prisma,
  WorkOrderStatus,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import {
  addDecimals,
  decimal,
  divideDecimals,
  multiplyDecimals,
  roundDecimal,
  subtractDecimals,
} from '../common/currency/money.util'

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient

export type OrderPaymentSummary = {
  orderId: number
  currency: string
  grandTotal: Prisma.Decimal
  depositRequired: Prisma.Decimal
  depositPaidConfirmed: Prisma.Decimal
  balancePaidConfirmed: Prisma.Decimal
  refundsConfirmed: Prisma.Decimal
  totalPaidConfirmed: Prisma.Decimal
  depositPending: Prisma.Decimal
  balancePending: Prisma.Decimal
  refundsPending: Prisma.Decimal
  outstanding: Prisma.Decimal
  customerCredit: Prisma.Decimal
  depositMet: boolean
}

@Injectable()
export class OrderFinanceService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly STATUS_CODES = {
    PENDING: 100,
    CONFIRMED: 200,
    WORK_ORDER: 300,
    READY: 400,
    DELIVERED: 500,
    CLOSED: 600,
  } as const

  private readonly statusCache = new Map<number, number | null>()

  private async getStatusId(
    code: number,
    client: PrismaClientOrTx,
  ): Promise<number | null> {
    if (this.statusCache.has(code)) {
      return this.statusCache.get(code) ?? null
    }
    const status = await client.orderStatus.findUnique({ where: { code } })
    const statusId = status?.id ?? null
    this.statusCache.set(code, statusId)
    return statusId
  }

  private async getDefaultDepositRequirement(
    client: PrismaClientOrTx,
  ): Promise<{ type: DepositRequirementType; value: Prisma.Decimal }> {
    const config = await client.systemConfig.findUnique({
      where: { key: 'orderMinimumDeposit' },
    })
    if (config?.value) {
      try {
        const parsed = JSON.parse(config.value)
        const typeValue =
          parsed?.type === 'FIXED' ? DepositRequirementType.FIXED : DepositRequirementType.PERCENTAGE
        const rawValue =
          typeof parsed?.value === 'number'
            ? parsed?.value
            : typeof parsed?.value === 'string'
              ? Number(parsed.value)
              : 0
        if (!Number.isNaN(rawValue)) {
          return { type: typeValue, value: decimal(rawValue) }
        }
      } catch {
        // ignore malformed json
      }
    }
    return { type: DepositRequirementType.PERCENTAGE, value: decimal(30) }
  }

  async resolveDepositRequirement(
    params: {
      type?: string | DepositRequirementType | null
      value?: number | string | Prisma.Decimal | null
    } = {},
    client?: PrismaClientOrTx,
  ): Promise<{ type: DepositRequirementType; value: Prisma.Decimal }> {
    const targetClient = client ?? this.prisma
    const rawType = params.type
    const normalizedType =
      typeof rawType === 'string'
        ? rawType.trim().toUpperCase()
        : rawType ?? undefined
    const parsedType =
      normalizedType === 'FIXED'
        ? DepositRequirementType.FIXED
        : normalizedType === 'PERCENTAGE'
          ? DepositRequirementType.PERCENTAGE
          : undefined

    const rawValue = params.value
    const parsedValue =
      rawValue === null || rawValue === undefined || rawValue === ''
        ? Number.NaN
        : rawValue instanceof Prisma.Decimal
          ? Number(rawValue.toString())
          : Number(rawValue)

    if (parsedType && Number.isFinite(parsedValue)) {
      return { type: parsedType, value: decimal(parsedValue) }
    }

    return this.getDefaultDepositRequirement(targetClient)
  }

  private computeDepositRequirement(
    grandTotal: Prisma.Decimal,
    type: DepositRequirementType,
    value: Prisma.Decimal,
  ) {
    const normalizedValue = decimal(value)
    if (type === DepositRequirementType.FIXED) {
      return normalizedValue.lessThan(0) ? decimal(0) : normalizedValue
    }
    if (normalizedValue.lessThanOrEqualTo(0)) {
      return decimal(0)
    }
    const ratio = divideDecimals(normalizedValue, 100)
    const required = multiplyDecimals(grandTotal, ratio)
    return required.lessThan(0) ? decimal(0) : required
  }

  private aggregatePayments(payments: Array<{ amount: Prisma.Decimal; type: PaymentType; status: PaymentStatus }>) {
    let depositConfirmed = decimal(0)
    let balanceConfirmed = decimal(0)
    let refundsConfirmed = decimal(0)
    let depositPending = decimal(0)
    let balancePending = decimal(0)
    let refundsPending = decimal(0)

    for (const payment of payments) {
      const amount = decimal(payment.amount)
      if (payment.status === PaymentStatus.CONFIRMED) {
        if (payment.type === PaymentType.DEPOSIT) {
          depositConfirmed = addDecimals(depositConfirmed, amount)
        } else if (payment.type === PaymentType.BALANCE) {
          balanceConfirmed = addDecimals(balanceConfirmed, amount)
        } else if (payment.type === PaymentType.REFUND) {
          refundsConfirmed = addDecimals(refundsConfirmed, amount)
        }
        continue
      }
      if (payment.status === PaymentStatus.REGISTERED) {
        if (payment.type === PaymentType.DEPOSIT) {
          depositPending = addDecimals(depositPending, amount)
        } else if (payment.type === PaymentType.BALANCE) {
          balancePending = addDecimals(balancePending, amount)
        } else if (payment.type === PaymentType.REFUND) {
          refundsPending = addDecimals(refundsPending, amount)
        }
      }
    }

    return {
      depositConfirmed,
      balanceConfirmed,
      refundsConfirmed,
      depositPending,
      balancePending,
      refundsPending,
    }
  }

  private generateWorkOrderCode(orderId: number) {
    const stamp = Date.now().toString(36).toUpperCase()
    return `WO-${orderId}-${stamp}`
  }

  async recalculateOrderFinancials(
    orderId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<OrderPaymentSummary> {
    const client = (tx ?? this.prisma) as PrismaClientOrTx
    const order = await client.order.findUnique({
      where: { id: orderId },
      include: {
        payments: true,
        status: true,
        workOrders: true,
      },
    })
    if (!order) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }

    const grandTotal = decimal(order.grandTotal)
    const depositType = order.minimumDepositType ?? DepositRequirementType.PERCENTAGE
    const depositValue =
      order.minimumDepositValue !== null && order.minimumDepositValue !== undefined
        ? decimal(order.minimumDepositValue)
        : (await this.getDefaultDepositRequirement(client)).value

    const depositRequired = this.computeDepositRequirement(grandTotal, depositType, depositValue)

    const aggregates = this.aggregatePayments(
      order.payments.map((payment) => ({
        amount: payment.amount,
        type: payment.type,
        status: payment.status,
      })),
    )

    const totalPaidConfirmed = subtractDecimals(
      addDecimals(aggregates.depositConfirmed, aggregates.balanceConfirmed),
      aggregates.refundsConfirmed,
    )

    const outstandingRaw = subtractDecimals(grandTotal, totalPaidConfirmed)
    const outstanding = outstandingRaw.isNegative() ? decimal(0) : outstandingRaw
    const credit = outstandingRaw.isNegative() ? outstandingRaw.abs() : decimal(0)

    const depositMet = aggregates.depositConfirmed.greaterThanOrEqualTo(roundDecimal(depositRequired, 2))

    const now = new Date()
    const updateData: Prisma.OrderUpdateInput = {
      customerCredit: roundDecimal(credit, 2).toFixed(2),
    }

    if (depositMet && !order.depositSatisfiedAt) {
      updateData.depositSatisfiedAt = now
    }
    if (!depositMet && order.depositSatisfiedAt) {
      updateData.depositSatisfiedAt = null
    }

    const pendingStatusId = await this.getStatusId(this.STATUS_CODES.PENDING, client)
    const confirmedStatusId = await this.getStatusId(this.STATUS_CODES.CONFIRMED, client)

    if (depositMet) {
      if (!order.confirmedAt) {
        updateData.confirmedAt = now
      }
      if (
        confirmedStatusId &&
        ((pendingStatusId && order.statusId === pendingStatusId) || order.statusId === null)
      ) {
        updateData.status = { connect: { id: confirmedStatusId } }
      }
      if (!order.workOrders.length) {
        await client.workOrder.create({
          data: {
            orderId: order.id,
            code: this.generateWorkOrderCode(order.id),
            status: WorkOrderStatus.PENDING,
          },
        })
      }
    } else if (order.confirmedAt && confirmedStatusId && order.statusId === confirmedStatusId) {
      updateData.confirmedAt = null
    }

    await client.order.update({
      where: { id: order.id },
      data: updateData,
    })

    return {
      orderId: order.id,
      currency: order.orderCurrency,
      grandTotal,
      depositRequired: roundDecimal(depositRequired, 2),
      depositPaidConfirmed: roundDecimal(aggregates.depositConfirmed, 2),
      balancePaidConfirmed: roundDecimal(aggregates.balanceConfirmed, 2),
      refundsConfirmed: roundDecimal(aggregates.refundsConfirmed, 2),
      totalPaidConfirmed: roundDecimal(totalPaidConfirmed, 2),
      depositPending: roundDecimal(aggregates.depositPending, 2),
      balancePending: roundDecimal(aggregates.balancePending, 2),
      refundsPending: roundDecimal(aggregates.refundsPending, 2),
      outstanding: roundDecimal(outstanding, 2),
      customerCredit: roundDecimal(credit, 2),
      depositMet,
    }
  }

  async ensureStatusCanTransition(
    orderId: number,
    targetStatusId: number,
    force = false,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const summary = await this.recalculateOrderFinancials(orderId, tx)
      const targetStatus = await tx.orderStatus.findUnique({
        where: { id: targetStatusId },
      })
      if (!targetStatus) {
        throw new BadRequestException('sales.orders.validation.statusInvalid')
      }

      const targetCode = targetStatus.code
      if (
        (targetCode === this.STATUS_CODES.CONFIRMED ||
          targetCode === this.STATUS_CODES.WORK_ORDER ||
          targetCode === this.STATUS_CODES.READY ||
          targetCode === this.STATUS_CODES.DELIVERED ||
          targetCode === this.STATUS_CODES.CLOSED) &&
        !summary.depositMet
      ) {
        throw new BadRequestException('sales.orders.validation.depositRequired')
      }

      if (
        (targetCode === this.STATUS_CODES.DELIVERED || targetCode === this.STATUS_CODES.CLOSED) &&
        summary.outstanding.greaterThan(0) &&
        !force
      ) {
        throw new BadRequestException('sales.orders.validation.balanceOutstanding')
      }
    })
  }

  async getOrderPaymentSummary(orderId: number): Promise<OrderPaymentSummary> {
    return this.recalculateOrderFinancials(orderId)
  }
}

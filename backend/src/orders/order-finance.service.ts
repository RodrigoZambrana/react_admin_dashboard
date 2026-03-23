import { BadRequestException, Injectable } from '@nestjs/common'
import {
  DepositRequirementType,
  PaymentStatus,
  PaymentType,
  Prisma,
  WorkOrderStatus,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ConfigService } from '@nestjs/config'
import {
  addDecimals,
  decimal,
  divideDecimals,
  multiplyDecimals,
  roundDecimal,
  subtractDecimals,
} from '../common/currency/money.util'
import { findOrderStatusById, ORDER_STATUS_CODES } from '../common/constants/order-statuses'

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
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

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
    return `WO-${orderId.toString().padStart(6, '0')}`
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

    let totalPaidConfirmed = subtractDecimals(
      addDecimals(aggregates.depositConfirmed, aggregates.balanceConfirmed),
      aggregates.refundsConfirmed,
    )

    let outstandingRaw = subtractDecimals(grandTotal, totalPaidConfirmed)
    let outstanding = outstandingRaw.isNegative() ? decimal(0) : outstandingRaw
    let credit = outstandingRaw.isNegative() ? outstandingRaw.abs() : decimal(0)
    const outstandingRounded = roundDecimal(outstanding, 2)
    const isFullySettled = outstandingRounded.lessThanOrEqualTo(decimal(0))

    const isCancelled = order.statusId === ORDER_STATUS_CODES.CANCELLED
    if (isCancelled) {
      aggregates.depositConfirmed = decimal(0)
      aggregates.balanceConfirmed = decimal(0)
      aggregates.refundsConfirmed = decimal(0)
      aggregates.depositPending = decimal(0)
      aggregates.balancePending = decimal(0)
      aggregates.refundsPending = decimal(0)
      totalPaidConfirmed = decimal(0)
      outstanding = decimal(0)
      outstandingRaw = decimal(0)
      credit = decimal(0)
    }

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

    const pendingStatusId = ORDER_STATUS_CODES.PENDING
    const paidStatusId = ORDER_STATUS_CODES.PAID

    const slug = this.config.get<string>('CLIENT_SLUG') || this.config.get<string>('CLIENT') || ''
    const enableWorkOrders = slug.toLowerCase() === 'urucortinas'
    let targetWorkOrderId: number | null = order.workOrders[0]?.id ?? null

    if (depositMet) {
      if (!order.confirmedAt) {
        updateData.confirmedAt = now
      }
      if (enableWorkOrders && !targetWorkOrderId) {
        const existingWorkOrder = await client.workOrder.findFirst({
          where: { orderId: order.id },
          orderBy: { id: 'asc' },
        })

        if (existingWorkOrder) {
          targetWorkOrderId = existingWorkOrder.id
        } else {
          try {
            const workOrder = await client.workOrder.create({
              data: {
                orderId: order.id,
                code: this.generateWorkOrderCode(order.id),
                status: WorkOrderStatus.PENDING,
              },
            })
            targetWorkOrderId = workOrder.id
          } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
              const concurrentWorkOrder = await client.workOrder.findFirst({
                where: { orderId: order.id },
                orderBy: { id: 'asc' },
              })
              if (!concurrentWorkOrder) {
                throw error
              }
              targetWorkOrderId = concurrentWorkOrder.id
            } else {
              throw error
            }
          }
        }
      }
    } else if (order.confirmedAt && order.statusId === paidStatusId) {
      updateData.confirmedAt = null
    }

    const statusCanAdvance = Boolean(
      paidStatusId && (order.statusId === pendingStatusId || order.statusId === null),
    )
    if (isFullySettled && statusCanAdvance) {
      updateData.statusId = paidStatusId
    }

    await client.order.update({
      where: { id: order.id },
      data: updateData,
    })

    if (depositMet && enableWorkOrders && targetWorkOrderId) {
      const existingProduction = await client.productionOrder.findFirst({
        where: { orderId: order.id },
      })
      if (!existingProduction) {
        try {
          await client.productionOrder.create({
            data: {
              orderId: order.id,
              workOrderId: targetWorkOrderId,
              status: WorkOrderStatus.PENDING,
              priority: 1,
            },
          })
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const concurrentProduction = await client.productionOrder.findFirst({
              where: {
                OR: [{ orderId: order.id }, { workOrderId: targetWorkOrderId }],
              },
            })
            if (!concurrentProduction) {
              throw error
            }

            if (concurrentProduction.orderId !== order.id) {
              throw error
            }
          } else {
            throw error
          }
        }
      } else if (existingProduction.workOrderId !== targetWorkOrderId) {
        await client.productionOrder.update({
          where: { id: existingProduction.id },
          data: { workOrderId: targetWorkOrderId },
        })
      }
    }

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
      outstanding: outstandingRounded,
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
      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { statusId: true },
      })
      if (!order) {
        throw new BadRequestException('sales.orders.validation.notFound')
      }

      const summary = await this.recalculateOrderFinancials(orderId, tx)
      const targetStatus = findOrderStatusById(targetStatusId)
      if (!targetStatus) {
        throw new BadRequestException('sales.orders.validation.statusInvalid')
      }

      const currentStatusId = order.statusId ?? null
      const targetCode = targetStatus.id
      if (
        currentStatusId === ORDER_STATUS_CODES.CANCELLED &&
        targetCode !== ORDER_STATUS_CODES.CANCELLED
      ) {
        throw new BadRequestException('sales.orders.validation.cancelledReopenRequiresNewOrder')
      }

      if (
        (targetCode === ORDER_STATUS_CODES.PAID || targetCode === ORDER_STATUS_CODES.DELIVERED) &&
        !summary.depositMet
      ) {
        throw new BadRequestException('sales.orders.validation.depositRequired')
      }

      if (
        targetCode === ORDER_STATUS_CODES.DELIVERED &&
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

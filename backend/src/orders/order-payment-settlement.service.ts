import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { PaymentStatus, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { OrderFinanceService } from './order-finance.service'
import { OrderTimelineService } from './order-timeline.service'
import { NotificationOrchestratorService } from '../notifications/notification-orchestrator.service'
import { findPaymentMethodById, matchPaymentMethod } from '../common/constants/payment-methods'

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient

export type ApplyPaymentSettlementInput = {
  paymentId: number
  previousPaymentStatus?: PaymentStatus | null
}

export type PaymentSettlementDispatchPlan = {
  paymentId: number
  orderId: number
  previousStatusId: number | null
  nextStatusId: number | null
  notifyPaymentReceived: boolean
  notifyOrderStatusChanged: boolean
}

const IMMEDIATE_CHECKOUT_NOTIFICATION_WINDOW_MS = 2 * 60 * 1000

@Injectable()
export class OrderPaymentSettlementService {
  private readonly logger = new Logger(OrderPaymentSettlementService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderFinance: OrderFinanceService,
    private readonly timeline: OrderTimelineService,
    private readonly notifications: NotificationOrchestratorService,
  ) {}

  async apply(
    input: ApplyPaymentSettlementInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PaymentSettlementDispatchPlan> {
    const client = (tx ?? this.prisma) as PrismaClientOrTx
    const payment = await client.payment.findUnique({
      where: { id: input.paymentId },
      select: {
        id: true,
        orderId: true,
        amount: true,
        currency: true,
        status: true,
        method: true,
        paymentMethodId: true,
        type: true,
        date: true,
      },
    })

    if (!payment) {
      throw new BadRequestException('accounting.payments.validation.notFound')
    }

    const orderBefore = await client.order.findUnique({
      where: { id: payment.orderId },
      select: {
        id: true,
        statusId: true,
        orderCurrency: true,
        createdAt: true,
      },
    })

    if (!orderBefore) {
      throw new BadRequestException('sales.orders.validation.notFound')
    }

    const previousStatusId = orderBefore.statusId ?? null
    const summary = await this.orderFinance.recalculateOrderFinancials(payment.orderId, tx)

    const currency = summary.currency ?? payment.currency ?? orderBefore.orderCurrency ?? 'UYU'
    await this.timeline.ensurePaymentWaiting(payment.orderId, summary.outstanding, currency, client)

    const paymentConfirmed = payment.status === PaymentStatus.CONFIRMED
    const becameConfirmed =
      paymentConfirmed && input.previousPaymentStatus !== PaymentStatus.CONFIRMED
    let hasPriorConfirmedPayments = false

    if (becameConfirmed) {
      hasPriorConfirmedPayments =
        (await client.payment.count({
          where: {
            orderId: payment.orderId,
            status: PaymentStatus.CONFIRMED,
            id: { not: payment.id },
          },
        })) > 0
      const now = new Date()
      const captureTimestamp =
        payment.date && !this.isSameCalendarDay(payment.date, now) ? payment.date : now

      await this.timeline.recordPaymentCapture(
        {
          orderId: payment.orderId,
          paymentId: payment.id,
          amount: payment.amount,
          currency,
          paymentMethod: payment.method ?? null,
          remainingOutstanding: summary.outstanding,
          hasPriorConfirmedPayments,
          paymentStatus: payment.status,
          paymentType: payment.type,
          timestamp: captureTimestamp,
        },
        client,
      )
    }

    const orderAfter = await client.order.findUnique({
      where: { id: payment.orderId },
      select: { statusId: true },
    })

    const nextStatusId = orderAfter?.statusId ?? previousStatusId
    const notifyOrderStatusChanged =
      nextStatusId !== previousStatusId && nextStatusId !== null

    const suppressImmediateCheckoutNotifications =
      becameConfirmed &&
      this.isImmediateCheckoutPayment(payment.paymentMethodId, payment.method) &&
      !hasPriorConfirmedPayments &&
      Date.now() - orderBefore.createdAt.getTime() <= IMMEDIATE_CHECKOUT_NOTIFICATION_WINDOW_MS

    if (notifyOrderStatusChanged) {
      await this.timeline.recordStatusTransition(
        {
          orderId: payment.orderId,
          previousStatusId,
          nextStatusId,
          actor: 'system',
          timestamp: new Date(),
          message: 'Order status updated after payment settlement',
          metadata: {
            source: 'payment-settlement',
            paymentId: payment.id,
          },
        },
        client,
      )
    }

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      previousStatusId,
      nextStatusId,
      notifyPaymentReceived: becameConfirmed && !suppressImmediateCheckoutNotifications,
      notifyOrderStatusChanged: notifyOrderStatusChanged && !suppressImmediateCheckoutNotifications,
    }
  }

  async dispatch(plan: PaymentSettlementDispatchPlan): Promise<void> {
    if (plan.notifyPaymentReceived) {
      try {
        await this.notifications.notifyPaymentReceived(plan.paymentId)
      } catch (error) {
        this.logger.error(
          `Failed to dispatch payment received notifications for payment ${plan.paymentId}: ${(error as Error).message}`,
        )
      }
    }

    if (plan.notifyOrderStatusChanged && plan.nextStatusId !== null) {
      try {
        await this.notifications.notifyOrderStatusChanged(
          plan.orderId,
          plan.previousStatusId,
          plan.nextStatusId,
        )
      } catch (error) {
        this.logger.error(
          `Failed to dispatch order status change notifications for order ${plan.orderId}: ${(error as Error).message}`,
        )
      }
    }
  }

  private isSameCalendarDay(a?: Date | null, b?: Date | null) {
    if (!a || !b) {
      return false
    }

    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    )
  }

  private isImmediateCheckoutPayment(paymentMethodId?: number | null, methodName?: string | null) {
    const byId = findPaymentMethodById(paymentMethodId ?? null)
    if (byId) {
      return byId.code === 'mercado_pago'
    }

    const matched = matchPaymentMethod(methodName ?? null)
    return matched?.code === 'mercado_pago'
  }
}

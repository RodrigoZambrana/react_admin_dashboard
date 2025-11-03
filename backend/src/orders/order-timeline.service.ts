import { Injectable, Logger } from '@nestjs/common'
import { Prisma, PaymentStatus, PaymentType, OrderTimelineEvent } from '@prisma/client'
import { randomUUID } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { decimal } from '../common/currency/money.util'
import { findOrderStatusById } from '../common/constants/order-statuses'

type PrismaClientOrTx = PrismaService | Prisma.TransactionClient

export type OrderTimelineEventType =
  | 'ORDER_RECEIVED'
  | 'PAYMENT_WAITING'
  | 'PAYMENT_PARTIAL'
  | 'PAYMENT_FULL'
  | 'ESTIMATE_SET'
  | 'ESTIMATE_UPDATED'
  | 'SHIPPED'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'NOTE'
  | 'STATUS_CHANGED'
  | 'OTHER'

export type OrderTimelineEventRecord = {
  eventId: string
  orderId: number
  type: OrderTimelineEventType | string
  timestamp: string
  actor?: string | null
  amount?: number | null
  currency?: string | null
  paymentMethod?: string | null
  remainingAmount?: number | null
  estimateDate?: string | null
  statusFrom?: string | null
  statusTo?: string | null
  message?: string | null
  metadata?: unknown
}

export type AppendTimelineEventInput = {
  eventId?: string | null
  type: OrderTimelineEventType | string
  timestamp?: Date | string
  actor?: string | null
  amount?: number | string | Prisma.Decimal | null
  currency?: string | null
  paymentMethod?: string | null
  remainingAmount?: number | string | Prisma.Decimal | null
  estimateDate?: Date | string | null
  statusFrom?: string | null
  statusTo?: string | null
  message?: string | null
  metadata?: unknown
}

export type PaymentCaptureContext = {
  orderId: number
  paymentId: number
  amount: Prisma.Decimal
  currency: string
  paymentMethod?: string | null
  remainingOutstanding: Prisma.Decimal
  hasPriorConfirmedPayments: boolean
  paymentStatus: PaymentStatus
  paymentType: PaymentType
  timestamp?: Date
}

export type EstimateSnapshot = {
  estimateDate: Date
  previousEstimate?: Date | null
  actor?: string | null
  message?: string | null
  metadata?: Record<string, unknown> | string | null
  timestamp?: Date
  type?: Extract<OrderTimelineEventType, 'ESTIMATE_SET' | 'ESTIMATE_UPDATED'>
}

export type StatusTransitionSnapshot = {
  orderId: number
  previousStatusId: number | null
  nextStatusId: number | null
  actor?: string | null
  timestamp?: Date
  message?: string | null
  metadata?: Record<string, unknown> | string | null
}

const normalizeStatusCode = (value?: string | null): string => {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const CANCELLED_STATUS_CODES = new Set(['cancelled', 'canceled', 'cancelado', 'cancelada'])

const compareTimelineEvents = (
  a: OrderTimelineEventRecord | OrderTimelineEvent,
  b: OrderTimelineEventRecord | OrderTimelineEvent,
) => {
  const typeA = (a.type || '').toUpperCase()
  const typeB = (b.type || '').toUpperCase()
  const aCancelled = typeA === 'CANCELLED'
  const bCancelled = typeB === 'CANCELLED'
  if (aCancelled && !bCancelled) {
    return 1
  }
  if (!aCancelled && bCancelled) {
    return -1
  }
  const timeA = new Date(a.timestamp || 0).getTime()
  const timeB = new Date(b.timestamp || 0).getTime()
  if (!Number.isFinite(timeA) && Number.isFinite(timeB)) {
    return -1
  }
  if (Number.isFinite(timeA) && !Number.isFinite(timeB)) {
    return 1
  }
  return timeA - timeB
}

@Injectable()
export class OrderTimelineService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly logger = new Logger(OrderTimelineService.name)

  private toDto(event: OrderTimelineEvent) {
    return {
      eventId: event.eventId,
      orderId: event.orderId,
      type: event.type,
      timestamp: event.timestamp.toISOString(),
      actor: event.actor ?? null,
      amount: event.amount ? Number(event.amount.toString()) : null,
      currency: event.currency ?? null,
      paymentMethod: event.paymentMethod ?? null,
      remainingAmount: event.remainingAmount ? Number(event.remainingAmount.toString()) : null,
      estimateDate: event.estimateDate ? event.estimateDate.toISOString() : null,
      statusFrom: event.statusFrom ?? null,
      statusTo: event.statusTo ?? null,
      message: event.message ?? null,
      metadata: event.metadata ?? null,
    } satisfies OrderTimelineEventRecord
  }

  private async persist(
    orderId: number,
    input: AppendTimelineEventInput,
    client?: PrismaClientOrTx,
  ): Promise<OrderTimelineEventRecord> {
    const eventId = input.eventId?.trim() || randomUUID()
    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date()
    const eventType = input.type?.toUpperCase?.() ?? 'OTHER'
    const store = client ?? this.prisma
    const normalizedMetadata =
      input.metadata === undefined
        ? undefined
        : input.metadata === null
          ? Prisma.JsonNull
          : (input.metadata as Prisma.InputJsonValue)
    const data: Prisma.OrderTimelineEventCreateInput = {
      eventId,
      type: eventType,
      timestamp,
      actor: input.actor?.trim() || null,
      order: { connect: { id: orderId } },
      amount:
        input.amount === null || input.amount === undefined
          ? null
          : decimal(input.amount).toFixed(2),
      currency: input.currency?.trim()?.toUpperCase() || null,
      paymentMethod: input.paymentMethod?.trim() || null,
      remainingAmount:
        input.remainingAmount === null || input.remainingAmount === undefined
          ? null
          : decimal(input.remainingAmount).toFixed(2),
      estimateDate: input.estimateDate ? new Date(input.estimateDate) : null,
      statusFrom: input.statusFrom?.trim() || null,
      statusTo: input.statusTo?.trim() || null,
      message: input.message?.trim() || null,
      metadata: normalizedMetadata,
    }

    try {
      const created = await store.orderTimelineEvent.create({ data })
      return this.toDto(created)
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await store.orderTimelineEvent.findUnique({ where: { eventId } })
        if (existing) {
          return this.toDto(existing)
        }
      }
      throw error
    }
  }

  async list(orderId: number): Promise<OrderTimelineEventRecord[]> {
    const events = await this.prisma.orderTimelineEvent.findMany({
      where: { orderId },
      orderBy: [{ timestamp: 'asc' }, { eventId: 'asc' }],
    })
    return events.map((event) => this.toDto(event))
  }

  async ensureOrderReceived(
    orderId: number,
    createdAt: Date,
    actor: string | null = 'system',
    client?: PrismaClientOrTx,
  ) {
    await this.persist(
      orderId,
      {
        eventId: `order:${orderId}:order_received`,
        type: 'ORDER_RECEIVED',
        timestamp: createdAt,
        actor,
        message: 'Order received',
      },
      client,
    )
  }

  async ensurePaymentWaiting(
    orderId: number,
    outstanding: Prisma.Decimal,
    currency: string,
    client?: PrismaClientOrTx,
    timestamp: Date = new Date(),
  ) {
    if (decimal(outstanding).lessThanOrEqualTo(0)) {
      return
    }
    await this.persist(
      orderId,
      {
        eventId: `order:${orderId}:payment_waiting`,
        type: 'PAYMENT_WAITING',
        timestamp,
        actor: 'system',
        remainingAmount: outstanding,
        currency,
        message: 'Waiting for payment',
      },
      client,
    )
  }

  async recordPaymentCapture(
    context: PaymentCaptureContext,
    client?: PrismaClientOrTx,
  ): Promise<{ partial?: OrderTimelineEventRecord; full?: OrderTimelineEventRecord }> {
    const store = client ?? this.prisma
    const remaining = decimal(context.remainingOutstanding)
    const isConfirmed = context.paymentStatus === PaymentStatus.CONFIRMED
    const timestamp = context.timestamp ?? new Date()
    const remainingClamped = remaining.lessThan(0) ? decimal(0) : remaining

    let partialEvent: OrderTimelineEventRecord | undefined
    const shouldSkipPartial = isConfirmed && remaining.lessThanOrEqualTo(0)

    if (!shouldSkipPartial) {
      partialEvent = await this.persist(
        context.orderId,
        {
          eventId: `order:${context.orderId}:payment:${context.paymentId}:partial`,
          type: 'PAYMENT_PARTIAL',
          timestamp,
          actor: 'provider:system',
          amount: context.amount,
          currency: context.currency,
          paymentMethod: context.paymentMethod ?? null,
          remainingAmount: remainingClamped,
          message: 'Partial payment received',
          metadata: {
            paymentId: context.paymentId,
            paymentType: context.paymentType,
            paymentStatus: context.paymentStatus,
          },
        },
        store,
      )
    }

    let fullEvent: OrderTimelineEventRecord | undefined
    if (isConfirmed && remaining.lessThanOrEqualTo(0)) {
      fullEvent = await this.persist(
        context.orderId,
        {
          eventId: `order:${context.orderId}:payment:${context.paymentId}:full`,
          type: 'PAYMENT_FULL',
          timestamp,
          actor: 'provider:system',
          amount: context.amount,
          currency: context.currency,
          paymentMethod: context.paymentMethod ?? null,
          remainingAmount: decimal(0),
          message: 'Payment complete',
          metadata: {
            paymentId: context.paymentId,
            paymentType: context.paymentType,
            paymentStatus: context.paymentStatus,
          },
        },
        store,
      )
    }

    return { partial: partialEvent, full: fullEvent }
  }

  async recordEstimateSnapshot(
    orderId: number,
    snapshot: EstimateSnapshot,
    client?: PrismaClientOrTx,
  ) {
    const store = client ?? this.prisma
    const eventType = snapshot.type ?? (snapshot.previousEstimate ? 'ESTIMATE_UPDATED' : 'ESTIMATE_SET')
    const eventIdBase =
      eventType === 'ESTIMATE_SET'
        ? `order:${orderId}:estimate:set:${snapshot.estimateDate.toISOString()}`
        : `order:${orderId}:estimate:update:${snapshot.estimateDate.toISOString()}`

    const estimateDate = new Date(snapshot.estimateDate)
    const recordedAt = snapshot.timestamp ? new Date(snapshot.timestamp) : new Date()

    const metadataBase: Record<string, unknown> =
      snapshot.metadata && typeof snapshot.metadata === 'object' && !Array.isArray(snapshot.metadata)
        ? { ...(snapshot.metadata as Record<string, unknown>) }
        : snapshot.previousEstimate
          ? {
              previousEstimate: snapshot.previousEstimate.toISOString(),
              nextEstimate: estimateDate.toISOString(),
            }
          : {
              estimate: estimateDate.toISOString(),
            }
    metadataBase.recordedAt = recordedAt.toISOString()
    const metadata = Object.keys(metadataBase).length ? metadataBase : undefined

    await this.persist(
      orderId,
      {
        eventId: eventIdBase,
        type: eventType,
        timestamp: estimateDate,
        actor: snapshot.actor ?? 'system',
        estimateDate,
        message: snapshot.message ?? null,
        metadata,
      },
      store,
    )
  }

  async recordStatusTransition(
    snapshot: StatusTransitionSnapshot,
    client?: PrismaClientOrTx,
  ) {
    const store = client ?? this.prisma
    const previous = findOrderStatusById(snapshot.previousStatusId ?? null)
    const next = findOrderStatusById(snapshot.nextStatusId ?? null)
    const timestamp = snapshot.timestamp ?? new Date()

    await this.persist(
      snapshot.orderId,
      {
        eventId: `order:${snapshot.orderId}:status:${snapshot.nextStatusId ?? 'unknown'}:${timestamp.toISOString()}`,
        type: 'STATUS_CHANGED',
        timestamp,
        actor: snapshot.actor ?? 'system',
        statusFrom: previous?.code ?? previous?.label ?? null,
        statusTo: next?.code ?? next?.label ?? null,
        message:
          snapshot.message ??
          `Status changed from ${previous?.label ?? previous?.code ?? 'unknown'} to ${next?.label ?? next?.code ?? 'unknown'}`,
        metadata: snapshot.metadata ?? {
          previousStatusId: snapshot.previousStatusId,
          nextStatusId: snapshot.nextStatusId,
        },
      },
      store,
    )

    if (next?.code === 'delivered') {
      await this.persist(
        snapshot.orderId,
        {
          eventId: `order:${snapshot.orderId}:delivered`,
          type: 'DELIVERED',
          timestamp,
          actor: snapshot.actor ?? 'carrier:system',
          message: 'Delivered',
        },
        store,
      )
    }
  }

  async appendNote(
    orderId: number,
    input: AppendTimelineEventInput,
    client?: PrismaClientOrTx,
  ): Promise<OrderTimelineEventRecord> {
    if (!input.type) {
      throw new Error('Timeline event type is required')
    }
    return this.persist(orderId, input, client)
  }

  async getOrderTimeline(orderId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
        },
      },
    })
    if (!order) {
      return null
    }
    const baseEvents = await this.list(orderId)
    const mergedEvents = this.mergeSyntheticEvents(order, baseEvents)
    return {
      order: {
        id: order.id,
        documentType: order.documentType,
        customerId: order.customerId,
        statusId: order.statusId,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        date: order.date,
        grandTotal: order.grandTotal,
        orderCurrency: order.orderCurrency,
        estimatedMin: order.estimatedMin,
        estimatedMax: order.estimatedMax,
      },
      events: mergedEvents,
    }
  }

  private mergeSyntheticEvents(
    order: Prisma.OrderGetPayload<{ include: { payments: true } }>,
    existing: OrderTimelineEventRecord[],
  ): OrderTimelineEventRecord[] {
    const events: OrderTimelineEventRecord[] = [...existing]
    const eventIds = new Set(events.map((event) => event.eventId))
    const orderTotal = decimal(order.grandTotal ?? 0)
    let confirmedTotal = decimal(0)
    const paymentEventsAdded: OrderTimelineEventRecord[] = []
    const existingByPayment = new Map<
      number,
      { partial: boolean; full: boolean }
    >()

    for (const event of events) {
      if (!event.metadata || typeof event.metadata !== 'object') {
        continue
      }
      const metadata = event.metadata as Record<string, unknown>
      const paymentIdRaw = metadata.paymentId
      if (typeof paymentIdRaw !== 'number') {
        continue
      }
      const paymentId = paymentIdRaw
      const entry = existingByPayment.get(paymentId) ?? { partial: false, full: false }
      const normalizedType = (event.type || '').toUpperCase()
      if (normalizedType === 'PAYMENT_PARTIAL') {
        entry.partial = true
      } else if (normalizedType === 'PAYMENT_FULL') {
        entry.full = true
      }
      existingByPayment.set(paymentId, entry)
    }

    for (const payment of order.payments ?? []) {
      if (payment.status !== PaymentStatus.CONFIRMED) {
        continue
      }
      const amount = decimal(payment.amount)
      confirmedTotal = confirmedTotal.plus(amount)
      const remaining = orderTotal.minus(confirmedTotal)
      const normalizedRemaining = remaining.lessThan(0) ? decimal(0) : remaining
      const isFull = normalizedRemaining.lessThanOrEqualTo(0)
      const eventType: OrderTimelineEventType = isFull ? 'PAYMENT_FULL' : 'PAYMENT_PARTIAL'
      const eventId = `order:${order.id}:payment:${payment.id}:${isFull ? 'full' : 'partial'}:synthetic`
      const existingForPayment = existingByPayment.get(payment.id) ?? { partial: false, full: false }
      const alreadyRecorded =
        (eventType === 'PAYMENT_FULL' && existingForPayment.full) ||
        (eventType === 'PAYMENT_PARTIAL' && existingForPayment.partial)
      if (alreadyRecorded) {
        continue
      }
      if (eventIds.has(eventId)) {
        continue
      }
      eventIds.add(eventId)
      const syntheticEvent: OrderTimelineEventRecord = {
        eventId,
        orderId: order.id,
        type: eventType,
        timestamp: payment.date.toISOString(),
        actor: payment.method ? `provider:${payment.method}` : null,
        amount: Number(amount.toFixed(2)),
        currency: payment.currency,
        paymentMethod: payment.method ?? null,
        remainingAmount: Number(normalizedRemaining.toFixed(2)),
        estimateDate: null,
        statusFrom: null,
        statusTo: null,
        message: null,
        metadata: {
          paymentId: payment.id,
          paymentStatus: payment.status,
          synthetic: true,
        },
      }

      if (eventType === 'PAYMENT_FULL') {
        existingForPayment.full = true
      } else {
        existingForPayment.partial = true
      }
      existingByPayment.set(payment.id, existingForPayment)

      paymentEventsAdded.push(syntheticEvent)
    }

    if (paymentEventsAdded.length) {
      // Remove synthetic waiting event (fallback) when real payments are available
      const filtered = events.filter((event) => {
        if (event.type !== 'PAYMENT_WAITING') {
          return true
        }
        if (!event.metadata || typeof event.metadata !== 'object') {
          return true
        }
        const metadata = event.metadata as Record<string, unknown>
        return metadata.synthetic !== true
      })
      filtered.push(...paymentEventsAdded)
      events.splice(0, events.length, ...filtered)
    }

    const hasPaymentEvents = events.some((event) => {
      const type = (event.type || '').toUpperCase()
      return type === 'PAYMENT_WAITING' || type === 'PAYMENT_PARTIAL' || type === 'PAYMENT_FULL'
    })

    if (!hasPaymentEvents && orderTotal.greaterThan(0)) {
      const outstanding = orderTotal.minus(confirmedTotal)
      if (outstanding.greaterThan(0.01)) {
        const waitingEventId = `synthetic:order:${order.id}:payment_waiting`
        if (!eventIds.has(waitingEventId)) {
          eventIds.add(waitingEventId)
          events.push({
            eventId: waitingEventId,
            orderId: order.id,
            type: 'PAYMENT_WAITING',
            timestamp: (order.updatedAt ?? order.createdAt).toISOString(),
            actor: 'system',
            amount: null,
            currency: order.orderCurrency,
            paymentMethod: null,
            remainingAmount: Number(outstanding.toFixed(2)),
            estimateDate: null,
            statusFrom: null,
            statusTo: null,
            message: 'Waiting for payment',
            metadata: { synthetic: true },
          })
        }
      }
    }

    const cancellationEvents: OrderTimelineEventRecord[] = []
    for (const event of events) {
      if ((event.type || '').toUpperCase() !== 'STATUS_CHANGED') {
        continue
      }
      const statusTo = normalizeStatusCode(event.statusTo)
      if (!CANCELLED_STATUS_CODES.has(statusTo)) {
        continue
      }
      const cancellationId = `${event.eventId}:cancelled`
      if (eventIds.has(cancellationId)) {
        continue
      }
      eventIds.add(cancellationId)
      let metadata: Record<string, unknown> | undefined
      if (event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)) {
        metadata = { ...(event.metadata as Record<string, unknown>) }
      } else if (event.metadata !== null && event.metadata !== undefined) {
        metadata = { originalMetadata: event.metadata }
      }
      metadata = metadata ?? {}
      metadata.source = (metadata.source as string | undefined) ?? 'status-transition'
      metadata.statusFrom = event.statusFrom ?? metadata.statusFrom ?? null
      metadata.statusTo = event.statusTo ?? metadata.statusTo ?? null
      metadata.statusToNormalized = statusTo
      cancellationEvents.push({
        eventId: cancellationId,
        orderId: event.orderId,
        type: 'CANCELLED',
        timestamp: event.timestamp,
        actor: event.actor ?? 'system',
        amount: null,
        currency: null,
        paymentMethod: null,
        remainingAmount: null,
        estimateDate: null,
        statusFrom: event.statusFrom ?? null,
        statusTo: event.statusTo ?? null,
        message: null,
        metadata,
      })
    }
    if (cancellationEvents.length) {
      events.push(...cancellationEvents)
    }

    const statusFiltered = events.filter(
      (event) => (event.type || '').toUpperCase() !== 'STATUS_CHANGED',
    )
    if (statusFiltered.length !== events.length) {
      events.splice(0, events.length, ...statusFiltered)
    }

    const estimateTypes = new Set<OrderTimelineEventType>(['ESTIMATE_SET', 'ESTIMATE_UPDATED'])
    const deliveredEvent =
      events
        .filter((event) => event.type === 'DELIVERED')
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .pop() ?? null

    if (deliveredEvent) {
      const parseDate = (value?: string | null): Date | null => {
        if (!value) {
          return null
        }
        const date = new Date(value)
        return Number.isNaN(date.getTime()) ? null : date
      }

      const estimateEvents = events
        .filter((event) => estimateTypes.has(event.type as OrderTimelineEventType))
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      const latestEstimate = estimateEvents.length ? estimateEvents[estimateEvents.length - 1] : null

      let result = events.slice()
      if (latestEstimate) {
        const deliveredDate =
          parseDate(deliveredEvent.timestamp) ??
          parseDate(deliveredEvent.estimateDate) ??
          parseDate(latestEstimate.estimateDate) ??
          parseDate(latestEstimate.timestamp) ??
          new Date()
        const completedIso = deliveredDate.toISOString()
        const metadata =
          latestEstimate.metadata && typeof latestEstimate.metadata === 'object' && !Array.isArray(latestEstimate.metadata)
            ? { ...(latestEstimate.metadata as Record<string, unknown>) }
            : {}
        metadata.completed = true
        metadata.completedAt = completedIso
        metadata.completedBy = deliveredEvent.actor ?? 'system'
        metadata.completionSource = deliveredEvent.eventId

        result = result.map((event) => {
          if (event.eventId !== latestEstimate.eventId) {
            return event
          }
          return {
            ...event,
            timestamp: completedIso,
            estimateDate: completedIso,
            metadata,
          }
        })
      }

      return result.sort(compareTimelineEvents)
    }

    return events.slice().sort(compareTimelineEvents)
  }
}

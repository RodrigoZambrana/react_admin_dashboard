import { useMemo } from 'react'
import classNames from 'classnames'
import Timeline from '@/components/ui/Timeline'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Tag from '@/components/ui/Tag'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import type { OrderTimelineEvent, OrderTimelineResponse } from '@/types/orderTimeline'

type ActivityProps = {
    timeline?: OrderTimelineResponse | null
    loading?: boolean
    error?: string | null
}

type DisplayEvent = {
    id: string
    event: OrderTimelineEvent
    label: string
    description?: string | null
    badgeClassName: string
    timestampLabel: string
    isEnd: boolean
    completed?: boolean
}

type PaymentSummary = {
    state: 'waiting' | 'partial' | 'full'
    label: string
    detail?: string
    tagClassName: string
}

type DeliverySummary = {
    state: 'delivered' | 'estimated' | 'unknown'
    label: string
    detail?: string
    tagClassName: string
}

type ComputedTimeline = {
    events: DisplayEvent[]
    payment?: PaymentSummary
    delivery?: DeliverySummary
}

const DEFAULT_EVENT_LABELS: Record<string, string> = {
    ORDER_RECEIVED: 'Order received',
    PAYMENT_WAITING: 'Waiting for payment',
    PAYMENT_PARTIAL: 'Partial payment received',
    PAYMENT_FULL: 'Payment received',
    PAYMENT_FULL_SUMMARY: 'Payment complete',
    ESTIMATE_SET: 'Estimated delivery date set',
    ESTIMATE_UPDATED: 'Estimated delivery date updated',
    SHIPPED: 'Shipped',
    IN_TRANSIT: 'In transit',
    OUT_FOR_DELIVERY: 'Out for delivery',
    DELIVERED: 'Delivered',
    CANCELLED: 'Order cancelled',
    STATUS_CHANGED: 'Status changed',
    NOTE: 'Note added',
    OTHER: 'Activity',
}

const EVENT_BADGE_COLORS: Record<string, string> = {
    ORDER_RECEIVED: 'bg-blue-500',
    PAYMENT_WAITING: 'bg-amber-500',
    PAYMENT_PARTIAL: 'bg-indigo-500',
    PAYMENT_FULL: 'bg-emerald-500',
    ESTIMATE_SET: 'bg-sky-500',
    ESTIMATE_UPDATED: 'bg-sky-500',
    SHIPPED: 'bg-blue-500',
    IN_TRANSIT: 'bg-blue-500',
    OUT_FOR_DELIVERY: 'bg-blue-500',
    DELIVERED: 'bg-emerald-600',
    CANCELLED: 'bg-red-500',
    STATUS_CHANGED: 'bg-slate-500',
    NOTE: 'bg-slate-400',
    OTHER: 'bg-slate-400',
}

const PAYMENT_STATE_META: Record<
    PaymentSummary['state'],
    { labelKey: string; defaultLabel: string; tagClassName: string }
> = {
    waiting: {
        labelKey: 'sales.orderDetails.timeline.payment.waiting',
        defaultLabel: 'Waiting for payment',
        tagClassName: 'bg-amber-100 text-amber-700 border border-amber-200',
    },
    partial: {
        labelKey: 'sales.orderDetails.timeline.payment.partial',
        defaultLabel: 'Partial payment received',
        tagClassName: 'bg-sky-100 text-sky-700 border border-sky-200',
    },
    full: {
        labelKey: 'sales.orderDetails.timeline.payment.full',
        defaultLabel: 'Paid in full',
        tagClassName: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    },
}

const DELIVERY_STATE_META: Record<
    DeliverySummary['state'],
    { labelKey: string; defaultLabel: string; tagClassName: string }
> = {
    delivered: {
        labelKey: 'sales.orderDetails.timeline.delivery.deliveredShort',
        defaultLabel: 'Delivered',
        tagClassName: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    },
    estimated: {
        labelKey: 'sales.orderDetails.timeline.delivery.estimatedShort',
        defaultLabel: 'Estimated delivery',
        tagClassName: 'bg-sky-100 text-sky-700 border border-sky-200',
    },
    unknown: {
        labelKey: 'sales.orderDetails.timeline.delivery.pendingShort',
        defaultLabel: 'No delivery estimate',
        tagClassName: 'bg-slate-100 text-slate-600 border border-slate-200',
    },
}

const formatDateTime = (value?: string | null) => {
    if (!value) {
        return '--'
    }
    const date = dayjs(value)
    return date.isValid() ? date.format('DD MMM YYYY HH:mm') : '--'
}

const formatDateOnly = (value?: string | null) => {
    if (!value) {
        return null
    }
    const date = dayjs(value)
    return date.isValid() ? date.format('DD MMM YYYY') : null
}

const formatAmount = (
    amount?: number | null,
    currency?: string | null,
    fallbackCurrency?: string | null,
) => {
    if (amount === null || amount === undefined || Number.isNaN(amount)) {
        return null
    }
    const code = (currency || fallbackCurrency || 'USD').toUpperCase()
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency: code,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount)
    } catch {
        return amount.toFixed(2)
    }
}

const sanitizeDays = (value?: number | null) => {
    if (value === null || value === undefined) {
        return null
    }
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
        return null
    }
    return Math.max(0, Math.round(numeric))
}

const getEventMetadata = (event: OrderTimelineEvent): Record<string, unknown> => {
    if (!event.metadata || typeof event.metadata !== 'object' || Array.isArray(event.metadata)) {
        return {}
    }
    return event.metadata as Record<string, unknown>
}

const computeOrderEstimate = (order?: OrderTimelineResponse['order']) => {
    if (!order) {
        return null
    }
    const minDays = sanitizeDays(order.estimatedMin)
    const maxDays = sanitizeDays(order.estimatedMax)
    if (minDays === null && maxDays === null) {
        return null
    }
    const anchor = dayjs(order.date ?? order.createdAt)
    if (!anchor.isValid()) {
        return null
    }
    const offset = maxDays ?? minDays ?? 0
    return {
        estimateDate: anchor.add(offset, 'day'),
        minDays,
        maxDays,
    }
}

const buildPaymentSummary = (
    order: OrderTimelineResponse['order'] | undefined,
    events: OrderTimelineEvent[],
    translate: (key: string, options: { defaultValue: string; [key: string]: unknown }) => string,
): PaymentSummary | undefined => {
    if (!order) {
        return undefined
    }
    const total = Number(order.grandTotal ?? 0)
    let currency = order.orderCurrency ?? null
    let remaining = total

    for (const event of events) {
        const type = (event.type || '').toUpperCase()
        if (!currency && event.currency) {
            currency = event.currency
        }
        if (type === 'PAYMENT_WAITING' && typeof event.remainingAmount === 'number') {
            remaining = event.remainingAmount
        }
        if (
            (type === 'PAYMENT_PARTIAL' || type === 'PAYMENT_FULL') &&
            typeof event.remainingAmount === 'number'
        ) {
            remaining = event.remainingAmount
        } else if (
            (type === 'PAYMENT_PARTIAL' || type === 'PAYMENT_FULL') &&
            typeof event.amount === 'number'
        ) {
            remaining = Math.max(0, remaining - event.amount)
        }
    }

    const paid = Math.max(0, total - remaining)
    const normalizedRemaining = Math.max(0, remaining)
    const isPaid = total > 0 ? normalizedRemaining <= 0.01 : paid > 0

    let state: PaymentSummary['state'] = 'waiting'
    if (total <= 0 || isPaid) {
        state = 'full'
    } else if (paid > 0) {
        state = 'partial'
    }

    const meta = PAYMENT_STATE_META[state]
    const label = translate(meta.labelKey, { defaultValue: meta.defaultLabel })

    let detail: string | undefined
    if (state === 'partial') {
        detail = translate('sales.orderDetails.timeline.payment.partialDetail', {
            defaultValue: 'Paid {paid} of {total} ({remaining} remaining)',
            paid: formatAmount(total - normalizedRemaining, currency, order.orderCurrency) ?? '',
            total: formatAmount(total, currency, order.orderCurrency) ?? '',
            remaining:
                formatAmount(normalizedRemaining, currency, order.orderCurrency) ?? '',
        })
    } else if (state === 'full' && total > 0) {
        detail = translate('sales.orderDetails.timeline.payment.fullDetail', {
            defaultValue: 'Total paid {total}',
            total: formatAmount(total, currency, order.orderCurrency) ?? '',
        })
    }

    return {
        state,
        label,
        detail,
        tagClassName: meta.tagClassName,
    }
}

const buildDeliverySummary = (
    order: OrderTimelineResponse['order'] | undefined,
    deliveredEvent: OrderTimelineEvent | null,
    estimateEvent: OrderTimelineEvent | null,
    translate: (key: string, options: { defaultValue: string; [key: string]: unknown }) => string,
): DeliverySummary | undefined => {
    if (!order) {
        return undefined
    }

    let state: DeliverySummary['state'] = 'unknown'
    let dateLabel: string | null = null

    if (deliveredEvent) {
        const dateSource = deliveredEvent.timestamp ?? deliveredEvent.estimateDate ?? null
        dateLabel = formatDateOnly(dateSource)
        state = 'delivered'
    } else if (estimateEvent) {
        const dateSource = estimateEvent.estimateDate ?? estimateEvent.timestamp ?? null
        dateLabel = formatDateOnly(dateSource)
        state = dateLabel ? 'estimated' : 'unknown'
    } else {
        const computed = computeOrderEstimate(order)
        if (computed) {
            dateLabel = computed.estimateDate.format('DD MMM YYYY')
            state = 'estimated'
        }
    }

    const meta = DELIVERY_STATE_META[state]
    let label = translate(meta.labelKey, { defaultValue: meta.defaultLabel })
    if (state === 'delivered' && dateLabel) {
        label = translate('sales.orderDetails.timeline.delivery.deliveredOn', {
            defaultValue: `Delivered on ${dateLabel}`,
            date: dateLabel,
        })
    } else if (state === 'estimated' && dateLabel) {
        label = translate('sales.orderDetails.timeline.delivery.estimatedOn', {
            defaultValue: `Estimated delivery ${dateLabel}`,
            date: dateLabel,
        })
    }

    return {
        state,
        label,
        detail: dateLabel ?? undefined,
        tagClassName: meta.tagClassName,
    }
}

const getEventDescription = (
    event: OrderTimelineEvent,
    order: OrderTimelineResponse['order'] | undefined,
    translate: (key: string, options: { defaultValue: string; [key: string]: unknown }) => string,
) => {
    const metadata = getEventMetadata(event)
    const type = (event.type || '').toUpperCase()
    const currency = event.currency ?? order?.orderCurrency ?? null

    if (type === 'PAYMENT_WAITING' && typeof event.remainingAmount === 'number') {
        const amountLabel = formatAmount(event.remainingAmount, currency, order?.orderCurrency)
        return translate('sales.orderDetails.timeline.payment.waitingDetail', {
            defaultValue: 'Outstanding balance {amount}',
            amount: amountLabel ?? '',
        })
    }

    if (type === 'PAYMENT_PARTIAL' || type === 'PAYMENT_FULL') {
        const amountLabel = formatAmount(event.amount, currency, order?.orderCurrency)
        const remainingLabel =
            typeof event.remainingAmount === 'number'
                ? formatAmount(event.remainingAmount, currency, order?.orderCurrency)
                : null
        if (type === 'PAYMENT_PARTIAL') {
            if (!amountLabel) {
                return undefined
            }
            const suffix = remainingLabel
                ? translate('sales.orderDetails.timeline.payment.partialRemainingSuffix', {
                      defaultValue: ' ({remaining} remaining)',
                      remaining: remainingLabel,
                  })
                : ''
            return `${amountLabel}${suffix}`
        }
        if (!amountLabel) {
            return undefined
        }
        const balance =
            remainingLabel ??
            formatAmount(0, currency, order?.orderCurrency) ??
            '0.00'
        return translate('sales.orderDetails.timeline.payment.fullAmountDetail', {
            defaultValue: '{amount} (balance {remaining})',
            amount: amountLabel,
            remaining: balance,
        })
    }

    if (type === 'PAYMENT_FULL_SUMMARY') {
        return translate('sales.orderDetails.timeline.payment.fullSummary', {
            defaultValue: 'Payment complete',
        })
    }

    if (type === 'ESTIMATE_SET' || type === 'ESTIMATE_UPDATED') {
        const isCompleted = metadata.completed === true
        if (isCompleted) {
            const completedLabel =
                typeof metadata.completedAt === 'string'
                    ? formatDateOnly(metadata.completedAt)
                    : null
            const fallbackLabel =
                formatDateOnly(event.estimateDate ?? null) ??
                formatDateOnly(event.timestamp ?? null) ??
                ''
            const label = completedLabel ?? fallbackLabel
            return translate('sales.orderDetails.timeline.delivery.estimateCompletedDetail', {
                defaultValue: label ? `Delivery completed ${label}` : 'Delivery completed',
                date: label,
            })
        }

        const dateLabel =
            formatDateOnly(event.estimateDate ?? null) ??
            formatDateOnly(event.timestamp ?? null)
        if (type === 'ESTIMATE_UPDATED') {
            const previous =
                typeof metadata.previousEstimate === 'string'
                    ? metadata.previousEstimate
                    : null
            const previousLabel = formatDateOnly(
                typeof previous === 'string' ? previous : undefined,
            )
            if (previousLabel) {
                return translate(
                    'sales.orderDetails.timeline.delivery.estimateUpdatedDetailWithPrevious',
                    {
                        defaultValue: 'New estimate {next} (previously {previous})',
                        next: dateLabel ?? '',
                        previous: previousLabel,
                    },
                )
            }
            return translate(
                'sales.orderDetails.timeline.delivery.estimateUpdatedDetail',
                {
                    defaultValue: 'New estimate {next}',
                    next: dateLabel ?? '',
                },
            )
        }
        return translate('sales.orderDetails.timeline.delivery.estimateSetDetail', {
            defaultValue: 'Estimated delivery {date}',
            date: dateLabel ?? '',
        })
    }

    if (type === 'DELIVERED') {
        const dateLabel =
            formatDateOnly(event.timestamp ?? null) ??
            formatDateOnly(event.estimateDate ?? null)
        return translate('sales.orderDetails.timeline.delivery.deliveredDetail', {
            defaultValue: dateLabel ? `Delivered on ${dateLabel}` : 'Delivered',
            date: dateLabel ?? '',
        })
    }

    if (type === 'STATUS_CHANGED') {
        return translate('sales.orderDetails.timeline.statusChangedDetail', {
            defaultValue: 'Status changed to {status}',
            status: event.statusTo ?? '',
        })
    }

    if (event.message) {
        return event.message
    }

    return undefined
}

const dedupeByEventId = (events: OrderTimelineEvent[]) => {
    const seen = new Set<string>()
    const result: OrderTimelineEvent[] = []
    for (const event of events) {
        if (seen.has(event.eventId)) {
            continue
        }
        seen.add(event.eventId)
        result.push(event)
    }
    return result
}

const compareTimelineEvents = (a: OrderTimelineEvent, b: OrderTimelineEvent) => {
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
    const timeA = dayjs(a.estimateDate ?? a.timestamp).valueOf()
    const timeB = dayjs(b.estimateDate ?? b.timestamp).valueOf()
    return timeA - timeB
}

const buildTimelineSummary = (
    timeline: OrderTimelineResponse | null | undefined,
    translate: (key: string, options: { defaultValue: string; [key: string]: unknown }) => string,
): ComputedTimeline => {
    if (!timeline) {
        return { events: [] }
    }

    const order = timeline.order
    const sorted = timeline.events.slice().sort(compareTimelineEvents)

    let startEvent =
        sorted.find((event) => (event.type || '').toUpperCase() === 'ORDER_RECEIVED') ?? null
    if (!startEvent) {
        startEvent = {
            eventId: `synthetic:order_received:${order.id}`,
            orderId: order.id,
            type: 'ORDER_RECEIVED',
            timestamp: order.createdAt,
            actor: 'system',
            message: 'Order received',
        }
        sorted.unshift(startEvent)
    }

    const deliveredEvent =
        sorted
            .filter((event) => (event.type || '').toUpperCase() === 'DELIVERED')
            .sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf())
            .pop() ?? null

    const cancelledEvent =
        sorted
            .filter((event) => (event.type || '').toUpperCase() === 'CANCELLED')
            .sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf())
            .pop() ?? null

    const estimateEventsSorted = sorted
        .filter((event) => {
            const type = (event.type || '').toUpperCase()
            return type === 'ESTIMATE_SET' || type === 'ESTIMATE_UPDATED'
        })
        .sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf())

    let earliestEstimate =
        estimateEventsSorted.length > 0 ? estimateEventsSorted[0] : null
    let latestEstimate =
        estimateEventsSorted.length > 0
            ? estimateEventsSorted[estimateEventsSorted.length - 1]
            : null

    if (!latestEstimate) {
        const computed = computeOrderEstimate(order)
        if (computed) {
            const fallbackTimestampSource =
                order.updatedAt ?? order.createdAt ?? order.date
            const syntheticTimestamp = dayjs(fallbackTimestampSource).isValid()
                ? dayjs(fallbackTimestampSource).toISOString()
                : computed.estimateDate.toISOString()
            const syntheticEstimate = {
                eventId: `synthetic:estimate:${order.id}`,
                orderId: order.id,
                type: 'ESTIMATE_SET',
                timestamp: syntheticTimestamp,
                actor: 'system',
                estimateDate: computed.estimateDate.toISOString(),
                metadata: {
                    estimatedMinDays: computed.minDays ?? undefined,
                    estimatedMaxDays: computed.maxDays ?? undefined,
                },
                message: 'Estimated delivery date set',
            }
            sorted.push(syntheticEstimate)
            earliestEstimate = syntheticEstimate
            latestEstimate = syntheticEstimate
        }
    }

    let normalizedEvents = dedupeByEventId(sorted).sort(compareTimelineEvents)
    const hasCancelledEvent = normalizedEvents.some(
        (event) => (event.type || '').toUpperCase() === 'CANCELLED',
    )
    if (!hasCancelledEvent) {
        const statusChangeToCancelled = normalizedEvents.find((event) => {
            const normalizedType = (event.type || '').toUpperCase()
            if (normalizedType !== 'STATUS_CHANGED') {
                return false
            }
            const statusTo = `${event.statusTo ?? ''}`.toLowerCase()
            return statusTo.includes('cancel')
        })
        if (statusChangeToCancelled) {
            normalizedEvents = normalizedEvents.concat({
                ...statusChangeToCancelled,
                eventId: `${statusChangeToCancelled.eventId}:cancelled-fallback`,
                type: 'CANCELLED',
            })
        }
    }
    normalizedEvents = normalizedEvents.sort(compareTimelineEvents)

    const cleanedEvents = normalizedEvents.filter(
        (event) => (event.type || '').toUpperCase() !== 'STATUS_CHANGED',
    )

    const estimateEventForSummary = latestEstimate ?? earliestEstimate ?? null

    const endEvent = cancelledEvent ?? deliveredEvent ?? estimateEventForSummary ?? startEvent

    const payment = buildPaymentSummary(order, normalizedEvents, translate)
    const delivery = buildDeliverySummary(
        order,
        deliveredEvent,
        estimateEventForSummary,
        translate,
    )

    const displayEvents: DisplayEvent[] = cleanedEvents.map((event) => {
        const normalizedType = (event.type || '').toUpperCase()
        const fallbackLabel =
            DEFAULT_EVENT_LABELS[normalizedType] ??
            normalizedType
                .toLowerCase()
                .split('_')
                .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
                .join(' ')
        const label = translate(
            `sales.orderDetails.timeline.event.${normalizedType.toLowerCase()}`,
            { defaultValue: fallbackLabel },
        )
        const metadata = getEventMetadata(event)
        const description = getEventDescription(event, order, translate)
        const isEstimateEvent = normalizedType === 'ESTIMATE_SET' || normalizedType === 'ESTIMATE_UPDATED'
        const isCompleted = isEstimateEvent && metadata.completed === true
        const badgeClassName = isCompleted
            ? 'bg-emerald-600'
            : EVENT_BADGE_COLORS[(event.type || '').toUpperCase()] ?? 'bg-slate-400'
        const timestampSource = event.estimateDate ?? event.timestamp
        return {
            id: event.eventId,
            event,
            label,
            description,
            badgeClassName,
            timestampLabel: formatDateTime(timestampSource),
            isEnd: event.eventId === endEvent?.eventId,
            completed: isCompleted,
        }
    })

    return {
        events: displayEvents,
        payment,
        delivery,
    }
}

const Activity = ({ timeline, loading = false, error = null }: ActivityProps) => {
    const { t } = useTranslation()

    const summary = useMemo(
        () => buildTimelineSummary(timeline ?? null, t),
        [timeline, t],
    )

    const orderedEvents = useMemo(() => {
        return summary.events.slice().sort((a, b) => {
            const aCancelled = (a.event.type || '').toUpperCase() === 'CANCELLED'
            const bCancelled = (b.event.type || '').toUpperCase() === 'CANCELLED'
            if (aCancelled && !bCancelled) {
                return -1
            }
            if (!aCancelled && bCancelled) {
                return 1
            }
            const aDelivered =
                (a.event.type || '').toUpperCase() === 'DELIVERED'
            const bDelivered =
                (b.event.type || '').toUpperCase() === 'DELIVERED'
            if (aDelivered && !bDelivered) {
                return -1
            }
            if (!aDelivered && bDelivered) {
                return 1
            }
            return (
                dayjs(b.event.estimateDate ?? b.event.timestamp).valueOf() -
                dayjs(a.event.estimateDate ?? a.event.timestamp).valueOf()
            )
        })
    }, [summary.events])

    return (
        <Card className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h5 className="mb-0">{t('text.titles.activity')}</h5>
                <div className="flex flex-wrap gap-2">
                    {summary.payment && (
                        <Tag
                            className={classNames(
                                'px-3 py-1 text-sm font-medium rounded-full border',
                                summary.payment.tagClassName,
                            )}
                            title={summary.payment.detail}
                        >
                            {summary.payment.label}
                        </Tag>
                    )}
                    {summary.delivery && (
                        <Tag
                            className={classNames(
                                'px-3 py-1 text-sm font-medium rounded-full border',
                                summary.delivery.tagClassName,
                            )}
                            title={summary.delivery.detail}
                        >
                            {summary.delivery.label}
                        </Tag>
                    )}
                </div>
            </div>
            {loading ? (
                <div className="py-8 text-sm text-gray-500">
                    {t('text.states.loading', { defaultValue: 'Loading…' })}
                </div>
            ) : error ? (
                <div className="py-4 text-sm text-red-500">{error}</div>
            ) : summary.events.length === 0 ? (
                <div className="py-4 text-sm text-gray-500">
                    {t('sales.orderDetails.timeline.empty', {
                        defaultValue: 'No timeline events yet.',
                    })}
                </div>
            ) : (
                <Timeline>
                    {orderedEvents.map((item) => (
                        <Timeline.Item
                            key={item.id}
                            media={
                                <div className="flex mt-1.5">
                                    <Badge
                                        innerClass={classNames(
                                            item.badgeClassName,
                                            (item.isEnd || item.completed) &&
                                                'ring-2 ring-emerald-300',
                                        )}
                                    />
                                </div>
                            }
                        >
                            <div
                                className={classNames(
                                    'font-semibold mb-1 text-base',
                                    item.isEnd && 'text-primary',
                                    item.completed && 'text-emerald-600',
                                )}
                            >
                                {item.label}
                            </div>
                            {item.description && (
                                <div className="text-sm text-gray-700 mb-1">
                                    {item.description}
                                </div>
                            )}
                            <div className="text-xs text-gray-400">
                                {item.timestampLabel}
                            </div>
                        </Timeline.Item>
                    ))}
                </Timeline>
            )}
        </Card>
    )
}

export default Activity

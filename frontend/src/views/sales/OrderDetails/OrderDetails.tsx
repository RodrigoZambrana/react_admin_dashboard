import { useState, useEffect, useCallback, useMemo } from 'react'
import classNames from 'classnames'
import Tag from '@/components/ui/Tag'
import Loading from '@/components/shared/Loading'
import Container from '@/components/shared/Container'
import DoubleSidedImage from '@/components/shared/DoubleSidedImage'
import OrderProducts from './components/OrderProducts'
import PaymentSummary from './components/PaymentSummary'
import ShippingInfo from './components/ShippingInfo'
import Activity from './components/Activity'
import CustomerInfo from './components/CustomerInfo'
import OrderPaymentsCard from './components/OrderPaymentsCard'
import NewPaymentDialog from './components/NewPaymentDialog'
import { HiOutlineCalendar, HiOutlineDocumentText, HiOutlinePencil } from 'react-icons/hi'
import { apiGetSalesOrderDetails, apiGetSalesOrderTimeline } from '@/services/SalesService'
import { apiGetOrderStatuses, apiGetSystemConfig } from '@/services/SettingsService'
import { adaptOrderToDetailsView } from '@/adapters/sales'
import { useLocation, useNavigate } from 'react-router-dom'
import isEmpty from 'lodash/isEmpty'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { useSalesDocumentI18n } from '../context/useSalesDocumentI18n'
import { resolveTextDirection } from '@/utils/textDirection'
import { sanitizeRichText } from '@/utils/security/inputGuards'
import { apiDeletePaymentAttachment } from '@/services/AccountingService'
import type { OrderTimelineResponse } from '@/types/orderTimeline'

type SalesOrderDetailsResponse = {
    id?: string
    progressStatus?: number
    payementStatus?: number
    dateTime?: number
    validUntil?: number
    paymentSummary?: {
        subTotal: number
        tax: number
        deliveryFees: number
        total: number
        currency?: string
    }
    payments?: {
        summary: {
            currency: string
            depositRequired: number
            depositPaidConfirmed: number
            balancePaidConfirmed: number
            refundsConfirmed: number
            totalPaidConfirmed: number
            depositPending: number
            balancePending: number
            refundsPending: number
            outstanding: number
            customerCredit: number
            depositMet: boolean
        } | null
        records: Array<{
            id: number
            orderId: number
            amount: number
            currency: string
            type: string
            status: string
            reference: string | null
            method: string | null
            paymentMethodId: number | null
            date: string
            notes: string | null
            createdAt: string
            updatedAt: string
            attachments: Array<{
                id: number
                name: string
                type: string | null
                size: number | null
                createdAt: string
                url: string
            }>
        }>
    } | null
    shipping?: {
        deliveryFees: number
        estimatedMin: number
        estimatedMax: number
        shippingLogo: string
        shippingVendor: string
    }
    product?: {
        id: string
        name: string
        productCode: string
        img: string
        price: number
        quantity: number
        qty?: number
        total: number
        currency?: string
        unitCurrency?: string
        unitAmount?: number
        unitAmountOrderCurrency?: number
        conversionRate?: number
        details: Record<string, string[]>
        comments?: string
        specSummary?: string
        specifications?: string
        customAttributes?: Record<string, unknown>
        unitOfMeasure?: string | null
        pricingMethod?: string | null
        effectiveQuantity?: number
        unitPrice?: number
        unitCostOrderCurrency?: number
        costCurrency?: string
        costTotal?: number
    }[]
    activity?: {
        date: number
        events: {
            time: number
            action: string
            recipient?: string
        }[]
    }[]
    customer?: {
        id?: number
        name: string
        email: string
        phone: string
        img: string
        previousOrder: number
        previousBudgets?: number
        shippingAddress: {
            line1: string
            line2: string
            line3: string
            line4: string
        }
        billingAddress: {
            line1: string
            line2: string
            line3: string
            line4: string
        }
    }
    comment?: string
    disclaimer?: string
    fxSnapshot?: {
        base: string
        rates: Record<string, number>
    }
}

const OrderDetails = () => {
    const location = useLocation()
    const navigate = useNavigate()

    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<SalesOrderDetailsResponse>({})
    const [fetchError, setFetchError] = useState<string | null>(null)
    const [orderStatuses, setOrderStatuses] = useState<{ id: number; name: string; color: string }[]>([])
    const [taxRate, setTaxRate] = useState<number>()
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
    const [timeline, setTimeline] = useState<OrderTimelineResponse | null>(null)
    const [timelineLoading, setTimelineLoading] = useState(false)
    const [timelineError, setTimelineError] = useState<string | null>(null)
    const { t } = useTranslation()
    const { tDoc, resource, routes, mode } = useSalesDocumentI18n()
    const showValidUntil = resource === 'budgets'

    const fetchTimeline = useCallback(
        async (orderId: string) => {
            if (resource !== 'orders') {
                setTimeline(null)
                setTimelineError(null)
                return
            }
            setTimelineLoading(true)
            setTimelineError(null)
            try {
                const response = await apiGetSalesOrderTimeline<OrderTimelineResponse>(orderId)
                setTimeline(response?.data ?? null)
            } catch (error) {
                setTimeline(null)
                setTimelineError(
                    error instanceof Error
                        ? error.message
                        : t('text.errors.unexpectedError', { defaultValue: 'Unexpected error' }),
                )
            } finally {
                setTimelineLoading(false)
            }
        },
        [resource, t],
    )

    const fetchData = useCallback(async () => {
        const idSegment = location.pathname.substring(
            location.pathname.lastIndexOf('/') + 1,
        )
        if (!idSegment) {
            setTimeline(null)
            setTimelineError(null)
            return
        }
        setLoading(true)
        setFetchError(null)
        try {
            const response = await apiGetSalesOrderDetails<
                SalesOrderDetailsResponse,
                { id: string }
            >({ id: idSegment }, resource)
            if (response) {
                const mapped = adaptOrderToDetailsView((response as any).data, {
                    mode,
                })
                setData(mapped as SalesOrderDetailsResponse)
                if (resource === 'orders') {
                    void fetchTimeline(idSegment)
                } else {
                    setTimeline(null)
                    setTimelineError(null)
                }
                setLoading(false)
                return
            }
            setData({})
            setFetchError('This item is no longer available.')
        } catch (error) {
            setData({})
            setFetchError('This item is no longer available.')
            if (resource === 'orders') {
                setTimeline(null)
            }
            // eslint-disable-next-line no-console
            console.error('Failed to load order detail', error)
        } finally {
            setLoading(false)
        }
    }, [fetchTimeline, location.pathname, mode, resource])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    useEffect(() => {
        // Load order statuses for colored tag mapping
        apiGetOrderStatuses<{ id: number | string; label?: string; color?: string }[]>({ documentType: resource === 'budgets' ? 'BUDGET' : 'ORDER' })
            .then((res) => {
                const arr = (res.data || []).map((status) => ({
                    id: Number(status.id),
                    name: status.label || String(status.id),
                    color: status.color || 'gray-500',
                }))
                setOrderStatuses(arr)
            })
            .catch(() => setOrderStatuses([]))
        apiGetSystemConfig<{ taxRate?: number }>()
            .then((res) => {
                const rate = Number((res.data as any)?.taxRate)
                if (!Number.isNaN(rate)) setTaxRate(rate)
            })
            .catch(() => setTaxRate(undefined))
    }, [resource])
    const docMessage = useCallback(
        (key: string, fallbackKey: string, defaultValue: string) =>
            tDoc(key, {
                defaultValue: t(fallbackKey, { defaultValue }),
            }),
        [t, tDoc],
    )
    const invoiceLabel = docMessage(
        'invoiceAction',
        'sales.orders.invoiceAction',
        t('text.actions.viewInvoice', { defaultValue: 'View invoice' }),
    )
    const disclaimerLabel = docMessage(
        'disclaimerLabel',
        'sales.orders.disclaimerLabel',
        t('text.labels.disclaimer', { defaultValue: 'Disclaimer' }),
    )
    const validUntilLabel = docMessage(
        'validUntilLabel',
        'sales.orders.validUntilLabel',
        'Valid until',
    )

    const currentOrderStatus = useMemo(() => {
        const sid = Number(data.progressStatus)
        if (!Number.isFinite(sid)) {
            return undefined
        }
        return orderStatuses.find((x) => x.id === sid)
    }, [data.progressStatus, orderStatuses])

    const productStatusClasses = useMemo(() => {
        const colorToken = currentOrderStatus?.color || 'gray-500'
        const [baseColor] = String(colorToken).split('-')
        const color = baseColor || 'gray'
        return [
            `bg-${color}-100`,
            `text-${color}-600`,
            `dark:bg-${color}-500/20`,
            `dark:text-${color}-100`,
        ]
    }, [currentOrderStatus])

    const onViewInvoice = useCallback(() => {
        if (!data.id) return
        navigate(`${routes.invoice}/${data.id}`)
    }, [data.id, navigate, routes.invoice])

    const handleDeleteAttachment = useCallback(
        async (attachmentId: number) => {
            try {
                await apiDeletePaymentAttachment<boolean>(attachmentId)
                toast.push(
                    <Notification
                        title={t('sales.orders.payments.attachmentDeletedTitle', {
                            defaultValue: 'Attachment removed',
                        })}
                        type="success"
                    >
                        {t('sales.orders.payments.attachmentDeletedDesc', {
                            defaultValue: 'The attachment was removed successfully.',
                        })}
                    </Notification>,
                )
                fetchData()
            } catch (error) {
                toast.push(
                    <Notification
                        title={t('sales.orders.payments.attachmentDeleteFailedTitle', {
                            defaultValue: 'Could not remove attachment',
                        })}
                        type="danger"
                    >
                        {t('sales.orders.payments.attachmentDeleteFailedDesc', {
                            defaultValue: 'Please try again in a moment.',
                        })}
                    </Notification>,
                )
            }
        },
        [fetchData, t],
    )

    const disclaimerHtml = useMemo(() => {
        if (typeof data.disclaimer === 'string') {
            const trimmed = data.disclaimer.trim()
            if (trimmed) {
                return sanitizeRichText(trimmed)
            }
        }
        return ''
    }, [data.disclaimer])

    const disclaimerDirection = useMemo(() => {
        if (!disclaimerHtml) {
            return undefined
        }
        const plain = disclaimerHtml.replace(/<[^>]+>/g, ' ').trim()
        return plain ? resolveTextDirection(plain) : undefined
    }, [disclaimerHtml])
    return (
        <Container className="h-full">
            <Loading loading={loading}>
                {!isEmpty(data) && (
                    <>
                        <div className="mb-6">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                <div>
                                    <div className="flex items-center mb-2">
                                        <h3>
                                            <span>
                                                {tDoc('detailsTitle', {
                                                    defaultValue: t('text.columns.order'),
                                                })}
                                            </span>
                                            <span className="ltr:ml-2 rtl:mr-2">
                                                #{data.id}
                                            </span>
                                        </h3>
                                        {currentOrderStatus && (
                                            <Tag className={classNames('border-0 rounded-md ltr:ml-2 rtl:mr-2', ...productStatusClasses)}>
                                                {currentOrderStatus.name}
                                            </Tag>
                                        )}
                                    </div>
                                    <span className="flex items-center">
                                        <HiOutlineCalendar className="text-lg" />
                                        <span className="ltr:ml-1 rtl:mr-1">
                                            {dayjs
                                                .unix(data.dateTime || 0)
                                                .format('DD/MM/YYYY')}
                                        </span>
                                    </span>
                                    {showValidUntil && data.validUntil ? (
                                        <span className="flex items-center">
                                            <HiOutlineDocumentText className="text-lg" />
                                            <span className="ltr:ml-1 rtl:mr-1">
                                                {validUntilLabel}:{' '}
                                                {dayjs
                                                    .unix(data.validUntil)
                                                    .format('DD/MM/YYYY')}
                                            </span>
                                        </span>
                                    ) : null}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    {data.id && (
                                        <Button
                                            size="sm"
                                            variant="twoTone"
                                            icon={<HiOutlinePencil />}
                                            onClick={() => navigate(`${routes.edit}/${data.id}`)}
                                        >
                                            {t('text.actions.edit')}
                                        </Button>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="solid"
                                        icon={<HiOutlineDocumentText />}
                                        onClick={onViewInvoice}
                                    >
                                        {invoiceLabel}
                                    </Button>
                                </div>
                            </div>
                        </div>
                        <div className="xl:flex gap-4">
                            <div className="w-full space-y-4">
                                <PaymentSummary
                                    data={data.paymentSummary}
                                    taxRate={taxRate}
                                    currency={data.paymentSummary?.currency}
                                    paymentsSummary={data.payments?.summary ?? null}
                                />
                                <OrderPaymentsCard
                                    orderId={data.id ? Number(data.id) : undefined}
                                    orderCurrency={data.paymentSummary?.currency}
                                    payments={data.payments ?? undefined}
                                    onAddPayment={() => setPaymentDialogOpen(true)}
                                    onDeleteAttachment={handleDeleteAttachment}
                                />
                                <OrderProducts
                                    data={data.product}
                                    orderCurrency={data.paymentSummary?.currency}
                                    fxSnapshot={data.fxSnapshot}
                                />
                                <Activity
                                    timeline={timeline}
                                    loading={timelineLoading}
                                    error={timelineError}
                                />
                            </div>
                            <div className="xl:max-w-[360px] w-full space-y-4">
                                <CustomerInfo data={data.customer} />
                                <ShippingInfo data={data.shipping} />
                                {disclaimerHtml && (
                                    <Card bodyClass="p-5">
                                        <h4 className="mb-2">{disclaimerLabel}</h4>
                                        <div
                                            className="text-sm text-gray-600 dark:text-gray-300"
                                            dir={disclaimerDirection}
                                            dangerouslySetInnerHTML={{ __html: disclaimerHtml }}
                                        />
                                    </Card>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </Loading>
            {!loading && isEmpty(data) && (
                <div className="h-full flex flex-col items-center justify-center">
                    <DoubleSidedImage
                        src="/img/others/img-2.png"
                        darkModeSrc="/img/others/img-2-dark.png"
                        alt={t('common.notFound.order', {
                            defaultValue: 'This item is no longer available.',
                        })}
                    />
                    <h3 className="mt-8">
                        {fetchError ??
                            t('common.notFound.order', {
                                defaultValue: 'This item is no longer available.',
                            })}
                    </h3>
                </div>
            )}
            <NewPaymentDialog
                open={paymentDialogOpen}
                onClose={() => setPaymentDialogOpen(false)}
                orderId={data.id ? Number(data.id) : undefined}
                orderCurrency={data.paymentSummary?.currency}
                onCreated={() => {
                    setPaymentDialogOpen(false)
                    fetchData()
                }}
            />
        </Container>
    )
}

export default OrderDetails

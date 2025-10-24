import { useState, useEffect, useCallback, useMemo } from 'react'
import classNames from 'classnames'
import Tag from '@/components/ui/Tag'
import Loading from '@/components/shared/Loading'
import Container from '@/components/shared/Container'
import DoubleSidedImage from '@/components/shared/DoubleSidedImage'
import OrderProducts from './components/OrderProducts'
import PaymentSummary from './components/PaymentSummary'
import AdministrativeSummary from './components/AdministrativeSummary'
import ShippingInfo from './components/ShippingInfo'
import Activity from './components/Activity'
import CustomerInfo from './components/CustomerInfo'
import { HiOutlineCalendar, HiOutlineDocumentText, HiOutlinePencil } from 'react-icons/hi'
import { apiGetSalesOrderDetails } from '@/services/SalesService'
import { apiGetOrderStatuses, apiGetSystemConfig } from '@/services/SettingsService'
import { adaptOrderToDetailsView } from '@/adapters/sales'
import { useLocation, useNavigate } from 'react-router-dom'
import isEmpty from 'lodash/isEmpty'
import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import { useSalesDocumentI18n } from '../context/useSalesDocumentI18n'
import { resolveTextDirection } from '@/utils/textDirection'

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
}

const OrderDetails = () => {
    const location = useLocation()
    const navigate = useNavigate()

    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<SalesOrderDetailsResponse>({})
    const [orderStatuses, setOrderStatuses] = useState<{ id: number; name: string; color: string }[]>([])
    const [taxRate, setTaxRate] = useState<number>()
    const { t } = useTranslation()
    const { tDoc, resource, routes } = useSalesDocumentI18n()

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [resource])

    const fetchData = async () => {
        const id = location.pathname.substring(
            location.pathname.lastIndexOf('/') + 1,
        )
        if (id) {
            setLoading(true)
            const response = await apiGetSalesOrderDetails<
                SalesOrderDetailsResponse,
                { id: string }
            >({ id }, resource)
            if (response) {
                setLoading(false)
                // Backend returns raw Order; map to unified view shape
                const mapped = adaptOrderToDetailsView((response as any).data)
                setData(mapped as SalesOrderDetailsResponse)
            }
        }
    }

    useEffect(() => {
        // Load order statuses for colored tag mapping
        apiGetOrderStatuses<{ id: number | string; name: string; color: string }[]>()
            .then((res) => {
                const arr = (res.data as any[]).map((s) => ({ id: Number(s.id), name: s.name, color: s.color || 'gray-500' }))
                setOrderStatuses(arr)
            })
            .catch(() => setOrderStatuses([]))
        apiGetSystemConfig<{ taxRate?: number }>()
            .then((res) => {
                const rate = Number((res.data as any)?.taxRate)
                if (!Number.isNaN(rate)) setTaxRate(rate)
            })
            .catch(() => setTaxRate(undefined))
    }, [])
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
    const administrativeTitle = docMessage(
        'administrativeTitle',
        'sales.orders.administrative.title',
        'Administrative info',
    )
    const administrativeTotalLabel = docMessage(
        'administrativeTotalCost',
        'sales.orders.administrative.totalCost',
        'Total cost',
    )
    const administrativeNetLabel = docMessage(
        'administrativeNetIncome',
        'sales.orders.administrative.netIncome',
        'Net income',
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

    const administrativeSummary = useMemo(() => {
        const items = Array.isArray(data.product)
            ? data.product.map((item, index) => {
                  const quantity = Number(item?.quantity ?? item?.qty ?? 0)
                  const unitCost = Number(item?.unitCostOrderCurrency ?? 0)
                  const fallbackCost = Number.isFinite(unitCost) ? unitCost * quantity : 0
                  const lineCostRaw = Number(item?.costTotal ?? fallbackCost)
                  const lineCost = Number.isFinite(lineCostRaw)
                      ? Math.round(lineCostRaw * 100) / 100
                      : 0
                  return {
                      id: item?.id ?? `${index}`,
                      name: item?.name ?? t('text.columns.product'),
                      quantity: Number.isFinite(quantity) ? quantity : 0,
                      unitCost: Number.isFinite(unitCost) ? unitCost : 0,
                      lineCost,
                      currency: item?.costCurrency ?? data.paymentSummary?.currency,
                  }
              })
            : []
        const totalCost = Math.round(
            items.reduce((sum, item) => sum + (Number.isFinite(item.lineCost) ? item.lineCost : 0), 0) * 100,
        ) / 100
        const grandTotal = Number(data.paymentSummary?.total ?? 0)
        const netIncome = Math.round(((Number.isFinite(grandTotal) ? grandTotal : 0) - totalCost) * 100) / 100
        return {
            items,
            totalCost,
            netIncome,
            currency: data.paymentSummary?.currency,
        }
    }, [data, t])

    const disclaimerText = useMemo(() => {
        if (typeof data.disclaimer === 'string') {
            const trimmed = data.disclaimer.trim()
            if (trimmed) {
                return trimmed
            }
        }
        return ''
    }, [data.disclaimer])
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
                                                .format('ddd DD-MMM-YYYY, hh:mm A')}
                                        </span>
                                    </span>
                                    {data.validUntil ? (
                                        <span className="flex items-center">
                                            <HiOutlineDocumentText className="text-lg" />
                                            <span className="ltr:ml-1 rtl:mr-1">
                                                {validUntilLabel}:{' '}
                                                {dayjs
                                                    .unix(data.validUntil)
                                                    .format('ddd DD-MMM-YYYY')}
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
                            <div className="w-full">
                                <OrderProducts
                                    data={data.product}
                                    orderCurrency={data.paymentSummary?.currency}
                                    fxSnapshot={data.fxSnapshot}
                                />
                                <PaymentSummary
                                    data={data.paymentSummary}
                                    taxRate={taxRate}
                                    currency={data.paymentSummary?.currency}
                                />
                                <AdministrativeSummary
                                    title={administrativeTitle}
                                    items={administrativeSummary.items}
                                    currency={administrativeSummary.currency}
                                    totalCost={administrativeSummary.totalCost}
                                    netIncome={administrativeSummary.netIncome}
                                    totalCostLabel={administrativeTotalLabel}
                                    netIncomeLabel={administrativeNetLabel}
                                />
                                <Activity data={data.activity} />
                            </div>
                            <div className="xl:max-w-[360px] w-full space-y-4">
                                <CustomerInfo data={data.customer} />
                                <ShippingInfo data={data.shipping} />
                                {disclaimerText && (
                                    <Card bodyClass="p-5">
                                        <h4 className="mb-2">{disclaimerLabel}</h4>
                                        <p
                                            className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300"
                                            dir={resolveTextDirection(disclaimerText)}
                                        >
                                            {disclaimerText}
                                        </p>
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
                        alt={t('common.notFound.order')}
                    />
                    <h3 className="mt-8">{t('common.notFound.order')}</h3>
                </div>
            )}
        </Container>
    )
}

export default OrderDetails

import { useCallback, useEffect, useState } from 'react'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppSelector } from '@/store'
import { normalizeCurrencyCode } from '@/utils/currency'
import { useSalesDocumentI18n } from '../context/useSalesDocumentI18n'
import OrderNew, {
    type SalesDocumentAddress,
    type SalesDocumentFormValues,
    type SalesDocumentSubmitPayload,
} from '../OrderNew/OrderNew'
import { apiGetSalesOrder, apiSaveSalesOrder } from '@/services/SalesService'
import { apiGetCustomerDetails } from '@/services/CustomersService'
import { DEFAULT_SALES_UNIT } from '@/constants/product.constant'
import { getDerivedUnitPrice, resolveSalesUnit } from '@/utils/salesUnitCalculation'
import { findCountryByName } from '@/utils/countries'
import type { EditableItem } from '../components/EditableOrderProductsTable'

const splitStreetLine = (line: string) => {
    const trimmed = (line || '').trim()
    if (!trimmed) {
        return { street: '', number: '' }
    }
    const match = trimmed.match(/^(.*?)(\d[\w/-]*)$/)
    if (match) {
        return {
            street: match[1].trim(),
            number: match[2].trim(),
        }
    }
    return { street: trimmed, number: '' }
}

const buildAddress = (source: any, prefix: 'shipping' | 'billing'): SalesDocumentAddress => {
    const fallback: SalesDocumentAddress = {
        street: '',
        number: '',
        corner: '',
        apartment: '',
        city: 'Montevideo',
        state: 'Uruguay',
        countryCode: 'UY',
    }

    const nested =
        (source && typeof source[`${prefix}Address`] === 'object' && source[`${prefix}Address`]) || {}

    const primaryLine = (() => {
        const candidateList = [
            nested.street,
            nested.addressLine1,
            source?.[`${prefix}Address1`],
        ]
        for (const candidate of candidateList) {
            if (typeof candidate === 'string' && candidate.trim().length) {
                return candidate.trim()
            }
        }
        return ''
    })()

    const { street, number } = splitStreetLine(primaryLine)

    const secondaryLine = (() => {
        const candidateList = [nested.addressLine2, source?.[`${prefix}Address2`]]
        for (const candidate of candidateList) {
            if (typeof candidate === 'string' && candidate.trim().length) {
                return candidate.trim()
            }
        }
        return ''
    })()

    let apartment =
        typeof nested.apartment === 'string' && nested.apartment.trim().length
            ? nested.apartment.trim()
            : ''
    let corner =
        typeof nested.corner === 'string' && nested.corner.trim().length
            ? nested.corner.trim()
            : ''

    if (!apartment && /apt\b/i.test(secondaryLine)) {
        apartment = secondaryLine
    } else if (!corner && secondaryLine) {
        corner = secondaryLine
    }

    const city = (() => {
        const candidates = [nested.city, source?.[`${prefix}City`]]
        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim().length) {
                return candidate.trim()
            }
        }
        return fallback.city
    })()

    const state = (() => {
        const candidates = [
            nested.state,
            nested.region,
            nested.province,
            source?.[`${prefix}State`],
        ]
        for (const candidate of candidates) {
            if (typeof candidate === 'string' && candidate.trim().length) {
                return candidate.trim()
            }
        }
        return fallback.state
    })()

    const rawCountryName = (() => {
        if (typeof nested.country === 'string' && nested.country.trim().length) {
            return nested.country.trim()
        }
        if (typeof source?.[`${prefix}Country`] === 'string') {
            const candidate = source?.[`${prefix}Country`].trim()
            if (candidate.length) {
                return candidate
            }
        }
        return state
    })()

    const countryCode = (() => {
        if (typeof nested.countryCode === 'string' && nested.countryCode.trim().length) {
            return nested.countryCode.trim()
        }
        const resolved = findCountryByName(rawCountryName)?.value
        return resolved || fallback.countryCode
    })()

    return {
        street: street || fallback.street,
        number: number || fallback.number,
        corner: corner || fallback.corner,
        apartment: apartment || fallback.apartment,
        city: city || fallback.city,
        state: state || fallback.state,
        countryCode: countryCode || fallback.countryCode,
    }
}

const resolveOrderCurrency = (order: any, fallback: string): string => {
    const direct = normalizeCurrencyCode(order?.orderCurrency, fallback)
    if (direct) {
        return direct
    }
    if (Array.isArray(order?.items)) {
        for (const item of order.items) {
            const code =
                normalizeCurrencyCode(item?.unitCurrency, fallback) ||
                normalizeCurrencyCode(item?.currency, fallback) ||
                normalizeCurrencyCode(item?.product?.currency, fallback)
            if (code) {
                return code
            }
        }
    }
    return fallback
}

const mapOrderItems = (
    items: any[] | undefined,
    orderCurrency: string,
    roundCurrencyValue: (value: number) => number,
): EditableItem[] => {
    if (!Array.isArray(items)) {
        return []
    }
    return items.map((item: any) => {
        const pricingMethod = resolveSalesUnit(
            item?.pricingMethodSnapshot,
            item?.pricingMethod ?? item?.unitOfMeasure ?? DEFAULT_SALES_UNIT,
        )
        const customAttributes =
            item?.customAttributes && typeof item.customAttributes === 'object'
                ? { ...item.customAttributes }
                : {}
        const unitCurrency =
            normalizeCurrencyCode(item?.unitCurrency, orderCurrency) ||
            normalizeCurrencyCode(item?.currency, orderCurrency) ||
            orderCurrency
        const unitAmount = Number(
            item?.unitAmountOrderCurrency ??
                item?.unitAmount ??
                item?.unitPrice ??
                item?.price ??
                0,
        )
        const quantity = Number(item?.qty ?? 0)
        const normalizedUnitPrice = roundCurrencyValue(unitAmount)
        const baseItem: EditableItem = {
            productId: String(item?.productId ?? ''),
            name: item?.name ?? '',
            price: normalizedUnitPrice,
            qty: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
            img: item?.img ?? item?.product?.img,
            description: item?.description ?? item?.product?.description,
            currency: orderCurrency,
            unitPrice: normalizedUnitPrice,
            unitCurrency,
            comments: typeof item?.comments === 'string' ? item.comments : '',
            customAttributes,
            pricingMethod,
            unitOfMeasure: pricingMethod,
            specSummary:
                typeof item?.specSummary === 'string' && item.specSummary.trim().length
                    ? item.specSummary.trim()
                    : undefined,
            specifications:
                typeof item?.specifications === 'string' && item.specifications.trim().length
                    ? item.specifications.trim()
                    : undefined,
        }
        const derivedUnitPrice = getDerivedUnitPrice(baseItem)
        return {
            ...baseItem,
            price: roundCurrencyValue(derivedUnitPrice),
        }
    })
}

const OrderEdit = () => {
    const { orderId } = useParams()
    const navigate = useNavigate()
    const { t, tDoc, resource, routes } = useSalesDocumentI18n()
    const docMessage = useCallback(
        (key: string, fallbackKey: string, defaultValue: string) =>
            tDoc(key, {
                defaultValue: t(fallbackKey, { defaultValue }),
            }),
        [t, tDoc],
    )
    const storeCurrency = useAppSelector((state) => state.currency.code)
    const defaultCurrency = normalizeCurrencyCode(storeCurrency, 'UYU') || 'UYU'

    const [loading, setLoading] = useState(true)
    const [initialValues, setInitialValues] = useState<SalesDocumentFormValues | null>(null)
    const [initialCustomerDetail, setInitialCustomerDetail] = useState<any | null>(null)
    const [initialCustomerOption, setInitialCustomerOption] = useState<
        { value: string; label: string } | null
    >(null)

    const roundCurrencyValue = useCallback((value: number) => {
        const numeric = Number(value)
        if (!Number.isFinite(numeric)) {
            return 0
        }
        return Math.round((numeric + Number.EPSILON) * 100) / 100
    }, [])

    const loadOrder = useCallback(async () => {
        if (!orderId) {
            return
        }
        setLoading(true)
        try {
            const response = await apiGetSalesOrder<any, { id: string }>(
                { id: String(orderId) },
                resource,
            )
            const data = (response as any)?.data ?? response
            const orderCurrency = resolveOrderCurrency(data, defaultCurrency)
            const items = mapOrderItems(data?.items, orderCurrency, roundCurrencyValue)
            const shippingAddress = buildAddress(data, 'shipping')
            const billingAddress = buildAddress(data, 'billing')
            const shippingVendorRaw =
                (typeof data?.shippingVendor === 'string' && data.shippingVendor) ||
                (typeof data?.shipping?.shippingVendor === 'string' && data.shipping.shippingVendor) ||
                ''

            const initialForm: SalesDocumentFormValues = {
                id: data?.id ?? orderId,
                customerId: data?.customerId ? String(data.customerId) : '',
                date: data?.date ? new Date(data.date) : new Date(),
                validUntil: data?.validUntil ? new Date(data.validUntil) : null,
                paymentMehod: data?.paymentMehod ? String(data.paymentMehod) : 'Cash',
                orderCurrency,
                items,
                shippingAddress,
                billingAddress,
                billingSameAsShipping: Boolean(data?.billingSameAsShipping),
                shipping: {
                    shippingVendor: shippingVendorRaw.trim(),
                    deliveryFees: Number(data?.deliveryFees ?? data?.shipping?.deliveryFees ?? 0),
                    estimatedMin: Number(data?.estimatedMin ?? data?.shipping?.estimatedMin ?? 0),
                    estimatedMax: Number(data?.estimatedMax ?? data?.shipping?.estimatedMax ?? 0),
                },
                comment: typeof data?.comment === 'string' ? data.comment : '',
            }

            setInitialValues(initialForm)

            const customerOption = data?.customerId
                ? {
                      value: String(data.customerId),
                      label:
                          (typeof data?.customer?.name === 'string' && data.customer.name) ||
                          (typeof data?.customer?.displayName === 'string' &&
                              data.customer.displayName) ||
                          String(data.customerId),
                  }
                : null
            setInitialCustomerOption(customerOption)

            if (data?.customerId) {
                try {
                    const detailResponse = await apiGetCustomerDetails<any, { id: string }>(
                        { id: String(data.customerId) },
                    )
                    const detail = (detailResponse as any)?.data ?? detailResponse
                    setInitialCustomerDetail(detail)
                    if (detail?.name && customerOption) {
                        setInitialCustomerOption({
                            value: customerOption.value,
                            label: detail.name,
                        })
                    }
                } catch {
                    setInitialCustomerDetail(null)
                }
            } else {
                setInitialCustomerDetail(null)
            }
        } catch (error: any) {
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
                { placement: 'top-center' },
            )
            navigate(routes.list)
        } finally {
            setLoading(false)
        }
    }, [defaultCurrency, navigate, orderId, resource, roundCurrencyValue, routes.list, t])

    useEffect(() => {
        loadOrder()
    }, [loadOrder])

    const handleSubmit = useCallback(
        async (
            formValues: SalesDocumentFormValues,
            payload: SalesDocumentSubmitPayload,
        ) => {
            if (!orderId) {
                return
            }
            try {
                const response = await apiSaveSalesOrder<boolean, any>(
                    {
                        ...payload,
                        id: formValues.id ?? orderId,
                    },
                    resource,
                )
                if ((response as any)?.data || (response as any) === true) {
                    toast.push(
                        <Notification
                            type="success"
                            title={docMessage(
                                'updated.title',
                                'sales.orders.updated.title',
                                'Document updated successfully',
                            )}
                        >
                            {docMessage(
                                'updated.desc',
                                'sales.orders.updated.desc',
                                'The document was updated successfully.',
                            )}
                        </Notification>,
                        { placement: 'top-center' },
                    )
                    navigate(`${routes.details}/${orderId}`)
                }
            } catch (error: any) {
                const fieldErrors = error?.response?.data?.errors as
                    | { field: string; key: string }[]
                    | undefined
                if (Array.isArray(fieldErrors) && fieldErrors.length) {
                    const lines = fieldErrors
                        .map((fieldError) => t(fieldError.key, { field: fieldError.field }))
                        .join('\n')
                    toast.push(
                        <Notification title={t('validation.failed')} type="danger">
                            {lines}
                        </Notification>,
                        { placement: 'top-center' },
                    )
                } else {
                    toast.push(
                        <Notification title={t('validation.failed')} type="danger">
                            {error?.response?.data?.message || error?.message || String(error)}
                        </Notification>,
                        { placement: 'top-center' },
                    )
                }
            }
        },
        [docMessage, navigate, orderId, resource, routes.details, t],
    )

    if (loading || !initialValues) {
        return <Loading loading className="min-h-[320px]" />
    }

    return (
        <OrderNew
            initialValues={initialValues}
            initialCustomerDetail={initialCustomerDetail}
            initialCustomerOption={initialCustomerOption}
            onSubmitOverride={handleSubmit}
        />
    )
}

export default OrderEdit

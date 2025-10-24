import { useCallback, useEffect, useMemo, useState } from 'react'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import {
    apiGetSalesOrder,
    apiSaveSalesOrder,
    apiGetSalesProducts,
} from '@/services/SalesService'
import { apiGetCustomerDetails } from '@/services/CustomersService'
import OrderNew, {
    type SalesDocumentFormValues,
    type SalesDocumentSubmitPayload,
    type AddressFormValue,
} from '../OrderNew/OrderNew'
import { useSalesDocumentI18n } from '../context/useSalesDocumentI18n'
import { useAppSelector } from '@/store'
import { normalizeCurrencyCode } from '@/utils/currency'
import { DEFAULT_SALES_UNIT, type SalesUnit } from '@/constants/product.constant'
import { getDerivedUnitPrice } from '@/utils/salesUnitCalculation'
import type { EditableItem } from '@/views/sales/components/EditableOrderProductsTable'
import type { FormikHelpers } from 'formik'

const ADDRESS_COUNTRY_FALLBACK = 'UY'

const mapAddressToForm = (address: any): AddressFormValue => ({
    street:
        typeof address?.street === 'string'
            ? address.street
            : (typeof address?.addressLine1 === 'string' ? address.addressLine1 : ''),
    number:
        typeof address?.number === 'string'
            ? address.number
            : (typeof address?.addressLine2 === 'string' ? address.addressLine2 : ''),
    corner: typeof address?.corner === 'string' ? address.corner : '',
    apartment: typeof address?.apartment === 'string' ? address.apartment : '',
    city: typeof address?.city === 'string' ? address.city : '',
    state: typeof address?.state === 'string' ? address.state : '',
    countryCode:
        typeof address?.countryCode === 'string'
            ? address.countryCode
            : typeof address?.country === 'string'
            ? address.country
            : ADDRESS_COUNTRY_FALLBACK,
})

const parseBooleanLike = (value: unknown): boolean => {
    if (typeof value === 'boolean') {
        return value
    }
    if (typeof value === 'number') {
        if (Number.isNaN(value)) {
            return false
        }
        if (value === 0) {
            return false
        }
        if (value === 1) {
            return true
        }
        return value !== 0
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (!normalized.length) {
            return false
        }
        if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) {
            return true
        }
        if (['false', '0', 'no', 'n', 'off', 'null', 'undefined'].includes(normalized)) {
            return false
        }
    }
    return Boolean(value)
}

const mapItemsToEditable = (
    items: any[],
    products: any[],
    orderCurrency: string,
    roundCurrencyValue: (value: number) => number,
): EditableItem[] => {
    return items.map((item) => {
        const product = products.find((p) => String(p.id) === String(item.productId))
        const unitCurrency =
            normalizeCurrencyCode(item.unitCurrency, orderCurrency) ||
            normalizeCurrencyCode(product?.currency, orderCurrency) ||
            orderCurrency
        const customAttributes =
            item.customAttributes && typeof item.customAttributes === 'object'
                ? { ...item.customAttributes }
                : {}
        const pricingMethod =
            (typeof item.pricingMethodSnapshot === 'string' && item.pricingMethodSnapshot) ||
            (typeof item.pricingMethod === 'string' && item.pricingMethod) ||
            (typeof item.unitOfMeasure === 'string' && item.unitOfMeasure) ||
            (typeof product?.unitOfMeasure === 'string' && product.unitOfMeasure) ||
            DEFAULT_SALES_UNIT
        const baseItem: EditableItem = {
            productId: String(item.productId),
            name: item.name,
            qty: Number(item.qty) || 1,
            currency: orderCurrency,
            price: 0,
            unitPrice:
                Number(
                    item.unitAmountOrderCurrency ??
                        item.unitAmount ??
                        item.unitPrice ??
                        item.price,
                ) || 0,
            unitCurrency,
            img: item.img ?? product?.img,
            description:
                typeof item.description === 'string'
                    ? item.description
                    : product?.description,
            specifications:
                typeof item.specifications === 'string'
                    ? item.specifications
                    : typeof product?.specifications === 'string'
                    ? product.specifications
                    : undefined,
            comments: typeof item.comments === 'string' ? item.comments : '',
            customAttributes,
            pricingMethod,
            unitOfMeasure: (pricingMethod as SalesUnit) ?? DEFAULT_SALES_UNIT,
            specSummary:
                typeof item.specSummary === 'string' ? item.specSummary : undefined,
        }
        const derivedPrice = roundCurrencyValue(getDerivedUnitPrice(baseItem))
        return {
            ...baseItem,
            price: derivedPrice,
        }
    })
}

const parseDateValue = (value: unknown): Date | null => {
    if (value === null || value === undefined || value === '') {
        return null
    }
    const date = new Date(value as any)
    return Number.isNaN(date.getTime()) ? null : date
}

const OrderEdit = () => {
    const { orderId } = useParams<{ orderId: string }>()
    const navigate = useNavigate()
    const { t } = useTranslation()
    const { tDoc, resource, routes } = useSalesDocumentI18n()
    const storeCurrency = useAppSelector((state) => state.currency.code)

    const defaultCurrency = useMemo(
        () => normalizeCurrencyCode(storeCurrency, 'UYU') || 'UYU',
        [storeCurrency],
    )

    const roundCurrencyValue = useCallback(
        (value: number) =>
            Math.round((Number(value) + Number.EPSILON) * 100) / 100,
        [],
    )

    const docMessage = useCallback(
        (key: string, fallbackKey: string, defaultValue: string) =>
            tDoc(key, {
                defaultValue: t(fallbackKey, { defaultValue }),
            }),
        [t, tDoc],
    )

    const [loading, setLoading] = useState(true)
    const [initialValues, setInitialValues] = useState<SalesDocumentFormValues | null>(null)
    const [initialCustomerDetail, setInitialCustomerDetail] = useState<any | null>(null)
    const [documentId, setDocumentId] = useState<string | number | null>(null)
    const [disclaimer, setDisclaimer] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        const load = async () => {
            if (!orderId) {
                return
            }
            setLoading(true)
            try {
                const [orderResult, productResult] = await Promise.allSettled([
                    apiGetSalesOrder<any, { id: string }>({ id: orderId }, resource),
                    apiGetSalesProducts<{ data: any[]; total: number }, any>({
                        pageIndex: 1,
                        pageSize: 100,
                        sort: { key: 'name', order: 'asc' },
                        query: '',
                    }),
                ])

                if (!active) {
                    return
                }

                if (orderResult.status !== 'fulfilled') {
                    throw orderResult.reason
                }

                const orderData =
                    (orderResult.value as any)?.data ?? (orderResult.value as any)
                const products =
                    productResult.status === 'fulfilled'
                        ? (((productResult.value as any)?.data?.data ?? []) as any[])
                        : []

                const orderCurrency =
                    normalizeCurrencyCode(orderData?.orderCurrency, defaultCurrency) ||
                    defaultCurrency

                const items = mapItemsToEditable(
                    Array.isArray(orderData?.items) ? orderData.items : [],
                    products,
                    orderCurrency,
                    roundCurrencyValue,
                )

                const shippingAddress = mapAddressToForm(orderData?.shippingAddress ?? {})
                const billingAddressRaw = mapAddressToForm(orderData?.billingAddress ?? {})
                const billingSameAsShipping = parseBooleanLike(
                    orderData?.billingSameAsShipping,
                )

                const formValues: SalesDocumentFormValues = {
                    customerId: orderData?.customerId ? String(orderData.customerId) : '',
                    date: parseDateValue(orderData?.date) ?? new Date(),
                    validUntil: parseDateValue(orderData?.validUntil),
                    paymentMehod: String(
                        orderData?.paymentMehod ?? orderData?.paymentMethod ?? 'Cash',
                    ),
                    orderCurrency,
                    items,
                    shippingAddress,
                    billingAddress: billingSameAsShipping
                        ? { ...shippingAddress }
                        : billingAddressRaw,
                    billingSameAsShipping,
                    shipping: {
                        shippingVendor:
                            orderData?.shipping?.shippingVendor ??
                            orderData?.shippingVendor ??
                            '',
                        deliveryFees: roundCurrencyValue(
                            Number(
                                orderData?.shipping?.deliveryFees ??
                                    orderData?.deliveryFees ??
                                    0,
                            ),
                        ),
                        estimatedMin: Number(
                            orderData?.shipping?.estimatedMin ??
                                orderData?.estimatedMin ??
                                0,
                        ),
                        estimatedMax: Number(
                            orderData?.shipping?.estimatedMax ??
                                orderData?.estimatedMax ??
                                orderData?.shipping?.estimatedMin ??
                                0,
                        ),
                    },
                    comment:
                        typeof orderData?.comment === 'string'
                            ? orderData.comment
                            : typeof orderData?.comments === 'string'
                            ? orderData.comments
                            : '',
                }

                setInitialValues(formValues)
                setDocumentId(orderData?.id ?? orderId)
                setDisclaimer(
                    typeof orderData?.disclaimer === 'string' ? orderData.disclaimer : null,
                )

                if (orderData?.customerId) {
                    try {
                        const detailRes = await apiGetCustomerDetails<any, { id: string }>({
                            id: String(orderData.customerId),
                        })
                        if (active) {
                            const detail = (detailRes as any)?.data ?? (detailRes as any)
                            setInitialCustomerDetail(detail)
                        }
                    } catch {
                        if (active) {
                            setInitialCustomerDetail(null)
                        }
                    }
                } else {
                    setInitialCustomerDetail(null)
                }
            } catch (error: any) {
                if (!active) {
                    return
                }
                toast.push(
                    <Notification title={t('validation.failed')} type="danger">
                        {error?.response?.data?.message || error?.message || String(error)}
                    </Notification>,
                    { placement: 'top-center' },
                )
            } finally {
                if (active) {
                    setLoading(false)
                }
            }
        }

        load()

        return () => {
            active = false
        }
    }, [defaultCurrency, orderId, resource, roundCurrencyValue, t])

    const handleSubmit = useCallback(
        async (
            payload: SalesDocumentSubmitPayload,
            helpers: FormikHelpers<SalesDocumentFormValues>,
        ) => {
            try {
                const result = await apiSaveSalesOrder<boolean, SalesDocumentSubmitPayload>(
                    payload,
                    resource,
                )
                if ((result as any)?.data || result === true) {
                    toast.push(
                        <Notification
                            title={docMessage(
                                'updated.title',
                                'sales.orders.updated.title',
                                'Document updated successfully',
                            )}
                            type="success"
                        >
                            {docMessage(
                                'updated.desc',
                                'sales.orders.updated.desc',
                                'The document was updated successfully.',
                            )}
                        </Notification>,
                        { placement: 'top-center' },
                    )
                    navigate(routes.list)
                }
            } catch (error: any) {
                const errs = error?.response?.data?.errors as
                    | { field: string; key: string }[]
                    | undefined
                if (Array.isArray(errs) && errs.length) {
                    const lines = errs
                        .map((err) => t(err.key, { field: err.field }))
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
            } finally {
                helpers.setSubmitting(false)
            }
        },
        [docMessage, navigate, resource, routes.list, t],
    )

    return (
        <Loading loading={loading}>
            {initialValues ? (
                <OrderNew
                    initialValues={initialValues}
                    initialCustomerDetail={initialCustomerDetail}
                    onSubmit={handleSubmit}
                    isEditing
                    documentId={documentId}
                    disclaimer={disclaimer}
                />
            ) : null}
        </Loading>
    )
}

export default OrderEdit

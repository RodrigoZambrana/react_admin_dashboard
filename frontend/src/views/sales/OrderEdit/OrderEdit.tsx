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
import { parseValidityRecord } from '@/adapters/sales'
import { createSalesDocumentRounder } from '@/utils/salesDocumentCalculations'

const ADDRESS_COUNTRY_FALLBACK = 'UY'

const normalizeSegment = (value: unknown): string =>
    typeof value === 'string' ? value.trim() : ''

const parseAddressLine1 = (
    rawLine?: string | null,
): { street?: string; number?: string; apartment?: string } => {
    const line = normalizeSegment(rawLine)
    if (!line) {
        return {}
    }
    let working = line
    let apartment: string | undefined
    const aptMatch = working.match(/\bapt\.?\s+(.+)$/i)
    if (aptMatch) {
        apartment = aptMatch[1]?.trim()
        working = working.slice(0, Math.max(0, aptMatch.index ?? working.length)).trim()
    }
    if (!working) {
        return { apartment }
    }
    const tokens = working.split(/\s+/)
    if (!tokens.length) {
        return { apartment }
    }
    let number: string | undefined
    let street: string | undefined
    for (let i = tokens.length - 1; i >= 0; i -= 1) {
        const token = tokens[i]
        if (/^\d+[\w\-\/]*$/u.test(token)) {
            number = tokens.slice(i).join(' ')
            street = tokens.slice(0, i).join(' ')
            break
        }
    }
    if (!street) {
        street = working
    }
    return {
        street: street?.trim() || undefined,
        number: number?.trim() || undefined,
        apartment,
    }
}

const parseAddressLine2 = (
    rawLine?: string | null,
): { apartment?: string; corner?: string } => {
    const line = normalizeSegment(rawLine)
    if (!line) {
        return {}
    }
    const segments = line
        .split(/•|,|\|/u)
        .map((segment) => segment.trim())
        .filter(Boolean)

    let apartment: string | undefined
    let corner: string | undefined

    const evaluateSegment = (segment: string) => {
        if (!apartment) {
            const aptMatch = segment.match(/^apt\.?\s+(.+)$/i)
            if (aptMatch) {
                apartment = aptMatch[1]?.trim()
                return
            }
        }
        if (!corner) {
            if (/^corner[:\s]/i.test(segment)) {
                corner = segment.replace(/^corner[:\s]*/i, '').trim()
                return
            }
            if (!/apt\.?/i.test(segment)) {
                corner = segment
            }
        }
    }

    if (segments.length) {
        segments.forEach(evaluateSegment)
    } else {
        evaluateSegment(line)
    }

    return {
        apartment,
        corner,
    }
}

const mapAddressToForm = (address: any): AddressFormValue => {
    if (!address) {
        return {
            street: '',
            number: '',
            corner: '',
            apartment: '',
            city: '',
            state: '',
            countryCode: ADDRESS_COUNTRY_FALLBACK,
        }
    }

    if (typeof address === 'string') {
        return mapAddressToForm({ addressLine1: address })
    }

    const line1Parts = parseAddressLine1(
        address?.addressLine1 ??
            address?.address1 ??
            address?.line1 ??
            address?.address ??
            address?.streetAddress,
    )
    const line2Parts = parseAddressLine2(
        address?.addressLine2 ?? address?.address2 ?? address?.line2 ?? address?.addressLine,
    )

    const street = normalizeSegment(address?.street) || line1Parts.street || ''
    const number = normalizeSegment(address?.number) || line1Parts.number || ''
    const apartment =
        normalizeSegment(address?.apartment) ||
        line1Parts.apartment ||
        line2Parts.apartment ||
        ''
    const corner = normalizeSegment(address?.corner) || line2Parts.corner || ''
    const city = normalizeSegment(address?.city ?? address?.cityName)
    const state =
        normalizeSegment(address?.state ?? address?.stateName ?? address?.region) ||
        normalizeSegment(address?.country)
    const countryCode =
        normalizeSegment(address?.countryCode ?? address?.country ?? address?.state ?? '') ||
        ADDRESS_COUNTRY_FALLBACK

    return {
        street,
        number,
        corner,
        apartment,
        city,
        state,
        countryCode,
    }
}

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

const customerHasContactDetails = (detail: any | null | undefined): boolean => {
    if (!detail || typeof detail !== 'object') {
        return false
    }
    if (detail.email && String(detail.email).trim().length) {
        return true
    }
    const phones = (detail as any)?.personalInfo?.phoneNumbers
    if (Array.isArray(phones) && phones.some((phone) => typeof phone === 'string' && phone.trim())) {
        return true
    }
    return false
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
    const { tDoc, resource, routes, mode } = useSalesDocumentI18n()
    const storeCurrency = useAppSelector((state) => state.currency.code)

    const defaultCurrency = useMemo(
        () => normalizeCurrencyCode(storeCurrency, 'UYU') || 'UYU',
        [storeCurrency],
    )

    const roundCurrencyValue = useMemo(
        () => createSalesDocumentRounder(mode),
        [mode],
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

                const shippingSource = {
                    ...(orderData?.shippingAddress &&
                    typeof orderData.shippingAddress === 'object'
                        ? orderData.shippingAddress
                        : {}),
                    addressLine1:
                        orderData?.shippingAddress1 ??
                        orderData?.shipping_address_1 ??
                        orderData?.shippingAddressLine1 ??
                        orderData?.shipping_address_line1,
                    addressLine2:
                        orderData?.shippingAddress2 ??
                        orderData?.shipping_address_2 ??
                        orderData?.shippingAddressLine2 ??
                        orderData?.shipping_address_line2,
                    city: orderData?.shippingCity ?? orderData?.shipping_city,
                    state: orderData?.shippingState ?? orderData?.shipping_state,
                    country: orderData?.shippingCountry ?? orderData?.shipping_country,
                    countryCode:
                        orderData?.shippingCountryCode ?? orderData?.shipping_country_code,
                }
                const billingSource = {
                    ...(orderData?.billingAddress &&
                    typeof orderData.billingAddress === 'object'
                        ? orderData.billingAddress
                        : {}),
                    addressLine1:
                        orderData?.billingAddress1 ??
                        orderData?.billing_address_1 ??
                        orderData?.billingAddressLine1 ??
                        orderData?.billing_address_line1,
                    addressLine2:
                        orderData?.billingAddress2 ??
                        orderData?.billing_address_2 ??
                        orderData?.billingAddressLine2 ??
                        orderData?.billing_address_line2,
                    city: orderData?.billingCity ?? orderData?.billing_city,
                    state: orderData?.billingState ?? orderData?.billing_state,
                    country: orderData?.billingCountry ?? orderData?.billing_country,
                    countryCode:
                        orderData?.billingCountryCode ?? orderData?.billing_country_code,
                }

                const shippingAddress = mapAddressToForm(shippingSource)
                const billingAddressRaw = mapAddressToForm(billingSource)
                const billingSameAsShipping = parseBooleanLike(
                    orderData?.billingSameAsShipping,
                )

                const validitySource = parseValidityRecord(orderData?.validity)
                const rawValidUntil =
                    orderData?.validUntil ??
                    orderData?.valid_until ??
                    (validitySource?.validUntil ?? validitySource?.valid_until)

                const resolvedCustomerIdRaw =
                    orderData?.customerId ?? (orderData?.customer as any)?.id ?? null
                const resolvedCustomerId =
                    resolvedCustomerIdRaw !== null && resolvedCustomerIdRaw !== undefined
                        ? String(resolvedCustomerIdRaw)
                        : ''

                const formValues: SalesDocumentFormValues = {
                    customerId: resolvedCustomerId,
                    date: parseDateValue(orderData?.date) ?? new Date(),
                    validUntil: parseDateValue(rawValidUntil),
                    paymentMehod: (() => {
                        if (typeof orderData?.paymentMehod === 'string') {
                            return orderData.paymentMehod
                        }
                        const method = orderData?.paymentMethod
                        if (typeof method === 'string') {
                            return method
                        }
                        if (method && typeof method === 'object') {
                            const name = normalizeSegment((method as any).name)
                            if (name) {
                                return name
                            }
                        }
                        return 'Cash'
                    })(),
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

                if (resolvedCustomerId) {
                    const fallbackDetail = (orderData?.customer as any) ?? null
                    const needsDetailedFetch = !customerHasContactDetails(fallbackDetail)

                    if (fallbackDetail && active) {
                        setInitialCustomerDetail(fallbackDetail)
                    }

                    if (needsDetailedFetch) {
                        try {
                            const detailRes = await apiGetCustomerDetails<any, { id: string }>({
                                id: resolvedCustomerId,
                            })
                            if (active) {
                                const detail = (detailRes as any)?.data ?? (detailRes as any)
                                setInitialCustomerDetail(detail)
                            }
                        } catch {
                            if (!fallbackDetail && active) {
                                setInitialCustomerDetail(null)
                            }
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

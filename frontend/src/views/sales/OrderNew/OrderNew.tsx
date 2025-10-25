import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Formik,
    Form,
    Field,
    getIn,
    type FormikProps,
    type FormikHelpers,
} from 'formik'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import DatePicker from '@/components/ui/DatePicker'
import Container from '@/components/shared/Container'
import Card from '@/components/ui/Card'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import Drawer from '@/components/ui/Drawer'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { apiGetCustomers, apiGetCustomerDetails } from '@/services/CustomersService'
import { apiGetSalesProducts, apiCreateSalesOrder, apiCreateSalesProduct } from '@/services/SalesService'
import * as Yup from 'yup'
import {
    apiGetPaymentMethods,
    apiGetShippingOptions,
    apiGetSystemDisclaimer,
} from '@/services/SettingsService'
import Checkbox from '@/components/ui/Checkbox'
import PaymentSummary from '@/views/sales/OrderDetails/components/PaymentSummary'
import EditableOrderProductsTable, { EditableItem } from '@/views/sales/components/EditableOrderProductsTable'
import Steps from '@/components/ui/Steps'
import Avatar from '@/components/ui/Avatar'
import { HiMail, HiPhone, HiOutlineUser, HiOutlineCheck } from 'react-icons/hi'
import { CgCopy } from 'react-icons/cg'
import AddCustomerDrawer from '@/components/shared/AddCustomerDrawer'
import type { FormModel as CustomerFormModel } from '@/views/crm/CustomerForm'
import ProductForm, {
    FormModel as ProductFormModel,
    SetSubmitting as ProductFormSetSubmitting,
} from '@/views/sales/ProductForm'
import CountryCitySelector, {
    type CountryCityValue,
} from '@/components/shared/CountryCitySelector'
import { findCountryByName } from '@/utils/countries'
import useResponsive from '@/utils/hooks/useResponsive'
import { useExchangeRates } from '@/utils/hooks/useExchangeRates'
import classNames from 'classnames'
import { useAppSelector } from '@/store'
import dayjs from 'dayjs'
import {
    normalizeCurrencyCode,
    formatCurrency,
    formatCurrencyOptionLabel,
    STANDARD_FALLBACK_CURRENCIES,
} from '@/utils/currency'
import { resolveTextDirection } from '@/utils/textDirection'
import type { BaseCurrencySnapshot } from '@/store/slices/currency/currencySlice'
import { useSalesDocumentI18n } from '../context/useSalesDocumentI18n'
import { DEFAULT_SALES_UNIT, type SalesUnit } from '@/constants/product.constant'
import { calculateLineTotal, getDerivedUnitPrice, resolveSalesUnit } from '@/utils/salesUnitCalculation'
import { createSalesDocumentRounder } from '@/utils/salesDocumentCalculations'
import { sanitizeRichText } from '@/utils/security/inputGuards'
import { createSalesItemLineId } from '../utils/itemIdentity'

type Item = EditableItem

export type AddressFormValue = {
    street: string
    number: string
    corner: string
    apartment: string
    city: string
    state: string
    countryCode: string
}

export type ShippingFormValue = {
    shippingVendor: string
    deliveryFees: number
    estimatedMin: number
    estimatedMax: number
}

export type SalesDocumentFormValues = {
    customerId: string
    date: Date | null
    validUntil: Date | null
    paymentMehod: string
    orderCurrency: string
    items: Item[]
    shippingAddress: AddressFormValue
    billingAddress: AddressFormValue
    billingSameAsShipping: boolean
    shipping: ShippingFormValue
    comment: string
}

export type SalesDocumentSubmitPayload = {
    id?: string | number | null
    customerId?: string
    date?: string
    validUntil?: string | null
    validUntilDate?: string | null
    paymentMehod?: string
    orderCurrency: string
    items: Array<{
        productId: string
        name: string
        price: number
        qty: number
        img?: string
        description?: string
        comments?: string
        currency: string
        unitPrice: number
        unitCurrency: string
        customAttributes?: Record<string, unknown>
        pricingMethod?: string
        specSummary?: string
        specifications?: string
    }>
    shippingAddress: AddressFormValue
    billingAddress: AddressFormValue
    billingSameAsShipping: boolean
    shipping: ShippingFormValue
    comment?: string
}

export interface OrderNewProps {
    initialValues?: Partial<SalesDocumentFormValues>
    initialCustomerDetail?: any | null
    onSubmit?: (
        payload: SalesDocumentSubmitPayload,
        helpers: FormikHelpers<SalesDocumentFormValues>,
        values: SalesDocumentFormValues,
    ) => Promise<boolean | void>
    isEditing?: boolean
    documentId?: string | number | null
    disclaimer?: string | null
}

const cloneDeep = <T>(value: T): T => {
    if (Array.isArray(value)) {
        return value.map((item) => cloneDeep(item)) as unknown as T
    }
    if (value instanceof Date) {
        return new Date(value.getTime()) as unknown as T
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, val]) => [
                key,
                cloneDeep(val),
            ]),
        ) as unknown as T
    }
    return value
}

const mergeDeep = <T>(base: T, override?: Partial<T>): T => {
    const baseClone = cloneDeep(base)
    if (!override) {
        return baseClone
    }
    for (const [key, value] of Object.entries(override) as [keyof T, unknown][]) {
        if (value === undefined) {
            continue
        }
        if (value instanceof Date) {
            ;(baseClone as any)[key] = new Date(value.getTime())
            continue
        }
        if (Array.isArray(value)) {
            ;(baseClone as any)[key] = value.map((item) => cloneDeep(item))
            continue
        }
        if (value && typeof value === 'object') {
            const current = (baseClone as any)[key]
            if (
                current &&
                typeof current === 'object' &&
                !Array.isArray(current) &&
                !(current instanceof Date)
            ) {
                ;(baseClone as any)[key] = mergeDeep(current, value as any)
            } else {
                ;(baseClone as any)[key] = cloneDeep(value)
            }
            continue
        }
        ;(baseClone as any)[key] = value
    }
    return baseClone
}

type ShippingOption = {
    id: number
    name: string
    deliveryFees: number | null
    estimatedMin: number | null
    estimatedMax: number | null
    img?: string | null
}

const pickCustomerDisplayName = (customer: any): string | undefined => {
    if (!customer || typeof customer !== 'object') {
        return undefined
    }
    const candidateFields = [
        'name',
        'displayName',
        'businessName',
        'companyName',
        'fullName',
        'legalName',
    ]
    for (const field of candidateFields) {
        const value = (customer as Record<string, unknown>)[field]
        if (typeof value === 'string' && value.trim()) {
            return value.trim()
        }
    }
    return undefined
}

const OrderNew = ({
    initialValues,
    initialCustomerDetail = null,
    onSubmit,
    isEditing = false,
    documentId = null,
    disclaimer,
}: OrderNewProps) => {
    const { i18n } = useTranslation()
    const {
        t,
        tDoc,
        resource,
        routes,
        mode,
        customerRequired,
        layoutMode,
        showProductSpecifications,
        showPaymentMethodSelect,
    } = useSalesDocumentI18n()
    const itemsOnlyMode = layoutMode === 'itemsOnly'
    const docMessage = useCallback(
        (key: string, fallbackKey: string, defaultValue: string) =>
            tDoc(key, {
                defaultValue: t(fallbackKey, { defaultValue }),
            }),
        [t, tDoc],
    )
    const docSummary = useCallback(
        (key: string, defaultValue: string) =>
            docMessage(`summary.${key}`, `sales.orders.summary.${key}`, defaultValue),
        [docMessage],
    )
    const validationCustomerRequired = docMessage(
        'validation.customerRequired',
        'sales.orders.validation.customerRequired',
        'Customer is required',
    )
    const validationItemsRequired = docMessage(
        'validation.itemsRequired',
        'sales.orders.validation.itemsRequired',
        'Add at least one product',
    )
    const validationQuantityPositive = docMessage(
        'validation.quantityPositive',
        'sales.orders.validation.quantityPositive',
        'Quantity must be greater than 0',
    )
    const validationCustomerAddressRequired = docMessage(
        'validation.customerAddressRequired',
        'sales.orders.validation.customerAddressRequired',
        'The customer must have a primary address',
    )
    const disclaimerLabel = docMessage(
        'disclaimerLabel',
        'sales.orders.disclaimerLabel',
        t('text.labels.disclaimer', { defaultValue: 'Disclaimer' }),
    )
    const exchangeRateMissingMessage = docMessage(
        'exchangeRateMissing',
        'sales.orders.exchangeRateMissing',
        'Missing exchange rate for the selected currency conversion.',
    )
    const navigate = useNavigate()
    const location = useLocation()
    const storeCurrency = useAppSelector((state) => state.currency.code)
    const defaultCurrency =
        normalizeCurrencyCode(storeCurrency, 'UYU') || 'UYU'
    const fallbackCurrencyList = useMemo(() => {
        const baseList = [defaultCurrency, ...STANDARD_FALLBACK_CURRENCIES]
        const normalized = baseList
            .map((code) => normalizeCurrencyCode(code, defaultCurrency) || defaultCurrency)
            .filter((code): code is string => Boolean(code))
        return Array.from(new Set(normalized))
    }, [defaultCurrency])
    const fallbackCurrencyOptions = useMemo(
        () =>
            fallbackCurrencyList.map((code) => ({
                value: code,
                label: formatCurrencyOptionLabel(code),
            })),
        [fallbackCurrencyList],
    )
    const [customers, setCustomers] = useState<{ value: string; label: string }[]>([])
    const [products, setProducts] = useState<
        {
            value: string
            label: string
            price: number
            currency?: string
            img?: string
            description?: string
            unitOfMeasure?: SalesUnit
            specifications?: string
        }[]
    >([])
    const [methods, setMethods] = useState<{ value: string; label: string }[]>([])
    const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
    const [customerDetail, setCustomerDetail] = useState<any | null>(
        initialCustomerDetail,
    )
    const [currentStep, setCurrentStep] = useState(() => (itemsOnlyMode ? 1 : 0))
    const [newCustomerOpen, setNewCustomerOpen] = useState(false)
    const [newProductOpen, setNewProductOpen] = useState(false)
    const [taxRate, setTaxRate] = useState(22)
    const [quickMessage, setQuickMessage] = useState<string | null>(null)
    const [copyStatus, setCopyStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [documentDisclaimer, setDocumentDisclaimer] = useState<string>('')
    const [disclaimerLoading, setDisclaimerLoading] = useState(false)
    const formikRef = useRef<FormikProps<SalesDocumentFormValues>>(null)
    const initialDataLoadKeyRef = useRef<string | null>(null)
    const quickMessageRef = useRef<HTMLDivElement | null>(null)
    const initialCustomerDetailId = initialCustomerDetail?.id
    const initialCustomerValueId = initialValues?.customerId
    const initialCustomerId = useMemo(() => {
        const idCandidate =
            (initialCustomerValueId && String(initialCustomerValueId)) ||
            (initialCustomerDetailId && String(initialCustomerDetailId))
        return idCandidate?.trim() || ''
    }, [initialCustomerDetailId, initialCustomerValueId])
    const { smaller } = useResponsive()
    const isCompactViewport = smaller.md
    const shippingVendorOptions = useMemo(
        () =>
            shippingOptions.length
                ? shippingOptions.map((opt) => ({
                      label: opt.name,
                      value: opt.name,
                  }))
                : ['FedEx', 'DHL', 'UPS', 'USPS'].map((v) => ({
                      label: v,
                      value: v,
                  })),
        [shippingOptions],
    )
    const defaultValidUntil = useMemo<Date | null>(() => {
        if (mode !== 'budget') {
            return null
        }
        const validUntil = new Date()
        validUntil.setDate(validUntil.getDate() + 15)
        return validUntil
    }, [mode])

    useEffect(() => {
        setCustomerDetail(initialCustomerDetail)
    }, [initialCustomerDetail])

    useEffect(() => {
        if (mode !== 'budget') {
            setDocumentDisclaimer('')
            setDisclaimerLoading(false)
            return
        }
        if (typeof disclaimer === 'string') {
            setDocumentDisclaimer(sanitizeRichText(disclaimer))
            setDisclaimerLoading(false)
            return
        }
        let cancelled = false
        setDisclaimerLoading(true)
        apiGetSystemDisclaimer<{ html?: string }>()
            .then((res) => {
                if (cancelled) {
                    return
                }
                const html =
                    res?.data && typeof (res.data as any).html === 'string'
                        ? sanitizeRichText((res.data as any).html as string)
                        : ''
                setDocumentDisclaimer(html)
            })
            .catch(() => {
                if (!cancelled) {
                    setDocumentDisclaimer('')
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setDisclaimerLoading(false)
                }
            })
        return () => {
            cancelled = true
        }
    }, [disclaimer, mode])

    useEffect(() => {
        if (!quickMessage || !quickMessageRef.current) {
            return
        }
        quickMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, [quickMessage])

    useEffect(() => {
        if (copyStatus === 'idle') {
            return
        }
        const timer = window.setTimeout(() => setCopyStatus('idle'), 2000)
        return () => window.clearTimeout(timer)
    }, [copyStatus])

    const {
        snapshot: exchangeSnapshot,
        convert,
        refresh: refreshExchangeRates,
        ensureSnapshot: ensureExchangeSnapshot,
    } = useExchangeRates({
        autoRefresh: true,
        fallbackBase: defaultCurrency,
        fallbackCurrencies: fallbackCurrencyList,
        fallbackOptions: fallbackCurrencyOptions,
    })
    const currencyBase = exchangeSnapshot.base
    const currencies = exchangeSnapshot.currencies
    const currencyOptions = exchangeSnapshot.options
    const roundCurrencyValue = useMemo(
        () => createSalesDocumentRounder(mode),
        [mode],
    )

    const clearQuickMessage = useCallback(() => {
        setQuickMessage(null)
        setCopyStatus('idle')
    }, [])

    const hasRequiredMeasurements = useCallback((item: Item) => {
        const unit = resolveSalesUnit(item.unitOfMeasure, item.pricingMethod)
        if (unit === 'UNIT') {
            return true
        }
        const attrs = item.customAttributes
        if (!attrs || typeof attrs !== 'object') {
            return false
        }
        const readPositiveNumber = (key: string) => {
            const raw = (attrs as Record<string, unknown>)[key]
            if (raw === null || raw === undefined) {
                return undefined
            }
            if (typeof raw === 'number') {
                return Number.isFinite(raw) && raw > 0 ? raw : undefined
            }
            const numeric = Number(raw)
            return Number.isFinite(numeric) && numeric > 0 ? numeric : undefined
        }
        if (unit === 'SQUARE_METER') {
            return (
                readPositiveNumber('width') !== undefined &&
                readPositiveNumber('height') !== undefined
            )
        }
        if (unit === 'LINEAR_METER') {
            return readPositiveNumber('length') !== undefined
        }
        return true
    }, [])

    const ensureMeasurementsFilled = useCallback(
        (items: Item[]) => {
            if (!items.length) {
                return true
            }
            const incomplete = items.filter(
                (item) => !hasRequiredMeasurements(item),
            )
            if (!incomplete.length) {
                return true
            }
            const baseMessage = t('sales.documents.quickMessage.measurementMissing', {
                defaultValue:
                    'Completa las medidas requeridas (ancho, alto, largo) antes de continuar.',
            })
            const productNames = incomplete
                .map((item) =>
                    typeof item.name === 'string' ? item.name.trim() : '',
                )
                .filter((name) => name.length > 0)
            const detailSuffix = productNames.length
                ? ` (${productNames.join(', ')})`
                : ''
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {`${baseMessage}${detailSuffix}`}
                </Notification>,
                { placement: 'top-center' },
            )
            return false
        },
        [hasRequiredMeasurements, t],
    )

    const ensurePositiveQuantity = useCallback((value: unknown) => {
        const numeric = Number(value)
        if (!Number.isFinite(numeric) || numeric <= 0) {
            return { qty: 1, valid: false }
        }
        return { qty: numeric, valid: true }
    }, [])

    const ensureItemLineId = useCallback((item: Item): Item => {
        if (typeof item.lineId === 'string' && item.lineId.length > 0) {
            return item
        }
        return {
            ...item,
            lineId: createSalesItemLineId(item.productId),
        }
    }, [])

    const normalizeMeasurementValue = useCallback((value: unknown): number | undefined => {
        const numeric = Number(value)
        if (!Number.isFinite(numeric)) {
            return undefined
        }
        return Math.round(numeric * 1000) / 1000
    }, [])

    const buildMeasurementSignature = useCallback(
        (item: Item): string | null => {
            const unit = resolveSalesUnit(item.unitOfMeasure, item.pricingMethod)
            const attrs = (item.customAttributes ?? {}) as Record<string, unknown>
            if (unit === 'SQUARE_METER') {
                const width = normalizeMeasurementValue(attrs.width)
                const height = normalizeMeasurementValue(attrs.height)
                if (width === undefined || height === undefined) {
                    return null
                }
                return `${unit}:${width}x${height}`
            }
            if (unit === 'LINEAR_METER') {
                const length = normalizeMeasurementValue(attrs.length)
                if (length === undefined) {
                    return null
                }
                return `${unit}:${length}`
            }
            return null
        },
        [normalizeMeasurementValue],
    )

    const normalizeItems = useCallback(
        (items: Item[]): Item[] => {
            if (!items.length) {
                return []
            }
            const prepared = items.map(ensureItemLineId)
            const merged: Item[] = []
            const measurementMap = new Map<string, number>()

            prepared.forEach((item) => {
                const unit = resolveSalesUnit(item.unitOfMeasure, item.pricingMethod)
                if (unit === 'UNIT') {
                    merged.push(item)
                    return
                }
                const signature = buildMeasurementSignature(item)
                if (!signature) {
                    merged.push(item)
                    return
                }
                const key = `${item.productId}::${signature}`
                const existingIndex = measurementMap.get(key)
                if (existingIndex === undefined) {
                    measurementMap.set(key, merged.length)
                    merged.push(item)
                    return
                }
                const existingItem = merged[existingIndex]
                const nextQty =
                    (Number(existingItem.qty) || 0) + (Number(item.qty) || 0)
                const mergedItem: Item = {
                    ...existingItem,
                    qty: nextQty,
                }
                const nextPrice = roundCurrencyValue(getDerivedUnitPrice(mergedItem))
                mergedItem.price = nextPrice
                merged[existingIndex] = mergedItem
            })

            return merged
        },
        [buildMeasurementSignature, ensureItemLineId, roundCurrencyValue],
    )

    const updateItemsById = useCallback(
        (items: Item[], itemId: string, updater: (item: Item) => Item): Item[] => {
            let handled = false
            return items.map((item) => {
                if (handled) {
                    return item
                }
                if (item.lineId && item.lineId === itemId) {
                    handled = true
                    return updater(item)
                }
                if (item.productId === itemId) {
                    handled = true
                    return updater(item)
                }
                return item
            })
        },
        [],
    )

    const removeItemById = useCallback((items: Item[], itemId: string): Item[] => {
        let removed = false
        return items.filter((item) => {
            if (removed) {
                return true
            }
            if (item.lineId && item.lineId === itemId) {
                removed = true
                return false
            }
            if (item.productId === itemId) {
                removed = true
                return false
            }
            return true
        })
    }, [])

    const composeQuickBudgetMessage = useCallback(
        ({
            items,
            currency,
            grandTotal,
        }: {
            items: Item[]
            currency: string
            grandTotal: number
        }) => {
            if (!items.length) {
                return ''
            }
            const perUnitLabel = t('sales.documents.quickMessage.perUnit', {
                defaultValue: 'c/u',
            })
            const lines = items.map((item) => {
                const parts: string[] = []
                const qtyValue = Number(item.qty ?? 0)
                parts.push(
                    Number.isFinite(qtyValue) && qtyValue > 0 ? String(qtyValue) : '0',
                )
                if (item.name) {
                    parts.push(item.name.trim())
                }
                const specsRaw =
                    (typeof item.specSummary === 'string' && item.specSummary.trim()) ||
                    (typeof item.specifications === 'string' &&
                        item.specifications.trim()) ||
                    ''
                if (specsRaw) {
                    const specSegments = specsRaw
                        .split(/\r?\n/)
                        .map((segment) => segment.trim())
                        .filter(Boolean)
                    parts.push(...specSegments)
                }
                const commentsRaw =
                    typeof item.comments === 'string' ? item.comments.trim() : ''
                if (commentsRaw) {
                    parts.push(commentsRaw.replace(/\s+/g, ' '))
                }
                const lineTotal = roundCurrencyValue(calculateLineTotal(item))
                const formattedLineTotal = formatCurrency(
                    lineTotal,
                    currency,
                    i18n.language,
                    { fallbackCurrency: defaultCurrency },
                )
                const derivedUnitPrice = getDerivedUnitPrice(item)
                const normalizedUnitPrice = Number.isFinite(derivedUnitPrice)
                    ? roundCurrencyValue(derivedUnitPrice)
                    : roundCurrencyValue(item.price)
                const formattedUnitPrice = formatCurrency(
                    normalizedUnitPrice,
                    currency,
                    i18n.language,
                    { fallbackCurrency: defaultCurrency },
                )
                const showUnitPriceDetail =
                    Number.isFinite(qtyValue) && qtyValue > 1
                const totalPart = showUnitPriceDetail
                    ? `${formattedLineTotal} (${formattedUnitPrice} ${perUnitLabel})`
                    : formattedLineTotal
                parts.push(totalPart)
                return parts.filter(Boolean).join(' ')
            })
            const totalLabel = t('sales.documents.quickMessage.totalLabel', {
                defaultValue: 'Total a pagar',
            })
            const formattedGrandTotal = formatCurrency(
                grandTotal,
                currency,
                i18n.language,
                { fallbackCurrency: defaultCurrency },
            )
            return [...lines, `${totalLabel}: ${formattedGrandTotal}`].join(
                '\n',
            )
        },
        [defaultCurrency, i18n.language, roundCurrencyValue, t],
    )

    const copyQuickMessage = useCallback(async () => {
        if (!quickMessage) {
            return
        }
        try {
            await navigator.clipboard.writeText(quickMessage)
            setCopyStatus('success')
        } catch {
            setCopyStatus('error')
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {t('sales.documents.quickMessage.copyError', {
                        defaultValue: 'No se pudo copiar el mensaje.',
                    })}
                </Notification>,
                { placement: 'top-center' },
            )
        }
    }, [quickMessage, t])

    const convertItemToCurrency = useCallback(
        (
            item: Item,
            targetCurrency: string,
            snapshotOverride?: BaseCurrencySnapshot,
        ): Item => {
            const snapshot = snapshotOverride ?? exchangeSnapshot
            const baseCurrencyValue = snapshot.base
            const unitCurrency =
                normalizeCurrencyCode(item.unitCurrency ?? item.currency, baseCurrencyValue) ||
                baseCurrencyValue
            const target =
                normalizeCurrencyCode(targetCurrency, baseCurrencyValue) || baseCurrencyValue
            const unitPrice =
                Number.isFinite(item.unitPrice) && item.unitPrice !== undefined
                    ? Number(item.unitPrice)
                    : Number(item.price) || 0
            const { value, missingRates } = convert(unitPrice, unitCurrency, target, {
                snapshot,
            })
            const hasMissing = missingRates.length > 0 || !Number.isFinite(value)
            const nextUnitCurrency = hasMissing ? unitCurrency : target
            const convertedUnitPrice = hasMissing
                ? roundCurrencyValue(unitPrice)
                : roundCurrencyValue(value)
            const nextItem: Item = {
                ...item,
                unitPrice: convertedUnitPrice,
                unitCurrency: nextUnitCurrency,
                currency: nextUnitCurrency,
            }
            const derivedPrice = roundCurrencyValue(getDerivedUnitPrice(nextItem))
            return {
                ...nextItem,
                price: derivedPrice,
            }
        },
        [convert, exchangeSnapshot, roundCurrencyValue],
    )

    const resolvedCurrencyOptions = useMemo(
        () => (currencyOptions.length ? currencyOptions : fallbackCurrencyOptions),
        [currencyOptions, fallbackCurrencyOptions],
    )

    const enabledOrderCurrencyOptions = useMemo(
        () =>
            resolvedCurrencyOptions.filter((option) =>
                currencies.includes(option.value),
            ),
        [resolvedCurrencyOptions, currencies],
    )

    const getCurrencyLabel = useCallback(
        (code: string) => {
            const normalized = normalizeCurrencyCode(code, currencyBase) || currencyBase
            const option =
                resolvedCurrencyOptions.find((item) => item.value === normalized) ||
                fallbackCurrencyOptions.find((item) => item.value === normalized)
            return option?.label ?? normalized
        },
        [currencyBase, resolvedCurrencyOptions, fallbackCurrencyOptions],
    )

    const orderCurrencyLabel = docMessage(
        'orderCurrencyLabel',
        'sales.orders.orderCurrencyLabel',
        'Order currency',
    )
    const orderCurrencyPlaceholder = docMessage(
        'orderCurrencyPlaceholder',
        'sales.orders.orderCurrencyPlaceholder',
        'Select order currency',
    )
    const recipientLabel = customerRequired
        ? t('text.labels.recipient')
        : `${t('text.labels.recipient')} ${t('text.labels.optionalHint', {
              defaultValue: '(Opcional)',
          })}`

    const addProduct = async (data: ProductFormModel) => {
        const response = await apiCreateSalesProduct<
            boolean,
            ProductFormModel
        >(data)
        return response.data
    }

    const closeNewProductDrawer = () => {
        setNewProductOpen(false)
        const searchParams = new URLSearchParams(location.search)
        const redirectTo = searchParams.get('redirectTo')
        if (redirectTo) {
            const safeRedirect = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`
            navigate(safeRedirect, { replace: true })
            return
        }
        if (searchParams.has('addProduct')) {
            searchParams.delete('addProduct')
            searchParams.delete('redirectTo')
            const query = searchParams.toString()
            navigate(
                `${location.pathname}${query ? `?${query}` : ''}`,
                { replace: true },
            )
        }
    }

    useEffect(() => {
        const loadKey = JSON.stringify({
            defaultCurrency,
            initialCustomerId,
        })
        if (initialDataLoadKeyRef.current === loadKey) {
            return
        }
        initialDataLoadKeyRef.current = loadKey

        const load = async () => {
            try {
                const cRes = await apiGetCustomers<{ data: { id: string | number; name: string }[] }, any>({
                    pageIndex: 1,
                    pageSize: 100,
                    sort: { key: 'name', order: 'asc' },
                    query: '',
                } as any)
                const cOpts = ((cRes as any).data?.data || []).map((c: any) => ({
                    value: String(c.id),
                    label: c.name,
                }))
                const enrichedCustomerOptions = (() => {
                    if (!initialCustomerId) {
                        return cOpts
                    }
                    const resolvedLabel =
                        pickCustomerDisplayName(initialCustomerDetail) || initialCustomerId
                    const existingIndex = cOpts.findIndex(
                        (opt) => opt.value === initialCustomerId,
                    )
                    if (existingIndex >= 0) {
                        if (
                            resolvedLabel &&
                            cOpts[existingIndex].label !== resolvedLabel
                        ) {
                            const next = [...cOpts]
                            next[existingIndex] = {
                                ...next[existingIndex],
                                label: resolvedLabel,
                            }
                            return next
                        }
                        return cOpts
                    }
                    return [
                        {
                            value: initialCustomerId,
                            label: resolvedLabel || initialCustomerId,
                        },
                        ...cOpts,
                    ]
                })()
                setCustomers(enrichedCustomerOptions)

                const pRes = await apiGetSalesProducts<{ data: any[]; total: number }, any>({
                    pageIndex: 1,
                    pageSize: 100,
                    sort: { key: 'name', order: 'asc' },
                    query: '',
                })
                const pOpts =
                    (pRes as any).data?.data?.map((p: any) => ({
                        value: String(p.id),
                        label: p.name,
                        price: Number(p.salePrice ?? p.price) || 0,
                        currency:
                            normalizeCurrencyCode(p.currency, defaultCurrency) ||
                            defaultCurrency,
                        img: p.img,
                        description: p.description,
                        unitOfMeasure: (p.unitOfMeasure || DEFAULT_SALES_UNIT) as SalesUnit,
                        specifications:
                            typeof p.specifications === 'string'
                                ? p.specifications
                                : undefined,
                    })) || []
                setProducts(pOpts)

                if (showPaymentMethodSelect) {
                    const mRes = await apiGetPaymentMethods<{
                        id: number | string
                        name: string
                    }[]>()
                    const mOpts = (mRes.data as any[]).map((m) => ({
                        value: String(m.name || m.id),
                        label: m.name,
                    }))
                    setMethods(mOpts)
                    const formik = formikRef.current
                    if (formik) {
                        const currentValue = (formik.values as any)?.paymentMehod
                        const hasCurrent = mOpts.some((opt) => opt.value === currentValue)
                        if (!hasCurrent) {
                            const cashOption = mOpts.find((opt) => {
                                const label = (opt.label ?? '').toString().toLowerCase()
                                const value = (opt.value ?? '').toString().toLowerCase()
                                return (
                                    label === 'efectivo' ||
                                    label === 'cash' ||
                                    value === 'efectivo' ||
                                    value === 'cash'
                                )
                            })
                            const fallback = cashOption ?? mOpts[0]
                            if (fallback) {
                                formik.setFieldValue('paymentMehod', fallback.value, false)
                            }
                        }
                    }
                } else {
                    setMethods([])
                    const formik = formikRef.current
                    if (formik) {
                        const currentValue = (formik.values as any)?.paymentMehod
                        if (currentValue !== 'Cash') {
                            formik.setFieldValue('paymentMehod', 'Cash', false)
                        }
                    }
                }

                try {
                    const sRes = await apiGetShippingOptions<ShippingOption[]>()
                    const sOpts = ((sRes as any).data || []) as ShippingOption[]
                    setShippingOptions(
                        sOpts.map((opt) => ({
                            ...opt,
                            deliveryFees: Number(opt.deliveryFees ?? 0),
                            estimatedMin: Number(opt.estimatedMin ?? 0),
                            estimatedMax: Number(opt.estimatedMax ?? opt.estimatedMin ?? 0),
                        })),
                    )
                } catch {
                    setShippingOptions([])
                }

                try {
                    const result = await refreshExchangeRates()
                    const payload = result?.payload
                    const snapshot = result?.snapshot ?? exchangeSnapshot
                    const newTaxRate = Number(payload?.taxRate)
                    if (!Number.isNaN(newTaxRate) && newTaxRate > 0) {
                        setTaxRate(newTaxRate)
                    }
                    const formik = formikRef.current
                    if (formik) {
                        const previousOrderCurrency =
                            normalizeCurrencyCode(
                                (formik.values as any)?.orderCurrency,
                                snapshot.base,
                            ) || snapshot.base
                        const nextOrderCurrency = snapshot.base
                        formik.setFieldValue('orderCurrency', nextOrderCurrency, false)
                        const existingItems: Item[] = (formik.values as any)?.items || []
                        if (existingItems.length) {
                            const updatedItems = existingItems.map((item) =>
                                convertItemToCurrency(
                                    {
                                        ...item,
                                        unitPrice:
                                            Number.isFinite(item.unitPrice) &&
                                            item.unitPrice !== undefined
                                                ? Number(item.unitPrice)
                                                : Number(item.price) || 0,
                                        unitCurrency:
                                            normalizeCurrencyCode(
                                                item.unitCurrency ?? item.currency,
                                                previousOrderCurrency,
                                            ) || previousOrderCurrency,
                                    },
                                    nextOrderCurrency,
                                    snapshot,
                                ),
                            )
                            formik.setFieldValue(
                                'items',
                                normalizeItems(updatedItems as Item[]),
                                false,
                            )
                        }
                        const currentDeliveryFee = Number(
                            (formik.values as any)?.shipping?.deliveryFees ?? 0,
                        )
                        if (currentDeliveryFee) {
                            const { value } = convert(
                                currentDeliveryFee,
                                previousOrderCurrency,
                                nextOrderCurrency,
                                { snapshot },
                            )
                            if (Number.isFinite(value)) {
                                formik.setFieldValue(
                                    'shipping.deliveryFees',
                                    roundCurrencyValue(value),
                                    false,
                                )
                            }
                        }
                    }
                } catch (error: unknown) {
                    const message =
                        (error as any)?.response?.data?.message ||
                        (error instanceof Error ? error.message : String(error))
                    toast.push(
                        <Notification title={t('validation.failed')} type="danger">
                            {message}
                        </Notification>,
                        { placement: 'top-center' },
                    )
                }
            } finally {
                initialDataLoadKeyRef.current = loadKey
            }
        }

        load().catch(() => {
            initialDataLoadKeyRef.current = null
        })
    }, [
        convert,
        convertItemToCurrency,
        defaultCurrency,
        exchangeSnapshot,
        initialCustomerDetail,
        initialCustomerId,
        normalizeItems,
        refreshExchangeRates,
        roundCurrencyValue,
        showPaymentMethodSelect,
        t,
    ])

    useEffect(() => {
        if (itemsOnlyMode) {
            setCurrentStep(1)
        }
    }, [itemsOnlyMode])

    useEffect(() => {
        const sp = new URLSearchParams(location.search)
        if (!itemsOnlyMode) {
            const s = sp.get('step')
            if (s) {
                const n = Number(s)
                if (!Number.isNaN(n)) {
                    setCurrentStep(Math.max(0, Math.min(3, n)))
                }
            }
        }
        const openProduct = sp.get('addProduct')
        if (openProduct === '1' || openProduct === 'true') {
            setNewProductOpen(true)
        }
    }, [itemsOnlyMode, location.search])

    useEffect(() => {
        if (itemsOnlyMode || !shippingOptions.length || !formikRef.current) {
            return
        }
        const formik = formikRef.current
        const currentVendor = (formik.values as any)?.shipping?.shippingVendor
        const existing = shippingOptions.find((opt) => opt.name === currentVendor)
        if (!existing) {
            const first = shippingOptions[0]
            formik.setFieldValue('shipping.shippingVendor', first.name)
            const currentOrderCurrency =
                normalizeCurrencyCode((formik.values as any)?.orderCurrency, currencyBase) ||
                currencyBase
            const { value } = convert(
                Number(first.deliveryFees ?? 0),
                currencyBase,
                currentOrderCurrency,
            )
            formik.setFieldValue(
                'shipping.deliveryFees',
                Number.isFinite(value)
                    ? roundCurrencyValue(value)
                    : roundCurrencyValue(Number(first.deliveryFees ?? 0)),
            )
            formik.setFieldValue(
                'shipping.estimatedMin',
                first.estimatedMin ?? 0,
            )
            formik.setFieldValue(
                'shipping.estimatedMax',
                first.estimatedMax ?? first.estimatedMin ?? 0,
            )
        }
    }, [convert, currencyBase, itemsOnlyMode, roundCurrencyValue, shippingOptions])

    const pageTitle = tDoc('title', {
        defaultValue: t('sales.orders.title', { defaultValue: 'Orders' }),
    })
    const listNavLabel = tDoc('listNavLabel', {
        defaultValue: t('nav.appsSales.orderList'),
    })
    const addActionLabel = tDoc('addAction', {
        defaultValue: t('text.actions.add'),
    })
    const editActionLabel = docMessage(
        'detailsTitle',
        'sales.orders.detailsTitle',
        t('text.titles.details', { defaultValue: 'Details' }),
    )
    const defaultInitialValues = useMemo<SalesDocumentFormValues>(
        () => ({
            customerId: '',
            date: new Date(),
            validUntil: defaultValidUntil ? new Date(defaultValidUntil) : null,
            paymentMehod: 'Cash',
            orderCurrency: defaultCurrency,
            items: [],
            shippingAddress: {
                street: '',
                number: '',
                corner: '',
                apartment: '',
                city: 'Montevideo',
                state: 'Uruguay',
                countryCode: 'UY',
            },
            billingAddress: {
                street: '',
                number: '',
                corner: '',
                apartment: '',
                city: 'Montevideo',
                state: 'Uruguay',
                countryCode: 'UY',
            },
            billingSameAsShipping: true,
            shipping: {
                shippingVendor: '',
                deliveryFees: 0,
                estimatedMin: 0,
                estimatedMax: 0,
            },
            comment: '',
        }),
        [defaultCurrency, defaultValidUntil],
    )
    const formInitialValues = useMemo(() => {
        const merged = mergeDeep(defaultInitialValues, initialValues) as SalesDocumentFormValues
        const initialItems = Array.isArray(merged.items)
            ? ((merged.items as unknown as Item[]) || []).filter(Boolean)
            : []
        return {
            ...merged,
            items: normalizeItems(initialItems),
        }
    }, [defaultInitialValues, initialValues, normalizeItems])

    useEffect(() => {
        if (!initialCustomerId) {
            return
        }
        const labelFromInitialDetail = pickCustomerDisplayName(initialCustomerDetail)
        const labelFromLoadedDetail = pickCustomerDisplayName(customerDetail)
        const resolvedLabel =
            labelFromInitialDetail ||
            labelFromLoadedDetail ||
            initialCustomerId
        setCustomers((prev) => {
            const exists = prev.find((opt) => opt.value === initialCustomerId)
            if (exists) {
                if (exists.label === resolvedLabel || !resolvedLabel) {
                    return prev
                }
                return prev.map((opt) =>
                    opt.value === initialCustomerId && opt.label !== resolvedLabel
                        ? { ...opt, label: resolvedLabel }
                        : opt,
                )
            }
            return [{ value: initialCustomerId, label: resolvedLabel }, ...prev]
        })
    }, [customerDetail, initialCustomerDetail, initialCustomerId])
    const hasDisclaimer = useMemo(() => {
        if (!documentDisclaimer) {
            return false
        }
        const plain = documentDisclaimer.replace(/<[^>]+>/g, ' ').trim()
        return plain.length > 0
    }, [documentDisclaimer])
    const disclaimerDirection = useMemo(() => {
        if (!hasDisclaimer) {
            return 'ltr'
        }
        const plain = documentDisclaimer.replace(/<[^>]+>/g, ' ').trim()
        return resolveTextDirection(plain)
    }, [documentDisclaimer, hasDisclaimer])
    const showDisclaimerCard = mode === 'budget' && (hasDisclaimer || disclaimerLoading)
    const pageHeading = layoutMode === 'itemsOnly'
        ? pageTitle
        : isEditing
        ? `${listNavLabel} · ${editActionLabel}`
        : `${listNavLabel} · ${addActionLabel}`

    return (
        <Container className="h-full">
            <h3 className="mb-6">{pageHeading}</h3>
            <Formik<SalesDocumentFormValues>
                innerRef={formikRef}
                enableReinitialize
                initialValues={formInitialValues}
                validationSchema={Yup.object().shape({
                    customerId: customerRequired
                        ? Yup.string().required(validationCustomerRequired)
                        : Yup.string()
                              .transform((value) => (value === '' ? undefined : value))
                              .nullable(),
                    date: Yup.date()
                        .typeError(t('text.validation.invalidDate'))
                        .required(t('text.validation.dateRequired')),
                    validUntil: Yup.date()
                        .nullable()
                        .typeError(t('text.validation.invalidDate')),
                    paymentMehod: showPaymentMethodSelect
                        ? Yup.string().required('Payment method is required')
                        : Yup.string().nullable(),
                    orderCurrency: Yup.string()
                        .trim()
                        .required(
                            t('validation.fieldRequired', {
                                field: orderCurrencyLabel,
                            }),
                        ),
                    shippingAddress: itemsOnlyMode
                        ? Yup.object().shape({
                              street: Yup.string(),
                              number: Yup.string(),
                              city: Yup.string(),
                              state: Yup.string(),
                              countryCode: Yup.string(),
                              corner: Yup.string().nullable(),
                              apartment: Yup.string().nullable(),
                          })
                        : Yup.object().shape({
                              street: Yup.string().required(t('text.validation.enterAddress')),
                              number: Yup.string().required(t('text.validation.enterAddress')),
                              city: Yup.string().required(t('text.validation.enterCity')),
                              state: Yup.string().required(t('text.validation.enterState')),
                              countryCode: Yup.string().required(
                                  t('text.validation.selectCountry'),
                              ),
                              corner: Yup.string().nullable(),
                              apartment: Yup.string().nullable(),
                          }),
                    billingSameAsShipping: Yup.boolean(),
                    billingAddress: itemsOnlyMode
                        ? Yup.object().shape({
                              street: Yup.string(),
                              number: Yup.string(),
                              city: Yup.string(),
                              state: Yup.string(),
                              countryCode: Yup.string(),
                              corner: Yup.string().nullable(),
                              apartment: Yup.string().nullable(),
                          })
                        : Yup.object().shape({
                              street: Yup.string().required(t('text.validation.enterAddress')),
                              number: Yup.string().required(t('text.validation.enterAddress')),
                              city: Yup.string().required(t('text.validation.enterCity')),
                              state: Yup.string().required(t('text.validation.enterState')),
                              countryCode: Yup.string().required(
                                  t('text.validation.selectCountry'),
                              ),
                              corner: Yup.string().nullable(),
                              apartment: Yup.string().nullable(),
                          }),
                    comment: Yup.string(),
                    items: Yup.array()
                        .of(
                            Yup.object().shape({
                                productId: Yup.string().required(),
                                qty: Yup.number().min(1).required(),
                                price: Yup.number().min(0).required(),
                            }),
                        )
                        .min(1, validationItemsRequired),
                })}
                onSubmit={async (values, formikHelpers) => {
                    const orderCurrencyValue =
                        normalizeCurrencyCode(values.orderCurrency, currencyBase) || currencyBase

                    if (itemsOnlyMode) {
                        if (!ensureMeasurementsFilled(values.items as Item[])) {
                            return
                        }
                        const deliveryFee = roundCurrencyValue(
                            Number(values.shipping?.deliveryFees ?? 0),
                        )
                        const lineTotals = values.items.map((item) =>
                            roundCurrencyValue(calculateLineTotal(item)),
                        )
                        const rawTotal = lineTotals.reduce(
                            (accumulator, lineTotal) => accumulator + lineTotal,
                            0,
                        )
                        const total = roundCurrencyValue(rawTotal)
                        const grandTotal = roundCurrencyValue(total + deliveryFee)
                        const message = composeQuickBudgetMessage({
                            items: values.items as Item[],
                            currency: orderCurrencyValue,
                            grandTotal,
                        })
                        if (!message) {
                            toast.push(
                                <Notification title={t('validation.failed')} type="danger">
                                    {validationItemsRequired}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            return
                        }
                        setCopyStatus('idle')
                        setQuickMessage(message)
                        return
                    }

                    const normalizePriceValue = (value: unknown) => {
                        const numeric = Number(value)
                        if (!Number.isFinite(numeric)) {
                            return 0
                        }
                        return mode === 'budget' ? roundCurrencyValue(numeric) : numeric
                    }
                    const normalizeAddress = (
                        addr: SalesDocumentFormValues['shippingAddress'],
                    ): AddressFormValue => ({
                        street: addr.street,
                        number: addr.number,
                        corner: addr.corner ?? '',
                        apartment: addr.apartment ?? '',
                        city: addr.city,
                        state: addr.state,
                        countryCode: addr.countryCode,
                    })

                    const shippingAddress = normalizeAddress(values.shippingAddress)
                    const billingAddress = values.billingSameAsShipping
                        ? shippingAddress
                        : normalizeAddress(values.billingAddress)

                    const isoValidUntil = values.validUntil
                        ? new Date(values.validUntil as any).toISOString()
                        : undefined

                    const payload: SalesDocumentSubmitPayload = {
                        customerId: values.customerId ? String(values.customerId) : undefined,
                        // Backend expects ISO 8601 date string (IsDateString)
                        date: values.date ? new Date(values.date as any).toISOString() : undefined,
                        validUntil: isoValidUntil,
                        validUntilDate: isoValidUntil,
                        paymentMehod: String(values.paymentMehod || 'Cash'),
                        orderCurrency: orderCurrencyValue,
                        items: values.items.map((it) => {
                            const rawUnitPrice = Number(it.unitPrice)
                            const normalizedUnitPrice = Number.isFinite(rawUnitPrice)
                                ? normalizePriceValue(rawUnitPrice)
                                : normalizePriceValue(it.price)
                            const customAttrs =
                                it.customAttributes && Object.keys(it.customAttributes).length > 0
                                    ? it.customAttributes
                                    : undefined
                            const pricingMethod =
                                (typeof it.pricingMethod === 'string' && it.pricingMethod.trim()) ||
                                (typeof it.unitOfMeasure === 'string' && it.unitOfMeasure.trim()) ||
                                undefined
                            return {
                                productId: String(it.productId),
                                name: it.name,
                                price: normalizePriceValue(it.price),
                                qty: Number(it.qty) || 1,
                                img: it.img,
                                description: it.description,
                                comments: it.comments,
                                currency: orderCurrencyValue,
                                unitPrice: normalizedUnitPrice,
                                unitCurrency:
                                    normalizeCurrencyCode(it.unitCurrency, orderCurrencyValue) ||
                                    normalizeCurrencyCode(it.currency, orderCurrencyValue) ||
                                    orderCurrencyValue,
                                customAttributes: customAttrs,
                                pricingMethod,
                                specSummary:
                                    typeof it.specSummary === 'string'
                                        ? it.specSummary
                                        : undefined,
                                specifications:
                                    typeof it.specifications === 'string'
                                        ? it.specifications
                                        : undefined,
                            }
                        }),
                        shippingAddress,
                        billingAddress,
                        billingSameAsShipping: Boolean(values.billingSameAsShipping),
                        shipping: {
                            shippingVendor: values.shipping?.shippingVendor,
                            deliveryFees: normalizePriceValue(
                                values.shipping?.deliveryFees ?? 0,
                            ),
                            estimatedMin: Number(values.shipping?.estimatedMin ?? 0),
                            estimatedMax: Number(values.shipping?.estimatedMax ?? 0),
                        },
                        comment: values.comment,
                    }
                    if (documentId !== null && documentId !== undefined) {
                        payload.id = documentId
                    }
                    if (!itemsOnlyMode) {
                        // Ensure shipping address is filled
                        const saddr = values.shippingAddress || {}
                        if (
                            !saddr.street ||
                            !saddr.number ||
                            !saddr.state ||
                            !saddr.city ||
                            !saddr.countryCode
                        ) {
                            toast.push(
                                <Notification title={t('validation.failed')} type="danger">
                                    {validationCustomerAddressRequired}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            setCurrentStep(0)
                            return
                        }

                        if (!values.billingSameAsShipping) {
                            const baddr = values.billingAddress || {}
                            if (
                                !baddr.street ||
                                !baddr.number ||
                                !baddr.state ||
                                !baddr.city ||
                                !baddr.countryCode
                            ) {
                                toast.push(
                                    <Notification title={t('validation.failed')} type="danger">
                                        {validationCustomerAddressRequired}
                                    </Notification>,
                                    { placement: 'top-center' },
                                )
                                setCurrentStep(0)
                                return
                            }
                        }
                    }

                    if (onSubmit) {
                        await onSubmit(payload, formikHelpers, values)
                        return
                    }

                    try {
                        const res = await apiCreateSalesOrder<boolean, any>(payload, resource)
                        if ((res as any).data || (res as any) === true) {
                            toast.push(
                                <Notification
                                    title={docMessage(
                                        'created.title',
                                        'sales.orders.created.title',
                                        'Document created successfully',
                                    )}
                                    type="success"
                                >
                                    {docMessage(
                                        'created.desc',
                                        'sales.orders.created.desc',
                                        'The document was created successfully.',
                                    )}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            navigate(routes.list)
                        }
                    } catch (e: any) {
                        const errs = e?.response?.data?.errors as { field: string; key: string }[]
                        if (Array.isArray(errs) && errs.length) {
                            const lines = errs
                                .map((er) => t(er.key, { field: er.field }))
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
                                    {e?.response?.data?.message || e?.message || String(e)}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                        }
                    }
                }}
            >
                {({ values, setFieldValue, errors, touched, setFieldTouched }) => {
                    const deliveryFee = roundCurrencyValue(
                        Number(values.shipping?.deliveryFees ?? 0),
                    )
                    const orderCurrencyValue =
                        normalizeCurrencyCode(values.orderCurrency, currencyBase) || currencyBase
                    const orderCurrencyOptions =
                        enabledOrderCurrencyOptions.length
                            ? enabledOrderCurrencyOptions
                            : resolvedCurrencyOptions
                    const orderCurrencySelected =
                        orderCurrencyOptions.find((opt) => opt.value === orderCurrencyValue) || {
                            value: orderCurrencyValue,
                            label: getCurrencyLabel(orderCurrencyValue),
                        }
                    const lineTotals =
                        mode === 'budget'
                            ? values.items.map((item) =>
                                  roundCurrencyValue(calculateLineTotal(item)),
                              )
                            : values.items.map((item) => calculateLineTotal(item))
                    const rawTotal = lineTotals.reduce(
                        (runningTotal, lineTotal) => runningTotal + lineTotal,
                        0,
                    )
                    const total =
                        mode === 'budget'
                            ? rawTotal
                            : roundCurrencyValue(rawTotal)
                    const tax = roundCurrencyValue(total * (taxRate / (100 + taxRate)))
                    const grandTotal = roundCurrencyValue(total + deliveryFee)
                    const formattedOrderTotal = formatCurrency(
                        total,
                        orderCurrencyValue,
                        i18n.language,
                        { fallbackCurrency: defaultCurrency },
                    )
                    const formattedTax = formatCurrency(
                        tax,
                        orderCurrencyValue,
                        i18n.language,
                        { fallbackCurrency: defaultCurrency },
                    )
                    const formattedDeliveryFee = formatCurrency(
                        deliveryFee,
                        orderCurrencyValue,
                        i18n.language,
                        { fallbackCurrency: defaultCurrency },
                    )
                    const formattedGrandTotal = formatCurrency(
                        grandTotal,
                        orderCurrencyValue,
                        i18n.language,
                        { fallbackCurrency: defaultCurrency },
                    )
                    if (mode === 'budget' && !isEditing) {
                        const validUntilTouched = Boolean(getIn(touched, 'validUntil'))
                        if (!validUntilTouched) {
                            const creationDate = values.date ? dayjs(values.date as any) : null
                            if (creationDate && creationDate.isValid()) {
                                const expectedValidUntil = creationDate.add(15, 'day')
                                const currentValidUntil = values.validUntil
                                    ? dayjs(values.validUntil as any)
                                    : null
                                if (
                                    !currentValidUntil ||
                                    !currentValidUntil.isSame(expectedValidUntil, 'day')
                                ) {
                                    setFieldValue('validUntil', expectedValidUntil.toDate(), false)
                                }
                            }
                        }
                    }
                    const getAddressLines = (addr?: typeof values.shippingAddress) => {
                        if (!addr) {
                            return []
                        }
                        const composed = [
                            [addr.street, addr.number]
                                .filter(Boolean)
                                .join(' ')
                                .trim(),
                            addr.corner,
                            addr.apartment,
                            [addr.city, addr.state]
                                .filter(Boolean)
                                .join(', ')
                                .trim(),
                            addr.countryCode,
                        ]
                        return composed.filter(
                            (line) => Boolean(line && line.length),
                        ) as string[]
                    }
                    const shippingAddressLines = getAddressLines(values.shippingAddress)
                    const billingAddressLines = values.billingSameAsShipping
                        ? shippingAddressLines
                        : getAddressLines(values.billingAddress)
                    const paymentMethodLabel =
                        methods.find((m) => m.value === values.paymentMehod)?.label ||
                        t('text.labels.notSelected', { defaultValue: 'Not selected' })
                    const customerOption = customers.find(
                        (opt) => opt.value === values.customerId,
                    )
                    const customerName =
                        customerDetail?.name ||
                        customerOption?.label ||
                        docSummary('unknownCustomer', 'Unassigned customer')
                    const customerEmail = customerDetail?.email
                    const customerPhone = customerDetail?.personalInfo?.phoneNumbers?.[0]
                    const convertWithRetry = async (
                        amount: number,
                        fromCurrency: string,
                        toCurrency: string,
                    ) => {
                        const attempt = convert(amount, fromCurrency, toCurrency)
                        if (attempt.missingRates.length === 0 && Number.isFinite(attempt.value)) {
                            return attempt
                        }
                        try {
                            const refreshed = await refreshExchangeRates()
                            const snapshotOverride = refreshed?.snapshot ?? attempt.snapshot
                            return convert(amount, fromCurrency, toCurrency, {
                                snapshot: snapshotOverride,
                            })
                        } catch {
                            return attempt
                        }
                    }

                    const addItem = async (
                        pid: string,
                        option?: {
                            value: string
                            label: string
                            price: number
                            currency?: string
                            img?: string
                            description?: string
                            unitOfMeasure?: SalesUnit
                            specifications?: string
                        },
                    ) => {
                        if (!ensureMeasurementsFilled(values.items as Item[])) {
                            return
                        }
                        const p = option ?? products.find((x) => x.value === pid)
                        if (!p) return
                        const matchingItems = (values.items as Item[]).filter(
                            (it) => it.productId === pid,
                        )
                        const prospectiveUnit = resolveSalesUnit(
                            p.unitOfMeasure ?? DEFAULT_SALES_UNIT,
                            p.unitOfMeasure ?? DEFAULT_SALES_UNIT,
                        )
                        const hasUnitDuplicate = matchingItems.some(
                            (item) =>
                                resolveSalesUnit(item.unitOfMeasure, item.pricingMethod) === 'UNIT',
                        )
                        if (prospectiveUnit === 'UNIT' && hasUnitDuplicate) {
                            return
                        }
                        const productCurrency =
                            normalizeCurrencyCode(p.currency, currencyBase) || currencyBase
                        const unitPrice = Number(p.price) || 0
                        const conversion = await convertWithRetry(
                            unitPrice,
                            productCurrency,
                            orderCurrencyValue,
                        )
                        if (
                            conversion.missingRates.length ||
                            !Number.isFinite(conversion.value)
                        ) {
                            toast.push(
                                <Notification title={t('validation.failed')} type="danger">
                                    {exchangeRateMissingMessage}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            return
                        }
                        const convertedUnitPrice = roundCurrencyValue(conversion.value)
                        const baseItem: Item = {
                            productId: pid,
                            name: p.label,
                            price: 0,
                            currency: orderCurrencyValue,
                            qty: 1,
                            img: p.img,
                            description: p.description,
                            specifications:
                                typeof p.specifications === 'string'
                                    ? p.specifications
                                    : undefined,
                            unitPrice: convertedUnitPrice,
                            unitCurrency: orderCurrencyValue,
                            comments: '',
                            customAttributes: {},
                            pricingMethod: p.unitOfMeasure ?? DEFAULT_SALES_UNIT,
                            unitOfMeasure: p.unitOfMeasure ?? DEFAULT_SALES_UNIT,
                        }
                        const derivedPrice = roundCurrencyValue(
                            getDerivedUnitPrice(baseItem),
                        )
                        const nextItem: Item = {
                            ...baseItem,
                            price: derivedPrice,
                            lineId: createSalesItemLineId(pid),
                        }
                        clearQuickMessage()
                        setFieldValue(
                            'items',
                            normalizeItems([...(values.items as Item[]), nextItem]),
                        )
                    }
                    const removeItem = (itemId: string) => {
                        clearQuickMessage()
                        const remaining = removeItemById(values.items as Item[], itemId)
                        setFieldValue('items', normalizeItems(remaining))
                    }
                    const changeQty = (itemId: string, qty: number) => {
                        clearQuickMessage()
                        const { qty: normalizedQty, valid } = ensurePositiveQuantity(qty)
                        if (!valid) {
                            toast.push(
                                <Notification title={t('validation.failed')} type="danger">
                                    {validationQuantityPositive}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                        }
                        const updated = updateItemsById(
                            values.items as Item[],
                            itemId,
                            (item) => {
                                const next: Item = { ...item, qty: normalizedQty }
                                const nextPrice = roundCurrencyValue(
                                    getDerivedUnitPrice(next),
                                )
                                return { ...next, price: nextPrice }
                            },
                        )
                        setFieldValue('items', normalizeItems(updated))
                    }
                    const changeComment = (itemId: string, comments: string) => {
                        clearQuickMessage()
                        const updated = updateItemsById(
                            values.items as Item[],
                            itemId,
                            (item) => ({ ...item, comments }),
                        )
                        setFieldValue('items', normalizeItems(updated))
                    }
                    const handleItemChange = (
                        itemId: string,
                        patch: Partial<Item>,
                    ) => {
                        clearQuickMessage()
                        const updated = updateItemsById(
                            values.items as Item[],
                            itemId,
                            (item) => {
                                const next: Item = {
                                    ...item,
                                    ...patch,
                                }
                                if (patch.customAttributes !== undefined) {
                                    next.customAttributes = patch.customAttributes
                                }
                                if (patch.pricingMethod !== undefined) {
                                    next.pricingMethod = patch.pricingMethod
                                }
                                if (patch.unitOfMeasure !== undefined) {
                                    next.unitOfMeasure = patch.unitOfMeasure
                                }
                                if (patch.specSummary !== undefined) {
                                    next.specSummary = patch.specSummary
                                }
                                if (patch.qty !== undefined) {
                                    const { qty: normalizedQty, valid } =
                                        ensurePositiveQuantity(patch.qty)
                                    next.qty = normalizedQty
                                    if (!valid) {
                                        toast.push(
                                            <Notification title={t('validation.failed')} type="danger">
                                                {validationQuantityPositive}
                                            </Notification>,
                                            { placement: 'top-center' },
                                        )
                                    }
                                }
                                const derivedPrice = roundCurrencyValue(
                                    getDerivedUnitPrice(next),
                                )
                                next.price = derivedPrice
                                return next
                            },
                        )
                        setFieldValue('items', normalizeItems(updated))
                    }

                    const handleOrderCurrencySelect = async (option: unknown) => {
                        const nextValue =
                            normalizeCurrencyCode(
                                (option as { value?: string } | null)?.value,
                                currencyBase,
                            ) || currencyBase
                        if (nextValue === orderCurrencyValue) {
                            return
                        }

                        const evaluateSnapshot = (snapshot: BaseCurrencySnapshot) => {
                            const itemsMissing = values.items.some((item) => {
                                const unitCurrency =
                                    normalizeCurrencyCode(
                                        item.unitCurrency ?? item.currency,
                                        snapshot.base,
                                    ) || snapshot.base
                                const unitPrice =
                                    Number.isFinite(item.unitPrice) &&
                                    item.unitPrice !== undefined
                                        ? Number(item.unitPrice)
                                        : Number(item.price) || 0
                                const result = convert(unitPrice, unitCurrency, nextValue, {
                                    snapshot,
                                })
                                return result.missingRates.length > 0
                            })
                            const deliveryFeeValue = Number(values.shipping?.deliveryFees ?? 0)
                            const deliveryResult = convert(
                                deliveryFeeValue,
                                orderCurrencyValue,
                                nextValue,
                                { snapshot },
                            )
                            const missing =
                                itemsMissing || deliveryResult.missingRates.length > 0
                            return { snapshot, deliveryResult, missing }
                        }

                        let snapshot = await ensureExchangeSnapshot()
                        let attempt = evaluateSnapshot(snapshot)
                        if (attempt.missing) {
                            try {
                                const refreshed = await refreshExchangeRates()
                                if (refreshed?.snapshot) {
                                    snapshot = refreshed.snapshot
                                    attempt = evaluateSnapshot(snapshot)
                                }
                            } catch {
                                // ignore and fall through to error toast
                            }
                        }

                        if (attempt.missing) {
                            toast.push(
                                <Notification title={t('validation.failed')} type="danger">
                                    {exchangeRateMissingMessage}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            return
                        }

                        const convertedItems = values.items.map((item) =>
                            convertItemToCurrency(item, nextValue, snapshot),
                        )
                        const normalizedConverted = normalizeItems(
                            convertedItems as Item[],
                        )
                        const convertedFee = Number.isFinite(attempt.deliveryResult.value)
                            ? roundCurrencyValue(attempt.deliveryResult.value)
                            : roundCurrencyValue(Number(values.shipping?.deliveryFees ?? 0))
                        setFieldValue('orderCurrency', nextValue)
                        clearQuickMessage()
                        setFieldValue('items', normalizedConverted)
                        setFieldValue('shipping.deliveryFees', convertedFee)
                    }

                    const handleCreateProduct = async (
                        formData: ProductFormModel,
                        setSubmitting: ProductFormSetSubmitting,
                    ) => {
                        setSubmitting(true)
                        try {
                            const success = await addProduct(formData)
                            if (success) {
                                const pRes = await apiGetSalesProducts<{ data: any[]; total: number }, any>({
                                    pageIndex: 1,
                                    pageSize: 100,
                                    sort: { key: 'name', order: 'asc' },
                                    query: '',
                                })
                                const pOpts =
                                    ((pRes as any).data?.data || []).map((p: any) => ({
                                        value: String(p.id),
                                        label: p.name,
                                        price: Number(p.salePrice ?? p.price) || 0,
                                        currency:
                                            normalizeCurrencyCode(p.currency, defaultCurrency) ||
                                            defaultCurrency,
                                        img: p.img,
                                        description: p.description,
                                        unitOfMeasure: (p.unitOfMeasure || DEFAULT_SALES_UNIT) as SalesUnit,
                                        specifications:
                                            typeof p.specifications === 'string'
                                                ? p.specifications
                                                : undefined,
                                    })) || []
                                setProducts(pOpts)
                                const created = (pRes as any).data?.data?.find(
                                    (p: any) => String(p.name) === String(formData.name),
                                )
                                if (created) {
                                    const createdCurrency =
                                        normalizeCurrencyCode(created.currency, defaultCurrency) ||
                                        defaultCurrency
                                    const option =
                                        pOpts.find((opt) => opt.value === String(created.id)) ?? {
                                            value: String(created.id),
                                            label: created.name,
                                            price: Number(created.salePrice ?? created.price) || 0,
                                            currency: createdCurrency,
                                            img: created.img,
                                            description: created.description,
                                            unitOfMeasure: (created.unitOfMeasure || DEFAULT_SALES_UNIT) as SalesUnit,
                                        }
                                    await addItem(String(created.id), option)
                                }
                                toast.push(
                                    <Notification
                                        title={'Successfuly added'}
                                        type="success"
                                        duration={2500}
                                    >
                                        Product successfuly added
                                    </Notification>,
                                    {
                                        placement: 'top-center',
                                    },
                                )
                                closeNewProductDrawer()
                            }
                        } catch (error: unknown) {
                            const message =
                                (error as any)?.response?.data?.message ||
                                (error instanceof Error ? error.message : String(error))
                            toast.push(
                                <Notification title={t('validation.failed')} type="danger">
                                    {message}
                                </Notification>,
                                {
                                    placement: 'top-center',
                                },
                            )
                        } finally {
                            setSubmitting(false)
                        }
                    }

                    const isAddressComplete = (addr?: typeof values.shippingAddress) =>
                        Boolean(
                            addr &&
                                addr.street &&
                                addr.number &&
                                addr.city &&
                                addr.state &&
                                addr.countryCode,
                        )

                    const syncBillingWithShipping = () => {
                        setFieldValue('billingAddress', {
                            ...values.shippingAddress,
                        })
                    }

                    const shippingCountryError = getIn(
                        errors,
                        'shippingAddress.state',
                    ) as string | undefined
                    const shippingCityError = getIn(
                        errors,
                        'shippingAddress.city',
                    ) as string | undefined
                    const shippingCountryTouched = getIn(
                        touched,
                        'shippingAddress.state',
                    )
                    const shippingCityTouched = getIn(
                        touched,
                        'shippingAddress.city',
                    )
                    const showShippingLocationError = Boolean(
                        (shippingCountryTouched && shippingCountryError) ||
                            (shippingCityTouched && shippingCityError),
                    )
                    const shippingLocationErrorMessage =
                        (shippingCountryTouched && shippingCountryError
                            ? shippingCountryError
                            : undefined) ??
                        (shippingCityTouched && shippingCityError
                            ? shippingCityError
                            : undefined) ??
                        shippingCityError ??
                        shippingCountryError

                    const billingCountryError = getIn(
                        errors,
                        'billingAddress.state',
                    ) as string | undefined
                    const billingCityError = getIn(
                        errors,
                        'billingAddress.city',
                    ) as string | undefined
                    const billingCountryTouched = getIn(
                        touched,
                        'billingAddress.state',
                    )
                    const billingCityTouched = getIn(
                        touched,
                        'billingAddress.city',
                    )
                    const showBillingLocationError = Boolean(
                        !values.billingSameAsShipping &&
                            ((billingCountryTouched && billingCountryError) ||
                                (billingCityTouched && billingCityError)),
                    )
                    const billingLocationErrorMessage =
                        (billingCountryTouched && billingCountryError
                            ? billingCountryError
                            : undefined) ??
                        (billingCityTouched && billingCityError
                            ? billingCityError
                            : undefined) ??
                        billingCityError ??
                        billingCountryError

                    const handleShippingLocationChange = (
                        next: CountryCityValue,
                    ) => {
                        const countryName = next.countryName ?? ''
                        const cityValue = next.city ?? ''
                        const countryCode = next.countryCode ?? ''

                        setFieldValue('shippingAddress.state', countryName)
                        setFieldValue('shippingAddress.countryCode', countryCode)
                        setFieldValue('shippingAddress.city', cityValue)
                        setFieldTouched('shippingAddress.state', true, false)
                        if (next.city !== undefined) {
                            setFieldTouched('shippingAddress.city', true, false)
                        }

                        if (values.billingSameAsShipping) {
                            setFieldValue('billingAddress.state', countryName)
                            setFieldValue('billingAddress.countryCode', countryCode)
                            setFieldValue('billingAddress.city', cityValue)
                        }
                    }

                    const handleBillingLocationChange = (next: CountryCityValue) => {
                        if (values.billingSameAsShipping) {
                            return
                        }
                        const countryName = next.countryName ?? ''
                        const cityValue = next.city ?? ''
                        const countryCode = next.countryCode ?? ''

                        setFieldValue('billingAddress.state', countryName)
                        setFieldValue('billingAddress.countryCode', countryCode)
                        setFieldValue('billingAddress.city', cityValue)
                        setFieldTouched('billingAddress.state', true, false)
                        if (next.city !== undefined) {
                            setFieldTouched('billingAddress.city', true, false)
                        }
                    }

                    const shippingComplete = itemsOnlyMode
                        ? true
                        : isAddressComplete(values.shippingAddress)
                    const billingComplete = itemsOnlyMode
                        ? true
                        : values.billingSameAsShipping
                              ? shippingComplete
                              : isAddressComplete(values.billingAddress)
                    const addressesComplete = itemsOnlyMode
                        ? true
                        : shippingComplete && billingComplete
                    const addressesIncomplete = !addressesComplete

                    // Steps controls
                    const hasCustomer = Boolean(values.customerId)
                    const customerStepSatisfied = customerRequired ? hasCustomer : true
                    const selectedItems = ((values.items || []) as Item[]).filter(Boolean)
                    const hasItems = selectedItems.length > 0
                    const measurementRequirementActive = !itemsOnlyMode
                    const itemsHaveRequiredMeasurements = !measurementRequirementActive
                        ? true
                        : selectedItems.every((item) => hasRequiredMeasurements(item))
                    const itemsHavePositiveQuantities = selectedItems.every((item) => {
                        const numeric = Number(item.qty)
                        return Number.isFinite(numeric) && numeric > 0
                    })
                    const itemsReady =
                        hasItems && itemsHavePositiveQuantities && itemsHaveRequiredMeasurements
                    const stepUnlocks = itemsOnlyMode
                        ? [true, true, true, true, true]
                        : [
                              true,
                              customerRequired
                                  ? customerStepSatisfied && addressesComplete
                                  : true,
                              customerRequired
                                  ? customerStepSatisfied && itemsReady && addressesComplete
                                  : itemsReady,
                              customerRequired
                                  ? customerStepSatisfied && itemsReady && addressesComplete
                                  : itemsReady,
                              customerStepSatisfied && itemsReady && addressesComplete,
                          ]

                    let maxNavigableStep = 0
                    for (let i = 0; i < stepUnlocks.length; i += 1) {
                        if (stepUnlocks[i]) {
                            maxNavigableStep = i
                        } else {
                            break
                        }
                    }

                    const handleStepChange = (nextStep: number) => {
                        if (itemsOnlyMode) {
                            return
                        }
                        if (nextStep <= maxNavigableStep) {
                            setCurrentStep(nextStep)
                        }
                    }

                    const goNext = () => {
                        if (itemsOnlyMode) {
                            return
                        }
                        if (currentStep === 0) {
                            if (customerRequired && !(values as any).customerId) {
                                setFieldTouched('customerId', true)
                                toast.push(
                                    <Notification title={t('validation.failed')} type="danger">
                                        {validationCustomerRequired}
                                    </Notification>,
                                    { placement: 'top-center' },
                                )
                                return
                            }
                            if (customerRequired && (!shippingComplete || !billingComplete)) {
                                toast.push(
                                    <Notification title={t('validation.failed')} type="danger">
                                        {validationCustomerAddressRequired}
                                    </Notification>,
                                    { placement: 'top-center' },
                                )
                                return
                            }
                            if (values.billingSameAsShipping) {
                                syncBillingWithShipping()
                            }
                        }
                        if (currentStep === 1 && (values.items || []).length === 0) {
                            setFieldTouched('items', true)
                            toast.push(
                                <Notification title={t('validation.failed')} type="danger">
                                    {validationItemsRequired}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            return
                        }
                        if (currentStep === 1 && !itemsHavePositiveQuantities) {
                            setFieldTouched('items', true)
                            toast.push(
                                <Notification title={t('validation.failed')} type="danger">
                                    {validationQuantityPositive}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            return
                        }
                        if (currentStep === 1 && measurementRequirementActive && !itemsHaveRequiredMeasurements) {
                            ensureMeasurementsFilled(selectedItems)
                            return
                        }
                        setCurrentStep((c) => Math.min(c + 1, 4))
                    }
                    const goPrev = () => {
                        if (itemsOnlyMode) {
                            return
                        }
                        setCurrentStep((c) => Math.max(c - 1, 0))
                    }

                    const onCustomerChange = async (opt: any) => {
                        const id = opt?.value
                        setFieldValue('customerId', id)
                        if (id) {
                            const res = await apiGetCustomerDetails<any, { id: string }>({ id })
                            const detail = (res as any).data || (res as any)
                            setCustomerDetail(detail)
                            // Prefill shipping address with customer's primary address
                            const addrList = Array.isArray(detail?.addresses)
                                ? detail.addresses
                                : []
                            const addr = addrList.find((item: any) => item?.isPrimary) || addrList[0] || null
                            if (addr) {
                                const countryInfo =
                                    findCountryByName(addr.country || '')?.value ||
                                    values.shippingAddress.countryCode ||
                                    'UY'
                                const updatedShipping = {
                                    street: addr.street || '',
                                    number: addr.number || '',
                                    corner: addr.corner || '',
                                    apartment: addr.apartment || '',
                                    city: addr.city || 'Montevideo',
                                    state: addr.country || 'Uruguay',
                                    countryCode: countryInfo,
                                }
                                setFieldValue('shippingAddress', updatedShipping)
                                if (values.billingSameAsShipping) {
                                    setFieldValue('billingAddress', updatedShipping)
                                }
                            }
                        } else {
                            setCustomerDetail(null)
                        }
                    }

                    const handleCustomerCreated = (
                        created: Record<string, unknown>,
                        formValues: CustomerFormModel,
                    ) => {
                        const customerIdValue = String(created?.id || '')
                        if (!customerIdValue) {
                            return
                        }
                        const fullName = [
                            formValues.firstName,
                            formValues.lastName,
                        ]
                            .filter(Boolean)
                            .join(' ')
                        const displayName =
                            (created as any)?.name ||
                            fullName ||
                            formValues.email
                        const option = {
                            value: customerIdValue,
                            label: displayName,
                        }
                        setCustomers((prev) => {
                            if (prev.find((item) => item.value === option.value)) {
                                return prev
                            }
                            return [option, ...prev]
                        })
                        setFieldValue('customerId', option.value)
                        setCustomerDetail(created)

                        const address = formValues.address || {
                            street: '',
                            number: '',
                            corner: '',
                            apartment: '',
                            city: 'Montevideo',
                            state: 'Uruguay',
                            countryCode: 'UY',
                        }
                        const normalizedAddress = {
                            street: address.street,
                            number: address.number,
                            corner: address.corner,
                            apartment: address.apartment,
                            city: address.city || 'Montevideo',
                            state: address.state || 'Uruguay',
                            countryCode: address.countryCode || 'UY',
                        }
                        setFieldValue('shippingAddress', normalizedAddress)
                        if (values.billingSameAsShipping) {
                            setFieldValue('billingAddress', normalizedAddress)
                        }
                    }

                    return (
                        <Form>
                            {!itemsOnlyMode && (
                                <Card
                                    className={classNames(
                                        'mb-6',
                                        isCompactViewport && '-mx-3',
                                    )}
                                    bodyClass={classNames(
                                        'w-full px-4 py-4 md:px-6',
                                        isCompactViewport && 'py-3',
                                    )}
                                >
                                    <div className="w-full overflow-x-auto">
                                        <Steps
                                            current={currentStep}
                                            onChange={handleStepChange}
                                            className="flex-nowrap gap-4 px-1 md:px-2 w-full min-w-[420px]"
                                        >
                                            <Steps.Item
                                                title={t('text.columns.customer')}
                                            />
                                            <Steps.Item
                                                title={t('text.titles.products')}
                                            />
                                            <Steps.Item
                                                title={docSummary(
                                                    'notesAndScheduling',
                                                    'Notes & scheduling',
                                                )}
                                            />
                                            <Steps.Item
                                                title={t('text.titles.shipping')}
                                            />
                                            <Steps.Item
                                                title={
                                                    t('text.actions.finalize') ||
                                                    'Finalizar'
                                                }
                                            />
                                        </Steps>
                                    </div>
                                </Card>
                            )}

                            {currentStep === 0 && (
                                <div className="flex flex-col gap-5">
                                    <Card bodyClass="p-5">
                                        <h4 className="mb-4">{t('text.columns.customer')}</h4>
                                        <FormContainer>
                                            <FormItem label={recipientLabel} invalid={!!(touched as any).customerId && !!(errors as any).customerId} errorMessage={(errors as any).customerId as any}>
                                                <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
                                                    <div className="flex w-full flex-col gap-3 md:flex-row md:flex-1">
                                                        {(() => {
                                                            const resolvedCustomerId = values.customerId
                                                                ? String(values.customerId)
                                                                : ''
                                                            const selectedOption = (() => {
                                                                if (!resolvedCustomerId) {
                                                                    return null
                                                                }
                                                                const existing = customers.find(
                                                                    (c) => c.value === resolvedCustomerId,
                                                                )
                                                                if (existing) {
                                                                    return existing
                                                                }
                                                                const fallbackLabel =
                                                                    pickCustomerDisplayName(customerDetail) ||
                                                                    pickCustomerDisplayName(initialCustomerDetail) ||
                                                                    docSummary(
                                                                        'unknownCustomer',
                                                                        'Unassigned customer',
                                                                    ) ||
                                                                    resolvedCustomerId
                                                                return {
                                                                    value: resolvedCustomerId,
                                                                    label: fallbackLabel,
                                                                }
                                                            })()
                                                            return (
                                                                <Select
                                                                    className="w-full md:flex-1 md:min-w-[280px]"
                                                                    options={customers}
                                                                    value={selectedOption as any}
                                                                    onChange={onCustomerChange}
                                                                />
                                                            )
                                                        })()}
                                                        <Button className="w-full whitespace-nowrap md:w-auto md:flex-shrink-0" type="button" onClick={() => setNewCustomerOpen(true)}>{t('text.actions.add')} {t('text.columns.customer')}</Button>
                                                    </div>
                                                </div>
                                            </FormItem>
                                            {values.customerId && (
                                                <div className="flex items-center gap-4 border border-gray-200 dark:border-gray-700 rounded-md p-4">
                                                    <Avatar shape="circle" src={customerDetail?.img} icon={<HiOutlineUser />} />
                                                    <div>
                                                        <div className="font-semibold">{customerDetail?.name || (customers.find((c) => c.value === values.customerId)?.label)}</div>
                                                        <div className="opacity-80 text-sm flex items-center gap-3">
                                                            {customerDetail?.email && (
                                                                <span className="flex items-center gap-1"><HiMail /> {customerDetail?.email}</span>
                                                            )}
                                                            {customerDetail?.personalInfo?.phoneNumbers?.length ? (
                                                                <span className="flex items-center gap-1">
                                                                    <HiPhone /> {customerDetail?.personalInfo?.phoneNumbers?.[0]}
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                                                <FormItem
                                                    label={orderCurrencyLabel}
                                                    invalid={Boolean(getIn(touched, 'orderCurrency') && getIn(errors, 'orderCurrency'))}
                                                    errorMessage={getIn(errors, 'orderCurrency') as string}
                                                >
                                                    <Select
                                                        placeholder={orderCurrencyPlaceholder}
                                                        options={orderCurrencyOptions}
                                                        value={orderCurrencySelected as any}
                                                        isSearchable
                                                        isClearable={false}
                                                        isDisabled={orderCurrencyOptions.length <= 1}
                                                        onChange={(option) => {
                                                            void handleOrderCurrencySelect(option)
                                                            setFieldTouched('orderCurrency', true, false)
                                                        }}
                                                    />
                                                </FormItem>
                                                {showPaymentMethodSelect && (
                                                    <FormItem
                                                        label={t('text.columns.paymentMethod')}
                                                        invalid={Boolean(
                                                            getIn(touched, 'paymentMehod') &&
                                                                getIn(errors, 'paymentMehod'),
                                                        )}
                                                        errorMessage={
                                                            getIn(errors, 'paymentMehod') as string
                                                        }
                                                    >
                                                        <Select
                                                            className="w-full max-w-xs"
                                                            options={methods}
                                                            value={
                                                                methods.find(
                                                                    (m) =>
                                                                        m.value === values.paymentMehod,
                                                                ) as any
                                                            }
                                                            onChange={(opt) => {
                                                                const nextValue = (opt as any)?.value ?? ''
                                                                setFieldValue('paymentMehod', nextValue)
                                                                setFieldTouched('paymentMehod', true, false)
                                                            }}
                                                        />
                                                    </FormItem>
                                                )}
                                            </div>
                                        </FormContainer>
                                    </Card>
                                    <Card bodyClass="p-5">
                                        <h4 className="mb-4">{t('text.titles.shippingAddress')}</h4>
                                        <FormContainer>
                                            <div className="grid grid-cols-2 gap-3">
                                                <FormItem
                                                    label={t('text.labels.street')}
                                                    invalid={Boolean(getIn(touched, 'shippingAddress.street') && getIn(errors, 'shippingAddress.street'))}
                                                    errorMessage={getIn(errors, 'shippingAddress.street') as string}
                                                >
                                                    <Field name="shippingAddress.street">
                                                        {({ field, form }) => (
                                                            <Input
                                                                {...field}
                                                                onChange={(e) => {
                                                                    form.setFieldValue(field.name, e.target.value)
                                                                    if (values.billingSameAsShipping) {
                                                                        form.setFieldValue('billingAddress.street', e.target.value)
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                    </Field>
                                                </FormItem>
                                                <FormItem
                                                    label={t('text.labels.number')}
                                                    invalid={Boolean(getIn(touched, 'shippingAddress.number') && getIn(errors, 'shippingAddress.number'))}
                                                    errorMessage={getIn(errors, 'shippingAddress.number') as string}
                                                >
                                                    <Field name="shippingAddress.number">
                                                        {({ field, form }) => (
                                                            <Input
                                                                {...field}
                                                                onChange={(e) => {
                                                                    form.setFieldValue(field.name, e.target.value)
                                                                    if (values.billingSameAsShipping) {
                                                                        form.setFieldValue('billingAddress.number', e.target.value)
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                    </Field>
                                                </FormItem>
                                                <FormItem label={t('text.labels.corner')}>
                                                    <Field name="shippingAddress.corner">
                                                        {({ field, form }) => (
                                                            <Input
                                                                {...field}
                                                                onChange={(e) => {
                                                                    form.setFieldValue(field.name, e.target.value)
                                                                    if (values.billingSameAsShipping) {
                                                                        form.setFieldValue('billingAddress.corner', e.target.value)
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                    </Field>
                                                </FormItem>
                                                <FormItem label={t('text.labels.apartment')}>
                                                    <Field name="shippingAddress.apartment">
                                                        {({ field, form }) => (
                                                            <Input
                                                                {...field}
                                                                onChange={(e) => {
                                                                    form.setFieldValue(field.name, e.target.value)
                                                                    if (values.billingSameAsShipping) {
                                                                        form.setFieldValue('billingAddress.apartment', e.target.value)
                                                                    }
                                                                }}
                                                            />
                                                        )}
                                                    </Field>
                                                </FormItem>
                                            </div>
                                            <div className="mt-3">
                                                <FormItem
                                                    label={`${t('text.labels.country')} / ${t('text.labels.city')}`}
                                                    invalid={showShippingLocationError}
                                                    errorMessage={shippingLocationErrorMessage}
                                                >
                                                    <CountryCitySelector
                                                        value={{
                                                            countryCode:
                                                                values.shippingAddress?.countryCode,
                                                            countryName:
                                                                values.shippingAddress?.state,
                                                            city: values.shippingAddress?.city,
                                                        }}
                                                        onChange={handleShippingLocationChange}
                                                        countryPlaceholder={t('text.labels.country')}
                                                        cityPlaceholder={t('text.labels.city')}
                                                    />
                                                </FormItem>
                                            </div>
                                            {/* Zip removed */}
                                        </FormContainer>
                                    </Card>
                                    <Card bodyClass="p-5">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4>{t('text.titles.billingAddress')}</h4>
                                            <Checkbox
                                                checked={(values as any).billingSameAsShipping}
                                                onChange={(checked) => {
                                                    setFieldValue('billingSameAsShipping', checked)
                                                    if (checked) {
                                                        setFieldValue('billingAddress', {
                                                            ...values.shippingAddress,
                                                        })
                                                    }
                                                }}
                                            >
                                                {t('text.labels.sameAsShipping') || 'Use shipping address'}
                                            </Checkbox>
                                        </div>
                                        <FormContainer>
                                            <div className="grid grid-cols-2 gap-3">
                                                <FormItem
                                                    label={t('text.labels.street')}
                                                    invalid={Boolean(getIn(touched, 'billingAddress.street') && getIn(errors, 'billingAddress.street'))}
                                                    errorMessage={getIn(errors, 'billingAddress.street') as string}
                                                >
                                                    <Field name="billingAddress.street">
                                                        {({ field, form }) => (
                                                            <Input
                                                                {...field}
                                                                disabled={values.billingSameAsShipping}
                                                                onChange={(e) => {
                                                                    form.setFieldValue(field.name, e.target.value)
                                                                }}
                                                            />
                                                        )}
                                                    </Field>
                                                </FormItem>
                                                <FormItem
                                                    label={t('text.labels.number')}
                                                    invalid={Boolean(getIn(touched, 'billingAddress.number') && getIn(errors, 'billingAddress.number'))}
                                                    errorMessage={getIn(errors, 'billingAddress.number') as string}
                                                >
                                                    <Field name="billingAddress.number">
                                                        {({ field, form }) => (
                                                            <Input
                                                                {...field}
                                                                disabled={values.billingSameAsShipping}
                                                                onChange={(e) => {
                                                                    form.setFieldValue(field.name, e.target.value)
                                                                }}
                                                            />
                                                        )}
                                                    </Field>
                                                </FormItem>
                                                <FormItem label={t('text.labels.corner') || 'Corner'}>
                                                    <Field name="billingAddress.corner">
                                                        {({ field, form }) => (
                                                            <Input
                                                                {...field}
                                                                disabled={values.billingSameAsShipping}
                                                                onChange={(e) => form.setFieldValue(field.name, e.target.value)}
                                                            />
                                                        )}
                                                    </Field>
                                                </FormItem>
                                                <FormItem label={t('text.labels.apartment') || 'Apartment'}>
                                                    <Field name="billingAddress.apartment">
                                                        {({ field, form }) => (
                                                            <Input
                                                                {...field}
                                                                disabled={values.billingSameAsShipping}
                                                                onChange={(e) => form.setFieldValue(field.name, e.target.value)}
                                                            />
                                                        )}
                                                    </Field>
                                                </FormItem>
                                            </div>
                                            <div className="mt-3">
                                                <FormItem
                                                    label={`${t('text.labels.country')} / ${t('text.labels.city')}`}
                                                    invalid={showBillingLocationError}
                                                    errorMessage={billingLocationErrorMessage}
                                                >
                                                    <CountryCitySelector
                                                        value={{
                                                            countryCode:
                                                                values.billingAddress?.countryCode,
                                                            countryName:
                                                                values.billingAddress?.state,
                                                            city: values.billingAddress?.city,
                                                        }}
                                                        onChange={handleBillingLocationChange}
                                                        countryPlaceholder={t('text.labels.country')}
                                                        cityPlaceholder={t('text.labels.city')}
                                                        disabled={values.billingSameAsShipping}
                                                    />
                                                </FormItem>
                                            </div>
                                            {/* Zip removed */}
                                        </FormContainer>
                                    </Card>
                                </div>
                            )}

                            {currentStep === 1 && (
                                <div className="flex flex-col gap-6">
                                    <Card bodyClass="p-5">
                                        <h4 className="mb-4">{t('text.titles.products')}</h4>
                                        <FormContainer>
                                            {itemsOnlyMode && (
                                                <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                                                    <FormItem
                                                        label={orderCurrencyLabel}
                                                        invalid={Boolean(
                                                            getIn(touched, 'orderCurrency') &&
                                                            getIn(errors, 'orderCurrency'),
                                                        )}
                                                        errorMessage={getIn(
                                                            errors,
                                                            'orderCurrency',
                                                        ) as string}
                                                    >
                                                        <Select
                                                            placeholder={orderCurrencyPlaceholder}
                                                            options={orderCurrencyOptions}
                                                            value={orderCurrencySelected as any}
                                                            isSearchable
                                                            isClearable={false}
                                                            isDisabled={orderCurrencyOptions.length <= 1}
                                                            onChange={(option) => {
                                                                void handleOrderCurrencySelect(option)
                                                                setFieldTouched(
                                                                    'orderCurrency',
                                                                    true,
                                                                    false,
                                                                )
                                                            }}
                                                        />
                                                    </FormItem>
                                                    <FormItem
                                                        label={t('text.columns.paymentMethod')}
                                                        invalid={Boolean(
                                                            getIn(touched, 'paymentMehod') &&
                                                            getIn(errors, 'paymentMehod'),
                                                        )}
                                                        errorMessage={getIn(
                                                            errors,
                                                            'paymentMehod',
                                                        ) as string}
                                                    >
                                                        <Select
                                                            options={methods}
                                                            value={
                                                                methods.find(
                                                                    (m) =>
                                                                        m.value ===
                                                                        values.paymentMehod,
                                                                ) as any
                                                            }
                                                            onChange={(opt) => {
                                                                const nextValue = (opt as any)?.value ?? ''
                                                                setFieldValue('paymentMehod', nextValue)
                                                                setFieldTouched(
                                                                    'paymentMehod',
                                                                    true,
                                                                    false,
                                                                )
                                                            }}
                                                        />
                                                    </FormItem>
                                                </div>
                                            )}
                                            <FormItem label={t('text.columns.product')} invalid={!!(touched as any).items && !!(errors as any).items} errorMessage={(errors as any).items as any}>
                                                <div className="flex flex-col gap-3">
                                                    <Select
                                                        className="w-full md:w-80"
                                                        options={products}
                                                        onChange={(opt) => {
                                                            const value = (opt as any)?.value
                                                            if (value) {
                                                                void addItem(value)
                                                            }
                                                        }}
                                                        placeholder={t('text.placeholders.searchProduct')}
                                                    />
                                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                        <Button
                                                            className="w-full md:w-auto"
                                                            type="button"
                                                            onClick={() => setNewProductOpen(true)}
                                                        >
                                                            {t('text.actions.add')} {t('text.titles.products')}
                                                        </Button>
                                                        <div className="font-semibold md:ml-auto">
                                                            {itemsOnlyMode
                                                                ? `${t('sales.documents.quickMessage.totalLabel', {
                                                                      defaultValue: 'Total a pagar',
                                                                  })}: ${formattedGrandTotal}`
                                                                : `${t('text.columns.total')}: ${formattedOrderTotal}`}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-4">
                                                    <EditableOrderProductsTable
                                                        items={values.items as any}
                                                        onQtyChange={changeQty}
                                                        onRemove={removeItem}
                                                        showDescription={false}
                                                        showComments
                                                    onCommentChange={changeComment}
                                                    onItemChange={handleItemChange}
                                                    showCustomAttributes={
                                                        mode === 'budget' || !itemsOnlyMode
                                                    }
                                                    showUnitColumn={false}
                                                    roundAmount={roundCurrencyValue}
                                                    showProductSpecifications={showProductSpecifications}
                                                />
                                                </div>
                                            </FormItem>
                                        </FormContainer>
                                    </Card>
                                    {!itemsOnlyMode && (
                                        <div className="flex flex-col items-stretch xl:flex-row xl:justify-end">
                                            <div className="w-full xl:max-w-md">
                                                <PaymentSummary
                                                    data={{
                                                        subTotal: total,
                                                        tax,
                                                        deliveryFees: deliveryFee,
                                                        total: grandTotal,
                                                        currency: orderCurrencyValue,
                                                    }}
                                                    taxRate={taxRate}
                                                    currency={orderCurrencyValue}
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {itemsOnlyMode && quickMessage && (
                                        <div ref={quickMessageRef} className="mt-4">
                                            <Card bodyClass="p-5">
                                                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                    <h4 className="text-base font-semibold">
                                                        {t('sales.documents.quickMessage.title', {
                                                            defaultValue: 'Mensaje generado',
                                                        })}
                                                    </h4>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="solid"
                                                        icon={
                                                            copyStatus === 'success' ? (
                                                                <HiOutlineCheck />
                                                            ) : (
                                                                <CgCopy />
                                                            )
                                                        }
                                                        onClick={copyQuickMessage}
                                                    >
                                                        {copyStatus === 'success'
                                                            ? t('text.actions.copied', {
                                                                  defaultValue: 'Copiado',
                                                              })
                                                            : t('text.actions.copy', {
                                                                  defaultValue: 'Copiar',
                                                              })}
                                                    </Button>
                                                </div>
                                                <pre className="mt-4 whitespace-pre-wrap text-sm bg-gray-50 dark:bg-gray-700 p-4 rounded border border-dashed border-gray-200 dark:border-gray-600">
                                                    {quickMessage}
                                                </pre>
                                            </Card>
                                        </div>
                                    )}
                                </div>
                            )}


                            {currentStep === 2 && (
                                <div className="flex flex-col gap-6">
                                </div>
                            )}

                            {currentStep === 3 && (
                                <Card bodyClass="p-5">
                                    <h4 className="mb-4">{t('text.titles.shipping')}</h4>
                                    <FormContainer>
                                        <FormItem label={t('text.labels.vendor')}>
                                            <Select
                                                value={
                                                    shippingVendorOptions.find(
                                                        (option) =>
                                                            option.value ===
                                                            (values as any)
                                                                ?.shipping
                                                                ?.shippingVendor,
                                                    ) ?? null
                                                }
                                                options={shippingVendorOptions}
                                                placeholder={t('text.labels.vendor')}
                                                onChange={(opt) => {
                                                    const value = (opt as any)?.value ?? ''
                                                    setFieldValue('shipping.shippingVendor', value)
                                                    clearQuickMessage()
                                                    if (!value) {
                                                        return
                                                    }
                                                    const selected = shippingOptions.find(
                                                        (item) => item.name === value,
                                                    )
                                                    if (selected) {
                                                        const { value: convertedDelivery } = convert(
                                                            Number(selected.deliveryFees ?? 0),
                                                            currencyBase,
                                                            orderCurrencyValue,
                                                        )
                                                        setFieldValue(
                                                            'shipping.deliveryFees',
                                                            Number.isFinite(convertedDelivery)
                                                                ? roundCurrencyValue(convertedDelivery)
                                                                : roundCurrencyValue(Number(selected.deliveryFees ?? 0)),
                                                        )
                                                        setFieldValue(
                                                            'shipping.estimatedMin',
                                                            selected.estimatedMin ?? 0,
                                                        )
                                                        setFieldValue(
                                                            'shipping.estimatedMax',
                                                            selected.estimatedMax ??
                                                                selected.estimatedMin ??
                                                                0,
                                                        )
                                                    }
                                                }}
                                            />
                                            {(() => {
                                                const selected = shippingOptions.find(
                                                    (item) =>
                                                        item.name ===
                                                        (values as any)?.shipping
                                                            ?.shippingVendor,
                                                )
                                                if (!selected) {
                                                    return null
                                                }
                                                return (
                                                    <div className="flex items-center gap-3 mt-3 text-sm text-gray-500">
                                                        <Avatar
                                                            shape="circle"
                                                            src={selected.img || undefined}
                                                        >
                                                            {selected.name?.charAt(0) ?? '?'}
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-medium text-gray-700 dark:text-gray-200">
                                                                {selected.name}
                                                            </div>
                                                            <div className="flex flex-wrap gap-3 opacity-80">
                                                                <span>
                                                                    {t(
                                                                        'settings.shippingOptions.columns.deliveryFees',
                                                                    )}
                                                                    :{' '}
                                                                    {Number(
                                                                        selected.deliveryFees ??
                                                                            0,
                                                                    ).toFixed(2)}
                                                                </span>
                                                                <span>
                                                                    {t(
                                                                        'settings.shippingOptions.columns.estimatedMin',
                                                                    )}
                                                                    :{' '}
                                                                    {selected.estimatedMin ??
                                                                        0}
                                                                </span>
                                                                <span>
                                                                    {t(
                                                                        'settings.shippingOptions.columns.estimatedMax',
                                                                    )}
                                                                    :{' '}
                                                                    {selected.estimatedMax ??
                                                                        selected.estimatedMin ??
                                                                        0}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })()}
                                        </FormItem>
                                        <div className="grid grid-cols-3 gap-3">
                                            <FormItem label={t('text.labels.deliveryFee')}>
                                                <Field as={Input} name="shipping.deliveryFees" type="number" min={0} step="0.01" />
                                            </FormItem>
                                            <FormItem label={t('text.labels.minDays') || 'Min days'}>
                                                <Field as={Input} name="shipping.estimatedMin" type="number" min={0} />
                                            </FormItem>
                                            <FormItem label={t('text.labels.maxDays') || 'Max days'}>
                                                <Field as={Input} name="shipping.estimatedMax" type="number" min={0} />
                                            </FormItem>
                                        </div>
                                    </FormContainer>
                                </Card>
                            )}

                            {currentStep === 4 && (
                                <div className="flex flex-col gap-6">
                                    <div className="grid gap-4 xl:grid-cols-2">
                                        <Card bodyClass="p-5">
                                            <h4 className="mb-4">
                                                {docSummary('orderOverview', 'Order overview')}
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                {(() => {
                                                    const overviewItems = [
                                                        {
                                                            label: orderCurrencyLabel,
                                                            value:
                                                                orderCurrencySelected?.label ||
                                                                getCurrencyLabel(orderCurrencyValue),
                                                        },
                                                        ...(showPaymentMethodSelect
                                                            ? [
                                                                  {
                                                                      label: t(
                                                                          'text.columns.paymentMethod',
                                                                      ),
                                                                      value: paymentMethodLabel,
                                                                  },
                                                              ]
                                                            : []),
                                                        {
                                                            label: t('text.labels.date'),
                                                            value: values.date
                                                                ? dayjs(values.date as any).format('DD/MM/YYYY')
                                                                : docSummary('notAvailable', 'Not available'),
                                                        },
                                                        ...(mode === 'budget'
                                                            ? [
                                                                  {
                                                                      label: docMessage(
                                                                          'validUntilLabel',
                                                                          'sales.orders.validUntilLabel',
                                                                          'Valid until',
                                                                      ),
                                                                      value: values.validUntil
                                                                          ? dayjs(
                                                                                values.validUntil as any,
                                                                            ).format('DD/MM/YYYY')
                                                                          : docSummary(
                                                                                'notAvailable',
                                                                                'Not available',
                                                                            ),
                                                                  },
                                                              ]
                                                            : []),
                                                        {
                                                            label: docSummary('subtotal', 'Subtotal'),
                                                            value: formattedOrderTotal,
                                                        },
                                                        {
                                                            label: docSummary('tax', 'Estimated tax'),
                                                            value: formattedTax,
                                                        },
                                                        {
                                                            label: t('text.labels.deliveryFee'),
                                                            value: formattedDeliveryFee,
                                                        },
                                                        {
                                                            label: docSummary('totalDue', 'Total due'),
                                                            value: formattedGrandTotal,
                                                        },
                                                    ]
                                                    return overviewItems.map(({ label, value }) => (
                                                        <div
                                                            key={label as string}
                                                            className="flex items-center justify-between gap-4"
                                                        >
                                                            <span className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                                                {label}
                                                            </span>
                                                            <span className="font-medium text-right">
                                                                {value}
                                                            </span>
                                                        </div>
                                                    ))
                                                })()}
                                            </div>
                                        </Card>
                                        <div className="flex flex-col gap-4">
                                            <Card bodyClass="p-5">
                                                <h4 className="mb-4">
                                                    {t('text.columns.customer')}
                                                </h4>
                                                <div className="space-y-2 text-sm">
                                                    <div className="font-medium text-base">{customerName}</div>
                                                    <div className="flex flex-col gap-1 text-gray-600 dark:text-gray-400">
                                                        {customerEmail ? <span>{customerEmail}</span> : null}
                                                        {customerPhone ? <span>{customerPhone}</span> : null}
                                                        {!customerEmail && !customerPhone ? (
                                                            <span>
                                                                {docSummary(
                                                                    'noContact',
                                                                    'No contact details provided',
                                                                )}
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </Card>
                                        </div>
                                    </div>
                                    <div className="grid gap-4 xl:grid-cols-2">
                                        <Card bodyClass="p-5">
                                            <h4 className="mb-4">{t('text.titles.shippingAddress')}</h4>
                                            {shippingAddressLines.length ? (
                                                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                                    {shippingAddressLines.map((line) => (
                                                        <div key={`shipping-${line}`}>{line}</div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {docSummary('notAvailable', 'Not available')}
                                                </div>
                                            )}
                                        </Card>
                                        <Card bodyClass="p-5">
                                            <h4 className="mb-4">{t('text.titles.billingAddress')}</h4>
                                            {values.billingSameAsShipping ? (
                                                <div className="text-sm text-gray-600 dark:text-gray-400">
                                                    {t('text.labels.sameAsShipping') || 'Use shipping address'}
                                                </div>
                                            ) : billingAddressLines.length ? (
                                                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                                                    {billingAddressLines.map((line) => (
                                                        <div key={`billing-${line}`}>{line}</div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {docSummary('notAvailable', 'Not available')}
                                                </div>
                                            )}
                                        </Card>
                                    </div>
                                </div>
                            )}

                            {itemsOnlyMode ? (
                                <div className="flex items-center justify-between mt-6">
                                    <Button type="button" onClick={() => navigate(-1)}>
                                        {t('text.actions.cancel')}
                                    </Button>
                                    <Button
                                        variant="solid"
                                        type="submit"
                                        disabled={(values.items || []).length === 0}
                                    >
                                        {t('text.actions.generateMessage', {
                                            defaultValue: 'Generar mensaje',
                                        })}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex items-center justify-between mt-6">
                                    <div>
                                        <Button type="button" onClick={() => navigate(-1)}>
                                            {t('text.actions.cancel')}
                                        </Button>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button type="button" disabled={currentStep === 0} onClick={goPrev}>
                                            {t('text.actions.back')}
                                        </Button>
                                        {currentStep < 4 && (
                                            <Button
                                                type="button"
                                                variant="solid"
                                                disabled={
                                                    (currentStep === 0 &&
                                                        (!customerStepSatisfied ||
                                                            !values.orderCurrency ||
                                                            (showPaymentMethodSelect &&
                                                                !values.paymentMehod) ||
                                                            (customerRequired && addressesIncomplete))) ||
                                                    (currentStep === 1 && (values.items || []).length === 0)
                                                }
                                                onClick={goNext}
                                            >
                                                {t('text.actions.next')}
                                            </Button>
                                        )}
                                        {currentStep === 4 && (
                                            <Button variant="solid" type="submit">
                                                {t('text.actions.save')}
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <AddCustomerDrawer
                                isOpen={newCustomerOpen}
                                onClose={() => setNewCustomerOpen(false)}
                                onSuccess={handleCustomerCreated}
                            />

                            {/* New Product Drawer */}
                            <Drawer
                                isOpen={newProductOpen}
                                onClose={closeNewProductDrawer}
                                onRequestClose={closeNewProductDrawer}
                                width={640}
                                bodyClass="p-0"
                                title={t('text.actions.add') + ' ' + t('text.titles.products')}
                            >
                                <div className="p-6">
                                    <ProductForm
                                        type="new"
                                        initialData={{
                                            id: 0,
                                            name: '',
                                            productCode: '',
                                            img: '',
                                            imgList: [],
                                            categoryId: null,
                                            costPrice: 0,
                                            salePrice: 0,
                                            stock: 0,
                                            status: 0,
                                            bulkDiscountPrice: 0,
                                            tags: [],
                                            brand: '',
                                            vendor: '',
                                            description: '',
                                            currency: defaultCurrency as any,
                                        }}
                                        onDiscard={closeNewProductDrawer}
                                        onFormSubmit={handleCreateProduct}
                                    />
                                </div>
                            </Drawer>
                        </Form>
                    )
                }}
            </Formik>
        </Container>
    )
}

export default OrderNew

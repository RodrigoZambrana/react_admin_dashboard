import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Formik, Form, Field, getIn, type FormikProps } from 'formik'
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
import { apiGetPaymentMethods, apiGetShippingOptions } from '@/services/SettingsService'
import Checkbox from '@/components/ui/Checkbox'
import PaymentSummary from '@/views/sales/OrderDetails/components/PaymentSummary'
import EditableOrderProductsTable, { EditableItem } from '@/views/sales/components/EditableOrderProductsTable'
import Steps from '@/components/ui/Steps'
import Avatar from '@/components/ui/Avatar'
import { HiMail, HiPhone, HiOutlineUser } from 'react-icons/hi'
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
import { normalizeCurrencyCode, formatCurrency } from '@/utils/currency'
import { resolveTextDirection } from '@/utils/textDirection'
import type { BaseCurrencySnapshot } from '@/store/slices/currency/currencySlice'

type Item = EditableItem

type ShippingOption = {
    id: number
    name: string
    deliveryFees: number | null
    estimatedMin: number | null
    estimatedMax: number | null
    img?: string | null
}

const OrderNew = () => {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const location = useLocation()
    const storeCurrency = useAppSelector((state) => state.currency.code)
    const defaultCurrency =
        normalizeCurrencyCode(storeCurrency, 'UYU') || 'UYU'
    const fallbackCurrencyList = useMemo(() => {
        const baseList = [defaultCurrency, 'USD', 'UYU']
        const normalized = baseList
            .map((code) => normalizeCurrencyCode(code, defaultCurrency) || defaultCurrency)
            .filter((code): code is string => Boolean(code))
        return Array.from(new Set(normalized))
    }, [defaultCurrency])
    const fallbackCurrencyOptions = useMemo(
        () =>
            fallbackCurrencyList.map((code) => ({
                value: code,
                label: code,
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
        }[]
    >([])
    const [methods, setMethods] = useState<{ value: string; label: string }[]>([])
    const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([])
    const [customerDetail, setCustomerDetail] = useState<any | null>(null)
    const [currentStep, setCurrentStep] = useState(0)
    const [newCustomerOpen, setNewCustomerOpen] = useState(false)
    const [newProductOpen, setNewProductOpen] = useState(false)
    const [taxRate, setTaxRate] = useState(22)
    const formikRef = useRef<FormikProps<any>>(null)
    const initialDataLoadKeyRef = useRef<string | null>(null)
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
    const roundCurrencyValue = useCallback(
        (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100,
        [],
    )

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
            return {
                ...item,
                unitPrice,
                unitCurrency,
                price: hasMissing ? roundCurrencyValue(unitPrice) : roundCurrencyValue(value),
                currency: hasMissing ? unitCurrency : target,
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

    const orderCurrencyLabel = t('sales.orders.orderCurrencyLabel', {
        defaultValue: 'Order currency',
    })
    const orderCurrencyPlaceholder = t('sales.orders.orderCurrencyPlaceholder', {
        defaultValue: 'Select order currency',
    })

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
        const loadKey = JSON.stringify({ defaultCurrency })
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
                setCustomers(cOpts)

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
                    })) || []
                setProducts(pOpts)

                const mRes = await apiGetPaymentMethods<{ id: number | string; name: string }[]>()
                const mOpts = (mRes.data as any[]).map((m) => ({
                    value: String(m.name || m.id),
                    label: m.name,
                }))
                setMethods(mOpts)

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
                            formik.setFieldValue('items', updatedItems, false)
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
                if (initialDataLoadKeyRef.current === loadKey) {
                    initialDataLoadKeyRef.current = null
                }
            }
        }

        load().catch(() => {
            initialDataLoadKeyRef.current = null
        })
    }, [convert, convertItemToCurrency, defaultCurrency, exchangeSnapshot, refreshExchangeRates, roundCurrencyValue, t])

    useEffect(() => {
        const sp = new URLSearchParams(location.search)
        const s = sp.get('step')
        if (s) {
            const n = Number(s)
            if (!Number.isNaN(n)) {
                setCurrentStep(Math.max(0, Math.min(3, n)))
            }
        }
        const openProduct = sp.get('addProduct')
        if (openProduct === '1' || openProduct === 'true') {
            setNewProductOpen(true)
        }
    }, [location.search])

    useEffect(() => {
        if (!shippingOptions.length || !formikRef.current) {
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
            if (Number.isFinite(value)) {
                formik.setFieldValue('shipping.deliveryFees', roundCurrencyValue(value))
            }
            formik.setFieldValue(
                'shipping.estimatedMin',
                first.estimatedMin ?? 0,
            )
            formik.setFieldValue(
                'shipping.estimatedMax',
                first.estimatedMax ?? first.estimatedMin ?? 0,
            )
        }
    }, [convert, currencyBase, roundCurrencyValue, shippingOptions])

    return (
        <Container className="h-full">
            <h3 className="mb-6">{t('nav.appsSales.orderList')} · {t('text.actions.add')}</h3>
            <Formik
                innerRef={formikRef}
                initialValues={{
                    customerId: '',
                    date: new Date(),
                    paymentMehod: 'Cash',
                    orderCurrency: defaultCurrency,
                    items: [] as Item[],
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
                }}
                validationSchema={Yup.object().shape({
                    customerId: Yup.string().required(t('sales.orders.validation.customerRequired') as string),
                    date: Yup.date()
                        .typeError(t('text.validation.invalidDate'))
                        .required(t('text.validation.dateRequired')),
                    paymentMehod: Yup.string().required('Payment method is required'),
                    orderCurrency: Yup.string()
                        .trim()
                        .required(
                            t('validation.fieldRequired', {
                                field: orderCurrencyLabel,
                            }),
                        ),
                    shippingAddress: Yup.object().shape({
                        street: Yup.string().required(t('text.validation.enterAddress')),
                        number: Yup.string().required(t('text.validation.enterAddress')),
                        city: Yup.string().required(t('text.validation.enterCity')),
                        state: Yup.string().required(t('text.validation.enterState')),
                        countryCode: Yup.string().required(t('text.validation.selectCountry')),
                        corner: Yup.string().nullable(),
                        apartment: Yup.string().nullable(),
                    }),
                    billingSameAsShipping: Yup.boolean(),
                    billingAddress: Yup.object().shape({
                        street: Yup.string().required(t('text.validation.enterAddress')),
                        number: Yup.string().required(t('text.validation.enterAddress')),
                        city: Yup.string().required(t('text.validation.enterCity')),
                        state: Yup.string().required(t('text.validation.enterState')),
                        countryCode: Yup.string().required(t('text.validation.selectCountry')),
                        corner: Yup.string().nullable(),
                        apartment: Yup.string().nullable(),
                    }),
                    items: Yup.array()
                        .of(
                            Yup.object().shape({
                                productId: Yup.string().required(),
                                qty: Yup.number().min(1).required(),
                                price: Yup.number().min(0).required(),
                            }),
                        )
                        .min(1, t('sales.orders.validation.itemsRequired') as string),
                })}
                onSubmit={async (values) => {
                    const orderCurrencyValue =
                        normalizeCurrencyCode(values.orderCurrency, currencyBase) || currencyBase
                    const normalizeAddress = (addr: typeof values.shippingAddress) => ({
                        street: addr.street,
                        number: addr.number,
                        corner: addr.corner,
                        apartment: addr.apartment,
                        city: addr.city,
                        state: addr.state,
                        countryCode: addr.countryCode,
                    })

                    const shippingAddress = normalizeAddress(values.shippingAddress)
                    const billingAddress = values.billingSameAsShipping
                        ? shippingAddress
                        : normalizeAddress(values.billingAddress)

                    const payload = {
                        customerId: String(values.customerId || ''),
                        // Backend expects ISO 8601 date string (IsDateString)
                        date: values.date ? new Date(values.date as any).toISOString() : undefined,
                        paymentMehod: String(values.paymentMehod || 'Cash'),
                        orderCurrency: orderCurrencyValue,
                        items: values.items.map((it) => {
                            const rawUnitPrice = Number(it.unitPrice)
                            return {
                                productId: String(it.productId),
                                name: it.name,
                                price: Number(it.price) || 0,
                                qty: Number(it.qty) || 1,
                                img: it.img,
                                description: it.description,
                                comments: it.comments,
                                currency: orderCurrencyValue,
                                unitPrice: Number.isFinite(rawUnitPrice)
                                    ? rawUnitPrice
                                    : Number(it.price) || 0,
                                unitCurrency:
                                    normalizeCurrencyCode(it.unitCurrency, orderCurrencyValue) ||
                                    normalizeCurrencyCode(it.currency, orderCurrencyValue) ||
                                    orderCurrencyValue,
                            }
                        }),
                        shippingAddress,
                        billingAddress,
                        billingSameAsShipping: Boolean(values.billingSameAsShipping),
                        shipping: {
                            shippingVendor: values.shipping?.shippingVendor,
                            deliveryFees: Number(values.shipping?.deliveryFees ?? 0),
                            estimatedMin: Number(values.shipping?.estimatedMin ?? 0),
                            estimatedMax: Number(values.shipping?.estimatedMax ?? 0),
                        },
                        comment: values.comment,
                    }
                    // Ensure shipping address is filled
                    const saddr = values.shippingAddress || {}
                    if (!saddr.street || !saddr.number || !saddr.state || !saddr.city || !saddr.countryCode) {
                        toast.push(
                            <Notification title={t('validation.failed')} type="danger">
                                {t('sales.orders.validation.customerAddressRequired')}
                            </Notification>,
                            { placement: 'top-center' },
                        )
                        setCurrentStep(0)
                        return
                    }

                    if (!values.billingSameAsShipping) {
                        const baddr = values.billingAddress || {}
                        if (!baddr.street || !baddr.number || !baddr.state || !baddr.city || !baddr.countryCode) {
                            toast.push(
                                <Notification title={t('validation.failed')} type="danger">
                                    {t('sales.orders.validation.customerAddressRequired')}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            setCurrentStep(0)
                            return
                        }
                    }

                    try {
                        const res = await apiCreateSalesOrder<boolean, any>(payload)
                        if ((res as any).data || (res as any) === true) {
                            toast.push(
                                <Notification title={t('sales.orders.created.title')} type="success">
                                    {t('sales.orders.created.desc')}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            navigate('/app/sales/order-list')
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
                    const deliveryFee = Number(values.shipping?.deliveryFees ?? 0)
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
                    const total = values.items.reduce(
                        (runningTotal, it) => runningTotal + (it.price || 0) * (it.qty || 0),
                        0,
                    )
                    const tax = Math.round(total * (taxRate / (100 + taxRate)) * 100) / 100
                    const grandTotal = Math.round((total + deliveryFee) * 100) / 100
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
                    const shippingVendorRaw =
                        (values.shipping?.shippingVendor as string | undefined) || ''
                    const trimmedShippingVendor = shippingVendorRaw.trim()
                    const hasShippingVendor = Boolean(trimmedShippingVendor)
                    const shippingVendorLabel = hasShippingVendor
                        ? trimmedShippingVendor
                        : t('text.labels.notSelected', { defaultValue: 'Not selected' })
                    const estimatedMin = Number(values.shipping?.estimatedMin ?? 0)
                    const estimatedMax = Number(values.shipping?.estimatedMax ?? 0)
                    const estimatedRange =
                        estimatedMin || estimatedMax
                            ? estimatedMin && estimatedMax
                                ? estimatedMin === estimatedMax
                                    ? `${estimatedMin} ${t('sales.orders.summary.days', {
                                          defaultValue: 'days',
                                      })}`
                                    : `${estimatedMin}-${estimatedMax} ${t('sales.orders.summary.days', {
                                          defaultValue: 'days',
                                      })}`
                                : `${estimatedMin || estimatedMax} ${t('sales.orders.summary.days', {
                                      defaultValue: 'days',
                                  })}`
                            : t('sales.orders.summary.notAvailable', { defaultValue: 'Not available' })
                    const customerOption = customers.find(
                        (opt) => opt.value === values.customerId,
                    )
                    const customerName =
                        customerDetail?.name ||
                        customerOption?.label ||
                        t('sales.orders.summary.unknownCustomer', {
                            defaultValue: 'Unassigned customer',
                        })
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
                        },
                    ) => {
                        const p = option ?? products.find((x) => x.value === pid)
                        if (!p) return
                        const exists = values.items.find((it) => it.productId === pid)
                        if (exists) return
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
                                    {t('sales.orders.exchangeRateMissing', {
                                        defaultValue:
                                            'Missing exchange rate for the selected currency conversion.',
                                    })}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            return
                        }
                        const convertedPrice = roundCurrencyValue(conversion.value)
                        const nextItem: Item = {
                            productId: pid,
                            name: p.label,
                            price: convertedPrice,
                            currency: orderCurrencyValue,
                            qty: 1,
                            img: p.img,
                            description: p.description,
                            unitPrice,
                            unitCurrency: productCurrency,
                            comments: '',
                        }
                        setFieldValue('items', [...values.items, nextItem])
                    }
                    const removeItem = (pid: string) => setFieldValue('items', values.items.filter((it) => it.productId !== pid))
                    const changeQty = (pid: string, qty: number) => setFieldValue('items', values.items.map((it) => (it.productId === pid ? { ...it, qty } : it)))
                    const changeComment = (pid: string, comments: string) =>
                        setFieldValue(
                            'items',
                            values.items.map((it) =>
                                it.productId === pid ? { ...it, comments } : it,
                            ),
                        )

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
                                    {t('sales.orders.exchangeRateMissing', {
                                        defaultValue:
                                            'Missing exchange rate for the selected currency conversion.',
                                    })}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            return
                        }

                        const convertedItems = values.items.map((item) =>
                            convertItemToCurrency(item, nextValue, snapshot),
                        )
                        const convertedFee = Number.isFinite(attempt.deliveryResult.value)
                            ? roundCurrencyValue(attempt.deliveryResult.value)
                            : Number(values.shipping?.deliveryFees ?? 0)
                        setFieldValue('orderCurrency', nextValue)
                        setFieldValue('items', convertedItems)
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

                    const shippingComplete = isAddressComplete(values.shippingAddress)
                    const billingComplete = values.billingSameAsShipping
                        ? shippingComplete
                        : isAddressComplete(values.billingAddress)
                    const shippingIncomplete = !shippingComplete
                    const billingIncomplete = !values.billingSameAsShipping && !billingComplete
                    const addressesComplete = shippingComplete && billingComplete
                    const addressesIncomplete = shippingIncomplete || billingIncomplete

                    // Steps controls
                    const hasCustomer = Boolean(values.customerId)
                    const hasItems = (values.items || []).length > 0
                    const stepUnlocks = [
                        true,
                        hasCustomer && addressesComplete,
                        hasCustomer && hasItems && addressesComplete,
                        hasCustomer && hasItems && addressesComplete,
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
                        if (nextStep <= maxNavigableStep) {
                            setCurrentStep(nextStep)
                        }
                    }

                    const goNext = () => {
                        if (currentStep === 0) {
                            if (!(values as any).customerId) {
                                setFieldTouched('customerId', true)
                                toast.push(
                                    <Notification title={t('validation.failed')} type="danger">
                                        {t('sales.orders.validation.customerRequired')}
                                    </Notification>,
                                    { placement: 'top-center' },
                                )
                                return
                            }
                            if (!shippingComplete || !billingComplete) {
                                toast.push(
                                    <Notification title={t('validation.failed')} type="danger">
                                        {t('sales.orders.validation.customerAddressRequired')}
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
                                    {t('sales.orders.validation.itemsRequired')}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            return
                        }
                        setCurrentStep((c) => Math.min(c + 1, 3))
                    }
                    const goPrev = () => setCurrentStep((c) => Math.max(c - 1, 0))

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

                            {currentStep === 0 && (
                                <div className="flex flex-col gap-5">
                                    <Card bodyClass="p-5">
                                        <h4 className="mb-4">{t('text.columns.customer')}</h4>
                                        <FormContainer>
                                            <FormItem label={t('text.labels.recipient')} invalid={!!(touched as any).customerId && !!(errors as any).customerId} errorMessage={(errors as any).customerId as any}>
                                                <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
                                                    <div className="flex w-full flex-col gap-3 md:flex-row md:flex-1">
                                                        <Select className="w-full md:flex-1 md:min-w-[280px]" options={customers} value={customers.find((c) => c.value === values.customerId) as any} onChange={onCustomerChange} />
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
                                                <FormItem
                                                    label={t('text.columns.paymentMethod')}
                                                    invalid={Boolean(getIn(touched, 'paymentMehod') && getIn(errors, 'paymentMehod'))}
                                                    errorMessage={getIn(errors, 'paymentMehod') as string}
                                                >
                                                    <Select
                                                        className="w-full max-w-xs"
                                                        options={methods}
                                                        value={methods.find((m) => m.value === values.paymentMehod) as any}
                                                        onChange={(opt) => {
                                                            const nextValue = (opt as any)?.value ?? ''
                                                            setFieldValue('paymentMehod', nextValue)
                                                            setFieldTouched('paymentMehod', true, false)
                                                        }}
                                                    />
                                                </FormItem>
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
                                                            {t('text.columns.total')}: {formattedOrderTotal}
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
                                                    />
                                                </div>
                                            </FormItem>
                                        </FormContainer>
                                    </Card>
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
                                </div>
                            )}


                            {currentStep === 2 && (
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
                                                                : Number(selected.deliveryFees ?? 0),
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

                            {currentStep === 3 && (
                                <div className="flex flex-col gap-6">
                                    <div className="grid gap-4 xl:grid-cols-2">
                                        <Card bodyClass="p-5">
                                            <h4 className="mb-4">
                                                {t('sales.orders.summary.orderOverview', {
                                                    defaultValue: 'Order overview',
                                                })}
                                            </h4>
                                            <div className="space-y-2 text-sm">
                                                {[
                                                    {
                                                        label: orderCurrencyLabel,
                                                        value:
                                                            orderCurrencySelected?.label ||
                                                            getCurrencyLabel(orderCurrencyValue),
                                                    },
                                                    {
                                                        label: t('text.columns.paymentMethod'),
                                                        value: paymentMethodLabel,
                                                    },
                                                    {
                                                        label: t('sales.orders.summary.subtotal', {
                                                            defaultValue: 'Subtotal',
                                                        }),
                                                        value: formattedOrderTotal,
                                                    },
                                                    {
                                                        label: t('sales.orders.summary.tax', {
                                                            defaultValue: 'Estimated tax',
                                                        }),
                                                        value: formattedTax,
                                                    },
                                                    {
                                                        label: t('text.labels.deliveryFee'),
                                                        value: formattedDeliveryFee,
                                                    },
                                                    {
                                                        label: t('sales.orders.summary.totalDue', {
                                                            defaultValue: 'Total due',
                                                        }),
                                                        value: formattedGrandTotal,
                                                    },
                                                ].map(({ label, value }) => (
                                                    <div
                                                        key={label as string}
                                                        className="flex items-center justify-between gap-4"
                                                    >
                                                        <span className="text-gray-500 dark:text-gray-400">
                                                            {label}
                                                        </span>
                                                        <span className="font-medium text-right">
                                                            {value}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </Card>
                                        <div className="flex flex-col gap-4">
                                            {hasShippingVendor && (
                                                <Card bodyClass="p-5">
                                                    <h4 className="mb-4">
                                                        {t('sales.orders.summary.shippingDetails', {
                                                            defaultValue: 'Shipping details',
                                                        })}
                                                    </h4>
                                                    <div className="space-y-2 text-sm">
                                                        <div className="flex items-center justify-between gap-4">
                                                            <span className="text-gray-500 dark:text-gray-400">
                                                                {t('text.labels.vendor')}
                                                            </span>
                                                            <span className="font-medium text-right">
                                                                {shippingVendorLabel}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4">
                                                            <span className="text-gray-500 dark:text-gray-400">
                                                                {t('sales.orders.summary.estimatedDelivery', {
                                                                    defaultValue: 'Estimated delivery',
                                                                })}
                                                            </span>
                                                            <span className="font-medium text-right">
                                                                {estimatedRange}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center justify-between gap-4">
                                                            <span className="text-gray-500 dark:text-gray-400">
                                                                {t('text.labels.deliveryFee')}
                                                            </span>
                                                            <span className="font-medium text-right">
                                                                {formattedDeliveryFee}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </Card>
                                            )}
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
                                                                {t('sales.orders.summary.noContact', {
                                                                    defaultValue: 'No contact details provided',
                                                                })}
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
                                                    {t('sales.orders.summary.notAvailable', {
                                                        defaultValue: 'Not available',
                                                    })}
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
                                                    {t('sales.orders.summary.notAvailable', {
                                                        defaultValue: 'Not available',
                                                    })}
                                                </div>
                                            )}
                                        </Card>
                                    </div>
                                    <Card bodyClass="p-5">
                                        <h4 className="mb-4">
                                            {t('sales.orders.summary.notesAndScheduling', {
                                                defaultValue: 'Notes & scheduling',
                                            })}
                                        </h4>
                                        <FormContainer>
                                            <FormItem label={t('text.columns.comments')}>
                                                <Field
                                                    as={Input}
                                                    name="comment"
                                                    textArea
                                                    rows={4}
                                                    dir={resolveTextDirection(values.comment)}
                                                />
                                            </FormItem>
                                            <FormItem
                                                label={t('text.labels.date')}
                                                invalid={Boolean(getIn(touched, 'date') && getIn(errors, 'date'))}
                                                errorMessage={getIn(errors, 'date') as string}
                                            >
                                                <DatePicker
                                                    value={values.date as any}
                                                    onChange={(val) => {
                                                        setFieldValue('date', val)
                                                        setFieldTouched('date', true, false)
                                                    }}
                                                />
                                            </FormItem>
                                        </FormContainer>
                                    </Card>
                                </div>
                            )}

                            <div className="flex items-center justify-between mt-6">
                                <div>
                                    <Button type="button" onClick={() => navigate(-1)}>{t('text.actions.cancel')}</Button>
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" disabled={currentStep === 0} onClick={goPrev}>{t('text.actions.back')}</Button>
                                    {currentStep < 3 && (
                                        <Button
                                            type="button"
                                            variant="solid"
                                            disabled={
                                                (currentStep === 0 && (!values.customerId || !values.orderCurrency || !values.paymentMehod || addressesIncomplete)) ||
                                                (currentStep === 1 && (values.items || []).length === 0)
                                            }
                                            onClick={goNext}
                                        >
                                            {t('text.actions.next')}
                                        </Button>
                                    )}
                                    {currentStep === 3 && (
                                        <Button variant="solid" type="submit">{t('text.actions.save')}</Button>
                                    )}
                                </div>
                            </div>

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

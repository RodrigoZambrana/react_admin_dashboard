import { useCallback, useEffect, useMemo, useState } from 'react'
import Card from '@/components/ui/Card'
import { Formik, Form, Field } from 'formik'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import Loading from '@/components/shared/Loading'
import Table from '@/components/ui/Table'
import Select from '@/components/ui/Select'
import {
    apiGetSystemConfig,
    apiUpdateSystemConfig,
    apiGetSystemCurrencies,
    apiCreateSystemCurrency,
    apiUpdateSystemCurrency,
    apiDeleteSystemCurrency,
    apiUpdateExchangeRates,
} from '@/services/SettingsService'
import { useAppDispatch } from '@/store'
import { setAvailableCurrencies } from '@/store/slices/currency/currencySlice'

const { Tr, Td, THead, Th, TBody } = Table

const FALLBACK_CURRENCY_CODES = ['USD', 'UYU'] as const
const FALLBACK_CURRENCY_OPTIONS: { value: string; label: string; description?: string }[] =
    FALLBACK_CURRENCY_CODES.map((code) => ({
        value: code,
        label: code,
    }))

const SystemConfig = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const [initial, setInitial] = useState<{ taxRate: number; currencyBase: string }>({
        taxRate: 22,
        currencyBase: 'USD',
    })
    const [loading, setLoading] = useState(true)
    const [currencies, setCurrencies] = useState<string[]>([...FALLBACK_CURRENCY_CODES])
    const [currenciesLoaded, setCurrenciesLoaded] = useState(false)
    const [currencyOptions, setCurrencyOptions] = useState<
        { value: string; label: string; description?: string }[]
    >(FALLBACK_CURRENCY_OPTIONS)
    const [newCurrencyOption, setNewCurrencyOption] = useState<{
        value: string
        label: string
        description?: string
    } | null>(null)
    const [newCurrencyRate, setNewCurrencyRate] = useState<string>('')
    const [editingCurrency, setEditingCurrency] = useState<string | null>(null)
    const [editingOption, setEditingOption] = useState<{
        value: string
        label: string
        description?: string
    } | null>(null)
    const [editingRate, setEditingRate] = useState<string>('')
    const [currencyBase, setCurrencyBase] = useState<string>(FALLBACK_CURRENCY_CODES[0])
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({})
    const [currencyAction, setCurrencyAction] = useState<
        | { type: 'add' }
        | { type: 'update'; code: string }
        | { type: 'delete'; code: string }
        | null
    >(null)

    const buildOptionLabel = useCallback((code: string, text?: string, symbol?: string) => {
        const parts = [code]
        if (text) {
            parts.push(text)
        }
        const suffix = symbol ? `(${symbol})` : undefined
        return suffix ? `${parts.join(' · ')} ${suffix}` : parts.join(' · ')
    }, [])

    const currencyBaseLabel = t('settings.systemConfig.currencyBase.label', {
        defaultValue: 'Base currency',
    })
    const currencyBasePlaceholder = t('settings.systemConfig.currencyBase.placeholder', {
        defaultValue: 'Select base currency',
    })
    const addCurrencyPlaceholder = t('settings.systemConfig.currency.placeholder', {
        defaultValue: 'Select currency to add',
    })
    const addCurrencyRatePlaceholder = t('settings.systemConfig.exchangeRates.placeholder', {
        defaultValue: 'Enter rate',
    })

    const ensureCurrencyPresence = useCallback((list: string[], baseCode: string) => {
        const normalized = list
            .filter((code): code is string => typeof code === 'string' && code.trim().length > 0)
            .map((code) => code.trim().toUpperCase())
        const baseUpper = baseCode.trim().toUpperCase()
        if (!normalized.includes(baseUpper)) {
            normalized.unshift(baseUpper)
        }
        return Array.from(new Set(normalized))
    }, [])

    const deriveRateRecord = useCallback(
        (
            baseCode: string,
            codeList: string[],
            payload?: { quote: string; rate: number }[],
        ): Record<string, number> => {
            const rateMap = new Map<string, number>()
            if (Array.isArray(payload)) {
                payload.forEach((entry) => {
                    const quote = entry?.quote?.trim()?.toUpperCase()
                    const numericRate = Number(entry?.rate)
                    if (quote && Number.isFinite(numericRate)) {
                        rateMap.set(quote, numericRate)
                    }
                })
            }
            const record: Record<string, number> = {}
            const baseUpper = baseCode.trim().toUpperCase()
            codeList.forEach((code) => {
                const upper = code.trim().toUpperCase()
                if (upper === baseUpper) {
                    record[upper] = 1
                } else {
                    const candidate = rateMap.get(upper)
                    record[upper] = Number.isFinite(candidate ?? NaN) && (candidate as number) > 0 ? (candidate as number) : 0
                }
            })
            return record
        },
        [],
    )

    const resolvedCurrencyOptions = useMemo(
        () => (currencyOptions.length ? currencyOptions : FALLBACK_CURRENCY_OPTIONS),
        [currencyOptions],
    )

    const getCurrencyLabel = useCallback(
        (code: string) => {
            const option = resolvedCurrencyOptions.find((item) => item.value === code)
            return option?.label ?? buildOptionLabel(code)
        },
        [buildOptionLabel, resolvedCurrencyOptions],
    )

    const syncStoreCurrencies = useCallback(
        (list: string[]) => {
            dispatch(setAvailableCurrencies(list))
        },
        [dispatch],
    )

    const loadCurrencies = useCallback(async () => {
        try {
            const res = await apiGetSystemCurrencies<string[]>()
            const rawList = Array.isArray(res.data) && res.data.length ? res.data : [...FALLBACK_CURRENCY_CODES]
            const ensured = ensureCurrencyPresence(rawList, currencyBase)
            setCurrencies(ensured)
            syncStoreCurrencies(ensured)
            setExchangeRates((prev) => {
                const next = deriveRateRecord(currencyBase, ensured)
                const merged: Record<string, number> = {}
                let changed = false
                ensured.forEach((code) => {
                    const upper = code
                    const prevValue = prev[upper]
                    const baseValue = next[upper]
                    const value = upper === currencyBase ? 1 : Number.isFinite(prevValue) && prevValue !== undefined ? prevValue : baseValue
                    merged[upper] = upper === currencyBase ? 1 : value
                    if (merged[upper] !== prevValue) {
                        changed = true
                    }
                })
                if (Object.keys(prev).length !== Object.keys(merged).length) {
                    changed = true
                } else {
                    for (const key of Object.keys(prev)) {
                        if (!(key in merged)) {
                            changed = true
                            break
                        }
                    }
                }
                return changed ? merged : prev
            })
        } catch {
            const fallback = ensureCurrencyPresence([...FALLBACK_CURRENCY_CODES], currencyBase)
            setCurrencies(fallback)
            syncStoreCurrencies(fallback)
        } finally {
            setCurrenciesLoaded(true)
        }
    }, [currencyBase, deriveRateRecord, ensureCurrencyPresence, syncStoreCurrencies])

    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiGetSystemConfig<{
                    taxRate?: number
                    currencies?: string[]
                    currencyBase?: string
                    currencyOptions?: { code: string; label: string; symbol?: string }[]
                    exchangeRates?: { quote: string; rate: number }[]
                }>()
                const data = res.data || {}
                const rawBase = typeof data.currencyBase === 'string' ? data.currencyBase : FALLBACK_CURRENCY_CODES[0]
                const base = rawBase.trim().toUpperCase()
                setCurrencyBase(base)
                const value = Number(data.taxRate)
                const fallbackWithLabels = FALLBACK_CURRENCY_OPTIONS.map((item) => ({
                    value: item.value,
                    label: buildOptionLabel(item.value, item.description, undefined),
                    description: item.description,
                }))
                const optionList =
                    Array.isArray(data.currencyOptions) && data.currencyOptions.length
                        ? data.currencyOptions.map((item) => ({
                              value: (item.code || '').trim().toUpperCase(),
                              label: buildOptionLabel(
                                  (item.code || '').trim().toUpperCase(),
                                  item.label,
                                  item.symbol,
                              ),
                              description: item.label,
                          }))
                        : fallbackWithLabels
                const filteredOptions = optionList.filter((item) => item.value)
                const uniqueOptions = Array.from(
                    new Map(filteredOptions.map((item) => [item.value, item])).values(),
                )
                setCurrencyOptions(uniqueOptions.length ? uniqueOptions : fallbackWithLabels)
                const configuredCurrencies = Array.isArray(data.currencies) ? data.currencies : []
                const ensuredCurrencies = ensureCurrencyPresence(configuredCurrencies, base)
                setCurrencies(ensuredCurrencies)
                syncStoreCurrencies(ensuredCurrencies)
                setCurrenciesLoaded(true)
                setExchangeRates(deriveRateRecord(base, ensuredCurrencies, data.exchangeRates))
                setInitial({
                    taxRate: Number.isNaN(value) ? 22 : value,
                    currencyBase: base,
                })
            } catch {
                const fallbackBase = FALLBACK_CURRENCY_CODES[0]
                setCurrencyBase(fallbackBase)
                const fallbackCurrencies = ensureCurrencyPresence([...FALLBACK_CURRENCY_CODES], fallbackBase)
                setCurrencies(fallbackCurrencies)
                syncStoreCurrencies(fallbackCurrencies)
                setExchangeRates(deriveRateRecord(fallbackBase, fallbackCurrencies))
                setInitial({ taxRate: 22, currencyBase: fallbackBase })
                setCurrenciesLoaded(false)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [buildOptionLabel, deriveRateRecord, ensureCurrencyPresence, syncStoreCurrencies])

    useEffect(() => {
        if (currenciesLoaded) {
            return
        }
        loadCurrencies()
    }, [currenciesLoaded, loadCurrencies])

    useEffect(() => {
        setCurrencies((prev) => {
            if (prev.includes(currencyBase)) {
                return prev
            }
            const ensured = ensureCurrencyPresence(prev, currencyBase)
            syncStoreCurrencies(ensured)
            return ensured
        })
    }, [currencyBase, ensureCurrencyPresence, syncStoreCurrencies])

    useEffect(() => {
        if (!currencies.length) {
            return
        }
        setExchangeRates((prev) => {
            const next: Record<string, number> = {}
            let changed = false
            currencies.forEach((code) => {
                const upper = code.trim().toUpperCase()
                const prevValue = prev[upper]
                const value = upper === currencyBase ? 1 : prevValue ?? 0
                next[upper] = value
                if (prevValue !== value) {
                    changed = true
                }
            })
            if (Object.keys(prev).length !== Object.keys(next).length) {
                changed = true
            } else {
                for (const key of Object.keys(prev)) {
                    if (!currencies.includes(key)) {
                        changed = true
                        break
                    }
                }
            }
            return changed ? next : prev
        })
    }, [currencies, currencyBase])

    const handleAddCurrency = async () => {
        const code = newCurrencyOption?.value
        if (!code) {
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {t('settings.systemConfig.currency.validation.format')}
                </Notification>,
                { placement: 'top-center' },
            )
            return
        }
        if (currencies.includes(code)) {
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {t('settings.systemConfig.currency.validation.duplicate')}
                </Notification>,
                { placement: 'top-center' },
            )
            return
        }
        const parsedRate = Number(newCurrencyRate)
        if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {t('settings.systemConfig.exchangeRates.validation.positive', {
                        defaultValue: 'Please enter a conversion rate greater than zero.',
                        currency: code,
                    })}
                </Notification>,
                { placement: 'top-center' },
            )
            return
        }
        setCurrencyAction({ type: 'add' })
        try {
            const res = await apiCreateSystemCurrency<string[], { code: string }>({ code })
            const listRaw = Array.isArray(res.data) ? res.data : currencies.concat(code)
            const ensured = ensureCurrencyPresence(listRaw, currencyBase)
            const nextRates: Record<string, number> = { [currencyBase]: 1 }
            ensured.forEach((item) => {
                const upper = item.trim().toUpperCase()
                if (upper === currencyBase) {
                    nextRates[upper] = 1
                } else if (upper === code) {
                    nextRates[upper] = parsedRate
                } else {
                    const existing = Number(exchangeRates[upper])
                    nextRates[upper] = Number.isFinite(existing) && existing > 0 ? existing : 0
                }
            })
            const payloadRates = Object.entries(nextRates)
                .filter(([quote]) => quote !== currencyBase)
                .map(([quote, rate]) => ({ quote, rate }))
            await apiUpdateExchangeRates<
                boolean,
                { baseCurrency?: string; rates?: { quote: string; rate: number }[] }
            >({
                baseCurrency: currencyBase,
                rates: payloadRates,
            })
            setCurrencies(ensured)
            syncStoreCurrencies(ensured)
            setExchangeRates(nextRates)
            setNewCurrencyOption(null)
            setNewCurrencyRate('')
            toast.push(
                <Notification title={t('settings.systemConfig.currency.created.title')} type="success">
                    {t('settings.systemConfig.currency.created.desc')}
                </Notification>,
                { placement: 'top-center' },
            )
        } catch (error: any) {
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
                { placement: 'top-center' },
            )
        } finally {
            setCurrencyAction(null)
        }
    }

    const startEdit = (code: string) => {
        if (code === currencyBase) {
            return
        }
        setEditingCurrency(code)
        const match =
            resolvedCurrencyOptions.find((item) => item.value === code) ??
            ({
                value: code,
                label: getCurrencyLabel(code),
            } as { value: string; label: string; description?: string })
        setEditingOption(match)
        const rate = Number(exchangeRates[code])
        setEditingRate(rate > 0 ? String(rate) : '')
    }

    const cancelEdit = () => {
        setEditingCurrency(null)
        setEditingOption(null)
        setEditingRate('')
    }

    const handleUpdateCurrency = async () => {
        if (!editingCurrency) return
        const next = editingOption?.value?.trim().toUpperCase()
        if (!next) {
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {t('settings.systemConfig.currency.validation.format')}
                </Notification>,
                { placement: 'top-center' },
            )
            return
        }
        if (next !== editingCurrency && currencies.includes(next)) {
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {t('settings.systemConfig.currency.validation.duplicate')}
                </Notification>,
                { placement: 'top-center' },
            )
            return
        }
        const parsedRate = Number(editingRate)
        if (next !== currencyBase && (!Number.isFinite(parsedRate) || parsedRate <= 0)) {
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {t('settings.systemConfig.exchangeRates.validation.positive', {
                        defaultValue: 'Please provide a conversion rate greater than zero for {{currency}}.',
                        currency: getCurrencyLabel(next),
                    })}
                </Notification>,
                { placement: 'top-center' },
            )
            return
        }
        setCurrencyAction({ type: 'update', code: editingCurrency })
        try {
            let ensured = currencies
            if (next !== editingCurrency) {
                const res = await apiUpdateSystemCurrency<string[], { current: string; next: string }>({
                    current: editingCurrency,
                    next,
                })
                const listRaw = Array.isArray(res.data)
                    ? res.data
                    : currencies.map((item) => (item === editingCurrency ? next : item))
                ensured = ensureCurrencyPresence(listRaw, currencyBase)
                setCurrencies(ensured)
                syncStoreCurrencies(ensured)
            }
            const targetRate = next === currencyBase ? 1 : parsedRate
            const nextRates = ensured.reduce((acc, curr) => {
                const upper = curr.trim().toUpperCase()
                if (upper === currencyBase) {
                    acc[upper] = 1
                } else if (upper === next) {
                    acc[upper] = targetRate
                } else {
                    const existing = Number(exchangeRates[upper])
                    acc[upper] = Number.isFinite(existing) && existing > 0 ? existing : 0
                }
                return acc
            }, {} as Record<string, number>)
            const payloadRates = Object.entries(nextRates)
                .filter(([quote]) => quote !== currencyBase)
                .map(([quote, rate]) => ({ quote, rate }))
            await apiUpdateExchangeRates<
                boolean,
                { baseCurrency?: string; rates?: { quote: string; rate: number }[] }
            >({
                baseCurrency: currencyBase,
                rates: payloadRates,
            })
            setExchangeRates(nextRates)
            setEditingRate('')
            toast.push(
                <Notification title={t('settings.systemConfig.currency.updated.title')} type="success">
                    {t('settings.systemConfig.currency.updated.desc')}
                </Notification>,
                { placement: 'top-center' },
            )
            cancelEdit()
        } catch (error: any) {
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
                { placement: 'top-center' },
            )
        } finally {
            setCurrencyAction(null)
        }
    }

    const handleDeleteCurrency = async (code: string) => {
        if (code === currencyBase) {
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {t('settings.systemConfig.currency.validation.baseRemoval', {
                        defaultValue: 'Unable to remove the base currency. Please change the base currency first.',
                    })}
                </Notification>,
                { placement: 'top-center' },
            )
            return
        }
        setCurrencyAction({ type: 'delete', code })
        try {
            const res = await apiDeleteSystemCurrency<string[], { code: string }>({ code })
            const listRaw = Array.isArray(res.data)
                ? res.data
                : currencies.filter((item) => item !== code)
            const ensured = ensureCurrencyPresence(listRaw, currencyBase)
            const nextRates = ensured.reduce((acc, curr) => {
                const upper = curr.trim().toUpperCase()
                if (upper === currencyBase) {
                    acc[upper] = 1
                } else {
                    const existing = Number(exchangeRates[upper])
                    acc[upper] = Number.isFinite(existing) && existing > 0 ? existing : 0
                }
                return acc
            }, {} as Record<string, number>)
            const payloadRates = Object.entries(nextRates)
                .filter(([quote]) => quote !== currencyBase)
                .map(([quote, rate]) => ({ quote, rate }))
            await apiUpdateExchangeRates<
                boolean,
                { baseCurrency?: string; rates?: { quote: string; rate: number }[] }
            >({
                baseCurrency: currencyBase,
                rates: payloadRates,
            })
            setCurrencies(ensured)
            syncStoreCurrencies(ensured)
            setExchangeRates(nextRates)
            toast.push(
                <Notification title={t('settings.systemConfig.currency.deleted.title')} type="success">
                    {t('settings.systemConfig.currency.deleted.desc')}
                </Notification>,
                { placement: 'top-center' },
            )
            if (editingCurrency === code) {
                cancelEdit()
            }
        } catch (error: any) {
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {error?.response?.data?.message || error?.message || String(error)}
                </Notification>,
                { placement: 'top-center' },
            )
        } finally {
            setCurrencyAction(null)
        }
    }

    return (
        <Loading loading={loading}>
            <div className="flex flex-col gap-6">
                <Card>
                    <h3 className="mb-2">{t('settings.systemConfig.title')}</h3>
                    <p className="mb-6 text-sm opacity-70">
                        {t('settings.systemConfig.desc')}
                    </p>
                <Formik
                    enableReinitialize
                    initialValues={initial}
                    validationSchema={Yup.object().shape({
                        taxRate: Yup.number()
                            .typeError(t('settings.systemConfig.taxRateLabel'))
                            .min(
                                0,
                                t('validation.fieldInvalid', {
                                    field: t('settings.systemConfig.taxRateLabel'),
                                }),
                            )
                            .max(
                                100,
                                t('validation.fieldInvalid', {
                                    field: t('settings.systemConfig.taxRateLabel'),
                                }),
                            )
                            .required(t('settings.systemConfig.taxRateLabel')),
                        currencyBase: Yup.string()
                            .trim()
                            .required(
                                t('validation.fieldRequired', {
                                    field: currencyBaseLabel,
                                }),
                            ),
                    })}
                    onSubmit={async (values, { setSubmitting }) => {
                        try {
                            await apiUpdateSystemConfig<
                                boolean,
                                { taxRate: number; currencyBase: string }
                            >({
                                taxRate: values.taxRate,
                                currencyBase: values.currencyBase,
                            })
                            toast.push(
                                <Notification title={t('settings.systemConfig.updated.title')} type="success">
                                    {t('settings.systemConfig.updated.desc')}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            const baseExists = resolvedCurrencyOptions.some(
                                (option) => option.value === values.currencyBase,
                            )
                            setInitial({
                                ...values,
                                currencyBase: baseExists
                                    ? values.currencyBase
                                    : resolvedCurrencyOptions[0]?.value || '',
                            })
                            setCurrencyBase(
                                baseExists
                                    ? values.currencyBase
                                    : resolvedCurrencyOptions[0]?.value || currencyBase,
                            )
                        } catch (e: any) {
                            toast.push(
                                <Notification title={t('validation.failed')} type="danger">
                                    {e?.response?.data?.message || e?.message || String(e)},
                                </Notification>,
                                { placement: 'top-center' },
                            )
                        } finally {
                            setSubmitting(false)
                        }
                    }}
                >
                    {({ touched, errors, isSubmitting, setFieldValue }) => (
                        <Form>
                            <FormContainer>
                                <FormItem
                                    label={t('settings.systemConfig.taxRateLabel')}
                                    invalid={touched.taxRate && !!errors.taxRate}
                                    errorMessage={errors.taxRate}
                                >
                                    <Field name="taxRate">
                                        {({ field }: { field: any }) => (
                                            <Input
                                                {...field}
                                                type="number"
                                                min={0}
                                                max={100}
                                                step="0.01"
                                                value={field.value}
                                                onChange={(e) => {
                                                    const value = e.target.value
                                                    setFieldValue(
                                                        field.name,
                                                        value === '' ? '' : Number(value),
                                                    )
                                                }}
                                            />
                                        )}
                                    </Field>
                                </FormItem>
                                <FormItem
                                    label={currencyBaseLabel}
                                    invalid={touched.currencyBase && !!errors.currencyBase}
                                    errorMessage={errors.currencyBase as string | undefined}
                                >
                                    <Field name="currencyBase">
                                        {({ field, form }: { field: any; form: any }) => {
                                            const selected =
                                                resolvedCurrencyOptions.find(
                                                    (option) => option.value === field.value,
                                                ) ||
                                                (field.value
                                                    ? {
                                                          value: field.value,
                                                          label: getCurrencyLabel(field.value),
                                                      }
                                                    : null)
                                            return (
                                                <Select
                                                    placeholder={currencyBasePlaceholder}
                                                    options={resolvedCurrencyOptions}
                                                    value={selected as any}
                                                    isClearable={false}
                                                    isSearchable
                                                    onChange={(option) => {
                                                        const next = (option as any)?.value
                                                        form.setFieldValue(field.name, next || '')
                                                        if (next) {
                                                            setCurrencyBase(next)
                                                        }
                                                    }}
                                                />
                                            )
                                        }}
                                    </Field>
                                </FormItem>
                                <div>
                                    <Button type="submit" variant="solid" loading={isSubmitting}>
                                        {t('text.actions.save')}
                                    </Button>
                                </div>
                            </FormContainer>
                        </Form>
                    )}
                    </Formik>
                </Card>
                <Card>
                    <div className="flex flex-col gap-4">
                        <div>
                            <h4 className="mb-1">{t('settings.systemConfig.currency.title')}</h4>
                            <p className="text-sm opacity-70">
                                {t('settings.systemConfig.currency.desc')}
                            </p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-2 max-w-sm">
                            <Select
                                className="min-w-[220px]"
                                placeholder={addCurrencyPlaceholder}
                                options={resolvedCurrencyOptions.filter(
                                    (option) => !currencies.includes(option.value),
                                )}
                                value={newCurrencyOption as any}
                                isClearable
                                isSearchable
                                onChange={(option) => {
                                    const nextOption = (option as any) ?? null
                                    setNewCurrencyOption(nextOption)
                                    setNewCurrencyRate('')
                                }}
                            />
                            <Input
                                className="w-full sm:min-w-[200px] sm:max-w-[320px]"
                                type="number"
                                min={0}
                                step="0.000001"
                                placeholder={addCurrencyRatePlaceholder}
                                value={newCurrencyRate}
                                onChange={(e) => setNewCurrencyRate(e.target.value)}
                            />
                            <Button
                                variant="solid"
                                loading={currencyAction?.type === 'add'}
                                onClick={handleAddCurrency}
                            >
                                {t('settings.systemConfig.currency.actions.add')}
                            </Button>
                        </div>
                        <Table>
                            <THead>
                                <Tr>
                                    <Th>{t('settings.systemConfig.currency.columns.code')}</Th>
                                    <Th>{t('settings.systemConfig.exchangeRates.title', {
                                        defaultValue: 'Exchange rate',
                                    })}</Th>
                                    <Th className="text-right">{t('text.columns.actions')}</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {currenciesLoaded && currencies.length === 0 && (
                                    <Tr>
                                        <Td colSpan={3} className="py-6 text-center text-sm opacity-70">
                                            {t('settings.systemConfig.currency.empty')}
                                        </Td>
                                    </Tr>
                                )}
                                {currencies.map((code) => {
                                    const isEditing = editingCurrency === code
                                    const isDeleting =
                                        currencyAction?.type === 'delete' &&
                                        currencyAction.code === code
                                    const isUpdating =
                                        currencyAction?.type === 'update' &&
                                        currencyAction.code === code
                                    const isBaseCurrency = code === currencyBase
                                    return (
                                        <Tr key={code}>
                                            <Td className="w-full align-middle">
                                                {isEditing ? (
                                                    <Select
                                                        autoFocus
                                                        className="min-w-[220px]"
                                                        options={(() => {
                                                            const baseOptions = resolvedCurrencyOptions.filter(
                                                                (option) =>
                                                                    option.value === editingCurrency ||
                                                                    !currencies.includes(option.value),
                                                            )
                                                            if (
                                                                editingOption &&
                                                                !baseOptions.some(
                                                                    (opt) => opt.value === editingOption.value,
                                                            )
                                                            ) {
                                                                return [editingOption, ...baseOptions]
                                                            }
                                                            return baseOptions
                                                        })()}
                                                        value={editingOption as any}
                                                        isSearchable
                                                        onChange={(option) =>
                                                            {
                                                                const nextOption = (option as any) ?? null
                                                                setEditingOption(nextOption)
                                                                const nextCode = nextOption?.value?.trim()?.toUpperCase()
                                                                if (nextCode) {
                                                                    if (nextCode === currencyBase) {
                                                                        setEditingRate('1')
                                                                    } else {
                                                                        const existing = Number(exchangeRates[nextCode])
                                                                        setEditingRate(
                                                                            Number.isFinite(existing) && existing > 0
                                                                                ? String(existing)
                                                                                : '',
                                                                        )
                                                                    }
                                                                } else {
                                                                    setEditingRate('')
                                                                }
                                                            }
                                                    }
                                                />
                                                ) : (
                                                    getCurrencyLabel(code)
                                                )}
                                            </Td>
                                            <Td className="align-middle">
                                                {isBaseCurrency ? (
                                                    <span>1</span>
                                                ) : isEditing ? (
                                                    <Input
                                                        className="w-full min-w-[160px]"
                                                        type="number"
                                                        min={0}
                                                        step="0.000001"
                                                        value={editingRate}
                                                        onChange={(e) => setEditingRate(e.target.value)}
                                                    />
                                                ) : (
                                                    <span>
                                                        {exchangeRates[code] && exchangeRates[code] > 0
                                                            ? exchangeRates[code]
                                                            : '—'}
                                                    </span>
                                                )}
                                            </Td>
                                            <Td className="text-right">
                                                {isEditing ? (
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="twoTone"
                                                            loading={isUpdating}
                                                            onClick={handleUpdateCurrency}
                                                        >
                                                            {t('text.actions.save')}
                                                        </Button>
                                                        <Button size="sm" onClick={cancelEdit}>
                                                            {t('text.actions.cancel')}
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    isBaseCurrency ? (
                                                        <div className="text-xs uppercase opacity-70">
                                                            {t('settings.systemConfig.currency.baseTag', {
                                                                defaultValue: 'Base currency',
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-end gap-2">
                                                            <Button size="sm" onClick={() => startEdit(code)}>
                                                                {t('text.actions.edit')}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                color="red-600"
                                                                loading={isDeleting}
                                                                onClick={() => handleDeleteCurrency(code)}
                                                            >
                                                                {t('text.actions.delete')}
                                                            </Button>
                                                        </div>
                                                    )
                                                )}
                                            </Td>
                                        </Tr>
                                    )
                                })}
                            </TBody>
                        </Table>
                    </div>
                </Card>
            </div>
        </Loading>
    )
}

export default SystemConfig

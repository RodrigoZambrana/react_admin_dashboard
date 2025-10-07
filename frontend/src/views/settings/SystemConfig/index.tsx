import { useEffect, useState } from 'react'
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
import {
    apiGetSystemConfig,
    apiUpdateSystemConfig,
    apiGetSystemCurrencies,
    apiCreateSystemCurrency,
    apiUpdateSystemCurrency,
    apiDeleteSystemCurrency,
} from '@/services/SettingsService'
import { useAppDispatch } from '@/store'
import { setAvailableCurrencies } from '@/store/slices/currency/currencySlice'

const { Tr, Td, THead, Th, TBody } = Table

const SystemConfig = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const [initial, setInitial] = useState<{ taxRate: number }>({ taxRate: 22 })
    const [loading, setLoading] = useState(true)
    const [currencies, setCurrencies] = useState<string[]>(['USD', 'UYU'])
    const [currenciesLoaded, setCurrenciesLoaded] = useState(false)
    const [newCurrency, setNewCurrency] = useState('')
    const [editingCurrency, setEditingCurrency] = useState<string | null>(null)
    const [editingValue, setEditingValue] = useState('')
    const [currencyAction, setCurrencyAction] = useState<
        | { type: 'add' }
        | { type: 'update'; code: string }
        | { type: 'delete'; code: string }
        | null
    >(null)

    const normalizeCurrency = (value: string) => {
        const trimmed = (value || '').trim().toUpperCase()
        return /^[A-Z]{3,5}$/.test(trimmed) ? trimmed : ''
    }

    const syncStoreCurrencies = (list: string[]) => {
        dispatch(setAvailableCurrencies(list))
    }

    const loadCurrencies = async () => {
        try {
            const res = await apiGetSystemCurrencies<string[]>()
            const list = Array.isArray(res.data) && res.data.length ? res.data : ['USD', 'UYU']
            setCurrencies(list)
            syncStoreCurrencies(list)
        } catch {
            const fallback = ['USD', 'UYU']
            setCurrencies(fallback)
            syncStoreCurrencies(fallback)
        } finally {
            setCurrenciesLoaded(true)
        }
    }

    useEffect(() => {
        const load = async () => {
            try {
                const res = await apiGetSystemConfig<{ taxRate?: number; currencies?: string[] }>()
                const value = Number((res.data as any)?.taxRate)
                setInitial({ taxRate: Number.isNaN(value) ? 22 : value })
                const configuredCurrencies = (res.data as any)?.currencies
                if (Array.isArray(configuredCurrencies) && configuredCurrencies.length) {
                    setCurrencies(configuredCurrencies)
                    syncStoreCurrencies(configuredCurrencies)
                    setCurrenciesLoaded(true)
                } else {
                    setCurrenciesLoaded(false)
                }
            } catch {
                setInitial({ taxRate: 22 })
                setCurrenciesLoaded(false)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    useEffect(() => {
        if (currenciesLoaded) {
            return
        }
        loadCurrencies()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currenciesLoaded])

    const handleAddCurrency = async () => {
        const code = normalizeCurrency(newCurrency)
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
        setCurrencyAction({ type: 'add' })
        try {
            const res = await apiCreateSystemCurrency<string[], { code: string }>({ code })
            const list = Array.isArray(res.data) ? res.data : currencies.concat(code)
            setCurrencies(list)
            syncStoreCurrencies(list)
            setNewCurrency('')
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
        setEditingCurrency(code)
        setEditingValue(code)
    }

    const cancelEdit = () => {
        setEditingCurrency(null)
        setEditingValue('')
    }

    const handleUpdateCurrency = async () => {
        if (!editingCurrency) return
        const next = normalizeCurrency(editingValue)
        if (!next) {
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {t('settings.systemConfig.currency.validation.format')}
                </Notification>,
                { placement: 'top-center' },
            )
            return
        }
        setCurrencyAction({ type: 'update', code: editingCurrency })
        try {
            const res = await apiUpdateSystemCurrency<string[], { current: string; next: string }>({
                current: editingCurrency,
                next,
            })
            const list = Array.isArray(res.data)
                ? res.data
                : currencies.map((item) => (item === editingCurrency ? next : item))
            setCurrencies(list)
            syncStoreCurrencies(list)
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
        setCurrencyAction({ type: 'delete', code })
        try {
            const res = await apiDeleteSystemCurrency<string[], { code: string }>({ code })
            const list = Array.isArray(res.data)
                ? res.data
                : currencies.filter((item) => item !== code)
            setCurrencies(list)
            syncStoreCurrencies(list)
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
                            .min(0, t('validation.fieldInvalid', { field: t('settings.systemConfig.taxRateLabel') }))
                            .max(100, t('validation.fieldInvalid', { field: t('settings.systemConfig.taxRateLabel') }))
                            .required(t('settings.systemConfig.taxRateLabel')),
                    })}
                    onSubmit={async (values, { setSubmitting }) => {
                        try {
                            await apiUpdateSystemConfig<boolean, { taxRate: number }>({ taxRate: values.taxRate })
                            toast.push(
                                <Notification title={t('settings.systemConfig.updated.title')} type="success">
                                    {t('settings.systemConfig.updated.desc')}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            setInitial(values)
                        } catch (e: any) {
                            toast.push(
                                <Notification title={t('validation.failed')} type="danger">
                                    {e?.response?.data?.message || e?.message || String(e)}
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
                            <Input
                                value={newCurrency}
                                placeholder={t('settings.systemConfig.currency.placeholder')}
                                onChange={(e) => setNewCurrency(e.target.value)}
                                autoComplete="off"
                                maxLength={5}
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
                                    <Th className="text-right">{t('text.columns.actions')}</Th>
                                </Tr>
                            </THead>
                            <TBody>
                                {currenciesLoaded && currencies.length === 0 && (
                                    <Tr>
                                        <Td colSpan={2} className="py-6 text-center text-sm opacity-70">
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
                                    return (
                                        <Tr key={code}>
                                            <Td className="w-full align-middle">
                                                {isEditing ? (
                                                    <Input
                                                        value={editingValue}
                                                        onChange={(e) =>
                                                            setEditingValue(e.target.value)
                                                        }
                                                        autoFocus
                                                        maxLength={5}
                                                    />
                                                ) : (
                                                    code
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

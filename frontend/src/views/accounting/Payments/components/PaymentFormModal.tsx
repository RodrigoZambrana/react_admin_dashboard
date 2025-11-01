import { useEffect, useMemo, useState } from 'react'
import Dialog from '@/components/ui/Dialog'
import { Formik, Form, Field } from 'formik'
import * as Yup from 'yup'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import DatePicker from '@/components/ui/DatePicker'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import SelectAcceptedCurrencies from '@/components/shared/SelectAcceptedCurrencies'
import { useTranslation } from 'react-i18next'
import {
    useAppDispatch,
    useAppSelector,
    togglePaymentDialog,
    getPayments,
} from '../store'
import type { PaymentStatus, PaymentType, PaymentsTableState } from '../store/paymentsSlice'
import {
    apiCreatePayment,
    apiGetPayment,
    apiUpdatePayment,
} from '@/services/AccountingService'
import { apiGetPaymentMethods } from '@/services/SettingsService'

type PaymentMethodOption = {
    value: string
    label: string
}

type PaymentFormValues = {
    orderId: string
    amount: number | ''
    currency: string
    date: Date | null
    type: PaymentType
    status: PaymentStatus
    paymentMethodId: string | null
    method: string
    reference: string
    notes: string
}

const validationSchema = (t: (key: string) => string) =>
    Yup.object().shape({
        orderId: Yup.number()
            .transform((value, originalValue) => {
                const parsed = Number(originalValue)
                return Number.isNaN(parsed) ? undefined : parsed
            })
            .typeError(t('accounting.payments.validation.orderIdRequired'))
            .required(t('accounting.payments.validation.orderIdRequired')),
        amount: Yup.number()
            .transform((value, originalValue) => {
                const parsed = Number(originalValue)
                return Number.isNaN(parsed) ? undefined : parsed
            })
            .typeError(t('accounting.payments.validation.amountRequired'))
            .moreThan(0, t('accounting.payments.validation.amountPositive'))
            .required(t('accounting.payments.validation.amountRequired')),
    })

const statusOptions: Array<{ value: PaymentStatus; labelKey: string }> = [
    { value: 'CONFIRMED', labelKey: 'accounting.payments.status.confirmed' },
    { value: 'REGISTERED', labelKey: 'accounting.payments.status.registered' },
    { value: 'FAILED', labelKey: 'accounting.payments.status.failed' },
]

const typeOptions: Array<{ value: PaymentType; labelKey: string }> = [
    { value: 'DEPOSIT', labelKey: 'accounting.payments.type.deposit' },
    { value: 'BALANCE', labelKey: 'accounting.payments.type.balance' },
    { value: 'REFUND', labelKey: 'accounting.payments.type.refund' },
]

const mapPaymentStatus = (status?: string | null): PaymentStatus => {
    if (status === 'REGISTERED' || status === 'FAILED') {
        return status
    }
    return 'CONFIRMED'
}

const mapPaymentType = (type?: string | null): PaymentType => {
    if (type === 'DEPOSIT' || type === 'REFUND') {
        return type
    }
    return 'BALANCE'
}

const PaymentFormModal = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const dialogOpen = useAppSelector((state) => state.accountingPayments.data.dialogOpen)
    const dialogMode = useAppSelector((state) => state.accountingPayments.data.dialogMode)
    const dialogPaymentId = useAppSelector(
        (state) => state.accountingPayments.data.dialogPaymentId,
    )
    const tableData = useAppSelector((state) => state.accountingPayments.data.tableData)

    const [methods, setMethods] = useState<PaymentMethodOption[]>([])
    const [loading, setLoading] = useState(false)
    const [initialValues, setInitialValues] = useState<PaymentFormValues>({
        orderId: '',
        amount: '',
        currency: 'UYU',
        date: new Date(),
        type: 'BALANCE',
        status: 'CONFIRMED',
        paymentMethodId: null,
        method: '',
        reference: '',
        notes: '',
    })

    const statusSelectOptions = useMemo(
        () =>
            statusOptions.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
            })),
        [t],
    )

    const typeSelectOptions = useMemo(
        () =>
            typeOptions.map((option) => ({
                value: option.value,
                label: t(option.labelKey),
            })),
        [t],
    )

    useEffect(() => {
        const loadMethods = async () => {
            const res = await apiGetPaymentMethods<{ id: number | string; label?: string }[]>()
            const options = (res.data || []).map((item) => ({
                value: String(item.id),
                label: item.label || String(item.id),
            }))
            setMethods(options)
        }
        loadMethods()
    }, [])

    useEffect(() => {
        if (dialogOpen && dialogMode === 'edit' && dialogPaymentId) {
            const loadPayment = async () => {
                setLoading(true)
                try {
                    const res = await apiGetPayment<{
                        id: number
                        orderId: number
                        amount: number
                        currency: string
                        date: string
                        type: string
                        status: string
                        paymentMethodId: number | null
                        method: string | null
                        reference: string | null
                        notes: string | null
                    }>(dialogPaymentId)
                    const data = res.data
                    setInitialValues({
                        orderId: String(data.orderId),
                        amount: Number(data.amount),
                        currency: data.currency ?? 'UYU',
                        date: data.date ? new Date(data.date) : new Date(),
                        type: mapPaymentType(data.type),
                        status: mapPaymentStatus(data.status),
                        paymentMethodId:
                            typeof data.paymentMethodId === 'number'
                                ? String(data.paymentMethodId)
                                : null,
                        method: data.method ?? '',
                        reference: data.reference ?? '',
                        notes: data.notes ?? '',
                    })
                } catch (error) {
                    toast.push(
                        <Notification title={t('accounting.payments.feedback.loadFailedTitle')} type="danger">
                            {t('accounting.payments.feedback.loadFailedDesc')}
                        </Notification>,
                    )
                    dispatch(togglePaymentDialog({ open: false }))
                } finally {
                    setLoading(false)
                }
            }
            loadPayment()
        } else if (dialogOpen && dialogMode === 'create') {
            setInitialValues({
                orderId: '',
                amount: '',
                currency: 'UYU',
                date: new Date(),
                type: 'BALANCE',
                status: 'CONFIRMED',
                paymentMethodId: null,
                method: '',
                reference: '',
                notes: '',
            })
        }
    }, [dialogOpen, dialogMode, dialogPaymentId, dispatch, t])

    const onClose = () => {
        dispatch(togglePaymentDialog({ open: false }))
    }

    const handleSubmit = async (values: PaymentFormValues, resetForm: () => void) => {
        const payload: Record<string, unknown> = {
            orderId: Number(values.orderId),
            amount: Number(values.amount),
            currency: values.currency?.toUpperCase() ?? 'UYU',
            date: values.date ? values.date.toISOString() : new Date().toISOString(),
            type: values.type,
            status: values.status,
            paymentMethodId: values.paymentMethodId ? Number(values.paymentMethodId) : null,
            method: values.method?.trim() || null,
            reference: values.reference?.trim() || null,
            notes: values.notes?.trim() || null,
        }

        try {
            if (dialogMode === 'edit' && dialogPaymentId) {
                await apiUpdatePayment<boolean, typeof payload>(dialogPaymentId, payload)
                toast.push(
                    <Notification title={t('accounting.payments.feedback.updatedTitle')} type="success">
                        {t('accounting.payments.feedback.updatedDesc')}
                    </Notification>,
                )
            } else {
                await apiCreatePayment<boolean, typeof payload>(payload)
                toast.push(
                    <Notification title={t('accounting.payments.feedback.createdTitle')} type="success">
                        {t('accounting.payments.feedback.createdDesc')}
                    </Notification>,
                )
                resetForm()
            }
            dispatch(togglePaymentDialog({ open: false }))
            const refreshData: PaymentsTableState = { ...tableData }
            dispatch(getPayments(refreshData))
        } catch (error) {
            toast.push(
                <Notification title={t('accounting.payments.feedback.saveFailedTitle')} type="danger">
                    {t('accounting.payments.feedback.saveFailedDesc')}
                </Notification>,
            )
        }
    }

    const formReady = dialogMode === 'create' || !loading

    return (
        <Dialog
            isOpen={dialogOpen}
            onClose={onClose}
            onRequestClose={onClose}
            width={480}
        >
            <h4 className="mb-4">
                {dialogMode === 'edit'
                    ? t('accounting.payments.form.editTitle')
                    : t('accounting.payments.form.createTitle')}
            </h4>
            {formReady ? (
                <Formik
                    initialValues={initialValues}
                    enableReinitialize
                    validationSchema={validationSchema(t)}
                    onSubmit={(values, { resetForm, setSubmitting }) => {
                        handleSubmit(values, resetForm)
                        setSubmitting(false)
                    }}
                >
                    {({ values, errors, touched, setFieldValue, isSubmitting }) => (
                        <Form>
                            <FormContainer>
                                <FormItem
                                    label={t('accounting.payments.form.orderId')}
                                    invalid={Boolean(errors.orderId && touched.orderId)}
                                    errorMessage={errors.orderId as string}
                                >
                                    <Field type="number" name="orderId" component={Input} />
                                </FormItem>
                                <FormItem
                                    label={t('text.columns.amount')}
                                    invalid={Boolean(errors.amount && touched.amount)}
                                    errorMessage={errors.amount as string}
                                >
                                    <Field type="number" name="amount" component={Input} />
                                </FormItem>
                                <FormItem label={t('text.columns.currency')}>
                                    <SelectAcceptedCurrencies
                                        value={values.currency}
                                        onChange={(val) => setFieldValue('currency', val)}
                                    />
                                </FormItem>
                                <FormItem label={t('text.columns.date')}>
                                    <DatePicker
                                        value={values.date}
                                        onChange={(val) => setFieldValue('date', val)}
                                    />
                                </FormItem>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FormItem label={t('text.columns.type')}>
                                    <Select
                                        options={typeSelectOptions}
                                        value={
                                            typeSelectOptions.find(
                                                (option) => option.value === values.type,
                                            ) ?? null
                                        }
                                        onChange={(option) =>
                                            setFieldValue(
                                                'type',
                                                option
                                                    ? ((option as { value: PaymentType }).value as PaymentType)
                                                    : 'BALANCE',
                                            )
                                        }
                                    />
                                </FormItem>
                                <FormItem label={t('text.columns.status')}>
                                    <Select
                                        options={statusSelectOptions}
                                        value={
                                            statusSelectOptions.find(
                                                (option) => option.value === values.status,
                                            ) ?? null
                                        }
                                        onChange={(option) =>
                                            setFieldValue(
                                                'status',
                                                option
                                                    ? ((option as { value: PaymentStatus }).value as PaymentStatus)
                                                    : 'CONFIRMED',
                                            )
                                        }
                                    />
                                </FormItem>
                                </div>
                                <FormItem label={t('accounting.payments.form.paymentMethod')}>
                                    <Select
                                        options={methods}
                                        value={
                                            methods.find((option) => option.value === values.paymentMethodId) ?? null
                                        }
                                        isClearable
                                        onChange={(option) =>
                                            setFieldValue(
                                                'paymentMethodId',
                                                option ? (option as PaymentMethodOption).value : null,
                                            )
                                        }
                                    />
                                </FormItem>
                                <FormItem label={t('accounting.payments.form.methodLabel')}>
                                    <Field type="text" name="method" component={Input} />
                                </FormItem>
                                <FormItem label={t('accounting.payments.form.reference')}>
                                    <Field type="text" name="reference" component={Input} />
                                </FormItem>
                                <FormItem label={t('accounting.payments.form.notes')}>
                                    <Field type="text" name="notes" component={Input} />
                                </FormItem>
                                <div className="flex justify-end gap-2">
                                    <Button type="button" variant="plain" onClick={onClose}>
                                        {t('text.actions.cancel')}
                                    </Button>
                                    <Button type="submit" variant="solid" loading={isSubmitting}>
                                        {dialogMode === 'edit'
                                            ? t('accounting.payments.actions.save')
                                            : t('accounting.payments.actions.create')}
                                    </Button>
                                </div>
                            </FormContainer>
                        </Form>
                    )}
                </Formik>
            ) : (
                <div className="py-10 text-center text-sm text-muted">
                    {t('accounting.payments.feedback.loading')}
                </div>
            )}
        </Dialog>
    )
}

export default PaymentFormModal

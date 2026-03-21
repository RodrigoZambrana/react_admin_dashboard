import { useEffect, useMemo, useState } from 'react'
import Dialog from '@/components/ui/Dialog'
import Button from '@/components/ui/Button'
import { Formik, Form, Field, FieldArray } from 'formik'
import * as Yup from 'yup'
import Input from '@/components/ui/Input'
import DatePicker from '@/components/ui/DatePicker'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Select from '@/components/ui/Select'
import SelectAcceptedCurrencies from '@/components/shared/SelectAcceptedCurrencies'
import { useTranslation } from 'react-i18next'
import { apiCreatePayment } from '@/services/AccountingService'
import { apiGetPaymentMethods } from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { useAppSelector } from '@/store'

type AttachmentDraft = {
    id?: number
    name: string
    type: string | null
    size: number | null
    content?: string | null
}

type PaymentFormValues = {
    orderId: string
    amount: string
    currency: string
    date: Date | null
    type: string
    status: string
    paymentMethodId: string | null
    method: string
    reference: string
    notes: string
    attachments: AttachmentDraft[]
}

type NewPaymentDialogProps = {
    open: boolean
    onClose: () => void
    onCreated: () => void
    orderId?: number
    orderCurrency?: string
}

const validationSchema = (t: (key: string) => string) =>
    Yup.object().shape({
        amount: Yup.number()
            .typeError(t('accounting.payments.validation.amountRequired'))
            .moreThan(0, t('accounting.payments.validation.amountPositive'))
            .required(t('accounting.payments.validation.amountRequired')),
        orderId: Yup.number()
            .typeError(t('accounting.payments.validation.orderIdRequired'))
            .required(t('accounting.payments.validation.orderIdRequired')),
    })

const NewPaymentDialog = ({ open, onClose, onCreated, orderId, orderCurrency }: NewPaymentDialogProps) => {
    const { t } = useTranslation()
    const storeCurrency = useAppSelector((state) => state.currency.code)
    const [methods, setMethods] = useState<Array<{ value: string; label: string }>>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const fetchMethods = async () => {
            try {
                const res = await apiGetPaymentMethods<{ id: number | string; label?: string }[]>()
                const options = (res.data || []).map((item) => ({
                    value: String(item.id),
                    label: item.label || String(item.id),
                }))
                setMethods(options)
            } catch {
                setMethods([])
            }
        }
        fetchMethods()
    }, [])

    const resolvedPaymentMethodId = useMemo(() => {
        if (methods.length > 0) {
            return methods[0]?.value ?? null
        }
        return null
    }, [methods])

    const resolvedPaymentMethodName = useMemo(() => {
        const defaultMethodName = t('accounting.payments.defaultMethod', { defaultValue: 'Transferencia' })
        if (!resolvedPaymentMethodId) {
            return defaultMethodName
        }
        const option = methods.find((method) => method.value === resolvedPaymentMethodId)
        return option?.label ?? defaultMethodName
    }, [methods, resolvedPaymentMethodId, t])

    const initialValues = useMemo<PaymentFormValues>(
        () => ({
            orderId: orderId ? String(orderId) : '',
            amount: '',
            currency: (orderCurrency || storeCurrency || 'UYU').toUpperCase(),
            date: new Date(),
            type: 'BALANCE',
            status: 'CONFIRMED',
            paymentMethodId: resolvedPaymentMethodId,
            method: resolvedPaymentMethodName,
            reference: '',
            notes: '',
            attachments: [],
        }),
        [orderCurrency, orderId, resolvedPaymentMethodId, resolvedPaymentMethodName, storeCurrency],
    )

    const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()

    const onSubmit = async (values: PaymentFormValues) => {
        setLoading(true)
        try {
            const now = new Date()
            const effectiveDate = values.date ? (isSameDay(values.date, now) ? now : values.date) : now
            const payload = {
                orderId: Number(values.orderId),
                amount: Number(values.amount),
                currency: values.currency ? values.currency.toUpperCase() : 'UYU',
                date: effectiveDate.toISOString(),
                type: values.type,
                status: values.status,
                paymentMethodId: values.paymentMethodId ? Number(values.paymentMethodId) : null,
                method: values.method?.trim() || null,
                reference: values.reference?.trim() || null,
                notes: values.notes?.trim() || null,
                attachments: values.attachments.map((attachment) => ({
                    id: attachment.id,
                    name: attachment.name,
                    type: attachment.type,
                    size: attachment.size,
                    content: attachment.content ?? null,
                })),
            }
            await apiCreatePayment<boolean, typeof payload>(payload)
            toast.push(
                <Notification title={t('accounting.payments.feedback.createdTitle')} type="success">
                    {t('accounting.payments.feedback.createdDesc')}
                </Notification>,
            )
            onCreated()
        } catch {
            toast.push(
                <Notification title={t('accounting.payments.feedback.saveFailedTitle')} type="danger">
                    {t('accounting.payments.feedback.saveFailedDesc')}
                </Notification>,
            )
        } finally {
            setLoading(false)
        }
    }

    const handleFilesSelected = async (
        files: FileList | null,
        push: (attachment: AttachmentDraft) => void,
    ) => {
        if (!files || files.length === 0) {
            return
        }
        for (const file of Array.from(files)) {
            const base64 = await toBase64(file)
            push({
                name: file.name,
                type: file.type || null,
                size: file.size,
                content: base64,
            })
        }
    }

    return (
        <Dialog isOpen={open} onClose={onClose} onRequestClose={onClose} width={520}>
            <h4 className="mb-4">
                {t('sales.orders.payments.new', { defaultValue: 'Register payment' })}
            </h4>
            <Formik<PaymentFormValues>
                initialValues={initialValues}
                enableReinitialize
                validationSchema={validationSchema(t)}
                onSubmit={(values) => onSubmit(values)}
            >
                {({ values, errors, touched, setFieldValue }) => (
                    <Form>
                        <FormContainer>
                            <FormItem
                                label={t('accounting.payments.form.orderId')}
                                invalid={Boolean(errors.orderId && touched.orderId)}
                                errorMessage={errors.orderId as string}
                            >
                                <Field name="orderId">
                                    {({ field }) => (
                                        <Input
                                            {...field}
                                            type="number"
                                            readOnly={Boolean(orderId)}
                                            value={field.value}
                                        />
                                    )}
                                </Field>
                            </FormItem>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FormItem
                                    label={t('text.columns.amount')}
                                    invalid={Boolean(errors.amount && touched.amount)}
                                    errorMessage={errors.amount as string}
                                >
                                    <Field
                                        name="amount"
                                        type="number"
                                        component={Input}
                                        value={values.amount}
                                    />
                                </FormItem>
                                <FormItem label={t('text.columns.currency')}>
                                    <SelectAcceptedCurrencies
                                        value={values.currency}
                                        onChange={(val) => setFieldValue('currency', val)}
                                    />
                                </FormItem>
                            </div>
                            <FormItem label={t('text.columns.date')}>
                                <DatePicker.DateTimepicker
                                    value={values.date ?? undefined}
                                    onChange={(val) => setFieldValue('date', val)}
                                    clearable={false}
                                    amPm={false}
                                    inputFormat="DD-MMM-YYYY HH:mm"
                                />
                            </FormItem>
                            <input type="hidden" name="type" value={values.type} />
                            <input type="hidden" name="status" value={values.status} />
                                <FormItem label={t('accounting.payments.form.paymentMethod')}>
                                    <Select
                                        isClearable
                                        value={
                                            values.paymentMethodId
                                                ? methods.find((method) => method.value === values.paymentMethodId) ?? null
                                                : null
                                        }
                                        options={methods}
                                        onChange={(option) =>
                                            (() => {
                                                const nextValue = option ? (option as any).value : null
                                                setFieldValue('paymentMethodId', nextValue)
                                                if (nextValue) {
                                                    const selected = methods.find((method) => method.value === nextValue)
                                                    setFieldValue('method', selected?.label ?? values.method)
                                                } else {
                                                    setFieldValue(
                                                        'method',
                                                        t('accounting.payments.defaultMethod', {
                                                            defaultValue: 'Transferencia',
                                                        }),
                                                    )
                                                }
                                            })()
                                        }
                                    />
                                </FormItem>
                            <input type="hidden" name="method" value={values.method} />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <FormItem label={t('accounting.payments.form.reference')}>
                                    <Field type="text" name="reference" component={Input} value={values.reference} />
                                </FormItem>
                                <FormItem label={t('accounting.payments.form.notes')}>
                                    <Field type="text" name="notes" component={Input} value={values.notes} />
                                </FormItem>
                            </div>
                            <FormItem label={t('sales.orders.payments.attachments', { defaultValue: 'Attachments' })}>
                                <FieldArray name="attachments">
                                    {({ remove, push }) => (
                                        <div className="space-y-3">
                                            <input
                                                type="file"
                                                accept=".pdf,image/*"
                                                multiple
                                                onChange={async (event) => {
                                                    await handleFilesSelected(event.target.files, push)
                                                    event.target.value = ''
                                                }}
                                            />
                                            {values.attachments.length > 0 && (
                                                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                                                    {values.attachments.map((attachment, index) => (
                                                        <li
                                                            key={`${attachment.name}${index}`}
                                                            className="flex items-center justify-between bg-gray-50 dark:bg-gray-800/60 px-3 py-2 rounded-md"
                                                        >
                                                            <span>{attachment.name}</span>
                                                            <button
                                                                type="button"
                                                                className="text-red-500 hover:text-red-600"
                                                                onClick={() => remove(index)}
                                                            >
                                                                {t('text.actions.remove')}
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                        </div>
                                    )}
                                </FieldArray>
                            </FormItem>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="plain" onClick={onClose}>
                                    {t('text.actions.cancel')}
                                </Button>
                                <Button type="submit" variant="solid" loading={loading}>
                                    {t('sales.orders.payments.save', { defaultValue: 'Save payment' })}
                                </Button>
                            </div>
                        </FormContainer>
                    </Form>
                )}
            </Formik>
        </Dialog>
    )
}

export default NewPaymentDialog

async function toBase64(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            resolve(typeof reader.result === 'string' ? reader.result : '')
        }
        reader.onerror = (error) => reject(error)
        reader.readAsDataURL(file)
    })
}

import { FormItem, FormContainer } from '@/components/ui/Form'
import { appPath } from '@/constants/route.constant'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import Button from '@/components/ui/Button'
import { Field, Form, Formik, type FieldProps } from 'formik'
import * as Yup from 'yup'
import { useEffect, useMemo, useState } from 'react'
import {
    apiGetExpenseCategories,
    apiCreateExpense,
    type ExpenseAttachment,
} from '@/services/ExpensesService'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiGetPaymentMethods, apiGetExpenseStatuses } from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { HiOutlineAdjustments } from 'react-icons/hi'
import SelectAcceptedCurrencies from '@/components/shared/SelectAcceptedCurrencies'
import type { CurrencyCode } from '@/store'
import InputGroup from '@/components/ui/InputGroup'
import ExpenseAttachmentsField from '@/views/expenses/components/ExpenseAttachmentsField'
import Switcher from '@/components/ui/Switcher'

type ExpenseForm = {
    date: Date | null
    vendor: string
    categoryId: string | null
    statusId: string | null
    paymentMethodId: string | null
    paymentReference: string
    amount: number | ''
    note?: string
    currency: string
    attachments: ExpenseAttachment[]
    taxCreditEligible: boolean
}

const defaultCategories: Array<{ value: string; label: string }> = []
const defaultStatuses: Array<{ value: string; label: string }> = []
const defaultMethods: Array<{ value: string; label: string }> = []

const ExpenseNew = () => {
    const { t } = useTranslation()
    const [categories, setCategories] = useState(defaultCategories)
    const [statuses, setStatuses] = useState(defaultStatuses)
    const [methods, setMethods] = useState(defaultMethods)
    const validationSchema = useMemo(
        () =>
            Yup.object().shape({
                vendor: Yup.string()
                    .transform((value) => (typeof value === 'string' ? value.trim() : ''))
                    .required(t('expenses.new.validation.vendorRequired') as string),
                amount: Yup.number()
                    .transform((value, originalValue) =>
                        originalValue === '' || originalValue === null
                            ? undefined
                            : value,
                    )
                    .typeError(t('expenses.new.validation.amountNumber') as string)
                    .required(t('expenses.new.validation.amountRequired') as string)
                    .moreThan(0, t('expenses.new.validation.amountPositive') as string),
            }),
        [t],
    )

    useEffect(() => {
        const fetch = async () => {
            const [categoryRes, statusRes, methodRes] = await Promise.all([
                apiGetExpenseCategories<{ id: number; name: string }[]>(),
                apiGetExpenseStatuses<{ id: number; name: string }[]>(),
                apiGetPaymentMethods<{ id: number | string; label?: string }[]>(),
            ])
            const categoryOptions = (categoryRes.data as any[]).map((category) => ({
                value: String(category.id),
                label: category.name,
            }))
            if (categoryOptions.length) {
                setCategories(categoryOptions)
            }
            const statusOptions = (statusRes.data as any[]).map((status) => ({
                value: String(status.id),
                label: status.name,
            }))
            if (statusOptions.length) {
                setStatuses(statusOptions)
            }
            const methodOptions = (methodRes.data || []).map((method) => ({
                value: String(method.id),
                label: method.label || String(method.id),
            }))
            if (methodOptions.length) {
                setMethods(methodOptions)
            }
        }
        fetch()
    }, [])
    const navigate = useNavigate()

    const initialValues: ExpenseForm = {
        date: new Date(),
        vendor: '',
        categoryId: null,
        statusId: null,
        paymentMethodId: null,
        paymentReference: '',
        amount: '',
        note: '',
        currency: 'UYU',
        attachments: [],
        taxCreditEligible: true,
    }

    const onSubmit = async (values: ExpenseForm) => {
        const id = `E-${Date.now().toString().slice(-6)}`
        const vendor = values.vendor.trim()
        const payload = {
            id,
            date: values.date ? Math.floor(values.date.getTime() / 1000) : Math.floor(Date.now() / 1000),
            name: vendor,
            vendor,
            categoryId: values.categoryId ? Number(values.categoryId) : null,
            statusId: values.statusId ? Number(values.statusId) : null,
            paymentMethodId: values.paymentMethodId ? Number(values.paymentMethodId) : null,
            paymentReference: values.paymentReference?.trim() || null,
            amount: Number(values.amount),
            note: values.note?.trim() || null,
            currency: values.currency ? values.currency.toUpperCase() : null,
            attachments: values.attachments || [],
            taxCreditEligible: values.taxCreditEligible,
        }
        const res = await apiCreateExpense<boolean, typeof payload>(payload)
        if (res.data) {
            toast.push(
                <Notification title={t('expenses.new.created.title')} type="success">
                    {t('expenses.new.created.desc')}
                </Notification>,
            )
            navigate(appPath('/accounting/expenses/list'))
        }
    }

    return (
        <div className="card h-full card-shadow bg-white dark:bg-gray-800 p-6">
            <div className="max-w-3xl">
            <h3 className="mb-4">{t('expenses.new.title')}</h3>
            <Formik<ExpenseForm>
                initialValues={initialValues}
                onSubmit={onSubmit}
                validationSchema={validationSchema}
            >
                {({ values, touched, errors, setFieldValue }) => (
                    <Form>
                        <FormContainer>
                            <FormItem
                                label={t('text.columns.amount')}
                                invalid={Boolean(touched.amount && errors.amount)}
                                errorMessage={touched.amount ? (errors.amount as string) : undefined}
                            >
                                <Field name="amount">
                                    {({ field, form }: any) => (
                                        <InputGroup>
                                            <InputGroup.Addon className="px-0">
                                                <SelectAcceptedCurrencies
                                                    embedded
                                                    selectClassName="w-24"
                                                    value={values.currency as CurrencyCode}
                                                    onChange={(code) =>
                                                        setFieldValue('currency', code)
                                                    }
                                                />
                                            </InputGroup.Addon>
                                            <Input {...field} form={form} type="number" step="0.01" min="0" />
                                        </InputGroup>
                                    )}
                                </Field>
                            </FormItem>
                            <FormItem label={t('text.columns.taxCreditEligible')}>
                                <Field name="taxCreditEligible">
                                    {({ field, form }: FieldProps<boolean>) => (
                                        <Switcher
                                            checked={Boolean(field.value)}
                                            onChange={(checked) =>
                                                form.setFieldValue(field.name, checked)
                                            }
                                        />
                                    )}
                                </Field>
                            </FormItem>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormItem
                                    label={t('expenses.new.fields.vendor')}
                                    invalid={Boolean(touched.vendor && errors.vendor)}
                                    errorMessage={touched.vendor ? (errors.vendor as string) : undefined}
                                >
                                    <Field
                                        name="vendor"
                                        as={Input}
                                        placeholder={t('expenses.new.placeholders.vendor')}
                                    />
                                </FormItem>
                                <FormItem label={t('text.columns.paymentMethod')}>
                                    <Select
                                        size="md"
                                        options={methods}
                                        value={methods.find((method) => method.value === values.paymentMethodId) || null}
                                        onChange={(opt) =>
                                            setFieldValue('paymentMethodId', opt ? (opt as any).value : null)
                                        }
                                        isClearable
                                    />
                                </FormItem>
                                <FormItem label={t('text.columns.category')}>
                                    <div className="flex items-center gap-2">
                                        <Select
                                            size="md"
                                            options={categories}
                                            value={
                                                categories.find((category) => category.value === values.categoryId) || null
                                            }
                                            onChange={(opt) =>
                                                setFieldValue('categoryId', opt ? (opt as any).value : null)
                                            }
                                            isClearable
                                        />
                                        <Link to={appPath("/accounting/expenses/categories")}>
                                            <Button size="sm" variant="twoTone" icon={<HiOutlineAdjustments />}>
                                                {t('expenses.categories.actions.manage')}
                                            </Button>
                                        </Link>
                                    </div>
                                </FormItem>
                                <FormItem label={t('text.columns.status')}>
                                    <Select
                                        size="md"
                                        options={statuses}
                                        value={statuses.find((status) => status.value === values.statusId) || null}
                                        onChange={(opt) =>
                                            setFieldValue('statusId', opt ? (opt as any).value : null)
                                        }
                                        isClearable
                                    />
                                </FormItem>
                            </div>
                            <FormItem label={t('text.titles.attachments')}>
                                <ExpenseAttachmentsField
                                    attachments={values.attachments}
                                    onChange={(next) => setFieldValue('attachments', next)}
                                />
                            </FormItem>
                            <FormItem label={t('text.columns.comments')}>
                                <Field name="note" as={Input} textArea rows={3} />
                            </FormItem>
                            <FormItem label={t('text.columns.date')}>
                                <DatePicker
                                    value={values.date ?? undefined}
                                    onChange={(val) => setFieldValue('date', val)}
                                />
                            </FormItem>
                            <div className="flex items-center gap-2">
                                <Button type="submit" variant="solid">
                                    {t('text.actions.save')}
                                </Button>
                                <Button type="button" onClick={() => navigate(-1)}>
                                    {t('text.actions.cancel')}
                                </Button>
                            </div>
                        </FormContainer>
                    </Form>
                )}
            </Formik>
            </div>
        </div>
    )
}

export default ExpenseNew

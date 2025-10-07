import { FormItem, FormContainer } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import Button from '@/components/ui/Button'
import { Field, Form, Formik } from 'formik'
import { useEffect, useState } from 'react'
import {
    apiGetExpenseCategories,
    apiCreateExpense,
    type ExpenseAttachment,
} from '@/services/ExpensesService'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiGetPaymentMethods, apiGetExpenseStatuses } from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { useNavigate } from 'react-router-dom'
import { HiOutlineAdjustments } from 'react-icons/hi'
import CurrencySelector from '@/components/shared/CurrencySelector'
import type { CurrencyCode } from '@/store'
import InputGroup from '@/components/ui/InputGroup'
import ExpenseAttachmentsField from '@/views/expenses/components/ExpenseAttachmentsField'

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
}

const defaultCategories: Array<{ value: string; label: string }> = []
const defaultStatuses: Array<{ value: string; label: string }> = []
const defaultMethods: Array<{ value: string; label: string }> = []

const ExpenseNew = () => {
    const { t } = useTranslation()
    const [categories, setCategories] = useState(defaultCategories)
    const [statuses, setStatuses] = useState(defaultStatuses)
    const [methods, setMethods] = useState(defaultMethods)

    useEffect(() => {
        const fetch = async () => {
            const [categoryRes, statusRes, methodRes] = await Promise.all([
                apiGetExpenseCategories<{ id: number; name: string }[]>(),
                apiGetExpenseStatuses<{ id: number; name: string }[]>(),
                apiGetPaymentMethods<{ id: number; name: string }[]>(),
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
            const methodOptions = (methodRes.data as any[]).map((method) => ({
                value: String(method.id),
                label: method.name,
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
    }

    const onSubmit = async (values: ExpenseForm) => {
        const id = `E-${Date.now().toString().slice(-6)}`
        const payload = {
            id,
            date: values.date ? Math.floor(values.date.getTime() / 1000) : Math.floor(Date.now() / 1000),
            vendor: values.vendor,
            categoryId: values.categoryId ? Number(values.categoryId) : null,
            statusId: values.statusId ? Number(values.statusId) : null,
            paymentMethodId: values.paymentMethodId ? Number(values.paymentMethodId) : null,
        paymentReference: values.paymentReference,
        amount: Number(values.amount) || 0,
        note: values.note,
        currency: values.currency ? values.currency.toUpperCase() : null,
        attachments: values.attachments || [],
    }
        const res = await apiCreateExpense<boolean, typeof payload>(payload)
        if (res.data) {
            toast.push(
                <Notification title={t('expenses.new.created.title')} type="success">
                    {t('expenses.new.created.desc')}
                </Notification>,
            )
            navigate('/app/expenses/expense-list')
        }
    }

    return (
        <div className="card h-full card-shadow bg-white dark:bg-gray-800 p-6">
            <div className="max-w-3xl">
            <h3 className="mb-4">{t('expenses.new.title')}</h3>
            <Formik initialValues={initialValues} onSubmit={onSubmit}>
                {({ values, touched, errors, setFieldValue }) => (
                    <Form>
                        <FormContainer>
                            <FormItem label={t('text.columns.amount')}>
                                <Field name="amount">
                                    {({ field, form }: any) => (
                                        <InputGroup>
                                            <InputGroup.Addon className="px-0">
                                                <CurrencySelector
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormItem label={t('expenses.new.fields.vendor')}>
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
                                        <Link to="/app/expenses/categories">
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

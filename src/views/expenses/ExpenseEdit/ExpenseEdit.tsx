import { FormItem, FormContainer } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import DatePicker from '@/components/ui/DatePicker'
import { Field, Form, Formik } from 'formik'
import { useTranslation } from 'react-i18next'
import { apiGetExpense, apiUpdateExpense, apiGetExpenseCategories } from '@/services/ExpensesService'
import { apiGetPaymentMethods } from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { HiOutlineAdjustments } from 'react-icons/hi'
import CurrencySelector from '@/components/shared/CurrencySelector'
import InputGroup from '@/components/ui/InputGroup'

type ExpenseForm = {
    id: string
    date: Date | null
    vendor: string
    category: string
    paymentMehod: string
    paymentIdendifier: string
    amount: number | ''
    note?: string
}

const defaultCategories = [
    { value: 'SaaS', label: 'SaaS' },
    { value: 'Office', label: 'Office' },
    { value: 'Travel', label: 'Travel' },
    { value: 'Utilities', label: 'Utilities' },
]

const defaultMethods = [
    { value: 'cash', label: 'Efectivo' },
    { value: 'card', label: 'Tarjeta' },
    { value: 'mp', label: 'Mercado Pago' },
]

const ExpenseEdit = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { expenseId } = useParams()
    const [initialValues, setInitialValues] = useState<ExpenseForm | null>(null)
    const [categories, setCategories] = useState(defaultCategories)
    const [methods, setMethods] = useState(defaultMethods)

    useEffect(() => {
        const fetch = async () => {
            const res = await apiGetExpense<any, { id: string }>({ id: expenseId as string })
            const data = res.data
            setInitialValues({
                id: data.id,
                date: new Date(data.date * 1000),
                vendor: data.vendor,
                category: data.category,
                paymentMehod: data.paymentMehod,
                paymentIdendifier: data.paymentIdendifier,
                amount: data.amount,
                note: data.note,
            })
            // fetch categories
            const catRes = await apiGetExpenseCategories<{ id: string; name: string }[]>()
            const opts = (catRes.data as any[]).map((c) => ({ value: c.name, label: c.name }))
            if (opts.length) setCategories(opts)
            // fetch payment methods
            const mRes = await apiGetPaymentMethods<{ id: string; name: string }[]>()
            const mOpts = (mRes.data as any[]).map((m) => ({ value: m.id, label: m.name }))
            if (mOpts.length) setMethods(mOpts)
        }
        fetch()
    }, [expenseId])

    const onSubmit = async (values: ExpenseForm) => {
        const payload = {
            id: values.id,
            date: values.date ? Math.floor(values.date.getTime() / 1000) : Math.floor(Date.now() / 1000),
            vendor: values.vendor,
            category: values.category,
            status: 0,
            paymentMehod: values.paymentMehod,
            paymentIdendifier: values.paymentIdendifier,
            amount: Number(values.amount) || 0,
            note: values.note,
        }
        const res = await apiUpdateExpense<boolean, typeof payload>(payload)
        if (res.data) {
            toast.push(
                <Notification title={t('expenses.edit.updated.title')} type="success">
                    {t('expenses.edit.updated.desc')}
                </Notification>,
            )
            navigate('/app/expenses/expense-list')
        }
    }

    if (!initialValues) {
        return null
    }

    return (
        <div className="card h-full card-shadow bg-white dark:bg-gray-800 p-6">
            <div className="max-w-3xl">
            <h3 className="mb-4">{t('expenses.edit.title')}</h3>
            <Formik initialValues={initialValues} onSubmit={onSubmit} enableReinitialize>
                {({ values, touched, errors, setFieldValue }) => (
                    <Form>
                        <FormContainer>
                            <FormItem label={t('text.columns.date')}>
                                <DatePicker
                                    value={values.date ?? undefined}
                                    onChange={(val) => setFieldValue('date', val)}
                                />
                            </FormItem>
                            <FormItem label={t('expenses.new.fields.vendor')}>
                                <Field name="vendor" as={Input} placeholder={t('expenses.new.placeholders.vendor')} />
                            </FormItem>
                            <FormItem label={t('text.columns.category')}>
                                <div className="flex items-center gap-2">
                                    <Select
                                        size="md"
                                        options={categories}
                                        value={categories.find((c) => c.value === values.category)}
                                        onChange={(opt) => setFieldValue('category', (opt as any).value)}
                                    />
                                    <Link to="/app/expenses/categories">
                                        <Button size="sm" variant="twoTone" icon={<HiOutlineAdjustments />}>
                                            {t('expenses.categories.actions.manage')}
                                        </Button>
                                    </Link>
                                </div>
                            </FormItem>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <FormItem label={t('text.columns.paymentMethod')}>
                                    <Select
                                        size="md"
                                        options={methods}
                                        value={methods.find((m) => m.value === values.paymentMehod)}
                                        onChange={(opt) => setFieldValue('paymentMehod', (opt as any).value)}
                                    />
                                </FormItem>
                                
                            </div>
                            <FormItem label={t('text.columns.amount')}>
                                <Field name="amount">
                                    {({ field, form }: any) => (
                                        <InputGroup>
                                            <InputGroup.Addon className="px-0">
                                                <CurrencySelector embedded selectClassName="w-24" />
                                            </InputGroup.Addon>
                                            <Input {...field} form={form} type="number" step="0.01" min="0" />
                                        </InputGroup>
                                    )}
                                </Field>
                            </FormItem>
                            <FormItem label={t('text.columns.comments')}>
                                <Field name="note" as={Input} textArea rows={3} />
                            </FormItem>
                            <div className="flex items-center gap-2">
                                <Button type="submit" variant="solid">
                                    {t('text.actions.update')}
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

export default ExpenseEdit

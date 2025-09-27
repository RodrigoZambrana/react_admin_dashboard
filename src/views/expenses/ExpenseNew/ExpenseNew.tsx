import { FormItem, FormContainer } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import DatePicker from '@/components/ui/DatePicker'
import Button from '@/components/ui/Button'
import { Field, Form, Formik } from 'formik'
import { useEffect, useState } from 'react'
import { apiGetExpenseCategories } from '@/services/ExpensesService'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { apiCreateExpense } from '@/services/ExpensesService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { useNavigate } from 'react-router-dom'

type ExpenseForm = {
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

const methods = [
    { value: 'visa', label: 'Visa' },
    { value: 'master', label: 'Mastercard' },
    { value: 'paypal', label: 'PayPal' },
]

const ExpenseNew = () => {
    const { t } = useTranslation()
    const [categories, setCategories] = useState(defaultCategories)

    useEffect(() => {
        const fetch = async () => {
            const res = await apiGetExpenseCategories<{ id: string; name: string }[]>()
            const opts = (res.data as any[]).map((c) => ({ value: c.name, label: c.name }))
            if (opts.length) setCategories(opts)
        }
        fetch()
    }, [])
    const navigate = useNavigate()

    const initialValues: ExpenseForm = {
        date: new Date(),
        vendor: '',
        category: 'SaaS',
        paymentMehod: 'visa',
        paymentIdendifier: '',
        amount: '',
        note: '',
    }

    const onSubmit = async (values: ExpenseForm) => {
        const id = `E-${Date.now().toString().slice(-6)}`
        const payload = {
            id,
            date: values.date ? Math.floor(values.date.getTime() / 1000) : Math.floor(Date.now() / 1000),
            vendor: values.vendor,
            category: values.category,
            status: 0,
            paymentMehod: values.paymentMehod,
            paymentIdendifier: values.paymentIdendifier,
            amount: Number(values.amount) || 0,
            note: values.note,
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
                                        <Button size="sm" variant="plain">
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
                                <FormItem label={t('text.columns.reference')}>
                                    <Field name="paymentIdendifier" as={Input} placeholder="•••• 1234 or email" />
                                </FormItem>
                            </div>
                            <FormItem label={t('text.columns.amount')}>
                                <Field name="amount" as={Input} type="number" step="0.01" min="0" />
                            </FormItem>
                            <FormItem label={t('text.columns.comments')}>
                                <Field name="note" as={Input} textArea rows={3} />
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

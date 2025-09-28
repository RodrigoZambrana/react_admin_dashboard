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
import { apiGetPaymentMethods } from '@/services/SettingsService'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { useNavigate } from 'react-router-dom'
import { HiOutlineAdjustments } from 'react-icons/hi'
import CurrencySelector from '@/components/shared/CurrencySelector'
import InputGroup from '@/components/ui/InputGroup'
import Upload from '@/components/ui/Upload'
import DoubleSidedImage from '@/components/shared/DoubleSidedImage'

type ExpenseForm = {
    date: Date | null
    vendor: string
    category: string
    paymentMehod: string
    paymentIdendifier: string
    amount: number | ''
    note?: string
    attachmentUrl?: string
    attachmentName?: string
    attachmentType?: string
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

const ExpenseNew = () => {
    const { t } = useTranslation()
    const [categories, setCategories] = useState(defaultCategories)
    const [methods, setMethods] = useState(defaultMethods)

    useEffect(() => {
        const fetch = async () => {
            const res = await apiGetExpenseCategories<{ id: string; name: string }[]>()
            const opts = (res.data as any[]).map((c) => ({ value: c.name, label: c.name }))
            if (opts.length) setCategories(opts)
            // payment methods from settings
            const mRes = await apiGetPaymentMethods<{ id: string; name: string }[]>()
            const mOpts = (mRes.data as any[]).map((m) => ({ value: m.id, label: m.name }))
            if (mOpts.length) setMethods(mOpts)
        }
        fetch()
    }, [])
    const navigate = useNavigate()

    const initialValues: ExpenseForm = {
        date: new Date(),
        vendor: '',
        category: 'SaaS',
        paymentMehod: 'cash',
        paymentIdendifier: '',
        amount: '',
        note: '',
        attachmentUrl: '',
        attachmentName: '',
        attachmentType: '',
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
            attachment: values.attachmentUrl
                ? {
                      name: values.attachmentName,
                      url: values.attachmentUrl,
                      type: values.attachmentType,
                  }
                : undefined,
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
                                <FormItem label={t('text.titles.attachments')}>
                                    <Field name="attachmentUrl">
                                        {({ field, form }: any) => (
                                            <Upload
                                                uploadLimit={1}
                                                accept={"image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"}
                                                showList={false}
                                                onChange={(files) => {
                                                    if (files && files[0]) {
                                                        const f = files[0]
                                                        form.setFieldValue('attachmentUrl', URL.createObjectURL(f))
                                                        form.setFieldValue('attachmentName', f.name)
                                                        form.setFieldValue('attachmentType', f.type)
                                                    }
                                                }}
                                                onFileRemove={() => {
                                                    form.setFieldValue('attachmentUrl', '')
                                                    form.setFieldValue('attachmentName', '')
                                                    form.setFieldValue('attachmentType', '')
                                                }}
                                            >
                                                {values.attachmentUrl ? (
                                                    <div className="flex items-center gap-3 p-3 border rounded">
                                                        {String(values.attachmentType || '').startsWith('image/') ? (
                                                            <img className="rounded-sm max-h-[64px]" src={values.attachmentUrl} alt={values.attachmentName} />
                                                        ) : (
                                                            <DoubleSidedImage
                                                                className="w-12 h-12"
                                                                src="/img/others/upload.png"
                                                                darkModeSrc="/img/others/upload-dark.png"
                                                            />
                                                        )}
                                                        <span className="font-semibold truncate max-w-[260px]" title={values.attachmentName}>{values.attachmentName}</span>
                                                        <Button size="sm" onClick={() => { form.setFieldValue('attachmentUrl', ''); form.setFieldValue('attachmentName', ''); form.setFieldValue('attachmentType', '') }}>{t('text.actions.remove')}</Button>
                                                    </div>
                                                ) : (
                                                    <div className="my-6 text-center">
                                                        <DoubleSidedImage
                                                            className="mx-auto"
                                                            src="/img/others/upload.png"
                                                            darkModeSrc="/img/others/upload-dark.png"
                                                        />
                                                        <p className="font-semibold">
                                                            <span className="text-gray-800 dark:text-white">Drop your file here, or </span>
                                                            <span className="text-blue-500">browse</span>
                                                        </p>
                                                        <p className="mt-1 opacity-60 dark:text-white">Support: images (jpeg, png) & documents (pdf, doc, xls, csv, txt)</p>
                                                    </div>
                                                )}
                                            </Upload>
                                        )}
                                    </Field>
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

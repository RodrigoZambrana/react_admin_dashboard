import { useEffect, useMemo, useState } from 'react'
import { Formik, Form, Field } from 'formik'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import DatePicker from '@/components/ui/DatePicker'
import Container from '@/components/shared/Container'
import Card from '@/components/ui/Card'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { apiGetCrmCustomers, apiGetCrmCustomerDetails } from '@/services/CrmService'
import { apiGetSalesProducts, apiCreateSalesOrder, apiCreateSalesProduct } from '@/services/SalesService'
import * as Yup from 'yup'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { apiGetPaymentMethods, apiGetCountries, apiGetCities, apiGetSystemConfig } from '@/services/SettingsService'
import Checkbox from '@/components/ui/Checkbox'
import PaymentSummary from '@/views/sales/OrderDetails/components/PaymentSummary'
import EditableOrderProductsTable, { EditableItem } from '@/views/sales/components/EditableOrderProductsTable'
import Steps from '@/components/ui/Steps'
import Avatar from '@/components/ui/Avatar'
import { HiMail, HiPhone } from 'react-icons/hi'
import Drawer from '@/components/ui/Drawer'
import CustomerForm, { FormModel as CustomerFormModel } from '@/views/crm/CustomerForm'
import ProductForm from '@/views/sales/ProductForm'
import CountrySelect from '@/components/shared/CountrySelect'
import CitySelect from '@/components/shared/CitySelect'

type Item = EditableItem

const OrderNew = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const [customers, setCustomers] = useState<{ value: string; label: string }[]>([])
    const [products, setProducts] = useState<{ value: string; label: string; price: number; img?: string; description?: string }[]>([])
    const [methods, setMethods] = useState<{ value: string; label: string }[]>([])
    const [countries, setCountries] = useState<{ value: string; label: string }[]>([])
    const [cities, setCities] = useState<{ value: string; label: string }[]>([])
    const [customerDetail, setCustomerDetail] = useState<any | null>(null)
    const [currentStep, setCurrentStep] = useState(0)
    const [newCustomerOpen, setNewCustomerOpen] = useState(false)
    const [newProductOpen, setNewProductOpen] = useState(false)
    const [taxRate, setTaxRate] = useState(22)

    useEffect(() => {
        const load = async () => {
            // customers
            const cRes = await apiGetCrmCustomers<{ data: { id: string | number; name: string }[] }>({ pageIndex: 1, pageSize: 100, sort: { key: 'name', order: 'asc' }, query: '' } as any)
            const cOpts = ((cRes as any).data?.data || []).map((c: any) => ({ value: String(c.id), label: c.name }))
            setCustomers(cOpts)
            // products
            const pRes = await apiGetSalesProducts<{ data: any[]; total: number }, any>({ pageIndex: 1, pageSize: 100, sort: { key: 'name', order: 'asc' }, query: '' })
            const pOpts = (pRes as any).data?.data?.map((p: any) => ({ value: String(p.id), label: p.name, price: Number(p.price) || 0, img: p.img, description: p.description })) || []
            setProducts(pOpts)
            // payment methods
            const mRes = await apiGetPaymentMethods<{ id: number | string; name: string }[]>()
            const mOpts = (mRes.data as any[]).map((m) => ({ value: String(m.name || m.id), label: m.name }))
            setMethods(mOpts)
            // countries
            const ctryRes = await apiGetCountries<{ code: string; name: string }[]>()
            setCountries((ctryRes.data as any[]).map((c) => ({ value: c.code, label: c.name })))
            try {
                const cfg = await apiGetSystemConfig<{ taxRate?: number }>()
                const rate = Number((cfg.data as any)?.taxRate)
                if (!Number.isNaN(rate)) setTaxRate(rate)
            } catch {
                // ignore, keep default
            }
        }
        load()
    }, [])

    useEffect(() => {
        const sp = new URLSearchParams(location.search)
        const s = sp.get('step')
        if (s) {
            const n = Number(s)
            if (!Number.isNaN(n)) {
                setCurrentStep(Math.max(0, Math.min(6, n)))
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search])

    return (
        <Container className="h-full">
            <h3 className="mb-6">{t('nav.appsSales.orderList')} · {t('text.actions.add')}</h3>
            <Formik
                initialValues={{
                    customerId: '',
                    date: new Date(),
                    paymentMehod: 'Cash',
                    items: [] as Item[],
                    shippingAddress: {
                        street: '',
                        number: '',
                        corner: '',
                        apartment: '',
                        city: '',
                        state: '',
                    },
                    billingAddress: {
                        street: '',
                        number: '',
                        corner: '',
                        apartment: '',
                        city: '',
                        state: '',
                    },
                    billingSameAsShipping: false,
                    shipping: {
                        shippingVendor: 'FedEx',
                        deliveryFees: 0,
                        estimatedMin: 1,
                        estimatedMax: 3,
                    },
                    comment: '',
                }}
                validationSchema={Yup.object().shape({
                    customerId: Yup.string().required(t('sales.orders.validation.customerRequired') as string),
                    paymentMehod: Yup.string().required('Payment method is required'),
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
                    const payload = {
                        customerId: String((values as any).customerId || ''),
                        // Backend expects ISO 8601 date string (IsDateString)
                        date: values.date ? new Date(values.date as any).toISOString() : undefined,
                        paymentMehod: String((values as any).paymentMehod || 'Cash'),
                        items: values.items.map((it) => ({
                            productId: String(it.productId),
                            name: it.name,
                            price: Number(it.price) || 0,
                            qty: Number(it.qty) || 1,
                            img: it.img,
                            description: it.description,
                        })),
                        shippingAddress: values.shippingAddress,
                        billingAddress: (values as any).billingSameAsShipping
                            ? {
                                  addressLine1: `${(values as any).shippingAddress?.street || ''} ${(values as any).shippingAddress?.number || ''}${(values as any).shippingAddress?.apartment ? ' Apt ' + (values as any).shippingAddress?.apartment : ''}`.trim(),
                                  addressLine2: (values as any).shippingAddress?.corner ? `Corner: ${(values as any).shippingAddress?.corner}` : '',
                                  city: (values as any).shippingAddress?.city,
                                  state: (values as any).shippingAddress?.state,
                              }
                            : {
                                  addressLine1: `${(values as any).billingAddress?.street || ''} ${(values as any).billingAddress?.number || ''}${(values as any).billingAddress?.apartment ? ' Apt ' + (values as any).billingAddress?.apartment : ''}`.trim(),
                                  addressLine2: (values as any).billingAddress?.corner ? `Corner: ${(values as any).billingAddress?.corner}` : '',
                                  city: (values as any).billingAddress?.city,
                                  state: (values as any).billingAddress?.state,
                              },
                        billingSameAsShipping: Boolean((values as any).billingSameAsShipping),
                        shipping: {
                            shippingVendor: (values as any).shipping?.shippingVendor,
                            deliveryFees: Number((values as any).shipping?.deliveryFees ?? 0),
                            estimatedMin: Number((values as any).shipping?.estimatedMin ?? 0),
                            estimatedMax: Number((values as any).shipping?.estimatedMax ?? 0),
                        },
                        comment: values.comment,
                    }
                    // Ensure shipping address is filled
                    const saddr = (values as any).shippingAddress || {}
                    if (!saddr.street || !saddr.number || !saddr.state || !saddr.city) {
                        toast.push(
                            <Notification title={t('validation.failed')} type="danger">
                                {t('sales.orders.validation.customerAddressRequired')}
                            </Notification>,
                            { placement: 'top-center' },
                        )
                        setCurrentStep(2)
                        return
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
                {({ values, setFieldValue, errors, touched, submitForm, setFieldTouched }) => {
                    const total = useMemo(() => values.items.reduce((s, it) => s + (it.price || 0) * (it.qty || 0), 0), [values.items])
                    const deliveryFee = Number((values as any).shipping?.deliveryFees || 0)
                    const tax = Math.round(total * (taxRate / (100 + taxRate)) * 100) / 100
                    const grandTotal = Math.round((total + deliveryFee) * 100) / 100
                    const addItem = (pid: string) => {
                        const p = products.find((x) => x.value === pid)
                        if (!p) return
                        const exists = values.items.find((it) => it.productId === pid)
                        if (exists) return
                        setFieldValue('items', [...values.items, { productId: pid, name: p.label, price: p.price, qty: 1, img: p.img, description: p.description }])
                    }
                    const removeItem = (pid: string) => setFieldValue('items', values.items.filter((it) => it.productId !== pid))
                    const changeQty = (pid: string, qty: number) => setFieldValue('items', values.items.map((it) => (it.productId === pid ? { ...it, qty } : it)))
                    // Steps controls
                    const goNext = () => {
                        if (currentStep === 0 && !(values as any).customerId) {
                            setFieldTouched('customerId', true)
                            toast.push(
                                <Notification title={t('validation.failed')} type="danger">
                                    {t('sales.orders.validation.customerRequired')}
                                </Notification>,
                                { placement: 'top-center' },
                            )
                            return
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
                        setCurrentStep((c) => Math.min(c + 1, 6))
                    }
                    const goPrev = () => setCurrentStep((c) => Math.max(c - 1, 0))

                    const onCustomerChange = async (opt: any) => {
                        const id = opt?.value
                        setFieldValue('customerId', id)
                        if (id) {
                            const res = await apiGetCrmCustomerDetails<any, { id: string }>({ id })
                            const detail = (res as any).data || (res as any)
                            setCustomerDetail(detail)
                            // Prefill shipping address with customer's primary address
                            const addr = Array.isArray(detail?.addresses) && detail.addresses.length ? detail.addresses[0] : null
                            if (addr) {
                                setFieldValue('shippingAddress', {
                                    street: addr.street || '',
                                    number: addr.number || '',
                                    corner: addr.corner || '',
                                    apartment: addr.apartment || '',
                                    city: addr.city || '',
                                    state: addr.country || '',
                                    zip: '',
                                })
                            }
                        } else {
                            setCustomerDetail(null)
                        }
                    }

                    return (
                        <Form>
                            <Steps current={currentStep} onChange={setCurrentStep} className="mb-6">
                                <Steps.Item title={t('text.columns.customer')} />
                                <Steps.Item title={t('text.titles.products')} />
                                <Steps.Item title={t('text.titles.shippingAddress')} />
                                <Steps.Item title={t('text.titles.billingAddress')} />
                                <Steps.Item title={t('text.titles.shipping')} />
                                <Steps.Item title={t('text.titles.paymentSummary')} />
                                <Steps.Item title={t('text.actions.finalize') || 'Finalizar'} />
                            </Steps>

                            {currentStep === 0 && (
                                <Card bodyClass="p-5">
                                    <h4 className="mb-4">{t('text.columns.customer')}</h4>
                                    <FormContainer>
                                        <FormItem label={t('text.labels.recipient')} invalid={!!(touched as any).customerId && !!(errors as any).customerId} errorMessage={(errors as any).customerId as any}>
                                            <div className="flex items-center gap-2">
                                                <Select className="w-80" options={customers} value={customers.find((c) => c.value === values.customerId) as any} onChange={onCustomerChange} />
                                                <Button type="button" onClick={() => setNewCustomerOpen(true)}>{t('text.actions.add')} {t('text.columns.customer')}</Button>
                                            </div>
                                        </FormItem>
                                        {values.customerId && (
                                            <div className="flex items-center gap-4 border border-gray-200 dark:border-gray-700 rounded-md p-4">
                                                <Avatar shape="circle" src={customerDetail?.img} />
                                                <div>
                                                    <div className="font-semibold">{customerDetail?.name || (customers.find((c) => c.value === values.customerId)?.label)}</div>
                                                    <div className="opacity-80 text-sm flex items-center gap-3">
                                                        {customerDetail?.email && (
                                                            <span className="flex items-center gap-1"><HiMail /> {customerDetail?.email}</span>
                                                        )}
                                                        {customerDetail?.personalInfo?.phoneNumber && (
                                                            <span className="flex items-center gap-1"><HiPhone /> {customerDetail?.personalInfo?.phoneNumber}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </FormContainer>
                                </Card>
                            )}

                            {currentStep === 1 && (
                                <Card bodyClass="p-5">
                                    <h4 className="mb-4">{t('text.titles.products')}</h4>
                                    <FormContainer>
                                        <FormItem label={t('text.columns.product')} invalid={!!(touched as any).items && !!(errors as any).items} errorMessage={(errors as any).items as any}>
                                            <div className="flex items-center gap-2">
                                                <Select className="w-80" options={products} onChange={(opt) => addItem((opt as any).value)} placeholder={t('text.placeholders.searchProduct')} />
                                                <Button type="button" onClick={() => setNewProductOpen(true)}>{t('text.actions.add')} {t('text.titles.products')}</Button>
                                                <div className="font-semibold ml-auto">{t('text.columns.total')}: ${total.toFixed(2)}</div>
                                            </div>
                                            <div className="mt-4">
                                                <EditableOrderProductsTable items={values.items as any} onQtyChange={changeQty} onRemove={removeItem} showDescription={false} />
                                            </div>
                                        </FormItem>
                                    </FormContainer>
                                </Card>
                            )}

                            {currentStep === 2 && (
                                <Card bodyClass="p-5">
                                    <h4 className="mb-4">{t('text.titles.shippingAddress')}</h4>
                    <FormContainer>
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormItem label={t('text.labels.street') || 'Street'}>
                                                <Field as={Input} name="shippingAddress.street" />
                                            </FormItem>
                                            <FormItem label={t('text.labels.number') || 'Number'}>
                                                <Field as={Input} name="shippingAddress.number" />
                                            </FormItem>
                                            <FormItem label={t('text.labels.corner') || 'Corner'}>
                                                <Field as={Input} name="shippingAddress.corner" />
                                            </FormItem>
                                            <FormItem label={t('text.labels.apartment') || 'Apartment'}>
                                                <Field as={Input} name="shippingAddress.apartment" />
                                            </FormItem>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            <FormItem label={t('text.labels.country')}>
                                                <CountrySelect
                                                    value={{ name: (values as any).shippingAddress?.state, code: (values as any).shippingAddress?.countryCode }}
                                                    onChange={(val) => {
                                                        setFieldValue('shippingAddress.state', val.name)
                                                        setFieldValue('shippingAddress.countryCode', val.code)
                                                        // reset city when country changes
                                                        setFieldValue('shippingAddress.city', '')
                                                    }}
                                                    placeholder={t('text.labels.country')}
                                                />
                                            </FormItem>
                                            <FormItem label={t('text.labels.city')}>
                                                <CitySelect
                                                    countryCode={(values as any).shippingAddress?.countryCode}
                                                    countryName={(values as any).shippingAddress?.state}
                                                    value={(values as any).shippingAddress?.city}
                                                    onChange={(city) => setFieldValue('shippingAddress.city', city)}
                                                    placeholder={t('text.labels.city')}
                                                />
                                            </FormItem>
                                        </div>
                    </FormContainer>
                                </Card>
                            )}

                            {currentStep === 3 && (
                                <Card bodyClass="p-5">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4>{t('text.titles.billingAddress')}</h4>
                                        <Checkbox
                                            checked={(values as any).billingSameAsShipping}
                                            onChange={(checked) => {
                                                setFieldValue('billingSameAsShipping', checked)
                                                if (checked) {
                                                    setFieldValue('billingAddress', (values as any).shippingAddress)
                                                }
                                            }}
                                        >
                                            {t('text.labels.sameAsShipping') || 'Use shipping address'}
                                        </Checkbox>
                                    </div>
                                    <FormContainer>
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormItem label={t('text.labels.street') || 'Street'}>
                                                <Field as={Input} name="billingAddress.street" disabled={(values as any).billingSameAsShipping} />
                                            </FormItem>
                                            <FormItem label={t('text.labels.number') || 'Number'}>
                                                <Field as={Input} name="billingAddress.number" disabled={(values as any).billingSameAsShipping} />
                                            </FormItem>
                                            <FormItem label={t('text.labels.corner') || 'Corner'}>
                                                <Field as={Input} name="billingAddress.corner" disabled={(values as any).billingSameAsShipping} />
                                            </FormItem>
                                            <FormItem label={t('text.labels.apartment') || 'Apartment'}>
                                                <Field as={Input} name="billingAddress.apartment" disabled={(values as any).billingSameAsShipping} />
                                            </FormItem>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            <FormItem label={t('text.labels.country')}>
                                                <CountrySelect
                                                    value={{ name: (values as any).billingAddress?.state, code: (values as any).billingAddress?.countryCode }}
                                                    onChange={(val) => {
                                                        setFieldValue('billingAddress.state', val.name)
                                                        setFieldValue('billingAddress.countryCode', val.code)
                                                        setFieldValue('billingAddress.city', '')
                                                    }}
                                                    placeholder={t('text.labels.country')}
                                                />
                                            </FormItem>
                                            <FormItem label={t('text.labels.city')}>
                                                <CitySelect
                                                    countryCode={(values as any).billingAddress?.countryCode}
                                                    countryName={(values as any).billingAddress?.state}
                                                    value={(values as any).billingAddress?.city}
                                                    onChange={(city) => setFieldValue('billingAddress.city', city)}
                                                    placeholder={t('text.labels.city')}
                                                />
                                            </FormItem>
                                        </div>
                                    </FormContainer>
                                </Card>
                            )}

                            {currentStep === 4 && (
                                <Card bodyClass="p-5">
                                    <h4 className="mb-4">{t('text.titles.shipping')}</h4>
                                    <FormContainer>
                                        <FormItem label={t('text.labels.vendor')}>
                                            <Select
                                                value={{ label: (values as any).shipping?.shippingVendor || 'FedEx', value: (values as any).shipping?.shippingVendor || 'FedEx' } as any}
                                                options={['FedEx', 'DHL', 'UPS', 'USPS'].map((v) => ({ label: v, value: v }))}
                                                onChange={(opt) => setFieldValue('shipping.shippingVendor', (opt as any).value)}
                                            />
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

                            {currentStep === 5 && (
                                <div className="xl:grid grid-cols-2 gap-4">
                                    <PaymentSummary
                                        data={{
                                            subTotal: total,
                                            tax,
                                            deliveryFees: deliveryFee,
                                            total: grandTotal,
                                        }}
                                        taxRate={taxRate}
                                    />
                                    <Card bodyClass="p-5">
                                        <h4 className="mb-4">{t('text.columns.paymentMethod')}</h4>
                                        <FormContainer>
                                            <FormItem label={t('text.columns.paymentMethod')}>
                                                <Select options={methods} value={methods.find((m) => m.value === values.paymentMehod) as any} onChange={(opt) => setFieldValue('paymentMehod', (opt as any).value)} />
                                            </FormItem>
                                        </FormContainer>
                                    </Card>
                                </div>
                            )}

                            {currentStep === 6 && (
                                <Card bodyClass="p-5">
                                    <h4 className="mb-4">{t('text.actions.finalize') || 'Finalizar'}</h4>
                                    <FormContainer>
                                        <FormItem label={t('text.columns.comments')}>
                                            <Field as={Input} name="comment" textArea rows={4} />
                                        </FormItem>
                                        <FormItem label={t('text.labels.date')}>
                                            <DatePicker value={values.date as any} onChange={(val) => setFieldValue('date', val)} />
                                        </FormItem>
                                    </FormContainer>
                                </Card>
                            )}

                            <div className="flex items-center justify-between mt-6">
                                <div>
                                    <Button type="button" onClick={() => navigate(-1)}>{t('text.actions.cancel')}</Button>
                                </div>
                                <div className="flex gap-2">
                                    <Button type="button" disabled={currentStep === 0} onClick={goPrev}>{t('text.actions.back')}</Button>
                                    {currentStep < 6 && (
                                        <Button
                                            type="button"
                                            variant="solid"
                                            disabled={
                                                (currentStep === 0 && !(values as any).customerId) ||
                                                (currentStep === 1 && (values.items || []).length === 0) ||
                                                (currentStep === 2 && (
                                                    !((values as any).shippingAddress?.street) ||
                                                    !((values as any).shippingAddress?.number) ||
                                                    !((values as any).shippingAddress?.state) ||
                                                    !((values as any).shippingAddress?.city)
                                                ))
                                            }
                                            onClick={goNext}
                                        >
                                            {t('text.actions.next')}
                                        </Button>
                                    )}
                                    {currentStep === 6 && (
                                        <Button variant="solid" type="submit">{t('text.actions.save')}</Button>
                                    )}
                                </div>
                            </div>

                            {/* New Customer Drawer */}
                            <Drawer isOpen={newCustomerOpen} onRequestClose={() => setNewCustomerOpen(false)} width={640} title={t('text.actions.add') + ' ' + t('text.columns.customer')}>
                                <CustomerForm
                                    customer={{}}
                                    onFormSubmit={(data: CustomerFormModel) => {
                                        const id = Date.now().toString()
                                        // Update customer options
                                        const option = { value: id, label: data.name }
                                        setCustomers((prev) => [option, ...prev])
                                        // Select and set details
                                        setFieldValue('customerId', id)
                                        setCustomerDetail({
                                            id,
                                            name: data.name,
                                            email: data.email,
                                            img: data.img,
                                            personalInfo: {
                                                location: data.location,
                                                title: data.title,
                                                phoneNumber: data.phoneNumber,
                                                birthday: data.birthday as unknown as string,
                                                facebook: data.facebook,
                                                twitter: data.twitter,
                                                pinterest: data.pinterest,
                                                linkedIn: data.linkedIn,
                                            },
                                        })
                                        // Prefill shipping address
                                        setFieldValue('shippingAddress', {
                                            addressLine1: data.location || '',
                                            addressLine2: '',
                                            city: '',
                                            state: '',
                                            zip: '',
                                        })
                                        setNewCustomerOpen(false)
                                    }}
                                />
                            </Drawer>

                            {/* New Product Drawer */}
                            <Drawer isOpen={newProductOpen} onRequestClose={() => setNewProductOpen(false)} width={840} title={t('text.actions.add') + ' ' + t('text.titles.products')}>
                                <ProductForm
                                    type="new"
                                    initialData={{
                                        id: 0,
                                        name: '',
                                        productCode: '',
                                        img: '',
                                        imgList: [],
                                        categoryId: null,
                                        price: 0,
                                        stock: 0,
                                        status: 0,
                                        costPerItem: 0,
                                        bulkDiscountPrice: 0,
                                        tags: [],
                                        brand: '',
                                        vendor: '',
                                        description: '',
                                    }}
                                    onFormSubmit={async (formData, setSubmitting) => {
                                        try {
                                            const res = await apiCreateSalesProduct<boolean, any>(formData as any)
                                            if ((res as any).data || (res as any) === true) {
                                                // Refresh product list and select new
                                                const pRes = await apiGetSalesProducts<{ data: any[]; total: number }, any>({ pageIndex: 1, pageSize: 100, sort: { key: 'name', order: 'asc' }, query: '' })
                                                const pOpts = (pRes as any).data?.data?.map((p: any) => ({ value: p.id, label: p.name, price: p.price, img: p.img, description: p.description })) || []
                                                setProducts(pOpts)
                                                const created = (pRes as any).data?.data?.find((p: any) => p.name === formData.name)
                                                if (created) {
                                                    addItem(String(created.id))
                                                }
                                                setNewProductOpen(false)
                                            }
                                        } finally {
                                            setSubmitting(false)
                                        }
                                    }}
                                />
                            </Drawer>
                        </Form>
                    )
                }}
            </Formik>
        </Container>
    )
}

export default OrderNew

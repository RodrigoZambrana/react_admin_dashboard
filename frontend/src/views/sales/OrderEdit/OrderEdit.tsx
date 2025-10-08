import { useEffect, useMemo, useState } from 'react'
import { Formik, Form, Field } from 'formik'
import { FormContainer, FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import DatePicker from '@/components/ui/DatePicker'
import Container from '@/components/shared/Container'
import Card from '@/components/ui/Card'
import Drawer from '@/components/ui/Drawer'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { apiGetCrmCustomers, apiGetCrmCustomerDetails } from '@/services/CrmService'
import { apiGetSalesProducts, apiGetSalesOrder, apiSaveSalesOrder, apiCreateSalesProduct } from '@/services/SalesService'
import * as Yup from 'yup'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { apiGetPaymentMethods, apiGetSystemConfig } from '@/services/SettingsService'
import Checkbox from '@/components/ui/Checkbox'
import PaymentSummary from '@/views/sales/OrderDetails/components/PaymentSummary'
import EditableOrderProductsTable, { EditableItem } from '@/views/sales/components/EditableOrderProductsTable'
import Steps from '@/components/ui/Steps'
import Avatar from '@/components/ui/Avatar'
import { HiMail, HiPhone } from 'react-icons/hi'
import AddCustomerDrawer from '@/components/shared/AddCustomerDrawer'
import type { FormModel as CustomerFormModel } from '@/views/crm/CustomerForm'
import ProductForm from '@/views/sales/ProductForm'
import useResponsive from '@/utils/hooks/useResponsive'

type Item = EditableItem

const OrderEdit = () => {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { orderId } = useParams()
    const { smaller } = useResponsive()
    const isCompactViewport = smaller.md
    const [customers, setCustomers] = useState<{ value: string; label: string }[]>([])
    const [products, setProducts] = useState<
        {
            value: string
            label: string
            price: number
            currency?: string
            img?: string
            description?: string
        }[]
    >([])
    const [methods, setMethods] = useState<{ value: string; label: string }[]>([])
    const [initial, setInitial] = useState<any | null>(null)
    const [customerDetail, setCustomerDetail] = useState<any | null>(null)
    const [currentStep, setCurrentStep] = useState(0)
    const [newCustomerOpen, setNewCustomerOpen] = useState(false)
    const [newProductOpen, setNewProductOpen] = useState(false)
    const [taxRate, setTaxRate] = useState(22)

    useEffect(() => {
        const load = async () => {
            const cRes = await apiGetCrmCustomers<{ data: { id: string | number; name: string }[] }, any>({ pageIndex: 1, pageSize: 100, sort: { key: 'name', order: 'asc' }, query: '' } as any)
            setCustomers(((cRes as any).data?.data || []).map((c: any) => ({ value: String(c.id), label: c.name })))
            const pRes = await apiGetSalesProducts<{ data: any[]; total: number }, any>({ pageIndex: 1, pageSize: 100, sort: { key: 'name', order: 'asc' }, query: '' })
            const pArray = ((pRes as any).data?.data || [])
            setProducts(
                pArray.map((p: any) => ({
                    value: String(p.id),
                    label: p.name,
                    price: Number(p.salePrice ?? p.price) || 0,
                    currency: p.currency,
                    img: p.img,
                    description: p.description,
                })),
            )
            const mRes = await apiGetPaymentMethods<{ id: number | string; name: string }[]>()
            setMethods((mRes.data as any[]).map((m) => ({ value: String(m.name || m.id), label: m.name })))
            try {
                const cfg = await apiGetSystemConfig<{ taxRate?: number }>()
                const rate = Number((cfg.data as any)?.taxRate)
                if (!Number.isNaN(rate)) setTaxRate(rate)
            } catch {
                // ignore, keep default
            }
            const oRes = await apiGetSalesOrder<any, { id: string }>({ id: orderId as string })
            const data = (oRes as any).data || (oRes as any)
            setInitial({
                id: data.id,
                customerId: String(data.customerId || ''),
                date: data.date ? new Date(data.date) : new Date(),
                paymentMehod: String(data.paymentMehod || 'Cash'),
                items: (data.items || []).map((it: any) => {
                    const p = pArray.find((x: any) => String(x.id) === String(it.productId))
                    return {
                        productId: String(it.productId),
                        name: it.name,
                        price: Number(it.price) || 0,
                        qty: Number(it.qty) || 1,
                        currency: p?.currency,
                        img: p?.img,
                        description: p?.description,
                    }
                }),
                shippingAddress: data.shippingAddress || { addressLine1: '', addressLine2: '', city: '', state: '' },
                billingAddress: data.billingAddress || { addressLine1: '', addressLine2: '', city: '', state: '' },
                billingSameAsShipping: false,
                shipping: { shippingVendor: data.shippingVendor || 'FedEx', deliveryFees: Number(data.deliveryFees || 0), estimatedMin: Number(data.estimatedMin || 1), estimatedMax: Number(data.estimatedMax || 3) },
                comment: data.comment || '',
            })
            if (data.customerId) {
                const res = await apiGetCrmCustomerDetails<any, { id: string }>({ id: data.customerId })
                const detail = (res as any).data || (res as any)
                setCustomerDetail(detail)
            }
        }
        if (orderId) load()
    }, [orderId])

    if (!initial) return null

    return (
        <Container className="h-full">
            <h3 className="mb-6">{t('nav.appsSales.orderList')} · {t('text.actions.edit')}</h3>
            <Formik initialValues={initial} enableReinitialize 
                validationSchema={Yup.object().shape({
                    customerId: Yup.string().required(t('sales.orders.validation.customerRequired') as string),
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
                    ...values,
                    customer: customers.find((c) => c.value === values.customerId)?.label || '',
                    date: values.date ? Math.floor((values.date as any).getTime() / 1000) : Math.floor(Date.now() / 1000),
                    items: values.items.map((it: Item) => ({ productId: it.productId, name: it.name, price: it.price, qty: it.qty })),
                    billingAddress: (values as any).billingSameAsShipping ? (values as any).shippingAddress : (values as any).billingAddress,
                }
                const res = await apiSaveSalesOrder<boolean, any>(payload)
                if ((res as any).data || (res as any) === true) {
                    toast.push(
                        <Notification title={t('sales.orders.updated.title')} type="success">
                            {t('sales.orders.updated.desc')}
                        </Notification>,
                        { placement: 'top-center' },
                    )
                    navigate('/app/sales/order-list')
                }
            }}>
                {({ values, setFieldValue, errors, touched }) => {
                    const total = useMemo(() => values.items.reduce((s: number, it: Item) => s + (it.price || 0) * (it.qty || 0), 0), [values.items])
                    const deliveryFee = Number((values as any).shipping?.deliveryFees || 0)
                    const tax = Math.round(total * (taxRate / (100 + taxRate)) * 100) / 100
                    const grandTotal = Math.round((total + deliveryFee) * 100) / 100
                    const addItem = (
                        pid: string,
                        option?: {
                            value: string
                            label: string
                            price: number
                            currency?: string
                            img?: string
                            description?: string
                        },
                    ) => {
                        const p = option ?? products.find((x) => x.value === pid)
                        if (!p) return
                        const exists = values.items.find((it: Item) => it.productId === pid)
                        if (exists) return
                        setFieldValue('items', [
                            ...values.items,
                            {
                                productId: pid,
                                name: p.label,
                                price: p.price,
                                currency: p.currency,
                                qty: 1,
                                img: p.img,
                                description: p.description,
                            },
                        ])
                    }
                    const removeItem = (pid: string) => setFieldValue('items', values.items.filter((it: Item) => it.productId !== pid))
                    const changeQty = (pid: string, qty: number) => setFieldValue('items', values.items.map((it: Item) => (it.productId === pid ? { ...it, qty } : it)))
                    const onCustomerChange = async (opt: any) => {
                        const id = opt?.value
                        setFieldValue('customerId', id)
                        if (id) {
                            const res = await apiGetCrmCustomerDetails<any, { id: string }>({ id })
                            const detail = (res as any).data || (res as any)
                            setCustomerDetail(detail)
                            setFieldValue('shippingAddress', {
                                addressLine1: detail?.personalInfo?.location || '',
                                addressLine2: '',
                                city: '',
                                state: '',
                            })
                        } else {
                            setCustomerDetail(null)
                        }
                    }
                    const goNext = () => setCurrentStep((c) => Math.min(c + 1, 6))
                    const goPrev = () => setCurrentStep((c) => Math.max(c - 1, 0))
                    const handleCustomerCreated = (
                        created: Record<string, unknown>,
                        formValues: CustomerFormModel,
                    ) => {
                        const customerIdValue = String((created as any)?.id ?? '')
                        if (!customerIdValue) {
                            return
                        }

                        const fullName = [
                            formValues.firstName,
                            formValues.lastName,
                        ]
                            .filter(Boolean)
                            .join(' ')

                        const option = {
                            value: customerIdValue,
                            label:
                                (created as any)?.name ||
                                fullName ||
                                formValues.email ||
                                customerIdValue,
                        }

                        setCustomers((prev) => {
                            const existingIndex = prev.findIndex(
                                (item) => item.value === option.value,
                            )
                            if (existingIndex === -1) {
                                return [option, ...prev]
                            }
                            const next = [...prev]
                            next[existingIndex] = option
                            return next
                        })

                        setFieldValue('customerId', option.value)
                        setCustomerDetail(created)

                        const address = formValues.address
                        if (address) {
                            const addressLine1 = [
                                address.street,
                                address.number,
                            ]
                                .filter(Boolean)
                                .join(' ')
                                .trim()
                            const addressLine2 = [
                                address.corner,
                                address.apartment,
                            ]
                                .filter(Boolean)
                                .join(', ')
                                .trim()
                            const normalizedAddress = {
                                addressLine1,
                                addressLine2,
                                city: address.city || '',
                                state: address.state || '',
                            }
                            const hasAddress = Object.values(normalizedAddress).some(
                                (value) => String(value || '').trim() !== '',
                            )
                            if (hasAddress) {
                                setFieldValue('shippingAddress', normalizedAddress)
                                if ((values as any).billingSameAsShipping) {
                                    setFieldValue('billingAddress', normalizedAddress)
                                }
                            }
                        }
                    }

                    return (
                        <>
                        <Form>
                            <Steps
                                current={currentStep}
                                onChange={setCurrentStep}
                                className="mb-6"
                                vertical={isCompactViewport}
                            >
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
                                                        {customerDetail?.personalInfo?.phoneNumbers?.length ? (
                                                            <span className="flex items-center gap-1">
                                                                <HiPhone /> {customerDetail?.personalInfo?.phoneNumbers?.[0]}
                                                            </span>
                                                        ) : null}
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
                                                <Select
                                                    className="w-80"
                                                    options={products}
                                                    onChange={(opt) => addItem((opt as any).value, opt as any)}
                                                    placeholder={t('text.placeholders.searchProduct')}
                                                />
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
                                        <FormItem label={t('text.labels.addressLine1')}>
                                            <Field as={Input} name="shippingAddress.addressLine1" />
                                        </FormItem>
                                        <FormItem label={t('text.labels.addressLine2')}>
                                            <Field as={Input} name="shippingAddress.addressLine2" />
                                        </FormItem>
                                        <div className="grid grid-cols-3 gap-3">
                                            <FormItem label={t('text.labels.city')}>
                                                <Field as={Input} name="shippingAddress.city" />
                                            </FormItem>
                                            <FormItem label={t('text.labels.state')}>
                                                <Field as={Input} name="shippingAddress.state" />
                                            </FormItem>
                                            {/* Zip removed */}
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
                                        <FormItem label={t('text.labels.addressLine1')}>
                                            <Field as={Input} name="billingAddress.addressLine1" disabled={(values as any).billingSameAsShipping} />
                                        </FormItem>
                                        <FormItem label={t('text.labels.addressLine2')}>
                                            <Field as={Input} name="billingAddress.addressLine2" disabled={(values as any).billingSameAsShipping} />
                                        </FormItem>
                                        <div className="grid grid-cols-3 gap-3">
                                            <FormItem label={t('text.labels.city')}>
                                                <Field as={Input} name="billingAddress.city" disabled={(values as any).billingSameAsShipping} />
                                            </FormItem>
                                            <FormItem label={t('text.labels.state')}>
                                                <Field as={Input} name="billingAddress.state" disabled={(values as any).billingSameAsShipping} />
                                            </FormItem>
                                            {/* Zip removed */}
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
                                        <Button type="button" variant="solid" onClick={goNext}>{t('text.actions.next')}</Button>
                                    )}
                                    {currentStep === 6 && (
                                        <Button variant="solid" type="submit">{t('text.actions.update')}</Button>
                                    )}
                                </div>
                            </div>
                        </Form>
                        {/* New Customer Drawer */}
                        <AddCustomerDrawer
                            isOpen={newCustomerOpen}
                            onClose={() => setNewCustomerOpen(false)}
                            onSuccess={handleCustomerCreated}
                        />
                        {/* New Product Drawer */}
                        <Drawer
                            isOpen={newProductOpen}
                            onClose={() => setNewProductOpen(false)}
                            onRequestClose={() => setNewProductOpen(false)}
                            width={640}
                            bodyClass="p-0"
                            title={t('text.actions.add') + ' ' + t('text.titles.products')}
                        >
                            <div className="p-6">
                                <ProductForm
                                    type="new"
                                    initialData={{
                                        id: 0,
                                        name: '',
                                        productCode: '',
                                        img: '',
                                        imgList: [],
                                        categoryId: null,
                                        costPrice: 0,
                                        salePrice: 0,
                                        stock: 0,
                                        status: 0,
                                        bulkDiscountPrice: 0,
                                        tags: [],
                                        brand: '',
                                        vendor: '',
                                        description: '',
                                        currency: 'UYU',
                                    }}
                                    onDiscard={() => setNewProductOpen(false)}
                                    onFormSubmit={async (formData, setSubmitting) => {
                                        try {
                                            const res = await apiCreateSalesProduct<boolean, any>(formData as any)
                                            if ((res as any).data || (res as any) === true) {
                                                const pRes = await apiGetSalesProducts<{ data: any[]; total: number }, any>({
                                                    pageIndex: 1,
                                                    pageSize: 100,
                                                    sort: { key: 'name', order: 'asc' },
                                                    query: '',
                                                })
                                                const formattedOptions =
                                                    ((pRes as any).data?.data || []).map((p: any) => ({
                                                        value: String(p.id),
                                                        label: p.name,
                                                        price: Number(p.salePrice ?? p.price) || 0,
                                                        currency: p.currency,
                                                        img: p.img,
                                                        description: p.description,
                                                    })) || []
                                                setProducts(formattedOptions)
                                                const created = (pRes as any).data?.data?.find(
                                                    (p: any) => p.name === formData.name,
                                                )
                                                if (created) {
                                                    const option =
                                                        formattedOptions.find((opt) => opt.value === String(created.id)) ?? {
                                                            value: String(created.id),
                                                            label: created.name,
                                                            price: Number(created.salePrice ?? created.price) || 0,
                                                            currency: created.currency,
                                                            img: created.img,
                                                            description: created.description,
                                                        }
                                                    addItem(String(created.id), option)
                                                }
                                                setNewProductOpen(false)
                                            }
                                        } finally {
                                            setSubmitting(false)
                                        }
                                    }}
                                />
                            </div>
                        </Drawer>
                        </>
                    )
                }}
            </Formik>
        </Container>
    )
}

export default OrderEdit

import { useState, useRef, forwardRef, useMemo } from 'react'
import { HiOutlineFilter, HiOutlineSearch } from 'react-icons/hi'
import {
    getProducts,
    setFilterData,
    useAppDispatch,
    useAppSelector,
    setTableData,
} from '../store'
import { FormItem, FormContainer } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import Radio from '@/components/ui/Radio'
import Drawer from '@/components/ui/Drawer'
import { Field, Form, Formik, FormikProps, FieldProps } from 'formik'
import { useTranslation } from 'react-i18next'
import { STANDARD_FALLBACK_CURRENCIES } from '@/utils/currency'
import type { MouseEvent } from 'react'

type FormModel = {
    name: string
    category: string[]
    status: number[]
    productStatus: number
    currency: string[]
}

type FilterFormProps = {
    onSubmitComplete?: () => void
}

type DrawerFooterProps = {
    onSaveClick: (event: MouseEvent<HTMLButtonElement>) => void
    onCancel: (event: MouseEvent<HTMLButtonElement>) => void
}

const FilterForm = forwardRef<FormikProps<FormModel>, FilterFormProps>(
    ({ onSubmitComplete }, ref) => {
        const dispatch = useAppDispatch()
        const { t } = useTranslation()

        const filterData = useAppSelector(
            (state) => state.salesProductList.data.filterData,
        )
        const tableData = useAppSelector(
            (state) => state.salesProductList.data.tableData,
        )
        const availableCurrencies = useAppSelector(
            (state) => state.currency.available,
        )

        const currencyOptions = useMemo(() => {
            const base = Array.isArray(availableCurrencies) && availableCurrencies.length
                ? availableCurrencies
                : Array.from(new Set(['UYU', 'USD', ...STANDARD_FALLBACK_CURRENCIES]))
            return base
                .map((item) => String(item || '').trim().toUpperCase())
                .filter(
                    (item, index, arr) =>
                        item && /^[A-Z]{3,5}$/.test(item) && arr.indexOf(item) === index,
                )
        }, [availableCurrencies])

        const sanitizeCurrencySelection = (list: unknown): string[] =>
            Array.isArray(list)
                ? Array.from(
                      new Set(
                          list
                              .map((item) => String(item || '').trim().toUpperCase())
                              .filter((item) => /^[A-Z]{3,5}$/.test(item)),
                      ),
                  )
                : []

        const formInitialValues: FormModel = {
            name: filterData?.name ?? '',
            category: Array.isArray(filterData?.category)
                ? filterData.category
                : ['bags', 'cloths', 'devices', 'shoes', 'watches'],
            status: Array.isArray(filterData?.status)
                ? filterData.status
                : [0, 1, 2],
            productStatus:
                typeof filterData?.productStatus === 'number'
                    ? filterData.productStatus
                    : 0,
            currency: sanitizeCurrencySelection(filterData?.currency),
        }

        const handleSubmit = (values: FormModel) => {
            onSubmitComplete?.()
            const nextFilterData: FormModel = {
                ...values,
                currency: sanitizeCurrencySelection(values.currency),
            }
            dispatch(setFilterData(nextFilterData))
            const nextTableData = {
                ...tableData,
                pageIndex: 1,
            }
            dispatch(setTableData(nextTableData))
            dispatch(
                getProducts({
                    ...nextTableData,
                    filterData: nextFilterData,
                }),
            )
        }

        return (
            <Formik
                enableReinitialize
                innerRef={ref}
                initialValues={formInitialValues}
                onSubmit={(values) => {
                    handleSubmit(values)
                }}
            >
                {({ values, touched, errors }) => (
                    <Form>
                        <FormContainer>
                            <FormItem
                                invalid={errors.name && touched.name}
                                errorMessage={errors.name}
                            >
                                <h6 className="mb-4">{t('sales.productList.filter.includedText')}</h6>
                                <Field
                                    type="text"
                                    autoComplete="off"
                                    name="name"
                                    placeholder={t('sales.productList.filter.keyword')}
                                    component={Input}
                                    prefix={
                                        <HiOutlineSearch className="text-lg" />
                                    }
                                />
                            </FormItem>
                            <FormItem
                                invalid={errors.category && touched.category}
                                errorMessage={errors.category as string}
                            >
                                <h6 className="mb-4">{t('sales.productList.filter.productCategory')}</h6>
                                <Field name="category">
                                    {({ field, form }: FieldProps) => (
                                        <>
                                            <Checkbox.Group
                                                vertical
                                                value={values.category}
                                                onChange={(options) =>
                                                    form.setFieldValue(
                                                        field.name,
                                                        options,
                                                    )
                                                }
                                            >
                                                <Checkbox
                                                    className="mb-3"
                                                    name={field.name}
                                                    value="bags"
                                                >
                                                    {t('sales.productForm.categories.bags')}
                                                </Checkbox>
                                                <Checkbox
                                                    className="mb-3"
                                                    name={field.name}
                                                    value="cloths"
                                                >
                                                    {t('sales.productForm.categories.cloths')}
                                                </Checkbox>
                                                <Checkbox
                                                    className="mb-3"
                                                    name={field.name}
                                                    value="devices"
                                                >
                                                    {t('sales.productForm.categories.devices')}
                                                </Checkbox>
                                                <Checkbox
                                                    className="mb-3"
                                                    name={field.name}
                                                    value="shoes"
                                                >
                                                    {t('sales.productForm.categories.shoes')}
                                                </Checkbox>
                                                <Checkbox
                                                    name={field.name}
                                                    value="watches"
                                                >
                                                    {t('sales.productForm.categories.watches')}
                                                </Checkbox>
                                            </Checkbox.Group>
                                        </>
                                    )}
                                </Field>
                            </FormItem>
                            <FormItem
                                invalid={errors.currency && touched.currency}
                                errorMessage={errors.currency as string}
                            >
                                <h6 className="mb-4">{t('sales.productList.filter.currency')}</h6>
                                <Field name="currency">
                                    {({ field, form }: FieldProps) => {
                                        const selectedCurrencies = Array.isArray(values.currency)
                                            ? values.currency
                                            : []
                                        return (
                                            <Checkbox.Group
                                                vertical
                                                value={selectedCurrencies}
                                                onChange={(options) =>
                                                    form.setFieldValue(field.name, options)
                                                }
                                            >
                                                {currencyOptions.map((code) => (
                                                    <Checkbox
                                                        key={code}
                                                        className="mb-3"
                                                        name={field.name}
                                                        value={code}
                                                    >
                                                        {code}
                                                    </Checkbox>
                                                ))}
                                            </Checkbox.Group>
                                        )
                                    }}
                                </Field>
                            </FormItem>
                            <FormItem
                                invalid={errors.status && touched.status}
                                errorMessage={errors.status as string}
                            >
                                <h6 className="mb-4">{t('sales.productList.filter.productStatus')}</h6>
                                <Field name="status">
                                    {({ field, form }: FieldProps) => (
                                        <>
                                            <Checkbox.Group
                                                vertical
                                                value={values.status}
                                                onChange={(options) =>
                                                    form.setFieldValue(
                                                        field.name,
                                                        options,
                                                    )
                                                }
                                            >
                                                <Checkbox
                                                    className="mb-3"
                                                    name={field.name}
                                                    value={0}
                                                >
                                                    {t('text.status.inStock')}
                                                </Checkbox>
                                                <Checkbox
                                                    className="mb-3"
                                                    name={field.name}
                                                    value={1}
                                                >
                                                    {t('text.status.limited')}
                                                </Checkbox>
                                                <Checkbox
                                                    className="mb-3"
                                                    name={field.name}
                                                    value={2}
                                                >
                                                    {t('text.status.outOfStock')}
                                                </Checkbox>
                                            </Checkbox.Group>
                                        </>
                                    )}
                                </Field>
                            </FormItem>
                            <FormItem
                                invalid={
                                    errors.productStatus &&
                                    touched.productStatus
                                }
                                errorMessage={errors.productStatus}
                            >
                                <h6 className="mb-4">{t('sales.productList.filter.publicationStatus')}</h6>
                                <Field name="productStatus">
                                    {({ field, form }: FieldProps) => (
                                        <Radio.Group
                                            vertical
                                            value={values.productStatus}
                                            onChange={(val) =>
                                                form.setFieldValue(
                                                    field.name,
                                                    val,
                                                )
                                            }
                                        >
                                            <Radio value={0}>{t('text.status.published')}</Radio>
                                            <Radio value={1}>{t('text.status.disabled')}</Radio>
                                            <Radio value={2}>{t('text.status.archive')}</Radio>
                                        </Radio.Group>
                                    )}
                                </Field>
                            </FormItem>
                        </FormContainer>
                    </Form>
                )}
            </Formik>
        )
    },
)

const DrawerFooter = ({ onSaveClick, onCancel }: DrawerFooterProps) => {
    const { t } = useTranslation()
    return (
        <div className="text-right w-full">
            <Button size="sm" className="mr-2" onClick={onCancel}>
                {t('text.actions.cancel')}
            </Button>
            <Button size="sm" variant="solid" onClick={onSaveClick}>
                {t('text.actions.query')}
            </Button>
        </div>
    )
}

const ProductFilter = () => {
    const { t } = useTranslation()
    const formikRef = useRef<FormikProps<FormModel>>(null)

    const [isOpen, setIsOpen] = useState(false)

    const openDrawer = () => {
        setIsOpen(true)
    }

    const onDrawerClose = () => {
        setIsOpen(false)
    }

    const formSubmit = () => {
        formikRef.current?.submitForm()
    }

    return (
        <>
            <Button
                size="sm"
                className="block md:inline-block md:ltr:ml-2 md:rtl:mr-2 md:mb-0 mb-4"
                icon={<HiOutlineFilter />}
                onClick={() => openDrawer()}
            >
                {t('text.actions.filter')}
            </Button>
            <Drawer
                title={t('text.actions.filter')}
                isOpen={isOpen}
                footer={
                    <DrawerFooter
                        onCancel={onDrawerClose}
                        onSaveClick={formSubmit}
                    />
                }
                onClose={onDrawerClose}
                onRequestClose={onDrawerClose}
            >
                <FilterForm ref={formikRef} onSubmitComplete={onDrawerClose} />
            </Drawer>
        </>
    )
}

FilterForm.displayName = 'FilterForm'

export default ProductFilter

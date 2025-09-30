import { useState, useRef, forwardRef } from 'react'
import { HiOutlineFilter, HiOutlineSearch } from 'react-icons/hi'
import {
    getProducts,
    setFilterData,
    initialTableData,
    useAppDispatch,
    useAppSelector,
} from '../store'
import { FormItem, FormContainer } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import Radio from '@/components/ui/Radio'
import Drawer from '@/components/ui/Drawer'
import { Field, Form, Formik, FormikProps, FieldProps } from 'formik'
import { useTranslation } from 'react-i18next'
import type { MouseEvent } from 'react'

type FormModel = {
    name: string
    category: string[]
    status: number[]
    productStatus: number
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

        const handleSubmit = (values: FormModel) => {
            onSubmitComplete?.()
            dispatch(setFilterData(values))
            dispatch(getProducts(initialTableData))
        }

        return (
            <Formik
                enableReinitialize
                innerRef={ref}
                initialValues={filterData}
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

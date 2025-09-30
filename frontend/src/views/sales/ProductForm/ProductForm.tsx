import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormContainer } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import StickyFooter from '@/components/shared/StickyFooter'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { Form, Formik, FormikProps } from 'formik'
import BasicInformationFields from './BasicInformationFields'
import PricingFields from './PricingFields'
import OrganizationFields from './OrganizationFields'
import ProductImages from './ProductImages'
import PublicationFields from './PublicationFields'
import cloneDeep from 'lodash/cloneDeep'
import { HiOutlineTrash } from 'react-icons/hi'
import { AiOutlineSave } from 'react-icons/ai'
import * as Yup from 'yup'
import CurrencySelector from '@/components/shared/CurrencySelector'

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
type FormikRef = FormikProps<any>

type InitialData = {
    id: number
    name?: string
    productCode?: string
    img?: string
    imgList?: {
        id: string
        name: string
        img: string
    }[]
    categoryId?: number | null
    price?: number
    stock?: number
    status?: number
    costPerItem?: number
    bulkDiscountPrice?: number
    tags?: string[]
    brand?: string
    vendor?: string
    description?: string
    published?: boolean
}

export type FormModel = Omit<InitialData, 'tags'> & {
    tags: { label: string; value: string }[] | string[]
}

export type SetSubmitting = (isSubmitting: boolean) => void

export type OnDeleteCallback = React.Dispatch<React.SetStateAction<boolean>>

type OnDelete = (callback: OnDeleteCallback) => void

type ProductForm = {
    initialData?: InitialData
    type: 'edit' | 'new'
    onDiscard?: () => void
    onDelete?: OnDelete
    onFormSubmit: (formData: FormModel, setSubmitting: SetSubmitting) => void
}

const validationSchema = (t: (k: string) => string) =>
    Yup.object().shape({
        name: Yup.string().required(t('text.validation.productNameRequired')),
        price: Yup.number().typeError(t('text.validation.priceRequired')).required(t('text.validation.priceRequired')),
        stock: Yup.number()
            .typeError(t('text.validation.stockNumber') || 'Stock must be a number')
            .required(t('text.validation.stockRequired') || 'Stock is required')
            .min(0, t('text.validation.stockMin') || 'Stock cannot be negative'),
        categoryId: Yup.number()
            .nullable()
            .typeError(t('text.validation.categoryRequired'))
            .required(t('text.validation.categoryRequired')),
    })

const DeleteProductButton = ({ onDelete }: { onDelete: OnDelete }) => {
    const { t } = useTranslation()
    const [dialogOpen, setDialogOpen] = useState(false)

    const onConfirmDialogOpen = () => {
        setDialogOpen(true)
    }

    const onConfirmDialogClose = () => {
        setDialogOpen(false)
    }

    const handleConfirm = () => {
        onDelete?.(setDialogOpen)
    }

    return (
        <>
            <Button
                className="text-red-600"
                variant="plain"
                size="sm"
                icon={<HiOutlineTrash />}
                type="button"
                onClick={onConfirmDialogOpen}
            >
                {t('text.actions.delete')}
            </Button>
            <ConfirmDialog
                isOpen={dialogOpen}
                type="danger"
                title={t('text.titles.deleteProduct')}
                confirmButtonColor="red-600"
                onClose={onConfirmDialogClose}
                onRequestClose={onConfirmDialogClose}
                onCancel={onConfirmDialogClose}
                onConfirm={handleConfirm}
            >
                <p>{t('text.messages.deleteProductConfirm')}</p>
            </ConfirmDialog>
        </>
    )
}

const ProductForm = forwardRef<FormikRef, ProductForm>((props, ref) => {
    const {
        type,
            initialData = {
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
        },
        onFormSubmit,
        onDiscard,
        onDelete,
    } = props

    const { t } = useTranslation()
    return (
        <>
            <Formik
                innerRef={ref}
                initialValues={{
                    ...initialData,
                    id: Number(initialData.id ?? 0),
                    categoryId:
                        initialData.categoryId !== undefined && initialData.categoryId !== null
                            ? Number(initialData.categoryId)
                            : null,
                    published:
                        typeof initialData.published === 'boolean'
                            ? initialData.published
                            : true,
                    tags: initialData?.tags
                        ? initialData.tags.map((value) => ({
                              label: value,
                              value,
                          }))
                        : [],
                }}
                validationSchema={validationSchema(t)}
                onSubmit={(values: FormModel, { setSubmitting }) => {
                    const formData = cloneDeep(values)
                    formData.tags = formData.tags.map((tag) => {
                        if (typeof tag !== 'string') {
                            return tag.value
                        }
                        return tag
                    })
                    // Normalize numeric fields to numbers
                    ;(['price', 'stock', 'status', 'costPerItem', 'bulkDiscountPrice', 'categoryId'] as const).forEach((k) => {
                        const v: any = (formData as any)[k]
                        if (v !== undefined && v !== null && v !== '') {
                            ;(formData as any)[k] = Number(v)
                        }
                    })
                    formData.id = Number(formData.id ?? 0)
                    if (type === 'new') {
                        formData.id = 0
                        if (formData.imgList && formData.imgList.length > 0) {
                            formData.img = formData.imgList[0].img
                        }
                    }
                    onFormSubmit?.(formData, setSubmitting)
                }}
            >
                {({ values, touched, errors, isSubmitting }) => (
                    <Form>
                        <FormContainer>
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="lg:col-span-2">
                                    <BasicInformationFields
                                        touched={touched}
                                        errors={errors}
                                    />
                                    <PricingFields
                                        touched={touched}
                                        errors={errors}
                                    />
                                    <PublicationFields
                                        touched={touched as any}
                                        errors={errors as any}
                                        values={values as any}
                                    />
                                    <OrganizationFields
                                        touched={touched}
                                        errors={errors}
                                        values={values}
                                    />
                                </div>
                                <div className="lg:col-span-1">
                                    <ProductImages values={values} />
                                </div>
                            </div>
                            <StickyFooter
                                className="-mx-8 px-8 flex items-center justify-between py-4"
                                stickyClass="border-t bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                            >
                                <div>
                                    {type === 'edit' && (
                                        <DeleteProductButton
                                            onDelete={onDelete as OnDelete}
                                        />
                                    )}
                                </div>
                                <div className="md:flex items-center">
                                    <Button
                                        size="sm"
                                        className="ltr:mr-3 rtl:ml-3"
                                        type="button"
                                        onClick={() => onDiscard?.()}
                                    >
                                        {t('text.actions.discard')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="solid"
                                        loading={isSubmitting}
                                        icon={<AiOutlineSave />}
                                        type="submit"
                                    >
                                        {t('text.actions.save')}
                                    </Button>
                                </div>
                            </StickyFooter>
                        </FormContainer>
                    </Form>
                )}
            </Formik>
        </>
    )
})

ProductForm.displayName = 'ProductForm'

export default ProductForm

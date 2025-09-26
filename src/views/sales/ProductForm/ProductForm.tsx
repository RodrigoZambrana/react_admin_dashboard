import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormContainer } from '@/components/ui/Form'
import Button from '@/components/ui/Button'
import hooks from '@/components/ui/hooks'
import StickyFooter from '@/components/shared/StickyFooter'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { Form, Formik, FormikProps } from 'formik'
import BasicInformationFields from './BasicInformationFields'
import PricingFields from './PricingFields'
import OrganizationFields from './OrganizationFields'
import ProductImages from './ProductImages'
import cloneDeep from 'lodash/cloneDeep'
import { HiOutlineTrash } from 'react-icons/hi'
import { AiOutlineSave } from 'react-icons/ai'
import * as Yup from 'yup'

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
type FormikRef = FormikProps<any>

type InitialData = {
    id?: string
    name?: string
    productCode?: string
    img?: string
    imgList?: {
        id: string
        name: string
        img: string
    }[]
    category?: string
    price?: number
    stock?: number
    status?: number
    costPerItem?: number
    bulkDiscountPrice?: number
    taxRate?: number
    tags?: string[]
    brand?: string
    vendor?: string
    description?: string
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

const { useUniqueId } = hooks

const validationSchema = (t: (k: string) => string) =>
    Yup.object().shape({
        name: Yup.string().required(t('text.validation.productNameRequired')),
        price: Yup.number().required(t('text.validation.priceRequired')),
        stock: Yup.number().required(t('text.validation.skuRequired')),
        category: Yup.string().required(t('text.validation.categoryRequired')),
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
            id: '',
            name: '',
            productCode: '',
            img: '',
            imgList: [],
            category: '',
            price: 0,
            stock: 0,
            status: 0,
            costPerItem: 0,
            bulkDiscountPrice: 0,
            taxRate: 6,
            tags: [],
            brand: '',
            vendor: '',
            description: '',
        },
        onFormSubmit,
        onDiscard,
        onDelete,
    } = props

    const newId = useUniqueId('product-')

    const { t } = useTranslation()
    return (
        <>
            <Formik
                innerRef={ref}
                initialValues={{
                    ...initialData,
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
                    if (type === 'new') {
                        formData.id = newId
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

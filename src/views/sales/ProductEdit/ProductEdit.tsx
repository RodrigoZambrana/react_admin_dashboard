import { useEffect } from 'react'
import Loading from '@/components/shared/Loading'
import DoubleSidedImage from '@/components/shared/DoubleSidedImage'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import reducer, {
    getProduct,
    updateProduct,
    deleteProduct,
    useAppSelector,
    useAppDispatch,
} from './store'
import { injectReducer } from '@/store'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'

import ProductForm, {
    FormModel,
    SetSubmitting,
    OnDeleteCallback,
} from '@/views/sales/ProductForm'
import isEmpty from 'lodash/isEmpty'

injectReducer('salesProductEdit', reducer)

const ProductEdit = () => {
    const dispatch = useAppDispatch()

    const location = useLocation()
    const navigate = useNavigate()

    const productData = useAppSelector(
        (state) => state.salesProductEdit.data.productData,
    )
    const loading = useAppSelector(
        (state) => state.salesProductEdit.data.loading,
    )

    const fetchData = (data: { id: string }) => {
        dispatch(getProduct(data))
    }

    const handleFormSubmit = async (
        values: FormModel,
        setSubmitting: SetSubmitting,
    ) => {
        setSubmitting(true)
        const success = await updateProduct(values)
        setSubmitting(false)
        if (success) {
            popNotification('updated')
        }
    }

    const handleDiscard = () => {
        navigate('/app/sales/product-list')
    }

    const handleDelete = async (setDialogOpen: OnDeleteCallback) => {
        setDialogOpen(false)
        const success = await deleteProduct({ id: productData.id })
        if (success) {
            popNotification('deleted')
        }
    }

    const { t } = useTranslation()

    const popNotification = (keyword: 'updated' | 'deleted') => {
        const titleKey = `sales.productEdit.toast.${keyword}.title`
        const descKey = `sales.productEdit.toast.${keyword}.desc`
        toast.push(
            <Notification
                title={t(titleKey)}
                type="success"
                duration={2500}
            >
                {t(descKey)}
            </Notification>,
            {
                placement: 'top-center',
            },
        )
        navigate('/app/sales/product-list')
    }

    useEffect(() => {
        const path = location.pathname.substring(
            location.pathname.lastIndexOf('/') + 1,
        )
        const rquestParam = { id: path }
        fetchData(rquestParam)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname])

    return (
        <>
            <Loading loading={loading}>
                {!isEmpty(productData) && (
                    <>
                        <ProductForm
                            type="edit"
                            initialData={productData}
                            onFormSubmit={handleFormSubmit}
                            onDiscard={handleDiscard}
                            onDelete={handleDelete}
                        />
                    </>
                )}
            </Loading>
            {!loading && isEmpty(productData) && (
                <div className="h-full flex flex-col items-center justify-center">
                    <DoubleSidedImage
                        src="/img/others/img-2.png"
                        darkModeSrc="/img/others/img-2-dark.png"
                        alt={t('common.notFound.product')}
                    />
                    <h3 className="mt-8">{t('common.notFound.product')}</h3>
                </div>
            )}
        </>
    )
}

export default ProductEdit

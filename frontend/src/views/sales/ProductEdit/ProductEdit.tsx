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
import type { ProductMode } from '@/views/sales/ProductForm/types'
import { apiSaveParametricManualConfig } from '@/services/SalesService'
import { hasManualConfigValues, mapDraftToManualPayload } from '@/views/sales/ProductForm/parametricTypes'
import isEmpty from 'lodash/isEmpty'
import {
    DEFAULT_SALES_UNIT,
    type SalesUnit,
} from '@/constants/product.constant'

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
        try {
            const success = await updateProduct(values)
            if (success) {
                if (
                    values.mode === 'parametric' &&
                    values.parametricDraft?.manualConfig &&
                    hasManualConfigValues(values.parametricDraft.manualConfig) &&
                    values.id
                ) {
                    try {
                        const manualPayload = mapDraftToManualPayload(
                            values.parametricDraft.manualConfig,
                            (values.currency as string) || 'USD',
                        )
                        await apiSaveParametricManualConfig(Number(values.id), manualPayload)
                        toast.push(
                            <Notification
                                title={t('sales.productForm.parametric.manualSaveSuccess', {
                                    defaultValue: 'Manual costs saved',
                                })}
                                type="success"
                                duration={3200}
                            >
                                {t('sales.productForm.parametric.manualSaveSuccessDescription', {
                                    defaultValue: 'The manual matrix row was updated successfully.',
                                })}
                            </Notification>,
                            { placement: 'top-center' },
                        )
                    } catch (error) {
                        console.error('parametric/manual-config', error)
                        toast.push(
                            <Notification
                                title={t('sales.productForm.parametric.manualSaveError', {
                                    defaultValue: 'Manual pricing could not be saved',
                                })}
                                type="warning"
                                duration={4000}
                            >
                                {t('sales.productForm.parametric.manualSaveErrorDescription', {
                                    defaultValue: 'Try saving the product again to push the manual costs.',
                                })}
                            </Notification>,
                            { placement: 'top-center' },
                        )
                    }
                }
                popNotification('updated')
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
        } finally {
            setSubmitting(false)
        }
    }

    const handleDiscard = () => {
        navigate('/app/products/list')
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
        navigate('/app/products/list')
    }

    useEffect(() => {
        const path = location.pathname.substring(
            location.pathname.lastIndexOf('/') + 1,
        )
        const rquestParam = { id: path }
        fetchData(rquestParam)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname])

    // Build safe initial values mapped from backend data
    const mappedInitialData = !isEmpty(productData)
        ? {
              id: Number((productData as any).id ?? 0),
              name: productData.name ?? '',
              productCode: productData.productCode ?? '',
              img: productData.img ?? '',
              imgList: Array.isArray((productData as any).images)
                  ? (productData as any).images.map((im: any) => ({
                        id: String(im.id ?? ''),
                        name: im.name ?? '',
                        img: im.img ?? '',
                    }))
                  : [],
              categoryId:
                  (productData as any).category?.id ?? (productData as any).categoryId ?? null,
              costPrice: Number(
                  (productData as any).costPrice ??
                      (productData as any).costPerItem ??
                      0,
              ),
              salePrice: Number(
                  (productData as any).salePrice ??
                      (productData as any).price ??
                      0,
              ),
              stock: Number(productData.stock ?? 0),
              status: Number(productData.status ?? 0),
              bulkDiscountPrice: Number(productData.bulkDiscountPrice ?? 0),
              description: productData.description ?? '',
              specifications: (productData as any).specifications ?? '',
              tags: (productData as any).tags ?? [],
              brand: productData.brand ?? '',
              vendor: productData.vendor ?? '',
              published:
                  typeof (productData as any).published === 'boolean'
                      ? (productData as any).published
                      : false,
              permanentStock: Boolean((productData as any).permanentStock),
              currency: ((productData as any).currency || 'UYU') as string,
              unitOfMeasure: (
                  (productData as any).unitOfMeasure ?? DEFAULT_SALES_UNIT
              ) as SalesUnit,
              mode: ((productData as any).mode ?? 'simple') as ProductMode,
              parametricDraft: (productData as any).parametricDraft ?? null,
          }
        : undefined

    return (
        <>
            <Loading loading={loading}>
                {!isEmpty(productData) && (
                    <>
                        <ProductForm
                            type="edit"
                            initialData={mappedInitialData as any}
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

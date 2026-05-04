import { useCallback, useEffect, useMemo, useState } from 'react'
import reducer, {
    getProducts,
    useAppDispatch,
    useAppSelector,
    setFilterData,
    setTableData,
} from './store'
import { injectReducer } from '@/store'
import AdaptableCard from '@/components/shared/AdaptableCard'
import { useTranslation } from 'react-i18next'
import ProductTable from './components/ProductTable'
import ProductTableTools from './components/ProductTableTools'
import Drawer from '@/components/ui/Drawer'
import ProductForm, {
    type FormModel,
    type SetSubmitting,
} from '@/views/sales/ProductForm'
import { apiCreateSalesProduct, apiImportParametricReferences, apiSaveParametricManualConfig } from '@/services/SalesService'
import { apiGetAberturasConfig } from '@/services/SettingsService'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { useLocation } from 'react-router-dom'
import type { ProductMode } from '@/views/sales/ProductForm/types'
import type { ParametricImportSummary } from '@/views/sales/ProductForm/ParametricConfigurator'
import { clientConfig } from '@/configs/clientConfig'
import { hasManualConfigValues, mapDraftToManualPayload } from '@/views/sales/ProductForm/parametricTypes'

injectReducer('salesProductList', reducer)

type CreateProductResponse = {
    ok: boolean
    productId: number
}

const ProductList = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const [newProductOpen, setNewProductOpen] = useState(false)
    const location = useLocation()
    const isUrucortinas = clientConfig.slug === 'urucortinas'
    const isParametricView = useMemo(() => {
        if (!isUrucortinas) {
            return false
        }
        return (
            location.pathname.includes('/products/parametric') ||
            location.pathname.includes('/aberturas/list')
        )
    }, [isUrucortinas, location.pathname])

    const isStandardProductListView = useMemo(
        () =>
            location.pathname.includes('/products/list') &&
            !location.pathname.includes('/products/parametric'),
        [location.pathname],
    )

    const [aberturasMarginPercent, setAberturasMarginPercent] = useState<number | undefined>(undefined)

    const tableData = useAppSelector(
        (state) => state.salesProductList.data.tableData,
    )
    const filterData = useAppSelector(
        (state) => state.salesProductList.data.filterData,
    )

    const refreshProducts = useCallback(() => {
        if (!tableData) {
            return
        }
        dispatch(
            getProducts({
                pageIndex: tableData.pageIndex,
                pageSize: tableData.pageSize,
                sort: tableData.sort,
                query: tableData.query,
                filterData,
            }),
        )
    }, [dispatch, filterData, tableData])

    const handleAddProductClick = useCallback(() => {
        setNewProductOpen(true)
    }, [])

    const handleCloseDrawer = useCallback(() => {
        setNewProductOpen(false)
    }, [])

    const normalizeModeValue = useCallback(
        (value: ProductMode | ProductMode[] | 'all' | undefined) => {
            if (value === undefined || value === 'all') {
                return 'all'
            }
            if (Array.isArray(value)) {
                return value
                    .map((item) => item?.toString().toLowerCase())
                    .filter((item): item is string => Boolean(item))
                    .sort()
                    .join('|') || 'all'
            }
            return value.toLowerCase()
        },
        [],
    )

    useEffect(() => {
        const targetMode: ProductMode | ProductMode[] | 'all' | undefined =
            isParametricView
                ? 'parametric'
                : isStandardProductListView
                  ? ['simple', 'variable']
                  : undefined

        const currentKey = normalizeModeValue(filterData?.mode)
        const targetKey = normalizeModeValue(targetMode)

        if (currentKey !== targetKey) {
            const nextFilter = {
                ...filterData,
                mode: targetMode,
            }
            dispatch(setFilterData(nextFilter))
            if ((tableData?.pageIndex ?? 1) !== 1) {
                dispatch(
                    setTableData({
                        ...tableData,
                        pageIndex: 1,
                    }),
                )
            }
        }
    }, [
        dispatch,
        filterData,
        isParametricView,
        isStandardProductListView,
        tableData,
        normalizeModeValue,
    ])

    const loadAberturasPricingConfig = useCallback(async () => {
        try {
            const response = await apiGetAberturasConfig<{ pricing?: { markupPercent?: number } }>()
            const payload = (response?.data ?? response ?? null) as { pricing?: { markupPercent?: number } } | null
            const margin = Number(payload?.pricing?.markupPercent)
            setAberturasMarginPercent(Number.isFinite(margin) ? margin : 0)
        } catch (error) {
            console.error('aberturas/config', error)
            setAberturasMarginPercent(0)
        }
    }, [])

    useEffect(() => {
        if (!isParametricView) {
            setAberturasMarginPercent(undefined)
            return
        }
        if (aberturasMarginPercent === undefined) {
            loadAberturasPricingConfig()
        }
    }, [aberturasMarginPercent, isParametricView, loadAberturasPricingConfig])

    const handleCreateProduct = useCallback(
        async (formData: FormModel, setSubmitting: SetSubmitting) => {
            setSubmitting(true)
            try {
                const { parametricDraft, ...productPayload } = formData
                const payload = { ...productPayload, id: undefined }
                const response = await apiCreateSalesProduct<CreateProductResponse | boolean, typeof payload>(payload)
                const result = response.data
                const productId =
                    typeof result === 'object' && result !== null && 'productId' in result
                        ? Number((result as CreateProductResponse).productId)
                        : undefined
                const creationOk =
                    typeof result === 'object' && result !== null && 'ok' in result
                        ? Boolean((result as CreateProductResponse).ok)
                        : Boolean(result)
                if (!creationOk) {
                    throw new Error('create_failed')
                }
                if (
                    formData.mode === 'parametric' &&
                    parametricDraft?.matrixFile &&
                    productId
                ) {
                    try {
                        const formDataUpload = new FormData()
                        if (parametricDraft.matrixFile instanceof File) {
                            formDataUpload.append('file', parametricDraft.matrixFile, parametricDraft.matrixFile.name)
                        } else {
                            formDataUpload.append('file', parametricDraft.matrixFile, 'parametric-matrix.csv')
                        }
                        const importResponse =
                            await apiImportParametricReferences<ParametricImportSummary>(productId, formDataUpload)
                        const summary = importResponse as unknown as ParametricImportSummary
                        toast.push(
                            <Notification
                                title={t('sales.productForm.parametric.importSuccess', {
                                    defaultValue: 'Matrix imported successfully',
                                })}
                                type="success"
                                duration={3200}
                            >
                                {t('sales.productForm.parametric.importSummary', {
                                    defaultValue: 'Processed {{inserted}} new · {{updated}} updated.',
                                    inserted: summary.rowsInserted,
                                    updated: summary.rowsUpdated,
                                })}
                            </Notification>,
                            { placement: 'top-center' },
                        )
                    } catch (error) {
                        console.error('parametric/import', error)
                        toast.push(
                            <Notification
                                title={t('sales.productForm.parametric.importError', {
                                    defaultValue: 'Import failed',
                                })}
                                type="warning"
                                duration={4000}
                            >
                                {t('sales.productForm.parametric.importQueuedFallback', {
                                    defaultValue:
                                        'El producto se creó, pero la matriz no pudo importarse automáticamente.',
                                })}
                            </Notification>,
                            { placement: 'top-center' },
                        )
                    }
                } else if (formData.mode === 'parametric' && parametricDraft?.matrixFile && !productId) {
                    toast.push(
                        <Notification
                            title={t('sales.productForm.parametric.importQueued', {
                                defaultValue: 'Matriz pendiente',
                            })}
                            type="warning"
                            duration={3500}
                        >
                            {t('sales.productForm.parametric.importUnavailable', {
                                defaultValue:
                                    'No se pudo identificar el producto recién creado para importar la matriz automáticamente.',
                            })}
                        </Notification>,
                        { placement: 'top-center' },
                    )
                }
                if (
                    formData.mode === 'parametric' &&
                    productId &&
                    parametricDraft?.manualConfig &&
                    hasManualConfigValues(parametricDraft.manualConfig)
                ) {
                    try {
                        const manualPayload = mapDraftToManualPayload(
                            parametricDraft.manualConfig,
                            (formData.currency as string) || 'USD',
                        )
                        await apiSaveParametricManualConfig(productId, manualPayload)
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
                toast.push(
                    <Notification
                        title={t('sales.productList.created.title', {
                            defaultValue: 'Product created',
                        })}
                        type="success"
                        duration={2500}
                    >
                        {t('sales.productList.created.desc', {
                            defaultValue: 'The product was added successfully.',
                        })}
                    </Notification>,
                    { placement: 'top-center' },
                )
               setNewProductOpen(false)
               refreshProducts()
            } catch (error) {
                // eslint-disable-next-line no-console
                console.error('products/create', error)
                const responseMessage =
                    (error as any)?.response?.data?.message ??
                    (error as any)?.message ??
                    ''
                const translatedMessage =
                    typeof responseMessage === 'string' && responseMessage
                        ? t(responseMessage, {
                              defaultValue: responseMessage,
                          })
                        : t('sales.productList.createError', {
                              defaultValue: 'Unable to create the product.',
                          })
                toast.push(
                    <Notification
                        title={t('validation.failed')}
                        type="danger"
                        duration={3200}
                    >
                        {translatedMessage}
                    </Notification>,
                    { placement: 'top-center' },
                )
            } finally {
                setSubmitting(false)
            }
        },
        [refreshProducts, t],
    )

    const card = (
        <AdaptableCard className="h-full" bodyClass="h-full">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0">{t('nav.appsProducts.products')}</h3>
                <ProductTableTools onAddProduct={handleAddProductClick} isParametricView={isParametricView} />
            </div>
            <ProductTable marginPercent={aberturasMarginPercent} />
        </AdaptableCard>
    )

    return (
        <>
            {card}
            <Drawer
                isOpen={newProductOpen}
                onClose={handleCloseDrawer}
                onRequestClose={handleCloseDrawer}
                width={640}
                bodyClass="p-0"
                title={
                    isParametricView
                        ? t('sales.productForm.parametric.addTitle', {
                              defaultValue: 'Agregar producto paramétrico',
                          })
                        : t('text.actions.addProduct', {
                              defaultValue: 'Add Product',
                          })
                }
            >
                <div className="p-6">
                    <ProductForm
                        type="new"
                        onDiscard={handleCloseDrawer}
                        onFormSubmit={handleCreateProduct}
                        allowedModes={isParametricView ? ['parametric'] : ['simple', 'variable']}
                    />
                </div>
            </Drawer>
        </>
    )
}

export default ProductList

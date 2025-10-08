import { useCallback, useState } from 'react'
import reducer, {
    getProducts,
    useAppDispatch,
    useAppSelector,
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
import { apiCreateSalesProduct } from '@/services/SalesService'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'

injectReducer('salesProductList', reducer)

const ProductList = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const [newProductOpen, setNewProductOpen] = useState(false)

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

    const handleCreateProduct = useCallback(
        async (formData: FormModel, setSubmitting: SetSubmitting) => {
            setSubmitting(true)
            try {
                const payload = { ...formData, id: undefined }
                await apiCreateSalesProduct<boolean, typeof payload>(payload)
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

    return (
        <>
            <AdaptableCard className="h-full" bodyClass="h-full">
                <div className="lg:flex items-center justify-between mb-4">
                    <h3 className="mb-4 lg:mb-0">{t('text.titles.products')}</h3>
                    <ProductTableTools onAddProduct={handleAddProductClick} />
                </div>
                <ProductTable />
            </AdaptableCard>
            <Drawer
                isOpen={newProductOpen}
                onClose={handleCloseDrawer}
                onRequestClose={handleCloseDrawer}
                width={640}
                bodyClass="p-0"
                title={t('text.actions.addProduct', {
                    defaultValue: 'Add Product',
                })}
            >
                <div className="p-6">
                    <ProductForm
                        type="new"
                        onDiscard={handleCloseDrawer}
                        onFormSubmit={handleCreateProduct}
                    />
                </div>
            </Drawer>
        </>
    )
}

export default ProductList

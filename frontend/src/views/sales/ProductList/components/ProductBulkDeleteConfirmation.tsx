import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { useTranslation } from 'react-i18next'
import {
    deleteProduct,
    getProducts,
    setSelectedProducts,
    toggleBulkDeleteConfirmation,
    useAppDispatch,
    useAppSelector,
} from '../store'

const ProductBulkDeleteConfirmation = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const dialogOpen = useAppSelector(
        (state) => state.salesProductList.data.bulkDeleteConfirmation,
    )
    const selectedProductIds = useAppSelector(
        (state) => state.salesProductList.data.selectedProductIds,
    )
    const tableData = useAppSelector(
        (state) => state.salesProductList.data.tableData,
    )
    const filterData = useAppSelector(
        (state) => state.salesProductList.data.filterData,
    )

    const onDialogClose = () => {
        dispatch(toggleBulkDeleteConfirmation(false))
    }

    const onDelete = async () => {
        dispatch(toggleBulkDeleteConfirmation(false))
        if (!selectedProductIds.length) {
            return
        }
        const success = await deleteProduct({ id: selectedProductIds })
        if (success) {
            dispatch(setSelectedProducts([]))
            dispatch(getProducts({ ...tableData, filterData }))
            toast.push(
                <Notification
                    title={t('sales.productList.deleted.title')}
                    type="success"
                    duration={2800}
                >
                    {t('sales.productList.bulkDeleted.desc', {
                        defaultValue: 'Deleted {{count}} products.',
                        count: selectedProductIds.length,
                    })}
                </Notification>,
                { placement: 'top-center' },
            )
        }
    }

    return (
        <ConfirmDialog
            isOpen={dialogOpen}
            type="danger"
            title={t('text.titles.deleteProduct')}
            confirmButtonColor="red-600"
            onClose={onDialogClose}
            onRequestClose={onDialogClose}
            onCancel={onDialogClose}
            onConfirm={onDelete}
        >
            <p>
                {t('sales.productList.bulkDeleted.confirm', {
                    defaultValue:
                        'Delete the {{count}} selected products? This action cannot be undone.',
                    count: selectedProductIds.length,
                })}
            </p>
        </ConfirmDialog>
    )
}

export default ProductBulkDeleteConfirmation

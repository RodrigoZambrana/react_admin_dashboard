import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { useTranslation } from 'react-i18next'
import {
    toggleDeleteConfirmation,
    deleteProduct,
    getProducts,
    useAppDispatch,
    useAppSelector,
} from '../store'

const ProductDeleteConfirmation = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const dialogOpen = useAppSelector(
        (state) => state.salesProductList.data.deleteConfirmation,
    )
    const selectedProduct = useAppSelector(
        (state) => state.salesProductList.data.selectedProduct,
    )
    const tableData = useAppSelector(
        (state) => state.salesProductList.data.tableData,
    )
    const filterData = useAppSelector(
        (state) => state.salesProductList.data.filterData,
    )

    const onDialogClose = () => {
        dispatch(toggleDeleteConfirmation(false))
    }

    const onDelete = async () => {
        dispatch(toggleDeleteConfirmation(false))
        const success = await deleteProduct({ id: selectedProduct })

        if (success) {
            dispatch(getProducts({ ...tableData, filterData }))
            toast.push(
                <Notification
                    title={t('sales.productList.deleted.title')}
                    type="success"
                    duration={2500}
                >
                    {t('sales.productList.deleted.desc')}
                </Notification>,
                {
                    placement: 'top-center',
                },
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
            <p>{t('text.messages.deleteProductConfirm')}</p>
        </ConfirmDialog>
    )
}

export default ProductDeleteConfirmation

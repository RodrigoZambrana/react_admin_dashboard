import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import {
    setDeleteMode,
    setSelectedRow,
    setSelectedRows,
    deleteOrders,
    getOrders,
    useAppDispatch,
    useAppSelector,
} from '../store'
import { useTranslation } from 'react-i18next'

const OrderDeleteConfirmation = () => {
    const dispatch = useAppDispatch()
    const selectedRows = useAppSelector(
        (state) => state.salesOrderList.data.selectedRows,
    )
    const selectedRow = useAppSelector(
        (state) => state.salesOrderList.data.selectedRow,
    )
    const deleteMode = useAppSelector(
        (state) => state.salesOrderList.data.deleteMode,
    )
    const tableData = useAppSelector(
        (state) => state.salesOrderList.data.tableData,
    )

    const { t } = useTranslation()

    const onDialogClose = () => {
        dispatch(setDeleteMode(''))

        if (deleteMode === 'single') {
            dispatch(setSelectedRow([]))
        }
    }

    const onDelete = async () => {
        dispatch(setDeleteMode(''))

        if (deleteMode === 'single') {
            const success = await deleteOrders({ id: selectedRow })
            deleteSucceed(success)
            dispatch(setSelectedRow([]))
        }

        if (deleteMode === 'batch') {
            const success = await deleteOrders({ id: selectedRows })
            deleteSucceed(success, selectedRows.length)
            dispatch(setSelectedRows([]))
        }
    }

    const deleteSucceed = (success: boolean, orders = 0) => {
        if (success) {
            dispatch(getOrders(tableData))
            toast.push(
                <Notification
                    title={t('sales.orders.delete.titleSuccess')}
                    type="success"
                    duration={2500}
                >
                    {deleteMode === 'single' && t('sales.orders.delete.single')}
                    {deleteMode === 'batch' && t('sales.orders.delete.batch', { count: orders })}
                </Notification>,
                {
                    placement: 'top-center',
                },
            )
        }
    }

    return (
        <ConfirmDialog
            isOpen={deleteMode === 'single' || deleteMode === 'batch'}
            type="danger"
            title={t('sales.orders.delete.title')}
            confirmButtonColor="red-600"
            onClose={onDialogClose}
            onRequestClose={onDialogClose}
            onCancel={onDialogClose}
            onConfirm={onDelete}
        >
            <p>{t('sales.orders.delete.confirm')}</p>
        </ConfirmDialog>
    )
}

export default OrderDeleteConfirmation

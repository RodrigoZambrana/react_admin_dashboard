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
    useSalesOrderListData,
} from '../store'
import { useSalesDocumentI18n } from '../../context/useSalesDocumentI18n'

const OrderDeleteConfirmation = () => {
    const dispatch = useAppDispatch()
    const salesOrderState = useSalesOrderListData()
    const { selectedRows, selectedRow, deleteMode, tableData } = salesOrderState

    const { t, tDoc, resource } = useSalesDocumentI18n()

    const onDialogClose = () => {
        dispatch(setDeleteMode(''))

        if (deleteMode === 'single') {
            dispatch(setSelectedRow([]))
        }
    }

    const onDelete = async () => {
        dispatch(setDeleteMode(''))

        if (deleteMode === 'single') {
            const success = await deleteOrders({ id: selectedRow }, resource)
            deleteSucceed(success)
            dispatch(setSelectedRow([]))
        }

        if (deleteMode === 'batch') {
            const success = await deleteOrders({ id: selectedRows }, resource)
            deleteSucceed(success, selectedRows.length)
            dispatch(setSelectedRows([]))
        }
    }

    const deleteSucceed = (success: boolean, orders = 0) => {
        if (success) {
            if (tableData) {
                dispatch(getOrders({ ...tableData, resource }))
            }
            toast.push(
                <Notification
                    title={tDoc('delete.titleSuccess')}
                    type="success"
                    duration={2500}
                >
                    {deleteMode === 'single' && tDoc('delete.single')}
                    {deleteMode === 'batch' &&
                        tDoc('delete.batch', { count: orders })}
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
            title={tDoc('delete.title')}
            confirmButtonColor="red-600"
            onClose={onDialogClose}
            onRequestClose={onDialogClose}
            onCancel={onDialogClose}
            onConfirm={onDelete}
        >
            <p>{tDoc('delete.confirm')}</p>
        </ConfirmDialog>
    )
}

export default OrderDeleteConfirmation

import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import {
    setDeleteMode,
    setSelectedRow,
    setSelectedRows,
    deleteExpenses,
    getExpensesList,
    useAppDispatch,
    useAppSelector,
} from '../store'
import { useTranslation } from 'react-i18next'

const ExpenseDeleteConfirmation = () => {
    const dispatch = useAppDispatch()
    const selectedRows = useAppSelector(
        (state) => state.expensesList.data.selectedRows,
    )
    const selectedRow = useAppSelector(
        (state) => state.expensesList.data.selectedRow,
    )
    const deleteMode = useAppSelector(
        (state) => state.expensesList.data.deleteMode,
    )
    const tableData = useAppSelector(
        (state) => state.expensesList.data.tableData,
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
            const success = await deleteExpenses({ id: selectedRow })
            deleteSucceed(success)
            dispatch(setSelectedRow([]))
        }

        if (deleteMode === 'batch') {
            const success = await deleteExpenses({ id: selectedRows })
            deleteSucceed(success, selectedRows.length)
            dispatch(setSelectedRows([]))
        }
    }

    const deleteSucceed = (success: boolean, count = 0) => {
        if (success) {
            dispatch(getExpensesList(tableData))
            toast.push(
                <Notification
                    title={t('expenses.list.delete.titleSuccess')}
                    type="success"
                    duration={2500}
                >
                    {deleteMode === 'single' && t('expenses.list.delete.single')}
                    {deleteMode === 'batch' &&
                        t('expenses.list.delete.batch', { count })}
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
            title={t('expenses.list.delete.title')}
            confirmButtonColor="red-600"
            onClose={onDialogClose}
            onRequestClose={onDialogClose}
            onCancel={onDialogClose}
            onConfirm={onDelete}
        >
            <p>{t('expenses.list.delete.confirm')}</p>
        </ConfirmDialog>
    )
}

export default ExpenseDeleteConfirmation


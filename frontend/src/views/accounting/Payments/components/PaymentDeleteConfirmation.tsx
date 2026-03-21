import ConfirmDialog from '@/components/shared/ConfirmDialog'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'
import { useTranslation } from 'react-i18next'
import {
    useAppDispatch,
    useAppSelector,
    toggleDeleteDialog,
    getPayments,
} from '../store'
import { apiDeletePayment } from '@/services/AccountingService'
import type { PaymentsTableState } from '../store/paymentsSlice'

const PaymentDeleteConfirmation = () => {
    const dispatch = useAppDispatch()
    const { t } = useTranslation()

    const deleteDialogOpen = useAppSelector(
        (state) => state.accountingPayments.data.deleteDialogOpen,
    )
    const deletePaymentId = useAppSelector(
        (state) => state.accountingPayments.data.deletePaymentId,
    )
    const tableData = useAppSelector((state) => state.accountingPayments.data.tableData)

    const onDialogClose = () => {
        dispatch(toggleDeleteDialog({ open: false, paymentId: null }))
    }

    const onConfirm = async () => {
        if (!deletePaymentId) {
            return
        }
        try {
            await apiDeletePayment<boolean>(deletePaymentId)
            toast.push(
                <Notification title={t('accounting.payments.feedback.deletedTitle')} type="success">
                    {t('accounting.payments.feedback.deletedDesc')}
                </Notification>,
            )
            const refreshData: PaymentsTableState = { ...tableData }
            dispatch(getPayments(refreshData))
        } catch {
            toast.push(
                <Notification title={t('accounting.payments.feedback.deleteFailedTitle')} type="danger">
                    {t('accounting.payments.feedback.deleteFailedDesc')}
                </Notification>,
            )
        } finally {
            dispatch(toggleDeleteDialog({ open: false, paymentId: null }))
        }
    }

    return (
        <ConfirmDialog
            isOpen={deleteDialogOpen}
            type="danger"
            title={t('accounting.payments.delete.title')}
            confirmButtonColor="red-600"
            onClose={onDialogClose}
            onRequestClose={onDialogClose}
            onCancel={onDialogClose}
            onConfirm={onConfirm}
        >
            <p>{t('accounting.payments.delete.confirm')}</p>
        </ConfirmDialog>
    )
}

export default PaymentDeleteConfirmation

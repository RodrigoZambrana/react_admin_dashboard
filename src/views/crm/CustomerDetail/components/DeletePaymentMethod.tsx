import {
    updatePaymentMethodData,
    closeDeletePaymentMethodDialog,
    useAppDispatch,
    useAppSelector,
    PaymentMethod,
} from '../store'
import cloneDeep from 'lodash/cloneDeep'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { useTranslation } from 'react-i18next'

const DeletePaymentMethod = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const EMPTY_METHODS: PaymentMethod[] = []
    const EMPTY_SELECTED: Partial<PaymentMethod> = {}
    const crmDetails = useAppSelector(
        (state) => state.crmCustomerDetails?.data,
    )
    const data = crmDetails?.paymentMethodData ?? EMPTY_METHODS
    const dialogOpen = crmDetails?.deletePaymentMethodDialog ?? false
    const selectedCard = (crmDetails?.selectedCard as Partial<PaymentMethod>) ?? EMPTY_SELECTED

    const onDelete = () => {
        let newData = cloneDeep(data) || []
        newData = newData.filter(
            (payment) => payment.last4Number !== selectedCard.last4Number,
        )
        dispatch(closeDeletePaymentMethodDialog())
        dispatch(updatePaymentMethodData(newData))
    }

    const onDialogClose = () => {
        dispatch(closeDeletePaymentMethodDialog())
    }

    return (
        <ConfirmDialog
            isOpen={dialogOpen}
            type="danger"
            title={t('crm.customerDetail.removePaymentMethod')}
            confirmButtonColor="red-600"
            onClose={onDialogClose}
            onRequestClose={onDialogClose}
            onCancel={onDialogClose}
            onConfirm={onDelete}
        >
            <p>{t('crm.customerDetail.removePaymentMethodConfirm')}</p>
        </ConfirmDialog>
    )
}

export default DeletePaymentMethod

import CustomerFormDrawer from '@/components/shared/CustomerFormDrawer'
import {
    CustomerProps,
    FormModel as CustomerFormModel,
} from '@/views/crm/CustomerForm'
import { apPutCrmCustomer } from '@/services/CrmService'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { useTranslation } from 'react-i18next'
import {
    composeCustomerPayload,
    normalizeCustomerForSuccess,
} from '@/components/shared/customerFormUtils'

export type AddCustomerDrawerProps = {
    isOpen: boolean
    onClose: () => void
    onSuccess?: (
        customer: Record<string, unknown>,
        formValues: CustomerFormModel,
    ) => void
    customer?: (CustomerProps & { id?: string | number }) | null
    title?: string
}

const AddCustomerDrawer = ({
    isOpen,
    onClose,
    onSuccess,
    customer,
    title,
}: AddCustomerDrawerProps) => {
    const { t } = useTranslation()

    const handleSubmit = async (values: CustomerFormModel) => {
        const payload = composeCustomerPayload(values, customer)

        try {
            const response = await apPutCrmCustomer<any, typeof payload>(payload)
            const saved = (response as any).data || (response as any)

            if (!saved?.id) {
                throw new Error(
                    t('text.validation.failed', {
                        defaultValue: 'Unable to save customer',
                    }),
                )
            }

            const normalized = normalizeCustomerForSuccess(saved, values)
            onSuccess?.(normalized, values)

            toast.push(
                <Notification
                    title={t('text.actions.save')}
                    type="success"
                >
                    {t(
                        customer?.id
                            ? 'text.messages.customerUpdated'
                            : 'text.messages.customerAdded',
                    )}
                </Notification>,
                { placement: 'top-center' },
            )

            onClose()
        } catch (error) {
            toast.push(
                <Notification title={t('validation.failed')} type="danger">
                    {(error as any)?.response?.data?.message ||
                        (error as Error).message}
                </Notification>,
                { placement: 'top-center' },
            )
            throw error
        }
    }

    const labels = {
        cancel: t('text.actions.cancel'),
        next: t('text.actions.next'),
        save: t('text.actions.save'),
    }

    return (
        <CustomerFormDrawer
            isOpen={isOpen}
            onClose={onClose}
            customer={customer || {}}
            title={title || `${t('text.actions.add')} ${t('text.columns.customer')}`}
            labels={labels}
            onSubmit={handleSubmit}
        />
    )
}

export default AddCustomerDrawer

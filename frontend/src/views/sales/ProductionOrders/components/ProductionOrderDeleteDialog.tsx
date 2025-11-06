import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { useTranslation } from 'react-i18next'

type ProductionOrderRecord = {
    id: number
    orderId: number
}

type ProductionOrderDeleteDialogProps = {
    record: ProductionOrderRecord | null
    onCancel: () => void
    onConfirm: () => void
}

const ProductionOrderDeleteDialog = ({ record, onCancel, onConfirm }: ProductionOrderDeleteDialogProps) => {
    const { t } = useTranslation()
    return (
        <ConfirmDialog
            isOpen={Boolean(record)}
            type="danger"
            title={t('sales.productionOrders.delete.title', { defaultValue: 'Delete production order' })}
            confirmButtonColor="red-600"
            onCancel={onCancel}
            onClose={onCancel}
            onConfirm={onConfirm}
            onRequestClose={onCancel}
        >
            <p>
                {t('sales.productionOrders.delete.confirm', {
                    defaultValue: 'Are you sure you want to delete production order #{{id}}?',
                    id: record?.id,
                })}
            </p>
        </ConfirmDialog>
    )
}

export default ProductionOrderDeleteDialog

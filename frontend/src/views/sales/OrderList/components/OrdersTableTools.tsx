import Button from '@/components/ui/Button'
import { HiDownload, HiOutlineTrash, HiPlusCircle } from 'react-icons/hi'
import OrderTableSearch from './OrderTableSearch'
import { setDeleteMode, useAppDispatch, useAppSelector } from '../store'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

const BatchDeleteButton = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()

    const onBatchDelete = () => {
        dispatch(setDeleteMode('batch'))
    }

    return (
        <Button
            variant="solid"
            color="red-600"
            size="sm"
            icon={<HiOutlineTrash />}
            onClick={onBatchDelete}
        >
            {t('text.actions.batchDelete')}
        </Button>
    )
}

const OrdersTableTools = () => {
    const { t } = useTranslation()
    const selectedRows = useAppSelector(
        (state) => state.salesOrderList.data.selectedRows,
    )
    return (
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <Link to="/app/sales/order-new">
                <Button variant="solid" size="sm" icon={<HiPlusCircle />}>
                    {t('text.actions.add')}
                </Button>
            </Link>
            {selectedRows.length > 0 && <BatchDeleteButton />}
            <Link download to="/data/order-list.csv" target="_blank">
                <Button block size="sm" icon={<HiDownload />}>
                    {t('text.actions.export')}
                </Button>
            </Link>
            <OrderTableSearch />
        </div>
    )
}

export default OrdersTableTools

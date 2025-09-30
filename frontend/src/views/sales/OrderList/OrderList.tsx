import reducer from './store'
import { injectReducer } from '@/store'
import AdaptableCard from '@/components/shared/AdaptableCard'
import OrdersTable from './components/OrdersTable'
import OrdersTableTools from './components/OrdersTableTools'
import { useTranslation } from 'react-i18next'
import OrderDeleteConfirmation from './components/OrderDeleteConfirmation'

injectReducer('salesOrderList', reducer)

const OrderList = () => {
    const { t } = useTranslation()
    return (
        <AdaptableCard className="h-full" bodyClass="h-full">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0">{t('sales.orders.title')}</h3>
                <OrdersTableTools />
            </div>
            <OrdersTable />
            <OrderDeleteConfirmation />
        </AdaptableCard>
    )
}

export default OrderList

import reducer from './store'
import { injectReducer } from '@/store'
import AdaptableCard from '@/components/shared/AdaptableCard'
import OrdersTable from './components/OrdersTable'
import OrdersTableTools from './components/OrdersTableTools'
import OrderDeleteConfirmation from './components/OrderDeleteConfirmation'
import { useEffect } from 'react'
import { useSalesDocumentI18n } from '../context/useSalesDocumentI18n'
import {
    setTableData,
    useAppDispatch,
    useSalesOrderListData,
} from './store'

injectReducer('salesOrderList', reducer)

const OrderList = () => {
    const { tDoc, resource } = useSalesDocumentI18n()
    const dispatch = useAppDispatch()
    const { tableData } = useSalesOrderListData()
    const tableResource = tableData.resource ?? resource

    useEffect(() => {
        if (tableResource !== resource) {
            dispatch(
                setTableData({
                    resource,
                }),
            )
        }
    }, [dispatch, resource, tableResource])

    return (
        <AdaptableCard className="h-full" bodyClass="h-full">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0">{tDoc('title')}</h3>
                <OrdersTableTools />
            </div>
            <OrdersTable />
            <OrderDeleteConfirmation />
        </AdaptableCard>
    )
}

export default OrderList

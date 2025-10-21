import OrderList from './OrderList'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const OrderListView = () => (
    <SalesDocumentProvider mode="order">
        <OrderList />
    </SalesDocumentProvider>
)

export default OrderListView

import OrderDetails from './OrderDetails'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const OrderDetailsView = () => (
    <SalesDocumentProvider mode="order">
        <OrderDetails />
    </SalesDocumentProvider>
)

export default OrderDetailsView

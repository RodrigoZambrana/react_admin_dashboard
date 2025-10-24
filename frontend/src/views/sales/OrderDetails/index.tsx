import OrderDetails from './OrderDetails'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const OrderDetailsView = () => (
    <SalesDocumentProvider
        mode="order"
        overrides={{ showProductSpecifications: false }}
    >
        <OrderDetails />
    </SalesDocumentProvider>
)

export default OrderDetailsView

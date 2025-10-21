import OrderNew from './OrderNew'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const OrderNewView = () => (
    <SalesDocumentProvider mode="order">
        <OrderNew />
    </SalesDocumentProvider>
)

export default OrderNewView

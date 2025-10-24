import OrderNew from './OrderNew'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const OrderNewView = () => (
    <SalesDocumentProvider mode="order" overrides={{ showProductSpecifications: false }}>
        <OrderNew />
    </SalesDocumentProvider>
)

export default OrderNewView

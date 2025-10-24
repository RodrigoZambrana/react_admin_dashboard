import OrderEdit from './OrderEdit'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const OrderEditView = () => (
    <SalesDocumentProvider mode="order" overrides={{ showProductSpecifications: false }}>
        <OrderEdit />
    </SalesDocumentProvider>
)

export default OrderEditView

import OrderEdit from './OrderEdit'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const OrderEditView = () => (
    <SalesDocumentProvider mode="order">
        <OrderEdit />
    </SalesDocumentProvider>
)

export default OrderEditView

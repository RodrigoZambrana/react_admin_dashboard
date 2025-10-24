import OrderEdit from '../OrderEdit/OrderEdit'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const BudgetEdit = () => (
    <SalesDocumentProvider mode="budget" overrides={{ showProductSpecifications: false }}>
        <OrderEdit />
    </SalesDocumentProvider>
)

export default BudgetEdit

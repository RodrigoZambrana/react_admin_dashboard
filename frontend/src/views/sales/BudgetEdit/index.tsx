import OrderEdit from '../OrderEdit/OrderEdit'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const BudgetEdit = () => (
    <SalesDocumentProvider mode="budget">
        <OrderEdit />
    </SalesDocumentProvider>
)

export default BudgetEdit

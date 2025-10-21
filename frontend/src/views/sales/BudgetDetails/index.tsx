import OrderDetails from '../OrderDetails/OrderDetails'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const BudgetDetails = () => (
    <SalesDocumentProvider mode="budget">
        <OrderDetails />
    </SalesDocumentProvider>
)

export default BudgetDetails

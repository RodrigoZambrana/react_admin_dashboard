import OrderList from '../OrderList/OrderList'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const BudgetList = () => (
    <SalesDocumentProvider mode="budget">
        <OrderList />
    </SalesDocumentProvider>
)

export default BudgetList

import Invoice from '@/views/account/Invoice'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const BudgetDocument = () => (
    <SalesDocumentProvider mode="budget">
        <Invoice resource="budgets" />
    </SalesDocumentProvider>
)

export default BudgetDocument

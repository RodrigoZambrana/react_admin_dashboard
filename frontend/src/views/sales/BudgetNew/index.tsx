import OrderNew from '../OrderNew/OrderNew'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const BudgetNew = () => (
    <SalesDocumentProvider
        mode="budget"
        overrides={{ showProductSpecifications: false, showPaymentMethodSelect: false }}
    >
        <OrderNew />
    </SalesDocumentProvider>
)

export default BudgetNew

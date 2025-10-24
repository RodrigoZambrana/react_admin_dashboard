import OrderNew from '../OrderNew/OrderNew'
import { SalesDocumentProvider } from '../context/SalesDocumentContext'

const BudgetSummary = () => (
    <SalesDocumentProvider
        mode="budget"
        overrides={{
            customerRequired: false,
            layoutMode: 'itemsOnly',
            defaults: { title: 'Presupuestos -Calculo Rápido' },
            showProductSpecifications: false,
            showPaymentMethodSelect: false,
        }}
    >
        <OrderNew />
    </SalesDocumentProvider>
)

export default BudgetSummary

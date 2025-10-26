import reducer, { SLICE_NAME } from './store'
import { injectReducer } from '@/store'
import AdaptableCard from '@/components/shared/AdaptableCard'
import PaymentsTable from './components/PaymentsTable'
import PaymentsTableTools from './components/PaymentsTableTools'
import PaymentFormModal from './components/PaymentFormModal'
import PaymentDeleteConfirmation from './components/PaymentDeleteConfirmation'
import { useTranslation } from 'react-i18next'

injectReducer(SLICE_NAME, reducer)

const Payments = () => {
    const { t } = useTranslation()
    return (
        <AdaptableCard className="h-full" bodyClass="h-full">
            <div className="lg:flex items-center justify-between mb-4">
                <h3 className="mb-4 lg:mb-0">{t('accounting.payments.title')}</h3>
                <PaymentsTableTools />
            </div>
            <PaymentsTable />
            <PaymentFormModal />
            <PaymentDeleteConfirmation />
        </AdaptableCard>
    )
}

export default Payments

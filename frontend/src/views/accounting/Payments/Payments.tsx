import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import reducer, { SLICE_NAME } from './store'
import { injectReducer, useAppDispatch } from '@/store'
import AdaptableCard from '@/components/shared/AdaptableCard'
import PaymentsTable from './components/PaymentsTable'
import PaymentsTableTools from './components/PaymentsTableTools'
import PaymentFormModal from './components/PaymentFormModal'
import PaymentDeleteConfirmation from './components/PaymentDeleteConfirmation'
import { useTranslation } from 'react-i18next'
import { togglePaymentDialog } from './store/paymentsSlice'

injectReducer(SLICE_NAME, reducer)

const Payments = () => {
    const { t } = useTranslation()
    const dispatch = useAppDispatch()
    const location = useLocation()
    const navigate = useNavigate()

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const paymentIdParam = params.get('paymentId')
        if (!paymentIdParam) {
            return
        }
        if (!params.has('paymentId')) {
            return
        }
        const parsedId = Number(paymentIdParam)
        if (Number.isNaN(parsedId)) {
            // eslint-disable-next-line no-console
            console.error('Invalid paymentId parameter in payments route:', paymentIdParam)
        } else {
            dispatch(togglePaymentDialog({ open: true, mode: 'edit', paymentId: parsedId }))
        }
        params.delete('paymentId')
        const nextSearch = params.toString()
        navigate(
            {
                pathname: location.pathname,
                search: nextSearch ? `?${nextSearch}` : '',
            },
            { replace: true },
        )
    }, [dispatch, location.pathname, location.search, navigate])

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

import { useEffect } from 'react'
import Loading from '@/components/shared/Loading'
import CurrencySummary from './CurrencySummary'
import MonthlyPerformance from './MonthlyPerformance'
import CurrencyBreakdown from './CurrencyBreakdown'
import { getAccountingDashboardData, useAppSelector } from '../store'
import { useAppDispatch } from '@/store'

const AccountingDashboardBody = () => {
    const dispatch = useAppDispatch()

    const dashboardData = useAppSelector(
        (state) => state.accountingDashboard.data.dashboardData,
    )

    const loading = useAppSelector(
        (state) => state.accountingDashboard.data.loading,
    )

    useEffect(() => {
        dispatch(getAccountingDashboardData())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <Loading loading={loading}>
            <CurrencySummary data={dashboardData?.currencySummary} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <MonthlyPerformance
                    data={dashboardData?.monthly}
                    className="col-span-1 lg:col-span-2"
                />
                <CurrencyBreakdown totals={dashboardData?.totals} monthly={dashboardData?.monthly} />
            </div>
        </Loading>
    )
}

export default AccountingDashboardBody

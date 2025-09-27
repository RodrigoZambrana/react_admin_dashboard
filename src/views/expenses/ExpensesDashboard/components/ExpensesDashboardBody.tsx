import { useEffect } from 'react'
import Loading from '@/components/shared/Loading'
import Statistic from './Statistic'
import ExpensesReport from './ExpensesReport'
import ExpensesByCategories from './ExpensesByCategories'
import RecentExpenses from './RecentExpenses'
import { getExpensesDashboardData, useAppSelector } from '../store'
import { useAppDispatch } from '@/store'

const ExpensesDashboardBody = () => {
    const dispatch = useAppDispatch()

    const dashboardData = useAppSelector(
        (state) => state.expensesDashboard.data.dashboardData,
    )

    const loading = useAppSelector(
        (state) => state.expensesDashboard.data.loading,
    )

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchData = () => {
        dispatch(getExpensesDashboardData())
    }

    return (
        <Loading loading={loading}>
            <Statistic data={dashboardData?.statisticData} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <ExpensesReport
                    data={dashboardData?.expensesReportData}
                    className="col-span-2"
                />
                <ExpensesByCategories
                    data={dashboardData?.expensesByCategoriesData}
                />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <RecentExpenses
                    data={dashboardData?.latestExpensesData}
                    className="lg:col-span-2"
                />
            </div>
        </Loading>
    )
}

export default ExpensesDashboardBody


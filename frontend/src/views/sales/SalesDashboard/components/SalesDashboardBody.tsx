import { useEffect } from 'react'
import Loading from '@/components/shared/Loading'
import Statistic from './Statistic'
import SalesReport from './SalesReport'
import SalesByCategories from './SalesByCategories'
import LatestOrder from './LatestOrder'
import TopProduct from './TopProduct'
import { getSalesDashboardData, useAppSelector } from '../store'
import { useAppDispatch } from '@/store'

const SalesDashboardBody = () => {
    const dispatch = useAppDispatch()

    const dashboardData = useAppSelector(
        (state) => state.salesDashboard.data.dashboardData,
    )

    const loading = useAppSelector((state) => state.salesDashboard.data.loading)

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const fetchData = () => {
        dispatch(getSalesDashboardData())
    }

    return (
        <Loading loading={loading}>
            <div className="flex flex-col gap-4 sm:gap-6">
                <Statistic data={dashboardData?.statisticData} />
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    <SalesReport
                        data={dashboardData?.salesReportData}
                        className="col-span-1 lg:col-span-2"
                    />
                    <SalesByCategories
                        data={dashboardData?.salesByCategoriesData}
                    />
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                    <LatestOrder
                        data={dashboardData?.latestOrderData}
                        className="lg:col-span-2"
                    />
                    <TopProduct data={dashboardData?.topProductsData} />
                </div>
            </div>
        </Loading>
    )
}

export default SalesDashboardBody

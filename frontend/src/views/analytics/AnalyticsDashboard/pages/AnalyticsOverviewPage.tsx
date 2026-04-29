import Loading from '@/components/shared/Loading'

import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import AnalyticsOverview from '../components/AnalyticsOverview'
import { useAnalyticsDashboardData } from '../hooks/useAnalyticsDashboardData'

const AnalyticsOverviewPage = () => {
    const { loading, dashboardData } = useAnalyticsDashboardData()

    return (
        <AnalyticsPageLayout
            title="Resumen"
            subtitle="Revenue, órdenes, conversión y evolución temporal."
        >
            <Loading loading={loading}>
                <AnalyticsOverview data={dashboardData?.overview} />
            </Loading>
        </AnalyticsPageLayout>
    )
}

export default AnalyticsOverviewPage


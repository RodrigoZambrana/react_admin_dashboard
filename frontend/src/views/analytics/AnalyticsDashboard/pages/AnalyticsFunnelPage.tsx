import Loading from '@/components/shared/Loading'

import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import AnalyticsFunnel from '../components/AnalyticsFunnel'
import { useAnalyticsDashboardData } from '../hooks/useAnalyticsDashboardData'

const AnalyticsFunnelPage = () => {
    const { loading, dashboardData } = useAnalyticsDashboardData()

    return (
        <AnalyticsPageLayout
            title="Embudo"
            subtitle="Del view_item al purchase con comparación contra el período anterior."
        >
            <Loading loading={loading}>
                <AnalyticsFunnel data={dashboardData?.funnel} />
            </Loading>
        </AnalyticsPageLayout>
    )
}

export default AnalyticsFunnelPage


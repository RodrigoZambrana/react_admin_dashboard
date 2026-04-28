import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'

import Loading from '@/components/shared/Loading'
import { injectReducer, useAppDispatch, useAppSelector } from '@/store'
import GrowthSettings from '@/views/settings/GrowthSettings'

import reducer, {
    getAnalyticsDashboardData,
    type AnalyticsDashboardState,
} from './store'
import AnalyticsDashboardHeader from './components/AnalyticsDashboardHeader'
import AnalyticsDashboardSidebar from './components/AnalyticsDashboardSidebar'
import AnalyticsOverview from './components/AnalyticsOverview'
import AnalyticsFunnel from './components/AnalyticsFunnel'
import AnalyticsSectionPlaceholder from './components/AnalyticsSectionPlaceholder'

injectReducer('analyticsDashboard', reducer)

const sections = [
    {
        key: 'overview',
        path: '/app/analytics/overview',
        title: 'Overview',
        subtitle: 'Revenue, orders, conversion rate and trends.',
    },
    {
        key: 'funnel',
        path: '/app/analytics/funnel',
        title: 'Funnel',
        subtitle: 'View item to purchase flow with comparisons.',
    },
    {
        key: 'marketing',
        path: '/app/analytics/marketing',
        title: 'Marketing',
        subtitle: 'CAC, ROAS and channel performance.',
    },
    {
        key: 'products',
        path: '/app/analytics/products',
        title: 'Products',
        subtitle: 'Top products and product intent gaps.',
    },
    {
        key: 'behavior',
        path: '/app/analytics/behavior',
        title: 'Behavior',
        subtitle: 'Pathing, sessions and engagement patterns.',
    },
    {
        key: 'conversions',
        path: '/app/analytics/conversions',
        title: 'Conversions',
        subtitle: 'Conversion drivers and drop-off analysis.',
    },
    {
        key: 'growth',
        path: '/app/analytics/growth-insights',
        title: 'Growth & Insights',
        subtitle: 'Tracking and instrumentation configuration.',
    },
] as const

const placeholderBySection = {
    marketing: {
        title: 'Marketing will live here',
        subtitle: 'Reserved for CAC, ROAS, spend and channel attribution once ad_spend is available.',
        bullets: [
            'Channel revenue by campaign',
            'CAC vs revenue by date',
            'ROAS by marketing source',
            'Spend anomalies and budget alerts',
        ],
    },
    products: {
        title: 'Products will live here',
        subtitle: 'Reserved for product-level performance, intent gaps and merchandising signals.',
        bullets: [
            'Top products by revenue',
            'Products with high views and low purchase',
            'Category trend deltas',
            'Variant conversion analysis',
        ],
    },
    behavior: {
        title: 'Behavior will live here',
        subtitle: 'Reserved for session depth, page flow and engagement breakdowns.',
        bullets: [
            'Path exploration',
            'Session duration bands',
            'Referrer and landing page analysis',
            'Device and country segmentation',
        ],
    },
    conversions: {
        title: 'Conversions will live here',
        subtitle: 'Reserved for conversion drivers, cohort analysis and step-by-step optimization.',
        bullets: [
            'Conversion rate by step',
            'Drop-off by source',
            'Repeat purchase tracking',
            'Cohort and segment comparisons',
        ],
    },
} as const

const resolveSectionKey = (pathname: string) => {
    if (pathname.startsWith('/app/analytics/funnel')) return 'funnel'
    if (pathname.startsWith('/app/analytics/marketing')) return 'marketing'
    if (pathname.startsWith('/app/analytics/products')) return 'products'
    if (pathname.startsWith('/app/analytics/behavior')) return 'behavior'
    if (pathname.startsWith('/app/analytics/conversions')) return 'conversions'
    if (pathname.startsWith('/app/analytics/growth-insights')) return 'growth'
    return 'overview'
}

const AnalyticsDashboard = () => {
    const dispatch = useAppDispatch()
    const location = useLocation()
    const sectionKey = resolveSectionKey(location.pathname)

    const dashboardSlice = useAppSelector(
        (state) =>
            (state as {
                analyticsDashboard?: { data: AnalyticsDashboardState }
            }).analyticsDashboard?.data,
    )
    const loading = dashboardSlice?.loading ?? false
    const dashboardData = dashboardSlice?.dashboardData

    useEffect(() => {
        void dispatch(getAnalyticsDashboardData() as any)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const activeSection = useMemo(
        () => sections.find((section) => section.key === sectionKey) ?? sections[0],
        [sectionKey],
    )

    return (
        <div className="flex h-full flex-col gap-4">
            <AnalyticsDashboardHeader
                title={activeSection.title}
                subtitle={activeSection.subtitle}
            />

            <div className="flex flex-col gap-4 xl:flex-row">
                <AnalyticsDashboardSidebar sections={[...sections]} />

                <div className="min-w-0 flex-1">
                    <Loading loading={loading && sectionKey !== 'growth'}>
                        {sectionKey === 'overview' && (
                            <AnalyticsOverview data={dashboardData?.overview} />
                        )}
                        {sectionKey === 'funnel' && (
                            <AnalyticsFunnel data={dashboardData?.funnel} />
                        )}
                        {sectionKey === 'growth' && <GrowthSettings />}
                        {sectionKey === 'marketing' && (
                            <AnalyticsSectionPlaceholder
                                {...placeholderBySection.marketing}
                            />
                        )}
                        {sectionKey === 'products' && (
                            <AnalyticsSectionPlaceholder
                                {...placeholderBySection.products}
                            />
                        )}
                        {sectionKey === 'behavior' && (
                            <AnalyticsSectionPlaceholder
                                {...placeholderBySection.behavior}
                            />
                        )}
                        {sectionKey === 'conversions' && (
                            <AnalyticsSectionPlaceholder
                                {...placeholderBySection.conversions}
                            />
                        )}
                    </Loading>
                </div>
            </div>
        </div>
    )
}

export default AnalyticsDashboard

import { ReactNode } from 'react'

import { analyticsSections, type AnalyticsSection } from '../analyticsSections'
import AnalyticsDashboardHeader from './AnalyticsDashboardHeader'
import AnalyticsDashboardSidebar from './AnalyticsDashboardSidebar'

type AnalyticsPageLayoutProps = {
    title: string
    subtitle: string
    children: ReactNode
    showControls?: boolean
    sections?: readonly AnalyticsSection[]
}

const AnalyticsPageLayout = ({
    title,
    subtitle,
    children,
    showControls = true,
    sections = analyticsSections,
}: AnalyticsPageLayoutProps) => {
    return (
        <div className="flex h-full flex-col gap-4">
            <AnalyticsDashboardHeader
                title={title}
                subtitle={subtitle}
                showControls={showControls}
            />

            <div className="flex flex-col gap-4 xl:flex-row">
                <AnalyticsDashboardSidebar sections={sections} />

                <div className="min-w-0 flex-1">{children}</div>
            </div>
        </div>
    )
}

export default AnalyticsPageLayout


import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import GrowthSettings from '@/views/settings/GrowthSettings'

const AnalyticsGrowthInsightsPage = () => {
    return (
        <AnalyticsPageLayout
            title="Growth & Insights"
            subtitle="Configuración de tracking, etiquetas e instrumentos."
            showControls={false}
        >
            <GrowthSettings />
        </AnalyticsPageLayout>
    )
}

export default AnalyticsGrowthInsightsPage


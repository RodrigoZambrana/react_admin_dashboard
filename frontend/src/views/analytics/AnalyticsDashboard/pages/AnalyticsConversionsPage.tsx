import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import AnalyticsSectionPlaceholder from '../components/AnalyticsSectionPlaceholder'

const AnalyticsConversionsPage = () => {
    return (
        <AnalyticsPageLayout
            title="Conversiones"
            subtitle="Drivers de conversión y caídas por etapa."
            showControls={false}
        >
            <AnalyticsSectionPlaceholder
                title="Conversiones"
                subtitle="Sección preparada para cohortes, repeticiones y caída por paso."
                bullets={[
                    'Conversión por fuente',
                    'Drop-off por etapa',
                    'Repeat purchase',
                    'Comparación por cohortes',
                ]}
            />
        </AnalyticsPageLayout>
    )
}

export default AnalyticsConversionsPage


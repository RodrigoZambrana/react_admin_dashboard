import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import AnalyticsSectionPlaceholder from '../components/AnalyticsSectionPlaceholder'

const AnalyticsBehaviorPage = () => {
    return (
        <AnalyticsPageLayout
            title="Comportamiento"
            subtitle="Sesiones, navegación y engagement."
            showControls={false}
        >
            <AnalyticsSectionPlaceholder
                title="Comportamiento"
                subtitle="Sección preparada para exploración de sesiones, paths y puntos de fricción."
                bullets={[
                    'Exploración de paths',
                    'Duración y profundidad de sesión',
                    'Landing pages y referrer',
                    'Segmentación por país y dispositivo',
                ]}
            />
        </AnalyticsPageLayout>
    )
}

export default AnalyticsBehaviorPage


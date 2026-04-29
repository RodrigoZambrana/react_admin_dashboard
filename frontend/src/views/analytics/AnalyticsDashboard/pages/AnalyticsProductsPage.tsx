import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import AnalyticsSectionPlaceholder from '../components/AnalyticsSectionPlaceholder'

const AnalyticsProductsPage = () => {
    return (
        <AnalyticsPageLayout
            title="Productos"
            subtitle="Productos con más intención, vistas y revenue."
            showControls={false}
        >
            <AnalyticsSectionPlaceholder
                title="Productos"
                subtitle="Sección lista para análisis de intención, conversión por producto y merchandising."
                bullets={[
                    'Productos con muchas vistas y pocas compras',
                    'Top productos por revenue',
                    'Rendimiento por categoría',
                    'Breakdown por variante y stock',
                ]}
            />
        </AnalyticsPageLayout>
    )
}

export default AnalyticsProductsPage


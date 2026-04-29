import Card from '@/components/ui/Card'

import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import AnalyticsSectionPlaceholder from '../components/AnalyticsSectionPlaceholder'

const AnalyticsMarketingPage = () => {
    return (
        <AnalyticsPageLayout
            title="Marketing"
            subtitle="CAC, ROAS y atribución por canal."
            showControls={false}
        >
            <div className="flex flex-col gap-4">
                <AnalyticsSectionPlaceholder
                    title="Marketing"
                    subtitle="Aquí vivirán CAC, ROAS, gasto por campaña y alertas de performance."
                    bullets={[
                        'Revenue por canal y campaña',
                        'CAC y ROAS por fecha',
                        'Gasto sin revenue asociado',
                        'Alertas de presupuesto',
                    ]}
                />
                <Card>
                    <p className="text-sm text-gray-500">
                        Esta página ya queda desacoplada como ruta propia para crecer sin mezclarla
                        con el resumen.
                    </p>
                </Card>
            </div>
        </AnalyticsPageLayout>
    )
}

export default AnalyticsMarketingPage


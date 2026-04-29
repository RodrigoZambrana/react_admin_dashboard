import Card from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'

import AnalyticsPageLayout from './components/AnalyticsPageLayout'
import { analyticsSections } from './analyticsSections'

const highlightSections = analyticsSections.filter(
    (section) => section.key !== 'home',
)

const AnalyticsDashboard = () => {
    const navigate = useNavigate()

    return (
        <AnalyticsPageLayout
            title="Analítica"
            subtitle="Consola central para leer el negocio, con navegación separada por página y sin mezclar configuración con consumo."
            showControls={false}
        >
            <div className="flex flex-col gap-4">
                <Card>
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <h4 className="m-0">Analítica</h4>
                            <Badge
                                content="dashboard"
                                innerClass="bg-indigo-100 text-indigo-700"
                            />
                        </div>
                        <p className="text-sm text-gray-600">
                            Entrá al resumen, embudo y secciones futuras desde páginas propias.
                            Growth & Insights queda disponible como configuración hermana.
                        </p>
                    </div>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {highlightSections.map((section) => (
                        <Card key={section.key} className="h-full">
                            <div className="flex h-full flex-col justify-between gap-4">
                                <div>
                                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                                        {section.key === 'growthInsights'
                                            ? 'Configuración'
                                            : 'Página'}
                                    </div>
                                    <h5 className="mt-2 mb-2">{section.title}</h5>
                                    <p className="text-sm text-gray-500">{section.subtitle}</p>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                    <Badge
                                        content="Disponible"
                                        innerClass="bg-emerald-100 text-emerald-700"
                                    />
                                    <Button
                                        size="sm"
                                        variant="solid"
                                        onClick={() => navigate(section.path)}
                                    >
                                        Abrir
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        </AnalyticsPageLayout>
    )
}

export default AnalyticsDashboard

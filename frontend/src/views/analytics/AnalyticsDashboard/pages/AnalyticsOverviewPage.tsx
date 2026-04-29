import Loading from '@/components/shared/Loading'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'

import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import AnalyticsOverview from '../components/AnalyticsOverview'
import { useAnalyticsDashboardData } from '../hooks/useAnalyticsDashboardData'
import { useAnalyticsInsightsData } from '../hooks/useAnalyticsInsightsData'

const impactTone = (impact?: string | null) => {
    switch (impact) {
        case 'high':
            return 'bg-rose-100 text-rose-700'
        case 'medium':
            return 'bg-amber-100 text-amber-700'
        case 'low':
            return 'bg-sky-100 text-sky-700'
        default:
            return 'bg-gray-100 text-gray-700'
    }
}

const sourceTone = (source?: string | null) => {
    switch (source) {
        case 'ads':
            return 'bg-orange-100 text-orange-700'
        case 'search_console':
            return 'bg-cyan-100 text-cyan-700'
        case 'ga4':
            return 'bg-indigo-100 text-indigo-700'
        default:
            return 'bg-gray-100 text-gray-700'
    }
}

const originTone = (origin?: string | null) => {
    switch (origin) {
        case 'ai':
            return 'bg-emerald-100 text-emerald-700'
        case 'fallback':
            return 'bg-amber-100 text-amber-700'
        default:
            return 'bg-gray-100 text-gray-700'
    }
}

const originLabel = (origin?: string | null) => {
    if (origin === 'ai') {
        return 'IA'
    }
    if (origin === 'fallback') {
        return 'Sistema'
    }
    return 'Interno'
}

const AnalyticsOverviewPage = () => {
    const { loading, dashboardData } = useAnalyticsDashboardData()
    const { loading: insightsLoading, data: insightsData } = useAnalyticsInsightsData()

    const summary = insightsData.summary?.summary ?? insightsData.bundle?.summary ?? 'Sin resumen ejecutivo disponible.'
    const summaryOrigin = insightsData.summary?.generatedBy ?? insightsData.bundle?.generatedBy ?? null
    const summaryOriginReason =
        insightsData.summary?.generationReason ?? insightsData.bundle?.generationReason ?? null
    const topInsight = insightsData.summary?.topInsight ?? insightsData.bundle?.insights?.[0] ?? null
    const prioritizedActions = insightsData.summary?.prioritizedActions ?? insightsData.bundle?.prioritizedActions ?? []
    const qualityBySource = insightsData.summary?.qualityBySource ?? insightsData.bundle?.qualityBySource ?? []

    return (
        <AnalyticsPageLayout
            title="Resumen"
            subtitle="Resumen ejecutivo de negocio, oportunidades y calidad de datos."
        >
            <Loading loading={loading || insightsLoading}>
                <div className="flex flex-col gap-4">
                    <Card>
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                        content="Executive report"
                                        innerClass="bg-indigo-100 text-indigo-700"
                                    />
                                    <Badge
                                        content={originLabel(summaryOrigin)}
                                        innerClass={originTone(summaryOrigin)}
                                    />
                                    <Badge
                                        content={topInsight?.source ?? 'mixed'}
                                        innerClass={sourceTone(topInsight?.source)}
                                    />
                                    <Badge
                                        content={topInsight?.impact ?? 'low'}
                                        innerClass={impactTone(topInsight?.impact)}
                                    />
                                </div>
                                <div>
                                    <h4 className="mb-1">Reporte ejecutivo</h4>
                                    <p className="max-w-4xl text-sm text-gray-600">
                                        {summary}
                                    </p>
                                    {summaryOriginReason ? (
                                        <p className="mt-2 max-w-4xl text-xs text-gray-500">
                                            {summaryOriginReason}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Badge
                                    content={`${prioritizedActions.length} acciones priorizadas`}
                                    innerClass="bg-emerald-100 text-emerald-700"
                                />
                                <Badge
                                    content={`${qualityBySource.length} fuentes evaluadas`}
                                    innerClass="bg-slate-100 text-slate-700"
                                />
                            </div>
                        </div>

                        <div className="mt-4 grid gap-4 xl:grid-cols-3">
                            <Card>
                                <div className="mb-3">
                                    <h5 className="mb-1">Insight principal</h5>
                                    <p className="text-sm text-gray-500">
                                        La señal más importante para tomar acción ahora.
                                    </p>
                                </div>
                                {topInsight ? (
                                    <div className="space-y-3 text-sm">
                                        <div className="font-semibold text-gray-900 dark:text-gray-100">
                                            {topInsight.title}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Badge
                                                content={topInsight.category ?? 'business_issue'}
                                                innerClass="bg-gray-100 text-gray-700"
                                            />
                                            <Badge
                                                content={topInsight.insightType ?? 'summary'}
                                                innerClass="bg-slate-100 text-slate-700"
                                            />
                                        </div>
                                        <p className="text-gray-600">{topInsight.description}</p>
                                        <p className="font-medium text-gray-800 dark:text-gray-100">
                                            {topInsight.recommendation}
                                        </p>
                                        {topInsight.page ? (
                                            <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-700/40">
                                                <div className="font-medium text-gray-800 dark:text-gray-100">
                                                    Página sugerida
                                                </div>
                                                <div>{topInsight.page}</div>
                                                {topInsight.pageReason ? <div className="mt-1">{topInsight.pageReason}</div> : null}
                                                {topInsight.contentToInclude ? (
                                                    <div className="mt-1">Contenido: {topInsight.contentToInclude}</div>
                                                ) : null}
                                                {topInsight.expectedResult ? (
                                                    <div className="mt-1">Resultado esperado: {topInsight.expectedResult}</div>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500">
                                        No hay insight principal disponible para este rango.
                                    </div>
                                )}
                            </Card>

                            <Card>
                                <div className="mb-3">
                                    <h5 className="mb-1">Acciones priorizadas</h5>
                                    <p className="text-sm text-gray-500">
                                        Lo que conviene hacer ahora.
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    {prioritizedActions.length ? (
                                        prioritizedActions.slice(0, 4).map((action, index) => (
                                            <div
                                                key={`${action.action}-${index}`}
                                                className="rounded-xl bg-gray-50 p-3 dark:bg-gray-700/40"
                                            >
                                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                                    {action.action}
                                                </div>
                                                <div className="mt-1 text-xs text-gray-500">{action.why}</div>
                                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                                    <Badge
                                                        content={action.expectedImpact}
                                                        innerClass={impactTone(action.expectedImpact)}
                                                    />
                                                    <span className="text-xs text-gray-500">
                                                        Confianza {Math.round(action.confidence * 100)}%
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-sm text-gray-500">
                                            No hay acciones priorizadas disponibles.
                                        </div>
                                    )}
                                </div>
                            </Card>

                            <Card>
                                <div className="mb-3">
                                    <h5 className="mb-1">Calidad por fuente</h5>
                                    <p className="text-sm text-gray-500">
                                        Estado de confianza para cada origen de datos.
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    {qualityBySource.length ? (
                                        qualityBySource.map((source) => (
                                            <div
                                                key={source.source}
                                                className="rounded-xl bg-gray-50 p-3 dark:bg-gray-700/40"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="font-medium capitalize text-gray-900 dark:text-gray-100">
                                                        {source.source.replace('_', ' ')}
                                                    </div>
                                                    <Badge
                                                        content={source.status}
                                                        innerClass={impactTone(source.status === 'error' ? 'high' : source.status === 'warning' ? 'medium' : 'low')}
                                                    />
                                                </div>
                                                <div className="mt-1 text-xs text-gray-500">
                                                    Confianza {Math.round(source.confidence * 100)}%
                                                </div>
                                                <div className="mt-2 text-sm text-gray-600">
                                                    {source.summary}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-sm text-gray-500">
                                            No hay detalle de calidad por fuente.
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    </Card>

                    <AnalyticsOverview data={dashboardData?.overview} />
                </div>
            </Loading>
        </AnalyticsPageLayout>
    )
}

export default AnalyticsOverviewPage

import { useMemo, useState } from 'react'

import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Loading from '@/components/shared/Loading'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import { useAnalyticsInsightsData } from '../hooks/useAnalyticsInsightsData'
import {
    apiRecomputeAnalyticsInsights,
    type AnalyticsInsight,
    type AnalyticsInsightHistory,
} from '@/services/AnalyticsService'

const impactTone = (impact: string) => {
    switch (impact) {
        case 'high':
            return 'bg-rose-100 text-rose-700'
        case 'medium':
            return 'bg-amber-100 text-amber-700'
        default:
            return 'bg-sky-100 text-sky-700'
    }
}

const typeTone = (type?: string) => {
    switch (type) {
        case 'data_quality':
            return 'bg-slate-200 text-slate-700'
        case 'revenue':
            return 'bg-fuchsia-100 text-fuchsia-700'
        case 'conversion':
            return 'bg-emerald-100 text-emerald-700'
        case 'behavior':
            return 'bg-cyan-100 text-cyan-700'
        case 'acquisition':
            return 'bg-indigo-100 text-indigo-700'
        default:
            return 'bg-gray-100 text-gray-700'
    }
}

const sourceTone = (source?: string) => {
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
    if (origin === 'ai') return 'IA'
    if (origin === 'fallback') return 'Sistema'
    return 'Interno'
}

const formatDateTime = (value?: string | null) => {
    if (!value) {
        return 'n/a'
    }

    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(value))
    } catch {
        return value
    }
}

const formatRange = (range?: { from: string; to: string } | null) => {
    if (!range) {
        return 'n/a'
    }
    return `${range.from.slice(0, 10)} → ${range.to.slice(0, 10)}`
}

const formatEvidence = (evidence: Record<string, unknown>) => {
    const entries = Object.entries(evidence).slice(0, 4)
    if (!entries.length) {
        return 'Sin evidencia adicional.'
    }

    return entries
        .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
        .join(' · ')
}

const insightSort = (left: AnalyticsInsight, right: AnalyticsInsight) =>
    (right.score ?? 0) - (left.score ?? 0) || (right.confidence ?? 0) - (left.confidence ?? 0)

const historySort = (left: AnalyticsInsightHistory, right: AnalyticsInsightHistory) =>
    right.createdAt.localeCompare(left.createdAt)

const AnalyticsInsightsPage = () => {
    const { loading, refreshing, error, data, reload } = useAnalyticsInsightsData()
    const [recomputing, setRecomputing] = useState(false)

    const bundleInsights = useMemo(
        () => [...(data.bundle?.insights ?? [])].sort(insightSort),
        [data.bundle?.insights],
    )
    const alerts = data.bundle?.alerts ?? []
    const opportunities = useMemo(
        () => [...(data.opportunities?.opportunities ?? [])].sort(insightSort),
        [data.opportunities?.opportunities],
    )
    const history = useMemo(
        () => [...data.history].sort(historySort),
        [data.history],
    )

    const summary = data.summary?.summary ?? data.bundle?.summary ?? 'Sin resumen disponible.'
    const summaryOrigin = data.summary?.generatedBy ?? data.bundle?.generatedBy ?? null
    const summaryOriginReason = data.summary?.generationReason ?? data.bundle?.generationReason ?? null
    const quality = data.bundle?.quality ?? data.summary?.quality ?? null
    const topInsight = data.summary?.topInsight ?? bundleInsights[0] ?? null
    const periodRange = data.summary?.periodRange ?? data.bundle?.periodRange ?? null
    const generatedAt = data.summary?.generatedAt ?? data.bundle?.generatedAt ?? null
    const measurement = data.summary?.measurement ?? data.bundle?.measurement ?? null
    const trust = data.summary?.trust ?? data.bundle?.trust ?? null
    const freshness = data.summary?.freshness ?? data.bundle?.freshness ?? null
    const prioritizedActions = data.summary?.prioritizedActions ?? data.bundle?.prioritizedActions ?? []

    const qualityHighlights = [
        `Conexiones: ${quality?.connections?.length ?? 0}`,
        `Sync runs: ${quality?.syncRuns?.length ?? 0}`,
        `Reconciliaciones: ${quality?.reconciliations?.length ?? 0}`,
        `Checks de calidad: ${quality?.dataQualityChecks?.length ?? 0}`,
    ]

    const handleRecompute = async () => {
        setRecomputing(true)
        try {
            await apiRecomputeAnalyticsInsights<{ summary: string }>()
            toast.push(
                <Notification title="Insights recalculados" type="success">
                    Se persistió un nuevo historial de insights y resumen ejecutivo.
                </Notification>,
                { placement: 'top-end' },
            )
            await reload()
        } catch (recomputeError) {
            console.error(recomputeError)
            toast.push(
                <Notification title="No fue posible recalcular" type="danger">
                    Revisá la conectividad de las tablas normalizadas y probá de nuevo.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setRecomputing(false)
        }
    }

    return (
        <AnalyticsPageLayout
            title="Insights IA"
            subtitle="Resumen ejecutivo, oportunidades priorizadas y historial trazable sobre métricas normalizadas."
            showControls={false}
        >
            <Loading loading={loading}>
                <div className="flex flex-col gap-4">
                    <Card>
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                        content="normalized analytics"
                                        innerClass="bg-indigo-100 text-indigo-700"
                                    />
                                    <Badge
                                        content={periodRange ? formatRange(periodRange.current) : 'last 14 days'}
                                        innerClass="bg-slate-100 text-slate-700"
                                    />
                                    <Badge
                                        content={`${bundleInsights.length} insights`}
                                        innerClass="bg-emerald-100 text-emerald-700"
                                    />
                                </div>
                                <div>
                                    <h4 className="mb-1">Capa semántica de IA</h4>
                                    <p className="max-w-4xl text-sm text-gray-600">
                                        La IA lee métricas normalizadas, calidad de datos y comparación temporal.
                                        No usa raw events ni CSV manual como verdad operativa.
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                    {qualityHighlights.map((item) => (
                                        <span key={item}>{item}</span>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge
                                        content={
                                            measurement?.conversionMeasurementReady
                                                ? 'conversion_measurement_ready=true'
                                                : 'conversion_measurement_ready=false'
                                        }
                                        innerClass={
                                            measurement?.conversionMeasurementReady
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-amber-100 text-amber-700'
                                        }
                                    />
                                    <Badge
                                        content={`quality=${measurement?.qualityStatus ?? 'n/a'}`}
                                        innerClass={
                                            measurement?.qualityStatus === 'error'
                                                ? 'bg-rose-100 text-rose-700'
                                                : measurement?.qualityStatus === 'warning'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-emerald-100 text-emerald-700'
                                        }
                                    />
                                    <Badge
                                        content={`trust=${trust?.status ?? 'n/a'}`}
                                        innerClass={
                                            trust?.status === 'fail'
                                                ? 'bg-rose-100 text-rose-700'
                                                : trust?.status === 'warning'
                                                    ? 'bg-amber-100 text-amber-700'
                                                    : 'bg-emerald-100 text-emerald-700'
                                        }
                                    />
                                    <Badge
                                        content={`confidence=${Math.round((data.summary?.confidence ?? data.bundle?.confidence ?? 0) * 100)}%`}
                                        innerClass="bg-slate-100 text-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    variant="solid"
                                    onClick={() => void handleRecompute()}
                                    loading={recomputing}
                                >
                                    Recalcular insights
                                </Button>
                                <Button
                                    size="sm"
                                    variant="plain"
                                    onClick={() => void reload()}
                                    disabled={refreshing}
                                >
                                    {refreshing ? 'Actualizando' : 'Actualizar'}
                                </Button>
                            </div>
                        </div>
                    </Card>

                    <div className="grid gap-4 xl:grid-cols-3">
                        <Card className="xl:col-span-2">
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h5 className="mb-1">Resumen ejecutivo</h5>
                                    <p className="text-sm text-gray-500">
                                        {generatedAt ? `Generado ${formatDateTime(generatedAt)}` : 'Generado en tiempo real'}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Badge
                                        content={originLabel(summaryOrigin)}
                                        innerClass={originTone(summaryOrigin)}
                                    />
                                    {topInsight ? (
                                        <Badge
                                            content={topInsight.insightType ?? 'insight'}
                                            innerClass={typeTone(topInsight.insightType)}
                                        />
                                    ) : null}
                                </div>
                            </div>
                            <p className="text-sm leading-6 text-gray-700 dark:text-gray-300">
                                {summary}
                            </p>
                            {summaryOriginReason ? (
                                <p className="mt-2 text-xs text-gray-500">
                                    {summaryOriginReason}
                                </p>
                            ) : null}
                            {topInsight ? (
                                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-700/40">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="font-semibold">{topInsight.title}</div>
                                        <Badge
                                            content={topInsight.impact}
                                            innerClass={impactTone(topInsight.impact)}
                                        />
                                        <Badge
                                            content={`conf ${Math.round((topInsight.confidence ?? 0) * 100)}%`}
                                            innerClass="bg-slate-100 text-slate-700"
                                        />
                                    </div>
                                    <p className="mt-2 text-sm text-gray-600">
                                        {topInsight.description}
                                    </p>
                                    <p className="mt-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                                        Recomendación: {topInsight.recommendation}
                                    </p>
                                </div>
                            ) : null}
                        </Card>

                        <Card>
                            <div className="mb-4">
                                <h5 className="mb-1">Calidad y comparativa</h5>
                                <p className="text-sm text-gray-500">
                                    El análisis prioriza señal con evidencia y penaliza gaps de baseline.
                                </p>
                            </div>
                            <div className="space-y-3 text-sm text-gray-600">
                                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-700/40">
                                    <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Período</div>
                                    <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                                        {periodRange ? formatRange(periodRange.current) : 'n/a'}
                                    </div>
                                </div>
                                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-700/40">
                                    <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Período previo</div>
                                    <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                                        {periodRange ? formatRange(periodRange.previous) : 'n/a'}
                                    </div>
                                </div>
                                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-700/40">
                                    <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Alertas</div>
                                    <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                                        {alerts.length} señales críticas
                                    </div>
                                </div>
                                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-700/40">
                                    <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Data trust</div>
                                    <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                                        {trust ? trust.summary : 'Sin señal de trust'}
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        {trust?.updatedAt ? `Actualizado ${formatDateTime(trust.updatedAt)}` : 'Sin actualización reciente'}
                                    </div>
                                </div>
                                <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-700/40">
                                    <div className="text-xs uppercase tracking-[0.18em] text-gray-500">Freshness</div>
                                    <div className="mt-1 font-medium text-gray-900 dark:text-gray-100">
                                        Sync lag: {freshness?.syncLagMinutes ?? 'n/a'} min
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        Report lag: {freshness?.reportLagMinutes ?? 'n/a'} min
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>

                    <div className="grid gap-4 xl:grid-cols-2">
                        <Card>
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <div>
                                    <h5 className="mb-1">Insights priorizados</h5>
                                    <p className="text-sm text-gray-500">
                                        Ordenados por impacto, volumen, variación, confianza y facilidad de acción.
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {bundleInsights.length ? (
                                    bundleInsights.map((insight) => (
                                        <div
                                            key={`${insight.title}-${insight.metric}-${insight.segment ?? 'global'}`}
                                            className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-3">
                                                <div>
                                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                                        {insight.title}
                                                    </div>
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        {insight.metric}
                                                        {insight.segment ? ` · ${insight.segment}` : ''}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Badge
                                                        content={insight.category ?? 'business_issue'}
                                                        innerClass={typeTone(insight.category)}
                                                    />
                                                    <Badge
                                                        content={insight.source ?? 'mixed'}
                                                        innerClass={sourceTone(insight.source)}
                                                    />
                                                    <Badge
                                                        content={insight.impact}
                                                        innerClass={impactTone(insight.impact)}
                                                    />
                                                </div>
                                            </div>
                                            <p className="mt-2 text-sm text-gray-600">
                                                {insight.description}
                                            </p>
                                            <p className="mt-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                                                {insight.recommendation}
                                            </p>
                                            <div className="mt-3 text-xs text-gray-500">
                                                Score {insight.score?.toFixed(2) ?? 'n/a'} · Confianza{' '}
                                                {Math.round((insight.confidence ?? 0) * 100)}%
                                            </div>
                                            <div className="mt-2 text-xs text-gray-500">
                                                {formatEvidence(insight.evidence)}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-gray-700/40">
                                        No hay insights activos para este período.
                                    </div>
                                )}
                            </div>
                        </Card>

                        <Card>
                            <div className="mb-4">
                                <h5 className="mb-1">Acciones priorizadas</h5>
                                <p className="text-sm text-gray-500">
                                    Traducción directa de los hallazgos en próximos pasos.
                                </p>
                            </div>
                            <div className="space-y-3">
                                {prioritizedActions.length ? (
                                    prioritizedActions.map((action, index) => (
                                        <div
                                            key={`${action.action}-${index}`}
                                            className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-700/40"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <div className="font-medium">{action.action}</div>
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        {action.why}
                                                    </div>
                                                </div>
                                                <Badge
                                                    content={action.expectedImpact}
                                                    innerClass={impactTone(action.expectedImpact)}
                                                />
                                            </div>
                                            <div className="mt-2 text-xs text-gray-500">
                                                Confianza {Math.round(action.confidence * 100)}%
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-gray-700/40">
                                        No hay acciones priorizadas todavía.
                                    </div>
                                )}
                            </div>
                        </Card>

                        <div className="flex flex-col gap-4">
                            <Card>
                                <div className="mb-4">
                                    <h5 className="mb-1">Oportunidades accionables</h5>
                                    <p className="text-sm text-gray-500">
                                        Segmentos que pueden mover revenue, conversión o costo.
                                    </p>
                                </div>
                                <div className="space-y-3">
                                    {opportunities.length ? (
                                        opportunities.slice(0, 5).map((insight) => (
                                            <div
                                                key={`opp-${insight.title}-${insight.metric}-${insight.segment ?? 'global'}`}
                                                className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-700/40"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <div className="font-medium">{insight.title}</div>
                                                        <div className="mt-1 text-xs text-gray-500">
                                                            {insight.segment ?? 'global'} · {insight.metric}
                                                        </div>
                                                    </div>
                                                    <Badge
                                                        content={insight.impact}
                                                        innerClass={impactTone(insight.impact)}
                                                    />
                                                </div>
                                                <div className="mt-2 text-sm text-gray-600">
                                                    {insight.recommendation}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-gray-700/40">
                                            No hay oportunidades priorizadas para este rango.
                                        </div>
                                    )}
                                </div>
                            </Card>

                            <Card>
                                <div className="mb-4">
                                    <h5 className="mb-1">Historial reciente</h5>
                                    <p className="text-sm text-gray-500">
                                        Últimas corridas persistidas en `analytics_insights_history`.
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    {history.length ? (
                                        history.slice(0, 8).map((entry) => (
                                            <div
                                                key={entry.id}
                                                className="rounded-xl border border-gray-200 bg-white px-4 py-3 dark:border-gray-700 dark:bg-gray-800"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="font-medium">{entry.title}</div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Badge
                                                            content={entry.insightType}
                                                            innerClass={typeTone(entry.insightType)}
                                                        />
                                                        <Badge
                                                            content={entry.impact}
                                                            innerClass={impactTone(entry.impact)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="mt-1 text-xs text-gray-500">
                                                    {formatDateTime(entry.createdAt)} · {formatRange(entry.periodRange.current)}
                                                </div>
                                                <div className="mt-2 text-sm text-gray-600">
                                                    {entry.summary ?? entry.description}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-500 dark:bg-gray-700/40">
                                            No hay historial persistido todavía.
                                        </div>
                                    )}
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>

                {error ? (
                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                        {error}
                    </div>
                ) : null}
            </Loading>
        </AnalyticsPageLayout>
    )
}

export default AnalyticsInsightsPage

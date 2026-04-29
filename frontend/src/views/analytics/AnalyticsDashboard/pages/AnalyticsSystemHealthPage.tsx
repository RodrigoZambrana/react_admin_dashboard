import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Loading from '@/components/shared/Loading'

import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import { useAnalyticsSystemHealthData } from '../hooks/useAnalyticsSystemHealthData'

const statusTone = (status?: string | null) => {
    switch (status) {
        case 'ok':
            return 'bg-emerald-100 text-emerald-700'
        case 'warning':
            return 'bg-amber-100 text-amber-700'
        case 'fail':
            return 'bg-rose-100 text-rose-700'
        default:
            return 'bg-gray-100 text-gray-700'
    }
}

const componentLabel: Record<string, string> = {
    queue: 'Queue',
    sync: 'Sync',
    ingestion: 'Ingestion',
    attribution: 'Attribution',
    meta: 'Meta',
    data_trust: 'Data Trust',
    data_parity: 'Data Parity',
    exports: 'Exports',
}

const formatDateTime = (value: string | null | undefined) => {
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

const formatDetails = (details: Record<string, unknown>) => {
    const entries = Object.entries(details).slice(0, 4)
    if (!entries.length) {
        return 'Sin detalles adicionales.'
    }

    return entries
        .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`)
        .join(' · ')
}

const AnalyticsSystemHealthPage = () => {
    const { loading, refreshing, error, data, reload } = useAnalyticsSystemHealthData()

    const overview = data.overview
    const status = data.status?.status ?? overview?.status ?? 'warning'
    const environment = data.status?.environment ?? overview?.environment ?? 'unknown'
    const updatedAt = data.status?.updatedAt ?? overview?.updatedAt ?? null
    const degraded = overview?.degraded ?? false
    const components = overview?.components ?? {
        queue: null,
        sync: null,
        ingestion: null,
        attribution: null,
        meta: null,
        data_trust: null,
        data_parity: null,
        exports: null,
    }
    const lastChecks = overview?.lastChecks ?? []
    const history = data.history.length ? data.history : overview?.history ?? []
    const dataTrust = data.dataTrust

    const componentEntries = Object.entries(components).map(([key, value]) => ({
        key,
        label: componentLabel[key] ?? key,
        status: value,
    }))

    if (loading) {
        return (
            <AnalyticsPageLayout
                title="Salud del sistema"
                subtitle="Estado operativo del pipeline de analytics."
            >
                <div className="py-10">
                    <Loading loading={true} />
                </div>
            </AnalyticsPageLayout>
        )
    }

    return (
        <AnalyticsPageLayout
            title="Salud del sistema"
            subtitle="Visibilidad rápida del estado real de analytics, sin entrar a logs."
            showControls={false}
        >
            <div className="flex flex-col gap-4">
                <Card>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge content={`analytics: ${status}`} innerClass={statusTone(status)} />
                                <Badge
                                    content={degraded ? 'degraded' : 'healthy'}
                                    innerClass={degraded ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}
                                />
                                <Badge
                                    content={environment}
                                    innerClass="bg-slate-100 text-slate-700"
                                />
                            </div>
                            <div>
                                <h4 className="mb-1">Estado operativo del sistema</h4>
                                <p className="max-w-3xl text-sm text-gray-600">
                                    {overview?.summary ?? 'Sin checks recientes registrados.'}
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2 text-sm text-gray-600">
                            <div>
                                <span className="font-medium text-gray-800">Actualizado:</span>{' '}
                                {formatDateTime(updatedAt)}
                            </div>
                            <div>
                                <span className="font-medium text-gray-800">Estado resumido:</span>{' '}
                                {data.status?.status ?? overview?.status ?? 'warning'}
                            </div>
                            {refreshing ? (
                                <div className="text-xs text-gray-500">Refrescando información...</div>
                            ) : null}
                        </div>
                    </div>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                    {componentEntries.map((entry) => (
                        <Card key={entry.key}>
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                                {entry.label}
                            </div>
                            <div className="mt-3">
                                <Badge
                                    content={entry.status ?? 'n/a'}
                                    innerClass={statusTone(entry.status)}
                                />
                            </div>
                        </Card>
                    ))}
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                    <Card>
                        <div className="mb-4">
                            <h5 className="mb-1">Últimos checks</h5>
                            <p className="text-sm text-gray-500">
                                Último run del health pipeline con detalle por componente.
                            </p>
                        </div>
                        <div className="space-y-3">
                            {lastChecks.length ? (
                                lastChecks.map((check) => (
                                    <div
                                        key={check.name}
                                        className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="font-medium text-gray-900 dark:text-gray-100">
                                                {check.name}
                                            </div>
                                            <Badge
                                                content={check.status}
                                                innerClass={statusTone(check.status)}
                                            />
                                        </div>
                                        <div className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-400">
                                            severity: {check.severity}
                                        </div>
                                        <div className="mt-2 text-sm text-gray-600">
                                            {formatDetails(check.details)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-gray-500">
                                    Todavía no hay checks registrados.
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card>
                        <div className="mb-4">
                            <h5 className="mb-1">Histórico reciente</h5>
                            <p className="text-sm text-gray-500">
                                Secuencia corta para detectar degradaciones, warnings repetidos y fallos.
                            </p>
                        </div>
                        <div className="space-y-3">
                            {history.length ? (
                                history.slice(0, 10).map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="rounded-xl bg-gray-50 p-3 dark:bg-gray-700/40"
                                    >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                                {formatDateTime(entry.createdAt)}
                                            </div>
                                            <Badge
                                                content={entry.status}
                                                innerClass={statusTone(entry.status)}
                                            />
                                        </div>
                                        <div className="mt-2 text-sm text-gray-600">{entry.summary}</div>
                                        <div className="mt-2 text-xs text-gray-500">
                                            Duración: {entry.durationMs} ms · Checks: {entry.checks.length}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-sm text-gray-500">
                                    Sin histórico disponible.
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                <Card>
                    <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <h5 className="mb-1">Data Trust Status</h5>
                            <p className="text-sm text-gray-500">
                                Validación de cobertura, conversión, atribución y coherencia entre fuentes.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Badge
                                content={dataTrust?.status ?? 'warning'}
                                innerClass={statusTone(dataTrust?.status)}
                            />
                            <Badge
                                content={dataTrust?.trend.direction ?? 'flat'}
                                innerClass="bg-slate-100 text-slate-700"
                            />
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {(dataTrust?.checks ?? []).map((check) => (
                            <div
                                key={check.check}
                                className="rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                        {check.check}
                                    </div>
                                    <Badge
                                        content={check.status}
                                        innerClass={statusTone(check.status)}
                                    />
                                </div>
                                <div className="mt-2 text-sm text-gray-600">{check.expected}</div>
                                <div className="mt-1 text-xs text-gray-500">
                                    Valor: {check.value ?? 'n/a'} · Impacto: {check.impact}
                                </div>
                                <div className="mt-2 text-sm text-gray-600">
                                    {formatDetails(check.details)}
                                </div>
                            </div>
                        ))}
                    </div>

                    {dataTrust ? (
                        <div className="mt-4 rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-700/40">
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                                Tendencia básica
                            </div>
                            <div className="mt-1">
                                {dataTrust.trend.direction} · current {dataTrust.trend.currentValue} · previous{' '}
                                {dataTrust.trend.previousValue}
                                {dataTrust.trend.deltaPct !== null ? ` · delta ${dataTrust.trend.deltaPct}%` : ''}
                            </div>
                            <div className="mt-2">
                                {dataTrust.summary}
                            </div>
                        </div>
                    ) : (
                        <div className="mt-4 text-sm text-gray-500">
                            Todavía no hay señal de data trust disponible.
                        </div>
                    )}
                </Card>

                {error ? (
                    <Card>
                        <div className="text-sm text-rose-700">{error}</div>
                        <button
                            type="button"
                            onClick={() => void reload()}
                            className="mt-3 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white"
                        >
                            Reintentar
                        </button>
                    </Card>
                ) : null}
            </div>
        </AnalyticsPageLayout>
    )
}

export default AnalyticsSystemHealthPage

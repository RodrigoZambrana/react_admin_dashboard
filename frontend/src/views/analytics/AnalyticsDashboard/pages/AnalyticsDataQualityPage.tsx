import { useMemo, useState } from 'react'

import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Loading from '@/components/shared/Loading'
import toast from '@/components/ui/toast'
import Notification from '@/components/ui/Notification'

import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import { useAnalyticsOperationsData } from '../hooks/useAnalyticsOperationsData'
import { useAnalyticsDataQualityData } from '../hooks/useAnalyticsDataQualityData'
import {
    apiRunGa4BaselineSync,
    apiRunGa4DataQuality,
    apiRunGa4ReportSync,
} from '@/services/AnalyticsService'

const statusTone = (status: string) => {
    switch (status) {
        case 'ok':
        case 'aligned':
            return 'bg-emerald-100 text-emerald-700'
        case 'warning':
        case 'partial':
            return 'bg-amber-100 text-amber-700'
        case 'error':
        case 'gap':
            return 'bg-rose-100 text-rose-700'
        case 'missing_baseline':
        case 'missing':
            return 'bg-slate-200 text-slate-700'
        default:
            return 'bg-gray-100 text-gray-700'
    }
}

const formatDateTime = (value: string | null) => {
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

const AnalyticsDataQualityPage = () => {
    const { data: operationsData, reload: reloadOperations } = useAnalyticsOperationsData()
    const { loading, error, data, reload } = useAnalyticsDataQualityData()
    const [syncing, setSyncing] = useState(false)
    const [baselineing, setBaselineing] = useState(false)
    const [checking, setChecking] = useState(false)

    const ga4Connection = useMemo(
        () => operationsData.connections.find((connection) => connection.source === 'ga4') ?? null,
        [operationsData.connections],
    )

    const latestSummary = data.summaries[0] ?? null

    const latestChecks = useMemo(
        () => [...data.checks].sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 12),
        [data.checks],
    )

    const handleRunSync = async () => {
        if (!ga4Connection?.id) {
            return
        }

        setSyncing(true)
        try {
            await apiRunGa4ReportSync(ga4Connection.id)
            toast.push(
                <Notification title="Sincronización GA4 iniciada" type="success">
                    Se disparó el sync directo por API.
                </Notification>,
                { placement: 'top-end' },
            )
            await Promise.all([reload(), reloadOperations()])
        } catch (syncError) {
            console.error(syncError)
            toast.push(
                <Notification title="No fue posible sincronizar GA4" type="danger">
                    Revisá la conexión y la property seleccionada.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setSyncing(false)
        }
    }

    const handleRunBaseline = async () => {
        if (!ga4Connection?.id) {
            return
        }

        setBaselineing(true)
        try {
            await apiRunGa4BaselineSync(ga4Connection.id)
            toast.push(
                <Notification title="Baseline GA4 generado" type="success">
                    Se persistieron snapshots reproducibles desde la API.
                </Notification>,
                { placement: 'top-end' },
            )
            await Promise.all([reload(), reloadOperations()])
        } catch (baselineError) {
            console.error(baselineError)
            toast.push(
                <Notification title="No fue posible generar baseline" type="danger">
                    Revisá la conexión GA4 y la property seleccionada.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setBaselineing(false)
        }
    }

    const handleRunQuality = async () => {
        if (!ga4Connection?.id) {
            return
        }

        setChecking(true)
        try {
            await apiRunGa4DataQuality(ga4Connection.id)
            toast.push(
                <Notification title="Data quality recalculada" type="success">
                    Se comparó baseline API contra sync directo.
                </Notification>,
                { placement: 'top-end' },
            )
            await Promise.all([reload(), reloadOperations()])
        } catch (qualityError) {
            console.error(qualityError)
            toast.push(
                <Notification title="No fue posible recalcular quality" type="danger">
                    Revisá que exista baseline API y sync GA4.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setChecking(false)
        }
    }

    if (loading) {
        return (
            <AnalyticsPageLayout title="Data Quality" subtitle="Carga de validación baseline vs sync.">
                <div className="py-10">
                    <Loading loading={true} />
                </div>
            </AnalyticsPageLayout>
        )
    }

    const okCount = data.checks.filter((entry) => entry.status === 'ok').length
    const warningCount = data.checks.filter((entry) => entry.status === 'warning').length
    const errorCount = data.checks.filter((entry) => entry.status === 'error').length
    const missingCount = data.checks.filter((entry) => entry.status === 'missing_baseline').length

    return (
        <AnalyticsPageLayout
            title="Data Quality"
            subtitle="Baseline reproducible desde GA4 API versus datos sincronizados. El CSV quedó como referencia secundaria."
        >
            <div className="flex flex-col gap-4">
                <Card>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <Badge
                                    content="API baseline / sync"
                                    innerClass="bg-indigo-100 text-indigo-700"
                                />
                                <Badge
                                    content={`${data.baselineSnapshots.length} snapshots`}
                                    innerClass="bg-slate-100 text-slate-700"
                                />
                                {ga4Connection ? (
                                    <Badge
                                        content={ga4Connection.status}
                                        innerClass={statusTone(ga4Connection.status)}
                                    />
                                ) : null}
                            </div>
                            <div>
                                <h4 className="mb-1">Baseline reproducible y data quality</h4>
                                <p className="text-sm text-gray-600">
                                    La validación canónica corre contra la GA4 API. Esta vista muestra cobertura,
                                    delta y alertas sobre snapshots persistidos.
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                size="sm"
                                variant="solid"
                                onClick={() => void handleRunSync()}
                                loading={syncing}
                                disabled={!ga4Connection?.id}
                            >
                                Sincronizar GA4
                            </Button>
                            <Button
                                size="sm"
                                variant="twoTone"
                                onClick={() => void handleRunBaseline()}
                                loading={baselineing}
                                disabled={!ga4Connection?.id}
                            >
                                Generar baseline
                            </Button>
                            <Button
                                size="sm"
                                variant="default"
                                onClick={() => void handleRunQuality()}
                                loading={checking}
                                disabled={!ga4Connection?.id}
                            >
                                Recalcular quality
                            </Button>
                        </div>
                    </div>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            OK
                        </div>
                        <div className="mt-2 text-3xl font-semibold">{okCount}</div>
                    </Card>
                    <Card>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Warning
                        </div>
                        <div className="mt-2 text-3xl font-semibold">{warningCount}</div>
                    </Card>
                    <Card>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Error
                        </div>
                        <div className="mt-2 text-3xl font-semibold">{errorCount}</div>
                    </Card>
                    <Card>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Missing baseline
                        </div>
                        <div className="mt-2 text-3xl font-semibold">{missingCount}</div>
                    </Card>
                </div>

                {error ? (
                    <Card>
                        <div className="text-sm text-red-600">{error}</div>
                    </Card>
                ) : null}

                <Card>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h5 className="mb-1">Resumen por reporte</h5>
                            <p className="text-sm text-gray-500">
                                Cada fila compara snapshots baseline contra la última sync directa disponible.
                            </p>
                        </div>
                        <Badge
                            content={`${data.summaries.length} reportes`}
                            innerClass="bg-slate-100 text-slate-700"
                        />
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 text-left text-xs uppercase tracking-[0.14em] text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Reporte</th>
                                    <th className="px-4 py-3">Checks</th>
                                    <th className="px-4 py-3">Cobertura</th>
                                    <th className="px-4 py-3">Delta prom.</th>
                                    <th className="px-4 py-3">Última validación</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {data.summaries.map((summary) => (
                                    <tr key={summary.reportKey} className="bg-white">
                                        <td className="px-4 py-3 font-medium text-gray-900">
                                            {summary.reportKey}
                                        </td>
                                        <td className="px-4 py-3">
                                            {summary.okCount + summary.warningCount + summary.errorCount + summary.missingBaselineCount}
                                        </td>
                                        <td className="px-4 py-3">
                                            {summary.coveragePercent.toFixed(2)}%
                                        </td>
                                        <td className="px-4 py-3">{summary.averageDiffPercent.toFixed(4)}%</td>
                                        <td className="px-4 py-3">{formatDateTime(summary.lastCheckedAt)}</td>
                                    </tr>
                                ))}
                                {!data.summaries.length ? (
                                    <tr>
                                        <td className="px-4 py-5 text-gray-500" colSpan={5}>
                                            Todavía no hay validaciones persistidas.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </Card>

                {latestSummary ? (
                    <Card>
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h5 className="mb-1">Última validación</h5>
                                <p className="text-sm text-gray-500">
                                    Estado más reciente persistido en la tabla de quality checks.
                                </p>
                            </div>
                            <Badge
                                content={latestSummary.reportKey}
                                innerClass="bg-indigo-100 text-indigo-700"
                            />
                        </div>

                        <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50 text-left text-xs uppercase tracking-[0.14em] text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3">Métrica</th>
                                        <th className="px-4 py-3">Baseline</th>
                                        <th className="px-4 py-3">Sync</th>
                                        <th className="px-4 py-3">Diff %</th>
                                        <th className="px-4 py-3">Estado</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {latestChecks.map((check) => (
                                        <tr key={check.id} className="bg-white">
                                            <td className="px-4 py-3">{formatDateTime(check.date)}</td>
                                            <td className="px-4 py-3 font-medium text-gray-900">
                                                {check.metricName}
                                            </td>
                                            <td className="px-4 py-3">{check.baselineValue}</td>
                                            <td className="px-4 py-3">{check.syncedValue}</td>
                                            <td className="px-4 py-3">
                                                {check.diffPercent.toFixed(4)}%
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge
                                                    content={check.status}
                                                    innerClass={statusTone(check.status)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                    {!latestChecks.length ? (
                                        <tr>
                                            <td className="px-4 py-5 text-gray-500" colSpan={6}>
                                                No hay checks persistidos todavía.
                                            </td>
                                        </tr>
                                    ) : null}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                ) : null}
            </div>
        </AnalyticsPageLayout>
    )
}

export default AnalyticsDataQualityPage

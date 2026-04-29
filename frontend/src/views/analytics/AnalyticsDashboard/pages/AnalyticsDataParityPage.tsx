import { useMemo } from 'react'

import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'

import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import { useAnalyticsDataParityData } from '../hooks/useAnalyticsDataParityData'

const statusTone = (status: string) => {
    switch (status) {
        case 'ok':
        case 'aligned':
            return 'bg-emerald-100 text-emerald-700'
        case 'warning':
        case 'degraded':
            return 'bg-amber-100 text-amber-700'
        case 'fail':
        case 'mismatch':
            return 'bg-rose-100 text-rose-700'
        case 'missing':
            return 'bg-slate-200 text-slate-700'
        default:
            return 'bg-gray-100 text-gray-700'
    }
}

const severityTone = (severity: string) => {
    switch (severity) {
        case 'critical':
            return 'bg-rose-100 text-rose-700'
        case 'warning':
            return 'bg-amber-100 text-amber-700'
        default:
            return 'bg-slate-100 text-slate-700'
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

const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return 'n/a'
    }
    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 2,
    }).format(value)
}

const AnalyticsDataParityPage = () => {
    const { loading, error, data, reload } = useAnalyticsDataParityData()

    const parity = data.parity
    const usage = data.usage

    const bySourceRows = useMemo(
        () =>
            parity
                ? [
                      ...parity.bySource.ga4,
                      ...parity.bySource.ads,
                      ...parity.bySource.search_console,
                  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt))
                : [],
        [parity],
    )

    const baselineRows = parity?.baselineChecks ?? []
    const anomalies = parity?.anomalies ?? []
    const requestsByDay = usage?.requestsByDay ?? []
    const unusedEndpoints = usage?.unusedEndpoints ?? []
    const endpointUsage = usage?.endpoints ?? []

    if (loading) {
        return (
            <AnalyticsPageLayout
                title="Data Parity"
                subtitle="Paridad entre exports de referencia, snapshots API y uso real del sistema."
            >
                <div className="py-10">
                    <Loading loading={true} />
                </div>
            </AnalyticsPageLayout>
        )
    }

    const summary = parity?.summary ?? { aligned: 0, warning: 0, mismatch: 0, missing: 0, total: 0 }
    const overallStatus = parity?.overallStatus ?? 'degraded'
    const dataTrustTone =
        overallStatus === 'ok'
            ? 'bg-emerald-100 text-emerald-700'
            : overallStatus === 'degraded'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-rose-100 text-rose-700'

    return (
        <AnalyticsPageLayout
            title="Data Parity"
            subtitle="Valida coherencia entre API, import CSV y export canónico, además de medir uso real."
        >
            <div className="flex flex-col gap-4">
                <Card>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge content={overallStatus} innerClass={dataTrustTone} />
                                <Badge
                                    content={`total ${summary.total}`}
                                    innerClass="bg-slate-100 text-slate-700"
                                />
                                <Badge
                                    content={`última corrida ${formatDateTime(parity?.lastRunAt ?? null)}`}
                                    innerClass="bg-indigo-100 text-indigo-700"
                                />
                            </div>
                            <div>
                                <h4 className="mb-1">Paridad operativa</h4>
                                <p className="text-sm text-gray-600">
                                    El dashboard compara snapshots importados, datos persistidos por API y exports
                                    canónicos. También muestra anomalías y uso real de endpoints.
                                </p>
                            </div>
                        </div>
                        <Button size="sm" variant="solid" onClick={() => void reload()}>
                            Recargar
                        </Button>
                    </div>
                </Card>

                {error ? (
                    <Card>
                        <Notification title="No fue posible cargar la paridad" type="danger">
                            {error}
                        </Notification>
                    </Card>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Aligned
                        </div>
                        <div className="mt-2 text-3xl font-semibold">{summary.aligned}</div>
                    </Card>
                    <Card>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Warning
                        </div>
                        <div className="mt-2 text-3xl font-semibold">{summary.warning}</div>
                    </Card>
                    <Card>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Mismatch
                        </div>
                        <div className="mt-2 text-3xl font-semibold">{summary.mismatch}</div>
                    </Card>
                    <Card>
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Missing
                        </div>
                        <div className="mt-2 text-3xl font-semibold">{summary.missing}</div>
                    </Card>
                </div>

                <Card>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h5 className="mb-1">Baseline checker</h5>
                            <p className="text-sm text-gray-500">
                                API, import CSV y export canónico por fecha, fuente y métrica.
                            </p>
                        </div>
                        <Badge
                            content={`${baselineRows.length} filas`}
                            innerClass="bg-slate-100 text-slate-700"
                        />
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 text-left text-xs uppercase tracking-[0.14em] text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Fuente</th>
                                    <th className="px-4 py-3">Métrica</th>
                                    <th className="px-4 py-3">API</th>
                                    <th className="px-4 py-3">Import</th>
                                    <th className="px-4 py-3">Export</th>
                                    <th className="px-4 py-3">Diff %</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Snapshot group</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {baselineRows.map((row) => (
                                    <tr key={`${row.snapshotGroup}:${row.source}:${row.metric}:${row.date}`} className="bg-white">
                                        <td className="px-4 py-3">{row.date.slice(0, 10)}</td>
                                        <td className="px-4 py-3 uppercase text-gray-600">{row.source}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{row.metric}</td>
                                        <td className="px-4 py-3">{formatNumber(row.apiValue)}</td>
                                        <td className="px-4 py-3">{formatNumber(row.importValue)}</td>
                                        <td className="px-4 py-3">{formatNumber(row.exportValue)}</td>
                                        <td className="px-4 py-3">{formatNumber(row.diffPercent)}%</td>
                                        <td className="px-4 py-3">
                                            <Badge content={row.status} innerClass={statusTone(row.status)} />
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{row.snapshotGroup}</td>
                                    </tr>
                                ))}
                                {!baselineRows.length ? (
                                    <tr>
                                        <td className="px-4 py-5 text-gray-500" colSpan={9}>
                                            Todavía no hay filas de baseline comparadas.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h5 className="mb-1">Paridad por fuente</h5>
                            <p className="text-sm text-gray-500">
                                Checks persistidos por fuente y métrica, derivados de la comparación histórica.
                            </p>
                        </div>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 text-left text-xs uppercase tracking-[0.14em] text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Fuente</th>
                                    <th className="px-4 py-3">Métrica</th>
                                    <th className="px-4 py-3">API</th>
                                    <th className="px-4 py-3">Baseline</th>
                                    <th className="px-4 py-3">Delta %</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Última corrida</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {bySourceRows.map((check) => (
                                    <tr key={check.id} className="bg-white">
                                        <td className="px-4 py-3 uppercase text-gray-600">{check.source}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{check.metric}</td>
                                        <td className="px-4 py-3">{formatNumber(check.apiValue)}</td>
                                        <td className="px-4 py-3">{formatNumber(check.baselineValue)}</td>
                                        <td className="px-4 py-3">{formatNumber(check.deltaPercent)}%</td>
                                        <td className="px-4 py-3">
                                            <Badge content={check.status} innerClass={statusTone(check.status)} />
                                        </td>
                                        <td className="px-4 py-3">{formatDateTime(check.createdAt)}</td>
                                    </tr>
                                ))}
                                {!bySourceRows.length ? (
                                    <tr>
                                        <td className="px-4 py-5 text-gray-500" colSpan={7}>
                                            Todavía no hay checks de paridad persistidos.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h5 className="mb-1">Uso real de endpoints</h5>
                            <p className="text-sm text-gray-500">
                                Requests, latencia y ratio de errores por endpoint analítico.
                            </p>
                        </div>
                        <Badge
                            content={`${endpointUsage.length} endpoints`}
                            innerClass="bg-slate-100 text-slate-700"
                        />
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <Card>
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                                Requests por día
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {requestsByDay.map((entry) => (
                                    <Badge
                                        key={entry.date}
                                        content={`${entry.date}: ${entry.calls}`}
                                        innerClass="bg-indigo-100 text-indigo-700"
                                    />
                                ))}
                                {!requestsByDay.length ? (
                                    <span className="text-sm text-gray-500">Sin datos.</span>
                                ) : null}
                            </div>
                        </Card>
                        <Card>
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                                Endpoints no usados
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                {unusedEndpoints.map((endpoint) => (
                                    <Badge
                                        key={endpoint}
                                        content={endpoint}
                                        innerClass="bg-slate-100 text-slate-700"
                                    />
                                ))}
                                {!unusedEndpoints.length ? (
                                    <span className="text-sm text-gray-500">Ninguno.</span>
                                ) : null}
                            </div>
                        </Card>
                        <Card>
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
                                Última actualización
                            </div>
                            <div className="mt-2 text-sm text-gray-700">
                                {formatDateTime(usage?.history?.[0]?.createdAt ?? null)}
                            </div>
                        </Card>
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 text-left text-xs uppercase tracking-[0.14em] text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Endpoint</th>
                                    <th className="px-4 py-3">Calls</th>
                                    <th className="px-4 py-3">Avg latency</th>
                                    <th className="px-4 py-3">Error rate</th>
                                    <th className="px-4 py-3">Último acceso</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {endpointUsage.map((entry) => (
                                    <tr key={entry.endpoint} className="bg-white">
                                        <td className="px-4 py-3 font-medium text-gray-900">{entry.endpoint}</td>
                                        <td className="px-4 py-3">{entry.calls}</td>
                                        <td className="px-4 py-3">{formatNumber(entry.avgLatency)} ms</td>
                                        <td className="px-4 py-3">{(entry.errorRate * 100).toFixed(2)}%</td>
                                        <td className="px-4 py-3">{formatDateTime(entry.lastCalledAt)}</td>
                                    </tr>
                                ))}
                                {!endpointUsage.length ? (
                                    <tr>
                                        <td className="px-4 py-5 text-gray-500" colSpan={5}>
                                            Todavía no hay uso registrado.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h5 className="mb-1">Anomalías detectadas</h5>
                            <p className="text-sm text-gray-500">
                                Gaps, mismatches y señales de silencio detectadas por la validación.
                            </p>
                        </div>
                        <Badge
                            content={`${anomalies.length} anomalías`}
                            innerClass="bg-slate-100 text-slate-700"
                        />
                    </div>

                    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 text-left text-xs uppercase tracking-[0.14em] text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Tipo</th>
                                    <th className="px-4 py-3">Fuente</th>
                                    <th className="px-4 py-3">Métrica</th>
                                    <th className="px-4 py-3">Severidad</th>
                                    <th className="px-4 py-3">Descripción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {anomalies.map((anomaly) => (
                                    <tr key={anomaly.id} className="bg-white">
                                        <td className="px-4 py-3">{formatDateTime(anomaly.detectedAt)}</td>
                                        <td className="px-4 py-3 uppercase text-gray-600">{anomaly.type}</td>
                                        <td className="px-4 py-3 uppercase text-gray-600">{anomaly.source}</td>
                                        <td className="px-4 py-3">{anomaly.metric ?? 'n/a'}</td>
                                        <td className="px-4 py-3">
                                            <Badge content={anomaly.severity} innerClass={severityTone(anomaly.severity)} />
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">{anomaly.description}</td>
                                    </tr>
                                ))}
                                {!anomalies.length ? (
                                    <tr>
                                        <td className="px-4 py-5 text-gray-500" colSpan={6}>
                                            No hay anomalías persistidas.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </Card>

                <Card>
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h5 className="mb-1">Histórico reciente</h5>
                            <p className="text-sm text-gray-500">
                                Últimos checks persistidos para auditoría y diagnóstico.
                            </p>
                        </div>
                        <Badge
                            content={`${parity?.history.length ?? 0} registros`}
                            innerClass="bg-slate-100 text-slate-700"
                        />
                    </div>
                    <div className="mt-4 overflow-hidden rounded-xl border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50 text-left text-xs uppercase tracking-[0.14em] text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Fecha</th>
                                    <th className="px-4 py-3">Fuente</th>
                                    <th className="px-4 py-3">Métrica</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Delta %</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {(parity?.history ?? []).map((check) => (
                                    <tr key={check.id} className="bg-white">
                                        <td className="px-4 py-3">{formatDateTime(check.createdAt)}</td>
                                        <td className="px-4 py-3 uppercase text-gray-600">{check.source}</td>
                                        <td className="px-4 py-3 font-medium text-gray-900">{check.metric}</td>
                                        <td className="px-4 py-3">
                                            <Badge content={check.status} innerClass={statusTone(check.status)} />
                                        </td>
                                        <td className="px-4 py-3">{formatNumber(check.deltaPercent)}%</td>
                                    </tr>
                                ))}
                                {!parity?.history.length ? (
                                    <tr>
                                        <td className="px-4 py-5 text-gray-500" colSpan={5}>
                                            Todavía no hay histórico reciente.
                                        </td>
                                    </tr>
                                ) : null}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </AnalyticsPageLayout>
    )
}

export default AnalyticsDataParityPage

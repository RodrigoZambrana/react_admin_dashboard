import { useCallback, useEffect, useMemo, useState } from 'react'

import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Card from '@/components/ui/Card'
import Notification from '@/components/ui/Notification'

import AnalyticsPageLayout from '../components/AnalyticsPageLayout'
import {
    apiExportAnalyticsCanonical,
    apiExportAnalyticsReport,
    apiGetAnalyticsExportRuns,
    type AnalyticsExportRun,
    type AnalyticsExportRunsResponse,
    type AnalyticsCanonicalExportSource,
    type AnalyticsReportExportName,
} from '@/services/AnalyticsService'

type ExportType = 'canonical' | 'report'

const todayUtc = () => new Date().toISOString().slice(0, 10)

const minusDays = (days: number) => {
    const date = new Date()
    date.setUTCDate(date.getUTCDate() - days)
    return date.toISOString().slice(0, 10)
}

const saveBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
}

const resolveFileName = (contentDisposition: string | null, fallback: string) => {
    if (!contentDisposition) {
        return fallback
    }
    const match = contentDisposition.match(/filename="?([^"]+)"?/i)
    return match?.[1] ?? fallback
}

const AnalyticsExportsPage = () => {
    const [exportType, setExportType] = useState<ExportType>('canonical')
    const [from, setFrom] = useState(minusDays(7))
    const [to, setTo] = useState(todayUtc())
    const [source, setSource] = useState<AnalyticsCanonicalExportSource>('all')
    const [report, setReport] = useState<AnalyticsReportExportName>('ga4_overview')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [historyLoading, setHistoryLoading] = useState(true)
    const [historyError, setHistoryError] = useState<string | null>(null)
    const [history, setHistory] = useState<AnalyticsExportRun[]>([])

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true)
        setHistoryError(null)
        try {
            const response = await apiGetAnalyticsExportRuns<AnalyticsExportRunsResponse>({
                limit: '20',
            })
            setHistory(response.data?.items ?? [])
        } catch (historyLoadError) {
            console.error(historyLoadError)
            setHistoryError('No fue posible cargar el historial de exports.')
            setHistory([])
        } finally {
            setHistoryLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadHistory()
    }, [loadHistory])

    const explanation = useMemo(() => {
        if (exportType === 'canonical') {
            return 'Canonical export: formato largo para auditoría, reconciliación y reimportación sin pérdida estructural.'
        }
        return 'Report export: formato más legible para consumo humano. No usar como clave estricta de reconciliación.'
    }, [exportType])

    const handleDownload = async () => {
        setLoading(true)
        setError(null)
        setSuccess(null)
        try {
            if (exportType === 'canonical') {
                const response = await apiExportAnalyticsCanonical({
                    from,
                    to,
                    source,
                    granularity: 'daily',
                })
                const filename = resolveFileName(
                    response.headers?.['content-disposition'] ?? null,
                    `analytics-canonical-${from}-${to}.csv`,
                )
                saveBlob(response.data, filename)
                setSuccess(`Export canonical generado: ${filename}`)
            } else {
                const response = await apiExportAnalyticsReport({
                    report,
                    from,
                    to,
                })
                const filename = resolveFileName(
                    response.headers?.['content-disposition'] ?? null,
                    `analytics-report-${report}-${from}-${to}.csv`,
                )
                saveBlob(response.data, filename)
                setSuccess(`Export report generado: ${filename}`)
            }
            void loadHistory()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'No fue posible generar el export')
        } finally {
            setLoading(false)
        }
    }

    return (
        <AnalyticsPageLayout
            title="Exports"
            subtitle="Descargas canónicas y report-aligned para auditoría y consumo humano."
        >
            <div className="flex flex-col gap-4">
                <Card>
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                    content={exportType}
                                    innerClass={exportType === 'canonical' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'}
                                />
                            </div>
                            <p className="text-sm text-gray-600">{explanation}</p>
                        </div>
                    </div>
                </Card>

                {error ? (
                    <Card>
                        <Notification title="No fue posible generar el export" type="danger">
                            {error}
                        </Notification>
                    </Card>
                ) : null}

                {success ? (
                    <Card>
                        <Notification title="Export listo" type="success">
                            {success}
                        </Notification>
                    </Card>
                ) : null}

                <Card>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <label className="flex flex-col gap-2 text-sm">
                            <span className="font-medium text-gray-700">Tipo de export</span>
                            <select
                                className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
                                value={exportType}
                                onChange={(event) => setExportType(event.target.value as ExportType)}
                            >
                                <option value="canonical">Canonical</option>
                                <option value="report">Report</option>
                            </select>
                        </label>

                        <label className="flex flex-col gap-2 text-sm">
                            <span className="font-medium text-gray-700">Desde</span>
                            <input
                                className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
                                type="date"
                                value={from}
                                onChange={(event) => setFrom(event.target.value)}
                            />
                        </label>

                        <label className="flex flex-col gap-2 text-sm">
                            <span className="font-medium text-gray-700">Hasta</span>
                            <input
                                className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
                                type="date"
                                value={to}
                                onChange={(event) => setTo(event.target.value)}
                            />
                        </label>

                        <div className="flex items-end">
                            <Button size="sm" variant="solid" loading={loading} onClick={handleDownload}>
                                Descargar
                            </Button>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm">
                            <span className="font-medium text-gray-700">Source</span>
                            <select
                                className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
                                value={source}
                                onChange={(event) => setSource(event.target.value as AnalyticsCanonicalExportSource)}
                                disabled={exportType !== 'canonical'}
                            >
                                <option value="all">all</option>
                                <option value="ga4">ga4</option>
                                <option value="ads">ads</option>
                                <option value="search_console">search_console</option>
                            </select>
                        </label>

                        <label className="flex flex-col gap-2 text-sm">
                            <span className="font-medium text-gray-700">Report</span>
                            <select
                                className="rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition focus:border-indigo-500"
                                value={report}
                                onChange={(event) => setReport(event.target.value as AnalyticsReportExportName)}
                                disabled={exportType !== 'report'}
                            >
                                <option value="ga4_overview">ga4_overview</option>
                                <option value="ads_campaigns">ads_campaigns</option>
                                <option value="seo_pages">seo_pages</option>
                            </select>
                        </label>
                    </div>
                </Card>

                <Card>
                    <div className="mb-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                            <h5 className="mb-1">Historial de exports</h5>
                            <p className="text-sm text-gray-500">
                                Corridas recientes con trazabilidad operativa para auditoría y debugging.
                            </p>
                        </div>
                        <Button size="sm" variant="plain" loading={historyLoading} onClick={() => void loadHistory()}>
                            Refrescar historial
                        </Button>
                    </div>

                    {historyError ? (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                            {historyError}
                        </div>
                    ) : null}

                    <div className="overflow-x-auto">
                        <table className="min-w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 text-xs uppercase tracking-[0.16em] text-gray-500">
                                    <th className="px-4 py-3">Tipo</th>
                                    <th className="px-4 py-3">Source</th>
                                    <th className="px-4 py-3">Rango</th>
                                    <th className="px-4 py-3">Filas</th>
                                    <th className="px-4 py-3">Estado</th>
                                    <th className="px-4 py-3">Duración</th>
                                    <th className="px-4 py-3">Tamaño</th>
                                    <th className="px-4 py-3">Fecha</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historyLoading ? (
                                    <tr>
                                        <td className="px-4 py-4 text-gray-500" colSpan={8}>
                                            Cargando historial...
                                        </td>
                                    </tr>
                                ) : history.length ? (
                                    history.map((item) => (
                                        <tr key={item.id} className="border-b border-gray-100">
                                            <td className="px-4 py-3">{item.exportType}</td>
                                            <td className="px-4 py-3">{item.source ?? 'unified'}</td>
                                            <td className="px-4 py-3">
                                                {item.dateFrom} → {item.dateTo}
                                            </td>
                                            <td className="px-4 py-3">{item.rowCount ?? 'n/a'}</td>
                                            <td className="px-4 py-3">
                                                <Badge
                                                    content={item.status}
                                                    innerClass={
                                                        item.status === 'success'
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : item.status === 'error'
                                                              ? 'bg-rose-100 text-rose-700'
                                                              : 'bg-amber-100 text-amber-700'
                                                    }
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.durationMs != null ? `${item.durationMs} ms` : 'n/a'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {item.fileSize != null
                                                    ? `${(item.fileSize / 1024).toFixed(1)} KB`
                                                    : 'n/a'}
                                            </td>
                                            <td className="px-4 py-3">{formatDateTime(item.createdAt)}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td className="px-4 py-4 text-gray-500" colSpan={8}>
                                            Todavía no hay exports registrados.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </AnalyticsPageLayout>
    )
}

export default AnalyticsExportsPage

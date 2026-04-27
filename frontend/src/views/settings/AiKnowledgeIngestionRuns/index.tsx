/* eslint-disable jsx-a11y/label-has-associated-control */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Loading from '@/components/shared/Loading'
import DataTable from '@/components/shared/DataTable'
import type { ColumnDef, OnSortParam } from '@/components/shared/DataTable'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import AiKnowledgeService, {
    type AiKnowledgeIngestionRun,
    type ListKnowledgeIngestionRunsParams,
} from '@/services/AiKnowledgeService'

const formatDateTime = (value: string | null) => {
    if (!value) return 'Sin fecha'
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(value))
    } catch {
        return value
    }
}

const statusClassName: Record<string, string> = {
    running: 'bg-amber-50 text-amber-700',
    completed: 'bg-emerald-50 text-emerald-700',
    failed: 'bg-rose-50 text-rose-700',
}

type IngestionRunFilters = {
    status: string
    sourceType: string
    from: string
    to: string
}

const initialFilters: IngestionRunFilters = {
    status: 'all',
    sourceType: 'all',
    from: '',
    to: '',
}

const AiKnowledgeIngestionRunsPage = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<AiKnowledgeIngestionRun[]>([])
    const [total, setTotal] = useState(0)
    const [pageIndex, setPageIndex] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [sort, setSort] = useState<OnSortParam>({
        key: 'createdAt',
        order: 'desc',
    })
    const [filters, setFilters] = useState<IngestionRunFilters>(initialFilters)
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const fetchRuns = useCallback(async () => {
        setLoading(true)
        try {
            const params: ListKnowledgeIngestionRunsParams = {
                page: pageIndex,
                pageSize,
                orderBy: String(sort.key || 'createdAt') as ListKnowledgeIngestionRunsParams['orderBy'],
                orderDir: (sort.order || 'desc') as 'asc' | 'desc',
                status:
                    filters.status !== 'all'
                        ? (filters.status as ListKnowledgeIngestionRunsParams['status'])
                        : undefined,
                sourceType:
                    filters.sourceType !== 'all'
                        ? (filters.sourceType as ListKnowledgeIngestionRunsParams['sourceType'])
                        : undefined,
                from: filters.from || undefined,
                to: filters.to || undefined,
            }

            const response = await AiKnowledgeService.listIngestionRuns(params)
            setItems(response.data.items)
            setTotal(response.data.total)
            setSelectedRunId((current) => {
                if (current && response.data.items.some((item) => item.id === current)) {
                    return current
                }
                return response.data.items[0]?.id ?? null
            })
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar corridas de ingesta" type="danger">
                    Revisa disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [filters, pageIndex, pageSize, sort])

    useEffect(() => {
        void fetchRuns()
    }, [fetchRuns])

    const selectedRun = useMemo(
        () => items.find((item) => item.id === selectedRunId) ?? null,
        [items, selectedRunId],
    )

    const runConversationsObservation = useCallback(async () => {
        setActionLoading('conversations')
        try {
            await AiKnowledgeService.ingestConversations(150)
            await fetchRuns()
            toast.push(
                <Notification title="Corrida de conversaciones iniciada" type="success">
                    La observación manual quedó registrada.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible observar conversaciones" type="danger">
                    Intenta nuevamente desde IA &gt; Runtime si el problema persiste.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setActionLoading(null)
        }
    }, [fetchRuns])

    const runDocsIngestion = useCallback(async () => {
        setActionLoading('docs')
        try {
            await AiKnowledgeService.ingestDocs()
            await fetchRuns()
            toast.push(
                <Notification title="Ingesta documental ejecutada" type="success">
                    La corrida quedó registrada en el historial.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible ingerir documentos" type="danger">
                    Intenta nuevamente desde IA &gt; Runtime si el problema persiste.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setActionLoading(null)
        }
    }, [fetchRuns])

    const runDatasetsIngestion = useCallback(async () => {
        setActionLoading('datasets')
        try {
            await AiKnowledgeService.ingestDatasets()
            await fetchRuns()
            toast.push(
                <Notification title="Ingesta de datasets ejecutada" type="success">
                    La corrida quedó registrada en el historial.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible ingerir datasets" type="danger">
                    Intenta nuevamente desde IA &gt; Runtime si el problema persiste.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setActionLoading(null)
        }
    }, [fetchRuns])

    const columns: ColumnDef<AiKnowledgeIngestionRun>[] = useMemo(
        () => [
            {
                header: 'Origen',
                accessorKey: 'sourceType',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <button
                            type="button"
                            className="text-left"
                            onClick={() => setSelectedRunId(row.id)}
                        >
                            <div className="font-medium text-gray-900">{row.sourceType}</div>
                            <div className="mt-1 text-xs text-gray-500">{row.triggerType}</div>
                        </button>
                    )
                },
            },
            {
                header: 'Estado',
                accessorKey: 'status',
                cell: (props) => (
                    <Badge
                        className={
                            statusClassName[props.row.original.status] ??
                            'bg-slate-100 text-slate-700'
                        }
                    >
                        {props.row.original.status}
                    </Badge>
                ),
            },
            {
                header: 'Procesados',
                accessorKey: 'processedCount',
                cell: (props) => (
                    <div className="text-sm text-gray-700">{props.row.original.processedCount}</div>
                ),
            },
            {
                header: 'Candidatos',
                accessorKey: 'createdCandidates',
                cell: (props) => (
                    <div className="text-sm text-gray-700">
                        {props.row.original.createdCandidates}
                    </div>
                ),
            },
            {
                header: 'Errores',
                accessorKey: 'errorCount',
                cell: (props) => (
                    <div className="text-sm text-gray-700">{props.row.original.errorCount}</div>
                ),
            },
            {
                header: 'Creado',
                accessorKey: 'createdAt',
                cell: (props) => (
                    <div className="text-xs text-gray-500">
                        {formatDateTime(props.row.original.createdAt)}
                    </div>
                ),
            },
        ],
        [],
    )

    return (
        <Loading loading={loading && items.length === 0}>
            <div className="flex flex-col gap-6" data-testid="ai-knowledge-ingestion-runs-page">
                <Card bodyClass="p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Knowledge
                            </div>
                            <h4 className="mt-1 text-xl font-semibold text-gray-900">
                                Knowledge Ingestion Runs
                            </h4>
                            <p className="mt-2 max-w-4xl text-sm text-gray-600">
                                Historial operativo de corridas de ingesta. Esta vista permite
                                seguir estado, volumen procesado, errores y actor que disparó cada
                                corrida.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="default"
                                onClick={() =>
                                    navigate(
                                        `${APP_PREFIX_PATH}/settings/ai/knowledge/overview`,
                                    )
                                }
                            >
                                Ir a overview
                            </Button>
                            <Button variant="solid" onClick={() => void fetchRuns()}>
                                Refrescar
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card bodyClass="p-5">
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="default"
                            loading={actionLoading === 'conversations'}
                            onClick={() => void runConversationsObservation()}
                            data-testid="ai-knowledge-ingest-conversations"
                        >
                            Observar conversaciones
                        </Button>
                        <Button
                            variant="default"
                            loading={actionLoading === 'docs'}
                            onClick={() => void runDocsIngestion()}
                            data-testid="ai-knowledge-ingest-docs"
                        >
                            Ingerir docs
                        </Button>
                        <Button
                            variant="default"
                            loading={actionLoading === 'datasets'}
                            onClick={() => void runDatasetsIngestion()}
                            data-testid="ai-knowledge-ingest-datasets"
                        >
                            Ingerir datasets
                        </Button>
                    </div>
                </Card>

                <Card bodyClass="p-5">
                    <div className="grid gap-4 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Estado
                            </label>
                            <select
                                className="input"
                                value={filters.status}
                                onChange={(event) => {
                                    setPageIndex(1)
                                    setFilters((current) => ({
                                        ...current,
                                        status: event.target.value,
                                    }))
                                }}
                            >
                                <option value="all">Todos</option>
                                <option value="running">running</option>
                                <option value="completed">completed</option>
                                <option value="failed">failed</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Origen
                            </label>
                            <select
                                className="input"
                                value={filters.sourceType}
                                onChange={(event) => {
                                    setPageIndex(1)
                                    setFilters((current) => ({
                                        ...current,
                                        sourceType: event.target.value,
                                    }))
                                }}
                            >
                                <option value="all">Todos</option>
                                <option value="conversation_message">conversation_message</option>
                                <option value="docs">docs</option>
                                <option value="backend_dataset">backend_dataset</option>
                                <option value="dataset">dataset</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Desde
                            </label>
                            <Input
                                type="date"
                                value={filters.from}
                                onChange={(event) => {
                                    setPageIndex(1)
                                    setFilters((current) => ({
                                        ...current,
                                        from: event.target.value,
                                    }))
                                }}
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Hasta
                            </label>
                            <Input
                                type="date"
                                value={filters.to}
                                onChange={(event) => {
                                    setPageIndex(1)
                                    setFilters((current) => ({
                                        ...current,
                                        to: event.target.value,
                                    }))
                                }}
                            />
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                        <Button
                            variant="default"
                            onClick={() => {
                                setPageIndex(1)
                                setFilters(initialFilters)
                            }}
                        >
                            Limpiar filtros
                        </Button>
                    </div>
                </Card>

                <Card bodyClass="p-5">
                    <div className="mb-4">
                        <h5 className="font-semibold text-gray-900">Corridas registradas</h5>
                        <p className="mt-1 text-sm text-gray-500">{total} corridas encontradas</p>
                    </div>
                    <DataTable
                        columns={columns}
                        data={items}
                        loading={loading}
                        pagingData={{
                            total,
                            pageIndex,
                            pageSize,
                        }}
                        onPaginationChange={setPageIndex}
                        onSelectChange={(value) => {
                            setPageIndex(1)
                            setPageSize(value)
                        }}
                        onSort={(nextSort) => {
                            setPageIndex(1)
                            setSort(nextSort)
                        }}
                    />
                </Card>

                <Card bodyClass="p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h5 className="font-semibold text-gray-900">
                                {selectedRun ? 'Detalle de la corrida' : 'Sin selección'}
                            </h5>
                            <p className="mt-1 text-sm text-gray-500">
                                Diagnóstico de volumen, actor, trigger y metadata técnica.
                            </p>
                        </div>
                        {selectedRun ? (
                            <Badge
                                className={
                                    statusClassName[selectedRun.status] ??
                                    'bg-slate-100 text-slate-700'
                                }
                            >
                                {selectedRun.status}
                            </Badge>
                        ) : null}
                    </div>

                    {selectedRun ? (
                        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="grid gap-3 text-sm text-gray-700">
                                        <div>
                                            <span className="font-medium text-gray-900">Origen:</span>{' '}
                                            {selectedRun.sourceType}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">Trigger:</span>{' '}
                                            {selectedRun.triggerType}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">Creado:</span>{' '}
                                            {formatDateTime(selectedRun.createdAt)}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">Finalizado:</span>{' '}
                                            {formatDateTime(selectedRun.finishedAt)}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">Actor:</span>{' '}
                                            {selectedRun.createdByUser?.name ||
                                                selectedRun.createdByUser?.email ||
                                                'Sistema'}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-2xl border border-gray-200 p-4">
                                        <div className="text-xs uppercase tracking-wide text-gray-400">
                                            Procesados
                                        </div>
                                        <div className="mt-2 text-2xl font-semibold">
                                            {selectedRun.processedCount}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-gray-200 p-4">
                                        <div className="text-xs uppercase tracking-wide text-gray-400">
                                            Candidatos
                                        </div>
                                        <div className="mt-2 text-2xl font-semibold">
                                            {selectedRun.createdCandidates}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-gray-200 p-4">
                                        <div className="text-xs uppercase tracking-wide text-gray-400">
                                            Omitidos
                                        </div>
                                        <div className="mt-2 text-2xl font-semibold">
                                            {selectedRun.skippedCount}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-gray-200 p-4">
                                        <div className="text-xs uppercase tracking-wide text-gray-400">
                                            Errores
                                        </div>
                                        <div className="mt-2 text-2xl font-semibold">
                                            {selectedRun.errorCount}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 p-4">
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Metadata
                                </div>
                                <pre className="max-h-[420px] overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-gray-700">
                                    {JSON.stringify(
                                        {
                                            observationCount: selectedRun.observationCount,
                                            metadata: selectedRun.metadata,
                                        },
                                        null,
                                        2,
                                    )}
                                </pre>
                            </div>
                        </div>
                    ) : null}
                </Card>
            </div>
        </Loading>
    )
}

export default AiKnowledgeIngestionRunsPage

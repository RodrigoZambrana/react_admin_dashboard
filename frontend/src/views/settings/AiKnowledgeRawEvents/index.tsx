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
    type AiKnowledgeRawEvent,
    type ListKnowledgeRawEventsParams,
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

const humanizeKey = (value: string) =>
    value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())

const statusClassName: Record<string, string> = {
    new: 'bg-amber-50 text-amber-700',
    processed: 'bg-emerald-50 text-emerald-700',
    discarded: 'bg-rose-50 text-rose-700',
}

type RawEventFilters = {
    search: string
    status: string
    channel: string
    sourceAuthorType: string
    detectedIntent: string
}

const initialFilters: RawEventFilters = {
    search: '',
    status: 'all',
    channel: 'all',
    sourceAuthorType: 'all',
    detectedIntent: '',
}

const AiKnowledgeRawEventsPage = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<AiKnowledgeRawEvent[]>([])
    const [total, setTotal] = useState(0)
    const [pageIndex, setPageIndex] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [sort, setSort] = useState<OnSortParam>({
        key: 'updatedAt',
        order: 'desc',
    })
    const [filters, setFilters] = useState<RawEventFilters>(initialFilters)
    const [searchDraft, setSearchDraft] = useState('')
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

    const fetchEvents = useCallback(async () => {
        setLoading(true)
        try {
            const params: ListKnowledgeRawEventsParams = {
                page: pageIndex,
                pageSize,
                orderBy: String(sort.key || 'updatedAt') as ListKnowledgeRawEventsParams['orderBy'],
                orderDir: (sort.order || 'desc') as 'asc' | 'desc',
                search: filters.search || undefined,
                status:
                    filters.status !== 'all'
                        ? (filters.status as ListKnowledgeRawEventsParams['status'])
                        : undefined,
                channel:
                    filters.channel !== 'all'
                        ? (filters.channel as ListKnowledgeRawEventsParams['channel'])
                        : undefined,
                sourceAuthorType:
                    filters.sourceAuthorType !== 'all'
                        ? (filters.sourceAuthorType as ListKnowledgeRawEventsParams['sourceAuthorType'])
                        : undefined,
                detectedIntent: filters.detectedIntent || undefined,
            }
            const response = await AiKnowledgeService.listRawEvents(params)
            setItems(response.data.items)
            setTotal(response.data.total)
            setSelectedEventId((current) => {
                if (current && response.data.items.some((item) => item.id === current)) {
                    return current
                }
                return response.data.items[0]?.id ?? null
            })
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar raw events" type="danger">
                    Revisa disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [filters, pageIndex, pageSize, sort])

    useEffect(() => {
        void fetchEvents()
    }, [fetchEvents])

    const selectedEvent = useMemo(
        () => items.find((item) => item.id === selectedEventId) ?? null,
        [items, selectedEventId],
    )

    const columns: ColumnDef<AiKnowledgeRawEvent>[] = useMemo(
        () => [
            {
                header: 'Mensaje',
                accessorKey: 'userMessage',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <button
                            type="button"
                            className="text-left"
                            onClick={() => setSelectedEventId(row.id)}
                        >
                            <div className="font-medium text-gray-900">
                                {row.detectedIntent ?? 'Sin intención detectada'}
                            </div>
                            <div className="mt-1 line-clamp-2 max-w-[420px] text-sm text-gray-600">
                                {row.userMessage}
                            </div>
                        </button>
                    )
                },
            },
            {
                header: 'Canal',
                accessorKey: 'channel',
                cell: (props) => (
                    <div className="text-sm text-gray-700">{props.row.original.channel}</div>
                ),
            },
            {
                header: 'Autor',
                accessorKey: 'sourceAuthorType',
                cell: (props) => (
                    <div className="text-sm text-gray-700">
                        {props.row.original.sourceAuthorType}
                    </div>
                ),
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
                header: 'Candidato',
                accessorKey: 'candidate',
                cell: (props) => (
                    <div className="text-xs text-gray-500">
                        {props.row.original.candidate
                            ? props.row.original.candidate.status
                            : 'sin candidato'}
                    </div>
                ),
            },
            {
                header: 'Actualizado',
                accessorKey: 'updatedAt',
                cell: (props) => (
                    <div className="text-xs text-gray-500">
                        {formatDateTime(props.row.original.updatedAt)}
                    </div>
                ),
            },
        ],
        [],
    )

    return (
        <Loading loading={loading && items.length === 0}>
            <div className="flex flex-col gap-6" data-testid="ai-knowledge-raw-events-page">
                <Card bodyClass="p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Knowledge
                            </div>
                            <h4 className="mt-1 text-xl font-semibold text-gray-900">
                                Knowledge Raw Events
                            </h4>
                            <p className="mt-2 max-w-4xl text-sm text-gray-600">
                                Observaciones crudas detectadas desde conversaciones. Esta vista
                                sirve para diagnóstico, trazabilidad y entendimiento de cómo entra
                                información real al pipeline de knowledge.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="default"
                                onClick={() =>
                                    navigate(
                                        `${APP_PREFIX_PATH}/settings/ai/knowledge/manage-articles`,
                                    )
                                }
                            >
                                Volver al board
                            </Button>
                            <Button variant="solid" onClick={() => void fetchEvents()}>
                                Refrescar
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card bodyClass="p-5">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Buscar
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={searchDraft}
                                    onChange={(event) => setSearchDraft(event.target.value)}
                                    placeholder="mensaje, contexto, intent"
                                />
                                <Button
                                    variant="solid"
                                    onClick={() => {
                                        setPageIndex(1)
                                        setFilters((current) => ({
                                            ...current,
                                            search: searchDraft.trim(),
                                        }))
                                    }}
                                >
                                    Buscar
                                </Button>
                            </div>
                        </div>
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
                                <option value="new">new</option>
                                <option value="processed">processed</option>
                                <option value="discarded">discarded</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Canal
                            </label>
                            <select
                                className="input"
                                value={filters.channel}
                                onChange={(event) => {
                                    setPageIndex(1)
                                    setFilters((current) => ({
                                        ...current,
                                        channel: event.target.value,
                                    }))
                                }}
                            >
                                <option value="all">Todos</option>
                                <option value="webchat">webchat</option>
                                <option value="whatsapp">whatsapp</option>
                                <option value="email">email</option>
                                <option value="meta">meta</option>
                                <option value="admin_chat">admin_chat</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Autor origen
                            </label>
                            <select
                                className="input"
                                value={filters.sourceAuthorType}
                                onChange={(event) => {
                                    setPageIndex(1)
                                    setFilters((current) => ({
                                        ...current,
                                        sourceAuthorType: event.target.value,
                                    }))
                                }}
                            >
                                <option value="all">Todos</option>
                                <option value="customer">customer</option>
                                <option value="operator">operator</option>
                                <option value="agent">agent</option>
                                <option value="system">system</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Intent detectado
                            </label>
                            <Input
                                value={filters.detectedIntent}
                                onChange={(event) =>
                                    setFilters((current) => ({
                                        ...current,
                                        detectedIntent: event.target.value,
                                    }))
                                }
                                onBlur={() => setPageIndex(1)}
                                placeholder="appointments.create, aberturas.register..."
                            />
                        </div>
                        <div className="flex items-end">
                            <Button
                                variant="default"
                                onClick={() => {
                                    setPageIndex(1)
                                    setSearchDraft('')
                                    setFilters(initialFilters)
                                }}
                            >
                                Limpiar filtros
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card bodyClass="p-5">
                    <div className="mb-4">
                        <h5 className="font-semibold text-gray-900">Eventos observados</h5>
                        <p className="mt-1 text-sm text-gray-500">{total} eventos encontrados</p>
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
                                {selectedEvent ? 'Detalle del evento' : 'Sin selección'}
                            </h5>
                            <p className="mt-1 text-sm text-gray-500">
                                Trazabilidad cruda del mensaje, contexto interpretado y vínculo con
                                candidato/documento.
                            </p>
                        </div>
                        {selectedEvent ? (
                            <Badge
                                className={
                                    statusClassName[selectedEvent.status] ??
                                    'bg-slate-100 text-slate-700'
                                }
                            >
                                {selectedEvent.status}
                            </Badge>
                        ) : null}
                    </div>

                    {selectedEvent ? (
                        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Mensaje original
                                    </div>
                                    <div className="text-sm text-gray-700">{selectedEvent.userMessage}</div>
                                </div>
                                {selectedEvent.contextSummary ? (
                                    <div className="rounded-2xl border border-gray-200 p-4">
                                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Contexto resumido
                                        </div>
                                        <div className="text-sm text-gray-700">
                                            {selectedEvent.contextSummary}
                                        </div>
                                    </div>
                                ) : null}
                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Señales interpretadas
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Badge className="bg-slate-100 text-slate-700">
                                            {selectedEvent.channel}
                                        </Badge>
                                        <Badge className="bg-slate-100 text-slate-700">
                                            {selectedEvent.sourceAuthorType}
                                        </Badge>
                                        {selectedEvent.detectedIntent ? (
                                            <Badge className="bg-sky-50 text-sky-700">
                                                {selectedEvent.detectedIntent}
                                            </Badge>
                                        ) : null}
                                        {selectedEvent.candidate ? (
                                            <Badge className="bg-emerald-50 text-emerald-700">
                                                candidato {selectedEvent.candidate.status}
                                            </Badge>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Message elements
                                    </div>
                                    <pre className="max-h-56 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-gray-700">
                                        {JSON.stringify(selectedEvent.messageElements ?? [], null, 2)}
                                    </pre>
                                </div>
                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Origen de contexto
                                    </div>
                                    <pre className="max-h-56 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-gray-700">
                                        {JSON.stringify(selectedEvent.messageContextOrigin ?? [], null, 2)}
                                    </pre>
                                </div>
                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Metadata técnica
                                    </div>
                                    <pre className="max-h-56 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-gray-700">
                                        {JSON.stringify(
                                            {
                                                problem: selectedEvent.problem,
                                                confidence: selectedEvent.confidence,
                                                relevanceScore: selectedEvent.relevanceScore,
                                                metadata: selectedEvent.metadata,
                                            },
                                            null,
                                            2,
                                        )}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    ) : null}
                </Card>
            </div>
        </Loading>
    )
}

export default AiKnowledgeRawEventsPage

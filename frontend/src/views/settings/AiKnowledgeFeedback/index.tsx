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
    type AiKnowledgeFeedback,
    type AiKnowledgeOverview,
    type ListKnowledgeFeedbackParams,
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

const feedbackStatusClassName: Record<string, string> = {
    used: 'bg-emerald-50 text-emerald-700',
    edited: 'bg-sky-50 text-sky-700',
    discarded: 'bg-rose-50 text-rose-700',
}

type FeedbackFilters = {
    search: string
    scope: string
    outcome: string
    channel: string
}

const initialFilters: FeedbackFilters = {
    search: '',
    scope: 'all',
    outcome: 'all',
    channel: 'all',
}

const AiKnowledgeFeedbackPage = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<AiKnowledgeFeedback[]>([])
    const [total, setTotal] = useState(0)
    const [pageIndex, setPageIndex] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [sort, setSort] = useState<OnSortParam>({
        key: 'createdAt',
        order: 'desc',
    })
    const [filters, setFilters] = useState<FeedbackFilters>(initialFilters)
    const [searchDraft, setSearchDraft] = useState('')
    const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null)
    const [overview, setOverview] = useState<AiKnowledgeOverview | null>(null)

    const fetchFeedback = useCallback(async () => {
        setLoading(true)
        try {
            const [overviewResponse, feedbackResponse] = await Promise.all([
                AiKnowledgeService.getOverview(),
                AiKnowledgeService.listFeedback({
                    page: pageIndex,
                    pageSize,
                    orderBy: String(sort.key || 'createdAt') as ListKnowledgeFeedbackParams['orderBy'],
                    orderDir: (sort.order || 'desc') as 'asc' | 'desc',
                    search: filters.search || undefined,
                    scope:
                        filters.scope !== 'all'
                            ? (filters.scope as ListKnowledgeFeedbackParams['scope'])
                            : undefined,
                    outcome:
                        filters.outcome !== 'all'
                            ? (filters.outcome as ListKnowledgeFeedbackParams['outcome'])
                            : undefined,
                    channel:
                        filters.channel !== 'all'
                            ? (filters.channel as ListKnowledgeFeedbackParams['channel'])
                            : undefined,
                }),
            ])

            setOverview(overviewResponse.data)
            setItems(feedbackResponse.data.items)
            setTotal(feedbackResponse.data.total)
            setSelectedFeedbackId((current) => {
                if (current && feedbackResponse.data.items.some((item) => item.id === current)) {
                    return current
                }
                return feedbackResponse.data.items[0]?.id ?? null
            })
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar feedback" type="danger">
                    Revisa disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [filters, pageIndex, pageSize, sort])

    useEffect(() => {
        void fetchFeedback()
    }, [fetchFeedback])

    const selectedFeedback = useMemo(
        () => items.find((item) => item.id === selectedFeedbackId) ?? null,
        [items, selectedFeedbackId],
    )

    const summary = overview?.feedback ?? {
        used: 0,
        edited: 0,
        discarded: 0,
        total: 0,
        applied: 0,
        adoptionRate: 0,
        discardRate: 0,
    }

    const columns: ColumnDef<AiKnowledgeFeedback>[] = useMemo(
        () => [
            {
                header: 'Candidato',
                accessorKey: 'candidateTitle',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <button
                            type="button"
                            className="text-left"
                            onClick={() => setSelectedFeedbackId(row.id)}
                        >
                            <div className="font-medium text-gray-900">
                                {row.candidate.title}
                            </div>
                            <div className="mt-1 line-clamp-2 max-w-[420px] text-sm text-gray-600">
                                {row.finalText || row.suggestedText || 'Sin contenido visible'}
                            </div>
                        </button>
                    )
                },
            },
            {
                header: 'Resultado',
                accessorKey: 'outcome',
                cell: (props) => (
                    <Badge
                        className={
                            feedbackStatusClassName[props.row.original.outcome] ??
                            'bg-slate-100 text-slate-700'
                        }
                    >
                        {props.row.original.outcome}
                    </Badge>
                ),
            },
            {
                header: 'Canal',
                accessorKey: 'channel',
                cell: (props) => (
                    <div className="text-sm text-gray-700">{props.row.original.channel}</div>
                ),
            },
            {
                header: 'Intent',
                accessorKey: 'intent',
                cell: (props) => (
                    <div className="text-sm text-gray-700">
                        {props.row.original.candidate.detectedIntent || 'sin intent'}
                    </div>
                ),
            },
            {
                header: 'Actor',
                accessorKey: 'actorName',
                cell: (props) => (
                    <div className="text-sm text-gray-700">
                        {props.row.original.actorUser?.name ||
                            props.row.original.actorUser?.email ||
                            'Sistema'}
                    </div>
                ),
            },
            {
                header: 'Fecha',
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
            <div className="flex flex-col gap-6" data-testid="ai-knowledge-feedback-page">
                <Card bodyClass="p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Knowledge
                            </div>
                            <h4 className="mt-1 text-xl font-semibold text-gray-900">
                                Knowledge Feedback
                            </h4>
                            <p className="mt-2 max-w-4xl text-sm text-gray-600">
                                Trazabilidad del reuse real de sugerencias aprobadas. Permite ver
                                qué fue usado, editado o descartado y por qué señales conviene
                                ajustar ranking o contenido.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="default"
                                onClick={() => navigate(`${APP_PREFIX_PATH}/settings/ai`)}
                            >
                                Volver a IA
                            </Button>
                            <Button
                                variant="default"
                                onClick={() =>
                                    navigate(`${APP_PREFIX_PATH}/settings/ai/runtime`)
                                }
                            >
                                Abrir runtime
                            </Button>
                            <Button variant="solid" onClick={() => void fetchFeedback()}>
                                Refrescar
                            </Button>
                        </div>
                    </div>
                </Card>

                <div className="grid gap-4 xl:grid-cols-5">
                    <MetricCard
                        label="Aplicadas"
                        value={summary.applied}
                        tone="violet"
                        testId="ai-knowledge-feedback-applied"
                    />
                    <MetricCard
                        label="Usadas"
                        value={summary.used}
                        tone="emerald"
                        testId="ai-knowledge-feedback-used"
                    />
                    <MetricCard
                        label="Editadas"
                        value={summary.edited}
                        tone="sky"
                        testId="ai-knowledge-feedback-edited"
                    />
                    <MetricCard
                        label="Descartadas"
                        value={summary.discarded}
                        tone="rose"
                        testId="ai-knowledge-feedback-discarded"
                    />
                    <MetricCard
                        label="Adopción"
                        value={`${Math.round(summary.adoptionRate * 100)}%`}
                        tone="violet"
                        testId="ai-knowledge-feedback-adoption-rate"
                    />
                </div>

                <Card bodyClass="p-5">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Buscar
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={searchDraft}
                                    onChange={(event) => setSearchDraft(event.target.value)}
                                    placeholder="candidato, texto sugerido o final"
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
                        <FilterSelect
                            label="Scope"
                            value={filters.scope}
                            options={[
                                ['all', 'Todos'],
                                ['admin_internal', 'Admin interno'],
                                ['customer_public', 'Cliente público'],
                            ]}
                            onChange={(value) => {
                                setPageIndex(1)
                                setFilters((current) => ({ ...current, scope: value }))
                            }}
                        />
                        <FilterSelect
                            label="Outcome"
                            value={filters.outcome}
                            options={[
                                ['all', 'Todos'],
                                ['used', 'used'],
                                ['edited', 'edited'],
                                ['discarded', 'discarded'],
                            ]}
                            onChange={(value) => {
                                setPageIndex(1)
                                setFilters((current) => ({ ...current, outcome: value }))
                            }}
                        />
                        <FilterSelect
                            label="Canal"
                            value={filters.channel}
                            options={[
                                ['all', 'Todos'],
                                ['webchat', 'webchat'],
                                ['whatsapp', 'whatsapp'],
                                ['email', 'email'],
                                ['admin_chat', 'admin_chat'],
                            ]}
                            onChange={(value) => {
                                setPageIndex(1)
                                setFilters((current) => ({ ...current, channel: value }))
                            }}
                        />
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
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h5 className="font-semibold text-gray-900">Eventos de feedback</h5>
                            <p className="mt-1 text-sm text-gray-500">
                                {total} eventos registrados
                            </p>
                        </div>
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
                                {selectedFeedback ? 'Detalle del feedback' : 'Sin selección'}
                            </h5>
                            <p className="mt-1 text-sm text-gray-500">
                                Comparación entre sugerencia propuesta, respuesta final y contexto
                                operativo del reuse.
                            </p>
                        </div>
                        {selectedFeedback ? (
                            <Badge
                                className={
                                    feedbackStatusClassName[selectedFeedback.outcome] ??
                                    'bg-slate-100 text-slate-700'
                                }
                            >
                                {selectedFeedback.outcome}
                            </Badge>
                        ) : null}
                    </div>

                    {selectedFeedback ? (
                        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                            <div className="space-y-4">
                                <FeedbackPanel
                                    label="Sugerencia usada como base"
                                    value={selectedFeedback.suggestedText}
                                />
                                <FeedbackPanel
                                    label="Respuesta final del operador"
                                    value={selectedFeedback.finalText}
                                />
                                <FeedbackPanel
                                    label="Mensaje objetivo"
                                    value={selectedFeedback.targetMessage?.body}
                                />
                                <FeedbackPanel
                                    label="Mensaje finalmente enviado"
                                    value={selectedFeedback.operatorMessage?.body}
                                />
                            </div>
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-600">
                                    <div className="grid gap-3">
                                        <div>
                                            <span className="font-medium text-gray-900">
                                                Candidato:
                                            </span>{' '}
                                            {selectedFeedback.candidate.title}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">
                                                Intent:
                                            </span>{' '}
                                            {selectedFeedback.candidate.detectedIntent || 'sin intent'}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">
                                                Conversación:
                                            </span>{' '}
                                            {selectedFeedback.conversation.subject ||
                                                selectedFeedback.conversation.id}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">
                                                Actor:
                                            </span>{' '}
                                            {selectedFeedback.actorUser?.name ||
                                                selectedFeedback.actorUser?.email ||
                                                'Sistema'}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">
                                                Registrado:
                                            </span>{' '}
                                            {formatDateTime(selectedFeedback.createdAt)}
                                        </div>
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-gray-200 bg-slate-50 p-4">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Metadata
                                    </div>
                                    <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-gray-600">
                                        {JSON.stringify(selectedFeedback.metadata ?? {}, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-5 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-sm text-gray-500">
                            Selecciona un evento para revisar el reuse exacto y su resultado.
                        </div>
                    )}
                </Card>
            </div>
        </Loading>
    )
}

const MetricCard = ({
    label,
    value,
    tone,
    testId,
}: {
    label: string
    value: number | string
    tone: 'emerald' | 'sky' | 'rose' | 'violet'
    testId?: string
}) => {
    const className: Record<typeof tone, string> = {
        emerald: 'from-emerald-50 to-white text-emerald-700',
        sky: 'from-sky-50 to-white text-sky-700',
        rose: 'from-rose-50 to-white text-rose-700',
        violet: 'from-violet-50 to-white text-violet-700',
    }

    return (
        <Card bodyClass="p-5">
            <div
                className={`rounded-2xl bg-gradient-to-br p-4 ${className[tone]}`}
                data-testid={testId}
            >
                <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
                <div className="mt-2 text-2xl font-semibold">{value}</div>
            </div>
        </Card>
    )
}

const FilterSelect = ({
    label,
    value,
    options,
    onChange,
}: {
    label: string
    value: string
    options: Array<[string, string]>
    onChange: (value: string) => void
}) => (
    <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
        </label>
        <select className="input" value={value} onChange={(event) => onChange(event.target.value)}>
            {options.map(([optionValue, optionLabel]) => (
                <option key={optionValue} value={optionValue}>
                    {optionLabel}
                </option>
            ))}
        </select>
    </div>
)

const FeedbackPanel = ({
    label,
    value,
}: {
    label: string
    value: string | null | undefined
}) => (
    <div className="rounded-2xl border border-gray-200 p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
        </div>
        <div className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
            {value?.trim() || 'Sin contenido registrado'}
        </div>
    </div>
)

export default AiKnowledgeFeedbackPage

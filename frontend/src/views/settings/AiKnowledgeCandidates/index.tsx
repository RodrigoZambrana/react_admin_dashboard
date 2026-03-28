import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import Loading from '@/components/shared/Loading'
import DataTable from '@/components/shared/DataTable'
import type { ColumnDef, OnSortParam } from '@/components/shared/DataTable'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import AiKnowledgeService, {
    type AiKnowledgeCandidate,
    type ListKnowledgeCandidatesParams,
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

const candidateStatusClassName: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-rose-50 text-rose-700',
}

const CandidateStatusBadge = ({ status }: { status: string }) => (
    <Badge className={candidateStatusClassName[status] ?? 'bg-slate-100 text-slate-700'}>
        {status}
    </Badge>
)

type CandidateFilters = {
    search: string
    scope: string
    status: string
    channel: string
    originCategory: string
    hasFeedback: string
    detectedIntent: string
}

const initialFilters: CandidateFilters = {
    search: '',
    scope: 'all',
    status: 'all',
    channel: 'all',
    originCategory: 'all',
    hasFeedback: 'all',
    detectedIntent: '',
}

const AiKnowledgeCandidates = () => {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const detailSectionRef = useRef<HTMLDivElement | null>(null)
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<AiKnowledgeCandidate[]>([])
    const [total, setTotal] = useState(0)
    const [pageIndex, setPageIndex] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [sort, setSort] = useState<OnSortParam>({
        key: 'updatedAt',
        order: 'desc',
    })
    const [filters, setFilters] = useState<CandidateFilters>(initialFilters)
    const [searchDraft, setSearchDraft] = useState('')
    const [detailLoading, setDetailLoading] = useState(false)
    const [selectedCandidateDetail, setSelectedCandidateDetail] =
        useState<AiKnowledgeCandidate | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [approvalTitle, setApprovalTitle] = useState('')
    const [approvalSummary, setApprovalSummary] = useState('')
    const [approvalContent, setApprovalContent] = useState('')

    const fetchCandidates = useCallback(async () => {
        setLoading(true)
        try {
            const params: ListKnowledgeCandidatesParams = {
                page: pageIndex,
                pageSize,
                orderBy: String(sort.key || 'updatedAt') as ListKnowledgeCandidatesParams['orderBy'],
                orderDir: (sort.order || 'desc') as 'asc' | 'desc',
                search: filters.search || undefined,
                scope:
                    filters.scope !== 'all'
                        ? (filters.scope as ListKnowledgeCandidatesParams['scope'])
                        : undefined,
                status:
                    filters.status !== 'all'
                        ? (filters.status as ListKnowledgeCandidatesParams['status'])
                        : undefined,
                channel:
                    filters.channel !== 'all'
                        ? (filters.channel as ListKnowledgeCandidatesParams['channel'])
                        : undefined,
                originCategory:
                    filters.originCategory !== 'all'
                        ? (filters.originCategory as ListKnowledgeCandidatesParams['originCategory'])
                        : undefined,
                hasFeedback:
                    filters.hasFeedback !== 'all'
                        ? filters.hasFeedback === 'true'
                        : undefined,
                detectedIntent: filters.detectedIntent || undefined,
            }
            const response = await AiKnowledgeService.listCandidates(params)
            setItems(response.data.items)
            setTotal(response.data.total)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar candidatos" type="danger">
                    Revisa disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [filters, pageIndex, pageSize, sort])

    useEffect(() => {
        void fetchCandidates()
    }, [fetchCandidates])

    const selectedCandidateId = useMemo(
        () => searchParams.get('detail')?.trim() || null,
        [searchParams],
    )

    const updateSelectedCandidate = useCallback(
        (candidateId: string | null, options?: { replace?: boolean }) => {
            const nextSearchParams = new URLSearchParams(searchParams)
            if (candidateId) {
                nextSearchParams.set('detail', candidateId)
            } else {
                nextSearchParams.delete('detail')
            }
            setSearchParams(nextSearchParams, { replace: options?.replace ?? false })
        },
        [searchParams, setSearchParams],
    )

    const selectedCandidateFromPage = useMemo(
        () => items.find((item) => item.id === selectedCandidateId) ?? null,
        [items, selectedCandidateId],
    )

    useEffect(() => {
        if (!selectedCandidateId) {
            setSelectedCandidateDetail(null)
            setDetailLoading(false)
            return
        }

        if (selectedCandidateFromPage) {
            setSelectedCandidateDetail(selectedCandidateFromPage)
            setDetailLoading(false)
            return
        }

        let cancelled = false
        setDetailLoading(true)
        void AiKnowledgeService.getCandidate(selectedCandidateId)
            .then((response) => {
                if (!cancelled) {
                    setSelectedCandidateDetail(response.data)
                }
            })
            .catch((error) => {
                console.error(error)
                if (!cancelled) {
                    toast.push(
                        <Notification title="No fue posible abrir el detalle" type="danger">
                            El candidato ya no existe o no está disponible.
                        </Notification>,
                        { placement: 'top-end' },
                    )
                    updateSelectedCandidate(null, { replace: true })
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setDetailLoading(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [selectedCandidateFromPage, selectedCandidateId, updateSelectedCandidate])

    const selectedCandidate = useMemo(
        () => selectedCandidateDetail,
        [selectedCandidateDetail],
    )

    useEffect(() => {
        if (!selectedCandidateId || !detailSectionRef.current) {
            return
        }
        detailSectionRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        })
    }, [selectedCandidate, selectedCandidateId])

    useEffect(() => {
        if (!selectedCandidate) {
            setApprovalTitle('')
            setApprovalSummary('')
            setApprovalContent('')
            return
        }

        setApprovalTitle(selectedCandidate.title)
        setApprovalSummary(selectedCandidate.summary ?? selectedCandidate.contextSummary ?? '')
        setApprovalContent(
            selectedCandidate.approvedResponse ||
                selectedCandidate.suggestedResponse ||
                selectedCandidate.excerpt,
        )
    }, [selectedCandidate])

    const applySearch = () => {
        setPageIndex(1)
        setFilters((current) => ({
            ...current,
            search: searchDraft.trim(),
        }))
    }

    const reviewCandidate = useCallback(
        async (
            candidate: AiKnowledgeCandidate,
            action: 'approve' | 'reject',
            promoteToDocument = false,
        ) => {
            setActionLoading(`${action}:${candidate.id}:${promoteToDocument ? 'promote' : 'plain'}`)
            try {
                await AiKnowledgeService.reviewCandidate(candidate.id, {
                    action,
                    promoteToDocument,
                    scope:
                        candidate.scope === 'admin_internal'
                            ? 'admin_internal'
                            : 'customer_public',
                    title: approvalTitle.trim() || candidate.title,
                    summary: approvalSummary.trim() || undefined,
                    content: approvalContent.trim() || undefined,
                })
                await fetchCandidates()
                toast.push(
                    <Notification
                        title={
                            action === 'approve'
                                ? promoteToDocument
                                    ? 'Candidato aprobado y promovido'
                                    : 'Candidato aprobado'
                                : 'Candidato rechazado'
                        }
                        type="success"
                    >
                        La revisión quedó persistida.
                    </Notification>,
                    { placement: 'top-end' },
                )
            } catch (error) {
                console.error(error)
                toast.push(
                    <Notification title="No fue posible revisar el candidato" type="danger">
                        Revisa los datos y vuelve a intentar.
                    </Notification>,
                    { placement: 'top-end' },
                )
            } finally {
                setActionLoading(null)
            }
        },
        [approvalContent, approvalSummary, approvalTitle, fetchCandidates],
    )

    const columns: ColumnDef<AiKnowledgeCandidate>[] = useMemo(
        () => [
            {
                header: 'Contenido',
                accessorKey: 'excerpt',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <button
                            type="button"
                            className="text-left"
                            onClick={() => setSelectedCandidateId(row.id)}
                        >
                            <div className="font-medium text-gray-900">{row.title}</div>
                            <div className="mt-1 line-clamp-2 max-w-[420px] text-sm text-gray-600">
                                {row.redactedExcerpt || row.excerpt}
                            </div>
                        </button>
                    )
                },
            },
            {
                header: 'Intent',
                accessorKey: 'detectedIntent',
                cell: (props) =>
                    props.row.original.detectedIntent ? (
                        <Badge className="bg-sky-50 text-sky-700">
                            {props.row.original.detectedIntent}
                        </Badge>
                    ) : (
                        <span className="text-xs text-gray-400">sin intent</span>
                    ),
            },
            {
                header: 'Origen',
                accessorKey: 'originCategory',
                cell: (props) => (
                    <div className="text-sm text-gray-700">{props.row.original.originCategory}</div>
                ),
            },
            {
                header: 'Canal',
                accessorKey: 'channel',
                cell: (props) => (
                    <div className="text-sm text-gray-700">
                        {props.row.original.channel || 'n/a'}
                    </div>
                ),
            },
            {
                header: 'Estado',
                accessorKey: 'status',
                cell: (props) => <CandidateStatusBadge status={props.row.original.status} />,
            },
            {
                header: 'Reuse',
                accessorKey: 'feedbackApplied',
                cell: (props) => {
                    const feedback = props.row.original.feedback
                    return (
                        <div className="text-xs text-gray-600">
                            {feedback.applied}/{feedback.total || 0} aplicadas
                        </div>
                    )
                },
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
            <div className="flex flex-col gap-6">
                <Card bodyClass="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Knowledge
                            </div>
                            <h4 className="mt-1 text-xl font-semibold text-gray-900">
                                Knowledge Candidates
                            </h4>
                            <p className="mt-2 max-w-3xl text-sm text-gray-600">
                                Revisión puntual de sugerencias derivadas de conversaciones.
                                Esta superficie reemplaza la cola corta de recientes como canal
                                principal de aprobación.
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
                            <Button variant="solid" onClick={() => void fetchCandidates()}>
                                Refrescar
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card bodyClass="p-5">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Buscar
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={searchDraft}
                                    onChange={(event) => setSearchDraft(event.target.value)}
                                    placeholder="excerpt, respuesta, contexto"
                                />
                                <Button variant="solid" onClick={applySearch}>
                                    Buscar
                                </Button>
                            </div>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Scope
                            </label>
                            <select
                                className="input"
                                value={filters.scope}
                                onChange={(event) => {
                                    setPageIndex(1)
                                    setFilters((current) => ({
                                        ...current,
                                        scope: event.target.value,
                                    }))
                                }}
                            >
                                <option value="all">Todos</option>
                                <option value="admin_internal">Admin interno</option>
                                <option value="customer_public">Cliente público</option>
                            </select>
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
                                <option value="pending">pending</option>
                                <option value="approved">approved</option>
                                <option value="rejected">rejected</option>
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
                                Origen
                            </label>
                            <select
                                className="input"
                                value={filters.originCategory}
                                onChange={(event) => {
                                    setPageIndex(1)
                                    setFilters((current) => ({
                                        ...current,
                                        originCategory: event.target.value,
                                    }))
                                }}
                            >
                                <option value="all">Todos</option>
                                <option value="conversation_suggested">Intercambio sugerido</option>
                                <option value="conversation_approved">Intercambio aprobado</option>
                                <option value="manual_candidate">Manual</option>
                                <option value="dataset_candidate">Dataset</option>
                            </select>
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Feedback
                            </label>
                            <select
                                className="input"
                                value={filters.hasFeedback}
                                onChange={(event) => {
                                    setPageIndex(1)
                                    setFilters((current) => ({
                                        ...current,
                                        hasFeedback: event.target.value,
                                    }))
                                }}
                            >
                                <option value="all">Todos</option>
                                <option value="true">Con feedback</option>
                                <option value="false">Sin feedback</option>
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
                    <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                            <h5 className="font-semibold text-gray-900">Resultados</h5>
                            <p className="mt-1 text-sm text-gray-500">
                                {total} candidatos encontrados
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
                                {selectedCandidate ? 'Detalle del candidato' : 'Sin selección'}
                            </h5>
                            <p className="mt-1 text-sm text-gray-500">
                                Revisión puntual, edición antes de aprobar y promoción opcional a
                                documento aprobado.
                            </p>
                        </div>
                        {selectedCandidate ? (
                            <CandidateStatusBadge status={selectedCandidate.status} />
                        ) : null}
                    </div>

                    {selectedCandidate ? (
                        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="flex flex-wrap gap-2">
                                        <Badge className="bg-slate-100 text-slate-700">
                                            {selectedCandidate.originCategory}
                                        </Badge>
                                        <Badge className="bg-slate-100 text-slate-700">
                                            {selectedCandidate.contentType}
                                        </Badge>
                                        {selectedCandidate.detectedIntent ? (
                                            <Badge className="bg-sky-50 text-sky-700">
                                                {selectedCandidate.detectedIntent}
                                            </Badge>
                                        ) : null}
                                        {selectedCandidate.channel ? (
                                            <Badge className="bg-violet-50 text-violet-700">
                                                {selectedCandidate.channel}
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <div className="mt-3 text-sm text-gray-700">
                                        {selectedCandidate.redactedExcerpt || selectedCandidate.excerpt}
                                    </div>
                                    {selectedCandidate.contextSummary ? (
                                        <div className="mt-3 text-xs text-gray-500">
                                            {selectedCandidate.contextSummary}
                                        </div>
                                    ) : null}
                                </div>

                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Respuesta sugerida
                                    </div>
                                    <textarea
                                        className="input min-h-[180px] w-full rounded-2xl border border-gray-200 px-4 py-3"
                                        value={approvalContent}
                                        onChange={(event) => setApprovalContent(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="grid gap-4">
                                        <div>
                                            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Título
                                            </div>
                                            <Input
                                                value={approvalTitle}
                                                onChange={(event) => setApprovalTitle(event.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Resumen
                                            </div>
                                            <Input
                                                value={approvalSummary}
                                                onChange={(event) => setApprovalSummary(event.target.value)}
                                            />
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 p-3 text-xs text-gray-600">
                                            Feedback: usadas {selectedCandidate.feedback.used} ·
                                            editadas {selectedCandidate.feedback.edited} · descartadas{' '}
                                            {selectedCandidate.feedback.discarded}
                                        </div>
                                        <div className="rounded-2xl bg-slate-50 p-3 text-xs text-gray-600">
                                            Actualizado {formatDateTime(selectedCandidate.updatedAt)}
                                        </div>
                                    </div>
                                </div>

                                {selectedCandidate.status === 'pending' ? (
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            variant="solid"
                                            loading={
                                                actionLoading ===
                                                `approve:${selectedCandidate.id}:plain`
                                            }
                                            onClick={() =>
                                                void reviewCandidate(selectedCandidate, 'approve', false)
                                            }
                                        >
                                            Aprobar
                                        </Button>
                                        <Button
                                            variant="twoTone"
                                            loading={
                                                actionLoading ===
                                                `approve:${selectedCandidate.id}:promote`
                                            }
                                            onClick={() =>
                                                void reviewCandidate(selectedCandidate, 'approve', true)
                                            }
                                        >
                                            Aprobar y promover
                                        </Button>
                                        <Button
                                            variant="default"
                                            loading={
                                                actionLoading ===
                                                `reject:${selectedCandidate.id}:plain`
                                            }
                                            onClick={() =>
                                                void reviewCandidate(selectedCandidate, 'reject', false)
                                            }
                                        >
                                            Rechazar
                                        </Button>
                                    </div>
                                ) : (
                                    <AlertPreview candidate={selectedCandidate} />
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="mt-5 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-sm text-gray-500">
                            Selecciona un candidato para revisar contexto, respuesta sugerida y
                            acciones disponibles.
                        </div>
                    )}
                </Card>
            </div>
        </Loading>
    )
}

const AlertPreview = ({ candidate }: { candidate: AiKnowledgeCandidate }) => (
    <div className="rounded-2xl bg-slate-50 p-4 text-sm text-gray-600">
        Este candidato ya fue revisado. Estado actual: <strong>{candidate.status}</strong>.
    </div>
)

export default AiKnowledgeCandidates

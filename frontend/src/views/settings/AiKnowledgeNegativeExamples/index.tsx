import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Alert from '@/components/ui/Alert'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import AiKnowledgeService, {
    type AiKnowledgeNegativeExample,
    type ListKnowledgeNegativeExamplesParams,
} from '@/services/AiKnowledgeService'

type NegativeFilters = {
    search: string
    scope: string
    status: string
    sourceKind: string
    channel: string
}

const initialFilters: NegativeFilters = {
    search: '',
    scope: 'all',
    status: 'all',
    sourceKind: 'all',
    channel: 'all',
}

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

const normalizePreview = (
    value: string | null | undefined,
    fallback = 'Sin contenido visible',
) => {
    const normalized = value?.replace(/\s+/g, ' ').trim()
    return normalized || fallback
}

const statusClassName: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    approved: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-rose-100 text-rose-800',
}

const sourceKindClassName: Record<string, string> = {
    rejected_candidate: 'bg-rose-100 text-rose-800',
    discarded_feedback: 'bg-orange-100 text-orange-800',
    manual: 'bg-slate-100 text-slate-700',
}

const scopeOptions = [
    { value: 'all', label: 'Todos los scopes' },
    { value: 'customer_public', label: 'customer_public' },
    { value: 'admin_internal', label: 'admin_internal' },
]

const statusOptions = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'pending', label: 'pending' },
    { value: 'approved', label: 'approved' },
    { value: 'rejected', label: 'rejected' },
]

const sourceKindOptions = [
    { value: 'all', label: 'Todos los orígenes' },
    { value: 'rejected_candidate', label: 'rejected_candidate' },
    { value: 'discarded_feedback', label: 'discarded_feedback' },
    { value: 'manual', label: 'manual' },
]

const channelOptions = [
    { value: 'all', label: 'Todos los canales' },
    { value: 'webchat', label: 'webchat' },
    { value: 'whatsapp', label: 'whatsapp' },
    { value: 'email', label: 'email' },
    { value: 'meta', label: 'meta' },
    { value: 'admin_chat', label: 'admin_chat' },
]

const MetricCard = ({ label, value }: { label: string; value: number }) => (
    <Card bodyClass="p-4">
        <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
        <div className="mt-2 text-2xl font-semibold text-gray-900">{value}</div>
    </Card>
)

const AiKnowledgeNegativeExamplesPage = () => {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const detailSectionRef = useRef<HTMLDivElement | null>(null)
    const [loading, setLoading] = useState(false)
    const [detailLoading, setDetailLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [items, setItems] = useState<AiKnowledgeNegativeExample[]>([])
    const [total, setTotal] = useState(0)
    const [filters, setFilters] = useState<NegativeFilters>(initialFilters)
    const [searchDraft, setSearchDraft] = useState('')
    const [selectedDetail, setSelectedDetail] = useState<AiKnowledgeNegativeExample | null>(null)
    const [titleDraft, setTitleDraft] = useState('')
    const [summaryDraft, setSummaryDraft] = useState('')
    const [correctedTextDraft, setCorrectedTextDraft] = useState('')

    const fetchItems = useCallback(async () => {
        setLoading(true)
        try {
            const params: ListKnowledgeNegativeExamplesParams = {
                page: 1,
                pageSize: 100,
                orderBy: 'updatedAt',
                orderDir: 'desc',
                search: filters.search || undefined,
                scope:
                    filters.scope !== 'all'
                        ? (filters.scope as ListKnowledgeNegativeExamplesParams['scope'])
                        : undefined,
                status:
                    filters.status !== 'all'
                        ? (filters.status as ListKnowledgeNegativeExamplesParams['status'])
                        : undefined,
                sourceKind:
                    filters.sourceKind !== 'all'
                        ? (filters.sourceKind as ListKnowledgeNegativeExamplesParams['sourceKind'])
                        : undefined,
                channel:
                    filters.channel !== 'all'
                        ? (filters.channel as ListKnowledgeNegativeExamplesParams['channel'])
                        : undefined,
            }
            const response = await AiKnowledgeService.listNegativeExamples(params)
            setItems(response.data.items)
            setTotal(response.data.total)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar negative examples" type="danger">
                    Revisa disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [filters])

    useEffect(() => {
        void fetchItems()
    }, [fetchItems])

    const selectedId = useMemo(
        () => searchParams.get('detail')?.trim() || null,
        [searchParams],
    )

    const updateSelected = useCallback(
        (itemId: string | null, options?: { replace?: boolean }) => {
            const nextSearchParams = new URLSearchParams(searchParams)
            if (itemId) {
                nextSearchParams.set('detail', itemId)
            } else {
                nextSearchParams.delete('detail')
            }
            setSearchParams(nextSearchParams, { replace: options?.replace ?? false })
        },
        [searchParams, setSearchParams],
    )

    const selectedFromPage = useMemo(
        () => items.find((item) => item.id === selectedId) ?? null,
        [items, selectedId],
    )

    const loadDetail = useCallback(async (itemId: string) => {
        setDetailLoading(true)
        try {
            const response = await AiKnowledgeService.getNegativeExample(itemId)
            setSelectedDetail(response.data)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible abrir el detalle" type="danger">
                    El negative example ya no existe o no está disponible.
                </Notification>,
                { placement: 'top-end' },
            )
            updateSelected(null, { replace: true })
        } finally {
            setDetailLoading(false)
        }
    }, [updateSelected])

    useEffect(() => {
        if (!selectedId) {
            setSelectedDetail(null)
            setDetailLoading(false)
            return
        }

        if (selectedFromPage && selectedDetail?.id === selectedFromPage.id) {
            return
        }

        void loadDetail(selectedId)
    }, [loadDetail, selectedDetail?.id, selectedFromPage, selectedId])

    useEffect(() => {
        if (!selectedId && items[0]?.id) {
            updateSelected(items[0].id, { replace: true })
        }
    }, [items, selectedId, updateSelected])

    useEffect(() => {
        setTitleDraft(selectedDetail?.title ?? '')
        setSummaryDraft(selectedDetail?.summary ?? '')
        setCorrectedTextDraft(selectedDetail?.correctedText ?? '')
    }, [selectedDetail])

    useEffect(() => {
        if (!selectedId || !detailSectionRef.current) {
            return
        }
        detailSectionRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        })
    }, [selectedDetail, selectedId])

    const selectedItem = selectedDetail ?? selectedFromPage ?? null

    const applySearch = () => {
        setFilters((current) => ({
            ...current,
            search: searchDraft.trim(),
        }))
    }

    const reviewItem = useCallback(async (action: 'approve' | 'reject') => {
        if (!selectedItem) {
            return
        }
        setActionLoading(`${action}:${selectedItem.id}`)
        try {
            await AiKnowledgeService.reviewNegativeExample(selectedItem.id, {
                action,
                title: titleDraft.trim() || undefined,
                summary: summaryDraft.trim() || undefined,
                correctedText: correctedTextDraft.trim() || undefined,
            })
            toast.push(
                <Notification title="Negative example actualizado" type="success">
                    El guardrail ya refleja el nuevo estado.
                </Notification>,
                { placement: 'top-end' },
            )
            await fetchItems()
            await loadDetail(selectedItem.id)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible revisar el negative example" type="danger">
                    Intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setActionLoading(null)
        }
    }, [correctedTextDraft, fetchItems, loadDetail, selectedItem, summaryDraft, titleDraft])

    const pendingCount = useMemo(
        () => items.filter((item) => item.status === 'pending').length,
        [items],
    )
    const approvedCount = useMemo(
        () => items.filter((item) => item.status === 'approved').length,
        [items],
    )
    const sourceKindsCount = useMemo(
        () => new Set(items.map((item) => item.sourceKind)).size,
        [items],
    )

    return (
        <Loading loading={loading && items.length === 0}>
            <div
                className="flex flex-col gap-6"
                data-testid="ai-knowledge-negative-examples-page"
            >
                <Card bodyClass="p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Knowledge
                            </div>
                            <h4 className="mt-1 text-xl font-semibold text-gray-900">
                                Knowledge Negative Examples
                            </h4>
                            <p className="mt-2 max-w-4xl text-sm text-gray-600">
                                Superficie explícita de guardrails. Los examples aprobados entran
                                al snapshot activo como señales negativas trazables para ranking y
                                shaping.
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
                                    navigate(`${APP_PREFIX_PATH}/settings/ai/knowledge/feedback`)
                                }
                            >
                                Abrir feedback
                            </Button>
                            <Button variant="solid" onClick={() => void fetchItems()}>
                                Refrescar
                            </Button>
                        </div>
                    </div>
                </Card>

                <Alert showIcon type="danger">
                    <div className="font-medium">Qué es un negative example aprobado</div>
                    <div className="mt-1 text-sm leading-6">
                        No es contenido para responder mejor, sino un guardrail explícito de lo que
                        el sistema debe evitar reutilizar o afirmar sin respaldo.
                    </div>
                </Alert>

                <div className="grid gap-4 md:grid-cols-4">
                    <MetricCard label="Negative examples" value={total} />
                    <MetricCard label="Pendientes" value={pendingCount} />
                    <MetricCard label="Aprobados" value={approvedCount} />
                    <MetricCard label="Orígenes activos" value={sourceKindsCount} />
                </div>

                <Card bodyClass="p-5">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(4,minmax(0,0.8fr))]">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Buscar
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={searchDraft}
                                    onChange={(event) => setSearchDraft(event.target.value)}
                                    placeholder="intent, texto descartado o resumen"
                                />
                                <Button variant="solid" onClick={applySearch}>
                                    Aplicar
                                </Button>
                            </div>
                        </div>
                        <FilterSelect
                            label="Scope"
                            value={filters.scope}
                            options={scopeOptions}
                            onChange={(value) =>
                                setFilters((current) => ({ ...current, scope: value }))
                            }
                        />
                        <FilterSelect
                            label="Estado"
                            value={filters.status}
                            options={statusOptions}
                            onChange={(value) =>
                                setFilters((current) => ({ ...current, status: value }))
                            }
                        />
                        <FilterSelect
                            label="Origen"
                            value={filters.sourceKind}
                            options={sourceKindOptions}
                            onChange={(value) =>
                                setFilters((current) => ({ ...current, sourceKind: value }))
                            }
                        />
                        <FilterSelect
                            label="Canal"
                            value={filters.channel}
                            options={channelOptions}
                            onChange={(value) =>
                                setFilters((current) => ({ ...current, channel: value }))
                            }
                        />
                    </div>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                    <Card bodyClass="p-0">
                        <div className="divide-y divide-gray-100">
                            {items.length > 0 ? (
                                items.map((item) => {
                                    const isActive = selectedId === item.id
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={`w-full px-5 py-4 text-left transition ${isActive ? 'bg-rose-50' : 'hover:bg-gray-50'}`}
                                            onClick={() => updateSelected(item.id)}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="truncate font-medium text-gray-900">
                                                        {item.title}
                                                    </div>
                                                    <div className="mt-1 line-clamp-2 text-sm text-gray-600">
                                                        {normalizePreview(item.disallowedText)}
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                                                        <span>{item.channel ?? 'sin canal'}</span>
                                                        <span>{item.detectedIntent ?? 'sin intent'}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <Badge
                                                        className={
                                                            statusClassName[item.status] ??
                                                            'bg-slate-100 text-slate-700'
                                                        }
                                                    >
                                                        {item.status}
                                                    </Badge>
                                                    <Badge
                                                        className={
                                                            sourceKindClassName[item.sourceKind] ??
                                                            'bg-slate-100 text-slate-700'
                                                        }
                                                    >
                                                        {item.sourceKind}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </button>
                                    )
                                })
                            ) : (
                                <div className="p-6 text-sm text-gray-500">
                                    No hay negative examples para los filtros actuales.
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card bodyClass="p-5">
                        <div ref={detailSectionRef}>
                            <Loading loading={detailLoading}>
                                {selectedItem ? (
                                    <div className="flex flex-col gap-5">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h5 className="font-semibold text-gray-900">
                                                        {selectedItem.title}
                                                    </h5>
                                                    <Badge
                                                        className={
                                                            statusClassName[selectedItem.status] ??
                                                            'bg-slate-100 text-slate-700'
                                                        }
                                                    >
                                                        {selectedItem.status}
                                                    </Badge>
                                                    <Badge
                                                        className={
                                                            sourceKindClassName[
                                                                selectedItem.sourceKind
                                                            ] ?? 'bg-slate-100 text-slate-700'
                                                        }
                                                    >
                                                        {selectedItem.sourceKind}
                                                    </Badge>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                                                    <span>{selectedItem.scope}</span>
                                                    <span>{selectedItem.channel ?? 'sin canal'}</span>
                                                    <span>
                                                        {selectedItem.detectedIntent ?? 'sin intent'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                Última actividad{' '}
                                                {formatDateTime(selectedItem.updatedAt)}
                                            </div>
                                        </div>

                                        <div className="grid gap-4">
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                    Título
                                                </label>
                                                <Input
                                                    value={titleDraft}
                                                    onChange={(event) =>
                                                        setTitleDraft(event.target.value)
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                    Resumen
                                                </label>
                                                <Input
                                                    value={summaryDraft}
                                                    onChange={(event) =>
                                                        setSummaryDraft(event.target.value)
                                                    }
                                                    placeholder="Qué no debe hacer el agente y por qué"
                                                />
                                            </div>
                                            <div className="grid gap-4 lg:grid-cols-2">
                                                <InfoBlock
                                                    label="Texto a penalizar o evitar"
                                                    value={normalizePreview(
                                                        selectedItem.disallowedText,
                                                    )}
                                                />
                                                <InfoBlock
                                                    label="Texto corregido"
                                                    value={normalizePreview(
                                                        correctedTextDraft ||
                                                            selectedItem.correctedText,
                                                        'Sin corrección sugerida',
                                                    )}
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                    Corrección sugerida
                                                </label>
                                                <Input
                                                    value={correctedTextDraft}
                                                    onChange={(event) =>
                                                        setCorrectedTextDraft(event.target.value)
                                                    }
                                                    placeholder="Versión segura o correcta"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                variant="solid"
                                                loading={actionLoading === `approve:${selectedItem.id}`}
                                                onClick={() => void reviewItem('approve')}
                                            >
                                                Aprobar guardrail
                                            </Button>
                                            <Button
                                                variant="default"
                                                loading={actionLoading === `reject:${selectedItem.id}`}
                                                onClick={() => void reviewItem('reject')}
                                            >
                                                Rechazar guardrail
                                            </Button>
                                            {selectedItem.conversation ? (
                                                <Button
                                                    variant="default"
                                                    onClick={() =>
                                                        navigate(
                                                            `${APP_PREFIX_PATH}/crm/conversations/${selectedItem.conversation?.id}`,
                                                        )
                                                    }
                                                >
                                                    Abrir conversación
                                                </Button>
                                            ) : null}
                                        </div>

                                        <div className="grid gap-4 lg:grid-cols-3">
                                            <InfoBlock
                                                label="Candidate relacionado"
                                                value={
                                                    selectedItem.candidate
                                                        ? `${selectedItem.candidate.title} · ${selectedItem.candidate.status}`
                                                        : 'Sin candidate asociado'
                                                }
                                            />
                                            <InfoBlock
                                                label="Feedback asociado"
                                                value={
                                                    selectedItem.feedback
                                                        ? `${selectedItem.feedback.outcome} · ${normalizePreview(selectedItem.feedback.suggestedText)}`
                                                        : 'Sin feedback asociado'
                                                }
                                            />
                                            <InfoBlock
                                                label="Conversación"
                                                value={
                                                    selectedItem.conversation
                                                        ? `${selectedItem.conversation.subject || selectedItem.conversation.id} · ${selectedItem.conversation.channel}`
                                                        : 'Sin conversación asociada'
                                                }
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500">
                                        Selecciona un negative example para revisar su detalle.
                                    </div>
                                )}
                            </Loading>
                        </div>
                    </Card>
                </div>
            </div>
        </Loading>
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
    options: Array<{ value: string; label: string }>
    onChange: (value: string) => void
}) => (
    <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
        </label>
        <select
            className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-700 outline-none transition focus:border-rose-400"
            value={value}
            onChange={(event) => onChange(event.target.value)}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    </div>
)

const InfoBlock = ({ label, value }: { label: string; value: string }) => (
    <div className="rounded-2xl border border-gray-200 p-4">
        <div className="text-sm font-semibold text-gray-900">{label}</div>
        <p className="mt-2 text-sm leading-6 text-gray-700">{value}</p>
    </div>
)

export default AiKnowledgeNegativeExamplesPage

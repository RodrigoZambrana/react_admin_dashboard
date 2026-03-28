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
    type AiKnowledgeConversationBundle,
    type ListKnowledgeConversationBundlesParams,
} from '@/services/AiKnowledgeService'

type BundleFilters = {
    search: string
    scope: string
    status: string
    channel: string
}

const initialFilters: BundleFilters = {
    search: '',
    scope: 'all',
    status: 'all',
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

const channelOptions = [
    { value: 'all', label: 'Todos los canales' },
    { value: 'webchat', label: 'webchat' },
    { value: 'whatsapp', label: 'whatsapp' },
    { value: 'email', label: 'email' },
    { value: 'meta', label: 'meta' },
    { value: 'admin_chat', label: 'admin_chat' },
]

const MetricCard = ({
    label,
    value,
    tone,
}: {
    label: string
    value: number
    tone: 'sky' | 'slate' | 'amber' | 'emerald'
}) => {
    const toneClassName: Record<typeof tone, string> = {
        sky: 'text-sky-700 bg-sky-50',
        slate: 'text-slate-700 bg-slate-100',
        amber: 'text-amber-700 bg-amber-50',
        emerald: 'text-emerald-700 bg-emerald-50',
    }

    return (
        <Card bodyClass={`p-4 ${toneClassName[tone]}`}>
            <div className="text-xs uppercase tracking-wide opacity-80">{label}</div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
        </Card>
    )
}

const AiKnowledgeConversationBundlesPage = () => {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const detailSectionRef = useRef<HTMLDivElement | null>(null)
    const [loading, setLoading] = useState(false)
    const [detailLoading, setDetailLoading] = useState(false)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [items, setItems] = useState<AiKnowledgeConversationBundle[]>([])
    const [total, setTotal] = useState(0)
    const [filters, setFilters] = useState<BundleFilters>(initialFilters)
    const [searchDraft, setSearchDraft] = useState('')
    const [selectedBundleDetail, setSelectedBundleDetail] =
        useState<AiKnowledgeConversationBundle | null>(null)
    const [summaryDraft, setSummaryDraft] = useState('')

    const fetchBundles = useCallback(async () => {
        setLoading(true)
        try {
            const params: ListKnowledgeConversationBundlesParams = {
                page: 1,
                pageSize: 100,
                orderBy: 'updatedAt',
                orderDir: 'desc',
                search: filters.search || undefined,
                scope:
                    filters.scope !== 'all'
                        ? (filters.scope as ListKnowledgeConversationBundlesParams['scope'])
                        : undefined,
                status:
                    filters.status !== 'all'
                        ? (filters.status as ListKnowledgeConversationBundlesParams['status'])
                        : undefined,
                channel:
                    filters.channel !== 'all'
                        ? (filters.channel as ListKnowledgeConversationBundlesParams['channel'])
                        : undefined,
            }
            const response = await AiKnowledgeService.listConversationBundles(params)
            setItems(response.data.items)
            setTotal(response.data.total)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar conversation bundles" type="danger">
                    Revisa disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [filters])

    useEffect(() => {
        void fetchBundles()
    }, [fetchBundles])

    const selectedBundleId = useMemo(
        () => searchParams.get('detail')?.trim() || null,
        [searchParams],
    )

    const updateSelectedBundle = useCallback(
        (bundleId: string | null, options?: { replace?: boolean }) => {
            const nextSearchParams = new URLSearchParams(searchParams)
            if (bundleId) {
                nextSearchParams.set('detail', bundleId)
            } else {
                nextSearchParams.delete('detail')
            }
            setSearchParams(nextSearchParams, { replace: options?.replace ?? false })
        },
        [searchParams, setSearchParams],
    )

    const selectedBundleFromPage = useMemo(
        () => items.find((item) => item.id === selectedBundleId) ?? null,
        [items, selectedBundleId],
    )

    const loadBundleDetail = useCallback(async (bundleId: string) => {
        setDetailLoading(true)
        try {
            const response = await AiKnowledgeService.getConversationBundle(bundleId)
            setSelectedBundleDetail(response.data)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible abrir el bundle" type="danger">
                    El bundle ya no existe o no está disponible.
                </Notification>,
                { placement: 'top-end' },
            )
            updateSelectedBundle(null, { replace: true })
        } finally {
            setDetailLoading(false)
        }
    }, [updateSelectedBundle])

    useEffect(() => {
        if (!selectedBundleId) {
            setSelectedBundleDetail(null)
            setDetailLoading(false)
            return
        }

        if (selectedBundleFromPage && selectedBundleDetail?.id === selectedBundleFromPage.id) {
            return
        }

        void loadBundleDetail(selectedBundleId)
    }, [loadBundleDetail, selectedBundleDetail?.id, selectedBundleFromPage, selectedBundleId])

    useEffect(() => {
        if (!selectedBundleId && items[0]?.id) {
            updateSelectedBundle(items[0].id, { replace: true })
        }
    }, [items, selectedBundleId, updateSelectedBundle])

    useEffect(() => {
        setSummaryDraft(selectedBundleDetail?.summary ?? '')
    }, [selectedBundleDetail])

    useEffect(() => {
        if (!selectedBundleId || !detailSectionRef.current) {
            return
        }
        detailSectionRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        })
    }, [selectedBundleDetail, selectedBundleId])

    const selectedBundle = selectedBundleDetail ?? selectedBundleFromPage ?? null

    const applySearch = () => {
        setFilters((current) => ({
            ...current,
            search: searchDraft.trim(),
        }))
    }

    const reviewBundle = useCallback(async (action: 'approve' | 'reject') => {
        if (!selectedBundle) {
            return
        }
        setActionLoading(`${action}:${selectedBundle.id}`)
        try {
            await AiKnowledgeService.reviewConversationBundle(selectedBundle.id, {
                action,
                summary: summaryDraft.trim() || undefined,
            })
            toast.push(
                <Notification title="Bundle actualizado" type="success">
                    El bundle ya refleja el nuevo estado.
                </Notification>,
                { placement: 'top-end' },
            )
            await fetchBundles()
            await loadBundleDetail(selectedBundle.id)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible revisar el bundle" type="danger">
                    Intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setActionLoading(null)
        }
    }, [fetchBundles, loadBundleDetail, selectedBundle, summaryDraft])

    const approvedCount = useMemo(
        () => items.filter((item) => item.status === 'approved').length,
        [items],
    )
    const pendingCount = useMemo(
        () => items.filter((item) => item.status === 'pending').length,
        [items],
    )

    return (
        <Loading loading={loading && items.length === 0}>
            <div
                className="flex flex-col gap-6"
                data-testid="ai-knowledge-conversation-bundles-page"
            >
                <Card bodyClass="p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Knowledge
                            </div>
                            <h4 className="mt-1 text-xl font-semibold text-gray-900">
                                Knowledge Conversation Bundles
                            </h4>
                            <p className="mt-2 max-w-4xl text-sm text-gray-600">
                                Unidad multi-turno futura. Ya no es solo una vista exploratoria:
                                los bundles aprobados pasan a alimentar el snapshot activo como
                                soporte secundario trazable.
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
                                    navigate(
                                        `${APP_PREFIX_PATH}/settings/ai/knowledge/manage-articles`,
                                    )
                                }
                            >
                                Abrir training board
                            </Button>
                            <Button variant="solid" onClick={() => void fetchBundles()}>
                                Refrescar
                            </Button>
                        </div>
                    </div>
                </Card>

                <Alert showIcon type="info">
                    <div className="font-medium">Qué representa un bundle</div>
                    <div className="mt-1 text-sm leading-6">
                        Resume una secuencia multi-turno aprobable. No reemplaza la unidad actual
                        de <strong>pregunta + respuesta</strong>, pero la complementa cuando el
                        valor real está en la secuencia completa y no en un único intercambio.
                    </div>
                </Alert>

                <div className="grid gap-4 md:grid-cols-4">
                    <MetricCard label="Bundles detectados" value={total} tone="sky" />
                    <MetricCard label="Bundles pendientes" value={pendingCount} tone="amber" />
                    <MetricCard label="Bundles aprobados" value={approvedCount} tone="emerald" />
                    <MetricCard
                        label="Intercambios agregados"
                        value={items.reduce((sum, item) => sum + item.eventCount, 0)}
                        tone="slate"
                    />
                </div>

                <Card bodyClass="p-5">
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,0.8fr))]">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Buscar
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    value={searchDraft}
                                    onChange={(event) => setSearchDraft(event.target.value)}
                                    placeholder="asunto, intent, resumen o contenido"
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
                                items.map((bundle) => {
                                    const isActive = selectedBundleId === bundle.id
                                    return (
                                        <button
                                            key={bundle.id}
                                            type="button"
                                            className={`w-full px-5 py-4 text-left transition ${isActive ? 'bg-sky-50' : 'hover:bg-gray-50'}`}
                                            onClick={() => updateSelectedBundle(bundle.id)}
                                        >
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="min-w-0">
                                                    <div className="truncate font-medium text-gray-900">
                                                        {bundle.title}
                                                    </div>
                                                    <div className="mt-1 line-clamp-2 text-sm text-gray-600">
                                                        {normalizePreview(bundle.previewQuestion)}
                                                    </div>
                                                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                                                        <span>{bundle.conversation?.channel ?? 'sin canal'}</span>
                                                        <span>{bundle.scope}</span>
                                                        <span>{bundle.eventCount} intercambios</span>
                                                        <span>{bundle.candidateCount} candidates</span>
                                                    </div>
                                                </div>
                                                <Badge
                                                    className={
                                                        statusClassName[bundle.status] ??
                                                        'bg-slate-100 text-slate-700'
                                                    }
                                                >
                                                    {bundle.status}
                                                </Badge>
                                            </div>
                                        </button>
                                    )
                                })
                            ) : (
                                <div className="p-6 text-sm text-gray-500">
                                    No hay bundles para los filtros actuales.
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card bodyClass="p-5">
                        <div ref={detailSectionRef}>
                            <Loading loading={detailLoading}>
                                {selectedBundle ? (
                                    <div className="flex flex-col gap-5">
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h5 className="font-semibold text-gray-900">
                                                        {selectedBundle.title}
                                                    </h5>
                                                    <Badge
                                                        className={
                                                            statusClassName[selectedBundle.status] ??
                                                            'bg-slate-100 text-slate-700'
                                                        }
                                                    >
                                                        {selectedBundle.status}
                                                    </Badge>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                    <Badge className="bg-slate-100 text-slate-700">
                                                        {selectedBundle.conversation?.channel ??
                                                            'sin canal'}
                                                    </Badge>
                                                    <Badge className="bg-slate-100 text-slate-700">
                                                        {selectedBundle.scope}
                                                    </Badge>
                                                    <Badge className="bg-emerald-100 text-emerald-800">
                                                        {selectedBundle.approvedCount} aprobados
                                                    </Badge>
                                                    <Badge className="bg-amber-100 text-amber-800">
                                                        {selectedBundle.pendingCount} pendientes
                                                    </Badge>
                                                </div>
                                            </div>
                                            <div className="text-sm text-gray-500">
                                                Última actividad{' '}
                                                {formatDateTime(selectedBundle.updatedAt)}
                                            </div>
                                        </div>

                                        <div className="grid gap-4 lg:grid-cols-2">
                                            <InfoBlock
                                                label="Pregunta representativa"
                                                value={normalizePreview(
                                                    selectedBundle.previewQuestion,
                                                )}
                                            />
                                            <InfoBlock
                                                label="Respuesta representativa"
                                                value={normalizePreview(
                                                    selectedBundle.previewResponse,
                                                )}
                                            />
                                        </div>

                                        <div>
                                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Resumen del bundle
                                            </label>
                                            <Input
                                                value={summaryDraft}
                                                onChange={(event) =>
                                                    setSummaryDraft(event.target.value)
                                                }
                                                placeholder="Resumen operativo que justifique el bundle"
                                            />
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                variant="solid"
                                                loading={actionLoading === `approve:${selectedBundle.id}`}
                                                onClick={() => void reviewBundle('approve')}
                                            >
                                                Aprobar bundle
                                            </Button>
                                            <Button
                                                variant="default"
                                                loading={actionLoading === `reject:${selectedBundle.id}`}
                                                onClick={() => void reviewBundle('reject')}
                                            >
                                                Rechazar bundle
                                            </Button>
                                            {selectedBundle.conversation ? (
                                                <Button
                                                    variant="default"
                                                    onClick={() =>
                                                        navigate(
                                                            `${APP_PREFIX_PATH}/crm/conversations/${selectedBundle.conversation?.id}`,
                                                        )
                                                    }
                                                >
                                                    Abrir conversación
                                                </Button>
                                            ) : null}
                                        </div>

                                        <div className="grid gap-4 lg:grid-cols-2">
                                            <div>
                                                <div className="mb-3 text-sm font-semibold text-gray-900">
                                                    Raw events
                                                </div>
                                                <div className="space-y-3">
                                                    {selectedBundle.rawEvents &&
                                                    selectedBundle.rawEvents.length > 0 ? (
                                                        selectedBundle.rawEvents.map((event) => (
                                                            <div
                                                                key={event.id}
                                                                className="rounded-2xl border border-gray-200 p-4"
                                                            >
                                                                <div className="text-xs uppercase tracking-wide text-gray-400">
                                                                    {event.sourceAuthorType} ·{' '}
                                                                    {formatDateTime(
                                                                        event.updatedAt,
                                                                    )}
                                                                </div>
                                                                <div className="mt-2 text-sm text-gray-800">
                                                                    {normalizePreview(
                                                                        event.userMessage,
                                                                    )}
                                                                </div>
                                                                <div className="mt-2 text-xs text-gray-500">
                                                                    Respuesta:{' '}
                                                                    {normalizePreview(
                                                                        event.operatorReply ??
                                                                            event.aiReply ??
                                                                            event.suggestedResponse,
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <EmptyDetail text="Este bundle todavía no expone raw events en detalle." />
                                                    )}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="mb-3 text-sm font-semibold text-gray-900">
                                                    Candidates asociados
                                                </div>
                                                <div className="space-y-3">
                                                    {selectedBundle.candidates &&
                                                    selectedBundle.candidates.length > 0 ? (
                                                        selectedBundle.candidates.map((candidate) => (
                                                            <div
                                                                key={candidate.id}
                                                                className="rounded-2xl border border-gray-200 p-4"
                                                            >
                                                                <div className="flex items-start justify-between gap-3">
                                                                    <div className="font-medium text-gray-900">
                                                                        {candidate.title}
                                                                    </div>
                                                                    <Badge
                                                                        className={
                                                                            statusClassName[
                                                                                candidate.status
                                                                            ] ??
                                                                            'bg-slate-100 text-slate-700'
                                                                        }
                                                                    >
                                                                        {candidate.status}
                                                                    </Badge>
                                                                </div>
                                                                <div className="mt-2 text-sm text-gray-700">
                                                                    {normalizePreview(
                                                                        candidate.approvedResponse ??
                                                                            candidate.suggestedResponse ??
                                                                            candidate.excerpt,
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <EmptyDetail text="Este bundle todavía no tiene candidates asociados." />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500">
                                        Selecciona un bundle para revisar su composición multi-turno.
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
            className="h-11 w-full rounded-xl border border-gray-200 px-3 text-sm text-gray-700 outline-none transition focus:border-sky-400"
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

const EmptyDetail = ({ text }: { text: string }) => (
    <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
        {text}
    </div>
)

export default AiKnowledgeConversationBundlesPage

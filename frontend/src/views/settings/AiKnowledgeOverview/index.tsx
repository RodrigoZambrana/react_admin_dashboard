import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Progress from '@/components/ui/Progress'
import Timeline from '@/components/ui/Timeline'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import AiKnowledgeService, {
    type AiKnowledgeCandidate,
    type AiKnowledgeDocument,
    type AiKnowledgeIngestionRun,
    type AiKnowledgeOverview,
    type AiKnowledgeRawEvent,
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

const formatRelativeTime = (value: string | null) => {
    if (!value) return 'sin referencia'
    const date = new Date(value)
    const diffMs = date.getTime() - Date.now()
    const diffMinutes = Math.round(diffMs / 60000)
    const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

    if (Math.abs(diffMinutes) < 60) {
        return formatter.format(diffMinutes, 'minute')
    }

    const diffHours = Math.round(diffMinutes / 60)
    if (Math.abs(diffHours) < 24) {
        return formatter.format(diffHours, 'hour')
    }

    const diffDays = Math.round(diffHours / 24)
    return formatter.format(diffDays, 'day')
}

const humanizeKey = (value: string) =>
    value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())

const originLabels: Record<string, string> = {
    uploaded_document: 'Documento subido',
    manual_entry: 'Carga manual',
    conversation_approved: 'Intercambio aprobado',
    conversation_suggested: 'Intercambio sugerido',
    dataset_snapshot: 'Dataset interno',
    trusted_doc: 'Documento confiable',
    manual_candidate: 'Candidato manual',
    dataset_candidate: 'Candidato de dataset',
}

type OriginMetric = {
    key: string
    label: string
    total: number
    approved: number
    pending: number
}

type TimelineEntry = {
    id: string
    title: string
    description: string
    date: string
    type: 'document' | 'candidate' | 'raw-event' | 'run'
}

const AiKnowledgeOverviewPage = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [overview, setOverview] = useState<AiKnowledgeOverview | null>(null)
    const [documents, setDocuments] = useState<AiKnowledgeDocument[]>([])
    const [candidates, setCandidates] = useState<AiKnowledgeCandidate[]>([])
    const [rawEvents, setRawEvents] = useState<AiKnowledgeRawEvent[]>([])
    const [ingestionRuns, setIngestionRuns] = useState<AiKnowledgeIngestionRun[]>([])

    const loadOverview = useCallback(async () => {
        setLoading(true)
        try {
            const [
                overviewResponse,
                documentsResponse,
                candidatesResponse,
                rawEventsResponse,
                ingestionRunsResponse,
            ] = await Promise.all([
                AiKnowledgeService.getOverview(),
                AiKnowledgeService.listDocuments({
                    pageSize: 120,
                    orderBy: 'updatedAt',
                    orderDir: 'desc',
                }),
                AiKnowledgeService.listCandidates({
                    pageSize: 120,
                    orderBy: 'updatedAt',
                    orderDir: 'desc',
                }),
                AiKnowledgeService.listRawEvents({
                    pageSize: 120,
                    orderBy: 'updatedAt',
                    orderDir: 'desc',
                }),
                AiKnowledgeService.listIngestionRuns({
                    pageSize: 24,
                    orderBy: 'createdAt',
                    orderDir: 'desc',
                }),
            ])

            setOverview(overviewResponse.data)
            setDocuments(documentsResponse.data.items)
            setCandidates(candidatesResponse.data.items)
            setRawEvents(rawEventsResponse.data.items)
            setIngestionRuns(ingestionRunsResponse.data.items)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar el overview de knowledge" type="danger">
                    Verifica disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadOverview()
    }, [loadOverview])

    const metrics = useMemo(() => {
        const totalDocuments =
            overview?.documents.reduce((sum, item) => sum + item.count, 0) ?? 0
        const activeDocuments =
            overview?.documents
                .filter((item) => item.status === 'active')
                .reduce((sum, item) => sum + item.count, 0) ?? 0
        const pendingCandidates =
            overview?.candidates
                .filter((item) => item.status === 'pending')
                .reduce((sum, item) => sum + item.count, 0) ?? 0
        const approvedCandidates =
            overview?.candidates
                .filter((item) => item.status === 'approved')
                .reduce((sum, item) => sum + item.count, 0) ?? 0
        const rejectedCandidates =
            overview?.candidates
                .filter((item) => item.status === 'rejected')
                .reduce((sum, item) => sum + item.count, 0) ?? 0
        const detectedEvents =
            overview?.rawEvents.reduce((sum, item) => sum + item.count, 0) ?? 0
        const runningIngestionRuns =
            overview?.ingestionRuns
                .filter((item) => item.status === 'running')
                .reduce((sum, item) => sum + item.count, 0) ?? 0

        const maturityBase = activeDocuments + pendingCandidates + detectedEvents
        const maturityPercent =
            maturityBase > 0
                ? Math.round((activeDocuments / maturityBase) * 100)
                : 0

        return {
            totalDocuments,
            activeDocuments,
            pendingCandidates,
            approvedCandidates,
            rejectedCandidates,
            detectedEvents,
            runningIngestionRuns,
            maturityPercent,
        }
    }, [overview])

    const originMetrics = useMemo<OriginMetric[]>(() => {
        const summary = new Map<string, OriginMetric>()

        documents.forEach((document) => {
            const key = document.originCategory
            const current = summary.get(key) ?? {
                key,
                label: originLabels[key] ?? humanizeKey(key),
                total: 0,
                approved: 0,
                pending: 0,
            }
            current.total += 1
            current.approved += 1
            summary.set(key, current)
        })

        candidates.forEach((candidate) => {
            const key = candidate.originCategory
            const current = summary.get(key) ?? {
                key,
                label: originLabels[key] ?? humanizeKey(key),
                total: 0,
                approved: 0,
                pending: 0,
            }
            current.total += 1
            if (candidate.status === 'approved') {
                current.approved += 1
            }
            if (candidate.status === 'pending') {
                current.pending += 1
            }
            summary.set(key, current)
        })

        return Array.from(summary.values()).sort((left, right) => right.total - left.total)
    }, [documents, candidates])

    const timelineEntries = useMemo<TimelineEntry[]>(() => {
        const items: TimelineEntry[] = [
            ...documents.slice(0, 6).map((document) => ({
                id: `document:${document.id}`,
                title: `Documento ${document.title}`,
                description: `${humanizeKey(document.originCategory)} · ${document.scope}`,
                date: document.updatedAt,
                type: 'document' as const,
            })),
            ...candidates.slice(0, 6).map((candidate) => ({
                id: `candidate:${candidate.id}`,
                title: `Candidato ${candidate.title}`,
                description: `${candidate.status} · ${candidate.detectedIntent ?? 'sin intent'}`,
                date: candidate.updatedAt,
                type: 'candidate' as const,
            })),
            ...rawEvents.slice(0, 6).map((event) => ({
                id: `raw:${event.id}`,
                title: `Detectado desde ${event.channel}`,
                description: event.userMessage.slice(0, 140),
                date: event.updatedAt,
                type: 'raw-event' as const,
            })),
            ...ingestionRuns.slice(0, 4).map((run) => ({
                id: `run:${run.id}`,
                title: `Corrida ${run.sourceType}`,
                description: `${run.status} · ${run.processedCount} procesados · ${run.createdCandidates} candidatos`,
                date: run.updatedAt,
                type: 'run' as const,
            })),
        ]

        return items
            .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime())
            .slice(0, 10)
    }, [candidates, documents, ingestionRuns, rawEvents])

    const latestKnowledgeUpdate = useMemo(() => {
        const dates = [
            ...documents.map((item) => item.updatedAt),
            ...candidates.map((item) => item.updatedAt),
            ...rawEvents.map((item) => item.updatedAt),
            ...ingestionRuns.map((item) => item.updatedAt),
        ]
            .map((value) => new Date(value).getTime())
            .filter((value) => Number.isFinite(value))

        if (!dates.length) {
            return null
        }

        return new Date(Math.max(...dates)).toISOString()
    }, [candidates, documents, ingestionRuns, rawEvents])

    const summaryText = useMemo(() => {
        const feedback = overview?.feedback
        return `Actualmente el agente responde con ${metrics.activeDocuments} elementos incorporados, ${metrics.approvedCandidates} candidatos ya validados y ${metrics.pendingCandidates} elementos todavía en revisión. ${feedback?.applied ?? 0} sugerencias ya fueron reutilizadas por operadores con una adopción de ${Math.round((feedback?.adoptionRate ?? 0) * 100)}%.`
    }, [metrics.activeDocuments, metrics.approvedCandidates, metrics.pendingCandidates, overview?.feedback])

    const recentApprovedDocuments = useMemo(
        () =>
            documents
                .filter((item) => item.status === 'active')
                .sort(
                    (left, right) =>
                        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
                )
                .slice(0, 6),
        [documents],
    )

    return (
        <Loading loading={loading && !overview}>
            <div className="flex flex-col gap-6" data-testid="ai-knowledge-overview-page">
                <Card bodyClass="p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Knowledge
                            </div>
                            <h4 className="mt-1 text-xl font-semibold text-gray-900">
                                Knowledge Overview
                            </h4>
                            <p className="mt-2 max-w-4xl text-sm text-gray-600">
                                Vista general del conocimiento aprobado y del entrenamiento visible
                                del agente. Esta superficie explica qué sabe hoy el agente, cómo se
                                alimenta y qué parte del flujo todavía está bajo revisión humana.
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
                            <Button
                                variant="default"
                                onClick={() =>
                                    navigate(
                                        `${APP_PREFIX_PATH}/settings/ai/knowledge/manage-articles`,
                                    )
                                }
                            >
                                Training board
                            </Button>
                            <Button
                                variant="default"
                                onClick={() =>
                                    navigate(
                                        `${APP_PREFIX_PATH}/settings/ai/knowledge/snapshots`,
                                    )
                                }
                            >
                                Snapshots
                            </Button>
                            <Button variant="solid" loading={loading} onClick={() => void loadOverview()}>
                                Refrescar
                            </Button>
                        </div>
                    </div>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card bodyClass="p-5">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            Detectado
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-gray-900">
                            {metrics.detectedEvents}
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                            Interacciones observadas que alimentan el entrenamiento.
                        </p>
                    </Card>
                    <Card bodyClass="p-5">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            En revisión
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-amber-600">
                            {metrics.pendingCandidates}
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                            Candidatos pendientes de revisión o aprobación humana.
                        </p>
                    </Card>
                    <Card bodyClass="p-5">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            Aprobado
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-sky-600">
                            {metrics.approvedCandidates}
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                            Conocimiento validado listo para promoción o reuse.
                        </p>
                    </Card>
                    <Card bodyClass="p-5">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            Incorporado
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-emerald-600">
                            {metrics.activeDocuments}
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                            Documentos activos ya incorporados a la base de conocimiento.
                        </p>
                    </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
                    <Card bodyClass="p-5">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h5 className="font-semibold text-gray-900">
                                    Estado del conocimiento
                                </h5>
                                <p className="mt-1 text-sm text-gray-500">
                                    El entrenamiento visible avanza de detectado a incorporado con
                                    validación humana intermedia.
                                </p>
                            </div>
                            <Badge className="bg-slate-100 text-slate-700">
                                Actualizado {formatRelativeTime(latestKnowledgeUpdate)}
                            </Badge>
                        </div>
                        <div className="mt-5">
                            <Progress percent={metrics.maturityPercent} />
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                            <span>Cobertura visible: {metrics.maturityPercent}%</span>
                            <span>Documentos activos: {metrics.activeDocuments}</span>
                            <span>Corridas activas: {metrics.runningIngestionRuns}</span>
                        </div>
                        <div className="mt-2 text-xs leading-5 text-gray-500">
                            Indicador operativo del corpus aprobado. No mide calidad ni madurez
                            del modelo; usa la relación entre documentos activos, candidatos
                            pendientes y observaciones detectadas.
                        </div>
                        <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm leading-6 text-gray-700">
                            {summaryText}
                        </div>
                    </Card>

                    <Card bodyClass="p-5">
                        <h5 className="font-semibold text-gray-900">Feedback de reuse</h5>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                            <div className="rounded-2xl border border-gray-200 p-4">
                                <div className="text-xs uppercase tracking-wide text-gray-400">
                                    Used
                                </div>
                                <div className="mt-2 text-2xl font-semibold">
                                    {overview?.feedback.used ?? 0}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-gray-200 p-4">
                                <div className="text-xs uppercase tracking-wide text-gray-400">
                                    Edited
                                </div>
                                <div className="mt-2 text-2xl font-semibold">
                                    {overview?.feedback.edited ?? 0}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-gray-200 p-4">
                                <div className="text-xs uppercase tracking-wide text-gray-400">
                                    Discarded
                                </div>
                                <div className="mt-2 text-2xl font-semibold">
                                    {overview?.feedback.discarded ?? 0}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-gray-200 p-4">
                                <div className="text-xs uppercase tracking-wide text-gray-400">
                                    Adopción
                                </div>
                                <div className="mt-2 text-2xl font-semibold">
                                    {Math.round((overview?.feedback.adoptionRate ?? 0) * 100)}%
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <Card bodyClass="p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h5 className="font-semibold text-gray-900">
                                    Fuentes y origen del conocimiento
                                </h5>
                                <p className="mt-1 text-sm text-gray-500">
                                    Mapa operativo de cómo entra hoy el conocimiento al sistema.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="default"
                                onClick={() =>
                                    navigate(
                                        `${APP_PREFIX_PATH}/settings/ai/knowledge/documents`,
                                    )
                                }
                            >
                                Abrir documentos
                            </Button>
                        </div>
                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                            {originMetrics.slice(0, 6).map((metric) => (
                                <div
                                    key={metric.key}
                                    className="rounded-2xl border border-gray-200 p-4"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="font-medium text-gray-900">
                                            {metric.label}
                                        </div>
                                        <Badge className="bg-slate-100 text-slate-700">
                                            {metric.total}
                                        </Badge>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
                                        <span>Aprobado: {metric.approved}</span>
                                        <span>Pendiente: {metric.pending}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    <Card bodyClass="p-5">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h5 className="font-semibold text-gray-900">
                                    Timeline de conocimiento
                                </h5>
                                <p className="mt-1 text-sm text-gray-500">
                                    Cambios recientes desde observación hasta incorporación.
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="default"
                                onClick={() =>
                                    navigate(
                                        `${APP_PREFIX_PATH}/settings/ai/knowledge/ingestion-runs`,
                                    )
                                }
                            >
                                Ver corridas
                            </Button>
                        </div>
                        <div className="mt-5">
                            <Timeline>
                                {timelineEntries.map((entry) => (
                                    <Timeline.Item key={entry.id}>
                                        <div className="flex flex-col gap-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="font-medium text-gray-900">
                                                    {entry.title}
                                                </span>
                                                <Badge className="bg-slate-100 text-slate-700">
                                                    {entry.type}
                                                </Badge>
                                            </div>
                                            <div className="text-sm text-gray-600">
                                                {entry.description}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                                {formatDateTime(entry.date)}
                                            </div>
                                        </div>
                                    </Timeline.Item>
                                ))}
                            </Timeline>
                        </div>
                    </Card>
                </div>

                <Card bodyClass="p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h5 className="font-semibold text-gray-900">
                                Contenido aprobado reciente
                            </h5>
                            <p className="mt-1 text-sm text-gray-500">
                                Muestra rápida de lo que hoy ya puede utilizar el agente.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            variant="default"
                            onClick={() =>
                                navigate(
                                    `${APP_PREFIX_PATH}/settings/ai/knowledge/manage-articles`,
                                )
                            }
                        >
                            Abrir training board
                        </Button>
                    </div>
                    <div className="mt-5 grid gap-3 xl:grid-cols-2">
                        {recentApprovedDocuments.map((document) => (
                            <button
                                key={document.id}
                                type="button"
                                className="rounded-2xl border border-gray-200 p-4 text-left transition hover:border-primary hover:bg-slate-50"
                                onClick={() =>
                                    navigate(
                                        `${APP_PREFIX_PATH}/settings/ai/knowledge/documents`,
                                    )
                                }
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="font-medium text-gray-900">{document.title}</div>
                                    <Badge className="bg-emerald-50 text-emerald-700">
                                        incorporado
                                    </Badge>
                                </div>
                                {document.summary ? (
                                    <div className="mt-2 text-sm text-gray-600">
                                        {document.summary}
                                    </div>
                                ) : null}
                                <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                                    <span>{humanizeKey(document.originCategory)}</span>
                                    <span>{document.scope}</span>
                                    <span>{formatDateTime(document.updatedAt)}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </Card>
            </div>
        </Loading>
    )
}

export default AiKnowledgeOverviewPage

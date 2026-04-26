import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Alert from '@/components/ui/Alert'
import Progress from '@/components/ui/Progress'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import {
    apiGetAiActionsCatalog,
    apiGetAiRuntimeConfig,
    type AiActionCatalogEntry,
    type AiRuntimeConfigResponse,
} from '@/services/AiRuntimeService'
import AiKnowledgeService, {
    type AiKnowledgeOverview,
} from '@/services/AiKnowledgeService'

type AiDestination = {
    key: string
    title: string
    description: string
    path: string
    metric?: string
    badge?: string
}

const formatPercent = (value: number) => `${Math.round(value * 100)}%`

const formatDateTime = (value: string | null) => {
    if (!value) return 'Sin actualización registrada'
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: 'medium',
            timeStyle: 'short',
        }).format(new Date(value))
    } catch {
        return value
    }
}

const AiHomePage = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [runtime, setRuntime] = useState<AiRuntimeConfigResponse | null>(null)
    const [overview, setOverview] = useState<AiKnowledgeOverview | null>(null)
    const [actions, setActions] = useState<AiActionCatalogEntry[]>([])

    const loadHome = useCallback(async () => {
        setLoading(true)
        try {
            const [runtimeResponse, overviewResponse, actionsResponse] =
                await Promise.all([
                    apiGetAiRuntimeConfig(),
                    AiKnowledgeService.getOverview(),
                    apiGetAiActionsCatalog(),
                ])

            setRuntime(runtimeResponse.data)
            setOverview(overviewResponse.data)
            setActions(actionsResponse.data)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar el hub de IA" type="danger">
                    Revisa disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadHome()
    }, [loadHome])

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
        const observedEvents =
            overview?.rawEvents.reduce((sum, item) => sum + item.count, 0) ?? 0
        const runningRuns =
            overview?.ingestionRuns
                .filter((item) => item.status === 'running')
                .reduce((sum, item) => sum + item.count, 0) ?? 0
        const maturityBase = activeDocuments + pendingCandidates + observedEvents
        const maturityPercent =
            maturityBase > 0 ? Math.round((activeDocuments / maturityBase) * 100) : 0

        return {
            totalDocuments,
            activeDocuments,
            pendingCandidates,
            observedEvents,
            runningRuns,
            maturityPercent,
            feedback: overview?.feedback ?? {
                used: 0,
                edited: 0,
                discarded: 0,
                total: 0,
                applied: 0,
                adoptionRate: 0,
                discardRate: 0,
            },
        }
    }, [overview])

    const moduleLinks = useMemo<AiDestination[]>(
        () => [
            {
                key: 'runtime',
                title: 'Runtime',
                description:
                    'Proveedor, prompts, límites de uso y catálogo operativo del agente.',
                path: `${APP_PREFIX_PATH}/settings/ai/runtime`,
                metric: `${actions.filter((entry) => entry.scope === 'admin_internal').length} acciones internas`,
            },
            {
                key: 'knowledge-overview',
                title: 'Knowledge Overview',
                description:
                    'Cobertura operativa del conocimiento, estado del entrenamiento y fuentes activas.',
                path: `${APP_PREFIX_PATH}/settings/ai/knowledge/overview`,
                metric: `${metrics.totalDocuments} documentos`,
            },
            {
                key: 'knowledge-snapshots',
                title: 'Knowledge Snapshots',
                description:
                    'Digest trazable de qué interpreta hoy el sistema, sus fuentes y los cambios entre versiones.',
                path: `${APP_PREFIX_PATH}/settings/ai/knowledge/snapshots`,
                metric: `${metrics.activeDocuments} activos / ${metrics.pendingCandidates} pendientes`,
            },
            {
                key: 'manage-articles',
                title: 'Manage Articles',
                description:
                    'Tablero operativo del entrenamiento con avance por estados.',
                path: `${APP_PREFIX_PATH}/settings/ai/knowledge/manage-articles`,
                metric: `${metrics.pendingCandidates} pendientes`,
            },
            {
                key: 'quote-profiles',
                title: 'Quote Profiles',
                description:
                    'Perfiles editables para intake mínimo, estrategia de pricing y cierre operativo por tipo de cotización.',
                path: `${APP_PREFIX_PATH}/settings/ai/knowledge/quote-profiles`,
                badge: 'customer intake',
            },
            {
                key: 'documents',
                title: 'Documents',
                description:
                    'ABM del contenido aprobado y curado que puede reutilizar el sistema.',
                path: `${APP_PREFIX_PATH}/settings/ai/knowledge/documents`,
                metric: `${metrics.activeDocuments} activos`,
            },
            {
                key: 'candidates',
                title: 'Candidates',
                description:
                    'Revisión puntual de intercambios sugeridos antes de aprobarlos.',
                path: `${APP_PREFIX_PATH}/settings/ai/knowledge/candidates`,
                metric: `${metrics.pendingCandidates} en revisión`,
            },
            {
                key: 'raw-events',
                title: 'Raw Events',
                description:
                    'Diagnóstico de observaciones crudas y origen de cada ingreso.',
                path: `${APP_PREFIX_PATH}/settings/ai/knowledge/raw-events`,
                metric: `${metrics.observedEvents} observaciones`,
            },
            {
                key: 'ingestion-runs',
                title: 'Ingestion Runs',
                description:
                    'Seguimiento de corridas, volúmenes procesados y errores operativos.',
                path: `${APP_PREFIX_PATH}/settings/ai/knowledge/ingestion-runs`,
                metric: `${metrics.runningRuns} en curso`,
            },
            {
                key: 'feedback',
                title: 'Feedback',
                description:
                    'Uso, edición y descarte de sugerencias aprobadas por operadores.',
                path: `${APP_PREFIX_PATH}/settings/ai/knowledge/feedback`,
                metric: `${metrics.feedback.applied} sugerencias aplicadas`,
            },
            {
                key: 'conversation-bundles',
                title: 'Conversation Bundles',
                description:
                    'Superficie exploratoria para detectar hilos multi-turno candidatos a aprobación futura por secuencia completa.',
                path: `${APP_PREFIX_PATH}/settings/ai/knowledge/conversation-bundles`,
                badge: 'exploratorio',
            },
            {
                key: 'negative-examples',
                title: 'Negative Examples',
                description:
                    'Respuestas descartadas, rechazadas o inseguras que deben penalizar ranking, reuse y guardrails.',
                path: `${APP_PREFIX_PATH}/settings/ai/knowledge/negative-examples`,
                badge: 'guardrails',
            },
        ],
        [actions, metrics],
    )

    return (
        <Loading loading={loading}>
            <div className="flex flex-col gap-6" data-testid="ai-home-page">
                <Card bodyClass="p-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="max-w-4xl">
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Agente de chat
                            </div>
                            <h4 className="mt-1 text-2xl font-semibold text-gray-900">
                                IA como módulo operativo independiente
                            </h4>
                            <p className="mt-3 text-sm leading-6 text-gray-600">
                                Esta home resume el estado del runtime, el entrenamiento del
                                conocimiento y las superficies de operación. La unidad aprobable
                                actual es el intercambio <strong>pregunta + respuesta</strong>.
                                Los bundles multi-turno y los ejemplos negativos ya tienen
                                superficie propia, pero todavía no reemplazan el circuito vigente
                                de aprobación por intercambio.
                            </p>
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                <Badge
                                    className={
                                        runtime?.enabled
                                            ? 'bg-emerald-50 text-emerald-700'
                                            : 'bg-slate-100 text-slate-700'
                                    }
                                >
                                    {runtime?.enabled ? 'IA habilitada' : 'IA en pausa'}
                                </Badge>
                                <Badge className="bg-sky-50 text-sky-700">
                                    {runtime?.provider || 'sin proveedor'}
                                </Badge>
                                <Badge className="bg-slate-100 text-slate-700">
                                    {runtime?.model || 'sin modelo'}
                                </Badge>
                                <Badge className="bg-violet-50 text-violet-700">
                                    {actions.length} acciones registradas
                                </Badge>
                            </div>
                            <div className="mt-3 text-xs text-gray-500">
                                Última actualización runtime: {formatDateTime(runtime?.updatedAt ?? null)}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="solid"
                                onClick={() => navigate(`${APP_PREFIX_PATH}/settings/ai/runtime`)}
                                data-testid="ai-home-link-runtime"
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
                                Abrir training board
                            </Button>
                            <Button variant="default" onClick={() => void loadHome()}>
                                Refrescar
                            </Button>
                        </div>
                    </div>
                </Card>

                {runtime?.usage ? (
                    <Alert
                        showIcon
                        type={
                            runtime.usage.exceeded
                                ? 'danger'
                                : runtime.usage.nearLimit
                                  ? 'warning'
                                  : 'success'
                        }
                    >
                        <div className="font-medium">{runtime.usage.message}</div>
                        <div className="mt-1 text-sm">
                            Uso actual{' '}
                            {runtime.currentUsageUsd !== null
                                ? `USD ${runtime.currentUsageUsd.toFixed(2)}`
                                : 'sin dato'}{' '}
                            · límite{' '}
                            {runtime.monthlySpendingLimitUsd !== null
                                ? `USD ${runtime.monthlySpendingLimitUsd.toFixed(2)}`
                                : 'sin límite'}{' '}
                            · umbral {runtime.warningThresholdPercent}%
                        </div>
                    </Alert>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card bodyClass="p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            Cobertura operativa del conocimiento
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-gray-900">
                            {metrics.maturityPercent}%
                        </div>
                        <div className="mt-3">
                            <Progress percent={metrics.maturityPercent} />
                        </div>
                        <div className="mt-2 text-xs leading-5 text-gray-500">
                            No mide el modelo. Usa la relación entre documentos activos,
                            intercambios pendientes y observaciones detectadas.
                        </div>
                    </Card>
                    <Card bodyClass="p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            Documentos activos
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-gray-900">
                            {metrics.activeDocuments}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                            {metrics.totalDocuments} documentos totales
                        </div>
                    </Card>
                    <Card bodyClass="p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            Intercambios pendientes
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-gray-900">
                            {metrics.pendingCandidates}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                            Unidad aprobable actual: pregunta + respuesta
                        </div>
                    </Card>
                    <Card bodyClass="p-4">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            Reuse aprobado
                        </div>
                        <div className="mt-2 text-2xl font-semibold text-gray-900">
                            {metrics.feedback.applied}
                        </div>
                        <div className="mt-1 text-xs text-gray-500">
                            {formatPercent(metrics.feedback.adoptionRate)} adopción
                        </div>
                    </Card>
                </div>

                <Alert showIcon type="info">
                    <div className="font-medium">
                        Comportamiento base predeterminado, aun sin knowledge cargado
                    </div>
                    <div className="mt-1 text-sm leading-6">
                        Todas las instancias del sistema comparten un comportamiento base común:
                        saludar, responder con naturalidad, pedir el dato mínimo faltante, aclarar
                        límites sin inventar información y continuar la conversación aunque no haya
                        todavía contexto aprobado suficiente. El handoff queda para casos de bloqueo
                        real, riesgo o necesidad operativa específica.
                    </div>
                </Alert>

                <Card bodyClass="p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h5 className="font-semibold text-gray-900">
                                Superficies activas
                            </h5>
                            <p className="mt-1 text-sm text-gray-600">
                                Cada superficie resuelve una parte distinta del gobierno y uso del
                                agente. El runtime ya no es la home del módulo.
                            </p>
                        </div>
                    </div>
                    <div className="mt-5 grid gap-4 xl:grid-cols-2">
                        {moduleLinks.map((item) => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => navigate(item.path)}
                                className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-primary hover:shadow-sm"
                                data-testid={`ai-home-card-${item.key}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-base font-semibold text-gray-900">
                                            {item.title}
                                        </div>
                                        <div className="mt-2 text-sm leading-6 text-gray-600">
                                            {item.description}
                                        </div>
                                    </div>
                                    {item.metric ? (
                                        <Badge className="bg-slate-100 text-slate-700">
                                            {item.metric}
                                        </Badge>
                                    ) : item.badge ? (
                                        <Badge className="bg-amber-100 text-amber-800">
                                            {item.badge}
                                        </Badge>
                                    ) : null}
                                </div>
                            </button>
                        ))}
                    </div>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <Card bodyClass="p-5">
                        <h5 className="font-semibold text-gray-900">
                            Criterio de aprobación y entrenamiento
                        </h5>
                        <div className="mt-4 space-y-4">
                            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-emerald-900">
                                        Intercambio aprobable actual
                                    </span>
                                    <Badge className="bg-emerald-100 text-emerald-800">
                                        vigente
                                    </Badge>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-emerald-900/80">
                                    El sistema aprueba y reutiliza el intercambio
                                    <strong> pregunta + respuesta</strong>. Evita promover una
                                    pregunta aislada del cliente sin respuesta asociada.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-amber-900">
                                        Conversation Bundles
                                    </span>
                                    <Badge className="bg-amber-100 text-amber-800">
                                        exploratorio
                                    </Badge>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-amber-900/80">
                                    La conversación completa pasa a ser relevante cuando el valor
                                    está en una secuencia multi-turno. Esta superficie ayuda a
                                    detectar esos casos sin reemplazar todavía la aprobación por
                                    intercambio.
                                </p>
                            </div>
                            <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-rose-900">
                                        Negative Examples
                                    </span>
                                    <Badge className="bg-rose-100 text-rose-800">
                                        guardrails
                                    </Badge>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-rose-900/80">
                                    Los descartes, rechazos y respuestas inseguras no deben entrar
                                    al corpus de reuse. Esta superficie explicita qué señales
                                    negativas deben penalizar ranking y reforzar guardrails.
                                </p>
                            </div>
                        </div>
                    </Card>

                    <Card bodyClass="p-5">
                        <h5 className="font-semibold text-gray-900">
                            Flujo operativo recomendado
                        </h5>
                        <div className="mt-4 space-y-3">
                            {[
                                'Observación cruda desde chat, email o WhatsApp.',
                                'Candidato sugerido cuando existe pregunta + respuesta útil.',
                                'Revisión humana y aprobación por intercambio.',
                                'Promoción a documento aprobado y reuso medible.',
                            ].map((step, index) => (
                                <div
                                    key={step}
                                    className="flex items-start gap-3 rounded-2xl border border-gray-200 p-3"
                                >
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                                        {index + 1}
                                    </div>
                                    <div className="text-sm leading-6 text-gray-600">{step}</div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </Loading>
    )
}

export default AiHomePage

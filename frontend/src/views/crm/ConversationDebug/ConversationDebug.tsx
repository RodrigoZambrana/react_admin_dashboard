import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Notification from '@/components/ui/Notification'
import Spinner from '@/components/ui/Spinner'
import Textarea from '@/components/ui/Textarea'
import { toast } from '@/components/ui/toast'
import ConversationsService, {
    type ConversationDebugRunInput,
    type ConversationDebugKnowledgeMode,
    type ConversationDebugSnapshot,
    type ConversationDebugTurn,
} from '@/services/ConversationsService'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import {
    TbBug,
    TbChartBar,
    TbMessage2Heart,
    TbPlayerPlay,
    TbRefresh,
    TbTrash,
} from 'react-icons/tb'
import './conversation-debug.css'

type DebugMode = 'new' | 'inspect'

type SimulationFormState = {
    simulateAs: 'guest' | 'authenticated'
    knowledgeMode: ConversationDebugKnowledgeMode
    tenantKey: string
    guestId: string
    name: string
    email: string
    locale: string
    currency: string
    page: string
    waitTimeoutMs: number
}

const defaultSimulationState = (): SimulationFormState => ({
    simulateAs: 'guest',
    knowledgeMode: 'full',
    tenantKey: '',
    guestId: '',
    name: '',
    email: '',
    locale: 'es-UY',
    currency: 'UYU',
    page: '/debug/webchat',
    waitTimeoutMs: 10000,
})

const stringifyBlock = (value: unknown) =>
    value == null
        ? 'Sin datos'
        : typeof value === 'string'
            ? value
            : JSON.stringify(value, null, 2)

const formatDateTime = (value?: string | null) => {
    if (!value) return 'Sin fecha'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('es-UY', {
        dateStyle: 'short',
        timeStyle: 'medium',
    }).format(date)
}

const formatPercent = (value?: number | null) =>
    typeof value === 'number' && Number.isFinite(value)
        ? `${value.toFixed(1)}%`
        : '0.0%'

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null

const getKnowledgeTrace = (turn: ConversationDebugTurn | null) =>
    asRecord(asRecord(turn?.decisionTrace)?.knowledge)

const getEmbeddingSummary = (turn: ConversationDebugTurn | null) => {
    const embedding = asRecord(getKnowledgeTrace(turn)?.embeddingMode)
    const mode =
        typeof embedding?.mode === 'string' ? embedding.mode : 'sin_datos'
    const provider =
        typeof embedding?.provider === 'string'
            ? embedding.provider
            : 'sin_provider'
    return `${mode} · ${provider}`
}

const metricCards = (snapshot: ConversationDebugSnapshot | null) => {
    const metrics = snapshot?.metrics
    if (!metrics) {
        return []
    }

    return [
        {
            label: 'Grounding',
            value: formatPercent(metrics.groundedResponses.percentage),
            detail: `${metrics.groundedResponses.count} turnos`,
        },
        {
            label: 'Fallback',
            value: formatPercent(metrics.fallbackResponses.percentage),
            detail: `${metrics.fallbackResponses.count} turnos`,
        },
        {
            label: 'Determinísticas',
            value: formatPercent(metrics.deterministicResponses.percentage),
            detail: `${metrics.deterministicResponses.count} turnos`,
        },
        {
            label: 'Acciones',
            value: formatPercent(metrics.actionsExecuted.percentage),
            detail: `${metrics.actionsExecuted.count} turnos`,
        },
        {
            label: 'Chunks reales',
            value: formatPercent(metrics.realChunkResponses.percentage),
            detail: `${metrics.realChunkResponses.count} turnos`,
        },
        {
            label: 'Knowledge used',
            value: formatPercent(metrics.knowledgeUsedResponses?.percentage ?? 0),
            detail: `${metrics.knowledgeUsedResponses?.count ?? 0} turnos`,
        },
        {
            label: 'Retrieved only',
            value: formatPercent(metrics.retrievedOnlyResponses?.percentage ?? 0),
            detail: `${metrics.retrievedOnlyResponses?.count ?? 0} turnos`,
        },
        {
            label: 'Model only',
            value: formatPercent(metrics.modelOnlyResponses?.percentage ?? 0),
            detail: `${metrics.modelOnlyResponses?.count ?? 0} turnos`,
        },
        {
            label: 'Embeddings semánticos',
            value: formatPercent(metrics.semanticEmbeddingResponses.percentage),
            detail: `${metrics.semanticEmbeddingResponses.count} turnos`,
        },
        {
            label: 'Hallucinations',
            value: formatPercent(metrics.possibleKnowledgeHallucinations.percentage),
            detail: `${metrics.possibleKnowledgeHallucinations.count} turnos`,
        },
        {
            label: 'Multi-call',
            value: formatPercent(metrics.multiCallTurns?.percentage ?? 0),
            detail: `${metrics.multiCallTurns?.count ?? 0} turnos`,
        },
        {
            label: 'Naturality',
            value:
                typeof metrics.avgNaturalityScore === 'number'
                    ? String(metrics.avgNaturalityScore.toFixed(1))
                    : '0.0',
            detail: 'promedio por turno',
        },
        {
            label: 'Chunks usados',
            value: String(metrics.chunksUtilized ?? 0),
            detail: 'IDs únicos en la conversación',
        },
    ]
}

const getTurnTitle = (turn: ConversationDebugTurn, index: number) => {
    const intentKey =
        typeof turn.intent?.key === 'string' && turn.intent.key.trim()
            ? turn.intent.key.trim()
            : 'sin_intencion'
    return `Turno ${index + 1} · ${intentKey}`
}

const buildRunInput = (
    form: SimulationFormState,
    extra: Partial<ConversationDebugRunInput> = {},
): ConversationDebugRunInput => ({
    simulateAs: form.simulateAs,
    knowledgeMode: form.knowledgeMode,
    disableKnowledge: form.knowledgeMode === 'retrieval_disabled',
    tenantKey: form.tenantKey || undefined,
    guestId: form.guestId || undefined,
    name: form.name || undefined,
    email: form.email || undefined,
    locale: form.locale || undefined,
    currency: form.currency || undefined,
    page: form.page || undefined,
    waitTimeoutMs: form.waitTimeoutMs,
    ...extra,
})

const JsonPanel = ({
    label,
    value,
}: {
    label: string
    value: unknown
}) => (
    <section className="conversation-debug__section">
        <div className="conversation-debug__section-title">{label}</div>
        <pre className="conversation-debug__code">
            {stringifyBlock(value)}
        </pre>
    </section>
)

const ConversationDebug = () => {
    const navigate = useNavigate()
    const { conversationId } = useParams<{ conversationId?: string }>()

    const [mode, setMode] = useState<DebugMode>(
        conversationId ? 'inspect' : 'new',
    )
    const [inspectId, setInspectId] = useState(conversationId || '')
    const [form, setForm] = useState<SimulationFormState>(defaultSimulationState)
    const [snapshot, setSnapshot] = useState<ConversationDebugSnapshot | null>(
        null,
    )
    const [selectedTurnIndex, setSelectedTurnIndex] = useState(0)
    const [loading, setLoading] = useState(false)
    const [running, setRunning] = useState(false)
    const [composerText, setComposerText] = useState('')

    const selectedTurn = snapshot?.turns?.[selectedTurnIndex] ?? null
    const cards = useMemo(() => metricCards(snapshot), [snapshot])

    const pushError = useCallback((message: string) => {
        toast.push(
            <Notification title="Debug de conversaciones" type="danger">
                {message}
            </Notification>,
        )
    }, [])

    const pushSuccess = useCallback((message: string) => {
        toast.push(
            <Notification title="Debug de conversaciones" type="success">
                {message}
            </Notification>,
        )
    }, [])

    const loadSnapshot = useCallback(
        async (id: string, options?: { silent?: boolean }) => {
            const normalizedId = id.trim()
            if (!normalizedId) {
                return
            }

            if (!options?.silent) {
                setLoading(true)
            }
            try {
                const nextSnapshot =
                    await ConversationsService.fetchConversationDebug(normalizedId)
                setSnapshot(nextSnapshot)
                setSelectedTurnIndex(
                    Math.max((nextSnapshot.turns?.length || 1) - 1, 0),
                )
            } catch (error) {
                console.error(error)
                pushError('No fue posible cargar el snapshot de debug.')
            } finally {
                if (!options?.silent) {
                    setLoading(false)
                }
            }
        },
        [pushError],
    )

    useEffect(() => {
        if (!conversationId) {
            return
        }
        setMode('inspect')
        setInspectId(conversationId)
        void loadSnapshot(conversationId)
    }, [conversationId, loadSnapshot])

    useEffect(() => {
        if (!snapshot?.turns?.length) {
            setSelectedTurnIndex(0)
            return
        }
        setSelectedTurnIndex((current) =>
            current >= 0 && current < snapshot.turns.length
                ? current
                : snapshot.turns.length - 1,
        )
    }, [snapshot])

    useEffect(() => {
        if (!snapshot?.conversation) {
            return
        }

        const latestTurn =
            snapshot.turns && snapshot.turns.length > 0
                ? snapshot.turns[snapshot.turns.length - 1]
                : null
        const tracedKnowledgeMode = getKnowledgeTrace(latestTurn)?.mode
        const nextKnowledgeMode =
            typeof tracedKnowledgeMode === 'string' &&
            ['full', 'retrieval_disabled', 'retrieval_only'].includes(
                tracedKnowledgeMode,
            )
                ? (tracedKnowledgeMode as ConversationDebugKnowledgeMode)
                : snapshot.execution?.options?.knowledgeMode

        setForm((current) => ({
            ...current,
            simulateAs: snapshot.conversation.simulation?.authenticated
                ? 'authenticated'
                : 'guest',
            knowledgeMode: nextKnowledgeMode || current.knowledgeMode,
        }))
    }, [snapshot])

    const handleSimulationChange = <K extends keyof SimulationFormState>(
        key: K,
        value: SimulationFormState[K],
    ) => {
        setForm((current) => ({
            ...current,
            [key]: value,
        }))
    }

    const handleCreateSimulation = async () => {
        setRunning(true)
        try {
            const nextSnapshot = await ConversationsService.createConversationDebug(
                buildRunInput(form),
            )
            setSnapshot(nextSnapshot)
            setSelectedTurnIndex(
                Math.max((nextSnapshot.turns?.length || 1) - 1, 0),
            )
            navigate(
                `${APP_PREFIX_PATH}/crm/conversations/debug/${nextSnapshot.conversation.id}`,
            )
            pushSuccess('Nueva simulación creada.')
        } catch (error) {
            console.error(error)
            pushError('No fue posible crear la simulación.')
        } finally {
            setRunning(false)
        }
    }

    const handleInspectConversation = async () => {
        const normalizedId = inspectId.trim()
        if (!normalizedId) {
            pushError('Ingresá un ID de conversación para inspeccionar.')
            return
        }
        navigate(`${APP_PREFIX_PATH}/crm/conversations/debug/${normalizedId}`)
        await loadSnapshot(normalizedId)
    }

    const handleSendMessage = async () => {
        const text = composerText.trim()
        const currentConversationId = snapshot?.conversation?.id
        if (!currentConversationId || !text) {
            return
        }

        setRunning(true)
        try {
            const nextSnapshot = await ConversationsService.runConversationDebug(
                currentConversationId,
                buildRunInput(form, {
                    messages: [{ text }],
                }),
            )
            setSnapshot(nextSnapshot)
            setComposerText('')
            setSelectedTurnIndex(
                Math.max((nextSnapshot.turns?.length || 1) - 1, 0),
            )
        } catch (error) {
            console.error(error)
            pushError('No fue posible ejecutar el siguiente turno.')
        } finally {
            setRunning(false)
        }
    }

    const handleResetConversation = async () => {
        const currentConversationId = snapshot?.conversation?.id
        if (!currentConversationId) {
            return
        }

        setRunning(true)
        try {
            const nextSnapshot = await ConversationsService.runConversationDebug(
                currentConversationId,
                buildRunInput(form, {
                    reset: true,
                }),
            )
            setSnapshot(nextSnapshot)
            setSelectedTurnIndex(
                Math.max((nextSnapshot.turns?.length || 1) - 1, 0),
            )
            navigate(
                `${APP_PREFIX_PATH}/crm/conversations/debug/${nextSnapshot.conversation.id}`,
            )
            pushSuccess('La simulación se reinició desde cero.')
        } catch (error) {
            console.error(error)
            pushError('No fue posible resetear la simulación.')
        } finally {
            setRunning(false)
        }
    }

    const handleDeleteConversation = async () => {
        const currentConversationId = snapshot?.conversation?.id
        if (!currentConversationId) {
            return
        }

        if (!window.confirm('Esta acción elimina la sesión de debug. ¿Continuar?')) {
            return
        }

        setRunning(true)
        try {
            await ConversationsService.deleteConversationDebug(currentConversationId)
            setSnapshot(null)
            setComposerText('')
            navigate(`${APP_PREFIX_PATH}/crm/conversations/debug`)
            pushSuccess('Sesión de debug eliminada.')
        } catch (error) {
            console.error(error)
            pushError('No fue posible eliminar la sesión de debug.')
        } finally {
            setRunning(false)
        }
    }

    const canMutateCurrentConversation =
        snapshot?.conversation?.channel === 'webchat' &&
        snapshot?.conversation?.simulation?.debugSession === true

    return (
        <div className="conversation-debug">
            <div className="conversation-debug__header">
                <div>
                    <div className="conversation-debug__eyebrow">
                        <TbBug size={16} />
                        Debug admin
                    </div>
                    <h3 className="conversation-debug__title">
                        Simulador e inspección de conversaciones
                    </h3>
                    <p className="conversation-debug__subtitle">
                        Recorre el mismo flujo real del runtime, con trazabilidad
                        completa de prompts, grounding, acciones y decisión.
                    </p>
                </div>
                <div className="conversation-debug__header-actions">
                    <Button
                        variant="plain"
                        onClick={() => navigate(`${APP_PREFIX_PATH}/crm/conversations`)}
                    >
                        Volver a mensajes
                    </Button>
                    {snapshot?.conversation?.id ? (
                        <Button
                            variant="plain"
                            onClick={() =>
                                navigate(
                                    `${APP_PREFIX_PATH}/crm/conversations/${snapshot.conversation.id}`,
                                )
                            }
                        >
                            Abrir conversación
                        </Button>
                    ) : null}
                </div>
            </div>

            <div className="conversation-debug__entry-grid">
                <AdaptableCard className="conversation-debug__entry-card">
                    <div className="conversation-debug__entry-head">
                        <div className="conversation-debug__entry-icon">
                            <TbPlayerPlay size={18} />
                        </div>
                        <div>
                            <h5>Nueva simulación</h5>
                            <p>
                                Crea una sesión webchat real marcada como debug y
                                úsala como chat controlado.
                            </p>
                        </div>
                    </div>
                    <div className="conversation-debug__mode-switch">
                        <button
                            type="button"
                            className={
                                mode === 'new'
                                    ? 'conversation-debug__mode-button conversation-debug__mode-button--active'
                                    : 'conversation-debug__mode-button'
                            }
                            onClick={() => setMode('new')}
                        >
                            Nueva simulación
                        </button>
                        <button
                            type="button"
                            className={
                                mode === 'inspect'
                                    ? 'conversation-debug__mode-button conversation-debug__mode-button--active'
                                    : 'conversation-debug__mode-button'
                            }
                            onClick={() => setMode('inspect')}
                        >
                            Inspeccionar conversación
                        </button>
                    </div>
                    {mode === 'new' ? (
                        <div className="conversation-debug__form-grid">
                            <fieldset className="conversation-debug__field conversation-debug__fieldset">
                                <legend className="conversation-debug__legend">
                                    Rol simulado
                                </legend>
                                <div className="conversation-debug__pill-row">
                                    <button
                                        type="button"
                                        className={
                                            form.simulateAs === 'guest'
                                                ? 'conversation-debug__pill conversation-debug__pill--active'
                                                : 'conversation-debug__pill'
                                        }
                                        onClick={() =>
                                            handleSimulationChange('simulateAs', 'guest')
                                        }
                                    >
                                        Guest
                                    </button>
                                    <button
                                        type="button"
                                        className={
                                            form.simulateAs === 'authenticated'
                                                ? 'conversation-debug__pill conversation-debug__pill--active'
                                                : 'conversation-debug__pill'
                                        }
                                        onClick={() =>
                                            handleSimulationChange(
                                                'simulateAs',
                                                'authenticated',
                                            )
                                        }
                                    >
                                        Authenticated
                                    </button>
                                </div>
                            </fieldset>
                            <div className="conversation-debug__field">
                                <label htmlFor="conversation-debug-tenant">
                                    Tenant
                                </label>
                                <Input
                                    id="conversation-debug-tenant"
                                    value={form.tenantKey}
                                    onChange={(event) =>
                                        handleSimulationChange(
                                            'tenantKey',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="urucortinas"
                                />
                            </div>
                            <div className="conversation-debug__field">
                                <label htmlFor="conversation-debug-guest-id">
                                    Guest ID
                                </label>
                                <Input
                                    id="conversation-debug-guest-id"
                                    value={form.guestId}
                                    onChange={(event) =>
                                        handleSimulationChange(
                                            'guestId',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="guest-debug"
                                />
                            </div>
                            <div className="conversation-debug__field">
                                <label htmlFor="conversation-debug-name">
                                    Nombre
                                </label>
                                <Input
                                    id="conversation-debug-name"
                                    value={form.name}
                                    onChange={(event) =>
                                        handleSimulationChange('name', event.target.value)
                                    }
                                    placeholder="Cliente debug"
                                />
                            </div>
                            <div className="conversation-debug__field">
                                <label htmlFor="conversation-debug-email">
                                    Email
                                </label>
                                <Input
                                    id="conversation-debug-email"
                                    value={form.email}
                                    onChange={(event) =>
                                        handleSimulationChange('email', event.target.value)
                                    }
                                    placeholder="cliente@example.com"
                                />
                            </div>
                            <div className="conversation-debug__field">
                                <label htmlFor="conversation-debug-page">
                                    Página
                                </label>
                                <Input
                                    id="conversation-debug-page"
                                    value={form.page}
                                    onChange={(event) =>
                                        handleSimulationChange('page', event.target.value)
                                    }
                                    placeholder="/debug/webchat"
                                />
                            </div>
                            <div className="conversation-debug__field">
                                <label htmlFor="conversation-debug-locale">
                                    Locale
                                </label>
                                <Input
                                    id="conversation-debug-locale"
                                    value={form.locale}
                                    onChange={(event) =>
                                        handleSimulationChange('locale', event.target.value)
                                    }
                                    placeholder="es-UY"
                                />
                            </div>
                            <div className="conversation-debug__field">
                                <label htmlFor="conversation-debug-currency">
                                    Currency
                                </label>
                                <Input
                                    id="conversation-debug-currency"
                                    value={form.currency}
                                    onChange={(event) =>
                                        handleSimulationChange(
                                            'currency',
                                            event.target.value,
                                        )
                                    }
                                    placeholder="UYU"
                                />
                            </div>
                            <div className="conversation-debug__field">
                                <label htmlFor="conversation-debug-timeout">
                                    Timeout de espera (ms)
                                </label>
                                <Input
                                    id="conversation-debug-timeout"
                                    type="number"
                                    value={String(form.waitTimeoutMs)}
                                    onChange={(event) =>
                                        handleSimulationChange(
                                            'waitTimeoutMs',
                                            Number(event.target.value || 0),
                                        )
                                    }
                                />
                            </div>
                            <fieldset className="conversation-debug__field conversation-debug__fieldset conversation-debug__field--full">
                                <legend className="conversation-debug__legend">
                                    Knowledge mode
                                </legend>
                                <div className="conversation-debug__switch-help">
                                    `full` usa retrieval normal, `retrieval_disabled`
                                    mide dependencia del modelo y `retrieval_only`
                                    bloquea respuestas sin grounding útil.
                                </div>
                                <div className="conversation-debug__pill-row">
                                    <button
                                        type="button"
                                        className={
                                            form.knowledgeMode === 'full'
                                                ? 'conversation-debug__pill conversation-debug__pill--active'
                                                : 'conversation-debug__pill'
                                        }
                                        onClick={() =>
                                            handleSimulationChange(
                                                'knowledgeMode',
                                                'full',
                                            )
                                        }
                                    >
                                        Full
                                    </button>
                                    <button
                                        type="button"
                                        className={
                                            form.knowledgeMode ===
                                            'retrieval_disabled'
                                                ? 'conversation-debug__pill conversation-debug__pill--active'
                                                : 'conversation-debug__pill'
                                        }
                                        onClick={() =>
                                            handleSimulationChange(
                                                'knowledgeMode',
                                                'retrieval_disabled',
                                            )
                                        }
                                    >
                                        Retrieval off
                                    </button>
                                    <button
                                        type="button"
                                        className={
                                            form.knowledgeMode === 'retrieval_only'
                                                ? 'conversation-debug__pill conversation-debug__pill--active'
                                                : 'conversation-debug__pill'
                                        }
                                        onClick={() =>
                                            handleSimulationChange(
                                                'knowledgeMode',
                                                'retrieval_only',
                                            )
                                        }
                                    >
                                        Retrieval only
                                    </button>
                                </div>
                            </fieldset>
                            <div className="conversation-debug__entry-actions">
                                <Button
                                    variant="solid"
                                    onClick={handleCreateSimulation}
                                    disabled={running}
                                >
                                    {running ? <Spinner size={18} /> : 'Crear simulación'}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="conversation-debug__inspect">
                            <div className="conversation-debug__field">
                                <label htmlFor="conversation-debug-inspect-id">
                                    ID de conversación
                                </label>
                                <Input
                                    id="conversation-debug-inspect-id"
                                    value={inspectId}
                                    onChange={(event) => setInspectId(event.target.value)}
                                    placeholder="conv_xxx"
                                />
                            </div>
                            <div className="conversation-debug__entry-actions">
                                <Button
                                    variant="solid"
                                    onClick={handleInspectConversation}
                                    disabled={loading}
                                >
                                    {loading ? <Spinner size={18} /> : 'Inspeccionar'}
                                </Button>
                            </div>
                        </div>
                    )}
                </AdaptableCard>
            </div>

            <div className="conversation-debug__workspace">
                <AdaptableCard className="conversation-debug__chat-card">
                    <div className="conversation-debug__chat-header">
                        <div>
                            <h5>Timeline</h5>
                            <p>
                                Chat simulado con la misma capa real de webchat y
                                orquestación del agente.
                            </p>
                        </div>
                        {snapshot?.conversation ? (
                            <div className="conversation-debug__meta">
                                <span className="conversation-debug__badge">
                                    {snapshot.conversation.channel}
                                </span>
                                <span className="conversation-debug__badge">
                                    {snapshot.conversation.scope}
                                </span>
                                <span className="conversation-debug__badge">
                                    {snapshot.conversation.simulation
                                        ?.authenticated
                                        ? 'authenticated'
                                        : 'guest'}
                                </span>
                                {snapshot.conversation.simulation?.debugSession ? (
                                    <span className="conversation-debug__badge conversation-debug__badge--accent">
                                        debug
                                    </span>
                                ) : null}
                            </div>
                        ) : null}
                    </div>

                    <div className="conversation-debug__metrics">
                        {cards.map((card) => (
                            <div
                                key={card.label}
                                className="conversation-debug__metric-card"
                            >
                                <div className="conversation-debug__metric-label">
                                    {card.label}
                                </div>
                                <div className="conversation-debug__metric-value">
                                    {card.value}
                                </div>
                                <div className="conversation-debug__metric-detail">
                                    {card.detail}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="conversation-debug__timeline">
                        {loading ? (
                            <div className="conversation-debug__empty">
                                <Spinner size={28} />
                            </div>
                        ) : snapshot?.turns?.length ? (
                            snapshot.turns.map((turn, turnIndex) => (
                                <div
                                    key={turn.turnId || `pending-${turnIndex}`}
                                    className="conversation-debug__turn"
                                >
                                    <button
                                        type="button"
                                        className={
                                            selectedTurnIndex === turnIndex
                                                ? 'conversation-debug__turn-anchor conversation-debug__turn-anchor--active'
                                                : 'conversation-debug__turn-anchor'
                                        }
                                        onClick={() => setSelectedTurnIndex(turnIndex)}
                                    >
                                        {getTurnTitle(turn, turnIndex)}
                                    </button>
                                    {turn.userMessages.map((message) => (
                                        <div
                                            key={message.id}
                                            className="conversation-debug__bubble conversation-debug__bubble--user"
                                        >
                                            <div className="conversation-debug__bubble-label">
                                                Usuario
                                            </div>
                                            <div>
                                                {message.body || message.normalizedText || 'Sin texto'}
                                            </div>
                                            <div className="conversation-debug__bubble-meta">
                                                {formatDateTime(message.createdAt)}
                                            </div>
                                        </div>
                                    ))}
                                    {turn.finalResponse ? (
                                        <div className="conversation-debug__bubble conversation-debug__bubble--agent">
                                            <div className="conversation-debug__bubble-topline">
                                                <span className="conversation-debug__bubble-label">
                                                    Agente
                                                </span>
                                                {turn.responseMode ? (
                                                    <span className="conversation-debug__mode-tag">
                                                        {turn.responseMode}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <div>{turn.finalResponse}</div>
                                            <div className="conversation-debug__bubble-meta">
                                                {formatDateTime(turn.createdAt)}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ))
                        ) : (
                            <div className="conversation-debug__empty">
                                <TbMessage2Heart size={28} />
                                <div>
                                    Creá una simulación o cargá una conversación para ver
                                    la timeline.
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="conversation-debug__composer">
                        <label
                            htmlFor="conversation-debug-composer"
                            className="conversation-debug__section-title"
                        >
                            Próximo mensaje del usuario
                        </label>
                        <Textarea
                            id="conversation-debug-composer"
                            value={composerText}
                            onChange={(event) => setComposerText(event.target.value)}
                            placeholder={
                                canMutateCurrentConversation
                                    ? 'Escribí el próximo mensaje del usuario...'
                                    : 'La simulación en vivo solo está habilitada sobre sesiones debug.'
                            }
                            rows={3}
                            disabled={!canMutateCurrentConversation || running}
                        />
                        <div className="conversation-debug__composer-actions">
                            {canMutateCurrentConversation ? (
                                <>
                                    <Button
                                        variant="plain"
                                        onClick={handleResetConversation}
                                        disabled={running}
                                        icon={<TbRefresh size={16} />}
                                    >
                                        Resetear
                                    </Button>
                                    <Button
                                        variant="plain"
                                        onClick={handleDeleteConversation}
                                        disabled={running}
                                        icon={<TbTrash size={16} />}
                                    >
                                        Eliminar
                                    </Button>
                                </>
                            ) : null}
                            <Button
                                variant="solid"
                                onClick={handleSendMessage}
                                disabled={
                                    running ||
                                    !canMutateCurrentConversation ||
                                    !composerText.trim()
                                }
                            >
                                {running ? <Spinner size={18} /> : 'Enviar turno'}
                            </Button>
                        </div>
                    </div>
                </AdaptableCard>

                <AdaptableCard className="conversation-debug__panel-card">
                    <div className="conversation-debug__panel-header">
                        <div>
                            <h5>Panel de debug</h5>
                            <p>
                                Snapshot por turno con contexto, prompt, grounding y
                                acciones.
                            </p>
                        </div>
                        {selectedTurn ? (
                            <div className="conversation-debug__meta">
                                <span className="conversation-debug__badge">
                                    {selectedTurn.intent?.key || 'sin_intencion'}
                                </span>
                                {selectedTurn.responseMode ? (
                                    <span className="conversation-debug__badge">
                                        {selectedTurn.responseMode}
                                    </span>
                                ) : null}
                            </div>
                        ) : null}
                    </div>

                    {selectedTurn ? (
                        <div className="conversation-debug__panel-body">
                            <section className="conversation-debug__section">
                                <div className="conversation-debug__section-title">
                                    Resumen del turno
                                </div>
                                <div className="conversation-debug__summary-grid">
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Input original
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {selectedTurn.originalUserInput || 'Sin input'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Input procesado
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {selectedTurn.processedInput || 'Sin normalizar'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Semantic turn
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {selectedTurn.semanticTurnId || 'n/a'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Respuesta final
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {selectedTurn.finalResponse || 'Pendiente'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Provider calls
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {typeof selectedTurn.providerCallCount === 'number'
                                                ? String(selectedTurn.providerCallCount)
                                                : '0'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Grounding
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {selectedTurn.knowledgeGrounded === true
                                                ? 'Grounded'
                                                : selectedTurn.knowledgeRetrieved === true
                                                  ? 'Retrieved only'
                                                  : selectedTurn.grounding?.fallbackReason ||
                                                    'Sin grounding'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Knowledge mode
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {typeof getKnowledgeTrace(selectedTurn)?.mode ===
                                            'string'
                                                ? String(
                                                      getKnowledgeTrace(selectedTurn)?.mode,
                                                  )
                                                : snapshot?.execution?.options
                                                      ?.knowledgeMode ||
                                                  'full'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Embedding mode
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {getEmbeddingSummary(selectedTurn)}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Wait for more
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {selectedTurn.waitForMore ? 'Sí' : 'No'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Response origin
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {String(
                                                asRecord(
                                                    asRecord(selectedTurn.decisionTrace)
                                                        ?.deterministic,
                                                )?.responseOrigin || 'n/a',
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Decision source
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {selectedTurn.decisionSource || 'n/a'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Model knowledge score
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {typeof getKnowledgeTrace(selectedTurn)
                                                ?.modelKnowledgeScore === 'number'
                                                ? String(
                                                      getKnowledgeTrace(selectedTurn)
                                                          ?.modelKnowledgeScore,
                                                  )
                                                : 'n/a'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Naturality score
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {typeof selectedTurn.naturalityScore === 'number'
                                                ? String(selectedTurn.naturalityScore)
                                                : 'n/a'}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="conversation-debug__summary-label">
                                            Possible hallucination
                                        </div>
                                        <div className="conversation-debug__summary-value">
                                            {getKnowledgeTrace(selectedTurn)
                                                ?.possibleKnowledgeHallucination === true
                                                ? 'Sí'
                                                : 'No'}
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <JsonPanel
                                label="Decision Trace"
                                value={selectedTurn.decisionTrace}
                            />
                            <JsonPanel
                                label="Contexto enviado"
                                value={selectedTurn.contextSent}
                            />
                            <JsonPanel
                                label="Prompt final"
                                value={selectedTurn.promptSent}
                            />
                            <JsonPanel
                                label="Respuesta cruda IA"
                                value={selectedTurn.rawAiResponse}
                            />
                            <JsonPanel
                                label="Grounding y fuentes"
                                value={selectedTurn.grounding}
                            />
                            <JsonPanel
                                label="Acciones evaluadas/ejecutadas"
                                value={selectedTurn.actions}
                            />
                            <JsonPanel
                                label="Interpretación del turno"
                                value={selectedTurn.turnInterpretation}
                            />
                            <JsonPanel
                                label="Métricas del turno"
                                value={selectedTurn.metrics}
                            />
                        </div>
                    ) : (
                        <div className="conversation-debug__empty conversation-debug__empty--panel">
                            <TbChartBar size={28} />
                            <div>Seleccioná un turno para inspeccionar la traza.</div>
                        </div>
                    )}
                </AdaptableCard>
            </div>
        </div>
    )
}

export default ConversationDebug

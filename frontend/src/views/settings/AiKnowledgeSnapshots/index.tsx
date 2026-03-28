import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Alert from '@/components/ui/Alert'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import AiKnowledgeService, {
    type AiKnowledgeConversationBundle,
    type AiKnowledgeNegativeExample,
    type AiKnowledgeSnapshot,
    type AiKnowledgeSnapshotDiff,
    type AiKnowledgeSnapshotEntry,
} from '@/services/AiKnowledgeService'

type KnowledgeScope = 'admin_internal' | 'customer_public'

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

const humanize = (value: string) =>
    value
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())

const asNumber = (value: unknown) => {
    if (typeof value === 'number') return value
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
}

const isBaseEntry = (entry: AiKnowledgeSnapshotEntry) =>
    entry.entryType === 'operational_note' &&
    entry.metadata?.entryClass === 'default_runtime_rule'

const isGapEntry = (entry: AiKnowledgeSnapshotEntry) => entry.entryType === 'known_gap'

const isGuardrailEntry = (entry: AiKnowledgeSnapshotEntry) =>
    entry.entryType === 'guardrail_negative'

const renderSignalPreview = (value?: string | null, fallback?: string | null) => {
    const text = value?.trim() || fallback?.trim() || 'Sin resumen disponible.'
    if (text.length <= 180) {
        return text
    }
    return `${text.slice(0, 179).trimEnd()}…`
}

const snapshotSignalScore = (snapshot: AiKnowledgeSnapshot | null) => {
    if (!snapshot) return 0
    const metrics = snapshot.metrics ?? {}
    return (
        asNumber(metrics.activeEntries) +
        asNumber(metrics.activeDocuments) +
        asNumber(metrics.approvedCandidates) +
        asNumber(metrics.approvedBundles) +
        asNumber(metrics.approvedNegativeExamples)
    )
}

const pickPreferredSnapshot = (
    adminSnapshot: AiKnowledgeSnapshot,
    customerSnapshot: AiKnowledgeSnapshot,
) => {
    const adminScore = snapshotSignalScore(adminSnapshot)
    const customerScore = snapshotSignalScore(customerSnapshot)

    if (customerScore > adminScore) {
        return customerSnapshot
    }

    if (adminScore > customerScore) {
        return adminSnapshot
    }

    const customerCoverage = customerSnapshot.coverageScore ?? 0
    const adminCoverage = adminSnapshot.coverageScore ?? 0

    if (customerCoverage > adminCoverage) {
        return customerSnapshot
    }

    if (adminCoverage > customerCoverage) {
        return adminSnapshot
    }

    return customerSnapshot
}

const AiKnowledgeSnapshotsPage = () => {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const requestedScope = searchParams.get('scope')
    const explicitScope: KnowledgeScope | null =
        requestedScope === 'customer_public' || requestedScope === 'admin_internal'
            ? requestedScope
            : null
    const [resolvedScope, setResolvedScope] = useState<KnowledgeScope>('customer_public')
    const scope = explicitScope ?? resolvedScope
    const [loading, setLoading] = useState(false)
    const [snapshot, setSnapshot] = useState<AiKnowledgeSnapshot | null>(null)
    const [diff, setDiff] = useState<AiKnowledgeSnapshotDiff | null>(null)
    const [pendingBundles, setPendingBundles] = useState<AiKnowledgeConversationBundle[]>([])
    const [pendingNegativeExamples, setPendingNegativeExamples] = useState<
        AiKnowledgeNegativeExample[]
    >([])

    const loadSnapshot = useCallback(async () => {
        setLoading(true)
        try {
            let latest: AiKnowledgeSnapshot
            if (explicitScope) {
                const latestResponse = await AiKnowledgeService.getLatestSnapshot({
                    scope: explicitScope,
                })
                latest = latestResponse.data
            } else {
                const [adminResponse, customerResponse] = await Promise.all([
                    AiKnowledgeService.getLatestSnapshot({
                        scope: 'admin_internal',
                    }),
                    AiKnowledgeService.getLatestSnapshot({
                        scope: 'customer_public',
                    }),
                ])
                latest = pickPreferredSnapshot(adminResponse.data, customerResponse.data)
                setResolvedScope(latest.scope as KnowledgeScope)
                setSearchParams({ scope: latest.scope }, { replace: true })
            }

            setSnapshot(latest)
            const [diffResponse, pendingBundlesResponse, pendingNegativeExamplesResponse] =
                await Promise.all([
                    AiKnowledgeService.getSnapshotDiff(latest.id),
                    AiKnowledgeService.listConversationBundles({
                        scope: latest.scope as 'customer_public' | 'admin_internal',
                        status: 'pending',
                        pageSize: 12,
                        orderBy: 'updatedAt',
                        orderDir: 'desc',
                    }),
                    AiKnowledgeService.listNegativeExamples({
                        scope: latest.scope as 'customer_public' | 'admin_internal',
                        status: 'pending',
                        pageSize: 12,
                        orderBy: 'updatedAt',
                        orderDir: 'desc',
                    }),
                ])
            setDiff(diffResponse.data)
            setPendingBundles(pendingBundlesResponse.data.items ?? [])
            setPendingNegativeExamples(pendingNegativeExamplesResponse.data.items ?? [])
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification
                    title="No fue posible cargar el snapshot de knowledge"
                    type="danger"
                >
                    Verifica disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [explicitScope, setSearchParams])

    useEffect(() => {
        void loadSnapshot()
    }, [loadSnapshot])

    const summary = useMemo(() => {
        if (!snapshot) {
            return {
                approved: 0,
                gaps: 0,
                base: 0,
                guardrails: 0,
                sourceCount: 0,
                activeDocuments: 0,
                approvedCandidates: 0,
                pendingRawEvents: 0,
                pendingBundles: 0,
                pendingNegativeExamples: 0,
            }
        }

        const sourceKeys = new Set<string>()
        snapshot.entries.forEach((entry) => {
            entry.sources.forEach((source) => {
                sourceKeys.add(`${source.sourceKind}:${source.sourceId}`)
            })
        })

        return {
            approved: snapshot.entries.filter(
                (entry) =>
                    !isGapEntry(entry) &&
                    !isBaseEntry(entry) &&
                    !isGuardrailEntry(entry),
            ).length,
            gaps: snapshot.entries.filter(isGapEntry).length,
            base: snapshot.entries.filter(isBaseEntry).length,
            guardrails: snapshot.entries.filter(isGuardrailEntry).length,
            sourceCount: sourceKeys.size,
            activeDocuments: asNumber(snapshot.metrics?.activeDocuments),
            approvedCandidates: asNumber(snapshot.metrics?.approvedCandidates),
            pendingRawEvents: asNumber(snapshot.metrics?.pendingRawEvents),
            pendingBundles: pendingBundles.length,
            pendingNegativeExamples: pendingNegativeExamples.length,
        }
    }, [pendingBundles.length, pendingNegativeExamples.length, snapshot])

    const topEntries = useMemo(
        () =>
            (snapshot?.entries ?? [])
                .filter(
                    (entry) =>
                        !isGapEntry(entry) &&
                        !isBaseEntry(entry) &&
                        !isGuardrailEntry(entry),
                )
                .slice(0, 6),
        [snapshot],
    )

    const baseEntries = useMemo(
        () => (snapshot?.entries ?? []).filter(isBaseEntry).slice(0, 4),
        [snapshot],
    )

    const gapEntries = useMemo(
        () => (snapshot?.entries ?? []).filter(isGapEntry).slice(0, 4),
        [snapshot],
    )

    return (
        <Loading loading={loading}>
            <div className="flex flex-col gap-6" data-testid="ai-knowledge-snapshots-page">
                <Card bodyClass="p-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="max-w-4xl">
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Knowledge Snapshot
                            </div>
                            <h4 className="mt-1 text-2xl font-semibold text-gray-900">
                                Qué interpreta hoy el sistema
                            </h4>
                            <p className="mt-3 text-sm leading-6 text-gray-600">
                                Este snapshot resume el conocimiento operativo vigente, sus
                                fuentes trazables, los vacíos detectados y la base predeterminada
                                del runtime. No representa “madurez del modelo”, sino conocimiento
                                aprobado y reglas activas del sistema.
                            </p>
                            {snapshot && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Badge className="bg-sky-50 text-sky-700">
                                        Scope: {snapshot.scope}
                                    </Badge>
                                    <Badge className="bg-violet-50 text-violet-700">
                                        Versión {snapshot.version}
                                    </Badge>
                                    <Badge className="bg-slate-100 text-slate-700">
                                        {humanize(snapshot.status)}
                                    </Badge>
                                    <Badge className="bg-emerald-50 text-emerald-700">
                                        Cobertura {Math.round((snapshot.coverageScore ?? 0) * 100)}%
                                    </Badge>
                                </div>
                            )}
                            <div className="mt-3 text-xs text-gray-500">
                                Última generación: {formatDateTime(snapshot?.generatedAt ?? null)}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant={scope === 'admin_internal' ? 'solid' : 'default'}
                                onClick={() => setSearchParams({ scope: 'admin_internal' })}
                            >
                                Admin interno
                            </Button>
                            <Button
                                variant={scope === 'customer_public' ? 'solid' : 'default'}
                                onClick={() => setSearchParams({ scope: 'customer_public' })}
                            >
                                Cliente público
                            </Button>
                            <Button
                                variant="solid"
                                disabled={!snapshot}
                                onClick={() =>
                                    snapshot &&
                                    navigate(
                                        `${APP_PREFIX_PATH}/settings/ai/knowledge/snapshots/${snapshot.id}`,
                                    )
                                }
                            >
                                Abrir detail
                            </Button>
                            <Button
                                disabled={!snapshot}
                                onClick={() =>
                                    snapshot &&
                                    navigate(
                                        `${APP_PREFIX_PATH}/settings/ai/knowledge/snapshots/${snapshot.id}/sources`,
                                    )
                                }
                            >
                                Ver fuentes
                            </Button>
                            <Button onClick={() => void loadSnapshot()}>Refrescar</Button>
                        </div>
                    </div>
                </Card>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Card bodyClass="p-5">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            Conocimiento aprobado
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-gray-900">
                            {summary.approved}
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                            {summary.activeDocuments} documentos activos y {summary.approvedCandidates}{' '}
                            intercambios aprobados.
                        </div>
                    </Card>
                    <Card bodyClass="p-5">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            Base predeterminada
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-gray-900">
                            {summary.base}
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                            Reglas operativas base vigentes aun sin conocimiento específico.
                        </div>
                    </Card>
                    <Card bodyClass="p-5">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            Vacíos detectados
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-gray-900">
                            {summary.gaps}
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                            {summary.pendingRawEvents} raw events aún no resueltos en el digest
                            activo.
                        </div>
                    </Card>
                    <Card bodyClass="p-5">
                        <div className="text-xs uppercase tracking-wide text-gray-400">
                            Fuentes trazadas
                        </div>
                        <div className="mt-2 text-3xl font-semibold text-gray-900">
                            {summary.sourceCount}
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                            Documentos, candidates y fuentes sintéticas del runtime.
                        </div>
                    </Card>
                </div>

                <Card bodyClass="p-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h5 className="text-lg font-semibold text-gray-900">
                                Señales pendientes fuera del digest activo
                            </h5>
                            <p className="mt-1 text-sm text-gray-500">
                                Bundles multi-turno y negative examples pendientes de review. Se
                                muestran para control operativo, pero todavía no afectan el
                                snapshot activo.
                            </p>
                        </div>
                        <Badge
                            className="bg-amber-50 text-amber-700"
                            data-testid="ai-knowledge-snapshot-pending-signals-count"
                        >
                            {summary.pendingBundles + summary.pendingNegativeExamples} señales de
                            review
                        </Badge>
                    </div>

                    <div
                        className="mt-5 grid gap-4 xl:grid-cols-2"
                        data-testid="ai-knowledge-snapshot-pending-signals"
                    >
                        <div className="rounded-3xl border border-gray-200 p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-gray-900">
                                    Conversation bundles pendientes
                                </div>
                                <Badge className="bg-sky-50 text-sky-700">
                                    {pendingBundles.length}
                                </Badge>
                            </div>
                            <div className="mt-4 space-y-3">
                                {pendingBundles.length > 0 ? (
                                    pendingBundles.slice(0, 4).map((bundle) => (
                                        <div
                                            key={bundle.id}
                                            className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4"
                                        >
                                            <div className="font-semibold text-sky-950">
                                                {bundle.title}
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-sky-900/80">
                                                {renderSignalPreview(
                                                    bundle.summary,
                                                    bundle.previewQuestion,
                                                )}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                                        No hay bundles pendientes para este scope.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-gray-200 p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-gray-900">
                                    Negative examples pendientes
                                </div>
                                <Badge className="bg-rose-50 text-rose-700">
                                    {pendingNegativeExamples.length}
                                </Badge>
                            </div>
                            <div className="mt-4 space-y-3">
                                {pendingNegativeExamples.length > 0 ? (
                                    pendingNegativeExamples.slice(0, 4).map((item) => (
                                        <div
                                            key={item.id}
                                            className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4"
                                        >
                                            <div className="font-semibold text-rose-950">
                                                {item.title}
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-rose-900/80">
                                                {renderSignalPreview(
                                                    item.summary,
                                                    item.disallowedText,
                                                )}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                                        No hay guardrails negativos pendientes.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </Card>

                {snapshot?.summaryText && (
                    <Card bodyClass="p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h5 className="text-lg font-semibold text-gray-900">
                                    Resumen plano actual
                                </h5>
                                <p className="mt-1 text-sm text-gray-500">
                                    Digest determinístico del conocimiento vigente.
                                </p>
                            </div>
                        </div>
                        <pre className="mt-4 overflow-x-auto rounded-2xl bg-gray-950 p-4 text-xs leading-6 text-gray-100">
                            {snapshot.summaryText}
                        </pre>
                    </Card>
                )}

                {diff && (
                    <Card bodyClass="p-6">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                            <div>
                                <h5 className="text-lg font-semibold text-gray-900">
                                    Cambio respecto al snapshot anterior
                                </h5>
                                <p className="mt-1 text-sm text-gray-500">
                                    {diff.compareTo
                                        ? `Comparado contra versión ${diff.compareTo.version} (${formatDateTime(diff.compareTo.generatedAt)})`
                                        : 'Todavía no existe una versión anterior para comparar.'}
                                </p>
                            </div>
                            {snapshot && (
                                <Button
                                    disabled={!snapshot}
                                    onClick={() =>
                                        navigate(
                                            `${APP_PREFIX_PATH}/settings/ai/knowledge/snapshots/${snapshot.id}`,
                                        )
                                    }
                                >
                                    Ver diff completo
                                </Button>
                            )}
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-4">
                            <Card bodyClass="p-4">
                                <div className="text-xs uppercase tracking-wide text-gray-400">
                                    Agregados
                                </div>
                                <div className="mt-2 text-2xl font-semibold text-emerald-700">
                                    {diff.summary.added}
                                </div>
                            </Card>
                            <Card bodyClass="p-4">
                                <div className="text-xs uppercase tracking-wide text-gray-400">
                                    Cambiados
                                </div>
                                <div className="mt-2 text-2xl font-semibold text-amber-700">
                                    {diff.summary.changed}
                                </div>
                            </Card>
                            <Card bodyClass="p-4">
                                <div className="text-xs uppercase tracking-wide text-gray-400">
                                    Removidos
                                </div>
                                <div className="mt-2 text-2xl font-semibold text-rose-700">
                                    {diff.summary.removed}
                                </div>
                            </Card>
                            <Card bodyClass="p-4">
                                <div className="text-xs uppercase tracking-wide text-gray-400">
                                    Sin cambios
                                </div>
                                <div className="mt-2 text-2xl font-semibold text-slate-700">
                                    {diff.summary.unchanged}
                                </div>
                            </Card>
                        </div>
                    </Card>
                )}

                <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
                    <Card bodyClass="p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h5 className="text-lg font-semibold text-gray-900">
                                    Conocimiento activo principal
                                </h5>
                                <p className="mt-1 text-sm text-gray-500">
                                    Entradas aprobadas que hoy impactan la interpretación del
                                    sistema.
                                </p>
                            </div>
                            <Badge className="bg-sky-50 text-sky-700">
                                {topEntries.length} visibles
                            </Badge>
                        </div>
                        <div className="mt-4 space-y-3">
                            {topEntries.length > 0 ? (
                                topEntries.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="rounded-2xl border border-gray-200 p-4"
                                    >
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="font-semibold text-gray-900">
                                                {entry.title}
                                            </div>
                                            <Badge className="bg-slate-100 text-slate-700">
                                                {humanize(entry.entryType)}
                                            </Badge>
                                            {entry.normalizedIntent && (
                                                <Badge className="bg-violet-50 text-violet-700">
                                                    {entry.normalizedIntent}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-gray-600">
                                            {entry.plainText}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <Alert showIcon type="info">
                                    Todavía no hay conocimiento aprobado específico. El sistema
                                    queda respaldado por la base predeterminada del runtime.
                                </Alert>
                            )}
                        </div>
                    </Card>

                    <div className="flex flex-col gap-6">
                        <Card bodyClass="p-6">
                            <h5 className="text-lg font-semibold text-gray-900">
                                Base operativa predeterminada
                            </h5>
                            <div className="mt-4 space-y-3">
                                {baseEntries.map((entry) => (
                                    <div
                                        key={entry.id}
                                        className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4"
                                    >
                                        <div className="font-semibold text-sky-900">
                                            {entry.title}
                                        </div>
                                        <p className="mt-2 text-sm leading-6 text-sky-900/80">
                                            {entry.plainText}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </Card>

                        <Card bodyClass="p-6">
                            <h5 className="text-lg font-semibold text-gray-900">
                                Vacíos detectados
                            </h5>
                            <div className="mt-4 space-y-3">
                                {gapEntries.length > 0 ? (
                                    gapEntries.map((entry) => (
                                        <div
                                            key={entry.id}
                                            className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
                                        >
                                            <div className="font-semibold text-amber-900">
                                                {entry.title}
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-amber-900/80">
                                                {entry.plainText}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-900">
                                        No hay vacíos detectados para este snapshot.
                                    </div>
                                )}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </Loading>
    )
}

export default AiKnowledgeSnapshotsPage

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
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

const isBaseEntry = (entry: AiKnowledgeSnapshotEntry) =>
    entry.entryType === 'operational_note' &&
    entry.metadata?.entryClass === 'default_runtime_rule'

const groupLabel = (entry: AiKnowledgeSnapshotEntry) => {
    if (isBaseEntry(entry)) return 'Base predeterminada'
    if (entry.entryType === 'known_gap') return 'Vacíos detectados'
    if (entry.entryType === 'guardrail_negative') return 'Guardrails negativos'
    return 'Conocimiento aprobado'
}

const renderSignalPreview = (value?: string | null, fallback?: string | null) => {
    const text = value?.trim() || fallback?.trim() || 'Sin resumen disponible.'
    if (text.length <= 180) {
        return text
    }
    return `${text.slice(0, 179).trimEnd()}…`
}

const AiKnowledgeSnapshotDetailPage = () => {
    const navigate = useNavigate()
    const { snapshotId = '' } = useParams<{ snapshotId?: string }>()
    const [loading, setLoading] = useState(false)
    const [snapshot, setSnapshot] = useState<AiKnowledgeSnapshot | null>(null)
    const [diff, setDiff] = useState<AiKnowledgeSnapshotDiff | null>(null)
    const [plainText, setPlainText] = useState<string>('')
    const [pendingBundles, setPendingBundles] = useState<AiKnowledgeConversationBundle[]>([])
    const [pendingNegativeExamples, setPendingNegativeExamples] = useState<
        AiKnowledgeNegativeExample[]
    >([])

    const loadSnapshot = useCallback(async () => {
        if (!snapshotId) return
        setLoading(true)
        try {
            const [snapshotResponse, diffResponse, plainTextResponse] = await Promise.all([
                AiKnowledgeService.getSnapshot(snapshotId),
                AiKnowledgeService.getSnapshotDiff(snapshotId),
                AiKnowledgeService.getSnapshotPlainText(snapshotId),
            ])
            const nextSnapshot = snapshotResponse.data
            setSnapshot(nextSnapshot)
            setDiff(diffResponse.data)
            setPlainText(plainTextResponse.data.plainText)
            const [pendingBundlesResponse, pendingNegativeExamplesResponse] =
                await Promise.all([
                    AiKnowledgeService.listConversationBundles({
                        scope: nextSnapshot.scope as 'customer_public' | 'admin_internal',
                        status: 'pending',
                        pageSize: 12,
                        orderBy: 'updatedAt',
                        orderDir: 'desc',
                    }),
                    AiKnowledgeService.listNegativeExamples({
                        scope: nextSnapshot.scope as 'customer_public' | 'admin_internal',
                        status: 'pending',
                        pageSize: 12,
                        orderBy: 'updatedAt',
                        orderDir: 'desc',
                    }),
                ])
            setPendingBundles(pendingBundlesResponse.data.items ?? [])
            setPendingNegativeExamples(pendingNegativeExamplesResponse.data.items ?? [])
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar el detail del snapshot" type="danger">
                    Verifica disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [snapshotId])

    useEffect(() => {
        void loadSnapshot()
    }, [loadSnapshot])

    const groupedEntries = useMemo(() => {
        const groups = new Map<string, AiKnowledgeSnapshotEntry[]>()
        for (const entry of snapshot?.entries ?? []) {
            const label = groupLabel(entry)
            const current = groups.get(label) ?? []
            current.push(entry)
            groups.set(label, current)
        }
        return Array.from(groups.entries())
    }, [snapshot])

    const handleCopyPlainText = useCallback(async () => {
        if (!plainText) return
        try {
            await navigator.clipboard.writeText(plainText)
            toast.push(
                <Notification title="Resumen copiado" type="success">
                    El snapshot en texto plano quedó disponible en el portapapeles.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible copiar el resumen" type="danger">
                    Tu navegador no permitió acceso al portapapeles.
                </Notification>,
                { placement: 'top-end' },
            )
        }
    }, [plainText])

    return (
        <Loading loading={loading}>
            <div className="flex flex-col gap-6" data-testid="ai-knowledge-snapshot-detail-page">
                <Card bodyClass="p-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="max-w-4xl">
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Snapshot Detail
                            </div>
                            <h4 className="mt-1 text-2xl font-semibold text-gray-900">
                                Snapshot {snapshot?.version ?? '...'} · {snapshot?.scope ?? 'scope'}
                            </h4>
                            <p className="mt-3 text-sm leading-6 text-gray-600">
                                Detail completo del conocimiento activo, las reglas base,
                                guardrails y vacíos que explican qué está interpretando hoy el
                                sistema.
                            </p>
                            {snapshot && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Badge className="bg-slate-100 text-slate-700">
                                        {humanize(snapshot.status)}
                                    </Badge>
                                    <Badge className="bg-sky-50 text-sky-700">
                                        {snapshot.entries.length} entries
                                    </Badge>
                                    {diff?.compareTo && (
                                        <Badge className="bg-violet-50 text-violet-700">
                                            Diff vs versión {diff.compareTo.version}
                                        </Badge>
                                    )}
                                </div>
                            )}
                            <div className="mt-3 text-xs text-gray-500">
                                Generado: {formatDateTime(snapshot?.generatedAt ?? null)}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                onClick={() =>
                                    navigate(`${APP_PREFIX_PATH}/settings/ai/knowledge/snapshots`)
                                }
                            >
                                Volver
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
                            <Button variant="solid" onClick={() => void handleCopyPlainText()}>
                                Copiar texto plano
                            </Button>
                        </div>
                    </div>
                </Card>

                {diff && (
                    <div className="grid gap-4 md:grid-cols-4">
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
                )}

                {diff?.changed && diff.changed.length > 0 && (
                    <Card bodyClass="p-6">
                        <h5 className="text-lg font-semibold text-gray-900">
                            Cambios frente a la versión anterior
                        </h5>
                        <div className="mt-4 space-y-3">
                            {diff.changed.slice(0, 8).map((entry) => (
                                <div
                                    key={entry.key}
                                    className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"
                                >
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="font-semibold text-amber-950">
                                            {entry.current.title}
                                        </div>
                                        {entry.fields.map((field) => (
                                            <Badge
                                                key={field}
                                                className="bg-white text-amber-800"
                                            >
                                                {field}
                                            </Badge>
                                        ))}
                                    </div>
                                    <div className="mt-3 grid gap-3 lg:grid-cols-2">
                                        <div className="rounded-xl bg-white/80 p-3">
                                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                                Antes
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-gray-700">
                                                {entry.previous.plainText}
                                            </p>
                                        </div>
                                        <div className="rounded-xl bg-white/80 p-3">
                                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                                Ahora
                                            </div>
                                            <p className="mt-2 text-sm leading-6 text-gray-700">
                                                {entry.current.plainText}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                )}

                {plainText && (
                    <Card bodyClass="p-6">
                        <h5 className="text-lg font-semibold text-gray-900">
                            Resumen determinístico
                        </h5>
                        <pre className="mt-4 overflow-x-auto rounded-2xl bg-gray-950 p-4 text-xs leading-6 text-gray-100">
                            {plainText}
                        </pre>
                    </Card>
                )}

                <Card bodyClass="p-6">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <h5 className="text-lg font-semibold text-gray-900">
                                Señales pendientes de review
                            </h5>
                            <p className="mt-1 text-sm text-gray-500">
                                Estas entidades todavía no forman parte del digest activo. Sirven
                                para revisar bundles multi-turno y guardrails negativos antes de
                                promoverlos.
                            </p>
                        </div>
                        <Badge
                            className="bg-amber-50 text-amber-700"
                            data-testid="ai-knowledge-snapshot-detail-pending-signals-count"
                        >
                            {pendingBundles.length + pendingNegativeExamples.length} señales
                            pendientes
                        </Badge>
                    </div>
                    <div
                        className="mt-5 grid gap-4 xl:grid-cols-2"
                        data-testid="ai-knowledge-snapshot-detail-pending-signals"
                    >
                        <div className="rounded-3xl border border-gray-200 p-5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-semibold text-gray-900">
                                    Bundles pendientes
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

                <Card bodyClass="p-6">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h5 className="text-lg font-semibold text-gray-900">
                                Entries del snapshot
                            </h5>
                            <p className="mt-1 text-sm text-gray-500">
                                Cada entry mantiene texto operativo y trazabilidad de fuentes.
                            </p>
                        </div>
                    </div>
                    <div className="mt-6 space-y-6">
                        {groupedEntries.length > 0 ? (
                            groupedEntries.map(([label, entries]) => (
                                <div key={label}>
                                    <div className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                                        {label}
                                    </div>
                                    <div className="mt-3 space-y-3">
                                        {entries.map((entry) => (
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
                                                    {entry.topicKey && (
                                                        <Badge className="bg-sky-50 text-sky-700">
                                                            {entry.topicKey}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="mt-2 text-sm leading-6 text-gray-600">
                                                    {entry.plainText}
                                                </p>
                                                {entry.appliesToChannels.length > 0 && (
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {entry.appliesToChannels.map((channel) => (
                                                            <Badge
                                                                key={channel}
                                                                className="bg-gray-100 text-gray-700"
                                                            >
                                                                {channel}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="mt-3 text-xs text-gray-500">
                                                    {entry.sources.length} fuente(s) asociadas
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <Alert showIcon type="info">
                                Este snapshot todavía no tiene entries persistidas.
                            </Alert>
                        )}
                    </div>
                </Card>
            </div>
        </Loading>
    )
}

export default AiKnowledgeSnapshotDetailPage

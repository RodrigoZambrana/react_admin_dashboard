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
    type AiKnowledgeSnapshot,
    type AiKnowledgeSnapshotEntry,
    type AiKnowledgeSnapshotSource,
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

type FlattenedSource = {
    key: string
    source: AiKnowledgeSnapshotSource
    entries: Array<Pick<AiKnowledgeSnapshotEntry, 'id' | 'title' | 'entryType'>>
}

const AiKnowledgeSnapshotSourcesPage = () => {
    const navigate = useNavigate()
    const { snapshotId = '' } = useParams<{ snapshotId?: string }>()
    const [loading, setLoading] = useState(false)
    const [snapshot, setSnapshot] = useState<AiKnowledgeSnapshot | null>(null)

    const loadSnapshot = useCallback(async () => {
        if (!snapshotId) return
        setLoading(true)
        try {
            const response = await AiKnowledgeService.getSnapshot(snapshotId)
            setSnapshot(response.data)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar las fuentes del snapshot" type="danger">
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

    const sources = useMemo<FlattenedSource[]>(() => {
        const map = new Map<string, FlattenedSource>()

        for (const entry of snapshot?.entries ?? []) {
            for (const source of entry.sources) {
                const key = `${source.sourceKind}:${source.sourceId}`
                const current = map.get(key)
                if (current) {
                    current.entries.push({
                        id: entry.id,
                        title: entry.title,
                        entryType: entry.entryType,
                    })
                    continue
                }

                map.set(key, {
                    key,
                    source,
                    entries: [
                        {
                            id: entry.id,
                            title: entry.title,
                            entryType: entry.entryType,
                        },
                    ],
                })
            }
        }

        return Array.from(map.values()).sort((left, right) =>
            right.entries.length - left.entries.length,
        )
    }, [snapshot])

    return (
        <Loading loading={loading}>
            <div className="flex flex-col gap-6" data-testid="ai-knowledge-snapshot-sources-page">
                <Card bodyClass="p-6">
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                        <div className="max-w-4xl">
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Snapshot Sources
                            </div>
                            <h4 className="mt-1 text-2xl font-semibold text-gray-900">
                                Fuentes trazables del snapshot
                            </h4>
                            <p className="mt-3 text-sm leading-6 text-gray-600">
                                Esta vista muestra de dónde sale cada parte del snapshot activo:
                                documentos, candidates, raw events y reglas sintéticas del runtime.
                            </p>
                            {snapshot && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Badge className="bg-sky-50 text-sky-700">
                                        Snapshot {snapshot.version}
                                    </Badge>
                                    <Badge className="bg-slate-100 text-slate-700">
                                        {snapshot.scope}
                                    </Badge>
                                    <Badge className="bg-violet-50 text-violet-700">
                                        {sources.length} fuentes únicas
                                    </Badge>
                                </div>
                            )}
                            <div className="mt-3 text-xs text-gray-500">
                                Generado: {formatDateTime(snapshot?.generatedAt ?? null)}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                onClick={() =>
                                    snapshot &&
                                    navigate(
                                        `${APP_PREFIX_PATH}/settings/ai/knowledge/snapshots/${snapshot.id}`,
                                    )
                                }
                            >
                                Volver al detail
                            </Button>
                            <Button
                                onClick={() =>
                                    navigate(`${APP_PREFIX_PATH}/settings/ai/knowledge/snapshots`)
                                }
                            >
                                Overview
                            </Button>
                        </div>
                    </div>
                </Card>

                <Card bodyClass="p-6">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h5 className="text-lg font-semibold text-gray-900">
                                Inventario de fuentes
                            </h5>
                            <p className="mt-1 text-sm text-gray-500">
                                Cada fuente indica su rol y las entries del snapshot que soporta.
                            </p>
                        </div>
                    </div>

                    <div className="mt-6 space-y-4">
                        {sources.length > 0 ? (
                            sources.map((item) => {
                                const sourceLabel =
                                    typeof item.source.metadata?.label === 'string'
                                        ? item.source.metadata.label
                                        : `${humanize(item.source.sourceKind)} · ${item.source.sourceId}`

                                return (
                                    <div
                                        key={item.key}
                                        className="rounded-2xl border border-gray-200 p-5"
                                    >
                                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="max-w-4xl">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <div className="font-semibold text-gray-900">
                                                        {sourceLabel}
                                                    </div>
                                                    <Badge className="bg-slate-100 text-slate-700">
                                                        {humanize(item.source.role)}
                                                    </Badge>
                                                    <Badge className="bg-sky-50 text-sky-700">
                                                        {humanize(item.source.sourceKind)}
                                                    </Badge>
                                                    {item.source.sourceStatus && (
                                                        <Badge className="bg-gray-100 text-gray-700">
                                                            {item.source.sourceStatus}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {item.source.excerpt && (
                                                    <p className="mt-3 text-sm leading-6 text-gray-600">
                                                        {item.source.excerpt}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                                Actualizado {formatDateTime(item.source.updatedAt)}
                                            </div>
                                        </div>

                                        <div className="mt-4">
                                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                                Utilizada por
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {item.entries.map((entry) => (
                                                    <div
                                                        key={`${item.key}:${entry.id}`}
                                                        className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                                                    >
                                                        <span className="font-medium text-gray-900">
                                                            {entry.title}
                                                        </span>{' '}
                                                        · {humanize(entry.entryType)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        ) : (
                            <Alert showIcon type="info">
                                Este snapshot todavía no tiene fuentes registradas.
                            </Alert>
                        )}
                    </div>
                </Card>
            </div>
        </Loading>
    )
}

export default AiKnowledgeSnapshotSourcesPage

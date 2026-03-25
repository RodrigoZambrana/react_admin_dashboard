import { useCallback, useEffect, useMemo, useState } from 'react'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Button from '@/components/ui/Button'
import Notification from '@/components/ui/Notification'
import { toast } from '@/components/ui/toast'
import {
    apiGetLatestQaRun,
    apiGetQaCatalog,
    apiGetQaRunDetails,
    apiGetQaRuns,
} from '@/services/QaService'

type QaCatalogBlock = {
    id: string
    name: string
    description: string
    kind: string
    estimatedMinutes: number | null
    tags: string[]
    cwd: string | null
    commandDisplay: string
}

type QaCatalog = {
    version: number
    defaultBlockIds: string[]
    blocks: QaCatalogBlock[]
}

type QaRunListItem = {
    id: string
    status: string
    startedAt: string
    finishedAt: string | null
    repeat: number
    selectedBlockIds: string[]
    blocks: Array<{
        id: string
        blockId: string
        name: string
        status: string
        attempt: number
        durationMs: number | null
    }>
}

type QaRunDetails = {
    id: string
    status: string
    startedAt: string
    finishedAt: string | null
    repeat?: number
    selectedBlockIds?: string[]
    blocks: Array<{
        id: string
        blockId: string
        name: string
        description: string
        kind?: string
        tags?: string[]
        estimatedMinutes?: number | null
        attempt?: number
        status: string
        startedAt: string
        finishedAt: string | null
        durationMs: number | null
        cwd?: string
        commandDisplay?: string | null
        steps?: Array<{
            index: number
            cwd: string
            commandDisplay: string
            logFile?: string
            startedAt: string
            finishedAt: string
            exitCode: number
            status: string
            summary?: string
        }>
    }>
}

const statusTone = (status: string) => {
    switch (status) {
        case 'passed':
            return 'bg-emerald-100 text-emerald-700'
        case 'failed':
            return 'bg-rose-100 text-rose-700'
        case 'running':
            return 'bg-amber-100 text-amber-700'
        default:
            return 'bg-slate-100 text-slate-700'
    }
}

const formatDateTime = (value?: string | null) => {
    if (!value) return 'N/D'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('es-UY')
}

const formatDuration = (value?: number | null) => {
    if (!value || value <= 0) return 'N/D'
    if (value < 1000) return `${value} ms`
    return `${(value / 1000).toFixed(1)} s`
}

const QaCenter = () => {
    const [loading, setLoading] = useState(true)
    const [catalog, setCatalog] = useState<QaCatalog | null>(null)
    const [runs, setRuns] = useState<QaRunListItem[]>([])
    const [latestRun, setLatestRun] = useState<QaRunDetails | null>(null)
    const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
    const [selectedRun, setSelectedRun] = useState<QaRunDetails | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [catalogResponse, latestResponse, runsResponse] = await Promise.all([
                apiGetQaCatalog<QaCatalog>(),
                apiGetLatestQaRun<QaRunDetails | null>(),
                apiGetQaRuns<QaRunListItem[]>({ limit: 10 }),
            ])
            const nextCatalog = catalogResponse.data ?? null
            const nextLatest = latestResponse.data ?? null
            const nextRuns = Array.isArray(runsResponse.data) ? runsResponse.data : []
            setCatalog(nextCatalog)
            setLatestRun(nextLatest)
            setRuns(nextRuns)
            setSelectedRunId((current) => current ?? nextLatest?.id ?? nextRuns[0]?.id ?? null)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="QA Center" type="danger">
                    No fue posible cargar el estado actual de QA.
                </Notification>,
            )
        } finally {
            setLoading(false)
        }
    }, [])

    const loadRunDetails = useCallback(async (runId: string) => {
        try {
            const response = await apiGetQaRunDetails<QaRunDetails>(runId)
            setSelectedRun(response.data ?? null)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="QA Center" type="danger">
                    No fue posible cargar el detalle del run seleccionado.
                </Notification>,
            )
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    useEffect(() => {
        if (!selectedRunId) {
            setSelectedRun(latestRun)
            return
        }
        if (latestRun?.id === selectedRunId) {
            setSelectedRun(latestRun)
            return
        }
        void loadRunDetails(selectedRunId)
    }, [latestRun, loadRunDetails, selectedRunId])

    const defaultCommand = useMemo(() => 'node tools/qa/run-qa.mjs', [])

    const copyText = useCallback(async (value: string, title: string) => {
        try {
            await navigator.clipboard.writeText(value)
            toast.push(
                <Notification title="QA Center" type="success">
                    {title}
                </Notification>,
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="QA Center" type="danger">
                    No fue posible copiar el comando.
                </Notification>,
            )
        }
    }, [])

    return (
        <div className="flex flex-col gap-4">
            <AdaptableCard>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        <h3 className="text-xl font-semibold">QA Center</h3>
                        <p className="max-w-3xl text-sm text-gray-600">
                            Runner por bloques para validar storefront, backend y admin. El disparo se hace por consola
                            y este panel muestra el catálogo, el orden recomendado y los últimos resultados persistidos.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="solid"
                            onClick={() => void copyText(`${defaultCommand} --all`, 'Comando completo copiado')}
                        >
                            Copiar comando full
                        </Button>
                        <Button variant="default" onClick={() => void load()} loading={loading}>
                            Refrescar
                        </Button>
                    </div>
                </div>
            </AdaptableCard>

            <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <AdaptableCard>
                    <div className="flex items-center justify-between">
                        <h4 className="text-lg font-semibold">Bloques</h4>
                        <span className="text-xs text-gray-500">
                            {catalog?.blocks?.length ?? 0} configurados
                        </span>
                    </div>
                    <div className="mt-4 space-y-4">
                        {(catalog?.blocks ?? []).map((block) => (
                            <div key={block.id} className="rounded-2xl border border-gray-200 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <div className="font-semibold">{block.name}</div>
                                        <div className="text-xs text-gray-500">{block.id}</div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusTone(
                                            catalog?.defaultBlockIds.includes(block.id) ? 'running' : 'idle',
                                        )}`}>
                                            {catalog?.defaultBlockIds.includes(block.id) ? 'Default' : 'Opcional'}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                            {block.kind}
                                        </span>
                                    </div>
                                </div>
                                <p className="mt-3 text-sm text-gray-600">{block.description}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {(block.tags ?? []).map((tag) => (
                                        <span
                                            key={`${block.id}-${tag}`}
                                            className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                                <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-700">
                                    <div className="mb-2 font-medium">Comando</div>
                                    <pre className="whitespace-pre-wrap font-mono">{block.commandDisplay}</pre>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                                    <span>Estimado: {block.estimatedMinutes ?? 'N/D'} min</span>
                                    <Button
                                        size="sm"
                                        variant="plain"
                                        onClick={() =>
                                            void copyText(
                                                `${defaultCommand} --block ${block.id}`,
                                                `Comando del bloque ${block.id} copiado`,
                                            )
                                        }
                                    >
                                        Copiar bloque
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </AdaptableCard>

                <div className="flex flex-col gap-4">
                    <AdaptableCard>
                        <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold">Último run</h4>
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusTone(latestRun?.status ?? 'idle')}`}>
                                {latestRun?.status ?? 'sin datos'}
                            </span>
                        </div>
                        <div className="mt-4 space-y-2 text-sm text-gray-600">
                            <div>ID: {latestRun?.id ?? 'N/D'}</div>
                            <div>Inicio: {formatDateTime(latestRun?.startedAt)}</div>
                            <div>Fin: {formatDateTime(latestRun?.finishedAt)}</div>
                            <div>Bloques: {latestRun?.blocks?.length ?? 0}</div>
                        </div>
                    </AdaptableCard>

                    <AdaptableCard>
                        <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold">Historial</h4>
                            <span className="text-xs text-gray-500">{runs.length} runs</span>
                        </div>
                        <div className="mt-4 space-y-3">
                            {runs.map((run) => (
                                <button
                                    key={run.id}
                                    type="button"
                                    className={`w-full rounded-2xl border p-3 text-left transition ${
                                        selectedRunId === run.id
                                            ? 'border-primary bg-primary-subtle'
                                            : 'border-gray-200 hover:border-primary'
                                    }`}
                                    onClick={() => setSelectedRunId(run.id)}
                                >
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="font-medium">{run.id}</div>
                                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusTone(run.status)}`}>
                                            {run.status}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-xs text-gray-500">
                                        {formatDateTime(run.startedAt)} · {run.blocks.length} bloques
                                    </div>
                                </button>
                            ))}
                        </div>
                    </AdaptableCard>

                    <AdaptableCard>
                        <div className="flex items-center justify-between">
                            <h4 className="text-lg font-semibold">Detalle seleccionado</h4>
                            <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusTone(selectedRun?.status ?? 'idle')}`}>
                                {selectedRun?.status ?? 'sin datos'}
                            </span>
                        </div>
                        <div className="mt-4 space-y-4">
                            {(selectedRun?.blocks ?? []).map((block) => (
                                <div key={block.id} className="rounded-2xl border border-gray-200 p-4">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>
                                            <div className="font-semibold">{block.name}</div>
                                            <div className="text-xs text-gray-500">{block.blockId}</div>
                                        </div>
                                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusTone(block.status)}`}>
                                            {block.status}
                                        </span>
                                    </div>
                                    <p className="mt-2 text-sm text-gray-600">{block.description}</p>
                                    <div className="mt-2 text-xs text-gray-500">
                                        Intento {block.attempt ?? 1} · Duración {formatDuration(block.durationMs)}
                                    </div>
                                    <div className="mt-3 space-y-3">
                                        {(block.steps ?? []).map((step) => (
                                            <div key={`${block.id}-${step.index}`} className="rounded-xl bg-gray-50 p-3">
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="font-medium">Paso {step.index}</div>
                                                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusTone(step.status)}`}>
                                                        {step.status}
                                                    </span>
                                                </div>
                                                <div className="mt-2 text-xs text-gray-600">{step.cwd}</div>
                                                <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700">
                                                    {step.commandDisplay}
                                                </pre>
                                                {step.summary ? (
                                                    <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-gray-700">
                                                        {step.summary}
                                                    </pre>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </AdaptableCard>
                </div>
            </div>
        </div>
    )
}

export default QaCenter

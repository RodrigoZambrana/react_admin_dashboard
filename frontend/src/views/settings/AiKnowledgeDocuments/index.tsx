/* eslint-disable jsx-a11y/label-has-associated-control */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Upload from '@/components/ui/Upload'
import Switcher from '@/components/ui/Switcher'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import Loading from '@/components/shared/Loading'
import DataTable from '@/components/shared/DataTable'
import type { ColumnDef, OnSortParam } from '@/components/shared/DataTable'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import AiKnowledgeService, {
    type AiKnowledgeDocument,
    type CreateKnowledgeUrlPayload,
    type CreateCuratedKnowledgePayload,
    type ListKnowledgeDocumentsParams,
    type UpdateKnowledgeDocumentPayload,
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

const formatFileSize = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) {
        return '0 B'
    }
    const units = ['B', 'KB', 'MB', 'GB']
    let size = value
    let unitIndex = 0
    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024
        unitIndex += 1
    }
    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

type DocumentFilters = {
    search: string
    scope: string
    status: string
    sourceType: string
    originCategory: string
    contentType: string
    hasEmbedding: string
}

type CuratedKnowledgeForm = {
    scope: 'customer_public' | 'admin_internal'
    title: string
    summary: string
    content: string
    tags: string
}

type UploadedKnowledgeForm = {
    scope: 'customer_public' | 'admin_internal'
    title: string
    summary: string
    tags: string
}

type UrlKnowledgeForm = {
    scope: 'customer_public' | 'admin_internal'
    url: string
    title: string
    summary: string
    tags: string
    refreshPolicy: 'manual' | 'daily' | 'weekly' | 'on_demand'
    crawlMode: 'single' | 'deep'
    crawlMaxDepth: number
    crawlMaxPages: number
    crawlSameDomainOnly: boolean
    crawlRespectRobots: boolean
    crawlExclude: string
}

type KnowledgeDocumentForm = {
    scope: 'customer_public' | 'admin_internal'
    status: 'draft' | 'active' | 'archived'
    title: string
    summary: string
    content: string
    tags: string
    url: string
    refreshPolicy: 'manual' | 'daily' | 'weekly' | 'on_demand'
}

type KnowledgeIndexStatusSnapshot = {
    tenantKey: string
    runtime: {
        running: boolean
        trigger: string | null
        startedAt: string | null
        finishedAt: string | null
        lastSummary: Record<string, unknown> | null
        lastError: string | null
    } | null
    counts: Array<{
        status: string
        scope: string
        count: number
    }>
    documentsWithoutChunks: number
}

const initialFilters: DocumentFilters = {
    search: '',
    scope: 'all',
    status: 'all',
    sourceType: 'all',
    originCategory: 'all',
    contentType: 'all',
    hasEmbedding: 'all',
}

const initialCuratedKnowledgeForm: CuratedKnowledgeForm = {
    scope: 'admin_internal',
    title: '',
    summary: '',
    content: '',
    tags: '',
}

const initialUploadedKnowledgeForm: UploadedKnowledgeForm = {
    scope: 'admin_internal',
    title: '',
    summary: '',
    tags: '',
}

const initialUrlKnowledgeForm: UrlKnowledgeForm = {
    scope: 'customer_public',
    url: '',
    title: '',
    summary: '',
    tags: '',
    refreshPolicy: 'daily',
    crawlMode: 'single',
    crawlMaxDepth: 2,
    crawlMaxPages: 40,
    crawlSameDomainOnly: true,
    crawlRespectRobots: true,
    crawlExclude: '',
}

const initialKnowledgeDocumentForm: KnowledgeDocumentForm = {
    scope: 'admin_internal',
    status: 'active',
    title: '',
    summary: '',
    content: '',
    tags: '',
    url: '',
    refreshPolicy: 'daily',
}

const documentStatusClassName: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    archived: 'bg-slate-100 text-slate-700',
    draft: 'bg-amber-50 text-amber-700',
}

const readUrlMetadata = (document: AiKnowledgeDocument | null) => {
    const metadata =
        document?.metadata && typeof document.metadata === 'object'
            ? (document.metadata as Record<string, unknown>)
            : null

    return {
        url: typeof metadata?.url === 'string' ? metadata.url : '',
        refreshPolicy:
            typeof metadata?.refreshPolicy === 'string'
                ? (metadata.refreshPolicy as UrlKnowledgeForm['refreshPolicy'])
                : 'daily',
        lastFetchedAt:
            typeof metadata?.lastFetchedAt === 'string' ? metadata.lastFetchedAt : null,
        lastCheckedAt:
            typeof metadata?.lastCheckedAt === 'string' ? metadata.lastCheckedAt : null,
        nextRefreshAt:
            typeof metadata?.nextRefreshAt === 'string' ? metadata.nextRefreshAt : null,
    }
}

const AiKnowledgeDocuments = () => {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const detailSectionRef = useRef<HTMLDivElement | null>(null)
    const [loading, setLoading] = useState(false)
    const [items, setItems] = useState<AiKnowledgeDocument[]>([])
    const [total, setTotal] = useState(0)
    const [pageIndex, setPageIndex] = useState(1)
    const [pageSize, setPageSize] = useState(25)
    const [sort, setSort] = useState<OnSortParam>({
        key: 'updatedAt',
        order: 'desc',
    })
    const [filters, setFilters] = useState<DocumentFilters>(initialFilters)
    const [searchDraft, setSearchDraft] = useState('')
    const [detailLoading, setDetailLoading] = useState(false)
    const [selectedDocumentDetail, setSelectedDocumentDetail] =
        useState<AiKnowledgeDocument | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [curatedForm, setCuratedForm] = useState<CuratedKnowledgeForm>(
        initialCuratedKnowledgeForm,
    )
    const [uploadedKnowledgeForm, setUploadedKnowledgeForm] =
        useState<UploadedKnowledgeForm>(initialUploadedKnowledgeForm)
    const [uploadedKnowledgeFiles, setUploadedKnowledgeFiles] = useState<File[]>([])
    const [urlKnowledgeForm, setUrlKnowledgeForm] =
        useState<UrlKnowledgeForm>(initialUrlKnowledgeForm)
    const [documentForm, setDocumentForm] = useState<KnowledgeDocumentForm>(
        initialKnowledgeDocumentForm,
    )
    const [indexStatus, setIndexStatus] =
        useState<KnowledgeIndexStatusSnapshot | null>(null)

    const fetchDocuments = useCallback(async () => {
        setLoading(true)
        try {
            const params: ListKnowledgeDocumentsParams = {
                page: pageIndex,
                pageSize,
                orderBy: String(sort.key || 'updatedAt') as ListKnowledgeDocumentsParams['orderBy'],
                orderDir: (sort.order || 'desc') as 'asc' | 'desc',
                search: filters.search || undefined,
                scope:
                    filters.scope !== 'all'
                        ? (filters.scope as ListKnowledgeDocumentsParams['scope'])
                        : undefined,
                status:
                    filters.status !== 'all'
                        ? (filters.status as ListKnowledgeDocumentsParams['status'])
                        : undefined,
                sourceType:
                    filters.sourceType !== 'all'
                        ? (filters.sourceType as ListKnowledgeDocumentsParams['sourceType'])
                        : undefined,
                originCategory:
                    filters.originCategory !== 'all'
                        ? (filters.originCategory as ListKnowledgeDocumentsParams['originCategory'])
                        : undefined,
                contentType:
                    filters.contentType !== 'all'
                        ? (filters.contentType as ListKnowledgeDocumentsParams['contentType'])
                        : undefined,
                hasEmbedding:
                    filters.hasEmbedding !== 'all'
                        ? filters.hasEmbedding === 'true'
                        : undefined,
            }
            const [response, indexResponse] = await Promise.all([
                AiKnowledgeService.listDocuments(params),
                AiKnowledgeService.getIndexStatus(),
            ])
            setItems(response.data.items)
            setTotal(response.data.total)
            setIndexStatus(indexResponse.data)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar documentos" type="danger">
                    Revisa disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [filters, pageIndex, pageSize, sort])

    useEffect(() => {
        void fetchDocuments()
    }, [fetchDocuments])

    const selectedDocumentId = useMemo(
        () => searchParams.get('detail')?.trim() || null,
        [searchParams],
    )

    const updateSelectedDocument = useCallback(
        (documentId: string | null, options?: { replace?: boolean }) => {
            const nextSearchParams = new URLSearchParams(searchParams)
            if (documentId) {
                nextSearchParams.set('detail', documentId)
            } else {
                nextSearchParams.delete('detail')
            }
            setSearchParams(nextSearchParams, { replace: options?.replace ?? false })
        },
        [searchParams, setSearchParams],
    )

    const selectedDocumentFromPage = useMemo(
        () => items.find((item) => item.id === selectedDocumentId) ?? null,
        [items, selectedDocumentId],
    )

    useEffect(() => {
        if (!selectedDocumentId) {
            setSelectedDocumentDetail(null)
            setDetailLoading(false)
            return
        }

        if (selectedDocumentFromPage) {
            setSelectedDocumentDetail(selectedDocumentFromPage)
            setDetailLoading(false)
            return
        }

        let cancelled = false
        setDetailLoading(true)
        void AiKnowledgeService.getDocument(selectedDocumentId)
            .then((response) => {
                if (!cancelled) {
                    setSelectedDocumentDetail(response.data)
                }
            })
            .catch((error) => {
                console.error(error)
                if (!cancelled) {
                    toast.push(
                        <Notification title="No fue posible abrir el detalle" type="danger">
                            El documento ya no existe o no está disponible.
                        </Notification>,
                        { placement: 'top-end' },
                    )
                    updateSelectedDocument(null, { replace: true })
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
    }, [selectedDocumentFromPage, selectedDocumentId, updateSelectedDocument])

    const selectedDocument = useMemo(
        () => selectedDocumentDetail,
        [selectedDocumentDetail],
    )

    useEffect(() => {
        if (!selectedDocumentId || !detailSectionRef.current) {
            return
        }
        detailSectionRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        })
    }, [selectedDocument, selectedDocumentId])

    useEffect(() => {
        if (!selectedDocument) {
            setDocumentForm(initialKnowledgeDocumentForm)
            return
        }

        const urlMetadata = readUrlMetadata(selectedDocument)

        setDocumentForm({
            scope:
                selectedDocument.scope === 'customer_public'
                    ? 'customer_public'
                    : 'admin_internal',
            status:
                selectedDocument.status === 'archived'
                    ? 'archived'
                    : selectedDocument.status === 'draft'
                      ? 'draft'
                      : 'active',
            title: selectedDocument.title,
            summary: selectedDocument.summary ?? '',
            content: selectedDocument.content,
            tags: selectedDocument.tags.join(', '),
            url: urlMetadata.url,
            refreshPolicy: urlMetadata.refreshPolicy,
        })
    }, [selectedDocument])

    const createCuratedKnowledge = useCallback(async () => {
        const title = curatedForm.title.trim()
        const content = curatedForm.content.trim()

        if (!title || !content) {
            toast.push(
                <Notification title="Faltan datos del documento" type="warning">
                    El título y el contenido son obligatorios.
                </Notification>,
                { placement: 'top-end' },
            )
            return
        }

        setActionLoading('curated')
        try {
            const payload: CreateCuratedKnowledgePayload = {
                scope: curatedForm.scope,
                title,
                summary: curatedForm.summary.trim() || undefined,
                content,
                tags: curatedForm.tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                metadata: {
                    source: 'knowledge-documents-page',
                },
            }
            const response = await AiKnowledgeService.createCurated(payload)
            setCuratedForm(initialCuratedKnowledgeForm)
            updateSelectedDocument(response.data.id)
            await fetchDocuments()
            toast.push(
                <Notification title="Documento curado guardado" type="success">
                    El contenido quedó disponible como conocimiento aprobado.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible guardar el documento" type="danger">
                    Revisa el contenido e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setActionLoading(null)
        }
    }, [curatedForm, fetchDocuments, updateSelectedDocument])

    const uploadDocument = useCallback(async () => {
        const file = uploadedKnowledgeFiles[0]
        if (!file) {
            toast.push(
                <Notification title="Falta documento" type="warning">
                    Selecciona un archivo para cargar.
                </Notification>,
                { placement: 'top-end' },
            )
            return
        }

        setActionLoading('upload')
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('scope', uploadedKnowledgeForm.scope)
            if (uploadedKnowledgeForm.title.trim()) {
                formData.append('title', uploadedKnowledgeForm.title.trim())
            }
            if (uploadedKnowledgeForm.summary.trim()) {
                formData.append('summary', uploadedKnowledgeForm.summary.trim())
            }
            if (uploadedKnowledgeForm.tags.trim()) {
                formData.append('tags', uploadedKnowledgeForm.tags.trim())
            }

            const response = await AiKnowledgeService.uploadDocument(formData)
            setUploadedKnowledgeFiles([])
            setUploadedKnowledgeForm(initialUploadedKnowledgeForm)
            updateSelectedDocument(response.data.id)
            await fetchDocuments()
            toast.push(
                <Notification title="Documento subido" type="success">
                    La fuente documental quedó gestionada dentro del módulo de knowledge.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible subir el documento" type="danger">
                    Revisa el archivo e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setActionLoading(null)
        }
    }, [fetchDocuments, updateSelectedDocument, uploadedKnowledgeFiles, uploadedKnowledgeForm])

    const reindexDocuments = useCallback(async () => {
        setActionLoading('index')
        try {
            const response = await AiKnowledgeService.runIndexBatch({
                selection: 'pending',
                background: true,
            })
            await fetchDocuments()
            toast.push(
                <Notification title="Reindexado lanzado" type="success">
                    {response.data.background
                        ? 'El batch de reindexado quedó corriendo en background.'
                        : `Se actualizaron ${response.data.indexed ?? 0} documentos aprobados.`}
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible reindexar" type="danger">
                    Revisa disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setActionLoading(null)
        }
    }, [fetchDocuments])

    const retryFailedDocuments = useCallback(async () => {
        setActionLoading('retry-failed')
        try {
            const response = await AiKnowledgeService.runIndexBatch({
                selection: 'failed',
                background: true,
            })
            await fetchDocuments()
            toast.push(
                <Notification title="Retry de fallidos lanzado" type="success">
                    {response.data.background
                        ? 'Se reintentará la indexación de documentos fallidos en background.'
                        : `Se reprocesaron ${response.data.indexed ?? 0} documentos.`}
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible reintentar fallidos" type="danger">
                    Revisa disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setActionLoading(null)
        }
    }, [fetchDocuments])

    const createUrlDocument = useCallback(async () => {
        const url = urlKnowledgeForm.url.trim()
        if (!url) {
            toast.push(
                <Notification title="Falta la URL" type="warning">
                    Indica una URL válida para crear la fuente web.
                </Notification>,
                { placement: 'top-end' },
            )
            return
        }

        setActionLoading('url')
        try {
            const payload: CreateKnowledgeUrlPayload = {
                scope: urlKnowledgeForm.scope,
                url,
                title: urlKnowledgeForm.title.trim() || undefined,
                summary: urlKnowledgeForm.summary.trim() || undefined,
                tags: urlKnowledgeForm.tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                refreshPolicy: urlKnowledgeForm.refreshPolicy,
                crawl: urlKnowledgeForm.crawlMode === 'deep',
                crawlMaxDepth: urlKnowledgeForm.crawlMaxDepth,
                crawlMaxPages: urlKnowledgeForm.crawlMaxPages,
                crawlSameDomainOnly: urlKnowledgeForm.crawlSameDomainOnly,
                crawlRespectRobots: urlKnowledgeForm.crawlRespectRobots,
                crawlExclude: urlKnowledgeForm.crawlExclude
                    .split(',')
                    .map((entry) => entry.trim())
                    .filter(Boolean),
                metadata: {
                    createdFrom: 'knowledge-documents-page',
                },
            }
            const response = await AiKnowledgeService.createUrlDocument(payload)
            setUrlKnowledgeForm(initialUrlKnowledgeForm)
            updateSelectedDocument(response.data.id)
            await fetchDocuments()
            toast.push(
                <Notification title="URL incorporada al knowledge" type="success">
                    La página quedó convertida en un documento reutilizable con refresh configurable.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible incorporar la URL" type="danger">
                    Verifica acceso al sitio y vuelve a intentar.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setActionLoading(null)
        }
    }, [fetchDocuments, updateSelectedDocument, urlKnowledgeForm])

    const refreshDueUrlDocuments = useCallback(async () => {
        setActionLoading('refresh-due')
        try {
            const response = await AiKnowledgeService.refreshDueUrlDocuments()
            await fetchDocuments()
            toast.push(
                <Notification title="URLs actualizadas" type="success">
                    Se refrescaron {response.data.refreshedCount} fuentes web vencidas.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible refrescar URLs vencidas" type="danger">
                    Intenta nuevamente en unos segundos.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setActionLoading(null)
        }
    }, [fetchDocuments])

    const refreshSelectedUrlDocument = useCallback(async () => {
        if (!selectedDocument || selectedDocument.sourceType !== 'web_url') {
            return
        }

        setActionLoading(`refresh:${selectedDocument.id}`)
        try {
            const response = await AiKnowledgeService.refreshUrlDocument(selectedDocument.id)
            updateSelectedDocument(response.data.id, { replace: true })
            await fetchDocuments()
            toast.push(
                <Notification title="URL refrescada" type="success">
                    La fuente web quedó actualizada con el contenido más reciente detectado.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible refrescar la URL" type="danger">
                    Revisa la conectividad o el estado del sitio y vuelve a intentar.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setActionLoading(null)
        }
    }, [fetchDocuments, selectedDocument, updateSelectedDocument])

    const saveDocument = useCallback(async () => {
        if (!selectedDocument) {
            return
        }

        const title = documentForm.title.trim()
        const content = documentForm.content.trim()

        if (!title || !content) {
            toast.push(
                <Notification title="Faltan datos del documento" type="warning">
                    El título y el contenido siguen siendo obligatorios.
                </Notification>,
                { placement: 'top-end' },
            )
            return
        }

        setActionLoading(`save:${selectedDocument.id}`)
        try {
            const payload: UpdateKnowledgeDocumentPayload = {
                scope: documentForm.scope,
                status: documentForm.status,
                title,
                summary: documentForm.summary.trim() || undefined,
                content,
                tags: documentForm.tags
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                metadata: {
                    editedFrom: 'knowledge-documents-page',
                    ...(selectedDocument.sourceType === 'web_url'
                        ? {
                              url: documentForm.url.trim() || undefined,
                              refreshPolicy: documentForm.refreshPolicy,
                          }
                        : {}),
                },
            }

            const response = await AiKnowledgeService.updateDocument(selectedDocument.id, payload)
            updateSelectedDocument(response.data.id, { replace: true })
            await fetchDocuments()
            toast.push(
                <Notification title="Documento actualizado" type="success">
                    El contenido y la metadata quedaron persistidos.
                </Notification>,
                { placement: 'top-end' },
            )
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible actualizar el documento" type="danger">
                    Revisa los cambios e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setActionLoading(null)
        }
    }, [documentForm, fetchDocuments, selectedDocument, updateSelectedDocument])

    const deleteDocument = useCallback(
        async (document: AiKnowledgeDocument) => {
            setActionLoading(`delete:${document.id}`)
            try {
                await AiKnowledgeService.deleteDocument(document.id)
                if (selectedDocumentId === document.id) {
                    updateSelectedDocument(null, { replace: true })
                }
                await fetchDocuments()
                toast.push(
                    <Notification title="Documento eliminado" type="success">
                        El documento se quitó del corpus gestionado.
                    </Notification>,
                    { placement: 'top-end' },
                )
            } catch (error) {
                console.error(error)
                toast.push(
                    <Notification title="No fue posible eliminar el documento" type="danger">
                        Intenta nuevamente en unos segundos.
                    </Notification>,
                    { placement: 'top-end' },
                )
            } finally {
                setActionLoading(null)
            }
        },
        [fetchDocuments, selectedDocumentId, updateSelectedDocument],
    )

    const columns: ColumnDef<AiKnowledgeDocument>[] = useMemo(
        () => [
            {
                header: 'Documento',
                accessorKey: 'title',
                cell: (props) => {
                    const row = props.row.original
                    return (
                        <button
                            type="button"
                            className="text-left"
                            onClick={() => updateSelectedDocument(row.id)}
                        >
                            <div className="font-medium text-gray-900">{row.title}</div>
                            <div className="mt-1 line-clamp-2 max-w-[420px] text-sm text-gray-600">
                                {row.summary || row.content.slice(0, 160)}
                            </div>
                            <div className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-600">
                                Abrir detalle
                            </div>
                        </button>
                    )
                },
            },
            {
                header: 'Origen',
                accessorKey: 'originCategory',
            },
            {
                header: 'Tipo',
                accessorKey: 'contentType',
            },
            {
                header: 'Scope',
                accessorKey: 'scope',
                cell: (props) => (
                    <Badge className="bg-slate-100 text-slate-700">
                        {props.row.original.scope}
                    </Badge>
                ),
            },
            {
                header: 'Estado',
                accessorKey: 'status',
                cell: (props) => (
                    <Badge
                        className={
                            documentStatusClassName[props.row.original.status] ??
                            'bg-slate-100 text-slate-700'
                        }
                    >
                        {props.row.original.status}
                    </Badge>
                ),
            },
            {
                header: 'Índice',
                accessorKey: 'hasEmbedding',
                cell: (props) => {
                    const chunkIndex = props.row.original.chunkIndex
                    const statusClassName =
                        chunkIndex.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700'
                            : chunkIndex.status === 'failed'
                              ? 'bg-rose-50 text-rose-700'
                              : chunkIndex.status === 'processing'
                                ? 'bg-sky-50 text-sky-700'
                                : 'bg-amber-50 text-amber-700'
                    return (
                        <div className="flex flex-col gap-1">
                            <Badge className={statusClassName}>{chunkIndex.status}</Badge>
                            <div className="text-xs text-gray-500">
                                {chunkIndex.chunkCount} chunks
                            </div>
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
        [updateSelectedDocument],
    )

    return (
        <Loading loading={loading && items.length === 0}>
            <div className="flex flex-col gap-6" data-testid="ai-knowledge-documents-page">
                <Card bodyClass="p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="text-xs uppercase tracking-wide text-gray-400">
                                Knowledge
                            </div>
                            <h4 className="mt-1 text-xl font-semibold text-gray-900">
                                Knowledge Documents
                            </h4>
                            <p className="mt-2 max-w-3xl text-sm text-gray-600">
                                ABM operativo del contenido aprobado. Aquí vive el material curado,
                                subido o promovido que realmente puede reutilizar el sistema.
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                                <Badge className="bg-slate-100 text-slate-700">
                                    {indexStatus?.runtime?.running
                                        ? 'reindexando'
                                        : 'batch inactivo'}
                                </Badge>
                                <Badge className="bg-amber-50 text-amber-700">
                                    sin chunks: {indexStatus?.documentsWithoutChunks ?? 0}
                                </Badge>
                                <Badge className="bg-emerald-50 text-emerald-700">
                                    completos:{' '}
                                    {indexStatus?.counts.find(
                                        (entry) => entry.status === 'completed',
                                    )?.count ?? 0}
                                </Badge>
                                <Badge className="bg-rose-50 text-rose-700">
                                    fallidos:{' '}
                                    {indexStatus?.counts.find(
                                        (entry) => entry.status === 'failed',
                                    )?.count ?? 0}
                                </Badge>
                            </div>
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
                                loading={actionLoading === 'index'}
                                onClick={() => void reindexDocuments()}
                                data-testid="ai-knowledge-index"
                            >
                                Reindexar pendientes
                            </Button>
                            <Button
                                variant="default"
                                loading={actionLoading === 'retry-failed'}
                                onClick={() => void retryFailedDocuments()}
                            >
                                Retry fallidos
                            </Button>
                            <Button
                                variant="default"
                                loading={actionLoading === 'refresh-due'}
                                onClick={() => void refreshDueUrlDocuments()}
                                data-testid="ai-knowledge-refresh-due-urls"
                            >
                                Refrescar URLs vencidas
                            </Button>
                            <Button variant="solid" onClick={() => void fetchDocuments()}>
                                Refrescar
                            </Button>
                        </div>
                    </div>
                </Card>

                <div className="grid gap-6 xl:grid-cols-3">
                    <Card bodyClass="p-5">
                        <h5 className="font-semibold text-gray-900">Carga manual</h5>
                        <p className="mt-1 text-sm text-gray-500">
                            Crear contenido aprobado directamente desde el módulo de knowledge.
                        </p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Scope
                                </label>
                                <select
                                    className="input"
                                    value={curatedForm.scope}
                                    onChange={(event) =>
                                        setCuratedForm((current) => ({
                                            ...current,
                                            scope: event.target.value as CuratedKnowledgeForm['scope'],
                                        }))
                                    }
                                    data-testid="ai-knowledge-curated-scope"
                                >
                                    <option value="admin_internal">Admin interno</option>
                                    <option value="customer_public">Cliente público</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Etiquetas
                                </label>
                                <Input
                                    value={curatedForm.tags}
                                    onChange={(event) =>
                                        setCuratedForm((current) => ({
                                            ...current,
                                            tags: event.target.value,
                                        }))
                                    }
                                    data-testid="ai-knowledge-curated-tags"
                                />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Título
                            </label>
                            <Input
                                value={curatedForm.title}
                                onChange={(event) =>
                                    setCuratedForm((current) => ({
                                        ...current,
                                        title: event.target.value,
                                    }))
                                }
                                data-testid="ai-knowledge-curated-title"
                            />
                        </div>
                        <div className="mt-4">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Resumen
                            </label>
                            <Input
                                value={curatedForm.summary}
                                onChange={(event) =>
                                    setCuratedForm((current) => ({
                                        ...current,
                                        summary: event.target.value,
                                    }))
                                }
                                data-testid="ai-knowledge-curated-summary"
                            />
                        </div>
                        <div className="mt-4">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Contenido
                            </label>
                            <textarea
                                className="input min-h-[180px] w-full rounded-2xl border border-gray-200 px-4 py-3"
                                value={curatedForm.content}
                                onChange={(event) =>
                                    setCuratedForm((current) => ({
                                        ...current,
                                        content: event.target.value,
                                    }))
                                }
                                data-testid="ai-knowledge-curated-content"
                            />
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button
                                variant="solid"
                                loading={actionLoading === 'curated'}
                                onClick={() => void createCuratedKnowledge()}
                                data-testid="ai-knowledge-curated-save"
                            >
                                Guardar contenido curado
                            </Button>
                        </div>
                    </Card>

                    <Card bodyClass="p-5">
                        <h5 className="font-semibold text-gray-900">Subir documento</h5>
                        <p className="mt-1 text-sm text-gray-500">
                            Agregar archivos fuente al corpus gestionado y mantenerlos visibles como
                            activos del conocimiento.
                        </p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Scope
                                </label>
                                <select
                                    className="input"
                                    value={uploadedKnowledgeForm.scope}
                                    onChange={(event) =>
                                        setUploadedKnowledgeForm((current) => ({
                                            ...current,
                                            scope: event.target.value as UploadedKnowledgeForm['scope'],
                                        }))
                                    }
                                    data-testid="ai-knowledge-upload-scope"
                                >
                                    <option value="admin_internal">Admin interno</option>
                                    <option value="customer_public">Cliente público</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Etiquetas
                                </label>
                                <Input
                                    value={uploadedKnowledgeForm.tags}
                                    onChange={(event) =>
                                        setUploadedKnowledgeForm((current) => ({
                                            ...current,
                                            tags: event.target.value,
                                        }))
                                    }
                                    data-testid="ai-knowledge-upload-tags"
                                />
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Título opcional
                            </label>
                            <Input
                                value={uploadedKnowledgeForm.title}
                                onChange={(event) =>
                                    setUploadedKnowledgeForm((current) => ({
                                        ...current,
                                        title: event.target.value,
                                    }))
                                }
                                data-testid="ai-knowledge-upload-title"
                            />
                        </div>
                        <div className="mt-4">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Resumen opcional
                            </label>
                            <Input
                                value={uploadedKnowledgeForm.summary}
                                onChange={(event) =>
                                    setUploadedKnowledgeForm((current) => ({
                                        ...current,
                                        summary: event.target.value,
                                    }))
                                }
                                data-testid="ai-knowledge-upload-summary"
                            />
                        </div>
                        <div className="mt-4">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Documento
                            </label>
                            <Upload
                                uploadLimit={1}
                                fileList={uploadedKnowledgeFiles}
                                onChange={(files) => setUploadedKnowledgeFiles(files as File[])}
                                onFileRemove={(files) => setUploadedKnowledgeFiles(files as File[])}
                                data-testid="ai-knowledge-upload-input"
                            >
                                <div className="rounded-2xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-600">
                                    Cargar `.docx`, `.txt`, `.md` o `.html`
                                </div>
                            </Upload>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button
                                variant="solid"
                                loading={actionLoading === 'upload'}
                                onClick={() => void uploadDocument()}
                                data-testid="ai-knowledge-upload-submit"
                            >
                                Subir documento
                            </Button>
                        </div>
                    </Card>

                    <Card bodyClass="p-5">
                        <h5 className="font-semibold text-gray-900">Agregar URL</h5>
                        <p className="mt-1 text-sm text-gray-500">
                            Convierte una página web en fuente reutilizable del knowledge y define
                            cómo se refresca en el tiempo.
                        </p>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Scope
                                </label>
                                <select
                                    className="input"
                                    value={urlKnowledgeForm.scope}
                                    onChange={(event) =>
                                        setUrlKnowledgeForm((current) => ({
                                            ...current,
                                            scope: event.target.value as UrlKnowledgeForm['scope'],
                                        }))
                                    }
                                    data-testid="ai-knowledge-url-scope"
                                >
                                    <option value="admin_internal">Admin interno</option>
                                    <option value="customer_public">Cliente público</option>
                                </select>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Política de refresh
                                </label>
                                <select
                                    className="input"
                                    value={urlKnowledgeForm.refreshPolicy}
                                    onChange={(event) =>
                                        setUrlKnowledgeForm((current) => ({
                                            ...current,
                                            refreshPolicy: event.target
                                                .value as UrlKnowledgeForm['refreshPolicy'],
                                        }))
                                    }
                                    data-testid="ai-knowledge-url-refresh-policy"
                                >
                                    <option value="daily">daily</option>
                                    <option value="weekly">weekly</option>
                                    <option value="manual">manual</option>
                                    <option value="on_demand">on_demand</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-4">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                URL
                            </label>
                            <Input
                                value={urlKnowledgeForm.url}
                                onChange={(event) =>
                                    setUrlKnowledgeForm((current) => ({
                                        ...current,
                                        url: event.target.value,
                                    }))
                                }
                                placeholder="https://example.com/pagina"
                                data-testid="ai-knowledge-url-input"
                            />
                            <p className="mt-2 text-xs text-gray-500">
                                El crawler recorre enlaces válidos del mismo dominio, respeta
                                robots.txt y limita profundidad y cantidad de páginas para evitar
                                capturas excesivas.
                            </p>
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                    Modo de ingesta
                                </label>
                                <select
                                    className="input"
                                    value={urlKnowledgeForm.crawlMode}
                                    onChange={(event) =>
                                        setUrlKnowledgeForm((current) => ({
                                            ...current,
                                            crawlMode: event.target
                                                .value as UrlKnowledgeForm['crawlMode'],
                                        }))
                                    }
                                    data-testid="ai-knowledge-url-crawl-mode"
                                >
                                    <option value="single">Solo esta URL</option>
                                    <option value="deep">Crawl profundo</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-3 pt-6">
                                <Switcher
                                    checked={urlKnowledgeForm.crawlSameDomainOnly}
                                    onChange={(checked) =>
                                        setUrlKnowledgeForm((current) => ({
                                            ...current,
                                            crawlSameDomainOnly: checked,
                                        }))
                                    }
                                />
                                <span className="text-sm text-gray-600">
                                    Limitar al mismo dominio
                                </span>
                            </div>
                        </div>
                        {urlKnowledgeForm.crawlMode === 'deep' ? (
                            <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Profundidad máxima
                                    </label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={5}
                                        value={urlKnowledgeForm.crawlMaxDepth}
                                        onChange={(event) =>
                                            setUrlKnowledgeForm((current) => ({
                                                ...current,
                                                crawlMaxDepth: Number(event.target.value || 0),
                                            }))
                                        }
                                        data-testid="ai-knowledge-url-crawl-depth"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Páginas máximas
                                    </label>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={200}
                                        value={urlKnowledgeForm.crawlMaxPages}
                                        onChange={(event) =>
                                            setUrlKnowledgeForm((current) => ({
                                                ...current,
                                                crawlMaxPages: Number(event.target.value || 1),
                                            }))
                                        }
                                        data-testid="ai-knowledge-url-crawl-pages"
                                    />
                                </div>
                                <div className="flex items-center gap-3 md:col-span-2">
                                    <Switcher
                                        checked={urlKnowledgeForm.crawlRespectRobots}
                                        onChange={(checked) =>
                                            setUrlKnowledgeForm((current) => ({
                                                ...current,
                                                crawlRespectRobots: checked,
                                            }))
                                        }
                                    />
                                    <span className="text-sm text-gray-600">
                                        Respetar robots.txt
                                    </span>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Excluir rutas (separadas por coma)
                                    </label>
                                    <Input
                                        value={urlKnowledgeForm.crawlExclude}
                                        onChange={(event) =>
                                            setUrlKnowledgeForm((current) => ({
                                                ...current,
                                                crawlExclude: event.target.value,
                                            }))
                                        }
                                        placeholder="/catalogo, /wp-admin, re:\\.pdf$"
                                        data-testid="ai-knowledge-url-crawl-exclude"
                                    />
                                </div>
                            </div>
                        ) : null}
                        <div className="mt-4">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Título opcional
                            </label>
                            <Input
                                value={urlKnowledgeForm.title}
                                onChange={(event) =>
                                    setUrlKnowledgeForm((current) => ({
                                        ...current,
                                        title: event.target.value,
                                    }))
                                }
                                data-testid="ai-knowledge-url-title"
                            />
                        </div>
                        <div className="mt-4">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Resumen opcional
                            </label>
                            <Input
                                value={urlKnowledgeForm.summary}
                                onChange={(event) =>
                                    setUrlKnowledgeForm((current) => ({
                                        ...current,
                                        summary: event.target.value,
                                    }))
                                }
                                data-testid="ai-knowledge-url-summary"
                            />
                        </div>
                        <div className="mt-4">
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Etiquetas
                            </label>
                            <Input
                                value={urlKnowledgeForm.tags}
                                onChange={(event) =>
                                    setUrlKnowledgeForm((current) => ({
                                        ...current,
                                        tags: event.target.value,
                                    }))
                                }
                                data-testid="ai-knowledge-url-tags"
                            />
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button
                                variant="solid"
                                loading={actionLoading === 'url'}
                                onClick={() => void createUrlDocument()}
                                data-testid="ai-knowledge-url-submit"
                            >
                                Guardar URL
                            </Button>
                        </div>
                    </Card>
                </div>

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
                                    placeholder="título, resumen o contenido"
                                />
                                <Button
                                    variant="solid"
                                    onClick={() => {
                                        setPageIndex(1)
                                        setFilters((current) => ({
                                            ...current,
                                            search: searchDraft.trim(),
                                        }))
                                    }}
                                >
                                    Buscar
                                </Button>
                            </div>
                        </div>
                        <FilterSelect
                            label="Scope"
                            value={filters.scope}
                            onChange={(value) =>
                                setFilters((current) => ({ ...current, scope: value }))
                            }
                            options={[
                                ['all', 'Todos'],
                                ['admin_internal', 'Admin interno'],
                                ['customer_public', 'Cliente público'],
                            ]}
                            onResetPage={() => setPageIndex(1)}
                        />
                        <FilterSelect
                            label="Estado"
                            value={filters.status}
                            onChange={(value) =>
                                setFilters((current) => ({ ...current, status: value }))
                            }
                            options={[
                                ['all', 'Todos'],
                                ['active', 'active'],
                                ['archived', 'archived'],
                                ['draft', 'draft'],
                            ]}
                            onResetPage={() => setPageIndex(1)}
                        />
                        <FilterSelect
                            label="Origen"
                            value={filters.originCategory}
                            onChange={(value) =>
                                setFilters((current) => ({
                                    ...current,
                                    originCategory: value,
                                }))
                            }
                            options={[
                                ['all', 'Todos'],
                                ['uploaded_document', 'Documento subido'],
                                ['website_url', 'URL web'],
                                ['manual_entry', 'Carga manual'],
                                ['conversation_approved', 'Sugerencia aprobada'],
                                ['dataset_snapshot', 'Dataset interno'],
                                ['trusted_doc', 'Docs de confianza'],
                            ]}
                            onResetPage={() => setPageIndex(1)}
                        />
                        <FilterSelect
                            label="Tipo"
                            value={filters.contentType}
                            onChange={(value) =>
                                setFilters((current) => ({
                                    ...current,
                                    contentType: value,
                                }))
                            }
                            options={[
                                ['all', 'Todos'],
                                ['document_file', 'Documento'],
                                ['web_page', 'Página web'],
                                ['plain_text', 'Texto plano'],
                                ['conversation_response', 'Respuesta conversacional'],
                                ['dataset_snapshot', 'Snapshot tabular'],
                                ['multimodal_extract', 'Extracción multimodal'],
                            ]}
                            onResetPage={() => setPageIndex(1)}
                        />
                        <FilterSelect
                            label="Índice"
                            value={filters.hasEmbedding}
                            onChange={(value) =>
                                setFilters((current) => ({
                                    ...current,
                                    hasEmbedding: value,
                                }))
                            }
                            options={[
                                ['all', 'Todos'],
                                ['true', 'Indexados'],
                                ['false', 'Sin índice'],
                            ]}
                            onResetPage={() => setPageIndex(1)}
                        />
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                        <div>
                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Source type
                            </label>
                            <select
                                className="input"
                                value={filters.sourceType}
                                onChange={(event) => {
                                    setPageIndex(1)
                                    setFilters((current) => ({
                                        ...current,
                                        sourceType: event.target.value,
                                    }))
                                }}
                            >
                                <option value="all">Todos</option>
                                <option value="docs">docs</option>
                                <option value="web_url">web_url</option>
                                <option value="backend_dataset">backend_dataset</option>
                                <option value="admin_curated">admin_curated</option>
                                <option value="conversation_derived">conversation_derived</option>
                            </select>
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
                                {total} documentos encontrados
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

                <div ref={detailSectionRef} data-testid="ai-knowledge-document-detail-card">
                    <Card bodyClass="p-5">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h5 className="font-semibold text-gray-900">
                                {selectedDocument ? 'Detalle del documento' : 'Sin selección'}
                            </h5>
                            <p className="mt-1 text-sm text-gray-500">
                                Detalle enlazable del contenido aprobado y acciones disponibles por
                                fuente.
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {selectedDocument ? (
                                <Badge
                                    className={
                                        documentStatusClassName[documentForm.status] ??
                                        'bg-slate-100 text-slate-700'
                                    }
                                >
                                    {documentForm.status}
                                </Badge>
                            ) : null}
                            {selectedDocumentId ? (
                                <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() =>
                                        updateSelectedDocument(null, { replace: true })
                                    }
                                >
                                    Cerrar detalle
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    {detailLoading && !selectedDocument ? (
                        <div className="mt-5 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-sm text-gray-500">
                            Cargando detalle del documento...
                        </div>
                    ) : selectedDocument ? (
                        <div className="mt-5 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="flex flex-wrap gap-2">
                                        <Badge className="bg-slate-100 text-slate-700">
                                            {selectedDocument.originCategory}
                                        </Badge>
                                        <Badge className="bg-slate-100 text-slate-700">
                                            {selectedDocument.contentType}
                                        </Badge>
                                        <Badge className="bg-sky-50 text-sky-700">
                                            {selectedDocument.sourceType}
                                        </Badge>
                                        <Badge className="bg-violet-50 text-violet-700">
                                            {selectedDocument.scope}
                                        </Badge>
                                    </div>
                                    {documentForm.summary ? (
                                        <div className="mt-3 text-sm text-gray-600">
                                            {documentForm.summary}
                                        </div>
                                    ) : null}
                                    <div className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                                        {documentForm.content.slice(0, 2400)}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <h6 className="text-sm font-semibold text-gray-900">
                                        Edición real
                                    </h6>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Ajusta metadata y contenido aprobado sin salir del ABM.
                                    </p>
                                    {selectedDocument.sourceType === 'web_url' ? (
                                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                    URL
                                                </label>
                                                <Input
                                                    data-testid="ai-knowledge-document-detail-url"
                                                    value={documentForm.url}
                                                    onChange={(event) =>
                                                        setDocumentForm((current) => ({
                                                            ...current,
                                                            url: event.target.value,
                                                        }))
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                    Política de refresh
                                                </label>
                                                <select
                                                    className="input"
                                                    data-testid="ai-knowledge-document-detail-refresh-policy"
                                                    value={documentForm.refreshPolicy}
                                                    onChange={(event) =>
                                                        setDocumentForm((current) => ({
                                                            ...current,
                                                            refreshPolicy: event.target
                                                                .value as KnowledgeDocumentForm['refreshPolicy'],
                                                        }))
                                                    }
                                                >
                                                    <option value="daily">daily</option>
                                                    <option value="weekly">weekly</option>
                                                    <option value="manual">manual</option>
                                                    <option value="on_demand">on_demand</option>
                                                </select>
                                            </div>
                                        </div>
                                    ) : null}
                                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                                        <div>
                                            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                                Scope
                                            </label>
                                            <select
                                                className="input"
                                                data-testid="ai-knowledge-document-detail-scope"
                                                value={documentForm.scope}
                                                onChange={(event) =>
                                                    setDocumentForm((current) => ({
                                                        ...current,
                                                        scope: event.target
                                                            .value as KnowledgeDocumentForm['scope'],
                                                    }))
                                                }
                                            >
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
                                                data-testid="ai-knowledge-document-detail-status"
                                                value={documentForm.status}
                                                onChange={(event) =>
                                                    setDocumentForm((current) => ({
                                                        ...current,
                                                        status: event.target
                                                            .value as KnowledgeDocumentForm['status'],
                                                    }))
                                                }
                                            >
                                                <option value="active">active</option>
                                                <option value="draft">draft</option>
                                                <option value="archived">archived</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Título
                                        </label>
                                        <Input
                                            data-testid="ai-knowledge-document-detail-title"
                                            value={documentForm.title}
                                            onChange={(event) =>
                                                setDocumentForm((current) => ({
                                                    ...current,
                                                    title: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Resumen
                                        </label>
                                        <Input
                                            data-testid="ai-knowledge-document-detail-summary"
                                            value={documentForm.summary}
                                            onChange={(event) =>
                                                setDocumentForm((current) => ({
                                                    ...current,
                                                    summary: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Etiquetas
                                        </label>
                                        <Input
                                            data-testid="ai-knowledge-document-detail-tags"
                                            value={documentForm.tags}
                                            onChange={(event) =>
                                                setDocumentForm((current) => ({
                                                    ...current,
                                                    tags: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div className="mt-4">
                                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            Contenido
                                        </label>
                                        <textarea
                                            data-testid="ai-knowledge-document-detail-content"
                                            className="input min-h-[260px] w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700 outline-none focus:border-emerald-400"
                                            value={documentForm.content}
                                            onChange={(event) =>
                                                setDocumentForm((current) => ({
                                                    ...current,
                                                    content: event.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="grid gap-3 text-sm text-gray-600">
                                        <div>
                                            <span className="font-medium text-gray-900">
                                                Actualizado:
                                            </span>{' '}
                                            {formatDateTime(selectedDocument.updatedAt)}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">
                                                Aprobado:
                                            </span>{' '}
                                            {formatDateTime(selectedDocument.approvedAt)}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">
                                                Etiquetas:
                                            </span>{' '}
                                            {selectedDocument.tags.join(', ') || 'sin etiquetas'}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">
                                                Embedding:
                                            </span>{' '}
                                            {selectedDocument.embedding
                                                ? `${selectedDocument.embedding.model} · ${selectedDocument.embedding.dimensions}D`
                                                : 'sin índice'}
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">
                                                Estado chunks:
                                            </span>{' '}
                                            {selectedDocument.chunkIndex.status} ·{' '}
                                            {selectedDocument.chunkIndex.chunkCount} chunks
                                        </div>
                                        <div>
                                            <span className="font-medium text-gray-900">
                                                Última indexación:
                                            </span>{' '}
                                            {formatDateTime(selectedDocument.chunkIndex.indexedAt)}
                                        </div>
                                        {selectedDocument.chunkIndex.error ? (
                                            <div className="text-rose-600">
                                                <span className="font-medium text-rose-700">
                                                    Error indexación:
                                                </span>{' '}
                                                {selectedDocument.chunkIndex.error}
                                            </div>
                                        ) : null}
                                        {selectedDocument.sourceType === 'web_url' ? (
                                            <>
                                                <div>
                                                    <span className="font-medium text-gray-900">
                                                        Último fetch:
                                                    </span>{' '}
                                                    {formatDateTime(
                                                        readUrlMetadata(selectedDocument).lastFetchedAt,
                                                    )}
                                                </div>
                                                <div>
                                                    <span className="font-medium text-gray-900">
                                                        Próximo refresh:
                                                    </span>{' '}
                                                    {formatDateTime(
                                                        readUrlMetadata(selectedDocument).nextRefreshAt,
                                                    )}
                                                </div>
                                            </>
                                        ) : null}
                                    </div>
                                </div>

                                {selectedDocument.sourceFile ? (
                                    <div className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-600">
                                        <div className="font-medium text-gray-900">
                                            Archivo fuente
                                        </div>
                                        <div className="mt-2">{selectedDocument.sourceFile.name}</div>
                                        <div className="mt-1 text-xs text-gray-500">
                                            {selectedDocument.sourceFile.mimeType} ·{' '}
                                            {formatFileSize(selectedDocument.sourceFile.size)}
                                        </div>
                                        <div className="mt-3">
                                            <a
                                                href={selectedDocument.sourceFile.downloadUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
                                            >
                                                Abrir archivo
                                            </a>
                                        </div>
                                    </div>
                                ) : null}

                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        variant="solid"
                                        data-testid="ai-knowledge-document-save"
                                        loading={actionLoading === `save:${selectedDocument.id}`}
                                        onClick={() => void saveDocument()}
                                    >
                                        Guardar cambios
                                    </Button>
                                    {selectedDocument.sourceType === 'web_url' ? (
                                        <Button
                                            variant="default"
                                            loading={actionLoading === `refresh:${selectedDocument.id}`}
                                            onClick={() => void refreshSelectedUrlDocument()}
                                            data-testid="ai-knowledge-document-refresh-url"
                                        >
                                            Refrescar URL
                                        </Button>
                                    ) : null}
                                    {selectedDocument.sourceFile ? (
                                        <Button
                                            variant="default"
                                            onClick={() =>
                                                window.open(
                                                    selectedDocument.sourceFile?.downloadUrl,
                                                    '_blank',
                                                    'noopener,noreferrer',
                                                )
                                            }
                                        >
                                            Abrir fuente
                                        </Button>
                                    ) : null}
                                    <Button
                                        variant="default"
                                        loading={actionLoading === `delete:${selectedDocument.id}`}
                                        onClick={() => void deleteDocument(selectedDocument)}
                                    >
                                        Eliminar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="mt-5 rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-sm text-gray-500">
                            Selecciona un documento desde la tabla para abrir su detalle, revisar
                            contenido, fuente y estado de indexación, y editar metadata o contenido
                            aprobado.
                        </div>
                    )}
                    </Card>
                </div>
            </div>
        </Loading>
    )
}

const FilterSelect = ({
    label,
    value,
    onChange,
    options,
    onResetPage,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    options: Array<[string, string]>
    onResetPage: () => void
}) => (
    <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
            {label}
        </label>
        <select
            className="input"
            value={value}
            onChange={(event) => {
                onResetPage()
                onChange(event.target.value)
            }}
        >
            {options.map(([optionValue, optionLabel]) => (
                <option key={optionValue} value={optionValue}>
                    {optionLabel}
                </option>
            ))}
        </select>
    </div>
)

export default AiKnowledgeDocuments

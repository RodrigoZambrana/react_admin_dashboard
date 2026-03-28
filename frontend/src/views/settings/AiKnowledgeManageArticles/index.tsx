import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    DragDropContext,
    Draggable,
    type DropResult,
} from '@hello-pangea/dnd'
import Container from '@/components/shared/Container'
import StrictModeDroppable from '@/components/shared/StrictModeDroppable'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Tag from '@/components/ui/Tag'
import Badge from '@/components/ui/Badge'
import Dialog from '@/components/ui/Dialog'
import Loading from '@/components/shared/Loading'
import Notification from '@/components/ui/Notification'
import toast from '@/components/ui/toast'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import {
    HiOutlineChatAlt2,
    HiOutlineClock,
    HiOutlineDocumentText,
    HiOutlinePaperClip,
    HiOutlineSparkles,
} from 'react-icons/hi'
import AiKnowledgeService, {
    type AiKnowledgeCandidate,
    type AiKnowledgeDocument,
    type AiKnowledgeRawEvent,
} from '@/services/AiKnowledgeService'

type FilterState = {
    search: string
    scope: 'all' | 'admin_internal' | 'customer_public'
}

type BoardColumnId = 'suggested' | 'review' | 'approved' | 'incorporated'

type BoardCardKind = 'raw_event' | 'candidate' | 'document'

type KnowledgeBoardCard = {
    id: string
    entityId: string
    kind: BoardCardKind
    columnId: BoardColumnId
    title: string
    primaryText: string
    secondaryText: string | null
    labels: string[]
    badge: string | null
    badgeTone: string
    updatedAt: string
    commentCount: number
    attachmentCount: number
    route: string
    rawEvent?: AiKnowledgeRawEvent
    candidate?: AiKnowledgeCandidate
    document?: AiKnowledgeDocument
}

const initialFilters: FilterState = {
    search: '',
    scope: 'all',
}

const boardColumnOrder: BoardColumnId[] = [
    'suggested',
    'review',
    'approved',
    'incorporated',
]

const boardColumnMeta: Record<
    BoardColumnId,
    { title: string; description: string }
> = {
    suggested: {
        title: 'Sugerido',
        description:
            'Intercambios observados con respuesta lista para entrar al flujo formal.',
    },
    review: {
        title: 'A la espera de aprobación',
        description: 'Candidatos pendientes de validación humana.',
    },
    approved: {
        title: 'Aprobado',
        description: 'Respuestas validadas, todavía no incorporadas al corpus.',
    },
    incorporated: {
        title: 'Incorporado',
        description: 'Documentos activos que ya impactan al agente.',
    },
}

const scopeOptions: Array<{ value: FilterState['scope']; label: string }> = [
    { value: 'all', label: 'Todo' },
    { value: 'admin_internal', label: 'Interno' },
    { value: 'customer_public', label: 'Cliente' },
]

const badgeToneMap: Record<string, string> = {
    suggested: 'bg-slate-100 text-slate-700',
    review: 'bg-amber-100 text-amber-700',
    approved: 'bg-sky-100 text-sky-700',
    incorporated: 'bg-emerald-100 text-emerald-700',
}

const channelLabels: Record<string, string> = {
    webchat: 'Webchat',
    whatsapp: 'WhatsApp',
    email: 'Email',
    meta: 'Meta',
    admin_chat: 'Chat IA',
}

const scopeLabels: Record<string, string> = {
    admin_internal: 'Interno',
    customer_public: 'Cliente',
    customer_authenticated: 'Cliente',
}

const contentTypeLabels: Record<string, string> = {
    conversation_response: 'Intercambio',
    multimodal_extract: 'Multimodal',
    document_file: 'Documento',
    plain_text: 'Texto',
}

const originLabels: Record<string, string> = {
    manual_entry: 'Manual',
    conversation_approved: 'Intercambio aprobado',
    conversation_suggested: 'Intercambio sugerido',
    uploaded_document: 'Documento',
    trusted_doc: 'Documento validado',
    dataset_snapshot: 'Dataset',
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

const formatRelativeTime = (value: string | null) => {
    if (!value) return 'sin referencia'

    const date = new Date(value)
    const diffMs = date.getTime() - Date.now()
    const diffMinutes = Math.round(diffMs / 60000)
    const formatter = new Intl.RelativeTimeFormat(undefined, {
        numeric: 'auto',
    })

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

const normalizePreview = (value: string | null | undefined, fallback = 'Sin contenido') => {
    const normalized = value?.replace(/\s+/g, ' ').trim()
    if (!normalized) {
        return fallback
    }
    return normalized
}

const matchesSearch = (haystack: Array<string | null | undefined>, query: string) => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) {
        return true
    }

    return haystack.some((value) => value?.toLowerCase().includes(normalizedQuery))
}

const humanizeIntent = (value: string | null | undefined) => {
    if (!value) {
        return 'Sin intención detectada'
    }

    return value
        .replace(/\./g, ' · ')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
}

const getReplySourceLabel = (event: AiKnowledgeRawEvent) => {
    if (event.operatorReply?.trim()) {
        return 'Operador'
    }
    if (event.aiReply?.trim() || event.suggestedResponse?.trim()) {
        return 'IA'
    }
    return 'Sin respuesta'
}

const getEventPrimaryResponse = (event: AiKnowledgeRawEvent) =>
    normalizePreview(
        event.operatorReply ?? event.aiReply ?? event.suggestedResponse ?? null,
        'Todavía no hay respuesta asociada.',
    )

const getCandidatePrimaryResponse = (candidate: AiKnowledgeCandidate) =>
    normalizePreview(
        candidate.approvedResponse ??
            candidate.suggestedResponse ??
            candidate.observation?.operatorReply ??
            candidate.observation?.aiReply ??
            null,
        'Sin respuesta asociada',
    )

const buildBoardColumns = (
    rawEvents: AiKnowledgeRawEvent[],
    candidates: AiKnowledgeCandidate[],
    documents: AiKnowledgeDocument[],
    filters: FilterState,
): Record<BoardColumnId, KnowledgeBoardCard[]> => {
    const filteredRawEvents = rawEvents.filter((event) => {
        if (filters.scope !== 'all' && event.scope !== filters.scope) {
            return false
        }

        return matchesSearch(
            [
                event.userMessage,
                event.operatorReply,
                event.aiReply,
                event.suggestedResponse,
                event.detectedIntent,
                event.contextSummary,
                event.channel,
            ],
            filters.search,
        )
    })

    const filteredCandidates = candidates.filter((candidate) => {
        if (filters.scope !== 'all' && candidate.scope !== filters.scope) {
            return false
        }

        return matchesSearch(
            [
                candidate.title,
                candidate.excerpt,
                candidate.redactedExcerpt,
                candidate.suggestedResponse,
                candidate.approvedResponse,
                candidate.detectedIntent,
                candidate.channel,
            ],
            filters.search,
        )
    })

    const filteredDocuments = documents.filter((document) => {
        if (filters.scope !== 'all' && document.scope !== filters.scope) {
            return false
        }

        return matchesSearch(
            [
                document.title,
                document.summary,
                document.content,
                document.originCategory,
                document.sourceType,
            ],
            filters.search,
        )
    })

    const incorporatedCandidateIds = new Set(
        filteredDocuments
            .map((document) =>
                document.sourceKey.startsWith('candidate:')
                    ? document.sourceKey.replace('candidate:', '')
                    : null,
            )
            .filter((value): value is string => Boolean(value)),
    )

    const suggested = filteredRawEvents
        .filter(
            (event) =>
                !event.candidate &&
                event.status !== 'discarded' &&
                Boolean(
                    event.operatorReply?.trim() ||
                        event.aiReply?.trim() ||
                        event.suggestedResponse?.trim(),
                ),
        )
        .sort(
            (left, right) =>
                new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        )
        .map<KnowledgeBoardCard>((event) => ({
            id: `raw:${event.id}`,
            entityId: event.id,
            kind: 'raw_event',
            columnId: 'suggested',
            title: humanizeIntent(event.detectedIntent),
            primaryText: getEventPrimaryResponse(event),
            secondaryText: normalizePreview(
                event.redactedMessage ?? event.userMessage,
                'Sin mensaje original',
            ),
            labels: [
                channelLabels[event.channel] ?? event.channel,
                scopeLabels[event.scope] ?? event.scope,
                getReplySourceLabel(event),
            ],
            badge: contentTypeLabels.multimodal_extract,
            badgeTone: badgeToneMap.suggested,
            updatedAt: event.updatedAt,
            commentCount: event.operatorReply || event.aiReply ? 2 : 1,
            attachmentCount: event.attachments?.length ?? 0,
            route: `${APP_PREFIX_PATH}/settings/ai/knowledge/raw-events`,
            rawEvent: event,
        }))

    const review = filteredCandidates
        .filter(
            (candidate) =>
                candidate.status === 'pending' &&
                Boolean(getCandidatePrimaryResponse(candidate).trim()),
        )
        .sort(
            (left, right) =>
                new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        )
        .map<KnowledgeBoardCard>((candidate) => ({
            id: `candidate:${candidate.id}`,
            entityId: candidate.id,
            kind: 'candidate',
            columnId: 'review',
            title: candidate.title,
            primaryText: getCandidatePrimaryResponse(candidate),
            secondaryText: normalizePreview(
                candidate.redactedExcerpt ?? candidate.excerpt,
                'Sin mensaje original',
            ),
            labels: [
                candidate.channel
                    ? channelLabels[candidate.channel] ?? candidate.channel
                    : 'Sin canal',
                scopeLabels[candidate.scope] ?? candidate.scope,
                candidate.detectedIntent
                    ? humanizeIntent(candidate.detectedIntent)
                    : 'Sin intent',
            ],
            badge:
                candidate.confidence !== null
                    ? `${Math.round(candidate.confidence * 100)}%`
                    : 'n/a',
            badgeTone: badgeToneMap.review,
            updatedAt: candidate.updatedAt,
            commentCount: candidate.feedback.applied,
            attachmentCount: candidate.observation?.operatorReply || candidate.observation?.aiReply ? 2 : 1,
            route: `${APP_PREFIX_PATH}/settings/ai/knowledge/candidates`,
            candidate,
        }))

    const approved = filteredCandidates
        .filter(
            (candidate) =>
                candidate.status === 'approved' &&
                !incorporatedCandidateIds.has(candidate.id) &&
                Boolean(getCandidatePrimaryResponse(candidate).trim()),
        )
        .sort(
            (left, right) =>
                new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        )
        .map<KnowledgeBoardCard>((candidate) => ({
            id: `candidate:${candidate.id}`,
            entityId: candidate.id,
            kind: 'candidate',
            columnId: 'approved',
            title: candidate.title,
            primaryText: getCandidatePrimaryResponse(candidate),
            secondaryText: normalizePreview(
                candidate.redactedExcerpt ?? candidate.excerpt,
                'Sin mensaje original',
            ),
            labels: [
                originLabels[candidate.originCategory] ?? candidate.originCategory,
                scopeLabels[candidate.scope] ?? candidate.scope,
                candidate.detectedIntent
                    ? humanizeIntent(candidate.detectedIntent)
                    : 'Sin intent',
            ],
            badge: `reuse ${candidate.feedback.applied}`,
            badgeTone: badgeToneMap.approved,
            updatedAt: candidate.updatedAt,
            commentCount: candidate.feedback.total,
            attachmentCount: candidate.observation?.operatorReply || candidate.observation?.aiReply ? 2 : 1,
            route: `${APP_PREFIX_PATH}/settings/ai/knowledge/candidates`,
            candidate,
        }))

    const incorporated = filteredDocuments
        .filter((document) => document.status === 'active')
        .sort(
            (left, right) =>
                new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
        )
        .map<KnowledgeBoardCard>((document) => ({
            id: `document:${document.id}`,
            entityId: document.id,
            kind: 'document',
            columnId: 'incorporated',
            title: document.title,
            primaryText: normalizePreview(
                document.summary || document.content,
                'Documento sin resumen',
            ),
            secondaryText:
                document.sourceFile?.name ??
                originLabels[document.originCategory] ??
                document.originCategory,
            labels: [
                originLabels[document.originCategory] ?? document.originCategory,
                scopeLabels[document.scope] ?? document.scope,
                document.hasEmbedding ? 'Indexado' : 'Sin indexar',
            ],
            badge: document.hasEmbedding ? 'Indexado' : 'Sin indexar',
            badgeTone: badgeToneMap.incorporated,
            updatedAt: document.updatedAt,
            commentCount: 0,
            attachmentCount: document.sourceFile ? 1 : 0,
            route: `${APP_PREFIX_PATH}/settings/ai/knowledge/documents`,
            document,
        }))

    return {
        suggested,
        review,
        approved,
        incorporated,
    }
}

const moveCard = (
    columns: Record<BoardColumnId, KnowledgeBoardCard[]>,
    source: { droppableId: string; index: number },
    destination: { droppableId: string; index: number },
) => {
    const sourceColumnId = source.droppableId as BoardColumnId
    const destinationColumnId = destination.droppableId as BoardColumnId

    const sourceCards = [...columns[sourceColumnId]]
    const destinationCards =
        sourceColumnId === destinationColumnId
            ? sourceCards
            : [...columns[destinationColumnId]]

    const [moved] = sourceCards.splice(source.index, 1)
    if (!moved) {
        return columns
    }

    const nextCard = {
        ...moved,
        columnId: destinationColumnId,
    }
    destinationCards.splice(destination.index, 0, nextCard)

    return {
        ...columns,
        [sourceColumnId]: sourceCards,
        [destinationColumnId]: destinationCards,
    }
}

const BoardCardPreview = ({
    card,
    onOpen,
}: {
    card: KnowledgeBoardCard
    onOpen: (card: KnowledgeBoardCard) => void
}) => {
    return (
        <Card
            clickable
            className="hover:shadow-lg rounded-lg dark:bg-gray-700 bg-gray-50 mb-4"
            bodyClass="p-4"
            onClick={() => onOpen(card)}
        >
            <div className="mb-2">
                {card.labels.map((label) => (
                    <Tag
                        key={`${card.id}-${label}`}
                        prefix
                        className="mr-2 rtl:ml-2 mb-2"
                        prefixClass="bg-slate-400"
                    >
                        {label}
                    </Tag>
                ))}
            </div>
            <div className="flex items-start justify-between gap-3 mb-2">
                <h6 className="mb-0">{card.title}</h6>
                {card.badge ? (
                    <Badge className={card.badgeTone}>{card.badge}</Badge>
                ) : null}
            </div>
            <div className="mb-2 text-sm text-gray-800 dark:text-gray-100 line-clamp-4">
                {card.primaryText}
            </div>
            {card.secondaryText ? (
                <div className="text-xs text-gray-500 dark:text-gray-300 line-clamp-3">
                    Consulta: {card.secondaryText}
                </div>
            ) : null}
            <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-gray-500 dark:text-gray-300">
                    {formatRelativeTime(card.updatedAt)}
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 text-sm font-semibold text-gray-600 dark:text-gray-200">
                        <HiOutlineChatAlt2 className="text-base" />
                        <span>{card.commentCount}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm font-semibold text-gray-600 dark:text-gray-200">
                        <HiOutlinePaperClip className="text-base" />
                        <span>{card.attachmentCount}</span>
                    </div>
                </div>
            </div>
        </Card>
    )
}

const BoardColumn = ({
    columnId,
    cards,
    onOpen,
}: {
    columnId: BoardColumnId
    cards: KnowledgeBoardCard[]
    onOpen: (card: KnowledgeBoardCard) => void
}) => {
    const meta = boardColumnMeta[columnId]

    return (
        <div
            className="
                board-column
                flex
                flex-col
                mb-3
                min-w-[300px]
                w-[300px]
                max-w-[300px]
                p-0
                rounded-lg
            "
        >
            <div className="board-title px-4 py-3 flex justify-between items-center">
                <div className="min-w-0">
                    <h6>{meta.title}</h6>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-300">
                        {meta.description}
                    </p>
                </div>
                <Badge className="bg-gray-100 text-gray-700">{cards.length}</Badge>
            </div>
            <StrictModeDroppable droppableId={columnId} type="CONTENT">
                {(provided) => (
                    <div
                        className="board-wrapper overflow-hidden flex-auto"
                        {...provided.droppableProps}
                    >
                        <div className="board-dropzone h-full" ref={provided.innerRef}>
                            <div className="px-4 h-full">
                                {cards.map((card, index) => (
                                    <Draggable
                                        key={card.id}
                                        draggableId={card.id}
                                        index={index}
                                    >
                                        {(dragProvided) => (
                                            <div
                                                ref={dragProvided.innerRef}
                                                {...dragProvided.draggableProps}
                                                {...dragProvided.dragHandleProps}
                                            >
                                                <BoardCardPreview
                                                    card={card}
                                                    onOpen={onOpen}
                                                />
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        </div>
                    </div>
                )}
            </StrictModeDroppable>
        </div>
    )
}

const AiKnowledgeManageArticlesPage = () => {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [filters, setFilters] = useState<FilterState>(initialFilters)
    const [searchDraft, setSearchDraft] = useState('')
    const [rawEvents, setRawEvents] = useState<AiKnowledgeRawEvent[]>([])
    const [candidates, setCandidates] = useState<AiKnowledgeCandidate[]>([])
    const [documents, setDocuments] = useState<AiKnowledgeDocument[]>([])
    const [boardColumns, setBoardColumns] = useState<
        Record<BoardColumnId, KnowledgeBoardCard[]>
    >({
        suggested: [],
        review: [],
        approved: [],
        incorporated: [],
    })
    const [selectedCard, setSelectedCard] = useState<KnowledgeBoardCard | null>(null)
    const [actionLoading, setActionLoading] = useState<string | null>(null)

    const loadBoard = useCallback(async () => {
        setLoading(true)
        try {
            const [rawEventsResponse, candidatesResponse, documentsResponse] =
                await Promise.all([
                    AiKnowledgeService.listRawEvents({
                        pageSize: 180,
                        orderBy: 'updatedAt',
                        orderDir: 'desc',
                    }),
                    AiKnowledgeService.listCandidates({
                        pageSize: 180,
                        orderBy: 'updatedAt',
                        orderDir: 'desc',
                    }),
                    AiKnowledgeService.listDocuments({
                        pageSize: 180,
                        orderBy: 'updatedAt',
                        orderDir: 'desc',
                        status: 'active',
                    }),
                ])

            setRawEvents(rawEventsResponse.data.items)
            setCandidates(candidatesResponse.data.items)
            setDocuments(documentsResponse.data.items)
        } catch (error) {
            console.error(error)
            toast.push(
                <Notification title="No fue posible cargar el training board" type="danger">
                    Revisa disponibilidad del backend e intenta nuevamente.
                </Notification>,
                { placement: 'top-end' },
            )
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadBoard()
    }, [loadBoard])

    const computedBoardColumns = useMemo(
        () => buildBoardColumns(rawEvents, candidates, documents, filters),
        [candidates, documents, filters, rawEvents],
    )

    useEffect(() => {
        setBoardColumns(computedBoardColumns)
    }, [computedBoardColumns])

    const latestUpdate = useMemo(() => {
        const dates = [
            ...rawEvents.map((item) => item.updatedAt),
            ...candidates.map((item) => item.updatedAt),
            ...documents.map((item) => item.updatedAt),
        ]
            .map((value) => new Date(value).getTime())
            .filter((value) => Number.isFinite(value))

        if (!dates.length) {
            return null
        }

        return new Date(Math.max(...dates)).toISOString()
    }, [candidates, documents, rawEvents])

    const handleSearch = useCallback(() => {
        setFilters((current) => ({
            ...current,
            search: searchDraft.trim(),
        }))
    }, [searchDraft])

    const resetFilters = useCallback(() => {
        setSearchDraft('')
        setFilters(initialFilters)
    }, [])

    const openCard = useCallback((card: KnowledgeBoardCard) => {
        setSelectedCard(card)
    }, [])

    const closeCardDialog = useCallback(() => {
        setSelectedCard(null)
    }, [])

    const syncBoardByMove = useCallback(
        async (card: KnowledgeBoardCard, destinationColumnId: BoardColumnId) => {
            if (card.kind === 'raw_event' && card.rawEvent) {
                const event = card.rawEvent
                if (!event.conversation?.id || !event.message?.id) {
                    throw new Error('missing_reference')
                }
                if (
                    !(
                        event.operatorReply?.trim() ||
                        event.aiReply?.trim() ||
                        event.suggestedResponse?.trim()
                    )
                ) {
                    throw new Error('reply_required')
                }

                const result = await AiKnowledgeService.createCandidateFromConversation({
                    conversationId: event.conversation.id,
                    messageId: event.message.id,
                    title: event.detectedIntent ?? undefined,
                    summary: event.contextSummary ?? undefined,
                })

                if (!result.data.id || result.data.status === 'observation_only') {
                    throw new Error('reply_required')
                }

                if (destinationColumnId === 'approved') {
                    await AiKnowledgeService.reviewCandidate(result.data.id, {
                        action: 'approve',
                    })
                }

                if (destinationColumnId === 'incorporated') {
                    await AiKnowledgeService.reviewCandidate(result.data.id, {
                        action: 'approve',
                        promoteToDocument: true,
                        scope: event.scope === 'admin_internal' ? 'admin_internal' : 'customer_public',
                        title: humanizeIntent(event.detectedIntent),
                        summary: event.contextSummary ?? undefined,
                        content: getEventPrimaryResponse(event),
                    })
                }

                return
            }

            if (card.kind === 'candidate' && card.candidate) {
                const candidate = card.candidate

                if (destinationColumnId === 'approved') {
                    await AiKnowledgeService.reviewCandidate(candidate.id, {
                        action: 'approve',
                    })
                    return
                }

                if (destinationColumnId === 'incorporated') {
                    await AiKnowledgeService.reviewCandidate(candidate.id, {
                        action: 'approve',
                        promoteToDocument: true,
                        scope:
                            candidate.scope === 'admin_internal'
                                ? 'admin_internal'
                                : 'customer_public',
                        title: candidate.title,
                        summary:
                            candidate.summary ??
                            candidate.contextSummary ??
                            undefined,
                        content: getCandidatePrimaryResponse(candidate),
                    })
                    return
                }
            }

            throw new Error('unsupported_transition')
        },
        [],
    )

    const onDragEnd = useCallback(
        async (result: DropResult) => {
            if (!result.destination) {
                return
            }

            const sourceColumnId = result.source.droppableId as BoardColumnId
            const destinationColumnId =
                result.destination.droppableId as BoardColumnId

            if (
                sourceColumnId === destinationColumnId &&
                result.source.index === result.destination.index
            ) {
                return
            }

            const card = boardColumns[sourceColumnId]?.[result.source.index]
            if (!card) {
                return
            }

            const allowed =
                (card.kind === 'raw_event' &&
                    ['review', 'approved', 'incorporated'].includes(destinationColumnId)) ||
                (card.kind === 'candidate' &&
                    ((card.columnId === 'review' &&
                        ['approved', 'incorporated'].includes(destinationColumnId)) ||
                        (card.columnId === 'approved' &&
                            destinationColumnId === 'incorporated')))

            if (!allowed) {
                toast.push(
                    <Notification title="Movimiento no disponible" type="warning">
                        Este tablero usa el drag para avanzar el flujo. Los descartes o
                        retrocesos siguen gobernados desde las vistas detalladas.
                    </Notification>,
                    { placement: 'top-end' },
                )
                return
            }

            const previousColumns = boardColumns
            setBoardColumns((current) =>
                moveCard(current, result.source, result.destination!),
            )
            setActionLoading(`move:${card.id}`)

            try {
                await syncBoardByMove(card, destinationColumnId)
                await loadBoard()
                toast.push(
                    <Notification title="Estado actualizado" type="success">
                        El elemento avanzó en el flujo de entrenamiento.
                    </Notification>,
                    { placement: 'top-end' },
                )
            } catch (error) {
                console.error(error)
                setBoardColumns(previousColumns)
                toast.push(
                    <Notification
                        title="No fue posible mover el elemento"
                        type="danger"
                    >
                        {error instanceof Error && error.message === 'reply_required'
                            ? 'El intercambio todavía no tiene una respuesta humana o IA asociada para convertirse en conocimiento revisable.'
                            : error instanceof Error && error.message === 'missing_reference'
                              ? 'El evento no conserva una referencia completa a conversación y mensaje para promoverlo desde el board.'
                            : 'Intenta nuevamente desde la vista detallada correspondiente.'}
                    </Notification>,
                    { placement: 'top-end' },
                )
            } finally {
                setActionLoading(null)
            }
        },
        [boardColumns, loadBoard, syncBoardByMove],
    )

    return (
        <div
            className="flex h-full flex-col"
            data-testid="ai-knowledge-manage-articles-page"
        >
            <div className="pt-8 pb-4 border-b border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800">
                <Container className="px-6">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between mb-6">
                        <div>
                            <h4>Knowledge Manage Articles</h4>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300">
                                Flujo activo de entrenamiento con estado visual, intercambio
                                observado y promoción controlada hacia conocimiento aprobado.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <Badge className="bg-slate-100 text-slate-700">
                                Última actualización {formatRelativeTime(latestUpdate)}
                            </Badge>
                            <Badge className="bg-sky-100 text-sky-700">
                                {boardColumns.approved.length} aprobados listos para incorporar
                            </Badge>
                            <Badge className="bg-emerald-100 text-emerald-700">
                                {boardColumns.incorporated.length} ya incorporados
                            </Badge>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            {scopeOptions.map((option) => (
                                <Button
                                    key={option.value}
                                    size="sm"
                                    variant={
                                        filters.scope === option.value
                                            ? 'solid'
                                            : 'default'
                                    }
                                    onClick={() =>
                                        setFilters((current) => ({
                                            ...current,
                                            scope: option.value,
                                        }))
                                    }
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>

                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                            <Input
                                value={searchDraft}
                                onChange={(event) => setSearchDraft(event.target.value)}
                                placeholder="buscar por mensaje, respuesta, intent o canal"
                            />
                            <div className="flex items-center gap-2">
                                <Button size="sm" variant="solid" onClick={handleSearch}>
                                    Buscar
                                </Button>
                                <Button size="sm" variant="default" onClick={resetFilters}>
                                    Limpiar
                                </Button>
                                <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() =>
                                        navigate(
                                            `${APP_PREFIX_PATH}/settings/ai/knowledge/candidates`,
                                        )
                                    }
                                >
                                    Candidates
                                </Button>
                                <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() =>
                                        navigate(
                                            `${APP_PREFIX_PATH}/settings/ai/knowledge/documents`,
                                        )
                                    }
                                >
                                    Documents
                                </Button>
                            </div>
                        </div>
                    </div>
                </Container>
            </div>

            <Container className="h-full px-6">
                <Loading loading={loading || Boolean(actionLoading)}>
                    <DragDropContext onDragEnd={onDragEnd}>
                        <div className="scrumboard flex flex-col flex-auto w-full h-full mb-2">
                            <div className="scrumboard-body flex max-w-full overflow-x-auto h-full mt-4 gap-4 pb-4">
                                {boardColumnOrder.map((columnId) => (
                                    <BoardColumn
                                        key={columnId}
                                        columnId={columnId}
                                        cards={boardColumns[columnId]}
                                        onOpen={openCard}
                                    />
                                ))}
                            </div>
                        </div>
                    </DragDropContext>
                </Loading>
            </Container>

            <Dialog
                isOpen={Boolean(selectedCard)}
                onClose={closeCardDialog}
                onRequestClose={closeCardDialog}
                width={780}
            >
                {selectedCard ? (
                    <div className="p-2">
                        <div className="mb-4">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h5>{selectedCard.title}</h5>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {selectedCard.labels.map((label) => (
                                            <Tag
                                                key={`${selectedCard.id}-dialog-${label}`}
                                                prefix
                                                prefixClass="bg-slate-400"
                                            >
                                                {label}
                                            </Tag>
                                        ))}
                                    </div>
                                </div>
                                {selectedCard.badge ? (
                                    <Badge className={selectedCard.badgeTone}>
                                        {selectedCard.badge}
                                    </Badge>
                                ) : null}
                            </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        <HiOutlineSparkles />
                                        Respuesta asociada
                                    </div>
                                    <div className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">
                                        {selectedCard.primaryText}
                                    </div>
                                </div>

                                {selectedCard.secondaryText ? (
                                    <div className="rounded-2xl border border-gray-200 p-4">
                                        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                            <HiOutlineChatAlt2 />
                                            Consulta o contexto base
                                        </div>
                                        <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">
                                            {selectedCard.secondaryText}
                                        </div>
                                    </div>
                                ) : null}
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="grid gap-3 text-sm">
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-200">
                                            <HiOutlineClock className="text-base" />
                                            <span>{formatDateTime(selectedCard.updatedAt)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-200">
                                            <HiOutlineChatAlt2 className="text-base" />
                                            <span>{selectedCard.commentCount} señales de intercambio</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-200">
                                            <HiOutlinePaperClip className="text-base" />
                                            <span>{selectedCard.attachmentCount} adjuntos o elementos</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-200">
                                            <HiOutlineDocumentText className="text-base" />
                                            <span>Estado actual: {boardColumnMeta[selectedCard.columnId].title}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-gray-200 p-4">
                                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                        Acciones
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            variant="default"
                                            onClick={() => navigate(selectedCard.route)}
                                        >
                                            Abrir vista detallada
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="default"
                                            onClick={() =>
                                                navigate(
                                                    `${APP_PREFIX_PATH}/settings/ai/knowledge/feedback`,
                                                )
                                            }
                                        >
                                            Ver feedback
                                        </Button>
                                    </div>
                                    <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-gray-600">
                                        En este tablero el cambio de estado se resuelve por drag.
                                        Los descartes o revisiones finas siguen gobernados desde
                                        las vistas detalladas.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </Dialog>
        </div>
    )
}

export default AiKnowledgeManageArticlesPage

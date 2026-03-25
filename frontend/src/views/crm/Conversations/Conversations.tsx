import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'
import ConversationsService, {
    type ConversationDetail,
    type ConversationSummary,
    type InboxSummary,
} from '@/services/ConversationsService'

const formatDateTime = (value?: string | null) => {
    if (!value) return 'N/D'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('es-UY')
}

const formatTitle = (value?: string | null) => {
    if (!value) return 'Sin asunto'
    return value
}

const titleCase = (value?: string | null) => {
    if (!value) return 'N/D'
    return value
        .split('_')
        .map((segment) =>
            segment ? segment[0].toUpperCase() + segment.slice(1) : segment,
        )
        .join(' ')
}

const toneByStatus = (status: string) => {
    switch (status) {
        case 'open':
            return 'bg-emerald-100 text-emerald-700'
        case 'waiting_customer':
            return 'bg-amber-100 text-amber-700'
        case 'waiting_internal':
            return 'bg-sky-100 text-sky-700'
        case 'closed':
            return 'bg-slate-100 text-slate-700'
        default:
            return 'bg-gray-100 text-gray-600'
    }
}

const toneByAuthor = (authorType: string) => {
    switch (authorType) {
        case 'customer':
            return 'border-sky-200 bg-sky-50'
        case 'operator':
            return 'border-emerald-200 bg-emerald-50'
        case 'agent':
            return 'border-violet-200 bg-violet-50'
        default:
            return 'border-slate-200 bg-slate-50'
    }
}

const channelOptions = [
    { key: 'all', label: 'Inbox completo' },
    { key: 'webchat', label: 'Webchat' },
    { key: 'email', label: 'Email' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'facebook', label: 'Facebook' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'admin_chat', label: 'Chat interno' },
] as const

const Conversations = () => {
    const navigate = useNavigate()
    const params = useParams<{ conversationId?: string }>()
    const routeConversationId = params.conversationId ?? null

    const [search, setSearch] = useState('')
    const [items, setItems] = useState<ConversationSummary[]>([])
    const [inboxes, setInboxes] = useState<InboxSummary[]>([])
    const [listLoading, setListLoading] = useState(true)
    const [detailLoading, setDetailLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [detailError, setDetailError] = useState<string | null>(null)
    const [selectedConversationId, setSelectedConversationId] = useState<
        string | null
    >(null)
    const [selectedConversation, setSelectedConversation] =
        useState<ConversationDetail | null>(null)
    const [selectedChannel, setSelectedChannel] = useState<string>('all')
    const [selectedInboxId, setSelectedInboxId] = useState<string>('all')
    const [handoffNotes, setHandoffNotes] = useState('')
    const [replyDraft, setReplyDraft] = useState('')
    const [assignUserId, setAssignUserId] = useState('')
    const [actionLoading, setActionLoading] = useState<null | string>(null)

    const effectiveConversationId = routeConversationId ?? selectedConversationId

    const loadList = useCallback(async () => {
        setListLoading(true)
        setError(null)
        try {
            const [conversationData, inboxData] = await Promise.all([
                ConversationsService.fetchConversations({
                    page: 1,
                    pageSize: 100,
                    search: search.trim() || undefined,
                }),
                ConversationsService.fetchInboxes(),
            ])

            setItems(conversationData.items ?? [])
            setInboxes(inboxData ?? [])
        } catch (loadError) {
            console.error(loadError)
            setError('No fue posible cargar el inbox de conversaciones.')
        } finally {
            setListLoading(false)
        }
    }, [search])

    const loadDetail = useCallback(async (conversationId: string) => {
        setDetailLoading(true)
        setDetailError(null)
        try {
            const detail =
                await ConversationsService.fetchConversation(conversationId)
            setSelectedConversation(detail)
        } catch (loadError) {
            console.error(loadError)
            setSelectedConversation(null)
            setDetailError('No fue posible cargar el detalle de la conversación.')
        } finally {
            setDetailLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadList()
    }, [loadList])

    const visibleItems = useMemo(() => {
        return items.filter((conversation) => {
            const matchesChannel =
                selectedChannel === 'all' || conversation.channel === selectedChannel
            const matchesInbox =
                selectedInboxId === 'all' ||
                conversation.inboxAccount?.id === selectedInboxId ||
                (selectedInboxId === 'virtual:webchat' &&
                    conversation.channel === 'webchat' &&
                    !conversation.inboxAccount)

            return matchesChannel && matchesInbox
        })
    }, [items, selectedChannel, selectedInboxId])

    useEffect(() => {
        if (visibleItems.length === 0) {
            if (!routeConversationId) {
                setSelectedConversationId(null)
                setSelectedConversation(null)
            }
            return
        }

        const currentId = routeConversationId ?? selectedConversationId
        if (currentId && visibleItems.some((item) => item.id === currentId)) {
            return
        }

        const nextId = visibleItems[0]?.id ?? null
        if (!nextId) {
            return
        }
        setSelectedConversationId(nextId)
        void navigate(`/app/crm/conversations/${nextId}`, { replace: !routeConversationId })
    }, [navigate, routeConversationId, selectedConversationId, visibleItems])

    useEffect(() => {
        if (!effectiveConversationId) {
            setSelectedConversation(null)
            return
        }
        void loadDetail(effectiveConversationId)
    }, [effectiveConversationId, loadDetail])

    const selectedConversationMeta = useMemo(
        () =>
            items.find((item) => item.id === effectiveConversationId) ??
            selectedConversation,
        [effectiveConversationId, items, selectedConversation],
    )

    const channelCounts = useMemo(() => {
        return items.reduce<Record<string, number>>((acc, conversation) => {
            acc[conversation.channel] = (acc[conversation.channel] ?? 0) + 1
            return acc
        }, {})
    }, [items])

    const syncConversation = useCallback((detail: ConversationDetail) => {
        setSelectedConversation(detail)
        setItems((current) =>
            current.map((item) => (item.id === detail.id ? detail : item)),
        )
    }, [])

    const runAction = useCallback(
        async (
            actionId: string,
            action: () => Promise<ConversationDetail>,
            fallbackError: string,
        ) => {
            setActionLoading(actionId)
            setDetailError(null)
            try {
                const detail = await action()
                syncConversation(detail)
                setHandoffNotes('')
                if (actionId === 'reply') {
                    setReplyDraft('')
                }
                if (actionId === 'assign') {
                    setAssignUserId('')
                }
            } catch (actionError) {
                console.error(actionError)
                setDetailError(fallbackError)
            } finally {
                setActionLoading(null)
            }
        },
        [syncConversation],
    )

    const renderList = () => {
        if (listLoading) {
            return (
                <div className="flex items-center justify-center py-10">
                    <Spinner size={28} />
                </div>
            )
        }

        if (error) {
            return (
                <div
                    className="px-5 py-4 text-sm text-red-500"
                    data-testid="admin-conversations-list-error"
                >
                    {error}
                </div>
            )
        }

        if (visibleItems.length === 0) {
            return (
                <div
                    className="px-5 py-4 text-sm text-gray-500"
                    data-testid="admin-conversations-empty"
                >
                    No hay conversaciones para el filtro seleccionado.
                </div>
            )
        }

        return visibleItems.map((conversation) => {
            const isSelected = effectiveConversationId === conversation.id
            return (
                <button
                    key={conversation.id}
                    type="button"
                    className={`flex w-full flex-col gap-2 border-b border-gray-100 px-5 py-4 text-left transition ${
                        isSelected ? 'bg-sky-50' : 'bg-white hover:bg-gray-50'
                    }`}
                    data-testid={`admin-conversation-${conversation.id}`}
                    onClick={() => {
                        setSelectedConversationId(conversation.id)
                        void navigate(`/app/crm/conversations/${conversation.id}`)
                    }}
                >
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                            <div className="truncate font-medium text-gray-900">
                                {conversation.customer?.name ||
                                    conversation.participants[0]?.displayName ||
                                    conversation.externalUserId ||
                                    'Sin participante'}
                            </div>
                            <div className="truncate text-xs text-gray-500">
                                {formatTitle(conversation.subject)}
                            </div>
                        </div>
                        <span
                            className={`rounded-full px-2 py-1 text-[11px] font-medium ${toneByStatus(
                                conversation.status,
                            )}`}
                        >
                            {titleCase(conversation.status)}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        <Badge className="bg-slate-100 text-slate-700">
                            {titleCase(conversation.channel)}
                        </Badge>
                        <span>
                            {conversation.inboxAccount?.displayName ||
                                conversation.inboxAccount?.address ||
                                (conversation.channel === 'webchat'
                                    ? 'Webchat directo'
                                    : 'Canal directo')}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                        <span>{titleCase(conversation.controlMode)}</span>
                        <span>
                            {formatDateTime(
                                conversation.lastMessageAt ?? conversation.updatedAt,
                            )}
                        </span>
                    </div>

                    <div className="truncate text-sm text-gray-600">
                        {conversation.latestMessage?.body || 'Sin mensajes todavía'}
                    </div>
                </button>
            )
        })
    }

    return (
        <AdaptableCard
            className="h-full overflow-hidden"
            bodyClass="p-0 h-full absolute inset-0 flex min-w-0 overflow-hidden"
            data-testid="admin-conversations-page"
        >
            <div
                className="w-full max-w-[280px] shrink-0 border-r border-gray-200 bg-white"
                data-testid="admin-conversations-sidebar"
            >
                <div className="border-b border-gray-200 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <h4 className="text-base font-semibold">Inbox CRM</h4>
                            <p className="text-xs text-gray-500">
                                Vista unificada por canal y buzón.
                            </p>
                        </div>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => void loadList()}
                            loading={listLoading}
                            data-testid="admin-conversations-refresh"
                        >
                            Refrescar
                        </Button>
                    </div>
                    <div className="mt-4">
                        <Input
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar por asunto, cliente o thread"
                            data-testid="admin-conversations-search"
                        />
                    </div>
                </div>

                <div className="overflow-y-auto px-4 py-4">
                    <div>
                        <div className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Canales
                        </div>
                        <div
                            className="mt-2 space-y-1"
                            data-testid="admin-conversations-channels"
                        >
                            {channelOptions.map((channel) => {
                                const isActive = selectedChannel === channel.key
                                const count =
                                    channel.key === 'all'
                                        ? items.length
                                        : (channelCounts[channel.key] ?? 0)
                                return (
                                    <button
                                        key={channel.key}
                                        type="button"
                                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                                            isActive
                                                ? 'bg-sky-50 text-sky-700'
                                                : 'text-gray-700 hover:bg-gray-50'
                                        }`}
                                        data-testid={`admin-conversations-channel-${channel.key}`}
                                        onClick={() => {
                                            setSelectedChannel(channel.key)
                                            if (
                                                channel.key !== 'all' &&
                                                selectedInboxId !== 'all'
                                            ) {
                                                const inbox = inboxes.find(
                                                    (item) => item.id === selectedInboxId,
                                                )
                                                if (inbox && inbox.channel !== channel.key) {
                                                    setSelectedInboxId('all')
                                                }
                                            }
                                        }}
                                    >
                                        <span>{channel.label}</span>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                            {count}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div className="mt-6">
                        <div className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Buzones
                        </div>
                        <div
                            className="mt-2 space-y-1"
                            data-testid="admin-conversations-inboxes"
                        >
                            <button
                                type="button"
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                                    selectedInboxId === 'all'
                                        ? 'bg-sky-50 text-sky-700'
                                        : 'text-gray-700 hover:bg-gray-50'
                                }`}
                                data-testid="admin-conversations-inbox-all"
                                onClick={() => setSelectedInboxId('all')}
                            >
                                <span>Inbox completo</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                    {items.length}
                                </span>
                            </button>
                            <button
                                type="button"
                                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                                    selectedInboxId === 'virtual:webchat'
                                        ? 'bg-sky-50 text-sky-700'
                                        : 'text-gray-700 hover:bg-gray-50'
                                }`}
                                data-testid="admin-conversations-inbox-virtual-webchat"
                                onClick={() => {
                                    setSelectedChannel('webchat')
                                    setSelectedInboxId('virtual:webchat')
                                }}
                            >
                                <span>Webchat directo</span>
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                    {
                                        items.filter(
                                            (item) =>
                                                item.channel === 'webchat' &&
                                                !item.inboxAccount,
                                        ).length
                                    }
                                </span>
                            </button>
                            {inboxes.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-gray-400">
                                    Sin buzones configurados
                                </div>
                            ) : (
                                inboxes.map((inbox) => {
                                    const count = items.filter(
                                        (item) => item.inboxAccount?.id === inbox.id,
                                    ).length
                                    const isActive = selectedInboxId === inbox.id
                                    return (
                                        <button
                                            key={inbox.id}
                                            type="button"
                                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${
                                                isActive
                                                    ? 'bg-sky-50 text-sky-700'
                                                    : 'text-gray-700 hover:bg-gray-50'
                                            }`}
                                            data-testid={`admin-conversations-inbox-${inbox.id}`}
                                            onClick={() => {
                                                setSelectedChannel(inbox.channel)
                                                setSelectedInboxId(inbox.id)
                                            }}
                                        >
                                            <div className="min-w-0">
                                                <div className="truncate">
                                                    {inbox.displayName ||
                                                        inbox.address ||
                                                        titleCase(inbox.channel)}
                                                </div>
                                                <div className="truncate text-xs text-gray-400">
                                                    {titleCase(inbox.channel)}
                                                </div>
                                            </div>
                                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                                                {count}
                                            </span>
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex min-w-0 flex-1" data-testid="admin-inbox-body">
                <div
                    className="w-full max-w-[380px] shrink-0 border-r border-gray-200 bg-white"
                    data-testid="admin-conversations-list"
                >
                    {renderList()}
                </div>

                <div
                    className="flex min-w-0 flex-1 flex-col bg-gray-50"
                    data-testid="admin-conversation-detail"
                >
                    {!effectiveConversationId ? (
                        <div className="flex h-full items-center justify-center px-8 text-center text-sm text-gray-500">
                            Selecciona una conversación para ver el detalle.
                        </div>
                    ) : detailLoading ? (
                        <div className="flex h-full items-center justify-center">
                            <Spinner size={32} />
                        </div>
                    ) : detailError ? (
                        <div className="flex h-full items-center justify-center px-8 text-center text-sm text-red-500">
                            {detailError}
                        </div>
                    ) : !selectedConversation ? (
                        <div className="flex h-full items-center justify-center px-8 text-center text-sm text-gray-500">
                            La conversación seleccionada no está disponible.
                        </div>
                    ) : (
                        <>
                            <div className="border-b border-gray-200 bg-white px-6 py-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-2">
                                        <h3
                                            className="text-lg font-semibold"
                                            data-testid="admin-conversation-detail-title"
                                        >
                                            {selectedConversation.customer?.name ||
                                                selectedConversation.participants[0]
                                                    ?.displayName ||
                                                selectedConversation.externalUserId ||
                                                'Conversación'}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                                            <span>
                                                {formatTitle(selectedConversation.subject)}
                                            </span>
                                            <Badge className="bg-slate-100 text-slate-700">
                                                {titleCase(selectedConversation.channel)}
                                            </Badge>
                                            <Badge className="bg-slate-100 text-slate-700">
                                                {titleCase(selectedConversation.scope)}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span
                                            className={`rounded-full px-2 py-1 text-xs font-medium ${toneByStatus(
                                                selectedConversation.status,
                                            )}`}
                                            data-testid="admin-conversation-status"
                                        >
                                            {titleCase(selectedConversation.status)}
                                        </span>
                                        <span
                                            className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
                                            data-testid="admin-conversation-control-mode"
                                        >
                                            {titleCase(selectedConversation.controlMode)}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-3 md:grid-cols-4">
                                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                                        <div className="text-xs uppercase tracking-wide text-gray-400">
                                            Cliente
                                        </div>
                                        <div className="mt-1 text-sm text-gray-700">
                                            {selectedConversation.customer?.email ||
                                                selectedConversation.customer?.phoneNumber ||
                                                'Sin datos vinculados'}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                                        <div className="text-xs uppercase tracking-wide text-gray-400">
                                            Canal origen
                                        </div>
                                        <div className="mt-1 text-sm text-gray-700">
                                            {titleCase(selectedConversation.channel)}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                                        <div className="text-xs uppercase tracking-wide text-gray-400">
                                            Buzón
                                        </div>
                                        <div className="mt-1 text-sm text-gray-700">
                                            {selectedConversation.inboxAccount?.displayName ||
                                                selectedConversation.inboxAccount?.address ||
                                                selectedConversation.externalThreadId ||
                                                'Webchat directo'}
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3">
                                        <div className="text-xs uppercase tracking-wide text-gray-400">
                                            Operación
                                        </div>
                                        <div className="mt-1 text-sm text-gray-700">
                                            <span data-testid="admin-conversation-assignee">
                                                {selectedConversation.assignedToUser?.name ||
                                                    'Sin operador asignado'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {selectedConversationMeta?.latestMessage ? (
                                    <div className="mt-4">
                                        <Badge className="bg-slate-100 text-slate-700">
                                            Último mensaje:{' '}
                                            {formatDateTime(
                                                selectedConversationMeta.latestMessage.createdAt,
                                            )}
                                        </Badge>
                                    </div>
                                ) : null}

                                <div
                                    className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[1fr_auto]"
                                    data-testid="admin-conversation-actions"
                                >
                                    <div className="space-y-3">
                                        <div>
                                            <div className="text-xs uppercase tracking-wide text-slate-400">
                                                Handoff / notas
                                            </div>
                                            <Input
                                                value={handoffNotes}
                                                onChange={(event) =>
                                                    setHandoffNotes(event.target.value)
                                                }
                                                placeholder="Notas opcionales para takeover, release o assign"
                                                data-testid="admin-conversation-handoff-notes"
                                            />
                                        </div>
                                        <div>
                                            <div className="text-xs uppercase tracking-wide text-slate-400">
                                                Asignar usuario
                                            </div>
                                            <div className="mt-1 flex gap-2">
                                                <Input
                                                    value={assignUserId}
                                                    onChange={(event) =>
                                                        setAssignUserId(event.target.value)
                                                    }
                                                    placeholder="ID usuario"
                                                    data-testid="admin-conversation-assign-user"
                                                />
                                                <Button
                                                    variant="solid"
                                                    loading={actionLoading === 'assign'}
                                                    disabled={!assignUserId.trim()}
                                                    onClick={() =>
                                                        effectiveConversationId
                                                            ? void runAction(
                                                                  'assign',
                                                                  () =>
                                                                      ConversationsService.assignConversation(
                                                                          effectiveConversationId,
                                                                          Number(assignUserId),
                                                                          handoffNotes.trim() ||
                                                                              undefined,
                                                                      ),
                                                                  'No fue posible asignar la conversación.',
                                                              )
                                                            : undefined
                                                    }
                                                    data-testid="admin-conversation-assign"
                                                >
                                                    Asignar
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-start gap-2">
                                        <Button
                                            variant="solid"
                                            loading={actionLoading === 'takeover'}
                                            onClick={() =>
                                                effectiveConversationId
                                                    ? void runAction(
                                                          'takeover',
                                                          () =>
                                                              ConversationsService.takeoverConversation(
                                                                  effectiveConversationId,
                                                                  handoffNotes.trim() ||
                                                                      undefined,
                                                              ),
                                                          'No fue posible tomar el control de la conversación.',
                                                      )
                                                    : undefined
                                            }
                                            data-testid="admin-conversation-takeover"
                                        >
                                            Tomar control
                                        </Button>
                                        <Button
                                            variant="twoTone"
                                            loading={actionLoading === 'release'}
                                            onClick={() =>
                                                effectiveConversationId
                                                    ? void runAction(
                                                          'release',
                                                          () =>
                                                              ConversationsService.releaseConversation(
                                                                  effectiveConversationId,
                                                                  handoffNotes.trim() ||
                                                                      undefined,
                                                              ),
                                                          'No fue posible liberar la conversación.',
                                                      )
                                                    : undefined
                                            }
                                            data-testid="admin-conversation-release"
                                        >
                                            Liberar a AI
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div
                                className="flex-1 overflow-y-auto px-6 py-5"
                                data-testid="admin-conversation-messages"
                            >
                                {selectedConversation.messages.length === 0 ? (
                                    <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">
                                        No hay mensajes persistidos todavía.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {selectedConversation.messages.map((message) => (
                                            <div
                                                key={message.id}
                                                className={`rounded-2xl border px-4 py-3 ${toneByAuthor(
                                                    message.authorType,
                                                )}`}
                                                data-testid={`admin-conversation-message-${message.id}`}
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <div className="font-medium text-gray-800">
                                                        {titleCase(message.authorType)}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        {formatDateTime(message.createdAt)}
                                                    </div>
                                                </div>
                                                <div className="mt-1 text-xs text-gray-500">
                                                    {titleCase(message.kind)}
                                                </div>
                                                <div className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                                                    {message.body ||
                                                        message.normalizedText ||
                                                        JSON.stringify(
                                                            message.payload ?? {},
                                                            null,
                                                            2,
                                                        )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="border-t border-gray-200 bg-white px-6 py-4">
                                <div className="mb-3">
                                    <div className="text-xs uppercase tracking-wide text-slate-400">
                                        Responder como operador
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Input
                                        value={replyDraft}
                                        onChange={(event) => setReplyDraft(event.target.value)}
                                        placeholder="Escribe la respuesta para el cliente"
                                        data-testid="admin-conversation-reply-input"
                                    />
                                    <Button
                                        variant="solid"
                                        loading={actionLoading === 'reply'}
                                        disabled={!replyDraft.trim()}
                                        onClick={() =>
                                            effectiveConversationId
                                                ? void runAction(
                                                      'reply',
                                                      () =>
                                                          ConversationsService.replyToConversation(
                                                              effectiveConversationId,
                                                              replyDraft.trim(),
                                                          ),
                                                      'No fue posible enviar la respuesta.',
                                                  )
                                                : undefined
                                        }
                                        data-testid="admin-conversation-reply-submit"
                                    >
                                        Responder
                                    </Button>
                                </div>

                                {selectedConversation.handoffEvents.length ? (
                                    <div
                                        className="mt-4 space-y-2"
                                        data-testid="admin-conversation-handoffs"
                                    >
                                        {selectedConversation.handoffEvents.map((event) => (
                                            <div
                                                key={event.id}
                                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
                                            >
                                                <div className="font-medium text-slate-700">
                                                    {titleCase(event.type)}
                                                </div>
                                                <div>
                                                    {event.actorUser?.name ||
                                                        event.actorUser?.email ||
                                                        'Sistema'}{' '}
                                                    · {formatDateTime(event.createdAt)}
                                                </div>
                                                {event.notes ? (
                                                    <div className="mt-1">{event.notes}</div>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </AdaptableCard>
    )
}

export default Conversations

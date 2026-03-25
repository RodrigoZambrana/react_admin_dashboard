import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'
import Drawer from '@/components/ui/Drawer'
import useResponsive from '@/utils/hooks/useResponsive'
import { apiGetUsers } from '@/services/UsersService'
import {
    MessagingComposer,
    MessagingConversationListItem,
    MessagingMessageBubble,
    MessagingPaneHeader,
    MessagingShell,
} from '@/components/messaging'
import {
    HiOutlinePaperAirplane,
    HiOutlineArrowLeft,
    HiOutlineMenuAlt2,
    HiOutlineReply,
    HiOutlinePhotograph,
    HiOutlineVolumeUp,
    HiOutlineDocumentText,
} from 'react-icons/hi'
import ConversationsService, {
    type ConversationDetail,
    type ConversationQueueSummary,
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

const getConversationDisplayTitle = (conversation: {
    scope: string
    subject: string | null
    customer?: { name: string } | null
    participants?: Array<{ displayName: string | null }> | null
    externalUserId?: string | null
}) => {
    if (conversation.scope === 'admin_internal') {
        return formatTitle(conversation.subject)
    }

    return (
        conversation.customer?.name ||
        conversation.participants?.[0]?.displayName ||
        conversation.externalUserId ||
        'Sin participante'
    )
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
            return 'border-white bg-white'
        case 'operator':
            return 'border-sky-500 bg-sky-600 text-white'
        case 'agent':
            return 'border-violet-500 bg-violet-600 text-white'
        default:
            return 'border-slate-200 bg-slate-100'
    }
}

const getSlaTone = (minutes: number) => {
    if (minutes >= 120) {
        return 'bg-red-100 text-red-700'
    }
    if (minutes >= 30) {
        return 'bg-amber-100 text-amber-700'
    }
    return 'bg-emerald-100 text-emerald-700'
}

const parseDateMs = (value?: string | null) => {
    if (!value) {
        return 0
    }
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
}

const getMessageMetadataValue = (
    metadata: Record<string, unknown> | null | undefined,
    key: string,
) => {
    const value = metadata?.[key]
    return typeof value === 'string' && value.trim() ? value.trim() : null
}

const getTransportEventStatus = (
    payload: Record<string, unknown> | null | undefined,
    type: string,
) => {
    const deliveryStatus =
        typeof payload?.deliveryStatus === 'string'
            ? payload.deliveryStatus.trim()
            : null

    if (deliveryStatus) {
        return titleCase(deliveryStatus)
    }

    return titleCase(type)
}

type ConversationAsset = {
    url: string
    fileName: string | null
    contentType: string | null
    size: number | null
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null
    }
    return value as Record<string, unknown>
}

const asString = (value: unknown) =>
    typeof value === 'string' && value.trim() ? value.trim() : null

const asNumber = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) ? value : null

const normalizeAsset = (value: unknown): ConversationAsset | null => {
    const asset = asRecord(value)
    if (!asset) {
        return null
    }

    const url =
        asString(asset.url) ||
        asString(asset.href) ||
        asString(asset.downloadUrl) ||
        asString(asset.previewUrl) ||
        null

    if (!url) {
        return null
    }

    return {
        url,
        fileName:
            asString(asset.fileName) ||
            asString(asset.filename) ||
            asString(asset.name) ||
            null,
        contentType:
            asString(asset.contentType) || asString(asset.mimeType) || null,
        size: asNumber(asset.size),
    }
}

const normalizeAssets = (value: unknown): ConversationAsset[] => {
    if (!Array.isArray(value)) {
        return []
    }

    const seen = new Set<string>()

    return value
        .map((entry) => normalizeAsset(entry))
        .filter((entry): entry is ConversationAsset => {
            if (!entry) {
                return false
            }
            const key = `${entry.url}:${entry.fileName ?? ''}`
            if (seen.has(key)) {
                return false
            }
            seen.add(key)
            return true
        })
}

const getMessageAssets = (
    payload: Record<string, unknown> | null | undefined,
    metadata: Record<string, unknown> | null | undefined,
) => {
    const payloadRecord = asRecord(payload)
    const metadataRecord = asRecord(metadata)

    const attachments = normalizeAssets(
        payloadRecord?.attachments ?? metadataRecord?.attachments,
    )
    const image =
        normalizeAsset(payloadRecord?.image) ||
        normalizeAsset(metadataRecord?.image) ||
        normalizeAsset(
            asString(payloadRecord?.imageUrl) || asString(metadataRecord?.imageUrl)
                ? {
                      url:
                          asString(payloadRecord?.imageUrl) ||
                          asString(metadataRecord?.imageUrl),
                      fileName:
                          asString(payloadRecord?.imageName) ||
                          asString(metadataRecord?.imageName),
                      contentType:
                          asString(payloadRecord?.imageContentType) ||
                          asString(metadataRecord?.imageContentType),
                  }
                : null,
        )
    const audio =
        normalizeAsset(payloadRecord?.audio) ||
        normalizeAsset(metadataRecord?.audio) ||
        normalizeAsset(
            asString(payloadRecord?.audioUrl) || asString(metadataRecord?.audioUrl)
                ? {
                      url:
                          asString(payloadRecord?.audioUrl) ||
                          asString(metadataRecord?.audioUrl),
                      fileName:
                          asString(payloadRecord?.audioName) ||
                          asString(metadataRecord?.audioName),
                      contentType:
                          asString(payloadRecord?.audioContentType) ||
                          asString(metadataRecord?.audioContentType),
                  }
                : null,
        )

    const filteredAttachments = attachments.filter(
        (attachment) =>
            attachment.url !== image?.url && attachment.url !== audio?.url,
    )

    return {
        attachments: filteredAttachments,
        image,
        audio,
    }
}

const formatBytes = (value: number | null) => {
    if (value === null || value <= 0) {
        return null
    }
    if (value < 1024) {
        return `${value} B`
    }
    const kb = value / 1024
    if (kb < 1024) {
        return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`
    }
    const mb = kb / 1024
    return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`
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

const scopeOptions = [
    { key: 'all', label: 'Todo' },
    { key: 'customer_public', label: 'Cliente' },
    { key: 'admin_internal', label: 'Interno' },
] as const

type OperatorSummary = {
    id: number
    name: string
    email: string
}

type MobilePane = 'list' | 'detail'

const Conversations = () => {
    const navigate = useNavigate()
    const params = useParams<{ conversationId?: string }>()
    const routeConversationId = params.conversationId ?? null
    const { smaller } = useResponsive()
    const isMobile = smaller.lg

    const [search, setSearch] = useState('')
    const [items, setItems] = useState<ConversationSummary[]>([])
    const [inboxes, setInboxes] = useState<InboxSummary[]>([])
    const [queues, setQueues] = useState<ConversationQueueSummary[]>([])
    const [operators, setOperators] = useState<OperatorSummary[]>([])
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
    const [selectedScope, setSelectedScope] = useState<string>('all')
    const [selectedInboxId, setSelectedInboxId] = useState<string>('all')
    const [selectedQueueSlug, setSelectedQueueSlug] = useState<string>('all')
    const [selectedOwnerId, setSelectedOwnerId] = useState<string>('all')
    const [handoffNotes, setHandoffNotes] = useState('')
    const [replyDraft, setReplyDraft] = useState('')
    const [assignUserId, setAssignUserId] = useState('')
    const [overrideQueueSlug, setOverrideQueueSlug] = useState('')
    const [overrideUserId, setOverrideUserId] = useState('')
    const [actionLoading, setActionLoading] = useState<null | string>(null)
    const [mobilePane, setMobilePane] = useState<MobilePane>('list')
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
    const [isMobileDetailPanelOpen, setIsMobileDetailPanelOpen] = useState(false)
    const [newInternalSubject, setNewInternalSubject] = useState('')
    const [newInternalMessage, setNewInternalMessage] = useState('')

    const effectiveConversationId = routeConversationId ?? selectedConversationId

    const loadList = useCallback(async () => {
        setListLoading(true)
        setError(null)
        try {
            const [conversationData, inboxData, queueData, usersResponse] =
                await Promise.all([
                    ConversationsService.fetchConversations({
                        page: 1,
                        pageSize: 100,
                        search: search.trim() || undefined,
                    }),
                    ConversationsService.fetchInboxes(),
                    ConversationsService.fetchQueues(),
                    apiGetUsers<OperatorSummary[]>(),
                ])

            setItems(conversationData.items ?? [])
            setInboxes(inboxData ?? [])
            setQueues(queueData ?? [])
            setOperators(usersResponse.data ?? [])
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
        const filtered = items.filter((conversation) => {
            const matchesScope =
                selectedScope === 'all' || conversation.scope === selectedScope
            const matchesChannel =
                selectedChannel === 'all' || conversation.channel === selectedChannel
            const matchesInbox =
                selectedInboxId === 'all' ||
                conversation.inboxAccount?.id === selectedInboxId ||
                (selectedInboxId === 'virtual:webchat' &&
                    conversation.channel === 'webchat' &&
                    !conversation.inboxAccount)
            const matchesQueue =
                selectedQueueSlug === 'all' ||
                conversation.queue?.slug === selectedQueueSlug
            const matchesOwner =
                selectedOwnerId === 'all' ||
                String(conversation.assignedToUser?.id ?? '') === selectedOwnerId

            return (
                matchesScope &&
                matchesChannel &&
                matchesInbox &&
                matchesQueue &&
                matchesOwner
            )
        })

        return filtered.sort((left, right) => {
            const leftBreached = left.operational.isSlaBreached ? 1 : 0
            const rightBreached = right.operational.isSlaBreached ? 1 : 0

            if (leftBreached !== rightBreached) {
                return rightBreached - leftBreached
            }

            const leftUnassigned = left.operational.needsAssignment ? 1 : 0
            const rightUnassigned = right.operational.needsAssignment ? 1 : 0
            if (leftUnassigned !== rightUnassigned) {
                return rightUnassigned - leftUnassigned
            }

            const leftPriority = left.queue?.priority ?? 9999
            const rightPriority = right.queue?.priority ?? 9999
            if (leftPriority !== rightPriority) {
                return leftPriority - rightPriority
            }

            const leftActivity = parseDateMs(left.lastMessageAt ?? left.updatedAt)
            const rightActivity = parseDateMs(right.lastMessageAt ?? right.updatedAt)
            return rightActivity - leftActivity
        })
    }, [
        items,
        selectedScope,
        selectedChannel,
        selectedInboxId,
        selectedOwnerId,
        selectedQueueSlug,
    ])

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
        if (routeConversationId) {
            return
        }

        const nextId = visibleItems[0]?.id ?? null
        if (!nextId) {
            return
        }
        setSelectedConversationId(nextId)
        void navigate(`/app/crm/conversations/${nextId}`, {
            replace: !routeConversationId,
        })
    }, [navigate, routeConversationId, selectedConversationId, visibleItems])

    useEffect(() => {
        if (!effectiveConversationId) {
            setSelectedConversation(null)
            return
        }
        void loadDetail(effectiveConversationId)
    }, [effectiveConversationId, loadDetail])

    useEffect(() => {
        setIsMobileDetailPanelOpen(false)
    }, [effectiveConversationId])

    useEffect(() => {
        setAssignUserId(
            selectedConversation?.assignedToUser?.id
                ? String(selectedConversation.assignedToUser.id)
                : '',
        )
        setOverrideUserId(
            selectedConversation?.assignedToUser?.id
                ? String(selectedConversation.assignedToUser.id)
                : '',
        )
        setOverrideQueueSlug(selectedConversation?.queue?.slug ?? '')
    }, [selectedConversation])

    useEffect(() => {
        if (!isMobile) {
            return
        }
        if (effectiveConversationId) {
            setMobilePane('detail')
        }
    }, [effectiveConversationId, isMobile])

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

    const createInternalConversation = useCallback(async () => {
        setActionLoading('create-internal')
        setDetailError(null)
        try {
            const detail =
                await ConversationsService.createAdminInternalConversation({
                    subject: newInternalSubject.trim(),
                    message: newInternalMessage.trim(),
                })
            syncConversation(detail)
            setItems((current) =>
                current.some((item) => item.id === detail.id)
                    ? current
                    : [detail, ...current],
            )
            setSelectedConversationId(detail.id)
            setSelectedConversation(detail)
            setNewInternalSubject('')
            setNewInternalMessage('')
            if (isMobile) {
                setMobilePane('detail')
            }
            void navigate(`/app/crm/conversations/${detail.id}`)
        } catch (actionError) {
            console.error(actionError)
            setDetailError('No fue posible crear el chat interno.')
        } finally {
            setActionLoading(null)
        }
    }, [
        isMobile,
        navigate,
        newInternalMessage,
        newInternalSubject,
        syncConversation,
    ])

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
                <MessagingConversationListItem
                    key={conversation.id}
                    selected={isSelected}
                    testId={`admin-conversation-${conversation.id}`}
                    onClick={() => {
                        setSelectedConversationId(conversation.id)
                        if (isMobile) {
                            setMobilePane('detail')
                        }
                        void navigate(`/app/crm/conversations/${conversation.id}`)
                    }}
                    title={getConversationDisplayTitle(conversation)}
                    subject={formatTitle(conversation.subject)}
                    status={
                        <span
                            className={`rounded-full px-2 py-1 text-[11px] font-medium ${toneByStatus(
                                conversation.status,
                            )}`}
                        >
                            {titleCase(conversation.status)}
                        </span>
                    }
                    badges={
                        <>
                            <Badge className="bg-slate-100 text-slate-700">
                                {titleCase(conversation.channel)}
                            </Badge>
                            {conversation.queue ? (
                                <Badge className="bg-amber-100 text-amber-700">
                                    {conversation.queue.name}
                                </Badge>
                            ) : null}
                            {!conversation.assignedToUser ? (
                                <Badge className="bg-rose-100 text-rose-700">
                                    Sin asignar
                                </Badge>
                            ) : null}
                            {conversation.operational.isSlaBreached ? (
                                <Badge className="bg-red-100 text-red-700">
                                    SLA vencido
                                </Badge>
                            ) : null}
                        </>
                    }
                    metaLeft={
                        conversation.inboxAccount?.displayName ||
                        conversation.inboxAccount?.address ||
                        (conversation.channel === 'webchat'
                            ? 'Webchat directo'
                            : 'Canal directo')
                    }
                    metaRight={formatDateTime(
                        conversation.lastMessageAt ?? conversation.updatedAt,
                    )}
                    preview={conversation.latestMessage?.body || 'Sin mensajes todavía'}
                />
            )
        })
    }

    const paneClass = (pane: MobilePane) =>
        isMobile
            ? mobilePane === pane
                ? 'flex'
                : 'hidden'
            : 'flex'

    const closeMobileSidebar = useCallback(() => {
        setIsMobileSidebarOpen(false)
    }, [])

    const openMobileSidebar = useCallback(() => {
        setIsMobileSidebarOpen(true)
    }, [])

    const closeMobileDetailPanel = useCallback(() => {
        setIsMobileDetailPanelOpen(false)
    }, [])

    const openMobileDetailPanel = useCallback(() => {
        setIsMobileDetailPanelOpen(true)
    }, [])

    const sidebarContent = (
        <div className="flex h-full flex-col bg-white">
            <div className="border-b border-gray-200 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <h4 className="text-base font-semibold">Inbox CRM</h4>
                        <p className="text-xs text-gray-500">
                            Vista unificada por canal, buzón y cola.
                        </p>
                    </div>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                            closeMobileSidebar()
                            void loadList()
                        }}
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

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <div>
                    <div className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Nuevo chat interno
                    </div>
                    <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="space-y-2">
                            <Input
                                value={newInternalSubject}
                                onChange={(event) =>
                                    setNewInternalSubject(event.target.value)
                                }
                                placeholder="Asunto interno"
                                data-testid="admin-conversations-internal-subject"
                            />
                            <textarea
                                className="input min-h-[96px] w-full resize-y"
                                value={newInternalMessage}
                                onChange={(event) =>
                                    setNewInternalMessage(event.target.value)
                                }
                                placeholder="Describe la consulta o acción que querés pedirle a la IA"
                                data-testid="admin-conversations-internal-message"
                            />
                            <Button
                                block
                                variant="solid"
                                loading={actionLoading === 'create-internal'}
                                disabled={
                                    newInternalSubject.trim().length < 2 ||
                                    newInternalMessage.trim().length < 2
                                }
                                onClick={() => void createInternalConversation()}
                                data-testid="admin-conversations-internal-create"
                            >
                                Crear chat interno
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="mt-6">
                    <div className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Scope
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                        {scopeOptions.map((scope) => (
                            <Button
                                key={scope.key}
                                size="sm"
                                variant={
                                    selectedScope === scope.key
                                        ? 'solid'
                                        : 'twoTone'
                                }
                                onClick={() => {
                                    setSelectedScope(scope.key)
                                    if (isMobile) {
                                        setMobilePane('list')
                                        closeMobileSidebar()
                                    }
                                }}
                                data-testid={`admin-conversations-scope-${scope.key}`}
                            >
                                {scope.label}
                            </Button>
                        ))}
                    </div>
                </div>

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
                                                (item) =>
                                                    item.id === selectedInboxId,
                                            )
                                            if (
                                                inbox &&
                                                inbox.channel !== channel.key
                                            ) {
                                                setSelectedInboxId('all')
                                            }
                                        }
                                        if (isMobile) {
                                            setMobilePane('list')
                                            closeMobileSidebar()
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
                            onClick={() => {
                                setSelectedInboxId('all')
                                if (isMobile) {
                                    setMobilePane('list')
                                    closeMobileSidebar()
                                }
                            }}
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
                                if (isMobile) {
                                    setMobilePane('list')
                                    closeMobileSidebar()
                                }
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
                                            if (isMobile) {
                                                setMobilePane('list')
                                                closeMobileSidebar()
                                            }
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

                    <div className="mt-6">
                        <div className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Cola y ownership
                        </div>
                        {queues.length ? (
                            <div
                                className="mt-3 space-y-2"
                                data-testid="admin-conversations-queue-cards"
                            >
                                {queues.map((queue) => {
                                    const isActive =
                                        selectedQueueSlug === queue.slug
                                    return (
                                        <button
                                            key={queue.id}
                                            type="button"
                                            className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                                                isActive
                                                    ? 'border-sky-200 bg-sky-50'
                                                    : 'border-gray-200 bg-white hover:bg-gray-50'
                                            }`}
                                            data-testid={`admin-conversations-queue-card-${queue.slug}`}
                                            onClick={() => {
                                                setSelectedQueueSlug(
                                                    isActive ? 'all' : queue.slug,
                                                )
                                                if (isMobile) {
                                                    setMobilePane('list')
                                                    closeMobileSidebar()
                                                }
                                            }}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="truncate text-sm font-medium text-gray-800">
                                                        {queue.name}
                                                    </div>
                                                    <div className="mt-1 text-xs text-gray-500">
                                                        SLA objetivo{' '}
                                                        {queue.slaTargetMinutes}m
                                                    </div>
                                                </div>
                                                <Badge className="bg-slate-100 text-slate-700">
                                                    {queue.conversationCount}
                                                </Badge>
                                            </div>
                                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                                <Badge className="bg-amber-100 text-amber-700">
                                                    Esperando cliente:{' '}
                                                    {queue.waitingCustomerCount}
                                                </Badge>
                                                <Badge className="bg-sky-100 text-sky-700">
                                                    Operadores: {queue.operatorCount}
                                                </Badge>
                                                <Badge className="bg-slate-100 text-slate-700">
                                                    Sin asignar: {queue.unassignedCount}
                                                </Badge>
                                                <Badge
                                                    className={
                                                        queue.breachedSlaCount > 0
                                                            ? 'bg-red-100 text-red-700'
                                                            : 'bg-emerald-100 text-emerald-700'
                                                    }
                                                >
                                                    SLA vencido:{' '}
                                                    {queue.breachedSlaCount}
                                                </Badge>
                                                <Badge className="bg-violet-100 text-violet-700">
                                                    Ownership:{' '}
                                                    {titleCase(
                                                        queue.assignmentMode,
                                                    )}
                                                </Badge>
                                            </div>
                                            <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-500">
                                                <span>
                                                    Prioridad {queue.priority}
                                                </span>
                                                <span>
                                                    Asignadas:{' '}
                                                    {queue.assignedOpenCount}
                                                </span>
                                                <span>
                                                    Capacidad:{' '}
                                                    {queue.configuredCapacity ??
                                                        'sin límite'}
                                                </span>
                                                <span>
                                                    Disponible:{' '}
                                                    {queue.availableCapacity ??
                                                        'sin límite'}
                                                </span>
                                            </div>
                                            {queue.primaryOperators.length ? (
                                                <div className="mt-2 text-[11px] text-gray-500">
                                                    Primarios:{' '}
                                                    {queue.primaryOperators
                                                        .map(
                                                            (operator) =>
                                                                operator.name,
                                                        )
                                                        .join(', ')}
                                                </div>
                                            ) : null}
                                            {queue.oldestInboundAt ? (
                                                <div className="mt-2 text-[11px] text-gray-500">
                                                    Más antigua:{' '}
                                                    {formatDateTime(
                                                        queue.oldestInboundAt,
                                                    )}
                                                </div>
                                            ) : null}
                                        </button>
                                    )
                                })}
                            </div>
                        ) : null}
                        <div className="mt-2 space-y-3">
                            <select
                                className="input w-full"
                            value={selectedQueueSlug}
                            onChange={(event) => {
                                setSelectedQueueSlug(event.target.value)
                                if (isMobile) {
                                    setMobilePane('list')
                                    closeMobileSidebar()
                                }
                            }}
                            data-testid="admin-conversations-queue-filter"
                        >
                            <option value="all">Todas las colas</option>
                            {queues.map((queue) => (
                                <option key={queue.id} value={queue.slug}>
                                    {queue.name}
                                </option>
                            ))}
                        </select>
                        <select
                            className="input w-full"
                            value={selectedOwnerId}
                            onChange={(event) => {
                                setSelectedOwnerId(event.target.value)
                                if (isMobile) {
                                    setMobilePane('list')
                                    closeMobileSidebar()
                                }
                            }}
                            data-testid="admin-conversations-owner-filter"
                        >
                            <option value="all">Todos los operadores</option>
                            {operators.map((operator) => (
                                <option
                                    key={operator.id}
                                    value={String(operator.id)}
                                >
                                    {operator.name || operator.email}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    )

    const detailSlaMinutes = selectedConversation?.lastInboundAt
        ? Math.max(
              0,
              Math.round(
                  (Date.now() -
                      new Date(selectedConversation.lastInboundAt).getTime()) /
                      60000,
              ),
          )
        : null

    const selectedQueueDiagnostics = useMemo(
        () =>
            queues.find(
                (queue) =>
                    queue.slug ===
                    (overrideQueueSlug || selectedConversation?.queue?.slug),
            ) ?? null,
        [overrideQueueSlug, queues, selectedConversation?.queue?.slug],
    )

    const detailSlaRemainingMinutes =
        detailSlaMinutes !== null && selectedQueueDiagnostics
            ? Math.max(selectedQueueDiagnostics.slaTargetMinutes - detailSlaMinutes, 0)
            : null

    const detailSlaLabel =
        detailSlaMinutes === null || !selectedQueueDiagnostics
            ? 'Sin SLA calculado'
            : detailSlaMinutes >= selectedQueueDiagnostics.slaTargetMinutes
              ? `SLA vencido por ${Math.max(
                    detailSlaMinutes - selectedQueueDiagnostics.slaTargetMinutes,
                    0,
                )}m`
              : `Vence en ${detailSlaRemainingMinutes}m`

    const conversationManagementContent = (
        <div className="space-y-3">
            {selectedConversationMeta?.latestMessage ? (
                <div>
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                        Último mensaje
                    </div>
                    <div className="mt-1 text-sm text-slate-700">
                        {formatDateTime(
                            selectedConversationMeta.latestMessage.createdAt,
                        )}
                    </div>
                </div>
            ) : null}

            <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                    Handoff / notas
                </div>
                <Input
                    value={handoffNotes}
                    onChange={(event) => setHandoffNotes(event.target.value)}
                    placeholder="Notas opcionales para takeover, release o assign"
                    data-testid="admin-conversation-handoff-notes"
                />
            </div>

            <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                    Asignar usuario
                </div>
                <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                    <select
                        className="input w-full"
                        value={assignUserId}
                        onChange={(event) => setAssignUserId(event.target.value)}
                        data-testid="admin-conversation-assign-user"
                    >
                        <option value="">Seleccionar operador</option>
                        {operators.map((operator) => (
                            <option
                                key={operator.id}
                                value={String(operator.id)}
                            >
                                {operator.name || operator.email}
                            </option>
                        ))}
                    </select>
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
                                              handoffNotes.trim() || undefined,
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

            <div>
                <div className="text-xs uppercase tracking-wide text-slate-400">
                    Override supervisor
                </div>
                <div className="mt-1 grid gap-2">
                    <select
                        className="input w-full"
                        value={overrideQueueSlug}
                        onChange={(event) =>
                            setOverrideQueueSlug(event.target.value)
                        }
                        data-testid="admin-conversation-override-queue"
                    >
                        <option value="">Mantener cola actual</option>
                        {queues.map((queue) => (
                            <option key={queue.id} value={queue.slug}>
                                {queue.name}
                            </option>
                        ))}
                    </select>
                    <select
                        className="input w-full"
                        value={overrideUserId}
                        onChange={(event) => setOverrideUserId(event.target.value)}
                        data-testid="admin-conversation-override-user"
                    >
                        <option value="">Auto / mantener operador</option>
                        {operators.map((operator) => (
                            <option
                                key={operator.id}
                                value={String(operator.id)}
                            >
                                {operator.name || operator.email}
                            </option>
                        ))}
                    </select>
                    <Button
                        variant="default"
                        loading={actionLoading === 'reroute'}
                        onClick={() =>
                            effectiveConversationId
                                ? void runAction(
                                      'reroute',
                                      () =>
                                          ConversationsService.rerouteConversation(
                                              effectiveConversationId,
                                              {
                                                  queueSlug:
                                                      overrideQueueSlug.trim() ||
                                                      undefined,
                                                  userId: overrideUserId.trim()
                                                      ? Number(overrideUserId)
                                                      : undefined,
                                                  notes:
                                                      handoffNotes.trim() ||
                                                      'Supervisor override',
                                              },
                                          ),
                                      'No fue posible aplicar el override operativo.',
                                  )
                                : undefined
                        }
                        data-testid="admin-conversation-reroute"
                    >
                        Aplicar override
                    </Button>
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
                                          handoffNotes.trim() || undefined,
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
                                          handoffNotes.trim() || undefined,
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

            {selectedConversation?.handoffEvents.length ? (
                <div
                    className="space-y-2 border-t border-slate-200 pt-3"
                    data-testid="admin-conversation-handoffs"
                >
                    <div className="text-xs uppercase tracking-wide text-slate-400">
                        Historial de control
                    </div>
                    {selectedConversation.handoffEvents.map((event) => (
                        <div
                            key={event.id}
                            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
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
    )

    const toolCallsContent =
        selectedConversation?.toolCalls.length ? (
            <div
                className="space-y-2"
                data-testid="admin-conversation-tool-calls"
            >
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Tool calls
                </div>
                {selectedConversation.toolCalls.map((toolCall) => (
                    <div
                        key={toolCall.id}
                        className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-3 text-xs text-violet-900"
                    >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">
                                {toolCall.toolName}
                            </span>
                            <Badge className="bg-violet-100 text-violet-700">
                                {titleCase(toolCall.status)}
                            </Badge>
                        </div>
                        {toolCall.validatedPayload ? (
                            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[11px]">
                                {JSON.stringify(
                                    toolCall.validatedPayload,
                                    null,
                                    2,
                                )}
                            </pre>
                        ) : null}
                        {toolCall.errorMessage ? (
                            <div className="mt-2 text-red-600">
                                {toolCall.errorMessage}
                            </div>
                        ) : null}
                    </div>
                ))}
            </div>
        ) : null

    const renderConversationMessageBody = (
        message: ConversationDetail['messages'][number],
    ) => {
        const assets = getMessageAssets(message.payload, message.metadata)
        const textContent =
            message.body || message.normalizedText || null
        const hasStructuredContent =
            Boolean(assets.image) ||
            Boolean(assets.audio) ||
            assets.attachments.length > 0

        if (!textContent && !hasStructuredContent) {
            return (
                <pre className="overflow-x-auto whitespace-pre-wrap text-[12px] leading-5 text-slate-600">
                    {JSON.stringify(message.payload ?? {}, null, 2)}
                </pre>
            )
        }

        return (
            <div className="space-y-3">
                {textContent ? <div>{textContent}</div> : null}

                {assets.image ? (
                    <a
                        href={assets.image.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-[22px] border border-slate-200 bg-white"
                        data-testid={`admin-conversation-image-${message.id}`}
                    >
                        <img
                            src={assets.image.url}
                            alt={assets.image.fileName || 'Imagen adjunta'}
                            className="max-h-[320px] w-full object-cover"
                        />
                        <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                            <HiOutlinePhotograph className="text-sm" />
                            <span className="truncate">
                                {assets.image.fileName || 'Imagen'}
                            </span>
                        </div>
                    </a>
                ) : null}

                {assets.audio ? (
                    <div className="rounded-[22px] border border-slate-200 bg-white px-3 py-3">
                        <div className="mb-2 flex items-center gap-2 text-xs text-slate-500">
                            <HiOutlineVolumeUp className="text-sm" />
                            <span className="truncate">
                                {assets.audio.fileName || 'Audio'}
                            </span>
                        </div>
                        <audio
                            controls
                            preload="none"
                            className="w-full"
                            data-testid={`admin-conversation-audio-${message.id}`}
                        >
                            <source
                                src={assets.audio.url}
                                type={assets.audio.contentType || undefined}
                            />
                            <track kind="captions" />
                        </audio>
                    </div>
                ) : null}

                {assets.attachments.length ? (
                    <div className="space-y-2">
                        {assets.attachments.map((attachment) => (
                            <a
                                key={`${message.id}:${attachment.url}`}
                                href={attachment.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                                data-testid={`admin-conversation-attachment-${message.id}`}
                            >
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="rounded-full bg-slate-100 p-2 text-slate-500">
                                        {attachment.contentType?.startsWith(
                                            'image/',
                                        ) ? (
                                            <HiOutlinePhotograph className="text-base" />
                                        ) : attachment.contentType?.startsWith(
                                              'audio/',
                                          ) ? (
                                            <HiOutlineVolumeUp className="text-base" />
                                          ) : (
                                            <HiOutlineDocumentText className="text-base" />
                                          )}
                                    </span>
                                    <div className="min-w-0">
                                        <div className="truncate font-medium">
                                            {attachment.fileName || 'Adjunto'}
                                        </div>
                                        <div className="truncate text-xs text-slate-500">
                                            {attachment.contentType || 'Archivo'}
                                        </div>
                                    </div>
                                </div>
                                <div className="shrink-0 text-xs text-slate-500">
                                    {formatBytes(attachment.size) || 'Abrir'}
                                </div>
                            </a>
                        ))}
                    </div>
                ) : null}
            </div>
        )
    }

    const getMessageRowClassName = (authorType: string, kind: string) => {
        if (kind === 'system_event' || authorType === 'system') {
            return 'flex justify-center'
        }
        if (authorType === 'operator' || authorType === 'agent') {
            return 'flex justify-end'
        }
        return 'flex justify-start'
    }

    return (
        <AdaptableCard
            className="h-full min-h-0 overflow-hidden"
            bodyClass="p-0 h-full absolute inset-0 flex min-h-0 min-w-0 overflow-hidden"
            data-testid="admin-conversations-page"
        >
            {isMobile ? (
                <>
                    <div className="absolute inset-x-0 top-0 z-10 border-b border-gray-200 bg-white px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                                <Button
                                    shape="circle"
                                    size="sm"
                                    variant="plain"
                                    icon={<HiOutlineMenuAlt2 />}
                                    onClick={openMobileSidebar}
                                    data-testid="admin-conversations-mobile-menu"
                                />
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-gray-900">
                                        {mobilePane === 'detail' &&
                                        selectedConversation
                                            ? getConversationDisplayTitle(
                                                  selectedConversation,
                                              )
                                            : 'Inbox CRM'}
                                    </div>
                                    <div className="truncate text-xs text-gray-500">
                                        {mobilePane === 'detail'
                                            ? formatTitle(
                                                  selectedConversation?.subject,
                                              )
                                            : 'Canales, buzones y colas'}
                                    </div>
                                </div>
                            </div>
                            {mobilePane === 'detail' ? (
                                <Button
                                    size="sm"
                                    variant="twoTone"
                                    onClick={() => setMobilePane('list')}
                                >
                                    Lista
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => void loadList()}
                                    loading={listLoading}
                                >
                                    Refrescar
                                </Button>
                            )}
                        </div>
                    </div>
                    <Drawer
                        bodyClass="p-0"
                        title="Inbox CRM"
                        isOpen={isMobileSidebarOpen}
                        placement="left"
                        width={320}
                        onClose={closeMobileSidebar}
                        onRequestClose={closeMobileSidebar}
                    >
                        {sidebarContent}
                    </Drawer>
                </>
            ) : null}

            <MessagingShell
                isMobile={isMobile}
                sidebar={sidebarContent}
                sidebarTestId="admin-conversations-sidebar"
                list={
                <div
                    className={`${paneClass('list')} w-full min-h-0 shrink-0 flex-col border-r border-gray-200 bg-white lg:max-w-[380px] ${
                        isMobile ? 'pt-[72px]' : ''
                    }`}
                    data-testid="admin-conversations-list"
                >
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {renderList()}
                    </div>
                </div>
                }
                detail={
                <div
                    className={`${paneClass('detail')} min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#eef1f7] ${
                        isMobile ? 'pt-[72px]' : ''
                    }`}
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
                        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                            <MessagingPaneHeader
                                title={
                                    <h3
                                        className="truncate text-base font-semibold lg:text-lg"
                                        data-testid="admin-conversation-detail-title"
                                    >
                                        {getConversationDisplayTitle(
                                            selectedConversation,
                                        )}
                                    </h3>
                                }
                                subtitle={
                                    <>
                                        <Badge className="bg-slate-100 text-slate-700">
                                            {titleCase(selectedConversation.channel)}
                                        </Badge>
                                        {selectedConversation.queue ? (
                                            <Badge className="bg-amber-100 text-amber-700">
                                                {selectedConversation.queue.name}
                                            </Badge>
                                        ) : null}
                                        {detailSlaMinutes !== null ? (
                                            <Badge
                                                className={getSlaTone(
                                                    detailSlaMinutes,
                                                )}
                                                data-testid="admin-conversation-sla"
                                            >
                                                SLA {detailSlaMinutes}m
                                            </Badge>
                                        ) : null}
                                    </>
                                }
                                leading={
                                    isMobile ? (
                                        <Button
                                            shape="circle"
                                            size="sm"
                                            variant="plain"
                                            icon={<HiOutlineArrowLeft />}
                                            onClick={() => setMobilePane('list')}
                                            data-testid="admin-conversation-mobile-back"
                                        />
                                    ) : null
                                }
                                trailing={
                                    <>
                                        <Button
                                            size="sm"
                                            variant="twoTone"
                                            onClick={openMobileDetailPanel}
                                            data-testid="admin-conversation-mobile-details"
                                        >
                                            Detalles
                                        </Button>
                                        <Button
                                            shape="circle"
                                            size="sm"
                                            variant="default"
                                            icon={<HiOutlineReply />}
                                            onClick={() => {
                                                const input =
                                                    document.querySelector<HTMLInputElement>(
                                                        '[data-testid="admin-conversation-reply-input"]',
                                                    )
                                                input?.focus()
                                            }}
                                            aria-label="Responder"
                                        />
                                    </>
                                }
                            />

                            <Drawer
                                bodyClass="p-0"
                                title="Detalles de la conversación"
                                isOpen={isMobileDetailPanelOpen}
                                placement="right"
                                width={isMobile ? 340 : 420}
                                onClose={closeMobileDetailPanel}
                                onRequestClose={closeMobileDetailPanel}
                            >
                                <div className="flex h-full flex-col bg-white">
                                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                                        <div className="space-y-4">
                                            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div className="space-y-2">
                                                        <div className="text-sm text-gray-600">
                                                            {formatTitle(
                                                                selectedConversation.subject,
                                                            )}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
                                                            <Badge className="bg-slate-100 text-slate-700">
                                                                {titleCase(
                                                                    selectedConversation.scope,
                                                                )}
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
                                                            {titleCase(
                                                                selectedConversation.status,
                                                            )}
                                                        </span>
                                                        <span
                                                            className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-700"
                                                            data-testid="admin-conversation-control-mode"
                                                        >
                                                            {titleCase(
                                                                selectedConversation.controlMode,
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="mt-4 grid gap-3">
                                                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                                                        <div className="text-xs uppercase tracking-wide text-gray-400">
                                                            Cliente
                                                        </div>
                                                        <div className="mt-1 text-sm text-gray-700">
                                                            {selectedConversation.customer
                                                                ?.email ||
                                                                selectedConversation.customer
                                                                    ?.phoneNumber ||
                                                                'Sin datos vinculados'}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                                                        <div className="text-xs uppercase tracking-wide text-gray-400">
                                                            Canal origen
                                                        </div>
                                                        <div className="mt-1 text-sm text-gray-700">
                                                            {titleCase(
                                                                selectedConversation.channel,
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                                                        <div className="text-xs uppercase tracking-wide text-gray-400">
                                                            Buzón
                                                        </div>
                                                        <div className="mt-1 text-sm text-gray-700">
                                                            {selectedConversation
                                                                .inboxAccount
                                                                ?.displayName ||
                                                                selectedConversation
                                                                    .inboxAccount
                                                                    ?.address ||
                                                                selectedConversation.externalThreadId ||
                                                                'Webchat directo'}
                                                        </div>
                                                    </div>
                                                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                                                        <div className="text-xs uppercase tracking-wide text-gray-400">
                                                            Operador
                                                        </div>
                                                        <div className="mt-1 text-sm text-gray-700">
                                                            <span data-testid="admin-conversation-assignee">
                                                                {selectedConversation
                                                                    .assignedToUser
                                                                    ?.name ||
                                                                    selectedConversation
                                                                        .assignedToUser
                                                                        ?.email ||
                                                                    'Sin operador asignado'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="rounded-2xl border border-gray-200 bg-white p-3">
                                                        <div className="text-xs uppercase tracking-wide text-gray-400">
                                                            SLA operativo
                                                        </div>
                                                        <div className="mt-1 flex flex-wrap items-center gap-2">
                                                            <Badge
                                                                className={
                                                                    detailSlaMinutes !== null
                                                                        ? getSlaTone(
                                                                              detailSlaMinutes,
                                                                          )
                                                                        : 'bg-slate-100 text-slate-700'
                                                                }
                                                                data-testid="admin-conversation-sla-detail"
                                                            >
                                                                {detailSlaLabel}
                                                            </Badge>
                                                            {selectedQueueDiagnostics ? (
                                                                <span className="text-xs text-gray-500">
                                                                    Objetivo {selectedQueueDiagnostics.slaTargetMinutes}m · Prioridad {selectedQueueDiagnostics.priority}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-gray-500">
                                                                    Sin cola/SLA configurado
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                                <div className="mb-3">
                                                    <div className="text-sm font-semibold text-slate-800">
                                                        Gestión
                                                    </div>
                                                    <div className="mt-1 text-xs text-slate-500">
                                                        Último mensaje, handoff, asignación y control de AI.
                                                    </div>
                                                </div>
                                                {conversationManagementContent}
                                            </div>

                                            {toolCallsContent ? (
                                                <div className="rounded-2xl border border-violet-200 bg-white p-4">
                                                    {toolCallsContent}
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </Drawer>

                            <div
                                className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6 lg:py-5"
                                data-testid="admin-conversation-messages"
                                style={{
                                    backgroundImage:
                                        'radial-gradient(circle at top left, rgba(255,255,255,0.95), rgba(238,241,247,0.9) 38%, rgba(233,236,245,0.95) 100%)',
                                }}
                            >
                                <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-5">
                                    {selectedConversation.messages.length === 0 ? (
                                        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-8 text-center text-sm text-gray-500">
                                            No hay mensajes persistidos todavía.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {selectedConversation.messages.map((message) => {
                                                const deliveryStatus =
                                                    getMessageMetadataValue(
                                                        message.metadata,
                                                        'deliveryStatus',
                                                    )
                                                const provider =
                                                    getMessageMetadataValue(
                                                        message.metadata,
                                                        'provider',
                                                    )
                                                const latestTransportEvent =
                                                    message.transportEvents?.[0] ??
                                                    null

                                                return (
                                                    <div
                                                        key={message.id}
                                                        className={getMessageRowClassName(
                                                            message.authorType,
                                                            message.kind,
                                                        )}
                                                    >
                                                        <MessagingMessageBubble
                                                            className="w-full max-w-[44rem]"
                                                            toneClassName={toneByAuthor(
                                                                message.authorType,
                                                            )}
                                                            testId={`admin-conversation-message-${message.id}`}
                                                            headerLeft={titleCase(
                                                                message.authorType,
                                                            )}
                                                            headerRight={formatDateTime(
                                                                message.createdAt,
                                                            )}
                                                            badges={
                                                                <>
                                                                    <span>{titleCase(message.kind)}</span>
                                                                    {message.queue ? (
                                                                        <Badge className="bg-amber-100 text-amber-700">
                                                                            {message.queue.name}
                                                                        </Badge>
                                                                    ) : null}
                                                                    {deliveryStatus ? (
                                                                        <Badge className="bg-emerald-100 text-emerald-700">
                                                                            {titleCase(
                                                                                deliveryStatus,
                                                                            )}
                                                                        </Badge>
                                                                    ) : null}
                                                                    {provider ? (
                                                                        <Badge className="bg-slate-100 text-slate-700">
                                                                            {provider}
                                                                        </Badge>
                                                                    ) : null}
                                                                    {latestTransportEvent ? (
                                                                        <Badge className="bg-white text-slate-700">
                                                                            {getTransportEventStatus(
                                                                                latestTransportEvent.payload,
                                                                                latestTransportEvent.type,
                                                                            )}
                                                                        </Badge>
                                                                    ) : null}
                                                                </>
                                                            }
                                                            meta={
                                                                latestTransportEvent
                                                                    ? `Último evento: ${formatDateTime(
                                                                          latestTransportEvent.occurredAt,
                                                                      )}`
                                                                    : null
                                                            }
                                                            body={renderConversationMessageBody(
                                                                message,
                                                            )}
                                                        />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {!isMobile ? toolCallsContent : null}
                                </div>
                            </div>

                            <div className="shrink-0 border-t border-gray-200 bg-white px-4 py-4 lg:px-6">
                                <MessagingComposer
                                    value={replyDraft}
                                    onChange={(event) =>
                                        setReplyDraft(event.target.value)
                                    }
                                    placeholder="Escribe la respuesta para el cliente"
                                    inputTestId="admin-conversation-reply-input"
                                    submitTestId="admin-conversation-reply-submit"
                                    submitIcon={<HiOutlinePaperAirplane />}
                                    loading={actionLoading === 'reply'}
                                    disabled={!replyDraft.trim()}
                                    submitAriaLabel="Enviar respuesta"
                                    onSubmit={() =>
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
                                />
                            </div>
                        </div>
                    )}
                </div>
                }
            />
        </AdaptableCard>
    )
}

export default Conversations

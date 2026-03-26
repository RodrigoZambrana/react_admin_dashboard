import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Drawer from '@/components/ui/Drawer'
import Dialog from '@/components/ui/Dialog'
import Spinner from '@/components/ui/Spinner'
import { APP_PREFIX_PATH } from '@/constants/route.constant'
import useResponsive from '@/utils/hooks/useResponsive'
import { apiGetUsers } from '@/services/UsersService'
import ConversationsService, {
    type ConversationContact,
    type ConversationDetail,
    type ConversationQueueSummary,
    type InboxSummary,
    type ConversationSummary,
} from '@/services/ConversationsService'
import { apiGetCustomerDetails } from '@/services/CustomersService'
import { getTemplateAvatar } from './templateAssets'
import {
    TbMessage2Heart,
    TbUsersGroup,
    TbPhoneCall,
    TbSettings,
    TbPlus,
    TbDotsVertical,
    TbSearch,
    TbArrowLeft,
    TbInfoCircle,
    TbSend2,
    TbPhoto,
    TbFileDescription,
    TbMicrophone,
    TbMoodSmile,
    TbDownload,
    TbFolder,
    TbVideo,
    TbBrandFacebook,
    TbBrandInstagram,
    TbBrandLinkedin,
    TbBrandX,
    TbMailHeart,
    TbPhoneCheck,
    TbUserCheck,
    TbBrandHipchat,
    TbX,
    TbChecks,
    TbPinned,
    TbFilter,
    TbMessageReply,
    TbUserPlus,
    TbArrowsExchange,
    TbRobot,
    TbLayoutGrid,
    TbRefresh,
    TbSparkles,
} from 'react-icons/tb'
import './conversations-v2.css'

type ConversationAsset = {
    url: string
    fileName: string | null
    contentType: string | null
    size: number | null
    posterUrl?: string | null
}

type OperatorSummary = {
    id: number
    name: string
    email: string
}

type CustomerDetailSnapshot = {
    id: number
    name?: string
    firstName?: string
    lastName?: string
    email?: string | null
    phoneNumber?: string | null
    phoneNumbers?: string[]
    personalInfo?: {
        phoneNumber?: string | null
        phoneNumbers?: string[]
        location?: string | null
    } | null
    addresses?: Array<{
        id?: number
        label?: string | null
        street?: string | null
        number?: string | null
        corner?: string | null
        apartment?: string | null
        city?: string | null
        country?: string | null
        comments?: string | null
        isPrimary?: boolean
    }> | null
}

const formatDateTime = (value?: string | null) => {
    if (!value) return 'N/D'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('es-UY')
}

const formatListTime = (value?: string | null) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value

    const now = new Date()
    const sameDay = date.toDateString() === now.toDateString()
    if (sameDay) {
        return date.toLocaleTimeString('es-UY', {
            hour: '2-digit',
            minute: '2-digit',
        })
    }

    return date.toLocaleDateString('es-UY', {
        day: '2-digit',
        month: 'short',
    })
}

const formatTitle = (value?: string | null) => value || 'Sin asunto'

const titleCase = (value?: string | null) => {
    if (!value) return 'N/D'
    return value
        .split('_')
        .map((segment) =>
            segment ? segment[0].toUpperCase() + segment.slice(1) : segment,
        )
        .join(' ')
}

const getInboxSecondaryLabel = (inbox: InboxSummary) => {
    if (inbox.channel === 'email') {
        return inbox.address || 'Cuenta de correo'
    }

    return titleCase(inbox.channel)
}

const parseDateMs = (value?: string | null) => {
    if (!value) return 0
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
}

const buildReadStateAsRead = <
    T extends {
        lastMessageAt?: string | null
        latestMessage?: { createdAt?: string | null } | null
        readState?: {
            lastReadAt: string | null
            unreadCount: number
            isRead: boolean
            manualUnread: boolean
        }
    },
>(
    conversation: T,
) => {
    const lastReadAt =
        conversation.lastMessageAt ||
        conversation.latestMessage?.createdAt ||
        new Date().toISOString()

    return {
        ...conversation,
        readState: {
            lastReadAt,
            unreadCount: 0,
            isRead: true,
            manualUnread: false,
        },
    }
}

const getInitials = (value?: string | null) => {
    const normalized = value?.trim()
    if (!normalized) return 'NA'

    const parts = normalized
        .split(/\s+/)
        .map((segment) => segment.trim())
        .filter(Boolean)

    if (parts.length === 0) return 'NA'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
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

const colorByChannel = (channel: string) => {
    switch (channel) {
        case 'whatsapp':
            return '#16a34a'
        case 'instagram':
            return '#db2777'
        case 'messenger':
            return '#2563eb'
        case 'email':
            return '#ea580c'
        case 'webchat':
            return '#6338f6'
        default:
            return '#475569'
    }
}

const previewByConversation = (conversation: ConversationSummary) => {
    const latest = conversation.latestMessage
    if (!latest) return 'Sin mensajes todavía'
    if (latest.kind === 'image') return 'Imagen'
    if (latest.kind === 'audio') return 'Audio'
    if (latest.kind === 'attachment') return 'Adjunto'
    return latest.body || 'Mensaje sin texto'
}

const getConversationOwnerState = (conversation: ConversationSummary) => {
    if (conversation.controlMode === 'human') {
        return {
            label: conversation.assignedToUser?.name || 'Administrador',
            tone: 'admin' as const,
        }
    }

    return {
        label: 'Agente IA',
        tone: 'agent' as const,
    }
}

const getConversationAiStateBadge = (conversation: ConversationSummary) => {
    if (conversation.needsHuman || conversation.aiState?.needsHuman) {
        return {
            label: 'Requiere humano',
            tone: 'needs-human' as const,
        }
    }

    if (conversation.aiState?.grounded) {
        return {
            label:
                conversation.aiState.sourceCount > 0
                    ? `Grounded · ${conversation.aiState.sourceCount}`
                    : 'Grounded',
            tone: 'grounded' as const,
        }
    }

    return null
}

const getToolCallKind = (toolName: string) => {
    if (toolName.startsWith('search_')) {
        return {
            label: 'Prebúsqueda',
            tone: 'search' as const,
        }
    }

    if (
        [
            'update_order_status',
            'update_quote_status',
            'update_payment_status',
            'send_quote',
            'confirm_quote',
        ].includes(toolName)
    ) {
        return {
            label: 'Cambio de estado',
            tone: 'state' as const,
        }
    }

    if (toolName === 'parse_aberturas') {
        return {
            label: 'Parser',
            tone: 'parser' as const,
        }
    }

    return {
        label: 'CRUD',
        tone: 'crud' as const,
    }
}

const summarizeToolAudit = (toolCalls: ConversationDetail['toolCalls']) => {
    return toolCalls.reduce(
        (acc, toolCall) => {
            const kind = getToolCallKind(toolCall.toolName).tone
            acc.total += 1
            if (kind === 'search') {
                acc.search += 1
            } else if (kind === 'state') {
                acc.state += 1
            } else if (kind === 'parser') {
                acc.parser += 1
            } else {
                acc.crud += 1
            }
            return acc
        },
        { total: 0, search: 0, state: 0, parser: 0, crud: 0 },
    )
}

const buildConversationAuditBadges = (conversation: ConversationSummary) => {
    const audit = conversation.aiAudit
    if (!audit || audit.total === 0) {
        return []
    }

    return [
        audit.search
            ? { key: 'search', label: `${audit.search} prebúsqueda`, tone: 'search' }
            : null,
        audit.state
            ? { key: 'state', label: `${audit.state} estado`, tone: 'state' }
            : null,
        audit.parser
            ? { key: 'parser', label: `${audit.parser} parser`, tone: 'parser' }
            : null,
        audit.crud
            ? { key: 'crud', label: `${audit.crud} CRUD`, tone: 'crud' }
            : null,
    ].filter(Boolean) as Array<{ key: string; label: string; tone: string }>
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
        asString(asset.previewUrl)

    if (!url) {
        return null
    }

    return {
        url,
        fileName:
            asString(asset.fileName) ||
            asString(asset.filename) ||
            asString(asset.name),
        contentType:
            asString(asset.contentType) || asString(asset.mimeType) || null,
        size: asNumber(asset.size),
        posterUrl:
            asString(asset.posterUrl) ||
            asString(asset.poster) ||
            asString(asset.thumbnailUrl) ||
            null,
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

    const video =
        normalizeAsset(payloadRecord?.video) ||
        normalizeAsset(metadataRecord?.video) ||
        normalizeAsset(
            asString(payloadRecord?.videoUrl) || asString(metadataRecord?.videoUrl)
                ? {
                      url:
                          asString(payloadRecord?.videoUrl) ||
                          asString(metadataRecord?.videoUrl),
                      fileName:
                          asString(payloadRecord?.videoName) ||
                          asString(metadataRecord?.videoName),
                      contentType:
                          asString(payloadRecord?.videoContentType) ||
                          asString(metadataRecord?.videoContentType),
                      posterUrl:
                          asString(payloadRecord?.videoPosterUrl) ||
                          asString(metadataRecord?.videoPosterUrl),
                  }
                : null,
        )

    return { attachments, image, audio, video }
}

const formatBytes = (value: number | null) => {
    if (!value || value <= 0) return null
    if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(2)} MB`
    if (value >= 1024) return `${(value / 1024).toFixed(2)} KB`
    return `${value} B`
}

const formatCustomerAddress = (
    address:
        | CustomerDetailSnapshot['addresses'][number]
        | null
        | undefined,
) => {
    if (!address) return null

    const line1 = [address.street, address.number]
        .filter((value) => value && String(value).trim())
        .join(' ')
    const line2 = [address.city, address.country]
        .filter((value) => value && String(value).trim())
        .join(', ')
    const extra = [address.corner, address.apartment]
        .filter((value) => value && String(value).trim())
        .join(' · ')

    return [line1, line2, extra, address.comments]
        .filter((value) => value && String(value).trim())
        .join(' · ')
}

const drawerQuickActions = [
    { key: 'audio', label: 'Audio', icon: TbPhoneCall },
    { key: 'video', label: 'Video', icon: TbVideo },
    { key: 'chat', label: 'Chat', icon: TbBrandHipchat },
    { key: 'search', label: 'Buscar', icon: TbSearch },
]

const socialActions = [
    { key: 'facebook', label: 'Facebook', icon: TbBrandFacebook },
    { key: 'x', label: 'X', icon: TbBrandX },
    { key: 'instagram', label: 'Instagram', icon: TbBrandInstagram },
    { key: 'linkedin', label: 'LinkedIn', icon: TbBrandLinkedin },
]

const conversationStatusText = (conversation: ConversationSummary | ConversationDetail) => {
    if (conversation.status === 'open') {
        return 'En línea'
    }
    return titleCase(conversation.status)
}

const messageVariantByAuthor = (authorType: string) => {
    if (authorType === 'operator') return 'operator'
    if (authorType === 'agent') return 'agent'
    return 'customer'
}

const conversationScopeOptions = [
    { value: '', label: 'Todos los scopes' },
    { value: 'customer_public', label: 'Cliente' },
    { value: 'admin_internal', label: 'Interno' },
]

const conversationChannelOptions = [
    { value: '', label: 'Todos los canales' },
    { value: 'webchat', label: 'Webchat' },
    { value: 'whatsapp', label: 'WhatsApp' },
    { value: 'facebook', label: 'Facebook' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'admin_chat', label: 'Admin chat' },
]

const conversationStatusOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'open', label: 'Abierto' },
    { value: 'waiting_customer', label: 'Esperando cliente' },
    { value: 'waiting_internal', label: 'Esperando interno' },
    { value: 'closed', label: 'Cerrado' },
]

const sidebarChannelOptions = [
    { key: 'all', label: 'Inbox completo' },
    { key: 'webchat', label: 'Webchat' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'facebook', label: 'Facebook' },
    { key: 'instagram', label: 'Instagram' },
    { key: 'admin_chat', label: 'Chat interno' },
] as const

type ConversationListFilters = {
    scope: string
    channel: string
    status: string
    searchText: string
}

const defaultFilters: ConversationListFilters = {
    scope: '',
    channel: '',
    status: '',
    searchText: '',
}

const ConversationsV2 = () => {
    const { conversationId = '' } = useParams<{ conversationId?: string }>()
    const navigate = useNavigate()
    const responsive = useResponsive()
    const isMobile = responsive.smaller.lg

    const [items, setItems] = useState<ConversationSummary[]>([])
    const [inboxes, setInboxes] = useState<InboxSummary[]>([])
    const [queues, setQueues] = useState<ConversationQueueSummary[]>([])
    const [operators, setOperators] = useState<OperatorSummary[]>([])
    const [listLoading, setListLoading] = useState(true)
    const [listError, setListError] = useState<string | null>(null)
    const [selectedConversation, setSelectedConversation] =
        useState<ConversationDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [replyBody, setReplyBody] = useState('')
    const [replying, setReplying] = useState(false)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)
    const [isDirectoryOpen, setIsDirectoryOpen] = useState(false)
    const [isConversationMenuOpen, setIsConversationMenuOpen] = useState(false)
    const [menuConversationId, setMenuConversationId] = useState<string | null>(null)
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [isNewChatOpen, setIsNewChatOpen] = useState(false)
    const [filters, setFilters] = useState<ConversationListFilters>(defaultFilters)
    const [filterDraft, setFilterDraft] =
        useState<ConversationListFilters>(defaultFilters)
    const [creatingChat, setCreatingChat] = useState(false)
    const [selectedChannel, setSelectedChannel] = useState('all')
    const [selectedInboxId, setSelectedInboxId] = useState('all')
    const [isChatSearchOpen, setIsChatSearchOpen] = useState(false)
    const [chatSearch, setChatSearch] = useState('')
    const [handoffNotes, setHandoffNotes] = useState('')
    const [assignUserId, setAssignUserId] = useState('')
    const [overrideQueueSlug, setOverrideQueueSlug] = useState('')
    const [overrideUserId, setOverrideUserId] = useState('')
    const [actionLoading, setActionLoading] = useState<string | null>(null)
    const [contacts, setContacts] = useState<ConversationContact[]>([])
    const [contactsLoading, setContactsLoading] = useState(false)
    const [contactSearch, setContactSearch] = useState('')
    const [selectedContactKey, setSelectedContactKey] = useState('')
    const [newChatForm, setNewChatForm] = useState({
        message: '',
    })
    const [newChatError, setNewChatError] = useState<string | null>(null)
    const [bulkSelectionMode, setBulkSelectionMode] = useState(false)
    const [bulkSelectionIds, setBulkSelectionIds] = useState<string[]>([])
    const [customerProfile, setCustomerProfile] =
        useState<CustomerDetailSnapshot | null>(null)
    const [customerProfileLoading, setCustomerProfileLoading] = useState(false)
    const conversationButtonRefs = useRef<
        Record<string, HTMLButtonElement | null>
    >({})

    const isConversationPinned = useCallback(
        (conversationIdToCheck: string) =>
            items.find((item) => item.id === conversationIdToCheck)?.isPinned ??
            false,
        [items],
    )

    const getUnreadCount = useCallback(
        (conversationIdToCheck: string) =>
            items.find((item) => item.id === conversationIdToCheck)?.readState
                ?.unreadCount ?? 0,
        [items],
    )

    const getDisplayUnreadCount = useCallback(
        (conversation: ConversationSummary) => {
            const unreadCount = conversation.readState?.unreadCount ?? 0
            if (unreadCount > 0) {
                return unreadCount
            }

            if (conversation.readState?.manualUnread) {
                return 1
            }

            const latestCreatedAt = parseDateMs(
                conversation.latestMessage?.createdAt ?? conversation.lastMessageAt,
            )
            const lastReadAt = parseDateMs(conversation.readState?.lastReadAt)
            const latestAuthorType = conversation.latestMessage?.authorType ?? ''
            const isInboundLatest =
                latestAuthorType === 'customer' || latestAuthorType === 'agent'

            if (isInboundLatest && latestCreatedAt > lastReadAt) {
                return 1
            }

            return 0
        },
        [],
    )

    const renderAvatar = useCallback(
        ({
            seed,
            label,
            size,
            borderColor,
            className,
            preferInitials = false,
            inset = 6,
        }: {
            seed: string
            label: string
            size: number
            borderColor?: string
            className?: string
            preferInitials?: boolean
            inset?: number
        }) => {
            const src = preferInitials ? null : getTemplateAvatar(seed)
            const initials = getInitials(label)

            return (
                <div
                    className={`conversation-avatar-shell ${className ?? ''}`.trim()}
                    aria-label={label}
                    style={{
                        width: size,
                        height: size,
                        minWidth: size,
                        borderColor: borderColor || '#edeff5',
                    }}
                >
                    {src ? (
                        <img
                            src={src}
                            alt={label}
                            className="conversation-avatar-image"
                            style={{ width: size - inset, height: size - inset }}
                        />
                    ) : (
                        <span className="conversation-avatar-initials">
                            {initials}
                        </span>
                    )}
                </div>
            )
        },
        [],
    )

    const loadList = useCallback(
        async (searchValue = search) => {
            setListLoading(true)
            setListError(null)
            try {
                const [response, inboxResponse, queueResponse, usersResponse] =
                    await Promise.all([
                    ConversationsService.fetchConversations({
                        page: 1,
                        pageSize: 50,
                        search: searchValue.trim() || undefined,
                        scope: filters.scope || undefined,
                        channel: filters.channel || undefined,
                        status: filters.status || undefined,
                    }),
                    ConversationsService.fetchInboxes(),
                    ConversationsService.fetchQueues(),
                    apiGetUsers<OperatorSummary[]>(),
                ])
                setItems(response.items)
                setInboxes(inboxResponse)
                setQueues(queueResponse)
                setOperators(usersResponse.data ?? [])

                if (!isMobile && !conversationId && response.items[0]) {
                    navigate(`/app/crm/conversations/${response.items[0].id}`, {
                        replace: true,
                    })
                }
            } catch (error) {
                console.error(error)
                setListError('No fue posible cargar conversaciones.')
            } finally {
                setListLoading(false)
            }
        },
        [
            conversationId,
            filters.channel,
            filters.scope,
            filters.status,
            isMobile,
            navigate,
            search,
        ],
    )

    const loadConversation = useCallback(async (id: string) => {
        setDetailLoading(true)
        setDetailError(null)
        try {
            const response = await ConversationsService.fetchConversation(id)
            setSelectedConversation(response)
        } catch (error) {
            console.error(error)
            setSelectedConversation(null)
            setDetailError('No fue posible cargar la conversación seleccionada.')
        } finally {
            setDetailLoading(false)
        }
    }, [])

    useEffect(() => {
        if (selectedChannel === 'email') {
            setSelectedChannel('all')
        }
    }, [selectedChannel])

    useEffect(() => {
        if (filters.channel === 'email') {
            setFilters((previous) => ({ ...previous, channel: '' }))
        }
        if (filterDraft.channel === 'email') {
            setFilterDraft((previous) => ({ ...previous, channel: '' }))
        }
    }, [filterDraft.channel, filters.channel])

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            void loadList(search)
        }, 220)
        return () => window.clearTimeout(timeout)
    }, [filters, loadList, search])

    useEffect(() => {
        if (!conversationId) {
            setSelectedConversation(null)
            return
        }
        void loadConversation(conversationId)
    }, [conversationId, loadConversation])

    const hasActiveFilters = useMemo(
        () => Boolean(filters.scope || filters.channel || filters.status),
        [filters.channel, filters.scope, filters.status],
    )
    const channelCounts = useMemo(() => {
        return items.reduce<Record<string, number>>((accumulator, conversation) => {
            accumulator[conversation.channel] =
                (accumulator[conversation.channel] ?? 0) + 1
            return accumulator
        }, {})
    }, [items])
    const visibleItems = useMemo(() => {
        return items
            .filter((conversation) => {
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
            .sort((left, right) => {
                const leftPinned = isConversationPinned(left.id) ? 1 : 0
                const rightPinned = isConversationPinned(right.id) ? 1 : 0
                if (leftPinned !== rightPinned) {
                    return rightPinned - leftPinned
                }

                const leftActivity = parseDateMs(left.lastMessageAt ?? left.updatedAt)
                const rightActivity = parseDateMs(right.lastMessageAt ?? right.updatedAt)
                if (leftActivity !== rightActivity) {
                    return rightActivity - leftActivity
                }

                return left.id.localeCompare(right.id)
            })
    }, [isConversationPinned, items, selectedChannel, selectedInboxId])
    const recentVisibleChats = useMemo(() => visibleItems.slice(0, 8), [visibleItems])
    const menuConversation = useMemo(
        () => items.find((conversation) => conversation.id === menuConversationId) ?? null,
        [items, menuConversationId],
    )
    const selectedContact = useMemo(
        () => contacts.find((contact) => contact.key === selectedContactKey) ?? null,
        [contacts, selectedContactKey],
    )
    const selectedCount = bulkSelectionIds.length
    const filteredMessages = useMemo(() => {
        if (!selectedConversation) {
            return []
        }

        const query = chatSearch.trim().toLowerCase()
        if (!query) {
            return selectedConversation.messages
        }

        return selectedConversation.messages.filter((message) => {
            const body = `${message.body ?? ''} ${message.normalizedText ?? ''}`.toLowerCase()
            return body.includes(query)
        })
    }, [chatSearch, selectedConversation])
    const selectedQueueDiagnostics = useMemo(
        () =>
            queues.find(
                (queue) =>
                    queue.slug ===
                    (overrideQueueSlug || selectedConversation?.queue?.slug),
            ) ?? null,
        [overrideQueueSlug, queues, selectedConversation?.queue?.slug],
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
    const detailSlaLabel =
        detailSlaMinutes === null || !selectedQueueDiagnostics
            ? 'Sin SLA calculado'
            : detailSlaMinutes >= selectedQueueDiagnostics.slaTargetMinutes
              ? `SLA vencido por ${Math.max(
                    detailSlaMinutes - selectedQueueDiagnostics.slaTargetMinutes,
                    0,
                )}m`
              : `Vence en ${Math.max(
                    selectedQueueDiagnostics.slaTargetMinutes - detailSlaMinutes,
                    0,
                )}m`
    const customerDisplayName =
        [customerProfile?.firstName, customerProfile?.lastName]
            .filter(Boolean)
            .join(' ') ||
        customerProfile?.name ||
        selectedConversation?.customer?.name ||
        (selectedConversation
            ? getConversationDisplayTitle(selectedConversation)
            : 'Sin participante')
    const customerPhones = Array.from(
        new Set(
            [
                ...(customerProfile?.phoneNumbers ?? []),
                ...(customerProfile?.personalInfo?.phoneNumbers ?? []),
                customerProfile?.phoneNumber ?? null,
                customerProfile?.personalInfo?.phoneNumber ?? null,
                selectedConversation?.customer?.phoneNumber ?? null,
            ].filter(
                (value): value is string =>
                    typeof value === 'string' && value.trim().length > 0,
            ),
        ),
    )
    const primaryAddress =
        customerProfile?.addresses?.find((address) => address?.isPrimary) ??
        customerProfile?.addresses?.[0] ??
        null
    const customerLocation =
        customerProfile?.personalInfo?.location ||
        formatCustomerAddress(primaryAddress) ||
        null

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
        if (!selectedConversation) {
            return
        }

        if (
            selectedConversation.readState?.unreadCount > 0 &&
            !selectedConversation.readState?.manualUnread
        ) {
            void ConversationsService.markConversationRead(selectedConversation.id)
                .then((detail) => {
                    setSelectedConversation(detail)
                    setItems((current) =>
                        current.map((item) => (item.id === detail.id ? detail : item)),
                    )
                })
                .catch((error) => {
                    console.error(error)
                })
        }
    }, [selectedConversation])

    useEffect(() => {
        if (!bulkSelectionMode) {
            if (bulkSelectionIds.length > 0) {
                setBulkSelectionIds([])
            }
            return
        }

        setBulkSelectionIds((current) =>
            current.filter((conversationIdToKeep) =>
                items.some((conversation) => conversation.id === conversationIdToKeep),
            ),
        )
    }, [bulkSelectionIds.length, bulkSelectionMode, items])

    useEffect(() => {
        const customerId = selectedConversation?.customer?.id
        if (!customerId) {
            setCustomerProfile(null)
            setCustomerProfileLoading(false)
            return
        }

        let cancelled = false
        setCustomerProfileLoading(true)

        void apiGetCustomerDetails<CustomerDetailSnapshot, { id: string }>({
            id: String(customerId),
        })
            .then((response) => {
                if (cancelled) {
                    return
                }
                setCustomerProfile(response.data ?? null)
            })
            .catch((error) => {
                console.error(error)
                if (!cancelled) {
                    setCustomerProfile(null)
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setCustomerProfileLoading(false)
                }
            })

        return () => {
            cancelled = true
        }
    }, [selectedConversation?.customer?.id])

    const renderMessageBody = useCallback(
        (
            message: NonNullable<ConversationDetail>['messages'][number],
            authorType: string,
        ) => {
            const body = message.body || message.normalizedText || ''
            const assets = getMessageAssets(message.payload, message.metadata)
            const bodyColorClass =
                authorType === 'operator' ? 'text-white/90' : 'text-slate-700'

            const attachmentNodes = assets.attachments.map((attachment) => (
                <div
                    className="file-attach"
                    key={`${attachment.url}:${attachment.fileName ?? ''}`}
                    data-testid={`admin-conversation-attachment-${message.id}`}
                >
                    <span className="file-icon">
                        <TbFileDescription size={20} />
                    </span>
                    <div className="min-w-0 flex-1 overflow-hidden">
                        <div className="truncate text-sm font-semibold text-slate-900">
                            {attachment.fileName || 'Adjunto'}
                        </div>
                        <div className="truncate text-xs text-slate-500">
                            {attachment.contentType || 'Archivo'}
                            {attachment.size ? ` · ${formatBytes(attachment.size)}` : ''}
                        </div>
                    </div>
                    <a
                        className="download-icon"
                        href={attachment.url}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <TbDownload size={18} />
                    </a>
                </div>
            ))

            return (
                <div className={bodyColorClass}>
                    {body ? <div className="message-text">{body}</div> : null}
                    {assets.image ? (
                        <a
                            href={assets.image.url}
                            target="_blank"
                            rel="noreferrer"
                            data-testid={`admin-conversation-image-${message.id}`}
                        >
                            <img
                                className="message-image"
                                src={assets.image.url}
                                alt={assets.image.fileName || 'Imagen'}
                            />
                        </a>
                    ) : null}
                    {assets.audio ? (
                        <div
                            className="message-audio mt-3"
                            data-testid={`admin-conversation-audio-${message.id}`}
                        >
                            <audio controls src={assets.audio.url}>
                                <track kind="captions" />
                                Tu navegador no soporta audio embebido.
                            </audio>
                        </div>
                    ) : null}
                    {assets.video ? (
                        <div
                            className="message-video mt-3"
                            data-testid={`admin-conversation-video-${message.id}`}
                        >
                            <video
                                controls
                                poster={assets.video.posterUrl || undefined}
                                src={assets.video.url}
                            >
                                <track kind="captions" />
                                Tu navegador no soporta video embebido.
                            </video>
                        </div>
                    ) : null}
                    {attachmentNodes}
                </div>
            )
        },
        [],
    )

    useEffect(() => {
        if (!conversationId) {
            if (isMobile) {
                return
            }
            if (visibleItems[0]) {
                navigate(`/app/crm/conversations/${visibleItems[0].id}`, {
                    replace: true,
                })
            }
            return
        }

        if (
            visibleItems.length > 0 &&
            !visibleItems.some((conversation) => conversation.id === conversationId)
        ) {
            navigate(`/app/crm/conversations/${visibleItems[0].id}`, {
                replace: true,
            })
        }
    }, [conversationId, isMobile, navigate, visibleItems])

    useEffect(() => {
        if (!conversationId || listLoading) {
            return
        }

        const activeButton = conversationButtonRefs.current[conversationId]
        if (!activeButton) {
            return
        }

        const frame = window.requestAnimationFrame(() => {
            activeButton.scrollIntoView({
                block: 'nearest',
                inline: 'nearest',
                behavior: 'auto',
            })
        })

        return () => window.cancelAnimationFrame(frame)
    }, [conversationId, listLoading, visibleItems])

    const handleSelectConversation = (id: string) => {
        if (bulkSelectionMode) {
            setBulkSelectionIds((current) =>
                current.includes(id)
                    ? current.filter((entry) => entry !== id)
                    : [...current, id],
            )
            return
        }

        const targetConversation =
            items.find((conversation) => conversation.id === id) ?? null

        if (targetConversation && getDisplayUnreadCount(targetConversation) > 0) {
            const optimisticConversation = buildReadStateAsRead(targetConversation)
            setItems((current) =>
                current.map((conversation) =>
                    conversation.id === id ? optimisticConversation : conversation,
                ),
            )

            if (selectedConversation?.id === id) {
                setSelectedConversation((current) =>
                    current ? buildReadStateAsRead(current) : current,
                )
            }

            void ConversationsService.markConversationRead(id)
                .then((detail) => {
                    syncConversation(detail)
                })
                .catch((error) => {
                    console.error(error)
                    void loadList()
                })
        }

        navigate(`/app/crm/conversations/${id}`)
    }

    const handleBulkOwnerAction = useCallback(
        async (mode: 'takeover' | 'release') => {
            if (bulkSelectionIds.length === 0) {
                return
            }

            setActionLoading(mode === 'takeover' ? 'bulk-takeover' : 'bulk-release')
            try {
                await Promise.all(
                    bulkSelectionIds.map((conversationIdToUpdate) =>
                        mode === 'takeover'
                            ? ConversationsService.takeoverConversation(
                                  conversationIdToUpdate,
                                  handoffNotes.trim() || undefined,
                              )
                            : ConversationsService.releaseConversation(
                                  conversationIdToUpdate,
                                  handoffNotes.trim() || undefined,
                              ),
                    ),
                )
                setBulkSelectionIds([])
                setBulkSelectionMode(false)
                await loadList(search)
                if (conversationId) {
                    await loadConversation(conversationId)
                }
            } catch (error) {
                console.error(error)
            } finally {
                setActionLoading(null)
            }
        },
        [bulkSelectionIds, conversationId, handoffNotes, loadConversation, loadList, search],
    )

    const handleReply = async () => {
        if (!selectedConversation || !replyBody.trim()) {
            return
        }
        setReplying(true)
        try {
            const updated = await ConversationsService.replyToConversation(
                selectedConversation.id,
                replyBody.trim(),
            )
            setSelectedConversation(updated)
            setReplyBody('')
            await loadList()
        } catch (error) {
            console.error(error)
        } finally {
            setReplying(false)
        }
    }

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
            onSuccess?: (detail: ConversationDetail) => void,
        ) => {
            setActionLoading(actionId)
            try {
                const detail = await action()
                syncConversation(detail)
                setHandoffNotes('')
                onSuccess?.(detail)
            } catch (error) {
                console.error(error)
            } finally {
                setActionLoading(null)
            }
        },
        [syncConversation],
    )

    const focusReplyInput = useCallback(() => {
        const input = document.querySelector<HTMLInputElement>(
            '[data-testid="admin-conversation-reply-input"]',
        )
        input?.focus()
    }, [])

    const handleApplyFilters = async () => {
        setFilters(filterDraft)
        setSearch(filterDraft.searchText)
        setIsFilterOpen(false)
    }

    const handleResetFilters = async () => {
        setFilterDraft(defaultFilters)
        setFilters(defaultFilters)
        setSearch('')
        setIsFilterOpen(false)
    }

    const handleCreateNewChat = async () => {
        const selectedContact =
            contacts.find((contact) => contact.key === selectedContactKey) ?? null
        const message = newChatForm.message.trim()

        if (!selectedContact) {
            setNewChatError('Selecciona un contacto para iniciar el mensaje.')
            return
        }

        setCreatingChat(true)
        setNewChatError(null)

        try {
            const created = await ConversationsService.startConversationFromContact({
                contactType: selectedContact.kind,
                customerId: selectedContact.customerId,
                message: message || undefined,
            })

            setIsNewChatOpen(false)
            setSelectedContactKey('')
            setContactSearch('')
            setNewChatForm({ message: '' })
            await loadList(search)
            navigate(`/app/crm/conversations/${created.id}`)
        } catch (error) {
            console.error(error)
            setNewChatError('No fue posible iniciar el mensaje.')
        } finally {
            setCreatingChat(false)
        }
    }

    const openFilters = () => {
        setFilterDraft({
            ...filters,
            searchText: search,
        })
        setIsFilterOpen(true)
    }

    const openNewMessage = () => {
        setIsNewChatOpen(true)
        setNewChatError(null)
        setContactSearch('')
        setSelectedContactKey('')
        setNewChatForm({ message: '' })
    }

    const selectChannel = (channel: string, options?: { closeDirectory?: boolean }) => {
        setSelectedChannel(channel)
        setSelectedInboxId('all')
        if (channel !== 'all' && selectedInboxId !== 'all') {
            const selectedInbox = inboxes.find((item) => item.id === selectedInboxId)
            if (selectedInbox && selectedInbox.channel !== channel) {
                setSelectedInboxId('all')
            }
        }
        if (options?.closeDirectory) {
            setIsDirectoryOpen(false)
            if (isMobile) {
                navigate(`${APP_PREFIX_PATH}/crm/conversations`)
            }
        }
    }

    const selectInbox = (
        inboxId: string,
        channel?: string,
        options?: { closeDirectory?: boolean },
    ) => {
        if (channel) {
            setSelectedChannel(channel)
        }
        setSelectedInboxId(inboxId)
        if (options?.closeDirectory) {
            setIsDirectoryOpen(false)
            if (isMobile) {
                navigate(`${APP_PREFIX_PATH}/crm/conversations`)
            }
        }
    }

    const openInboxDestination = (inbox: InboxSummary) => {
        if (inbox.channel === 'email') {
            setIsDirectoryOpen(false)
            navigate(
                `${APP_PREFIX_PATH}/crm/mail/inbox?account=${encodeURIComponent(
                    inbox.id,
                )}`,
            )
            return
        }

        selectInbox(inbox.id, inbox.channel, { closeDirectory: true })
    }

    const openConversationMenu = (conversationId: string) => {
        setMenuConversationId(conversationId)
        setIsConversationMenuOpen(true)
    }

    useEffect(() => {
        if (!isNewChatOpen) {
            return
        }

        let cancelled = false
        setContactsLoading(true)

        const timeout = window.setTimeout(() => {
            void ConversationsService.fetchContacts({
                search: contactSearch.trim() || undefined,
                limit: 40,
            })
                .then((response) => {
                    if (cancelled) {
                        return
                    }
                    setContacts(response.items)
                    setSelectedContactKey((previous) => {
                        if (
                            previous &&
                            response.items.some((contact) => contact.key === previous)
                        ) {
                            return previous
                        }
                        return response.items[0]?.key ?? ''
                    })
                })
                .catch((error) => {
                    console.error(error)
                    if (!cancelled) {
                        setContacts([])
                    }
                })
                .finally(() => {
                    if (!cancelled) {
                        setContactsLoading(false)
                    }
                })
        }, 180)

        return () => {
            cancelled = true
            window.clearTimeout(timeout)
        }
    }, [contactSearch, isNewChatOpen])

    const conversationManagementContent = selectedConversation ? (
        <div className="management-stack">
            {selectedConversation.latestMessage ? (
                <div className="management-block">
                    <div className="management-label">Último mensaje</div>
                    <div className="management-value">
                        {formatDateTime(
                            selectedConversation.lastMessageAt ||
                                selectedConversation.latestMessage.createdAt,
                        )}
                    </div>
                </div>
            ) : null}

            <div className="management-block">
                <div className="management-label">Notas operativas</div>
                <input
                    className="management-input"
                    data-testid="admin-conversation-handoff-notes"
                    value={handoffNotes}
                    onChange={(event) => setHandoffNotes(event.target.value)}
                    placeholder="Notas para takeover, release u override"
                />
            </div>

            <div className="management-block">
                <div className="management-label">Asignar operador</div>
                <div className="management-grid">
                    <select
                        className="management-input"
                        value={assignUserId}
                        onChange={(event) => setAssignUserId(event.target.value)}
                    >
                        <option value="">Seleccionar operador</option>
                        {operators.map((operator) => (
                            <option key={operator.id} value={String(operator.id)}>
                                {operator.name || operator.email}
                            </option>
                        ))}
                    </select>
                    <button
                        className="drawer-primary-btn"
                        type="button"
                        disabled={!assignUserId.trim() || actionLoading === 'assign'}
                        onClick={() =>
                            void runAction('assign', () =>
                                ConversationsService.assignConversation(
                                    selectedConversation.id,
                                    Number(assignUserId),
                                    handoffNotes.trim() || undefined,
                                ),
                            )
                        }
                    >
                        Asignar
                    </button>
                </div>
            </div>

            <div className="management-block">
                <div className="management-label">Override supervisor</div>
                <div className="management-grid management-grid-stacked">
                    <select
                        className="management-input"
                        value={overrideQueueSlug}
                        onChange={(event) => setOverrideQueueSlug(event.target.value)}
                    >
                        <option value="">Mantener cola actual</option>
                        {queues.map((queue) => (
                            <option key={queue.id} value={queue.slug}>
                                {queue.name}
                            </option>
                        ))}
                    </select>
                    <select
                        className="management-input"
                        value={overrideUserId}
                        onChange={(event) => setOverrideUserId(event.target.value)}
                    >
                        <option value="">Auto / mantener operador</option>
                        {operators.map((operator) => (
                            <option key={operator.id} value={String(operator.id)}>
                                {operator.name || operator.email}
                            </option>
                        ))}
                    </select>
                    <button
                        className="drawer-secondary-btn"
                        type="button"
                        disabled={actionLoading === 'reroute'}
                        onClick={() =>
                            void runAction('reroute', () =>
                                ConversationsService.rerouteConversation(
                                    selectedConversation.id,
                                    {
                                        queueSlug: overrideQueueSlug.trim() || undefined,
                                        userId: overrideUserId.trim()
                                            ? Number(overrideUserId)
                                            : undefined,
                                        notes: handoffNotes.trim() || 'Override supervisor',
                                    },
                                ),
                            )
                        }
                    >
                        Aplicar override
                    </button>
                </div>
            </div>

            <div className="management-actions">
                <button
                    className="drawer-primary-btn"
                    type="button"
                    data-testid="admin-conversation-takeover"
                    disabled={actionLoading === 'takeover'}
                    onClick={() =>
                        void runAction('takeover', () =>
                            ConversationsService.takeoverConversation(
                                selectedConversation.id,
                                handoffNotes.trim() || undefined,
                            ),
                        )
                    }
                >
                    Tomar control
                </button>
                <button
                    className="drawer-secondary-btn"
                    type="button"
                    data-testid="admin-conversation-release"
                    disabled={actionLoading === 'release'}
                    onClick={() =>
                        void runAction('release', () =>
                            ConversationsService.releaseConversation(
                                selectedConversation.id,
                                handoffNotes.trim() || undefined,
                            ),
                        )
                    }
                >
                    Liberar a IA
                </button>
            </div>
        </div>
    ) : null

    const rail = (
        <div className="sidebar-menu">
            <button
                className="logo-mark"
                type="button"
                aria-label="Mensajes"
                onClick={() => navigate(`${APP_PREFIX_PATH}/crm/conversations`)}
            >
                AI
            </button>
            <div className="menu-wrap">
                <div className="main-menu">
                    <ul className="nav" role="tablist">
                        <li title="Chats">
                            <button
                                className="menu-icon-btn is-active"
                                type="button"
                                aria-label="Chats"
                                data-testid="admin-conversations-rail-chats"
                            >
                                <TbMessage2Heart size={24} />
                            </button>
                        </li>
                        <li title="Nuevo mensaje">
                            <button
                                className="menu-icon-btn"
                                type="button"
                                aria-label="Nuevo mensaje"
                                data-testid="admin-conversations-rail-new"
                                onClick={openNewMessage}
                            >
                                <TbPlus size={24} />
                            </button>
                        </li>
                        <li title="Canales e inboxes">
                            <button
                                className="menu-icon-btn"
                                type="button"
                                aria-label="Canales e inboxes"
                                data-testid="admin-conversations-rail-directory"
                                onClick={() => setIsDirectoryOpen(true)}
                            >
                                <TbUsersGroup size={24} />
                            </button>
                        </li>
                        <li title="Inbox de correo">
                            <button
                                className="menu-icon-btn"
                                type="button"
                                aria-label="Inbox de correo"
                                data-testid="admin-conversations-rail-mail"
                                onClick={() => navigate(`${APP_PREFIX_PATH}/crm/mail`)}
                            >
                                <TbMailHeart size={24} />
                            </button>
                        </li>
                        <li title="Actualizar mensajes">
                            <button
                                className="menu-icon-btn"
                                type="button"
                                aria-label="Actualizar mensajes"
                                data-testid="admin-conversations-rail-refresh"
                                onClick={() => void loadList()}
                            >
                                <TbRefresh size={24} />
                            </button>
                        </li>
                    </ul>
                </div>
                <div className="profile-menu">
                    <ul>
                        <li title="Filtros">
                            <button
                                className="menu-icon-btn"
                                type="button"
                                aria-label="Filtros"
                                data-testid="admin-conversations-rail-filters"
                                onClick={openFilters}
                            >
                                <TbFilter size={24} />
                            </button>
                        </li>
                        <li title="Configuración IA">
                            <button
                                className="menu-icon-btn"
                                type="button"
                                aria-label="Configuración IA"
                                data-testid="admin-conversations-rail-settings"
                                onClick={() => navigate(`${APP_PREFIX_PATH}/settings/ai`)}
                            >
                                <TbSettings size={24} />
                            </button>
                        </li>
                        <li title="Menú general">
                            <button
                                className="menu-icon-btn"
                                type="button"
                                aria-label="Menú general"
                                data-testid="admin-conversations-rail-general"
                                onClick={() => navigate(`${APP_PREFIX_PATH}/crm/customers`)}
                            >
                                <TbLayoutGrid size={24} />
                            </button>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    )

    const mobileBottomNav = (
        <div className="messaging-mobile-nav-wrap">
            <div className="messaging-mobile-nav-spacer" aria-hidden="true" />
            <nav
                className="messaging-mobile-nav"
                data-testid="admin-conversations-mobile-nav"
            >
                <button
                    type="button"
                    className={`messaging-mobile-nav-btn ${!conversationId ? 'is-active' : ''}`}
                    onClick={() => navigate(`${APP_PREFIX_PATH}/crm/conversations`)}
                >
                    <TbMessage2Heart size={22} />
                    <span>Chats</span>
                </button>
                <button
                    type="button"
                    className="messaging-mobile-nav-btn"
                    onClick={openNewMessage}
                >
                    <TbPlus size={22} />
                    <span>Nuevo</span>
                </button>
                <button
                    type="button"
                    className={`messaging-mobile-nav-btn ${isDirectoryOpen ? 'is-active' : ''}`}
                    onClick={() => setIsDirectoryOpen(true)}
                >
                    <TbUsersGroup size={22} />
                    <span>Canales</span>
                </button>
                <button
                    type="button"
                    className={`messaging-mobile-nav-btn ${isFilterOpen ? 'is-active' : ''}`}
                    onClick={openFilters}
                >
                    <TbFilter size={22} />
                    <span>Filtros</span>
                </button>
                <button
                    type="button"
                    className="messaging-mobile-nav-btn"
                    onClick={() => navigate(`${APP_PREFIX_PATH}/crm/customers`)}
                >
                    <TbLayoutGrid size={22} />
                    <span>General</span>
                </button>
            </nav>
        </div>
    )

    const sidebar = (
        <div
            className="sidebar-content"
            data-testid="admin-conversations-sidebar"
        >
            <div className="chat-search-header">
                <div className="header-title">
                    <h4>Mensajes</h4>
                    <div className="header-actions">
                        <button
                            className="header-action-btn is-primary"
                            type="button"
                            aria-label="Nuevo mensaje"
                            data-testid="admin-conversations-new-chat"
                            onClick={openNewMessage}
                        >
                            <TbPlus size={18} />
                        </button>
                        <button
                            className="header-action-btn"
                            type="button"
                            aria-label="Más opciones"
                            onClick={() => void loadList()}
                        >
                            <TbDotsVertical size={18} />
                        </button>
                    </div>
                </div>
                <div className="search-wrap">
                    <div className="input-group">
                        <input
                            type="text"
                            data-testid="admin-conversations-search-input"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Buscar contactos o mensajes"
                        />
                        <span className="input-group-text">
                            <TbSearch size={18} />
                        </span>
                    </div>
                </div>
            </div>

            <div className="top-online-contacts">
                <div className="top-online-contacts-header">
                    <h5>Recientes</h5>
                    <button className="header-action-btn" type="button" aria-label="Más recientes">
                        <TbDotsVertical size={18} />
                    </button>
                </div>
                <div className="recent-chat-strip">
                    {recentVisibleChats.map((conversation) => {
                        const title = getConversationDisplayTitle(conversation)
                        const color = colorByChannel(conversation.channel)
                        const isPinned = isConversationPinned(conversation.id)
                        return (
                            <button
                                className={`chat-status ${isPinned ? 'is-pinned' : ''}`}
                                key={`recent-${conversation.id}`}
                                type="button"
                                data-testid={`admin-conversation-recent-${conversation.id}`}
                                onClick={() => handleSelectConversation(conversation.id)}
                            >
                                <div className="recent-chat-avatar-wrap">
                                    {renderAvatar({
                                        seed: conversation.id,
                                        label: title,
                                        size: 58,
                                        inset: 0,
                                        className: 'recent-chat-avatar',
                                        borderColor: `${color}30`,
                                        preferInitials:
                                            conversation.scope === 'admin_internal',
                                    })}
                                    {isPinned ? (
                                        <span
                                            className="recent-chat-pin"
                                            data-testid={`admin-conversation-pin-badge-${conversation.id}`}
                                        >
                                            <TbPinned size={12} />
                                        </span>
                                    ) : null}
                                </div>
                                <p>{title}</p>
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="sidebar-body" data-testid="admin-conversations-list">
                <div className="sidebar-body-header">
                    <h5 className="chat-title">
                        {bulkSelectionMode
                            ? `${selectedCount} seleccionados`
                            : 'Conversaciones'}
                    </h5>
                    <div className="header-actions">
                        <button
                            className={`header-action-btn ${bulkSelectionMode ? 'is-active-filter' : ''}`}
                            type="button"
                            aria-label="Selección masiva"
                            data-testid="admin-conversations-bulk-toggle"
                            onClick={() => {
                                setBulkSelectionMode((previous) => !previous)
                                setBulkSelectionIds([])
                            }}
                        >
                            <TbChecks size={18} />
                        </button>
                        <button
                            className={`header-action-btn ${hasActiveFilters ? 'is-active-filter' : ''}`}
                            type="button"
                            aria-label="Filtros"
                            onClick={openFilters}
                        >
                            <TbFilter size={18} />
                        </button>
                    </div>
                </div>
                {bulkSelectionMode ? (
                    <div className="bulk-actions-bar" data-testid="admin-conversations-bulk-bar">
                        <button
                            className="drawer-primary-btn"
                            type="button"
                            data-testid="admin-conversations-bulk-takeover"
                            disabled={selectedCount === 0 || actionLoading === 'bulk-takeover'}
                            onClick={() => void handleBulkOwnerAction('takeover')}
                        >
                            Tomar control
                        </button>
                        <button
                            className="drawer-secondary-btn"
                            type="button"
                            data-testid="admin-conversations-bulk-release"
                            disabled={selectedCount === 0 || actionLoading === 'bulk-release'}
                            onClick={() => void handleBulkOwnerAction('release')}
                        >
                            Volver a IA
                        </button>
                    </div>
                ) : null}
                {listLoading ? (
                    <div className="empty-state">
                        <Spinner size={28} />
                    </div>
                ) : listError ? (
                    <div className="empty-state">{listError}</div>
                ) : visibleItems.length === 0 ? (
                    <div className="empty-state">No hay conversaciones disponibles.</div>
                ) : (
                    <div className="chat-users-wrap">
                        {visibleItems.map((conversation) => {
                            const title = getConversationDisplayTitle(conversation)
                            const isActive = conversation.id === conversationId
                            const preview = previewByConversation(conversation)
                            const unreadCount = getDisplayUnreadCount(conversation)
                            const isPinned = isConversationPinned(conversation.id)
                            const ownerState = getConversationOwnerState(conversation)
                            const aiStateBadge =
                                getConversationAiStateBadge(conversation)
                            const auditBadges =
                                buildConversationAuditBadges(conversation)
                            const isSelectedForBulk = bulkSelectionIds.includes(
                                conversation.id,
                            )
                            const previewIcon =
                                conversation.latestMessage?.kind === 'image' ? (
                                    <TbPhoto size={14} />
                                ) : conversation.latestMessage?.kind === 'audio' ? (
                                    <TbMicrophone size={14} />
                                ) : conversation.latestMessage?.kind === 'attachment' ? (
                                    <TbFileDescription size={14} />
                                ) : null

                            return (
                                <div className="chat-list" key={conversation.id}>
                                    {bulkSelectionMode ? (
                                        <button
                                            className={`chat-select-toggle ${isSelectedForBulk ? 'is-selected' : ''}`}
                                            type="button"
                                            data-testid={`admin-conversation-bulk-toggle-${conversation.id}`}
                                            aria-label={
                                                isSelectedForBulk
                                                    ? 'Quitar de selección'
                                                    : 'Agregar a selección'
                                            }
                                            onClick={() =>
                                                setBulkSelectionIds((current) =>
                                                    current.includes(conversation.id)
                                                        ? current.filter(
                                                              (entry) =>
                                                                  entry !== conversation.id,
                                                          )
                                                        : [...current, conversation.id],
                                                )
                                            }
                                        >
                                            <TbChecks size={16} />
                                        </button>
                                    ) : null}
                                    <button
                                        className={`chat-user-list ${isActive ? 'is-active' : ''} ${unreadCount > 0 ? 'is-unread' : ''} ${isPinned ? 'is-pinned' : ''} ${isSelectedForBulk ? 'is-bulk-selected' : ''}`}
                                        type="button"
                                        data-testid={`admin-conversation-${conversation.id}`}
                                        aria-current={isActive ? 'true' : undefined}
                                        ref={(node) => {
                                            conversationButtonRefs.current[conversation.id] = node
                                        }}
                                        onClick={() => handleSelectConversation(conversation.id)}
                                    >
                                        <div className="me-2">
                                            {renderAvatar({
                                                seed: conversation.id,
                                                label: title,
                                                size: 52,
                                                borderColor: `${colorByChannel(conversation.channel)}24`,
                                            })}
                                        </div>
                                        <div className="chat-user-info">
                                            <div className="chat-user-msg">
                                                <h6>{title}</h6>
                                                <div className="chat-user-owner-row">
                                                    <span
                                                        className={`conversation-owner-pill is-${ownerState.tone}`}
                                                        data-testid={`admin-conversation-owner-${conversation.id}`}
                                                    >
                                                        {ownerState.label}
                                                    </span>
                                                    {aiStateBadge ? (
                                                        <span
                                                            className={`conversation-owner-pill is-${aiStateBadge.tone}`}
                                                            data-testid={`admin-conversation-ai-state-${conversation.id}`}
                                                        >
                                                            {aiStateBadge.label}
                                                        </span>
                                                    ) : null}
                                                </div>
                                                {auditBadges.length ? (
                                                    <div className="chat-user-audit-row">
                                                        {auditBadges.map((badge) => (
                                                            <span
                                                                key={`${conversation.id}-${badge.key}`}
                                                                className={`tool-audit-pill is-${badge.tone}`}
                                                                data-testid={`admin-conversation-audit-${badge.key}-${conversation.id}`}
                                                            >
                                                                {badge.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : null}
                                                <p>
                                                    {previewIcon}
                                                    <span>{preview}</span>
                                                </p>
                                            </div>
                                            <div className="chat-user-time">
                                                <span className="time">
                                                    {formatListTime(
                                                        conversation.lastMessageAt ||
                                                            conversation.updatedAt,
                                                    )}
                                                </span>
                                                <div className="chat-pin">
                                                    {isPinned ? (
                                                        <TbPinned
                                                            size={14}
                                                            data-testid={`admin-conversation-pin-indicator-${conversation.id}`}
                                                        />
                                                    ) : null}
                                                    {unreadCount > 0 ? (
                                                        <span
                                                            className="count-message"
                                                            data-testid={`admin-conversation-unread-count-${conversation.id}`}
                                                        >
                                                            {unreadCount > 9
                                                                ? '9+'
                                                                : unreadCount}
                                                        </span>
                                                    ) : (
                                                        <TbChecks
                                                            size={16}
                                                            className="chat-read-icon"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        className="chat-dropdown-btn"
                                        type="button"
                                        aria-label="Acciones del chat"
                                        data-testid={`admin-conversation-menu-open-${conversation.id}`}
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            openConversationMenu(conversation.id)
                                        }}
                                    >
                                        <TbDotsVertical size={18} />
                                    </button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )

    const detail = (
        <div className="chat chat-messages show" id="middle" data-testid="admin-conversation-detail">
            {!conversationId ? (
                <div className="empty-state">Selecciona una conversación para ver el detalle.</div>
            ) : detailLoading ? (
                <div className="empty-state">
                    <Spinner size={32} />
                </div>
            ) : detailError ? (
                <div className="empty-state">{detailError}</div>
            ) : !selectedConversation ? (
                <div className="empty-state">La conversación seleccionada no está disponible.</div>
            ) : (
                <>
                    <div className="chat-stage">
                        <div className="chat-header">
                            <div className="user-details">
                                {isMobile ? (
                                    <button
                                        className="header-action-btn"
                                        type="button"
                                        aria-label="Volver a la lista"
                                        onClick={() => navigate('/app/crm/conversations')}
                                    >
                                        <TbArrowLeft size={20} />
                                    </button>
                                ) : null}
                                <div
                                    style={{
                                        marginLeft: isMobile ? 8 : 0,
                                    }}
                                >
                                    {renderAvatar({
                                        seed: selectedConversation.id,
                                        label: getConversationDisplayTitle(
                                            selectedConversation,
                                        ),
                                        size: 48,
                                        borderColor: `${colorByChannel(selectedConversation.channel)}24`,
                                        preferInitials:
                                            selectedConversation.scope === 'admin_internal',
                                    })}
                                </div>
                                <div className="ms-2 overflow-hidden">
                                    <h6 data-testid="admin-conversation-detail-title">
                                        {getConversationDisplayTitle(selectedConversation)}
                                    </h6>
                                    <div className="conversation-header-meta">
                                        <span className="last-seen">
                                            {conversationStatusText(selectedConversation)}
                                        </span>
                                        <span
                                            className={`conversation-owner-pill is-${getConversationOwnerState(selectedConversation).tone}`}
                                            data-testid="admin-conversation-owner-current"
                                        >
                                            {getConversationOwnerState(selectedConversation).label}
                                        </span>
                                        {getConversationAiStateBadge(
                                            selectedConversation,
                                        ) ? (
                                            <span
                                                className={`conversation-owner-pill is-${getConversationAiStateBadge(selectedConversation)?.tone}`}
                                                data-testid="admin-conversation-ai-state-current"
                                            >
                                                {
                                                    getConversationAiStateBadge(
                                                        selectedConversation,
                                                    )?.label
                                                }
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                            <div className="chat-options">
                                <ul>
                                    <li>
                                        <button
                                            type="button"
                                            aria-label="Buscar"
                                            className={
                                                isChatSearchOpen ? 'is-active-search' : ''
                                            }
                                            onClick={() =>
                                                setIsChatSearchOpen((previous) => !previous)
                                            }
                                        >
                                            <TbSearch size={20} />
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            type="button"
                                            aria-label="Detalles"
                                            data-testid="admin-conversation-details-open"
                                            onClick={() => setIsDetailsOpen(true)}
                                        >
                                            <TbInfoCircle size={20} />
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            type="button"
                                            aria-label="Más opciones"
                                            onClick={() =>
                                                openConversationMenu(selectedConversation.id)
                                            }
                                        >
                                            <TbDotsVertical size={20} />
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        {isChatSearchOpen ? (
                            <div className="chat-search search-wrap contact-search">
                                <form
                                    onSubmit={(event) => {
                                        event.preventDefault()
                                    }}
                                >
                                    <div className="input-group">
                                        <input
                                            type="text"
                                            value={chatSearch}
                                            onChange={(event) =>
                                                setChatSearch(event.target.value)
                                            }
                                        placeholder="Buscar en el chat"
                                        />
                                        <span className="input-group-text">
                                            <TbSearch size={18} />
                                        </span>
                                    </div>
                                </form>
                            </div>
                        ) : null}
                        <div className="chat-body chat-page-group" data-testid="admin-conversation-messages">
                            <div className="messages">
                                {filteredMessages.map((message) => {
                                    const isRight =
                                        message.authorType === 'operator' ||
                                        message.authorType === 'agent'
                                    const authorLabel =
                                        message.authorType === 'operator'
                                            ? 'Administrador'
                                            : titleCase(message.authorType)
                                    const messageVariant = messageVariantByAuthor(
                                        message.authorType,
                                    )
                                    return (
                                        <div
                                            className={`chats ${isRight ? 'chats-right' : ''}`}
                                            key={message.id}
                                            data-testid={`admin-conversation-message-${message.id}`}
                                        >
                                            <div className="chat-avatar">
                                                {renderAvatar({
                                                    seed: `${selectedConversation.id}:${message.authorType}`,
                                                    label: authorLabel,
                                                    size: 40,
                                                    preferInitials:
                                                        message.authorType ===
                                                            'operator' ||
                                                        message.authorType ===
                                                            'agent',
                                                    borderColor:
                                                        messageVariant === 'customer'
                                                            ? '#e5e7eb'
                                                            : messageVariant ===
                                                                  'agent'
                                                              ? '#dbeafe'
                                                              : '#e9d5ff',
                                                })}
                                            </div>
                                            <div className="chat-content">
                                                <div
                                                    className={`chat-profile-name ${isRight ? 'text-end' : ''}`}
                                                >
                                                    <h6>
                                                        {authorLabel}
                                                        <span className="chat-time">
                                                            {formatDateTime(message.createdAt)}
                                                        </span>
                                                    </h6>
                                                </div>
                                                <div className="chat-info">
                                                    {!isRight ? (
                                                        <div className="chat-actions">
                                                            <button type="button" aria-label="Más opciones">
                                                                <TbDotsVertical size={18} />
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                    <div
                                                        className={`message-content message-content-${messageVariant}`}
                                                    >
                                                        {renderMessageBody(
                                                            message,
                                                            message.authorType,
                                                        )}
                                                    </div>
                                                    {isRight ? (
                                                        <div className="chat-actions">
                                                            <button type="button" aria-label="Más opciones">
                                                                <TbDotsVertical size={18} />
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="chat-footer">
                        <form
                            className="footer-form"
                            onSubmit={(event) => {
                                event.preventDefault()
                                void handleReply()
                            }}
                        >
                            <div className="chat-footer-wrap">
                                <div className="form-item">
                                    <button
                                        className="action-circle"
                                        type="button"
                                        aria-label="Audio"
                                    >
                                        <TbMicrophone size={18} />
                                    </button>
                                </div>
                                <div className="form-wrap">
                                    <input
                                        className="form-control"
                                        data-testid="admin-conversation-reply-input"
                                        type="text"
                                        value={replyBody}
                                        onChange={(event) => setReplyBody(event.target.value)}
                                        placeholder="Escribe tu respuesta"
                                        disabled={replying || !selectedConversation}
                                    />
                                </div>
                                <div className="form-item emoj-action-foot">
                                    <button
                                        className="action-circle"
                                        type="button"
                                        aria-label="Emoji"
                                    >
                                        <TbMoodSmile size={18} />
                                    </button>
                                </div>
                                <div className="form-item position-relative d-flex items-center justify-center">
                                    <button
                                        className="action-circle file-action"
                                        type="button"
                                        aria-label="Adjuntar"
                                    >
                                        <TbFolder size={18} />
                                    </button>
                                </div>
                                <div className="form-item">
                                    <button
                                        className="more-action-btn"
                                        type="button"
                                        aria-label="Más acciones"
                                    >
                                        <TbDotsVertical size={18} />
                                    </button>
                                </div>
                                <div className="form-btn">
                                    <button
                                        className="send-btn"
                                        type="submit"
                                        data-testid="admin-conversation-reply-submit"
                                        aria-label="Enviar"
                                        disabled={replying || !replyBody.trim()}
                                    >
                                        <TbSend2 size={20} />
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </>
            )}
        </div>
    )

    return (
        <AdaptableCard
            className="h-full min-h-0 overflow-hidden"
            bodyClass="p-0 h-full absolute inset-0 flex min-h-0 min-w-0 overflow-hidden"
            data-testid="admin-conversations-page"
        >
            <div className="crm-conversations-v2 h-full w-full">
                <div className="main-chat-blk">
                    {isMobile ? (
                        conversationId ? (
                            <>
                                {detail}
                                {mobileBottomNav}
                            </>
                        ) : (
                            <>
                                <div className="mobile-list-screen">{sidebar}</div>
                                {mobileBottomNav}
                            </>
                        )
                    ) : (
                        <>
                            {rail}
                            {sidebar}
                            {detail}
                        </>
                    )}
                </div>
                <Drawer
                    bodyClass="p-0"
                    title={null}
                    isOpen={isDirectoryOpen}
                    placement="left"
                    width={360}
                    onClose={() => setIsDirectoryOpen(false)}
                    onRequestClose={() => setIsDirectoryOpen(false)}
                >
                    <div className="crm-conversations-v2 conversation-directory-drawer">
                        <div className="offcanvas-header">
                            <h4>Canales e inboxes</h4>
                            <button
                                className="offcanvas-close"
                                type="button"
                                onClick={() => setIsDirectoryOpen(false)}
                                aria-label="Cerrar menú"
                            >
                                <TbX size={18} />
                            </button>
                        </div>
                        <div className="offcanvas-body">
                            <div className="directory-block">
                                <div className="directory-label">Canales</div>
                                <div
                                    className="directory-list"
                                    data-testid="admin-conversations-channels"
                                >
                                    {sidebarChannelOptions.map((channel) => {
                                        const isActive = selectedChannel === channel.key
                                        const count =
                                            channel.key === 'all'
                                                ? items.length
                                                : (channelCounts[channel.key] ?? 0)
                                        return (
                                            <button
                                                key={channel.key}
                                                type="button"
                                                className={`directory-item ${isActive ? 'is-active' : ''}`}
                                                data-testid={`admin-conversations-channel-${channel.key}`}
                                                onClick={() =>
                                                    selectChannel(channel.key, {
                                                        closeDirectory: true,
                                                    })
                                                }
                                            >
                                                <div className="directory-item-copy">
                                                    <span>{channel.label}</span>
                                                    <small>
                                                        {channel.key === 'all'
                                                            ? 'Todas las conversaciones'
                                                            : `Canal ${channel.label.toLowerCase()}`}
                                                    </small>
                                                </div>
                                                <span className="directory-count">{count}</span>
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <div className="directory-block">
                                <div className="directory-label">Inboxes</div>
                                <div
                                    className="directory-list"
                                    data-testid="admin-conversations-inboxes"
                                >
                                    <button
                                        type="button"
                                        className={`directory-item ${selectedInboxId === 'all' ? 'is-active' : ''}`}
                                        data-testid="admin-conversations-inbox-all"
                                        onClick={() =>
                                            selectInbox('all', undefined, {
                                                closeDirectory: true,
                                            })
                                        }
                                    >
                                        <div className="directory-item-copy">
                                            <span>Inbox completo</span>
                                            <small>Vista consolidada multicanal</small>
                                        </div>
                                        <span className="directory-count">{items.length}</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`directory-item ${selectedInboxId === 'virtual:webchat' ? 'is-active' : ''}`}
                                        data-testid="admin-conversations-inbox-virtual-webchat"
                                        onClick={() =>
                                            selectInbox('virtual:webchat', 'webchat', {
                                                closeDirectory: true,
                                            })
                                        }
                                    >
                                        <div className="directory-item-copy">
                                            <span>Webchat directo</span>
                                            <small>Conversaciones web sin inbox asociado</small>
                                        </div>
                                        <span className="directory-count">
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
                                        <div className="directory-empty">
                                            Sin buzones configurados
                                        </div>
                                    ) : (
                                        inboxes.map((inbox) => {
                                            const count = items.filter(
                                                (item) => item.inboxAccount?.id === inbox.id,
                                            ).length
                                            return (
                                                <button
                                                    key={inbox.id}
                                                    type="button"
                                                    className={`directory-item ${selectedInboxId === inbox.id ? 'is-active' : ''}`}
                                                    data-testid={`admin-conversations-inbox-${inbox.id}`}
                                                    onClick={() =>
                                                        openInboxDestination(inbox)
                                                    }
                                                >
                                                    <div className="directory-item-copy">
                                                        <span>
                                                            {inbox.displayName ||
                                                                inbox.address ||
                                                                titleCase(inbox.channel)}
                                                        </span>
                                                        <small>
                                                            {getInboxSecondaryLabel(inbox)}
                                                        </small>
                                                    </div>
                                                    <span className="directory-count">
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
                </Drawer>
                <Drawer
                    bodyClass="p-0"
                    title={null}
                    isOpen={isFilterOpen}
                    placement="right"
                    width={360}
                    onClose={() => setIsFilterOpen(false)}
                    onRequestClose={() => setIsFilterOpen(false)}
                >
                    <div className="crm-conversations-v2 conversation-config-drawer">
                        <div className="offcanvas-header">
                            <h4>Filtrar chats</h4>
                            <button
                                className="offcanvas-close"
                                type="button"
                                onClick={() => setIsFilterOpen(false)}
                                aria-label="Cerrar filtros"
                            >
                                <TbX size={18} />
                            </button>
                        </div>
                        <div className="offcanvas-body">
                            <div className="conversation-filter-form">
                                <div className="filter-field">
                                    <label htmlFor="conversation-filter-search">
                                        Texto
                                    </label>
                                    <input
                                        id="conversation-filter-search"
                                        data-testid="admin-conversations-filter-search"
                                        type="text"
                                        value={filterDraft.searchText}
                                        onChange={(event) =>
                                            setFilterDraft((previous) => ({
                                                ...previous,
                                                searchText: event.target.value,
                                            }))
                                        }
                                        placeholder="Buscar por contacto, asunto o mensaje"
                                    />
                                </div>
                                <div className="filter-field">
                                    <label htmlFor="conversation-filter-scope">Scope</label>
                                    <select
                                        id="conversation-filter-scope"
                                        data-testid="admin-conversations-filter-scope"
                                        value={filterDraft.scope}
                                        onChange={(event) =>
                                            setFilterDraft((previous) => ({
                                                ...previous,
                                                scope: event.target.value,
                                            }))
                                        }
                                    >
                                        {conversationScopeOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="filter-field">
                                    <label htmlFor="conversation-filter-channel">Canal</label>
                                    <select
                                        id="conversation-filter-channel"
                                        data-testid="admin-conversations-filter-channel"
                                        value={filterDraft.channel}
                                        onChange={(event) =>
                                            setFilterDraft((previous) => ({
                                                ...previous,
                                                channel: event.target.value,
                                            }))
                                        }
                                    >
                                        {conversationChannelOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="filter-field">
                                    <label htmlFor="conversation-filter-status">Estado</label>
                                    <select
                                        id="conversation-filter-status"
                                        data-testid="admin-conversations-filter-status"
                                        value={filterDraft.status}
                                        onChange={(event) =>
                                            setFilterDraft((previous) => ({
                                                ...previous,
                                                status: event.target.value,
                                            }))
                                        }
                                    >
                                        {conversationStatusOptions.map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="filter-actions">
                                    <button
                                        className="drawer-secondary-btn"
                                        type="button"
                                        data-testid="admin-conversations-filter-reset"
                                        onClick={() => void handleResetFilters()}
                                    >
                                        Limpiar
                                    </button>
                                    <button
                                        className="drawer-primary-btn"
                                        type="button"
                                        data-testid="admin-conversations-filter-apply"
                                        onClick={() => void handleApplyFilters()}
                                    >
                                        Aplicar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </Drawer>
                <Drawer
                    bodyClass="p-0"
                    title={null}
                    isOpen={isConversationMenuOpen}
                    placement="right"
                    width={360}
                    onClose={() => setIsConversationMenuOpen(false)}
                    onRequestClose={() => setIsConversationMenuOpen(false)}
                >
                    <div className="crm-conversations-v2 conversation-directory-drawer">
                        <div className="offcanvas-header">
                            <h4>Acciones del chat</h4>
                            <button
                                className="offcanvas-close"
                                type="button"
                                onClick={() => setIsConversationMenuOpen(false)}
                                aria-label="Cerrar acciones"
                            >
                                <TbX size={18} />
                            </button>
                        </div>
                        <div className="offcanvas-body">
                            {menuConversation ? (
                                <div className="directory-block">
                                    <div className="directory-card">
                                        <div className="directory-card-title">
                                            {getConversationDisplayTitle(menuConversation)}
                                        </div>
                                        <div className="directory-card-copy">
                                            {formatTitle(menuConversation.subject)}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="directory-item"
                                        data-testid={`admin-conversation-menu-call-${menuConversation.id}`}
                                        onClick={() => {
                                            handleSelectConversation(menuConversation.id)
                                            setIsConversationMenuOpen(false)
                                            window.setTimeout(() => {
                                                focusReplyInput()
                                            }, 0)
                                        }}
                                    >
                                        <span className="directory-action-label">
                                            <TbMessageReply size={16} />
                                            Responder
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className="directory-item"
                                        data-testid={`admin-conversation-menu-video-${menuConversation.id}`}
                                        onClick={() => {
                                            handleSelectConversation(menuConversation.id)
                                            setIsConversationMenuOpen(false)
                                            setIsDetailsOpen(true)
                                        }}
                                    >
                                        <span className="directory-action-label">
                                            <TbInfoCircle size={16} />
                                            Ver detalles
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className="directory-item"
                                        onClick={() => {
                                            handleSelectConversation(menuConversation.id)
                                            setIsConversationMenuOpen(false)
                                        }}
                                    >
                                        <span className="directory-action-label">
                                            <TbPhoneCall size={16} />
                                            Llamada
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className="directory-item"
                                        onClick={() => {
                                            handleSelectConversation(menuConversation.id)
                                            setIsConversationMenuOpen(false)
                                        }}
                                    >
                                        <span className="directory-action-label">
                                            <TbVideo size={16} />
                                            Videollamada
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className="directory-item"
                                        data-testid={`admin-conversation-menu-pin-${menuConversation.id}`}
                                        onClick={async () => {
                                            const updated = isConversationPinned(
                                                menuConversation.id,
                                            )
                                                ? await ConversationsService.unpinConversation(
                                                      menuConversation.id,
                                                  )
                                                : await ConversationsService.pinConversation(
                                                      menuConversation.id,
                                                  )
                                            syncConversation(updated)
                                            setIsConversationMenuOpen(false)
                                        }}
                                    >
                                        <span className="directory-action-label">
                                            <TbPinned size={16} />
                                            {isConversationPinned(menuConversation.id)
                                                ? 'Quitar fijado'
                                                : 'Fijar chat'}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className="directory-item"
                                        data-testid={`admin-conversation-menu-read-toggle-${menuConversation.id}`}
                                        onClick={async () => {
                                            const updated =
                                                getUnreadCount(menuConversation.id) > 0
                                                    ? await ConversationsService.markConversationRead(
                                                          menuConversation.id,
                                                      )
                                                    : await ConversationsService.markConversationUnread(
                                                          menuConversation.id,
                                                      )
                                            syncConversation(updated)
                                            setIsConversationMenuOpen(false)
                                        }}
                                    >
                                        <span className="directory-action-label">
                                            <TbChecks size={16} />
                                            {getUnreadCount(menuConversation.id) > 0
                                                ? 'Marcar como leído'
                                                : 'Marcar como no leído'}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className="directory-item"
                                        onClick={() => {
                                            handleSelectConversation(menuConversation.id)
                                            setIsConversationMenuOpen(false)
                                            void runAction('takeover', () =>
                                                ConversationsService.takeoverConversation(
                                                    menuConversation.id,
                                                ),
                                            )
                                        }}
                                    >
                                        <span className="directory-action-label">
                                            <TbUserPlus size={16} />
                                            Tomar control
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className="directory-item"
                                        onClick={() => {
                                            handleSelectConversation(menuConversation.id)
                                            setIsConversationMenuOpen(false)
                                            void runAction('release', () =>
                                                ConversationsService.releaseConversation(
                                                    menuConversation.id,
                                                ),
                                            )
                                        }}
                                    >
                                        <span className="directory-action-label">
                                            <TbRobot size={16} />
                                            Liberar a IA
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        className="directory-item"
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(
                                                menuConversation.id,
                                            )
                                            setIsConversationMenuOpen(false)
                                        }}
                                    >
                                        <span className="directory-action-label">
                                            <TbArrowsExchange size={16} />
                                            Copiar ID de conversación
                                        </span>
                                    </button>
                                </div>
                            ) : (
                                <div className="directory-empty">
                                    Sin conversación seleccionada.
                                </div>
                            )}
                        </div>
                    </div>
                </Drawer>
                <Dialog
                    isOpen={isNewChatOpen}
                    onRequestClose={() => setIsNewChatOpen(false)}
                    onClose={() => setIsNewChatOpen(false)}
                    shouldCloseOnEsc
                    shouldCloseOnOverlayClick
                    contentClassName="conversation-modal"
                    width={520}
                >
                    <div className="crm-conversations-v2 conversation-modal-content">
                        <div className="conversation-modal-header">
                            <div>
                                <h4>Nuevo mensaje</h4>
                                <p>
                                    Selecciona un contacto para iniciar o retomar una
                                    conversación, incluida la IA operativa.
                                </p>
                            </div>
                        </div>
                        <div className="conversation-modal-body">
                            <div className="filter-field">
                                <label htmlFor="new-chat-contact-search">
                                    Buscar contacto
                                </label>
                                <input
                                    id="new-chat-contact-search"
                                    data-testid="admin-conversations-contact-search"
                                    type="text"
                                    value={contactSearch}
                                    onChange={(event) =>
                                        setContactSearch(event.target.value)
                                    }
                                    placeholder="Buscar clientes o IA"
                                />
                            </div>
                            <div
                                className="conversation-contact-list"
                                data-testid="admin-conversations-contact-list"
                            >
                                {contactsLoading ? (
                                    <div className="directory-empty">
                                        Cargando contactos...
                                    </div>
                                ) : contacts.length === 0 ? (
                                    <div className="directory-empty">
                                        No hay contactos disponibles.
                                    </div>
                                ) : (
                                    contacts.map((contact) => (
                                        <button
                                            key={contact.key}
                                            type="button"
                                            className={`conversation-contact-option ${selectedContactKey === contact.key ? 'is-active' : ''}`}
                                            data-testid={`admin-conversations-contact-${contact.key.replace(/[^a-zA-Z0-9_-]/g, '-')}`}
                                            onClick={() =>
                                                setSelectedContactKey(contact.key)
                                            }
                                        >
                                            <div className="conversation-contact-avatar">
                                                {renderAvatar({
                                                    seed: contact.label,
                                                    label: contact.label,
                                                    size: 44,
                                                    preferInitials:
                                                        contact.kind === 'internal',
                                                })}
                                            </div>
                                            <div className="conversation-contact-copy">
                                                <strong>{contact.label}</strong>
                                                <span>
                                                    {contact.description ||
                                                        (contact.kind === 'internal'
                                                            ? 'Contacto interno'
                                                            : 'Sin descripción')}
                                                </span>
                                            </div>
                                            <div className="conversation-contact-meta">
                                                <small>
                                                    {contact.conversationId
                                                        ? 'Existente'
                                                        : 'Nuevo'}
                                                </small>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                            <div className="filter-field">
                                <label htmlFor="new-chat-message">Primer mensaje</label>
                                <textarea
                                    id="new-chat-message"
                                    data-testid="admin-conversations-message-body"
                                    value={newChatForm.message}
                                    onChange={(event) =>
                                        setNewChatForm((previous) => ({
                                            ...previous,
                                            message: event.target.value,
                                        }))
                                    }
                                    placeholder={
                                        selectedContact?.conversationId
                                            ? 'Escribe una respuesta o deja vacío para abrir la conversación'
                                            : 'Escribe el primer mensaje para iniciar el chat'
                                    }
                                    rows={5}
                                />
                            </div>
                            {newChatError ? (
                                <div className="conversation-modal-error">{newChatError}</div>
                            ) : null}
                        </div>
                        <div className="conversation-modal-footer">
                            <button
                                className="drawer-secondary-btn"
                                type="button"
                                onClick={() => setIsNewChatOpen(false)}
                                disabled={creatingChat}
                            >
                                Cancelar
                            </button>
                            <button
                                className="drawer-primary-btn"
                                type="button"
                                data-testid="admin-conversations-start-message"
                                onClick={() => void handleCreateNewChat()}
                                disabled={creatingChat}
                            >
                                {creatingChat
                                    ? 'Abriendo...'
                                    : selectedContact?.conversationId
                                      ? 'Abrir conversación'
                                      : 'Iniciar mensaje'}
                            </button>
                        </div>
                    </div>
                </Dialog>
                <Drawer
                    bodyClass="p-0"
                    title={null}
                    isOpen={isDetailsOpen}
                    placement="right"
                    width={380}
                    onClose={() => setIsDetailsOpen(false)}
                    onRequestClose={() => setIsDetailsOpen(false)}
                >
                    <div className="crm-conversations-v2 details-panel">
                        {selectedConversation ? (
                            <div className="chat-offcanvas">
                                <div className="offcanvas-header">
                                    <h4>Detalles del contacto</h4>
                                    <button
                                        className="offcanvas-close"
                                        type="button"
                                        onClick={() => setIsDetailsOpen(false)}
                                        aria-label="Cerrar detalles"
                                    >
                                        <TbX size={18} />
                                    </button>
                                </div>
                                <div className="offcanvas-body">
                                    <div className="chat-contact-info">
                                        <div className="profile-content">
                                            <div className="contact-profile-info">
                                                <div className="contact-profile-avatar mb-2">
                                                    {renderAvatar({
                                                        seed: selectedConversation.id,
                                                        label: customerDisplayName,
                                                        size: 96,
                                                        inset: 8,
                                                        borderColor: `${colorByChannel(selectedConversation.channel)}24`,
                                                        preferInitials:
                                                            selectedConversation.scope ===
                                                            'admin_internal',
                                                    })}
                                                </div>
                                                <h6>{customerDisplayName}</h6>
                                                <p>
                                                    Última actividad{' '}
                                                    {formatDateTime(
                                                        selectedConversation.lastMessageAt ||
                                                            selectedConversation.updatedAt,
                                                    )}
                                                </p>
                                            </div>

                                            <div className="action-grid">
                                                {drawerQuickActions.map((action) => {
                                                    const Icon = action.icon
                                                    return (
                                                        <button
                                                            key={action.key}
                                                            className="action-wrap"
                                                            type="button"
                                                            aria-label={action.label}
                                                        >
                                                            <Icon size={16} />
                                                            <p>{action.label}</p>
                                                        </button>
                                                    )
                                                })}
                                            </div>

                                            <div className="content-wrapper">
                                                <h5 className="sub-title">Perfil</h5>
                                                <div className="card">
                                                    <div className="card-body">
                                                        <ul className="profile-item">
                                                            <li className="list-group-item">
                                                                <div className="profile-info">
                                                                    <h6>Nombre</h6>
                                                                    <p>{customerDisplayName}</p>
                                                                </div>
                                                                <div className="profile-icon">
                                                                    <TbUserCheck size={18} />
                                                                </div>
                                                            </li>
                                                            <li className="list-group-item">
                                                                <div className="info">
                                                                    <h6>Correo</h6>
                                                                    <p>
                                                                        {customerProfileLoading
                                                                            ? 'Cargando...'
                                                                            : customerProfile
                                                                                  ?.email ||
                                                                              selectedConversation
                                                                                  .customer
                                                                                  ?.email ||
                                                                              'Sin email'}
                                                                    </p>
                                                                </div>
                                                                <div className="icon">
                                                                    <TbMailHeart size={18} />
                                                                </div>
                                                            </li>
                                                            <li className="list-group-item">
                                                                <div className="info">
                                                                    <h6>Teléfono</h6>
                                                                    <p>
                                                                        {customerProfileLoading
                                                                            ? 'Cargando...'
                                                                            : customerPhones[0] ||
                                                                              'Sin teléfono'}
                                                                    </p>
                                                                </div>
                                                                <div className="icon">
                                                                    <TbPhoneCheck size={18} />
                                                                </div>
                                                            </li>
                                                            <li className="list-group-item">
                                                                <div className="info">
                                                                    <h6>Ubicación</h6>
                                                                    <p>
                                                                        {customerProfileLoading
                                                                            ? 'Cargando...'
                                                                            : customerLocation ||
                                                                              'Sin ubicación'}
                                                                    </p>
                                                                </div>
                                                                <div className="icon">
                                                                    <TbInfoCircle size={18} />
                                                                </div>
                                                            </li>
                                                            <li className="list-group-item">
                                                                <div className="info">
                                                                    <h6>Contexto</h6>
                                                                    <p>
                                                                        {formatTitle(
                                                                            selectedConversation.subject,
                                                                        )}
                                                                    </p>
                                                                </div>
                                                                <div className="icon">
                                                                    <TbInfoCircle size={18} />
                                                                </div>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="content-wrapper">
                                                <h5 className="sub-title">Perfiles sociales</h5>
                                                <div className="card">
                                                    <div className="card-body">
                                                        <div className="social-icon">
                                                            {socialActions.map((action) => {
                                                                const Icon = action.icon
                                                                return (
                                                                    <button
                                                                        key={action.key}
                                                                        type="button"
                                                                        aria-label={action.label}
                                                                    >
                                                                        <Icon size={16} />
                                                                    </button>
                                                                )
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="content-wrapper">
                                                <h5 className="sub-title">Actividad y operación</h5>
                                                <div className="card">
                                                    <div className="card-body">
                                                        <div className="document-item">
                                                            <div className="document-icon">
                                                                <TbFileDescription size={20} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <h6>
                                                                    {selectedConversation
                                                                        .messages.length}{' '}
                                                                    mensajes
                                                                </h6>
                                                                <p>
                                                                    Canal{' '}
                                                                    {titleCase(
                                                                        selectedConversation.channel,
                                                                    )}
                                                                </p>
                                                            </div>
                                                            <span className="download-icon">
                                                                <TbDotsVertical size={16} />
                                                            </span>
                                                        </div>
                                                        <div className="document-item">
                                                        <div className="document-icon">
                                                            <TbFolder size={20} />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <h6>
                                                                    {selectedConversation.queue
                                                                        ?.name || 'Sin cola'}
                                                                </h6>
                                                                <p>
                                                                    Operador:{' '}
                                                                    <span data-testid="admin-conversation-assignee">
                                                                        {selectedConversation
                                                                            .assignedToUser
                                                                            ?.name ||
                                                                            selectedConversation
                                                                                .assignedToUser
                                                                                ?.email ||
                                                                            'Sin asignar'}
                                                                    </span>
                                                                </p>
                                                            </div>
                                                            <span className="download-icon">
                                                                <TbInfoCircle size={16} />
                                                            </span>
                                                        </div>
                                                        <div className="document-item">
                                                            <div className="document-icon">
                                                                <TbMessage2Heart size={20} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <h6>Estado IA</h6>
                                                                <p>
                                                                    {selectedConversation
                                                                        .needsHuman ||
                                                                    selectedConversation.aiState
                                                                        ?.needsHuman
                                                                        ? 'Escalado a humano'
                                                                        : selectedConversation.aiState
                                                                              ?.grounded
                                                                          ? `Grounded con ${selectedConversation.aiState.sourceCount} fuente(s)`
                                                                          : 'Sin grounding registrado'}
                                                                </p>
                                                                {selectedConversation.aiState
                                                                    ?.fallbackReason ? (
                                                                    <p>
                                                                        Motivo:{' '}
                                                                        {
                                                                            selectedConversation
                                                                                .aiState
                                                                                .fallbackReason
                                                                        }
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                            <span className="download-icon">
                                                                <TbSparkles size={16} />
                                                            </span>
                                                        </div>
                                                        {selectedConversation.aiState
                                                            ?.sources.length ? (
                                                            <div className="knowledge-source-list">
                                                                {selectedConversation.aiState.sources
                                                                    .slice(0, 4)
                                                                    .map((source, index) => (
                                                                        <div
                                                                            className="knowledge-source-item"
                                                                            key={`${source.id ?? source.title ?? index}`}
                                                                        >
                                                                            <strong>
                                                                                {source.title ||
                                                                                    'Fuente aprobada'}
                                                                            </strong>
                                                                            <span>
                                                                                {[
                                                                                    source.scope,
                                                                                    source.sourceType,
                                                                                ]
                                                                                    .filter(Boolean)
                                                                                    .join(' · ')}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                            </div>
                                                        ) : null}
                                                        {selectedConversation.toolCalls
                                                            .length ? (
                                                            <div className="tool-audit-panel">
                                                                <div className="tool-audit-header">
                                                                    <h6>
                                                                        Auditoría de tools
                                                                    </h6>
                                                                    <span>
                                                                        {
                                                                            selectedConversation
                                                                                .toolCalls.length
                                                                        }{' '}
                                                                        ejecuciones
                                                                    </span>
                                                                </div>
                                                                <div className="tool-audit-summary">
                                                                    {(() => {
                                                                        const summary =
                                                                            summarizeToolAudit(
                                                                                selectedConversation.toolCalls,
                                                                            )
                                                                        return (
                                                                            <>
                                                                                {summary.search ? (
                                                                                    <span className="tool-audit-pill is-search">
                                                                                        {
                                                                                            summary.search
                                                                                        }{' '}
                                                                                        prebúsqueda
                                                                                    </span>
                                                                                ) : null}
                                                                                {summary.state ? (
                                                                                    <span className="tool-audit-pill is-state">
                                                                                        {
                                                                                            summary.state
                                                                                        }{' '}
                                                                                        cambio estado
                                                                                    </span>
                                                                                ) : null}
                                                                                {summary.parser ? (
                                                                                    <span className="tool-audit-pill is-parser">
                                                                                        {
                                                                                            summary.parser
                                                                                        }{' '}
                                                                                        parser
                                                                                    </span>
                                                                                ) : null}
                                                                                {summary.crud ? (
                                                                                    <span className="tool-audit-pill is-crud">
                                                                                        {
                                                                                            summary.crud
                                                                                        }{' '}
                                                                                        CRUD
                                                                                    </span>
                                                                                ) : null}
                                                                            </>
                                                                        )
                                                                    })()}
                                                                </div>
                                                                <div
                                                                    className="tool-audit-list"
                                                                    data-testid="admin-conversation-tool-calls"
                                                                >
                                                                    {selectedConversation.toolCalls
                                                                        .slice(0, 6)
                                                                        .map((toolCall) => {
                                                                            const kind =
                                                                                getToolCallKind(
                                                                                    toolCall.toolName,
                                                                                )
                                                                            return (
                                                                                <div
                                                                                    className="tool-audit-item"
                                                                                    key={
                                                                                        toolCall.id
                                                                                    }
                                                                                >
                                                                                    <div className="tool-audit-item-row">
                                                                                        <strong>
                                                                                            {
                                                                                                toolCall.toolName
                                                                                            }
                                                                                        </strong>
                                                                                        <span
                                                                                            className={`tool-audit-pill is-${kind.tone}`}
                                                                                        >
                                                                                            {
                                                                                                kind.label
                                                                                            }
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="tool-audit-item-meta">
                                                                                        {titleCase(
                                                                                            toolCall.status,
                                                                                        )}{' '}
                                                                                        ·{' '}
                                                                                        {formatDateTime(
                                                                                            toolCall.updatedAt,
                                                                                        )}
                                                                                    </div>
                                                                                    {toolCall.errorMessage ? (
                                                                                        <div className="tool-audit-error">
                                                                                            {
                                                                                                toolCall.errorMessage
                                                                                            }
                                                                                        </div>
                                                                                    ) : toolCall.validatedPayload ? (
                                                                                        <pre className="tool-audit-payload">
                                                                                            {JSON.stringify(
                                                                                                toolCall.validatedPayload,
                                                                                                null,
                                                                                                2,
                                                                                            )}
                                                                                        </pre>
                                                                                    ) : null}
                                                                                </div>
                                                                            )
                                                                        })}
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                        <div className="chat-video mt-4">
                                                            <div className="management-inline-card">
                                                                <div className="management-label">
                                                                    SLA operativo
                                                                </div>
                                                                <div className="management-value">
                                                                    {detailSlaLabel}
                                                                </div>
                                                            </div>
                                                            {conversationManagementContent}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {customerPhones.slice(1).length ? (
                                                <div className="content-wrapper">
                                                    <h5 className="sub-title">
                                                        Teléfonos adicionales
                                                    </h5>
                                                    <div className="card">
                                                        <div className="card-body">
                                                            <ul className="profile-item">
                                                                {customerPhones
                                                                    .slice(1)
                                                                    .map((phone, index) => (
                                                                        <li
                                                                            className="list-group-item"
                                                                            key={`${phone}-${index}`}
                                                                        >
                                                                            <div className="info">
                                                                                <h6>
                                                                                    Teléfono
                                                                                </h6>
                                                                                <p>{phone}</p>
                                                                            </div>
                                                                            <div className="icon">
                                                                                <TbPhoneCheck
                                                                                    size={18}
                                                                                />
                                                                            </div>
                                                                        </li>
                                                                    ))}
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="empty-state">Sin datos para mostrar.</div>
                        )}
                    </div>
                </Drawer>
            </div>
        </AdaptableCard>
    )
}

export default ConversationsV2

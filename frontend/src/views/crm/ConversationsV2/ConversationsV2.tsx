import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Drawer from '@/components/ui/Drawer'
import Spinner from '@/components/ui/Spinner'
import useResponsive from '@/utils/hooks/useResponsive'
import ConversationsService, {
    type ConversationDetail,
    type ConversationSummary,
} from '@/services/ConversationsService'
import {
    getTemplateAvatar,
    templateEmojiIcons,
} from './templateAssets'
import {
    TbMessage2Heart,
    TbUsersGroup,
    TbPhoneCall,
    TbSettings,
    TbUserCircle,
    TbPlus,
    TbDotsVertical,
    TbSearch,
    TbMenu2,
    TbArrowLeft,
    TbInfoCircle,
    TbSend2,
    TbPhoto,
    TbFileDescription,
    TbMicrophone,
    TbMoodSmile,
    TbRefresh,
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
    TbPlayerPlayFilled,
    TbX,
} from 'react-icons/tb'
import './conversations-v2.css'

type ConversationAsset = {
    url: string
    fileName: string | null
    contentType: string | null
    size: number | null
    posterUrl?: string | null
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
    if (latest.kind === 'image') return 'Photo'
    if (latest.kind === 'audio') return 'Audio'
    if (latest.kind === 'attachment') return 'Document'
    return latest.body || 'Mensaje sin texto'
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

const drawerQuickActions = [
    { key: 'audio', label: 'Audio', icon: TbPhoneCall },
    { key: 'video', label: 'Video', icon: TbVideo },
    { key: 'chat', label: 'Chat', icon: TbBrandHipchat },
    { key: 'search', label: 'Search', icon: TbSearch },
]

const socialActions = [
    { key: 'facebook', label: 'Facebook', icon: TbBrandFacebook },
    { key: 'x', label: 'X', icon: TbBrandX },
    { key: 'instagram', label: 'Instagram', icon: TbBrandInstagram },
    { key: 'linkedin', label: 'LinkedIn', icon: TbBrandLinkedin },
]

const ConversationsV2 = () => {
    const { conversationId = '' } = useParams<{ conversationId?: string }>()
    const navigate = useNavigate()
    const responsive = useResponsive()
    const isMobile = responsive.smaller.lg

    const [items, setItems] = useState<ConversationSummary[]>([])
    const [listLoading, setListLoading] = useState(true)
    const [listError, setListError] = useState<string | null>(null)
    const [selectedConversation, setSelectedConversation] =
        useState<ConversationDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [replyBody, setReplyBody] = useState('')
    const [replying, setReplying] = useState(false)
    const [isMobileListOpen, setIsMobileListOpen] = useState(false)
    const [isDetailsOpen, setIsDetailsOpen] = useState(false)

    const loadList = useCallback(
        async (searchValue = search) => {
            setListLoading(true)
            setListError(null)
            try {
                const response = await ConversationsService.fetchConversations({
                    page: 1,
                    pageSize: 50,
                    search: searchValue.trim() || undefined,
                })
                setItems(response.items)

                if (!conversationId && response.items[0]) {
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
        [conversationId, navigate, search],
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
        const timeout = window.setTimeout(() => {
            void loadList(search)
        }, 220)
        return () => window.clearTimeout(timeout)
    }, [loadList, search])

    useEffect(() => {
        if (!conversationId) {
            setSelectedConversation(null)
            return
        }
        void loadConversation(conversationId)
    }, [conversationId, loadConversation])

    const recentChats = useMemo(() => items.slice(0, 8), [items])

    const renderMessageBody = useCallback(
        (
            message: NonNullable<ConversationDetail>['messages'][number],
            authorType: string,
        ) => {
            const body = message.body || message.normalizedText || ''
            const assets = getMessageAssets(message.payload, message.metadata)
            const bodyColorClass =
                authorType === 'operator' || authorType === 'agent'
                    ? 'text-white/90'
                    : 'text-slate-700'

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

    const handleSelectConversation = (id: string) => {
        navigate(`/app/crm/conversations/${id}`)
        if (isMobile) {
            setIsMobileListOpen(false)
        }
    }

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

    const rail = (
        <div className="sidebar-menu">
            <div className="logo-mark">AI</div>
            <div className="menu-icons">
                <button className="menu-icon-btn is-active" type="button" aria-label="Chats">
                    <TbMessage2Heart size={24} />
                </button>
                <button className="menu-icon-btn" type="button" aria-label="Contacts">
                    <TbUserCircle size={24} />
                </button>
                <button className="menu-icon-btn" type="button" aria-label="Groups">
                    <TbUsersGroup size={24} />
                </button>
                <button className="menu-icon-btn" type="button" aria-label="Calls">
                    <TbPhoneCall size={24} />
                </button>
            </div>
            <div className="profile-icons">
                <button className="menu-icon-btn" type="button" aria-label="Settings">
                    <TbSettings size={24} />
                </button>
            </div>
        </div>
    )

    const sidebar = (
        <div className="sidebar-content" data-testid="admin-conversations-list">
            <div className="chat-search-header">
                <div className="header-title">
                    <h4>Chats</h4>
                    <div className="header-actions">
                        <button
                            className="header-action-btn is-primary"
                            type="button"
                            aria-label="Nuevo chat"
                        >
                            <TbPlus size={18} />
                        </button>
                        <button
                            className="header-action-btn"
                            type="button"
                            aria-label="Refrescar"
                            onClick={() => void loadList()}
                        >
                            <TbRefresh size={18} />
                        </button>
                        <button
                            className="header-action-btn"
                            type="button"
                            aria-label="Más opciones"
                        >
                            <TbDotsVertical size={18} />
                        </button>
                    </div>
                </div>
                <div className="search-wrap">
                    <div className="input-group">
                        <input
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search For Contacts or Messages"
                        />
                        <span className="input-group-text">
                            <TbSearch size={18} />
                        </span>
                    </div>
                </div>
            </div>

            <div className="top-online-contacts">
                <div className="top-online-contacts-header">
                    <h5>Recent Chats</h5>
                    <button className="header-action-btn" type="button" aria-label="Más recientes">
                        <TbDotsVertical size={18} />
                    </button>
                </div>
                <div className="recent-chat-strip">
                    {recentChats.map((conversation) => {
                        const title = getConversationDisplayTitle(conversation)
                        const color = colorByChannel(conversation.channel)
                        return (
                            <button
                                className="chat-status"
                                key={`recent-${conversation.id}`}
                                type="button"
                                onClick={() => handleSelectConversation(conversation.id)}
                            >
                                <div className="avatar avatar-lg avatar-rounded">
                                    <img
                                        src={getTemplateAvatar(conversation.id) || undefined}
                                        alt={title}
                                        style={{
                                            width: 56,
                                            height: 56,
                                            borderRadius: '999px',
                                            objectFit: 'cover',
                                            border: `2px solid ${color}20`,
                                        }}
                                    />
                                </div>
                                <p>{title}</p>
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="sidebar-body">
                <div className="sidebar-body-header">
                    <h5 className="chat-title">All Chats</h5>
                    <button className="header-action-btn" type="button" aria-label="Filtros">
                        <TbDotsVertical size={18} />
                    </button>
                </div>
                {listLoading ? (
                    <div className="empty-state">
                        <Spinner size={28} />
                    </div>
                ) : listError ? (
                    <div className="empty-state">{listError}</div>
                ) : items.length === 0 ? (
                    <div className="empty-state">No hay conversaciones disponibles.</div>
                ) : (
                    <div className="chat-users-wrap">
                        {items.map((conversation) => {
                            const title = getConversationDisplayTitle(conversation)
                            const isActive = conversation.id === conversationId
                            const preview = previewByConversation(conversation)
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
                                    <button
                                        className={`chat-user-list ${isActive ? 'is-active' : ''} ${conversation.operational.needsAssignment ? 'is-unread' : ''}`}
                                        type="button"
                                        onClick={() => handleSelectConversation(conversation.id)}
                                    >
                                        <div className="avatar avatar-lg me-2">
                                            <img
                                                src={
                                                    getTemplateAvatar(conversation.id) ||
                                                    undefined
                                                }
                                                alt={title}
                                                style={{
                                                    width: 52,
                                                    height: 52,
                                                    minWidth: 52,
                                                    borderRadius: '999px',
                                                    objectFit: 'cover',
                                                    border: `2px solid ${colorByChannel(conversation.channel)}18`,
                                                }}
                                            />
                                        </div>
                                        <div className="chat-user-info">
                                            <div className="chat-user-msg">
                                                <h6>{title}</h6>
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
                                                    {conversation.operational
                                                        .needsAssignment ? (
                                                        <span className="count-message">1</span>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        className="chat-dropdown-btn"
                                        type="button"
                                        aria-label="Más opciones"
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
                    <div>
                        <div className="chat-header">
                            <div className="user-details">
                                {isMobile ? (
                                    <button
                                        className="header-action-btn"
                                        type="button"
                                        aria-label="Abrir lista"
                                        onClick={() => setIsMobileListOpen(true)}
                                    >
                                        <TbMenu2 size={20} />
                                    </button>
                                ) : null}
                                <img
                                    src={
                                        getTemplateAvatar(selectedConversation.id) ||
                                        undefined
                                    }
                                    alt={getConversationDisplayTitle(selectedConversation)}
                                    style={{
                                        width: 48,
                                        height: 48,
                                        minWidth: 48,
                                        borderRadius: '999px',
                                        objectFit: 'cover',
                                        marginLeft: isMobile ? 8 : 0,
                                        border: `2px solid ${colorByChannel(selectedConversation.channel)}18`,
                                    }}
                                />
                                <div className="ms-2 overflow-hidden">
                                    <h6 data-testid="admin-conversation-detail-title">
                                        {getConversationDisplayTitle(selectedConversation)}
                                    </h6>
                                    <span className="last-seen">
                                        <span className="status-pill is-online">
                                            {titleCase(selectedConversation.channel)}
                                        </span>
                                        <span>{formatTitle(selectedConversation.subject)}</span>
                                    </span>
                                </div>
                            </div>
                            <div className="chat-options">
                                <ul>
                                    <li>
                                        <button type="button" aria-label="Buscar">
                                            <TbSearch size={20} />
                                        </button>
                                    </li>
                                    <li>
                                        <button type="button" aria-label="Videollamada">
                                            <TbVideo size={20} />
                                        </button>
                                    </li>
                                    <li>
                                        <button type="button" aria-label="Llamada">
                                            <TbPhoneCall size={20} />
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            type="button"
                                            aria-label="Volver"
                                            onClick={() => navigate('/app/crm/conversations')}
                                        >
                                            <TbArrowLeft size={20} />
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            type="button"
                                            aria-label="Detalles"
                                            onClick={() => setIsDetailsOpen(true)}
                                        >
                                            <TbInfoCircle size={20} />
                                        </button>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        <div className="chat-body chat-page-group" data-testid="admin-conversation-messages">
                            <div className="messages">
                                {selectedConversation.messages.map((message) => {
                                    const isRight =
                                        message.authorType === 'operator' ||
                                        message.authorType === 'agent'
                                    return (
                                        <div
                                            className={`chats ${isRight ? 'chats-right' : ''}`}
                                            key={message.id}
                                        >
                                            <div className="chat-avatar">
                                                <img
                                                    src={
                                                        getTemplateAvatar(
                                                            `${selectedConversation.id}:${message.authorType}`,
                                                        ) || undefined
                                                    }
                                                    alt={titleCase(message.authorType)}
                                                    style={{
                                                        width: 40,
                                                        height: 40,
                                                        borderRadius: '999px',
                                                        objectFit: 'cover',
                                                    }}
                                                />
                                            </div>
                                            <div className="chat-content">
                                                <div
                                                    className={`chat-profile-name ${isRight ? 'text-end' : ''}`}
                                                >
                                                    <h6>
                                                        {message.authorType === 'operator'
                                                            ? 'You'
                                                            : titleCase(
                                                                  message.authorType,
                                                              )}
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
                                                    <div className="message-content">
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
                            onSubmit={(event) => {
                                event.preventDefault()
                                void handleReply()
                            }}
                        >
                            <button className="action-circle" type="button" aria-label="Audio">
                                <TbMicrophone size={18} />
                            </button>
                            <div className="form-wrap">
                                <input
                                    className="form-control"
                                    data-testid="admin-conversation-reply-input"
                                    type="text"
                                    value={replyBody}
                                    onChange={(event) => setReplyBody(event.target.value)}
                                    placeholder="Type Your Message"
                                />
                            </div>
                            <button className="action-circle" type="button" aria-label="Emoji">
                                <TbMoodSmile size={18} />
                            </button>
                            <button className="action-circle" type="button" aria-label="Adjuntar">
                                <TbFolder size={18} />
                            </button>
                            <div className="hidden xl:flex items-center gap-2 pr-1">
                                {templateEmojiIcons.map((icon) => (
                                    <img
                                        key={icon}
                                        src={icon}
                                        alt="emoji"
                                        style={{ width: 18, height: 18 }}
                                    />
                                ))}
                            </div>
                            <button
                                className="send-btn"
                                type="submit"
                                aria-label="Enviar"
                                disabled={replying || !replyBody.trim()}
                            >
                                <TbSend2 size={20} />
                            </button>
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
                    {!isMobile ? rail : null}
                    {!isMobile ? sidebar : null}
                    {detail}
                </div>
                <Drawer
                    bodyClass="p-0"
                    title={null}
                    isOpen={isMobileListOpen}
                    placement="left"
                    width={360}
                    onClose={() => setIsMobileListOpen(false)}
                    onRequestClose={() => setIsMobileListOpen(false)}
                >
                    <div className="crm-conversations-v2 h-full">{sidebar}</div>
                </Drawer>
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
                                    <h4>Contact Info</h4>
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
                                                <div className="avatar avatar-xxl online mb-2">
                                                    <img
                                                        src={
                                                            getTemplateAvatar(
                                                                selectedConversation.id,
                                                            ) || undefined
                                                        }
                                                        alt={getConversationDisplayTitle(
                                                            selectedConversation,
                                                        )}
                                                        style={{
                                                            width: 96,
                                                            height: 96,
                                                            borderRadius: '999px',
                                                            objectFit: 'cover',
                                                        }}
                                                    />
                                                </div>
                                                <h6>
                                                    {getConversationDisplayTitle(
                                                        selectedConversation,
                                                    )}
                                                </h6>
                                                <p>
                                                    Last seen at{' '}
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
                                                <h5 className="sub-title">Profile Info</h5>
                                                <div className="card">
                                                    <div className="card-body">
                                                        <ul className="profile-item">
                                                            <li className="list-group-item">
                                                                <div className="profile-info">
                                                                    <h6>Name</h6>
                                                                    <p>
                                                                        {selectedConversation.customer
                                                                            ?.name ||
                                                                            getConversationDisplayTitle(
                                                                                selectedConversation,
                                                                            )}
                                                                    </p>
                                                                </div>
                                                                <div className="profile-icon">
                                                                    <TbUserCheck size={18} />
                                                                </div>
                                                            </li>
                                                            <li className="list-group-item">
                                                                <div className="info">
                                                                    <h6>Email Address</h6>
                                                                    <p>
                                                                        {selectedConversation.customer
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
                                                                    <h6>Phone</h6>
                                                                    <p>
                                                                        {selectedConversation.customer
                                                                            ?.phoneNumber ||
                                                                            'Sin teléfono'}
                                                                    </p>
                                                                </div>
                                                                <div className="icon">
                                                                    <TbPhoneCheck size={18} />
                                                                </div>
                                                            </li>
                                                            <li className="list-group-item">
                                                                <div className="info">
                                                                    <h6>Bio</h6>
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
                                                <h5 className="sub-title">Social Profiles</h5>
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
                                                <h5 className="sub-title">Media Details</h5>
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
                                                                    {selectedConversation
                                                                        .assignedToUser?.name ||
                                                                        selectedConversation
                                                                            .assignedToUser
                                                                            ?.email ||
                                                                        'Sin asignar'}
                                                                </p>
                                                            </div>
                                                            <span className="download-icon">
                                                                <TbInfoCircle size={16} />
                                                            </span>
                                                        </div>
                                                        <div className="chat-video mt-4">
                                                            <button
                                                                className="video-img"
                                                                type="button"
                                                                aria-label="Abrir vista previa del video"
                                                            >
                                                                <img
                                                                    src="/mock/dreamschat/video/video.jpg"
                                                                    alt="video preview"
                                                                />
                                                                <span>
                                                                    <TbPlayerPlayFilled size={12} />
                                                                </span>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
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

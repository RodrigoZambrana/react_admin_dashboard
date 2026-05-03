import {
    type ChangeEvent,
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type UIEvent,
} from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AdaptableCard from '@/components/shared/AdaptableCard'
import Drawer from '@/components/ui/Drawer'
import Dialog from '@/components/ui/Dialog'
import Dropdown from '@/components/ui/Dropdown'
import Notification from '@/components/ui/Notification'
import Spinner from '@/components/ui/Spinner'
import toast from '@/components/ui/toast'
import { APP_PREFIX_PATH, appPath } from '@/constants/route.constant'
import useResponsive from '@/utils/hooks/useResponsive'
import { apiGetUsers } from '@/services/UsersService'
import ConversationsService, {
    type ConversationContact,
    type ConversationDetail,
    type ConversationMessageAttachmentInput,
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
    TbChevronDown,
    TbShare3,
    TbPencil,
} from 'react-icons/tb'
import './conversations-v2.css'

type ConversationAsset = {
    url: string
    fileName: string | null
    contentType: string | null
    size: number | null
    kind: string | null
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

type ApprovedReplySuggestion =
    ConversationDetail['aiSuggestions']['items'][number]

type ReplyComposerAttachment = ConversationMessageAttachmentInput & {
    localId: string
    size: number
}

type ThreadAuditSlot = {
    key: string
    label: string
    value: string
    source: string | null
}

type ConversationThreadAuditSnapshot = {
    totalTurnsWithThreadData: number
    detectedThreads: Array<{
        key: string
        label: string
        baseType: string | null
        lastSeenAt: string | null
        switchCount: number
        slots: ThreadAuditSlot[]
    }>
    activeThreadKey: string | null
    activeThreadLabel: string | null
    threadSwitches: Array<{
        messageId: string
        createdAt: string
        fromLabel: string | null
        toLabel: string | null
    }>
    disambiguationTurns: Array<{
        messageId: string
        createdAt: string
        promptText: string | null
        currentTurnText: string | null
    }>
}

type ConversationMessageDetail = ConversationDetail['messages'][number]

const MAX_REPLY_ATTACHMENTS = 4
const MAX_REPLY_ATTACHMENT_BYTES = 8 * 1024 * 1024
const ACCEPTED_REPLY_ATTACHMENT_TYPES =
    '.png,.jpg,.jpeg,.webp,.gif,.webm,.ogg,.mp3,.wav,.mp4,.mov,.pdf,.csv,.xlsx,.xls,.doc,.docx,.txt,.md,.json,image/png,image/jpeg,image/webp,image/gif,audio/webm,audio/ogg,audio/mpeg,audio/mp3,audio/wav,video/mp4,video/webm,video/quicktime,application/pdf,text/plain,text/markdown,application/json,text/csv,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

const INTERNAL_ASSISTANT_CONTACT_KEY = 'internal:assistant'
const INTERNAL_ASSISTANT_FALLBACK_CONTACT: ConversationContact = {
    key: INTERNAL_ASSISTANT_CONTACT_KEY,
    kind: 'internal',
    label: 'Asistente interno',
    description: 'Agente IA operativa para apoyo interno',
    email: null,
    phoneNumber: null,
    channel: 'admin_chat',
    conversationId: null,
    hasDeliveryChannel: true,
    updatedAt: null,
}

const inferReplyAttachmentAssetType = (file: File) => {
    const mime = file.type.toLowerCase()
    const name = file.name.toLowerCase()

    if (mime.startsWith('image/')) return 'image'
    if (mime.startsWith('audio/')) return 'audio'
    if (mime.startsWith('video/')) return 'video'
    if (mime.includes('pdf')) return 'pdf'
    if (
        mime.includes('spreadsheet') ||
        mime.includes('excel') ||
        name.endsWith('.xlsx') ||
        name.endsWith('.xls')
    ) {
        return 'xlsx'
    }
    if (mime.includes('csv') || name.endsWith('.csv')) return 'csv'
    if (
        mime.includes('word') ||
        mime.includes('officedocument.wordprocessingml') ||
        name.endsWith('.docx') ||
        name.endsWith('.doc')
    ) {
        return 'docx'
    }
    if (
        mime.startsWith('text/') ||
        name.endsWith('.txt') ||
        name.endsWith('.md') ||
        name.endsWith('.json')
    ) {
        return 'text'
    }

    return 'file'
}

const readReplyFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
            resolve(typeof reader.result === 'string' ? reader.result : '')
        }
        reader.onerror = () =>
            reject(reader.error ?? new Error('No fue posible leer el archivo.'))
        reader.readAsDataURL(file)
    })

const buildReplyAttachmentFromFile = async (
    file: File,
): Promise<ReplyComposerAttachment> => {
    const assetType = inferReplyAttachmentAssetType(file)
    const [content, textContent] = await Promise.all([
        readReplyFileAsDataUrl(file),
        assetType === 'text' || assetType === 'csv'
            ? file.text().catch(() => '')
            : Promise.resolve(''),
    ])

    return {
        localId: `${file.name}-${file.size}-${file.lastModified}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
        assetType,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        content,
        textContent: textContent.trim() || undefined,
        metadata: {
            size: file.size,
            lastModified: file.lastModified,
        },
        size: file.size,
    }
}

const formatReplyAttachmentType = (attachment: {
    assetType?: string | null
    contentType?: string | null
}) => {
    const normalized = String(
        attachment.assetType || attachment.contentType || '',
    ).toLowerCase()

    if (!normalized) return 'Adjunto'
    if (
        normalized.includes('image') ||
        normalized.includes('jpg') ||
        normalized.includes('png') ||
        normalized.includes('webp')
    ) {
        return 'Imagen'
    }
    if (
        normalized.includes('audio') ||
        normalized.includes('voice') ||
        normalized.includes('webm') ||
        normalized.includes('ogg')
    ) {
        return 'Audio'
    }
    if (normalized.includes('video') || normalized.includes('mp4')) {
        return 'Video'
    }
    if (normalized.includes('csv') || normalized.includes('xls')) {
        return 'Tabla'
    }
    if (normalized.includes('pdf') || normalized.includes('doc')) {
        return 'Documento'
    }
    return 'Adjunto'
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

const extractTaskSummaryField = (
    summary: string | null | undefined,
    key: 'intención' | 'contexto_reciente' | 'consulta_actual',
) => {
    const raw = String(summary || '')
    if (!raw.trim()) return null

    const parts = raw.split(/\s*;\s*/).map((entry) => entry.trim())
    for (const part of parts) {
        const [field, ...rest] = part.split('=')
        if (field?.trim() === key) {
            const value = rest.join('=').trim()
            return value || null
        }
    }

    return null
}

const formatTaskSummaryPreview = (summary?: string | null) => {
    const currentQuery = extractTaskSummaryField(summary, 'consulta_actual')
    if (currentQuery) return currentQuery

    const recentContext = extractTaskSummaryField(summary, 'contexto_reciente')
    if (recentContext) return recentContext

    const intent = extractTaskSummaryField(summary, 'intención')
    if (intent) return intent

    return summary?.trim() || null
}

const formatSuggestionMatchLabel = (value: string) => {
    switch (value) {
        case 'dedupe':
            return 'Coincidencia exacta'
        case 'intent':
            return 'Misma intención'
        case 'cluster':
            return 'Mismo patrón'
        case 'lexical':
            return 'Texto similar'
        case 'feedback':
            return 'Historial validado'
        default:
            return titleCase(value)
    }
}

const formatSuggestionPreview = (value: string, limit = 180) => {
    const normalized = value.trim()
    if (normalized.length <= limit) {
        return normalized
    }

    return `${normalized.slice(0, limit).trimEnd()}…`
}

const extractMessageAiResponse = (metadata: unknown) => {
    const root = asRecord(metadata)
    const aiResponse = asRecord(root?.aiResponse)
    if (!aiResponse) {
        return null
    }

    return {
        finalUserText:
            typeof aiResponse.finalUserText === 'string'
                ? aiResponse.finalUserText
                : null,
        debugSummary:
            typeof aiResponse.debugSummary === 'string'
                ? aiResponse.debugSummary
                : null,
        auditPayload: asRecord(aiResponse.auditPayload),
    }
}

const extractStoredMessageElements = (payload: unknown, metadata: unknown) => {
    const payloadRecord = asRecord(payload)
    const metadataRecord = asRecord(metadata)
    const aiResponse = asRecord(metadataRecord?.aiResponse)
    const auditPayload = asRecord(aiResponse?.auditPayload)
    const raw = Array.isArray(payloadRecord?.messageElements)
        ? payloadRecord.messageElements
        : Array.isArray(metadataRecord?.messageElements)
          ? metadataRecord.messageElements
          : Array.isArray(auditPayload?.messageElements)
            ? auditPayload.messageElements
            : []

    return raw
        .map((entry) => asRecord(entry))
        .filter((entry): entry is Record<string, unknown> => Boolean(entry))
}

const extractStoredMessageContextOrigin = (payload: unknown, metadata: unknown) => {
    const payloadRecord = asRecord(payload)
    const metadataRecord = asRecord(metadata)
    const aiResponse = asRecord(metadataRecord?.aiResponse)
    const auditPayload = asRecord(aiResponse?.auditPayload)
    const raw = Array.isArray(payloadRecord?.messageContextOrigin)
        ? payloadRecord.messageContextOrigin
        : Array.isArray(metadataRecord?.messageContextOrigin)
          ? metadataRecord.messageContextOrigin
          : Array.isArray(auditPayload?.messageContextOrigin)
            ? auditPayload.messageContextOrigin
            : []

    return raw.filter((entry): entry is string => typeof entry === 'string')
}

const extractMessageDeliveryState = (
    message: NonNullable<ConversationDetail>['messages'][number],
) => {
    const metadataRecord = asRecord(message.metadata)
    const latestTransportEvent = Array.isArray(message.transportEvents)
        ? message.transportEvents[0] ?? null
        : null
    const transportPayload = asRecord(latestTransportEvent?.payload)
    const status =
        typeof transportPayload?.deliveryStatus === 'string'
            ? transportPayload.deliveryStatus
            : typeof metadataRecord?.deliveryStatus === 'string'
              ? metadataRecord.deliveryStatus
              : null
    const errorMessage =
        typeof transportPayload?.errorMessage === 'string'
            ? transportPayload.errorMessage
            : typeof metadataRecord?.errorMessage === 'string'
              ? metadataRecord.errorMessage
              : null

    if (!status || status === 'internal_only') {
        return null
    }

    const normalized = status.trim().toLowerCase()
    const label =
        normalized === 'failed' || normalized === 'rejected'
            ? 'Entrega fallida'
            : normalized === 'delivered' || normalized === 'read'
              ? 'Entregado'
              : normalized === 'accepted' || normalized === 'queued'
                ? 'En cola'
                : normalized === 'sent' || normalized === 'pending_external'
                  ? 'Enviado'
                  : titleCase(normalized)

    return {
        status: normalized,
        label,
        errorMessage,
    }
}

const formatAuditStageHistory = (history?: string[] | null) => {
    if (!Array.isArray(history) || history.length === 0) {
        return null
    }

    return history.join(' -> ')
}

const buildHandoffTaskSummary = (conversation: ConversationSummary | ConversationDetail) => {
    const summary =
        formatTaskSummaryPreview(conversation.aiState?.memory?.taskSummary) || null
    const intentKey = conversation.aiState?.memory?.intentKey || null

    if (!summary && !intentKey) {
        return null
    }

    if (summary && intentKey) {
        return `Tarea actual (${intentKey}): ${summary}`
    }

    if (summary) {
        return `Tarea actual: ${summary}`
    }

    return `Tarea actual (${intentKey})`
}

const getInboxSecondaryLabel = (inbox: InboxSummary) => {
    if (inbox.address) {
        return inbox.address
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
    role?: string
    subject: string | null
    customer?: { name: string } | null
    participants?: Array<{ displayName: string | null }> | null
    externalUserId?: string | null
}) => {
    if (conversation.scope === 'admin_internal' || String(conversation.role || '').startsWith('admin_') || conversation.role === 'superadmin') {
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
    let prefix = ''
    if (latest.authorType === 'agent') {
        prefix = 'IA: '
    } else if (latest.authorType === 'operator') {
        const operatorLabel =
            latest.authorLabel?.trim() ||
            latest.authorUser?.name?.trim() ||
            conversation.assignedToUser?.name?.trim() ||
            'Admin'
        prefix = `${operatorLabel}: `
    } else if (latest.authorType === 'system') {
        prefix = 'Sistema: '
    }
    if (latest.kind === 'image') return `${prefix}Imagen`
    if (latest.kind === 'audio') return `${prefix}Audio`
    if (latest.kind === 'attachment') return `${prefix}Adjunto`
    const body = (latest.preview || latest.body || '').trim()
    const subject = String(conversation.subject || '').trim()
    const emailSubjectPreview =
        conversation.channel === 'email' && subject
            ? prefix
                ? `${prefix}Asunto: ${subject}`
                : `Asunto: ${subject}`
            : null
    if (body) {
        if (
            emailSubjectPreview &&
            !body.toLowerCase().includes(subject.toLowerCase())
        ) {
            return `${emailSubjectPreview} · ${body}`
        }
        return `${prefix}${body}`
    }
    if (emailSubjectPreview) {
        return emailSubjectPreview
    }
    if (latest.authorType === 'agent') {
        return 'IA: respuesta sin texto'
    }
    if (latest.authorType === 'operator') {
        const operatorLabel =
            latest.authorLabel?.trim() ||
            latest.authorUser?.name?.trim() ||
            conversation.assignedToUser?.name?.trim() ||
            'Admin'
        return `${operatorLabel}: mensaje sin texto`
    }
    return latest.authorType === 'system'
        ? 'Sistema: evento sin texto'
        : 'Mensaje sin texto'
}

const getConversationOwnerState = (conversation: ConversationSummary) => {
    if (conversation.controlMode === 'human') {
        return {
            label: conversation.assignedToUser?.name || 'Administrador',
            tone: 'admin' as const,
        }
    }

    if (conversation.controlMode === 'hybrid') {
        return {
            label: conversation.assignedToUser?.name || 'Equipo',
            tone: 'admin' as const,
        }
    }

    return {
        label: 'Agente IA',
        tone: 'agent' as const,
    }
}

const getConversationControlModeBadge = (conversation: ConversationSummary) => {
    if (conversation.needsHuman || conversation.aiState?.needsHuman || conversation.controlMode === 'human') {
        return {
            label: 'Asesor humano',
            tone: 'human' as const,
        }
    }

    if (conversation.controlMode === 'hybrid') {
        return {
            label: 'IA + equipo',
            tone: 'hybrid' as const,
        }
    }

    return {
        label: 'Asistente IA',
        tone: 'agent' as const,
    }
}

const getConversationRoleLabel = (role?: string | null) => {
    switch (role) {
        case 'customer_public':
            return 'Cliente público'
        case 'customer_authenticated':
            return 'Cliente autenticado'
        case 'admin_support':
            return 'Soporte'
        case 'admin_sales':
            return 'Ventas'
        case 'admin_operations':
            return 'Operaciones'
        case 'admin_supervisor':
            return 'Supervisor'
        case 'superadmin':
            return 'Superadmin'
        default:
            return role ? titleCase(role) : 'Sin rol'
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
    const hasTaskReset = Boolean(conversation.aiState?.memory?.lastResetAt)
    if ((!audit || audit.total === 0) && !hasTaskReset) {
        return []
    }

    return [
        hasTaskReset
            ? { key: 'task-reset', label: 'Reset de tarea', tone: 'state' }
            : null,
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

const extractAuditTurnInterpretation = (metadata: unknown) => {
    const aiResponse = extractMessageAiResponse(metadata)
    return asRecord(aiResponse?.auditPayload?.turnInterpretation)
}

const extractAuditThreadLabel = (thread: unknown) => {
    const record = asRecord(thread)
    return (
        asString(record?.displayLabel) ||
        asString(record?.resolvedLabel) ||
        asString(record?.baseLabel)
    )
}

const formatAuditCapturedValue = (value: unknown): string | null => {
    const directString = asString(value)
    if (directString) return directString

    const directNumber = asNumber(value)
    if (directNumber != null) return String(directNumber)

    const record = asRecord(value)
    if (!record) return null

    return (
        asString(record.confirmationLabel) ||
        asString(record.displayLabel) ||
        asString(record.label) ||
        asString(record.value) ||
        (asNumber(record.total) != null ? String(asNumber(record.total)) : null)
    )
}

const extractQuoteCapturedSlots = (quoteContext: unknown): ThreadAuditSlot[] => {
    const record = asRecord(quoteContext)
    const captured = asRecord(record?.capturedAttributes)
    if (!captured) {
        return []
    }

    return Object.entries(captured)
        .map(([key, value]) => {
            const entry = asRecord(value)
            const formattedValue = formatAuditCapturedValue(
                entry?.label ?? entry?.value ?? null,
            )
            if (!formattedValue) {
                return null
            }

            return {
                key,
                label: asString(entry?.label) || titleCase(key),
                value: formattedValue,
                source: asString(entry?.source),
            }
        })
        .filter((entry): entry is ThreadAuditSlot => Boolean(entry))
}

const buildConversationThreadAudit = (
    conversation: ConversationDetail | null,
): ConversationThreadAuditSnapshot | null => {
    if (!conversation?.messages?.length) {
        return null
    }

    const threadMap = new Map<
        string,
        {
            key: string
            label: string
            baseType: string | null
            lastSeenAt: string | null
            switchCount: number
            slotMap: Map<string, ThreadAuditSlot>
        }
    >()
    const threadSwitches: ConversationThreadAuditSnapshot['threadSwitches'] = []
    const disambiguationTurns: ConversationThreadAuditSnapshot['disambiguationTurns'] =
        []

    let totalTurnsWithThreadData = 0
    let latestActiveThreadKey: string | null = null
    let latestActiveThreadLabel: string | null = null
    let previousActiveThreadLabel: string | null = null

    const ensureThread = (
        key: string,
        label: string,
        baseType: string | null,
        createdAt: string,
    ) => {
        const existing = threadMap.get(key)
        if (existing) {
            existing.lastSeenAt = createdAt
            if (!existing.baseType && baseType) {
                existing.baseType = baseType
            }
            return existing
        }

        const created = {
            key,
            label,
            baseType,
            lastSeenAt: createdAt,
            switchCount: 0,
            slotMap: new Map<string, ThreadAuditSlot>(),
        }
        threadMap.set(key, created)
        return created
    }

    for (const message of conversation.messages) {
        const turnInterpretation = extractAuditTurnInterpretation(message.metadata)
        if (!turnInterpretation) {
            continue
        }

        const threadResolution = asRecord(turnInterpretation.threadResolution)
        const quoteContext = asRecord(turnInterpretation.quoteContext)
        if (!threadResolution && !quoteContext) {
            continue
        }

        totalTurnsWithThreadData += 1

        const threadEntries = Array.isArray(threadResolution?.threads)
            ? threadResolution.threads
                  .map((entry) => asRecord(entry))
                  .filter((entry): entry is Record<string, unknown> => Boolean(entry))
            : []

        for (const threadEntry of threadEntries) {
            const key = asString(threadEntry.key)
            const label = extractAuditThreadLabel(threadEntry)
            if (!key || !label) {
                continue
            }
            ensureThread(
                key,
                label,
                asString(threadEntry.baseType),
                message.createdAt,
            )
        }

        const activeThread = asRecord(threadResolution?.activeThread)
        const activeThreadKey =
            asString(threadResolution?.activeThreadKey) ||
            asString(activeThread?.key) ||
            null
        const activeThreadLabel =
            extractAuditThreadLabel(activeThread) ||
            (activeThreadKey ? threadMap.get(activeThreadKey)?.label ?? null : null) ||
            asString(quoteContext?.topicLabel) ||
            asString(quoteContext?.familyLabel) ||
            null

        if (activeThreadKey && activeThreadLabel) {
            ensureThread(
                activeThreadKey,
                activeThreadLabel,
                asString(activeThread?.baseType),
                message.createdAt,
            )
        }

        if (threadResolution?.requiresDisambiguation) {
            disambiguationTurns.push({
                messageId: message.id,
                createdAt: message.createdAt,
                promptText: asString(threadResolution.promptText),
                currentTurnText: asString(turnInterpretation.currentTurnText),
            })
        }

        if (threadResolution?.switchDetected && activeThreadKey && activeThreadLabel) {
            threadSwitches.push({
                messageId: message.id,
                createdAt: message.createdAt,
                fromLabel: previousActiveThreadLabel,
                toLabel: activeThreadLabel,
            })
            const targetThread = threadMap.get(activeThreadKey)
            if (targetThread) {
                targetThread.switchCount += 1
            }
        }

        const capturedSlots = extractQuoteCapturedSlots(quoteContext)
        if (capturedSlots.length) {
            const slotThreadKey =
                activeThreadKey ||
                `quote:${asString(quoteContext?.topicLabel) || asString(quoteContext?.familyLabel) || asString(quoteContext?.profileKey) || 'general'}`
            const slotThreadLabel =
                activeThreadLabel ||
                asString(quoteContext?.topicLabel) ||
                asString(quoteContext?.familyLabel) ||
                asString(quoteContext?.profileLabel) ||
                'Sin hilo activo'
            const slotThread = ensureThread(
                slotThreadKey,
                slotThreadLabel,
                null,
                message.createdAt,
            )
            for (const slot of capturedSlots) {
                slotThread.slotMap.set(`${slot.key}:${slot.value}`, slot)
            }
        }

        if (activeThreadKey) {
            latestActiveThreadKey = activeThreadKey
        }
        if (activeThreadLabel) {
            previousActiveThreadLabel = activeThreadLabel
            latestActiveThreadLabel = activeThreadLabel
        }
    }

    if (!totalTurnsWithThreadData && threadMap.size === 0) {
        return null
    }

    return {
        totalTurnsWithThreadData,
        detectedThreads: Array.from(threadMap.values())
            .map((entry) => ({
                key: entry.key,
                label: entry.label,
                baseType: entry.baseType,
                lastSeenAt: entry.lastSeenAt,
                switchCount: entry.switchCount,
                slots: Array.from(entry.slotMap.values()),
            }))
            .sort((left, right) => left.label.localeCompare(right.label)),
        activeThreadKey: latestActiveThreadKey,
        activeThreadLabel: latestActiveThreadLabel,
        threadSwitches,
        disambiguationTurns,
    }
}

const ATTACHMENT_SUMMARY_LINE_REGEX = /^\[Adjunto:[^\]]+\](?:\s.*)?$/i

const isSyntheticAttachmentSummaryText = (value: unknown) => {
    const normalized = asString(value)
    if (!normalized) {
        return false
    }

    const lines = normalized
        .split(/\n+/)
        .map((entry) => entry.trim())
        .filter(Boolean)

    return lines.length > 0 && lines.every((entry) => ATTACHMENT_SUMMARY_LINE_REGEX.test(entry))
}

const inferConversationAssetKind = (asset: Record<string, unknown>) => {
    const normalized = String(
        asset.assetType ||
            asset.kind ||
            asset.contentType ||
            asset.mimeType ||
            asset.fileName ||
            asset.filename ||
            asset.name ||
            '',
    )
        .trim()
        .toLowerCase()

    if (!normalized) {
        return null
    }

    if (
        normalized.includes('image') ||
        normalized.includes('jpg') ||
        normalized.includes('jpeg') ||
        normalized.includes('png') ||
        normalized.includes('webp') ||
        normalized.includes('gif')
    ) {
        return 'image'
    }

    if (
        normalized.includes('audio') ||
        normalized.includes('voice') ||
        normalized.includes('wav') ||
        normalized.includes('ogg') ||
        normalized.includes('mp3') ||
        normalized.includes('webm')
    ) {
        return 'audio'
    }

    if (
        normalized.includes('video') ||
        normalized.includes('mp4') ||
        normalized.includes('mov') ||
        normalized.includes('quicktime')
    ) {
        return 'video'
    }

    return 'attachment'
}

const dedupeConversationAssets = (value: ConversationAsset[]) => {
    const seen = new Set<string>()
    return value.filter((entry) => {
        const key = `${entry.kind || 'attachment'}:${entry.url}:${entry.fileName ?? ''}`
        if (seen.has(key)) {
            return false
        }
        seen.add(key)
        return true
    })
}

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
        asString(asset.content)

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
        kind: inferConversationAssetKind(asset),
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

    return dedupeConversationAssets(
        value
        .map((entry) => normalizeAsset(entry))
        .filter((entry): entry is ConversationAsset => Boolean(entry)),
    )
}

const getMessageAssets = (
    payload: Record<string, unknown> | null | undefined,
    metadata: Record<string, unknown> | null | undefined,
) => {
    const payloadRecord = asRecord(payload)
    const metadataRecord = asRecord(metadata)

    const rawAttachments = normalizeAssets(
        payloadRecord?.attachments ?? metadataRecord?.attachments,
    )
    const images = dedupeConversationAssets(
        [
            normalizeAsset(payloadRecord?.image),
            normalizeAsset(metadataRecord?.image),
            normalizeAsset(
                asString(payloadRecord?.imageUrl) ||
                    asString(metadataRecord?.imageUrl)
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
            ),
            ...rawAttachments.filter((entry) => entry.kind === 'image'),
        ].filter((entry): entry is ConversationAsset => Boolean(entry)),
    )

    const audios = dedupeConversationAssets(
        [
            normalizeAsset(payloadRecord?.audio),
            normalizeAsset(metadataRecord?.audio),
            normalizeAsset(
                asString(payloadRecord?.audioUrl) ||
                    asString(metadataRecord?.audioUrl)
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
            ),
            ...rawAttachments.filter((entry) => entry.kind === 'audio'),
        ].filter((entry): entry is ConversationAsset => Boolean(entry)),
    )

    const videos = dedupeConversationAssets(
        [
            normalizeAsset(payloadRecord?.video),
            normalizeAsset(metadataRecord?.video),
            normalizeAsset(
                asString(payloadRecord?.videoUrl) ||
                    asString(metadataRecord?.videoUrl)
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
            ),
            ...rawAttachments.filter((entry) => entry.kind === 'video'),
        ].filter((entry): entry is ConversationAsset => Boolean(entry)),
    )

    const attachments = rawAttachments.filter(
        (entry) => entry.kind !== 'image' && entry.kind !== 'audio' && entry.kind !== 'video',
    )

    return { attachments, images, audios, videos }
}

const DEFAULT_WHATSAPP_REACTION_OPTIONS = ['👍', '❤️', '✅', '👀', '🙏', '🔥']

const isWhatsappQrConversation = (
    conversation: Pick<ConversationSummary, 'channel' | 'inboxAccount'> | null | undefined,
) =>
    conversation?.channel?.toLowerCase() === 'whatsapp' &&
    conversation?.inboxAccount?.transport === 'whatsapp_qr'

const isWebchatConversation = (
    conversation: Pick<ConversationSummary, 'channel'> | null | undefined,
) => conversation?.channel?.toLowerCase() === 'webchat'

const extractChannelMessageActions = (
    message: ConversationMessageDetail,
    conversation?: Pick<ConversationSummary, 'channel' | 'inboxAccount'> | null,
) => {
    const metadataRecord = asRecord(message.metadata)
    const channelActions = asRecord(metadataRecord?.channelActions)
    const provider =
        typeof channelActions?.provider === 'string'
            ? channelActions.provider
            : null
    const whatsappRecord = asRecord(metadataRecord?.whatsapp)
    const actionsRecord = asRecord(whatsappRecord?.actions)
    const whatsappState = asRecord(metadataRecord?.whatsappState)

    if (provider) {
        return {
            enabled: true,
            provider,
            canReact: channelActions?.canReact === true,
            canReply: channelActions?.canReply === true,
            canEdit: channelActions?.canEdit === true,
            canDelete: channelActions?.canDelete === true,
            canStar: channelActions?.canStar === true,
            canForward: channelActions?.canForward === true,
            canDownloadMedia: channelActions?.canDownloadMedia === true,
            starred: channelActions?.starred === true,
        }
    }

    const isWhatsappQr = isWhatsappQrConversation(conversation)

    return {
        enabled: Boolean(whatsappRecord) && isWhatsappQr,
        provider: isWhatsappQr ? 'whatsapp_qr' : null,
        canReact:
            actionsRecord?.canReact === true || whatsappRecord?.canReact === true,
        canReply: actionsRecord?.canReply === true,
        canEdit: actionsRecord?.canEdit === true,
        canDelete: actionsRecord?.canDelete === true,
        canStar: actionsRecord?.canStar === true,
        canForward:
            actionsRecord?.canForward === true || whatsappRecord?.canForward === true,
        canDownloadMedia:
            actionsRecord?.canDownloadMedia === true ||
            whatsappRecord?.hasMedia === true,
        starred: whatsappState?.starred === true,
    }
}

const extractChannelMessageReactions = (
    message: ConversationMessageDetail,
) => {
    const metadataRecord = asRecord(message.metadata)
    const webchatState = asRecord(metadataRecord?.webchatState)
    const reactionEntries = Array.isArray(webchatState?.reactions)
        ? webchatState.reactions
        : []
    const counters = new Map<string, { emoji: string; count: number }>()

    reactionEntries.forEach((entry) => {
        const record = asRecord(entry)
        const emoji =
            typeof record?.emoji === 'string' ? record.emoji.trim() : ''
        if (!emoji) {
            return
        }
        const current = counters.get(emoji) ?? {
            emoji,
            count: 0,
        }
        current.count += 1
        counters.set(emoji, current)
    })

    return Array.from(counters.values())
}

const saveBlobDownload = (blob: Blob, fileName: string) => {
    const url = window.URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName
    anchor.rel = 'noreferrer'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.URL.revokeObjectURL(url)
}

const triggerHrefDownload = (href: string, fileName: string) => {
    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = fileName
    anchor.rel = 'noreferrer'
    anchor.target = '_blank'
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
}

const resolveLocalAttachmentDownload = (
    attachment: unknown,
    fallbackName: string,
) => {
    const record = asRecord(attachment)
    if (!record) {
        return null
    }

    const href =
        (typeof record.url === 'string' && record.url.trim()) ||
        (typeof record.content === 'string' && record.content.trim()) ||
        null

    if (!href) {
        return null
    }

    const fileName =
        (typeof record.fileName === 'string' && record.fileName.trim()) ||
        fallbackName

    return {
        href,
        fileName,
    }
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
    { value: 'customer_authenticated', label: 'Cliente logueado' },
    { value: 'admin_internal', label: 'Interno' },
]

const conversationChannelOptions = [
    { value: '', label: 'Todos los canales' },
    { value: 'email', label: 'Email' },
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
    { key: 'email', label: 'Email' },
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

const LIST_PAGE_SIZE = 50
const LIST_REFRESH_INTERVAL_MS = 8000
const DETAIL_REFRESH_INTERVAL_MS = 6000

const upsertConversationSummary = (
    current: ConversationSummary[],
    next: ConversationSummary,
) => {
    const existingIndex = current.findIndex((item) => item.id === next.id)
    if (existingIndex === -1) {
        return [next, ...current]
    }

    const updated = [...current]
    updated[existingIndex] = {
        ...updated[existingIndex],
        ...next,
    }
    return updated
}

const mergeConversationSummaries = (
    current: ConversationSummary[],
    next: ConversationSummary[],
) => {
    const merged = new Map(current.map((item) => [item.id, item]))
    next.forEach((item) => {
        const previous = merged.get(item.id)
        merged.set(item.id, previous ? { ...previous, ...item } : item)
    })
    return Array.from(merged.values())
}

const buildConversationCollectionSignature = (items: ConversationSummary[]) =>
    items
        .map((item) =>
            [
                item.id,
                item.updatedAt,
                item.lastMessageAt,
                item.controlMode,
                item.status,
                item.isPinned ? '1' : '0',
                item.readState?.unreadCount ?? 0,
                item.latestMessage?.id ?? '',
                item.latestMessage?.authorType ?? '',
                item.latestMessage?.body ?? '',
            ].join('|'),
        )
        .join('::')

const buildListQuerySignature = (input: {
    search: string
    scope: string
    channel: string
    status: string
}) =>
    [
        input.search.trim().toLowerCase(),
        input.scope || 'all',
        input.channel || 'all',
        input.status || 'all',
    ].join('::')

let pendingConversationListScrollSnapshot: {
    conversationId: string
    scrollTop: number
    expiresAt: number
} | null = null

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
    const [listRefreshing, setListRefreshing] = useState(false)
    const [listLoadingMore, setListLoadingMore] = useState(false)
    const [listQueryPending, setListQueryPending] = useState(false)
    const [listTotal, setListTotal] = useState(0)
    const [listPage, setListPage] = useState(1)
    const [listError, setListError] = useState<string | null>(null)
    const [selectedConversation, setSelectedConversation] =
        useState<ConversationDetail | null>(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [replyBody, setReplyBody] = useState('')
    const [replyAttachments, setReplyAttachments] = useState<ReplyComposerAttachment[]>(
        [],
    )
    const [replyComposerError, setReplyComposerError] = useState<string | null>(null)
    const [replying, setReplying] = useState(false)
    const [channelActionLoadingKey, setChannelActionLoadingKey] =
        useState<string | null>(null)
    const [reactionDialogMessage, setReactionDialogMessage] =
        useState<ConversationMessageDetail | null>(null)
    const [reactionValue, setReactionValue] = useState('👍')
    const [forwardDialogMessage, setForwardDialogMessage] =
        useState<ConversationMessageDetail | null>(null)
    const [forwardTargets, setForwardTargets] = useState<ConversationSummary[]>([])
    const [forwardTargetsLoading, setForwardTargetsLoading] = useState(false)
    const [forwardTargetConversationId, setForwardTargetConversationId] = useState('')
    const [messageReplyDialogMessage, setMessageReplyDialogMessage] =
        useState<ConversationMessageDetail | null>(null)
    const [messageReplyBody, setMessageReplyBody] = useState('')
    const [messageEditDialogMessage, setMessageEditDialogMessage] =
        useState<ConversationMessageDetail | null>(null)
    const [messageEditBody, setMessageEditBody] = useState('')
    const [activeReplySuggestion, setActiveReplySuggestion] =
        useState<ApprovedReplySuggestion | null>(null)
    const [suggestionFeedbackLoadingId, setSuggestionFeedbackLoadingId] =
        useState<string | null>(null)
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
    const replyFileInputRef = useRef<HTMLInputElement | null>(null)
    const replyAudioInputRef = useRef<HTMLInputElement | null>(null)
    const listViewportRef = useRef<HTMLDivElement | null>(null)
    const autoScrolledConversationIdRef = useRef<string | null>(null)
    const manualSelectionIntentRef = useRef<{
        conversationId: string
        expiresAt: number
    } | null>(null)
    const preservedSelectionScrollRef = useRef<{
        conversationId: string
        scrollTop: number
        expiresAt: number
    } | null>(null)
    const listPageRef = useRef(1)
    const loadedConversationCountRef = useRef(0)
    const listLoadingRef = useRef(false)
    const listLoadingMoreRef = useRef(false)
    const listRefreshingRef = useRef(false)
    const activeListQuerySignatureRef = useRef('')
    const effectiveChannelFilter =
        filters.channel || (selectedChannel !== 'all' ? selectedChannel : '')
    const effectiveScopeFilter =
        filters.scope || (selectedChannel === 'admin_chat' ? 'admin_internal' : '')
    const usesClientSideOnlyPaginationFilter = selectedInboxId !== 'all'

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
        async (
            searchValue = search,
            options?: {
                silent?: boolean
                append?: boolean
                page?: number
                pageSize?: number
            },
        ) => {
            const requestedPage = options?.page ?? 1
            const requestSignature = buildListQuerySignature({
                search: searchValue,
                scope: effectiveScopeFilter,
                channel: effectiveChannelFilter,
                status: filters.status,
            })
            const isFreshQueryReset =
                !options?.append &&
                !options?.silent &&
                activeListQuerySignatureRef.current.length > 0 &&
                activeListQuerySignatureRef.current !== requestSignature
            activeListQuerySignatureRef.current = requestSignature
            const loadedConversationCount = Math.max(
                loadedConversationCountRef.current,
                listPageRef.current * LIST_PAGE_SIZE,
                LIST_PAGE_SIZE,
            )
            const requestedPageSize =
                options?.pageSize ??
                (options?.silent ? loadedConversationCount : LIST_PAGE_SIZE)

            if (
                options?.silent &&
                (listLoadingRef.current || listLoadingMoreRef.current)
            ) {
                return
            }

            if (isFreshQueryReset) {
                loadedConversationCountRef.current = 0
                listPageRef.current = 1
                setListPage(1)
                setListTotal(0)
                setItems([])
                autoScrolledConversationIdRef.current = null
            }

            if (options?.append) {
                setListLoadingMore(true)
                listLoadingMoreRef.current = true
            } else if (options?.silent) {
                setListRefreshing(true)
                listRefreshingRef.current = true
            } else {
                setListLoading(true)
                listLoadingRef.current = true
            }
            setListError(null)
            try {
                const conversationPromise = ConversationsService.fetchConversations({
                        page: requestedPage,
                        pageSize: requestedPageSize,
                        search: searchValue.trim() || undefined,
                        scope: effectiveScopeFilter || undefined,
                        channel: effectiveChannelFilter || undefined,
                        status: filters.status || undefined,
                    })

                const shouldRefreshSupportData =
                    !options?.silent && !options?.append && requestedPage === 1

                const [response, inboxResponse, queueResponse, usersResponse] =
                    shouldRefreshSupportData
                        ? await Promise.all([
                              conversationPromise,
                              ConversationsService.fetchInboxes(),
                              ConversationsService.fetchQueues(),
                              apiGetUsers<OperatorSummary[]>(),
                          ])
                        : await Promise.all([
                              conversationPromise,
                              Promise.resolve(null),
                              Promise.resolve(null),
                              Promise.resolve(null),
                          ])

                if (activeListQuerySignatureRef.current !== requestSignature) {
                    return
                }

                setListTotal(response.total)
                const nextPage = options?.append
                    ? requestedPage
                    : Math.max(
                          1,
                          Math.ceil(response.items.length / LIST_PAGE_SIZE) || 1,
                      )
                listPageRef.current = nextPage
                setListPage(nextPage)
                setItems((current) => {
                    const nextItems = options?.append
                        ? mergeConversationSummaries(current, response.items)
                        : response.items
                    loadedConversationCountRef.current = nextItems.length
                    const currentSignature = buildConversationCollectionSignature(current)
                    const nextSignature = buildConversationCollectionSignature(nextItems)
                    return currentSignature === nextSignature ? current : nextItems
                })
                if (inboxResponse) {
                    setInboxes(inboxResponse)
                }
                if (queueResponse) {
                    setQueues(queueResponse)
                }
                if (usersResponse) {
                    setOperators(usersResponse.data ?? [])
                }
            } catch (error) {
                console.error(error)
                setListError('No fue posible cargar conversaciones.')
            } finally {
                if (options?.append) {
                    setListLoadingMore(false)
                    listLoadingMoreRef.current = false
                } else if (options?.silent) {
                    setListRefreshing(false)
                    listRefreshingRef.current = false
                } else {
                    setListLoading(false)
                    listLoadingRef.current = false
                }
            }
        },
        [
            filters.status,
            effectiveChannelFilter,
            effectiveScopeFilter,
            search,
        ],
    )

    useEffect(() => {
        listPageRef.current = listPage
    }, [listPage])

    useEffect(() => {
        loadedConversationCountRef.current = items.length
    }, [items.length])

    useEffect(() => {
        listLoadingRef.current = listLoading
    }, [listLoading])

    useEffect(() => {
        listLoadingMoreRef.current = listLoadingMore
    }, [listLoadingMore])

    useEffect(() => {
        listRefreshingRef.current = listRefreshing
    }, [listRefreshing])

    const loadConversation = useCallback(
        async (
            id: string,
            options?: {
                silent?: boolean
            },
        ) => {
            if (!options?.silent) {
                setDetailLoading(true)
            }
            setDetailError(null)
            try {
                const response = await ConversationsService.fetchConversation(id)
                setSelectedConversation(response)
                setItems((current) => upsertConversationSummary(current, response))
            } catch (error) {
                console.error(error)
                if (!options?.silent) {
                    setSelectedConversation(null)
                    setDetailError(
                        'No fue posible cargar la conversación seleccionada.',
                    )
                }
            } finally {
                if (!options?.silent) {
                    setDetailLoading(false)
                }
            }
        },
        [],
    )

    useEffect(() => {
        if (selectedChannel === 'email') {
            setSelectedChannel('all')
        }
    }, [selectedChannel])

    useEffect(() => {
        if (selectedChannel === 'admin_chat' && selectedInboxId !== 'all') {
            setSelectedInboxId('all')
        }
    }, [selectedChannel, selectedInboxId])

    useEffect(() => {
        if (filters.channel === 'email') {
            setFilters((previous) => ({ ...previous, channel: '' }))
        }
        if (filterDraft.channel === 'email') {
            setFilterDraft((previous) => ({ ...previous, channel: '' }))
        }
    }, [filterDraft.channel, filters.channel])

    useEffect(() => {
        let cancelled = false
        setListQueryPending(true)

        const timeout = window.setTimeout(() => {
            void loadList(search).finally(() => {
                if (!cancelled) {
                    setListQueryPending(false)
                }
            })
        }, 220)

        return () => {
            cancelled = true
            window.clearTimeout(timeout)
        }
    }, [filters, loadList, search])

    useEffect(() => {
        if (!conversationId) {
            setSelectedConversation(null)
            setActiveReplySuggestion(null)
            return
        }
        setActiveReplySuggestion(null)
        void loadConversation(conversationId)
    }, [conversationId, loadConversation])

    useEffect(() => {
        const interval = window.setInterval(() => {
            if (document.visibilityState !== 'visible') {
                return
            }
            void loadList(search, { silent: true })
        }, LIST_REFRESH_INTERVAL_MS)

        return () => window.clearInterval(interval)
    }, [loadList, search])

    useEffect(() => {
        if (!conversationId) {
            return
        }

        const interval = window.setInterval(() => {
            if (document.visibilityState !== 'visible') {
                return
            }
            void loadConversation(conversationId, { silent: true })
        }, DETAIL_REFRESH_INTERVAL_MS)

        return () => window.clearInterval(interval)
    }, [conversationId, loadConversation])

    useEffect(() => {
        const refreshVisibleConversationState = () => {
            if (document.visibilityState !== 'visible') {
                return
            }

            void loadList(search, { silent: true })

            if (conversationId) {
                void loadConversation(conversationId, { silent: true })
            }
        }

        const handleVisibilityChange = () => {
            refreshVisibleConversationState()
        }

        const handleWindowFocus = () => {
            refreshVisibleConversationState()
        }

        window.addEventListener('focus', handleWindowFocus)
        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            window.removeEventListener('focus', handleWindowFocus)
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            )
        }
    }, [conversationId, loadConversation, loadList, search])

    const hasActiveFilters = useMemo(
        () => Boolean(filters.scope || filters.channel || filters.status),
        [filters.channel, filters.scope, filters.status],
    )
    const hasManualListContext = useMemo(
        () =>
            Boolean(
                search.trim().length > 0 ||
                    hasActiveFilters ||
                    selectedChannel !== 'all' ||
                    selectedInboxId !== 'all',
            ),
        [hasActiveFilters, search, selectedChannel, selectedInboxId],
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
                const matchesScope =
                    !effectiveScopeFilter ||
                    conversation.scope === effectiveScopeFilter
                const matchesChannel =
                    !effectiveChannelFilter ||
                    conversation.channel === effectiveChannelFilter
                const matchesStatus =
                    !filters.status || conversation.status === filters.status
                const matchesInbox =
                    effectiveChannelFilter === 'admin_chat' ||
                    selectedInboxId === 'all' ||
                    conversation.inboxAccount?.id === selectedInboxId ||
                    (selectedInboxId === 'virtual:webchat' &&
                        conversation.channel === 'webchat' &&
                        !conversation.inboxAccount)

                return (
                    matchesScope &&
                    matchesChannel &&
                    matchesStatus &&
                    matchesInbox
                )
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
    }, [
        effectiveChannelFilter,
        effectiveScopeFilter,
        filters.status,
        isConversationPinned,
        items,
        selectedInboxId,
    ])
    const hasMoreConversations =
        !usesClientSideOnlyPaginationFilter && items.length < listTotal
    const recentVisibleChats = useMemo(() => visibleItems.slice(0, 8), [visibleItems])
    const internalAssistantContact = useMemo(
        () =>
            contacts.find((contact) => contact.key === INTERNAL_ASSISTANT_CONTACT_KEY) ??
            INTERNAL_ASSISTANT_FALLBACK_CONTACT,
        [contacts],
    )
    const availableContacts = useMemo(
        () => [
            internalAssistantContact,
            ...contacts.filter((contact) => contact.key !== INTERNAL_ASSISTANT_CONTACT_KEY),
        ],
        [contacts, internalAssistantContact],
    )
    const menuConversation = useMemo(
        () => items.find((conversation) => conversation.id === menuConversationId) ?? null,
        [items, menuConversationId],
    )
    const selectedContact = useMemo(
        () =>
            availableContacts.find((contact) => contact.key === selectedContactKey) ??
            null,
        [availableContacts, selectedContactKey],
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
    const conversationThreadAudit = useMemo(
        () => buildConversationThreadAudit(selectedConversation),
        [selectedConversation],
    )
    const approvedReplySuggestions = useMemo(
        () => selectedConversation?.aiSuggestions?.items ?? [],
        [selectedConversation?.aiSuggestions],
    )
    const approvedReplySuggestionTarget = useMemo(() => {
        const raw = selectedConversation?.aiSuggestions?.targetMessageText
        if (typeof raw !== 'string' || !raw.trim()) {
            return null
        }

        return formatSuggestionPreview(raw, 160)
    }, [selectedConversation?.aiSuggestions?.targetMessageText])
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

    useEffect(() => {
        setReplyBody('')
        setReplyAttachments([])
        setReplyComposerError(null)
        setActiveReplySuggestion(null)
        setReactionDialogMessage(null)
        setForwardDialogMessage(null)
        setForwardTargets([])
        setForwardTargetConversationId('')
        setMessageReplyDialogMessage(null)
        setMessageReplyBody('')
        setMessageEditDialogMessage(null)
        setMessageEditBody('')
    }, [selectedConversation?.id])

    const renderMessageBody = (
        message: NonNullable<ConversationDetail>['messages'][number],
        authorType: string,
    ) => {
            const aiResponse = extractMessageAiResponse(message.metadata)
            const body =
                aiResponse?.finalUserText ||
                message.body ||
                message.normalizedText ||
                ''
            const assets = getMessageAssets(message.payload, message.metadata)
            const displayBody =
                isSyntheticAttachmentSummaryText(body) &&
                (assets.images.length > 0 ||
                    assets.audios.length > 0 ||
                    assets.videos.length > 0 ||
                    assets.attachments.length > 0)
                    ? ''
                    : body
            const deliveryState = extractMessageDeliveryState(message)
            const bodyColorClass =
                authorType === 'operator' ? 'text-slate-800' : 'text-slate-700'
            const payloadRecord = asRecord(message.payload)
            const metadataRecord = asRecord(message.metadata)
            const storedMessageElements = extractStoredMessageElements(
                message.payload,
                message.metadata,
            )
            const storedMessageContextOrigin = extractStoredMessageContextOrigin(
                message.payload,
                message.metadata,
            )
            const auditPayload = aiResponse?.auditPayload
            const stageHistory = Array.isArray(auditPayload?.stageHistory)
                ? auditPayload.stageHistory.filter(
                      (entry): entry is string => typeof entry === 'string',
                  )
                : []
            const referencedMessages = Array.isArray(auditPayload?.referencedMessages)
                ? auditPayload.referencedMessages
                      .map((entry) => asRecord(entry))
                      .filter(
                          (entry): entry is Record<string, unknown> => Boolean(entry),
                      )
                : []
            const decisionPath = Array.isArray(auditPayload?.decisionPath)
                ? auditPayload.decisionPath.filter(
                      (entry): entry is string => typeof entry === 'string',
                  )
                : []
            const messageElementsUsed = Array.isArray(auditPayload?.messageElementsUsed)
                ? auditPayload.messageElementsUsed.filter(
                      (entry): entry is string => typeof entry === 'string',
                  )
                : []
            const messageElements = Array.isArray(auditPayload?.messageElements)
                ? auditPayload.messageElements
                      .map((entry) => asRecord(entry))
                      .filter(
                          (entry): entry is Record<string, unknown> => Boolean(entry),
                      )
                : []
            const messageContextOrigin = Array.isArray(
                auditPayload?.messageContextOrigin,
            )
                ? auditPayload.messageContextOrigin.filter(
                      (entry): entry is string => typeof entry === 'string',
                  )
                : []
            const intentSource =
                typeof auditPayload?.intentSource === 'string'
                    ? auditPayload.intentSource
                    : null
            const intentConfidence =
                typeof auditPayload?.intentConfidence === 'number' &&
                Number.isFinite(auditPayload.intentConfidence)
                    ? auditPayload.intentConfidence
                    : null
            const turnInterpretation = asRecord(auditPayload?.turnInterpretation)
            const threadResolution = asRecord(turnInterpretation?.threadResolution)
            const quoteContext = asRecord(turnInterpretation?.quoteContext)
            const auditThreads = Array.isArray(threadResolution?.threads)
                ? threadResolution.threads
                      .map((entry) => asRecord(entry))
                      .filter(
                          (entry): entry is Record<string, unknown> => Boolean(entry),
                      )
                : []
            const auditThreadLabels = auditThreads
                .map((entry) => extractAuditThreadLabel(entry))
                .filter((entry): entry is string => Boolean(entry))
            const activeThreadLabel =
                extractAuditThreadLabel(threadResolution?.activeThread) ||
                asString(quoteContext?.topicLabel) ||
                asString(quoteContext?.familyLabel)
            const capturedSlotSummary = extractQuoteCapturedSlots(quoteContext).map(
                (entry) => `${entry.label}: ${entry.value}`,
            )
            const channelActions = extractChannelMessageActions(
                message,
                selectedConversation,
            )
            const messageReactions = extractChannelMessageReactions(message)
            const quotedMessage =
                asRecord(payloadRecord?.quotedMessage) ||
                asRecord(metadataRecord?.quotedMessage)
            const rawAttachmentEntries = Array.isArray(payloadRecord?.attachments)
                ? payloadRecord.attachments
                : Array.isArray(metadataRecord?.attachments)
                  ? metadataRecord.attachments
                  : []
            const firstDownloadableAttachmentIndex = rawAttachmentEntries.findIndex(
                (entry) => {
                    const attachmentRecord = asRecord(entry)
                    const attachmentMetadata = asRecord(attachmentRecord?.metadata)
                    return (
                        attachmentMetadata?.downloadable === true ||
                        typeof attachmentRecord?.url === 'string' ||
                        typeof attachmentRecord?.content === 'string'
                    )
                },
            )
            const hasContextAudit =
                storedMessageContextOrigin.length > 0 ||
                storedMessageElements.length > 0
            const hasRuntimeDebug = Boolean(aiResponse?.debugSummary)
            const hasAiDebugPanel = hasContextAudit || hasRuntimeDebug
            const showWhatsappMediaPlaceholder =
                channelActions.provider === 'whatsapp_qr' &&
                channelActions.canDownloadMedia &&
                !displayBody &&
                assets.images.length === 0 &&
                assets.audios.length === 0 &&
                assets.videos.length === 0 &&
                assets.attachments.length === 0
            const hasMessageActionMenu =
                channelActions.enabled &&
                (channelActions.canReply ||
                    channelActions.canReact ||
                    channelActions.canStar ||
                    channelActions.canForward ||
                    channelActions.canEdit ||
                    channelActions.canDelete ||
                    (channelActions.canDownloadMedia &&
                        firstDownloadableAttachmentIndex >= 0))

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
                    {quotedMessage ? (
                        <div className="conversation-whatsapp-quoted">
                            <div className="conversation-whatsapp-quoted-label">
                                Respuesta sobre mensaje anterior
                            </div>
                            {asString(quotedMessage.preview) ? (
                                <div className="conversation-whatsapp-quoted-preview">
                                    {asString(quotedMessage.preview)}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    {displayBody ? <div className="message-text">{displayBody}</div> : null}
                    {showWhatsappMediaPlaceholder ? (
                        <div className="conversation-whatsapp-media-placeholder">
                            Contenido multimedia de WhatsApp disponible para descargar.
                        </div>
                    ) : null}
                    {messageReactions.length ? (
                        <div className="conversation-message-reactions">
                            {messageReactions.map((reaction) => (
                                <span
                                    className="conversation-message-reaction-chip"
                                    key={`${message.id}:${reaction.emoji}`}
                                >
                                    <span>{reaction.emoji}</span>
                                    <span>{reaction.count}</span>
                                </span>
                            ))}
                        </div>
                    ) : null}
                    {deliveryState ? (
                        <div
                            className={`conversation-message-status ${
                                deliveryState.status === 'failed' ||
                                deliveryState.status === 'rejected'
                                    ? 'is-failed'
                                    : ''
                            }`}
                            data-testid={`admin-conversation-message-status-${message.id}`}
                        >
                            <span>{deliveryState.label}</span>
                            {deliveryState.errorMessage ? (
                                <span className="conversation-message-status-detail">
                                    {deliveryState.errorMessage}
                                </span>
                            ) : null}
                        </div>
                    ) : null}
                    {hasAiDebugPanel ? (
                        <details
                            className="conversation-ai-debug-panel"
                            data-testid={`admin-conversation-message-debug-panel-${message.id}`}
                        >
                            <summary className="conversation-ai-debug-summary">
                                <span>Contexto y debug</span>
                                <TbChevronDown size={16} />
                            </summary>
                            <div className="conversation-ai-debug-panel-body">
                                {hasContextAudit ? (
                                    <div
                                        className="conversation-ai-debug"
                                        data-testid={`admin-conversation-message-context-${message.id}`}
                                    >
                                        <div className="conversation-ai-debug-title">
                                            Contexto interpretado
                                        </div>
                                        {storedMessageContextOrigin.length ? (
                                            <div
                                                className="conversation-ai-debug-meta"
                                                data-testid={`admin-conversation-message-context-origin-${message.id}`}
                                            >
                                                Origen:{' '}
                                                {storedMessageContextOrigin.join(', ')}
                                            </div>
                                        ) : null}
                                        {storedMessageElements.length ? (
                                            <div
                                                className="conversation-ai-debug-meta"
                                                data-testid={`admin-conversation-message-elements-${message.id}`}
                                            >
                                                Elementos:{' '}
                                                {storedMessageElements
                                                    .map((entry) => {
                                                        const label =
                                                            typeof entry.label === 'string'
                                                                ? entry.label
                                                                : typeof entry.kind === 'string'
                                                                  ? entry.kind
                                                                  : 'elemento'
                                                        const preview =
                                                            typeof entry.preview === 'string'
                                                                ? entry.preview
                                                                : null
                                                        return `${label}${
                                                            preview ? ` (${preview})` : ''
                                                        }`
                                                    })
                                                    .join(' | ')}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                                {hasRuntimeDebug ? (
                                    <div
                                        className="conversation-ai-debug"
                                        data-testid={`admin-conversation-message-debug-${message.id}`}
                                    >
                                        <div className="conversation-ai-debug-title">
                                            Debug IA
                                        </div>
                                        <pre className="conversation-ai-debug-body">
                                            {aiResponse?.debugSummary}
                                        </pre>
                                        {formatAuditStageHistory(stageHistory) ? (
                                            <div className="conversation-ai-debug-meta">
                                                Etapas:{' '}
                                                {formatAuditStageHistory(stageHistory)}
                                            </div>
                                        ) : null}
                                        {referencedMessages.length ? (
                                            <div
                                                className="conversation-ai-debug-meta"
                                                data-testid={`admin-conversation-message-references-${message.id}`}
                                            >
                                                Referencias:{' '}
                                                {referencedMessages
                                                    .map((entry) => {
                                                        const preview =
                                                            typeof entry.preview === 'string'
                                                                ? entry.preview
                                                                : null
                                                        const messageId =
                                                            typeof entry.messageId === 'string'
                                                                ? entry.messageId
                                                                : null
                                                        return (
                                                            preview ||
                                                            messageId ||
                                                            'mensaje_reciente'
                                                        )
                                                    })
                                                    .join(' | ')}
                                            </div>
                                        ) : null}
                                        {intentSource ? (
                                            <div className="conversation-ai-debug-meta">
                                                Fuente de intención: {intentSource}
                                                {intentConfidence != null
                                                    ? ` · confianza ${intentConfidence.toFixed(2)}`
                                                    : ''}
                                            </div>
                                        ) : null}
                                        {decisionPath.length ? (
                                            <div className="conversation-ai-debug-meta">
                                                Decisión: {decisionPath.join(' → ')}
                                            </div>
                                        ) : null}
                                        {messageContextOrigin.length ? (
                                            <div className="conversation-ai-debug-meta">
                                                Origen de contexto:{' '}
                                                {messageContextOrigin.join(', ')}
                                            </div>
                                        ) : null}
                                        {messageElementsUsed.length ? (
                                            <div className="conversation-ai-debug-meta">
                                                Elementos usados:{' '}
                                                {messageElementsUsed.join(', ')}
                                            </div>
                                        ) : null}
                                        {messageElements.length ? (
                                            <div className="conversation-ai-debug-meta">
                                                Elementos:{' '}
                                                {messageElements
                                                    .map((entry) => {
                                                        const label =
                                                            typeof entry.label === 'string'
                                                                ? entry.label
                                                                : null
                                                        const kind =
                                                            typeof entry.kind === 'string'
                                                                ? entry.kind
                                                                : 'elemento'
                                                        const preview =
                                                            typeof entry.preview === 'string'
                                                                ? entry.preview
                                                                : null
                                                        return `${label || kind}${
                                                            preview ? ` (${preview})` : ''
                                                        }`
                                                    })
                                                    .join(' | ')}
                                            </div>
                                        ) : null}
                                        {auditThreadLabels.length ? (
                                            <div
                                                className="conversation-ai-debug-meta"
                                                data-testid={`admin-conversation-message-threads-${message.id}`}
                                            >
                                                Hilos detectados: {auditThreadLabels.join(' | ')}
                                            </div>
                                        ) : null}
                                        {activeThreadLabel ? (
                                            <div
                                                className="conversation-ai-debug-meta"
                                                data-testid={`admin-conversation-message-active-thread-${message.id}`}
                                            >
                                                Hilo activo: {activeThreadLabel}
                                            </div>
                                        ) : null}
                                        {threadResolution?.switchDetected ? (
                                            <div
                                                className="conversation-ai-debug-meta"
                                                data-testid={`admin-conversation-message-thread-switch-${message.id}`}
                                            >
                                                Cambio de hilo detectado
                                            </div>
                                        ) : null}
                                        {threadResolution?.requiresDisambiguation ? (
                                            <div
                                                className="conversation-ai-debug-meta"
                                                data-testid={`admin-conversation-message-disambiguation-${message.id}`}
                                            >
                                                Disambiguación solicitada
                                                {asString(threadResolution?.promptText)
                                                    ? `: ${asString(threadResolution?.promptText)}`
                                                    : ''}
                                            </div>
                                        ) : null}
                                        {capturedSlotSummary.length ? (
                                            <div
                                                className="conversation-ai-debug-meta"
                                                data-testid={`admin-conversation-message-slots-${message.id}`}
                                            >
                                                Slots capturados: {capturedSlotSummary.join(' | ')}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                        </details>
                    ) : null}
                    {assets.images.map((image, index) => (
                        <a
                            href={image.url}
                            target="_blank"
                            rel="noreferrer"
                            data-testid={`admin-conversation-image-${message.id}-${index}`}
                            key={`${image.url}:${image.fileName ?? index}`}
                        >
                            <img
                                className="message-image"
                                src={image.url}
                                alt={image.fileName || 'Imagen'}
                            />
                        </a>
                    ))}
                    {assets.audios.map((audio, index) => (
                        <div
                            className="message-audio mt-3"
                            data-testid={`admin-conversation-audio-${message.id}-${index}`}
                            key={`${audio.url}:${audio.fileName ?? index}`}
                        >
                            <audio controls src={audio.url}>
                                <track kind="captions" />
                                Tu navegador no soporta audio embebido.
                            </audio>
                        </div>
                    ))}
                    {assets.videos.map((video, index) => (
                        <div
                            className="message-video mt-3"
                            data-testid={`admin-conversation-video-${message.id}-${index}`}
                            key={`${video.url}:${video.fileName ?? index}`}
                        >
                            <video
                                controls
                                poster={video.posterUrl || undefined}
                                src={video.url}
                            >
                                <track kind="captions" />
                                Tu navegador no soporta video embebido.
                            </video>
                        </div>
                    ))}
                    {attachmentNodes}
                    {hasMessageActionMenu ? (
                        <div className="conversation-message-action-menu">
                            <Dropdown
                                placement="bottom-end"
                                renderTitle={
                                    <button
                                        type="button"
                                        className="conversation-message-action-toggle"
                                        data-testid={`admin-conversation-message-actions-${message.id}`}
                                        disabled={Boolean(channelActionLoadingKey)}
                                    >
                                        <TbDotsVertical size={16} />
                                    </button>
                                }
                            >
                                {channelActions.canReply ? (
                                    <Dropdown.Item
                                        eventKey={`reply-${message.id}`}
                                        onClick={() => openMessageReplyDialog(message)}
                                        data-testid={`admin-conversation-message-reply-${message.id}`}
                                    >
                                        <span className="conversation-message-action-item">
                                            <TbMessageReply size={15} />
                                            <span>Responder</span>
                                        </span>
                                    </Dropdown.Item>
                                ) : null}
                                {channelActions.canReact ? (
                                    <Dropdown.Item
                                        eventKey={`react-${message.id}`}
                                        onClick={() => openReactionDialog(message)}
                                        data-testid={`admin-conversation-message-react-${message.id}`}
                                    >
                                        <span className="conversation-message-action-item">
                                            <TbMoodSmile size={15} />
                                            <span>Reaccionar</span>
                                        </span>
                                    </Dropdown.Item>
                                ) : null}
                                {channelActions.canStar ? (
                                    <Dropdown.Item
                                        eventKey={`star-${message.id}`}
                                        onClick={() =>
                                            void toggleChannelMessageStar(message)
                                        }
                                        data-testid={`admin-conversation-message-star-${message.id}`}
                                    >
                                        <span className="conversation-message-action-item">
                                            <TbSparkles size={15} />
                                            <span>
                                                {channelActions.starred
                                                    ? 'Quitar destacado'
                                                    : 'Destacar'}
                                            </span>
                                        </span>
                                    </Dropdown.Item>
                                ) : null}
                                {channelActions.canForward ? (
                                    <Dropdown.Item
                                        eventKey={`forward-${message.id}`}
                                        onClick={() => void openForwardDialog(message)}
                                        data-testid={`admin-conversation-message-forward-${message.id}`}
                                    >
                                        <span className="conversation-message-action-item">
                                            <TbShare3 size={15} />
                                            <span>Reenviar</span>
                                        </span>
                                    </Dropdown.Item>
                                ) : null}
                                {channelActions.canEdit ? (
                                    <Dropdown.Item
                                        eventKey={`edit-${message.id}`}
                                        onClick={() => openMessageEditDialog(message)}
                                        data-testid={`admin-conversation-message-edit-${message.id}`}
                                    >
                                        <span className="conversation-message-action-item">
                                            <TbPencil size={15} />
                                            <span>Editar</span>
                                        </span>
                                    </Dropdown.Item>
                                ) : null}
                                {channelActions.canDelete ? (
                                    <Dropdown.Item
                                        eventKey={`delete-${message.id}`}
                                        onClick={() => void deleteChannelMessage(message)}
                                        data-testid={`admin-conversation-message-delete-${message.id}`}
                                    >
                                        <span className="conversation-message-action-item is-danger">
                                            <TbX size={15} />
                                            <span>Eliminar</span>
                                        </span>
                                    </Dropdown.Item>
                                ) : null}
                                {channelActions.canDownloadMedia &&
                                firstDownloadableAttachmentIndex >= 0 ? (
                                    <Dropdown.Item
                                        eventKey={`download-${message.id}`}
                                        onClick={() =>
                                            void downloadChannelAttachment(
                                                message,
                                                rawAttachmentEntries,
                                                firstDownloadableAttachmentIndex,
                                            )
                                        }
                                        data-testid={`admin-conversation-message-download-${message.id}`}
                                    >
                                        <span className="conversation-message-action-item">
                                            <TbDownload size={15} />
                                            <span>Descargar</span>
                                        </span>
                                    </Dropdown.Item>
                                ) : null}
                            </Dropdown>
                        </div>
                    ) : null}
                </div>
            )
    }

    useEffect(() => {
        const manualSelectionIntent = manualSelectionIntentRef.current
        if (
            manualSelectionIntent &&
            manualSelectionIntent.expiresAt <= Date.now()
        ) {
            manualSelectionIntentRef.current = null
        }

        if (!conversationId) {
            if (isMobile) {
                return
            }
            if (manualSelectionIntentRef.current) {
                return
            }
            if (hasManualListContext) {
                return
            }
            if (visibleItems[0]) {
                navigate(`${appPath('crm/conversations/')}${visibleItems[0].id}`, {
                    replace: true,
                })
            }
            return
        }

        if (
            listLoading ||
            listRefreshing ||
            listLoadingMore ||
            manualSelectionIntentRef.current ||
            preservedSelectionScrollRef.current?.conversationId === conversationId ||
            pendingConversationListScrollSnapshot?.conversationId === conversationId ||
            hasManualListContext
        ) {
            return
        }

        if (
            visibleItems.length > 0 &&
            !visibleItems.some((conversation) => conversation.id === conversationId)
        ) {
            navigate(`${appPath('crm/conversations/')}${visibleItems[0].id}`, {
                replace: true,
            })
        }
    }, [
        conversationId,
        hasManualListContext,
        hasActiveFilters,
        isMobile,
        listLoading,
        listLoadingMore,
        listRefreshing,
        navigate,
        search,
        visibleItems,
    ])

    useLayoutEffect(() => {
        if (!conversationId || listLoading) {
            return
        }

        if (
            manualSelectionIntentRef.current?.conversationId === conversationId &&
            manualSelectionIntentRef.current.expiresAt > Date.now()
        ) {
            manualSelectionIntentRef.current = null
        }

        const preservedSelectionScroll =
            preservedSelectionScrollRef.current ??
            pendingConversationListScrollSnapshot
        if (preservedSelectionScroll?.conversationId === conversationId) {
            autoScrolledConversationIdRef.current = conversationId
            let frame = 0

            const keepListScrollStable = () => {
                const viewport = listViewportRef.current
                if (!viewport) {
                    preservedSelectionScrollRef.current = null
                    pendingConversationListScrollSnapshot = null
                    return
                }

                if (
                    Math.abs(
                        viewport.scrollTop - preservedSelectionScroll.scrollTop,
                    ) > 1
                ) {
                    viewport.scrollTop = preservedSelectionScroll.scrollTop
                }

                if (Date.now() >= preservedSelectionScroll.expiresAt) {
                    preservedSelectionScrollRef.current = null
                    pendingConversationListScrollSnapshot = null
                    return
                }

                frame = window.requestAnimationFrame(keepListScrollStable)
            }

            frame = window.requestAnimationFrame(keepListScrollStable)

            return () => window.cancelAnimationFrame(frame)
        }

        if (hasManualListContext) {
            autoScrolledConversationIdRef.current = conversationId
            return
        }

        if (autoScrolledConversationIdRef.current === conversationId) {
            return
        }

        const activeButton = conversationButtonRefs.current[conversationId]
        if (!activeButton) {
            return
        }

        autoScrolledConversationIdRef.current = conversationId

        const frame = window.requestAnimationFrame(() => {
            activeButton.scrollIntoView({
                block: 'nearest',
                inline: 'nearest',
                behavior: 'auto',
            })
        })

        return () => window.cancelAnimationFrame(frame)
    }, [conversationId, hasManualListContext, listLoading, visibleItems.length])

    const handleListScroll = useCallback(
        (event: UIEvent<HTMLDivElement>) => {
            const viewport = event.currentTarget
            const remaining =
                viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
            if (
                remaining > 180 ||
                listLoading ||
                listLoadingMore ||
                listRefreshing ||
                !hasMoreConversations
            ) {
                return
            }

            void loadList(search, {
                append: true,
                page: listPage + 1,
                pageSize: LIST_PAGE_SIZE,
            })
        },
        [
            hasMoreConversations,
            listLoading,
            listLoadingMore,
            listPage,
            listRefreshing,
            loadList,
            search,
        ],
    )

    const handleSelectConversation = (id: string) => {
        if (bulkSelectionMode) {
            setBulkSelectionIds((current) =>
                current.includes(id)
                    ? current.filter((entry) => entry !== id)
                    : [...current, id],
            )
            return
        }

        if (listLoading && items.length === 0) {
            return
        }

        if (listViewportRef.current) {
            const nextSnapshot = {
                conversationId: id,
                scrollTop: listViewportRef.current.scrollTop,
                expiresAt: Date.now() + 2500,
            }
            preservedSelectionScrollRef.current = nextSnapshot
            pendingConversationListScrollSnapshot = nextSnapshot
        }
        manualSelectionIntentRef.current = {
            conversationId: id,
            expiresAt: Date.now() + 2500,
        }
        autoScrolledConversationIdRef.current = id

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

        navigate(`${appPath('crm/conversations/')}${id}`)
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
        if (!selectedConversation || (!replyBody.trim() && replyAttachments.length === 0)) {
            return
        }
        setReplying(true)
        try {
            const normalizedReply = replyBody.trim()
            const outgoingAttachments = replyAttachments.map(
                ({ localId, size, ...attachment }) => attachment,
            )
            const aiSuggestionFeedback = activeReplySuggestion
                ? {
                      candidateId: activeReplySuggestion.id,
                      targetMessageId:
                          selectedConversation.aiSuggestions?.targetMessageId ?? null,
                      targetMessageText:
                          selectedConversation.aiSuggestions?.targetMessageText ??
                          null,
                      suggestedText: activeReplySuggestion.responseText,
                      outcome:
                          normalizedReply ===
                          activeReplySuggestion.responseText.trim()
                              ? ('used' as const)
                              : ('edited' as const),
                  }
                : undefined
            const updated = await ConversationsService.replyToConversation(
                selectedConversation.id,
                normalizedReply,
                aiSuggestionFeedback,
                outgoingAttachments,
            )
            syncConversation(updated)
            setReplyBody('')
            setReplyAttachments([])
            setReplyComposerError(null)
            setActiveReplySuggestion(null)
        } catch (error) {
            console.error(error)
        } finally {
            setReplying(false)
        }
    }

    const openReplyFilePicker = useCallback(() => {
        replyFileInputRef.current?.click()
    }, [])

    const openReplyAudioPicker = useCallback(() => {
        replyAudioInputRef.current?.click()
    }, [])

    const removeReplyAttachment = useCallback((attachmentId: string) => {
        setReplyAttachments((current) =>
            current.filter((attachment) => attachment.localId !== attachmentId),
        )
    }, [])

    const handleReplyFilesSelected = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const selected = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (!selected.length) {
                return
            }

            setReplyComposerError(null)

            if (replyAttachments.length + selected.length > MAX_REPLY_ATTACHMENTS) {
                setReplyComposerError(
                    `Puedes adjuntar hasta ${MAX_REPLY_ATTACHMENTS} archivos por mensaje.`,
                )
                return
            }

            const oversized = selected.find(
                (file) => file.size > MAX_REPLY_ATTACHMENT_BYTES,
            )
            if (oversized) {
                setReplyComposerError(
                    `${oversized.name} supera el límite de ${Math.round(
                        MAX_REPLY_ATTACHMENT_BYTES / (1024 * 1024),
                    )} MB.`,
                )
                return
            }

            try {
                const built = await Promise.all(
                    selected.map((file) => buildReplyAttachmentFromFile(file)),
                )
                setReplyAttachments((current) => [...current, ...built])
            } catch (error) {
                console.error(error)
                setReplyComposerError(
                    'No fue posible preparar uno de los archivos adjuntos.',
                )
            }
        },
        [replyAttachments.length],
    )

    const syncConversation = useCallback((detail: ConversationDetail) => {
        setSelectedConversation(detail)
        setItems((current) => upsertConversationSummary(current, detail))
    }, [])

    const refreshSelectedConversation = useCallback(async () => {
        if (!selectedConversation) {
            return null
        }
        const detail = await ConversationsService.fetchConversation(
            selectedConversation.id,
        )
        syncConversation(detail)
        return detail
    }, [selectedConversation, syncConversation])

    const pushConversationToast = useCallback(
        (type: 'success' | 'danger', title: string, message?: string) => {
            toast.push(
                <Notification type={type} title={title}>
                    {message}
                </Notification>,
            )
        },
        [],
    )

    const openReactionDialog = useCallback((message: ConversationMessageDetail) => {
        setReactionValue(DEFAULT_WHATSAPP_REACTION_OPTIONS[0] || '👍')
        setReactionDialogMessage(message)
    }, [])

    const submitReaction = useCallback(async () => {
        if (!selectedConversation || !reactionDialogMessage || !reactionValue.trim()) {
            return
        }

        const actions = extractChannelMessageActions(
            reactionDialogMessage,
            selectedConversation,
        )
        const actionKey = `react:${reactionDialogMessage.id}`
        setChannelActionLoadingKey(actionKey)
        try {
            if (actions.provider === 'whatsapp_qr') {
                await ConversationsService.reactToWhatsappMessage(
                    selectedConversation.id,
                    reactionDialogMessage.id,
                    reactionValue.trim(),
                )
            } else if (actions.provider === 'webchat') {
                await ConversationsService.reactToWebchatMessage(
                    selectedConversation.id,
                    reactionDialogMessage.id,
                    reactionValue.trim(),
                )
            } else {
                throw new Error('channel.reactionUnsupported')
            }
            await refreshSelectedConversation()
            pushConversationToast(
                'success',
                'Reacción enviada',
                `Se agregó ${reactionValue.trim()} al mensaje seleccionado.`,
            )
            setReactionDialogMessage(null)
        } catch (error) {
            console.error(error)
            pushConversationToast(
                'danger',
                'No fue posible reaccionar',
                actions.provider === 'webchat'
                    ? 'La reacción no pudo registrarse en el Webchat.'
                    : 'La reacción no pudo enviarse por WhatsApp.',
            )
        } finally {
            setChannelActionLoadingKey(null)
        }
    }, [
        refreshSelectedConversation,
        pushConversationToast,
        reactionDialogMessage,
        reactionValue,
        selectedConversation,
    ])

    const openForwardDialog = useCallback(
        async (message: ConversationMessageDetail) => {
            if (!selectedConversation) {
                return
            }

            setForwardDialogMessage(message)
            setForwardTargetConversationId('')
            setForwardTargetsLoading(true)

            try {
                const response = await ConversationsService.fetchConversations({
                    channel: 'whatsapp',
                    page: 1,
                    pageSize: 100,
                })

                setForwardTargets(
                    response.items.filter(
                        (conversation) =>
                            conversation.id !== selectedConversation.id &&
                            isWhatsappQrConversation(conversation),
                    ),
                )
            } catch (error) {
                console.error(error)
                setForwardTargets([])
                pushConversationToast(
                    'danger',
                    'No fue posible cargar destinos',
                    'No pudimos listar las conversaciones disponibles para reenvío.',
                )
            } finally {
                setForwardTargetsLoading(false)
            }
        },
        [pushConversationToast, selectedConversation],
    )

    const submitForward = useCallback(async () => {
        if (
            !selectedConversation ||
            !forwardDialogMessage ||
            !forwardTargetConversationId
        ) {
            return
        }

        const actionKey = `forward:${forwardDialogMessage.id}`
        setChannelActionLoadingKey(actionKey)
        try {
            const result = await ConversationsService.forwardWhatsappMessage(
                selectedConversation.id,
                forwardDialogMessage.id,
                forwardTargetConversationId,
            )
            setForwardDialogMessage(null)
            setForwardTargetConversationId('')
            pushConversationToast(
                'success',
                'Mensaje reenviado',
                `El mensaje se reenvió a la conversación ${result.targetConversationId}.`,
            )
            if (selectedConversation.id === result.targetConversationId) {
                const detail = await ConversationsService.fetchConversation(
                    result.targetConversationId,
                )
                syncConversation(detail)
            }
        } catch (error) {
            console.error(error)
            pushConversationToast(
                'danger',
                'No fue posible reenviar',
                'El mensaje no pudo reenviarse por WhatsApp.',
            )
        } finally {
            setChannelActionLoadingKey(null)
        }
    }, [
        forwardDialogMessage,
        forwardTargetConversationId,
        pushConversationToast,
        selectedConversation,
        syncConversation,
    ])

    const downloadChannelAttachment = useCallback(
        async (
            message: ConversationMessageDetail,
            rawAttachmentEntries: unknown[],
            attachmentIndex: number,
        ) => {
            if (!selectedConversation) {
                return
            }

            const actions = extractChannelMessageActions(message, selectedConversation)
            const actionKey = `download:${message.id}:${attachmentIndex}`
            setChannelActionLoadingKey(actionKey)

            try {
                if (actions.provider === 'webchat') {
                    const localDownload = resolveLocalAttachmentDownload(
                        rawAttachmentEntries[attachmentIndex],
                        `webchat-media-${message.id}`,
                    )
                    if (!localDownload) {
                        throw new Error('webchat.mediaUnavailable')
                    }
                    triggerHrefDownload(
                        localDownload.href,
                        localDownload.fileName,
                    )
                } else {
                    const response =
                        await ConversationsService.downloadWhatsappMessageMedia(
                            selectedConversation.id,
                            message.id,
                            attachmentIndex,
                        )
                    const contentDisposition =
                        response.headers['content-disposition'] ||
                        response.headers['Content-Disposition']
                    const fileNameMatch =
                        typeof contentDisposition === 'string'
                            ? contentDisposition.match(
                                  /filename\*=UTF-8''([^;]+)/i,
                              ) ||
                              contentDisposition.match(/filename="?([^"]+)"?/i)
                            : null
                    const fileName = fileNameMatch?.[1]
                        ? decodeURIComponent(fileNameMatch[1])
                        : `whatsapp-media-${message.id}`
                    saveBlobDownload(response.data, fileName)
                }
            } catch (error) {
                console.error(error)
                pushConversationToast(
                    'danger',
                    'No fue posible descargar',
                    actions.provider === 'webchat'
                        ? 'El contenido adjunto no pudo descargarse desde el Webchat.'
                        : 'El contenido multimedia no pudo descargarse.',
                )
            } finally {
                setChannelActionLoadingKey(null)
            }
        },
        [pushConversationToast, selectedConversation],
    )

    const openMessageReplyDialog = useCallback(
        (message: ConversationMessageDetail) => {
            setMessageReplyDialogMessage(message)
            setMessageReplyBody('')
        },
        [],
    )

    const submitMessageReply = useCallback(async () => {
        if (
            !selectedConversation ||
            !messageReplyDialogMessage ||
            !messageReplyBody.trim()
        ) {
            return
        }

        const actions = extractChannelMessageActions(
            messageReplyDialogMessage,
            selectedConversation,
        )
        const actionKey = `reply:${messageReplyDialogMessage.id}`
        setChannelActionLoadingKey(actionKey)
        try {
            if (actions.provider === 'whatsapp_qr') {
                await ConversationsService.replyToWhatsappMessage(
                    selectedConversation.id,
                    messageReplyDialogMessage.id,
                    messageReplyBody.trim(),
                )
            } else if (actions.provider === 'webchat') {
                await ConversationsService.replyToWebchatMessage(
                    selectedConversation.id,
                    messageReplyDialogMessage.id,
                    messageReplyBody.trim(),
                )
            } else {
                throw new Error('channel.messageReplyUnsupported')
            }
            await refreshSelectedConversation()
            setMessageReplyDialogMessage(null)
            setMessageReplyBody('')
            pushConversationToast(
                'success',
                'Respuesta enviada',
                actions.provider === 'webchat'
                    ? 'La respuesta citada quedó enviada en el Webchat.'
                    : 'La respuesta citada se envió por WhatsApp.',
            )
        } catch (error) {
            console.error(error)
            pushConversationToast(
                'danger',
                'No fue posible responder',
                actions.provider === 'webchat'
                    ? 'La respuesta citada no pudo enviarse en el Webchat.'
                    : 'La respuesta citada no pudo enviarse por WhatsApp.',
            )
        } finally {
            setChannelActionLoadingKey(null)
        }
    }, [
        messageReplyBody,
        messageReplyDialogMessage,
        pushConversationToast,
        refreshSelectedConversation,
        selectedConversation,
    ])

    const openMessageEditDialog = useCallback(
        (message: ConversationMessageDetail) => {
            setMessageEditDialogMessage(message)
            setMessageEditBody(
                message.body?.trim() || message.normalizedText?.trim() || '',
            )
        },
        [],
    )

    const submitMessageEdit = useCallback(async () => {
        if (
            !selectedConversation ||
            !messageEditDialogMessage ||
            !messageEditBody.trim()
        ) {
            return
        }

        const actions = extractChannelMessageActions(
            messageEditDialogMessage,
            selectedConversation,
        )
        const actionKey = `edit:${messageEditDialogMessage.id}`
        setChannelActionLoadingKey(actionKey)
        try {
            if (actions.provider === 'whatsapp_qr') {
                await ConversationsService.editWhatsappMessage(
                    selectedConversation.id,
                    messageEditDialogMessage.id,
                    messageEditBody.trim(),
                )
            } else if (actions.provider === 'webchat') {
                await ConversationsService.editWebchatMessage(
                    selectedConversation.id,
                    messageEditDialogMessage.id,
                    messageEditBody.trim(),
                )
            } else {
                throw new Error('channel.messageEditUnsupported')
            }
            await refreshSelectedConversation()
            setMessageEditDialogMessage(null)
            setMessageEditBody('')
            pushConversationToast(
                'success',
                'Mensaje editado',
                actions.provider === 'webchat'
                    ? 'El mensaje se actualizó en el Webchat.'
                    : 'El mensaje se actualizó en WhatsApp.',
            )
        } catch (error) {
            console.error(error)
            pushConversationToast(
                'danger',
                'No fue posible editar',
                actions.provider === 'webchat'
                    ? 'El mensaje no pudo editarse en el Webchat.'
                    : 'El mensaje no pudo editarse en WhatsApp.',
            )
        } finally {
            setChannelActionLoadingKey(null)
        }
    }, [
        messageEditBody,
        messageEditDialogMessage,
        pushConversationToast,
        refreshSelectedConversation,
        selectedConversation,
    ])

    const deleteChannelMessage = useCallback(
        async (message: ConversationMessageDetail) => {
            if (!selectedConversation) {
                return
            }
            const actions = extractChannelMessageActions(message, selectedConversation)
            const confirmationMessage =
                actions.provider === 'webchat'
                    ? '¿Eliminar este mensaje del Webchat?'
                    : '¿Eliminar este mensaje para todos en WhatsApp?'
            if (!window.confirm(confirmationMessage)) {
                return
            }

            const actionKey = `delete:${message.id}`
            setChannelActionLoadingKey(actionKey)
            try {
                if (actions.provider === 'whatsapp_qr') {
                    await ConversationsService.deleteWhatsappMessage(
                        selectedConversation.id,
                        message.id,
                    )
                } else if (actions.provider === 'webchat') {
                    await ConversationsService.deleteWebchatMessage(
                        selectedConversation.id,
                        message.id,
                    )
                } else {
                    throw new Error('channel.messageDeleteUnsupported')
                }
                await refreshSelectedConversation()
                pushConversationToast(
                    'success',
                    'Mensaje eliminado',
                    actions.provider === 'webchat'
                        ? 'El mensaje se eliminó en el Webchat.'
                        : 'El mensaje se eliminó en WhatsApp.',
                )
            } catch (error) {
                console.error(error)
                pushConversationToast(
                    'danger',
                    'No fue posible eliminar',
                    actions.provider === 'webchat'
                        ? 'El mensaje no pudo eliminarse en el Webchat.'
                        : 'El mensaje no pudo eliminarse en WhatsApp.',
                )
            } finally {
                setChannelActionLoadingKey(null)
            }
        },
        [pushConversationToast, refreshSelectedConversation, selectedConversation],
    )

    const toggleChannelMessageStar = useCallback(
        async (message: ConversationMessageDetail) => {
            if (!selectedConversation) {
                return
            }

            const actions = extractChannelMessageActions(message, selectedConversation)
            const nextStarred = !actions.starred
            const actionKey = `star:${message.id}`
            setChannelActionLoadingKey(actionKey)
            try {
                if (actions.provider === 'whatsapp_qr') {
                    await ConversationsService.toggleWhatsappMessageStar(
                        selectedConversation.id,
                        message.id,
                        nextStarred,
                    )
                } else if (actions.provider === 'webchat') {
                    await ConversationsService.toggleWebchatMessageStar(
                        selectedConversation.id,
                        message.id,
                        nextStarred,
                    )
                } else {
                    throw new Error('channel.messageStarUnsupported')
                }
                await refreshSelectedConversation()
                pushConversationToast(
                    'success',
                    nextStarred ? 'Mensaje destacado' : 'Mensaje sin destacar',
                )
            } catch (error) {
                console.error(error)
                pushConversationToast(
                    'danger',
                    'No fue posible actualizar el destacado',
                )
            } finally {
                setChannelActionLoadingKey(null)
            }
        },
        [pushConversationToast, refreshSelectedConversation, selectedConversation],
    )

    const runChannelChatAction = useCallback(
        async (
            conversationId: string,
            actionKey: string,
            action: () => Promise<unknown>,
            successTitle: string,
            successMessage?: string,
        ) => {
            setActionLoading(actionKey)
            try {
                await action()
                if (selectedConversation?.id === conversationId) {
                    await refreshSelectedConversation()
                } else {
                    const detail =
                        await ConversationsService.fetchConversation(conversationId)
                    setItems((current) => upsertConversationSummary(current, detail))
                }
                setIsConversationMenuOpen(false)
                pushConversationToast('success', successTitle, successMessage)
            } catch (error) {
                console.error(error)
                pushConversationToast(
                    'danger',
                    'No fue posible ejecutar la acción del chat',
                )
            } finally {
                setActionLoading(null)
            }
        },
        [
            pushConversationToast,
            refreshSelectedConversation,
            selectedConversation,
        ],
    )

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

    const applyReplySuggestion = useCallback(
        (suggestion: ApprovedReplySuggestion) => {
            setReplyBody(suggestion.responseText)
            setActiveReplySuggestion(suggestion)
            requestAnimationFrame(() => {
                focusReplyInput()
            })
        },
        [focusReplyInput],
    )

    const dismissReplySuggestion = useCallback(
        async (suggestion: ApprovedReplySuggestion) => {
            if (!selectedConversation) {
                return
            }

            setSuggestionFeedbackLoadingId(suggestion.id)
            try {
                await ConversationsService.recordConversationSuggestionFeedback(
                    selectedConversation.id,
                    {
                        candidateId: suggestion.id,
                        outcome: 'discarded',
                        targetMessageId:
                            selectedConversation.aiSuggestions?.targetMessageId ?? null,
                        targetMessageText:
                            selectedConversation.aiSuggestions?.targetMessageText ??
                            null,
                        suggestedText: suggestion.responseText,
                    },
                )

                setSelectedConversation((current) => {
                    if (!current?.aiSuggestions) {
                        return current
                    }

                    return {
                        ...current,
                        aiSuggestions: {
                            ...current.aiSuggestions,
                            items: current.aiSuggestions.items.filter(
                                (entry) => entry.id !== suggestion.id,
                            ),
                        },
                    }
                })

                if (activeReplySuggestion?.id === suggestion.id) {
                    setActiveReplySuggestion(null)
                    setReplyBody((current) =>
                        current.trim() === suggestion.responseText.trim()
                            ? ''
                            : current,
                    )
                }
            } catch (error) {
                console.error(error)
            } finally {
                setSuggestionFeedbackLoadingId(null)
            }
        },
        [activeReplySuggestion?.id, selectedConversation],
    )

    const handleApplyFilters = async () => {
        setListQueryPending(true)
        setFilters(filterDraft)
        setSearch(filterDraft.searchText)
        setIsFilterOpen(false)
    }

    const handleResetFilters = async () => {
        setListQueryPending(true)
        setFilterDraft(defaultFilters)
        setFilters(defaultFilters)
        setSearch('')
        setIsFilterOpen(false)
    }

    const handleCreateNewChat = async () => {
        const selectedContact =
            availableContacts.find((contact) => contact.key === selectedContactKey) ??
            null
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
            navigate(`${appPath('crm/conversations/')}${created.id}`)
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
        setSelectedContactKey(INTERNAL_ASSISTANT_CONTACT_KEY)
        setNewChatForm({ message: '' })
    }

    const selectChannel = (channel: string, options?: { closeDirectory?: boolean }) => {
        setListQueryPending(true)
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
            setListQueryPending(true)
            setSelectedChannel(channel)
        }
        setListQueryPending(true)
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
                        if (previous === INTERNAL_ASSISTANT_CONTACT_KEY) {
                            return previous
                        }
                        return response.items[0]?.key ?? INTERNAL_ASSISTANT_CONTACT_KEY
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

            {buildHandoffTaskSummary(selectedConversation) ? (
                <div className="management-block">
                    <div className="management-label">Resumen de tarea</div>
                    <div
                        className="management-summary-card"
                        data-testid="admin-conversation-task-summary-detail"
                    >
                        <p>{buildHandoffTaskSummary(selectedConversation)}</p>
                        <button
                            className="drawer-secondary-btn"
                            type="button"
                            data-testid="admin-conversation-task-summary-apply"
                            onClick={() =>
                                setHandoffNotes((current) => {
                                    const nextSummary =
                                        buildHandoffTaskSummary(
                                            selectedConversation,
                                        ) || ''
                                    if (!nextSummary) {
                                        return current
                                    }
                                    if (!current.trim()) {
                                        return nextSummary
                                    }
                                    if (current.includes(nextSummary)) {
                                        return current
                                    }
                                    return `${current.trim()}\n${nextSummary}`
                                })
                            }
                        >
                            Usar en notas
                        </button>
                    </div>
                </div>
            ) : null}

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
                            onChange={(event) => {
                                setListQueryPending(true)
                                setSearch(event.target.value)
                            }}
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

            <div
                className="sidebar-body"
                data-testid="admin-conversations-list"
                ref={listViewportRef}
                onScroll={handleListScroll}
            >
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
                            Pasar selección a humano
                        </button>
                        <button
                            className="drawer-secondary-btn"
                            type="button"
                            data-testid="admin-conversations-bulk-release"
                            disabled={selectedCount === 0 || actionLoading === 'bulk-release'}
                            onClick={() => void handleBulkOwnerAction('release')}
                        >
                            Pasar selección a IA
                        </button>
                    </div>
                ) : null}
                {!listLoading || listRefreshing || listQueryPending ? (
                    <div
                        className={`conversation-list-status is-top ${listRefreshing || listQueryPending ? 'is-loading' : ''}`}
                        data-testid="admin-conversations-list-refresh-indicator"
                    >
                        {listRefreshing || listQueryPending ? (
                            <>
                                <Spinner size={16} />
                                <span>
                                    {listQueryPending
                                        ? 'Buscando conversaciones...'
                                        : 'Actualizando conversaciones nuevas...'}
                                </span>
                            </>
                        ) : (
                            <span>
                                Cargadas {items.length} de {listTotal || items.length}{' '}
                                conversaciones
                            </span>
                        )}
                    </div>
                ) : null}
                {listLoading || listQueryPending ? (
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
                            const controlModeBadge =
                                getConversationControlModeBadge(conversation)
                            const roleLabel = getConversationRoleLabel(
                                conversation.role,
                            )
                            const aiStateBadge =
                                getConversationAiStateBadge(conversation)
                            const auditBadges =
                                buildConversationAuditBadges(conversation)
                            const taskSummaryPreview = formatTaskSummaryPreview(
                                conversation.aiState?.memory?.taskSummary,
                            )
                            const isSelectedForBulk = bulkSelectionIds.includes(
                                conversation.id,
                            )
                            const previewIcon =
                                (conversation.latestMessage?.previewKind ||
                                    conversation.latestMessage?.kind) === 'image' ? (
                                    <TbPhoto size={14} />
                                ) : (conversation.latestMessage?.previewKind ||
                                      conversation.latestMessage?.kind) === 'audio' ? (
                                    <TbMicrophone size={14} />
                                ) : (conversation.latestMessage?.previewKind ||
                                      conversation.latestMessage?.kind) === 'video' ? (
                                    <TbVideo size={14} />
                                ) : (conversation.latestMessage?.previewKind ||
                                      conversation.latestMessage?.kind) ===
                                  'attachment' ? (
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
                                                        className="conversation-owner-pill is-grounded"
                                                        data-testid={`admin-conversation-role-${conversation.id}`}
                                                    >
                                                        {roleLabel}
                                                    </span>
                                                    <span
                                                        className={`conversation-owner-pill is-${ownerState.tone}`}
                                                        data-testid={`admin-conversation-owner-${conversation.id}`}
                                                    >
                                                        {ownerState.label}
                                                    </span>
                                                    <span
                                                        className={`conversation-owner-pill is-${controlModeBadge.tone}`}
                                                        data-testid={`admin-conversation-mode-${conversation.id}`}
                                                    >
                                                        {controlModeBadge.label}
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
                                                {taskSummaryPreview ? (
                                                    <div
                                                        className="chat-user-task-summary"
                                                        data-testid={`admin-conversation-task-summary-${conversation.id}`}
                                                    >
                                                        {taskSummaryPreview}
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
                        <div
                            className={`conversation-list-status is-bottom ${listLoadingMore ? 'is-loading' : ''}`}
                            data-testid="admin-conversations-list-more-indicator"
                        >
                            {listLoadingMore ? (
                                <>
                                    <Spinner size={16} />
                                    <span>Cargando conversaciones anteriores...</span>
                                </>
                            ) : hasMoreConversations ? (
                                <span>
                                    Desliza hacia abajo para cargar más. {items.length} de{' '}
                                    {listTotal} cargadas.
                                </span>
                            ) : (
                                <span>
                                    No hay más conversaciones por cargar en este listado.
                                </span>
                            )}
                        </div>
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
                                        onClick={() => navigate(appPath('/crm/conversations'))}
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
                                        <span
                                            className={`conversation-owner-pill is-${getConversationControlModeBadge(selectedConversation).tone}`}
                                            data-testid="admin-conversation-mode-current"
                                        >
                                            {getConversationControlModeBadge(selectedConversation).label}
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
                                        message.authorLabel?.trim() ||
                                        (message.authorType === 'operator'
                                            ? 'Administrador'
                                            : titleCase(message.authorType))
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
                        {approvedReplySuggestions.length ? (
                            <div
                                className="conversation-ai-suggestions"
                                data-testid="admin-conversation-ai-suggestions"
                            >
                                <div className="conversation-ai-suggestions-header">
                                    <div>
                                        <div className="conversation-ai-suggestions-title">
                                            <TbSparkles size={16} />
                                            <span>Sugerencias aprobadas</span>
                                        </div>
                                        <p>
                                            Basadas en conocimiento validado para responder más
                                            rápido sin perder control humano.
                                        </p>
                                    </div>
                                    <span className="conversation-ai-suggestions-count">
                                        {approvedReplySuggestions.length}
                                    </span>
                                </div>
                                {approvedReplySuggestionTarget ? (
                                    <div
                                        className="conversation-ai-suggestions-target"
                                        data-testid="admin-conversation-ai-suggestions-target"
                                    >
                                        <span>Mensaje objetivo</span>
                                        <p>{approvedReplySuggestionTarget}</p>
                                    </div>
                                ) : null}
                                <div className="conversation-ai-suggestion-list">
                                    {approvedReplySuggestions.map((suggestion) => (
                                        <div
                                            key={suggestion.id}
                                            className="conversation-ai-suggestion-card"
                                            data-testid={`admin-conversation-ai-suggestion-${suggestion.id}`}
                                        >
                                            <div className="conversation-ai-suggestion-copy">
                                                <div className="conversation-ai-suggestion-topline">
                                                    <h6>{suggestion.title}</h6>
                                                    <span className="conversation-ai-suggestion-version">
                                                        v{suggestion.version}
                                                    </span>
                                                </div>
                                                {suggestion.summary ? (
                                                    <p className="conversation-ai-suggestion-summary">
                                                        {suggestion.summary}
                                                    </p>
                                                ) : null}
                                                <p className="conversation-ai-suggestion-preview">
                                                    {formatSuggestionPreview(
                                                        suggestion.responseText,
                                                    )}
                                                </p>
                                                <div className="conversation-ai-suggestion-meta">
                                                    {suggestion.detectedIntent ? (
                                                        <span>
                                                            Intent: {suggestion.detectedIntent}
                                                        </span>
                                                    ) : null}
                                                    {suggestion.confidence != null ? (
                                                        <span>
                                                            Confianza{' '}
                                                            {suggestion.confidence.toFixed(2)}
                                                        </span>
                                                    ) : null}
                                                    {suggestion.matchedBy.length ? (
                                                        <span>
                                                            Match:{' '}
                                                            {suggestion.matchedBy
                                                                .map((entry) =>
                                                                    formatSuggestionMatchLabel(
                                                                        entry,
                                                                    ),
                                                                )
                                                                .join(' · ')}
                                                        </span>
                                                    ) : null}
                                                    {suggestion.feedback ? (
                                                        <span>
                                                            Historial:{' '}
                                                            {suggestion.feedback.used} uso
                                                            {suggestion.feedback.used === 1
                                                                ? ''
                                                                : 's'}{' '}
                                                            · {suggestion.feedback.edited}{' '}
                                                            edición
                                                            {suggestion.feedback.edited === 1
                                                                ? ''
                                                                : 'es'}{' '}
                                                            · {
                                                                suggestion.feedback
                                                                    .discarded
                                                            } descarte
                                                            {suggestion.feedback.discarded === 1
                                                                ? ''
                                                                : 's'}
                                                        </span>
                                                    ) : null}
                                                </div>
                                            </div>
                                            <div className="conversation-ai-suggestion-actions">
                                                <button
                                                    className="conversation-ai-suggestion-dismiss"
                                                    type="button"
                                                    data-testid={`admin-conversation-ai-suggestion-discard-${suggestion.id}`}
                                                    disabled={
                                                        suggestionFeedbackLoadingId ===
                                                        suggestion.id
                                                    }
                                                    onClick={() =>
                                                        void dismissReplySuggestion(
                                                            suggestion,
                                                        )
                                                    }
                                                >
                                                    Descartar
                                                </button>
                                                <button
                                                    className="conversation-ai-suggestion-apply"
                                                    type="button"
                                                    data-testid={`admin-conversation-ai-suggestion-apply-${suggestion.id}`}
                                                    onClick={() =>
                                                        applyReplySuggestion(suggestion)
                                                    }
                                                >
                                                    {activeReplySuggestion?.id === suggestion.id
                                                        ? 'Seleccionada'
                                                        : 'Usar'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                        <form
                            className="footer-form"
                            onSubmit={(event) => {
                                event.preventDefault()
                                void handleReply()
                            }}
                        >
                            <input
                                ref={replyFileInputRef}
                                type="file"
                                multiple
                                accept={ACCEPTED_REPLY_ATTACHMENT_TYPES}
                                className="d-none"
                                onChange={(event) => {
                                    void handleReplyFilesSelected(event)
                                }}
                                data-testid="admin-conversation-reply-file-input"
                            />
                            <input
                                ref={replyAudioInputRef}
                                type="file"
                                multiple
                                accept="audio/*"
                                className="d-none"
                                onChange={(event) => {
                                    void handleReplyFilesSelected(event)
                                }}
                                data-testid="admin-conversation-reply-audio-input"
                            />
                            {replyAttachments.length ? (
                                <div
                                    className="conversation-reply-attachments"
                                    data-testid="admin-conversation-reply-attachments"
                                >
                                    {replyAttachments.map((attachment) => (
                                        <div
                                            className="conversation-reply-attachment"
                                            key={attachment.localId}
                                            data-testid={`admin-conversation-reply-attachment-${attachment.localId}`}
                                        >
                                            <div className="conversation-reply-attachment-copy">
                                                <span className="conversation-reply-attachment-type">
                                                    {formatReplyAttachmentType(
                                                        attachment,
                                                    )}
                                                </span>
                                                <span className="conversation-reply-attachment-name">
                                                    {attachment.fileName ||
                                                        'Adjunto'}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                className="conversation-reply-attachment-remove"
                                                onClick={() =>
                                                    removeReplyAttachment(
                                                        attachment.localId,
                                                    )
                                                }
                                                aria-label={`Quitar ${attachment.fileName || 'adjunto'}`}
                                            >
                                                <TbX size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                            {replyComposerError ? (
                                <div
                                    className="conversation-reply-error"
                                    data-testid="admin-conversation-reply-error"
                                >
                                    {replyComposerError}
                                </div>
                            ) : null}
                            <div className="chat-footer-wrap">
                                <div className="form-item">
                                    <button
                                        className="action-circle"
                                        type="button"
                                        aria-label="Audio"
                                        onClick={openReplyAudioPicker}
                                        disabled={replying || !selectedConversation}
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
                                        onClick={openReplyFilePicker}
                                        disabled={replying || !selectedConversation}
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
                                        disabled={
                                            replying ||
                                            (!replyBody.trim() &&
                                                replyAttachments.length === 0)
                                        }
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
                                    {!isWhatsappQrConversation(menuConversation) ? (
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
                                    ) : null}
                                    {!isWhatsappQrConversation(menuConversation) ? (
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
                                    ) : null}
                                    {isWhatsappQrConversation(menuConversation) ? (
                                        <>
                                            <button
                                                type="button"
                                                className="directory-item"
                                                data-testid={`admin-conversation-menu-whatsapp-archive-${menuConversation.id}`}
                                                onClick={() =>
                                                    void runChannelChatAction(
                                                        menuConversation.id,
                                                        'whatsapp-archive',
                                                        () =>
                                                            ConversationsService.toggleWhatsappChatArchive(
                                                                menuConversation.id,
                                                                !menuConversation.channelState
                                                                    ?.archived,
                                                            ),
                                                        menuConversation.channelState?.archived
                                                            ? 'Chat desarchivado'
                                                            : 'Chat archivado',
                                                    )
                                                }
                                            >
                                                <span className="directory-action-label">
                                                    <TbFolder size={16} />
                                                    {menuConversation.channelState?.archived
                                                        ? 'Desarchivar chat'
                                                        : 'Archivar chat'}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="directory-item"
                                                data-testid={`admin-conversation-menu-whatsapp-read-${menuConversation.id}`}
                                                onClick={() =>
                                                    void runChannelChatAction(
                                                        menuConversation.id,
                                                        'whatsapp-read',
                                                        () =>
                                                            ConversationsService.toggleWhatsappChatReadState(
                                                                menuConversation.id,
                                                                !menuConversation.channelState
                                                                    ?.read,
                                                            ),
                                                        menuConversation.channelState?.read
                                                            ? 'Chat marcado como no leído'
                                                            : 'Chat marcado como leído',
                                                    )
                                                }
                                            >
                                                <span className="directory-action-label">
                                                    <TbChecks size={16} />
                                                    {menuConversation.channelState?.read
                                                        ? 'Marcar como no leído'
                                                        : 'Marcar como leído'}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="directory-item"
                                                data-testid={`admin-conversation-menu-whatsapp-pin-${menuConversation.id}`}
                                                onClick={() =>
                                                    void runChannelChatAction(
                                                        menuConversation.id,
                                                        'whatsapp-pin',
                                                        () =>
                                                            ConversationsService.toggleWhatsappChatPinState(
                                                                menuConversation.id,
                                                                !menuConversation.channelState
                                                                    ?.pinned,
                                                            ),
                                                        menuConversation.channelState?.pinned
                                                            ? 'Chat desfijado'
                                                            : 'Chat fijado',
                                                    )
                                                }
                                            >
                                                <span className="directory-action-label">
                                                    <TbPinned size={16} />
                                                    {menuConversation.channelState?.pinned
                                                        ? 'Quitar fijado'
                                                        : 'Fijar chat'}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="directory-item"
                                                data-testid={`admin-conversation-menu-whatsapp-mute-8h-${menuConversation.id}`}
                                                onClick={() =>
                                                    void runChannelChatAction(
                                                        menuConversation.id,
                                                        'whatsapp-mute-8h',
                                                        () =>
                                                            ConversationsService.setWhatsappChatMuteState(
                                                                menuConversation.id,
                                                                '8h',
                                                            ),
                                                        'Chat silenciado',
                                                        'Se silenció por 8 horas.',
                                                    )
                                                }
                                            >
                                                <span className="directory-action-label">
                                                    <TbPhoneCheck size={16} />
                                                    Silenciar 8h
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="directory-item"
                                                data-testid={`admin-conversation-menu-whatsapp-mute-7d-${menuConversation.id}`}
                                                onClick={() =>
                                                    void runChannelChatAction(
                                                        menuConversation.id,
                                                        'whatsapp-mute-7d',
                                                        () =>
                                                            ConversationsService.setWhatsappChatMuteState(
                                                                menuConversation.id,
                                                                '7d',
                                                            ),
                                                        'Chat silenciado',
                                                        'Se silenció por 7 días.',
                                                    )
                                                }
                                            >
                                                <span className="directory-action-label">
                                                    <TbPhoneCheck size={16} />
                                                    Silenciar 7d
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="directory-item"
                                                data-testid={`admin-conversation-menu-whatsapp-unmute-${menuConversation.id}`}
                                                onClick={() =>
                                                    void runChannelChatAction(
                                                        menuConversation.id,
                                                        'whatsapp-unmute',
                                                        () =>
                                                            ConversationsService.setWhatsappChatMuteState(
                                                                menuConversation.id,
                                                                'off',
                                                            ),
                                                        'Silencio quitado',
                                                    )
                                                }
                                            >
                                                <span className="directory-action-label">
                                                    <TbPhoneCheck size={16} />
                                                    Quitar silencio
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="directory-item"
                                                data-testid={`admin-conversation-menu-whatsapp-delete-${menuConversation.id}`}
                                                onClick={() => {
                                                    if (
                                                        !window.confirm(
                                                            '¿Eliminar el chat en WhatsApp? El historial del CRM se conserva.',
                                                        )
                                                    ) {
                                                        return
                                                    }
                                                    void runChannelChatAction(
                                                        menuConversation.id,
                                                        'whatsapp-delete',
                                                        () =>
                                                            ConversationsService.deleteWhatsappChat(
                                                                menuConversation.id,
                                                            ),
                                                        'Chat eliminado',
                                                    )
                                                }}
                                            >
                                                <span className="directory-action-label">
                                                    <TbX size={16} />
                                                    Eliminar chat
                                                </span>
                                            </button>
                                        </>
                                    ) : isWebchatConversation(menuConversation) ? (
                                        <>
                                            <button
                                                type="button"
                                                className="directory-item"
                                                data-testid={`admin-conversation-menu-webchat-archive-${menuConversation.id}`}
                                                onClick={() =>
                                                    void runChannelChatAction(
                                                        menuConversation.id,
                                                        'webchat-archive',
                                                        () =>
                                                            ConversationsService.toggleWebchatChatArchive(
                                                                menuConversation.id,
                                                                !menuConversation.channelState
                                                                    ?.archived,
                                                            ),
                                                        menuConversation.channelState?.archived
                                                            ? 'Chat desarchivado'
                                                            : 'Chat archivado',
                                                    )
                                                }
                                            >
                                                <span className="directory-action-label">
                                                    <TbFolder size={16} />
                                                    {menuConversation.channelState?.archived
                                                        ? 'Desarchivar chat'
                                                        : 'Archivar chat'}
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="directory-item"
                                                data-testid={`admin-conversation-menu-webchat-mute-8h-${menuConversation.id}`}
                                                onClick={() =>
                                                    void runChannelChatAction(
                                                        menuConversation.id,
                                                        'webchat-mute-8h',
                                                        () =>
                                                            ConversationsService.setWebchatChatMuteState(
                                                                menuConversation.id,
                                                                '8h',
                                                            ),
                                                        'Chat silenciado',
                                                        'Se silenció por 8 horas.',
                                                    )
                                                }
                                            >
                                                <span className="directory-action-label">
                                                    <TbPhoneCheck size={16} />
                                                    Silenciar 8h
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="directory-item"
                                                data-testid={`admin-conversation-menu-webchat-mute-7d-${menuConversation.id}`}
                                                onClick={() =>
                                                    void runChannelChatAction(
                                                        menuConversation.id,
                                                        'webchat-mute-7d',
                                                        () =>
                                                            ConversationsService.setWebchatChatMuteState(
                                                                menuConversation.id,
                                                                '7d',
                                                            ),
                                                        'Chat silenciado',
                                                        'Se silenció por 7 días.',
                                                    )
                                                }
                                            >
                                                <span className="directory-action-label">
                                                    <TbPhoneCheck size={16} />
                                                    Silenciar 7d
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="directory-item"
                                                data-testid={`admin-conversation-menu-webchat-unmute-${menuConversation.id}`}
                                                onClick={() =>
                                                    void runChannelChatAction(
                                                        menuConversation.id,
                                                        'webchat-unmute',
                                                        () =>
                                                            ConversationsService.setWebchatChatMuteState(
                                                                menuConversation.id,
                                                                'off',
                                                            ),
                                                        'Silencio quitado',
                                                    )
                                                }
                                            >
                                                <span className="directory-action-label">
                                                    <TbPhoneCheck size={16} />
                                                    Quitar silencio
                                                </span>
                                            </button>
                                            <button
                                                type="button"
                                                className="directory-item"
                                                data-testid={`admin-conversation-menu-webchat-delete-${menuConversation.id}`}
                                                onClick={async () => {
                                                    if (
                                                        !window.confirm(
                                                            '¿Eliminar este chat del CRM? La conversación se oculta del panel.',
                                                        )
                                                    ) {
                                                        return
                                                    }
                                                    setActionLoading('webchat-delete')
                                                    try {
                                                        await ConversationsService.deleteWebchatChat(
                                                            menuConversation.id,
                                                        )
                                                        setItems((current) =>
                                                            current.filter(
                                                                (item) =>
                                                                    item.id !==
                                                                    menuConversation.id,
                                                            ),
                                                        )
                                                        if (
                                                            selectedConversation?.id ===
                                                            menuConversation.id
                                                        ) {
                                                            setSelectedConversation(null)
                                                            navigate(
                                                                appPath('/crm/conversations'),
                                                            )
                                                        }
                                                        setIsConversationMenuOpen(false)
                                                        pushConversationToast(
                                                            'success',
                                                            'Chat eliminado',
                                                        )
                                                    } catch (error) {
                                                        console.error(error)
                                                        pushConversationToast(
                                                            'danger',
                                                            'No fue posible eliminar el chat',
                                                        )
                                                    } finally {
                                                        setActionLoading(null)
                                                    }
                                                }}
                                            >
                                                <span className="directory-action-label">
                                                    <TbX size={16} />
                                                    Eliminar chat
                                                </span>
                                            </button>
                                        </>
                                    ) : null}
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
                                    <>
                                        <div className="conversation-contact-suggestion">
                                            <div className="conversation-contact-suggestion-label">
                                                Sugerencia IA
                                            </div>
                                            <button
                                                type="button"
                                                className={`conversation-contact-option conversation-contact-option-suggested ${selectedContactKey === internalAssistantContact.key ? 'is-active' : ''}`}
                                                data-testid="admin-conversations-contact-internal-assistant"
                                                onClick={() =>
                                                    setSelectedContactKey(
                                                        internalAssistantContact.key,
                                                    )
                                                }
                                            >
                                                <div className="conversation-contact-avatar">
                                                    {renderAvatar({
                                                        seed: internalAssistantContact.label,
                                                        label: internalAssistantContact.label,
                                                        size: 44,
                                                        preferInitials: true,
                                                    })}
                                                </div>
                                                <div className="conversation-contact-copy">
                                                    <strong>
                                                        {internalAssistantContact.label}
                                                    </strong>
                                                    <span>
                                                        {internalAssistantContact.description}
                                                    </span>
                                                </div>
                                                <div className="conversation-contact-meta">
                                                    <small>
                                                        {internalAssistantContact.conversationId
                                                            ? 'Existente'
                                                            : 'Nuevo'}
                                                    </small>
                                                </div>
                                            </button>
                                        </div>
                                        {availableContacts
                                            .filter(
                                                (contact) =>
                                                    contact.key !==
                                                    INTERNAL_ASSISTANT_CONTACT_KEY,
                                            )
                                            .map((contact) => (
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
                                                                contact.kind ===
                                                                'internal',
                                                        })}
                                                    </div>
                                                    <div className="conversation-contact-copy">
                                                        <strong>{contact.label}</strong>
                                                        <span>
                                                            {contact.description ||
                                                                (contact.kind ===
                                                                'internal'
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
                                            ))}
                                    </>
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
                                                                <p data-testid="admin-conversation-role-current">
                                                                    Rol:{' '}
                                                                    {getConversationRoleLabel(
                                                                        selectedConversation.role,
                                                                    )}
                                                                </p>
                                                                <p data-testid="admin-conversation-mode-inline">
                                                                    Modo:{' '}
                                                                    {
                                                                        getConversationControlModeBadge(
                                                                            selectedConversation,
                                                                        ).label
                                                                    }
                                                                </p>
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
                                                                {selectedConversation.aiState
                                                                    ?.memory
                                                                    ?.intentKey ? (
                                                                    <p>
                                                                        Tarea:{' '}
                                                                        {
                                                                            selectedConversation
                                                                                .aiState
                                                                                .memory
                                                                                .intentKey
                                                                        }
                                                                    </p>
                                                                ) : null}
                                                                {formatTaskSummaryPreview(
                                                                    selectedConversation.aiState
                                                                        ?.memory?.taskSummary,
                                                                ) ? (
                                                                    <p data-testid="admin-conversation-task-summary-inline">
                                                                        Resumen:{' '}
                                                                        {formatTaskSummaryPreview(
                                                                            selectedConversation
                                                                                .aiState?.memory
                                                                                ?.taskSummary,
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.audit?.blockedTools
                                                                    ?.length ? (
                                                                    <p data-testid="admin-conversation-blocked-tools-current">
                                                                        Tools bloqueadas:{' '}
                                                                        {selectedConversation.aiState.audit.blockedTools.join(
                                                                            ', ',
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.audit
                                                                    ?.executedTools
                                                                    ?.length ? (
                                                                    <p data-testid="admin-conversation-executed-tools-current">
                                                                        Tools ejecutadas:{' '}
                                                                        {selectedConversation.aiState.audit.executedTools.join(
                                                                            ', ',
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.memory
                                                                    ?.state ? (
                                                                    <p data-testid="admin-conversation-memory-state-current">
                                                                        Estado del agente:{' '}
                                                                        {
                                                                            selectedConversation
                                                                                .aiState
                                                                                .memory
                                                                                .state
                                                                        }
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.memory
                                                                    ?.stateHistory
                                                                    ?.length ? (
                                                                    <p data-testid="admin-conversation-memory-state-history-current">
                                                                        Estados:{' '}
                                                                        {selectedConversation.aiState.memory.stateHistory.join(
                                                                            ' → ',
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.memory
                                                                    ?.lastTransitionAt ? (
                                                                    <p data-testid="admin-conversation-memory-transition-current">
                                                                        Última transición:{' '}
                                                                        {formatDateTime(
                                                                            selectedConversation
                                                                                .aiState
                                                                                .memory
                                                                                .lastTransitionAt,
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.audit?.stage ? (
                                                                    <p data-testid="admin-conversation-stage-current">
                                                                        Etapa actual:{' '}
                                                                        {
                                                                            selectedConversation
                                                                                .aiState.audit
                                                                                .stage
                                                                        }
                                                                    </p>
                                                                ) : null}
                                                                {formatAuditStageHistory(
                                                                    selectedConversation.aiState
                                                                        ?.audit
                                                                        ?.stageHistory,
                                                                ) ? (
                                                                    <p data-testid="admin-conversation-stage-history-current">
                                                                        Historial:{' '}
                                                                        {formatAuditStageHistory(
                                                                            selectedConversation
                                                                                .aiState.audit
                                                                                ?.stageHistory,
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.audit
                                                                    ?.intentSource ? (
                                                                    <p data-testid="admin-conversation-intent-source-current">
                                                                        Fuente de intención:{' '}
                                                                        {
                                                                            selectedConversation
                                                                                .aiState.audit
                                                                                .intentSource
                                                                        }
                                                                        {typeof selectedConversation
                                                                            .aiState.audit
                                                                            .intentConfidence ===
                                                                        'number'
                                                                            ? ` · confianza ${selectedConversation.aiState.audit.intentConfidence.toFixed(
                                                                                  2,
                                                                              )}`
                                                                            : ''}
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.audit
                                                                    ?.decisionPath
                                                                    ?.length ? (
                                                                    <p data-testid="admin-conversation-decision-path-current">
                                                                        Ruta de decisión:{' '}
                                                                        {selectedConversation.aiState.audit.decisionPath.join(
                                                                            ' → ',
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.audit?.detail ? (
                                                                    <p data-testid="admin-conversation-audit-detail-current">
                                                                        Detalle:{' '}
                                                                        {
                                                                            selectedConversation
                                                                                .aiState.audit
                                                                                .detail
                                                                        }
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.audit
                                                                    ?.referencedMessages
                                                                    ?.length ? (
                                                                    <p data-testid="admin-conversation-references-current">
                                                                        Referencias:{' '}
                                                                        {selectedConversation.aiState.audit.referencedMessages
                                                                            .map(
                                                                                (
                                                                                    entry,
                                                                                ) =>
                                                                                    entry.preview ||
                                                                                    entry.messageId ||
                                                                                    'mensaje_reciente',
                                                                            )
                                                                            .join(
                                                                                ' | ',
                                                                            )}
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.audit
                                                                    ?.messageContextOrigin
                                                                    ?.length ? (
                                                                    <p data-testid="admin-conversation-context-origin-current">
                                                                        Origen de contexto:{' '}
                                                                        {selectedConversation.aiState.audit.messageContextOrigin.join(
                                                                            ', ',
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.audit
                                                                    ?.messageElementsUsed
                                                                    ?.length ? (
                                                                    <p data-testid="admin-conversation-message-elements-used-current">
                                                                        Elementos usados:{' '}
                                                                        {selectedConversation.aiState.audit.messageElementsUsed.join(
                                                                            ', ',
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.audit
                                                                    ?.messageElements
                                                                    ?.length ? (
                                                                    <p data-testid="admin-conversation-message-elements-current">
                                                                        Elementos:{' '}
                                                                        {selectedConversation.aiState.audit.messageElements
                                                                            .map(
                                                                                (
                                                                                    entry,
                                                                                ) =>
                                                                                    `${
                                                                                        entry.label ||
                                                                                        entry.kind ||
                                                                                        'elemento'
                                                                                    }${
                                                                                        entry.preview
                                                                                            ? ` (${entry.preview})`
                                                                                            : ''
                                                                                    }`,
                                                                            )
                                                                            .join(
                                                                                ' | ',
                                                                            )}
                                                                    </p>
                                                                ) : null}
                                                                {selectedConversation.aiState
                                                                    ?.memory
                                                                    ?.lastResetAt ? (
                                                                    <p>
                                                                        Reset de tarea:{' '}
                                                                        {formatDateTime(
                                                                            selectedConversation
                                                                                .aiState
                                                                                .memory
                                                                                .lastResetAt,
                                                                        )}
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

                                            {conversationThreadAudit ? (
                                                <div className="content-wrapper">
                                                    <h5 className="sub-title">
                                                        Auditoría conversacional
                                                    </h5>
                                                    <div className="card">
                                                        <div className="card-body">
                                                            <div className="thread-audit-summary">
                                                                <div className="thread-audit-stat-row">
                                                                    <div className="thread-audit-stat">
                                                                        <span className="thread-audit-stat-label">
                                                                            Hilos detectados
                                                                        </span>
                                                                        <strong data-testid="admin-conversation-thread-count">
                                                                            {
                                                                                conversationThreadAudit
                                                                                    .detectedThreads
                                                                                    .length
                                                                            }
                                                                        </strong>
                                                                    </div>
                                                                    <div className="thread-audit-stat">
                                                                        <span className="thread-audit-stat-label">
                                                                            Turnos auditados
                                                                        </span>
                                                                        <strong data-testid="admin-conversation-thread-turn-count">
                                                                            {
                                                                                conversationThreadAudit.totalTurnsWithThreadData
                                                                            }
                                                                        </strong>
                                                                    </div>
                                                                </div>
                                                                <div className="thread-audit-block">
                                                                    <div className="thread-audit-block-title">
                                                                        Hilo activo
                                                                    </div>
                                                                    <p data-testid="admin-conversation-active-thread">
                                                                        {conversationThreadAudit.activeThreadLabel ||
                                                                            'Sin hilo activo definido'}
                                                                    </p>
                                                                </div>
                                                                <div className="thread-audit-block">
                                                                    <div className="thread-audit-block-title">
                                                                        Cambios de hilo
                                                                    </div>
                                                                    {conversationThreadAudit.threadSwitches.length ? (
                                                                        <ul
                                                                            className="thread-audit-list"
                                                                            data-testid="admin-conversation-thread-switches"
                                                                        >
                                                                            {conversationThreadAudit.threadSwitches
                                                                                .slice(-4)
                                                                                .map((entry) => (
                                                                                    <li
                                                                                        key={`${entry.messageId}:${entry.createdAt}`}
                                                                                    >
                                                                                        <strong>
                                                                                            {entry.toLabel ||
                                                                                                'Hilo sin resolver'}
                                                                                        </strong>
                                                                                        <span>
                                                                                            {entry.fromLabel
                                                                                                ? ` desde ${entry.fromLabel}`
                                                                                                : ''}
                                                                                            {' · '}
                                                                                            {formatDateTime(
                                                                                                entry.createdAt,
                                                                                            )}
                                                                                        </span>
                                                                                    </li>
                                                                                ))}
                                                                        </ul>
                                                                    ) : (
                                                                        <p>Sin cambios de hilo registrados.</p>
                                                                    )}
                                                                </div>
                                                                <div className="thread-audit-block">
                                                                    <div className="thread-audit-block-title">
                                                                        Turnos con disambiguación
                                                                    </div>
                                                                    {conversationThreadAudit.disambiguationTurns.length ? (
                                                                        <ul
                                                                            className="thread-audit-list"
                                                                            data-testid="admin-conversation-thread-disambiguation"
                                                                        >
                                                                            {conversationThreadAudit.disambiguationTurns
                                                                                .slice(-4)
                                                                                .map((entry) => (
                                                                                    <li
                                                                                        key={`${entry.messageId}:${entry.createdAt}`}
                                                                                    >
                                                                                        <strong>
                                                                                            {entry.promptText ||
                                                                                                'Disambiguación solicitada'}
                                                                                        </strong>
                                                                                        <span>
                                                                                            {entry.currentTurnText
                                                                                                ? `${entry.currentTurnText} · `
                                                                                                : ''}
                                                                                            {formatDateTime(
                                                                                                entry.createdAt,
                                                                                            )}
                                                                                        </span>
                                                                                    </li>
                                                                                ))}
                                                                        </ul>
                                                                    ) : (
                                                                        <p>
                                                                            Sin turnos de disambiguación.
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                <div className="thread-audit-block">
                                                                    <div className="thread-audit-block-title">
                                                                        Slots capturados por hilo
                                                                    </div>
                                                                    {conversationThreadAudit.detectedThreads.some(
                                                                        (entry) =>
                                                                            entry.slots.length > 0,
                                                                    ) ? (
                                                                        <div
                                                                            className="thread-audit-thread-list"
                                                                            data-testid="admin-conversation-thread-slots"
                                                                        >
                                                                            {conversationThreadAudit.detectedThreads.map(
                                                                                (thread) => (
                                                                                    <div
                                                                                        className="thread-audit-thread-card"
                                                                                        key={thread.key}
                                                                                    >
                                                                                        <div className="thread-audit-thread-header">
                                                                                            <strong>
                                                                                                {thread.label}
                                                                                            </strong>
                                                                                            <span>
                                                                                                {thread.switchCount > 0
                                                                                                    ? `${thread.switchCount} cambio(s)`
                                                                                                    : thread.baseType
                                                                                                      ? titleCase(
                                                                                                            thread.baseType,
                                                                                                        )
                                                                                                      : 'Sin cambios'}
                                                                                            </span>
                                                                                        </div>
                                                                                        {thread.slots.length ? (
                                                                                            <div className="thread-audit-slot-list">
                                                                                                {thread.slots.map(
                                                                                                    (
                                                                                                        slot,
                                                                                                    ) => (
                                                                                                        <span
                                                                                                            className="thread-audit-slot"
                                                                                                            key={`${thread.key}:${slot.key}:${slot.value}`}
                                                                                                        >
                                                                                                            <strong>
                                                                                                                {slot.label}
                                                                                                            </strong>
                                                                                                            <span>
                                                                                                                {slot.value}
                                                                                                            </span>
                                                                                                        </span>
                                                                                                    ),
                                                                                                )}
                                                                                            </div>
                                                                                        ) : (
                                                                                            <p>
                                                                                                Sin slots capturados.
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                ),
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <p>
                                                                            Todavía no hay slots capturados por hilo.
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : null}

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
                <Dialog
                    isOpen={Boolean(reactionDialogMessage)}
                    onClose={() => setReactionDialogMessage(null)}
                    onRequestClose={() => setReactionDialogMessage(null)}
                    width={420}
                >
                    <div className="conversation-whatsapp-dialog">
                        <h5>Reaccionar al mensaje</h5>
                        <p>
                            Elegí una reacción rápida o ingresá un emoji para enviarlo
                            por WhatsApp.
                        </p>
                        <div className="conversation-whatsapp-reaction-grid">
                            {DEFAULT_WHATSAPP_REACTION_OPTIONS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    className={`conversation-whatsapp-reaction-chip ${
                                        reactionValue === emoji ? 'is-active' : ''
                                    }`}
                                    onClick={() => setReactionValue(emoji)}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        <input
                            className="conversation-whatsapp-emoji-input"
                            value={reactionValue}
                            onChange={(event) => setReactionValue(event.target.value)}
                            placeholder="Emoji"
                            maxLength={8}
                        />
                        <div className="conversation-whatsapp-dialog-actions">
                            <button
                                type="button"
                                className="conversation-secondary-btn"
                                onClick={() => setReactionDialogMessage(null)}
                                disabled={Boolean(channelActionLoadingKey)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="conversation-primary-btn"
                                onClick={() => void submitReaction()}
                                disabled={Boolean(channelActionLoadingKey) || !reactionValue.trim()}
                            >
                                Enviar reacción
                            </button>
                        </div>
                    </div>
                </Dialog>
                <Dialog
                    isOpen={Boolean(forwardDialogMessage)}
                    onClose={() => setForwardDialogMessage(null)}
                    onRequestClose={() => setForwardDialogMessage(null)}
                    width={520}
                >
                    <div className="conversation-whatsapp-dialog">
                        <h5>Reenviar mensaje</h5>
                        <p>Seleccioná la conversación de WhatsApp a la que querés reenviarlo.</p>
                        {forwardTargetsLoading ? (
                            <div className="conversation-whatsapp-dialog-loading">
                                <Spinner size={28} />
                            </div>
                        ) : forwardTargets.length ? (
                            <div className="conversation-whatsapp-forward-list">
                                {forwardTargets.map((conversation) => (
                                    <button
                                        key={conversation.id}
                                        type="button"
                                        className={`conversation-whatsapp-forward-option ${
                                            forwardTargetConversationId === conversation.id
                                                ? 'is-active'
                                                : ''
                                        }`}
                                        onClick={() =>
                                            setForwardTargetConversationId(conversation.id)
                                        }
                                    >
                                        <strong>
                                            {getConversationDisplayTitle(conversation)}
                                        </strong>
                                        <span>
                                            {conversation.inboxAccount?.displayName ||
                                                'WhatsApp'}
                                            {conversation.latestMessage?.body
                                                ? ` · ${conversation.latestMessage.body.slice(0, 80)}`
                                                : ''}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="conversation-whatsapp-empty">
                                No hay otras conversaciones de WhatsApp disponibles.
                            </p>
                        )}
                        <div className="conversation-whatsapp-dialog-actions">
                            <button
                                type="button"
                                className="conversation-secondary-btn"
                                onClick={() => setForwardDialogMessage(null)}
                                disabled={Boolean(channelActionLoadingKey)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="conversation-primary-btn"
                                onClick={() => void submitForward()}
                                disabled={
                                    Boolean(channelActionLoadingKey) ||
                                    !forwardTargetConversationId
                                }
                            >
                                Reenviar
                            </button>
                        </div>
                    </div>
                </Dialog>
                <Dialog
                    isOpen={Boolean(messageReplyDialogMessage)}
                    onClose={() => setMessageReplyDialogMessage(null)}
                    onRequestClose={() => setMessageReplyDialogMessage(null)}
                    width={520}
                >
                    <div className="conversation-whatsapp-dialog">
                        <h5>Responder citando mensaje</h5>
                        <p>
                            Esta respuesta se enviará citando el mensaje seleccionado.
                        </p>
                        {messageReplyDialogMessage?.body ? (
                            <div className="conversation-whatsapp-quoted">
                                <div className="conversation-whatsapp-quoted-preview">
                                    {messageReplyDialogMessage.body}
                                </div>
                            </div>
                        ) : null}
                        <textarea
                            className="conversation-whatsapp-textarea"
                            value={messageReplyBody}
                            onChange={(event) =>
                                setMessageReplyBody(event.target.value)
                            }
                            rows={5}
                            placeholder="Escribí la respuesta…"
                        />
                        <div className="conversation-whatsapp-dialog-actions">
                            <button
                                type="button"
                                className="conversation-secondary-btn"
                                onClick={() => setMessageReplyDialogMessage(null)}
                                disabled={Boolean(channelActionLoadingKey)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="conversation-primary-btn"
                                onClick={() => void submitMessageReply()}
                                disabled={
                                    Boolean(channelActionLoadingKey) ||
                                    !messageReplyBody.trim()
                                }
                            >
                                Enviar respuesta
                            </button>
                        </div>
                    </div>
                </Dialog>
                <Dialog
                    isOpen={Boolean(messageEditDialogMessage)}
                    onClose={() => setMessageEditDialogMessage(null)}
                    onRequestClose={() => setMessageEditDialogMessage(null)}
                    width={520}
                >
                    <div className="conversation-whatsapp-dialog">
                        <h5>Editar mensaje enviado</h5>
                        <p>Esta edición se aplicará al mensaje ya enviado.</p>
                        <textarea
                            className="conversation-whatsapp-textarea"
                            value={messageEditBody}
                            onChange={(event) =>
                                setMessageEditBody(event.target.value)
                            }
                            rows={5}
                            placeholder="Texto actualizado…"
                        />
                        <div className="conversation-whatsapp-dialog-actions">
                            <button
                                type="button"
                                className="conversation-secondary-btn"
                                onClick={() => setMessageEditDialogMessage(null)}
                                disabled={Boolean(channelActionLoadingKey)}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="conversation-primary-btn"
                                onClick={() => void submitMessageEdit()}
                                disabled={
                                    Boolean(channelActionLoadingKey) ||
                                    !messageEditBody.trim()
                                }
                            >
                                Guardar edición
                            </button>
                        </div>
                    </div>
                </Dialog>
            </div>
        </AdaptableCard>
    )
}

export default ConversationsV2

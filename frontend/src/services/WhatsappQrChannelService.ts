import ApiService from './ApiService'

const channelControlBaseUrl = (
    import.meta.env.VITE_CHAT_AGENT_API_URL ||
    import.meta.env.VITE_AI_PLATFORM_URL ||
    'http://localhost:4110'
).replace(/\/$/, '')

const channelControlUrl = (path: string) =>
    `${channelControlBaseUrl}${path.startsWith('/') ? path : `/${path}`}`

export type WhatsappQrChannelConfig = {
    enabled: boolean
    displayName: string | null
    address: string | null
    autoStart: boolean
    typingIndicatorEnabled: boolean
    presenceIndicatorEnabled: boolean
    humanDelayEnabled: boolean
    minReplyDelayMs: number
    maxReplyDelayMs: number
    maxOutboundPerHour: number
    maxOutboundPerDay: number
    reactionsEnabled: boolean
    readReceiptsEnabled: boolean
    allowProactiveOutbound: boolean
    quietHoursStart: string | null
    quietHoursEnd: string | null
}

export type WhatsappQrChannelStatus = {
    enabled: boolean
    state: string
    driver: string
    qrCodeDataUrl: string | null
    qrCodeExpiresAt: string | null
    connectedPhone: string | null
    connectedAt: string | null
    lastDisconnectAt: string | null
    lastError: string | null
    reconnectScheduledAt: string | null
    outboundCounters?: {
        lastHour: number
        lastDay: number
    } | null
    capabilities?: {
        typing: boolean
        reactions: boolean
        presence: boolean
        media: boolean
    } | null
    history?: {
        knownChatsCount: number
        bufferedMessagesCount: number
        lastBackfillResult?: {
            importedMessages: number
            importedConversations: number
            duplicateMessages: number
            skippedMessages: number
            authBootstrapCandidates: number
            bootstrappedFromAuth: number
            completedAt?: string | null
        } | null
    } | null
}

export type WhatsappQrOverview = {
    config: WhatsappQrChannelConfig
    status: WhatsappQrChannelStatus
    inboxAccount: {
        id: string
        displayName: string | null
        address: string | null
        active: boolean
        metadata?: Record<string, unknown> | null
    } | null
    consistency: {
        inboxAccountPresent: boolean
        channel: string
        transport: string
        adapterReachable: boolean
        adapterEnabledMatchesConfig: boolean
        inboxActiveMatchesConfig: boolean
        inboxAddressMatchesConfig: boolean
        inboxTransportMatches: boolean
    }
}

export type WhatsappQrBackfillResult = {
    overview: WhatsappQrOverview
    backfill: {
        importedMessages: number
        importedConversations: number
        duplicateMessages: number
        skippedMessages: number
        authBootstrapCandidates: number
        bootstrappedFromAuth: number
    }
    cleanup: {
        deletedConversations: number
        deletedInboxAccounts: number
    }
}

export const apiGetWhatsappQrOverview = () =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: channelControlUrl('/settings/channels/whatsapp-qr'),
        method: 'get',
    })

export const apiUpdateWhatsappQrConfig = (
    data: Partial<WhatsappQrChannelConfig>,
) =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: channelControlUrl('/settings/channels/whatsapp-qr'),
        method: 'put',
        data,
    })

export const apiStartWhatsappQrSession = () =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: channelControlUrl('/settings/channels/whatsapp-qr/session/start'),
        method: 'post',
    })

export const apiStopWhatsappQrSession = () =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: channelControlUrl('/settings/channels/whatsapp-qr/session/stop'),
        method: 'post',
    })

export const apiReconnectWhatsappQrSession = () =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: channelControlUrl('/settings/channels/whatsapp-qr/session/reconnect'),
        method: 'post',
    })

export const apiResetWhatsappQrSession = () =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: channelControlUrl('/settings/channels/whatsapp-qr/session/reset'),
        method: 'post',
    })

export const apiSyncWhatsappQrConfig = () =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: channelControlUrl('/settings/channels/whatsapp-qr/sync'),
        method: 'post',
    })

export const apiBackfillWhatsappQrHistory = () =>
    ApiService.fetchData<WhatsappQrBackfillResult>({
        url: channelControlUrl('/settings/channels/whatsapp-qr/backfill'),
        method: 'post',
    })

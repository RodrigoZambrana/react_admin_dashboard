import ApiService from './ApiService'

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

export const apiGetWhatsappQrOverview = () =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: '/settings/channels/whatsapp-qr',
        method: 'get',
    })

export const apiUpdateWhatsappQrConfig = (
    data: Partial<WhatsappQrChannelConfig>,
) =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: '/settings/channels/whatsapp-qr',
        method: 'put',
        data,
    })

export const apiStartWhatsappQrSession = () =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: '/settings/channels/whatsapp-qr/session/start',
        method: 'post',
    })

export const apiStopWhatsappQrSession = () =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: '/settings/channels/whatsapp-qr/session/stop',
        method: 'post',
    })

export const apiReconnectWhatsappQrSession = () =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: '/settings/channels/whatsapp-qr/session/reconnect',
        method: 'post',
    })

export const apiResetWhatsappQrSession = () =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: '/settings/channels/whatsapp-qr/session/reset',
        method: 'post',
    })

export const apiSyncWhatsappQrConfig = () =>
    ApiService.fetchData<WhatsappQrOverview>({
        url: '/settings/channels/whatsapp-qr/sync',
        method: 'post',
    })

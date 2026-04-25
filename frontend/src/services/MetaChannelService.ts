import ApiService from './ApiService'

const channelControlBaseUrl = (
    import.meta.env.VITE_CHAT_AGENT_API_URL ||
    import.meta.env.VITE_AI_PLATFORM_URL ||
    'http://localhost:4110'
).replace(/\/$/, '')

const channelControlUrl = (path: string) =>
    `${channelControlBaseUrl}${path.startsWith('/') ? path : `/${path}`}`

export type MetaChannelConfig = {
    enabled: boolean
    messengerEnabled: boolean
    instagramEnabled: boolean
    publicBaseUrl: string | null
    pageId: string | null
    instagramBusinessAccountId: string | null
    appId: string | null
    verifyToken: string | null
    appSecret: string | null
    pageAccessToken: string | null
    messengerPageAccessToken: string | null
    instagramAccessToken: string | null
}

export type MetaChannelStatus = {
    driver: string
    enabled: boolean
    messengerEnabled: boolean
    instagramEnabled: boolean
    appId: string | null
    graphVersion: string
    graphBaseUrl: string
    publicBaseUrl: string | null
    publicWebhookUrl: string | null
    verifyTokenPresent: boolean
    appSecretPresent: boolean
    webhookVerificationReady: boolean
    signatureValidationReady: boolean
    webhookInboundReady: boolean
    messenger: {
        enabled: boolean
        pageId: string | null
        pageAccessTokenPresent: boolean
        outboundReady: boolean
    }
    instagram: {
        enabled: boolean
        businessAccountId: string | null
        accessTokenPresent: boolean
        outboundReady: boolean
    }
    capabilities: {
        text: boolean
        attachments: boolean
        postbacks: boolean
        quickReplies: boolean
    }
}

export type MetaInboxAccount = {
    id: string
    displayName: string | null
    address: string | null
    active: boolean
    metadata?: Record<string, unknown> | null
}

export type MetaChannelOverview = {
    config: MetaChannelConfig
    meta: {
        source: 'environment' | 'database'
        updatedAt: string | null
    }
    status: MetaChannelStatus
    inboxAccounts: {
        messenger: MetaInboxAccount | null
        instagram: MetaInboxAccount | null
    }
    consistency: {
        adapterReachable: boolean
        messengerInboxPresent: boolean
        instagramInboxPresent: boolean
        messengerInboxActiveMatchesConfig: boolean
        instagramInboxActiveMatchesConfig: boolean
        messengerInboxAddressMatchesConfig: boolean
        instagramInboxAddressMatchesConfig: boolean
        messengerInboxTransportMatches: boolean
        instagramInboxTransportMatches: boolean
    }
}

export const apiGetMetaChannelOverview = () =>
    ApiService.fetchData<MetaChannelOverview>({
        url: channelControlUrl('/settings/channels/meta'),
        method: 'get',
    })

export const apiUpdateMetaChannelConfig = (
    data: Partial<MetaChannelConfig>,
) =>
    ApiService.fetchData<MetaChannelOverview>({
        url: channelControlUrl('/settings/channels/meta'),
        method: 'put',
        data,
    })

export const apiSyncMetaChannelConfig = () =>
    ApiService.fetchData<MetaChannelOverview>({
        url: channelControlUrl('/settings/channels/meta/sync'),
        method: 'post',
    })

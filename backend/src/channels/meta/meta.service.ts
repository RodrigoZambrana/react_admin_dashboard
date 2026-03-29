import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { InboxChannelType, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { SecureConfigService } from '../../common/security/secure-config.service'
import { UpdateMetaChannelConfigDto } from './dto/update-meta-channel-config.dto'

type MetaStoredConfig = {
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

type MetaConfigInput = Partial<{
  [K in keyof MetaStoredConfig]: MetaStoredConfig[K] | null
}>

type MetaAdapterStatus = {
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

type MetaAdapterEffectiveConfig = {
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

const META_CHANNEL_CONFIG_KEY = 'meta_channel_config'

type MetaConfigSource = 'environment' | 'database'

@Injectable()
export class MetaChannelService {
  private readonly logger = new Logger(MetaChannelService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly secureConfig: SecureConfigService,
    private readonly config: ConfigService,
  ) {}

  async getOverview() {
    let status = await this.getAdapterStatusSafe()
    const configState = await this.resolveConfigForOverview(status)
    const config = configState.value

    if (
      configState.source === 'database' &&
      this.shouldSyncAdapterFromStoredConfig(status, config)
    ) {
      try {
        await this.pushConfigToAdapter(config)
        status = await this.getAdapterStatusSafe()
      } catch (error) {
        this.logger.warn(
          `Unable to rehydrate Meta adapter from stored config: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
    }

    const inboxAccounts = await this.ensureInboxAccounts(config)

    return {
      config,
      meta: {
        source: configState.source,
        updatedAt: configState.updatedAt,
      },
      status,
      inboxAccounts,
      consistency: {
        adapterReachable: status.driver !== 'unreachable',
        messengerInboxPresent: Boolean(inboxAccounts.messenger),
        instagramInboxPresent: Boolean(inboxAccounts.instagram),
        messengerInboxActiveMatchesConfig:
          inboxAccounts.messenger?.active == null
            ? !config.enabled || !config.messengerEnabled
            : inboxAccounts.messenger.active === (config.enabled && config.messengerEnabled),
        instagramInboxActiveMatchesConfig:
          inboxAccounts.instagram?.active == null
            ? !config.enabled || !config.instagramEnabled
            : inboxAccounts.instagram.active === (config.enabled && config.instagramEnabled),
        messengerInboxAddressMatchesConfig:
          inboxAccounts.messenger?.address == null
            ? !this.cleanString(config.pageId)
            : inboxAccounts.messenger.address === this.cleanString(config.pageId),
        instagramInboxAddressMatchesConfig:
          inboxAccounts.instagram?.address == null
            ? !this.cleanString(config.instagramBusinessAccountId)
            : inboxAccounts.instagram.address ===
              this.cleanString(config.instagramBusinessAccountId),
        messengerInboxTransportMatches:
          this.asRecord(inboxAccounts.messenger?.metadata)?.transport === 'meta_messenger',
        instagramInboxTransportMatches:
          this.asRecord(inboxAccounts.instagram?.metadata)?.transport === 'meta_instagram',
      },
    }
  }

  async updateConfig(input: UpdateMetaChannelConfigDto) {
    const current = await this.getConfig()
    const next = this.normalizeConfig({
      ...current,
      ...input,
    })

    await this.secureConfig.setJson<MetaStoredConfig>(META_CHANNEL_CONFIG_KEY, next)
    await this.ensureInboxAccounts(next)
    await this.pushConfigToAdapter(next)
    return this.getOverview()
  }

  async syncConfigToAdapter() {
    const config = await this.getConfig()
    await this.ensureInboxAccounts(config)
    await this.pushConfigToAdapter(config)
    return this.getOverview()
  }

  async getConfig() {
    const status = await this.getAdapterStatusSafe()
    return (await this.resolveConfigForOverview(status)).value
  }

  private async getStoredConfigRecord() {
    return this.secureConfig.getJson<MetaStoredConfig>(META_CHANNEL_CONFIG_KEY)
  }

  private async resolveConfigForOverview(status: MetaAdapterStatus) {
    const record = await this.getStoredConfigRecord()
    const adapterEffectiveConfig = await this.getAdapterEffectiveConfigSafe()
    const envFallback = this.getEnvFallbackConfig(status, adapterEffectiveConfig)
    const merged = this.normalizeConfig({
      ...envFallback,
      ...(record?.value ?? {}),
    })

    return {
      value: merged,
      source: record?.value ? 'database' : 'environment',
      updatedAt: record?.updatedAt?.toISOString() ?? null,
    } satisfies {
      value: MetaStoredConfig
      source: MetaConfigSource
      updatedAt: string | null
    }
  }

  private normalizeConfig(raw: MetaConfigInput): MetaStoredConfig {
    return {
      enabled: raw.enabled !== false,
      messengerEnabled: raw.messengerEnabled !== false,
      instagramEnabled: raw.instagramEnabled !== false,
      publicBaseUrl: this.normalizeUrl(raw.publicBaseUrl),
      pageId: this.cleanString(raw.pageId),
      instagramBusinessAccountId: this.cleanString(raw.instagramBusinessAccountId),
      appId: this.cleanString(raw.appId),
      verifyToken: this.cleanString(raw.verifyToken),
      appSecret: this.cleanString(raw.appSecret),
      pageAccessToken: this.cleanString(raw.pageAccessToken),
      messengerPageAccessToken: this.cleanString(raw.messengerPageAccessToken),
      instagramAccessToken: this.cleanString(raw.instagramAccessToken),
    }
  }

  private getEnvFallbackConfig(
    status: MetaAdapterStatus,
    adapterConfig: MetaAdapterEffectiveConfig | null,
  ): MetaConfigInput {
    return {
      enabled: adapterConfig?.enabled ?? status.enabled,
      messengerEnabled:
        adapterConfig?.messengerEnabled ?? status.messengerEnabled,
      instagramEnabled:
        adapterConfig?.instagramEnabled ?? status.instagramEnabled,
      publicBaseUrl:
        adapterConfig?.publicBaseUrl ??
        this.normalizeUrl(this.config.get<string>('META_PUBLIC_BASE_URL')) ??
        status.publicBaseUrl,
      pageId:
        adapterConfig?.pageId ??
        this.cleanString(this.config.get<string>('META_PAGE_ID')) ??
        status.messenger.pageId,
      instagramBusinessAccountId:
        adapterConfig?.instagramBusinessAccountId ??
        this.cleanString(this.config.get<string>('INSTAGRAM_BUSINESS_ACCOUNT_ID')) ??
        status.instagram.businessAccountId,
      appId:
        adapterConfig?.appId ??
        this.cleanString(this.config.get<string>('META_APP_ID')) ??
        status.appId,
      verifyToken:
        adapterConfig?.verifyToken ??
        this.cleanString(this.config.get<string>('META_VERIFY_TOKEN')),
      appSecret:
        adapterConfig?.appSecret ??
        this.cleanString(this.config.get<string>('META_APP_SECRET')),
      pageAccessToken:
        adapterConfig?.pageAccessToken ??
        this.cleanString(this.config.get<string>('META_PAGE_ACCESS_TOKEN')),
      messengerPageAccessToken: this.cleanString(
        adapterConfig?.messengerPageAccessToken ??
          this.config.get<string>('MESSENGER_PAGE_ACCESS_TOKEN'),
      ),
      instagramAccessToken: this.cleanString(
        adapterConfig?.instagramAccessToken ??
          this.config.get<string>('INSTAGRAM_ACCESS_TOKEN'),
      ),
    }
  }

  private async ensureInboxAccounts(config: MetaStoredConfig) {
    const messenger = await this.ensureInboxAccount({
      channel: InboxChannelType.MESSENGER,
      enabled: config.enabled && config.messengerEnabled,
      address: config.pageId,
      displayName: 'Facebook Messenger',
      transport: 'meta_messenger',
    })
    const instagram = await this.ensureInboxAccount({
      channel: InboxChannelType.INSTAGRAM,
      enabled: config.enabled && config.instagramEnabled,
      address: config.instagramBusinessAccountId,
      displayName: 'Instagram Messaging',
      transport: 'meta_instagram',
    })

    return {
      messenger: messenger
        ? {
            id: messenger.id,
            displayName: messenger.displayName,
            address: messenger.address,
            active: messenger.active,
            metadata: this.asRecord(messenger.metadata),
          }
        : null,
      instagram: instagram
        ? {
            id: instagram.id,
            displayName: instagram.displayName,
            address: instagram.address,
            active: instagram.active,
            metadata: this.asRecord(instagram.metadata),
          }
        : null,
    }
  }

  private async ensureInboxAccount(input: {
    channel: InboxChannelType
    enabled: boolean
    address: string | null
    displayName: string
    transport: 'meta_messenger' | 'meta_instagram'
  }) {
    const existing = await this.prisma.inboxAccount.findFirst({
      where: {
        channel: input.channel,
        OR: [
          ...(input.address ? [{ address: input.address }] : []),
          {
            metadata: {
              path: ['transport'],
              equals: input.transport,
            },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!input.address && !existing) {
      return null
    }

    const metadata = {
      transport: input.transport,
      provider: 'meta-graph',
      webhookPath: '/webhooks/meta',
    }

    if (existing) {
      const shouldBeActive = input.enabled && Boolean(input.address)
      return this.prisma.inboxAccount.update({
        where: { id: existing.id },
        data: {
          displayName: input.displayName,
          address: input.address ?? existing.address,
          active: shouldBeActive,
          metadata: metadata as Prisma.InputJsonValue,
        },
      })
    }

    if (!input.address) {
      return null
    }

    return this.prisma.inboxAccount.create({
      data: {
        channel: input.channel,
        displayName: input.displayName,
        address: input.address,
        active: input.enabled,
        metadata: metadata as Prisma.InputJsonValue,
      },
    })
  }

  private async getAdapterStatusSafe(): Promise<MetaAdapterStatus> {
    try {
      return await this.fetchFromAdapter<MetaAdapterStatus>('/channels/meta/status')
    } catch (error) {
      this.logger.warn(
        `Unable to fetch Meta adapter status: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return {
        driver: 'unreachable',
        enabled: false,
        messengerEnabled: false,
        instagramEnabled: false,
        appId: this.cleanString(this.config.get<string>('META_APP_ID')),
        graphVersion: 'v23.0',
        graphBaseUrl: 'https://graph.facebook.com',
        publicBaseUrl: this.normalizeUrl(this.config.get<string>('META_PUBLIC_BASE_URL')),
        publicWebhookUrl: null,
        verifyTokenPresent: false,
        appSecretPresent: false,
        webhookVerificationReady: false,
        signatureValidationReady: false,
        webhookInboundReady: false,
        messenger: {
          enabled: false,
          pageId: this.cleanString(this.config.get<string>('META_PAGE_ID')),
          pageAccessTokenPresent: false,
          outboundReady: false,
        },
        instagram: {
          enabled: false,
          businessAccountId: this.cleanString(
            this.config.get<string>('INSTAGRAM_BUSINESS_ACCOUNT_ID'),
          ),
          accessTokenPresent: false,
          outboundReady: false,
        },
        capabilities: {
          text: true,
          attachments: true,
          postbacks: true,
          quickReplies: true,
        },
      }
    }
  }

  private async getAdapterEffectiveConfigSafe(): Promise<MetaAdapterEffectiveConfig | null> {
    try {
      return await this.fetchFromAdapter<MetaAdapterEffectiveConfig>(
        '/channels/meta/config/effective',
      )
    } catch (error) {
      this.logger.warn(
        `Unable to fetch Meta adapter effective config: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return null
    }
  }

  private async pushConfigToAdapter(config: MetaStoredConfig) {
    await this.fetchFromAdapter('/channels/meta/config', {
      method: 'PUT',
      body: JSON.stringify({
        ...config,
        appId: config.appId,
        verifyToken: config.verifyToken,
        appSecret: config.appSecret,
        pageAccessToken: config.pageAccessToken,
        messengerPageAccessToken: config.messengerPageAccessToken,
        instagramAccessToken: config.instagramAccessToken,
      }),
    })
  }

  private shouldSyncAdapterFromStoredConfig(
    status: MetaAdapterStatus,
    config: MetaStoredConfig,
  ) {
    if (!status.enabled && config.enabled) {
      return true
    }

    if (status.publicBaseUrl !== config.publicBaseUrl) {
      return true
    }

    if (status.messenger.pageId !== config.pageId) {
      return true
    }

    if (status.instagram.businessAccountId !== config.instagramBusinessAccountId) {
      return true
    }

    if (Boolean(config.verifyToken) !== status.verifyTokenPresent) {
      return true
    }

    if (Boolean(config.appSecret) !== status.appSecretPresent) {
      return true
    }

    if (
      Boolean(config.messengerPageAccessToken || config.pageAccessToken) !==
      status.messenger.pageAccessTokenPresent
    ) {
      return true
    }

    if (
      Boolean(
        config.instagramAccessToken ||
          config.pageAccessToken ||
          config.messengerPageAccessToken,
      ) !== status.instagram.accessTokenPresent
    ) {
      return true
    }

    return false
  }

  private async fetchFromAdapter<T = any>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const baseUrl =
      this.config.get<string>('CHANNEL_ADAPTER_BASE_URL') ||
      'http://channel-adapter:4200'
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        'x-ai-internal-token':
          this.config.get<string>('AI_INTERNAL_TOKEN') ||
          'local-ai-internal-token',
        ...(init.headers || {}),
      },
    })
    const rawText = await response.text()
    const payload = rawText ? JSON.parse(rawText) : null

    if (!response.ok) {
      throw new BadRequestException(
        payload?.message || 'meta.channelAdapterRequestFailed',
      )
    }

    return payload as T
  }

  private cleanString(value: unknown) {
    if (typeof value !== 'string') {
      return null
    }
    const normalized = value.trim()
    return normalized.length ? normalized : null
  }

  private normalizeUrl(value: unknown) {
    const normalized = this.cleanString(value)
    if (!normalized) {
      return null
    }
    try {
      const url = new URL(normalized)
      return url.toString().replace(/\/$/, '')
    } catch {
      throw new BadRequestException('meta.publicBaseUrlInvalid')
    }
  }

  private asRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    return value as Record<string, unknown>
  }
}

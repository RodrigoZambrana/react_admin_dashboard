import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ConversationChannel, InboxChannelType, Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { SecureConfigService } from '../../common/security/secure-config.service'
import { UpdateWhatsappQrConfigDto } from './dto/update-whatsapp-qr-config.dto'

type WhatsappQrStoredConfig = {
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

type WhatsappQrConfigInput = Partial<{
  [K in keyof WhatsappQrStoredConfig]: WhatsappQrStoredConfig[K] | null
}>

type ChannelAdapterStatus = {
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

const WHATSAPP_QR_CONFIG_KEY = 'whatsapp_qr_channel_config'
const DEFAULT_WHATSAPP_QR_ADDRESS = 'whatsapp-qr-primary'
const ADOPTABLE_WHATSAPP_QR_STATES = new Set([
  'connected',
  'qr_ready',
  'connecting',
  'reconnecting',
  'stopped',
])

@Injectable()
export class WhatsappQrService {
  private readonly logger = new Logger(WhatsappQrService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly secureConfig: SecureConfigService,
    private readonly config: ConfigService,
  ) {}

  async getOverview() {
    const status = await this.getAdapterStatusSafe()
    const config = await this.resolveConfigForOverview(status)
    const inboxAccount = await this.ensureInboxAccountForConfig(config, {
      syncAddress: status.connectedPhone,
    })

    return {
      config,
      status,
      inboxAccount: inboxAccount
        ? {
            id: inboxAccount.id,
            displayName: inboxAccount.displayName,
            address: inboxAccount.address,
            active: inboxAccount.active,
            metadata: this.asRecord(inboxAccount.metadata),
          }
        : null,
      consistency: {
        inboxAccountPresent: Boolean(inboxAccount),
        channel: 'whatsapp',
        transport: 'qr',
        adapterReachable: status.state !== 'unreachable',
        adapterEnabledMatchesConfig: status.enabled === config.enabled,
        inboxActiveMatchesConfig:
          inboxAccount?.active == null ? true : inboxAccount.active === config.enabled,
        inboxAddressMatchesConfig:
          inboxAccount?.address == null
            ? true
            : inboxAccount.address ===
              (status.connectedPhone ||
                config.address ||
                DEFAULT_WHATSAPP_QR_ADDRESS),
        inboxTransportMatches:
          this.asRecord(inboxAccount?.metadata)?.transport === 'whatsapp_qr',
      },
    }
  }

  async updateConfig(input: UpdateWhatsappQrConfigDto) {
    const current = await this.getConfig()
    const next = this.normalizeConfig({
      ...current,
      ...input,
    })

    await this.secureConfig.setJson<WhatsappQrStoredConfig>(
      WHATSAPP_QR_CONFIG_KEY,
      next,
    )

    const inboxAccount = await this.ensureInboxAccountForConfig(next)
    await this.pushConfigToAdapter(next, inboxAccount)
    return this.getOverview()
  }

  async startSession() {
    const config = await this.getConfig()
    const inboxAccount = await this.ensureInboxAccountForConfig(config)
    await this.pushConfigToAdapter(config, inboxAccount)
    await this.ensureAdapterAction('start')
    return this.getOverview()
  }

  async stopSession() {
    await this.ensureAdapterAction('stop')
    return this.getOverview()
  }

  async reconnectSession() {
    const config = await this.getConfig()
    const inboxAccount = await this.ensureInboxAccountForConfig(config)
    await this.pushConfigToAdapter(config, inboxAccount)
    await this.ensureAdapterAction('reconnect')
    return this.getOverview()
  }

  async resetSession() {
    const config = await this.getConfig()
    const inboxAccount = await this.ensureInboxAccountForConfig(config)
    await this.pushConfigToAdapter(config, inboxAccount)
    await this.ensureAdapterAction('reset')
    return this.getOverview()
  }

  async syncConfigToAdapter() {
    const config = await this.getConfig()
    const inboxAccount = await this.ensureInboxAccountForConfig(config)
    await this.pushConfigToAdapter(config, inboxAccount)
    return this.getOverview()
  }

  async backfillHistory() {
    const config = await this.getConfig()
    const inboxAccount = await this.ensureInboxAccountForConfig(config)
    await this.pushConfigToAdapter(config, inboxAccount)

    const backfill = await this.fetchFromAdapter<{
      importedMessages: number
      importedConversations: number
      duplicateMessages: number
      skippedMessages: number
    }>('/channels/whatsapp-qr/backfill', {
      method: 'POST',
      body: JSON.stringify({}),
    })

    const cleanup = await this.cleanupNonQrWhatsappData(inboxAccount?.id ?? null)

    return {
      overview: await this.getOverview(),
      backfill,
      cleanup,
    }
  }

  async getConfig() {
    const record = await this.getStoredConfigRecord()
    return this.normalizeConfig(record?.value ?? {})
  }

  private async getStoredConfigRecord() {
    return this.secureConfig.getJson<WhatsappQrStoredConfig>(
      WHATSAPP_QR_CONFIG_KEY,
    )
  }

  private async resolveConfigForOverview(status: ChannelAdapterStatus) {
    const record = await this.getStoredConfigRecord()
    if (record?.value) {
      return this.normalizeConfig(record.value)
    }

    if (!this.shouldAdoptAdapterState(status)) {
      return this.normalizeConfig({})
    }

    const adopted = this.normalizeConfig({
      enabled: true,
      displayName: 'WhatsApp QR',
      address: this.cleanString(status.connectedPhone) || DEFAULT_WHATSAPP_QR_ADDRESS,
      autoStart: true,
    })
    await this.secureConfig.setJson<WhatsappQrStoredConfig>(
      WHATSAPP_QR_CONFIG_KEY,
      adopted,
    )
    return adopted
  }

  private shouldAdoptAdapterState(status: ChannelAdapterStatus) {
    return (
      status.enabled === true ||
      ADOPTABLE_WHATSAPP_QR_STATES.has(this.cleanString(status.state) || '')
    )
  }

  private normalizeConfig(raw: WhatsappQrConfigInput): WhatsappQrStoredConfig {
    const minReplyDelayMs = this.toBoundedInteger(raw.minReplyDelayMs, 3000, 0, 300000)
    const maxReplyDelayMs = this.toBoundedInteger(raw.maxReplyDelayMs, 9000, 0, 300000)

    return {
      enabled: raw.enabled === true,
      displayName: this.cleanString(raw.displayName) ?? 'WhatsApp QR',
      address: this.cleanString(raw.address),
      autoStart: raw.autoStart !== false,
      typingIndicatorEnabled: raw.typingIndicatorEnabled !== false,
      presenceIndicatorEnabled: raw.presenceIndicatorEnabled !== false,
      humanDelayEnabled: raw.humanDelayEnabled !== false,
      minReplyDelayMs: Math.min(minReplyDelayMs, maxReplyDelayMs),
      maxReplyDelayMs: Math.max(minReplyDelayMs, maxReplyDelayMs),
      maxOutboundPerHour: this.toBoundedInteger(raw.maxOutboundPerHour, 40, 1, 1000),
      maxOutboundPerDay: this.toBoundedInteger(raw.maxOutboundPerDay, 250, 1, 10000),
      reactionsEnabled: raw.reactionsEnabled !== false,
      readReceiptsEnabled: raw.readReceiptsEnabled !== false,
      allowProactiveOutbound: raw.allowProactiveOutbound === true,
      quietHoursStart: this.normalizeClock(raw.quietHoursStart),
      quietHoursEnd: this.normalizeClock(raw.quietHoursEnd),
    }
  }

  private async ensureInboxAccountForConfig(
    config: WhatsappQrStoredConfig,
    options: { syncAddress?: string | null } = {},
  ) {
    const desiredAddress =
      this.cleanString(options.syncAddress) ||
      config.address ||
      DEFAULT_WHATSAPP_QR_ADDRESS

    const metadata = {
      transport: 'whatsapp_qr',
      autoStart: config.autoStart,
      typingIndicatorEnabled: config.typingIndicatorEnabled,
      presenceIndicatorEnabled: config.presenceIndicatorEnabled,
      reactionsEnabled: config.reactionsEnabled,
      readReceiptsEnabled: config.readReceiptsEnabled,
    }

    const existing = await this.prisma.inboxAccount.findFirst({
      where: {
        channel: InboxChannelType.WHATSAPP,
        OR: [
          { address: desiredAddress },
          {
            metadata: {
              path: ['transport'],
              equals: 'whatsapp_qr',
            },
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
    })

    if (!config.enabled && !existing) {
      return null
    }

    let inboxAccount: Awaited<ReturnType<typeof this.prisma.inboxAccount.update>> | null =
      null

    if (existing) {
      inboxAccount = await this.prisma.inboxAccount.update({
        where: { id: existing.id },
        data: {
          displayName: config.displayName,
          address: desiredAddress,
          active: config.enabled,
          metadata: metadata as Prisma.InputJsonValue,
        },
      })
    } else {
      inboxAccount = await this.prisma.inboxAccount.create({
        data: {
          channel: InboxChannelType.WHATSAPP,
          displayName: config.displayName,
          address: desiredAddress,
          active: config.enabled,
          metadata: metadata as Prisma.InputJsonValue,
        },
      })
    }

    if (config.enabled && inboxAccount) {
      await this.prisma.inboxAccount.updateMany({
        where: {
          channel: InboxChannelType.WHATSAPP,
          id: { not: inboxAccount.id },
        },
        data: {
          active: false,
        },
      })
    }

    return inboxAccount
  }

  private async getAdapterStatusSafe(): Promise<ChannelAdapterStatus> {
    try {
      return await this.fetchFromAdapter<ChannelAdapterStatus>('/channels/whatsapp-qr/status')
    } catch (error) {
      this.logger.warn(
        `Unable to fetch WhatsApp QR adapter status: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return {
        enabled: false,
        state: 'unreachable',
        driver: 'whatsapp_qr',
        qrCodeDataUrl: null,
        qrCodeExpiresAt: null,
        connectedPhone: null,
        connectedAt: null,
        lastDisconnectAt: null,
        lastError: error instanceof Error ? error.message : 'adapter_unreachable',
        reconnectScheduledAt: null,
        outboundCounters: {
          lastHour: 0,
          lastDay: 0,
        },
        capabilities: {
          typing: true,
          reactions: true,
          presence: true,
          media: true,
        },
      }
    }
  }

  private async pushConfigToAdapter(
    config: WhatsappQrStoredConfig,
    inboxAccount:
      | {
          id: string
          address: string | null
        }
      | null,
  ) {
    await this.fetchFromAdapter('/channels/whatsapp-qr/config', {
      method: 'PUT',
      body: JSON.stringify({
        ...config,
        tenantKey:
          this.config.get<string>('CLIENT_SLUG') ||
          this.config.get<string>('clientSlug') ||
          'urucortinas',
        inboxAccountId: inboxAccount?.id ?? null,
        address: inboxAccount?.address ?? config.address,
      }),
    })
  }

  private async ensureAdapterAction(
    action: 'start' | 'stop' | 'reconnect' | 'reset',
  ) {
    await this.fetchFromAdapter(`/channels/whatsapp-qr/session/${action}`, {
      method: 'POST',
      body: JSON.stringify({}),
    })
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
        payload?.message || 'whatsappQr.channelAdapterRequestFailed',
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

  private normalizeClock(value: unknown) {
    const normalized = this.cleanString(value)
    if (!normalized) {
      return null
    }
    if (!/^\d{2}:\d{2}$/.test(normalized)) {
      throw new BadRequestException(
        'whatsappQr.quietHoursClockInvalid',
      )
    }
    return normalized
  }

  private toBoundedInteger(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
  ) {
    const parsed = Number(value)
    if (!Number.isFinite(parsed)) {
      return fallback
    }
    return Math.min(Math.max(Math.trunc(parsed), min), max)
  }

  private asRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    return value as Record<string, unknown>
  }

  private async cleanupNonQrWhatsappData(activeInboxAccountId: string | null) {
    const conversationsToDelete = await this.prisma.conversation.findMany({
      where: {
        channel: ConversationChannel.WHATSAPP,
        ...(activeInboxAccountId
          ? {
              OR: [
                { inboxAccountId: null },
                { inboxAccountId: { not: activeInboxAccountId } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
      },
    })

    const conversationIds = conversationsToDelete.map((entry) => entry.id)
    if (conversationIds.length) {
      await this.prisma.conversation.deleteMany({
        where: {
          id: {
            in: conversationIds,
          },
        },
      })
    }

    const inboxesToDelete = await this.prisma.inboxAccount.findMany({
      where: {
        channel: InboxChannelType.WHATSAPP,
        ...(activeInboxAccountId
          ? { id: { not: activeInboxAccountId } }
          : {}),
      },
      select: {
        id: true,
      },
    })

    const inboxIds = inboxesToDelete.map((entry) => entry.id)
    if (inboxIds.length) {
      await this.prisma.inboxAccount.deleteMany({
        where: {
          id: {
            in: inboxIds,
          },
        },
      })
    }

    return {
      deletedConversations: conversationIds.length,
      deletedInboxAccounts: inboxIds.length,
    }
  }
}

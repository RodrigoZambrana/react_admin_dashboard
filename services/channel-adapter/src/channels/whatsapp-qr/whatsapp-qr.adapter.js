import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import makeWASocket, {
  ALL_WA_PATCH_NAMES,
  BufferJSON,
  Browsers,
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  getAggregateVotesInPollMessage,
  getContentType,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  normalizeMessageContent,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import QRCode from 'qrcode'

const DEFAULT_CONFIG = Object.freeze({
  enabled: false,
  tenantKey: 'urucortinas',
  inboxAccountId: null,
  displayName: 'WhatsApp QR',
  address: 'whatsapp-qr-primary',
  autoStart: true,
  typingIndicatorEnabled: true,
  presenceIndicatorEnabled: true,
  humanDelayEnabled: true,
  minReplyDelayMs: 3000,
  maxReplyDelayMs: 9000,
  maxOutboundPerHour: 40,
  maxOutboundPerDay: 250,
  reactionsEnabled: true,
  readReceiptsEnabled: true,
  allowProactiveOutbound: false,
  quietHoursStart: null,
  quietHoursEnd: null,
})

const DEFAULT_STATUS = () => ({
  enabled: false,
  state: 'idle',
  driver: 'whatsapp_qr',
  qrCodeDataUrl: null,
  qrCodeExpiresAt: null,
  connectedPhone: null,
  connectedAt: null,
  lastDisconnectAt: null,
  lastError: null,
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
})

const normalizeString = (value) => {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized.length ? normalized : null
}

const toBoundedInteger = (value, fallback, min, max) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return fallback
  }
  return Math.min(Math.max(Math.trunc(parsed), min), max)
}

const normalizeClock = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) {
    return null
  }
  return /^\d{2}:\d{2}$/.test(normalized) ? normalized : null
}

const toPhoneDigits = (value) => String(value || '').replace(/\D+/g, '')

const toWhatsAppJid = (value) => {
  const normalized = normalizeString(value)
  if (!normalized) {
    return null
  }
  if (normalized.includes('@')) {
    return jidNormalizedUser(normalized)
  }
  const digits = toPhoneDigits(normalized)
  return digits ? `${digits}@s.whatsapp.net` : null
}

const toDateFromWhatsAppTimestamp = (value) => {
  if (value == null) {
    return null
  }
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'bigint'
        ? Number(value)
        : typeof value === 'string'
          ? Number(value)
          : typeof value?.toNumber === 'function'
            ? Number(value.toNumber())
            : typeof value?.toString === 'function'
              ? Number(value.toString())
              : Number(value)

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  const milliseconds = numeric > 1_000_000_000_000 ? numeric : numeric * 1000
  return new Date(milliseconds)
}

const buildHistoryMessageKey = (message) => {
  const remoteJid = normalizeString(message?.key?.remoteJid) || 'unknown'
  const messageId = normalizeString(message?.key?.id)
  if (messageId) {
    return `${remoteJid}:${messageId}`
  }
  const timestamp = toDateFromWhatsAppTimestamp(message?.messageTimestamp)?.toISOString()
  return `${remoteJid}:${timestamp || 'no-timestamp'}:${message?.key?.fromMe ? 'out' : 'in'}`
}

const normalizeDigits = (value) => {
  const digits = toPhoneDigits(value)
  return digits || null
}

const MEDIA_MESSAGE_TYPES = new Set([
  'imageMessage',
  'videoMessage',
  'documentMessage',
  'audioMessage',
  'stickerMessage',
])

const GROUP_METADATA_TTL_MS = 5 * 60 * 1000
const MAX_PERSISTED_MESSAGES = 5000
const STORE_VERSION = 1

const deepCloneJson = (value) => {
  if (value == null) {
    return null
  }
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

const cloneWithBufferJson = (value) => {
  if (value == null) {
    return null
  }

  try {
    return JSON.parse(JSON.stringify(value, BufferJSON.replacer), BufferJSON.reviver)
  } catch {
    return null
  }
}

const hydrateBinaryJson = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => hydrateBinaryJson(entry))
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  if (
    value.type === 'Buffer' &&
    Array.isArray(value.data) &&
    value.data.every((entry) => Number.isInteger(entry))
  ) {
    return Buffer.from(value.data)
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, hydrateBinaryJson(entry)]),
  )
}

const getMessageContentNode = (message) => {
  const content = normalizeMessageContent(message?.message)
  if (!content) {
    return {
      content: null,
      type: null,
      node: null,
    }
  }

  const type = getContentType(content)
  return {
    content,
    type,
    node: type ? content?.[type] : null,
  }
}

const serializeWhatsappMessageKey = (key) => {
  if (!key || typeof key !== 'object') {
    return null
  }

  return {
    remoteJid: normalizeString(key.remoteJid) || null,
    id: normalizeString(key.id) || null,
    fromMe: key.fromMe === true,
    participant: normalizeString(key.participant) || null,
  }
}

const serializeWhatsappMessageSnapshot = (message) => {
  if (!message || typeof message !== 'object') {
    return null
  }

  const snapshot = {
    key: serializeWhatsappMessageKey(message.key),
    message: normalizeMessageContent(message.message) || null,
    messageTimestamp: message.messageTimestamp ?? null,
    pushName: normalizeString(message.pushName) || null,
    participant: normalizeString(message.participant) || null,
    status: message.status ?? null,
  }

  return deepCloneJson(snapshot)
}

const deserializeWhatsappMessageSnapshot = (snapshot) => {
  const normalized = deepCloneJson(snapshot)
  if (!normalized || typeof normalized !== 'object') {
    return null
  }
  return hydrateBinaryJson(normalized)
}

const resolveMimeExtension = (contentType) => {
  const normalized = String(contentType || '').trim().toLowerCase()
  if (!normalized) {
    return null
  }
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg'
  if (normalized.includes('png')) return 'png'
  if (normalized.includes('webp')) return 'webp'
  if (normalized.includes('gif')) return 'gif'
  if (normalized.includes('pdf')) return 'pdf'
  if (normalized.includes('ogg')) return 'ogg'
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3'
  if (normalized.includes('mp4')) return 'mp4'
  if (normalized.includes('quicktime')) return 'mov'
  if (normalized.includes('msword')) return 'doc'
  if (normalized.includes('officedocument.wordprocessingml')) return 'docx'
  if (normalized.includes('spreadsheetml')) return 'xlsx'
  if (normalized.includes('excel')) return 'xls'
  return null
}

const inferAttachmentAssetType = (messageType) => {
  switch (messageType) {
    case 'imageMessage':
    case 'stickerMessage':
      return 'image'
    case 'videoMessage':
      return 'video'
    case 'audioMessage':
      return 'audio'
    case 'documentMessage':
      return 'document'
    default:
      return 'file'
  }
}

const buildWhatsappMessageMetadata = (message, options = {}) => {
  const { type, node } = getMessageContentNode(message)
  const messageKey = serializeWhatsappMessageKey(message?.key)
  return {
    messageKey,
    messageSnapshot: serializeWhatsappMessageSnapshot(message),
    messageType: type,
    canReact: Boolean(messageKey?.id && messageKey?.remoteJid),
    canForward: Boolean(message?.message),
    hasMedia: Boolean(type && MEDIA_MESSAGE_TYPES.has(type)),
    contentType: normalizeString(node?.mimetype) || null,
    fileName: normalizeString(node?.fileName) || null,
    historyImport: options.historyImport === true,
  }
}

const buildPersistedMessageKey = (messageKey) => {
  const remoteJid = normalizeString(messageKey?.remoteJid)
  const messageId = normalizeString(messageKey?.id)
  if (!remoteJid || !messageId) {
    return null
  }
  return `${jidNormalizedUser(remoteJid)}:${messageId}`
}

const toMessageTimestampSeconds = (value) => {
  const date = toDateFromWhatsAppTimestamp(value)
  if (!date) {
    return null
  }
  return Math.floor(date.getTime() / 1000)
}

const buildNormalizedMessageActionContext = (payload) => {
  const messageKey = payload?.messageKey && typeof payload.messageKey === 'object'
    ? payload.messageKey
    : null
  const snapshot = deserializeWhatsappMessageSnapshot(payload?.messageSnapshot)
  const snapshotKey =
    snapshot?.key && typeof snapshot.key === 'object' ? snapshot.key : null
  const threadId =
    normalizeString(payload?.threadId) ||
    normalizeString(messageKey?.remoteJid) ||
    normalizeString(snapshotKey?.remoteJid)
  const jid = toWhatsAppJid(threadId)
  const messageId =
    normalizeString(messageKey?.id) ||
    normalizeString(snapshotKey?.id) ||
    normalizeString(payload?.messageId)
  const fromMe =
    messageKey?.fromMe === true ||
    snapshotKey?.fromMe === true ||
    payload?.fromMe === true
  const participant =
    normalizeString(messageKey?.participant) ||
    normalizeString(snapshotKey?.participant) ||
    null

  return {
    jid,
    threadId,
    messageId,
    messageKey,
    snapshot,
    snapshotKey,
    fromMe,
    participant,
  }
}

const buildChatModifyMessageRef = (payload) => {
  const context = buildNormalizedMessageActionContext(payload)
  if (!context.messageId) {
    return null
  }

  const timestamp =
    toMessageTimestampSeconds(payload?.messageTimestamp) ||
    toMessageTimestampSeconds(context.snapshot?.messageTimestamp)

  return {
    id: context.messageId,
    fromMe: context.fromMe,
    participant: context.participant,
    timestamp: timestamp ? String(timestamp) : null,
  }
}

const buildChatModifyLastMessageRef = (payload) => {
  const context = buildNormalizedMessageActionContext(payload)
  const timestamp =
    toMessageTimestampSeconds(payload?.messageTimestamp) ||
    toMessageTimestampSeconds(context.snapshot?.messageTimestamp)

  if (!context.jid || !context.messageId || !timestamp) {
    return null
  }

  return {
    key: {
      remoteJid: context.jid,
      id: context.messageId,
      fromMe: context.fromMe,
      participant: context.participant,
    },
    messageTimestamp: timestamp,
  }
}

const isOwnDigits = (candidate, ownDigits) => {
  if (!candidate || !ownDigits) {
    return false
  }
  return candidate === ownDigits || candidate.startsWith(ownDigits) || ownDigits.startsWith(candidate)
}

const extractPlainText = (message) => {
  const { content, type, node } = getMessageContentNode(message)
  if (!content) {
    return ''
  }

  switch (type) {
    case 'conversation':
      return String(content.conversation || '').trim()
    case 'extendedTextMessage':
      return String(node?.text || '').trim()
    case 'imageMessage':
    case 'videoMessage':
    case 'documentMessage':
      return String(node?.caption || '').trim()
    case 'buttonsResponseMessage':
      return String(node?.selectedButtonId || '').trim()
    case 'listResponseMessage':
      return String(
        node?.singleSelectReply?.selectedRowId || node?.title || '',
      ).trim()
    default:
      return ''
  }
}

const extractAttachments = (message) => {
  const { content, type, node } = getMessageContentNode(message)
  if (!content || !type || !node) {
    return []
  }

  switch (type) {
    case 'imageMessage':
      return [
        {
          assetType: inferAttachmentAssetType(type),
          fileName: null,
          contentType: 'image/jpeg',
          content: null,
          metadata: {
            transport: 'whatsapp_qr',
            messageType: 'image',
            mimetype: node?.mimetype || null,
            mediaKeyTimestamp: node?.mediaKeyTimestamp || null,
            seconds: node?.seconds || null,
            size:
              typeof node?.fileLength === 'number' ? node.fileLength : null,
            downloadable: true,
          },
        },
      ]
    case 'videoMessage':
      return [
        {
          assetType: inferAttachmentAssetType(type),
          fileName: null,
          contentType: node?.mimetype || 'video/mp4',
          content: null,
          metadata: {
            transport: 'whatsapp_qr',
            messageType: 'video',
            seconds: node?.seconds || null,
            size:
              typeof node?.fileLength === 'number' ? node.fileLength : null,
            downloadable: true,
          },
        },
      ]
    case 'documentMessage':
      return [
        {
          assetType: inferAttachmentAssetType(type),
          fileName: node?.fileName || null,
          contentType: node?.mimetype || null,
          content: null,
          metadata: {
            transport: 'whatsapp_qr',
            messageType: 'document',
            pageCount: node?.pageCount || null,
            size:
              typeof node?.fileLength === 'number' ? node.fileLength : null,
            downloadable: true,
          },
        },
      ]
    case 'audioMessage':
      return [
        {
          assetType: inferAttachmentAssetType(type),
          fileName: null,
          contentType: node?.mimetype || 'audio/ogg',
          content: null,
          metadata: {
            transport: 'whatsapp_qr',
            messageType: 'audio',
            seconds: node?.seconds || null,
            ptt: node?.ptt === true,
            size:
              typeof node?.fileLength === 'number' ? node.fileLength : null,
            downloadable: true,
          },
        },
      ]
    case 'stickerMessage':
      return [
        {
          assetType: inferAttachmentAssetType(type),
          fileName: null,
          contentType: node?.mimetype || 'image/webp',
          content: null,
          metadata: {
            transport: 'whatsapp_qr',
            messageType: 'sticker',
            size:
              typeof node?.fileLength === 'number' ? node.fileLength : null,
            downloadable: true,
          },
        },
      ]
    default:
      return []
  }
}

export class WhatsappQrAdapter {
  constructor(clients, config) {
    this.clients = clients
    this.config = config
    this.logger = pino({ level: 'silent' })
    this.runtimeConfig = { ...DEFAULT_CONFIG, tenantKey: config.clientSlug || 'urucortinas' }
    this.status = DEFAULT_STATUS()
    this.sock = null
    this.saveCreds = null
    this.reconnectTimer = null
    this.storePersistTimer = null
    this.reconnectAttempts = 0
    this.manualStop = false
    this.outboundLog = []
    this.runtimeDir = path.resolve(
      config.whatsappRuntimeDir || path.join(process.cwd(), 'runtime', 'whatsapp-qr'),
    )
    this.authDir = path.join(this.runtimeDir, 'auth')
    this.configPath = path.join(this.runtimeDir, 'config.json')
    this.storePath = path.join(this.runtimeDir, 'baileys-store.json')
    this.historyMessages = new Map()
    this.historyChatNames = new Map()
    this.knownChats = new Map()
    this.persistedMessages = new Map()
    this.persistedChats = new Map()
    this.persistedContacts = new Map()
    this.groupMetadataCache = new Map()
    this.pollVoteAggregates = new Map()
    this.lastBackfillResult = null
  }

  async init() {
    await fs.mkdir(this.authDir, { recursive: true })
    await this.loadPersistedConfig()
    await this.loadPersistedStore()
    if (this.runtimeConfig.enabled && this.runtimeConfig.autoStart) {
      await this.startSession()
    }
  }

  getStatus() {
    this.refreshOutboundCounters()
    return {
      ...this.status,
      enabled: this.runtimeConfig.enabled,
      outboundCounters: {
        lastHour: this.status.outboundCounters.lastHour,
        lastDay: this.status.outboundCounters.lastDay,
      },
      history: {
        knownChatsCount: this.knownChats.size,
        bufferedMessagesCount: this.historyMessages.size,
        persistedMessagesCount: this.persistedMessages.size,
        cachedGroupsCount: this.groupMetadataCache.size,
        lastBackfillResult: this.lastBackfillResult,
      },
    }
  }

  async updateConfig(input) {
    const minReplyDelayMs = toBoundedInteger(
      input?.minReplyDelayMs,
      this.runtimeConfig.minReplyDelayMs,
      0,
      300000,
    )
    const maxReplyDelayMs = toBoundedInteger(
      input?.maxReplyDelayMs,
      this.runtimeConfig.maxReplyDelayMs,
      0,
      300000,
    )

    this.runtimeConfig = {
      ...this.runtimeConfig,
      enabled: input?.enabled === true,
      tenantKey: normalizeString(input?.tenantKey) || this.runtimeConfig.tenantKey,
      inboxAccountId: normalizeString(input?.inboxAccountId),
      displayName: normalizeString(input?.displayName) || DEFAULT_CONFIG.displayName,
      address: normalizeString(input?.address) || DEFAULT_CONFIG.address,
      autoStart: input?.autoStart !== false,
      typingIndicatorEnabled: input?.typingIndicatorEnabled !== false,
      presenceIndicatorEnabled: input?.presenceIndicatorEnabled !== false,
      humanDelayEnabled: input?.humanDelayEnabled !== false,
      minReplyDelayMs: Math.min(minReplyDelayMs, maxReplyDelayMs),
      maxReplyDelayMs: Math.max(minReplyDelayMs, maxReplyDelayMs),
      maxOutboundPerHour: toBoundedInteger(
        input?.maxOutboundPerHour,
        this.runtimeConfig.maxOutboundPerHour,
        1,
        1000,
      ),
      maxOutboundPerDay: toBoundedInteger(
        input?.maxOutboundPerDay,
        this.runtimeConfig.maxOutboundPerDay,
        1,
        10000,
      ),
      reactionsEnabled: input?.reactionsEnabled !== false,
      readReceiptsEnabled: input?.readReceiptsEnabled !== false,
      allowProactiveOutbound: input?.allowProactiveOutbound === true,
      quietHoursStart: normalizeClock(input?.quietHoursStart),
      quietHoursEnd: normalizeClock(input?.quietHoursEnd),
    }

    this.status.enabled = this.runtimeConfig.enabled
    await this.persistConfig()

    if (!this.runtimeConfig.enabled) {
      await this.stopSession({ preserveAuth: true })
    } else if (this.runtimeConfig.autoStart && !this.sock) {
      await this.startSession()
    }

    return this.getStatus()
  }

  async startSession() {
    if (this.sock) {
      return this.getStatus()
    }

    if (!this.runtimeConfig.enabled) {
      this.status.state = 'disabled'
      return this.getStatus()
    }

    this.manualStop = false
    this.clearReconnectTimer()
    await this.startSocket()
    return this.getStatus()
  }

  async stopSession(options = {}) {
    this.manualStop = true
    this.clearReconnectTimer()
    if (this.storePersistTimer) {
      clearTimeout(this.storePersistTimer)
      this.storePersistTimer = null
      await this.persistStore().catch(() => undefined)
    }
    if (this.sock) {
      try {
        this.sock.end(new Error('manual_stop'))
      } catch {}
      this.sock = null
    }
    this.status.state = this.runtimeConfig.enabled ? 'stopped' : 'disabled'
    this.status.qrCodeDataUrl = null
    this.status.qrCodeExpiresAt = null
    this.status.reconnectScheduledAt = null

    if (options.preserveAuth !== true) {
      await fs.rm(this.authDir, { recursive: true, force: true })
      await fs.mkdir(this.authDir, { recursive: true })
      this.status.connectedPhone = null
      this.status.connectedAt = null
    }

    return this.getStatus()
  }

  async reconnectSession() {
    await this.stopSession({ preserveAuth: true })
    this.manualStop = false
    await this.startSession()
    return this.getStatus()
  }

  async resetSession() {
    await this.stopSession({ preserveAuth: false })
    if (this.runtimeConfig.enabled) {
      await this.startSession()
    }
    return this.getStatus()
  }

  async sendOutbound(payload) {
    const text = normalizeString(payload?.text)
    const threadId = normalizeString(payload?.threadId)
    const recipientId = normalizeString(payload?.recipientId)
    if (!text) {
      throw new Error('text is required for whatsapp qr outbound messages')
    }
    if (!recipientId && !threadId) {
      throw new Error('recipientId or threadId is required for whatsapp qr outbound messages')
    }
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const source = normalizeString(payload?.metadata?.source)
    const simulateHumanBehavior = source === 'ai-agent-service'
    if (!this.runtimeConfig.allowProactiveOutbound && source === 'ai-agent-service') {
      if (this.isWithinQuietHours()) {
        throw new Error('whatsapp_qr_quiet_hours')
      }
    }

    this.assertOutboundLimits()

    const jid = toWhatsAppJid(threadId) || toWhatsAppJid(recipientId)
    if (!jid) {
      throw new Error('invalid_whatsapp_recipient')
    }

    const typingDelayMs = simulateHumanBehavior
      ? this.calculateReplyDelay(text)
      : 0

    if (simulateHumanBehavior && this.runtimeConfig.presenceIndicatorEnabled) {
      await this.sock.sendPresenceUpdate('available', jid).catch(() => undefined)
    }

    if (simulateHumanBehavior && this.runtimeConfig.typingIndicatorEnabled) {
      await this.sock.sendPresenceUpdate('composing', jid).catch(() => undefined)
    }

    if (typingDelayMs > 0) {
      await delay(typingDelayMs)
    }

    const result = await this.sock.sendMessage(jid, { text })

    if (simulateHumanBehavior && this.runtimeConfig.typingIndicatorEnabled) {
      await this.sock.sendPresenceUpdate('paused', jid).catch(() => undefined)
    }

    this.recordOutbound()

    const whatsapp = buildWhatsappMessageMetadata({
      ...result,
      key: {
        ...(result?.key || {}),
        remoteJid: jid,
        fromMe: true,
      },
      message:
        result?.message ||
        {
          conversation: text,
        },
    })

    this.storeMessage({
      ...result,
      key: {
        ...(result?.key || {}),
        remoteJid: jid,
        fromMe: true,
      },
      message:
        result?.message ||
        {
          conversation: text,
        },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: result?.status ?? null,
    }, {
      source: 'sendMessage',
    })

    return {
      provider: 'whatsapp-qr',
      remoteId: result?.key?.id || `waqr:${Date.now()}`,
      providerMessageId: result?.key?.id || `waqr:${Date.now()}`,
      threadRemoteId: jidNormalizedUser(jid),
      deliveryStatus: 'accepted',
      metadata: {
        transport: 'whatsapp_qr',
        jid,
        threadId: threadId || null,
        typingDelayMs,
        whatsapp,
      },
    }
  }

  async reactToMessage(payload) {
    if (!this.runtimeConfig.reactionsEnabled) {
      throw new Error('whatsapp_qr_reactions_disabled')
    }
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const emoji = normalizeString(payload?.emoji)
    if (!emoji) {
      throw new Error('emoji is required for whatsapp qr reactions')
    }

    const messageKey = payload?.messageKey && typeof payload.messageKey === 'object'
      ? payload.messageKey
      : null
    const snapshot = deserializeWhatsappMessageSnapshot(payload?.messageSnapshot)
    const snapshotKey =
      snapshot?.key && typeof snapshot.key === 'object' ? snapshot.key : null
    const threadId =
      normalizeString(payload?.threadId) ||
      normalizeString(messageKey?.remoteJid) ||
      normalizeString(snapshotKey?.remoteJid)
    const jid = toWhatsAppJid(threadId)

    if (!jid) {
      throw new Error('threadId is required for whatsapp qr reactions')
    }

    const keyId =
      normalizeString(messageKey?.id) ||
      normalizeString(snapshotKey?.id) ||
      normalizeString(payload?.messageId)

    if (!keyId) {
      throw new Error('messageId is required for whatsapp qr reactions')
    }

    await this.sock.sendMessage(jid, {
      react: {
        text: emoji,
        key: {
          remoteJid: jid,
          id: keyId,
          fromMe:
            messageKey?.fromMe === true ||
            snapshotKey?.fromMe === true ||
            payload?.fromMe === true,
          participant:
            normalizeString(messageKey?.participant) ||
            normalizeString(snapshotKey?.participant) ||
            null,
        },
      },
    })

    return {
      ok: true,
      provider: 'whatsapp-qr',
      threadRemoteId: jidNormalizedUser(jid),
      messageId: keyId,
      emoji,
    }
  }

  async replyToMessage(payload) {
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const text = normalizeString(payload?.text)
    if (!text) {
      throw new Error('text is required for whatsapp qr reply')
    }

    const context = buildNormalizedMessageActionContext(payload)
    if (!context.jid) {
      throw new Error('threadId is required for whatsapp qr reply')
    }
    if (!context.snapshot?.message) {
      throw new Error('messageSnapshot is required for quoted whatsapp qr reply')
    }

    const result = await this.sock.sendMessage(
      context.jid,
      {
        text,
      },
      {
        quoted: context.snapshot,
      },
    )

    this.storeMessage({
      ...result,
      key: {
        ...(result?.key || {}),
        remoteJid: context.jid,
        fromMe: true,
      },
      message:
        result?.message ||
        {
          conversation: text,
        },
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: result?.status ?? null,
    }, {
      source: 'reply',
    })

    return {
      provider: 'whatsapp-qr',
      remoteId: result?.key?.id || `waqr:${Date.now()}`,
      providerMessageId: result?.key?.id || `waqr:${Date.now()}`,
      threadRemoteId: jidNormalizedUser(context.jid),
      deliveryStatus: 'accepted',
      metadata: {
        transport: 'whatsapp_qr',
        action: 'reply',
        quotedMessageId: context.messageId,
        whatsapp: buildWhatsappMessageMetadata({
          ...result,
          key: {
            ...(result?.key || {}),
            remoteJid: context.jid,
            fromMe: true,
          },
        }),
      },
    }
  }

  async editMessage(payload) {
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const text = normalizeString(payload?.text)
    if (!text) {
      throw new Error('text is required for whatsapp qr edit')
    }

    const context = buildNormalizedMessageActionContext(payload)
    if (!context.jid || !context.messageId) {
      throw new Error('threadId and messageId are required for whatsapp qr edit')
    }
    if (!context.fromMe) {
      throw new Error('only outbound whatsapp qr messages can be edited')
    }

    const result = await this.sock.sendMessage(context.jid, {
      text,
      edit: {
        remoteJid: context.jid,
        id: context.messageId,
        fromMe: true,
        participant: context.participant,
      },
    })

    this.storeMessage({
      key: {
        remoteJid: context.jid,
        id: context.messageId,
        fromMe: true,
        participant: context.participant,
      },
      message:
        result?.message ||
        {
          conversation: text,
        },
      messageTimestamp:
        toMessageTimestampSeconds(context.snapshot?.messageTimestamp) ||
        Math.floor(Date.now() / 1000),
      status: result?.status ?? null,
      pushName: context.snapshot?.pushName ?? null,
      participant: context.participant,
    }, {
      source: 'edit',
    })

    return {
      ok: true,
      provider: 'whatsapp-qr',
      threadRemoteId: jidNormalizedUser(context.jid),
      messageId: context.messageId,
      text,
    }
  }

  async deleteMessage(payload) {
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const context = buildNormalizedMessageActionContext(payload)
    if (!context.jid || !context.messageId) {
      throw new Error('threadId and messageId are required for whatsapp qr delete')
    }
    if (!context.fromMe) {
      throw new Error('only outbound whatsapp qr messages can be deleted')
    }

    await this.sock.sendMessage(context.jid, {
      delete: {
        remoteJid: context.jid,
        id: context.messageId,
        fromMe: true,
        participant: context.participant,
      },
    })

    return {
      ok: true,
      provider: 'whatsapp-qr',
      threadRemoteId: jidNormalizedUser(context.jid),
      messageId: context.messageId,
    }
  }

  async setMessageStar(payload) {
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const context = buildNormalizedMessageActionContext(payload)
    if (!context.jid) {
      throw new Error('threadId is required for whatsapp qr star')
    }

    const messageRef = buildChatModifyMessageRef(payload)
    if (!messageRef?.id) {
      throw new Error('messageId is required for whatsapp qr star')
    }

    await this.sock.chatModify(
      {
        star: {
          messages: [
            {
              id: messageRef.id,
              fromMe: messageRef.fromMe,
              participant: messageRef.participant,
            },
          ],
          star: payload?.starred !== false,
        },
      },
      context.jid,
    )

    return {
      ok: true,
      provider: 'whatsapp-qr',
      threadRemoteId: jidNormalizedUser(context.jid),
      messageId: messageRef.id,
      starred: payload?.starred !== false,
    }
  }

  async archiveChat(payload) {
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const jid = toWhatsAppJid(payload?.threadId)
    const lastMessage = buildChatModifyLastMessageRef(payload)
    if (!jid || !lastMessage) {
      throw new Error('threadId and latest message context are required for whatsapp qr archive')
    }

    await this.sock.chatModify(
      {
        archive: payload?.archived !== false,
        lastMessages: [lastMessage],
      },
      jid,
    )

    return {
      ok: true,
      provider: 'whatsapp-qr',
      threadRemoteId: jidNormalizedUser(jid),
      archived: payload?.archived !== false,
    }
  }

  async setChatRead(payload) {
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const jid = toWhatsAppJid(payload?.threadId)
    const lastMessage = buildChatModifyLastMessageRef(payload)
    if (!jid || !lastMessage) {
      throw new Error('threadId and latest message context are required for whatsapp qr read state')
    }

    await this.sock.chatModify(
      {
        markRead: payload?.read !== false,
        lastMessages: [lastMessage],
      },
      jid,
    )

    return {
      ok: true,
      provider: 'whatsapp-qr',
      threadRemoteId: jidNormalizedUser(jid),
      read: payload?.read !== false,
    }
  }

  async setChatPin(payload) {
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const jid = toWhatsAppJid(payload?.threadId)
    if (!jid) {
      throw new Error('threadId is required for whatsapp qr pin state')
    }

    await this.sock.chatModify(
      {
        pin: payload?.pinned !== false,
      },
      jid,
    )

    return {
      ok: true,
      provider: 'whatsapp-qr',
      threadRemoteId: jidNormalizedUser(jid),
      pinned: payload?.pinned !== false,
    }
  }

  async setChatMute(payload) {
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const jid = toWhatsAppJid(payload?.threadId)
    if (!jid) {
      throw new Error('threadId is required for whatsapp qr mute state')
    }

    const muteDurationMs =
      payload?.muteDurationMs == null ? null : Number(payload.muteDurationMs)
    if (muteDurationMs != null && (!Number.isFinite(muteDurationMs) || muteDurationMs < 0)) {
      throw new Error('muteDurationMs must be a positive number or null')
    }

    await this.sock.chatModify(
      {
        mute: muteDurationMs,
      },
      jid,
    )

    return {
      ok: true,
      provider: 'whatsapp-qr',
      threadRemoteId: jidNormalizedUser(jid),
      muted: muteDurationMs != null,
      muteDurationMs,
    }
  }

  async deleteChat(payload) {
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const jid = toWhatsAppJid(payload?.threadId)
    const lastMessage = buildChatModifyLastMessageRef(payload)
    if (!jid || !lastMessage) {
      throw new Error('threadId and latest message context are required for whatsapp qr chat delete')
    }

    await this.sock.chatModify(
      {
        delete: true,
        lastMessages: [lastMessage],
      },
      jid,
    )

    return {
      ok: true,
      provider: 'whatsapp-qr',
      threadRemoteId: jidNormalizedUser(jid),
      deleted: true,
    }
  }

  async forwardMessage(payload) {
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const targetThreadId = normalizeString(payload?.targetThreadId)
    const targetRecipientId = normalizeString(payload?.targetRecipientId)
    const targetJid = toWhatsAppJid(targetThreadId) || toWhatsAppJid(targetRecipientId)

    if (!targetJid) {
      throw new Error('targetThreadId or targetRecipientId is required')
    }

    const snapshot = deserializeWhatsappMessageSnapshot(payload?.messageSnapshot)
    const fallbackText = normalizeString(payload?.text)

    let result = null
    if (snapshot?.message) {
      result = await this.sock.sendMessage(targetJid, {
        forward: snapshot,
        force: payload?.force === true,
      })
    } else if (fallbackText) {
      result = await this.sock.sendMessage(targetJid, {
        text: fallbackText,
      })
    } else {
      throw new Error('messageSnapshot or text is required for whatsapp qr forward')
    }

    this.storeMessage({
      ...result,
      key: {
        ...(result?.key || {}),
        remoteJid: targetJid,
        fromMe: true,
      },
      message:
        result?.message ||
        snapshot?.message ||
        (fallbackText
          ? {
              conversation: fallbackText,
            }
          : null),
      messageTimestamp: Math.floor(Date.now() / 1000),
      status: result?.status ?? null,
    }, {
      source: 'forward',
    })

    return {
      provider: 'whatsapp-qr',
      remoteId: result?.key?.id || `waqr:${Date.now()}`,
      providerMessageId: result?.key?.id || `waqr:${Date.now()}`,
      threadRemoteId: jidNormalizedUser(targetJid),
      deliveryStatus: 'accepted',
      metadata: {
        transport: 'whatsapp_qr',
        action: 'forward',
        targetJid,
        whatsapp: buildWhatsappMessageMetadata({
          ...result,
          key: {
            ...(result?.key || {}),
            remoteJid: targetJid,
            fromMe: true,
          },
        }),
        forwardedSourceMessageId:
          normalizeString(snapshot?.key?.id) || null,
      },
    }
  }

  async downloadMessageMedia(payload) {
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const snapshot = deserializeWhatsappMessageSnapshot(payload?.messageSnapshot)
    if (!snapshot?.message) {
      throw new Error('messageSnapshot is required to download media')
    }

    const { type, node } = getMessageContentNode(snapshot)
    if (!type || !MEDIA_MESSAGE_TYPES.has(type) || !node) {
      throw new Error('message does not contain downloadable media')
    }

    const buffer = await downloadMediaMessage(
      snapshot,
      'buffer',
      {},
      {
        reuploadRequest: this.sock.updateMediaMessage,
      },
    )

    const contentType =
      normalizeString(node?.mimetype) ||
      (type === 'imageMessage'
        ? 'image/jpeg'
        : type === 'audioMessage'
          ? 'audio/ogg'
          : type === 'videoMessage'
            ? 'video/mp4'
            : 'application/octet-stream')
    const fileName =
      normalizeString(node?.fileName) ||
      (() => {
        const extension = resolveMimeExtension(contentType)
        const messageId = normalizeString(snapshot?.key?.id) || 'media'
        if (!extension) {
          return `whatsapp-${messageId}`
        }
        return `whatsapp-${messageId}.${extension}`
      })()

    return {
      buffer,
      contentType,
      fileName,
      messageType: type,
      size: Buffer.isBuffer(buffer) ? buffer.length : null,
    }
  }

  async backfillHistory() {
    if (typeof this.sock?.resyncAppState === 'function') {
      await this.sock.resyncAppState(ALL_WA_PATCH_NAMES, true).catch(() => undefined)
      await delay(1500)
    }

    const messages = [...this.historyMessages.values()]
    const hasKnownChats = this.knownChats.size > 0
    const authBootstrapCandidates = await this.collectBootstrapCandidatesFromAuthState()
    if (!messages.length && !hasKnownChats && authBootstrapCandidates.length === 0) {
      const emptyResult = {
        importedMessages: 0,
        importedConversations: 0,
        duplicateMessages: 0,
        skippedMessages: 0,
        authBootstrapCandidates: 0,
        bootstrappedFromAuth: 0,
      }
      this.lastBackfillResult = {
        ...emptyResult,
        completedAt: new Date().toISOString(),
      }
      return emptyResult
    }

    const result = await this.importHistoryMessages(messages, authBootstrapCandidates)
    this.lastBackfillResult = {
      ...result,
      completedAt: new Date().toISOString(),
    }
    return result
  }

  async startSocket() {
    await fs.mkdir(this.authDir, { recursive: true })
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir)
    const { version } = await fetchLatestBaileysVersion()
    const auth = {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, this.logger),
    }

    this.status.state = 'connecting'
    this.status.lastError = null
    this.historyMessages.clear()
    this.rehydrateChatCachesFromStore()

    const sock = makeWASocket({
      auth,
      version,
      printQRInTerminal: false,
      browser: Browsers.macOS('Desktop'),
      markOnlineOnConnect: false,
      syncFullHistory: true,
      cachedGroupMetadata: async (jid) => this.getCachedGroupMetadata(jid),
      getMessage: async (key) => this.resolveStoredMessageByKey(key),
      logger: this.logger,
    })

    this.sock = sock
    this.saveCreds = saveCreds

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (update) => {
      void this.handleConnectionUpdate(update)
    })
    sock.ev.on('chats.upsert', (event) => {
      this.handleChatsUpsert(event)
    })
    sock.ev.on('contacts.upsert', (event) => {
      this.handleContactsUpsert(event)
    })
    sock.ev.on('contacts.update', (event) => {
      this.handleContactsUpdate(event)
    })
    sock.ev.on('groups.update', (event) => {
      void this.handleGroupsUpdate(event)
    })
    sock.ev.on('group-participants.update', (event) => {
      void this.handleGroupParticipantsUpdate(event)
    })
    sock.ev.on('messaging-history.set', (event) => {
      void this.handleMessagingHistorySet(event)
    })
    sock.ev.on('messages.upsert', (event) => {
      void this.handleMessagesUpsert(event)
    })
    sock.ev.on('messages.update', (event) => {
      void this.handleMessagesUpdate(event)
    })
  }

  async handleConnectionUpdate(update) {
    const connection = normalizeString(update?.connection)

    if (update?.qr) {
      this.status.state = 'qr_ready'
      this.status.qrCodeDataUrl = await QRCode.toDataURL(update.qr, {
        margin: 1,
        width: 320,
      }).catch(() => null)
      this.status.qrCodeExpiresAt = new Date(Date.now() + 60_000).toISOString()
      this.status.lastError = null
    }

    if (connection === 'open') {
      this.reconnectAttempts = 0
      this.status.state = 'connected'
      this.status.qrCodeDataUrl = null
      this.status.qrCodeExpiresAt = null
      this.status.connectedAt = new Date().toISOString()
      this.status.lastError = null
      this.status.reconnectScheduledAt = null
      const connectedPhone = normalizeString(
        this.sock?.user?.id ? toPhoneDigits(this.sock.user.id) : null,
      )
      if (connectedPhone) {
        this.status.connectedPhone = connectedPhone
      }
      if (typeof this.sock?.resyncAppState === 'function') {
        this.sock.resyncAppState(ALL_WA_PATCH_NAMES, true).catch(() => undefined)
      }
      if (this.runtimeConfig.presenceIndicatorEnabled && this.sock) {
        await this.sock.sendPresenceUpdate('unavailable').catch(() => undefined)
      }
      return
    }

    if (connection === 'close') {
      const disconnectCode =
        update?.lastDisconnect?.error?.output?.statusCode ||
        update?.lastDisconnect?.error?.data?.statusCode ||
        null

      this.sock = null
      this.status.lastDisconnectAt = new Date().toISOString()
      this.status.qrCodeDataUrl = null
      this.status.qrCodeExpiresAt = null
      this.status.state = 'disconnected'
      this.status.lastError =
        update?.lastDisconnect?.error?.message || 'whatsapp_qr_disconnected'

      if (
        !this.manualStop &&
        this.runtimeConfig.enabled &&
        disconnectCode !== DisconnectReason.loggedOut
      ) {
        this.scheduleReconnect()
      }
    }
  }

  async handleMessagesUpsert(event) {
    const messages = Array.isArray(event?.messages) ? event.messages : []
    for (const message of messages) {
      try {
        const historyKey = buildHistoryMessageKey(message)
        this.historyMessages.set(historyKey, message)
        this.storeMessage(message, {
          source: 'messages.upsert',
        })

        if (!message?.message || message?.key?.fromMe) {
          continue
        }

        const remoteJid = normalizeString(message?.key?.remoteJid)
        const externalUserId = toPhoneDigits(remoteJid)
        const text = extractPlainText(message)
        const attachments = extractAttachments(message)
        const projection = await this.ingestLiveInboundMessage(message)

        if (this.runtimeConfig.readReceiptsEnabled && this.sock?.readMessages) {
          await this.sock.readMessages([message.key]).catch(() => undefined)
        }

        if (
          projection?.controlMode === 'human' ||
          !projection?.conversationId ||
          !externalUserId
        ) {
          continue
        }

        const aiResult = await this.clients.ai.respond({
          channel: 'whatsapp',
          tenantKey: this.runtimeConfig.tenantKey,
          conversationId: projection.conversationId,
          userId: externalUserId,
          scope: 'customer_public',
          authLevel: 'anonymous',
          authenticated: false,
          authorKind: 'customer_human',
          messageKind: text ? 'human_message' : 'attachment_only',
          text,
          attachments,
          locale: projection?.preferences?.locale || undefined,
          currency: projection?.preferences?.currency || undefined,
          metadata: {
            transport: 'whatsapp_qr',
            remoteJid: remoteJid ? jidNormalizedUser(remoteJid) : null,
            providerMessageId: message?.key?.id || null,
            locale: projection?.preferences?.locale || null,
            currency: projection?.preferences?.currency || null,
          },
        })

        const responseText =
          aiResult?.response?.finalUserText?.trim() ||
          aiResult?.response?.text?.trim()

        if (!responseText) {
          continue
        }

        await this.clients.conversations.replyAsAgent(projection.conversationId, {
          body: responseText,
          finalUserText: responseText,
          debugSummary: aiResult?.response?.debugSummary ?? null,
          auditPayload: aiResult?.response?.auditPayload ?? null,
          metadata: {
            provider: aiResult?.response?.provider || 'mock',
            model: aiResult?.response?.model || null,
            channel: 'whatsapp',
            deliveryStatus: 'pending_external',
            transport: 'whatsapp_qr',
            aiMemory: aiResult?.response?.memory || null,
          },
          toolCalls: aiResult?.response?.toolCalls ?? [],
        })
      } catch (error) {
        this.status.lastError =
          error instanceof Error ? error.message : 'whatsapp_qr_ingest_failed'
      }
    }
  }

  async handleMessagingHistorySet(event) {
    const chats = Array.isArray(event?.chats) ? event.chats : []
    this.captureChats(chats)

    const messages = Array.isArray(event?.messages) ? event.messages : []
    for (const message of messages) {
      const key = buildHistoryMessageKey(message)
      this.historyMessages.set(key, message)
      this.storeMessage(message, {
        source: 'messaging-history.set',
      })
    }

    if (!messages.length) {
      return
    }

    try {
      await this.importHistoryMessages(messages)
    } catch (error) {
      this.status.lastError =
        error instanceof Error ? error.message : 'whatsapp_qr_history_import_failed'
    }
  }

  handleChatsUpsert(chats) {
    const list = Array.isArray(chats) ? chats : []
    this.captureChats(list)
  }

  async ingestLiveInboundMessage(message) {
    const remoteJid = normalizeString(message?.key?.remoteJid)
    if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us')) {
      return null
    }

    const externalUserId = toPhoneDigits(remoteJid)
    if (!externalUserId) {
      return null
    }

    const text = extractPlainText(message)
    const attachments = extractAttachments(message)
    if (!text && attachments.length === 0) {
      return null
    }

    return this.clients.conversations.ingestInboundMessage({
      tenantKey: this.runtimeConfig.tenantKey,
      channel: 'whatsapp',
      inboxAccountId: this.runtimeConfig.inboxAccountId || undefined,
      inboxAddress: this.runtimeConfig.address || undefined,
      threadId: jidNormalizedUser(remoteJid),
      externalMessageId: message?.key?.id || undefined,
      userId: externalUserId,
      displayName: message?.pushName || undefined,
      text: text || undefined,
      authorKind: 'customer_human',
      messageKind: text ? 'human_message' : 'attachment_only',
      attachments,
      metadata: {
        transport: 'whatsapp_qr',
        remoteJid: jidNormalizedUser(remoteJid),
        providerMessageId: message?.key?.id || null,
        messageTimestamp: message?.messageTimestamp || null,
        pushName: message?.pushName || null,
        whatsapp: buildWhatsappMessageMetadata(message),
      },
    })
  }

  async importHistoryMessages(messages, authBootstrapCandidates = null) {
    const chronologicalMessages = [...messages].sort((left, right) => {
      const leftTimestamp =
        toDateFromWhatsAppTimestamp(left?.messageTimestamp)?.getTime() || 0
      const rightTimestamp =
        toDateFromWhatsAppTimestamp(right?.messageTimestamp)?.getTime() || 0
      return leftTimestamp - rightTimestamp
    })

    const conversationIds = new Set()
    let importedMessages = 0
    let duplicateMessages = 0
    let skippedMessages = 0

    for (const message of chronologicalMessages) {
      const remoteJid = normalizeString(message?.key?.remoteJid)
      if (!remoteJid || remoteJid === 'status@broadcast' || remoteJid.endsWith('@g.us')) {
        skippedMessages += 1
        continue
      }

      const externalUserId = toPhoneDigits(remoteJid)
      if (!externalUserId) {
        skippedMessages += 1
        continue
      }

      const text = extractPlainText(message)
      const attachments = extractAttachments(message)
      if (!text && attachments.length === 0) {
        skippedMessages += 1
        continue
      }

      const imported = await this.clients.conversations.importChannelHistoryMessage({
        tenantKey: this.runtimeConfig.tenantKey,
        channel: 'whatsapp',
        inboxAccountId: this.runtimeConfig.inboxAccountId || undefined,
        inboxAddress: this.runtimeConfig.address || undefined,
        threadId: jidNormalizedUser(remoteJid),
        externalMessageId: normalizeString(message?.key?.id) || undefined,
        userId: externalUserId,
        displayName:
          normalizeString(message?.pushName) ||
          this.historyChatNames.get(jidNormalizedUser(remoteJid)) ||
          undefined,
        text: text || undefined,
        authorKind: message?.key?.fromMe ? 'operator_human' : 'customer_human',
        messageKind: text ? 'human_message' : 'attachment_only',
        direction: message?.key?.fromMe ? 'outbound' : 'inbound',
        occurredAt:
          toDateFromWhatsAppTimestamp(message?.messageTimestamp)?.toISOString() ||
          undefined,
        attachments,
        metadata: {
          transport: 'whatsapp_qr',
          remoteJid: jidNormalizedUser(remoteJid),
          providerMessageId: normalizeString(message?.key?.id) || null,
          messageTimestamp: message?.messageTimestamp || null,
          pushName: message?.pushName || null,
          historyImport: true,
          historySource: 'messaging-history.set',
          whatsapp: buildWhatsappMessageMetadata(message, {
            historyImport: true,
          }),
        },
      })

      if (imported?.conversationId) {
        conversationIds.add(imported.conversationId)
      }

      if (imported?.duplicate) {
        duplicateMessages += 1
      } else {
        importedMessages += 1
      }
    }

    const bootstrappedConversations = await this.bootstrapKnownChats()
    const authCandidates =
      Array.isArray(authBootstrapCandidates)
        ? authBootstrapCandidates
        : await this.collectBootstrapCandidatesFromAuthState()
    const bootstrappedFromAuth = await this.bootstrapAuthStateCandidates(authCandidates)

    return {
      importedMessages,
      importedConversations:
        conversationIds.size + bootstrappedConversations + bootstrappedFromAuth,
      duplicateMessages,
      skippedMessages,
      authBootstrapCandidates: authCandidates.length,
      bootstrappedFromAuth,
    }
  }

  captureChats(chats) {
    for (const chat of chats) {
      const jid = normalizeString(chat?.id)
      if (!jid || jid === 'status@broadcast') {
        continue
      }

      const normalizedJid = jidNormalizedUser(jid)
      this.storeChat({
        id: normalizedJid,
        name: normalizeString(chat?.name) || null,
      })

      if (normalizedJid.endsWith('@g.us')) {
        continue
      }

      const userId = toPhoneDigits(jid)
      if (!userId) {
        continue
      }

      const displayName = normalizeString(chat?.name)
      if (displayName) {
        this.historyChatNames.set(normalizedJid, displayName)
      }

      this.knownChats.set(normalizedJid, {
        threadId: normalizedJid,
        userId,
        displayName: displayName || this.historyChatNames.get(normalizedJid) || null,
      })
    }
  }

  async bootstrapKnownChats() {
    let createdConversations = 0

    for (const chat of this.knownChats.values()) {
      const result = await this.clients.conversations.bootstrapChannelThread({
        tenantKey: this.runtimeConfig.tenantKey,
        channel: 'whatsapp',
        inboxAccountId: this.runtimeConfig.inboxAccountId || undefined,
        inboxAddress: this.runtimeConfig.address || undefined,
        threadId: chat.threadId,
        userId: chat.userId,
        displayName: chat.displayName || undefined,
        metadata: {
          transport: 'whatsapp_qr',
          bootstrapOnly: true,
        },
      })

      if (result?.createdConversation) {
        createdConversations += 1
      }
    }

    return createdConversations
  }

  async bootstrapAuthStateCandidates(candidates) {
    let createdConversations = 0

    for (const candidate of candidates) {
      const result = await this.clients.conversations.bootstrapChannelThread({
        tenantKey: this.runtimeConfig.tenantKey,
        channel: 'whatsapp',
        inboxAccountId: this.runtimeConfig.inboxAccountId || undefined,
        inboxAddress: this.runtimeConfig.address || undefined,
        threadId: candidate.threadId,
        userId: candidate.userId,
        displayName: candidate.displayName || undefined,
        metadata: {
          transport: 'whatsapp_qr',
          bootstrapOnly: true,
          bootstrapSource: 'auth_state',
        },
      })

      if (result?.createdConversation) {
        createdConversations += 1
      }
    }

    return createdConversations
  }

  async collectBootstrapCandidatesFromAuthState() {
    let entries = []
    try {
      entries = await fs.readdir(this.authDir)
    } catch {
      return []
    }

    const phoneToLid = new Map()
    const lidToPhone = new Map()
    const candidateDigits = new Set()

    for (const entry of entries) {
      let match = entry.match(/^lid-mapping-(\d+)\.json$/)
      if (match) {
        const phoneDigits = normalizeDigits(match[1])
        const lidDigits = normalizeDigits(await this.readJsonStringFile(path.join(this.authDir, entry)))
        if (phoneDigits && lidDigits) {
          phoneToLid.set(phoneDigits, lidDigits)
          lidToPhone.set(lidDigits, phoneDigits)
        }
        continue
      }

      match = entry.match(/^lid-mapping-(\d+)_reverse\.json$/)
      if (match) {
        const lidDigits = normalizeDigits(match[1])
        const phoneDigits = normalizeDigits(await this.readJsonStringFile(path.join(this.authDir, entry)))
        if (phoneDigits && lidDigits) {
          lidToPhone.set(lidDigits, phoneDigits)
          phoneToLid.set(phoneDigits, lidDigits)
        }
        continue
      }

      match = entry.match(/^session-(\d+)_/)
      if (match) {
        const digits = normalizeDigits(match[1])
        if (digits) {
          candidateDigits.add(digits)
        }
        continue
      }

      match = entry.match(/^device-list-(\d+)\.json$/)
      if (match) {
        const digits = normalizeDigits(match[1])
        if (digits) {
          candidateDigits.add(digits)
        }
      }
    }

    const ownPhoneDigits =
      normalizeDigits(this.status.connectedPhone) ||
      normalizeDigits(this.runtimeConfig.address) ||
      normalizeDigits(this.sock?.user?.id) ||
      null
    const ownLidDigits =
      (ownPhoneDigits ? phoneToLid.get(ownPhoneDigits) : null) || null
    const candidates = []
    const seenThreadIds = new Set()

    for (const digits of candidateDigits) {
      if (isOwnDigits(digits, ownPhoneDigits) || isOwnDigits(digits, ownLidDigits)) {
        continue
      }

      const mappedPhone = lidToPhone.get(digits) || null
      const mappedLid = phoneToLid.get(digits) || null
      const threadDigits = mappedLid || digits
      const userId = mappedPhone || digits
      const threadId = `${threadDigits}@lid`

      if (
        isOwnDigits(threadDigits, ownLidDigits) ||
        isOwnDigits(userId, ownPhoneDigits) ||
        seenThreadIds.has(threadId) ||
        this.knownChats.has(threadId)
      ) {
        continue
      }

      seenThreadIds.add(threadId)
      candidates.push({
        threadId,
        userId,
        displayName: this.historyChatNames.get(threadId) || null,
      })
    }

    return candidates.sort((left, right) => left.threadId.localeCompare(right.threadId))
  }

  async readJsonStringFile(filePath) {
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw)
      return typeof parsed === 'string' ? parsed : null
    } catch {
      return null
    }
  }

  async loadPersistedStore() {
    try {
      const raw = await fs.readFile(this.storePath, 'utf8')
      const parsed = JSON.parse(raw, BufferJSON.reviver)
      if (!parsed || typeof parsed !== 'object') {
        return
      }

      const messages = Array.isArray(parsed.messages) ? parsed.messages : []
      for (const [key, entry] of messages) {
        if (!key || !entry || typeof entry !== 'object') {
          continue
        }
        if (entry.message) {
          this.persistedMessages.set(key, entry)
        }
      }

      const chats = Array.isArray(parsed.chats) ? parsed.chats : []
      for (const [key, entry] of chats) {
        if (!key || !entry || typeof entry !== 'object') {
          continue
        }
        this.persistedChats.set(key, entry)
        if (normalizeString(entry.displayName)) {
          this.historyChatNames.set(key, entry.displayName)
        }
        if (normalizeString(entry.threadId) && normalizeString(entry.userId)) {
          this.knownChats.set(entry.threadId, {
            threadId: entry.threadId,
            userId: entry.userId,
            displayName: normalizeString(entry.displayName) || null,
          })
        }
      }

      const contacts = Array.isArray(parsed.contacts) ? parsed.contacts : []
      for (const [key, entry] of contacts) {
        if (!key || !entry || typeof entry !== 'object') {
          continue
        }
        this.persistedContacts.set(key, entry)
      }

      const groupMetadata = Array.isArray(parsed.groupMetadata) ? parsed.groupMetadata : []
      for (const [key, entry] of groupMetadata) {
        if (!key || !entry || typeof entry !== 'object') {
          continue
        }
        this.groupMetadataCache.set(key, {
          metadata: cloneWithBufferJson(entry.metadata),
          cachedAt:
            Number.isFinite(Number(entry.cachedAt)) && Number(entry.cachedAt) > 0
              ? Number(entry.cachedAt)
              : Date.now(),
        })
      }

      const pollVoteAggregates = Array.isArray(parsed.pollVoteAggregates)
        ? parsed.pollVoteAggregates
        : []
      for (const [key, entry] of pollVoteAggregates) {
        if (!key || !entry || typeof entry !== 'object') {
          continue
        }
        this.pollVoteAggregates.set(key, entry)
      }

      this.prunePersistedMessages()
      this.rehydrateChatCachesFromStore()
    } catch {}
  }

  buildPersistedStoreSnapshot() {
    return {
      version: STORE_VERSION,
      savedAt: new Date().toISOString(),
      messages: [...this.persistedMessages.entries()],
      chats: [...this.persistedChats.entries()],
      contacts: [...this.persistedContacts.entries()],
      groupMetadata: [...this.groupMetadataCache.entries()],
      pollVoteAggregates: [...this.pollVoteAggregates.entries()],
    }
  }

  rehydrateChatCachesFromStore() {
    this.historyChatNames.clear()
    this.knownChats.clear()

    for (const [jid, chat] of this.persistedChats.entries()) {
      if (normalizeString(chat?.displayName)) {
        this.historyChatNames.set(jid, chat.displayName)
      }
      if (normalizeString(chat?.threadId) && normalizeString(chat?.userId) && !chat?.isGroup) {
        this.knownChats.set(chat.threadId, {
          threadId: chat.threadId,
          userId: chat.userId,
          displayName: normalizeString(chat?.displayName) || null,
        })
      }
    }

    for (const [jid, contact] of this.persistedContacts.entries()) {
      if (normalizeString(contact?.displayName) && !this.historyChatNames.has(jid)) {
        this.historyChatNames.set(jid, contact.displayName)
      }
    }
  }

  scheduleStorePersist() {
    if (this.storePersistTimer) {
      clearTimeout(this.storePersistTimer)
    }

    this.storePersistTimer = setTimeout(() => {
      this.storePersistTimer = null
      void this.persistStore()
    }, 250)
    this.storePersistTimer.unref?.()
  }

  async persistStore() {
    await fs.mkdir(this.runtimeDir, { recursive: true })
    const snapshot = this.buildPersistedStoreSnapshot()
    await fs.writeFile(
      this.storePath,
      JSON.stringify(snapshot, BufferJSON.replacer, 2),
      'utf8',
    )
  }

  prunePersistedMessages() {
    while (this.persistedMessages.size > MAX_PERSISTED_MESSAGES) {
      const oldestKey = this.persistedMessages.keys().next().value
      if (!oldestKey) {
        break
      }
      this.persistedMessages.delete(oldestKey)
      this.pollVoteAggregates.delete(oldestKey)
    }
  }

  storeMessage(message, options = {}) {
    const persistedKey = buildPersistedMessageKey(message?.key)
    if (!persistedKey) {
      return null
    }

    const existing = this.persistedMessages.get(persistedKey) || {}
    const clonedMessage = cloneWithBufferJson({
      key: message?.key || existing.message?.key || null,
      message: normalizeMessageContent(message?.message) || existing.message?.message || null,
      messageTimestamp: message?.messageTimestamp ?? existing.message?.messageTimestamp ?? null,
      pushName: message?.pushName ?? existing.message?.pushName ?? null,
      participant: message?.participant ?? existing.message?.participant ?? null,
      status: message?.status ?? existing.message?.status ?? null,
    })

    const entry = {
      ...existing,
      message: clonedMessage,
      remoteJid:
        normalizeString(message?.key?.remoteJid) ||
        normalizeString(existing.remoteJid) ||
        null,
      fromMe: message?.key?.fromMe === true || existing.fromMe === true,
      storedAt: Date.now(),
      source: normalizeString(options.source) || normalizeString(existing.source) || null,
    }

    this.persistedMessages.set(persistedKey, entry)
    this.prunePersistedMessages()
    this.scheduleStorePersist()
    return persistedKey
  }

  resolveStoredMessageByKey(key) {
    const persistedKey = buildPersistedMessageKey(key)
    if (!persistedKey) {
      return null
    }

    const entry = this.persistedMessages.get(persistedKey)
    return cloneWithBufferJson(entry?.message) || null
  }

  storeChat(chat) {
    const jid = normalizeString(chat?.id)
    if (!jid || jid === 'status@broadcast') {
      return
    }

    const normalizedJid = jidNormalizedUser(jid)
    const displayName = normalizeString(chat?.name) || null
    const entry = {
      threadId: normalizedJid,
      userId: normalizeDigits(jid),
      displayName,
      isGroup: normalizedJid.endsWith('@g.us'),
      updatedAt: Date.now(),
    }

    this.persistedChats.set(normalizedJid, entry)
    if (displayName) {
      this.historyChatNames.set(normalizedJid, displayName)
    }
    this.scheduleStorePersist()
  }

  storeContact(contact) {
    const jid = normalizeString(contact?.id)
    if (!jid) {
      return
    }

    const normalizedJid = jidNormalizedUser(jid)
    const displayName =
      normalizeString(contact?.notify) ||
      normalizeString(contact?.name) ||
      normalizeString(contact?.verifiedName) ||
      null

    this.persistedContacts.set(normalizedJid, {
      id: normalizedJid,
      displayName,
      updatedAt: Date.now(),
    })

    if (displayName) {
      this.historyChatNames.set(normalizedJid, displayName)
    }
    this.scheduleStorePersist()
  }

  getCachedGroupMetadata(jid) {
    const normalizedJid = normalizeString(jid)
    if (!normalizedJid) {
      return null
    }

    const cached = this.groupMetadataCache.get(normalizedJid)
    if (!cached) {
      return null
    }

    if (Date.now() - cached.cachedAt > GROUP_METADATA_TTL_MS) {
      this.groupMetadataCache.delete(normalizedJid)
      this.scheduleStorePersist()
      return null
    }

    return cloneWithBufferJson(cached.metadata)
  }

  async refreshGroupMetadata(jid) {
    const normalizedJid = normalizeString(jid)
    if (!normalizedJid || !this.sock?.groupMetadata) {
      return null
    }

    try {
      const metadata = await this.sock.groupMetadata(normalizedJid)
      this.groupMetadataCache.set(normalizedJid, {
        metadata: cloneWithBufferJson(metadata),
        cachedAt: Date.now(),
      })
      this.scheduleStorePersist()
      return metadata
    } catch {
      return this.getCachedGroupMetadata(normalizedJid)
    }
  }

  async handleGroupsUpdate(events) {
    const list = Array.isArray(events) ? events : []
    for (const event of list) {
      const jid = normalizeString(event?.id)
      if (!jid) {
        continue
      }
      await this.refreshGroupMetadata(jid)
    }
  }

  async handleGroupParticipantsUpdate(event) {
    const jid = normalizeString(event?.id)
    if (!jid) {
      return
    }
    await this.refreshGroupMetadata(jid)
  }

  handleContactsUpsert(contacts) {
    const list = Array.isArray(contacts) ? contacts : []
    for (const contact of list) {
      this.storeContact(contact)
    }
  }

  handleContactsUpdate(contacts) {
    const list = Array.isArray(contacts) ? contacts : []
    for (const contact of list) {
      this.storeContact(contact)
    }
  }

  async handleMessagesUpdate(events) {
    const list = Array.isArray(events) ? events : []
    for (const event of list) {
      const key = event?.key
      const update = event?.update
      if (!key || !update || typeof update !== 'object') {
        continue
      }

      const storedMessage = this.resolveStoredMessageByKey(key)
      if (!storedMessage) {
        continue
      }

      const mergedMessage = {
        ...storedMessage,
        key: storedMessage.key || key,
        status: update.status ?? storedMessage.status ?? null,
      }

      if (update.message) {
        mergedMessage.message = normalizeMessageContent(update.message) || storedMessage.message
      }
      if (update.messageTimestamp != null) {
        mergedMessage.messageTimestamp = update.messageTimestamp
      }
      if (update.pushName != null) {
        mergedMessage.pushName = update.pushName
      }
      if (update.participant != null) {
        mergedMessage.participant = update.participant
      }

      this.storeMessage(mergedMessage, {
        source: 'messages.update',
      })

      if (Array.isArray(update.pollUpdates) && update.pollUpdates.length > 0) {
        try {
          const aggregatedVotes = getAggregateVotesInPollMessage({
            message: storedMessage,
            pollUpdates: update.pollUpdates,
          })
          const persistedKey = buildPersistedMessageKey(key)
          if (persistedKey) {
            this.pollVoteAggregates.set(persistedKey, {
              aggregatedVotes: cloneWithBufferJson(aggregatedVotes),
              updatedAt: Date.now(),
            })
            this.scheduleStorePersist()
          }
        } catch {}
      }
    }
  }

  calculateReplyDelay(text) {
    if (!this.runtimeConfig.humanDelayEnabled) {
      return 0
    }
    const base = this.runtimeConfig.minReplyDelayMs
    const max = this.runtimeConfig.maxReplyDelayMs
    const perChar = Math.min(text.length * 25, max - base)
    return Math.min(base + perChar, max)
  }

  recordOutbound() {
    const now = Date.now()
    this.outboundLog.push(now)
    this.refreshOutboundCounters()
  }

  refreshOutboundCounters() {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    this.outboundLog = this.outboundLog.filter((timestamp) => timestamp >= oneDayAgo)
    this.status.outboundCounters = {
      lastHour: this.outboundLog.filter((timestamp) => timestamp >= oneHourAgo).length,
      lastDay: this.outboundLog.length,
    }
  }

  assertOutboundLimits() {
    this.refreshOutboundCounters()
    if (this.status.outboundCounters.lastHour >= this.runtimeConfig.maxOutboundPerHour) {
      throw new Error('whatsapp_qr_hourly_limit_reached')
    }
    if (this.status.outboundCounters.lastDay >= this.runtimeConfig.maxOutboundPerDay) {
      throw new Error('whatsapp_qr_daily_limit_reached')
    }
  }

  isWithinQuietHours() {
    const start = this.runtimeConfig.quietHoursStart
    const end = this.runtimeConfig.quietHoursEnd
    if (!start || !end) {
      return false
    }
    const now = new Date()
    const current = now.getHours() * 60 + now.getMinutes()
    const [startHour, startMinute] = start.split(':').map(Number)
    const [endHour, endMinute] = end.split(':').map(Number)
    const startTotal = startHour * 60 + startMinute
    const endTotal = endHour * 60 + endMinute
    if (startTotal === endTotal) {
      return false
    }
    if (startTotal < endTotal) {
      return current >= startTotal && current < endTotal
    }
    return current >= startTotal || current < endTotal
  }

  scheduleReconnect() {
    this.clearReconnectTimer()
    this.reconnectAttempts += 1
    const delayMs = Math.min(60_000, this.reconnectAttempts * 5000)
    this.status.state = 'reconnecting'
    this.status.reconnectScheduledAt = new Date(Date.now() + delayMs).toISOString()
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.startSession()
    }, delayMs)
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  async loadPersistedConfig() {
    try {
      const raw = await fs.readFile(this.configPath, 'utf8')
      const parsed = JSON.parse(raw)
      this.runtimeConfig = {
        ...this.runtimeConfig,
        ...parsed,
      }
      this.status.enabled = this.runtimeConfig.enabled
    } catch {}
  }

  async persistConfig() {
    await fs.mkdir(this.runtimeDir, { recursive: true })
    await fs.writeFile(this.configPath, JSON.stringify(this.runtimeConfig, null, 2))
  }
}

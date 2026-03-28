import fs from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  getContentType,
  jidNormalizedUser,
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

const extractPlainText = (message) => {
  const content = normalizeMessageContent(message?.message)
  if (!content) {
    return ''
  }

  const type = getContentType(content)
  const node = type ? content?.[type] : null

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
  const content = normalizeMessageContent(message?.message)
  if (!content) {
    return []
  }

  const type = getContentType(content)
  const node = type ? content?.[type] : null

  switch (type) {
    case 'imageMessage':
      return [
        {
          assetType: 'image',
          fileName: null,
          contentType: 'image/jpeg',
          content: null,
          metadata: {
            transport: 'whatsapp_qr',
            messageType: 'image',
            mimetype: node?.mimetype || null,
            mediaKeyTimestamp: node?.mediaKeyTimestamp || null,
          },
        },
      ]
    case 'videoMessage':
      return [
        {
          assetType: 'video',
          fileName: null,
          contentType: node?.mimetype || 'video/mp4',
          content: null,
          metadata: {
            transport: 'whatsapp_qr',
            messageType: 'video',
            seconds: node?.seconds || null,
          },
        },
      ]
    case 'documentMessage':
      return [
        {
          assetType: 'document',
          fileName: node?.fileName || null,
          contentType: node?.mimetype || null,
          content: null,
          metadata: {
            transport: 'whatsapp_qr',
            messageType: 'document',
            pageCount: node?.pageCount || null,
          },
        },
      ]
    case 'audioMessage':
      return [
        {
          assetType: 'audio',
          fileName: null,
          contentType: node?.mimetype || 'audio/ogg',
          content: null,
          metadata: {
            transport: 'whatsapp_qr',
            messageType: 'audio',
            seconds: node?.seconds || null,
            ptt: node?.ptt === true,
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
    this.runtimeConfig = { ...DEFAULT_CONFIG, tenantKey: config.clientSlug || 'urucortinas' }
    this.status = DEFAULT_STATUS()
    this.sock = null
    this.saveCreds = null
    this.reconnectTimer = null
    this.reconnectAttempts = 0
    this.manualStop = false
    this.outboundLog = []
    this.runtimeDir = path.resolve(
      config.whatsappRuntimeDir || path.join(process.cwd(), 'runtime', 'whatsapp-qr'),
    )
    this.authDir = path.join(this.runtimeDir, 'auth')
    this.configPath = path.join(this.runtimeDir, 'config.json')
  }

  async init() {
    await fs.mkdir(this.authDir, { recursive: true })
    await this.loadPersistedConfig()
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
    const recipientId = normalizeString(payload?.recipientId)
    if (!text) {
      throw new Error('text is required for whatsapp qr outbound messages')
    }
    if (!recipientId) {
      throw new Error('recipientId is required for whatsapp qr outbound messages')
    }
    if (!this.sock) {
      throw new Error('whatsapp_qr_not_connected')
    }

    const source = normalizeString(payload?.metadata?.source)
    if (!this.runtimeConfig.allowProactiveOutbound && source === 'ai-agent-service') {
      if (this.isWithinQuietHours()) {
        throw new Error('whatsapp_qr_quiet_hours')
      }
    }

    this.assertOutboundLimits()

    const jid = toWhatsAppJid(recipientId)
    if (!jid) {
      throw new Error('invalid_whatsapp_recipient')
    }

    const typingDelayMs = this.calculateReplyDelay(text)

    if (this.runtimeConfig.presenceIndicatorEnabled) {
      await this.sock.sendPresenceUpdate('available', jid).catch(() => undefined)
    }

    if (this.runtimeConfig.typingIndicatorEnabled) {
      await this.sock.sendPresenceUpdate('composing', jid).catch(() => undefined)
    }

    if (typingDelayMs > 0) {
      await delay(typingDelayMs)
    }

    const result = await this.sock.sendMessage(jid, { text })

    if (this.runtimeConfig.typingIndicatorEnabled) {
      await this.sock.sendPresenceUpdate('paused', jid).catch(() => undefined)
    }

    this.recordOutbound()

    return {
      provider: 'whatsapp-qr',
      remoteId: result?.key?.id || `waqr:${Date.now()}`,
      providerMessageId: result?.key?.id || `waqr:${Date.now()}`,
      threadRemoteId: jidNormalizedUser(jid),
      deliveryStatus: 'accepted',
      metadata: {
        transport: 'whatsapp_qr',
        jid,
        typingDelayMs,
      },
    }
  }

  async startSocket() {
    await fs.mkdir(this.authDir, { recursive: true })
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir)
    const { version } = await fetchLatestBaileysVersion()

    this.status.state = 'connecting'
    this.status.lastError = null

    const sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      browser: Browsers.macOS(this.runtimeConfig.displayName || 'Dashboard'),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      logger: pino({ level: 'silent' }),
    })

    this.sock = sock
    this.saveCreds = saveCreds

    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (update) => {
      void this.handleConnectionUpdate(update)
    })
    sock.ev.on('messages.upsert', (event) => {
      void this.handleMessagesUpsert(event)
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
      if (!message?.message || message?.key?.fromMe) {
        continue
      }

      const remoteJid = normalizeString(message?.key?.remoteJid)
      if (!remoteJid || remoteJid === 'status@broadcast') {
        continue
      }

      const externalUserId = toPhoneDigits(remoteJid)
      if (!externalUserId) {
        continue
      }

      const text = extractPlainText(message)
      const attachments = extractAttachments(message)

      const projection = await this.clients.conversations.ingestInboundMessage({
        tenantKey: this.runtimeConfig.tenantKey,
        channel: 'whatsapp',
        inboxAccountId: this.runtimeConfig.inboxAccountId || undefined,
        inboxAddress: this.runtimeConfig.address || undefined,
        threadId: jidNormalizedUser(remoteJid),
        externalMessageId: message?.key?.id || undefined,
        userId: externalUserId,
        displayName: message?.pushName || undefined,
        text,
        authorKind: 'customer_human',
        messageKind: text ? 'human_message' : 'attachment_only',
        attachments,
        metadata: {
          transport: 'whatsapp_qr',
          remoteJid: jidNormalizedUser(remoteJid),
          providerMessageId: message?.key?.id || null,
          messageTimestamp: message?.messageTimestamp || null,
          pushName: message?.pushName || null,
        },
      })

      if (this.runtimeConfig.readReceiptsEnabled && this.sock?.readMessages) {
        await this.sock.readMessages([message.key]).catch(() => undefined)
      }

      if (projection?.controlMode === 'human') {
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
        metadata: {
          transport: 'whatsapp_qr',
          remoteJid: jidNormalizedUser(remoteJid),
          providerMessageId: message?.key?.id || null,
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

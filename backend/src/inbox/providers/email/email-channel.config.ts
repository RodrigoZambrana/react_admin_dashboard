import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  EmailChannelConfig,
  EmailChannelSecurityOption,
} from './email-channel.types'

type BuildEmailConfigOptions = {
  logger?: Logger
}

const parseNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const buildEmailChannelConfig = (
  configService: ConfigService,
  options: BuildEmailConfigOptions = {},
): EmailChannelConfig => {
  const logger = options.logger
  const missing: string[] = []

  const imapHost = configService.get<string>('INBOX_EMAIL_IMAP_HOST')
  const imapPort = parseNumber(configService.get('INBOX_EMAIL_IMAP_PORT'), 993)
  const imapSecurity =
    configService.get<EmailChannelSecurityOption>('INBOX_EMAIL_IMAP_SECURITY') ||
    'SSL_TLS'

  const smtpHost = configService.get<string>('INBOX_EMAIL_SMTP_HOST')
  const smtpPort = parseNumber(configService.get('INBOX_EMAIL_SMTP_PORT'), 587)
  const smtpSecurity =
    configService.get<EmailChannelSecurityOption>('INBOX_EMAIL_SMTP_SECURITY') ||
    'STARTTLS'

  const username = configService.get<string>('INBOX_EMAIL_USER')
  const password = configService.get<string>('INBOX_EMAIL_PASSWORD')
  const fromAddress =
    configService.get<string>('INBOX_EMAIL_DEFAULT_FROM') || username || ''
  const fromName =
    configService.get<string>('INBOX_EMAIL_DEFAULT_NAME') || undefined

  if (!imapHost) {
    missing.push('INBOX_EMAIL_IMAP_HOST')
  }
  if (!configService.get('INBOX_EMAIL_IMAP_PORT')) {
    missing.push('INBOX_EMAIL_IMAP_PORT')
  }
  if (!smtpHost) {
    missing.push('INBOX_EMAIL_SMTP_HOST')
  }
  if (!configService.get('INBOX_EMAIL_SMTP_PORT')) {
    missing.push('INBOX_EMAIL_SMTP_PORT')
  }
  if (!username) {
    missing.push('INBOX_EMAIL_USER')
  }
  if (!password) {
    missing.push('INBOX_EMAIL_PASSWORD')
  }
  if (!fromAddress) {
    missing.push('INBOX_EMAIL_DEFAULT_FROM')
  }

  if (missing.length > 0 && logger) {
    logger.warn(`Email channel adapter missing configuration: ${missing.join(', ')}`)
  }

  const maxAttachmentSizeMb = parseNumber(
    configService.get('INBOX_EMAIL_MAX_ATTACHMENT_MB'),
    25,
  )
  const outgoingRatePerMinute = parseNumber(
    configService.get('INBOX_EMAIL_RATE_PER_MINUTE'),
    60,
  )
  const pollingIntervalMs = parseNumber(
    configService.get('INBOX_EMAIL_POLL_INTERVAL_MS'),
    120000,
  )
  const pollingBatchSize = parseNumber(
    configService.get('INBOX_EMAIL_POLL_BATCH_SIZE'),
    50,
  )

  return {
    imap: {
      host: imapHost || '',
      port: imapPort,
      security: imapSecurity,
    },
    smtp: {
      host: smtpHost || '',
      port: smtpPort,
      security: smtpSecurity,
    },
    credentials: {
      user: username || '',
      password: password || '',
    },
    defaults: {
      fromAddress: fromAddress || '',
      fromName,
    },
    limits: {
      maxAttachmentSizeMb,
      outgoingRatePerMinute,
    },
    polling: {
      intervalMs: pollingIntervalMs,
      batchSize: pollingBatchSize,
    },
  }
}

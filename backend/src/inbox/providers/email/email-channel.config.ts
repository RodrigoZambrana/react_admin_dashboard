import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  EmailChannelConfig,
  EmailChannelSecurityOption,
} from './email-channel.types'
import type { StoredInboxEmailConfig } from './inbox-email-config.types'

type BuildEmailConfigOptions = {
  logger?: Logger
}

const parseNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const coerceString = (value: string | null | undefined): string => {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

const coerceOptionalString = (value: string | null | undefined): string | undefined => {
  const normalized = coerceString(value ?? undefined)
  return normalized.length > 0 ? normalized : undefined
}

const coerceNumber = (value: number | string | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return null
  }
  return parsed
}

const isValidSecurityOption = (value: string): value is EmailChannelSecurityOption => {
  return value === 'SSL_TLS' || value === 'STARTTLS' || value === 'NONE'
}

export const buildEmailChannelConfig = (
  configService: ConfigService,
  options: BuildEmailConfigOptions = {},
  overrides?: StoredInboxEmailConfig | null,
): EmailChannelConfig => {
  const logger = options.logger
  const missing: string[] = []

  const imapHost = coerceString(
    overrides?.imapHost ?? configService.get<string>('INBOX_EMAIL_IMAP_HOST'),
  )
  const imapPort = coerceNumber(overrides?.imapPort) ?? parseNumber(configService.get('INBOX_EMAIL_IMAP_PORT'), 993)
  const imapSecurity = (() => {
    const override = overrides?.imapSecurity
    if (override && isValidSecurityOption(override)) {
      return override
    }
    return configService.get<EmailChannelSecurityOption>('INBOX_EMAIL_IMAP_SECURITY') || 'SSL_TLS'
  })()

  const smtpHost = coerceString(
    overrides?.smtpHost ?? configService.get<string>('INBOX_EMAIL_SMTP_HOST'),
  )
  const smtpPort = coerceNumber(overrides?.smtpPort) ?? parseNumber(configService.get('INBOX_EMAIL_SMTP_PORT'), 587)
  const smtpSecurity = (() => {
    const override = overrides?.smtpSecurity
    if (override && isValidSecurityOption(override)) {
      return override
    }
    return configService.get<EmailChannelSecurityOption>('INBOX_EMAIL_SMTP_SECURITY') || 'STARTTLS'
  })()

  const username = coerceString(
    overrides?.username ?? configService.get<string>('INBOX_EMAIL_USER'),
  )
  const passwordSource =
    overrides?.password !== undefined
      ? overrides.password
      : configService.get<string>('INBOX_EMAIL_PASSWORD')
  const password = coerceString(passwordSource ?? undefined)
  const configuredFromAddress = coerceString(
    overrides?.fromAddress ?? configService.get<string>('INBOX_EMAIL_DEFAULT_FROM'),
  )
  const fromAddress = configuredFromAddress || username
  const fromName =
    overrides?.fromName !== undefined
      ? coerceOptionalString(overrides.fromName)
      : coerceOptionalString(configService.get<string>('INBOX_EMAIL_DEFAULT_NAME'))

  if (!imapHost) {
    missing.push('INBOX_EMAIL_IMAP_HOST')
  }
  if (!imapPort) {
    missing.push('INBOX_EMAIL_IMAP_PORT')
  }
  if (!smtpHost) {
    missing.push('INBOX_EMAIL_SMTP_HOST')
  }
  if (!smtpPort) {
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

  const maxAttachmentSizeMb =
    coerceNumber(overrides?.maxAttachmentSizeMb) ??
    parseNumber(configService.get('INBOX_EMAIL_MAX_ATTACHMENT_MB'), 25)
  const outgoingRatePerMinute =
    coerceNumber(overrides?.ratePerMinute) ??
    parseNumber(configService.get('INBOX_EMAIL_RATE_PER_MINUTE'), 60)
  const pollingIntervalMs =
    coerceNumber(overrides?.pollIntervalMs) ??
    parseNumber(configService.get('INBOX_EMAIL_POLL_INTERVAL_MS'), 120000)
  const pollingBatchSize =
    coerceNumber(overrides?.pollBatchSize) ??
    parseNumber(configService.get('INBOX_EMAIL_POLL_BATCH_SIZE'), 50)

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

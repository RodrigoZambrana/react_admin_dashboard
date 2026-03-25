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
  if (typeof value === 'string' && value.trim().length === 0) {
    return fallback
  }
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

const coercePositiveNumber = (value: number | string | null | undefined): number | null => {
  const parsed = coerceNumber(value)
  if (parsed === null) {
    return null
  }
  return parsed > 0 ? parsed : null
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
  const hasStoredConfig = Boolean(overrides)

  const imapHost = hasStoredConfig
    ? coerceString(overrides?.imapHost)
    : coerceString(configService.get<string>('INBOX_EMAIL_IMAP_HOST'))
  const imapPort = hasStoredConfig
    ? coercePositiveNumber(overrides?.imapPort) ?? 993
    : parseNumber(configService.get('INBOX_EMAIL_IMAP_PORT'), 993)
  const imapSecurity = (() => {
    const override = overrides?.imapSecurity
    if (override && isValidSecurityOption(override)) {
      return override
    }
    if (hasStoredConfig) {
      return 'SSL_TLS'
    }
    return configService.get<EmailChannelSecurityOption>('INBOX_EMAIL_IMAP_SECURITY') || 'SSL_TLS'
  })()

  const smtpHost = hasStoredConfig
    ? coerceString(overrides?.smtpHost)
    : coerceString(configService.get<string>('INBOX_EMAIL_SMTP_HOST'))
  const smtpPort = hasStoredConfig
    ? coercePositiveNumber(overrides?.smtpPort) ?? 587
    : parseNumber(configService.get('INBOX_EMAIL_SMTP_PORT'), 587)
  const smtpSecurity = (() => {
    const override = overrides?.smtpSecurity
    if (override && isValidSecurityOption(override)) {
      return override
    }
    if (hasStoredConfig) {
      return 'STARTTLS'
    }
    return configService.get<EmailChannelSecurityOption>('INBOX_EMAIL_SMTP_SECURITY') || 'STARTTLS'
  })()

  const username = hasStoredConfig
    ? coerceString(overrides?.username)
    : coerceString(configService.get<string>('INBOX_EMAIL_USER'))
  const passwordSource = hasStoredConfig
    ? overrides?.password
    : configService.get<string>('INBOX_EMAIL_PASSWORD')
  const password = coerceString(passwordSource ?? undefined)
  const configuredFromAddress = hasStoredConfig
    ? coerceString(overrides?.fromAddress)
    : coerceString(configService.get<string>('INBOX_EMAIL_DEFAULT_FROM'))
  const fromAddress = configuredFromAddress || username
  const fromName = hasStoredConfig
    ? coerceOptionalString(overrides?.fromName)
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
    hasStoredConfig
      ? coercePositiveNumber(overrides?.maxAttachmentSizeMb) ?? 25
      : parseNumber(configService.get('INBOX_EMAIL_MAX_ATTACHMENT_MB'), 25)
  const outgoingRatePerMinute =
    hasStoredConfig
      ? coercePositiveNumber(overrides?.ratePerMinute) ?? 60
      : parseNumber(configService.get('INBOX_EMAIL_RATE_PER_MINUTE'), 60)
  const pollingIntervalMs =
    hasStoredConfig
      ? coercePositiveNumber(overrides?.pollIntervalMs) ?? 120000
      : parseNumber(configService.get('INBOX_EMAIL_POLL_INTERVAL_MS'), 120000)
  const pollingBatchSize =
    hasStoredConfig
      ? coercePositiveNumber(overrides?.pollBatchSize) ?? 50
      : parseNumber(configService.get('INBOX_EMAIL_POLL_BATCH_SIZE'), 50)

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

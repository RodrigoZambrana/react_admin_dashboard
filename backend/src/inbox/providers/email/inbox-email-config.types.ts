import type { EmailChannelSecurityOption } from './email-channel.types'

export const INBOX_EMAIL_CONFIG_SECURE_KEY = 'inbox.email.config'

export type StoredInboxEmailConfig = {
  imapHost?: string | null
  imapPort?: number | null
  imapSecurity?: EmailChannelSecurityOption | null
  smtpHost?: string | null
  smtpPort?: number | null
  smtpSecurity?: EmailChannelSecurityOption | null
  username?: string | null
  password?: string | null
  fromAddress?: string | null
  fromName?: string | null
  maxAttachmentSizeMb?: number | null
  ratePerMinute?: number | null
  pollIntervalMs?: number | null
  pollBatchSize?: number | null
}

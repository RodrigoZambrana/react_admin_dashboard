import ApiService from './ApiService'

const channelControlBaseUrl = (
  import.meta.env.VITE_AI_PLATFORM_URL ||
  'http://localhost:4110'
).replace(/\/$/, '')

const channelControlUrl = (path: string) =>
  `${channelControlBaseUrl}${path.startsWith('/') ? path : `/${path}`}`

export type EmailConfigPayload = {
  provider: 'SMTP' | 'SENDGRID' | 'DEV'
  fromAddress: string
  fromName: string
  customerEmailsEnabled: boolean
  adminEmailsEnabled: boolean
  smtp?: {
    host: string
    port: number
    secure: boolean
    allowInvalidCerts: boolean
    user?: string
    password?: string
  } | null
}

export type InboxEmailConfigPayload = {
  imapHost?: string | null
  imapPort?: number | null
  imapSecurity?: 'SSL_TLS' | 'STARTTLS' | 'NONE' | null
  smtpHost?: string | null
  smtpPort?: number | null
  smtpSecurity?: 'SSL_TLS' | 'STARTTLS' | 'NONE' | null
  username?: string | null
  password?: string | null
  fromAddress?: string | null
  fromName?: string | null
  maxAttachmentSizeMb?: number | null
  ratePerMinute?: number | null
  pollIntervalMs?: number | null
  pollBatchSize?: number | null
}

export type InboxEmailConfigResponse = {
  source: 'environment' | 'database'
  updatedAt: string | null
  imapHost: string
  imapPort: number
  imapSecurity: 'SSL_TLS' | 'STARTTLS' | 'NONE'
  smtpHost: string
  smtpPort: number
  smtpSecurity: 'SSL_TLS' | 'STARTTLS' | 'NONE'
  username: string
  fromAddress: string
  fromName: string | null
  maxAttachmentSizeMb: number
  ratePerMinute: number
  pollIntervalMs: number
  pollBatchSize: number
  passwordSet: boolean
}

export async function apiGetEmailConfig<T = EmailConfigPayload>() {
  return ApiService.fetchData<T>({
    url: '/settings/email/config',
    method: 'get',
  })
}

export async function apiUpdateEmailConfig<T = EmailConfigPayload, U = EmailConfigPayload>(data: U) {
  return ApiService.fetchData<T>({
    url: '/settings/email/config',
    method: 'put',
    data,
  })
}

export async function apiSendTestEmailConfig<T = { ok: boolean }, U = { to: string }> (data: U) {
  return ApiService.fetchData<T>({
    url: '/settings/email/config/test',
    method: 'post',
    data,
  })
}

export async function apiGetInboxEmailConfig<T = InboxEmailConfigResponse>() {
  return ApiService.fetchData<T>({
    url: channelControlUrl('/settings/channels/email'),
    method: 'get',
  })
}

export async function apiUpdateInboxEmailConfig<T = InboxEmailConfigResponse, U = InboxEmailConfigPayload>(data: U) {
  return ApiService.fetchData<T>({
    url: channelControlUrl('/settings/channels/email'),
    method: 'put',
    data,
  })
}

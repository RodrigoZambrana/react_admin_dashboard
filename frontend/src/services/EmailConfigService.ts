import ApiService from './ApiService'

export type EmailConfigPayload = {
  provider: 'SMTP' | 'SENDGRID' | 'DEV'
  fromAddress: string
  fromName: string
  smtp?: {
    host: string
    port: number
    secure: boolean
    allowInvalidCerts: boolean
    user?: string
    password?: string
  } | null
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

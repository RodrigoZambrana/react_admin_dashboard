import { describe, expect, it } from 'vitest'
import { buildEmailChannelConfig } from '../email-channel.config'

const createConfigService = (overrides: Record<string, unknown> = {}) => ({
  get: (key: string) => overrides[key],
})

describe('buildEmailChannelConfig', () => {
  it('falls back to default polling values when stored overrides contain zeroes', () => {
    const config = buildEmailChannelConfig(
      createConfigService({
        INBOX_EMAIL_IMAP_HOST: 'mail.example.com',
        INBOX_EMAIL_IMAP_PORT: '993',
        INBOX_EMAIL_IMAP_SECURITY: 'SSL_TLS',
        INBOX_EMAIL_SMTP_HOST: 'mail.example.com',
        INBOX_EMAIL_SMTP_PORT: '465',
        INBOX_EMAIL_SMTP_SECURITY: 'SSL_TLS',
        INBOX_EMAIL_USER: 'ops@example.com',
        INBOX_EMAIL_PASSWORD: 'secret',
        INBOX_EMAIL_DEFAULT_FROM: 'ops@example.com',
        INBOX_EMAIL_POLL_INTERVAL_MS: '120000',
        INBOX_EMAIL_POLL_BATCH_SIZE: '50',
      }) as never,
      undefined,
      {
        pollIntervalMs: 0,
        pollBatchSize: 0,
      },
    )

    expect(config.polling.intervalMs).toBe(120000)
    expect(config.polling.batchSize).toBe(50)
  })

  it('falls back to defaults when polling env values are blank strings', () => {
    const config = buildEmailChannelConfig(
      createConfigService({
        INBOX_EMAIL_IMAP_HOST: 'mail.example.com',
        INBOX_EMAIL_IMAP_PORT: '993',
        INBOX_EMAIL_IMAP_SECURITY: 'SSL_TLS',
        INBOX_EMAIL_SMTP_HOST: 'mail.example.com',
        INBOX_EMAIL_SMTP_PORT: '465',
        INBOX_EMAIL_SMTP_SECURITY: 'SSL_TLS',
        INBOX_EMAIL_USER: 'ops@example.com',
        INBOX_EMAIL_PASSWORD: 'secret',
        INBOX_EMAIL_DEFAULT_FROM: 'ops@example.com',
        INBOX_EMAIL_POLL_INTERVAL_MS: '',
        INBOX_EMAIL_POLL_BATCH_SIZE: '',
      }) as never,
    )

    expect(config.polling.intervalMs).toBe(120000)
    expect(config.polling.batchSize).toBe(50)
  })

  it('uses stored config as source of truth when secure config exists', () => {
    const config = buildEmailChannelConfig(
      createConfigService({
        INBOX_EMAIL_IMAP_HOST: 'env.mail.example.com',
        INBOX_EMAIL_IMAP_PORT: '993',
        INBOX_EMAIL_IMAP_SECURITY: 'SSL_TLS',
        INBOX_EMAIL_SMTP_HOST: 'env.mail.example.com',
        INBOX_EMAIL_SMTP_PORT: '465',
        INBOX_EMAIL_SMTP_SECURITY: 'SSL_TLS',
        INBOX_EMAIL_USER: 'env@example.com',
        INBOX_EMAIL_PASSWORD: 'env-secret',
        INBOX_EMAIL_DEFAULT_FROM: 'env@example.com',
        INBOX_EMAIL_POLL_INTERVAL_MS: '999999',
        INBOX_EMAIL_POLL_BATCH_SIZE: '999',
      }) as never,
      undefined,
      {
        imapHost: 'db.mail.example.com',
        imapPort: 993,
        smtpHost: 'db.mail.example.com',
        smtpPort: 465,
        username: 'db@example.com',
        password: 'db-secret',
        fromAddress: 'db@example.com',
        pollIntervalMs: 120000,
        pollBatchSize: 50,
      },
    )

    expect(config.imap.host).toBe('db.mail.example.com')
    expect(config.smtp.host).toBe('db.mail.example.com')
    expect(config.credentials.user).toBe('db@example.com')
    expect(config.defaults.fromAddress).toBe('db@example.com')
    expect(config.polling.intervalMs).toBe(120000)
    expect(config.polling.batchSize).toBe(50)
  })
})

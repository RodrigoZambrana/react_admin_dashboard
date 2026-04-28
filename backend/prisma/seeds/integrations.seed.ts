import type { ConfigService } from '@nestjs/config'
import type { PrismaClient } from '@prisma/client'
import { ConfigEncryptionService } from '../../src/common/security/config-encryption.service'
import { SecureConfigService } from '../../src/common/security/secure-config.service'
import {
  normalizeSeedBoolean,
  normalizeSeedNumber,
  normalizeSeedString,
  type SeedEnvironment,
} from './seed-utils'

type IntegrationSeedResult = {
  secureEntriesCreated: number
}

type SeedConfigService = Pick<ConfigService, 'get'>

const createConfigService = (): SeedConfigService => ({
  get: (key: string) => process.env[key],
})

const createSecureConfigService = (prisma: PrismaClient) => {
  const encryption = new ConfigEncryptionService(createConfigService() as ConfigService)
  return new SecureConfigService(prisma as never, encryption)
}

const readOptionalValue = (value: unknown): string | null => {
  const normalized = normalizeSeedString(value)
  return normalized.length > 0 ? normalized : null
}

const hasAnyValue = (values: Array<unknown>): boolean =>
  values.some((value) => {
    if (typeof value === 'string') {
      return value.trim().length > 0
    }
    return Boolean(value)
  })

export async function seedIntegrations(
  prisma: PrismaClient,
  environment: SeedEnvironment,
): Promise<IntegrationSeedResult> {
  const secureConfig = createSecureConfigService(prisma)

  const googlePayload = {
    googleEnabled: normalizeSeedBoolean(process.env.GOOGLE_OAUTH_ENABLED, true),
    storefrontGoogleEnabled: normalizeSeedBoolean(
      process.env.STOREFRONT_GOOGLE_BUTTON_ENABLED ?? process.env.NEXT_PUBLIC_GOOGLE_BUTTON_ENABLED,
      true,
    ),
    clientId: readOptionalValue(process.env.GOOGLE_CLIENT_ID),
    clientSecret: readOptionalValue(process.env.GOOGLE_CLIENT_SECRET),
    redirectUri: readOptionalValue(process.env.GOOGLE_OAUTH_REDIRECT_URI),
    recaptchaEnabled: normalizeSeedBoolean(process.env.RECAPTCHA_ENABLED, false),
    recaptchaSecretKey: readOptionalValue(process.env.RECAPTCHA_SECRET_KEY),
    adminRecaptchaEnabled: normalizeSeedBoolean(
      process.env.ADMIN_RECAPTCHA_ENABLED,
      normalizeSeedBoolean(process.env.RECAPTCHA_ENABLED, false),
    ),
    adminRecaptchaSiteKey: readOptionalValue(process.env.ADMIN_RECAPTCHA_SITE_KEY),
    storefrontRecaptchaEnabled: normalizeSeedBoolean(
      process.env.STOREFRONT_RECAPTCHA_ENABLED,
      normalizeSeedBoolean(process.env.RECAPTCHA_ENABLED, false),
    ),
    storefrontRecaptchaSiteKey: readOptionalValue(process.env.STOREFRONT_RECAPTCHA_SITE_KEY),
    storefrontSiteUrl:
      readOptionalValue(
        process.env.STOREFRONT_BASE_URL ||
          process.env.NEXT_PUBLIC_STOREFRONT_SITE_URL ||
          process.env.NEXT_PUBLIC_SITE_URL,
      ) ?? null,
    environment,
  }

  const mpPayload = {
    provider: normalizeSeedString(process.env.PAYMENTS_PROVIDER || 'mercadopago') || 'mercadopago',
    accessToken: readOptionalValue(process.env.MP_ACCESS_TOKEN),
    publicKey: readOptionalValue(process.env.MP_PUBLIC_KEY),
    integratorId: readOptionalValue(process.env.MP_INTEGRATOR_ID),
    applicationId: readOptionalValue(process.env.MP_APPLICATION_ID),
    country: readOptionalValue(process.env.MP_COUNTRY)?.toUpperCase() ?? null,
    timeoutMs: normalizeSeedNumber(process.env.MP_TIMEOUT_MS, 12000),
    environment,
  }

  const emailPayload = {
    provider: normalizeSeedString(process.env.EMAIL_PROVIDER || 'DEV').toUpperCase() || 'DEV',
    fromAddress: readOptionalValue(process.env.EMAIL_FROM_DEFAULT) ?? 'no-reply@example.com',
    fromName: readOptionalValue(process.env.EMAIL_FROM_NAME_DEFAULT) ?? 'Sistema Administrativo',
    customerEmailsEnabled: normalizeSeedBoolean(process.env.EMAIL_CUSTOMER_DELIVERY_ENABLED, true),
    adminEmailsEnabled: normalizeSeedBoolean(process.env.EMAIL_ADMIN_DELIVERY_ENABLED, true),
    smtp:
      normalizeSeedString(process.env.EMAIL_PROVIDER || 'DEV').toUpperCase() === 'SMTP'
        ? {
            host: readOptionalValue(process.env.EMAIL_SMTP_HOST),
            port: normalizeSeedNumber(process.env.EMAIL_SMTP_PORT, 587),
            secure: normalizeSeedBoolean(process.env.EMAIL_SMTP_SECURE, false),
            allowInvalidCerts: normalizeSeedBoolean(
              process.env.EMAIL_SMTP_ALLOW_INVALID_CERTS,
              false,
            ),
            user: readOptionalValue(process.env.EMAIL_SMTP_USER),
            password: readOptionalValue(process.env.EMAIL_SMTP_PASSWORD),
          }
        : null,
    environment,
  }

  const inboxPayload = {
    imapHost: readOptionalValue(process.env.INBOX_EMAIL_IMAP_HOST),
    imapPort: normalizeSeedNumber(process.env.INBOX_EMAIL_IMAP_PORT, 993),
    imapSecurity: readOptionalValue(process.env.INBOX_EMAIL_IMAP_SECURITY),
    smtpHost: readOptionalValue(process.env.INBOX_EMAIL_SMTP_HOST),
    smtpPort: normalizeSeedNumber(process.env.INBOX_EMAIL_SMTP_PORT, 587),
    smtpSecurity: readOptionalValue(process.env.INBOX_EMAIL_SMTP_SECURITY),
    username: readOptionalValue(process.env.INBOX_EMAIL_USER),
    password: readOptionalValue(process.env.INBOX_EMAIL_PASSWORD),
    fromAddress:
      readOptionalValue(process.env.INBOX_EMAIL_DEFAULT_FROM) ??
      readOptionalValue(process.env.INBOX_EMAIL_USER),
    fromName: readOptionalValue(process.env.INBOX_EMAIL_DEFAULT_NAME),
    displayName: readOptionalValue(process.env.INBOX_EMAIL_DISPLAY_NAME),
    maxAttachmentSizeMb: normalizeSeedNumber(process.env.INBOX_EMAIL_MAX_ATTACHMENT_MB, 25),
    ratePerMinute: normalizeSeedNumber(process.env.INBOX_EMAIL_RATE_PER_MINUTE, 60),
    pollIntervalMs: normalizeSeedNumber(process.env.INBOX_EMAIL_POLL_INTERVAL_MS, 120000),
    pollBatchSize: normalizeSeedNumber(process.env.INBOX_EMAIL_POLL_BATCH_SIZE, 50),
    environment,
  }

  let secureEntriesCreated = 0

  if (
    hasAnyValue([
      googlePayload.clientId,
      googlePayload.clientSecret,
      googlePayload.redirectUri,
      googlePayload.recaptchaSecretKey,
      googlePayload.adminRecaptchaSiteKey,
      googlePayload.storefrontRecaptchaSiteKey,
      googlePayload.storefrontSiteUrl,
    ])
  ) {
    const before = await secureConfig.getJson('integrations.google')
    if (!before) {
      await secureConfig.setJson('integrations.google', googlePayload)
      secureEntriesCreated += 1
    }
  }

  if (hasAnyValue([mpPayload.accessToken, mpPayload.publicKey, mpPayload.integratorId, mpPayload.applicationId])) {
    const before = await secureConfig.getJson('payments.mercadopago')
    if (!before) {
      await secureConfig.setJson('payments.mercadopago', mpPayload)
      secureEntriesCreated += 1
    }
  }

  if (hasAnyValue([emailPayload.smtp?.host, emailPayload.smtp?.user, emailPayload.smtp?.password, emailPayload.fromAddress])) {
    const before = await secureConfig.getJson('email.provider.config')
    if (!before) {
      await secureConfig.setJson('email.provider.config', emailPayload)
      secureEntriesCreated += 1
    }
  }

  if (
    hasAnyValue([
      inboxPayload.imapHost,
      inboxPayload.smtpHost,
      inboxPayload.username,
      inboxPayload.password,
      inboxPayload.fromAddress,
      inboxPayload.displayName,
    ])
  ) {
    const before = await secureConfig.getJson('inbox.email.config')
    if (!before) {
      await secureConfig.setJson('inbox.email.config', inboxPayload)
      secureEntriesCreated += 1
    }
  }

  return { secureEntriesCreated }
}

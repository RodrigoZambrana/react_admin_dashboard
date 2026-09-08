import { ConfigService } from '@nestjs/config'
import { ConfigEncryptionService } from '../src/common/security/config-encryption.service'
import { SecureConfigService } from '../src/common/security/secure-config.service'
import { GOOGLE_INTEGRATION_SECURE_CONFIG_KEY } from '../src/common/integrations/google-config.service'
import { MERCADO_PAGO_SECURE_CONFIG_KEY } from '../src/storefront/payments/mercadopago.service'
import type { EmailProviderConfig } from '../src/email/email-settings.service'
import { INBOX_EMAIL_CONFIG_SECURE_KEY, type StoredInboxEmailConfig } from '../src/inbox/providers/email/inbox-email-config.types'
import { PrismaService } from '../src/prisma/prisma.service'

type StoredGoogleIntegrationConfig = {
  googleEnabled?: boolean | null
  storefrontGoogleEnabled?: boolean | null
  clientId?: string | null
  clientSecret?: string | null
  redirectUri?: string | null
  recaptchaEnabled?: boolean | null
  recaptchaSecretKey?: string | null
  adminRecaptchaEnabled?: boolean | null
  adminRecaptchaSiteKey?: string | null
  storefrontRecaptchaEnabled?: boolean | null
  storefrontRecaptchaSiteKey?: string | null
  storefrontSiteUrl?: string | null
}

type StoredMercadoPagoConfig = {
  provider?: string | null
  accessToken?: string | null
  publicKey?: string | null
  integratorId?: string | null
  applicationId?: string | null
  country?: string | null
  timeoutMs?: number | null
}

type EnvLike = {
  get(key: string): string | undefined
}

const env: EnvLike = {
  get: (key: string) => process.env[key],
}

const asString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const asNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const asBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  if (typeof value === 'number') {
    return value !== 0
  }
  return fallback
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const prisma = new PrismaService()
  const config = { get: (key: string) => env.get(key) } as ConfigService
  const encryption = new ConfigEncryptionService(config)
  const secureConfig = new SecureConfigService(prisma, encryption)

  try {
    const currentGoogle = await secureConfig
      .getJson<StoredGoogleIntegrationConfig>(GOOGLE_INTEGRATION_SECURE_CONFIG_KEY)
      .catch(() => null)
    const nextGoogle: StoredGoogleIntegrationConfig = {
      ...(currentGoogle?.value ?? {}),
      googleEnabled:
        currentGoogle?.value?.googleEnabled ?? asBoolean(process.env.GOOGLE_OAUTH_ENABLED, false),
      storefrontGoogleEnabled:
        currentGoogle?.value?.storefrontGoogleEnabled ??
        asBoolean(process.env.NEXT_PUBLIC_GOOGLE_BUTTON_ENABLED, false),
      clientId: currentGoogle?.value?.clientId ?? asString(process.env.GOOGLE_CLIENT_ID),
      clientSecret: currentGoogle?.value?.clientSecret ?? asString(process.env.GOOGLE_CLIENT_SECRET),
      redirectUri: currentGoogle?.value?.redirectUri ?? asString(process.env.GOOGLE_OAUTH_REDIRECT_URI),
      recaptchaEnabled: asBoolean(process.env.RECAPTCHA_ENABLED, true),
      recaptchaSecretKey: asString(process.env.RECAPTCHA_SECRET_KEY),
      adminRecaptchaEnabled: asBoolean(process.env.ADMIN_RECAPTCHA_ENABLED, true),
      adminRecaptchaSiteKey: asString(process.env.ADMIN_RECAPTCHA_SITE_KEY),
      storefrontRecaptchaEnabled: asBoolean(process.env.STOREFRONT_RECAPTCHA_ENABLED, true),
      storefrontRecaptchaSiteKey: asString(process.env.STOREFRONT_RECAPTCHA_SITE_KEY),
      storefrontSiteUrl:
        asString(process.env.STOREFRONT_BASE_URL) ??
        asString(process.env.NEXT_PUBLIC_SITE_URL) ??
        currentGoogle?.value?.storefrontSiteUrl ??
        null,
    }

    const currentMercadoPago = await secureConfig
      .getJson<StoredMercadoPagoConfig>(MERCADO_PAGO_SECURE_CONFIG_KEY)
      .catch(() => null)
    const nextMercadoPago: StoredMercadoPagoConfig = {
      ...(currentMercadoPago?.value ?? {}),
      provider: asString(process.env.PAYMENTS_PROVIDER) ?? currentMercadoPago?.value?.provider ?? 'mercadopago',
      accessToken: currentMercadoPago?.value?.accessToken ?? asString(process.env.MP_ACCESS_TOKEN),
      publicKey:
        currentMercadoPago?.value?.publicKey ??
        asString(process.env.MP_PUBLIC_KEY) ??
        asString(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY),
      integratorId: currentMercadoPago?.value?.integratorId ?? asString(process.env.MP_INTEGRATOR_ID),
      applicationId: currentMercadoPago?.value?.applicationId ?? asString(process.env.MP_APPLICATION_ID),
      country:
        currentMercadoPago?.value?.country ??
        asString(process.env.MP_COUNTRY)?.toUpperCase() ??
        asString(process.env.NEXT_PUBLIC_MP_COUNTRY)?.toUpperCase() ??
        null,
      timeoutMs: currentMercadoPago?.value?.timeoutMs ?? asNumber(process.env.MP_TIMEOUT_MS, 12000),
    }

    const nextEmail: EmailProviderConfig = {
      provider: 'SMTP',
      fromAddress: asString(process.env.EMAIL_FROM_DEFAULT) ?? 'no-reply@example.com',
      fromName: asString(process.env.EMAIL_FROM_NAME_DEFAULT) ?? 'Sistema Administrativo',
      customerEmailsEnabled: true,
      adminEmailsEnabled: true,
      smtp: {
        host: asString(process.env.EMAIL_SMTP_HOST) ?? '',
        port: asNumber(process.env.EMAIL_SMTP_PORT, 587),
        secure: asBoolean(process.env.EMAIL_SMTP_SECURE, false),
        allowInvalidCerts: asBoolean(process.env.EMAIL_SMTP_ALLOW_INVALID_CERTS, false),
        user: asString(process.env.EMAIL_SMTP_USER),
        password: asString(process.env.EMAIL_SMTP_PASSWORD),
      },
    }

    const nextInbox: StoredInboxEmailConfig = {
      imapHost: asString(process.env.INBOX_EMAIL_IMAP_HOST),
      imapPort: asNumber(process.env.INBOX_EMAIL_IMAP_PORT, 993),
      imapSecurity: asString(process.env.INBOX_EMAIL_IMAP_SECURITY) as StoredInboxEmailConfig['imapSecurity'],
      smtpHost: asString(process.env.INBOX_EMAIL_SMTP_HOST),
      smtpPort: asNumber(process.env.INBOX_EMAIL_SMTP_PORT, 587),
      smtpSecurity: asString(process.env.INBOX_EMAIL_SMTP_SECURITY) as StoredInboxEmailConfig['smtpSecurity'],
      username: asString(process.env.INBOX_EMAIL_USER),
      password: asString(process.env.INBOX_EMAIL_PASSWORD),
      fromAddress:
        asString(process.env.INBOX_EMAIL_DEFAULT_FROM) ??
        asString(process.env.INBOX_EMAIL_USER),
      fromName: asString(process.env.INBOX_EMAIL_DEFAULT_NAME),
      maxAttachmentSizeMb: asNumber(process.env.INBOX_EMAIL_MAX_ATTACHMENT_MB, 25),
      ratePerMinute: asNumber(process.env.INBOX_EMAIL_RATE_PER_MINUTE, 60),
      pollIntervalMs: asNumber(process.env.INBOX_EMAIL_POLL_INTERVAL_MS, 120000),
      pollBatchSize: asNumber(process.env.INBOX_EMAIL_POLL_BATCH_SIZE, 50),
    }

    if (!dryRun) {
      await secureConfig.setJson(GOOGLE_INTEGRATION_SECURE_CONFIG_KEY, nextGoogle)
      await secureConfig.setJson(MERCADO_PAGO_SECURE_CONFIG_KEY, nextMercadoPago)
      await secureConfig.setJson('email.provider.config', nextEmail)
      await secureConfig.setJson(INBOX_EMAIL_CONFIG_SECURE_KEY, nextInbox)
    }

    console.log(
      JSON.stringify(
        {
          dryRun,
          google: {
            recaptchaEnabled: Boolean(nextGoogle.recaptchaEnabled),
            adminRecaptchaEnabled: Boolean(nextGoogle.adminRecaptchaEnabled),
            storefrontRecaptchaEnabled: Boolean(nextGoogle.storefrontRecaptchaEnabled),
            storefrontSiteUrl: nextGoogle.storefrontSiteUrl,
            googleEnabled: Boolean(nextGoogle.googleEnabled),
            storefrontGoogleEnabled: Boolean(nextGoogle.storefrontGoogleEnabled),
            clientIdConfigured: Boolean(nextGoogle.clientId),
            clientSecretConfigured: Boolean(nextGoogle.clientSecret),
          },
          mercadoPago: {
            provider: nextMercadoPago.provider,
            publicKeyConfigured: Boolean(nextMercadoPago.publicKey),
            accessTokenConfigured: Boolean(nextMercadoPago.accessToken),
            country: nextMercadoPago.country,
            timeoutMs: nextMercadoPago.timeoutMs,
          },
          email: {
            provider: nextEmail.provider,
            smtpConfigured: Boolean(nextEmail.smtp?.host && nextEmail.smtp?.user && nextEmail.smtp?.password),
            fromAddress: nextEmail.fromAddress,
          },
          inbox: {
            imapConfigured: Boolean(nextInbox.imapHost && nextInbox.username && nextInbox.password),
            smtpConfigured: Boolean(nextInbox.smtpHost && nextInbox.username && nextInbox.password),
            fromAddress: nextInbox.fromAddress,
          },
        },
        null,
        2,
      ),
    )
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

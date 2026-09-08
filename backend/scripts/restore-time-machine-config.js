const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('crypto')
const { PrismaClient } = require('@prisma/client')

const GOOGLE_INTEGRATION_SECURE_CONFIG_KEY = 'integrations.google'
const MERCADO_PAGO_SECURE_CONFIG_KEY = 'payments.mercadopago'
const EMAIL_PROVIDER_CONFIG_KEY = 'email.provider.config'
const INBOX_EMAIL_CONFIG_SECURE_KEY = 'inbox.email.config'

const AES_ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

const env = process.env

const asString = (value) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const asNumber = (value, fallback) => {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const asBoolean = (value, fallback) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }
  if (typeof value === 'number') return value !== 0
  return fallback
}

const deriveKey = (secret) => {
  if (/^[0-9a-fA-F]{64}$/.test(secret)) {
    return Buffer.from(secret, 'hex')
  }
  try {
    const decoded = Buffer.from(secret, 'base64')
    if (decoded.length >= 32) {
      return decoded.subarray(0, 32)
    }
  } catch {}
  const utf8 = Buffer.from(secret, 'utf8')
  if (utf8.length >= 32) {
    return utf8.subarray(0, 32)
  }
  return createHash('sha256').update(utf8).digest()
}

const encryptionKey = (env.CONFIG_ENCRYPTION_KEY || '').trim()
if (!encryptionKey) {
  throw new Error('CONFIG_ENCRYPTION_KEY must be configured.')
}

const key = deriveKey(encryptionKey)

const encrypt = (value) => {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(AES_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

const decrypt = (payload) => {
  const buffer = Buffer.from(payload, 'base64')
  const iv = buffer.subarray(0, IV_LENGTH)
  const authTag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const data = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(AES_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}

const prisma = new PrismaClient()

async function getJson(keyName) {
  const record = await prisma.secureConfig.findUnique({ where: { key: keyName } })
  if (!record) return null
  return {
    value: JSON.parse(decrypt(record.value)),
    updatedAt: record.updatedAt,
  }
}

async function setJson(keyName, payload) {
  const serialized = JSON.stringify(payload)
  const encrypted = encrypt(serialized)
  await prisma.secureConfig.upsert({
    where: { key: keyName },
    update: { value: encrypted },
    create: { key: keyName, value: encrypted },
  })
}

async function main() {
  const currentGoogle = await getJson(GOOGLE_INTEGRATION_SECURE_CONFIG_KEY).catch(() => null)
  const nextGoogle = {
    ...(currentGoogle?.value ?? {}),
    googleEnabled:
      currentGoogle?.value?.googleEnabled ?? asBoolean(env.GOOGLE_OAUTH_ENABLED, false),
    storefrontGoogleEnabled:
      currentGoogle?.value?.storefrontGoogleEnabled ??
      asBoolean(env.NEXT_PUBLIC_GOOGLE_BUTTON_ENABLED, false),
    clientId: currentGoogle?.value?.clientId ?? asString(env.GOOGLE_CLIENT_ID),
    clientSecret: currentGoogle?.value?.clientSecret ?? asString(env.GOOGLE_CLIENT_SECRET),
    redirectUri: currentGoogle?.value?.redirectUri ?? asString(env.GOOGLE_OAUTH_REDIRECT_URI),
    recaptchaEnabled: asBoolean(env.RECAPTCHA_ENABLED, true),
    recaptchaSecretKey: asString(env.RECAPTCHA_SECRET_KEY),
    adminRecaptchaEnabled: asBoolean(env.ADMIN_RECAPTCHA_ENABLED, true),
    adminRecaptchaSiteKey: asString(env.ADMIN_RECAPTCHA_SITE_KEY),
    storefrontRecaptchaEnabled: asBoolean(env.STOREFRONT_RECAPTCHA_ENABLED, true),
    storefrontRecaptchaSiteKey: asString(env.STOREFRONT_RECAPTCHA_SITE_KEY),
    storefrontSiteUrl:
      asString(env.STOREFRONT_BASE_URL) ??
      asString(env.NEXT_PUBLIC_SITE_URL) ??
      currentGoogle?.value?.storefrontSiteUrl ??
      null,
  }

  const currentMercadoPago = await getJson(MERCADO_PAGO_SECURE_CONFIG_KEY).catch(() => null)
  const nextMercadoPago = {
    ...(currentMercadoPago?.value ?? {}),
    provider: asString(env.PAYMENTS_PROVIDER) ?? currentMercadoPago?.value?.provider ?? 'mercadopago',
    accessToken: currentMercadoPago?.value?.accessToken ?? asString(env.MP_ACCESS_TOKEN),
    publicKey:
      currentMercadoPago?.value?.publicKey ??
      asString(env.MP_PUBLIC_KEY) ??
      asString(env.NEXT_PUBLIC_MP_PUBLIC_KEY),
    integratorId: currentMercadoPago?.value?.integratorId ?? asString(env.MP_INTEGRATOR_ID),
    applicationId: currentMercadoPago?.value?.applicationId ?? asString(env.MP_APPLICATION_ID),
    country:
      currentMercadoPago?.value?.country ??
      asString(env.MP_COUNTRY)?.toUpperCase() ??
      asString(env.NEXT_PUBLIC_MP_COUNTRY)?.toUpperCase() ??
      null,
    timeoutMs: currentMercadoPago?.value?.timeoutMs ?? asNumber(env.MP_TIMEOUT_MS, 12000),
  }

  const nextEmail = {
    provider: 'SMTP',
    fromAddress: asString(env.EMAIL_FROM_DEFAULT) ?? 'no-reply@example.com',
    fromName: asString(env.EMAIL_FROM_NAME_DEFAULT) ?? 'Sistema Administrativo',
    customerEmailsEnabled: true,
    adminEmailsEnabled: true,
    smtp: {
      host: asString(env.EMAIL_SMTP_HOST) ?? '',
      port: asNumber(env.EMAIL_SMTP_PORT, 587),
      secure: asBoolean(env.EMAIL_SMTP_SECURE, false),
      allowInvalidCerts: asBoolean(env.EMAIL_SMTP_ALLOW_INVALID_CERTS, false),
      user: asString(env.EMAIL_SMTP_USER),
      password: asString(env.EMAIL_SMTP_PASSWORD),
    },
  }

  const nextInbox = {
    imapHost: asString(env.INBOX_EMAIL_IMAP_HOST),
    imapPort: asNumber(env.INBOX_EMAIL_IMAP_PORT, 993),
    imapSecurity: asString(env.INBOX_EMAIL_IMAP_SECURITY),
    smtpHost: asString(env.INBOX_EMAIL_SMTP_HOST),
    smtpPort: asNumber(env.INBOX_EMAIL_SMTP_PORT, 587),
    smtpSecurity: asString(env.INBOX_EMAIL_SMTP_SECURITY),
    username: asString(env.INBOX_EMAIL_USER),
    password: asString(env.INBOX_EMAIL_PASSWORD),
    fromAddress: asString(env.INBOX_EMAIL_DEFAULT_FROM) ?? asString(env.INBOX_EMAIL_USER),
    fromName: asString(env.INBOX_EMAIL_DEFAULT_NAME),
    maxAttachmentSizeMb: asNumber(env.INBOX_EMAIL_MAX_ATTACHMENT_MB, 25),
    ratePerMinute: asNumber(env.INBOX_EMAIL_RATE_PER_MINUTE, 60),
    pollIntervalMs: asNumber(env.INBOX_EMAIL_POLL_INTERVAL_MS, 120000),
    pollBatchSize: asNumber(env.INBOX_EMAIL_POLL_BATCH_SIZE, 50),
  }

  await setJson(GOOGLE_INTEGRATION_SECURE_CONFIG_KEY, nextGoogle)
  await setJson(MERCADO_PAGO_SECURE_CONFIG_KEY, nextMercadoPago)
  await setJson(EMAIL_PROVIDER_CONFIG_KEY, nextEmail)
  await setJson(INBOX_EMAIL_CONFIG_SECURE_KEY, nextInbox)

  console.log(
    JSON.stringify(
      {
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
          smtpConfigured: Boolean(nextEmail.smtp.host && nextEmail.smtp.user && nextEmail.smtp.password),
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
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

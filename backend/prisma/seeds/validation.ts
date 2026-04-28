import {
  hasAnyTruthyValue,
  normalizeSeedBoolean,
  normalizeSeedString,
  resolveSeedEnvironment,
  type SeedEnvironment,
} from './seed-utils'

export type SeedValidationResult = {
  environment: SeedEnvironment
  isProductionLike: boolean
  emailProvider: string
  paymentsProvider: string
  googleOauthEnabled: boolean
  recaptchaEnabled: boolean
  adminRecaptchaEnabled: boolean
  storefrontRecaptchaEnabled: boolean
  missingCritical: string[]
  warnings: string[]
}

const PRODUCTION_LIKE_ENVIRONMENTS = new Set(['production', 'prod', 'testing', 'staging'])

const isProductionLike = (environment: SeedEnvironment): boolean =>
  PRODUCTION_LIKE_ENVIRONMENTS.has(String(environment).trim().toLowerCase())

const requireIfEnabled = (
  enabled: boolean,
  entries: Array<{ key: string; value: unknown }>,
  missing: string[],
) => {
  if (!enabled) {
    return
  }
  for (const entry of entries) {
    if (typeof entry.value === 'string' ? entry.value.trim().length === 0 : !entry.value) {
      missing.push(entry.key)
    }
  }
}

export function validateSeedInputs(): SeedValidationResult {
  const environment = resolveSeedEnvironment()
  const prodLike = isProductionLike(environment)

  const emailProvider = normalizeSeedString(process.env.EMAIL_PROVIDER || 'DEV').toUpperCase()
  const paymentsProvider = normalizeSeedString(process.env.PAYMENTS_PROVIDER || 'mercadopago').toLowerCase()
  const googleOauthEnabled = normalizeSeedBoolean(process.env.GOOGLE_OAUTH_ENABLED, true)
  const recaptchaEnabled = normalizeSeedBoolean(process.env.RECAPTCHA_ENABLED, false)
  const adminRecaptchaEnabled = normalizeSeedBoolean(
    process.env.ADMIN_RECAPTCHA_ENABLED,
    recaptchaEnabled,
  )
  const storefrontRecaptchaEnabled = normalizeSeedBoolean(
    process.env.STOREFRONT_RECAPTCHA_ENABLED,
    recaptchaEnabled,
  )

  const missingCritical: string[] = []
  const warnings: string[] = []

  requireIfEnabled(true, [{ key: 'CONFIG_ENCRYPTION_KEY', value: process.env.CONFIG_ENCRYPTION_KEY }], missingCritical)
  requireIfEnabled(true, [{ key: 'JWT_SECRET', value: process.env.JWT_SECRET }], missingCritical)
  requireIfEnabled(true, [{ key: 'COOKIE_SECRET', value: process.env.COOKIE_SECRET }], missingCritical)

  if (prodLike) {
    if (!normalizeSeedString(process.env.DEFAULT_USER_TEMP_PASSWORD)) {
      warnings.push('DEFAULT_USER_TEMP_PASSWORD is recommended in production-like environments.')
    }
    if (!normalizeSeedString(process.env.STOREFRONT_GENERIC_CUSTOMER_PASSWORD)) {
      warnings.push('STOREFRONT_GENERIC_CUSTOMER_PASSWORD is recommended in production-like environments.')
    }
  }

  if (emailProvider === 'SMTP') {
    requireIfEnabled(
      true,
      [
        { key: 'EMAIL_SMTP_HOST', value: process.env.EMAIL_SMTP_HOST },
        { key: 'EMAIL_SMTP_PORT', value: process.env.EMAIL_SMTP_PORT },
        { key: 'EMAIL_SMTP_USER', value: process.env.EMAIL_SMTP_USER },
        { key: 'EMAIL_SMTP_PASSWORD', value: process.env.EMAIL_SMTP_PASSWORD },
        { key: 'EMAIL_FROM_DEFAULT', value: process.env.EMAIL_FROM_DEFAULT },
      ],
      missingCritical,
    )
  }

  if (paymentsProvider === 'mercadopago' && !hasAnyTruthyValue([process.env.MP_ACCESS_TOKEN, process.env.MP_PUBLIC_KEY])) {
    warnings.push('Mercado Pago is selected but no public/private credentials were provided; the integration will remain bootstrap-only.')
  }

  if (googleOauthEnabled && !hasAnyTruthyValue([process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET])) {
    warnings.push('Google OAuth is enabled but client credentials are missing; the integration will remain bootstrap-only.')
  }

  if (recaptchaEnabled) {
    requireIfEnabled(
      true,
      [{ key: 'RECAPTCHA_SECRET_KEY', value: process.env.RECAPTCHA_SECRET_KEY }],
      missingCritical,
    )
  }

  if (adminRecaptchaEnabled) {
    requireIfEnabled(
      true,
      [{ key: 'ADMIN_RECAPTCHA_SITE_KEY', value: process.env.ADMIN_RECAPTCHA_SITE_KEY }],
      missingCritical,
    )
  }

  if (storefrontRecaptchaEnabled) {
    requireIfEnabled(
      true,
      [{ key: 'STOREFRONT_RECAPTCHA_SITE_KEY', value: process.env.STOREFRONT_RECAPTCHA_SITE_KEY }],
      missingCritical,
    )
  }

  const storefrontUrlCandidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_STOREFRONT_SITE_URL,
    process.env.STOREFRONT_BASE_URL,
  ]
  if (!hasAnyTruthyValue(storefrontUrlCandidates)) {
    warnings.push('No storefront public URL was provided. Runtime code will fall back to local defaults.')
  }

  return {
    environment,
    isProductionLike: prodLike,
    emailProvider,
    paymentsProvider,
    googleOauthEnabled,
    recaptchaEnabled,
    adminRecaptchaEnabled,
    storefrontRecaptchaEnabled,
    missingCritical,
    warnings,
  }
}

import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import {
  normalizeSeedBoolean,
  normalizeSeedNumber,
  normalizeSeedString,
  seedJsonSetting,
  type SeedEnvironment,
} from './seed-utils'

type SettingsSeedResult = {
  settingsCreated: number
}

const EMAIL_CATEGORIES = ['ORDERS', 'PAYMENTS', 'AUTH'] as const

export async function seedSettings(
  prisma: PrismaClient,
  environment: SeedEnvironment,
): Promise<SettingsSeedResult> {
  let settingsCreated = 0

  const settings: Array<{ key: string; value: Prisma.InputJsonValue }> = [
    {
      key: 'email.provider',
      value: {
        provider: normalizeSeedString(process.env.EMAIL_PROVIDER || 'DEV').toUpperCase() || 'DEV',
        fromAddress: normalizeSeedString(process.env.EMAIL_FROM_DEFAULT || 'no-reply@example.com') || 'no-reply@example.com',
        fromName:
          normalizeSeedString(process.env.EMAIL_FROM_NAME_DEFAULT || 'Sistema Administrativo') ||
          'Sistema Administrativo',
      },
    },
    {
      key: 'payments.provider',
      value: {
        provider: normalizeSeedString(process.env.PAYMENTS_PROVIDER || 'mercadopago').toLowerCase() || 'mercadopago',
        country: normalizeSeedString(process.env.MP_COUNTRY || 'AR').toUpperCase() || 'AR',
        timeoutMs: normalizeSeedNumber(process.env.MP_TIMEOUT_MS, 12000),
      },
    },
    {
      key: 'storefront.localization',
      value: {
        clientSlug: normalizeSeedString(process.env.CLIENT_SLUG || 'core') || 'core',
        siteUrl:
          normalizeSeedString(
            process.env.NEXT_PUBLIC_SITE_URL ||
              process.env.NEXT_PUBLIC_STOREFRONT_SITE_URL ||
              process.env.STOREFRONT_BASE_URL ||
              '',
          ) || null,
      },
    },
    {
      key: 'feature.flags',
      value: {
        googleOauthEnabled: normalizeSeedBoolean(process.env.GOOGLE_OAUTH_ENABLED, true),
        recaptchaEnabled: normalizeSeedBoolean(process.env.RECAPTCHA_ENABLED, false),
        adminRecaptchaEnabled: normalizeSeedBoolean(
          process.env.ADMIN_RECAPTCHA_ENABLED,
          normalizeSeedBoolean(process.env.RECAPTCHA_ENABLED, false),
        ),
        storefrontRecaptchaEnabled: normalizeSeedBoolean(
          process.env.STOREFRONT_RECAPTCHA_ENABLED,
          normalizeSeedBoolean(process.env.RECAPTCHA_ENABLED, false),
        ),
        demoSeedEnabled: normalizeSeedBoolean(process.env.ENABLE_DEMO_SEED, false),
      },
    },
    {
      key: 'notifications.email.categories',
      value: {
        categories: EMAIL_CATEGORIES,
      },
    },
    {
      key: 'auth.bootstrap',
      value: {
        tempPasswordConfigured: normalizeSeedString(process.env.DEFAULT_USER_TEMP_PASSWORD).length > 0,
        storefrontGenericCustomerPasswordConfigured:
          normalizeSeedString(process.env.STOREFRONT_GENERIC_CUSTOMER_PASSWORD).length > 0,
      },
    },
  ]

  for (const item of settings) {
    const created = await seedJsonSetting(prisma, environment, item.key, item.value)
    if (created) {
      settingsCreated += 1
    }
  }

  return { settingsCreated }
}

import { Prisma } from '@prisma/client'
import type { PrismaClient } from '@prisma/client'
import {
  normalizeSeedBoolean,
  normalizeSeedNumber,
  normalizeSeedString,
  seedJsonSetting,
  type SeedEnvironment,
} from './seed-utils'

type ConfigSeedResult = {
  settingsCreated: number
  systemConfigCreated: number
}

const DEFAULT_THEME_CONFIG = {
  themeColor: 'indigo',
  direction: 'ltr',
  mode: 'light',
  primaryColorLevel: 600,
  panelExpand: false,
  navMode: 'light',
  cardBordered: true,
  layout: {
    type: 'modern',
    sideNavCollapse: false,
  },
}

const DEFAULT_CURRENCIES = ['USD', 'UYU']

const resolveDefaultCurrency = () => {
  const explicit = normalizeSeedString(process.env.DEFAULT_CURRENCY)
  if (explicit.length > 0) {
    return explicit.toUpperCase()
  }
  return 'UYU'
}

export async function seedConfig(
  prisma: PrismaClient,
  environment: SeedEnvironment,
): Promise<ConfigSeedResult> {
  const settings: Array<{ key: string; value: Prisma.InputJsonValue }> = [
    {
      key: 'app.environment',
      value: {
        environment,
        clientSlug: normalizeSeedString(process.env.CLIENT_SLUG || 'core') || 'core',
      },
    },
    {
      key: 'currency.default',
      value: {
        code: resolveDefaultCurrency(),
      },
    },
    {
      key: 'currency.supported',
      value: {
        codes: DEFAULT_CURRENCIES,
      },
    },
    {
      key: 'checkout.tax',
      value: {
        rate: normalizeSeedNumber(process.env.DEFAULT_TAX_RATE, 22),
        currency: resolveDefaultCurrency(),
      },
    },
    {
      key: 'auth.session',
      value: {
        ttlHours: normalizeSeedNumber(process.env.SESSION_TTL_HOURS, 168),
        cookieSecure: normalizeSeedBoolean(process.env.STOREFRONT_COOKIE_SECURE, environment === 'production'),
        cookieSameSite: normalizeSeedString(process.env.STOREFRONT_COOKIE_SAMESITE || 'lax') || 'lax',
        cookieDomain: normalizeSeedString(process.env.STOREFRONT_COOKIE_DOMAIN) || null,
      },
    },
    {
      key: 'security.cors',
      value: {
        defaultAllowedOrigins: normalizeSeedString(process.env.DEFAULT_ALLOWED_ORIGINS || ''),
        allowedOrigins: normalizeSeedString(process.env.ALLOWED_ORIGINS || ''),
      },
    },
    {
      key: 'storefront.resilience',
      value: {
        snapshotFallbackEnabled: normalizeSeedBoolean(
          process.env.STOREFRONT_SNAPSHOT_FALLBACK_ENABLED,
          false,
        ),
      },
    },
    {
      key: 'notifications.defaults',
      value: {
        emailFromAddress:
          normalizeSeedString(process.env.EMAIL_FROM_DEFAULT || 'no-reply@example.com') ||
          'no-reply@example.com',
        emailFromName:
          normalizeSeedString(process.env.EMAIL_FROM_NAME_DEFAULT || 'Sistema Administrativo') ||
          'Sistema Administrativo',
      },
    },
  ]

  let settingsCreated = 0
  for (const item of settings) {
    const created = await seedJsonSetting(prisma, environment, item.key, item.value)
    if (created) {
      settingsCreated += 1
    }
  }

  const systemConfigRows = [
    { key: 'taxRate', value: String(normalizeSeedNumber(process.env.DEFAULT_TAX_RATE, 22)) },
    { key: 'currencyBase', value: resolveDefaultCurrency() },
    { key: 'currencies', value: JSON.stringify(DEFAULT_CURRENCIES) },
    { key: 'themeConfig', value: JSON.stringify(DEFAULT_THEME_CONFIG) },
    {
      key: 'storefront:snapshotFallbackEnabled',
      value: String(normalizeSeedBoolean(process.env.STOREFRONT_SNAPSHOT_FALLBACK_ENABLED, false)),
    },
  ]

  let systemConfigCreated = 0
  for (const row of systemConfigRows) {
    const existing = await prisma.systemConfig.findUnique({ where: { key: row.key } })
    if (existing) {
      continue
    }
    await prisma.systemConfig.upsert({
      where: { key: row.key },
      update: {},
      create: row,
    })
    systemConfigCreated += 1
  }

  return { settingsCreated, systemConfigCreated }
}

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SecureConfigService } from '../security/secure-config.service'

export const GOOGLE_INTEGRATION_SECURE_CONFIG_KEY = 'integrations.google'

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

export type ResolvedGoogleIntegrationConfig = {
  source: 'environment' | 'database'
  updatedAt: Date | null
  storefrontSiteUrl: string | null
  google: {
    enabled: boolean
    storefrontEnabled: boolean
    clientId: string | null
    clientSecret: string | null
    redirectUri: string | null
  }
  recaptcha: {
    enabled: boolean
    secretKey: string | null
    admin: { enabled: boolean; siteKey: string | null }
    storefront: { enabled: boolean; siteKey: string | null }
  }
}

const sanitizeString = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const sanitizeBoolean = (value: unknown, fallback: boolean): boolean => {
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

@Injectable()
export class GoogleConfigService {
  private readonly logger = new Logger(GoogleConfigService.name)
  private cache: ResolvedGoogleIntegrationConfig | null = null

  constructor(
    private readonly config: ConfigService,
    private readonly secureConfig: SecureConfigService,
  ) {}

  async getEffectiveConfig(force = false): Promise<ResolvedGoogleIntegrationConfig> {
    if (!force && this.cache) {
      return this.cache
    }

    const stored = await this.getStoredConfig()

    const googleEnabledEnv = sanitizeBoolean(
      this.config.get('GOOGLE_OAUTH_ENABLED'),
      true,
    )
    const clientIdEnv = sanitizeString(this.config.get<string>('GOOGLE_CLIENT_ID'))
    const clientSecretEnv = sanitizeString(this.config.get<string>('GOOGLE_CLIENT_SECRET'))
    const redirectEnv = sanitizeString(this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI'))
    const storefrontGoogleEnabledEnv = sanitizeBoolean(
      this.config.get('STOREFRONT_GOOGLE_BUTTON_ENABLED') ??
        this.config.get('NEXT_PUBLIC_GOOGLE_BUTTON_ENABLED'),
      true,
    )

    const recaptchaEnabledEnv = sanitizeBoolean(
      this.config.get('RECAPTCHA_ENABLED'),
      false,
    )
    const recaptchaSecretEnv = sanitizeString(this.config.get<string>('RECAPTCHA_SECRET_KEY'))
    const adminRecaptchaEnabledEnv = sanitizeBoolean(
      this.config.get('ADMIN_RECAPTCHA_ENABLED'),
      recaptchaEnabledEnv,
    )
    const adminRecaptchaSiteEnv = sanitizeString(this.config.get<string>('ADMIN_RECAPTCHA_SITE_KEY'))
    const storefrontRecaptchaEnabledEnv = sanitizeBoolean(
      this.config.get('STOREFRONT_RECAPTCHA_ENABLED'),
      recaptchaEnabledEnv,
    )
    const storefrontRecaptchaSiteEnv = sanitizeString(
      this.config.get<string>('STOREFRONT_RECAPTCHA_SITE_KEY'),
    )
    const storefrontSiteUrlEnv =
      sanitizeString(this.config.get<string>('STOREFRONT_BASE_URL')) ||
      sanitizeString(this.config.get<string>('NEXT_PUBLIC_STOREFRONT_SITE_URL')) ||
      sanitizeString(this.config.get<string>('NEXT_PUBLIC_SITE_URL'))

    const useStored = Boolean(stored)
    const resolved: ResolvedGoogleIntegrationConfig = {
      source: useStored ? 'database' : 'environment',
      updatedAt: stored?.updatedAt ?? null,
      storefrontSiteUrl: sanitizeString(stored?.storefrontSiteUrl) ?? storefrontSiteUrlEnv ?? null,
      google: {
        enabled:
          stored?.googleEnabled !== undefined && stored?.googleEnabled !== null
            ? Boolean(stored?.googleEnabled)
            : googleEnabledEnv,
        storefrontEnabled:
          stored?.storefrontGoogleEnabled !== undefined && stored?.storefrontGoogleEnabled !== null
            ? Boolean(stored?.storefrontGoogleEnabled)
            : storefrontGoogleEnabledEnv,
        clientId: sanitizeString(stored?.clientId) ?? clientIdEnv,
        clientSecret: sanitizeString(stored?.clientSecret) ?? clientSecretEnv,
        redirectUri: sanitizeString(stored?.redirectUri) ?? redirectEnv,
      },
      recaptcha: {
        enabled:
          stored?.recaptchaEnabled !== undefined && stored?.recaptchaEnabled !== null
            ? Boolean(stored?.recaptchaEnabled)
            : recaptchaEnabledEnv,
        secretKey: sanitizeString(stored?.recaptchaSecretKey) ?? recaptchaSecretEnv,
        admin: {
          enabled:
            stored?.adminRecaptchaEnabled !== undefined && stored?.adminRecaptchaEnabled !== null
              ? Boolean(stored?.adminRecaptchaEnabled)
              : adminRecaptchaEnabledEnv,
          siteKey: sanitizeString(stored?.adminRecaptchaSiteKey) ?? adminRecaptchaSiteEnv,
        },
        storefront: {
          enabled:
            stored?.storefrontRecaptchaEnabled !== undefined &&
            stored?.storefrontRecaptchaEnabled !== null
              ? Boolean(stored?.storefrontRecaptchaEnabled)
              : storefrontRecaptchaEnabledEnv,
          siteKey:
            sanitizeString(stored?.storefrontRecaptchaSiteKey) ?? storefrontRecaptchaSiteEnv,
        },
      },
    }

    this.cache = resolved
    return resolved
  }

  async refresh(): Promise<void> {
    this.cache = null
    await this.getEffectiveConfig(true).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to refresh Google integration config: ${message}`)
    })
  }

  private async getStoredConfig(): Promise<(StoredGoogleIntegrationConfig & { updatedAt: Date }) | null> {
    try {
      const record = await this.secureConfig.getJson<StoredGoogleIntegrationConfig>(
        GOOGLE_INTEGRATION_SECURE_CONFIG_KEY,
      )
      if (!record) {
        return null
      }
      return { ...(record.value ?? {}), updatedAt: record.updatedAt }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to read Google integration secure config: ${message}`)
      return null
    }
  }
}

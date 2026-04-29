import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SecureConfigService } from '../common/security/secure-config.service'
import { UpdateGrowthConfigDto } from './dto/update-growth-config.dto'

type GrowthStoredConfig = {
  googleAnalyticsEnabled: boolean
  googleAnalyticsMeasurementId: string | null
  googleTagManagerEnabled: boolean
  googleTagManagerContainerId: string | null
  googleAdsEnabled: boolean
  googleAdsConversionId: string | null
  googleAdsConversionLabel: string | null
  googleSearchConsoleVerificationToken: string | null
  metaPixelEnabled: boolean
  metaPixelId: string | null
  metaConversionsApiEnabled: boolean
  metaConversionsApiToken: string | null
  metaAdsAccountId: string | null
  contentInsightsEnabled: boolean
}

type GrowthConfigInput = Partial<{
  [K in keyof GrowthStoredConfig]: GrowthStoredConfig[K] | null
}>

type GrowthConfigSource = 'environment' | 'database'

type GrowthPublicConfig = {
  google: {
    analytics: {
      enabled: boolean
      measurementId: string | null
    }
    tagManager: {
      enabled: boolean
      containerId: string | null
    }
    ads: {
      enabled: boolean
      conversionId: string | null
      conversionLabel: string | null
    }
    searchConsole: {
      verificationToken: string | null
    }
  }
  meta: {
    pixel: {
      enabled: boolean
      pixelId: string | null
    }
    connection: {
      mode: 'backend_token'
      pixelConfigured: boolean
      conversionsApiConfigured: boolean
      adsAccountIdConfigured: boolean
      ready: boolean
    }
  }
  insights: {
    content: {
      enabled: boolean
    }
  }
}

const GROWTH_CONFIG_KEY = 'growth_config'

@Injectable()
export class GrowthService {
  constructor(
    private readonly secureConfig: SecureConfigService,
    private readonly config: ConfigService,
  ) {}

  async getOverview() {
    const record = await this.getStoredConfigRecord()
    const source: GrowthConfigSource = record ? 'database' : 'environment'
    const config = this.resolveConfig(record)
    const publicConfig = this.toPublicConfig(config)

    return {
      config,
      meta: {
        source,
        updatedAt: record?.updatedAt?.toISOString() ?? null,
      },
      readiness: {
        googleAnalyticsReady:
          !config.googleAnalyticsEnabled || Boolean(config.googleAnalyticsMeasurementId),
        googleTagManagerReady:
          !config.googleTagManagerEnabled || Boolean(config.googleTagManagerContainerId),
        googleAdsReady:
          !config.googleAdsEnabled || Boolean(config.googleAdsConversionId),
        googleSearchConsoleReady:
          !config.googleSearchConsoleVerificationToken ||
          Boolean(config.googleSearchConsoleVerificationToken),
        metaPixelReady: !config.metaPixelEnabled || Boolean(config.metaPixelId),
        metaConversionsApiReady:
          !config.metaConversionsApiEnabled || Boolean(config.metaConversionsApiToken),
        metaBackendConnectionReady:
          !config.metaPixelEnabled &&
          !config.metaConversionsApiEnabled &&
          !config.metaAdsAccountId
            ? false
            : Boolean(config.metaPixelId) &&
              Boolean(config.metaConversionsApiToken) &&
              Boolean(config.metaAdsAccountId),
      },
      publicConfig,
    }
  }

  async updateConfig(input: UpdateGrowthConfigDto) {
    const current = await this.getConfig()
    const next = this.normalizeConfig({
      ...current,
      ...input,
    })
    await this.secureConfig.setJson<GrowthStoredConfig>(GROWTH_CONFIG_KEY, next)
    return this.getOverview()
  }

  async getConfig() {
    const record = await this.getStoredConfigRecord()
    return this.resolveConfig(record)
  }

  async getPublicConfig(): Promise<GrowthPublicConfig> {
    return this.toPublicConfig(await this.getConfig())
  }

  private async getStoredConfigRecord() {
    return this.secureConfig.getJson<GrowthStoredConfig>(GROWTH_CONFIG_KEY)
  }

  private resolveConfig(record: { value: GrowthStoredConfig; updatedAt: Date } | null) {
    if (record) {
      return this.normalizeConfig(record.value)
    }

    return this.normalizeConfig(this.getEnvFallbackConfig())
  }

  private normalizeConfig(raw: GrowthConfigInput): GrowthStoredConfig {
    return {
      googleAnalyticsEnabled: raw.googleAnalyticsEnabled === true,
      googleAnalyticsMeasurementId: this.cleanString(raw.googleAnalyticsMeasurementId),
      googleTagManagerEnabled: raw.googleTagManagerEnabled === true,
      googleTagManagerContainerId: this.cleanString(raw.googleTagManagerContainerId),
      googleAdsEnabled: raw.googleAdsEnabled === true,
      googleAdsConversionId: this.cleanString(raw.googleAdsConversionId),
      googleAdsConversionLabel: this.cleanString(raw.googleAdsConversionLabel),
      googleSearchConsoleVerificationToken: this.cleanString(
        raw.googleSearchConsoleVerificationToken,
      ),
      metaPixelEnabled: raw.metaPixelEnabled === true,
      metaPixelId: this.cleanString(raw.metaPixelId),
      metaConversionsApiEnabled: raw.metaConversionsApiEnabled === true,
      metaConversionsApiToken: this.cleanString(raw.metaConversionsApiToken),
      metaAdsAccountId: this.cleanString(raw.metaAdsAccountId),
      contentInsightsEnabled: raw.contentInsightsEnabled === true,
    }
  }

  private getEnvFallbackConfig(): GrowthConfigInput {
    return {
      googleAnalyticsEnabled: this.readBooleanEnv(
        'GROWTH_GOOGLE_ANALYTICS_ENABLED',
        'GOOGLE_ANALYTICS_ENABLED',
      ),
      googleAnalyticsMeasurementId: this.readStringEnv(
        'GROWTH_GOOGLE_ANALYTICS_MEASUREMENT_ID',
        'GOOGLE_ANALYTICS_MEASUREMENT_ID',
      ),
      googleTagManagerEnabled: this.readBooleanEnv(
        'GROWTH_GOOGLE_TAG_MANAGER_ENABLED',
        'GOOGLE_TAG_MANAGER_ENABLED',
      ),
      googleTagManagerContainerId: this.readStringEnv(
        'GROWTH_GOOGLE_TAG_MANAGER_CONTAINER_ID',
        'GOOGLE_TAG_MANAGER_CONTAINER_ID',
      ),
      googleAdsEnabled: this.readBooleanEnv('GROWTH_GOOGLE_ADS_ENABLED', 'GOOGLE_ADS_ENABLED'),
      googleAdsConversionId: this.readStringEnv(
        'GROWTH_GOOGLE_ADS_CONVERSION_ID',
        'GOOGLE_ADS_CONVERSION_ID',
      ),
      googleAdsConversionLabel: this.readStringEnv(
        'GROWTH_GOOGLE_ADS_CONVERSION_LABEL',
        'GOOGLE_ADS_CONVERSION_LABEL',
      ),
      googleSearchConsoleVerificationToken: this.readStringEnv(
        'GROWTH_GOOGLE_SEARCH_CONSOLE_VERIFICATION_TOKEN',
        'GOOGLE_SEARCH_CONSOLE_VERIFICATION_TOKEN',
      ),
      metaPixelEnabled: this.readBooleanEnv('GROWTH_META_PIXEL_ENABLED', 'META_PIXEL_ENABLED'),
      metaPixelId: this.readStringEnv('GROWTH_META_PIXEL_ID', 'META_PIXEL_ID'),
      metaConversionsApiEnabled: this.readBooleanEnv(
        'GROWTH_META_CONVERSIONS_API_ENABLED',
        'META_CONVERSIONS_API_ENABLED',
      ),
      metaConversionsApiToken: this.readStringEnv(
        'GROWTH_META_CONVERSIONS_API_TOKEN',
        'META_CONVERSIONS_API_TOKEN',
      ),
      metaAdsAccountId: this.readStringEnv('GROWTH_META_ADS_ACCOUNT_ID', 'META_ADS_ACCOUNT_ID'),
      contentInsightsEnabled: this.readBooleanEnv(
        'GROWTH_CONTENT_INSIGHTS_ENABLED',
        'CONTENT_INSIGHTS_ENABLED',
      ),
    }
  }

  private toPublicConfig(config: GrowthStoredConfig): GrowthPublicConfig {
    return {
      google: {
        analytics: {
          enabled: config.googleAnalyticsEnabled && Boolean(config.googleAnalyticsMeasurementId),
          measurementId: config.googleAnalyticsMeasurementId,
        },
        tagManager: {
          enabled: config.googleTagManagerEnabled && Boolean(config.googleTagManagerContainerId),
          containerId: config.googleTagManagerContainerId,
        },
        ads: {
          enabled: config.googleAdsEnabled && Boolean(config.googleAdsConversionId),
          conversionId: config.googleAdsConversionId,
          conversionLabel: config.googleAdsConversionLabel,
        },
        searchConsole: {
          verificationToken: config.googleSearchConsoleVerificationToken,
        },
      },
      meta: {
        pixel: {
          enabled: config.metaPixelEnabled && Boolean(config.metaPixelId),
          pixelId: config.metaPixelId,
        },
        connection: {
          mode: 'backend_token',
          pixelConfigured: Boolean(config.metaPixelId),
          conversionsApiConfigured: Boolean(config.metaConversionsApiToken),
          adsAccountIdConfigured: Boolean(config.metaAdsAccountId),
          ready:
            Boolean(config.metaPixelId) &&
            Boolean(config.metaConversionsApiToken) &&
            Boolean(config.metaAdsAccountId),
        },
      },
      insights: {
        content: {
          enabled: config.contentInsightsEnabled,
        },
      },
    }
  }

  private cleanString(value: unknown) {
    if (typeof value !== 'string') {
      return null
    }
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }

  private readStringEnv(primary: string, fallback?: string) {
    return (
      this.cleanString(this.config.get<string>(primary)) ??
      this.cleanString(fallback ? this.config.get<string>(fallback) : null)
    )
  }

  private readBooleanEnv(primary: string, fallback?: string) {
    const values = [this.config.get<string | boolean>(primary)]
    if (fallback) {
      values.push(this.config.get<string | boolean>(fallback))
    }

    for (const candidate of values) {
      if (typeof candidate === 'boolean') {
        return candidate
      }
      if (typeof candidate === 'string') {
        const normalized = candidate.trim().toLowerCase()
        if (['true', '1', 'yes', 'on'].includes(normalized)) {
          return true
        }
        if (['false', '0', 'no', 'off'].includes(normalized)) {
          return false
        }
      }
    }

    return false
  }
}

import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

const sanitizeString = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeCustomerId = (value?: string | null): string | null => {
  const raw = sanitizeString(value)
  if (!raw) {
    return null
  }
  const digits = raw.replace(/\D+/g, '')
  return digits.length ? digits : null
}

export type ResolvedGoogleAdsIntegrationConfig = {
  source: 'environment'
  developerToken: string | null
  customerId: string | null
}

@Injectable()
export class GoogleAdsConfigService {
  constructor(private readonly config: ConfigService) {}

  getEffectiveConfig(): ResolvedGoogleAdsIntegrationConfig {
    return {
      source: 'environment',
      developerToken: sanitizeString(this.config.get<string>('GOOGLE_ADS_DEVELOPER_TOKEN')),
      customerId: normalizeCustomerId(this.config.get<string>('GOOGLE_ADS_CUSTOMER_ID')),
    }
  }
}

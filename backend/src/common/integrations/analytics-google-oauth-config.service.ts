import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

export type ResolvedAnalyticsGoogleOAuthConfig = {
  source: 'environment'
  clientId: string | null
  clientSecret: string | null
  redirectUri: string | null
}

const sanitizeString = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

@Injectable()
export class AnalyticsGoogleOAuthConfigService {
  constructor(private readonly config: ConfigService) {}

  getEffectiveConfig(): ResolvedAnalyticsGoogleOAuthConfig {
    return {
      source: 'environment',
      clientId: sanitizeString(this.config.get<string>('GOOGLE_CLIENT_ID')),
      clientSecret: sanitizeString(this.config.get<string>('GOOGLE_CLIENT_SECRET')),
      redirectUri: sanitizeString(this.config.get<string>('GOOGLE_OAUTH_REDIRECT_URI')),
    }
  }
}

export type ClientFeatureFlags = Record<string, boolean>

export type ClientModuleToggles = Record<string, boolean>

export interface ClientRateLimitConfig {
  ttlMs?: number
  limit?: number
}

export interface ClientVariantConfig {
  slug: string
  displayName: string
  description?: string
  featureFlags?: ClientFeatureFlags
  shared?: {
    locale?: string
    currency?: string
    timezone?: string
    [key: string]: unknown
  }
  backend?: {
    rateLimit?: ClientRateLimitConfig
    modules?: ClientModuleToggles
    env?: Record<string, string | number | boolean>
    metadata?: Record<string, unknown>
  }
  frontend?: {
    routes?: {
      protected?: {
        disabledRouteKeys?: string[]
      }
      public?: {
        disabledRouteKeys?: string[]
      }
    }
    metadata?: Record<string, unknown>
  }
  metadata?: Record<string, unknown>
}

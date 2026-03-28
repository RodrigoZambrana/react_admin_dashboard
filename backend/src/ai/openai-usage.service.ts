import { ForbiddenException, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { SecureConfigService } from '../common/security/secure-config.service'
import { AiService } from './ai.service'

type UsageBucketResult = {
  input_tokens?: number | null
  output_tokens?: number | null
  input_cached_tokens?: number | null
  input_audio_tokens?: number | null
  output_audio_tokens?: number | null
  num_model_requests?: number | null
}

type CostsBucketResult = {
  amount?: {
    value?: number | null
    currency?: string | null
  } | null
}

type OpenAiPage<T> = {
  data?: Array<{
    results?: T[]
  }>
  has_more?: boolean
  next_page?: string | null
}

export type OpenAiUsageSummary = {
  total_tokens: number
  total_requests: number
  start_time: number
  end_time: number
  source: 'openai' | 'fallback'
  error: string | null
}

export type OpenAiCostsSummary = {
  total_spent: number
  currency: string
  start_time: number
  end_time: number
  source: 'openai' | 'fallback'
  error: string | null
}

export type OpenAiQuotaSummary = {
  budget_limit: number | null
  total_spent: number
  remaining: number | null
  exceeded: boolean
  source: 'openai' | 'fallback' | 'unconfigured'
  error: string | null
  checked_at: string
}

type OpenAiUsageSnapshot = {
  usage: OpenAiUsageSummary
  costs: OpenAiCostsSummary
  quota: OpenAiQuotaSummary
}

type RuntimeConfigShape = {
  openAiApiKey?: string | null
  monthlySpendingLimitUsd?: number | null
  currentUsageUsd?: number | null
}

@Injectable()
export class OpenAiUsageService {
  private static readonly CACHE_TTL_MS = 60_000
  private static readonly REQUEST_TIMEOUT_MS = 12_000
  private static readonly MAX_RETRIES = 2

  private readonly cache = new Map<
    string,
    { expiresAt: number; value: OpenAiUsageSummary | OpenAiCostsSummary | OpenAiQuotaSummary | OpenAiUsageSnapshot }
  >()

  constructor(
    private readonly config: ConfigService,
    private readonly secureConfig: SecureConfigService,
  ) {}

  async getUsage(
    startTime: number,
    endTime: number,
    apiKeyIds: string[] = [],
  ): Promise<OpenAiUsageSummary> {
    const cacheKey = `usage:${startTime}:${endTime}:${apiKeyIds.join(',')}`
    const cached = this.getCached<OpenAiUsageSummary>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const page = await this.fetchAllPages<UsageBucketResult>(
        '/organization/usage/completions',
        {
          start_time: startTime,
          end_time: endTime,
          ...(apiKeyIds.length ? { api_key_ids: apiKeyIds } : {}),
        },
      )

      let totalTokens = 0
      let totalRequests = 0
      for (const bucket of page) {
        for (const result of bucket.results ?? []) {
          totalTokens +=
            this.safeNumber(result.input_tokens) +
            this.safeNumber(result.output_tokens) +
            this.safeNumber(result.input_cached_tokens) +
            this.safeNumber(result.input_audio_tokens) +
            this.safeNumber(result.output_audio_tokens)
          totalRequests += this.safeNumber(result.num_model_requests)
        }
      }

      const summary: OpenAiUsageSummary = {
        total_tokens: totalTokens,
        total_requests: totalRequests,
        start_time: startTime,
        end_time: endTime,
        source: 'openai',
        error: null,
      }
      this.setCached(cacheKey, summary)
      return summary
    } catch (error) {
      const fallback: OpenAiUsageSummary = {
        total_tokens: 0,
        total_requests: 0,
        start_time: startTime,
        end_time: endTime,
        source: 'fallback',
        error: error instanceof Error ? error.message : 'usage_fetch_failed',
      }
      this.setCached(cacheKey, fallback)
      return fallback
    }
  }

  async getCosts(startTime: number, endTime: number): Promise<OpenAiCostsSummary> {
    const cacheKey = `costs:${startTime}:${endTime}`
    const cached = this.getCached<OpenAiCostsSummary>(cacheKey)
    if (cached) {
      return cached
    }

    try {
      const page = await this.fetchAllPages<CostsBucketResult>('/organization/costs', {
        start_time: startTime,
        end_time: endTime,
      })

      let totalSpent = 0
      let currency = 'usd'
      for (const bucket of page) {
        for (const result of bucket.results ?? []) {
          totalSpent += this.safeNumber(result.amount?.value)
          if (typeof result.amount?.currency === 'string' && result.amount.currency.trim()) {
            currency = result.amount.currency.trim().toLowerCase()
          }
        }
      }

      const summary: OpenAiCostsSummary = {
        total_spent: Number(totalSpent.toFixed(6)),
        currency,
        start_time: startTime,
        end_time: endTime,
        source: 'openai',
        error: null,
      }
      this.setCached(cacheKey, summary)
      return summary
    } catch (error) {
      const runtimeConfig = await this.getRuntimeConfig()
      const fallback: OpenAiCostsSummary = {
        total_spent: this.safeNumber(runtimeConfig.currentUsageUsd),
        currency: 'usd',
        start_time: startTime,
        end_time: endTime,
        source: 'fallback',
        error: error instanceof Error ? error.message : 'costs_fetch_failed',
      }
      this.setCached(cacheKey, fallback)
      return fallback
    }
  }

  async getRemainingQuota(
    budgetLimit?: number | null,
    range?: { startTime?: number; endTime?: number },
  ): Promise<OpenAiQuotaSummary> {
    const { startTime, endTime } = this.resolveRange(range)
    const limit = budgetLimit ?? (await this.resolveBudgetLimit())
    const cacheKey = `quota:${startTime}:${endTime}:${String(limit ?? 'null')}`
    const cached = this.getCached<OpenAiQuotaSummary>(cacheKey)
    if (cached) {
      return cached
    }

    if (limit == null || limit <= 0) {
      const unconfigured: OpenAiQuotaSummary = {
        budget_limit: null,
        total_spent: 0,
        remaining: null,
        exceeded: false,
        source: 'unconfigured',
        error: null,
        checked_at: new Date().toISOString(),
      }
      this.setCached(cacheKey, unconfigured)
      return unconfigured
    }

    const costs = await this.getCosts(startTime, endTime)
    const remaining = Number((limit - costs.total_spent).toFixed(6))
    const summary: OpenAiQuotaSummary = {
      budget_limit: limit,
      total_spent: costs.total_spent,
      remaining,
      exceeded: remaining <= 0,
      source: costs.source,
      error: costs.error,
      checked_at: new Date().toISOString(),
    }
    this.setCached(cacheKey, summary)
    return summary
  }

  async getUsageSnapshot(input?: {
    startTime?: number
    endTime?: number
    apiKeyIds?: string[]
    budgetLimit?: number | null
  }): Promise<OpenAiUsageSnapshot> {
    const { startTime, endTime } = this.resolveRange(input)
    const cacheKey = `snapshot:${startTime}:${endTime}:${(input?.apiKeyIds ?? []).join(',')}:${String(input?.budgetLimit ?? 'null')}`
    const cached = this.getCached<OpenAiUsageSnapshot>(cacheKey)
    if (cached) {
      return cached
    }

    const [usage, costs, quota] = await Promise.all([
      this.getUsage(startTime, endTime, input?.apiKeyIds ?? []),
      this.getCosts(startTime, endTime),
      this.getRemainingQuota(input?.budgetLimit ?? null, { startTime, endTime }),
    ])

    const snapshot: OpenAiUsageSnapshot = { usage, costs, quota }
    this.setCached(cacheKey, snapshot)
    return snapshot
  }

  async assertQuotaAvailable(input?: {
    budgetLimit?: number | null
    startTime?: number
    endTime?: number
  }) {
    const quota = await this.getRemainingQuota(input?.budgetLimit ?? null, input)
    if (quota.exceeded) {
      throw new ForbiddenException('Quota exceeded')
    }
    return quota
  }

  private async fetchAllPages<T>(
    path: string,
    params: Record<string, number | string | string[]>,
  ) {
    const buckets: Array<{ results?: T[] }> = []
    let nextPage: string | null = null

    do {
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            query.append(key, item)
          }
        } else {
          query.set(key, String(value))
        }
      }
      if (nextPage) {
        query.set('page', nextPage)
      }

      const response = await this.fetchJson<OpenAiPage<T>>(
        `https://api.openai.com/v1${path}?${query.toString()}`,
      )
      buckets.push(...(Array.isArray(response.data) ? response.data : []))
      nextPage = response.has_more ? response.next_page ?? null : null
    } while (nextPage)

    return buckets
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const apiKey = await this.resolveApiKey()
    if (!apiKey) {
      throw new Error('openai_usage_api_key_missing')
    }

    let attempt = 0
    for (;;) {
      const controller = new AbortController()
      const timeout = setTimeout(
        () => controller.abort(),
        OpenAiUsageService.REQUEST_TIMEOUT_MS,
      )
      try {
        const response = await fetch(url, {
          headers: this.buildHeaders(apiKey),
          signal: controller.signal,
        })

        if (!response.ok) {
          const body = await response.text()
          if (
            response.status === 429 &&
            attempt < OpenAiUsageService.MAX_RETRIES
          ) {
            attempt += 1
            await this.delay(250 * attempt)
            continue
          }
          throw new Error(`openai_usage_http_${response.status}:${body}`)
        }

        return (await response.json()) as T
      } catch (error) {
        if (
          attempt < OpenAiUsageService.MAX_RETRIES &&
          this.isRetryableMonitoringError(error)
        ) {
          attempt += 1
          await this.delay(250 * attempt)
          continue
        }
        throw error
      } finally {
        clearTimeout(timeout)
      }
    }
  }

  private async resolveApiKey() {
    const adminKey =
      this.config.get<string>('OPENAI_ADMIN_KEY')?.trim() || null
    if (adminKey) {
      return adminKey
    }

    const runtimeConfig = await this.getRuntimeConfig()
    if (runtimeConfig.openAiApiKey?.trim()) {
      return runtimeConfig.openAiApiKey.trim()
    }

    return this.config.get<string>('OPENAI_API_KEY')?.trim() || null
  }

  private buildHeaders(apiKey: string) {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
    }
    const organization = this.config.get<string>('OPENAI_ORGANIZATION_ID')?.trim()
    const project = this.config.get<string>('OPENAI_PROJECT_ID')?.trim()
    if (organization) {
      headers['OpenAI-Organization'] = organization
    }
    if (project) {
      headers['OpenAI-Project'] = project
    }
    return headers
  }

  private async resolveBudgetLimit() {
    const fromEnv = this.readNumber('MONTHLY_BUDGET_USD')
    if (fromEnv != null) {
      return fromEnv
    }
    const legacyEnv = this.readNumber('AI_MONTHLY_SPENDING_LIMIT_USD')
    if (legacyEnv != null) {
      return legacyEnv
    }
    const runtimeConfig = await this.getRuntimeConfig()
    return runtimeConfig.monthlySpendingLimitUsd ?? null
  }

  private async getRuntimeConfig(): Promise<RuntimeConfigShape> {
    const stored =
      (await this.secureConfig.getJson<RuntimeConfigShape>(AiService.AI_RUNTIME_CONFIG_KEY))
        ?.value ?? null
    return stored ?? {}
  }

  private resolveRange(input?: { startTime?: number; endTime?: number }) {
    const endTime =
      typeof input?.endTime === 'number' && Number.isFinite(input.endTime)
        ? Math.floor(input.endTime)
        : Math.floor(Date.now() / 1000)
    const startTime =
      typeof input?.startTime === 'number' && Number.isFinite(input.startTime)
        ? Math.floor(input.startTime)
        : this.startOfCurrentMonthUtc()
    return { startTime, endTime }
  }

  private startOfCurrentMonthUtc() {
    const now = new Date()
    return Math.floor(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0) / 1000,
    )
  }

  private readNumber(key: string) {
    const raw = this.config.get<string>(key)
    if (!raw) {
      return null
    }
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : null
  }

  private safeNumber(value: unknown) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }

  private isRetryableMonitoringError(error: unknown) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase()
    return (
      message.includes('429') ||
      message.includes('rate limit') ||
      message.includes('timed out') ||
      message.includes('abort') ||
      message.includes('timeout')
    )
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private getCached<T>(key: string): T | null {
    const hit = this.cache.get(key)
    if (!hit || hit.expiresAt < Date.now()) {
      if (hit) {
        this.cache.delete(key)
      }
      return null
    }
    return structuredClone(hit.value as T)
  }

  private setCached(
    key: string,
    value: OpenAiUsageSummary | OpenAiCostsSummary | OpenAiQuotaSummary | OpenAiUsageSnapshot,
  ) {
    this.cache.set(key, {
      expiresAt: Date.now() + OpenAiUsageService.CACHE_TTL_MS,
      value: structuredClone(value),
    })
  }
}

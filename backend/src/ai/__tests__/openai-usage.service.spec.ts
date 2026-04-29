import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ForbiddenException } from '@nestjs/common'
import { OpenAiUsageService } from '../openai-usage.service'

describe('OpenAiUsageService', () => {
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'OPENAI_ADMIN_KEY') return 'admin-test-key'
      if (key === 'MONTHLY_BUDGET_USD') return '25'
      return undefined
    }),
  }

  const secureConfig = {
    getJson: vi.fn(async () => null),
  }
  const openAiClient = {
    requestJson: vi.fn(),
    resolveOpenAiApiKey: vi.fn(),
    buildHeaders: vi.fn(),
  }

  let service: OpenAiUsageService

  beforeEach(() => {
    vi.restoreAllMocks()
    openAiClient.requestJson.mockReset()
    openAiClient.resolveOpenAiApiKey.mockReset()
    openAiClient.buildHeaders.mockReset()
    service = new OpenAiUsageService(
      config as never,
      secureConfig as never,
      openAiClient as never,
    )
  })

  it('aggregates usage tokens and requests from organization usage buckets', async () => {
    openAiClient.requestJson.mockResolvedValue({
      data: [
        {
          results: [
            {
              input_tokens: 100,
              output_tokens: 40,
              input_cached_tokens: 10,
              input_audio_tokens: 0,
              output_audio_tokens: 0,
              num_model_requests: 2,
            },
          ],
        },
        {
          results: [
            {
              input_tokens: 30,
              output_tokens: 20,
              num_model_requests: 1,
            },
          ],
        },
      ],
      has_more: false,
      next_page: null,
    })

    const usage = await service.getUsage(1, 2)

    expect(usage.total_tokens).toBe(200)
    expect(usage.total_requests).toBe(3)
    expect(usage.source).toBe('openai')
  })

  it('aggregates costs and remaining quota from organization costs', async () => {
    openAiClient.requestJson.mockResolvedValue({
      data: [
        {
          results: [
            {
              amount: {
                value: 4.5,
                currency: 'usd',
              },
            },
            {
              amount: {
                value: 1.25,
                currency: 'usd',
              },
            },
          ],
        },
      ],
      has_more: false,
      next_page: null,
    })

    const costs = await service.getCosts(1, 2)
    const quota = await service.getRemainingQuota(10, { startTime: 1, endTime: 2 })

    expect(costs.total_spent).toBe(5.75)
    expect(quota.total_spent).toBe(5.75)
    expect(quota.remaining).toBe(4.25)
    expect(quota.exceeded).toBe(false)
  })

  it('falls back to runtime-config usage when costs endpoint fails', async () => {
    secureConfig.getJson.mockResolvedValueOnce({
      value: {
        currentUsageUsd: 9.5,
      },
    } as any)
    openAiClient.requestJson.mockRejectedValue(new Error('openai_http_500:boom'))

    const costs = await service.getCosts(1, 2)
    const quota = await service.getRemainingQuota(10, { startTime: 1, endTime: 2 })

    expect(costs.source).toBe('fallback')
    expect(costs.total_spent).toBe(9.5)
    expect(quota.source).toBe('fallback')
    expect(quota.exceeded).toBe(false)
  })

  it('throws when quota is exceeded', async () => {
    openAiClient.requestJson.mockResolvedValue({
      data: [
        {
          results: [
            {
              amount: {
                value: 15,
                currency: 'usd',
              },
            },
          ],
        },
      ],
      has_more: false,
      next_page: null,
    })

    await expect(
      service.assertQuotaAvailable({ budgetLimit: 10, startTime: 1, endTime: 2 }),
    ).rejects.toBeInstanceOf(ForbiddenException)
  })
})

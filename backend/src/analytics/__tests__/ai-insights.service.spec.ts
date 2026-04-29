import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalyticsAiInsightsService } from '../ai-insights.service'

describe('AnalyticsAiInsightsService', () => {
  const openAiClient = {
    resolveRuntimeConfig: vi.fn(async () => ({
      enabled: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      openAiApiKey: 'db-test-key',
    })),
    requestJson: vi.fn(),
  }

  let service: AnalyticsAiInsightsService

  const bundle = {
    timeRange: {
      current: { from: '2026-04-01', to: '2026-04-07' },
      previous: { from: '2026-03-25', to: '2026-03-31' },
    },
    kpis: {
      revenue: { current: 1200, previous: 1000, delta: 200, deltaPct: 20 },
      orders: { current: 18, previous: 16, delta: 2, deltaPct: 12.5 },
      conversionRate: { current: 0.9, previous: 1.2, delta: -0.3, deltaPct: -25 },
      cac: null,
      roas: { current: 1.8, previous: 2.1, delta: -0.3, deltaPct: -14.3 },
    },
    funnel: {
      view_item: 300,
      add_to_cart: 80,
      begin_checkout: 22,
      purchase: 18,
      rates: {
        viewToCart: 0.2667,
        cartToCheckout: 0.275,
        checkoutToPurchase: 0.8182,
      },
    },
    acquisition: [],
    seo: [],
    products: [],
    detectedPatterns: [
      {
        type: 'high_traffic_low_conversion',
        severity: 'high',
        category: 'measurement_issue',
        source: 'ga4',
        evidence: { segment: 'mobile' },
      },
    ],
    dataQuality: {
      status: 'warning',
      confidence: 0.72,
      reasons: ['baseline gap'],
    },
    measurement: {
      conversionMeasurementReady: false,
      adsConversionMeasurementReady: false,
      qualityStatus: 'warning',
      reasons: ['conversion gap'],
    },
  } as never

  beforeEach(() => {
    vi.restoreAllMocks()
    openAiClient.resolveRuntimeConfig.mockClear()
    openAiClient.requestJson.mockClear()
    service = new AnalyticsAiInsightsService(openAiClient as never)
  })

  it('normalizes the chat/completions JSON shape returned by the model', async () => {
    openAiClient.requestJson.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              summary: {
                currentPeriod: {
                  sessions: 300,
                  revenue: 1200,
                  conversionRate: 0.9,
                },
                previousPeriod: {
                  sessions: 240,
                  revenue: 1000,
                  conversionRate: 1.2,
                },
                trafficChange: 'El tráfico creció, pero la conversión cayó.',
                dataQuality: 'warning',
              },
              insights: [
                {
                  type: 'conversion',
                  title: 'Tráfico alto con conversión baja',
                  description: 'El volumen subió pero la tasa de conversión bajó.',
                  evidence: {
                    segment: 'mobile',
                    metric: 'conversionRate',
                  },
                  impact: 'high',
                  confidence: 0.81,
                  recommendation: 'Revisar checkout en mobile',
                },
              ],
              prioritized_actions: [
                {
                  action: 'Validar medición de conversiones',
                  reason: 'La señal depende de un gate no validado.',
                  expected_impact: 'high',
                  priority: 'high',
                  confidence: 0.73,
                },
              ],
            }),
          },
        },
      ],
    })

    const result = await service.generateDecision(bundle)

    expect(result.summary).toContain('Período actual')
    expect(result.summary).toContain('El tráfico creció, pero la conversión cayó.')
    expect(result.insights).toHaveLength(1)
    expect(result.insights[0]).toMatchObject({
      title: 'Tráfico alto con conversión baja',
      source: 'mixed',
      category: 'measurement_issue',
      impact: 'high',
      confidence: 0.81,
      recommendation: 'Revisar checkout en mobile',
    })
    expect(result.insights[0].metric).toBe('conversionRate')
    expect(result.insights[0].segment).toBe('mobile')
    expect(result.prioritized_actions).toHaveLength(1)
    expect(result.prioritized_actions[0]).toMatchObject({
      action: 'Validar medición de conversiones',
      expected_impact: 'high',
      priority: 1,
      confidence: 0.73,
    })
  })
})

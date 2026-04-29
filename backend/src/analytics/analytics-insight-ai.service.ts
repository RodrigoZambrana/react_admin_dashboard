import { Injectable } from '@nestjs/common'

import type { AnalyticsAiDecisionOutput, AnalyticsInsightBundle } from './analytics.types'
import { AnalyticsAiInsightsService } from './ai-insights.service'

@Injectable()
export class AnalyticsInsightAiService {
  constructor(private readonly analyticsAiInsightsService: AnalyticsAiInsightsService) {}

  async generateDecision(bundle: AnalyticsInsightBundle): Promise<AnalyticsAiDecisionOutput> {
    const decision = await this.analyticsAiInsightsService.generateDecision(bundle)
    const trustStatus = bundle.trust?.status ?? 'ok'
    const trustCap = trustStatus === 'fail' ? 0.35 : trustStatus === 'warning' ? 0.65 : 1
    const cappedConfidence = Math.min(decision.confidence ?? trustCap, trustCap)
    const generationReason =
      trustStatus === 'fail'
        ? 'La IA fue degradada por una señal de data trust insuficiente.'
        : trustStatus === 'warning'
          ? 'La IA fue moderada por una señal de data trust parcial.'
          : decision.generationReason ?? null

    if (decision.confidence === cappedConfidence && decision.generationReason === generationReason) {
      return decision
    }

    return {
      ...decision,
      confidence: Number(cappedConfidence.toFixed(4)),
      generationReason,
    }
  }
}

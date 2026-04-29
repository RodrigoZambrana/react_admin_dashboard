import { Injectable } from '@nestjs/common'
import {
  OpenAiClientService,
  type OpenAiRuntimeConfig,
} from '../common/openai/openai-client.service'
import { ANALYTICS_AI_SYSTEM_PROMPT } from './analytics-ai-prompt'
import type {
  AnalyticsAiDecisionOutput,
  AnalyticsInsightBundle,
  AnalyticsInsightCategory,
  AnalyticsInsightPriority,
  AnalyticsInsightSource,
  AnalyticsInsightType,
  AnalyticsMeasurementGate,
  AnalyticsSourceQuality,
} from './analytics.types'

const CATEGORY_PRIORITY: Record<AnalyticsInsightCategory, number> = {
  business_issue: 3,
  measurement_issue: 2,
  low_confidence_signal: 1,
}

const IMPACT_PRIORITY: Record<AnalyticsInsightPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
}

const DEFAULT_SOURCE: AnalyticsInsightSource = 'mixed'
type ReportSource = Exclude<AnalyticsInsightSource, 'mixed'>

@Injectable()
export class AnalyticsAiInsightsService {
  constructor(private readonly openAiClient: OpenAiClientService) {}

  async generateDecision(bundle: AnalyticsInsightBundle): Promise<AnalyticsAiDecisionOutput> {
    const runtime = await this.openAiClient.resolveRuntimeConfig()
    if (runtime.enabled !== false && runtime.provider === 'openai' && runtime.openAiApiKey) {
      try {
        const decision = await this.requestOpenAiDecision(bundle, runtime)
        return {
          ...this.normalizeDecision(decision, bundle),
          generatedBy: 'ai',
          generationReason: 'Síntesis generada por el modelo de IA a partir del bundle semántico.',
        }
      } catch (error) {
        return this.fallbackDecision(bundle)
      }
    }

    return this.fallbackDecision(bundle)
  }

  private async requestOpenAiDecision(
    bundle: AnalyticsInsightBundle,
    runtime: OpenAiRuntimeConfig,
  ) {
    const payload = await this.openAiClient.requestJson<{
      choices?: Array<{
        message?: {
          content?: string | Array<{ text?: string; type?: string; content?: string }>
        }
      }>
    }>('/chat/completions', {
      apiKey: runtime.openAiApiKey,
      timeoutMs: 25_000,
      body: {
        model: runtime.model || 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
            {
              role: 'system',
              content: ANALYTICS_AI_SYSTEM_PROMPT,
            },
          {
            role: 'user',
            content: JSON.stringify(bundle),
          },
        ],
      },
    })

    const firstChoice = Array.isArray(payload.choices) ? payload.choices[0] ?? null : null
    const rawContent = firstChoice?.message?.content
    const rawText = Array.isArray(rawContent)
      ? rawContent
          .map((entry) => {
            if (typeof entry === 'string') {
              return entry
            }
            if (entry && typeof entry === 'object') {
              if (typeof entry.text === 'string') return entry.text
              if (typeof entry.content === 'string') return entry.content
            }
            return ''
          })
          .join(' ')
          .trim()
      : String(rawContent ?? '').trim()

    if (!rawText) {
      throw new Error('openai_analytics_decision_empty_output')
    }

    return JSON.parse(rawText) as unknown
  }

  private normalizeDecision(
    decision: unknown,
    bundle: AnalyticsInsightBundle,
  ): AnalyticsAiDecisionOutput {
    const insights = this.extractArray(decision, 'insights')
      .map((insight) => this.normalizeInsight(insight, bundle))
      .filter((insight): insight is AnalyticsAiDecisionOutput['insights'][number] => insight !== null)
      .sort((left, right) => {
        const leftScore =
          CATEGORY_PRIORITY[left.category] * 2 + IMPACT_PRIORITY[left.impact] + left.confidence
        const rightScore =
          CATEGORY_PRIORITY[right.category] * 2 + IMPACT_PRIORITY[right.impact] + right.confidence
        return rightScore - leftScore
      })
    const prioritizedActions = this.extractArray(decision, 'prioritized_actions')
      .map((action, index) => this.normalizeAction(action, bundle, index))
      .filter((action): action is AnalyticsAiDecisionOutput['prioritized_actions'][number] => action !== null)
    const qualityBySource =
      this.normalizeQualityBySource(this.extractArray(decision, 'quality_by_source'), bundle) ??
      this.buildQualityBySource(bundle)
    const confidence = this.resolveDecisionConfidence(decision, bundle, insights, prioritizedActions, qualityBySource)

    return {
      summary: this.normalizeSummary(this.extractValue(decision, 'summary'), bundle, decision, insights),
      insights,
      prioritized_actions: prioritizedActions.sort((left, right) => left.priority - right.priority),
      quality_by_source: qualityBySource,
      confidence,
    }
  }

  private fallbackDecision(
    bundle: AnalyticsInsightBundle,
  ): AnalyticsAiDecisionOutput {
    const topPattern = bundle.detectedPatterns[0] ?? null
    const fallbackInsights = topPattern
      ? [
          {
            title: this.patternTitle(topPattern.type),
            what_happened: `Se detectó ${topPattern.type} en el período comparado.`,
            why_it_matters: 'Afecta la priorización del análisis y puede indicar una fuga de valor o una señal de medición.',
            category: topPattern.category,
            source: topPattern.source,
            insight_type: this.inferInsightType(topPattern.type) as AnalyticsInsightType | undefined,
            metric: this.patternMetric(topPattern.type),
            segment: this.patternSegment(topPattern.evidence),
            source_report: this.patternSource(topPattern.type),
            evidence: topPattern.evidence,
            impact: (topPattern.severity === 'high'
              ? 'high'
              : topPattern.severity === 'medium'
                ? 'medium'
                : 'low') as AnalyticsInsightPriority,
            confidence: this.bundleConfidence(bundle),
            recommendation: this.recommendationFromPattern(topPattern.type, bundle.measurement),
          },
        ]
      : []
    const baseSummary = this.buildExecutiveSummary(bundle, fallbackInsights)

    return {
      ...this.normalizeDecision(
      {
        summary: baseSummary,
        insights: fallbackInsights,
        prioritized_actions: topPattern
          ? [
              {
                action: this.recommendationFromPattern(topPattern.type, bundle.measurement),
                reason: 'Se prioriza la señal más fuerte disponible en el bundle.',
                expected_impact: topPattern.severity === 'high' ? 'high' : 'medium',
                priority: 1,
                confidence: this.bundleConfidence(bundle),
              },
            ]
          : [
              {
                action: 'Revisar calidad de datos y validar la cobertura de la medición',
                reason: 'No hay patrones suficientemente fuertes para una decisión de negocio agresiva.',
                expected_impact: 'medium',
                priority: 1,
                confidence: this.bundleConfidence(bundle),
              },
        ],
        quality_by_source: this.buildQualityBySource(bundle),
      },
      bundle,
      ),
      generatedBy: 'fallback',
      generationReason: bundle.measurement.conversionMeasurementReady
        ? 'Se usó fallback por indisponibilidad temporal de la síntesis IA.'
        : 'Se usó fallback conservador porque la medición todavía no está validada.',
    }
  }

  private normalizeSummary(
    summary: unknown,
    bundle: AnalyticsInsightBundle,
    rawDecision?: unknown,
    insights: AnalyticsAiDecisionOutput['insights'] = [],
  ) {
    const text = this.normalizeText(summary)
    if (text) {
      if (this.shouldRewriteExecutiveSummary(text)) {
        const executiveText = this.buildExecutiveSummary(bundle, insights)
        if (executiveText) {
          return executiveText
        }
      }
      const executiveText = this.cleanExecutiveSummary(text)
      if (executiveText) {
        return executiveText
      }
    }

    const nestedText = this.normalizeText(this.extractValue(summary, 'text'))
      ?? this.normalizeText(this.extractValue(summary, 'description'))
      ?? this.normalizeText(this.extractValue(summary, 'message'))
    if (nestedText) {
      if (this.shouldRewriteExecutiveSummary(nestedText)) {
        const executiveText = this.buildExecutiveSummary(bundle, insights)
        if (executiveText) {
          return executiveText
        }
      }
      const executiveText = this.cleanExecutiveSummary(nestedText)
      if (executiveText) {
        return executiveText
      }
    }

    const currentPeriod = this.extractValue(summary, 'currentPeriod') ?? this.extractValue(summary, 'current')
    const previousPeriod = this.extractValue(summary, 'previousPeriod') ?? this.extractValue(summary, 'previous')
    const trafficChange = this.normalizeText(this.extractValue(summary, 'trafficChange'))
    const dataQuality = this.normalizeText(this.extractValue(summary, 'dataQuality'))

    const pieces: string[] = []
    const currentText = this.formatPeriodSummary('Período actual', currentPeriod)
    const previousText = this.formatPeriodSummary('Período previo', previousPeriod)
    if (currentText) pieces.push(currentText)
    if (previousText) pieces.push(previousText)
    if (trafficChange) pieces.push(this.cleanExecutiveSummary(trafficChange) ?? trafficChange)
    if (dataQuality) pieces.push(`Calidad de datos: ${this.cleanExecutiveSummary(dataQuality) ?? dataQuality}.`)

    if (pieces.length > 0) {
      return pieces.join(' ').replace(/\s+/g, ' ').trim()
    }

    const rawText = this.normalizeText(this.extractValue(rawDecision, 'summaryText'))
    if (rawText) {
      if (this.shouldRewriteExecutiveSummary(rawText)) {
        const executiveText = this.buildExecutiveSummary(bundle, insights)
        if (executiveText) {
          return executiveText
        }
      }
      const executiveText = this.cleanExecutiveSummary(rawText)
      if (executiveText) {
        return executiveText
      }
    }

    const executiveFallback = this.buildExecutiveSummary(bundle, insights)
    if (executiveFallback) {
      return executiveFallback
    }

    if (bundle.dataQuality.status === 'error') {
      return 'La confianza del análisis es baja porque la calidad de datos no está resuelta; antes de tomar decisiones agresivas hay que validar la señal.'
    }
    return 'La IA no pudo sintetizar un resumen confiable y se debe revisar la disponibilidad del modelo.'
  }

  private normalizeInsight(
    insight: unknown,
    bundle: AnalyticsInsightBundle,
  ): AnalyticsAiDecisionOutput['insights'][number] | null {
    const title =
      this.normalizeText(this.extractValue(insight, 'title')) ??
      this.normalizeText(this.extractValue(insight, 'name')) ??
      this.patternTitle(String(this.extractValue(insight, 'type') ?? ''))

    const whatHappened =
      this.normalizeText(this.extractValue(insight, 'what_happened')) ??
      this.normalizeText(this.extractValue(insight, 'description')) ??
      this.normalizeText(this.extractValue(insight, 'summary')) ??
      this.normalizeText(this.extractValue(insight, 'details')) ??
      ''

    const whyItMatters =
      this.normalizeText(this.extractValue(insight, 'why_it_matters')) ??
      this.normalizeText(this.extractValue(insight, 'reason')) ??
      this.normalizeText(this.extractValue(insight, 'impact_reason')) ??
      whatHappened

    const evidence = this.extractRecord(insight, 'evidence')
    const segment =
      this.normalizeText(this.extractValue(insight, 'segment')) ??
      this.normalizeText(evidence?.segment) ??
      null

    const category = this.normalizeCategory(
      this.extractValue(insight, 'category') ?? this.extractValue(insight, 'type'),
      bundle,
    )
    const source = this.normalizeSource(this.extractValue(insight, 'source'))
    const insightType = this.normalizeInsightType(
      this.extractValue(insight, 'insight_type') ?? this.extractValue(insight, 'type'),
    )
    const impact = this.normalizeImpact(
      this.extractValue(insight, 'impact') ?? this.extractValue(insight, 'severity'),
    )
    const confidence = this.normalizeConfidence(this.extractValue(insight, 'confidence'), bundle)
    const recommendation =
      this.normalizeText(this.extractValue(insight, 'recommendation')) ??
      this.normalizeText(this.extractValue(insight, 'recommended_action')) ??
      this.normalizeText(this.extractValue(insight, 'action')) ??
      ''
    const page =
      this.normalizeText(this.extractValue(insight, 'page')) ??
      this.inferSeoPage(insight, bundle)
    const pageReason =
      this.normalizeText(this.extractValue(insight, 'page_reason')) ??
      this.inferSeoPageReason(insight, bundle)
    const contentToInclude =
      this.normalizeText(this.extractValue(insight, 'content_to_include')) ??
      this.inferSeoContent(insight, bundle)
    const expectedResult =
      this.normalizeText(this.extractValue(insight, 'expected_result')) ??
      this.inferSeoExpectedResult(insight, bundle)

    if (!title && !whatHappened && !recommendation) {
      return null
    }

    const sourceReport =
      this.normalizeText(this.extractValue(insight, 'source_report')) ??
      this.normalizeText(this.extractValue(insight, 'sourceReport')) ??
      null

    return {
      title: this.cleanInsightText(title, {
        category,
        source,
        metric:
          this.normalizeText(this.extractValue(insight, 'metric')) ??
          this.normalizeText(evidence?.metric) ??
          null,
        field: 'title',
        sourceReport,
      }),
      what_happened: this.cleanInsightText(whatHappened, {
        category,
        source,
        metric:
          this.normalizeText(this.extractValue(insight, 'metric')) ??
          this.normalizeText(evidence?.metric) ??
          null,
        field: 'what_happened',
        sourceReport,
      }),
      why_it_matters: this.cleanInsightText(whyItMatters, {
        category,
        source,
        metric:
          this.normalizeText(this.extractValue(insight, 'metric')) ??
          this.normalizeText(evidence?.metric) ??
          null,
        field: 'why_it_matters',
        sourceReport,
      }),
      category,
      source,
      insight_type: insightType,
      metric:
        this.normalizeText(this.extractValue(insight, 'metric')) ??
        this.normalizeText(evidence?.metric) ??
        null,
      segment,
      source_report: sourceReport,
      page,
      page_reason: pageReason,
      content_to_include: contentToInclude,
      expected_result: expectedResult,
      evidence: evidence ?? {},
      impact,
      confidence,
      recommendation: this.cleanInsightText(recommendation, {
        category,
        source,
        metric:
          this.normalizeText(this.extractValue(insight, 'metric')) ??
          this.normalizeText(evidence?.metric) ??
          null,
        field: 'recommendation',
        sourceReport,
      }),
    }
  }

  private normalizeAction(
    action: unknown,
    bundle: AnalyticsInsightBundle,
    index: number,
  ): AnalyticsAiDecisionOutput['prioritized_actions'][number] | null {
    const actionText =
      this.normalizeText(this.extractValue(action, 'action')) ??
      this.normalizeText(this.extractValue(action, 'title')) ??
      this.normalizeText(this.extractValue(action, 'recommended_action')) ??
      'Revisar el insight principal'

    const reason =
      this.normalizeText(this.extractValue(action, 'reason')) ??
      this.normalizeText(this.extractValue(action, 'why')) ??
      this.normalizeText(this.extractValue(action, 'description')) ??
      ''

    const expectedImpact = this.normalizeImpact(
      this.extractValue(action, 'expected_impact') ??
        this.extractValue(action, 'impact') ??
        this.extractValue(action, 'severity'),
    )

    const priority = this.normalizePriority(this.extractValue(action, 'priority'), index)
    const confidence = this.normalizeConfidence(this.extractValue(action, 'confidence'), bundle)

    if (!actionText && !reason) {
      return null
    }

    return {
      action: this.cleanExecutiveSummary(actionText) ?? actionText,
      reason: this.cleanExecutiveSummary(reason) ?? reason,
      expected_impact: expectedImpact,
      priority,
      confidence,
    }
  }

  private normalizeText(value: unknown) {
    if (typeof value !== 'string') {
      return null
    }
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }

  private extractValue(source: unknown, key: string): unknown {
    const record = this.asRecord(source)
    return record ? record[key] : undefined
  }

  private extractRecord(source: unknown, key: string): Record<string, unknown> | null {
    const value = this.extractValue(source, key)
    return this.asRecord(value)
  }

  private extractArray(source: unknown, key: string): unknown[] {
    const value = this.extractValue(source, key)
    return Array.isArray(value) ? value : []
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null
    }
    return value as Record<string, unknown>
  }

  private normalizeCategory(
    value: unknown,
    bundle: AnalyticsInsightBundle,
  ): AnalyticsInsightCategory {
    if (value === 'business_issue' || value === 'measurement_issue' || value === 'low_confidence_signal') {
      return value
    }
    if (bundle.measurement.conversionMeasurementReady === false) {
      return 'measurement_issue'
    }
    return 'low_confidence_signal'
  }

  private normalizeSource(value: unknown): AnalyticsInsightSource {
    return value === 'ga4' || value === 'ads' || value === 'search_console' || value === 'meta' || value === 'mixed'
      ? value
      : DEFAULT_SOURCE
  }

  private normalizeImpact(value: unknown): AnalyticsInsightPriority {
    if (value === 'high' || value === 'medium' || value === 'low') {
      return value
    }
    if (value === 'critical') {
      return 'high'
    }
    return 'low'
  }

  private normalizeInsightType(value: unknown): AnalyticsInsightType | undefined {
    return value === 'summary' ||
      value === 'acquisition' ||
      value === 'behavior' ||
      value === 'conversion' ||
      value === 'revenue' ||
      value === 'data_quality'
      ? value
      : undefined
  }

  private normalizePriority(value: unknown, index: number) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.max(1, Math.trunc(value))
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'high') return 1
      if (normalized === 'medium') return 2
      if (normalized === 'low') return 3
      const parsed = Number(normalized)
      if (Number.isFinite(parsed)) {
        return Math.max(1, Math.trunc(parsed))
      }
    }
    return index + 1
  }

  private normalizeQualityBySource(
    value: unknown[],
    bundle: AnalyticsInsightBundle,
  ): AnalyticsSourceQuality[] | null {
    if (!Array.isArray(value) || value.length === 0) {
      return null
    }

    const normalized = value
      .map((entry) => {
        const source = this.normalizeSource(this.extractValue(entry, 'source'))
        if (source === 'mixed') {
          return null
        }
        const reportSource = source as ReportSource
        const status = this.normalizeSourceQualityStatus(this.extractValue(entry, 'status'))
        const confidence = this.normalizeConfidence(this.extractValue(entry, 'confidence'), bundle)
        const issues = this.extractArray(entry, 'issues')
          .map((issue) => this.normalizeText(issue))
          .filter((issue): issue is string => Boolean(issue))
        const summary =
          this.normalizeText(this.extractValue(entry, 'summary')) ??
          this.sourceQualitySummary(reportSource, status, bundle)
        return {
          source: reportSource,
          status,
          confidence,
          issues,
          summary,
        }
      })
      .filter((entry): entry is AnalyticsSourceQuality => entry !== null)

    return normalized.length ? normalized : null
  }

  private buildQualityBySource(bundle: AnalyticsInsightBundle): AnalyticsSourceQuality[] {
    const sources: ReportSource[] = ['ga4', 'ads', 'search_console', 'meta']
    return sources.map((source) => {
      if (source === 'ga4') {
        const status = bundle.measurement.conversionMeasurementReady
          ? 'ok'
          : bundle.measurement.qualityStatus === 'error'
            ? 'error'
            : 'warning'
        return {
          source,
          status,
          confidence: this.bundleConfidence(bundle),
          issues: bundle.measurement.reasons.filter((reason) =>
            /GA4|reconciliación|baseline|medición|quality/iu.test(reason),
          ),
          summary: this.sourceQualitySummary(source, status, bundle),
        }
      }

      if (source === 'ads') {
        const status = bundle.measurement.adsConversionMeasurementReady
          ? 'ok'
          : bundle.measurement.conversionMeasurementReady
            ? 'warning'
            : 'error'
        return {
          source,
          status,
          confidence: bundle.measurement.adsConversionMeasurementReady
            ? this.bundleConfidence(bundle)
            : Math.max(0.25, this.bundleConfidence(bundle) - 0.2),
          issues: bundle.measurement.reasons.filter((reason) =>
            /Ads|Google Ads|conversion/i.test(reason),
          ),
          summary: this.sourceQualitySummary(source, status, bundle),
        }
      }

      if (source === 'meta') {
        const metaSignal =
          bundle.meta_ads.spend > 0 || bundle.meta_ads.clicks > 0 || bundle.meta_ads.impressions > 0
        const status = metaSignal
          ? bundle.measurement.metaConversionMeasurementReady
            ? 'ok'
            : bundle.measurement.conversionMeasurementReady
              ? 'warning'
              : 'error'
          : 'warning'
        return {
          source,
          status,
          confidence: metaSignal ? this.bundleConfidence(bundle) : Math.max(0.2, this.bundleConfidence(bundle) - 0.25),
          issues: bundle.measurement.reasons.filter((reason) => /Meta|pixel|capi|fbp|fbc|match/iu.test(reason)),
          summary: this.sourceQualitySummary(source, status, bundle),
        }
      }

      const searchQualityIssue =
        bundle.seo.length === 0 ||
        bundle.seo.every((item) => item.impressions <= 0) ||
        bundle.seo.every((item) => item.ctr < 0.01)
      const status = searchQualityIssue
        ? bundle.dataQuality.status === 'error'
          ? 'error'
          : 'warning'
        : 'ok'
      return {
        source,
        status,
        confidence: searchQualityIssue ? Math.max(0.3, bundle.dataQuality.confidence - 0.1) : bundle.dataQuality.confidence,
        issues: searchQualityIssue
          ? ['Las consultas no muestran aún una señal clara de posicionamiento o CTR defendible.']
          : [],
        summary: this.sourceQualitySummary(source, status, bundle),
      }
    })
  }

  private normalizeSourceQualityStatus(value: unknown): AnalyticsSourceQuality['status'] {
    return value === 'ok' || value === 'warning' || value === 'error' ? value : 'warning'
  }

  private sourceQualitySummary(
    source: ReportSource,
    status: AnalyticsSourceQuality['status'],
    bundle: AnalyticsInsightBundle,
  ) {
    const ready = status === 'ok'
    switch (source) {
      case 'ga4':
        return ready
          ? 'GA4 muestra señal suficiente para analizar negocio y priorizar oportunidades.'
          : 'GA4 todavía no da una señal estable para conclusiones fuertes; conviene validar medición y reconciliación.'
      case 'ads':
        return ready
          ? 'Ads tiene cobertura suficiente para evaluar inversión y eficiencia.'
          : 'Ads todavía no tiene medición lista para concluir pérdida confirmada; la lectura sigue siendo cauta.'
      case 'search_console':
        return ready
          ? 'Search Console muestra oportunidades claras para acciones SEO concretas.'
          : bundle.seo.length
            ? 'Search Console tiene señal parcial; hay oportunidades, pero todavía faltan páginas o CTR más sólidos.'
            : 'Search Console no muestra todavía una señal SEO defendible en la ventana analizada.'
      case 'meta':
        return ready
          ? 'Meta tiene señal suficiente para remarketing, exclusión y lectura de performance.'
          : bundle.meta_ads.spend > 0 || bundle.meta_ads.clicks > 0
            ? 'Meta ya aporta tráfico o gasto, pero todavía falta calidad de match o medición para conclusiones fuertes.'
            : 'Meta todavía no aporta una señal útil en la ventana analizada.'
      default:
        return 'Calidad de fuente no determinada.'
    }
  }

  private inferSeoPage(insight: unknown, bundle: AnalyticsInsightBundle) {
    const source = this.normalizeSource(this.extractValue(insight, 'source'))
    const sourceReport = this.normalizeText(this.extractValue(insight, 'source_report'))
    if (source !== 'search_console' && sourceReport !== 'analytics_search_console_daily_metrics') {
      return null
    }

    const segment =
      this.normalizeText(this.extractValue(insight, 'segment')) ??
      this.normalizeText(this.extractValue(insight, 'title'))
    if (!segment) {
      return 'Landing SEO dedicada'
    }
    return `Landing SEO para ${segment}`
  }

  private inferSeoPageReason(insight: unknown, bundle: AnalyticsInsightBundle) {
    const source = this.normalizeSource(this.extractValue(insight, 'source'))
    const sourceReport = this.normalizeText(this.extractValue(insight, 'source_report'))
    if (source !== 'search_console' && sourceReport !== 'analytics_search_console_daily_metrics') {
      return null
    }

    const segment =
      this.normalizeText(this.extractValue(insight, 'segment')) ??
      this.normalizeText(this.extractValue(insight, 'title')) ??
      'la consulta detectada'
    return `La demanda existe pero el CTR no está capturando suficiente clic sobre ${segment}.`
  }

  private inferSeoContent(insight: unknown, bundle: AnalyticsInsightBundle) {
    const source = this.normalizeSource(this.extractValue(insight, 'source'))
    const sourceReport = this.normalizeText(this.extractValue(insight, 'source_report'))
    if (source !== 'search_console' && sourceReport !== 'analytics_search_console_daily_metrics') {
      return null
    }

    return 'Título alineado con la consulta, meta description clara, propuesta de valor, respuesta directa a la intención, prueba social y llamada a la acción.'
  }

  private inferSeoExpectedResult(insight: unknown, bundle: AnalyticsInsightBundle) {
    const source = this.normalizeSource(this.extractValue(insight, 'source'))
    const sourceReport = this.normalizeText(this.extractValue(insight, 'source_report'))
    if (source !== 'search_console' && sourceReport !== 'analytics_search_console_daily_metrics') {
      return null
    }

    return 'Más clics orgánicos, mejor CTR y más sesiones calificadas sobre esa intención.'
  }

  private formatPeriodSummary(label: string, period: unknown) {
    const record = this.asRecord(period)
    if (!record) {
      return null
    }

    const sections: string[] = []
    const sessions = this.extractMetricValue(record, 'sessions')
    const revenue = this.extractMetricValue(record, 'revenue')
    const conversionRate = this.extractMetricValue(record, 'conversionRate')
    const orders = this.extractMetricValue(record, 'orders')
    const roas = this.extractMetricValue(record, 'roas')
    const ctr = this.extractMetricValue(record, 'ctr')

    if (sessions !== null) sections.push(`sesiones ${sessions}`)
    if (orders !== null) sections.push(`órdenes ${orders}`)
    if (revenue !== null) sections.push(`revenue ${revenue}`)
    if (conversionRate !== null) sections.push(`conversionRate ${conversionRate}`)
    if (roas !== null) sections.push(`roas ${roas}`)
    if (ctr !== null) sections.push(`ctr ${ctr}`)

    if (sections.length === 0) {
      return null
    }

    return `${label}: ${sections.join(', ')}.`
  }

  private extractMetricValue(record: Record<string, unknown>, key: string) {
    const value = record[key]
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Number(value.toFixed(4))
    }
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
    const nested = this.asRecord(value)
    if (nested) {
      const current = nested.current
      if (typeof current === 'number' && Number.isFinite(current)) {
        return Number(current.toFixed(4))
      }
      const previous = nested.previous
      if (typeof previous === 'number' && Number.isFinite(previous)) {
        return Number(previous.toFixed(4))
      }
    }
    return null
  }

  private normalizeConfidence(value: unknown, bundle: AnalyticsInsightBundle) {
    const raw =
      typeof value === 'number' && Number.isFinite(value) && value > 0
        ? value
        : this.bundleConfidence(bundle)
    return Math.max(0, Math.min(1, Number(raw.toFixed(4))))
  }

  private bundleConfidence(bundle: AnalyticsInsightBundle) {
    const quality = bundle.dataQuality.confidence
    const measurementPenalty = bundle.measurement.conversionMeasurementReady ? 0 : 0.22
    const trustPenalty =
      bundle.trust?.status === 'fail' ? 0.24 : bundle.trust?.status === 'warning' ? 0.12 : 0
    return Number(Math.max(0.05, Math.min(0.98, quality - measurementPenalty - trustPenalty)).toFixed(4))
  }

  private resolveDecisionConfidence(
    decision: unknown,
    bundle: AnalyticsInsightBundle,
    insights: AnalyticsAiDecisionOutput['insights'],
    prioritizedActions: AnalyticsAiDecisionOutput['prioritized_actions'],
    qualityBySource: AnalyticsSourceQuality[],
  ) {
    const rawConfidence = this.extractValue(decision, 'confidence')
    const decisionConfidence =
      typeof rawConfidence === 'number' && Number.isFinite(rawConfidence) && rawConfidence >= 0
        ? Math.min(1, Math.max(0, rawConfidence))
        : null
    const insightConfidence = insights.length
      ? insights.reduce((sum, insight) => sum + insight.confidence, 0) / insights.length
      : null
    const actionConfidence = prioritizedActions.length
      ? prioritizedActions.reduce((sum, action) => sum + action.confidence, 0) / prioritizedActions.length
      : null
    const sourceConfidence = qualityBySource.length
      ? qualityBySource.reduce((sum, item) => sum + item.confidence, 0) / qualityBySource.length
      : null

    const baseConfidence =
      decisionConfidence ??
      insightConfidence ??
      actionConfidence ??
      sourceConfidence ??
      this.bundleConfidence(bundle)

    const trustPenalty =
      bundle.trust?.status === 'fail' ? 0.3 : bundle.trust?.status === 'warning' ? 0.15 : 0
    return Number(Math.max(0.05, Math.min(1, baseConfidence - trustPenalty)).toFixed(4))
  }

  private buildExecutiveSummary(
    bundle: AnalyticsInsightBundle,
    insights: AnalyticsAiDecisionOutput['insights'] = [],
  ) {
    const topInsight = insights[0] ?? null
    const businessInsight =
      insights.find((item) => item.category === 'business_issue' && item.insight_type !== 'data_quality') ??
      insights.find((item) => item.insight_type === 'acquisition' || item.insight_type === 'conversion' || item.insight_type === 'revenue') ??
      null

    const pieces: string[] = []
    if (bundle.measurement.conversionMeasurementReady) {
      pieces.push('La señal de negocio está lista para tomar decisiones.')
    } else {
      pieces.push('La lectura del negocio todavía depende de una medición que no está validada.')
    }

    if (topInsight) {
      pieces.push(`La prioridad inmediata es ${this.executiveInsightPhrase(topInsight)}.`)
    }

    if (businessInsight && businessInsight !== topInsight) {
      pieces.push(`La mejor oportunidad visible hoy es ${this.executiveInsightPhrase(businessInsight)}.`)
    }

    if (!bundle.measurement.conversionMeasurementReady) {
      pieces.push('Antes de concluir pérdida de negocio, hay que validar la señal y recién después decidir sobre campañas, landings o conversión.')
    }

    return this.cleanExecutiveSummary(pieces.join(' '))
  }

  private executiveInsightPhrase(insight: AnalyticsAiDecisionOutput['insights'][number]) {
    if (insight.page) {
      return `mejorar ${insight.page}`
    }

    if (insight.category === 'measurement_issue') {
      return 'validar la calidad de la medición'
    }

    if (insight.insight_type === 'acquisition') {
      return 'optimizar la adquisición y el contenido que no está capturando clics'
    }

    if (insight.insight_type === 'conversion') {
      return 'reducir la fuga en el funnel y corregir la fricción de conversión'
    }

    if (insight.insight_type === 'revenue') {
      return 'proteger la rentabilidad de los canales que más aportan revenue'
    }

    return insight.title.toLowerCase()
  }

  private cleanExecutiveSummary(value: string) {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    const technicalPattern =
      /(active_[a-z0-9_]+|query hash|reportkey|sync run|baseline|reconciliaci[oó]n|row count|delta percent|data_quality_checks|openai_http_[0-9]+|insufficient_quota|you exceeded your current quota|chat\/completions|responses)/i
    if (!technicalPattern.test(trimmed)) {
      return this.normalizeText(trimmed)
    }

    return this.normalizeText(
      trimmed
        .replace(/\bactive_[a-z0-9_]+\b/gi, 'la señal de negocio')
        .replace(/\breportkey\b/gi, 'reporte')
        .replace(/\bquery hash\b/gi, 'consulta técnica')
        .replace(/\bsync run(s)?\b/gi, 'última sincronización')
        .replace(/\bbaseline\b/gi, 'referencia base')
        .replace(/\breconciliaci[oó]n\b/gi, 'validación')
        .replace(/\brow count\b/gi, 'volumen')
        .replace(/\bdelta percent\b/gi, 'desvío')
        .replace(/\bdata_quality_checks\b/gi, 'chequeos de calidad')
        .replace(/\bopenai_http_[0-9]+\b/gi, '')
        .replace(/\binsufficient_quota\b/gi, 'cuota de uso agotada')
        .replace(/you exceeded your current quota/gi, 'la cuota de uso está agotada')
        .replace(/\bchat\/completions\b/gi, 'respuesta del modelo')
        .replace(/\bresponses\b/gi, 'respuesta del modelo')
        .replace(/\s+/g, ' '),
    )
  }

  private shouldRewriteExecutiveSummary(value: string) {
    return /(active_[a-z0-9_]+|query hash|reportkey|sync run|baseline|reconciliaci[oó]n gap|row count|delta percent|data_quality_checks|openai_http_[0-9]+|insufficient_quota|you exceeded your current quota|chat\/completions|responses|high_traffic_low_conversion|high_cost_low_roas|high_impression_low_ctr|high_add_to_cart_low_purchase|abrupt_decline|data_quality_gap)/i.test(
      value,
    )
  }

  private cleanInsightText(
    value: string,
    context: {
      category: AnalyticsInsightCategory
      source: AnalyticsInsightSource
      metric: string | null
      field: 'title' | 'what_happened' | 'why_it_matters' | 'recommendation'
      sourceReport: string | null
    },
  ) {
    const cleaned = this.cleanExecutiveSummary(value)
    if (!cleaned) {
      return this.fallbackInsightText(context)
    }

    if (context.category === 'measurement_issue' || context.sourceReport?.includes('analytics_data_quality')) {
      if (context.field === 'title') {
        return context.metric?.includes('conversion')
          ? 'La medición de conversiones todavía no está lista'
          : 'Riesgo de calidad de datos'
      }
      if (context.field === 'what_happened') {
        return 'La señal analizada sigue afectada por una desalineación de calidad y no conviene tomarla como pérdida confirmada.'
      }
      if (context.field === 'why_it_matters') {
        return 'Mientras la señal siga inestable, cualquier decisión sobre campañas, landings o conversión puede estar sesgada.'
      }
      if (context.field === 'recommendation') {
        return 'Validar la medición antes de concluir sobre performance y recién después priorizar acciones de negocio.'
      }
    }

    return cleaned
  }

  private fallbackInsightText(context: {
    category: AnalyticsInsightCategory
    source: AnalyticsInsightSource
    metric: string | null
    field: 'title' | 'what_happened' | 'why_it_matters' | 'recommendation'
    sourceReport: string | null
  }) {
    if (context.category === 'measurement_issue') {
      switch (context.field) {
        case 'title':
          return 'Riesgo de calidad de datos'
        case 'what_happened':
          return 'La señal analizada no alcanza para concluir un problema de negocio con confianza.'
        case 'why_it_matters':
          return 'Tomar decisiones con esta señal puede llevar a conclusiones equivocadas sobre performance o conversión.'
        case 'recommendation':
          return 'Validar primero la medición y luego decidir sobre campañas, landings o conversión.'
      }
    }

    if (context.category === 'business_issue') {
      switch (context.field) {
        case 'title':
          return 'Oportunidad de negocio'
        case 'what_happened':
          return 'La señal detectada muestra una oportunidad concreta para mejorar resultado comercial.'
        case 'why_it_matters':
          return 'Atender esta oportunidad puede mover ingresos, eficiencia o captación de demanda.'
        case 'recommendation':
          return 'Priorizar la acción que mejor relación tenga entre impacto económico y facilidad de ejecución.'
      }
    }

    switch (context.field) {
      case 'title':
        return 'Señal de baja confianza'
      case 'what_happened':
        return 'La señal no alcanza para una conclusión fuerte.'
      case 'why_it_matters':
        return 'Conviene usarla solo como referencia exploratoria.'
      case 'recommendation':
        return 'Revisar la calidad de la información antes de actuar.'
    }
  }

  private patternTitle(type: string) {
    switch (type) {
      case 'high_traffic_low_conversion':
        return 'Tráfico alto con conversión baja'
      case 'high_cost_low_roas':
        return 'Coste alto con ROAS bajo'
      case 'high_impression_low_ctr':
        return 'Impresiones altas con CTR bajo'
      case 'high_add_to_cart_low_purchase':
        return 'Muchos add_to_cart con compra baja'
      case 'abrupt_decline':
        return 'Caída abrupta frente al período anterior'
      case 'data_quality_gap':
        return 'Gap de calidad de datos'
      default:
        return 'Insight de negocio'
    }
  }

  private inferInsightType(type: string) {
    if (type === 'data_quality_gap') {
      return 'data_quality'
    }
    if (type === 'abrupt_decline') {
      return 'behavior'
    }
    if (type === 'high_cost_low_roas') {
      return 'revenue'
    }
    if (type === 'high_add_to_cart_low_purchase' || type === 'high_traffic_low_conversion') {
      return 'conversion'
    }
    return 'acquisition'
  }

  private patternMetric(type: string) {
    switch (type) {
      case 'high_cost_low_roas':
        return 'roas'
      case 'high_impression_low_ctr':
        return 'ctr'
      case 'high_add_to_cart_low_purchase':
        return 'purchaseRate'
      case 'high_traffic_low_conversion':
        return 'conversionRate'
      case 'abrupt_decline':
        return 'trend'
      case 'data_quality_gap':
        return 'quality'
      default:
        return null
    }
  }

  private patternSegment(evidence: Record<string, unknown>) {
    const segment = evidence.segment
    return typeof segment === 'string' ? segment : null
  }

  private patternSource(type: string): AnalyticsInsightSource {
    if (type === 'high_cost_low_roas') {
      return 'ads'
    }
    if (type === 'high_impression_low_ctr') {
      return 'search_console'
    }
    if (type === 'high_add_to_cart_low_purchase' || type === 'high_traffic_low_conversion' || type === 'abrupt_decline') {
      return 'ga4'
    }
    return 'mixed'
  }

  private recommendationFromPattern(type: string, measurement: AnalyticsMeasurementGate) {
    switch (type) {
      case 'high_traffic_low_conversion':
        return measurement.conversionMeasurementReady
          ? 'Revisar landing, oferta y fricción del checkout para ese segmento.'
          : 'Validar primero la medición de conversiones antes de concluir que hay fuga de negocio.'
      case 'high_cost_low_roas':
        return measurement.conversionMeasurementReady
          ? 'Reducir o reasignar presupuesto en campañas o keywords con ROAS bajo.'
          : 'No tomar la señal como pérdida confirmada hasta validar la medición.'
      case 'high_impression_low_ctr':
        return 'Ajustar copy, creatividades o snippet para elevar CTR.'
      case 'high_add_to_cart_low_purchase':
        return 'Auditar shipping, precio, confianza y checkout donde el carrito se cae.'
      case 'abrupt_decline':
        return 'Buscar cambios de campaña, contenido, disponibilidad o medición que expliquen el quiebre.'
      case 'data_quality_gap':
        return 'Revisar baseline, sync y reconciliación antes de emitir conclusiones de negocio.'
      default:
        return 'Revisar la señal y definir una acción concreta sobre el segmento afectado.'
    }
  }
}

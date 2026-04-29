import { Injectable } from '@nestjs/common'
import {
  OpenAiClientService,
  type OpenAiRuntimeConfig,
} from '../common/openai/openai-client.service'
import type {
  AnalyticsAiDecisionOutput,
  AnalyticsInsightBundle,
  AnalyticsInsightCategory,
  AnalyticsInsightPriority,
  AnalyticsInsightSource,
  AnalyticsInsightType,
  AnalyticsMeasurementGate,
} from './analytics.types'

const SYSTEM_PROMPT = [
  'Sos un analista senior de crecimiento en ecommerce.',
  'Tu trabajo es analizar datos normalizados, calidad de datos y comparación temporal para generar decisiones claras basadas en evidencia.',
  'No inventes datos ni hagas afirmaciones sin evidencia explícita.',
  'Prioriza el impacto económico, explica causas probables y recomienda acciones concretas y ejecutables.',
  'No confundas performance con medición.',
  'Si conversion_measurement_ready es false, no clasifiques conversiones cero como desperdicio confirmado.',
  'En ese caso, usa measurement_issue o low_confidence_signal.',
  'El input llega como un analytics_insight_bundle con timeRange, kpis, funnel, acquisition, seo, products, detectedPatterns, dataQuality y measurement.',
  'Devolvé exclusivamente un JSON válido con esta estructura exacta:',
  '{"summary":"string","insights":[{"title":"string","what_happened":"string","why_it_matters":"string","category":"business_issue|measurement_issue|low_confidence_signal","source":"ga4|ads|search_console|mixed","insight_type":"summary|acquisition|behavior|conversion|revenue|data_quality","metric":"string|null","segment":"string|null","source_report":"string|null","evidence":{},"impact":"high|medium|low","confidence":0.0,"recommendation":"string"}],"prioritized_actions":[{"action":"string","reason":"string","expected_impact":"high|medium|low","priority":1,"confidence":0.0}]}',
  'Si algún dato no está disponible, usá null, cadena vacía o evidencia vacía, pero mantené las claves.',
  'Devolvé exclusivamente JSON válido, sin markdown ni texto fuera del contrato.',
].join(' ')

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

@Injectable()
export class AnalyticsAiInsightsService {
  constructor(private readonly openAiClient: OpenAiClientService) {}

  async generateDecision(bundle: AnalyticsInsightBundle): Promise<AnalyticsAiDecisionOutput> {
    const runtime = await this.openAiClient.resolveRuntimeConfig()
    if (runtime.enabled !== false && runtime.provider === 'openai' && runtime.openAiApiKey) {
      try {
        const decision = await this.requestOpenAiDecision(bundle, runtime)
        return this.normalizeDecision(decision, bundle)
      } catch (error) {
        return this.fallbackDecision(bundle, error instanceof Error ? error.message : 'ai_decision_failed')
      }
    }

    return this.fallbackDecision(bundle, 'ai_provider_unavailable')
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
            content: SYSTEM_PROMPT,
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
    const summary = this.extractValue(decision, 'summary')
    const insights = this.extractArray(decision, 'insights')
    const prioritizedActions = this.extractArray(decision, 'prioritized_actions')

    return {
      summary: this.normalizeSummary(summary, bundle, decision),
      insights: insights
        .map((insight) => this.normalizeInsight(insight, bundle))
        .filter((insight): insight is AnalyticsAiDecisionOutput['insights'][number] => insight !== null)
        .sort((left, right) => {
          const leftScore =
            CATEGORY_PRIORITY[left.category] * 2 + IMPACT_PRIORITY[left.impact] + left.confidence
          const rightScore =
            CATEGORY_PRIORITY[right.category] * 2 + IMPACT_PRIORITY[right.impact] + right.confidence
          return rightScore - leftScore
        }),
      prioritized_actions: prioritizedActions
        .map((action, index) => this.normalizeAction(action, bundle, index))
        .filter((action): action is AnalyticsAiDecisionOutput['prioritized_actions'][number] => action !== null)
        .sort((left, right) => left.priority - right.priority),
    }
  }

  private fallbackDecision(
    bundle: AnalyticsInsightBundle,
    reason: string,
  ): AnalyticsAiDecisionOutput {
    const topPattern = bundle.detectedPatterns[0] ?? null
    const baseSummary = topPattern
      ? `La señal dominante es ${topPattern.type} con severidad ${topPattern.severity}. La calidad de datos está en estado ${bundle.dataQuality.status}.`
      : `La calidad de datos está en estado ${bundle.dataQuality.status} y no se detectaron patrones fuertes.`

    return this.normalizeDecision(
      {
        summary: `${baseSummary} (${reason})`,
        insights: topPattern
          ? [
              {
                title: this.patternTitle(topPattern.type),
                what_happened: `Se detectó ${topPattern.type} en el período comparado.`,
                why_it_matters: 'Afecta la priorización del análisis y puede indicar una fuga de valor o una señal de medición.',
                category: topPattern.category,
                source: topPattern.source,
                insight_type: this.inferInsightType(topPattern.type),
                metric: this.patternMetric(topPattern.type),
                segment: this.patternSegment(topPattern.evidence),
                source_report: this.patternSource(topPattern.type),
                evidence: topPattern.evidence,
                impact: topPattern.severity === 'high' ? 'high' : topPattern.severity === 'medium' ? 'medium' : 'low',
                confidence: this.bundleConfidence(bundle),
                recommendation: this.recommendationFromPattern(topPattern.type, bundle.measurement),
              },
            ]
          : [],
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
      },
      bundle,
    )
  }

  private normalizeSummary(summary: unknown, bundle: AnalyticsInsightBundle, rawDecision?: unknown) {
    const text = this.normalizeText(summary)
    if (text) {
      return text
    }

    const nestedText = this.normalizeText(this.extractValue(summary, 'text'))
      ?? this.normalizeText(this.extractValue(summary, 'description'))
      ?? this.normalizeText(this.extractValue(summary, 'message'))
    if (nestedText) {
      return nestedText
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
    if (trafficChange) pieces.push(trafficChange)
    if (dataQuality) pieces.push(`Calidad de datos: ${dataQuality}.`)

    if (pieces.length > 0) {
      return pieces.join(' ').replace(/\s+/g, ' ').trim()
    }

    const rawText = this.normalizeText(this.extractValue(rawDecision, 'summaryText'))
    if (rawText) {
      return rawText
    }

    if (bundle.dataQuality.status === 'error') {
      return 'La calidad de datos limita la confianza del análisis y obliga a priorizar validación antes de decisiones agresivas.'
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

    if (!title && !whatHappened && !recommendation) {
      return null
    }

    return {
      title,
      what_happened: whatHappened,
      why_it_matters: whyItMatters,
      category,
      source,
      insight_type: insightType,
      metric:
        this.normalizeText(this.extractValue(insight, 'metric')) ??
        this.normalizeText(evidence?.metric) ??
        null,
      segment,
      source_report:
        this.normalizeText(this.extractValue(insight, 'source_report')) ??
        this.normalizeText(this.extractValue(insight, 'sourceReport')) ??
        null,
      evidence: evidence ?? {},
      impact,
      confidence,
      recommendation,
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
      action: actionText,
      reason,
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
    return value === 'ga4' || value === 'ads' || value === 'search_console' || value === 'mixed'
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
    return Number(Math.max(0.05, Math.min(0.98, quality - measurementPenalty)).toFixed(4))
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

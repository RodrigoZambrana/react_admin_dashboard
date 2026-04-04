import { Injectable } from '@nestjs/common';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import {
  CanonicalInterpretation,
  InterpretationEntities,
  InterpretationAttempt,
  InterpretationResult,
  interpretationAttemptSchema,
} from './interpretation.schemas';

@Injectable()
export class InterpretationService {
  constructor(
    private readonly aiGateway: AiGatewayService,
    private readonly logger: PipelineLoggerService,
  ) {}

  async interpret(
    message: string,
    locale?: string,
    previousMessages: Array<{
      role: 'user' | 'assistant';
      content: string;
    }> = [],
    options?: {
      abortSignal?: AbortSignal;
    },
  ): Promise<InterpretationAttempt> {
    const startedAt = Date.now();
    const gatewayResult = await this.aiGateway.interpret({
      message,
      locale,
      previousMessages,
      abortSignal: options?.abortSignal,
    });
    const interpretation = gatewayResult.ok && gatewayResult.parsedResponse
      ? this.normalizeInterpretation(gatewayResult.parsedResponse, message, locale)
      : this.buildFallback(message, locale);
    const result = interpretationAttemptSchema.parse({
      interpretation,
      rawAiResponse: gatewayResult.rawResponse,
      parsedJson: gatewayResult.ok && gatewayResult.parsedResponse
        ? interpretation
        : null,
      error: gatewayResult.error,
      provider: gatewayResult.provider,
      model: gatewayResult.model,
      usedFallback: !gatewayResult.ok,
    });

    this.logger.log(
      JSON.stringify({
        stage: 'interpretation',
        durationMs: Date.now() - startedAt,
        output: result,
      }),
    );

    return result;
  }

  private normalizeInterpretation(
    input: InterpretationResult,
    message: string,
    locale?: string,
  ): CanonicalInterpretation {
    const intent = this.normalizeIntent(input.intent);

    return {
      intent,
      entities: this.normalizeEntities(input.entities, message, intent),
      language: this.normalizeLanguage(input.language, locale),
      confidence: Math.max(0, Math.min(1, input.confidence)),
    };
  }

  private buildFallback(message: string, locale?: string): CanonicalInterpretation {
    return {
      intent: 'GENERAL_CONVERSATION',
      entities: {
        rawMessage: message,
      },
      language: this.normalizeLanguage('unknown', locale, true),
      confidence: 0,
    };
  }

  private normalizeEntities(
    entities: InterpretationEntities | undefined,
    message: string,
    intent: CanonicalInterpretation['intent'],
  ): InterpretationEntities {
    const rawMessage =
      typeof entities?.rawMessage === 'string' &&
      entities.rawMessage.trim().length > 0
        ? entities.rawMessage.trim()
        : message;

    const normalized: InterpretationEntities = {
      rawMessage,
    };

    const dateCandidates = this.normalizeStringArray(entities?.dateCandidates);
    const measurementCandidates = this.normalizeStringArray(
      entities?.measurementCandidates,
    );
    const dimensionCandidates = this.normalizeStringArray(
      entities?.dimensionCandidates,
    );
    const price = this.normalizeOptionalString(entities?.price);
    const location = this.normalizeOptionalString(entities?.location);
    const sku = this.normalizeOptionalString(entities?.sku);
    const productQuery = this.normalizeOptionalString(entities?.productQuery);
    const requestSummary = this.normalizeOptionalString(entities?.requestSummary);

    if (dateCandidates.length > 0) {
      normalized.dateCandidates = dateCandidates;
    }

    if (measurementCandidates.length > 0) {
      normalized.measurementCandidates = measurementCandidates;
    }

    if (dimensionCandidates.length > 0) {
      normalized.dimensionCandidates = dimensionCandidates;
    }

    if (typeof entities?.attendees === 'number' && Number.isFinite(entities.attendees)) {
      normalized.attendees = Math.trunc(entities.attendees);
    }

    if (price && intent === 'GET_PRODUCT') {
      normalized.price = price;
    }

    if (location && intent === 'GET_PRODUCT') {
      normalized.location = location;
    }

    if (sku && intent === 'GET_PRODUCT') {
      normalized.sku = sku;
    }

    if (productQuery && intent === 'GET_PRODUCT') {
      normalized.productQuery = productQuery;
    }

    if (requestSummary && (intent === 'CREATE_BOOKING' || intent === 'CREATE_QUOTE')) {
      normalized.requestSummary = requestSummary;
    }

    return normalized;
  }

  private normalizeStringArray(values: string[] | undefined) {
    return (values ?? [])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  }

  private normalizeOptionalString(value: unknown) {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();

    if (normalized.length === 0) {
      return undefined;
    }

    if (['/', '-', 'n/a', 'na', 'none', 'null'].includes(normalized.toLowerCase())) {
      return undefined;
    }

    return normalized;
  }

  private normalizeIntent(intent: string): CanonicalInterpretation['intent'] {
    const normalized = intent.trim().toUpperCase().replace(/[.\s-]+/g, '_');
    const aliases: Record<string, CanonicalInterpretation['intent']> = {
      CORE_GENERAL_CONVERSATION: 'GENERAL_CONVERSATION',
      GENERAL: 'GENERAL_CONVERSATION',
      GENERAL_CONVERSATION: 'GENERAL_CONVERSATION',
      CORE_CLARIFICATION: 'CLARIFICATION',
      CLARIFICATION: 'CLARIFICATION',
      TENANT_GET_PRODUCT: 'GET_PRODUCT',
      GET_PRODUCT: 'GET_PRODUCT',
      TENANT_CREATE_BOOKING: 'CREATE_BOOKING',
      CREATE_BOOKING: 'CREATE_BOOKING',
      TENANT_CREATE_QUOTE: 'CREATE_QUOTE',
      CREATE_QUOTE: 'CREATE_QUOTE',
    };

    return aliases[normalized] ?? 'GENERAL_CONVERSATION';
  }

  private normalizeLanguage(
    language: string,
    locale?: string,
    allowUnknown = false,
  ) {
    const normalized = language.trim().toLowerCase();
    const aliases: Record<string, string> = {
      es: 'es',
      'es-ar': 'es',
      'es-es': 'es',
      spanish: 'es',
      español: 'es',
      en: 'en',
      'en-us': 'en',
      'en-gb': 'en',
      english: 'en',
      unknown: 'unknown',
    };
    const localeHint = locale?.trim().toLowerCase() ?? '';

    if (aliases[normalized]) {
      return aliases[normalized];
    }

    if (aliases[localeHint]) {
      return aliases[localeHint];
    }

    if (localeHint.startsWith('es')) {
      return 'es';
    }

    if (localeHint.startsWith('en')) {
      return 'en';
    }

    return allowUnknown ? 'unknown' : 'unknown';
  }
}

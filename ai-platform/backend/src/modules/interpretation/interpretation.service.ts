import { Injectable } from '@nestjs/common';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import {
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
  ): Promise<InterpretationAttempt> {
    const startedAt = Date.now();
    const gatewayResult = await this.aiGateway.interpret({
      message,
      locale,
      previousMessages,
    });
    const interpretation = gatewayResult.ok && gatewayResult.parsedResponse
      ? this.normalizeInterpretation(gatewayResult.parsedResponse, locale)
      : this.buildFallback(locale);
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
    locale?: string,
  ): InterpretationResult {
    return {
      intent: this.normalizeIntent(input.intent),
      entities: input.entities ?? {},
      language: this.normalizeLanguage(input.language, locale),
      confidence: Math.max(0, Math.min(1, input.confidence)),
    };
  }

  private buildFallback(locale?: string): InterpretationResult {
    return {
      intent: 'GENERAL_CONVERSATION',
      entities: {},
      language: this.normalizeLanguage('unknown', locale, true),
      confidence: 0,
    };
  }

  private normalizeIntent(intent: string) {
    const normalized = intent.trim().toUpperCase().replace(/[.\s-]+/g, '_');
    const aliases: Record<string, string> = {
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

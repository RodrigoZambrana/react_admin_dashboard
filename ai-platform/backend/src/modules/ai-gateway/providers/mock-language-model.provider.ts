import { Injectable } from '@nestjs/common';

import { TemporalExpressionService } from '../../temporal/temporal-expression.service';
import type { ApprovedResponseContext } from '../../response/response.types';
import { throwIfAborted } from '../../shared/abort.utils';
import {
  InterpretationOutput,
  LanguageModelInterpretationRequest,
  LanguageModelProviderConfig,
  LanguageModelProvider,
  LanguageModelResponseGenerationRequest,
} from '../ai-gateway.types';

const measurementPattern =
  /\b\d+(?:[.,]\d+)?\s?(?:mm|cm|m|km|g|kg|lb|lbs|ml|l)\b/gi;
const dimensionPattern =
  /\b\d+(?:[.,]\d+)?\s?[x×]\s?\d+(?:[.,]\d+)?(?:\s?(?:mm|cm|m))?\b/gi;

function detectIntent(message: string) {
  const lower = message.toLowerCase();

  if (/^(hola|hello|hi|buenas)\b/.test(lower.trim())) {
    return 'GENERAL_CONVERSATION';
  }

  if (/(quote|cotiz|presupuesto|estimate|pricing proposal)/.test(lower)) {
    return 'CREATE_QUOTE';
  }

  if (
    /(booking|book|reserve|reservation|reservar|reserva|appointment|cita)/.test(
      lower,
    )
  ) {
    return 'CREATE_BOOKING';
  }

  if (
    /(product|sku|catalog|precio|producto|item|buy|comprar|barato|barata|cheap|econ[oó]mico|puertas|door)/.test(
      lower,
    )
  ) {
    return 'GET_PRODUCT';
  }

  if (lower.trim().length < 8 || /(help|ayuda|not sure|no se)/.test(lower)) {
    return 'CLARIFICATION';
  }

  return 'GENERAL_CONVERSATION';
}

@Injectable()
export class MockLanguageModelProvider implements LanguageModelProvider {
  readonly providerName = 'mock';

  constructor(
    private readonly temporalExpressionService: TemporalExpressionService,
  ) {}

  async interpret(
    input: LanguageModelInterpretationRequest,
    providerInput: LanguageModelProviderConfig,
  ): Promise<{ rawResponse: string; model: string }> {
    throwIfAborted(providerInput.abortSignal);
    const language = await this.detectLanguage(input.message);
    const intent = detectIntent(input.message);
    const entities = await this.extractEntities(input, language);
    throwIfAborted(providerInput.abortSignal);
    const payload: InterpretationOutput = {
      intent,
      entities,
      language,
      confidence: estimateConfidence(intent, entities),
    };

    return {
      rawResponse: JSON.stringify(payload),
      model: 'mock-rule-engine',
    };
  }

  async generateResponse(input: LanguageModelResponseGenerationRequest,
  providerInput?: LanguageModelProviderConfig): Promise<{ rawResponse: string; model: string }> {
    throwIfAborted(providerInput?.abortSignal);
    return {
      rawResponse: JSON.stringify({
        message: input.approvedDraft,
        assertedOutcome: input.approvedContext.outcome,
        assertedExecutionStatus: input.approvedContext.execution.status,
        mentionedMissingFields: input.approvedContext.missingFields ?? [],
        mentionedApprovedFactKeys: input.approvedContext.approvedFactKeys,
        mentionedApprovedResultKeys: input.approvedContext.approvedResultKeys,
      }),
      model: 'mock-rule-engine',
    };
  }

  private async detectLanguage(message: string) {
    const spanishSignals = [
      'hola',
      'quiero',
      'cotizacion',
      'cotización',
      'barato',
      'cocina',
      'puertas',
      'reservar',
      'precio',
      'producto',
      'necesito',
    ];
    const lower = message.toLowerCase();

    if (spanishSignals.some((signal) => lower.includes(signal))) {
      return 'es';
    }

    return (await this.temporalExpressionService.findMatchingLocales(message))[0] ?? 'en';
  }

  private async extractEntities(
    input: LanguageModelInterpretationRequest,
    language: string,
  ) {
    const message = input.message;
    const measurements = message.match(measurementPattern) ?? [];
    const dates = await this.temporalExpressionService.extractExpressions(
      message,
      language,
    );
    const dimensions = message.match(dimensionPattern) ?? [];
    const peopleMatch = message.match(
      /\b(?:for|para)\s+(\d+)\s+(?:people|personas?)\b/i,
    );
    const skuMatch = message.match(/\bsku[:\s-]*([a-z0-9-]+)\b/i);
    const lower = message.toLowerCase();

    const entities: Record<string, unknown> = {
      rawMessage: message,
      dateCandidates: dates,
      measurementCandidates: measurements,
    };

    if (dimensions.length > 0) {
      entities.dimensionCandidates = dimensions;
    }

    if (/(barato|barata|cheap|econ[oó]mico)/.test(lower)) {
      entities.price = 'low';
    }

    if (/(cocina|kitchen)/.test(lower)) {
      entities.location = 'kitchen';
    }

    if (peopleMatch) {
      entities.attendees = Number(peopleMatch[1]);
    }

    if (skuMatch?.[1]) {
      entities.sku = skuMatch[1];
    }

    return entities;
  }
}

function estimateConfidence(intent: string, entities: Record<string, unknown>) {
  const signals =
    Object.values(entities).filter((value) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return value !== undefined && value !== null && value !== '';
    }).length +
    (intent !== 'GENERAL_CONVERSATION' ? 1 : 0);

  return Math.min(0.55 + signals * 0.08, 0.96);
}

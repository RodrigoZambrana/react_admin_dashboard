import { Injectable } from '@nestjs/common';

import {
  InterpretationOutput,
  LanguageModelInterpretationRequest,
  LanguageModelProvider,
  ResponseGenerationInput,
} from '../ai-gateway.types';

const datePattern =
  /\b(today|tomorrow|tonight|next week|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday|hoy|mañana|pasado mañana|la próxima semana|el lunes|el martes|el miércoles|el jueves|el viernes|el sábado|el domingo|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/gi;
const measurementPattern =
  /\b\d+(?:[.,]\d+)?\s?(?:mm|cm|m|km|g|kg|lb|lbs|ml|l)\b/gi;
const dimensionPattern =
  /\b\d+(?:[.,]\d+)?\s?[x×]\s?\d+(?:[.,]\d+)?(?:\s?(?:mm|cm|m))?\b/gi;

function detectLanguage(message: string) {
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
    'mañana',
    'necesito',
  ];
  const lower = message.toLowerCase();
  return spanishSignals.some((signal) => lower.includes(signal)) ? 'es' : 'en';
}

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

function extractEntities(input: LanguageModelInterpretationRequest) {
  const message = input.message;
  const measurements = message.match(measurementPattern) ?? [];
  const dates = message.match(datePattern) ?? [];
  const dimensions = message.match(dimensionPattern) ?? [];
  const peopleMatch = message.match(/\b(?:for|para)\s+(\d+)\s+(?:people|personas?)\b/i);
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

@Injectable()
export class MockLanguageModelProvider implements LanguageModelProvider {
  async interpret(
    input: LanguageModelInterpretationRequest,
    _providerInput: {
      apiKey: string;
      model: string;
      timeoutMs: number;
    },
  ): Promise<{ rawResponse: string; model: string }> {
    const intent = detectIntent(input.message);
    const entities = extractEntities(input);
    const payload: InterpretationOutput = {
      intent,
      entities,
      language: detectLanguage(input.message),
      confidence: estimateConfidence(intent, entities),
    };

    return {
      rawResponse: JSON.stringify(payload),
      model: 'mock-rule-engine',
    };
  }

  async generateResponse(input: ResponseGenerationInput): Promise<string> {
    if (input.missingFields?.length) {
      return input.language === 'es'
        ? `Necesito un poco más de información para continuar: ${input.missingFields.join(', ')}.`
        : `I need a bit more information to continue: ${input.missingFields.join(', ')}.`;
    }

    if (input.toolResult) {
      return input.language === 'es'
        ? `Resultado procesado para ${input.intent}: ${JSON.stringify(input.toolResult)}`
        : `Processed result for ${input.intent}: ${JSON.stringify(input.toolResult)}`;
    }

    return input.language === 'es'
      ? 'Entendido. Estoy preparando una respuesta basada en la política aprobada del backend.'
      : 'Understood. I am preparing a response based on the backend-approved policy.';
  }
}

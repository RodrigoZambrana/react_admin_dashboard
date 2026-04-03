import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  AiGatewayConfig,
  AiProvider,
  PromptTemplateConfig,
  SecurityPreparationConfig,
  TenantRuntimeConfig,
} from './runtime-config.types';

const defaultInterpretationPrompt = `You are the interpretation layer for a multi-tenant conversational AI platform.
Return valid JSON only with exactly these keys:
- intent
- entities
- language
- confidence

Rules:
- Allowed intents: GENERAL_CONVERSATION, CLARIFICATION, GET_PRODUCT, CREATE_BOOKING, CREATE_QUOTE.
- Do not execute tools.
- Do not make business decisions.
- entities must always be a JSON object.
- language must be a short language code like "es" or "en".
- confidence must be a number between 0 and 1.
- When the user asks for something cheap or low cost, use entities.price = "low".
- Normalize "cocina" and "kitchen" to entities.location = "kitchen" when relevant.
- Keep raw date, measurement, and dimension strings inside entities for later backend parsing.

Example 1
User: "hola"
Output: {"intent":"GENERAL_CONVERSATION","entities":{},"language":"es","confidence":0.92}

Example 2
User: "quiero algo barato para la cocina"
Output: {"intent":"GET_PRODUCT","entities":{"price":"low","location":"kitchen"},"language":"es","confidence":0.9}

Example 3
User: "puertas 1,38 x 0,90"
Output: {"intent":"GET_PRODUCT","entities":{"dimensionCandidates":["1,38 x 0,90"]},"language":"es","confidence":0.71}`;

const defaultResponsePrompt = `You are the response generation layer.
Generate the final user-facing message from approved backend context.
Do not invent tool executions.
Do not make business decisions.`;

@Injectable()
export class RuntimeConfigService {
  constructor(private readonly configService: ConfigService) {}

  getAiGatewayConfig(): AiGatewayConfig {
    return {
      provider: this.getAiProvider(),
      apiKey: this.readOptionalString('OPENAI_API_KEY'),
      model:
        this.readOptionalString('OPENAI_MODEL') ??
        this.readOptionalString('AI_MODEL') ??
        'gpt-4o-mini',
      timeoutMs: this.readPositiveNumber('AI_TIMEOUT_MS', 10000),
      source: 'env',
    };
  }

  getPromptTemplate(key: 'interpretation' | 'response'): PromptTemplateConfig {
    // TODO: replace code-backed prompt templates with PromptVersion storage once prompt versioning is reconnected to the live interpretation flow.
    if (key === 'interpretation') {
      return {
        key,
        template: defaultInterpretationPrompt,
        source: 'code',
      };
    }

    return {
      key,
      template: defaultResponsePrompt,
      source: 'code',
    };
  }

  getTenantRuntimeConfig(tenantId?: string | null): TenantRuntimeConfig {
    return {
      tenantId: tenantId ?? null,
      source: 'env',
      authMode: 'open',
    };
  }

  getSecurityPreparationConfig(): SecurityPreparationConfig {
    return {
      apiAuthMode: 'open',
      futureApiAuthMode: 'bearer',
      futureAdminGuard: 'AdminOnlyGuard',
      adminOnlyEndpoints: ['/prompts', '/logs', '/conversations'],
      apiKeyStorage: {
        current: 'env',
        future: 'database',
      },
    };
  }

  private getAiProvider(): AiProvider {
    const configuredProvider = this.readOptionalString('AI_PROVIDER')?.toLowerCase();

    if (configuredProvider === 'openai') {
      return 'openai';
    }

    return 'mock';
  }

  private readOptionalString(key: string) {
    const value = this.configService.get<string>(key);
    return value?.trim() ? value.trim() : null;
  }

  private readPositiveNumber(key: string, fallback: number) {
    const rawValue = this.configService.get<string>(key);
    const parsedValue = rawValue ? Number(rawValue) : Number.NaN;

    if (Number.isFinite(parsedValue) && parsedValue > 0) {
      return parsedValue;
    }

    return fallback;
  }
}

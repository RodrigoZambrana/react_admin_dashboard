import { Injectable } from '@nestjs/common';
import { ZodError, z } from 'zod';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { PromptService } from '../prompt/prompt.service';
import { RuntimeConfigService } from '../runtime-config/runtime-config.service';
import { aiGeneratedResponseSchema } from '../response/response.types';
import {
  AiGatewayInterpretationResult,
  AiGatewayResponseGenerationResult,
  InterpretationInput,
  InterpretationOutput,
  ResponseGenerationInput,
} from './ai-gateway.types';
import { LanguageModelProviderRegistry } from './providers/language-model-provider.registry';

const interpretationOutputSchema = z.object({
  intent: z.string().min(1),
  entities: z.record(z.unknown()),
  language: z.string().min(2),
  confidence: z.number().min(0).max(1),
});

@Injectable()
export class AiGatewayService {
  constructor(
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly promptService: PromptService,
    private readonly logger: PipelineLoggerService,
    private readonly providerRegistry: LanguageModelProviderRegistry,
  ) {}

  async interpret(input: InterpretationInput): Promise<AiGatewayInterpretationResult> {
    const providerConfig = await this.runtimeConfig.getAiGatewayConfig();
    const provider = this.providerRegistry.resolve(providerConfig.provider);
    const startedAt = Date.now();
    const promptTemplate =
      input.promptTemplate ??
      (await this.promptService.getActivePrompt('interpretation'))?.value ??
      '';
    const request = {
      systemPrompt: this.buildInterpretationPrompt(promptTemplate, input.locale),
      message: input.message,
      locale: input.locale,
      previousMessages: input.previousMessages ?? [],
    };

    this.logger.debug(
      JSON.stringify({
        stage: 'ai_gateway.request',
        provider: providerConfig.provider,
        model: providerConfig.model,
        previousMessageCount: request.previousMessages.length,
      }),
    );

    if (!provider) {
      const error = this.buildUnknownProviderError(providerConfig.provider);

      this.logger.error(
        JSON.stringify({
          stage: 'ai_gateway.response',
          provider: providerConfig.provider,
          model: providerConfig.model,
          durationMs: Date.now() - startedAt,
          error,
        }),
      );

      return {
        ok: false,
        rawResponse: null,
        parsedResponse: null,
        error,
        provider: providerConfig.provider,
        model: providerConfig.model,
      };
    }

    if (this.requiresCredentials(providerConfig) && !providerConfig.credentials.value) {
      const error = this.buildMissingCredentialsError(providerConfig.provider);

      this.logger.error(
        JSON.stringify({
          stage: 'ai_gateway.response',
          provider: providerConfig.provider,
          model: providerConfig.model,
          durationMs: Date.now() - startedAt,
          error,
        }),
      );

      return {
        ok: false,
        rawResponse: null,
        parsedResponse: null,
        error,
        provider: providerConfig.provider,
        model: providerConfig.model,
      };
    }

    try {
      const providerResponse = await provider.interpret(request, {
        model: providerConfig.model,
        timeoutMs: providerConfig.timeoutMs,
        credentials: providerConfig.credentials,
        providerOptions: providerConfig.providerOptions,
      });
      const rawResponse = providerResponse.rawResponse;
      const parsedPayload = this.parseInterpretationPayload(rawResponse);

      this.logger.debug(
        JSON.stringify({
          stage: 'ai_gateway.response',
          provider: providerConfig.provider,
          model: providerResponse.model ?? providerConfig.model,
          durationMs: Date.now() - startedAt,
          payload: parsedPayload,
        }),
      );

      return {
        ok: true,
        rawResponse,
        parsedResponse: parsedPayload,
        error: null,
        provider: providerConfig.provider,
        model: providerResponse.model ?? providerConfig.model,
      };
    } catch (error) {
      const issue =
        error instanceof ZodError ? error.flatten() : { message: String(error) };

      this.logger.error(
        JSON.stringify({
          stage: 'ai_gateway.response',
          provider: providerConfig.provider,
          model: providerConfig.model,
          durationMs: Date.now() - startedAt,
          issue,
        }),
      );

      return {
        ok: false,
        rawResponse: this.extractRawResponse(error),
        parsedResponse: null,
        error: this.stringifyError(error),
        provider: providerConfig.provider,
        model: providerConfig.model,
      };
    }
  }

  async generateResponse(
    input: ResponseGenerationInput,
  ): Promise<AiGatewayResponseGenerationResult> {
    const providerConfig = await this.runtimeConfig.getAiGatewayConfig();
    const provider = this.providerRegistry.resolve(providerConfig.provider);
    const startedAt = Date.now();
    const prompt =
      input.promptTemplate !== undefined
        ? {
            id: null,
            version: null,
            value: input.promptTemplate,
          }
        : await this.promptService.getActivePrompt('response');
    const promptTemplate = prompt?.value ?? '';
    const request = {
      systemPrompt: this.buildResponsePrompt(
        promptTemplate,
        input.approvedContext.locale,
      ),
      approvedContext: input.approvedContext,
      approvedDraft: input.approvedDraft,
    };

    this.logger.debug(
      JSON.stringify({
        stage: 'ai_gateway.response_request',
        provider: providerConfig.provider,
        model: providerConfig.model,
        promptVersion: prompt?.version ?? null,
      }),
    );

    if (!provider) {
      const error = this.buildUnknownProviderError(providerConfig.provider);

      this.logger.error(
        JSON.stringify({
          stage: 'ai_gateway.response_output',
          provider: providerConfig.provider,
          model: providerConfig.model,
          durationMs: Date.now() - startedAt,
          promptVersion: prompt?.version ?? null,
          error,
        }),
      );

      return {
        ok: false,
        rawResponse: null,
        parsedResponse: null,
        error,
        provider: providerConfig.provider,
        model: providerConfig.model,
        promptId: prompt?.id ?? null,
        promptVersion: prompt?.version ?? null,
      };
    }

    if (this.requiresCredentials(providerConfig) && !providerConfig.credentials.value) {
      const error = this.buildMissingCredentialsError(providerConfig.provider);

      this.logger.error(
        JSON.stringify({
          stage: 'ai_gateway.response_output',
          provider: providerConfig.provider,
          model: providerConfig.model,
          durationMs: Date.now() - startedAt,
          error,
        }),
      );

      return {
        ok: false,
        rawResponse: null,
        parsedResponse: null,
        error,
        provider: providerConfig.provider,
        model: providerConfig.model,
        promptId: prompt?.id ?? null,
        promptVersion: prompt?.version ?? null,
      };
    }

    try {
      const providerResponse = await provider.generateResponse(request, {
        model: providerConfig.model,
        timeoutMs: providerConfig.timeoutMs,
        credentials: providerConfig.credentials,
        providerOptions: providerConfig.providerOptions,
      });
      const parsedPayload = this.parseResponsePayload(providerResponse.rawResponse);

      this.logger.debug(
        JSON.stringify({
          stage: 'ai_gateway.response_output',
          provider: providerConfig.provider,
          model: providerResponse.model ?? providerConfig.model,
          durationMs: Date.now() - startedAt,
          promptVersion: prompt?.version ?? null,
          outcome: parsedPayload.assertedOutcome,
        }),
      );

      return {
        ok: true,
        rawResponse: providerResponse.rawResponse,
        parsedResponse: parsedPayload,
        error: null,
        provider: providerConfig.provider,
        model: providerResponse.model ?? providerConfig.model,
        promptId: prompt?.id ?? null,
        promptVersion: prompt?.version ?? null,
      };
    } catch (error) {
      const issue =
        error instanceof ZodError ? error.flatten() : { message: String(error) };

      this.logger.error(
        JSON.stringify({
          stage: 'ai_gateway.response_output',
          provider: providerConfig.provider,
          model: providerConfig.model,
          durationMs: Date.now() - startedAt,
          promptVersion: prompt?.version ?? null,
          issue,
        }),
      );

      return {
        ok: false,
        rawResponse: this.extractRawResponse(error),
        parsedResponse: null,
        error: this.stringifyError(error),
        provider: providerConfig.provider,
        model: providerConfig.model,
        promptId: prompt?.id ?? null,
        promptVersion: prompt?.version ?? null,
      };
    }
  }

  private requiresCredentials(input: {
    credentials: {
      strategy: 'none' | 'env';
      value: string | null;
    };
  }) {
    return input.credentials.strategy !== 'none';
  }

  private buildMissingCredentialsError(provider: string) {
    return `AI provider credentials are not configured for provider "${provider}".`;
  }

  private buildUnknownProviderError(provider: string) {
    return `AI provider "${provider}" is not registered in the gateway.`;
  }

  private buildInterpretationPrompt(template: string, locale?: string) {
    return `${template}

Requested locale hint: ${locale ?? 'unknown'}
Return JSON only.`;
  }

  private buildResponsePrompt(template: string, locale?: string) {
    return `${template}

You will receive:
- approved backend context as JSON
- an approved deterministic fallback draft

Rewrite the approved draft into a clear final user-facing answer.
Do not invent tool executions, business facts, missing fields, or continuity state.
Do not hide failures or uncertainty.
Keep the meaning grounded in approved backend context only.
Requested locale hint: ${locale ?? 'unknown'}

Return JSON only with:
- message: string
- assertedOutcome: respond | clarify | execution_succeeded | execution_failed
- assertedExecutionStatus: not_applicable | succeeded | failed
- mentionedMissingFields: string[]
- mentionedApprovedFactKeys: string[]
- mentionedApprovedResultKeys: string[]`;
  }

  private parseInterpretationPayload(rawPayload: string): InterpretationOutput {
    try {
      return interpretationOutputSchema.parse(JSON.parse(rawPayload));
    } catch (error) {
      throw {
        error,
        rawResponse: rawPayload,
      };
    }
  }

  private parseResponsePayload(rawPayload: string) {
    try {
      return aiGeneratedResponseSchema.parse(JSON.parse(rawPayload));
    } catch (error) {
      throw {
        error,
        rawResponse: rawPayload,
      };
    }
  }

  private stringifyError(error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'error' in error &&
      error.error instanceof Error
    ) {
      return error.error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  }

  private extractRawResponse(error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'rawResponse' in error &&
      typeof error.rawResponse === 'string'
    ) {
      return error.rawResponse;
    }

    return null;
  }
}

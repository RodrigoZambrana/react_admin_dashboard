import { Injectable } from '@nestjs/common';
import { ZodError, z } from 'zod';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { PromptService } from '../prompt/prompt.service';
import { RuntimeConfigService } from '../runtime-config/runtime-config.service';
import {
  AiGatewayInterpretationResult,
  InterpretationInput,
  InterpretationOutput,
  ResponseGenerationInput,
} from './ai-gateway.types';
import { MockLanguageModelProvider } from './providers/mock-language-model.provider';
import { OpenAiLanguageModelProvider } from './providers/openai-language-model.provider';

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
    private readonly mockProvider: MockLanguageModelProvider,
    private readonly openAiProvider: OpenAiLanguageModelProvider,
  ) {}

  async interpret(input: InterpretationInput): Promise<AiGatewayInterpretationResult> {
    const providerConfig = this.runtimeConfig.getAiGatewayConfig();
    const provider = this.resolveInterpretationProvider(providerConfig.provider);
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

    if (providerConfig.provider === 'openai' && !providerConfig.apiKey) {
      const error = 'OPENAI_API_KEY is not configured for AI_PROVIDER=openai.';

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
        apiKey: providerConfig.apiKey ?? '',
        model: providerConfig.model,
        timeoutMs: providerConfig.timeoutMs,
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

  async generateResponse(input: ResponseGenerationInput) {
    const promptTemplate =
      input.promptTemplate ??
      (await this.promptService.getActivePrompt('response'))?.value ??
      '';

    return this.mockProvider.generateResponse({
      ...input,
      promptTemplate,
    });
  }

  private resolveInterpretationProvider(providerName: 'mock' | 'openai') {
    if (providerName === 'openai') {
      return this.openAiProvider;
    }

    return this.mockProvider;
  }

  private buildInterpretationPrompt(template: string, locale?: string) {
    return `${template}

Requested locale hint: ${locale ?? 'unknown'}
Return JSON only.`;
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

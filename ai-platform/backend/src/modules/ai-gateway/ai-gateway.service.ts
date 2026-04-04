import { Injectable } from '@nestjs/common';
import { ZodError } from 'zod';

import { interpretationResultSchema } from '../interpretation/interpretation.schemas';
import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { RuntimeConfigService } from '../runtime-config/runtime-config.service';
import { aiGeneratedResponseSchema } from '../response/response.types';
import { isAbortError, throwIfAborted } from '../shared/abort.utils';
import { AiPromptAssemblyService } from './ai-prompt-assembly.service';
import {
  AiGatewayInterpretationResult,
  AiGatewayResponseGenerationResult,
  InterpretationOutput,
} from './ai-gateway.types';
import { LanguageModelProviderRegistry } from './providers/language-model-provider.registry';

@Injectable()
export class AiGatewayService {
  constructor(
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly promptAssemblyService: AiPromptAssemblyService,
    private readonly logger: PipelineLoggerService,
    private readonly providerRegistry: LanguageModelProviderRegistry,
  ) {}

  async interpret(input: import('./ai-gateway.types').InterpretationInput): Promise<AiGatewayInterpretationResult> {
    throwIfAborted(input.abortSignal);
    const providerConfig = await this.runtimeConfig.getAiGatewayConfig();
    const provider = this.providerRegistry.resolve(providerConfig.provider);
    const startedAt = Date.now();
    const assembledPrompt =
      await this.promptAssemblyService.buildInterpretationRequest(input);
    const request = assembledPrompt.request;

    this.logger.debug(
      JSON.stringify({
        stage: 'ai_gateway.request',
        provider: providerConfig.provider,
        model: providerConfig.model,
        promptVersion: assembledPrompt.promptVersion,
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
        abortSignal: input.abortSignal,
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
      if (isAbortError(error) || input.abortSignal?.aborted) {
        throw error;
      }

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
    input: import('./ai-gateway.types').ResponseGenerationInput,
  ): Promise<AiGatewayResponseGenerationResult> {
    throwIfAborted(input.abortSignal);
    const providerConfig = await this.runtimeConfig.getAiGatewayConfig();
    const provider = this.providerRegistry.resolve(providerConfig.provider);
    const startedAt = Date.now();
    const assembledPrompt =
      await this.promptAssemblyService.buildResponseRequest(input);
    const request = assembledPrompt.request;

    this.logger.debug(
      JSON.stringify({
        stage: 'ai_gateway.response_request',
        provider: providerConfig.provider,
        model: providerConfig.model,
        promptVersion: assembledPrompt.promptVersion,
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
          promptVersion: assembledPrompt.promptVersion,
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
        promptId: assembledPrompt.promptId,
        promptVersion: assembledPrompt.promptVersion,
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
        promptId: assembledPrompt.promptId,
        promptVersion: assembledPrompt.promptVersion,
      };
    }

    try {
      const providerResponse = await provider.generateResponse(request, {
        model: providerConfig.model,
        timeoutMs: providerConfig.timeoutMs,
        credentials: providerConfig.credentials,
        providerOptions: providerConfig.providerOptions,
        abortSignal: input.abortSignal,
      });
      const parsedPayload = this.parseResponsePayload(providerResponse.rawResponse);

      this.logger.debug(
        JSON.stringify({
          stage: 'ai_gateway.response_output',
          provider: providerConfig.provider,
          model: providerResponse.model ?? providerConfig.model,
          durationMs: Date.now() - startedAt,
          promptVersion: assembledPrompt.promptVersion,
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
        promptId: assembledPrompt.promptId,
        promptVersion: assembledPrompt.promptVersion,
      };
    } catch (error) {
      if (isAbortError(error) || input.abortSignal?.aborted) {
        throw error;
      }

      const issue =
        error instanceof ZodError ? error.flatten() : { message: String(error) };

      this.logger.error(
        JSON.stringify({
          stage: 'ai_gateway.response_output',
          provider: providerConfig.provider,
          model: providerConfig.model,
          durationMs: Date.now() - startedAt,
          promptVersion: assembledPrompt.promptVersion,
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
        promptId: assembledPrompt.promptId,
        promptVersion: assembledPrompt.promptVersion,
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

  private parseInterpretationPayload(rawPayload: string): InterpretationOutput {
    try {
      return interpretationResultSchema.parse(JSON.parse(rawPayload));
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

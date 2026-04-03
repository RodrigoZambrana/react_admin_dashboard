import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ZodError, z } from 'zod';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import {
  InterpretationInput,
  InterpretationOutput,
  ResponseGenerationInput,
} from './ai-gateway.types';
import { MockLanguageModelProvider } from './providers/mock-language-model.provider';

const interpretationOutputSchema = z.object({
  intent: z.string().min(1),
  entities: z.record(z.unknown()),
  language: z.string().min(2),
  confidence: z.number().min(0).max(1),
});

@Injectable()
export class AiGatewayService {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PipelineLoggerService,
    private readonly mockProvider: MockLanguageModelProvider,
  ) {}

  async interpret(input: InterpretationInput): Promise<InterpretationOutput> {
    const provider = this.resolveProvider();
    const startedAt = Date.now();
    const rawPayload = await provider.interpret(input);

    try {
      const parsedPayload = interpretationOutputSchema.parse(
        JSON.parse(rawPayload),
      );

      this.logger.debug(
        JSON.stringify({
          stage: 'interpretation.raw',
          provider: this.configService.get('AI_PROVIDER', 'mock'),
          durationMs: Date.now() - startedAt,
          payload: parsedPayload,
        }),
      );

      return parsedPayload;
    } catch (error) {
      const issue =
        error instanceof ZodError ? error.flatten() : { message: String(error) };
      this.logger.error(
        JSON.stringify({
          stage: 'interpretation.raw',
          provider: this.configService.get('AI_PROVIDER', 'mock'),
          durationMs: Date.now() - startedAt,
          issue,
        }),
      );
      throw error;
    }
  }

  async generateResponse(input: ResponseGenerationInput) {
    return this.resolveProvider().generateResponse(input);
  }

  private resolveProvider() {
    const providerName = this.configService.get('AI_PROVIDER', 'mock');

    if (providerName !== 'mock') {
      this.logger.warn(
        `Unsupported AI_PROVIDER "${providerName}" detected. Falling back to mock provider.`,
      );
    }

    return this.mockProvider;
  }
}

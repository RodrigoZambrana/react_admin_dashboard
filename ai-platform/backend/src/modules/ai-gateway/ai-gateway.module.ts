import { Module } from '@nestjs/common';

import { PromptModule } from '../prompt/prompt.module';
import { TemporalModule } from '../temporal/temporal.module';
import { AiGatewayService } from './ai-gateway.service';
import { LanguageModelProviderRegistry } from './providers/language-model-provider.registry';
import { LANGUAGE_MODEL_PROVIDERS } from './providers/language-model-provider.tokens';
import { MockLanguageModelProvider } from './providers/mock-language-model.provider';
import { OpenAiLanguageModelProvider } from './providers/openai-language-model.provider';

@Module({
  imports: [TemporalModule, PromptModule],
  providers: [
    MockLanguageModelProvider,
    OpenAiLanguageModelProvider,
    {
      provide: LANGUAGE_MODEL_PROVIDERS,
      useFactory: (
        mockProvider: MockLanguageModelProvider,
        openAiProvider: OpenAiLanguageModelProvider,
      ) => [mockProvider, openAiProvider],
      inject: [MockLanguageModelProvider, OpenAiLanguageModelProvider],
    },
    LanguageModelProviderRegistry,
    AiGatewayService,
  ],
  exports: [AiGatewayService],
})
export class AiGatewayModule {}

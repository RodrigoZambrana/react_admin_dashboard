import { Module } from '@nestjs/common';

import { TemporalModule } from '../temporal/temporal.module';
import { AiGatewayService } from './ai-gateway.service';
import { MockLanguageModelProvider } from './providers/mock-language-model.provider';
import { OpenAiLanguageModelProvider } from './providers/openai-language-model.provider';

@Module({
  imports: [TemporalModule],
  providers: [
    AiGatewayService,
    MockLanguageModelProvider,
    OpenAiLanguageModelProvider,
  ],
  exports: [AiGatewayService],
})
export class AiGatewayModule {}

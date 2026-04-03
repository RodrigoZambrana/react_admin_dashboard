import { Module } from '@nestjs/common';

import { AiGatewayService } from './ai-gateway.service';
import { MockLanguageModelProvider } from './providers/mock-language-model.provider';

@Module({
  providers: [AiGatewayService, MockLanguageModelProvider],
  exports: [AiGatewayService],
})
export class AiGatewayModule {}

import { Module } from '@nestjs/common';

import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { InterpretationService } from './interpretation.service';

@Module({
  imports: [AiGatewayModule],
  providers: [InterpretationService],
  exports: [InterpretationService],
})
export class InterpretationModule {}

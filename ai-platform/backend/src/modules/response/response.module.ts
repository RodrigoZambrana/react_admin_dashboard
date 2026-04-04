import { Module } from '@nestjs/common';

import { AiGatewayModule } from '../ai-gateway/ai-gateway.module';
import { ApprovedResponseContextService } from './approved-response-context.service';
import { ChatResponsePolicyService } from './chat-response-policy.service';
import { ChatResponseService } from './chat-response.service';
import { ResponseGuardrailService } from './response-guardrail.service';

@Module({
  imports: [AiGatewayModule],
  providers: [
    ApprovedResponseContextService,
    ChatResponsePolicyService,
    ChatResponseService,
    ResponseGuardrailService,
  ],
  exports: [
    ApprovedResponseContextService,
    ChatResponsePolicyService,
    ChatResponseService,
    ResponseGuardrailService,
  ],
})
export class ResponseModule {}

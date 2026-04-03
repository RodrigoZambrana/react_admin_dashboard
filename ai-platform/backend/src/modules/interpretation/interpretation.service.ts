import { Injectable } from '@nestjs/common';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { AiGatewayService } from '../ai-gateway/ai-gateway.service';
import { InterpretationResult, interpretationResultSchema } from './interpretation.schemas';

@Injectable()
export class InterpretationService {
  constructor(
    private readonly aiGateway: AiGatewayService,
    private readonly logger: PipelineLoggerService,
  ) {}

  async interpret(
    message: string,
    locale?: string,
    promptTemplate?: string,
  ): Promise<InterpretationResult> {
    const startedAt = Date.now();
    const result = interpretationResultSchema.parse(
      await this.aiGateway.interpret({
        message,
        locale,
        promptTemplate,
      }),
    );

    this.logger.log(
      JSON.stringify({
        stage: 'interpretation',
        durationMs: Date.now() - startedAt,
        output: result,
      }),
    );

    return result;
  }
}

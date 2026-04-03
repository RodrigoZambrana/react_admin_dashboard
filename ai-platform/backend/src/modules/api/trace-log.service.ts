import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { ChatLogRepository } from '../persistence/repositories/chat-log.repository';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';

@Injectable()
export class TraceLogService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly chatLogRepository: ChatLogRepository,
    private readonly logger: PipelineLoggerService,
  ) {}

  async recordStage(input: {
    conversationId?: string;
    stage: string;
    status: string;
    payload: Prisma.InputJsonValue;
    latencyMs?: number;
  }) {
    const log = await this.chatLogRepository.createLog({
      conversationId: input.conversationId,
      traceId: this.tenantContext.getTraceId(),
      stage: input.stage,
      status: input.status,
      payload: input.payload,
      latencyMs: input.latencyMs,
    });

    this.logger.log(
      JSON.stringify({
        traceId: log.traceId,
        stage: log.stage,
        status: log.status,
      }),
    );

    return log;
  }
}

import { Injectable } from '@nestjs/common';

import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import {
  ApprovedToolExecutionRequest,
  ToolExecutionAttempt,
} from './tool.types';
import { ToolEngineService } from './tool-engine.service';

@Injectable()
export class ToolExecutionService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly toolEngine: ToolEngineService,
  ) {}

  async executeApprovedAction(
    request: ApprovedToolExecutionRequest,
  ): Promise<ToolExecutionAttempt | null> {
    if (
      request.decision.action !== 'invoke_tool' ||
      !request.decision.toolName
    ) {
      return null;
    }

    return this.toolEngine.execute(request.decision.toolName, {
      interpretation: request.interpretation,
      tenantId: this.tenantContext.getTenantId(),
      traceId: this.tenantContext.getTraceId(),
    });
  }
}

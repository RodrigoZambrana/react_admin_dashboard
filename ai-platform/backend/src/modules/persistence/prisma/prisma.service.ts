import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import { PipelineLoggerService } from '../../logging/pipeline-logger.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import { applyTenantScope, isTenantScopedModel } from './tenant-prisma-policy';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly logger: PipelineLoggerService,
  ) {
    super();

    this.$use(async (params, next) => {
      const tenantId = this.tenantContext.tryGetTenantId();
      let scopedParams: Prisma.MiddlewareParams = params;

      if (tenantId && isTenantScopedModel(params.model)) {
        scopedParams = applyTenantScope(params, tenantId);
      }

      const startedAt = Date.now();
      const result = await next(scopedParams);

      this.logger.debug(
        JSON.stringify({
          source: 'prisma',
          action: scopedParams.action,
          model: scopedParams.model,
          tenantId: tenantId ?? null,
          durationMs: Date.now() - startedAt,
        }),
      );

      return result;
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Request, Response } from 'express';

import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly configService: ConfigService,
  ) {}

  use(request: Request, response: Response, next: () => void) {
    const headerTenantId = request.header('x-tenant-id');
    const defaultTenantId = this.configService.get<string>('DEFAULT_TENANT_ID');
    const tenantId = headerTenantId ?? defaultTenantId;

    if (!tenantId) {
      response.status(400).json({
        message: 'Missing tenant id. Provide x-tenant-id header or DEFAULT_TENANT_ID.',
      });
      return;
    }

    const traceId = request.header('x-trace-id') ?? randomUUID();
    response.setHeader('x-trace-id', traceId);

    this.tenantContext.run({ tenantId, traceId }, () => {
      const mutableRequest = request as Request & {
        tenantId?: string;
        traceId?: string;
      };
      mutableRequest.tenantId = tenantId;
      mutableRequest.traceId = traceId;
      next();
    });
  }
}

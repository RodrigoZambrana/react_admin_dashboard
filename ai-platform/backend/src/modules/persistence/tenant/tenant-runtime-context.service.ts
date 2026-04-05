import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { TenantContextService } from './tenant-context.service';

export type TenantRuntimeContextView = {
  tenantId: string;
  defaultTenantId: string | null;
  source: 'default_tenant' | 'header_override';
  matchesDefault: boolean;
};

@Injectable()
export class TenantRuntimeContextService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly configService: ConfigService,
  ) {}

  getRuntimeContext(): TenantRuntimeContextView {
    const tenantId = this.tenantContext.getTenantId();
    const defaultTenantId = this.configService.get<string>('DEFAULT_TENANT_ID') ?? null;
    const matchesDefault = Boolean(defaultTenantId) && tenantId === defaultTenantId;

    return {
      tenantId,
      defaultTenantId,
      source: matchesDefault ? 'default_tenant' : 'header_override',
      matchesDefault,
    };
  }
}

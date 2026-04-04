import { Injectable } from '@nestjs/common';

import {
  buildDefaultTenantCapabilityDefinitions,
  TenantCapabilityDefinition,
} from './tenant-capability.types';

@Injectable()
export class StaticTenantCapabilityResolverService {
  resolveForTenant(_tenantId: string | null): TenantCapabilityDefinition[] {
    return buildDefaultTenantCapabilityDefinitions().map((definition) => ({
      ...definition,
      intents: [...definition.intents],
      tools: [...definition.tools],
      config: { ...(definition.config ?? {}) },
    }));
  }
}

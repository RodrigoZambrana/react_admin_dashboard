import { Injectable } from '@nestjs/common';

import { ToolName } from '../decision/decision.types';
import { CanonicalIntent } from '../interpretation/interpretation.schemas';
import { TenantContextService } from '../persistence/tenant/tenant-context.service';
import {
  TenantCapabilityDefinition,
  TenantCapabilityKey,
  TenantCapabilityResolution,
  tenantCapabilityKeys,
} from './tenant-capability.types';
import { StaticTenantCapabilityResolverService } from './static-tenant-capability-resolver.service';

@Injectable()
export class TenantCapabilityRegistryService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly staticResolver: StaticTenantCapabilityResolverService,
  ) {}

  resolveForCurrentTenant(): TenantCapabilityResolution {
    const tenantId = this.tenantContext.tryGetTenantId();
    return this.resolveForTenant(tenantId);
  }

  resolveForTenant(tenantId: string | null): TenantCapabilityResolution {
    const definitions = this.staticResolver.resolveForTenant(tenantId);
    const capabilityByKey = Object.fromEntries(
      tenantCapabilityKeys.map((key) => [
        key,
        this.resolveCapabilityDefinition(key, definitions),
      ]),
    ) as Record<TenantCapabilityKey, TenantCapabilityDefinition>;

    return {
      tenantId,
      capabilities: capabilityByKey,
      enabledKeys: tenantCapabilityKeys.filter(
        (key) => capabilityByKey[key].enabled,
      ),
    };
  }

  isIntentEnabled(intent: CanonicalIntent) {
    const resolution = this.resolveForCurrentTenant();
    return resolution.enabledKeys.some((key) =>
      resolution.capabilities[key].intents.includes(intent),
    );
  }

  isToolEnabled(toolName: ToolName) {
    const resolution = this.resolveForCurrentTenant();
    return resolution.enabledKeys.some((key) =>
      resolution.capabilities[key].tools.includes(toolName),
    );
  }

  private resolveCapabilityDefinition(
    key: TenantCapabilityKey,
    definitions: TenantCapabilityDefinition[],
  ) {
    return (
      definitions.find((definition) => definition.key === key) ?? {
        key,
        enabled: false,
        description: 'Capability not configured for the tenant.',
        intents: [],
        tools: [],
      }
    );
  }
}

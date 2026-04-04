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
import { ManagedTenantCapabilityResolverService } from './managed-tenant-capability-resolver.service';
import { StaticTenantCapabilityResolverService } from './static-tenant-capability-resolver.service';

@Injectable()
export class TenantCapabilityRegistryService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly managedResolver: ManagedTenantCapabilityResolverService,
    private readonly staticResolver: StaticTenantCapabilityResolverService,
  ) {}

  resolveForCurrentTenant(): Promise<TenantCapabilityResolution> {
    const tenantId = this.tenantContext.tryGetTenantId();
    return this.resolveForTenant(tenantId);
  }

  async resolveForTenant(
    tenantId: string | null,
  ): Promise<TenantCapabilityResolution> {
    const baselineDefinitions = this.staticResolver.resolveForTenant(tenantId);
    const managedDefinitions =
      (await this.managedResolver.resolveForTenant(tenantId)) ?? [];
    const definitions = mergeDefinitions(
      baselineDefinitions,
      managedDefinitions,
    );
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

  async isIntentEnabled(intent: CanonicalIntent) {
    const resolution = await this.resolveForCurrentTenant();
    return resolution.enabledKeys.some((key) =>
      resolution.capabilities[key].intents.includes(intent),
    );
  }

  async isToolEnabled(toolName: ToolName) {
    const resolution = await this.resolveForCurrentTenant();
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

function mergeDefinitions(
  baselineDefinitions: TenantCapabilityDefinition[],
  managedDefinitions: TenantCapabilityDefinition[],
) {
  const managedByKey = new Map(
    managedDefinitions.map((definition) => [definition.key, definition]),
  );

  return baselineDefinitions.map((definition) => {
    const managedDefinition = managedByKey.get(definition.key);

    if (!managedDefinition) {
      return definition;
    }

    return {
      ...definition,
      ...managedDefinition,
      intents:
        managedDefinition.intents.length > 0
          ? [...managedDefinition.intents]
          : [...definition.intents],
      tools:
        managedDefinition.tools.length > 0
          ? [...managedDefinition.tools]
          : [...definition.tools],
      config: {
        ...(definition.config ?? {}),
        ...(managedDefinition.config ?? {}),
      },
    };
  });
}

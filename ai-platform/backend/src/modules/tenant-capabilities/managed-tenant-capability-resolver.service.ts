import { Injectable } from '@nestjs/common';

import { CriticalConfigService } from '../critical-config/critical-config.service';
import { CanonicalIntent } from '../interpretation/interpretation.schemas';
import { ToolName } from '../decision/decision.types';
import {
  TenantCapabilityDefinition,
  TenantCapabilitiesResource,
} from './tenant-capability.types';

const supportedIntents = new Set<CanonicalIntent>([
  'GENERAL_CONVERSATION',
  'CLARIFICATION',
  'GET_PRODUCT',
  'CREATE_BOOKING',
  'CREATE_QUOTE',
]);

const supportedTools = new Set<ToolName>([
  'create_booking',
  'create_quote',
  'get_product',
]);

@Injectable()
export class ManagedTenantCapabilityResolverService {
  constructor(private readonly criticalConfigService: CriticalConfigService) {}

  async resolveForTenant(
    _tenantId: string | null,
  ): Promise<TenantCapabilityDefinition[] | null> {
    const resource = await this.criticalConfigService.getActiveConfig(
      'tenant_capabilities',
    );

    if (!resource) {
      return null;
    }

    return this.normalizeCapabilities(resource.value);
  }

  private normalizeCapabilities(resource: TenantCapabilitiesResource) {
    return resource.capabilities.map((capability) => ({
      key: capability.key,
      enabled: capability.enabled,
      description: capability.description,
      intents: capability.intents.filter((intent): intent is CanonicalIntent =>
        supportedIntents.has(intent as CanonicalIntent),
      ),
      tools: capability.tools.filter((tool): tool is ToolName =>
        supportedTools.has(tool as ToolName),
      ),
      config: { ...(capability.config ?? {}) },
    }));
  }
}

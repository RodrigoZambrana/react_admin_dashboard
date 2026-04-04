import { Injectable } from '@nestjs/common';

import {
  TenantCapabilityDefinition,
  TenantCapabilityKey,
} from './tenant-capability.types';

@Injectable()
export class StaticTenantCapabilityResolverService {
  resolveForTenant(_tenantId: string | null): TenantCapabilityDefinition[] {
    return tenantCapabilityDefinitions.map((definition) => ({
      ...definition,
      intents: [...definition.intents],
      tools: [...definition.tools],
    }));
  }
}

const tenantCapabilityDefinitions: TenantCapabilityDefinition[] = [
  {
    key: 'booking',
    enabled: true,
    description: 'Tenant-owned scheduling and appointment workflow.',
    intents: ['CREATE_BOOKING'],
    tools: ['create_booking'],
  },
  {
    key: 'quote',
    enabled: true,
    description: 'Tenant-owned quote and estimation workflow.',
    intents: ['CREATE_QUOTE'],
    tools: ['create_quote'],
  },
  {
    key: 'product_catalog_lookup',
    enabled: true,
    description: 'Tenant-owned product or catalog lookup workflow.',
    intents: ['GET_PRODUCT'],
    tools: ['get_product'],
  },
  {
    key: 'support_post_sale',
    enabled: true,
    description: 'Tenant-owned support and post-sale workflow boundary.',
    intents: ['GENERAL_CONVERSATION', 'CLARIFICATION'],
    tools: [],
  },
];

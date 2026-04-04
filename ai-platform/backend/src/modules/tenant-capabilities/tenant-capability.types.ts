import { CanonicalIntent } from '../interpretation/interpretation.schemas';
import { ToolName } from '../decision/decision.types';
import { z } from 'zod';

export const tenantCapabilityKeys = [
  'booking',
  'quote',
  'product_catalog_lookup',
  'support_post_sale',
] as const;

export type TenantCapabilityKey = (typeof tenantCapabilityKeys)[number];

export type TenantCapabilityDefinition = {
  key: TenantCapabilityKey;
  enabled: boolean;
  description: string;
  intents: CanonicalIntent[];
  tools: ToolName[];
  config?: Record<string, unknown>;
};

export type TenantCapabilityResolution = {
  tenantId: string | null;
  capabilities: Record<TenantCapabilityKey, TenantCapabilityDefinition>;
  enabledKeys: TenantCapabilityKey[];
};

export const tenantCapabilityDefinitionSchema = z.object({
  key: z.enum(tenantCapabilityKeys),
  enabled: z.boolean().default(true),
  description: z.string().min(1),
  intents: z.array(z.string().min(1)).default([]),
  tools: z.array(z.string().min(1)).default([]),
  config: z.record(z.unknown()).default({}),
});

export const tenantCapabilitiesResourceSchema = z.object({
  capabilities: z.array(tenantCapabilityDefinitionSchema).default([]),
});

export type TenantCapabilitiesResource = z.infer<
  typeof tenantCapabilitiesResourceSchema
>;

const tenantCapabilityDefaults: Record<TenantCapabilityKey, TenantCapabilityDefinition> =
  {
    booking: {
      key: 'booking',
      enabled: true,
      description: 'Tenant-owned scheduling and appointment workflow.',
      intents: ['CREATE_BOOKING'],
      tools: ['create_booking'],
      config: {},
    },
    quote: {
      key: 'quote',
      enabled: true,
      description: 'Tenant-owned quote and estimation workflow.',
      intents: ['CREATE_QUOTE'],
      tools: ['create_quote'],
      config: {},
    },
    product_catalog_lookup: {
      key: 'product_catalog_lookup',
      enabled: true,
      description: 'Tenant-owned product or catalog lookup workflow.',
      intents: ['GET_PRODUCT'],
      tools: ['get_product'],
      config: {},
    },
    support_post_sale: {
      key: 'support_post_sale',
      enabled: true,
      description: 'Tenant-owned support and post-sale workflow boundary.',
      intents: ['GENERAL_CONVERSATION', 'CLARIFICATION'],
      tools: [],
      config: {},
    },
  };

export function buildDefaultTenantCapabilityDefinitions() {
  return tenantCapabilityKeys.map((key) => ({
    ...tenantCapabilityDefaults[key],
    intents: [...tenantCapabilityDefaults[key].intents],
    tools: [...tenantCapabilityDefaults[key].tools],
    config: { ...(tenantCapabilityDefaults[key].config ?? {}) },
  }));
}

export function buildDefaultTenantCapabilitiesResource(): TenantCapabilitiesResource {
  return {
    capabilities: buildDefaultTenantCapabilityDefinitions(),
  };
}

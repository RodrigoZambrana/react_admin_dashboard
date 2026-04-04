import { CanonicalIntent } from '../interpretation/interpretation.schemas';
import { ToolName } from '../decision/decision.types';

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
};

export type TenantCapabilityResolution = {
  tenantId: string | null;
  capabilities: Record<TenantCapabilityKey, TenantCapabilityDefinition>;
  enabledKeys: TenantCapabilityKey[];
};

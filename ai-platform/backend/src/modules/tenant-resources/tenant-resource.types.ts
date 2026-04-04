export const tenantResourceKinds = [
  'documents',
  'catalogs',
  'pricing',
  'payment_terms',
  'hours',
  'references',
  'policies',
  'business_metadata',
] as const;

export type TenantResourceKind = (typeof tenantResourceKinds)[number];

export type TenantResourceBoundary = {
  kind: TenantResourceKind;
  description: string;
  sourceBoundary:
    | 'uploaded_document'
    | 'managed_runtime_resource'
    | 'catalog_adapter'
    | 'tenant_policy_resource'
    | 'tenant_business_record';
};

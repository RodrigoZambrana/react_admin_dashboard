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

export const tenantResourceAdapterKinds = [
  'text_upload',
  'html_upload',
  'pdf_upload',
  'docx_upload',
  'xlsx_upload',
  'url_fetch',
  'structured_catalog_upload',
  'rest_catalog',
] as const;

export type TenantResourceAdapterKind =
  (typeof tenantResourceAdapterKinds)[number];

export type TenantResourceBoundary = {
  kind: TenantResourceKind;
  description: string;
  sourceBoundary:
    | 'uploaded_document'
    | 'managed_runtime_resource'
    | 'catalog_adapter'
    | 'tenant_policy_resource'
    | 'tenant_business_record'
    | 'external_connector';
};

export type TenantResourceUploadInput = {
  sourceName: string;
  mimeType?: string | null;
  buffer: Buffer;
  language?: string | null;
};

export type TenantResourceUrlInput = {
  url: string;
  title?: string | null;
  language?: string | null;
};

export type TenantResourceStructuredRow = Record<string, string>;

export type TenantResourceExtraction =
  | {
      adapterKind: TenantResourceAdapterKind;
      contentType: 'text';
      sourceName?: string | null;
      mimeType?: string | null;
      language?: string | null;
      title?: string | null;
      textContent: string;
      metadata?: Record<string, unknown>;
    }
  | {
      adapterKind: TenantResourceAdapterKind;
      contentType: 'table';
      sourceName?: string | null;
      mimeType?: string | null;
      language?: string | null;
      title?: string | null;
      rows: TenantResourceStructuredRow[];
      metadata?: Record<string, unknown>;
    };

export interface TenantResourceUploadAdapter {
  readonly kind: TenantResourceAdapterKind;
  supportsUpload(input: TenantResourceUploadInput): boolean;
  extractFromUpload(
    input: TenantResourceUploadInput,
  ): Promise<TenantResourceExtraction>;
}

export interface TenantResourceUrlAdapter {
  readonly kind: TenantResourceAdapterKind;
  supportsUrl(input: TenantResourceUrlInput): boolean;
  extractFromUrl(input: TenantResourceUrlInput): Promise<TenantResourceExtraction>;
}

import { RuntimeManagedResourceProvider } from '../runtime-resources/runtime-managed-resource.provider';
import { ResponseFallbackCatalogResource } from './response-fallback.types';

export abstract class ResponseFallbackProvider extends RuntimeManagedResourceProvider<
  string,
  ResponseFallbackCatalogResource
> {
  abstract resolveCatalog(
    locale?: string | null,
  ): Promise<ResponseFallbackCatalogResource>;
}

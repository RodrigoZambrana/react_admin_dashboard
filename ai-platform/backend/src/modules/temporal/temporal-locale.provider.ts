import { TemporalLocaleResource } from './temporal-locale.types';
import { RuntimeManagedResourceProvider } from '../runtime-resources/runtime-managed-resource.provider';

export abstract class TemporalLocaleProvider extends RuntimeManagedResourceProvider<
  string,
  TemporalLocaleResource
> {
  abstract listResources(): Promise<TemporalLocaleResource[]>;
  abstract getSupportedLocales(): Promise<string[]>;
  abstract resolveResource(
    locale?: string | null,
  ): Promise<TemporalLocaleResource | undefined>;
  abstract resolveResources(
    locale?: string | null,
  ): Promise<TemporalLocaleResource[]>;
}

import { TemporalLocaleResource } from './temporal-locale.types';

export abstract class TemporalLocaleProvider {
  abstract listResources(): TemporalLocaleResource[];
  abstract getSupportedLocales(): string[];
  abstract resolveResource(
    locale?: string | null,
  ): TemporalLocaleResource | undefined;
  abstract resolveResources(locale?: string | null): TemporalLocaleResource[];
}

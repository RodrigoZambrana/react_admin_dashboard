import { Injectable } from '@nestjs/common';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

import { TemporalLocaleResource } from './temporal-locale.types';

const temporalLocaleResourceSchema = z.object({
  locale: z.string().min(2),
  datePhrases: z.array(z.string().min(1)).min(1),
  timeJoiners: z.array(z.string().min(1)),
});

@Injectable()
export class TemporalLocaleRegistryService {
  private readonly resources = this.loadResources();

  listResources(): TemporalLocaleResource[] {
    return Array.from(this.resources.values());
  }

  getSupportedLocales(): string[] {
    return Array.from(this.resources.keys());
  }

  resolveResource(locale?: string | null): TemporalLocaleResource | undefined {
    const normalizedLocale = normalizeLocaleCode(locale);

    if (!normalizedLocale) {
      return undefined;
    }

    return (
      this.resources.get(normalizedLocale) ??
      this.resources.get(normalizedLocale.split('-')[0])
    );
  }

  resolveResources(locale?: string | null): TemporalLocaleResource[] {
    const resolved = this.resolveResource(locale);

    return resolved ? [resolved] : this.listResources();
  }

  private loadResources() {
    const directory = resolve(__dirname, '../../resources/temporal/locales');
    const entries = readdirSync(directory).filter((entry) => entry.endsWith('.json'));

    return new Map(
      entries.map((entry) => {
        const raw = readFileSync(resolve(directory, entry), 'utf8');
        const resource = temporalLocaleResourceSchema.parse(
          JSON.parse(raw),
        ) as TemporalLocaleResource;

        return [resource.locale.toLowerCase(), resource];
      }),
    );
  }
}

function normalizeLocaleCode(locale?: string | null) {
  const normalized = locale?.trim().toLowerCase();
  return normalized ? normalized : null;
}

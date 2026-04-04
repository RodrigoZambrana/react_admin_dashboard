import { BadRequestException, Injectable } from '@nestjs/common';

import {
  TenantResourceExtraction,
  TenantResourceUrlAdapter,
  TenantResourceUrlInput,
} from './tenant-resource.types';
import {
  normalizeExtractedText,
  stripHtml,
} from './tenant-resource-text.utils';

@Injectable()
export class UrlDocumentResourceAdapter implements TenantResourceUrlAdapter {
  readonly kind = 'url_fetch' as const;

  supportsUrl(input: TenantResourceUrlInput) {
    try {
      const url = new URL(input.url);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async extractFromUrl(
    input: TenantResourceUrlInput,
  ): Promise<TenantResourceExtraction> {
    const response = await fetch(input.url, {
      headers: {
        Accept: 'text/plain,text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new BadRequestException(
        `Unable to fetch document URL "${input.url}" (${response.status})`,
      );
    }

    const mimeType = response.headers.get('content-type')?.split(';')[0] ?? null;
    const raw = await response.text();
    const text =
      mimeType === 'text/html' || mimeType === 'application/xhtml+xml'
        ? stripHtml(raw)
        : raw;

    return {
      adapterKind: this.kind,
      contentType: 'text',
      sourceName: input.url,
      title: input.title ?? null,
      mimeType,
      language: input.language ?? null,
      textContent: normalizeExtractedText(text),
      metadata: {
        url: input.url,
      },
    };
  }
}

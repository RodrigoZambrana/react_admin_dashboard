import { Injectable } from '@nestjs/common';
import { extname } from 'node:path';

import {
  TenantResourceExtraction,
  TenantResourceUploadAdapter,
  TenantResourceUploadInput,
} from './tenant-resource.types';
import {
  normalizeExtractedText,
  stripHtml,
} from './tenant-resource-text.utils';

const textMimeTypes = new Set([
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/json',
  'text/html',
  'application/xhtml+xml',
  'application/octet-stream',
]);

@Injectable()
export class UploadTextDocumentAdapter implements TenantResourceUploadAdapter {
  readonly kind = 'text_upload' as const;

  supportsUpload(input: TenantResourceUploadInput) {
    const mimeType = input.mimeType?.trim().toLowerCase() || null;
    const extension = extname(input.sourceName).toLowerCase();

    if (mimeType && textMimeTypes.has(mimeType)) {
      return true;
    }

    return ['.txt', '.md', '.markdown', '.json', '.html', '.htm'].includes(
      extension,
    );
  }

  async extractFromUpload(
    input: TenantResourceUploadInput,
  ): Promise<TenantResourceExtraction> {
    const mimeType = input.mimeType?.trim().toLowerCase() || null;
    const raw = input.buffer.toString('utf8');
    const text =
      mimeType === 'text/html' || mimeType === 'application/xhtml+xml'
        ? stripHtml(raw)
        : raw;

    return {
      adapterKind:
        mimeType === 'text/html' || mimeType === 'application/xhtml+xml'
          ? 'html_upload'
          : 'text_upload',
      contentType: 'text',
      sourceName: input.sourceName,
      mimeType,
      language: input.language ?? null,
      textContent: normalizeExtractedText(text),
    };
  }
}

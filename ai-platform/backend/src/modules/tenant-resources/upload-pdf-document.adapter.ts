import { Injectable } from '@nestjs/common';
import { extname } from 'node:path';
import pdfParse from 'pdf-parse';

import {
  TenantResourceExtraction,
  TenantResourceUploadAdapter,
  TenantResourceUploadInput,
} from './tenant-resource.types';
import { normalizeExtractedText } from './tenant-resource-text.utils';

@Injectable()
export class UploadPdfDocumentAdapter implements TenantResourceUploadAdapter {
  readonly kind = 'pdf_upload' as const;

  supportsUpload(input: TenantResourceUploadInput) {
    const mimeType = input.mimeType?.trim().toLowerCase() || null;
    const extension = extname(input.sourceName).toLowerCase();

    return mimeType === 'application/pdf' || extension === '.pdf';
  }

  async extractFromUpload(
    input: TenantResourceUploadInput,
  ): Promise<TenantResourceExtraction> {
    const parsed = await pdfParse(input.buffer);

    return {
      adapterKind: this.kind,
      contentType: 'text',
      sourceName: input.sourceName,
      mimeType: input.mimeType ?? 'application/pdf',
      language: input.language ?? null,
      textContent: normalizeExtractedText(parsed.text),
      metadata: {
        pageCount: parsed.numpages,
      },
    };
  }
}

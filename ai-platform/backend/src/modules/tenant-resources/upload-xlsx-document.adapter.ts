import { Injectable } from '@nestjs/common';
import { extname } from 'node:path';

import {
  extractSpreadsheetRows,
  stringifyStructuredRows,
} from './office-archive.utils';
import {
  TenantResourceExtraction,
  TenantResourceUploadAdapter,
  TenantResourceUploadInput,
} from './tenant-resource.types';

@Injectable()
export class UploadXlsxDocumentAdapter implements TenantResourceUploadAdapter {
  readonly kind = 'xlsx_upload' as const;

  supportsUpload(input: TenantResourceUploadInput) {
    const mimeType = input.mimeType?.trim().toLowerCase() || null;
    const extension = extname(input.sourceName).toLowerCase();

    return (
      mimeType ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      extension === '.xlsx'
    );
  }

  async extractFromUpload(
    input: TenantResourceUploadInput,
  ): Promise<TenantResourceExtraction> {
    const rows = extractSpreadsheetRows(input.buffer);

    return {
      adapterKind: this.kind,
      contentType: 'text',
      sourceName: input.sourceName,
      mimeType:
        input.mimeType ??
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      language: input.language ?? null,
      textContent: stringifyStructuredRows(rows),
      metadata: {
        rowCount: rows.length,
      },
    };
  }
}

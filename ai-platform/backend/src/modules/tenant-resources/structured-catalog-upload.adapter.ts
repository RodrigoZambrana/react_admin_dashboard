import { BadRequestException, Injectable } from '@nestjs/common';
import { extname } from 'node:path';

import { extractSpreadsheetRows } from './office-archive.utils';
import {
  normalizeExtractedText,
  normalizeStructuredCell,
} from './tenant-resource-text.utils';
import {
  TenantResourceExtraction,
  TenantResourceStructuredRow,
  TenantResourceUploadAdapter,
  TenantResourceUploadInput,
} from './tenant-resource.types';

@Injectable()
export class StructuredCatalogUploadAdapter implements TenantResourceUploadAdapter {
  readonly kind = 'structured_catalog_upload' as const;

  supportsUpload(input: TenantResourceUploadInput) {
    const mimeType = input.mimeType?.trim().toLowerCase() || null;
    const extension = extname(input.sourceName).toLowerCase();

    return (
      mimeType === 'text/csv' ||
      mimeType === 'application/csv' ||
      mimeType === 'application/json' ||
      mimeType ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      extension === '.csv' ||
      extension === '.json' ||
      extension === '.xlsx'
    );
  }

  async extractFromUpload(
    input: TenantResourceUploadInput,
  ): Promise<TenantResourceExtraction> {
    const extension = extname(input.sourceName).toLowerCase();
    const mimeType = input.mimeType?.trim().toLowerCase() || null;
    const rows =
      extension === '.xlsx' ||
      mimeType ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ? extractSpreadsheetRows(input.buffer)
        : extension === '.json' || mimeType === 'application/json'
          ? parseJsonRows(input.buffer.toString('utf8'))
          : parseCsvRows(input.buffer.toString('utf8'));

    if (rows.length === 0) {
      throw new BadRequestException(
        'Structured catalog upload does not contain usable rows',
      );
    }

    return {
      adapterKind: this.kind,
      contentType: 'table',
      sourceName: input.sourceName,
      mimeType,
      language: input.language ?? null,
      rows,
      metadata: {
        rowCount: rows.length,
      },
    };
  }
}

function parseJsonRows(raw: string): TenantResourceStructuredRow[] {
  const parsed = JSON.parse(raw) as unknown;
  const items: unknown[] = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === 'object' &&
        'items' in parsed &&
        Array.isArray((parsed as { items?: unknown[] }).items)
      ? ((parsed as { items?: unknown[] }).items ?? [])
      : [];

  return items
    .filter((item): item is Record<string, unknown> =>
      Boolean(item && typeof item === 'object' && !Array.isArray(item)),
    )
    .map((item) =>
      Object.fromEntries(
        Object.entries(item).map(([key, value]) => [key, normalizeStructuredCell(value)]),
      ),
    )
    .filter((row: TenantResourceStructuredRow) =>
      Object.values(row).some((value) => value.length > 0),
    );
}

function parseCsvRows(raw: string): TenantResourceStructuredRow[] {
  const rows = parseCsv(raw);

  if (rows.length <= 1) {
    return [];
  }

  const [headerRow, ...bodyRows] = rows;
  const headers = headerRow.map((value, index) => value || `column_${index + 1}`);

  return bodyRows
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, normalizeStructuredCell(row[index])]),
      ),
    )
    .filter((row: TenantResourceStructuredRow) =>
      Object.values(row).some((value) => value.length > 0),
    );
}

function parseCsv(raw: string) {
  const text = normalizeExtractedText(raw);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = '';
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        currentValue += '"';
        index += 1;
        continue;
      }

      insideQuotes = !insideQuotes;
      continue;
    }

    if (!insideQuotes && character === ',') {
      currentRow.push(currentValue.trim());
      currentValue = '';
      continue;
    }

    if (!insideQuotes && character === '\n') {
      currentRow.push(currentValue.trim());
      rows.push(currentRow);
      currentRow = [];
      currentValue = '';
      continue;
    }

    currentValue += character;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue.trim());
    rows.push(currentRow);
  }

  return rows.filter((row) => row.some((value) => value.length > 0));
}

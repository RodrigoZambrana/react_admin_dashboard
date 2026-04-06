import AdmZip from 'adm-zip';

import { decodeHtmlEntities, normalizeExtractedText } from './tenant-resource-text.utils';
import { TenantResourceStructuredRow } from './tenant-resource.types';

type SpreadsheetSheet = {
  name: string;
  rows: TenantResourceStructuredRow[];
};

export function extractDocxText(buffer: Buffer) {
  const zip = new AdmZip(buffer);
  const xml = zip.readAsText('word/document.xml');

  if (!xml) {
    return '';
  }

  const paragraphs =
    xml.match(/<w:p[\s\S]*?<\/w:p>/g) ??
    xml.match(/<w:tr[\s\S]*?<\/w:tr>/g) ??
    [xml];
  const lines = paragraphs
    .map((paragraph: string) => extractDocxParagraphText(paragraph))
    .filter((value: string) => value.length > 0);

  return normalizeExtractedText(lines.join('\n\n'));
}

function extractDocxParagraphText(value: string) {
  const withInlineBreaks = value
    .replace(/<w:tab\s*\/>/g, '\t')
    .replace(/<w:br\s*\/>/g, '\n');
  const textNodes = Array.from(
    withInlineBreaks.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g),
    (match) => decodeHtmlEntities(match[1] ?? ''),
  );
  const fallbackText = withInlineBreaks.replace(/<[^>]+>/g, ' ');
  const rawText = textNodes.length > 0 ? textNodes.join(' ') : fallbackText;

  return decodeHtmlEntities(rawText)
    .replace(/\s*\n\s*/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function extractSpreadsheetRows(buffer: Buffer): TenantResourceStructuredRow[] {
  return extractSpreadsheetSheets(buffer).flatMap((sheet) => sheet.rows);
}

export function extractSpreadsheetSheets(buffer: Buffer): SpreadsheetSheet[] {
  const zip = new AdmZip(buffer);
  const sharedStrings = parseSharedStrings(zip.readAsText('xl/sharedStrings.xml'));
  const workbook = zip.readAsText('xl/workbook.xml');
  const relationships = zip.readAsText('xl/_rels/workbook.xml.rels');
  const sheetTargets = resolveSheetTargets(workbook, relationships);
  const sheets: SpreadsheetSheet[] = [];

  for (const target of sheetTargets) {
    const sheetXml = zip.readAsText(target.target);

    if (!sheetXml) {
      continue;
    }

    const parsedRows = parseWorksheetRows(sheetXml, sharedStrings);
    const normalizedRows = normalizeStructuredRows(parsedRows);

    if (normalizedRows.length === 0) {
      continue;
    }

    sheets.push({
      name: target.name,
      rows: normalizedRows,
    });
  }

  return sheets;
}

export function stringifyStructuredRows(rows: TenantResourceStructuredRow[]) {
  return normalizeExtractedText(
    rows
      .map((row) =>
        Object.entries(row)
          .map(([key, value]) => `${key}: ${value}`)
          .join(' | '),
      )
      .join('\n'),
  );
}

export function stringifyStructuredSheets(sheets: SpreadsheetSheet[]) {
  return normalizeExtractedText(
    sheets
      .map((sheet) => {
        const body = sheet.rows
          .map((row) =>
            Object.entries(row)
              .map(([key, value]) => `${key}: ${value}`)
              .join(' | '),
          )
          .join('\n');

        return `Sheet: ${sheet.name}\n${body}`;
      })
      .join('\n\n'),
  );
}

function parseSharedStrings(xml: string) {
  if (!xml) {
    return [];
  }

  const matches = xml.match(/<si[\s\S]*?<\/si>/g) ?? [];
  return matches.map((entry) =>
    decodeHtmlEntities(
      (entry.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [])
        .map((part) => part.replace(/<[^>]+>/g, ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    ),
  );
}

function resolveSheetTargets(workbookXml: string, relationshipsXml: string) {
  const relationshipById = new Map<string, string>();

  for (const match of relationshipsXml.matchAll(
    /<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g,
  )) {
    const relationshipId = match[1];
    const target = match[2];
    relationshipById.set(relationshipId, `xl/${target.replace(/^\//, '')}`);
  }

  const targets: Array<{ name: string; target: string }> = [];

  for (const match of workbookXml.matchAll(
    /<sheet[^>]+name="([^"]+)"[^>]+r:id="([^"]+)"/g,
  )) {
    const name = decodeHtmlEntities(match[1] ?? '').trim() || 'Sheet1';
    const target = relationshipById.get(match[2]);

    if (target) {
      targets.push({ name, target });
    }
  }

  if (targets.length === 0) {
    targets.push({ name: 'Sheet1', target: 'xl/worksheets/sheet1.xml' });
  }

  return targets;
}

function parseWorksheetRows(xml: string, sharedStrings: string[]) {
  const rowMatches = xml.match(/<row[\s\S]*?<\/row>/g) ?? [];

  return rowMatches.map((rowXml) => {
    const cells = Array.from(
      rowXml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g),
      (cellMatch) => {
        const attributes = cellMatch[1];
        const innerXml = cellMatch[2];
        const refMatch = attributes.match(/r="([A-Z]+)\d+"/);
        const typeMatch = attributes.match(/t="([^"]+)"/);
        const ref = refMatch?.[1] ?? '';
        const type = typeMatch?.[1] ?? null;
        const inlineText = innerXml
          .replace(/<is>/g, '')
          .replace(/<\/is>/g, '')
          .match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1];
        const value = innerXml.match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? inlineText ?? '';

        return {
          index: columnLettersToIndex(ref),
          value: resolveCellValue(value, type, sharedStrings),
        };
      },
    );

    const width = cells.reduce((max, cell) => Math.max(max, cell.index + 1), 0);
    const row = Array.from({ length: width }, () => '');

    for (const cell of cells) {
      row[cell.index] = cell.value;
    }

    return row;
  });
}

function resolveCellValue(value: string, type: string | null, sharedStrings: string[]) {
  if (type === 's') {
    const index = Number(value);
    return Number.isFinite(index) ? sharedStrings[index] ?? '' : '';
  }

  return decodeHtmlEntities(String(value ?? '').trim());
}

function columnLettersToIndex(letters: string) {
  if (!letters) {
    return 0;
  }

  let index = 0;

  for (const character of letters) {
    index = index * 26 + (character.charCodeAt(0) - 64);
  }

  return Math.max(index - 1, 0);
}

function normalizeStructuredRows(rows: string[][]) {
  const normalizedRows = rows
    .map((row) => row.map((value) => String(value ?? '').trim()))
    .filter((row) => row.some((value) => value.length > 0));

  if (normalizedRows.length === 0) {
    return [];
  }

  const [headerRow, ...bodyRows] = normalizedRows;
  const headers = headerRow.map((header, index) =>
    header.length > 0 ? header : `column_${index + 1}`,
  );

  return bodyRows
    .map((row) =>
      Object.fromEntries(
        headers.map((header, index) => [header, row[index] ?? '']),
      ),
    )
    .filter((row) => Object.values(row).some((value) => value.length > 0));
}

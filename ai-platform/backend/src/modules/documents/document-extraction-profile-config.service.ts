import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { normalizeDocumentKnowledgeText } from './document-knowledge-extraction.utils';
import { DocumentExtractionProfileId } from './document-extraction-profile.types';

type RawDocumentExtractionProfileResource = {
  locale: string;
  axes: {
    product_types?: {
      listLeadTerms?: string[];
    };
    materials?: {
      listLeadPhrases?: string[];
      listLeadTerms?: string[];
    };
    operation_modes?: {
      termFamilies?: Record<string, string[]>;
    };
    color_options?: {
      listLeadTerms?: string[];
      varietySignals?: string[];
      unspecifiedAxes?: string[];
    };
    suitability?: {
      leadPhrases?: string[];
    };
  };
  matchingHints?: {
    listStopTerms?: string[];
    oversizedClaimTailPhrases?: string[];
    conjunctionTerms?: string[];
  };
};

export type CompiledDocumentExtractionProfileConfig = {
  profileId: DocumentExtractionProfileId;
  locale: string;
  productTypes?: {
    listPattern: RegExp;
  };
  materials?: {
    listPatterns: RegExp[];
  };
  operationModes?: {
    normalizedTerms: Array<{
      normalizedValue: string;
      sourceTerms: string[];
    }>;
  };
  colorOptions?: {
    listPattern: RegExp;
    varietySignals: string[];
    unspecifiedAxes: string[];
  };
  suitability?: {
    pattern: RegExp;
  };
  matchingHints: {
    listStopTerms: string[];
    oversizedClaimTailPattern: RegExp | null;
    conjunctionTerms: string[];
  };
};

@Injectable()
export class DocumentExtractionProfileConfigService {
  private readonly cache = new Map<string, CompiledDocumentExtractionProfileConfig>();

  resolveCompiledConfig(input: {
    profileId: DocumentExtractionProfileId;
    locale?: string | null;
  }) {
    const locale = resolveProfileLocale(input.locale);
    const cacheKey = `${input.profileId}:${locale}`;
    const cached = this.cache.get(cacheKey);

    if (cached) {
      return cached;
    }

    const raw = this.loadResource({
      profileId: input.profileId,
      locale,
    });
    const compiled = compileProfileResource(input.profileId, raw);
    this.cache.set(cacheKey, compiled);

    return compiled;
  }

  private loadResource(input: {
    profileId: DocumentExtractionProfileId;
    locale: string;
  }) {
    const candidatePath = join(
      __dirname,
      '../../resources/document-extraction-profiles',
      input.profileId,
      `${input.locale}.json`,
    );
    const fallbackPath = join(
      __dirname,
      '../../resources/document-extraction-profiles',
      input.profileId,
      'es.json',
    );
    const resolvedPath = existsSync(candidatePath) ? candidatePath : fallbackPath;

    return JSON.parse(
      readFileSync(resolvedPath, 'utf8'),
    ) as RawDocumentExtractionProfileResource;
  }
}

function compileProfileResource(
  profileId: DocumentExtractionProfileId,
  raw: RawDocumentExtractionProfileResource,
): CompiledDocumentExtractionProfileConfig {
  const oversizedClaimTailPattern = compileOptionalTailPattern(
    raw.matchingHints?.oversizedClaimTailPhrases ?? [],
  );

  return {
    profileId,
    locale: raw.locale,
    productTypes: raw.axes.product_types?.listLeadTerms?.length
      ? {
          listPattern: compileListLeadPattern(raw.axes.product_types.listLeadTerms),
        }
      : undefined,
    materials:
      raw.axes.materials &&
      (raw.axes.materials.listLeadPhrases?.length ||
        raw.axes.materials.listLeadTerms?.length)
        ? {
            listPatterns: [
              ...compilePhraseCapturePatterns(
                raw.axes.materials.listLeadPhrases ?? [],
                raw.matchingHints?.listStopTerms ?? [],
              ),
              ...compileTermListPatterns(raw.axes.materials.listLeadTerms ?? []),
            ],
          }
        : undefined,
    operationModes:
      raw.axes.operation_modes?.termFamilies &&
      Object.keys(raw.axes.operation_modes.termFamilies).length > 0
        ? {
            normalizedTerms: Object.entries(
              raw.axes.operation_modes.termFamilies,
            ).map(([normalizedValue, sourceTerms]) => ({
              normalizedValue,
              sourceTerms: sourceTerms.map((term) => term.trim()).filter(Boolean),
            })),
          }
        : undefined,
    colorOptions:
      raw.axes.color_options?.listLeadTerms?.length ||
      raw.axes.color_options?.varietySignals?.length
        ? {
            listPattern: compileListLeadPattern(
              raw.axes.color_options?.listLeadTerms ?? ['color', 'colors'],
            ),
            varietySignals:
              raw.axes.color_options?.varietySignals?.map((signal) =>
                normalizeDocumentKnowledgeText(signal),
              ) ?? [],
            unspecifiedAxes: raw.axes.color_options?.unspecifiedAxes ?? [],
          }
        : undefined,
    suitability: raw.axes.suitability?.leadPhrases?.length
      ? {
          pattern: compileLeadPhraseCapturePattern(raw.axes.suitability.leadPhrases),
        }
      : undefined,
    matchingHints: {
      listStopTerms:
        raw.matchingHints?.listStopTerms?.map((term) =>
          normalizeDocumentKnowledgeText(term),
        ) ?? [],
      oversizedClaimTailPattern,
      conjunctionTerms:
        raw.matchingHints?.conjunctionTerms?.map((term) =>
          normalizeDocumentKnowledgeText(term),
        ) ?? [],
    },
  };
}

function compileListLeadPattern(terms: string[]) {
  const escapedTerms = buildAlternation(terms);
  return new RegExp(`(?:${escapedTerms})\\s*[:\\-]?\\s*(.+)$`, 'iu');
}

function compilePhraseCapturePatterns(phrases: string[], stopTerms: string[]) {
  const stopAlternation =
    stopTerms.length > 0 ? `(?:${buildAlternation(stopTerms)})` : null;

  return phrases.map(
    (phrase) =>
      new RegExp(
        `(?:${escapeRegExp(phrase)})\\s+(.+?)(?:,?\\s+${stopAlternation ?? '(?:$^)'}\\b|[.;]|$)`,
        'iu',
      ),
  );
}

function compileTermListPatterns(terms: string[]) {
  return terms.map(
    (term) =>
      new RegExp(`(?:${escapeRegExp(term)})\\s*[:\\-]?\\s*(.+)$`, 'iu'),
  );
}

function compileLeadPhraseCapturePattern(phrases: string[]) {
  return new RegExp(`(?:${buildAlternation(phrases)})\\s+(.+)$`, 'iu');
}

function compileOptionalTailPattern(phrases: string[]) {
  if (phrases.length === 0) {
    return null;
  }

  return new RegExp(`\\b(?:${buildAlternation(phrases)})\\b.*$`, 'iu');
}

function buildAlternation(values: string[]) {
  return values.map((value) => escapeRegExp(value)).join('|');
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveProfileLocale(locale?: string | null) {
  const family = String(locale ?? '')
    .toLowerCase()
    .split(/[-_]/u)[0]
    .trim();

  return family === 'en' ? 'en' : 'es';
}

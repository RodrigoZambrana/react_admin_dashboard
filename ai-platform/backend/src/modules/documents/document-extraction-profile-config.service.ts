import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Prisma } from '@prisma/client';

import { DocumentExtractionProfileConfigRepository } from '../persistence/repositories/document-extraction-profile-config.repository';
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

export type DocumentExtractionProfileDerivedHints = {
  observedSections?: string[];
  observedAxes?: string[];
  observedValuesByAxis?: Record<string, string[]>;
  supportCounts?: {
    explicit?: number;
    partial?: number;
    boundedInference?: number;
  };
};

export type DocumentExtractionProfileConfigSource =
  | 'platform_default'
  | 'tenant_derived'
  | 'mixed';

export type DocumentExtractionProfileConfigResolution = {
  profileId: DocumentExtractionProfileId;
  locale: string;
  tenantDerivedApplied: boolean;
  derivedFromDocuments: Array<{
    documentId: string;
    title: string;
    updatedAt: string;
  }>;
  sources: {
    axes: Record<string, DocumentExtractionProfileConfigSource>;
    matchingHints: Record<string, DocumentExtractionProfileConfigSource>;
    derivedHints: DocumentExtractionProfileConfigSource;
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
  derivedHints: DocumentExtractionProfileDerivedHints | null;
  resolution: DocumentExtractionProfileConfigResolution;
};

@Injectable()
export class DocumentExtractionProfileConfigService {
  private readonly defaultResourceCache = new Map<
    string,
    RawDocumentExtractionProfileResource
  >();

  constructor(
    private readonly repository: DocumentExtractionProfileConfigRepository | null = null,
  ) {}

  resolveCompiledConfig(input: {
    profileId: DocumentExtractionProfileId;
    locale?: string | null;
    derivedHints?: DocumentExtractionProfileDerivedHints | null;
    derivedFromDocuments?: Array<{
      documentId: string;
      title: string;
      updatedAt: string;
    }>;
  }) {
    const locale = resolveProfileLocale(input.locale);
    const raw = this.loadDefaultResource({
      profileId: input.profileId,
      locale,
    });

    return compileProfileResource({
      profileId: input.profileId,
      raw,
      derivedHints: input.derivedHints ?? null,
      derivedFromDocuments: input.derivedFromDocuments ?? [],
    });
  }

  async resolveEffectiveConfigs(input: {
    profileIds: readonly DocumentExtractionProfileId[];
    locale?: string | null;
    documentId?: string;
  }) {
    const locale = resolveProfileLocale(input.locale);
    const records =
      !this.repository
        ? []
        : input.documentId && input.documentId.length > 0
          ? await this.repository.listByDocumentAndProfiles({
            documentId: input.documentId,
            profileIds: input.profileIds,
            locale,
          })
          : await this.repository.listActiveByProfilesAndLocale({
            profileIds: input.profileIds,
            locale,
          });
    const grouped = new Map<
      DocumentExtractionProfileId,
      Array<(typeof records)[number]>
    >();

    for (const record of records) {
      const key = record.profileId as DocumentExtractionProfileId;
      const existing = grouped.get(key) ?? [];
      existing.push(record);
      grouped.set(key, existing);
    }

    return Object.fromEntries(
      input.profileIds.map((profileId) => {
        const profileRecords = grouped.get(profileId) ?? [];
        const derivedHints = mergeDerivedHints(
          profileRecords.map((record) => asDerivedHints(record.hints)),
        );

        return [
          profileId,
          this.resolveCompiledConfig({
            profileId,
            locale,
            derivedHints,
            derivedFromDocuments: profileRecords.map((record) => ({
              documentId: record.documentId,
              title: record.document.title,
              updatedAt: record.updatedAt.toISOString(),
            })),
          }),
        ];
      }),
    ) as Partial<Record<DocumentExtractionProfileId, CompiledDocumentExtractionProfileConfig>>;
  }

  async persistTenantDerivedHints(input: {
    documentId: string;
    locale?: string | null;
    profiles: Array<{
      profileId: DocumentExtractionProfileId;
      hints: DocumentExtractionProfileDerivedHints;
    }>;
    metadata?: Prisma.InputJsonValue | null;
  }) {
    const locale = resolveProfileLocale(input.locale);

    if (!this.repository) {
      return;
    }

    for (const profile of input.profiles) {
      await this.repository.upsertForDocument({
        documentId: input.documentId,
        profileId: profile.profileId,
        locale,
        hints: profile.hints,
        metadata: input.metadata ?? undefined,
      });
    }
  }

  private loadDefaultResource(input: {
    profileId: DocumentExtractionProfileId;
    locale: string;
  }) {
    const cacheKey = `${input.profileId}:${input.locale}`;
    const cached = this.defaultResourceCache.get(cacheKey);

    if (cached) {
      return cached;
    }

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
    const raw = JSON.parse(
      readFileSync(resolvedPath, 'utf8'),
    ) as RawDocumentExtractionProfileResource;

    this.defaultResourceCache.set(cacheKey, raw);
    return raw;
  }
}

function compileProfileResource(input: {
  profileId: DocumentExtractionProfileId;
  raw: RawDocumentExtractionProfileResource;
  derivedHints: DocumentExtractionProfileDerivedHints | null;
  derivedFromDocuments: Array<{
    documentId: string;
    title: string;
    updatedAt: string;
  }>;
}): CompiledDocumentExtractionProfileConfig {
  const oversizedClaimTailPattern = compileOptionalTailPattern(
    input.raw.matchingHints?.oversizedClaimTailPhrases ?? [],
  );
  const observedAxes = new Set(input.derivedHints?.observedAxes ?? []);

  return {
    profileId: input.profileId,
    locale: input.raw.locale,
    productTypes: input.raw.axes.product_types?.listLeadTerms?.length
      ? {
          listPattern: compileListLeadPattern(input.raw.axes.product_types.listLeadTerms),
        }
      : undefined,
    materials:
      input.raw.axes.materials &&
      (input.raw.axes.materials.listLeadPhrases?.length ||
        input.raw.axes.materials.listLeadTerms?.length)
        ? {
            listPatterns: [
              ...compilePhraseCapturePatterns(
                input.raw.axes.materials.listLeadPhrases ?? [],
                input.raw.matchingHints?.listStopTerms ?? [],
              ),
              ...compileTermListPatterns(input.raw.axes.materials.listLeadTerms ?? []),
            ],
          }
        : undefined,
    operationModes:
      input.raw.axes.operation_modes?.termFamilies &&
      Object.keys(input.raw.axes.operation_modes.termFamilies).length > 0
        ? {
            normalizedTerms: Object.entries(
              input.raw.axes.operation_modes.termFamilies,
            ).map(([normalizedValue, sourceTerms]) => ({
              normalizedValue,
              sourceTerms: sourceTerms.map((term) => term.trim()).filter(Boolean),
            })),
          }
        : undefined,
    colorOptions:
      input.raw.axes.color_options?.listLeadTerms?.length ||
      input.raw.axes.color_options?.varietySignals?.length
        ? {
            listPattern: compileListLeadPattern(
              input.raw.axes.color_options?.listLeadTerms ?? ['color', 'colors'],
            ),
            varietySignals:
              input.raw.axes.color_options?.varietySignals?.map((signal) =>
                normalizeDocumentKnowledgeText(signal),
              ) ?? [],
            unspecifiedAxes: input.raw.axes.color_options?.unspecifiedAxes ?? [],
          }
        : undefined,
    suitability: input.raw.axes.suitability?.leadPhrases?.length
      ? {
          pattern: compileLeadPhraseCapturePattern(
            input.raw.axes.suitability.leadPhrases,
          ),
        }
      : undefined,
    matchingHints: {
      listStopTerms:
        input.raw.matchingHints?.listStopTerms?.map((term) =>
          normalizeDocumentKnowledgeText(term),
        ) ?? [],
      oversizedClaimTailPattern,
      conjunctionTerms:
        input.raw.matchingHints?.conjunctionTerms?.map((term) =>
          normalizeDocumentKnowledgeText(term),
        ) ?? [],
    },
    derivedHints: input.derivedHints,
    resolution: {
      profileId: input.profileId,
      locale: input.raw.locale,
      tenantDerivedApplied: Boolean(input.derivedHints),
      derivedFromDocuments: input.derivedFromDocuments,
      sources: {
        axes: {
          product_types: observedAxes.has('product_types')
            ? 'mixed'
            : 'platform_default',
          materials: observedAxes.has('materials') ? 'mixed' : 'platform_default',
          operation_modes: observedAxes.has('operation_modes')
            ? 'mixed'
            : 'platform_default',
          color_options: observedAxes.has('color_options')
            ? 'mixed'
            : 'platform_default',
          suitability: observedAxes.has('suitability')
            ? 'mixed'
            : 'platform_default',
        },
        matchingHints: {
          listStopTerms: 'platform_default',
          conjunctionTerms: 'platform_default',
          oversizedClaimTailPhrases: 'platform_default',
        },
        derivedHints: input.derivedHints ? 'tenant_derived' : 'platform_default',
      },
    },
  };
}

function asDerivedHints(value: unknown): DocumentExtractionProfileDerivedHints | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const observedSections = asStringArray(record.observedSections);
  const observedAxes = asStringArray(record.observedAxes);
  const observedValuesByAxis = asStringRecordOfArrays(record.observedValuesByAxis);
  const supportCounts =
    record.supportCounts && typeof record.supportCounts === 'object'
      ? {
          explicit: asNumber((record.supportCounts as Record<string, unknown>).explicit),
          partial: asNumber((record.supportCounts as Record<string, unknown>).partial),
          boundedInference: asNumber(
            (record.supportCounts as Record<string, unknown>).boundedInference,
          ),
        }
      : undefined;

  const hints: DocumentExtractionProfileDerivedHints = {};

  if (observedSections.length > 0) {
    hints.observedSections = observedSections;
  }

  if (observedAxes.length > 0) {
    hints.observedAxes = observedAxes;
  }

  if (Object.keys(observedValuesByAxis).length > 0) {
    hints.observedValuesByAxis = observedValuesByAxis;
  }

  if (
    supportCounts &&
    (supportCounts.explicit || supportCounts.partial || supportCounts.boundedInference)
  ) {
    hints.supportCounts = supportCounts;
  }

  return Object.keys(hints).length > 0 ? hints : null;
}

function mergeDerivedHints(
  values: Array<DocumentExtractionProfileDerivedHints | null>,
): DocumentExtractionProfileDerivedHints | null {
  const observedSections = new Set<string>();
  const observedAxes = new Set<string>();
  const observedValuesByAxis = new Map<string, Set<string>>();
  const supportCounts = {
    explicit: 0,
    partial: 0,
    boundedInference: 0,
  };

  for (const value of values) {
    if (!value) {
      continue;
    }

    for (const section of value.observedSections ?? []) {
      observedSections.add(section);
    }

    for (const axis of value.observedAxes ?? []) {
      observedAxes.add(axis);
    }

    for (const [axis, entries] of Object.entries(value.observedValuesByAxis ?? {})) {
      const existing = observedValuesByAxis.get(axis) ?? new Set<string>();
      entries.forEach((entry) => existing.add(entry));
      observedValuesByAxis.set(axis, existing);
    }

    supportCounts.explicit += value.supportCounts?.explicit ?? 0;
    supportCounts.partial += value.supportCounts?.partial ?? 0;
    supportCounts.boundedInference += value.supportCounts?.boundedInference ?? 0;
  }

  const merged: DocumentExtractionProfileDerivedHints = {};

  if (observedSections.size > 0) {
    merged.observedSections = Array.from(observedSections).slice(0, 12);
  }

  if (observedAxes.size > 0) {
    merged.observedAxes = Array.from(observedAxes).sort();
  }

  if (observedValuesByAxis.size > 0) {
    merged.observedValuesByAxis = Object.fromEntries(
      Array.from(observedValuesByAxis.entries()).map(([axis, entries]) => [
        axis,
        Array.from(entries).slice(0, 12),
      ]),
    );
  }

  if (
    supportCounts.explicit > 0 ||
    supportCounts.partial > 0 ||
    supportCounts.boundedInference > 0
  ) {
    merged.supportCounts = supportCounts;
  }

  return Object.keys(merged).length > 0 ? merged : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (current): current is string =>
          typeof current === 'string' && current.trim().length > 0,
      )
    : [];
}

function asStringRecordOfArrays(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, current]) => [key, asStringArray(current)] as const)
      .filter(([, current]) => current.length > 0),
  );
}

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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

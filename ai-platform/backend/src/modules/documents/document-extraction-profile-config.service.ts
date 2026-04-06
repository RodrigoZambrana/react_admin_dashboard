import { Injectable, Optional } from '@nestjs/common';
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
    payment_methods?: {
      headingTerms?: string[];
      installmentTerms?: string[];
      scopeLeadTerms?: string[];
      scopeVerbTerms?: string[];
      cardLeadTerms?: string[];
      brandListLeadTerms?: string[];
    };
    construction_components?: {
      headingTerms?: string[];
    };
    feature_support?: {
      positiveLeadTerms?: string[];
      negativeLeadTerms?: string[];
      relatedLeadPhrases?: string[];
      alternativeConjunctionTerms?: string[];
      trimTailTerms?: string[];
      removableLeadTerms?: string[];
    };
    prudence?: {
      exact_hours?: {
        axisTerms?: string[];
        headingTerms?: string[];
        cautionTerms?: string[];
      };
      exact_color_options?: {
        axisTerms?: string[];
        headingTerms?: string[];
        cautionTerms?: string[];
        unspecifiedAxes?: string[];
      };
    };
    workflow?: {
      quote_fields?: {
        headingTerms?: string[];
      };
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
  sectionAliasesByAxis?: Record<string, string[]>;
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
    headingTerms: string[];
  };
  materials?: {
    listPatterns: RegExp[];
    headingTerms: string[];
  };
  operationModes?: {
    normalizedTerms: Array<{
      normalizedValue: string;
      sourceTerms: string[];
    }>;
  };
  colorOptions?: {
    listPattern: RegExp;
    headingTerms: string[];
    varietySignals: string[];
    unspecifiedAxes: string[];
  };
  suitability?: {
    pattern: RegExp;
  };
  paymentMethods?: {
    headingTerms: string[];
    installmentTerms: string[];
    scopeLeadTerms: string[];
    scopeVerbTerms: string[];
    cardLeadTerms: string[];
    brandListLeadTerms: string[];
  };
  constructionComponents?: {
    headingTerms: string[];
  };
  featureSupport?: {
    positiveLeadTerms: string[];
    negativeLeadTerms: string[];
    relatedLeadPhrases: string[];
    alternativeConjunctionTerms: string[];
    trimTailTerms: string[];
    removableLeadTerms: string[];
  };
  prudence?: {
    exactHoursAxisTerms: string[];
    exactHoursCautionTerms: string[];
    exactHoursHeadingTerms: string[];
    exactColorAxisTerms: string[];
    exactColorCautionTerms: string[];
    exactColorHeadingTerms: string[];
    exactColorUnspecifiedAxes: string[];
  };
  workflow?: {
    quoteFieldsHeadingTerms: string[];
  };
  matchingHints: {
    listStopTerms: string[];
    oversizedClaimTailPattern: RegExp | null;
    conjunctionTerms: string[];
  };
  derivedHints: DocumentExtractionProfileDerivedHints | null;
  resolution: DocumentExtractionProfileConfigResolution;
};

export function mergeDocumentExtractionProfileDerivedHints(
  values: Array<DocumentExtractionProfileDerivedHints | null | undefined>,
) {
  return mergeDerivedHints(
    values.map((value) => (value ? value : null)),
  );
}

@Injectable()
export class DocumentExtractionProfileConfigService {
  private readonly defaultResourceCache = new Map<
    string,
    RawDocumentExtractionProfileResource
  >();

  constructor(
    @Optional()
    private readonly repository?: DocumentExtractionProfileConfigRepository,
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

  async clearTenantDerivedHints(documentId: string) {
    if (!this.repository) {
      return;
    }

    await this.repository.clearByDocument(documentId);
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
  const paymentMethodHeadingTerms = mergeHeadingTerms({
    defaultTerms: input.raw.axes.payment_methods?.headingTerms ?? [],
    derivedAliases: input.derivedHints?.sectionAliasesByAxis?.payment_methods ?? [],
    anchorTerms: input.raw.axes.payment_methods?.headingTerms ?? [],
    allowUnanchoredDerived: true,
  });
  const constructionComponentHeadingTerms = mergeHeadingTerms({
    defaultTerms: input.raw.axes.construction_components?.headingTerms ?? [],
    derivedAliases:
      input.derivedHints?.sectionAliasesByAxis?.construction_components ?? [],
    anchorTerms: input.raw.axes.construction_components?.headingTerms ?? [],
    allowUnanchoredDerived: true,
  });
  const exactHoursAxisTerms =
    input.raw.axes.prudence?.exact_hours?.axisTerms?.map((term) =>
      normalizeDocumentKnowledgeText(term),
    ) ?? [];
  const exactHoursHeadingTerms = mergeHeadingTerms({
    defaultTerms: input.raw.axes.prudence?.exact_hours?.headingTerms ?? [],
    derivedAliases: input.derivedHints?.sectionAliasesByAxis?.exact_hours ?? [],
    anchorTerms: [
      ...(input.raw.axes.prudence?.exact_hours?.headingTerms ?? []),
      ...(input.raw.axes.prudence?.exact_hours?.axisTerms ?? []),
    ],
    allowUnanchoredDerived: true,
  });
  const exactColorAxisTerms =
    input.raw.axes.prudence?.exact_color_options?.axisTerms?.map((term) =>
      normalizeDocumentKnowledgeText(term),
    ) ?? [];
  const exactColorHeadingTerms = mergeHeadingTerms({
    defaultTerms: input.raw.axes.prudence?.exact_color_options?.headingTerms ?? [],
    derivedAliases:
      input.derivedHints?.sectionAliasesByAxis?.exact_color_options ?? [],
    anchorTerms: [
      ...(input.raw.axes.prudence?.exact_color_options?.headingTerms ?? []),
      ...(input.raw.axes.prudence?.exact_color_options?.axisTerms ?? []),
    ],
  });
  const quoteFieldHeadingTerms = mergeHeadingTerms({
    defaultTerms: input.raw.axes.workflow?.quote_fields?.headingTerms ?? [],
    derivedAliases: input.derivedHints?.sectionAliasesByAxis?.quote_fields ?? [],
    anchorTerms: input.raw.axes.workflow?.quote_fields?.headingTerms ?? [],
    allowUnanchoredDerived: true,
  });

  return {
    profileId: input.profileId,
    locale: input.raw.locale,
    productTypes: input.raw.axes.product_types?.listLeadTerms?.length
      ? {
          listPattern: compileListLeadPattern(input.raw.axes.product_types.listLeadTerms),
          headingTerms: input.raw.axes.product_types.listLeadTerms.map((term) => term.trim()),
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
            headingTerms:
              input.raw.axes.materials.listLeadTerms?.map((term) => term.trim()) ?? [],
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
            headingTerms:
              input.raw.axes.color_options?.listLeadTerms?.map((term) => term.trim()) ?? [],
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
    paymentMethods: paymentMethodHeadingTerms.length > 0
      ? {
          headingTerms: paymentMethodHeadingTerms,
          installmentTerms:
            input.raw.axes.payment_methods?.installmentTerms?.map((term) =>
              normalizeDocumentKnowledgeText(term),
            ) ?? [],
          scopeLeadTerms:
            input.raw.axes.payment_methods?.scopeLeadTerms?.map((term) =>
              normalizeDocumentKnowledgeText(term),
            ) ?? [],
          scopeVerbTerms:
            input.raw.axes.payment_methods?.scopeVerbTerms?.map((term) =>
              normalizeDocumentKnowledgeText(term),
            ) ?? [],
          cardLeadTerms:
            input.raw.axes.payment_methods?.cardLeadTerms?.map((term) =>
              normalizeDocumentKnowledgeText(term),
            ) ?? [],
          brandListLeadTerms:
            input.raw.axes.payment_methods?.brandListLeadTerms?.map((term) =>
              normalizeDocumentKnowledgeText(term),
            ) ?? [],
        }
      : undefined,
    constructionComponents: constructionComponentHeadingTerms.length > 0
      ? {
          headingTerms: constructionComponentHeadingTerms,
        }
      : undefined,
    featureSupport:
      input.raw.axes.feature_support?.positiveLeadTerms?.length ||
      input.raw.axes.feature_support?.negativeLeadTerms?.length ||
      input.raw.axes.feature_support?.relatedLeadPhrases?.length
        ? {
            positiveLeadTerms:
              input.raw.axes.feature_support?.positiveLeadTerms?.map((term) =>
                normalizeDocumentKnowledgeText(term),
              ) ?? [],
            negativeLeadTerms:
              input.raw.axes.feature_support?.negativeLeadTerms?.map((term) =>
                normalizeDocumentKnowledgeText(term),
              ) ?? [],
            relatedLeadPhrases:
              input.raw.axes.feature_support?.relatedLeadPhrases?.map((term) =>
                normalizeDocumentKnowledgeText(term),
              ) ?? [],
            alternativeConjunctionTerms:
              input.raw.axes.feature_support?.alternativeConjunctionTerms?.map((term) =>
                normalizeDocumentKnowledgeText(term),
              ) ?? [],
            trimTailTerms:
              input.raw.axes.feature_support?.trimTailTerms?.map((term) =>
                normalizeDocumentKnowledgeText(term),
              ) ?? [],
            removableLeadTerms:
              input.raw.axes.feature_support?.removableLeadTerms?.map((term) =>
                normalizeDocumentKnowledgeText(term),
              ) ?? [],
          }
        : undefined,
    prudence:
      input.raw.axes.prudence?.exact_hours?.axisTerms?.length ||
      input.raw.axes.prudence?.exact_hours?.cautionTerms?.length ||
      input.raw.axes.prudence?.exact_color_options?.axisTerms?.length ||
      input.raw.axes.prudence?.exact_color_options?.cautionTerms?.length
        ? {
            exactHoursAxisTerms,
            exactHoursCautionTerms:
              input.raw.axes.prudence?.exact_hours?.cautionTerms?.map((term) =>
                normalizeDocumentKnowledgeText(term),
              ) ?? [],
            exactHoursHeadingTerms,
            exactColorAxisTerms,
            exactColorCautionTerms:
              input.raw.axes.prudence?.exact_color_options?.cautionTerms?.map((term) =>
                normalizeDocumentKnowledgeText(term),
              ) ?? [],
            exactColorHeadingTerms,
            exactColorUnspecifiedAxes:
              input.raw.axes.prudence?.exact_color_options?.unspecifiedAxes ?? [],
          }
        : undefined,
    workflow:
      quoteFieldHeadingTerms.length > 0
        ? {
            quoteFieldsHeadingTerms: quoteFieldHeadingTerms,
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
          payment_methods: observedAxes.has('payment_methods')
            || paymentMethodHeadingTerms.some(
              (term) =>
                !matchesNormalizedFallbackTerm(
                  term,
                  input.raw.axes.payment_methods?.headingTerms ?? [],
                ),
            )
            ? 'mixed'
            : 'platform_default',
          construction_components: observedAxes.has('construction_components')
            || constructionComponentHeadingTerms.some(
              (term) =>
                !matchesNormalizedFallbackTerm(
                  term,
                  input.raw.axes.construction_components?.headingTerms ?? [],
                ),
            )
            ? 'mixed'
            : 'platform_default',
          feature_support: observedAxes.has('feature_support')
            ? 'mixed'
            : 'platform_default',
          quote_fields: observedAxes.has('quote_fields')
            || quoteFieldHeadingTerms.some(
              (term) =>
                !matchesNormalizedFallbackTerm(
                  term,
                  input.raw.axes.workflow?.quote_fields?.headingTerms ?? [],
                ),
            )
            ? 'mixed'
            : 'platform_default',
          exact_hours: observedAxes.has('exact_hours')
            || exactHoursHeadingTerms.some(
              (term) =>
                !matchesNormalizedFallbackTerm(
                  term,
                  input.raw.axes.prudence?.exact_hours?.headingTerms ?? [],
                ),
            )
            ? 'mixed'
            : 'platform_default',
          exact_color_options: observedAxes.has('exact_color_options')
            || exactColorHeadingTerms.some(
              (term) =>
                !matchesNormalizedFallbackTerm(
                  term,
                  input.raw.axes.prudence?.exact_color_options?.headingTerms ?? [],
                ),
            )
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
  const sectionAliasesByAxis = asStringRecordOfArrays(record.sectionAliasesByAxis);
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

  if (Object.keys(sectionAliasesByAxis).length > 0) {
    hints.sectionAliasesByAxis = sectionAliasesByAxis;
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
  const sectionAliasesByAxis = new Map<string, Set<string>>();
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

    for (const [axis, entries] of Object.entries(value.sectionAliasesByAxis ?? {})) {
      const existing = sectionAliasesByAxis.get(axis) ?? new Set<string>();
      entries.forEach((entry) => existing.add(entry));
      sectionAliasesByAxis.set(axis, existing);
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

  if (sectionAliasesByAxis.size > 0) {
    merged.sectionAliasesByAxis = Object.fromEntries(
      Array.from(sectionAliasesByAxis.entries()).map(([axis, entries]) => [
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

function mergeHeadingTerms(input: {
  defaultTerms: string[];
  derivedAliases: string[];
  anchorTerms: string[];
  allowUnanchoredDerived?: boolean;
}) {
  const defaults = dedupeTerms(input.defaultTerms);
  const anchors = input.anchorTerms
    .map((term) => normalizeDocumentKnowledgeText(term))
    .filter(Boolean);
  const derived = dedupeTerms(input.derivedAliases).filter(
    (alias) =>
      input.allowUnanchoredDerived === true ||
      aliasMatchesAnchor(alias, anchors),
  );

  return dedupeTerms([...defaults, ...derived]);
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
  return new RegExp(`^(?:[-•]\\s*)?(?:${escapedTerms})\\s*[:\\-]?\\s*(.+)$`, 'iu');
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
      new RegExp(`^(?:[-•]\\s*)?(?:${escapeRegExp(term)})\\s*[:\\-]?\\s*(.+)$`, 'iu'),
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

function dedupeTerms(values: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();

    if (!trimmed) {
      continue;
    }

    const normalized = normalizeDocumentKnowledgeText(trimmed);

    if (!normalized || seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    deduped.push(trimmed);
  }

  return deduped;
}

function aliasMatchesAnchor(alias: string, anchorTerms: string[]) {
  const normalizedAlias = normalizeDocumentKnowledgeText(alias);

  if (!normalizedAlias || anchorTerms.length === 0) {
    return false;
  }

  return anchorTerms.some((anchor) =>
    normalizedAlias === anchor ||
    normalizedAlias.startsWith(`${anchor} `) ||
    normalizedAlias.includes(` ${anchor} `) ||
    normalizedAlias.endsWith(` ${anchor}`),
  );
}

function matchesNormalizedFallbackTerm(value: string, fallbackTerms: string[]) {
  const normalizedValue = normalizeDocumentKnowledgeText(value);

  return fallbackTerms
    .map((term) => normalizeDocumentKnowledgeText(term))
    .filter(Boolean)
    .includes(normalizedValue);
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

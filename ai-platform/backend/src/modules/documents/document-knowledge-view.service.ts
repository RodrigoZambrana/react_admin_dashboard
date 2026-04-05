import { Injectable, NotFoundException } from '@nestjs/common';

import {
  asKnowledgeMetadata,
  buildStructuralKnowledgeSummary,
} from './document-knowledge-claims';
import { DocumentExtractionProfileConfigService } from './document-extraction-profile-config.service';
import {
  documentExtractionProfileIds,
  DocumentExtractionProfileId,
} from './document-extraction-profile.types';
import {
  DocumentKnowledgeClaimView,
  DocumentKnowledgeEntityView,
  DocumentKnowledgeExtractionScope,
  DocumentKnowledgeProvenance,
  DocumentKnowledgeSupportClass,
  DocumentKnowledgeView,
  DocumentKnowledgeViewScope,
} from './document.types';
import { DocumentChunkRepository } from '../persistence/repositories/document-chunk.repository';
import { DocumentRepository } from '../persistence/repositories/document.repository';

type DocumentRecordLike = {
  id: string;
  title: string;
  status: DocumentKnowledgeView['documents'][number]['status'];
  ingestionStatus: DocumentKnowledgeView['documents'][number]['ingestionStatus'];
  language?: string | null;
  sourceName?: string | null;
  originKind: DocumentKnowledgeProvenance['originKind'];
  updatedAt: Date;
};

type ChunkWithKnowledgeLike = Awaited<
  ReturnType<DocumentChunkRepository['listActiveReadyChunks']>
>[number];

type DocumentKnowledgeItemLike = ChunkWithKnowledgeLike['knowledgeItems'][number];

type MutableClaimGroup = {
  axis: string;
  supportClass: DocumentKnowledgeSupportClass;
  extractionScope?: DocumentKnowledgeExtractionScope;
  values: Set<string>;
  unspecifiedAxes: Set<string>;
  provenance: DocumentKnowledgeProvenance[];
};

type MutableEntityGroup = {
  label: string;
  extractionScope?: DocumentKnowledgeExtractionScope;
  values: Set<string>;
  provenance: DocumentKnowledgeProvenance[];
};

@Injectable()
export class DocumentKnowledgeViewService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly documentChunkRepository: DocumentChunkRepository,
    private readonly documentExtractionProfileConfigService: DocumentExtractionProfileConfigService,
  ) {}

  async getKnowledgeView(input?: {
    documentId?: string;
    limit?: number;
  }): Promise<DocumentKnowledgeView> {
    if (input?.documentId) {
      const document = await this.documentRepository.findById(input.documentId);

      if (!document) {
        throw new NotFoundException(`Document ${input.documentId} was not found`);
      }

      const chunks = await this.documentChunkRepository.listByDocumentId(document.id);
      const profileViews = await this.resolveProfileViews({
        chunks: chunks.map((chunk) => ({
          ...chunk,
          document,
        })),
        documentId: document.id,
      });

      return this.buildKnowledgeView({
        scope: 'document',
        documents: [document],
        chunks: chunks.map((chunk) => ({
          ...chunk,
          document,
        })),
        extractionProfiles: profileViews,
      });
    }

    const chunks = await this.documentChunkRepository.listActiveReadyChunks(
      input?.limit ?? 500,
    );
    const documents = dedupeDocuments(chunks.map((chunk) => chunk.document));
    const profileViews = await this.resolveProfileViews({
      chunks,
    });

    return this.buildKnowledgeView({
      scope: 'active_corpus',
      documents,
      chunks,
      extractionProfiles: profileViews,
    });
  }

  private buildKnowledgeView(input: {
    scope: DocumentKnowledgeViewScope;
    documents: DocumentRecordLike[];
    extractionProfiles: DocumentKnowledgeView['extractionProfiles'];
    chunks: Array<
      Pick<ChunkWithKnowledgeLike, 'sequence' | 'metadata' | 'knowledgeItems'> & {
        document: DocumentRecordLike;
      }
    >;
  }): DocumentKnowledgeView {
    const claimGroups = new Map<string, MutableClaimGroup>();
    const entityGroups = new Map<string, MutableEntityGroup>();
    const supportedAxes = new Set<string>();
    const unspecifiedAxes = new Set<string>();
    const topics = new Set<string>();
    let claimCount = 0;
    let entityCount = 0;

    for (const chunk of input.chunks) {
      const chunkMetadata = asRecord(chunk.metadata);
      const supportSummary = asRecord(chunkMetadata?.supportSummary);

      if (typeof supportSummary?.topic === 'string' && supportSummary.topic.trim()) {
        topics.add(supportSummary.topic.trim());
      }

      if (Array.isArray(supportSummary?.supportedAxes)) {
        for (const axis of supportSummary.supportedAxes) {
          if (typeof axis === 'string' && axis.trim()) {
            supportedAxes.add(axis.trim());
          }
        }
      }

      if (Array.isArray(supportSummary?.unspecifiedAxes)) {
        for (const axis of supportSummary.unspecifiedAxes) {
          if (typeof axis === 'string' && axis.trim()) {
            unspecifiedAxes.add(axis.trim());
          }
        }
      }

      for (const item of chunk.knowledgeItems) {
        const provenance = buildProvenance({
          chunk,
          item,
        });
        const metadata = asKnowledgeMetadata(item.metadata);

        if (normalizeKnowledgeItemKind(item.kind) === 'claim' && metadata?.claim) {
          claimCount += 1;
          supportedAxes.add(metadata.claim.axis);
          for (const axis of metadata.unspecifiedAxes ?? []) {
            unspecifiedAxes.add(axis);
          }

          const key = [
            metadata.claim.axis,
            normalizeSupportClass(item.supportClass),
            metadata.extractionScope ?? '',
            metadata.claim.values.join('|'),
            (metadata.unspecifiedAxes ?? []).join('|'),
          ].join('::');
          const existing = claimGroups.get(key) ?? {
            axis: metadata.claim.axis,
            supportClass: normalizeSupportClass(item.supportClass),
            extractionScope: metadata.extractionScope,
            values: new Set<string>(),
            unspecifiedAxes: new Set<string>(metadata.unspecifiedAxes ?? []),
            provenance: [],
          };

          metadata.claim.values.forEach((value) => existing.values.add(value));
          pushProvenance(existing.provenance, provenance);
          claimGroups.set(key, existing);
          continue;
        }

        if (normalizeKnowledgeItemKind(item.kind) === 'entity') {
          entityCount += 1;

          const key = [
            item.label,
            metadata?.extractionScope ?? '',
            item.normalizedValue ?? item.valueText,
          ].join('::');
          const existing = entityGroups.get(key) ?? {
            label: item.label,
            extractionScope: metadata?.extractionScope,
            values: new Set<string>(),
            provenance: [],
          };

          existing.values.add(item.valueText);
          pushProvenance(existing.provenance, provenance);
          entityGroups.set(key, existing);
        }
      }
    }

    const claims = Array.from(claimGroups.values())
      .map<DocumentKnowledgeClaimView>((claim) => ({
        axis: claim.axis,
        supportClass: claim.supportClass,
        extractionScope: claim.extractionScope,
        values: Array.from(claim.values.values()),
        unspecifiedAxes: Array.from(claim.unspecifiedAxes.values()),
        provenance: sortProvenance(claim.provenance),
      }))
      .sort(compareClaims);
    const entities = Array.from(entityGroups.values())
      .map<DocumentKnowledgeEntityView>((entity) => ({
        label: entity.label,
        extractionScope: entity.extractionScope,
        values: Array.from(entity.values.values()),
        provenance: sortProvenance(entity.provenance),
      }))
      .sort((left, right) => left.label.localeCompare(right.label));

    return {
      scope: input.scope,
      generatedAt: new Date().toISOString(),
      documents: input.documents.map((document) => ({
        id: document.id,
        title: document.title,
        status: document.status,
        ingestionStatus: document.ingestionStatus,
        language: document.language,
        sourceName: document.sourceName,
        updatedAt: document.updatedAt.toISOString(),
      })),
      counts: {
        documentCount: input.documents.length,
        chunkCount: input.chunks.length,
        claimCount,
        entityCount,
      },
      support: {
        topics: Array.from(topics.values()).slice(0, 8),
        supportedAxes: Array.from(supportedAxes.values()).sort(),
        unspecifiedAxes: Array.from(unspecifiedAxes.values()).sort(),
      },
      extractionProfiles: input.extractionProfiles,
      overviewLines: buildOverviewLines(claims, input.documents[0]?.language),
      claims,
      entities,
    };
  }

  private async resolveProfileViews(input: {
    chunks: Array<
      Pick<ChunkWithKnowledgeLike, 'metadata' | 'knowledgeItems'> & {
        document: DocumentRecordLike;
      }
    >;
    documentId?: string;
  }) {
    const profileIdsByLocale = new Map<string, Set<DocumentExtractionProfileId>>();

    for (const chunk of input.chunks) {
      const locale = resolveViewLocale(chunk.document.language);
      const current = profileIdsByLocale.get(locale) ?? new Set<DocumentExtractionProfileId>();

      extractProfileIds(chunk).forEach((profileId) => current.add(profileId));
      profileIdsByLocale.set(locale, current);
    }

    const views: DocumentKnowledgeView['extractionProfiles'] = [];

    for (const [locale, profileIds] of profileIdsByLocale.entries()) {
      const configs =
        await this.documentExtractionProfileConfigService.resolveEffectiveConfigs({
          profileIds: Array.from(profileIds.values()),
          locale,
          documentId: input.documentId,
        });

      for (const profileId of profileIds.values()) {
        const config = configs[profileId];

        if (!config) {
          continue;
        }

        views.push({
          profileId,
          locale: config.locale,
          tenantDerivedApplied: config.resolution.tenantDerivedApplied,
          derivedHints: config.derivedHints,
          derivedFromDocuments: config.resolution.derivedFromDocuments,
          sources: config.resolution.sources,
        });
      }
    }

    return views.sort((left, right) =>
      [left.locale, left.profileId].join('::').localeCompare(
        [right.locale, right.profileId].join('::'),
      ),
    );
  }
}

function buildOverviewLines(
  claims: DocumentKnowledgeClaimView[],
  locale?: string | null,
) {
  return claims
    .slice(0, 6)
    .map((claim) =>
      buildStructuralKnowledgeSummary({
        locale,
        claims: [
          {
            axis: claim.axis,
            values: claim.values,
            supportClass: claim.supportClass,
            extractionScope: claim.extractionScope,
            unspecifiedAxes: claim.unspecifiedAxes,
          },
        ],
        limit: 1,
      }),
    )
    .filter((value) => value.length > 0);
}

function buildProvenance(input: {
  chunk: Pick<ChunkWithKnowledgeLike, 'sequence' | 'metadata'> & {
    document: DocumentRecordLike;
  };
  item: Pick<DocumentKnowledgeItemLike, 'evidenceTextSpan' | 'metadata'>;
}): DocumentKnowledgeProvenance {
  const itemMetadata = asKnowledgeMetadata(input.item.metadata);
  const chunkMetadata = asRecord(input.chunk.metadata);

  return {
    documentId: input.chunk.document.id,
    documentTitle: input.chunk.document.title,
    sourceName: input.chunk.document.sourceName,
    originKind: input.chunk.document.originKind,
    chunkSequence: input.chunk.sequence,
    section:
      itemMetadata?.section ??
      (typeof chunkMetadata?.section === 'string' ? chunkMetadata.section : undefined),
    page:
      itemMetadata?.page ??
      (typeof chunkMetadata?.page === 'number' ? chunkMetadata.page : undefined),
    sheet:
      itemMetadata?.sheet ??
      (typeof chunkMetadata?.sheet === 'string' ? chunkMetadata.sheet : undefined),
    evidenceTextSpan: input.item.evidenceTextSpan,
  };
}

function normalizeKnowledgeItemKind(value: string) {
  return value.toLowerCase() === 'entity' ? 'entity' : 'claim';
}

function normalizeSupportClass(value: string): DocumentKnowledgeSupportClass {
  if (value.toLowerCase() === 'partial_fact') {
    return 'partial_fact';
  }

  if (value.toLowerCase() === 'bounded_inference') {
    return 'bounded_inference';
  }

  return 'explicit_fact';
}

function compareClaims(
  left: DocumentKnowledgeClaimView,
  right: DocumentKnowledgeClaimView,
) {
  return [left.axis, left.supportClass].join('::').localeCompare(
    [right.axis, right.supportClass].join('::'),
  );
}

function pushProvenance(
  collection: DocumentKnowledgeProvenance[],
  provenance: DocumentKnowledgeProvenance,
) {
  const key = [
    provenance.documentId,
    provenance.chunkSequence,
    provenance.evidenceTextSpan,
    provenance.section ?? '',
    provenance.page ?? '',
    provenance.sheet ?? '',
  ].join('::');

  if (
    collection.some(
      (current) =>
        [
          current.documentId,
          current.chunkSequence,
          current.evidenceTextSpan,
          current.section ?? '',
          current.page ?? '',
          current.sheet ?? '',
        ].join('::') === key,
    )
  ) {
    return;
  }

  collection.push(provenance);
}

function sortProvenance(values: DocumentKnowledgeProvenance[]) {
  return [...values].sort((left, right) => {
    if (left.documentTitle !== right.documentTitle) {
      return left.documentTitle.localeCompare(right.documentTitle);
    }

    return left.chunkSequence - right.chunkSequence;
  });
}

function dedupeDocuments(documents: DocumentRecordLike[]) {
  const seen = new Set<string>();

  return documents.filter((document) => {
    if (seen.has(document.id)) {
      return false;
    }

    seen.add(document.id);
    return true;
  });
}

function extractProfileIds(
  chunk: Pick<ChunkWithKnowledgeLike, 'metadata' | 'knowledgeItems'>,
) {
  const profileIds = new Set<DocumentExtractionProfileId>();
  const metadata = asRecord(chunk.metadata);

  if (Array.isArray(metadata?.extractionProfiles)) {
    for (const value of metadata.extractionProfiles) {
      if (
        typeof value === 'string' &&
        documentExtractionProfileIds.includes(value as DocumentExtractionProfileId)
      ) {
        profileIds.add(value as DocumentExtractionProfileId);
      }
    }
  }

  for (const item of chunk.knowledgeItems) {
    const itemMetadata = asKnowledgeMetadata(item.metadata);

    if (itemMetadata?.profileKey) {
      profileIds.add(itemMetadata.profileKey);
    }
  }

  return Array.from(profileIds.values());
}

function resolveViewLocale(locale?: string | null) {
  const family = String(locale ?? '')
    .toLowerCase()
    .split(/[-_]/u)[0]
    .trim();

  return family === 'en' ? 'en' : 'es';
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

import { Injectable } from '@nestjs/common';
import { ManagedResourceStatus, Prisma } from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { DocumentChunkRepository } from '../persistence/repositories/document-chunk.repository';
import { DocumentRepository } from '../persistence/repositories/document.repository';
import { TenantCapabilityRegistryService } from '../tenant-capabilities/tenant-capability-registry.service';
import {
  buildStructuralKnowledgeSummary,
  extractKnowledgeAxisSummaries,
} from './document-knowledge-claims';
import { buildDocumentCorpusMetadata } from './document-corpus';
import {
  DocumentExtractionProfileConfigService,
  DocumentExtractionProfileDerivedHints,
  mergeDocumentExtractionProfileDerivedHints,
} from './document-extraction-profile-config.service';
import { DocumentExtractionProfileResolverService } from './document-extraction-profile-resolver.service';
import { DocumentProfileBootstrapService } from './document-profile-bootstrap.service';
import { DocumentChunkCandidate } from './document.types';
import { DocumentKnowledgeExtractionService } from './document-knowledge-extraction.service';

@Injectable()
export class DocumentIngestionService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly documentChunkRepository: DocumentChunkRepository,
    private readonly documentKnowledgeExtractionService: DocumentKnowledgeExtractionService,
    private readonly logger: PipelineLoggerService,
    private readonly tenantCapabilityRegistry: TenantCapabilityRegistryService,
    private readonly documentExtractionProfileResolver: DocumentExtractionProfileResolverService,
    private readonly documentExtractionProfileConfigService: DocumentExtractionProfileConfigService,
    private readonly documentProfileBootstrapService: DocumentProfileBootstrapService,
  ) {}

  async ingestDocument(input: {
    documentId: string;
    activate?: boolean;
    createdBy?: string;
  }) {
    const document = await this.documentRepository.markProcessing(input.documentId);

    try {
      const capabilities =
        await this.tenantCapabilityRegistry.resolveForCurrentTenant();
      const sourceMetadata = this.asRecord(document.metadata);
      const baseExtractionContext = {
        tenantId: capabilities.tenantId,
        locale: document.language,
        activeCapabilities: capabilities.enabledKeys,
        sourceMetadata,
        originKind: document.originKind,
      } as const;
      const activeProfileIds =
        this.documentExtractionProfileResolver.resolveProfileIds(
          baseExtractionContext,
        );
      const effectiveConfigs =
        await this.documentExtractionProfileConfigService.resolveEffectiveConfigs({
          profileIds: activeProfileIds,
          locale: document.language,
        });
      const initialRuntimeHints = mapProfileHints(
        activeProfileIds,
        Object.fromEntries(
          Object.entries(effectiveConfigs)
            .filter(([, config]) => Boolean(config?.derivedHints))
            .map(([profileId, config]) => [profileId, config?.derivedHints]),
        ),
      );
      const initialChunks = this.documentKnowledgeExtractionService.buildChunkCandidates({
        sourceText: document.sourceText,
        originKind: document.originKind,
        language: document.language,
        sourceMetadata,
        extractionContext: {
          ...baseExtractionContext,
          profileConfigHints: initialRuntimeHints,
        },
      });
      const initialBootstrapHints = this.documentProfileBootstrapService.deriveHints({
        chunks: initialChunks,
        activeProfileIds,
      });
      const runtimeHints = mapProfileHints(
        activeProfileIds,
        Object.fromEntries(
          initialBootstrapHints.profiles.map((profile) => [
            profile.profileId,
            mergeDocumentExtractionProfileDerivedHints([
              initialRuntimeHints[profile.profileId],
              profile.hints,
            ]),
          ]),
        ),
      );
      const chunks = this.documentKnowledgeExtractionService.buildChunkCandidates({
        sourceText: document.sourceText,
        originKind: document.originKind,
        language: document.language,
        sourceMetadata,
        extractionContext: {
          ...baseExtractionContext,
          profileConfigHints: runtimeHints,
        },
      });
      const bootstrapHints = this.documentProfileBootstrapService.deriveHints({
        chunks,
        activeProfileIds,
      });

      if (chunks.length === 0) {
        throw new Error('No document chunks could be generated');
      }

      await this.documentChunkRepository.replaceForDocument({
        documentId: document.id,
        chunks: chunks.map((chunk) => ({
          sequence: chunk.sequence,
          content: chunk.content,
          searchText: chunk.searchText,
          retrievalProjection: chunk.retrievalProjection,
          metadata: (chunk.metadata ?? null) as Prisma.InputJsonValue | null,
          structuredItems: (chunk.structuredItems ?? []).map((item) => ({
            sequence: item.sequence,
            kind: item.kind,
            label: item.label,
            valueText: item.valueText,
            normalizedValue: item.normalizedValue,
            supportClass: item.supportClass,
            evidenceTextSpan: item.evidenceTextSpan,
            metadata: (item.metadata ?? null) as Prisma.InputJsonValue | null,
          })),
          structuredPropositions: (chunk.structuredPropositions ?? []).map(
            (proposition) => ({
              sequence: proposition.sequence,
              label: proposition.label,
              normalizedValue: proposition.normalizedValue,
              supportClass: proposition.supportClass,
              evidenceTextSpan: proposition.evidenceTextSpan,
              metadata: (proposition.metadata ?? null) as Prisma.InputJsonValue | null,
              proposition: {
                predicate: proposition.proposition.predicate,
                facet: proposition.proposition.facet,
                objectValue: proposition.proposition.objectValue,
                objectNormalizedValue:
                  proposition.proposition.objectNormalizedValue,
                polarity: proposition.proposition.polarity,
                relationScope:
                  (proposition.proposition.relationScope ??
                    null) as Prisma.InputJsonValue | null,
                confidence: proposition.proposition.confidence,
                canonicalKey: proposition.proposition.canonicalKey,
                patternKey: proposition.proposition.patternKey,
                evidenceTier: proposition.proposition.evidenceTier,
                promotionState: proposition.proposition.promotionState,
                promotedAxis: proposition.proposition.promotedAxis,
                promotedFacet: proposition.proposition.promotedFacet,
              },
            }),
          ),
        })),
      });
      await this.documentExtractionProfileConfigService.persistTenantDerivedHints({
        documentId: document.id,
        locale: document.language,
        profiles: bootstrapHints.profiles,
        metadata: {
          sourceDocumentId: document.id,
          sourceDocumentTitle: document.title,
          approvalMode: 'uploaded_document',
          lastIngestedBy: input.createdBy ?? 'system',
        },
      });

      const summary = this.buildSummary(chunks);
      const corpusMetadata = buildDocumentCorpusMetadata(
        chunks.map((chunk) => ({
          documentId: document.id,
          sequence: chunk.sequence,
          metadata: chunk.metadata,
          knowledgeItems: chunk.structuredItems?.map((item) => ({
            kind: item.kind,
            metadata: item.metadata,
          })),
          document: {
            id: document.id,
            title: document.title,
            status: document.status,
            ingestionStatus: document.ingestionStatus,
            language: document.language,
            sourceName: document.sourceName,
            metadata: document.metadata,
            updatedAt: document.updatedAt,
          },
        })),
      );
      const saved = await this.documentRepository.markReady({
        documentId: document.id,
        summary,
        chunkCount: chunks.length,
        status: input.activate === false ? ManagedResourceStatus.DRAFT : ManagedResourceStatus.ACTIVE,
        metadata: {
          ...(this.asRecord(document.metadata) ?? {}),
          ...corpusMetadata,
          lastIngestedBy: input.createdBy ?? 'system',
          ingestOrigin: 'document_domain',
          approvalMode: 'uploaded_document',
          extractionBootstrap: bootstrapHints,
        },
      });

      this.logger.log(
        JSON.stringify({
          stage: 'document.ingest',
          documentId: document.id,
          chunkCount: chunks.length,
          status: saved.status,
          ingestionStatus: saved.ingestionStatus,
        }),
      );

      return saved;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failed = await this.documentRepository.markFailed(document.id, message);

      this.logger.error(
        JSON.stringify({
          stage: 'document.ingest',
          documentId: document.id,
          error: message,
        }),
      );

      return failed;
    }
  }

  private buildSummary(chunks: DocumentChunkCandidate[]) {
    const preferredChunks =
      chunks.some((chunk) => chunk.metadata?.usageBoundary === 'knowledge')
        ? chunks.filter((chunk) => chunk.metadata?.usageBoundary === 'knowledge')
        : chunks;

    return preferredChunks
      .slice(0, 2)
      .map((chunk) => {
        const supportSummary =
          typeof chunk.metadata?.supportSummary === 'object' &&
          chunk.metadata?.supportSummary
            ? (chunk.metadata.supportSummary as Record<string, unknown>)
            : null;
        const topic =
          supportSummary && typeof supportSummary.topic === 'string'
            ? supportSummary.topic
            : null;
        const claimSummary = buildStructuralKnowledgeSummary({
          claims: extractKnowledgeAxisSummaries(chunk.structuredItems ?? []),
          limit: 1,
        });

        return [topic, claimSummary].filter(Boolean).join('. ').trim() || chunk.content;
      })
      .join(' ')
      .slice(0, 320)
      .trim();
  }

  private asRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }
}

function mapProfileHints(
  profileIds: readonly string[],
  hintsByProfile: Record<string, DocumentExtractionProfileDerivedHints | null | undefined>,
) {
  return Object.fromEntries(
    profileIds
      .map((profileId) => [profileId, hintsByProfile[profileId] ?? null] as const)
      .filter(([, hints]) => Boolean(hints)),
  ) as Record<string, DocumentExtractionProfileDerivedHints>;
}

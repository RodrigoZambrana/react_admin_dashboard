import { Injectable } from '@nestjs/common';
import { ManagedResourceStatus, Prisma } from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { DocumentChunkRepository } from '../persistence/repositories/document-chunk.repository';
import { DocumentRepository } from '../persistence/repositories/document.repository';
import {
  buildStructuralKnowledgeSummary,
  extractKnowledgeAxisSummaries,
} from './document-knowledge-claims';
import { DocumentChunkCandidate } from './document.types';
import { DocumentKnowledgeExtractionService } from './document-knowledge-extraction.service';

@Injectable()
export class DocumentIngestionService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly documentChunkRepository: DocumentChunkRepository,
    private readonly documentKnowledgeExtractionService: DocumentKnowledgeExtractionService,
    private readonly logger: PipelineLoggerService,
  ) {}

  async ingestDocument(input: {
    documentId: string;
    activate?: boolean;
    createdBy?: string;
  }) {
    const document = await this.documentRepository.markProcessing(input.documentId);

    try {
      const chunks = this.documentKnowledgeExtractionService.buildChunkCandidates({
        sourceText: document.sourceText,
        originKind: document.originKind,
        language: document.language,
        sourceMetadata: this.asRecord(document.metadata),
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
        })),
      });

      const summary = this.buildSummary(chunks);
      const saved = await this.documentRepository.markReady({
        documentId: document.id,
        summary,
        chunkCount: chunks.length,
        status: input.activate === false ? ManagedResourceStatus.DRAFT : ManagedResourceStatus.ACTIVE,
        metadata: {
          ...(this.asRecord(document.metadata) ?? {}),
          lastIngestedBy: input.createdBy ?? 'system',
          ingestOrigin: 'document_domain',
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

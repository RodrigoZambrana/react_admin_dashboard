import { Injectable } from '@nestjs/common';
import { ManagedResourceStatus, Prisma } from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { DocumentChunkRepository } from '../persistence/repositories/document-chunk.repository';
import { DocumentRepository } from '../persistence/repositories/document.repository';
import { DocumentChunkCandidate } from './document.types';

@Injectable()
export class DocumentIngestionService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly documentChunkRepository: DocumentChunkRepository,
    private readonly logger: PipelineLoggerService,
  ) {}

  async ingestDocument(input: {
    documentId: string;
    activate?: boolean;
    createdBy?: string;
  }) {
    const document = await this.documentRepository.markProcessing(input.documentId);

    try {
      const chunks = this.buildChunks(document.sourceText);

      if (chunks.length === 0) {
        throw new Error('No document chunks could be generated');
      }

      await this.documentChunkRepository.replaceForDocument({
        documentId: document.id,
        chunks: chunks.map((chunk) => ({
          sequence: chunk.sequence,
          content: chunk.content,
          searchText: chunk.searchText,
          metadata: (chunk.metadata ?? null) as Prisma.InputJsonValue | null,
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

  private buildChunks(sourceText: string): DocumentChunkCandidate[] {
    const paragraphs = sourceText
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0);

    const chunks: DocumentChunkCandidate[] = [];
    let buffer = '';
    let sequence = 0;

    const pushChunk = (value: string) => {
      const content = value.trim();

      if (content.length === 0) {
        return;
      }

      chunks.push({
        sequence,
        content,
        searchText: normalizeSearchText(content),
        metadata: {
          characterLength: content.length,
        },
      });
      sequence += 1;
    };

    for (const paragraph of paragraphs) {
      const candidate = buffer.length > 0 ? `${buffer}\n\n${paragraph}` : paragraph;

      if (candidate.length <= 900) {
        buffer = candidate;
        continue;
      }

      if (buffer.length > 0) {
        pushChunk(buffer);
        buffer = paragraph;
        continue;
      }

      const sentences = paragraph
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0);

      let sentenceBuffer = '';

      for (const sentence of sentences) {
        const nextSentenceBuffer =
          sentenceBuffer.length > 0 ? `${sentenceBuffer} ${sentence}` : sentence;

        if (nextSentenceBuffer.length <= 900) {
          sentenceBuffer = nextSentenceBuffer;
          continue;
        }

        pushChunk(sentenceBuffer);
        sentenceBuffer = sentence;
      }

      if (sentenceBuffer.length > 0) {
        buffer = sentenceBuffer;
      }
    }

    if (buffer.length > 0) {
      pushChunk(buffer);
    }

    return chunks;
  }

  private buildSummary(chunks: DocumentChunkCandidate[]) {
    return chunks
      .slice(0, 2)
      .map((chunk) => chunk.content)
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

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

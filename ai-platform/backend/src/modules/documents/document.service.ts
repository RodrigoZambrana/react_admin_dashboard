import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DocumentIngestionStatus,
  DocumentOriginKind,
  ManagedResourceStatus,
  Prisma,
} from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { DocumentChunkRepository } from '../persistence/repositories/document-chunk.repository';
import { DocumentRepository } from '../persistence/repositories/document.repository';
import {
  CreateUrlDocumentInput,
  CreateTextDocumentInput,
  createTextDocumentSchema,
  createUrlDocumentSchema,
  ExtractedDocumentSource,
  ingestDocumentOptionsSchema,
  IngestDocumentOptions,
  updateDocumentSchema,
  UpdateDocumentInput,
} from './document.types';
import { DocumentContentExtractorService } from './document-content-extractor.service';
import { DocumentExtractionProfileConfigService } from './document-extraction-profile-config.service';
import { DocumentIngestionService } from './document-ingestion.service';
import { DocumentKnowledgeViewService } from './document-knowledge-view.service';

@Injectable()
export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly documentChunkRepository: DocumentChunkRepository,
    private readonly contentExtractor: DocumentContentExtractorService,
    private readonly documentIngestionService: DocumentIngestionService,
    private readonly documentKnowledgeViewService: DocumentKnowledgeViewService,
    private readonly documentExtractionProfileConfigService: DocumentExtractionProfileConfigService,
    private readonly logger: PipelineLoggerService,
  ) {}

  listDocuments(filters?: {
    status?: ManagedResourceStatus;
    ingestionStatus?: DocumentIngestionStatus;
    limit?: number;
  }) {
    return this.documentRepository.list(filters);
  }

  async getDocument(documentId: string) {
    const document = await this.documentRepository.findById(documentId);

    if (!document) {
      throw new NotFoundException(`Document ${documentId} was not found`);
    }

    return document;
  }

  getKnowledgeView(input?: { documentId?: string; limit?: number }) {
    return this.documentKnowledgeViewService.getKnowledgeView(input);
  }

  async createTextDocument(input: CreateTextDocumentInput) {
    const parsed = createTextDocumentSchema.parse(input);

    return this.createAndIngest({
      title: parsed.title,
      extractedSource: {
        originKind: DocumentOriginKind.TEXT,
        content: parsed.content.trim(),
        language: parsed.language ?? null,
        mimeType: 'text/plain',
      },
      activate: parsed.activate,
      createdBy: parsed.createdBy,
    });
  }

  async createUrlDocument(input: CreateUrlDocumentInput) {
    const parsed = createUrlDocumentSchema.parse(input);
    const extractedSource = await this.contentExtractor.extractFromUrl({
      url: parsed.url,
      title: parsed.title ?? null,
      language: parsed.language ?? null,
    });

    return this.createAndIngest({
      title:
        parsed.title?.trim() ||
        deriveDocumentTitleFromUrl(parsed.url),
      extractedSource,
      activate: parsed.activate,
      createdBy: parsed.createdBy,
    });
  }

  async createUploadedDocument(input: {
    title?: string;
    file: {
      originalName: string;
      mimeType?: string | null;
      buffer: Buffer;
    };
    activate?: boolean;
    createdBy?: string;
    language?: string;
  }) {
    const extractedSource = await this.contentExtractor.extractFromUpload({
      originalName: input.file.originalName,
      mimeType: input.file.mimeType ?? null,
      buffer: input.file.buffer,
      language: input.language ?? null,
    });

    return this.createAndIngest({
      title:
        input.title?.trim() ||
        deriveDocumentTitle(input.file.originalName),
      extractedSource,
      activate: input.activate ?? true,
      createdBy: input.createdBy,
    });
  }

  async ingestDocument(documentId: string, options?: IngestDocumentOptions) {
    const parsed = ingestDocumentOptionsSchema.parse(options ?? {});
    const existing = await this.getDocument(documentId);

    if (!existing.sourceText.trim()) {
      throw new BadRequestException('Document does not contain source text');
    }

    return this.documentIngestionService.ingestDocument({
      documentId,
      activate: parsed.activate,
      createdBy: parsed.createdBy,
    });
  }

  async updateDocument(documentId: string, input: UpdateDocumentInput) {
    const parsed = updateDocumentSchema.parse(input);
    const existing = await this.getDocument(documentId);
    const title =
      parsed.title !== undefined ? parsed.title.trim() : undefined;
    const content =
      parsed.content !== undefined ? parsed.content.trim() : undefined;
    const language =
      parsed.language !== undefined ? normalizeLanguage(parsed.language) : undefined;
    const sourceChanged =
      content !== undefined && content !== existing.sourceText;
    const languageChanged =
      language !== undefined && (language ?? null) !== (existing.language ?? null);
    const invalidateIngestion = sourceChanged || languageChanged;

    const updated = await this.documentRepository.update({
      documentId,
      ...(title !== undefined ? { title } : {}),
      ...(content !== undefined ? { sourceText: content } : {}),
      ...(language !== undefined ? { language } : {}),
      metadata: this.buildUpdatedMetadata({
        existing: this.asRecord(existing.metadata),
        editedBy: parsed.createdBy ?? 'admin-ui',
        invalidateIngestion,
      }),
      invalidateIngestion,
      nextStatus:
        existing.status === ManagedResourceStatus.ARCHIVED
          ? ManagedResourceStatus.ARCHIVED
          : ManagedResourceStatus.DRAFT,
    });

    if (invalidateIngestion) {
      await this.documentChunkRepository.clearForDocument(documentId);
      await this.documentExtractionProfileConfigService.clearTenantDerivedHints(
        documentId,
      );
    }

    this.logger.log(
      JSON.stringify({
        stage: 'document.updated',
        documentId,
        invalidateIngestion,
        status: updated.status,
        ingestionStatus: updated.ingestionStatus,
      }),
    );

    return updated;
  }

  async activateDocument(documentId: string) {
    const document = await this.getDocument(documentId);

    if (document.ingestionStatus !== DocumentIngestionStatus.READY) {
      throw new BadRequestException(
        'Only ready documents can be activated for conversational retrieval',
      );
    }

    const activated = await this.documentRepository.activate(documentId);

    this.logger.log(
      JSON.stringify({
        stage: 'document.activated',
        documentId,
        status: activated.status,
      }),
    );

    return activated;
  }

  async archiveDocument(documentId: string) {
    const archived = await this.documentRepository.archive(documentId);

    this.logger.log(
      JSON.stringify({
        stage: 'document.archived',
        documentId,
        status: archived.status,
      }),
    );

    return archived;
  }

  async deleteDocument(documentId: string) {
    const document = await this.getDocument(documentId);

    await this.documentRepository.delete(documentId);

    this.logger.log(
      JSON.stringify({
        stage: 'document.deleted',
        documentId,
        status: document.status,
      }),
    );

    return {
      deleted: true,
      documentId,
    };
  }

  private async createAndIngest(input: {
    title: string;
    extractedSource: ExtractedDocumentSource;
    activate: boolean;
    createdBy?: string;
  }) {
    const created = await this.documentRepository.create({
      title: input.title.trim(),
      originKind: input.extractedSource.originKind,
      sourceText: input.extractedSource.content,
      sourceName: input.extractedSource.sourceName ?? null,
      mimeType: input.extractedSource.mimeType ?? null,
      language: input.extractedSource.language ?? null,
      status: ManagedResourceStatus.DRAFT,
      ingestionStatus: DocumentIngestionStatus.PENDING,
      metadata: {
        createdBy: input.createdBy ?? 'admin-ui',
        originKind: input.extractedSource.originKind,
        ...(input.extractedSource.metadata ?? {}),
      },
    });

    return this.documentIngestionService.ingestDocument({
      documentId: created.id,
      activate: input.activate,
      createdBy: input.createdBy,
    });
  }

  private buildUpdatedMetadata(input: {
    existing?: Record<string, unknown>;
    editedBy: string;
    invalidateIngestion: boolean;
  }): Prisma.InputJsonObject {
    const nextMetadata: Record<string, unknown> = {
      ...(input.existing ?? {}),
      lastEditedBy: input.editedBy,
      lastEditedAt: new Date().toISOString(),
    };

    if (input.invalidateIngestion) {
      delete nextMetadata.extractionBootstrap;
      delete nextMetadata.lastIngestedBy;
    }

    return nextMetadata as Prisma.InputJsonObject;
  }

  private asRecord(value: unknown) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }
}

function normalizeLanguage(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function deriveDocumentTitle(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').trim() || 'Uploaded document';
}

function deriveDocumentTitleFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split('/').filter(Boolean).pop();
    return deriveDocumentTitle(lastSegment ?? parsed.hostname);
  } catch {
    return 'URL document';
  }
}

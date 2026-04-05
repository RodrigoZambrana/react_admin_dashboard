import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DocumentIngestionStatus,
  DocumentOriginKind,
  ManagedResourceStatus,
} from '@prisma/client';

import { PipelineLoggerService } from '../logging/pipeline-logger.service';
import { DocumentRepository } from '../persistence/repositories/document.repository';
import {
  CreateUrlDocumentInput,
  CreateTextDocumentInput,
  createTextDocumentSchema,
  createUrlDocumentSchema,
  ExtractedDocumentSource,
  ingestDocumentOptionsSchema,
  IngestDocumentOptions,
} from './document.types';
import { DocumentContentExtractorService } from './document-content-extractor.service';
import { DocumentIngestionService } from './document-ingestion.service';
import { DocumentKnowledgeViewService } from './document-knowledge-view.service';

@Injectable()
export class DocumentService {
  constructor(
    private readonly documentRepository: DocumentRepository,
    private readonly contentExtractor: DocumentContentExtractorService,
    private readonly documentIngestionService: DocumentIngestionService,
    private readonly documentKnowledgeViewService: DocumentKnowledgeViewService,
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

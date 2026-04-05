import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DocumentIngestionStatus,
  ManagedResourceStatus,
} from '@prisma/client';

import { DocumentService } from '../documents/document.service';

@Injectable()
export class AdminDocumentsService {
  constructor(private readonly documentService: DocumentService) {}

  listDocuments(input: {
    status?: string;
    ingestionStatus?: string;
    limit?: number;
  }) {
    return this.documentService.listDocuments({
      status: input.status ? this.parseStatus(input.status) : undefined,
      ingestionStatus: input.ingestionStatus
        ? this.parseIngestionStatus(input.ingestionStatus)
        : undefined,
      limit: normalizeLimit(input.limit, 50),
    });
  }

  getDocument(documentId: string) {
    return this.documentService.getDocument(documentId);
  }

  getKnowledgeView(input?: { documentId?: string; limit?: number }) {
    return this.documentService.getKnowledgeView(input);
  }

  createTextDocument(input: {
    title: string;
    content: string;
    language?: string;
    createdBy?: string;
    activate?: boolean;
  }) {
    return this.documentService.createTextDocument({
      ...input,
      activate: input.activate ?? true,
    });
  }

  createUrlDocument(input: {
    url: string;
    title?: string;
    language?: string;
    createdBy?: string;
    activate?: boolean;
  }) {
    return this.documentService.createUrlDocument({
      ...input,
      activate: input.activate ?? true,
    });
  }

  createUploadedDocument(input: {
    title?: string;
    language?: string;
    createdBy?: string;
    activate?: boolean;
    file: {
      originalName: string;
      mimeType?: string | null;
      buffer: Buffer;
    };
  }) {
    return this.documentService.createUploadedDocument(input);
  }

  ingestDocument(documentId: string, input?: { activate?: boolean; createdBy?: string }) {
    return this.documentService.ingestDocument(documentId, {
      activate: input?.activate ?? true,
      createdBy: input?.createdBy,
    });
  }

  activateDocument(documentId: string) {
    return this.documentService.activateDocument(documentId);
  }

  archiveDocument(documentId: string) {
    return this.documentService.archiveDocument(documentId);
  }

  private parseStatus(value: string) {
    const normalized = value.trim().toUpperCase();

    if (
      normalized === ManagedResourceStatus.DRAFT ||
      normalized === ManagedResourceStatus.ACTIVE ||
      normalized === ManagedResourceStatus.ARCHIVED
    ) {
      return normalized as ManagedResourceStatus;
    }

    throw new BadRequestException(`Unsupported document status "${value}"`);
  }

  private parseIngestionStatus(value: string) {
    const normalized = value.trim().toUpperCase();

    if (
      normalized === DocumentIngestionStatus.PENDING ||
      normalized === DocumentIngestionStatus.PROCESSING ||
      normalized === DocumentIngestionStatus.READY ||
      normalized === DocumentIngestionStatus.FAILED
    ) {
      return normalized as DocumentIngestionStatus;
    }

    throw new BadRequestException(
      `Unsupported document ingestion status "${value}"`,
    );
  }
}

function normalizeLimit(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value) || !value || value < 1) {
    return fallback;
  }

  return Math.min(Math.floor(value), 100);
}

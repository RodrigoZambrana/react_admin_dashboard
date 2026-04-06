import {
  DocumentIngestionStatus,
  DocumentOriginKind,
  ManagedResourceStatus,
  Prisma,
} from '@prisma/client';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from '../tenant/tenant-context.service';

type CreateDocumentRecordInput = {
  title: string;
  originKind: DocumentOriginKind;
  sourceText: string;
  sourceName?: string | null;
  mimeType?: string | null;
  language?: string | null;
  status?: ManagedResourceStatus;
  ingestionStatus?: DocumentIngestionStatus;
  metadata?: Prisma.InputJsonValue | null;
};

type UpdateDocumentRecordInput = {
  documentId: string;
  title?: string;
  sourceText?: string;
  language?: string | null;
  metadata?: Prisma.InputJsonValue | null;
  invalidateIngestion?: boolean;
  nextStatus?: ManagedResourceStatus;
};

@Injectable()
export class DocumentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  create(input: CreateDocumentRecordInput) {
    return this.prisma.documentRecord.create({
      data: {
        tenantId: this.tenantContext.getTenantId(),
        title: input.title,
        originKind: input.originKind,
        sourceText: input.sourceText,
        sourceName: input.sourceName ?? null,
        mimeType: input.mimeType ?? null,
        language: input.language ?? null,
        status: input.status ?? ManagedResourceStatus.DRAFT,
        ingestionStatus: input.ingestionStatus ?? DocumentIngestionStatus.PENDING,
        metadata: this.toJsonValue(input.metadata),
      },
      include: {
        chunks: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  list(filters?: {
    status?: ManagedResourceStatus;
    ingestionStatus?: DocumentIngestionStatus;
    limit?: number;
  }) {
    return this.prisma.documentRecord.findMany({
      where: {
        status: filters?.status,
        ingestionStatus: filters?.ingestionStatus,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: filters?.limit,
      include: {
        chunks: {
          orderBy: {
            sequence: 'asc',
          },
          take: 2,
        },
      },
    });
  }

  findById(documentId: string) {
    return this.prisma.documentRecord.findFirst({
      where: {
        id: documentId,
      },
      include: {
        chunks: {
          orderBy: {
            sequence: 'asc',
          },
        },
      },
    });
  }

  listActiveReadyDocuments(limit = 100) {
    return this.prisma.documentRecord.findMany({
      where: {
        status: ManagedResourceStatus.ACTIVE,
        ingestionStatus: DocumentIngestionStatus.READY,
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
    });
  }

  async markProcessing(documentId: string) {
    await this.prisma.documentRecord.updateMany({
      where: {
        id: documentId,
      },
      data: {
        ingestionStatus: DocumentIngestionStatus.PROCESSING,
        lastError: null,
      },
    });

    return this.findByIdOrThrow(documentId);
  }

  async update(input: UpdateDocumentRecordInput) {
    const data: Prisma.DocumentRecordUpdateManyMutationInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.sourceText !== undefined ? { sourceText: input.sourceText } : {}),
      ...(input.language !== undefined ? { language: input.language } : {}),
      ...(input.metadata !== undefined
        ? {
            metadata: this.toJsonValue(input.metadata),
          }
        : {}),
    };

    if (input.invalidateIngestion) {
      data.ingestionStatus = DocumentIngestionStatus.PENDING;
      data.status = input.nextStatus ?? ManagedResourceStatus.DRAFT;
      data.summary = null;
      data.chunkCount = 0;
      data.lastIngestedAt = null;
      data.lastError = null;
    }

    await this.prisma.documentRecord.updateMany({
      where: {
        id: input.documentId,
      },
      data,
    });

    return this.findByIdOrThrow(input.documentId);
  }

  async markReady(input: {
    documentId: string;
    summary: string;
    chunkCount: number;
    status: ManagedResourceStatus;
    metadata?: Prisma.InputJsonValue | null;
  }) {
    await this.prisma.documentRecord.updateMany({
      where: {
        id: input.documentId,
      },
      data: {
        ingestionStatus: DocumentIngestionStatus.READY,
        status: input.status,
        summary: input.summary,
        chunkCount: input.chunkCount,
        lastIngestedAt: new Date(),
        lastError: null,
        metadata: this.toJsonValue(input.metadata),
      },
    });

    return this.findByIdOrThrow(input.documentId);
  }

  async markFailed(documentId: string, errorMessage: string) {
    await this.prisma.documentRecord.updateMany({
      where: {
        id: documentId,
      },
      data: {
        ingestionStatus: DocumentIngestionStatus.FAILED,
        lastError: errorMessage,
      },
    });

    return this.findByIdOrThrow(documentId);
  }

  async activate(documentId: string) {
    await this.prisma.documentRecord.updateMany({
      where: {
        id: documentId,
      },
      data: {
        status: ManagedResourceStatus.ACTIVE,
      },
    });

    return this.findByIdOrThrow(documentId);
  }

  async archive(documentId: string) {
    await this.prisma.documentRecord.updateMany({
      where: {
        id: documentId,
      },
      data: {
        status: ManagedResourceStatus.ARCHIVED,
      },
    });

    return this.findByIdOrThrow(documentId);
  }

  async delete(documentId: string) {
    return this.prisma.documentRecord.deleteMany({
      where: {
        id: documentId,
      },
    });
  }

  private async findByIdOrThrow(documentId: string) {
    const document = await this.findById(documentId);

    if (!document) {
      throw new Error(`Document ${documentId} was not found after update.`);
    }

    return document;
  }

  private toJsonValue(
    value: Prisma.InputJsonValue | null | undefined,
  ): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return Prisma.JsonNull;
    }

    return value;
  }
}

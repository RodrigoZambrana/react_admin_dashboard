import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AdminDocumentsService } from './admin-documents.service';
import { ActivateManagedResourceVersionDto } from './dto/activate-managed-resource-version.dto';
import { CreateTextDocumentDto } from './dto/create-text-document.dto';
import { CreateUrlDocumentDto } from './dto/create-url-document.dto';
import { IngestDocumentDto } from './dto/ingest-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { UploadDocumentDto } from './dto/upload-document.dto';

@Controller('admin/documents')
export class AdminDocumentsController {
  constructor(private readonly adminDocumentsService: AdminDocumentsService) {}

  @Get()
  listDocuments(
    @Query('status') status?: string,
    @Query('ingestionStatus') ingestionStatus?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminDocumentsService.listDocuments({
      status,
      ingestionStatus,
      limit: Number(limit ?? 50),
    });
  }

  @Get('knowledge-view')
  getKnowledgeView(
    @Query('documentId') documentId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminDocumentsService.getKnowledgeView({
      documentId,
      limit: Number(limit ?? 500),
    });
  }

  @Get('proposition-candidates')
  listPropositionCandidates(
    @Query('profileKey') profileKey?: string,
    @Query('predicate') predicate?: string,
    @Query('promotionStates') promotionStates?: string,
    @Query('minOccurrences') minOccurrences?: string,
    @Query('limit') limit?: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.adminDocumentsService.listPropositionCandidates({
      profileKey,
      predicate,
      promotionStates: normalizePromotionStates(promotionStates),
      minOccurrences: Number(minOccurrences ?? 2),
      limit: Number(limit ?? 50),
      activeOnly: normalizeBoolean(activeOnly, true),
    });
  }

  @Get(':documentId')
  getDocument(@Param('documentId') documentId: string) {
    return this.adminDocumentsService.getDocument(documentId);
  }

  @Patch(':documentId')
  updateDocument(
    @Param('documentId') documentId: string,
    @Body() body: UpdateDocumentDto,
  ) {
    return this.adminDocumentsService.updateDocument(documentId, body);
  }

  @Post('text')
  createTextDocument(@Body() body: CreateTextDocumentDto) {
    return this.adminDocumentsService.createTextDocument(body);
  }

  @Post('url')
  createUrlDocument(@Body() body: CreateUrlDocumentDto) {
    return this.adminDocumentsService.createUrlDocument({
      url: body.url,
      title: body.title,
      language: body.language,
      createdBy: body.createdBy,
      activate: normalizeBoolean(body.activate, true),
    });
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @UploadedFile() file:
      | {
          originalname: string;
          mimetype: string;
          buffer: Buffer;
        }
      | undefined,
    @Body() body: UploadDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('Document file upload is required');
    }

    return this.adminDocumentsService.createUploadedDocument({
      title: body.title,
      language: body.language,
      createdBy: body.createdBy,
      activate: normalizeBoolean(body.activate, true),
      file: {
        originalName: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
      },
    });
  }

  @Post(':documentId/ingest')
  ingestDocument(
    @Param('documentId') documentId: string,
    @Body() body: IngestDocumentDto,
  ) {
    return this.adminDocumentsService.ingestDocument(documentId, {
      activate: normalizeBoolean(body.activate, true),
      createdBy: body.createdBy,
    });
  }

  @Post(':documentId/activate')
  activateDocument(
    @Param('documentId') documentId: string,
    @Body() _body: ActivateManagedResourceVersionDto,
  ) {
    return this.adminDocumentsService.activateDocument(documentId);
  }

  @Post(':documentId/archive')
  archiveDocument(
    @Param('documentId') documentId: string,
    @Body() _body: ActivateManagedResourceVersionDto,
  ) {
    return this.adminDocumentsService.archiveDocument(documentId);
  }

  @Delete(':documentId')
  deleteDocument(@Param('documentId') documentId: string) {
    return this.adminDocumentsService.deleteDocument(documentId);
  }
}

function normalizeBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();

    if (normalized === 'true') {
      return true;
    }

    if (normalized === 'false') {
      return false;
    }
  }

  return fallback;
}

function normalizePromotionStates(value?: string) {
  if (!value?.trim()) {
    return undefined;
  }

  const states = value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .filter((entry): entry is 'unclassified' | 'candidate' | 'promoted' | 'rejected' =>
      entry === 'unclassified' ||
      entry === 'candidate' ||
      entry === 'promoted' ||
      entry === 'rejected',
    );

  return states.length > 0 ? states : undefined;
}

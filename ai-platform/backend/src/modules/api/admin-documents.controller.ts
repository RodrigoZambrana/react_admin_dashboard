import {
  BadRequestException,
  Body,
  Controller,
  Get,
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

  @Get(':documentId')
  getDocument(@Param('documentId') documentId: string) {
    return this.adminDocumentsService.getDocument(documentId);
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

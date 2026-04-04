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

import { AdminCatalogService } from './admin-catalog.service';
import { ActivateManagedResourceVersionDto } from './dto/activate-managed-resource-version.dto';
import { CreateRestCatalogSourceDto } from './dto/create-rest-catalog-source.dto';
import { UploadCatalogSourceDto } from './dto/upload-catalog-source.dto';

@Controller('admin/catalog-sources')
export class AdminCatalogController {
  constructor(private readonly adminCatalogService: AdminCatalogService) {}

  @Get()
  listCatalogSources(
    @Query('status') status?: string,
    @Query('kind') kind?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminCatalogService.listSources({
      status,
      kind,
      limit: Number(limit ?? 50),
    });
  }

  @Get(':sourceId')
  getCatalogSource(@Param('sourceId') sourceId: string) {
    return this.adminCatalogService.getSource(sourceId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadCatalogSource(
    @UploadedFile() file:
      | {
          originalname: string;
          mimetype: string;
          buffer: Buffer;
        }
      | undefined,
    @Body() body: UploadCatalogSourceDto,
  ) {
    if (!file) {
      throw new BadRequestException('Catalog file upload is required');
    }

    return this.adminCatalogService.createUploadedSource({
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

  @Post('rest')
  createRestCatalogSource(@Body() body: CreateRestCatalogSourceDto) {
    return this.adminCatalogService.createRestSource({
      title: body.title,
      endpointUrl: body.endpointUrl,
      queryParam: body.queryParam,
      skuParam: body.skuParam,
      itemsPath: body.itemsPath,
      headers: body.headers ?? {},
      fieldMap: body.fieldMap ?? {},
      createdBy: body.createdBy,
      activate: normalizeBoolean(body.activate, true),
    });
  }

  @Post(':sourceId/sync')
  syncCatalogSource(
    @Param('sourceId') sourceId: string,
    @Body() body: ActivateManagedResourceVersionDto,
  ) {
    return this.adminCatalogService.syncSource(
      sourceId,
      normalizeBoolean((body as any).activate, true),
    );
  }

  @Post(':sourceId/activate')
  activateCatalogSource(
    @Param('sourceId') sourceId: string,
    @Body() _body: ActivateManagedResourceVersionDto,
  ) {
    return this.adminCatalogService.activateSource(sourceId);
  }

  @Post(':sourceId/archive')
  archiveCatalogSource(
    @Param('sourceId') sourceId: string,
    @Body() _body: ActivateManagedResourceVersionDto,
  ) {
    return this.adminCatalogService.archiveSource(sourceId);
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

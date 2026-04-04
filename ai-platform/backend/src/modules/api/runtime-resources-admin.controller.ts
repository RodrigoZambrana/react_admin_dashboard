import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CriticalConfigService } from '../critical-config/critical-config.service';
import { KnowledgeMetadataService } from '../knowledge-metadata/knowledge-metadata.service';
import { PromptService } from '../prompt/prompt.service';
import { ResponseFallbackService } from '../response-fallback/response-fallback.service';
import { TemporalLocaleService } from '../temporal/temporal-locale.service';
import { CreateCriticalConfigVersionDto } from './dto/create-critical-config-version.dto';
import { CreateKnowledgeMetadataVersionDto } from './dto/create-knowledge-metadata-version.dto';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';
import { CreateResponseFallbackVersionDto } from './dto/create-response-fallback-version.dto';
import { CreateTemporalLocaleVersionDto } from './dto/create-temporal-locale-version.dto';
import { ActivateManagedResourceVersionDto } from './dto/activate-managed-resource-version.dto';

@Controller('admin/runtime-resources')
export class RuntimeResourcesAdminController {
  constructor(
    private readonly promptService: PromptService,
    private readonly temporalLocaleService: TemporalLocaleService,
    private readonly criticalConfigService: CriticalConfigService,
    private readonly knowledgeMetadataService: KnowledgeMetadataService,
    private readonly responseFallbackService: ResponseFallbackService,
  ) {}

  @Get('prompts')
  listPromptVersions(@Query('key') key?: string) {
    return this.promptService.listPrompts(key);
  }

  @Get('prompts/active')
  listActivePrompts() {
    return this.promptService.listActivePrompts();
  }

  @Post('prompts')
  createPromptVersion(@Body() body: CreatePromptVersionDto) {
    return this.promptService.createPromptVersion(body);
  }

  @Post('prompts/:versionId/activate')
  activatePromptVersion(
    @Param('versionId') versionId: string,
    @Body() body: ActivateManagedResourceVersionDto,
  ) {
    return this.promptService.activatePromptVersion(versionId, body.createdBy);
  }

  @Get('temporal-locales')
  listTemporalLocaleVersions(@Query('locale') locale?: string) {
    return this.temporalLocaleService.listVersions(locale);
  }

  @Get('temporal-locales/active')
  listActiveTemporalLocales() {
    return this.temporalLocaleService.listActiveLocales();
  }

  @Post('temporal-locales')
  createTemporalLocaleVersion(@Body() body: CreateTemporalLocaleVersionDto) {
    return this.temporalLocaleService.createVersion({
      locale: body.locale,
      resource: body.resource as any,
      createdBy: body.createdBy,
      activate: body.activate,
    });
  }

  @Post('temporal-locales/:versionId/activate')
  activateTemporalLocaleVersion(
    @Param('versionId') versionId: string,
    @Body() body: ActivateManagedResourceVersionDto,
  ) {
    return this.temporalLocaleService.activateVersion(versionId, body.createdBy);
  }

  @Get('critical-configs')
  listCriticalConfigVersions(@Query('key') key?: string) {
    return this.criticalConfigService.listConfigs(key as any);
  }

  @Get('critical-configs/active')
  listActiveCriticalConfigs() {
    return this.criticalConfigService.listActiveConfigs();
  }

  @Post('critical-configs')
  createCriticalConfigVersion(@Body() body: CreateCriticalConfigVersionDto) {
    return this.criticalConfigService.createVersion({
      key: body.key as any,
      value: body.value as any,
      createdBy: body.createdBy,
      activate: body.activate,
    });
  }

  @Get('knowledge-metadata')
  listKnowledgeMetadataVersions(@Query('key') key?: string) {
    return this.knowledgeMetadataService.listVersions(key as any);
  }

  @Get('knowledge-metadata/active')
  listActiveKnowledgeMetadata() {
    return this.knowledgeMetadataService.listActiveResources();
  }

  @Post('knowledge-metadata')
  createKnowledgeMetadataVersion(
    @Body() body: CreateKnowledgeMetadataVersionDto,
  ) {
    return this.knowledgeMetadataService.createVersion({
      key: body.key as any,
      resource: body.resource as any,
      createdBy: body.createdBy,
      activate: body.activate,
    });
  }

  @Get('response-fallbacks')
  listResponseFallbackVersions(@Query('locale') locale?: string) {
    return this.responseFallbackService.listVersions(locale);
  }

  @Get('response-fallbacks/active')
  listActiveResponseFallbacks() {
    return this.responseFallbackService.listActiveCatalogs();
  }

  @Post('response-fallbacks')
  createResponseFallbackVersion(@Body() body: CreateResponseFallbackVersionDto) {
    return this.responseFallbackService.createVersion({
      locale: body.locale,
      resource: body.resource as any,
      createdBy: body.createdBy,
      activate: body.activate,
    });
  }
}

import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CriticalConfigService } from '../critical-config/critical-config.service';
import { KnowledgeMetadataService } from '../knowledge-metadata/knowledge-metadata.service';
import { PromptService } from '../prompt/prompt.service';
import { ResponseFallbackService } from '../response-fallback/response-fallback.service';
import { TemporalLocaleService } from '../temporal/temporal-locale.service';
import { AiRuntimeDiagnosticsService } from '../runtime-config/ai-runtime-diagnostics.service';
import { AI_RUNTIME_OPENAI_SECRET_KEY } from '../runtime-config/ai-runtime-secrets';
import { AiPromptVisibilityService } from '../ai-gateway/ai-prompt-visibility.service';
import { TenantRuntimeContextService } from '../persistence/tenant/tenant-runtime-context.service';
import { CreateCriticalConfigVersionDto } from './dto/create-critical-config-version.dto';
import { CreateKnowledgeMetadataVersionDto } from './dto/create-knowledge-metadata-version.dto';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';
import { CreateResponseFallbackVersionDto } from './dto/create-response-fallback-version.dto';
import { CreateTemporalLocaleVersionDto } from './dto/create-temporal-locale-version.dto';
import { ActivateManagedResourceVersionDto } from './dto/activate-managed-resource-version.dto';
import { UpdateAiRuntimeSecureCredentialDto } from './dto/update-ai-runtime-secure-credential.dto';
import { SecureConfigService } from '../security/secure-config.service';

@Controller('admin/runtime-resources')
export class RuntimeResourcesAdminController {
  constructor(
    private readonly promptService: PromptService,
    private readonly temporalLocaleService: TemporalLocaleService,
    private readonly criticalConfigService: CriticalConfigService,
    private readonly knowledgeMetadataService: KnowledgeMetadataService,
    private readonly responseFallbackService: ResponseFallbackService,
    private readonly aiRuntimeDiagnosticsService: AiRuntimeDiagnosticsService,
    private readonly aiPromptVisibilityService: AiPromptVisibilityService,
    private readonly tenantRuntimeContextService: TenantRuntimeContextService,
    private readonly secureConfigService: SecureConfigService,
    private readonly configService: ConfigService,
  ) {}

  @Get('prompts')
  listPromptVersions(@Query('key') key?: string) {
    return this.promptService.listPrompts(key);
  }

  @Get('prompts/active')
  listActivePrompts() {
    return this.promptService.listActivePrompts();
  }

  @Get('prompts/effective')
  listEffectivePromptViews() {
    return this.aiPromptVisibilityService.listEffectivePromptViews();
  }

  @Get('context')
  getRuntimeContext() {
    return this.tenantRuntimeContextService.getRuntimeContext();
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

  @Post('prompts/:versionId/archive')
  archivePromptVersion(
    @Param('versionId') versionId: string,
    @Body() body: ActivateManagedResourceVersionDto,
  ) {
    return this.promptService.archivePromptVersion(versionId, body.createdBy);
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

  @Get('critical-configs/ai-runtime/diagnostics')
  getAiRuntimeDiagnostics() {
    return this.aiRuntimeDiagnosticsService.getDiagnostics();
  }

  @Get('critical-configs/ai-runtime/secure-credential')
  async getAiRuntimeSecureCredential() {
    const managed = await this.criticalConfigService.getAiRuntimeConfig();
    const envKey = managed?.credentials?.envKey?.trim() || 'OPENAI_API_KEY';
    const stored = await this.secureConfigService.getString(
      AI_RUNTIME_OPENAI_SECRET_KEY,
    );
    const envValue = envKey ? this.configService.get<string>(envKey) : null;

    return {
      key: AI_RUNTIME_OPENAI_SECRET_KEY,
      envKey,
      source: stored?.value
        ? 'database'
        : envValue?.trim()
          ? 'environment'
          : 'missing',
      storedSecret: Boolean(stored?.value),
      envPresent: Boolean(envValue?.trim()),
      updatedAt: stored?.updatedAt?.toISOString() ?? null,
    };
  }

  @Put('critical-configs/ai-runtime/secure-credential')
  async updateAiRuntimeSecureCredential(
    @Body() body: UpdateAiRuntimeSecureCredentialDto,
  ) {
    const value = body.value?.trim() || null;
    await this.secureConfigService.setString(AI_RUNTIME_OPENAI_SECRET_KEY, value);
    return this.getAiRuntimeSecureCredential();
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

  @Post('critical-configs/:versionId/activate')
  activateCriticalConfigVersion(
    @Param('versionId') versionId: string,
    @Body() body: ActivateManagedResourceVersionDto,
  ) {
    return this.criticalConfigService.activateVersion(versionId, body.createdBy);
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

  @Post('knowledge-metadata/:versionId/activate')
  activateKnowledgeMetadataVersion(
    @Param('versionId') versionId: string,
    @Body() body: ActivateManagedResourceVersionDto,
  ) {
    return this.knowledgeMetadataService.activateVersion(
      versionId,
      body.createdBy,
    );
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

  @Post('response-fallbacks/:versionId/activate')
  activateResponseFallbackVersion(
    @Param('versionId') versionId: string,
    @Body() body: ActivateManagedResourceVersionDto,
  ) {
    return this.responseFallbackService.activateVersion(versionId, body.createdBy);
  }
}

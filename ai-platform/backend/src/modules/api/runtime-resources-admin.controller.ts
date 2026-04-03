import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { PromptService } from '../prompt/prompt.service';
import { TemporalLocaleService } from '../temporal/temporal-locale.service';
import { CreatePromptVersionDto } from './dto/create-prompt-version.dto';
import { CreateTemporalLocaleVersionDto } from './dto/create-temporal-locale-version.dto';

@Controller('admin/runtime-resources')
export class RuntimeResourcesAdminController {
  constructor(
    private readonly promptService: PromptService,
    private readonly temporalLocaleService: TemporalLocaleService,
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
}

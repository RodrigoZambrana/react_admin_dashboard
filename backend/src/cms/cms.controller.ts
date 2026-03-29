import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { CmsService } from './cms.service'
import { CmsPagesService } from './cms-pages.service'
import { CmsEntryDto, CmsListEntriesQueryDto, CmsSectionDto } from './dto/cms.dto'
import {
  CmsListMediaQueryDto,
  CmsListPagesQueryDto,
  CmsMediaDto,
  CmsPageDto,
} from './dto/cms-pages.dto'
import { parseSingleFileMultipart } from '../common/uploads/multipart'

@Controller('cms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
export class CmsController {
  constructor(
    private readonly cms: CmsService,
    private readonly cmsPages: CmsPagesService,
  ) {}

  @Get('sections')
  listSections() {
    return this.cms.listSections()
  }

  @Get('sections/:id')
  getSection(@Param('id', ParseIntPipe) id: number) {
    return this.cms.getSection(id)
  }

  @Post('sections')
  createSection(@Body() dto: CmsSectionDto) {
    return this.cms.createSection(dto)
  }

  @Put('sections/:id')
  updateSection(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CmsSectionDto>) {
    return this.cms.updateSection(id, dto)
  }

  @Delete('sections/:id')
  deleteSection(@Param('id', ParseIntPipe) id: number) {
    return this.cms.deleteSection(id)
  }

  @Get('entries')
  listEntries(@Query() query: CmsListEntriesQueryDto) {
    return this.cms.listEntries(query)
  }

  @Get('entries/:id')
  getEntry(@Param('id', ParseIntPipe) id: number) {
    return this.cms.getEntry(id)
  }

  @Post('entries')
  createEntry(@Body() dto: CmsEntryDto) {
    return this.cms.createEntry(dto)
  }

  @Put('entries/:id')
  updateEntry(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CmsEntryDto>) {
    return this.cms.updateEntry(id, dto)
  }

  @Delete('entries/:id')
  deleteEntry(@Param('id', ParseIntPipe) id: number) {
    return this.cms.deleteEntry(id)
  }

  @Get('pages')
  listPages(@Query() query: CmsListPagesQueryDto) {
    return this.cmsPages.listPages(query)
  }

  @Get('pages/:id')
  getPage(@Param('id', ParseIntPipe) id: number) {
    return this.cmsPages.getPage(id)
  }

  @Post('pages')
  createPage(@Body() dto: CmsPageDto) {
    return this.cmsPages.createPage(dto)
  }

  @Put('pages/:id')
  updatePage(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CmsPageDto>) {
    return this.cmsPages.updatePage(id, dto)
  }

  @Delete('pages/:id')
  deletePage(@Param('id', ParseIntPipe) id: number) {
    return this.cmsPages.deletePage(id)
  }

  @Get('media')
  listMedia(@Query() query: CmsListMediaQueryDto) {
    return this.cmsPages.listMedia(query)
  }

  @Get('media/:id')
  getMedia(@Param('id', ParseIntPipe) id: number) {
    return this.cmsPages.getMedia(id)
  }

  @Post('media')
  createMedia(@Body() dto: CmsMediaDto) {
    return this.cmsPages.createMedia(dto)
  }

  @Put('media/:id')
  updateMedia(@Param('id', ParseIntPipe) id: number, @Body() dto: Partial<CmsMediaDto>) {
    return this.cmsPages.updateMedia(id, dto)
  }

  @Post('media/upload')
  async uploadMedia(@Req() req: FastifyRequest) {
    const parsed = await parseSingleFileMultipart(req)
    if (!parsed.file) {
      throw new BadRequestException('cms.media.fileRequired')
    }

    return this.cmsPages.uploadMedia(
      {
        alt: parsed.fields.alt || undefined,
        title: parsed.fields.title || undefined,
        source: parsed.fields.source || undefined,
      },
      parsed.file,
    )
  }

  @Delete('media/:id')
  deleteMedia(@Param('id', ParseIntPipe) id: number) {
    return this.cmsPages.deleteMedia(id)
  }
}

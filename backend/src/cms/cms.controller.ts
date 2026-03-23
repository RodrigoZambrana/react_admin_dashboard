import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { CmsService } from './cms.service'
import { CmsEntryDto, CmsListEntriesQueryDto, CmsSectionDto } from './dto/cms.dto'

@Controller('cms')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
export class CmsController {
  constructor(private readonly cms: CmsService) {}

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
}

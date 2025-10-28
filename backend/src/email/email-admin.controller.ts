import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/roles.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { EmailCategory, EmailLogStatus, EmailRecipientType, EmailTemplateVariant } from '@prisma/client'
import { EmailSettingsService } from './email-settings.service'
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto'
import { EmailLogService } from './email-log.service'
import { UpsertRoleRuleDto } from './dto/upsert-role-rule.dto'
import { EmailTemplateService } from './email-template.service'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
@Controller('settings/email')
export class EmailAdminController {
  constructor(
    private readonly settings: EmailSettingsService,
    private readonly logs: EmailLogService,
    private readonly templates: EmailTemplateService,
  ) {}

  @Get('categories')
  async listCategories() {
    return this.settings.listSettings()
  }

  @Put('categories/:category')
  async updateCategory(@Param('category') categoryParam: string, @Body() body: UpdateEmailSettingsDto) {
    const category = this.parseCategory(categoryParam)
    await this.settings.getCategorySettings(category)
    return this.settings.updateCategorySettings(category, body)
  }

  @Get('rules')
  async listRoleRules() {
    return this.settings.listRoleRules()
  }

  @Get('rules/options')
  async listRoleOptions() {
    return this.settings.getRoleOptions()
  }

  @Post('rules')
  async createRoleRule(@Body() body: UpsertRoleRuleDto) {
    return this.settings.upsertRoleRule(null, body)
  }

  @Put('rules/:id')
  async updateRoleRule(@Param('id') idParam: string, @Body() body: UpsertRoleRuleDto) {
    const id = Number(idParam)
    if (!Number.isInteger(id)) {
      throw new BadRequestException('Invalid rule id')
    }
    return this.settings.upsertRoleRule(id, body)
  }

  @Delete('rules/:id')
  async deleteRoleRule(@Param('id') idParam: string) {
    const id = Number(idParam)
    if (!Number.isInteger(id)) {
      throw new BadRequestException('Invalid rule id')
    }
    await this.settings.deleteRoleRule(id)
    return { ok: true }
  }

  @Get('logs')
  async listLogs(
    @Query('category') categoryParam?: string,
    @Query('status') statusParam?: string,
    @Query('recipientType') recipientTypeParam?: string,
    @Query('take') takeParam?: string,
    @Query('cursor') cursorParam?: string,
    @Query('search') search?: string,
    @Query('from') fromDateParam?: string,
    @Query('to') toDateParam?: string,
  ) {
    const category = categoryParam ? this.parseCategory(categoryParam) : undefined
    const status = statusParam ? this.parseStatus(statusParam) : undefined
    const recipientType = recipientTypeParam ? this.parseRecipientType(recipientTypeParam) : undefined
    const take = takeParam ? Number(takeParam) : undefined
    const cursor = cursorParam ? Number(cursorParam) : undefined
    const fromDate = fromDateParam ? new Date(fromDateParam) : undefined
    const toDate = toDateParam ? new Date(toDateParam) : undefined
    return this.logs.listLogs({
      category,
      status,
      recipientType,
      take,
      cursor,
      search,
      fromDate: fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : undefined,
      toDate: toDate && !Number.isNaN(toDate.getTime()) ? toDate : undefined,
    })
  }

  @Get('templates')
  async listTemplates() {
    return this.templates.listActiveTemplates()
  }

  private parseCategory(value: string): EmailCategory {
    const normalized = value.toUpperCase()
    if (!(normalized in EmailCategory)) {
      throw new BadRequestException(`Unknown email category: ${value}`)
    }
    return EmailCategory[normalized as keyof typeof EmailCategory]
  }

  private parseStatus(value: string): EmailLogStatus {
    const normalized = value.toUpperCase()
    if (!(normalized in EmailLogStatus)) {
      throw new BadRequestException(`Unknown email log status: ${value}`)
    }
    return EmailLogStatus[normalized as keyof typeof EmailLogStatus]
  }

  private parseRecipientType(value: string): EmailRecipientType {
    const normalized = value.toUpperCase()
    if (!(normalized in EmailRecipientType)) {
      throw new BadRequestException(`Unknown email recipient type: ${value}`)
    }
    return EmailRecipientType[normalized as keyof typeof EmailRecipientType]
  }
}

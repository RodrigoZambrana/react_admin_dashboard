import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
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
import { EmailService } from './email.service'
import { EmailQueueService } from './queue/email-queue.service'
import { UpdateEmailTemplateDto } from './dto/update-email-template.dto'
import { PreviewEmailTemplateDto } from './dto/preview-email-template.dto'
import { UpdateEmailConfigDto, EmailConfigTestDto } from './dto/update-email-config.dto'
import { EmailProviderFactory } from './email-provider.factory'
import type { EmailProviderConfig } from './email-settings.service'

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
@Controller('settings/email')
export class EmailAdminController {
  constructor(
    private readonly settings: EmailSettingsService,
    private readonly logs: EmailLogService,
    private readonly templates: EmailTemplateService,
    private readonly emailService: EmailService,
    private readonly queue: EmailQueueService,
    private readonly providerFactory: EmailProviderFactory,
  ) {}

  @Get('config')
  async getConfig() {
    return this.settings.getEmailProviderConfig()
  }

  @Put('config')
  async updateConfig(@Body() body: UpdateEmailConfigDto) {
    const payload: EmailProviderConfig = {
      provider: body.provider,
      fromAddress: body.fromAddress,
      fromName: body.fromName,
      smtp:
        body.provider === 'SMTP'
          ? {
              host: body.smtp?.host ?? '',
              port: body.smtp?.port ?? 587,
              secure: body.smtp?.secure ?? false,
              allowInvalidCerts: body.smtp?.allowInvalidCerts ?? false,
              user: body.smtp?.user ?? null,
              password: body.smtp?.password ?? null,
            }
          : null,
    }
    const updated = await this.settings.updateEmailProviderConfig(payload)
    this.providerFactory.reset()
    return updated
  }

  @Post('config/test')
  async sendConfigTest(@Body() body: EmailConfigTestDto) {
    this.providerFactory.reset()
    await this.emailService.sendTestEmail({
      category: EmailCategory.ORDERS,
      variant: EmailTemplateVariant.ADMIN,
      to: body.to,
      locale: 'en',
      scenarioKey: 'order.received',
    })
    return { ok: true }
  }

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

  @Get('templates/:id')
  async getTemplate(@Param('id') idParam: string) {
    const id = Number(idParam)
    if (!Number.isInteger(id)) {
      throw new BadRequestException('Invalid template id')
    }
    const template = await this.templates.getTemplateById(id)
    if (!template) {
      throw new NotFoundException('Template not found')
    }
    return template
  }

  @Put('templates/:id')
  async updateTemplate(@Param('id') idParam: string, @Body() body: UpdateEmailTemplateDto) {
    const id = Number(idParam)
    if (!Number.isInteger(id)) {
      throw new BadRequestException('Invalid template id')
    }
    await this.templates.updateTemplate(id, body)
    const template = await this.templates.getTemplateById(id)
    if (!template) {
      throw new NotFoundException('Template not found')
    }
    return template
  }

  @Post('templates/:id/preview')
  async previewTemplate(@Param('id') idParam: string, @Body() body: PreviewEmailTemplateDto) {
    const id = Number(idParam)
    if (!Number.isInteger(id)) {
      throw new BadRequestException('Invalid template id')
    }
    const template = await this.templates.getTemplateById(id)
    if (!template) {
      throw new NotFoundException('Template not found')
    }
    const locale = body.locale?.trim() || template.locale
    const sample = await this.emailService.buildPreviewPayload(template.category, template.variant, locale, body.scenarioKey)
    return this.templates.renderTemplateById(id, sample.payload as any, sample.extras)
  }

  @Get('templates/:id/samples')
  async listTemplateSamples(@Param('id') idParam: string, @Query('locale') localeParam?: string) {
    const id = Number(idParam)
    if (!Number.isInteger(id)) {
      throw new BadRequestException('Invalid template id')
    }
    const template = await this.templates.getTemplateById(id)
    if (!template) {
      throw new NotFoundException('Template not found')
    }
    const locale = localeParam?.trim() || template.locale
    const options = this.emailService.getSampleScenarioOptions(template.category, template.variant, locale)
    return { options }
  }

  @Get('metrics')
  async getMetrics() {
    return this.queue.getMetricsSnapshot()
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

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
import { ConfigService } from '@nestjs/config'
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
import { SecureConfigService } from '../common/security/secure-config.service'
import { EmailChannelAdapter } from '../inbox/providers/email/email-channel.adapter'
import { buildEmailChannelConfig } from '../inbox/providers/email/email-channel.config'
import { EmailChannelSecurityOption } from '../inbox/providers/email/email-channel.types'
import { INBOX_EMAIL_CONFIG_SECURE_KEY, type StoredInboxEmailConfig } from '../inbox/providers/email/inbox-email-config.types'
import { InboxService } from '../inbox/inbox.service'

type InboxEmailConfigPayload = {
  imapHost?: unknown
  imapPort?: unknown
  imapSecurity?: unknown
  smtpHost?: unknown
  smtpPort?: unknown
  smtpSecurity?: unknown
  username?: unknown
  password?: unknown
  fromAddress?: unknown
  fromName?: unknown
  maxAttachmentSizeMb?: unknown
  ratePerMinute?: unknown
  pollIntervalMs?: unknown
  pollBatchSize?: unknown
}

type InboxEmailConfigResponse = {
  source: 'environment' | 'database'
  updatedAt: Date | null
  imapHost: string
  imapPort: number
  imapSecurity: EmailChannelSecurityOption
  smtpHost: string
  smtpPort: number
  smtpSecurity: EmailChannelSecurityOption
  username: string
  fromAddress: string
  fromName: string | null
  maxAttachmentSizeMb: number
  ratePerMinute: number
  pollIntervalMs: number
  pollBatchSize: number
  passwordSet: boolean
}

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
    private readonly secureConfig: SecureConfigService,
    private readonly configService: ConfigService,
    private readonly emailChannel: EmailChannelAdapter,
    private readonly inboxService: InboxService,
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
      customerEmailsEnabled: body.customerEmailsEnabled ?? true,
      adminEmailsEnabled: body.adminEmailsEnabled ?? true,
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
    const variant = EmailTemplateVariant.ADMIN
    const recipientType = variant === EmailTemplateVariant.ADMIN ? EmailRecipientType.ADMIN : EmailRecipientType.CUSTOMER
    const deliveryEnabled = await this.settings.isRecipientDeliveryEnabled(recipientType)
    if (!deliveryEnabled) {
      throw new BadRequestException('Admin email delivery is disabled. Enable it before sending test emails.')
    }
    this.providerFactory.reset()
    await this.emailService.sendTestEmail({
      category: EmailCategory.ORDERS,
      variant,
      to: body.to,
      locale: 'en',
      scenarioKey: 'order.received',
    })
    return { ok: true }
  }

  @Get('inbox-config')
  async getInboxEmailConfig() {
    return this.buildInboxEmailConfigResponse()
  }

  @Put('inbox-config')
  async updateInboxEmailConfig(@Body() body: InboxEmailConfigPayload) {
    const current = await this.secureConfig
      .getJson<StoredInboxEmailConfig>(INBOX_EMAIL_CONFIG_SECURE_KEY)
      .catch(() => null)

    const payload: StoredInboxEmailConfig = {
      imapHost: this.sanitizeOptionalString(body.imapHost),
      imapPort: this.sanitizePositiveInteger(body.imapPort),
      imapSecurity: this.sanitizeSecurityOption(body.imapSecurity),
      smtpHost: this.sanitizeOptionalString(body.smtpHost),
      smtpPort: this.sanitizePositiveInteger(body.smtpPort),
      smtpSecurity: this.sanitizeSecurityOption(body.smtpSecurity),
      username: this.sanitizeOptionalString(body.username),
      password:
        body.password === undefined
          ? current?.value.password ?? null
          : this.sanitizeOptionalString(body.password),
      fromAddress: this.sanitizeOptionalString(body.fromAddress),
      fromName: this.sanitizeOptionalString(body.fromName),
      maxAttachmentSizeMb: this.sanitizePositiveInteger(body.maxAttachmentSizeMb),
      ratePerMinute: this.sanitizePositiveInteger(body.ratePerMinute),
      pollIntervalMs: this.sanitizePositiveInteger(body.pollIntervalMs),
      pollBatchSize: this.sanitizePositiveInteger(body.pollBatchSize),
    }

    await this.secureConfig.setJson(INBOX_EMAIL_CONFIG_SECURE_KEY, payload)
    await this.emailChannel.refreshConfig()
    await this.inboxService.synchronizeConfiguredEmailAccount({ triggerSync: true })
    return this.buildInboxEmailConfigResponse()
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

  private sanitizeOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null
    }
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  private sanitizePositiveInteger(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null
    }
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
      return null
    }
    const rounded = Math.round(numeric)
    return rounded > 0 ? rounded : null
  }

  private sanitizeSecurityOption(value: unknown): EmailChannelSecurityOption | null {
    if (typeof value !== 'string') {
      return null
    }
    const normalized = value.trim().toUpperCase()
    if (normalized === 'SSL_TLS' || normalized === 'STARTTLS' || normalized === 'NONE') {
      return normalized as EmailChannelSecurityOption
    }
    return null
  }

  private async buildInboxEmailConfigResponse(): Promise<InboxEmailConfigResponse> {
    const stored = await this.secureConfig
      .getJson<StoredInboxEmailConfig>(INBOX_EMAIL_CONFIG_SECURE_KEY)
      .catch(() => null)
    const overrides = stored?.value ?? null
    const resolved = buildEmailChannelConfig(this.configService, undefined, overrides ?? undefined)
    const envPassword = this.configService.get<string>('INBOX_EMAIL_PASSWORD') ?? ''
    const passwordCandidate = (overrides?.password ?? envPassword).trim()

    return {
      source: overrides ? 'database' : 'environment',
      updatedAt: stored?.updatedAt ?? null,
      imapHost: resolved.imap.host,
      imapPort: resolved.imap.port,
      imapSecurity: resolved.imap.security,
      smtpHost: resolved.smtp.host,
      smtpPort: resolved.smtp.port,
      smtpSecurity: resolved.smtp.security,
      username: resolved.credentials.user,
      fromAddress: resolved.defaults.fromAddress,
      fromName: resolved.defaults.fromName ?? null,
      maxAttachmentSizeMb: resolved.limits.maxAttachmentSizeMb,
      ratePerMinute: resolved.limits.outgoingRatePerMinute,
      pollIntervalMs: resolved.polling.intervalMs,
      pollBatchSize: resolved.polling.batchSize,
      passwordSet: passwordCandidate.length > 0,
    }
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

import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EmailCategory, Prisma, RoleNotificationRule, Role } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { RoleRuleInput } from './email.types'
import { SecureConfigService } from '../common/security/secure-config.service'

export type EmailCategorySettings = {
  category: EmailCategory
  fromAddress: string
  fromName?: string | null
  adminRecipients: string[]
  cc: string[]
  bcc: string[]
  enabled: boolean
  updatedAt: Date
}

export type EmailProviderType = 'SMTP' | 'SENDGRID' | 'DEV'

export type EmailProviderConfig = {
  provider: EmailProviderType
  fromAddress: string
  fromName: string
  smtp: {
    host: string
    port: number
    secure: boolean
    allowInvalidCerts: boolean
    user?: string | null
    password?: string | null
  } | null
}

@Injectable()
export class EmailSettingsService {
  private readonly logger = new Logger(EmailSettingsService.name)
  private static readonly EMAIL_PROVIDER_CONFIG_KEY = 'email.provider.config'

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly secureConfig: SecureConfigService,
  ) {}

  private defaultFromAddress() {
    return this.config.get<string>('EMAIL_FROM_DEFAULT') ?? 'no-reply@example.com'
  }

  private defaultFromName() {
    return this.config.get<string>('EMAIL_FROM_NAME_DEFAULT') ?? 'Sistema Administrativo'
  }

  private async loadStoredProviderConfig(): Promise<EmailProviderConfig | null> {
    const stored = await this.secureConfig.getJson<EmailProviderConfig>(EmailSettingsService.EMAIL_PROVIDER_CONFIG_KEY)
    if (!stored) {
      return null
    }
    return stored.value
  }

  async resolveEmailProviderConfig(): Promise<EmailProviderConfig> {
    const stored = await this.loadStoredProviderConfig()
    const provider = (stored?.provider ?? (this.config.get<string>('EMAIL_PROVIDER') ?? 'DEV')).toUpperCase() as EmailProviderType
    const fromAddress = stored?.fromAddress ?? this.config.get<string>('EMAIL_FROM_DEFAULT') ?? 'no-reply@example.com'
    const fromName = stored?.fromName ?? this.config.get<string>('EMAIL_FROM_NAME_DEFAULT') ?? 'Sistema Administrativo'

    if (provider !== 'SMTP') {
      return {
        provider,
        fromAddress,
        fromName,
        smtp: null,
      }
    }

    const host = stored?.smtp?.host ?? this.config.get<string>('EMAIL_SMTP_HOST') ?? ''
    const port = stored?.smtp?.port ?? Number(this.config.get<string>('EMAIL_SMTP_PORT') ?? '587')
    const secure = stored?.smtp?.secure ?? (this.config.get<string>('EMAIL_SMTP_SECURE') ?? 'false').toLowerCase() === 'true'
    const allowInvalidCerts = stored?.smtp?.allowInvalidCerts ?? (this.config.get<string>('EMAIL_SMTP_ALLOW_INVALID_CERTS') ?? 'false').toLowerCase() === 'true'
    const user = stored?.smtp?.user ?? this.config.get<string>('EMAIL_SMTP_USER') ?? null
    const password = stored?.smtp?.password ?? this.config.get<string>('EMAIL_SMTP_PASSWORD') ?? null

    return {
      provider,
      fromAddress,
      fromName,
      smtp: {
        host,
        port,
        secure,
        allowInvalidCerts,
        user,
        password,
      },
    }
  }

  async getEmailProviderConfig(): Promise<EmailProviderConfig> {
    const resolved = await this.resolveEmailProviderConfig()
    return {
      ...resolved,
      smtp: resolved.smtp
        ? {
              ...resolved.smtp,
              password: null,
          }
        : null,
    }
  }

  async updateEmailProviderConfig(payload: EmailProviderConfig): Promise<EmailProviderConfig> {
    const provider = payload.provider.toUpperCase() as EmailProviderType
    const current = await this.loadStoredProviderConfig()
    const normalized: EmailProviderConfig = {
      provider,
      fromAddress: payload.fromAddress.trim(),
      fromName: payload.fromName.trim(),
      smtp:
        provider === 'SMTP'
          ? {
              host: payload.smtp?.host?.trim() ?? current?.smtp?.host ?? '',
              port: payload.smtp?.port ?? current?.smtp?.port ?? 587,
              secure: payload.smtp?.secure ?? current?.smtp?.secure ?? false,
              allowInvalidCerts: payload.smtp?.allowInvalidCerts ?? current?.smtp?.allowInvalidCerts ?? false,
              user: payload.smtp?.user?.trim() || current?.smtp?.user || null,
              password: payload.smtp?.password !== undefined && payload.smtp?.password !== null && payload.smtp?.password !== ''
                ? payload.smtp?.password
                : current?.smtp?.password ?? null,
            }
          : null,
    }

    await this.secureConfig.setJson(EmailSettingsService.EMAIL_PROVIDER_CONFIG_KEY, normalized)
    this.logger.log(`Email provider configuration updated (provider=${normalized.provider})`)
    return this.getEmailProviderConfig()
  }

  private async ensureSetting(category: EmailCategory) {
    const existing = await this.prisma.emailSetting.findUnique({ where: { category } })
    if (existing) {
      return existing
    }
    const providerConfig = await this.resolveEmailProviderConfig()
    return this.prisma.emailSetting.create({
      data: {
        category,
        fromAddress: providerConfig.fromAddress,
        fromName: providerConfig.fromName,
        enabled: true,
      },
    })
  }

  async getCategorySettings(category: EmailCategory): Promise<EmailCategorySettings> {
    const record = await this.ensureSetting(category)
    return {
      category,
      fromAddress: record.fromAddress,
      fromName: record.fromName,
      adminRecipients: record.adminRecipients ?? [],
      cc: record.cc ?? [],
      bcc: record.bcc ?? [],
      enabled: record.enabled,
      updatedAt: record.updatedAt,
    }
  }

  async listSettings(): Promise<EmailCategorySettings[]> {
    const categories: EmailCategory[] = [EmailCategory.ORDERS, EmailCategory.PAYMENTS, EmailCategory.AUTH]
    const settings = await this.prisma.emailSetting.findMany({
      where: { category: { in: categories } },
    })
    const map = new Map<EmailCategory, typeof settings[number]>()
    for (const setting of settings) {
      map.set(setting.category, setting)
    }
    const result: EmailCategorySettings[] = []
    for (const category of categories) {
      const existing = map.get(category)
      if (existing) {
        result.push({
          category,
          fromAddress: existing.fromAddress,
          fromName: existing.fromName,
          adminRecipients: existing.adminRecipients ?? [],
          cc: existing.cc ?? [],
          bcc: existing.bcc ?? [],
          enabled: existing.enabled,
          updatedAt: existing.updatedAt,
        })
      } else {
        const created = await this.ensureSetting(category)
        result.push({
          category,
          fromAddress: created.fromAddress,
          fromName: created.fromName,
          adminRecipients: created.adminRecipients ?? [],
          cc: created.cc ?? [],
          bcc: created.bcc ?? [],
          enabled: created.enabled,
          updatedAt: created.updatedAt,
        })
      }
    }
    return result
  }

  async updateCategorySettings(
    category: EmailCategory,
    data: Partial<Pick<EmailCategorySettings, 'fromAddress' | 'fromName' | 'adminRecipients' | 'cc' | 'bcc' | 'enabled'>>,
  ): Promise<EmailCategorySettings> {
    const normalizedAdminRecipients = this.normalizeEmailList(data.adminRecipients)
    const normalizedCc = this.normalizeEmailList(data.cc)
    const normalizedBcc = this.normalizeEmailList(data.bcc)
    const updateData: Prisma.EmailSettingUpdateInput = {}
    if (data.fromAddress !== undefined) {
      updateData.fromAddress = data.fromAddress.trim()
    }
    if (data.fromName !== undefined) {
      updateData.fromName = data.fromName?.trim() || null
    }
    if (normalizedAdminRecipients !== undefined) {
      updateData.adminRecipients = normalizedAdminRecipients
    }
    if (normalizedCc !== undefined) {
      updateData.cc = normalizedCc
    }
    if (normalizedBcc !== undefined) {
      updateData.bcc = normalizedBcc
    }
    if (data.enabled !== undefined) {
      updateData.enabled = data.enabled
    }
    const updated = await this.prisma.emailSetting.update({
      where: { category },
      data: updateData,
    })
    return {
      category,
      fromAddress: updated.fromAddress,
      fromName: updated.fromName,
      adminRecipients: updated.adminRecipients ?? [],
      cc: updated.cc ?? [],
      bcc: updated.bcc ?? [],
      enabled: updated.enabled,
      updatedAt: updated.updatedAt,
    }
  }

  private normalizeEmailList(input?: string[] | null) {
    if (!input) {
      return undefined
    }
    const emails = input
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length)
    return Array.from(new Set(emails))
  }

  async listRoleRules(): Promise<RoleNotificationRule[]> {
    return this.prisma.roleNotificationRule.findMany({
      orderBy: [
        { enabled: 'desc' },
        { role: 'asc' },
      ],
    })
  }

  async upsertRoleRule(id: number | null, payload: RoleRuleInput): Promise<RoleNotificationRule> {
    const normalizedCategories = Array.from(new Set(payload.categories))
    if (id) {
      return this.prisma.roleNotificationRule.update({
        where: { id },
        data: {
          role: payload.role,
          categories: normalizedCategories,
          enabled: payload.enabled,
        },
      })
    }
    return this.prisma.roleNotificationRule.create({
      data: {
        role: payload.role,
        categories: normalizedCategories,
        enabled: payload.enabled,
      },
    })
  }

  async deleteRoleRule(id: number) {
    await this.prisma.roleNotificationRule.delete({ where: { id } })
    return true
  }

  async resolveAdminRecipients(category: EmailCategory): Promise<{
    to: string[]
    cc: string[]
    bcc: string[]
  }> {
    const setting = await this.ensureSetting(category)
    const rules = await this.prisma.roleNotificationRule.findMany({
      where: {
        enabled: true,
        categories: { has: category },
      },
    })
    let ruleRecipients: string[] = []
    if (rules.length) {
      const roles = Array.from(new Set(rules.map((rule) => rule.role)))
      const users = await this.prisma.user.findMany({
        where: {
          role: { in: roles },
        },
        select: { email: true },
      })
      ruleRecipients = users.map((user) => user.email.trim().toLowerCase())
    }
    const toRecipients = Array.from(
      new Set([...(setting.adminRecipients ?? []).map((email) => email.trim().toLowerCase()), ...ruleRecipients]),
    )
    const cc = (setting.cc ?? []).map((email) => email.trim().toLowerCase())
    const bcc = (setting.bcc ?? []).map((email) => email.trim().toLowerCase())
    return {
      to: toRecipients,
      cc: Array.from(new Set(cc)),
      bcc: Array.from(new Set(bcc)),
    }
  }

  async isEnabled(category: EmailCategory): Promise<boolean> {
    const setting = await this.ensureSetting(category)
    return setting.enabled
  }

  async getCompanyProfile() {
    const profile = await this.prisma.companyProfile.findFirst({
      where: { singleton: 'default' },
    })
    if (!profile) {
      return {
        legalName: this.config.get<string>('COMPANY_NAME') ?? 'Sistema Administrativo',
        tradeName: this.config.get<string>('COMPANY_NAME') ?? 'Sistema Administrativo',
        email: this.config.get<string>('COMPANY_EMAIL') ?? this.defaultFromAddress(),
        phone: null,
        website: null,
        addressLine1: null,
        addressLine2: null,
      }
    }
    return {
      legalName: profile.legalName,
      tradeName: profile.tradeName,
      email: profile.email,
      phone: profile.phone,
      website: profile.website,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
    }
  }

  async getRoleOptions(): Promise<Role[]> {
    return Object.values(Role)
  }
}

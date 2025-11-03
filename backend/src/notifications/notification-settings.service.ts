import { Injectable, Logger } from '@nestjs/common'
import {
  NotificationAudience,
  NotificationChannel,
  NotificationEventType,
  NotificationSetting,
  Role,
  EmailCategory,
  Prisma,
} from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { EmailSettingsService } from '../email/email-settings.service'
import type { RoleNotificationRule } from '@prisma/client'

export type NotificationSettingDto = {
  eventType: NotificationEventType
  audience: NotificationAudience
  channel: NotificationChannel
  enabled: boolean
  roles: Role[]
  templateKey?: string | null
  localeOverrides?: Record<string, unknown> | null
  emailSubject?: string | null
}

export type NotificationSettingsUpdateInput = {
  settings: NotificationSettingDto[]
}

type DefaultSetting = {
  eventType: NotificationEventType
  audience: NotificationAudience
  channel: NotificationChannel
  enabled: boolean
  roles?: Role[]
  templateKey?: string | null
  emailSubject?: string | null
}

const EMAIL_CATEGORY_MAP: Record<NotificationEventType, EmailCategory | null> = {
  [NotificationEventType.ORDER_RECEIVED]: EmailCategory.ORDERS,
  [NotificationEventType.PAYMENT_RECEIVED]: EmailCategory.PAYMENTS,
  [NotificationEventType.ORDER_STATUS_CHANGED]: EmailCategory.ORDERS,
}

const ROLE_VALUES: Role[] = [
  Role.SUPERADMIN,
  Role.ADMIN,
  Role.OPS,
  Role.SALES,
  Role.FINANCE,
  Role.USER,
]

const LEGACY_ADMIN_ROLE_PRESETS: Record<string, Role[]> = {
  'ORDER_RECEIVED:ADMIN:IN_APP': [Role.ADMIN, Role.OPS, Role.SALES],
  'ORDER_RECEIVED:ADMIN:EMAIL': [Role.ADMIN, Role.OPS, Role.SALES],
  'PAYMENT_RECEIVED:ADMIN:IN_APP': [Role.ADMIN, Role.FINANCE],
  'PAYMENT_RECEIVED:ADMIN:EMAIL': [Role.ADMIN, Role.FINANCE],
  'ORDER_STATUS_CHANGED:ADMIN:IN_APP': [Role.ADMIN, Role.OPS, Role.SALES],
  'ORDER_STATUS_CHANGED:ADMIN:EMAIL': [Role.ADMIN, Role.OPS, Role.SALES],
}

const DEFAULT_SETTINGS: DefaultSetting[] = [
  {
    eventType: NotificationEventType.ORDER_RECEIVED,
    audience: NotificationAudience.CUSTOMER,
    channel: NotificationChannel.IN_APP,
    enabled: true,
  },
  {
    eventType: NotificationEventType.ORDER_RECEIVED,
    audience: NotificationAudience.CUSTOMER,
    channel: NotificationChannel.EMAIL,
    enabled: false,
    emailSubject: 'We received your order',
  },
  {
    eventType: NotificationEventType.ORDER_RECEIVED,
    audience: NotificationAudience.ADMIN,
    channel: NotificationChannel.IN_APP,
    enabled: true,
    roles: [Role.SUPERADMIN, Role.ADMIN, Role.OPS, Role.SALES],
  },
  {
    eventType: NotificationEventType.ORDER_RECEIVED,
    audience: NotificationAudience.ADMIN,
    channel: NotificationChannel.EMAIL,
    enabled: true,
    roles: [Role.SUPERADMIN, Role.ADMIN, Role.OPS, Role.SALES],
    emailSubject: 'New order received',
  },
  {
    eventType: NotificationEventType.PAYMENT_RECEIVED,
    audience: NotificationAudience.CUSTOMER,
    channel: NotificationChannel.IN_APP,
    enabled: true,
  },
  {
    eventType: NotificationEventType.PAYMENT_RECEIVED,
    audience: NotificationAudience.CUSTOMER,
    channel: NotificationChannel.EMAIL,
    enabled: false,
    emailSubject: 'Payment received for your order',
  },
  {
    eventType: NotificationEventType.PAYMENT_RECEIVED,
    audience: NotificationAudience.ADMIN,
    channel: NotificationChannel.IN_APP,
    enabled: true,
    roles: [Role.SUPERADMIN, Role.ADMIN, Role.FINANCE],
  },
  {
    eventType: NotificationEventType.PAYMENT_RECEIVED,
    audience: NotificationAudience.ADMIN,
    channel: NotificationChannel.EMAIL,
    enabled: true,
    roles: [Role.SUPERADMIN, Role.ADMIN, Role.FINANCE],
    emailSubject: 'Payment confirmed',
  },
  {
    eventType: NotificationEventType.ORDER_STATUS_CHANGED,
    audience: NotificationAudience.CUSTOMER,
    channel: NotificationChannel.IN_APP,
    enabled: true,
  },
  {
    eventType: NotificationEventType.ORDER_STATUS_CHANGED,
    audience: NotificationAudience.CUSTOMER,
    channel: NotificationChannel.EMAIL,
    enabled: false,
  },
  {
    eventType: NotificationEventType.ORDER_STATUS_CHANGED,
    audience: NotificationAudience.ADMIN,
    channel: NotificationChannel.IN_APP,
    enabled: true,
    roles: [Role.SUPERADMIN, Role.ADMIN, Role.OPS, Role.SALES],
  },
  {
    eventType: NotificationEventType.ORDER_STATUS_CHANGED,
    audience: NotificationAudience.ADMIN,
    channel: NotificationChannel.EMAIL,
    enabled: false,
    roles: [Role.SUPERADMIN, Role.ADMIN, Role.OPS, Role.SALES],
  },
]

@Injectable()
export class NotificationSettingsService {
  private readonly logger = new Logger(NotificationSettingsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSettings: EmailSettingsService,
  ) {}

  private normalizeLocaleOverridesInput(value?: Record<string, unknown> | null) {
    if (value === undefined) {
      return undefined
    }
    if (value === null) {
      return Prisma.JsonNull
    }
    return value as Prisma.InputJsonValue
  }

  async listSettings(): Promise<NotificationSetting[]> {
    await this.ensureDefaults()
    return this.prisma.notificationSetting.findMany({
      orderBy: [
        { eventType: 'asc' },
        { audience: 'asc' },
        { channel: 'asc' },
      ],
    })
  }

  async updateSettings(payload: NotificationSettingsUpdateInput): Promise<NotificationSetting[]> {
    await this.ensureDefaults()
    const updates = payload.settings ?? []
    for (const setting of updates) {
      const updatePayload = this.buildUpdatePayload(setting)
      const createPayload = this.buildCreatePayload(setting)
      await this.prisma.notificationSetting.upsert({
        where: {
          eventType_audience_channel: {
            eventType: setting.eventType,
            audience: setting.audience,
            channel: setting.channel,
          },
        },
        update: updatePayload,
        create: createPayload,
      })
      await this.syncEmailIntegrations(setting)
    }
    return this.listSettings()
  }

  private buildUpdatePayload(setting: NotificationSettingDto) {
    const localeOverrides = this.normalizeLocaleOverridesInput(setting.localeOverrides)
    return {
      enabled: setting.enabled,
      roles: setting.roles ?? [],
      templateKey: setting.templateKey ?? null,
      localeOverrides,
      emailSubject: setting.emailSubject ?? null,
    }
  }

  private buildCreatePayload(setting: NotificationSettingDto) {
    const localeOverrides = this.normalizeLocaleOverridesInput(setting.localeOverrides)
    return {
      eventType: setting.eventType,
      audience: setting.audience,
      channel: setting.channel,
      enabled: setting.enabled,
      roles: setting.roles ?? [],
      templateKey: setting.templateKey ?? null,
      localeOverrides: localeOverrides ?? Prisma.JsonNull,
      emailSubject: setting.emailSubject ?? null,
    }
  }

  async resolveAudienceChannels(
    eventType: NotificationEventType,
    audience: NotificationAudience,
  ): Promise<Record<NotificationChannel, NotificationSetting>> {
    await this.ensureDefaults()
    const records = await this.prisma.notificationSetting.findMany({
      where: {
        eventType,
        audience,
      },
    })
    const map = new Map<NotificationChannel, NotificationSetting>()
    records.forEach((record) => map.set(record.channel, record))
    for (const channel of Object.values(NotificationChannel)) {
      if (!map.has(channel)) {
        const fallback = DEFAULT_SETTINGS.find(
          (d) => d.eventType === eventType && d.audience === audience && d.channel === channel,
        )
        if (fallback) {
          map.set(channel, {
            id: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
            localeOverrides: null,
            templateKey: fallback.templateKey ?? null,
            emailSubject: fallback.emailSubject ?? null,
            enabled: fallback.enabled,
            roles: fallback.roles ?? [],
            eventType,
            audience,
            channel,
          })
        }
      }
    }
    return Object.values(NotificationChannel).reduce((acc, channel) => {
      const record = map.get(channel)
      if (record) {
        acc[channel] = record
      }
      return acc
    }, {} as Record<NotificationChannel, NotificationSetting>)
  }

  async resolveAdminRecipients(
    eventType: NotificationEventType,
  ): Promise<Array<{ id: number; email: string; name: string | null; lastName: string | null }>> {
    await this.ensureDefaults()
    const settings = await this.prisma.notificationSetting.findMany({
      where: {
        eventType,
        audience: NotificationAudience.ADMIN,
        channel: NotificationChannel.IN_APP,
        enabled: true,
      },
    })
    const roleSet = new Set<Role>()
    for (const record of settings) {
      for (const role of record.roles ?? []) {
        const normalized = ROLE_VALUES.find((entry) => entry === role)
        if (normalized) {
          roleSet.add(normalized)
        }
      }
    }
    if (!roleSet.size) {
      return []
    }
    const roles = Array.from(roleSet)
    const users = await this.prisma.user.findMany({
      where: { role: { in: roles } },
      select: {
        id: true,
        email: true,
        name: true,
        lastName: true,
      },
    })
    return users
  }

  private async ensureDefaults() {
    let records = await this.prisma.notificationSetting.findMany()
    const buildKey = (record: { eventType: NotificationEventType; audience: NotificationAudience; channel: NotificationChannel }) =>
      `${record.eventType}:${record.audience}:${record.channel}`
    const existingMap = new Map(records.map((record) => [buildKey(record), record]))
    const existingSet = new Set(existingMap.keys())
    const creations: Prisma.NotificationSettingCreateManyInput[] = []
    for (const def of DEFAULT_SETTINGS) {
      const key = `${def.eventType}:${def.audience}:${def.channel}`
      if (existingSet.has(key)) continue
      creations.push({
        eventType: def.eventType,
        audience: def.audience,
        channel: def.channel,
        enabled: def.enabled,
        roles: def.roles ?? [],
        templateKey: def.templateKey ?? null,
        localeOverrides: Prisma.JsonNull,
        emailSubject: def.emailSubject ?? null,
      })
    }
    if (creations.length) {
      await this.prisma.notificationSetting.createMany({ data: creations })
      records = await this.prisma.notificationSetting.findMany()
    }

    const updatedRecords = new Map(records.map((record) => [buildKey(record), record]))
    const updates: Array<{ id: number; roles: Role[] }> = []
    const normalizeRoles = (roles?: (Role | string)[] | null): Role[] => {
      if (!roles) return []
      const seen = new Set<Role>()
      for (const role of roles) {
        const candidate = role as Role
        if (ROLE_VALUES.includes(candidate)) {
          seen.add(candidate)
        }
      }
      return Array.from(seen)
    }

    const arraysEqual = (a: Role[], b: Role[]) => {
      if (a.length !== b.length) return false
      const setA = new Set(a)
      return b.every((value) => setA.has(value))
    }

    for (const def of DEFAULT_SETTINGS) {
      if (!def.roles || def.roles.length === 0) continue
      const key = `${def.eventType}:${def.audience}:${def.channel}`
      const record = updatedRecords.get(key)
      if (!record) continue
      const currentRoles = normalizeRoles(record.roles)
      const missingRoles = def.roles.filter((role) => !currentRoles.includes(role))
      if (!missingRoles.length) {
        continue
      }
      const legacy = LEGACY_ADMIN_ROLE_PRESETS[key]
      const shouldPatch =
        legacy !== undefined &&
        arraysEqual(currentRoles, legacy) &&
        record.createdAt.getTime() === record.updatedAt.getTime()
      if (!shouldPatch) {
        continue
      }
      const nextRoles = normalizeRoles([...(record.roles ?? []), ...missingRoles])
      updates.push({ id: record.id, roles: nextRoles })
    }

    for (const update of updates) {
      await this.prisma.notificationSetting.update({
        where: { id: update.id },
        data: { roles: update.roles },
      })
    }
  }

  private async syncEmailIntegrations(setting: NotificationSettingDto) {
    const category = EMAIL_CATEGORY_MAP[setting.eventType]
    if (!category) {
      return
    }
    if (setting.audience === NotificationAudience.CUSTOMER && setting.channel === NotificationChannel.EMAIL) {
      await this.emailSettings.updateCategorySettings(category, { enabled: setting.enabled })
      return
    }
    if (setting.audience === NotificationAudience.ADMIN && setting.channel === NotificationChannel.EMAIL) {
      await this.syncRoleRules(category, setting.roles ?? [], setting.enabled)
    }
  }

  private async syncRoleRules(category: EmailCategory, roles: Role[], enabled: boolean) {
    const normalizedRoles = Array.from(
      new Set(
        (roles ?? []).filter((role): role is Role =>
          ROLE_VALUES.includes(role as Role),
        ),
      ),
    )
    const rules = await this.emailSettings.listRoleRules()
    const rulesByRole = new Map<Role, RoleNotificationRule>()
    for (const rule of rules) {
      rulesByRole.set(rule.role as Role, rule)
    }

    const desired = new Set(normalizedRoles)
    for (const role of ROLE_VALUES) {
      const existing = rulesByRole.get(role)
      const shouldInclude = desired.has(role) && enabled
      if (shouldInclude) {
        if (existing) {
          const categories = existing.categories.includes(category)
            ? existing.categories
            : [...existing.categories, category]
          await this.emailSettings.upsertRoleRule(existing.id, {
            role,
            categories,
            enabled: true,
          })
        } else {
          await this.emailSettings.upsertRoleRule(null, {
            role,
            categories: [category],
            enabled: true,
          })
        }
      } else if (existing && existing.categories.includes(category)) {
        const remaining = existing.categories.filter((cat) => cat !== category)
        await this.emailSettings.upsertRoleRule(existing.id, {
          role,
          categories: remaining,
          enabled: remaining.length ? existing.enabled : false,
        })
      }
    }
  }
}

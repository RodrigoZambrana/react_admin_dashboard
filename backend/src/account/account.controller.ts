import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import { Prisma, UserActivityType } from '@prisma/client'
import {
  normalizeAvatarPath,
  persistAvatarFile,
  resolveAvatarPublicUrl,
} from '../common/uploads/avatar'
import { parseSingleFileMultipart } from '../common/uploads/multipart'
import { UserActivityService } from '../user-activity/user-activity.service'
import * as bcrypt from 'bcrypt'

const normalizeNullableString = (value?: string | null) => {
  if (value === undefined || value === null) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const normalizeRequiredString = (value: string, field: string) => {
  const trimmed = (value || '').trim()
  if (!trimmed) {
    throw new BadRequestException({
      message: 'validation.fieldInvalid',
      errors: [{ field, key: 'validation.fieldRequired' }],
    })
  }
  return trimmed
}

const HALF_DAY_IN_MS = 12 * 60 * 60 * 1000

@UseGuards(JwtAuthGuard)
@Controller('account')
export class AccountController {
  private readonly activityPageSize = 2

  constructor(
    private readonly prisma: PrismaService,
    private readonly userActivity: UserActivityService,
  ) {}

  private extractUserId(req: FastifyRequest) {
    const authUser = (req as unknown as { user?: { sub?: number } }).user
    const userId = Number(authUser?.sub)
    if (!Number.isInteger(userId)) {
      throw new BadRequestException('account.activity.userNotFound')
    }
    return userId
  }

  private startOfDay(date: Date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  }

  private dateKey(date: Date) {
    return this.startOfDay(date).toISOString().slice(0, 10)
  }

  private formatActivityType(type: UserActivityType) {
    return type.replace(/_/g, '-')
  }

  private normalizeFilterTypes(filter?: string[]) {
    if (!Array.isArray(filter) || filter.length === 0) {
      return null
    }
    const allowed = new Set(Object.values(UserActivityType))
    const normalized = filter
      .map((value) => (value || '').toUpperCase().replace(/-/g, '_'))
      .filter((value): value is UserActivityType =>
        allowed.has(value as UserActivityType),
      )
    return normalized.length ? normalized : null
  }

  private normalizeMetadataResponse(activity: {
    metadata: Prisma.JsonValue | null
    ipAddress: string | null
    device?: { displayName: string | null; location: string | null } | null
  }) {
    const record: Record<string, string> = {}
    if (
      activity.metadata &&
      typeof activity.metadata === 'object' &&
      !Array.isArray(activity.metadata)
    ) {
      for (const [key, value] of Object.entries(activity.metadata)) {
        if (value === undefined || value === null) continue
        const stringValue = typeof value === 'string' ? value : String(value)
        if (stringValue.trim().length > 0) {
          record[key] = stringValue
        }
      }
    }
    if (activity.ipAddress && !record.ipAddress) {
      record.ipAddress = activity.ipAddress
    }
    if (activity.device?.displayName && !record.device) {
      record.device = activity.device.displayName
    }
    if (activity.device?.location && !record.location) {
      record.location = activity.device.location
    }
    return Object.keys(record).length ? record : undefined
  }

  private resolveUserName(user?: {
    name?: string | null
    lastName?: string | null
    userName?: string | null
  }) {
    if (!user) return 'User'
    const firstName = normalizeNullableString(user.name)
    const lastName = normalizeNullableString(user.lastName)
    const fullName = [firstName, lastName].filter(Boolean).join(' ')
    return fullName || user.userName || 'User'
  }

  private resolveDeviceType(deviceType?: string | null) {
    switch (deviceType) {
      case 'Mobile':
        return 'Mobile'
      case 'Tablet':
        return 'Tablet'
      default:
        return 'Desktop'
    }
  }

  private async buildLoginHistory(userId: number) {
    if (!Number.isInteger(userId)) {
      return []
    }
    const devices = await this.prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      take: 10,
    })
    return devices.map((device) => ({
      type: this.resolveDeviceType(device.deviceType),
      deviceName: device.displayName || 'Unknown device',
      time: Math.floor(
        (device.lastSeenAt ?? device.firstSeenAt).getTime() / 1000,
      ),
      location: device.location || 'Unknown',
    }))
  }

  private buildActivityWhere(
    userId: number,
    types: UserActivityType[] | null,
  ) {
    const clauses: Prisma.Sql[] = [Prisma.sql`"userId" = ${userId}`]
    if (types?.length) {
      const enumValues = types.map((type) =>
        Prisma.sql`${type}::"UserActivityType"`,
      )
      clauses.push(Prisma.sql`"type" IN (${Prisma.join(enumValues)})`)
    }
    return Prisma.join(clauses, ' AND ')
  }

  private buildActivityGroups(
    activities: Array<{
      performedAt: Date
      type: UserActivityType
      description: string | null
      metadata: Prisma.JsonValue | null
      ipAddress: string | null
      user: {
        name?: string | null
        lastName?: string | null
        userName?: string | null
        img?: string | null
      } | null
      device: { displayName: string | null; location: string | null } | null
    }>,
    req: FastifyRequest,
  ) {
    const map = new Map<
      string,
      {
        id: string
        date: number
        events: Array<{
          type: string
          dateTime: number
          userName: string
          userImg?: string
          description?: string
          metadata?: Record<string, string>
        }>
      }
    >()
    for (const activity of activities) {
      const day = this.startOfDay(activity.performedAt)
      const key = this.dateKey(day)
      if (!map.has(key)) {
        const displayDate = new Date(day.getTime() + HALF_DAY_IN_MS)
        map.set(key, {
          id: key,
          date: Math.floor(displayDate.getTime() / 1000),
          events: [],
        })
      }
      const container = map.get(key)!
      const avatar =
        resolveAvatarPublicUrl(req, activity.user?.img ?? null) || ''
      container.events.push({
        type: this.formatActivityType(activity.type),
        dateTime: Math.floor(activity.performedAt.getTime() / 1000),
        userName: this.resolveUserName(activity.user ?? undefined),
        userImg: avatar || undefined,
        description: activity.description ?? undefined,
        metadata: this.normalizeMetadataResponse(activity),
      })
    }
    for (const group of map.values()) {
      group.events.sort((a, b) => b.dateTime - a.dateTime)
      if (group.events.length > 0) {
        group.date = group.events[0].dateTime
      }
    }
    return map
  }

  @Get('setting')
  async setting(@Request() req: FastifyRequest) {
    const authUser = (req as unknown as { user?: { sub?: number; email?: string; name?: string; lastName?: string; avatar?: string | null } }).user
    const userId = Number(authUser?.sub)
    const fallbackEmail = authUser?.email || 'admin@example.com'
    const fallbackFirstName =
      normalizeNullableString(authUser?.name) || 'Admin'
    const fallbackLastName =
      normalizeNullableString(authUser?.lastName) || ''
    let email = fallbackEmail
    let firstName = fallbackFirstName
    let lastName = fallbackLastName
    let avatar = normalizeNullableString(authUser?.avatar) || ''

    if (Number.isInteger(userId)) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, lastName: true, img: true },
      })
      if (dbUser) {
        email = dbUser.email || fallbackEmail
        firstName =
          normalizeNullableString(dbUser.name) || fallbackFirstName || 'Admin'
        lastName =
          normalizeNullableString(dbUser.lastName) || fallbackLastName || ''
        avatar = normalizeNullableString(dbUser.img) || avatar || ''
      }
    }

    const name = [firstName, lastName].filter(Boolean).join(' ')
    const resolvedAvatar = resolveAvatarPublicUrl(req, avatar)
    const loginHistory = await this.buildLoginHistory(userId)

    return {
      profile: {
        email,
        firstName,
        name,
        lastName,
        avatar: resolvedAvatar || '/img/avatars/thumb-1.jpg',
        lang: 'en',
      },
      loginHistory,
    }
  }

  @Get('setting/integration')
  integration() {
    return { providers: [] }
  }

  @Get('setting/billing')
  billing() {
    return { plans: [] }
  }

  @Get('invoice')
  invoice(@Query('id') id: string) {
    return { id, items: [] }
  }

  @Post('log')
  async log(
    @Request() req: FastifyRequest,
    @Body() body: { filter?: string[]; activityIndex?: number },
  ) {
    const userId = this.extractUserId(req)
    const filters = this.normalizeFilterTypes(body?.filter)
    const pageIndex = Number(body?.activityIndex) || 1
    const page = pageIndex > 0 ? pageIndex : 1
    const offset = (page - 1) * this.activityPageSize

    const whereClause = this.buildActivityWhere(userId, filters)
    const rawDates = await this.prisma.$queryRaw<Array<{ date: Date }>>(
      Prisma.sql`
        SELECT DISTINCT DATE("performedAt") AS "date"
        FROM "UserActivity"
        WHERE ${whereClause}
        ORDER BY "date" DESC
        OFFSET ${offset}
        LIMIT ${this.activityPageSize + 1}
      `,
    )

    const pageDates = rawDates
      .slice(0, this.activityPageSize)
      .map((row) => new Date(row.date))
    const loadable = rawDates.length > this.activityPageSize

    if (!pageDates.length) {
      return {
        data: [],
        loadable: false,
      }
    }

    const dayRanges = pageDates.map((date) => {
      const start = this.startOfDay(date)
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
      return { start, end }
    })

    const rangeStart = dayRanges.reduce(
      (acc, range) => (range.start < acc ? range.start : acc),
      dayRanges[0].start,
    )
    const rangeEnd = dayRanges.reduce(
      (acc, range) => (range.end > acc ? range.end : acc),
      dayRanges[0].end,
    )

    const activities = await this.prisma.userActivity.findMany({
      where: {
        userId,
        ...(filters ? { type: { in: filters } } : {}),
        performedAt: {
          gte: rangeStart,
          lt: rangeEnd,
        },
      },
      include: {
        user: {
          select: {
            name: true,
            lastName: true,
            userName: true,
            img: true,
          },
        },
        device: {
          select: {
            displayName: true,
            location: true,
          },
        },
      },
      orderBy: { performedAt: 'desc' },
    })

    const groups = this.buildActivityGroups(activities, req)
    const orderedKeys = pageDates.map((date) => this.dateKey(date))
    const data = orderedKeys
      .map((key) => groups.get(key))
      .filter(
        (
          log,
        ): log is {
          id: string
          date: number
          events: Array<{
            type: string
            dateTime: number
            userName: string
            userImg?: string
            description?: string
            metadata?: Record<string, string>
          }>
        } => Boolean(log),
      )

    return {
      data,
      loadable,
    }
  }

  @Get('form')
  form() {
    return { kyc: {} }
  }

  @Put('setting/password')
  async updatePassword(
    @Request() req: FastifyRequest,
    @Body() body: { password?: string; newPassword?: string },
  ) {
    const userId = this.extractUserId(req)
    const currentPassword = normalizeRequiredString(body?.password ?? '', 'password')
    const newPassword = normalizeRequiredString(body?.newPassword ?? '', 'newPassword')

    if (newPassword.length < 8) {
      throw new BadRequestException('account.settings.password.tooShort')
    }
    if (!/^[A-Za-z0-9_-]*$/.test(newPassword)) {
      throw new BadRequestException('account.settings.password.invalidFormat')
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    })

    if (!existing) {
      throw new BadRequestException('account.settings.profile.userNotFound')
    }

    const valid = await bcrypt.compare(currentPassword, existing.passwordHash)
    if (!valid) {
      throw new BadRequestException('account.settings.password.invalidCurrent')
    }

    const sameAsOld = await bcrypt.compare(newPassword, existing.passwordHash)
    if (sameAsOld) {
      throw new BadRequestException('account.settings.password.sameAsOld')
    }

    const hashed = await bcrypt.hash(newPassword, 10)
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashed },
    })

    await this.userActivity.recordPasswordChange(userId, 'Self-service', req)

    return { ok: true }
  }

  @Put('setting/profile')
  async updateProfile(@Request() req: FastifyRequest) {
    const authUser = (req as unknown as { user?: { sub?: number } })?.user
    const userId = Number(authUser?.sub)
    if (!Number.isInteger(userId)) {
      throw new BadRequestException('account.settings.profile.userNotFound')
    }

    const { fields, file } = await parseSingleFileMultipart(req)

    const firstName = normalizeRequiredString(
      fields.firstName ?? '',
      'firstName',
    )
    const lastName = normalizeNullableString(fields.lastName)
    const email = normalizeRequiredString(fields.email ?? '', 'email').toLowerCase()
    const lang = (fields.lang || 'en').trim() || 'en'

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        img: true,
        name: true,
        lastName: true,
        email: true,
        userName: true,
        role: true,
      },
    })

    if (!existing) {
      throw new BadRequestException('account.settings.profile.userNotFound')
    }

    const currentAvatar = normalizeAvatarPath(existing.img)
    let avatarToPersist = currentAvatar

    if (file) {
      avatarToPersist = await persistAvatarFile(file, currentAvatar)
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: firstName,
          lastName,
          email,
          img: avatarToPersist ?? null,
        },
        select: {
          id: true,
          name: true,
          lastName: true,
          email: true,
          img: true,
          userName: true,
          role: true,
        },
      })

      const previousFirstName = normalizeNullableString(existing.name) || ''
      const previousLastName = normalizeNullableString(existing.lastName) || ''
      const previousEmail = (existing.email || '').toLowerCase()
      const previousAvatar = currentAvatar
      const updatedFields: string[] = []

      if (previousFirstName !== firstName) {
        updatedFields.push('First name')
      }
      if (previousLastName !== (lastName || '')) {
        updatedFields.push('Last name')
      }
      if (previousEmail !== email) {
        updatedFields.push('Email')
      }
      if ((previousAvatar || null) !== (avatarToPersist || null)) {
        updatedFields.push('Avatar')
      }

      if (updatedFields.length) {
        await this.userActivity.recordProfileUpdate(userId, updatedFields, req)
      }

      const publicAvatar = resolveAvatarPublicUrl(req, updated.img)
      return {
        profile: {
          firstName: updated.name || '',
          lastName: updated.lastName || '',
          name:
            [updated.name, updated.lastName].filter(Boolean).join(' ') ||
            updated.name ||
            '',
          email: updated.email,
          avatar: publicAvatar || '',
          lang,
        },
        user: {
          userName: updated.userName,
          email: updated.email,
          avatar: publicAvatar || '',
          authority: [updated.role],
          name: updated.name || '',
          lastName: updated.lastName || '',
        },
      }
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException({
          message: 'account.settings.profile.emailTaken',
          errors: [{ field: 'email', key: 'account.settings.profile.emailTaken' }],
        })
      }
      throw error
    }
  }
}

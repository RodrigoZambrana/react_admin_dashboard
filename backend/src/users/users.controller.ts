import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
  ForbiddenException,
  UseGuards,
  Request,
} from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { PrismaService } from '../prisma/prisma.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { Roles, ROLES } from '../auth/roles.decorator'
import { RolesGuard } from '../auth/roles.guard'
import { normalizeAvatarPath, persistAvatarFile } from '../common/uploads/avatar'
import { Prisma } from '@prisma/client'
import { parseSingleFileMultipart } from '../common/uploads/multipart'
import * as bcrypt from 'bcrypt'
import { assertStrongPassword } from '../common/validation/assert-strong-password'
import { resolveRequiredEnv } from '../common/config/runtime-env'
import {
  getCapabilityCatalog,
  mapCapabilityFromPrismaEnum,
  mapCapabilityGroupFromPrismaEnum,
  mapCapabilityGroupToPrismaEnum,
  mapCapabilityToPrismaEnum,
  normalizeCapabilityGroupList,
  normalizeCapabilityList,
  resolveUserCapabilityEnvelope,
} from '../auth/capabilities'
import {
  UserManagementPolicyService,
} from '../auth/user-management-policy'

const DEFAULT_TEMP_PASSWORD =
  resolveRequiredEnv('DEFAULT_USER_TEMP_PASSWORD', {
    developmentFallback: 'LocalDevUserPassword!ChangeMe',
  })

const normalizeNullableString = (value?: string | null) => {
  if (value === undefined || value === null) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const normalizeOptionalUppercase = (value?: string | null) => {
  const normalized = normalizeNullableString(value)
  return normalized ? normalized.toUpperCase() : normalized
}

const normalizeRequiredString = (value: string) => value.trim()

const parseStringArrayField = (
  value?: string | null,
): string[] | undefined => {
  if (value === undefined) {
    return undefined
  }

  const trimmed = String(value || '').trim()
  if (!trimmed) {
    return []
  }

  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) {
      throw new Error('invalid-array')
    }
    return parsed
      .map((entry) => String(entry || '').trim())
      .filter(Boolean)
  } catch {
    throw new BadRequestException('users.validation.invalidCapabilities')
  }
}

const serializeUser = (
  user: {
    id: number
    name: string | null
    lastName: string | null
    email: string
    img: string | null
    role: string
    country: string | null
    countryCode: string | null
    city: string | null
    capabilityGroups?: string[] | null
    directCapabilities?: string[] | null
  },
  options?: {
    includeCapabilities?: boolean
  },
) => {
  const includeCapabilities = options?.includeCapabilities !== false
  const capabilityGroups = normalizeCapabilityGroupList(
    (user.capabilityGroups ?? []).map((entry) => mapCapabilityGroupFromPrismaEnum(entry)),
  )
  const directCapabilities = normalizeCapabilityList(
    (user.directCapabilities ?? []).map((entry) => mapCapabilityFromPrismaEnum(entry)),
  )
  const capabilityState = resolveUserCapabilityEnvelope({
    role: user.role,
    capabilityGroups,
    directCapabilities,
  })

  return {
    ...user,
    name: normalizeRequiredString(user.name || ''),
    lastName: normalizeNullableString(user.lastName) || '',
    role: user.role,
    country: normalizeNullableString(user.country),
    countryCode: normalizeOptionalUppercase(user.countryCode),
    city: normalizeNullableString(user.city),
    capabilityGroups: includeCapabilities ? capabilityState.capabilityGroups : [],
    directCapabilities: includeCapabilities ? capabilityState.directCapabilities : [],
    capabilityEnvelope: includeCapabilities ? capabilityState.capabilityEnvelope : [],
    capabilitySource: includeCapabilities ? capabilityState.source : '',
  }
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN, ROLES.OPS, ROLES.SALES, ROLES.FINANCE)
@Controller('users')
export class UsersController {
  constructor(
    private prisma: PrismaService,
    private readonly userManagementPolicy: UserManagementPolicyService,
  ) {}

  @Get('capability-catalog')
  async capabilityCatalog(@Request() req: FastifyRequest) {
    const actor = (req as unknown as {
      user?: { role?: string; authority?: string[] }
    }).user
    await this.userManagementPolicy.assertCanAccessUserManagement(actor)
    const accessPolicy =
      await this.userManagementPolicy.getUserManagementPolicySnapshot(actor)

    if (!accessPolicy.canManageUserCapabilities) {
      return {
        capabilities: [],
        groups: [],
        legacyRoleDefaults: getCapabilityCatalog().legacyRoleDefaults,
        accessPolicy,
      }
    }

    return {
      ...getCapabilityCatalog(),
      accessPolicy,
    }
  }

  @Get()
  async list(@Request() req: FastifyRequest) {
    const actor = (req as unknown as {
      user?: { role?: string; authority?: string[] }
    }).user
    await this.userManagementPolicy.assertCanAccessUserManagement(actor)
    const includeCapabilities =
      await this.userManagementPolicy.canManageUserCapabilities(actor)
    const data = await this.prisma.user.findMany({
      orderBy: { id: 'desc' },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        img: true,
        role: true,
        country: true,
        countryCode: true,
        city: true,
        capabilityGroups: true,
        directCapabilities: true,
      },
    })
    return data.map((user) =>
      serializeUser(user, { includeCapabilities }),
    )
  }

  @Post()
  async create(@Request() req: FastifyRequest) {
    const actor = (req as unknown as {
      user?: { role?: string; authority?: string[] }
    }).user
    await this.userManagementPolicy.assertCanAccessUserManagement(actor)
    const { fields, file } = await parseSingleFileMultipart(req)
    const email = normalizeRequiredString(fields.email ?? '').toLowerCase()
    const avatarPath = file
      ? await persistAvatarFile(file)
      : normalizeAvatarPath(fields.img)
    const role = (fields.role || 'user').toLowerCase()
    const capabilityGroups = normalizeCapabilityGroupList(
      parseStringArrayField(fields.capabilityGroups),
    )
    const directCapabilities = normalizeCapabilityList(
      parseStringArrayField(fields.directCapabilities),
    )

    if (
      (capabilityGroups.length > 0 || directCapabilities.length > 0) &&
      !(await this.userManagementPolicy.canManageUserCapabilities(actor))
    ) {
      throw new ForbiddenException('users.capabilities.denied')
    }

    try {
      const hashedTempPassword = await bcrypt.hash(DEFAULT_TEMP_PASSWORD, 10)
      const created = await this.prisma.user.create({
        data: {
          name: normalizeRequiredString(fields.name ?? ''),
          lastName: normalizeNullableString(fields.lastName),
          email,
          img: avatarPath ?? null,
          role: (role || 'user').toUpperCase() as any,
          country: normalizeNullableString(fields.country),
          countryCode: normalizeOptionalUppercase(fields.countryCode),
          city: normalizeNullableString(fields.city),
          capabilityGroups: capabilityGroups.map((entry) =>
            mapCapabilityGroupToPrismaEnum(entry),
          ) as any,
          directCapabilities: directCapabilities.map((entry) =>
            mapCapabilityToPrismaEnum(entry),
          ) as any,
          passwordHash: hashedTempPassword,
        },
        select: {
          id: true,
          name: true,
          lastName: true,
          email: true,
          img: true,
          role: true,
          country: true,
          countryCode: true,
          city: true,
          capabilityGroups: true,
          directCapabilities: true,
        },
      })
      return serializeUser(created, {
        includeCapabilities:
          await this.userManagementPolicy.canManageUserCapabilities(actor),
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException({
          message: 'users.validation.duplicateEmail',
          errors: [{ field: 'email', key: 'users.validation.duplicateEmail' }],
        })
      }
      throw error
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Request() req: FastifyRequest) {
    const actor = (req as unknown as {
      user?: { role?: string; authority?: string[] }
    }).user
    await this.userManagementPolicy.assertCanAccessUserManagement(actor)
    const userId = Number(id)
    if (!Number.isInteger(userId)) {
      throw new BadRequestException('users.validation.invalidUser')
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { img: true },
    })

    if (!existing) {
      throw new BadRequestException('users.validation.invalidUser')
    }

    const { fields, file } = await parseSingleFileMultipart(req)

    const currentAvatar = normalizeAvatarPath(existing.img)
    let nextAvatar = currentAvatar
    if (file) {
      nextAvatar = await persistAvatarFile(file, currentAvatar)
    } else if (fields.img !== undefined) {
      nextAvatar = normalizeAvatarPath(fields.img)
    }

    const nameUpdate =
      fields.name === undefined
        ? undefined
        : normalizeRequiredString(fields.name)
    const lastNameUpdate =
      fields.lastName === undefined
        ? undefined
        : normalizeNullableString(fields.lastName)
    const emailUpdate =
      fields.email === undefined
        ? undefined
        : normalizeRequiredString(fields.email).toLowerCase()
    const roleUpdate =
      fields.role === undefined
        ? undefined
        : (fields.role as string).toUpperCase() as any
    const countryUpdate =
      fields.country === undefined
        ? undefined
        : normalizeNullableString(fields.country)
    const countryCodeUpdate =
      fields.countryCode === undefined
        ? undefined
        : normalizeOptionalUppercase(fields.countryCode)
    const cityUpdate =
      fields.city === undefined
        ? undefined
        : normalizeNullableString(fields.city)
    const capabilityGroupsUpdate =
      fields.capabilityGroups === undefined
        ? undefined
        : normalizeCapabilityGroupList(parseStringArrayField(fields.capabilityGroups)).map(
            (entry) => mapCapabilityGroupToPrismaEnum(entry),
          )
    const directCapabilitiesUpdate =
      fields.directCapabilities === undefined
        ? undefined
        : normalizeCapabilityList(parseStringArrayField(fields.directCapabilities)).map(
            (entry) => mapCapabilityToPrismaEnum(entry),
          )

    if (
      (capabilityGroupsUpdate !== undefined || directCapabilitiesUpdate !== undefined) &&
      !(await this.userManagementPolicy.canManageUserCapabilities(actor))
    ) {
      throw new ForbiddenException('users.capabilities.denied')
    }

    try {
      const updated = await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: nameUpdate,
          lastName: lastNameUpdate,
          email: emailUpdate,
          img: nextAvatar ?? null,
          role: roleUpdate,
          country: countryUpdate,
          countryCode: countryCodeUpdate,
          city: cityUpdate,
          capabilityGroups:
            capabilityGroupsUpdate === undefined
              ? undefined
              : ({ set: capabilityGroupsUpdate } as any),
          directCapabilities:
            directCapabilitiesUpdate === undefined
              ? undefined
              : ({ set: directCapabilitiesUpdate } as any),
        },
        select: {
          id: true,
          name: true,
          lastName: true,
          email: true,
          img: true,
          role: true,
          country: true,
          countryCode: true,
          city: true,
          capabilityGroups: true,
          directCapabilities: true,
        },
      })
      return serializeUser(updated, {
        includeCapabilities:
          await this.userManagementPolicy.canManageUserCapabilities(actor),
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException({
          message: 'users.validation.duplicateEmail',
          errors: [{ field: 'email', key: 'users.validation.duplicateEmail' }],
        })
      }
      throw error
    }
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Request() req: FastifyRequest) {
    const actor = (req as unknown as { user?: { role?: string; authority?: string[]; sub?: number } }).user
    await this.userManagementPolicy.assertCanAccessUserManagement(actor)
    const userId = Number(id)
    if (!Number.isInteger(userId)) {
      throw new BadRequestException('users.validation.invalidUser')
    }

    const authUser = actor
    const requesterId = Number(authUser?.sub)
    if (Number.isInteger(requesterId) && requesterId === userId) {
      throw new BadRequestException('users.validation.cannotDeleteSelf')
    }

    try {
      await this.prisma.user.delete({
        where: { id: userId },
      })
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new BadRequestException('users.validation.invalidUser')
      }
      throw error
    }

    return { success: true }
  }

  @Put(':id/password')
  async updatePassword(
    @Param('id') id: string,
    @Request() req: FastifyRequest,
    @Body()
    body: {
      password?: unknown
    },
  ) {
    const actor = (req as unknown as {
      user?: { role?: string; authority?: string[] }
    }).user
    await this.userManagementPolicy.assertCanAccessUserManagement(actor)
    const userId = Number(id)
    if (!Number.isInteger(userId)) {
      throw new BadRequestException('users.validation.invalidUser')
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    })

    if (!existing) {
      throw new BadRequestException('users.validation.invalidUser')
    }

    if (typeof body?.password !== 'string') {
      throw new BadRequestException('users.validation.passwordRequired')
    }

    const password = normalizeRequiredString(body.password)

    if (!password.length) {
      throw new BadRequestException('users.validation.passwordRequired')
    }

    assertStrongPassword(password, 'password')

    const hashed = await bcrypt.hash(password, 10)

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashed },
    })

    return { success: true }
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Delete,
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

const DEFAULT_TEMP_PASSWORD =
  process.env.DEFAULT_USER_TEMP_PASSWORD || 'TempPass@123!'

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

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN, ROLES.SUPERADMIN)
@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list() {
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
      },
    })
    // map role to lowercase for UI usage
    return data.map((u) => ({
      ...u,
      name: normalizeRequiredString(u.name || ''),
      lastName: normalizeNullableString(u.lastName) || '',
      role: u.role,
      country: normalizeNullableString(u.country),
      countryCode: normalizeOptionalUppercase(u.countryCode),
      city: normalizeNullableString(u.city),
    }))
  }

  @Post()
  async create(@Request() req: FastifyRequest) {
    const { fields, file } = await parseSingleFileMultipart(req)
    const email = normalizeRequiredString(fields.email ?? '').toLowerCase()
    const avatarPath = file
      ? await persistAvatarFile(file)
      : normalizeAvatarPath(fields.img)
    const role = (fields.role || 'user').toLowerCase()

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
        },
      })
      return {
        ...created,
        name: normalizeRequiredString(created.name || ''),
        lastName: normalizeNullableString(created.lastName) || '',
        role: created.role,
        country: normalizeNullableString(created.country),
        countryCode: normalizeOptionalUppercase(created.countryCode),
        city: normalizeNullableString(created.city),
      }
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
        },
      })
      return {
        ...updated,
        name: normalizeRequiredString(updated.name || ''),
        lastName: normalizeNullableString(updated.lastName) || '',
        role: updated.role,
        country: normalizeNullableString(updated.country),
        countryCode: normalizeOptionalUppercase(updated.countryCode),
        city: normalizeNullableString(updated.city),
      }
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
    const userId = Number(id)
    if (!Number.isInteger(userId)) {
      throw new BadRequestException('users.validation.invalidUser')
    }

    const authUser = (req as unknown as { user?: { sub?: number } }).user
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
    @Body()
    body: {
      password?: unknown
    },
  ) {
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

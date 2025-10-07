import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'

const normalizeNullableString = (value?: string | null) => {
  if (value === undefined || value === null) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

const normalizeRequiredString = (value: string) => value.trim()

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list() {
    const data = await this.prisma.user.findMany({
      orderBy: { id: 'desc' },
      select: { id: true, name: true, lastName: true, email: true, img: true, role: true },
    })
    // map role to lowercase for UI usage
    return data.map((u) => ({
      ...u,
      name: normalizeRequiredString(u.name || ''),
      lastName: normalizeNullableString(u.lastName) || '',
      role: (u.role as string).toLowerCase(),
    }))
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const created = await this.prisma.user.create({
      data: {
        userName: dto.email,
        name: normalizeRequiredString(dto.name),
        lastName: normalizeNullableString(dto.lastName),
        email: dto.email,
        img: dto.img,
        role: (dto.role || 'user').toUpperCase() as any,
        passwordHash: '$2b$10$UceECy7vFdsXL7Ctj1k9auHk/nP9bBWiygYxXyVeaEH0GxPbnA6Ni', // 'password'
      },
      select: { id: true, name: true, lastName: true, email: true, img: true, role: true },
    })
    return {
      ...created,
      name: normalizeRequiredString(created.name || ''),
      lastName: normalizeNullableString(created.lastName) || '',
      role: (created.role as string).toLowerCase(),
    }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const updated = await this.prisma.user.update({
      where: { id: Number(id) },
      data: {
        name: dto.name === undefined ? undefined : normalizeRequiredString(dto.name),
        lastName:
          dto.lastName === undefined
            ? undefined
            : normalizeNullableString(dto.lastName),
        email: dto.email,
        img: dto.img,
        role: dto.role ? (dto.role as string).toUpperCase() as any : undefined,
      },
      select: { id: true, name: true, lastName: true, email: true, img: true, role: true },
    })
    return {
      ...updated,
      name: normalizeRequiredString(updated.name || ''),
      lastName: normalizeNullableString(updated.lastName) || '',
      role: (updated.role as string).toLowerCase(),
    }
  }
}

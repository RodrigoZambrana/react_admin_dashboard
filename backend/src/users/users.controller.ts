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

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list() {
    const data = await this.prisma.user.findMany({
      orderBy: { id: 'desc' },
      select: { id: true, name: true, email: true, img: true, role: true },
    })
    // map role to lowercase for UI usage
    return data.map((u) => ({
      ...u,
      role: (u.role as string).toLowerCase(),
    }))
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    const created = await this.prisma.user.create({
      data: {
        userName: dto.email,
        name: dto.name,
        email: dto.email,
        img: dto.img,
        role: (dto.role || 'user').toUpperCase() as any,
        passwordHash: '$2b$10$UceECy7vFdsXL7Ctj1k9auHk/nP9bBWiygYxXyVeaEH0GxPbnA6Ni', // 'password'
      },
      select: { id: true, name: true, email: true, img: true, role: true },
    })
    return { ...created, role: (created.role as string).toLowerCase() }
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const updated = await this.prisma.user.update({
      where: { id: Number(id) },
      data: {
        name: dto.name,
        email: dto.email,
        img: dto.img,
        role: dto.role ? (dto.role as string).toUpperCase() as any : undefined,
      },
      select: { id: true, name: true, email: true, img: true, role: true },
    })
    return { ...updated, role: (updated.role as string).toLowerCase() }
  }
}


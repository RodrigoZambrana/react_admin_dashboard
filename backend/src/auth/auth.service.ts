import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import * as bcrypt from 'bcrypt'
import { JwtService } from '@nestjs/jwt'
import type { Role } from './roles.decorator'

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async validateUser(email: string, pass: string) {
    const normalizedEmail = (email || '').trim()
    if (!normalizedEmail) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const lowered = normalizedEmail.toLowerCase()

    const user =
      (await this.prisma.user.findFirst({
        where: { email: { equals: lowered, mode: 'insensitive' } },
      })) || null

    if (!user) throw new UnauthorizedException('Invalid credentials')
    const ok = await bcrypt.compare(pass, user.passwordHash)
    if (!ok) throw new UnauthorizedException('Invalid credentials')
    return user
  }

  signToken(user: {
    id: number
    email: string
    role: Role
    img?: string | null
    name?: string | null
    lastName?: string | null
  }) {
    const payload = {
      sub: user.id,
      email: user.email,
      authority: [user.role],
      avatar: user.img || '',
      role: user.role,
      name: user.name || '',
      lastName: user.lastName || '',
    }
    const token = this.jwt.sign(payload)
    return {
      token,
      user: {
        authority: [user.role],
        avatar: user.img || '',
        email: user.email,
        name: user.name || '',
        lastName: user.lastName || '',
      },
    }
  }
}
